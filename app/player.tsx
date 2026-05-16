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
import { PlayerManager } from "@/services/PlayerManager";
import { usePlayer } from "@/context/PlayerContext";
import {
  consumeFreshVideoSession,
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
  getPlayerBrightness,
  resetBrightnessGestureThrottle,
  restorePlayerBrightness,
  setPlayerBrightness,
  setPlayerBrightnessForGesture,
} from "@/services/deviceBrightness";
import {
  resetVolumeGestureThrottle,
  setDeviceVolume,
  setDeviceVolumeForGesture,
} from "@/services/deviceVolume";
import {
  MIN_RESUME_POSITION_SECONDS,
} from "@/services/playbackProgressService";
import { getVideosByFolder } from "@/services/videoService";

const L = log('VideoPlayer');
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const VOLUME_BOOST_LEVELS = [1, 1.25, 1.5, 2];
const CONTROL_TIMEOUT = 3000;
const RESUME_COUNTDOWN_SEC = 3;
const DOUBLE_TAP_SEEK_SECONDS = 10;
const HUD_TIMEOUT = 1000;
const SCREENSHOT_PREVIEW_TIMEOUT = 3000;
const DOUBLE_TAP_TIMEOUT = 280;
const DOUBLE_TAP_EDGE_RATIO = 0.32;
const GESTURE_ACTIVATION_DISTANCE = 12;
const EDGE_VERTICAL_GESTURE_ACTIVATION_DISTANCE = 18;
const GESTURE_CANCEL_TAP_DISTANCE = 10;
const LONG_PRESS_SPEED_RAMP_DELAY = 650;
const VERTICAL_GESTURE_SENSITIVITY_PX = 260;
const HORIZONTAL_SEEK_MAX_WINDOW = 600;
const EDGE_GESTURE_RATIO = 0.20;
const MIN_PINCH_SCALE = 1;
const MAX_PINCH_SCALE = 3;
const PINCH_GESTURE_ACTIVATION_DELTA = 0.04;
const QUEUE_ITEM_LAYOUT_HEIGHT = 76;
const UP_NEXT_SEPARATOR_HEIGHT = 8;
const UP_NEXT_PAGE_SIZE = 10;
const UP_NEXT_LANDSCAPE_PAGE_SIZE = 4;
const APP_ICON_SOURCE = require("../assets/images/icon.png");
const VIDEO_BUFFER_CONFIG = {
  minBufferMs: 25000,
  maxBufferMs: 60000,
  bufferForPlaybackMs: 5000,
  bufferForPlaybackAfterRebufferMs: 10000,
  backBufferDurationMs: 20000,
};
const MAX_FORCED_PLAYS = 2;
const VIDEO_RELOAD_LOOP_WINDOW_MS = 2500;
const VIDEO_RELOAD_LOOP_THRESHOLD = 3;

type ContentFitMode = "contain" | "cover" | "fill";
type GestureMode = "volume" | "brightness" | "seek" | "zoom";
type TapZone = "left" | "center" | "right";
type VideoNaturalSize = { width: number; height: number };
type DecoderMode = "hwPlus" | "hw" | "sw";
type PlayerAudioTrack = {
  index: number;
  title?: string;
  language?: string;
  bitrate?: number;
  selected?: boolean;
};

// Local player shim backed by react-native-video's ref.
type VideoThumbnail = { uri: string };

