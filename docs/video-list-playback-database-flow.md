# Video List, Playback, Next Video, and Database Flow

This document explains how SRK Player finds videos, shows them in lists, opens the player, chooses the next video, and stores playback state in SQLite.

## Database Tables Used

The app database is `mxplayer.db`, initialized in `services/database.ts`.

Important tables:

- `Videos`: main media library table. Stores `id`, `title`, `path`, `sourceUri`, `duration`, `thumbnail`, `folder`, `lastPosition`, `playCount`, `watchedAt`, `mediaType`, clip fields, and soft-delete flag `isDeleted`.
- `PlaybackProgress`: resume table. Stores `video_id`, `position_seconds`, `duration_seconds`, `progress_percent`, `last_watched_at`, and `completed`.
- `Folders`: folder summary table used by folder browsing.
- `Playlists` and `PlaylistItems`: playlist metadata and ordered video membership.

Useful indexes:

- `idx_videos_active_date` for normal video list order.
- `idx_videos_folder` and `idx_videos_folder_sync` for folder video lookups.
- `idx_videos_active_watched` and `idx_playback_progress_last_watched` for history / continue watching.

## How Video Lists Are Loaded

List screens do not read SQLite directly. They call the player context, which forwards to service functions.

Main path:

1. `app/(tabs)/library.tsx` calls `fetchVideosPage({ limit, offset, mediaType: "video", query, sortMode })`.
2. `context/PlayerContext.tsx` exposes `fetchVideosPage`.
3. `services/videoService.ts` runs the paged `SELECT ... FROM Videos WHERE isDeleted = 0` query.
4. Rows are mapped into `VideoItem` objects and rendered by `VideoCard`.

Normal video list query:

```sql
SELECT id, title, path, duration, thumbnail, thumbnailHash, folder,
       lastPlayed, lastPosition, playCount, isFavorite, size, dateAdded,
       mimeType, artist, album, watchedAt, mediaType, isClip, clipStart, clipEnd
FROM Videos
WHERE isDeleted = 0
ORDER BY dateAdded DESC, rowid DESC
LIMIT ? OFFSET ?
```

Folder playback uses:

```ts
getVideosByFolder(folder)
```

That reads all non-deleted rows for one folder ordered by `dateAdded DESC`.

## How Tapping A Video Opens Playback

In `app/(tabs)/library.tsx`, a video card press does two things:

```ts
setCurrentVideo(item);
navigation.navigate("player", { id: item.id, folder: item.folder });
```

The route passes:

- `id`: the selected video id.
- `folder`: the selected video folder. This is important because the player uses it to build the next/previous queue from the same folder.

Inside `app/player.tsx`:

1. `route.params.id` becomes `activeVideoId`.
2. The player tries to resolve the active `VideoItem` from `videos`, `currentVideo`, `storedVideo`, pending navigation target, or the current queue.
3. If the video is not already in memory, `fetchVideoById(activeVideoId)` loads it from SQLite.
4. `getPlaybackUri(video)` chooses the playable URI from `video.uri` / `video.sourceUri`.
5. `validatedPlaybackUri` is set optimistically so `<Video source={{ uri }}>` can mount quickly.

## How The Player Builds The Queue

The queue is computed in `app/player.tsx`.

If the route has a `folder`, the player loads folder videos:

```ts
getVideosByFolder(routeFolder)
```

Then:

```ts
const videoQueue = routeFolder && folderQueueVideos.length > 0
  ? folderQueueVideos
  : hydratedVideos.filter((item) => item.mediaType !== "audio");
```

Meaning:

- Open from a folder/list item with `folder`: next/previous stays inside that folder.
- Open without folder context: next/previous uses the hydrated library videos in memory.
- Audio items are filtered out of the video queue.

Current position in queue:

```ts
const currentIndex = videoId ? videoQueue.findIndex((item) => item.id === videoId) : -1;
const previousVideo = currentIndex > 0 ? videoQueue[currentIndex - 1] : null;
const nextVideo = currentIndex >= 0 && currentIndex < videoQueue.length - 1
  ? videoQueue[currentIndex + 1]
  : null;
```

## How Next Video Works

The Next button calls `handleNext`.

Flow:

1. Pick `nextVideo`.
2. If no next video and loop mode is `all`, pick the first queue item.
3. Call `handleNavigateToVideo(target, "next")`.

`handleNavigateToVideo`:

- saves the current video position with `saveProgressOnStop("navigate_to_next_video")`;
- shows transition UI;
- pauses the current native player;
- stores the target in `pendingNavigationTargetRef`;
- calls `setActiveVideoId(targetVideo.id)`;
- resets playback startup flags.

`pendingNavigationTargetRef` is important. It lets the next render immediately resolve the target `VideoItem` instead of briefly falling through to `null` while async `fetchVideoById` catches up.

Next can be triggered by:

- player controls Next button;
- Up Next list item;
- last-5-second Up Next overlay;
- remote notification / headset next event;
- end-of-video auto-advance;
- loop-all fallback to first item.

## How Resume And Progress Use The Database

Resume reads from `PlaybackProgress`:

```ts
getPlaybackProgress(videoId)
```

If saved progress exists and is not completed, `app/player.tsx` starts playback at `progress.positionSeconds`.

Progress writes happen through `updateLastPosition` in `context/PlayerContext.tsx`, which calls `savePlaybackProgress` in `services/playbackProgressService.ts`.

`savePlaybackProgress` writes:

- to `PlaybackProgress` when position is at least `MIN_RESUME_POSITION_SECONDS` and not completed;
- back to `Videos.lastPosition`, `Videos.watchedAt`, and optionally `Videos.duration`.

When playback is completed or position is too small, the resume row is deleted:

```sql
DELETE FROM PlaybackProgress WHERE video_id = ?
```

Completion threshold is `95%` of duration.

## Practical Debug Checklist

When a video does not appear in the list:

- Check `Videos.isDeleted = 0`.
- Check `mediaType` matches the screen filter (`video` or `audio`).
- Check paging `limit` / `offset`.
- Check `query` and `sortMode`.

When tapping a video does not play:

- Confirm `navigation.navigate("player", { id, folder })` receives a real `id`.
- Confirm `getVideoById(id)` can find the row.
- Confirm `getPlaybackUri(video)` returns `path`, `uri`, or `sourceUri`.
- Confirm missing-file handling did not set `playbackStartupError`.

When Next goes to the wrong video:

- Check whether the player was opened with `folder`.
- Check `getVideosByFolder(folder)` order.
- Check `currentIndex` in `videoQueue`.
- Check `loopMode` if next wraps to the first item.

When resume is wrong:

- Check `PlaybackProgress` for the `video_id`.
- Check `Videos.lastPosition`.
- Check whether progress was deleted because it was under `MIN_RESUME_POSITION_SECONDS` or completed over `95%`.
