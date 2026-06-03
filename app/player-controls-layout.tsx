import Feather from "react-native-vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { QUICK_ACTION_KEYS, QUICK_ACTION_LABELS } from "@/types/player";

/**
 * Player Controls Layout editor.
 *
 * Lets the user reorder and show/hide the player's quick-action control icons.
 * The chosen order/visibility is persisted in PlayerSettings
 * (`quickActionOrder` / `hiddenQuickActions`) and applied in
 * `components/VideoPlayerControls.tsx` (`mxQuickItems`).
 */
export default function PlayerControlsLayoutScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = usePlayer();

  // Merge the saved order with the canonical key set so newly-added controls
  // (not yet in a user's saved order) still appear, at the end.
  const orderedKeys = useMemo(() => {
    const saved = (settings.quickActionOrder ?? []).filter((k) =>
      (QUICK_ACTION_KEYS as readonly string[]).includes(k)
    );
    const missing = QUICK_ACTION_KEYS.filter((k) => !saved.includes(k));
    return [...saved, ...missing];
  }, [settings.quickActionOrder]);

  const hidden = useMemo(
    () => new Set(settings.hiddenQuickActions ?? []),
    [settings.hiddenQuickActions]
  );

  const persistOrder = (next: string[]) => {
    void updateSettings({ quickActionOrder: next });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedKeys.length) return;
    const next = [...orderedKeys];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  };

  const toggleHidden = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    void updateSettings({ hiddenQuickActions: Array.from(next) });
  };

  const resetLayout = () => {
    void updateSettings({
      quickActionOrder: [...QUICK_ACTION_KEYS],
      hiddenQuickActions: [],
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.headerBtn,
            { backgroundColor: pressed ? colors.backgroundTertiary : "transparent" },
          ]}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </Pressable>
      </View>
      <ScreenHeader
        title="Control Layout"
        topPad={0}
        right={
          <Pressable
            onPress={resetLayout}
            style={({ pressed }) => [styles.resetBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.resetText, { color: colors.primary }]}>Reset</Text>
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Reorder and show/hide the control icons shown in the player. The order here is the order
          they appear in the player's control bar.
        </Text>

        <View style={[styles.group, { backgroundColor: colors.backgroundSecondary }]}>
          {orderedKeys.map((key, index) => {
            const isHidden = hidden.has(key);
            return (
              <View key={key}>
                {index > 0 ? (
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                ) : null}
                <View style={styles.row}>
                  <View style={styles.reorderCol}>
                    <Pressable
                      onPress={() => move(index, -1)}
                      disabled={index === 0}
                      style={({ pressed }) => [
                        styles.reorderBtn,
                        { opacity: index === 0 ? 0.25 : pressed ? 0.6 : 1 },
                      ]}
                      hitSlop={6}
                    >
                      <Feather name="chevron-up" size={20} color={colors.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => move(index, 1)}
                      disabled={index === orderedKeys.length - 1}
                      style={({ pressed }) => [
                        styles.reorderBtn,
                        {
                          opacity:
                            index === orderedKeys.length - 1 ? 0.25 : pressed ? 0.6 : 1,
                        },
                      ]}
                      hitSlop={6}
                    >
                      <Feather name="chevron-down" size={20} color={colors.text} />
                    </Pressable>
                  </View>
                  <Text
                    style={[
                      styles.label,
                      { color: isHidden ? colors.textTertiary : colors.text },
                    ]}
                  >
                    {QUICK_ACTION_LABELS[key] ?? key}
                  </Text>
                  <Switch
                    value={!isHidden}
                    onValueChange={() => toggleHidden(key)}
                    trackColor={{ true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  resetText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  hint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 16,
  },
  group: {
    borderRadius: 18,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  reorderCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reorderBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
});
