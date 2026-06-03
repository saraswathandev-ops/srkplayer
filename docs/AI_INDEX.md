# AI Index

- Status: canonical
- Last updated: 2026-06-01 01:35 IST
- Source of truth: `AGENTS.md`, `src/App.tsx`, `src/navigation/*`, `context/*`, `app/*`, `services/*`
- Update when: the doc layout changes, a canonical doc moves, or a feature starts living in a different code area
- Related docs: `docs/architecture/app-runtime.md`, `docs/features/video-player.md`, `docs/features/playback-architecture.md`, `docs/features/player-controls.md`, `docs/features/audio-playback.md`, `docs/features/library-and-media.md`, `docs/features/subtitles-and-online.md`

## Purpose

This is the required first-read file for AI work in this repo. It tells an agent what to read, what to ignore, and which markdown file must be updated when code changes.

## Required Agent Workflow

1. Read `AGENTS.md`.
2. Read `docs/AI_INDEX.md`.
3. Read only the canonical docs linked for the affected feature.
4. Read code only for the exact paths mapped by those docs.
5. If code and docs disagree, treat code as the source of truth and update the doc.
6. If one change spans multiple features, update every affected canonical doc and its `Last updated` field in the same pass.

Recommended prompt text:

> Before working, read `AGENTS.md` and `docs/AI_INDEX.md`. Then read only the linked docs for the affected feature. If docs are stale, update the relevant canonical doc and its `Last updated` field.

## Canonical Doc Map

### Runtime and app shell

- `docs/architecture/app-runtime.md`
- Read for: app startup, providers, navigation, permissions, crash recovery, root lifecycle, context ownership
- Code map: `src/App.tsx`, `src/navigation/*`, `components/providers/AppProviders.tsx`, `context/*`, `services/crashManager.ts`

### Video playback

- `docs/features/video-player.md`
- `docs/features/playback-architecture.md`
- `docs/features/player-controls.md`
- Read for: player screen, gestures, resume, queue, state machine, startup behavior, stall recovery, native state diagnostics, helper modules, controls, settings-driven feature gates, control-layout customization, and playback diagnostics recording
- Code map: `app/player.tsx`, `app/player.*`, `app/playerFeatureConfig.ts`, `app/player-controls-layout.tsx`, `hooks/player/*`, `components/player/*`, `components/VideoPlayerControls.tsx`, `services/playbackProgressService.ts`, `services/playbackDiagnostics.ts`
- For lag or freeze bugs: start with `app/player.tsx`, `app/player.health.ts`, `app/player.constants.ts`, and `app/player.types.ts` before reading unrelated player UI files
- For startup, remount, or stall-classification bugs: read `docs/features/playback-architecture.md` together with `docs/features/video-player.md`
- For playback diagnostics that show `route_resume`, `surface_lost`, `startup_stall_classified`, `startup_recovery`, or repeated `native_false` during `starting` / `stabilizing`, start with `services/playbackDiagnostics.ts`, `app/player.health.ts`, and the startup recovery sections of `app/player.tsx`

### Audio playback

- `docs/features/audio-playback.md`
- Read for: audio player screen, TrackPlayer context, queue behavior, background audio handoff, mini-player behavior
- Code map: `app/audio-player.tsx`, `context/TrackPlayerContext.tsx`, `services/trackPlayerService.ts`, `services/PlayerManager.ts`, `components/AudioPlayerBar.tsx`

### Library and local media

- `docs/features/library-and-media.md`
- `docs/screens/screens-reference.md`
- Read for: tabs, media import, folders, playlists, search, recycle bin, thumbnails, continue watching, local browsing flows
- Code map: `app/(tabs)/*`, `app/folder/[id].tsx`, `app/playlist/[id].tsx`, `app/recycle-bin.tsx`, `services/videoService.ts`, `services/folderService.ts`, `services/playlistService.ts`, `hooks/useDeviceVideoSync.ts`
- Shared shipped UI layer for this area: `components/layout/AppHeader.tsx`, `components/library/HeaderIconButton.tsx`, `components/library/LibraryToolbar.tsx`, `components/library/ListStates.tsx`, `constants/layout.ts`
- For the historical rollout template and tracking breakdown, also check `docs/proposals/library-list-ui-linear-project-template.md`; it is no longer the source of truth for shipped UI behavior

### Subtitles and online content

- `docs/features/subtitles-and-online.md`
- Read for: subtitle generation, parsing, subtitle selection, native subtitle support state, YouTube browsing, network streaming, recommendations, direct downloads
- Code map: `hooks/useSubtitleGeneration.ts`, `services/subtitle*`, `components/player/SubtitleBottomSheet.tsx`, `services/youtubeService.ts`, `services/recommendationService.ts`, `services/directVideoDownloads.ts`, `app/network-stream.tsx`, `app/(tabs)/youtube.tsx`, `android/app/src/main/java/com/skrplayer/*`

### Service and component lookup

- `docs/reference/services.md`
- `docs/reference/components.md`
- Read for: concise catalog lookups only
- Do not use these as the only source for behavior when a feature doc exists

## Doc Status Rules

Use exactly one of these values in the header of every maintained doc:

- `canonical`: primary AI reference for an area
- `reference`: supporting lookup doc
- `proposal`: planned or speculative work, not source of truth
- `changelog`: implemented history or audit log
- `stale`: preserved for context, but no longer authoritative

Timestamp format:

- `Last updated: YYYY-MM-DD HH:mm IST`

## When To Read Code

Read code after docs only when:

- the canonical doc directly maps to the files you need
- the doc says a behavior is stale or incomplete
- the task changes behavior, interfaces, or persistence details
- two docs disagree

Do not scan the full repo by default. Start from the mapped code paths in the relevant canonical doc.

## Update Routing

If you change these areas, update these docs:

- App startup, providers, navigation, crash handling: `docs/architecture/app-runtime.md`
- Video player behavior, gestures, resume, queue, startup timing, stall recovery, overlays, or settings-driven player feature gates: `docs/features/video-player.md`, plus `docs/features/playback-architecture.md` or `docs/features/player-controls.md` if behavior-level detail changed
- Playback diagnostics recording, route-resume startup traces, stall classification, startup recovery tiers, `surface_lost` handling, or remount logic: `docs/features/playback-architecture.md` and `docs/features/video-player.md`
- Audio player or TrackPlayer behavior: `docs/features/audio-playback.md`
- Tabs, folders, playlists, search, import, recycle bin, local library storage: `docs/features/library-and-media.md`
- Subtitle generation, parsing, track selection, native subtitle support behavior, YouTube, network stream, recommendations, download helpers: `docs/features/subtitles-and-online.md`
- Shared service catalog shape: `docs/reference/services.md`
- Shared reusable UI components: `docs/reference/components.md`

## Preserved Non-Canonical Docs

- `docs/proposals/`: future plans, feature ideas, audits that are not the current source of truth
- `docs/proposals/library-list-ui-linear-project-template.md`: Linear-ready tracking template for the library/list UI overhaul; preserved as planning/history, not the canonical source for shipped behavior
- `docs/changelog/`: implemented fix logs and dated history
- `docs/legacy/APP_TECH_STACK.md`: preserved as `stale`; useful for historical intent, not for current implementation truth
- legacy docs such as `docs/legacy/app-architecture.md` and `docs/legacy/app-screens.md`: preserved as pointers/stale compatibility files
