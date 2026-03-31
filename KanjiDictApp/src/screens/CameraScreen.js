import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, ScrollView, Dimensions, Animated,
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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const ocrIntervalRef = useRef(null);
  // Use refs for flags so interval callbacks always see current values (no stale closures)
  const scanningRef = useRef(false);
  const frozenRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  const handleAnalyzeText = () => {
    const text = inputText.trim();
    if (!text) return;
    const kanji = extractKanji(text);
    const entries = kanji.map(k => lookupKanji(k)).filter(Boolean);
    setDetectedKanji(entries);
    setSourceText(text);
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
      {/* Mode tabs */}
      <View style={[styles.modeTabs, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'camera' && { backgroundColor: theme.primary }]}
          onPress={() => { setMode('camera'); setDetectedKanji([]); setSourceText(''); }}
        >
          <Text style={[styles.modeTabText, { color: mode === 'camera' ? '#FFF' : theme.textSecondary }]}>
            📷 Camera OCR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'text' && { backgroundColor: theme.primary }]}
          onPress={() => { setMode('text'); stopCamera(); setDetectedKanji([]); setSourceText(''); }}
        >
          <Text style={[styles.modeTabText, { color: mode === 'text' ? '#FFF' : theme.textSecondary }]}>
            ✍️ Text Input
          </Text>
        </TouchableOpacity>
      </View>

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
                <ActivityIndicator size="small" color="#FFF" />
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
                width: '100%',
                minHeight: 100,
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

          <TouchableOpacity
            style={[styles.analyzeBtn, { backgroundColor: theme.primary }]}
            onPress={handleAnalyzeText}
          >
            <Text style={styles.analyzeBtnText}>Analyze Text →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results: furigana text + kanji tiles */}
      {detectedKanji.length > 0 && (
        <ScrollView style={styles.resultsSection} showsVerticalScrollIndicator={false}>
          {/* ── Furigana text block ── */}
          {sourceText.length > 0 && (
            <View style={[styles.furiganaCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.furiganaLabel, { color: theme.textSecondary }]}>Furigana</Text>
              <FuriganaText
                text={sourceText}
                fontSize={22}
                color={theme.text}
                rtColor={theme.primary}
              />
            </View>
          )}

          {/* ── Individual kanji tiles ── */}
          <Text style={[styles.resultsTitle, { color: theme.text }]}>
            Kanji ({detectedKanji.length}) — tap for details
          </Text>
          <View style={styles.kanjiGrid}>
            {detectedKanji.map((entry) => (
              <TouchableOpacity
                key={entry.kanji}
                style={[styles.kanjiTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => openDetail(entry)}
              >
                <Text style={[styles.tileKanji, { color: theme.text }]}>{entry.kanji}</Text>
                <Text style={[styles.tileFuri, { color: theme.primary }]}>
                  {entry.kunyomi?.[0]?.split('.')[0] || entry.onyomi?.[0] || ''}
                </Text>
                <Text style={[styles.tileMeaning, { color: theme.textSecondary }]} numberOfLines={1}>
                  {entry.meanings?.[0] || ''}
                </Text>
                {entry.jlptLevel && (
                  <View style={[styles.tileJLPT, { backgroundColor: theme.jlptColors[entry.jlptLevel] }]}>
                    <Text style={styles.tileJLPTText}>{entry.jlptLevel}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 40 }} />
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modeTabs: {
    flexDirection: 'row',
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeTabText: { fontSize: 14, fontWeight: '600' },
  cameraSection: { paddingHorizontal: 12 },
  videoWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#000',
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
  cameraControls: { marginTop: 12 },
  bigBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bigBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cameraActiveControls: { flexDirection: 'row', gap: 8 },
  controlBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  controlBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  textSection: { paddingHorizontal: 12, paddingTop: 4 },
  inputLabel: { fontSize: 14, marginBottom: 8 },
  demoScroll: { marginBottom: 10 },
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
  analyzeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
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
  resultsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10, opacity: 0.7 },
  kanjiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kanjiTile: {
    width: (SCREEN_W - 56) / 4,
    minWidth: 70,
    aspectRatio: 0.85,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    position: 'relative',
  },
  tileKanji: { fontSize: 28, fontWeight: '400' },
  tileFuri: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  tileMeaning: { fontSize: 9, marginTop: 2, textAlign: 'center' },
  tileJLPT: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  tileJLPTText: { color: '#FFF', fontSize: 8, fontWeight: '700' },
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
