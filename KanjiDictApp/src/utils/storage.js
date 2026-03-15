import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = 'kanji_bookmarks';
const RECENT_KEY = 'kanji_recent_searches';
const SETTINGS_KEY = 'kanji_settings';

export async function getBookmarks() {
  try {
    const data = await AsyncStorage.getItem(BOOKMARKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addBookmark(kanji) {
  try {
    const bookmarks = await getBookmarks();
    if (!bookmarks.find(b => b.kanji === kanji.kanji)) {
      bookmarks.unshift({ ...kanji, bookmarkedAt: Date.now() });
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    }
    return bookmarks;
  } catch {
    return [];
  }
}

export async function removeBookmark(kanjiChar) {
  try {
    const bookmarks = await getBookmarks();
    const updated = bookmarks.filter(b => b.kanji !== kanjiChar);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function isBookmarked(kanjiChar) {
  const bookmarks = await getBookmarks();
  return bookmarks.some(b => b.kanji === kanjiChar);
}

export async function getRecentSearches() {
  try {
    const data = await AsyncStorage.getItem(RECENT_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(query) {
  try {
    const recent = await getRecentSearches();
    const updated = [query, ...recent.filter(r => r !== query)].slice(0, 20);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function clearRecentSearches() {
  await AsyncStorage.removeItem(RECENT_KEY);
}

export async function getSettings() {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { darkMode: false, fontSize: 'medium' };
  } catch {
    return { darkMode: false, fontSize: 'medium' };
  }
}

export async function saveSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
