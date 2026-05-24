/**
 * sessionStateService.ts
 *
 * Phase 8 — full per-video session persistence and in-memory cache.
 *
 * Replaces `getPlaybackProgress` / `updateLastPosition` as the canonical
 * session writer/reader. Stores position, audio track, subtitle, speed,
 * zoom, brightness, volume, and content-fit mode in `VideoSessions`, and
 * mirrors the most-read fields into `Videos.progress_*` for fast list reads.
 *
 * The in-memory `sessionCache` accelerates two paths:
 *   1. Init effect: read the cached session if the prefetch hook already
 *      warmed it for this videoId.
 *   2. List tile: render `progress_position` / `progress_percent` straight
 *      from the cached Videos row (no extra read here — this is implicit).
 *
 * Cache contract:
 *   - Bounded LRU (100 entries) to avoid unbounded growth.
 *   - Writes invalidate-then-replace, so reads after a write see the new state.
 *   - `prefetchSessions(ids)` is fire-and-forget; the cache fills in the
 *     background and the init effect reads the cached value when ready.
 */

import { db } from './database';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type VideoSessionState = {
  videoId: string;
  position: number;
  duration: number;
  audioTrackIndex: number | null;
  subtitleTrackId: string | null;
  playbackRate: number;
  zoomScale: number;
  contentFitMode: string | null;
  brightness: number | null;
  volume: number | null;
  completed: boolean;
  updatedAt: number;
};

type VideoSessionRow = {
  video_id: string;
  position_seconds: number;
  duration_seconds: number;
  audio_track_index: number | null;
  subtitle_track_id: string | null;
  playback_rate: number;
  zoom_scale: number;
  content_fit_mode: string | null;
  brightness: number | null;
  volume: number | null;
  completed: number;
  updated_at: number;
};

// ─── Bounded LRU cache ─────────────────────────────────────────────────────────

const MAX_CACHE_ENTRIES = 100;
const sessionCache = new Map<string, VideoSessionState>();

function touchCache(videoId: string, state: VideoSessionState): void {
  // Map preserves insertion order in JS — delete-then-set moves the entry
  // to the most-recently-used end. Eviction removes the oldest.
  if (sessionCache.has(videoId)) sessionCache.delete(videoId);
  sessionCache.set(videoId, state);
  if (sessionCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey !== undefined) sessionCache.delete(oldestKey);
  }
}

function rowToState(row: VideoSessionRow): VideoSessionState {
  return {
    videoId: row.video_id,
    position: Number(row.position_seconds) || 0,
    duration: Number(row.duration_seconds) || 0,
    audioTrackIndex: row.audio_track_index ?? null,
    subtitleTrackId: row.subtitle_track_id ?? null,
    playbackRate: Number(row.playback_rate) || 1,
    zoomScale: Number(row.zoom_scale) || 1,
    contentFitMode: row.content_fit_mode ?? null,
    brightness: row.brightness === null || row.brightness === undefined ? null : Number(row.brightness),
    volume: row.volume === null || row.volume === undefined ? null : Number(row.volume),
    completed: Number(row.completed) === 1,
    updatedAt: Number(row.updated_at) || 0,
  };
}

// ─── Read API ──────────────────────────────────────────────────────────────────

/**
 * Returns the session state for a videoId, or `null` if none persisted.
 * Cache hit: O(1). Cache miss: one indexed PK lookup.
 *
 * Errors are swallowed and return `null` — a broken DB must not break the
 * init effect; the player will fall back to fresh-start.
 */
export async function loadSessionState(videoId: string): Promise<VideoSessionState | null> {
  if (!videoId) return null;
  const cached = sessionCache.get(videoId);
  if (cached) {
    // Promote in LRU order on access.
    touchCache(videoId, cached);
    return cached;
  }
  try {
    const row = await db.getFirstAsync<VideoSessionRow>(
      'SELECT * FROM VideoSessions WHERE video_id = ?',
      [videoId],
    );
    if (!row) return null;
    const state = rowToState(row);
    touchCache(videoId, state);
    return state;
  } catch {
    return null;
  }
}

