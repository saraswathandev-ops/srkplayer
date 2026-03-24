import Feather from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import FastImage from "react-native-fast-image";
import RNFS from "react-native-fs";
import Video, { type VideoRef } from "react-native-video";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Animated,
  BackHandler,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrackPlayer, { Capability, Event, State } from "react-native-track-player";
import { isTrackPlayerAvailable, useSafeTrackPlayerEvents } from "@/services/trackPlayerService";

import { VideoPlayerControls } from "@/components/VideoPlayerControls";
import { usePlayer } from "@/context/PlayerContext";
import {
  getPlayerSession,
  releasePlayerSession,
  setPlayerSession,
} from "@/services/playerSession";
import { formatDuration } from "@/utils/formatters";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const CONTROL_TIMEOUT = 3000;
const HUD_TIMEOUT = 1000;
const SCREENSHOT_PREVIEW_TIMEOUT = 3000;
const DOUBLE_TAP_TIMEOUT = 280;
const DOUBLE_TAP_EDGE_RATIO = 0.32;
const GESTURE_ACTIVATION_DISTANCE = 6;
const HORIZONTAL_SEEK_MAX_WINDOW = 900;
const MIN_PINCH_SCALE = 1;
const MAX_PINCH_SCALE = 3;
const PINCH_GESTURE_ACTIVATION_DELTA = 0.04;
const QUEUE_ITEM_LAYOUT_HEIGHT = 76;
const UP_NEXT_SEPARATOR_HEIGHT = 8;
const UP_NEXT_PAGE_SIZE = 10;
const UP_NEXT_LANDSCAPE_PAGE_SIZE = 4;

type ContentFitMode = "contain" | "cover" | "fill";
type GestureMode = "volume" | "brightness" | "seek" | "zoom";
type TapZone = "left" | "center" | "right";

// Shim type that mirrors the expo-video player API, backed by react-native-video's ref
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
    play() { _playing = true; videoRef.current?.resume(); },
    pause() { _playing = false; videoRef.current?.pause(); },
    release() { _playing = false; },
    async replaceAsync(uri: string) {
      // react-native-video re-renders when `source` prop changes — just update state
      _currentTime = 0;
      _playing = false;
    },
    async generateThumbnailsAsync(_times: number[]): Promise<VideoThumbnail[]> {
      // Thumbnail generation is not available without expo-video
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
  touches?: ReadonlyArray<{ pageX: number; pageY: number }>
) {
  if (!touches || touches.length < 2) return 0;
  const [firstTouch, secondTouch] = touches;
  return Math.hypot(
    secondTouch.pageX - firstTouch.pageX,
    secondTouch.pageY - firstTouch.pageY
  );
}

