# SRK Player — App Architecture Reference

**Last updated:** 2026-04-27 (PlayerManager added)  
**Purpose:** Data flow, context APIs, database schema, services, and connection map.

---

## Data Flow Overview

```
┌────────────────────────────────────────────────────────┐
│                   DEVICE STORAGE                        │
│  Media files (MP4, MP3, etc.) + MediaLibrary API        │
└───────────────────────┬────────────────────────────────┘
                        │ useDeviceVideoSync
                        ▼
┌────────────────────────────────────────────────────────┐
│                 SQLite DATABASE                          │
│  Videos · Playlists · PlaylistItems · Folders           │
└───────────────────────┬────────────────────────────────┘
                        │ videoService / folderService
                        ▼
┌────────────────────────────────────────────────────────┐
│               PlayerContext (React Context)              │
│  videos[] · playlists[] · settings · favorites          │
└──────┬────────────────┬──────────────────┬─────────────┘
       │                │                  │
  HomeScreen      LibraryScreen      SearchScreen
  AudioScreen     PlaylistsScreen    SettingsScreen
       │
       ▼
┌────────────────────────────────────────────────────────┐
│            TrackPlayerContext (React Context)            │
│  activeId · isPlaying · position · duration · volume    │
└──────────────────────┬─────────────────────────────────┘
                       │
             AudioPlayerScreen
                       │
              react-native-track-player

┌────────────────────────────────────────────────────────┐
│              PlayerManager (Singleton Service)           │
│  Coordinates video ↔ audio — only one active at a time  │
│  playVideo() · playAudio() · stopAll()                  │
└──────┬──────────────────────────────┬───────────────────┘
       │                              │
  player.tsx                 TrackPlayerContext
  (video session)            (audio session)
```

---

## PlayerContext API

**File:** `context/PlayerContext.tsx`  
**Hook:** `usePlayer()`

### Exposed State

| Property | Type | Description |
|---|---|---|
| `videos` | `VideoItem[]` | All non-deleted videos |
| `playlists` | `Playlist[]` | All playlists |
| `settings` | `PlayerSettings` | App-wide settings object |
| `currentVideo` | `VideoItem \| null` | Currently viewed video |
| `continueWatchingVideos` | `VideoItem[]` | Videos with saved position |
| `recentVideos` | `VideoItem[]` | Sorted by `watchedAt` desc |
| `favorites` | `VideoItem[]` | Filtered by `isFavorite` |

### Video Management

| Function | Signature | Description |
|---|---|---|
| `addVideo` | `(video) → void` | Insert or update a video |
| `removeVideo` | `(id, mode)` | Delete video; mode: `"soft"` / `"permanent"` |
| `removeVideos` | `(ids[], mode)` | Bulk delete |
| `reloadVideos` | `() → void` | Refresh all videos from DB |
| `syncVideos` | `(videos[], options)` | Batch upsert from device scan |
| `searchVideos` | `(query) → VideoItem[]` | Full-text search by title |

### Playback Tracking

| Function | Description |
|---|---|
| `updateLastPosition(id, pos, dur?)` | Save resume point |
| `updateMediaDuration(id, dur)` | Update video duration |
| `incrementPlayCount(id)` | Track number of plays |

### Favorites & Clips

| Function | Description |
|---|---|
| `toggleFavorite(id)` | Toggle `isFavorite` flag |
| `saveTrimmedClip(options)` | Create new clip from video range |

### Playlist Operations

| Function | Description |
|---|---|
| `createPlaylist(name)` | Create new playlist |
| `deletePlaylist(id)` | Delete playlist and all its items |
| `addToPlaylist(playlistId, videoId)` | Add single video |
| `addVideosToPlaylist(playlistId, ids[])` | Bulk add |
| `removeFromPlaylist(playlistId, videoId)` | Remove single video |

### Recycle Bin

| Function | Description |
|---|---|
| `getDeletedVideos()` | List soft-deleted videos |
| `restoreVideo(id)` | Restore single deleted video |
| `restoreVideos(ids[])` | Bulk restore |
| `emptyRecycleBin()` | Permanently delete all deleted videos |

### Settings & Maintenance

