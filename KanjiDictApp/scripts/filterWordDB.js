#!/usr/bin/env node
/**
 * filterWordDB.js
 * Takes the full wordDB.json and filters to:
 * 1. Common words (marked common:true from JMdict priority tags)
 * 2. Words 2 chars or longer with kanji
 * 3. Keeps all jouyou/JLPT-relevant words
 * Target: <3MB output
 */
const fs   = require('fs');
const path = require('path');

const FULL_PATH = path.resolve(__dirname, '../src/data/wordDB.json');
const OUT_PATH  = path.resolve(__dirname, '../src/data/wordDB.json'); // overwrite

const raw = JSON.parse(fs.readFileSync(FULL_PATH, 'utf8'));
const { wordDB, wordDetails } = raw;

// Read kanjiDB to know which kanji are jouyou/JLPT
let kanjiDB = {};
try {
  const kdb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/kanjiDB.json'), 'utf8'));
  kanjiDB = kdb.kanji || {};
} catch(e) { console.warn('Could not load kanjiDB:', e.message); }

const KANJI_RE = /[\u4E00-\u9FAF\u3400-\u4DBF]/;

const filteredWordDB  = {};
const filteredDetails = {};

let kept = 0;
let total = Object.keys(wordDB).length;

for (const [word, reading] of Object.entries(wordDB)) {
  const detail = wordDetails[word] || {};
  
  // Always keep:
  // 1. Common words (from JMdict ichi1/news1/spec1 priority tags)
  // 2. Words where at least one kanji is in our kanjiDB (jouyou/JLPT)
  // 3. Specific important irregular readings
  
  const isCommon = detail.c === true;
  const hasKnownKanji = Array.from(word).some(ch => kanjiDB[ch]);
  
  if (isCommon || hasKnownKanji) {
    filteredWordDB[word]  = reading;
    filteredDetails[word] = detail;
    kept++;
  }
}

console.log(`Filtered: ${kept} / ${total} words kept`);

const output = {
  wordDB: filteredWordDB,
  wordDetails: filteredDetails,
  generated: new Date().toISOString(),
  source: 'JMdict/EDICT (EDRDG) — same as Shirabe Jisho',
  count: kept,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output), 'utf8');
const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
console.log(`✅ Filtered wordDB written (${sizeKB} KB)`);

// Verify key lookups still work
const tests = ['行列','今日','東京','天気','勉強','東京大学','行動','銀行'];
console.log('\nKey lookups:');
for (const w of tests) {
  console.log(`  ${w} → ${filteredWordDB[w] || '(not found)'}`);
}
