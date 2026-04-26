# SRK Player — Improvements & Fixes (2026-04-26)

This document records all bugs fixed and improvements implemented in this session.

---

## Bug Fixes

### 1. Progress Bar Tracking During Scrub
**File:** `components/VideoPlayerControls.tsx`

**Problem:** While dragging the seek bar, the fill track kept snapping back to the real playback position (updated by `onProgress` at 500ms intervals), causing the bar to flicker during scrubbing.

**Fix:** Added `dragProgress` state. While the PanResponder is active, the fill bar renders `dragProgress` instead of the live `position` prop. On `onPanResponderRelease` / `onPanResponderTerminate`, `dragProgress` is cleared and normal tracking resumes.

---

### 2. Audio Player Navigation Loop (Crash Risk)
**File:** `app/audio-player.tsx`

**Problem:** The `useEffect` that calls `navigation.replace('player', { id: activeId })` when a video track is active ran on every re-render. After background-play handoff puts video tracks into TrackPlayer, any state update in the audio player screen could loop or crash navigation.

**Fix:** Added `handledVideoIdRef`. The replace fires at most once per unique `activeId` — subsequent renders for the same ID are ignored.

---

### 3. AudioPlayerBar Collapsing During Track Switch
**File:** `components/AudioPlayerBar.tsx`

**Problem:** `playAudio()` calls `TrackPlayer.reset()`, briefly setting `activeTrack = undefined`. This caused `isVisible` to flip `true → false → true`, triggering the full slide-down animation. The `return null` guard also cut the component tree mid-animation.

**Fix (two parts):**
- **450ms debounce** before starting the slide-out — absorbs the gap between reset and new track load.
- **`isMounted` state** — the component stays in the tree until the slide-out animation fully completes.

---

## Performance Improvements

### 4. useProgress Polling Throttle
**File:** `context/TrackPlayerContext.tsx`

**Problem:** `useProgress(500)` polled every 500ms regardless of playback state, consuming CPU and battery even when paused.

**Fix:** Polling interval is now `500ms` when `state` is Playing/Buffering/Loading, and `5000ms` otherwise.

---

### 5. FastImage in AudioPlayerBar Background
**File:** `components/AudioPlayerBar.tsx`

**Problem:** The blurred background overlay used the standard React Native `Image` component while all other artwork used `FastImage`, leading to inconsistent cache behavior and potential redundant fetches.

**Fix:** Replaced `Image` with `FastImage`. Removed the now-unused `Image` import.

---

### 6. FlatList getItemLayout Separator Offset
**File:** `app/player.tsx`

**Problem:** The queue `FlatList` `getItemLayout` calculated offset as `QUEUE_ITEM_LAYOUT_HEIGHT * index`, ignoring the 8px `ItemSeparatorComponent` height. This caused `scrollToIndex` to land on slightly wrong positions, especially further down a large queue.

**Fix:** Offset is now `(QUEUE_ITEM_LAYOUT_HEIGHT + UP_NEXT_SEPARATOR_HEIGHT) * index`.

---

## Stability Improvements

### 7. playAudio Race Condition Guard
**File:** `context/TrackPlayerContext.tsx`

**Problem:** Double-tapping a track could trigger two concurrent `playAudio()` calls. Both would call `TrackPlayer.reset()` and `TrackPlayer.add()` in parallel, corrupting the queue state.

**Fix:** Added `playInFlightRef`. If a `playAudio()` call is already in progress, subsequent calls return immediately. The ref is cleared in a `finally` block to ensure it always resets.

---

### 8. Stale displayTrack During Debounce Window
**File:** `components/AudioPlayerBar.tsx`

**Problem:** During the 450ms debounce hide window, `activeTrack` is `undefined` (from `TrackPlayer.reset()`). If the user tapped the bar during this window, navigation used a `null`/`undefined` track ID.

**Fix:** Added `lastTrackRef` — always holds the last non-null `activeTrack`. `displayTrack` is `activeTrack ?? lastTrackRef.current`, so tap navigation always has valid data.

---

## UX Improvements

### 9. Sleep Timer in Audio Player
**File:** `app/audio-player.tsx`

**Problem:** The sleep timer feature existed in the video player but was missing from the audio player screen.

**Fix:** Added sleep timer state (`sleepTimerRemaining`) and a `cycleSleepTimer` function. A moon icon button in the secondary row cycles through 15 / 30 / 45 / 60 min → off. When the timer expires it pauses playback and shows an alert. Active state is highlighted in the primary color.

---

### 10. Haptic Feedback on Audio Player Sliders
**File:** `app/audio-player.tsx`

**Problem:** The brightness and volume sliders in the audio player had no tactile feedback, while the video player fired haptics at 10% increments.

**Fix:** Added `ReactNativeHapticFeedback.trigger('selection')` in `handleBrightnessChange` and `handleVolumeChange` at every 10% step change. Limit haptics (heavy bump) at min/max are consistent with video player behavior.

---

### 11. Lock-Screen Metadata After Background Video Handoff
**File:** `app/player.tsx`

**Problem:** When the video player unmounted with background play enabled, the TrackPlayer handoff started playback but never explicitly updated the lock-screen / notification metadata after `seekTo()`. The notification could show stale title/artwork from the previous session.

**Fix:** After `TrackPlayer.play()` in the handoff block, calls `TrackPlayer.updateNowPlayingMetadata` with the current video's title, artist, artwork, and duration.

---

## Files Changed

| File | Changes |
| :--- | :--- |
| `components/VideoPlayerControls.tsx` | Drag-freeze progress bar (fix #1) |
| `app/audio-player.tsx` | Navigation guard (fix #2), sleep timer (#9), haptic sliders (#10) |
| `components/AudioPlayerBar.tsx` | Debounced hide / keep mounted (fix #3), FastImage (#5), stale track guard (#8) |
| `context/TrackPlayerContext.tsx` | Polling throttle (#4), playInFlightRef race guard (#7) |
| `app/player.tsx` | getItemLayout offset (#6), lock-screen metadata (#11) |