| Function | Description |
|---|---|
| `updateSettings(partial)` | Merge partial settings update, persist to AsyncStorage |
| `clearOldHistory(days?)` | Remove watch history older than N days |
| `clearMediaLibrary()` | Wipe all videos from DB |
| `toggleFolderPrivacy(folderId)` | Lock / unlock folder |
| `setCurrentVideo(video)` | Set viewing context |

### PlayerSettings object

```typescript
{
  autoPlay: boolean
  speed: number                              // 0.5 – 2.0
  defaultVolume: number                      // 0 – 1
  defaultBrightness: number                  // 0 – 1
  loopMode: "none" | "one" | "all"
  videoSizeMode: "fit" | "expand" | "stretch"
  backgroundPlay: boolean
  rememberPosition: boolean
  doubleTapSeek: number                      // seconds
  swipeBrightness: boolean
  swipeVolume: boolean
  swipeSeek: boolean
  tabBarLabels: "always" | "active" | "never"
  theme: "system" | "light" | "dark"
  themePreset: string
  primaryColor: string                       // hex
  accentColor: string                        // hex
  appFontSize: "small" | "medium" | "large"
  subtitleFontSize: "small" | "medium" | "large"
  backgroundArtwork: boolean
}
```

### Internal behavior
- Thumbnail backfill runs 2s after init for any videos missing artwork
- Settings persisted to `AsyncStorage` via `playerStorage`
- DB initialized via `initDB()`, migrations via `migrateLegacyStorageIfNeeded()`
- Folder table rebuilt via `syncFoldersFromVideos()` after sync
- Scheduled history cleanup via `runScheduledHistoryCleanup()`

---

## TrackPlayerContext API

**File:** `context/TrackPlayerContext.tsx`  
**Hook:** `useTrackPlayer()`

### Exposed State

| Property | Type | Description |
|---|---|---|
| `activeId` | `string \| null` | Currently playing video ID |
| `isPlaying` | `boolean` | Playback state |
| `isReady` | `boolean` | Player initialized |
| `position` | `number` | Current position (seconds) |
| `duration` | `number` | Total duration (seconds) |
| `activeTrack` | `Track \| undefined` | Current RNTP track object |
| `repeatMode` | `RepeatMode` | Off / Queue / Track |
| `shuffleEnabled` | `boolean` | Shuffle state |
| `volume` | `number` | System volume (0–1) |

### Playback Control

| Function | Description |
|---|---|
| `playAudio(videos[], startIndex?)` | Load queue and play from index |
| `playPause()` | Toggle play/pause |
| `skipToNext()` | Skip to next track |
| `skipToPrev()` | Skip to previous track |
| `seekTo(seconds)` | Jump to absolute position |
| `seekBy(seconds)` | Relative seek (+10 / -10) |
| `setRate(rate)` | Set playback speed |
| `setSystemVolume(value)` | Set 0–1 system volume |
| `stopPlayer()` | Stop and reset queue |

### Playback Modes

| Function | Description |
|---|---|
| `cycleRepeatMode()` | Off → Queue → Track → Off |
| `toggleShuffle()` | Toggle; rebuilds queue preserving active track |
| `setRepeat(mode)` | Set repeat mode explicitly |

### Internal behavior
- Setup on app foreground; retry if backgrounded before ready
- Progress polling: 500ms when active, 5s when paused (battery saving)
- Queue rebuilt when shuffle toggled
- Play count incremented when track becomes active (via `PlayerContext`)
- Position saved every 10s if changed (via `PlayerContext`)
- Volume tracked via `VolumeManager`

---

## Database Schema

**File:** `services/database.ts`  
**Engine:** `react-native-sqlite-storage` with WAL mode

### Videos table

