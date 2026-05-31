# Services Reference

- Status: reference
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `services/*`
- Update when: a service is added, removed, renamed, or changes feature ownership
- Related docs: `docs/features/video-player.md`, `docs/features/audio-playback.md`, `docs/features/library-and-media.md`, `docs/features/subtitles-and-online.md`

## Purpose

Concise service catalog for lookup. Use the feature docs for behavior detail.

## Runtime and shared state

- `services/database.ts`: SQLite init and DB access
- `services/playerStorage.ts`: persisted settings and legacy migration
- `services/crashManager.ts`: crash logging and crash-loop recovery
- `services/playerSession.ts`: active native video session reference lifecycle
- `services/sessionStateService.ts`: richer per-video playback session persistence/cache

## Local media and library

- `services/videoService.ts`: core video CRUD, list reads, history/progress summaries, thumbnails backfill hooks
- `services/folderService.ts`: folder aggregation and privacy toggling
- `services/playlistService.ts`: playlist persistence
- `services/videoThumbnails.ts`: thumbnail cache directory and generation helpers
- `services/deviceMediaLibrary.ts`: device media scan and import primitives
- `services/storageMaintenance.ts`: history cleanup and maintenance tasks

## Playback

- `services/playbackProgressService.ts`: resume-position persistence and completion thresholds
- `services/PlayerManager.ts`: global audio/video exclusivity coordinator
- `services/trackPlayerService.ts`: RN TrackPlayer setup and track mapping
- `services/deviceBrightness.ts`: brightness control helpers
- `services/deviceVolume.ts`: volume listeners and gesture updates
- `services/audioLanguagePref.ts`: preferred audio-track persistence
- `services/playbackLogFile.ts`: playback log buffering and retention

## Subtitles and online

- `services/subtitleService.ts`: subtitle job orchestration and event stream
- `services/subtitleParser.ts`: subtitle parsing and timing cleanup
- `services/youtubeService.ts`: YouTube API fetch and item mapping
- `services/recommendationService.ts`: suggested-content logic
- `services/directVideoDownloads.ts`: remote download helpers

## Update When

- Service ownership shifts between features
- New services are introduced
- Old service docs would otherwise point agents to the wrong feature file
