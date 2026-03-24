# SKR Player App Documentation

## Implemented Player Feature Update

The app now includes these player behaviors in code:

- background audio playback setting for Android and iOS
- persisted playback speed selection
- persisted video size mode with `fit`, `expand`, and `stretch`
- previous / next transport controls
- folder-based mobile gallery sync with pull-to-refresh
- previous / next transition banner animation in the player
- right-side expandable utility rail in the player
- gesture HUD for seek, brightness, and volume feedback
- left vertical swipe for brightness
- right vertical swipe for volume
- horizontal swipe for seek
- player lock mode
- player night mode overlay
- player orientation cycling: auto / landscape / portrait
- frame capture preview from the current playback position
- responsive player info panel with portrait bottom sheet and landscape side panel
- scrollable playback details, metadata, and gesture help inside the player

### Current player logic now does the following

- saves playback speed into settings when changed from the player
- saves video size mode into settings when toggled from the player
- restores the saved size mode when reopening a video
- keeps audio playing in background only when `Background Audio` is enabled
- pauses on app background when `Background Audio` is disabled
- saves watch position on app background and player close
- animates previous / next changes without forcing a route jump
- exposes zoom utilities from the player utility rail instead of only bottom controls
- switches info layout based on available viewport space instead of using one fixed panel

### User-facing settings now include

- `Background Audio`
- `Playback Speed`
- `Video Size`
- `Loop Mode`
- `Seek Duration`

### Native config note

`app.json` now enables Expo Video background playback support:

```json
[
  "expo-video",
  {
    "supportsBackgroundPlayback": true
  }
]
```

This requires a native rebuild for Android/iOS builds to fully apply.

## 1. Project Direction

This application is evolving from a basic local video player into an advanced offline MX Player style app.

The target product is:

- fully local, no backend required
- automatic device video scanning
- folder-based browsing
- advanced custom video player
- persistent watch history and resume playback
- gesture-based playback controls
- user settings and playback preferences

The current codebase already has:

- Expo + React Native app structure
- Expo Router based navigation
- local library management
- playlists
- search
- settings
- custom player UI using `expo-video`

The next step is to upgrade the app to match the product story below.

## 2. Product Story

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

## 3. Current Tech Stack

The current project uses:

- **Expo 54**
- **React 19**
- **React Native 0.81**
- **TypeScript**
- **Expo Router**
- **Expo Video**
- **AsyncStorage**

### Current core libraries in use

- **`expo-router`**
  - file-based routing for tabs, playlist detail, and player screen

- **`expo-video`**
  - current playback engine
  - used in `app/player.tsx`

- **`expo-document-picker`**
  - currently used to import videos manually
  - this should be replaced or supplemented by media-library scanning

- **`@react-native-async-storage/async-storage`**
  - stores library, playlists, settings, favorites, and playback progress

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

### Dependency compatibility task

Expo reported a compatibility mismatch for `react-native-keyboard-controller`.

- expected for this Expo setup: `1.18.5`
- warning seen in local environment: `1.21.0`

Task to keep in the plan:

```bash
npx expo install react-native-keyboard-controller@1.18.5
```

If the warning still appears after updating `package.json`, remove the existing install and reinstall dependencies so `node_modules` matches the Expo-compatible version.

## 4. Required Product Upgrade

The current app is a flat-library local player.

The upgraded app should become a smarter MX Player clone with these modules.

### A. Smart Video Library

Goal:

- scan the device automatically instead of depending only on manual file picking

Features:

- request storage/media permission
- scan common folders like:
  - `/Movies`
  - `/Download`
  - `/WhatsApp Video`
- extract:
  - filename
  - duration
  - size
  - thumbnail
  - folder name
- group videos by folder
- cache scan results locally
- provide refresh scan action

Recommended library:

- **`expo-media-library`**

Notes:

- this is the main missing piece for moving from manual import to automatic media discovery

### B. Home Screen Upgrade

Goal:

- make Home behave like a mix of MX Player and a modern media dashboard

Sections:

- Continue Watching
- Recently Watched
- Favorites
- Folder previews
- total video stats

Improvements:

- horizontal carousels for folders
- lazy loading for large video lists
- faster resume entry points

### C. Advanced Video Player

