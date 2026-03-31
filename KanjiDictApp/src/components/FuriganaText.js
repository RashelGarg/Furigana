/**
 * FuriganaText — renders Japanese text with hiragana readings above kanji.
 *
 * Reading resolution order (highest accuracy first):
 *   1. JMdict word lookup  — lookupWordReading(surface_form)
 *      Covers compound words correctly: 行列→ぎょうれつ, 今日→きょう
 *      Backed by the same database as Shirabe Jisho (~190k words, bundled).
 *
 *   2. Kuromoji tokenizer  — tok.reading (async, loads from CDN)
 *      Handles inflected forms and words not in JMdict.
 *
 *   3. Per-character kanjiDB fallback — always available, instant.
 *      Used for single kanji with no compound match.
 *
 * Web:    HTML <ruby>/<rt> via dangerouslySetInnerHTML
 * Native: plain text (ruby not supported natively)
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { lookupKanji } from '../utils/kanjiUtils';
import { lookupWordReading } from '../services/WordLookupService';
import { loadKuromoji, tokenize, getKuromojiStatus, KUROMOJI_STATUS } from '../services/KuromojiService';

const KANJI_RE     = /[\u4E00-\u9FAF\u3400-\u4DBF]/;
const HAS_KANJI_RE = /[\u4E00-\u9FAF\u3400-\u4DBF]/;
const KANA_RE      = /[\u3041-\u3096\u30A1-\u30F6]/;

// ── helpers ──────────────────────────────────────────────────────────────────

function katakanaToHiragana(str) {
  if (!str) return '';
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/** Escape HTML entities to prevent XSS */
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Returns the trailing hiragana/kana suffix of a string (okurigana portion). */
function getTrailingKana(str) {
  let i = str.length - 1;
  while (i >= 0 && KANA_RE.test(str[i])) i--;
  return str.slice(i + 1);
}

/** Build a <ruby> tag with reading above text */
function rubyTag(text, reading, fontSize, rtColor) {
  return `<ruby style="ruby-align:center">${esc(text)}<rt style="font-size:${Math.round(fontSize * 0.5)}px;color:${rtColor};font-family:inherit">${esc(reading)}</rt></ruby>`;
}

// ── per-character fallback (kanjiDB lookup) ───────────────────────────────────

function pickReading(entry) {
  if (!entry) return '';
  for (const kun of (entry.kunyomi || [])) {
    const clean = kun.split('.')[0].split('-')[0].split('、')[0].trim();
    if (clean && !clean.endsWith('つ')) return clean;
  }
  const firstKun = entry.kunyomi?.[0];
  if (firstKun) return firstKun.split('.')[0].split('-')[0].split('、')[0].trim();
  const on = entry.onyomi?.[0];
  if (on) return katakanaToHiragana(on.split('、')[0].trim());
  return '';
}

/**
 * Character-by-character fallback — uses kanjiDB for individual kanji.
 * Used when neither JMdict nor kuromoji can provide a reading.
 */
function buildHtmlFallback(text, fontSize, rtColor) {
  return Array.from(text).map(char => {
    if (KANJI_RE.test(char)) {
      const entry   = lookupKanji(char);
      const reading = pickReading(entry);
      if (reading) return rubyTag(char, reading, fontSize, rtColor);
    }
    return esc(char);
  }).join('');
}

// ── JMdict + kuromoji word-level HTML ─────────────────────────────────────────

/**
 * Build ruby HTML using kuromoji tokens with JMdict readings injected first.
 *
 * For each token:
 *   1. Try JMdict word lookup (highest priority — handles compounds correctly)
 *   2. Use kuromoji's tok.reading (good for inflected forms)
 *   3. Fall back character-by-character
 */
