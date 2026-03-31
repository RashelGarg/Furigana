import React from 'react';
import { StatusBar, Platform, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

import CameraScreen    from './src/screens/CameraScreen';
import SearchScreen    from './src/screens/SearchScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import SettingsScreen  from './src/screens/SettingsScreen';
import KanjiDetailScreen from './src/screens/KanjiDetailScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// Modern SVG-style tab icons (emoji, universally supported)
const TABS = [
  { name: 'Camera',    label: 'Scan',     icon: '⬡',  activeIcon: '⬡'  },
  { name: 'Search',    label: 'Search',   icon: '◎',  activeIcon: '◎'  },
  { name: 'Bookmarks', label: 'Saved',    icon: '◈',  activeIcon: '◈'  },
  { name: 'Settings',  label: 'Settings', icon: '◉',  activeIcon: '◉'  },
];

function TabIcon({ name, focused, color }) {
  const tab = TABS.find(t => t.name === name);
  const label = focused ? tab?.activeIcon : tab?.icon;

  if (Platform.OS === 'web') {
    return (
      <span style={{
        fontSize: 18,
        lineHeight: 1,
        color,
        filter: focused ? `drop-shadow(0 0 6px ${color})` : 'none',
        transition: 'all 0.2s ease',
      }}>
        {label}
      </span>
    );
  }
  return <Text style={{ fontSize: 18, color }}>{label}</Text>;
}

function MainTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: Platform.OS === 'web' ? {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
          backdropFilter: 'blur(20px)',
        } : {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarActiveTintColor:   theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.5,
          marginTop: 2,
        },
      })}
    >
      {TABS.map(t => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={
            t.name === 'Camera'    ? CameraScreen    :
            t.name === 'Search'    ? SearchScreen    :
            t.name === 'Bookmarks' ? BookmarksScreen :
            SettingsScreen
          }
          options={{ tabBarLabel: t.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <NavigationContainer>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.background}
      />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
            shadowOpacity: 0,
            elevation: 0,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          },
          headerTintColor:      theme.primary,
          headerTitleStyle:     { color: theme.text, fontSize: 16, fontWeight: '700' },
          cardStyle:            { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="KanjiDetail"
          component={KanjiDetailScreen}
          options={({ route }) => ({
            title: route.params?.entry?.kanji
              ? `${route.params.entry.kanji}  —  Details`
              : 'Kanji Detail',
            headerBackTitle: 'Back',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