Goal:

- provide a stronger custom playback experience

Basic playback controls:

- play / pause
- seek backward / forward
- configurable skip duration
- progress bar drag
- next / previous video

Queue controls:

- maintain active queue
- autoplay next item
- repeat one / repeat all
- shuffle

Zoom and resize:

- fit
- fill
- stretch
- pinch to zoom

Playback speed:

- 0.25x to 2x
- persist user preference

Player gestures:

- left vertical swipe for brightness
- right vertical swipe for volume
- horizontal swipe for seek

Advanced player utilities:

- screen lock / child lock
- orientation toggle
- auto-rotate setting
- HW / SW decoder switch UI
- screenshot feature
- night mode overlay

Background play:

- continue audio when minimized if enabled

### D. Recently Watched System

Goal:

- provide strong resume behavior

Store:

- `videoId`
- `lastPosition`
- `watchedAt`
- completion state

Behavior:

- show continue watching on Home
- remove from continue watching if completed
- maintain recently watched history list

### E. Folder Navigation Screen

Goal:

- browse the library like a file explorer

Features:

- folder list screen
- tap folder to open its videos
- breadcrumb path display
- folder preview thumbnails

### F. Smart Search

Goal:

- make search useful across a large local library

Search fields:

- video name
- folder name

Features:

- instant search
- highlighted matches
- sectioned results if needed

### G. Settings Upgrade

Add or expand:

- default playback speed
- gesture sensitivity
- autoplay toggle
- background play toggle
- subtitle default
- theme mode
- orientation preference
- decoder preference UI
- screenshot enable/disable

## 5. Recommended Architecture Upgrade

The current app uses one main context: `PlayerContext`.

That is acceptable for the current small app, but the upgraded app should split responsibility.

### Recommended context split

- **`VideoLibraryContext`**
  - scanned videos
  - folders
  - favorites
  - recent history
  - scanning state

- **`PlayerContext`**
  - current video
  - active queue
  - playback state
  - speed
  - loop/shuffle
  - lock state

- **`SettingsContext`**
  - theme
  - gestures
  - autoplay
  - background playback
  - subtitle defaults
  - decoder mode UI setting

This split will reduce context bloat and make player behavior easier to maintain.

## 6. Data Model Upgrade

### Video model

```ts
type Video = {
  id: string;
  uri: string;
  title: string;
  duration: number;
  size: number;
  folder: string;
  thumbnail: string;
  lastPosition?: number;
  isFavorite?: boolean;
  playCount?: number;
  watchedAt?: number;
};
```

### Folder group model

```ts
type VideoFolderGroup = {
  folderName: string;
  folderPath: string;
  videos: Video[];
};
```

### Player queue model

```ts
type PlayerQueue = {
  currentIndex: number;
  videos: Video[];
  shuffle: boolean;
  repeatMode: "none" | "one" | "all";
};
```

### Watch history model

```ts
type WatchHistoryItem = {
  videoId: string;
  lastPosition: number;
  watchedAt: number;
  completed: boolean;
};
```

## 7. Recommended Library Changes

### Libraries to add

```bash
npx expo install expo-media-library
npx expo install expo-brightness
npx expo install expo-screen-orientation
npx expo install expo-audio
npm install react-native-view-shot
npx expo install react-native-gesture-handler
```

### Why these are needed

- **`expo-media-library`**
  - for permission handling and device media scanning

- **`expo-brightness`**
  - for brightness gesture support

- **`expo-screen-orientation`**
  - for manual orientation lock and rotation control

- **`expo-audio`**
  - preferred for audio-specific work if extra audio APIs are needed
  - better aligned with current Expo direction than `expo-av`

- **`react-native-view-shot`**
  - for screenshot capture feature

- **`react-native-gesture-handler`**
  - already present, but it becomes much more important for advanced gestures

### Additional practical note

The current app uses `expo-video` for playback. Before implementing advanced background audio and player-specific features, decide whether to:

- continue with `expo-video` and extend around it
- or move some playback features to a mixed `expo-video` + `expo-audio` stack

That decision affects player implementation complexity.

### Important update

Avoid planning new work around `expo-av` for this app.

