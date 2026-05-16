/**
 * usePlayerControls.ts
 *
 * Manages control visibility and the auto-hide timer for the video player.
 * Replaces the 6+ scattered timer refs (controlsTimer, hudTimer, screenshotTimer,
 * volumePersistTimer, etc.) in player.tsx with a single, clean hook.
 *
 * Usage:
 *   const { showControls, hideControls, resetHideTimer } = usePlayerControls();
 */
import { useCallback, useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';

const CONTROLS_HIDE_DELAY_MS = 3000; // Standard 3s auto-hide (MX Player style)
const HUD_HIDE_DELAY_MS = 1000;      // Gesture HUD hides faster

export function usePlayerControls() {
  const showControlsInStore = usePlayerStore((s) => s.showControls);
  const hideControlsInStore = usePlayerStore((s) => s.hideControls);
  const setGestureHUD = usePlayerStore((s) => s.setGestureHUD);
  const isLocked = usePlayerStore((s) => s.isLocked);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  const clearHudTimer = useCallback(() => {
    if (hudTimerRef.current) {
      clearTimeout(hudTimerRef.current);
      hudTimerRef.current = null;
    }
  }, []);

  // ── Controls auto-hide ─────────────────────────────────────────────────────

  /**
   * Start/restart the auto-hide countdown.
   * Call this on every user interaction to keep controls visible.
   */
  const resetHideTimer = useCallback(() => {
    clearControlsTimer();
    controlsTimerRef.current = setTimeout(() => {
      if (!isLocked) {
        hideControlsInStore();
      }
    }, CONTROLS_HIDE_DELAY_MS);
  }, [clearControlsTimer, hideControlsInStore, isLocked]);

  /**
   * Show controls and (re)start the auto-hide timer.
   * This is the primary call for any user interaction on the player.
   */
  const showControls = useCallback(() => {
    showControlsInStore();
    resetHideTimer();
  }, [showControlsInStore, resetHideTimer]);

  /**
   * Immediately hide controls without waiting for the timer.
   */
  const hideControls = useCallback(() => {
    clearControlsTimer();
    hideControlsInStore();
  }, [clearControlsTimer, hideControlsInStore]);

  /**
   * Keep controls visible indefinitely (e.g. while user is scrubbing seekbar).
   * Call `showControls()` to restore auto-hide when scrubbing ends.
   */
  const pauseHideTimer = useCallback(() => {
    clearControlsTimer();
  }, [clearControlsTimer]);

  // ── Gesture HUD auto-hide ─────────────────────────────────────────────────

  /**
   * Show a gesture HUD (brightness/volume/seek indicator) and auto-dismiss it.
   */
  const showHUD = useCallback((hud: Parameters<typeof setGestureHUD>[0]) => {
    setGestureHUD(hud);
    clearHudTimer();
    hudTimerRef.current = setTimeout(() => {
      setGestureHUD(null);
    }, HUD_HIDE_DELAY_MS);
  }, [setGestureHUD, clearHudTimer]);

  /**
   * Dismiss the HUD immediately.
   */
  const hideHUD = useCallback(() => {
    clearHudTimer();
    setGestureHUD(null);
  }, [clearHudTimer, setGestureHUD]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearControlsTimer();
      clearHudTimer();
    };
  }, [clearControlsTimer, clearHudTimer]);

  return {
    showControls,
    hideControls,
    pauseHideTimer,
    resetHideTimer,
    showHUD,
    hideHUD,
  };
}