```sql
CREATE TABLE videos (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  path          TEXT UNIQUE NOT NULL,
  sourceUri     TEXT,
  sourceVideoId TEXT,
  duration      REAL DEFAULT 0,
  thumbnail     TEXT,
  thumbnailHash TEXT,
  folder        TEXT,
  lastPosition  REAL DEFAULT 0,
  playCount     INTEGER DEFAULT 0,
  isFavorite    INTEGER DEFAULT 0,
  size          INTEGER DEFAULT 0,
  dateAdded     TEXT,
  mimeType      TEXT,
  watchedAt     TEXT,
  artist        TEXT,
  album         TEXT,
  mediaType     TEXT DEFAULT 'video',   -- 'video' | 'audio'
  isClip        INTEGER DEFAULT 0,
  clipStart     REAL,
  clipEnd       REAL,
  isDeleted     INTEGER DEFAULT 0       -- soft-delete flag
)
```

### Playlists table

```sql
CREATE TABLE playlists (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  createdAt  TEXT,
  coverUri   TEXT
)
```

### PlaylistItems table

```sql
CREATE TABLE playlist_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  playlistId TEXT REFERENCES playlists(id),
  videoId    TEXT REFERENCES videos(id),
  position   INTEGER,
  addedAt    TEXT,
  UNIQUE(playlistId, videoId)
)
```

### Folders table

```sql
CREATE TABLE folders (
  id             TEXT PRIMARY KEY,
  name           TEXT UNIQUE NOT NULL,
  coverUri       TEXT,
  coverHash      TEXT,
  videoCount     INTEGER DEFAULT 0,
  unwatchedCount INTEGER DEFAULT 0,
  updatedAt      TEXT,
  isPrivate      INTEGER DEFAULT 0
)
```

### Key Indexes

| Index | Column(s) | Used for |
|---|---|---|
| `idx_videos_folder` | `folder` | Folder browsing |
| `idx_videos_active_date` | `isDeleted, dateAdded` | Non-deleted by date |
| `idx_videos_active_watched` | `isDeleted, watchedAt` | Recently watched |
| `idx_videos_favorite` | `isFavorite, isDeleted` | Favorites filter |
| `idx_videos_media_backfill` | `mediaType, thumbnail` | Missing-thumbnail scan |
| `idx_playlist_items_playlist` | `playlistId` | Playlist video lookup |

### Database API

| Method | Description |
|---|---|
| `getAllAsync<T>(sql, params)` | Query multiple rows |
| `getFirstAsync<T>(sql, params)` | Query single row |
| `runAsync(sql, params)` | Insert / update / delete |
| `execAsync(sql)` | Execute multiple statements |
| `withTransactionAsync(fn)` | Atomic transaction wrapper |
| `runBatchAsync(statements[])` | Batch insert (optimized) |
| `checkpoint()` | WAL truncation |

**Reliability features:**
- Serialized operation queue — prevents concurrent transaction conflicts
- Daily integrity check — auto-resets on corruption
- WAL mode — concurrent reads without blocking writes

---

## Services

### useDeviceVideoSync — `hooks/useDeviceVideoSync.ts`

**Purpose:** Sync device media library into the SQLite database.

**Exported:**
- `refreshDeviceVideos()` — scan + sync
- `isRefreshing: boolean`
- `syncError: string | null`

**Sync process:**
1. Load known URIs from DB
2. Scan device in batches via `syncDeviceMediaLibraryInBatches()`
3. Upsert new/changed videos via `syncVideos()`
4. Track unseen URIs — anything remaining was deleted from device
5. Soft-delete missing videos
6. Rebuild folders table
7. Reload `PlayerContext` if changes detected

**Used by:** AudioScreen (auto on mount), LibraryScreen (manual), FolderScreen (pull-to-refresh)

---

### folderService — `services/folderService.ts`

**Purpose:** Folder aggregation and folder-level operations.

| Function | Description |
|---|---|
| `syncFoldersFromVideos()` | Rebuild Folders table from Videos; preserves `isPrivate` |
| `getFolders(limit, offset)` | Paginated list, ordered by `updatedAt DESC, name ASC` |
| `getFolderById(id)` | Single folder metadata |
| `getFolderVideos(id, limit, offset, sortBy, dir)` | Paginated folder contents |
| `toggleFolderPrivacy(id)` | Flip `isPrivate` boolean |

**Sort options for `getFolderVideos`:** `dateAdded` / `title` / `size`, each with `asc` / `desc`.

---

### crashManager — `services/crashManager.ts`

**Purpose:** Track and persist app crashes for diagnostics and crash-loop recovery.