- Current Expo documentation marks `expo-av` audio/video APIs as deprecated in favor of `expo-video` and `expo-audio`.
- Since this project already uses `expo-video`, background playback and player behavior should stay centered around `expo-video` first.

## 8. Module-by-Module Implementation Plan

### Module 1: Media scanning

- add storage/media permission flow
- scan media library
- map scanned assets into app video model
- group by folders
- cache results
- support manual refresh

### Module 2: Home redesign

- continue watching section
- recent history section
- favorites section
- folder preview sections
- lazy list rendering

### Module 3: Queue-based player

- introduce queue state
- next / previous support
- autoplay next
- shuffle and repeat

### Module 4: Resume playback system

- save position periodically
- load saved position on reopen
- mark as completed near end of playback

### Module 5: Gesture player controls

- volume swipe
- brightness swipe
- seek swipe
- lock mode

### Module 6: Advanced playback utilities

- zoom modes
- fit/fill/stretch
- orientation control
- night mode
- screenshot

### Module 7: Settings expansion

- background play
- default speed
- gesture sensitivity
- decoder UI setting
- theme and subtitles

## 9. Missing Technical Notes To Add

These points were missing or under-specified in the weekly implementation logic and should be added to the plan.

### A. Media library loading must use pagination

Do not load all videos with one large call like `first: 1000`.

Use paginated loading:

- `getAssetsAsync({ first: 50 })` or `getAssetsAsync({ first: 100 })`
- continue with `after: endCursor`
- stop when `hasNextPage` is false

Reason:

- large libraries will make the app slow
- paged loading is already supported by Expo MediaLibrary

### B. Permission handling needs more than granted / denied

The plan should include:

- `all`
- `limited`
- `none`

If access is limited:

- show partial-library state
- give the user a refresh / reselect flow
- handle cases where only some videos are visible

### C. Folder detection should not rely only on splitting `asset.uri`

This logic is weak:

```ts
item.uri.split("/")[item.uri.split("/").length - 2]
```

Why it is risky:

- URI structure is platform-dependent
- media-library URIs are not guaranteed to map cleanly to physical folders
- scoped storage can hide true file paths

Better plan:

- treat albums and folders separately in the data model
- use media library album APIs where possible
- store a fallback folder label if a real folder cannot be resolved

### D. App config and native permission notes should be part of the plan

The doc should explicitly mention:

- media-library usage descriptions
- Android media permissions
- Android brightness permission if system brightness is changed
- background playback plugin config for `expo-video`
- orientation config for iOS full-screen cases if needed

These are not only runtime features. Some require native config and a rebuild.

### E. Background playback should be designed around `expo-video`

Instead of planning background playback only as:

```ts
Audio.setAudioModeAsync({
  staysActiveInBackground: true,
});
```

The plan should also include:

- `expo-video` config plugin with `supportsBackgroundPlayback: true`
- player property `staysActiveInBackground`
- development build / native rebuild when config changes are added

### F. Player state should use events where possible

The current weekly plan focuses mainly on intervals.

Add:

- player event listeners for playback state
- ended / completion event handling
- ready/loading/error states

Intervals can still be used for periodic progress saving, but core playback transitions should be event-driven.

### G. Resume playback needs save-on-exit, not only save-on-interval

Add these save points:

- periodic save every 2s or 3s
- save on player close
- save on app background
- save on screen unmount

Also define completion threshold, for example:

- if watched above 95%, mark completed
- reset continue-watching entry

### H. Queue model needs source context

For next / previous to work correctly, the queue should know where it came from.

Add:

- queue source type: library / folder / playlist / search result
- current index
- repeat mode
- shuffle state

This prevents incorrect next/prev behavior when a video is opened from different screens.

### I. Home screen performance needs explicit list strategy

The plan should call out:

- `FlatList` or `SectionList`
- memoized section selectors
- lightweight cards
- thumbnail strategy
- avoid rendering all folders at once

Without this, folder previews and history sections will become expensive quickly.

### J. Screenshot support has a practical limitation

The doc should note that capturing a video surface is not always reliable with `react-native-view-shot`.

Some native video-backed views can return blank or black captures depending on platform and rendering path.

So the plan should include:

- prototype first on the actual player screen
- document fallback behavior if direct player capture fails

### K. Folder routes need safe encoding

For navigation like:

