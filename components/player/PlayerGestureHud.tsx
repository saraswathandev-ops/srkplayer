import React, { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import ReAnimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export type PlayerGestureHudMode = "volume" | "brightness" | "seek" | "zoom" | "speed" | null;
type Props = { mode: PlayerGestureHudMode; value?: number; label?: string; visible?: boolean; };

function PlayerGestureHudBase({ mode, value = 0, label, visible = true }: Props) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.94);
  useEffect(() => {
    const active = visible && !!mode;
    opacity.value = withTiming(active ? 1 : 0, { duration: active ? 120 : 180, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(active ? 1 : 0.94, { duration: active ? 150 : 180, easing: Easing.out(Easing.cubic) });
  }, [mode, visible, opacity, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  if (!mode) return null;
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const labelText = label ?? (mode === "volume" ? `Volume ${percent}%` : mode === "brightness" ? `Brightness ${percent}%` : mode === "zoom" ? `Zoom ${value.toFixed(1)}x` : mode === "speed" ? `${value.toFixed(2)}x` : "Seek");
  return <ReAnimated.View pointerEvents="none" style={[styles.container, animatedStyle]}><View style={styles.card}><Text style={styles.icon}>{mode === "volume" ? "🔊" : mode === "brightness" ? "☀" : mode === "zoom" ? "⌕" : mode === "speed" ? "▶" : "↔"}</Text><Text style={styles.label}>{labelText}</Text>{(mode === "volume" || mode === "brightness") && <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>}</View></ReAnimated.View>;
}
export const PlayerGestureHud = memo(PlayerGestureHudBase);
const styles = StyleSheet.create({ container: { position: "absolute", left: 0, right: 0, top: "38%", alignItems: "center", justifyContent: "center" }, card: { minWidth: 150, maxWidth: 260, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", gap: 7 }, icon: { fontSize: 22 }, label: { color: "#fff", fontSize: 14, fontWeight: "600" }, track: { width: 110, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.18)" }, fill: { height: "100%", backgroundColor: "#fff" } });