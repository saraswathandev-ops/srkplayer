import AsyncStorage from "@react-native-async-storage/async-storage";

import { db, initDB } from "@/services/database";
import { getThumbnailCacheDirectory } from "@/services/videoThumbnails";
import * as FileSystem from "@/utils/FileSystem";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_CLEANUP_KEY = "mx_history_cleanup_v1";

export const HISTORY_RETENTION_DAYS = 15;

export type StorageDiagnostics = {
  totalVideos: number;
  playlistCount: number;
  historyCount: number;
  staleHistoryCount: number;
  trackedMediaBytes: number;
  databaseBytes: number;
  thumbnailCacheBytes: number;
  totalAppBytes: number;
  lastCleanupAt: number | null;
  retentionDays: number;
};

function getHistoryCutoff(days: number) {
  return Date.now() - days * DAY_MS;
}

function joinPath(parent: string, child: string) {
  return parent.endsWith("/") ? `${parent}${child}` : `${parent}/${child}`;
}

async function getPathSizeBytes(uri: string | null | undefined): Promise<number> {
  if (!uri) return 0;

  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (!info?.exists) return 0;

  if (!info.isDirectory) {
    return Number(info.size ?? 0);
  }

  const entries = await FileSystem.readDirectoryAsync(uri).catch(() => []);
  const sizes = await Promise.all(entries.map((entry) => getPathSizeBytes(joinPath(uri, entry))));

  return sizes.reduce((total, size) => total + size, 0);
}

async function setLastHistoryCleanupAt(timestamp: number) {
  await AsyncStorage.setItem(HISTORY_CLEANUP_KEY, String(timestamp));
}

export async function getLastHistoryCleanupAt() {
  const rawValue = await AsyncStorage.getItem(HISTORY_CLEANUP_KEY);
  const value = Number(rawValue ?? 0);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

export async function clearOldHistory(days = HISTORY_RETENTION_DAYS) {
  await initDB();
  const cutoff = getHistoryCutoff(days);

  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(id) AS count
     FROM Videos
     WHERE (watchedAt IS NOT NULL OR lastPlayed IS NOT NULL OR lastPosition IS NOT NULL OR playCount > 0)
       AND COALESCE(watchedAt, lastPlayed) IS NOT NULL
       AND COALESCE(watchedAt, lastPlayed) < ?`,
    [cutoff]
  );

  const clearedHistoryCount = Number(row?.count ?? 0);

  if (clearedHistoryCount > 0) {
    await db.runAsync(
      `UPDATE Videos
       SET lastPlayed = NULL,
           lastPosition = NULL,
           watchedAt = NULL,
           playCount = 0
       WHERE (watchedAt IS NOT NULL OR lastPlayed IS NOT NULL OR lastPosition IS NOT NULL OR playCount > 0)
         AND COALESCE(watchedAt, lastPlayed) IS NOT NULL
         AND COALESCE(watchedAt, lastPlayed) < ?`,
      [cutoff]
    );

    await db.execAsync(`PRAGMA wal_checkpoint(TRUNCATE);`);
  }

  const completedAt = Date.now();
  await setLastHistoryCleanupAt(completedAt);

  return {
    clearedHistoryCount,
    completedAt,
  };
}

export async function runScheduledHistoryCleanup(days = HISTORY_RETENTION_DAYS) {
  const lastCleanupAt = await getLastHistoryCleanupAt();
  const now = Date.now();

  if (lastCleanupAt && now - lastCleanupAt < days * DAY_MS) {
    return {
      skipped: true,
      clearedHistoryCount: 0,
      completedAt: lastCleanupAt,
    };
  }

  const result = await clearOldHistory(days);

  return {
    skipped: false,
    ...result,
  };
}

export async function getStorageDiagnostics(
  days = HISTORY_RETENTION_DAYS
): Promise<StorageDiagnostics> {
  await initDB();
  const cutoff = getHistoryCutoff(days);

  const row = await db.getFirstAsync<{
    totalVideos: number;
    playlistCount: number;
    historyCount: number;
    staleHistoryCount: number;
    trackedMediaBytes: number;
  }>(
    `SELECT
       COUNT(*) AS totalVideos,
       (SELECT COUNT(*) FROM Playlists) AS playlistCount,
       COALESCE(
         SUM(
           CASE
             WHEN watchedAt IS NOT NULL OR lastPlayed IS NOT NULL OR lastPosition IS NOT NULL OR playCount > 0
             THEN 1
             ELSE 0
           END
         ),
         0
       ) AS historyCount,
       COALESCE(
         SUM(
           CASE
             WHEN (watchedAt IS NOT NULL OR lastPlayed IS NOT NULL OR lastPosition IS NOT NULL OR playCount > 0)
               AND COALESCE(watchedAt, lastPlayed) IS NOT NULL
               AND COALESCE(watchedAt, lastPlayed) < ?
             THEN 1
             ELSE 0
           END
         ),
         0
       ) AS staleHistoryCount,
       COALESCE(SUM(size), 0) AS trackedMediaBytes
     FROM Videos`,
    [cutoff]
  );

  const [databaseBytes, thumbnailCacheBytes, lastCleanupAt] = await Promise.all([
    Promise.all([
      getPathSizeBytes(db.databasePath),
      getPathSizeBytes(`${db.databasePath}-wal`),
      getPathSizeBytes(`${db.databasePath}-shm`),
    ]).then((sizes) => sizes.reduce((total, size) => total + size, 0)),
    getPathSizeBytes(getThumbnailCacheDirectory()),
    getLastHistoryCleanupAt(),
  ]);

  return {
    totalVideos: Number(row?.totalVideos ?? 0),
    playlistCount: Number(row?.playlistCount ?? 0),
    historyCount: Number(row?.historyCount ?? 0),
    staleHistoryCount: Number(row?.staleHistoryCount ?? 0),
    trackedMediaBytes: Number(row?.trackedMediaBytes ?? 0),
    databaseBytes,
    thumbnailCacheBytes,
    totalAppBytes: databaseBytes + thumbnailCacheBytes,
    lastCleanupAt,
    retentionDays: days,
  };
}
