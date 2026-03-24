import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  title: string;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, action }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.action, { color: colors.primary }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontFamily: "Inter_700Bold",
  },
  action: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
