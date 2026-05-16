# SRK Player — Screen Reference

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

**Handlers:**
| Handler | Action |
|---|---|
| `importVideos()` | Trigger media scan from device library |
| `clearMediaLibrary()` | Alert-confirmed full library wipe |
| Tap video card | Navigate to `player` screen with video ID |

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

---

### PlaylistsScreen — `app/(tabs)/playlists.tsx`
**Purpose:** View and create playlists.

---

### SearchScreen — `app/(tabs)/search.tsx`
**Purpose:** Global full-text search across the media library.

---

### SettingsScreen — `app/(tabs)/settings.tsx`
**Purpose:** Configure all app-wide preferences, theme, storage, and diagnostics.

---

## Modal / Full-screen Screens

### AudioPlayerScreen — `app/audio-player.tsx`
**Purpose:** Full-screen audio player with playback controls, sleep timer, and gestures.

### FolderScreen — `app/folder/[id].tsx`
**Purpose:** View all media inside a specific folder with sorting and multi-select.

### PlaylistScreen — `app/playlist/[id].tsx`
**Purpose:** View and manage videos inside a playlist.

### NetworkStreamScreen — `app/network-stream.tsx`
**Purpose:** Play an internet stream by inputting a valid video URL (HTTP/HTTPS/M3U8).
- Resolves network URL as a video and opens it in `app/player.tsx`.
