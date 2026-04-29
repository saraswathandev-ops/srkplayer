# SRK Player — Video Player Controls Reference

**File:** `app/player.tsx`  
**Last updated:** 2026-04-27  
**Purpose:** Full reference for all gesture controls, UI buttons, settings, and behavioral modes.

---

## Table of Contents

1. [Gesture Controls](#1-gesture-controls)
2. [UI Button Controls](#2-ui-button-controls)
3. [Playback Settings](#3-playback-settings)
4. [Playback Modes](#4-playback-modes)
5. [HUD Overlays](#5-hud-overlays)
6. [Hardware / System Inputs](#6-hardware--system-inputs)
7. [Lock Screen & Background Play](#7-lock-screen--background-play)
8. [Audio Mode Restrictions](#8-audio-mode-restrictions)
9. [Constants & Thresholds](#9-constants--thresholds)
10. [Improvements & Roadmap](#10-improvements--roadmap)

---

## 1. Gesture Controls

All gestures handled by a single `PanResponder`. Screen divided into three horizontal zones via `DOUBLE_TAP_EDGE_RATIO = 0.32`.

### Zone Map

```
|<-- 32% -->|<---- 36% ---->|<-- 32% -->|
  LEFT ZONE   CENTER ZONE   RIGHT ZONE
  Brightness    Seek/Tap      Volume
```

### Axis Lock Rules (updated 2026-04-27)

Once a gesture mode is classified it is locked for the entire touch — it cannot switch mid-gesture. Classification requires a dominant direction:

| Axis | Threshold | Meaning |
|---|---|---|
| Vertical (vol/brightness) | `absDy ≥ absDx × 1.4` | Finger ≥ 54° from horizontal |
| Horizontal (seek) | `absDx ≥ absDy × 1.8` | Finger ≥ 61° from vertical |

Diagonal movements that fall between these thresholds activate nothing — prevents accidental seek during volume swipe and vice versa.

---

### 1.1 Swipe — Brightness (Left Zone, Vertical)

| Property | Value |
|---|---|
| Zone | Left ≤ 32% of screen width |
| Direction | Up = increase / Down = decrease |
| Enabled by | `settings.swipeBrightness` and not audio mode |
| Sensitivity | Adaptive — scales with screen height (see §9) |
| HUD | Brightness side bar (amber, left edge) |
| Haptic | `impactLight` on activation; `selection` every 10% step |
| Night mode sync | Auto-enables night mode when brightness ≤ 12%; auto-disables when > 35% |
| Library | `@ttwrpz/react-native-brightness-setting` |

**Notes:**
- App-level brightness only — system brightness saved on mount, restored on unmount
- Sensitivity formula: `clamp((720 / viewportHeight) × 2.2, 1.2, 3.5)`

---

### 1.2 Swipe — Volume (Right Zone, Vertical)

| Property | Value |
|---|---|
| Zone | Right ≥ 68% of screen width |
| Direction | Up = increase / Down = decrease |
| Enabled by | `settings.swipeVolume` |
| Sensitivity | Adaptive — same formula as brightness |
| HUD | Volume side bar (blue, right edge) |
| Haptic | `impactLight` on activation; `selection` every 10% step; `impactHeavy` at 0%/100% |
| System call throttle | `VolumeManager.setVolume` capped at ≤ 60 calls/sec |
| Library | `react-native-volume-manager` |

---

### 1.3 Swipe — Seek (Center Zone, Horizontal)

| Property | Value |
|---|---|
| Zone | Center 36% of screen width |
| Direction | Right = forward / Left = backward |
| Enabled by | `settings.swipeSeek` |
| Seek window | `clamp(duration × 0.25, 60s, 600s)` |
| Velocity boost | `clamp(vx / 0.8, 1, 2.5)` — fast flick seeks up to 2.5× farther |
| Curve | Exponential `1.12` for gradual → fast acceleration |
| HUD | Seek center HUD with position / duration |
| Haptic | `impactLight` on activation |

---

### 1.4 Double-Tap — Seek Backward (Left Zone)

| Property | Value |
|---|---|
| Tap interval | ≤ 280ms between taps |
| Action | Seek back `settings.doubleTapSeek` seconds |
| HUD | `Back {n}s` |

---

### 1.5 Double-Tap — Seek Forward (Right Zone)

| Property | Value |
|---|---|
| Tap interval | ≤ 280ms between taps |
| Action | Seek forward `settings.doubleTapSeek` seconds |
| HUD | `Forward {n}s` |

---

### 1.6 Single Tap — Toggle Controls (Any Zone)

| Property | Value |
|---|---|
| Condition | No swipe > 10px in any direction |
| Action | Show / hide control overlay |
| Control timeout | 3000ms auto-hide after last interaction |

---

### 1.7 Long Press — 2× Speed Ramp

| Property | Value |
|---|---|
| Activation delay | 650ms hold |
| Action (start) | Force playback speed to 2× |
| Action (release) | Restore previous speed |
| HUD | `2× Speed` badge |
| Haptic | `impactMedium` |
| Restriction | Disabled when screen is locked |

---

### 1.8 Pinch — Zoom (Two Fingers)

| Property | Value |
|---|---|
| Scale range | `1.0` (min) → `3.0` (max) |
| Activation delta | 4% scale change to start |
| HUD | `Zoom {n}×` or `Zoom reset` |
| Restriction | Disabled in audio mode |

---

## 2. UI Button Controls

All buttons are in `VideoPlayerControls`. Controls auto-hide after `CONTROL_TIMEOUT = 3000ms`.

| Button | Handler | Behavior |
|---|---|---|
| Play / Pause | `handlePlayPause` | Toggle playback state |
| Seek Slider | `handleSeek(pos)` | Jump to absolute position |
| ⏮ Previous | `handlePrev` | Navigate to previous video |
| ⏭ Next | `handleNext` | Navigate to next video |
| Speed | `handleSpeedChange` | Cycle: `0.5 → 0.75 → 1 → 1.25 → 1.5 → 1.75 → 2` |
| Mute | `handleToggleMute` | Toggle mute; remembers last audible volume |
| Loop | `handleToggleLoop` | Cycle: `none → one → all` |
| Content Fit | `handleToggleContentFit` | Cycle: `contain → cover → fill` |
| Up Next | `handleToggleUtilityRail` | Show / hide queue panel |
| Quick Actions | `handleToggleQuickActions` | Show / hide settings panel |
| Properties | `handleTogglePropertiesPanel` | Show / hide video info panel |
| Trim | `handleOpenTrimPanel` | Open clip trimming interface |
| 🔒 Lock | `handleToggleLockMode` | Enable / disable screen lock |
| Night Mode | `handleToggleNightMode` | Toggle dark overlay |
| Background Play | `handleToggleBackgroundPlay` | Enable / disable audio continuation when backgrounded |
| Decoder | `handleCycleDecoderMode` | Cycle: `HW+ → HW → SW` |
| Volume Boost | `handleCycleVolumeBoost` | Cycle: `1× → 1.25× → 1.5× → 2×` |
| Audio Track | `handleCycleAudioTrack` | Cycle to next audio track |
| Orientation | `handleCycleOrientation` | Cycle: `Auto → Landscape → Portrait` |
| Aspect Ratio | `handleSetForcedAspectRatio` | Set fixed ratio or `null` for auto |
| Screenshot | `handleScreenshot` | Capture current frame |
| Zoom | `handleZoomAction` | Reset zoom or show pinch hint |
| Close | `handleClose` | Save position, release player, exit |

### Trim Panel

| Button | Handler | Behavior |
|---|---|---|
| Mark Start | `handleMarkTrimStart` | Set trim start = current time |
| Mark End | `handleMarkTrimEnd` | Set trim end = current time |
| Preview Start | `handlePreviewTrimStart` | Seek to trim start |
| Preview End | `handlePreviewTrimEnd` | Seek to trim end |
| Reset | `handleResetTrim` | Reset markers to full duration |
| Save Clip | `handleSaveTrim` | Save trimmed clip to database |

### Queue Panel (Up Next)

| Button | Handler | Behavior |
|---|---|---|
| ← Prev Page | `handleScrollUpNextPrev` | Landscape: prev page |
| → Next Page | `handleScrollUpNextNext` | Landscape: next page |
| Hide | `handleHideUpNext` | Collapse queue |
| Tap item | `handlePickUpcomingVideo` | Jump to selected video |

---

## 3. Playback Settings

From `PlayerContext` (`settings.*`). Persisted via `updateSettings()`.

| Setting | Type | Description |
|---|---|---|
| `autoPlay` | boolean | Auto-start on load |
| `speed` | number | Saved playback speed |
| `defaultVolume` | `0–1` | Persistent volume |
| `defaultBrightness` | `0–1` | App brightness (player only) |
| `loopMode` | `"none" \| "one" \| "all"` | Loop behavior |
| `videoSizeMode` | `"fit" \| "expand" \| "stretch"` | Video scaling |
| `backgroundPlay` | boolean | Background audio continuation |
| `rememberPosition` | boolean | Save / restore position per video |
| `doubleTapSeek` | seconds | Seek amount for double-tap |
| `swipeBrightness` | boolean | Enable left-zone brightness swipe |
| `swipeVolume` | boolean | Enable right-zone volume swipe |
| `swipeSeek` | boolean | Enable center seek swipe |

---

## 4. Playback Modes

### 4.1 Playback Speed
`0.5× / 0.75× / 1× / 1.25× / 1.5× / 1.75× / 2×`  
Long-press on player temporarily forces 2× and restores on release.

### 4.2 Loop Mode

| Mode | Behavior |
|---|---|
| `none` | Play once, stop |
| `one` | Repeat current video |
| `all` | Advance through queue; wraps |

### 4.3 Orientation

| Mode | Behavior |
|---|---|
| `default` | System auto-rotate |
| `landscape` | Lock landscape |
| `portrait` | Lock portrait |

Audio mode always locks to portrait.

### 4.4 Video Decoder

| Mode | ViewType | Notes |
|---|---|---|
| `HW+` | `SURFACE` | Default — hardware accelerated |
| `HW` | `TEXTURE` | Alternate hardware surface |
| `SW` | — | Software (unsupported in this build) |

### 4.5 Volume Boost
Applied on top of system volume: `player.volume = systemVolume × boost`  
Levels: `1× / 1.25× / 1.5× / 2×`

### 4.6 Content Fit

| Mode | Internal | Behavior |
|---|---|---|
| Fit | `contain` | Letterbox |
| Expand | `cover` | Fill, crop edges |
| Stretch | `fill` | Stretch to fill |

### 4.7 Sleep Timer
- Accepts any minute value or `null` (off)
- Decrements every second; pauses playback at zero
- HUD: `Sleep timer set for {n}m` / `Sleep timer off`

### 4.8 Night Mode
- Dark overlay above video — does not change system brightness
- Auto-enabled when brightness ≤ 12% via swipe
- Auto-disabled when brightness recovers above 35%
- Can also be toggled manually via Quick Actions

---

## 5. HUD Overlays

Auto-dismiss after `HUD_TIMEOUT = 1000ms`.

### 5.1 Seek / Zoom HUD (Center)

```
┌──────────────────────────┐
│  ⏩ SEEK                  │
│  0:35 / 1:24:10          │
│  ████████░░░░░░░░░░░░    │
└──────────────────────────┘
```
Used for: seek gestures, speed, decoder, orientation, loop, trim notifications.

### 5.2 Volume HUD (Right Side — always mounted)

```
       ┌────┐
       │VOL │
       │    │
       │████│  ← Animated.Value fill (0–160px), instant on gesture
       │████│
       │    │
       │🔊 75%│
       └────┘
```
- Color: `#4BA3FF` (blue)
- Icons: `volume-x` (0%) / `volume-1` (<50%) / `volume-2` (≥50%)
- Tick marks at 25%, 50%, 75%
- Instant show (`opacity.setValue(1)`), 300ms fade after 1s idle

### 5.3 Brightness HUD (Left Side — always mounted)

```
┌────┐
│LUM │
│    │
│████│  ← same Animated.Value system as volume
│████│
│    │
│☀️ 80%│
└────┘
```
- Color: `#FFC107` (amber)
- Icons: `moon` (≤15%) / `sun` (>15%)

---

## 6. Hardware / System Inputs

### 6.1 Android Hardware Back Button

Priority order (first match wins):

1. Screen locked → alert "Screen Locked"
2. Properties panel open → close it
3. Trim panel open → close it
4. Quick actions open → close it
5. Up-next queue open → close it
6. Otherwise → pass to navigation

### 6.2 Hardware Volume Buttons

- `VolumeManager.addVolumeListener` syncs hardware press to app state
- Triggers Volume HUD on every press
- No system UI shown (`showUI: false`)

### 6.3 Remote Control Events (TrackPlayer)

| Event | Action |
|---|---|
| `RemoteNext` | Navigate to next video |
| `RemotePrevious` | Navigate to previous video |
| `RemotePlay` | Resume playback |
| `RemotePause` | Pause playback |
| `PlaybackQueueEnded` | Auto-advance if `backgroundPlay` enabled |

---

## 7. Lock Screen & Background Play

### 7.1 Screen Lock (`isLocked = true`)
- All gestures disabled
- All UI buttons disabled
- Utility rail, quick actions, trim auto-close
- Back button shows alert

### 7.2 Background Play
- Audio continues when app is backgrounded
- TrackPlayer remote controls registered
- Now-playing notification shown if TrackPlayer unavailable
- On `PlaybackQueueEnded`, auto-advances to next video

---

## 8. Audio Mode Restrictions

Auto-triggered when `mediaType === "audio"`. Player redirects to audio player screen.

Disabled in audio mode (shows `"Audio mode"` HUD):
- Brightness swipe
- Content fit toggle
- Trim panel
- Zoom controls
- Decoder cycling
- Orientation cycling
- Screenshot

---

## 9. Constants & Thresholds

| Constant | Value | Purpose |
|---|---|---|
| `CONTROL_TIMEOUT` | `3000ms` | Auto-hide controls |
| `HUD_TIMEOUT` | `1000ms` | Auto-dismiss HUD overlays |
| `SCREENSHOT_PREVIEW_TIMEOUT` | `3000ms` | Screenshot preview duration |
| `DOUBLE_TAP_TIMEOUT` | `280ms` | Double-tap window |
| `DOUBLE_TAP_EDGE_RATIO` | `0.32` | Left/right zone width |
| `GESTURE_ACTIVATION_DISTANCE` | `12px` | Min drag to start a gesture |
| `GESTURE_CANCEL_TAP_DISTANCE` | `10px` | Max drag still treated as tap |
| `LONG_PRESS_SPEED_RAMP_DELAY` | `650ms` | Hold to trigger 2× speed |
| `HORIZONTAL_SEEK_MAX_WINDOW` | `600s` | Max seek range |
| `MIN_PINCH_SCALE` | `1.0` | Minimum zoom |
| `MAX_PINCH_SCALE` | `3.0` | Maximum zoom |
| `PINCH_GESTURE_ACTIVATION_DELTA` | `0.04` | Scale change to start pinch |
| `MX_HUD_TRACK_HEIGHT` | `160dp` | Volume/brightness bar pixel height |
| `SPEEDS` | `[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]` | Speed levels |
| `VOLUME_BOOST_LEVELS` | `[1, 1.25, 1.5, 2]` | Boost levels |
| Vertical axis threshold | `absDy ≥ absDx × 1.4` | Gesture axis lock |
| Horizontal axis threshold | `absDx ≥ absDy × 1.8` | Gesture axis lock |
| Adaptive sensitivity base | `(720 / height) × 2.2` clamped `1.2–3.5` | Volume/brightness sensitivity |

---

## 10. Improvements & Roadmap

### ✅ Implemented (2026-04-27)

| Feature | Details |
|---|---|
| **Adaptive gesture sensitivity** | `getAdaptiveSensitivity(height)` scales `2.2×` at 720dp reference; taller screens reduce multiplier so one full-screen swipe always = 0→100%. |
| **Velocity-based seek** | `clamp(vx / 0.8, 1, 2.5)` multiplied into seek window. Slow drag = precise; fast flick = up to 2.5× farther. |
| **Night mode auto-sync** | Brightness ≤ 12% → auto-enable night overlay; > 35% → auto-disable. Manual toggle remains independent. Uses `nightModeRef` stable ref. |
| **Stricter axis lock** | Vertical: `absDy ≥ absDx × 1.4`; Horizontal: `absDx ≥ absDy × 1.8`. Diagonals trigger nothing — eliminates accidental seek during volume swipe. |
| **60fps system volume throttle** | `lastVolSystemCallRef` gates `VolumeManager.setVolume` to ≤ 1 call/16ms. React state updates every frame; native bridge protected. |
| **MX-style instant side HUDs** | `Animated.Value.setValue()` for zero-lag bar fill. Always-mounted opacity panels. Pixel-based interpolation `[0, 160]` (% strings don't work in RN layout). |
| **Reanimated HUD opacity** | All three HUD panels fade using `react-native-reanimated` shared values — opacity animation runs on the UI thread, zero JS bridge involvement. |
| **BlurView HUD cards** | All HUD cards use `@react-native-community/blur` `BlurView` for glass-panel look. |
| **LinearGradient bar fills** | Volume (blue `#1D4ED8→#60A5FA`) and brightness (amber `#F59E0B→#FCD34D`) bars use `react-native-linear-gradient`. |
| **Non-linear gesture curve** | `applyGestureControlCurve(absDelta)` = `Math.pow(x, 1.4)`. Small gestures → precise; large gestures → fast response. Applied to volume + brightness. |
| **Edge resistance** | `applyEdgeResistance(current, delta)`: within 8% of 0 or 100%, delta is multiplied by 0.25. Prevents snapping past limits — premium feel. |
| **Progressive double-tap seek** | Consecutive taps in same zone accumulate: ×1 (+10s) → ×2 (+20s) → ×3 (+30s, capped). Resets after 600ms idle. Like YouTube. |
| **Session ID** | `sessionIdRef` increments on each new video load. Async callbacks (file-check, `replaceAsync`) verify `sessionIdRef.current === thisSession` before applying results — prevents stale-session side effects. |
| **Unlock button overlay** | When `isLocked`, a `"Locked"` pill button appears at top-center. Tap it to unlock without needing to find the lock button in the hidden controls. |
| **PlayerManager** | `services/PlayerManager.ts` — singleton coordinator. `playVideo()` stops audio first; `playAudio()` stops video first; `stopAll()` resets everything. Eliminates audio/video overlap and memory leaks. |

---

### 🔜 Planned (Next Sessions)

#### Gesture & Input
| Feature | Complexity | Notes |
|---|---|---|
| **Gesture Handler migration** | High | Replace `PanResponder` with `react-native-gesture-handler` — native thread, no JS lag, better multi-touch. Full rewrite needed. |
| **Gesture sensitivity setting** | Low | User-selectable: Slow / Medium / Fast. Maps to a sensitivity multiplier passed to `resolveVerticalGestureDelta`. |
| **Edge glow feedback** | Low | Subtle left/right edge flash (Reanimated `withTiming`) when brightness/volume gesture activates. |
| **Gesture tutorial overlay** | Medium | First-launch coach marks showing swipe zones. Seen state in AsyncStorage. |

#### Volume & Brightness
| Feature | Complexity | Notes |
|---|---|---|
| **Volume smoothing (inertia)** | Low | `newVol = current + delta × 0.05` — premium laggy feel like high-end players. |
| **Volume distortion indicator** | Low | Show ⚠ in HUD when `volume × boost > 1.0`. Already have the data; just needs UI. |
| **Auto brightness (time-based)** | Medium | Night hours → lower brightness automatically. Uses `new Date().getHours()` + threshold in Settings. |
| **Haptic customization** | Low | Settings toggle: Off / Light / Full haptic intensity. |

#### Playback
| Feature | Complexity | Notes |
|---|---|---|
| **Resume popup** | Low | On open: "Resume from 02:15? [Resume] [Start Over]". Uses `lastPosition` from DB. |
| **Auto-next popup** | Low | 5s countdown before video ends: "Next: Video Name (5s)". Cancellable. |
| **Preview thumbnail seek** | Medium | Show frame thumbnail above scrubber while dragging. Uses `react-native-create-thumbnail`. |
| **ExoPlayer buffering config** | Medium | Expose `minBufferMs`, `maxBufferMs` to Settings screen. |
| **Smart skip markers** | High | User-taggable intro/outro timestamps. Store in `videos` table. |

#### UI & Architecture
| Feature | Complexity | Notes |
|---|---|---|
| **PlayerManager adoption** | Low | Wire `PlayerManager.playVideo()` into `player.tsx` load and `PlayerManager.playAudio()` into TrackPlayerContext. Already created at `services/PlayerManager.ts`. |
| **Session reset on video change** | Low | `setVideoSource(null)` → 50ms → `setVideoSource(newUri)` prevents old frame freeze + audio overlap on fast switching. |
| **Floating mini-player** | High | Draggable PiP overlay when navigating away. Requires portal architecture. |
| **FFmpeg export trim** | High | Real video re-encode instead of metadata-only clip. Needs `ffmpeg-kit-react-native`. |
| **Auto volume normalization** | High | Per-file LUFS analysis. Requires audio pipeline access. |

---

### 📦 Library Status

| Purpose | Library | Status |
|---|---|---|
| Video playback | `react-native-video` + ExoPlayer | ✅ In use — supports HLS + DASH natively |
| Audio background | `react-native-track-player` | ✅ In use |
| Volume control | `react-native-volume-manager` | ✅ In use |
| Brightness (app-level) | `@ttwrpz/react-native-brightness-setting` | ✅ In use |
| Gestures (native thread) | `react-native-gesture-handler` | ✅ Installed — full migration planned |
| Animations (UI thread) | `react-native-reanimated` v3 | ✅ In use — HUD opacity on UI thread |
| Blur UI | `@react-native-community/blur` | ✅ In use — all HUD cards |
| Gradient fills | `react-native-linear-gradient` | ✅ In use — vol/brightness bars |
| Offline DB | `react-native-sqlite-storage` | ✅ In use |
| Thumbnail gen | `react-native-create-thumbnail` | ✅ In use |
| ~~HLS engine~~ | ~~`hls.js`~~ | ❌ Removed — `react-native-video` handles HLS |
| ~~DASH engine~~ | ~~`shaka-player`~~ | ❌ Removed — `react-native-video` handles DASH |
| ~~System settings~~ | ~~`react-native-system-setting`~~ | ❌ Removed — replaced by `volume-manager` + `brightness-setting` |
| Real video trim | `ffmpeg-kit-react-native` | 🔜 Planned — current trim is metadata-only |

---

## Change Log

| Date | Change |
|---|---|
| 2026-04-27 | Removed `hls.js`, `shaka-player`, `react-native-system-setting` from package.json (redundant/broken); updated library table |
| 2026-04-27 | Created `services/PlayerManager.ts` — singleton audio/video conflict coordinator |
| 2026-04-27 | Reanimated HUD opacity, BlurView cards, LinearGradient bar fills on all three HUDs |
| 2026-04-27 | Non-linear curve + edge resistance on vol/brightness; progressive double-tap seek; session ID; unlock overlay button |
| 2026-04-27 | Added §10 roadmap; adaptive sensitivity, velocity seek, night mode sync, axis lock, 60fps throttle |
| 2026-04-27 | MX-style always-mounted volume/brightness HUDs; pixel-based `Animated.Value` interpolation |
| 2026-04-26 | Gesture zones unified to `DOUBLE_TAP_EDGE_RATIO`; brightness restore fix; viewport fallback |
| 2026-04-26 | Sleep timer, haptic feedback, lock-screen metadata added |
