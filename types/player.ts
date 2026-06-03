import { type LibraryStats } from "./libraryStats";

// Bare React Native types (no expo dependency)
export type ImageSource =
  | string
  | { uri: string; headers?: Record<string, string> }
  | number; // require('./image.png')

export type VideoThumbnailSource = string | ImageSource;

export type SortMode = "name" | "date" | "size";
export type SortDirection = "asc" | "desc";
export type MediaType = "video" | "audio";
export type VideoDeleteMode = "temporary" | "permanent";
export const FONT_SIZE_OPTIONS = ["small", "medium", "large"] as const;
export type FontSizeOption = (typeof FONT_SIZE_OPTIONS)[number];
export const FONT_SIZE_LABELS: Record<FontSizeOption, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export function getFontSizeLabel(size: FontSizeOption) {
  return FONT_SIZE_LABELS[size];
}

export const THEME_PRESET_OPTIONS = [
  "custom",
  "violet",
  "ocean",
  "sunset",
  "emerald",
  "rose",
  "amber",
  "mint",
  "cobalt",
  "orchid",
  "crimson",
  "slate",
  "aurora",
] as const;

export type ThemePreset = (typeof THEME_PRESET_OPTIONS)[number];
export const THEME_PRESET_LABELS: Record<ThemePreset, string> = {
  custom: "Custom",
  violet: "Violet",
  ocean: "Ocean",
  sunset: "Sunset",
  emerald: "Emerald",
  rose: "Rose",
  amber: "Amber",
  mint: "Mint",
  cobalt: "Cobalt",
  orchid: "Orchid",
  crimson: "Crimson",
  slate: "Slate",
  aurora: "Aurora",
};

export function getThemePresetLabel(preset: ThemePreset) {
  return THEME_PRESET_LABELS[preset];
}

export type VideoItem = {
  id: string;
  title: string;
  uri: string;
  sourceUri?: string;
  sourceVideoId?: string;
  duration: number;
  size: number;
  dateAdded: number;
  thumbnail?: VideoThumbnailSource;
  thumbnailHash?: string;
  isFavorite: boolean;
  lastPosition?: number;
  playCount: number;
  mimeType?: string;
  artist?: string;
  album?: string;
  folder?: string;
  watchedAt?: number;
  mediaType: MediaType;
  isClip?: boolean;
  clipStart?: number;
  clipEnd?: number;
};

export type PlaybackProgress = {
  videoId: string;
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  lastWatchedAt: number;
  completed: boolean;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  videoCount: number;
  coverUri?: string;
  coverHash?: string;
};

export type FolderItem = {
  id: string;
  name: string;
  coverUri?: string;
  coverHash?: string;
  videoCount: number;
  unwatchedCount: number;
  updatedAt: number;
  isPrivate: boolean;
};

export type PlayerSettings = {
  theme: "system"|"dark" | "light" ;
  themePreset: ThemePreset;
  customThemePrimary: string;
  customThemeAccent: string;
  appFontSize: FontSizeOption;
  backgroundArtwork: boolean;
  settingsMusic: boolean;
  defaultVolume: number;
  defaultBrightness: number;
  defaultSubtitles: boolean;
  subtitleFontSize: FontSizeOption;
  autoPlay: boolean;
  backgroundPlay: boolean;
  rememberPosition: boolean;
  doubleTapSeek: number;
  enableDoubleTapSeek: boolean;
  swipeVolume: boolean;
  swipeBrightness: boolean;
  swipeSeek: boolean;
  enablePinchZoom: boolean;
  enableLongPressSpeed: boolean;
  enableScreenshotPreview: boolean;
  enableVolumeBoost: boolean;
  enableNightMode: boolean;
  defaultNightMode: boolean;
  enableOrientationControl: boolean;
  defaultOrientationLock: "default" | "portrait" | "landscape";
  enableSleepTimer: boolean;
  enableDiscoveryHints: boolean;
  enableTrim: boolean;
  enableAudioTrackSwitcher: boolean;
  enableSubtitleSwitcher: boolean;
  subtitleLiveGeneration: boolean;
  subtitleLivePreview: boolean;
  subtitleShowLowConfidence: boolean;
  subtitleSyncStepMs: number;
  enableDecoderSwitcher: boolean;
  enableAspectRatioSwitcher: boolean;
  enableQuickActions: boolean;
  enableLockControl: boolean;
  enableUpNextAutoplay: boolean;
  /** Player quick-action control keys in user-chosen display order. */
  quickActionOrder: string[];
  /** Player quick-action control keys the user has hidden from the footer. */
  hiddenQuickActions: string[];
  loopMode: "none" | "one" | "all";
  speed: number;
  videoSizeMode: "fit" | "expand" | "stretch";
  tabBarLabels: "always" | "active" | "never";
};

/** Canonical natural order of player quick-action control keys. Used as the
 *  default for `PlayerSettings.quickActionOrder` and by the layout editor to
 *  enumerate every customizable control. Keys must match those built in
 *  `components/VideoPlayerControls.tsx` (`mxQuickItems`). */
export const QUICK_ACTION_KEYS = [
  "speed",
  "screenshot",
  "loop",
  "mute",
  "night",
  "orientation",
  "aspect",
  "boost",
  "audio",
  "subtitles",
  "decoder",
  "trim",
  "zoom",
  "background",
  "info",
  "timer",
  "restart",
  "stream",
] as const;

