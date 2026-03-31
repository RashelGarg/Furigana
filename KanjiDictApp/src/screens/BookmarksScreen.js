import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { getBookmarks, removeBookmark } from '../utils/storage';
import JLPTBadge from '../components/JLPTBadge';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 48) / 2;

export default function BookmarksScreen({ navigation }) {
  const { theme }    = useTheme();
  const [bookmarks, setBookmarks] = useState([]);
  const fadeAnim     = useState(() => new Animated.Value(0))[0];

  useFocusEffect(
    useCallback(() => {
      getBookmarks().then(data => {
        setBookmarks(data);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, [])
  );

  const handleRemove = async (kanji) => {
    const updated = await removeBookmark(kanji);
    setBookmarks(updated);
  };

  const openDetail = (entry) => navigation.navigate('KanjiDetail', { entry });

  if (bookmarks.length === 0) {
    return (
      <Animated.View style={[styles.empty, { backgroundColor: theme.background, opacity: fadeAnim }]}>
        <LinearGradient colors={theme.gradientHero} style={styles.emptyHeader}>
          <Text style={styles.screenTitle}>Saved</Text>
        </LinearGradient>
        <View style={styles.emptyBody}>
          <Text style={[styles.emptyIcon, { color: theme.textTertiary }]}>◈</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing saved yet</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Tap ☆ Save on any kanji detail page to bookmark it here
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate('Search')}
          >
            <LinearGradient colors={theme.gradientPrimary} style={styles.browseBtnGrad}>
              <Text style={styles.browseBtnText}>Browse Kanji →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      <LinearGradient colors={theme.gradientHero} style={styles.header}>
        <Text style={styles.screenTitle}>Saved</Text>
        <Text style={[styles.headerCount, { color: theme.textSecondary }]}>
          {bookmarks.length} {bookmarks.length === 1 ? 'kanji' : 'kanji'}
        </Text>
      </LinearGradient>

      <FlatList
        data={bookmarks}
        keyExtractor={item => item.kanji}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <BookmarkCard
            entry={item}
            theme={theme}
            onPress={() => openDetail(item)}
            onRemove={() => handleRemove(item.kanji)}
          />
        )}
      />
    </Animated.View>
  );
}

function BookmarkCard({ entry, theme, onPress, onRemove }) {
  return (
    <TouchableOpacity style={[styles.card, { borderColor: theme.border }]} onPress={onPress} activeOpacity={0.75}>
      <LinearGradient colors={theme.gradientCard} style={StyleSheet.absoluteFill} />

      {/* Remove button */}
      <TouchableOpacity style={[styles.removeBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Kanji */}
      <Text style={[styles.cardKanji, { color: theme.text }]}>{entry.kanji}</Text>

      {/* Kunyomi */}
      {(entry.kunyomi?.[0] || entry.onyomi?.[0]) && (
        <Text style={[styles.cardFuri, { color: theme.accent }]} numberOfLines={1}>
          {entry.kunyomi?.[0]?.split('.')[0] || entry.onyomi?.[0]}
        </Text>
      )}

      {/* Meaning */}
      <Text style={[styles.cardMeaning, { color: theme.textSecondary }]} numberOfLines={2}>
        {entry.meanings?.[0] || '—'}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <JLPTBadge level={entry.jlptLevel} />
        {entry.frequency && (
          <Text style={[styles.freqText, { color: theme.textTertiary }]}>#{entry.frequency}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header:    { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20 },
  screenTitle:{ fontSize: 28, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.5 },
  headerCount:{ fontSize: 13, marginTop: 4 },

  grid:  { padding: 16, paddingTop: 12, gap: 12 },
  row:   { gap: 12 },

  card: {
    width: CARD_W, borderRadius: 18, borderWidth: 1,
    padding: 16, overflow: 'hidden', minHeight: 160,
    justifyContent: 'space-between',
  },
  removeBtn:     { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  cardKanji:     { fontSize: 52, fontWeight: '200', lineHeight: 60 },
  cardFuri:      { fontSize: 13, fontWeight: '600', marginTop: 2 },
  cardMeaning:   { fontSize: 12, marginTop: 4, lineHeight: 17 },
  cardFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  freqText:      { fontSize: 11 },

  empty:       { flex: 1 },
  emptyHeader: { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20 },
  emptyBody:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:   { fontSize: 72, marginBottom: 16 },
  emptyTitle:  { fontSize: 22, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  emptySub:    { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  browseBtn:   { borderRadius: 14, overflow: 'hidden' },
  browseBtnGrad:{ paddingHorizontal: 28, paddingVertical: 14 },
  browseBtnText:{ color: '#FFF', fontSize: 15, fontWeight: '800' },
});
