import { db, initDB } from "@/services/database";
import { syncFoldersFromVideos } from "@/services/folderService";
import { createVideoThumbnailBundle, deleteStoredThumbnail } from "@/services/videoThumbnails";
import { type LibraryStats } from "@/types/libraryStats";
import { type MediaType, type SortMode, type VideoDeleteMode, type VideoItem, type VideoThumbnailSource } from "@/types/player";
import * as FileSystem from "@/utils/FileSystem";
import { randomUUID } from "@/utils/ids";

type VideoRow = {
  id: string;
  title: string;
  path: string;
  sourceUri: string | null;
  sourceVideoId: string | null;
  duration: number;
  thumbnail: string | null;
  thumbnailHash: string | null;
  folder: string | null;
  lastPlayed: number | null;
  lastPosition: number | null;
  playCount: number;
  isFavorite: number;
  size: number;
  dateAdded: number;
  mimeType: string | null;
  artist: string | null;
  album: string | null;
  watchedAt: number | null;
  mediaType: string | null;
  isClip: number | null;
  clipStart: number | null;
  clipEnd: number | null;
};

type VideoDraft = Omit<VideoItem, "id" | "isFavorite" | "playCount">;

type ExistingVideoLookupRow = {
  id: string;
  path: string;
};

type UpsertVideosOptions = {
  syncFolders?: boolean;
};

type DeleteVideoRow = Pick<VideoRow, "thumbnail" | "folder" | "path" | "isClip">;

const EXISTING_VIDEO_LOOKUP_CHUNK_SIZE = 200;

// ---------------------------------------------------------------------------
// In-memory write-through cache for hot-path single-video lookups
// ---------------------------------------------------------------------------
const _cacheById  = new Map<string, VideoItem>();
const _cacheByUri = new Map<string, VideoItem>();

const CACHE_LIMIT = 500;

function _cacheSet(video: VideoItem) {
  if (_cacheById.size >= CACHE_LIMIT) {
    // Evict oldest entry (Map maintains insertion order)
    const firstId = _cacheById.keys().next().value;
    if (firstId) _cacheEvict(firstId);
  }
  _cacheById.set(video.id, video);
  _cacheByUri.set(video.uri, video);
}

function _cacheEvict(id: string) {
  const cached = _cacheById.get(id);
  if (cached) _cacheByUri.delete(cached.uri);
  _cacheById.delete(id);
}

export function hasVideoCache() {
  return _cacheById.size > 0 || _cacheByUri.size > 0;
}

export function clearVideoCache() {
  if (!hasVideoCache()) return false;
  _cacheById.clear();
  _cacheByUri.clear();
  return true;
}
const UPSERT_VIDEO_SQL = `INSERT INTO Videos (
   id,
   title,
   path,
   sourceUri,
   sourceVideoId,
   duration,
   thumbnail,
   thumbnailHash,
   folder,
   lastPlayed,
   lastPosition,
   playCount,
   isFavorite,
   size,
   dateAdded,
   mimeType,
   artist,
   album,
   watchedAt,
   mediaType,
   isClip,
   clipStart,
   clipEnd
 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
 ON CONFLICT(path) DO UPDATE SET
   title = excluded.title,
   sourceUri = excluded.sourceUri,
   sourceVideoId = excluded.sourceVideoId,
   duration = excluded.duration,
   thumbnail = COALESCE(excluded.thumbnail, Videos.thumbnail),
   thumbnailHash = COALESCE(excluded.thumbnailHash, Videos.thumbnailHash),
   folder = excluded.folder,
   size = excluded.size,
   dateAdded = excluded.dateAdded,
   mimeType = excluded.mimeType,
   artist = excluded.artist,
   album = excluded.album,
   mediaType = excluded.mediaType,
   isClip = excluded.isClip,
   clipStart = excluded.clipStart,
   clipEnd = excluded.clipEnd`;

