#!/usr/bin/env node
/**
 * buildWordDB.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Downloads JMdict_e.json from jmdict-simplified GitHub release (pre-parsed
 * JSON from the EDICT/JMdict project — same dictionary used by Shirabe Jisho),
 * then compiles a compact word→reading map and a word detail map.
 *
 * Output → src/data/wordDB.json
 *
 * Run: node scripts/buildWordDB.js
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const zlib   = require('zlib');

// jmdict-simplified pre-parsed JSON (GitHub releases)
const JMDICT_URL =
  'https://github.com/scriptin/jmdict-simplified/releases/download/3.5.0%2B20240101120000/jmdict-eng-3.5.0+20240101120000.json.zip';
// Fallback: use the raw JMdict XML from Monash if above fails
const FALLBACK_URL = 'http://ftp.monash.edu/pub/nihongo/JMdict_e.gz';

const OUT_PATH   = path.resolve(__dirname, '../src/data/wordDB.json');
const CACHE_PATH = path.resolve(__dirname, '../.jmdict_cache.json');

// ─── priority tags that indicate common/important words ───────────────────────
const PRIORITY_TAGS = new Set(['ichi1', 'ichi2', 'news1', 'news2', 'spec1', 'spec2']);

function isCommon(entry) {
  const kePri = (entry.kanji || []).flatMap(k => k.tags || []);
  const rePri = (entry.kana || []).flatMap(k => k.tags || []);
  return [...kePri, ...rePri].some(t => PRIORITY_TAGS.has(t));
}

function katakanaToHiragana(str) {
  return (str || '').replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    console.log(`Fetching: ${url}`);
    mod.get(url, { headers: { 'User-Agent': 'buildWordDB/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Alternative: fetch from a simpler JSON endpoint ─────────────────────────
// We try fetching from a publicly hosted jmdict-simplified JSON file.
// This uses the "words" format from scriptin/jmdict-simplified.
const SIMPLE_URL = 'https://raw.githubusercontent.com/scriptin/jmdict-simplified/master/README.md';

// Actually let's use a direct CDN approach — the full pre-processed JSON
// from jmdict-simplified is too large to fetch via raw GitHub.
// Instead, we'll build from the JMdict XML using Node's built-in xml parser.

// ─── Use fetch from Node 18+ ──────────────────────────────────────────────────
async function downloadJMdict() {
  // Try a pre-processed compact JSON from a trusted CDN
  // Using jisho.org's open API as an alternative isn't feasible for bulk download.
  // Best option: use the jmdict-simplified JSON from GitHub releases (ZIP).

  // Since we can't easily unzip in Node without extra deps, let's use
  // the unzipped version hosted on GitHub raw (the "words" ndjson format).
  
  // Actually the cleanest approach with no extra deps:
  // Use Node's native fetch (Node 18+) to get individual jmdict-simplified entries
  
  // We'll use a pre-processed community JSON: 
  // https://raw.githubusercontent.com/FooSoft/jmdict-api/master/data/jmdict.json
  // This is too large for raw GitHub.
  
  // FINAL APPROACH: Download JMdict XML gzip, parse with Node's built-in sax-like parsing
  const url = 'https://raw.githubusercontent.com/scriptin/jmdict-simplified/master/jmdict_english.json';
  
  // This file may not exist. Let's try a known working approach:
  // Use the jmdict-simplified API
  throw new Error('USE_ALTERNATIVE');
}

// ─── Main build function using a curated word list ───────────────────────────
// Since we can't reliably download and parse JMdict at build time without
// extra dependencies, we use a curated approach:
// 1. Fetch from the jmdict-simplified GitHub release (JSON format, no zip needed)
// 2. Process and write wordDB.json

async function buildFromJmdictSimplified() {
  // jmdict-simplified provides individual word files via their API
  // The "words" endpoint returns entries in NDJSON format
  
  // Let's use a pre-processed list from the open-source jmdictdb project
  // URL from Monash edu — the authoritative JMdict source
  
  const JMDICT_JSON_URL = 'https://raw.githubusercontent.com/scriptin/jmdict-simplified/master/README.md';
  
  // Since getting the full JMdict requires either:
  // a) A zip file we can't easily unzip without 'adm-zip'
  // b) A very large XML we'd need to parse
  // 
  // Let's use a smart fallback: fetch from the jisho-data project
  // which hosts a pre-processed compact JSON of common JMdict entries.
  
  throw new Error('NEED_ALTERNATIVE');
}

// ─── FINAL STRATEGY: Use fetch API to get pre-processed data ─────────────────

async function main() {
  console.log('Building wordDB.json from JMdict data...\n');

  // Check if we have a cached version
  if (fs.existsSync(CACHE_PATH)) {
    console.log('Found cached JMdict data, using it...');
    const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    await processEntries(cached);
    return;
  }

  // Try fetching from jmdict-simplified GitHub releases
  // The latest release hosts a JSON file (not zipped) for words
  // URL pattern: https://github.com/scriptin/jmdict-simplified/releases/latest
  
  // We'll use the Jotoba API (open Japanese dictionary API based on JMdict)
  // to build our word list, or use a pre-seeded approach.

  // PRACTICAL SOLUTION: Use the freely available jmdict JSON from 
  // the jmdict npm package data files that are already downloaded
  
  const jmdict_paths = [
    // If user has any jmdict-related packages in node_modules
    path.resolve(__dirname, '../node_modules/jmdict/data/JMdict_e'),
  ];
  
  // Since we can't guarantee external downloads, let's fetch from
  // a reliable JSON API endpoint
  
  try {
    await fetchAndProcess();
  } catch (e) {
    console.error('Failed to fetch JMdict:', e.message);
    console.log('\nFalling back to generating from Shirabe Jisho data format...');
    await generateCuratedWordDB();
  }
}

async function fetchAndProcess() {
  // Use the jmdict-simplified project's pre-built JSON
  // Available as: https://github.com/scriptin/jmdict-simplified/releases
  // The "words" file (not kana-vocab) in JSON format
  
  // Alternative reliable source: Electronic Dictionary Research Group data
  // We can get a pre-processed version from a CDN
  
  const url = 'https://raw.githubusercontent.com/mifunetoshiro/kanjium/master/data/source_files/raw/lkjc.json';
  
  // Actually let's just use the approach that works: 
  // Download the JMdict using the undici/fetch API and parse NDJSON
  
  // The most reliable free source with no auth:
  // https://jmdict-api.p.rapidapi.com/ — requires auth
  // https://api.jotoba.de/ — requires specific queries
  
  // Use Goo dictionary JSON? No.
  
  // BEST APPROACH: Use a pre-processed community dataset
  // The "english-words" from the kanjidic2/jmdict combination
  
  // Let's fetch the actual JMdict XML gz file from Monash
  await fetchAndParseMonash();
}

async function fetchAndParseMonash() {
  const url = 'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz';
  console.log(`Downloading JMdict_e.gz from EDRDG (this may take a moment)...`);
  
  return new Promise((resolve, reject) => {
    const mod = https;
    mod.get(url, { headers: { 'User-Agent': 'buildWordDB/1.0 (educational app)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`Redirecting to: ${res.headers.location}`);
        // Handle redirect
        const redirectUrl = res.headers.location;
        const redirectMod = redirectUrl.startsWith('https') ? https : http;
        redirectMod.get(redirectUrl, { headers: { 'User-Agent': 'buildWordDB/1.0' } }, res2 => {
          processGzipResponse(res2, resolve, reject);
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      processGzipResponse(res, resolve, reject);
    }).on('error', reject);
  });
}

function processGzipResponse(res, resolve, reject) {
  const chunks = [];
  const gunzip = zlib.createGunzip();
  res.pipe(gunzip);
  gunzip.on('data', c => chunks.push(c));
  gunzip.on('end', () => {
    const xml = Buffer.concat(chunks).toString('utf8');
    console.log(`Downloaded JMdict XML (${(xml.length / 1e6).toFixed(1)} MB), parsing...`);
    // Cache raw XML
    fs.writeFileSync(CACHE_PATH.replace('.json', '.xml'), xml, 'utf8');
    const entries = parseJMdictXML(xml);
    console.log(`Parsed ${entries.length} entries`);
    // Cache parsed entries
    fs.writeFileSync(CACHE_PATH, JSON.stringify(entries), 'utf8');
    processEntries(entries).then(resolve).catch(reject);
  });
  gunzip.on('error', reject);
}

function parseJMdictXML(xml) {
  const entries = [];
  // Simple regex-based parser for JMdict XML structure
  // Each entry is wrapped in <entry>...</entry>
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const kebRegex = /<keb>(.*?)<\/keb>/g;
  const repRegex = /<re_pri>(.*?)<\/re_pri>/g;
  const kepRegex = /<ke_pri>(.*?)<\/ke_pri>/g;
  const rebRegex = /<reb>(.*?)<\/reb>/;
  const glossRegex = /<gloss[^>]*>(.*?)<\/gloss>/g;
  
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    
    // Extract kanji forms
    const kanjiMatches = [];
    let km;
    const kebEx = /<keb>(.*?)<\/keb>/g;
    while ((km = kebEx.exec(block)) !== null) { kanjiMatches.push(km[1]); }
    
    // Extract reading (first reb)
    const rebMatch = rebRegex.exec(block);
    if (!rebMatch) continue;
    const reading = katakanaToHiragana(rebMatch[1]);
    
    // Extract priority tags
    const priTags = [];
    let pt;
    const priEx = /(?:re_pri|ke_pri)>(.*?)<\/(?:re_pri|ke_pri)/g;
    while ((pt = priEx.exec(block)) !== null) { priTags.push(pt[1]); }
    const common = priTags.some(t => PRIORITY_TAGS.has(t));
    
    // Extract meanings
    const meanings = [];
    let gm;
    const glossEx = /<gloss[^>]*>(.*?)<\/gloss>/g;
    while ((gm = glossEx.exec(block)) !== null) { meanings.push(gm[1]); }
    
    entries.push({ kanji: kanjiMatches, reading, common, meanings: meanings.slice(0, 3) });
  }
  return entries;
}

async function processEntries(entries) {
  // wordDB: kanji string → hiragana reading (for FuriganaText lookup)
  // wordDetails: kanji string → { reading, meanings } (for word search)
  const wordDB = {};
  const wordDetails = {};
  let included = 0;
  let total = 0;

  for (const entry of entries) {
    if (!entry.kanji || entry.kanji.length === 0) continue;
    // Include common words, or any word with kanji
    total++;
    
    for (const kanjiWord of entry.kanji) {
      if (!kanjiWord || !/[\u4E00-\u9FAF\u3400-\u4DBF]/.test(kanjiWord)) continue;
      // Always include if it's a common word; also include all entries with kanji
      if (entry.common || true) {  // include all kanji-containing words
        if (!wordDB[kanjiWord]) {
          wordDB[kanjiWord] = entry.reading;
          wordDetails[kanjiWord] = {
            r: entry.reading,
            m: (entry.meanings || []).slice(0, 3),
            c: entry.common || false,
          };
          included++;
        }
      }
    }
  }

  console.log(`\nIncluded ${included} unique kanji words (from ${total} entries)`);
  
  const output = { wordDB, wordDetails, generated: new Date().toISOString() };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output), 'utf8');
  
  const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
  console.log(`\n✅ Written to ${OUT_PATH} (${sizeKB} KB)`);
  
  // Show some examples
  const testWords = ['行列', '今日', '東京', '天気', '勉強', '東京大学'];
  console.log('\nSample lookups:');
  for (const w of testWords) {
    console.log(`  ${w} → ${wordDB[w] || '(not found)'}`);
  }
}

// ─── Fallback: generate curated word DB if network fails ──────────────────────
async function generateCuratedWordDB() {
  console.log('Generating curated wordDB from built-in data...');
  
  const wordDB = {};
  const wordDetails = {};
  
  // Core common compound words that are frequently misread char-by-char
  const curated = [
    ['今日', 'きょう', 'today'],
    ['明日', 'あした', 'tomorrow'],
    ['昨日', 'きのう', 'yesterday'],
    ['今年', 'ことし', 'this year'],
    ['来年', 'らいねん', 'next year'],
    ['去年', 'きょねん', 'last year'],
    ['今月', 'こんげつ', 'this month'],
    ['来月', 'らいげつ', 'next month'],
    ['東京', 'とうきょう', 'Tokyo'],
    ['大阪', 'おおさか', 'Osaka'],
    ['日本', 'にほん', 'Japan'],
    ['日本語', 'にほんご', 'Japanese language'],
    ['日本人', 'にほんじん', 'Japanese person'],
    ['行列', 'ぎょうれつ', 'queue; matrix'],
    ['天気', 'てんき', 'weather'],
    ['電気', 'でんき', 'electricity'],
    ['電話', 'でんわ', 'telephone'],
    ['大学', 'だいがく', 'university'],
    ['小学校', 'しょうがっこう', 'elementary school'],
    ['中学校', 'ちゅうがっこう', 'middle school'],
    ['高校', 'こうこう', 'high school'],
    ['東京大学', 'とうきょうだいがく', 'University of Tokyo'],
    ['先生', 'せんせい', 'teacher'],
    ['学生', 'がくせい', 'student'],
    ['勉強', 'べんきょう', 'study'],
    ['仕事', 'しごと', 'work'],
    ['生活', 'せいかつ', 'life; living'],
    ['会社', 'かいしゃ', 'company'],
    ['社会', 'しゃかい', 'society'],
    ['世界', 'せかい', 'world'],
    ['問題', 'もんだい', 'problem'],
    ['場合', 'ばあい', 'case; situation'],
    ['時間', 'じかん', 'time'],
    ['場所', 'ばしょ', 'place'],
    ['方法', 'ほうほう', 'method'],
    ['内容', 'ないよう', 'content'],
    ['必要', 'ひつよう', 'necessary'],
    ['以上', 'いじょう', 'more than; above'],
    ['以下', 'いか', 'less than; below'],
    ['関係', 'かんけい', 'relationship'],
    ['意味', 'いみ', 'meaning'],
    ['理由', 'りゆう', 'reason'],
    ['気持ち', 'きもち', 'feeling'],
    ['言葉', 'ことば', 'word; language'],
    ['大切', 'たいせつ', 'important'],
    ['大丈夫', 'だいじょうぶ', 'alright'],
    ['大変', 'たいへん', 'very; tough'],
    ['少し', 'すこし', 'a little'],
    ['色々', 'いろいろ', 'various'],
    ['一緒', 'いっしょ', 'together'],
    ['友達', 'ともだち', 'friend'],
    ['家族', 'かぞく', 'family'],
    ['子供', 'こども', 'child'],
    ['男性', 'だんせい', 'male'],
    ['女性', 'じょせい', 'female'],
    ['人々', 'ひとびと', 'people'],
    ['場合', 'ばあい', 'case'],
    ['新聞', 'しんぶん', 'newspaper'],
    ['雑誌', 'ざっし', 'magazine'],
    ['映画', 'えいが', 'movie'],
    ['音楽', 'おんがく', 'music'],
    ['料理', 'りょうり', 'cooking'],
    ['旅行', 'りょこう', 'travel'],
    ['運動', 'うんどう', 'exercise'],
    ['病院', 'びょういん', 'hospital'],
    ['薬', 'くすり', 'medicine'],
    ['食事', 'しょくじ', 'meal'],
    ['飲み物', 'のみもの', 'drink'],
    ['食べ物', 'たべもの', 'food'],
    ['果物', 'くだもの', 'fruit'],
    ['野菜', 'やさい', 'vegetable'],
    ['魚', 'さかな', 'fish'],
    ['肉', 'にく', 'meat'],
    ['米', 'こめ', 'rice (uncooked)'],
    ['水', 'みず', 'water'],
    ['山', 'やま', 'mountain'],
    ['川', 'かわ', 'river'],
    ['海', 'うみ', 'sea'],
    ['空', 'そら', 'sky'],
    ['花', 'はな', 'flower'],
    ['木', 'き', 'tree'],
    ['雨', 'あめ', 'rain'],
    ['雪', 'ゆき', 'snow'],
    ['風', 'かぜ', 'wind'],
    ['道', 'みち', 'road'],
    ['駅', 'えき', 'station'],
    ['電車', 'でんしゃ', 'train'],
    ['自動車', 'じどうしゃ', 'car'],
    ['飛行機', 'ひこうき', 'airplane'],
    ['自転車', 'じてんしゃ', 'bicycle'],
    ['建物', 'たてもの', 'building'],
    ['部屋', 'へや', 'room'],
    ['台所', 'だいどころ', 'kitchen'],
    ['玄関', 'げんかん', 'entrance'],
    ['洗面所', 'せんめんじょ', 'bathroom'],
    ['書き方', 'かきかた', 'way of writing'],
    ['読み方', 'よみかた', 'way of reading'],
    ['話し方', 'はなしかた', 'way of speaking'],
    ['見方', 'みかた', 'way of looking'],
    ['考え方', 'かんがえかた', 'way of thinking'],
    ['生き方', 'いきかた', 'way of life'],
    ['入り口', 'いりぐち', 'entrance'],
    ['出口', 'でぐち', 'exit'],
    ['乗り物', 'のりもの', 'vehicle'],
    ['乗り換え', 'のりかえ', 'transfer'],
    ['待ち合わせ', 'まちあわせ', 'meeting place'],
    ['申し訳', 'もうしわけ', 'excuse'],
    ['気をつけて', 'きをつけて', 'take care'],
    ['よろしく', 'よろしく', 'yoroshiku'],
    ['有難う', 'ありがとう', 'thank you'],
    ['御願い', 'おねがい', 'please'],
    ['経済', 'けいざい', 'economy'],
    ['政治', 'せいじ', 'politics'],
    ['文化', 'ぶんか', 'culture'],
    ['歴史', 'れきし', 'history'],
    ['科学', 'かがく', 'science'],
    ['技術', 'ぎじゅつ', 'technology'],
    ['情報', 'じょうほう', 'information'],
    ['環境', 'かんきょう', 'environment'],
    ['教育', 'きょういく', 'education'],
    ['医療', 'いりょう', 'medical care'],
    ['福祉', 'ふくし', 'welfare'],
    ['安全', 'あんぜん', 'safety'],
    ['平和', 'へいわ', 'peace'],
    ['自由', 'じゆう', 'freedom'],
    ['権利', 'けんり', 'rights'],
    ['責任', 'せきにん', 'responsibility'],
    ['努力', 'どりょく', 'effort'],
    ['成功', 'せいこう', 'success'],
    ['失敗', 'しっぱい', 'failure'],
    ['危険', 'きけん', 'danger'],
    ['心配', 'しんぱい', 'worry'],
    ['残念', 'ざんねん', 'regret; unfortunate'],
    ['嬉しい', 'うれしい', 'happy'],
    ['悲しい', 'かなしい', 'sad'],
    ['楽しい', 'たのしい', 'fun'],
    ['難しい', 'むずかしい', 'difficult'],
    ['易しい', 'やさしい', 'easy'],
    ['美しい', 'うつくしい', 'beautiful'],
    ['優しい', 'やさしい', 'kind'],
    ['面白い', 'おもしろい', 'interesting'],
    ['可愛い', 'かわいい', 'cute'],
    ['格好いい', 'かっこいい', 'cool'],
    ['素晴らしい', 'すばらしい', 'wonderful'],
    ['有名', 'ゆうめい', 'famous'],
    ['特別', 'とくべつ', 'special'],
    ['普通', 'ふつう', 'ordinary'],
    ['自分', 'じぶん', 'oneself'],
    ['相手', 'あいて', 'partner; opponent'],
    ['他人', 'たにん', 'stranger; other person'],
    ['社長', 'しゃちょう', 'company president'],
    ['部長', 'ぶちょう', 'department head'],
    ['課長', 'かちょう', 'section chief'],
    ['同僚', 'どうりょう', 'colleague'],
    ['上司', 'じょうし', 'superior'],
    ['部下', 'ぶか', 'subordinate'],
    ['北海道', 'ほっかいどう', 'Hokkaido'],
    ['沖縄', 'おきなわ', 'Okinawa'],
    ['京都', 'きょうと', 'Kyoto'],
    ['神奈川', 'かながわ', 'Kanagawa'],
    ['横浜', 'よこはま', 'Yokohama'],
    ['名古屋', 'なごや', 'Nagoya'],
    ['福岡', 'ふくおか', 'Fukuoka'],
    ['広島', 'ひろしま', 'Hiroshima'],
    ['仙台', 'せんだい', 'Sendai'],
    ['札幌', 'さっぽろ', 'Sapporo'],
    ['行動', 'こうどう', 'action; behavior'],
    ['運動', 'うんどう', 'movement; exercise'],
    ['活動', 'かつどう', 'activity'],
    ['行為', 'こうい', 'act; deed'],
    ['行事', 'ぎょうじ', 'event'],
    ['銀行', 'ぎんこう', 'bank'],
    ['旅館', 'りょかん', 'inn'],
    ['図書館', 'としょかん', 'library'],
    ['美術館', 'びじゅつかん', 'art museum'],
    ['博物館', 'はくぶつかん', 'museum'],
    ['水族館', 'すいぞくかん', 'aquarium'],
    ['動物園', 'どうぶつえん', 'zoo'],
    ['遊園地', 'ゆうえんち', 'amusement park'],
    ['商店街', 'しょうてんがい', 'shopping street'],
    ['スーパー', 'すーぱー', 'supermarket'],
    ['コンビニ', 'こんびに', 'convenience store'],
    ['郵便局', 'ゆうびんきょく', 'post office'],
    ['警察署', 'けいさつしょ', 'police station'],
    ['消防署', 'しょうぼうしょ', 'fire station'],
    ['役所', 'やくしょ', 'government office'],
    ['市役所', 'しやくしょ', 'city hall'],
    ['空港', 'くうこう', 'airport'],
    ['港', 'みなと', 'harbor'],
    ['橋', 'はし', 'bridge'],
    ['信号', 'しんごう', 'traffic light'],
    ['交差点', 'こうさてん', 'intersection'],
    ['歩道', 'ほどう', 'sidewalk'],
    ['横断歩道', 'おうだんほどう', 'crosswalk'],
    ['地下鉄', 'ちかてつ', 'subway'],
    ['新幹線', 'しんかんせん', 'bullet train'],
    ['高速道路', 'こうそくどうろ', 'highway'],
    ['一方通行', 'いっぽうつうこう', 'one-way traffic'],
    ['駐車場', 'ちゅうしゃじょう', 'parking lot'],
    ['洗車', 'せんしゃ', 'car wash'],
    ['給油', 'きゅうゆ', 'refueling'],
    ['保険', 'ほけん', 'insurance'],
    ['契約', 'けいやく', 'contract'],
    ['手続き', 'てつづき', 'procedure'],
    ['申込', 'もうしこみ', 'application'],
    ['申請', 'しんせい', 'application; petition'],
    ['許可', 'きょか', 'permission'],
    ['禁止', 'きんし', 'prohibition'],
    ['注意', 'ちゅうい', 'caution; attention'],
    ['確認', 'かくにん', 'confirmation'],
    ['連絡', 'れんらく', 'contact; communication'],
    ['報告', 'ほうこく', 'report'],
    ['発表', 'はっぴょう', 'announcement'],
    ['会議', 'かいぎ', 'meeting'],
    ['打合せ', 'うちあわせ', 'meeting; briefing'],
    ['説明', 'せつめい', 'explanation'],
    ['質問', 'しつもん', 'question'],
    ['回答', 'かいとう', 'answer'],
    ['相談', 'そうだん', 'consultation'],
    ['依頼', 'いらい', 'request'],
    ['提案', 'ていあん', 'proposal'],
    ['計画', 'けいかく', 'plan'],
    ['目標', 'もくひょう', 'goal; target'],
    ['結果', 'けっか', 'result'],
    ['影響', 'えいきょう', 'influence'],
    ['原因', 'げんいん', 'cause'],
    ['解決', 'かいけつ', 'solution'],
    ['改善', 'かいぜん', 'improvement'],
    ['変化', 'へんか', 'change'],
    ['現在', 'げんざい', 'present; current'],
    ['過去', 'かこ', 'past'],
    ['未来', 'みらい', 'future'],
    ['最近', 'さいきん', 'recently'],
    ['以前', 'いぜん', 'before'],
    ['将来', 'しょうらい', 'future; prospects'],
    ['先週', 'せんしゅう', 'last week'],
    ['来週', 'らいしゅう', 'next week'],
    ['今週', 'こんしゅう', 'this week'],
    ['月曜日', 'げつようび', 'Monday'],
    ['火曜日', 'かようび', 'Tuesday'],
    ['水曜日', 'すいようび', 'Wednesday'],
    ['木曜日', 'もくようび', 'Thursday'],
    ['金曜日', 'きんようび', 'Friday'],
    ['土曜日', 'どようび', 'Saturday'],
    ['日曜日', 'にちようび', 'Sunday'],
    ['一月', 'いちがつ', 'January'],
    ['二月', 'にがつ', 'February'],
    ['三月', 'さんがつ', 'March'],
    ['四月', 'しがつ', 'April'],
    ['五月', 'ごがつ', 'May'],
    ['六月', 'ろくがつ', 'June'],
    ['七月', 'しちがつ', 'July'],
    ['八月', 'はちがつ', 'August'],
    ['九月', 'くがつ', 'September'],
    ['十月', 'じゅうがつ', 'October'],
    ['十一月', 'じゅういちがつ', 'November'],
    ['十二月', 'じゅうにがつ', 'December'],
    ['誕生日', 'たんじょうび', 'birthday'],
    ['記念日', 'きねんび', 'anniversary'],
    ['祝日', 'しゅくじつ', 'holiday'],
    ['休日', 'きゅうじつ', 'day off'],
    ['平日', 'へいじつ', 'weekday'],
  ];
  
  for (const [word, reading, meaning] of curated) {
    if (/[\u4E00-\u9FAF\u3400-\u4DBF]/.test(word)) {
      wordDB[word] = reading;
      wordDetails[word] = { r: reading, m: [meaning], c: true };
    }
  }
  
  console.log(`Generated ${Object.keys(wordDB).length} curated entries`);
  
  const output = { wordDB, wordDetails, generated: new Date().toISOString(), source: 'curated-fallback' };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output), 'utf8');
  console.log(`✅ Written curated wordDB to ${OUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
