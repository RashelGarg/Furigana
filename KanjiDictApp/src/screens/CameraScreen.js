import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, ScrollView, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { extractKanji, lookupKanji } from '../utils/kanjiUtils';
import FuriganaText from '../components/FuriganaText';
import {
  loadLLM, generateFurigana, subscribeLLM, LLM_STATUS,
} from '../services/LLMService';

const { width: W } = Dimensions.get('window');

const DEMO_TEXTS = [
  '東京大学で日本語を勉強しています。',
  '今日は天気がとても良いです。',
  '私は毎日新聞を読みます。',
  '日本の文化は世界中で有名です。',
];

// Glass card style for web
const glassStyle = (borderColor = 'rgba(255,255,255,0.08)') =>
  Platform.OS === 'web'
    ? {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`,
      }
    : {};

export default function CameraScreen({ navigation }) {
  const { theme } = useTheme();
  const [mode, setMode]           = useState('camera');
  const [detectedKanji, setDetectedKanji] = useState([]);
  const [scanning, setScanning]   = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [inputText, setInputText] = useState('');
  const [frozen, setFrozen]       = useState(false);
  const [ocrProgress, setOcrProgress] = useState(null);
  const [sourceText, setSourceText] = useState('');
  const [furiganaHtml, setFuriganaHtml] = useState(null);  // LLM output
  const [llmStatus, setLlmStatus] = useState(LLM_STATUS.IDLE);
  const [llmProgress, setLlmProgress] = useState(0);
  const [llmGenerating, setLlmGenerating] = useState(false);

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const streamRef     = useRef(null);
  const ocrIntervalRef = useRef(null);
  const scanningRef   = useRef(false);
  const frozenRef     = useRef(false);
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const scanLineAnim  = useRef(new Animated.Value(0)).current;

  // Subscribe to LLM status
  useEffect(() => {
    const unsub = subscribeLLM((status, progress) => {
      setLlmStatus(status);
      setLlmProgress(progress);
    });
    return unsub;
  }, []);

  // Fade-in + scan line loop
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { loop.stop(); stopCamera(); };
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
    frozenRef.current   = false;
    setScanning(false);
    setFrozen(false);
    setOcrProgress(null);
    setCameraActive(false);
  };

  const runOCR = useCallback(async (canvas) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setOcrProgress(0);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('jpn', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text')
            setOcrProgress(Math.round(m.progress * 100));
        },
      });
      // Greyscale + contrast pre-processing
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = canvas.height;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      const img = ctx.getImageData(0, 0, tmp.width, tmp.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const g = Math.min(255, Math.max(0,
          (0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2] - 128) * 1.4 + 128
        ));
        img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      }
      ctx.putImageData(img, 0, 0);

      const { data } = await worker.recognize(tmp);
      await worker.terminate();

      const highConf = (data.words || []).filter(w => w.confidence > 60).map(w => w.text).join('');
      const best     = highConf.length > 0 ? highConf : data.text;
      const kanji    = extractKanji(best);
      if (kanji.length > 0) {
        const entries = kanji.map(k => lookupKanji(k)).filter(Boolean);
        if (entries.length > 0) {
          setDetectedKanji(entries);
          setSourceText(best.trim());
          runFurigana(best.trim());
        }
      }
    } catch (e) {
      console.error('OCR error:', e);
    } finally {
      scanningRef.current = false;
      setScanning(false);
      setOcrProgress(null);
    }
  }, []);

  const runFurigana = async (text) => {
    setLlmGenerating(true);
    setFuriganaHtml(null);
    // Kick off model load in background if needed, then generate
    const html = await generateFurigana(text, setLlmProgress);
    setFuriganaHtml(html);
    setLlmGenerating(false);
  };

  const autoCapture = useCallback(() => {
    if (frozenRef.current || scanningRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    runOCR(canvas);
  }, [runOCR]);

  const startOCR = useCallback(() => {
    clearInterval(ocrIntervalRef.current);
    autoCapture();
    ocrIntervalRef.current = setInterval(autoCapture, 7000);
  }, [autoCapture]);

  const freezeAndOCR = useCallback(async () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    clearInterval(ocrIntervalRef.current);
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    frozenRef.current = true;
    setFrozen(true);
    video.pause();
    await runOCR(canvas);
  }, [runOCR]);

  const resumeCamera = useCallback(() => {
    frozenRef.current = false;
    setFrozen(false);
    if (videoRef.current) videoRef.current.play();
    startOCR();
  }, [startOCR]);

  const handleAnalyzeText = async () => {
    const text = inputText.trim();
    if (!text) return;
    const kanji   = extractKanji(text);
    const entries = kanji.map(k => lookupKanji(k)).filter(Boolean);
    setDetectedKanji(entries);
    setSourceText(text);
    await runFurigana(text);
    // Also start loading model in background for next use
    loadLLM();
  };

  const openDetail = (entry) => navigation.navigate('KanjiDetail', { entry });

  // ─── LLM status pill ────────────────────────────────────────
  const llmPillColor = {
    [LLM_STATUS.IDLE]:    theme.textTertiary,
    [LLM_STATUS.LOADING]: theme.warning,
    [LLM_STATUS.READY]:   theme.success,
    [LLM_STATUS.ERROR]:   theme.error,
  }[llmStatus];

  const llmPillLabel = {
    [LLM_STATUS.IDLE]:    'AI · tap to load',
    [LLM_STATUS.LOADING]: `AI · loading ${llmProgress}%`,
    [LLM_STATUS.READY]:   'AI · ready',
    [LLM_STATUS.ERROR]:   'AI · unavailable',
  }[llmStatus];

  const hasResults = detectedKanji.length > 0;

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>

      {/* ── Header ── */}
      <LinearGradient colors={theme.gradientHero} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>漢字スキャン</Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Kanji Scanner</Text>
          </View>
          {/* LLM status pill */}
          <TouchableOpacity
            style={[styles.llmPill, { borderColor: llmPillColor + '60', backgroundColor: llmPillColor + '18' }]}
            onPress={() => loadLLM()}
          >
            <View style={[styles.llmDot, { backgroundColor: llmPillColor }]} />
            <Text style={[styles.llmPillText, { color: llmPillColor }]}>{llmPillLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Mode tabs */}
        <View style={[styles.modeTabs, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: theme.border }]}>
          {['camera', 'text'].map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.modeTab, mode === m && { backgroundColor: theme.primary }]}
              onPress={() => {
                setMode(m);
                setDetectedKanji([]);
                setSourceText('');
                setFuriganaHtml(null);
                if (m !== 'camera') stopCamera();
              }}
            >
              <Text style={[styles.modeTabText, { color: mode === m ? '#FFF' : theme.textSecondary }]}>
                {m === 'camera' ? '⬡ Camera OCR' : '✦ Text Input'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Camera mode ── */}
        {mode === 'camera' && Platform.OS === 'web' && (
          <View style={styles.cameraSection}>
            {/* Viewfinder */}
            <View style={[styles.viewfinder, { borderColor: theme.border, backgroundColor: '#000' }, glassStyle()]}>
              <video
                ref={videoRef}
                style={{
                  width: '100%', maxHeight: 260,
                  objectFit: 'cover', borderRadius: 14,
                  display: cameraActive && !frozen ? 'block' : 'none',
                }}
                playsInline muted
              />
              {/* Frozen frame canvas */}
              <canvas
                ref={canvasRef}
                style={{
                  display: frozen ? 'block' : 'none',
                  width: '100%', maxHeight: 260,
                  objectFit: 'cover', borderRadius: 14,
                }}
              />

              {/* Placeholder */}
              {!cameraActive && (
                <View style={styles.viewfinderPlaceholder}>
                  {/* Corner brackets */}
                  {[styles.cornerTL, styles.cornerTR, styles.cornerBL, styles.cornerBR].map((s, i) => (
                    <View key={i} style={[styles.corner, s, { borderColor: theme.primary }]} />
                  ))}
                  <Text style={[styles.viewfinderIcon, { color: theme.textTertiary }]}>⬡</Text>
                  <Text style={[styles.viewfinderHint, { color: theme.textSecondary }]}>Point at Japanese text</Text>
                </View>
              )}

              {/* Animated scan line */}
              {cameraActive && !frozen && !scanning && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    { backgroundColor: theme.primary + 'AA' },
                    { transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }] },
                  ]}
                />
              )}

              {/* Frozen badge */}
              {frozen && (
                <View style={[styles.frozenBadge, { backgroundColor: theme.warning + 'DD' }]}>
                  <Text style={styles.frozenBadgeText}>⏸ FROZEN</Text>
                </View>
              )}

              {/* OCR progress */}
              {scanning && (
                <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']} style={styles.scanningOverlay}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={styles.scanningText}>
                    {ocrProgress !== null ? `OCR ${ocrProgress}%` : 'Initialising…'}
                  </Text>
                </LinearGradient>
              )}
            </View>

            {/* Camera controls */}
            <View style={styles.camControls}>
              {!cameraActive ? (
                <TouchableOpacity
                  style={styles.startBtn}
                  onPress={() => startCamera().then(startOCR)}
                >
                  <LinearGradient colors={theme.gradientPrimary} style={styles.startBtnGrad}>
                    <Text style={styles.startBtnText}>Start Camera</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.camBtnRow}>
                  {!frozen ? (
                    <TouchableOpacity
                      style={[styles.camBtn, { backgroundColor: theme.primary, opacity: scanning ? 0.5 : 1 }]}
                      onPress={freezeAndOCR}
                      disabled={scanning}
                    >
                      <Text style={styles.camBtnText}>📸 Capture</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.camBtn, { backgroundColor: theme.success }]}
                      onPress={resumeCamera}
                    >
                      <Text style={styles.camBtnText}>▶ Resume</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.camBtn, { backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border }]}
                    onPress={stopCamera}
                  >
                    <Text style={[styles.camBtnText, { color: theme.textSecondary }]}>⏹ Stop</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Text input mode ── */}
        {mode === 'text' && (
          <View style={styles.textSection}>
            {/* Demo chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {DEMO_TEXTS.map((t, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.demoChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => setInputText(t)}
                >
                  <Text style={[styles.demoChipText, { color: theme.textSecondary }]}>{t.slice(0, 10)}…</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {Platform.OS === 'web' && (
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="今日は天気がとても良いです。"
                style={{
                  width: '100%', minHeight: 96, fontSize: 18,
                  padding: 14, borderRadius: 12,
                  border: `1.5px solid ${theme.border}`,
                  backgroundColor: theme.surface,
                  color: theme.text,
                  fontFamily: 'inherit', resize: 'none', outline: 'none',
                  boxSizing: 'border-box',
                  lineHeight: 1.6,
                }}
              />
            )}

            <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyzeText}>
              <LinearGradient colors={theme.gradientPrimary} style={styles.analyzeBtnGrad}>
                <Text style={styles.analyzeBtnText}>✦ Analyze with AI →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Furigana display (LLM output or DB fallback) ── */}
        {(sourceText || llmGenerating) && (
          <View style={[styles.furiganaCard, { backgroundColor: theme.surface, borderColor: theme.borderGlow }, glassStyle(theme.borderGlow)]}>
            <View style={styles.furiganaCardHeader}>
              <Text style={[styles.furiganaCardLabel, { color: theme.accent }]}>
                {llmGenerating ? '✦ Generating furigana…' : furiganaHtml ? '✦ AI Furigana (Qwen2.5)' : '✦ Furigana (dictionary)'}
              </Text>
              {llmGenerating && <ActivityIndicator size="small" color={theme.accent} />}
            </View>

            {llmGenerating ? (
              <View style={styles.furiganaLoading}>
                <Text style={[styles.furiganaLoadingText, { color: theme.textTertiary }]}>
                  {llmStatus === LLM_STATUS.LOADING
                    ? `Downloading Qwen2.5-0.5B… ${llmProgress}%`
                    : 'Processing…'}
                </Text>
                {llmStatus === LLM_STATUS.LOADING && (
                  <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                    <LinearGradient
                      colors={theme.gradientAccent}
                      style={[styles.progressFill, { width: `${llmProgress}%` }]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    />
                  </View>
                )}
              </View>
            ) : furiganaHtml ? (
              // LLM-generated HTML with ruby tags
              Platform.OS === 'web' ? (
                <div
                  dangerouslySetInnerHTML={{ __html: furiganaHtml }}
                  style={{
                    fontSize: 22, lineHeight: 3.2, color: theme.text,
                    fontFamily: 'inherit', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                  }}
                />
              ) : (
                <Text style={{ fontSize: 20, color: theme.text, lineHeight: 32 }}>{sourceText}</Text>
              )
            ) : (
              // Fallback: DB-based furigana from FuriganaText component
              <FuriganaText
                text={sourceText}
                fontSize={22}
                color={theme.text}
                rtColor={theme.accent}
              />
            )}
          </View>
        )}

        {/* ── Detected kanji grid ── */}
        {hasResults && (
          <View style={styles.resultsSection}>
            <Text style={[styles.resultsTitle, { color: theme.textSecondary }]}>
              {detectedKanji.length} kanji detected
            </Text>
            <View style={styles.kanjiGrid}>
              {detectedKanji.map((entry) => (
                <TouchableOpacity
                  key={entry.kanji}
                  style={[styles.kanjiTile, { backgroundColor: theme.surface, borderColor: theme.border }, glassStyle()]}
                  onPress={() => openDetail(entry)}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={theme.gradientCard} style={StyleSheet.absoluteFill} />
                  <Text style={[styles.tileKanji, { color: theme.text }]}>{entry.kanji}</Text>
                  <Text style={[styles.tileFuri, { color: theme.accent }]} numberOfLines={1}>
                    {entry.kunyomi?.[0]?.split('.')[0] || entry.onyomi?.[0] || ''}
                  </Text>
                  <Text style={[styles.tileMeaning, { color: theme.textSecondary }]} numberOfLines={1}>
                    {entry.meanings?.[0] || ''}
                  </Text>
                  {entry.jlptLevel && (
                    <View style={[styles.tileJlpt, { backgroundColor: theme.jlptColors[entry.jlptLevel] }]}>
                      <Text style={styles.tileJlptText}>{entry.jlptLevel}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Empty state ── */}
        {!hasResults && !sourceText && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyKanji, { color: theme.textTertiary }]}>漢</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {mode === 'camera' ? 'Start camera to scan text' : 'Type Japanese to analyze'}
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              Qwen2.5-0.5B runs locally on your device — no internet needed after first load
            </Text>
            <View style={styles.featurePills}>
              {['Context-aware furigana', 'Real-time OCR', 'Stroke order', '3,138 kanji'].map(f => (
                <View key={f} style={[styles.featurePill, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Text style={[styles.featurePillText, { color: theme.textSecondary }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </Animated.View>
  );
}

const TILE = (W - 56) / 4;

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerTitle:  { fontSize: 26, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.5 },
  headerSub:    { fontSize: 12, marginTop: 2, letterSpacing: 0.5 },
  llmPill:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 6 },
  llmDot:       { width: 7, height: 7, borderRadius: 4 },
  llmPillText:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  modeTabs:     { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 3 },
  modeTab:      { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  modeTabText:  { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

  cameraSection:     { paddingHorizontal: 16, paddingTop: 16 },
  viewfinder:        { borderRadius: 16, borderWidth: 1, overflow: 'hidden', minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  viewfinderPlaceholder: { alignItems: 'center', padding: 40, position: 'relative', width: '100%', aspectRatio: 16 / 9 },
  viewfinderIcon:    { fontSize: 52, marginBottom: 10 },
  viewfinderHint:    { fontSize: 14, fontWeight: '600' },
  corner:            { position: 'absolute', width: 24, height: 24, borderWidth: 2 },
  cornerTL:          { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR:          { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL:          { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR:          { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine:          { position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1 },
  frozenBadge:       { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  frozenBadgeText:   { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  scanningOverlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  scanningText:      { color: '#FFF', fontSize: 12, fontWeight: '600' },

  camControls:  { marginTop: 12 },
  startBtn:     { borderRadius: 14, overflow: 'hidden' },
  startBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  startBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  camBtnRow:    { flexDirection: 'row', gap: 10 },
  camBtn:       { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  camBtnText:   { color: '#FFF', fontSize: 14, fontWeight: '700' },

  textSection:     { paddingHorizontal: 16, paddingTop: 16 },
  demoChip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  demoChipText:    { fontSize: 12 },
  analyzeBtn:      { borderRadius: 14, overflow: 'hidden', marginTop: 12 },
  analyzeBtnGrad:  { paddingVertical: 15, alignItems: 'center' },
  analyzeBtnText:  { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  furiganaCard:       { marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, padding: 18 },
  furiganaCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  furiganaCardLabel:  { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  furiganaLoading:    { gap: 10 },
  furiganaLoadingText:{ fontSize: 13 },
  progressTrack:      { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  progressFill:       { height: '100%', borderRadius: 2 },

  resultsSection: { paddingHorizontal: 16, paddingTop: 20 },
  resultsTitle:   { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' },
  kanjiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kanjiTile:      {
    width: Math.max(TILE, 70), aspectRatio: 0.85,
    borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    padding: 6, overflow: 'hidden', position: 'relative',
  },
  tileKanji:     { fontSize: 30, fontWeight: '300' },
  tileFuri:      { fontSize: 10, marginTop: 1, textAlign: 'center' },
  tileMeaning:   { fontSize: 9, marginTop: 1, textAlign: 'center' },
  tileJlpt:      { position: 'absolute', top: 5, right: 5, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  tileJlptText:  { color: '#FFF', fontSize: 8, fontWeight: '800' },

  emptyState:    { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 30 },
  emptyKanji:    { fontSize: 72, marginBottom: 16 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyDesc:     { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  featurePills:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  featurePill:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  featurePillText:{ fontSize: 11, fontWeight: '600' },
});
