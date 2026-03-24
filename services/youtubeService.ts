export type YouTubeVideoItem = {
  id: string;
  title: string;
  channel: string;
  views: string;
  age: string;
  duration: string;
  thumbnail: string;
  videoUrl: string;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
    contentDetails?: {
      duration?: string;
    };
    statistics?: {
      viewCount?: string;
    };
  }>;
};

type YouTubeSearchItem = NonNullable<YouTubeSearchResponse["items"]>[number];
type YouTubeVideosItem = NonNullable<YouTubeVideosResponse["items"]>[number];

const API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const DEFAULT_FEED_QUERY = "tamil music video";
const DEFAULT_REGION_CODE = "IN";

function getApiKey() {
  return process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim() ?? "";
}

function ensureApiKey() {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "Set EXPO_PUBLIC_YOUTUBE_API_KEY to load live YouTube videos."
    );
  }

  return apiKey;
}

function buildApiUrl(path: string, params: Record<string, string | number | undefined>) {
  const apiKey = ensureApiKey();
  const searchParams = new URLSearchParams();

  Object.entries({ ...params, key: apiKey }).forEach(([key, value]) => {
    if (value == null || value === "") return;
    searchParams.set(key, String(value));
  });

  return `${API_BASE_URL}${path}?${searchParams.toString()}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    let message = `YouTube request failed with status ${response.status}.`;

    try {
      const payload = await response.json();
      const apiMessage =
        payload?.error?.message ||
        payload?.message ||
        payload?.error_description;

      if (typeof apiMessage === "string" && apiMessage.trim()) {
        message = apiMessage;
      }
    } catch {
      // Ignore JSON parse failures for non-JSON error bodies.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function formatViewCount(input?: string) {
  const count = Number(input ?? 0);
  if (!Number.isFinite(count) || count <= 0) return "0 views";

  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B views`;
  }

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  }

  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  }

  return `${count} views`;
}

function formatPublishedAge(input?: string) {
  if (!input) return "Recently";

  const publishedAt = new Date(input).getTime();
  if (!Number.isFinite(publishedAt)) return "Recently";

  const diffMs = Date.now() - publishedAt;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

function formatIsoDuration(input?: string) {
  if (!input) return "0:00";

  const match = input.match(
    /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
  );

  if (!match) return "0:00";

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function mapVideoItem(
  item:
    | YouTubeVideosItem
    | (YouTubeSearchItem & {
        contentDetails?: { duration?: string };
        statistics?: { viewCount?: string };
      })
) {
  let videoId = "";

  if (typeof item.id === "string") {
    videoId = item.id;
  } else if (item.id && typeof item.id === "object" && "videoId" in item.id) {
    videoId = item.id.videoId ?? "";
  }

  if (!videoId) return null;

  const thumbnail =
    item.snippet?.thumbnails?.high?.url ||
    item.snippet?.thumbnails?.medium?.url ||
    item.snippet?.thumbnails?.default?.url ||
    "";

  return {
    id: videoId,
    title: item.snippet?.title?.trim() || "Untitled video",
    channel: item.snippet?.channelTitle?.trim() || "Unknown channel",
    views: formatViewCount(item.statistics?.viewCount),
    age: formatPublishedAge(item.snippet?.publishedAt),
    duration: formatIsoDuration(item.contentDetails?.duration),
    thumbnail,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  } satisfies YouTubeVideoItem;
}

async function getVideoDetails(videoIds: string[]) {
  if (videoIds.length === 0) return [];

  const url = buildApiUrl("/videos", {
    part: "snippet,contentDetails,statistics",
    id: videoIds.join(","),
    maxResults: videoIds.length,
  });

  const payload = await fetchJson<YouTubeVideosResponse>(url);
  return (payload.items ?? [])
    .map((item) => mapVideoItem(item))
    .filter((item): item is YouTubeVideoItem => Boolean(item));
}

export async function getYouTubeHomeFeed(query = DEFAULT_FEED_QUERY, limit = 8) {
  const url = buildApiUrl("/search", {
    part: "snippet",
    type: "video",
    q: query,
    maxResults: limit,
    regionCode: DEFAULT_REGION_CODE,
    safeSearch: "moderate",
    order: "relevance",
  });

  const payload = await fetchJson<YouTubeSearchResponse>(url);
  const videoIds = (payload.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((videoId): videoId is string => Boolean(videoId));

  return getVideoDetails(videoIds);
}

export async function getYouTubeTopViewed(limit = 8) {
  const url = buildApiUrl("/videos", {
    part: "snippet,contentDetails,statistics",
    chart: "mostPopular",
    maxResults: limit,
    regionCode: DEFAULT_REGION_CODE,
  });

  const payload = await fetchJson<YouTubeVideosResponse>(url);
  return (payload.items ?? [])
    .map((item) => mapVideoItem(item))
    .filter((item): item is YouTubeVideoItem => Boolean(item));
}

export async function searchYouTubeVideos(query: string, limit = 10) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const url = buildApiUrl("/search", {
    part: "snippet",
    type: "video",
    q: trimmedQuery,
    maxResults: limit,
    regionCode: DEFAULT_REGION_CODE,
    safeSearch: "moderate",
    order: "viewCount",
  });

  const payload = await fetchJson<YouTubeSearchResponse>(url);
  const videoIds = (payload.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((videoId): videoId is string => Boolean(videoId));

  return getVideoDetails(videoIds);
}

export function hasYouTubeApiKey() {
  return Boolean(getApiKey());
}
