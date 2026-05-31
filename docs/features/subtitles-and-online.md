# Subtitles And Online

- Status: canonical
- Last updated: 2026-05-31 18:45 IST
- Source of truth: `hooks/useSubtitleGeneration.ts`, `services/subtitleService.ts`, `services/subtitleParser.ts`, `services/youtubeService.ts`, `services/recommendationService.ts`, `services/directVideoDownloads.ts`, `app/network-stream.tsx`, `app/(tabs)/youtube.tsx`
- Update when: subtitle generation/parsing, subtitle selection, YouTube browsing, recommendations, direct downloads, or online playback entry flows change
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
- `services/subtitleParser.ts` parses and post-processes subtitle text into timed segments for the overlay.
- Subtitle selection loads stored `.vtt` or `.srt` content and pushes parsed segments back into player state.

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
- Add or remove YouTube/discovery behaviors
- Change stream URL intake or recommendation logic
- Change direct remote-download behavior
