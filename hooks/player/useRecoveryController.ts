/**
 * useRecoveryController.ts
 *
 * 4-tier recovery system with progressive delays:
 *   Tier 1: play() reassert     — immediate
 *   Tier 2: seek nudge +0.1s    — after 2s
 *   Tier 3: reload same source  — after 4s
 *   Tier 4: remount Video       — after 6s
 *
 * Guards:
 *   - Generation-safe: ignore stale recovery timers
 *   - Max 4 attempts per startup session
 *   - Recovery storm prevention via tiered cooldowns
 */
import { useCallback, useRef } from 'react';
import type { VideoRef } from 'react-native-video';

import {
  MAX_RECOVERY_ATTEMPTS,
  RECOVERY_TIER_DELAYS,
} from '@/src/player/playbackConstants';
import { logRecovery } from '@/src/player/playbackLogger';
import type {
  PlaybackFailureReason,
  PlaybackLogContext,
  PlaybackState,
  PlaybackTransitionReason,
  RecoveryTier,
} from '@/src/player/playbackTypes';
import { canRecoverFromState } from '@/src/player/playbackReducer';
import { usePlayerStore } from '@/store/playerStore';

export function useRecoveryController(
  videoRef: React.RefObject<VideoRef | null>,
  buildLogContext: () => PlaybackLogContext,
  transition: (next: PlaybackState, reason: PlaybackTransitionReason) => void,
  dispatchSetRecoveryTier: (tier: RecoveryTier | null) => void,
  dispatchIncrementRecovery: () => void,
  generationRef: React.MutableRefObject<number>,
  intentQueueReset: () => void,
  intentQueueQueuePlay: () => void,
  remountTrigger: () => void,
) {
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecoveryAtRef = useRef(0);
  const attemptCountRef = useRef(0);

  /**
   * Attempt recovery at the next tier.
   * Schedules the appropriate action after the tier-specific delay.
   */
  const attemptRecovery = useCallback(
    (failureReason: PlaybackFailureReason, currentState: PlaybackState) => {
      // Defense-in-depth: js_starvation is classified upstream in
      // useHealthMonitor and should never reach the recovery controller.
      // Gate it here too so any future caller wired to attemptRecovery
      // cannot accidentally escalate a JS-thread hitch into a remount.
      if (failureReason === 'js_starvation') {
        logRecovery(buildLogContext(), 'recovery_blocked_js_starvation', {
          state: currentState,
        });
        return;
      }

      // Guard: can we recover from this state?
      if (!canRecoverFromState(currentState)) {
        logRecovery(buildLogContext(), 'recovery_blocked_by_state', {
          state: currentState,
          failureReason,
        });
        return;
      }

      // Guard: max attempts
      if (attemptCountRef.current >= MAX_RECOVERY_ATTEMPTS) {
        logRecovery(buildLogContext(), 'max_recovery_attempts_reached', {
          count: attemptCountRef.current,
          failureReason,
        });
        transition('error', 'playback_error');
        return;
      }

      // Cancel any pending recovery timer
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }

      attemptCountRef.current += 1;
      const tier = Math.min(attemptCountRef.current, 4) as RecoveryTier;
      const delay = RECOVERY_TIER_DELAYS[tier];
      const capturedGeneration = generationRef.current;

      dispatchSetRecoveryTier(tier);
      dispatchIncrementRecovery();
      transition('recovering', 'recovery_started');

      logRecovery(buildLogContext(), `tier_${tier}_scheduled`, {
        delay,
        failureReason,
        attempt: attemptCountRef.current,
      });

      const executeRecovery = () => {
        // Generation guard — abort if stale
        if (capturedGeneration !== generationRef.current) {
          logRecovery(buildLogContext(), 'recovery_aborted_stale_generation', {
            expected: capturedGeneration,
            actual: generationRef.current,
          });
          return;
        }

        logRecovery(buildLogContext(), `tier_${tier}_executing`, {
          failureReason,
        });

        switch (tier) {
          case 1: {
            // Play reassert
            videoRef.current?.resume();
            transition('starting', 'recovery_tier_1');
            break;
          }
          case 2: {
            // Seek nudge (+0.1s)
            const currentTime = usePlayerStore.getState().currentTime;
            videoRef.current?.seek(currentTime + 0.1);
            intentQueueQueuePlay();
            transition('seeking', 'recovery_tier_2');
            break;
          }
          case 3: {
            // Reload source — reset intents and trigger source reload
            intentQueueReset();
            transition('loading', 'recovery_tier_3');
            break;
          }
          case 4: {
            // Remount Video component
            intentQueueReset();
            remountTrigger();
            transition('idle', 'recovery_tier_4');
            break;
          }
        }

        lastRecoveryAtRef.current = Date.now();
      };

      if (delay === 0) {
        // Tier 1: immediate but async (next tick)
        recoveryTimerRef.current = setTimeout(executeRecovery, 0);
      } else {
        recoveryTimerRef.current = setTimeout(executeRecovery, delay);
      }
    },
    [
      buildLogContext,
      transition,
      dispatchSetRecoveryTier,
      dispatchIncrementRecovery,
      generationRef,
      videoRef,
      intentQueueReset,
      intentQueueQueuePlay,
      remountTrigger,
    ],
  );

  /** Reset all recovery state — called on video switch or successful playback. */
  const resetRecovery = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    attemptCountRef.current = 0;
    lastRecoveryAtRef.current = 0;
    dispatchSetRecoveryTier(null);
  }, [dispatchSetRecoveryTier]);

  /** Check if we're in recovery cooldown for a given tier. */
  const isInCooldown = useCallback((): boolean => {
    if (lastRecoveryAtRef.current === 0) return false;
    const nextTier = Math.min(attemptCountRef.current + 1, 4) as RecoveryTier;
    const cooldown = RECOVERY_TIER_DELAYS[nextTier];
    return Date.now() - lastRecoveryAtRef.current < cooldown;
  }, []);

  return {
    attemptRecovery,
    resetRecovery,
    isInCooldown,
    lastRecoveryAtRef,
    attemptCountRef,
  };
}
