/**
 * useHealthMonitor.ts
 *
 * Hybrid health monitoring system:
 *   1. 250ms lightweight polling — catches silent deadlocks
 *   2. Event-driven stall timer — reset on each onProgress
 *
 * Classifies failures into 7 types and triggers recovery only when
 * ALL health signals fail simultaneously.
 *
 * Avoids false recovery during:
 *   - Active buffering
 *   - Startup grace window (8s)
 *   - Intentional pause
 *   - App background
 *   - Recovery cooldown
 *   - Native false debounce active
 */
import { useCallback, useEffect, useRef } from 'react';

import {
  HEALTH_POLL_INTERVAL_MS,
  NATIVE_ACK_FRESH_MS,
  RECOVERY_TIER_DELAYS,
  STALL_TIMEOUT_MS,
  STARTUP_GRACE_MS,
} from '@/src/player/playbackConstants';
import type { RecoveryTier } from '@/src/player/playbackTypes';
import { logHealth } from '@/src/player/playbackLogger';
import { isActivePlaybackState } from '@/src/player/playbackReducer';
import type {
  PlaybackFailureReason,
  PlaybackHealthSnapshot,
  PlaybackLogContext,
  PlaybackState,
} from '@/src/player/playbackTypes';

// ─── Health Evaluation ─────────────────────────────────────────────────────────

function evaluateHealth(snapshot: PlaybackHealthSnapshot): boolean {
  const { now } = snapshot;

  // Startup grace — ExoPlayer needs time to spin up
  if (
    snapshot.playbackStartAt > 0 &&
    now - snapshot.playbackStartAt < snapshot.startupGraceMs
  ) {
    return true;
  }

  // Recent progress — player is advancing normally
  if (now - snapshot.lastProgressAt < 2500) return true;

  // Active buffering — expected wait
  if (snapshot.isBuffering) return true;

  // Recovery cooldown — just kicked, give it time
  if (
    snapshot.lastRecoveryAt > 0 &&
    now - snapshot.lastRecoveryAt < snapshot.recoveryCooldownMs
  ) {
    return true;
  }

  // Native ack — ExoPlayer recently confirmed playing
  if (
    snapshot.lastNativeAckPlayingAt > 0 &&
    now - snapshot.lastNativeAckPlayingAt < 3000
  ) {
    return true;
  }

  // App background — don't trigger recovery
  if (snapshot.appInBackground) return true;

  // Native false debounce active — transient toggle, wait for confirm
  if (snapshot.hasNativeFalseToggle) return true;

  return false;
}

// ─── Failure Classification ────────────────────────────────────────────────────