function resolveVerticalGestureValue(options: {
  locationY: number;
  viewportHeight: number;
}) {
  const safeHeight = Math.max(options.viewportHeight || 1, 1);
  const topInset = Math.max(Math.min(safeHeight * 0.06, 36), 18);
  const bottomInset = topInset;
  const effectiveHeight = Math.max(safeHeight - topInset - bottomInset, 1);
  const normalizedY = clamp01((options.locationY - topInset) / effectiveHeight);
  return 1 - normalizedY;
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

function settingFromFit(mode: ContentFitMode) {
  if (mode === "cover") return "expand" as const;
  if (mode === "fill") return "stretch" as const;
  return "fit" as const;
}

function applyPlayerAudioState(
  player: VideoPlayerShim,
  options: {
    volume: number;
    isMuted: boolean;
    backgroundPlay: boolean;
  }
) {
  const safeVolume = clamp01(options.volume);
  player.audioMixingMode = "doNotMix";
  const isFallback = !isTrackPlayerAvailable && options.backgroundPlay;
  player.staysActiveInBackground = isFallback;
  player.showNowPlayingNotification = isFallback;
  player.volume = safeVolume;
  player.muted = options.isMuted || safeVolume <= 0.001;
}

function getPlaybackUri(video?: {
  uri: string;
  sourceUri?: string;
} | null) {
  return video?.uri ?? video?.sourceUri ?? null;
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
  const { id } = route.params || { id: "" };
  const routeVideoId = Array.isArray(id) ? id[0] : id;
  const {
    videos,
    settings,
    updateLastPosition,
    incrementPlayCount,
    saveTrimmedClip,
    setCurrentVideo,
    updateSettings,
    removeVideo,
  } = usePlayer();
  const insets = useSafeAreaInsets();

  const [activeVideoId, setActiveVideoId] = useState(routeVideoId);
  const [isPlaying, setIsPlaying] = useState(settings.autoPlay);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sourceDuration, setSourceDuration] = useState(0);
  const [seekPreviewPosition, setSeekPreviewPosition] = useState<number | null>(null);
  const [speed, setSpeed] = useState(settings.speed);
  const [volume, setVolume] = useState(clamp01(settings.defaultVolume));
  const [brightnessLevel, setBrightnessLevel] = useState(
    clamp01(settings.defaultBrightness)
  );
  const [isMuted, setIsMuted] = useState(clamp01(settings.defaultVolume) <= 0.001);
  const [loopMode, setLoopMode] = useState<"none" | "one" | "all">(
    settings.loopMode
  );
  const [contentFitMode, setContentFitMode] = useState<ContentFitMode>(
    fitFromSetting(settings.videoSizeMode)
  );
  const [zoomScale, setZoomScale] = useState(MIN_PINCH_SCALE);
  const [controlsVisible, setControlsVisible] = useState(true);
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
  const [isLocked, setIsLocked] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [orientationMode, setOrientationMode] = useState<
    "default" | "portrait" | "landscape"
  >("landscape");
  const [gestureHud, setGestureHud] = useState<{
    mode: GestureMode;
    label: string;
    progress: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [transitionMeta, setTransitionMeta] = useState<{
    title: string;
    direction: "next" | "prev";
  } | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<VideoThumbnail | null>(
    null
  );

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumePersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brightnessPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureFrame = useRef<number | null>(null);
  const lastAudibleVolume = useRef(
    clamp01(settings.defaultVolume) > 0.001 ? clamp01(settings.defaultVolume) : 1
  );
  const pendingGestureUpdate = useRef<
    | { mode: "seek"; value: number; duration: number }
    | null
  >(null);
  const seekPreviewPositionRef = useRef<number | null>(null);
  const lastTap = useRef<{ time: number; zone: TapZone | null }>({
    time: 0,
    zone: null,
  });
  const hasRestoredPosition = useRef(false);
  const isMounted = useRef(true);
  const backgroundPlayRef = useRef(settings.backgroundPlay);
  const lastSavedPosition = useRef(0);
  const completionHandledVideoId = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);
  const videoRef = useRef<VideoRef | null>(null);
  const playerRef = useRef<VideoPlayerShim | null>(null);
  const queueListRef = useRef<FlatList<(typeof videos)[number]> | null>(null);
  const loadedPlayerVideoId = useRef<string | null>(null);
  const orientationManagedRef = useRef(false);
  const transitionProgress = useRef(new Animated.Value(1)).current;
  const gestureRef = useRef<{
    mode: GestureMode | null;
    startX: number;
    startPosition: number;
    startVolume: number;
    startBrightness: number;
  }>({
    mode: null,
    startX: 0,
    startPosition: 0,
    startVolume: 1,
    startBrightness: 0.5,
  });
  const pinchGestureRef = useRef({
    active: false,
    startDistance: 0,
    startScale: MIN_PINCH_SCALE,
    hasChanged: false,
  });
  const videoWrapperProps =
    Platform.OS === "web" ? {} : { pointerEvents: "none" as const };

  useEffect(() => {
    if (routeVideoId) {
      setActiveVideoId(routeVideoId);
    }
  }, [routeVideoId]);

  const video = useMemo(
    () => videos.find((item) => item.id === activeVideoId),
    [activeVideoId, videos]
  );
  const mediaType = video?.mediaType ?? "video";
  const isAudioMode = mediaType === "audio";
  const effectiveOrientationMode = isAudioMode ? "portrait" : orientationMode;
  const playbackUri = getPlaybackUri(video);
  const clipStartOffset = getClipStartOffset(video);
  const clipEndPosition = getClipEndPosition(video);
  const videoId = video?.id;
  const currentIndex = videoId
    ? videos.findIndex((item) => item.id === videoId)
    : -1;
  const isLandscapeLayout = viewport.width > viewport.height;
  const previousVideo = currentIndex > 0 ? videos[currentIndex - 1] : null;
  const nextVideo =
    currentIndex >= 0 && currentIndex < videos.length - 1
      ? videos[currentIndex + 1]
      : null;
  const portraitUpNextTotalCount = videos.length;
  const defaultUpNextLandscapePage =
    currentIndex >= 0 ? Math.floor(currentIndex / UP_NEXT_LANDSCAPE_PAGE_SIZE) : 0;
  const landscapeUpNextPageCount = Math.ceil(
    videos.length / UP_NEXT_LANDSCAPE_PAGE_SIZE
  );
  const activeUpNextLandscapePage =
    landscapeUpNextPageCount > 0
      ? Math.min(upNextLandscapePage, landscapeUpNextPageCount - 1)
      : 0;
  const queueStartIndex = isLandscapeLayout
    ? activeUpNextLandscapePage * UP_NEXT_LANDSCAPE_PAGE_SIZE
    : 0;
  const queueVideos = useMemo(
    () =>
      videos.slice(
        queueStartIndex,
        queueStartIndex +
        (isLandscapeLayout
          ? UP_NEXT_LANDSCAPE_PAGE_SIZE
          : Math.max(upNextVisibleCount, 1))
      ),
    [isLandscapeLayout, queueStartIndex, upNextVisibleCount, videos]
  );
  const canLoadMoreUpNext =
    !isLandscapeLayout && queueVideos.length < portraitUpNextTotalCount;
  const canScrollUpNextPrev = isLandscapeLayout && activeUpNextLandscapePage > 0;
  const canScrollUpNextNext =
    isLandscapeLayout && activeUpNextLandscapePage < landscapeUpNextPageCount - 1;

  if (!playerRef.current && playbackUri) {
    const existingSession = getPlayerSession();
    const instance = existingSession?.player as VideoPlayerShim | undefined ?? createVideoPlayerShim(videoRef);
    instance.loop = Boolean(!video?.isClip && settings.loopMode === "one");
    instance.playbackRate = settings.speed;
    applyPlayerAudioState(instance, {
      volume,
      isMuted,
      backgroundPlay: settings.backgroundPlay,
    });
    if (!existingSession && settings.autoPlay) instance.play();
    playerRef.current = instance;
    loadedPlayerVideoId.current = existingSession?.videoId ?? videoId ?? null;
    setPlayerSession(instance, loadedPlayerVideoId.current);
  }

  const player = playerRef.current;
  const clearReleasedPlayer = useCallback(
    (candidate?: VideoPlayerShim | null) => {
      if (candidate && playerRef.current !== candidate) return;
      releasePlayerSession(candidate ?? playerRef.current);
      playerRef.current = null;
      loadedPlayerVideoId.current = null;
      setIsPlaying(false);
      setDuration(0);
      setSourceDuration(0);
    },
    []
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      setCurrentVideo(null);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      if (hudTimer.current) clearTimeout(hudTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (screenshotTimer.current) clearTimeout(screenshotTimer.current);
      if (volumePersistTimer.current) clearTimeout(volumePersistTimer.current);
      if (brightnessPersistTimer.current) clearTimeout(brightnessPersistTimer.current);
      const activePlayer = playerRef.current;
      const activeVideoId = loadedPlayerVideoId.current;
      playerRef.current = null;
      loadedPlayerVideoId.current = null;
      if (activePlayer && backgroundPlayRef.current) {
        setPlayerSession(activePlayer, activeVideoId);
        return;
      }
      releasePlayerSession(activePlayer);
    };
  }, [setCurrentVideo]);

  useEffect(() => {
    if (!videoId || !video) return;
    hasRestoredPosition.current = false;
    completionHandledVideoId.current = null;
    wasPlayingRef.current = false;
    setCurrentVideo(video);
    void incrementPlayCount(videoId);
  }, [incrementPlayCount, setCurrentVideo, videoId]);

  useEffect(() => {
    if (!player || !playbackUri || !videoId) return;

    if (loadedPlayerVideoId.current === videoId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (playbackUri.startsWith("file://") || playbackUri.startsWith("content://") || playbackUri.startsWith("/")) {
          try {
            const fileExists = await RNFS.exists(playbackUri.replace(/^file:\/\//, ""));
            if (!fileExists && !cancelled) {
              loadedPlayerVideoId.current = videoId;
              setPlayerSession(player, videoId);
              player.pause();
              setIsPlaying(false);

              Alert.alert(
                "Missing File",
                "The video file could not be found. It may have been moved or deleted from your device.",
                [
                  { text: "Cancel", style: "cancel", onPress: () => navigation.goBack() },
                  {
                    text: "Remove from Library",
                    style: "destructive",
                    onPress: async () => {
                      if (video?.id) {
                        await removeVideo(video.id, "temporary");
                      }
                      navigation.goBack();
                    }
                  }
                ]
              );
              return;
            }
          } catch {
            // Let the player try to load it anyway if getInfoAsync fails
          }
        }

        if (cancelled) return;

        await player.replaceAsync(playbackUri);
        if (cancelled) return;

        loadedPlayerVideoId.current = videoId;
        setPlayerSession(player, videoId);
        try {
          player.loop = Boolean(!video?.isClip && settings.loopMode === "one");
          player.playbackRate = settings.speed;
          applyPlayerAudioState(player, {
            volume,
            isMuted,
            backgroundPlay: settings.backgroundPlay,
          });

          if (settings.autoPlay) {
            player.play();
            setIsPlaying(true);
          } else {
            player.pause();
            setIsPlaying(false);
          }
        } catch {
          clearReleasedPlayer(player);
        }
      } catch {
        clearReleasedPlayer(player);
        // Ignore transient source-switch failures and let the next interaction retry.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isMuted,
    player,
    settings.autoPlay,
    settings.backgroundPlay,
    settings.loopMode,
    settings.speed,
    playbackUri,
    videoId,
    volume,
    video,
    video?.isClip,
    removeVideo,
    clearReleasedPlayer,
  ]);

  useEffect(() => {
    if (!player) return;
    try {
      player.loop = Boolean(!video?.isClip && settings.loopMode === "one");
      player.playbackRate = settings.speed;
      applyPlayerAudioState(player, {
        volume,
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
    video?.isClip,
    clearReleasedPlayer,
  ]);

  useEffect(() => {
    setSpeed(settings.speed);
  }, [settings.speed]);

  useEffect(() => {
    setLoopMode(settings.loopMode);
  }, [settings.loopMode]);

  useEffect(() => {
    setContentFitMode(fitFromSetting(settings.videoSizeMode));
  }, [settings.videoSizeMode]);

  useEffect(() => {
    setZoomScale(MIN_PINCH_SCALE);
    pinchGestureRef.current = {
      active: false,
      startDistance: 0,
      startScale: MIN_PINCH_SCALE,
      hasChanged: false,
    };
  }, [videoId]);

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
    if (nextVolume > 0.001) {
      lastAudibleVolume.current = nextVolume;
    }
    setVolume(nextVolume);
    setIsMuted(nextVolume <= 0.001);
  }, [settings.defaultVolume]);

  useEffect(() => {
    if (!player) return;
    if (!video || hasRestoredPosition.current) {
      return;
    }

    if (
      settings.rememberPosition &&
      video.lastPosition !== undefined &&
      Number.isFinite(video.lastPosition) &&
      video.lastPosition > 0
    ) {
      try {
        const restoredPosition = clamp(video.lastPosition, 0, video.duration || video.lastPosition);
        player.currentTime = getAbsolutePlaybackPosition(
          video,
          restoredPosition,
          sourceDuration || video.duration
        );
        setPosition(restoredPosition);
      } catch {
        clearReleasedPlayer(player);
      }
    } else {
      try {
        player.currentTime = getAbsolutePlaybackPosition(video, 0, sourceDuration || video.duration);
        setPosition(0);
      } catch {
        clearReleasedPlayer(player);
      }
    }

    hasRestoredPosition.current = true;
  }, [player, settings.rememberPosition, sourceDuration, video, clearReleasedPlayer]);

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
          void updateLastPosition(videoId, nextPosition);
        }

        if (settings.backgroundPlay && playbackUri && player.playing && isTrackPlayerAvailable) {
          // Handoff to TrackPlayer
          backgroundHandoffState.active = true;
          try {
            await TrackPlayer.reset();
            await TrackPlayer.add({
              id: videoId,
              url: playbackUri,
              title: video?.title || "Unknown File",
              artist: video?.folder || "Media Library",
              artwork: typeof video?.thumbnail === "string" ? video.thumbnail : (video?.thumbnail as any)?.uri,
            });
            await TrackPlayer.seekTo(player.currentTime);
            player.pause();
            await TrackPlayer.play();
          } catch (e) {
            console.log("TrackPlayer background handoff failed", e);
          }
        } else {
          try {
            player.pause();
            setIsPlaying(false);
          } catch {
            clearReleasedPlayer(player);
          }
        }
      } else if (nextState === "active") {
        // Restore from TrackPlayer
        if (backgroundHandoffState.active && isTrackPlayerAvailable) {
          try {
            const trackPlayerPosition = await TrackPlayer.getPosition();
            const trackPlayerState = await TrackPlayer.getPlaybackState();
            await TrackPlayer.pause();
            backgroundHandoffState.active = false;

            if (Number.isFinite(trackPlayerPosition) && trackPlayerPosition > 0) {
              player.currentTime = trackPlayerPosition;
              setPosition(getRelativePlaybackPosition(video, trackPlayerPosition, sourceDuration || duration));
            }
            if (trackPlayerState.state === State.Playing) {
              player.play();
              setIsPlaying(true);
            }
          } catch (e) {
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
    updateLastPosition,
    video,
    videoId,
    duration,
    clearReleasedPlayer,
  ]);

  useEffect(() => {
    const nextBrightness = clamp01(settings.defaultBrightness);
    setBrightnessLevel(nextBrightness);
  }, [settings.defaultBrightness]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    // ScreenOrientation (expo-screen-orientation removed): orientation lock is a no-op.
    // To restore, install react-native-orientation-locker and wire it up here.
    void (async () => {
      try {
        // no-op
      } catch {
        // no-op
      }
    })();
  }, [effectiveOrientationMode]);

  useEffect(() => {
    return () => {
      // orientation cleanup is a no-op (ScreenOrientation removed)
    };
  }, []);

  const showHud = useCallback((mode: GestureMode, label: string, progress: number) => {
    setGestureHud({
      mode,
      label,
      progress: clamp01(progress),
    });

    if (hudTimer.current) clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => {
      if (isMounted.current) setGestureHud(null);
    }, HUD_TIMEOUT);
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

  const scheduleHideControls = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isMounted.current) setControlsVisible(false);
    }, CONTROL_TIMEOUT);
  }, []);

  useEffect(() => {
    if (
      isPlaying &&
      !utilityRailExpanded &&
      !quickActionsExpanded &&
      !propertiesPanelVisible &&
      !trimPanelVisible &&
      !isLocked
    ) {
      scheduleHideControls();
    } else {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      setControlsVisible(true);
    }

    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [
    isLocked,
    isPlaying,
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

    setControlsVisible((previous) => {
      if (!previous) {
        if (
          !utilityRailExpanded &&
          !quickActionsExpanded &&
          !propertiesPanelVisible &&
          !trimPanelVisible &&
          !isLocked
        ) {
          scheduleHideControls();
        }
        return true;
      }

      if (propertiesPanelVisible) {
        setPropertiesPanelVisible(false);
        return false;
      }

      if (trimPanelVisible) {
        setTrimPanelVisible(false);
        return false;
      }

      if (quickActionsExpanded) {
        setQuickActionsExpanded(false);
        return false;
      }

      if (utilityRailExpanded) {
        setUtilityRailExpanded(false);
        return false;
      }

      return false;
    });
  }, [
    isLocked,
    propertiesPanelVisible,
    quickActionsExpanded,
    scheduleHideControls,
    screenshotPreview,
    trimPanelVisible,
    utilityRailExpanded,
  ]);

  const getTapZone = useCallback(
    (locationX: number): TapZone => {
      if (!viewport.width || !Number.isFinite(locationX)) return "center";
      const edgeWidth = viewport.width * DOUBLE_TAP_EDGE_RATIO;
      if (locationX <= edgeWidth) return "left";
      if (locationX >= viewport.width - edgeWidth) return "right";
      return "center";
    },
    [viewport.width]
  );

  const handlePlayPause = useCallback(() => {
    if (!player) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }

    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [player]);

  const handleSeek = useCallback(
    (nextPosition: number) => {
      if (!player) return;
      const safeDuration = duration > 0 ? duration : Math.max(nextPosition, 0);
      const clamped = clamp(nextPosition, 0, safeDuration || 0);
      player.currentTime = getAbsolutePlaybackPosition(
        video,
        clamped,
        sourceDuration || duration || video?.duration || clamped
      );
      setPosition(clamped);
      setSeekPreviewPosition(null);
      seekPreviewPositionRef.current = null;
    },
    [duration, player, sourceDuration, video]
  );

  const handleSeekForward = useCallback(() => {
    const basePosition = seekPreviewPosition ?? position;
    const safeDuration = duration > 0 ? duration : Math.max(basePosition, 0);
    const nextPosition = clamp(
      basePosition + settings.doubleTapSeek,
      0,
      safeDuration || 0
    );
    handleSeek(nextPosition);
    showHud(
      "seek",
      `Forward ${settings.doubleTapSeek}s`,
      safeDuration > 0 ? nextPosition / safeDuration : 0
    );
  }, [
    duration,
    handleSeek,
    position,
    seekPreviewPosition,
    settings.doubleTapSeek,
    showHud,
  ]);

  const handleSeekBackward = useCallback(() => {
    const basePosition = seekPreviewPosition ?? position;
    const safeDuration = duration > 0 ? duration : Math.max(basePosition, 0);
    const nextPosition = clamp(basePosition - settings.doubleTapSeek, 0, safeDuration || 0);
    handleSeek(nextPosition);
    showHud(
      "seek",
      `Back ${settings.doubleTapSeek}s`,
      safeDuration > 0 ? nextPosition / safeDuration : 0
    );
  }, [
    duration,
    handleSeek,
    position,
    seekPreviewPosition,
    settings.doubleTapSeek,
    showHud,
  ]);

  const handleTap = useCallback(
    (event: { nativeEvent?: { locationX?: number } }) => {
      const zone = getTapZone(event.nativeEvent?.locationX ?? NaN);
      const now = Date.now();
      const isDoubleTap =
        zone !== "center" &&
        lastTap.current.zone === zone &&
        now - lastTap.current.time <= DOUBLE_TAP_TIMEOUT;

      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }

      if (isDoubleTap) {
        lastTap.current = { time: 0, zone: null };
        setControlsVisible(true);
        if (
          !utilityRailExpanded &&
          !quickActionsExpanded &&
          !propertiesPanelVisible &&
          !trimPanelVisible &&
          !isLocked
        ) {
          scheduleHideControls();
        }
        if (zone === "left") {
          handleSeekBackward();
        } else {
          handleSeekForward();
        }
        return;
      }

      lastTap.current = { time: now, zone };
      tapTimer.current = setTimeout(() => {
        lastTap.current = { time: 0, zone: null };
        toggleControls();
        tapTimer.current = null;
      }, DOUBLE_TAP_TIMEOUT);
    },
    [
      getTapZone,
      handleSeekBackward,
      handleSeekForward,
      isLocked,
      propertiesPanelVisible,
      quickActionsExpanded,
      scheduleHideControls,
      trimPanelVisible,
      toggleControls,
      utilityRailExpanded,
    ]
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
      if (player) {
        applyPlayerAudioState(player, {
          volume: clampedVolume,
          isMuted: nextMuted,
          backgroundPlay: settings.backgroundPlay,
        });
      }
      scheduleVolumeSettingSave(clampedVolume);
      showHud("volume", `Volume ${Math.round(clampedVolume * 100)}%`, clampedVolume);
    },
    [player, scheduleVolumeSettingSave, settings.backgroundPlay, showHud]
  );

  const handleSetBrightness = useCallback(
    (nextBrightness: number) => {
      const clampedBrightness = clamp01(nextBrightness);
      setBrightnessLevel(clampedBrightness);
      // System brightness control requires react-native-brightness (not installed)
      scheduleBrightnessSettingSave(clampedBrightness);
      showHud(
        "brightness",
        `Brightness ${Math.round(clampedBrightness * 100)}%`,
        clampedBrightness
      );
    },
    [scheduleBrightnessSettingSave, showHud]
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
      pending.duration > 0 ? pending.value / pending.duration : 0
    );
  }, [showHud]);

  const scheduleSeekGestureUpdate = useCallback(
    (update: { mode: "seek"; value: number; duration: number }) => {
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
        isMuted: targetVolume <= 0.001,
        backgroundPlay: settings.backgroundPlay,
      });
    }
    scheduleVolumeSettingSave(targetVolume);
    showHud(
      "volume",
      targetVolume <= 0.001 ? "Muted" : `Volume ${Math.round(targetVolume * 100)}%`,
      targetVolume
    );
  }, [isMuted, player, scheduleVolumeSettingSave, settings.backgroundPlay, showHud]);

  const handleToggleLoop = useCallback(() => {
    if (!player) return;
    const modes: ("none" | "one" | "all")[] = ["none", "one", "all"];
    const currentIndex = modes.indexOf(loopMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setLoopMode(nextMode);
    player.loop = Boolean(!video?.isClip && nextMode === "one");
  }, [loopMode, player, video?.isClip]);

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
      showHud(
        "zoom",
        clampedScale <= MIN_PINCH_SCALE + 0.01
          ? "Zoom reset"
          : `Zoom ${clampedScale.toFixed(2)}x`,
        (clampedScale - MIN_PINCH_SCALE) /
        (MAX_PINCH_SCALE - MIN_PINCH_SCALE)
      );
    },
    [isAudioMode, showHud]
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
    setQuickActionsExpanded(false);
    setPropertiesPanelVisible(false);
    setTrimPanelVisible(false);
    setUtilityRailExpanded((current) => !current);
    setControlsVisible(true);
  }, [isLocked]);

  const handleHideUpNext = useCallback(() => {
    setUtilityRailExpanded(false);
    setControlsVisible(true);
  }, []);

  const handleToggleQuickActions = useCallback(() => {
    if (isLocked) return;
    setUtilityRailExpanded(false);
    setPropertiesPanelVisible(false);
    setTrimPanelVisible(false);
    setQuickActionsExpanded((current) => !current);
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
      const savedClip = await saveTrimmedClip({
        video,
        clipStart: nextStart,
        clipEnd: nextEnd,
        title: trimTitle,
      });
      setTrimPanelVisible(false);
      showHud("seek", `Saved ${savedClip.title}`, 1);
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
      setUtilityRailExpanded(false);
      setQuickActionsExpanded(false);
      setPropertiesPanelVisible(false);
      setTrimPanelVisible(false);
    }
  }, [isLocked]);

  const showLockedScreenAlert = useCallback(() => {
    Alert.alert("Screen Locked", "Unlock this screen first.");
  }, []);

  const handleToggleNightMode = useCallback(() => {
    const nextNightMode = !nightMode;
    setNightMode(nextNightMode);
    showHud(
      "brightness",
      nextNightMode ? "Night mode on" : "Night mode off",
      nextNightMode ? 0.8 : brightnessLevel
    );
  }, [brightnessLevel, nightMode, showHud]);

  const handleToggleBackgroundPlay = useCallback(() => {
    const nextBackgroundPlay = !backgroundPlayRef.current;
    backgroundPlayRef.current = nextBackgroundPlay;
    void updateSettings({ backgroundPlay: nextBackgroundPlay });

    if (player) {
      applyPlayerAudioState(player, {
        volume,
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
  }, [isMuted, player, showHud, updateSettings, videoId, volume]);

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
      const atTime = Number.isFinite(player.currentTime) ? player.currentTime : position;
      const [frame] = await player.generateThumbnailsAsync([atTime], { maxWidth: 720 });
      if (frame) {
        showScreenshotPreview(frame);
        setControlsVisible(true);
        const frameUri = (frame as { uri?: string }).uri;

        if (frameUri) {
          // Gallery save requires @react-native-camera-roll/camera-roll (not installed)
          showHud("seek", "Shot captured", 0.85);
        } else {
          showHud("seek", "Shot captured", 0.85);
        }
      }
    } catch {
      showHud("seek", "Screenshot capture failed", 0.1);
    }
  }, [isAudioMode, player, position, showHud, showScreenshotPreview]);

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
    (targetVideo: typeof video, direction: "next" | "prev") => {
      if (!targetVideo || !videoId || !player) return;

      const currentPosition = Number.isFinite(player.currentTime)
        ? getRelativePlaybackPosition(
          video,
          player.currentTime,
          sourceDuration || player.duration || duration || video?.duration || 0
        )
        : position;

      if (settings.rememberPosition && currentPosition > 0) {
        void updateLastPosition(videoId, currentPosition);
      }

      runTransition(targetVideo.title, direction);
      player.pause();
      hasRestoredPosition.current = false;
      lastSavedPosition.current = 0;
      setPosition(0);
      setDuration(0);
      setSourceDuration(0);
      setSeekPreviewPosition(null);
      setControlsVisible(true);
      setUtilityRailExpanded(false);
      setQuickActionsExpanded(false);
      setPropertiesPanelVisible(false);
      setTrimPanelVisible(false);
      setScreenshotPreview(null);
      if (screenshotTimer.current) clearTimeout(screenshotTimer.current);
      setActiveVideoId(targetVideo.id);
    },
    [
      player,
      position,
      sourceDuration,
      duration,
      runTransition,
      settings.rememberPosition,
      updateLastPosition,
      video,
      videoId,
    ]
  );

  const handlePrev = useCallback(() => {
    if (!previousVideo) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    handleNavigateToVideo(previousVideo, "prev");
  }, [handleNavigateToVideo, previousVideo]);

  const handleNext = useCallback(() => {
    if (!nextVideo) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    handleNavigateToVideo(nextVideo, "next");
  }, [handleNavigateToVideo, nextVideo]);

  useSafeTrackPlayerEvents([Event.RemoteNext, Event.RemotePrevious, Event.RemotePlay, Event.RemotePause, Event.PlaybackQueueEnded], (event: any) => {
    if (event.type === Event.RemoteNext) {
      if (nextVideo) handleNavigateToVideo(nextVideo, "next");
    } else if (event.type === Event.RemotePrevious) {
      if (previousVideo) handleNavigateToVideo(previousVideo, "prev");
    } else if (event.type === Event.RemotePlay) {
      if (player) {
        player.play();
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
  });

  const handlePickUpcomingVideo = useCallback(
    (targetVideo: typeof video) => {
      if (!targetVideo || !videoId) return;
      if (Platform.OS !== "web") {
        ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
      }
      const targetIndex = videos.findIndex((item) => item.id === targetVideo.id);
      const direction =
        targetIndex >= currentIndex ? ("next" as const) : ("prev" as const);
      handleNavigateToVideo(targetVideo, direction);
    },
    [currentIndex, handleNavigateToVideo, videoId, videos]
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
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    setUpNextLandscapePage((current) => Math.max(current - 1, 0));
    setControlsVisible(true);
  }, [canScrollUpNextPrev]);

  const handleScrollUpNextNext = useCallback(() => {
    if (!canScrollUpNextNext) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
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
    if (!player) {
      navigation.goBack();
      return;
    }
    const nextPosition = Number.isFinite(player.currentTime)
      ? getRelativePlaybackPosition(video, player.currentTime, sourceDuration || player.duration || duration)
      : position;

    if (videoId && settings.rememberPosition && nextPosition > 0) {
      void updateLastPosition(videoId, nextPosition);
    }
    if (!settings.backgroundPlay) {
      player.pause();
    }
    navigation.goBack();
  }, [
    isLocked,
    player,
    position,
    settings.backgroundPlay,
    settings.rememberPosition,
    showLockedScreenAlert,
    sourceDuration,
    updateLastPosition,
    video,
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
      return false;
    });

    return () => subscription.remove();
  }, [
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
        setIsPlaying(nextIsPlaying);

        if (videoId && settings.rememberPosition && nextPosition > 0) {
          if (Math.abs(nextPosition - lastSavedPosition.current) >= 2) {
            lastSavedPosition.current = nextPosition;
            void updateLastPosition(videoId, nextPosition);
          }
        }

        const clipReachedEnd =
          clipEndPosition !== null &&
          nextAbsolutePosition >= Math.max(clipEndPosition - 0.2, clipStartOffset);
        const sourceReachedEnd =
          clipEndPosition === null &&
          nextSourceDuration > 0 &&
          nextAbsolutePosition >= Math.max(nextSourceDuration - 0.35, 0);

        if (video?.isClip && clipReachedEnd && settings.loopMode === "one") {
          player.currentTime = clipStartOffset;
          if (!player.playing) {
            player.play();
          }
          setPosition(0);
          setIsPlaying(true);
          completionHandledVideoId.current = null;
          wasPlayingRef.current = true;
          return;
        }

        if (
          videoId &&
          (clipReachedEnd || (wasPlayingRef.current && !nextIsPlaying && sourceReachedEnd)) &&
          completionHandledVideoId.current !== videoId
        ) {
          completionHandledVideoId.current = videoId;
          lastSavedPosition.current = 0;

          if (settings.rememberPosition) {
            void updateLastPosition(videoId, 0);
          }

          if (nextVideo) {
            handleNavigateToVideo(nextVideo, "next");
          } else {
            player.pause();
            navigation.goBack();
          }
        }

        wasPlayingRef.current = nextIsPlaying;
      } catch {
        clearReleasedPlayer(player);
        // Ignore transient player read errors while the source is mounting.
      }
    }, 500);

    return () => clearInterval(interval);
  }, [
    handleNavigateToVideo,
    nextVideo,
    player,
    navigation,
    seekPreviewPosition,
    clipEndPosition,
    clipStartOffset,
    settings.loopMode,
    settings.rememberPosition,
    updateLastPosition,
    video,
    videoId,
    clearReleasedPlayer,
  ]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (event, gestureState) => {
          if (isLocked) return false;
          if (
            !isAudioMode &&
            (gestureState.numberActiveTouches >= 2 ||
              (event.nativeEvent.touches?.length ?? 0) >= 2)
          ) {
            return true;
          }
          return (
            Math.abs(gestureState.dx) > GESTURE_ACTIVATION_DISTANCE ||
            Math.abs(gestureState.dy) > GESTURE_ACTIVATION_DISTANCE
          );
        },
        onPanResponderGrant: (event) => {
          gestureRef.current = {
            mode: null,
            startX: event.nativeEvent.locationX,
            startPosition: seekPreviewPosition ?? position,
            startVolume: volume,
            startBrightness: brightnessLevel,
          };
          const touchDistance = getTouchDistance(
            event.nativeEvent.touches as
            | Array<{ pageX: number; pageY: number }>
            | undefined
          );
          pinchGestureRef.current = {
            active: touchDistance > 0,
            startDistance: touchDistance,
            startScale: zoomScale,
            hasChanged: false,
          };
        },
        onPanResponderMove: (event, gestureState) => {
          if (!video) return;

          const touches = event.nativeEvent.touches as
            | Array<{ pageX: number; pageY: number }>
            | undefined;
          if (!isAudioMode && (touches?.length ?? 0) >= 2) {
            if (tapTimer.current) {
              clearTimeout(tapTimer.current);
              tapTimer.current = null;
            }
            lastTap.current = { time: 0, zone: null };
            const distance = getTouchDistance(touches);
            if (distance > 0) {
              if (!pinchGestureRef.current.active) {
                pinchGestureRef.current = {
                  active: true,
                  startDistance: distance,
                  startScale: zoomScale,
                  hasChanged: false,
                };
              }

              gestureRef.current.mode = "zoom";
              const nextScale =
                pinchGestureRef.current.startScale *
                (distance / Math.max(pinchGestureRef.current.startDistance, 1));

              if (
                Math.abs(nextScale - pinchGestureRef.current.startScale) >=
                PINCH_GESTURE_ACTIVATION_DELTA
              ) {
                pinchGestureRef.current.hasChanged = true;
              }

              handleSetZoomScale(nextScale);
            }
            return;
          }

          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);
          const currentGesture = gestureRef.current;

          if (absDx > 8 || absDy > 8) {
            if (tapTimer.current) {
              clearTimeout(tapTimer.current);
              tapTimer.current = null;
            }
            lastTap.current = { time: 0, zone: null };
          }

          if (!currentGesture.mode) {
            if (
              absDy > GESTURE_ACTIVATION_DISTANCE &&
              absDy >= absDx * 0.55
            ) {
              const isRightSide = currentGesture.startX > viewport.width / 2;
              if (isRightSide && settings.swipeVolume) {
                currentGesture.mode = "volume";
              } else if (!isAudioMode && !isRightSide && settings.swipeBrightness) {
                currentGesture.mode = "brightness";
              }
            } else if (
              settings.swipeSeek &&
              absDx > GESTURE_ACTIVATION_DISTANCE &&
              absDx > absDy * 0.95
            ) {
              currentGesture.mode = "seek";
            }
          }

          if (currentGesture.mode === "volume") {
            const nextVolume = resolveVerticalGestureValue({
              locationY: event.nativeEvent.locationY,
              viewportHeight: viewport.height,
            });
            handleSetVolume(nextVolume);
            return;
          }

          if (currentGesture.mode === "brightness") {
            const nextBrightness = resolveVerticalGestureValue({
              locationY: event.nativeEvent.locationY,
              viewportHeight: viewport.height,
            });
            handleSetBrightness(nextBrightness);
            return;
          }

          if (currentGesture.mode === "seek") {
            const seekableDuration =
              duration > 0 ? duration : Math.max(currentGesture.startPosition + 120, 120);
            const seekWindow =
              duration > 0
                ? clamp(duration * 0.35, 90, HORIZONTAL_SEEK_MAX_WINDOW)
                : 180;
            const normalizedDx =
              gestureState.dx / Math.max(viewport.width || 1, 1);
            const nextPosition = clamp(
              currentGesture.startPosition +
              applyGestureCurve(normalizedDx, 1.12) * seekWindow,
              0,
              seekableDuration
            );
            scheduleSeekGestureUpdate({
              mode: "seek",
              value: nextPosition,
              duration: seekableDuration,
            });
          }
        },
        onPanResponderRelease: (event, gestureState) => {
          if (gestureFrame.current !== null) {
            cancelAnimationFrame(gestureFrame.current);
            gestureFrame.current = null;
            flushGestureUpdate();
          }

          const pinchGestureUsed =
            pinchGestureRef.current.active || pinchGestureRef.current.hasChanged;
          pinchGestureRef.current = {
            active: false,
            startDistance: 0,
            startScale: zoomScale,
            hasChanged: false,
          };

          if (
            gestureRef.current.mode === "seek" &&
            seekPreviewPositionRef.current !== null
          ) {
            handleSeek(seekPreviewPositionRef.current);
          } else if (pinchGestureUsed) {
            // Ignore tap handling after a multi-touch zoom gesture.
          } else if (
            Math.abs(gestureState.dx) < 8 &&
            Math.abs(gestureState.dy) < 8
          ) {
            handleTap(event);
          }
          gestureRef.current.mode = null;
        },
        onPanResponderTerminate: () => {
          if (gestureFrame.current !== null) {
            cancelAnimationFrame(gestureFrame.current);
            gestureFrame.current = null;
          }
          pendingGestureUpdate.current = null;
          gestureRef.current.mode = null;
          pinchGestureRef.current = {
            active: false,
            startDistance: 0,
            startScale: zoomScale,
            hasChanged: false,
          };
          setSeekPreviewPosition(null);
          seekPreviewPositionRef.current = null;
        },
      }),
    [
      brightnessLevel,
      duration,
      flushGestureUpdate,
      handleSetBrightness,
      handleSeek,
      handleSetZoomScale,
      handleSetVolume,
      isLocked,
      isAudioMode,
      position,
      scheduleSeekGestureUpdate,
      settings.swipeBrightness,
      settings.swipeSeek,
      settings.swipeVolume,
      video,
      viewport.height,
      viewport.width,
      volume,
      zoomScale,
    ]
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

  if (!player) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Loading player...</Text>
      </View>
    );
  }

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
          ? `Zoom ${zoomScale.toFixed(2)}x`
          : "Pinch zoom ready",
        contentFitMode === "contain"
          ? "Fit mode"
          : contentFitMode === "cover"
            ? "Expand mode"
            : "Stretch mode",
        effectiveOrientationMode === "default"
          ? "Auto rotate"
          : effectiveOrientationMode === "landscape"
            ? "Landscape lock"
            : "Portrait lock",
      ]),
    isMuted ? "Muted" : `Volume ${Math.round(volume * 100)}%`,
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
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
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
              StyleSheet.absoluteFill,
              zoomScale > MIN_PINCH_SCALE + 0.001
                ? { transform: [{ scale: zoomScale }] }
                : null,
            ]}
          >
            <Video
              ref={videoRef}
              source={playbackUri ? { uri: playbackUri } : undefined}
              style={[
                StyleSheet.absoluteFill,
                isAudioMode ? styles.hiddenMediaView : null,
              ]}
              resizeMode={contentFitMode === "cover" ? "cover" : contentFitMode === "fill" ? "stretch" : "contain"}
              controls={false}
              fullscreen={false}
              paused={!isPlaying}
              repeat={player?.loop ?? false}
              rate={player?.playbackRate ?? 1}
              volume={player?.volume ?? 1}
              muted={player?.muted ?? false}
              onProgress={(data) => {
                const shim = playerRef.current as any;
                if (shim) {
                  shim._setCurrentTime?.(data.currentTime);
                  shim._setDuration?.(data.seekableDuration);
                  shim._setPlaying?.(!data.currentTime || data.currentTime > 0);
                }
              }}
              onEnd={() => {
                const shim = playerRef.current as any;
                if (shim) shim._setPlaying?.(false);
              }}
            />
          </View>
        </View>
        {isAudioMode ? (
          <View pointerEvents="none" style={styles.audioModeCanvas}>
            <View style={styles.audioModeGlow} />
            <View style={styles.audioModeHero}>
              <View style={styles.audioModeDisc}>
                <View style={styles.audioModeDiscInner}>
                  <Feather name="music" size={42} color="#D8EAFF" />
                </View>
              </View>
              <Text style={styles.audioModeEyebrow}>Audio Player</Text>
              <Text style={styles.audioModeTitle} numberOfLines={2}>
                {video.title}
              </Text>
              <Text style={styles.audioModeMeta} numberOfLines={1}>
                {video.folder || "Unknown folder"} | {formatDuration(video.duration || duration)}
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

      {nightMode ? <View pointerEvents="none" style={styles.nightOverlay} /> : null}

      {gestureHud ? (
        gestureHud.mode === "seek" || gestureHud.mode === "zoom" ? (
          <View pointerEvents="none" style={styles.hud}>
            <Text style={styles.hudTitle}>
              {gestureHud.mode === "zoom" ? "Zoom" : "Seek"}
            </Text>
            <Text style={styles.hudLabel}>{gestureHud.label}</Text>
            <View style={styles.hudTrack}>
              <View
                style={[
                  styles.hudFill,
                  { width: `${gestureHud.progress * 100}%` as const },
                ]}
              />
            </View>
          </View>
        ) : (
          <View
            pointerEvents="none"
            style={[
              styles.sideHudWrap,
              gestureHud.mode === "brightness"
                ? styles.sideHudWrapLeft
                : styles.sideHudWrapRight,
            ]}
          >
            <View style={styles.sideHudCard}>
              <Feather
                name={
                  gestureHud.mode === "volume"
                    ? gestureHud.progress <= 0.01
                      ? "volume-x"
                      : "volume-2"
                    : "sun"
                }
                size={22}
                color="#fff"
              />
              <Text style={styles.sideHudPercent}>
                {Math.round(gestureHud.progress * 100)}%
              </Text>
              <View style={styles.sideHudTrack}>
                <View
                  style={[
                    styles.sideHudFill,
                    { height: `${gestureHud.progress * 100}%` as const },
                  ]}
                />
              </View>
            </View>
          </View>
        )
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
                {Math.max(currentIndex + 1, 1)}/{videos.length}
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
                offset: QUEUE_ITEM_LAYOUT_HEIGHT * index,
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
        contentFitMode={contentFitMode}
        utilityRailExpanded={utilityRailExpanded}
        quickActionsExpanded={quickActionsExpanded}
        isLocked={isLocked}
        backgroundPlay={settings.backgroundPlay}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        speed={speed}
        isMuted={isMuted}
        loopMode={loopMode}
        nightMode={nightMode}
        orientationMode={effectiveOrientationMode}
        onSpeedChange={handleSpeedChange}
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
        onTrimAction={!isAudioMode ? handleOpenTrimPanel : undefined}
        onScreenshot={handleScreenshot}
        trimLabel={video.isClip ? "Trim Again" : "Trim"}
        zoomLabel={
          zoomScale > MIN_PINCH_SCALE + 0.01 ? "Reset Zoom" : "Pinch Zoom"
        }
        onZoomAction={!isAudioMode ? handleZoomAction : undefined}
        onClose={handleClose}
        onPrev={previousVideo ? handlePrev : undefined}
        onNext={nextVideo ? handleNext : undefined}
        title={video.title}
        visible={controlsVisible}
      />
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
  hud: {
    position: "absolute",
    top: "28%",
    alignSelf: "center",
    minWidth: 200,
    maxWidth: 280,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 8,
  },
  hudTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  hudLabel: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  hudTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },
  hudFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#4BA3FF",
  },
  sideHudWrap: {
    position: "absolute",
    top: "26%",
    transform: [{ translateY: -5 }],
  },
  sideHudWrapLeft: {
    left: 18,
  },
  sideHudWrapRight: {
    right: 18,
  },
  sideHudCard: {
    width: 64,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.74)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sideHudPercent: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  sideHudTrack: {
    width: 8,
    height: 116,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  sideHudFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#4BA3FF",
    minHeight: 6,
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
});
