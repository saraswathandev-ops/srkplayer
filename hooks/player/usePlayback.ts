/**
 * usePlayback.ts
 *
 * Manages video playback state (play/pause, seek, speed) and syncs it
 * with the native video player instance and the Zustand store.
 *
 * State-machine-aware: checks the authoritative reducer state before
 * executing actions. Ignores play/pause during startup phases.
 * Uses the intent queue for seek-before-play enforcement.
 */
import { useCallback, useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { usePlayer } from '@/context/PlayerContext';
import { VideoRef } from 'react-native-video';
import { VideoItem } from '@/types/player';
import { isStartupState } from '@/src/player/playbackReducer';
import { logPlayback } from '@/src/player/playbackLogger';
import type {
  PlaybackLogContext,
  PlaybackState,
  PlaybackTransitionReason,
} from '@/src/player/playbackTypes';
import { SAVE_POSITION_INTERVAL_MS } from '@/src/player/playbackConstants';

export function usePlayback(
  videoRef: React.RefObject<VideoRef | null>,
  currentVideo: VideoItem | null,
  videoId: string | undefined,
  // ── State machine integration (optional — backwards-compatible) ──────────
  options?: {
    getPlaybackState?: () => PlaybackState;
    transition?: (next: PlaybackState, reason: PlaybackTransitionReason) => void;
    buildLogContext?: () => PlaybackLogContext;
    queueSeek?: (position: number) => void;
    queuePlay?: () => void;
    stopPolling?: () => void;
    resetRecovery?: () => void;
  },
) {
  const { updateLastPosition } = usePlayer();

  const paused = usePlayerStore((s) => s.paused);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);

  const setPaused = usePlayerStore((s) => s.setPaused);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);

  const lastSavedPositionRef = useRef<number>(0);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const savePosition = useCallback(() => {
    if (!videoId || !currentVideo || duration <= 0) return;

    // Don't save if position hasn't meaningfully changed
    if (Math.abs(currentTime - lastSavedPositionRef.current) < 1) return;

    updateLastPosition(videoId, currentTime, duration);
    lastSavedPositionRef.current = currentTime;
  }, [videoId, currentVideo, currentTime, duration, updateLastPosition]);

  // ── Actions (state-machine-aware) ──────────────────────────────────────────

  const togglePlayPause = useCallback(() => {
    // If state machine is integrated, check phase before acting
    if (options?.getPlaybackState) {
      const phase = options.getPlaybackState();

      // Don't toggle during startup — it would break the startup pipeline
      if (isStartupState(phase)) {
        if (__DEV__ && options.buildLogContext) {
          logPlayback(options.buildLogContext(), 'toggle_play_blocked_startup', {
            phase,
          });
        }
        return;
      }
    }

    if (paused) {
      setPaused(false);

      if (options?.transition && options?.queuePlay) {
        // State-machine path: transition and queue play
        options.transition('starting', 'user_resume');
        options.queuePlay();
      } else {
        // Legacy path: direct resume
        videoRef.current?.resume();
      }
    } else {
      setPaused(true);

      if (options?.transition) {
        options.transition('paused', 'user_pause');
        // Stop monitoring when user intentionally pauses
        options.stopPolling?.();
        options.resetRecovery?.();
      }

      videoRef.current?.pause();
      savePosition();
    }
  }, [paused, setPaused, videoRef, savePosition, options]);

  const seekTo = useCallback(
    (time: number) => {
      const safeTime = Math.max(0, Math.min(time, duration || 0));
      setCurrentTime(safeTime);

      if (options?.transition && options?.queueSeek) {
        // State-machine path: transition to seeking and queue
        options.transition('seeking', 'seek_started');
        options.queueSeek(safeTime);
      } else {
        // Legacy path: direct seek
        videoRef.current?.seek(safeTime);
      }
    },
    [duration, setCurrentTime, videoRef, options],
  );

  const seekBy = useCallback(
    (seconds: number) => {
      seekTo(currentTime + seconds);
    },
    [currentTime, seekTo],
  );

  const cycleSpeed = useCallback(() => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
  }, [playbackRate, setPlaybackRate]);

  // ── Auto-save interval ─────────────────────────────────────────────────────

  useEffect(() => {
    if (paused) {
      clearSaveTimer();
      return;
    }

    clearSaveTimer();
    saveTimerRef.current = setInterval(() => {
      savePosition();
    }, SAVE_POSITION_INTERVAL_MS);

    return clearSaveTimer;
  }, [paused, savePosition, clearSaveTimer]);

  // Save on unmount
  useEffect(() => {
    return () => {
      savePosition();
      clearSaveTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    togglePlayPause,
    seekTo,
    seekBy,
    cycleSpeed,
    savePosition,
  };
}
