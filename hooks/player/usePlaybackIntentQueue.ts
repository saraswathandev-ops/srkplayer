/**
 * usePlaybackIntentQueue.ts
 *
 * Prevents race conditions from overlapping play/seek/reload/resume actions.
 * Enforces seek-confirmation-before-play: play() only executes after the
 * seek position is confirmed within SEEK_CONFIRM_THRESHOLD.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { VideoRef } from 'react-native-video';

import {
  SEEK_CONFIRM_THRESHOLD,
  SEEK_CONFIRM_TIMEOUT_MS,
  SEEK_RETRY_MAX,
} from '@/src/player/playbackConstants';
import { logPlayback } from '@/src/player/playbackLogger';
import type { PlaybackIntent, PlaybackLogContext } from '@/src/player/playbackTypes';

export function usePlaybackIntentQueue(
  videoRef: React.RefObject<VideoRef | null>,
  generationRef: React.MutableRefObject<number>,
  buildLogContext: () => PlaybackLogContext,
) {
  const intentRef = useRef<PlaybackIntent>({
    shouldPlay: false,
    pendingSeek: null,
    pendingReload: false,
    pendingResume: false,
    seekConfirmed: false,
  });

  const seekRetryCountRef = useRef(0);
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playAssertedRef = useRef(false);
  const frozenGenerationRef = useRef(0);

  // ── Flush: execute queued intents in correct order ─────────────────────────

  const flushIntents = useCallback(() => {
    const intent = intentRef.current;

    // Don't play until seek is confirmed (or no seek pending)
    if (
      intent.shouldPlay &&
      (intent.seekConfirmed || intent.pendingSeek === null) &&
      !playAssertedRef.current
    ) {
      playAssertedRef.current = true;
      videoRef.current?.resume();
      intent.shouldPlay = false;
      logPlayback(buildLogContext(), 'intent_play_flushed');
    }
  }, [videoRef, buildLogContext]);

  // ── Queue a play intent ────────────────────────────────────────────────────

  const queuePlay = useCallback(() => {
    intentRef.current.shouldPlay = true;
    playAssertedRef.current = false;
    logPlayback(buildLogContext(), 'intent_play_queued');
    flushIntents();
  }, [buildLogContext, flushIntents]);

  // ── Queue a seek with confirmation tracking ────────────────────────────────

  const queueSeek = useCallback(
    (position: number) => {
      intentRef.current.pendingSeek = position;
      intentRef.current.seekConfirmed = false;
      seekRetryCountRef.current = 0;
      frozenGenerationRef.current = generationRef.current;

      // Clear any existing seek timeout
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }

      // Execute seek
      videoRef.current?.seek(position);
      logPlayback(buildLogContext(), 'intent_seek_queued', { position });

      // Set seek confirmation timeout — retry or force-confirm
      seekTimeoutRef.current = setTimeout(() => {
        if (frozenGenerationRef.current !== generationRef.current) return;
        if (
          intentRef.current.pendingSeek !== null &&
          !intentRef.current.seekConfirmed
        ) {
          seekRetryCountRef.current += 1;

          if (seekRetryCountRef.current <= SEEK_RETRY_MAX) {
            logPlayback(buildLogContext(), 'intent_seek_retry', {
              attempt: seekRetryCountRef.current,
              position,
            });
            videoRef.current?.seek(position);
            // Restart timeout for retry
            seekTimeoutRef.current = setTimeout(() => {
              // Force-confirm after final retry
              if (
                intentRef.current.pendingSeek !== null &&
                !intentRef.current.seekConfirmed
              ) {
                logPlayback(
                  buildLogContext(),
                  'intent_seek_force_confirmed',
                  { position },
                );
                intentRef.current.seekConfirmed = true;
                intentRef.current.pendingSeek = null;
                flushIntents();
              }
            }, SEEK_CONFIRM_TIMEOUT_MS);
          } else {
            // Force-confirm after max retries
            logPlayback(buildLogContext(), 'intent_seek_force_confirmed', {
              position,
              retries: seekRetryCountRef.current,
            });
            intentRef.current.seekConfirmed = true;
            intentRef.current.pendingSeek = null;
            flushIntents();
          }
        }
      }, SEEK_CONFIRM_TIMEOUT_MS);
    },
    [videoRef, generationRef, buildLogContext, flushIntents],
  );

  // ── Progress-based seek confirmation ───────────────────────────────────────

  const onProgressUpdate = useCallback(
    (currentTime: number) => {
      const intent = intentRef.current;

      if (intent.pendingSeek !== null && !intent.seekConfirmed) {
        if (
          Math.abs(currentTime - intent.pendingSeek) < SEEK_CONFIRM_THRESHOLD
        ) {
          intent.seekConfirmed = true;
          intent.pendingSeek = null;

          if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current);
            seekTimeoutRef.current = null;
          }

          logPlayback(buildLogContext(), 'intent_seek_confirmed', {
            currentTime,
          });
          flushIntents();
        }
      }
    },
    [buildLogContext, flushIntents],
  );

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    intentRef.current = {
      shouldPlay: false,
      pendingSeek: null,
      pendingReload: false,
      pendingResume: false,
      seekConfirmed: false,
    };
    seekRetryCountRef.current = 0;
    playAssertedRef.current = false;

    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    queuePlay,
    queueSeek,
    onProgressUpdate,
    flushIntents,
    reset,
    intentRef,
    playAssertedRef,
  };
}
