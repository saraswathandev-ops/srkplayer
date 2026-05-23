import type { StartupMetrics } from "./player.types";

export const STARTUP_STABILIZATION_SECONDS = 1.5;
export const STARTUP_STABILIZATION_MS = 1500;
export const STARTUP_SETTLE_BEFORE_PLAY_MS = 80;
export const RESUME_NEAR_END_RESET_SECONDS = 10;

export function shouldConfirmStartupStable(options: {
  currentTime: number;
  stabilizationStartPosition: number;
  stabilizationStartedAt: number;
  now: number;
}) {
  const delta = options.currentTime - options.stabilizationStartPosition;
  const elapsed = options.now - options.stabilizationStartedAt;
  return delta > STARTUP_STABILIZATION_SECONDS || elapsed >= STARTUP_STABILIZATION_MS;
}

export function resolveStartupSeekPosition(options: {
  requestedPosition: number;
  duration: number;
}) {
  const requested = Number.isFinite(options.requestedPosition)
    ? Math.max(options.requestedPosition, 0)
    : 0;
  const duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 0;
  if (duration > 0 && requested >= Math.max(duration - RESUME_NEAR_END_RESET_SECONDS, 0)) {
    return 0;
  }
  if (duration > 0) {
    return Math.min(requested, Math.max(duration - 1, 0));
  }
  return requested;
}

export function buildStartupMetricsLog(metrics: StartupMetrics) {
  const startupMs =
    metrics.loadedAt > 0 && metrics.navigationAt > 0 ? metrics.loadedAt - metrics.navigationAt : 0;
  const stabilizationMs =
    metrics.stabilizationConfirmedAt > 0 && metrics.stabilizationStartedAt > 0
      ? metrics.stabilizationConfirmedAt - metrics.stabilizationStartedAt
      : 0;
  return {
    startupMs,
    stabilizationMs,
    recoveryCount: metrics.recoveryCount,
    rebufferCount: metrics.rebufferCount,
    stallCount: metrics.stallCount,
    success: metrics.success,
  };
}
