# Playback Architecture

This document explains the current SKR Player playback path: the native stack in use, the in-memory shim, the fresh-vs-resume decision, progress persistence, and recovery behavior.

## 1. Stack

- The app uses `react-native-video`. `package.json` declares `^6.4.4`; `package-lock.json` resolves it to `6.19.1`.
- The app runs on `react-native` `0.73.11` through the React Native CLI. It is not an Expo app.
- Android playback is backed by ExoPlayer through `react-native-video`. iOS would use AVPlayer, but this repo currently ships Android.
- Android uses `ViewType.SURFACE` by default. `decoderViewType` in `app/player.tsx` switches to `ViewType.TEXTURE` only for decoder mode `hw`.
- Buffering is configured in `app/player.constants.ts`. `VIDEO_BUFFER_CONFIG` is the network/default profile; local playback can use a smaller local profile when enabled by the player screen.
- `react-native-track-player` is used for audio-mode and background audio handoff only. Normal video playback stays in `react-native-video`.

## 2. Shim Layer

`app/player.shim.ts` wraps the raw `VideoRef` from `react-native-video` as a `VideoPlayerShim`. The player screen talks to this shim with a stable API:

- `play()` and `pause()`
- `currentTime = seconds`
- `replaceAsync(uri)`
- local state such as `currentTime`, `duration`, `playing`, `loop`, `playbackRate`, `volume`, and `muted`

The shim is the in-memory representation of the active player. Native progress events keep it synchronized through private setters such as `_setCurrentTime` and `_setDuration`. The player screen also stores the authoritative latest snapshot in `latestPlaybackRef`.

## 2.1 Internal Helper Modules

`PlayerScreen` remains the orchestrator, but playback-specific logic is split into focused helpers:

- `app/player.logger.ts` creates playback session ids and formats session-aware playback, native, video, recovery, and stop logs.
- `app/player.resolver.ts` resolves the active video, queue, current index, previous/next items, and playback URI without changing the existing lookup order.
- `app/player.stateMachine.ts` wraps `playbackPhaseRef` transitions with validation and structured transition logs.
- `app/player.health.ts` evaluates the current health snapshot, classifies native playback failures, and names recovery tiers.
- `app/player.startup.ts` owns startup stabilization thresholds, near-end resume fallback, and startup metrics formatting.

These helpers are intentionally thin. They make the current flow easier to inspect without replacing the existing refs, state, callbacks, or 250 ms monitoring loop.

## 3. State Machine

The playback state type is declared in `app/player.types.ts`. `PlaybackPhase` remains as a compatibility alias while the screen migrates:

```ts
export type PlaybackState =
  | "idle"
  | "resolving"
  | "validating"
  | "loading"
  | "starting"
  | "stabilizing"
  | "playing"
  | "buffering"
  | "seeking"
  | "recovering"
  | "paused"
  | "ended"
  | "error";
```

The intended flow is:

```text
idle -> validating -> loading -> starting -> stabilizing -> playing
                                                   -> buffering -> starting/stabilizing
                                                   -> seeking
                                                   -> recovering
                                                   -> paused
                                                   -> ended
                                                   -> error
```

Important transitions:

- `startPlaybackUnified` sets `loading` while a new source is being prepared.
- `handleVideoLoad` promotes `loading` or `idle` to `starting` once the source has loaded, applies the pending seek, waits a short generation-guarded settle delay, then issues one native `play()`.
- `onPlaybackStateChanged({ isPlaying: true })` promotes startup states to `stabilizing`, not `playing`.
- `handleVideoProgress` promotes `stabilizing` to `playing` only after playback is stable: current time has advanced by more than 1.5 seconds from the stabilization start, or the stabilization window has lasted at least 1.5 seconds with continuing progress.
- `onPlaybackStateChanged({ isPlaying: false })` during `starting` or `stabilizing` is classified as a startup interruption and routed through startup recovery.
- `onBuffer` moves `playing` or `stabilizing` to `buffering`, then back to `playing` only if startup was already confirmed; otherwise it returns to `starting`.
- `handlePlayPause` moves user pauses to `paused`, and user resumes to `starting`.
- `escalateRecovery` moves active playback to `recovering`.
- `onError` moves to `error` after decoder fallback is exhausted.
- `onEnd` moves to `ended`.

Phase writes should go through `transitionPlaybackPhase(...)` from `app/player.stateMachine.ts` via the local `setPlaybackPhase(...)` wrapper in `PlayerScreen`. Direct `playbackPhaseRef.current = ...` writes are reserved for the wrapper itself.

## 4. Fresh vs Resume Flow

