import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { initDB } from "@/services/database";
import { CRASH_RECOVERY_LEVEL_KEY } from "@/services/crashManager";
import {
  addVideosToPlaylist as addVideosToStoredPlaylist,
  addToPlaylist as addVideoToPlaylist,
  createPlaylist as createStoredPlaylist,
  deletePlaylist as deleteStoredPlaylist,
  getPlaylists,
  removeFromPlaylist as removeVideoFromPlaylist,
} from "@/services/playlistService";
import {
  loadSettings,
  migrateLegacyStorageIfNeeded,
  saveSettings,
} from "@/services/playerStorage";
import {
  clearOldHistory as clearStoredOldHistory,
  runScheduledHistoryCleanup,
} from "@/services/storageMaintenance";
import {
  getContinueWatchingVideosPaged,
  getFavoriteVideosPaged,
  getLibraryStats,
  getMostPlayedVideosPaged,
  getRecentVideosPaged,
  getVideoById,
  getVideoCount,
  backfillMissingVideoThumbnails,
  clearAllVideos as clearStoredVideos,
  deleteVideo as deleteStoredVideo,
  deleteVideos as deleteStoredVideos,
  getVideos,
  getDeletedVideos as getStoredDeletedVideos,
  incrementPlayCount as incrementStoredPlayCount,
  restoreVideo as restoreStoredVideo,
  restoreVideos as restoreStoredVideos,
  saveTrimmedClip as saveStoredTrimmedClip,
  searchStoredVideos,
  toggleFavorite as toggleStoredFavorite,
  updateVideoPlayback,
  updateVideoPlaybackMetadata,
  updateVideoDuration,
  upsertVideo,
  upsertVideos,
  clearVideoCache,
} from "@/services/videoService";
import { syncFoldersFromVideos, toggleFolderPrivacy as toggleStoredFolderPrivacy } from "@/services/folderService";
import {
  getContinueWatchingVideos,
  getFavoriteVideos,
  getRecentVideos,
  mergeSettings,
  searchVideosByTitle,
  updateVideoInList,
} from "@/services/videoLibrary";
import {
  DEFAULT_PLAYER_SETTINGS,
  type PlayerContextType,
  type PlayerSettings,
  type Playlist,
  type VideoDeleteMode,
  type VideoItem,
  type MediaType,
  type SortMode,
} from "@/types/player";
import { type LibraryStats } from "@/types/libraryStats";

export type {
  PlayerContextType,
  PlayerSettings,
  Playlist,
  VideoItem,
} from "@/types/player";

