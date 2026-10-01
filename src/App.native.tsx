import Feather from "react-native-vector-icons/Feather";
import React, { useMemo } from "react";
import { Platform } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "@/app/(tabs)/index";
import LibraryScreen from "@/app/(tabs)/library";
import AudioScreen from "@/app/(tabs)/audio";
import PlaylistsScreen from "@/app/(tabs)/playlists";
import SearchScreen from "@/app/(tabs)/search";
import SettingsScreen from "@/app/(tabs)/settings";
import YouTubeScreen from "@/app/(tabs)/youtube";
import AudioPlayerScreen from "@/app/audio-player";
import FolderScreen from "@/app/folder/[id]";
import NetworkStreamScreen from "@/app/network-stream";
import PlayerScreen from "@/app/player";
import PlaylistScreen from "@/app/playlist/[id]";
import RecycleBinScreen from "@/app/recycle-bin";
import { AppProviders } from "@/components/providers/AppProviders";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabsRoot() {
  const { colors } = useAppTheme();
  const { settings } = usePlayer();

  const tabBarLabelBehavior =
    settings.tabBarLabels === "always"
      ? true
      : settings.tabBarLabels === "never"
        ? false
        : undefined;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarShowLabel: tabBarLabelBehavior,
        tabBarIcon: ({ color, size, focused }) => {
          const base = focused ? size : size - 1;
          const icons: Record<string, string> = {
            Home: "home",
            Library: "film",
            Audio: "music",
            Playlists: "list",
            Search: "search",
            Settings: "settings",
            YouTube: "play-circle",
          };
          return <Feather name={icons[route.name] ?? "circle"} size={base} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Audio" component={AudioScreen} />
      <Tab.Screen name="Playlists" component={PlaylistsScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="YouTube" component={YouTubeScreen} />
    </Tab.Navigator>
  );
}

function AppNavigation() {
  const { colors, isDark } = useAppTheme();

  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: isDark,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    }),
    [colors, isDark]
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: Platform.OS === "android" ? "fade" : "default" }}>
        <Stack.Screen name="TabsRoot" component={TabsRoot} />
        <Stack.Screen name="player" component={PlayerScreen} />
        <Stack.Screen name="audio-player" component={AudioPlayerScreen} />
        <Stack.Screen name="playlist" component={PlaylistScreen} />
        <Stack.Screen name="folder" component={FolderScreen} />
        <Stack.Screen name="recycle-bin" component={RecycleBinScreen} />
        <Stack.Screen name="network-stream" component={NetworkStreamScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppNavigation />
    </AppProviders>
  );
}
