import { Platform } from "react-native";
import { createThumbnail } from "react-native-create-thumbnail";

import { type MediaType, type VideoThumbnailSource } from "@/types/player";
import * as FileSystem from "@/utils/FileSystem";
import { hashString } from "@/utils/hash";

const THUMBNAIL_DIR =
  FileSystem.documentDirectory != null
    ? `${FileSystem.documentDirectory}thumbnails/`
    : null;
const THUMBNAIL_MAX_WIDTH = 128;
const THUMBNAIL_MAX_HEIGHT = 72;

type ThumbnailResult = {
  thumbnail?: VideoThumbnailSource;
  thumbnailHash?: string;
};

let thumbnailDirectoryPromise: Promise<void> | null = null;

export function getThumbnailCacheDirectory() {
  return THUMBNAIL_DIR;
}

function extractPersistableThumbnailUri(source: unknown): string | null {
  if (typeof source === "string") return source;
  if (!source || typeof source !== "object") return null;

  const candidate = source as {
    uri?: unknown;
    localUri?: unknown;
    fileUri?: unknown;
  };

  if (typeof candidate.uri === "string") return candidate.uri;
  if (typeof candidate.localUri === "string") return candidate.localUri;
  if (typeof candidate.fileUri === "string") return candidate.fileUri;
  return null;
}

function isTrashedUri(uri: string): boolean {
  const path = uri.replace(/^file:\/\//, "");
  return path.includes("/.trashed-") || path.includes("/.trash/");
}

async function ensureThumbnailDirectory(): Promise<void> {
  if (!THUMBNAIL_DIR) return;
  if (thumbnailDirectoryPromise) {
    await thumbnailDirectoryPromise;
    return;
  }

  thumbnailDirectoryPromise = FileSystem.makeDirectoryAsync(THUMBNAIL_DIR, {
    intermediates: true,
  }).catch((err) => {
    console.warn("[videoThumbnails] Failed to create thumbnail dir:", err);
  });

  await thumbnailDirectoryPromise;
}

async function getThumbnailCacheUri(videoUri: string): Promise<string | null> {
  if (!THUMBNAIL_DIR) return null;
  try {
    const cacheKey = hashString(videoUri);
    return `${THUMBNAIL_DIR}${cacheKey}.jpg`;
  } catch (err) {
    console.warn("[videoThumbnails] Failed to build cache URI:", err);
    return null;
  }
}

async function getExistingThumbnail(cacheUri: string | null): Promise<string | null> {
  if (!cacheUri) return null;
  try {
    const info = await FileSystem.getInfoAsync(cacheUri);
    if (!info.exists || info.isDirectory) return null;
    return cacheUri;
  } catch (err) {
    console.warn("[videoThumbnails] getExistingThumbnail failed:", err);
    return null;
  }
}

async function persistThumbnailToCache(
  source: unknown,
  targetUri: string | null
): Promise<string | undefined> {
  const sourceUri = extractPersistableThumbnailUri(source);
  if (!sourceUri || !targetUri) return undefined;

  try {
    await ensureThumbnailDirectory();

    const existing = await getExistingThumbnail(targetUri);
    if (!existing || existing !== sourceUri) {
      await FileSystem.copyAsync({ from: sourceUri, to: targetUri }).catch((err) => {
        console.warn("[videoThumbnails] copyAsync failed:", err);
      });
    }

    const stored = await getExistingThumbnail(targetUri);
    return stored ?? sourceUri;
  } catch (err) {
    console.warn("[videoThumbnails] persistThumbnailToCache failed:", err);
    return undefined;
  }
}

export async function createVideoThumbnailBundle(
  uri: string,
  mediaType: MediaType
): Promise<ThumbnailResult> {
  if (Platform.OS === "web" || mediaType !== "video") {
    return {};
  }

  try {
    // Skip Android trashed files — they exist on disk but MediaMetadataRetriever
    // cannot open them (permission-restricted) and will crash the native module.
    if (isTrashedUri(uri)) {
      console.log("[videoThumbnails] Skipping trashed file:", uri);
      return {};
    }

    const cacheUri = await getThumbnailCacheUri(uri);
    const existingThumbnail = await getExistingThumbnail(cacheUri);
    if (existingThumbnail) {
      return { thumbnail: existingThumbnail };
    }

    // Verify the file exists before passing to native module
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      console.log("[videoThumbnails] File does not exist, skipping:", uri);
      return {};
    }

    const generated = await createThumbnail({
      url: uri,
      timeStamp: 1000,
      format: "jpeg",
      maxWidth: THUMBNAIL_MAX_WIDTH,
      maxHeight: THUMBNAIL_MAX_HEIGHT,
    });

    const thumbnail = await persistThumbnailToCache(generated.path, cacheUri);
    return thumbnail ? { thumbnail } : {};
  } catch (err) {
    // Log but never crash — thumbnail generation is best-effort
    console.warn("[videoThumbnails] createVideoThumbnailBundle failed for:", uri, err);
    return {};
  }
}

export async function deleteStoredThumbnail(thumbnail?: VideoThumbnailSource): Promise<void> {
  if (!thumbnail || typeof thumbnail !== "string" || !THUMBNAIL_DIR) return;
  if (!thumbnail.startsWith(THUMBNAIL_DIR)) return;

  try {
    await FileSystem.deleteAsync(thumbnail, { idempotent: true });
  } catch (err) {
    console.warn("[videoThumbnails] deleteStoredThumbnail failed:", err);
  }
}
