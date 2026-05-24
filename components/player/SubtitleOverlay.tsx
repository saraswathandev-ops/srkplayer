/**
 * SubtitleOverlay.tsx
 *
 * Custom RN overlay renderer (NOT react-native-video textTracks). Chosen over
 * native textTracks because:
 *   - updating textTracks during live generation rebuilds ExoPlayer's
 *     MediaSource and causes a visible playback hiccup;
 *   - ExoPlayer's stock SubtitleView mis-shapes Tamil / Devanagari ligatures
 *     on AOSP 11/12 — RN <Text> uses the system Harfbuzz pipeline which
 *     handles complex scripts correctly.
 *
 * Design points:
 *   - Segments live in a ref + Zustand store; the binary-search cursor
 *     advances forward in O(1) for the playback case, falls back to O(log n)
 *     on seek.
 *   - currentTimeMs is pushed in via the imperative `setTime` ref API from
 *     the player's onProgress handler — that path is hot, so we avoid prop
 *     updates by talking to the component directly through a ref.
 *   - The overlay is positioned with a Reanimated translateY so the drag
 *     gesture stays on the UI thread; the resting offset is persisted in
 *     the player store.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { usePlayerStore, type SubtitleFontSize } from '@/store/playerStore';
import { findActiveSegment } from '@/services/subtitleParser';
import type { SubtitleSegment } from '@/types/subtitles';
import { log } from '@/utils/logger';

const L = log('SubtitleOverlay');

const FONT_SIZE_MAP: Record<SubtitleFontSize, number> = {
  small: 14,
  medium: 18,
  large: 22,
  xlarge: 28,
};

const LINE_HEIGHT_MAP: Record<SubtitleFontSize, number> = {
  small: 20,
  medium: 25,
  large: 30,
  xlarge: 38,
};

export interface SubtitleOverlayHandle {
  /** Push the latest playback time (in seconds — react-native-video native unit). */
  setTime: (seconds: number) => void;
  /** Reset the cursor (e.g., on seek or video change). */
  invalidate: () => void;
}

export interface SubtitleOverlayProps {
  /** Pass false when the player is in a state where subtitles must be hidden
   *  (e.g., during a brand-new source load before onProgress has fired). */
  visible?: boolean;
}

