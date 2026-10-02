import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  value?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function PlayerControlItemBase({ title, value, icon, active, disabled, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.item, active && styles.active, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.icon}>{icon}</View>
      <View style={styles.textWrap}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {value ? <Text numberOfLines={1} style={styles.value}>{value}</Text> : null}
      </View>
    </Pressable>
  );
}

export const PlayerControlItem = memo(PlayerControlItemBase);

const styles = StyleSheet.create({
  item: {
    minHeight: 56,
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  active: { backgroundColor: "rgba(74,163,255,0.22)" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  icon: { minHeight: 22, alignItems: "center", justifyContent: "center" },
  textWrap: { alignItems: "center", maxWidth: 120 },
  title: { color: "#fff", fontSize: 11, fontWeight: "600" },
  value: { color: "rgba(255,255,255,0.62)", fontSize: 9, marginTop: 1 },
});
