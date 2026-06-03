# Library / List UI Linear Project Template

- Status: proposal
- Last updated: 2026-06-01 00:20 IST
- Source of truth: `app/(tabs)/library.tsx`, `app/(tabs)/audio.tsx`, `app/(tabs)/playlists.tsx`, `app/(tabs)/search.tsx`, `app/folder/[id].tsx`, `app/playlist/[id].tsx`, `components/layout/ScreenHeader.tsx`, `components/EmptyState.tsx`, `components/VideoCard.tsx`, `services/videoService.ts`, `context/PlayerContext.tsx`
- Update when: the Linear tracking structure changes, or the current UI implementation moves closer to or farther from this proposed shared rollout
- Related docs: `docs/features/library-and-media.md`, `docs/screens/screens-reference.md`, `docs/reference/components.md`, `docs/AI_INDEX.md`

## Purpose

This file is a Linear-ready project template for the library/list UI overhaul. It is intended to be copied into Linear once the target `TEAM_KEY` and optional existing `PROJECT_ID` are known.

## Current Implementation Status

This proposal is not fully completed in the current app UI.

What is already present in code:
- the target screens exist and ship distinct library, audio, playlist, search, folder, and playlist-detail flows
- `ScreenHeader` is already the shared title treatment used by several list screens
- some screens already support refresh and sort controls, especially folder, library, and audio flows
- `VideoCard` already carries resume, favorite, and media-state behavior used across the library

What is still not implemented as proposed:
- `constants/layout.ts` does not exist as the shared spacing/token source
- `AppHeader`, `HeaderIconButton`, `LibraryToolbar`, and `ListStates` do not exist as the shared rollout primitives described below
- the list screens have not been normalized onto one common header/loading/empty-state system
- `VideoCard` still contains the fake `HD/4K` badge heuristic called out in this proposal

Treat this file as planning/tracking only, not as a description of shipped UI structure.

## Project Template

- Team: `TEAM_KEY`
- Existing project id: `PROJECT_ID` or `create-new`
- Project name: `Library / List Screens UI Overhaul`
- Suggested description:
  Unify headers, empty/loading states, sort/filter controls, spacing, refresh behavior, and card polish across Library, Audio, Playlists, Search, Folder detail, and Playlist detail.

## Issue 1: Shared UI Primitives For List Screens

- Title: `Build shared list-screen UI primitives`
- Scope:
  - add `constants/layout.ts`
  - add `components/layout/AppHeader.tsx`
  - add `components/library/HeaderIconButton.tsx`
  - add `components/library/LibraryToolbar.tsx`
  - add `components/library/ListStates.tsx`
  - keep `components/layout/ScreenHeader.tsx` as a compatibility layer or thin re-export during rollout
- Acceptance criteria:
  - all new primitives exist and compile
  - `AppHeader` preserves the current title split style from `ScreenHeader`
  - primitives are reusable without changing selection ownership in screens

## Issue 2: Header And State Rollout Across List Screens

- Title: `Roll out shared headers, empty states, and loading states`
- Scope:
  - migrate `search.tsx`
  - migrate `playlists.tsx`
  - migrate `audio.tsx`
  - migrate `library.tsx`
  - migrate `folder/[id].tsx`
  - migrate `playlist/[id].tsx`
  - add missing pull-to-refresh where required
- Acceptance criteria:
  - one consistent header pattern across all targeted screens
  - one consistent empty/loading pattern across all targeted screens
  - no navigation payload changes
  - multi-select behavior remains owned by each screen

## Issue 3: Sort Direction And Filter Support

- Title: `Add real sort direction and toolbar-based filters`
- Scope:
  - add optional `sortDirection` to `services/videoService.ts`
  - thread `sortDirection` through `context/PlayerContext.tsx`
  - roll `LibraryToolbar` into Library, Audio, and Folder detail
  - add Favorites/Unwatched/Type filters where the current screen and data model support them
- Acceptance criteria:
  - sort direction affects paged reads correctly, not just already-loaded items
  - Library, Audio, and Folder detail expose consistent sort controls
  - filters narrow results without breaking paging

## Issue 4: Card And Spacing Polish

- Title: `Polish cards, spacing, and list/grid consistency`
- Scope:
  - refine `components/VideoCard.tsx`
  - normalize spacing tokens and list/grid padding
  - align `components/PlaylistCard.tsx` spacing
  - remove fake `HD/4K` badge logic
  - ensure only one status badge is shown at a time
  - add thumbnail placeholder while `FastImage` loads
- Acceptance criteria:
  - `VideoCard` props and navigation contract stay unchanged
  - list/grid spacing is token-driven and consistent
  - visual polish does not alter player/audio-player navigation behavior

## Issue 5: Docs And Verification

- Title: `Update docs and verify list-screen UI overhaul`
- Scope:
  - update `docs/features/library-and-media.md`
  - update `docs/screens/screens-reference.md`
  - update `docs/reference/components.md`
  - update `docs/AI_INDEX.md`
  - run `npx tsc --noEmit`
  - capture residual risks and manual verification notes
- Acceptance criteria:
  - docs match the shipped UI structure
  - timestamps are updated in touched docs
  - verification notes call out only the pre-existing `process` typing baseline if unchanged

## Rollout Order

1. Shared primitives
2. Search
3. Playlists
4. Audio
5. Library
6. Folder detail
7. Playlist detail
8. Sort direction service thread-through
9. Card polish
10. Docs and verification

## Labels And Metadata Suggestions

- Suggested labels:
  - `ui`
  - `library`
  - `design-system`
  - `docs`
- Suggested priority:
  - high for Issue 1, 2, and 3
  - medium for Issue 4 and 5
- Suggested dependency chain:
  - Issue 2 depends on Issue 1
  - Issue 3 can start after Issue 1, but Library/Audio/Folder rollout should merge after toolbar primitives exist
  - Issue 5 depends on all prior issues

## Notes For Linear Creation

- If an existing project is available, attach all five issues to `PROJECT_ID`.
- If no project exists, create the project first, then create the issues in the order listed above.
- Keep `TEAM_KEY` and `PROJECT_ID` as placeholders until the destination is confirmed.
