/**
 * playerStore.ts
 * Zustand store for the video player — UI state mirror.
 *
 * Replaces the 50+ useState calls scattered across player.tsx.
 * Use `usePlayerStore` inside any player component for zero-boilerplate state access.
 *
 * NOTE: Playback lifecycle fields (playbackPhase, sourceGeneration, etc.) are
 * synced FROM the authoritative useReducer state machine in usePlaybackStateMachine.
 * Do NOT modify them directly — only the state machine hook writes to them.
 */
import { create } from 'zustand';
import type { PlayerAudioTrack } from '@/app/player.types';
import type { PlaybackState, RecoveryTier } from '@/src/player/playbackTypes';

export type { PlayerAudioTrack };

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoopMode = 'none' | 'one' | 'all';
export type ContentFitMode = 'contain' | 'cover' | 'stretch';
export type DecoderMode = 'hwPlus' | 'hw' | 'sw';
export type GestureMode = 'volume' | 'brightness' | 'seek' | 'zoom';
export type OrientationMode = 'default' | 'portrait' | 'landscape';

export interface GestureHUD {
  mode: GestureMode;
  label: string;
  progress: number;
  direction?: 'forward' | 'rewind';
}

// ─── State shape ──────────────────────────────────────────────────────────────

export interface PlayerState {
  // ── Playback
  paused: boolean;
  currentTime: number;
  duration: number;
  sourceDuration: number;
  playbackRate: number;
  isBuffering: boolean;
  playbackStartupError: string | null;

  // ── Audio / Volume
  volume: number;
  isMuted: boolean;
  volumeBoost: number;
  backgroundPlay: boolean;

  // ── Brightness
  brightness: number;

  // ── Loop / Repeat
  loopMode: LoopMode;

  // ── Video display
  contentFitMode: ContentFitMode;
  zoomScale: number;
  forcedAspectRatio: string | null;
  panOffset: { x: number; y: number };
  decoderMode: DecoderMode;
  nightMode: boolean;

  // ── Controls visibility
  controlsVisible: boolean;
  isLocked: boolean;

  // ── Orientation
  orientationMode: OrientationMode;

  // ── Subtitle / Audio track
  selectedAudioTrackIndex: number | null;
  audioTracks: PlayerAudioTrack[];
  currentSubtitle: string | null;

  // ── HUD (gesture indicators)
  gestureHUD: GestureHUD | null;
  volumeHudPercent: number;
  brightnessHudPercent: number;

  // ── Sleep timer
  sleepTimerRemaining: number | null;

  // ── UI panels
  utilityRailExpanded: boolean;
  quickActionsExpanded: boolean;
  propertiesPanelVisible: boolean;
  trimPanelVisible: boolean;

  // ── Seek preview
  seekPreviewPosition: number | null;

  // ── Auto-play countdown
  autoPlayCountdown: number | null;

  // ── Long-press speed ramp
  longPressActive: boolean;

