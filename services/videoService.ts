import { db, initDB } from "@/services/database";
import { syncFoldersFromVideos } from "@/services/folderService";
import { createVideoThumbnailBundle, deleteStoredThumbnail } from "@/services/videoThumbnails";
import { type VideoDeleteMode, type VideoItem, type VideoThumbnailSource } from "@/types/player";
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
   watchedAt,
   mediaType,
   isClip,
   clipStart,
   clipEnd
 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    watchedAt: row.watchedAt ?? row.lastPlayed ?? undefined,
    mediaType: row.mediaType === "audio" ? "audio" : "video",
    isClip: Boolean(row.isClip),
    clipStart: row.clipStart ?? undefined,
    clipEnd: row.clipEnd ?? undefined,
  };
}

async function getVideoByUri(uri: string) {
  await initDB();
  const row = await db.getFirstAsync<VideoRow>(
    `SELECT * FROM Videos WHERE path = ?`,
    [uri]
  );

  return row ? mapVideoRow(row) : null;
}

async function getVideoById(id: string) {
  await initDB();
  const row = await db.getFirstAsync<VideoRow>(
    `SELECT * FROM Videos WHERE id = ?`,
    [id]
  );

  return row ? mapVideoRow(row) : null;
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

export async function getAllVideos() {
  await initDB();
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT * FROM Videos WHERE isDeleted = 0 ORDER BY dateAdded DESC, rowid DESC`
  );

  return rows.map(mapVideoRow);
}

export async function getVideos(limit = 20, offset = 0) {
  await initDB();
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT * FROM Videos
     WHERE isDeleted = 0
     ORDER BY dateAdded DESC, rowid DESC
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

  await db.withTransactionAsync(async () => {
    for (const video of videos) {
      const existingId = existingByUri.get(video.uri);
      const id = existingId ?? randomUUID();

      await db.runAsync(UPSERT_VIDEO_SQL, buildUpsertVideoParams(id, video));

      if (!existingId) {
        addedCount += 1;
      }
    }
  });

  if (options.syncFolders ?? true) {
    await syncFoldersFromVideos();
  }

  return {
    addedCount,
    totalCount: videos.length,
  };
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

export async function toggleFavorite(id: string) {
  await initDB();
  await db.runAsync(
    `UPDATE Videos
     SET isFavorite = CASE WHEN isFavorite = 1 THEN 0 ELSE 1 END
     WHERE id = ?`,
    [id]
  );
}

export async function updateVideoPlayback(id: string, position: number, watchedAt: number) {
  await initDB();
  await db.runAsync(
    `UPDATE Videos
     SET lastPosition = ?,
         lastPlayed = ?,
         watchedAt = ?
     WHERE id = ?`,
    [position, watchedAt, watchedAt, id]
  );
}

export async function incrementPlayCount(id: string, watchedAt: number) {
  await initDB();
  await db.runAsync(
    `UPDATE Videos
     SET playCount = playCount + 1,
         lastPlayed = ?,
         watchedAt = ?
     WHERE id = ?`,
    [watchedAt, watchedAt, id]
  );
}
