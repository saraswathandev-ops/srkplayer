import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { db, initDB } from "@/services/database";
import {
  DEFAULT_PLAYER_SETTINGS,
  PLAYER_STORAGE_KEYS,
  type MediaType,
  type PlayerSettings,
  type VideoItem,
} from "@/types/player";

type LegacyPlaylist = {
  id: string;
  name: string;
  videoIds?: string[];
  createdAt: number;
  coverUri?: string;
};

function parseValue<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isTransientWebVideo(video: VideoItem) {
  return Platform.OS === "web" && video.uri.startsWith("blob:");
}

function normalizeLegacyVideo(video: Partial<VideoItem>): VideoItem | null {
  if (!video.id || !video.uri || !video.title) return null;
  if (isTransientWebVideo(video as VideoItem)) return null;

  const mediaType: MediaType = video.mediaType === "audio" ? "audio" : "video";

  return {
    id: video.id,
    title: video.title,
    uri: video.uri,
    duration: video.duration ?? 0,
    size: video.size ?? 0,
    dateAdded: video.dateAdded ?? Date.now(),
    thumbnail: typeof video.thumbnail === "string" ? video.thumbnail : undefined,
    thumbnailHash: typeof video.thumbnailHash === "string" ? video.thumbnailHash : undefined,
    isFavorite: Boolean(video.isFavorite),
    lastPosition: video.lastPosition,
    playCount: video.playCount ?? 0,
    mimeType: video.mimeType ?? undefined,
    folder: video.folder ?? undefined,
    watchedAt: video.watchedAt,
    mediaType,
  };
}

export async function loadSettings() {
  const settingsData = await AsyncStorage.getItem(PLAYER_STORAGE_KEYS.settings);

  return {
    ...DEFAULT_PLAYER_SETTINGS,
    ...parseValue(settingsData, {} as Partial<PlayerSettings>),
  };
}

export async function saveSettings(settings: PlayerSettings) {
  await AsyncStorage.setItem(
    PLAYER_STORAGE_KEYS.settings,
    JSON.stringify(settings)
  );
}

export async function migrateLegacyStorageIfNeeded() {
  await initDB();

  const migrationFlag = await AsyncStorage.getItem(
    PLAYER_STORAGE_KEYS.sqliteMigrated
  );

  if (migrationFlag === "true") {
    return;
  }

  const existingVideoCountRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(id) AS count FROM Videos`
  );
  const existingPlaylistCountRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(id) AS count FROM Playlists`
  );

  const existingVideoCount = Number(existingVideoCountRow?.count ?? 0);
  const existingPlaylistCount = Number(existingPlaylistCountRow?.count ?? 0);

  if (existingVideoCount > 0 || existingPlaylistCount > 0) {
    await AsyncStorage.setItem(PLAYER_STORAGE_KEYS.sqliteMigrated, "true");
    return;
  }

  const [videosData, playlistsData] = await Promise.all([
    AsyncStorage.getItem(PLAYER_STORAGE_KEYS.videos),
    AsyncStorage.getItem(PLAYER_STORAGE_KEYS.playlists),
  ]);

  const rawVideos = parseValue<Partial<VideoItem>[]>(videosData, []);
  const rawPlaylists = parseValue<LegacyPlaylist[]>(playlistsData, []);
  const videos = rawVideos
    .map(normalizeLegacyVideo)
    .filter((video): video is VideoItem => Boolean(video));

  const validVideoIds = new Set(videos.map((video) => video.id));

  for (const video of videos) {
    await db.runAsync(
      `INSERT OR IGNORE INTO Videos (
         id,
         title,
         path,
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
         mediaType
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        video.id,
        video.title,
        video.uri,
        video.duration,
        typeof video.thumbnail === "string" ? video.thumbnail : null,
        video.thumbnailHash ?? null,
        video.folder ?? null,
        video.watchedAt ?? null,
        video.lastPosition ?? null,
        video.playCount,
        video.isFavorite ? 1 : 0,
        video.size,
        video.dateAdded,
        video.mimeType ?? null,
        video.watchedAt ?? null,
        video.mediaType,
      ]
    );
  }

  for (const playlist of rawPlaylists) {
    if (!playlist.id || !playlist.name) continue;

    await db.runAsync(
      `INSERT OR IGNORE INTO Playlists (id, name, createdAt, coverUri)
       VALUES (?, ?, ?, ?)`,
      [
        playlist.id,
        playlist.name,
        playlist.createdAt ?? Date.now(),
        playlist.coverUri ?? null,
      ]
    );

    const orderedVideoIds = (playlist.videoIds ?? []).filter((videoId) =>
      validVideoIds.has(videoId)
    );

    for (const [index, videoId] of orderedVideoIds.entries()) {
      await db.runAsync(
        `INSERT OR IGNORE INTO PlaylistItems (playlistId, videoId, position, addedAt)
         VALUES (?, ?, ?, ?)`,
        [playlist.id, videoId, index + 1, Date.now()]
      );
    }
  }

  await AsyncStorage.setItem(PLAYER_STORAGE_KEYS.sqliteMigrated, "true");
}
