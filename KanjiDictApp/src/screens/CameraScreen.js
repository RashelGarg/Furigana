import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, ScrollView, Dimensions, Animated,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { extractKanji, lookupKanji } from '../utils/kanjiUtils';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Camera Screen
 * - Web: uses webcam + canvas for frame capture + Tesseract OCR
 * - Shows detected kanji with furigana overlays
 */
export default function CameraScreen({ navigation }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState('camera'); // 'camera' | 'paste'
  const [pasteText, setPasteText] = useState('');
  const [detectedKanji, setDetectedKanji] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [inputText, setInputText] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const ocrIntervalRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureAndOCR = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || scanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    setScanning(true);
    try {
      // Dynamically load Tesseract to avoid SSR issues
      const Tesseract = (await import('tesseract.js')).default;
      const { data: { text } } = await Tesseract.recognize(canvas, 'jpn', {
        logger: () => {},
      });
      const kanji = extractKanji(text);
      if (kanji.length > 0) {
        const entries = kanji.map(k => lookupKanji(k)).filter(Boolean);
        setDetectedKanji(entries);
      }
    } catch (e) {
      console.error('OCR error:', e);
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  const startOCR = () => {
    ocrIntervalRef.current = setInterval(captureAndOCR, 4000);
    captureAndOCR();
  };

  const handleAnalyzeText = () => {
    const text = inputText.trim();
    if (!text) return;
    const kanji = extractKanji(text);
    const entries = kanji.map(k => lookupKanji(k)).filter(Boolean);
    setDetectedKanji(entries);
  };

  const openDetail = (entry) => {
    navigation.navigate('KanjiDetail', { entry });
  };

  // For demo Japanese text
  const DEMO_TEXTS = [
    '東京大学で日本語を勉強しています。',
    '今日は天気がとても良いです。',
    '私は毎日新聞を読みます。',
    '日本の文化は世界中で有名です。',
  ];

  const [demoIndex, setDemoIndex] = useState(0);

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      {/* Mode tabs */}
      <View style={[styles.modeTabs, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'camera' && { backgroundColor: theme.primary }]}
          onPress={() => { setMode('camera'); setDetectedKanji([]); }}
        >
          <Text style={[styles.modeTabText, { color: mode === 'camera' ? '#FFF' : theme.textSecondary }]}>
            📷 Camera OCR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'text' && { backgroundColor: theme.primary }]}
          onPress={() => { setMode('text'); stopCamera(); setDetectedKanji([]); }}
        >
          <Text style={[styles.modeTabText, { color: mode === 'text' ? '#FFF' : theme.textSecondary }]}>
            ✍️ Text Input
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera mode */}
      {mode === 'camera' && Platform.OS === 'web' && (
        <View style={styles.cameraSection}>
          {/* Video preview */}
          <View style={[styles.videoWrapper, { backgroundColor: '#000', borderColor: theme.border }]}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxHeight: 280,
                objectFit: 'cover',
                borderRadius: 12,
                display: cameraActive ? 'block' : 'none',
              }}
              playsInline
              muted
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
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
            {scanning && (
              <View style={styles.scanningOverlay}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.scanningText}>Scanning...</Text>
              </View>
            )}
          </View>

          {/* Camera controls */}
          <View style={styles.cameraControls}>
            {!cameraActive ? (
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: theme.primary }]}
                onPress={() => { startCamera().then(startOCR); }}
              >
                <Text style={styles.bigBtnText}>Start Camera</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.cameraActiveControls}>
                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: theme.accent }]}
                  onPress={captureAndOCR}
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
          {/* Demo texts */}
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

      {/* Detected kanji results */}
      {detectedKanji.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={[styles.resultsTitle, { color: theme.text }]}>
            Detected Kanji ({detectedKanji.length})
          </Text>
          <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
            <View style={styles.kanjiGrid}>
              {detectedKanji.map((entry) => (
                <TouchableOpacity
                  key={entry.kanji}
                  style={[styles.kanjiTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => openDetail(entry)}
                >
                  <Text style={[styles.tileKanji, { color: theme.text }]}>{entry.kanji}</Text>
                  <Text style={[styles.tileFuri, { color: theme.furigana }]}>
                    {entry.kunyomi?.[0] || entry.onyomi?.[0] || ''}
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
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      )}

      {detectedKanji.length === 0 && (
        <View style={styles.hintSection}>
          <Text style={[styles.hintTitle, { color: theme.textTertiary }]}>漢字辞書</Text>
          <Text style={[styles.hintText, { color: theme.textSecondary }]}>
            {mode === 'camera'
              ? 'Start the camera and point at Japanese text to detect kanji in real time'
              : 'Type or paste Japanese text above to extract and analyze kanji'}
          </Text>
          <View style={styles.featurePills}>
            {['Real-time OCR', 'Furigana', 'Stroke Order', 'JLPT Levels', '3,138 Kanji'].map(f => (
              <View key={f} style={[styles.pill, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Text style={[styles.pillText, { color: theme.textSecondary }]}>{f}</Text>
              </View>
            ))}
          </View>
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
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPlaceholder: { alignItems: 'center', padding: 40 },
  cameraIcon: { fontSize: 48, marginBottom: 12 },
  cameraHint: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cameraHintSub: { fontSize: 13, textAlign: 'center' },
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
  scanningText: { color: '#FFF', fontSize: 12 },
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
  resultsSection: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  resultsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  resultsList: { flex: 1 },
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
  hintText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  featurePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: '500' },
});
