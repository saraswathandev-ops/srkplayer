# Library And Media

- Status: canonical
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `app/(tabs)/*`, `app/folder/[id].tsx`, `app/playlist/[id].tsx`, `app/recycle-bin.tsx`, `hooks/useDeviceVideoSync.ts`, `hooks/useVideoImport.ts`, `services/videoService.ts`, `services/folderService.ts`, `services/playlistService.ts`, `services/videoThumbnails.ts`
- Update when: tabs, media import, folder logic, playlist behavior, DB paging, recycle bin behavior, continue-watching reads, or thumbnail flow changes
- Related docs: `docs/screens/screens-reference.md`, `docs/architecture/app-runtime.md`, `docs/reference/services.md`

## Covers

The local library browsing experience: tab screens, folder and playlist detail flows, media import/sync, playlist CRUD, recycle bin, thumbnail handling, and paged library reads.

## Screen Areas

- `app/(tabs)/index.tsx`: dashboard/home library summary
- `app/(tabs)/library.tsx`: folder/video browsing, sort/view/selection flows
- `app/(tabs)/audio.tsx`: audio library views backed by the same local media set
- `app/(tabs)/playlists.tsx`: playlist list and creation
- `app/(tabs)/search.tsx`: global local-media search
- `app/(tabs)/settings.tsx`: storage, diagnostics, and library-affecting settings
- `app/folder/[id].tsx`: folder detail browser
- `app/playlist/[id].tsx`: playlist detail manager
- `app/recycle-bin.tsx`: restore and permanent delete flows

## Data and Service Boundaries

- `PlayerContext` is the UI-facing library API.
- `services/videoService.ts` is the main database/service layer for videos and many summary reads.
- `services/folderService.ts` aggregates and manages folder-level data.
- `services/playlistService.ts` owns playlist persistence.
- `services/videoThumbnails.ts` and thumbnail helpers handle local artwork generation/cache paths.
- `hooks/useDeviceVideoSync.ts` and `hooks/useVideoImport.ts` trigger device scanning/sync.

## Important Behaviors

- Library reads are paged in several screens rather than loading everything into one list render path.
- Continue-watching, favorites, recent, and most-played views are treated as feature reads over the same stored video data.
- Soft delete and restore behavior flow through the recycle-bin paths rather than immediate permanent deletion.
- Folder rows are rebuilt from video data while preserving folder-level metadata such as privacy state.

## Update When

- Add or remove tabs or local browsing routes
- Change import or scan behavior
- Change playlists, folder privacy, or recycle-bin semantics
- Change thumbnail generation or library paging
- Change search/filter/sort behavior for local media
