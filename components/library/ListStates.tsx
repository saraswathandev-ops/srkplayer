import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { CARD_GAP, GRID_HPAD, LIST_HPAD, RADIUS } from "@/constants/layout";
import { useAppTheme } from "@/hooks/useAppTheme";

type LoadingProps = {
  count?: number;
  variant?: "list" | "grid";
};

type EmptyProps = {
  icon: React.ComponentProps<typeof EmptyState>["icon"];
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function ListLoadingState({
  count = 6,
  variant = "list",
}: LoadingProps) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const items = useMemo(() => Array.from({ length: count }, (_, index) => index), [count]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.loadingWrap,
        variant === "grid" ? styles.gridWrap : styles.listWrap,
      ]}
    >
      {items.map((item) => (
        <Animated.View
          key={item}
          style={[
            variant === "grid" ? styles.gridCard : styles.listCard,
            {
              opacity,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              variant === "grid" ? styles.gridThumb : styles.listThumb,
              { backgroundColor: colors.backgroundTertiary },
            ]}
          />
          <View style={styles.lines}>
            <View style={[styles.lineLg, { backgroundColor: colors.backgroundTertiary }]} />
            <View style={[styles.lineSm, { backgroundColor: colors.backgroundTertiary }]} />
          </View>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

export function ListEmptyState({
  icon,
  title,
  subtitle,
  action,
  onRefresh,
  refreshing = false,
}: EmptyProps) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.emptyWrap}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    >
      <EmptyState icon={icon} title={title} subtitle={subtitle} action={action} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
  },
  loadingWrap: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  listWrap: {
    paddingHorizontal: LIST_HPAD,
    gap: CARD_GAP,
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_HPAD,
    gap: CARD_GAP,
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 10,
    gap: 10,
    minHeight: 82,
  },
  gridCard: {
    width: "47.5%",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 10,
    gap: 10,
    minHeight: 180,
  },
  listThumb: {
    width: 62,
    height: 54,
    borderRadius: RADIUS.md,
  },
  gridThumb: {
    width: "100%",
    height: 100,
    borderRadius: RADIUS.md,
  },
  lines: {
    flex: 1,
    gap: 8,
  },
  lineLg: {
    height: 14,
    borderRadius: RADIUS.pill,
    width: "78%",
  },
  lineSm: {
    height: 10,
    borderRadius: RADIUS.pill,
    width: "48%",
  },
});
