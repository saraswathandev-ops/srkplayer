/**
 * playbackMetrics.ts
 *
 * Rolling store of the last N startup sessions plus computed averages, used to
 * pinpoint startup bottlenecks (Requirement 6). `app/player.tsx` records one
 * sample per confirmed-stable startup via `recordStartupSession`, and
 * `services/playbackDiagnostics.ts` appends `getStartupMetricsSummary()` to the
 * diagnostics file so each report carries the averages of recent sessions.
 *
 * Pure in-memory; nothing here persists across process death (startup timing is
 * a runtime-tuning signal, not user data).
 */

/** Raw timestamps captured during one startup (ms epoch; 0 = not reached). */
export type StartupSessionSample = {
  navigationAt: number;
  sourceValidatedAt: number;
  loadStartAt: number;
  onLoadAt: number;
  readyForDisplayAt: number;
  firstProgressAt: number;
  stabilizationConfirmedAt: number;
};

/** Derived phase durations (ms). `null` when an endpoint timestamp is missing. */
export type StartupDurations = {
  navigation_to_source: number | null;
  source_to_loadstart: number | null;
  loadstart_to_onload: number | null;
  onload_to_first_progress: number | null;
  first_progress_to_stable: number | null;
  total_startup_ms: number | null;
};

const MAX_SESSIONS = 50;
const samples: StartupDurations[] = [];

function delta(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0 || to < from) {
    return null;
  }
  return Math.round(to - from);
}

export function computeStartupDurations(s: StartupSessionSample): StartupDurations {
  return {
    navigation_to_source: delta(s.navigationAt, s.sourceValidatedAt),
    source_to_loadstart: delta(s.sourceValidatedAt, s.loadStartAt),
    loadstart_to_onload: delta(s.loadStartAt, s.onLoadAt),
    onload_to_first_progress: delta(s.onLoadAt, s.firstProgressAt),
    first_progress_to_stable: delta(s.firstProgressAt, s.stabilizationConfirmedAt),
    total_startup_ms: delta(s.navigationAt, s.stabilizationConfirmedAt),
  };
}

/**
 * Record one startup session. Returns the derived durations so the caller can
 * also log them inline. Keeps only the most recent MAX_SESSIONS.
 */
export function recordStartupSession(sample: StartupSessionSample): StartupDurations {
  const durations = computeStartupDurations(sample);
  samples.push(durations);
  if (samples.length > MAX_SESSIONS) {
    samples.splice(0, samples.length - MAX_SESSIONS);
  }
  return durations;
}

type SummaryRow = { avg: number | null; samples: number };

export type StartupMetricsSummary = {
  sessionCount: number;
  metrics: Record<keyof StartupDurations, SummaryRow>;
};

const METRIC_KEYS: (keyof StartupDurations)[] = [
  "navigation_to_source",
  "source_to_loadstart",
  "loadstart_to_onload",
  "onload_to_first_progress",
  "first_progress_to_stable",
  "total_startup_ms",
];

/** Averages across the rolling window, ignoring `null` (unreached) values per metric. */
export function getStartupMetricsSummary(): StartupMetricsSummary {
  const metrics = {} as Record<keyof StartupDurations, SummaryRow>;
  for (const key of METRIC_KEYS) {
    const values = samples
      .map((s) => s[key])
      .filter((v): v is number => typeof v === "number");
    metrics[key] = {
      avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
      samples: values.length,
    };
  }
  return { sessionCount: samples.length, metrics };
}

/** Render the summary as plain text lines for the diagnostics file. */
export function formatStartupMetricsSummary(): string[] {
  const summary = getStartupMetricsSummary();
  if (summary.sessionCount === 0) {
    return ["(no startup sessions recorded this run)"];
  }
  const lines: string[] = [`sessions: ${summary.sessionCount} (most recent ${MAX_SESSIONS} max)`];
  for (const key of METRIC_KEYS) {
    const row = summary.metrics[key];
    lines.push(`${key}: avg=${row.avg === null ? "n/a" : `${row.avg}ms`} (n=${row.samples})`);
  }
  return lines;
}

/** Reset the rolling store (test/diagnostics only). */
export function clearStartupMetrics(): void {
  samples.length = 0;
}
