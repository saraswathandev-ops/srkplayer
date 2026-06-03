import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import FastImage from "react-native-fast-image";
import RNFS from "react-native-fs";
import { createThumbnail } from "react-native-create-thumbnail";
import Video, { SelectedTrackType, ViewType, type VideoRef } from "react-native-video";
import LinearGradient from "react-native-linear-gradient";
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Animated,
  BackHandler,
  FlatList,
  useWindowDimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrackPlayer, { Capability, Event, State } from "react-native-track-player";
import SystemNavigationBar from "react-native-system-navigation-bar";
import Orientation from 'react-native-orientation-locker';
import {
  isAudioPlayInFlight,
  isTrackPlayerAvailable,
  isTrackPlayerReady,
  resetSetupFlag,
  useSafeTrackPlayerEvents,
  videoItemToTrack,
} from "@/services/trackPlayerService";

import { VideoPlayerControls } from "@/components/VideoPlayerControls";
import { VerticalGestureBar } from "@/components/player/VerticalGestureBar";
import { AudioTrackBottomSheet } from "@/components/player/AudioTrackBottomSheet";
import { loadPreferredAudio } from "@/services/audioLanguagePref";
import {
  commitSessionPatch,
  flushSessionPatches,
  peekSessionState,
  prefetchSessions,
  saveSessionState,
} from "@/services/sessionStateService";
import { SubtitleBottomSheet } from "@/components/player/SubtitleBottomSheet";
import { SubtitleOverlay, type SubtitleOverlayHandle } from "@/components/player/SubtitleOverlay";
import { useSubtitleGeneration } from "@/hooks/useSubtitleGeneration";
import { usePlayerStore } from "@/store/playerStore";
import { styles } from "./player.styles";
import {
  APP_ICON_SOURCE,
  CONTROL_TIMEOUT,
  DOUBLE_TAP_EDGE_RATIO,
  FAST_STARTUP_ENABLED,
  FAST_STARTUP_SEEK_GRACE_MS,
  GESTURE_ACTIVATION_DISTANCE,
  HUD_TIMEOUT,
  LOCAL_BUFFER_CONFIG,
  MAX_PINCH_SCALE,
  MIN_PINCH_SCALE,
  LONG_BUFFER_SUPPRESSION_MS,
  NATIVE_ACK_FRESH_MS,
  PLAY_ASSERT_COOLDOWN_MS,
  PROGRESS_ADVANCE_SECONDS,
  QUEUE_ITEM_LAYOUT_HEIGHT,
  RECOVERY_COOLDOWN_MS,
  SCREENSHOT_PREVIEW_TIMEOUT,
  SPEEDS,
  STALL_TIMEOUT_MS,
  STARTUP_GRACE_MS,
  SURFACE_LOST_REMOUNT_COOLDOWN_MS,
  SURFACE_LOST_WINDOW_MS,
  UP_NEXT_LANDSCAPE_PAGE_SIZE,
  UP_NEXT_PAGE_SIZE,
  UP_NEXT_SEPARATOR_HEIGHT,
  VIDEO_BUFFER_CONFIG,
  VIDEO_RELOAD_LOOP_THRESHOLD,
  VIDEO_RELOAD_LOOP_WINDOW_MS,
  VOLUME_BOOST_LEVELS,
} from "./player.constants";
import type {
  ContentFitMode,
  DecoderMode,
  GestureMode,
  PlaybackFailureReason,
  PlaybackHealthSnapshot,
  PlaybackPhase,
  PlaybackTransitionReason,
  PlayerAudioTrack,
  RecoveryAction,
  StartupIntent,
  StartupMetrics,
  TapZone,
  VideoNaturalSize,
  VideoPlayerShim,
  VideoThumbnail,
} from "./player.types";
import { createVideoPlayerShim } from "./player.shim";
import { createPlayerFeatureConfig } from "./playerFeatureConfig";
import {
  classifyPlaybackFailure,
  evaluatePlaybackHealth,
  getRecoveryTierLabel,
  getStartupRecoveryTierLabel,
  nextStartupRecoveryTier,
  shouldRunStartupRecovery,
} from "./player.health";
import {
  buildPlaybackLogContext,
  createPlaybackSessionId,
  logNativeState,
  logPlayback,
  logPlaybackStop,
  logRecovery,
  logVideoEvent,
} from "./player.logger";
import { resolveActivePlaybackVideo, resolvePlaybackQueue } from "./player.resolver";
import {
  buildStartupMetricsLog,
  resolveStartupSeekPosition,
  shouldConfirmStartupStable,
} from "./player.startup";
import { transitionPlaybackPhase } from "./player.stateMachine";
import {
  applyPlayerAudioState,
  buildHandoffQueue,
  clamp,
  clamp01,
  formatFileSize,
  getAbsolutePlaybackPosition,
  getAudioTrackLabel,
  getClipEndPosition,
  getClipStartOffset,
  getDecoderModeLabel,
  getLocalFilePath,
  getPlayableDuration,
  getPlaybackUri,
  getRelativePlaybackPosition,
  initialPlayerFitFromSetting,
  normalizePlaybackUri,
  parseAspectRatio,
  resolveVerticalGestureDelta,
  settingFromFit,
} from "./player.utils";
import { PlayerManager } from "@/services/PlayerManager";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getPlayerSession,
  releasePlayerSession,
  setPlayerSession,
} from "@/services/playerSession";
import { useTrackPlayer } from "@/context/TrackPlayerContext";
import { type VideoItem } from "@/types/player";
import { formatDuration } from "@/utils/formatters";
import { getThumbnailUri } from "@/utils/thumbnailSource";
import { log } from "@/utils/logger";
import {
  restorePlayerBrightness,
  setPlayerBrightness,
} from "@/services/deviceBrightness";
import {
  addDeviceVolumeListener,
  getDeviceVolume,
  resetVolumeGestureThrottle,
  setDeviceVolume,
  setDeviceVolumeForGesture,
} from "@/services/deviceVolume";
import {
  MIN_RESUME_POSITION_SECONDS,
  computeResumeRewindSeconds,
} from "@/services/playbackProgressService";
import {
  startPlaybackDiagnostics,
  stopPlaybackDiagnostics,
} from "@/services/playbackDiagnostics";
import { getVideosByFolder } from "@/services/videoService";

const L = log('VideoPlayer');
const VERTICAL_GESTURE_STEP = 0.05;
// Throttle for the in-playback periodic position save (crash resilience).
const PERIODIC_SAVE_INTERVAL_MS = 5000;
const DOUBLE_TAP_CHAIN_TIMEOUT_MS = 650;
const TRANSIENT_STOP_RECOVERY_DELAY_MS = 220;
const TRANSIENT_STOP_RECOVERY_COOLDOWN_MS = 1500;
const TRANSIENT_STOP_POSITION_ADVANCE_SECONDS = 0.15;
const RESUME_LOOKUP_TIMEOUT_MS = 150;

function nowPerformanceMs() {
  const perf = (globalThis as any).performance;
  return typeof perf?.now === "function" ? perf.now() : Date.now();
}

function resolveSteppedVerticalGestureValue(
  startValue: number,
  translationY: number,
  viewportHeight: number
) {
  const rawDelta = resolveVerticalGestureDelta({
    dy: translationY,
    viewportHeight,
  });
  const steppedDelta =
    Math.round(rawDelta / VERTICAL_GESTURE_STEP) * VERTICAL_GESTURE_STEP;
  return clamp01(Number((startValue + steppedDelta).toFixed(2)));
}

