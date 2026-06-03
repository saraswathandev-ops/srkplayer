import type { PlaybackLogContext, PlaybackState, PlaybackSessionId } from "./player.types";

let sessionCounter = 0;

/**
 * Optional diagnostics sink. When set (by `services/playbackDiagnostics.ts`),
 * every player log line is forwarded here in addition to `console.log`, so the
 * 5-minute playback diagnostics recorder can capture the full session log
 * without changing any call sites. No-op when null.
 */
let diagnosticsSink: ((line: string) => void) | null = null;

export function setDiagnosticsSink(sink: ((line: string) => void) | null) {
  diagnosticsSink = sink;
}

function emit(line: string) {
  console.log(line);
  if (diagnosticsSink) {
    try {
      diagnosticsSink(line);
    } catch {
      // Never let diagnostics break logging.
    }
  }
}

export function createPlaybackSessionId(videoId?: string | null, generation = 0): PlaybackSessionId {
  sessionCounter += 1;
  const safeVideoId = videoId || "no-video";
  return `${safeVideoId}:${generation}:${Date.now().toString(36)}:${sessionCounter}`;
}

function formatContext(ctx: PlaybackLogContext) {
  const video = ctx.videoId ?? "unknown";
  const state = ctx.state ?? "unknown";
  const generation = Number.isFinite(ctx.generation) ? ctx.generation : 0;
  const attempt = Number.isFinite(ctx.startupAttempt) ? ctx.startupAttempt : 0;
  const tier = Number.isFinite(ctx.recoveryTier ?? NaN) ? ctx.recoveryTier : "none";
  return `session=${ctx.sessionId}][video=${video}][state=${state}][gen=${generation}][startupAttempt=${attempt}][recoveryTier=${tier}`;
}

export function logPlayback(ctx: PlaybackLogContext, event: string, data?: Record<string, unknown>) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  emit(`[Playback][${formatContext(ctx)}] ${event}${suffix}`);
}

export function logRecovery(
  ctx: PlaybackLogContext,
  event: string,
  data?: Record<string, unknown> & { tier?: number },
) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  emit(`[Recovery][${formatContext(ctx)}] ${event}${suffix}`);
}

export function logNativeState(ctx: PlaybackLogContext, event: string, data?: Record<string, unknown>) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  emit(`[NativeState][${formatContext(ctx)}] ${event}${suffix}`);
}

export function logVideoEvent(ctx: PlaybackLogContext, event: string, data?: Record<string, unknown>) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  emit(`[Video][${formatContext(ctx)}] ${event}${suffix}`);
}

export function logPlaybackStop(ctx: PlaybackLogContext, reason: string, data?: Record<string, unknown>) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  emit(`[PlaybackStop][${formatContext(ctx)}] reason=${reason}${suffix}`);
}

export function buildPlaybackLogContext(options: {
  sessionId: PlaybackSessionId;
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
    recoveryTier: options.recoveryTier,
  };
}
