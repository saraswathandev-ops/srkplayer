/**
 * useStartupController.ts
 *
 * Orchestrates the fresh-start flow with:
 *   - Generation-based abort on rapid video switching
 *   - Startup timeout (8s grace)
 *   - Seek confirmation before play
 *   - Settle delay after onLoad (80ms)
 *   - Integration with resume controller for seek-before-play
 */
import { useCallback, useRef } from 'react';

import {
  STARTUP_GRACE_MS,
  STARTUP_SETTLE_BEFORE_PLAY_MS,
} from '@/src/player/playbackConstants';
import { logPlayback } from '@/src/player/playbackLogger';
import { isStartupState } from '@/src/player/playbackReducer';
import type {
  PlaybackLogContext,
  PlaybackState,
  PlaybackTransitionReason,
} from '@/src/player/playbackTypes';

export function useStartupController(
  buildLogContext: () => PlaybackLogContext,
  transition: (next: PlaybackState, reason: PlaybackTransitionReason) => void,
  generationRef: React.MutableRefObject<number>,
  getPlaybackState: () => PlaybackState,
  queuePlay: () => void,
  queueSeek: (position: number) => void,
  recordTimestamp: (field: 'navigationAt' | 'sourceValidatedAt' | 'loadStartAt' | 'loadedAt') => void,
) {
  const initStartedRef = useRef(false);
  const startupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Begin the startup pipeline for a new video.
   * Called when player screen mounts or video changes.
   */
  const beginStartup = useCallback(
    (videoId: string, uri: string, generation: number) => {
      if (initStartedRef.current) {
        logPlayback(buildLogContext(), 'startup_duplicate_blocked');
        return;
      }
      initStartedRef.current = true;

      // Generation guard
      if (generation !== generationRef.current) {
        logPlayback(buildLogContext(), 'startup_aborted_stale_generation');
        initStartedRef.current = false;
        return;
      }

      logPlayback(buildLogContext(), 'startup_begin', { videoId, uri });
      recordTimestamp('navigationAt');

      // Transition: idle → resolving → loading
      transition('resolving', 'start_requested');

      // For local files, source validation is immediate
      recordTimestamp('sourceValidatedAt');
      transition('loading', 'source_validated');
      recordTimestamp('loadStartAt');

      // Set startup timeout — if still not playing after 8s, trigger recovery
      startupTimeoutRef.current = setTimeout(() => {
        if (generation !== generationRef.current) return;

        const currentPhase = getPlaybackState();
        if (isStartupState(currentPhase)) {
          logPlayback(buildLogContext(), 'startup_timeout', {
            phase: currentPhase,
            timeoutMs: STARTUP_GRACE_MS,
          });
          transition('recovering', 'startup_timeout');
        }
      }, STARTUP_GRACE_MS);
    },
    [
      buildLogContext,
      transition,
      generationRef,
      getPlaybackState,
      recordTimestamp,
    ],
  );

  /**
   * Handle native onLoad event.
   * Applies resume seek or starts fresh, then queues play.
   */
  const handleLoad = useCallback(
    (
      data: { duration: number },
      resumePosition: number | null,
      generation: number,
    ) => {
      // Generation guard
      if (generation !== generationRef.current) {
        logPlayback(buildLogContext(), 'onload_aborted_stale_generation');
        return;
      }

      recordTimestamp('loadedAt');
      logPlayback(buildLogContext(), 'source_loaded', {
        duration: data.duration,
        resumePosition,
      });

      if (resumePosition !== null && resumePosition > 0) {
        // Resume: queue seek, then play (play waits for seek confirmation)
        logPlayback(buildLogContext(), 'startup_resume_seek', {
          position: resumePosition,
        });
        queueSeek(resumePosition);
        queuePlay();
        transition('starting', 'start_requested');
      } else {
        // Fresh start: 80ms settle delay, then play
        setTimeout(() => {
          if (generation !== generationRef.current) return;

          logPlayback(buildLogContext(), 'startup_fresh_play', {
            settleMs: STARTUP_SETTLE_BEFORE_PLAY_MS,
          });
          queuePlay();
          transition('starting', 'start_requested');
        }, STARTUP_SETTLE_BEFORE_PLAY_MS);
      }
    },
    [
      buildLogContext,
      transition,
      generationRef,
      queuePlay,
      queueSeek,
      recordTimestamp,
    ],
  );

  /**
   * Abort the current startup — clears timeout, resets flag.
   * Called on video switch or unmount.
   */
  const abortStartup = useCallback(() => {
    if (startupTimeoutRef.current) {
      clearTimeout(startupTimeoutRef.current);
      startupTimeoutRef.current = null;
    }
    initStartedRef.current = false;
  }, []);

  return {
    beginStartup,
    handleLoad,
    abortStartup,
  };
}
