# App Runtime

- Status: canonical
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `src/App.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/TabNavigator.tsx`, `components/providers/AppProviders.tsx`, `context/PlayerContext.tsx`, `context/TrackPlayerContext.tsx`
- Update when: startup flow, providers, navigation, permission handling, crash recovery, or root context ownership changes
- Related docs: `docs/screens/screens-reference.md`, `docs/features/library-and-media.md`, `docs/features/audio-playback.md`, `docs/features/video-player.md`

## Covers

App bootstrap, providers, navigation layout, root lifecycle, crash handling, and the top-level data/runtime ownership model.

## Runtime Shape

- `src/App.tsx` is the real app entrypoint.
- It applies immersive fullscreen behavior, handles Android back exit prompts, requests media permission, detects crash-loop recovery, and routes external media URLs into playback.
- `components/providers/AppProviders.tsx` wraps the app with:
  - `SafeAreaProvider`
  - `GestureHandlerRootView`
  - `PlayerProvider`
  - `TrackPlayerProvider`
  - `ErrorBoundary`

## Navigation

- `src/navigation/RootNavigator.tsx` owns the native stack.
- `TabsRoot` renders the bottom-tab shell.
- Full-screen modal routes:
  - `player`
  - `audio-player`
- Standard stack routes:
  - `folder`
  - `playlist`
  - `network-stream`
  - `recycle-bin`
- `freezeOnBlur` is explicitly disabled to avoid playback lifecycle issues on the player screens.

## Context Ownership

### `PlayerContext`

- Owns app-level library state, settings, current video context, playlists, stats, and most local-media CRUD.
- Initializes the database and settings on first load.
- Syncs folders from videos after startup.
- Triggers thumbnail backfill for missing local video artwork.
- Exposes paged fetch helpers, playlist operations, search, recycle-bin actions, and playback progress helpers used across tabs and player flows.

### `TrackPlayerContext`

- Owns background-capable audio playback state.
- Lazily sets up `react-native-track-player`.
- Polls playback progress and persists audio progress through `PlayerContext`.
- Handles repeat, shuffle, volume sync, and queue switching.

## Persistence and Services

- SQLite is initialized through `services/database.ts`.
- Settings are loaded from `services/playerStorage.ts`.
- Crash recovery is coordinated through `services/crashManager.ts`.
- Folder aggregation runs through `services/folderService.ts`.
- Local video metadata and progress summary reads flow through `services/videoService.ts`.

## External Media Flow

- `src/App.tsx` accepts `content:`, `file:`, `http:`, and `https:` URLs.
- `services/videoService.ts` ensures an externally opened item becomes a playable library-backed entry.
- Navigation then routes that item into the `player` screen by `id`.

## Update When

- Add or remove providers
- Change root navigation structure or route names
- Change app startup sequencing
- Change permission or crash-loop behavior
- Move ownership between `PlayerContext` and `TrackPlayerContext`
