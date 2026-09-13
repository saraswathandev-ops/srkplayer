import { ThemePreset } from '../types';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  accent: string;
  bgLight: string;
  cardLight: string;
  borderLight: string;
  bgDark: string;
  cardDark: string;
  borderDark: string;
}

export const THEME_PRESETS: Record<ThemePreset, ThemeColors> = {
  violet: {
    primary: '#6E60FF',
    primaryDark: '#5647E8',
    accent: '#FF5B78',
    bgLight: '#F5F3FF',
    cardLight: '#FFFFFF',
    borderLight: '#DDD7FF',
    bgDark: '#090A12',
    cardDark: '#131522',
    borderDark: '#23273D',
  },
  ocean: {
    primary: '#1E88E5',
    primaryDark: '#1565C0',
    accent: '#00B8A9',
    bgLight: '#EEF7FF',
    cardLight: '#FFFFFF',
    borderLight: '#CBE2F8',
    bgDark: '#07131D',
    cardDark: '#0D1E2D',
    borderDark: '#1B354D',
  },
  sunset: {
    primary: '#F46B45',
    primaryDark: '#DD5A36',
    accent: '#FFB347',
    bgLight: '#FFF4ED',
    cardLight: '#FFFFFF',
    borderLight: '#F2D6C7',
    bgDark: '#150B08',
    cardDark: '#221410',
    borderDark: '#3E241E',
  },
  emerald: {
    primary: '#159A6A',
    primaryDark: '#117A54',
    accent: '#5FE0A8',
    bgLight: '#ECFCF5',
    cardLight: '#FFFFFF',
    borderLight: '#C6EEDC',
    bgDark: '#071711',
    cardDark: '#0E241C',
    borderDark: '#1C4234',
  },
  rose: {
    primary: '#E34A82',
    primaryDark: '#C8376B',
    accent: '#FF9CC2',
    bgLight: '#FFF1F6',
    cardLight: '#FFFFFF',
    borderLight: '#F6CADB',
    bgDark: '#180A12',
    cardDark: '#26121D',
    borderDark: '#442235',
  },
  amber: {
    primary: '#D8891C',
    primaryDark: '#B26D14',
    accent: '#FFCA5C',
    bgLight: '#FFF8E8',
    cardLight: '#FFFFFF',
    borderLight: '#F1DBA6',
    bgDark: '#171105',
    cardDark: '#251C0A',
    borderDark: '#423314',
  },
  mint: {
    primary: '#12B89A',
    primaryDark: '#0D957D',
    accent: '#72E9D4',
    bgLight: '#EDFFFB',
    cardLight: '#FFFFFF',
    borderLight: '#BFECE2',
    bgDark: '#061714',
    cardDark: '#0E2621',
    borderDark: '#1C453C',
  },
  cobalt: {
    primary: '#345CFF',
    primaryDark: '#2647D1',
    accent: '#7AA2FF',
    bgLight: '#EEF2FF',
    cardLight: '#FFFFFF',
    borderLight: '#CAD6FF',
    bgDark: '#081022',
    cardDark: '#111B36',
    borderDark: '#213361',
  },
  orchid: {
    primary: '#9A4DFF',
    primaryDark: '#7D37D8',
    accent: '#FF8BCE',
    bgLight: '#F8F0FF',
    cardLight: '#FFFFFF',
    borderLight: '#DEC6F8',
    bgDark: '#130920',
    cardDark: '#1F1133',
    borderDark: '#39215B',
  },
  crimson: {
    primary: '#D63852',
    primaryDark: '#B92940',
    accent: '#FF8A88',
    bgLight: '#FFF1F3',
    cardLight: '#FFFFFF',
    borderLight: '#F5C3CB',
    bgDark: '#19080C',
    cardDark: '#280F16',
    borderDark: '#461D27',
  },
  slate: {
    primary: '#596A80',
    primaryDark: '#445367',
    accent: '#95A9C2',
    bgLight: '#F3F6FA',
    cardLight: '#FFFFFF',
    borderLight: '#D0D8E1',
    bgDark: '#0B0F14',
    cardDark: '#141C25',
    borderDark: '#243242',
  },
  aurora: {
    primary: '#5BC96B',
    primaryDark: '#43A454',
    accent: '#1ED2C1',
    bgLight: '#F2FFF2',
    cardLight: '#FFFFFF',
    borderLight: '#C7ECCB',
    bgDark: '#08160B',
    cardDark: '#102414',
    borderDark: '#204126',
  },
};

export const EQUALIZER_FREQUENCIES = [60, 170, 450, 1000, 3000, 7000, 15000];
export const EQUALIZER_LABELS = ['60 Hz', '170 Hz', '450 Hz', '1 kHz', '3 kHz', '7 kHz', '15 kHz'];
export const EQUALIZER_DESCRIPTIONS = [
  'Sub-Bass',
  'Bass',
  'Low Mid',
  'Mid',
  'Upper Mid',
  'Presence',
  'Treble',
];

