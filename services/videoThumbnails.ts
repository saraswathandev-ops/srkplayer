import { Platform } from "react-native";

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

function extractPersistableThumbnailUri(source: unknown) {
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

async function ensureThumbnailDirectory() {
  if (!THUMBNAIL_DIR) return;
  if (thumbnailDirectoryPromise) return thumbnailDirectoryPromise;

  thumbnailDirectoryPromise = FileSystem.makeDirectoryAsync(THUMBNAIL_DIR, {
    intermediates: true,
  }).catch(() => undefined);

  await thumbnailDirectoryPromise;
}

async function getThumbnailCacheUri(videoUri: string) {
  if (!THUMBNAIL_DIR) return null;
  const cacheKey = hashString(videoUri);
  return `${THUMBNAIL_DIR}${cacheKey}.jpg`;
}

async function getExistingThumbnail(cacheUri: string | null) {
  if (!cacheUri) return null;

  const info = await FileSystem.getInfoAsync(cacheUri);
  if (!info.exists || info.isDirectory) return null;

  return cacheUri;
}

async function persistThumbnailToCache(
  source: unknown,
  targetUri: string | null
): Promise<string | undefined> {
  const sourceUri = extractPersistableThumbnailUri(source);
  if (!sourceUri || !targetUri) return undefined;

  await ensureThumbnailDirectory();

  const existing = await getExistingThumbnail(targetUri);
  if (!existing || existing !== sourceUri) {
    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetUri,
    }).catch(() => undefined);
  }

  const stored = await getExistingThumbnail(targetUri);
  return stored ?? sourceUri;
}

export async function createVideoThumbnailBundle(
  uri: string,
  mediaType: MediaType
): Promise<ThumbnailResult> {
  if (Platform.OS === "web" || mediaType !== "video") {
    return {};
  }

  const cacheUri = await getThumbnailCacheUri(uri);
  const existingThumbnail = await getExistingThumbnail(cacheUri);

  if (existingThumbnail) {
    return {
      thumbnail: existingThumbnail,
    };
  }

  // Thumbnail generation needs a native thumbnail package in bare React Native.
  // Until one is added, keep imports working and skip generating new thumbnails.
  void uri;
  void THUMBNAIL_MAX_WIDTH;
  void THUMBNAIL_MAX_HEIGHT;
  void persistThumbnailToCache;

  return {};
}

export async function deleteStoredThumbnail(thumbnail?: VideoThumbnailSource) {
  if (!thumbnail || typeof thumbnail !== "string" || !THUMBNAIL_DIR) return;
  if (!thumbnail.startsWith(THUMBNAIL_DIR)) return;

  await FileSystem.deleteAsync(thumbnail, { idempotent: true }).catch(() => undefined);
}
