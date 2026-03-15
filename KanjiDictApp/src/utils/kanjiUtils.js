import kanjiDBRaw from '../data/kanjiDB.json';

const DB = kanjiDBRaw;

/**
 * Look up a single kanji character
 */
export function lookupKanji(char) {
  return DB.kanji[char] || null;
}

/**
 * Search kanji by query string (kanji char, reading, or meaning)
 */
export function searchKanji(query, limit = 50) {
  if (!query || query.trim() === '') return [];
  const q = query.trim();
  const results = new Map(); // kanji -> score

  const addResult = (kanji, score) => {
    const existing = results.get(kanji) || 0;
    results.set(kanji, Math.max(existing, score));
  };

  // Direct kanji character match
  if (DB.kanji[q]) {
    addResult(q, 100);
  }

  // Search character by character if multi-char input
  for (const char of q) {
    if (DB.kanji[char] && char !== q) {
      addResult(char, 80);
    }
  }

  const qLower = q.toLowerCase();

  // Search by meaning
  for (const [word, kanjiList] of Object.entries(DB.searchIndex.byMeaning)) {
    if (word.startsWith(qLower)) {
      for (const k of kanjiList) addResult(k, 60);
    } else if (word.includes(qLower)) {
      for (const k of kanjiList) addResult(k, 40);
    }
  }

  // Search by onyomi
  const qUpper = q.toUpperCase();
  for (const [reading, kanjiList] of Object.entries(DB.searchIndex.byOnyomi)) {
    if (reading.toUpperCase().startsWith(qUpper)) {
      for (const k of kanjiList) addResult(k, 70);
    }
  }

  // Search by kunyomi
  for (const [reading, kanjiList] of Object.entries(DB.searchIndex.byKunyomi)) {
    if (reading.startsWith(q.replace(/[.-]/g, ''))) {
      for (const k of kanjiList) addResult(k, 70);
    }
  }

  // Sort by score, then by frequency
  return Array.from(results.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const freqA = DB.kanji[a[0]]?.frequency ?? 9999;
      const freqB = DB.kanji[b[0]]?.frequency ?? 9999;
      return freqA - freqB;
    })
    .slice(0, limit)
    .map(([k]) => DB.kanji[k]);
}

/**
 * Get kanji filtered by JLPT level
 */
export function getKanjiByJLPT(level, limit = 100) {
  return Object.values(DB.kanji)
    .filter(k => k.jlptLevel === level)
    .sort((a, b) => (a.frequency ?? 9999) - (b.frequency ?? 9999))
    .slice(0, limit);
}

/**
 * Get total stats
 */
export function getStats() {
  return {
    total: DB.totalKanji,
    generated: DB.generated,
  };
}

/**
 * Extract kanji characters from text
 */
export function extractKanji(text) {
  const kanjiRegex = /[\u4E00-\u9FAF\u3400-\u4DBF]/g;
  const matches = [...new Set(text.match(kanjiRegex) || [])];
  return matches.filter(k => DB.kanji[k]);
}

/**
 * Get reading string for display
 */
export function formatReadings(entry) {
  if (!entry) return '';
  const on = entry.onyomi?.join('、') || '';
  const kun = entry.kunyomi?.join('、') || '';
  const parts = [];
  if (on) parts.push(`音: ${on}`);
  if (kun) parts.push(`訓: ${kun}`);
  return parts.join('  ');
}

/**
 * Convert romaji to approximate hiragana (basic)
 */
export function romajiToHiragana(romaji) {
  const map = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
    ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    wa: 'わ', wi: 'ゐ', we: 'ゑ', wo: 'を',
    n: 'ん',
  };
  return map[romaji.toLowerCase()] || romaji;
}

/**
 * Get KanjiVG URL for stroke order SVG
 */
export function getKanjiVGUrl(kanjiEntry) {
  if (!kanjiEntry?.unicode) return null;
  return `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${kanjiEntry.unicode}.svg`;
}

/**
 * Get all kanji sorted by frequency
 */
export function getFrequentKanji(limit = 100) {
  return Object.values(DB.kanji)
    .filter(k => k.frequency !== null)
    .sort((a, b) => (a.frequency ?? 9999) - (b.frequency ?? 9999))
    .slice(0, limit);
}
