# Components Reference

- Status: reference
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `components/*`
- Update when: a reusable shared component is added, removed, renamed, or moved to a different feature area
- Related docs: `docs/features/video-player.md`, `docs/features/audio-playback.md`, `docs/features/library-and-media.md`

## Purpose

Concise catalog of reusable UI components. Use feature docs for behavior details.

## Player UI

- `components/VideoPlayerControls.tsx`: main video control overlay
- `components/player/*`: player-specific controls, HUDs, bottom sheets, subtitle overlay, loading UI, seekbar

## Audio UI

- `components/AudioPlayerBar.tsx`: global mini-player bar for active audio playback

## Library UI

- `components/VideoCard.tsx`: media tile/list item
- `components/FolderCard.tsx`: folder browser card
- `components/PlaylistCard.tsx`: playlist list card
- `components/PlaylistPickerModal.tsx`: add-to-playlist modal
- `components/MultiSelectActionBar.tsx`: bulk-action bar for selected items
- `components/SearchBar.tsx`: search input surface
- `components/SectionHeader.tsx`: section heading with optional action
- `components/EmptyState.tsx`: generic empty-state panel

## Layout and safety

- `components/layout/ScreenHeader.tsx`: top header layout
- `components/layout/ScreenBackdrop.tsx`: screen background/artwork treatment
- `components/KeyboardAwareScrollViewCompat.tsx`: keyboard-safe scroll wrapper
- `components/ErrorBoundary.tsx`: app-level boundary wrapper
- `components/ErrorFallback.tsx`: fallback UI for boundary failures

## Update When

- Shared UI is refactored across features
- A component moves from generic/shared to feature-specific ownership
