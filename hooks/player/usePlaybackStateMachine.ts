/**
 * usePlaybackStateMachine.ts
 *
 * Wraps the playback reducer with typed helpers and syncs authoritative
 * state to the Zustand store for UI consumption.
 *
 * This is the SINGLE SOURCE OF TRUTH for playback phase.
 * Zustand is a read-only mirror.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import {
  playbackReducer,
  INITIAL_REDUCER_STATE,
} from '@/src/player/playbackReducer';
import {
  createPlaybackSessionId,
  buildPlaybackLogContext,
  logPlayback,
} from '@/src/player/playbackLogger';
import type {
  PlaybackLogContext,
  PlaybackReducerState,
  PlaybackState,
  PlaybackTransitionReason,
  PlaybackFailureReason,
  RecoveryTier,
} from '@/src/player/playbackTypes';
import { usePlayerStore } from '@/store/playerStore';

export function usePlaybackStateMachine(videoId: string | undefined) {
  const [state, dispatch] = useReducer(playbackReducer, INITIAL_REDUCER_STATE);

  // Mutable ref mirrors for generation — avoids stale closures in async code
  const generationRef = useRef(state.generation);
  generationRef.current = state.generation;

  // Session ID — regenerated on video change
  const sessionIdRef = useRef(
    createPlaybackSessionId(videoId, state.generation),
  );

  // ── Build log context from current state ───────────────────────────────────

  const buildLogContext = useCallback((): PlaybackLogContext => {
    return buildPlaybackLogContext({
      sessionId: sessionIdRef.current,
      videoId,
      state: state.playbackState,
      generation: state.generation,
      startupAttempt: state.startupAttempt,
      recoveryTier: state.recoveryTier,
    });
  }, [
    videoId,
    state.playbackState,
    state.generation,
    state.startupAttempt,
    state.recoveryTier,
  ]);

  // ── Sync reducer state → Zustand store ─────────────────────────────────────
  // Uses getState() to avoid subscribing. The store setters may not exist
  // until Phase 4 adds them — the optional chaining makes this safe.

  useEffect(() => {
    const store = usePlayerStore.getState();
    store.setPlaybackPhase?.(state.playbackState);
    store.setSourceGeneration?.(state.generation);
    store.setRecoveryTier?.(state.recoveryTier);
    store.setIsResuming?.(state.isResuming);
    store.setResumedFromSaved?.(state.resumedFromSaved);
    store.setStartupAttempt?.(state.startupAttempt);
  }, [
    state.playbackState,
    state.generation,
    state.recoveryTier,
    state.isResuming,
    state.resumedFromSaved,
    state.startupAttempt,
  ]);

  // ── Typed transition with structured logging ───────────────────────────────

  const transition = useCallback(
    (next: PlaybackState, reason: PlaybackTransitionReason) => {
      logPlayback(buildLogContext(), 'phase_transition', {
        from: state.playbackState,
        to: next,
        reason,
      });
      dispatch({ type: 'TRANSITION', next, reason });
    },
    [buildLogContext, state.playbackState],
  );

  // ── Thin dispatch wrappers ─────────────────────────────────────────────────

  const incrementGeneration = useCallback(() => {
    dispatch({ type: 'INCREMENT_GENERATION' });
    sessionIdRef.current = createPlaybackSessionId(
      videoId,
      generationRef.current + 1,
    );
  }, [videoId]);

  const resetForNewVideo = useCallback(() => {
    dispatch({ type: 'RESET_FOR_NEW_VIDEO' });
    sessionIdRef.current = createPlaybackSessionId(
      videoId,
      generationRef.current + 1,
    );
  }, [videoId]);

  const setRecoveryTier = useCallback((tier: RecoveryTier | null) => {
    dispatch({ type: 'SET_RECOVERY_TIER', tier });
  }, []);

  const incrementRecovery = useCallback(() => {
    dispatch({ type: 'INCREMENT_RECOVERY' });
  }, []);

  const setFailureReason = useCallback(
    (reason: PlaybackFailureReason | null) => {
      dispatch({ type: 'SET_FAILURE_REASON', reason });
    },
    [],
  );

  const setResuming = useCallback(
    (isResuming: boolean, resumedFromSaved: boolean) => {
      dispatch({ type: 'SET_RESUMING', isResuming, resumedFromSaved });
    },
    [],
  );

  const setStartupAttempt = useCallback((attempt: number) => {
    dispatch({ type: 'SET_STARTUP_ATTEMPT', attempt });
  }, []);

  return {
    state,
    dispatch,
    transition,
    incrementGeneration,
    resetForNewVideo,
    setRecoveryTier,
    incrementRecovery,
    setFailureReason,
    setResuming,
    setStartupAttempt,
    buildLogContext,
    generationRef,
    sessionId: sessionIdRef.current,
  };
}
