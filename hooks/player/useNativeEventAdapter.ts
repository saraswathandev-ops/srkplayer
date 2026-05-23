/**
 * useNativeEventAdapter.ts
 *
 * Debounces native isPlaying=false toggles from ExoPlayer (300ms).
 * Android frequently emits brief false signals during startup that
 * would otherwise trigger false recoveries.
 *
 * Flow:
 *   native isPlaying=false → start 300ms debounce
 *     → if native isPlaying=true within 300ms → cancel (was transient)
 *     → if still false after 300ms → confirm real pause
 */
import { useCallback, useEffect, useRef } from 'react';

import { NATIVE_FALSE_DEBOUNCE_MS } from '@/src/player/playbackConstants';
import { logNativeState } from '@/src/player/playbackLogger';
import type { PlaybackLogContext } from '@/src/player/playbackTypes';

export function useNativeEventAdapter(
  buildLogContext: () => PlaybackLogContext,
) {
  const nativeFalseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastNativePlayingRef = useRef(false);
  const hasNativeFalseToggleRef = useRef(false);
  const lastNativeAckPlayingAtRef = useRef(0);

  // External notification callbacks — set by the orchestrator
  const onNativePlayingConfirmedRef = useRef<(() => void) | null>(null);
  const onNativePauseConfirmedRef = useRef<(() => void) | null>(null);

  /**
   * Called by <Video onPlaybackStateChanged>.
   * Debounces false toggles before notifying consumers.
   */
  const handleNativePlaybackStateChanged = useCallback(
    (event: { isPlaying: boolean; isSeeking?: boolean }) => {
      const ctx = buildLogContext();

      if (event.isPlaying) {
        // ── Native says playing — cancel any pending false debounce ──
        if (nativeFalseTimerRef.current) {
          clearTimeout(nativeFalseTimerRef.current);
          nativeFalseTimerRef.current = null;
        }
        hasNativeFalseToggleRef.current = false;
        lastNativePlayingRef.current = true;
        lastNativeAckPlayingAtRef.current = Date.now();

        logNativeState(ctx, 'native_playing_confirmed');
        onNativePlayingConfirmedRef.current?.();
      } else {
        // ── Native says false — debounce for 300ms before acting ──
        hasNativeFalseToggleRef.current = true;

        logNativeState(ctx, 'native_false_debouncing', {
          debounceMs: NATIVE_FALSE_DEBOUNCE_MS,
        });

        if (nativeFalseTimerRef.current) {
          clearTimeout(nativeFalseTimerRef.current);
        }

        nativeFalseTimerRef.current = setTimeout(() => {
          lastNativePlayingRef.current = false;
          hasNativeFalseToggleRef.current = false;
          nativeFalseTimerRef.current = null;

          logNativeState(buildLogContext(), 'native_pause_confirmed');
          onNativePauseConfirmedRef.current?.();
        }, NATIVE_FALSE_DEBOUNCE_MS);
      }
    },
    [buildLogContext],
  );

  /** Register external callbacks for confirmed native state changes. */
  const setCallbacks = useCallback(
    (
      onPlayingConfirmed: () => void,
      onPauseConfirmed: () => void,
    ) => {
      onNativePlayingConfirmedRef.current = onPlayingConfirmed;
      onNativePauseConfirmedRef.current = onPauseConfirmed;
    },
    [],
  );

  /** Reset all native adapter state — called on video switch. */
  const reset = useCallback(() => {
    if (nativeFalseTimerRef.current) {
      clearTimeout(nativeFalseTimerRef.current);
      nativeFalseTimerRef.current = null;
    }
    lastNativePlayingRef.current = false;
    hasNativeFalseToggleRef.current = false;
    lastNativeAckPlayingAtRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nativeFalseTimerRef.current) {
        clearTimeout(nativeFalseTimerRef.current);
        nativeFalseTimerRef.current = null;
      }
    };
  }, []);

  return {
    handleNativePlaybackStateChanged,
    isNativePlaying: lastNativePlayingRef,
    hasNativeFalseToggle: hasNativeFalseToggleRef,
    lastNativeAckPlayingAt: lastNativeAckPlayingAtRef,
    setCallbacks,
    reset,
  };
}
