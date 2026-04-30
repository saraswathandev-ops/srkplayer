import { db, initDB } from "@/services/database";
import { type PlaybackProgress } from "@/types/player";

export const MIN_RESUME_POSITION_SECONDS = 15;
export const COMPLETED_PLAYBACK_THRESHOLD = 0.95;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeDurationSeconds(duration?: number | null) {
  const safeDuration = Number(duration ?? 0);
  if (!Number.isFinite(safeDuration) || safeDuration <= 0) return 0;
  return safeDuration > 10000 ? safeDuration / 1000 : safeDuration;
}

function normalizePositionSeconds(position?: number | null, durationSeconds = 0) {
  const safePosition = Number(position ?? 0);
  if (!Number.isFinite(safePosition) || safePosition <= 0) return 0;
  if (durationSeconds > 0) {
    return clamp(safePosition, 0, durationSeconds);
  }
  return Math.max(safePosition, 0);
}

function mapPlaybackProgress(row: {
  video_id: string;
  position_seconds: number;
  duration_seconds: number;
  progress_percent: number;
  last_watched_at: number;
  completed: number;
}): PlaybackProgress {
  return {
    videoId: row.video_id,
    positionSeconds: Number(row.position_seconds ?? 0),
    durationSeconds: Number(row.duration_seconds ?? 0),
    progressPercent: Number(row.progress_percent ?? 0),
    lastWatchedAt: Number(row.last_watched_at ?? 0),
    completed: Boolean(row.completed),
  };
}

async function syncVideoResumeColumns(options: {
  videoId: string;
  positionSeconds: number;
  durationSeconds: number;
  watchedAt: number;
}) {
  const durationForUpdate = options.durationSeconds > 0 ? options.durationSeconds : null;

  await db.runAsync(
    `UPDATE Videos
     SET lastPosition = ?,
         lastPlayed = ?,
         watchedAt = ?,
         duration = CASE
           WHEN ? IS NOT NULL AND ? > 0 THEN ?
           ELSE duration
         END
     WHERE id = ?`,
    [
      options.positionSeconds,
      options.watchedAt,
      options.watchedAt,
      durationForUpdate,
      durationForUpdate,
      durationForUpdate,
      options.videoId,
    ]
  );
}

export async function getPlaybackProgress(videoId: string): Promise<PlaybackProgress | null> {
  await initDB();
  const row = await db.getFirstAsync<{
    video_id: string;
    position_seconds: number;
    duration_seconds: number;
    progress_percent: number;
    last_watched_at: number;
    completed: number;
  }>(
    `SELECT video_id, position_seconds, duration_seconds, progress_percent, last_watched_at, completed
     FROM PlaybackProgress
     WHERE video_id = ?`,
    [videoId]
  );

  return row ? mapPlaybackProgress(row) : null;
}

export async function savePlaybackProgress(options: {
  videoId: string;
  positionSeconds: number;
  durationSeconds?: number;
  watchedAt?: number;
}) {
  await initDB();

  const durationSeconds = normalizeDurationSeconds(options.durationSeconds);
  const positionSeconds = normalizePositionSeconds(options.positionSeconds, durationSeconds);
  const watchedAt = Number.isFinite(options.watchedAt) ? Number(options.watchedAt) : Date.now();
  const progressPercent =
    durationSeconds > 0 ? clamp(positionSeconds / durationSeconds, 0, 1) : 0;
  const completed =
    durationSeconds > 0 && progressPercent >= COMPLETED_PLAYBACK_THRESHOLD;
  const shouldPersistResume =
    positionSeconds >= MIN_RESUME_POSITION_SECONDS && !completed;

  await db.withTransactionAsync(async () => {
    if (shouldPersistResume) {
      await db.runAsync(
        `INSERT INTO PlaybackProgress (
           video_id,
           position_seconds,
           duration_seconds,
           progress_percent,
           last_watched_at,
           completed
         ) VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(video_id) DO UPDATE SET
           position_seconds = excluded.position_seconds,
           duration_seconds = excluded.duration_seconds,
           progress_percent = excluded.progress_percent,
           last_watched_at = excluded.last_watched_at,
           completed = 0`,
        [
          options.videoId,
          positionSeconds,
          durationSeconds,
          progressPercent,
          watchedAt,
        ]
      );
    } else {
      await db.runAsync(`DELETE FROM PlaybackProgress WHERE video_id = ?`, [options.videoId]);
    }

    await syncVideoResumeColumns({
      videoId: options.videoId,
      positionSeconds: shouldPersistResume ? positionSeconds : 0,
      durationSeconds,
      watchedAt,
    });
  });
}

export async function clearPlaybackProgress(
  videoId: string,
  options?: { durationSeconds?: number; watchedAt?: number }
) {
  await savePlaybackProgress({
    videoId,
    positionSeconds: 0,
    durationSeconds: options?.durationSeconds,
    watchedAt: options?.watchedAt,
  });
}
