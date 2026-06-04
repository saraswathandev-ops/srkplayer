/**
 * playbackDiagnostics.ts
 *
 * Records the player's log stream for a fixed window (5 minutes) once a video
 * starts playing, then writes it to a plain-text file the user can view/share
 * from Settings → Diagnostics. Captures "what issue the playback is facing"
 * (startup, recovery, native-state, stop reasons, background handoff) without
 * changing any log call sites — it taps the single sink in
 * `app/player.logger.ts` via `setDiagnosticsSink`.
 *
 * Mirrors the RNFS text-file approach used by `services/crashManager.ts`.
 */

import { Platform } from "react-native";
import RNFS from "react-native-fs";

import { setDiagnosticsSink, getBlackBoxLines } from "@/app/player.logger";
import { formatStartupMetricsSummary } from "@/services/playbackMetrics";

/** How long to record once playback begins. */
export const DIAGNOSTICS_WINDOW_MS = 5 * 60 * 1000;

/** Cap the in-memory buffer so a runaway session can't exhaust memory. */
const MAX_BUFFERED_LINES = 8000;

const DIAGNOSTICS_PREFIX = "playback_diagnostics_";
const BLACKBOX_PREFIX = "playback_blackbox_";

function section(title: string, lines: string[]): string {
  return [
    "",
    `-------------------- ${title} --------------------`,
    ...lines,
    "",
  ].join("\n");
}

export type DiagnosticsMeta = {
  videoId?: string | null;
  title?: string | null;
  uri?: string | null;
  durationSeconds?: number | null;
};

let recording = false;
let buffer: string[] = [];
let windowTimer: ReturnType<typeof setTimeout> | null = null;
let lastFilePath: string | null = null;

function diagnosticsDir() {
  return RNFS.DocumentDirectoryPath;
}

function buildHeader(meta: DiagnosticsMeta, startedAtIso: string): string {
  return [
    "==================== PLAYBACK DIAGNOSTICS ====================",
    `started: ${startedAtIso}`,
    `window: ${Math.round(DIAGNOSTICS_WINDOW_MS / 1000)}s`,
    `platform: ${Platform.OS} ${String(Platform.Version)}`,
    `video: ${meta.title ?? "(unknown)"} [${meta.videoId ?? "?"}]`,
    `uri: ${meta.uri ?? "(none)"}`,
    `duration: ${meta.durationSeconds ?? "?"}s`,
    "-------------------------------------------------------------",
    "",
  ].join("\n");
}

/**
 * Begin recording for one playback session. Idempotent — a second call while
 * already recording is ignored (the first 5-minute window owns the file).
 */
export function startPlaybackDiagnostics(meta: DiagnosticsMeta = {}): void {
  if (recording) return;
  recording = true;
  const startedAt = new Date();
  buffer = [buildHeader(meta, startedAt.toISOString())];

  setDiagnosticsSink((line: string) => {
    buffer.push(line);
    // Ring-buffer: drop the oldest lines (but keep the header) if we overflow.
    if (buffer.length > MAX_BUFFERED_LINES) {
      buffer.splice(1, buffer.length - MAX_BUFFERED_LINES);
    }
  });

  // Use the start time for the filename so it's stable and sortable.
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  lastFilePath = `${diagnosticsDir()}/${DIAGNOSTICS_PREFIX}${stamp}.txt`;

  windowTimer = setTimeout(() => {
    void stopPlaybackDiagnostics();
  }, DIAGNOSTICS_WINDOW_MS);
}

/** Flush the buffer to disk and stop recording (idempotent). */
export async function stopPlaybackDiagnostics(): Promise<string | null> {
  if (!recording) return lastFilePath;
  recording = false;
  setDiagnosticsSink(null);
  if (windowTimer) {
    clearTimeout(windowTimer);
    windowTimer = null;
  }

  const path = lastFilePath;
  const contents = [
    buffer.join("\n"),
    section("STARTUP METRICS (averages)", formatStartupMetricsSummary()),
    section("BLACK BOX (last events)", getBlackBoxLines()),
  ].join("\n");
  buffer = [];
  if (!path) return null;
  try {
    await RNFS.writeFile(path, contents, "utf8");
  } catch {
    // Never throw from diagnostics teardown.
    return null;
  }
  return path;
}

/**
 * Write the black-box ring buffer to its own file immediately, independent of
 * the 5-minute recording window. Called on a fatal recovery / crash so the last
 * ~100 playback events are preserved for postmortem even if diagnostics wasn't
 * actively recording. Never throws.
 */
export async function dumpBlackBox(reason: string): Promise<string | null> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${diagnosticsDir()}/${BLACKBOX_PREFIX}${stamp}.txt`;
    const contents = [
      "==================== PLAYBACK BLACK BOX ====================",
      `reason: ${reason}`,
      `dumped: ${new Date().toISOString()}`,
      `platform: ${Platform.OS} ${String(Platform.Version)}`,
      "-----------------------------------------------------------",
      ...getBlackBoxLines(),
    ].join("\n");
    await RNFS.writeFile(path, contents, "utf8");
    return path;
  } catch {
    return null;
  }
}

/** True while a 5-minute window is actively recording. */
export function isRecordingDiagnostics(): boolean {
  return recording;
}

/** All saved diagnostics files, newest first. */
export async function listDiagnosticsFiles(): Promise<string[]> {
  try {
    const entries = await RNFS.readDir(diagnosticsDir());
    return entries
      .filter((e) => e.isFile() && e.name.startsWith(DIAGNOSTICS_PREFIX))
      .map((e) => e.path)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Read one diagnostics file's contents (or the latest if no path given). */
export async function readDiagnosticsFile(path?: string): Promise<string> {
  try {
    const target = path ?? (await listDiagnosticsFiles())[0];
    if (!target) return "No playback diagnostics recorded yet.";
    const exists = await RNFS.exists(target);
    if (!exists) return "No playback diagnostics recorded yet.";
    return await RNFS.readFile(target, "utf8");
  } catch {
    return "Could not read playback diagnostics file.";
  }
}

/** Delete every saved diagnostics file. */
export async function clearDiagnosticsFiles(): Promise<void> {
  const files = await listDiagnosticsFiles();
  await Promise.all(files.map((p) => RNFS.unlink(p).catch(() => {})));
}
