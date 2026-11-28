export type PlaybackEngine = "media3" | "libvlc";

export interface PlaybackCommands {
  seek(seconds: number): void;
}

export function createPlaybackCommands(seek: (seconds: number) => void): PlaybackCommands {
  return {
    seek(seconds) {
      if (Number.isFinite(seconds)) seek(Math.max(0, seconds));
    },
  };
}

export function createVlcCommands(dispatchSeekMs: (milliseconds: number) => void): PlaybackCommands {
  return createPlaybackCommands(seconds => {
    const milliseconds = Math.round(seconds * 1000);
    if (Number.isSafeInteger(milliseconds)) dispatchSeekMs(milliseconds);
  });
}
