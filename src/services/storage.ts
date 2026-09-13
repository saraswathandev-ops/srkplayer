import { VideoItem, Playlist, PlayerSettings } from '../types';
import { INITIAL_MEDIA, INITIAL_PLAYLISTS } from '../data/sampleMedia';
import { DEFAULT_SETTINGS } from '../constants/theme';

const STORAGE_KEYS = {
  MEDIA: 'skr_media_v2',
  PLAYLISTS: 'skr_playlists_v2',
  RECYCLE_BIN: 'skr_recycle_bin_v2',
  SETTINGS: 'skr_settings_v2',
};

export function getStoredMedia(): VideoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEDIA);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MEDIA, JSON.stringify(INITIAL_MEDIA));
      return INITIAL_MEDIA;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load media from localStorage', e);
    return INITIAL_MEDIA;
  }
}

export function saveStoredMedia(media: VideoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MEDIA, JSON.stringify(media));
  } catch (e) {
    console.error('Failed to save media', e);
  }
}

export function getStoredPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(INITIAL_PLAYLISTS));
      return INITIAL_PLAYLISTS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load playlists', e);
    return INITIAL_PLAYLISTS;
  }
}

export function saveStoredPlaylists(playlists: Playlist[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  } catch (e) {
    console.error('Failed to save playlists', e);
  }
}

export function getStoredRecycleBin(): VideoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECYCLE_BIN);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load recycle bin', e);
    return [];
  }
}

export function saveStoredRecycleBin(items: VideoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECYCLE_BIN, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save recycle bin', e);
  }
}

export function getStoredSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      equalizer: {
        ...DEFAULT_SETTINGS.equalizer,
        ...(parsed.equalizer || {}),
        bands: Array.isArray(parsed.equalizer?.bands) && parsed.equalizer.bands.length === DEFAULT_SETTINGS.equalizer.bands.length
          ? parsed.equalizer.bands
          : DEFAULT_SETTINGS.equalizer.bands,
      },
      volumeNormalization: {
        ...DEFAULT_SETTINGS.volumeNormalization,
        ...(parsed.volumeNormalization || {}),
      },
      subtitleSettings: {
        ...DEFAULT_SETTINGS.subtitleSettings,
        ...(parsed.subtitleSettings || {}),
      },
      lyricsSettings: {
        ...DEFAULT_SETTINGS.lyricsSettings,
        ...(parsed.lyricsSettings || {}),
      },
    };
  } catch (e) {
    console.error('Failed to load settings', e);
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}
