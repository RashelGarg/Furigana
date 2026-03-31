# KanjiDictApp — Interview Preparation Guide

This document breaks down the core architecture, skillsets demonstrated, and the specific technical challenges solved while building and refining the KanjiDictApp. Review this document before your technical interviews.

## 🎯 Core Skillset & Technologies Used

*   **React Native & Expo (Web / Mobile Cross-Platform)**
    *   Demonstrates writing universally rendering UI code that works in both standard browser DOM formats (`react-native-web`) and native mobile views.
    *   Performance optimizations using `useRef`, `useCallback`, and `useMemo` specifically around camera frame processing and OCR execution.
*   **Computer Vision & OCR (`tesseract.js`)**
    *   Running WebAssembly (Wasm) worker threads in the browser to execute Tesseract.
    *   Understanding Image Pre-Processing (Otsu thresholding, binarization).
    *   Noise reduction algorithms (calculating signal-to-noise ratios via Regex formulas).
*   **NLP & Morphological Analysis (`kuromoji.js`)**
    *   Loading heavy dictionary definitions over CDN dynamically.
    *   Parsing continuous, non-spaced CJK (Chinese-Japanese-Korean) characters into distinct contextual tokens.
*   **Data Structures & State Management**
    *   Parsing CSV data efficiently.
    *   Managing asynchronous UI state (`frozen`, `cameraActive`, `scanning`) in tandem with hardware requests (WebRTC `getUserMedia`).

---

## 🚀 Key Problems Solved & Talking Points

During your interview, if asked "What was a challenging technical problem you solved on this project?", discuss the following three major issues handled in the OCR and Text Parsing pipeline:

### 1. The "Invisible Text" Preprocessing Bug
**Issue:** The app initially failed to read any text from glowing computer or phone screens. The camera was sending images to the OCR engine, but the engine stubbornly claimed "Confidence 12%: No words found".
**Root Cause:** A naive "binary thresholding" algorithm was manually manipulating the pixel data in JavaScript. It calculated pixel luminance (brightness) and arbitrarily turned any pixel under 180 to black, and over 180 to white. Because screens vary in glare, shadow, and sub-pixel glow, this algorithm effectively erased the text before the OCR engine even saw it.
**Resolution:** Ripped out the manual pixel array manipulation loop. Instead of forcing a destructive contrast edit, the raw `canvas` image was passed directly to the `tesseract.js` worker, allowing Tesseract's highly sophisticated internal adaptive thresholding (Otsu's Method) to securely extract characters regardless of scene lighting. Additionally, we dropped a forced `PSM=6` (Page Segmentation Mode) constraint to allow Tesseract to locate disjointed text blocks natively.

### 2. The Context-Clashing Furigana Bug (NLP Prioritization)
**Issue:** When translating `東京都` (Tokyo-to), the app correctly displayed `とうきょう` over `東京`, but incorrectly rendered `みやこ` (Miyako) over `都`.
**Root Cause:** The application was utilizing two differing lookup methods. First, it queried `Kuromoji` which perfectly identified it as the suffix "ト" (-to) based on NLP context. However, the app then stripped that context and fed the isolated character "都" into a static `JMdict` database lookup. The static database predictably defaulted to the standalone noun reading ("miyako"), improperly overriding the intelligent context.
**Resolution:** Reordered the array mapping priority. We explicitly instructed the `FuriganaText` component to trust the `Kuromoji.js` morphologically analyzed reading first. The static JMdict lookup was demoted to a fallback mechanism that is only utilized if Kuromoji entirely fails to generate a reading.

### 3. The "Noisy Edge Artifact" Bug (OCR Garbage Filtering)
**Issue:** While reading textbook pages, Tesseract successfully discovered the target text in the center of the image, but also eagerly analyzed the page edges, shadows, and borders — hallucinating absolute garbage data like `* 計本 Jam。` and severely polluting the user dictionary results.
**Root Cause:** The system was blindly accepting all `data.text` returned by the Tesseract worker without any stringency checks.
**Resolution:** Built a custom JavaScript signal-to-noise ratio pipeline:
*   Instead of reading the massive text blob, we iterated through `data.lines` provided by Tesseract.
*   **Confidence Gate:** Discarded any line where `line.confidence` < 65%.
*   **Density Gate:** Used regex matching `[\u4E00-\u9FAF\u3040-\u30FF]` to count precise Japanese Kanji/Kana characters, divided by the `total character string length`. If the line wasn't at least **50% Japanese characters**, it was definitively assumed to be a wall texture, barcode, or shadow artifact, and immediately discarded.

---

## 💡 How to Demo This App in an Interview
1.  **Explain the architecture:** Emphasize that it's doing complex processing entirely client-side (Zero latency Server-calls for OCR/NLP).
2.  **Show the Camera flow:** Click "Start Camera", show it some Japanese text on your phone, freeze the frame, and show the instant furigana lookup. State that this prevents the app from destroying the user's phone battery with interval checking.
3.  **Explain the Code:** If they look at the code, point them to `buildHtmlKuromoji()` in `FuriganaText.js` to show how you handle edge cases for Japanese NLP, or point them to the `runOCR` callback in `CameraScreen.js` to show the regex confidence filtering logic.