  // ── Playback lifecycle (synced from reducer state machine — read-only mirror)
  playbackPhase: PlaybackState;
  sourceGeneration: number;
  isResuming: boolean;
  resumedFromSaved: boolean;
  startupAttempt: number;
  recoveryTier: RecoveryTier | null;
  remountKey: number;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export interface PlayerActions {
  // Playback
  setPaused: (paused: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setSourceDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setIsBuffering: (buffering: boolean) => void;
  setPlaybackStartupError: (error: string | null) => void;

  // Volume / Audio
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setVolumeBoost: (boost: number) => void;
  setBackgroundPlay: (enabled: boolean) => void;

  // Brightness
  setBrightness: (brightness: number) => void;

  // Loop
  setLoopMode: (mode: LoopMode) => void;
  cycleLoopMode: () => void;

  // Video display
  setContentFitMode: (mode: ContentFitMode) => void;
  cycleContentFitMode: () => void;
  setZoomScale: (scale: number) => void;
  setForcedAspectRatio: (ratio: string | null) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setDecoderMode: (mode: DecoderMode) => void;
  cycleDecoderMode: () => void;
  setNightMode: (enabled: boolean) => void;
  toggleNightMode: () => void;

  // Controls
  setControlsVisible: (visible: boolean) => void;
  showControls: () => void;
  hideControls: () => void;
  setIsLocked: (locked: boolean) => void;
  toggleLocked: () => void;

  // Orientation
  setOrientationMode: (mode: OrientationMode) => void;
  cycleOrientationMode: () => void;

  // Audio tracks / Subtitles
  setAudioTracks: (tracks: PlayerAudioTrack[]) => void;
  setSelectedAudioTrackIndex: (index: number | null) => void;
  setCurrentSubtitle: (text: string | null) => void;

  // HUD
  setGestureHUD: (hud: GestureHUD | null) => void;
  setVolumeHudPercent: (pct: number) => void;
  setBrightnessHudPercent: (pct: number) => void;

  // Sleep timer
  setSleepTimerRemaining: (seconds: number | null) => void;

  // UI panels
  setUtilityRailExpanded: (expanded: boolean) => void;
  setQuickActionsExpanded: (expanded: boolean) => void;
  setPropertiesPanelVisible: (visible: boolean) => void;
  setTrimPanelVisible: (visible: boolean) => void;

  // Seek preview
  setSeekPreviewPosition: (position: number | null) => void;

  // Auto-play countdown
  setAutoPlayCountdown: (seconds: number | null) => void;

  // Long press
  setLongPressActive: (active: boolean) => void;

  // Playback lifecycle (synced from reducer — written only by usePlaybackStateMachine)
  setPlaybackPhase: (phase: PlaybackState) => void;
  setSourceGeneration: (generation: number) => void;
  setIsResuming: (isResuming: boolean) => void;
  setResumedFromSaved: (resumedFromSaved: boolean) => void;
  setStartupAttempt: (attempt: number) => void;
  setRecoveryTier: (tier: RecoveryTier | null) => void;
  incrementRemountKey: () => void;

  // Reset (called on video change)
  resetForNewVideo: () => void;
}

// ─── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: PlayerState = {
  paused: true,
  currentTime: 0,
  duration: 0,
  sourceDuration: 0,
  playbackRate: 1,
  isBuffering: false,
  playbackStartupError: null,

  volume: 1,
  isMuted: false,
  volumeBoost: 1,
  backgroundPlay: true,

  brightness: 0.5,

  loopMode: 'none',

  contentFitMode: 'contain',
  zoomScale: 1,
  forcedAspectRatio: null,
  panOffset: { x: 0, y: 0 },
  decoderMode: 'hwPlus',
  nightMode: false,

  controlsVisible: false,
  isLocked: false,

  orientationMode: 'default',

  selectedAudioTrackIndex: null,
  audioTracks: [],
  currentSubtitle: null,

  gestureHUD: null,
  volumeHudPercent: 0,
  brightnessHudPercent: 0,

  sleepTimerRemaining: null,

  utilityRailExpanded: false,
  quickActionsExpanded: false,
  propertiesPanelVisible: false,
  trimPanelVisible: false,

  seekPreviewPosition: null,
  autoPlayCountdown: null,
  longPressActive: false,

  // Playback lifecycle defaults
  playbackPhase: 'idle' as PlaybackState,
  sourceGeneration: 0,
  isResuming: false,
  resumedFromSaved: false,
  startupAttempt: 0,
  recoveryTier: null,
  remountKey: 0,
};

// ─── Store ────────────────────────────────────────────────────────────────────

const LOOP_CYCLE: LoopMode[] = ['none', 'one', 'all'];
const FIT_CYCLE: ContentFitMode[] = ['contain', 'cover', 'stretch'];
const DECODER_CYCLE: DecoderMode[] = ['hwPlus', 'hw', 'sw'];
const ORIENTATION_CYCLE: OrientationMode[] = ['default', 'portrait', 'landscape'];

export const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  ...INITIAL_STATE,

