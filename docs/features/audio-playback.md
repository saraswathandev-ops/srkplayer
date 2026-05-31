# Audio Playback

- Status: canonical
- Last updated: 2026-05-31 18:45 IST
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

## Update When

- Change queue behavior, repeat/shuffle logic, or save cadence
- Change audio/video handoff ownership
- Change the full-screen audio player controls
- Change mini-player behavior or visibility rules
