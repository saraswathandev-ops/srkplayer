import type {
  PlaybackLogContext,
  PlaybackPhase,
  PlaybackTransitionReason,
  PlaybackState,
} from "./player.types";
import { logPlayback } from "./player.logger";

const allowedTransitions: Record<PlaybackState, PlaybackState[]> = {
  idle: ["idle", "resolving", "validating", "loading", "paused", "error"],
  resolving: ["validating", "loading", "error", "idle"],
  validating: ["loading", "error", "idle"],
  loading: ["loading", "seeking", "starting", "paused", "error", "idle"],
  starting: ["starting", "stabilizing", "buffering", "recovering", "paused", "ended", "error", "idle"],
  stabilizing: ["stabilizing", "playing", "buffering", "recovering", "paused", "ended", "error", "idle"],
  playing: ["playing", "buffering", "seeking", "recovering", "paused", "ended", "error", "starting", "idle"],
  buffering: ["buffering", "starting", "stabilizing", "playing", "recovering", "paused", "ended", "error", "idle"],
  seeking: ["seeking", "stabilizing", "playing", "buffering", "paused", "recovering", "ended", "error"],
  recovering: ["recovering", "loading", "seeking", "starting", "stabilizing", "playing", "buffering", "paused", "ended", "error", "idle"],
  paused: ["paused", "starting", "stabilizing", "playing", "loading", "ended", "error", "idle"],
  ended: ["ended", "idle", "loading", "starting"],
  error: ["error", "idle", "loading", "starting"],
};

export function transitionPlaybackPhase(options: {
  current: PlaybackPhase;
  next: PlaybackPhase;
  reason: PlaybackTransitionReason;
  ctx: PlaybackLogContext;
}): PlaybackPhase {
  const { current, next, reason, ctx } = options;
  if (current === next) return current;

  const allowed = allowedTransitions[current] ?? [];
  if (!allowed.includes(next)) {
    logPlayback(ctx, "phase_transition_unusual", { from: current, to: next, reason });
  } else {
    logPlayback(ctx, "phase_transition", { from: current, to: next, reason });
  }

  return next;
}

export function isStartupState(state: PlaybackState) {
  return state === "loading" || state === "starting" || state === "stabilizing";
}

export function isTerminalState(state: PlaybackState) {
  return state === "ended" || state === "error";
}

export function canRecoverFromState(state: PlaybackState) {
  return state === "starting" || state === "stabilizing" || state === "playing" || state === "buffering";
}
