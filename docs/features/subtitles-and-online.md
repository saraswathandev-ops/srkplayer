# Subtitles And Online

- Status: canonical
- Last updated: 2026-05-31 19:20 IST
- Source of truth: `hooks/useSubtitleGeneration.ts`, `services/subtitleService.ts`, `services/subtitleParser.ts`, `components/player/SubtitleBottomSheet.tsx`, `services/youtubeService.ts`, `services/recommendationService.ts`, `services/directVideoDownloads.ts`, `app/network-stream.tsx`, `app/(tabs)/youtube.tsx`, `android/app/src/main/java/com/skrplayer/*`
- Update when: subtitle generation/parsing, subtitle selection, native subtitle support state, YouTube browsing, recommendations, direct downloads, or online playback entry flows change
- Related docs: `docs/features/video-player.md`, `docs/reference/services.md`, `docs/screens/screens-reference.md`

## Covers

Subtitle generation and selection plus non-local content flows such as network streams and the YouTube tab.

## Subtitle Flow

- `hooks/useSubtitleGeneration.ts` is the player-facing integration layer.
- It subscribes to subtitle-service events, writes job state into the player store, and exposes:
  - `start`
  - `cancel`
  - `retry`
  - `reloadTracks`
  - `selectTrack`
- `services/subtitleService.ts` is the job/event layer.
- The JS service no longer treats mock generation as a normal fallback path.
- Runtime generation now depends on a registered native `SubtitleGenerator` module.
- `services/subtitleParser.ts` parses and post-processes subtitle text into timed segments for the overlay.
- Subtitle selection loads stored `.vtt` or `.srt` content and pushes parsed segments back into player state.

## Current Native Subtitle Status

- Android native wiring now exists through `android/app/src/main/java/com/skrplayer/SubtitleGeneratorPackage.kt` and `SubtitleGeneratorModule.kt`.
- The current native module is a scaffold, not a full `whisper.cpp` integration.
- `isSupported()` may report `false`, and generation requests may fail with an unsupported/native error until the real engine and model pipeline are added.
- `components/player/SubtitleBottomSheet.tsx` now surfaces three distinct states:
  - subtitle generation disabled in player settings
  - subtitle generation unavailable on the current runtime/device
  - subtitle generation enabled and callable
- Agents should not document live subtitle generation as fully working unless the native module behavior changes in code.

## Player Settings Link

- Player settings now control subtitle defaults and tooling such as:
  - default subtitle enablement
  - live subtitle generation availability
  - live preview availability
  - subtitle sync step size
  - low-confidence display behavior
- Subtitle UI and player behavior should be read together with `docs/features/video-player.md` when these defaults or gates change.

## YouTube and Online Content

- `services/youtubeService.ts` wraps YouTube Data API fetches and maps remote items into the app's `YouTubeVideoItem` shape.
- `app/(tabs)/youtube.tsx` is the browsing UI for YouTube/discovery content.
- `app/network-stream.tsx` accepts a raw stream URL and routes it into the normal player flow.
- `services/recommendationService.ts` provides suggested-video logic used by playback-related discovery surfaces.
- `services/directVideoDownloads.ts` contains direct download helpers for remote media workflows.

## Why This Is Separate

- These flows are not the same as the local-library model.
- They have different data sources, API risks, and failure modes.
- Player integration often touches both this file and `docs/features/video-player.md`.

## Update When

- Change subtitle job lifecycle, store integration, or parsing rules
- Change subtitle settings defaults or feature gates
- Change native subtitle support behavior or Android module ownership
- Add or remove YouTube/discovery behaviors
- Change stream URL intake or recommendation logic
- Change direct remote-download behavior
