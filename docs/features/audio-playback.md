# Audio Playback

- Status: canonical
- Last updated: 2026-05-31 23:10 IST
- Source of truth: `app/audio-player.tsx`, `context/TrackPlayerContext.tsx`, `services/trackPlayerService.ts`, `services/PlayerManager.ts`, `components/AudioPlayerBar.tsx`
- Update when: audio queueing, background audio, TrackPlayer integration, handoff rules, mini-player behavior, or audio-player UI changes
- Related docs: `docs/architecture/app-runtime.md`, `docs/features/video-player.md`, `docs/reference/services.md`

## Covers

The full-screen audio player, global mini-player behavior, TrackPlayer ownership, and video-to-audio handoff rules.

## Main Pieces

- `context/TrackPlayerContext.tsx` is the operational API for audio playback.
- `app/audio-player.tsx` renders the full-screen audio player UI.
- `components/AudioPlayerBar.tsx` is the always-available mini-player surface when audio is active.
- `services/trackPlayerService.ts` handles TrackPlayer setup and video-to-track mapping.
- `services/PlayerManager.ts` prevents overlapping video and audio sessions.

## TrackPlayerContext Responsibilities

- Lazy setup and readiness checks
- Queue load and playback start
- Repeat and shuffle management
- Position polling and persistence
- Volume sync with native device volume
- Progress save via `updateLastPosition`
- Play-count increment when a new active track becomes current

## Audio Player Screen

- Uses `useTrackPlayer()` for transport and queue state
- Reads library metadata from `usePlayer()`
- Redirects to the video player if the active track is actually a video-backed item
- Supports playback speed, repeat, shuffle, volume adjustment, favorites, add-to-playlist, and a sleep timer

## Handoff Rules

- Audio playback uses `PlayerManager.playAudio()` to stop any active video session before switching
- Video player background/handoff flows may route the active item into TrackPlayer when background play is enabled
- `services/playerSession.ts` is released during audio takeover to avoid native player conflicts

## Reliability Notes

- `playAudio` in `context/TrackPlayerContext.tsx` no longer throws when TrackPlayer setup loses the
  first race — it retries `ensureTrackPlayerSetup()` and skips the request gracefully rather than
  leaving playback dead, then confirms playback actually started (one retry via `getPlaybackState`).
- The video→audio background handoff (`app/player.tsx` AppState `background` and `handleClose`) passes
  the live position to `playAudio`, confirms audio is playing, and only then pauses the video — fixes
  the "background play sometimes doesn't play the same video" race.
- The Audio tab (`app/(tabs)/audio.tsx`) auto-triggers one device scan when its library is empty
  (covering a prior video-only scan), error-handles its paged loads, and relies on the DB-level
  `mediaType="audio"` filter (no client-side filter).

## Update When

- Change queue behavior, repeat/shuffle logic, or save cadence
- Change audio/video handoff ownership
- Change the full-screen audio player controls
- Change mini-player behavior or visibility rules
- Change TrackPlayer setup/readiness handling or the audio-tab load/scan behavior
