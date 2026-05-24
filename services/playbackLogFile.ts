/**
 * playbackLogFile.ts
 *
 * Persistent file-backed sink for playback diagnostic logs. Captures every
 * structured log emitted by `src/player/playbackLogger.ts` to a daily log
 * file under `<DocumentDir>/playback-logs/`, so that a stall reported by a
 * user (or seen during dogfood) can be analyzed post-hoc without
 * reproducing it live.
 *
 * Design constraints:
 *  - MUST never throw. Logging failures are silently swallowed; the player
 *    itself cannot be destabilized by a broken sink.
 *  - MUST work in both dev and release builds. Stalls happen in release
 *    too, so the file sink ignores `__DEV__`.
 *  - Buffered (write every ~1s or when the queue exceeds ~50 lines) to
 *    avoid disk contention on the 250 ms onProgress cadence.
 *  - Daily rotation + 7-day retention so the directory stays bounded.
 *
 * Public API:
 *   appendPlaybackLogLine(line) — enqueue a fully formatted log line.
 *   getCurrentLogPath() — absolute path of today's log file.
 *   listLogFiles() — list all persisted daily log files (newest first).
 *   readLogFile(path) — read a single log file as a string.
 *   flushPlaybackLogFile() — force-flush the in-memory queue to disk.
 *   clearAllPlaybackLogs() — delete every persisted log file.
 */

import { AppState, Platform } from 'react-native';
import RNFS from 'react-native-fs';

// ─── Configuration ─────────────────────────────────────────────────────────────

const LOG_DIR_NAME = 'playback-logs';
const FLUSH_INTERVAL_MS = 1000;
const FLUSH_QUEUE_THRESHOLD = 50;
const RETENTION_DAYS = 7;

// ─── Module state ──────────────────────────────────────────────────────────────

