export type ContentFitMode = "contain" | "cover" | "fill";

// Explicit playback state machine — replaces the implicit "isPlaying boolean
// + a dozen refs" model. Stall detector only runs in "playing"; recovery
// ladder only runs in "playing" or "buffering". See player.tsx for sites.
export type PlaybackState =
  | "idle"
  | "resolving"
  | "validating"
  | "loading"
  | "starting"
  | "stabilizing"
  | "playing"
  | "buffering"
  | "seeking"
  | "recovering"
  | "paused"
  | "ended"
  | "error";
export type PlaybackPhase = PlaybackState;
export type PlaybackFailureReason =
  | "buffering"
  | "decoder_stall"
  | "surface_lost"
  | "audio_focus_loss"
  | "unexpected_pause"
  | "startup_timeout"
  | "native_reset"
  | "unknown";
export type StartupMetrics = {
  navigationAt: number;
  sourceValidatedAt: number;
  loadStartAt: number;
  loadedAt: number;
  firstProgressAt: number;
  nativePlayingAckAt: number;
  stabilizationStartedAt: number;
  stabilizationConfirmedAt: number;
  startupAttempt: number;
  recoveryCount: number;
  rebufferCount: number;
  stallCount: number;
  success: boolean;
};
export type PlaybackSessionId = string;
export type PlaybackTransitionReason =
  | "screen_mount"
  | "video_switch_reset"
  | "source_validated"
  | "start_requested"
  | "source_loaded"
  | "native_started_stabilizing"
  | "startup_stable"
  | "startup_unstable"
  | "seek_started"
  | "seek_completed"
  | "startup_timeout"
  | "progress_advanced"
  | "native_playing_ack"
  | "native_buffering"
  | "native_buffering_cleared"
  | "user_pause"
  | "user_resume"
  | "recovery_started"
  | "recovery_tier_1"
  | "recovery_tier_2"
  | "recovery_tier_3"
  | "recovery_tier_4"
  | "audio_focus_or_noisy"
  | "playback_error"
  | "playback_ended"
  | "manual";
export type PlaybackLogContext = {
  sessionId: PlaybackSessionId;
  videoId?: string | null;
  state?: PlaybackState;
  generation?: number;
  startupAttempt?: number;
  recoveryTier?: number | null;
};
export type PlaybackHealthSnapshot = {
  now: number;
  playbackStartAt: number;
  lastProgressAt: number;
  lastRecoveryAt: number;
  lastNativeAckPlayingAt: number;
  isBuffering: boolean;
  startupGraceMs: number;
  recoveryCooldownMs: number;
};
export type RecoveryTier = 1 | 2 | 3;
export type StartupRecoveryTier = 1 | 2 | 3 | 4;
export type StartupAttempt = {
  id: number;
  generation: number;
  startedAt: number;
};
export type GestureMode = "volume" | "brightness" | "seek" | "zoom";
export type TapZone = "left" | "center" | "right";
export type VideoNaturalSize = { width: number; height: number };
export type DecoderMode = "hwPlus" | "hw" | "sw";
export type PlayerAudioTrack = {
  index: number;
  title?: string;
  language?: string;
  bitrate?: number;
  selected?: boolean;
};

// Local player shim backed by react-native-video's ref.
export type VideoThumbnail = { uri: string };

export type VideoPlayerShim = {
  play: () => void;
  pause: () => void;
  release: () => void;
  replaceAsync: (uri: string) => Promise<void>;
  generateThumbnailsAsync: (times: number[], opts?: { maxWidth?: number }) => Promise<VideoThumbnail[]>;
  currentTime: number;
  duration: number;
  playing: boolean;
  loop: boolean;
  playbackRate: number;
  volume: number;
  muted: boolean;
  audioMixingMode: string;
  staysActiveInBackground: boolean;
  showNowPlayingNotification: boolean;
  keepScreenOnWhilePlaying: boolean;
};
