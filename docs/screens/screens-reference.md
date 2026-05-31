# Screen Reference

- Status: canonical
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `src/navigation/RootNavigator.tsx`, `src/navigation/TabNavigator.tsx`, `app/(tabs)/*`, `app/audio-player.tsx`, `app/folder/[id].tsx`, `app/playlist/[id].tsx`, `app/network-stream.tsx`, `app/recycle-bin.tsx`
- Update when: routes, screen purposes, or screen ownership move
- Related docs: `docs/architecture/app-runtime.md`, `docs/features/library-and-media.md`, `docs/features/audio-playback.md`, `docs/features/subtitles-and-online.md`

## Navigation Layout

- `TabsRoot`
  - `Home`: `app/(tabs)/index.tsx`
  - `Library`: `app/(tabs)/library.tsx`
  - `Audio`: `app/(tabs)/audio.tsx`
  - `Playlists`: `app/(tabs)/playlists.tsx`
  - `Search`: `app/(tabs)/search.tsx`
  - `Settings`: `app/(tabs)/settings.tsx`
  - `YouTube`: `app/(tabs)/youtube.tsx`
- Full-screen modal screens
  - `player`
  - `audio-player`
- Stack detail screens
  - `folder`
  - `playlist`
  - `network-stream`
  - `recycle-bin`

## Screen Ownership

- Home, Library, Audio, Playlists, Search, Settings: local-media shell and library workflows
- YouTube and Network Stream: online/discovery entry flows
- Player and Audio Player: playback surfaces
- Folder and Playlist detail: local collection drill-down
- Recycle Bin: soft-delete restore and permanent-delete management

## Update When

- Route names change
- A screen changes feature ownership
- Tabs are added or removed
