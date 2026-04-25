import RNFS from "react-native-fs";
import { PermissionsAndroid, Platform } from "react-native";

import { type MediaType, type VideoItem } from "@/types/player";

const BATCH_SIZE = 64;
const DEFAULT_FOLDER = "Internal Storage";
const UNKNOWN_ARTIST = "Unknown Artist";
const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "m4a",
  "aac",
  "wav",
  "flac",
  "ogg",
  "oga",
  "opus",
  "amr",
]);
const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mkv",
  "webm",
  "avi",
  "mov",
  "m4v",
  "3gp",
]);
const SKIPPED_DIR_NAMES = new Set([
  ".thumbnails",
  "Android",
  "cache",
  "tmp",
]);

type VideoDraft = Omit<VideoItem, "id" | "isFavorite" | "playCount">;
type VideoBatchHandler = (videos: VideoDraft[]) => Promise<void> | void;

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

function getExtension(path: string) {
  return normalizePath(path).split(".").pop()?.toLowerCase() ?? "";
}

function inferMediaType(path: string): MediaType | null {
  const extension = getExtension(path);
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  return null;
}

function inferMimeType(path: string, mediaType: MediaType) {
  const extension = getExtension(path);
  return extension ? `${mediaType}/${extension}` : undefined;
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "") || "Unknown";
}

function extractFolder(path: string) {
  const segments = normalizePath(path).split("/").filter(Boolean);
  return segments.length >= 2 ? segments[segments.length - 2] : DEFAULT_FOLDER;
}

function isLikelyMediaDirectory(path: string) {
  const normalized = normalizePath(path);
  const name = normalized.split("/").filter(Boolean).pop() ?? "";
  if (name.startsWith(".")) return false;
  if (SKIPPED_DIR_NAMES.has(name)) return false;
  if (normalized.includes("/Android/data") || normalized.includes("/Android/obb")) return false;
  return true;
}

function toFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function mapFileToDraft(file: RNFS.ReadDirItem): VideoDraft | null {
  const mediaType = inferMediaType(file.path);
  if (!mediaType) return null;

  const folder = extractFolder(file.path);
  const title = stripExtension(file.name);

  return {
    title,
    uri: toFileUri(file.path),
    duration: 0,
    size: Number(file.size ?? 0),
    dateAdded: Number(file.mtime?.getTime?.() ?? Date.now()),
    mimeType: inferMimeType(file.path, mediaType),
    folder,
    album: mediaType === "audio" ? folder : undefined,
    artist: mediaType === "audio" ? UNKNOWN_ARTIST : undefined,
    mediaType,
  };
}

export async function requestVideoPermission() {
  return requestDeviceMediaLibraryPermission().then((result) => result.granted);
}

export async function requestDeviceMediaLibraryPermission() {
  if (Platform.OS !== "android") {
    return { granted: true, status: "granted", canAskAgain: true };
  }

  if (Platform.Version >= 33) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
    ]);

    const hasAudio =
      granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const hasVideo =
      granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
      PermissionsAndroid.RESULTS.GRANTED;

    return {
      granted: hasAudio || hasVideo,
      status: hasAudio || hasVideo ? "granted" : "denied",
      canAskAgain: true,
    };
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
  );

  return {
    granted: granted === PermissionsAndroid.RESULTS.GRANTED,
    status: granted === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied",
    canAskAgain: true,
  };
}

async function flushBatch(batch: VideoDraft[], onBatch: VideoBatchHandler) {
  if (batch.length === 0) return;
  const nextBatch = batch.splice(0, batch.length);
  await onBatch(nextBatch);
}

export async function syncDeviceMediaLibraryInBatches(
  onBatch: VideoBatchHandler
): Promise<{ total: number }> {
  if (Platform.OS === "web") {
    return { total: 0 };
  }

  const permission = await requestDeviceMediaLibraryPermission();
  if (!permission.granted) {
    throw new Error("Permission denied");
  }

  const root = RNFS.ExternalStorageDirectoryPath;
  if (!root) {
    return { total: 0 };
  }
  const pendingDirs = [root];
  const batch: VideoDraft[] = [];
  let total = 0;

  while (pendingDirs.length > 0) {
    const directory = pendingDirs.shift();
    if (!directory) continue;

    let entries: RNFS.ReadDirItem[] = [];
    try {
      entries = await RNFS.readDir(directory);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (isLikelyMediaDirectory(entry.path)) {
          pendingDirs.push(entry.path);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const draft = mapFileToDraft(entry);
      if (!draft) continue;

      batch.push(draft);
      total++;

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch, onBatch);
      }
    }
  }

  await flushBatch(batch, onBatch);
  return { total };
}

export async function syncDeviceMediaLibrary(): Promise<VideoDraft[]> {
  const videos: VideoDraft[] = [];

  await syncDeviceMediaLibraryInBatches((batch) => {
    videos.push(...batch);
  });

  return videos;
}

export const requestVideoLibraryPermission = requestDeviceMediaLibraryPermission;
export const syncDeviceVideoLibraryInBatches = syncDeviceMediaLibraryInBatches;
export const syncDeviceVideoLibrary = syncDeviceMediaLibrary;