function serializeThumbnail(thumbnail?: VideoThumbnailSource) {
  return typeof thumbnail === "string" ? thumbnail : null;
}

function buildUpsertVideoParams(id: string, video: VideoDraft) {
  return [
    id,
    video.title,
    video.uri,
    video.sourceUri ?? null,
    video.sourceVideoId ?? null,
    video.duration,
    serializeThumbnail(video.thumbnail),
    video.thumbnailHash ?? null,
    video.folder ?? null,
    video.watchedAt ?? null,
    video.lastPosition ?? null,
    0,
    0,
    video.size,
    video.dateAdded,
    video.mimeType ?? null,
    video.artist ?? null,
    video.album ?? null,
    video.watchedAt ?? null,
    video.mediaType,
    video.isClip ? 1 : 0,
    video.clipStart ?? null,
    video.clipEnd ?? null,
  ];
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function getExistingVideoIdsByUri(uris: string[]) {
  const existingByUri = new Map<string, string>();

  for (const chunk of chunkArray(uris, EXISTING_VIDEO_LOOKUP_CHUNK_SIZE)) {
    if (chunk.length === 0) continue;

    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await db.getAllAsync<ExistingVideoLookupRow>(
      `SELECT id, path
       FROM Videos
       WHERE path IN (${placeholders})`,
      chunk
    );

    for (const row of rows) {
      existingByUri.set(row.path, row.id);
    }
  }

  return existingByUri;
}

function mapVideoRow(row: VideoRow): VideoItem {
  return {
    id: row.id,
    title: row.title,
    uri: row.path,
    sourceUri: row.sourceUri ?? undefined,
    sourceVideoId: row.sourceVideoId ?? undefined,
    duration: Number(row.duration ?? 0),
    thumbnail: row.thumbnail ?? undefined,
    thumbnailHash: row.thumbnailHash ?? undefined,
    folder: row.folder ?? undefined,
    lastPosition: row.lastPosition ?? undefined,
    playCount: Number(row.playCount ?? 0),
    isFavorite: Boolean(row.isFavorite),
    size: Number(row.size ?? 0),
    dateAdded: Number(row.dateAdded ?? 0),
    mimeType: row.mimeType ?? undefined,
    artist: row.artist ?? undefined,
    album: row.album ?? undefined,
    watchedAt: row.watchedAt ?? row.lastPlayed ?? undefined,
    mediaType: row.mediaType === "audio" ? "audio" : "video",
    isClip: Boolean(row.isClip),
    clipStart: row.clipStart ?? undefined,
    clipEnd: row.clipEnd ?? undefined,
  };
}

async function getVideoByUri(uri: string): Promise<VideoItem | null> {
  const cached = _cacheByUri.get(uri);
  if (cached) return cached;

  await initDB();
  const row = await db.getFirstAsync<VideoRow>(`SELECT * FROM Videos WHERE path = ?`, [uri]);
  if (!row) return null;
  const video = mapVideoRow(row);
  _cacheSet(video);
  return video;
}

function createClipUri(sourceVideoId: string, clipStart: number, clipEnd: number) {
  return `mxclip://${sourceVideoId}/${randomUUID()}?start=${clipStart.toFixed(3)}&end=${clipEnd.toFixed(3)}`;
}

function isAppManagedUri(uri?: string | null) {
  if (!uri) return false;

  const roots = [FileSystem.documentDirectory, FileSystem.cacheDirectory].filter(
    (value): value is string => Boolean(value)
  );

  return roots.some((root) => uri.startsWith(root));
}

export async function getVideoById(id: string): Promise<VideoItem | null> {
  const cached = _cacheById.get(id);
  if (cached) return cached;

  await initDB();
  const row = await db.getFirstAsync<VideoRow>(
    `SELECT
       id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
     FROM Videos
     WHERE id = ? AND isDeleted = 0`,
    [id]
  );
  if (!row) return null;
  const video = mapVideoRow(row);
  _cacheSet(video);
  return video;
}

export async function getVideosByFolder(folder: string): Promise<VideoItem[]> {
  await initDB();
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT
       id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
     FROM Videos
     WHERE folder = ? AND isDeleted = 0
     ORDER BY dateAdded DESC`,
    [folder]
  );

  return rows.map(mapVideoRow);
}

export async function getVideos(limit = 20, offset = 0, mediaType?: MediaType, sortMode: SortMode = "date") {
  await initDB();
  
  let orderBy = "dateAdded DESC, rowid DESC";
  if (sortMode === "name") orderBy = "title COLLATE NOCASE ASC, rowid DESC";
  if (sortMode === "size") orderBy = "size DESC, rowid DESC";

  const rows = await db.getAllAsync<VideoRow>(
    `SELECT
       id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
     FROM Videos
     WHERE isDeleted = 0
       ${mediaType ? 'AND mediaType = ?' : ''}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    mediaType ? [mediaType, limit, offset] : [limit, offset]
  );

  return rows.map(mapVideoRow);
}

