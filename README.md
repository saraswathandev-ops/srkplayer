# SKR Player

An offline video & audio player for Android built with bare React Native.

## Features

- Automatic device media scan (video + audio)
- Folder-based browsing
- Custom video player with gesture controls (seek / volume / brightness)
- Audio player with background playback & lock-screen notification
- Playlists, favorites, watch history & resume playback
- Thumbnail generation and caching
- Recycle bin for soft-deleted media

## Tech Stack

| Area | Library |
|---|---|
| Navigation | `@react-navigation/native` |
| Video playback | `react-native-video` |
| Audio / background | `react-native-track-player` |
| Media scan | `react-native-fs` (recursive scan) |
| Database | `expo-sqlite` |
| Images | `react-native-fast-image` |
| Icons | `react-native-vector-icons` |
| Gestures | `react-native-gesture-handler` |
| Haptics | `react-native-haptic-feedback` |

## Running

```bash
npx react-native start
# in a second terminal:
npx react-native run-android
```

See `APP_TECH_STACK.md` for full architecture and implementation notes.