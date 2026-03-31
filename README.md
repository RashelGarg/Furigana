# 漢字辞書 — Kanji Dictionary App

A React Native camera-based kanji dictionary app inspired by Shirabe Jisho. Built with Expo, it processes 3,138 kanji from CSV data files and provides live OCR, animated stroke order, and comprehensive dictionary entries.

## Table of Contents
- [Features](#features)
- [Data Sources](#data-sources)
- [Prerequisites](#prerequisites)
- [Setup & Run](#setup--run-quick-start)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Stroke Order](#stroke-order)
- [Troubleshooting](#troubleshooting)

## Features

- **Advanced Camera OCR** — point your webcam at Japanese text, freeze the frame, and capture to detect kanji in real time using Tesseract.js with custom Japanese density filtering.
- **Context-Aware Furigana** — utilizes Kuromoji morphological analysis to intelligently attach okurigana and accurately read compound kanji based on context. 
- **Text Input** — paste any Japanese sentence to extract and analyze all kanji.
- **Animated Stroke Order** — live SVG animations fetched from KanjiVG showing correct stroke sequence with speed control.
- **Full Dictionary Entries** — on'yomi, kun'yomi, meanings, JLPT level, frequency rank, jouyou/jinmeiyou status.
- **Search & Filters** — search by English, katakana, hiragana, or direct kanji. Filter by JLPT levels (N5-N1).
- **Bookmarks** — save kanji with persistent local storage.
- **Dark Mode** — full UI theme switch across all screens.

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

> **Note:** The app uses Expo SDK 55 and React Native 0.83 which require Node ≥ 18.

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

## Project Structure

```
Furigana/                        ← repository root (CSV data files)
├── *.csv                        ← kanji data files
└── KanjiDictApp/                ← React Native app
    ├── src/
    │   ├── data/
    │   │   └── kanjiDB.json     ← generated database
    │   ├── screens/
    │   │   ├── CameraScreen.js  ← Advanced OCR & Thresholding logic
    │   │   ├── SearchScreen.js  ← search + JLPT filters
    │   │   ├── KanjiDetailScreen.js
    │   │   ├── BookmarksScreen.js
    │   │   └── SettingsScreen.js
    │   ├── components/
    │   │   ├── FuriganaText.js  ← Kuromoji morphological rendering
    │   │   ├── StrokeOrderView.js
    │   │   └── KanjiCard.js
    │   ├── services/
    │   │   └── KuromojiService.js ← NLP tokenizer
    │   ├── utils/
    │   │   ├── kanjiUtils.js
    │   │   └── storage.js       ← AsyncStorage (bookmarks, history)
    │   └── theme/
    │       ├── colors.js
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
| OCR Engine | Tesseract.js (web, lazy-loaded) + Custom Heuristics |
| NLP & Tokenization | Kuromoji.js |
| Stroke order | KanjiVG (fetched live from GitHub) |
| Storage | @react-native-async-storage/async-storage |

## Stroke Order

Stroke order animations are fetched on demand from the [KanjiVG](https://kanjivg.tagaini.net/) project. KanjiVG is by Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

## Troubleshooting

- **`npm install` fails with peer dependency errors:** A `.npmrc` file with `legacy-peer-deps=true` is included, but you can force it manually via `npm install --legacy-peer-deps`.
- **Camera doesn't work:** Only works in browsers that support `getUserMedia`. You must grant camera permissions!
