import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Platform, ScrollView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import KanjiCard from '../components/KanjiCard';
import { searchKanji, getKanjiByJLPT, getFrequentKanji } from '../utils/kanjiUtils';
import { addRecentSearch, getRecentSearches, clearRecentSearches } from '../utils/storage';

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const glassStyle = (borderColor) =>
  Platform.OS === 'web'
    ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${borderColor}` }
    : {};

export default function SearchScreen({ navigation }) {
  const { theme } = useTheme();
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [recent, setRecent]         = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [showRecent, setShowRecent] = useState(true);
  const [focused, setFocused]       = useState(false);
  const [featuredKanji]             = useState(() => getFrequentKanji(20));
  const fadeAnim                    = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    getRecentSearches().then(setRecent);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handleSearch = useCallback((text) => {
    setQuery(text);
    setActiveFilter(null);
    if (!text.trim()) { setResults([]); setShowRecent(true); return; }
    setShowRecent(false);
    setResults(searchKanji(text, 80));
    if (text.trim().length >= 1)
      addRecentSearch(text.trim()).then(setRecent);
  }, []);

  const handleJLPT = (level) => {
    if (activeFilter === level) {
      setActiveFilter(null); setResults([]); setQuery(''); setShowRecent(true);
    } else {
      setActiveFilter(level); setQuery(''); setShowRecent(false);
      setResults(getKanjiByJLPT(level, 120));
    }
  };

  const openDetail = (entry) => navigation.navigate('KanjiDetail', { entry });

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      {/* ── Header ── */}
      <LinearGradient colors={theme.gradientHero} style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <Text style={[styles.headerSub, { color: theme.textSecondary }]}>3,138 kanji · JLPT N5–N1</Text>

        {/* Search bar */}
        <View style={[
          styles.searchBar,
          { backgroundColor: focused ? theme.surface : 'rgba(255,255,255,0.07)' },
          focused && { borderColor: theme.primary },
          glassStyle(focused ? theme.primary : theme.border),
        ]}>
          <Text style={[styles.searchIcon, { color: focused ? theme.primary : theme.textTertiary }]}>◎</Text>
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Kanji, reading, or meaning…"
            placeholderTextColor={theme.textTertiary}
            value={query}
            onChangeText={handleSearch}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setShowRecent(true); setActiveFilter(null); }}>
              <Text style={[styles.clearX, { color: theme.textTertiary }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* JLPT pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={styles.jlptRow}>
          <TouchableOpacity
            style={[styles.jlptPill, !activeFilter && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            onPress={() => { setActiveFilter(null); setResults([]); setQuery(''); setShowRecent(true); }}
          >
            <Text style={[styles.jlptPillText, { color: !activeFilter ? '#FFF' : theme.textSecondary }]}>All</Text>
          </TouchableOpacity>
          {JLPT_LEVELS.map(level => (
            <TouchableOpacity
              key={level}
              style={[
                styles.jlptPill,
                {
                  borderColor: activeFilter === level ? theme.jlptColors[level] : theme.border,
                  backgroundColor: activeFilter === level ? theme.jlptColors[level] : 'rgba(255,255,255,0.04)',
                },
              ]}
              onPress={() => handleJLPT(level)}
            >
              <Text style={[styles.jlptPillText, { color: activeFilter === level ? '#FFF' : theme.textSecondary }]}>
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* ── Results / Home ── */}
      {showRecent && !activeFilter ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          {/* Recent */}
          {recent.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent</Text>
                <TouchableOpacity onPress={async () => { await clearRecentSearches(); setRecent([]); }}>
                  <Text style={[styles.sectionAction, { color: theme.primary }]}>Clear all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.recentChips}>
                {recent.slice(0, 10).map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.recentChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                    onPress={() => handleSearch(q)}
                  >
                    <Text style={[styles.recentChipText, { color: theme.textSecondary }]}>🕐 {q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Common kanji */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Common Kanji</Text>
              <Text style={[styles.sectionAction, { color: theme.textTertiary }]}>by frequency</Text>
            </View>
          </View>
          {featuredKanji.map((entry) => (
            <KanjiCard key={entry.kanji} entry={entry} onPress={openDetail} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.kanji}
          renderItem={({ item }) => <KanjiCard entry={item} onPress={openDetail} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyKanji, { color: theme.textTertiary }]}>漢字</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {query ? `No results for "${query}"` : 'No kanji found'}
              </Text>
              <Text style={[styles.emptyHint, { color: theme.textTertiary }]}>
                Try English, hiragana, katakana, or romaji
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.5 },
  headerSub:   { fontSize: 12, marginTop: 3, marginBottom: 14, letterSpacing: 0.4 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
  },
  searchIcon:  { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0, outline: 'none' },
  clearX:      { fontSize: 16, paddingLeft: 10 },

  jlptRow:    { paddingRight: 4, gap: 8, alignItems: 'center' },
  jlptPill:   { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  jlptPillText:{ fontSize: 12, fontWeight: '700' },

  section:        { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:   { fontSize: 16, fontWeight: '700' },
  sectionAction:  { fontSize: 13, fontWeight: '600' },

  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  recentChipText: { fontSize: 13 },

  empty:      { alignItems: 'center', paddingTop: 70 },
  emptyKanji: { fontSize: 64, marginBottom: 12 },
  emptyText:  { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyHint:  { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
