/**
 * playbackLogger.ts
 *
 * Structured playback logging — every line includes session, video,
 * state, generation, startup attempt, and recovery tier context.
 *
 * Dev-only: all output is stripped in production via __DEV__ guard.
 *
 * Log format:
 *   [Playback][session=abc][video=vid123][state=stabilizing][gen=2][attempt=1][tier=none] event {data}
 */

import type { PlaybackLogContext, PlaybackState } from './playbackTypes';

const ENABLED = __DEV__;

// ─── Session ID ────────────────────────────────────────────────────────────────

let sessionCounter = 0;

/** Create a unique session ID for a playback session. */
export function createPlaybackSessionId(
  videoId?: string | null,
  generation = 0,
): string {
  sessionCounter += 1;
  const safeVideoId = videoId || 'no-video';
  return `${safeVideoId}:${generation}:${Date.now().toString(36)}:${sessionCounter}`;
}

// ─── Context Helpers ───────────────────────────────────────────────────────────

/** Build a PlaybackLogContext from current state. */
export function buildPlaybackLogContext(options: {
  sessionId: string;
  videoId?: string | null;
  state?: PlaybackState;
  generation?: number;
  startupAttempt?: number;
  recoveryTier?: number | null;
}): PlaybackLogContext {
  return {
    sessionId: options.sessionId,
    videoId: options.videoId,
    state: options.state,
    generation: options.generation,
    startupAttempt: options.startupAttempt,
    recoveryTier: options.recoveryTier as PlaybackLogContext['recoveryTier'],
  };
}

// ─── Internal Formatting ───────────────────────────────────────────────────────

function formatContext(ctx: PlaybackLogContext): string {
  const video = ctx.videoId ?? 'unknown';
  const state = ctx.state ?? 'unknown';
  const generation = Number.isFinite(ctx.generation) ? ctx.generation : 0;
  const attempt = Number.isFinite(ctx.startupAttempt) ? ctx.startupAttempt : 0;
  const tier = Number.isFinite(ctx.recoveryTier ?? NaN) ? ctx.recoveryTier : 'none';
  return `session=${ctx.sessionId}][video=${video}][state=${state}][gen=${generation}][attempt=${attempt}][tier=${tier}`;
}

function formatData(data?: Record<string, unknown>): string {
  if (!data) return '';
  try {
    return ` ${JSON.stringify(data)}`;
  } catch {
    return ' [unstringifiable]';
  }
}

// ─── Log Channels ──────────────────────────────────────────────────────────────

/** General playback events (state transitions, startup, stabilization). */
export function logPlayback(
  ctx: PlaybackLogContext,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!ENABLED) return;
  console.log(`[Playback][${formatContext(ctx)}] ${event}${formatData(data)}`);
}

/** Recovery events (tier selection, execution, cooldown). */
export function logRecovery(
  ctx: PlaybackLogContext,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!ENABLED) return;
  console.log(`[Recovery][${formatContext(ctx)}] ${event}${formatData(data)}`);
}

/** Native state changes (isPlaying, buffering, readyForDisplay). */
export function logNativeState(
  ctx: PlaybackLogContext,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!ENABLED) return;
  console.log(`[NativeState][${formatContext(ctx)}] ${event}${formatData(data)}`);
}

/** Video source events (load, error, end). */
export function logVideoEvent(
  ctx: PlaybackLogContext,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!ENABLED) return;
  console.log(`[Video][${formatContext(ctx)}] ${event}${formatData(data)}`);
}

/** Playback stop reasons (user pause, error, end, background). */
export function logPlaybackStop(
  ctx: PlaybackLogContext,
  reason: string,
  data?: Record<string, unknown>,
): void {
  if (!ENABLED) return;
  console.log(`[PlaybackStop][${formatContext(ctx)}] reason=${reason}${formatData(data)}`);
}

/** Health monitor events (poll results, stall detection, failure classification). */
export function logHealth(
  ctx: PlaybackLogContext,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!ENABLED) return;
  console.log(`[Health][${formatContext(ctx)}] ${event}${formatData(data)}`);
}

/** Lifecycle events (app background/foreground, audio focus). */
export function logLifecycle(
  ctx: PlaybackLogContext,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!ENABLED) return;
  console.log(`[Lifecycle][${formatContext(ctx)}] ${event}${formatData(data)}`);
}
