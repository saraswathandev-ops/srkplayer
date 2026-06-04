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
import type { PlayerFeatureConfig } from "@/app/playerFeatureConfig";
import { formatDuration } from "@/utils/formatters";
import { RADIUS } from "@/constants/layout";

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
  featureConfig: PlayerFeatureConfig;
  /** Safe-area insets so the overlay clears notches / nav bars in any orientation. */
  insets?: { top: number; bottom: number; left: number; right: number };
  /** App theme accent (from `useAppTheme().colors.primary` in `app/player.tsx`).
      Drives the seekbar fill/thumb, play-button ring, and active states.
      Falls back to the legacy YouTube red so the look is unchanged if unset. */
  accentColor?: string;
};

function VideoPlayerControlsImpl({
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
  featureConfig,
  insets = { top: 0, bottom: 0, left: 0, right: 0 },
  accentColor = YT_RED,
}: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
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
  // Play is the primary action — render it noticeably larger than the skips,
  // with a wider gap so the transport cluster reads as a clean center group.
  const transportPlaySize = isTablet ? 68 : 60;
  const transportSkipSize = utilityButtonSize;
  const transportPlayIconSize = Math.round((isTablet ? 32 : 30) * footerScale);
  const transportSkipIconSize = Math.round(24 * footerScale);
  const transportGap = Math.round((isTablet ? 28 : 22) * footerScale);
  // Every non-play control on the single bottom row shares this secondary size,
  // derived from the play button so the toolbar scales as one unit.
  const ctrlBtnSize = Math.round(transportPlaySize * 0.8);
  const ctrlIconSize = transportSkipIconSize;
  // Side ("other") buttons — lock / playlist on the left, start-over / speed /
  // fit on the right — render smaller than the center transport cluster so the
  // bottom row reads as: small edge controls + a tight prev/⏯/next center group.
  const sideBtnSize = Math.round(ctrlBtnSize * 0.82);
  const sideIconSize = Math.round(ctrlIconSize * 0.82);
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

  // Single source of truth for overlay fade: show only when both `visible`
  // and `controlsVisible` are true. Snappy in (200ms), gentle out (250ms).
  const shouldShow = visible && controlsVisible;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: shouldShow ? 1 : 0,
      duration: shouldShow ? 200 : 250,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [shouldShow, opacity]);

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
    if (!isAudioMode && featureConfig.screenshotEnabled) {
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
    if (featureConfig.nightModeEnabled) {
      items.push({
        key: "night",
        icon: <Feather name="moon" size={19} color={nightMode ? "#FDE68A" : "#fff"} />,
        onPress: () => triggerAction(onToggleNightMode),
        active: nightMode,
      });
    }
    if (!isAudioMode && featureConfig.orientationControlEnabled) {
      items.push({
        key: "orientation",
        icon: <Feather name="rotate-cw" size={19} color="#fff" />,
        onPress: () => triggerAction(onCycleOrientation),
      });
    }
    if (!isAudioMode && featureConfig.aspectRatioSwitcherEnabled && onSetAspectRatio) {
      items.push({
        key: "aspect",
        icon: <Feather name="maximize-2" size={19} color={forcedAspectRatio ? "#FB923C" : "#fff"} />,
        onPress: () => setAspectPickerVisible(v => !v),
        active: !!forcedAspectRatio,
      });
    }
    if (featureConfig.volumeBoostEnabled && onCycleVolumeBoost) {
      items.push({
        key: "boost",
        icon: <Feather name="volume-2" size={19} color={volumeBoost > 1 ? "#FB923C" : "#fff"} />,
        onPress: () => triggerAction(onCycleVolumeBoost!),
        active: volumeBoost > 1,
      });
    }
    if (featureConfig.audioTrackSwitcherEnabled && onCycleAudioTrack) {
      items.push({
        key: "audio",
        icon: <MaterialCommunityIcons name="translate" size={19} color="#fff" />,
        onPress: () => triggerAction(onCycleAudioTrack!),
      });
    }
    if (featureConfig.subtitleSwitcherEnabled && onSubtitlesAction) {
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
    if (!isAudioMode && featureConfig.decoderSwitcherEnabled && onCycleDecoderMode) {
      items.push({
        key: "decoder",
        icon: <MaterialCommunityIcons name="chip" size={19} color={decoderMode === "HW" || decoderMode === "HW+" ? "#FB923C" : "#fff"} />,
        onPress: () => triggerAction(onCycleDecoderMode!),
        active: decoderMode === "HW" || decoderMode === "HW+",
      });
    }
    if (!isAudioMode && featureConfig.trimEnabled && onTrimAction) {
      items.push({
        key: "trim",
        icon: <Feather name="scissors" size={19} color="#fff" />,
        onPress: () => triggerAction(onTrimAction!),
      });
    }
    if (!isAudioMode && featureConfig.pinchZoomEnabled && onZoomAction) {
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
    if (featureConfig.sleepTimerEnabled) {
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
    }
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
    if (!featureConfig.quickActionsEnabled) return [];

    // Apply the user's saved visibility + order. Hidden keys are dropped; the
    // rest are sorted by their index in quickActionOrder (unknown keys keep
    // their natural position at the end, stable).
    const hidden = new Set(featureConfig.hiddenQuickActions ?? []);
    const order = featureConfig.quickActionOrder ?? [];
    const rank = (key: string) => {
      const i = order.indexOf(key);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return items
      .filter((item) => !hidden.has(item.key))
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const ra = rank(a.item.key);
        const rb = rank(b.item.key);
        return ra === rb ? a.index - b.index : ra - rb;
      })
      .map(({ item }) => item);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, isAudioMode, loopMode, isMuted, nightMode, backgroundPlay, forcedAspectRatio, volumeBoost, decoderMode, sleepTimerRemaining, subtitlesStatus, subtitlesProgress, onCycleVolumeBoost, onCycleAudioTrack, onSubtitlesAction, onCycleDecoderMode, onTrimAction, onZoomAction, onSetAspectRatio, onStartOver, onOpenNetworkStream, featureConfig]);

  // Collapsed quick bar shows only a few priority controls — capture
  // (screenshot), background music, and language (audio track) — in that
  // order; the expand chevron reveals the full list. Items still respect
  // feature availability (they only appear if present in mxQuickItems).
  const PRIORITY_QUICK_KEYS = ["screenshot", "background", "audio"];
  const collapsedQuickItems = useMemo(() => {
    const byKey = new Map(mxQuickItems.map((i) => [i.key, i]));
    return PRIORITY_QUICK_KEYS.map((k) => byKey.get(k)).filter(Boolean) as typeof mxQuickItems;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mxQuickItems]);
  const shownQuickItems = quickActionsExpanded ? mxQuickItems : collapsedQuickItems;
  const hasMoreQuickItems = mxQuickItems.length > collapsedQuickItems.length;

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
        style={[styles.topGradient, { height: 180 + insets.top }]}
        pointerEvents="none"
      />

      {/* Bottom gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.36)", "rgba(0,0,0,0.86)"]}
        style={[styles.bottomGradient, { height: 220 + insets.bottom }]}
        pointerEvents="none"
      />

      {/* Top bar — back button + title + quick bar. Hidden while locked. */}
      {!isLocked ? (
      <View
        style={[
          styles.topSection,
          {
            paddingTop: 8 + insets.top,
            paddingLeft: 4 + insets.left,
            paddingRight: 4 + insets.right,
          },
        ]}
      >
        <View style={styles.topBar}>
          <AnimatedIconBtn onPress={onClose} hitSlop={12}>
            <Feather name="chevron-left" size={26} color="#fff" />
          </AnimatedIconBtn>
          <View style={styles.topTextBlock}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
          </View>
        </View>

        {/* MX quick bar — collapsed shows priority controls (capture /
            background music / language) + an expand chevron; expanded shows
            every enabled control. Horizontally scrollable either way. */}
        {!isLocked && (shownQuickItems.length > 0 || hasMoreQuickItems) ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mxQuickBar}
            keyboardShouldPersistTaps="handled"
          >
            {/* Expand/collapse pinned at the FRONT so it stays reachable even
                when the expanded list scrolls past the screen edge. */}
            {hasMoreQuickItems ? (
              <MXCircleBtn
                key="__quick_toggle"
                icon={<Feather name={quickActionsExpanded ? "chevron-left" : "chevron-right"} size={22} color="#fff" />}
                onPress={() => triggerAction(onToggleQuickActions)}
                active={quickActionsExpanded}
              />
            ) : null}
            {shownQuickItems.map((item) => (
              <MXCircleBtn
                key={item.key}
                icon={item.icon}
                onPress={item.onPress}
                active={item.active}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
      ) : null}

      {/* No floating center controls — transport is in the bottom bar */}

      {/* Bottom area — hidden entirely while locked (unlock lives top-left). */}
      {!isLocked ? (
      <GestureDetector gesture={bottomBarGesture}>
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: bottomPadding + insets.bottom,
            paddingLeft: 16 + insets.left,
            paddingRight: 16 + insets.right,
          },
        ]}
      >

        {!isLocked ? (
          <>
            {/* MX-style seekbar: full-width track, time labels beneath. */}
            <View style={styles.progressBarRow}>
              <GestureDetector gesture={progressGesture}>
                <Pressable
                  onPress={handleProgressPress}
                  onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                  style={styles.progressContainer}
                >
                  {/* Seek preview badge — floats above the thumb, clamped so it
                      never runs off either end of the bar. */}
                  {seekProgress !== null && barWidth > 0 ? (
                    <View
                      style={[
                        styles.seekPreviewBadge,
                        { left: Math.max(0, Math.min(barWidth - 56, seekProgress * barWidth - 28)) },
                      ]}
                      pointerEvents="none"
                    >
                      <Text style={styles.seekPreviewText}>
                        {Math.floor((seekPreviewPosition ?? 0) / 60)}:{String(Math.floor((seekPreviewPosition ?? 0) % 60)).padStart(2, '0')}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.progressTrack}>
                    {seekProgress !== null ? (
                      <View style={[styles.progressGhost, { width: `${seekProgress * 100}%` as const }]} pointerEvents="none" />
                    ) : null}
                    <View style={[styles.progressFill, { width: `${progress * 100}%` as const, backgroundColor: accentColor }]} />
                    <View style={[styles.progressThumb, { left: `${progress * 100}%` as const, backgroundColor: accentColor }]} />
                  </View>
                </Pressable>
              </GestureDetector>
            </View>
            {/* Time row beneath the bar: current (left) / total (right). */}
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatDuration(Math.floor(safePosition))}</Text>
              <Text style={styles.timeDur}>{formatDuration(Math.floor(safeDuration))}</Text>
            </View>

          </>
        ) : null}

        {/* Single control row — three fixed zones:
              left   = lock 🔒 + playlist ☰  (fixed flex, edge-anchored)
              center = ⏮  ▶/⏸  ⏭            (flex:1, space-between transport)
              right  = (↻) 1.5× ⛶            (fixed flex, edge-anchored)
            Only `space-between` applies inside the center transport group; the
            side groups keep a tight, fixed position at the row edges.
            Only rendered when unlocked; the locked state shows a single
            top-left unlock button (see the isLocked branch in the overlay). */}
        <View style={styles.controlRow}>
          {/* Left group — lock then playlist (swapped order). */}
          <View style={styles.controlGroupSide}>
            {/* Lock — left-most */}
            {featureConfig.lockControlEnabled ? (
              <Pressable
                onPress={() => triggerAction(onToggleLockMode)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.ctrlBtn,
                  { width: sideBtnSize, height: sideBtnSize, borderRadius: sideBtnSize / 2 },
                  pressed && styles.ctrlBtnPressed,
                ]}
              >
                <Feather name="lock" size={sideIconSize} color="#fff" />
              </Pressable>
            ) : null}

            {/* Playlist / utility rail toggle — right after lock */}
            <Pressable
              onPress={() => triggerAction(onToggleUtilityRail)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.ctrlBtn,
                { width: sideBtnSize, height: sideBtnSize, borderRadius: sideBtnSize / 2 },
                pressed && styles.ctrlBtnPressed,
              ]}
            >
              <Feather name={utilityRailExpanded ? "x" : "list"} size={sideIconSize} color="#fff" />
            </Pressable>
          </View>

          {/* Center transport group — prev/⏯/next sit as a tight centered
              cluster with a fixed gap (not spread full-width). */}
          <View style={[styles.controlGroupCenter, { gap: transportGap }]}>
            {/* Previous */}
            <Pressable
              onPress={onPrev ? () => triggerAction(onPrev) : undefined}
              disabled={!onPrev}
              hitSlop={10}
              style={({ pressed }) => [
                styles.ctrlBtn,
                { width: ctrlBtnSize, height: ctrlBtnSize, borderRadius: ctrlBtnSize / 2 },
                pressed && onPrev ? styles.ctrlBtnPressed : null,
                !onPrev ? styles.transportSkipBtnDisabled : null,
              ]}
            >
              <Ionicons name="play-skip-back" size={ctrlIconSize} color={onPrev ? "#fff" : "rgba(255,255,255,0.30)"} />
            </Pressable>

            {/* Play / pause — largest, accent-filled */}
            <Pressable
              onPress={() => triggerAction(() => onPlayPause("transport"))}
              hitSlop={10}
              style={({ pressed }) => [
                styles.centerPlayBtn,
                {
                  width: transportPlaySize,
                  height: transportPlaySize,
                  borderRadius: transportPlaySize / 2,
                  backgroundColor: accentColor,
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

            {/* Next */}
            <Pressable
              onPress={onNext ? () => triggerAction(onNext) : undefined}
              disabled={!onNext}
              hitSlop={10}
              style={({ pressed }) => [
                styles.ctrlBtn,
                { width: ctrlBtnSize, height: ctrlBtnSize, borderRadius: ctrlBtnSize / 2 },
                pressed && onNext ? styles.ctrlBtnPressed : null,
                !onNext ? styles.transportSkipBtnDisabled : null,
              ]}
            >
              <Ionicons name="play-skip-forward" size={ctrlIconSize} color={onNext ? "#fff" : "rgba(255,255,255,0.30)"} />
            </Pressable>
          </View>

          {/* Right group — start-over, speed, content-fit (fixed flex). */}
          <View style={styles.controlGroupSide}>
            {/* Start over (only near end / when offered) */}
            {showStartOverButton && onStartOver ? (
              <Pressable
                onPress={() => triggerAction(onStartOver)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.ctrlBtn,
                  { width: sideBtnSize, height: sideBtnSize, borderRadius: sideBtnSize / 2 },
                  pressed && styles.ctrlBtnPressed,
                ]}
              >
                <Feather name="refresh-cw" size={sideIconSize - 2} color="#fff" />
              </Pressable>
            ) : null}

            {/* Speed — only when not 1× */}
            {speed !== 1 ? (
              <Pressable
                onPress={() => triggerAction(onSpeedChange)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.ctrlBtn,
                  { width: sideBtnSize, height: sideBtnSize, borderRadius: sideBtnSize / 2 },
                  pressed && styles.ctrlBtnPressed,
                ]}
              >
                <Text style={styles.speedPillText}>{speed}x</Text>
              </Pressable>
            ) : null}

            {/* Content fit — video only */}
            {!isAudioMode ? (
              <Pressable
                onPress={() => triggerAction(onToggleContentFit)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.ctrlBtn,
                  { width: sideBtnSize, height: sideBtnSize, borderRadius: sideBtnSize / 2 },
                  pressed && styles.ctrlBtnPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name={contentFitMode === "cover" ? "crop-free" : contentFitMode === "fill" ? "fit-to-screen-outline" : "fullscreen"}
                  size={sideIconSize}
                  color="#fff"
                />
              </Pressable>
            ) : null}
          </View>
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
                  forcedAspectRatio === ratio && { borderColor: accentColor },
                  pressed && styles.aspectBtnPressed,
                ]}
              >
                <Text style={[styles.aspectBtnText, forcedAspectRatio === ratio && { color: accentColor }]}>
                  {ratio ?? "Auto"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      </GestureDetector>
      ) : null}

      {/* Locked: the ONLY affordance is a single top-left unlock button — all
          other controls and gestures are suppressed. Tapping it unlocks. */}
      {isLocked ? (
        <View style={[styles.lockedUnlockWrap, { top: 8 + insets.top, left: 8 + insets.left }]}>
          <Pressable
            onPress={() => triggerAction(onToggleLockMode)}
            hitSlop={16}
            style={({ pressed }) => [styles.lockedUnlockBtn, pressed && styles.lockedUnlockBtnPressed]}
          >
            <Feather name="unlock" size={22} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      {/* Double-tap zone indicators - visible only when controls are visible */}
      {!isLocked && !isAudioMode && (
        <>
          <View style={styles.doubleTapZoneLeft} pointerEvents="none">
            <LinearGradient
             colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0)"]}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.doubleTapZoneRight} pointerEvents="none">
            <LinearGradient
             colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0)"]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </>
      )}
    </Animated.View>
  );
}

