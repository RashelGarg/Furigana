import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, ScrollView, Dimensions, Animated, useWindowDimensions
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { extractKanji, lookupKanji } from '../utils/kanjiUtils';
import FuriganaText from '../components/FuriganaText';
import { loadKuromoji, tokenize } from '../services/KuromojiService';

const { width: SCREEN_W } = Dimensions.get('window');

export default function CameraScreen({ navigation }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState('camera');
  const [detectedKanji, setDetectedKanji] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [inputText, setInputText] = useState('');
  const [frozen, setFrozen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [ocrProgress, setOcrProgress] = useState(null); // 0-100 or null
  const [sourceText, setSourceText] = useState(''); // full text for furigana display
  const [ocrDebugLog, setOcrDebugLog] = useState([]); // on-screen debug info
  
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const ocrIntervalRef = useRef(null);
  // Use refs for flags so interval callbacks always see current values (no stale closures)
  const scanningRef = useRef(false);
  const frozenRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 768;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    // Pre-load kuromoji so it's ready by the time user analyses text
    if (Platform.OS === 'web') loadKuromoji().catch(() => {});
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    if (Platform.OS !== 'web') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (e) {
      console.error('Camera error:', e);
    }
  };

  const stopCamera = () => {
    clearInterval(ocrIntervalRef.current);
    ocrIntervalRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    scanningRef.current = false;
    frozenRef.current = false;
    setScanning(false);
    setFrozen(false);
    setOcrProgress(null);
    setCameraActive(false);
  };

  // Core OCR function — reads from whichever canvas content was drawn last.
  // Uses refs (not state) for guards so interval always sees fresh values.
  const runOCR = useCallback(async (canvas) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setOcrProgress(0);
    const log = [];
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('jpn', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const result = await worker.recognize(canvas);
      await worker.terminate();
      const data = result.data;

      // ── On-screen debug info ──────────────────────────────────────────────
      log.push(`Page confidence: ${Math.round(data.confidence || 0)}%`);
      
      // ── Filter and extract clean text ──────────────────────────────────────
      const validLines = (data.lines || []).filter(line => {
        // Discard low confidence lines
        if (line.confidence < 65) return false;
        
        // Aggressively aggressively strip all formatting and English numbers/characters out
        const cleanText = text.replace(/[a-zA-Z0-9\s]/g, '');
        const kanjiKanaCount = (cleanText.match(/[\u4E00-\u9FAF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
        const totalChars = cleanText.length;
        if (totalChars === 0) return false;
        
        return (kanjiKanaCount / totalChars) >= 0.5; 
      });

      let allText = (data.lines && data.lines.length > 0)
        ? validLines.map(l => l.text).join('\n')
        : (data.text || '');

      // The absolute nuclear option: no Latin/English characters will survive into Furigana lookup.
      allText = allText.replace(/[a-zA-Z0-9]/g, '');

      if (!allText.trim()) {
        log.push('No usable text detected');
      } else {
        log.push(`Clean lines found: ${validLines.length}`);
        log.push(`  "${allText.replace(/\s+/g, '').slice(0, 20)}..."`);
      }

      const kanji   = extractKanji(allText);
      log.push(`Kanji in text: [${kanji.join(', ') || 'none'}]`);

      if (kanji.length === 0) {
        log.push('→ No recognizable kanji found');
        setOcrDebugLog([...log]);
        return;
      }

      const entries = kanji.map(k => lookupKanji(k)).filter(Boolean);
      log.push(`Dictionary matches: ${entries.length}`);

      if (entries.length > 0) {
        setDetectedKanji(entries);
        setSourceText(allText.trim());
        log.push('✓ Result displayed!');
      } else {
        log.push('→ Kanji found but not in dictionary');
      }
      setOcrDebugLog([...log]);
    } catch (e) {
      log.push(`Error: ${e.message}`);
      setOcrDebugLog([...log]);
      console.error('OCR error:', e);
    } finally {
      scanningRef.current = false;
      setScanning(false);
      setOcrProgress(null);
    }
  }, []);

  const startOCR = useCallback(() => {
    clearInterval(ocrIntervalRef.current);
    // No longer auto-capturing. Wait for user to trigger OCR manually.
  }, []);

  // "Capture Now": freeze the live video, show the snapshot, then OCR it
  const freezeAndOCR = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    // Stop auto-scan interval while frozen
    clearInterval(ocrIntervalRef.current);
    
    // Draw full current frame to visible canvas so it looks frozen
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    frozenRef.current = true;
    setFrozen(true);
    // Pause live video
    video.pause();

    // Reset crop state and enter crop mode
    setCropRect(null);
    setDragStart(null);
    setIsCropping(true);
  }, []);

  const analyzeCrop = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !cropRect || viewSize.width === 0) return;
    
    setIsCropping(false); // End crop mode UI
    
    const cropCanvas = document.createElement('canvas');
    // Map the view bounds precisely back to the native video pixel dimensions
    const scaleX = video.videoWidth / viewSize.width;
    const scaleY = video.videoHeight / viewSize.height;
    
    const cropW = cropRect.width * scaleX;
    const cropH = cropRect.height * scaleY;
    const cropX = cropRect.x * scaleX;
    const cropY = cropRect.y * scaleY;
    
    // Prevent 0-area crops crashing Tesseract
    if (cropW === 0 || cropH === 0) {
      frozenRef.current = false;
      setFrozen(false);
      if (video) video.play();
      return;
    }
    
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    cropCanvas.getContext('2d').drawImage(
      video,
      cropX, cropY, cropW, cropH,
      0, 0, cropW, cropH
    );

    // OCR only the targeted region!
    await runOCR(cropCanvas);
  }, [cropRect, viewSize, runOCR]);

  // "Resume": unfreeze, restart live stream and interval
  const resumeCamera = useCallback(() => {
    frozenRef.current = false;
    setFrozen(false);
    if (videoRef.current) videoRef.current.play();
    startOCR();
  }, [startOCR]);

  const translateText = async (text) => {
    if (!text.trim()) return;
    setIsTranslating(true);
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ja|en`);
      const data = await res.json();
      if (data?.responseData?.translatedText) {
        setTranslatedText(data.responseData.translatedText);
      } else {
        setTranslatedText("Translation failed or limited by API.");
      }
    } catch (e) {
      console.error(e);
      setTranslatedText("Error: Could not reach translation service.");
    }
    setIsTranslating(false);
  };

  const handleAnalyzeText = () => {
    // Trim unnecessary enter spaces
    const cleanText = inputText.trim();
    if (!cleanText) return;
    setInputText(cleanText);

    const kanji = extractKanji(cleanText);
    const entries = kanji.map(k => lookupKanji(k)).filter(Boolean);
    setDetectedKanji(entries);
    setSourceText(cleanText);
    translateText(cleanText);
  };

  const handlePdfUpload = async () => {
    if (Platform.OS !== 'web') return;
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = 'application/pdf';
    el.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
          const typedarray = new Uint8Array(this.result);
          if (!window.pdfjsLib) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          }
          try {
            const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(' ');
              fullText += pageText + '\n';
            }
            // remove multiple empty lines
            const formatted = fullText.replace(/\n\s*\n/g, '\n\n').trim();
            setInputText(formatted);
          } catch(e) {
            console.error('PDF Parse Error:', e);
            alert('Could not parse PDF file.');
          }
        };
        fileReader.readAsArrayBuffer(file);
      }
    };
    el.click();
  };

  const downloadPDF = async () => {
    if (Platform.OS !== 'web') return;
    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      document.head.appendChild(script);
      await new Promise(resolve => script.onload = resolve);
    }
    const element = document.getElementById('furigana-output-block');
    if (element) {
      window.html2pdf().from(element).set({
        margin: 10,
        filename: 'Furigana_Translation.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).save();
    }
  };

  const openDetail = (entry) => {
    navigation.navigate('KanjiDetail', { entry });
  };

  const DEMO_TEXTS = [
    '東京大学で日本語を勉強しています。',
    '今日は天気がとても良いです。',
    '私は毎日新聞を読みます。',
    '日本の文化は世界中で有名です。',
  ];

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Mode tabs */}
      <View style={[styles.modeTabs, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'camera' && { backgroundColor: theme.primary }]}
          onPress={() => { setMode('camera'); setDetectedKanji([]); setSourceText(''); }}
        >
          <Text style={[styles.modeTabText, { color: mode === 'camera' ? theme.buttonText : theme.textSecondary }]}>
            📷 Camera OCR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'text' && { backgroundColor: theme.primary }]}
          onPress={() => { setMode('text'); stopCamera(); setDetectedKanji([]); setSourceText(''); }}
        >
          <Text style={[styles.modeTabText, { color: mode === 'text' ? theme.buttonText : theme.textSecondary }]}>
            ✍️ Text Input
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.contentContainer, { flexDirection: isLargeScreen ? 'row' : 'column', minHeight: isLargeScreen ? 350 : 'auto' }]}>
        {/* Left Side: Input (Camera or Text) */}
        <View style={isLargeScreen ? styles.leftPanel : styles.fullLeftPanel}>
          {/* Camera mode */}
          {mode === 'camera' && Platform.OS === 'web' && (
        <View style={styles.cameraSection}>
          {/* Video / frozen canvas preview */}
          <View 
            style={[styles.videoWrapper, { backgroundColor: '#000', borderColor: theme.border }]}
            onLayout={(e) => setViewSize(e.nativeEvent.layout)}
          >
            {/* Live video — hidden when frozen */}
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxHeight: 280,
                objectFit: 'cover',
                borderRadius: 12,
                display: cameraActive && !frozen ? 'block' : 'none',
              }}
              playsInline
              muted
            />
            {/* Frozen snapshot canvas — shown when frozen */}
            <canvas
              ref={canvasRef}
              style={{
                display: frozen ? 'block' : 'none',
                width: '100%',
                maxHeight: 280,
                objectFit: 'cover',
                borderRadius: 12,
              }}
            />
            {!cameraActive && (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraIcon}>📷</Text>
                <Text style={[styles.cameraHint, { color: theme.textSecondary }]}>
                  Camera view will appear here
                </Text>
                <Text style={[styles.cameraHintSub, { color: theme.textTertiary }]}>
                  Point at Japanese text to detect kanji
                </Text>
              </View>
            )}

            {/* Interactive Cropping Overlay */}
            {frozen && isCropping && (
              <View 
                style={StyleSheet.absoluteFill}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => {
                  const { locationX, locationY } = e.nativeEvent;
                  setDragStart({ x: locationX, y: locationY });
                  setCropRect({ x: locationX, y: locationY, width: 0, height: 0 });
                }}
                onResponderMove={(e) => {
                  const { locationX, locationY } = e.nativeEvent;
                  if (dragStart) {
                    const x = Math.min(dragStart.x, locationX);
                    const y = Math.min(dragStart.y, locationY);
                    const width = Math.abs(locationX - dragStart.x);
                    const height = Math.abs(locationY - dragStart.y);
                    setCropRect({ x, y, width, height });
                  }
                }}
              >
                {/* Dim background helper */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} pointerEvents="none" />
                
                {/* Drawn highlight rectangle */}
                {cropRect && (
                  <View style={{
                    position: 'absolute',
                    left: cropRect.x,
                    top: cropRect.y,
                    width: cropRect.width,
                    height: cropRect.height,
                    borderWidth: 2,
                    borderColor: theme.primary,
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  }} pointerEvents="none" />
                )}
                
                <View style={styles.cropHintBadge}>
                  <Text style={styles.cropHintText}>Draw a box around the Japanese text</Text>
                </View>
              </View>
            )}
            {/* Frozen badge */}
            {frozen && (
              <View style={styles.frozenBadge}>
                <Text style={styles.frozenBadgeText}>📸 Frozen</Text>
              </View>
            )}
            {/* Scanning overlay with progress */}
            {scanning && (
              <View style={styles.scanningOverlay}>
                <ActivityIndicator size="small" color={theme.buttonText} />
                <Text style={styles.scanningText}>
                  {ocrProgress !== null ? `${ocrProgress}%` : 'Loading OCR…'}
                </Text>
              </View>
            )}
          </View>

          {/* Camera controls */}
          <View style={styles.cameraControls}>
            {!cameraActive ? (
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: theme.primary }]}
                onPress={() => startCamera().then(startOCR)}
              >
                <Text style={styles.bigBtnText}>Start Camera</Text>
              </TouchableOpacity>
            ) : frozen ? (
              isCropping ? (
                <View style={styles.cameraActiveControls}>
                  <TouchableOpacity
                    style={[styles.controlBtn, { backgroundColor: theme.primary, opacity: (cropRect && cropRect.width > 10) ? 1 : 0.4 }]}
                    onPress={analyzeCrop}
                    disabled={!cropRect || cropRect.width <= 10}
                  >
                    <Text style={styles.controlBtnText}>✅ Analyze Selection</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.controlBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border, borderWidth: 1 }]}
                    onPress={resumeCamera}
                  >
                    <Text style={[styles.controlBtnText, { color: theme.text }]}>❌ Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Frozen state: show Resume button */
                <TouchableOpacity
                  style={[styles.bigBtn, { backgroundColor: theme.accent }]}
                  onPress={resumeCamera}
                >
                  <Text style={styles.bigBtnText}>▶ Resume Camera</Text>
                </TouchableOpacity>
              )
            ) : (
              <View style={styles.cameraActiveControls}>
                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: theme.accent }]}
                  onPress={freezeAndOCR}
                  disabled={scanning}
                >
                  <Text style={styles.controlBtnText}>📸 Capture Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border, borderWidth: 1 }]}
                  onPress={stopCamera}
                >
                  <Text style={[styles.controlBtnText, { color: theme.text }]}>⏹ Stop</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Text input mode */}
      {mode === 'text' && (
        <View style={styles.textSection}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Paste or type Japanese text to extract kanji:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.demoScroll}>
            {DEMO_TEXTS.map((text, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.demoChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                onPress={() => setInputText(text)}
              >
                <Text style={[styles.demoChipText, { color: theme.text }]} numberOfLines={1}>
                  {text.slice(0, 12)}…
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {Platform.OS === 'web' ? (
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="東京大学で日本語を勉強しています。"
              style={{
                flex: 1,
                width: '100%',
                minHeight: 150,
                fontSize: 18,
                padding: 12,
                borderRadius: 10,
                border: `1.5px solid ${theme.border}`,
                backgroundColor: theme.surface,
                color: theme.text,
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.analyzeBtn, { backgroundColor: theme.primary, flex: 1, marginTop: 0 }]}
              onPress={handleAnalyzeText}
            >
              <Text style={styles.analyzeBtnText}>Analyze Text →</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.uploadBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border, borderWidth: 1 }]}
                onPress={handlePdfUpload}
              >
                <Text style={[styles.uploadBtnText, { color: theme.text }]}>📄 Upload PDF</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
        </View>

        {/* Right Side: Output (Results or Hint) */}
        <View style={isLargeScreen ? [styles.rightPanel, { borderColor: theme.border }] : styles.fullRightPanel}>
      {/* Results: furigana text */}
      {detectedKanji.length > 0 && (
        <ScrollView style={styles.resultsSection} showsVerticalScrollIndicator={false}>
          <View id="furigana-output-block">
            {/* ── Furigana text block ── */}
            {sourceText.length > 0 && (
              <View style={[styles.furiganaCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.cardHeader, { marginBottom: 6 }]}>
                  <Text style={[styles.furiganaLabel, { color: theme.textSecondary, marginBottom: 0 }]}>Furigana</Text>
                  {Platform.OS === 'web' && (
                    <TouchableOpacity onPress={downloadPDF} style={styles.pdfBtn}>
                      <Text style={[styles.pdfBtnText, { color: theme.primary }]}>💾 Download PDF</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <FuriganaText
                  text={sourceText}
                  fontSize={22}
                  color={theme.text}
                  rtColor={theme.primary}
                />
              </View>
            )}

            {/* ── Translation text block ── */}
            {sourceText.length > 0 && (
              <View style={[styles.furiganaCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border, marginTop: 16 }]}>
                 <Text style={[styles.furiganaLabel, { color: theme.textSecondary }]}>English Translation</Text>
                 {isTranslating ? (
                   <ActivityIndicator size="small" color={theme.primary} />
                 ) : (
                   <Text style={{ fontSize: 16, color: theme.text, lineHeight: 24 }}>
                     {translatedText || "No translation generated."}
                   </Text>
                 )}
              </View>
            )}
          </View>
        </ScrollView>
      )}



      {detectedKanji.length === 0 && !scanning && (
        <View style={styles.hintSection}>
          <Text style={[styles.hintTitle, { color: theme.textTertiary }]}>漢字辞書</Text>
          <Text style={[styles.hintText, { color: theme.textSecondary }]}>
            {mode === 'camera'
              ? 'Start the camera and point at Japanese text to detect kanji in real time'
              : 'Type or paste Japanese text above to extract and analyze kanji'}
          </Text>

          {/* ── OCR Debug Panel ── */}
          {ocrDebugLog.length > 0 && (
            <View style={[styles.debugPanel, { backgroundColor: '#111', borderColor: '#333' }]}>
              <Text style={styles.debugTitle}>📋 Last OCR Result</Text>
              {ocrDebugLog.map((line, i) => (
                <Text key={i} style={[
                  styles.debugLine,
                  line.startsWith('✓') && { color: '#4CAF50' },
                  line.startsWith('→') && { color: '#FF5722' },
                  line.startsWith('  ') && { color: '#aaa' },
                ]}>{line}</Text>
              ))}
            </View>
          )}

          <View style={styles.featurePills}>
            {['Real-time OCR', 'Furigana', 'Stroke Order', 'JLPT Levels', '3,138 Kanji'].map(f => (
              <View key={f} style={[styles.pill, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Text style={[styles.pillText, { color: theme.textSecondary }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Full-screen scanning state (first OCR, before any results) */}
      {detectedKanji.length === 0 && scanning && (
        <View style={styles.hintSection}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.hintText, { color: theme.textSecondary, marginTop: 16 }]}>
            {ocrProgress !== null ? `Recognizing text… ${ocrProgress}%` : 'Loading Japanese OCR engine…'}
          </Text>
          <Text style={[styles.hintTextSub, { color: theme.textTertiary }]}>
            First run downloads the language pack (~20 MB)
          </Text>
        </View>
      )}
        </View>
      </View>

      {/* Centered Bottom Kanji List */}
      {detectedKanji.length > 0 && (
        <View style={styles.bottomListWrapper}>
          <Text style={[styles.resultsTitle, { color: theme.text }]}>
            Kanji ({detectedKanji.length}) — tap for details
          </Text>
          <View style={styles.kanjiList}>
            {detectedKanji.map((entry) => (
              <TouchableOpacity
                key={entry.kanji}
                style={[styles.kanjiListItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => openDetail(entry)}
              >
                <Text style={[styles.listItemKanji, { color: theme.text }]}>{entry.kanji}</Text>
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemFuri, { color: theme.primary }]}>
                    {entry.kunyomi?.[0]?.split('.')[0] || entry.onyomi?.[0] || ' '}
                  </Text>
                  <Text style={[styles.listItemMeaning, { color: theme.textSecondary }]} numberOfLines={1}>
                    {entry.meanings?.join(', ') || ''}
                  </Text>
                </View>
                {entry.jlptLevel && (
                  <View style={[styles.listItemJLPT, { backgroundColor: theme.jlptColors[entry.jlptLevel] }]}>
                    <Text style={styles.listItemJLPTText}>{entry.jlptLevel}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flex: 1 },
  leftPanel: { flex: 1, paddingRight: 8 },
  rightPanel: { flex: 1, paddingLeft: 8, borderLeftWidth: 1 },
  fullLeftPanel: { flex: 0 },
  fullRightPanel: { flex: 1 },
  modeTabs: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 16,
    borderWidth: 0,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeTabText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  cameraSection: { paddingHorizontal: 12 },
  videoWrapper: {
    borderRadius: 24,
    borderWidth: 0,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  cameraPlaceholder: { alignItems: 'center', padding: 40 },
  cameraIcon: { fontSize: 48, marginBottom: 12 },
  cameraHint: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cameraHintSub: { fontSize: 13, textAlign: 'center' },
  
  cropHintBadge: { position: 'absolute', top: 16, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  cropHintText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  
  frozenBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  frozenBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  scanningOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  scanningText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  cameraControls: { marginTop: 20 },
  bigBtn: {
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  bigBtnText: { color: '#EDEDCE', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  cameraActiveControls: { flexDirection: 'row', gap: 12 },
  controlBtn: {
    flex: 1,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  controlBtnText: { color: '#EDEDCE', fontSize: 15, fontWeight: '600' },
  uploadBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  uploadBtnText: { fontSize: 15, fontWeight: '600' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pdfBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pdfBtnText: { fontSize: 12, fontWeight: '600' },
  textSection: { paddingHorizontal: 12, paddingTop: 8, flex: 1 },
  inputLabel: { fontSize: 14, marginBottom: 8 },
  demoScroll: { marginBottom: 10, flexGrow: 0, flexShrink: 0, maxHeight: 34 },
  demoChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  demoChipText: { fontSize: 13 },
  analyzeBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  analyzeBtnText: { color: '#EDEDCE', fontSize: 16, fontWeight: '700' },
  resultsSection: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  furiganaCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  furiganaLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  bottomListWrapper: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  resultsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10, opacity: 0.7 },
  kanjiList: {
    gap: 8,
  },
  kanjiListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  listItemKanji: { fontSize: 24, fontWeight: '400', width: 40, textAlign: 'center' },
  listItemContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 12 },
  listItemFuri: { fontSize: 13, marginBottom: 2, fontWeight: '500' },
  listItemMeaning: { fontSize: 12, opacity: 0.9 },
  listItemJLPT: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  listItemJLPTText: { color: '#EDEDCE', fontSize: 10, fontWeight: '700' },
  hintSection: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  hintTitle: { fontSize: 56, marginBottom: 16 },
  hintText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  hintTextSub: { fontSize: 12, textAlign: 'center', marginBottom: 24 },
  featurePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: '500' },
  debugPanel: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginVertical: 12,
  },
  debugTitle: { color: '#FFF', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  debugLine: { color: '#FFF', fontSize: 11, fontFamily: 'monospace', lineHeight: 17 },
});

