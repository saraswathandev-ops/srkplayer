# SRK Player — Issues & Improvements
**Date:** 2026-05-04  
**Branch:** HEAD

---

## Summary

12 issues addressed in this session. Status: ✅ Implemented | ⚠️ Partial | 🔴 Needs dependency

---

## Issue Tracker

### #4 — Left/Right Side Touch Vibrate Issue ✅
**Type:** Bug  
**Root cause:** `impactLight` haptic was firing inside the vertical gesture mode-detection block at lines 3193/3199 of `player.tsx`. Though already gated by `if (!currentGesture.mode)` (fires once per gesture), users on some Android ROMs experienced unexpected vibration when lightly touching the edge zones intended for brightness/volume.  
**Fix:** Removed both haptic calls from the brightness/volume mode-detection block. Visual gesture bars provide sufficient feedback.  
**Files:** [app/player.tsx](../app/player.tsx)

---

### #9 — Audio Player Image Not Showing ✅
**Type:** Bug  
**Root cause:** Two issues:
1. `content://` media URIs were not handled in the scheme-normalization logic — the code only checked for `http` and `file://`, so content URIs got incorrectly prefixed with `file://content://...`.
2. `FastImage` silently failed with no fallback — when the image loaded with an error, the component showed blank instead of the placeholder.  
**Fix:**
- Added `content://` to the exclusion check in artwork URI normalization (`audio-player.tsx` line 173)
- Added `artworkLoadError` state + `useEffect` reset when artwork URI changes
- Added `onError` callback on both `FastImage` instances to set error flag and show the music-icon placeholder  
**Files:** [app/audio-player.tsx](../app/audio-player.tsx)

---

### #12 — Resume Play UX Redesign ✅
**Type:** UX  
**Previous behavior:** Resume prompt was commented out. Auto-resume happened silently. "Start Over" was only accessible via the Restart button in quick actions.  
**New behavior:**
- When returning to a video with saved position: video auto-plays from saved position immediately
- A small bottom-left card appears showing "Resuming from MM:SS" + a "Start Over" button
- Card auto-dismisses after 5 seconds
- "Start Over" seeks to 0 and dismisses the card  
**Files:** [app/player.tsx](../app/player.tsx) — uncommented `resumePromptOverlay` block, removed Resume button, kept Start Over button only

---

### #11 — Lock Screen UI Redesign ✅
**Type:** UX  
**Previous behavior:** Lock hid most controls but showed title/header; a small bottom-left "Unlock" button remained visible; VideoPlayerControls still rendered underneath.  
**New behavior:**
- When locked: `VideoPlayerControls` is fully hidden (`visible={... && !isLocked}`)
- A full-screen transparent `Pressable` overlay covers the entire screen
- Centered circular lock icon (32px, white on dark backdrop) shown
- Tap anywhere on the lock overlay to unlock
- `shouldHoldVisible` no longer forces controls visible when locked  
**Files:** [app/player.tsx](../app/player.tsx)

---

### #2 — Volume/Brightness Gesture: Edge Strip Only ✅
**Type:** UX  
**Previous behavior:** Full left 50% of screen = brightness, full right 50% = volume. Accidental triggers were common.  
**New behavior:** Only the outer 20% edge strip activates the gesture (left edge: `startX < width × 0.20`, right edge: `startX > width × 0.80`). Center 60% only does seek.  
**Constant added:** `EDGE_GESTURE_RATIO = 0.20` in player.tsx  
**Files:** [app/player.tsx](../app/player.tsx)

---

### #3 — Touch Anywhere + Quick Actions Show/Hide ✅
**Type:** UX  
**Status:** Touch anywhere was already implemented (pan responder tap detection). Quick actions (overflow items) already collapse via the three-dot button. The "Stream" button added in #6 also integrates with the existing quick actions overflow mechanism.  
**Confirmed working:** Single tap toggles controls visibility; `⋯` (three-dot) button in top-right expands/collapses overflow quick actions row.  
**Files:** No changes needed — existing implementation confirmed correct.

---

