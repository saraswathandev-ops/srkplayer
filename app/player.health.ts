import type {
  PlaybackFailureReason,
  PlaybackHealthSnapshot,
  PlaybackState,
  RecoveryTier,
  StartupRecoveryTier,
} from "./player.types";

export function evaluatePlaybackHealth(snapshot: PlaybackHealthSnapshot): boolean {
  const {
    now,
    playbackStartAt,
    lastProgressAt,
    lastRecoveryAt,
    lastNativeAckPlayingAt,
    isBuffering,
    startupGraceMs,
    recoveryCooldownMs,
  } = snapshot;

  if (playbackStartAt > 0 && now - playbackStartAt < startupGraceMs) return true;
  if (now - lastProgressAt < 2500) return true;
  if (isBuffering) return true;
  if (now - lastRecoveryAt < recoveryCooldownMs) return true;
  if (now - lastNativeAckPlayingAt < 3000) return true;
  return false;
}

export function getRecoveryTierLabel(tier: RecoveryTier) {
  if (tier === 1) return "play_reassert";
  if (tier === 2) return "seek_nudge";
  return "source_remount";
}

export function getStartupRecoveryTierLabel(tier: StartupRecoveryTier) {
  if (tier === 1) return "play_reassert";
  if (tier === 2) return "seek_nudge";
  if (tier === 3) return "source_reload";
  return "video_remount";
}

export function classifyPlaybackFailure(options: {
  state: PlaybackState;
  isBuffering: boolean;
  audioHandoffInProgress: boolean;
  appInBackground: boolean;
  recentReadyForDisplay: boolean;
  progressAgeMs: number;
}): PlaybackFailureReason {
  if (options.isBuffering) return "buffering";
  if (options.audioHandoffInProgress || options.appInBackground) return "audio_focus_loss";
  if (options.state === "stabilizing" || options.state === "starting") {
    if (!options.recentReadyForDisplay) return "surface_lost";
    if (options.progressAgeMs > 2500) return "decoder_stall";
    return "unexpected_pause";
  }
  if (options.progressAgeMs > 7000) return "decoder_stall";
  return "unknown";
}

export function shouldRunStartupRecovery(options: {
  state: PlaybackState;
  failureReason: PlaybackFailureReason;
  recoveryCount: number;
  maxRecoveryCount: number;
}) {
  if (options.state !== "starting" && options.state !== "stabilizing") return false;
  if (options.failureReason === "buffering" || options.failureReason === "audio_focus_loss") return false;
  return options.recoveryCount < options.maxRecoveryCount;
}

export function nextStartupRecoveryTier(recoveryCount: number): StartupRecoveryTier {
  if (recoveryCount <= 0) return 1;
  if (recoveryCount === 1) return 2;
  if (recoveryCount === 2) return 3;
  return 4;
}
