import { isTrackPlayerAvailable } from "@/services/trackPlayerService";
import { type VideoItem } from "@/types/player";
import { VERTICAL_GESTURE_SENSITIVITY_PX } from "./player.constants";
import type {
  ContentFitMode,
  DecoderMode,
  PlayerAudioTrack,
  VideoPlayerShim,
} from "./player.types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function clamp01(value: number) {
  return clamp(value, 0, 1);
}

export function applyGestureCurve(value: number, exponent = 1.08) {
  const safeValue = clamp(value, -1, 1);
  return Math.sign(safeValue) * Math.pow(Math.abs(safeValue), exponent);
}

export function getTouchDistance(
  touches?: ReadonlyArray<{ pageX: number; pageY: number } | null>
) {
  if (!touches || touches.length < 2) return 0;
  const firstTouch = touches[0];
  const secondTouch = touches[1];
  if (!firstTouch || !secondTouch) return 0;
  return Math.hypot(
    secondTouch.pageX - firstTouch.pageX,
    secondTouch.pageY - firstTouch.pageY
  );
}

// Returns a delta value (positive = up = increase) for relative gesture control
export function resolveVerticalGestureDelta(options: {
  dy: number;
  viewportHeight: number;
}) {
  return clamp(-options.dy / VERTICAL_GESTURE_SENSITIVITY_PX, -1, 1);
}

export function resolveEdgeVerticalControlMode(options: {
  x: number;
  viewportWidth: number;
  isAudioMode: boolean;
  swipeBrightness: boolean;
  swipeVolume: boolean;
}): "brightness" | "volume" | null {
  const safeWidth = Math.max(options.viewportWidth || 1, 1);
  const midPoint = safeWidth / 2;

  if (
    !options.isAudioMode &&
    options.swipeBrightness &&
    options.x <= midPoint
  ) {
    return "brightness";
  }

  if (
    options.swipeVolume &&
    options.x > midPoint
  ) {
    return "volume";
  }

  return null;
}

export function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "Unknown";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function fitFromSetting(mode: "fit" | "expand" | "stretch"): ContentFitMode {
  if (mode === "expand") return "cover";
  if (mode === "stretch") return "fill";
  return "contain";
}

export function initialPlayerFitFromSetting(mode: "fit" | "expand" | "stretch"): ContentFitMode {
  return fitFromSetting(mode);
}

export function settingFromFit(mode: ContentFitMode) {
  if (mode === "cover") return "expand" as const;
  if (mode === "fill") return "stretch" as const;
  return "fit" as const;
}

export function parseAspectRatio(ratio: string | null) {
  if (!ratio) return null;
  const [widthText, heightText] = ratio.split(":");
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return width / height;
}

export function getAudioTrackLabel(track?: PlayerAudioTrack | null) {
  if (!track) return "Audio";
  return track.title || track.language?.toUpperCase() || `Track ${track.index + 1}`;
}

export function getDecoderModeLabel(mode: DecoderMode) {
  if (mode === "hwPlus") return "HW+";
  if (mode === "hw") return "HW";
  return "SW";
}

export function applyPlayerAudioState(
  player: VideoPlayerShim,
  options: {
    volume: number;
    volumeBoost?: number;
    isMuted: boolean;
    backgroundPlay: boolean;
  }
) {
  const safeVolume = clamp01(options.volume);
  const boost = Math.max(options.volumeBoost ?? 1, 1);
  player.audioMixingMode = "doNotMix";
  // Always keep audio alive in background when the setting is enabled.
  // When TrackPlayer is available it handles the notification; when not, show system one.
  player.staysActiveInBackground = options.backgroundPlay;
  player.showNowPlayingNotification = options.backgroundPlay && !isTrackPlayerAvailable;
  player.volume = safeVolume * boost;
  player.muted = options.isMuted || safeVolume <= 0.001;
}

export function getPlaybackUri(video?: {
  uri: string;
  sourceUri?: string;
  isClip?: boolean;
} | null) {
  if (!video) return null;
  if (video.isClip || video.uri.startsWith("mxclip://")) {
    return video.sourceUri || null;
  }
  return video.uri || video.sourceUri || null;
}

export function buildHandoffQueue(
  videoQueue: VideoItem[],
  fallback: VideoItem,
  fallbackUri: string | null,
  currentIndex: number,
): { queue: (VideoItem & { uri: string; mediaType: "video" })[]; index: number } {
  const queue = videoQueue.map((item) => ({
    ...item,
    uri: getPlaybackUri(item) ?? item.uri,
    mediaType: "video" as const,
  }));
  const index = currentIndex >= 0 ? currentIndex : 0;
  if (queue.length === 0) {
    queue.push({ ...fallback, uri: fallbackUri ?? fallback.uri, mediaType: "video" as const });
  }
  return { queue, index };
}

export function safeDecodeFilePath(uri: string) {
  const path = uri.replace(/^file:\/\//, "");
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

export function getLocalFilePath(uri: string) {
  if (uri.startsWith("file://")) return safeDecodeFilePath(uri);
  if (uri.startsWith("/")) return safeDecodeFilePath(uri);
  return null;
}

export function encodeLocalFileUri(path: string) {
  const normalizedPath = path.replace(/\\/g, "/");
  const encodedPath = normalizedPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `file://${encodedPath}`;
}

export function normalizePlaybackUri(uri: string) {
  const localPath = getLocalFilePath(uri);
  if (!localPath) return uri;
  return encodeLocalFileUri(localPath);
}

export function getClipStartOffset(video?: {
  isClip?: boolean;
  clipStart?: number;
} | null) {
  return video?.isClip ? Math.max(video.clipStart ?? 0, 0) : 0;
}

export function getClipEndPosition(video?: {
  isClip?: boolean;
  clipStart?: number;
  clipEnd?: number;
} | null) {
  if (!video?.isClip) return null;
  const clipStart = getClipStartOffset(video);
  if (!Number.isFinite(video.clipEnd)) return null;
  return Math.max(video.clipEnd ?? clipStart, clipStart);
}

export function getPlayableDuration(
  video: {
    duration: number;
    isClip?: boolean;
    clipStart?: number;
    clipEnd?: number;
  } | null | undefined,
  sourceDuration: number
) {
  if (!video?.isClip) return Math.max(sourceDuration, 0);
  const clipStart = getClipStartOffset(video);
  const clipEnd = getClipEndPosition(video);
  if (clipEnd === null) return Math.max(video.duration || sourceDuration, 0);
  return Math.max((sourceDuration > 0 ? Math.min(clipEnd, sourceDuration) : clipEnd) - clipStart, 0);
}

export function getRelativePlaybackPosition(
  video: {
    duration: number;
    isClip?: boolean;
    clipStart?: number;
    clipEnd?: number;
  } | null | undefined,
  absolutePosition: number,
  sourceDuration: number
) {
  const clipStart = getClipStartOffset(video);
  const playableDuration = getPlayableDuration(video, sourceDuration);
  return clamp(absolutePosition - clipStart, 0, playableDuration);
}

export function getAbsolutePlaybackPosition(
  video: {
    duration: number;
    isClip?: boolean;
    clipStart?: number;
    clipEnd?: number;
  } | null | undefined,
  relativePosition: number,
  sourceDuration: number
) {
  return (
    getClipStartOffset(video) +
    clamp(relativePosition, 0, getPlayableDuration(video, sourceDuration))
  );
}
