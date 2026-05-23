import { type VideoRef } from "react-native-video";
import type { VideoPlayerShim, VideoThumbnail } from "./player.types";

export function createVideoPlayerShim(videoRef: React.RefObject<VideoRef | null>): VideoPlayerShim {
  let _playing = false;
  let _currentTime = 0;
  let _duration = 0;
  let _loop = false;
  let _playbackRate = 1;
  let _volume = 1;
  let _muted = false;


  return {
    get playing() { return _playing; },
    get currentTime() { return _currentTime; },
    set currentTime(v: number) {
      _currentTime = v;
      videoRef.current?.seek(v);
    },
    get duration() { return _duration; },
    get loop() { return _loop; },
    set loop(v: boolean) { _loop = v; },
    get playbackRate() { return _playbackRate; },
    set playbackRate(v: number) { _playbackRate = v; },
    get volume() { return _volume; },
    set volume(v: number) { _volume = v; },
    get muted() { return _muted; },
    set muted(v: boolean) { _muted = v; },
    audioMixingMode: "doNotMix",
    staysActiveInBackground: false,
    showNowPlayingNotification: false,
    keepScreenOnWhilePlaying: true,
    play() {
      _playing = true;
      // Belt-and-braces: declarative `paused` prop is the primary control,
      // but call native resume() too in case the prop change is missed mid-state.
      try { (videoRef.current as any)?.resume?.(); } catch { }
    },
    pause() {
      _playing = false;
      try { (videoRef.current as any)?.pause?.(); } catch { }
    },
    release() { _playing = false; },
    async replaceAsync(_uri: string) {
      // react-native-video re-renders when `source` prop changes — just update state
      _currentTime = 0;
      _playing = false;
    },
    async generateThumbnailsAsync(_times: number[]): Promise<VideoThumbnail[]> {
      // Thumbnail generation is handled separately by react-native-create-thumbnail.
      return [];
    },
    // Internal setters used by the polling interval
    _setPlaying(v: boolean) { _playing = v; },
    _setCurrentTime(v: number) { _currentTime = v; },
    _setDuration(v: number) { _duration = v; },
  } as unknown as VideoPlayerShim;
}
