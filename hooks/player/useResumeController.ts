/**
 * useResumeController.ts
 *
 * Complete resume playback flow — was entirely MISSING from the new architecture.
 *
 * Resume flow:
 *   1. Query PlaybackProgress from DB (with 150ms timeout race)
 *   2. Apply near-end guard (position > duration - 10s → restart at 0)
 *   3. Rewind 5s from saved position (context window)
 *   4. Queue seek via intent queue (seek-before-play)
 *   5. Queue play (waits for seek confirmation)
 *   6. Mark resuming state in state machine
 */
import { useCallback } from 'react';

import {
  RESUME_NEAR_END_SECONDS,
  RESUME_REWIND_SECONDS,
} from '@/src/player/playbackConstants';
import { logPlayback } from '@/src/player/playbackLogger';
import type { PlaybackLogContext } from '@/src/player/playbackTypes';
import {
  getPlaybackProgress,
  MIN_RESUME_POSITION_SECONDS,
} from '@/services/playbackProgressService';

/**
 * Clamp resume position with near-end guard and rewind.
 * Returns 0 if position is too close to end or too small.
 */
function computeResumePosition(
  positionSeconds: number,
  durationSeconds: number,
): number {
  // Too short to resume
  if (positionSeconds < MIN_RESUME_POSITION_SECONDS) return 0;

  // Near-end guard: if within last 10s of video, restart at 0
  if (
    durationSeconds > 0 &&
    positionSeconds >= Math.max(durationSeconds - RESUME_NEAR_END_SECONDS, 0)
  ) {
    return 0;
  }

  // Rewind 5s from saved position for context
  return Math.max(positionSeconds - RESUME_REWIND_SECONDS, 0);
}

export function useResumeController(
  buildLogContext: () => PlaybackLogContext,
  setResuming: (isResuming: boolean, resumedFromSaved: boolean) => void,
  queueSeek: (position: number) => void,
  queuePlay: () => void,
  generationRef: React.MutableRefObject<number>,
) {
  /**
   * Resolve the resume position for a video.
   *
   * Priority:
   *   1. Route param position (passed from navigation)
   *   2. DB-stored PlaybackProgress
   *   3. 0 (fresh start)
   */
  const resolveResumePosition = useCallback(
    async (
      videoId: string,
      routePosition: number | undefined,
      duration: number,
    ): Promise<number> => {
      // 1. Route param takes priority (e.g., from playlist "play at" feature)
      if (routePosition !== undefined && routePosition > 0) {
        const clamped = computeResumePosition(routePosition, duration);
        logPlayback(buildLogContext(), 'resume_resolved_from_route', {
          routePosition,
          clamped,
          duration,
        });
        return clamped;
      }

      // 2. DB lookup with 150ms timeout (don't block startup)
      try {
        const progress = await Promise.race([
          getPlaybackProgress(videoId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 150)),
        ]);

        if (progress && progress.positionSeconds > 0) {
          const clamped = computeResumePosition(
            progress.positionSeconds,
            duration > 0 ? duration : progress.durationSeconds,
          );
          logPlayback(buildLogContext(), 'resume_resolved_from_db', {
            savedPosition: progress.positionSeconds,
            savedDuration: progress.durationSeconds,
            clamped,
            nearEndReset: clamped === 0 && progress.positionSeconds > 0,
          });
          return clamped;
        }
      } catch {
        logPlayback(buildLogContext(), 'resume_db_lookup_failed');
      }

      // 3. Fresh start
      logPlayback(buildLogContext(), 'resume_fresh_start');
      return 0;
    },
    [buildLogContext],
  );

  /**
   * Apply resume position — queues seek and play via the intent queue.
   * Sets the resuming flag in the state machine.
   */
  const applyResume = useCallback(
    (position: number, generation: number) => {
      // Generation guard
      if (generation !== generationRef.current) {
        logPlayback(buildLogContext(), 'resume_aborted_stale_generation');
        return;
      }

      if (position > 0) {
        setResuming(true, true);
        queueSeek(position);
        queuePlay(); // Will wait for seek confirmation before executing
        logPlayback(buildLogContext(), 'resume_applied', { position });
      } else {
        setResuming(false, false);
        queuePlay();
        logPlayback(buildLogContext(), 'fresh_start_applied');
      }
    },
    [buildLogContext, setResuming, queueSeek, queuePlay, generationRef],
  );

  return {
    resolveResumePosition,
    applyResume,
  };
}
