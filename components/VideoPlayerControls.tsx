import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import LinearGradient from "react-native-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { formatDuration } from "@/utils/formatters";

const LOCK_HOLD_UNLOCK_MS = 1000;
const DOUBLE_TAP_SEEK_SECONDS = 10;
const DOUBLE_TAP_TIMEOUT = 280;
const DOUBLE_TAP_EDGE_RATIO = 0.32; // Left 32% = backward, right 68% = forward
const YT_RED = "#FF3B30";

type Props = {
  mediaType: "video" | "audio";
  isPlaying: boolean;
  duration: number;
  position: number;
  speed: number;
  isMuted: boolean;
  loopMode: "none" | "one" | "all";
  contentFitMode: "contain" | "cover" | "fill";
  utilityRailExpanded: boolean;
  quickActionsExpanded: boolean;
  isLocked: boolean;
  nightMode: boolean;
  backgroundPlay: boolean;
  orientationMode: "default" | "portrait" | "landscape";
  seekPreviewPosition?: number | null;
  forcedAspectRatio?: string | null;
  decoderMode?: string;
  volumeBoost?: number;
  audioTrackLabel?: string;
  controlsVisible: boolean;
  volume?: number;
  brightness?: number;
  onVolumeChange?: (v: number) => void;
  onBrightnessChange?: (v: number) => void;
  onPlayPause: (source?: "transport" | "surface_double_tap") => void;
  onSeek: (position: number) => void;
  onSeekBackward?: (seconds: number) => void;
  onSeekForward?: (seconds: number) => void;
  onScrubbingChange?: (isScrubbing: boolean) => void;
  onSpeedChange: () => void;
  onToggleMute: () => void;
  onToggleLoop: () => void;
  onToggleContentFit: () => void;
  onToggleUtilityRail: () => void;
  onToggleQuickActions: () => void;
  onToggleProperties: () => void;
  onToggleLockMode: () => void;
  onToggleNightMode: () => void;
  onToggleBackgroundPlay: () => void;
  onCycleOrientation: () => void;
  onSetAspectRatio?: (ratio: string | null) => void;
  onCycleDecoderMode?: () => void;
  onCycleVolumeBoost?: () => void;
  onCycleAudioTrack?: () => void;
  onSubtitlesAction?: () => void;
  /** Subtitle quick-action state — drives chip badge/colour. */
  subtitlesStatus?: 'off' | 'generating' | 'ready' | 'error';
  /** 0..1 generation progress, only meaningful when subtitlesStatus === 'generating'. */
  subtitlesProgress?: number;
  onTrimAction?: () => void;
  onScreenshot: () => void;
  trimLabel?: string;
  zoomLabel?: string;
  onZoomAction?: () => void;
  onOpenNetworkStream?: () => void;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  title: string;
  visible: boolean;
  sleepTimerRemaining: number | null;
  onSetSleepTimer: (minutes: number | null) => void;
  onStartOver?: () => void;
  showStartOverButton?: boolean;
};

