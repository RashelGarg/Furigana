/**
 * WordLookupService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Word-level dictionary lookup backed by JMdict (EDICT) data —
 * the same database used by Shirabe Jisho.
 *
 * Primary use: resolve compound kanji readings correctly.
 *   行列 → ぎょうれつ  (NOT こう + れつ)
 *   今日 → きょう      (NOT いま + ひ)
 *
 * wordDB.json   — 190k words, reading only   (~6 MB bundled)
 * wordDetails.json — 36k common words + meanings (lazy-loaded for word search)
 */

import wordDBData from '../data/wordDB.json';

const { wordDB } = wordDBData;

// Lazy-loaded details (only when word search tab is opened)
let _details = null;
let _detailsPromise = null;

/**
 * Look up the hiragana reading for a (possibly compound) Japanese word.
 * Returns the reading string, or null if not found.
 *
 * @param {string} word  — Japanese string (may contain kanji + kana)
 * @returns {string|null}
 */
export function lookupWordReading(word) {
  if (!word) return null;
  return wordDB[word] || null;
}

/**
 * Check if a word exists in the word DB.
 */
export function hasWord(word) {
  return word in wordDB;
}

/**
 * Lazy-load wordDetails for the vocabulary search feature.
 * Returns a promise that resolves to the details map.
 */
export async function loadWordDetails() {
  if (_details) return _details;
  if (_detailsPromise) return _detailsPromise;

  _detailsPromise = import('../data/wordDetails.json').then(mod => {
    _details = mod.default?.words || mod.words || {};
    return _details;
  });

  return _detailsPromise;
}

/**
 * Search word details for a query string (for the Words tab).
 * Requires wordDetails to be loaded first via loadWordDetails().
 *
 * @param {string} query   — kanji, kana, or romaji
 * @param {object} details — the wordDetails map from loadWordDetails()
 * @param {number} limit   — max results
 * @returns {Array<{ word, reading, meanings, common }>}
 */
export function searchWords(query, details, limit = 40) {
  if (!query || !details) return [];
  const q = query.trim();
  if (!q) return [];

  const results = [];
  const seen = new Set();

  // 1. Exact kanji word match
  if (details[q]) {
    const d = details[q];
    results.push({ word: q, reading: d.r, meanings: d.m, common: d.c });
    seen.add(q);
  }

  // 2. Starts-with match on word key
  for (const [word, d] of Object.entries(details)) {
    if (seen.has(word)) continue;
    if (word.startsWith(q) || d.r?.startsWith(q)) {
      results.push({ word, reading: d.r, meanings: d.m, common: d.c });
      seen.add(word);
      if (results.length >= limit) break;
    }
  }

  // 3. Contains match
  if (results.length < limit) {
    for (const [word, d] of Object.entries(details)) {
      if (seen.has(word)) continue;
      if (
        word.includes(q) ||
        d.r?.includes(q) ||
        d.m?.some(m => m.toLowerCase().includes(q.toLowerCase()))
      ) {
        results.push({ word, reading: d.r, meanings: d.m, common: d.c });
        seen.add(word);
        if (results.length >= limit) break;
      }
    }
  }

  // Sort: common first, then shorter words
  results.sort((a, b) => {
    if (a.common !== b.common) return a.common ? -1 : 1;
    return a.word.length - b.word.length;
  });

  return results.slice(0, limit);
}
