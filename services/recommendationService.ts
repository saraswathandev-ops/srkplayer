import { VideoItem } from "@/types/player";
import { log } from "@/utils/logger";

const L = log("RecommendationService");

export interface SuggestionCategory {
  id: string;
  label: string;
  videos: VideoItem[];
}

export async function getRecommendations(
  allVideos: VideoItem[],
  recentlyPlayed: VideoItem[],
  mostWatched: VideoItem[],
  currentVideo?: VideoItem
): Promise<SuggestionCategory[]> {
  const categories: SuggestionCategory[] = [];

  // Same folder
  if (currentVideo) {
    const sameFolder = allVideos.filter(
      (v) =>
        v.id !== currentVideo.id &&
        v.folder?.id === currentVideo.folder?.id
    );
    if (sameFolder.length > 0) {
      categories.push({
        id: "same-folder",
        label: "From Same Folder",
        videos: sameFolder.slice(0, 10),
      });
    }
  }

  // Same artist (if available)
  if (currentVideo && (currentVideo as any).artist) {
    const sameArtist = allVideos.filter(
      (v) =>
        v.id !== currentVideo.id &&
        (v as any).artist === (currentVideo as any).artist
    );
    if (sameArtist.length > 0) {
      categories.push({
        id: "same-artist",
        label: "Same Artist",
        videos: sameArtist.slice(0, 10),
      });
    }
  }

  // Same file type
  if (currentVideo) {
    const getExtension = (path: string) => {
      const match = path.match(/\.([^/.]+)$/);
      return match ? match[1].toLowerCase() : "";
    };
    const ext = getExtension(currentVideo.path || "");
    if (ext) {
      const sameType = allVideos.filter(
        (v) =>
          v.id !== currentVideo.id &&
          getExtension(v.path || "") === ext
      );
      if (sameType.length > 0) {
        categories.push({
          id: "same-type",
          label: `More ${ext.toUpperCase()} Files`,
          videos: sameType.slice(0, 10),
        });
      }
    }
  }

  // Recently played
  if (recentlyPlayed.length > 0) {
    categories.push({
      id: "recently-played",
      label: "Recently Played",
      videos: recentlyPlayed.slice(0, 10),
    });
  }

  // Most watched
  if (mostWatched.length > 0) {
    categories.push({
      id: "most-watched",
      label: "Most Watched",
      videos: mostWatched.slice(0, 10),
    });
  }

  // Latest added
  const latest = [...allVideos]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 10);
  if (latest.length > 0) {
    categories.push({
      id: "latest-added",
      label: "Latest Added",
      videos: latest,
    });
  }

  return categories;
}

export function getSuggestedVideos(
  allVideos: VideoItem[],
  recentlyPlayed: VideoItem[] = [],
  mostWatched: VideoItem[] = [],
  currentVideo?: VideoItem,
  limit = 10
): VideoItem[] {
  const suggestions = new Map<string, VideoItem>();

  // Deduplicate based on folder and add higher weight to recently played
  const weighted = [
    ...recentlyPlayed.slice(0, 5),
    ...mostWatched.slice(0, 5),
    ...allVideos.slice(0, 20),
  ];

  for (const video of weighted) {
    if (
      !suggestions.has(video.id) &&
      video.id !== currentVideo?.id &&
      suggestions.size < limit
    ) {
      suggestions.set(video.id, video);
    }
  }

  return Array.from(suggestions.values());
}