import { log } from "@/utils/logger";
const L = log('PlayerContext');

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [videoCount, setVideoCount] = useState(0);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<PlayerSettings>(
    DEFAULT_PLAYER_SETTINGS
  );
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const initialized = useRef(false);
  const thumbnailBackfillRunning = useRef(false);
  const settingsRef = useRef<PlayerSettings>(DEFAULT_PLAYER_SETTINGS);

  const reloadVideos = useCallback(async () => {
    const [storedVideos, storedStats, count] = await Promise.all([
      getVideos(50, 0),
      getLibraryStats(),
      getVideoCount(),
    ]);
    
    setVideos((prev) => {
      if (prev.length === 0) return storedVideos;
      
      const previousByUri = new Map(prev.map((video) => [video.uri, video]));
      return storedVideos.map((video) => {
        const previousVideo = previousByUri.get(video.uri);
        if (!previousVideo) return video;
        
        return {
          ...video,
          thumbnail: video.thumbnail ?? previousVideo.thumbnail,
          thumbnailHash: video.thumbnailHash ?? previousVideo.thumbnailHash,
        };
      });
    });

    setStats(storedStats);
    setVideoCount(count);

    setCurrentVideo((prev) => {
      if (!prev) return prev;
      const nextVideo = storedVideos.find((v) => v.id === prev.id);
      if (!nextVideo) return null;
      return {
        ...nextVideo,
        thumbnail: nextVideo.thumbnail ?? prev.thumbnail,
        thumbnailHash: nextVideo.thumbnailHash ?? prev.thumbnailHash,
      };
    });
  }, []);

  const fetchVideosPage = useCallback(async (options: { limit: number; offset: number; mediaType?: MediaType; query?: string; sortMode?: SortMode }) => {
    if (options.query) {
      return await searchStoredVideos(options.query, options.limit, options.offset, options.sortMode);
    }
    return await getVideos(options.limit, options.offset, options.mediaType, options.sortMode);
  }, []);

  const fetchRecentVideos = useCallback((limit = 10, offset = 0) => getRecentVideosPaged(limit, offset), []);
  const fetchContinueWatching = useCallback((limit = 10, offset = 0) => getContinueWatchingVideosPaged(limit, offset), []);
  const fetchFavorites = useCallback((limit = 20, offset = 0) => getFavoriteVideosPaged(limit, offset), []);
  const fetchMostPlayed = useCallback((limit = 20, offset = 0) => getMostPlayedVideosPaged(limit, offset), []);
  const fetchVideoById = useCallback((id: string) => getVideoById(id), []);

  const refreshPlaylists = useCallback(async () => {
    const storedPlaylists = await getPlaylists();
    setPlaylists(storedPlaylists);
    return storedPlaylists;
  }, []);

  const loadData = useCallback(async () => {
    L.db('loadData start');
    try {
      await initDB();
      L.db('DB initialized');
      await migrateLegacyStorageIfNeeded();
      await runScheduledHistoryCleanup();
      await syncFoldersFromVideos();
      L.sync('folders synced');

      const [storedVideos, storedPlaylists, storedSettings, storedStats, count] = await Promise.all([
        getVideos(50, 0),
        getPlaylists(),
        loadSettings(),
        getLibraryStats(),
        getVideoCount(),
      ]);

      L.db('loadData done', { videos: storedVideos.length, playlists: storedPlaylists.length, total: count });
      setVideos(storedVideos);
      setPlaylists(storedPlaylists);
      setSettings(storedSettings);
      setStats(storedStats);
      setVideoCount(count);
      settingsRef.current = storedSettings;
    } catch (error) {
      L.error('loadData failed', error);
      console.error("Failed to load initial data:", error);
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!initialized.current || thumbnailBackfillRunning.current) return;

    // Use a small delay before checking/starting backfill to allow UI to settle
    const timeout = setTimeout(() => {
      void (async () => {
        const recoveryLevel = await AsyncStorage.getItem(CRASH_RECOVERY_LEVEL_KEY).catch(() => null);
        if (recoveryLevel === "heavy-startup-disabled" || recoveryLevel === "manual-db-reset-recommended") {
          return;
        }

        const needsThumbnail = videos.some(
        (video) =>
          video.mediaType === "video" &&
          !video.thumbnail &&
          !video.thumbnailHash
        );

        if (!needsThumbnail) return;

        thumbnailBackfillRunning.current = true;
        void backfillMissingVideoThumbnails()
          .then(async (updatedCount) => {
            if (updatedCount > 0) {
              await reloadVideos();
            }
          })
          .finally(() => {
            thumbnailBackfillRunning.current = false;
          });
      })();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [reloadVideos, videos]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const addVideo = useCallback(
    async (video: Omit<VideoItem, "id" | "isFavorite" | "playCount">) => {
      const result = await upsertVideo(video);
      await reloadVideos();
      return result.video;
    },
    [reloadVideos]
  );

  const removeVideo = useCallback(
    async (id: string, mode: VideoDeleteMode = "temporary") => {
      await deleteStoredVideo(id, mode);
      setVideos((prev) => prev.filter((video) => video.id !== id));
      setCurrentVideo((prev) => (prev?.id === id ? null : prev));
      await reloadVideos();
      await refreshPlaylists();
    },
    [refreshPlaylists, reloadVideos]
  );

  const removeVideos = useCallback(
    async (ids: string[], mode: VideoDeleteMode = "temporary") => {
      await deleteStoredVideos(ids, mode);
      const idSet = new Set(ids);
      setVideos((prev) => prev.filter((video) => !idSet.has(video.id)));
      setCurrentVideo((prev) => (prev && idSet.has(prev.id) ? null : prev));
      await reloadVideos();
      await refreshPlaylists();
    },
    [refreshPlaylists, reloadVideos]
  );

  const toggleFavorite = useCallback(async (id: string) => {
    setVideos((prev) =>
      updateVideoInList(prev, id, (video) => ({
        ...video,
        isFavorite: !video.isFavorite,
      }))
    );
    setCurrentVideo((prev) =>
      prev?.id === id ? { ...prev, isFavorite: !prev.isFavorite } : prev
    );
    await toggleStoredFavorite(id);
  }, []);

  const updateLastPosition = useCallback(async (id: string, position: number, duration?: number) => {
    const watchedAt = Date.now();
    const normalizedDuration =
      Number.isFinite(duration) && (duration ?? 0) > 0 ? duration : undefined;

    setVideos((prev) =>
      updateVideoInList(prev, id, (video) => ({
        ...video,
        duration: normalizedDuration ?? video.duration,
        lastPosition: position,
        watchedAt,
      }))
    );
    setCurrentVideo((prev) =>
      prev?.id === id
        ? {
            ...prev,
            duration: normalizedDuration ?? prev.duration,
            lastPosition: position,
            watchedAt,
          }
        : prev
    );
    if (normalizedDuration !== undefined) {
      await updateVideoPlaybackMetadata({
        id,
        position,
        watchedAt,
        duration: normalizedDuration,
      });
      return;
    }

    await updateVideoPlayback(id, position, watchedAt);
  }, []);

  const updateMediaDuration = useCallback(async (id: string, duration: number) => {
    if (!Number.isFinite(duration) || duration <= 0) return;

    setVideos((prev) =>
      updateVideoInList(prev, id, (video) => ({
        ...video,
        duration,
      }))
    );
    setCurrentVideo((prev) =>
      prev?.id === id
        ? {
            ...prev,
            duration,
          }
        : prev
    );
    await updateVideoDuration(id, duration);
  }, []);

  const incrementPlayCount = useCallback(async (id: string) => {
    const watchedAt = Date.now();

    setVideos((prev) =>
      updateVideoInList(prev, id, (video) => ({
        ...video,
        playCount: video.playCount + 1,
        watchedAt,
      }))
    );
    setCurrentVideo((prev) =>
      prev?.id === id
        ? {
            ...prev,
            playCount: prev.playCount + 1,
            watchedAt,
          }
        : prev
    );
    await incrementStoredPlayCount(id, watchedAt);
  }, []);

  const saveTrimmedClip = useCallback(
    async (options: {
      video: VideoItem;
      clipStart: number;
      clipEnd: number;
      title?: string;
    }) => {
      const savedClip = await saveStoredTrimmedClip(options);
      await reloadVideos();
      return savedClip;
    },
    [reloadVideos]
  );

  const clearOldHistory = useCallback(
    async (days?: number) => {
      const result = await clearStoredOldHistory(days);
      await reloadVideos();
      return result;
    },
    [reloadVideos]
  );

  const syncVideos = useCallback(
    async (
      incomingVideos: Omit<VideoItem, "id" | "isFavorite" | "playCount">[],
      options?: { refresh?: boolean; syncFolders?: boolean }
    ) => {
      const result = await upsertVideos(incomingVideos, {
        syncFolders: options?.syncFolders,
      });
      if (options?.refresh ?? true) {
        await reloadVideos();
      }

      return {
        added: result.addedCount,
        total: result.totalCount,
      };
    },
    [reloadVideos]
  );

  const createPlaylist = useCallback(
    async (name: string) => {
      await createStoredPlaylist(name);
      await refreshPlaylists();
    },
    [refreshPlaylists]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      await deleteStoredPlaylist(id);
      setPlaylists((prev) => prev.filter((playlist) => playlist.id !== id));
    },
    []
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, videoId: string) => {
      await addVideoToPlaylist(playlistId, videoId);
      await refreshPlaylists();
    },
    [refreshPlaylists]
  );

  const addVideosToPlaylist = useCallback(
    async (playlistId: string, videoIds: string[]) => {
      await addVideosToStoredPlaylist(playlistId, videoIds);
      await refreshPlaylists();
    },
    [refreshPlaylists]
  );

  const removeFromPlaylist = useCallback(
    async (playlistId: string, videoId: string) => {
      await removeVideoFromPlaylist(playlistId, videoId);
      await refreshPlaylists();
    },
    [refreshPlaylists]
  );

  const getDeletedVideos = useCallback(async () => {
    return await getStoredDeletedVideos();
  }, []);

  const restoreVideo = useCallback(
    async (id: string) => {
      await restoreStoredVideo(id);
      await reloadVideos();
    },
    [reloadVideos]
  );

  const restoreVideos = useCallback(
    async (ids: string[]) => {
      await restoreStoredVideos(ids);
      await reloadVideos();
    },
    [reloadVideos]
  );

  const emptyRecycleBin = useCallback(async () => {
    const deleted = await getStoredDeletedVideos();
    await Promise.all(
      deleted.map((video) => deleteStoredVideo(video.id, "permanent"))
    );
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<PlayerSettings>) => {
      const updatedSettings = mergeSettings(settingsRef.current, newSettings);
      settingsRef.current = updatedSettings;
      setSettings(updatedSettings);
      await saveSettings(updatedSettings);
    },
    []
  );

  const searchVideos = useCallback(
    (query: string) => searchVideosByTitle(videos, query),
    [videos]
  );

  const recentVideos = useMemo(() => getRecentVideos(videos), [videos]);
  const continueWatchingVideos = useMemo(
    () => getContinueWatchingVideos(videos),
    [videos]
  );
  const favorites = useMemo(() => getFavoriteVideos(videos), [videos]);

  const toggleFolderPrivacy = useCallback(async (folderId: string) => {
    await toggleStoredFolderPrivacy(folderId);
    await reloadVideos();
  }, [reloadVideos]);

  const clearMediaLibrary = useCallback(async () => {
    await clearStoredVideos();
    await reloadVideos();
  }, [reloadVideos]);

  const value = useMemo<PlayerContextType>(
    () => ({
      videos,
      playlists,
      continueWatchingVideos,
      recentVideos,
      favorites,
      stats,
      videoCount,
      settings,
      currentVideo,
      addVideo,
      removeVideo,
      removeVideos,
      toggleFavorite,
      updateLastPosition,
      updateMediaDuration,
      saveTrimmedClip,
      createPlaylist,
      deletePlaylist,
      addToPlaylist,
      addVideosToPlaylist,
      removeFromPlaylist,
      setCurrentVideo,
      updateSettings,
      searchVideos,
      fetchVideosPage,
      fetchRecentVideos,
      fetchContinueWatching,
      fetchFavorites,
      fetchMostPlayed,
      fetchVideoById,
      incrementPlayCount,
      clearOldHistory,
      syncVideos,
      reloadVideos,
      getDeletedVideos,
      restoreVideo,
      restoreVideos,
      emptyRecycleBin,
      clearMediaLibrary,
      toggleFolderPrivacy,
    }),
    [
      videos,
      playlists,
      continueWatchingVideos,
      recentVideos,
      favorites,
      stats,
      videoCount,
      settings,
      currentVideo,
      addVideo,
      removeVideo,
      removeVideos,
      toggleFavorite,
      updateLastPosition,
      updateMediaDuration,
      saveTrimmedClip,
      createPlaylist,
      deletePlaylist,
      addToPlaylist,
      addVideosToPlaylist,
      removeFromPlaylist,
      updateSettings,
      searchVideos,
      fetchVideosPage,
      fetchRecentVideos,
      fetchContinueWatching,
      fetchFavorites,
      fetchMostPlayed,
      fetchVideoById,
      incrementPlayCount,
      clearOldHistory,
      syncVideos,
      reloadVideos,
      restoreVideos,
      clearMediaLibrary,
      toggleFolderPrivacy,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