/**
 * Memoized so the control overlay doesn't re-render on unrelated PlayerScreen
 * updates. The `position` prop now changes ~1×/sec (whole-second throttle in
 * player.tsx), so memoization keeps overlay renders cheap.
 */
export const VideoPlayerControls = React.memo(VideoPlayerControlsImpl);

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
  // Quick action bar — horizontal flex row (scrollable) of control circles.
  mxQuickBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  // Accent-filled (backgroundColor applied inline from `accentColor`) with a
  // thin light ring so it reads as the primary action against any theme.
  centerPlayBtn: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  centerPlayBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.90 }],
  },
  playIconOffset: { marginLeft: 5 },

  // Bottom controls — more padding, taller progress zone. Horizontal/bottom
  // padding is applied inline with safe-area insets at the call site.
  bottomBar: {
    gap: 4,
    zIndex: 2,
  },
  // Floats above the progress thumb; positioned absolutely inside the
  // progress container with a clamped `left` so it never runs off the bar.
  seekPreviewBadge: {
    position: "absolute",
    bottom: 26,
    backgroundColor: "rgba(0,0,0,0.88)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    zIndex: 5,
  },
  seekPreviewText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  // MX-style seekbar: full-width track, with time labels in their own row
  // beneath (see timeRow). Gives the bar the full width of the bottom bar.
  progressBarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  // Time labels beneath the bar: current (left) / total (right).
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginTop: -6,
    marginBottom: 4,
  },
  // Single bottom control row — three zones: fixed left group, flex center
  // transport group, fixed right group. Sizes applied inline (ctrlBtnSize /
  // transportPlaySize) so the toolbar scales as one unit off the play button.
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  // Side groups (lock+playlist on the left, start-over/speed/fit on the right)
  // keep a tight fixed position; only the center transport group stretches.
  controlGroupSide: {
    flexDirection: "row",
    alignItems: "center",
  },
  // Center transport cluster — ⏮ ▶/⏸ ⏭ grouped tightly and centered in the
  // available middle width (gap applied inline via transportGap).
  controlGroupCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  // When locked only the lock button is present — center it.
  controlRowLocked: {
    justifyContent: "center",
  },
  // Flat secondary control button (lock / skips / playlist / speed / fit):
  // no resting background, subtle circle on press. Play uses centerPlayBtn.
  ctrlBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  ctrlBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.15)",
    transform: [{ scale: 0.88 }],
  },
  // Locked state — single top-left unlock affordance. Absolute so it sits
  // above the (otherwise empty) overlay; top/left offsets applied inline with
  // safe-area insets at the call site.
  lockedUnlockWrap: {
    position: "absolute",
    zIndex: 6,
  },
  lockedUnlockBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  lockedUnlockBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.20)",
    transform: [{ scale: 0.90 }],
  },
  // Flat MX-style skips — no resting circle, just the icon; a subtle circle
  // appears on press for feedback.
  transportSkipBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "transparent",
  },
  transportSkipBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.15)",
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
    height: 4,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderRadius: RADIUS.pill,
    position: "relative",
    overflow: "visible",
  },
  progressFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    // backgroundColor applied inline from `accentColor`.
    borderRadius: RADIUS.pill,
  },
  progressGhost: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 999,
  },
  // Thumb — accent-filled, centered on the 4px track (top = trackCenter − r).
  progressThumb: {
    position: "absolute",
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    // backgroundColor applied inline from `accentColor`.
    marginLeft: -8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
  },
  // Action row: three flex zones — lock (left) | start-over/playlist (center) |
  // speed/fit (right). No absolute overlay, so nothing collides.
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    minHeight: 48,
    gap: 8,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  queuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
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
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  startOverPillPressed: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ scale: 0.95 }],
  },
  startOverPillText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  timeText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timeSep: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  timeDur: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  speedPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
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
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  aspectBtnActive: {
    // borderColor applied inline from `accentColor`; bg stays a neutral tint.
    backgroundColor: "rgba(255,255,255,0.18)",
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

  // Lock button — bottom-left, comfortable tap size
  lockBottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
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
