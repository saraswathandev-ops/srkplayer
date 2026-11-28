import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import LinearGradient from "react-native-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Text,
  View,
} from "react-native";
import ReAnimated, { Easing, useAnimatedStyle, useSharedValue, withTiming, cancelAnimation } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDuration } from "@/utils/formatters";
import { PlayerControlSheet, type PlayerControlAction } from "@/components/player/PlayerControlSheet";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const LOCK_HOLD_UNLOCK_MS = 1000;
const TIMELINE_SEEK_STEP_SECONDS = 10;
const YT_RED = "#FF3B30";

const PLAYER_UI = { spacing: { sm: 8, md: 12, lg: 16 }, controls: { touch: 48, utility: 44, play: 56, skip: 44 }, timeline: { track: 4, thumb: 14, touch: 44 } };
const TRANSPORT_GAP = 2;
const UTILITY_GAP = 4;
const TRANSPORT_WIDTH = PLAYER_UI.controls.play + 2 * (PLAYER_UI.controls.skip + TRANSPORT_GAP);

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
  onOpenSubtitles?: () => void;
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
  onOpenSubtitles,
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
  const opacity = useSharedValue(visible ? 1 : 0);
  const overlayAnimation = useAnimatedStyle(() => ({ opacity: opacity.value }));
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
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 160 : 200,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(opacity);
  }, [visible, opacity]);

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
  const previewPosition = dragProgress !== null
    ? dragProgress * safeDuration
    : seekPreviewPosition;
  const previewProgress = previewPosition != null && Number.isFinite(previewPosition) && safeDuration > 0
    ? Math.min(Math.max(previewPosition / safeDuration, 0), 1)
    : null;
  const progress = previewProgress ?? reportedProgress;
  const timelineEnabled = visible && !isLocked && safeDuration > 0 && barWidth > 0;

  const progressAtX = useCallback((x: number) => {
    if (barWidth <= 0 || !Number.isFinite(x)) return null;
    return Math.max(0, Math.min(1, x / barWidth));
  }, [barWidth]);

  const finishScrubbing = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    onScrubbingChange?.(false);
    setDragProgress(null);
  }, [onScrubbingChange]);

  useEffect(() => {
    if (!timelineEnabled) finishScrubbing();
  }, [finishScrubbing, timelineEnabled]);

  useEffect(() => () => {
    if (isDraggingRef.current) onScrubbingChange?.(false);
  }, [onScrubbingChange]);

  const progressGesture = useMemo(() => {
    const commitSeek = (x: number) => {
      const ratio = progressAtX(x);
      if (ratio !== null) onSeek(ratio * safeDuration);
    };
    const pan = Gesture.Pan()
      .enabled(timelineEnabled)
      .maxPointers(1)
      .activeOffsetX([-5, 5])
      .failOffsetY([-10, 10])
      .runOnJS(true)
      .onStart(({ x }) => {
        isDraggingRef.current = true;
        onScrubbingChange?.(true);
        setDragProgress(progressAtX(x));
      })
      .onUpdate(({ x }) => {
        if (isDraggingRef.current) setDragProgress(progressAtX(x));
      })
      .onEnd(({ x }, success) => {
        if (success && isDraggingRef.current) commitSeek(x);
      })
      .onFinalize(finishScrubbing);
    const tap = Gesture.Tap()
      .enabled(timelineEnabled)
      .maxDistance(5)
      .runOnJS(true)
      .onEnd(({ x }, success) => {
        if (success) commitSeek(x);
      });
    return Gesture.Exclusive(pan, tap);
  }, [finishScrubbing, onScrubbingChange, onSeek, progressAtX, safeDuration, timelineEnabled]);

  const loopIcon = loopMode === "none" ? "repeat-off" : loopMode === "one" ? "repeat-once" : "repeat";
  const loopLabel = loopMode === "none" ? "Off" : loopMode === "one" ? "Repeat one" : "Repeat all";
  const orientationLabel = orientationMode === "landscape" ? "Landscape" : orientationMode === "portrait" ? "Portrait" : "Auto";
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeWidth = screenWidth - insets.left - insets.right;
  const safeHeight = screenHeight - insets.top - insets.bottom;
  const isShortLandscape = screenWidth > screenHeight && safeHeight < 400;
  const horizontalPadding = safeWidth < 400 ? PLAYER_UI.spacing.sm : PLAYER_UI.spacing.lg;
  // Reserve room for the widest speed label so changing speed won't move the buttons.
  const sideWidth = Math.max(
    2 * PLAYER_UI.controls.utility,
    PLAYER_UI.controls.touch + Math.max(PLAYER_UI.controls.utility, Math.ceil(42 * fontScale) + 8),
  ) + UTILITY_GAP;
  const stackBottomControls = !isLocked && safeWidth - 2 * horizontalPadding < TRANSPORT_WIDTH + 2 * sideWidth;

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

  const triggerAction = useCallback((action?: () => void) => {
    if (!action) return;
    if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactLight");
    action();
  }, []);

  const settingsActions = useMemo(() => {
    const sections = {
      Playback: [] as PlayerControlAction[],
      "Audio & subtitles": [] as PlayerControlAction[],
      Display: [] as PlayerControlAction[],
      Tools: [] as PlayerControlAction[],
    };
    const add = (section: keyof typeof sections, action: PlayerControlAction) => {
      sections[section].push({ ...action, section });
    };
    add("Playback", {
      key: "speed",
      title: "Playback speed",
      value: `${speed}×`,
      icon: <MaterialCommunityIcons name="speedometer" size={19} color="#fff" />,
      onPress: () => triggerAction(onSpeedChange),
    });
    if (!isAudioMode) {
      add("Tools", {
        key: "screenshot",
        title: "Take screenshot",
        icon: <Feather name="camera" size={19} color="#fff" />,
        onPress: () => {
          onToggleQuickActions();
          triggerAction(onScreenshot);
        },
      });
    }
    add("Playback", {
      key: "loop",
      title: "Repeat",
      value: loopLabel,
      icon: <MaterialCommunityIcons name={loopIcon} size={19} color={loopMode !== "none" ? "#4ADE80" : "#fff"} />,
      onPress: () => triggerAction(onToggleLoop),
      active: loopMode !== "none",
    });
    add("Audio & subtitles", {
      key: "mute",
      title: "Mute",
      value: isMuted ? "On" : "Off",
      icon: <Feather name={isMuted ? "volume-x" : "volume-2"} size={19} color={isMuted ? "#FCA5A5" : "#fff"} />,
      onPress: () => triggerAction(onToggleMute),
      active: isMuted,
    });
    add("Display", {
      key: "night",
      title: "Night mode",
      value: nightMode ? "On" : "Off",
      icon: <Feather name="moon" size={19} color={nightMode ? "#FDE68A" : "#fff"} />,
      onPress: () => triggerAction(onToggleNightMode),
      active: nightMode,
    });
    if (!isAudioMode) {
      add("Display", {
        key: "orientation",
        title: "Orientation",
        value: orientationLabel,
        icon: <Feather name="rotate-cw" size={19} color="#fff" />,
        onPress: () => triggerAction(onCycleOrientation),
      });
    }
    if (!isAudioMode && onSetAspectRatio) {
      add("Display", {
        key: "aspect",
        title: "Aspect ratio",
        value: forcedAspectRatio ?? "Auto",
        icon: <Feather name="maximize-2" size={19} color={forcedAspectRatio ? "#FB923C" : "#fff"} />,
        onPress: () => {
          onToggleQuickActions();
          setAspectPickerVisible(true);
        },
        active: !!forcedAspectRatio,
      });
    }
    if (onCycleVolumeBoost) {
      add("Audio & subtitles", {
        key: "boost",
        title: "Volume boost",
        value: `${Math.round(volumeBoost * 100)}%`,
        icon: <Feather name="volume-2" size={19} color={volumeBoost > 1 ? "#FB923C" : "#fff"} />,
        onPress: () => triggerAction(onCycleVolumeBoost!),
        active: volumeBoost > 1,
      });
    }
    if (onCycleAudioTrack) {
      add("Audio & subtitles", {
        key: "audio",
        title: "Audio track",
        value: audioTrackLabel,
        icon: <MaterialCommunityIcons name="translate" size={19} color="#fff" />,
        onPress: () => triggerAction(onCycleAudioTrack!),
      });
    }
    if (!isAudioMode && onOpenSubtitles) {
      add("Audio & subtitles", {
        key: "subtitles",
        title: "Subtitles",
        icon: <MaterialCommunityIcons name="subtitles-outline" size={19} color="#fff" />,
        onPress: () => triggerAction(onOpenSubtitles),
      });
    }
    if (!isAudioMode && onCycleDecoderMode) {
      add("Playback", {
        key: "decoder",
        title: "Decoder",
        value: decoderMode,
        icon: <MaterialCommunityIcons name="chip" size={19} color={decoderMode === "HW" || decoderMode === "HW+" ? "#FB923C" : "#fff"} />,
        onPress: () => triggerAction(onCycleDecoderMode!),
        active: decoderMode === "HW" || decoderMode === "HW+",
      });
    }
    if (!isAudioMode && onTrimAction) {
      add("Tools", {
        key: "trim",
        title: trimLabel ?? "Trim video",
        icon: <Feather name="scissors" size={19} color="#fff" />,
        onPress: () => triggerAction(onTrimAction!),
      });
    }
    if (!isAudioMode && onConvertAudioAction) {
      add("Tools", {
        key: "convert-audio",
        title: "Convert to audio",
        icon: <Feather name="music" size={19} color="#fff" />,
        onPress: () => triggerAction(onConvertAudioAction!),
      });
    }
    if (!isAudioMode && onZoomAction) {
      add("Display", {
        key: "zoom",
        title: "Zoom",
        value: zoomLabel,
        icon: <Feather name="zoom-in" size={19} color="#fff" />,
        onPress: () => triggerAction(onZoomAction!),
      });
    }
    add("Playback", {
      key: "background",
      title: "Background playback",
      value: backgroundPlay ? "On" : "Off",
      icon: <Ionicons name={backgroundPlay ? "musical-notes" : "musical-notes-outline"} size={19} color={backgroundPlay ? "#60A5FA" : "#fff"} />,
      onPress: () => triggerAction(onToggleBackgroundPlay),
      active: backgroundPlay,
    });
    add("Tools", {
      key: "info",
      title: "Media information",
      icon: <Feather name="info" size={19} color="#fff" />,
      onPress: () => triggerAction(onToggleProperties),
    });
    add("Playback", {
      key: "timer",
      title: "Sleep timer",
      value: sleepTimerRemaining === null ? "Off" : formatDuration(sleepTimerRemaining),
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
    return Object.values(sections).flat();
  }, [
    audioTrackLabel, backgroundPlay, decoderMode, forcedAspectRatio, isAudioMode, isMuted, loopIcon,
    loopLabel, loopMode, nightMode, orientationLabel, sleepTimerRemaining, speed, trimLabel, volumeBoost,
    zoomLabel, onConvertAudioAction, onCycleAudioTrack, onCycleDecoderMode, onCycleOrientation,
    onCycleVolumeBoost, onOpenSubtitles, onScreenshot, onSetAspectRatio, onSetSleepTimer,
    onSpeedChange, onToggleBackgroundPlay, onToggleLoop, onToggleMute, onToggleNightMode,
    onToggleProperties, onToggleQuickActions, onTrimAction, onZoomAction, triggerAction,
  ]);

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

  return (
    <ReAnimated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.overlay,
        { paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left },
        overlayAnimation,
        Platform.OS === "web" ? { pointerEvents: visible ? "box-none" : "none" } : null,
      ]}
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
      <View style={[styles.topSection, { paddingHorizontal: horizontalPadding }, isShortLandscape && styles.topSectionShort]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close player"
            onPress={onClose}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            hitSlop={12}
          >
            <Feather name="chevron-left" size={26} color="#fff" />
          </Pressable>
          <View style={styles.topTextBlock}>
            <Text style={styles.title} numberOfLines={isShortLandscape ? 1 : 2}>{title}</Text>
          </View>
          {!isLocked ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open player controls"
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

      <PlayerControlSheet
        visible={!isLocked && quickActionsExpanded}
        title="Player settings"
        actions={settingsActions}
        onClose={onToggleQuickActions}
      />

      {/* Bottom area — always rendered so lock button is always reachable */}
      <GestureDetector gesture={bottomBarGesture}>
        <View style={[styles.bottomBar, { paddingHorizontal: horizontalPadding }, isShortLandscape && styles.bottomBarShort]}>

        {/* Progress bar — hidden when locked */}
        {!isLocked ? (
          <GestureDetector gesture={progressGesture}>
            <View
              collapsable={false}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Playback position"
              accessibilityState={{ disabled: !timelineEnabled }}
              accessibilityValue={{ text: `${formatDuration(progress * safeDuration)} of ${formatDuration(safeDuration)}` }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={({ nativeEvent: { actionName } }) => {
                if (!timelineEnabled || (actionName !== "increment" && actionName !== "decrement")) return;
                const delta = actionName === "increment" ? TIMELINE_SEEK_STEP_SECONDS : -TIMELINE_SEEK_STEP_SECONDS;
                onSeek(Math.min(safeDuration, Math.max(0, safePosition + delta)));
              }}
              onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              style={styles.progressContainer}
            >
              {previewProgress !== null ? (
                <View style={styles.seekPreviewBadge} pointerEvents="none" accessible={false}>
                  <Text style={styles.seekPreviewText}>{formatDuration(previewProgress * safeDuration)}</Text>
                </View>
              ) : null}
              <View style={styles.progressTrack} pointerEvents="none">
                <View style={[styles.progressFill, { width: `${progress * 100}%` as const }]} />
                <View style={[styles.progressThumb, { left: `${progress * 100}%` as const }]} />
              </View>
            </View>
          </GestureDetector>
        ) : null}

        {/* Bottom row — lock icon left, controls right */}
        <View style={[styles.bottomRow, stackBottomControls && styles.bottomRowStacked]}>
          <View style={[styles.sideControls, stackBottomControls && styles.sideControlsStacked]}>

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
              accessibilityRole="button"
              accessibilityLabel="Lock player"
              onPress={() => triggerAction(onToggleLockMode)}
              style={({ pressed }) => [styles.lockBottomBtn, styles.utilityIconButton, pressed && styles.lockBottomBtnPressed]}
            >
              <Feather name="lock" size={18} color="#fff" />
            </Pressable>
          )}

          {/* Rest of bottom row — hidden when locked */}
          {!isLocked ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle queue"
                onPress={() => triggerAction(onToggleUtilityRail)}
                style={({ pressed }) => [styles.queuePill, pressed && styles.speedPillPressed]}
              >
                <MaterialCommunityIcons
                  name={utilityRailExpanded ? "chevron-down" : "chevron-up"}
                  size={16}
                  color="#fff"
                />
              </Pressable>
            </>
          ) : null}
          </View>
      {/* Center transport controls — only when unlocked */}
      {!isLocked ? (
        <View style={[styles.bottomTransport, stackBottomControls && styles.bottomTransportStacked]} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
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
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
            onPress={() => triggerAction(onPlayPause)}
            style={({ pressed }) => [styles.centerPlayBtn, pressed && styles.centerPlayBtnPressed]}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={32}
              color="#fff"
              style={isPlaying ? undefined : styles.playIconOffset}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
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


          <View style={[styles.sideControls, styles.rightControls, stackBottomControls && styles.sideControlsStacked]}>
          {!isLocked ? (
            <>
              {speed !== 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Playback speed, ${speed} times`}
                  onPress={() => triggerAction(onSpeedChange)}
                  style={({ pressed }) => [styles.speedPill, pressed && styles.speedPillPressed]}
                >
                  <Text style={styles.speedPillText}>{speed}x</Text>
                </Pressable>
              ) : null}
              {!isAudioMode ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change screen fit"
                  onPress={() => triggerAction(onToggleContentFit)}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
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

    </ReAnimated.View>
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
  topSectionShort: {
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
  bottomBarShort: {
    paddingBottom: PLAYER_UI.spacing.sm,
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
    paddingBottom: PLAYER_UI.spacing.lg,
    position: "relative",
    gap: 0,
    zIndex: 2,
  },
  seekPreviewBadge: {
    position: "absolute",
    bottom: "100%",
    alignSelf: "center",
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
  bottomTransport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: TRANSPORT_GAP },
  bottomTransportStacked: { position: "absolute", bottom: 0, left: 0, right: 0 },
  sideControls: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: UTILITY_GAP, minWidth: 0 },
  rightControls: { justifyContent: "flex-end" },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 0,
    minHeight: PLAYER_UI.controls.touch,
  },
  bottomRowStacked: {
    justifyContent: "space-between",
    paddingBottom: PLAYER_UI.controls.play + UTILITY_GAP,
  },
  sideControlsStacked: {
    flex: 0,
  },
  utilityIconButton: {
    width: PLAYER_UI.controls.utility,
    height: PLAYER_UI.controls.utility,
    justifyContent: "center",
    paddingHorizontal: 0,
    marginRight: 0,
  },
  queuePill: {
    width: PLAYER_UI.controls.utility,
    height: PLAYER_UI.controls.utility,
    alignItems: "center",
    justifyContent: "center",
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
    minWidth: PLAYER_UI.controls.utility,
    minHeight: PLAYER_UI.controls.utility,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
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

