import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Share, Platform, Clipboard, Animated, Dimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import JLPTBadge from '../components/JLPTBadge';
import StrokeOrderView from '../components/StrokeOrderView';
import { addBookmark, removeBookmark, isBookmarked } from '../utils/storage';
import { searchKanji } from '../utils/kanjiUtils';

// Example sentences for common kanji (curated subset)
const EXAMPLE_SENTENCES = {
  '日': [
    { ja: '今日は天気がいいです。', furigana: 'きょうはてんきがいいです。', en: 'Today the weather is nice.' },
    { ja: '毎日日本語を勉強します。', furigana: 'まいにちにほんごをべんきょうします。', en: 'I study Japanese every day.' },
  ],
  '人': [
    { ja: 'この人は先生です。', furigana: 'このひとはせんせいです。', en: 'This person is a teacher.' },
    { ja: '日本人はとても親切です。', furigana: 'にほんじんはとてもしんせつです。', en: 'Japanese people are very kind.' },
  ],
  '本': [
    { ja: 'この本はとても面白いです。', furigana: 'このほんはとてもおもしろいです。', en: 'This book is very interesting.' },
    { ja: '日本語の本を読みます。', furigana: 'にほんごのほんをよみます。', en: 'I read a Japanese book.' },
  ],
  '大': [
    { ja: '大学で日本語を勉強しています。', furigana: 'だいがくでにほんごをべんきょうしています。', en: 'I am studying Japanese at university.' },
    { ja: 'それは大きな問題です。', furigana: 'それはおおきなもんだいです。', en: 'That is a big problem.' },
  ],
  '年': [
    { ja: '来年日本に行きます。', furigana: 'らいねんにほんにいきます。', en: 'I will go to Japan next year.' },
    { ja: '今年は何歳ですか？', furigana: 'ことしはなんさいですか？', en: 'How old are you this year?' },
  ],
};

// Common words for frequent kanji (simplified)
const COMMON_WORDS = {
  '日': ['日本 (Japan)', '毎日 (every day)', '今日 (today)', '日曜日 (Sunday)', '日記 (diary)'],
  '人': ['人間 (human)', '日本人 (Japanese person)', '大人 (adult)', '外人 (foreigner)', '一人 (one person)'],
  '本': ['日本 (Japan)', '本当 (really/truly)', '本屋 (bookstore)', '基本 (basics)', '本物 (real thing)'],
  '大': ['大学 (university)', '大人 (adult)', '大切 (important)', '偉大 (great)', '最大 (maximum)'],
  '年': ['来年 (next year)', '去年 (last year)', '今年 (this year)', '年齢 (age)', '新年 (new year)'],
  '学': ['学校 (school)', '大学 (university)', '学生 (student)', '学習 (learning)', '留学 (study abroad)'],
  '生': ['先生 (teacher)', '学生 (student)', '生活 (life/living)', '生まれ (birth)', '生命 (life)'],
  '月': ['月曜日 (Monday)', '今月 (this month)', '月見 (moon viewing)', '月刊 (monthly)', '三ヶ月 (3 months)'],
  '国': ['日本国 (Japan)', '外国 (foreign country)', '国際 (international)', '国語 (national language)', '祖国 (homeland)'],
  '会': ['会社 (company)', '社会 (society)', '国会 (parliament)', '機会 (opportunity)', '会議 (meeting)'],
};