export async function getAllVideos(): Promise<VideoItem[]> {
  // Legacy/test helper only. App screens should use getVideos(...) paging.
  return getVideos(Number.MAX_SAFE_INTEGER, 0);
}

export async function getRecentVideosPaged(limit = 10, offset = 0) {
  await initDB();
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT
       id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
     FROM Videos
     WHERE isDeleted = 0 AND playCount > 0
     ORDER BY watchedAt DESC, rowid DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows.map(mapVideoRow);
}

export async function getContinueWatchingVideosPaged(limit = 10, offset = 0) {
  await initDB();
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT
       id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
     FROM Videos
     WHERE isDeleted = 0
       AND lastPosition >= 3
       AND (duration <= 0 OR lastPosition < (CASE WHEN duration > 10000 THEN duration/1000 ELSE duration END) * 0.95)
     ORDER BY watchedAt DESC, rowid DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows.map(mapVideoRow);
}

export async function getFavoriteVideosPaged(limit = 20, offset = 0) {
  await initDB();
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT
       id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
     FROM Videos
     WHERE isDeleted = 0 AND isFavorite = 1
     ORDER BY dateAdded DESC, rowid DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows.map(mapVideoRow);
}

export async function getVideoCount(mediaType?: MediaType): Promise<number> {
  await initDB();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM Videos WHERE isDeleted = 0 ${mediaType ? 'AND mediaType = ?' : ''}`,
    mediaType ? [mediaType] : []
  );
  return result?.count ?? 0;
}

export async function getLibraryStats(): Promise<LibraryStats> {
  await initDB();
  const stats = await db.getFirstAsync<{
    totalCount: number;
    totalDuration: number;
    watchedCount: number;
    favoriteCount: number;
  }>(
    `SELECT
       COUNT(*) as totalCount,
       SUM(CASE WHEN duration > 0 THEN (CASE WHEN duration > 10000 THEN duration/1000 ELSE duration END) ELSE 0 END) as totalDuration,
       SUM(CASE WHEN playCount > 0 THEN 1 ELSE 0 END) as watchedCount,
       SUM(CASE WHEN isFavorite = 1 THEN 1 ELSE 0 END) as favoriteCount
     FROM Videos
     WHERE isDeleted = 0`
  );

  const folderCountResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT folder) as count FROM Videos WHERE isDeleted = 0 AND folder IS NOT NULL`
  );

  const playlistCountResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM Playlists`
  );

  return {
    totalCount: stats?.totalCount ?? 0,
    totalDuration: stats?.totalDuration ?? 0,
    watchedCount: stats?.watchedCount ?? 0,
    favoriteCount: stats?.favoriteCount ?? 0,
    folderCount: folderCountResult?.count ?? 0,
    playlistCount: playlistCountResult?.count ?? 0,
  };
}

export async function searchStoredVideos(query: string, limit = 50, offset = 0, sortMode: SortMode = "date") {
  await initDB();
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  let orderBy = "dateAdded DESC, rowid DESC";
  if (sortMode === "name") orderBy = "title COLLATE NOCASE ASC, rowid DESC";
  if (sortMode === "size") orderBy = "size DESC, rowid DESC";

  const likeQuery = `%${normalizedQuery}%`;
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT
       id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
     FROM Videos
     WHERE isDeleted = 0
       AND (
         title LIKE ?
         OR folder LIKE ?
         OR artist LIKE ?
         OR album LIKE ?
       )
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [likeQuery, likeQuery, likeQuery, likeQuery, limit, offset]
  );

  return rows.map(mapVideoRow);
}

export async function getMostPlayedVideosPaged(limit = 20, offset = 0) {
  await initDB();
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT
       id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
     FROM Videos
     WHERE isDeleted = 0 AND playCount > 0
     ORDER BY playCount DESC, title COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows.map(mapVideoRow);
}

export async function backfillMissingVideoThumbnails(limit = 100) {
  await initDB();

  const rows = await db.getAllAsync<
    Pick<VideoRow, "id" | "path" | "mediaType" | "thumbnail">
  >(
    `SELECT id, path, mediaType, thumbnail
     FROM Videos
     WHERE mediaType = 'video'
       AND isClip = 0
       AND isDeleted = 0
       AND (thumbnail IS NULL OR thumbnail = '')
       AND (thumbnailHash IS NULL OR thumbnailHash = '')
     ORDER BY dateAdded DESC, rowid DESC
     LIMIT ?`,
    [limit]
  );

  let updatedCount = 0;

  for (const row of rows) {
    const thumbnailBundle = await createVideoThumbnailBundle(row.path, "video");
    const thumbnail = serializeThumbnail(thumbnailBundle.thumbnail);

    const forceSkipThumbnail = !thumbnail && !thumbnailBundle.thumbnailHash ? "failed" : thumbnail;

    await db.runAsync(
      `UPDATE Videos
       SET thumbnail = COALESCE(?, thumbnail),
           thumbnailHash = COALESCE(?, thumbnailHash)
       WHERE id = ?`,
      [forceSkipThumbnail, thumbnailBundle.thumbnailHash ?? null, row.id]
    );

    updatedCount += 1;
  }

  return updatedCount;
}

export async function ensureVideoThumbnail(id: string) {
  await initDB();

  const row = await db.getFirstAsync<
    Pick<VideoRow, "id" | "path" | "mediaType" | "thumbnail" | "thumbnailHash" | "isClip">
  >(
    `SELECT id, path, mediaType, thumbnail, thumbnailHash, isClip
     FROM Videos
     WHERE id = ?`,
    [id]
  );

  if (!row) return false;
  if (row.mediaType !== "video" || Boolean(row.isClip)) return false;
  if (
    (typeof row.thumbnail === "string" && row.thumbnail.length > 0) ||
    (typeof row.thumbnailHash === "string" && row.thumbnailHash.length > 0)
  ) {
    return false;
  }

  const thumbnailBundle = await createVideoThumbnailBundle(row.path, "video");
  const thumbnail = serializeThumbnail(thumbnailBundle.thumbnail);

  if (!thumbnail && !thumbnailBundle.thumbnailHash) {
    return false;
  }

  await db.runAsync(
    `UPDATE Videos
     SET thumbnail = COALESCE(?, thumbnail),
         thumbnailHash = COALESCE(?, thumbnailHash)
     WHERE id = ?`,
    [thumbnail, thumbnailBundle.thumbnailHash ?? null, row.id]
  );

  return true;
}

export async function upsertVideo(video: VideoDraft) {
  await initDB();

  const existing = await db.getFirstAsync<{ id: string; folder: string | null }>(
    `SELECT id, folder FROM Videos WHERE path = ?`,
    [video.uri]
  );

  const id = existing?.id ?? randomUUID();

  await db.runAsync(UPSERT_VIDEO_SQL, buildUpsertVideoParams(id, video));

  const storedVideo = await getVideoByUri(video.uri);

  if (!storedVideo) {
    throw new Error(`Failed to load stored video for ${video.uri}`);
  }

  // Only rebuild folders when a new video was added or the video's folder changed
  const existingFolder = existing?.folder ?? null;
  const newFolder = video.folder ?? null;
  if (!existing || existingFolder !== newFolder) {
    await syncFoldersFromVideos();
  }

  return {
    video: storedVideo,
    added: !existing,
  };
}

export async function upsertVideos(
  videos: VideoDraft[],
  options: UpsertVideosOptions = {}
) {
  await initDB();

  if (videos.length === 0) {
    if (options.syncFolders ?? true) {
      await syncFoldersFromVideos();
    }

    return {
      addedCount: 0,
      totalCount: 0,
    };
  }

  const existingByUri = await getExistingVideoIdsByUri(videos.map((video) => video.uri));
  let addedCount = 0;

  // Build all statements up-front, then execute in a single transaction
  const BATCH_CHUNK_SIZE = 200;
  const chunks = chunkArray(videos, BATCH_CHUNK_SIZE);

  for (const chunk of chunks) {
    const statements: { sql: string; params: any[] }[] = [];

    for (const video of chunk) {
      const existingId = existingByUri.get(video.uri);
      const id = existingId ?? randomUUID();

      statements.push({
        sql: UPSERT_VIDEO_SQL,
        params: buildUpsertVideoParams(id, video),
      });

      if (!existingId) {
        addedCount += 1;
      }
    }

    await db.runBatchAsync(statements);
  }

  // Checkpoint to merge WAL into main DB after large updates
  await db.checkpoint().catch(() => undefined);

  if (options.syncFolders ?? true) {
    await syncFoldersFromVideos();
  }

  return {
    addedCount,
    totalCount: videos.length,
  };
}

/**
 * Returns a Set of all known (non-deleted) video file URIs in the database.
 * Used by the device scanner to skip already-imported files.
 */
export async function getKnownVideoUris(): Promise<Set<string>> {
  await initDB();
  const rows = await db.getAllAsync<{ path: string }>(
    `SELECT path FROM Videos WHERE isDeleted = 0 AND isClip = 0`
  );
  return new Set(rows.map((r) => r.path));
}

export async function deleteVideosByUris(uris: string[]) {
  if (uris.length === 0) return;
  await initDB();
  const BATCH_SIZE = 200;
  const chunks = chunkArray(uris, BATCH_SIZE);

  await db.withTransactionAsync(async () => {
    for (const chunk of chunks) {
      if (chunk.length === 0) continue;
      const placeholders = chunk.map(() => "?").join(", ");
      await db.runAsync(
        `DELETE FROM Videos WHERE path IN (${placeholders})`,
        chunk
      );
    }
  });

  await syncFoldersFromVideos();
}

export async function saveTrimmedClip(options: {
  video: VideoItem;
  clipStart: number;
  clipEnd: number;
  title?: string;
}) {
  await initDB();

  const baseClipStart = options.video.isClip
    ? Math.max(options.video.clipStart ?? 0, 0)
    : 0;
  const normalizedStart = Math.max(options.clipStart, 0);
  const normalizedEnd = Math.max(options.clipEnd, normalizedStart);
  const absoluteClipStart = baseClipStart + normalizedStart;
  const absoluteClipEnd = baseClipStart + normalizedEnd;
  const clipDuration = Math.max(absoluteClipEnd - absoluteClipStart, 0);
  const id = randomUUID();
  const sourceVideoId = options.video.sourceVideoId ?? options.video.id;
  const sourceUri = options.video.sourceUri ?? options.video.uri;
  const estimatedSize =
    options.video.duration > 0 && options.video.size > 0
      ? Math.max(
          Math.round(
            (options.video.size * (normalizedEnd - normalizedStart)) /
              options.video.duration
          ),
          1
        )
      : options.video.size;

  await db.runAsync(
    `INSERT INTO Videos (
       id,
       title,
       path,
       sourceUri,
       sourceVideoId,
       duration,
       thumbnail,
       thumbnailHash,
       folder,
       lastPlayed,
       lastPosition,
       playCount,
       isFavorite,
       size,
       dateAdded,
       mimeType,
       watchedAt,
       mediaType,
       isClip,
       clipStart,
       clipEnd
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      options.title?.trim() || `${options.video.title} Clip`,
      createClipUri(sourceVideoId, absoluteClipStart, absoluteClipEnd),
      sourceUri,
      sourceVideoId,
      clipDuration,
      serializeThumbnail(options.video.thumbnail),
      options.video.thumbnailHash ?? null,
      options.video.folder ?? null,
      null,
      0,
      0,
      0,
      estimatedSize,
      Date.now(),
      options.video.mimeType ?? null,
      null,
      options.video.mediaType,
      1,
      absoluteClipStart,
      absoluteClipEnd,
    ]
  );

  const storedVideo = await getVideoById(id);

  if (!storedVideo) {
    throw new Error(`Failed to load saved trimmed clip ${id}`);
  }

  await syncFoldersFromVideos();

  return storedVideo;
}

