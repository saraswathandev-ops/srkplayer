export type SharedVideoPlayer = {
  release: () => void;
};

type PlayerSession = {
  player: SharedVideoPlayer;
  videoId: string | null;
};

let session: PlayerSession | null = null;

// ---------------------------------------------------------------------------
// Fresh-session flag
//
// Set by audio→video or video→audio switches to ensure the next video session
// opens clean (position 0, full source reload) instead of restoring state.
// ---------------------------------------------------------------------------
let _freshSessionPending = false;

/** Call before starting an audio session so the next video open starts fresh. */
export function requestFreshVideoSession(): void {
  _freshSessionPending = true;
}

/**
 * Consume the pending fresh flag. Returns true once and resets.
 * Call inside the position-restore effect of the video player.
 */
export function consumeFreshVideoSession(): boolean {
  const was = _freshSessionPending;
  _freshSessionPending = false;
  return was;
}

export function getPlayerSession() {
  return session;
}

export function setPlayerSession(
  player: SharedVideoPlayer,
  videoId: string | null
) {
  session = { player, videoId };
  return session;
}

export function clearPlayerSession(candidate?: SharedVideoPlayer | null) {
  if (!session) return;
  if (candidate && session.player !== candidate) return;
  session = null;
}

export function releasePlayerSession(candidate?: SharedVideoPlayer | null) {
  if (!session) {
    if (!candidate) return;
    try {
      candidate.release();
    } catch {
      // Ignore release failures during cleanup.
    }
    return;
  }
  if (candidate && session.player !== candidate) return;
  const activeSession = session;
  session = null;
  try {
    activeSession.player.release();
  } catch {
    // Ignore release failures during cleanup.
  }
}
