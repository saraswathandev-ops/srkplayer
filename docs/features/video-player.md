# Video Player

- Status: canonical
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `app/player.tsx`, `app/player.*`, `hooks/player/*`, `components/player/*`, `components/VideoPlayerControls.tsx`, `services/playbackProgressService.ts`, `services/sessionStateService.ts`, `services/playerSession.ts`
- Update when: player gestures, resume, queue, overlays, startup, recovery, logging, session persistence, or helper-module boundaries change
- Related docs: `docs/features/playback-architecture.md`, `docs/features/player-controls.md`, `docs/features/audio-playback.md`, `docs/features/subtitles-and-online.md`

## Covers

The full-screen video player, its helper modules, session state, recovery model, and the player-specific UI surface.

## Entry and Helper Modules

- `app/player.tsx` is still the orchestrator.
- It delegates focused logic into helper files:
  - `app/player.constants.ts`
  - `app/player.types.ts`
  - `app/player.utils.ts`
  - `app/player.shim.ts`
  - `app/player.resolver.ts`
  - `app/player.stateMachine.ts`
  - `app/player.health.ts`
  - `app/player.logger.ts`
  - `app/player.startup.ts`
- Player lifecycle helpers in `hooks/player/*` cover controls, intent queueing, startup, playback state, native event adaptation, recovery, resume, and health monitoring.

## Runtime Responsibilities

- Resolve the active video and queue context
- Validate playback URI and keep generation-safe source state
- Start fresh playback or resume from saved state
- Persist stop-time progress and session patches
- Coordinate video/audio exclusivity through `services/PlayerManager.ts`
- Hand off to audio mode when background behavior requires it
- Manage decoder fallback and recovery escalation

## Session and Resume Model

- Resume position still uses `services/playbackProgressService.ts` for prompt/start-position logic.
- Rich per-video session state lives in `services/sessionStateService.ts`.
- Session state includes more than position:
  - audio track index
  - subtitle track id
  - playback rate
  - zoom scale
  - content-fit mode
  - brightness
  - volume
  - completion flag
- `services/playerSession.ts` manages the active native player session reference shared across video/audio transitions.

## UI Surface

- `components/VideoPlayerControls.tsx` owns the main control overlay and transport actions.
- `components/player/*` contains the smaller player UI building blocks:
  - top, center, and bottom controls
  - gesture HUDs
  - vertical gesture bars
  - seekbar
  - loading overlay
  - subtitle overlay
  - audio-track, subtitle, and speed bottom sheets

## Gesture and Control Boundaries

- Detailed gesture/control behavior belongs in `docs/features/player-controls.md`.
- State-machine, startup, logging, and recovery behavior belongs in `docs/features/playback-architecture.md`.
- This file is the feature-level map that tells an agent where each concern lives in code.

## Update When

- Change gesture zones or overlay behavior
- Change resume prompt or saved-position behavior
- Add, remove, or repurpose player helper modules
- Change startup/recovery/logging behavior in `app/player.*` or `hooks/player/*`
- Change session persistence fields or ownership