function buildHtmlKuromoji(text, fontSize, rtColor) {
  const tokens = tokenize(text);
  if (!tokens) return buildHtmlWithJMdict(text, fontSize, rtColor);

  return tokens.map(tok => {
    const surface = tok.surface_form || '';
    if (!HAS_KANJI_RE.test(surface)) {
      // No kanji — kana/punctuation/Latin, output as-is
      return esc(surface);
    }

    // ── 1. Kuromoji reading (highest priority for contextual accuracy) ────
    const rawReading = tok.reading;
    if (rawReading && rawReading !== surface) {
      const hiragana = katakanaToHiragana(rawReading);
      const trailingKana = getTrailingKana(surface);
      if (trailingKana && hiragana.endsWith(trailingKana) && hiragana.length > trailingKana.length) {
        const kanjiPart   = surface.slice(0, surface.length - trailingKana.length);
        const readingPart = hiragana.slice(0, hiragana.length - trailingKana.length);
        return rubyTag(kanjiPart, readingPart, fontSize, rtColor) + esc(trailingKana);
      }
      return rubyTag(surface, hiragana, fontSize, rtColor);
    }

    // ── 2. JMdict word lookup (fallback and dictionary matches) ───────────
    const jmdictReading = lookupWordReading(surface);
    if (jmdictReading) {
      const trailingKana = getTrailingKana(surface);
      if (trailingKana && jmdictReading.endsWith(trailingKana) && jmdictReading.length > trailingKana.length) {
        // Split okurigana: 行って → <ruby>行<rt>い</rt></ruby>って
        const kanjiPart   = surface.slice(0, surface.length - trailingKana.length);
        const readingPart = jmdictReading.slice(0, jmdictReading.length - trailingKana.length);
        return rubyTag(kanjiPart, readingPart, fontSize, rtColor) + esc(trailingKana);
      }
      // Whole compound in ruby: 行列, 東京, 天気, ...
      return rubyTag(surface, jmdictReading, fontSize, rtColor);
    }

    // ── 3. Character-by-character fallback ────────────────────────────────
    return buildHtmlFallback(surface, fontSize, rtColor);
  }).join('');
}

/**
 * JMdict-only path (used when kuromoji isn't ready yet).
 *
 * Greedily scans input for the longest matching word in wordDB, so that
 * compound words are captured before falling back to char-by-char.
 *
 * Example: "行列を作る" → 行列(ぎょうれつ) + を + 作(つく) + る
 */
function buildHtmlWithJMdict(text, fontSize, rtColor) {
  const MAX_WORD_LEN = 8; // max word length to try
  let i = 0;
  let html = '';

  while (i < text.length) {
    // Try longest match first (greedy)
    let matched = false;
    const maxLen = Math.min(MAX_WORD_LEN, text.length - i);

    for (let len = maxLen; len >= 2; len--) {
      const sub = text.slice(i, i + len);
      if (!HAS_KANJI_RE.test(sub)) continue;
      const reading = lookupWordReading(sub);
      if (reading) {
        html += rubyTag(sub, reading, fontSize, rtColor);
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Single character — use kanjiDB or output as-is
      const char = text[i];
      if (KANJI_RE.test(char)) {
        const entry   = lookupKanji(char);
        const reading = pickReading(entry);
        if (reading) {
          html += rubyTag(char, reading, fontSize, rtColor);
        } else {
          html += esc(char);
        }
      } else {
        html += esc(char);
      }
      i++;
    }
  }

  return html;
}

// ── component ────────────────────────────────────────────────────────────────

/**
 * Props:
 *   text     — Japanese string to annotate
 *   fontSize — base font size (default 22)
 *   color    — text color
 *   rtColor  — furigana color (default #C94B4B)
 *   style    — extra style on wrapper
 */
export default function FuriganaText({
  text,
  fontSize = 22,
  color = '#000',
  rtColor = '#C94B4B',
  style,
}) {
  // Track whether kuromoji is ready for an additional upgrade pass
  const [kuroReady, setKuroReady] = useState(
    getKuromojiStatus() === KUROMOJI_STATUS.READY
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (Platform.OS !== 'web') return;

    // Trigger kuromoji load in background — it'll upgrade readings when done
    loadKuromoji().then(() => {
      if (mounted.current) setKuroReady(true);
    }).catch(() => {});

    return () => { mounted.current = false; };
  }, []);

  if (!text) return null;

  if (Platform.OS === 'web') {
    // JMdict is always available (bundled). Use kuromoji on top if ready.
    // kuroReady: uses kuromoji tokenization + JMdict readings (best)
    // !kuroReady: uses JMdict greedy word scan (very good, instant)
    const html = kuroReady
      ? buildHtmlKuromoji(text, fontSize, rtColor)
      : buildHtmlWithJMdict(text, fontSize, rtColor);

    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          fontSize,
          lineHeight: 2.8,
          color,
          fontFamily: 'inherit',
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          ...style,
        }}
      />
    );
  }

  // Native: plain text fallback
  return (
    <Text style={[{ fontSize, color, lineHeight: fontSize * 1.6 }, style]}>
      {text}
    </Text>
  );
}
