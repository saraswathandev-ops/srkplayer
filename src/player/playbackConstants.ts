/**
 * playbackConstants.ts
 *
 * All timing constants for the production-grade playback lifecycle.
 * Changing a value here affects the entire playback engine — test carefully.
 */

import type { RecoveryTier } from './playbackTypes';

// ─── Health Monitoring ─────────────────────────────────────────────────────────
/** Lightweight health poll interval — catches silent deadlocks. */
export const HEALTH_POLL_INTERVAL_MS = 250;

/** No-progress stall threshold before triggering recovery. */
export const STALL_TIMEOUT_MS = 5000;

/** Ignore all recovery triggers for this long after requesting play.
 *  ExoPlayer needs time to spin up decoder, attach surface, fill buffer. */
export const STARTUP_GRACE_MS = 8000;

/** Any forward position step ≥ 50ms is considered "advancing". */
export const PROGRESS_ADVANCE_SECONDS = 0.05;

// ─── Stabilization ─────────────────────────────────────────────────────────────
/** Wall-clock time that must elapse during stabilization before confirming. */
export const STABILIZATION_ELAPSED_MS = 2000;

/** Position delta (seconds) that must be reached during stabilization. */
export const STABILIZATION_POSITION_DELTA = 1.5;

/** Small settle delay after onLoad before issuing play(). Gives ExoPlayer
 *  time to finish internal surface/buffer setup. */
export const STARTUP_SETTLE_BEFORE_PLAY_MS = 80;

// ─── Native Debounce ───────────────────────────────────────────────────────────
/** Debounce isPlaying=false toggles from ExoPlayer. Android frequently
 *  emits brief false signals during startup that must be ignored. */
export const NATIVE_FALSE_DEBOUNCE_MS = 300;

// ─── Recovery Tiers (tiered timing) ────────────────────────────────────────────
/** Per-tier delay before executing the recovery action.
 *  Tier 1 = immediate play reassert
 *  Tier 2 = seek nudge +0.1s after 2s cooldown
 *  Tier 3 = reload same source after 4s cooldown
 *  Tier 4 = remount Video component after 6s cooldown */
export const RECOVERY_TIER_DELAYS: Record<RecoveryTier, number> = {
  1: 0,
  2: 2000,
  3: 4000,
  4: 6000,
};

/** Maximum recovery attempts per startup session before giving up. */
export const MAX_RECOVERY_ATTEMPTS = 4;

/** Debounce between successive play() / resume() assertions.
 *  Multiple rapid play() calls confuse ExoPlayer's playWhenReady state. */
export const PLAY_ASSERT_COOLDOWN_MS = 2000;

// ─── Resume ────────────────────────────────────────────────────────────────────
/** If saved position is within the last N seconds of duration, restart at 0. */
export const RESUME_NEAR_END_SECONDS = 10;

/** Rewind N seconds from saved position on resume — gives context. */
export const RESUME_REWIND_SECONDS = 5;

/** Seek is "confirmed" when currentTime is within this threshold of target. */
export const SEEK_CONFIRM_THRESHOLD = 0.5;

/** Max time to wait for seek confirmation before retrying. */
export const SEEK_CONFIRM_TIMEOUT_MS = 3000;

/** Max seek retries before giving up. */
export const SEEK_RETRY_MAX = 3;

// ─── Position Save ─────────────────────────────────────────────────────────────
/** Auto-save playback position every N milliseconds while playing. */
export const SAVE_POSITION_INTERVAL_MS = 5000;
