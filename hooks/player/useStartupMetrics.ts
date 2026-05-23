/**
 * useStartupMetrics.ts
 *
 * Tracks startup performance data via refs — zero re-renders.
 * Records timestamps for each pipeline stage and computes
 * derived metrics (startupMs, stabilizationMs).
 */
import { useCallback, useRef } from 'react';

import { logPlayback } from '@/src/player/playbackLogger';
import type { StartupMetrics, PlaybackLogContext } from '@/src/player/playbackTypes';

// ─── Factory ────────────────────────────────────────────────────────────────

function createEmptyMetrics(): StartupMetrics {
  return {
    navigationAt: 0,
    sourceValidatedAt: 0,
    loadStartAt: 0,
    loadedAt: 0,
    firstProgressAt: 0,
    nativePlayingAckAt: 0,
    stabilizationStartedAt: 0,
    stabilizationConfirmedAt: 0,
    startupAttempt: 0,
    recoveryCount: 0,
    rebufferCount: 0,
    stallCount: 0,
    success: false,
  };
}

// ─── Timestamp field type guard ──────────────────────────────────────────────

type TimestampField =
  | 'navigationAt'
  | 'sourceValidatedAt'
  | 'loadStartAt'
  | 'loadedAt'
  | 'firstProgressAt'
  | 'nativePlayingAckAt'
  | 'stabilizationStartedAt'
  | 'stabilizationConfirmedAt';

type CounterField = 'recoveryCount' | 'rebufferCount' | 'stallCount';

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useStartupMetrics(
  buildLogContext: () => PlaybackLogContext,
) {
  const metricsRef = useRef<StartupMetrics>(createEmptyMetrics());

  /** Record a timestamp for a specific pipeline stage. */
  const recordTimestamp = useCallback((field: TimestampField) => {
    metricsRef.current[field] = Date.now();
  }, []);

  /** Increment a counter (recovery, rebuffer, stall). */
  const incrementCounter = useCallback((field: CounterField) => {
    metricsRef.current[field] += 1;
  }, []);

  /** Set the current startup attempt number. */
  const setStartupAttempt = useCallback((attempt: number) => {
    metricsRef.current.startupAttempt = attempt;
  }, []);

  /** Mark the startup as successful. */
  const markSuccess = useCallback(() => {
    metricsRef.current.success = true;
  }, []);

  /** Compute derived metrics from raw timestamps. */
  const getComputedMetrics = useCallback(() => {
    const m = metricsRef.current;
    return {
      startupMs:
        m.loadedAt > 0 && m.navigationAt > 0
          ? m.loadedAt - m.navigationAt
          : 0,
      stabilizationMs:
        m.stabilizationConfirmedAt > 0 && m.stabilizationStartedAt > 0
          ? m.stabilizationConfirmedAt - m.stabilizationStartedAt
          : 0,
      recoveryCount: m.recoveryCount,
      rebufferCount: m.rebufferCount,
      stallCount: m.stallCount,
      success: m.success,
      startupAttempt: m.startupAttempt,
    };
  }, []);

  /** Log a summary of startup metrics via structured logger. */
  const logMetricsSummary = useCallback(() => {
    logPlayback(buildLogContext(), 'startup_metrics', getComputedMetrics());
  }, [buildLogContext, getComputedMetrics]);

  /** Reset all metrics — called on video switch. */
  const resetMetrics = useCallback(() => {
    metricsRef.current = createEmptyMetrics();
  }, []);

  return {
    recordTimestamp,
    incrementCounter,
    setStartupAttempt,
    markSuccess,
    getComputedMetrics,
    logMetricsSummary,
    resetMetrics,
    metricsRef,
  };
}
