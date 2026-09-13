import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  VideoItem,
  Playlist,
  PlayerSettings,
  LoopMode,
  LibraryStats,
  VolumeNormalizationMode,
  VolumeNormalizationSettings,
} from '../types';
import {
  getStoredMedia,
  saveStoredMedia,
  getStoredPlaylists,
  saveStoredPlaylists,
  getStoredRecycleBin,
  saveStoredRecycleBin,
  getStoredSettings,
  saveStoredSettings,
} from '../services/storage';
import {
  THEME_PRESETS,
  EQUALIZER_PRESETS,
  VOLUME_NORMALIZATION_MODES,
} from '../constants/theme';
import { audioEqualizer } from '../services/audioEqualizer';

interface PlayerContextType {
  mediaList: VideoItem[];
  playlists: Playlist[];
  recycleBin: VideoItem[];
  settings: PlayerSettings;
  activeMedia: VideoItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  brightness: number;
  playbackRate: number;
  aspectRatio: 'contain' | 'cover' | 'fill';
  loopMode: LoopMode;
  queue: VideoItem[];
  queueIndex: number;
  isVideoModalOpen: boolean;
  isAudioModalOpen: boolean;
  themeColors: typeof THEME_PRESETS['violet'];
  stats: LibraryStats;
  audioRef: React.RefObject<HTMLAudioElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  playMedia: (item: VideoItem, queueList?: VideoItem[], openModal?: boolean) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setBrightness: (b: number) => void;
  setPlaybackRate: (rate: number) => void;
  setAspectRatio: (mode: 'contain' | 'cover' | 'fill') => void;
  setLoopMode: (mode: LoopMode) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleFavorite: (id: string) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, mediaId: string) => void;
  removeFromPlaylist: (playlistId: string, mediaId: string) => void;
  deleteMedia: (id: string, permanent?: boolean) => void;
  restoreMedia: (id: string) => void;
  emptyRecycleBin: () => void;
  addCustomMedia: (item: Omit<VideoItem, 'id' | 'playCount' | 'isFavorite' | 'dateAdded'>) => VideoItem;
  updateMediaMetadata: (id: string, metadata: Partial<VideoItem>) => void;
  playNext: (item: VideoItem) => void;
  playNextMultiple: (items: VideoItem[], title?: string) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  clearUpcomingQueue: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  clearToast: () => void;
  updateSettings: (partial: Partial<PlayerSettings>) => void;
  setEqualizerBand: (index: number, gain: number) => void;
  setEqualizerPreset: (presetKey: string) => void;
  setEqualizerEnabled: (enabled: boolean) => void;
  setEqualizerPreamp: (preamp: number) => void;
  resetEqualizer: () => void;
  toggleVolumeNormalization: () => void;
  setVolumeNormalizationMode: (mode: VolumeNormalizationMode) => void;
  updateVolumeNormalization: (partial: Partial<VolumeNormalizationSettings>) => void;
  sleepTimerRemaining: number | null;
  sleepTimerInitialSeconds: number | null;
  sleepTimerEndTrack: boolean;
  setSleepTimer: (minutes: number | null) => void;
  setSleepTimerAtTrackEnd: () => void;
  extendSleepTimer: (additionalMinutes: number) => void;
  cancelSleepTimer: () => void;
  openVideoModal: () => void;
  closeVideoModal: () => void;
  openAudioModal: () => void;
  closeAudioModal: () => void;
  onTimeUpdate: (current: number, total: number) => void;
  onEnded: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [mediaList, setMediaList] = useState<VideoItem[]>(getStoredMedia);
  const [playlists, setPlaylists] = useState<Playlist[]>(getStoredPlaylists);
  const [recycleBin, setRecycleBin] = useState<VideoItem[]>(getStoredRecycleBin);
  const [settings, setSettings] = useState<PlayerSettings>(getStoredSettings);

  const [activeMedia, setActiveMedia] = useState<VideoItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(settings.defaultVolume);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [brightness, setBrightnessState] = useState<number>(settings.defaultBrightness);
  const [playbackRate, setPlaybackRateState] = useState<number>(1);
  const [aspectRatio, setAspectRatioState] = useState<'contain' | 'cover' | 'fill'>(settings.videoSizeMode);
  const [loopMode, setLoopModeState] = useState<LoopMode>(settings.loopMode);

  const [queue, setQueue] = useState<VideoItem[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);

  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);

  // Sleep timer state
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [sleepTimerInitialSeconds, setSleepTimerInitialSeconds] = useState<number | null>(null);
  const [sleepTimerEndTrack, setSleepTimerEndTrack] = useState<boolean>(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sleep timer interval countdown
  useEffect(() => {
    if (sleepTimerRemaining === null || sleepTimerRemaining <= 0) return;
    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          // Pause playback on expiration
          if (audioRef.current) audioRef.current.pause();
          if (videoRef.current) videoRef.current.pause();
          setIsPlaying(false);
          setSleepTimerInitialSeconds(null);
          setSleepTimerEndTrack(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemaining]);

  // Synchronize CSS custom property for primary theme color
  useEffect(() => {
    const preset = THEME_PRESETS[settings.themePreset] || THEME_PRESETS.violet;
    document.documentElement.style.setProperty('--theme-primary', preset.primary);
    document.documentElement.style.setProperty('--theme-accent', preset.accent);
  }, [settings.themePreset]);

  // Synchronize equalizer filters with Web Audio API
  useEffect(() => {
    if (settings.equalizer) {
      audioEqualizer.applySettings(settings.equalizer);
    }
  }, [settings.equalizer]);

  // Synchronize volume normalization with Web Audio API
  useEffect(() => {
    if (settings.volumeNormalization) {
      audioEqualizer.applyNormalizationSettings(settings.volumeNormalization);
    }
  }, [settings.volumeNormalization]);

  // Try to attach media elements to equalizer and normalization chain
  useEffect(() => {
    if (audioRef.current) {
      audioEqualizer.attachMediaElement(audioRef.current);
    }
  }, [audioRef.current]);

  useEffect(() => {
    if (videoRef.current && settings.volumeNormalization?.applyToVideo) {
      audioEqualizer.attachMediaElement(videoRef.current);
    }
  }, [videoRef.current, settings.volumeNormalization?.applyToVideo]);

  // Persist state changes
  useEffect(() => {
    saveStoredMedia(mediaList);
  }, [mediaList]);

  useEffect(() => {
    saveStoredPlaylists(playlists);
  }, [playlists]);

  useEffect(() => {
    saveStoredRecycleBin(recycleBin);
  }, [recycleBin]);

  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  const themeColors = useMemo(() => {
    return THEME_PRESETS[settings.themePreset] || THEME_PRESETS.violet;
  }, [settings.themePreset]);

  const stats = useMemo<LibraryStats>(() => {
    const totalVideos = mediaList.filter((m) => m.mediaType === 'video').length;
    const totalAudio = mediaList.filter((m) => m.mediaType === 'audio').length;
    const totalSize = mediaList.reduce((acc, m) => acc + (m.size || 0), 0);
    const totalWatchTime = mediaList.reduce((acc, m) => acc + (m.duration * (m.playCount || 1)), 0);
    return {
      totalVideos,
      totalAudio,
      totalPlaylists: playlists.length,
      totalSize,
      totalWatchTime,
    };
  }, [mediaList, playlists]);

  const playMedia = (item: VideoItem, queueList?: VideoItem[], openModal = true) => {
    const currentQueue = queueList || (item.mediaType === 'video'
      ? mediaList.filter((m) => m.mediaType === 'video')
      : mediaList.filter((m) => m.mediaType === 'audio'));

    setQueue(currentQueue);
    const index = currentQueue.findIndex((m) => m.id === item.id);
    setQueueIndex(index !== -1 ? index : 0);

    setActiveMedia(item);
    setIsPlaying(true);

    const initialPos = settings.rememberPosition && item.lastPosition ? item.lastPosition : 0;
    setCurrentTime(initialPos);
    setDuration(item.duration || 0);

    // Update play count and last watched
    setMediaList((prev) =>
      prev.map((m) => {
        if (m.id === item.id) {
          return {
            ...m,
            playCount: (m.playCount || 0) + 1,
            watchedAt: Date.now(),
          };
        }
        return m;
      })
    );

    if (openModal) {
      if (item.mediaType === 'video') {
        setIsVideoModalOpen(true);
        setIsAudioModalOpen(false);
      } else {
        setIsAudioModalOpen(true);
        setIsVideoModalOpen(false);
      }
    }
  };

  const togglePlay = () => {
    if (!activeMedia) return;
    const targetElement = activeMedia.mediaType === 'video' ? videoRef.current : audioRef.current;
    if (isPlaying) {
      targetElement?.pause();
      setIsPlaying(false);
    } else {
      targetElement?.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const pause = () => {
    const targetElement = activeMedia?.mediaType === 'video' ? videoRef.current : audioRef.current;
    targetElement?.pause();
    setIsPlaying(false);
  };

  const resume = () => {
    const targetElement = activeMedia?.mediaType === 'video' ? videoRef.current : audioRef.current;
    targetElement?.play().catch(console.error);
    setIsPlaying(true);
  };

  const seek = (seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, duration || 999999));
    const targetElement = activeMedia?.mediaType === 'video' ? videoRef.current : audioRef.current;
    if (targetElement) {
      targetElement.currentTime = clamped;
    }
    setCurrentTime(clamped);

    // Save position to item
    if (activeMedia) {
      setMediaList((prev) =>
        prev.map((m) => (m.id === activeMedia.id ? { ...m, lastPosition: clamped } : m))
      );
    }
  };

  const setVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) setIsMuted(false);
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : clamped;
    if (videoRef.current) videoRef.current.volume = isMuted ? 0 : clamped;
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioRef.current) audioRef.current.volume = nextMute ? 0 : volume;
    if (videoRef.current) videoRef.current.volume = nextMute ? 0 : volume;
  };

  const setBrightness = (b: number) => {
    setBrightnessState(Math.max(0.3, Math.min(1.8, b)));
  };

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const setAspectRatio = (mode: 'contain' | 'cover' | 'fill') => {
    setAspectRatioState(mode);
  };

  const setLoopMode = (mode: LoopMode) => {
    setLoopModeState(mode);
  };

  const nextTrack = () => {
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (loopMode === 'all') {
        nextIdx = 0;
      } else {
        return;
      }
    }
    const nextItem = queue[nextIdx];
    if (nextItem) {
      playMedia(nextItem, queue, nextItem.mediaType === 'video');
    }
  };

  const previousTrack = () => {
    if (queue.length === 0) return;
    if (currentTime > 4) {
      seek(0);
      return;
    }
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      if (loopMode === 'all') {
        prevIdx = queue.length - 1;
      } else {
        seek(0);
        return;
      }
    }
    const prevItem = queue[prevIdx];
    if (prevItem) {
      playMedia(prevItem, queue, prevItem.mediaType === 'video');
    }
  };

  const onTimeUpdate = (current: number, total: number) => {
    setCurrentTime(current);
    if (total && !isNaN(total)) {
      setDuration(total);
    }
  };

  const onEnded = () => {
    if (sleepTimerEndTrack) {
      if (audioRef.current) audioRef.current.pause();
      if (videoRef.current) videoRef.current.pause();
      setIsPlaying(false);
      setSleepTimerEndTrack(false);
      setSleepTimerRemaining(null);
      setSleepTimerInitialSeconds(null);
      return;
    }
    if (loopMode === 'one') {
      seek(0);
      resume();
      return;
    }
    if (queueIndex < queue.length - 1 || loopMode === 'all') {
      nextTrack();
    } else {
      setIsPlaying(false);
    }
  };

  const toggleFavorite = (id: string) => {
    setMediaList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isFavorite: !m.isFavorite } : m))
    );
  };

  const createPlaylist = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      name: trimmed,
      createdAt: Date.now(),
      mediaIds: [],
      coverUri: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
  };

  const deletePlaylist = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  };

  const addToPlaylist = (playlistId: string, mediaId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id === playlistId && !p.mediaIds.includes(mediaId)) {
          return { ...p, mediaIds: [...p.mediaIds, mediaId] };
        }
        return p;
      })
    );
  };

  const removeFromPlaylist = (playlistId: string, mediaId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id === playlistId) {
          return { ...p, mediaIds: p.mediaIds.filter((id) => id !== mediaId) };
        }
        return p;
      })
    );
  };

  const deleteMedia = (id: string, permanent = false) => {
    const target = mediaList.find((m) => m.id === id);
    if (!target) return;

    if (activeMedia?.id === id) {
      pause();
      setActiveMedia(null);
      setIsVideoModalOpen(false);
      setIsAudioModalOpen(false);
    }

    setMediaList((prev) => prev.filter((m) => m.id !== id));

    if (!permanent) {
      setRecycleBin((prev) => [target, ...prev.filter((m) => m.id !== id)]);
    }

    // Remove from playlists
    setPlaylists((prev) =>
      prev.map((p) => ({
        ...p,
        mediaIds: p.mediaIds.filter((mid) => mid !== id),
      }))
    );
  };

  const restoreMedia = (id: string) => {
    const target = recycleBin.find((m) => m.id === id);
    if (!target) return;
    setRecycleBin((prev) => prev.filter((m) => m.id !== id));
    setMediaList((prev) => [target, ...prev]);
  };

  const emptyRecycleBin = () => {
    setRecycleBin([]);
  };

  const addCustomMedia = (
    item: Omit<VideoItem, 'id' | 'playCount' | 'isFavorite' | 'dateAdded'>
  ): VideoItem => {
    const newItem: VideoItem = {
      ...item,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      playCount: 0,
      isFavorite: false,
      dateAdded: Date.now(),
    };
    setMediaList((prev) => [newItem, ...prev]);
    return newItem;
  };

  const updateMediaMetadata = (id: string, metadata: Partial<VideoItem>) => {
    setMediaList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...metadata } : item))
    );
    setActiveMedia((prev) => (prev && prev.id === id ? { ...prev, ...metadata } : prev));
  };

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const clearToast = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(null);
  };

  const playNext = (item: VideoItem) => {
    if (!activeMedia) {
      playMedia(item, [item], false);
      showToast(`Playing "${item.title}"`);
      return;
    }

    setQueue((prevQueue) => {
      const curIdx = prevQueue.findIndex((m) => m.id === activeMedia.id);
      const safeCurrentIndex = curIdx !== -1 ? curIdx : (queueIndex >= 0 ? queueIndex : 0);

      // If already the exact item playing
      if (prevQueue[safeCurrentIndex]?.id === item.id) {
        showToast(`"${item.title}" is already playing`);
        return prevQueue;
      }

      // Check if it is already the immediate next track
      if (prevQueue[safeCurrentIndex + 1]?.id === item.id) {
        showToast(`"${item.title}" is already set to play next`);
        return prevQueue;
      }

      // If item is elsewhere in queue, remove it so it gets moved up cleanly
      const existingIdx = prevQueue.findIndex((m) => m.id === item.id);
      let workingQueue = [...prevQueue];
      let newCurrentIndex = safeCurrentIndex;

      if (existingIdx !== -1) {
        workingQueue.splice(existingIdx, 1);
        if (existingIdx < safeCurrentIndex) {
          newCurrentIndex--;
        }
      }

      // Insert immediately after current track
      const insertAt = newCurrentIndex + 1;
      workingQueue.splice(insertAt, 0, item);

      setQueueIndex(newCurrentIndex);
      return workingQueue;
    });

    showToast(`"${item.title}" queued to play next`);
  };

  const playNextMultiple = (items: VideoItem[], title?: string) => {
    if (!items || items.length === 0) return;

    if (!activeMedia) {
      playMedia(items[0], items, false);
      showToast(title ? `Playing playlist "${title}"` : `Playing ${items.length} tracks`);
      return;
    }

    setQueue((prevQueue) => {
      const curIdx = prevQueue.findIndex((m) => m.id === activeMedia.id);
      const safeCurrentIndex = curIdx !== -1 ? curIdx : (queueIndex >= 0 ? queueIndex : 0);

      // Filter out items that are the currently playing media
      const toInsert = items.filter((it) => it.id !== activeMedia.id);
      if (toInsert.length === 0) {
        showToast(title ? `"${title}" is already active` : 'Tracks already in queue');
        return prevQueue;
      }

      // Remove any occurrences of toInsert items from prevQueue to avoid duplicate entries
      const insertIds = new Set(toInsert.map((t) => t.id));
      const filtered = prevQueue.filter((m, idx) => idx === safeCurrentIndex || !insertIds.has(m.id));

      const newCurrentIndex = filtered.findIndex((m) => m.id === activeMedia.id);
      const insertAt = (newCurrentIndex !== -1 ? newCurrentIndex : safeCurrentIndex) + 1;

      const workingQueue = [...filtered];
      workingQueue.splice(insertAt, 0, ...toInsert);

      setQueueIndex(newCurrentIndex !== -1 ? newCurrentIndex : safeCurrentIndex);
      return workingQueue;
    });

    showToast(
      title
        ? `Queued "${title}" (${items.length} tracks) to play next`
        : `Queued ${items.length} tracks to play next`
    );
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const removedItem = prev[index];
      const newQueue = prev.filter((_, i) => i !== index);
      if (index < queueIndex) {
        setQueueIndex((curr) => Math.max(0, curr - 1));
      }
      showToast(`Removed "${removedItem.title}" from queue`);
      return newQueue;
    });
  };

  const moveQueueItem = (fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const newQueue = [...prev];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);

      if (activeMedia) {
        const newCur = newQueue.findIndex((m) => m.id === activeMedia.id);
        if (newCur !== -1) setQueueIndex(newCur);
      }
      return newQueue;
    });
  };

  const clearUpcomingQueue = () => {
    setQueue((prev) => {
      if (prev.length <= 1) return prev;
      const curIdx = prev.findIndex((m) => m.id === activeMedia?.id);
      const safeIdx = curIdx !== -1 ? curIdx : queueIndex;
      const newQueue = prev.slice(0, safeIdx + 1);
      showToast('Cleared upcoming tracks');
      return newQueue;
    });
  };

  const updateSettings = (partial: Partial<PlayerSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const setEqualizerBand = (index: number, gain: number) => {
    setSettings((prev) => {
      const newBands = [...prev.equalizer.bands];
      newBands[index] = gain;
      return {
        ...prev,
        equalizer: {
          ...prev.equalizer,
          preset: 'custom',
          bands: newBands,
        },
      };
    });
  };

  const setEqualizerPreset = (presetKey: string) => {
    const preset = EQUALIZER_PRESETS[presetKey];
    if (!preset) return;
    setSettings((prev) => ({
      ...prev,
      equalizer: {
        ...prev.equalizer,
        preset: presetKey,
        bands: [...preset.bands],
      },
    }));
  };

  const setEqualizerEnabled = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      equalizer: {
        ...prev.equalizer,
        enabled,
      },
    }));
  };

  const setEqualizerPreamp = (preamp: number) => {
    setSettings((prev) => ({
      ...prev,
      equalizer: {
        ...prev.equalizer,
        preamp,
      },
    }));
  };

  const resetEqualizer = () => {
    setSettings((prev) => ({
      ...prev,
      equalizer: {
        enabled: true,
        preset: 'flat',
        preamp: 0,
        bands: [0, 0, 0, 0, 0, 0, 0],
      },
    }));
  };

  const toggleVolumeNormalization = () => {
    setSettings((prev) => {
      const currentNorm = prev.volumeNormalization || {
        enabled: false,
        mode: 'standard',
        targetLoudness: -14,
        preampTrim: 0,
        applyToVideo: false,
      };
      const nextEnabled = !currentNorm.enabled;
      const modeName = VOLUME_NORMALIZATION_MODES[currentNorm.mode]?.name || 'Standard';
      showToast(
        nextEnabled
          ? `Volume Normalization enabled (${modeName})`
          : 'Volume Normalization disabled'
      );
      return {
        ...prev,
        volumeNormalization: {
          ...currentNorm,
          enabled: nextEnabled,
        },
      };
    });
  };

  const setVolumeNormalizationMode = (mode: VolumeNormalizationMode) => {
    setSettings((prev) => {
      const currentNorm = prev.volumeNormalization || {
        enabled: true,
        mode: 'standard',
        targetLoudness: -14,
        preampTrim: 0,
        applyToVideo: false,
      };
      const modeConfig = VOLUME_NORMALIZATION_MODES[mode];
      showToast(`Normalization mode: ${modeConfig?.name || mode}`);
      return {
        ...prev,
        volumeNormalization: {
          ...currentNorm,
          mode,
          targetLoudness: modeConfig?.target ?? -14,
        },
      };
    });
  };

  const updateVolumeNormalization = (partial: Partial<VolumeNormalizationSettings>) => {
    setSettings((prev) => ({
      ...prev,
      volumeNormalization: {
        ...(prev.volumeNormalization || {
          enabled: true,
          mode: 'standard',
          targetLoudness: -14,
          preampTrim: 0,
          applyToVideo: false,
        }),
        ...partial,
      },
    }));
  };

  const setSleepTimer = (minutes: number | null) => {
    if (minutes === null || minutes <= 0) {
      cancelSleepTimer();
      return;
    }
    const seconds = Math.round(minutes * 60);
    setSleepTimerRemaining(seconds);
    setSleepTimerInitialSeconds(seconds);
    setSleepTimerEndTrack(false);
  };

  const setSleepTimerAtTrackEnd = () => {
    setSleepTimerEndTrack(true);
    setSleepTimerRemaining(null);
    setSleepTimerInitialSeconds(null);
  };

  const extendSleepTimer = (additionalMinutes: number) => {
    setSleepTimerRemaining((prev) => {
      const current = prev || 0;
      const updated = current + additionalMinutes * 60;
      setSleepTimerInitialSeconds((init) => (init ? init + additionalMinutes * 60 : updated));
      return updated;
    });
    setSleepTimerEndTrack(false);
  };

  const cancelSleepTimer = () => {
    setSleepTimerRemaining(null);
    setSleepTimerInitialSeconds(null);
    setSleepTimerEndTrack(false);
  };

  const openVideoModal = () => setIsVideoModalOpen(true);
  const closeVideoModal = () => setIsVideoModalOpen(false);
  const openAudioModal = () => setIsAudioModalOpen(true);
  const closeAudioModal = () => setIsAudioModalOpen(false);

  return (
    <PlayerContext.Provider
      value={{
        mediaList,
        playlists,
        recycleBin,
        settings,
        activeMedia,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        brightness,
        playbackRate,
        aspectRatio,
        loopMode,
        queue,
        queueIndex,
        isVideoModalOpen,
        isAudioModalOpen,
        themeColors,
        stats,
        audioRef,
        videoRef,
        playMedia,
        togglePlay,
        pause,
        resume,
        seek,
        setVolume,
        toggleMute,
        setBrightness,
        setPlaybackRate,
        setAspectRatio,
        setLoopMode,
        nextTrack,
        previousTrack,
        toggleFavorite,
        createPlaylist,
        deletePlaylist,
        addToPlaylist,
        removeFromPlaylist,
        deleteMedia,
        restoreMedia,
        emptyRecycleBin,
        addCustomMedia,
        updateMediaMetadata,
        playNext,
        playNextMultiple,
        removeFromQueue,
        moveQueueItem,
        clearUpcomingQueue,
        toastMessage,
        showToast,
        clearToast,
        updateSettings,
        setEqualizerBand,
        setEqualizerPreset,
        setEqualizerEnabled,
        setEqualizerPreamp,
        resetEqualizer,
        toggleVolumeNormalization,
        setVolumeNormalizationMode,
        updateVolumeNormalization,
        sleepTimerRemaining,
        sleepTimerInitialSeconds,
        sleepTimerEndTrack,
        setSleepTimer,
        setSleepTimerAtTrackEnd,
        extendSleepTimer,
        cancelSleepTimer,
        openVideoModal,
        closeVideoModal,
        openAudioModal,
        closeAudioModal,
        onTimeUpdate,
        onEnded,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
}
