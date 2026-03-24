export type SharedVideoPlayer = {
  release: () => void;
};

type PlayerSession = {
  player: SharedVideoPlayer;
  videoId: string | null;
};

let session: PlayerSession | null = null;

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
