/**
 * PlayerScreen.tsx
 *
 * The new MX Player/VLC architecture orchestrator.
 * This replaces the 5,681-line monolith with a clean composition of components.
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
import React, { useCallback, useEffect, useRef } from 'react';
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
  
  const { togglePlayPause, seekTo, seekBy, cycleSpeed, savePosition } =
    usePlayback(videoRef, video, videoId);

  // ── Lifecycle & Setup ────────────────────────────────────────────────────

  useEffect(() => {
    store.resetForNewVideo();
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

    return () => {
      savePosition();
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
    (data: any) => {
      store.setDuration(data.duration);
      store.setAudioTracks(data.audioTracks || []);
      // Auto-resume from last position if enabled
      if (settings.rememberPosition && video?.lastPosition) {
        seekTo(video.lastPosition);
      }
    },
    [store, settings.rememberPosition, video?.lastPosition, seekTo]
  );

  const onProgress = useCallback(
    (data: any) => {
      store.setCurrentTime(data.currentTime);
      store.setIsBuffering(false); // Progress implies playing smoothly
    },
    [store]
  );

  // ── Component Render ─────────────────────────────────────────────────────

  if (!video) return null;

  return (
    <View style={styles.container}>
      {/* 1. Video Surface */}
      <Video
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
        onBuffer={({ isBuffering }) => store.setIsBuffering(isBuffering)}
        onEnd={() => {
          store.setPaused(true);
          // Auto-play next logic goes here
        }}
        onError={(e) => {
          // VLC Fallback logic will attach here in Phase 3
          console.error('Video error:', e);
        }}
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
