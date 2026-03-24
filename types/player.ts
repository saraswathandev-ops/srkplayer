// Bare React Native types (no expo dependency)
export type ImageSource =
  | string
  | { uri: string; headers?: Record<string, string> }
  | number; // require('./image.png')

export type VideoThumbnailSource = string | ImageSource;

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
  folder?: string;
  watchedAt?: number;
  mediaType: MediaType;
  isClip?: boolean;
  clipStart?: number;
  clipEnd?: number;
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
  updatedAt: number;
};

export type PlayerSettings = {
  theme: "dark" | "light" | "system";
  themePreset: ThemePreset;
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
  swipeVolume: boolean;
  swipeBrightness: boolean;
  swipeSeek: boolean;
  loopMode: "none" | "one" | "all";
  speed: number;
  videoSizeMode: "fit" | "expand" | "stretch";
};

export type PlayerContextType = {
  videos: VideoItem[];
  playlists: Playlist[];
  recentVideos: VideoItem[];
  favorites: VideoItem[];
  settings: PlayerSettings;
  currentVideo: VideoItem | null;
  addVideo: (video: Omit<VideoItem, "id" | "isFavorite" | "playCount">) => Promise<VideoItem>;
  removeVideo: (id: string, mode?: VideoDeleteMode) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  updateLastPosition: (id: string, position: number) => Promise<void>;
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
  reloadVideos: () => Promise<VideoItem[]>;
  getDeletedVideos: () => Promise<VideoItem[]>;
  restoreVideo: (id: string) => Promise<void>;
  emptyRecycleBin: () => Promise<void>;
};

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  theme: "dark",
  themePreset: "violet",
  backgroundArtwork: true,
  settingsMusic: true,
  defaultVolume: 1,
  defaultBrightness: 0.5,
  defaultSubtitles: false,
  subtitleFontSize: "medium",
  autoPlay: true,
  backgroundPlay: false,
  rememberPosition: true,
  doubleTapSeek: 10,
  swipeVolume: true,
  swipeBrightness: true,
  swipeSeek: true,
  loopMode: "none",
  speed: 1,
  videoSizeMode: "fit",
};

export const PLAYER_STORAGE_KEYS = {
  videos: "mx_videos",
  playlists: "mx_playlists",
  settings: "mx_settings",
  sqliteMigrated: "mx_sqlite_migrated_v1",
} as const;