export function VideoPlayerControls({
  mediaType,
  isPlaying,
  duration,
  position,
  speed,
  isMuted,
  loopMode,
  contentFitMode,
  utilityRailExpanded,
  quickActionsExpanded,
  isLocked,
  nightMode,
  backgroundPlay,
  orientationMode,
  seekPreviewPosition,
  forcedAspectRatio,
  decoderMode,
  volumeBoost = 1,
  controlsVisible,
  audioTrackLabel,
  volume = 1,
  brightness = 0.5,
  onVolumeChange,
  onBrightnessChange,
  onPlayPause,
  onSeek,
  onSeekBackward,
  onSeekForward,
  onScrubbingChange,
  onSpeedChange,
  onToggleMute,
  onToggleLoop,
  onToggleContentFit,
  onToggleUtilityRail,
  onToggleQuickActions,
  onToggleProperties,
  onToggleLockMode,
  onToggleNightMode,
  onToggleBackgroundPlay,
  onCycleOrientation,
  onSetAspectRatio,
  onCycleDecoderMode,
  onCycleVolumeBoost,
  onCycleAudioTrack,
  onSubtitlesAction,
  subtitlesStatus = 'off',
  subtitlesProgress = 0,
  onTrimAction,
  onScreenshot,
  trimLabel,
  zoomLabel,
  onZoomAction,
  onOpenNetworkStream,
  onClose,
  onNext,
  onPrev,
  title,
  visible,
  sleepTimerRemaining,
  onSetSleepTimer,
  onStartOver,
  showStartOverButton,
}: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const moreMenuAnim = useRef(new Animated.Value(0)).current;
  const progressGestureStartX = useRef(0);
  const [barWidth, setBarWidth] = useState(0);
  const [aspectPickerVisible, setAspectPickerVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const isAudioMode = mediaType === "audio";
  const isTablet = Math.min(width, height) >= 600;
  const baseWidth = 390;
  const scale = width / baseWidth;
  const footerScale = isTablet
    ? Math.min(1.2, scale)
    : Math.max(0.9, Math.min(1.1, scale));
  const utilityButtonSize = 52;
  const transportPlaySize = utilityButtonSize;
  const transportSkipSize = utilityButtonSize;
  const transportPlayIconSize = Math.round(26 * footerScale);
  const transportSkipIconSize = Math.round(22 * footerScale);
  const transportGap = Math.round((isTablet ? 28 : 22) * footerScale);
  const bottomPadding = Math.round(14 * footerScale);
  const nativePointerEvents =
    Platform.OS === "web"
      ? {}
      : { pointerEvents: visible ? ("box-none" as const) : ("none" as const) };

  // Double-tap chain tracking with full properties
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

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [visible, opacity]);

  useEffect(() => {
    Animated.timing(moreMenuAnim, {
      toValue: quickActionsExpanded ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [moreMenuAnim, quickActionsExpanded]);
  useEffect(() => {
  Animated.timing(opacity, {
    toValue: visible && controlsVisible ? 1 : 0,  // Add controlsVisible
    duration: 200,
    useNativeDriver: Platform.OS !== "web",
  }).start();
}, [visible, controlsVisible, opacity]);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safePosition = Number.isFinite(position) && position >= 0 ? position : 0;
  const reportedProgress = safeDuration > 0 ? Math.min(safePosition / safeDuration, 1) : 0;
  const progress = dragProgress !== null ? dragProgress : reportedProgress;

  // Reset double-tap chain helper
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

  // Get chained seek amount (consecutive taps accumulate: 10s, 20s, 30s)
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

  // Get tap zone based on touch location
  const getTapZone = useCallback((locationX: number): 'left' | 'right' | 'center' => {
    const screenWidth = Dimensions.get('window').width;
    const edgeWidth = screenWidth * DOUBLE_TAP_EDGE_RATIO;
    if (locationX <= edgeWidth) return 'left';
    if (locationX >= screenWidth - edgeWidth) return 'right';
    return 'center';
  }, []);

  // Handle double-tap backward/forward
  const handleDoubleTapSeek = useCallback((zone: 'left' | 'right') => {
    if (isLocked) return;
    const seekAmount = getChainedSeekAmount(zone);
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight", { enableVibrateFallback: true });
    }
    if (zone === 'left') {
      const newPosition = Math.max(0, safePosition - seekAmount);
      onSeek(newPosition);
      onSeekBackward?.(seekAmount);
    } else {
      const newPosition = Math.min(safeDuration, safePosition + seekAmount);
      onSeek(newPosition);
      onSeekForward?.(seekAmount);
    }
  }, [isLocked, getChainedSeekAmount, safePosition, safeDuration, onSeek, onSeekBackward, onSeekForward]);

  const seekFromLocationX = useCallback((locationX: number) => {
    if (Number.isFinite(locationX) && Number.isFinite(barWidth) && barWidth > 0 && safeDuration > 0) {
      const ratio = Math.max(0, Math.min(1, locationX / barWidth));
      const seekTo = ratio * safeDuration;
      if (Number.isFinite(seekTo)) {
        setDragProgress(ratio);
        onSeek(seekTo);
      }
    }
  }, [barWidth, onSeek, safeDuration]);

  const handleProgressPress = useCallback((event: any) => {
    const locationX = typeof event?.nativeEvent?.locationX === "number" ? event.nativeEvent.locationX : NaN;
    seekFromLocationX(locationX);
    setDragProgress(null);
  }, [seekFromLocationX]);

  const progressGestureBegin = useCallback((startX: number) => {
    isDraggingRef.current = true;
    onScrubbingChange?.(true);
    progressGestureStartX.current = Number.isFinite(startX) ? startX : 0;
    seekFromLocationX(startX);
  }, [onScrubbingChange, seekFromLocationX]);

  const progressGestureUpdate = useCallback((translationX: number) => {
    seekFromLocationX(progressGestureStartX.current + translationX);
  }, [seekFromLocationX]);

  const progressGestureEnd = useCallback(() => {
    isDraggingRef.current = false;
    onScrubbingChange?.(false);
    setDragProgress(null);
  }, [onScrubbingChange]);

  const progressGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .activeOffsetX([-6, 6])
        .onBegin((e) => runOnJS(progressGestureBegin)(e.x))
        .onUpdate((e) => runOnJS(progressGestureUpdate)(e.translationX))
        .onEnd(() => runOnJS(progressGestureEnd)())
        .onFinalize(() => runOnJS(progressGestureEnd)()),
    [progressGestureBegin, progressGestureUpdate, progressGestureEnd]
  );

  const loopIcon = loopMode === "none" ? "repeat-off" : loopMode === "one" ? "repeat-once" : "repeat";
  const orientationLabel = orientationMode === "landscape" ? "Landscape" : orientationMode === "portrait" ? "Portrait" : "Auto";
  const moreMenuOpacity = moreMenuAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1] });
  
  const bottomBarSwipeEnd = useCallback((translationY: number) => {
    if (isLocked) return;
    if (translationY <= -18 || translationY >= 18) {
      if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactLight");
      onToggleUtilityRail?.();
    }
  }, [isLocked, onToggleUtilityRail]);

  const bottomBarGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-18, 18])
        .failOffsetX([-30, 30])
        .onEnd((e) => runOnJS(bottomBarSwipeEnd)(e.translationY)),
    [bottomBarSwipeEnd]
  );

  const triggerAction = (action?: () => void) => {
    if (!action) return;
    if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactLight");
    action();
  };

  // Double-tap on video edge zones via gesture-handler.
  // Native maxDelay handles the chain timing; locationX gives zone routing.


  // Build flat list of visible MX quick-bar items
  const mxQuickItems = useMemo(() => {
    const items: { key: string; icon: React.ReactNode; onPress: () => void; active?: boolean }[] = [];
    items.push({
      key: "speed",
      icon: <Text style={styles.mxSpeedText}>{speed}x</Text>,
      onPress: () => triggerAction(onSpeedChange),
    });
    if (!isAudioMode) {
      items.push({
        key: "screenshot",
        icon: <Feather name="camera" size={19} color="#fff" />,
        onPress: () => triggerAction(onScreenshot),
      });
    }
    items.push({
      key: "loop",
      icon: <MaterialCommunityIcons name={loopIcon} size={19} color={loopMode !== "none" ? "#4ADE80" : "#fff"} />,
      onPress: () => triggerAction(onToggleLoop),
      active: loopMode !== "none",
    });
    items.push({
      key: "mute",
      icon: <Feather name={isMuted ? "volume-x" : "volume-2"} size={19} color={isMuted ? "#FCA5A5" : "#fff"} />,
      onPress: () => triggerAction(onToggleMute),
      active: isMuted,
    });
    items.push({
      key: "night",
      icon: <Feather name="moon" size={19} color={nightMode ? "#FDE68A" : "#fff"} />,
      onPress: () => triggerAction(onToggleNightMode),
      active: nightMode,
    });
    if (!isAudioMode) {
      items.push({
        key: "orientation",
        icon: <Feather name="rotate-cw" size={19} color="#fff" />,
        onPress: () => triggerAction(onCycleOrientation),
      });
    }
    if (!isAudioMode && onSetAspectRatio) {
      items.push({
        key: "aspect",
        icon: <Feather name="maximize-2" size={19} color={forcedAspectRatio ? "#FB923C" : "#fff"} />,
        onPress: () => setAspectPickerVisible(v => !v),
        active: !!forcedAspectRatio,
      });
    }
    if (onCycleVolumeBoost) {
      items.push({
        key: "boost",
        icon: <Feather name="volume-2" size={19} color={volumeBoost > 1 ? "#FB923C" : "#fff"} />,
        onPress: () => triggerAction(onCycleVolumeBoost!),
        active: volumeBoost > 1,
      });
    }
    if (onCycleAudioTrack) {
      items.push({
        key: "audio",
        icon: <MaterialCommunityIcons name="translate" size={19} color="#fff" />,
        onPress: () => triggerAction(onCycleAudioTrack!),
      });
    }
    if (onSubtitlesAction) {
      const ccColor =
        subtitlesStatus === 'ready' ? '#34D399' :
        subtitlesStatus === 'generating' ? '#FB923C' :
        subtitlesStatus === 'error' ? '#F87171' :
        '#fff';
      items.push({
        key: "subtitles",
        icon: (
          <View style={{ alignItems: 'center' }}>
            <MaterialCommunityIcons name="closed-caption-outline" size={20} color={ccColor} />
            {subtitlesStatus === 'generating' && subtitlesProgress > 0 ? (
              <Text style={{ color: ccColor, fontSize: 8, fontWeight: '700', marginTop: -2 }}>
                {Math.round(subtitlesProgress * 100)}%
              </Text>
            ) : null}
          </View>
        ),
        onPress: () => triggerAction(onSubtitlesAction!),
        active: subtitlesStatus === 'ready' || subtitlesStatus === 'generating',
      });
    }
    if (!isAudioMode && onCycleDecoderMode) {
      items.push({
        key: "decoder",
        icon: <MaterialCommunityIcons name="chip" size={19} color={decoderMode === "HW" || decoderMode === "HW+" ? "#FB923C" : "#fff"} />,
        onPress: () => triggerAction(onCycleDecoderMode!),
        active: decoderMode === "HW" || decoderMode === "HW+",
      });
    }
    if (!isAudioMode && onTrimAction) {
      items.push({
        key: "trim",
        icon: <Feather name="scissors" size={19} color="#fff" />,
        onPress: () => triggerAction(onTrimAction!),
      });
    }
    if (!isAudioMode && onZoomAction) {
      items.push({
        key: "zoom",
        icon: <Feather name="zoom-in" size={19} color="#fff" />,
        onPress: () => triggerAction(onZoomAction!),
      });
    }
    items.push({
      key: "background",
      icon: <Ionicons name={backgroundPlay ? "musical-notes" : "musical-notes-outline"} size={19} color={backgroundPlay ? "#60A5FA" : "#fff"} />,
      onPress: () => triggerAction(onToggleBackgroundPlay),
      active: backgroundPlay,
    });
    items.push({
      key: "info",
      icon: <Feather name="info" size={19} color="#fff" />,
      onPress: () => triggerAction(onToggleProperties),
    });
    items.push({
      key: "timer",
      icon: <MaterialCommunityIcons
        name={sleepTimerRemaining !== null ? "timer" : "timer-outline"}
        size={19}
        color={sleepTimerRemaining !== null ? "#FB923C" : "#fff"}
      />,
      onPress: () => {
        const options: (number | null)[] = [15, 30, 45, 60, null];
        const cur = sleepTimerRemaining !== null ? Math.round(sleepTimerRemaining / 60) : null;
        const idx = options.findIndex(o => o === cur);
        const next = options[(idx + 1) % options.length];
        triggerAction(() => onSetSleepTimer(next));
      },
      active: sleepTimerRemaining !== null,
    });
    if (onStartOver) {
      items.push({
        key: "restart",
        icon: <MaterialCommunityIcons name="restart" size={19} color="#fff" />,
        onPress: () => triggerAction(onStartOver),
      });
    }
    if (onOpenNetworkStream) {
      items.push({
        key: "stream",
        icon: <Feather name="wifi" size={19} color="#fff" />,
        onPress: () => triggerAction(onOpenNetworkStream!),
      });
    }
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, isAudioMode, loopMode, isMuted, nightMode, backgroundPlay, forcedAspectRatio, volumeBoost, decoderMode, sleepTimerRemaining, subtitlesStatus, subtitlesProgress, onCycleVolumeBoost, onCycleAudioTrack, onSubtitlesAction, onCycleDecoderMode, onTrimAction, onZoomAction, onSetAspectRatio, onStartOver, onOpenNetworkStream]);

  const MX_DEFAULT_COUNT = 3;
  const quickOverflowItems = useMemo(
    () => mxQuickItems.slice(MX_DEFAULT_COUNT),
    [mxQuickItems]
  );

  const seekProgress = seekPreviewPosition != null && safeDuration > 0
    ? Math.min(Math.max(seekPreviewPosition / safeDuration, 0), 1)
    : null;

  const handleSeekBack = useCallback(() => {
    onSeek(Math.max(0, safePosition - 10));
  }, [onSeek, safePosition]);

  const handleSeekForward = useCallback(() => {
    onSeek(Math.min(safeDuration, safePosition + 10));
  }, [onSeek, safePosition, safeDuration]);

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[styles.overlay, { opacity }, Platform.OS === "web" ? { pointerEvents: visible ? "box-none" : "none" } : null]}
      {...nativePointerEvents}
    >
      {/* Video area double-tap now handled by parent PlayerScreen */}


      {/* Top gradient */}
      <LinearGradient
        colors={["rgba(0,0,0,0.82)", "rgba(0,0,0,0.28)", "transparent"]}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* Bottom gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.36)", "rgba(0,0,0,0.86)"]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Top bar — back button + title + three-dot menu */}
      <View style={styles.topSection}>
        <View style={styles.topBar}>
          <AnimatedIconBtn onPress={onClose} hitSlop={12}>
            <Feather name="chevron-left" size={26} color="#fff" />
          </AnimatedIconBtn>
          <View style={styles.topTextBlock}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
          </View>
          {!isLocked ? (
            <AnimatedIconBtn onPress={() => triggerAction(onToggleQuickActions)} hitSlop={8}>
              <Feather name="more-vertical" size={22} color="#fff" />
            </AnimatedIconBtn>
          ) : null}
        </View>

        {/* MX quick bar — below title, only when unlocked */}
        {!isLocked ? (
          <View style={styles.mxQuickBar} pointerEvents="box-none">
            {mxQuickItems.slice(0, MX_DEFAULT_COUNT).map((item) => (
              <MXCircleBtn
                key={item.key}
                icon={item.icon}
                onPress={item.onPress}
                active={item.active}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Quick overflow menu (three-dot expanded) */}
      {!isLocked && quickActionsExpanded && quickOverflowItems.length > 0 ? (
        <Animated.View style={[styles.quickOverflowMenu, { opacity: moreMenuOpacity }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickOverflowRow}
          >
            {quickOverflowItems.map((item) => (
              <MXCircleBtn
                key={`overflow-${item.key}`}
                icon={item.icon}
                onPress={item.onPress}
                active={item.active}
              />
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* No floating center controls — transport is in the bottom bar */}

      {/* Bottom area — always rendered so lock button is always reachable */}
      <GestureDetector gesture={bottomBarGesture}>
      <View style={[styles.bottomBar, { paddingBottom: bottomPadding }]}>

        {/* Seek preview badge */}
        {!isLocked && seekProgress !== null ? (
          <View
            style={[styles.seekPreviewBadge, { marginLeft: `${seekProgress * 100}%` as any }]}
            pointerEvents="none"
          >
            <Text style={styles.seekPreviewText}>
              {Math.floor((seekPreviewPosition ?? 0) / 60)}:{String(Math.floor((seekPreviewPosition ?? 0) % 60)).padStart(2, '0')}
            </Text>
          </View>
        ) : null}

        {/* MX Player style: progress (with inline times) → transport → utility */}
        {!isLocked ? (
          <>
            {/* Progress row: [current] ──bar── [total] */}
            <View style={styles.progressTimeRow}>
              <Text style={styles.timeText}>{formatDuration(Math.floor(safePosition))}</Text>
              <GestureDetector gesture={progressGesture}>
                <Pressable
                  onPress={handleProgressPress}
                  onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                  style={styles.progressContainer}
                >
                  <View style={styles.progressTrack}>
                    {seekProgress !== null ? (
                      <View style={[styles.progressGhost, { width: `${seekProgress * 100}%` as const }]} pointerEvents="none" />
                    ) : null}
                    <View style={[styles.progressFill, { width: `${progress * 100}%` as const }]} />
                    <View style={[styles.progressThumb, { left: `${progress * 100}%` as const }]} />
                  </View>
                </Pressable>
              </GestureDetector>
              <Text style={styles.timeDur}>{formatDuration(Math.floor(safeDuration))}</Text>
            </View>

            {/* Transport row: ⏮  ▶/⏸  ⏭  centered */}
          </>
        ) : null}

        {/* Bottom row — lock icon left, controls right */}
        <View style={styles.bottomRow}>

          {/* Lock / unlock button — always at bottom left */}
          <Pressable
            onPress={() => triggerAction(onToggleLockMode)}
            style={({ pressed }) => [
              styles.lockBottomBtn,
              pressed && styles.lockBottomBtnPressed,
            ]}
            hitSlop={8}
          >
            <Feather name={isLocked ? "unlock" : "lock"} size={18} color="#fff" />
            {isLocked && (
              <Text style={styles.lockBottomLabel}>Unlock</Text>
            )}
          </Pressable>

          {/* Rest of bottom row — hidden when locked */}
          {!isLocked ? (
            <>
              {showStartOverButton && onStartOver && (
                <Pressable
                  onPress={onStartOver}
                  style={({ pressed }) => [
                    styles.startOverPill,
                    pressed && styles.startOverPillPressed,
                  ]}
                  hitSlop={8}
                >
                  <Feather name="refresh-cw" size={14} color="#fff" />
                  <Text style={styles.startOverPillText}>Start Over</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => triggerAction(onToggleUtilityRail)}
                style={({ pressed }) => [styles.queuePill, pressed && styles.speedPillPressed]}
              >
                <Feather
                  name={utilityRailExpanded ? "x" : "list"}
                  size={15}
                  color="#fff"
                />
                <Text style={styles.queuePillText}>
                  {utilityRailExpanded ? "Close" : "Playlist"}
                </Text>
              </Pressable>
              <View pointerEvents="box-none" style={styles.transportInlineWrap}>
                <View style={[styles.transportRowInline, { gap: transportGap }]}>
                  <Pressable
                    onPress={onPrev ? () => triggerAction(onPrev) : undefined}
                    disabled={!onPrev}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.transportSkipBtn,
                      { width: transportSkipSize, height: transportSkipSize, borderRadius: transportSkipSize / 2 },
                      pressed && onPrev ? styles.transportSkipBtnPressed : null,
                      !onPrev ? styles.transportSkipBtnDisabled : null,
                    ]}
                  >
                    <Ionicons name="play-skip-back" size={transportSkipIconSize} color={onPrev ? "#fff" : "rgba(255,255,255,0.30)"} />
                  </Pressable>

                  <Pressable
                    onPress={() => triggerAction(() => onPlayPause("transport"))}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.centerPlayBtn,
                      {
                        width: transportPlaySize,
                        height: transportPlaySize,
                        borderRadius: transportPlaySize / 2,
                      },
                      pressed && styles.centerPlayBtnPressed,
                    ]}
                  >
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={transportPlayIconSize}
                      color="#fff"
                      style={isPlaying ? undefined : styles.playIconOffset}
                    />
                  </Pressable>

                  <Pressable
                    onPress={onNext ? () => triggerAction(onNext) : undefined}
                    disabled={!onNext}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.transportSkipBtn,
                      { width: transportSkipSize, height: transportSkipSize, borderRadius: transportSkipSize / 2 },
                      pressed && onNext ? styles.transportSkipBtnPressed : null,
                      !onNext ? styles.transportSkipBtnDisabled : null,
                    ]}
                  >
                    <Ionicons name="play-skip-forward" size={transportSkipIconSize} color={onNext ? "#fff" : "rgba(255,255,255,0.30)"} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.bottomSpacer} />
              {speed !== 1 ? (
                <Pressable
                  onPress={() => triggerAction(onSpeedChange)}
                  style={({ pressed }) => [styles.speedPill, pressed && styles.speedPillPressed]}
                >
                  <Text style={styles.speedPillText}>{speed}x</Text>
                </Pressable>
              ) : null}
              {!isAudioMode ? (
                <Pressable
                  onPress={() => triggerAction(onToggleContentFit)}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name={contentFitMode === "cover" ? "crop-free" : contentFitMode === "fill" ? "fit-to-screen-outline" : "fullscreen"}
                    size={23}
                    color="#fff"
                  />
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Aspect ratio picker */}
        {!isLocked && aspectPickerVisible && onSetAspectRatio && !isAudioMode ? (
          <View style={styles.aspectPickerRow}>
            {([null, "16:9", "4:3", "21:9", "1:1"] as const).map((ratio) => (
              <Pressable
                key={ratio ?? "auto"}
                onPress={() => {
                  if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactLight");
                  onSetAspectRatio(ratio);
                  setAspectPickerVisible(false);
                }}
                style={({ pressed }) => [
                  styles.aspectBtn,
                  forcedAspectRatio === ratio && styles.aspectBtnActive,
                  pressed && styles.aspectBtnPressed,
                ]}
              >
                <Text style={[styles.aspectBtnText, forcedAspectRatio === ratio && styles.aspectBtnTextActive]}>
                  {ratio ?? "Auto"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      </GestureDetector>

      {/* Double-tap zone indicators - visible only when controls are visible */}
      {!isLocked && !isAudioMode && (
        <>
          <View style={styles.doubleTapZoneLeft} pointerEvents="none">
            <LinearGradient
             colors={["rgba(255,59,48,0)", "rgba(255,59,48,0.04)", "rgba(255,59,48,0)"]} // Reduced from 0.08
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.doubleTapZoneRight} pointerEvents="none">
            <LinearGradient
             colors={["rgba(255,59,48,0)", "rgba(255,59,48,0.04)", "rgba(255,59,48,0)"]} // Reduced from 0.08
              style={StyleSheet.absoluteFill}
            />
          </View>
        </>
      )}
    </Animated.View>
  );
}

function MXCircleBtn({
  icon,
  onPress,
  active = false,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  active?: boolean;
}) {
  // Spring-ish scale animation on press — basic+medium polish: settles fast
  // on press-in (90 ms), eases out on release (160 ms). Native driver only.
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = useCallback(() => {
    Animated.timing(scale, {
      toValue: 0.88,
      duration: 90,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [scale]);
  const handlePressOut = useCallback(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 160,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.mxCircleBtn,
          active ? styles.mxCircleBtnActive : null,
          pressed ? styles.mxCircleBtnPressed : null,
        ]}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

// Shared scale-on-press wrapper for the top-bar icon buttons (close,
// more-vertical, etc). Keeps the existing iconBtn/iconBtnPressed style
// callback shape but adds the same subtle bounce as MXCircleBtn.
function AnimatedIconBtn({
  onPress,
  hitSlop,
  children,
}: {
  onPress: () => void;
  hitSlop?: number;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = useCallback(() => {
    Animated.timing(scale, {
      toValue: 0.88,
      duration: 90,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [scale]);
  const handlePressOut = useCallback(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 160,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={hitSlop}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  // Stronger gradients for better text legibility
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 0,
    pointerEvents: "none",
  } as any,
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 0,
    pointerEvents: "none",
  } as any,

  // Double-tap zones — invisible, full height
  doubleTapZoneLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: `${DOUBLE_TAP_EDGE_RATIO * 100}%`,
    bottom: 0,
    zIndex: 1,
  },
  doubleTapZoneRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: `${DOUBLE_TAP_EDGE_RATIO * 100}%`,
    bottom: 0,
    zIndex: 1,
  },

  // Top bar — slightly more padding, title stays readable
  topSection: {
    paddingHorizontal: 4,
    paddingTop: 8,
    gap: 4,
    zIndex: 2,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  topTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  iconBtnActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 24,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  topIconSpacer: { width: 48, height: 48 },
  // Touch targets: 48×48 minimum (Material Design guideline)
  iconBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  iconBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ scale: 0.90 }],
  },
  // Quick action bar — larger circles with better spacing
  mxQuickBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 3,
  },
  // Overflow panel — cleaner, slightly larger
  quickOverflowMenu: {
    position: "absolute",
    top: 64,
    right: 8,
    maxWidth: "90%",
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(8,10,18,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 40,
  },
  quickOverflowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 2,
  },
  // MX circle buttons — 52×52 for easy tap
  mxCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.50)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  mxCircleBtnActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.45)",
  },
  mxCircleBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.22)",
    transform: [{ scale: 0.86 }],
  },
  mxSpeedText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  // Center transport — wider gaps, larger targets
  centerControls: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    zIndex: 1,
  },
  // Skip buttons — 72×72 for easy double-tap
  centerSkipBtn: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
  },
  centerSkipBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.12)",
    transform: [{ scale: 0.86 }],
  },
  centerSkipBtnDisabled: {
    opacity: 0.35,
  },
  // Play/pause — 88×88 prominent center button
  centerPlayBtn: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  centerPlayBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.32)",
    transform: [{ scale: 0.90 }],
  },
  playIconOffset: { marginLeft: 5 },

  // Bottom controls — more padding, taller progress zone
  bottomBar: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 2,
    zIndex: 2,
  },
  seekPreviewBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.88)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  seekPreviewText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  // Progress bar + inline time labels: [current] ──bar── [total]
  progressTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  // Transport row below progress: ⏮  ▶/⏸  ⏭
  transportInlineWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  transportRowInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },
  transportSkipBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  transportSkipBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.2)",
    transform: [{ scale: 0.85 }],
  },
  transportSkipBtnDisabled: {
    opacity: 0.28,
  },
  // Larger touch zone for progress bar scrubbing
  progressContainer: {
    flex: 1,
    paddingVertical: 18,
  },
  progressTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.30)",
    borderRadius: 999,
    position: "relative",
    overflow: "visible",
  },
  progressFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: YT_RED,
    borderRadius: 999,
  },
  progressGhost: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 999,
  },
  // Thumb — 20×20, easier to grab
  progressThumb: {
    position: "absolute",
    top: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    marginLeft: -10,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    minHeight: 56,
    gap: 8,
    position: "relative",
  },
  queuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  queuePillText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  startOverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 8,
  },
  startOverPillPressed: {
    backgroundColor: 'rgba(255,59,48,0.3)',
    transform: [{ scale: 0.95 }],
  },
  startOverPillText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  timeText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  timeSep: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  timeDur: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  bottomSpacer: { flex: 1 },
  speedPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  speedPillPressed: {
    backgroundColor: "rgba(255,255,255,0.24)",
    transform: [{ scale: 0.93 }],
  },
  speedPillText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  aspectPickerRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  aspectBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  aspectBtnActive: {
    backgroundColor: "rgba(255,59,48,0.24)",
    borderColor: YT_RED,
  },
  aspectBtnPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  aspectBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  aspectBtnTextActive: { color: "#FF6B6B" },

  // Lock button — bottom-left, comfortable tap size
  lockBottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    marginRight: 8,
  },
  lockBottomBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ scale: 0.90 }],
  },
  lockBottomLabel: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
