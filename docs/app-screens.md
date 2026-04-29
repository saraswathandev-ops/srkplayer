# SRK Player — Screen Reference

**Last updated:** 2026-04-27  
**Purpose:** Complete reference for every screen — what it shows, what state it uses, every handler, and how it connects to the rest of the app.

---

## Navigation Structure

```
RootNavigator (Stack)
├── TabsRoot → TabNavigator (Bottom Tabs)
│   ├── Home         (app/(tabs)/index.tsx)
│   ├── Library      (app/(tabs)/library.tsx)
│   ├── Audio        (app/(tabs)/audio.tsx)
│   ├── Playlists    (app/(tabs)/playlists.tsx)
│   ├── Search       (app/(tabs)/search.tsx)
│   └── Settings     (app/(tabs)/settings.tsx)
│
├── player           (app/player.tsx)           fullScreenModal
├── audio-player     (app/audio-player.tsx)     fullScreenModal
├── folder           (app/folder/[id].tsx)
├── playlist         (app/playlist/[id].tsx)
├── network-stream   (app/network-stream.tsx)
└── recycle-bin      (app/recycle-bin.tsx)
```

Tab bar height: `72dp + bottom inset`. Label visibility controlled by `settings.tabBarLabels` (`always` / `active` / `never`).

---

## Tab Screens

### HomeScreen — `app/(tabs)/index.tsx`

**Purpose:** Dashboard overview of the library. Entry point for most users.

**Sections displayed:**
- Stats cards: Media count, Favorites, Watched, Playlists, Total duration, Folder count
- Continue Watching rail (videos with saved position)
- Recently Played rail
- Favorites rail
- All Media grid

**State:**
- `videos`, `playlists`, `favorites` from `PlayerContext`
- `isImporting` — loading state during media import

**Handlers:**

| Handler | Action |
|---|---|
| `importVideos()` | Trigger media scan from device library |
| `clearMediaLibrary()` | Alert-confirmed full library wipe |
| Tap video card | Navigate to `player` screen with video ID |

**Connections:**
- `usePlayer()` for data
- `useVideoImport()` for import trigger
- `useTabSwipeNavigation("index")` for left/right tab swipe
- `ScreenBackdrop`, `VideoCard`, `SectionHeader` components

---

### LibraryScreen — `app/(tabs)/library.tsx`

**Purpose:** Browse the full video library by folder or flat video list.

**State:**

| State | Type | Values |
|---|---|---|
| `browserMode` | string | `"folders"` / `"videos"` |
| `sortMode` | string | `"name"` / `"date"` / `"size"` |
| `viewMode` | string | `"grid"` / `"list"` |
| `selectionMode` | boolean | Multi-select active |
| `selectedIds` | Set\<string\> | Currently selected IDs |

**Handlers:**

| Handler | Action |
|---|---|
| `toggleSelection(id)` | Toggle item selected state |
| `handleSelectAllToggle()` | Select / deselect all visible |
| `handleDeleteSelected()` | Alert-confirmed bulk delete |
| `handleAddToPlaylist()` | Add selected to playlist |
| `handleRefresh()` | Trigger device media sync |
| `handleFolderLongPress(id)` | Toggle folder privacy lock |
| Tap video | Navigate to player |
| Tap folder | Navigate to `folder` screen |
| Scroll > 300px | Show scroll-to-top button |

**Features:**
- Recent video rail (last 8 watched) at top of videos view
- Thumbnail backfill for videos without artwork
- Infinite scroll for folder list (`getFolders()` paginated)
- `FlashList` with grid support (numColumns varies by viewMode)

**Connections:**
- `usePlayer()`, `useDeviceVideoSync()`, `useVideoImport()`
- `folderService` for privacy toggle
- `MultiSelectActionBar` for bulk actions

---

### AudioScreen — `app/(tabs)/audio.tsx`

**Purpose:** Browse and play audio tracks with multiple grouping views.

**Group Views:**

| View | Groups by |
|---|---|
| `songs` | Flat list of all audio |
| `folders` | Grouped by folder |
| `artists` | Grouped by artist tag |
| `albums` | Grouped by album tag |
| `favorites` | Only favorited tracks |
| `recent` | Sorted by watchedAt |
| `mostPlayed` | Sorted by playCount |

