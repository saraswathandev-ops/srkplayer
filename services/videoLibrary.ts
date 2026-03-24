import {
  type MediaType,
  type Playlist,
  type PlayerSettings,
  type VideoItem,
} from "@/types/player";
import { createVideoThumbnailBundle } from "@/services/videoThumbnails";
import { randomUUID } from "@/utils/ids";

type ImportableVideoAsset = {
  name: string;
  uri: string;
  size?: number | null;
  mimeType?: string | null;
  duration?: number | null;
  folder?: string | null;
  dateAdded?: number | null;
};

function inferMediaType(asset: Pick<ImportableVideoAsset, "mimeType" | "name">): MediaType {
  const mimeType = asset.mimeType?.toLowerCase();

  if (mimeType?.startsWith("audio/")) return "audio";
  if (mimeType?.startsWith("video/")) return "video";

  const extension = asset.name.split(".").pop()?.toLowerCase();
  if (!extension) return "video";

  if (
    ["mp3", "m4a", "aac", "wav", "flac", "ogg", "oga", "opus", "amr"].includes(
      extension
    )
  ) {
    return "audio";
  }

  return "video";
}

export async function buildVideoDraftFromAsset(
  asset: ImportableVideoAsset
): Promise<Omit<VideoItem, "id" | "isFavorite" | "playCount">> {
  const mediaType = inferMediaType(asset);
  const thumbnailBundle = await createVideoThumbnailBundle(asset.uri, mediaType);

  return {
    title: asset.name.replace(/\.[^.]+$/, ""),
    uri: asset.uri,
    duration: asset.duration ?? 0,
    size: asset.size ?? 0,
    dateAdded: asset.dateAdded ?? Date.now(),
    thumbnail: thumbnailBundle.thumbnail,
    thumbnailHash: thumbnailBundle.thumbnailHash,
    mimeType: asset.mimeType ?? undefined,
    folder: asset.folder ?? undefined,
    mediaType,
  };
}

export function createVideoItem(
  video: Omit<VideoItem, "id" | "isFavorite" | "playCount">
): VideoItem {
  return {
    ...video,
    id: randomUUID(),
    isFavorite: false,
    playCount: 0,
  };
}

export function appendUniqueVideo(
  videos: VideoItem[],
  newVideo: VideoItem
): VideoItem[] {
  const existing = videos.find((video) => video.uri === newVideo.uri);
  if (existing) return videos;
  return [newVideo, ...videos];
}

export function syncVideoLibrary(
  currentVideos: VideoItem[],
  incomingVideos: Omit<VideoItem, "id" | "isFavorite" | "playCount">[]
) {
  const incomingByUri = new Map(incomingVideos.map((video) => [video.uri, video]));
  const updatedVideos = currentVideos.map((video) => {
    const incoming = incomingByUri.get(video.uri);
    if (!incoming) return video;

    incomingByUri.delete(video.uri);
    return {
      ...video,
      title: incoming.title,
      duration: incoming.duration,
      size: incoming.size,
      dateAdded: incoming.dateAdded,
      thumbnail: incoming.thumbnail ?? video.thumbnail,
      thumbnailHash: incoming.thumbnailHash ?? video.thumbnailHash,
      mimeType: incoming.mimeType,
      folder: incoming.folder,
      mediaType: incoming.mediaType,
    };
  });

  const newVideos = Array.from(incomingByUri.values()).map((video) =>
    createVideoItem(video)
  );

  return {
    videos: [...newVideos, ...updatedVideos].sort(
      (left, right) => right.dateAdded - left.dateAdded
    ),
    addedCount: newVideos.length,
    totalCount: incomingVideos.length,
  };
}

export function updateVideoInList(
  videos: VideoItem[],
  id: string,
  updater: (video: VideoItem) => VideoItem
): VideoItem[] {
  return videos.map((video) => (video.id === id ? updater(video) : video));
}

export function createPlaylistItem(name: string): Playlist {
  return {
    id: randomUUID(),
    name,
    createdAt: Date.now(),
    videoCount: 0,
  };
}

export function searchVideosByTitle(videos: VideoItem[], query: string) {
  if (!query.trim()) return videos;
  const lowerQuery = query.toLowerCase();
  return videos.filter((video) => (video.title || "").toLowerCase().includes(lowerQuery));
}

export function getRecentVideos(videos: VideoItem[]) {
  return [...videos]
    .filter((video) => video.playCount > 0)
    .sort((left, right) => (right.watchedAt || 0) - (left.watchedAt || 0))
    .slice(0, 10);
}

export function getFavoriteVideos(videos: VideoItem[]) {
  return videos.filter((video) => video.isFavorite);
}

export function mergeSettings(
  currentSettings: PlayerSettings,
  nextSettings: Partial<PlayerSettings>
) {
  return { ...currentSettings, ...nextSettings };
}
