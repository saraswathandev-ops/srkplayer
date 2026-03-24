import Feather from 'react-native-vector-icons/Feather';
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

type Props = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, subtitle, action }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.backgroundTertiary }]}>
        <Feather name={icon} size={36} color={colors.textTertiary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  action: {
    marginTop: 8,
  },
});
