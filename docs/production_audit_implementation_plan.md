# SRK Player - Production Audit Implementation Plan

**Created:** 2026-04-28  
**Purpose:** Turn the current player audit into confirmed implementation work. This plan focuses on crash prevention first, then performance, then UX upgrades.

---

## Current Verdict

SRK Player is close to a production-grade MX-style player, but several areas still need stricter enforcement before feature work should continue:

- The database documentation and installed SQLite engine do not match.
- Audio/video coordination exists through `PlayerManager`, but every playback entry point must use it.
- TrackPlayer and video async flows still need stale-request guards everywhere.
- Brightness restore must not rely only on component unmount.
- Crash-loop recovery currently risks unnecessary data loss.
- Large media libraries need paginated loading and slower background work.

---

## Priority 0 - Confirm Before Coding

| Decision | Recommended Choice | Why |
|---|---|---|
| SQLite engine | `react-native-sqlite-storage` | Current app is bare/native React Native and already depends on native modules. Avoid Expo-only assumptions. |
| Playback authority | Keep `PlayerManager`, then enforce it everywhere | Lowest-risk change because the service already exists. |
| Crash-loop reset policy | Escalating recovery | Preserves user library for UI-only crash loops. |
| Library loading model | Paginated reads | Required for 5k-10k video libraries. |
| Feature order | Stability first, UX second | Prevents new UX work from building on unstable playback state. |

**Confirmation checklist**

- [ ] Confirm the app will use only `react-native-sqlite-storage`.
- [ ] Confirm no Expo SQLite API should remain in docs or code.
- [ ] Confirm crash-loop recovery should reset settings first, then DB only after repeated failures.
- [ ] Confirm seek preview and next-video popup are lower priority than stability fixes.

---

## Phase 1 - Critical Crash Fixes

### 1. SQLite Engine Mismatch

**Problem**

Docs say the database engine is `expo-sqlite`, but dependencies use `react-native-sqlite-storage`.

**Risk**

- Wrong API expectations.
- Wrong transaction assumptions.
- Future migrations may be written for the wrong engine.
- Debugging database failures becomes misleading.

**Implementation**

- Update docs to say `react-native-sqlite-storage`.
- Audit `services/database.ts` for Expo-style method names or comments.
- Keep one database wrapper API in `services/database.ts`.
- Add a short note that WAL/transaction behavior is controlled by the native SQLite wrapper.

**Advantage**

- One clear DB contract.
- Easier migrations.
- Lower corruption/debugging risk.

**Disadvantage**

- Expo SQLite examples cannot be copied directly.
- Tests and docs must follow the native wrapper shape.

**Done when**

- [ ] No docs say the active engine is `expo-sqlite`.
- [ ] `services/database.ts` exports one consistent DB API.
- [ ] Typecheck passes.

---

### 2. Enforce PlayerManager Everywhere

**Problem**

`PlayerManager` exists but must be mandatory before any audio or video playback starts.

**Risk**

- Audio and video can play at the same time.
- TrackPlayer and ExoPlayer can stay alive together.
- Fast navigation can leak playback resources.

**Implementation**

- In `app/player.tsx`, call `PlayerManager.playVideo()` before video playback starts.
- Register a video stop handler on mount and clear it on unmount.
- In `context/TrackPlayerContext.tsx`, call `PlayerManager.playAudio()` before resetting/loading TrackPlayer.
- Use `PlayerManager.stopAll()` for explicit stop/exit flows.
- Check deep links, restore flows, and queue actions for direct playback calls.

**Advantage**

- Single rule for playback ownership.
- Prevents audio/video overlap.
- Reduces memory leaks and background playback conflicts.

**Disadvantage**

- Every playback path must follow the same service contract.
- A bad stop handler can pause the wrong video unless it is scoped by session.

**Done when**

- [ ] No playback path starts media without `PlayerManager`.
- [ ] Video to audio handoff stops video first.
- [ ] Audio to video handoff resets TrackPlayer first.
- [ ] Manual test: start audio, open video, only video plays.
- [ ] Manual test: start video, open audio, only audio plays.

---

### 3. TrackPlayer Request ID Guard

**Problem**

`playInFlightRef` blocks concurrent starts, but it does not fully protect against stale async resolution when users tap different tracks quickly.

**Risk**

- First request can finish after the second request.
- Queue metadata can become stale.
- Wrong active track may appear in mini-player or notification.

**Implementation**

Use a monotonic request ID:

```typescript
const requestIdRef = useRef(0);

async function playAudio(videos, startIndex = 0) {
  const requestId = ++requestIdRef.current;

  await PlayerManager.playAudio();
  await TrackPlayer.reset();

  if (requestId !== requestIdRef.current) return;

  await TrackPlayer.add(queue);

  if (requestId !== requestIdRef.current) return;

  await TrackPlayer.skip(startIndex);
  await TrackPlayer.play();
}
```

**Advantage**

- Stale audio requests become harmless.
- Queue state follows the newest user action.

**Disadvantage**

- Requires careful cleanup so ignored requests do not leave loading state stuck.

