import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { initDB } from "@/services/database";
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
  backfillMissingVideoThumbnails,
  clearAllVideos as clearStoredVideos,
  deleteVideo as deleteStoredVideo,
  deleteVideos as deleteStoredVideos,
  getAllVideos,
  getDeletedVideos as getStoredDeletedVideos,
  incrementPlayCount as incrementStoredPlayCount,
  restoreVideo as restoreStoredVideo,
  restoreVideos as restoreStoredVideos,
  saveTrimmedClip as saveStoredTrimmedClip,
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
} from "@/types/player";

export type {
  PlayerContextType,
  PlayerSettings,
  Playlist,
  VideoItem,
} from "@/types/player";

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<PlayerSettings>(
    DEFAULT_PLAYER_SETTINGS
  );
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const initialized = useRef(false);
  const thumbnailBackfillRunning = useRef(false);
  const settingsRef = useRef<PlayerSettings>(DEFAULT_PLAYER_SETTINGS);

  const refreshVideos = useCallback(async () => {
    const storedVideos = await getAllVideos();
    
    setVideos((prev) => {
      // If the lengths are the same and all IDs match, we might skip heavy mapping
      // but usually we want to pick up updated metadata like thumbnails.
      // Optimization: only build the map if we have previous videos.
      if (prev.length === 0) return storedVideos;
      
      const previousByUri = new Map(prev.map((video) => [video.uri, video]));
      return storedVideos.map((video) => {
        const previousVideo = previousByUri.get(video.uri);
        if (!previousVideo) return video;
        
        // Preserve in-memory thumbnail if DB one is still missing
        return {
          ...video,
          thumbnail: video.thumbnail ?? previousVideo.thumbnail,
          thumbnailHash: video.thumbnailHash ?? previousVideo.thumbnailHash,
        };
      });
    });

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
    
    return storedVideos;
  }, []);

  const refreshPlaylists = useCallback(async () => {
    const storedPlaylists = await getPlaylists();
    setPlaylists(storedPlaylists);
    return storedPlaylists;
  }, []);

  const loadData = useCallback(async () => {
    try {
      await initDB();
      await migrateLegacyStorageIfNeeded();
      await runScheduledHistoryCleanup();
      // Rebuild the Folders table from existing Videos so the library folder
      // list is always populated, even on first launch or after a reinstall.
      await syncFoldersFromVideos();

      const [storedVideos, storedPlaylists, storedSettings] = await Promise.all([
        getAllVideos(),
        getPlaylists(),
        loadSettings(),
      ]);

      setVideos(storedVideos);
      setPlaylists(storedPlaylists);
      setSettings(storedSettings);
      settingsRef.current = storedSettings;
    } catch (error) {
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
            await refreshVideos();
          }
        })
        .finally(() => {
          thumbnailBackfillRunning.current = false;
        });
    }, 2000);

    return () => clearTimeout(timeout);
  }, [refreshVideos, videos]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const addVideo = useCallback(
    async (video: Omit<VideoItem, "id" | "isFavorite" | "playCount">) => {
      const result = await upsertVideo(video);
      await refreshVideos();
      return result.video;
    },
    [refreshVideos]
  );

  const removeVideo = useCallback(
    async (id: string, mode: VideoDeleteMode = "temporary") => {
      await deleteStoredVideo(id, mode);
      setVideos((prev) => prev.filter((video) => video.id !== id));
      setCurrentVideo((prev) => (prev?.id === id ? null : prev));
      await refreshPlaylists();
    },
    [refreshPlaylists]
  );

  const removeVideos = useCallback(
    async (ids: string[], mode: VideoDeleteMode = "temporary") => {
      await deleteStoredVideos(ids, mode);
      const idSet = new Set(ids);
      setVideos((prev) => prev.filter((video) => !idSet.has(video.id)));
      setCurrentVideo((prev) => (prev && idSet.has(prev.id) ? null : prev));
      await refreshPlaylists();
    },
    [refreshPlaylists]
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
      await refreshVideos();
      return savedClip;
    },
    [refreshVideos]
  );

  const clearOldHistory = useCallback(
    async (days?: number) => {
      const result = await clearStoredOldHistory(days);
      await refreshVideos();
      return result;
    },
    [refreshVideos]
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
        await refreshVideos();
      }

      return {
        added: result.addedCount,
        total: result.totalCount,
      };
    },
    [refreshVideos]
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
      await refreshVideos();
    },
    [refreshVideos]
  );

  const restoreVideos = useCallback(
    async (ids: string[]) => {
      await restoreStoredVideos(ids);
      await refreshVideos();
    },
    [refreshVideos]
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
    await refreshVideos();
  }, [refreshVideos]);

  const clearMediaLibrary = useCallback(async () => {
    await clearStoredVideos();
    await refreshVideos();
  }, [refreshVideos]);

  const value = useMemo<PlayerContextType>(
    () => ({
      videos,
      playlists,
      continueWatchingVideos,
      recentVideos,
      favorites,
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
      incrementPlayCount,
      clearOldHistory,
      syncVideos,
      reloadVideos: refreshVideos,
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
      incrementPlayCount,
      clearOldHistory,
      syncVideos,
      refreshVideos,
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
