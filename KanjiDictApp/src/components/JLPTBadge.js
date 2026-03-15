import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function JLPTBadge({ level, size = 'medium' }) {
  const { theme } = useTheme();
  if (!level) return null;

  const color = theme.jlptColors[level] || theme.textSecondary;
  const isSmall = size === 'small';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: color + '22', borderColor: color, borderWidth: 1 },
      isSmall && styles.small,
    ]}>
      <Text style={[styles.text, { color }, isSmall && styles.smallText]}>
        {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  smallText: {
    fontSize: 10,
  },
});
