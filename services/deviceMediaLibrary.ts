import RNFS from "react-native-fs";
import { PermissionsAndroid, Platform, Alert } from "react-native";

import { type MediaType, type VideoItem } from "@/types/player";

const BATCH_SIZE = 200;
const DEFAULT_FOLDER = "Internal Storage";
const UNKNOWN_ARTIST = "Unknown Artist";

const AUDIO_EXTENSIONS = new Set([
  "mp3", "m4a", "aac", "wav", "flac", "ogg", "oga", "opus", "amr",
]);
const VIDEO_EXTENSIONS = new Set([
  "mp4", "mkv", "webm", "avi", "mov", "m4v", "3gp",
]);

/**
 * Directory names to skip entirely during recursive scan.
 * Hidden dirs (starting with ".") are also skipped via isLikelyMediaDirectory.
 */
const SKIPPED_DIR_NAMES = new Set([
  ".thumbnails", "Android", "cache", "tmp", "node_modules", "gradle",
]);
const DIRECTORY_YIELD_INTERVAL = 20;

type VideoDraft = Omit<VideoItem, "id" | "isFavorite" | "playCount">;
type VideoBatchHandler = (videos: VideoDraft[]) => Promise<void> | void;

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

function getExtension(path: string) {
  return normalizePath(path).split(".").pop()?.toLowerCase() ?? "";
}

function inferMediaType(path: string): MediaType | null {
  const ext = getExtension(path);
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}

function inferMimeType(path: string, mediaType: MediaType) {
  const ext = getExtension(path);
  return ext ? `${mediaType}/${ext}` : undefined;
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "") || "Unknown";
}

function extractFolder(path: string) {
  const segments = normalizePath(path).split("/").filter(Boolean);
  return segments.length >= 2 ? segments[segments.length - 2] : DEFAULT_FOLDER;
}