1. A list screen opens playback with `navigation.navigate("player", { id, folder })`.
2. `PlayerScreen` mounts and reads route params into `activeVideoId`.
3. The active `video` is resolved from route/current/stored/pending/queue state.
4. URI validation commits `validatedPlaybackUri` optimistically so the source does not briefly flip to null while `RNFS.exists` checks local files.
5. The init effect runs once per `videoId`, guarded by `initPlaybackForVideoIdRef`.
6. If the route provided an explicit `startPosition > 1`, that position wins.
7. Otherwise, when `settings.rememberPosition` is enabled, `getPlaybackProgress(videoId)` is queried with a timeout. A non-completed row with `positionSeconds > 1` resumes from that saved position.
8. If neither branch applies, playback starts fresh at `0`.
9. `startPlaybackUnified` records the desired start position and pending play intent. It does not call `seek()` or `play()` before `onLoad`.
10. `<Video>` fires `onLoad`; `handleVideoLoad` resolves the final start position, including the saved-position minus 5 seconds rule and the near-end fallback to `0`.
11. `handleVideoLoad` applies the seek after load, waits a short generation-guarded settle delay, then consumes `pendingPlayAfterLoadRef` and calls `play()` exactly once for the startup handoff.
12. The first native playing ack enters `stabilizing`.
13. Progress confirms stable startup and transitions to `playing`.

Every source lifecycle has a generation token. `sourceGenerationRef` increments when the active video changes and when recovery remounts the native `<Video>`. Async URI checks, resume DB lookups, deferred seek/play callbacks, and recovery timers capture the generation they started with and ignore stale callbacks after navigation or remount.

## 5. Save Flow

Progress persistence is centralized around explicit stop paths in the current checkout.

- During playback, `handleVideoProgress` updates in-memory position state and `latestPlaybackRef`; it does not currently write progress to storage.
- Stop paths call `saveProgressOnStop(reason)`, which logs the reason and current snapshot, then persists immediately when remember-position is enabled.
- Natural completion calls `saveProgressOnStop("video_completed_naturally")`, then clears saved resume progress with `clearPlaybackProgress(videoId)`.
- `services/playbackProgressService.ts` persists only when `positionSeconds >= MIN_RESUME_POSITION_SECONDS` and progress is below `COMPLETED_PLAYBACK_THRESHOLD`. Otherwise it deletes the resume row.

## 6. Recovery Model

- Startup watchdog: `armStartupWatchdog` waits for startup confirmation, retries native `play()` once, then hands control to the health model.
- Health predicate: `isPlaybackHealthy` accepts any recent healthy signal, including startup grace, recent progress, buffering, recent recovery, or recent native playing ack.
- Stall escalation: `escalateRecovery` reasserts `play()` with cooldowns. After startup grace it may follow with a small seek nudge.
- Startup recovery: `runStartupRecovery` handles false starts before stable playback. Tier 1 reasserts play, tier 2 performs a small seek nudge, tier 3 reloads the same source, and tier 4 remounts the native `<Video>`.
- Failure classification: native `isPlaying:false` is labeled as `buffering`, `decoder_stall`, `surface_lost`, `audio_focus_loss`, `unexpected_pause`, `startup_timeout`, `native_reset`, or `unknown` before recovery decisions are made.
- Decoder fallback: `onError` tries decoder modes in order before surfacing a fatal playback error.
- TrackPlayer handoff: when background play is enabled and the app backgrounds, the active item is handed to TrackPlayer and `audioHandoffInProgressRef` prevents recovery from fighting the transition.

Recovery logs use tier labels:

- Tier 1: `play_reassert`
- Tier 2: `seek_nudge`
- Tier 3: `source_reload`
- Tier 4: `video_remount`

The thresholds and behavior remain unchanged; the tier labels are for debugging and future analytics.

## 6.1 Log Format

Playback logs include session metadata:

```text
[Playback][session=<id>][video=<videoId>][state=<state>][gen=<generation>][startupAttempt=<n>][recoveryTier=<n>] event_name
```

Native, video, recovery, and stop logs use the same context. A normal open keeps one session id; recovery reloads/remounts increment the source generation so stale callback logs can be correlated with the reload. Startup success emits `startup_metrics` with startup duration, stabilization duration, recovery count, rebuffer count, stall count, and success status.

## 7. Key Files

| File | Role |
| --- | --- |
| `app/player.tsx` | Main playback screen, native video integration, state machine, resume, progress, gestures, recovery, and UI wiring. |
| `app/player.shim.ts` | Wraps `react-native-video` refs behind the `VideoPlayerShim` API. |
| `app/player.constants.ts` | Playback constants, buffer config, gesture constants, and recovery timing. |
| `app/player.styles.ts` | Player screen styles. |
| `app/player.types.ts` | Player-specific TypeScript types, including `PlaybackState`, startup metrics, failure reasons, and `PlayerAudioTrack`. |
| `app/player.startup.ts` | Startup stabilization, resume-position fallback, and startup metrics helpers. |
| `app/player.utils.ts` | URI, clipping, duration, audio, decoder, gesture, and formatting helpers. |
| `components/VideoPlayerControls.tsx` | Main overlay controls for transport, seek, quick actions, lock, and Start Over. |
| `components/player/` | Smaller player UI components such as bottom sheets, gesture bars, seekbar, subtitle overlay, and loading UI. |
| `services/playbackProgressService.ts` | Persistent resume-position storage and completion threshold logic. |
| `services/playerSession.ts` | Shared active player session lifecycle. |
| `services/PlayerManager.ts` | Higher-level player state manager used by audio/background flows. |
| `src/navigation/RootNavigator.tsx` | React Navigation stack registration for player and related screens. |
