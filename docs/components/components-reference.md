# SRK Player — Components Reference

**Purpose:** Comprehensive documentation for reusable UI components.

---

## Player Controls Architecture (MX/VLC Style)
**Location:** `components/player/` & `src/player/`
**Purpose:** An optimized, layered architecture replacing the legacy monolith player.

### Core Architecture
- **`PlayerScreen.tsx`** (`src/player/`): The slim orchestrator (~300 lines). Glues the state, gestures, video surface, and UI overlays together.
- **`GestureLayer.tsx`**: Pure 60fps touch detection (brightness, volume, double-tap seek, horizontal preview seek, pinch-to-zoom). Emits events upward.
- **`TopControls.tsx`**: Back button, title, subtitles, audio tracks, and settings menu.
- **`CenterControls.tsx`**: Play/Pause, ±10s skip, and lock button.
- **`BottomControls.tsx`**: Custom gesture-driven Seekbar, time display, speed pill, and fullscreen toggle.
- **`SubtitleOverlay.tsx`**: Renders pure `<Text>` over the video surface, avoiding burn-in and allowing custom styling.
- **`LoadingOverlay.tsx`**: 500ms debounced buffering spinner to eliminate flicker.

### Gesture HUDs
- **`GestureHUD.tsx`**: Contains `SideHUD` (for brightness/volume sliders) and `SeekHUD` (for seek deltas).

### Bottom Sheets (`@gorhom/bottom-sheet`)
- **`SpeedBottomSheet.tsx`**: Playback speed selector.
- **`AudioTrackBottomSheet.tsx`**: Audio track language/source selector.
- **`SubtitleBottomSheet.tsx`**: Subtitle source selector (Phase 3).

### Hooks & State (`hooks/player/` & `store/playerStore.ts`)
- **`playerStore.ts`**: Zustand state manager holding all playback logic.
- **`usePlayerControls.ts`**: Unified auto-hide timers and visibility toggles.
- **`usePlayback.ts`**: Handles play/pause, seeking, speed changes, and auto-saving the position every 5s.

---

## AudioPlayerBar
**Location:** `components/AudioPlayerBar.tsx`
**Purpose:** A floating mini-player bar for audio. Always visible globally when an audio track is playing in the background.

---

## MultiSelectActionBar
**Location:** `components/MultiSelectActionBar.tsx`
**Purpose:** Action bar shown at the top of lists when items are selected.
**Props:**
- `selectedCount`: number
- `onClear`: function
- `actions`: array of action objects (icon, label, onPress)

---

## SearchBar
**Location:** `components/SearchBar.tsx`
**Purpose:** Global search bar input component.
**Props:**
- `query`: string
- `onChangeText`: function
- `onClear`: function

---

## VideoCard, FolderCard, PlaylistCard
**Location:** `components/`
**Purpose:** Render items in grids and lists consistently across screens.
**Props:**
- Data object (e.g. `VideoItem`, `FolderItem`)
- Selection state (`isSelected`, `selectionMode`)
- `onPress`, `onLongPress`
