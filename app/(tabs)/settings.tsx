import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from "@react-navigation/native";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

import React, { useEffect, useState } from "react";
import { Alert, Animated, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
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
  const { settings, updateSettings, videos, clearOldHistory } = usePlayer();
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

  const cycleSpeeds = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const index = speeds.indexOf(settings.speed);
    updateSettings({ speed: speeds[(index + 1) % speeds.length] });
  };

  const cycleSeekDuration = () => {
    const durations = [5, 10, 15, 20, 30];
    const index = durations.indexOf(settings.doubleTapSeek);
    updateSettings({ doubleTapSeek: durations[(index + 1) % durations.length] });
  };

  const cycleLoopMode = () => {
    const modes: PlayerSettings["loopMode"][] = ["none", "one", "all"];
    const index = modes.indexOf(settings.loopMode);
    updateSettings({ loopMode: modes[(index + 1) % modes.length] });
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
      themePreset:
        THEME_PRESET_OPTIONS[(index + 1) % THEME_PRESET_OPTIONS.length],
    });
  };

  const cycleSubtitleFontSize = () => {
    const index = FONT_SIZE_OPTIONS.indexOf(settings.subtitleFontSize);
    updateSettings({
      subtitleFontSize:
        FONT_SIZE_OPTIONS[(index + 1) % FONT_SIZE_OPTIONS.length],
    });
  };

  const loadStorageDiagnostics = async () => {
    const nextDiagnostics = await getStorageDiagnostics();
    setStorageDiagnostics(nextDiagnostics);
  };

  const handleClearOldHistory = () => {
    if (storageBusy) return;

    Alert.alert(
      "Clear old history?",
      `This removes watched history and resume points older than ${HISTORY_RETENTION_DAYS} days. Playlists, favorites, and your main library stay untouched.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setStorageBusy(true);
            void clearOldHistory(HISTORY_RETENTION_DAYS)
              .then(async (result) => {
                if (Platform.OS !== "web") {
                  ReactNativeHapticFeedback.trigger("notificationSuccess", { enableVibrateFallback: true });
                }

                await loadStorageDiagnostics();

                Alert.alert(
                  "History cleaned",
                  result.clearedHistoryCount > 0
                    ? `Removed stale history from ${result.clearedHistoryCount} items.`
                    : `No history older than ${HISTORY_RETENTION_DAYS} days was found.`
                );
              })
              .catch(() => {
                Alert.alert(
                  "Cleanup failed",
                  "Could not clear old history right now. Please try again."
                );
              })
              .finally(() => {
                setStorageBusy(false);
              });
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!isFocused) return;

    let cancelled = false;

    void getStorageDiagnostics()
      .then((nextDiagnostics) => {
        if (cancelled) return;
        setStorageDiagnostics(nextDiagnostics);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  const appDataLabel = storageDiagnostics
    ? formatFileSize(storageDiagnostics.totalAppBytes)
    : "...";
  const trackedLibraryLabel = storageDiagnostics
    ? `${storageDiagnostics.totalVideos} items`
    : "...";
  const staleHistoryLabel = storageBusy
    ? "Working..."
    : storageDiagnostics
      ? `${storageDiagnostics.staleHistoryCount} old`
      : "...";
  const lastCleanupLabel = storageDiagnostics?.lastCleanupAt
    ? formatDate(storageDiagnostics.lastCleanupAt)
    : "Never";

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={videos[0]?.thumbnail} />
        <ScreenHeader title="Settings" topPad={topPad} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        >
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.heroEyebrow, { color: colors.primary }]}>Personalize</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Tune the player look, controls, and playback defaults.
            </Text>
            <Text style={[styles.heroText, { color: colors.textSecondary }]}>
              Theme preset, background art, gestures, and playback behavior all live here.
            </Text>
            <View style={styles.heroMetaRow}>
              <View
                style={[
                  styles.heroMetaChip,
                  { backgroundColor: colors.backgroundTertiary, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.heroMetaLabel, { color: colors.textTertiary }]}>Theme</Text>
                <Text style={[styles.heroMetaValue, { color: colors.text }]}>
                  {settings.theme === "system"
                    ? "System"
                    : settings.theme === "light"
                      ? "Light"
                      : "Dark"}
                </Text>
              </View>
              <View
                style={[
                  styles.heroMetaChip,
                  { backgroundColor: colors.backgroundTertiary, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.heroMetaLabel, { color: colors.textTertiary }]}>Preset</Text>
                <Text style={[styles.heroMetaValue, { color: colors.text }]}>
                  {getThemePresetLabel(settings.themePreset)}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            Appearance
          </Text>
          <View style={styles.group}>
            <SettingRow
              icon={<Feather name="moon" size={18} color={colors.primary} />}
              label="App Theme"
              sublabel="Switch between system, light, and dark mode"
              right={
                <Text style={[styles.valueText, { color: colors.primary }]}>
                  {settings.theme === "system"
                    ? "System"
                    : settings.theme === "light"
                      ? "Light"
                      : "Dark"}
                </Text>
              }
              onPress={cycleTheme}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="droplet" size={18} color={colors.primary} />}
              label="Theme Preset"
              sublabel={`Cycle through ${THEME_PRESET_OPTIONS.length} presets in light and dark mode`}
              right={
                <Text style={[styles.valueText, { color: colors.primary }]}>
                  {getThemePresetLabel(settings.themePreset)}
                </Text>
              }
              onPress={cycleThemePreset}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="image" size={18} color={colors.primary} />}
              label="Background Artwork"
              sublabel="Use media artwork as a soft page background"
              right={
                <Switch
                  value={settings.backgroundArtwork}
                  onValueChange={() =>
                    updateSettings({ backgroundArtwork: !settings.backgroundArtwork })
                  }
                  trackColor={{ true: colors.primary }}
                  thumbColor="#fff"
                />
              }
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            Playback
          </Text>
          {/* <View style={styles.group}>
          <SettingRow
            icon={<Feather name="fast-forward" size={18} color={colors.primary} />}
            label="Playback Speed"
            sublabel={`Currently ${settings.speed}x`}
            right={
              <Text style={[styles.valueText, { color: colors.primary }]}>
                {settings.speed}x
              </Text>
            }
            onPress={cycleSpeeds}
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={<Feather name="repeat" size={18} color={colors.primary} />}
            label="Loop Mode"
            sublabel="Control repeat behavior"
            right={
              <Text style={[styles.valueText, { color: colors.primary }]}>
                {settings.loopMode === "none"
                  ? "Off"
                  : settings.loopMode === "one"
                    ? "One"
                    : "All"}
              </Text>
            }
            onPress={cycleLoopMode}
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={<Feather name="skip-forward" size={18} color={colors.primary} />}
            label="Seek Duration"
            sublabel="Double-tap to seek"
            right={
              <Text style={[styles.valueText, { color: colors.primary }]}>
                {settings.doubleTapSeek}s
              </Text>
            }
            onPress={cycleSeekDuration}
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={<Feather name="play-circle" size={18} color={colors.primary} />}
            label="Auto Play"
            right={
              <Switch
                value={settings.autoPlay}
                onValueChange={() => toggle("autoPlay")}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={<Feather name="music" size={18} color={colors.primary} />}
            label="Background Audio"
            sublabel="Keep video audio playing in background and on phone lock"
            right={
              <Switch
                value={settings.backgroundPlay}
                onValueChange={() => toggle("backgroundPlay")}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={<Feather name="bookmark" size={18} color={colors.primary} />}
            label="Remember Position"
            sublabel="Resume from where you left off"
            right={
              <Switch
                value={settings.rememberPosition}
                onValueChange={() => toggle("rememberPosition")}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View> */}

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            Gestures
          </Text>
          <View style={styles.group}>
            <SettingRow
              icon={<Feather name="volume-2" size={18} color={colors.accent} />}
              label="Swipe Volume"
              sublabel="Right side swipe controls volume"
              right={
                <Switch
                  value={settings.swipeVolume}
                  onValueChange={() => toggle("swipeVolume")}
                  trackColor={{ true: colors.primary }}
                  thumbColor="#fff"
                />
              }
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Ionicons name="sunny-outline" size={18} color={colors.accent} />}
              label="Swipe Brightness"
              sublabel="Left side swipe controls brightness"
              right={
                <Switch
                  value={settings.swipeBrightness}
                  onValueChange={() => toggle("swipeBrightness")}
                  trackColor={{ true: colors.primary }}
                  thumbColor="#fff"
                />
              }
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="maximize" size={18} color={colors.accent} />}
              label="Swipe Seek"
              sublabel="Horizontal swipe to seek"
              right={
                <Switch
                  value={settings.swipeSeek}
                  onValueChange={() => toggle("swipeSeek")}
                  trackColor={{ true: colors.primary }}
                  thumbColor="#fff"
                />
              }
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="maximize-2" size={18} color={colors.accent} />}
              label="Video Size"
              sublabel="Default player fit or expand mode"
              right={
                <Text style={[styles.valueText, { color: colors.primary }]}>
                  {settings.videoSizeMode === "expand"
                    ? "Expand"
                    : settings.videoSizeMode === "stretch"
                      ? "Stretch"
                      : "Fit"}
                </Text>
              }
              onPress={cycleVideoSizeMode}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            Storage
          </Text>
          <View style={styles.group}>
            <SettingRow
              icon={<Feather name="hard-drive" size={18} color={colors.warning} />}
              label="App Data"
              sublabel={
                storageDiagnostics
                  ? `SQLite uses ${formatFileSize(
                    storageDiagnostics.databaseBytes
                  )} and thumbnail cache uses ${formatFileSize(
                    storageDiagnostics.thumbnailCacheBytes
                  )}.`
                  : "Calculating SQLite database and cache usage"
              }
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{appDataLabel}</Text>}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="archive" size={18} color={colors.warning} />}
              label="SQLite Library"
              sublabel={
                storageDiagnostics
                  ? `${storageDiagnostics.playlistCount} playlists and ${formatFileSize(
                    storageDiagnostics.trackedMediaBytes
                  )} of indexed media tracked in the library.`
                  : "Reading tracked media and playlist totals"
              }
              right={
                <Text style={[styles.valueText, { color: colors.primary }]}>
                  {trackedLibraryLabel}
                </Text>
              }
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="clock" size={18} color={colors.warning} />}
              label="Watch History"
              sublabel={
                storageDiagnostics
                  ? `${storageDiagnostics.historyCount} items have playback history. Auto cleanup runs every ${storageDiagnostics.retentionDays} days. Last cleanup ${lastCleanupLabel}.`
                  : `History older than ${HISTORY_RETENTION_DAYS} days is cleaned automatically.`
              }
              right={
                <Text style={[styles.statusText, { color: colors.primary }]}>
                  {staleHistoryLabel}
                </Text>
              }
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="trash-2" size={18} color={colors.error} />}
              label="Clear Old History"
              sublabel={`Remove watched history older than ${HISTORY_RETENTION_DAYS} days without touching playlists or favorites`}
              right={
                <Text style={[styles.statusText, { color: colors.error }]}>
                  {storageBusy ? "Running..." : "Clear"}
                </Text>
              }
              onPress={handleClearOldHistory}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<Feather name="trash-2" size={18} color={colors.error} />}
              label="Recycle Bin"
              sublabel="View, restore, and permanently delete soft-deleted items"
              right={
                <Feather name="chevron-right" size={20} color={colors.textTertiary} />
              }
              onPress={() => navigation.navigate("recycle-bin")}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            Subtitles
          </Text>
          <View style={styles.group}>
            <SettingRow
              icon={
                <MaterialCommunityIcons
                  name="subtitles"
                  size={18}
                  color={colors.success}
                />
              }
              label="Default Subtitles"
              sublabel="Enable subtitles by default"
              right={
                <Switch
                  value={settings.defaultSubtitles}
                  onValueChange={() => toggle("defaultSubtitles")}
                  trackColor={{ true: colors.primary }}
                  thumbColor="#fff"
                />
              }
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={
                <MaterialCommunityIcons
                  name="format-size"
                  size={18}
                  color={colors.success}
                />
              }
              label="Subtitle Font Size"
              sublabel="Set subtitle text to small, medium, or large"
              right={
                <Text style={[styles.valueText, { color: colors.primary }]}>
                  {getFontSizeLabel(settings.subtitleFontSize)}
                </Text>
              }
              onPress={cycleSubtitleFontSize}
            />
          </View>

          <View style={[styles.versionBadge, { backgroundColor: colors.card }]}>
            <Feather name="zap" size={16} color={colors.primary} />
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>
              SKR Player | v1.0.0
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    marginBottom: 18,
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Inter_700Bold",
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  heroMetaChip: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  heroMetaLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroMetaValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
    marginTop: 24,
    paddingLeft: 4,
  },
  group: {
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
  },
  valueText: {
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
  },
  statusText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  separator: {
    height: 1,
    marginLeft: 102,
  },
  versionBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    padding: 18,
    marginTop: 32,
  },
  versionText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },

});
