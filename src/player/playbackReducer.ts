/**
 * playbackReducer.ts
 *
 * Deterministic state machine for the playback lifecycle.
 * Uses React's useReducer pattern — transitions are validated against
 * a strict transition table. Invalid transitions are logged and blocked.
 *
 * The reducer is the AUTHORITATIVE source of playback state.
 * Zustand only mirrors this for UI consumption.
 */

import type {
  PlaybackAction,
  PlaybackReducerState,
  PlaybackState,
} from './playbackTypes';

// ─── Transition Table (next-by-next) ───────────────────────────────────────────
// Each state lists its allowed next states. Any transition not in the table
// is logged as a warning and BLOCKED (state remains unchanged).

const TRANSITIONS: Record<PlaybackState, PlaybackState[]> = {
  idle:        ['resolving', 'loading', 'paused', 'error'],
  resolving:   ['validating', 'loading', 'error', 'idle'],
  validating:  ['loading', 'error', 'idle'],
  loading:     ['starting', 'seeking', 'paused', 'error', 'idle'],
  starting:    ['stabilizing', 'buffering', 'recovering', 'paused', 'ended', 'error', 'idle'],
  stabilizing: ['playing', 'buffering', 'recovering', 'paused', 'ended', 'error', 'idle'],
  playing:     ['buffering', 'seeking', 'recovering', 'paused', 'ended', 'error', 'idle'],
  buffering:   ['starting', 'stabilizing', 'playing', 'recovering', 'paused', 'ended', 'error', 'idle'],
  seeking:     ['stabilizing', 'playing', 'buffering', 'paused', 'recovering', 'ended', 'error'],
  recovering:  ['loading', 'seeking', 'starting', 'stabilizing', 'playing', 'buffering', 'paused', 'ended', 'error', 'idle'],
  paused:      ['starting', 'stabilizing', 'playing', 'loading', 'ended', 'error', 'idle'],
  ended:       ['idle', 'loading', 'starting'],
  error:       ['idle', 'loading', 'starting'],
};

// ─── Initial State ─────────────────────────────────────────────────────────────

export const INITIAL_REDUCER_STATE: PlaybackReducerState = {
  playbackState: 'idle',
  previousState: 'idle',
  generation: 0,
  startupAttempt: 0,
  recoveryTier: null,
  recoveryCount: 0,
  failureReason: null,
  isResuming: false,
  resumedFromSaved: false,
  lastTransitionReason: null,
  lastTransitionAt: 0,
};

// ─── Reducer ───────────────────────────────────────────────────────────────────

export function playbackReducer(
  state: PlaybackReducerState,
  action: PlaybackAction,
): PlaybackReducerState {
  switch (action.type) {
    case 'TRANSITION': {
      // No-op if same state
      if (action.next === state.playbackState) return state;

      // Validate transition
      const allowed = TRANSITIONS[state.playbackState] ?? [];
      if (!allowed.includes(action.next)) {
        if (__DEV__) {
          console.warn(
            `[PlaybackSM] BLOCKED: ${state.playbackState} → ${action.next} (reason: ${action.reason})`,
          );
        }
        return state;
      }

      return {
        ...state,
        previousState: state.playbackState,
        playbackState: action.next,
        lastTransitionReason: action.reason,
        lastTransitionAt: Date.now(),
      };
    }

    case 'INCREMENT_GENERATION':
      return {
        ...state,
        generation: state.generation + 1,
      };

    case 'SET_STARTUP_ATTEMPT':
      return {
        ...state,
        startupAttempt: action.attempt,
      };

    case 'SET_RECOVERY_TIER':
      return {
        ...state,
        recoveryTier: action.tier,
      };

    case 'INCREMENT_RECOVERY':
      return {
        ...state,
        recoveryCount: state.recoveryCount + 1,
      };

    case 'SET_FAILURE_REASON':
      return {
        ...state,
        failureReason: action.reason,
      };

    case 'SET_RESUMING':
      return {
        ...state,
        isResuming: action.isResuming,
        resumedFromSaved: action.resumedFromSaved,
      };

    case 'RESET_FOR_NEW_VIDEO':
      return {
        ...INITIAL_REDUCER_STATE,
        // Carry forward generation incremented by 1
        generation: state.generation + 1,
      };

    default:
      return state;
  }
}

// ─── State Predicates ──────────────────────────────────────────────────────────

/** True during the startup pipeline (loading/starting/stabilizing). */
export function isStartupState(state: PlaybackState): boolean {
  return state === 'loading' || state === 'starting' || state === 'stabilizing';
}

/** True when playback has reached a terminal state (ended/error). */
export function isTerminalState(state: PlaybackState): boolean {
  return state === 'ended' || state === 'error';
}

/** True when the current state allows recovery actions. */
export function canRecoverFromState(state: PlaybackState): boolean {
  return (
    state === 'starting' ||
    state === 'stabilizing' ||
    state === 'playing' ||
    state === 'buffering'
  );
}

/** True when state is actively playing or trying to play. */
export function isActivePlaybackState(state: PlaybackState): boolean {
  return (
    state === 'starting' ||
    state === 'stabilizing' ||
    state === 'playing' ||
    state === 'buffering' ||
    state === 'seeking' ||
    state === 'recovering'
  );
}
