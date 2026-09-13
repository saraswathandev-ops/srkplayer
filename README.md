# SKR Player

An offline video & audio player for Android built with bare React Native.

## Features

- Automatic device media scan (video + audio) with optimized batch processing
- Folder-based browsing
- Custom video player with gesture controls (seek / volume / brightness)
- Immersive edge-to-edge playback (hides system navigation & status bars)
- Audio player with background playback & lock-screen notification
- Playlists, favorites, watch history & resume playback
- Thumbnail generation and caching
- Recycle bin for soft-deleted media
- Crash loop protection (resets settings after 3 recorded fatal crashes, preserving the library)
- Persistent error logging to `crash_logs.txt` on the device

## Tech Stack

| Area | Library |
|---|---|
| Navigation | `@react-navigation/native` |
| Video playback | `react-native-video` |
| Audio / background | `react-native-track-player` |
| Media scan | `react-native-fs` (recursive scan) |
| Database | `react-native-sqlite-storage` |
| Images | `react-native-fast-image` |
| Icons | `react-native-vector-icons` |
| Gestures | `react-native-gesture-handler` |
| Haptics | `react-native-haptic-feedback` |
| System UI | `react-native-system-navigation-bar` |

## Running

```bash
npx react-native start
# in a second terminal:
npx react-native run-android
```

See [App Runtime](docs/architecture/app-runtime.md) and [AI Index](docs/AI_INDEX.md) for current architecture and implementation notes.

## Checks

- `npm run typecheck`
- `npm run lint` (existing unused-variable and hook-dependency debt is reported as warnings)
- `npm test` (isolated service regression tests with native storage/player mocks)

See [repair validation](docs/changelog/media-opening-repair-2026-09-09.md) for verified checks and the remaining Android device test matrix.
