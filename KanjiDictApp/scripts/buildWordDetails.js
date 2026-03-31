#!/usr/bin/env node
/**
 * buildWordDetails.js — builds wordDetails.json for the word search feature
 * Only includes common words (JMdict priority tagged) with meanings
 */
const fs   = require('fs');
const path = require('path');

const CACHE_PATH = path.resolve(__dirname, '../.jmdict_cache.json');
const OUT_PATH   = path.resolve(__dirname, '../src/data/wordDetails.json');
const KANJI_RE   = /[\u4E00-\u9FAF\u3400-\u4DBF]/;

const entries = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
console.log(`Loaded ${entries.length} entries from cache`);

const details = {};
let count = 0;

for (const e of entries) {
  if (!e.kanji || !e.common || !e.meanings || e.meanings.length === 0) continue;
  for (const w of e.kanji) {
    if (!w || !KANJI_RE.test(w)) continue;
    if (w.length > 8) continue;
    if (!details[w]) {
      details[w] = { r: e.reading, m: e.meanings.slice(0, 3) };
      count++;
    }
  }
}

console.log(`Common word details: ${count} entries`);

const output = {
  words: details,
  generated: new Date().toISOString(),
  source: 'JMdict/EDICT (EDRDG)',
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output));
const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
console.log(`Written: ${sizeKB} KB`);

// Test lookups
const tests = ['行列', '今日', '東京', '天気', '勉強', '銀行', '仕事'];
console.log('\nSample:');
for (const w of tests) {
  const d = details[w];
  console.log(`  ${w} → ${d ? d.r + '  ' + d.m[0] : '(not found)'}`);
}
