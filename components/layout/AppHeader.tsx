import Feather from "react-native-vector-icons/Feather";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { HEADER_BUTTON, RADIUS, SCREEN_HPAD } from "@/constants/layout";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useFontScale } from "@/hooks/useFontScale";

type Props = {
  title: string;
  topPad: number;
  right?: React.ReactNode;
  onBack?: () => void;
  selectionMode?: boolean;
  selectedCount?: number;
  onCancelSelection?: () => void;
  bottomSpacing?: number;
};

export function AppHeader({
  title,
  topPad,
  right,
  onBack,
  selectionMode = false,
  selectedCount = 0,
  onCancelSelection,
  bottomSpacing = 8,
}: Props) {
  const { colors } = useAppTheme();
  const { apply } = useFontScale();
  const showLeft = selectionMode ? Boolean(onCancelSelection) : Boolean(onBack);
  const leftIcon = selectionMode ? "x" : "arrow-left";
  const leftHandler = selectionMode ? onCancelSelection : onBack;
  const renderedTitle = selectionMode ? `${selectedCount} selected` : title;
  const accentStart = Math.max(1, Math.floor(renderedTitle.length * 0.58));
  const lead = renderedTitle.slice(0, accentStart);
  const tail = renderedTitle.slice(accentStart);
  const titleSize = showLeft ? apply(24) : apply(28);
  const lineHeight = showLeft ? apply(28) : apply(32);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPad + 8,
          paddingBottom: bottomSpacing,
          paddingHorizontal: SCREEN_HPAD,
          backgroundColor: colors.background,
        },
      ]}
    >
      {showLeft ? (
        <Pressable
          onPress={leftHandler}
          style={[
            styles.leftButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          hitSlop={8}
        >
          <Feather name={leftIcon} size={20} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.leftSpacer} />
      )}

      <Text
        style={[
          styles.title,
          {
            fontSize: titleSize,
            lineHeight,
          },
        ]}
        numberOfLines={1}
      >
        <Text style={[styles.titleLead, { color: colors.text }]}>{lead}</Text>
        <Text style={[styles.titleTail, { color: colors.primary }]}>{tail}</Text>
      </Text>

      {right ? <View style={styles.right}>{right}</View> : <View style={styles.rightSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  leftButton: {
    width: HEADER_BUTTON,
    height: HEADER_BUTTON,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  leftSpacer: {
    width: HEADER_BUTTON,
    height: HEADER_BUTTON,
  },
  title: {
    flex: 1,
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
    gap: 8,
  },
  rightSpacer: {
    minWidth: HEADER_BUTTON,
    height: HEADER_BUTTON,
  },
});
