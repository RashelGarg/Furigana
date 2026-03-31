import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import JLPTBadge from './JLPTBadge';

export default function KanjiCard({ entry, onPress, compact = false }) {
  const { theme } = useTheme();
  if (!entry) return null;

  const primaryMeaning = entry.meanings?.[0] || '';
  const onyomiStr  = entry.onyomi?.slice(0, 2).join('、') || '';
  const kunyomiStr = entry.kunyomi?.slice(0, 2).map(r => r.split('.')[0]).join('、') || '';

  const hoverStyle = Platform.OS === 'web'
    ? { transition: 'transform 0.15s ease, box-shadow 0.15s ease' }
    : {};

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, hoverStyle]}
      onPress={() => onPress?.(entry)}
      activeOpacity={0.75}
    >
      {/* Left gradient accent stripe */}
      <LinearGradient colors={theme.gradientPrimary} style={styles.accentBar} />

      {/* Kanji box */}
      <View style={[styles.kanjiBox, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.kanji, { color: theme.text }]}>{entry.kanji}</Text>
        {entry.frequency && (
          <Text style={[styles.freq, { color: theme.textTertiary }]}>#{entry.frequency}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={[styles.meaning, { color: theme.text }]} numberOfLines={1}>
            {primaryMeaning}
          </Text>
          <JLPTBadge level={entry.jlptLevel} size="small" />
        </View>

        {!compact && (
          <View style={styles.readings}>
            {onyomiStr ? (
              <View style={[styles.readingChip, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '30' }]}>
                <Text style={[styles.readingLabel, { color: theme.primary }]}>音</Text>
                <Text style={[styles.readingText, { color: theme.textSecondary }]} numberOfLines={1}>{onyomiStr}</Text>
              </View>
            ) : null}
            {kunyomiStr ? (
              <View style={[styles.readingChip, { backgroundColor: theme.accentLight, borderColor: theme.accent + '30' }]}>
                <Text style={[styles.readingLabel, { color: theme.accent }]}>訓</Text>
                <Text style={[styles.readingText, { color: theme.textSecondary }]} numberOfLines={1}>{kunyomiStr}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.tags}>
          {entry.jouyou && (
            <View style={[styles.tag, { backgroundColor: theme.accentLight, borderColor: theme.accent + '40' }]}>
              <Text style={[styles.tagText, { color: theme.accent }]}>常用</Text>
            </View>
          )}
          {entry.jinmeiyou && (
            <View style={[styles.tag, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '40' }]}>
              <Text style={[styles.tagText, { color: theme.primary }]}>人名用</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 4,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  accentBar: { width: 3 },
  kanjiBox: {
    width: 74,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  kanji:   { fontSize: 38, fontWeight: '300' },
  freq:    { fontSize: 9, marginTop: 2 },
  info:    { flex: 1, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  meaning: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  readings:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  readingChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, gap: 4 },
  readingLabel:{ fontSize: 10, fontWeight: '800' },
  readingText: { fontSize: 11, maxWidth: 90 },
  tags:    { flexDirection: 'row', gap: 5 },
  tag:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  tagText: { fontSize: 10, fontWeight: '700' },
});
