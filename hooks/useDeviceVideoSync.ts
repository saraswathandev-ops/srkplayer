import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";

import { usePlayer } from "@/context/PlayerContext";
import { syncDeviceMediaLibraryInBatches } from "@/services/deviceMediaLibrary";
import { syncFoldersFromVideos } from "@/services/folderService";
import { deleteVideosByUris, getKnownVideoUris } from "@/services/videoService";
import { triggerLightImpact } from "@/utils/haptics";

export function useDeviceVideoSync() {
  const { reloadVideos, syncVideos } = usePlayer();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const buildSyncErrorMessage = useCallback((error: unknown) => {
    const rawMessage = error instanceof Error ? error.message : String(error);

    if (rawMessage.includes("Expo Go can no longer provide full access")) {
      return "Swipe-to-sync cannot load the full device media library with the current media-library integration on Android. Use Add Media here, or test gallery sync in a native build.";
    }

    return "Could not load media from device storage. Check audio/video permissions and try again.";
  }, []);

  const refreshDeviceVideos = useCallback(async () => {
    if (Platform.OS === "web" || isRefreshing) {
      return { added: 0, total: 0 };
    }

    setIsRefreshing(true);
    setSyncError(null);

    try {
      triggerLightImpact();

      // Load all known URIs from the DB once — the scanner will skip them
      const knownUris = await getKnownVideoUris();
      const unseenUris = new Set(knownUris);

      let added = 0;
      let total = 0;

      await syncDeviceMediaLibraryInBatches(
        async (drafts) => {
          total += drafts.length;
          if (drafts.length > 0) {
            const result = await syncVideos(drafts, {
              refresh: false,
              syncFolders: false,
            });
            added += result.added;
          }
        },
        { knownUris, unseenUris }
      );

      // Any URIs left in unseenUris were deleted from the device
      let deletedCount = 0;
      if (unseenUris.size > 0) {
        deletedCount = unseenUris.size;
        const missingUris = Array.from(unseenUris);
        await deleteVideosByUris(missingUris);
      }

      if (added > 0 || deletedCount > 0) {
        await syncFoldersFromVideos();
        await reloadVideos();
      }

      console.log(
        `[useDeviceVideoSync] Sync done: ${added} added, ${total} scanned, ${knownUris.size} previously known, ${deletedCount} missing/deleted`
      );

      return { added, total };
    } catch (error) {
      const message = buildSyncErrorMessage(error);
      setSyncError(message);
      Alert.alert("Library Sync Unavailable", message);
      return { added: 0, total: 0 };
    } finally {
      setIsRefreshing(false);
    }
  }, [buildSyncErrorMessage, isRefreshing, reloadVideos, syncVideos]);

  return {
    refreshDeviceVideos,
    isRefreshing,
    syncError,
  };
}
