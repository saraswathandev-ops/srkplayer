import Feather from "react-native-vector-icons/Feather";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { HEADER_BUTTON, RADIUS } from "@/constants/layout";
import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  variant?: "default" | "primary";
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function HeaderIconButton({
  icon,
  onPress,
  variant = "default",
  active = false,
  disabled = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useAppTheme();
  const isPrimary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary
            ? colors.primary
            : active
              ? `${colors.primary}22`
              : colors.card,
          borderColor: isPrimary
            ? colors.primary
            : active
              ? colors.primary
              : colors.border,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={18}
        color={isPrimary ? "#fff" : active ? colors.primary : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: HEADER_BUTTON,
    height: HEADER_BUTTON,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
