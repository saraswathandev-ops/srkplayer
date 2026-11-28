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
      accessibilityValue={value ? { text: value } : undefined}
      accessibilityState={{ disabled: !!disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.item, active && styles.active, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {value ? <Text style={styles.value}>{value}</Text> : null}
      </View>
    </Pressable>
  );
}

export const PlayerControlItem = memo(PlayerControlItemBase);

const styles = StyleSheet.create({
  item: {
    minHeight: 56,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    gap: 12,
  },
  active: { backgroundColor: "rgba(74,163,255,0.22)" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  icon: { width: 28, alignItems: "center", justifyContent: "center" },
  textWrap: { flex: 1 },
  title: { color: "#fff", fontSize: 15, fontWeight: "600" },
  value: { color: "#BBC5D2", fontSize: 13, marginTop: 2 },
});
