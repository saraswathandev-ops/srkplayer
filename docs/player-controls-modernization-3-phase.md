# SRK Player — 3-Phase Player Controls Modernization

## Goal

Modernize player input without replacing the proven playback stack.

### Phase 1 — Gesture foundation
- Replace the player screen's legacy `PanResponder` with one `react-native-gesture-handler` surface.
- Use explicit gesture priority for pinch, long-press, pan, and tap.
- Lock pan axis after classification.
- Vertical movement only:
  - left 32%: brightness
  - right 32%: volume
- Horizontal movement only:
  - center: seek
- Preserve double-tap ±10s through the existing tap state machine.
- Preserve long-press 2× playback and pinch 1–3× zoom.
- Keep system volume/brightness services unchanged.

## Phase 2 — Control architecture
- Keep `VideoPlayerControls` responsible for buttons, timeline and panels.
- Move timeline scrubbing and bottom-rail swipe from `PanResponder` to Gesture Handler.
- Keep playback state in `PlayerContext` / `PlayerManager`.
- Keep video playback on `react-native-video` and background audio on `react-native-track-player`.
- Use Reanimated for gesture HUD transitions and avoid per-frame layout animation on the JS thread.
- Gradually extract reusable pieces:
  - `PlayerGestureLayer`
  - `PlayerControls`
  - `PlayerSeekBar`
  - `PlayerGestureHud`
  - `usePlayerGestures`

## Phase 3 — UX and performance hardening
- Keep the current MX-style controls and HUD visual language.
- Add/retain edge feedback for brightness and volume.
- Limit haptics to activation and meaningful 10% changes.
- Keep native system-volume calls throttled.
- Validate gesture conflicts with:
  - timeline scrubbing
  - queue/rail swipe
  - pinch
  - double tap
  - locked mode
  - audio mode
- Validate Android release build and startup/playback behavior.

## Current implementation status

| Area | Status |
|---|---|
| Unified player Gesture Handler hook | Implemented |
| Main player legacy PanResponder | Removed |
| Edge vertical duplicate gesture layer | Removed |
| Vertical volume/brightness axis lock | Implemented |
| Horizontal seek axis lock | Implemented |
| Pinch zoom | Implemented |
| Long press 2× | Implemented |
| Timeline legacy PanResponder | Migrated |
| Bottom rail legacy PanResponder | Migrated |
| Playback engine replacement | Not planned |
| Android release validation | Pending CI result |

## Behavior contract

```text
                     PLAYER SURFACE
        ┌──────────────────────────────────────┐
        │ LEFT 32% │ CENTER 36% │ RIGHT 32%   │
        │           │            │              │
        │ Vertical  │ Horizontal │ Vertical     │
        │ Brightness│   Seek     │ Volume       │
        │           │            │              │
        │ Double tap│ Single tap │ Double tap   │
        │   -10s    │ controls   │    +10s      │
        └──────────────────────────────────────┘

        Pinch anywhere       → Zoom 1×–3×
        Long press video     → Temporary 2×
        Screen locked        → Gestures disabled
        Audio mode           → Video-only gestures disabled
```

## Library decisions

| Library | Decision |
|---|---|
| `react-native-video` | Keep |
| `react-native-track-player` | Keep |
| `react-native-gesture-handler` | Primary gesture system |
| `react-native-reanimated` | Primary gesture/HUD animation system |
| `react-native-volume-manager` | Keep |
| Brightness setting library | Keep and isolate behind service |
| Haptic feedback | Keep, event-based |
| `react-native-create-thumbnail` | Keep for current thumbnail pipeline |
| FFmpeg | Keep only for actual conversion/editing features |

## Validation checklist

- TypeScript: `npm run typecheck`
- Web bundle: `npm run build`
- Android release: `./gradlew clean assembleRelease`
- APK exists at `android/app/build/outputs/apk/release/app-release.apk`
- Manual Android checks: tap, double tap, vertical volume, vertical brightness, horizontal seek, pinch, long press, lock, audio mode, timeline scrub, queue swipe.


# Next modernization batch — Phases 4–6

## Phase 4 — Reanimated gesture HUD
Implemented:
- Reusable `PlayerGestureHud`
- Reanimated opacity/scale transitions
- Volume, brightness, seek, zoom and speed states
- No per-frame React layout animation

## Phase 5 — Player component extraction
Started:
- `PlayerGestureHud` extracted
- `PlayerControlItem` extracted
- `PlayerControlSheet` extracted
- Existing playback/render surface remains in place until each extraction is independently validated

## Phase 6 — Advanced control UX
Started:
- Reusable bottom-sheet primitive for advanced player actions
- Accessibility labels on control actions
- Consistent active/pressed/disabled states
- Grid layout designed for touch targets
- Existing quick actions remain unchanged until integration validation

### Safety rule
Each extracted primitive must pass TypeScript/build validation before the next player render block is migrated.


# Phases 7–12 — Full implementation batch

## Phase 7 — Gesture architecture
- Extracted `PlayerGestureLayer` as the single native gesture surface.
- Existing `usePlayerGestures` remains the behavior source of truth.
- Preserved vertical-only edge controls and center horizontal seek.
- Preserved pinch, long-press, double-tap and locked/audio-mode gating.

## Phase 8 — Media and thumbnail resilience
- Kept the existing bounded thumbnail worker and persistent cache.
- Added multiple safe timestamp attempts for videos whose first frame/end-near frame cannot be decoded.
- Failed attempts remain retryable; no permanent `failed` marker is written.
- Audio artwork remains metadata-driven.

## Phase 9 — Playback lifecycle
- Preserved the existing resume-position persistence.
- Preserved foreground/background TrackPlayer handoff and race guard.
- Preserved queue/index handoff and clip-aware position calculations.
- Kept playback engines unchanged.

## Phase 10 — UX and accessibility
- Strengthened player control accessibility roles/labels.
- Kept existing touch-target sizing and locked/audio-mode behavior.
- Advanced actions continue through the reusable control sheet.

## Phase 11 — Performance and resilience
- Gesture work remains centralized in the memoized hook/layer.
- Native volume/brightness updates continue through throttled services.
- Thumbnail generation is bounded and now retries safe timestamps instead of failing permanently.
- Existing application ErrorBoundary remains the top-level crash boundary.

## Phase 12 — Release validation
Required release gate:
1. `npm run typecheck`
2. `npm run build`
3. Android release `./gradlew clean assembleRelease`
4. Verify `android/app/build/outputs/apk/release/app-release.apk`
5. Manual Android smoke test: startup, video playback, audio playback, seek, ±10s double tap, vertical volume/brightness, pinch, long press 2×, lock, background playback, resume, queue next/previous, thumbnails.

Status: implementation committed; CI/build results must be treated as authoritative before calling the batch release-ready.
