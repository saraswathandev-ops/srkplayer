import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { VideoItem, Playlist, PlayerSettings, LoopMode, LibraryStats } from '../types';
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
import { THEME_PRESETS } from '../constants/theme';

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
  updateSettings: (partial: Partial<PlayerSettings>) => void;
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

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Synchronize CSS custom property for primary theme color
  useEffect(() => {
    const preset = THEME_PRESETS[settings.themePreset] || THEME_PRESETS.violet;
    document.documentElement.style.setProperty('--theme-primary', preset.primary);
    document.documentElement.style.setProperty('--theme-accent', preset.accent);
  }, [settings.themePreset]);

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

  const updateSettings = (partial: Partial<PlayerSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
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
        updateSettings,
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
