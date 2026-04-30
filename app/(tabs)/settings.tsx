import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from "@react-navigation/native";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Modal, Platform, ScrollView, StyleSheet, Switch, Text, View, TouchableOpacity } from "react-native";
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
import { getCrashLogs, clearCrashLogs } from "@/services/crashManager";
import {
  FONT_SIZE_OPTIONS,
  THEME_PRESET_OPTIONS,
  getFontSizeLabel,
  getThemePresetLabel,
  type ThemePreset,
} from "@/types/player";
import { formatDate, formatFileSize } from "@/utils/formatters";
import { log } from "@/utils/logger";

const L = log('SettingsScreen');

const Clipboard = require("react-native/Libraries/Components/Clipboard/Clipboard") as {
  setString: (value: string) => void;
};

const CUSTOM_THEME_SWATCHES = [
  "#6E60FF",
  "#1E88E5",
  "#F46B45",
  "#159A6A",
  "#E34A82",
  "#D8891C",
  "#12B89A",
  "#345CFF",
  "#9A4DFF",
  "#D63852",
  "#596A80",
  "#5BC96B",
] as const;

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { settings, updateSettings, clearOldHistory, clearMediaLibrary } = usePlayer();
  const swipeNavigation = useTabSwipeNavigation("settings");
  const [storageDiagnostics, setStorageDiagnostics] = useState<StorageDiagnostics | null>(
    null
  );
  const [storageBusy, setStorageBusy] = useState(false);
  const [crashLogsVisible, setCrashLogsVisible] = useState(false);
  const [crashLogsContent, setCrashLogsContent] = useState("Loading...");
  const [crashLogsLoading, setCrashLogsLoading] = useState(false);
  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    L.info('mounted');
    return () => {
      isMountedRef.current = false;
      L.info('unmounted');
    };
  }, []);

  const toggle = (key: keyof PlayerSettings) => {
    const next = !settings[key];
    L.info('setting toggled', { key, value: next });
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    updateSettings({ [key]: next } as Partial<PlayerSettings>);
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

  const cycleAppFontSize = () => {
    const index = FONT_SIZE_OPTIONS.indexOf(settings.appFontSize);
    updateSettings({
      appFontSize: FONT_SIZE_OPTIONS[(index + 1) % FONT_SIZE_OPTIONS.length],
    });
  };

  const cycleSubtitleFontSize = () => {
    const index = FONT_SIZE_OPTIONS.indexOf(settings.subtitleFontSize);
    updateSettings({
      subtitleFontSize: FONT_SIZE_OPTIONS[(index + 1) % FONT_SIZE_OPTIONS.length],
    });
  };

  const applyThemePreset = (themePreset: ThemePreset) => {
    updateSettings({ themePreset });
  };

  const applyCustomThemeColor = (
    key: "customThemePrimary" | "customThemeAccent",
    value: string
  ) => {
    updateSettings({
      themePreset: "custom",
      [key]: value,
    } as Partial<PlayerSettings>);
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
            if (!isMountedRef.current) return;
            setStorageBusy(true);
            try {
              await clearMediaLibrary();
              if (!isMountedRef.current) return;
              await loadStorageDiagnostics();
              if (!isMountedRef.current) return;
              if (Platform.OS !== "web") {
                ReactNativeHapticFeedback.trigger("notificationSuccess");
              }
            } finally {
              if (isMountedRef.current) setStorageBusy(false);
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

  const loadCrashLogs = async () => {
    L.info('loading crash logs');
    setCrashLogsLoading(true);
    try {
      const logs = await getCrashLogs();
      L.info('crash logs loaded', { chars: logs.length });
      if (!isMountedRef.current) return;
      setCrashLogsContent(logs);
    } catch {
      if (!isMountedRef.current) return;
      setCrashLogsContent("Could not load crash logs.");
    } finally {
      if (isMountedRef.current) {
        setCrashLogsLoading(false);
      }
    }
  };

  const handleViewCrashLogs = async () => {
    setCrashLogsVisible(true);
    await loadCrashLogs();
  };

  const handleCopyCrashLogs = () => {
    Clipboard.setString(crashLogsContent);
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("notificationSuccess");
    }
    Alert.alert("Copied", "Crash logs copied to clipboard.");
  };

  const handleClearCrashLogs = () => {
    Alert.alert(
      "Clear Crash Logs?",
      "This will remove all saved crash log entries.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearCrashLogs();
            if (!isMountedRef.current) return;
            setCrashLogsContent("No crash logs found.");
            if (Platform.OS !== "web") {
              ReactNativeHapticFeedback.trigger("notificationSuccess");
            }
          }
        }
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
        <ScreenBackdrop />
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
              sublabel="Preset or custom full app colors"
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{getThemePresetLabel(settings.themePreset)}</Text>}
              onPress={() => setThemeSheetVisible(true)}
            />
            {settings.themePreset === "custom" ? (
              <>
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
                <SettingRow
                  icon={<Feather name="disc" size={16} color={settings.customThemePrimary} />}
                  label="Primary Color"
                  sublabel={settings.customThemePrimary}
                  right={<View style={[styles.colorPreview, { backgroundColor: settings.customThemePrimary }]} />}
                  onPress={() => setThemeSheetVisible(true)}
                />
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
                <SettingRow
                  icon={<Feather name="aperture" size={16} color={settings.customThemeAccent} />}
                  label="Accent Color"
                  sublabel={settings.customThemeAccent}
                  right={<View style={[styles.colorPreview, { backgroundColor: settings.customThemeAccent }]} />}
                  onPress={() => setThemeSheetVisible(true)}
                />
              </>
            ) : null}
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
              icon={<Feather name="type" size={16} color={colors.primary} />}
              label="App Font Size"
              sublabel="Scale interface text"
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{getFontSizeLabel(settings.appFontSize)}</Text>}
              onPress={cycleAppFontSize}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <SettingRow
              icon={<MaterialCommunityIcons name="subtitles-outline" size={16} color={colors.primary} />}
              label="Subtitle Font Size"
              sublabel="Default subtitle text size"
              right={<Text style={[styles.valueText, { color: colors.primary }]}>{getFontSizeLabel(settings.subtitleFontSize)}</Text>}
              onPress={cycleSubtitleFontSize}
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

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Diagnostics</Text>
          <View style={styles.group}>
            <SettingRow
              icon={<Feather name="file-text" size={16} color={colors.primary} />}
              label="Crash Logs"
              sublabel="View recent app errors"
              onPress={handleViewCrashLogs}
              right={<Feather name="chevron-right" size={18} color={colors.textTertiary} />}
            />
          </View>

          <View style={[styles.versionBadge, { backgroundColor: colors.card }]}>
            <Feather name="zap" size={14} color={colors.primary} />
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>SKR Player | v1.0.1</Text>
          </View>
          <Text style={[styles.authorText, { color: colors.textSecondary }]}>Author: Saraswathan</Text>
        </ScrollView>

        <Modal
          visible={themeSheetVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setThemeSheetVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.crashLogsSheet, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <View style={styles.crashLogsHeader}>
                <Text style={[styles.crashLogsTitle, { color: colors.text }]}>Theme Colors</Text>
                <TouchableOpacity onPress={() => setThemeSheetVisible(false)} style={styles.crashLogsCloseBtn}>
                  <Feather name="x" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.themeSectionTitle, { color: colors.textSecondary }]}>Presets</Text>
              <View style={styles.themePresetGrid}>
                {THEME_PRESET_OPTIONS.map((preset) => {
                  const isActive = settings.themePreset === preset;
                  const swatchColor =
                    preset === "custom" ? settings.customThemePrimary : CUSTOM_THEME_SWATCHES[Math.max(THEME_PRESET_OPTIONS.indexOf(preset) - 1, 0)];

                  return (
                    <TouchableOpacity
                      key={preset}
                      onPress={() => applyThemePreset(preset)}
                      style={[
                        styles.themePresetChip,
                        {
                          borderColor: isActive ? colors.primary : colors.border,
                          backgroundColor: isActive ? `${colors.primary}18` : colors.card,
                        },
                      ]}
                    >
                      <View style={[styles.themePresetSwatch, { backgroundColor: swatchColor }]} />
                      <Text style={[styles.themePresetText, { color: isActive ? colors.primary : colors.text }]}>
                        {getThemePresetLabel(preset)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.themeSectionTitle, { color: colors.textSecondary }]}>Custom Primary</Text>
              <View style={styles.themeColorGrid}>
                {CUSTOM_THEME_SWATCHES.map((color) => {
                  const isActive = settings.customThemePrimary === color;
                  return (
                    <TouchableOpacity
                      key={`primary-${color}`}
                      onPress={() => applyCustomThemeColor("customThemePrimary", color)}
                      style={[
                        styles.themeColorSwatch,
                        { backgroundColor: color, borderColor: isActive ? colors.text : "transparent" },
                      ]}
                    >
                      {isActive ? <Feather name="check" size={16} color="#fff" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.themeSectionTitle, { color: colors.textSecondary }]}>Custom Accent</Text>
              <View style={styles.themeColorGrid}>
                {[...CUSTOM_THEME_SWATCHES].reverse().map((color) => {
                  const isActive = settings.customThemeAccent === color;
                  return (
                    <TouchableOpacity
                      key={`accent-${color}`}
                      onPress={() => applyCustomThemeColor("customThemeAccent", color)}
                      style={[
                        styles.themeColorSwatch,
                        { backgroundColor: color, borderColor: isActive ? colors.text : "transparent" },
                      ]}
                    >
                      {isActive ? <Feather name="check" size={16} color="#fff" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={crashLogsVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCrashLogsVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.crashLogsSheet, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <View style={styles.crashLogsHeader}>
                <Text style={[styles.crashLogsTitle, { color: colors.text }]}>App Crash Logs</Text>
                <TouchableOpacity onPress={() => setCrashLogsVisible(false)} style={styles.crashLogsCloseBtn}>
                  <Feather name="x" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.crashLogsActions}>
                <TouchableOpacity
                  onPress={() => void loadCrashLogs()}
                  style={[styles.crashLogsActionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Feather name="rotate-cw" size={16} color={colors.text} />
                  <Text style={[styles.crashLogsActionText, { color: colors.text }]}>Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCopyCrashLogs}
                  style={[styles.crashLogsActionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Feather name="copy" size={16} color={colors.text} />
                  <Text style={[styles.crashLogsActionText, { color: colors.text }]}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleClearCrashLogs}
                  style={[styles.crashLogsActionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Feather name="trash-2" size={16} color={colors.error} />
                  <Text style={[styles.crashLogsActionText, { color: colors.error }]}>Clear</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={[styles.crashLogsScroll, { backgroundColor: colors.card, borderColor: colors.border }]}
                contentContainerStyle={styles.crashLogsScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.crashLogsText, { color: colors.textSecondary }]}>
                  {crashLogsLoading ? "Loading crash logs..." : crashLogsContent}
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
  authorText: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
    marginBottom: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  crashLogsSheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  crashLogsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  crashLogsTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  crashLogsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  crashLogsActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  crashLogsActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  crashLogsActionText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  crashLogsScroll: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
  },
  crashLogsScrollContent: {
    padding: 14,
  },
  crashLogsText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  themeSectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    marginTop: 6,
  },
  themePresetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  themePresetChip: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  themePresetSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  themePresetText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  themeColorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  themeColorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
