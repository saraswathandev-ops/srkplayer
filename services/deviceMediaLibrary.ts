import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { PermissionsAndroid, Platform } from "react-native";

import { type VideoItem } from "@/types/player";

const PAGE_SIZE = 48;
const DEFAULT_FOLDER = "All Videos";

type VideoDraft = Omit<VideoItem, "id" | "isFavorite" | "playCount">;
type VideoBatchHandler = (videos: VideoDraft[]) => Promise<void> | void;

type CameraRollEdge = {
  node: {
    image: {
      uri: string;
      filename?: string | null;
      fileSize?: number | null;
    };
    playableDuration?: number | null;
    timestamp: number;
  };
};

export async function requestVideoPermission() {
  if (Platform.OS === "android") {
    if (Platform.Version >= 33) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      ]);

      return (
        granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return true;
}

function inferMimeType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? `video/${extension}` : undefined;
}

function extractFolderFromUri(uri?: string) {
  if (!uri) return DEFAULT_FOLDER;

  const segments = uri.replace(/\\/g, "/").split("/").filter(Boolean);
  return segments.length >= 2 ? segments[segments.length - 2] : DEFAULT_FOLDER;
}

function mapEdgeToVideo(edge: CameraRollEdge): VideoDraft {
  const node = edge.node;
  const uri = node.image.uri;
  const filename = node.image.filename || "Unknown";

  return {
    title: filename.replace(/\.[^.]+$/, "") || "Unknown",
    uri,
    duration: Math.max(0, node.playableDuration ?? 0),
    size: Number(node.image.fileSize ?? 0),
    dateAdded: new Date(node.timestamp * 1000).getTime(),
    mimeType: inferMimeType(filename),
    folder: extractFolderFromUri(uri),
    mediaType: "video",
  };
}

export async function requestDeviceMediaLibraryPermission() {
  const granted = await requestVideoPermission();

  return {
    granted,
    status: granted ? "granted" : "denied",
    canAskAgain: true,
  };
}

export async function syncDeviceMediaLibraryInBatches(
  onBatch: VideoBatchHandler
): Promise<{ total: number }> {
  if (Platform.OS === "web") {
    return { total: 0 };
  }

  const hasPermission = await requestVideoPermission();
  if (!hasPermission) {
    throw new Error("Permission denied");
  }

  let total = 0;
  let after: string | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await CameraRoll.getPhotos({
      first: PAGE_SIZE,
      after,
      assetType: "Videos",
      include: ["filename", "fileSize", "playableDuration"],
    });

    const drafts = result.edges.map((edge) => mapEdgeToVideo(edge as CameraRollEdge));

    total += drafts.length;

    if (drafts.length > 0) {
      await onBatch(drafts);
    }

    hasNextPage = result.page_info.has_next_page;
    after = result.page_info.end_cursor ?? undefined;
  }

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
