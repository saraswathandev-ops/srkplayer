import { db, initDB } from "@/services/database";
import { type Playlist, type VideoItem } from "@/types/player";
import { randomUUID } from "@/utils/ids";

type PlaylistRow = {
  id: string;
  name: string;
  createdAt: number;
  coverUri: string | null;
  coverHash: string | null;
  videoCount: number;
};

type PlaylistVideoRow = {
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
  playlistItemId: number;
  position: number;
};

export type PlaylistVideo = VideoItem & {
  playlistItemId: number;
  position: number;
};

function mapPlaylistRow(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    name: row.name,
    createdAt: Number(row.createdAt ?? 0),
    coverUri: row.coverUri ?? undefined,
    coverHash: row.coverHash ?? undefined,
    videoCount: Number(row.videoCount ?? 0),
  };
}

function mapPlaylistVideoRow(row: PlaylistVideoRow): PlaylistVideo {
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
    playlistItemId: Number(row.playlistItemId),
    position: Number(row.position),
  };
}

export async function createPlaylist(name: string) {
  await initDB();
  const playlist: Playlist = {
    id: randomUUID(),
    name,
    createdAt: Date.now(),
    videoCount: 0,
  };

  await db.runAsync(
    `INSERT INTO Playlists (id, name, createdAt, coverUri)
     VALUES (?, ?, ?, ?)`,
    [playlist.id, playlist.name, playlist.createdAt, null]
  );

  return playlist;
}

export async function getPlaylists() {
  await initDB();
  const rows = await db.getAllAsync<PlaylistRow>(
    // `SELECT
    //   p.id,
    //   p.name,
    //   p.createdAt,

    //   COALESCE(v.thumbnail, p.coverUri) AS coverUri,
    //   v.thumbnailHash AS coverHash,

    //   COUNT(pi.id) AS videoCount

    // FROM Playlists p

    // LEFT JOIN PlaylistItems pi
    //   ON pi.playlistId = p.id

    // -- Get first video per playlist
    // LEFT JOIN PlaylistItems firstPi
    //   ON firstPi.playlistId = p.id
    //   AND firstPi.position = (
    //     SELECT MIN(position)
    //     FROM PlaylistItems
    //     WHERE playlistId = p.id
    //   )

    // LEFT JOIN Videos v
    //   ON v.id = firstPi.videoId
    //   AND v.thumbnail IS NOT NULL
    //   AND TRIM(v.thumbnail) != ''

    // GROUP BY p.id

    // ORDER BY p.createdAt DESC`
    `SELECT
       Playlists.id,
       Playlists.name,
       Playlists.createdAt,
       COALESCE(
         (
           SELECT Videos.thumbnail
           FROM PlaylistItems AS CoverItems
           JOIN Videos ON Videos.id = CoverItems.videoId
           WHERE CoverItems.playlistId = Playlists.id
             AND Videos.thumbnail IS NOT NULL
             AND TRIM(Videos.thumbnail) != ''
           ORDER BY CoverItems.position ASC
           LIMIT 1
         ),
         Playlists.coverUri
       ) AS coverUri,
       (
         SELECT Videos.thumbnailHash
         FROM PlaylistItems AS CoverItems
         JOIN Videos ON Videos.id = CoverItems.videoId
         WHERE CoverItems.playlistId = Playlists.id
           AND Videos.thumbnailHash IS NOT NULL
           AND TRIM(Videos.thumbnailHash) != ''
         ORDER BY CoverItems.position ASC
         LIMIT 1
       ) AS coverHash,
       COUNT(PlaylistItems.id) AS videoCount
     FROM Playlists
     LEFT JOIN PlaylistItems ON PlaylistItems.playlistId = Playlists.id
     GROUP BY Playlists.id
     ORDER BY Playlists.createdAt DESC`
  );

  return rows.map(mapPlaylistRow);
}

export async function deletePlaylist(id: string) {
  await initDB();
  await db.runAsync(`DELETE FROM Playlists WHERE id = ?`, [id]);
}

export async function addToPlaylist(playlistId: string, videoId: string) {
  await initDB();

  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM PlaylistItems WHERE playlistId = ? AND videoId = ?`,
    [playlistId, videoId]
  );

  if (existing?.id) return false;

  const result = await db.getFirstAsync<{ maxPos: number | null }>(
    `SELECT MAX(position) AS maxPos FROM PlaylistItems WHERE playlistId = ?`,
    [playlistId]
  );

  const position = Number(result?.maxPos ?? 0) + 1;

  const insertResult = await db.runAsync(
    `INSERT INTO PlaylistItems (playlistId, videoId, position, addedAt)
     VALUES (?, ?, ?, ?)`,
    [playlistId, videoId, position, Date.now()]
  );

  return insertResult.changes > 0;
}

export async function getPlaylistVideoIds(playlistId: string) {
  await initDB();
  const rows = await db.getAllAsync<{ videoId: string }>(
    `SELECT videoId
     FROM PlaylistItems
     WHERE playlistId = ?
     ORDER BY position ASC`,
    [playlistId]
  );

  return rows.map((row) => row.videoId);
}

export async function getPlaylistVideos(playlistId: string, limit = 20, offset = 0) {
  await initDB();
  const rows = await db.getAllAsync<PlaylistVideoRow>(
    `SELECT
       Videos.*,
       PlaylistItems.id AS playlistItemId,
       PlaylistItems.position AS position
     FROM PlaylistItems
     JOIN Videos ON Videos.id = PlaylistItems.videoId
     WHERE PlaylistItems.playlistId = ?
     ORDER BY PlaylistItems.position ASC
     LIMIT ? OFFSET ?`,
    [playlistId, limit, offset]
  );

  return rows.map(mapPlaylistVideoRow);
}

export async function removeFromPlaylist(playlistId: string, videoId: string) {
  await initDB();
  const item = await db.getFirstAsync<{ id: number; position: number }>(
    `SELECT id, position
     FROM PlaylistItems
     WHERE playlistId = ? AND videoId = ?`,
    [playlistId, videoId]
  );

  if (!item) return false;

  await db.runAsync(`DELETE FROM PlaylistItems WHERE id = ?`, [item.id]);
  await db.runAsync(
    `UPDATE PlaylistItems
     SET position = position - 1
     WHERE playlistId = ? AND position > ?`,
    [playlistId, item.position]
  );

  return true;
}

export async function reorderPlaylist(
  playlistId: string,
  items: Array<{ playlistItemId: number }>
) {
  await initDB();

  for (const [index, item] of items.entries()) {
    await db.runAsync(
      `UPDATE PlaylistItems
       SET position = ?
       WHERE playlistId = ? AND id = ?`,
      [index + 1, playlistId, item.playlistItemId]
    );
  }
}
