import { useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";

type GestureMode = "volume" | "brightness" | "seek" | "zoom";

type PlayerGestureSettings = {
  swipeBrightness?: boolean;
  swipeVolume?: boolean;
  swipeSeek?: boolean;
  swipeBrightnessSensitivity?: number;
  swipeVolumeSensitivity?: number;
  swipeSeekSensitivity?: number;
  invertVerticalSwipe?: boolean;
};

type UsePlayerGesturesOptions = {
  enabled: boolean;
  locked: boolean;
  isAudioMode: boolean;
  viewportWidth: number;
  viewportHeight: number;
  duration: number;
  position: number;
  volume: number;
  brightness: number;
  zoomScale: number;
  minZoom: number;
  maxZoom: number;
  activationDistance?: number;
  edgeRatio?: number;
  verticalSensitivityPx?: number;
  settings: PlayerGestureSettings;
  onTap: (locationX: number) => void;
  onSeek: (position: number) => void;
  onSeekPreview?: (position: number, direction: "forward" | "rewind") => void;
  onVolumeChange: (value: number) => void;
  onBrightnessChange: (value: number) => void;
  onZoomChange: (value: number) => void;
  onModeChange?: (mode: GestureMode | null) => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function curve(value: number) {
  const safe = clamp(value, -1, 1);
  return Math.sign(safe) * Math.pow(Math.abs(safe), 1.35);
}

/**
 * Unified player input layer.
 *
 * One native Gesture Handler surface owns tap, pan, pinch and long-press.
 * The pan locks its axis after classification:
 * - left edge + vertical -> brightness
 * - right edge + vertical -> volume
 * - center + horizontal -> seek
 * - ambiguous diagonal -> no action
 */
export function usePlayerGestures(options: UsePlayerGesturesOptions) {
  const {
    enabled,
    locked,
    isAudioMode,
    viewportWidth,
    duration,
    position,
    volume,
    brightness,
    zoomScale,
    minZoom,
    maxZoom,
    activationDistance = 12,
    edgeRatio = 0.32,
    verticalSensitivityPx = 260,
    settings,
    onTap,
    onSeek,
    onSeekPreview,
    onVolumeChange,
    onBrightnessChange,
    onZoomChange,
    onModeChange,
    onLongPressStart,
    onLongPressEnd,
  } = options;

  const panState = useRef<{
    mode: GestureMode | null;
    startX: number;
    startPosition: number;
    startVolume: number;
    startBrightness: number;
  }>({
    mode: null,
    startX: 0,
    startPosition: 0,
    startVolume: 0,
    startBrightness: 0.5,
  });

  const pinchStart = useRef(minZoom);
  const latest = useRef({
    duration,
    position,
    volume,
    brightness,
    zoomScale,
    settings,
    onTap,
    onSeek,
    onSeekPreview,
    onVolumeChange,
    onBrightnessChange,
    onZoomChange,
    onModeChange,
    onLongPressStart,
    onLongPressEnd,
  });
  latest.current = {
    duration,
    position,
    volume,
    brightness,
    zoomScale,
    settings,
    onTap,
    onSeek,
    onSeekPreview,
    onVolumeChange,
    onBrightnessChange,
    onZoomChange,
    onModeChange,
    onLongPressStart,
    onLongPressEnd,
  };

  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .enabled(enabled && !locked)
      .maxDuration(280)
      .maxDistance(10)
      .runOnJS(true)
      .onEnd((event, success) => {
        if (success) latest.current.onTap(event.x);
      });

    const pan = Gesture.Pan()
      .enabled(enabled && !locked)
      .minDistance(activationDistance)
      .maxPointers(1)
      .runOnJS(true)
      .onBegin((event) => {
        const current = latest.current;
        panState.current = {
          mode: null,
          startX: event.x,
          startPosition: current.position,
          startVolume: current.volume,
          startBrightness: current.brightness,
        };
      })
      .onUpdate((event) => {
        const current = latest.current;
        const state = panState.current;
        const absDx = Math.abs(event.translationX);
        const absDy = Math.abs(event.translationY);

        if (!state.mode) {
          const vertical =
            absDy >= activationDistance &&
            absDy >= absDx * 1.5;
          const horizontal =
            absDx >= activationDistance &&
            absDx >= absDy * 1.5;

          if (vertical) {
            const zone = viewportWidth * edgeRatio;
            const left = state.startX <= zone;
            const right = state.startX >= viewportWidth - zone;

            if (left && !isAudioMode && current.settings.swipeBrightness !== false) {
              state.mode = "brightness";
            } else if (right && current.settings.swipeVolume !== false) {
              state.mode = "volume";
            }
          } else if (horizontal && !isAudioMode && current.settings.swipeSeek !== false) {
            state.mode = "seek";
          }

          if (state.mode) current.onModeChange?.(state.mode);
        }

        if (state.mode === "volume") {
          const signedDy = current.settings.invertVerticalSwipe ? event.translationY : -event.translationY;
          const raw = clamp(signedDy / Math.max(verticalSensitivityPx, 1), -1, 1);
          const sensitivity = current.settings.swipeVolumeSensitivity ?? 1;
          current.onVolumeChange(clamp01(state.startVolume + curve(raw * sensitivity)));
          return;
        }

        if (state.mode === "brightness") {
          const signedDy = current.settings.invertVerticalSwipe ? event.translationY : -event.translationY;
          const raw = clamp(signedDy / Math.max(verticalSensitivityPx, 1), -1, 1);
          const sensitivity = current.settings.swipeBrightnessSensitivity ?? 1;
          current.onBrightnessChange(clamp01(state.startBrightness + curve(raw * sensitivity)));
          return;
        }

        if (state.mode === "seek" && current.duration > 0) {
          const sensitivity = current.settings.swipeSeekSensitivity ?? 1;
          const pixelsPerSecond = Math.max(0.001, (viewportWidth / current.duration) / sensitivity);
          const delta = event.translationX / pixelsPerSecond;
          const next = clamp(state.startPosition + delta, 0, current.duration);
          current.onSeekPreview?.(next, delta >= 0 ? "forward" : "rewind");
        }
      })
      .onFinalize((event) => {
        const current = latest.current;
        const mode = panState.current.mode;

        if (mode === "seek" && current.duration > 0) {
          const sensitivity = current.settings.swipeSeekSensitivity ?? 1;
          const pixelsPerSecond = Math.max(0.001, (viewportWidth / current.duration) / sensitivity);
          const delta = event.translationX / pixelsPerSecond;
          current.onSeek(clamp(panState.current.startPosition + delta, 0, current.duration));
        }

        if (mode) current.onModeChange?.(null);
        panState.current.mode = null;
      });

    const pinch = Gesture.Pinch()
      .enabled(enabled && !locked && !isAudioMode)
      .runOnJS(true)
      .onBegin(() => {
        pinchStart.current = latest.current.zoomScale;
        latest.current.onModeChange?.("zoom");
      })
      .onUpdate((event) => {
        const next = clamp(
          pinchStart.current * event.scale,
          minZoom,
          maxZoom,
        );
        latest.current.onZoomChange(next);
      })
      .onFinalize(() => {
        latest.current.onModeChange?.(null);
      });

    const longPress = Gesture.LongPress()
      .enabled(enabled && !locked && !isAudioMode)
      .minDuration(650)
      .maxDistance(10)
      .runOnJS(true)
      .onStart(() => {
        latest.current.onLongPressStart?.();
      })
      .onEnd(() => {
        latest.current.onLongPressEnd?.();
      });

    // Priority is intentional: pinch -> long press -> directional pan -> tap.
    // This prevents a multi-touch gesture from becoming a seek/volume swipe.
    return Gesture.Exclusive(pinch, longPress, pan, tap);
  }, [
    activationDistance,
    edgeRatio,
    enabled,
    isAudioMode,
    locked,
    maxZoom,
    minZoom,
    viewportWidth,
    verticalSensitivityPx,
  ]);

  return gesture;
}
