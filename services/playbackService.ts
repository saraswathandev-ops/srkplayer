import TrackPlayer, { Event } from 'react-native-track-player';

/**
 * React Native Track Player background/headless service.
 *
 * Keep this module intentionally small: it is loaded by the Android
 * background task registration during application bootstrap. Do not import
 * the full trackPlayerService here because that module also depends on the
 * foreground player/context graph.
 */
export const PlaybackService = async function (): Promise<void> {
  try {
    TrackPlayer.addEventListener(Event.RemotePlay, () =>
      TrackPlayer.play().catch(() => undefined)
    );
    TrackPlayer.addEventListener(Event.RemotePause, () =>
      TrackPlayer.pause().catch(() => undefined)
    );
    TrackPlayer.addEventListener(Event.RemoteStop, () =>
      TrackPlayer.stop()
        .then(() => TrackPlayer.reset())
        .catch(() => undefined)
    );
    TrackPlayer.addEventListener(Event.RemoteNext, () =>
      TrackPlayer.skipToNext().catch(() => undefined)
    );
    TrackPlayer.addEventListener(Event.RemotePrevious, () =>
      TrackPlayer.skipToPrevious().catch(() => undefined)
    );
    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
      if (
        typeof event?.position === 'number' &&
        Number.isFinite(event.position)
      ) {
        TrackPlayer.seekTo(event.position).catch(() => undefined);
      }
    });
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
      if (event.paused) {
        await TrackPlayer.pause().catch(() => undefined);
      } else {
        await TrackPlayer.play().catch(() => undefined);
      }
    });
  } catch (error) {
    console.error('TrackPlayer PlaybackService setup failed', error);
  }
};
