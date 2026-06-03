import type { MediaType, PlayerSettings } from "@/types/player";

export type PlayerFeatureConfig = {
  quickActionsEnabled: boolean;
  doubleTapSeekEnabled: boolean;
  pinchZoomEnabled: boolean;
  longPressSpeedEnabled: boolean;
  screenshotEnabled: boolean;
  volumeBoostEnabled: boolean;
  nightModeEnabled: boolean;
  defaultNightMode: boolean;
  orientationControlEnabled: boolean;
  defaultOrientationLock: "default" | "portrait" | "landscape";
  sleepTimerEnabled: boolean;
  discoveryHintsEnabled: boolean;
  trimEnabled: boolean;
  audioTrackSwitcherEnabled: boolean;
  subtitleSwitcherEnabled: boolean;
  subtitleGenerationEnabled: boolean;
  subtitleLivePreviewEnabled: boolean;
  subtitleShowLowConfidence: boolean;
  subtitleSyncStepMs: number;
  decoderSwitcherEnabled: boolean;
  aspectRatioSwitcherEnabled: boolean;
  lockControlEnabled: boolean;
  upNextAutoplayEnabled: boolean;
  /** User-chosen display order of quick-action control keys. */
  quickActionOrder: string[];
  /** Quick-action control keys the user has hidden from the footer. */
  hiddenQuickActions: string[];
};

export function createPlayerFeatureConfig(
  settings: PlayerSettings,
  mediaType: MediaType
): PlayerFeatureConfig {
  const isVideo = mediaType === "video";

  return {
    quickActionsEnabled: settings.enableQuickActions,
    doubleTapSeekEnabled: isVideo && settings.enableDoubleTapSeek,
    pinchZoomEnabled: isVideo && settings.enablePinchZoom,
    longPressSpeedEnabled: isVideo && settings.enableLongPressSpeed,
    screenshotEnabled: isVideo && settings.enableScreenshotPreview,
    volumeBoostEnabled: settings.enableVolumeBoost,
    nightModeEnabled: isVideo && settings.enableNightMode,
    defaultNightMode: isVideo && settings.enableNightMode && settings.defaultNightMode,
    orientationControlEnabled: isVideo && settings.enableOrientationControl,
    defaultOrientationLock: settings.defaultOrientationLock,
    sleepTimerEnabled: settings.enableSleepTimer,
    discoveryHintsEnabled: isVideo && settings.enableDiscoveryHints,
    trimEnabled: isVideo && settings.enableTrim,
    audioTrackSwitcherEnabled: settings.enableAudioTrackSwitcher,
    subtitleSwitcherEnabled: isVideo && settings.enableSubtitleSwitcher,
    subtitleGenerationEnabled: isVideo && settings.subtitleLiveGeneration,
    subtitleLivePreviewEnabled: isVideo && settings.subtitleLivePreview,
    subtitleShowLowConfidence: settings.subtitleShowLowConfidence,
    subtitleSyncStepMs: settings.subtitleSyncStepMs,
    decoderSwitcherEnabled: isVideo && settings.enableDecoderSwitcher,
    aspectRatioSwitcherEnabled: isVideo && settings.enableAspectRatioSwitcher,
    lockControlEnabled: settings.enableLockControl,
    upNextAutoplayEnabled: isVideo && settings.enableUpNextAutoplay,
    quickActionOrder: settings.quickActionOrder ?? [],
    hiddenQuickActions: settings.hiddenQuickActions ?? [],
  };
}
