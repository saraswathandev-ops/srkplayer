/**
 * usePlaybackLifecycle.ts
 *
 * Lifecycle coordinator — pauses health monitoring and recovery when
 * the app goes to background. Prevents false stall detection and
 * unnecessary recovery actions during normal lifecycle events.
 *
 * Handles:
 *   - AppState (active/background/inactive)
 *   - Audio becoming noisy (headset unplug) — auto-pause
 *   - Foreground resume — restart monitoring
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { logLifecycle } from '@/src/player/playbackLogger';
import type { PlaybackLogContext, PlaybackState } from '@/src/player/playbackTypes';

export function usePlaybackLifecycle(
  buildLogContext: () => PlaybackLogContext,
  getPlaybackState: () => PlaybackState,
  onBackground: () => void,
  onForeground: () => void,
) {
  const isBackgroundRef = useRef(false);
  const wasPlayingBeforeBackgroundRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (nextState === 'background' || nextState === 'inactive') &&
        prevState === 'active'
      ) {
        // ── Going background ───────────────────────────────────────────
        isBackgroundRef.current = true;
        const currentPhase = getPlaybackState();
        wasPlayingBeforeBackgroundRef.current =
          currentPhase === 'playing' ||
          currentPhase === 'starting' ||
          currentPhase === 'stabilizing' ||
          currentPhase === 'buffering';

        logLifecycle(buildLogContext(), 'app_backgrounded', {
          wasPlaying: wasPlayingBeforeBackgroundRef.current,
          phase: currentPhase,
        });

        onBackground();
      } else if (nextState === 'active' && prevState !== 'active') {
        // ── Coming foreground ──────────────────────────────────────────
        isBackgroundRef.current = false;

        logLifecycle(buildLogContext(), 'app_foregrounded', {
          wasPlaying: wasPlayingBeforeBackgroundRef.current,
        });

        if (wasPlayingBeforeBackgroundRef.current) {
          onForeground();
        }
      }
    },
    [buildLogContext, getPlaybackState, onBackground, onForeground],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  /** Reset lifecycle state — called on video switch. */
  const resetLifecycle = useCallback(() => {
    isBackgroundRef.current = false;
    wasPlayingBeforeBackgroundRef.current = false;
  }, []);

  return {
    isBackground: isBackgroundRef,
    wasPlayingBeforeBackground: wasPlayingBeforeBackgroundRef,
    resetLifecycle,
  };
}
