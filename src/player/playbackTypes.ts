/**
 * playbackTypes.ts
 *
 * Comprehensive type definitions for the production-grade playback lifecycle.
 * Used by the reducer state machine, health monitor, recovery controller,
 * startup/resume controllers, native event adapter, and structured logger.
 */

// ─── State Machine ─────────────────────────────────────────────────────────────

/**
 * Explicit playback state machine.
 *
 * State flow:
 *   idle → resolving → validating → loading → starting → stabilizing → playing
 *
 * Only valid transitions are allowed — the reducer blocks invalid ones.
 */
export type PlaybackState =
  | 'idle'
  | 'resolving'
  | 'validating'
  | 'loading'
  | 'starting'
  | 'stabilizing'
  | 'playing'
  | 'buffering'
  | 'paused'
  | 'seeking'
  | 'recovering'
  | 'ended'
  | 'error';

/**
 * Reason attached to every state transition — enables structured debugging.
 */
export type PlaybackTransitionReason =
  | 'screen_mount'
  | 'video_switch_reset'
  | 'source_validated'
  | 'start_requested'
  | 'source_loaded'
  | 'native_started_stabilizing'
  | 'startup_stable'
  | 'startup_unstable'
  | 'seek_started'
  | 'seek_completed'
  | 'startup_timeout'
  | 'progress_advanced'
  | 'native_playing_ack'
  | 'native_buffering'
  | 'native_buffering_cleared'
  | 'user_pause'
  | 'user_resume'
  | 'recovery_started'
  | 'recovery_tier_1'
  | 'recovery_tier_2'
  | 'recovery_tier_3'
  | 'recovery_tier_4'
  | 'audio_focus_or_noisy'
  | 'playback_error'
  | 'playback_ended'
  | 'lifecycle_background'
  | 'lifecycle_foreground'
  // Phase 6/7 Fast path transition reasons.
  | 'fast_play_issued'
  | 'fast_source_loaded'
  | 'fast_startup_stable'
  | 'manual';

// ─── Failure Classification ────────────────────────────────────────────────────

/**
 * Classifies why playback failed — drives recovery tier selection and logging.
 */
export type PlaybackFailureReason =
  | 'buffering'
  | 'decoder_stall'
  | 'surface_lost'
  | 'audio_focus_loss'
  | 'unexpected_pause'
  | 'startup_timeout'
  | 'native_reset'
  | 'js_starvation'
  | 'unknown';

// ─── Recovery ──────────────────────────────────────────────────────────────────

/**
 * Recovery escalation tiers:
 *   1 = play() reassert (immediate)
 *   2 = seek nudge +0.1s (after 2s)
 *   3 = reload same source (after 4s)
 *   4 = remount Video component (after 6s)
 */
export type RecoveryTier = 1 | 2 | 3 | 4;

// ─── Intent Queue ──────────────────────────────────────────────────────────────

/**
 * Queued playback intents — prevents race conditions from overlapping
 * play/seek/reload/resume actions. The intent queue serialises actions
 * and enforces seek-confirmation-before-play.
 */
export interface PlaybackIntent {
  shouldPlay: boolean;
  pendingSeek: number | null;
  pendingReload: boolean;
  pendingResume: boolean;
  seekConfirmed: boolean;
}

// ─── Startup Metrics ───────────────────────────────────────────────────────────

/**
 * Timestamps and counters captured during a single startup attempt.
 * All timestamps are `Date.now()` values; 0 means "not yet recorded".
 */
export interface StartupMetrics {
  navigationAt: number;
  sourceValidatedAt: number;
  loadStartAt: number;
  loadedAt: number;
  firstProgressAt: number;
  nativePlayingAckAt: number;
  stabilizationStartedAt: number;
  stabilizationConfirmedAt: number;
  startupAttempt: number;
  recoveryCount: number;
  rebufferCount: number;
  stallCount: number;
  success: boolean;
}

// ─── Health Snapshot ───────────────────────────────────────────────────────────

/**
 * Point-in-time snapshot fed to the health evaluator on each 250ms poll tick.
 */
export interface PlaybackHealthSnapshot {
  now: number;
  playbackStartAt: number;
  lastProgressAt: number;
  lastProgressPosition: number;
  lastRecoveryAt: number;
  lastNativeAckPlayingAt: number;
  isBuffering: boolean;
  isNativePlaying: boolean;
  startupGraceMs: number;
  recoveryCooldownMs: number;
  appInBackground: boolean;
  hasNativeFalseToggle: boolean;
}

// ─── Log Context ───────────────────────────────────────────────────────────────

/**
 * Context passed to every structured log call — appears in every log line.
 */
export interface PlaybackLogContext {
  sessionId: string;
  videoId?: string | null;
  state?: PlaybackState;
  generation?: number;
  startupAttempt?: number;
  recoveryTier?: RecoveryTier | null;
}

// ─── Reducer State ─────────────────────────────────────────────────────────────

/**
 * The authoritative playback state — managed by `useReducer`.
 * Zustand only mirrors this for UI consumption.
 */
export interface PlaybackReducerState {
  playbackState: PlaybackState;
  previousState: PlaybackState;
  generation: number;
  startupAttempt: number;
  recoveryTier: RecoveryTier | null;
  recoveryCount: number;
  failureReason: PlaybackFailureReason | null;
  isResuming: boolean;
  resumedFromSaved: boolean;
  lastTransitionReason: PlaybackTransitionReason | null;
  lastTransitionAt: number;
}

// ─── Reducer Actions ───────────────────────────────────────────────────────────

export type PlaybackAction =
  | { type: 'TRANSITION'; next: PlaybackState; reason: PlaybackTransitionReason }
  | { type: 'INCREMENT_GENERATION' }
  | { type: 'SET_STARTUP_ATTEMPT'; attempt: number }
  | { type: 'SET_RECOVERY_TIER'; tier: RecoveryTier | null }
  | { type: 'INCREMENT_RECOVERY' }
  | { type: 'SET_FAILURE_REASON'; reason: PlaybackFailureReason | null }
  | { type: 'SET_RESUMING'; isResuming: boolean; resumedFromSaved: boolean }
  | { type: 'RESET_FOR_NEW_VIDEO' };
