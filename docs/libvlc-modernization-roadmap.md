# SRK Player 2.0 · libVLC modernization roadmap

Ship an Android media player that opens local videos quickly, handles varied media reliably, and makes playback controls easy to find. Make libVLC the default Android video engine after it meets the device, compatibility, and release gates below. Roll the migration out through existing SRK Player installations and preserve their libraries and preferences.

## Starting point and repository roles

- **SRK Player** owns the app and release pipeline. Android starts in `src/App.native.tsx`, video playback lives in `app/player.tsx`, and `services/PlayerManager.ts` coordinates audio and video. Video currently uses React Native Video with Media3 dependencies. React Native Track Player handles background audio, SQLite stores library data, and FFmpegKit handles video-to-audio conversion. The Vite app uses a separate browser playback path.
- **VLC** provides a source reference for libVLC APIs, decoder selection, tracks, subtitles, and player lifecycle. Review the matching headers and behavior for the Android artifact selected during the prototype. The cloud's headless VLC build is useful for source work and Linux tests. Android integration requires a separate build and device validation.
- **reverse-engineer-anything** provides examples of documenting observations and linking claims to evidence. Use authorized MX Player builds to observe interaction behavior on owned test media. Capture app version, device, input, timing, and visible results. Translate findings into requirements, then design SRK Player's own controls, layout, and artwork.

See the [architecture reference](app-architecture.md), [player controls](player-controls.md), and [production audit plan](production_audit_implementation_plan.md) for existing design and stability work.

## What 2.0 delivers

| Area | User experience |
| --- | --- |
| First launch | Explain why library access helps. Keep **Open a file** available when broader media access is declined. Accept Android file-open intents and return to the right screen after permission prompts. |
| Library | Show recent videos and resume progress from the local index. Provide folders, search, sorting, favorites, and playlists. Show scan progress and give recovery actions for unavailable storage or expired access. |
| Now playing | Keep play, seek, next and previous, and track controls visible when the overlay is open. Support double-tap seeking, swipe volume and brightness, fit modes, orientation changes, and control lock. Provide visible alternatives to gestures and TalkBack labels. |
| Tracks and subtitles | Select embedded audio and subtitle tracks, add an external subtitle through Android's picker, and adjust subtitle size and timing where the pinned libVLC version supports them. Preserve per-video preferences when the same tracks are available. |
| Resume and queues | Save position during playback and on lifecycle transitions. Give users a clear **Start over** action. Keep queue order and history through app updates and engine changes. |
| Streaming and recovery | Open supported stream URLs with buffering feedback and cancellation. Explain permission, network, and decoder errors in plain language and show the relevant recovery action. |
| Audio and conversion | Preserve audio queues, background controls, focus behavior, and existing conversion flows during the video migration. |

## Target architecture

1. **Playback contract.** Add a narrow Android video-engine interface behind the current screen and session coordination. Cover open, play, pause, seek, playback rate, track listing and selection, subtitle attachment, surface binding, and release. Define states such as opening, buffering, playing, ended, and failed. Use milliseconds for public positions and distinguish seek requests from completed seeks.
2. **Native ownership.** A Kotlin libVLC adapter owns libVLC objects, the video surface, and native callbacks. Confine lifecycle mutations to a controlled execution context, detach listeners and surfaces on release, and tag events with a session ID so late events cannot affect the next video. Coalesce progress updates before crossing into React Native.
3. **App ownership.** Reuse `PlayerManager` for audio and video coordination. The app owns queues, resume positions, history, favorites, and gesture state. Use stable media identity across engine changes. Prefer a supported content URI or file descriptor path and validate persisted grants after app restart. Keep transient access and removable storage behavior explicit.
4. **Compatibility and rollout.** Start with Media3 as the baseline and add an opt-in libVLC engine. Ship libVLC as the default once both engines have been compared. Keep a rollback setting during rollout. Start with manual decoder recovery. For any later automatic handoff, identify recoverable error classes, cap attempts at one, preserve the position where practical, and retain the existing session's media identity.
5. **Dependency and distribution.** Pin the Android libVLC version and verify its public API, supported ABIs, package availability, licenses and notices, and 16 KB page-size support. Evaluate a custom native build only if the packaged artifact leaves a measured compatibility or distribution gap.

## Delivery plan

| Phase | Pull request slices | Exit gate |
| --- | --- | --- |
| **0. Reproduce and measure** | Repair npm lock metadata and validate a fresh install. Resolve Android Maven access and build a Linux CI debug APK. Add a documented fixture and device matrix. Measure the existing Android video path. | A clean checkout produces an installable APK. At least one lower-end and one midrange device produce a reproducible performance and compatibility baseline. |
| **1. Integrate libVLC** | Wrap the current player with the engine interface and verify parity. Add the pinned libVLC adapter and surface. Connect lifecycle, error reporting, tracks, subtitles, and a development engine selector. | Both engines run against the same UI and core fixtures. Opening a real picker URI, seeking, rotating, switching tracks, and leaving playback succeed. Rapid switches release old sessions and ignore stale callbacks. |
| **2. Modernize playback** | Build the original player layout and accessible controls. Add gesture handling and feedback, track and subtitle sheets, orientation and fit controls, resume, and actionable error screens. Compare interactions with the observations recorded from MX Player and VLC. | The playback acceptance flows work with touch and TalkBack. Rotation, background and foreground transitions, and interruptions preserve the correct session and position. |
| **3. Modernize the library** | Add permission and file-open flows. Render cached data first. Index changes incrementally, batch database writes, virtualize large lists, and queue bounded and cancellable thumbnail jobs. Add migration and recovery coverage for older installs. | Large libraries stay responsive during scans. Users can recover from denied permissions and moved media. Upgrading retains playlists, favorites, history, settings, and resume positions. |
| **4. Make libVLC the default** | Compare engines and fix regressions. Verify release signing, ABI coverage, APK size, notices, and update behavior. Pilot libVLC with an opt-in cohort, then stage the default rollout and exercise rollback. | The release gates below pass. The team can switch back to Media3 without corrupting library or playback state. |
| **5. Expand after 2.0** | Evaluate PiP, A–B repeat, dual subtitles, sleep timer, and additional stream protocols in independent PRs. Evaluate libVLC background audio separately with media session and external control tests. | Each feature earns its own device validation and preserves the 2.0 playback and stability targets. |

