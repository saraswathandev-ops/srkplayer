# SKR Player — Tech Stack

## Current Tech Stack

The current project uses:

- **`react-native-video`**
  - the core video playback engine for the main player screen.
  - supports background playback, custom resize modes, and hardware acceleration.
  - backed by **ExoPlayer** on Android.

- **`react-native-screen-brightness`**
  - manages per-window brightness for the video player.
  - replaces the previous custom native `BrightnessModule` for a supported, maintained solution.

- **`@gorhom/bottom-sheet`**
  - used for playback speed selection, audio track picker, and subtitle picker menus.
  - replaces the previous custom modal implementations with a performant, gesture-driven sheet.

- **`react-native-track-player`**
  - handles audio playback, system notifications, and lock-screen controls.
  - used for the `Audio` tab and background audio handoff from the video player.

- **`@react-native-async-storage/async-storage`**
  - stores user settings, favorites, and simple state.

- **`react-native-sqlite-storage`**
  - the primary database for the media library, folders, history, and playlists.
  - handles high-performance batch operations and complex relationships.
  - configured with WAL (Write-Ahead Logging) for concurrent read/write support.

- **`react-native-system-navigation-bar`**
  - used for immersive fullscreen management in the video player.
  - handles hiding/showing of system navigation and status bars on Android.

- **`expo-crypto`**
  - generates IDs for videos and playlists

- **`@tanstack/react-query`**
  - provider exists in app root
  - currently not heavily used in actual feature flow

- **`@expo-google-fonts/inter` + `expo-font`**
  - font loading

- **`expo-splash-screen`**
  - keeps splash visible until fonts are ready

- **`react-native-safe-area-context`**
  - safe area handling

- **`react-native-gesture-handler`**
  - gesture support base

- **`react-native-keyboard-controller`**
  - keyboard behavior support

- **`expo-haptics`**
  - tactile feedback for user interactions

- **`@expo/vector-icons`**
  - icons used across the UI

- **`expo-blur`, `expo-glass-effect`, `expo-symbols`**
  - tab bar and iOS-native style presentation

## Product Story

A user installs the app and grants storage/media permission.

The app scans device folders and builds a local video library automatically.

When the user opens the app:

- Home shows recently watched videos
- Home shows continue watching
- Home shows favorites
- Home shows folder-based video sections

The user can:

- browse videos by folder like a file manager
- open any video in a powerful custom player
- control playback with gestures
- change playback speed
- use advanced player settings

While watching a video, the user can:

- lock controls
- take screenshots
- control brightness and volume with gestures
- switch decoder mode UI between HW and SW
- zoom, fit, fill, or stretch video
- use auto-rotate or lock orientation

When the app is minimized:

- background audio can continue if enabled

The app remembers:

- last watched position
- recently watched history
- player preferences
- favorites
- folder scan results
