import TrackPlayer, {
    Capability,
    Event,
    RepeatMode,
    Track,
    useTrackPlayerEvents,
} from 'react-native-track-player';
import { NativeModules } from 'react-native';
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
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play().catch(() => undefined));
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause().catch(() => undefined));
    TrackPlayer.addEventListener(Event.RemoteStop, () =>
        TrackPlayer.stop()
            .then(() => TrackPlayer.reset())
            .catch(() => undefined)
    );
    TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext().catch(() => undefined));
    TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious().catch(() => undefined));
    TrackPlayer.addEventListener(Event.RemoteSeek, (event) =>
        TrackPlayer.seekTo(event.position).catch(() => undefined),
    );
    // Duck audio when another app needs audio focus
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
        if (event.paused) {
            await TrackPlayer.pause().catch(() => undefined);
        } else {
            await TrackPlayer.play().catch(() => undefined);
        }
    });
};

// ---------------------------------------------------------------------------
// Player setup
// ---------------------------------------------------------------------------
let isSetup = false;

export async function setupTrackPlayer(): Promise<void> {
    if (isSetup) return;
    try {
        await TrackPlayer.setupPlayer({
            maxCacheSize: 1024 * 5, // 5 MB cache
        });
        await TrackPlayer.updateOptions({
            // Notification compact view: only Play, Pause
            capabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.Stop,
                Capability.SeekTo,
            ],
            // The buttons shown in the collapsed notification
            compactCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.Stop,
            ],
            notificationCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.Stop,
                Capability.SeekTo,
            ],
            progressUpdateEventInterval: 1,
        });
        await TrackPlayer.setRepeatMode(RepeatMode.Off);
        isSetup = true;
    } catch {
        // Already set up – mark as ready anyway
        isSetup = true;
    }
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
