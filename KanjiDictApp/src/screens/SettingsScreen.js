import React, { useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { getStats } from '../utils/kanjiUtils';
import { clearRecentSearches } from '../utils/storage';
import { getLLMStatus, loadLLM, LLM_STATUS } from '../services/LLMService';

const stats = getStats();

const JLPT_DATA = [
  { level: 'N5', count: 103,  desc: 'Beginner',          pct: 9  },
  { level: 'N4', count: 182,  desc: 'Elementary',         pct: 16 },
  { level: 'N3', count: 360,  desc: 'Intermediate',       pct: 31 },
  { level: 'N2', count: 415,  desc: 'Upper-Intermediate', pct: 36 },
  { level: 'N1', count: 1151, desc: 'Advanced',           pct: 100 },
];

export default function SettingsScreen() {
  const { theme, isDark, setIsDark } = useTheme();
  const [fontSize, setFontSize] = useState('medium');
  const [cleared, setCleared]   = useState(false);
  const [llmStatus, setLlmStatus] = useState(getLLMStatus());

  const clearRecent = async () => {
    await clearRecentSearches();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  const handleLoadLLM = async () => {
    setLlmStatus(LLM_STATUS.LOADING);
    await loadLLM((pct) => {});
    setLlmStatus(getLLMStatus());
  };

  const llmStatusColor = {
    [LLM_STATUS.IDLE]:    theme.textTertiary,
    [LLM_STATUS.LOADING]: theme.warning,
    [LLM_STATUS.READY]:   theme.success,
    [LLM_STATUS.ERROR]:   theme.error,
  }[llmStatus];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <LinearGradient colors={theme.gradientHero} style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.appBadge}>
          <Text style={styles.appKanji}>漢字</Text>
          <View>
            <Text style={styles.appName}>KanjiDict</Text>
            <Text style={[styles.appVersion, { color: theme.textSecondary }]}>
              v3.0 · {stats.total.toLocaleString()} kanji
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>

        {/* ── AI / LLM ── */}
        <Group title="AI Engine" theme={theme}>
          <Row label="Qwen2.5-0.5B" sublabel="Local furigana generation — runs on-device" theme={theme}>
            <View style={styles.llmStatus}>
              <View style={[styles.llmDot, { backgroundColor: llmStatusColor }]} />
              <Text style={[styles.llmStatusText, { color: llmStatusColor }]}>
                {{ idle: 'Not loaded', loading: 'Loading…', ready: 'Ready', error: 'Error' }[llmStatus]}
              </Text>
            </View>
          </Row>
          <Row label="Download Model" sublabel="~380 MB · cached in browser IndexedDB" theme={theme} last>
            <TouchableOpacity
              style={[styles.pill, { backgroundColor: llmStatus === LLM_STATUS.READY ? theme.success + '20' : theme.primary + '20', borderColor: llmStatus === LLM_STATUS.READY ? theme.success : theme.primary }]}
              onPress={handleLoadLLM}
              disabled={llmStatus === LLM_STATUS.LOADING || llmStatus === LLM_STATUS.READY}
            >
              <Text style={[styles.pillText, { color: llmStatus === LLM_STATUS.READY ? theme.success : theme.primary }]}>
                {llmStatus === LLM_STATUS.READY ? '✓ Loaded' : llmStatus === LLM_STATUS.LOADING ? 'Loading…' : 'Load Now'}
              </Text>
            </TouchableOpacity>
          </Row>
        </Group>

        {/* ── Appearance ── */}
        <Group title="Appearance" theme={theme}>
          <Row label="Dark Mode" sublabel="Midnight dark UI (recommended)" theme={theme}>
            <Switch
              value={isDark}
              onValueChange={setIsDark}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </Row>
          <Row label="Font Size" sublabel="Text size throughout the app" theme={theme} last>
            <View style={styles.fontBtns}>
              {[['S', 'small'], ['M', 'medium'], ['L', 'large']].map(([label, val]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.fontBtn, {
                    backgroundColor: fontSize === val ? theme.primary : theme.surfaceAlt,
                    borderColor:     fontSize === val ? theme.primary : theme.border,
                  }]}
                  onPress={() => setFontSize(val)}
                >
                  <Text style={[styles.fontBtnText, { color: fontSize === val ? '#FFF' : theme.textSecondary }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>
        </Group>

        {/* ── Dictionary ── */}
        <Group title="Dictionary" theme={theme}>
          <Row label="Total Kanji" theme={theme}><Val theme={theme}>{stats.total.toLocaleString()}</Val></Row>
          <Row label="JLPT Coverage" theme={theme}><Val theme={theme}>N5 – N1</Val></Row>
          <Row label="Jouyou Kanji" theme={theme}><Val theme={theme}>2,136</Val></Row>
          <Row label="OCR Engine" theme={theme}><Val theme={theme} accent>Tesseract.js</Val></Row>
          <Row label="Stroke Order" sublabel="KanjiVG — fetched online" theme={theme} last>
            <Val theme={theme} accent>Online</Val>
          </Row>
        </Group>

        {/* ── Privacy ── */}
        <Group title="Privacy" theme={theme}>
          <Row label="Clear Search History" sublabel="Removes your recent searches" theme={theme} last>
            <TouchableOpacity
              style={[styles.pill, { backgroundColor: cleared ? theme.success + '20' : theme.error + '15', borderColor: cleared ? theme.success : theme.error + '40' }]}
              onPress={clearRecent}
            >
              <Text style={[styles.pillText, { color: cleared ? theme.success : theme.error }]}>
                {cleared ? '✓ Cleared' : 'Clear'}
              </Text>
            </TouchableOpacity>
          </Row>
        </Group>

        {/* ── JLPT breakdown ── */}
        <View style={[styles.jlptCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.jlptCardTitle, { color: theme.text }]}>JLPT Breakdown</Text>
          {JLPT_DATA.map(({ level, count, desc, pct }) => (
            <View key={level} style={[styles.jlptRow, { borderBottomColor: theme.borderLight }]}>
              <View style={[styles.jlptBadge, { backgroundColor: theme.jlptColors[level] }]}>
                <Text style={styles.jlptBadgeText}>{level}</Text>
              </View>
              <Text style={[styles.jlptDesc, { color: theme.textSecondary }]}>{desc}</Text>
              <View style={[styles.jlptTrack, { backgroundColor: theme.border }]}>
                <LinearGradient
                  colors={theme.gradientPrimary}
                  style={[styles.jlptFill, { width: `${pct}%` }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={[styles.jlptCount, { color: theme.text }]}>{count}</Text>
            </View>
          ))}
        </View>

        {/* ── About ── */}
        <Group title="About" theme={theme}>
          <Row label="Data Sources" sublabel="Open-source kanji dictionaries" theme={theme} />
          <Row label="Stroke Order" sublabel="KanjiVG by Ulrich Apel (CC BY-SA 3.0)" theme={theme} />
          <Row label="AI Model" sublabel="Qwen2.5-0.5B-Instruct (Apache 2.0)" theme={theme} last />
        </Group>

      </View>
    </ScrollView>
  );
}

function Group({ title, children, theme }) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: theme.textTertiary }]}>{title.toUpperCase()}</Text>
      <View style={[styles.groupBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({ label, sublabel, theme, children, last }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {sublabel && <Text style={[styles.rowSub, { color: theme.textTertiary }]}>{sublabel}</Text>}
      </View>
      {children}
    </View>
  );
}

function Val({ children, theme, accent }) {
  return (
    <Text style={[styles.valText, { color: accent ? theme.accent : theme.textSecondary }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  header:      { paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#F1F5F9', marginBottom: 16, letterSpacing: -0.5 },
  appBadge:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 },
  appKanji:    { fontSize: 36, fontWeight: '200', color: '#F1F5F9' },
  appName:     { fontSize: 16, fontWeight: '800', color: '#F1F5F9' },
  appVersion:  { fontSize: 12, marginTop: 2 },

  content:     { padding: 16 },
  group:       { marginBottom: 20 },
  groupLabel:  { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  groupBox:    { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowLeft:     { flex: 1 },
  rowLabel:    { fontSize: 15, fontWeight: '500' },
  rowSub:      { fontSize: 12, marginTop: 2 },
  valText:     { fontSize: 14, fontWeight: '600' },

  llmStatus:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  llmDot:        { width: 8, height: 8, borderRadius: 4 },
  llmStatusText: { fontSize: 12, fontWeight: '700' },

  pill:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '700' },

  fontBtns: { flexDirection: 'row', gap: 6 },
  fontBtn:  { width: 36, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fontBtnText:{ fontSize: 12, fontWeight: '800' },

  jlptCard:      { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 20 },
  jlptCardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 14 },
  jlptRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, gap: 10 },
  jlptBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, minWidth: 34, alignItems: 'center' },
  jlptBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  jlptDesc:      { fontSize: 12, width: 108 },
  jlptTrack:     { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  jlptFill:      { height: '100%', borderRadius: 3 },
  jlptCount:     { fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' },
});
