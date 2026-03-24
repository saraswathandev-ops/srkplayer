import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";

import { usePlayer } from "@/context/PlayerContext";
import { syncDeviceMediaLibraryInBatches } from "@/services/deviceMediaLibrary";
import { triggerLightImpact } from "@/utils/haptics";

export function useDeviceVideoSync() {
  const { reloadVideos, syncVideos, videos } = usePlayer();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const buildSyncErrorMessage = useCallback((error: unknown) => {
    const rawMessage = error instanceof Error ? error.message : String(error);

    if (rawMessage.includes("Expo Go can no longer provide full access")) {
      return "Swipe-to-sync cannot load the full device media library with the current media-library integration on Android. Use Add Media here, or test gallery sync in a native build.";
    }

    return "Could not load videos from the device library. Check media permissions and try again.";
  }, []);

  const refreshDeviceVideos = useCallback(async () => {
    if (Platform.OS === "web" || isRefreshing) {
      return { added: 0, total: 0 };
    }

    setIsRefreshing(true);
    setSyncError(null);

    try {
      triggerLightImpact();
      let added = 0;
      let total = 0;
      const existingUris = new Set(videos.map((video) => video.uri));

      await syncDeviceMediaLibraryInBatches(async (drafts) => {
        const nextDrafts = drafts.filter(
          (draft) => draft.mediaType === "video" && !existingUris.has(draft.uri)
        );

        total += drafts.length;

        if (nextDrafts.length === 0) {
          return;
        }

        const result = await syncVideos(nextDrafts, {
          refresh: false,
          syncFolders: false,
        });

        added += result.added;

        for (const draft of nextDrafts) {
          existingUris.add(draft.uri);
        }
      });

      if (added > 0) {
        await syncVideos([], {
          refresh: false,
          syncFolders: true,
        });
        await reloadVideos();
      }

      return { added, total };
    } catch (error) {
      const message = buildSyncErrorMessage(error);
      setSyncError(message);
      Alert.alert("Library Sync Unavailable", message);
      return { added: 0, total: 0 };
    } finally {
      setIsRefreshing(false);
    }
  }, [buildSyncErrorMessage, isRefreshing, reloadVideos, syncVideos, videos]);

  return {
    refreshDeviceVideos,
    isRefreshing,
    syncError,
  };
}
