# SRK Player — Services Reference

**Purpose:** Central logic, database operations, background tasks, and API coordination.

---

## playerManager
**File:** `services/PlayerManager.ts`
**Purpose:** Singleton coordinator that ensures only one media session (video or audio) is active at a time. Prevents audio/video overlap, background conflicts, and double-playback memory leaks.

---

## videoService
**File:** `services/videoService.ts`
**Purpose:** Database operations for videos. Inserting from media library scans, updating history, toggle favorites, and bulk deletions.

---

## youtubeService
**File:** `services/youtubeService.ts`
**Purpose:** Fetches YouTube data, formats video items, and returns `YouTubeVideoItem`s for integration into the app.
**Key Methods:**
- `getYouTubeHomeFeed(query, limit)`
- `searchYouTubeVideos(query, limit)`
- `getVideoDetails(videoIds)`

---

## trackPlayerService
**File:** `services/trackPlayerService.ts`
**Purpose:** Configures `react-native-track-player`. Handles capabilities, notification configurations, and queue conversions.

---

## folderService
**File:** `services/folderService.ts`
**Purpose:** Folder aggregation and folder-level operations.

| Function | Description |
|---|---|
| `syncFoldersFromVideos()` | Rebuild Folders table from Videos; preserves `isPrivate` |
| `getFolders(limit, offset)` | Paginated list, ordered by `updatedAt DESC, name ASC` |
| `getFolderById(id)` | Single folder metadata |
| `getFolderVideos(id, limit, offset, sortBy, dir)` | Paginated folder contents |
| `toggleFolderPrivacy(id)` | Flip `isPrivate` boolean |

---

## crashManager
**File:** `services/crashManager.ts`
**Purpose:** Track and persist app crashes for diagnostics and crash-loop recovery.

| Function | Description |
|---|---|
| `setupGlobalCrashHandler()` | Attach to `React Native ErrorUtils` for unhandled JS errors |
| `recordFatalCrash(error, context)` | Increment counter + append to `crash_logs.txt` |
| `logCrash(error, context)` | Non-fatal / render error logging |
| `checkAndHandleCrashLoop()` | If 3+ crashes detected, auto-reset DB + AsyncStorage |
| `forceResetApp()` | Manual full reset |