/** Synchronous cache peek — used by the init effect to avoid awaiting at all
 *  when the prefetch hook already warmed the cache. */
export function peekSessionState(videoId: string): VideoSessionState | null {
  return sessionCache.get(videoId) ?? null;
}

/** Fire-and-forget: warm the cache for one or more upcoming videoIds. */
export function prefetchSessions(videoIds: Array<string | null | undefined>): void {
  for (const id of videoIds) {
    if (!id) continue;
    if (sessionCache.has(id)) continue;
    void loadSessionState(id);
  }
}

// ─── Write API ─────────────────────────────────────────────────────────────────

export type SessionPatch = {
  videoId: string;
  position?: number;
  duration?: number;
  audioTrackIndex?: number | null;
  subtitleTrackId?: string | null;
  playbackRate?: number;
  zoomScale?: number;
  contentFitMode?: string | null;
  brightness?: number | null;
  volume?: number | null;
  completed?: boolean;
};

/**
 * UPSERT a session-state patch. Unspecified fields keep their prior value
 * (COALESCE handles this in SQL). The denormalized `Videos.progress_*`
 * columns are kept in sync in the same enqueued operation so library reads
 * see the new value on the next render.
 *
 * Failures are logged but swallowed — playback continues even if the write
 * fails. The next save attempt will retry from the latest state.
 */
export async function saveSessionState(patch: SessionPatch): Promise<void> {
  if (!patch.videoId) return;
  const now = Date.now();
  try {
    // Build the SQL using COALESCE so partial patches don't clobber other fields.
    // SQLite ON CONFLICT (PK) DO UPDATE handles the INSERT-or-UPDATE in one go.
    await db.runAsync(
      `
      INSERT INTO VideoSessions (
        video_id, position_seconds, duration_seconds,
        audio_track_index, subtitle_track_id, playback_rate,
        zoom_scale, content_fit_mode, brightness, volume,
        completed, updated_at
      ) VALUES (
        ?, COALESCE(?, 0), COALESCE(?, 0),
        ?, ?, COALESCE(?, 1),
        COALESCE(?, 1), ?, ?, ?,
        COALESCE(?, 0), ?
      )
      ON CONFLICT(video_id) DO UPDATE SET
        position_seconds = COALESCE(excluded.position_seconds, VideoSessions.position_seconds),
        duration_seconds = COALESCE(NULLIF(excluded.duration_seconds, 0), VideoSessions.duration_seconds),
        audio_track_index = COALESCE(excluded.audio_track_index, VideoSessions.audio_track_index),
        subtitle_track_id = COALESCE(excluded.subtitle_track_id, VideoSessions.subtitle_track_id),
        playback_rate = COALESCE(excluded.playback_rate, VideoSessions.playback_rate),
        zoom_scale = COALESCE(excluded.zoom_scale, VideoSessions.zoom_scale),
        content_fit_mode = COALESCE(excluded.content_fit_mode, VideoSessions.content_fit_mode),
        brightness = COALESCE(excluded.brightness, VideoSessions.brightness),
        volume = COALESCE(excluded.volume, VideoSessions.volume),
        completed = COALESCE(excluded.completed, VideoSessions.completed),
        updated_at = excluded.updated_at
      `,
      [
        patch.videoId,
        patch.position ?? null,
        patch.duration ?? null,
        patch.audioTrackIndex ?? null,
        patch.subtitleTrackId ?? null,
        patch.playbackRate ?? null,
        patch.zoomScale ?? null,
        patch.contentFitMode ?? null,
        patch.brightness ?? null,
        patch.volume ?? null,
        patch.completed === undefined ? null : patch.completed ? 1 : 0,
        now,
      ],
    );

    // Denormalize the hot read fields into Videos so list views skip the JOIN.
    // Only mirror what was actually patched; using COALESCE here too keeps
    // missing fields at their prior denormalized values.
    if (
      patch.position !== undefined ||
      patch.duration !== undefined ||
      patch.completed !== undefined
    ) {
      const percent =
        patch.position !== undefined &&
        patch.duration !== undefined &&
        patch.duration > 0
          ? Math.max(0, Math.min(100, (patch.position / patch.duration) * 100))
          : null;
      await db.runAsync(
        `
        UPDATE Videos SET
          progress_position = COALESCE(?, progress_position),
          progress_percent = COALESCE(?, progress_percent),
          progress_completed = COALESCE(?, progress_completed),
          last_session_at = ?
        WHERE id = ?
        `,
        [
          patch.position ?? null,
          percent,
          patch.completed === undefined ? null : patch.completed ? 1 : 0,
          now,
          patch.videoId,
        ],
      );
    }

    // Update the in-memory cache with the merged result. Cheaper than
    // re-reading the row — we already know the merged state in JS.
    const prior = sessionCache.get(patch.videoId);
    const merged: VideoSessionState = {
      videoId: patch.videoId,
      position: patch.position ?? prior?.position ?? 0,
      duration: patch.duration ?? prior?.duration ?? 0,
      audioTrackIndex: patch.audioTrackIndex ?? prior?.audioTrackIndex ?? null,
      subtitleTrackId: patch.subtitleTrackId ?? prior?.subtitleTrackId ?? null,
      playbackRate: patch.playbackRate ?? prior?.playbackRate ?? 1,
      zoomScale: patch.zoomScale ?? prior?.zoomScale ?? 1,
      contentFitMode: patch.contentFitMode ?? prior?.contentFitMode ?? null,
      brightness: patch.brightness ?? prior?.brightness ?? null,
      volume: patch.volume ?? prior?.volume ?? null,
      completed: patch.completed ?? prior?.completed ?? false,
      updatedAt: now,
    };
    touchCache(patch.videoId, merged);
  } catch (err) {
    // Logging only — never throw from a save path.
    // eslint-disable-next-line no-console
    console.warn('[sessionStateService] saveSessionState failed', err);
  }
}