export const EQUALIZER_PRESETS: Record<string, { name: string; bands: number[] }> = {
  flat: { name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0] },
  bass_boost: { name: 'Bass Boost', bands: [7, 6, 4, 1, 0, 0, 0] },
  treble_boost: { name: 'Treble Boost', bands: [0, 0, 0, 1, 3, 6, 8] },
  vocal: { name: 'Vocal / Podcast', bands: [-2, -1, 3, 6, 5, 2, -1] },
  rock: { name: 'Rock', bands: [5, 3, -1, 0, 2, 5, 6] },
  electronic: { name: 'Electronic', bands: [7, 5, 1, -1, 3, 5, 6] },
  pop: { name: 'Pop', bands: [-1, 2, 4, 5, 3, 1, -1] },
  jazz: { name: 'Jazz', bands: [4, 3, 1, 2, -1, 2, 4] },
  classical: { name: 'Classical', bands: [5, 3, -1, -1, 0, 3, 4] },
  acoustic: { name: 'Acoustic', bands: [3, 2, 1, 2, 3, 3, 2] },
  night: { name: 'Night Mode', bands: [3, 2, 0, 0, -2, -4, -5] },
};

export const VOLUME_NORMALIZATION_MODES = {
  standard: {
    id: 'standard',
    name: 'Standard Music',
    targetLabel: '-14 LUFS',
    target: -14,
    description: 'Balanced for modern streaming standards (-14 LUFS). Smooths inconsistent mastering between quiet acoustic and loud modern recordings.',
    threshold: -20,
    knee: 18,
    ratio: 4.0,
    attack: 0.005,
    release: 0.25,
    makeupGainDb: 1.8,
  },
  quiet: {
    id: 'quiet',
    name: 'Quiet & Relaxed',
    targetLabel: '-18 LUFS',
    target: -18,
    description: 'Gentler volume level (-18 LUFS). Ideal for bedtime listening, acoustic instruments, and reducing ear fatigue over long sessions.',
    threshold: -24,
    knee: 24,
    ratio: 2.5,
    attack: 0.01,
    release: 0.35,
    makeupGainDb: -1.2,
  },
  loud: {
    id: 'loud',
    name: 'Loud & Punchy',
    targetLabel: '-11 LUFS',
    target: -11,
    description: 'Higher output target (-11 LUFS). Maximizes presence and punch, great for noisy outdoor, gym, or car environments.',
    threshold: -15,
    knee: 12,
    ratio: 5.5,
    attack: 0.003,
    release: 0.18,
    makeupGainDb: 3.2,
  },
  night: {
    id: 'night',
    name: 'Night Mode',
    targetLabel: 'Dynamic Clamp',
    target: -16,
    description: 'High dynamic range compression. Suppresses sudden ear-piercing peaks while boosting quiet whispers so you never need to adjust the volume knob.',
    threshold: -28,
    knee: 30,
    ratio: 8.0,
    attack: 0.002,
    release: 0.15,
    makeupGainDb: 4.2,
  },
} as const;

export const DEFAULT_VOLUME_NORMALIZATION = {
  enabled: true,
  mode: 'standard' as const,
  targetLoudness: -14,
  preampTrim: 0,
  applyToVideo: false,
};

export const DEFAULT_SUBTITLE_SETTINGS = {
  enabled: true,
  languageMode: 'dual' as const, // English + Native by default!
  fontSize: 'medium' as const,
  backgroundOpacity: 0.75,
  textColor: '#FFFFFF',
};

export const DEFAULT_LYRICS_SETTINGS = {
  languageMode: 'dual' as const, // English + Native by default!
  fontSize: 'medium' as const,
  autoScroll: true,
};

export const DEFAULT_SETTINGS = {
  theme: 'dark' as const,
  themePreset: 'violet' as ThemePreset,
  appFontSize: 'medium' as const,
  defaultVolume: 0.9,
  defaultBrightness: 1.0,
  autoPlay: true,
  rememberPosition: true,
  doubleTapSeek: 10,
  loopMode: 'none' as const,
  speed: 1,
  videoSizeMode: 'contain' as const,
  equalizer: {
    enabled: true,
    preset: 'flat',
    preamp: 0,
    bands: [0, 0, 0, 0, 0, 0, 0],
  },
  volumeNormalization: DEFAULT_VOLUME_NORMALIZATION,
  subtitleSettings: DEFAULT_SUBTITLE_SETTINGS,
  lyricsSettings: DEFAULT_LYRICS_SETTINGS,
};
