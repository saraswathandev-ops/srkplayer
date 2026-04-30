# New Feature Implementation Plan

This document defines the next player features to build, the order to build them, and the technical shape of each change.

## Goal

Improve the player with features that increase perceived quality without destabilizing playback.

## Priority Order

1. Smart Resume + Continue Watching
2. Live Thumbnail Preview While Seeking
3. Adaptive Seek Gesture
4. Gesture Customization
5. Folder-based Smart Library

## 1. Smart Resume + Continue Watching

### User Experience

- When a user opens a partially watched video, show:
  - `Resume from 01:45`
  - `Start Over`
- Home/library should show a `Continue Watching` row.
- Completed videos should not reappear unless replayed.

### Data Model

Create a playback progress table in SQLite.

Suggested schema:

```sql
CREATE TABLE IF NOT EXISTS playback_progress (
  video_id TEXT PRIMARY KEY NOT NULL,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL DEFAULT 0,
  progress_percent REAL NOT NULL DEFAULT 0,
  last_watched_at INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0
);
```

### Service Layer

Add a dedicated service, for example:

- `services/playbackProgressService.ts`

Suggested API:

```ts
savePlaybackProgress(videoId, positionSeconds, durationSeconds): Promise<void>
getPlaybackProgress(videoId): Promise<PlaybackProgress | null>
getContinueWatching(limit?: number): Promise<PlaybackProgressItem[]>
markPlaybackCompleted(videoId): Promise<void>
clearPlaybackProgress(videoId): Promise<void>
```

### Player Integration

- Save progress periodically while video is playing.
- Save progress on app background/unmount.
- Mark video completed when progress is above threshold.
- Threshold:
  - `completed = true` when watched >= `95%`
  - clear resume prompt if saved position < `15s`

### UI Integration

- `app/player.tsx`
  - on load, check saved progress for current video
  - if resumable, show prompt before autoplay seek
- Home/library screen
  - show `Continue Watching` row sorted by `last_watched_at DESC`

### Acceptance Criteria

- Reopening a partially watched video shows resume prompt.
- Resume seeks to the last saved position accurately.
- Completed videos do not clutter continue-watching by default.

## 2. Live Thumbnail Preview While Seeking

### User Experience

- While dragging the seek bar, show:
  - preview image
  - target time
- Preview must update fast enough to feel immediate.

### Technical Approach

Use `react-native-create-thumbnail` to generate preview frames.

### Caching Strategy

- Generate thumbnails at fixed intervals.
- Cache paths in SQLite or a lightweight JSON mapping.
- Store generated files under app cache.

Suggested table:

```sql
CREATE TABLE IF NOT EXISTS video_thumbnails (
  video_id TEXT NOT NULL,
  second_mark INTEGER NOT NULL,
  thumbnail_path TEXT NOT NULL,
  PRIMARY KEY (video_id, second_mark)
);
```

### Service Layer

- `services/videoThumbnailService.ts`

Suggested API:

```ts
getThumbnailForTime(videoId, source, second): Promise<string | null>
prewarmThumbnailStrip(videoId, source, duration): Promise<void>
clearVideoThumbnailCache(videoId): Promise<void>
```

### UI Integration

- `components/VideoPlayerControls.tsx`
  - while dragging, request nearest thumbnail
  - render preview bubble above slider thumb

### Acceptance Criteria

- Seek preview appears during slider drag.
- Cached previews are reused on the next open.
- Missing thumbnails fail gracefully without breaking seek.

## 3. Adaptive Seek Gesture

### User Experience

- Slow horizontal movement gives precise seek.
- Fast swipe gives larger seek jumps.
- Gesture should feel responsive without overshooting.

### Logic

Use gesture distance plus velocity.

Suggested behavior:

```ts
if (Math.abs(velocityX) > 2) {
  seekStep = 30;
} else if (Math.abs(velocityX) > 1) {
  seekStep = 10;
} else {
  seekStep = 5;
}
```

### Integration

- update existing seek gesture handling in `app/player.tsx`
- keep edge vertical gestures independent from horizontal seek
- preserve tap, double tap, and long-press behavior

### Acceptance Criteria

- fast swipe seeks faster than slow swipe
- precise dragging remains possible
- no conflict with volume/brightness zones

## 4. Gesture Customization

### User Experience

Let users choose what each side gesture does.

Examples:

- left side: brightness or volume
- right side: volume or seek
- disable individual gesture types

### Data Shape

Extend player settings storage with fields like:

```ts
leftVerticalGesture: "brightness" | "volume" | "none";
rightVerticalGesture: "volume" | "brightness" | "seek" | "none";
adaptiveSeekEnabled: boolean;
```

### UI Integration

- add configuration in player settings / quick controls
- reflect changes immediately without app restart

### Acceptance Criteria

- gesture mapping is user-configurable
- settings persist across app restarts
- invalid combinations are blocked in UI

## 5. Folder-based Smart Library

### User Experience

Automatically group local content into:

- Movies
- Series
- Shorts
- Audio

### Classification Rules

Initial heuristic approach:

- duration > 40 min => Movie
- common `S01E01` / episode naming => Series
- duration < 20 min => Short
- audio-only or music folder => Audio

### Service Layer

- extend existing library query service
- avoid recomputing groups on every render
- persist derived category in DB when possible

### Acceptance Criteria

- library surfaces grouped sections
- grouping is stable across rescans
- manual browsing still works

## Rollout Plan

### Phase 1

- Smart Resume + Continue Watching

### Phase 2

- Live Thumbnail Preview While Seeking

### Phase 3

- Adaptive Seek Gesture
- Gesture Customization

### Phase 4

- Folder-based Smart Library

## Recommended File Additions

- `docs/NEW_FEATURE_IMPLEMENTATION.md`
- `services/playbackProgressService.ts`
- `services/videoThumbnailService.ts`

## Recommended File Updates

- `app/player.tsx`
- `components/VideoPlayerControls.tsx`
- library/home screen files that render local videos
- settings storage/service files

## Implementation Notes

- Keep SQLite writes throttled to avoid excessive disk churn.
- Thumbnail generation must be cached aggressively.
- Gesture upgrades should not regress current volume/brightness behavior.
- New features should remain compatible with local-file playback and online-source playback.

## First Feature To Build Now

Start with `Smart Resume + Continue Watching`.

Reason:

- highest user-visible value
- low architectural risk
- fits the current SQLite-based app structure
- enables future watch analytics naturally
