import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import KanjiCard from '../components/KanjiCard';
import JLPTBadge from '../components/JLPTBadge';
import { searchKanji, getKanjiByJLPT, getFrequentKanji } from '../utils/kanjiUtils';
import { addRecentSearch, getRecentSearches, clearRecentSearches } from '../utils/storage';
import { loadWordDetails, searchWords } from '../services/WordLookupService';

const JLPT_LEVELS    = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SEARCH_MODES   = ['Words', 'Kanji'];

export default function SearchScreen({ navigation }) {
  const { theme } = useTheme();

  // ── search mode ────────────────────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState('Words'); // 'Words' | 'Kanji'

  // ── shared ─────────────────────────────────────────────────────────────────
  const [query, setQuery]           = useState('');
  const [recent, setRecent]         = useState([]);
  const [showRecent, setShowRecent] = useState(true);

  // ── kanji mode ─────────────────────────────────────────────────────────────
  const [kanjiResults, setKanjiResults] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [featuredKanji] = useState(() => getFrequentKanji(20));

  // ── word mode ──────────────────────────────────────────────────────────────
  const [wordResults, setWordResults]     = useState([]);
  const [wordDetails, setWordDetails]     = useState(null);
  const [loadingWords, setLoadingWords]   = useState(false);
  const wordDetailsRef = useRef(null);

  // ── init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    getRecentSearches().then(setRecent);
  }, []);

  // Pre-load word details when Words tab first activated
  useEffect(() => {
    if (searchMode === 'Words' && !wordDetailsRef.current) {
      setLoadingWords(true);
      loadWordDetails().then(details => {
        wordDetailsRef.current = details;
        setWordDetails(details);
        setLoadingWords(false);
        // Re-run search if there's a pending query
        if (query.trim()) {
          setWordResults(searchWords(query.trim(), details, 50));
        }
      }).catch(() => setLoadingWords(false));
    }
  }, [searchMode]);

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleSearch = useCallback((text) => {
    setQuery(text);
    if (!text.trim()) {
      setKanjiResults([]);
      setWordResults([]);
      setShowRecent(true);
      return;
    }
    setShowRecent(false);

    if (searchMode === 'Kanji') {
      setKanjiResults(searchKanji(text, 60));
    } else {
      // Parallel: word DB + kanji DB for mixed results
      const wDetails = wordDetailsRef.current;
      if (wDetails) setWordResults(searchWords(text, wDetails, 50));
    }

    if (text.trim().length >= 1) {
      addRecentSearch(text.trim()).then(setRecent);
    }
  }, [searchMode]);

  // Re-run search when mode switches
  const switchMode = (mode) => {
    setSearchMode(mode);
    setActiveFilter(null);
    if (query.trim()) {
      setShowRecent(false);
      if (mode === 'Kanji') {
        setKanjiResults(searchKanji(query, 60));
      } else {
        const wDetails = wordDetailsRef.current;
        if (wDetails) setWordResults(searchWords(query, wDetails, 50));
      }
    } else {
      setShowRecent(true);
    }
  };

  const handleJLPTFilter = (level) => {
    if (activeFilter === level) {
      setActiveFilter(null);
      setKanjiResults([]);
      setQuery('');
      setShowRecent(true);
    } else {
      setActiveFilter(level);
      setQuery('');
      setShowRecent(false);
      setKanjiResults(getKanjiByJLPT(level, 100));
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

  // ── word card render ────────────────────────────────────────────────────────
  const renderWordCard = ({ item }) => (
    <View style={[styles.wordCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.wordCardHeader}>
        <Text style={[styles.wordCardWord, { color: theme.text }]}>{item.word}</Text>
        {item.common && (
          <View style={[styles.commonBadge, { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}>
            <Text style={[styles.commonBadgeText, { color: theme.primary }]}>common</Text>
          </View>
        )}
      </View>
      <Text style={[styles.wordCardReading, { color: theme.primary }]}>{item.reading}</Text>
      <Text style={[styles.wordCardMeaning, { color: theme.textSecondary }]} numberOfLines={2}>
        {(item.meanings || []).join('; ')}
      </Text>
    </View>
  );

  // ── home state ─────────────────────────────────────────────────────────────
  const HomeState = () => (
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

      {searchMode === 'Words' ? (
        <View style={styles.homeSection}>
          <Text style={[styles.homeSectionTitle, { color: theme.text }]}>Word Search</Text>
          <Text style={[styles.homeSectionSub, { color: theme.textSecondary }]}>
            Search by kanji, reading, or English meaning
          </Text>
          <View style={[styles.jmdictNote, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <Text style={[styles.jmdictNoteText, { color: theme.textSecondary }]}>
              📚 Powered by JMdict/EDICT — the same dictionary used by Shirabe Jisho
            </Text>
          </View>
          {/* Quick example chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {['行列', '今日', '東京', '天気', '勉強', '銀行', '友達', '電車'].map(w => (
              <TouchableOpacity
                key={w}
                style={[styles.exampleChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => { setQuery(w); handleSearch(w); }}
              >
                <Text style={[styles.exampleChipText, { color: theme.text }]}>{w}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <>
          <View style={styles.homeSection}>
            <Text style={[styles.homeSectionTitle, { color: theme.text }]}>Most Common Kanji</Text>
            <Text style={[styles.homeSectionSub, { color: theme.textSecondary }]}>Tap to explore</Text>
          </View>
          {featuredKanji.map(entry => (
            <KanjiCard key={entry.kanji} entry={entry} onPress={openDetail} />
          ))}
        </>
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );

  // ── results ────────────────────────────────────────────────────────────────
  const ResultsState = () => {
    if (searchMode === 'Words') {
      if (loadingWords) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading word dictionary…
            </Text>
          </View>
        );
      }
      return (
        <FlatList
          data={wordResults}
          keyExtractor={(item) => item.word}
          renderItem={renderWordCard}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyKanji, { color: theme.textTertiary }]}>言葉</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {query ? `No words found for "${query}"` : 'Search for a word'}
              </Text>
              <Text style={[styles.emptyHint, { color: theme.textTertiary }]}>
                Try kanji, hiragana, or English
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 12 }}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    // Kanji mode
    return (
      <FlatList
        data={kanjiResults}
        keyExtractor={(item) => item.kanji}
        renderItem={({ item }) => <KanjiCard entry={item} onPress={openDetail} />}
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
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Words / Kanji mode toggle */}
      <View style={[styles.modeToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {SEARCH_MODES.map(mode => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.modeTab,
              searchMode === mode && { backgroundColor: theme.primary },
            ]}
            onPress={() => switchMode(mode)}
          >
            <Text style={[
              styles.modeTabText,
              { color: searchMode === mode ? '#FFF' : theme.textSecondary },
            ]}>
              {mode === 'Words' ? '📝 Words' : '漢 Kanji'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.searchIcon, { color: theme.textTertiary }]}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={
            searchMode === 'Words'
              ? 'Search words, readings, or meanings…'
              : 'Search kanji, reading, or meaning…'
          }
          placeholderTextColor={theme.textTertiary}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => {
            setQuery('');
            setKanjiResults([]);
            setWordResults([]);
            setShowRecent(true);
            setActiveFilter(null);
          }}>
            <Text style={[styles.clearBtn, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* JLPT filter — only in Kanji mode */}
      {searchMode === 'Kanji' && (
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
            onPress={() => { setActiveFilter(null); setKanjiResults([]); setQuery(''); setShowRecent(true); }}
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
                { color: activeFilter === level ? '#FFF' : theme.textSecondary },
              ]}>{level}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {showRecent && !activeFilter ? <HomeState /> : <ResultsState />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    margin: 12,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeTabText: { fontSize: 14, fontWeight: '600' },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 6,
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

  // JLPT filters
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

  // Home
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

  // JMdict note
  jmdictNote: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  jmdictNoteText: { fontSize: 12, lineHeight: 16 },

  // Example chips
  exampleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  exampleChipText: { fontSize: 16 },

  // Word cards
  wordCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  wordCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  wordCardWord: { fontSize: 24, fontWeight: '500' },
  commonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  commonBadgeText: { fontSize: 10, fontWeight: '700' },
  wordCardReading: { fontSize: 14, marginBottom: 4, fontWeight: '500' },
  wordCardMeaning: { fontSize: 13, lineHeight: 18 },

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 16, fontSize: 14 },

  // Empty
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyKanji: { fontSize: 64, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
