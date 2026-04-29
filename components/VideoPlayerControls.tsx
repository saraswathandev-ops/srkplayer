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
  const moreMenuTranslateY = moreMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });
  const moreMenuOpacity = moreMenuAnim.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1] });

  const triggerAction = (action?: () => void) => {
    if (!action) return;
    if (Platform.OS !== "web") ReactNativeHapticFeedback.trigger("impactLight");
    action();
  };

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

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          hitSlop={12}
        >
          <Feather name="chevron-left" size={28} color="#fff" />
        </Pressable>

        {!isLocked ? (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        ) : (
          <View style={styles.lockBanner}>
            <Feather name="lock" size={14} color="#fff" />
            <Text style={styles.lockBannerText}>Locked</Text>
          </View>
        )}

        {!isLocked ? (
          <View style={styles.topRight}>
            <Pressable
              onPress={() => triggerAction(onToggleUtilityRail)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              hitSlop={10}
            >
              <MaterialCommunityIcons
                name={utilityRailExpanded ? "playlist-remove" : "playlist-play"}
                size={24}
                color="#fff"
              />
            </Pressable>
            <Pressable
              onPress={() => triggerAction(onToggleLockMode)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              hitSlop={10}
            >
              <Feather name="lock" size={19} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => triggerAction(onToggleQuickActions)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              hitSlop={10}
            >
              <Feather name="more-vertical" size={22} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.topIconSpacer} />
        )}
      </View>

      {/* Center transport controls */}
      {!isLocked ? (
        <View style={styles.centerControls} pointerEvents="box-none">
          {onPrev ? (
            <Pressable
              onPress={() => triggerAction(onPrev)}
              style={({ pressed }) => [styles.centerSkipBtn, pressed && styles.centerSkipBtnPressed]}
            >
              <Ionicons name="play-skip-back" size={26} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSeekBack}
              style={({ pressed }) => [styles.centerSkipBtn, pressed && styles.centerSkipBtnPressed]}
            >
              <MaterialCommunityIcons name="replay-10" size={46} color="#fff" />
            </Pressable>
          )}

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

          {onNext ? (
            <Pressable
              onPress={() => triggerAction(onNext)}
              style={({ pressed }) => [styles.centerSkipBtn, pressed && styles.centerSkipBtnPressed]}
            >
              <Ionicons name="play-skip-forward" size={26} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSeekForward}
              style={({ pressed }) => [styles.centerSkipBtn, pressed && styles.centerSkipBtnPressed]}
            >
              <MaterialCommunityIcons name="fast-forward-10" size={46} color="#fff" />
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Lock hold overlay */}
      {isLocked ? (
        <View pointerEvents="box-none" style={styles.lockedActionWrap}>
          <Pressable
            onPressIn={handleUnlockHoldStart}
            onPressOut={handleUnlockHoldEnd}
            onPress={() => undefined}
            style={({ pressed }) => [styles.lockHoldBtn, pressed && styles.lockHoldBtnPressed]}
          >
            <Feather name="unlock" size={24} color="#fff" />
            <Text style={styles.lockHoldTitle}>Hold to unlock</Text>
            <Text style={styles.lockHoldSub}>
              {unlockHoldProgress > 0 ? `${Math.round(unlockHoldProgress * 100)}%` : "Keep holding…"}
            </Text>
            <View style={styles.lockHoldTrack}>
              <View style={[styles.lockHoldFill, { width: `${unlockHoldProgress * 100}%` as const }]} />
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* Bottom controls */}
      {!isLocked ? (
        <View style={styles.bottomBar}>
          {/* Seek preview badge */}
          {seekProgress !== null ? (
            <View
              style={[styles.seekPreviewBadge, { marginLeft: `${seekProgress * 100}%` as any }]}
              pointerEvents="none"
            >
              <Text style={styles.seekPreviewText}>
                {Math.floor((seekPreviewPosition ?? 0) / 60)}:{String(Math.floor((seekPreviewPosition ?? 0) % 60)).padStart(2, '0')}
              </Text>
            </View>
          ) : null}

          {/* YouTube-style progress bar */}
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

          {/* Time + fullscreen row */}
          <View style={styles.bottomRow}>
            <Text style={styles.timeText}>{formatDuration(position)}</Text>
            <Text style={styles.timeSep}> / </Text>
            <Text style={styles.timeDur}>{formatDuration(duration)}</Text>
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
          </View>

          {/* Aspect ratio picker */}
          {aspectPickerVisible && onSetAspectRatio && !isAudioMode ? (
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
      ) : null}

      {/* More / Settings bottom sheet */}
      {quickActionsExpanded && !isLocked ? (
        <Animated.View
          style={[
            styles.moreSheet,
            { opacity: moreMenuOpacity, transform: [{ translateY: moreMenuTranslateY }] },
          ]}
        >
          <View style={styles.moreSheetHandle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.moreSheetContent}
            bounces={false}
          >
            <MoreRow
              icon={<Text style={styles.moreSpeedLabel}>{speed}x</Text>}
              label="Playback speed"
              value={`${speed}x`}
              onPress={() => triggerAction(onSpeedChange)}
            />
            <MoreRow
              icon={<Feather name={isMuted ? "volume-x" : "volume-2"} size={20} color="#fff" />}
              label="Volume"
              value={isMuted ? "Muted" : "On"}
              onPress={() => triggerAction(onToggleMute)}
            />
            {onCycleVolumeBoost ? (
              <MoreRow
                icon={<Feather name="volume-2" size={20} color={volumeBoost > 1 ? YT_RED : "#fff"} />}
                label="Volume boost"
                value={volumeBoost > 1 ? `${Math.round(volumeBoost * 100)}%` : "Off"}
                onPress={() => triggerAction(onCycleVolumeBoost)}
                active={volumeBoost > 1}
              />
            ) : null}
            {onCycleAudioTrack ? (
              <MoreRow
                icon={<MaterialCommunityIcons name="translate" size={20} color="#fff" />}
                label="Audio track"
                value={audioTrackLabel || "Default"}
                onPress={() => triggerAction(onCycleAudioTrack)}
              />
            ) : null}
            <MoreRow
              icon={<MaterialCommunityIcons name={loopIcon} size={20} color={loopMode !== "none" ? YT_RED : "#fff"} />}
              label="Loop"
              value={loopMode === "none" ? "Off" : loopMode === "one" ? "One" : "All"}
              onPress={() => triggerAction(onToggleLoop)}
              active={loopMode !== "none"}
            />
            <MoreRow
              icon={<Feather name="moon" size={20} color={nightMode ? YT_RED : "#fff"} />}
              label="Night mode"
              value={nightMode ? "On" : "Off"}
              onPress={() => triggerAction(onToggleNightMode)}
              active={nightMode}
            />
            <MoreRow
              icon={
                <Ionicons
                  name={backgroundPlay ? "musical-notes" : "musical-notes-outline"}
                  size={20}
                  color={backgroundPlay ? YT_RED : "#fff"}
                />
              }
              label="Background play"
              value={backgroundPlay ? "On" : "Off"}
              onPress={() => triggerAction(onToggleBackgroundPlay)}
              active={backgroundPlay}
            />
            {!isAudioMode ? (
              <MoreRow
                icon={<Feather name="rotate-cw" size={20} color="#fff" />}
                label="Orientation"
                value={orientationLabel}
                onPress={() => triggerAction(onCycleOrientation)}
              />
            ) : null}
            {!isAudioMode && onSetAspectRatio ? (
              <MoreRow
                icon={<Feather name="maximize-2" size={20} color={forcedAspectRatio ? YT_RED : "#fff"} />}
                label="Aspect ratio"
                value={forcedAspectRatio ?? "Auto"}
                onPress={() => setAspectPickerVisible(v => !v)}
                active={!!forcedAspectRatio}
              />
            ) : null}
            {!isAudioMode && onZoomAction ? (
              <MoreRow
                icon={<Feather name="zoom-in" size={20} color="#fff" />}
                label={zoomLabel || "Zoom"}
                onPress={() => triggerAction(onZoomAction)}
              />
            ) : null}
            {!isAudioMode && onCycleDecoderMode ? (
              <MoreRow
                icon={<MaterialCommunityIcons name="chip" size={20} color={decoderMode === "HW" || decoderMode === "HW+" ? YT_RED : "#fff"} />}
                label="Decoder"
                value={decoderMode || "HW+"}
                onPress={() => triggerAction(onCycleDecoderMode)}
                active={decoderMode === "HW" || decoderMode === "HW+"}
              />
            ) : null}
            {!isAudioMode && onTrimAction ? (
              <MoreRow
                icon={<Feather name="scissors" size={20} color="#fff" />}
                label={trimLabel || "Trim"}
                onPress={() => triggerAction(onTrimAction)}
              />
            ) : null}
            {!isAudioMode ? (
              <MoreRow
                icon={<Feather name="camera" size={20} color="#fff" />}
                label="Screenshot"
                onPress={() => triggerAction(onScreenshot)}
              />
            ) : null}
            <MoreRow
              icon={<Feather name="info" size={20} color="#fff" />}
              label="Properties"
              onPress={() => triggerAction(onToggleProperties)}
            />
            <MoreRow
              icon={
                <MaterialCommunityIcons
                  name={sleepTimerRemaining !== null ? "timer" : "timer-outline"}
                  size={20}
                  color={sleepTimerRemaining !== null ? YT_RED : "#fff"}
                />
              }
              label="Sleep timer"
              value={sleepTimerRemaining !== null ? `${Math.ceil(sleepTimerRemaining / 60)}m` : "Off"}
              onPress={() => {
                const options: (number | null)[] = [15, 30, 45, 60, null];
                const cur = sleepTimerRemaining !== null ? Math.round(sleepTimerRemaining / 60) : null;
                const idx = options.findIndex(o => o === cur);
                const next = options[(idx + 1) % options.length];
                triggerAction(() => onSetSleepTimer(next));
              }}
              active={sleepTimerRemaining !== null}
            />
          </ScrollView>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function MoreRow({
  icon,
  label,
  value,
  onPress,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.moreRow, pressed && styles.moreRowPressed]}
    >
      <View style={[styles.moreRowIcon, active && styles.moreRowIconActive]}>{icon}</View>
      <Text style={styles.moreRowLabel}>{label}</Text>
      {value != null ? (
        <Text style={[styles.moreRowValue, active && styles.moreRowValueActive]}>{value}</Text>
      ) : null}
      <Feather name="chevron-right" size={15} color="rgba(255,255,255,0.3)" />
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
    height: 150,
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

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingTop: 12,
    gap: 4,
    zIndex: 2,
  },
  title: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginHorizontal: 4,
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

  // More / settings sheet
  moreSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(12,12,18,0.97)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "72%",
    zIndex: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.1)",
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  moreSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  moreSheetContent: {
    paddingHorizontal: 6,
    paddingBottom: 28,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
    borderRadius: 14,
    marginHorizontal: 4,
  },
  moreRowPressed: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  moreRowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreRowIconActive: {
    backgroundColor: "rgba(255,59,48,0.2)",
  },
  moreRowLabel: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  moreRowValue: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginRight: 2,
  },
  moreRowValueActive: {
    color: YT_RED,
  },
  moreSpeedLabel: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