```ts
router.push(`/folder/${folderName}`);
```

Add:

- encode route params safely
- avoid raw folder names in paths if names contain spaces or symbols
- prefer IDs or encoded params

### L. Scanning should support refresh and incremental updates

Add:

- manual refresh button
- pull-to-refresh if a folder screen is used
- merge strategy for newly found assets
- remove missing assets on rescan

Otherwise the cache will drift from the device library.

## 10. 14-Day Execution Plan With Task Tags

### Tag legend

- `[Task]` implementation task
- `[Service]` shared service or utility work
- `[Context]` state-management work
- `[UI]` screen or component work
- `[Perf]` performance requirement
- `[Config]` app config, permission, or native setup work
- `[Note]` important platform or Expo-specific constraint

### Week 1: Core system

**Day 1-2**

- `[Task]` install `expo-media-library`
- `[Service]` create `services/mediaService.ts`
- `[Service]` add `getAllVideos()` with pagination, not `first: 1000`
- `[Perf]` use `getAssetsAsync({ first: 50 })` or `getAssetsAsync({ first: 100 })`
- `[Perf]` continue loading with `after: endCursor` until `hasNextPage` is false
- `[Context]` create `context/VideoLibraryContext.tsx`
- `[Context]` store `videos`, `folders`, `scanState`, `permissionState`
- `[Context]` call `loadVideos()` on app start
- `[Task]` persist scan results with AsyncStorage
- `[Config]` add media-library permission setup to app config if needed
- `[Note]` do not rely only on `item.uri.split("/")` for folder name
- `[Note]` prefer album/folder metadata when available and keep fallback folder labels

Suggested service shape:

```ts
type ScannedVideo = {
  id: string;
  uri: string;
  filename: string;
  duration: number;
  creationTime: number;
  folder: string;
};
```

**Day 3**

- `[Service]` create `groupByFolder(videos)`
- `[Context]` expose derived `folderGroups`
- `[UI]` create `app/folders.tsx`
- `[UI]` show folder list with counts and preview thumbnails
- `[UI]` add route to folder detail screen
- `[Task]` navigate with safe encoded params, not raw folder names
- `[Note]` use IDs or encoded folder keys for `router.push()`

**Day 4**

- `[UI]` add Continue Watching section
- `[UI]` add Recently Watched section
- `[UI]` add Favorites section
- `[UI]` add Folder Preview horizontal sections
- `[Task]` use `videos.filter(v => v.lastPosition > 0 && v.lastPosition < v.duration)` for continue-watching
- `[Perf]` build Home with vertical `FlatList` and horizontal nested lists only for visible sections
- `[Perf]` memoize section selectors to avoid full-screen rerenders
- `[UI]` keep total stats card and enhance it instead of replacing it

**Day 5-6**

- `[Context]` extend `PlayerContext` with `queue`, `currentIndex`, `repeatMode`, `shuffle`
- `[Task]` add `playVideo(videos, index)` API
- `[Task]` add `playNext()` and `playPrev()`
- `[Task]` support queue source types: library, folder, playlist, search
- `[UI]` add next/previous buttons to player controls
- `[Task]` wire auto-next using `expo-video` completion events
- `[Note]` do not rely on `status.didJustFinish` from old `expo-av` examples; adapt to `expo-video` events/state
- `[Task]` keep queue data in sync when the current source list changes

**Day 7**

- `[Task]` save last position every 2s or 3s during playback
- `[Task]` save again on player close
- `[Task]` save again on app background
- `[Task]` restore playback with `player.currentTime = lastPosition`
- `[Task]` mark videos completed when watched above threshold, for example 95%
- `[UI]` remove completed items from Continue Watching
- `[Note]` for `expo-video`, use `currentTime` instead of `seekTo()`

### Week 2: Advanced player

**Day 8**

- `[Task]` confirm `react-native-gesture-handler` is installed with Expo-compatible version
- `[Task]` add vertical gesture zones to the player
- `[Task]` map left side swipe to brightness
- `[Task]` map right side swipe to volume
- `[Task]` add gesture sensitivity setting
- `[Service]` brightness control through `expo-brightness`
- `[Note]` volume control should be designed around the actual player/audio APIs in use, not old `expo-av` assumptions

