# Video Player Controls

- Status: canonical
- Last updated: 2026-06-04 00:00 IST
- Source of truth: `components/VideoPlayerControls.tsx`, `components/player/*`, `app/player.tsx`, `app/playerFeatureConfig.ts`, `app/player.constants.ts`
- Update when: gesture zones, controls, overlays, quick actions, or player-facing settings change
- Related docs: `docs/features/video-player.md`, `docs/features/playback-architecture.md`

## Covers

Gesture behavior, overlay controls, quick actions, settings-linked player controls, and HUD/UI behavior for the full-screen player.

## Main UI Pieces

- `components/VideoPlayerControls.tsx`: transport and overlay shell
- `components/player/TopControls.tsx`: navigation and menus
- `components/player/CenterControls.tsx`: play/pause, seek skip, lock
- `components/player/BottomControls.tsx`: seekbar, time, speed, fullscreen
- `components/player/Seekbar.tsx`: seek interaction surface
- `components/player/GestureHUD.tsx`: feedback for seek, volume, brightness
- `components/player/VerticalGestureBar.tsx`: side gesture feedback

## Interaction Areas

- Horizontal seek interactions
- Left/right side vertical gestures
- Tap and double-tap playback shortcuts
- Lock-state behavior
- Bottom-sheet controls for speed, audio tracks, and subtitles

## Bottom-Bar Layout

- The bottom overlay is a vertical stack (no absolute overlay collision), styled MX-Player-flavored:
  - seekbar row: a **full-width** thin track (`progressBarRow`); the accent-filled fill + thumb span
    the whole bar width
  - time row: `[current] ───────────────── [total]` sits **beneath** the bar (`timeRow`,
    `justifyContent: space-between`), not flanking it
  - control row (`controlRow`): a SINGLE line split into **three fixed zones** —
    `🔒 ☰   |   ⏮  ▶/⏸  ⏭   |   (↻) 1.5× ⛶`. The row itself is `justifyContent: space-between` so
    the side groups anchor to the row edges, but **only the center transport group**
    (`controlGroupCenter`, `flex:1`, `justifyContent: space-between`) spreads `⏮ ▶/⏸ ⏭` evenly;
    the **left group** (`controlGroupSide`: **lock** 🔒 then **playlist** ☰, in that order) and
    **right group** (`controlGroupSide`: start-over, speed, content-fit) keep a tight, fixed
    position at the edges. The play button (`centerPlayBtn`) is the accent-filled, larger primary
    action; every other control is a flat icon button (`ctrlBtn`, transparent at rest, subtle circle
    on press) sized at `ctrlBtnSize = round(transportPlaySize * 0.8)` so the toolbar scales as one
    unit off the play button. Speed shows only when ≠ 1×; content-fit only for video. The whole
    control row (and the rest of the overlay) is hidden when locked.
- **Locked state**: when `isLocked`, the entire overlay (top bar, quick bar, seekbar, control row)
  is suppressed and gestures are blocked in `app/player.tsx`; the only affordance is a single
  **unlock** button pinned top-left (`lockedUnlockWrap` / `lockedUnlockBtn`, offset by safe-area
  insets). Tapping it calls `onToggleLockMode` to unlock.
- Accent color follows the app theme. `app/player.tsx` resolves `useAppTheme().colors.primary` and
  passes it as the `accentColor` prop (default `#FF3B30` if unset); `components/VideoPlayerControls.tsx`
  applies it inline to the seek fill/thumb, play button, and active states (aspect, etc.). The
  component must **not** call `useAppTheme()`/`usePlayer()` itself — the prop keeps it `React.memo`-clean.
- Pill/track radii use the `RADIUS` tokens from `constants/layout.ts`.
- `components/VideoPlayerControls.tsx` takes an `insets` prop (safe-area insets from `app/player.tsx`)
  and applies it to the top section, bottom bar, and gradient heights so controls clear notches and
  nav bars in any orientation. With zero insets the layout is unchanged.
- The seek-preview badge is positioned inside the progress container with a clamped `left` so it
  tracks the thumb and never runs off either end of the bar.
- `components/player/VerticalGestureBar.tsx` accepts an `edgeInset` so the brightness/volume side
  bars clear a landscape notch.

## Quick-Action Customization

- The quick-action icons are user-customizable: order and visibility persist in `PlayerSettings`
  (`quickActionOrder`, `hiddenQuickActions`; defaults from `QUICK_ACTION_KEYS` in `types/player.ts`).
- `app/playerFeatureConfig.ts` carries `quickActionOrder` / `hiddenQuickActions` into the runtime
  feature map; `components/VideoPlayerControls.tsx` (`mxQuickItems`) filters hidden keys and sorts by
  the saved order.
- The quick bar is **collapsible**: collapsed it shows only the priority controls — capture
  (`screenshot`), background music (`background`), language (`audio`), in that order. A toggle chevron
  is pinned at the **front** of the bar (`chevron-right` to expand, `chevron-left` to collapse) so it
  stays reachable even when the expanded list scrolls past the screen edge. Expanding
  (`quickActionsExpanded`, toggled by `onToggleQuickActions` / `handleToggleQuickActions` in
  `app/player.tsx`) reveals **every** enabled control in the saved order. Priority items still appear
  only if their feature is available (`PRIORITY_QUICK_KEYS` filtered against `mxQuickItems`). The
  chevron is omitted when nothing extra is hidden.
- `app/player-controls-layout.tsx` is the editor screen (registered in `src/navigation/RootNavigator.tsx`
  as `player-controls-layout`, linked from Settings → Player Controls → "Customize Controls"). It
  offers per-control show/hide switches, move up/down reordering, and Reset.
- `components/VideoPlayerControls.tsx` is wrapped in `React.memo`; its `position` prop updates at
  whole-second granularity (throttled in `app/player.tsx`) to keep overlay renders cheap.

## Settings-Gated Controls

- `app/playerFeatureConfig.ts` now acts as the shared gatekeeper for control availability.
- `components/VideoPlayerControls.tsx` should stay aligned with `app/player.tsx` for:
  - quick-action chip visibility
  - lock control availability
  - subtitle entry points
  - audio-track switching
  - decoder, orientation, aspect ratio, and trim tools
  - zoom, night mode, sleep timer, screenshot, and volume boost actions
- If a control is hidden or disabled in settings, this file should describe that as a feature gate rather than a transient UI state.

## Update When

- Gesture zones or thresholds change
- Overlay composition changes
- HUD behavior changes
- A player setting changes what a control does
- A player setting changes whether a control is available at all
