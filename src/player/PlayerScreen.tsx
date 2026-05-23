/**
 * PlayerScreen.tsx
 *
 * The new MX Player/VLC architecture orchestrator.
 * This replaces the 5,681-line monolith with a clean composition of components.
 *
 * Playback Lifecycle Engine:
 *   - Reducer-driven state machine (13 states, deterministic transitions)
 *   - 300ms native false debounce (prevents ExoPlayer isPlaying oscillation)
 *   - Playback intent queue (seek-before-play, race prevention)
 *   - Startup controller (abort on video switch, settle delay)
 *   - Resume controller (DB lookup, near-end guard, 5s rewind)
 *   - 5-condition startup stabilization
 *   - 4-tier tiered recovery (immediate → 2s → 4s → 6s)
 *   - Hybrid health monitor (250ms poll + event-driven stall timers)
 *   - Lifecycle coordinator (AppState / background / foreground)
 *   - Startup metrics tracking
 *   - Structured session logging
 *
 * Flow:
 * Video Surface (bottom)
 *   -> SubtitleOverlay (above video)
 *     -> GestureLayer (pure touch detection)
 *       -> Control Overlays (Top, Center, Bottom)
 *       -> Gesture HUD (Brightness/Volume/Seek indicators)
 *       -> Loading Overlay (Buffering spinner)
 *         -> Bottom Sheets (Speed, Audio, Subtitles)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, StatusBar, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Video, { SelectedTrackType, type VideoRef } from 'react-native-video';
import Orientation from 'react-native-orientation-locker';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayerStore } from '@/store/playerStore';
import { usePlayerControls } from '@/hooks/player/usePlayerControls';
import { usePlayback } from '@/hooks/player/usePlayback';
import { usePlayer } from '@/context/PlayerContext';

// ── Playback Lifecycle Hooks ──────────────────────────────────────────────────
import { usePlaybackStateMachine } from '@/hooks/player/usePlaybackStateMachine';
import { useNativeEventAdapter } from '@/hooks/player/useNativeEventAdapter';
import { usePlaybackIntentQueue } from '@/hooks/player/usePlaybackIntentQueue';
import { useStartupMetrics } from '@/hooks/player/useStartupMetrics';
import { useStartupStabilization } from '@/hooks/player/useStartupStabilization';
import { useRecoveryController } from '@/hooks/player/useRecoveryController';
import { useHealthMonitor } from '@/hooks/player/useHealthMonitor';
import { usePlaybackLifecycle } from '@/hooks/player/usePlaybackLifecycle';
import { useResumeController } from '@/hooks/player/useResumeController';
import { useStartupController } from '@/hooks/player/useStartupController';
import { logPlayback } from '@/src/player/playbackLogger';
import { isStartupState } from '@/src/player/playbackReducer';

// Player Components
import { GestureLayer } from '@/components/player/GestureLayer';
import { TopControls } from '@/components/player/TopControls';
import { CenterControls } from '@/components/player/CenterControls';
import { BottomControls } from '@/components/player/BottomControls';
import { SeekHUD, SideHUD } from '@/components/player/GestureHUD';
import { LoadingOverlay } from '@/components/player/LoadingOverlay';
import { SubtitleOverlay } from '@/components/player/SubtitleOverlay';
import { SpeedBottomSheet } from '@/components/player/SpeedBottomSheet';
import { AudioTrackBottomSheet } from '@/components/player/AudioTrackBottomSheet';
import { SubtitleBottomSheet } from '@/components/player/SubtitleBottomSheet';
import ScreenBrightness from 'react-native-screen-brightness';
import { VolumeManager } from 'react-native-volume-manager';

export default function PlayerScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params || {};
  const videoId = Array.isArray(id) ? id[0] : id;

  const { videos, settings } = usePlayer();
  const video = videos.find((v) => v.id === videoId) || null;
  const videoRef = useRef<VideoRef>(null);

  // ── State ────────────────────────────────────────────────────────────────
  const store = usePlayerStore();
  const {
    showControls,
    hideControls,
    resetHideTimer,
    pauseHideTimer,
    showHUD,
  } = usePlayerControls();

  // ── Remount key (for tier 4 recovery) ───────────────────────────────────
  const [remountKey, setRemountKey] = useState(0);
  const triggerRemount = useCallback(() => setRemountKey((k) => k + 1), []);

  // ── Mutable buffering ref for health monitor ────────────────────────────
  const isBufferingRef = useRef(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYBACK LIFECYCLE ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. State Machine (authoritative)
  const stateMachine = usePlaybackStateMachine(videoId);

  // 2. Startup Metrics
  const metrics = useStartupMetrics(stateMachine.buildLogContext);

  // 3. Native Event Adapter (300ms debounce)
  const nativeAdapter = useNativeEventAdapter(stateMachine.buildLogContext);

  // 4. Intent Queue (seek-before-play enforcement)
  const intentQueue = usePlaybackIntentQueue(
    videoRef,
    stateMachine.generationRef,
    stateMachine.buildLogContext,
  );

  // 5. Startup Stabilization (5 conditions)
  const stabilization = useStartupStabilization(
    stateMachine.buildLogContext,
    nativeAdapter.isNativePlaying,
    nativeAdapter.hasNativeFalseToggle,
  );

  // 6. Recovery Controller (4-tier, tiered timing)
  const recovery = useRecoveryController(
    videoRef,
    stateMachine.buildLogContext,
    stateMachine.transition,
    stateMachine.setRecoveryTier,
    stateMachine.incrementRecovery,
    stateMachine.generationRef,
    intentQueue.reset,
    intentQueue.queuePlay,
    triggerRemount,
  );

  // 7. Break circular dep: lifecycle ↔ healthMonitor via callback refs
  const onBackgroundRef = useRef<() => void>(() => {});
  const onForegroundRef = useRef<() => void>(() => {});

  const lifecycle = usePlaybackLifecycle(
    stateMachine.buildLogContext,
    () => stateMachine.state.playbackState,
    () => onBackgroundRef.current(),
    () => onForegroundRef.current(),
  );

  // 8. Health Monitor (hybrid 250ms poll + event stall timers)
  const healthMonitor = useHealthMonitor(
    stateMachine.buildLogContext,
    () => stateMachine.state.playbackState,
    (reason) => {
      metrics.incrementCounter('stallCount');
      recovery.attemptRecovery(reason, stateMachine.state.playbackState);
    },
    nativeAdapter.isNativePlaying,
    nativeAdapter.hasNativeFalseToggle,
    nativeAdapter.lastNativeAckPlayingAt,
    recovery.lastRecoveryAtRef,
    recovery.attemptCountRef,
    lifecycle.isBackground,
    isBufferingRef,
  );

  // Wire lifecycle callbacks now that healthMonitor exists
  onBackgroundRef.current = () => {
    healthMonitor.stopPolling();
    recovery.resetRecovery();
  };
  onForegroundRef.current = () => {
    healthMonitor.startPolling();
  };

  // 9. Resume Controller (DB lookup + near-end guard + rewind)
  const resumeController = useResumeController(
    stateMachine.buildLogContext,
    stateMachine.setResuming,
    intentQueue.queueSeek,
    intentQueue.queuePlay,
    stateMachine.generationRef,
  );

  // 10. Startup Controller (abort + seek confirm)
  const startupController = useStartupController(
    stateMachine.buildLogContext,
    stateMachine.transition,
    stateMachine.generationRef,
    () => stateMachine.state.playbackState,
    intentQueue.queuePlay,
    intentQueue.queueSeek,
    metrics.recordTimestamp,
  );

  // 11. Playback (state-machine-aware play/pause/seek)
  const { togglePlayPause, seekTo, seekBy, cycleSpeed, savePosition } =
    usePlayback(videoRef, video, videoId, {
      getPlaybackState: () => stateMachine.state.playbackState,
      transition: stateMachine.transition,
      buildLogContext: stateMachine.buildLogContext,
      queueSeek: intentQueue.queueSeek,
      queuePlay: intentQueue.queuePlay,
      stopPolling: healthMonitor.stopPolling,
      resetRecovery: recovery.resetRecovery,
    });

  // ── Wire native adapter callbacks ───────────────────────────────────────
  useEffect(() => {
    nativeAdapter.setCallbacks(
      // onNativePlayingConfirmed
      () => {
        metrics.recordTimestamp('nativePlayingAckAt');
        const phase = stateMachine.state.playbackState;
        if (phase === 'starting') {
          // Native confirmed playing → begin stabilization
          stabilization.beginStabilization(store.currentTime);
          stateMachine.transition('stabilizing', 'native_started_stabilizing');
          metrics.recordTimestamp('stabilizationStartedAt');
        }
      },
      // onNativePauseConfirmed (after 300ms debounce)
      () => {
        const phase = stateMachine.state.playbackState;
        // If we're in an active phase and user didn't pause, this is a problem
        if (
          phase === 'playing' ||
          phase === 'stabilizing' ||
          phase === 'starting'
        ) {
          logPlayback(
            stateMachine.buildLogContext(),
            'native_unexpected_pause',
            { phase },
          );
          // Let health monitor handle recovery — don't trigger directly here
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lifecycle & Setup ────────────────────────────────────────────────────

  useEffect(() => {
    // Reset everything for new video
    store.resetForNewVideo();
    stateMachine.resetForNewVideo();
    recovery.resetRecovery();
    stabilization.resetStabilization();
    intentQueue.reset();
    nativeAdapter.reset();
    healthMonitor.resetHealth();
    metrics.resetMetrics();
    startupController.abortStartup();

    // Apply settings
    store.setPaused(!settings.autoPlay);
    store.setBrightness(settings.defaultBrightness ?? 0.5);
    store.setVolume(settings.defaultVolume ?? 1);

    // Hide status bar and navigation bar
    StatusBar.setHidden(true);
    if (Platform.OS === 'android') {
      SystemNavigationBar.navigationHide();
    }

    // Auto-landscape for video
    if (video?.mediaType !== 'audio') {
      Orientation.lockToLandscape();
    }

    // Begin startup pipeline
    if (videoId && video?.uri) {
      startupController.beginStartup(
        videoId,
        video.uri,
        stateMachine.state.generation,
      );
      healthMonitor.startPolling();
    }

    return () => {
      savePosition();
      healthMonitor.stopAllTimers();
      startupController.abortStartup();
      StatusBar.setHidden(false);
      if (Platform.OS === 'android') {
        SystemNavigationBar.navigationShow();
      }
      Orientation.unlockAllOrientations();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, video?.mediaType]);

  // Sync brightness/volume to native
  useEffect(() => {
    ScreenBrightness.setBrightness(store.brightness);
  }, [store.brightness]);

  useEffect(() => {
    VolumeManager.setVolume(store.volume);
  }, [store.volume]);

  // ── Video Events ─────────────────────────────────────────────────────────

  const onLoad = useCallback(
    async (data: any) => {
      const gen = stateMachine.state.generation;
      store.setDuration(data.duration);
      store.setAudioTracks(data.audioTracks || []);

      logPlayback(stateMachine.buildLogContext(), 'on_load', {
        duration: data.duration,
        audioTrackCount: data.audioTracks?.length ?? 0,
      });

      // Resolve resume position
      let resumePosition: number | null = null;
      if (settings.rememberPosition && videoId) {
        resumePosition = await resumeController.resolveResumePosition(
          videoId,
          video?.lastPosition,
          data.duration,
        );
      }

      startupController.handleLoad(
        data,
        resumePosition && resumePosition > 0 ? resumePosition : null,
        gen,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateMachine.state.generation, settings.rememberPosition, videoId],
  );

  const onProgress = useCallback(
    (data: any) => {
      const gen = stateMachine.state.generation;
      if (gen !== stateMachine.generationRef.current) return;

      store.setCurrentTime(data.currentTime);
      store.setIsBuffering(false);
      isBufferingRef.current = false;

      // Feed intent queue (seek confirmation)
      intentQueue.onProgressUpdate(data.currentTime);

      // Feed health monitor (reset stall timer)
      healthMonitor.onProgressHealthUpdate(data.currentTime);

      // Record first progress
      if (metrics.metricsRef.current.firstProgressAt === 0) {
        metrics.recordTimestamp('firstProgressAt');
      }

      // Stabilization check
      const phase = stateMachine.state.playbackState;

      if (phase === 'starting') {
        // Native hasn't confirmed playing yet — check if progress alone triggers stabilization
        if (nativeAdapter.isNativePlaying.current) {
          stabilization.beginStabilization(data.currentTime);
          stateMachine.transition('stabilizing', 'native_started_stabilizing');
          metrics.recordTimestamp('stabilizationStartedAt');
        }
      } else if (phase === 'stabilizing') {
        const result = stabilization.checkStabilization(
          data.currentTime,
          isBufferingRef.current,
        );

        if (result === 'stable') {
          stateMachine.transition('playing', 'startup_stable');
          metrics.recordTimestamp('stabilizationConfirmedAt');
          metrics.markSuccess();
          metrics.logMetricsSummary();
          store.setPaused(false);
          recovery.resetRecovery();
        } else if (result === 'failed') {
          recovery.attemptRecovery(
            'startup_timeout',
            stateMachine.state.playbackState,
          );
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateMachine.state.generation, stateMachine.state.playbackState],
  );

  const onBuffer = useCallback(
    ({ isBuffering }: { isBuffering: boolean }) => {
      store.setIsBuffering(isBuffering);
      isBufferingRef.current = isBuffering;

      if (isBuffering) {
        metrics.incrementCounter('rebufferCount');
        const phase = stateMachine.state.playbackState;
        if (phase === 'playing') {
          stateMachine.transition('buffering', 'native_buffering');
        }
      } else {
        const phase = stateMachine.state.playbackState;
        if (phase === 'buffering') {
          // Return to the appropriate state
          if (nativeAdapter.isNativePlaying.current) {
            stateMachine.transition('playing', 'native_buffering_cleared');
          } else {
            stateMachine.transition('stabilizing', 'native_buffering_cleared');
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateMachine.state.playbackState],
  );

  const onEnd = useCallback(() => {
    stateMachine.transition('ended', 'playback_ended');
    healthMonitor.stopAllTimers();
    recovery.resetRecovery();
    store.setPaused(true);
    savePosition();
    // Auto-play next logic goes here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onError = useCallback(
    (e: any) => {
      stateMachine.transition('error', 'playback_error');
      healthMonitor.stopAllTimers();
      recovery.resetRecovery();
      logPlayback(stateMachine.buildLogContext(), 'playback_error', {
        error: e?.error ?? e,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Component Render ─────────────────────────────────────────────────────

  if (!video) return null;

  return (
    <View style={styles.container}>
      {/* 1. Video Surface — key changes for tier 4 remount */}
      <Video
        key={remountKey}
        ref={videoRef}
        source={{ uri: video.uri }}
        paused={store.paused}
        rate={store.playbackRate}
        volume={store.volume}
        muted={store.isMuted}
        resizeMode={store.contentFitMode}
        repeat={store.loopMode === 'one'}
        onLoad={onLoad}
        onProgress={onProgress}
        onBuffer={onBuffer}
        onEnd={onEnd}
        onError={onError}
        onPlaybackStateChanged={
          nativeAdapter.handleNativePlaybackStateChanged
        }
        style={StyleSheet.absoluteFill}
        playInBackground={store.backgroundPlay}
        selectedAudioTrack={{
          type: SelectedTrackType.INDEX,
          value: store.selectedAudioTrackIndex ?? 0,
        }}
      />

      {/* 2. Subtitle Overlay */}
      <SubtitleOverlay text={store.currentSubtitle} />

      {/* 3. Gesture Layer */}
      <GestureLayer
        isLocked={store.isLocked}
        isAudioMode={video.mediaType === 'audio'}
        currentTime={store.currentTime}
        duration={store.duration}
        brightness={store.brightness}
        volume={store.volume}
        swipeBrightness={settings.swipeBrightness}
        swipeVolume={settings.swipeVolume}
        swipeSeek={settings.swipeSeek}
        doubleTapSeekSeconds={settings.doubleTapSeek}
        onTap={() => (store.controlsVisible ? hideControls() : showControls())}
        onDoubleTapLeft={(sec) => {
          seekBy(-sec);
          showHUD({ mode: 'seek', direction: 'rewind', label: `-${sec}s`, progress: 0 });
        }}
        onDoubleTapRight={(sec) => {
          seekBy(sec);
          showHUD({ mode: 'seek', direction: 'forward', label: `+${sec}s`, progress: 0 });
        }}
        onBrightnessChange={(val) => {
          store.setBrightness(val);
          store.setBrightnessHudPercent(Math.round(val * 100));
          showHUD({ mode: 'brightness', label: '', progress: val });
        }}
        onVolumeChange={(val) => {
          store.setVolume(val);
          store.setVolumeHudPercent(Math.round(val * 100));
          showHUD({ mode: 'volume', label: '', progress: val });
        }}
        onSeekPreview={(pos) => {
          pauseHideTimer();
          store.setSeekPreviewPosition(pos);
        }}
        onSeekCommit={(pos) => {
          seekTo(pos);
          store.setSeekPreviewPosition(null);
          resetHideTimer();
        }}
        onSeekPreviewEnd={() => {
          store.setSeekPreviewPosition(null);
          resetHideTimer();
        }}
        onZoomChange={store.setZoomScale}
        onLongPressStart={() => store.setPlaybackRate(2.0)}
        onLongPressEnd={() => store.setPlaybackRate(settings.speed)}
      >
        {/* 4. Controls Overlay */}
        {store.controlsVisible && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <TopControls
              title={video.title}
              isLocked={store.isLocked}
              hasSubtitles={true} // will be dynamic in Phase 3
              hasMultipleAudioTracks={store.audioTracks.length > 1}
              onBack={() => navigation.goBack()}
              onSubtitlePress={() => store.setPropertiesPanelVisible(true)} // placeholder
              onAudioTrackPress={() => store.setQuickActionsExpanded(true)} // placeholder
              onMorePress={() => {}} // placeholder
            />

            <CenterControls
              isPlaying={!store.paused}
              isLocked={store.isLocked}
              hasPrev={true} // placeholder
              hasNext={true} // placeholder
              onPlayPause={togglePlayPause}
              onPrev={() => {}} // placeholder
              onNext={() => {}} // placeholder
              onToggleLock={() => {
                store.toggleLocked();
                resetHideTimer();
              }}
            />

            <BottomControls
              isLocked={store.isLocked}
              position={store.currentTime}
              duration={store.duration}
              seekPreviewPosition={store.seekPreviewPosition}
              playbackRate={store.playbackRate}
              contentFitMode={store.contentFitMode}
              onSeekPreview={(time) => {
                pauseHideTimer();
                store.setSeekPreviewPosition(time);
              }}
              onSeekCommit={(time) => {
                seekTo(time);
                store.setSeekPreviewPosition(null);
                resetHideTimer();
              }}
              onSeekDragStart={pauseHideTimer}
              onSeekDragEnd={resetHideTimer}
              onSpeedPress={() => store.setUtilityRailExpanded(true)} // placeholder
              onToggleContentFit={store.cycleContentFitMode}
            />
          </View>
        )}
      </GestureLayer>

      {/* 5. Floating HUDs & Overlays */}
      <SideHUD
        type="brightness"
        visible={store.gestureHUD?.mode === 'brightness'}
        percent={store.brightnessHudPercent}
      />
      <SideHUD
        type="volume"
        visible={store.gestureHUD?.mode === 'volume'}
        percent={store.volumeHudPercent}
      />
      <SeekHUD
        visible={store.gestureHUD?.mode === 'seek'}
        label={store.gestureHUD?.label || ''}
        direction={store.gestureHUD?.direction || 'forward'}
      />

      <LoadingOverlay isBuffering={store.isBuffering && !store.paused} />

      {/* 6. Bottom Sheets */}
      <SpeedBottomSheet
        visible={store.utilityRailExpanded} // reusing boolean for now
        currentSpeed={store.playbackRate}
        onSpeedSelect={(s) => {
          store.setPlaybackRate(s);
          store.setUtilityRailExpanded(false);
        }}
        onClose={() => store.setUtilityRailExpanded(false)}
      />
      <AudioTrackBottomSheet
        visible={store.quickActionsExpanded} // reusing boolean for now
        tracks={store.audioTracks}
        currentTrackIndex={store.selectedAudioTrackIndex}
        onTrackSelect={(idx) => {
          store.setSelectedAudioTrackIndex(idx);
          store.setQuickActionsExpanded(false);
        }}
        onClose={() => store.setQuickActionsExpanded(false)}
      />
      <SubtitleBottomSheet
        visible={store.propertiesPanelVisible} // reusing boolean for now
        onClose={() => store.setPropertiesPanelVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
