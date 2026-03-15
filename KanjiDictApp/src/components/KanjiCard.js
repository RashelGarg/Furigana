import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import JLPTBadge from './JLPTBadge';

export default function KanjiCard({ entry, onPress, compact = false }) {
  const { theme } = useTheme();

  if (!entry) return null;

  const primaryMeaning = entry.meanings?.[0] || '';
  const onyomiStr = entry.onyomi?.slice(0, 2).join('、') || '';
  const kunyomiStr = entry.kunyomi?.slice(0, 2).join('、') || '';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
        compact && styles.compact,
      ]}
      onPress={() => onPress?.(entry)}
      activeOpacity={0.7}
    >
      {/* Kanji character */}
      <View style={[styles.kanjiBox, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.kanji, { color: theme.text }]}>{entry.kanji}</Text>
        {entry.frequency && (
          <Text style={[styles.freq, { color: theme.textTertiary }]}>#{entry.frequency}</Text>
        )}
      </View>

      {/* Info section */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={[styles.meaning, { color: theme.text }]} numberOfLines={1}>
            {primaryMeaning}
          </Text>
          <JLPTBadge level={entry.jlptLevel} size="small" />
        </View>

        {!compact && (
          <>
            {onyomiStr ? (
              <Text style={[styles.reading, { color: theme.textSecondary }]} numberOfLines={1}>
                音: {onyomiStr}
              </Text>
            ) : null}
            {kunyomiStr ? (
              <Text style={[styles.reading, { color: theme.textSecondary }]} numberOfLines={1}>
                訓: {kunyomiStr}
              </Text>
            ) : null}
          </>
        )}

        <View style={styles.tags}>
          {entry.jouyou && (
            <View style={[styles.tag, { backgroundColor: theme.accentLight }]}>
              <Text style={[styles.tagText, { color: theme.accent }]}>常用</Text>
            </View>
          )}
          {entry.jinmeiyou && (
            <View style={[styles.tag, { backgroundColor: theme.primaryLight }]}>
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
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  compact: {
    marginVertical: 2,
    marginHorizontal: 8,
  },
  kanjiBox: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  kanji: {
    fontSize: 36,
    fontWeight: '400',
  },
  freq: {
    fontSize: 9,
    marginTop: 2,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  meaning: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  reading: {
    fontSize: 12,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
