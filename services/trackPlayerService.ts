import TrackPlayer, {
    Capability,
    Event,
    RepeatMode,
    Track,
    useTrackPlayerEvents,
} from 'react-native-track-player';
import { NativeModules, AppState, Platform } from 'react-native';
import { type VideoItem } from '@/types/player';
import { getThumbnailUri } from '@/utils/thumbnailSource';

// ---------------------------------------------------------------------------
// Backwards-compatible exports used by player.tsx
// ---------------------------------------------------------------------------
export const isTrackPlayerAvailable = !!(
    NativeModules.TrackPlayerModule || NativeModules.RNTrackPlayer
);

export const useSafeTrackPlayerEvents = isTrackPlayerAvailable
    ? useTrackPlayerEvents
    : (_events: Event[], _handler: (event: unknown) => void) => {
        // no-op mock for Expo Go
    };


// ---------------------------------------------------------------------------
// PlaybackService – runs in background headless task
// ---------------------------------------------------------------------------
export const PlaybackService = async function () {
    try {
        TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play().catch(() => undefined));
        TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause().catch(() => undefined));
        TrackPlayer.addEventListener(Event.RemoteStop, () =>
            TrackPlayer.stop()
                .then(() => TrackPlayer.reset())
                .catch(() => undefined)
        );
        TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext().catch(() => undefined));
        TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious().catch(() => undefined));
        TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
            if (typeof event?.position === 'number' && Number.isFinite(event.position)) {
                TrackPlayer.seekTo(event.position).catch(() => undefined);
            }
        });
        // Duck audio when another app needs audio focus
        TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
            if (event.paused) {
                await TrackPlayer.pause().catch(() => undefined);
            } else {
                await TrackPlayer.play().catch(() => undefined);
            }
        });
    } catch (error) {
        console.error("TrackPlayer PlaybackService setup failed", error);
    }
};

// ---------------------------------------------------------------------------
// Player setup
// ---------------------------------------------------------------------------
export let isSetup = false;

export async function setupTrackPlayer(): Promise<void> {
    if (isSetup) return;

    // On Android, TrackPlayer setup must happen in foreground
    if (Platform.OS === 'android' && AppState.currentState !== 'active') {
        return;
    }

    try {
        try {
            await TrackPlayer.setupPlayer({
                maxCacheSize: 1024 * 5, // 5 MB cache
            });
        } catch (e) {
            console.log("TrackPlayer.setupPlayer already done or failed", e);
        }

        try {
            await TrackPlayer.updateOptions({
                // Notification primary buttons
                capabilities: [
                    Capability.Play,
                    Capability.Pause,
                    Capability.Stop,
                    Capability.SeekTo,
                    Capability.SkipToNext,
                    Capability.SkipToPrevious,
                ],
                // Android compact notification view (Max 3 usually)
                compactCapabilities: [
                    Capability.Play,
                    Capability.Pause,
                    Capability.SkipToNext,
                ],
                progressUpdateEventInterval: 1,
            });
        } catch (e) {
            console.log("TrackPlayer.updateOptions failed", e);
        }

        try {
            await TrackPlayer.setRepeatMode(RepeatMode.Off);
        } catch (e) {
            console.log("TrackPlayer.setRepeatMode failed", e);
        }

        isSetup = true;
    } catch (err) {
        console.error("Critical TrackPlayer setup error", err);
        // Do NOT set isSetup = true here — setup failed, so next call should retry.
    }
}

export function isTrackPlayerReady(): boolean {
    return isSetup;
}

// ---------------------------------------------------------------------------
// Helper: convert a VideoItem to an RNTP Track object
// ---------------------------------------------------------------------------
export function videoItemToTrack(video: VideoItem): Track {
    const artwork = getThumbnailUri(video.thumbnail) ?? undefined;

    return {
        // Keep original VideoItem metadata on the track object while preserving
        // the normalized RNTP fields below.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(video as any),
        id: video.id,
        url: video.uri,
        title: video.title,
        artist: video.artist ?? video.folder ?? 'Unknown',
        album: video.album ?? video.folder ?? 'Unknown Album',
        artwork,
        duration: video.duration > 0 ? video.duration / 1000 : undefined, // convert ms → s
    };
}
