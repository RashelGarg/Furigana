import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Share, Platform, Clipboard, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import JLPTBadge from '../components/JLPTBadge';
import StrokeOrderView from '../components/StrokeOrderView';
import { addBookmark, removeBookmark, isBookmarked } from '../utils/storage';
import { searchKanji } from '../utils/kanjiUtils';

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
  ],
  '大': [
    { ja: '大学で日本語を勉強しています。', furigana: 'だいがくでにほんごをべんきょうしています。', en: 'I study Japanese at university.' },
  ],
  '年': [
    { ja: '来年日本に行きます。', furigana: 'らいねんにほんにいきます。', en: 'I will go to Japan next year.' },
  ],
};

const COMMON_WORDS = {
  '日': ['日本 (Japan)', '毎日 (every day)', '今日 (today)', '日曜日 (Sunday)', '日記 (diary)'],
  '人': ['人間 (human)', '日本人 (Japanese person)', '大人 (adult)', '外人 (foreigner)', '一人 (one person)'],
  '本': ['日本 (Japan)', '本当 (really)', '本屋 (bookstore)', '基本 (basics)', '本物 (real thing)'],
  '大': ['大学 (university)', '大人 (adult)', '大切 (important)', '偉大 (great)', '最大 (maximum)'],
  '年': ['来年 (next year)', '去年 (last year)', '今年 (this year)', '年齢 (age)', '新年 (new year)'],
  '学': ['学校 (school)', '大学 (university)', '学生 (student)', '学習 (learning)', '留学 (study abroad)'],
  '生': ['先生 (teacher)', '学生 (student)', '生活 (life)', '生まれ (birth)', '生命 (life force)'],
  '月': ['月曜日 (Monday)', '今月 (this month)', '月見 (moon viewing)', '三ヶ月 (3 months)'],
  '国': ['日本国 (Japan)', '外国 (foreign country)', '国際 (international)', '国語 (national language)'],
  '会': ['会社 (company)', '社会 (society)', '国会 (parliament)', '機会 (opportunity)', '会議 (meeting)'],
};

