import React, { useCallback, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Feather from "react-native-vector-icons/Feather";

import { styles } from "@/app/player.styles";

const STEP_SIZE = 0.05;

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function VerticalGestureBar({
  value,
  color,
  icon,
  side,
  onChange,
}: {
  value: number;
  color: string;
  icon: string;
  side: "left" | "right";
  onChange?: (v: number) => void;
}) {
  const barHeightRef = useRef(0);
  const startValueRef = useRef(value);

  const beginDrag = useCallback(() => {
    startValueRef.current = value;
  }, [value]);

  const updateValueFromDrag = useCallback((translationY: number) => {
    const height = Math.max(barHeightRef.current, 1);
    const rawDelta = -translationY / height;
    const steppedDelta = Math.round(rawDelta / STEP_SIZE) * STEP_SIZE;
    onChange?.(clamp01(Number((startValueRef.current + steppedDelta).toFixed(2))));
  }, [onChange]);

  // Relative drag prevents stationary touches from jumping the value.
  const barGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(8)
        .onBegin(() => runOnJS(beginDrag)())
        .onUpdate((e) => runOnJS(updateValueFromDrag)(e.translationY)),
    [beginDrag, updateValueFromDrag]
  );

  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <GestureDetector gesture={barGesture}>
      <View
        style={[styles.gestureBar, side === "left" ? styles.gestureBarLeft : styles.gestureBarRight]}
        onLayout={(e) => { barHeightRef.current = e.nativeEvent.layout.height; }}
      >
        <View style={styles.gestureBarTrackWrap}>
          <View style={styles.gestureBarTrack}>
            <View style={[styles.gestureBarFill, { height: `${pct}%` as any, backgroundColor: color }]} />
          </View>
        </View>
        <Feather name={icon as any} size={14} color={color} />
        <Text style={[styles.gestureBarPct, { color }]}>{pct}%</Text>
      </View>
    </GestureDetector>
  );
}