**Day 9**

- `[Task]` add resize mode toggle
- `[Task]` support `contain`, `cover`, and `fill`
- `[Task]` prototype pinch-to-zoom gesture
- `[Note]` `expo-video` uses `contentFit`, not `resizeMode`
- `[Note]` `stretch` is not a native `expo-video` `contentFit` mode and would need a custom approximation if required

**Day 10**

- `[Task]` add player lock state
- `[UI]` hide controls while locked
- `[UI]` require deliberate unlock action
- `[Task]` install and integrate `expo-screen-orientation`
- `[Task]` support auto, portrait, and landscape modes
- `[Config]` note if a rebuild is needed after orientation-related native changes

**Day 11**

- `[Task]` add speed selector popup
- `[Task]` support `0.5x`, `1x`, `1.5x`, `2x`
- `[Task]` persist selected speed in settings
- `[Note]` with `expo-video`, use `player.playbackRate`, not `player.rate`
- `[UI]` polish controls, spacing, and overlay visibility

**Day 12**

- `[Task]` enable background playback behavior in the player layer
- `[Config]` add `expo-video` background playback plugin/config support
- `[Task]` set player `staysActiveInBackground` where appropriate
- `[Task]` add user-facing background play toggle in settings
- `[Note]` this may require a development build or native rebuild
- `[Note]` avoid centering this implementation around deprecated `expo-av`

**Day 13**

- `[Task]` install `react-native-view-shot`
- `[Task]` prototype screenshot capture on the real video player screen
- `[Note]` video surfaces can return blank or black screenshots on some platforms
- `[Task]` add fallback behavior if direct capture fails
- `[UI]` add night mode overlay with adjustable opacity
- `[UI]` allow users to toggle night mode quickly from the player

**Day 14**

- `[Context]` finalize settings store
- `[Task]` add `speed`, `autoPlay`, `brightnessGesture`, `backgroundPlay`, and related toggles
- `[Task]` test multiple file types and edge cases
- `[Task]` verify resume playback works after app restart
- `[Task]` verify next/prev and auto-next work from each queue source
- `[Task]` verify gesture smoothness and control lock state
- `[Task]` verify no crashes during background/foreground transitions
- `[Task]` clean dependency warnings and Expo compatibility issues

## 11. Current App vs Target App

### Current app

- manual video import
- flat video library
- playlists
- custom player controls
- search by title
- basic settings
- watch progress saving

### Target app

- automatic video scanning
- folder-based navigation
- richer home dashboard
- active queue and autoplay next
- advanced gestures
- orientation and lock controls
- screenshot support
- background play
- richer watch history
- stronger settings system

## 12. Local Run Guide

### Standard local development

Use:

```bash
npm install
npx expo start
```

Then:

- press `a` for Android
- press `i` for iOS
- press `w` for web
- or scan the QR code in Expo Go

### Native run commands

If Android Studio or Xcode are configured:

```bash
npm run android
npm run ios
```

### Type checking

```bash
npm run typecheck
```

### Production-style static build

```bash
npm run build
npm run serve
```

### Important note

The existing `npm run dev` script is Replit-specific because it depends on Replit environment variables. For normal local development, use `npx expo start`.

## 13. Final Vision

The final goal is an offline MX Player clone with:

- smart local video discovery
- folder-first browsing
- advanced custom playback
- strong resume and watch history
- gesture-based controls
- persistent settings
- no backend dependency

This keeps the app fully local while giving it a much more complete media-player experience.

## 14. Do Now Tasks

These are the immediate tasks to execute next in the codebase.

### Priority 1

- `[Task]` fix Expo package compatibility warning
- `[Task]` run `npx expo install react-native-keyboard-controller@1.18.5`
- `[Task]` reinstall dependencies if Metro still reports the wrong version

### Priority 2

- `[Task]` install `expo-media-library`
- `[Service]` create `services/mediaService.ts`
- `[Context]` create `context/VideoLibraryContext.tsx`
- `[Task]` load scanned videos on app start
- `[Task]` persist scanned results in AsyncStorage

### Priority 3

- `[Service]` create folder grouping helper
- `[UI]` create `app/folders.tsx`
- `[UI]` create folder detail route
- `[Task]` add safe route params for folder navigation

