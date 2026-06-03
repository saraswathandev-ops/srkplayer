# Playback Architecture

- Status: canonical
- Last updated: 2026-06-03 00:00 IST
- Source of truth: `app/player.tsx`, `app/player.*`, `hooks/player/*`, `services/playbackProgressService.ts`, `services/sessionStateService.ts`, `services/playbackDiagnostics.ts`
- Update when: playback state-machine flow, startup stabilization, resume/save behavior, recovery tiers, logging semantics, or playback diagnostics recording change
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
- `app/player.logger.ts`: playback/session-aware logging. Exposes `setDiagnosticsSink(fn)` — every
  log line is mirrored to the sink (in addition to `console.log`) when one is registered.
- `app/player.startup.ts`: startup timing and seek-start logic
- `services/playbackDiagnostics.ts`: 5-minute playback diagnostics recorder. `startPlaybackDiagnostics`
  registers the logger sink and buffers lines; after 5 minutes (or on `stopPlaybackDiagnostics`) it
  flushes to `playback_diagnostics_<ts>.txt` in the app document dir (RNFS, mirroring
  `services/crashManager.ts`). `app/player.tsx` starts it once per video session; Settings →
  Diagnostics → "Playback Diagnostics" views/clears the latest file.
- `hooks/player/*`: startup, resume, playback lifecycle, native-event adaptation, controls, and recovery helpers

## Playback Flow

1. Resolve active route video and queue context.
2. Validate the playback URI.
3. Decide fresh start vs resume.
4. Load the source and apply any startup seek.
5. Move through startup and stabilization states before treating playback as healthy.
6. Persist progress/session state on the relevant save paths.

## Performance Notes (JS-thread hot path)

- `validatedPlaybackUri` is seeded synchronously from the route `playbackUri` via a lazy `useState` initializer in `app/player.tsx`, so the native `<Video>` mounts with its source on the first render instead of after a render+effect round-trip. The URI-validation effect still owns later URI changes (audio handoff, recovery remount, missing-path errors); its `setValidatedPlaybackUri` no-ops on mount because the value already matches.
- The 250ms progress/health polling loop depends only on `[player]`. Every volatile value and callback its body needs is read from a single `pollStateRef` snapshot (refreshed each commit) instead of being closed over, so the interval is created once per player instance rather than torn down and rebuilt on every render. When editing the loop, keep new reads going through `pollStateRef`, not the dependency array.
- `setPosition` in the loop is already throttled to whole-second granularity; do not add per-tick state writes that re-render the player tree.

## Resume and Session State

- Resume prompt/start position is driven by `services/playbackProgressService.ts`.
- Rich per-video session state is persisted by `services/sessionStateService.ts`.
- Session state tracks additional playback preferences and restoreable state beyond position.

## Recovery Model

- Startup issues are handled separately from post-start stalls.
- `app/player.health.ts` builds a richer snapshot from progress age, native-ack age, buffering age, recent ready/display state, app background state, and audio-handoff state.
- Failure classes now separate `surface_lost`, `decoder_stall`, `js_starvation`, and expected pauses.
- `surface_lost` is only classified when the surface had **already attached this session** — the
  snapshot carries `hadReadyForDisplay` (true once `onReadyForDisplay` has fired for the current
  source generation; `lastReadyTimestampRef` resets to 0 on video switch). During startup *before*
  the first `onReadyForDisplay`, a missing surface/native-playing signal is classified as
  `buffering` (which startup recovery suppresses), not `surface_lost`. This prevents the
  false-positive startup `surface_lost → source_reload/remount → loadStart` loop. `runStartupRecovery`
  also refuses to escalate a `surface_lost` beyond `play_reassert` unless the surface had attached.
- `js_starvation` is log-only; it should not trigger remount or seek-based recovery.
- Startup recovery stays in the startup ladder; steady-state recovery uses class-based escalation.
- Repeated `surface_lost` events are remembered in-session so remount happens sooner instead of looping on `play()`.
- Logging is session-aware so stale callbacks can be correlated with source generations, retries, and remount outcomes.

## Update When

- Startup phases change
- Resume/save ownership changes
- Recovery tiers or logging semantics change
- Helper responsibilities move between `app/player.*` and `hooks/player/*`
