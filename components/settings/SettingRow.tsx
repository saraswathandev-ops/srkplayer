import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right: React.ReactNode;
  onPress?: () => void;
};

export function SettingRow({
  icon,
  label,
  sublabel,
  right,
  onPress,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          opacity: pressed && onPress ? 0.85 : 1,
        },
      ]}
      disabled={!onPress}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.backgroundTertiary },
        ]}
      >
        {icon}
      </View>
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {sublabel ? (
          <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
  },
  sublabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 5,
    lineHeight: 22,
  },
});
