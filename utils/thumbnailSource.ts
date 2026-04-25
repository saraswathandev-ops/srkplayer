import { type ImageSource, type VideoThumbnailSource } from "@/types/player";

export const FAILED_THUMBNAIL = "failed";

export function getThumbnailUri(thumbnail?: VideoThumbnailSource | null) {
  if (typeof thumbnail === "string") {
    const uri = thumbnail.trim();
    return uri && uri !== FAILED_THUMBNAIL ? uri : null;
  }

  if (thumbnail && typeof thumbnail === "object" && "uri" in thumbnail) {
    const uri = thumbnail.uri.trim();
    return uri && uri !== FAILED_THUMBNAIL ? uri : null;
  }

  return null;
}

export function getImageSource(thumbnail?: VideoThumbnailSource | null): ImageSource | null {
  if (typeof thumbnail === "number") {
    return thumbnail;
  }

  const uri = getThumbnailUri(thumbnail);
  return uri ? { uri } : null;
}
