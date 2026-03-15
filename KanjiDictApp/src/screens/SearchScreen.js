import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Platform, Keyboard, ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import KanjiCard from '../components/KanjiCard';
import JLPTBadge from '../components/JLPTBadge';
import { searchKanji, getKanjiByJLPT, getFrequentKanji } from '../utils/kanjiUtils';
import { addRecentSearch, getRecentSearches, clearRecentSearches } from '../utils/storage';

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function SearchScreen({ navigation }) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [showRecent, setShowRecent] = useState(true);
  const [featuredKanji] = useState(() => getFrequentKanji(20));

  useEffect(() => {
    getRecentSearches().then(setRecent);
  }, []);

  const handleSearch = useCallback((text) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      setShowRecent(true);
      return;
    }
    setShowRecent(false);
    const found = searchKanji(text, 60);
    setResults(found);
    if (text.trim().length >= 1) {
      addRecentSearch(text.trim()).then(setRecent);
    }
  }, []);

  const handleJLPTFilter = (level) => {
    if (activeFilter === level) {
      setActiveFilter(null);
      setResults([]);
      setQuery('');
      setShowRecent(true);
    } else {
      setActiveFilter(level);
      setQuery('');
      setShowRecent(false);
      const filtered = getKanjiByJLPT(level, 100);
      setResults(filtered);
    }
  };

  const handleRecentTap = (q) => {
    setQuery(q);
    handleSearch(q);
  };

  const openDetail = (entry) => {
    navigation.navigate('KanjiDetail', { entry });
  };

  const clearRecent = async () => {
    await clearRecentSearches();
    setRecent([]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.searchIcon, { color: theme.textTertiary }]}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search kanji, reading, or meaning..."
          placeholderTextColor={theme.textTertiary}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setShowRecent(true); setActiveFilter(null); }}>
            <Text style={[styles.clearBtn, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* JLPT Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            { borderColor: theme.border, backgroundColor: !activeFilter ? theme.primary : theme.surface },
          ]}
          onPress={() => { setActiveFilter(null); setResults([]); setQuery(''); setShowRecent(true); }}
        >
          <Text style={[styles.filterTabText, { color: !activeFilter ? '#FFF' : theme.textSecondary }]}>All</Text>
        </TouchableOpacity>
        {JLPT_LEVELS.map(level => (
          <TouchableOpacity
            key={level}
            style={[
              styles.filterTab,
              {
                borderColor: activeFilter === level ? theme.jlptColors[level] : theme.border,
                backgroundColor: activeFilter === level ? theme.jlptColors[level] : theme.surface,
              },
            ]}
            onPress={() => handleJLPTFilter(level)}
          >
            <Text style={[
              styles.filterTabText,
              { color: activeFilter === level ? '#FFF' : theme.textSecondary }
            ]}>{level}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results or home state */}
      {showRecent && !activeFilter ? (
        <ScrollView style={styles.homeScroll} showsVerticalScrollIndicator={false}>
          {/* Recent searches */}
          {recent.length > 0 && (
            <View style={styles.homeSection}>
              <View style={styles.homeSectionHeader}>
                <Text style={[styles.homeSectionTitle, { color: theme.text }]}>Recent Searches</Text>
                <TouchableOpacity onPress={clearRecent}>
                  <Text style={[styles.clearAllText, { color: theme.primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.recentChips, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {recent.slice(0, 10).map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.recentChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                    onPress={() => handleRecentTap(q)}
                  >
                    <Text style={[styles.recentChipText, { color: theme.text }]}>🕐 {q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Featured kanji */}
          <View style={styles.homeSection}>
            <Text style={[styles.homeSectionTitle, { color: theme.text }]}>Most Common Kanji</Text>
            <Text style={[styles.homeSectionSub, { color: theme.textSecondary }]}>Tap to explore</Text>
          </View>
          {featuredKanji.map((entry) => (
            <KanjiCard key={entry.kanji} entry={entry} onPress={openDetail} />
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.kanji}
          renderItem={({ item }) => (
            <KanjiCard entry={item} onPress={openDetail} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyKanji, { color: theme.textTertiary }]}>漢字</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {query ? `No results for "${query}"` : 'No kanji found'}
              </Text>
              <Text style={[styles.emptyHint, { color: theme.textTertiary }]}>
                Try searching in English, Japanese, or romaji
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 2,
    outline: 'none',
  },
  clearBtn: { fontSize: 18, paddingLeft: 8, paddingRight: 2 },
  filterScroll: { maxHeight: 44 },
  filterContainer: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabText: { fontSize: 13, fontWeight: '600' },
  homeScroll: { flex: 1 },
  homeSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  homeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeSectionTitle: { fontSize: 17, fontWeight: '700' },
  homeSectionSub: { fontSize: 13, marginTop: 2 },
  clearAllText: { fontSize: 14, fontWeight: '600' },
  recentChips: { borderRadius: 12, borderWidth: 1, padding: 12 },
  recentChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  recentChipText: { fontSize: 14 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyKanji: { fontSize: 64, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
