#!/usr/bin/env node
/**
 * CSV Data Processing Script
 * Consolidates all kanji CSV files into a unified JSON database
 */

const fs = require('fs');
const path = require('path');

const CSV_DIR = path.join(__dirname, '../../');
const OUTPUT_DIR = path.join(__dirname, '../src/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'kanjiDB.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Parse a CSV line with quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV file into array of [kanji, readings, meanings]
 */
function parseCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(line => parseCSVLine(line)).filter(row => row.length >= 3 && row[0]);
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e.message}`);
    return [];
  }
}

/**
 * Split readings into on'yomi (katakana) and kun'yomi (hiragana)
 */
function splitReadings(readingsStr) {
  const parts = readingsStr.split(',').map(r => r.trim()).filter(Boolean);
  const onyomi = [];
  const kunyomi = [];

  for (const r of parts) {
    // Katakana range: \u30A0-\u30FF
    const isKatakana = /[\u30A0-\u30FF]/.test(r);
    if (isKatakana) {
      onyomi.push(r);
    } else {
      kunyomi.push(r);
    }
  }
  return { onyomi, kunyomi };
}

/**
 * Parse meanings string into array
 */
function parseMeanings(meaningsStr) {
  return meaningsStr.split(',').map(m => m.trim()).filter(Boolean);
}

// ============================================================
// Main processing
// ============================================================

const kanjiDB = {}; // keyed by kanji character

// --- Step 1: Process JLPT level files ---
const jlptFiles = [
  { file: 'N5.csv', level: 'N5' },
  { file: 'N4.csv', level: 'N4' },
  { file: 'N3.csv', level: 'N3' },
  { file: 'N2.csv', level: 'N2' },
  { file: 'N1.csv', level: 'N1' },
];

for (const { file, level } of jlptFiles) {
  const rows = parseCSV(path.join(CSV_DIR, file));
  for (const [kanji, readings, meanings] of rows) {
    if (!kanjiDB[kanji]) {
      kanjiDB[kanji] = { kanji, jlptLevel: level, jouyou: false, jinmeiyou: false, frequency: null };
    } else {
      // Lower JLPT wins (N5 > N4 > ...)
      const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
      if (levels.indexOf(level) < levels.indexOf(kanjiDB[kanji].jlptLevel)) {
        kanjiDB[kanji].jlptLevel = level;
      }
    }
    const { onyomi, kunyomi } = splitReadings(readings);
    if (!kanjiDB[kanji].onyomi) kanjiDB[kanji].onyomi = onyomi;
    if (!kanjiDB[kanji].kunyomi) kanjiDB[kanji].kunyomi = kunyomi;
    if (!kanjiDB[kanji].meanings) kanjiDB[kanji].meanings = parseMeanings(meanings);
  }
  console.log(`✓ Processed ${file}: ${rows.length} kanji`);
}

// --- Step 2: Process Jouyou kanji ---
const jouyouRows = parseCSV(path.join(CSV_DIR, 'Jouyou kanji.csv'));
for (const [kanji, readings, meanings] of jouyouRows) {
  if (!kanjiDB[kanji]) {
    kanjiDB[kanji] = { kanji, jlptLevel: null, jouyou: true, jinmeiyou: false, frequency: null };
  }
  kanjiDB[kanji].jouyou = true;
  if (!kanjiDB[kanji].onyomi) {
    const { onyomi, kunyomi } = splitReadings(readings);
    kanjiDB[kanji].onyomi = onyomi;
    kanjiDB[kanji].kunyomi = kunyomi;
  }
  if (!kanjiDB[kanji].meanings) {
    kanjiDB[kanji].meanings = parseMeanings(meanings);
  }
}
console.log(`✓ Processed Jouyou kanji.csv: ${jouyouRows.length} kanji`);

// --- Step 3: Process Jinmeiyou kanji ---
const jinmeiyouRows = parseCSV(path.join(CSV_DIR, 'Jinmeiyou.csv'));
for (const [kanji, readings, meanings] of jinmeiyouRows) {
  if (!kanjiDB[kanji]) {
    kanjiDB[kanji] = { kanji, jlptLevel: null, jouyou: false, jinmeiyou: true, frequency: null };
  }
  kanjiDB[kanji].jinmeiyou = true;
  if (!kanjiDB[kanji].onyomi) {
    const { onyomi, kunyomi } = splitReadings(readings);
    kanjiDB[kanji].onyomi = onyomi;
    kanjiDB[kanji].kunyomi = kunyomi;
  }
  if (!kanjiDB[kanji].meanings) {
    kanjiDB[kanji].meanings = parseMeanings(meanings);
  }
}
console.log(`✓ Processed Jinmeiyou.csv: ${jinmeiyouRows.length} kanji`);

// --- Step 4: Process frequency-ordered files ---
const freqFiles = [
  '1 - 250.csv',
  '251 - 500.csv',
  '501 - 750.csv',
  '751 - 1000.csv',
  '1001 - 1250.csv',
  '1251 - 1500.csv',
  '1501 - 1750.csv',
  '1751 - 2000.csv',
  '2001 - 2250.csv',
  '2251 - 2501.csv',
];

let freqRank = 1;
for (const file of freqFiles) {
  const rows = parseCSV(path.join(CSV_DIR, file));
  for (const [kanji, readings, meanings] of rows) {
    if (!kanjiDB[kanji]) {
      kanjiDB[kanji] = { kanji, jlptLevel: null, jouyou: false, jinmeiyou: false, frequency: freqRank };
    }
    if (kanjiDB[kanji].frequency === null) {
      kanjiDB[kanji].frequency = freqRank;
    }
    if (!kanjiDB[kanji].onyomi) {
      const { onyomi, kunyomi } = splitReadings(readings);
      kanjiDB[kanji].onyomi = onyomi;
      kanjiDB[kanji].kunyomi = kunyomi;
    }
    if (!kanjiDB[kanji].meanings) {
      kanjiDB[kanji].meanings = parseMeanings(meanings);
    }
    freqRank++;
  }
  console.log(`✓ Processed ${file}: ${rows.length} kanji`);
}

// --- Step 5: Process radical files (add radical info) ---
const allFiles = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
const knownFiles = new Set([
  ...jlptFiles.map(j => j.file),
  'Jouyou kanji.csv',
  'Jinmeiyou.csv',
  ...freqFiles,
]);

let radicalCount = 0;
for (const file of allFiles) {
  if (knownFiles.has(file)) continue;
  // This is a radical file - the filename contains the radical
  const radicalName = file.replace('.csv', '');
  const rows = parseCSV(path.join(CSV_DIR, file));
  for (const [kanji, readings, meanings] of rows) {
    if (!kanjiDB[kanji]) {
      kanjiDB[kanji] = { kanji, jlptLevel: null, jouyou: false, jinmeiyou: false, frequency: null };
    }
    if (!kanjiDB[kanji].radical) {
      kanjiDB[kanji].radical = radicalName;
    }
    if (!kanjiDB[kanji].onyomi) {
      const { onyomi, kunyomi } = splitReadings(readings);
      kanjiDB[kanji].onyomi = onyomi;
      kanjiDB[kanji].kunyomi = kunyomi;
    }
    if (!kanjiDB[kanji].meanings) {
      kanjiDB[kanji].meanings = parseMeanings(meanings);
    }
    radicalCount++;
  }
}
console.log(`✓ Processed radical files: ${radicalCount} entries`);

// --- Step 6: Normalize and finalize ---
const finalDB = {};
let total = 0;
for (const [k, entry] of Object.entries(kanjiDB)) {
  // Ensure all fields exist
  finalDB[k] = {
    kanji: entry.kanji || k,
    onyomi: entry.onyomi || [],
    kunyomi: entry.kunyomi || [],
    meanings: entry.meanings || [],
    jlptLevel: entry.jlptLevel || null,
    jouyou: entry.jouyou || false,
    jinmeiyou: entry.jinmeiyou || false,
    frequency: entry.frequency || null,
    radical: entry.radical || null,
    // Unicode codepoint for KanjiVG stroke order lookup
    unicode: k.codePointAt(0).toString(16).padStart(5, '0'),
  };
  total++;
}

// --- Step 7: Also build search indexes ---
const searchIndex = {
  byMeaning: {},      // english word -> [kanji list]
  byOnyomi: {},       // onyomi reading -> [kanji list]
  byKunyomi: {},      // kunyomi reading -> [kanji list]
};

for (const [k, entry] of Object.entries(finalDB)) {
  // Index by meaning words
  for (const meaning of entry.meanings) {
    const words = meaning.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 2) {
        if (!searchIndex.byMeaning[word]) searchIndex.byMeaning[word] = [];
        if (!searchIndex.byMeaning[word].includes(k)) {
          searchIndex.byMeaning[word].push(k);
        }
      }
    }
  }
  // Index by onyomi
  for (const r of entry.onyomi) {
    const key = r.toLowerCase();
    if (!searchIndex.byOnyomi[key]) searchIndex.byOnyomi[key] = [];
    searchIndex.byOnyomi[key].push(k);
  }
  // Index by kunyomi
  for (const r of entry.kunyomi) {
    const key = r.replace(/[.-]/g, '').toLowerCase();
    if (!searchIndex.byKunyomi[key]) searchIndex.byKunyomi[key] = [];
    searchIndex.byKunyomi[key].push(k);
  }
}

// --- Write output ---
const output = {
  version: 1,
  generated: new Date().toISOString(),
  totalKanji: total,
  kanji: finalDB,
  searchIndex,
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
const size = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
console.log(`\n✅ Done! Database written to ${OUTPUT_FILE}`);
console.log(`   Total kanji: ${total}`);
console.log(`   File size: ${size} MB`);
console.log(`   JLPT breakdown:`);
const jlptCounts = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0, null: 0 };
for (const entry of Object.values(finalDB)) {
  jlptCounts[entry.jlptLevel || 'null']++;
}
for (const [level, count] of Object.entries(jlptCounts)) {
  if (level !== 'null') console.log(`     ${level}: ${count} kanji`);
}
console.log(`     No JLPT level: ${jlptCounts['null']}`);
