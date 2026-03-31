import React, { useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, Linking,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { getStats } from '../utils/kanjiUtils';
import { clearRecentSearches } from '../utils/storage';

const stats = getStats();

export default function SettingsScreen() {
  const { theme, isDark, setIsDark } = useTheme();
  const [fontSize, setFontSize] = useState('medium');
  const [cleared, setCleared] = useState(false);

  const clearRecent = async () => {
    await clearRecentSearches();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* App info */}
      <View style={[styles.appInfo, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.appName, { color: theme.text }]}>漢字辞書</Text>
        <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>Kanji Dictionary</Text>
        <Text style={[styles.appVersion, { color: theme.textTertiary }]}>v1.0.0 · {stats.total.toLocaleString()} kanji</Text>
      </View>

      {/* Appearance */}
      <SettingsGroup title="Appearance" theme={theme}>
        <SettingsRow
          label="Dark Mode"
          sublabel="Easy on the eyes at night"
          theme={theme}
          rightElement={
            <Switch
              value={isDark}
              onValueChange={setIsDark}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={theme.buttonText}
            />
          }
        />
        <SettingsRow label="Font Size" sublabel="Adjust text size throughout the app" theme={theme} last>
          <View style={styles.fontSizeButtons}>
            {['small', 'medium', 'large'].map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.fontBtn,
                  {
                    backgroundColor: fontSize === size ? theme.primary : theme.surfaceAlt,
                    borderColor: fontSize === size ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setFontSize(size)}
              >
                <Text style={[
                  styles.fontBtnText,
                  { color: fontSize === size ? theme.buttonText : theme.textSecondary }
                ]}>
                  {size === 'small' ? 'A' : size === 'medium' ? 'Aa' : 'AA'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SettingsRow>
      </SettingsGroup>

      {/* Database */}
      <SettingsGroup title="Dictionary Data" theme={theme}>
        <SettingsRow label="Total Kanji" theme={theme}>
          <Text style={[styles.valueText, { color: theme.textSecondary }]}>{stats.total.toLocaleString()}</Text>
        </SettingsRow>
        <SettingsRow label="JLPT Coverage" theme={theme}>
          <Text style={[styles.valueText, { color: theme.textSecondary }]}>N5–N1</Text>
        </SettingsRow>
        <SettingsRow label="Jouyou Kanji" theme={theme}>
          <Text style={[styles.valueText, { color: theme.textSecondary }]}>2,136</Text>
        </SettingsRow>
        <SettingsRow label="Stroke Order" sublabel="Via KanjiVG (fetched online)" theme={theme} last>
          <Text style={[styles.valueText, { color: theme.accent }]}>Online</Text>
        </SettingsRow>
      </SettingsGroup>

      {/* Privacy & Data */}
      <SettingsGroup title="Data & Privacy" theme={theme}>
        <SettingsRow label="Clear Recent Searches" sublabel="Remove your search history" theme={theme} last>
          <TouchableOpacity
            style={[styles.clearBtn, { backgroundColor: cleared ? theme.success + '22' : theme.primary + '22' }]}
            onPress={clearRecent}
          >
            <Text style={[styles.clearBtnText, { color: cleared ? theme.success : theme.primary }]}>
              {cleared ? '✓ Cleared' : 'Clear'}
            </Text>
          </TouchableOpacity>
        </SettingsRow>
      </SettingsGroup>

      {/* About */}
      <SettingsGroup title="About" theme={theme}>
        <SettingsRow label="Data Sources" sublabel="Kanji data from open-source dictionaries" theme={theme} />
        <SettingsRow label="Stroke Order" sublabel="KanjiVG by Ulrich Apel (CC BY-SA 3.0)" theme={theme} />
        <SettingsRow label="OCR Engine" sublabel="Tesseract.js" theme={theme} last />
      </SettingsGroup>

      {/* JLPT breakdown */}
      <View style={[styles.jlptCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.jlptTitle, { color: theme.text }]}>JLPT Breakdown</Text>
        {[
          { level: 'N5', count: 103, desc: 'Beginner' },
          { level: 'N4', count: 182, desc: 'Elementary' },
          { level: 'N3', count: 360, desc: 'Intermediate' },
          { level: 'N2', count: 415, desc: 'Upper-Intermediate' },
          { level: 'N1', count: 1151, desc: 'Advanced' },
        ].map(({ level, count, desc }) => (
          <View key={level} style={[styles.jlptRow, { borderBottomColor: theme.borderLight }]}>
            <View style={[styles.jlptBadge, { backgroundColor: theme.jlptColors[level] }]}>
              <Text style={styles.jlptBadgeText}>{level}</Text>
            </View>
            <Text style={[styles.jlptDesc, { color: theme.textSecondary }]}>{desc}</Text>
            <View style={styles.jlptBar}>
              <View
                style={[
                  styles.jlptBarFill,
                  {
                    backgroundColor: theme.jlptColors[level],
                    width: `${(count / 1151) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.jlptCount, { color: theme.text }]}>{count}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function SettingsGroup({ title, children, theme }) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{title.toUpperCase()}</Text>
      <View style={[styles.groupContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ label, sublabel, theme, rightElement, children, last }) {
  return (
    <View style={[
      styles.row,
      { borderBottomColor: theme.borderLight },
      !last && { borderBottomWidth: 1 },
    ]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {sublabel && <Text style={[styles.rowSublabel, { color: theme.textTertiary }]}>{sublabel}</Text>}
      </View>
      {rightElement || children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  appInfo: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  appName: { fontSize: 40, fontWeight: '300', marginBottom: 4 },
  appSubtitle: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  appVersion: { fontSize: 12, marginTop: 4 },
  group: { marginBottom: 20 },
  groupTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  groupContent: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 52,
    gap: 12,
  },
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSublabel: { fontSize: 12, marginTop: 2 },
  valueText: { fontSize: 14, fontWeight: '500' },
  clearBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  clearBtnText: { fontSize: 13, fontWeight: '600' },
  fontSizeButtons: { flexDirection: 'row', gap: 6 },
  fontBtn: {
    width: 36,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontBtnText: { fontSize: 12, fontWeight: '700' },
  jlptCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  jlptTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  jlptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  jlptBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  jlptBadgeText: { color: '#4A3525', fontSize: 11, fontWeight: '700' },
  jlptDesc: { fontSize: 12, width: 110 },
  jlptBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  jlptBarFill: { height: '100%', borderRadius: 3 },
  jlptCount: { fontSize: 12, fontWeight: '600', minWidth: 32, textAlign: 'right' },
});


