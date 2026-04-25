import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from "@react-navigation/native";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

import React, { useEffect, useState } from "react";
import { Alert, Animated, Platform, ScrollView, StyleSheet, Switch, Text, View, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { SettingRow } from "@/components/settings/SettingRow";
import { PlayerSettings, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import {
  HISTORY_RETENTION_DAYS,
  getStorageDiagnostics,
  type StorageDiagnostics,
} from "@/services/storageMaintenance";
import {
  FONT_SIZE_OPTIONS,
  THEME_PRESET_OPTIONS,
  getFontSizeLabel,
  getThemePresetLabel,
} from "@/types/player";
import { formatDate, formatFileSize } from "@/utils/formatters";

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { settings, updateSettings, videos, clearOldHistory, clearMediaLibrary } = usePlayer();
  const swipeNavigation = useTabSwipeNavigation("settings");
  const [storageDiagnostics, setStorageDiagnostics] = useState<StorageDiagnostics | null>(
    null
  );
  const [storageBusy, setStorageBusy] = useState(false);

  const toggle = (key: keyof PlayerSettings) => {
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    updateSettings({ [key]: !settings[key] } as Partial<PlayerSettings>);
  };

  const cycleTabBarLabels = () => {
    const modes: PlayerSettings["tabBarLabels"][] = ["always", "active", "never"];
    const index = modes.indexOf(settings.tabBarLabels);
    updateSettings({ tabBarLabels: modes[(index + 1) % modes.length] });
  };

  const cycleSpeeds = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const index = speeds.indexOf(settings.speed);
    updateSettings({ speed: speeds[(index + 1) % speeds.length] });
  };

  const cycleVideoSizeMode = () => {
    const modes: PlayerSettings["videoSizeMode"][] = ["fit", "expand", "stretch"];
    const index = modes.indexOf(settings.videoSizeMode);
    updateSettings({ videoSizeMode: modes[(index + 1) % modes.length] });
  };

  const cycleTheme = () => {
    const modes: PlayerSettings["theme"][] = ["system", "light", "dark"];
    const index = modes.indexOf(settings.theme);
    updateSettings({ theme: modes[(index + 1) % modes.length] });
  };

  const cycleThemePreset = () => {
    const index = THEME_PRESET_OPTIONS.indexOf(settings.themePreset);
    updateSettings({
      themePreset: THEME_PRESET_OPTIONS[(index + 1) % THEME_PRESET_OPTIONS.length],
    });
  };

  const handleClearMediaLibrary = () => {
    Alert.alert(
      "Clear Media Library?",
      "This will remove ALL indexed videos and audio files from your app library. It will NOT delete the actual files from your phone's storage.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Library",
          style: "destructive",
          onPress: async () => {
            setStorageBusy(true);
            await clearMediaLibrary();
            await loadStorageDiagnostics();
            setStorageBusy(false);
            if (Platform.OS !== "web") {
              ReactNativeHapticFeedback.trigger("notificationSuccess");
            }
          }
        }
      ]
    );
  };

  const handleClearOldHistory = () => {
    if (storageBusy) return;
    Alert.alert(
      "Clear old history?",
      `This removes watched history and resume points older than ${HISTORY_RETENTION_DAYS} days.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setStorageBusy(true);
            void clearOldHistory(HISTORY_RETENTION_DAYS)
              .then(async () => {
                await loadStorageDiagnostics();
                if (Platform.OS !== "web") {
                  ReactNativeHapticFeedback.trigger("notificationSuccess");
                }
              })
              .finally(() => setStorageBusy(false));
          },
        },
      ]
    );
  };

  const loadStorageDiagnostics = async () => {
    const nextDiagnostics = await getStorageDiagnostics();
    setStorageDiagnostics(nextDiagnostics);
  };

  useEffect(() => {
    if (isFocused) loadStorageDiagnostics();
  }, [isFocused]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background }]} {...swipeNavigation.panHandlers}>
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={videos[0]?.thumbnail} />
        <ScreenHeader title="Settings" topPad={topPad} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Interface</Text>
          <View style={styles.group}>
            <SettingRow
              icon={<Feather name="moon" size={16} color={colors.primary} />}
              label="App Theme"
              sublabel="Switch light/dark/system"
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{settings.theme.toUpperCase()}</Text>}
              onPress={cycleTheme}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="droplet" size={16} color={colors.primary} />}
              label="Theme Preset"
              sublabel="Change primary color accent"
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{getThemePresetLabel(settings.themePreset)}</Text>}
              onPress={cycleThemePreset}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="layout" size={16} color={colors.primary} />}
              label="Nav Bar Labels"
              sublabel="Control tab bar text visibility"
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{settings.tabBarLabels.toUpperCase()}</Text>}
              onPress={cycleTabBarLabels}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="image" size={16} color={colors.primary} />}
              label="Background Art"
              right={
                <Switch
                  value={settings.backgroundArtwork}
                  onValueChange={() => toggle("backgroundArtwork")}
                  trackColor={{ true: colors.primary }}
                  thumbColor="#fff"
                />
              }
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Playback & Gestures</Text>
          <View style={styles.group}>
            <SettingRow
              icon={<Feather name="fast-forward" size={16} color={colors.accent} />}
              label="Default Speed"
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{settings.speed}x</Text>}
              onPress={cycleSpeeds}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="maximize" size={16} color={colors.accent} />}
              label="Video Size"
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{settings.videoSizeMode.toUpperCase()}</Text>}
              onPress={cycleVideoSizeMode}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="volume-2" size={16} color={colors.accent} />}
              label="Swipe Volume"
              right={<Switch value={settings.swipeVolume} onValueChange={() => toggle("swipeVolume")} trackColor={{ true: colors.primary }} thumbColor="#fff" />}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Ionicons name="sunny-outline" size={16} color={colors.accent} />}
              label="Swipe Brightness"
              right={<Switch value={settings.swipeBrightness} onValueChange={() => toggle("swipeBrightness")} trackColor={{ true: colors.primary }} thumbColor="#fff" />}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Media Library</Text>
          <View style={styles.group}>
            <SettingRow
              icon={<Feather name="database" size={16} color={colors.warning} />}
              label="Library Size"
              sublabel={storageDiagnostics ? `${storageDiagnostics.totalVideos} items tracked` : "..."}
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{storageDiagnostics ? formatFileSize(storageDiagnostics.trackedMediaBytes) : "..."}</Text>}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="clock" size={16} color={colors.warning} />}
              label="Watch History"
              sublabel={storageDiagnostics ? `${storageDiagnostics.historyCount} entries` : "..."}
              onPress={handleClearOldHistory}
              right={<Text style={[styles.statusText, { color: colors.error }]}>Purge</Text>}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="trash-2" size={16} color={colors.error} />}
              label="Wipe Library"
              sublabel="Clear all indexed media"
              onPress={handleClearMediaLibrary}
              right={<Text style={[styles.statusText, { color: colors.error }]}>Clear</Text>}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="trash" size={16} color={colors.error} />}
              label="Recycle Bin"
              onPress={() => navigation.navigate("recycle-bin")}
              right={<Feather name="chevron-right" size={18} color={colors.textTertiary} />}
            />
          </View>

          <View style={[styles.versionBadge, { backgroundColor: colors.card }]}>
            <Feather name="zap" size={14} color={colors.primary} />
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>SKR Player | v1.0.1</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 12 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 20,
    paddingLeft: 4,
  },
  group: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  valueText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  separator: {
    height: 1,
    marginLeft: 52,
    opacity: 0.1,
  },
  versionBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    padding: 14,
    marginTop: 24,
  },
  versionText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