**Done when**

- [ ] `playAudio()` ignores stale requests after every awaited step.
- [ ] Fast tapping different tracks keeps only the latest queue.
- [ ] Typecheck passes.

---

### 4. Video Session Guard Coverage

**Problem**

`sessionIdRef` exists, but every async video operation must check it before applying state.

**Risk**

- Old thumbnail generation can update the wrong item.
- Old source replacement can overwrite the current video.
- Fast navigation can show stale frames or wrong metadata.

**Implementation**

- Capture `const session = ++sessionIdRef.current` at video load start.
- Check `if (sessionIdRef.current !== session) return` after every awaited call.
- Apply this pattern to file checks, source replacement, thumbnail generation, metadata loading, queue changes, and background handoff setup.

**Advantage**

- Fast video switching becomes predictable.
- Stale async callbacks cannot mutate current playback state.

**Disadvantage**

- Slightly more boilerplate in `player.tsx`.
- Missing one await point can still leave a stale path.

**Done when**

- [ ] All async video source operations are guarded.
- [ ] Fast next/previous tapping does not show old source or metadata.
- [ ] Typecheck passes.

---

### 5. Brightness Restore on Background and Navigation

**Problem**

Brightness restore currently depends on unmount. If Android kills the app in background, unmount may not run.

**Risk**

- User brightness can stay modified after leaving the player.

**Implementation**

- Restore brightness on `AppState` transition to `background`.
- Restore brightness on navigation `beforeRemove`.
- Keep unmount restore as final fallback.
- Guard restore so it runs once per player session.

**Advantage**

- Better user trust.
- Covers normal navigation, backgrounding, and most kill scenarios.

**Disadvantage**

- Background play must not restore too early if the player intentionally continues audio only.
- Needs testing with orientation and lock mode.

**Done when**

- [ ] Back navigation restores brightness.
- [ ] App background restores brightness.
- [ ] Unmount still restores brightness.
- [ ] Restore is idempotent.

---

### 6. Gesture and Slider Lock

**Problem**

`PanResponder` and seek slider can both handle touches.

**Risk**

- Gesture can steal touches while scrubbing.
- Seek can flicker or jump.

**Implementation**

- Add `isScrubbingRef`.
- Set it true when slider drag starts.
- Set it false on release/cancel.
- In gesture start/move handlers, return false or ignore if scrubbing.

**Advantage**

- Cleaner seek behavior.
- Fewer accidental volume/brightness changes during scrub.

**Disadvantage**

- Must ensure lock is cleared on cancellation.

**Done when**

- [ ] Slider drag never triggers brightness/volume/seek gestures.
- [ ] Gesture works normally after slider release.

---

### 7. Crash Loop Recovery Without Immediate Data Wipe

**Problem**

Current crash loop recovery resets DB and AsyncStorage after 3 crashes.

**Risk**

- User loses library/settings for a UI-only or temporary crash.

**Implementation**

Escalating policy:

| Crash Count | Action |
|---|---|
| 3 | Reset volatile startup flags and risky settings only |
| 4 | Disable optional heavy startup work: thumbnail backfill, auto scan |
| 5 | Offer user-visible DB reset prompt |
| Manual only | Full `AsyncStorage.clear()` and DB reset |

**Advantage**

- Prevents unnecessary data loss.
- Still breaks real crash loops.

**Disadvantage**

- More state paths to test.
- Some crash loops may require one extra launch before full recovery.

**Done when**

- [ ] Automatic recovery does not wipe library at 3 crashes.
- [ ] Full reset is user-confirmed or last-resort.
- [ ] Crash log records which recovery level ran.

---

## Phase 2 - Performance Fixes

### 8. Paginate Video Library

**Problem**

`PlayerContext` hydrates all videos into memory.

**Risk**

- Slow launch.
- Memory spike for 5k-10k videos.
- Search and tabs re-render too much state.

**Implementation**

- Add DB methods with `LIMIT` and `OFFSET`.
- Use paginated loading in Library and Search screens.
- Keep lightweight derived lists for home screen only.
- Avoid passing giant arrays through context when screen-local pagination is enough.

**Advantage**

- Faster startup.
- Lower memory use.
- Better large-library behavior.

**Disadvantage**

- More complex screen state.
- Some existing filters must move into SQL.

**Done when**

- [ ] Library screen loads pages.
- [ ] Search screen loads pages.
- [ ] Home screen does not require full library hydration.

---

### 9. Batch Thumbnail Backfill

**Problem**

Thumbnail backfill starts after 2 seconds and can process too much work at once.

**Risk**

- CPU and IO burst during app open.
- UI jank.
- Battery drain.

**Implementation**

- Create a thumbnail queue.
- Process 3-5 videos per second.
- Pause queue when app backgrounds.
- Stop queue if active playback starts.

**Advantage**

- Smoother app launch.
- Less thermal and battery pressure.

**Disadvantage**

- Thumbnails appear gradually.
- Requires retry/failure tracking.

**Done when**

- [ ] Backfill is rate-limited.
- [ ] Queue pauses on background.
- [ ] Playback is not affected by thumbnail work.

