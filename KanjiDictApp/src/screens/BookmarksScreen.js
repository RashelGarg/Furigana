import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import KanjiCard from '../components/KanjiCard';
import { getBookmarks, removeBookmark } from '../utils/storage';

export default function BookmarksScreen({ navigation }) {
  const { theme } = useTheme();
  const [bookmarks, setBookmarks] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getBookmarks().then(setBookmarks);
    }, [])
  );

  const handleRemove = async (kanjiChar) => {
    const updated = await removeBookmark(kanjiChar);
    setBookmarks(updated);
  };

  const openDetail = (entry) => {
    navigation.navigate('KanjiDetail', { entry });
  };

  if (bookmarks.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyKanji, { color: theme.textTertiary }]}>★</Text>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No bookmarks yet</Text>
        <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
          Save kanji from the detail view to find them here
        </Text>
        <TouchableOpacity
          style={[styles.goSearch, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('Search')}
        >
          <Text style={styles.goSearchText}>Browse Kanji →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {bookmarks.length} Saved {bookmarks.length === 1 ? 'Kanji' : 'Kanji'}
        </Text>
      </View>
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.kanji}
        renderItem={({ item }) => (
          <View style={styles.bookmarkRow}>
            <KanjiCard entry={item} onPress={openDetail} />
            <TouchableOpacity
              style={[styles.removeBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => handleRemove(item.kanji)}
            >
              <Text style={{ color: theme.primary, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyKanji: { fontSize: 72, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  goSearch: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goSearchText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  bookmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeBtn: {
    marginRight: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
