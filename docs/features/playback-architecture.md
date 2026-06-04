# Playback Architecture

- Status: canonical
- Last updated: 2026-06-04 12:00 IST
- Source of truth: `app/player.tsx`, `app/player.*`, `hooks/player/*`, `services/playbackProgressService.ts`, `services/sessionStateService.ts`, `services/playbackDiagnostics.ts`, `services/playbackMetrics.ts`
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

- Resume prompt/start position is driven by `services/playbackProgressService.ts`. There is **no
  pre-playback Resume/Start-Over dialog** — startup auto-resumes (route param or DB lookup) and the
  only fresh-play affordance is the persistent **Start Over** pill in `VideoPlayerControls`. Do not
  re-introduce a pre-playback prompt (it has repeatedly regressed startup; see the warning comment
  in `app/player.tsx`).
- **Start Over is session-only (MX/VLC style).** `handleStartOver` restarts at 0 but does **not**
  permanently delete the saved resume point. A `startOverSessionRef` is raised; while it is set and
  the live position is below `MIN_RESUME_POSITION_SECONDS`, both save paths (periodic save in the
  polling loop and `saveProgressOnStop`) skip the DB write, so an early exit cannot wipe the old
  resume. Once the user watches past the threshold the flag clears and the periodic save overwrites
  the resume naturally. The flag is reset on video switch and on completion (covering loop-one /
  loop-all-single, which don't trigger a video-switch reset).
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
- **Recovery remounts preserve playback position.** Every path that bumps the `<Video>` remount key
  (`requestRecoveryRemount`, the Fast-path `simpleRecovery` tier-4 escalation, and the `onError`
  decoder-fallback remount) first calls `captureRemountResumePosition()`, which seeds
  `pendingResumeSeekRef` with the current live position (or keeps the original resume target if the
  startup seek hasn't been applied yet). The post-remount `onLoad` then re-seeks there, so a remount
  never restarts at 0. A genuine position-0 start is unaffected (the re-seek only fires when the
  pending value is `> 0`).
- Logging is session-aware so stale callbacks can be correlated with source generations, retries, and remount outcomes.

## Resume / Start-Over Verification Markers

These log events (visible via `services/playbackDiagnostics.ts`) make the resume contract checkable:

- `resume_position_resolved` — emitted once per startup from `setStartupIntent` with `{reason, requestedPosition, resolvedPosition}`. `resolvedPosition: 0` means fresh / start-over / near-end.
- `startup_seek_applied` (legacy) / `fast_resume_seek_applied` (Fast) — the authoritative startup resume seek. **Expect one per source load.** A recovery remount is a *new* load, so a remount-during-resume legitimately yields a second `fast_resume_seek_applied`; it is distinguished from a duplicate by the `resume_position_restored` line that accompanies it.
- `recovery_remount_requested` → `recovery_remount_completed` → `resume_position_restored` — the remount lifecycle; the restore seek re-applies the preserved position (never 0).
- `start_over_selected` — Start Over tapped; `resume_preserved` — an early (< `MIN_RESUME_POSITION_SECONDS`) exit during a start-over session that intentionally skipped the DB write so the old resume survives.
- `progress_saved` (every periodic write) / `resume_updated` (write at/above the resume threshold).
- `playback_completed` → `resume_cleared` — completion cleanup; fires for natural end, loop-one, and next-video autoplay.

## Stability / Recovery Hardening (additive — does not replace the state machine)

- **Resume integrity (Req 1).** `lastKnownGoodPositionRef` is snapshotted on every forward-progress
  tick (the definitive healthy signal). A recovery remount resolves its restore position through the
  chain `pendingResumeSeek (startup, unapplied) → live position → lastKnownGood → 0`, logged as
  `resume_restore_source={startup_resume|remount_capture|last_known_good|fresh_zero}`. Startup resume
  always wins over runtime snapshots; a remount can never silently land on 0 when playback had a position.
- **Seek deduplication (Req 3).** `resumeSeekAppliedRef` flips true when the authoritative startup
  resume seek lands (`fast_resume_seek_applied` / `startup_seek_applied`). The fast-start
  stabilization nudge checks it and emits `startup_nudge_skipped_resume_seek` instead of a second
  seek — one authoritative seek per source lifecycle.
- **Recovery escalation window (Req 2).** `recoveryHistoryRef` keeps a rolling 30s window of attempts;
  `recordRecoveryAttempt` reports the count, and `performClassifiedRecovery` bumps the chosen action a
  tier (`play_reassert→seek_nudge→video_remount`) when ≥3 land in the window, logging
  `recovery_escalated {recovery_window_count, recovery_window_ms}`. Breaks infinite tier-1 loops on top
  of the existing class-based ladder.
- **Source-generation protection (Req 4).** `sourceGenerationRef` + `isCurrentGeneration` already
  gate stale callbacks; the fast-start nudge timer and the tier-3 source-reload timer now also verify
  the generation and emit `stale_generation_ignored` on mismatch.
- **Surface lifecycle diagnostics (Req 5, diagnostics-only).** `surface_created` / `surface_recreated`
  (with `surface_type`), `player_remount`, `source_reload`, and `video_component_mount` /
  `video_component_unmount` let a reader attribute `surface_lost` to RN re-render vs player remount vs
  surface recreation vs source reload.
- **Startup metrics (Req 6).** `services/playbackMetrics.ts` keeps the last 50 startup sessions and
  computes per-phase averages (`navigation_to_source`, `source_to_loadstart`, `loadstart_to_onload`,
  `onload_to_first_progress`, `first_progress_to_stable`, `total_startup_ms`). Recorded in
  `confirmStartupPlayback` (also logged inline as `startup_durations`); the averages are appended to the
  diagnostics file.
- **Persistence triggers (Req 7).** Each resume write is tagged `resume_saved_pause` /
  `resume_saved_background` / `resume_saved_pip` / `resume_saved_periodic` (priority pause > background
  > pip > periodic). Completion-clearing behavior is unchanged.
- **Recovery black box (Req 8).** `app/player.logger.ts` keeps a 100-event ring buffer fed at the single
  `emit()` chokepoint. `stopPlaybackDiagnostics` appends it (plus the metrics averages) to the
  diagnostics file, and `dumpBlackBox(reason)` writes a standalone `playback_blackbox_<ts>.txt` on a
  fatal recovery (`blackbox_dump_created`).

## Known SQL persistence risks (pre-existing — see deliverables)

The resume layer uses three stores that are not all written atomically: `PlaybackProgress` (resume
source of truth, transactional with `Videos` columns in `savePlaybackProgress`), `VideoSessions` +
denormalized `Videos.progress_*` (written separately in `saveSessionState`), and the in-memory session
cache. A process death between the `updateLastPosition` and `saveSessionState` writes can leave the
stores momentarily disagreeing; resume still reads `PlaybackProgress`/cache so playback is unaffected,
but the library progress bar may briefly lag. Not changed here (would touch the write architecture).

## Update When

- Startup phases change
- Resume/save ownership changes
- Recovery tiers or logging semantics change
- Helper responsibilities move between `app/player.*` and `hooks/player/*`
