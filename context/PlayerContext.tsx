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
  deleteVideo as deleteStoredVideo,
  getAllVideos,
  getDeletedVideos as getStoredDeletedVideos,
  restoreVideo as restoreStoredVideo,
  incrementPlayCount as incrementStoredPlayCount,
  saveTrimmedClip as saveStoredTrimmedClip,
  toggleFavorite as toggleStoredFavorite,
  updateVideoPlayback,
  upsertVideo,
  upsertVideos,
} from "@/services/videoService";
import {
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
    setCurrentVideo((prev) => {
      if (!prev) return prev;
      const nextVideo = storedVideos.find((video) => video.id === prev.id);
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
    await initDB();
    await migrateLegacyStorageIfNeeded();
    await runScheduledHistoryCleanup();

    const [storedVideos, storedPlaylists, storedSettings] = await Promise.all([
      getAllVideos(),
      getPlaylists(),
      loadSettings(),
    ]);

    setVideos(storedVideos);
    setPlaylists(storedPlaylists);
    setSettings(storedSettings);
    settingsRef.current = storedSettings;
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!initialized.current || thumbnailBackfillRunning.current) return;
    if (
      !videos.some(
        (video) =>
          video.mediaType === "video" &&
          !video.thumbnail &&
          !video.thumbnailHash
      )
    ) {
      return;
    }

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

  const updateLastPosition = useCallback(async (id: string, position: number) => {
    const watchedAt = Date.now();

    setVideos((prev) =>
      updateVideoInList(prev, id, (video) => ({
        ...video,
        lastPosition: position,
        watchedAt,
      }))
    );
    setCurrentVideo((prev) =>
      prev?.id === id
        ? {
            ...prev,
            lastPosition: position,
            watchedAt,
          }
        : prev
    );
    await updateVideoPlayback(id, position, watchedAt);
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
  const favorites = useMemo(() => getFavoriteVideos(videos), [videos]);

  const value = useMemo<PlayerContextType>(
    () => ({
      videos,
      playlists,
      recentVideos,
      favorites,
      settings,
      currentVideo,
      addVideo,
      removeVideo,
      toggleFavorite,
      updateLastPosition,
      saveTrimmedClip,
      createPlaylist,
      deletePlaylist,
      addToPlaylist,
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
      emptyRecycleBin,
    }),
    [
      videos,
      playlists,
      recentVideos,
      favorites,
      settings,
      currentVideo,
      addVideo,
      removeVideo,
      toggleFavorite,
      updateLastPosition,
      saveTrimmedClip,
      createPlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      updateSettings,
      searchVideos,
      incrementPlayCount,
      clearOldHistory,
      syncVideos,
      refreshVideos,
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
