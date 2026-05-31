# Playback Architecture

- Status: canonical
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `app/player.tsx`, `app/player.*`, `hooks/player/*`, `services/playbackProgressService.ts`, `services/sessionStateService.ts`
- Update when: playback state-machine flow, startup stabilization, resume/save behavior, recovery tiers, or logging semantics change
- Related docs: `docs/features/video-player.md`, `docs/features/player-controls.md`

## Stack

- Video playback uses `react-native-video`.
- Audio/background playback uses `react-native-track-player` only when the app hands off into audio mode.
- `app/player.shim.ts` wraps the native video ref behind a stable player-facing API.

## Module Boundaries

- `app/player.tsx`: main orchestrator
- `app/player.resolver.ts`: active video and queue resolution
- `app/player.stateMachine.ts`: playback phase transitions
- `app/player.health.ts`: health checks and recovery classification
- `app/player.logger.ts`: playback/session-aware logging
- `app/player.startup.ts`: startup timing and seek-start logic
- `hooks/player/*`: startup, resume, playback lifecycle, native-event adaptation, controls, and recovery helpers

## Playback Flow

1. Resolve active route video and queue context.
2. Validate the playback URI.
3. Decide fresh start vs resume.
4. Load the source and apply any startup seek.
5. Move through startup and stabilization states before treating playback as healthy.
6. Persist progress/session state on the relevant save paths.

## Resume and Session State

- Resume prompt/start position is driven by `services/playbackProgressService.ts`.
- Rich per-video session state is persisted by `services/sessionStateService.ts`.
- Session state tracks additional playback preferences and restoreable state beyond position.

## Recovery Model

- Startup issues are handled separately from post-start stalls.
- Recovery escalates from lighter actions to heavier actions.
- Logging is session-aware so stale callbacks can be correlated with source generations and retries.

## Update When

- Startup phases change
- Resume/save ownership changes
- Recovery tiers or logging semantics change
- Helper responsibilities move between `app/player.*` and `hooks/player/*`
