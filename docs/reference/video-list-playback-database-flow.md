# Video List Playback Database Flow

- Status: reference
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `services/videoService.ts`, `services/playbackProgressService.ts`, `services/sessionStateService.ts`, `app/player.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/library.tsx`
- Update when: list-to-player flow, queue construction, or persisted progress/session read paths change
- Related docs: `docs/features/library-and-media.md`, `docs/features/video-player.md`

This file is a supporting flow note for how list browsing connects to playback and persistence.

Start with the canonical feature docs for current behavior.
