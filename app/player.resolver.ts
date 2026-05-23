import type { VideoItem } from "@/types/player";
import { getPlaybackUri } from "./player.utils";

export function resolveActivePlaybackVideo(options: {
  activeVideoId?: string | null;
  videos: VideoItem[];
  currentVideo?: VideoItem | null;
  storedVideo?: VideoItem | null;
  pendingNavigationTarget?: VideoItem | null;
  queuedVideos?: VideoItem[];
}) {
  const {
    activeVideoId,
    videos,
    currentVideo,
    storedVideo,
    pendingNavigationTarget,
    queuedVideos = [],
  } = options;

  if (!activeVideoId) return null;

  return (
    videos.find((item) => item.id === activeVideoId) ??
    (currentVideo?.id === activeVideoId ? currentVideo : null) ??
    (storedVideo?.id === activeVideoId ? storedVideo : null) ??
    (pendingNavigationTarget?.id === activeVideoId ? pendingNavigationTarget : null) ??
    queuedVideos.find((item) => item.id === activeVideoId) ??
    null
  );
}

export function resolvePlaybackQueue(options: {
  routeFolder?: string | null;
  folderQueueVideos: VideoItem[];
  hydratedVideos: VideoItem[];
  videoId?: string | null;
  routePlaybackUri?: string | null;
  activeVideoId?: string | null;
  routeVideoId?: string | null;
  video?: VideoItem | null;
}) {
  const videoQueue =
    options.routeFolder && options.folderQueueVideos.length > 0
      ? options.folderQueueVideos
      : options.hydratedVideos.filter((item) => item.mediaType !== "audio");
  const audioQueue = options.hydratedVideos.filter((item) => item.mediaType === "audio");
  const currentIndex = options.videoId
    ? videoQueue.findIndex((item) => item.id === options.videoId)
    : -1;
  const previousVideo = currentIndex > 0 ? videoQueue[currentIndex - 1] : null;
  const nextVideo =
    currentIndex >= 0 && currentIndex < videoQueue.length - 1
      ? videoQueue[currentIndex + 1]
      : null;
  const initialRoutePlaybackUri =
    options.activeVideoId === options.routeVideoId &&
    typeof options.routePlaybackUri === "string" &&
    options.routePlaybackUri.length > 0
      ? options.routePlaybackUri
      : null;
  const playbackUri = initialRoutePlaybackUri ?? getPlaybackUri(options.video);

  return {
    videoQueue,
    audioQueue,
    currentIndex,
    previousVideo,
    nextVideo,
    playbackUri,
  };
}