### Priority 4

- `[Context]` extend `PlayerContext` with queue state
- `[Task]` add `playVideo`, `playNext`, and `playPrev`
- `[UI]` expose next/previous controls in player
- `[Task]` save and restore playback position from scanned library items

## 15. Reference Task Snippets

These snippets should be treated as starting points, not final production code.

### `services/mediaService.ts`

```ts
import * as MediaLibrary from "expo-media-library";

export async function getAllVideosPage(after?: string) {
  const permission = await MediaLibrary.requestPermissionsAsync();

  if (!permission.granted) {
    return { assets: [], endCursor: undefined, hasNextPage: false };
  }

  const media = await MediaLibrary.getAssetsAsync({
    mediaType: "video",
    first: 100,
    after,
    sortBy: [MediaLibrary.SortBy.creationTime],
  });

  return {
    assets: media.assets.map((item) => ({
      id: item.id,
      uri: item.uri,
      filename: item.filename,
      duration: item.duration,
      creationTime: item.creationTime,
      folder: "Unknown",
    })),
    endCursor: media.endCursor,
    hasNextPage: media.hasNextPage,
  };
}
```

### `context/VideoLibraryContext.tsx`

```ts
const [videos, setVideos] = useState<ScannedVideo[]>([]);
const [loading, setLoading] = useState(false);

const loadVideos = async () => {
  setLoading(true);
  const allVideos: ScannedVideo[] = [];
  let after: string | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await getAllVideosPage(after);
    allVideos.push(...page.assets);
    after = page.endCursor;
    hasNextPage = page.hasNextPage;
  }

  setVideos(allVideos);
  await AsyncStorage.setItem("videos", JSON.stringify(allVideos));
  setLoading(false);
};
```

### Group by folder

```ts
const groupByFolder = (videos: ScannedVideo[]) =>
  Object.values(
    videos.reduce<Record<string, { name: string; videos: ScannedVideo[] }>>(
      (acc, video) => {
        const folderName = video.folder || "Unknown";
        if (!acc[folderName]) {
          acc[folderName] = { name: folderName, videos: [] };
        }
        acc[folderName].videos.push(video);
        return acc;
      },
      {}
    )
  );
```

## 16. Final Architecture Flow

```text
MediaLibrary / mediaService
        ↓
VideoLibraryContext
        ↓
Home / Folders / Search / Playlist sources
        ↓
PlayerContext
        ↓
Player Screen
        ↓
Controls + Gestures + Settings
```

### Flow notes

- `VideoLibraryContext` owns scanned videos, folders, refresh state, and cached library results.
- `PlayerContext` owns active queue, current index, playback-related UI state, and resume updates.
- Screens should consume derived selectors instead of rebuilding heavy arrays inline.
- Shared logic should stay in `services/`, reusable UI in `components/`, and state orchestration in `context/`.




---deploy

npx expo prebuild
cd android
.\gradlew assembleRelease
android/app/build/outputs/apk/release/app-release.apk



back log 
Media URI reliability. Device paths can expire or change, especially content:// and picker URIs. The app should persist access safely or re-resolve media through expo-media-library instead of assuming the raw path will always work.

Thumbnail pipeline. Video previews still depend on runtime generation in some flows. Better to generate/store thumbnails during import and sync, then fall back gracefully if generation fails.

Delete behavior. Right now there is no real recycle bin. If you want “temporary” and “permanent” delete properly, add a soft-delete table/status and a restore screen.

Playback source model. uri vs sourceUri vs clips should be cleaned up into one clear rule, otherwise local history, imported media, and trimmed clips can conflict again.

Local history UX. Recent/history items should always be tappable, show resume progress, and recover missing media with a clear “file moved or unavailable” state.

Device permission handling. On Android especially, media access should be handled more defensively for scoped storage and expired picker permissions.

Missing file checks. Before playback, the app should verify the file still exists and show a proper error with options like rescan, relink, or remove from library.

Import strategy decision. You need one consistent policy:
store original path or copy into app storage
Mixing both creates bugs in playback, deletion, and portability.

If you want, I can implement the next highest-value fix now: missing file detection + clean error handling, or proper soft-delete/recycle bin.   do now this not affect the previous flows