function classifyFailure(
  snapshot: PlaybackHealthSnapshot,
  phase: PlaybackState,
): PlaybackFailureReason {
  if (snapshot.isBuffering) return 'buffering';
  if (snapshot.appInBackground) return 'audio_focus_loss';

  // Dual-signal liveness: if a native event landed within NATIVE_ACK_FRESH_MS
  // the decoder is provably alive — JS progress silence is almost certainly
  // a JS-thread hitch (subtitle scan, store fan-out, GC pause). Don't
  // recover; the recovery ladder would only thrash a healthy player.
  const nativeAckAge = snapshot.now - snapshot.lastNativeAckPlayingAt;
  const nativeFresh =
    snapshot.lastNativeAckPlayingAt > 0 && nativeAckAge < NATIVE_ACK_FRESH_MS;

  if (phase === 'stabilizing' || phase === 'starting') {
    if (!snapshot.isNativePlaying) return 'surface_lost';
    if (snapshot.now - snapshot.lastProgressAt > 2500) {
      return nativeFresh ? 'js_starvation' : 'decoder_stall';
    }
    return 'unexpected_pause';
  }

  if (snapshot.now - snapshot.lastProgressAt > STALL_TIMEOUT_MS) {
    return nativeFresh ? 'js_starvation' : 'decoder_stall';
  }

  return 'unknown';
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useHealthMonitor(
  buildLogContext: () => PlaybackLogContext,
  getPlaybackState: () => PlaybackState,
  onUnhealthyDetected: (reason: PlaybackFailureReason) => void,
  isNativePlayingRef: React.MutableRefObject<boolean>,
  hasNativeFalseToggleRef: React.MutableRefObject<boolean>,
  lastNativeAckPlayingAtRef: React.MutableRefObject<number>,
  lastRecoveryAtRef: React.MutableRefObject<number>,
  recoveryAttemptCountRef: React.MutableRefObject<number>,
  isBackgroundRef: React.MutableRefObject<boolean>,
  isBufferingRef: React.MutableRefObject<boolean>,
) {
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHealthyProgressRef = useRef({ time: 0, position: 0 });
  const playbackStartAtRef = useRef(0);

  // ── Event-driven: reset stall timer on each onProgress ─────────────────

  const onProgressHealthUpdate = useCallback(
    (currentTime: number) => {
      lastHealthyProgressRef.current = {
        time: Date.now(),
        position: currentTime,
      };

      // Clear and reset stall timeout
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
      }

      stallTimerRef.current = setTimeout(() => {
        // No progress for STALL_TIMEOUT_MS → classify and (maybe) recover
        const phase = getPlaybackState();
        if (!isActivePlaybackState(phase)) return;
        if (isBackgroundRef.current) return;

        const snapshot = buildSnapshot();
        const reason = classifyFailure(snapshot, phase);
        const diagnostics = {
          reason,
          phase,
          jsProgressAgeMs: snapshot.now - snapshot.lastProgressAt,
          nativeAckAgeMs:
            snapshot.lastNativeAckPlayingAt > 0
              ? snapshot.now - snapshot.lastNativeAckPlayingAt
              : -1,
          isNativePlaying: snapshot.isNativePlaying,
          isBuffering: snapshot.isBuffering,
          recoveryTierActive: recoveryAttemptCountRef.current,
        };

        // Dual-signal liveness gate: native is provably alive — log only,
        // do NOT escalate to the recovery ladder. Classified as
        // js_starvation so post-hoc telemetry can attribute correctly.
        if (reason === 'js_starvation') {
          logHealth(
            buildLogContext(),
            'stall_classified_js_starvation',
            diagnostics,
          );
          return;
        }

        logHealth(buildLogContext(), 'stall_timer_fired', diagnostics);
        onUnhealthyDetected(reason);
      }, STALL_TIMEOUT_MS);
    },
    [buildLogContext, getPlaybackState, onUnhealthyDetected, isBackgroundRef],
  );

  // ── Snapshot builder ───────────────────────────────────────────────────────

  const buildSnapshot = useCallback((): PlaybackHealthSnapshot => {
    const now = Date.now();
    const nextTier = Math.min(
      Math.max(recoveryAttemptCountRef.current + 1, 1),
      4,
    ) as RecoveryTier;
    return {
      now,
      playbackStartAt: playbackStartAtRef.current,
      lastProgressAt: lastHealthyProgressRef.current.time,
      lastProgressPosition: lastHealthyProgressRef.current.position,
      lastRecoveryAt: lastRecoveryAtRef.current,
      lastNativeAckPlayingAt: lastNativeAckPlayingAtRef.current,
      isBuffering: isBufferingRef.current,
      isNativePlaying: isNativePlayingRef.current,
      startupGraceMs: STARTUP_GRACE_MS,
      recoveryCooldownMs:
        RECOVERY_TIER_DELAYS[nextTier] ?? RECOVERY_TIER_DELAYS[4],
      appInBackground: isBackgroundRef.current,
      hasNativeFalseToggle: hasNativeFalseToggleRef.current,
    };
  }, [
    isNativePlayingRef,
    hasNativeFalseToggleRef,
    lastNativeAckPlayingAtRef,
    lastRecoveryAtRef,
    recoveryAttemptCountRef,
    isBackgroundRef,
    isBufferingRef,
  ]);

  // ── 250ms polling: catch silent deadlocks ──────────────────────────────────

  const startPolling = useCallback(() => {
    stopPolling();
    playbackStartAtRef.current = Date.now();

    pollIntervalRef.current = setInterval(() => {
      const phase = getPlaybackState();

      // Skip health checks for non-active states
      if (!isActivePlaybackState(phase)) return;

      // Skip when backgrounded
      if (isBackgroundRef.current) return;

      const snapshot = buildSnapshot();
      const healthy = evaluateHealth(snapshot);

      if (!healthy) {
        const reason = classifyFailure(snapshot, phase);
        const diagnostics = {
          reason,
          phase,
          jsProgressAgeMs: snapshot.now - snapshot.lastProgressAt,
          nativeAckAgeMs:
            snapshot.lastNativeAckPlayingAt > 0
              ? snapshot.now - snapshot.lastNativeAckPlayingAt
              : -1,
          isNativePlaying: snapshot.isNativePlaying,
          isBuffering: snapshot.isBuffering,
          recoveryTierActive: recoveryAttemptCountRef.current,
        };

        // Same dual-signal gate as the stall timer path.
        if (reason === 'js_starvation') {
          logHealth(
            buildLogContext(),
            'poll_classified_js_starvation',
            diagnostics,
          );
          return;
        }

        logHealth(buildLogContext(), 'poll_unhealthy_detected', diagnostics);
        onUnhealthyDetected(reason);
      }
    }, HEALTH_POLL_INTERVAL_MS);
  }, [
    buildLogContext,
    buildSnapshot,
    getPlaybackState,
    isBackgroundRef,
    onUnhealthyDetected,
  ]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /** Stop all health timers — called on video switch, pause, end. */
  const stopAllTimers = useCallback(() => {
    stopPolling();
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, [stopPolling]);

  /** Reset health state — called on video switch. */
  const resetHealth = useCallback(() => {
    stopAllTimers();
    lastHealthyProgressRef.current = { time: 0, position: 0 };
    playbackStartAtRef.current = 0;
  }, [stopAllTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    onProgressHealthUpdate,
    startPolling,
    stopPolling,
    stopAllTimers,
    resetHealth,
    playbackStartAtRef,
  };
}
