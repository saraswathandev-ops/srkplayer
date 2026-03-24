import { db, initDB } from "@/services/database";
import { type FolderItem, type VideoItem } from "@/types/player";

export type FolderVideoSortField = "dateAdded" | "title" | "size";
export type FolderVideoSortDirection = "asc" | "desc";

type FolderRow = {
  id: string;
  name: string;
  coverUri: string | null;
  coverHash: string | null;
  videoCount: number;
  updatedAt: number;
};

type FolderVideoRow = {
  id: string;
  title: string;
  path: string;
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
};

function mapFolderRow(row: FolderRow): FolderItem {
  return {
    id: row.id,
    name: row.name,
    coverUri: row.coverUri ?? undefined,
    coverHash: row.coverHash ?? undefined,
    videoCount: Number(row.videoCount ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
  };
}

function mapFolderVideoRow(row: FolderVideoRow): VideoItem {
  return {
    id: row.id,
    title: row.title,
    uri: row.path,
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
  };
}

export async function syncFoldersFromVideos() {
  await initDB();

  await db.execAsync(`
    DELETE FROM Folders;

    INSERT INTO Folders (id, name, coverUri, coverHash, videoCount, updatedAt)
    SELECT
      v1.folder AS id,
      v1.folder AS name,
      (
        SELECT v2.thumbnail
        FROM Videos v2
        WHERE v2.folder = v1.folder
          AND v2.thumbnail IS NOT NULL
          AND TRIM(v2.thumbnail) != ''
        ORDER BY v2.dateAdded DESC, rowid DESC
        LIMIT 1
      ) AS coverUri,
      (
        SELECT v2.thumbnailHash
        FROM Videos v2
        WHERE v2.folder = v1.folder
          AND v2.thumbnailHash IS NOT NULL
          AND TRIM(v2.thumbnailHash) != ''
        ORDER BY v2.dateAdded DESC, rowid DESC
        LIMIT 1
      ) AS coverHash,
      COUNT(*) AS videoCount,
      MAX(v1.dateAdded) AS updatedAt
    FROM Videos v1
    WHERE v1.folder IS NOT NULL
      AND TRIM(v1.folder) != ''
    GROUP BY v1.folder;
  `);
}

export async function getFolders(limit = 200, offset = 0) {
  await initDB();
  const rows = await db.getAllAsync<FolderRow>(
    `SELECT id ,
      name,
      coverUri,
      coverHash,
      videoCount,
      updatedAt
     FROM Folders
     ORDER BY updatedAt DESC, name COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return rows.map(mapFolderRow);
}

export async function getFolderById(id: string) {
  await initDB();
  const row = await db.getFirstAsync<FolderRow>(
    `SELECT  id ,
      name,
      coverUri,
      coverHash,
      videoCount,
      updatedAt
     FROM Folders
     WHERE id = ?`,
    [id]
  );

  return row ? mapFolderRow(row) : null;
}

function getFolderSortOrder(
  sortBy: FolderVideoSortField,
  direction: FolderVideoSortDirection
) {
  const dir = direction === "asc" ? "ASC" : "DESC";

  if (sortBy === "title") {
    return `title COLLATE NOCASE ${dir}, dateAdded DESC, rowid DESC`;
  }

  if (sortBy === "size") {
    return `size ${dir}, title COLLATE NOCASE ASC, rowid DESC`;
  }

  return `dateAdded ${dir}, rowid DESC`;
}

export async function getFolderVideos(
  folderId: string,
  limit = 20,
  offset = 0,
  sortBy: FolderVideoSortField = "dateAdded",
  direction: FolderVideoSortDirection = "desc"
) {
  await initDB();
  const orderBy = getFolderSortOrder(sortBy, direction);
  const rows = await db.getAllAsync<FolderVideoRow>(
    `SELECT *
     FROM Videos
     WHERE folder = ?
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [folderId, limit, offset]
  );

  return rows.map(mapFolderVideoRow);
}