type VideoPlayerShim = {
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

function createVideoPlayerShim(videoRef: React.RefObject<VideoRef | null>): VideoPlayerShim {
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
    async replaceAsync(uri: string) {
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
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function applyGestureCurve(value: number, exponent = 1.08) {
  const safeValue = clamp(value, -1, 1);
  return Math.sign(safeValue) * Math.pow(Math.abs(safeValue), exponent);
}

function getTouchDistance(
  touches?: ReadonlyArray<{ pageX: number; pageY: number } | null>
) {
  if (!touches || touches.length < 2) return 0;
  const firstTouch = touches[0];
  const secondTouch = touches[1];
  if (!firstTouch || !secondTouch) return 0;
  return Math.hypot(
    secondTouch.pageX - firstTouch.pageX,
    secondTouch.pageY - firstTouch.pageY
  );
}

// Returns a delta value (positive = up = increase) for relative gesture control
function resolveVerticalGestureDelta(options: {
  dy: number;
  viewportHeight: number;
}) {
  return clamp(-options.dy / VERTICAL_GESTURE_SENSITIVITY_PX, -1, 1);
}

function resolveEdgeVerticalControlMode(options: {
  x: number;
  viewportWidth: number;
  isAudioMode: boolean;
  swipeBrightness: boolean;
  swipeVolume: boolean;
}): "brightness" | "volume" | null {
  const safeWidth = Math.max(options.viewportWidth || 1, 1);
  const midPoint = safeWidth / 2;

  if (
    !options.isAudioMode &&
    options.swipeBrightness &&
    options.x <= midPoint
  ) {
    return "brightness";
  }

  if (
    options.swipeVolume &&
    options.x > midPoint
  ) {
    return "volume";
  }

  return null;
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "Unknown";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function fitFromSetting(mode: "fit" | "expand" | "stretch"): ContentFitMode {
  if (mode === "expand") return "cover";
  if (mode === "stretch") return "fill";
  return "contain";
}

function initialPlayerFitFromSetting(mode: "fit" | "expand" | "stretch"): ContentFitMode {
  return fitFromSetting(mode);
}

function settingFromFit(mode: ContentFitMode) {
  if (mode === "cover") return "expand" as const;
  if (mode === "fill") return "stretch" as const;
  return "fit" as const;
}

function parseAspectRatio(ratio: string | null) {
  if (!ratio) return null;
  const [widthText, heightText] = ratio.split(":");
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return width / height;
}

function getAudioTrackLabel(track?: PlayerAudioTrack | null) {
  if (!track) return "Audio";
  return track.title || track.language?.toUpperCase() || `Track ${track.index + 1}`;
}

function getDecoderModeLabel(mode: DecoderMode) {
  if (mode === "hwPlus") return "HW+";
  if (mode === "hw") return "HW";
  return "SW";
}

function applyPlayerAudioState(
  player: VideoPlayerShim,
  options: {
    volume: number;
    volumeBoost?: number;
    isMuted: boolean;
    backgroundPlay: boolean;
  }
) {
  const safeVolume = clamp01(options.volume);
  const boost = Math.max(options.volumeBoost ?? 1, 1);
  player.audioMixingMode = "doNotMix";
  // Always keep audio alive in background when the setting is enabled.
  // When TrackPlayer is available it handles the notification; when not, show system one.
  player.staysActiveInBackground = options.backgroundPlay;
  player.showNowPlayingNotification = options.backgroundPlay && !isTrackPlayerAvailable;
  player.volume = safeVolume * boost;
  player.muted = options.isMuted || safeVolume <= 0.001;
}

function getPlaybackUri(video?: {
  uri: string;
  sourceUri?: string;
  isClip?: boolean;
} | null) {
  if (!video) return null;
  if (video.isClip || video.uri.startsWith("mxclip://")) {
    return video.sourceUri || null;
  }
  return video.uri || video.sourceUri || null;
}

function buildHandoffQueue(
  videoQueue: VideoItem[],
  fallback: VideoItem,
  fallbackUri: string | null,
  currentIndex: number,
): { queue: (VideoItem & { uri: string; mediaType: "video" })[]; index: number } {
  const queue = videoQueue.map((item) => ({
    ...item,
    uri: getPlaybackUri(item) ?? item.uri,
    mediaType: "video" as const,
  }));
  const index = currentIndex >= 0 ? currentIndex : 0;
  if (queue.length === 0) {
    queue.push({ ...fallback, uri: fallbackUri ?? fallback.uri, mediaType: "video" as const });
  }
  return { queue, index };
}

function safeDecodeFilePath(uri: string) {
  const path = uri.replace(/^file:\/\//, "");
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function getLocalFilePath(uri: string) {
  if (uri.startsWith("file://")) return safeDecodeFilePath(uri);
  if (uri.startsWith("/")) return safeDecodeFilePath(uri);
  return null;
}

function encodeLocalFileUri(path: string) {
  const normalizedPath = path.replace(/\\/g, "/");
  const encodedPath = normalizedPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `file://${encodedPath}`;
}

function normalizePlaybackUri(uri: string) {
  const localPath = getLocalFilePath(uri);
  if (!localPath) return uri;
  return encodeLocalFileUri(localPath);
}

function getClipStartOffset(video?: {
  isClip?: boolean;
  clipStart?: number;
} | null) {
  return video?.isClip ? Math.max(video.clipStart ?? 0, 0) : 0;
}

function getClipEndPosition(video?: {
  isClip?: boolean;
  clipStart?: number;
  clipEnd?: number;
} | null) {
  if (!video?.isClip) return null;
  const clipStart = getClipStartOffset(video);
  if (!Number.isFinite(video.clipEnd)) return null;
  return Math.max(video.clipEnd ?? clipStart, clipStart);
}

function getPlayableDuration(
  video: {
    duration: number;
    isClip?: boolean;
    clipStart?: number;
    clipEnd?: number;
  } | null | undefined,
  sourceDuration: number
) {
  if (!video?.isClip) return Math.max(sourceDuration, 0);
  const clipStart = getClipStartOffset(video);
  const clipEnd = getClipEndPosition(video);
  if (clipEnd === null) return Math.max(video.duration || sourceDuration, 0);
  return Math.max((sourceDuration > 0 ? Math.min(clipEnd, sourceDuration) : clipEnd) - clipStart, 0);
}

function getRelativePlaybackPosition(
  video: {
    duration: number;
    isClip?: boolean;
    clipStart?: number;
    clipEnd?: number;
  } | null | undefined,
  absolutePosition: number,
  sourceDuration: number
) {
  const clipStart = getClipStartOffset(video);
  const playableDuration = getPlayableDuration(video, sourceDuration);
  return clamp(absolutePosition - clipStart, 0, playableDuration);
}

function getAbsolutePlaybackPosition(
  video: {
    duration: number;
    isClip?: boolean;
    clipStart?: number;
    clipEnd?: number;
  } | null | undefined,
  relativePosition: number,
  sourceDuration: number
) {
  return (
    getClipStartOffset(video) +
    clamp(relativePosition, 0, getPlayableDuration(video, sourceDuration))
  );
}

export default function PlayerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id, folder: routeFolder } = route.params || { id: "", folder: undefined };
  const routeVideoId = Array.isArray(id) ? id[0] : id;
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

  const [activeVideoId, setActiveVideoId] = useState(routeVideoId);
  const [isPlaying, setIsPlaying] = useState(settings.autoPlay);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sourceDuration, setSourceDuration] = useState(0);
  const [seekPreviewPosition, setSeekPreviewPosition] = useState<number | null>(null);
  const [speed, setSpeed] = useState(settings.speed);
  const [volume, setVolume] = useState(clamp01(settings.defaultVolume));
  const [brightnessLevel, setBrightnessLevel] = useState(clamp01(settings.defaultBrightness ?? 0.5));
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
  const [validatedPlaybackUri, setValidatedPlaybackUri] = useState<string | null>(null);
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
  const screenshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumePersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeNativeCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumePromptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureFrame = useRef<number | null>(null);
  const lastAudibleVolume = useRef(clamp01(settings.defaultVolume) > 0.001 ? clamp01(settings.defaultVolume) : 1);
  const pendingGestureUpdate = useRef<| { mode: "seek"; value: number; duration: number; direction: "forward" | "rewind" } | null>(null);
  const seekPreviewPositionRef = useRef<number | null>(null);
  const lastTap = useRef<{ time: number; zone: TapZone | null }>({ time: 0, zone: null });
  const hasRestoredPosition = useRef(false);

  const backgroundPlayRef = useRef(settings.backgroundPlay);
  const lastSavedPosition = useRef(0);
  const completionHandledVideoId = useRef<string | null>(null);
  const playbackErrorHandledVideoId = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);
  const autoPlayCountdownActiveRef = useRef(false);
  const videoRef = useRef<VideoRef | null>(null);
  const playerRef = useRef<VideoPlayerShim | null>(null);
  const lastSentPlayingStateRef = useRef<boolean | null>(null); // Track last play/pause command sent to native player

  const hasStartedRef = useRef<boolean>(false); // True once startPlayback has fired for the current video; reset on videoId change
  const fallbackRetryCountRef = useRef<number>(0); // Caps validation fallbacks per video so we don't loop
  const seekNudgeUsedRef = useRef<boolean>(false); // Tier-1 recovery: try a tiny seek before destroying state
  // Phase 1 diagnostic refs — let the validator distinguish slow-startup from real freeze
  const videoErrorRef = useRef<{ errorString?: string; errorException?: unknown } | null>(null);
  const onLoadFiredRef = useRef<boolean>(false);
  const onReadyForDisplayFiredRef = useRef<boolean>(false);
  const onProgressFiredRef = useRef<boolean>(false);
  const loadStartTimestampRef = useRef<number | null>(null);
  // Absolute seconds to seek to as soon as the source is loaded. Used to
  // survive the race between startPlaybackUnified() firing and <Video> having
  // mounted/loaded — without forcing a source-object change.
  const pendingResumeSeekRef = useRef<number | null>(null);
  // Stall recovery / state-change debouncing
  const playbackStateChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forcedPlayCountRef = useRef<number>(0);
  const lastReadyTimestampRef = useRef<number>(0);
  const stallDetectionRef = useRef<{
    lastPosition: number;
    lastTimestamp: number;
    stallCount: number;
    recoveryAttempted: boolean;
  }>({ lastPosition: 0, lastTimestamp: 0, stallCount: 0, recoveryAttempted: false });
  const queueListRef = useRef<FlatList<(typeof videos)[number]> | null>(null);
  const loadedPlayerVideoId = useRef<string | null>(null);
  const orientationManagedRef = useRef(false);
  const autoPlayCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayIntentRef = useRef(settings.autoPlay);
  const discoveryHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideDiscoveryHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundHandoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const validatedPlaybackUriRef = useRef<string | null>(null);
  const [showEndingOverlay, setShowEndingOverlay] = useState(false);
  const gestureRef = useRef<{ mode: GestureMode | null; startX: number; startPosition: number; startVolume: number; startBrightness: number }>({
    mode: null,
    startX: 0,
    startPosition: 0,
    startVolume: 1,
    startBrightness: 0.5,
  });
  const video = useMemo(() => {
    const listedVideo = videos.find((item) => item.id === activeVideoId);
    if (listedVideo) return listedVideo;
    if (currentVideo?.id === activeVideoId) return currentVideo;
    if (storedVideo?.id === activeVideoId) return storedVideo;
    return null;
  }, [activeVideoId, currentVideo, storedVideo, videos]);

  const videoId = video?.id;

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

  const handleNavigateToVideo = useCallback(
    (targetVideo: VideoItem, direction: "next" | "prev") => {
      if (!targetVideo || !videoId || !playerRef.current) return;

      const currentPosition = Number.isFinite(playerRef.current.currentTime)
        ? getRelativePlaybackPosition(
          video,
          playerRef.current.currentTime,
          sourceDuration || playerRef.current.duration || duration || video?.duration || 0
        )
        : position;

      if (settings.rememberPosition && currentPosition > 0) {
        void updateLastPosition(
          videoId,
          currentPosition,
          getPlayableDuration(video, sourceDuration || playerRef.current.duration || duration || video?.duration || 0)
        );
      }

      runTransition(targetVideo.title, direction);
      playerRef.current.pause();
      setActiveVideoId(targetVideo.id);
      // Reset playback state for new video
      setIsPlaying(false);
      setPlaybackStartupError(null);
      hasStartedRef.current = false;
      hasRestoredPosition.current = false;
      autoResumeCompletedRef.current = false;
    },
    [
      duration,
      position,
      settings.rememberPosition,
      sourceDuration,
      updateLastPosition,
      video,
      videoId,
      runTransition
    ]
  );



  const volumeHudOpacitySV = useSharedValue(0);
  const brightnessHudOpacitySV = useSharedValue(0);
  const seekHudOpacitySV = useSharedValue(0);
  const sideGestureMessageOpacitySV = useSharedValue(0);
  const volumeHudTranslateSV = useSharedValue(90);
  const brightnessHudTranslateSV = useSharedValue(-90);
  const volumeHudHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessHudHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sideGestureMessageHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeHudAnimStyle = useAnimatedStyle(() => ({ opacity: volumeHudOpacitySV.value, transform: [{ translateX: volumeHudTranslateSV.value }] }));
  const brightnessHudAnimStyle = useAnimatedStyle(() => ({ opacity: brightnessHudOpacitySV.value, transform: [{ translateX: brightnessHudTranslateSV.value }] }));
  const seekHudAnimStyle = useAnimatedStyle(() => ({ opacity: seekHudOpacitySV.value }));
  const sideGestureMessageAnimStyle = useAnimatedStyle(() => ({ opacity: sideGestureMessageOpacitySV.value }));
  const [volumeHudPercent, setVolumeHudPercent] = useState(0);
  const [brightnessHudPercent, setBrightnessHudPercent] = useState(0);
  const [sideGestureMessage, setSideGestureMessage] = useState<{ label: string; tone: "volume" | "brightness" } | null>(null);
  const [volumeDirection, setVolumeDirection] = useState<'up' | 'down' | null>(null);
  const [brightnessDirection, setBrightnessDirection] = useState<'up' | 'down' | null>(null);
  const prevVolumePercentRef = useRef(0);
  const prevBrightnessPercentRef = useRef(0);
  const nightModeRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const isLockedRef = useRef(false);
  const brightnessSavedRef = useRef(false);
  const brightnessRestoredRef = useRef(false);
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
  const edgeVerticalGestureRef = useRef<{
    mode: "brightness" | "volume" | null;
    startValue: number;
    lastValue: number;
    limit: "min" | "max" | null;
  }>({
    mode: null,
    startValue: 0,
    lastValue: 0,
    limit: null,
  });
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

  const videoQueue = useMemo(() => {
    if (routeFolder && folderQueueVideos.length > 0) {
      return folderQueueVideos;
    }
    return hydratedVideos.filter((item) => item.mediaType !== "audio");
  }, [hydratedVideos, routeFolder, folderQueueVideos]);
  const audioQueue = useMemo(() => hydratedVideos.filter((item) => item.mediaType === "audio"), [hydratedVideos]);
  const mediaType = video?.mediaType ?? "video";
  const isAudioMode = mediaType === "audio";
  const effectiveOrientationMode = isAudioMode ? "portrait" : orientationMode;
  const playbackUri = getPlaybackUri(video);
  const clipStartOffset = getClipStartOffset(video);
  const clipEndPosition = getClipEndPosition(video);

  const currentIndex = videoId ? videoQueue.findIndex((item) => item.id === videoId) : -1;
  const isLandscapeLayout = viewport.width > viewport.height;
  const previousVideo = currentIndex > 0 ? videoQueue[currentIndex - 1] : null;
  const nextVideo = currentIndex >= 0 && currentIndex < videoQueue.length - 1 ? videoQueue[currentIndex + 1] : null;
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
  const decoderViewType = Platform.OS === "android" ? (decoderMode === "hw" ? ViewType.TEXTURE : ViewType.SURFACE) : undefined;
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
    void playAudio(audioQueue.length > 0 ? audioQueue : [video], startIndex);
    navigation.replace("audio-player");
  }, [audioQueue, isAudioMode, navigation, playAudio, video]);

  if (!playerRef.current && playbackUri && !isAudioMode) {
    const existingSession = getPlayerSession();
    const instance = existingSession?.player as VideoPlayerShim | undefined ?? createVideoPlayerShim(videoRef);
    instance.loop = Boolean(!video?.isClip && (settings.loopMode === "one" || (settings.loopMode === "all" && videoQueue.length <= 1)));
    instance.playbackRate = settings.speed;
    applyPlayerAudioState(instance, { volume, volumeBoost, isMuted, backgroundPlay: settings.backgroundPlay });
    if (settings.autoPlay) {
      void PlayerManager.playVideo();
      instance.play();
    }
    playerRef.current = instance;
    loadedPlayerVideoId.current = existingSession?.videoId ?? null;
    setPlayerSession(instance, loadedPlayerVideoId.current);
  }

  const player = playerRef.current;
  // const startVideoPlayback = useCallback(async () => {
  //   if (!player || isLocked) return;

  //   try {
  //     console.log("[Playback] startVideoPlayback called");
  //     autoPlayIntentRef.current = true;
  //     await PlayerManager.playVideo();
  //     playbackStartTimeRef.current = null; // Reset validation timer
  //     setIsPlaying(true); // Centralized effect will call player.play()
  //     console.log("[Playback] startVideoPlayback: Set isPlaying=true");
  //   } catch (e) {
  //     console.error("[Playback] Video playback start failed:", e);
  //     setIsPlaying(false);
  //   }
  // }, [isLocked, player]);

  const startPlaybackUnified = useCallback(async (options?: {
    startPosition?: number;
    forceReset?: boolean;
  }) => {
    if (!playerRef.current || !validatedPlaybackUri) {
      console.warn('[Playback] Cannot start - no player or URI');
      return false;
    }

    try {
      const totalDuration = sourceDuration || video?.duration || 0;
      const startPos = options?.startPosition ?? 0;
      const safePosition = Math.min(Math.max(startPos, 0), Math.max(totalDuration - 1, 0));
      const absolutePosition = getAbsolutePlaybackPosition(video, safePosition, totalDuration);

      console.log('[Playback] Starting at', safePosition.toFixed(1), '/', totalDuration.toFixed(1));

      // Direct seek using video ref. If <Video> hasn't loaded yet the call
      // is a no-op, so also stash the position for handleVideoLoad to apply.
      pendingResumeSeekRef.current = absolutePosition > 0 ? absolutePosition : null;
      videoRef.current?.seek(absolutePosition);
      
      // Reset guards
      hasStartedRef.current = true;
      hasRestoredPosition.current = true;
      autoResumeCompletedRef.current = true;
      autoPlayIntentRef.current = true;
      
      // Small delay for seek to complete then play
      setTimeout(() => {
        if (playerRef.current && autoPlayIntentRef.current) {
          try {
            playerRef.current.play();
            setIsPlaying(true);
            setPosition(safePosition);
            setShowStartOverButton(options?.startPosition ? !!options.startPosition : false);
            setResumePrompt(null);
          } catch (e) {
            console.error('[Playback] Native play failed:', e);
          }
        }
      }, 100);

      return true;
    } catch (e) {
      console.error('[Playback] startPlaybackUnified failed:', e);
      return false;
    }
  }, [validatedPlaybackUri, sourceDuration, video]);

  const handleVideoLoad = useCallback((data: any) => {
    try {
      console.log('[Video] Loaded - duration:', data.duration);
      
      onLoadFiredRef.current = true;
      
      // Update shim
      const shim = playerRef.current as any;
      if (shim) {
        shim._setDuration?.(data.duration);
      }
      
      setDuration(data.duration);
      setSourceDuration(data.duration);

      // If startPlaybackUnified queued a resume position before the source
      // was ready, apply it now that the player can accept the seek.
      if (pendingResumeSeekRef.current !== null && pendingResumeSeekRef.current > 0) {
        const seekTo = pendingResumeSeekRef.current;
        pendingResumeSeekRef.current = null;
        try {
          videoRef.current?.seek(seekTo);
          const shim = playerRef.current as any;
          shim?._setCurrentTime?.(seekTo);
        } catch (e) {
          console.warn('[Video] Resume seek on load failed', e);
        }
      }

      // Update audio tracks
      const nextAudioTracks = data.audioTracks ?? [];
      setAudioTracks(nextAudioTracks);
      const selectedTrack = nextAudioTracks.find((track: any) => track.selected);
      setSelectedAudioTrackIndex(
        selectedTrack?.index ?? 
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
  }, [video, videoId, updateMediaDuration]);

  const handleVideoProgress = useCallback((data: any) => {
    try {
      if (!onProgressFiredRef.current) {
        onProgressFiredRef.current = true;
      }
      
      // Update shim with minimal overhead
      const shim = playerRef.current as any;
      if (shim) {
        shim._setCurrentTime?.(data.currentTime);
        shim._setDuration?.(data.seekableDuration);
      }
      
      // Clear pending seek if reached
      if (pendingSeekAbsoluteRef.current !== null && 
          Math.abs(data.currentTime - pendingSeekAbsoluteRef.current) < 0.75) {
        pendingSeekAbsoluteRef.current = null;
      }

      // Update displayed position (drives seekbar & time labels)
      const effectiveDuration = data.seekableDuration || duration;
      const relativeTime = getRelativePlaybackPosition(video, data.currentTime, effectiveDuration);
      if (!isScrubbingRef.current) {
        setPosition(relativeTime);
      }
      
      // Show ending overlay (last 5 seconds)
      const playableDur = getPlayableDuration(video, effectiveDuration);
      const remaining = playableDur - relativeTime;
      
      if (nextVideo && remaining > 0 && remaining <= 5 && !showEndingOverlay) {
        setShowEndingOverlay(true);
      } else if (showEndingOverlay && (remaining > 5 || !nextVideo)) {
        setShowEndingOverlay(false);
      }

      // Auto-save position periodically
      if (settings.rememberPosition && videoId && relativeTime > 0) {
        const diff = Math.abs(relativeTime - lastSavedPosition.current);
        if (diff >= 5) {
          lastSavedPosition.current = relativeTime;
          void updateLastPosition(videoId, relativeTime, playableDur);
        }
      }
    } catch (e) {
      console.error('[Video] Progress handling failed:', e);
    }
  }, [video, duration, nextVideo, showEndingOverlay, settings.rememberPosition, videoId, updateLastPosition]);

  const clearReleasedPlayer = useCallback((candidate?: VideoPlayerShim | null) => {
    if (candidate && playerRef.current !== candidate) return;
    releasePlayerSession(candidate ?? playerRef.current);
    playerRef.current = null;
    loadedPlayerVideoId.current = null;
    setIsPlaying(false);
    setDuration(0);
    setSourceDuration(0);
  }, []);

  useEffect(() => {
    if (!player) return;
    try {
      player.loop = Boolean(!video?.isClip && (settings.loopMode === "one" || (settings.loopMode === "all" && videoQueue.length <= 1)));
      player.playbackRate = settings.speed;
      applyPlayerAudioState(player, {
        volume,
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
    volume,
    volumeBoost,
    video?.isClip,
    videoQueue.length,
    clearReleasedPlayer,
  ]);

  useEffect(() => {
    if (!player) return;

    const stopVideoPlayback = () => {
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
  }, [player]);

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
        console.log("[Playback] play()");
        playerRef.current.play();
      } else {
        console.log("[Playback] pause()");
        playerRef.current.pause();
      }
      lastSentPlayingStateRef.current = isPlaying;
    } catch (e) {
      console.error("[Playback] Playback sync failed:", e);
      lastSentPlayingStateRef.current = null; // Reset on error for recovery attempt
    }

  }, [isPlaying]);



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
    validatedPlaybackUriRef.current = null;
    setValidatedPlaybackUri(null);
    setPlaybackStartupError(null);
    setResumePrompt(null);
    setResumeCheckPending(Boolean(videoId && settings.rememberPosition));
    autoPlayIntentRef.current = settings.autoPlay;
    // Don't set isPlaying=true here — wait until the native player is ready
    // (onReadyForDisplay) or the resume prompt effect handles it.
    setIsPlaying(false);
    hasRestoredPosition.current = false;
    hasStartedRef.current = false;
    fallbackRetryCountRef.current = 0;
    seekNudgeUsedRef.current = false;
    videoErrorRef.current = null;
    onLoadFiredRef.current = false;
    onReadyForDisplayFiredRef.current = false;
    onProgressFiredRef.current = false;
    loadStartTimestampRef.current = null;
    pendingResumeSeekRef.current = null;
    setPendingStartPositionMs(null);
    forcedPlayCountRef.current = 0;
    lastReadyTimestampRef.current = 0;
    stallDetectionRef.current = { lastPosition: 0, lastTimestamp: 0, stallCount: 0, recoveryAttempted: false };
    if (playbackStateChangeTimerRef.current) {
      clearTimeout(playbackStateChangeTimerRef.current);
      playbackStateChangeTimerRef.current = null;
    }
    // Reset decoder to default — don't carry SW-mode failure across videos
    setDecoderMode("hwPlus");
    lastSavedPosition.current = 0;
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
  }, [settings.autoPlay, settings.rememberPosition, videoId]);

  useEffect(() => {
    if (!player || !videoId || isAudioMode) return;
    loadedPlayerVideoId.current = videoId;
    setPlayerSession(player, videoId);
  }, [isAudioMode, player, videoId]);



  useEffect(() => {
    if (video && !playbackUri) {
      setPlaybackStartupError("This library item does not have a playable media path.");
    }
  }, [playbackUri, video]);

  useEffect(() => {
    let cancelled = false;

    async function validatePlaybackSource() {
      if (!video) {
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
      if (validatedPlaybackUriRef.current !== normalizedUri) {
        setValidatedPlaybackUri(null);
      }
      setPlaybackStartupError(null);

      const localPath = getLocalFilePath(playbackUri);
      if (localPath) {
        try {
          const exists = await RNFS.exists(localPath);
          if (cancelled) return;
          if (!exists) {
            validatedPlaybackUriRef.current = null;
            setValidatedPlaybackUri(null);
            setPlaybackStartupError("Media file not found on storage. Rescan the library or remove this unavailable item.");
            return;
          }
        } catch {
          if (cancelled) return;
          validatedPlaybackUriRef.current = null;
          setValidatedPlaybackUri(null);
          setPlaybackStartupError("Cannot access this media file. Check storage permission and rescan the library.");
          return;
        }
      }

      if (!cancelled) {
        validatedPlaybackUriRef.current = normalizedUri;
        setValidatedPlaybackUri((current) => (current === normalizedUri ? current : normalizedUri));
      }
    }

    void validatePlaybackSource();

    return () => {
      cancelled = true;
    };
  }, [playbackUri, videoId]);

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
    const nextVolume = clamp01(settings.defaultVolume);
    resetVolumeGestureThrottle(nextVolume);
    if (nextVolume > 0.001) {
      lastAudibleVolume.current = nextVolume;
    }
    setVolume(nextVolume);
    setIsMuted(nextVolume <= 0.001);
  }, [settings.defaultVolume]);

  // useEffect(() => {
  //   if (!player) return;
  //   if (!video || hasRestoredPosition.current || resumeCheckPending) {
  //     return;
  //   }

  //   // consumeFreshVideoSession() returns true when this session was opened after a
  //   // type-switch (audio→video).  In that case always start from position 0 —
  //   // never restore the last saved position.
  //   const isFreshSwitch = consumeFreshVideoSession();

  //   if (!isFreshSwitch && resumePrompt) {
  //     // player.pause();
  //     // setIsPlaying(false);
  //     // setControlsVisible(true);

  //      try {
  //       const absolutePosition = getAbsolutePlaybackPosition(
  //         video,
  //         resumePrompt.position,
  //         sourceDuration || player.duration || duration || video.duration || resumePrompt.position
  //       );
  //       pendingSeekAbsoluteRef.current = absolutePosition;
  //       player.currentTime = absolutePosition;
  //       setPosition(resumePrompt.position);
  //     } catch {
  //       clearReleasedPlayer(player);
  //     }
  //     hasRestoredPosition.current = true;
  //     return;
  //   }

  //   if (isFreshSwitch) {
  //     setResumePrompt(null);
  //   }

  //   try {
  //     const absolutePosition = getAbsolutePlaybackPosition(video, 0, sourceDuration || video.duration);
  //     pendingSeekAbsoluteRef.current = absolutePosition;
  //     player.currentTime = absolutePosition;
  //     setPosition(0);
  //   } catch {
  //     clearReleasedPlayer(player);
  //   }

  //   hasRestoredPosition.current = true;
  // }, [player, resumeCheckPending, resumePrompt, sourceDuration, video, clearReleasedPlayer]);

  useEffect(() => {
    if (!video || !player || !validatedPlaybackUri) return;
    const initPlayback = async () => {
      const isFreshSwitch = consumeFreshVideoSession();
      
      if (!isFreshSwitch && settings.rememberPosition && videoId) {
        const progress = await getPlaybackProgress(videoId);
        
        if (progress && !progress.completed && progress.positionSeconds > 1) {
          console.log('[Resume] Found saved position:', progress.positionSeconds);
          setResumeCheckPending(false);
          startPlaybackUnified({ startPosition: progress.positionSeconds });
          return;
        }
      }

      setResumeCheckPending(false);
      startPlaybackUnified({ startPosition: 0 });
    };

    if (!hasStartedRef.current) {
      void initPlayback();
    }
  }, [player, settings.rememberPosition, validatedPlaybackUri, video, videoId, getPlaybackProgress, startPlaybackUnified]);

  useEffect(() => {
    if (sleepTimerRemaining === null || sleepTimerRemaining <= 0) return;

    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (playerRef.current) {
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
  }, [autoPlayCountdown, autoPlayTarget, nextVideo]);

  useEffect(() => {
    if (!nextVideo || isAudioMode || !isPlaying) {
      setShowUpNextPopup(false);
      return;
    }

    const remaining = duration - position;
    if (remaining > 0 && remaining <= 8) {
      setShowUpNextPopup(true);
    } else {
      setShowUpNextPopup(false);
    }
  }, [duration, isAudioMode, isPlaying, nextVideo, position]);

  useEffect(() => {
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
  }, []);

  const handleSetSleepTimer = useCallback((minutes: number | null) => {
    if (minutes === null) {
      setSleepTimerRemaining(null);
      showHud("seek", "Sleep timer off", 0.1);
    } else {
      const seconds = minutes * 60;
      setSleepTimerRemaining(seconds);
      showHud("seek", `Sleep timer set for ${minutes}m`, 0.8);
    }
  }, [showHud]);

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
    setResumePrompt(null);

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
  }, [clearPlaybackProgress, showHud, startPlaybackUnified, videoId]);

  useEffect(() => {
    if (!player) return;
    if (!videoId) return;

    let backgroundHandoffState: {
      active: boolean;
      position: number;
    } = { active: false, position: 0 };

    const subscription = AppState.addEventListener("change", async (nextState) => {
      let nextPosition = position;
      try {
        nextPosition = Number.isFinite(player.currentTime)
          ? getRelativePlaybackPosition(
            video,
            player.currentTime,
            sourceDuration || player.duration || duration || video?.duration || 0
          )
          : position;
      } catch {
        // player might be gone
      }

      if (nextState === "background" || nextState === "inactive") {
        if (settings.rememberPosition && nextPosition > 0) {
          void updateLastPosition(
            videoId,
            nextPosition,
            getPlayableDuration(video, sourceDuration || player.duration || duration || video?.duration || 0)
          );
        }

        if (settings.backgroundPlay && playbackUri && player.playing && isTrackPlayerAvailable) {
          try {
            // Fix #7: Use the current folder queue (videoQueueRef) for background notification
            // so next-up tracks follow folder order, not watch history
            const currentQueue = videoQueueRef.current.length > 0 ? videoQueueRef.current : videoQueue;
            const { queue, index } = buildHandoffQueue(currentQueue, video, playbackUri, currentIndexRef.current);
            const handoffPosition = player.currentTime;
            backgroundHandoffState.active = true;
            audioHandoffInProgressRef.current = true;
            autoPlayIntentRef.current = false;
            await playAudio(queue, index);
            await TrackPlayer.seekTo(handoffPosition);
            if (backgroundHandoffTimerRef.current) {
              clearTimeout(backgroundHandoffTimerRef.current);
            }
            backgroundHandoffTimerRef.current = setTimeout(async () => {
              try {
                player.pause();
                await TrackPlayer.play();
              } catch (e) { }
            }, 100);
          } catch (e) {
            audioHandoffInProgressRef.current = false;
            console.log("TrackPlayer background handoff failed", e);
          }
        } else if (!settings.backgroundPlay) {
          try {
            player.pause();
            setIsPlaying(false);
          } catch {
            clearReleasedPlayer(player);
          }
        }
        // If backgroundPlay is true but TrackPlayer unavailable, the native
        // player continues via playInBackground={true} on the Video component.
      } else if (nextState === "active") {
        // Restore from TrackPlayer
        if (backgroundHandoffState.active && isTrackPlayerAvailable && isTrackPlayerReady()) {
          try {
            const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
            const trackPlayerPosition = await TrackPlayer.getPosition();
            const trackPlayerState = await TrackPlayer.getPlaybackState();
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
    position,
    sourceDuration,
    settings.backgroundPlay,
    settings.rememberPosition,
    playbackUri,
    playAudio,
    updateLastPosition,
    video,
    videoId,
    currentIndex,
    duration,
    clearReleasedPlayer,
    videoQueue,
  ]);

  // Player brightness is session-local. Outside the player, the app follows
  // the system brightness; when leaving the player we clear the app override.
  const restoreBrightnessOnce = useCallback(() => {
    if (!brightnessSavedRef.current || brightnessRestoredRef.current) return;
    brightnessRestoredRef.current = true;
    void restorePlayerBrightness().catch((e) => {
      L.error("restore brightness failed", { error: e });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const setupBrightness = async () => {
      // Use the persisted app settings brightness to restore user preference
      const initial = clamp01(settings.defaultBrightness ?? 0.5);
      if (cancelled) return;
      brightnessSavedRef.current = true;
      brightnessRestoredRef.current = false;
      resetBrightnessGestureThrottle(initial);
      setBrightnessLevel(initial);
      try {
        await setPlayerBrightness(initial);
      } catch (e) {
        L.error("set app brightness failed", { error: e });
      }
    };

    void setupBrightness();

    // Restore system brightness when the player unmounts (navigating away).
    return () => {
      cancelled = true;
      restoreBrightnessOnce();
    };
  }, []); // intentionally empty — runs only on mount/unmount

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        restoreBrightnessOnce();
      } else if (nextState === "active" && brightnessSavedRef.current && brightnessRestoredRef.current) {
        brightnessRestoredRef.current = false;
        resetBrightnessGestureThrottle(brightnessLevel);
        setPlayerBrightness(brightnessLevel).catch((e) => {
          L.error("set app brightness failed", { error: e });
        });
      }
    });

    const navigationSubscription = navigation.addListener("beforeRemove", restoreBrightnessOnce);

    return () => {
      appStateSubscription.remove();
      navigationSubscription();
    };
  }, [brightnessLevel, navigation, restoreBrightnessOnce]);

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

  const scheduleNativeVolumeCommit = useCallback((nextVolume: number) => {
    if (volumeNativeCommitTimer.current) {
      clearTimeout(volumeNativeCommitTimer.current);
    }
    volumeNativeCommitTimer.current = setTimeout(() => {
      void setDeviceVolume(nextVolume).catch((error) => {
        console.warn("System volume commit failed:", error);
      });
    }, 90);
  }, []);

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

  const handlePlayPause = useCallback(() => {
    try {
      if (!player || isLocked) return;
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
      if (nextPlaying) {
        setIsPlaying(true);
      } else {
        autoPlayIntentRef.current = false;
        player.pause();
        setIsPlaying(false);
      }
      // M3: Re-arm auto-hide timer so user has full window to react to the new state
      scheduleHideControls();
    } catch (e) {
      console.error("Play/Pause failed:", e);
    }
  }, [player, isLocked, isPlaying, resumePrompt, scheduleHideControls]);

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
      setSeekPreviewPosition(null);
      seekPreviewPositionRef.current = null;
    },
    [duration, player, sourceDuration, video]
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
  }, []);

  const getChainedSeekAmount = useCallback((zone: 'left' | 'right') => {
    const chain = doubleTapChainRef.current;
    if (chain.zone === zone) {
      chain.count = Math.min(chain.count + 1, 3);
    } else {
      chain.zone = zone;
      chain.count = 1;
    }
    if (chain.resetTimer) clearTimeout(chain.resetTimer);
    chain.resetTimer = setTimeout(resetDoubleTapChain, DOUBLE_TAP_TIMEOUT);
    return DOUBLE_TAP_SEEK_SECONDS * chain.count;
  }, [resetDoubleTapChain]);

  const handleSeekForward = useCallback(() => {
    const seekAmount = getChainedSeekAmount('right');
    const basePosition = seekPreviewPosition ?? position;
    const safeDuration = duration > 0 ? duration : Math.max(basePosition, 0);
    const nextPosition = clamp(basePosition + seekAmount, 0, safeDuration || 0);
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    handleSeek(nextPosition);
    showHud(
      "seek",
      `+${seekAmount}s`,
      safeDuration > 0 ? nextPosition / safeDuration : 0
    );
  }, [
    duration,
    getChainedSeekAmount,
    handleSeek,
    position,
    seekPreviewPosition,
    showHud,
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
    showHud(
      "seek",
      `-${seekAmount}s`,
      safeDuration > 0 ? nextPosition / safeDuration : 0
    );
  }, [
    duration,
    getChainedSeekAmount,
    handleSeek,
    position,
    seekPreviewPosition,
    showHud,
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
      const isGestureDriven =
        activeGestureMode === "volume" || edgeVerticalGestureRef.current.mode === "volume";
      if (isGestureDriven && nextStep !== prevVolumePercentRef.current) {
        if (Platform.OS !== "web") {
          ReactNativeHapticFeedback.trigger("selection", { enableVibrateFallback: false });
        }
        prevVolumePercentRef.current = nextStep;
      }

      if (player) {
        applyPlayerAudioState(player, {
          volume: clampedVolume,
          volumeBoost,
          isMuted: nextMuted,
          backgroundPlay: settings.backgroundPlay,
        });
      }
      scheduleVolumeSettingSave(clampedVolume);
      if (isGestureDriven) {
        scheduleNativeVolumeCommit(clampedVolume);
      } else {
        void setDeviceVolumeForGesture(clampedVolume);
      }
      showVolumeHud(clampedVolume);
    },
    [activeGestureMode, player, scheduleNativeVolumeCommit, scheduleVolumeSettingSave, settings.backgroundPlay, showVolumeHud, volumeBoost]
  );

  const handleSetBrightness = useCallback(
    (nextBrightness: number) => {
      const clampedBrightness = clamp01(nextBrightness);
      setBrightnessLevel(clampedBrightness);

      void setPlayerBrightnessForGesture(clampedBrightness);

      const nextStep = Math.round(clampedBrightness * 10);
      const isGestureDriven =
        activeGestureMode === "brightness" || edgeVerticalGestureRef.current.mode === "brightness";
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

  const beginEdgeVerticalGesture = useCallback(
    (mode: "brightness" | "volume") => {
      if (isLocked || !video) {
        edgeVerticalGestureRef.current = { mode: null, startValue: 0, lastValue: 0, limit: null };
        return;
      }

      if (
        (mode === "brightness" && (isAudioMode || !settings.swipeBrightness)) ||
        (mode === "volume" && !settings.swipeVolume)
      ) {
        edgeVerticalGestureRef.current = { mode: null, startValue: 0, lastValue: 0, limit: null };
        return;
      }

      const startValue = mode === "brightness" ? brightnessLevel : volume;
      edgeVerticalGestureRef.current = {
        mode,
        startValue,
        lastValue: startValue,
        limit: startValue <= 0.001 ? "min" : startValue >= 0.999 ? "max" : null,
      };
      if (mode === "brightness") {
        prevBrightnessPercentRef.current = Math.round(startValue * 10);
        // Show HUD immediately so user gets feedback even before any movement.
        showBrightnessHud(startValue);
      } else {
        prevVolumePercentRef.current = Math.round(startValue * 10);
        showVolumeHud(startValue);
      }

      // Do NOT clear tapTimer/lastTap here — let PanResponder handle taps normally.
      // Haptic feedback deferred — fires on first value-step change, not on touch-down
    },
    [
      brightnessLevel,
      isAudioMode,
      isLocked,
      settings.swipeBrightness,
      settings.swipeVolume,
      video,
      volume,
      showBrightnessHud,
      showVolumeHud,
    ]
  );

  const updateEdgeVerticalGesture = useCallback(
    (translationY: number) => {
      const activeGesture = edgeVerticalGestureRef.current;
      if (!activeGesture.mode) return;

      const valueDelta = resolveVerticalGestureDelta({
        dy: translationY,
        viewportHeight: effectiveViewportHeight,
      });
      const nextValue = clamp01(activeGesture.startValue + valueDelta);
      const nextLimit = nextValue <= 0.001 ? "min" : nextValue >= 0.999 ? "max" : null;

      if (
        activeGesture.limit === "min" &&
        nextLimit === "min" &&
        valueDelta <= 0
      ) {
        return;
      }

      if (
        activeGesture.limit === "max" &&
        nextLimit === "max" &&
        valueDelta >= 0
      ) {
        return;
      }

      if (Math.abs(nextValue - activeGesture.lastValue) < 0.001) {
        return;
      }

      activeGesture.lastValue = nextValue;
      activeGesture.limit = nextLimit;

      if (activeGesture.mode === "brightness") {
        handleSetBrightness(nextValue);
        return;
      }

      handleSetVolume(nextValue);
    },
    [
      effectiveViewportHeight,
      handleSetBrightness,
      handleSetVolume,
    ]
  );

  const endEdgeVerticalGesture = useCallback(() => {
    const { mode, startValue, lastValue } = edgeVerticalGestureRef.current;
    const wasTap = mode !== null && lastValue === startValue;
    edgeVerticalGestureRef.current = { mode: null, startValue: 0, lastValue: 0, limit: null };
    if (wasTap) {
      // No drag movement — treat as a tap and show/hide controls
      toggleControls();
    }
  }, [toggleControls]);

  const createEdgeVerticalGesture = useCallback(
    (mode: "brightness" | "volume") =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(EDGE_VERTICAL_GESTURE_ACTIVATION_DISTANCE)
        .activeOffsetY([
          -EDGE_VERTICAL_GESTURE_ACTIVATION_DISTANCE,
          EDGE_VERTICAL_GESTURE_ACTIVATION_DISTANCE,
        ])
        .failOffsetX([
          -GESTURE_ACTIVATION_DISTANCE * 2.5,
          GESTURE_ACTIVATION_DISTANCE * 2.5,
        ])
        .onBegin(() => {
          beginEdgeVerticalGesture(mode);
        })
        .onUpdate((event) => {
          updateEdgeVerticalGesture(event.translationY);
        })
        .onFinalize(() => {
          endEdgeVerticalGesture();
        }),
    [beginEdgeVerticalGesture, endEdgeVerticalGesture, updateEdgeVerticalGesture]
  );

  const brightnessGesture = useMemo(
    () => createEdgeVerticalGesture("brightness"),
    [createEdgeVerticalGesture]
  );
  const volumeGesture = useMemo(
    () => createEdgeVerticalGesture("volume"),
    [createEdgeVerticalGesture]
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
        volume: targetVolume,
        volumeBoost,
        isMuted: targetVolume <= 0.001,
        backgroundPlay: settings.backgroundPlay,
      });
    }
    scheduleVolumeSettingSave(targetVolume);
    scheduleNativeVolumeCommit(targetVolume);
    showVolumeHud(targetVolume);
  }, [isMuted, player, scheduleNativeVolumeCommit, scheduleVolumeSettingSave, settings.backgroundPlay, showVolumeHud, volumeBoost]);

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
    if (isAudioMode) {
      showHud("seek", "Audio mode", 0.2);
      return;
    }

    if (zoomScale > MIN_PINCH_SCALE + 0.01) {
      handleSetZoomScale(MIN_PINCH_SCALE);
      return;
    }

    showHud("zoom", "Pinch with two fingers to zoom", 0.12);
  }, [handleSetZoomScale, isAudioMode, showHud, zoomScale]);

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
  }, [duration, isAudioMode, isLocked, video]);

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
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    setControlsVisible(true);
    if (nextLocked) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      edgeVerticalGestureRef.current = { mode: null, startValue: 0, lastValue: 0, limit: null };
      gestureRef.current.mode = null;
      setActiveGestureMode(null);
      setUtilityRailExpanded(false);
      setQuickActionsExpanded(false);
      setPropertiesPanelVisible(false);
      setTrimPanelVisible(false);
    }
  }, [isLocked]);

  const showLockedScreenAlert = useCallback(() => {
    return;
  }, []);

  const handleToggleNightMode = useCallback(() => {
    const nextNightMode = !nightMode;
    setNightMode(nextNightMode);
    showBrightnessHud(nextNightMode ? 0.8 : brightnessLevel);
  }, [brightnessLevel, nightMode, showBrightnessHud]);

  const handleToggleBackgroundPlay = useCallback(() => {
    const nextBackgroundPlay = !backgroundPlayRef.current;
    backgroundPlayRef.current = nextBackgroundPlay;
    void updateSettings({ backgroundPlay: nextBackgroundPlay });

    if (player) {
      applyPlayerAudioState(player, {
        volume,
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
  }, [decoderMode, isAudioMode, showHud]);

  const handleCycleVolumeBoost = useCallback(() => {
    const currentIndex = VOLUME_BOOST_LEVELS.indexOf(volumeBoost);
    const nextBoost = VOLUME_BOOST_LEVELS[(currentIndex + 1) % VOLUME_BOOST_LEVELS.length];
    setVolumeBoost(nextBoost);

    if (player) {
      applyPlayerAudioState(player, {
        volume,
        volumeBoost: nextBoost,
        isMuted,
        backgroundPlay: settings.backgroundPlay,
      });
    }

    showVolumeHud(clamp01((volume * nextBoost) / 2));
  }, [isMuted, player, settings.backgroundPlay, showVolumeHud, volume, volumeBoost]);

  const handleCycleAudioTrack = useCallback(() => {
    if (audioTracks.length <= 1) {
      showHud("seek", "No alternate audio", 0.15);
      return;
    }

    const currentIndex = selectedAudioTrackIndex === null
      ? audioTracks.findIndex((track) => track.selected)
      : audioTracks.findIndex((track) => track.index === selectedAudioTrackIndex);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextTrack = audioTracks[(safeCurrentIndex + 1) % audioTracks.length];

    setSelectedAudioTrackIndex(nextTrack.index);
    showHud(
      "seek",
      `Audio ${getAudioTrackLabel(nextTrack)}`,
      audioTracks.length > 1 ? (safeCurrentIndex + 2) / audioTracks.length : 1
    );
  }, [audioTracks, selectedAudioTrackIndex, showHud]);

  const handleCycleOrientation = useCallback(() => {
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
  }, [isAudioMode, orientationMode, showHud]);

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
    if (!player || isLocked) return;
    longPressStartSpeedRef.current = speed;
    setLongPressActive(true);
    setSpeed(2);
    if (player) player.playbackRate = 2;
    showHud("seek", "2× Speed", 1);
  }, [player, isLocked, speed, showHud]);

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
    const targetIndex = Math.max(0, videoQueue.findIndex((v) => v.id === video.id));
    TrackPlayer.setQueue(tracks)
      .then(() => TrackPlayer.skip(targetIndex))
      .catch(() => { /* non-critical if audio session conflicts */ });
  }, [settings.backgroundPlay, isAudioMode, video, videoQueue]);

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
    const nextPosition = Number.isFinite(player.currentTime)
      ? getRelativePlaybackPosition(video, player.currentTime, sourceDuration || player.duration || duration)
      : position;

    if (videoId && settings.rememberPosition && nextPosition > 0) {
      void updateLastPosition(
        videoId,
        nextPosition,
        getPlayableDuration(video, sourceDuration || player.duration || duration || video?.duration || 0)
      );
    }
    if (settings.backgroundPlay && isTrackPlayerAvailable && player.playing) {
      const { queue, index } = buildHandoffQueue(videoQueue, video, playbackUri, currentIndex);
      const handoffPosition = player.currentTime;
      audioHandoffInProgressRef.current = true;
      void (async () => {
        try {
          await playAudio(queue, index);
          await TrackPlayer.seekTo(handoffPosition).catch(() => undefined);
          player.pause();
        } catch {
          // Fallback to local pause behavior when TrackPlayer handoff fails.
        } finally {
          audioHandoffInProgressRef.current = false;
        }
      })();
    } else if (!settings.backgroundPlay) {
      player.pause();
    }
    navigation.goBack();
  }, [
    currentIndex,
    isLocked,
    playbackUri,
    playAudio,
    player,
    position,
    settings.backgroundPlay,
    settings.rememberPosition,
    showLockedScreenAlert,
    sourceDuration,
    updateLastPosition,
    video,
    videoQueue,
    videoId,
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

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (!isMounted.current) return;

      try {
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

        if (seekPreviewPosition === null) {
          setPosition(nextPosition);
        }
        setDuration(nextDuration);
        setSourceDuration(nextSourceDuration);

        // Do NOT override isPlaying from the shim's polling state.
        // The shim's `_playing` flag is unreliable (stale on startup, may not reflect
        // native player). Let intentional actions control isPlaying:
        //   - handlePlayPause for user pause/play
        //   - onEnd for natural end of video
        //   - autoplay/resume effects for initial start
        // The polling interval only updates position/duration; nextIsPlaying is still
        // used below for end-of-video detection together with sourceReachedEnd.

        if (videoId && settings.rememberPosition && nextPosition > 0) {
          if (Math.abs(nextPosition - lastSavedPosition.current) >= 2) {
            lastSavedPosition.current = nextPosition;
            void updateLastPosition(videoId, nextPosition, nextDuration);
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
            navigation.goBack();
          }
        }

        wasPlayingRef.current = nextIsPlaying;
      } catch {
        clearReleasedPlayer(player);
        // Ignore transient player read errors while the source is mounting.
      }
    }, 250);

    return () => clearInterval(interval);
  }, [
    handleNavigateToVideo,
    nextVideo,
    player,
    navigation,
    isBuffering,
    isPlaying,
    playbackStartupError,
    resumeCheckPending,
    seekPreviewPosition,
    clipEndPosition,
    clipStartOffset,
    settings.loopMode,
    settings.rememberPosition,
    updateLastPosition,
    validatedPlaybackUri,
    clearPlaybackProgress,
    video,
    videoId,
    clearReleasedPlayer,
  ]);

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

    // Lock mode on first move based on starting edge
    if (!g.mode) {
      const zoneWidth = effectiveViewportWidth * DOUBLE_TAP_EDGE_RATIO;
      const isLeftZone = g.startX <= zoneWidth;
      const isRightZone = g.startX >= effectiveViewportWidth - zoneWidth;
      if (!isAudioMode && isLeftZone && settings.swipeBrightness) {
        g.mode = "brightness";
        if (gestureBarHideRef.current) clearTimeout(gestureBarHideRef.current);
        setActiveGestureMode("brightness");
        ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
        prevBrightnessPercentRef.current = Math.round(g.startBrightness * 10);
      } else if (isRightZone && settings.swipeVolume) {
        g.mode = "volume";
        if (gestureBarHideRef.current) clearTimeout(gestureBarHideRef.current);
        setActiveGestureMode("volume");
        ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
        prevVolumePercentRef.current = Math.round(g.startVolume * 10);
      } else {
        return; // not in an edge zone — ignore vertical
      }
    }

    const rawDelta = resolveVerticalGestureDelta({
      dy: translationY,
      viewportHeight: effectiveViewportHeight,
    });

    if (g.mode === "volume") {
      const nextVolume = clamp01(g.startVolume + applyGestureCurve(rawDelta, 1.35));
      handleSetVolume(nextVolume);
    } else if (g.mode === "brightness") {
      const nextBrightness = clamp01(g.startBrightness + applyGestureCurve(rawDelta, 1.35));
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
    const zone = getTapZone(x);
    if (zone === "left") {
      handleSeekBackward();
    } else if (zone === "right") {
      handleSeekForward();
    } else {
      // Center double tap toggles play/pause (MX style)
      handlePlayPause();
    }
  }, [isLocked, getTapZone, handleSeekBackward, handleSeekForward, handlePlayPause]);

  const handleSingleTapEvent = useCallback((x: number, y: number) => {
    if (isScrubbingRef.current || isLocked) return;
    handleTap({ nativeEvent: { locationX: x, locationY: y } } as any);
  }, [isLocked, handleTap]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()


        .enabled(!isLocked && !isAudioMode)
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
    [isLocked, isAudioMode, beginVideoGesture, handlePanUpdate, handlePanEnd, endVerticalGesture]
  );

  const verticalGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-GESTURE_ACTIVATION_DISTANCE, GESTURE_ACTIVATION_DISTANCE])
        .failOffsetX([-30, 30])
        .enabled(!isLocked)
        .onBegin((e) => runOnJS(beginVideoGesture)(e.x))
        .onUpdate((e) => runOnJS(updateVerticalGesture)(e.translationY))
        .onEnd(() => runOnJS(endVerticalGesture)())
        .onFinalize(() => runOnJS(endVerticalGesture)()),
    [isLocked, beginVideoGesture, updateVerticalGesture, endVerticalGesture]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .enabled(!isLocked)
        .onEnd((e) => runOnJS(handleSingleTapEvent)(e.x, e.y)),
    [isLocked, handleSingleTapEvent]
  );

  // Edge-zone vertical (brightness/volume) gestures are handled separately
  // via brightnessGesture / volumeGesture on edge-strip Views (~line 4226).
  // The full-screen composed gesture only owns seek + tap.
  const composedVideoGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture]
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
    if (!validatedPlaybackUri) return undefined;
    return { uri: validatedPlaybackUri };
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

  const isPreparingPlayback = Boolean(playbackUri && (!validatedPlaybackUri || resumeCheckPending) && !playbackStartupError);

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
                bufferConfig={VIDEO_BUFFER_CONFIG}
                onLoad={handleVideoLoad}
                onProgress={handleVideoProgress}
                onSeek={(data) => {
                  const seekTime = Number(data.currentTime ?? data.seekTime ?? 0);
                  if (Number.isFinite(seekTime)) {
                    const shim = playerRef.current as any;
                    shim?._setCurrentTime?.(seekTime);
                    pendingSeekAbsoluteRef.current = null;
                  }
                }}
                onError={(error) => {
                  videoErrorRef.current = (error as any)?.error ?? error ?? { errorString: "unknown" };
                  console.error("[Video] onError:", videoErrorRef.current);
                  L.error('playback error', { id: videoId, error });
                  if (videoId && playbackErrorHandledVideoId.current === videoId) return;
                  playbackErrorHandledVideoId.current = videoId ?? null;
                  setIsPlaying(false);
                  setPlaybackStartupError("This media could not be played. Try rescanning the library or removing the unavailable item.");
                }}
                onEnd={() => {
                  try {
                    const shim = playerRef.current as any;
                    if (shim) shim._setPlaying?.(false);
                    setIsPlaying(false);

                    // Clear saved progress when video completes
                    if (videoId && settings.rememberPosition) {
                      void clearPlaybackProgress(videoId);
                      setShowStartOverButton(false);
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
                    if (autoTarget) {
                      setAutoPlayTarget(autoTarget);
                      setAutoPlayCountdown(5);
                    }
                  } catch (e) {
                    console.error("End handling failed:", e);
                  }
                }}
              />
            </View>
            {/* Native device brightness handles dimming entirely */}
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
      {!isLocked ? (
        <>
          {!isAudioMode && settings.swipeBrightness ? (
            <GestureDetector gesture={brightnessGesture}>
              <View style={[styles.edgeGestureZone, styles.edgeGestureZoneLeft]} />
            </GestureDetector>
          ) : null}
          {settings.swipeVolume ? (
            <GestureDetector gesture={volumeGesture}>
              <View style={[styles.edgeGestureZone, styles.edgeGestureZoneRight]} />
            </GestureDetector>
          ) : null}
        </>
      ) : null}


      {isPreparingPlayback || playbackStartupError ? (
        <View pointerEvents="box-none" style={styles.playerStateOverlay}>
          <View style={styles.playerStateCard}>
            <FastImage source={APP_ICON_SOURCE as any} style={styles.playerStateIcon} />
            <Text style={styles.playerStateTitle}>
              {playbackStartupError ? "Playback unavailable" : "Preparing media"}
            </Text>
            <Text style={styles.playerStateMessage}>
              {playbackStartupError ?? "Checking this library item before opening the player."}
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
          (Boolean(videoId) && settings.rememberPosition && position > 1)
        }
        seekPreviewPosition={seekPreviewPosition}
        forcedAspectRatio={forcedAspectRatio}
        onSetAspectRatio={!isAudioMode ? handleSetForcedAspectRatio : undefined}
        onOpenNetworkStream={!isAudioMode ? () => navigation.navigate("network-stream" as never) : undefined}
      />

      {/* MX-style gesture bars — mutually exclusive via activeGestureMode */}
      {activeGestureMode === "brightness" && !isLocked ? (
        <VerticalGestureBar
          value={brightnessLevel}
          color="#FBBF24"
          icon="sun"
          side="left"
          onChange={handleSetBrightness}
        />
      ) : null}
      {activeGestureMode === "volume" && !isLocked ? (
        <VerticalGestureBar
          value={volume}
          color="#60A5FA"
          icon="volume-2"
          side="right"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_500Medium",
  },
  closeBtn: {
    backgroundColor: "#00B4FF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  hiddenMediaView: {
    opacity: 0.02,
  },
  videoViewport: {
    overflow: "hidden",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  videoFrame: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
  edgeGestureZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: `${EDGE_GESTURE_RATIO * 100}%`,
  },
  edgeGestureZoneLeft: {
    left: 0,
  },
  edgeGestureZoneRight: {
    right: 0,
  },
  audioModeCanvas: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  audioModeGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(75,163,255,0.16)",
    shadowColor: "#4BA3FF",
    shadowOpacity: 0.28,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 10 },
  },
  audioModeHero: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderRadius: 28,
    backgroundColor: "rgba(8,10,14,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  audioModeDisc: {
    width: 154,
    height: 154,
    borderRadius: 77,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(75,163,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(127,196,255,0.2)",
  },
  audioModeDiscInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,15,24,0.92)",
  },
  // Fix #9: Full-disc album art
  audioModeArt: {
    width: 154,
    height: 154,
    borderRadius: 77,
  },
  audioModeEyebrow: {
    color: "#7FC4FF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  audioModeTitle: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  audioModeMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  audioWaveRow: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 152,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
  },
  audioWaveBar: {
    width: 6,
    borderRadius: 999,
    backgroundColor: "#4BA3FF",
  },
  nightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  lockUnlockBtn: {
    position: "absolute",
    top: 18,
    alignSelf: "center",
    left: "50%",
    transform: [{ translateX: -44 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  lockUnlockLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
  lockFullOverlay: {
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  lockIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerStateOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  playerStateCard: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: "rgba(8,10,14,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  playerStateIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    marginBottom: 2,
  },
  playerStateTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  playerStateMessage: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  playerStateButton: {
    marginTop: 6,
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2594FF",
  },
  playerStateButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  playerStateButtonText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  resumePromptOverlay: {
    position: "absolute",
    right: 20,
    bottom: 100,
    zIndex: 6,
    width: 240,
  },
  resumePromptStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "rgba(10,12,18,0.95)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  resumePromptInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resumePromptLabel: {
    color: "#7FC4FF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
  resumePromptTime: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  resumeStartOverBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  resumeStartOverText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  resumeBtnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  resumeCountdownTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  resumeCountdownFill: {
    height: "100%",
    backgroundColor: "#2594FF",
    borderBottomLeftRadius: 14,
  },
  hudWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  hud: {
    minWidth: 190,
    maxWidth: 300,
    width: "68%",
    alignItems: "center",
    gap: 8,
  },
  hudIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  hudTitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  hudLabel: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  hudTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  hudFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#4BA3FF",
  },
  sideGestureMessageWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "48%",
    alignItems: "center",
    zIndex: 4,
  },
  sideGestureMessageText: {
    color: "#93C5FD",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
    textShadowColor: "rgba(0,0,0,0.72)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  sideGestureMessageBrightness: {
    color: "#FDE68A",
  },
  // VLC-style full-height side gesture panels
  vlcPanel: {
    position: "absolute",
    top: "24%",
    bottom: "24%",
    width: 78,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  vlcPanelLeft: {
    left: 10,
  },
  vlcPanelRight: {
    right: 10,
  },
  vlcContent: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  vlcDirectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  vlcDirectionLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0,
  },
  vlcDirectionLabelActive: {
    color: "rgba(255,255,255,0.82)",
  },
  vlcBarTrack: {
    width: 8,
    height: 132,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.32)",
    justifyContent: "flex-end",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  vlcBarFill: {
    width: "100%",
    borderRadius: 999,
    minHeight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.38,
    shadowRadius: 3,
  },
  vlcBarTick: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  vlcValue: {
    color: "#93C5FD",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
  },
  vlcValueBrightness: {
    color: "#FDE68A",
  },
  vlcUnit: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0,
  },
  transitionBanner: {
    position: "absolute",
    top: "18%",
    alignSelf: "center",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    minWidth: 220,
    maxWidth: "82%",
  },
  transitionLabel: {
    color: "#7FC4FF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  transitionTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  screenshotToastWrap: {
    position: "absolute",
    top: "18%",
    right: 16,
    alignItems: "flex-end",
  },
  screenshotToast: {
    width: 180,
    borderRadius: 20,
    backgroundColor: "rgba(10,12,18,0.92)",
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  screenshotToastTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  screenshotToastImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: "#111",
  },
  screenshotToastHint: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  upNextWrap: {
    position: "absolute",
    zIndex: 3,
  },
  upNextWrapSide: {
    top: "50%",
    right: 16,
    maxHeight: "58%",
    transform: [{ translateY: -180 }],
    width: 280,
  },
  upNextWrapBottom: {
    top: 92,
    left: 16,
    right: 16,
    bottom: 183,
  },
  upNextCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "rgba(8,10,14,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    gap: 10,
  },
  upNextHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  upNextTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  upNextCount: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  upNextScroll: {
    flex: 1,
    minHeight: 0,
  },
  upNextScrollLandscape: {
    flex: 0,
    height:
      QUEUE_ITEM_LAYOUT_HEIGHT * UP_NEXT_LANDSCAPE_PAGE_SIZE -
      UP_NEXT_SEPARATOR_HEIGHT,
  },
  upNextList: {
    paddingBottom: 4,
  },
  upNextSeparator: {
    height: UP_NEXT_SEPARATOR_HEIGHT,
  },
  upNextItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 68,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  upNextItemActive: {
    backgroundColor: "rgba(111,96,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(151,139,255,0.32)",
  },
  upNextItemPressed: {
    backgroundColor: "rgba(75,163,255,0.18)",
    transform: [{ scale: 0.98 }],
  },
  upNextIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(75,163,255,0.2)",
  },
  upNextIndexText: {
    color: "#BFE4FF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  upNextTextBlock: {
    flex: 1,
    gap: 2,
  },
  upNextItemTitle: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  upNextItemMeta: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  upNextActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(75,163,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(127,196,255,0.24)",
  },
  upNextActionBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  upNextPager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  upNextPagerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 92,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(75,163,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(127,196,255,0.18)",
  },
  upNextPagerBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  upNextPagerBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  upNextPagerBtnText: {
    color: "#EAF6FF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  upNextPagerBtnTextDisabled: {
    color: "rgba(234,246,255,0.35)",
  },
  upNextPagerText: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  upNextActionText: {
    color: "#EAF6FF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  suggestedSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 6,
    marginTop: 4,
  },
  suggestedHeader: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  centerPanelWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingTop: 86,
    paddingBottom: 132,
  },
  infoPanel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(8,10,14,0.82)",
    overflow: "hidden",
  },
  infoPanelCentered: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "100%",
  },
  trimPanel: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "100%",
  },
  infoScrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  infoHero: {
    gap: 6,
  },
  infoEyebrow: {
    color: "#7FC4FF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  infoTitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  infoSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  infoSection: {
    gap: 10,
  },
  infoSectionTitle: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  trimTitleInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(127,196,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoCard: {
    minWidth: 120,
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    gap: 4,
  },
  infoCardLabel: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoCardValue: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  infoChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trimActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  trimActionBtn: {
    minWidth: 120,
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 5,
  },
  trimActionBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  trimActionTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  trimActionMeta: {
    color: "#7FC4FF",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  trimFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  trimSecondaryBtn: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  trimSecondaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  trimSecondaryBtnText: {
    color: "#EAF6FF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  trimPrimaryBtn: {
    minHeight: 46,
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2594FF",
  },
  trimPrimaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  trimPrimaryBtnDisabled: {
    opacity: 0.55,
  },
  trimPrimaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  infoChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(127,196,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(127,196,255,0.2)",
  },
  infoChipText: {
    color: "#EAF6FF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  sleepTimerOverlay: {
    position: "absolute",
    top: 50,
    right: 70,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
    zIndex: 10,
  },
  sleepTimerText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  upNextPopup: {
    position: "absolute",
    bottom: 100,
    right: 20,
    backgroundColor: "rgba(10,12,18,0.95)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 12,
    width: 240,
    zIndex: 20,
  },
  upNextPopupContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  upNextPopupInfo: {
    flex: 1,
    gap: 2,
  },
  upNextPopupLabel: {
    color: "#7FC4FF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
  upNextPopupTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  upNextPopupBtn: {
    backgroundColor: "#2594FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  upNextPopupBtnText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  upNextPopupButtons: {
    flexDirection: "row",
    gap: 8,
  },
  upNextPopupBtnRestart: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  upNextPopupBtnNext: {
    backgroundColor: "#2594FF",
    flex: 1,
  },
  discoveryHints: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    alignItems: "center",
    zIndex: 5,
  },
  discoveryHintLeft: {
    alignItems: "center",
    gap: 8,
  },
  discoveryHintRight: {
    alignItems: "center",
    gap: 8,
  },
  discoveryHintText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 80,
  },
  countdownCard: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    minWidth: 220,
  },
  countdownLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  countdownNumber: {
    color: "#4BA3FF",
    fontSize: 64,
    fontFamily: "Inter_700Bold",
    lineHeight: 72,
  },
  countdownTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 240,
    textAlign: "center",
  },
  countdownCancelBtn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  countdownCancelText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  speedBadge: {
    position: "absolute",
    top: "12%",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: "rgba(37,148,255,0.88)",
    zIndex: 90,
    elevation: 6,
  },
  speedBadgeText: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  hudOverlayCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  hudCardCenter: {
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: "center",
    minWidth: 160,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  hudLabelCenter: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  hudProgressTrackCenter: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  hudProgressFillCenter: {
    height: "100%",
    backgroundColor: "#4BA3FF",
  },
  hudOverlaySide: {
    position: "absolute",
    top: "20%",
    bottom: "20%",
    width: 44,
    justifyContent: "center",
    zIndex: 100,
  },
  hudAdaptiveContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    padding: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  hudAdaptiveTrack: {
    flex: 1,
    width: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    overflow: "hidden",
    justifyContent: "flex-end",
    marginBottom: 8,
    marginTop: 8,
  },
  hudAdaptiveFill: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 3,
  },
  hudAdaptiveIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  gestureBar: {
    position: "absolute",
    top: "20%",
    width: 50,
    height: "55%",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 10,
    gap: 6,
    zIndex: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  gestureBarLeft: {
    left: 8,
  },
  gestureBarRight: {
    right: 8,
  },
  gestureBarTrackWrap: {
    flex: 1,
    width: 10,
    marginBottom: 4,
  },
  gestureBarTrack: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 5,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  gestureBarFill: {
    width: "100%",
    borderRadius: 5,
    minHeight: 4,
  },
  gestureBarPct: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  resumeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  resumeCloseBtn: {
    padding: 2,
    borderRadius: 20,
  },

  // Fix #12: Start Over card — bottom-left, non-intrusive
  startOverCard: {
    position: "absolute",
    bottom: 110,
    left: 14,
    zIndex: 20,
    maxWidth: 240,
  },
  startOverInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(10,12,20,0.92)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(127,196,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  startOverTextBlock: {
    flex: 1,
    gap: 2,
  },
  startOverLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  startOverAction: {
    color: "#7FC4FF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },

  // Fix 4: Last-5-sec ending overlay — bottom-right
  endingOverlay: {
    position: "absolute",
    bottom: 110,
    right: 14,
    zIndex: 20,
    maxWidth: 220,
  },
  endingOverlayInner: {
    backgroundColor: "rgba(10,12,20,0.93)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(127,196,255,0.22)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 4,
  },
  endingOverlayEyebrow: {
    color: "#7FC4FF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  endingOverlayTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  endingOverlayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  endingOverlayAction: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

});



function VerticalGestureBar({
  value,
  color,
  icon,
  side,
  onChange,
}: {
  value: number;
  color: string;
  icon: string;
  side: "left" | "right";
  onChange?: (v: number) => void;
}) {
  const barHeightRef = useRef(0);
  const updateValueFromY = useCallback((y: number) => {
    if (barHeightRef.current > 0) {
      onChange?.(Math.max(0, Math.min(1, 1 - y / barHeightRef.current)));
    }
  }, [onChange]);

  const barGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => runOnJS(updateValueFromY)(e.y))
        .onUpdate((e) => runOnJS(updateValueFromY)(e.y)),
    [updateValueFromY]
  );

  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <GestureDetector gesture={barGesture}>
      <View
        style={[styles.gestureBar, side === "left" ? styles.gestureBarLeft : styles.gestureBarRight]}
        onLayout={(e) => { barHeightRef.current = e.nativeEvent.layout.height; }}
      >
        <View style={styles.gestureBarTrackWrap}>
          <View style={styles.gestureBarTrack}>
            <View style={[styles.gestureBarFill, { height: `${pct}%` as any, backgroundColor: color }]} />
          </View>
        </View>
        <Feather name={icon as any} size={14} color={color} />
        <Text style={[styles.gestureBarPct, { color }]}>{pct}%</Text>
      </View>
    </GestureDetector>
  );
}

