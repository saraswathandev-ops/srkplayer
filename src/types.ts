export type MediaType = 'video' | 'audio';

export type SortMode = 'name' | 'date' | 'size' | 'duration';
export type ViewMode = 'grid' | 'list';

export type VideoItem = {
  id: string;
  title: string;
  uri: string;
  duration: number; // in seconds
  size: number; // in bytes
  dateAdded: number; // timestamp
  thumbnail?: string;
  isFavorite: boolean;
  lastPosition?: number;
  playCount: number;
  mimeType?: string;
  artist?: string;
  album?: string;
  folder: string;
  watchedAt?: number;
  mediaType: MediaType;
  resolution?: string;
  bitrate?: string;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  mediaIds: string[];
  coverUri?: string;
};

export type FolderItem = {
  id: string;
  name: string;
  count: number;
  mediaType: MediaType;
};

export type ThemePreset =
  | 'violet'
  | 'ocean'
  | 'sunset'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'mint'
  | 'cobalt'
  | 'orchid'
  | 'crimson'
  | 'slate'
  | 'aurora';

export type FontSizeOption = 'small' | 'medium' | 'large';

export type LoopMode = 'none' | 'one' | 'all';

export type PlayerSettings = {
  theme: 'dark' | 'light';
  themePreset: ThemePreset;
  appFontSize: FontSizeOption;
  defaultVolume: number;
  defaultBrightness: number;
  autoPlay: boolean;
  rememberPosition: boolean;
  doubleTapSeek: number; // in seconds, e.g. 10
  loopMode: LoopMode;
  speed: number;
  videoSizeMode: 'contain' | 'cover' | 'fill';
};

export type LibraryStats = {
  totalVideos: number;
  totalAudio: number;
  totalPlaylists: number;
  totalSize: number;
  totalWatchTime: number;
};