export default function KanjiDetailScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { entry }  = route.params;
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied]         = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => { isBookmarked(entry.kanji).then(setBookmarked); }, [entry]);

  const toggleBookmark = async () => {
    if (bookmarked) {
      await removeBookmark(entry.kanji); setBookmarked(false);
    } else {
      await addBookmark(entry); setBookmarked(true);
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.35, duration: 140, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 140, useNativeDriver: true }),
      ]).start();
    }
  };

  const copyKanji = () => {
    if (Platform.OS === 'web') navigator.clipboard?.writeText(entry.kanji);
    else Clipboard.setString(entry.kanji);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareKanji = () => {
    const readings = [...(entry.onyomi || []), ...(entry.kunyomi || [])].join(', ');
    Share.share({ message: `${entry.kanji} — ${entry.meanings?.[0] || ''}\nReadings: ${readings}\nJLPT: ${entry.jlptLevel || 'N/A'}` });
  };

  const examples    = EXAMPLE_SENTENCES[entry.kanji] || [];
  const commonWords = COMMON_WORDS[entry.kanji] || [];
  const related     = entry.jlptLevel
    ? searchKanji(entry.meanings?.[0]?.split(' ')[0] || '', 6).filter(k => k.kanji !== entry.kanji).slice(0, 5)
    : [];

  const screenRoot = Platform.OS === 'web'
    ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.background }
    : { flex: 1, backgroundColor: theme.background };

  return (
    <View style={screenRoot}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <LinearGradient colors={theme.gradientHero} style={styles.hero}>
          {/* Action bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={copyKanji}
            >
              <Text style={[styles.actionBtnText, { color: copied ? theme.success : theme.textSecondary }]}>
                {copied ? '✓ Copied' : '⎘ Copy'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={shareKanji}
            >
              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>↗ Share</Text>
            </TouchableOpacity>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.actionBtn, {
                  backgroundColor: bookmarked ? theme.primary + '30' : 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: bookmarked ? theme.primary : 'transparent',
                }]}
                onPress={toggleBookmark}
              >
                <Text style={[styles.actionBtnText, { color: bookmarked ? theme.primary : theme.textSecondary }]}>
                  {bookmarked ? '★ Saved' : '☆ Save'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Big kanji */}
          <Text style={styles.mainKanji}>{entry.kanji}</Text>

          {/* Primary meaning */}
          {entry.meanings?.[0] && (
            <Text style={[styles.primaryMeaning, { color: theme.textSecondary }]}>
              {entry.meanings[0]}
            </Text>
          )}

          {/* Badges */}
          <View style={styles.badges}>
            <JLPTBadge level={entry.jlptLevel} />
            {entry.jouyou && (
              <View style={[styles.badge, { backgroundColor: theme.accentLight, borderColor: theme.accent + '50' }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>常用</Text>
              </View>
            )}
            {entry.jinmeiyou && (
              <View style={[styles.badge, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '50' }]}>
                <Text style={[styles.badgeText, { color: theme.primary }]}>人名用</Text>
              </View>
            )}
            {entry.frequency && (
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: theme.border }]}>
                <Text style={[styles.badgeText, { color: theme.textSecondary }]}>Freq #{entry.frequency}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ── Stroke Order ── */}
        <StrokeOrderView entry={entry} />

        {/* ── Readings ── */}
        <Card theme={theme} title="Readings">
          {entry.onyomi?.length > 0 && (
            <View style={styles.readingBlock}>
              <View style={[styles.readingTag, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.readingTagLabel, { color: theme.primary }]}>音</Text>
                <Text style={[styles.readingTagSub, { color: theme.primary }]}>On'yomi</Text>
              </View>
              <View style={styles.chips}>
                {entry.onyomi.map((r, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                    <Text style={[styles.chipText, { color: theme.text }]}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {entry.kunyomi?.length > 0 && (
            <View style={[styles.readingBlock, { marginTop: 12 }]}>
              <View style={[styles.readingTag, { backgroundColor: theme.accentLight }]}>
                <Text style={[styles.readingTagLabel, { color: theme.accent }]}>訓</Text>
                <Text style={[styles.readingTagSub, { color: theme.accent }]}>Kun'yomi</Text>
              </View>
              <View style={styles.chips}>
                {entry.kunyomi.map((r, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                    <Text style={[styles.chipText, { color: theme.text }]}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* ── Meanings ── */}
        <Card theme={theme} title="Meanings">
          {entry.meanings?.map((m, i) => (
            <View key={i} style={styles.meaningRow}>
              <LinearGradient colors={theme.gradientPrimary} style={styles.meaningNum}>
                <Text style={styles.meaningNumText}>{i + 1}</Text>
              </LinearGradient>
              <Text style={[styles.meaningText, { color: theme.text }]}>{m}</Text>
            </View>
          ))}
        </Card>

        {/* ── Common Words ── */}
        {commonWords.length > 0 && (
          <Card theme={theme} title="Common Words">
            {commonWords.map((w, i) => (
              <View key={i} style={[styles.wordRow, { borderBottomColor: theme.borderLight }]}>
                <Text style={[styles.wordText, { color: theme.text }]}>{w}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── Example Sentences ── */}
        {examples.length > 0 && (
          <Card theme={theme} title="Example Sentences">
            {examples.map((ex, i) => (
              <View key={i} style={[styles.sentenceBox, { backgroundColor: theme.surfaceAlt, borderLeftColor: theme.primary }]}>
                <Text style={[styles.sentenceJa, { color: theme.text }]}>{ex.ja}</Text>
                <Text style={[styles.sentenceFuri, { color: theme.accent }]}>{ex.furigana}</Text>
                <Text style={[styles.sentenceEn, { color: theme.textSecondary }]}>{ex.en}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── Character Info ── */}
        <Card theme={theme} title="Character Info">
          <InfoRow label="Unicode"   value={`U+${entry.unicode?.toUpperCase()}`} theme={theme} />
          {entry.radical && <InfoRow label="Radical" value={entry.radical} theme={theme} />}
          <InfoRow label="JLPT"      value={entry.jlptLevel || '—'} theme={theme} />
          <InfoRow label="Jouyou"    value={entry.jouyou ? 'Yes' : 'No'} theme={theme} />
          <InfoRow label="Frequency" value={entry.frequency ? `#${entry.frequency} of 2501` : '—'} theme={theme} last />
        </Card>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, children, theme }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, theme, last }) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}>
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero:           { paddingTop: 24, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  actionBar:      { flexDirection: 'row', gap: 8, marginBottom: 20, alignSelf: 'stretch', justifyContent: 'flex-end' },
  actionBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  actionBtnText:  { fontSize: 13, fontWeight: '700' },
  mainKanji:      { fontSize: 110, fontWeight: '200', color: '#F1F5F9', lineHeight: 120, textAlign: 'center' },
  primaryMeaning: { fontSize: 18, fontWeight: '500', marginTop: 4, marginBottom: 14, textAlign: 'center' },
  badges:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 },
  badge:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText:      { fontSize: 11, fontWeight: '700' },

  card:           { marginHorizontal: 16, marginVertical: 6, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardHeader:     { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  cardTitle:      { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.7 },
  cardBody:       { paddingHorizontal: 18, paddingBottom: 16 },

  readingBlock:   { flexDirection: 'row', alignItems: 'flex-start' },
  readingTag:     { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, marginRight: 12, alignItems: 'center', minWidth: 52 },
  readingTagLabel:{ fontSize: 16, fontWeight: '800' },
  readingTagSub:  { fontSize: 9, marginTop: 1, fontWeight: '600' },
  chips:          { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  chipText:       { fontSize: 17, fontWeight: '500' },

  meaningRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  meaningNum:     { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  meaningNumText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  meaningText:    { fontSize: 15, flex: 1 },

  wordRow:        { paddingVertical: 9, borderBottomWidth: 1 },
  wordText:       { fontSize: 15 },

  sentenceBox:    { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 12, borderRadius: 6, marginBottom: 12 },
  sentenceJa:     { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  sentenceFuri:   { fontSize: 12, marginBottom: 5 },
  sentenceEn:     { fontSize: 13, fontStyle: 'italic' },

  infoRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  infoLabel:      { fontSize: 13 },
  infoValue:      { fontSize: 13, fontWeight: '600' },
});