**State:**
- `groupView` — current view mode
- `selectionMode`, `selectedIds` — multi-select
- `searchQuery` — filter visible tracks
- `playlistModalVisible` — add-to-playlist sheet

**Handlers:**

| Handler | Action |
|---|---|
| `playQueue(tracks, idx)` | Load tracks into TrackPlayer and play from idx |
| `toggleSelection(id)` | Toggle individual item |
| `handleSelectAllToggle()` | Select / deselect all |
| `handleDeleteSelected()` | Bulk delete with confirmation |
| `handleAddToPlaylist()` | Add selected to playlist |
| Auto-refresh on mount | If no audio items found, triggers device sync |

**Connections:**
- `usePlayer()`, `useTrackPlayer()`, `useDeviceVideoSync()`
- `FlashList` for performance
- `MultiSelectActionBar`, `PlaylistPickerModal`

---

### PlaylistsScreen — `app/(tabs)/playlists.tsx`

**Purpose:** View and create playlists.

**State:**
- `playlists` from `PlayerContext`
- `createModalVisible`, `newPlaylistName`

**Handlers:**

| Handler | Action |
|---|---|
| `handleCreate()` | Validate name, call `createPlaylist()`, dismiss modal |
| `handlePlaylistPress(id)` | Navigate to `playlist/[id]` |
| Press FAB (+) | Open create modal |

**Notes:**
- Modal uses `Modal` component on iOS, conditional render on web
- Haptic feedback on successful create

**Connections:**
- `usePlayer()` for playlists and `createPlaylist()`
- `PlaylistCard` component

---

### SearchScreen — `app/(tabs)/search.tsx`

**Purpose:** Global full-text search across the media library.

**State:**
- `query` — live search string
- `results` — from `searchVideos(query)`
- `recentSuggestions` — first 5 videos as quick suggestions
- `recentlyAdded` — latest 5 videos

**Handlers:**

| Handler | Action |
|---|---|
| Type in search bar | `searchVideos(query)` fires on change |
| Tap suggestion chip | Fills search bar with suggestion text |
| Tap result | Navigate to player |

**Connections:**
- `usePlayer()` for `searchVideos()`, recent videos, folder count
- `VideoCard` in `FlatList`

---

### SettingsScreen — `app/(tabs)/settings.tsx`

**Purpose:** Configure all app-wide preferences, theme, storage, and diagnostics.

**Setting Sections:**

#### Appearance
| Setting | Type | Options |
|---|---|---|
| Theme | cycle | `system` / `light` / `dark` |
| Theme preset | cycle | Built-in presets |
| Custom primary color | text input | Hex color |
| Custom accent color | text input | Hex color |
| Tab bar labels | cycle | `always` / `active` / `never` |
| App font size | cycle | Small / Medium / Large |
| Subtitle font size | cycle | Small / Medium / Large |
| Background artwork | toggle | Show album art behind UI |

#### Playback
| Setting | Type | Options |
|---|---|---|
| Playback speed | cycle | 0.5× … 2× |
| Video size mode | cycle | Fit / Expand / Stretch |
| Swipe volume | toggle | Enable right-zone swipe |
| Swipe brightness | toggle | Enable left-zone swipe |
| Auto-play | toggle | — |
| Remember position | toggle | — |
| Background play | toggle | — |

#### Storage & Diagnostics
| Handler | Action |
|---|---|
| `handleClearMediaLibrary()` | Wipe all indexed media with confirmation |
| `handleClearOldHistory()` | Remove watch history older than N days |
| `loadStorageDiagnostics()` | Compute cache + DB size stats |
| `handleViewCrashLogs()` | Show crash log file in modal |
| `handleCopyCrashLogs()` | Copy crash log to clipboard |
| `handleClearCrashLogs()` | Delete crash_logs.txt |

**Connections:**
- `usePlayer()` for settings + `updateSettings()`
- `getCrashLogs()`, `clearCrashLogs()` from `crashManager`
- `getStorageDiagnostics()` for storage info
- `SettingRow` component for consistent layout

---

## Modal / Full-screen Screens

### AudioPlayerScreen — `app/audio-player.tsx`

**Purpose:** Full-screen audio player with playback controls, sleep timer, and gestures.

