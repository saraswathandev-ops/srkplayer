/**
 * Seekbar.tsx
 *
 * Standalone seekbar component used in BottomControls.
 * Renders the progress track + draggable thumb + ghost seek preview.
 * Uses react-native-gesture-handler pan gesture for smooth 60fps dragging.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const THUMB_SIZE = 14;
const TRACK_HEIGHT = 3;
const TRACK_HIT_HEIGHT = 28; // enlarged hit area

export interface SeekbarProps {
  position: number;
  duration: number;
  seekPreviewPosition?: number | null;
  /** Called while dragging to show the preview time */
  onSeekPreview?: (time: number) => void;
  /** Called when user lifts finger — commit the seek */
  onSeekCommit: (time: number) => void;
  /** Called when drag starts */
  onDragStart?: () => void;
  /** Called when drag ends */
  onDragEnd?: () => void;
  /** Accent color for the filled portion of the track */
  accentColor?: string;
}

export function Seekbar({
  position,
  duration,
  seekPreviewPosition,
  onSeekPreview,
  onSeekCommit,
  onDragStart,
  onDragEnd,
  accentColor = '#FF3B30',
}: SeekbarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);

  const safeDuration = duration > 0 ? duration : 0;
  const safePosition = Math.min(Math.max(position, 0), safeDuration);

  const reportedRatio = safeDuration > 0 ? safePosition / safeDuration : 0;
  const displayRatio = dragRatio !== null ? dragRatio : reportedRatio;

  const ghostRatio =
    seekPreviewPosition != null && safeDuration > 0
      ? Math.min(Math.max(seekPreviewPosition / safeDuration, 0), 1)
      : null;

  const clampRatio = (x: number) =>
    Math.min(Math.max(barWidth > 0 ? x / barWidth : 0, 0), 1);

  const commitRatio = useCallback(
    (ratio: number) => {
      if (safeDuration <= 0) return;
      onSeekCommit(ratio * safeDuration);
    },
    [onSeekCommit, safeDuration]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .activeOffsetX([-4, 4])
        .onBegin((e) => {
          'worklet';
          runOnJS(() => {
            isDraggingRef.current = true;
            dragStartXRef.current = e.x;
            const r = clampRatio(e.x);
            setDragRatio(r);
            onSeekPreview?.(r * safeDuration);
            onDragStart?.();
          })();
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(() => {
            const r = clampRatio(dragStartXRef.current + e.translationX);
            setDragRatio(r);
            onSeekPreview?.(r * safeDuration);
          })();
        })
        .onEnd((e) => {
          'worklet';
          runOnJS(() => {
            const r = clampRatio(dragStartXRef.current + e.translationX);
            commitRatio(r);
            setDragRatio(null);
            isDraggingRef.current = false;
            onDragEnd?.();
          })();
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(() => {
            if (isDraggingRef.current) {
              setDragRatio(null);
              isDraggingRef.current = false;
              onDragEnd?.();
            }
          })();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [barWidth, safeDuration, commitRatio, onSeekPreview, onDragStart, onDragEnd]
  );

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={styles.hitArea}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.track}>
          {/* Ghost / preview fill */}
          {ghostRatio !== null && (
            <View
              style={[
                styles.ghost,
                { width: `${ghostRatio * 100}%` as any },
              ]}
              pointerEvents="none"
            />
          )}
          {/* Played fill */}
          <View
            style={[
              styles.fill,
              { width: `${displayRatio * 100}%` as any, backgroundColor: accentColor },
            ]}
            pointerEvents="none"
          />
          {/* Thumb */}
          <View
            style={[
              styles.thumb,
              {
                left: `${displayRatio * 100}%` as any,
                backgroundColor: accentColor,
              },
            ]}
            pointerEvents="none"
          />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    height: TRACK_HIT_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: TRACK_HEIGHT / 2,
    position: 'relative',
  },
  ghost: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: TRACK_HEIGHT / 2,
    top: 0,
    left: 0,
  },
  fill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    top: 0,
    left: 0,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: -(THUMB_SIZE - TRACK_HEIGHT) / 2,
    marginLeft: -(THUMB_SIZE / 2),
  },
});