/** Drop the cache entry for a video — call when the video is deleted or
 *  when out-of-band state changes (e.g. external write). */
export function invalidateSession(videoId: string): void {
  sessionCache.delete(videoId);
}

/** Clear the entire cache. Used in tests and on signOut-like events. */
export function clearSessionCache(): void {
  sessionCache.clear();
}

// ─── Throttled per-setting commit ──────────────────────────────────────────────

/**
 * Lightweight batcher for high-frequency settings changes (e.g. pinch zoom,
 * brightness drag). Coalesces patches within a 500 ms window into a single
 * DB write, keyed by videoId. The last-write-wins per field — partial
 * patches stack via Object.assign.
 */
const PATCH_FLUSH_INTERVAL_MS = 500;
const pendingPatches = new Map<string, SessionPatch>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPendingPatches();
  }, PATCH_FLUSH_INTERVAL_MS);
}

async function flushPendingPatches(): Promise<void> {
  if (pendingPatches.size === 0) return;
  const batch = Array.from(pendingPatches.values());
  pendingPatches.clear();
  for (const patch of batch) {
    // Sequential rather than parallel — db is single-connection anyway.
    await saveSessionState(patch);
  }
}

/** Buffer a partial patch; flushed within PATCH_FLUSH_INTERVAL_MS. Use this
 *  for high-frequency callers (zoom, brightness, volume). For terminal
 *  events (user_pause, navigate_to_next_video), call `saveSessionState`
 *  directly to skip the flush window. */
export function commitSessionPatch(patch: SessionPatch): void {
  if (!patch.videoId) return;
  const existing = pendingPatches.get(patch.videoId);
  if (existing) {
    pendingPatches.set(patch.videoId, { ...existing, ...patch });
  } else {
    pendingPatches.set(patch.videoId, patch);
  }
  scheduleFlush();
}

/** Force-flush any pending patches immediately. Call before navigation,
 *  app background, or any other point where dropping a pending patch would
 *  lose user-visible state. */
export async function flushSessionPatches(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushPendingPatches();
}