/** Human-readable labels for the quick-action layout editor. */
export const QUICK_ACTION_LABELS: Record<string, string> = {
  speed: "Playback speed",
  screenshot: "Screenshot",
  loop: "Loop",
  mute: "Mute",
  night: "Night mode",
  orientation: "Orientation",
  aspect: "Aspect ratio",
  boost: "Volume boost",
  audio: "Audio track",
  subtitles: "Subtitles",
  decoder: "Decoder",
  trim: "Trim",
  zoom: "Zoom",
  background: "Background play",
  info: "Info",
  timer: "Sleep timer",
  restart: "Start over",
  stream: "Network stream",
};

export type PlayerContextType = {
  videos: VideoItem[];
  playlists: Playlist[];
  continueWatchingVideos: VideoItem[];
  recentVideos: VideoItem[];
  favorites: VideoItem[];
  settings: PlayerSettings;
  currentVideo: VideoItem | null;
  addVideo: (video: Omit<VideoItem, "id" | "isFavorite" | "playCount">) => Promise<VideoItem>;
  removeVideo: (id: string, mode?: VideoDeleteMode) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  updateLastPosition: (id: string, position: number, duration?: number) => Promise<void>;
  updateMediaDuration: (id: string, duration: number) => Promise<void>;
  saveTrimmedClip: (options: {
    video: VideoItem;
    clipStart: number;
    clipEnd: number;
    title?: string;
  }) => Promise<VideoItem>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (playlistId: string, videoId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, videoId: string) => Promise<void>;
  setCurrentVideo: (video: VideoItem | null) => void;
  updateSettings: (settings: Partial<PlayerSettings>) => Promise<void>;
  searchVideos: (query: string) => VideoItem[];
  incrementPlayCount: (id: string) => Promise<void>;
  clearOldHistory: (
    days?: number
  ) => Promise<{ clearedHistoryCount: number; completedAt: number }>;
  syncVideos: (
    videos: Omit<VideoItem, "id" | "isFavorite" | "playCount">[],
    options?: { refresh?: boolean; syncFolders?: boolean }
  ) => Promise<{ added: number; total: number }>;
  stats: LibraryStats | null;
  videoCount: number;
  fetchVideosPage: (options: {
    limit: number;
    offset: number;
    mediaType?: MediaType;
    query?: string;
    sortMode?: SortMode;
    sortDirection?: SortDirection;
    favoritesOnly?: boolean;
    unwatchedOnly?: boolean;
  }) => Promise<VideoItem[]>;
  fetchRecentVideos: (limit?: number, offset?: number, mediaType?: MediaType) => Promise<VideoItem[]>;
  fetchContinueWatching: (limit?: number, offset?: number) => Promise<VideoItem[]>;
  fetchFavorites: (limit?: number, offset?: number, mediaType?: MediaType) => Promise<VideoItem[]>;
  fetchMostPlayed: (limit?: number, offset?: number, mediaType?: MediaType) => Promise<VideoItem[]>;
  fetchVideoById: (id: string) => Promise<VideoItem | null>;
  getPlaybackProgress: (videoId: string) => Promise<PlaybackProgress | null>;
  clearPlaybackProgress: (videoId: string) => Promise<void>;
  reloadVideos: () => Promise<void>;
  getDeletedVideos: () => Promise<VideoItem[]>;
  restoreVideo: (id: string) => Promise<void>;
  restoreVideos: (ids: string[]) => Promise<void>;
  emptyRecycleBin: () => Promise<void>;
  removeVideos: (ids: string[], mode?: VideoDeleteMode) => Promise<void>;
  addVideosToPlaylist: (playlistId: string, videoIds: string[]) => Promise<void>;
  clearMediaLibrary: () => Promise<void>;
  toggleFolderPrivacy: (folderId: string) => Promise<void>;
};

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  theme: "system",
  themePreset: "violet",
  customThemePrimary: "#6E60FF",
  customThemeAccent: "#FF5B78",
  appFontSize: "medium",
  backgroundArtwork: true,
  settingsMusic: true,
  defaultVolume: 1,
  defaultBrightness: 0.5,
  defaultSubtitles: false,
  subtitleFontSize: "medium",
  autoPlay: true,
  backgroundPlay: true,
  rememberPosition: true,
  doubleTapSeek: 10,
  enableDoubleTapSeek: true,
  swipeVolume: true,
  swipeBrightness: true,
  swipeSeek: true,
  enablePinchZoom: true,
  enableLongPressSpeed: true,
  enableScreenshotPreview: true,
  enableVolumeBoost: true,
  enableNightMode: true,
  defaultNightMode: false,
  enableOrientationControl: true,
  defaultOrientationLock: "default",
  enableSleepTimer: true,
  enableDiscoveryHints: true,
  enableTrim: true,
  enableAudioTrackSwitcher: true,
  enableSubtitleSwitcher: true,
  subtitleLiveGeneration: true,
  subtitleLivePreview: true,
  subtitleShowLowConfidence: false,
  subtitleSyncStepMs: 250,
  enableDecoderSwitcher: true,
  enableAspectRatioSwitcher: true,
  enableQuickActions: true,
  enableLockControl: true,
  enableUpNextAutoplay: true,
  quickActionOrder: [...QUICK_ACTION_KEYS],
  hiddenQuickActions: [],
  loopMode: "none",
  speed: 1,
  videoSizeMode: "stretch",
  tabBarLabels: "active",
};

export const PLAYER_STORAGE_KEYS = {
  videos: "mx_videos",
  playlists: "mx_playlists",
  settings: "mx_settings",
  sqliteMigrated: "mx_sqlite_migrated_v1",
} as const;