export default function KanjiDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { entry } = route.params;
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    isBookmarked(entry.kanji).then(setBookmarked);
  }, [entry]);

  const toggleBookmark = async () => {
    if (bookmarked) {
      await removeBookmark(entry.kanji);
      setBookmarked(false);
    } else {
      await addBookmark(entry);
      setBookmarked(true);
      // Pulse animation
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  };

  const copyKanji = () => {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(entry.kanji);
    } else {
      Clipboard.setString(entry.kanji);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareKanji = () => {
    const readings = [
      ...(entry.onyomi || []),
      ...(entry.kunyomi || []),
    ].join(', ');
    const msg = `${entry.kanji} - ${entry.meanings?.[0] || ''}\nReadings: ${readings}\nJLPT: ${entry.jlptLevel || 'N/A'}`;
    Share.share({ message: msg });
  };

  const examples = EXAMPLE_SENTENCES[entry.kanji] || [];
  const commonWords = COMMON_WORDS[entry.kanji] || [];

  // Find related kanji (same JLPT level)
  const related = entry.jlptLevel
    ? searchKanji(entry.meanings?.[0]?.split(' ')[0] || '', 6).filter(k => k.kanji !== entry.kanji).slice(0, 5)
    : [];

  return (
    <View style={[styles.screenRoot, { backgroundColor: theme.background }]}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={Platform.OS !== 'web'}
    >
      {/* Hero section */}
      <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={copyKanji} style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.actionBtnText, { color: theme.text }]}>{copied ? '✓ Copied' : '⎘ Copy'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareKanji} style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.actionBtnText, { color: theme.text }]}>↗ Share</Text>
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity onPress={toggleBookmark} style={[styles.actionBtn, { backgroundColor: bookmarked ? theme.primary + '22' : theme.surfaceAlt }]}>
              <Text style={[styles.actionBtnText, { color: bookmarked ? theme.primary : theme.text }]}>
                {bookmarked ? '★ Saved' : '☆ Save'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Large kanji */}
        <Text style={[styles.mainKanji, { color: theme.text }]}>{entry.kanji}</Text>

        {/* Badges */}
        <View style={styles.badges}>
          <JLPTBadge level={entry.jlptLevel} />
          {entry.jouyou && (
            <View style={[styles.badge, { backgroundColor: theme.accentLight, borderColor: theme.accent }]}>
              <Text style={[styles.badgeText, { color: theme.accent }]}>常用漢字</Text>
            </View>
          )}
          {entry.jinmeiyou && (
            <View style={[styles.badge, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>人名用</Text>
            </View>
          )}
          {entry.frequency && (
            <View style={[styles.badge, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <Text style={[styles.badgeText, { color: theme.textSecondary }]}>Freq #{entry.frequency}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stroke Order */}
      <StrokeOrderView entry={entry} />

      {/* Readings */}
      <SectionCard title="Readings" theme={theme}>
        {entry.onyomi?.length > 0 && (
          <View style={styles.readingRow}>
            <View style={[styles.readingLabel, { backgroundColor: theme.primary + '22' }]}>
              <Text style={[styles.readingLabelText, { color: theme.primary }]}>音読み</Text>
              <Text style={[styles.readingLabelSub, { color: theme.primary }]}>On'yomi</Text>
            </View>
            <View style={styles.readingValues}>
              {entry.onyomi.map((r, i) => (
                <View key={i} style={[styles.readingChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Text style={[styles.readingText, { color: theme.text }]}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {entry.kunyomi?.length > 0 && (
          <View style={[styles.readingRow, { marginTop: 10 }]}>
            <View style={[styles.readingLabel, { backgroundColor: theme.accent + '22' }]}>
              <Text style={[styles.readingLabelText, { color: theme.accent }]}>訓読み</Text>
              <Text style={[styles.readingLabelSub, { color: theme.accent }]}>Kun'yomi</Text>
            </View>
            <View style={styles.readingValues}>
              {entry.kunyomi.map((r, i) => (
                <View key={i} style={[styles.readingChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Text style={[styles.readingText, { color: theme.text }]}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </SectionCard>

      {/* Meanings */}
      <SectionCard title="Meanings" theme={theme}>
        {entry.meanings?.map((m, i) => (
          <View key={i} style={styles.meaningRow}>
            <View style={[styles.meaningNum, { backgroundColor: theme.primary }]}>
              <Text style={styles.meaningNumText}>{i + 1}</Text>
            </View>
            <Text style={[styles.meaningText, { color: theme.text }]}>{m}</Text>
          </View>
        ))}
      </SectionCard>

      {/* Common Words */}
      {commonWords.length > 0 && (
        <SectionCard title="Common Words" theme={theme}>
          {commonWords.map((w, i) => (
            <View key={i} style={[styles.wordRow, { borderBottomColor: theme.borderLight }]}>
              <Text style={[styles.wordText, { color: theme.text }]}>{w}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* Example Sentences */}
      {examples.length > 0 && (
        <SectionCard title="Example Sentences" theme={theme}>
          {examples.map((ex, i) => (
            <View key={i} style={[styles.sentenceBox, { backgroundColor: theme.surfaceAlt, borderLeftColor: theme.primary }]}>
              <Text style={[styles.sentenceJa, { color: theme.text }]}>{ex.ja}</Text>
              <Text style={[styles.sentenceFuri, { color: theme.furigana }]}>{ex.furigana}</Text>
              <Text style={[styles.sentenceEn, { color: theme.textSecondary }]}>{ex.en}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* Unicode info */}
      <SectionCard title="Character Info" theme={theme}>
        <InfoRow label="Unicode" value={`U+${entry.unicode?.toUpperCase()}`} theme={theme} />
        {entry.radical && <InfoRow label="Radical" value={entry.radical} theme={theme} />}
        <InfoRow label="JLPT Level" value={entry.jlptLevel || '—'} theme={theme} />
        <InfoRow label="Jouyou" value={entry.jouyou ? 'Yes' : 'No'} theme={theme} />
        <InfoRow label="Frequency" value={entry.frequency ? `#${entry.frequency} of 2501` : '—'} theme={theme} />
      </SectionCard>

      <View style={{ height: 40 }} />
    </ScrollView>
    </View>
  );
}

function SectionCard({ title, children, theme }) {
  return (
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.text, borderBottomColor: theme.border }]}>
        {title}
      </Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, theme }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: theme.borderLight }]}>
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: Platform.OS === 'web'
    ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
    : { flex: 1 },
  container: { flex: 1 },
  content: { paddingBottom: 20 },
  hero: {
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  mainKanji: {
    fontSize: 96,
    fontWeight: '300',
    marginVertical: 8,
    textAlign: 'center',
    lineHeight: 110,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  section: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    padding: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    letterSpacing: 0.3,
  },
  sectionContent: { padding: 14 },
  readingRow: { flexDirection: 'row', alignItems: 'flex-start' },
  readingLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 60,
  },
  readingLabelText: { fontSize: 13, fontWeight: '700' },
  readingLabelSub: { fontSize: 9, marginTop: 1, opacity: 0.8 },
  readingValues: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  readingChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  readingText: { fontSize: 16, fontWeight: '500' },
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  meaningNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  meaningNumText: { color: '#4A3525', fontSize: 12, fontWeight: '700' },
  meaningText: { fontSize: 15, flex: 1 },
  wordRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  wordText: { fontSize: 15 },
  sentenceBox: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  sentenceJa: { fontSize: 16, fontWeight: '500', marginBottom: 3 },
  sentenceFuri: { fontSize: 12, marginBottom: 4 },
  sentenceEn: { fontSize: 13, fontStyle: 'italic' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '600' },
});