**Playback Controls:**
- Play / Pause
- Seek slider (managed with `handleSliderStart/End` to suppress gesture conflicts)
- Skip to previous / next track
- Cycle repeat mode (Off → Queue → Track)
- Toggle shuffle
- Cycle playback speed (`SPEED_OPTIONS`: 0.5 → 2.0×)
- Volume slider → `handleVolumeChange()` with haptics

**Sleep Timer:**
- Options: `15m / 30m / 45m / 60m / off`
- `cycleSleepTimer()` cycles through options
- Effect decrements every second; pauses playback at zero, shows alert

**Gesture Navigation:**
- Swipe down → close (navigate back)
- Swipe left → next track
- Swipe right → previous track
- Double-tap → seek ±10s

**Menu Actions:**
| Action | Handler |
|---|---|
| Share | `handleShare()` → native share dialog |
| Add to playlist | `handleAddToPlaylist()` → `PlaylistPickerModal` |
| Toggle favorite | `toggleFavorite(activeId)` |

**Redirect behavior:** If active track is `mediaType === "video"`, redirects to video player screen automatically.

**Connections:**
- `useTrackPlayer()` for all playback state and control
- `usePlayer()` for favorites, playlists
- `ProgressBar` component for seek
- `VolumeManager` for system volume sync

---

### FolderScreen — `app/folder/[id].tsx`

**Purpose:** View all media inside a specific folder with sorting and multi-select.

**Route param:** `id` (folder path, URL-decoded)

**State:**
- `items` — paginated folder videos (PAGE_SIZE = 10)
- `sortBy` — `"dateAdded"` / `"title"` / `"size"`
- `sortDir` — `"asc"` / `"desc"`
- `selectionMode`, `selectedIds`
- `isLoadingMore` — pagination in progress

**Handlers:**

| Handler | Action |
|---|---|
| `getFolderVideos()` | Load page of videos via `folderService` |
| `toggleSelection(id)` | Toggle item |
| `handleSelectAll()` | Select all loaded items |
| `handleDeleteSelected()` | Alert-confirmed delete |
| `handleAddToPlaylist()` | Bulk add to playlist |
| `onEndReached` | Trigger next page load (infinite scroll) |
| Pull-to-refresh | Trigger device sync then reload |

**Header card:** Shows folder name, total file count, loaded count, sort controls.

**Connections:**
- `usePlayer()`, `useDeviceVideoSync()`
- `folderService.getFolderVideos()` for paginated data
- `FlashList` for virtualized list
- `MultiSelectActionBar`

---

### PlaylistScreen — `app/playlist/[id].tsx`

**Purpose:** View and manage videos inside a playlist.

**Route param:** `id` (playlist UUID)

**State:**
- `items` — paginated playlist videos (PAGE_SIZE = 20)
- `page` — current page
- `selectionMode`, `selectedIds`
- `addModalVisible` — add videos sheet
- `moveModalVisible` — move to playlist sheet

**Handlers:**

| Handler | Action |
|---|---|
| `loadPlaylistPage(page, reset?)` | Load paginated videos via `playlistService` |
| `handlePlayAll()` | Play all playlist videos from first item |
| `handleAdd()` | Open add modal → select from videos not in playlist |
| `toggleSelection(id)` | Toggle item |
| `handleRemoveSelected()` | Alert-confirmed remove from playlist |
| `handleMoveSelected()` | Move selected to another playlist |
| `onEndReached` | Load next page |

**`availableToAdd`:** Computed list of all library videos not already in this playlist.

**Connections:**
- `usePlayer()` for video data and playlist operations
- `playlistService` for paginated queries
- `PlaylistPickerModal` for move destination
- `MultiSelectActionBar`

---

## Shared UI Components Referenced

| Component | Used by |
|---|---|
| `VideoCard` | Home, Library, Search, Folder, Playlist |
| `MultiSelectActionBar` | Library, Audio, Folder, Playlist |
| `PlaylistPickerModal` | Audio, Folder, Playlist, AudioPlayer |
| `SettingRow` | Settings |
| `ProgressBar` | AudioPlayer |
| `FlashList` | Library, Audio, Folder, Playlist |
| `AudioPlayerBar` | TabNavigator overlay |
| `ErrorBoundary` | Root (index.js) |
