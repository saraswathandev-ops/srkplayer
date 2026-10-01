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
import MoreScreen from "@/app/(tabs)/more";
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

  const tabBarShowLabel =
    settings.tabBarLabels === "always"
      ? true
      : settings.tabBarLabels === "never"
        ? false
        : true;

  const icons: Record<string, string> = {
    Home: "home",
    Library: "film",
    Audio: "music",
    Playlists: "list",
    More: "more-horizontal",
  };

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
          marginBottom: 3,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Feather
            name={icons[route.name] ?? "circle"}
            size={focused ? 22 : 21}
            color={color}
          />
        ),
        tabBarStyle: {
          height: Platform.OS === "android" ? 68 : 82,
          paddingTop: 7,
          paddingBottom: Platform.OS === "android" ? 8 : 22,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 10,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: "Videos", tabBarAccessibilityLabel: "Videos" }}
      />
      <Tab.Screen name="Audio" component={AudioScreen} />
      <Tab.Screen name="Playlists" component={PlaylistsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
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
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: Platform.OS === "android" ? "fade" : "default",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="TabsRoot" component={TabsRoot} />
        <Stack.Screen name="player" component={PlayerScreen} />
        <Stack.Screen name="audio-player" component={AudioPlayerScreen} />
        <Stack.Screen name="playlist" component={PlaylistScreen} />
        <Stack.Screen name="folder" component={FolderScreen} />
        <Stack.Screen name="recycle-bin" component={RecycleBinScreen} />
        <Stack.Screen name="network-stream" component={NetworkStreamScreen} />
        <Stack.Screen name="search" component={SearchScreen} />
        <Stack.Screen name="settings" component={SettingsScreen} />
        <Stack.Screen name="youtube" component={YouTubeScreen} />
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
