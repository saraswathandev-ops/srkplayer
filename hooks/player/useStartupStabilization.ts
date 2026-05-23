/**
 * useStartupStabilization.ts
 *
 * Manages the startup → stabilizing → playing confirmation flow.
 *
 * ALL 5 conditions must be true before confirming stable playback:
 *   1. isNativePlaying === true
 *   2. progressDelta > 1.5s
 *   3. !isBuffering
 *   4. elapsedMs > 2000ms
 *   5. noNativeFalseToggle (no pending debounce)
 *
 * If playback drops during stabilizing, triggers startup recovery
 * instead of false-positive transition to 'playing'.
 */
import { useCallback, useRef } from 'react';

import {
  STABILIZATION_ELAPSED_MS,
  STABILIZATION_POSITION_DELTA,
  STARTUP_GRACE_MS,
} from '@/src/player/playbackConstants';
import { logPlayback } from '@/src/player/playbackLogger';
import type { PlaybackLogContext } from '@/src/player/playbackTypes';

export type StabilizationResult = 'stable' | 'waiting' | 'failed';

export function useStartupStabilization(
  buildLogContext: () => PlaybackLogContext,
  isNativePlayingRef: React.MutableRefObject<boolean>,
  hasNativeFalseToggleRef: React.MutableRefObject<boolean>,
) {
  const stabilizationStartAtRef = useRef(0);
  const stabilizationStartPosRef = useRef(0);
  const isStabilizingRef = useRef(false);

  /** Enter stabilization phase — record start position and timestamp. */
  const beginStabilization = useCallback(
    (currentTime: number) => {
      const now = Date.now();
      stabilizationStartAtRef.current = now;
      stabilizationStartPosRef.current = currentTime;
      isStabilizingRef.current = true;

      logPlayback(buildLogContext(), 'stabilization_begin', {
        startPosition: currentTime,
        startAt: now,
      });
    },
    [buildLogContext],
  );

  /**
   * Check stabilization progress — called on each onProgress during stabilizing.
   *
   * Returns:
   *   'stable'  — all 5 conditions met, safe to transition to playing
   *   'waiting' — still within grace, keep waiting
   *   'failed'  — past grace with no native playing, trigger recovery
   */
  const checkStabilization = useCallback(
    (currentTime: number, isBuffering: boolean): StabilizationResult => {
      if (!isStabilizingRef.current) return 'waiting';

      const now = Date.now();
      const elapsed = now - stabilizationStartAtRef.current;
      const positionDelta = currentTime - stabilizationStartPosRef.current;

      // ── 5 conditions ─────────────────────────────────────────────
      const cond1_nativePlaying = isNativePlayingRef.current;
      const cond2_progressAdvanced = positionDelta > STABILIZATION_POSITION_DELTA;
      const cond3_notBuffering = !isBuffering;
      const cond4_elapsedEnough = elapsed > STABILIZATION_ELAPSED_MS;
      const cond5_noFalseToggle = !hasNativeFalseToggleRef.current;

      if (
        cond1_nativePlaying &&
        cond2_progressAdvanced &&
        cond3_notBuffering &&
        cond4_elapsedEnough &&
        cond5_noFalseToggle
      ) {
        logPlayback(buildLogContext(), 'stabilization_confirmed', {
          elapsed,
          positionDelta,
        });
        isStabilizingRef.current = false;
        return 'stable';
      }

      // Failed: not native playing and past startup grace
      if (!cond1_nativePlaying && elapsed > STARTUP_GRACE_MS) {
        logPlayback(buildLogContext(), 'stabilization_failed', {
          elapsed,
          positionDelta,
          isNativePlaying: cond1_nativePlaying,
          isBuffering,
          hasFalseToggle: !cond5_noFalseToggle,
        });
        isStabilizingRef.current = false;
        return 'failed';
      }

      return 'waiting';
    },
    [buildLogContext, isNativePlayingRef, hasNativeFalseToggleRef],
  );

  /** Reset stabilization state — called on video switch or recovery. */
  const resetStabilization = useCallback(() => {
    stabilizationStartAtRef.current = 0;
    stabilizationStartPosRef.current = 0;
    isStabilizingRef.current = false;
  }, []);

  return {
    beginStabilization,
    checkStabilization,
    resetStabilization,
    isStabilizing: isStabilizingRef,
    stabilizationStartAt: stabilizationStartAtRef,
  };
}
