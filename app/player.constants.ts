export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export const VOLUME_BOOST_LEVELS = [1, 1.25, 1.5, 2];
export const CONTROL_TIMEOUT = 3000;
export const RESUME_COUNTDOWN_SEC = 3;
export const DOUBLE_TAP_SEEK_SECONDS = 10;
export const HUD_TIMEOUT = 1000;
export const SCREENSHOT_PREVIEW_TIMEOUT = 3000;
export const DOUBLE_TAP_TIMEOUT = 280;
export const DOUBLE_TAP_EDGE_RATIO = 0.32;
export const GESTURE_ACTIVATION_DISTANCE = 12;
export const EDGE_VERTICAL_GESTURE_ACTIVATION_DISTANCE = 18;
export const GESTURE_CANCEL_TAP_DISTANCE = 10;
export const LONG_PRESS_SPEED_RAMP_DELAY = 650;
export const VERTICAL_GESTURE_SENSITIVITY_PX = 260;
export const HORIZONTAL_SEEK_MAX_WINDOW = 600;
export const EDGE_GESTURE_RATIO = 0.20;
export const MIN_PINCH_SCALE = 1;
export const MAX_PINCH_SCALE = 3;
export const PINCH_GESTURE_ACTIVATION_DELTA = 0.04;
export const QUEUE_ITEM_LAYOUT_HEIGHT = 76;
export const UP_NEXT_SEPARATOR_HEIGHT = 8;
export const UP_NEXT_PAGE_SIZE = 10;
export const UP_NEXT_LANDSCAPE_PAGE_SIZE = 4;
export const APP_ICON_SOURCE = require("../assets/images/icon.png");
// Conservative buffer config — restored from the aggressive 1500/4000
// values which caused ExoPlayer to never reach ready-with-playWhenReady
// on small / short files. Values match the react-native-video defaults
// recommended for stable mixed local + streaming playback.
export const VIDEO_BUFFER_CONFIG = {
  minBufferMs: 25000,
  maxBufferMs: 60000,
  bufferForPlaybackMs: 1500,
  bufferForPlaybackAfterRebufferMs: 4000,
  backBufferDurationMs: 20000,
};
export const LOCAL_BUFFER_CONFIG = {
  minBufferMs: 2500,
  maxBufferMs: 10000,
  bufferForPlaybackMs: 1000,
  bufferForPlaybackAfterRebufferMs: 2000,
  backBufferDurationMs: 5000,
};
export const VIDEO_RELOAD_LOOP_WINDOW_MS = 2500;
export const VIDEO_RELOAD_LOOP_THRESHOLD = 3;

// ─── Playback health model ────────────────────────────────────────────
// Replaces the previous L1/L2/L3 ladder, which was too aggressive and
// fought ExoPlayer's normal startup transitions. The new model: trust
// PROGRESS as the primary "playing" signal; only escalate when ALL
// health signals fail for STALL_TIMEOUT_MS straight, AND we're past the
// startup grace.
//
// Startup grace — ignore all recovery triggers for this long after we
// request play. ExoPlayer needs to spin up the decoder, attach the
// surface, fill the buffer, and sync the render thread; transient
// isPlaying:false events during this window are normal.
// Phase 6: tightened from 12000 → 3000 (Fast Startup path). The 12 s ceiling
// was over-conservative; live dogfood showed the player is ready well before
// then but UX waited the full grace, contributing to the 5–10 s perceived
// startup lag.
export const STARTUP_GRACE_MS = 3000;
// Real stall — no health signal at all for this long.
// Phase 6: tightened from 7000 → 2000 (aggressive on purpose). Live logs
// showed real stalls last 7–9 s; this threshold catches them ~5 s earlier
// at the cost of more tier-1 (play reassert) firings on brief buffer pauses.
// Tier 1 is harmless when fired against a healthy player, so the trade is
// worth it. The line-1340 dual-signal fix in the same phase reduces false
// positives by suppressing stalls when native ack is provably fresh.
export const STALL_TIMEOUT_MS = 2000;
// Debounce play() / resume() assertions. Multiple rapid play() calls
// confuse ExoPlayer's playWhenReady state machine.
// Phase 6: tightened from 3000 → 500 to match the new aggressive recovery
// cadence. play() is idempotent on a playing ExoPlayer; the cooldown only
// exists to avoid pathological loops, which 500 ms is more than enough to
// catch.
export const PLAY_ASSERT_COOLDOWN_MS = 500;
// After a recovery action, treat the player as "recently kicked" — don't
// escalate again within this window.
// Phase 6: tightened from 4000 → 1000 for the Fast path's snappier recovery.
export const RECOVERY_COOLDOWN_MS = 1000;
// Progress-advance threshold — any forward step ≥ 50 ms is "advancing".
export const PROGRESS_ADVANCE_SECONDS = 0.05;

// ─── Fast Startup Path (Phase 6) ──────────────────────────────────────
// Master flag for the parallel fast-startup implementation. When true,
// the Video onLoad prop, init effect, and polling stall detector route
// through the Fast variants (startPlaybackFast / handleVideoLoadFast /
// isPlaybackHealthyFast / simpleRecovery). Flip to false to roll back to
// the legacy startPlaybackUnified path. The legacy functions are NOT
// deleted yet — this flag is the rollback handle for one release cycle.
export const FAST_STARTUP_ENABLED = true;
// Single-shot stabilization nudge interval used by startPlaybackFast. If
// the player hasn't advanced past the start position by this many ms,
// the fast path issues one corrective seek (+0.5 s). Avoids the legacy
// multi-timer cascade.
export const FAST_STARTUP_SEEK_GRACE_MS = 500;
