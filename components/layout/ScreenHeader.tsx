import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useFontScale } from "@/hooks/useFontScale";

type Props = {
  title: string;
  topPad: number;
  right?: React.ReactNode;
  bottomSpacing?: number;
};

export function ScreenHeader({
  title,
  topPad,
  right,
  bottomSpacing = 8,
}: Props) {
  const { colors } = useAppTheme();
  const { apply } = useFontScale();
  const accentStart = Math.max(1, Math.floor(title.length * 0.58));
  const lead = title.slice(0, accentStart);
  const tail = title.slice(accentStart);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPad + 8,
          paddingBottom: bottomSpacing,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Text style={[styles.title, { fontSize: apply(28), lineHeight: apply(32) }]}>
        <Text style={[styles.titleLead, { color: colors.text }]}>{lead}</Text>
        <Text style={[styles.titleTail, { color: colors.primary }]}>{tail}</Text>
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  titleLead: {
    fontFamily: "Inter_700Bold",
  },
  titleTail: {
    fontFamily: "Inter_700Bold",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
