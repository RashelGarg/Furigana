import React from 'react';
import { View, Text, Platform } from 'react-native';
import { lookupKanji } from '../utils/kanjiUtils';

const KANJI_RE = /[\u4E00-\u9FAF\u3400-\u4DBF]/;

/**
 * Returns the best single hiragana reading for a kanji entry.
 * Kunyomi is preferred (more natural for sentence reading).
 * Strips okurigana suffix after "." and alternate readings after "、".
 */
function katakanaToHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function pickReading(entry) {
  if (!entry) return '';
  // Try each kunyomi in order, preferring clean standalone forms
  for (const kun of (entry.kunyomi || [])) {
    const clean = kun.split('.')[0].split('-')[0].split('、')[0].trim();
    // Skip connective forms ending in つ (e.g. あまつ from 天) — these are compound-only
    if (clean && !clean.endsWith('つ')) return clean;
  }
  // Fallback: first kunyomi stripped, or on'yomi converted to hiragana
  const firstKun = entry.kunyomi?.[0];
  if (firstKun) return firstKun.split('.')[0].split('-')[0].split('、')[0].trim();
  const on = entry.onyomi?.[0];
  if (on) return katakanaToHiragana(on.split('、')[0].trim());
  return '';
}

/**
 * Renders Japanese text with furigana (hiragana) above each kanji character.
 *
 * Web:  uses native HTML <ruby>/<rt> tags via dangerouslySetInnerHTML.
 * iOS/Android: falls back to plain text (ruby not supported natively).
 *
 * Props:
 *   text        - the Japanese string to display
 *   fontSize    - base font size (default 22)
 *   color       - text color
 *   rtColor     - furigana color (default #C94B4B)
 *   style       - extra style applied to wrapper
 */
export default function FuriganaText({
  text,
  fontSize = 22,
  color = '#000',
  rtColor = '#C94B4B',
  style,
}) {
  if (!text) return null;

  if (Platform.OS === 'web') {
    // Build HTML string: kanji get <ruby>漢字<rt>よみ</rt></ruby>, rest are plain text nodes
    const html = Array.from(text).map(char => {
      if (KANJI_RE.test(char)) {
        const entry = lookupKanji(char);
        const reading = pickReading(entry);
        if (reading) {
          // Escape HTML entities just in case
          return `<ruby style="ruby-align:center">${char}<rt style="font-size:${Math.round(fontSize * 0.5)}px;color:${rtColor};font-family:inherit">${reading}</rt></ruby>`;
        }
      }
      // Escape < > & to prevent XSS
      return char.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }).join('');

    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          fontSize,
          lineHeight: 2.8,       // tall enough to show rt above characters
          color,
          fontFamily: 'inherit',
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          ...style,
        }}
      />
    );
  }

  // Native fallback: plain text (ruby not supported)
  return (
    <Text style={[{ fontSize, color, lineHeight: fontSize * 1.6 }, style]}>
      {text}
    </Text>
  );
}