---

### 10. Volume Delta Filtering

**Problem**

Volume native calls are throttled, but the JS bridge can still receive too many tiny updates.

**Risk**

- Unnecessary bridge traffic.
- Jank during volume gestures.

**Implementation**

Only call native volume set when the change is meaningful:

```typescript
if (Math.abs(nextVolume - lastNativeVolumeRef.current) > 0.01) {
  lastNativeVolumeRef.current = nextVolume;
  VolumeManager.setVolume(nextVolume, { showUI: false });
}
```

**Advantage**

- Less bridge pressure.
- Same perceived UX.

**Disadvantage**

- Very tiny finger movements may not update native volume immediately.

**Done when**

- [ ] Volume HUD remains smooth.
- [ ] Native volume calls are thresholded and throttled.

---

### 11. Stable FlashList Keys

**Problem**

Any list without stable keys can re-render heavily.

**Risk**

- Scroll jank.
- Wrong recycled row content.

**Implementation**

- Verify every `FlashList` and `FlatList` uses `keyExtractor={(item) => item.id}` or equivalent stable unique ID.
- Add `estimatedItemSize` where missing.

**Advantage**

- More stable row recycling.
- Better list performance.

**Disadvantage**

- Items without durable IDs need a proper ID source.

**Done when**

- [ ] All media lists use stable keys.
- [ ] FlashList lists define realistic estimated size.

---

## Phase 3 - UX Features

### 12. Visual Seek Preview

**Priority:** High UX, after stability fixes.

**Implementation**

- Generate preview thumbnails lazily from existing video path.
- Cache by video ID and timestamp bucket.
- Show preview above scrubber while dragging.
- Fall back to artwork if frame generation fails.

**Advantage**

- Matches YouTube/MX expectations.
- Makes long-video seeking much easier.

**Disadvantage**

- Thumbnail generation can be CPU-heavy.
- Needs cache cleanup.

---

### 13. Next Video Popup

**Implementation**

- Show 5-second countdown near video end.
- Display next title and thumbnail.
- Allow cancel.
- Respect loop/repeat mode.

**Advantage**

- Uses existing queue.
- Improves binge/playlist flow.

**Disadvantage**

- Must not show during manual seek near the end unless playback continues naturally.

---

### 14. Gesture Hints

**Implementation**

- Show once per install or after major update.
- Store seen flag in AsyncStorage.
- Auto-dismiss quickly.

**Advantage**

- Helps new users discover MX-style controls.

**Disadvantage**

- Annoying if shown repeatedly, so the seen flag is mandatory.

---

### 15. Subtitle and Audio Track Switcher

**Implementation**

- Expose available tracks from `react-native-video` callbacks.
- Add picker in quick actions.
- Persist last selected track per video when possible.

**Advantage**

- Important for advanced users and multi-language media.

**Disadvantage**

- Track APIs differ across container formats and Android versions.

---

## Phase 4 - Architecture Improvements

### 16. Unified PlaybackContext

**Problem**

`PlayerContext`, `TrackPlayerContext`, and `PlayerManager` each own part of playback state.

**Implementation**

Create a `PlaybackContext` with:

- `activeMediaId`
- `activeType: "audio" | "video" | null`
- `position`
- `duration`
- `queue`
- `isPlaying`
- commands that delegate to video player or TrackPlayer

**Advantage**

- One source of truth for UI.
- Easier mini-player and persistent queue.

**Disadvantage**

- Larger refactor.
- Should happen after PlayerManager enforcement is stable.

---

### 17. Persist Playback Queue

**Implementation**

- Store active queue IDs, active index, media type, and timestamp.
- Restore only if files still exist.
- Do not auto-play unless setting allows it.

**Advantage**

- App restart keeps session.
- Enables better mini-player and resume flows.

**Disadvantage**

- Must handle deleted/moved files.

---

### 18. Player Error Boundary

**Implementation**

- Wrap player screen internals with `ErrorBoundary`.
- On player render error, show player-specific recovery actions:
  - close player
  - retry current video
  - view crash logs

**Advantage**

- Video UI errors do not take down the whole app.

**Disadvantage**

- Native playback crashes may still terminate the process.

---

## Recommended Implementation Order

1. SQLite docs/code consistency.
2. PlayerManager enforcement.
3. TrackPlayer request ID guard.
4. Video session guard coverage.
5. Brightness restore on background/navigation.
6. Crash-loop recovery downgrade.
7. Gesture/slider lock.
8. Pagination and thumbnail queue.
9. Volume delta filtering and list key audit.
10. Seek preview.
11. Next video popup.
12. PlaybackContext and persistent queue.

---

## Final Confirmation Checklist

Before starting implementation, confirm:

- [ ] Use `react-native-sqlite-storage` as the only database engine.
- [ ] Stability fixes should be completed before UX feature work.
- [ ] Crash recovery should preserve the media library unless the user confirms full reset.
- [ ] Seek preview can use generated thumbnails with cache cleanup.
- [ ] Persistent queue should restore paused by default, not auto-play by default.