export const SubtitleOverlay = forwardRef<SubtitleOverlayHandle, SubtitleOverlayProps>(
  function SubtitleOverlay({ visible = true }, ref) {
    const segments = usePlayerStore((s) => s.subtitleSegments);
    const enabled = usePlayerStore((s) => s.subtitlesEnabled);
    const fontSize = usePlayerStore((s) => s.subtitleFontSize);
    const syncMs = usePlayerStore((s) => s.subtitleSyncMs);
    const offsetY = usePlayerStore((s) => s.subtitleOffsetY);
    const showLowConf = usePlayerStore((s) => s.subtitleShowLowConf);
    const setOffsetY = usePlayerStore((s) => s.setSubtitleOffsetY);

    // Imperative time channel — avoids a hot prop on a 4Hz cadence.
    const lastTimeMsRef = useRef(0);
    const cursorRef = useRef<number>(-1);
    const segmentsRef = useRef<SubtitleSegment[]>(segments);
    const lastBlockReasonRef = useRef<string | null>(null);
    useEffect(() => {
      segmentsRef.current = segments;
      cursorRef.current = -1; // segments changed — invalidate
      if (__DEV__) {
        const first = segments[0];
        const last = segments[segments.length - 1];
        L.info('segments_changed', {
          count: segments.length,
          firstStart: first?.start,
          lastEnd: last?.end,
          lastTimeMs: lastTimeMsRef.current,
        });
      }
    }, [segments]);

    // Visible cue state — flips only on segment boundary changes (≪ 60Hz).
    const [active, setActive] = useState<SubtitleSegment | null>(null);

    const recompute = useCallback((timeMs: number) => {
      const segs = segmentsRef.current;
      if (segs.length === 0) {
        if (active !== null) setActive(null);
        return;
      }
      const idx = findActiveSegment(segs, timeMs, cursorRef.current);
      if (idx === cursorRef.current) return;
      cursorRef.current = idx;
      const next = idx >= 0 ? segs[idx] : null;
      if (__DEV__) {
        L.info('active_changed', {
          timeMs,
          idx,
          totalSegs: segs.length,
          text: next?.text?.slice(0, 40) ?? null,
          rangeFirstEnd: segs[0]?.end,
          rangeLastStart: segs[segs.length - 1]?.start,
        });
      }
      // Equality check on reference is enough — segments are immutable.
      setActive(next);
    }, [active]);

    const setTimeCallCountRef = useRef(0);
    useImperativeHandle(ref, () => ({
      setTime: (seconds: number) => {
        const adjusted = Math.round(seconds * 1000) + syncMs;
        lastTimeMsRef.current = adjusted;
        if (__DEV__) {
          setTimeCallCountRef.current++;
          // Log first call and then every 20th to confirm cadence without spam.
          if (setTimeCallCountRef.current === 1 || setTimeCallCountRef.current % 20 === 0) {
            L.info('setTime', {
              n: setTimeCallCountRef.current,
              seconds,
              adjustedMs: adjusted,
              segCount: segmentsRef.current.length,
            });
          }
        }
        recompute(adjusted);
      },
      invalidate: () => {
        if (__DEV__) L.info('invalidate');
        cursorRef.current = -1;
        setActive(null);
      },
    }), [recompute, syncMs]);

    // When sync offset changes, recompute against the cached time.
    useEffect(() => {
      cursorRef.current = -1;
      recompute(lastTimeMsRef.current);
    }, [recompute, syncMs]);

    // ── Drag-to-reposition ─────────────────────────────────────────────────
    const translateY = useSharedValue(offsetY);
    // Track the latest committed offset so the gesture can compose with it
    // without reading from the (worklet-only) shared value via the JS thread.
    const baseY = useRef(offsetY);
    useEffect(() => {
      baseY.current = offsetY;
      translateY.value = withTiming(offsetY, { duration: 200 });
    }, [offsetY, translateY]);

    const commitOffset = useCallback((value: number) => {
      baseY.current = value;
      setOffsetY(value);
    }, [setOffsetY]);

    const dragGesture = useMemo(
      () =>
        Gesture.Pan()
          .minDistance(8)
          // Limit travel: -300px above resting, +60px below.
          .onUpdate((e) => {
            const next = Math.max(-300, Math.min(60, baseY.current + e.translationY));
            translateY.value = next;
          })
          .onEnd(() => {
            runOnJS(commitOffset)(translateY.value);
          }),
      [commitOffset, translateY],
    );

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    if (!visible || !enabled || !active) {
      if (__DEV__) {
        // Log only on transitions to avoid spamming on every frame.
        const reason = !visible ? 'not_visible' : !enabled ? 'not_enabled' : 'no_active_segment';
        if (lastBlockReasonRef.current !== reason) {
          lastBlockReasonRef.current = reason;
          L.info('render_blocked', {
            reason,
            segCount: segmentsRef.current.length,
            lastTimeMs: lastTimeMsRef.current,
          });
        }
      }
      return null;
    }
    if (__DEV__ && lastBlockReasonRef.current !== null) {
      lastBlockReasonRef.current = null;
      L.info('render_unblocked');
    }

    const opacity =
      active.confidence !== undefined && active.confidence < 0.45 && !showLowConf
        ? 0.7
        : 1;

    return (
      <Animated.View
        pointerEvents="box-none"
        style={[styles.container, animatedStyle]}
      >
        <GestureDetector gesture={dragGesture}>
          <View style={styles.pill}>
            <Text
              style={[
                styles.text,
                {
                  fontSize: FONT_SIZE_MAP[fontSize],
                  lineHeight: LINE_HEIGHT_MAP[fontSize],
                  opacity,
                },
              ]}
              // writingDirection 'auto' lets RN pick LTR/RTL per cluster.
              {...(Platform.OS === 'ios' ? { writingDirection: 'auto' as const } : {})}
            >
              {active.text}
            </Text>
          </View>
        </GestureDetector>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    maxWidth: '92%',
    // Subtle outline helps legibility on bright frames.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    // textShadowColor + offset is RN's portable equivalent of a CSS outline.
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
