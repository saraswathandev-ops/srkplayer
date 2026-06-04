# Video Player

- Status: canonical
- Last updated: 2026-06-04 00:00 IST
- Source of truth: `app/player.tsx`, `app/player.*`, `app/playerFeatureConfig.ts`, `hooks/player/*`, `components/player/*`, `components/VideoPlayerControls.tsx`, `services/playbackProgressService.ts`, `services/sessionStateService.ts`, `services/playerSession.ts`
- Update when: player gestures, resume, queue, overlays, startup, recovery, logging, session persistence, player feature gating, or helper-module boundaries change
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
- Apply a derived feature matrix from persisted player settings before enabling gestures, overlays, quick actions, or tool panels

## Recovery and Freeze Handling

- `app/player.health.ts` now owns the shared playback-health snapshot and failure classification.
- The player distinguishes:
  - `surface_lost`
  - `decoder_stall`
  - `js_starvation`
  - expected non-failure states such as buffering/background pause
- Startup phases (`loading`, `starting`, `stabilizing`) route through startup recovery instead of the steady-state stall path.
- Steady-state stalls use class-based escalation instead of repeated blind `play()` retries:
  - one soft reassert for first-pass recovery
  - seek nudge for unresolved decoder stalls
  - earlier remounts for repeated `surface_lost`
- Recovery counters reset on real forward progress, not merely on native callback noise.

## Settings-Driven Feature Matrix

- `app/playerFeatureConfig.ts` derives the effective player capability map from `PlayerSettings`.
- `app/player.tsx` uses that config to decide whether the session may activate:
  - subtitle defaults and sync controls
  - lock mode
  - long-press speed
  - pinch zoom
  - screenshot actions
  - night mode
  - volume boost
  - trim
  - decoder switching
  - orientation controls
  - up-next autoplay
  - discovery hints
  - sleep timer entry points
- `components/VideoPlayerControls.tsx` uses the same config so the visible quick actions match the runtime behavior gates.
- This means player settings now control both what the user sees and what the screen will execute.

## Session and Resume Model

- Resume position still uses `services/playbackProgressService.ts` for prompt/start-position logic.
- Position is persisted on three triggers, not just at stop:
  - **Periodically during playback** — the 250ms polling loop in `app/player.tsx` writes
    position every `PERIODIC_SAVE_INTERVAL_MS` (5s) while playing and the position has moved
    ≥1s, so a crash or OS-kill no longer loses progress since the last manual stop. The
    15s-minimum / 95%-complete resume thresholds in `savePlaybackProgress` still apply.
  - **Flushed before navigation** — `saveProgressOnStop` returns a promise; `handleClose` and
    the polling end-detection path use `saveProgressThenLeave` to await the DB writes (raced
    against a 400ms timeout) before `navigation.goBack()`, so a quick close can't drop the write.
    The app-background (no-bg-play) handler awaits the save for the same reason.
- Resume rewind is no longer a fixed 5s: `computeResumeRewindSeconds(ageMs)` in
  `services/playbackProgressService.ts` scales the rewind by how long ago the video was watched
  (3s if <1 min, 7s if <1 hr, 12s otherwise). The near-end (`>= duration-10` → restart at 0) guard
  is unchanged.
- The Fast startup path applies the resume seek authoritatively inside `handleVideoLoadFast` via
  `pendingResumeSeekRef` (the eager seek in `startPlaybackFast` is a no-op when `onLoad` hasn't
  fired yet), fixing cold-start resumes that previously began at 0.
- **Recovery remounts re-seek to the current position.** Before every `<Video>` remount-key bump,
  `captureRemountResumePosition()` seeds `pendingResumeSeekRef` with the live position (or keeps the
  un-applied startup resume target), so a recovery/decoder-fallback remount during playback resumes
  where it was instead of restarting at 0.
- **Start Over is session-only (MX/VLC style).** The Start Over pill restarts at 0 but does not
  permanently delete the saved resume. A `startOverSessionRef` suppresses both save paths while the
  position is below `MIN_RESUME_POSITION_SECONDS`, so exiting early keeps the old resume for next
  launch; watching past the threshold overwrites it normally. The flag clears on video switch and on
  completion.
- The user's last-chosen audio track is restored on load from the session's `audioTrackIndex` (when
  that index still exists in the track list) in both `handleVideoLoad` and the Fast path's
  `handleAudioTracksUpdate`; otherwise it falls back to the native/first track.
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
- Session restore must still respect the active feature config; disabled features should not re-activate just because a prior session saved them.
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

## Settings, Resume Toggle, and Performance

- Resume is gated by `PlayerSettings.rememberPosition` (exposed as the "Resume Playback" toggle in
  Settings → Playback & Gestures). When off, the player always starts fresh.
- Quick-action control layout (order + visibility) is user-customizable and persisted; see
  `docs/features/player-controls.md`.
- Performance: the 250ms polling loop in `app/player.tsx` throttles its UI state updates to
  whole-second granularity (and only on change), so the screen re-renders ~1×/sec instead of 4×/sec;
  `components/VideoPlayerControls.tsx` is `React.memo`-wrapped; the subtitle overlay's per-tick
  `setTime` is skipped unless a subtitle track is enabled or a generation job is active.
- The polling loop depends only on `[player]` and reads everything else from a `pollStateRef`
  snapshot, so it is not rebuilt on every render. `validatedPlaybackUri` is seeded synchronously
  from the route param so the native source mounts on the first render. `components/player/VerticalGestureBar.tsx`
  is `React.memo`-wrapped and holds its `value`/`onChange` in refs so the brightness/volume Pan
  gesture is built once and does not rebuild mid-drag. See `docs/features/playback-architecture.md`.
- A 5-minute playback diagnostics recorder (`services/playbackDiagnostics.ts`) captures the player
  log stream once a video opens; see `docs/features/playback-architecture.md`.

## Gesture and Control Boundaries

- Detailed gesture/control behavior belongs in `docs/features/player-controls.md`.
- State-machine, startup, logging, and recovery behavior belongs in `docs/features/playback-architecture.md`.
- Subtitle generation support, subtitle tracks, and online-content integrations belong in `docs/features/subtitles-and-online.md`.
- This file is the feature-level map that tells an agent where each concern lives in code.

## Update When

- Change gesture zones or overlay behavior
- Change resume prompt or saved-position behavior
- Add, remove, or repurpose player helper modules
- Change startup/recovery/logging behavior in `app/player.*` or `hooks/player/*`
- Change session persistence fields or ownership
- Change `PlayerSettings` fields that affect player capability availability or defaults
