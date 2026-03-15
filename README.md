# 漢字辞書 — Kanji Dictionary App

A React Native camera-based kanji dictionary app inspired by Shirabe Jisho. Built with Expo, it processes 3,138 kanji from CSV data files and provides live OCR, animated stroke order, and comprehensive dictionary entries.

## Features

- **Camera OCR** — point your webcam at Japanese text to detect and look up kanji in real time
- **Text Input** — paste any Japanese sentence to extract and analyze all kanji
- **Animated Stroke Order** — live SVG animations fetched from KanjiVG showing correct stroke sequence with speed control
- **Full Dictionary Entries** — on'yomi, kun'yomi, meanings, JLPT level, frequency rank, jouyou/jinmeiyou status
- **Search** — by English meaning, katakana reading, hiragana reading, or direct kanji character
- **JLPT Filter** — browse kanji by N5, N4, N3, N2, or N1 level
- **Bookmarks** — save kanji with persistent local storage
- **Dark Mode** — full theme switch across all screens
- **3,138 Kanji** — sourced from JLPT CSVs, Jouyou, Jinmeiyou, and frequency-ranked CSVs

## Data Sources

The app consolidates kanji data from the CSV files in this repository:

| File(s) | Contents |
|---------|----------|
| `N5.csv` – `N1.csv` | JLPT-classified kanji (103 / 182 / 360 / 415 / 1151) |
| `1 - 250.csv` … `2251 - 2501.csv` | Frequency-ranked kanji (top 2,501) |
| `Jouyou kanji.csv` | 2,136 standard education kanji |
| `Jinmeiyou.csv` | 651 name-use kanji |
| Radical CSVs (一.csv, 人.csv, …) | Kanji grouped by radical |

**CSV format:** `"kanji","readings","meanings"` — on'yomi in katakana, kun'yomi in hiragana, comma-separated meanings.

## Prerequisites

- **Node.js** v18 or later (v20 LTS recommended) — check with `node --version`
- **npm** v9 or later — check with `npm --version`

> **Node version matters.** The app uses Expo SDK 55 and React Native 0.83 which require Node ≥ 18. If you have an older version, install [Node 20 LTS](https://nodejs.org/en/download) or use [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`.

## Setup & Run (Quick Start)

```bash
# 1. Enter the app directory
cd KanjiDictApp

# 2. Install dependencies
npm install

# 3. Start the web app
npm start
```

Then open **http://localhost:8081** in your browser.

> `npm start` now launches the web version directly. The kanji database (`src/data/kanjiDB.json`) is already included in the repo — no extra generation step needed.

## Running on macOS (Web) — Alternative Commands

```bash
cd KanjiDictApp
npm run web             # same as npm start, explicit web flag
# or
npx expo start --web --port 8082   # on a custom port
```

## Running on iOS Simulator

```bash
cd KanjiDictApp
npx expo start --ios
```

Requires Xcode and iOS Simulator installed.

## Running on Android Emulator

```bash
cd KanjiDictApp
npx expo start --android
```

Requires Android Studio and an AVD configured.

## Project Structure

```
Furigana/                        ← repository root (CSV data files)
├── *.csv                        ← kanji data files
└── KanjiDictApp/                ← React Native app
    ├── scripts/
    │   └── processCSV.js        ← data processing script
    ├── src/
    │   ├── data/
    │   │   └── kanjiDB.json     ← generated database (run processCSV.js)
    │   ├── screens/
    │   │   ├── CameraScreen.js  ← OCR + text input
    │   │   ├── SearchScreen.js  ← search + JLPT filters
    │   │   ├── KanjiDetailScreen.js  ← detail view + stroke order
    │   │   ├── BookmarksScreen.js
    │   │   └── SettingsScreen.js
    │   ├── components/
    │   │   ├── StrokeOrderView.js   ← animated KanjiVG SVG
    │   │   ├── KanjiCard.js
    │   │   └── JLPTBadge.js
    │   ├── utils/
    │   │   ├── kanjiUtils.js    ← search, lookup, data helpers
    │   │   └── storage.js       ← AsyncStorage (bookmarks, history)
    │   └── theme/
    │       ├── colors.js        ← light + dark theme tokens
    │       └── ThemeContext.js  ← theme provider
    ├── App.js                   ← navigation root
    ├── app.json
    └── package.json
```

## Tech Stack

| Concern | Library |
|---------|---------|
| Framework | Expo SDK 55 / React Native |
| Navigation | React Navigation v7 (bottom tabs + stack) |
| Web rendering | react-native-web |
| OCR | Tesseract.js (web, lazy-loaded) |
| Stroke order | KanjiVG (fetched live from GitHub) |
| Storage | @react-native-async-storage/async-storage |
| Gestures | react-native-gesture-handler |

## Stroke Order

Stroke order animations are fetched on demand from the [KanjiVG](https://kanjivg.tagaini.net/) project:

```
https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{unicode}.svg
```

KanjiVG is by Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

## Regenerating the Database

If you modify the CSV files, re-run the processing script:

```bash
cd KanjiDictApp
node scripts/processCSV.js
```

## Troubleshooting

**`npm install` fails with peer dependency errors**
```bash
npm install --legacy-peer-deps
```
A `.npmrc` file with `legacy-peer-deps=true` is already included, so plain `npm install` should handle this automatically.

**`npm install` or `npm start` crashes immediately**
Check your Node version:
```bash
node --version   # needs v18 or higher
```
If below v18, upgrade via [nodejs.org](https://nodejs.org/en/download) or with nvm:
```bash
nvm install 20
nvm use 20
```

**App opens but shows a blank white screen**
Hard refresh the browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux). If that doesn't work, check the browser console for errors.

**`expo: command not found`**
Use `npx` prefix instead:
```bash
npx expo start --web
```

**Stroke order animation doesn't appear**
The stroke order SVGs are fetched live from GitHub. Make sure you have an internet connection and the browser isn't blocking `raw.githubusercontent.com`.

**Camera doesn't work**
- Only works in browsers that support `getUserMedia` (Chrome, Firefox, Edge, Safari 14+)
- You must allow camera permission when the browser prompts
- On macOS, also check System Settings → Privacy & Security → Camera → allow your browser
