/**
 * usePlayback.ts
 *
 * Manages video playback state (play/pause, seek, speed) and syncs it
 * with the native video player instance and the Zustand store.
 * Also handles saving playback position every 5 seconds.
 */
import { useCallback, useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { usePlayer } from '@/context/PlayerContext';
import { VideoRef } from 'react-native-video';
import { VideoItem } from '@/types/player';

const SAVE_INTERVAL_MS = 5000;

export function usePlayback(
  videoRef: React.RefObject<VideoRef | null>,
  currentVideo: VideoItem | null,
  videoId: string | undefined
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

  // ── Actions ────────────────────────────────────────────────────────────────

  const togglePlayPause = useCallback(() => {
    if (paused) {
      setPaused(false);
      videoRef.current?.resume();
    } else {
      setPaused(true);
      videoRef.current?.pause();
      savePosition(); // Save immediately when paused
    }
  }, [paused, setPaused, videoRef, savePosition]);

  const seekTo = useCallback((time: number) => {
    const safeTime = Math.max(0, Math.min(time, duration || 0));
    setCurrentTime(safeTime);
    videoRef.current?.seek(safeTime);
  }, [duration, setCurrentTime, videoRef]);

  const seekBy = useCallback((seconds: number) => {
    seekTo(currentTime + seconds);
  }, [currentTime, seekTo]);

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
    }, SAVE_INTERVAL_MS);

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