function isTrashedFile(name: string, path: string): boolean {
  // Android trash naming: .trashed-<timestamp>-<original-name>
  if (name.startsWith(".trashed-")) return true;
  if (path.includes("/.trash/")) return true;
  return false;
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

function pauseForUiFrame() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function mapFileToDraft(file: RNFS.ReadDirItem): VideoDraft | null {
  try {
    // Skip Android trashed files — permission-restricted and crash native modules
    if (isTrashedFile(file.name, file.path)) {
      return null;
    }

    // Skip hidden files (starting with ".")
    if (file.name.startsWith(".")) return null;

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
  } catch (err) {
    console.warn("[deviceMediaLibrary] mapFileToDraft failed for:", file.path, err);
    return null;
  }
}

// ─── Permissions ─────────────────────────────────────────────────────────────

export async function requestVideoPermission() {
  return requestDeviceMediaLibraryPermission().then((result) => result.granted);
}

export async function requestDeviceMediaLibraryPermission() {
  if (Platform.OS !== "android") {
    return { granted: true, status: "granted", canAskAgain: true };
  }

  try {
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
  } catch (err) {
    console.error("[deviceMediaLibrary] Permission request failed:", err);
    return { granted: false, status: "denied", canAskAgain: false };
  }
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

async function flushBatch(batch: VideoDraft[], onBatch: VideoBatchHandler) {
  if (batch.length === 0) return;
  const nextBatch = batch.splice(0, batch.length);
  try {
    console.log(`[deviceMediaLibrary] Flushing batch of ${nextBatch.length} items`);
    await onBatch(nextBatch);
  } catch (err) {
    console.error("[deviceMediaLibrary] Batch handler failed:", err);
  }
}

type SyncOptions = {
  /** Set of already-known file URIs to skip during scan */
  knownUris?: Set<string>;
  /** Set of URIs to track deletions. Encountered URIs are removed from this set. */
  unseenUris?: Set<string>;
  /** Force full rescan even if file is already known */
  forceFullRescan?: boolean;
};

export async function syncDeviceMediaLibraryInBatches(
  onBatch: VideoBatchHandler,
  options: SyncOptions = {}
): Promise<{ total: number; skipped: number }> {
  if (Platform.OS === "web") {
    return { total: 0, skipped: 0 };
  }

  let permission;
  try {
    permission = await requestDeviceMediaLibraryPermission();
  } catch (err) {
    console.error("[deviceMediaLibrary] Permission check failed:", err);
    return { total: 0, skipped: 0 };
  }

  if (!permission.granted) {
    console.warn("[deviceMediaLibrary] Permission denied — skipping scan.");
    return { total: 0, skipped: 0 };
  }

  const root = RNFS.ExternalStorageDirectoryPath;
  if (!root) {
    console.warn("[deviceMediaLibrary] No external storage root — skipping scan.");
    return { total: 0, skipped: 0 };
  }

  const knownUris = options.knownUris ?? new Set<string>();
  const skipKnown = !options.forceFullRescan && knownUris.size > 0;

  const pendingDirs = [root];
  const batch: VideoDraft[] = [];
  let total = 0;
  let skipped = 0;
  let scannedDirCount = 0;
  const scanStart = Date.now();

  while (pendingDirs.length > 0) {
    const directory = pendingDirs.shift();
    if (!directory) continue;

    let entries: RNFS.ReadDirItem[] = [];
    try {
      // Log the directory being scanned to help trace crashes
      console.log(`[deviceMediaLibrary] Scanning directory: ${directory}`);
      entries = await RNFS.readDir(directory);
    } catch (err) {
      console.warn(`[deviceMediaLibrary] Failed to read dir (permission-denied or removed): ${directory}`, err);
      continue;
    }

    scannedDirCount += 1;
    if (scannedDirCount % DIRECTORY_YIELD_INTERVAL === 0) {
      await pauseForUiFrame();
    }

    for (const entry of entries) {
      try {
        if (entry.isDirectory()) {
          if (isLikelyMediaDirectory(entry.path)) {
            pendingDirs.push(entry.path);
          }
          continue;
        }

        if (!entry.isFile()) continue;

        const fileUri = toFileUri(entry.path);

        if (options.unseenUris) {
          options.unseenUris.delete(fileUri);
        }

        // Quick skip: if file URI is already known in the database, skip it
        if (skipKnown && knownUris.has(fileUri)) {
          skipped++;
          continue;
        }

        const draft = mapFileToDraft(entry);
        if (!draft) continue;

        batch.push(draft);
        total++;

        if (batch.length >= BATCH_SIZE) {
          await flushBatch(batch, onBatch);
          await pauseForUiFrame();
        }
      } catch (err) {
        console.warn("[deviceMediaLibrary] Entry processing failed (skipped):", entry.path, err);
      }
    }
  }

  await flushBatch(batch, onBatch);

  const elapsed = ((Date.now() - scanStart) / 1000).toFixed(1);
  console.log(
    `[deviceMediaLibrary] Scan complete: ${total} new/changed, ${skipped} skipped, ${elapsed}s`
  );

  return { total, skipped };
}

export async function syncDeviceMediaLibrary(
  options: SyncOptions = {}
): Promise<VideoDraft[]> {
  const videos: VideoDraft[] = [];

  try {
    await syncDeviceMediaLibraryInBatches((batch) => {
      videos.push(...batch);
    }, options);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[deviceMediaLibrary] syncDeviceMediaLibrary failed:", err);
    Alert.alert("Sync Error", `Media library sync crashed/failed: ${errorMsg}`);
  }

  return videos;
}

// ─── Aliases ──────────────────────────────────────────────────────────────────
export const requestVideoLibraryPermission = requestDeviceMediaLibraryPermission;
export const syncDeviceVideoLibraryInBatches = syncDeviceMediaLibraryInBatches;
export const syncDeviceVideoLibrary = syncDeviceMediaLibrary;
