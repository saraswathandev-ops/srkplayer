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
  year?: string;
  genre?: string;
  trackNumber?: string;
  hasEmbeddedArt?: boolean;
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

export type VolumeNormalizationMode = 'standard' | 'quiet' | 'loud' | 'night';

export type VolumeNormalizationSettings = {
  enabled: boolean;
  mode: VolumeNormalizationMode;
  targetLoudness: number; // in dB (e.g. -14 dB LUFS equivalent)
  preampTrim: number; // in dB (-6 to +6 dB trim adjustment)
  applyToVideo: boolean;
};

export type EqualizerSettings = {
  enabled: boolean;
  preset: string;
  preamp: number; // in dB (-12 to +12)
  bands: number[]; // 7 bands in dB (-12 to +12)
};

export type CaptionCue = {
  id: string;
  start: number; // in seconds
  end: number; // in seconds
  textEnglish: string;
  textNative?: string;
  speaker?: string;
};

export type MediaTranscript = {
  mediaId: string;
  title?: string;
  nativeLanguageLabel?: string; // e.g. "Dutch (Nederlands)", "Japanese (日本語)", "Spanish (Español)"
  cues: CaptionCue[];
};

export type LyricLine = {
  id: string;
  time: number; // in seconds
  textEnglish: string;
  textNative?: string;
  textRomanized?: string;
};

export type TrackLyrics = {
  mediaId: string;
  title?: string;
  artist?: string;
  nativeLanguageLabel?: string; // e.g. "Japanese (日本語)", "Korean (한국어)", "Spanish (Español)"
  hasSync: boolean;
  lines: LyricLine[];
};

export type SubtitleSettings = {
  enabled: boolean;
  languageMode: 'english' | 'native' | 'dual';
  fontSize: 'small' | 'medium' | 'large';
  backgroundOpacity: number; // 0 to 1
  textColor: string;
};

export type LyricsSettings = {
  languageMode: 'english' | 'native' | 'dual' | 'romanized';
  fontSize: 'small' | 'medium' | 'large';
  autoScroll: boolean;
};

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
  equalizer: EqualizerSettings;
  volumeNormalization: VolumeNormalizationSettings;
  subtitleSettings: SubtitleSettings;
  lyricsSettings: LyricsSettings;
};

export type LibraryStats = {
  totalVideos: number;
  totalAudio: number;
  totalPlaylists: number;
  totalSize: number;
  totalWatchTime: number;
};
