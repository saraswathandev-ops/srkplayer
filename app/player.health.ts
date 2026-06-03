import type {
  RecoveryAction,
  PlaybackFailureReason,
  PlaybackHealthSnapshot,
  PlaybackState,
  RecoveryTier,
  StartupRecoveryTier,
} from "./player.types";

export function evaluatePlaybackHealth(snapshot: PlaybackHealthSnapshot): boolean {
  const {
    now,
    state,
    playbackStartAt,
    lastProgressAt,
    lastRecoveryAt,
    lastNativeAckPlayingAt,
    isBuffering,
    bufferAgeMs,
    appInBackground,
    audioHandoffInProgress,
    progressAgeMs,
    nativeAckAgeMs,
    startupGraceMs,
    longBufferSuppressionMs,
    recoveryCooldownMs,
  } = snapshot;

  if (
    state === "paused" ||
    state === "ended" ||
    appInBackground ||
    audioHandoffInProgress
  ) {
    return true;
  }
  if (playbackStartAt > 0 && now - playbackStartAt < startupGraceMs) return true;
  if (lastProgressAt > 0 && progressAgeMs < 2500) return true;
  if (isBuffering && (bufferAgeMs === null || bufferAgeMs < longBufferSuppressionMs)) return true;
  if (now - lastRecoveryAt < recoveryCooldownMs) return true;
  if (lastNativeAckPlayingAt > 0 && nativeAckAgeMs !== null && nativeAckAgeMs < 3000) return true;
  return false;
}

export function getRecoveryTierLabel(tier: RecoveryTier): RecoveryAction {
  if (tier === 1) return "play_reassert";
  if (tier === 2) return "seek_nudge";
  return "video_remount";
}

export function getStartupRecoveryTierLabel(tier: StartupRecoveryTier): RecoveryAction {
  if (tier === 1) return "play_reassert";
  if (tier === 2) return "seek_nudge";
  if (tier === 3) return "source_reload";
  return "video_remount";
}

export function classifyPlaybackFailure(snapshot: PlaybackHealthSnapshot): PlaybackFailureReason {
  if (snapshot.audioHandoffInProgress || snapshot.appInBackground) return "expected_pause";

  const startupPhase =
    snapshot.state === "loading" ||
    snapshot.state === "starting" ||
    snapshot.state === "stabilizing";
  const nativeFresh =
    snapshot.nativeAckAgeMs !== null &&
    snapshot.nativeAckAgeMs < snapshot.nativeAckFreshMs;

  if (snapshot.isBuffering) {
    if (snapshot.bufferAgeMs === null || snapshot.bufferAgeMs < snapshot.longBufferSuppressionMs) {
      return "buffering";
    }
    return nativeFresh ? "js_starvation" : "decoder_stall";
  }

  if (
    snapshot.state === "paused" ||
    snapshot.state === "ended" ||
    snapshot.state === "seeking" ||
    snapshot.state === "idle"
  ) {
    return "expected_pause";
  }

  if (startupPhase) {
    if (!snapshot.recentReadyForDisplay || !snapshot.isNativePlaying) {
      // A missing surface/native-playing signal is only a genuine surface
      // LOSS if the surface had already attached this session. Before the
      // first onReadyForDisplay it is normal startup warm-up (decoder spin-up
      // + surface attach), NOT a lost surface — classify it as buffering so
      // startup recovery (which suppresses buffering) does not fire a
      // spurious surface_lost → source_reload/remount loop.
      return snapshot.hadReadyForDisplay ? "surface_lost" : "buffering";
    }
    if (snapshot.progressAgeMs > 2500) return nativeFresh ? "js_starvation" : "decoder_stall";
    return "unexpected_pause";
  }

  if (snapshot.progressAgeMs > snapshot.stallTimeoutMs) {
    if (nativeFresh) return "js_starvation";
    if (!snapshot.isNativePlaying) return "surface_lost";
    return "decoder_stall";
  }

  return "unknown";
}

export function shouldRunStartupRecovery(options: {
  state: PlaybackState;
  failureReason: PlaybackFailureReason;
  recoveryCount: number;
  maxRecoveryCount: number;
}) {
  if (options.state !== "starting" && options.state !== "stabilizing") return false;
  if (
    options.failureReason === "buffering" ||
    options.failureReason === "audio_focus_loss" ||
    options.failureReason === "expected_pause" ||
    options.failureReason === "js_starvation"
  ) {
    return false;
  }
  return options.recoveryCount < options.maxRecoveryCount;
}

export function nextStartupRecoveryTier(recoveryCount: number): StartupRecoveryTier {
  if (recoveryCount <= 0) return 1;
  if (recoveryCount === 1) return 2;
  if (recoveryCount === 2) return 3;
  return 4;
}
