import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
}: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const quickActionsAnimation = useRef(
    new Animated.Value(quickActionsExpanded ? 1 : 0)
  ).current;
  const [barWidth, setBarWidth] = useState(0);
  const [unlockHoldProgress, setUnlockHoldProgress] = useState(0);
  const isAudioMode = mediaType === "audio";
  const unlockHoldTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockHoldInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockHoldStartedAt = useRef<number | null>(null);
  const nativePointerEvents =
    Platform.OS === "web"
      ? {}
      : {
        pointerEvents: visible ? ("box-none" as const) : ("none" as const),
      };

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
    if (unlockHoldTimeout.current) {
      clearTimeout(unlockHoldTimeout.current);
      unlockHoldTimeout.current = null;
    }
    if (unlockHoldInterval.current) {
      clearInterval(unlockHoldInterval.current);
      unlockHoldInterval.current = null;
    }
    unlockHoldStartedAt.current = null;
    if (resetProgress) {
      setUnlockHoldProgress(0);
    }
  }, []);

  useEffect(() => {
    if (!isLocked) {
      clearUnlockHold();
    }
  }, [clearUnlockHold, isLocked]);

  useEffect(() => {
    return () => {
      clearUnlockHold();
    };
  }, [clearUnlockHold]);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safePosition = Number.isFinite(position) && position >= 0 ? position : 0;
  const progress = safeDuration > 0 ? Math.min(safePosition / safeDuration, 1) : 0;

  const handleProgressPress = useCallback(
    (event: any) => {
      const locationX =
        typeof event?.nativeEvent?.locationX === "number"
          ? event.nativeEvent.locationX
          : NaN;

      if (
        Number.isFinite(locationX) &&
        Number.isFinite(barWidth) &&
        barWidth > 0 &&
        safeDuration > 0
      ) {
        const ratio = Math.max(0, Math.min(1, locationX / barWidth));
        const seekTo = ratio * safeDuration;
        if (!Number.isFinite(seekTo)) return;
        onSeek(seekTo);
      }
    },
    [barWidth, onSeek, safeDuration]
  );

  const fitIcon =
    contentFitMode === "cover"
      ? "crop-free"
      : contentFitMode === "fill"
        ? "fit-to-screen-outline"
        : "aspect-ratio";
  const loopIcon =
    loopMode === "none"
      ? "repeat-off"
      : loopMode === "one"
        ? "repeat-once"
        : "repeat";
  const orientationLabel =
    orientationMode === "landscape"
      ? "Landscape"
      : orientationMode === "portrait"
        ? "Portrait"
        : "Auto";
  const quickActionsTranslateX = quickActionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 0],
  });
  const quickActionsOpacity = quickActionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const triggerAction = (action?: () => void) => {
    if (!action) return;
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("impactLight");
    }
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

      const elapsed = Date.now() - startedAt;
      setUnlockHoldProgress(Math.min(elapsed / LOCK_HOLD_UNLOCK_MS, 1));
    }, 100);

    unlockHoldTimeout.current = setTimeout(() => {
      clearUnlockHold(false);
      setUnlockHoldProgress(1);
      if (Platform.OS !== "web") {
        ReactNativeHapticFeedback.trigger("impactMedium");
      }
      onToggleLockMode();
    }, LOCK_HOLD_UNLOCK_MS);
  }, [clearUnlockHold, isLocked, onToggleLockMode]);

  const handleUnlockHoldEnd = useCallback(() => {
    if (!isLocked) return;
    clearUnlockHold();
  }, [clearUnlockHold, isLocked]);

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.overlay,
        {
          opacity,
        },
        Platform.OS === "web"
          ? { pointerEvents: visible ? "box-none" : "none" }
          : null,
      ]}
      {...nativePointerEvents}
    >
      <View style={styles.topBar}>
        <View style={styles.topLeftGroup}>
          {!isLocked ? (
            <Pressable
              onPress={() => triggerAction(onToggleQuickActions)}
              style={({ pressed }) => [
                styles.topIconBtn,
                pressed ? styles.topIconBtnPressed : null,
              ]}
              hitSlop={10}
            >
              <Feather
                name={quickActionsExpanded ? "x" : "sliders"}
                size={20}
                color="#fff"
              />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.topIconBtn,
              pressed ? styles.topIconBtnPressed : null,
            ]}
            hitSlop={10}
          >
            <Feather name="chevron-down" size={28} color="#fff" />
          </Pressable>
        </View>
        {!isLocked ? (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : (
          <View style={styles.lockBanner}>
            <Feather name="lock" size={16} color="#fff" />
            <Text style={styles.lockBannerText}>Controls locked</Text>
          </View>
        )}
        {!isLocked ? (
          <Pressable
            onPress={() => triggerAction(onToggleUtilityRail)}
            style={({ pressed }) => [
              styles.topIconBtn,
              pressed ? styles.topIconBtnPressed : null,
            ]}
            hitSlop={10}
          >
            <Feather
              name={utilityRailExpanded ? "x" : "list"}
              size={22}
              color="#fff"
            />
          </Pressable>
        ) : (
          <View style={styles.topIconSpacer} />
        )}
      </View>

      {quickActionsExpanded && !isLocked ? (
        <Animated.View
          style={[
            styles.quickActionsRail,
            {
              opacity: quickActionsOpacity,
              transform: [{ translateX: quickActionsTranslateX }],
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActionsRailContent}
          >
            <QuickActionButton
              icon={<Text style={styles.quickActionSpeedText}>{speed}x</Text>}
              label="Speed"
              onPress={() => triggerAction(onSpeedChange)}
            />
            <QuickActionButton
              icon={
                <Feather
                  name={isMuted ? "volume-x" : "volume-2"}
                  size={18}
                  color="#fff"
                />
              }
              label={isMuted ? "Muted" : "Volume"}
              onPress={() => triggerAction(onToggleMute)}
            />
            <QuickActionButton
              icon={
                <MaterialCommunityIcons name={loopIcon} size={20} color="#fff" />
              }
              label="Loop"
              onPress={() => triggerAction(onToggleLoop)}
            />
            <QuickActionButton
              icon={<Feather name="moon" size={18} color="#fff" />}
              label={nightMode ? "Night On" : "Night"}
              onPress={() => triggerAction(onToggleNightMode)}
              active={nightMode}
            />
            <QuickActionButton
              icon={
                <Ionicons
                  name={backgroundPlay ? "musical-notes" : "musical-notes-outline"}
                  size={18}
                  color="#fff"
                />
              }
              label={backgroundPlay ? "Background On" : "Background"}
              onPress={() => triggerAction(onToggleBackgroundPlay)}
              active={backgroundPlay}
            />
            {!isAudioMode ? (
              <QuickActionButton
                icon={<Feather name="rotate-cw" size={18} color="#fff" />}
                label={orientationLabel}
                onPress={() => triggerAction(onCycleOrientation)}
              />
            ) : null}
            {!isAudioMode ? (
              <QuickActionButton
                icon={<Feather name="zoom-in" size={18} color="#fff" />}
                label={zoomLabel || "Zoom"}
                onPress={() => triggerAction(onZoomAction)}
              />
            ) : null}
            {!isAudioMode && onTrimAction ? (
              <QuickActionButton
                icon={<Feather name="scissors" size={18} color="#fff" />}
                label={trimLabel || "Trim"}
                onPress={() => triggerAction(onTrimAction)}
              />
            ) : null}
            {!isAudioMode ? (
              <QuickActionButton
                icon={<Feather name="camera" size={18} color="#fff" />}
                label="Shot"
                onPress={() => triggerAction(onScreenshot)}
              />
            ) : null}
            <QuickActionButton
              icon={<Feather name="info" size={18} color="#fff" />}
              label="Properties"
              onPress={() => triggerAction(onToggleProperties)}
            />
          </ScrollView>
        </Animated.View>
      ) : null}

      {isLocked ? (
        <View pointerEvents="box-none" style={styles.lockedActionWrap}>
          <Pressable
            onPressIn={handleUnlockHoldStart}
            onPressOut={handleUnlockHoldEnd}
            onPress={() => undefined}
            style={({ pressed }) => [
              styles.transportBtn,
              styles.lockOnlyBtn,
              styles.lockHoldBtn,
              pressed ? styles.transportBtnPressed : null,
            ]}
          >
            <Feather name="unlock" size={22} color="#fff" />
            <Text style={styles.lockHoldTitle}>Hold 1s to unlock</Text>
            <Text style={styles.lockHoldSubtitle}>
              {unlockHoldProgress > 0
                ? `${Math.round(unlockHoldProgress * 100)}%`
                : "Keep pressing the locked screen"}
            </Text>
            <View style={styles.lockHoldTrack}>
              <View
                style={[
                  styles.lockHoldFill,
                  { width: `${unlockHoldProgress * 100}%` as const },
                ]}
              />
            </View>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(position)}</Text>
            <Text style={[styles.timeText, { opacity: 0.6 }]}>
              {formatDuration(duration)}
            </Text>
          </View>

          <Pressable
            onPress={handleProgressPress}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            style={styles.progressContainer}
          >
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` as const }]}
              />
              <View
                style={[styles.progressThumb, { left: `${progress * 100}%` as const }]}
              />
            </View>
          </Pressable>

          <View style={styles.transportRow}>
            <Pressable
              onPress={() => triggerAction(onToggleLockMode)}
              style={({ pressed }) => [
                styles.transportBtn,
                pressed ? styles.transportBtnPressed : null,
              ]}
            >
              <Feather name="lock" size={22} color="#fff" />
              <Text style={styles.transportLabel}>Lock</Text>
            </Pressable>
            <View style={styles.transportCenterGroup}>
              <Pressable
                onPress={onPrev}
                disabled={!onPrev}
                style={({ pressed }) => [
                  styles.transportBtn,
                  !onPrev ? styles.transportBtnDisabled : null,
                  pressed && onPrev ? styles.transportBtnPressed : null,
                ]}
              >
                <Ionicons name="play-skip-back" size={28} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => triggerAction(onPlayPause)}
                style={({ pressed }) => [
                  styles.transportBtn,
                  styles.playBtn,
                  pressed ? styles.playBtnPressed : null,
                ]}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={48}
                  color="#fff"
                  style={isPlaying ? undefined : styles.playIconOffset}
                />
              </Pressable>
              <Pressable
                onPress={onNext}
                disabled={!onNext}
                style={({ pressed }) => [
                  styles.transportBtn,
                  !onNext ? styles.transportBtnDisabled : null,
                  pressed && onNext ? styles.transportBtnPressed : null,
                ]}
              >
                <Ionicons name="play-skip-forward" size={28} color="#fff" />
              </Pressable>
            </View>
            {isAudioMode ? (
              <View style={styles.sideControlSpacer} />
            ) : (
              <Pressable
                onPress={() => triggerAction(onToggleContentFit)}
                style={({ pressed }) => [
                  styles.transportBtn,
                  pressed ? styles.transportBtnPressed : null,
                ]}
              >
                <MaterialCommunityIcons name={fitIcon} size={24} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function QuickActionButton({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionButton,
        active ? styles.quickActionButtonActive : null,
        pressed ? styles.quickActionButtonPressed : null,
      ]}
    >
      <View
        style={[styles.quickActionIcon, active ? styles.quickActionIconActive : null]}
      >
        {icon}
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.36)",
    justifyContent: "space-between",
    padding: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  topLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  topIconBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  topIconSpacer: {
    width: 42,
    height: 42,
  },
  title: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 24,
  },
  lockBanner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignSelf: "flex-start",
  },
  lockBannerText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  quickActionsRail: {
    position: "absolute",
    top: 88,
    left: 16,
    maxWidth: "84%",
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  quickActionsRailContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  quickActionButton: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 74,
  },
  quickActionButtonActive: {
    backgroundColor: "rgba(75,163,255,0.12)",
    borderRadius: 18,
  },
  quickActionButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  quickActionIconActive: {
    backgroundColor: "rgba(75,163,255,0.34)",
    borderWidth: 1,
    borderColor: "rgba(191,228,255,0.34)",
  },
  quickActionLabel: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  quickActionSpeedText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  lockedActionWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 34,
    alignItems: "center",
  },
  bottomBar: {
    gap: 10,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  timeText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  progressContainer: {
    paddingVertical: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.26)",
    borderRadius: 999,
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "#4BA3FF",
    borderRadius: 999,
  },
  progressThumb: {
    position: "absolute",
    top: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#4BA3FF",
    marginLeft: -9,
    borderWidth: 2,
    borderColor: "#D7E8FF",
  },
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  transportCenterGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  transportBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  transportBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.92 }],
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  transportBtnDisabled: {
    opacity: 0.35,
  },
  playBtn: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  playBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  playIconOffset: {
    marginLeft: 4,
  },
  lockOnlyBtn: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  lockHoldBtn: {
    width: "100%",
    maxWidth: 280,
    height: "auto",
    minHeight: 120,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 24,
    gap: 8,
  },
  lockHoldTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  lockHoldSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  lockHoldTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    marginTop: 2,
  },
  lockHoldFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#4BA3FF",
  },
  transportLabel: {
    position: "absolute",
    bottom: 4,
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  sideControlSpacer: {
    width: 56,
    height: 56,
  },
});