### #10 — Default Fit Mode + Pinch Zoom % Display ✅
**Type:** UX  
**Previous behavior:** Default fit mode was `"cover"` (crop to fill). Info chip showed "Pinch zoom ready" at 1.0x.  
**New behavior:**
- Default fit mode is now `"contain"` (letterbox/fit) — video shows in full with black bars
- `initialPlayerFitFromSetting()` returns the saved mode directly without the "contain → cover" override
- Info chip now shows `"Zoom 1.5×"` format when zoomed, `"Fit"` at 1.0x  
**Files:** [app/player.tsx](../app/player.tsx)

---

### #6 — Internet Video Stream from Player ✅
**Type:** Feature  
**Status:** The `network-stream.tsx` screen and HLS/DASH intent filters already existed. Added access from inside the player.  
**Changes:**
- New `onOpenNetworkStream?: () => void` prop on `VideoPlayerControls`
- New "Stream" (wifi icon) button added to the `mxQuickItems` overflow array
- `player.tsx` wires `onOpenNetworkStream` → `navigation.navigate("network-stream")`  
**Files:** [components/VideoPlayerControls.tsx](../components/VideoPlayerControls.tsx), [app/player.tsx](../app/player.tsx)

---

### #7 — Background Video Notification with Queue Prev/Next ✅
**Type:** Feature  
**Implementation:**
- Imported `videoItemToTrack` from `trackPlayerService`
- Added a `useEffect` that, when `settings.backgroundPlay` is true and the player is in video mode:
  - Converts the full `videoQueue` to TrackPlayer tracks via `videoItemToTrack()`
  - Calls `TrackPlayer.setQueue(tracks)` then skips to the current video index
  - TrackPlayer's notification shows the title, artwork, and prev/next controls natively
- `useSafeTrackPlayerEvents` already handled `Event.RemoteNext`/`RemotePrevious` (lines 2703–2709) — these call `handleNavigateToVideo` which updates the video in the queue  
**Note:** Effect guards against audio conflicts with `isAudioPlayInFlight()` check. Does not run in audio mode.  
**Files:** [app/player.tsx](../app/player.tsx)

---

### #5 — Suggested Content in Up-Next Panel ✅
**Type:** Feature  
**Implementation:**
- Added `suggestedVideos: VideoItem[]` state in player.tsx
- Added `fetchMostPlayed` to `usePlayer()` destructure
- `useEffect` triggers when up-next panel opens: fetches top 8 most-played videos, filters out ones already in the queue, takes max 5
- Rendered below the queue FlatList as a "Suggested" section (portrait only)
- Tapping a suggested video calls `handlePickUpcomingVideo()` to add it to queue and play  
**Files:** [app/player.tsx](../app/player.tsx)

---

### #8 — Trim & Save to Device Folder ⚠️
**Type:** Feature (Partial)  
**Implementation:**
- `handleSaveTrim` now creates `<ExternalStorage>/image/trimedvideo/` directory via `RNFS.mkdir()` before saving
- Virtual clip is saved to the DB as before (mxclip:// URI)
- HUD shows "Clip saved: {title}" on success  
**Limitation:** Actual video file trimming (writing a real MP4) requires `ffmpeg-kit-react-native` which is not installed. The folder is created and ready. To enable real export:
```
npm install ffmpeg-kit-react-native
```
Then update `videoService.ts` to add `exportTrimmedClipToFile(sourceUri, start, end, outputPath)` using `FFmpegKit.execute()`.  
**Files:** [app/player.tsx](../app/player.tsx)

---

### #1 — Feature List Documentation ✅
**Type:** Docs  
**Output:** This file — `docs/issues-and-improvements-2026-05-04.md`

---

## Files Changed

| File | Changes |
|------|---------|
| [app/player.tsx](../app/player.tsx) | #4, #2, #10, #12, #11, #7, #5, #8, #6 wiring |
| [components/VideoPlayerControls.tsx](../components/VideoPlayerControls.tsx) | #6 Stream button + prop |
| [app/audio-player.tsx](../app/audio-player.tsx) | #9 artwork error handling |

---

## Pending / Follow-up

| # | Description | Blocker |
|---|-------------|---------|
| #8 real trim | Export actual MP4 file | Install `ffmpeg-kit-react-native` |
| #7 conflict guard | Audio/video TrackPlayer conflict when switching modes | Test on device |
| Network stream UI | URL validation, buffering indicator | Low priority polish |