export async function deleteVideo(
  id: string,
  mode: VideoDeleteMode = "temporary"
) {
  await initDB();
  const existing = await db.getFirstAsync<DeleteVideoRow>(
    `SELECT thumbnail, folder, path, isClip FROM Videos WHERE id = ?`,
    [id]
  );

  if (mode === "temporary") {
    await db.runAsync(`UPDATE Videos SET isDeleted = 1 WHERE id = ?`, [id]);
    await syncFoldersFromVideos();
    return;
  }

  if (mode === "permanent" && existing?.path && !existing.isClip && isAppManagedUri(existing.path)) {
    await FileSystem.deleteAsync(existing.path, { idempotent: true }).catch(() => undefined);
  }

  await db.runAsync(`DELETE FROM Videos WHERE id = ?`, [id]);
  if (existing?.thumbnail) {
    const remainingThumbnailRefs = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(id) AS count FROM Videos WHERE thumbnail = ?`,
      [existing.thumbnail]
    );

    if (Number(remainingThumbnailRefs?.count ?? 0) === 0) {
      await deleteStoredThumbnail(existing.thumbnail);
    }
  }
  // Only rebuild folders if we deleted the last video in the folder
  const deletedFolder = existing?.folder;
  if (deletedFolder) {
    const remaining = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(id) AS count FROM Videos WHERE folder = ? AND isDeleted = 0`,
      [deletedFolder]
    );

    if (Number(remaining?.count ?? 0) === 0) {
      await syncFoldersFromVideos();
    }
  }
}