let initialized = false;
let initFailed = false;
let logDirPath: string | null = null;
let currentFilePath: string | null = null;
let currentFileDate = '';
const writeQueue: string[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushInFlight = false;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function todayStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoTimestamp(d: Date = new Date()): string {
  // Local-time ISO-ish stamp (no Z) — easier to correlate with user-reported
  // timestamps than UTC. Resolution to milliseconds is required to align
  // with the diagnostic age fields (jsProgressAgeMs, nativeAckAgeMs).
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.` +
    String(d.getMilliseconds()).padStart(3, '0')
  );
}

function getDocumentDir(): string {
  // RNFS.DocumentDirectoryPath is the app-private documents dir on both
  // platforms — safe to write from JS without extra permissions.
  return RNFS.DocumentDirectoryPath;
}

async function ensureLogDir(): Promise<string> {
  if (logDirPath) return logDirPath;
  const path = `${getDocumentDir()}/${LOG_DIR_NAME}`;
  const exists = await RNFS.exists(path);
  if (!exists) await RNFS.mkdir(path);
  logDirPath = path;
  return path;
}

async function purgeOldLogs(): Promise<void> {
  if (!logDirPath) return;
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  try {
    const entries = await RNFS.readDir(logDirPath);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith('playback-')) continue;
      // mtime can be null on some Android FS; fall back to the date in the
      // file name so we never leave very old logs behind.
      const mtime = entry.mtime?.getTime() ?? 0;
      if (mtime > 0 && mtime >= cutoffMs) continue;
      if (mtime === 0) {
        const match = entry.name.match(/playback-(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [, y, m, d] = match;
          const ts = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
          if (ts >= cutoffMs) continue;
        } else {
          continue; // unknown name shape — leave it alone
        }
      }
      try {
        await RNFS.unlink(entry.path);
      } catch {
        // ignore individual delete failures
      }
    }
  } catch {
    // ignore directory read failures
  }
}

async function rollFileIfNeeded(): Promise<string | null> {
  if (initFailed) return null;
  const stamp = todayStamp();
  if (currentFilePath && currentFileDate === stamp) return currentFilePath;

  try {
    const dir = await ensureLogDir();
    currentFileDate = stamp;
    currentFilePath = `${dir}/playback-${stamp}.log`;
    const exists = await RNFS.exists(currentFilePath);
    if (!exists) {
      const header = buildSessionHeader();
      await RNFS.writeFile(currentFilePath, header, 'utf8');
    } else {
      // New app session inside an existing daily file — append a session
      // boundary marker so the file is parseable into per-session blocks.
      await RNFS.appendFile(currentFilePath, buildSessionHeader(), 'utf8');
    }
    return currentFilePath;
  } catch {
    initFailed = true;
    return null;
  }
}

function buildSessionHeader(): string {
  const ts = isoTimestamp();
  const platform = `${Platform.OS} ${Platform.Version}`;
  // Device context the user / dogfooder usually can't reconstruct after
  // the fact: build constants, locale, ABI hints. Cheap to record once
  // per app session and load-bearing for device-specific stall attribution.
  const constants = (Platform as unknown as { constants?: Record<string, unknown> }).constants;
  const model = constants?.Model ?? constants?.systemName ?? 'unknown';
  const brand = constants?.Brand ?? '';
  const release = constants?.Release ?? '';
  const fingerprint = constants?.Fingerprint ?? '';
  return (
    `\n=== Playback session start: ${ts} | platform=${platform} | ` +
    `brand=${brand} | model=${model} | release=${release} | ` +
    `fp=${fingerprint} ===\n`
  );
}

// ─── Lifecycle: flush on background ────────────────────────────────────────────

/** Flush the in-memory queue when the app loses foreground. The OS may
 *  freeze or kill us at any time after this; without an explicit flush the
 *  last second of diagnostic data is the most likely to be lost — and the
 *  most useful for stall analysis. */
let appStateSubscription: { remove: () => void } | null = null;

function registerAppStateFlush(): void {
  if (appStateSubscription) return;
  try {
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void flushQueue();
      }
    });
  } catch {
    // ignore — AppState should always be available, but never block init
  }
}

async function flushQueue(): Promise<void> {
  if (flushInFlight) return;
  if (writeQueue.length === 0) return;
  flushInFlight = true;
  try {
    const path = await rollFileIfNeeded();
    if (!path) {
      // Init failed — drop the queue so it doesn't grow unbounded.
      writeQueue.length = 0;
      return;
    }
    const batch = writeQueue.splice(0, writeQueue.length).join('');
    await RNFS.appendFile(path, batch, 'utf8');
  } catch {
    // Disk full, perms revoked, etc. Drop the batch — never break playback.
    writeQueue.length = 0;
  } finally {
    flushInFlight = false;
  }
}

function startFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushQueue();
  }, FLUSH_INTERVAL_MS);
  // Don't use unref — RN's setInterval doesn't support it. The timer is
  // cheap and runs for the app's lifetime.
}

async function initOnce(): Promise<void> {
  if (initialized || initFailed) return;
  initialized = true;
  await rollFileIfNeeded();
  // Purge in the background — don't block the first log append.
  void purgeOldLogs();
  startFlushTimer();
  registerAppStateFlush();
  if (currentFilePath && __DEV__) {
    // One-shot console breadcrumb so the dev can locate today's log file
    // via `adb pull` without opening the source.
    console.log(`[PlaybackLogFile] writing to ${currentFilePath}`);
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Append one already-formatted log line. The line MUST end with `\n` (the
 * caller is responsible — saves an allocation on every append). Adds a
 * timestamp prefix so the file is grep-able without correlating to the JS
 * console.
 */
export function appendPlaybackLogLine(line: string): void {
  if (initFailed) return;
  if (!initialized) {
    // Fire-and-forget init; queue grows during the first few ticks.
    void initOnce();
  }
  // Prefix with a wall-clock timestamp. Trim to one line so accidental
  // newlines in `data` don't corrupt the per-line format consumers expect.
  const safeLine = line.endsWith('\n') ? line : `${line}\n`;
  const stamped = `[${isoTimestamp()}] ${safeLine.replace(/\n(?!$)/g, ' ')}`;
  writeQueue.push(stamped);
  if (writeQueue.length >= FLUSH_QUEUE_THRESHOLD) {
    void flushQueue();
  }
}

/** Path of today's log file, or `null` if init hasn't completed yet. */
export function getCurrentLogPath(): string | null {
  return currentFilePath;
}

/** List every persisted log file, newest first. */
export async function listLogFiles(): Promise<
  Array<{ path: string; name: string; sizeBytes: number; mtime: number }>
> {
  try {
    const dir = await ensureLogDir();
    const entries = await RNFS.readDir(dir);
    return entries
      .filter((e) => e.isFile() && e.name.startsWith('playback-'))
      .map((e) => ({
        path: e.path,
        name: e.name,
        sizeBytes: Number(e.size ?? 0),
        mtime: e.mtime?.getTime() ?? 0,
      }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

/** Read a single log file as text. Returns `null` on any failure. */
export async function readLogFile(path: string): Promise<string | null> {
  try {
    return await RNFS.readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/** Force-flush the in-memory queue to disk. Useful before sharing the log. */
export async function flushPlaybackLogFile(): Promise<void> {
  await flushQueue();
}

/** Delete every persisted playback log file. */
export async function clearAllPlaybackLogs(): Promise<void> {
  writeQueue.length = 0;
  try {
    const dir = await ensureLogDir();
    const entries = await RNFS.readDir(dir);
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith('playback-')) {
        try {
          await RNFS.unlink(entry.path);
        } catch {
          // ignore individual delete failures
        }
      }
    }
    currentFilePath = null;
    currentFileDate = '';
  } catch {
    // ignore
  }
}
