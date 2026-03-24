import { Platform } from "react-native";

import { buildVideoDraftFromAsset } from "@/services/videoLibrary";
import { type VideoItem } from "@/types/player";
import * as FileSystem from "@/utils/FileSystem";
import { randomUUID } from "@/utils/ids";

export const YOUTUBE_DOWNLOAD_QUALITIES = [
  "360p",
  "480p",
  "720p",
  "1080p",
  "2K",
] as const;

export type YouTubeDownloadQuality =
  (typeof YOUTUBE_DOWNLOAD_QUALITIES)[number];

type DownloadRemoteVideoOptions = {
  sourceUrl: string;
  title: string;
  quality: YouTubeDownloadQuality;
  onProgress?: (progress: number) => void;
};

const DOWNLOAD_DIR =
  FileSystem.documentDirectory != null
    ? `${FileSystem.documentDirectory}downloads/`
    : null;

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72)
    .toLowerCase();
}

function getExtensionFromUrl(sourceUrl: string) {
  const withoutQuery = sourceUrl.split("?")[0] ?? sourceUrl;
  const lastSegment = withoutQuery.split("/").pop() ?? "";
  const extension = lastSegment.split(".").pop()?.toLowerCase();

  if (!extension || extension.length > 5) {
    return "mp4";
  }

  return extension;
}

function inferMimeType(extension: string, fallback?: string | null) {
  if (fallback) return fallback;

  switch (extension) {
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska";
    case "m4v":
      return "video/x-m4v";
    default:
      return "video/mp4";
  }
}

async function ensureDownloadDirectory() {
  if (!DOWNLOAD_DIR) {
    throw new Error("App storage is unavailable on this device.");
  }

  await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, {
    intermediates: true,
  }).catch(() => undefined);

  return DOWNLOAD_DIR;
}

export async function downloadRemoteVideoVariant({
  sourceUrl,
  title,
  quality,
  onProgress,
}: DownloadRemoteVideoOptions): Promise<
  Omit<VideoItem, "id" | "isFavorite" | "playCount">
> {
  if (Platform.OS === "web") {
    throw new Error("In-app downloads are only available on Android and iOS.");
  }

  const normalizedUrl = sourceUrl.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error("Paste a direct http or https video file URL.");
  }

  const extension = getExtensionFromUrl(normalizedUrl);
  const downloadDir = await ensureDownloadDirectory();
  const uniqueId = randomUUID();
  const fileName = sanitizeFileName(`${title}-${quality}-${uniqueId}`);
  const targetUri = `${downloadDir}${fileName}.${extension}`;

  const downloadTask = FileSystem.createDownloadResumable(
    normalizedUrl,
    targetUri,
    {},
    (event) => {
      if (!onProgress) return;

      const total = event.totalBytesExpectedToWrite;
      if (total <= 0) {
        onProgress(0);
        return;
      }

      onProgress(Math.min(event.totalBytesWritten / total, 1));
    }
  );

  const result = await downloadTask.downloadAsync();

  if (!result) {
    throw new Error("The download was cancelled before completion.");
  }

  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => undefined);
    throw new Error(`Download failed with status ${result.status}.`);
  }

  const fileInfo = await FileSystem.getInfoAsync(result.uri).catch(() => null);

  return buildVideoDraftFromAsset({
    name: `${title} ${quality}.${extension}`,
    uri: result.uri,
    size: fileInfo?.exists ? fileInfo.size : 0,
    // mimeType: inferMimeType(extension, result.mimeType),
    folder: "YouTube Downloads",
    dateAdded: Date.now(),
  });
}
