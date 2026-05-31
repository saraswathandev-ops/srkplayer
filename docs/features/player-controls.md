# Video Player Controls

- Status: canonical
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `components/VideoPlayerControls.tsx`, `components/player/*`, `app/player.tsx`, `app/player.constants.ts`
- Update when: gesture zones, controls, overlays, quick actions, or player-facing settings change
- Related docs: `docs/features/video-player.md`, `docs/features/playback-architecture.md`

## Covers

Gesture behavior, overlay controls, quick actions, settings-linked player controls, and HUD/UI behavior for the full-screen player.

## Main UI Pieces

- `components/VideoPlayerControls.tsx`: transport and overlay shell
- `components/player/TopControls.tsx`: navigation and menus
- `components/player/CenterControls.tsx`: play/pause, seek skip, lock
- `components/player/BottomControls.tsx`: seekbar, time, speed, fullscreen
- `components/player/Seekbar.tsx`: seek interaction surface
- `components/player/GestureHUD.tsx`: feedback for seek, volume, brightness
- `components/player/VerticalGestureBar.tsx`: side gesture feedback

## Interaction Areas

- Horizontal seek interactions
- Left/right side vertical gestures
- Tap and double-tap playback shortcuts
- Lock-state behavior
- Bottom-sheet controls for speed, audio tracks, and subtitles

## Update When

- Gesture zones or thresholds change
- Overlay composition changes
- HUD behavior changes
- A player setting changes what a control does
