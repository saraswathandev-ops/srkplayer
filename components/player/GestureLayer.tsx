/**
 * GestureLayer.tsx
 *
 * Pure gesture detection layer — sits above the video surface, below the control overlay.
 * Handles ALL touch input and emits clean events upward via callbacks.
 * Contains NO UI rendering — its only child is the controls overlay.
 *
 * MX Player gesture zones:
 * ┌─────────────────────────────────────────────┐
 * │  Left 50%  — Vertical → Brightness          │
 * │  Right 50% — Vertical → Volume              │
 * │                                             │
 * │  Double tap left  → seek -Ns                │
 * │  Double tap right → seek +Ns                │
 * │  Horizontal swipe → seek with preview       │
 * │  Long press       → 2x speed ramp           │
 * │  Pinch            → zoom in/out             │
 * └─────────────────────────────────────────────┘
 */
import React, { useCallback, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOUBLE_TAP_MAX_DELAY_MS = 300;
const DOUBLE_TAP_EDGE_RATIO = 0.50;          // Left 50% / Right 50%
const GESTURE_ACTIVATION_DISTANCE = 10;      // px before gesture locks axis
const VERTICAL_SENSITIVITY_PX = 250;         // full swipe height = 0→1 or 1→0
const HORIZONTAL_SEEK_MAX_WINDOW = 600;      // px for max seek preview range
const LONG_PRESS_MIN_DURATION_MS = 650;
const PINCH_ACTIVATION_DELTA = 0.04;
const MIN_SEEK_DELTA_PX = 8;                 // horizontal swipe threshold

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GestureLayerProps {
  /** Whether controls are locked — blocks all gestures except tap-to-unlock */
  isLocked: boolean;
  isAudioMode: boolean;
  currentTime: number;
  duration: number;
  brightness: number;
  volume: number;
  swipeBrightness: boolean;
  swipeVolume: boolean;
  swipeSeek: boolean;
  doubleTapSeekSeconds: number;
  children: React.ReactNode;

  // Callbacks
  onTap: () => void;
  onDoubleTapLeft: (seekSeconds: number) => void;
  onDoubleTapRight: (seekSeconds: number) => void;
  onBrightnessChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onSeekPreview: (position: number) => void;
  onSeekCommit: (position: number) => void;
  onSeekPreviewEnd: () => void;
  onZoomChange: (scale: number) => void;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
}

type GestureMode = 'brightness' | 'volume' | 'seek' | 'zoom' | null;

// ─── Component ────────────────────────────────────────────────────────────────

export function GestureLayer({
  isLocked,
  isAudioMode,
  currentTime,
  duration,
  brightness,
  volume,
  swipeBrightness,
  swipeVolume,
  swipeSeek,
  doubleTapSeekSeconds,
  children,
  onTap,
  onDoubleTapLeft,
  onDoubleTapRight,
  onBrightnessChange,
  onVolumeChange,
  onSeekPreview,
  onSeekCommit,
  onSeekPreviewEnd,
  onZoomChange,
  onLongPressStart,
  onLongPressEnd,
}: GestureLayerProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  // ── Internal refs (worklet-safe) ──────────────────────────────────────────
  const modeRef = useRef<GestureMode>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startBrightnessRef = useRef(brightness);
  const startVolumeRef = useRef(volume);
  const startTimeRef = useRef(currentTime);
  const axisLockedRef = useRef(false);
  const doubleTapChainRef = useRef<{
    zone: 'left' | 'right' | null;
    count: number;
    timer: ReturnType<typeof setTimeout> | null;
    lastTime: number;
  }>({ zone: null, count: 0, timer: null, lastTime: 0 });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

  const resolveVerticalMode = useCallback(
    (x: number): 'brightness' | 'volume' | null => {
      if (isAudioMode) return swipeVolume ? 'volume' : null;
      const midX = viewportWidth / 2;
      if (!isAudioMode && swipeBrightness && x < midX) return 'brightness';
      if (swipeVolume && x >= midX) return 'volume';
      return null;
    },
    [isAudioMode, swipeBrightness, swipeVolume, viewportWidth]
  );

  const resolveDoubleTapZone = useCallback(
    (x: number): 'left' | 'right' | 'center' => {
      const edge = viewportWidth * DOUBLE_TAP_EDGE_RATIO;
      if (x < edge) return 'left';
      if (x > viewportWidth - edge) return 'right';
      return 'center';
    },
    [viewportWidth]
  );

  const fireDoubleTap = useCallback(
    (zone: 'left' | 'right') => {
      const chain = doubleTapChainRef.current;
      if (chain.zone === zone) {
        chain.count = Math.min(chain.count + 1, 3);
      } else {
        chain.zone = zone;
        chain.count = 1;
      }
      if (chain.timer) clearTimeout(chain.timer);
      chain.timer = setTimeout(() => {
        chain.zone = null;
        chain.count = 0;
        chain.timer = null;
      }, DOUBLE_TAP_MAX_DELAY_MS);

      const seekAmount = doubleTapSeekSeconds * chain.count;
      if (zone === 'left') {
        onDoubleTapLeft(seekAmount);
      } else {
        onDoubleTapRight(seekAmount);
      }
    },
    [doubleTapSeekSeconds, onDoubleTapLeft, onDoubleTapRight]
  );

  // ── Pan gesture (volume / brightness / seek) ──────────────────────────────

  const panGesture = Gesture.Pan()
    .minDistance(GESTURE_ACTIVATION_DISTANCE)
    .onStart((e) => {
      'worklet';
      runOnJS(() => {
        modeRef.current = null;
        axisLockedRef.current = false;
        startXRef.current = e.x;
        startYRef.current = e.y;
        startBrightnessRef.current = brightness;
        startVolumeRef.current = volume;
        startTimeRef.current = currentTime;
      })();
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(() => {
        if (isLocked) return;

        const dx = e.translationX;
        const dy = e.translationY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Lock axis on first significant movement
        if (!axisLockedRef.current) {
          if (absDx < MIN_SEEK_DELTA_PX && absDy < GESTURE_ACTIVATION_DISTANCE) return;
          axisLockedRef.current = true;

          if (absDx > absDy && swipeSeek) {
            modeRef.current = 'seek';
          } else {
            const vertMode = resolveVerticalMode(startXRef.current);
            modeRef.current = vertMode;
          }
        }

        const mode = modeRef.current;

        if (mode === 'brightness') {
          const delta = -dy / VERTICAL_SENSITIVITY_PX;
          const newValue = clamp(startBrightnessRef.current + delta, 0, 1);
          onBrightnessChange(newValue);
        } else if (mode === 'volume') {
          const delta = -dy / VERTICAL_SENSITIVITY_PX;
          const newValue = clamp(startVolumeRef.current + delta, 0, 1);
          onVolumeChange(newValue);
        } else if (mode === 'seek' && duration > 0) {
          const ratio = clamp(dx / HORIZONTAL_SEEK_MAX_WINDOW, -1, 1);
          // Max seek window: ±30% of total duration
          const maxDelta = Math.min(duration * 0.30, 120);
          const seekDelta = ratio * maxDelta;
          const newTime = clamp(startTimeRef.current + seekDelta, 0, duration);
          onSeekPreview(newTime);
        }
      })();
    })
    .onEnd((e) => {
      'worklet';
      runOnJS(() => {
        if (modeRef.current === 'seek' && duration > 0) {
          const dx = e.translationX;
          const ratio = clamp(dx / HORIZONTAL_SEEK_MAX_WINDOW, -1, 1);
          const maxDelta = Math.min(duration * 0.30, 120);
          const seekDelta = ratio * maxDelta;
          const finalTime = clamp(startTimeRef.current + seekDelta, 0, duration);
          onSeekCommit(finalTime);
          onSeekPreviewEnd();
        }
        modeRef.current = null;
        axisLockedRef.current = false;
      })();
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(() => {
        if (modeRef.current === 'seek') onSeekPreviewEnd();
        modeRef.current = null;
        axisLockedRef.current = false;
      })();
    });

  // ── Tap gesture (show/hide controls + double-tap seek) ────────────────────

  const tapGesture = Gesture.Tap()
    .maxDuration(DOUBLE_TAP_MAX_DELAY_MS)
    .onEnd((e) => {
      'worklet';
      runOnJS(() => {
        if (isLocked) {
          onTap();
          return;
        }

        const zone = resolveDoubleTapZone(e.x);
        const now = Date.now();
        const chain = doubleTapChainRef.current;
        const isDoubleTap = now - chain.lastTime < DOUBLE_TAP_MAX_DELAY_MS;
        chain.lastTime = now;

        if (isDoubleTap && (zone === 'left' || zone === 'right')) {
          fireDoubleTap(zone);
          return;
        }

        onTap();
      })();
    });

  // ── Long press gesture (speed ramp) ───────────────────────────────────────

  const longPressGesture = Gesture.LongPress()
    .minDuration(LONG_PRESS_MIN_DURATION_MS)
    .onStart(() => {
      'worklet';
      runOnJS(onLongPressStart)();
    })
    .onEnd(() => {
      'worklet';
      runOnJS(onLongPressEnd)();
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(onLongPressEnd)();
    });

  // ── Pinch gesture (zoom) ──────────────────────────────────────────────────

  const pinchStartScaleRef = useRef(1);
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      runOnJS(() => {
        modeRef.current = 'zoom';
      })();
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(() => {
        if (isAudioMode || isLocked) return;
        if (Math.abs(e.scale - 1) < PINCH_ACTIVATION_DELTA) return;
        const newScale = clamp(pinchStartScaleRef.current * e.scale, 1, 3);
        onZoomChange(newScale);
      })();
    })
    .onEnd(() => {
      'worklet';
      runOnJS(() => {
        modeRef.current = null;
      })();
    });

  // ── Compose gestures ──────────────────────────────────────────────────────

  const composed = Gesture.Simultaneous(
    Gesture.Race(panGesture, longPressGesture),
    Gesture.Exclusive(tapGesture),
    pinchGesture
  );

  return (
    <GestureDetector gesture={composed}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </GestureDetector>
  );
}