  // ── Playback
  setPaused: (paused) => set({ paused }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setSourceDuration: (sourceDuration) => set({ sourceDuration }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setIsBuffering: (isBuffering) => set({ isBuffering }),
  setPlaybackStartupError: (playbackStartupError) => set({ playbackStartupError }),

  // ── Volume / Audio
  setVolume: (volume) => set({ volume: Math.min(Math.max(volume, 0), 1) }),
  setIsMuted: (isMuted) => set({ isMuted }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setVolumeBoost: (volumeBoost) => set({ volumeBoost }),
  setBackgroundPlay: (backgroundPlay) => set({ backgroundPlay }),

  // ── Brightness
  setBrightness: (brightness) => set({ brightness: Math.min(Math.max(brightness, 0), 1) }),

  // ── Loop
  setLoopMode: (loopMode) => set({ loopMode }),
  cycleLoopMode: () => set((s) => {
    const idx = LOOP_CYCLE.indexOf(s.loopMode);
    return { loopMode: LOOP_CYCLE[(idx + 1) % LOOP_CYCLE.length] };
  }),

  // ── Video display
  setContentFitMode: (contentFitMode) => set({ contentFitMode }),
  cycleContentFitMode: () => set((s) => {
    const idx = FIT_CYCLE.indexOf(s.contentFitMode);
    return { contentFitMode: FIT_CYCLE[(idx + 1) % FIT_CYCLE.length] };
  }),
  setZoomScale: (zoomScale) => set({ zoomScale }),
  setForcedAspectRatio: (forcedAspectRatio) => set({ forcedAspectRatio }),
  setPanOffset: (panOffset) => set({ panOffset }),
  setDecoderMode: (decoderMode) => set({ decoderMode }),
  cycleDecoderMode: () => set((s) => {
    const idx = DECODER_CYCLE.indexOf(s.decoderMode);
    return { decoderMode: DECODER_CYCLE[(idx + 1) % DECODER_CYCLE.length] };
  }),
  setNightMode: (nightMode) => set({ nightMode }),
  toggleNightMode: () => set((s) => ({ nightMode: !s.nightMode })),

  // ── Controls
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  showControls: () => set({ controlsVisible: true }),
  hideControls: () => set({ controlsVisible: false }),
  setIsLocked: (isLocked) => set({ isLocked }),
  toggleLocked: () => set((s) => ({ isLocked: !s.isLocked })),

  // ── Orientation
  setOrientationMode: (orientationMode) => set({ orientationMode }),
  cycleOrientationMode: () => set((s) => {
    const idx = ORIENTATION_CYCLE.indexOf(s.orientationMode);
    return { orientationMode: ORIENTATION_CYCLE[(idx + 1) % ORIENTATION_CYCLE.length] };
  }),

  // ── Audio tracks / Subtitles
  setAudioTracks: (audioTracks) => set({ audioTracks }),
  setSelectedAudioTrackIndex: (selectedAudioTrackIndex) => set({ selectedAudioTrackIndex }),
  setCurrentSubtitle: (currentSubtitle) => set({ currentSubtitle }),

  // ── HUD
  setGestureHUD: (gestureHUD) => set({ gestureHUD }),
  setVolumeHudPercent: (volumeHudPercent) => set({ volumeHudPercent }),
  setBrightnessHudPercent: (brightnessHudPercent) => set({ brightnessHudPercent }),

  // ── Sleep timer
  setSleepTimerRemaining: (sleepTimerRemaining) => set({ sleepTimerRemaining }),

  // ── UI panels
  setUtilityRailExpanded: (utilityRailExpanded) => set({ utilityRailExpanded }),
  setQuickActionsExpanded: (quickActionsExpanded) => set({ quickActionsExpanded }),
  setPropertiesPanelVisible: (propertiesPanelVisible) => set({ propertiesPanelVisible }),
  setTrimPanelVisible: (trimPanelVisible) => set({ trimPanelVisible }),

  // ── Seek preview
  setSeekPreviewPosition: (seekPreviewPosition) => set({ seekPreviewPosition }),

  // ── Auto-play countdown
  setAutoPlayCountdown: (autoPlayCountdown) => set({ autoPlayCountdown }),

  // ── Long press
  setLongPressActive: (longPressActive) => set({ longPressActive }),

  // ── Playback lifecycle (synced from reducer state machine)
  setPlaybackPhase: (playbackPhase) => set({ playbackPhase }),
  setSourceGeneration: (sourceGeneration) => set({ sourceGeneration }),
  setIsResuming: (isResuming) => set({ isResuming }),
  setResumedFromSaved: (resumedFromSaved) => set({ resumedFromSaved }),
  setStartupAttempt: (startupAttempt) => set({ startupAttempt }),
  setRecoveryTier: (recoveryTier) => set({ recoveryTier }),
  incrementRemountKey: () => set((s) => ({ remountKey: s.remountKey + 1 })),

  // ── Reset on video change
  resetForNewVideo: () => set({
    paused: true,
    currentTime: 0,
    duration: 0,
    sourceDuration: 0,
    isBuffering: false,
    playbackStartupError: null,
    seekPreviewPosition: null,
    autoPlayCountdown: null,
    longPressActive: false,
    gestureHUD: null,
    audioTracks: [],
    selectedAudioTrackIndex: null,
    currentSubtitle: null,
    controlsVisible: false,
    utilityRailExpanded: false,
    quickActionsExpanded: false,
    trimPanelVisible: false,
    // Lifecycle fields are NOT reset here — the state machine handles that
  }),
}));