export async function deleteVideos(
  ids: string[],
  mode: VideoDeleteMode = "temporary"
) {
  if (ids.length === 0) return;
  await initDB();

  if (mode === "temporary") {
    for (const id of ids) _cacheEvict(id);
    const chunks = chunkArray(ids, 200);
    await db.withTransactionAsync(async () => {
      for (const chunk of chunks) {
        const placeholders = chunk.map(() => "?").join(", ");
        await db.runAsync(`UPDATE Videos SET isDeleted = 1 WHERE id IN (${placeholders})`, chunk);
      }
    });
    await syncFoldersFromVideos();
    return;
  }

  // Permanent delete — fetch metadata first, then batch-delete, then clean up files/thumbnails
  const allPlaceholders = ids.map(() => "?").join(", ");
  const rows = await db.getAllAsync<DeleteVideoRow>(
    `SELECT thumbnail, folder, path, isClip FROM Videos WHERE id IN (${allPlaceholders})`,
    ids
  );

  for (const row of rows) {
    if (row.path && !row.isClip && isAppManagedUri(row.path)) {
      await FileSystem.deleteAsync(row.path, { idempotent: true }).catch(() => undefined);
    }
  }

  for (const id of ids) _cacheEvict(id);

  await db.withTransactionAsync(async () => {
    const chunks = chunkArray(ids, 200);
    for (const chunk of chunks) {
      const placeholders = chunk.map(() => "?").join(", ");
      await db.runAsync(`DELETE FROM Videos WHERE id IN (${placeholders})`, chunk);
    }
  });

  // Clean up thumbnails that are no longer referenced
  const uniqueThumbnails = [...new Set(rows.map((r) => r.thumbnail).filter(Boolean))] as string[];
  for (const thumbnail of uniqueThumbnails) {
    const ref = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(id) AS count FROM Videos WHERE thumbnail = ?`,
      [thumbnail]
    );
    if (Number(ref?.count ?? 0) === 0) {
      await deleteStoredThumbnail(thumbnail);
    }
  }

  await syncFoldersFromVideos();
}

export async function clearAllVideos() {
  await initDB();
  await db.execAsync("DELETE FROM Videos");
  await syncFoldersFromVideos();
}

export async function getDeletedVideos() {
  await initDB();
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT * FROM Videos WHERE isDeleted = 1 ORDER BY dateAdded DESC`
  );
  return rows.map(mapVideoRow);
}

