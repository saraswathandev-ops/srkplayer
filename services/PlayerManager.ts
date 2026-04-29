import TrackPlayer from 'react-native-track-player';

type MediaType = 'video' | 'audio' | null;

type StopVideoFn = () => void;

/**
 * Central coordinator — guarantees only one media session is active at a time.
 *
 * Video player (react-native-video) is controlled via a registered callback.
 * Audio player (react-native-track-player) is controlled directly.
 *
 * Usage:
 *   PlayerManager.getInstance().setVideoStopHandler(() => videoRef.current?.pause());
 *   PlayerManager.getInstance().playVideo();   // stops audio, marks video active
 *   PlayerManager.getInstance().playAudio();   // stops video, marks audio active
 *   PlayerManager.getInstance().stopAll();     // stops everything
 */
class PlayerManagerClass {
  private static instance: PlayerManagerClass;

  private current: MediaType = null;
  private stopVideoCallback: StopVideoFn | null = null;

  private constructor() {}

  static getInstance(): PlayerManagerClass {
    if (!PlayerManagerClass.instance) {
      PlayerManagerClass.instance = new PlayerManagerClass();
    }
    return PlayerManagerClass.instance;
  }

  /** Register a callback that pauses/stops the active video player instance. */
  setVideoStopHandler(fn: StopVideoFn | null): void {
    this.stopVideoCallback = fn;
  }

  /** Call before launching video playback. Stops any active audio session. */
  async playVideo(): Promise<void> {
    if (this.current === 'audio') {
      await this.stopAudio();
    }
    this.current = 'video';
  }

  /** Call before launching audio playback. Stops any active video session. */
  async playAudio(): Promise<void> {
    if (this.current === 'video') {
      this.stopVideo();
    }
    this.current = 'audio';
  }

  /** Stop only the video player (does not touch TrackPlayer). */
  stopVideo(): void {
    if (this.stopVideoCallback) {
      this.stopVideoCallback();
    }
    if (this.current === 'video') {
      this.current = null;
    }
  }

  /** Stop only the audio player (does not touch video). */
  async stopAudio(): Promise<void> {
    try {
      await TrackPlayer.stop().catch(() => undefined);
      await TrackPlayer.reset().catch(() => undefined);
    } catch {
      // TrackPlayer may not be initialized yet — safe to ignore
    }
    if (this.current === 'audio') {
      this.current = null;
    }
  }

  /** Stop both video and audio. Safe to call at any time. */
  async stopAll(): Promise<void> {
    this.stopVideo();
    await this.stopAudio();
    this.current = null;
  }

  /** Current active session type. */
  get activeType(): MediaType {
    return this.current;
  }

  /** True if a media session is active. */
  get isActive(): boolean {
    return this.current !== null;
  }
}

export const PlayerManager = PlayerManagerClass.getInstance();