// Playback model overview:
// - Progress is the primary health signal; native playing callbacks are hints.
// - Native isPlaying:false is telemetry-only during active playback intent.
// - startupIntentRef binds a requested start position to a videoId/generation.
// - Recovery is non-destructive first (play reassert, then seek nudge); source
//   reload/remount is reserved for startup recovery or decoder fallback.
export default function PlayerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    id,
    folder: routeFolder,
    playbackUri: routePlaybackUriParam,
    startPosition: routeStartPositionParam,
  } = route.params || { id: "", folder: undefined, playbackUri: undefined, startPosition: undefined };
  const routeVideoId = Array.isArray(id) ? id[0] : id;
  const routePlaybackUri = Array.isArray(routePlaybackUriParam)
    ? routePlaybackUriParam[0]
    : routePlaybackUriParam;
  const routeStartPositionRaw = Array.isArray(routeStartPositionParam)
    ? routeStartPositionParam[0]
    : routeStartPositionParam;
  const routeStartPosition = Number(routeStartPositionRaw);
  const hasRouteStartPosition = Number.isFinite(routeStartPosition) && routeStartPosition >= 0;
  const {
    videos,
    settings,
    updateLastPosition,
    updateMediaDuration,
    incrementPlayCount,
    saveTrimmedClip,
    setCurrentVideo,
    currentVideo,
    fetchVideoById,
    getPlaybackProgress,
    clearPlaybackProgress,
    updateSettings,
    removeVideo,
    fetchMostPlayed,
  } = usePlayer();
  const { playAudio, stopPlayer: stopAudioSession } = useTrackPlayer();
  const insets = useSafeAreaInsets();
  // Theme accent for the controls overlay (seekbar fill/thumb, play ring,
  // active states). Resolved here so the memoized VideoPlayerControls receives
  // a stable string prop instead of re-subscribing to the theme/context itself.
  const { colors: themeColors } = useAppTheme();

  const [activeVideoId, setActiveVideoId] = useState(routeVideoId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sourceDuration, setSourceDuration] = useState(0);
  const [seekPreviewPosition, setSeekPreviewPosition] = useState<number | null>(null);
  const [speed, setSpeed] = useState(settings.speed);
  const [volume, setVolume] = useState(clamp01(settings.defaultVolume));
  const [brightnessLevel, setBrightnessLevel] = useState(clamp01(settings.defaultBrightness ?? 0.5));
  const [useBrightnessOverlayFallback, setUseBrightnessOverlayFallback] = useState(Platform.OS !== "android");
  const [isMuted, setIsMuted] = useState(clamp01(settings.defaultVolume) <= 0.001);
  const isMounted = useRef(true);
  const [storedVideo, setStoredVideo] = useState<VideoItem | null>(null);
  const transitionProgress = useRef(new Animated.Value(1)).current;
  const [transitionMeta, setTransitionMeta] = useState<{
    title: string;
    direction: "next" | "prev";
  } | null>(null);

  const [loopMode, setLoopMode] = useState<"none" | "one" | "all">(settings.loopMode);
  const [contentFitMode, setContentFitMode] = useState<ContentFitMode>(
    initialPlayerFitFromSetting(settings.videoSizeMode)
  );
  const [zoomScale, setZoomScale] = useState(MIN_PINCH_SCALE);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [utilityRailExpanded, setUtilityRailExpanded] = useState(false);
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(false);
  const [propertiesPanelVisible, setPropertiesPanelVisible] = useState(false);
  const [trimPanelVisible, setTrimPanelVisible] = useState(false);
  const [audioBottomSheetVisible, setAudioBottomSheetVisible] = useState(false);
  const [subtitleBottomSheetVisible, setSubtitleBottomSheetVisible] = useState(false);
  const subtitleOverlayRef = useRef<SubtitleOverlayHandle | null>(null);
  const { reloadTracks: reloadSubtitleTracks } = useSubtitleGeneration();
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimTitle, setTrimTitle] = useState("");
  const [isSavingTrim, setIsSavingTrim] = useState(false);
  const [upNextVisibleCount, setUpNextVisibleCount] = useState(UP_NEXT_PAGE_SIZE + 1);
  const [upNextLandscapePage, setUpNextLandscapePage] = useState(0);
  const [suggestedVideos, setSuggestedVideos] = useState<VideoItem[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [orientationMode, setOrientationMode] = useState<"default" | "portrait" | "landscape">("default");
  const [gestureHud, setGestureHud] = useState<{
    mode: GestureMode;
    label: string;
    progress: number;
    direction?: "forward" | "rewind";
  } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const effectiveViewportWidth = viewport.width > 0 ? viewport.width : screenWidth;
  const effectiveViewportHeight = viewport.height > 0 ? viewport.height : screenHeight;

  const [screenshotPreview, setScreenshotPreview] = useState<VideoThumbnail | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [showUpNextPopup, setShowUpNextPopup] = useState(false);
  const [showDiscoveryHints, setShowDiscoveryHints] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const [autoPlayTarget, setAutoPlayTarget] = useState<VideoItem | null>(null);
  const [longPressActive, setLongPressActive] = useState(false);
  const [activeGestureMode, setActiveGestureMode] = useState<"volume" | "brightness" | null>(null);
  const gestureBarHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [forcedAspectRatio, setForcedAspectRatio] = useState<string | null>("21:9");
  const [videoNaturalSize, setVideoNaturalSize] = useState<VideoNaturalSize | null>(null);
  const [decoderMode, setDecoderMode] = useState<DecoderMode>("hwPlus");
  // Resume position passed to <Video source.startPosition> (ms). Set on auto-resume,
  // cleared after first onProgress so decoder remounts don't re-seek to saved.
  const [pendingStartPositionMs, setPendingStartPositionMs] = useState<number | null>(null);
  const [volumeBoost, setVolumeBoost] = useState(1);
  const [audioTracks, setAudioTracks] = useState<PlayerAudioTrack[]>([]);
  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState<number | null>(null);
  // Mirror of audioTracks for use inside callbacks that need the previous
  // list without re-creating themselves whenever the list changes.
  const audioTracksRef = useRef<PlayerAudioTrack[]>([]);
  useEffect(() => { audioTracksRef.current = audioTracks; }, [audioTracks]);
  // Seed the validated URI synchronously from the route param so the native
  // <Video> mounts with its source on the FIRST render instead of waiting a
  // render+effect cycle (the URI-validation effect below still owns later
  // changes: audio handoff, recovery remount, missing-path errors).
  const [validatedPlaybackUri, setValidatedPlaybackUri] = useState<string | null>(
    () => (routePlaybackUri ? normalizePlaybackUri(routePlaybackUri) : null)
  );
  const [playbackStartupError, setPlaybackStartupError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const [resumeCheckPending, setResumeCheckPending] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{
    position: number;
    duration: number;
  } | null>(null);
  const [showStartOverButton, setShowStartOverButton] = useState(false);
  const autoResumeCompletedRef = useRef(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleTapSeekClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumePersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessRequestIdRef = useRef(0);
  const resumePromptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureFrame = useRef<number | null>(null);
  const lastAudibleVolume = useRef(clamp01(settings.defaultVolume) > 0.001 ? clamp01(settings.defaultVolume) : 1);
  const pendingGestureUpdate = useRef<| { mode: "seek"; value: number; duration: number; direction: "forward" | "rewind" } | null>(null);
  const seekPreviewPositionRef = useRef<number | null>(null);
  const lastTap = useRef<{ time: number; zone: TapZone | null }>({ time: 0, zone: null });
  const hasRestoredPosition = useRef(false);

  const backgroundPlayRef = useRef(settings.backgroundPlay);
  const lastSavedPosition = useRef(0);
  const lastPeriodicSaveAtRef = useRef(0);
  // Perf: throttle the per-tick UI state updates so the giant PlayerScreen
  // re-renders ~1×/sec (on whole-second change) instead of 4×/sec.
  const lastUiSecondRef = useRef(-1);
  const lastUiDurationRef = useRef(-1);
  const lastUiSourceDurationRef = useRef(-1);
  const latestPlaybackRef = useRef({
    absolutePosition: 0,
    position: 0,
    duration: 0,
    sourceDuration: 0,
  });
  const completionHandledVideoId = useRef<string | null>(null);
  const playbackErrorHandledVideoId = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);
  const autoPlayCountdownActiveRef = useRef(false);
  const videoRef = useRef<VideoRef | null>(null);
  const playerRef = useRef<VideoPlayerShim | null>(null);
  const lastSentPlayingStateRef = useRef<boolean | null>(null); // Track last play/pause command sent to native player

  const hasStartedRef = useRef<boolean>(false); // True once startPlayback has fired for the current video; reset on videoId change
  // Tracks WHICH videoId we last fired initPlayback for. Any number of
  // effect re-runs on the same videoId become no-ops (replaces the
  // hasStartedRef+playbackStartInFlightRef double-flag guard, which had
  // a race window after performPlay cleared playbackStartInFlightRef).
  const initPlaybackForVideoIdRef = useRef<string | null>(null);
  const playbackStartInFlightRef = useRef<boolean>(false);
  const pendingPlayAfterLoadRef = useRef<boolean>(false); // Set by startPlaybackUnified when source isn't loaded yet; handleVideoLoad consumes it to trigger play after seek lands
  const startupWatchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupWatchdogPositionRef = useRef(0);
  const startupWatchdogConfirmedRef = useRef(false);
  // Set when armStartupWatchdog is called before the native player has fired
  // onReadyForDisplay. The onReadyForDisplay callback consumes this flag and
  // starts the watchdog timer from a known-ready state. Stops the watchdog
  // from timing out against a player that hadn't even initialized yet (the
  // primary "first-video fails to play" symptom).
  const pendingStartupWatchdogArmRef = useRef(false);
  // Hoisted form of the watchdog's check step so onReadyForDisplay can fire
  // it directly when consuming a pending arm.
  const startupWatchdogCheckRef = useRef<(() => void) | null>(null);

  // ─── Playback state machine ─────────────────────────────────────────
  // Phase ref drives the stall detector and recovery ladder. Phase
  // changes are too frequent to merit useState (would re-render the
  // entire screen every transition). Subscribers that need re-render on
  // change are limited and read it via a useState mirror where needed.
  const playbackPhaseRef = useRef<PlaybackPhase>("idle");
  const initialPlaybackSessionId = useMemo(() => createPlaybackSessionId(routeVideoId, 0), [routeVideoId]);
  const playbackSessionIdRef = useRef(initialPlaybackSessionId);
  const sourceGenerationRef = useRef(0);
  const startupAnalyticsRef = useRef<StartupMetrics>({
    navigationAt: Date.now(),
    sourceValidatedAt: 0,
    loadStartAt: 0,
    loadedAt: 0,
    firstProgressAt: 0,
    nativePlayingAckAt: 0,
    stabilizationStartedAt: 0,
    stabilizationConfirmedAt: 0,
    startupAttempt: 0,
    recoveryCount: 0,
    rebufferCount: 0,
    stallCount: 0,
    success: false,
  });
  // ─── Playback health model ──────────────────────────────────────────
  // Wall-clock timestamps used by isPlaybackHealthy() (see below) to
  // decide whether the player is actually playing. The model trusts
  // PROGRESS first — a single isPlaying:false callback is NEVER a
  // recovery trigger by itself.
  const playbackStartTsRef = useRef<number>(0);          // when we last requested play
  const lastProgressAtRef = useRef<number>(0);           // wall-clock of last forward progress
  const lastProgressPosRef = useRef<number>(0);          // last observed currentTime
  const lastPlayAssertAtRef = useRef<number>(0);         // PLAY_ASSERT_COOLDOWN_MS gate
  const lastRecoveryAtRef = useRef<number>(0);           // RECOVERY_COOLDOWN_MS gate
  const recoveryAttemptsRef = useRef<number>(0);
  const recoveryAttemptsGenerationRef = useRef<number>(0);
  const lastHealthyAtRef = useRef<number>(0);            // set whenever isPlaybackHealthy() returns true
  const lastNativeAckPlayingAtRef = useRef<number>(0);   // native onPlaybackStateChanged{isPlaying:true}
  const isNativePlayingRef = useRef<boolean>(false);
  const bufferingStartedAtRef = useRef<number | null>(null);
  const stabilizationStartedAtRef = useRef<number>(0);
  const stabilizationStartPositionRef = useRef<number>(0);
  const startupAttemptRef = useRef<number>(0);
  const startupRecoveryCountRef = useRef<number>(0);
  const startupStableConfirmedRef = useRef<boolean>(false);
  const lastNativeFalseReasonRef = useRef<PlaybackFailureReason>("unknown");
  const lastRecoveryClassRef = useRef<PlaybackFailureReason>("unknown");
  const lastRecoveryActionRef = useRef<RecoveryAction | null>(null);
  const lastRemountAtRef = useRef<number>(0);
  const consecutiveSurfaceLostRef = useRef<number>(0);
  const lastSuccessfulNativeAckRecoveryAtRef = useRef<number>(0);

  const [recoveryRemountKey, setRecoveryRemountKey] = useState(0);
  // Phase 7 — Fast path bookkeeping refs.
  // fastStartIssuedForVideoIdRef: set to the current videoId by startPlaybackFast.
  // handleVideoLoadFast inspects it to distinguish a pre-init source-driven
  // onLoad (driven by the Video's source prop changing) from the init effect's
  // intentional start. Pre-init onLoads commit data only — they don't drive
  // the phase machine or the stable-transition timer.
  const fastStartIssuedForVideoIdRef = useRef<string | null>(null);
  // fastRecoveryAttemptCountRef / fastRecoveryWindowStartRef cap consecutive
  // simpleRecovery calls. After 4 in a 10s window without intervening
  // progress, escalate to a full remount via setRecoveryRemountKey.
  const fastRecoveryAttemptCountRef = useRef<number>(0);
  const fastRecoveryWindowStartRef = useRef<number>(0);
  // Phase 8: gate the next/prev session prefetch so it fires exactly once
  // per video session. Reset by the video-switch effect.
  const prefetchedForVideoIdRef = useRef<string | null>(null);
  // Decoder-fallback chain on onError: try the next decoder mode before
  // surfacing the fatal "Playback unavailable" overlay.
  const decoderFallbackAttemptedRef = useRef<Record<string, boolean>>({});
  const [resumedFromSaved, setResumedFromSaved] = useState(false); // True when initPlayback chose the saved-position branch — drives persistent Start Over button visibility
  const fallbackRetryCountRef = useRef<number>(0); // Caps validation fallbacks per video so we don't loop
  const seekNudgeUsedRef = useRef<boolean>(false); // Tier-1 recovery: try a tiny seek before destroying state
  // Phase 1 diagnostic refs — let the validator distinguish slow-startup from real freeze
  const videoErrorRef = useRef<{ errorString?: string; errorException?: unknown } | null>(null);
  const onLoadFiredRef = useRef<boolean>(false);
  const onReadyForDisplayFiredRef = useRef<boolean>(false);
  const onProgressFiredRef = useRef<boolean>(false);
  const loadStartTimestampRef = useRef<number | null>(null);
  const loadStartPerformanceRef = useRef<number | null>(null);
  // Absolute seconds to seek to as soon as the source is loaded. Used to
  // survive the race between startPlaybackUnified() firing and <Video> having
  // mounted/loaded — without forcing a source-object change.
  const pendingResumeSeekRef = useRef<number | null>(null);
  const pendingStartupPositionRef = useRef<number>(0);
  const startupIntentRef = useRef<StartupIntent | null>(null);
  const pendingStartupIntentReasonRef = useRef<StartupIntent["reason"] | null>(null);
  const runStartupRecoveryRef = useRef<((failureReason: PlaybackFailureReason) => void) | null>(null);
  // Stall recovery / state-change debouncing
  const playbackStateChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupFalseReassertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadyTimestampRef = useRef<number>(0);
  const queueListRef = useRef<FlatList<(typeof videos)[number]> | null>(null);
  const loadedPlayerVideoId = useRef<string | null>(null);
  const orientationManagedRef = useRef(false);
  const autoPlayCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayIntentRef = useRef(settings.autoPlay);
  const discoveryHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideDiscoveryHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioHandoffInProgressRef = useRef(false);
  const exitingPlayerRef = useRef(false);
  const longPressStartSpeedRef = useRef<number>(1);
  const volumeBoostRef = useRef(1);
  const currentIndexRef = useRef(-1);
  const videoQueueRef = useRef<VideoItem[]>([]);
  const [folderQueueVideos, setFolderQueueVideos] = useState<VideoItem[]>([]);
  const pendingSeekAbsoluteRef = useRef<number | null>(null);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const navigateToVideoRef = useRef<((v: any, dir: any) => void) | null>(null);
  // Left null at mount on purpose: the URI-validation effect seeds this ref
  // (and records sourceValidatedAt analytics) exactly once. The state above is
  // pre-seeded so the <Video> source mounts on the first render; the effect's
  // setValidatedPlaybackUri then no-ops because the value already matches.
  const validatedPlaybackUriRef = useRef<string | null>(null);
  const lastVideoRenderStateLogRef = useRef<string | null>(null);
  const [showEndingOverlay, setShowEndingOverlay] = useState(false);
  // ── Stop-reason diagnostics ──────────────────────────────────────────────
  // Every code path that halts playback writes a reason here so we can trace
  // "why did the video stop?" in logs (search for [PlaybackStop]).
  const lastStopReasonRef = useRef<string | null>(null);
  const gestureRef = useRef<{ mode: GestureMode | null; startX: number; startPosition: number; startVolume: number; startBrightness: number }>({
    mode: null,
    startX: 0,
    startPosition: 0,
    startVolume: 1,
    startBrightness: 0.5,
  });
  // Synchronously populated by handleNavigateToVideo BEFORE setActiveVideoId
  // so the video useMemo below can return the target immediately, without
  // the videoId flickering to `undefined` while the async storedVideo fetch
  // resolves. Cleared once a stable source (videos / currentVideo /
  // storedVideo) catches up — see the effect below the useMemo.
  const pendingNavigationTargetRef = useRef<VideoItem | null>(null);

  const video = useMemo(() => {
    return resolveActivePlaybackVideo({
      activeVideoId,
      videos,
      currentVideo,
      storedVideo,
      pendingNavigationTarget: pendingNavigationTargetRef.current,
      queuedVideos: videoQueueRef.current,
    });
  }, [activeVideoId, currentVideo, storedVideo, videos]);

  const videoId = video?.id;
  const playbackLogContext = useCallback(() => buildPlaybackLogContext({
    sessionId: playbackSessionIdRef.current,
    videoId,
    state: playbackPhaseRef.current,
    generation: sourceGenerationRef.current,
    startupAttempt: startupAttemptRef.current,
    recoveryTier: startupRecoveryCountRef.current > 0 ? Math.min(startupRecoveryCountRef.current, 4) : null,
  }), [videoId]);
  const setPlaybackPhase = useCallback((
    next: PlaybackPhase,
    reason: PlaybackTransitionReason,
  ) => {
    playbackPhaseRef.current = transitionPlaybackPhase({
      current: playbackPhaseRef.current,
      next,
      reason,
      ctx: playbackLogContext(),
    });
  }, [playbackLogContext]);
  const isCurrentGeneration = useCallback((generation: number) => {
    const current = sourceGenerationRef.current === generation;
    if (!current && __DEV__) {
      logPlayback(playbackLogContext(), "stale_callback_ignored", {
        callbackGeneration: generation,
        currentGeneration: sourceGenerationRef.current,
      });
    }
    return current;
  }, [playbackLogContext]);

  // Once a stable source (videos / currentVideo / storedVideo) covers the
  // active id, drop the pending-navigation handoff so future renders read
  // from the canonical source.
  useEffect(() => {
    const pending = pendingNavigationTargetRef.current;
    if (!pending) return;
    if (video?.id !== pending.id) return;
    const isStable =
      videos.some((v) => v.id === pending.id) ||
      currentVideo?.id === pending.id ||
      storedVideo?.id === pending.id;
    if (isStable) {
      pendingNavigationTargetRef.current = null;
    }
  }, [video, videos, currentVideo, storedVideo]);

  const runTransition = useCallback((title: string, direction: "next" | "prev") => {
    setTransitionMeta({ title, direction });
    transitionProgress.setValue(0);
    Animated.timing(transitionProgress, {
      toValue: 1,
      duration: 280,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => {
      if (isMounted.current) setTransitionMeta(null);
    });
  }, [transitionProgress]);



  const volumeHudOpacitySV = useSharedValue(0);
  const brightnessHudOpacitySV = useSharedValue(0);
  const seekHudOpacitySV = useSharedValue(0);
  const doubleTapSeekOpacitySV = useSharedValue(0);
  const sideGestureMessageOpacitySV = useSharedValue(0);
  const volumeHudTranslateSV = useSharedValue(90);
  const brightnessHudTranslateSV = useSharedValue(-90);
  const volumeHudHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessHudHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sideGestureMessageHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeHudAnimStyle = useAnimatedStyle(() => ({ opacity: volumeHudOpacitySV.value, transform: [{ translateX: volumeHudTranslateSV.value }] }));
  const brightnessHudAnimStyle = useAnimatedStyle(() => ({ opacity: brightnessHudOpacitySV.value, transform: [{ translateX: brightnessHudTranslateSV.value }] }));
  const seekHudAnimStyle = useAnimatedStyle(() => ({ opacity: seekHudOpacitySV.value }));
  const doubleTapSeekAnimStyle = useAnimatedStyle(() => ({ opacity: doubleTapSeekOpacitySV.value }));
  const sideGestureMessageAnimStyle = useAnimatedStyle(() => ({ opacity: sideGestureMessageOpacitySV.value }));
  const [volumeHudPercent, setVolumeHudPercent] = useState(0);
  const [brightnessHudPercent, setBrightnessHudPercent] = useState(0);
  const [sideGestureMessage, setSideGestureMessage] = useState<{ label: string; tone: "volume" | "brightness" } | null>(null);
  const [doubleTapSeekFeedback, setDoubleTapSeekFeedback] = useState<{
    side: "left" | "right";
    label: string;
  } | null>(null);
  const [volumeDirection, setVolumeDirection] = useState<'up' | 'down' | null>(null);
  const [brightnessDirection, setBrightnessDirection] = useState<'up' | 'down' | null>(null);
  const prevVolumePercentRef = useRef(0);
  const prevBrightnessPercentRef = useRef(0);
  const nightModeRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const isLockedRef = useRef(false);
  const sessionIdRef = useRef<number>(Date.now());
  // const doubleTapChainRef = useRef<{ zone: 'left' | 'right' | null; count: number; resetTimer: ReturnType<typeof setTimeout> | null }>({ zone: null, count: 0, resetTimer: null });
  const doubleTapChainRef = useRef<{
    zone: 'left' | 'right' | null;
    count: number;
    resetTimer: ReturnType<typeof setTimeout> | null;
    lastTapTime: number;
    pendingZone: 'left' | 'right' | null;
  }>({
    zone: null,
    count: 0,
    resetTimer: null,
    lastTapTime: 0,
    pendingZone: null
  });
  const loadLoopTrackerRef = useRef<{
    key: string | null;
    firstAt: number;
    lastAt: number;
    starts: number;
    loads: number;
    warned: boolean;
  }>({
    key: null,
    firstAt: 0,
    lastAt: 0,
    starts: 0,
    loads: 0,
    warned: false,
  });


  const pinchGestureRef = useRef({ active: false, startDistance: 0, startScale: MIN_PINCH_SCALE, hasChanged: false });
  nightModeRef.current = nightMode;
  const videoWrapperProps = Platform.OS === "web" ? {} : { pointerEvents: "none" as const };

  const showHud = useCallback((mode: GestureMode, label: string, progress: number, direction?: "forward" | "rewind") => {
    setGestureHud({ mode, label, progress: clamp01(progress), direction });
    seekHudOpacitySV.value = withTiming(1, { duration: 80 });
    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => {
      seekHudOpacitySV.value = withTiming(0, { duration: 280 });
      setGestureHud(null);
    }, HUD_TIMEOUT);
  }, [seekHudOpacitySV]);

  const showVolumeHud = useCallback((progress: number) => {
    const newPct = Math.round(clamp01(progress) * 100);
    setVolumeDirection(newPct > prevVolumePercentRef.current ? 'up' : newPct < prevVolumePercentRef.current ? 'down' : null);
    prevVolumePercentRef.current = newPct;
    setVolumeHudPercent(newPct);
    setSideGestureMessage({ label: `Volume ${newPct}%`, tone: "volume" });
    sideGestureMessageOpacitySV.value = withTiming(1, { duration: 80 });
    if (sideGestureMessageHideTimer.current) clearTimeout(sideGestureMessageHideTimer.current);
    sideGestureMessageHideTimer.current = setTimeout(() => {
      sideGestureMessageOpacitySV.value = withTiming(0, { duration: 240 });
      setSideGestureMessage(null);
    }, HUD_TIMEOUT);
    volumeHudOpacitySV.value = withTiming(1, { duration: 120 });
    volumeHudTranslateSV.value = withTiming(0, { duration: 200 });
    if (volumeHudHideTimer.current) clearTimeout(volumeHudHideTimer.current);
    volumeHudHideTimer.current = setTimeout(() => {
      volumeHudOpacitySV.value = withTiming(0, { duration: 320 });
      volumeHudTranslateSV.value = withTiming(90, { duration: 320 });
      setVolumeDirection(null);
    }, HUD_TIMEOUT);
  }, [sideGestureMessageOpacitySV, volumeHudOpacitySV, volumeHudTranslateSV]);

  const showBrightnessHud = useCallback((progress: number) => {
    const newPct = Math.round(clamp01(progress) * 100);
    setBrightnessDirection(newPct > prevBrightnessPercentRef.current ? 'up' : newPct < prevBrightnessPercentRef.current ? 'down' : null);
    prevBrightnessPercentRef.current = newPct;
    setBrightnessHudPercent(newPct);
    setSideGestureMessage({ label: `Brightness ${newPct}%`, tone: "brightness" });
    sideGestureMessageOpacitySV.value = withTiming(1, { duration: 80 });
    if (sideGestureMessageHideTimer.current) clearTimeout(sideGestureMessageHideTimer.current);
    sideGestureMessageHideTimer.current = setTimeout(() => {
      sideGestureMessageOpacitySV.value = withTiming(0, { duration: 240 });
      setSideGestureMessage(null);
    }, HUD_TIMEOUT);
    brightnessHudOpacitySV.value = withTiming(1, { duration: 120 });
    brightnessHudTranslateSV.value = withTiming(0, { duration: 200 });
    if (brightnessHudHideTimer.current) clearTimeout(brightnessHudHideTimer.current);
    brightnessHudHideTimer.current = setTimeout(() => {
      brightnessHudOpacitySV.value = withTiming(0, { duration: 320 });
      brightnessHudTranslateSV.value = withTiming(-90, { duration: 320 });
      setBrightnessDirection(null);
    }, HUD_TIMEOUT);
  }, [brightnessHudOpacitySV, brightnessHudTranslateSV, sideGestureMessageOpacitySV]);

  const showVolumeHudRef = useRef(showVolumeHud);
  showVolumeHudRef.current = showVolumeHud;

  useEffect(() => {
    L.player('mounted', { routeVideoId });
    return () => {
      isMounted.current = false;
      L.player('unmounted', { routeVideoId });
      try {
        playerRef.current?.pause();
      } catch { }
    };
  }, []);

  useEffect(() => {
    if (routeVideoId) {
      setActiveVideoId(routeVideoId);
    }
  }, [routeVideoId]);

  useEffect(() => {
    let cancelled = false;

    async function loadStoredVideo() {
      if (!activeVideoId) {
        setStoredVideo(null);
        return;
      }

      if (
        videos.some((item) => item.id === activeVideoId) ||
        currentVideo?.id === activeVideoId
      ) {
        setStoredVideo(null);
        return;
      }

      const found = await fetchVideoById(activeVideoId);
      if (!cancelled) {
        setStoredVideo(found);
      }
    }

    void loadStoredVideo();

    return () => {
      cancelled = true;
    };
  }, [activeVideoId, currentVideo, fetchVideoById, videos]);


  const hydratedVideos = useMemo(() => {
    if (!video || videos.some((item) => item.id === video.id)) return videos;
    return [video, ...videos];
  }, [video, videos]);
  useEffect(() => {
    if (!routeFolder) {
      setFolderQueueVideos([]);
      return;
    }
    getVideosByFolder(routeFolder)
      .then((items) => setFolderQueueVideos(items.filter((i) => i.mediaType !== "audio")))
      .catch(() => { });
  }, [routeFolder]);

  const mediaType = video?.mediaType ?? "video";
  const isAudioMode = mediaType === "audio";
  const featureConfig = useMemo(
    () => createPlayerFeatureConfig(settings, mediaType),
    [mediaType, settings]
  );

  // Record the player log stream for a 5-minute window once a video session
  // opens, then flush it to a text file (Settings → Diagnostics). Captures
  // "what issue playback is facing" without touching any log call sites.
  useEffect(() => {
    if (isAudioMode) return;
    startPlaybackDiagnostics({
      videoId: videoId ?? null,
      title: video?.title ?? null,
      uri: playbackUri ?? null,
      durationSeconds: video?.duration ?? null,
    });
    return () => {
      void stopPlaybackDiagnostics();
    };
    // Start once per player mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const effectiveOrientationMode = isAudioMode ? "portrait" : orientationMode;
  // Phase 8: key the queue memo on `video?.id` instead of `video` so the
  // memo only recomputes when the *identity* of the current video changes,
  // not every time any field on the video object updates. nextVideo and
  // previousVideo derived from this memo become identity-stable across
  // renders, which is a prerequisite for the prefetch hook (Step 5) to
  // run exactly once per video session.
  const playbackQueueState = useMemo(
    () =>
      resolvePlaybackQueue({
        routeFolder,
        folderQueueVideos,
        hydratedVideos,
        videoId,
        routePlaybackUri,
        activeVideoId,
        routeVideoId,
        video,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeVideoId, folderQueueVideos, hydratedVideos, routeFolder, routePlaybackUri, routeVideoId, video?.id, videoId]
  );
  const { videoQueue, audioQueue, playbackUri, currentIndex, previousVideo, nextVideo } = playbackQueueState;
  const setStoredSubtitlesEnabled = usePlayerStore((s) => s.setSubtitlesEnabled);
  const setSubtitleShowLowConf = usePlayerStore((s) => s.setSubtitleShowLowConf);
  const setStoredSubtitleFontSize = usePlayerStore((s) => s.setSubtitleFontSize);

  useEffect(() => {
    setSubtitleShowLowConf(featureConfig.subtitleShowLowConfidence);
    setStoredSubtitleFontSize(
      settings.subtitleFontSize === "small"
        ? "small"
        : settings.subtitleFontSize === "large"
          ? "large"
          : "medium"
    );
  }, [featureConfig.subtitleShowLowConfidence, setStoredSubtitleFontSize, setSubtitleShowLowConf, settings.subtitleFontSize]);

  useEffect(() => {
    if (isAudioMode) return;
    setStoredSubtitlesEnabled(featureConfig.subtitleGenerationEnabled && settings.defaultSubtitles);
    setNightMode(featureConfig.defaultNightMode);
    setOrientationMode(featureConfig.defaultOrientationLock);
    if (!featureConfig.lockControlEnabled) {
      setIsLocked(false);
    }
  }, [
    featureConfig.defaultNightMode,
    featureConfig.defaultOrientationLock,
    featureConfig.lockControlEnabled,
    featureConfig.subtitleGenerationEnabled,
    isAudioMode,
    settings.defaultSubtitles,
    setStoredSubtitlesEnabled,
    videoId,
  ]);

  useEffect(() => {
    if (!featureConfig.nightModeEnabled && nightMode) {
      setNightMode(false);
    }
    if (!featureConfig.lockControlEnabled && isLocked) {
      setIsLocked(false);
    }
    if (!featureConfig.sleepTimerEnabled && sleepTimerRemaining !== null) {
      setSleepTimerRemaining(null);
    }
  }, [featureConfig.lockControlEnabled, featureConfig.nightModeEnabled, featureConfig.sleepTimerEnabled, isLocked, nightMode, sleepTimerRemaining]);
  const clipStartOffset = getClipStartOffset(video);
  const clipEndPosition = getClipEndPosition(video);

  const isLandscapeLayout = viewport.width > viewport.height;
  const portraitUpNextTotalCount = videoQueue.length;
  const defaultUpNextLandscapePage = currentIndex >= 0 ? Math.floor(currentIndex / UP_NEXT_LANDSCAPE_PAGE_SIZE) : 0;
  const landscapeUpNextPageCount = Math.ceil(videoQueue.length / UP_NEXT_LANDSCAPE_PAGE_SIZE);
  const activeUpNextLandscapePage = landscapeUpNextPageCount > 0 ? Math.min(upNextLandscapePage, landscapeUpNextPageCount - 1) : 0;
  const queueStartIndex = isLandscapeLayout ? activeUpNextLandscapePage * UP_NEXT_LANDSCAPE_PAGE_SIZE : 0;
  const queueVideos = useMemo(
    () => videoQueue.slice(queueStartIndex, queueStartIndex + (isLandscapeLayout ? UP_NEXT_LANDSCAPE_PAGE_SIZE : Math.max(upNextVisibleCount, 1))),
    [isLandscapeLayout, queueStartIndex, upNextVisibleCount, videoQueue]
  );
  const canLoadMoreUpNext = !isLandscapeLayout && queueVideos.length < portraitUpNextTotalCount;
  const canScrollUpNextPrev = isLandscapeLayout && activeUpNextLandscapePage > 0;
  const canScrollUpNextNext = isLandscapeLayout && activeUpNextLandscapePage < landscapeUpNextPageCount - 1;
  const naturalAspectRatio = videoNaturalSize && videoNaturalSize.width > 0 && videoNaturalSize.height > 0 ? videoNaturalSize.width / videoNaturalSize.height : null;
  const activeAspectRatio = forcedAspectRatio ? parseAspectRatio(forcedAspectRatio) : naturalAspectRatio;
  const selectedAudioTrack = selectedAudioTrackIndex === null
    ? audioTracks.find((track) => track.selected) ?? audioTracks[0] ?? null
    : audioTracks.find((track) => track.index === selectedAudioTrackIndex) ?? null;
  const safeSelectedAudioTrackIndex = selectedAudioTrack?.index ?? null;
  const audioTrackLabel = audioTracks.length > 1 ? getAudioTrackLabel(selectedAudioTrack) : "Audio";
  // Pin the surface type for the lifetime of a video session. Even if
  // `decoderMode` changes mid-playback (e.g. via the onError decoder-fallback
  // ladder hwPlus → hw → sw), the RNV `viewType` prop is read once at the
  // first mount for this `videoId`. The accompanying recoveryRemountKey bump
  // already triggers a full <Video> remount on fallback, so a fresh viewType
  // is unnecessary — and mutating viewType mid-flight causes a 1–3 s surface
  // swap stall that masquerades as a decoder stall in the recovery ladder.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const decoderViewType = useMemo(
    () =>
      Platform.OS === "android"
        ? decoderMode === "hw"
          ? ViewType.TEXTURE
          : ViewType.SURFACE
        : undefined,
    [videoId],
  );
  currentIndexRef.current = currentIndex;
  videoQueueRef.current = videoQueue;
  const videoFrameStyle = useMemo(() => {
    if (isAudioMode || contentFitMode === "cover" || contentFitMode === "fill" || !activeAspectRatio || viewport.width <= 0 || viewport.height <= 0) {
      return StyleSheet.absoluteFillObject;
    }
    const viewportRatio = viewport.width / viewport.height;
    if (viewportRatio > activeAspectRatio) {
      const height = viewport.height;
      return { width: height * activeAspectRatio, height };
    }
    const width = viewport.width;
    return { width, height: width / activeAspectRatio };
  }, [activeAspectRatio, contentFitMode, isAudioMode, viewport.height, viewport.width]);

  useEffect(() => {
    if (!video || !isAudioMode) return;
    const startIndex = Math.max(0, audioQueue.findIndex((item) => item.id === video.id));
    const startPosition = Number.isFinite(video.lastPosition) && (video.lastPosition ?? 0) > 1
      ? video.lastPosition
      : 0;
    void playAudio(audioQueue.length > 0 ? audioQueue : [video], startIndex, { startPosition });
    navigation.replace("audio-player");
  }, [audioQueue, isAudioMode, navigation, playAudio, video]);

  if (!playerRef.current && playbackUri && !isAudioMode) {
    // Shim creation is idempotent (gated by !playerRef.current). Do NOT trigger
    // playback here — initPlayback below is the single source of truth for
    // startup and routes through startPlaybackUnified, which coordinates seek
    // with onLoad. A render-time play() raced that flow and caused fresh-play
    // / resume regressions.
    const existingSession = getPlayerSession();
    const instance = existingSession?.player as VideoPlayerShim | undefined ?? createVideoPlayerShim(videoRef);
    instance.loop = Boolean(!video?.isClip && (settings.loopMode === "one" || (settings.loopMode === "all" && videoQueue.length <= 1)));
    instance.playbackRate = settings.speed;
    applyPlayerAudioState(instance, { volume: 1, volumeBoost, isMuted, backgroundPlay: settings.backgroundPlay });
    playerRef.current = instance;
    loadedPlayerVideoId.current = existingSession?.videoId ?? null;
    setPlayerSession(instance, loadedPlayerVideoId.current);
  }

  const player = playerRef.current;

  const capturePlaybackSnapshot = useCallback((absolutePosition?: number, sourceDurationValue?: number) => {
    const nextAbsolutePosition =
      Number.isFinite(absolutePosition)
        ? Number(absolutePosition)
        : playerRef.current && Number.isFinite(playerRef.current.currentTime)
          ? playerRef.current.currentTime
          : latestPlaybackRef.current.absolutePosition;
    const nextSourceDuration =
      Number.isFinite(sourceDurationValue) && Number(sourceDurationValue) > 0
        ? Number(sourceDurationValue)
        : playerRef.current && Number.isFinite(playerRef.current.duration) && playerRef.current.duration > 0
          ? playerRef.current.duration
          : sourceDuration || duration || video?.duration || latestPlaybackRef.current.sourceDuration || 0;
    const nextDuration = getPlayableDuration(video, nextSourceDuration || video?.duration || 0);
    const nextPosition = getRelativePlaybackPosition(
      video,
      nextAbsolutePosition,
      nextSourceDuration || video?.duration || 0
    );

    latestPlaybackRef.current = {
      absolutePosition: nextAbsolutePosition,
      position: nextPosition,
      duration: nextDuration,
      sourceDuration: nextSourceDuration,
    };

    return latestPlaybackRef.current;
  }, [duration, sourceDuration, video]);

  const isStartupRecoveryPhase = useCallback((phase: PlaybackPhase) => {
    return (
      phase === "loading" ||
      phase === "starting" ||
      phase === "stabilizing" ||
      (phase === "recovering" && !startupStableConfirmedRef.current)
    );
  }, []);

  const buildPlaybackHealthSnapshot = useCallback((): PlaybackHealthSnapshot => {
    const now = Date.now();
    const progressAgeMs =
      lastProgressAtRef.current > 0 ? now - lastProgressAtRef.current : Number.POSITIVE_INFINITY;
    const nativeAckAgeMs =
      lastNativeAckPlayingAtRef.current > 0 ? now - lastNativeAckPlayingAtRef.current : null;
    const bufferAgeMs =
      isBuffering && bufferingStartedAtRef.current !== null
        ? now - bufferingStartedAtRef.current
        : null;
    return {
      now,
      state: playbackPhaseRef.current,
      playbackStartAt: playbackStartTsRef.current,
      lastProgressAt: lastProgressAtRef.current,
      lastRecoveryAt: lastRecoveryAtRef.current,
      lastNativeAckPlayingAt: lastNativeAckPlayingAtRef.current,
      isBuffering,
      bufferAgeMs,
      appInBackground: AppState.currentState !== "active",
      audioHandoffInProgress: audioHandoffInProgressRef.current,
      recentReadyForDisplay:
        lastReadyTimestampRef.current > 0 && now - lastReadyTimestampRef.current < 3000,
      // lastReadyTimestampRef is reset to 0 on every video switch, so a
      // non-zero value means the surface attached at least once this session.
      hadReadyForDisplay: lastReadyTimestampRef.current > 0,
      isNativePlaying: isNativePlayingRef.current,
      progressAgeMs,
      nativeAckAgeMs,
      startupGraceMs: STARTUP_GRACE_MS,
      stallTimeoutMs: STALL_TIMEOUT_MS,
      nativeAckFreshMs: NATIVE_ACK_FRESH_MS,
      longBufferSuppressionMs: LONG_BUFFER_SUPPRESSION_MS,
      recoveryCooldownMs: RECOVERY_COOLDOWN_MS,
    };
  }, [isBuffering]);

  const getRecoveryLogFields = useCallback((
    reason: string,
    overrides?: {
      failureReason?: PlaybackFailureReason;
      recoveryAction?: RecoveryAction | null;
      startupPath?: boolean;
    }
  ) => {
    const snapshot = buildPlaybackHealthSnapshot();
    return {
      reason,
      failureReason: overrides?.failureReason ?? lastRecoveryClassRef.current,
      recoveryClass: overrides?.failureReason ?? lastRecoveryClassRef.current,
      recoveryAction: overrides?.recoveryAction ?? lastRecoveryActionRef.current,
      phase: snapshot.state,
      lastProgressAgeMs: Number.isFinite(snapshot.progressAgeMs) ? snapshot.progressAgeMs : null,
      lastNativeAckAgeMs: snapshot.nativeAckAgeMs,
      bufferAgeMs: snapshot.bufferAgeMs,
      isBuffering: snapshot.isBuffering,
      autoPlayIntent: autoPlayIntentRef.current,
      recoveryCount: recoveryAttemptsRef.current,
      startupPath: overrides?.startupPath ?? isStartupRecoveryPhase(snapshot.state),
      consecutiveSurfaceLost: consecutiveSurfaceLostRef.current,
    };
  }, [buildPlaybackHealthSnapshot, isStartupRecoveryPhase]);

  const resetRecoveryAttempts = useCallback((generation = sourceGenerationRef.current) => {
    recoveryAttemptsGenerationRef.current = generation;
    recoveryAttemptsRef.current = 0;
  }, []);

  const requestRecoveryRemount = useCallback((failureReason: PlaybackFailureReason) => {
    const now = Date.now();
    if (now - lastRemountAtRef.current < SURFACE_LOST_REMOUNT_COOLDOWN_MS) {
      logRecovery(playbackLogContext(), "recovery_reentered_stall", {
        ...getRecoveryLogFields("remount_cooldown", {
          failureReason,
          recoveryAction: "video_remount",
        }),
      });
      return false;
    }
    lastRemountAtRef.current = now;
    lastRecoveryAtRef.current = now;
    lastRecoveryClassRef.current = failureReason;
    lastRecoveryActionRef.current = "video_remount";
    logRecovery(playbackLogContext(), "recovery_remount_requested", {
      ...getRecoveryLogFields("remount_requested", {
        failureReason,
        recoveryAction: "video_remount",
      }),
      position: Number(latestPlaybackRef.current.position.toFixed(2)),
    });
    setRecoveryRemountKey((k) => k + 1);
    return true;
  }, [getRecoveryLogFields, playbackLogContext]);

  const setStartupIntent = useCallback((
    requestedPosition: number,
    reason: StartupIntent["reason"],
    generation = sourceGenerationRef.current,
  ) => {
    const safeRequested = Math.max(Number.isFinite(requestedPosition) ? requestedPosition : 0, 0);
    const playableDuration = getPlayableDuration(video, sourceDuration || video?.duration || 0);
    const resolvedPosition = resolveStartupSeekPosition({
      requestedPosition: safeRequested,
      duration: playableDuration,
    });
    const intent: StartupIntent = {
      videoId: videoId ?? null,
      generation,
      requestedPosition: safeRequested,
      resolvedPosition,
      reason,
    };
    startupIntentRef.current = intent;
    logPlayback(playbackLogContext(), "startup_intent", intent);
    return intent;
  }, [playbackLogContext, sourceDuration, video, videoId]);

  const clearStartupWatchdog = useCallback(() => {
    if (startupWatchdogTimerRef.current) {
      clearTimeout(startupWatchdogTimerRef.current);
      startupWatchdogTimerRef.current = null;
    }
    pendingStartupWatchdogArmRef.current = false;
  }, []);

  const confirmStartupPlayback = useCallback(() => {
    if (!startupStableConfirmedRef.current) {
      startupStableConfirmedRef.current = true;
      startupAnalyticsRef.current.success = true;
      startupAnalyticsRef.current.stabilizationConfirmedAt = Date.now();
      logPlayback(playbackLogContext(), "startup_metrics", buildStartupMetricsLog(startupAnalyticsRef.current));
    }
    startupWatchdogConfirmedRef.current = true;
    playbackStartInFlightRef.current = false;
    clearStartupWatchdog();
  }, [clearStartupWatchdog, playbackLogContext]);

  const failStartupPlayback = useCallback((reason: string) => {
    logPlayback(playbackLogContext(), "startup_failed", { reason });
    clearStartupWatchdog();
    startupWatchdogConfirmedRef.current = false;
    playbackStartInFlightRef.current = false;
    pendingPlayAfterLoadRef.current = false;
    hasStartedRef.current = false;
    autoPlayIntentRef.current = false;
    lastSentPlayingStateRef.current = null;
    setIsPlaying(false);
  }, [clearStartupWatchdog, playbackLogContext]);

  const armStartupWatchdog = useCallback(() => {
    clearStartupWatchdog();
    startupWatchdogConfirmedRef.current = false;
    startupWatchdogPositionRef.current = latestPlaybackRef.current.position;
    const watchdogGeneration = sourceGenerationRef.current;

    const checkStartup = () => {
      startupWatchdogTimerRef.current = null;
      if (!isCurrentGeneration(watchdogGeneration)) return;
      if (!isMounted.current || !autoPlayIntentRef.current || !playerRef.current) return;
      if (startupWatchdogConfirmedRef.current) {
        confirmStartupPlayback();
        return;
      }

      const latestPosition = latestPlaybackRef.current.position;
      const hasAdvanced =
        latestPosition > startupWatchdogPositionRef.current + 0.2;

      if (hasAdvanced) {
        if (playbackPhaseRef.current !== "stabilizing" && playbackPhaseRef.current !== "playing") {
          const now = Date.now();
          stabilizationStartedAtRef.current = stabilizationStartedAtRef.current || now;
          stabilizationStartPositionRef.current = startupWatchdogPositionRef.current;
          startupAnalyticsRef.current.stabilizationStartedAt =
            startupAnalyticsRef.current.stabilizationStartedAt || now;
          setPlaybackPhase("stabilizing", "progress_advanced");
        }
        return;
      }

      logPlayback(playbackLogContext(), "startup_watchdog_handoff_to_health_model", {
        graceMs: STARTUP_GRACE_MS,
        startPosition: Number(startupWatchdogPositionRef.current.toFixed(2)),
        latestPosition: Number(latestPosition.toFixed(2)),
      });
      setPlaybackPhase("recovering", "startup_timeout");
    };

    startupWatchdogCheckRef.current = checkStartup;

    if (!onReadyForDisplayFiredRef.current) {
      pendingStartupWatchdogArmRef.current = true;
      return;
    }

    startupWatchdogTimerRef.current = setTimeout(checkStartup, STARTUP_GRACE_MS);
  }, [clearStartupWatchdog, confirmStartupPlayback, isCurrentGeneration, playbackLogContext, setPlaybackPhase]);

  const startPlaybackUnified = useCallback(async (options?: {
    startPosition?: number;
    durationHint?: number;
    forceReset?: boolean;
  }) => {
    const startPerf = nowPerformanceMs();
    const fallbackPlaybackUri = playbackUri ? normalizePlaybackUri(playbackUri) : null;
    const effectivePlaybackUri = validatedPlaybackUri ?? fallbackPlaybackUri;
    if (!playerRef.current || !effectivePlaybackUri) {
      logPlayback(playbackLogContext(), "start_blocked", {
        hasPlayer: Boolean(playerRef.current),
        hasValidatedPlaybackUri: Boolean(validatedPlaybackUri),
        hasPlaybackUri: Boolean(playbackUri),
        hasVideoSource: Boolean(fallbackPlaybackUri),
      });
      console.warn('[Playback] Cannot start - no player or URI');
      playbackStartInFlightRef.current = false;
      return false;
    }

    try {
      playbackStartInFlightRef.current = true;
      startupAttemptRef.current += 1;
      startupRecoveryCountRef.current = 0;
      startupStableConfirmedRef.current = false;
      stabilizationStartedAtRef.current = 0;
      stabilizationStartPositionRef.current = 0;
      startupAnalyticsRef.current.startupAttempt = startupAttemptRef.current;
      startupAnalyticsRef.current.recoveryCount = 0;
      startupAnalyticsRef.current.success = false;
      setPlaybackPhase("loading", "start_requested");
      // Mark the moment we requested playback — drives the startup grace
      // window inside isPlaybackHealthy().
      playbackStartTsRef.current = Date.now();
      lastPlayAssertAtRef.current = Date.now();
      lastRecoveryAtRef.current = 0;
      lastProgressAtRef.current = 0;
      lastProgressPosRef.current = 0;
      lastHealthyAtRef.current = Date.now();
      clearRecoveryTimers();
      // Claim the active playback session — stops any audio TrackPlayer
      // session so it doesn't fight us for the audio focus when we resume.
      void PlayerManager.playVideo();

      // Only trust the cached `sourceDuration` / `video.duration` once the
      // NEW source has fired `onLoad` — otherwise these still hold the
      // PREVIOUS video's duration and the log line below misreports it.
      const onLoadHasFiredForThisSource = onLoadFiredRef.current;
      const totalDuration =
        latestPlaybackRef.current.duration ||
        (Number.isFinite(options?.durationHint) ? Number(options?.durationHint) : 0) ||
        (onLoadHasFiredForThisSource ? sourceDuration : 0) ||
        (onLoadHasFiredForThisSource ? video?.duration ?? 0 : 0) ||
        0;
      const startPos = Math.max(options?.startPosition ?? 0, 0);
      const safePosition = totalDuration > 0
        ? resolveStartupSeekPosition({ requestedPosition: startPos, duration: totalDuration })
        : startPos;
      const activeIntent = startupIntentRef.current;
      if (
        activeIntent &&
        activeIntent.videoId === (videoId ?? null) &&
        activeIntent.generation === sourceGenerationRef.current
      ) {
        activeIntent.requestedPosition = startPos;
        activeIntent.resolvedPosition = safePosition;
      }
      const absolutePosition = totalDuration > 0
        ? getAbsolutePlaybackPosition(video, safePosition, totalDuration)
        : getClipStartOffset(video) + safePosition;
      capturePlaybackSnapshot(absolutePosition, totalDuration);

      if (onLoadHasFiredForThisSource) {
        logPlayback(playbackLogContext(), "starting_at", {
          position: safePosition,
          duration: totalDuration,
          elapsedMs: Number((nowPerformanceMs() - startPerf).toFixed(1)),
        });
      } else {
        logPlayback(playbackLogContext(), "queued_for_load", {
          elapsedMs: Number((nowPerformanceMs() - startPerf).toFixed(1)),
        });
      }

      // Never seek before onLoad. The active source must confirm load first,
      // otherwise rapid navigation can apply this seek to the previous source.
      pendingStartupPositionRef.current = safePosition;
      pendingResumeSeekRef.current = safePosition;

      hasRestoredPosition.current = true;
      autoResumeCompletedRef.current = true;
      // The user explicitly opened the screen — always play, regardless of
      // settings.autoPlay (that setting governs next-video auto-advance only).
      autoPlayIntentRef.current = true;

      const isResumeFromSaved = !!options?.startPosition;

      const performPlay = () => {
        if (!playerRef.current) return false;
        try {
          lastSentPlayingStateRef.current = null;
          lastPlayAssertAtRef.current = Date.now();
          logPlayback(playbackLogContext(), "native_play_called", {
            path: "startPlaybackUnified",
            elapsedMs: Number((nowPerformanceMs() - startPerf).toFixed(1)),
          });
          playerRef.current.play();
          lastSentPlayingStateRef.current = true;
          setIsPlaying(true);
          setPosition(safePosition);
          setShowStartOverButton(isResumeFromSaved);
          setResumePrompt(null);
          hasStartedRef.current = true;
          playbackStartInFlightRef.current = false;
          armStartupWatchdog();
          return true;
        } catch (e) {
          console.error('[Playback] Native play failed:', e);
          playbackStartInFlightRef.current = false;
          return false;
        }
      };

      if (onLoadFiredRef.current) {
        // Source already loaded — seek has applied; play immediately.
        if (pendingResumeSeekRef.current !== null) {
          const resolvedPosition = resolveStartupSeekPosition({
            requestedPosition: pendingResumeSeekRef.current,
            duration: totalDuration,
          });
          const resolvedAbsolutePosition = getAbsolutePlaybackPosition(video, resolvedPosition, totalDuration);
          pendingResumeSeekRef.current = null;
          setPlaybackPhase("seeking", "seek_started");
          videoRef.current?.seek(resolvedAbsolutePosition);
          capturePlaybackSnapshot(resolvedAbsolutePosition, totalDuration);
          setPosition(resolvedPosition);
          setPlaybackPhase("starting", "seek_completed");
        }
        return performPlay();
      } else {
        // Defer play until handleVideoLoad has applied the pending seek.
        logPlayback(playbackLogContext(), "deferred_play_after_load");
        pendingPlayAfterLoadRef.current = true;
        return true;
      }
    } catch (e) {
      console.error('[Playback] startPlaybackUnified failed:', e);
      playbackStartInFlightRef.current = false;
      return false;
    }
  }, [armStartupWatchdog, capturePlaybackSnapshot, playbackLogContext, playbackUri, setPlaybackPhase, validatedPlaybackUri, sourceDuration, video]);

  // ── Phase 6: Fast Startup Path ──────────────────────────────────────────
  // Parallel implementation to startPlaybackUnified. Wired in at the init
  // effect (Step 5a) when FAST_STARTUP_ENABLED is true. Avoids the legacy
  // multi-step seek/play orchestration; instead does a single seek + play
  // call plus one stabilization nudge after FAST_STARTUP_SEEK_GRACE_MS.
  const startPlaybackFast = useCallback(async (options?: {
    startPosition?: number;
  }): Promise<boolean> => {
    if (!playerRef.current || !validatedPlaybackUri) {
      console.warn('[Playback] startPlaybackFast: missing player or URI');
      return false;
    }
    try {
      const startPos = options?.startPosition ?? 0;
      const now = Date.now();
      playbackStartTsRef.current = now;
      lastProgressAtRef.current = now;
      lastHealthyAtRef.current = now;
      lastRecoveryAtRef.current = 0;
      startupStableConfirmedRef.current = false;
      autoPlayIntentRef.current = true;
      // Phase 7: mark that the init effect has claimed this videoId. Any
      // onLoad before this point is a pre-init source-driven load and
      // handleVideoLoadFast will skip its phase/timer side effects.
      fastStartIssuedForVideoIdRef.current = videoId ?? null;
      // Phase 7: drive the playback phase state machine — matches the
      // legacy startPlaybackUnified contract so downstream phase guards
      // (subtitle overlay, recovery checks, isActivePlaybackState) work.
      setPlaybackPhase('loading', 'start_requested');
      setIsPlaying(true);
      if (startPos > 0) {
        // Record the resume target so handleVideoLoadFast can apply it
        // authoritatively once the source is loaded. The eager seek below is
        // a no-op when onLoad hasn't fired yet (cold start) — without the
        // pending ref, a cold-start resume would begin at 0.
        pendingResumeSeekRef.current = startPos;
        if (videoRef.current) {
          const absolutePos = getAbsolutePlaybackPosition(video, startPos, duration);
          pendingSeekAbsoluteRef.current = absolutePos;
          videoRef.current.seek(absolutePos);
        }
      }
      const shim = playerRef.current as any;
      if (!shim) {
        console.warn('[Playback] startPlaybackFast: player shim missing at play()');
      }
      shim?.play?.();
      lastSentPlayingStateRef.current = true;
      lastPlayAssertAtRef.current = now;
      // Phase 7: advance to 'starting' after issuing play. handleVideoProgress
      // will promote us to 'stabilizing'/'playing' once real frames arrive.
      setPlaybackPhase('starting', 'fast_play_issued');
      logPlayback(playbackLogContext(), 'fast_start_issued', {
        startPosition: startPos,
        graceMs: FAST_STARTUP_SEEK_GRACE_MS,
      });
      // Single-shot stabilization nudge: if position hasn't budged after
      // the grace window, kick it forward 0.5s. Avoids the legacy
      // multi-timer cascade that contributed to the 5–10s perceived
      // startup delay.
      setTimeout(() => {
        if (!isMounted.current) return;
        if (!autoPlayIntentRef.current) return;
        if (startupStableConfirmedRef.current) return;
        if (latestPlaybackRef.current.position <= startPos + 0.1) {
          videoRef.current?.seek(startPos + 0.5);
          logPlayback(playbackLogContext(), 'fast_start_nudge', {
            from: startPos,
            to: startPos + 0.5,
          });
        }
        startupStableConfirmedRef.current = true;
      }, FAST_STARTUP_SEEK_GRACE_MS);
      return true;
    } catch (e) {
      console.error('[Playback] startPlaybackFast failed:', e);
      playbackStartInFlightRef.current = false;
      return false;
    }
  }, [playbackLogContext, validatedPlaybackUri, video, duration]);

  const handleVideoLoad = useCallback((data: any) => {
    const loadPerf = nowPerformanceMs();
    try {
      startupAnalyticsRef.current.loadedAt = Date.now();
      logVideoEvent(playbackLogContext(), "loaded", { duration: data.duration });
      logPlayback(playbackLogContext(), "handle_video_load_start", {
        duration: data.duration,
      });
      
      onLoadFiredRef.current = true;
      
      // Update shim
      const shim = playerRef.current as any;
      if (shim) {
        shim._setDuration?.(data.duration);
      }
      
      setDuration(data.duration);
      setSourceDuration(data.duration);
      capturePlaybackSnapshot(
        Number.isFinite(shim?.currentTime) ? shim.currentTime : latestPlaybackRef.current.absolutePosition,
        data.duration
      );
      // Source is ready; the next step is pending seek, then a single play().
      // Native isPlaying:true only promotes to stabilizing; progress confirms
      // stable playback later.
      if (playbackPhaseRef.current === "loading" || playbackPhaseRef.current === "idle") {
        setPlaybackPhase("starting", "source_loaded");
      }

      const applyPlay = () => {
        logPlayback(playbackLogContext(), "load_apply_play_state", {
          pendingPlayAfterLoad: pendingPlayAfterLoadRef.current,
          autoPlayIntent: autoPlayIntentRef.current,
          hasPlayer: Boolean(playerRef.current),
        });
        if (pendingPlayAfterLoadRef.current) {
          pendingPlayAfterLoadRef.current = false;
          if (!autoPlayIntentRef.current) {
            playbackStartInFlightRef.current = false;
            return;
          }
          if (playerRef.current) {
            try {
              lastSentPlayingStateRef.current = null;
              lastPlayAssertAtRef.current = Date.now();
              logPlayback(playbackLogContext(), "native_play_called", {
                path: "handleVideoLoad",
                elapsedMs: Number((nowPerformanceMs() - loadPerf).toFixed(1)),
              });
              playerRef.current.play();
              lastSentPlayingStateRef.current = true;
              setIsPlaying(true);
              setResumePrompt(null);
              hasStartedRef.current = true;
              playbackStartInFlightRef.current = false;
              armStartupWatchdog();
            } catch (e) {
              console.error('[Video] Deferred play after load failed:', e);
              failStartupPlayback(`deferred_play_failed: ${String(e)}`);
            }
          } else {
            failStartupPlayback('deferred_play_no_player');
          }
        }
      };

      const activeIntent = startupIntentRef.current;
      const intentMatches =
        activeIntent &&
        activeIntent.videoId === (videoId ?? null) &&
        activeIntent.generation === sourceGenerationRef.current;
      const requestedPosition = intentMatches
        ? activeIntent.requestedPosition
        : pendingResumeSeekRef.current ?? pendingStartupPositionRef.current ?? 0;
      const playableDuration = getPlayableDuration(video, data.duration);
      const resolvedPosition = resolveStartupSeekPosition({
        requestedPosition,
        duration: playableDuration,
      });
      if (intentMatches) {
        activeIntent.resolvedPosition = resolvedPosition;
        startupIntentRef.current = null;
      } else if (activeIntent) {
        logPlayback(playbackLogContext(), "startup_intent_ignored", {
          intentVideoId: activeIntent.videoId,
          intentGeneration: activeIntent.generation,
          currentVideoId: videoId ?? null,
          currentGeneration: sourceGenerationRef.current,
        });
      }
      const seekTo = getAbsolutePlaybackPosition(video, resolvedPosition, data.duration);
      pendingResumeSeekRef.current = null;
      pendingStartupPositionRef.current = resolvedPosition;

      try {
        setPlaybackPhase("seeking", "seek_started");
        videoRef.current?.seek(seekTo);
        const shim = playerRef.current as any;
        shim?._setCurrentTime?.(seekTo);
        capturePlaybackSnapshot(seekTo, data.duration);
        setPosition(resolvedPosition);
        setPlaybackPhase("starting", "seek_completed");
        logPlayback(playbackLogContext(), "startup_seek_applied", {
          requestedPosition: Number(requestedPosition.toFixed(2)),
          resolvedPosition: Number(resolvedPosition.toFixed(2)),
          duration: Number(playableDuration.toFixed(2)),
        });
      } catch (e) {
        console.warn('[Video] Resume seek on load failed', e);
        setPlaybackPhase("starting", "seek_completed");
      }
      applyPlay();
      logPlayback(playbackLogContext(), "handle_video_load_complete", {
        elapsedMs: Number((nowPerformanceMs() - loadPerf).toFixed(1)),
      });

      // Update audio tracks. Prefer the track the user last chose for this
      // video (persisted in the session) if it still exists, otherwise fall
      // back to the natively-selected track, then the first track.
      const nextAudioTracks = data.audioTracks ?? [];
      setAudioTracks(nextAudioTracks);
      const savedAudioIndex = videoId ? peekSessionState(videoId)?.audioTrackIndex ?? null : null;
      const savedAudioValid =
        savedAudioIndex !== null && nextAudioTracks.some((t: any) => t.index === savedAudioIndex);
      const selectedTrack = nextAudioTracks.find((track: any) => track.selected);
      setSelectedAudioTrackIndex(
        savedAudioValid
          ? savedAudioIndex
          : selectedTrack?.index ??
              (nextAudioTracks.length > 0 ? nextAudioTracks[0].index : null)
      );
      
      // Auto-detect video dimensions
      if (data.naturalSize) {
        const { width, height } = data.naturalSize;
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
          setVideoNaturalSize({ width, height });
          if (width > height) {
            setContentFitMode("cover");
          }
        }
      }
      
      // Update media duration if different
      if (videoId && data.duration > 0) {
        const playableDuration = getPlayableDuration(video, data.duration);
        if (Math.abs((video?.duration ?? 0) - playableDuration) > 1) {
          void updateMediaDuration(videoId, playableDuration);
        }
      }
    } catch (e) {
      console.error('[Video] Load handling failed:', e);
    }
  }, [armStartupWatchdog, capturePlaybackSnapshot, failStartupPlayback, playbackLogContext, setPlaybackPhase, video, videoId, updateMediaDuration]);

  // ── Phase 6: Fast Startup Path ──────────────────────────────────────────
  // Streamlined load handler that skips the legacy startup-intent
  // reconciliation, validation grace, and watchdog handoff. The Fast init
  // effect already issued the play() + seek before onLoad fires; this
  // handler just commits duration/audio tracks and confirms stability.
  const handleVideoLoadFast = useCallback((data: any) => {
    try {
      onLoadFiredRef.current = true;
      startupAnalyticsRef.current.loadedAt = Date.now();
      // Phase 7: pre-init onLoad detection. The Video component fires onLoad
      // the moment its `source` prop changes (videoId switch), which can
      // happen BEFORE the init effect runs startPlaybackFast — especially
      // for resume cases where the DB lookup is async. A pre-init onLoad
      // commits duration/audioTracks (those are always correct) but skips
      // the play/seek-after-load consumer and the stable-transition timer.
      const preInitLoad =
        fastStartIssuedForVideoIdRef.current !== (videoId ?? null);

      if (Number.isFinite(data?.duration)) {
        setDuration(data.duration);
        setSourceDuration(data.duration);
        if (video?.id && Number(video.duration ?? 0) <= 0) {
          updateMediaDuration(video.id, data.duration);
        }
      }
      if (Array.isArray(data?.audioTracks) && data.audioTracks.length > 0) {
        setAudioTracks(data.audioTracks);
      }
      logPlayback(playbackLogContext(), 'fast_load_committed', {
        duration: data?.duration,
        audioTrackCount: Array.isArray(data?.audioTracks) ? data.audioTracks.length : 0,
        preInitLoad,
      });

      // Authoritative resume seek for the Fast path. Now that the source is
      // loaded, apply any pending resume position the eager seek in
      // startPlaybackFast may have missed (cold start where onLoad fires after
      // init). Runs before the pre-init return so it covers both orderings;
      // it's a harmless no-op when no resume seek is pending.
      if (
        pendingResumeSeekRef.current !== null &&
        pendingResumeSeekRef.current > 0 &&
        Number.isFinite(data?.duration)
      ) {
        const pending = pendingResumeSeekRef.current;
        const absolute = getAbsolutePlaybackPosition(video, pending, data.duration);
        videoRef.current?.seek(absolute);
        const shim = playerRef.current as any;
        shim?._setCurrentTime?.(absolute);
        capturePlaybackSnapshot(absolute, data.duration);
        setPosition(pending);
        pendingSeekAbsoluteRef.current = absolute;
        pendingResumeSeekRef.current = null;
        logPlayback(playbackLogContext(), 'fast_resume_seek_applied', {
          requestedPosition: Number(pending.toFixed(2)),
          absolute: Number(absolute.toFixed(2)),
        });
      }

      if (preInitLoad) {
        // Don't drive the phase machine yet — the init effect will fire
        // startPlaybackFast shortly and that's the canonical entry.
        return;
      }

      // Phase 7: drive phase machine. If we're still at loading/idle (the
      // expected case after startPlaybackFast transitioned to 'loading'),
      // step forward to 'starting'. The pendingPlayAfterLoadRef path is
      // legacy — kept for the deferred-play handoff but generally unused
      // by the Fast path.
      if (
        playbackPhaseRef.current === 'loading' ||
        playbackPhaseRef.current === 'idle'
      ) {
        setPlaybackPhase('starting', 'fast_source_loaded');
      }
      if (pendingPlayAfterLoadRef.current && autoPlayIntentRef.current) {
        pendingPlayAfterLoadRef.current = false;
        const shim = playerRef.current as any;
        shim?.play?.();
      }
      // 500 ms after onLoad we declare startup stable. If we're still in
      // starting/stabilizing, promote to playing — handleVideoProgress will
      // typically beat us to it on a healthy video, but this guards the
      // case where progress is silent for the full grace.
      setTimeout(() => {
        if (!isMounted.current) return;
        if (!startupStableConfirmedRef.current) {
          startupStableConfirmedRef.current = true;
          const phase = playbackPhaseRef.current;
          if (phase === 'starting' || phase === 'stabilizing') {
            setPlaybackPhase('playing', 'fast_startup_stable');
          }
          logPlayback(playbackLogContext(), 'fast_startup_stable');
        }
      }, 500);
    } catch (e) {
      console.error('[Video] Fast load handling failed:', e);
    }
  }, [capturePlaybackSnapshot, playbackLogContext, updateMediaDuration, video, videoId]);

  const handleVideoProgress = useCallback((data: any) => {
    try {
      if (!onProgressFiredRef.current) {
        onProgressFiredRef.current = true;
        startupAnalyticsRef.current.firstProgressAt = Date.now();
        const elapsedMs = loadStartPerformanceRef.current === null
          ? null
          : Number((nowPerformanceMs() - loadStartPerformanceRef.current).toFixed(1));
        logPlayback(playbackLogContext(), "first_progress", { currentTime: data.currentTime, elapsedMs });
      }
      
      // Update shim with minimal overhead
      const shim = playerRef.current as any;
      if (shim) {
        shim._setCurrentTime?.(data.currentTime);
        shim._setDuration?.(data.seekableDuration);
      }

      // Push playback time into the subtitle overlay via imperative ref —
      // avoids re-rendering the overlay on every 500ms tick. Skip entirely when
      // there are no subtitles to show (enabled track or an active generation
      // job) so the overlay's per-tick binary search doesn't run for nothing.
      {
        const subState = usePlayerStore.getState();
        const subtitleJobActive =
          !!subState.subtitleJob &&
          subState.subtitleJob.status !== 'complete' &&
          subState.subtitleJob.status !== 'cancelled' &&
          subState.subtitleJob.status !== 'error';
        if (subState.subtitlesEnabled || subtitleJobActive) {
          subtitleOverlayRef.current?.setTime(data.currentTime);
        }
      }
      
      // Clear pending seek if reached
      if (pendingSeekAbsoluteRef.current !== null && 
          Math.abs(data.currentTime - pendingSeekAbsoluteRef.current) < 0.75) {
        pendingSeekAbsoluteRef.current = null;
      }

      // Update displayed position (drives seekbar & time labels)
      const effectiveDuration = data.seekableDuration || duration;
      const relativeTime = getRelativePlaybackPosition(video, data.currentTime, effectiveDuration);
      const playableDur = getPlayableDuration(video, effectiveDuration);
      latestPlaybackRef.current = {
        absolutePosition: Number.isFinite(data.currentTime) ? data.currentTime : latestPlaybackRef.current.absolutePosition,
        position: relativeTime,
        duration: playableDur,
        sourceDuration: effectiveDuration,
      };
      if (!isScrubbingRef.current) {
        setPosition(relativeTime);
      }

      // Progress is the AUTHORITATIVE "playing" signal. If currentTime
      // has advanced by ≥ PROGRESS_ADVANCE_SECONDS, the player is
      // demonstrably playing — refresh the health timestamps and
      // promote the phase out of startup states.
      if (Number.isFinite(data.currentTime) && data.currentTime > lastProgressPosRef.current + PROGRESS_ADVANCE_SECONDS) {
        const now = Date.now();
        lastProgressPosRef.current = data.currentTime;
        lastProgressAtRef.current = now;
        // Do NOT touch lastNativeAckPlayingAtRef here. That ref must only be
        // written by genuine native-side events (handleNativePlaybackStateChanged
        // when ExoPlayer reports isPlaying:true, and onBandwidthUpdate). Writing
        // it from onProgress conflates the two signals — both refs end up with
        // identical timestamps on every progress tick, which makes every
        // "is native fresh vs is JS progress fresh" comparison vacuously true
        // and defeats the dual-signal liveness gate. Confirmed via live dogfood
        // logs: every stall_candidate showed lastProgressAgeMs == lastNativeAckAgeMs
        // byte-for-byte until this line was removed.
        lastHealthyAtRef.current = now;
        resetRecoveryAttempts();
        const recoveredByProgress =
          lastRecoveryClassRef.current !== "unknown" || lastRecoveryActionRef.current !== null;
        const recoveryReasonForLog = lastRecoveryClassRef.current;
        const startupStillUnstable =
          isStartupRecoveryPhase(playbackPhaseRef.current) &&
          !startupStableConfirmedRef.current;
        const preserveSurfaceLossMemory =
          startupStillUnstable && recoveryReasonForLog === "surface_lost";
        if (!preserveSurfaceLossMemory) {
          const startupStillUnstable =
            isStartupRecoveryPhase(playbackPhaseRef.current) &&
            !startupStableConfirmedRef.current;
          const preserveSurfaceLossMemory =
            startupStillUnstable && recoveryReasonForLog === "surface_lost";
          if (!preserveSurfaceLossMemory) {
            lastRecoveryClassRef.current = "unknown";
            lastRecoveryActionRef.current = null;
            consecutiveSurfaceLostRef.current = 0;
          }
        }
        // Phase 7: real progress means recovery worked — reset the Fast-path
        // attempt counter so the next stall starts fresh and doesn't
        // immediately escalate to remount from a stale window.
        fastRecoveryAttemptCountRef.current = 0;
        fastRecoveryWindowStartRef.current = 0;
        if (recoveredByProgress) {
          logRecovery(playbackLogContext(), "recovery_progress_resumed", {
            ...getRecoveryLogFields("progress_resumed", {
              failureReason: recoveryReasonForLog,
              startupPath: isStartupRecoveryPhase(playbackPhaseRef.current),
            }),
          });
        }
        // Phase 8: warm the session cache for the next & previous videos
        // exactly once per video session. Pays the DB roundtrip during slack
        // time so the inevitable next-button press is instant. Uses the
        // identity-stable nextVideo/previousVideo from playbackQueueState
        // (memoized on video?.id by Phase 8 Step 8).
        if (prefetchedForVideoIdRef.current !== videoId && videoId) {
          prefetchedForVideoIdRef.current = videoId;
          prefetchSessions([nextVideo?.id, previousVideo?.id]);
        }

        const phase = playbackPhaseRef.current;
        if (startupStableConfirmedRef.current && (phase === "recovering" || phase === "buffering")) {
          setPlaybackPhase("playing", "progress_recovered");
          logRecovery(playbackLogContext(), "recovered", getRecoveryLogFields("progress_recovered"));
        } else if (phase === "starting" || phase === "loading") {
          stabilizationStartedAtRef.current = stabilizationStartedAtRef.current || now;
          stabilizationStartPositionRef.current = data.currentTime;
          startupAnalyticsRef.current.stabilizationStartedAt =
            startupAnalyticsRef.current.stabilizationStartedAt || now;
          setPlaybackPhase("stabilizing", "progress_advanced");
        } else if (phase === "stabilizing") {
          if (shouldConfirmStartupStable({
            currentTime: data.currentTime,
            stabilizationStartPosition: stabilizationStartPositionRef.current,
            stabilizationStartedAt: stabilizationStartedAtRef.current || now,
            now,
          })) {
            setPlaybackPhase("playing", "startup_stable");
            confirmStartupPlayback();
          }
        } else if (phase === "buffering") {
          if (startupStableConfirmedRef.current) {
            setPlaybackPhase("playing", "progress_advanced");
          } else {
            stabilizationStartedAtRef.current = stabilizationStartedAtRef.current || now;
            stabilizationStartPositionRef.current = stabilizationStartPositionRef.current || data.currentTime;
            setPlaybackPhase("stabilizing", "progress_advanced");
          }
        }
      }
      
      // Show ending overlay (last 5 seconds)
      const remaining = playableDur - relativeTime;
      
      if (nextVideo && remaining > 0 && remaining <= 5 && !showEndingOverlay) {
        setShowEndingOverlay(true);
      } else if (showEndingOverlay && (remaining > 5 || !nextVideo)) {
        setShowEndingOverlay(false);
      }

    } catch (e) {
      console.error('[Video] Progress handling failed:', e);
    }
  }, [confirmStartupPlayback, duration, getRecoveryLogFields, nextVideo, previousVideo, playbackLogContext, resetRecoveryAttempts, setPlaybackPhase, showEndingOverlay, video, videoId]);

  // ── Centralized stop helper ──────────────────────────────────────────────
  // Every code path that stops playback MUST call this so we get a single
  // [PlaybackStop] log line with the reason, position, and duration.
  const saveProgressOnStop = useCallback((reason: string) => {
    const snapshot = capturePlaybackSnapshot();
    const pos = snapshot.position;
    const dur = snapshot.duration;
    lastStopReasonRef.current = reason;
    // Phase 8: log the stop reason regardless — telemetry should always
    // see the navigation event. The guard below only affects the DB write.
    // Persisting position=0 from a rapid skip would overwrite any
    // legitimate prior saved position for that video, so we skip the
    // write whenever:
    //   - Position is sub-second (decoder barely started decoding), AND
    //   - Startup has not yet been confirmed stable (still in starting/
    //     stabilizing phase from the Fast path's POV)
    // Past the "stable" gate or past position 2s, the user has watched
    // enough that the position is a meaningful save target.
    const tooEarlyToSave =
      pos < 2 && !startupStableConfirmedRef.current;
    logPlaybackStop(playbackLogContext(), reason, {
      position: Number(pos.toFixed(1)),
      duration: Number(dur.toFixed(1)),
      title: video?.title ?? null,
      tooEarlyToSave,
    });
    // Immediately persist progress so we never lose the last position.
    // Collect the write promises so callers that navigate away can flush
    // them before the screen unmounts (see flushable return below).
    const writes: Promise<unknown>[] = [];
    if (settings.rememberPosition && videoId && pos > 0 && !tooEarlyToSave) {
      lastSavedPosition.current = pos;
      writes.push(Promise.resolve(updateLastPosition(videoId, pos, dur)));
      // Phase 8: also write to the new VideoSessions table + denormalize
      // into Videos.progress_*. Both writes are serialized through the
      // single DB connection's enqueue, so they cannot race. Flush any
      // pending throttled patches first so a half-applied zoom/brightness
      // patch can't overwrite the freshly-saved position.
      writes.push(
        flushSessionPatches().then(() =>
          saveSessionState({
            videoId,
            position: pos,
            duration: dur,
            completed: dur > 0 && pos >= dur - 1,
          }),
        ),
      );
    }

    // Show a HUD notification for unexpected stops
    const normalReasons = [
      'user_pause', 
      'video_switch_reset', 
      'sleep_timer_expired', 
      'navigate_to_next_video', 
      'navigate_to_prev_video', 
      'remote_pause_headset_or_notification', 
      'app_backgrounded_no_bg_play', 
      'video_completed_naturally'
    ];
    
    if (!normalReasons.some(nr => reason.startsWith(nr))) {
      let displayReason = "Playback stopped";
      if (reason.startsWith('playback_error')) displayReason = "Playback error";
      else if (reason === 'audio_focus_stolen') displayReason = "Audio focus lost";
      else if (reason === 'player_shim_teardown') displayReason = "Player crashed";
      else if (reason.startsWith('polling_end_detected')) displayReason = "Unexpected end of stream";
      
      showHud("seek", displayReason, 0);
    }

    // Resolves once both DB writes settle. Callers that immediately navigate
    // away (close, polling-end) await this (with a timeout race) so the writes
    // aren't dropped when the screen unmounts. Fire-and-forget callers ignore it.
    return Promise.all(writes);
  }, [capturePlaybackSnapshot, playbackLogContext, video, videoId, settings.rememberPosition, updateLastPosition, showHud]);

  // Flush the stop-time save before navigating away. Races the DB writes
  // against a short timeout so a hung/slow write can never block navigation.
  const saveProgressThenLeave = useCallback(
    (reason: string, leave: () => void) => {
      let left = false;
      const go = () => {
        if (left) return;
        left = true;
        leave();
      };
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 400));
      void Promise.race([saveProgressOnStop(reason), timeout]).finally(go);
    },
    [saveProgressOnStop],
  );

  // ─── Recovery ladder ─────────────────────────────────────────────────
  // Three-level escalation that replaces the old "force play, then declare
  // fatal" path. Coordinates with the stall detector and transient-stop
  // branch so they don't race. Levels:
  //   L1 — re-assert play() intent (cheapest, fixes most decoder hiccups)
  //   L2 — seek-nudge (small forward seek to kick decoder pipeline)
  //   L3 — flip paused twice; if still no progress, bump remount key
  // Fatal only after L3 remount also fails to advance position.
  // No-op kept for back-compat with the rest of the file. The previous
  // ladder timers (recoveryL2/L3, transientStopGrace, postResumeKick) are
  // gone — the new model uses lastRecoveryAtRef as a cooldown gate.
  const clearRecoveryTimers = useCallback(() => {
    // intentionally empty
  }, []);

  // ─── Single-source-of-truth health predicate ────────────────────────
  // Replaces the old "isPlaying boolean drives everything" model. The
  // player is considered healthy if ANY signal indicates progress,
  // buffering, recent native ack, recent recovery kick, or startup grace.
  // A single onPlaybackStateChanged{isPlaying:false} callback is NEVER
  // enough to declare a stall.
  const isPlaybackHealthy = useCallback((): boolean => {
    const snapshot = buildPlaybackHealthSnapshot();
    const healthy = evaluatePlaybackHealth(snapshot);
    if (healthy) {
      lastHealthyAtRef.current = snapshot.now;
    }
    return healthy;
    /*
    const now = Date.now();
    // Startup grace — be patient with ExoPlayer's spin-up.
    if (
      playbackStartTsRef.current > 0 &&
      now - playbackStartTsRef.current < STARTUP_GRACE_MS
    ) {
      lastHealthyAtRef.current = now;
      return true;
    }
    // Progress observed recently — the authoritative "playing" signal.
    if (now - lastProgressAtRef.current < 2500) {
      lastHealthyAtRef.current = now;
      return true;
    }
    // Buffering is a normal state, not a stall.
    if (isBuffering) {
      lastHealthyAtRef.current = now;
      return true;
    }
    // Recently kicked recovery — give it time to take effect.
    if (now - lastRecoveryAtRef.current < RECOVERY_COOLDOWN_MS) {
      lastHealthyAtRef.current = now;
      return true;
    }
    // Native recently acked playing.
    if (now - lastNativeAckPlayingAtRef.current < 3000) {
      lastHealthyAtRef.current = now;
      return true;
    }
    return false;
    */
  }, [isBuffering]);

  // ── Phase 6: Fast Startup Path ──────────────────────────────────────
  // Lightweight health predicate paired with the Fast init/load path. Uses
  // the same refs as isPlaybackHealthy but with a flat, inline structure
  // (no helper function call) for predictable timing inside the high-
  // frequency polling loop. The dual-signal liveness branch is now
  // meaningful thanks to the line-1340 conflation fix.
  const isPlaybackHealthyFast = useCallback((): boolean => {
    const now = Date.now();
    // Recent JS progress → authoritative healthy signal.
    if (lastProgressAtRef.current > 0 && now - lastProgressAtRef.current < 2000) {
      lastHealthyAtRef.current = now;
      return true;
    }
    // Inside startup grace → don't trigger recovery yet.
    if (
      playbackStartTsRef.current > 0 &&
      now - playbackStartTsRef.current < STARTUP_GRACE_MS
    ) {
      lastHealthyAtRef.current = now;
      return true;
    }
    // Active buffering — expected wait, not a stall.
    if (isBuffering) {
      lastHealthyAtRef.current = now;
      return true;
    }
    // Recent recovery kick — wait for it to take effect.
    if (
      lastRecoveryAtRef.current > 0 &&
      now - lastRecoveryAtRef.current < RECOVERY_COOLDOWN_MS
    ) {
      lastHealthyAtRef.current = now;
      return true;
    }
    // Dual-signal liveness (independent from progress after the line-1340
    // fix). If a native event landed within 2s the decoder is provably
    // alive even when JS progress is silent — classify as healthy and
    // suppress the (likely false-positive) stall trigger.
    if (
      lastNativeAckPlayingAtRef.current > 0 &&
      now - lastNativeAckPlayingAtRef.current < 2000
    ) {
      lastHealthyAtRef.current = now;
      return true;
    }
    return false;
  }, [isBuffering]);

  // Phase 7 — play-reassert only. Removes the Phase 6 nudge-seek inner
  // timer: it was advancing position via seek() without actually invoking
  // the decoder for real frame production, creating a tight loop where
  // the stall detector saw fake "progress" and kept firing. The Fast path
  // now caps consecutive recoveries: 4 reasserts in a 10s window without
  // real progress escalates to a full Video remount via recoveryRemountKey.
  const simpleRecovery = useCallback(() => {
    if (!playerRef.current) return;
    if (!autoPlayIntentRef.current) return;
    const now = Date.now();
    if (now - lastRecoveryAtRef.current < RECOVERY_COOLDOWN_MS) return;
    lastRecoveryAtRef.current = now;

    // Rolling 10s attempt window. Outside the window → reset counter.
    const windowMs = 10_000;
    if (now - fastRecoveryWindowStartRef.current > windowMs) {
      fastRecoveryWindowStartRef.current = now;
      fastRecoveryAttemptCountRef.current = 0;
    }
    fastRecoveryAttemptCountRef.current += 1;

    if (fastRecoveryAttemptCountRef.current >= 4) {
      // Tier-4 equivalent: full Video remount. This is the escape hatch
      // when play() reassert hasn't unstuck the decoder.
      logRecovery(playbackLogContext(), 'fast_recovery_escalate_remount', {
        attemptsInWindow: fastRecoveryAttemptCountRef.current,
        position: latestPlaybackRef.current.position,
      });
      fastRecoveryAttemptCountRef.current = 0;
      fastRecoveryWindowStartRef.current = 0;
      setRecoveryRemountKey((k) => k + 1);
      return;
    }

    try {
      const shim = playerRef.current as any;
      shim?.play?.();
      logRecovery(playbackLogContext(), 'fast_recovery_play_reassert', {
        position: latestPlaybackRef.current.position,
        attempt: fastRecoveryAttemptCountRef.current,
      });
    } catch {
      // never let recovery throw — the player must keep running
    }
  }, [playbackLogContext]);

  // ─── Single recovery action ─────────────────────────────────────────
  // Replaces the L1→L2→L3 ladder. Re-asserts play(); only seek-nudges
  // AFTER stable playback existed (out of startup grace). Cooldown-gated
  // so it can't fire faster than PLAY_ASSERT_COOLDOWN_MS / RECOVERY_COOLDOWN_MS.
  const performClassifiedRecovery = useCallback((failureReason: PlaybackFailureReason) => {
    if (!playerRef.current) return;
    if (!autoPlayIntentRef.current) return;
    if (exitingPlayerRef.current || audioHandoffInProgressRef.current) return;

    const phase = playbackPhaseRef.current;
    const startupPath = isStartupRecoveryPhase(phase);
    const now = Date.now();

    if (failureReason === "js_starvation") {
      logRecovery(playbackLogContext(), "stall_classified_js_starvation", {
        ...getRecoveryLogFields("js_starvation", {
          failureReason,
          startupPath,
        }),
      });
      return;
    }

    if (
      failureReason === "expected_pause" ||
      failureReason === "buffering" ||
      failureReason === "audio_focus_loss"
    ) {
      return;
    }

    if (failureReason === "surface_lost") {
      const repeatedSurfaceLoss =
        lastRecoveryClassRef.current === "surface_lost" &&
        now - lastRecoveryAtRef.current <= SURFACE_LOST_WINDOW_MS;
      consecutiveSurfaceLostRef.current = repeatedSurfaceLoss
        ? consecutiveSurfaceLostRef.current + 1
        : 1;
    } else {
      consecutiveSurfaceLostRef.current = 0;
    }

    if (startupPath) {
      logRecovery(playbackLogContext(), "startup_stall_classified", {
        ...getRecoveryLogFields("startup_classified", {
          failureReason,
          startupPath: true,
        }),
      });
      if (shouldRunStartupRecovery({
        state: phase === "recovering" ? "stabilizing" : phase,
        failureReason,
        recoveryCount: startupRecoveryCountRef.current,
        maxRecoveryCount: 4,
      })) {
        runStartupRecoveryRef.current?.(failureReason);
      }
      return;
    }

    if (now - lastRecoveryAtRef.current < RECOVERY_COOLDOWN_MS) {
      logRecovery(playbackLogContext(), "recovery_reentered_stall", {
        ...getRecoveryLogFields("cooldown_blocked", {
          failureReason,
          startupPath: false,
        }),
      });
      return;
    }

    const previousClass = lastRecoveryClassRef.current;
    const previousAction = lastRecoveryActionRef.current;
    let action: RecoveryAction = "play_reassert";

    if (failureReason === "surface_lost") {
      action =
        consecutiveSurfaceLostRef.current > 1 || previousClass === "surface_lost"
          ? "video_remount"
          : "play_reassert";
    } else if (failureReason === "decoder_stall") {
      if (previousClass === "decoder_stall" && previousAction === "play_reassert") {
        action = "seek_nudge";
      } else if (previousClass === "decoder_stall" && previousAction === "seek_nudge") {
        action = "video_remount";
      }
    }

    recoveryAttemptsRef.current += 1;
    lastRecoveryAtRef.current = now;
    lastRecoveryClassRef.current = failureReason;
    lastRecoveryActionRef.current = action;

    if (action === "video_remount") {
      requestRecoveryRemount(failureReason);
      return;
    }

    setPlaybackPhase("recovering", "recovery_started");

    if (action === "play_reassert") {
      lastPlayAssertAtRef.current = now;
      try {
        lastSentPlayingStateRef.current = null;
        autoPlayIntentRef.current = true;
        playerRef.current.play();
        lastSentPlayingStateRef.current = true;
        setIsPlaying(true);
        logRecovery(playbackLogContext(), "recovery_started", {
          ...getRecoveryLogFields("play_reassert", {
            failureReason,
            recoveryAction: action,
            startupPath: false,
          }),
          tier: 1,
        });
      } catch (error) {
        logRecovery(playbackLogContext(), "recovery_failed", {
          ...getRecoveryLogFields("play_reassert_failed", {
            failureReason,
            recoveryAction: action,
            startupPath: false,
          }),
          error: String(error),
        });
      }
      return;
    }

    const seekPosition = Math.max(latestPlaybackRef.current.absolutePosition + 0.1, 0);
    try {
      pendingSeekAbsoluteRef.current = seekPosition;
      videoRef.current?.seek(seekPosition);
      logRecovery(playbackLogContext(), "recovery_started", {
        ...getRecoveryLogFields("seek_nudge", {
          failureReason,
          recoveryAction: action,
          startupPath: false,
        }),
        tier: 2,
        position: Number(seekPosition.toFixed(2)),
      });
    } catch (error) {
      logRecovery(playbackLogContext(), "recovery_failed", {
        ...getRecoveryLogFields("seek_nudge_failed", {
          failureReason,
          recoveryAction: action,
          startupPath: false,
        }),
        error: String(error),
      });
    }
  }, [getRecoveryLogFields, isStartupRecoveryPhase, playbackLogContext, requestRecoveryRemount, setPlaybackPhase]);

  const escalateRecovery = useCallback((source: "stall" | "native_stop") => {
    if (!playerRef.current) return;
    if (exitingPlayerRef.current || audioHandoffInProgressRef.current) return;
    if (playbackPhaseRef.current === "paused" || playbackPhaseRef.current === "ended") return;

    const now = Date.now();
    const inStartup =
      playbackStartTsRef.current > 0 &&
      now - playbackStartTsRef.current < STARTUP_GRACE_MS;

    if (now - lastPlayAssertAtRef.current < PLAY_ASSERT_COOLDOWN_MS) return;
    if (recoveryAttemptsGenerationRef.current !== sourceGenerationRef.current) {
      resetRecoveryAttempts(sourceGenerationRef.current);
    }
    recoveryAttemptsRef.current += 1;
    if (recoveryAttemptsRef.current > 5) {
      logRecovery(playbackLogContext(), "stall_candidate", {
        ...getRecoveryLogFields("max_recovery_attempts"),
        recoveryCount: recoveryAttemptsRef.current,
      });
      runStartupRecoveryRef.current?.("decoder_stall");
      return;
    }
    lastPlayAssertAtRef.current = now;
    lastRecoveryAtRef.current = now;
    setPlaybackPhase("recovering", "recovery_started");

    logRecovery(playbackLogContext(), "recovery_started", {
      ...getRecoveryLogFields(source),
      inStartup,
      tier: 1,
      action: getRecoveryTierLabel(1),
    });

    // Soft resume — re-assert play(). Always safe.
    try {
      lastSentPlayingStateRef.current = null;
      autoPlayIntentRef.current = true;
      playerRef.current.play();
      lastSentPlayingStateRef.current = true;
      setIsPlaying(true);
    } catch (e) {
      console.warn("[Recovery] play() threw", e);
    }

    const recoveryVideoId = videoId;
    const recoveryStartPosition = latestPlaybackRef.current.position;
    const recoveryGeneration = sourceGenerationRef.current;

    if (inStartup) {
      // Don't seek-nudge during startup; ExoPlayer is still stabilizing.
      return;
    }

    // Past startup — if the soft resume doesn't take, follow up with a
    // small seek-nudge to flush the decoder pipeline.
    setTimeout(() => {
      if (!isMounted.current) return;
      if (!isCurrentGeneration(recoveryGeneration)) return;
      if (recoveryVideoId !== videoId) return;
      if (latestPlaybackRef.current.position > recoveryStartPosition + 0.2) return;
      if (isPlaybackHealthy()) return;
      const pos = latestPlaybackRef.current.absolutePosition;
      logRecovery(playbackLogContext(), "recovery_tier", { tier: 2, action: getRecoveryTierLabel(2), position: Number(pos.toFixed(2)) });
      try {
        videoRef.current?.seek(Math.max(pos + 0.1, 0));
      } catch (e) {
        console.warn("[Recovery] seek threw", e);
      }
    }, 2000);
  }, [getRecoveryLogFields, isCurrentGeneration, isPlaybackHealthy, playbackLogContext, resetRecoveryAttempts, setPlaybackPhase, videoId]);

  const runStartupRecovery = useCallback((failureReason: PlaybackFailureReason) => {
    if (!playerRef.current) return;
    if (exitingPlayerRef.current || audioHandoffInProgressRef.current) return;
    if (playbackPhaseRef.current === "paused" || playbackPhaseRef.current === "ended") return;

    const now = Date.now();
    if (now - lastRecoveryAtRef.current < RECOVERY_COOLDOWN_MS) return;

    let tier = nextStartupRecoveryTier(startupRecoveryCountRef.current);
    // Only escalate surface_lost to source_reload/remount when the surface
    // had actually attached this session (a true loss). If it never attached
    // yet, treat this as ordinary startup warm-up and cap at the default tier
    // (play_reassert) so we never remount → loadStart → surface_lost loop.
    const hadSurface = lastReadyTimestampRef.current > 0;
    if (failureReason === "surface_lost" && hadSurface) {
      if (consecutiveSurfaceLostRef.current >= 3) {
        tier = 4;
      } else if (consecutiveSurfaceLostRef.current >= 2) {
        tier = Math.max(tier, 3) as 3 | 4;
      } else if (
        lastRecoveryActionRef.current === "play_reassert" &&
        lastSuccessfulNativeAckRecoveryAtRef.current > 0 &&
        now - lastSuccessfulNativeAckRecoveryAtRef.current <= SURFACE_LOST_WINDOW_MS
      ) {
        tier = Math.max(tier, 2) as 2 | 3 | 4;
      }
    }
    startupRecoveryCountRef.current += 1;
    startupAnalyticsRef.current.recoveryCount = startupRecoveryCountRef.current;
    lastRecoveryAtRef.current = now;
    lastPlayAssertAtRef.current = now;
    const recoveryGeneration = sourceGenerationRef.current;
    const action = getStartupRecoveryTierLabel(tier);
    lastRecoveryClassRef.current = failureReason;
    lastRecoveryActionRef.current = action;

    logRecovery(playbackLogContext(), "startup_recovery", {
      ...getRecoveryLogFields("startup_recovery", {
        failureReason,
        recoveryAction: action,
        startupPath: true,
      }),
      tier,
      action,
      attempt: startupAttemptRef.current,
      position: Number(latestPlaybackRef.current.position.toFixed(2)),
    });

    if (tier === 1) setPlaybackPhase("recovering", "recovery_tier_1");
    else if (tier === 2) setPlaybackPhase("recovering", "recovery_tier_2");
    else if (tier === 3) setPlaybackPhase("recovering", "recovery_tier_3");
    else setPlaybackPhase("recovering", "recovery_tier_4");

    const reassertPlay = () => {
      if (!playerRef.current) return;
      lastSentPlayingStateRef.current = null;
      autoPlayIntentRef.current = true;
      playerRef.current.play();
      lastSentPlayingStateRef.current = true;
      setIsPlaying(true);
    };

    try {
      if (tier === 1) {
        reassertPlay();
        setPlaybackPhase("starting", "startup_unstable");
        return;
      }

      if (tier === 2) {
        const position = Math.max(latestPlaybackRef.current.absolutePosition + 0.1, 0);
        setPlaybackPhase("seeking", "seek_started");
        videoRef.current?.seek(position);
        capturePlaybackSnapshot(position);
        pendingSeekAbsoluteRef.current = position;
        setPlaybackPhase("starting", "seek_completed");
        reassertPlay();
        return;
      }

      if (tier === 3) {
        const uri = validatedPlaybackUriRef.current ?? validatedPlaybackUri;
        if (!uri) {
          reassertPlay();
          setPlaybackPhase("starting", "startup_unstable");
          return;
        }
        const nextGeneration = recoveryGeneration + 1;
        sourceGenerationRef.current = nextGeneration;
        resetRecoveryAttempts(nextGeneration);
        playbackSessionIdRef.current = createPlaybackSessionId(videoId, nextGeneration);
        onLoadFiredRef.current = false;
        onReadyForDisplayFiredRef.current = false;
        onProgressFiredRef.current = false;
        pendingPlayAfterLoadRef.current = true;
        setIsPlaying(false);
        setPlaybackPhase("loading", "recovery_tier_3");
        setValidatedPlaybackUri(null);
        setTimeout(() => {
          if (!isMounted.current) return;
          if (sourceGenerationRef.current !== nextGeneration) return;
          setValidatedPlaybackUri(uri);
        }, 0);
        return;
      }

      const nextGeneration = recoveryGeneration + 1;
      sourceGenerationRef.current = nextGeneration;
      resetRecoveryAttempts(nextGeneration);
      playbackSessionIdRef.current = createPlaybackSessionId(videoId, nextGeneration);
      onLoadFiredRef.current = false;
      onReadyForDisplayFiredRef.current = false;
      onProgressFiredRef.current = false;
      pendingPlayAfterLoadRef.current = true;
      setIsPlaying(false);
      setPlaybackPhase("loading", "recovery_tier_4");
      requestRecoveryRemount(failureReason);
    } catch (error) {
      logRecovery(playbackLogContext(), "startup_recovery_failed", {
        ...getRecoveryLogFields("startup_recovery_failed", {
          failureReason,
          recoveryAction: action,
          startupPath: true,
        }),
        tier,
        action,
        error: String(error),
      });
    }
  }, [capturePlaybackSnapshot, getRecoveryLogFields, playbackLogContext, requestRecoveryRemount, resetRecoveryAttempts, setPlaybackPhase, validatedPlaybackUri, videoId]);

  runStartupRecoveryRef.current = runStartupRecovery;

  // Native-state callback is now telemetry-only on `false`. The new
  // model uses progress as the primary "playing" signal; a single
  // isPlaying:false is normal during decoder warm-up / surface attach /
  // audio focus blip and must NOT trigger recovery.
  const handleNativePlaybackStateChanged = useCallback((event: any) => {
    logNativeState(playbackLogContext(), "playback_state_changed", {
      isPlaying: event?.isPlaying,
      currentTime: latestPlaybackRef.current.position,
      duration: duration || latestPlaybackRef.current.duration,
    });

    if (typeof event?.isPlaying !== "boolean") return;
    const nativeIsPlaying = Boolean(event?.isPlaying);
    const shim = playerRef.current as any;
    isNativePlayingRef.current = nativeIsPlaying;

    if (nativeIsPlaying) {
      shim?._setPlaying?.(true);
      const now = Date.now();
      if (startupFalseReassertTimerRef.current) {
        clearTimeout(startupFalseReassertTimerRef.current);
        startupFalseReassertTimerRef.current = null;
      }
      startupAnalyticsRef.current.nativePlayingAckAt = now;
      lastNativeAckPlayingAtRef.current = now;
      lastSuccessfulNativeAckRecoveryAtRef.current = now;
      if (Number.isFinite(latestPlaybackRef.current.absolutePosition)) {
        lastProgressPosRef.current = Math.max(
          lastProgressPosRef.current,
          latestPlaybackRef.current.absolutePosition
        );
        lastProgressAtRef.current = now;
      }
      lastHealthyAtRef.current = now;
      if (lastRecoveryActionRef.current !== null) {
        logRecovery(playbackLogContext(), "recovery_native_ack_resumed", {
          ...getRecoveryLogFields("native_ack_resumed", {
            failureReason: lastRecoveryClassRef.current,
            recoveryAction: lastRecoveryActionRef.current,
            startupPath: isStartupRecoveryPhase(playbackPhaseRef.current),
          }),
        });
      }
      const phase = playbackPhaseRef.current;
      if (startupStableConfirmedRef.current && (phase === "recovering" || phase === "buffering")) {
        setPlaybackPhase("playing", "native_recovered");
        logRecovery(playbackLogContext(), "recovered", getRecoveryLogFields("native_recovered"));
      } else if (phase === "starting" || phase === "loading" || phase === "recovering" || phase === "buffering") {
        stabilizationStartedAtRef.current = now;
        stabilizationStartPositionRef.current = latestPlaybackRef.current.absolutePosition;
        startupAnalyticsRef.current.stabilizationStartedAt = now;
        setPlaybackPhase("stabilizing", "native_started_stabilizing");
      }
      return;
    }

    // Native says false — telemetry only. The polling-loop health check
    // is the single authority for declaring a real stall.
    const failureReason = classifyPlaybackFailure(buildPlaybackHealthSnapshot());
    lastNativeFalseReasonRef.current = failureReason;
    const preserveIntent =
      autoPlayIntentRef.current &&
      AppState.currentState === "active" &&
      (
        playbackPhaseRef.current === "starting" ||
        playbackPhaseRef.current === "stabilizing" ||
        playbackPhaseRef.current === "playing" ||
        playbackPhaseRef.current === "recovering"
      );
    if (!preserveIntent) {
      shim?._setPlaying?.(false);
    }
    if (isBuffering) {
      setPlaybackPhase("buffering", "native_buffering");
    }

    logNativeState(playbackLogContext(), "native_false", {
      ...getRecoveryLogFields(failureReason, {
        failureReason,
        startupPath: isStartupRecoveryPhase(playbackPhaseRef.current),
      }),
      failureReason,
      preserveIntent,
    });
  }, [buildPlaybackHealthSnapshot, duration, getRecoveryLogFields, isBuffering, isStartupRecoveryPhase, playbackLogContext, setPlaybackPhase]);

  const clearReleasedPlayer = useCallback((candidate?: VideoPlayerShim | null) => {
    if (candidate && playerRef.current !== candidate) return;
    saveProgressOnStop('player_shim_teardown');
    releasePlayerSession(candidate ?? playerRef.current);
    playerRef.current = null;
    loadedPlayerVideoId.current = null;
    setIsPlaying(false);
    setDuration(0);
    setSourceDuration(0);
  }, [saveProgressOnStop]);

  const handleNavigateToVideo = useCallback(
    (targetVideo: VideoItem, direction: "next" | "prev") => {
      if (!targetVideo || !videoId || !playerRef.current) return;

      saveProgressOnStop(`navigate_to_${direction}_video`);
      runTransition(targetVideo.title, direction);
      playerRef.current.pause();
      // Hand the target to the video useMemo synchronously, so the next
      // render sees the new VideoItem instead of falling through to
      // `null` while storedVideo loads. Eliminates the
      // "switching to videoId=undefined" reset-effect double-fire.
      pendingNavigationTargetRef.current = targetVideo;
      startupIntentRef.current = null;
      pendingStartupIntentReasonRef.current = "navigation";
      const nextUri = normalizePlaybackUri(
        (targetVideo as any).playbackUri ?? (targetVideo as any).path ?? targetVideo.uri ?? ""
      );
      validatedPlaybackUriRef.current = nextUri;
      setValidatedPlaybackUri(nextUri);
      setActiveVideoId(targetVideo.id);
      // Reset playback state for new video
      setIsPlaying(false);
      setPlaybackStartupError(null);
      hasStartedRef.current = false;
      hasRestoredPosition.current = false;
      autoResumeCompletedRef.current = false;
    },
    [
      saveProgressOnStop,
      videoId,
      runTransition
    ]
  );

  useEffect(() => {
    if (!player) return;
    try {
      player.loop = Boolean(!video?.isClip && (settings.loopMode === "one" || (settings.loopMode === "all" && videoQueue.length <= 1)));
      player.playbackRate = settings.speed;
      applyPlayerAudioState(player, {
        volume: 1,
        volumeBoost,
        isMuted,
        backgroundPlay: settings.backgroundPlay,
      });
    } catch {
      clearReleasedPlayer(player);
    }
  }, [
    isMuted,
    player,
    settings.backgroundPlay,
    settings.loopMode,
    settings.speed,
    volumeBoost,
    video?.isClip,
    videoQueue.length,
    clearReleasedPlayer,
  ]);

  useEffect(() => {
    if (!player) return;

    const stopVideoPlayback = () => {
      saveProgressOnStop('audio_focus_stolen');
      try {
        player.pause();
      } catch {
        // Ignore teardown races.
      }
      setIsPlaying(false);
    };

    PlayerManager.setVideoStopHandler(stopVideoPlayback);
    return () => {
      PlayerManager.setVideoStopHandler(null);
    };
  }, [player, saveProgressOnStop]);

  useEffect(() => {
    setSpeed(settings.speed);
  }, [settings.speed]);

  useEffect(() => {
    setLoopMode(settings.loopMode);
  }, [settings.loopMode]);

  useEffect(() => {
    setContentFitMode(initialPlayerFitFromSetting(settings.videoSizeMode));
  }, [settings.videoSizeMode]);

  // Centralized playback control: isPlaying state → shim play/pause (which now
  // both flips its flag AND calls native videoRef.resume()/pause()). The
  // declarative paused prop is the primary control; this is belt-and-braces.
  useEffect(() => {
    if (!playerRef.current) return;

    try {
      if (lastSentPlayingStateRef.current === isPlaying) {
        return;
      }

      if (isPlaying) {
        logPlayback(playbackLogContext(), "play_sync");
        playerRef.current.play();
      } else {
        logPlayback(playbackLogContext(), "pause_sync");
        playerRef.current.pause();
      }
      lastSentPlayingStateRef.current = isPlaying;
    } catch (e) {
      console.error("[Playback] Playback sync failed:", e);
      lastSentPlayingStateRef.current = null; // Reset on error for recovery attempt
    }

  }, [isPlaying, playbackLogContext]);



  // (Position polling, save-on-progress, and end-detection live in the 250 ms
  // interval below. A second 500 ms interval used to run here too, but its
  // end-detection only required position ≥ duration − 0.35s — without the
  // wasPlayingRef + !nextIsPlaying co-conditions — so transient or early
  // duration values would falsely trip "video ended" within a second or two
  // of starting playback and either auto-advance or close the player.)

  useEffect(() => {
    setZoomScale(MIN_PINCH_SCALE);
    setVideoNaturalSize(null);
    setAudioTracks([]);
    setSelectedAudioTrackIndex(null);
    // NOTE: do NOT null-flip validatedPlaybackUri here. The URI-validation
    // effect commits the new URI optimistically. Clearing here would force
    // <Video> through a brief "no source" render, but the new `videoSource`
    // memo already gates on URI-matches-video so the new source is only
    // applied once it actually belongs to the new videoId — no stale-URI
    // load can happen even if we keep the prior URI for one extra render.
    setPlaybackStartupError(null);
    setResumePrompt(null);
    setResumeCheckPending(Boolean(videoId && settings.rememberPosition));
    autoPlayIntentRef.current = false;
    // Don't set isPlaying=true here — wait until the native player is ready
    // (onReadyForDisplay) or the resume prompt effect handles it.
    lastStopReasonRef.current = 'video_switch_reset';
    sourceGenerationRef.current += 1;
    playbackSessionIdRef.current = createPlaybackSessionId(videoId, sourceGenerationRef.current);
    startupIntentRef.current = null;
    resetRecoveryAttempts(sourceGenerationRef.current);
    startupAnalyticsRef.current = {
      navigationAt: Date.now(),
      sourceValidatedAt: 0,
      loadStartAt: 0,
      loadedAt: 0,
      firstProgressAt: 0,
      nativePlayingAckAt: 0,
      stabilizationStartedAt: 0,
      stabilizationConfirmedAt: 0,
      startupAttempt: 0,
      recoveryCount: 0,
      rebufferCount: 0,
      stallCount: 0,
      success: false,
    };
    logPlaybackStop(playbackLogContext(), "video_switch_reset", { switchingToVideoId: videoId ?? null });
    setIsPlaying(false);
    hasRestoredPosition.current = false;
    hasStartedRef.current = false;
    initPlaybackForVideoIdRef.current = null;
    // Phase 7: clear Fast-path bookkeeping so the new video starts clean.
    // Forgetting these would let a stale escalation counter cross videos
    // and produce a false remount, and a stale fastStartIssuedForVideoIdRef
    // would let handleVideoLoadFast treat the very first onLoad of the new
    // video as a non-pre-init load.
    fastStartIssuedForVideoIdRef.current = null;
    fastRecoveryAttemptCountRef.current = 0;
    fastRecoveryWindowStartRef.current = 0;
    prefetchedForVideoIdRef.current = null;
    playbackStartInFlightRef.current = false;
    pendingPlayAfterLoadRef.current = false;
    pendingStartupPositionRef.current = 0;
    startupAttemptRef.current = 0;
    startupRecoveryCountRef.current = 0;
    startupStableConfirmedRef.current = false;
    stabilizationStartedAtRef.current = 0;
    stabilizationStartPositionRef.current = 0;
    lastNativeFalseReasonRef.current = "unknown";
    lastRecoveryClassRef.current = "unknown";
    lastRecoveryActionRef.current = null;
    lastRemountAtRef.current = 0;
    consecutiveSurfaceLostRef.current = 0;
    lastSuccessfulNativeAckRecoveryAtRef.current = 0;
    startupWatchdogConfirmedRef.current = false;
    // Reset playback state machine + health-model refs for the new video.
    setPlaybackPhase("idle", "video_switch_reset");
    isNativePlayingRef.current = false;
    lastNativeAckPlayingAtRef.current = 0;
    bufferingStartedAtRef.current = null;
    playbackStartTsRef.current = 0;
    lastProgressAtRef.current = 0;
    lastProgressPosRef.current = 0;
    lastPlayAssertAtRef.current = 0;
    lastRecoveryAtRef.current = 0;
    lastHealthyAtRef.current = 0;
    setResumedFromSaved(false);
    fallbackRetryCountRef.current = 0;
    seekNudgeUsedRef.current = false;
    videoErrorRef.current = null;
    onLoadFiredRef.current = false;
    onReadyForDisplayFiredRef.current = false;
    onProgressFiredRef.current = false;
    loadStartTimestampRef.current = null;
    loadStartPerformanceRef.current = null;
    pendingResumeSeekRef.current = null;
    setPendingStartPositionMs(null);
    lastReadyTimestampRef.current = 0;
    if (playbackStateChangeTimerRef.current) {
      clearTimeout(playbackStateChangeTimerRef.current);
      playbackStateChangeTimerRef.current = null;
    }
    if (startupFalseReassertTimerRef.current) {
      clearTimeout(startupFalseReassertTimerRef.current);
      startupFalseReassertTimerRef.current = null;
    }
    // Reset decoder to default — don't carry SW-mode failure across videos
    setDecoderMode("hwPlus");
    lastSavedPosition.current = 0;
    latestPlaybackRef.current = {
      absolutePosition: 0,
      position: 0,
      duration: 0,
      sourceDuration: 0,
    };
    pendingSeekAbsoluteRef.current = null;
    loadedPlayerVideoId.current = videoId ?? null;
    playbackErrorHandledVideoId.current = null;
    completionHandledVideoId.current = null;
    pinchGestureRef.current = {
      active: false,
      startDistance: 0,
      startScale: MIN_PINCH_SCALE,
      hasChanged: false,
    };
    return () => {
      startupIntentRef.current = null;
      pendingStartupIntentReasonRef.current = null;
    };
  }, [playbackLogContext, resetRecoveryAttempts, setPlaybackPhase, settings.autoPlay, settings.rememberPosition, videoId]);

  useEffect(() => {
    if (!player || !videoId || isAudioMode) return;
    loadedPlayerVideoId.current = videoId;
    setPlayerSession(player, videoId);
  }, [isAudioMode, player, videoId]);



  useEffect(() => {
    if (videoId && !playbackUri) {
      setPlaybackStartupError("This library item does not have a playable media path.");
    }
  }, [playbackUri, videoId]);

  useEffect(() => {
    if (!videoId) {
      validatedPlaybackUriRef.current = null;
      setValidatedPlaybackUri(null);
      setPlaybackStartupError(null);
      return;
    }

    if (!playbackUri) {
      validatedPlaybackUriRef.current = null;
      setValidatedPlaybackUri(null);
      setPlaybackStartupError("This library item does not have a playable media path.");
      return;
    }

    const normalizedUri = normalizePlaybackUri(playbackUri);
    const alreadyValidated = validatedPlaybackUriRef.current === normalizedUri;
    setPlaybackStartupError(null);
    validatedPlaybackUriRef.current = normalizedUri;
    setValidatedPlaybackUri((current) => (current === normalizedUri ? current : normalizedUri));
    if (!alreadyValidated) {
      startupAnalyticsRef.current.sourceValidatedAt = Date.now();
      logPlayback(playbackLogContext(), "source_validated", { uri: normalizedUri });
    }

    return () => {
      validatedPlaybackUriRef.current = null;
    };
  }, [playbackLogContext, playbackUri, videoId]);


  useEffect(() => {
    setTrimStart(0);
    setTrimEnd(Math.max(video?.duration ?? 0, 0));
    setTrimTitle(video ? `${video.title} Clip` : "");
    setTrimPanelVisible(false);
  }, [video?.duration, video?.title, videoId]);

  useEffect(() => {
    backgroundPlayRef.current = settings.backgroundPlay;
  }, [settings.backgroundPlay]);

  useEffect(() => {
    let isMounted = true;
    const applyInitialVolume = (nextVolume: number) => {
      const clampedVolume = clamp01(nextVolume);
      resetVolumeGestureThrottle(clampedVolume);
      if (clampedVolume > 0.001) {
        lastAudibleVolume.current = clampedVolume;
      }
      setVolume(clampedVolume);
      setIsMuted(clampedVolume <= 0.001);
    };

    void getDeviceVolume()
      .then((deviceVolume) => {
        if (!isMounted) return;
        applyInitialVolume(deviceVolume);
      })
      .catch((error) => {
        console.warn("System volume read failed:", error);
        if (!isMounted) return;
        applyInitialVolume(settings.defaultVolume);
      });

    return () => {
      isMounted = false;
    };
  }, [settings.defaultVolume]);

  // Auto-resume + persistent Start Over button (see handleStartOver below).
  // Do NOT re-introduce a "Resume / Start Over" pre-playback prompt here —
  // every refactor that has tried to merge prompt + auto-resume has regressed
  // playback startup. The Start Over pill in VideoPlayerControls is the user's
  // fresh-play affordance.
  useEffect(() => {
    if (!video || !player || !validatedPlaybackUri) return;
    const initPlayback = async () => {
      const initGeneration = sourceGenerationRef.current;
      // Phase 6: choose Fast vs legacy at the single entry point. Selecting
      // by reference (not branching inside the function bodies) keeps the
      // side effects of the two paths from interleaving.
      const startPlayback = FAST_STARTUP_ENABLED ? startPlaybackFast : startPlaybackUnified;
      // Phase 7: pre-set isPlaying so the Video component's paused prop is
      // already `false` by the time startPlaybackFast issues .play(). This
      // closes the render-cycle gap where Video would otherwise be paused
      // while we call play() — without this, the player can stay paused
      // until the next React render commits and the resulting "no progress"
      // looks like a stall.
      if (FAST_STARTUP_ENABLED) {
        setIsPlaying(true);
      }
        try {
        if (activeVideoId === routeVideoId && hasRouteStartPosition) {
          const startPosition = routeStartPosition > 1 ? routeStartPosition : 0;
          setResumeCheckPending(false);
          setResumedFromSaved(startPosition > 1);
          logPlayback(playbackLogContext(), startPosition > 1 ? "resume_start_requested_route" : "fresh_start_requested_route", { position: startPosition });
          if (!isCurrentGeneration(initGeneration)) return;
          setStartupIntent(startPosition, startPosition > 1 ? "route_resume" : "fresh", initGeneration);
          const started = await startPlayback({ startPosition });
          if (!started) playbackStartInFlightRef.current = false;
          return;
        }

        if (settings.rememberPosition && videoId) {
          // Phase 8: check the prefetch cache first (synchronous, no await).
          // The prefetch hook in handleVideoProgress warmed the cache for
          // next/prev videos as soon as the previous video reached `playing`.
          // Cache hit eliminates the 150 ms DB roundtrip below entirely.
          const cachedSession = peekSessionState(videoId);
          const resolvedProgress = cachedSession
            ? {
                positionSeconds: cachedSession.position,
                durationSeconds: cachedSession.duration,
                completed: cachedSession.completed,
                watchedAt: cachedSession.updatedAt,
                cached: true as const,
              }
            : await (async () => {
                const raw = await Promise.race([
                  getPlaybackProgress(videoId),
                  new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), RESUME_LOOKUP_TIMEOUT_MS),
                  ),
                ]);
                if (!raw) return null;
                return {
                  positionSeconds: raw.positionSeconds,
                  durationSeconds: raw.durationSeconds,
                  completed: raw.completed,
                  watchedAt: raw.lastWatchedAt,
                  cached: false as const,
                };
              })();

          if (!isCurrentGeneration(initGeneration)) return;
          if (resolvedProgress && !resolvedProgress.completed && resolvedProgress.positionSeconds > 1) {
            const knownDuration = Number.isFinite(video.duration) ? Number(video.duration) : 0;
            // Rewind scales with how long ago the video was watched — a quick
            // pause barely rewinds, a day-old resume rewinds more for context.
            const rewindSeconds = computeResumeRewindSeconds(
              resolvedProgress.watchedAt ? Date.now() - resolvedProgress.watchedAt : null,
            );
            const resumeStartPosition = knownDuration > 0 && resolvedProgress.positionSeconds >= Math.max(knownDuration - 10, 0)
              ? 0
              : Math.max(0, resolvedProgress.positionSeconds - rewindSeconds);
            logPlayback(playbackLogContext(), "resume_start_requested_db", {
              savedPosition: resolvedProgress.positionSeconds,
              startPosition: resumeStartPosition,
              nearEndReset: resumeStartPosition === 0 && knownDuration > 0,
              cached: resolvedProgress.cached,
            });
            setResumeCheckPending(false);
            setResumedFromSaved(resumeStartPosition > 0);
            setStartupIntent(
              resumeStartPosition,
              pendingStartupIntentReasonRef.current ?? "db_resume",
              initGeneration,
            );
            pendingStartupIntentReasonRef.current = null;
            const started = await startPlayback({ startPosition: resumeStartPosition });
            if (!started) playbackStartInFlightRef.current = false;
            return;
          }
        }

        setResumeCheckPending(false);
        setResumedFromSaved(false);
        if (!isCurrentGeneration(initGeneration)) return;
        logPlayback(playbackLogContext(), "fresh_start_requested", { position: 0 });
        setStartupIntent(0, pendingStartupIntentReasonRef.current ?? "fresh", initGeneration);
        pendingStartupIntentReasonRef.current = null;
        const started = await startPlayback({ startPosition: 0 });
        if (!started) playbackStartInFlightRef.current = false;
      } catch (error) {
        console.warn("[Playback] Initial playback failed:", error);
        playbackStartInFlightRef.current = false;
        hasStartedRef.current = false;
        setResumeCheckPending(false);
        setIsPlaying(false);
      }
    };

    // One-shot per videoId. The effect can re-fire any number of times
    // during a load — startPlaybackUnified's useCallback identity changes
    // whenever sourceDuration / video update, which dirties this effect —
    // but we MUST kick off playback exactly once per videoId. Tracking by
    // the actual videoId value (rather than two boolean flags) makes this
    // robust to clock-race scenarios where one flag is reset while the
    // other isn't.
    if (initPlaybackForVideoIdRef.current !== videoId) {
      initPlaybackForVideoIdRef.current = videoId ?? null;
      playbackStartInFlightRef.current = true;
      void initPlayback();
    }

    // No cleanup that resets hasStartedRef here. The reset-everything effect
    // already clears initPlaybackForVideoIdRef when videoId changes, and it
    // runs before this effect's body for the new video.
  }, [activeVideoId, getPlaybackProgress, hasRouteStartPosition, isCurrentGeneration, playbackLogContext, player, routeStartPosition, routeVideoId, setStartupIntent, settings.rememberPosition, startPlaybackUnified, validatedPlaybackUri, video, videoId]);

  useEffect(() => {
    if (sleepTimerRemaining === null || sleepTimerRemaining <= 0) return;

    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (playerRef.current) {
            saveProgressOnStop('sleep_timer_expired');
            playerRef.current.pause();
            setIsPlaying(false);
          }
          Alert.alert("Sleep Timer", "Playback has been stopped by the sleep timer.");
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemaining]);

  // Continuous play countdown
  useEffect(() => {
    if (!featureConfig.upNextAutoplayEnabled) {
      setAutoPlayTarget(null);
      setAutoPlayCountdown(null);
      return;
    }
    autoPlayCountdownActiveRef.current = autoPlayCountdown !== null;
    if (autoPlayCountdown === null) return;
    if (autoPlayCountdown <= 0) {
      const target = autoPlayTarget ?? nextVideo;
      if (target) navigateToVideoRef.current?.(target, "next");
      setAutoPlayTarget(null);
      setAutoPlayCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setAutoPlayCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoPlayCountdown, autoPlayTarget, featureConfig.upNextAutoplayEnabled, nextVideo]);

  useEffect(() => {
    if (!featureConfig.upNextAutoplayEnabled || !nextVideo || isAudioMode || !isPlaying) {
      setShowUpNextPopup(false);
      return;
    }

    const remaining = duration - position;
    if (remaining > 0 && remaining <= 8) {
      setShowUpNextPopup(true);
    } else {
      setShowUpNextPopup(false);
    }
  }, [duration, featureConfig.upNextAutoplayEnabled, isAudioMode, isPlaying, nextVideo, position]);

  useEffect(() => {
    if (!featureConfig.discoveryHintsEnabled) {
      setShowDiscoveryHints(false);
      return;
    }
    discoveryHintTimerRef.current = setTimeout(() => {
      if (!isMounted.current) return;
      setShowDiscoveryHints(true);
      hideDiscoveryHintTimerRef.current = setTimeout(() => {
        if (isMounted.current) setShowDiscoveryHints(false);
      }, 5000);
    }, 1500);
    return () => {
      if (discoveryHintTimerRef.current) clearTimeout(discoveryHintTimerRef.current);
      if (hideDiscoveryHintTimerRef.current) clearTimeout(hideDiscoveryHintTimerRef.current);
    };
  }, [featureConfig.discoveryHintsEnabled]);

  const handleSetSleepTimer = useCallback((minutes: number | null) => {
    if (!featureConfig.sleepTimerEnabled) {
      showHud("seek", "Sleep timer disabled", 0.1);
      return;
    }
    if (minutes === null) {
      setSleepTimerRemaining(null);
      showHud("seek", "Sleep timer off", 0.1);
    } else {
      const seconds = minutes * 60;
      setSleepTimerRemaining(seconds);
      showHud("seek", `Sleep timer set for ${minutes}m`, 0.8);
    }
  }, [featureConfig.sleepTimerEnabled, showHud]);

  // Start Over button handler
  const handleStartOver = useCallback(async () => {
    console.log("[StartOver] User clicked Start Over");

    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight");
    }

    if (videoId) {
      await clearPlaybackProgress(videoId);
    }

    // Reset all guards so startPlayback won't bail
    hasStartedRef.current = false;
    hasRestoredPosition.current = false;
    autoResumeCompletedRef.current = false;
    pendingSeekAbsoluteRef.current = null;
    setShowStartOverButton(false);
    setResumedFromSaved(false);
    setResumePrompt(null);

    setStartupIntent(0, "start_over");
    const success = await startPlaybackUnified({ startPosition: 0, forceReset: true });

    if (success) {
      showHud("seek", "Started from beginning", 0.1);
    } else {
      console.error("[StartOver] startPlaybackUnified returned false — fallback to direct play");
      setTimeout(() => {
        if (playerRef.current && !playerRef.current.playing) {
          try { playerRef.current.play(); } catch { }
          setIsPlaying(true);
        }
      }, 200);
    }
  }, [clearPlaybackProgress, setStartupIntent, showHud, startPlaybackUnified, videoId]);

  const waitForTrackPlayerReady = useCallback(async () => {
    const readyStates = new Set([State.Ready, State.Playing, State.Paused]);
    const currentState = await TrackPlayer.getPlaybackState();
    if (readyStates.has(currentState.state)) return currentState;

    return new Promise<typeof currentState>((resolve) => {
      let settled = false;
      let subscription: { remove: () => void } | null = null;
      const finish = (state: typeof currentState) => {
        if (settled) return;
        settled = true;
        subscription?.remove();
        resolve(state);
      };
      const timeout = setTimeout(() => {
        void TrackPlayer.getPlaybackState()
          .then(finish)
          .catch(() => finish(currentState));
      }, 2500);

      subscription = TrackPlayer.addEventListener(Event.PlaybackState, (state) => {
        if (readyStates.has(state.state)) {
          clearTimeout(timeout);
          finish(state);
        }
      });
    });
  }, []);

  useEffect(() => {
    if (!player) return;
    if (!videoId) return;

    let backgroundHandoffState: {
      active: boolean;
      position: number;
    } = { active: false, position: 0 };

    const subscription = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        if (!settings.backgroundPlay) {
          try {
            // Await the write — a backgrounded app can be killed by the OS
            // before a fire-and-forget save would flush.
            await saveProgressOnStop('app_backgrounded_no_bg_play');
            player.pause();
            setIsPlaying(false);
          } catch {
            clearReleasedPlayer(player);
          }
          return;
        }

        if (playbackUri && player.playing && isTrackPlayerAvailable) {
          try {
            await saveProgressOnStop('app_background_handoff');
            // Fix #7: Use the current folder queue (videoQueueRef) for background notification
            // so next-up tracks follow folder order, not watch history
            const currentQueue = videoQueueRef.current.length > 0 ? videoQueueRef.current : videoQueue;
            const { queue, index } = buildHandoffQueue(currentQueue, video, playbackUri, currentIndexRef.current);
            const handoffPosition = player.currentTime;
            backgroundHandoffState.active = true;
            audioHandoffInProgressRef.current = true;
            autoPlayIntentRef.current = false;
            // Hand the live position straight to playAudio so audio starts at
            // the right spot, then re-sync + confirm playing before pausing the
            // video — pausing the video first could leave a dead session if the
            // audio start lost a setup race (the "background not playing" bug).
            await playAudio(queue, index, { startPosition: handoffPosition });
            await waitForTrackPlayerReady();
            await TrackPlayer.seekTo(handoffPosition).catch(() => undefined);
            await TrackPlayer.play().catch(() => undefined);
            player.pause();
          } catch (e) {
            audioHandoffInProgressRef.current = false;
            console.log("TrackPlayer background handoff failed", e);
          }
        }
        // If backgroundPlay is true but TrackPlayer unavailable, the native
        // player continues via playInBackground={true} on the Video component.
      } else if (nextState === "active") {
        // Restore from TrackPlayer
        if (backgroundHandoffState.active && isTrackPlayerAvailable && isTrackPlayerReady()) {
          try {
            const trackPlayerState = await waitForTrackPlayerReady();
            const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
            const trackPlayerPosition = await TrackPlayer.getPosition();
            await TrackPlayer.pause();
            backgroundHandoffState.active = false;
            audioHandoffInProgressRef.current = false;

            if (currentTrackIndex !== null && currentTrackIndex !== currentIndex) {
              const newTrack = await TrackPlayer.getTrack(currentTrackIndex);
              if (newTrack?.id && newTrack.id !== videoId) {
                setActiveVideoId(newTrack.id as string);
                return; // Navigation will trigger a fresh load
              }
            }

            if (Number.isFinite(trackPlayerPosition) && trackPlayerPosition > 0) {
              player.currentTime = trackPlayerPosition;
              capturePlaybackSnapshot(trackPlayerPosition, sourceDuration || duration);
              setPosition(getRelativePlaybackPosition(video, trackPlayerPosition, sourceDuration || duration));
            }
            if (trackPlayerState.state === State.Playing) {
              autoPlayIntentRef.current = true;
              setIsPlaying(true);
            }
          } catch (e) {
            audioHandoffInProgressRef.current = false;
            console.log("TrackPlayer foreground restore failed", e);
          }
        }
      }
    });

    return () => subscription.remove();
  }, [
    player,
    sourceDuration,
    settings.backgroundPlay,
    playbackUri,
    playAudio,
    saveProgressOnStop,
    video,
    videoId,
    currentIndex,
    capturePlaybackSnapshot,
    duration,
    clearReleasedPlayer,
    videoQueue,
    waitForTrackPlayerReady,
  ]);

  // Brightness is player-local: Android uses Activity window brightness, with
  // the overlay kept as a fallback for unsupported platforms/native failures.
  useEffect(() => {
    let isMounted = true;
    const initial = clamp01(settings.defaultBrightness ?? 1);
    const requestId = ++brightnessRequestIdRef.current;
    setBrightnessLevel(initial);
    void setPlayerBrightness(initial).then((nativeApplied) => {
      if (!isMounted || requestId !== brightnessRequestIdRef.current) return;
      setUseBrightnessOverlayFallback(!nativeApplied);
    });
    return () => {
      isMounted = false;
      void restorePlayerBrightness();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs only on mount

  useEffect(() => {
    if (Platform.OS === "android") {
      SystemNavigationBar.stickyImmersive().catch(() => { });
    }
    StatusBar.setHidden(true);

    return () => {
      if (Platform.OS === "android") {
        SystemNavigationBar.stickyImmersive().catch(() => { });
      }
      StatusBar.setHidden(true);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    try {
      if (effectiveOrientationMode === "landscape") {
        Orientation.lockToLandscape();
      } else if (effectiveOrientationMode === "portrait") {
        Orientation.lockToPortrait();
      } else {
        Orientation.unlockAllOrientations();
      }
    } catch (e) {
      console.warn("Orientation lock failed:", e);
    }
  }, [effectiveOrientationMode]);

  useEffect(() => {
    return () => {
      try {
        Orientation.unlockAllOrientations();
      } catch (e) { }
    };
  }, []);



  const scheduleVolumeSettingSave = useCallback(
    (nextVolume: number) => {
      if (volumePersistTimer.current) {
        clearTimeout(volumePersistTimer.current);
      }
      volumePersistTimer.current = setTimeout(() => {
        void updateSettings({ defaultVolume: nextVolume });
      }, 140);
    },
    [updateSettings]
  );

  const scheduleBrightnessSettingSave = useCallback(
    (nextBrightness: number) => {
      if (brightnessPersistTimer.current) {
        clearTimeout(brightnessPersistTimer.current);
      }
      brightnessPersistTimer.current = setTimeout(() => {
        void updateSettings({ defaultBrightness: nextBrightness });
      }, 140);
    },
    [updateSettings]
  );

  useEffect(() => {
    const subscription = addDeviceVolumeListener((nextVolume) => {
      resetVolumeGestureThrottle(nextVolume);
      if (nextVolume > 0.001) {
        lastAudibleVolume.current = nextVolume;
      }
      setVolume(nextVolume);
      setIsMuted(nextVolume <= 0.001);
      scheduleVolumeSettingSave(nextVolume);
      showVolumeHud(nextVolume);
    });

    return () => {
      subscription.remove();
    };
  }, [scheduleVolumeSettingSave, showVolumeHud]);

  const hideAllControls = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setUtilityRailExpanded(false);
    setQuickActionsExpanded(false);
    setPropertiesPanelVisible(false);
    setTrimPanelVisible(false);
    setControlsVisible(false);
  }, []);

  // Keep ref in sync so scheduleHideControls (memoized, ref-based) can read locked state
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const scheduleHideControls = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    // I4: Don't auto-hide when locked — unlock button must remain reachable.
    if (isLockedRef.current) return;
    controlsTimer.current = setTimeout(() => {
      if (isMounted.current) hideAllControls();
    }, CONTROL_TIMEOUT);
  }, [hideAllControls]);

  useEffect(() => {
    const shouldHoldVisible =
      Boolean(resumePrompt) ||
      utilityRailExpanded ||
      quickActionsExpanded ||
      propertiesPanelVisible ||
      trimPanelVisible ||
      isLocked; // I4: When locked, keep controls visible so unlock is reachable

    if (shouldHoldVisible) {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      setControlsVisible(true);
    } else if (controlsVisible && isPlaying) {
      scheduleHideControls();
    } else {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    }

    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [
    controlsVisible,
    isLocked,
    isPlaying,
    resumePrompt,
    quickActionsExpanded,
    propertiesPanelVisible,
    trimPanelVisible,
    scheduleHideControls,
    utilityRailExpanded,
  ]);

  useEffect(() => {
    return () => {
      if (hudTimer.current) clearTimeout(hudTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (doubleTapSeekClearTimer.current) clearTimeout(doubleTapSeekClearTimer.current);
      if (screenshotTimer.current) clearTimeout(screenshotTimer.current);
      if (resumePromptTimer.current) clearTimeout(resumePromptTimer.current);
      if (gestureFrame.current !== null) {
        cancelAnimationFrame(gestureFrame.current);
        gestureFrame.current = null;
      }
    };
  }, []);

  const showScreenshotPreview = useCallback((frame: VideoThumbnail) => {
    setScreenshotPreview(frame);
    if (screenshotTimer.current) clearTimeout(screenshotTimer.current);
    screenshotTimer.current = setTimeout(() => {
      if (isMounted.current) {
        setScreenshotPreview(null);
      }
    }, SCREENSHOT_PREVIEW_TIMEOUT);
  }, []);

  const toggleControls = useCallback(() => {
    if (screenshotPreview) {
      setScreenshotPreview(null);
      return;
    }

    // If any panel is expanded, a tap anywhere closes everything first
    const anyPanelOpen = utilityRailExpanded || quickActionsExpanded || propertiesPanelVisible || trimPanelVisible;
    if (anyPanelOpen) {
      hideAllControls();
      return;
    }

    setControlsVisible((previous) => {
      if (!previous) {
        if (!isLocked) {
          scheduleHideControls();
        }
        return true;
      }

      hideAllControls();
      return false;
    });
  }, [
    hideAllControls,
    isLocked,
    quickActionsExpanded,
    utilityRailExpanded,
    propertiesPanelVisible,
    trimPanelVisible,
    scheduleHideControls,
    screenshotPreview,
  ]);

  const getTapZone = useCallback(
    (locationX: number): TapZone => {
      if (!Number.isFinite(locationX)) return "center";
      const w = effectiveViewportWidth;
      const edgeWidth = w * DOUBLE_TAP_EDGE_RATIO;
      if (locationX <= edgeWidth) return "left";
      if (locationX >= w - edgeWidth) return "right";
      return "center";
    },
    [effectiveViewportWidth]
  );

  const handlePlayPause = useCallback((source: "transport" | "surface_double_tap" = "transport") => {
    try {
      if (!player || isLocked) return;
      logPlayback(playbackLogContext(), "playback_control", { source, action: isPlaying ? "pause" : "play" });
      if (Platform.OS !== "web") {
        ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
      }

      // Dismiss the resume "Start Over" card on any play/pause press.
      if (resumePrompt) {
        setResumePrompt(null);
        if (resumePromptTimer.current) {
          clearTimeout(resumePromptTimer.current);
          resumePromptTimer.current = null;
        }
      }

      const nextPlaying = !isPlaying;
      // Drive the native player synchronously on the tap so the user gets
      // immediate feedback — don't wait for the isPlaying effect to flush
      // (which can lag a frame behind rapid pause→play taps). The effect
      // remains as a back-stop sync.
      if (nextPlaying) {
        autoPlayIntentRef.current = true;
        lastSentPlayingStateRef.current = null;
        clearRecoveryTimers();
        // Reset health-model state for a fresh startup grace window —
        // user-initiated resumes get the same patience as a cold start.
        playbackStartTsRef.current = Date.now();
        lastPlayAssertAtRef.current = Date.now();
        lastRecoveryAtRef.current = 0;
        lastProgressAtRef.current = 0;
        lastProgressPosRef.current = latestPlaybackRef.current.absolutePosition;
        lastHealthyAtRef.current = Date.now();
        player.play();
        setIsPlaying(true);
        if (playbackPhaseRef.current === "paused" || playbackPhaseRef.current === "idle") {
          setPlaybackPhase("starting", "user_resume");
        }
        armStartupWatchdog();
      } else {
        autoPlayIntentRef.current = false;
        clearStartupWatchdog();
        clearRecoveryTimers();
        saveProgressOnStop(source === "transport" ? 'user_pause' : `pause_${source}`);
        player.pause();
        setIsPlaying(false);
        setPlaybackPhase("paused", "user_pause");
      }
      // M3: Re-arm auto-hide timer so user has full window to react to the new state
      scheduleHideControls();
    } catch (e) {
      console.error("Play/Pause failed:", e);
    }
  }, [armStartupWatchdog, clearRecoveryTimers, clearStartupWatchdog, playbackLogContext, player, isLocked, isPlaying, resumePrompt, saveProgressOnStop, scheduleHideControls, setPlaybackPhase]);

  const handleSeek = useCallback(
    (nextPosition: number) => {
      if (!player) return;
      const safeDuration = duration > 0 ? duration : Math.max(nextPosition, 0);
      const clamped = clamp(nextPosition, 0, safeDuration || 0);
      const absolutePosition = getAbsolutePlaybackPosition(
        video,
        clamped,
        sourceDuration || duration || video?.duration || clamped
      );
      player.currentTime = absolutePosition;
      pendingSeekAbsoluteRef.current = absolutePosition;
      try {
        videoRef.current?.seek(absolutePosition);
      } catch (error) {
        console.warn("Native seek failed, queued for retry:", error);
      }
      setPosition(clamped);
      capturePlaybackSnapshot(absolutePosition, sourceDuration || duration || video?.duration || clamped);
      setSeekPreviewPosition(null);
      seekPreviewPositionRef.current = null;
      // Invalidate the subtitle cursor — the new time may be far from the
      // last computed position, breaking the forward-search hint.
      subtitleOverlayRef.current?.invalidate();
    },
    [capturePlaybackSnapshot, duration, player, sourceDuration, video]
  );

  const handleScrubbingChange = useCallback((isScrubbing: boolean) => {
    isScrubbingRef.current = isScrubbing;
    if (isScrubbing) {
      gestureRef.current.mode = null;
      if (gestureFrame.current !== null) {
        cancelAnimationFrame(gestureFrame.current);
        gestureFrame.current = null;
      }
      pendingGestureUpdate.current = null;
      // I1: Hold controls visible during scrub — cancel any pending auto-hide
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
        controlsTimer.current = null;
      }
      setControlsVisible(true);
    } else {
      // I1: Re-arm the auto-hide timer when scrubbing finishes
      scheduleHideControls();
    }
  }, [scheduleHideControls]);

  // Returns the seek amount for the current tap in the chain.
  // Consecutive taps in the same zone accumulate: ×1, ×2, ×3 (capped).
  //   const getChainedSeekAmount = useCallback((zone: 'left' | 'right') => {
  //   const chain = doubleTapChainRef.current;
  //   if (chain.zone === zone) {
  //     chain.count = Math.min(chain.count + 1, 3);
  //   } else {
  //     chain.zone = zone;
  //     chain.count = 1;
  //   }
  //   if (chain.resetTimer) clearTimeout(chain.resetTimer);
  //   chain.resetTimer = setTimeout(resetDoubleTapChain, DOUBLE_TAP_TIMEOUT);
  //   return DOUBLE_TAP_SEEK_SECONDS * chain.count;
  // }, [resetDoubleTapChain]);
  const resetDoubleTapChain = useCallback(() => {
    const chain = doubleTapChainRef.current;
    if (chain.resetTimer) {
      clearTimeout(chain.resetTimer);
      chain.resetTimer = null;
    }
    chain.zone = null;
    chain.count = 0;
    chain.lastTapTime = 0;
    chain.pendingZone = null;
    doubleTapSeekOpacitySV.value = withTiming(0, { duration: 180 });
    if (doubleTapSeekClearTimer.current) {
      clearTimeout(doubleTapSeekClearTimer.current);
    }
    doubleTapSeekClearTimer.current = setTimeout(() => {
      setDoubleTapSeekFeedback(null);
    }, 180);
  }, [doubleTapSeekOpacitySV]);

  const showDoubleTapSeekFeedback = useCallback((side: "left" | "right", seekAmount: number) => {
    if (doubleTapSeekClearTimer.current) {
      clearTimeout(doubleTapSeekClearTimer.current);
      doubleTapSeekClearTimer.current = null;
    }
    setDoubleTapSeekFeedback({
      side,
      label: `${side === "right" ? "+" : "-"}${seekAmount}s`,
    });
    doubleTapSeekOpacitySV.value = withTiming(1, { duration: 80 });
  }, [doubleTapSeekOpacitySV]);

  const getChainedSeekAmount = useCallback((zone: 'left' | 'right') => {
    const chain = doubleTapChainRef.current;
    if (chain.zone === zone) {
      chain.count = Math.min(chain.count + 1, 3);
    } else {
      chain.zone = zone;
      chain.count = 1;
    }
    if (chain.resetTimer) clearTimeout(chain.resetTimer);
    chain.resetTimer = setTimeout(resetDoubleTapChain, DOUBLE_TAP_CHAIN_TIMEOUT_MS);
    return settings.doubleTapSeek * chain.count;
  }, [resetDoubleTapChain, settings.doubleTapSeek]);

  const handleSeekForward = useCallback(() => {
    const seekAmount = getChainedSeekAmount('right');
    const basePosition = seekPreviewPosition ?? position;
    const safeDuration = duration > 0 ? duration : Math.max(basePosition, 0);
    const nextPosition = clamp(basePosition + seekAmount, 0, safeDuration || 0);
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    handleSeek(nextPosition);
    showDoubleTapSeekFeedback("right", seekAmount);
  }, [
    duration,
    getChainedSeekAmount,
    handleSeek,
    position,
    seekPreviewPosition,
    showDoubleTapSeekFeedback,
  ]);

  const handleSeekBackward = useCallback(() => {
    const seekAmount = getChainedSeekAmount('left');
    const basePosition = seekPreviewPosition ?? position;
    const safeDuration = duration > 0 ? duration : Math.max(basePosition, 0);
    const nextPosition = clamp(basePosition - seekAmount, 0, safeDuration || 0);
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: false });
    }
    handleSeek(nextPosition);
    showDoubleTapSeekFeedback("left", seekAmount);
  }, [
    duration,
    getChainedSeekAmount,
    handleSeek,
    position,
    seekPreviewPosition,
    showDoubleTapSeekFeedback,
  ]);

  // Single tap handler — strictly toggles controls visibility.
  // Double-tap seek is handled separately by VideoPlayerControls' double-tap gesture.
  const handleTap = useCallback(
    (_event: { nativeEvent?: { locationX?: number } }) => {
      if (isLocked) return;
      toggleControls();
    },
    [isLocked, toggleControls]
  );

  const handleSpeedChange = useCallback(() => {
    if (!player) return;
    const currentIndex = SPEEDS.indexOf(speed);
    const nextSpeed = SPEEDS[(currentIndex + 1) % SPEEDS.length];
    setSpeed(nextSpeed);
    player.playbackRate = nextSpeed;
    void updateSettings({ speed: nextSpeed });
    showHud("seek", `${nextSpeed}x playback`, nextSpeed / 2);
  }, [player, showHud, speed, updateSettings]);

  const handleSetVolume = useCallback(
    (nextVolume: number) => {
      const clampedVolume = clamp01(nextVolume);
      if (clampedVolume > 0.001) {
        lastAudibleVolume.current = clampedVolume;
      }
      setVolume(clampedVolume);
      const nextMuted = clampedVolume <= 0.001;
      setIsMuted(nextMuted);

      const nextStep = Math.round(clampedVolume * 10);
      const isGestureDriven = activeGestureMode === "volume";
      if (isGestureDriven && nextStep !== prevVolumePercentRef.current) {
        if (Platform.OS !== "web") {
          ReactNativeHapticFeedback.trigger("selection", { enableVibrateFallback: false });
        }
        prevVolumePercentRef.current = nextStep;
      }

      if (player) {
        applyPlayerAudioState(player, {
          volume: 1,
          volumeBoost,
          isMuted: nextMuted,
          backgroundPlay: settings.backgroundPlay,
        });
      }
      scheduleVolumeSettingSave(clampedVolume);
      const setNativeVolume = isGestureDriven ? setDeviceVolumeForGesture : setDeviceVolume;
      void setNativeVolume(clampedVolume).catch((error) => {
        console.warn("System volume set failed:", error);
      });
      showVolumeHud(clampedVolume);
    },
    [activeGestureMode, player, scheduleVolumeSettingSave, settings.backgroundPlay, showVolumeHud, volumeBoost]
  );

  const handleSetBrightness = useCallback(
    (nextBrightness: number) => {
      const clampedBrightness = clamp01(nextBrightness);
      const requestId = ++brightnessRequestIdRef.current;
      setBrightnessLevel(clampedBrightness);
      void setPlayerBrightness(clampedBrightness).then((nativeApplied) => {
        if (requestId !== brightnessRequestIdRef.current) return;
        setUseBrightnessOverlayFallback(!nativeApplied);
      });
      const nextStep = Math.round(clampedBrightness * 10);
      const isGestureDriven = activeGestureMode === "brightness";
      if (isGestureDriven && nextStep !== prevBrightnessPercentRef.current) {
        if (Platform.OS !== "web") {
          ReactNativeHapticFeedback.trigger("selection", { enableVibrateFallback: false });
        }
        prevBrightnessPercentRef.current = nextStep;
      }

      // Auto-sync night mode: very dark → enable; recovered → disable
      if (clampedBrightness <= 0.12 && !nightModeRef.current) {
        setNightMode(true);
      } else if (clampedBrightness > 0.35 && nightModeRef.current) {
        setNightMode(false);
      }

      scheduleBrightnessSettingSave(clampedBrightness);
      showBrightnessHud(clampedBrightness);
    },
    [activeGestureMode, scheduleBrightnessSettingSave, showBrightnessHud]
  );

  const flushGestureUpdate = useCallback(() => {
    gestureFrame.current = null;
    const pending = pendingGestureUpdate.current;
    pendingGestureUpdate.current = null;

    if (!pending) return;

    seekPreviewPositionRef.current = pending.value;
    setSeekPreviewPosition(pending.value);
    showHud(
      "seek",
      `${formatDuration(pending.value)} / ${formatDuration(pending.duration)}`,
      pending.duration > 0 ? pending.value / pending.duration : 0,
      pending.direction
    );
  }, [showHud]);

  const scheduleSeekGestureUpdate = useCallback(
    (update: { mode: "seek"; value: number; duration: number; direction: "forward" | "rewind" }) => {
      pendingGestureUpdate.current = update;
      seekPreviewPositionRef.current = update.value;
      if (gestureFrame.current !== null) return;
      gestureFrame.current = requestAnimationFrame(flushGestureUpdate);
    },
    [flushGestureUpdate]
  );

  const handleToggleMute = useCallback(() => {
    const targetVolume = isMuted ? lastAudibleVolume.current : 0;
    setVolume(targetVolume);
    setIsMuted(targetVolume <= 0.001);
    if (player) {
      applyPlayerAudioState(player, {
        volume: 1,
        volumeBoost,
        isMuted: targetVolume <= 0.001,
        backgroundPlay: settings.backgroundPlay,
      });
    }
    scheduleVolumeSettingSave(targetVolume);
    void setDeviceVolume(targetVolume).catch((error) => {
      console.warn("System volume set failed:", error);
    });
    showVolumeHud(targetVolume);
  }, [isMuted, player, scheduleVolumeSettingSave, settings.backgroundPlay, showVolumeHud, volumeBoost]);

  const handleToggleLoop = useCallback(() => {
    if (!player) return;
    const modes: ("none" | "one" | "all")[] = ["none", "one", "all"];
    const currentIndex = modes.indexOf(loopMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setLoopMode(nextMode);
    player.loop = Boolean(!video?.isClip && (nextMode === "one" || (nextMode === "all" && videoQueueRef.current.length <= 1)));
    void updateSettings({ loopMode: nextMode });
  }, [loopMode, player, updateSettings, video?.isClip]);

  const handleToggleContentFit = useCallback(() => {
    if (isAudioMode) {
      showHud("seek", "Audio mode", 0.2);
      return;
    }

    const nextMode: ContentFitMode =
      contentFitMode === "contain"
        ? "cover"
        : contentFitMode === "cover"
          ? "fill"
          : "contain";

    setContentFitMode(nextMode);
    void updateSettings({ videoSizeMode: settingFromFit(nextMode) });
    showHud(
      "seek",
      nextMode === "contain"
        ? "Fit mode"
        : nextMode === "cover"
          ? "Expand mode"
          : "Stretch mode",
      nextMode === "contain" ? 0.33 : nextMode === "cover" ? 0.66 : 1
    );
  }, [contentFitMode, isAudioMode, showHud, updateSettings]);

  const handleSetZoomScale = useCallback(
    (nextScale: number) => {
      if (isAudioMode) return;
      const clampedScale = clamp(nextScale, MIN_PINCH_SCALE, MAX_PINCH_SCALE);
      setZoomScale(clampedScale);

      // Fix #10: When zoom starts, switch to contain (fit) mode first so user
      // can actually see the zoom effect. Stretch/cover already fills the frame.
      if (clampedScale > MIN_PINCH_SCALE + 0.01 && contentFitMode !== "contain") {
        setContentFitMode("contain");
      }

      const pct = Math.round(clampedScale * 100);
      showHud(
        "zoom",
        clampedScale <= MIN_PINCH_SCALE + 0.01
          ? "Zoom reset"
          : `Zoom ${pct}%`,
        (clampedScale - MIN_PINCH_SCALE) /
        (MAX_PINCH_SCALE - MIN_PINCH_SCALE)
      );
    },
    [contentFitMode, isAudioMode, showHud]
  );

  const handleZoomAction = useCallback(() => {
    if (!featureConfig.pinchZoomEnabled) {
      showHud("seek", "Zoom disabled in settings", 0.1);
      return;
    }
    if (isAudioMode) {
      showHud("seek", "Audio mode", 0.2);
      return;
    }

    if (zoomScale > MIN_PINCH_SCALE + 0.01) {
      handleSetZoomScale(MIN_PINCH_SCALE);
      return;
    }

    showHud("zoom", "Pinch with two fingers to zoom", 0.12);
  }, [featureConfig.pinchZoomEnabled, handleSetZoomScale, isAudioMode, showHud, zoomScale]);

  const handleToggleUtilityRail = useCallback(() => {
    if (isLocked) return;
    setUtilityRailExpanded((current) => {
      const nextExpanded = !current;
      setQuickActionsExpanded(false);
      setPropertiesPanelVisible(false);
      setTrimPanelVisible(false);
      return nextExpanded;
    });
    setControlsVisible(true);
  }, [isLocked]);

  const handleHideUpNext = useCallback(() => {
    setUtilityRailExpanded(false);
    setControlsVisible(true);
  }, []);

  // Load suggested videos when up-next panel opens
  useEffect(() => {
    if (!utilityRailExpanded) return;
    const currentQueueIds = new Set(videoQueue.map((v) => v.id));
    fetchMostPlayed(8, 0).then((results) => {
      setSuggestedVideos(results.filter((v) => !currentQueueIds.has(v.id)).slice(0, 5));
    }).catch(() => { /* non-critical */ });
  }, [utilityRailExpanded, videoQueue, fetchMostPlayed]);

  const handleToggleQuickActions = useCallback(() => {
    if (isLocked) return;
    setQuickActionsExpanded((current) => {
      const nextExpanded = !current;
      setUtilityRailExpanded(false);
      setPropertiesPanelVisible(false);
      setTrimPanelVisible(false);
      return nextExpanded;
    });
    setControlsVisible(true);
  }, [isLocked]);

  const handleTogglePropertiesPanel = useCallback(() => {
    if (isLocked) return;
    setUtilityRailExpanded(false);
    setQuickActionsExpanded(false);
    setTrimPanelVisible(false);
    setPropertiesPanelVisible((current) => !current);
    setControlsVisible(true);
  }, [isLocked]);

  const handleOpenTrimPanel = useCallback(() => {
    if (!featureConfig.trimEnabled) {
      showHud("seek", "Trim disabled in settings", 0.1);
      return;
    }
    if (isLocked || !video || isAudioMode) return;
    setUtilityRailExpanded(false);
    setPropertiesPanelVisible(false);
    setQuickActionsExpanded(false);
    setTrimStart((current) => clamp(current, 0, Math.max(duration, 0)));
    setTrimEnd((current) => {
      const maxDuration = Math.max(duration, 0);
      const fallback = maxDuration > 0 ? maxDuration : video.duration;
      return clamp(current || fallback, 0, maxDuration || fallback);
    });
    setTrimTitle((current) => current || `${video.title} Clip`);
    setTrimPanelVisible(true);
    setControlsVisible(true);
  }, [duration, featureConfig.trimEnabled, isAudioMode, isLocked, showHud, video]);

  const handleMarkTrimStart = useCallback(() => {
    const nextStart = clamp(position, 0, trimEnd);
    setTrimStart(nextStart);
    showHud("seek", `Trim start ${formatDuration(nextStart)}`, duration > 0 ? nextStart / duration : 0);
  }, [duration, position, showHud, trimEnd]);

  const handleMarkTrimEnd = useCallback(() => {
    const nextEnd = clamp(position, trimStart, duration || position);
    setTrimEnd(nextEnd);
    showHud("seek", `Trim end ${formatDuration(nextEnd)}`, duration > 0 ? nextEnd / duration : 1);
  }, [duration, position, showHud, trimStart]);

  const handleResetTrim = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(duration);
    showHud("seek", "Trim reset", 0.02);
  }, [duration, showHud]);

  const handlePreviewTrimStart = useCallback(() => {
    handleSeek(trimStart);
  }, [handleSeek, trimStart]);

  const handlePreviewTrimEnd = useCallback(() => {
    handleSeek(trimEnd);
  }, [handleSeek, trimEnd]);

  const handleSaveTrim = useCallback(async () => {
    if (!video || isSavingTrim) return;
    const nextStart = clamp(trimStart, 0, duration);
    const nextEnd = clamp(trimEnd, nextStart, duration);

    if (nextEnd - nextStart < 1) {
      showHud("seek", "Trim must be at least 1s", 0.08);
      return;
    }

    setIsSavingTrim(true);
    try {
      // Ensure the output folder exists on device storage
      const trimFolder = `${RNFS.ExternalStorageDirectoryPath}/image/trimedvideo`;
      const folderExists = await RNFS.exists(trimFolder);
      if (!folderExists) {
        await RNFS.mkdir(trimFolder);
      }

      const savedClip = await saveTrimmedClip({
        video,
        clipStart: nextStart,
        clipEnd: nextEnd,
        title: trimTitle,
      });
      setTrimPanelVisible(false);
      showHud("seek", `Clip saved: ${savedClip.title}`, 1);
    } catch {
      Alert.alert("Trim Save Failed", "Unable to save this clip right now.");
    } finally {
      if (isMounted.current) {
        setIsSavingTrim(false);
      }
    }
  }, [
    duration,
    isSavingTrim,
    saveTrimmedClip,
    showHud,
    trimEnd,
    trimStart,
    trimTitle,
    video,
  ]);

  const handleToggleLockMode = useCallback(() => {
    if (!featureConfig.lockControlEnabled) {
      showHud("seek", "Lock control disabled", 0.1);
      return;
    }
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    setControlsVisible(true);
    if (nextLocked) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      gestureRef.current.mode = null;
      setActiveGestureMode(null);
      setUtilityRailExpanded(false);
      setQuickActionsExpanded(false);
      setPropertiesPanelVisible(false);
      setTrimPanelVisible(false);
    }
  }, [featureConfig.lockControlEnabled, isLocked, showHud]);

  const showLockedScreenAlert = useCallback(() => {
    return;
  }, []);

  const handleToggleNightMode = useCallback(() => {
    if (!featureConfig.nightModeEnabled) {
      showHud("seek", "Night mode disabled", 0.1);
      return;
    }
    const nextNightMode = !nightMode;
    setNightMode(nextNightMode);
    showBrightnessHud(nextNightMode ? 0.8 : brightnessLevel);
  }, [brightnessLevel, featureConfig.nightModeEnabled, nightMode, showBrightnessHud, showHud]);

  const handleToggleBackgroundPlay = useCallback(() => {
    const nextBackgroundPlay = !backgroundPlayRef.current;
    backgroundPlayRef.current = nextBackgroundPlay;
    void updateSettings({ backgroundPlay: nextBackgroundPlay });

    if (player) {
      applyPlayerAudioState(player, {
        volume: 1,
        volumeBoost,
        isMuted,
        backgroundPlay: nextBackgroundPlay,
      });

      if (nextBackgroundPlay) {
        setPlayerSession(player, videoId ?? loadedPlayerVideoId.current);
      } else {
        releasePlayerSession(player);
      }
    }

    showHud(
      "seek",
      nextBackgroundPlay ? "Background audio on" : "Background audio off",
      nextBackgroundPlay ? 1 : 0.18
    );
  }, [isMuted, player, showHud, updateSettings, videoId, volume, volumeBoost]);

  const handleCycleDecoderMode = useCallback(() => {
    if (!featureConfig.decoderSwitcherEnabled) {
      showHud("seek", "Decoder switcher disabled", 0.1);
      return;
    }
    if (isAudioMode) {
      showHud("seek", "Audio mode", 0.2);
      return;
    }

    const modes: DecoderMode[] = ["hwPlus", "hw", "sw"];
    const nextMode = modes[(modes.indexOf(decoderMode) + 1) % modes.length];
    setDecoderMode(nextMode);

    if (nextMode === "sw") {
      showHud("seek", "SW decoder not supported by this build", 0.2);
      return;
    }

    showHud(
      "seek",
      `${getDecoderModeLabel(nextMode)} decoder`,
      nextMode === "hwPlus" ? 1 : 0.65
    );
  }, [decoderMode, featureConfig.decoderSwitcherEnabled, isAudioMode, showHud]);

  const handleCycleVolumeBoost = useCallback(() => {
    if (!featureConfig.volumeBoostEnabled) {
      showHud("seek", "Volume boost disabled", 0.1);
      return;
    }
    const currentIndex = VOLUME_BOOST_LEVELS.indexOf(volumeBoost);
    const nextBoost = VOLUME_BOOST_LEVELS[(currentIndex + 1) % VOLUME_BOOST_LEVELS.length];
    setVolumeBoost(nextBoost);

    if (player) {
      applyPlayerAudioState(player, {
        volume: 1,
        volumeBoost: nextBoost,
        isMuted,
        backgroundPlay: settings.backgroundPlay,
      });
    }

    showVolumeHud(clamp01((volume * nextBoost) / 2));
  }, [featureConfig.volumeBoostEnabled, isMuted, player, settings.backgroundPlay, showHud, showVolumeHud, volume, volumeBoost]);

  // Audio button now opens a track list (AudioTrackBottomSheet) instead of
  // cycling through tracks one by one. Function name kept so the existing
  // <VideoPlayerControls onCycleAudioTrack={...}/> wire doesn't change.
  const handleCycleAudioTrack = useCallback(() => {
    if (!featureConfig.audioTrackSwitcherEnabled) {
      showHud("seek", "Audio track switcher disabled", 0.1);
      return;
    }
    if (audioTracks.length === 0) {
      showHud("seek", "No audio tracks", 0.15);
      return;
    }
    // Always open the sheet — even for a single track, users want to see
    // the language label and toggle the "Remember this language" preference.
    setAudioBottomSheetVisible(true);
  }, [audioTracks.length, featureConfig.audioTrackSwitcherEnabled, showHud]);

  const handleSelectAudioTrack = useCallback((index: number) => {
    setSelectedAudioTrackIndex(index);
    setAudioBottomSheetVisible(false);
    // Phase 8: persist the user's manual track choice into the session.
    // commitSessionPatch is throttled (500ms) — fine here because the user
    // doesn't switch audio multiple times per second. The next load of this
    // video (route resume or DB resume) will pick up the saved index.
    if (videoId) {
      commitSessionPatch({ videoId, audioTrackIndex: index });
    }
  }, [videoId]);

  // Tracks which videoId has already had its "preferred audio language"
  // auto-apply attempted, so that subsequent onAudioTracks emissions for
  // the same video do not override the user's manual selection.
  const appliedPreferenceForVideoIdRef = useRef<string | null>(null);

  // Reset the per-video guard when the video changes.
  useEffect(() => {
    appliedPreferenceForVideoIdRef.current = null;
  }, [videoId]);

  /**
   * Apply the saved preferred-audio-language to a freshly-emitted track list.
   * Only runs once per videoId. Matches by normalised BCP-47 base code so
   * "ta" picks "tam" / "ta-IN" / "Tamil" alike.
   */
  const applyPreferredAudioLanguage = useCallback(async (
    forVideoId: string,
    tracks: PlayerAudioTrack[],
  ) => {
    if (appliedPreferenceForVideoIdRef.current === forVideoId) return;
    appliedPreferenceForVideoIdRef.current = forVideoId;
    if (tracks.length < 2) return; // nothing to switch
    try {
      const pref = await loadPreferredAudio();
      if (!pref.enabled || !pref.language) return;
      const target = pref.language.split(/[-_]/)[0].toLowerCase();
      const match = tracks.find(
        (t) => (t.language ?? '').split(/[-_]/)[0].toLowerCase() === target
      );
      if (match) {
        setSelectedAudioTrackIndex(match.index);
        if (__DEV__) {
          console.log(`[Player] audio_pref_applied lang=${match.language} idx=${match.index}`);
        }
      }
    } catch (e) {
      console.warn('applyPreferredAudioLanguage failed', e);
    }
  }, []);

  /**
   * Wired to <Video onAudioTracks>. ExoPlayer can emit this *after* onLoad
   * (e.g. when an MKV's tracks settle post-PREPARED). We replace the list,
   * preserve the user's selection (by language first, index second), and
   * attempt the auto-preference on first emission per video.
   */
  const handleAudioTracksUpdate = useCallback((data: { audioTracks?: PlayerAudioTrack[] }) => {
    const next = data?.audioTracks ?? [];
    if (next.length === 0) return;

    // Preserve user selection across updates.
    setAudioTracks(next);
    setSelectedAudioTrackIndex((prevIdx) => {
      if (prevIdx === null) {
        // Restore the user's last-chosen track for this video if it still
        // exists (covers the Fast path, which selects via this callback).
        const savedAudioIndex = videoId ? peekSessionState(videoId)?.audioTrackIndex ?? null : null;
        if (savedAudioIndex !== null && next.some((t) => t.index === savedAudioIndex)) {
          return savedAudioIndex;
        }
        const nativeSelected = next.find((t) => t.selected);
        return nativeSelected?.index ?? next[0].index;
      }
      // Try to keep the same track. Match by language first (decoder remounts
      // can shuffle indices), then fall back to the same index if still present.
      const prevTrack = audioTracksRef.current.find((t) => t.index === prevIdx);
      if (prevTrack?.language) {
        const byLang = next.find((t) => t.language === prevTrack.language);
        if (byLang) return byLang.index;
      }
      const sameIdx = next.find((t) => t.index === prevIdx);
      return sameIdx ? prevIdx : (next.find((t) => t.selected)?.index ?? next[0].index);
    });

    if (__DEV__) {
      const languages = next.map((t) => t.language ?? '?').join(',');
      console.log(`[Player] audio_tracks_updated count=${next.length} langs=${languages}`);
    }

    if (videoId) {
      void applyPreferredAudioLanguage(videoId, next);
    }
  }, [applyPreferredAudioLanguage, videoId]);

  // Open the subtitle bottom sheet. The actual generation / track selection
  // logic lives in SubtitleBottomSheet + useSubtitleGeneration.
  const handleSubtitlesAction = useCallback(() => {
    if (!featureConfig.subtitleSwitcherEnabled) {
      showHud("seek", "Subtitle controls disabled", 0.1);
      return;
    }
    setSubtitleBottomSheetVisible(true);
  }, [featureConfig.subtitleSwitcherEnabled, showHud]);

  // Drive the quick-action chip from the subtitle store.
  const subtitleJob = usePlayerStore((s) => s.subtitleJob);
  const subtitlesEnabled = usePlayerStore((s) => s.subtitlesEnabled);
  const subtitlesChipStatus: 'off' | 'generating' | 'ready' | 'error' = useMemo(() => {
    if (subtitleJob && subtitleJob.status === 'error') return 'error';
    if (subtitleJob && subtitleJob.status !== 'complete' && subtitleJob.status !== 'cancelled') {
      return 'generating';
    }
    return subtitlesEnabled ? 'ready' : 'off';
  }, [subtitleJob, subtitlesEnabled]);
  const subtitlesChipProgress = subtitleJob?.progress ?? 0;

  // Refresh cached subtitle tracks whenever the video source changes.
  useEffect(() => {
    const uri = validatedPlaybackUri ?? undefined;
    if (uri) {
      void reloadSubtitleTracks(uri);
    }
    subtitleOverlayRef.current?.invalidate();
  }, [validatedPlaybackUri, reloadSubtitleTracks]);

  const handleCycleOrientation = useCallback(() => {
    if (!featureConfig.orientationControlEnabled) {
      showHud("seek", "Orientation control disabled", 0.1);
      return;
    }
    if (isAudioMode) {
      showHud("seek", "Audio mode", 0.2);
      return;
    }

    const modes: ("default" | "landscape" | "portrait")[] = [
      "default",
      "landscape",
      "portrait",
    ];
    const currentIndex = modes.indexOf(orientationMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setOrientationMode(nextMode);
    showHud(
      "seek",
      nextMode === "default"
        ? "Auto rotate"
        : nextMode === "landscape"
          ? "Landscape lock"
          : "Portrait lock",
      nextMode === "default" ? 0.33 : nextMode === "landscape" ? 0.66 : 1
    );
  }, [featureConfig.orientationControlEnabled, isAudioMode, orientationMode, showHud]);

  const handleSetForcedAspectRatio = useCallback((ratio: string | null) => {
    setForcedAspectRatio(ratio);
    showHud("seek", ratio ? `Aspect ratio ${ratio}` : "Auto aspect ratio", 0.5);
  }, [showHud]);

  const handleCancelAutoPlay = useCallback(() => {
    if (autoPlayCountdownTimerRef.current) {
      clearInterval(autoPlayCountdownTimerRef.current);
      autoPlayCountdownTimerRef.current = null;
    }
    setAutoPlayTarget(null);
    setAutoPlayCountdown(null);
  }, []);

  const handleLongPressStart = useCallback(() => {
    if (!featureConfig.longPressSpeedEnabled) return;
    if (!player || isLocked) return;
    longPressStartSpeedRef.current = speed;
    setLongPressActive(true);
    setSpeed(2);
    if (player) player.playbackRate = 2;
    showHud("seek", "2× Speed", 1);
  }, [featureConfig.longPressSpeedEnabled, player, isLocked, speed, showHud]);

  const handleLongPressEnd = useCallback(() => {
    if (!longPressActive) return;

    // Clear any pending long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const restoreSpeed = longPressStartSpeedRef.current;
    setLongPressActive(false);
    setSpeed(restoreSpeed);
    if (player) player.playbackRate = restoreSpeed;
    showHud("seek", `${restoreSpeed}× Speed`, restoreSpeed / 2);
  }, [longPressActive, player, showHud]);

  const handleScreenshot = useCallback(async () => {
    if (!featureConfig.screenshotEnabled) {
      showHud("seek", "Screenshots disabled in settings", 0.1);
      return;
    }
    if (!player) return;
    if (isAudioMode) {
      showHud("seek", "Screenshots only work for video", 0.12);
      return;
    }
    if (Platform.OS === "web") {
      showHud("seek", "Screenshot preview unavailable on web", 0.2);
      return;
    }

    try {
      const sourceUri = validatedPlaybackUri ?? playbackUri;
      if (!sourceUri) {
        showHud("seek", "Video source unavailable", 0.1);
        return;
      }

      const absoluteTimeSeconds = Number.isFinite(player.currentTime)
        ? player.currentTime
        : getAbsolutePlaybackPosition(video, position, sourceDuration || duration || 0);
      const generated = await createThumbnail({
        url: sourceUri,
        timeStamp: Math.max(absoluteTimeSeconds, 0) * 1000,
        format: "jpeg",
        maxWidth: 720,
      });
      const frameUri = generated.path;
      if (!frameUri) {
        showHud("seek", "Screenshot capture failed", 0.1);
        return;
      }

      showScreenshotPreview({ uri: frameUri });
      setControlsVisible(true);
      showHud("seek", "Shot captured", 0.85);
    } catch {
      showHud("seek", "Screenshot capture failed", 0.1);
    }
  }, [
    duration,
    featureConfig.screenshotEnabled,
    isAudioMode,
    playbackUri,
    player,
    position,
    showHud,
    showScreenshotPreview,
    sourceDuration,
    validatedPlaybackUri,
    video,
  ]);




  // Keep the stable ref in sync so the countdown effect can call this safely
  navigateToVideoRef.current = handleNavigateToVideo;

  const handlePrev = useCallback(() => {
    if (!previousVideo) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    handleNavigateToVideo(previousVideo, "prev");
  }, [handleNavigateToVideo, previousVideo]);

  const handleNext = useCallback(() => {
    const target = nextVideo ?? (loopMode === "all" && videoQueueRef.current.length > 1 ? videoQueueRef.current[0] : null);
    if (!target) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: false });
    }
    handleNavigateToVideo(target, "next");
  }, [handleNavigateToVideo, loopMode, nextVideo]);

  useSafeTrackPlayerEvents([Event.RemoteNext, Event.RemotePrevious, Event.RemotePlay, Event.RemotePause, Event.PlaybackQueueEnded], (event: any) => {
    try {
      if (event.type === Event.RemoteNext) {
        if (nextVideo) handleNavigateToVideo(nextVideo, "next");
      } else if (event.type === Event.RemotePrevious) {
        if (previousVideo) handleNavigateToVideo(previousVideo, "prev");
      } else if (event.type === Event.RemotePlay) {
        if (player) {
          setIsPlaying(true);
        }
      } else if (event.type === Event.RemotePause) {
        if (player) {
          saveProgressOnStop('remote_pause_headset_or_notification');
          player.pause();
          setIsPlaying(false);
        }
      } else if (event.type === Event.PlaybackQueueEnded && settings.backgroundPlay) {
        // Background auto-play next track
        if (nextVideo) handleNavigateToVideo(nextVideo, "next");
      }
    } catch (e) {
      console.error("Remote event handling failed:", e);
    }
  });

  // When background video play is active, register queue with TrackPlayer so
  // the notification shows title/artwork and prev/next controls work.
  useEffect(() => {
    if (!settings.backgroundPlay || isAudioMode || !isTrackPlayerAvailable || !video) return;
    if (isAudioPlayInFlight()) return;
    const tracks = videoQueue.map(videoItemToTrack);
    const targetIndex = Math.max(0, currentIndex);
    TrackPlayer.setQueue(tracks)
      .then(() => TrackPlayer.skip(targetIndex))
      .catch(() => { /* non-critical if audio session conflicts */ });
  }, [settings.backgroundPlay, isAudioMode, video, videoQueue, currentIndex]);

  const handlePickUpcomingVideo = useCallback(
    (targetVideo: typeof video) => {
      if (!targetVideo || !videoId) return;
      if (Platform.OS !== "web") {
        ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
      }
      const targetIndex = videoQueue.findIndex((item) => item.id === targetVideo.id);
      const direction =
        targetIndex >= currentIndex ? ("next" as const) : ("prev" as const);
      handleNavigateToVideo(targetVideo, direction);
    },
    [currentIndex, handleNavigateToVideo, videoId, videoQueue]
  );

  useEffect(() => {
    if (!utilityRailExpanded) return;

    setUpNextVisibleCount(Math.max(UP_NEXT_PAGE_SIZE + 1, currentIndex + 1, 1));
    setUpNextLandscapePage(defaultUpNextLandscapePage);
  }, [
    currentIndex,
    defaultUpNextLandscapePage,
    isLandscapeLayout,
    utilityRailExpanded,
  ]);

  useEffect(() => {
    if (!utilityRailExpanded || !queueListRef.current) return;

    const timer = setTimeout(() => {
      if (isLandscapeLayout) {
        queueListRef.current?.scrollToOffset({ offset: 0, animated: false });
        return;
      }

      if (currentIndex >= 0 && currentIndex < queueVideos.length) {
        queueListRef.current?.scrollToIndex({
          index: currentIndex,
          animated: false,
          viewPosition: currentIndex > 0 ? 0.18 : 0,
        });
        return;
      }

      queueListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 40);

    return () => clearTimeout(timer);
  }, [
    activeUpNextLandscapePage,
    currentIndex,
    isLandscapeLayout,
    queueVideos.length,
    utilityRailExpanded,
  ]);

  const handleScrollUpNextPrev = useCallback(() => {
    if (!canScrollUpNextPrev) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: false });
    }
    setUpNextLandscapePage((current) => Math.max(current - 1, 0));
    setControlsVisible(true);
  }, [canScrollUpNextPrev]);

  const handleScrollUpNextNext = useCallback(() => {
    if (!canScrollUpNextNext) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: false });
    }
    setUpNextLandscapePage((current) =>
      Math.min(current + 1, Math.max(landscapeUpNextPageCount - 1, 0))
    );
    setControlsVisible(true);
  }, [canScrollUpNextNext, landscapeUpNextPageCount]);

  const renderUpNextItem = useCallback(
    ({
      item,
      index,
    }: {
      item: (typeof queueVideos)[number];
      index: number;
    }) => {
      const absoluteIndex = queueStartIndex + index;
      const isActive = item.id === videoId;

      return (
        <Pressable
          onPress={() => handlePickUpcomingVideo(item)}
          style={({ pressed }) => [
            styles.upNextItem,
            isActive ? styles.upNextItemActive : null,
            pressed ? styles.upNextItemPressed : null,
          ]}
          disabled={isActive}
        >
          <View style={styles.upNextIndex}>
            <Text style={styles.upNextIndexText}>{absoluteIndex + 1}</Text>
          </View>
          <View style={styles.upNextTextBlock}>
            <Text style={styles.upNextItemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.upNextItemMeta} numberOfLines={1}>
              {isActive ? "Now Playing" : item.folder || "Unknown folder"}  |  {formatDuration(item.duration)}
            </Text>
          </View>
        </Pressable>
      );
    },
    [handlePickUpcomingVideo, queueStartIndex, videoId]
  );

  const handleClose = useCallback(() => {
    if (isLocked) {
      showLockedScreenAlert();
      return;
    }
    exitingPlayerRef.current = true;
    autoPlayIntentRef.current = false;
    if (!player) {
      navigation.goBack();
      return;
    }
    if (settings.backgroundPlay && isTrackPlayerAvailable && player.playing) {
      saveProgressOnStop('close_background_handoff');
      const { queue, index } = buildHandoffQueue(videoQueue, video, playbackUri, currentIndex);
      const handoffPosition = player.currentTime;
      audioHandoffInProgressRef.current = true;
      void (async () => {
        try {
          // Start audio at the live position and confirm it's playing before
          // pausing the video, so a setup race can't leave a dead session.
          await playAudio(queue, index, { startPosition: handoffPosition });
          await TrackPlayer.seekTo(handoffPosition).catch(() => undefined);
          await TrackPlayer.play().catch(() => undefined);
          player.pause();
        } catch {
          // Fallback to local pause behavior when TrackPlayer handoff fails.
        } finally {
          audioHandoffInProgressRef.current = false;
        }
      })();
    } else {
      if (!settings.backgroundPlay) {
        player.pause();
      }
      // Flush the position write before leaving so a quick close can't drop it.
      saveProgressThenLeave('close_player', () => navigation.goBack());
      return;
    }
    navigation.goBack();
  }, [
    currentIndex,
    isLocked,
    playbackUri,
    playAudio,
    player,
    saveProgressOnStop,
    saveProgressThenLeave,
    settings.backgroundPlay,
    showLockedScreenAlert,
    video,
    videoQueue,
  ]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isLocked) {
        showLockedScreenAlert();
        return true;
      }
      if (propertiesPanelVisible) {
        setPropertiesPanelVisible(false);
        return true;
      }
      if (trimPanelVisible) {
        setTrimPanelVisible(false);
        return true;
      }
      if (quickActionsExpanded) {
        setQuickActionsExpanded(false);
        return true;
      }
      if (utilityRailExpanded) {
        setUtilityRailExpanded(false);
        return true;
      }
      handleClose();
      return true;
    });

    return () => subscription.remove();
  }, [
    handleClose,
    isLocked,
    propertiesPanelVisible,
    quickActionsExpanded,
    showLockedScreenAlert,
    trimPanelVisible,
    utilityRailExpanded,
  ]);

  // Latest-value snapshot for the 250ms polling loop. The interval body reads
  // every volatile value/callback through this ref instead of closing over
  // them, so the effect can depend only on [player] and the interval is no
  // longer torn down + rebuilt on every render (position tick, scrub, phase
  // change, etc.). Assigned during render so the timer always reads the most
  // recently committed values. Behavior is unchanged — only the *source* of
  // the values differs (ref vs closure).
  const pollStateRef = useRef<any>({});
  // Refresh the snapshot after every commit so the timer reads the most
  // recently committed values without re-creating the interval.
  useEffect(() => {
    pollStateRef.current = {
      video,
      videoId,
      settings,
      isPlaying,
      seekPreviewPosition,
      playbackStartupError,
      clipEndPosition,
      clipStartOffset,
      nextVideo,
      handleNavigateToVideo,
      isPlaybackHealthy,
      getRecoveryLogFields,
      runStartupRecovery,
      saveProgressThenLeave,
      confirmStartupPlayback,
      resetRecoveryAttempts,
      clearReleasedPlayer,
      updateLastPosition,
      clearPlaybackProgress,
      performClassifiedRecovery,
      playbackLogContext,
      setPlaybackPhase,
      buildPlaybackHealthSnapshot,
      navigation,
    };
  });

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (!isMounted.current) return;

      // Pull the latest volatile values/callbacks. Destructured with the same
      // names so the body below is identical to the closure-captured version.
      const {
        video,
        videoId,
        settings,
        isPlaying,
        seekPreviewPosition,
        playbackStartupError,
        clipEndPosition,
        clipStartOffset,
        nextVideo,
        handleNavigateToVideo,
        isPlaybackHealthy,
        getRecoveryLogFields,
        runStartupRecovery,
        saveProgressThenLeave,
        confirmStartupPlayback,
        resetRecoveryAttempts,
        clearReleasedPlayer,
        updateLastPosition,
        clearPlaybackProgress,
        performClassifiedRecovery,
        playbackLogContext,
        setPlaybackPhase,
        buildPlaybackHealthSnapshot,
        navigation,
      } = pollStateRef.current;

      try {
        const previousPosition = latestPlaybackRef.current.position;
        const nextAbsolutePosition = Number.isFinite(player.currentTime)
          ? player.currentTime
          : 0;
        const nextSourceDuration = Number.isFinite(player.duration) ? player.duration : 0;
        const nextDuration = getPlayableDuration(
          video,
          nextSourceDuration || video?.duration || 0
        );
        const nextPosition = getRelativePlaybackPosition(
          video,
          nextAbsolutePosition,
          nextSourceDuration || video?.duration || 0
        );
        const nextIsPlaying = player.playing;
        latestPlaybackRef.current = {
          absolutePosition: nextAbsolutePosition,
          position: nextPosition,
          duration: nextDuration,
          sourceDuration: nextSourceDuration,
        };

        // Periodic position save during steady playback — crash/OS-kill
        // resilience. Throttled to PERIODIC_SAVE_INTERVAL_MS and gated on a
        // ≥1s position change so we never hammer the single-connection DB.
        // savePlaybackProgress already enforces the 15s-min / 95%-complete
        // resume thresholds, so sub-15s positions won't persist a resume row.
        if (
          settings.rememberPosition &&
          videoId &&
          nextIsPlaying &&
          nextDuration > 0 &&
          Number.isFinite(nextPosition) &&
          nextPosition > 0 &&
          Date.now() - lastPeriodicSaveAtRef.current >= PERIODIC_SAVE_INTERVAL_MS &&
          Math.abs(nextPosition - lastSavedPosition.current) >= 1
        ) {
          lastPeriodicSaveAtRef.current = Date.now();
          lastSavedPosition.current = nextPosition;
          void updateLastPosition(videoId, nextPosition, nextDuration);
          void saveSessionState({ videoId, position: nextPosition, duration: nextDuration });
        }

        if (Number.isFinite(nextPosition) && nextPosition > previousPosition + PROGRESS_ADVANCE_SECONDS) {
          const now = Date.now();
          lastProgressAtRef.current = now;
          lastProgressPosRef.current = nextAbsolutePosition;
          lastHealthyAtRef.current = now;
          resetRecoveryAttempts();
          const recoveredByProgress =
            lastRecoveryClassRef.current !== "unknown" || lastRecoveryActionRef.current !== null;
          const recoveryReasonForLog = lastRecoveryClassRef.current;
          lastRecoveryClassRef.current = "unknown";
          lastRecoveryActionRef.current = null;
          consecutiveSurfaceLostRef.current = 0;
          if (recoveredByProgress) {
            logRecovery(playbackLogContext(), "recovery_progress_resumed", {
              ...getRecoveryLogFields("progress_resumed", {
                failureReason: recoveryReasonForLog,
                startupPath: isStartupRecoveryPhase(playbackPhaseRef.current),
              }),
            });
          }

          const phase = playbackPhaseRef.current;
          if (startupStableConfirmedRef.current && (phase === "recovering" || phase === "buffering")) {
            setPlaybackPhase("playing", "progress_recovered");
            logRecovery(playbackLogContext(), "recovered", getRecoveryLogFields("progress_recovered"));
          } else if (phase === "starting" || phase === "loading") {
            stabilizationStartedAtRef.current = stabilizationStartedAtRef.current || now;
            stabilizationStartPositionRef.current = nextAbsolutePosition;
            startupAnalyticsRef.current.stabilizationStartedAt =
              startupAnalyticsRef.current.stabilizationStartedAt || now;
            setPlaybackPhase("stabilizing", "progress_advanced");
          } else if (phase === "stabilizing" && shouldConfirmStartupStable({
            currentTime: nextAbsolutePosition,
            stabilizationStartPosition: stabilizationStartPositionRef.current,
            stabilizationStartedAt: stabilizationStartedAtRef.current || now,
            now,
          })) {
            setPlaybackPhase("playing", "startup_stable");
            confirmStartupPlayback();
          }
        }

        if (
          startupWatchdogTimerRef.current &&
          nextPosition > startupWatchdogPositionRef.current + 0.2
        ) {
          const now = Date.now();
          if (playbackPhaseRef.current !== "stabilizing" && playbackPhaseRef.current !== "playing") {
            stabilizationStartedAtRef.current = stabilizationStartedAtRef.current || now;
            stabilizationStartPositionRef.current = startupWatchdogPositionRef.current;
            startupAnalyticsRef.current.stabilizationStartedAt =
              startupAnalyticsRef.current.stabilizationStartedAt || now;
            setPlaybackPhase("stabilizing", "progress_advanced");
          } else if (playbackPhaseRef.current === "stabilizing" && shouldConfirmStartupStable({
            currentTime: nextAbsolutePosition,
            stabilizationStartPosition: stabilizationStartPositionRef.current,
            stabilizationStartedAt: stabilizationStartedAtRef.current || now,
            now,
          })) {
            setPlaybackPhase("playing", "startup_stable");
            confirmStartupPlayback();
          }
        }

        // Throttle UI updates to whole-second granularity (and only when a
        // value actually changes) to avoid re-rendering the whole player 4×/sec.
        if (seekPreviewPosition === null) {
          const nextSecond = Math.floor(nextPosition);
          if (nextSecond !== lastUiSecondRef.current) {
            lastUiSecondRef.current = nextSecond;
            setPosition(nextPosition);
          }
        }
        if (nextDuration !== lastUiDurationRef.current) {
          lastUiDurationRef.current = nextDuration;
          setDuration(nextDuration);
        }
        if (nextSourceDuration !== lastUiSourceDurationRef.current) {
          lastUiSourceDurationRef.current = nextSourceDuration;
          setSourceDuration(nextSourceDuration);
        }

        // Do NOT override isPlaying from the shim's polling state.
        // The shim's `_playing` flag is unreliable (stale on startup, may not reflect
        // native player). Let intentional actions control isPlaying:
        //   - handlePlayPause for user pause/play
        //   - onEnd for natural end of video
        //   - autoplay/resume effects for initial start
        // The polling interval only updates position/duration; nextIsPlaying is still
        // used below for end-of-video detection together with sourceReachedEnd.

        // Health-based stall detection. Replaces the old "frozen position +
        // last-ack timer" mess. isPlaybackHealthy() consults every signal
        // (progress, buffering, startup grace, recent recovery, native ack);
        // we only escalate when nothing has shown the player to be healthy
        // for STALL_TIMEOUT_MS straight AND we're past startup grace AND
        // recovery isn't already in cooldown.
        //
        // Phase 6: the legacy detector and the Fast detector are mutually
        // exclusive — only ONE runs per poll cycle. Both writing to
        // lastRecoveryAtRef / triggering recovery would race and double-count
        // stalls in the analytics counter. Flip FAST_STARTUP_ENABLED to false
        // to fall back to the legacy detector.
        if (!FAST_STARTUP_ENABLED) {
          if (
            isPlaying &&
            autoPlayIntentRef.current &&
            !playbackStartupError &&
            pendingSeekAbsoluteRef.current === null &&
            !audioHandoffInProgressRef.current &&
            !exitingPlayerRef.current
          ) {
            if (!isPlaybackHealthy()) {
              const now = Date.now();
              const stalledFor = now - lastHealthyAtRef.current;
              if (stalledFor > STALL_TIMEOUT_MS &&
                  now - lastRecoveryAtRef.current >= RECOVERY_COOLDOWN_MS) {
                startupAnalyticsRef.current.stallCount += 1;
                const failureReason = classifyPlaybackFailure(buildPlaybackHealthSnapshot());
                const phase = playbackPhaseRef.current;
                const startupRecoveryState =
                  phase === "starting" || phase === "stabilizing"
                    ? phase
                    : phase === "recovering" && !startupStableConfirmedRef.current
                      ? "stabilizing"
                      : null;
                if (startupRecoveryState && shouldRunStartupRecovery({
                  state: startupRecoveryState,
                  failureReason,
                  recoveryCount: startupRecoveryCountRef.current,
                  maxRecoveryCount: 4,
                })) {
                  logRecovery(playbackLogContext(), "startup_timeout", {
                    ...getRecoveryLogFields("startup_timeout", {
                      failureReason,
                      startupPath: true,
                    }),
                    stalledForSeconds: Number((stalledFor / 1000).toFixed(1)),
                  });
                  runStartupRecovery(failureReason);
                  return;
                }
                logRecovery(playbackLogContext(), "stall_candidate", {
                  ...getRecoveryLogFields("real_stall", {
                    failureReason,
                    startupPath: false,
                  }),
                  stalledForSeconds: Number((stalledFor / 1000).toFixed(1)),
                  stallCount: startupAnalyticsRef.current.stallCount,
                });
                performClassifiedRecovery(failureReason);
              }
            }
          }
        } else {
          // Fast path stall detection now uses the same health snapshot and
          // classifier as the legacy path so startup and steady-state recovery
          // decisions cannot drift apart.
          //
          // Phase 7: gate on playbackPhase. The legacy detector implicitly
          // ran during startup phases because isPlaybackHealthy returned
          // true during the startup grace; the Fast variant relies on
          // explicit phase eligibility instead so a stuck phase (e.g.
          // 'idle' due to a missed transition) cannot trigger spurious
          // recoveries during prepare/load.
          const fastPhase = playbackPhaseRef.current;
          const stallEligible =
            fastPhase === 'playing' ||
            fastPhase === 'stabilizing' ||
            fastPhase === 'recovering';
          if (
            stallEligible &&
            isPlaying &&
            autoPlayIntentRef.current &&
            !playbackStartupError &&
            pendingSeekAbsoluteRef.current === null &&
            !audioHandoffInProgressRef.current &&
            !exitingPlayerRef.current
          ) {
            if (!isPlaybackHealthy()) {
              const now = Date.now();
              const stalledFor = now - lastHealthyAtRef.current;
              if (
                stalledFor > STALL_TIMEOUT_MS &&
                now - lastRecoveryAtRef.current >= RECOVERY_COOLDOWN_MS
              ) {
                startupAnalyticsRef.current.stallCount += 1;
                const failureReason = classifyPlaybackFailure(buildPlaybackHealthSnapshot());
                logRecovery(playbackLogContext(), "stall_candidate", {
                  ...getRecoveryLogFields("fast_stall", {
                    failureReason,
                    startupPath: isStartupRecoveryPhase(fastPhase),
                  }),
                  stalledForSeconds: Number((stalledFor / 1000).toFixed(1)),
                  stallCount: startupAnalyticsRef.current.stallCount,
                  fastPath: true,
                });
                performClassifiedRecovery(failureReason);
              }
            }
          }
        }

        const clipReachedEnd =
          clipEndPosition !== null &&
          nextAbsolutePosition >= Math.max(clipEndPosition - 0.2, clipStartOffset);
        const sourceReachedEnd =
          clipEndPosition === null &&
          nextSourceDuration > 0 &&
          nextAbsolutePosition >= Math.max(nextSourceDuration - 0.35, 0);

        if (video?.isClip && clipReachedEnd && (settings.loopMode === "one" || (settings.loopMode === "all" && videoQueueRef.current.length <= 1))) {
          player.currentTime = clipStartOffset;
          setPosition(0);
          setIsPlaying(true);
          completionHandledVideoId.current = null;
          wasPlayingRef.current = true;
          return;
        }

        if (
          videoId &&
          (clipReachedEnd || (wasPlayingRef.current && !nextIsPlaying && sourceReachedEnd)) &&
          completionHandledVideoId.current !== videoId &&
          !autoPlayCountdownActiveRef.current
        ) {
          completionHandledVideoId.current = videoId;
          lastSavedPosition.current = 0;

          if (settings.rememberPosition) {
            void clearPlaybackProgress(videoId);
          }

          const loopFirstVideo = settings.loopMode === "all" && videoQueueRef.current.length > 1
            ? videoQueueRef.current[0]
            : null;
          const advanceTarget = nextVideo ?? loopFirstVideo;
          if (advanceTarget) {
            handleNavigateToVideo(advanceTarget, "next");
          } else if (settings.loopMode !== "one" && settings.loopMode !== "all") {
            player.pause();
            saveProgressThenLeave(
              `polling_end_detected (pos=${nextAbsolutePosition.toFixed(1)} dur=${nextSourceDuration.toFixed(1)})`,
              () => navigation.goBack(),
            );
          }
        }

        wasPlayingRef.current = nextIsPlaying;
      } catch (pollingErr) {
        console.error('[PlaybackStop] polling_interval_crash:', pollingErr);
        clearReleasedPlayer(player);
        // Ignore transient player read errors while the source is mounting.
      }
    }, 250);

    return () => clearInterval(interval);
    // Depends only on `player`: all other values/callbacks the body needs are
    // read from pollStateRef.current (assigned every render above), so the
    // interval is created once per player instance instead of rebuilt on every
    // render. See the pollStateRef comment for the full list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // ── Phase 5: Main video gesture (gesture-handler v2 composed) ──
  // Captures start state at onBegin, activates seek (horizontal) or vertical
  // (brightness/volume by edge) via Exclusive race; tap is a separate Race.

  const beginVideoGesture = useCallback((startX: number) => {
    if (isScrubbingRef.current) return;
    gestureRef.current = {
      mode: null,
      startX,
      startPosition: seekPreviewPositionRef.current ?? position,
      startVolume: volume,
      startBrightness: brightnessLevel,
    };
  }, [position, volume, brightnessLevel]);

  const updateSeekGesture = useCallback((translationX: number) => {
    if (isScrubbingRef.current || !video || duration <= 0) return;
    if (gestureRef.current.mode !== "seek") {
      gestureRef.current.mode = "seek";
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    const pixelsPerSecond = effectiveViewportWidth / duration;
    const seekDelta = translationX / pixelsPerSecond;
    const nextPosition = clamp(gestureRef.current.startPosition + seekDelta, 0, duration);
    const seekAmount = Math.round(seekDelta);
    const direction = seekDelta >= 0 ? "forward" : "rewind";
    const label = seekAmount >= 0 ? `+${seekAmount}s` : `${seekAmount}s`;
    seekPreviewPositionRef.current = nextPosition;
    setSeekPreviewPosition(nextPosition);
    showHud("seek", label, duration > 0 ? nextPosition / duration : 0, direction);
  }, [video, duration, effectiveViewportWidth, showHud]);

  const endSeekGesture = useCallback((translationX: number) => {
    if (gestureRef.current.mode !== "seek" || duration <= 0) return;
    const pixelsPerSecond = effectiveViewportWidth / duration;
    const seekDelta = translationX / pixelsPerSecond;
    const finalPosition = clamp(gestureRef.current.startPosition + seekDelta, 0, duration);
    handleSeek(finalPosition);
    gestureRef.current.mode = null;
  }, [duration, effectiveViewportWidth, handleSeek]);

  const updateVerticalGesture = useCallback((translationY: number) => {
    if (isScrubbingRef.current) return;
    const g = gestureRef.current;

    // Lock mode on first move based on MX-style halves.
    if (!g.mode) {
      const isLeftHalf = g.startX < effectiveViewportWidth / 2;
      if (!isAudioMode && isLeftHalf && settings.swipeBrightness) {
        g.mode = "brightness";
        if (gestureBarHideRef.current) clearTimeout(gestureBarHideRef.current);
        setActiveGestureMode("brightness");
        ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
        prevBrightnessPercentRef.current = Math.round(g.startBrightness * 10);
      } else if ((isAudioMode || !isLeftHalf) && settings.swipeVolume) {
        g.mode = "volume";
        if (gestureBarHideRef.current) clearTimeout(gestureBarHideRef.current);
        setActiveGestureMode("volume");
        ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
        prevVolumePercentRef.current = Math.round(g.startVolume * 10);
      } else {
        return;
      }
    }

    if (g.mode === "volume") {
      const nextVolume = resolveSteppedVerticalGestureValue(
        g.startVolume,
        translationY,
        effectiveViewportHeight
      );
      handleSetVolume(nextVolume);
    } else if (g.mode === "brightness") {
      const nextBrightness = resolveSteppedVerticalGestureValue(
        g.startBrightness,
        translationY,
        effectiveViewportHeight
      );
      handleSetBrightness(nextBrightness);
    }
  }, [effectiveViewportWidth, effectiveViewportHeight, isAudioMode, settings.swipeBrightness, settings.swipeVolume, handleSetVolume, handleSetBrightness]);

  const endVerticalGesture = useCallback(() => {
    if (gestureRef.current.mode === "volume" || gestureRef.current.mode === "brightness") {
      if (gestureBarHideRef.current) clearTimeout(gestureBarHideRef.current);
      gestureBarHideRef.current = setTimeout(() => setActiveGestureMode(null), 800);
    }
    gestureRef.current.mode = null;
  }, []);

  const handlePanUpdate = useCallback((translationX: number, translationY: number) => {
    if (isScrubbingRef.current) return;
    const g = gestureRef.current;
    if (g.mode === null) {
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);
      // Tightened axis locking: requires 3x difference to activate a mode
      if (absX > GESTURE_ACTIVATION_DISTANCE && absX > absY * 3.0) {
        updateSeekGesture(translationX);
      } else if (absY > GESTURE_ACTIVATION_DISTANCE && absY > absX * 3.0) {
        updateVerticalGesture(translationY);
      }
    } else if (g.mode === "seek") {
      updateSeekGesture(translationX);
    } else if (g.mode === "volume" || g.mode === "brightness") {
      updateVerticalGesture(translationY);
    }
  }, [updateSeekGesture, updateVerticalGesture]);

  const handlePanEnd = useCallback((translationX: number) => {
    const mode = gestureRef.current.mode;
    if (mode === "seek") {
      endSeekGesture(translationX);
    } else if (mode === "volume" || mode === "brightness") {
      endVerticalGesture();
    }
  }, [endSeekGesture, endVerticalGesture]);

  const handleVideoAreaDoubleTap = useCallback((x: number) => {
    if (isLocked) return;
    if (!featureConfig.doubleTapSeekEnabled) {
      toggleControls();
      return;
    }
    const zone = getTapZone(x);
    if (zone === "left") {
      handleSeekBackward();
    } else if (zone === "right") {
      handleSeekForward();
    } else {
      toggleControls();
    }
  }, [featureConfig.doubleTapSeekEnabled, isLocked, getTapZone, handleSeekBackward, handleSeekForward, toggleControls]);

  const handleSingleTapEvent = useCallback((x: number, y: number) => {
    if (isScrubbingRef.current || isLocked) return;
    handleTap({ nativeEvent: { locationX: x, locationY: y } } as any);
  }, [isLocked, handleTap]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isLocked)
        .onBegin((e) => runOnJS(beginVideoGesture)(e.x))
        .onUpdate((e) => {
          'worklet';
          runOnJS(handlePanUpdate)(e.translationX, e.translationY);
        })
        .onEnd((e) => {
          'worklet';
          runOnJS(handlePanEnd)(e.translationX);
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(endVerticalGesture)();
        }),
    [isLocked, beginVideoGesture, handlePanUpdate, handlePanEnd, endVerticalGesture]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .enabled(!isLocked)
        .onEnd((e) => runOnJS(handleSingleTapEvent)(e.x, e.y)),
    [isLocked, handleSingleTapEvent]
  );

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(DOUBLE_TAP_CHAIN_TIMEOUT_MS)
        .maxDuration(250)
        .enabled(!isLocked)
        .onEnd((e) => runOnJS(handleVideoAreaDoubleTap)(e.x)),
    [isLocked, handleVideoAreaDoubleTap]
  );

  const composedVideoGesture = useMemo(
    () => Gesture.Race(panGesture, Gesture.Exclusive(doubleTapGesture, tapGesture)),
    [doubleTapGesture, panGesture, tapGesture]
  );

  const displayedPosition = seekPreviewPosition ?? position;
  const showCenterInfoPanel =
    controlsVisible &&
    !isLocked &&
    !screenshotPreview &&
    !utilityRailExpanded &&
    !trimPanelVisible &&
    propertiesPanelVisible;
  const showTrimPanel =
    controlsVisible &&
    !isLocked &&
    !screenshotPreview &&
    !utilityRailExpanded &&
    trimPanelVisible;
  const transitionTranslateX = transitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: transitionMeta?.direction === "prev" ? [-90, 0] : [90, 0],
  });
  const transitionOpacity = transitionProgress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1, 0],
  });
  // Source must stay stable across the lifetime of one playback URI. Including
  // pendingStartPositionMs here caused the <Video> to remount on resume (once
  // when the resume position was set, again when onProgress cleared it),
  // restarting playback from 0 a few seconds in. Resume position is applied via
  // videoRef.current.seek() in startPlaybackUnified — no need to put it on the
  // source object too.
  const videoSource = useMemo(() => {
    if (!videoId) return undefined;
    const expectedUri = normalizePlaybackUri(playbackUri ?? "");
    if (expectedUri) return { uri: expectedUri };
    if (validatedPlaybackUri) return { uri: validatedPlaybackUri };
    return undefined;
  }, [playbackUri, validatedPlaybackUri, videoId]);

  useEffect(() => {
    if (!videoId && !playbackUri && !validatedPlaybackUri) return;
    const expectedUri = normalizePlaybackUri(playbackUri ?? "");
    const mismatch = Boolean(expectedUri && validatedPlaybackUri && expectedUri !== validatedPlaybackUri);
    logPlayback(playbackLogContext(), "source_resolution", {
      videoId: videoId ?? null,
      playbackUri,
      validatedPlaybackUri,
      expectedUri,
      sourceUri: videoSource?.uri ?? null,
      mismatch,
    });
    if (mismatch) {
      logPlayback(playbackLogContext(), "source_uri_self_heal", {
        expectedUri,
        validatedPlaybackUri,
        sourceUri: videoSource?.uri ?? null,
      });
    }
  }, [playbackLogContext, playbackUri, validatedPlaybackUri, videoId, videoSource?.uri]);

  // bufferConfig identity is read by react-native-video to (re)configure
  // ExoPlayer's LoadControl. The previous version keyed on `videoSource?.uri`
  // which transiently becomes `undefined` during the URI-validation window
  // and then comes back — even though the returned constant
  // (LOCAL_BUFFER_CONFIG / VIDEO_BUFFER_CONFIG) is reference-stable, keying
  // on `validatedPlaybackUri` removes one render's worth of recompute churn
  // and makes the lifecycle obvious: the LoadControl is committed once per
  // validated source and never re-evaluated mid-session.
  const bufferConfigForSource = useMemo(() => {
    const uri = (validatedPlaybackUri ?? "").trim();
    if (!uri) return VIDEO_BUFFER_CONFIG;
    const isLocal =
      uri.startsWith("file://") ||
      uri.startsWith("content://") ||
      uri.startsWith("/") ||
      /^[A-Za-z]:[\\/]/.test(uri);
    return isLocal ? LOCAL_BUFFER_CONFIG : VIDEO_BUFFER_CONFIG;
  }, [validatedPlaybackUri]);
  const selectedAudioTrackSource = useMemo(
    () =>
      safeSelectedAudioTrackIndex === null
        ? undefined
        : { type: SelectedTrackType.INDEX, value: safeSelectedAudioTrackIndex },
    [safeSelectedAudioTrackIndex]
  );
  const logVideoLoadEvent = useCallback(
    (phase: "loadStart" | "loaded", extra: Record<string, unknown> = {}) => {
      const now = Date.now();
      const key = `${videoId ?? "unknown"}:${validatedPlaybackUri ?? "no-uri"}`;
      const tracker = loadLoopTrackerRef.current;
      const isSameWindow =
        tracker.key === key &&
        now - tracker.firstAt <= VIDEO_RELOAD_LOOP_WINDOW_MS;

      if (!isSameWindow) {
        loadLoopTrackerRef.current = {
          key,
          firstAt: now,
          lastAt: now,
          starts: phase === "loadStart" ? 1 : 0,
          loads: phase === "loaded" ? 1 : 0,
          warned: false,
        };
      } else {
        tracker.lastAt = now;
        if (phase === "loadStart") tracker.starts += 1;
        if (phase === "loaded") tracker.loads += 1;
      }

      const nextTracker = loadLoopTrackerRef.current;
      const payload = {
        id: videoId,
        title: video?.title,
        uri: validatedPlaybackUri,
        sourceStable: videoSource?.uri === validatedPlaybackUri,
        paused: !isPlaying || !validatedPlaybackUri || Boolean(playbackStartupError),
        isPlaying,
        startupError: playbackStartupError,
        startsInWindow: nextTracker.starts,
        loadsInWindow: nextTracker.loads,
        windowMs: now - nextTracker.firstAt,
        ...extra,
      };

      if (
        !nextTracker.warned &&
        nextTracker.starts >= VIDEO_RELOAD_LOOP_THRESHOLD
      ) {
        nextTracker.warned = true;
        L.error("video reload loop detected", payload);
        return;
      }

      L.player(phase, payload);
    },
    [
      isPlaying,
      playbackStartupError,
      validatedPlaybackUri,
      video?.title,
      videoId,
      videoSource?.uri,
    ]
  );
  const handleVideoLoadStart = useCallback(() => {
    const now = Date.now();
    loadStartTimestampRef.current = now;
    loadStartPerformanceRef.current = nowPerformanceMs();
    startupAnalyticsRef.current.loadStartAt = now;
    if (playbackStartTsRef.current === 0) {
      playbackStartTsRef.current = now;
    }
    logVideoEvent(playbackLogContext(), "loadStart");
    logVideoLoadEvent("loadStart");
  }, [logVideoLoadEvent, playbackLogContext]);

  useEffect(() => {
    const sourceUri = videoSource?.uri ?? null;
    const paused = !isPlaying;
    const startupError = playbackStartupError ?? null;
    const key = JSON.stringify({ sourceUri, paused, startupError });
    if (lastVideoRenderStateLogRef.current === key) return;
    lastVideoRenderStateLogRef.current = key;
    logPlayback(playbackLogContext(), "video_render_state", {
      sourceUri,
      paused,
      startupError,
      hasPlaybackUri: Boolean(playbackUri),
      hasValidatedPlaybackUri: Boolean(validatedPlaybackUri),
    });
  }, [isPlaying, playbackLogContext, playbackStartupError, playbackUri, validatedPlaybackUri, videoSource?.uri]);

  const nativeTelemetryHandlers = useMemo(
    () =>
      ({
        onIdle: () => logNativeState(playbackLogContext(), "onIdle"),
        onTimedMetadata: () => undefined,
      }) as any,
    [playbackLogContext]
  );

  if (!video) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Feather name="alert-circle" size={48} color="#fff" />
        <Text style={styles.errorText}>Media not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (isAudioMode) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4BA3FF" />
        <Text style={styles.errorText}>Opening audio player...</Text>
      </View>
    );
  }

  if (!player) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Loading player...</Text>
      </View>
    );
  }

  const isPreparingPlayback = Boolean(playbackUri && !validatedPlaybackUri && !playbackStartupError);

  const progressPercent =
    duration > 0
      ? `${Math.round((displayedPosition / duration) * 100)}% ${isAudioMode ? "played" : "watched"
      }`
      : "Starting";
  const trimLength = Math.max(trimEnd - trimStart, 0);
  const detailItems = [
    { label: "Type", value: isAudioMode ? "Audio" : "Video" },
    { label: "Folder", value: video.folder || "Unknown folder" },
    { label: "Length", value: formatDuration(video.duration || duration) },
    ...(video.isClip
      ? [
        { label: "Clip In", value: formatDuration(Math.max(video.clipStart ?? 0, 0)) },
        { label: "Clip Out", value: formatDuration(Math.max(video.clipEnd ?? 0, 0)) },
      ]
      : []),
    { label: "Size", value: formatFileSize(video.size) },
    { label: "Format", value: video.mimeType || "Unknown format" },
    { label: "Played", value: `${video.playCount} time${video.playCount === 1 ? "" : "s"}` },
    {
      label: "Resume",
      value:
        video.lastPosition && video.lastPosition > 0
          ? formatDuration(video.lastPosition)
          : "Not saved",
    },
  ];
  const featureChips = [
    `${speed}x speed`,
    ...(isAudioMode
      ? ["Audio mode"]
      : [
        video.isClip ? "Saved clip" : "Full source",
        zoomScale > MIN_PINCH_SCALE + 0.01
          ? `Zoom ${zoomScale.toFixed(1)}×`
          : "Fit",
        contentFitMode === "contain"
          ? "Fit mode"
          : contentFitMode === "cover"
            ? "Expand mode"
            : "Stretch mode",
        `${getDecoderModeLabel(decoderMode)} decoder`,
        effectiveOrientationMode === "default"
          ? "Auto rotate"
          : effectiveOrientationMode === "landscape"
            ? "Landscape lock"
            : "Portrait lock",
      ]),
    isMuted
      ? "Muted"
      : `Volume ${Math.round(volume * 100)}%${volumeBoost > 1 ? ` + boost ${Math.round(volumeBoost * 100)}%` : ""}`,
    audioTracks.length > 1 ? `Audio ${audioTrackLabel}` : "Single audio",
    nightMode ? "Night mode on" : "Night mode off",
    settings.backgroundPlay ? "Background audio on" : "Background audio off",
  ];

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setViewport({ width, height });
      }}
    >
      <StatusBar hidden />
      <GestureDetector gesture={composedVideoGesture}>
        <View style={StyleSheet.absoluteFill}>
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.videoViewport,
              Platform.OS === "web" ? { pointerEvents: "none" } : null,
            ]}
            {...videoWrapperProps}
          >
            <View
              style={[
                styles.videoFrame,
                videoFrameStyle,
                zoomScale > MIN_PINCH_SCALE + 0.001
                  ? { transform: [{ scale: zoomScale }] }
                  : null,
              ]}
            >
              <Video
                // Keyed on (videoId + recoveryRemountKey). videoId forces a
                // fresh native player per video; recoveryRemountKey is bumped
                // by the L3 recovery step to remount the SAME source when the
                // ladder needs a clean ExoPlayer instance.
                key={`${videoId ?? "no-video"}:${recoveryRemountKey}`}
                ref={videoRef}
                source={videoSource}
                style={[
                  StyleSheet.absoluteFill,
                  isAudioMode ? styles.hiddenMediaView : null,
                ]}
                resizeMode={contentFitMode === "cover" ? "cover" : contentFitMode === "fill" ? "stretch" : "contain"}
                controls={false}
                fullscreen={false}
                paused={!isPlaying}
                playInBackground={settings.backgroundPlay}
                playWhenInactive={settings.backgroundPlay}
                ignoreSilentSwitch="ignore"
                repeat={player?.loop ?? false}
                rate={player?.playbackRate ?? 1}
                volume={player?.volume ?? 1}
                muted={player?.muted ?? false}
                viewType={decoderViewType}
                selectedAudioTrack={selectedAudioTrackSource}
                bufferConfig={bufferConfigForSource}
                // Predictable native progress cadence. Keep this at 500 ms
                // to reduce bridge traffic while preserving current UI flow.
                // 250 ms gives 20 progress ticks before STALL_TIMEOUT_MS — 2× the
                // headroom of the previous 500 ms cadence. The dual-signal
                // liveness gate in useHealthMonitor reduces this prop's risk
                // budget: even if a tick is missed under JS thread pressure,
                // native ack now backstops the stall classifier.
                progressUpdateInterval={250}
                // Don't surface transient network disconnects to onError — the
                // recovery ladder + ExoPlayer's own reconnect logic handle
                // them. Surfacing them turns brief network blips into hard
                // playback errors with a user-visible overlay.
                disableDisconnectError={true}
                onLoadStart={handleVideoLoadStart}
                onLoad={FAST_STARTUP_ENABLED ? handleVideoLoadFast : handleVideoLoad}
                onProgress={handleVideoProgress}
                onAudioTracks={handleAudioTracksUpdate}
                {...nativeTelemetryHandlers}
                onBuffer={({ isBuffering: nextIsBuffering }) => {
                  logNativeState(playbackLogContext(), "buffer", { isBuffering: Boolean(nextIsBuffering) });
                  const buffering = Boolean(nextIsBuffering);
                  setIsBuffering(buffering);
                  bufferingStartedAtRef.current = buffering ? Date.now() : null;
                  // Drive the playback-phase state machine: buffering blocks
                  // both the stall detector and the recovery ladder so a
                  // legitimate rebuffer doesn't trigger a false stall.
                  if (buffering) {
                    startupAnalyticsRef.current.rebufferCount += 1;
                    if (playbackPhaseRef.current === "playing" || playbackPhaseRef.current === "stabilizing") {
                      setPlaybackPhase("buffering", "native_buffering");
                    }
                  } else if (playbackPhaseRef.current === "buffering") {
                    // Native will follow up with onPlaybackStateChanged when
                    // it actually resumes; until then, treat as starting so
                    // the stall detector doesn't fire.
                    setPlaybackPhase(
                      startupStableConfirmedRef.current ? "playing" : "starting",
                      "native_buffering_cleared"
                    );
                  }
                }}
                // Heartbeat for network streams. ExoPlayer fires this every
                // ~2 s while bytes flow; use it to keep the native-ack window
                // fresh so the stall detector doesn't trip on a slow stream.
                onBandwidthUpdate={() => {
                  lastNativeAckPlayingAtRef.current = Date.now();
                }}
                // Pause cleanly when headphones are unplugged (Android
                // AUDIO_BECOMING_NOISY broadcast). Without this, audio
                // continues out loud on the speaker — surprising.
                onAudioBecomingNoisy={() => {
                  if (!playerRef.current) return;
                  logPlayback(playbackLogContext(), "audio_becoming_noisy");
                  autoPlayIntentRef.current = false;
                  saveProgressOnStop('audio_becoming_noisy_headset_unplug');
                  try { playerRef.current.pause(); } catch { /* ignore */ }
                  setIsPlaying(false);
                  setPlaybackPhase("paused", "audio_focus_or_noisy");
                }}
                onPlaybackStateChanged={handleNativePlaybackStateChanged}
                onReadyForDisplay={() => {
                  lastReadyTimestampRef.current = Date.now();
                  // Log only the FIRST surface-ready per video — Android can
                  // fire this repeatedly on surface re-attach (rotation, view
                  // mutation, etc.) and the log spam obscured real state
                  // transitions. The ref is reset on videoId change.
                  if (!onReadyForDisplayFiredRef.current) {
                    const elapsedMs = loadStartPerformanceRef.current === null
                      ? null
                      : Number((nowPerformanceMs() - loadStartPerformanceRef.current).toFixed(1));
                    logNativeState(playbackLogContext(), "onReadyForDisplay");
                    logPlayback(playbackLogContext(), "ready_for_display", { elapsedMs });
                  }
                  onReadyForDisplayFiredRef.current = true;
                  // Consume a pending watchdog arm — armStartupWatchdog
                  // deferred starting the timer because we hadn't fired
                  // onReadyForDisplay yet. Start it now from a known-ready
                  // state.
                  if (pendingStartupWatchdogArmRef.current && startupWatchdogCheckRef.current) {
                    pendingStartupWatchdogArmRef.current = false;
                    startupWatchdogTimerRef.current = setTimeout(
                      startupWatchdogCheckRef.current,
                      STARTUP_GRACE_MS,
                    );
                  }
                }}
                onSeek={(data) => {
                  const seekTime = Number(data.currentTime ?? data.seekTime ?? 0);
                  if (Number.isFinite(seekTime)) {
                    const shim = playerRef.current as any;
                    shim?._setCurrentTime?.(seekTime);
                    capturePlaybackSnapshot(seekTime);
                    pendingSeekAbsoluteRef.current = null;
                  }
                }}
                onError={(error) => {
                  videoErrorRef.current = (error as any)?.error ?? error ?? { errorString: "unknown" };
                  console.error("[Video] onError:", videoErrorRef.current);
                  L.error('playback error', { id: videoId, error });
                  const errMsg = (videoErrorRef.current as any)?.errorString ?? 'unknown';

                  // Decoder-fallback chain: if a decoder-related error fires
                  // and we haven't tried all modes yet, drop to the next
                  // (hwPlus → hw → sw) and remount, instead of surfacing the
                  // fatal overlay immediately. This is what MX Player does
                  // for codec failures.
                  const isDecoderError =
                    /decoder|MediaCodec|extract|ERROR_CODE_DECODER/i.test(errMsg) ||
                    /decoder|MediaCodec/i.test(String((videoErrorRef.current as any)?.errorException ?? ""));
                  const fallbackKey = `${videoId ?? "no-video"}:${decoderMode}`;
                  if (
                    isDecoderError &&
                    videoId &&
                    !decoderFallbackAttemptedRef.current[fallbackKey]
                  ) {
                    decoderFallbackAttemptedRef.current[fallbackKey] = true;
                    const nextMode: DecoderMode =
                      decoderMode === "hwPlus" ? "hw" : decoderMode === "hw" ? "sw" : "sw";
                    if (nextMode !== decoderMode) {
                      logRecovery(playbackLogContext(), "decoder_fallback", { from: decoderMode, to: nextMode });
                      setDecoderMode(nextMode);
                      // Bump the remount key so the <Video> re-mounts with
                      // the new viewType and a fresh ExoPlayer instance.
                      sourceGenerationRef.current += 1;
                      resetRecoveryAttempts(sourceGenerationRef.current);
                      playbackSessionIdRef.current = createPlaybackSessionId(videoId, sourceGenerationRef.current);
                      setRecoveryRemountKey((k) => k + 1);
                      return;
                    }
                  }

                  if (videoId && playbackErrorHandledVideoId.current === videoId) return;
                  playbackErrorHandledVideoId.current = videoId ?? null;
                  saveProgressOnStop(`playback_error: ${errMsg}`);
                  setIsPlaying(false);
                  setPlaybackPhase("error", "playback_error");
                  setPlaybackStartupError("This media could not be played. Try rescanning the library or removing the unavailable item.");
                }}
                onEnd={() => {
                  try {
                    const shim = playerRef.current as any;
                    if (shim) shim._setPlaying?.(false);
                    saveProgressOnStop('video_completed_naturally');
                    setIsPlaying(false);
                    setPlaybackPhase("ended", "playback_ended");

                    // Clear saved progress when video completes
                    if (videoId && settings.rememberPosition) {
                      void clearPlaybackProgress(videoId);
                      setShowStartOverButton(false);
                      setResumedFromSaved(false);
                      setResumePrompt(null);
                    }

                    // loop-one and loop-all with single video use native repeat
                    if (loopMode === "one" || (loopMode === "all" && videoQueueRef.current.length <= 1)) {
                      completionHandledVideoId.current = null;
                      return;
                    }

                    // loop-all wraps to first video
                    const loopFirstVideo = loopMode === "all" && !nextVideo && videoQueueRef.current.length > 1
                      ? videoQueueRef.current[0]
                      : null;
                    const autoTarget = nextVideo ?? loopFirstVideo;
                    if (autoTarget && featureConfig.upNextAutoplayEnabled) {
                      setAutoPlayTarget(autoTarget);
                      setAutoPlayCountdown(5);
                    }
                  } catch (e) {
                    console.error("End handling failed:", e);
                  }
                }}
              />
              {useBrightnessOverlayFallback ? (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: "#000", opacity: Math.max(0, 1 - Math.max(brightnessLevel, 0.05)) },
                  ]}
                />
              ) : null}
              {/* Custom subtitle overlay (RN renderer, decoupled from textTracks
                  to avoid MediaSource rebuilds during live generation). */}
              {!isAudioMode ? (
                <SubtitleOverlay ref={subtitleOverlayRef} />
              ) : null}
            </View>
          </View>
          {isAudioMode ? (
            <View pointerEvents="none" style={styles.audioModeCanvas}>
              <View style={styles.audioModeGlow} />
              <View style={styles.audioModeHero}>
                {/* Fix #9: Show album art if thumbnail exists, else music icon */}
                <View style={styles.audioModeDisc}>
                  {video.thumbnail ? (
                    <FastImage
                      source={{ uri: getThumbnailUri(video.thumbnail) ?? '' }}
                      style={styles.audioModeArt}
                      resizeMode={FastImage.resizeMode.cover}
                    />
                  ) : (
                    <View style={styles.audioModeDiscInner}>
                      <Feather name="music" size={42} color="#D8EAFF" />
                    </View>
                  )}
                </View>
                <Text style={styles.audioModeEyebrow}>
                  {video.artist ? video.artist : "Audio Player"}
                </Text>
                <Text style={styles.audioModeTitle} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={styles.audioModeMeta} numberOfLines={1}>
                  {video.album ? `${video.album}  ·  ` : ""}{video.folder || "Unknown folder"} | {formatDuration(video.duration || duration)}
                </Text>
              </View>
              <View style={styles.audioWaveRow}>
                {Array.from({ length: 22 }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.audioWaveBar,
                      {
                        height: 16 + ((index * 11) % 48),
                        opacity: 0.28 + ((index % 6) * 0.1),
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </GestureDetector>
      {isPreparingPlayback || playbackStartupError ? (
        <View pointerEvents="box-none" style={styles.playerStateOverlay}>
          <View style={styles.playerStateCard}>
            <FastImage source={APP_ICON_SOURCE as any} style={styles.playerStateIcon} />
            <Text style={styles.playerStateTitle}>
              {playbackStartupError ? "Playback unavailable" : "Opening media..."}
            </Text>
            <Text style={styles.playerStateMessage}>
              {playbackStartupError ?? "Opening media..."}
            </Text>
            {playbackStartupError ? (
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [
                  styles.playerStateButton,
                  pressed ? styles.playerStateButtonPressed : null,
                ]}
              >
                <Text style={styles.playerStateButtonText}>Go Back</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* No blocking overlay - auto-resume happens silently */}
      {/* Start Over button now appears in the controls bar instead */}

      {nightMode ? <View pointerEvents="none" style={styles.nightOverlay} /> : null}

      {/* Lock overlay — covers entire screen when locked; tap anywhere to unlock */}
      {isLocked ? (
        <Pressable
          onPress={handleToggleLockMode}
          style={({ pressed }) => [StyleSheet.absoluteFillObject, styles.lockFullOverlay, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.lockIconWrap}>
            <Feather name="lock" size={32} color="#fff" />
          </View>
        </Pressable>
      ) : null}

      {/* Fix 4: Last-5-sec "Up Next" ending overlay — bottom-right tap to skip */}
      {showEndingOverlay && nextVideo && !isLocked ? (
        <Pressable
          onPress={() => handleNavigateToVideo(nextVideo, "next")}
          style={({ pressed }) => [
            styles.endingOverlay,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <View style={styles.endingOverlayInner}>
            <Text style={styles.endingOverlayEyebrow}>Up Next</Text>
            <Text style={styles.endingOverlayTitle} numberOfLines={1}>
              {nextVideo.title}
            </Text>
            <View style={styles.endingOverlayRow}>
              <Feather name="skip-forward" size={13} color="#7FC4FF" />
              <Text style={styles.endingOverlayAction}>Tap to play now</Text>
            </View>
          </View>
        </Pressable>
      ) : null}
      {/* Seek / Zoom HUD - centered message without a background card */}
      {gestureHud && (gestureHud.mode === "seek" || gestureHud.mode === "zoom") ? (
        <ReAnimated.View pointerEvents="none" style={[styles.hudWrap, seekHudAnimStyle]}>
          <View style={styles.hud}>
            <View style={styles.hudIconRow}>
              <Feather
                name={
                  gestureHud.mode === "zoom"
                    ? "zoom-in"
                    : (gestureHud.direction ?? (gestureHud.progress >= 0.5 ? "forward" : "rewind")) === "forward"
                      ? "fast-forward"
                      : "rewind"
                }
                size={22}
                color={
                  gestureHud.mode === "zoom"
                    ? "#A78BFA"
                    : (gestureHud.direction ?? (gestureHud.progress >= 0.5 ? "forward" : "rewind")) === "forward"
                      ? "#60A5FA"
                      : "#F87171"
                }
              />
              <Text style={styles.hudTitle}>
                {gestureHud.mode === "zoom"
                  ? "ZOOM"
                  : (gestureHud.direction ?? (gestureHud.progress >= 0.5 ? "forward" : "rewind")) === "forward"
                    ? "FORWARD"
                    : "REWIND"}
              </Text>
            </View>
            <Text style={styles.hudLabel}>{gestureHud.label}</Text>
            <View style={styles.hudTrack}>
              <LinearGradient
                colors={
                  gestureHud.mode === "zoom"
                    ? ["#7C3AED", "#A78BFA"]
                    : (gestureHud.direction ?? (gestureHud.progress >= 0.5 ? "forward" : "rewind")) === "forward"
                      ? ["#1D4ED8", "#60A5FA"]
                      : ["#991B1B", "#F87171"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.hudFill, { width: `${gestureHud.progress * 100}%` as const }]}
              />
            </View>
          </View>
        </ReAnimated.View>
      ) : null}

      {/* VLC-style brightness panel — left side */}
      {doubleTapSeekFeedback ? (
        <ReAnimated.View
          pointerEvents="none"
          style={[
            styles.doubleTapSeekWrap,
            doubleTapSeekFeedback.side === "left" ? styles.doubleTapSeekLeft : styles.doubleTapSeekRight,
            doubleTapSeekAnimStyle,
          ]}
        >
          <View style={styles.doubleTapSeekBubble}>
            <View style={styles.doubleTapSeekChevronRow}>
              <Feather
                name={doubleTapSeekFeedback.side === "left" ? "chevron-left" : "chevron-right"}
                size={26}
                color="rgba(255,255,255,0.58)"
              />
              <Feather
                name={doubleTapSeekFeedback.side === "left" ? "chevron-left" : "chevron-right"}
                size={30}
                color="rgba(255,255,255,0.82)"
              />
              <Feather
                name={doubleTapSeekFeedback.side === "left" ? "chevron-left" : "chevron-right"}
                size={26}
                color="rgba(255,255,255,0.58)"
              />
            </View>
            <Text style={styles.doubleTapSeekLabel}>{doubleTapSeekFeedback.label}</Text>
          </View>
        </ReAnimated.View>
      ) : null}

      {sideGestureMessage ? (
        <ReAnimated.View
          pointerEvents="none"
          style={[styles.sideGestureMessageWrap, sideGestureMessageAnimStyle]}
        >
          <Text
            style={[
              styles.sideGestureMessageText,
              sideGestureMessage.tone === "brightness" ? styles.sideGestureMessageBrightness : null,
            ]}
          >
            {sideGestureMessage.label}
          </Text>
        </ReAnimated.View>
      ) : null}


      {transitionMeta ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.transitionBanner,
            {
              opacity: transitionOpacity,
              transform: [{ translateX: transitionTranslateX }],
            },
          ]}
        >
          <Text style={styles.transitionLabel}>
            {transitionMeta.direction === "next" ? "Next" : "Previous"}
          </Text>
          <Text style={styles.transitionTitle} numberOfLines={1}>
            {transitionMeta.title}
          </Text>
        </Animated.View>
      ) : null}

      {screenshotPreview ? (
        <View pointerEvents="none" style={styles.screenshotToastWrap}>
          <View style={styles.screenshotToast}>
            <Text style={styles.screenshotToastTitle}>Shot</Text>
            <FastImage source={{ uri: (screenshotPreview as any)?.uri ?? '' }} style={styles.screenshotToastImage} />
            <Text style={styles.screenshotToastHint}>Preview hides in 3s</Text>
          </View>
        </View>
      ) : null}

      {utilityRailExpanded && !isLocked && queueVideos.length > 0 ? (
        <View
          style={[
            styles.upNextWrap,
            isLandscapeLayout ? styles.upNextWrapSide : styles.upNextWrapBottom,
          ]}
        >
          <View style={styles.upNextCard}>
            <View style={styles.upNextHeader}>
              <Text style={styles.upNextTitle}>Queue</Text>
              <Text style={styles.upNextCount}>
                {Math.max(currentIndex + 1, 1)}/{videoQueue.length}
              </Text>
            </View>
            <FlatList
              ref={queueListRef}
              data={queueVideos}
              keyExtractor={(item) => item.id}
              renderItem={renderUpNextItem}
              style={[
                styles.upNextScroll,
                isLandscapeLayout ? styles.upNextScrollLandscape : null,
              ]}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={5}
              scrollEnabled={!isLandscapeLayout}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.upNextList}
              onEndReached={() => {
                if (!canLoadMoreUpNext) return;
                setUpNextVisibleCount((current) =>
                  Math.min(portraitUpNextTotalCount, current + UP_NEXT_PAGE_SIZE)
                );
              }}
              onEndReachedThreshold={0.35}
              getItemLayout={(_, index) => ({
                length: QUEUE_ITEM_LAYOUT_HEIGHT,
                offset: (QUEUE_ITEM_LAYOUT_HEIGHT + UP_NEXT_SEPARATOR_HEIGHT) * index,
                index,
              })}
              ItemSeparatorComponent={() => <View style={styles.upNextSeparator} />}
              onScrollToIndexFailed={(info) => {
                queueListRef.current?.scrollToOffset({
                  offset: QUEUE_ITEM_LAYOUT_HEIGHT * info.index,
                  animated: false,
                });
              }}
            />
            {isLandscapeLayout ? (
              <View style={styles.upNextPager}>
                <Pressable
                  onPress={handleScrollUpNextPrev}
                  disabled={!canScrollUpNextPrev}
                  style={({ pressed }) => [
                    styles.upNextPagerBtn,
                    !canScrollUpNextPrev ? styles.upNextPagerBtnDisabled : null,
                    pressed && canScrollUpNextPrev
                      ? styles.upNextPagerBtnPressed
                      : null,
                  ]}
                >
                  <Feather
                    name="chevron-up"
                    size={16}
                    color={canScrollUpNextPrev ? "#EAF6FF" : "rgba(234,246,255,0.35)"}
                  />
                  <Text
                    style={[
                      styles.upNextPagerBtnText,
                      !canScrollUpNextPrev ? styles.upNextPagerBtnTextDisabled : null,
                    ]}
                  >
                    Previous
                  </Text>
                </Pressable>
                <Text style={styles.upNextPagerText}>
                  {landscapeUpNextPageCount > 0
                    ? `${activeUpNextLandscapePage + 1}/${landscapeUpNextPageCount}`
                    : "0/0"}
                </Text>
                <Pressable
                  onPress={handleScrollUpNextNext}
                  disabled={!canScrollUpNextNext}
                  style={({ pressed }) => [
                    styles.upNextPagerBtn,
                    !canScrollUpNextNext ? styles.upNextPagerBtnDisabled : null,
                    pressed && canScrollUpNextNext
                      ? styles.upNextPagerBtnPressed
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.upNextPagerBtnText,
                      !canScrollUpNextNext ? styles.upNextPagerBtnTextDisabled : null,
                    ]}
                  >
                    Next
                  </Text>
                  <Feather
                    name="chevron-down"
                    size={16}
                    color={canScrollUpNextNext ? "#EAF6FF" : "rgba(234,246,255,0.35)"}
                  />
                </Pressable>
              </View>
            ) : null}
            {!isLandscapeLayout && suggestedVideos.length > 0 ? (
              <View style={styles.suggestedSection}>
                <Text style={styles.suggestedHeader}>Suggested</Text>
                {suggestedVideos.map((sv) => (
                  <Pressable
                    key={sv.id}
                    onPress={() => handlePickUpcomingVideo(sv)}
                    style={({ pressed }) => [styles.upNextItem, pressed && styles.upNextItemPressed]}
                  >
                    <View style={styles.upNextIndex}>
                      <Feather name="trending-up" size={12} color="rgba(255,255,255,0.5)" />
                    </View>
                    <View style={styles.upNextTextBlock}>
                      <Text style={styles.upNextItemTitle} numberOfLines={1}>{sv.title}</Text>
                      <Text style={styles.upNextItemMeta} numberOfLines={1}>
                        {sv.folder || "Unknown"}  |  {formatDuration(sv.duration)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={handleHideUpNext}
              style={({ pressed }) => [
                styles.upNextActionBtn,
                pressed ? styles.upNextActionBtnPressed : null,
              ]}
            >
              <Feather name="chevrons-down" size={18} color="#EAF6FF" />
              <Text style={styles.upNextActionText}>Hide Up Next</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showCenterInfoPanel ? (
        <View pointerEvents="box-none" style={styles.centerPanelWrap}>
          <View style={[styles.infoPanel, styles.infoPanelCentered]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.infoScrollContent}
            >
              <View style={styles.infoHero}>
                <Text style={styles.infoEyebrow}>
                  {isAudioMode ? "Now Playing" : "Now Watching"}
                </Text>
                <Text style={styles.infoTitle} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={styles.infoSubtitle}>
                  {progressPercent}
                  {nextVideo ? `  |  Up next: ${nextVideo.title}` : ""}
                </Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Properties</Text>
                <View style={styles.infoGrid}>
                  {detailItems.map((item) => (
                    <View key={item.label} style={styles.infoCard}>
                      <Text style={styles.infoCardLabel}>{item.label}</Text>
                      <Text style={styles.infoCardValue} numberOfLines={2}>
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Current Modes</Text>
                <View style={styles.infoChipWrap}>
                  {featureChips.map((chip) => (
                    <View key={chip} style={styles.infoChip}>
                      <Text style={styles.infoChipText}>{chip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {showTrimPanel ? (
        <View pointerEvents="box-none" style={styles.centerPanelWrap}>
          <View style={[styles.infoPanel, styles.trimPanel]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.infoScrollContent}
            >
              <View style={styles.infoHero}>
                <Text style={styles.infoEyebrow}>Trim Clip</Text>
                <Text style={styles.infoTitle} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={styles.infoSubtitle}>
                  {formatDuration(trimStart)} to {formatDuration(trimEnd)}  |  {formatDuration(trimLength)}
                </Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Clip Name</Text>
                <TextInput
                  value={trimTitle}
                  onChangeText={setTrimTitle}
                  placeholder="Save clip name"
                  placeholderTextColor="rgba(214,232,255,0.45)"
                  style={styles.trimTitleInput}
                />
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Quick Marks</Text>
                <View style={styles.trimActionGrid}>
                  <Pressable
                    onPress={handleMarkTrimStart}
                    style={({ pressed }) => [
                      styles.trimActionBtn,
                      pressed ? styles.trimActionBtnPressed : null,
                    ]}
                  >
                    <Text style={styles.trimActionTitle}>Mark Start</Text>
                    <Text style={styles.trimActionMeta}>{formatDuration(position)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleMarkTrimEnd}
                    style={({ pressed }) => [
                      styles.trimActionBtn,
                      pressed ? styles.trimActionBtnPressed : null,
                    ]}
                  >
                    <Text style={styles.trimActionTitle}>Mark End</Text>
                    <Text style={styles.trimActionMeta}>{formatDuration(position)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handlePreviewTrimStart}
                    style={({ pressed }) => [
                      styles.trimActionBtn,
                      pressed ? styles.trimActionBtnPressed : null,
                    ]}
                  >
                    <Text style={styles.trimActionTitle}>Preview In</Text>
                    <Text style={styles.trimActionMeta}>{formatDuration(trimStart)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handlePreviewTrimEnd}
                    style={({ pressed }) => [
                      styles.trimActionBtn,
                      pressed ? styles.trimActionBtnPressed : null,
                    ]}
                  >
                    <Text style={styles.trimActionTitle}>Preview Out</Text>
                    <Text style={styles.trimActionMeta}>{formatDuration(trimEnd)}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.trimFooter}>
                <Pressable
                  onPress={handleResetTrim}
                  style={({ pressed }) => [
                    styles.trimSecondaryBtn,
                    pressed ? styles.trimSecondaryBtnPressed : null,
                  ]}
                >
                  <Text style={styles.trimSecondaryBtnText}>Reset</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTrimPanelVisible(false)}
                  style={({ pressed }) => [
                    styles.trimSecondaryBtn,
                    pressed ? styles.trimSecondaryBtnPressed : null,
                  ]}
                >
                  <Text style={styles.trimSecondaryBtnText}>Close</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleSaveTrim()}
                  style={({ pressed }) => [
                    styles.trimPrimaryBtn,
                    pressed ? styles.trimPrimaryBtnPressed : null,
                    isSavingTrim ? styles.trimPrimaryBtnDisabled : null,
                  ]}
                  disabled={isSavingTrim}
                >
                  <Text style={styles.trimPrimaryBtnText}>
                    {isSavingTrim ? "Saving..." : "Save Clip"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      <VideoPlayerControls
        accentColor={themeColors.primary}
        mediaType={mediaType}
        isPlaying={isPlaying}
        duration={duration}
        position={displayedPosition}
        speed={speed}
        controlsVisible={controlsVisible}
        contentFitMode={contentFitMode}
        utilityRailExpanded={utilityRailExpanded}
        quickActionsExpanded={quickActionsExpanded}
        isLocked={isLocked}
        backgroundPlay={settings.backgroundPlay}
        volume={volume}
        brightness={brightnessLevel}
        onVolumeChange={handleSetVolume}
        onBrightnessChange={handleSetBrightness}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onScrubbingChange={handleScrubbingChange}
        onSpeedChange={handleSpeedChange}
        isMuted={isMuted}
        loopMode={loopMode}
        nightMode={nightMode}
        orientationMode={effectiveOrientationMode}
        decoderMode={getDecoderModeLabel(decoderMode)}
        volumeBoost={volumeBoost}
        audioTrackLabel={audioTrackLabel}
        onToggleMute={handleToggleMute}
        onToggleLoop={handleToggleLoop}
        onToggleContentFit={handleToggleContentFit}
        onToggleUtilityRail={handleToggleUtilityRail}
        onToggleQuickActions={handleToggleQuickActions}
        onToggleProperties={handleTogglePropertiesPanel}
        onToggleLockMode={handleToggleLockMode}
        onToggleNightMode={handleToggleNightMode}
        onToggleBackgroundPlay={handleToggleBackgroundPlay}
        onCycleOrientation={handleCycleOrientation}
        onCycleDecoderMode={handleCycleDecoderMode}
        onCycleVolumeBoost={handleCycleVolumeBoost}
        onCycleAudioTrack={handleCycleAudioTrack}
        onSubtitlesAction={!isAudioMode ? handleSubtitlesAction : undefined}
        subtitlesStatus={subtitlesChipStatus}
        subtitlesProgress={subtitlesChipProgress}
        onTrimAction={!isAudioMode ? handleOpenTrimPanel : undefined}
        onScreenshot={handleScreenshot}
        trimLabel={video.isClip ? "Trim Again" : "Trim"}
        zoomLabel={zoomScale > MIN_PINCH_SCALE + 0.01 ? "Reset Zoom" : "Pinch Zoom"}
        onZoomAction={!isAudioMode ? handleZoomAction : undefined}
        onClose={handleClose}
        onPrev={previousVideo ? handlePrev : undefined}
        onNext={nextVideo || (loopMode === "all" && videoQueue.length > 1) ? handleNext : undefined}
        title={video.title}
        visible={
          controlsVisible &&
          !isLocked &&
          !isPreparingPlayback &&
          !playbackStartupError &&
          !(gestureHud?.mode === 'volume' || gestureHud?.mode === 'brightness')
        }
        sleepTimerRemaining={sleepTimerRemaining}
        onSetSleepTimer={handleSetSleepTimer}
        onStartOver={handleStartOver}
        showStartOverButton={
          showStartOverButton ||
          resumedFromSaved ||
          (Boolean(videoId) && settings.rememberPosition && position > 1)
        }
        seekPreviewPosition={seekPreviewPosition}
        forcedAspectRatio={forcedAspectRatio}
        onSetAspectRatio={!isAudioMode ? handleSetForcedAspectRatio : undefined}
        onOpenNetworkStream={!isAudioMode ? () => navigation.navigate("network-stream" as never) : undefined}
        featureConfig={featureConfig}
        insets={insets}
      />

      {/* Audio track picker — opened by the audio button in VideoPlayerControls. */}
      <AudioTrackBottomSheet
        visible={audioBottomSheetVisible}
        tracks={audioTracks}
        currentTrackIndex={selectedAudioTrackIndex}
        onTrackSelect={handleSelectAudioTrack}
        onClose={() => setAudioBottomSheetVisible(false)}
      />

      {/* Subtitle generation + selection sheet. */}
      <SubtitleBottomSheet
        visible={subtitleBottomSheetVisible}
        onClose={() => setSubtitleBottomSheetVisible(false)}
        videoUri={validatedPlaybackUri ?? null}
      />

      {/* MX-style gesture bars — mutually exclusive via activeGestureMode */}
      {activeGestureMode === "brightness" && !isLocked ? (
        <VerticalGestureBar
          value={brightnessLevel}
          color="#FBBF24"
          icon="sun"
          side="left"
          edgeInset={insets.left}
          onChange={handleSetBrightness}
        />
      ) : null}
      {activeGestureMode === "volume" && !isLocked ? (
        <VerticalGestureBar
          value={volume}
          color="#60A5FA"
          icon="volume-2"
          side="right"
          edgeInset={insets.right}
          onChange={handleSetVolume}
        />
      ) : null}

      {/* Continuous play countdown overlay */}
      {autoPlayCountdown !== null && (autoPlayTarget ?? nextVideo) ? (
        <View pointerEvents="box-none" style={styles.countdownOverlay}>
          <View style={styles.countdownCard}>
            <Text style={styles.countdownLabel}>Playing next in</Text>
            <Text style={styles.countdownNumber}>{autoPlayCountdown}</Text>
            <Text style={styles.countdownTitle} numberOfLines={1}>{(autoPlayTarget ?? nextVideo)!.title}</Text>
            <Pressable
              onPress={() => { handleCancelAutoPlay(); }}
              style={({ pressed }) => [styles.countdownCancelBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.countdownCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Long press 2× speed badge */}
      {longPressActive ? (
        <View pointerEvents="none" style={styles.speedBadge}>
          <Text style={styles.speedBadgeText}>2×</Text>
        </View>
      ) : null}

      {sleepTimerRemaining !== null && (
        <View pointerEvents="none" style={styles.sleepTimerOverlay}>
          <Feather name="moon" size={12} color="#FFC107" />
          <Text style={styles.sleepTimerText}>
            {Math.floor(sleepTimerRemaining / 60)}:{(sleepTimerRemaining % 60).toString().padStart(2, '0')}
          </Text>
        </View>
      )}

      {showUpNextPopup && nextVideo && (
        <Animated.View style={styles.upNextPopup}>
          <View style={styles.upNextPopupContent}>
            <View style={styles.upNextPopupInfo}>
              <Text style={styles.upNextPopupLabel}>Up Next</Text>
              <Text style={styles.upNextPopupTitle} numberOfLines={1}>{nextVideo.title}</Text>
            </View>
            <View style={styles.upNextPopupButtons}>
              <Pressable
                onPress={() => handleSeek(0)}
                style={({ pressed }) => [
                  styles.upNextPopupBtn,
                  styles.upNextPopupBtnRestart,
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Feather name="rotate-ccw" size={16} color="#fff" />
                <Text style={styles.upNextPopupBtnText}>Start Over</Text>
              </Pressable>
              <Pressable
                onPress={handleNext}
                style={({ pressed }) => [
                  styles.upNextPopupBtn,
                  styles.upNextPopupBtnNext,
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={styles.upNextPopupBtnText}>Play Now</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
      {/* Gesture HUD rendered inline above — AdaptiveHUD removed to avoid duplicate */}

      {showDiscoveryHints && (
        <View pointerEvents="none" style={styles.discoveryHints}>
          <View style={styles.discoveryHintLeft}>
            <Feather name="sun" size={24} color="rgba(255,255,255,0.4)" />
            <Text style={styles.discoveryHintText}>Brightness</Text>
          </View>
          <View style={styles.discoveryHintRight}>
            <Feather name="volume-2" size={24} color="rgba(255,255,255,0.4)" />
            <Text style={styles.discoveryHintText}>Volume</Text>
          </View>
        </View>
      )}
    </View>
  );
}