| Function | Description |
|---|---|
| `setupGlobalCrashHandler()` | Attach to `React Native ErrorUtils` for unhandled JS errors |
| `recordFatalCrash(error, context)` | Increment counter + append to `crash_logs.txt` |
| `logCrash(error, context)` | Non-fatal / render error logging |
| `checkAndHandleCrashLoop()` | If 3+ crashes detected, auto-reset DB + AsyncStorage |
| `forceResetApp()` | Manual full reset |
| `getCrashLogs()` | Read `crash_logs.txt` contents |
| `clearCrashLogs()` | Delete log file |

**Crash loop detection:**
- Consecutive crash count stored in `AsyncStorage`
- Resets to 0 after 10s of stable operation
- At 3+ crashes: wipes DB and AsyncStorage, shows "Crash Recovery" alert on next launch

**Log format:**
```
--------------------------------------
TIMESTAMP: 2026-04-27T16:53:50.060Z
TYPE: FATAL EXCEPTION
MESSAGE: Cannot read property 'x' of undefined
CONTEXT: App startup init
STACK: ...
--------------------------------------
```

**Surfaces in:** SettingsScreen → "Crash Logs" diagnostic section

---

### PlayerManager — `services/PlayerManager.ts`

**Purpose:** Singleton coordinator that ensures only one media session (video or audio) is active at a time. Prevents audio/video overlap, background conflicts, and double-playback memory leaks.

**Pattern:** Singleton class exposed as `PlayerManager` (named export). No React dependency — safe to call from any context, hook, or service.

**API:**

| Function | Description |
|---|---|
| `PlayerManager.playVideo()` | Stops active audio session (TrackPlayer.stop + reset), marks video as active |
| `PlayerManager.playAudio()` | Fires registered video stop callback, marks audio as active |
| `PlayerManager.stopVideo()` | Fires stop callback only — does not touch TrackPlayer |
| `PlayerManager.stopAudio()` | Resets TrackPlayer only — does not touch video |
| `PlayerManager.stopAll()` | Stops both sessions unconditionally |
| `PlayerManager.setVideoStopHandler(fn)` | Register callback for current video player instance |
| `PlayerManager.activeType` | `'video' \| 'audio' \| null` |
| `PlayerManager.isActive` | `boolean` — any session running |

**Integration points:**
- `app/player.tsx` — call `PlayerManager.playVideo()` after video source loads; register stop handler via `setVideoStopHandler(() => videoRef.current?.pause())`
- `context/TrackPlayerContext.tsx` — call `PlayerManager.playAudio()` inside `playAudio()` before loading the RNTP queue
- `app/audio-player.tsx` — call `PlayerManager.setVideoStopHandler(null)` on unmount

**Session reset pattern (video switching):**
```typescript
// Prevents old-frame freeze when changing video
setVideoSource(null);
setTimeout(() => setVideoSource(newUri), 50);
```

---

## Settings Persistence

```
updateSettings(partial)
      │
      ▼
PlayerContext merges partial into state
      │
      ▼
playerStorage.saveSettings(settings)   →  AsyncStorage key: "player_settings"
```

On app init: `loadSettings()` reads AsyncStorage → initial state hydration.  
Legacy migration: `migrateLegacyStorageIfNeeded()` upgrades old key formats.

---

## Error Handling Chain

```
Unhandled JS error
   └─ setupGlobalCrashHandler() → recordFatalCrash()

React render error
   └─ ErrorBoundary → logCrash()

App startup
   └─ checkAndHandleCrashLoop()
         └─ 3+ crashes detected → forceResetApp() → "Crash Recovery" alert

User-visible: SettingsScreen → View Crash Logs
```

---

## Thumbnail Backfill

Runs 2 seconds after `PlayerContext` initializes:

1. Query all `videos WHERE mediaType='video' AND (thumbnail IS NULL OR thumbnail = '')`
2. For each missing thumbnail, call `generateThumbnailUri(path)` (uses `react-native-create-thumbnail`)
3. Update `videos.thumbnail` in DB
4. Re-render updated videos in context

Preserves in-memory thumbnails if DB record is missing them (handles migration edge case).
