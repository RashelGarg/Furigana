#!/usr/bin/env node
/**
 * compactWordDB.js
 * Creates a compact wordDB with only:
 * - Words with 2+ kanji characters (compounds — these are the ones that get misread)
 * - Common single-kanji words with irregular readings (今日、今年、etc.)
 * 
 * Single-kanji words don't need the wordDB (kanjiDB already handles them).
 * What we NEED is compound readings. This reduces size dramatically.
 */
const fs   = require('fs');
const path = require('path');

// Load the full DB from cache (the parsed XML)
const CACHE_PATH = path.resolve(__dirname, '../.jmdict_cache.json');
const OUT_PATH   = path.resolve(__dirname, '../src/data/wordDB.json');

const KANJI_RE   = /[\u4E00-\u9FAF\u3400-\u4DBF]/g;

function countKanji(word) {
  return (word.match(KANJI_RE) || []).length;
}

function katakanaToHiragana(str) {
  return (str || '').replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

// Irregular single-kanji readings that differ from the dictionary reading
// These are essential for correct furigana
const IRREGULAR_SINGLE = new Set([
  '今日', '明日', '昨日', '今年', '来年', '去年', '今月', '来月',
  '今週', '来週', '先週', '今朝', '今夜', '今晩', '大人', '一人',
  '二人', '三人', '一日', '二日', '三日', '四日', '五日', '六日',
  '七日', '八日', '九日', '十日', '二十日', '一月', '二月', '三月',
  '翌日', '毎日', '毎年', '毎月', '毎週', '毎朝', '毎晩',
  '友達', '子供', '言葉', '気持ち', '気分', '場合', '場所',
]);

console.log('Loading cached JMdict entries...');
const entries = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
console.log(`  ${entries.length} entries loaded`);

const wordDB     = {};
const wordDetails = {};
let kept = 0;

// Priority tags that indicate common words
const PRIORITY_TAGS_RE = /ichi1|ichi2|news1|news2|spec1|spec2/;

for (const entry of entries) {
  if (!entry.kanji || entry.kanji.length === 0) continue;
  
  const reading  = entry.reading; // already hiragana
  const meanings = entry.meanings || [];
  const isCommon = entry.common;
  
  for (const kanjiWord of entry.kanji) {
    if (!kanjiWord) continue;
    
    const kanjiCount = countKanji(kanjiWord);
    if (kanjiCount === 0) continue; // no kanji at all
    
    // Include if:
    // 1. Has 2+ kanji characters (compound — most important for furigana)
    // 2. Is an irregular single-kanji reading
    // 3. Is a common word (regardless of length)
    const include = kanjiCount >= 2 || IRREGULAR_SINGLE.has(kanjiWord) || isCommon;
    
    if (include && !wordDB[kanjiWord]) {
      wordDB[kanjiWord]     = reading;
      wordDetails[kanjiWord] = {
        r: reading,
        m: meanings.slice(0, 3),
        c: isCommon || false,
      };
      kept++;
    }
  }
}

console.log(`Kept ${kept} entries (compounds + irregulars + common)`);

const output = {
  wordDB,
  wordDetails,
  generated: new Date().toISOString(),
  source: 'JMdict/EDICT (EDRDG) — same database as Shirabe Jisho',
  count: kept,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output), 'utf8');
const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
console.log(`✅ Compact wordDB written: ${sizeKB} KB`);

// Test
const tests = ['行列','今日','東京','天気','勉強','東京大学','行動','銀行','今朝','大人'];
console.log('\nKey lookups:');
for (const w of tests) {
  console.log(`  ${w} → ${wordDB[w] || '(not found)'}`);
}
