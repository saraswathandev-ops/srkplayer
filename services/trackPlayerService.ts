import TrackPlayer, {
    Capability,
    Event,
    RepeatMode,
    Track,
    useTrackPlayerEvents,
} from 'react-native-track-player';
import { NativeModules } from 'react-native';
import { type VideoItem } from '@/types/player';

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
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
    TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
    TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
    TrackPlayer.addEventListener(Event.RemoteSeek, (event) =>
        TrackPlayer.seekTo(event.position),
    );
    TrackPlayer.addEventListener(Event.RemoteJumpForward, (event) =>
        TrackPlayer.seekBy(event.interval),
    );
    TrackPlayer.addEventListener(Event.RemoteJumpBackward, (event) =>
        TrackPlayer.seekBy(-event.interval),
    );
    // Duck audio when another app needs audio focus
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
        if (event.paused) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
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
            capabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.Stop,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.SeekTo,
                Capability.JumpForward,
                Capability.JumpBackward,
            ],
            compactCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
            ],
            progressUpdateEventInterval: 1000,
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
    const artwork =
        typeof video.thumbnail === 'string' ? video.thumbnail : undefined;

    return {
        id: video.id,
        url: video.uri,
        title: video.title,
        artist: video.folder ?? 'Unknown Artist',
        album: video.folder ?? 'Unknown Album',
        artwork,
        duration: video.duration > 0 ? video.duration / 1000 : undefined, // convert ms → s
        // Pass original VideoItem metadata through the extras field
        // so the UI can look it up if needed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(video as any),
    };
}
