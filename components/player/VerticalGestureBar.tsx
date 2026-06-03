import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Feather from "react-native-vector-icons/Feather";

import { styles } from "@/app/player.styles";

const STEP_SIZE = 0.05;

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function VerticalGestureBarBase({
  value,
  color,
  icon,
  side,
  onChange,
  edgeInset = 0,
}: {
  value: number;
  color: string;
  icon: string;
  side: "left" | "right";
  onChange?: (v: number) => void;
  /** Safe-area inset for this side so the bar clears a landscape notch / nav bar. */
  edgeInset?: number;
}) {
  const barHeightRef = useRef(0);
  const startValueRef = useRef(value);
  // Mirror the live value/onChange so the gesture callbacks below can have
  // empty dependency arrays. Without this, the parent's per-second position
  // tick re-creates beginDrag/updateValueFromDrag and the composed Pan
  // gesture, which can drop or stutter an in-progress drag.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const beginDrag = useCallback(() => {
    startValueRef.current = valueRef.current;
  }, []);

  const updateValueFromDrag = useCallback((translationY: number) => {
    const height = Math.max(barHeightRef.current, 1);
    const rawDelta = -translationY / height;
    const steppedDelta = Math.round(rawDelta / STEP_SIZE) * STEP_SIZE;
    onChangeRef.current?.(clamp01(Number((startValueRef.current + steppedDelta).toFixed(2))));
  }, []);

  // Relative drag prevents stationary touches from jumping the value.
  // Built once — beginDrag/updateValueFromDrag are stable.
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
        style={[
          styles.gestureBar,
          side === "left" ? styles.gestureBarLeft : styles.gestureBarRight,
          side === "left" ? { left: 8 + edgeInset } : { right: 8 + edgeInset },
        ]}
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

// Memoized so the bar only re-renders when its own props change, not on every
// parent (player) re-render (e.g. the per-second position tick).
export const VerticalGestureBar = React.memo(VerticalGestureBarBase);
