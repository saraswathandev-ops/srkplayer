import DocumentPicker from "react-native-document-picker";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { usePlayer } from "@/context/PlayerContext";
import { buildVideoDraftFromAsset } from "@/services/videoLibrary";
import * as FileSystem from "@/utils/FileSystem";
import { triggerLightImpact } from "@/utils/haptics";
import { randomUUID } from "@/utils/ids";

export function useVideoImport() {
  const { addVideo } = usePlayer();
  const [isImporting, setIsImporting] = useState(false);

  const importVideos = useCallback(async () => {
    if (isImporting) return;
    setIsImporting(true);
    const isWeb = Platform.OS === "web";

    if (!isWeb) {
      triggerLightImpact();
    }

    try {
      const assets = await DocumentPicker.pick({
        type: [DocumentPicker.types.video, DocumentPicker.types.audio],
        allowMultiSelection: true,
      });

      if (isWeb && assets.some((asset) => asset.uri.startsWith("blob:"))) {
        console.warn(
          "Web imports use temporary blob URLs and won't persist after a page refresh."
        );
      }

      for (const asset of assets) {
        let persistentUri = asset.uri;

        // Copy content URIs into app storage so imports survive picker permission loss.
        if (!isWeb && persistentUri.startsWith("content://")) {
          const safeName = (asset.name ?? "media").replace(/[^a-zA-Z0-9.\-_]/g, "_");
          const importDir = `${FileSystem.documentDirectory}imports`;
          const destPath = `${importDir}/${randomUUID()}_${safeName}`;

          await FileSystem.makeDirectoryAsync(importDir, { intermediates: true }).catch(() => {});
          await FileSystem.copyAsync({ from: persistentUri, to: destPath });
          persistentUri = destPath;
        }

        await addVideo(
          await buildVideoDraftFromAsset({
            name: asset.name ?? "Imported media",
            uri: persistentUri,
            size: asset.size,
            mimeType: asset.type ?? undefined,
          })
        );
      }
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        return;
      }
      console.error("Document picker error:", error);
    } finally {
      setIsImporting(false);
    }
  }, [addVideo, isImporting]);

  return {
    importVideos,
    isImporting,
  };
}