export async function restoreVideo(id: string) {
  await initDB();
  await db.runAsync(`UPDATE Videos SET isDeleted = 0 WHERE id = ?`, [id]);
  await syncFoldersFromVideos();
}

export async function restoreVideos(ids: string[]) {
  if (ids.length === 0) return;
  await initDB();

  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(
    `UPDATE Videos SET isDeleted = 0 WHERE id IN (${placeholders})`,
    ids
  );
  await syncFoldersFromVideos();
}

export async function toggleFavorite(id: string) {
  _cacheEvict(id);
  await initDB();
  await db.runAsync(
    `UPDATE Videos
     SET isFavorite = CASE WHEN isFavorite = 1 THEN 0 ELSE 1 END
     WHERE id = ?`,
    [id]
  );
}

export async function updateVideoPlayback(id: string, position: number, watchedAt: number) {
  _cacheEvict(id);
  try {
    await initDB();
    await db.runAsync(
      `UPDATE Videos
       SET lastPosition = ?,
           lastPlayed = ?,
           watchedAt = ?
       WHERE id = ?`,
      [position, watchedAt, watchedAt, id]
    );
  } catch (e) {
    console.warn("[DB] updateVideoPlayback failed:", e);
  }
}

export async function updateVideoPlaybackMetadata(options: {
  id: string;
  position: number;
  watchedAt: number;
  duration?: number;
}) {
  _cacheEvict(options.id);
  try {
    await initDB();
    const nextDuration =
      Number.isFinite(options.duration) && (options.duration ?? 0) > 0
        ? options.duration
        : null;

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
        options.position,
        options.watchedAt,
        options.watchedAt,
        nextDuration,
        nextDuration,
        nextDuration,
        options.id,
      ]
    );
  } catch (e) {
    console.warn("[DB] updateVideoPlaybackMetadata failed:", e);
  }
}

export async function updateVideoDuration(id: string, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return;
  await initDB();
  await db.runAsync(
    `UPDATE Videos
     SET duration = ?
     WHERE id = ?`,
    [duration, id]
  );
}

export async function incrementPlayCount(id: string, watchedAt: number) {
  try {
    await initDB();
    await db.runAsync(
      `UPDATE Videos
       SET playCount = playCount + 1,
           lastPlayed = ?,
           watchedAt = ?
       WHERE id = ?`,
      [watchedAt, watchedAt, id]
    );
  } catch (e) {
    console.warn("[DB] incrementPlayCount failed:", e);
  }
}