Playback UI and library work can proceed in parallel once the playback contract and data migration boundaries are stable. The first implementation milestone is a reproducible debug APK and a libVLC prototype that plays a file-picker URI, seeks, switches tracks, and releases cleanly on Android.

## Release gates and test matrix

- **Media coverage.** Use versioned fixtures for MP4/H.264/AAC, multi-track MKV, external SRT and embedded subtitles, seek-heavy files, local audio, and representative HLS. Exercise damaged media, unsupported codecs, interrupted connections, and timeouts. Record per-engine differences and supported recovery actions.
- **Android coverage.** Exercise supported OS versions on both device classes, including newer Android storage restrictions. Test fresh install and upgrade, file-open intents, permission revocation, removable storage where available, rotation, background and foreground, headset disconnect, audio focus, quick switching, and process recreation.
- **Performance.** Record cold and warm first-frame latency, seek-to-frame latency, dropped frames, peak memory, CPU and battery use, scan time, scroll jank, and APK size. Agree on numerical targets after the baseline. Compare engines with the same fixtures and devices and investigate regressions before making libVLC the default.
- **Data integrity and accessibility.** Verify repeatable migrations against representative older databases. Verify recovery preserves playable media and user data. Check TalkBack traversal, touch targets, visible focus and state, and alternatives to gestures.
- **Delivery.** Require typecheck, lint, web build, Android debug and signed release builds, and device playback checks before release. Confirm release artifact versioning and rollback. Keep playback diagnostics local or explicitly opt-in and avoid collecting filenames or private URLs.

## Cloud baseline and outstanding work

The cloud setup verified the web build, typecheck, lint, browser media import and playback, Metro Android bundling, and the headless VLC build. The headless VLC suite passed 99 tests with five skipped. During that setup, Google Maven returned HTTP 503 for required AndroidX dependencies, so Android APK production, installation, playback, and device benchmarks still need verification. Recheck the artifact access in Phase 0 before estimating the migration.

## Implementation status and Android acceptance run

The Android app now has a persisted **Settings → Playback & Gestures → Video engine** selector. Media3 is the default for existing settings and libVLC 3.7.7 is available for opt-in testing. The libVLC surface supports content descriptors, playback, progress, seeking, audio-track selection, decoder switching, and subtitle selection and import. The playback error screen offers an explicit Media3 retry for the current file. The npm lock is synchronized and CI installs it with `npm ci`.

The cloud runner could resolve the earlier Google Maven probe on retry. The current APK build stops during dependency resolution because JitPack denies BlurView and KotlinAudio downloads. Maven Central also redirects React Android binaries to `repo.reactnative.dev`, which the cloud proxy denies. Resolve these artifact routes and verify a real device before enabling libVLC by default.

Run the following on lower-end and midrange Android devices after a debug APK builds. Record the device, OS, build, fixture, engine, expected result, actual result, and measurements for each row. Run the same fixtures under Media3 for comparison.

| Check | Procedure and expected result |
| --- | --- |
| Install and settings | Upgrade an existing install and verify its library, history, playlists, and settings. Switch to libVLC, restart the app, and verify the selection persists. |
| File access | Open a local MP4 and multi-track MKV from the library. Pass a picker-provided content URI to playback and verify the first frame, duration, and seek. Revoke access and verify the error and recovery path. |
| Player and resume | Seek while playing and paused. Switch hardware and software decoding mid-file. Confirm position, speed, aspect mode, mute, and volume. Reopen the file and verify resume and start-over choices. |
| Tracks | Switch audio tracks, select and disable embedded subtitles, and import an SRT from the file picker. Cancel the picker without changing tracks. Try inaccessible and malformed subtitle files and check feedback. |
| Lifecycle | Rotate, background and foreground, switch files rapidly including clips sharing a source, and return to the library. Verify surfaces, descriptors, and audio are released and stale events leave the current session alone. |
| Queue and fallback | Play through the end, test repeat, and advance to a second item. Trigger a libVLC playback error and use **Try Media3**. Verify one retry, usable error feedback, and consistent position and history. |
| Packaging | Build debug and signed release variants, check the actual APK's shared libraries and ZIP alignment, then launch on a 16 KB page-size device. Verify both video engines and background audio in the packaged app. |

After this run, the remaining 2.0 work includes Android file-open and permission onboarding, library indexing and migration, persisted per-video subtitle preferences and subtitle appearance controls, accessibility passes, comparative benchmarks, and the staged default rollout described above.
