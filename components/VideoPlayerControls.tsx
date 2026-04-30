import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import LinearGradient from "react-native-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatDuration } from "@/utils/formatters";

const LOCK_HOLD_UNLOCK_MS = 1000;
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

  const progressPanResponder = useMemo(
    () =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 2,
      onPanResponderGrant: (event) => {
        isDraggingRef.current = true;
        onScrubbingChange?.(true);
        const locationX = typeof event.nativeEvent.locationX === "number" ? event.nativeEvent.locationX : NaN;
        progressGestureStartX.current = Number.isFinite(locationX) ? locationX : 0;
        seekFromLocationX(locationX);
      },
      onPanResponderMove: (_, gestureState) => {
        seekFromLocationX(progressGestureStartX.current + gestureState.dx);
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        onScrubbingChange?.(false);
        setDragProgress(null);
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        onScrubbingChange?.(false);
        setDragProgress(null);
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [onScrubbingChange, seekFromLocationX]
  );

  const loopIcon = loopMode === "none" ? "repeat-off" : loopMode === "one" ? "repeat-once" : "repeat";
  const orientationLabel = orientationMode === "landscape" ? "Landscape" : orientationMode === "portrait" ? "Portrait" : "Auto";
  const moreMenuOpacity = moreMenuAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1] });
  const bottomBarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isLocked &&
          Math.abs(gestureState.dy) > 18 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy <= -18 || gestureState.dy >= 18) {
            triggerAction(onToggleUtilityRail);
          }
        },
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

      {/* Center transport controls — only when unlocked */}
      {!isLocked ? (
        <View style={styles.centerControls} pointerEvents="box-none">
          <Pressable
            onPress={onPrev ? () => triggerAction(onPrev) : undefined}
            disabled={!onPrev}
            style={({ pressed }) => [
              styles.centerSkipBtn,
              pressed && onPrev ? styles.centerSkipBtnPressed : null,
              !onPrev ? styles.centerSkipBtnDisabled : null,
            ]}
          >
            <Ionicons name="play-skip-back" size={26} color={onPrev ? "#fff" : "rgba(255,255,255,0.28)"} />
          </Pressable>

          <Pressable
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
            onPress={onNext ? () => triggerAction(onNext) : undefined}
            disabled={!onNext}
            style={({ pressed }) => [
              styles.centerSkipBtn,
              pressed && onNext ? styles.centerSkipBtnPressed : null,
              !onNext ? styles.centerSkipBtnDisabled : null,
            ]}
          >
            <Ionicons name="play-skip-forward" size={26} color={onNext ? "#fff" : "rgba(255,255,255,0.28)"} />
          </Pressable>
        </View>
      ) : null}

      {/* Bottom area — always rendered so lock button is always reachable */}
      <View style={styles.bottomBar} {...(!isLocked ? bottomBarPanResponder.panHandlers : {})}>

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

        {/* Progress bar — hidden when locked */}
        {!isLocked ? (
          <Pressable
            onPress={handleProgressPress}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            style={styles.progressContainer}
            {...progressPanResponder.panHandlers}
          >
            <View style={styles.progressTrack}>
              {seekProgress !== null ? (
                <View style={[styles.progressGhost, { width: `${seekProgress * 100}%` as const }]} pointerEvents="none" />
              ) : null}
              <View style={[styles.progressFill, { width: `${progress * 100}%` as const }]} />
              <View style={[styles.progressThumb, { left: `${progress * 100}%` as const }]} />
            </View>
          </Pressable>
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
    paddingHorizontal: 4,
    paddingTop: 10,
    gap: 2,
    zIndex: 2,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingBottom: 2,
    justifyContent: "space-between",
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
  iconBtnActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 22,
  },
  lockBanner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignSelf: "flex-start",
  },
  lockBannerText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  topIconSpacer: { width: 42, height: 42 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
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
    flexWrap: "wrap",
    gap: 8,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 3,
    zIndex: 3,
  },
  quickOverflowMenu: {
    position: "absolute",
    top: 60,
    right: 10,
    maxWidth: "88%",
    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    zIndex: 40,
  },
  quickOverflowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 2,
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
    gap: 24,
    zIndex: 1,
  },
  centerSkipBtn: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 33,
  },
  centerSkipBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.1)",
    transform: [{ scale: 0.88 }],
  },
  centerSkipBtnDisabled: {
    opacity: 0.5,
  },
  centerPlayBtn: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 39,
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
  lockedActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: "center",
    zIndex: 2,
  },
  lockHoldBtn: {
    paddingHorizontal: 32,
    paddingVertical: 22,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    gap: 10,
    minWidth: 230,
  },
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
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 0,
    zIndex: 2,
  },
  seekPreviewBadge: {
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
    paddingVertical: 14,
  },
  progressTrack: {
    height: 4,
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
    width: 14,
    height: 14,
    borderRadius: 7,
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
    paddingHorizontal: 2,
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

