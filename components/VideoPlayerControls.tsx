import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
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
  const quickActionsAnimation = useRef(new Animated.Value(quickActionsExpanded ? 1 : 0)).current;
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
    Animated.timing(quickActionsAnimation, {
      toValue: quickActionsExpanded ? 1 : 0,
      duration: 220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [quickActionsAnimation, quickActionsExpanded]);

  const clearUnlockHold = useCallback((resetProgress = true) => {
    if (unlockHoldTimeout.current) { clearTimeout(unlockHoldTimeout.current); unlockHoldTimeout.current = null; }
    if (unlockHoldInterval.current) { clearInterval(unlockHoldInterval.current); unlockHoldInterval.current = null; }
    unlockHoldStartedAt.current = null;
    if (resetProgress) setUnlockHoldProgress(0);
  }, []);

  useEffect(() => { if (!isLocked) clearUnlockHold(); }, [clearUnlockHold, isLocked]);
  useEffect(() => () => { clearUnlockHold(); }, [clearUnlockHold]);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safePosition = Number.isFinite(position) && position >= 0 ? position : 0;
  const progress = safeDuration > 0 ? Math.min(safePosition / safeDuration, 1) : 0;

  const seekFromLocationX = useCallback((locationX: number) => {
    if (Number.isFinite(locationX) && Number.isFinite(barWidth) && barWidth > 0 && safeDuration > 0) {
      const ratio = Math.max(0, Math.min(1, locationX / barWidth));
      const seekTo = ratio * safeDuration;
      if (Number.isFinite(seekTo)) onSeek(seekTo);
    }
  }, [barWidth, onSeek, safeDuration]);

  const handleProgressPress = useCallback((event: any) => {
    const locationX = typeof event?.nativeEvent?.locationX === "number" ? event.nativeEvent.locationX : NaN;
    seekFromLocationX(locationX);
  }, [seekFromLocationX]);

  const progressPanResponder = useMemo(
    () =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 2,
      onPanResponderGrant: (event) => {
        const locationX = typeof event.nativeEvent.locationX === "number" ? event.nativeEvent.locationX : NaN;
        progressGestureStartX.current = Number.isFinite(locationX) ? locationX : 0;
        seekFromLocationX(locationX);
      },
      onPanResponderMove: (_, gestureState) => {
        seekFromLocationX(progressGestureStartX.current + gestureState.dx);
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [seekFromLocationX]
  );

  const fitIcon = contentFitMode === "cover" ? "crop-free" : contentFitMode === "fill" ? "fit-to-screen-outline" : "aspect-ratio";
  const loopIcon = loopMode === "none" ? "repeat-off" : loopMode === "one" ? "repeat-once" : "repeat";
  const orientationLabel = orientationMode === "landscape" ? "Landscape" : orientationMode === "portrait" ? "Portrait" : "Auto";
  const quickActionsTranslateX = quickActionsAnimation.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });
  const quickActionsOpacity = quickActionsAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

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

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[styles.overlay, { opacity }, Platform.OS === "web" ? { pointerEvents: visible ? "box-none" : "none" } : null]}
      {...nativePointerEvents}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topLeftGroup}>
          {!isLocked ? (
            <Pressable onPress={() => triggerAction(onToggleQuickActions)}
              style={({ pressed }) => [styles.topIconBtn, pressed ? styles.topIconBtnPressed : null]} hitSlop={10}>
              <Feather name={quickActionsExpanded ? "x" : "sliders"} size={20} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable onPress={onClose}
            style={({ pressed }) => [styles.topIconBtn, pressed ? styles.topIconBtnPressed : null]} hitSlop={10}>
            <Feather name="chevron-down" size={28} color="#fff" />
          </Pressable>
        </View>
        {!isLocked ? (
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        ) : (
          <View style={styles.lockBanner}>
            <Feather name="lock" size={16} color="#fff" />
            <Text style={styles.lockBannerText}>Controls locked</Text>
          </View>
        )}
        {!isLocked ? (
          <Pressable onPress={() => triggerAction(onToggleUtilityRail)}
            style={({ pressed }) => [styles.topIconBtn, pressed ? styles.topIconBtnPressed : null]} hitSlop={10}>
            <Feather name={utilityRailExpanded ? "x" : "list"} size={22} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.topIconSpacer} />
        )}
      </View>

      {/* Quick actions rail */}
      {quickActionsExpanded && !isLocked ? (
        <Animated.View style={[styles.quickActionsRail, { opacity: quickActionsOpacity, transform: [{ translateX: quickActionsTranslateX }] }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRailContent}>
            <QuickActionButton icon={<Text style={styles.quickActionSpeedText}>{speed}x</Text>} label="Speed" onPress={() => triggerAction(onSpeedChange)} />
            <QuickActionButton icon={<Feather name={isMuted ? "volume-x" : "volume-2"} size={18} color="#fff" />} label={isMuted ? "Muted" : "Volume"} onPress={() => triggerAction(onToggleMute)} />
            {onCycleVolumeBoost ? (
              <QuickActionButton icon={<Feather name="volume-2" size={18} color="#fff" />} label={volumeBoost > 1 ? `${Math.round(volumeBoost * 100)}%` : "Boost"} onPress={() => triggerAction(onCycleVolumeBoost)} active={volumeBoost > 1} />
            ) : null}
            {onCycleAudioTrack ? (
              <QuickActionButton icon={<MaterialCommunityIcons name="translate" size={20} color="#fff" />} label={audioTrackLabel || "Audio"} onPress={() => triggerAction(onCycleAudioTrack)} />
            ) : null}
            {onCycleDecoderMode && !isAudioMode ? (
              <QuickActionButton icon={<MaterialCommunityIcons name="chip" size={20} color="#fff" />} label={decoderMode || "HW+"} onPress={() => triggerAction(onCycleDecoderMode)} active={decoderMode === "HW" || decoderMode === "HW+"} />
            ) : null}
            <QuickActionButton icon={<MaterialCommunityIcons name={loopIcon} size={20} color="#fff" />} label="Loop" onPress={() => triggerAction(onToggleLoop)} />
            <QuickActionButton icon={<Feather name="moon" size={18} color="#fff" />} label={nightMode ? "Night On" : "Night"} onPress={() => triggerAction(onToggleNightMode)} active={nightMode} />
            <QuickActionButton icon={<Ionicons name={backgroundPlay ? "musical-notes" : "musical-notes-outline"} size={18} color="#fff" />} label={backgroundPlay ? "BG On" : "Background"} onPress={() => triggerAction(onToggleBackgroundPlay)} active={backgroundPlay} />
            {!isAudioMode ? <QuickActionButton icon={<Feather name="rotate-cw" size={18} color="#fff" />} label={orientationLabel} onPress={() => triggerAction(onCycleOrientation)} /> : null}
            {!isAudioMode && onSetAspectRatio ? (
              <QuickActionButton icon={<Feather name="maximize-2" size={18} color="#fff" />} label={forcedAspectRatio ?? "Ratio"} onPress={() => setAspectPickerVisible(v => !v)} active={!!forcedAspectRatio} />
            ) : null}
            {!isAudioMode ? <QuickActionButton icon={<Feather name="zoom-in" size={18} color="#fff" />} label={zoomLabel || "Zoom"} onPress={() => triggerAction(onZoomAction)} /> : null}
            {!isAudioMode && onTrimAction ? <QuickActionButton icon={<Feather name="scissors" size={18} color="#fff" />} label={trimLabel || "Trim"} onPress={() => triggerAction(onTrimAction)} /> : null}
            {!isAudioMode ? <QuickActionButton icon={<Feather name="camera" size={18} color="#fff" />} label="Shot" onPress={() => triggerAction(onScreenshot)} /> : null}
            <QuickActionButton icon={<Feather name="info" size={18} color="#fff" />} label="Properties" onPress={() => triggerAction(onToggleProperties)} />
            <QuickActionButton
              icon={<MaterialCommunityIcons name={sleepTimerRemaining !== null ? "timer" : "timer-outline"} size={20} color={sleepTimerRemaining !== null ? "#FFC107" : "#fff"} />}
              label={sleepTimerRemaining !== null ? `${Math.ceil(sleepTimerRemaining / 60)}m` : "Sleep"}
              onPress={() => {
                const options = [15, 30, 45, 60, null];
                const currentIndex = options.indexOf(sleepTimerRemaining !== null ? Math.round(sleepTimerRemaining / 60) : null);
                const next = options[(currentIndex + 1) % options.length];
                triggerAction(() => onSetSleepTimer(next));
              }}
              active={sleepTimerRemaining !== null}
            />
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* Locked overlay or bottom controls */}
      {isLocked ? (
        <View pointerEvents="box-none" style={styles.lockedActionWrap}>
          <Pressable onPressIn={handleUnlockHoldStart} onPressOut={handleUnlockHoldEnd} onPress={() => undefined}
            style={({ pressed }) => [styles.transportBtn, styles.lockOnlyBtn, styles.lockHoldBtn, pressed ? styles.transportBtnPressed : null]}>
            <Feather name="unlock" size={22} color="#fff" />
            <Text style={styles.lockHoldTitle}>Hold 1s to unlock</Text>
            <Text style={styles.lockHoldSubtitle}>{unlockHoldProgress > 0 ? `${Math.round(unlockHoldProgress * 100)}%` : "Keep pressing the locked screen"}</Text>
            <View style={styles.lockHoldTrack}>
              <View style={[styles.lockHoldFill, { width: `${unlockHoldProgress * 100}%` as const }]} />
            </View>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(position)}</Text>
            <Text style={[styles.timeText, { opacity: 0.6 }]}>{formatDuration(duration)}</Text>
          </View>

          {/* Progress bar with seek preview */}
          <Pressable
            onPress={handleProgressPress}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            style={styles.progressContainer}
            {...progressPanResponder.panHandlers}
          >
            {seekProgress !== null ? (
              <View style={[styles.seekPreviewBadge, { left: `${seekProgress * 100}%` as any }]} pointerEvents="none">
                <Text style={styles.seekPreviewText}>
                  {Math.floor((seekPreviewPosition ?? 0) / 60)}:{String(Math.floor((seekPreviewPosition ?? 0) % 60)).padStart(2, '0')}
                </Text>
              </View>
            ) : null}
            <View style={styles.progressTrack}>
              {seekProgress !== null ? (
                <View style={[styles.progressGhost, { width: `${seekProgress * 100}%` as const }]} pointerEvents="none" />
              ) : null}
              <View style={[styles.progressFill, { width: `${progress * 100}%` as const }]} />
              <View style={[styles.progressThumb, { left: `${progress * 100}%` as const }]} />
            </View>
          </Pressable>

          {/* Transport controls */}
          <View style={styles.transportRow}>
            <View style={styles.sideControlGroup}>
              <Pressable onPress={() => triggerAction(onToggleLockMode)}
                style={({ pressed }) => [styles.transportBtn, styles.secondaryTransportBtn, pressed ? styles.transportBtnPressed : null]}>
                <Feather name="lock" size={18} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.transportCenterGroup}>
              <Pressable onPress={onPrev} disabled={!onPrev}
                style={({ pressed }) => [styles.transportBtn, styles.skipBtn, !onPrev ? styles.transportBtnDisabled : null, pressed && onPrev ? styles.transportBtnPressed : null]}>
                <Ionicons name="play-skip-back" size={22} color="#fff" />
              </Pressable>
              <Pressable onPress={() => triggerAction(onPlayPause)}
                style={({ pressed }) => [styles.transportBtn, styles.playBtn, pressed ? styles.playBtnPressed : null]}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={34} color="#fff" style={isPlaying ? undefined : styles.playIconOffset} />
              </Pressable>
              <Pressable onPress={onNext} disabled={!onNext}
                style={({ pressed }) => [styles.transportBtn, styles.skipBtn, !onNext ? styles.transportBtnDisabled : null, pressed && onNext ? styles.transportBtnPressed : null]}>
                <Ionicons name="play-skip-forward" size={22} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.sideControlGroup}>
              {isAudioMode ? (
                <View style={styles.sideControlSpacer} />
              ) : (
                <Pressable onPress={() => triggerAction(onToggleContentFit)}
                  style={({ pressed }) => [styles.transportBtn, styles.secondaryTransportBtn, pressed ? styles.transportBtnPressed : null]}>
                  <MaterialCommunityIcons name={fitIcon} size={19} color="#fff" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Aspect Ratio Picker */}
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
                  style={({ pressed }) => [styles.aspectPickerBtn, forcedAspectRatio === ratio && styles.aspectPickerBtnActive, pressed && styles.aspectPickerBtnPressed]}
                >
                  <Text style={[styles.aspectPickerBtnText, forcedAspectRatio === ratio && styles.aspectPickerBtnTextActive]}>
                    {ratio ?? "Auto"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
}

function QuickActionButton({ icon, label, onPress, active = false }: { icon: React.ReactNode; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickActionButton, active ? styles.quickActionButtonActive : null, pressed ? styles.quickActionButtonPressed : null]}>
      <View style={[styles.quickActionIcon, active ? styles.quickActionIconActive : null]}>{icon}</View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)", justifyContent: "space-between", padding: 14 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8 },
  topLeftGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  topIconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.48)" },
  topIconBtnPressed: { opacity: 0.9, transform: [{ scale: 0.94 }], backgroundColor: "rgba(255,255,255,0.14)" },
  topIconSpacer: { width: 42, height: 42 },
  title: { flex: 1, color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold", lineHeight: 24 },
  lockBanner: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)", alignSelf: "flex-start" },
  lockBannerText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  quickActionsRail: { position: "absolute", top: 88, left: 16, maxWidth: "84%", borderRadius: 28, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  quickActionsRailContent: { paddingHorizontal: 10, paddingVertical: 10, flexDirection: "row", alignItems: "flex-start", gap: 6 },
  quickActionButton: { alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 8, minWidth: 74 },
  quickActionButtonActive: { backgroundColor: "rgba(75,163,255,0.12)", borderRadius: 18 },
  quickActionButtonPressed: { opacity: 0.92, transform: [{ scale: 0.96 }] },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  quickActionIconActive: { backgroundColor: "rgba(75,163,255,0.34)", borderWidth: 1, borderColor: "rgba(191,228,255,0.34)" },
  quickActionLabel: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  quickActionSpeedText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  lockedActionWrap: { position: "absolute", left: 16, right: 16, bottom: 34, alignItems: "center" },
  bottomBar: { gap: 6, paddingHorizontal: 2, paddingBottom: 2 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  timeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progressContainer: { paddingTop: 14, paddingBottom: 10, position: "relative" },
  progressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 999, position: "relative", overflow: "hidden" },
  progressFill: { position: "absolute", top: 0, left: 0, height: "100%", backgroundColor: "#4BA3FF", borderRadius: 999 },
  progressGhost: { position: "absolute", top: 0, left: 0, height: "100%", backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 999 },
  progressThumb: { position: "absolute", top: -7, width: 20, height: 20, borderRadius: 10, backgroundColor: "#4BA3FF", marginLeft: -10, borderWidth: 2, borderColor: "#D7E8FF" },
  seekPreviewBadge: { position: "absolute", top: -30, transform: [{ translateX: -22 }], backgroundColor: "rgba(37,148,255,0.95)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, zIndex: 10, elevation: 4 },
  seekPreviewText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  transportRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
  sideControlGroup: { width: 54, alignItems: "center", justifyContent: "center" },
  transportCenterGroup: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  transportBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.32)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  secondaryTransportBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.42)" },
  skipBtn: { width: 46, height: 46, borderRadius: 23 },
  transportBtnPressed: { opacity: 0.9, transform: [{ scale: 0.92 }], backgroundColor: "rgba(255,255,255,0.12)" },
  transportBtnDisabled: { opacity: 0.35 },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(75,163,255,0.28)", borderColor: "rgba(191,228,255,0.28)" },
  playBtnPressed: { transform: [{ scale: 0.94 }] },
  playIconOffset: { marginLeft: 3 },
  lockOnlyBtn: { backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  lockHoldBtn: { width: "100%", maxWidth: 280, minHeight: 120, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 24, gap: 8 },
  lockHoldTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  lockHoldSubtitle: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_500Medium" },
  lockHoldTrack: { width: "100%", height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)", overflow: "hidden", marginTop: 2 },
  lockHoldFill: { height: "100%", borderRadius: 999, backgroundColor: "#4BA3FF" },
  transportLabel: { position: "absolute", bottom: 4, color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  sideControlSpacer: { width: 40, height: 40 },
  aspectPickerRow: { flexDirection: "row", gap: 8, paddingTop: 10, paddingBottom: 4, paddingHorizontal: 4, justifyContent: "center", flexWrap: "wrap" },
  aspectPickerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  aspectPickerBtnActive: { backgroundColor: "rgba(37,148,255,0.35)", borderColor: "#2594FF" },
  aspectPickerBtnPressed: { opacity: 0.75, transform: [{ scale: 0.95 }] },
  aspectPickerBtnText: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_700Bold" },
  aspectPickerBtnTextActive: { color: "#7FC4FF" },
});
