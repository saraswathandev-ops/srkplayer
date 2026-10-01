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

export type OrientationLockMode = 'auto' | 'landscape' | 'portrait';

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

export type VideoColorPreset =
  | 'natural'
  | 'vivid'
  | 'cinema'
  | 'eye-care'
  | 'sunlight'
  | 'monochrome'
  | 'cool'
  | 'custom';

export type VideoColorSettings = {
  enabled: boolean;
  preset: VideoColorPreset;
  contrast: number; // 0.5 to 2.0 (default 1.0)
  saturation: number; // 0.0 to 2.5 (default 1.0, 0 = B&W)
  hue: number; // -180 to 180 degrees (default 0)
  warmth: number; // 0.0 to 1.0 sepia warmth (default 0)
  invert: boolean; // night negative mode
  sharpness: boolean; // edge contrast pop
};

export type AudioEnhancePreset =
  | 'flat'
  | 'vocal'
  | 'bass'
  | 'theater'
  | 'night'
  | 'music'
  | 'custom';

export type AudioEnhanceSettings = {
  enabled: boolean;
  preset: AudioEnhancePreset;
  volumeBoost: number; // 100 to 200 (100% = normal, 200% = +6dB super boost)
  bassBoost: number; // 0 to 12 dB
  vocalClarity: number; // 0 to 10 dB
  trebleBoost: number; // 0 to 8 dB
  surroundEffect: boolean; // stereo spatial widening
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

export type SwipeAction = 'brightness' | 'volume' | 'seek' | 'none';

export type GestureSettings = {
  enabled: boolean;
  brightnessGesture: boolean;
  volumeGesture: boolean;
  seekGesture: boolean;
  doubleTapSeekSeconds: number;
  showGestureHints: boolean;
  directIncreaseSystem: boolean; // Direct increment system with discrete 15-step Android system levels
  leftVerticalAction: SwipeAction; // Action for left vertical swipe (default 'brightness')
  rightVerticalAction: SwipeAction; // Action for right vertical swipe (default 'volume')
  horizontalSwipeAction: SwipeAction; // Action for horizontal swipe (default 'seek')
  seekSensitivity: number; // Multiplier on scrub distance, default 1.0 (0.25 to 3.0)
  volumeSensitivity: number; // Multiplier on volume change, default 1.0 (0.5 to 2.0)
  brightnessSensitivity: number; // Multiplier on brightness change, default 1.0 (0.5 to 2.0)
  invertVerticalSwipe: boolean; // Invert swipe direction (default false)
  invertHorizontalSwipe: boolean; // Invert seek scrub direction (default false)
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
  gestureSettings: GestureSettings;
  orientationLock?: OrientationLockMode;
  videoColorSettings?: VideoColorSettings;
  audioEnhanceSettings?: AudioEnhanceSettings;
};

export type LibraryStats = {
  totalVideos: number;
  totalAudio: number;
  totalPlaylists: number;
  totalSize: number;
  totalWatchTime: number;
};
