import Feather from "react-native-vector-icons/Feather";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";

type Action = { label: string; subtitle: string; icon: string; route: string };

const actions: Action[] = [
  { label: "Search", subtitle: "Find videos, audio and folders", icon: "search", route: "search" },
  { label: "Network Stream", subtitle: "Open a network media URL", icon: "wifi", route: "network-stream" },
  { label: "YouTube", subtitle: "Open the YouTube area", icon: "play-circle", route: "youtube" },
  { label: "Recycle Bin", subtitle: "Restore or permanently remove media", icon: "trash-2", route: "recycle-bin" },
  { label: "Settings", subtitle: "Playback, appearance and library options", icon: "settings", route: "settings" },
];

export default function MoreScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 16 },
        ]}
      >
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>SKR PLAYER</Text>
        <Text style={[styles.title, { color: colors.text }]}>More</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Tools and settings, kept out of the main playback flow.
        </Text>

        <View style={styles.group}>
          {actions.map((item, index) => (
            <React.Fragment key={item.route}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => navigation.navigate(item.route)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: colors.backgroundSecondary }]}>
                  <Feather name={item.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textTertiary} />
              </Pressable>
              {index < actions.length - 1 ? (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              ) : null}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    marginBottom: 22,
    maxWidth: 330,
  },
  group: {
    borderRadius: 20,
    overflow: "hidden",
  },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  copy: { flex: 1 },
  label: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  separator: { height: 1, marginLeft: 71, opacity: 0.35 },
});
