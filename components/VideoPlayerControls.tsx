import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import LinearGradient from "react-native-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Text,
  View,
} from "react-native";
import { formatDuration } from "@/utils/formatters";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const LOCK_HOLD_UNLOCK_MS = 1000;
const YT_RED = "#FF3B30";

const PLAYER_UI = { spacing: { sm: 8, md: 12, lg: 16 }, controls: { touch: 48, play: 76, skip: 56 }, timeline: { track: 4, thumb: 14, touch: 44 } };

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
  volume?: number;
  brightness?: number;
  onVolumeChange?: (v: number) => void;
  onBrightnessChange?: (v: number) => void;
  onPlayPause: () => void;
  onSeek: (position: number) => void;
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
  onTrimAction?: () => void;
  onConvertAudioAction?: () => void;
  onScreenshot: () => void;
  trimLabel?: string;
  zoomLabel?: string;
  onZoomAction?: () => void;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  title: string;
  visible: boolean;
  sleepTimerRemaining: number | null;
  onSetSleepTimer: (minutes: number | null) => void;
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
  audioTrackLabel,
  volume = 1,
  brightness = 0.5,
  onVolumeChange,
  onBrightnessChange,
  onPlayPause,
  onSeek,
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
  onTrimAction,
  onConvertAudioAction,
  onScreenshot,
  trimLabel,
  zoomLabel,
  onZoomAction,
  onClose,
  onNext,
  onPrev,
  title,
  visible,
  sleepTimerRemaining,
  onSetSleepTimer,
}: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const moreMenuAnim = useRef(new Animated.Value(0)).current;
  const progressGestureStartX = useRef(0);
  const [barWidth, setBarWidth] = useState(0);
  const [unlockHoldProgress, setUnlockHoldProgress] = useState(0);
  const [aspectPickerVisible, setAspectPickerVisible] = useState(false);
  const isAudioMode = mediaType === "audio";
  const unlockHoldTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockHoldInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockHoldStartedAt = useRef<number | null>(null);
  const nativePointerEvents =
    Platform.OS === "web"
      ? {}
      : { pointerEvents: visible ? ("box-none" as const) : ("none" as const) };

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

  const clearUnlockHold = useCallback((resetProgress = true) => {
    if (unlockHoldTimeout.current) { clearTimeout(unlockHoldTimeout.current); unlockHoldTimeout.current = null; }
    if (unlockHoldInterval.current) { clearInterval(unlockHoldInterval.current); unlockHoldInterval.current = null; }
    unlockHoldStartedAt.current = null;
    if (resetProgress) setUnlockHoldProgress(0);
  }, []);

  useEffect(() => { if (!isLocked) clearUnlockHold(); }, [clearUnlockHold, isLocked]);
  useEffect(() => () => { clearUnlockHold(); }, [clearUnlockHold]);

  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safePosition = Number.isFinite(position) && position >= 0 ? position : 0;
  const reportedProgress = safeDuration > 0 ? Math.min(safePosition / safeDuration, 1) : 0;
  const progress = dragProgress !== null ? dragProgress : reportedProgress;

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

  const progressGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isLocked)
        .runOnJS(true)
        .minDistance(2)
        .onBegin((event) => {
          isDraggingRef.current = true;
          onScrubbingChange?.(true);
          const locationX = Number(event.x);
          progressGestureStartX.current = Number.isFinite(locationX) ? locationX : 0;
          seekFromLocationX(progressGestureStartX.current);
        })
        .onUpdate((event) => {
          seekFromLocationX(progressGestureStartX.current + event.translationX);
        })
        .onFinalize(() => {
          isDraggingRef.current = false;
          onScrubbingChange?.(false);
          setDragProgress(null);
        }),
    [isLocked, onScrubbingChange, seekFromLocationX]
  );

  const loopIcon = loopMode === "none" ? "repeat-off" : loopMode === "one" ? "repeat-once" : "repeat";
  const orientationLabel = orientationMode === "landscape" ? "Landscape" : orientationMode === "portrait" ? "Portrait" : "Auto";
  const moreMenuOpacity = moreMenuAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1] });
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;
  const isCompact = Math.min(screenWidth, screenHeight) < 360;
  const bottomBarGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isLocked)
        .runOnJS(true)
        .activeOffsetY([-18, 18])
        .failOffsetX([-24, 24])
        .onEnd((event) => {
          if (Math.abs(event.translationY) >= 18) {
            if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactLight");
            onToggleUtilityRail();
          }
        }),
    [isLocked, onToggleUtilityRail]
  );

  const triggerAction = (action?: () => void) => {
    if (!action) return;
    if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactLight");
    action();
  };

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
    if (!isAudioMode && onConvertAudioAction) {
      items.push({
        key: "convert-audio",
        icon: <Feather name="music" size={19} color="#fff" />,
        onPress: () => triggerAction(onConvertAudioAction!),
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
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, isAudioMode, loopMode, isMuted, nightMode, backgroundPlay, forcedAspectRatio, volumeBoost, decoderMode, sleepTimerRemaining, onCycleVolumeBoost, onCycleAudioTrack, onCycleDecoderMode, onTrimAction, onZoomAction, onSetAspectRatio]);

  const MX_DEFAULT_COUNT = 3;
  const quickOverflowItems = useMemo(
    () => mxQuickItems.slice(MX_DEFAULT_COUNT),
    [mxQuickItems]
  );

  const handleUnlockHoldStart = useCallback(() => {
    if (!isLocked) return;
    clearUnlockHold(false);
    unlockHoldStartedAt.current = Date.now();
    setUnlockHoldProgress(0.02);
    unlockHoldInterval.current = setInterval(() => {
      const startedAt = unlockHoldStartedAt.current;
      if (!startedAt) return;
      setUnlockHoldProgress(Math.min((Date.now() - startedAt) / LOCK_HOLD_UNLOCK_MS, 1));
    }, 100);
    unlockHoldTimeout.current = setTimeout(() => {
      clearUnlockHold(false);
      setUnlockHoldProgress(1);
      if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactMedium");
      onToggleLockMode();
    }, LOCK_HOLD_UNLOCK_MS);
  }, [clearUnlockHold, isLocked, onToggleLockMode]);

  const handleUnlockHoldEnd = useCallback(() => {
    if (!isLocked) return;
    clearUnlockHold();
  }, [clearUnlockHold, isLocked]);

  const seekProgress = seekPreviewPosition != null && safeDuration > 0
    ? Math.min(Math.max(seekPreviewPosition / safeDuration, 0), 1)
    : null;

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[styles.overlay, { opacity }, Platform.OS === "web" ? { pointerEvents: visible ? "box-none" : "none" } : null]}
      {...nativePointerEvents}
    >
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
      <View style={[styles.topSection, isLandscape && styles.topSectionLandscape]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            hitSlop={12}
          >
            <Feather name="chevron-left" size={26} color="#fff" />
          </Pressable>
          <View style={styles.topTextBlock}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
          </View>
          {!isLocked ? (
            <Pressable
              onPress={() => triggerAction(onToggleQuickActions)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              hitSlop={8}
            >
              <Feather name="more-vertical" size={22} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        {/* Controls stay anchored to the top bar. The three-dot button is the
            single utility entry point; advanced actions open from it instead
            of creating a second control row below the title. */}
      </View>

      {/* Advanced actions bottom sheet */}
      {!isLocked && quickActionsExpanded && quickOverflowItems.length > 0 ? (
        <Animated.View style={[styles.actionSheetLayer, { opacity: moreMenuOpacity }]}>
          <Pressable
            style={styles.actionSheetBackdrop}
            onPress={onToggleQuickActions}
            accessibilityRole="button"
            accessibilityLabel="Close advanced player controls"
          />
          <View style={[styles.actionSheet, isLandscape && styles.actionSheetLandscape]}>
            <View style={styles.actionSheetHandle} />
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>Player controls</Text>
              <Pressable onPress={onToggleQuickActions} style={styles.actionSheetClose} accessibilityRole="button" accessibilityLabel="Close player controls">
                <Feather name="x" size={20} color="#fff" />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionSheetActions}>
              {quickOverflowItems.map((item) => (
                <View key={`sheet-${item.key}`} style={styles.actionSheetItem}>
                  <MXCircleBtn icon={item.icon} onPress={item.onPress} active={item.active} />
                </View>
              ))}
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}

      {/* Center transport controls — only when unlocked */}
      {!isLocked ? (
        <View style={[styles.centerControls, isLandscape && styles.centerControlsLandscape, isCompact && styles.centerControlsCompact]} pointerEvents="box-none">
          <Pressable
            accessibilityLabel="Previous video"
            onPress={onPrev ? () => triggerAction(onPrev) : undefined}
            disabled={!onPrev}
            style={({ pressed }) => [
              styles.centerSkipBtn,
              pressed && onPrev ? styles.centerSkipBtnPressed : null,
              !onPrev ? styles.centerSkipBtnDisabled : null,
            ]}
          >
            <Ionicons name="play-skip-back" size={25} color={onPrev ? "#fff" : "rgba(255,255,255,0.28)"} />
          </Pressable>

          <Pressable
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
            onPress={() => triggerAction(onPlayPause)}
            style={({ pressed }) => [styles.centerPlayBtn, pressed && styles.centerPlayBtnPressed]}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={42}
              color="#fff"
              style={isPlaying ? undefined : styles.playIconOffset}
            />
          </Pressable>

          <Pressable
            accessibilityLabel="Next video"
            onPress={onNext ? () => triggerAction(onNext) : undefined}
            disabled={!onNext}
            style={({ pressed }) => [
              styles.centerSkipBtn,
              pressed && onNext ? styles.centerSkipBtnPressed : null,
              !onNext ? styles.centerSkipBtnDisabled : null,
            ]}
          >
            <Ionicons name="play-skip-forward" size={25} color={onNext ? "#fff" : "rgba(255,255,255,0.28)"} />
          </Pressable>

        </View>
      ) : null}

      {/* Bottom area — always rendered so lock button is always reachable */}
      <GestureDetector gesture={bottomBarGesture}>
        <View style={[styles.bottomBar, isLandscape && styles.bottomBarLandscape]}>

        {/* Seek preview badge */}
        {!isLocked && seekProgress !== null ? (
          <View
            style={[styles.seekPreviewBadge, { left: `${seekProgress * 100}%` as any }]}
            pointerEvents="none"
          >
            <Text style={styles.seekPreviewText}>
              {Math.floor((seekPreviewPosition ?? 0) / 60)}:{String(Math.floor((seekPreviewPosition ?? 0) % 60)).padStart(2, '0')}
            </Text>
          </View>
        ) : null}

        {/* Progress bar — hidden when locked */}
        {!isLocked ? (
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
            </View>
      </GestureDetector>

        ) : null}

        {/* Bottom row — lock icon left, controls right */}
        <View style={styles.bottomRow}>

          {/* Lock / hold-to-unlock button — always at bottom left */}
          {isLocked ? (
            <Pressable
              onPressIn={handleUnlockHoldStart}
              onPressOut={handleUnlockHoldEnd}
              onPress={() => undefined}
              style={({ pressed }) => [styles.lockBottomBtn, pressed && styles.lockBottomBtnPressed]}
            >
              <Feather name="unlock" size={18} color="#fff" />
              <Text style={styles.lockBottomLabel}>
                {unlockHoldProgress > 0 ? `${Math.round(unlockHoldProgress * 100)}%` : "Hold"}
              </Text>
              {unlockHoldProgress > 0 ? (
                <View style={styles.lockHoldTrackInline}>
                  <View style={[styles.lockHoldFillInline, { width: `${unlockHoldProgress * 100}%` as const }]} />
                </View>
              ) : null}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => triggerAction(onToggleLockMode)}
              style={({ pressed }) => [styles.lockBottomBtn, pressed && styles.lockBottomBtnPressed]}
              hitSlop={8}
            >
              <Feather name="lock" size={18} color="#fff" />
            </Pressable>
          )}

          {/* Rest of bottom row — hidden when locked */}
          {!isLocked ? (
            <>
              <Pressable
                onPress={() => triggerAction(onToggleUtilityRail)}
                style={({ pressed }) => [styles.queuePill, pressed && styles.speedPillPressed]}
              >
                <MaterialCommunityIcons
                  name={utilityRailExpanded ? "chevron-down" : "chevron-up"}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.queuePillText}>
                  {utilityRailExpanded ? "Collapse" : "Expand"}
                </Text>
              </Pressable>
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.mxCircleBtn,
        active ? styles.mxCircleBtnActive : null,
        pressed ? styles.mxCircleBtnPressed : null,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 0,
    pointerEvents: "none",
  } as any,
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
    pointerEvents: "none",
  } as any,

  // Top bar — single row like YouTube/MX Player
  topSection: {
    paddingHorizontal: PLAYER_UI.spacing.lg,
    paddingTop: PLAYER_UI.spacing.md,
    gap: PLAYER_UI.spacing.sm,
    zIndex: 2,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: PLAYER_UI.controls.touch,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 6,
    paddingRight: 6,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  lockBannerText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  iconBtn: {
    width: PLAYER_UI.controls.touch,
    height: PLAYER_UI.controls.touch,
    borderRadius: PLAYER_UI.controls.touch / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.14)",
    transform: [{ scale: 0.92 }],
  },
  // MX Player-style circular quick bar — flush below title bar, no top gap
  mxQuickBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: PLAYER_UI.spacing.sm,
    paddingVertical: 2,
    paddingRight: PLAYER_UI.spacing.sm,
    zIndex: 3,
  },
  topSectionLandscape: {
    paddingTop: 8,
    gap: 4,
  },
  centerControlsLandscape: {
    gap: 18,
  },
  centerControlsCompact: {
    gap: 8,
    transform: [{ scale: 0.9 }],
  },
  bottomBarLandscape: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  actionSheetLandscape: {
    marginHorizontal: 24,
    maxWidth: 720,
    alignSelf: "center",
    width: "92%",
  },
  actionSheetLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: "flex-end",
  },
  actionSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  actionSheet: {
    marginHorizontal: PLAYER_UI.spacing.md,
    marginBottom: PLAYER_UI.spacing.md,
    paddingHorizontal: PLAYER_UI.spacing.lg,
    paddingTop: PLAYER_UI.spacing.sm,
    paddingBottom: PLAYER_UI.spacing.lg,
    borderRadius: 24,
    backgroundColor: "rgba(18,18,20,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  actionSheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.36)",
    marginBottom: PLAYER_UI.spacing.md,
  },
  actionSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: PLAYER_UI.spacing.md,
  },
  actionSheetTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  actionSheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actionSheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: PLAYER_UI.spacing.md,
    paddingRight: PLAYER_UI.spacing.md,
  },
  actionSheetItem: {
    alignItems: "center",
  },
  mxCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  mxCircleBtnActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.40)",
  },
  mxCircleBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.20)",
    transform: [{ scale: 0.88 }],
  },
  mxSpeedText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  // Center transport
  centerControls: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  centerSkipBtn: {
    width: PLAYER_UI.controls.skip,
    height: PLAYER_UI.controls.skip,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
  },
  centerSkipBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.1)",
    transform: [{ scale: 0.88 }],
  },
  centerSkipBtnDisabled: {
    opacity: 0.5,
  },
  centerPlayBtn: {
    width: PLAYER_UI.controls.play,
    height: PLAYER_UI.controls.play,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: PLAYER_UI.controls.play / 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  centerPlayBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.26)",
    transform: [{ scale: 0.92 }],
  },
  playIconOffset: { marginLeft: 4 },

  // Lock hold
  lockHoldBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  lockHoldTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  lockHoldSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  lockHoldTrack: {
    width: "100%",
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    marginTop: 2,
  },
  lockHoldFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: YT_RED,
  },

  // Bottom controls
  bottomBar: {
    paddingHorizontal: PLAYER_UI.spacing.lg,
    paddingBottom: PLAYER_UI.spacing.lg,
    position: "relative",
    gap: 0,
    zIndex: 2,
  },
  seekPreviewBadge: {
    position: "absolute",
    bottom: 62,
    transform: [{ translateX: -24 }],
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.82)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  seekPreviewText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  progressContainer: {
    minHeight: PLAYER_UI.timeline.touch,
    paddingVertical: 20,
    justifyContent: "center",
  },
  progressTrack: {
    height: PLAYER_UI.timeline.track,
    backgroundColor: "rgba(255,255,255,0.28)",
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
    backgroundColor: "rgba(255,255,255,0.42)",
    borderRadius: 999,
  },
  progressThumb: {
    position: "absolute",
    top: -5,
    width: PLAYER_UI.timeline.thumb,
    height: PLAYER_UI.timeline.thumb,
    borderRadius: PLAYER_UI.timeline.thumb / 2,
    backgroundColor: "#fff",
    marginLeft: -7,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 0,
    minHeight: PLAYER_UI.controls.touch,
  },
  queuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  queuePillText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  timeText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  timeSep: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  timeDur: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  bottomSpacer: { flex: 1 },
  speedPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginRight: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  speedPillPressed: {
    backgroundColor: "rgba(255,255,255,0.22)",
    transform: [{ scale: 0.94 }],
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  aspectBtnActive: {
    backgroundColor: "rgba(255,59,48,0.22)",
    borderColor: YT_RED,
  },
  aspectBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  aspectBtnText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  aspectBtnTextActive: { color: "#FF6B6B" },

  // Lock button at bottom left
  lockBottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    marginRight: 8,
  },
  lockBottomBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.15)",
    transform: [{ scale: 0.92 }],
  },
  lockBottomLabel: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  lockHoldTrackInline: {
    width: 52,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  lockHoldFillInline: {
    height: "100%" as any,
    borderRadius: 999,
    backgroundColor: YT_RED,
  },

});

