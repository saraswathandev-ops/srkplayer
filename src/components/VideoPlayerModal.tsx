import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Sun,
  Maximize,
  Minimize,
  Lock,
  Unlock,
  SkipForward,
  SkipBack,
  Gauge,
  Scan,
  PictureInPicture,
  Subtitles,
  FileText,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';
import { MediaTranscript } from '../types';
import { getTranscriptForMedia } from '../services/transcriptService';
import { VideoCaptionOverlay } from './VideoCaptionOverlay';
import { VideoTranscriptModal } from './VideoTranscriptModal';

export function VideoPlayerModal() {
  const {
    activeMedia,
    isVideoModalOpen,
    closeVideoModal,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    brightness,
    setBrightness,
    playbackRate,
    setPlaybackRate,
    aspectRatio,
    setAspectRatio,
    nextTrack,
    previousTrack,
    themeColors,
    videoRef,
    onTimeUpdate,
    onEnded,
    settings,
    updateSettings,
    showToast,
    isDark,
  } = usePlayer();

  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [doubleTapRipple, setDoubleTapRipple] = useState<'left' | 'right' | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<MediaTranscript | null>(null);

  // Load transcript for active media
  useEffect(() => {
    if (activeMedia) {
      setTranscript(getTranscriptForMedia(activeMedia.id));
    }
  }, [activeMedia?.id]);

  // Current active caption cue
  const activeCue = useMemo(() => {
    if (!transcript || !settings.subtitleSettings?.enabled) return null;
    return (
      transcript.cues.find(
        (c) => c.start <= currentTime && currentTime <= c.end
      ) || null
    );
  }, [transcript, currentTime, settings.subtitleSettings?.enabled]);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !isLocked) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [isPlaying, isLocked]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, isLocked, resetControlsTimer]);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!isVideoModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked) {
        if (e.key === 'l' || e.key === 'L') setIsLocked(false);
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          resetControlsTimer();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(currentTime - 10);
          showRipple('left');
          resetControlsTimer();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(currentTime + 10);
          showRipple('right');
          resetControlsTimer();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          resetControlsTimer();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          resetControlsTimer();
          break;
        case 'KeyM':
          toggleMute();
          resetControlsTimer();
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else {
            closeVideoModal();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoModalOpen, isLocked, isFullscreen, currentTime, volume, togglePlay, seek, setVolume, toggleMute, closeVideoModal, resetControlsTimer]);

  const showRipple = (side: 'left' | 'right') => {
    setDoubleTapRipple(side);
    setTimeout(() => setDoubleTapRipple(null), 600);
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeft = clickX < rect.width / 2;

    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      // Double tap detected
      if (isLeft) {
        seek(currentTime - 10);
        showRipple('left');
      } else {
        seek(currentTime + 10);
        showRipple('right');
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      resetControlsTimer();
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.error('PiP failed', e);
    }
  };

  // Keyboard shortcuts (Captions 'C', Transcript 'T', Fullscreen 'F', Mute 'M')
  useEffect(() => {
    if (!isVideoModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const next = !settings.subtitleSettings.enabled;
        updateSettings({
          subtitleSettings: {
            ...settings.subtitleSettings,
            enabled: next,
          },
        });
        showToast(next ? 'Subtitles (CC) turned ON' : 'Subtitles (CC) turned OFF');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowTranscript((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoModalOpen, settings.subtitleSettings, updateSettings, showToast, toggleMute]);

  if (!isVideoModalOpen || !activeMedia) return null;

  const aspectClass =
    aspectRatio === 'cover'
      ? 'object-cover'
      : aspectRatio === 'fill'
      ? 'object-fill'
      : 'object-contain';

  return (
    <div
      ref={containerRef}
      id="video-player-modal"
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
      onMouseMove={resetControlsTimer}
      onClick={handleDoubleTap}
    >
      {/* Video Element with native brightness filter */}
      <video
        ref={videoRef}
        src={activeMedia.uri}
        autoPlay
        playsInline
        className={`w-full h-full ${aspectClass} transition-all duration-150`}
        style={{
          filter: `brightness(${brightness})`,
        }}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime, e.currentTarget.duration)}
        onEnded={onEnded}
      />

      {/* Double tap ripple indicators */}
      {doubleTapRipple === 'left' && (
        <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 bg-black/60 backdrop-blur-md px-6 py-4 rounded-3xl animate-pulse">
          <RotateCcw className="w-8 h-8 text-white animate-spin" style={{ animationDuration: '0.6s' }} />
          <span className="text-xs font-bold text-white">-10s</span>
        </div>
      )}
      {doubleTapRipple === 'right' && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 bg-black/60 backdrop-blur-md px-6 py-4 rounded-3xl animate-pulse">
          <RotateCw className="w-8 h-8 text-white animate-spin" style={{ animationDuration: '0.6s' }} />
          <span className="text-xs font-bold text-white">+10s</span>
        </div>
      )}

      {/* Closed Captions & Subtitles Overlay */}
      <VideoCaptionOverlay
        cue={activeCue}
        settings={settings.subtitleSettings}
        controlsVisible={showControls}
      />

      {/* Lock Button (always visible if locked) */}
      {isLocked ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsLocked(false);
            setShowControls(true);
          }}
          className="absolute top-6 left-6 z-50 p-3 rounded-full bg-black/70 text-amber-400 border border-amber-400/40 hover:bg-black/90 cursor-pointer shadow-2xl flex items-center gap-2 text-xs font-bold"
        >
          <Lock className="w-5 h-5" />
          <span>Screen Locked (Click to Unlock)</span>
        </button>
      ) : (
        /* Full Controls Overlay */
        <div
          className={`absolute inset-0 flex flex-col justify-between p-4 sm:p-6 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%)' }}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-4 pointer-events-auto">
            <div className="flex items-center gap-3 min-w-0">
              <button
                id="video-player-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  closeVideoModal();
                }}
                className="p-2 rounded-xl bg-black/40 text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md sm:max-w-xl">
                  {activeMedia.title}
                </h3>
                <p className="text-xs text-slate-300 truncate">
                  {activeMedia.folder} {activeMedia.resolution && `• ${activeMedia.resolution}`}
                </p>
              </div>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Closed Captions CC Toggle */}
              <button
                id="top-subtitles-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !settings.subtitleSettings.enabled;
                  updateSettings({
                    subtitleSettings: {
                      ...settings.subtitleSettings,
                      enabled: next,
                    },
                  });
                  showToast(next ? 'Subtitles (CC) enabled' : 'Subtitles (CC) disabled');
                }}
                className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  settings.subtitleSettings.enabled
                    ? 'bg-amber-400/25 text-amber-300 border-amber-400/50'
                    : 'bg-black/40 text-slate-300 hover:text-white border-transparent'
                }`}
                title="Toggle Subtitles (CC)"
              >
                <Subtitles className="w-4 h-4" />
                <span className="hidden sm:inline">CC</span>
              </button>

              {/* Transcript Drawer Toggle */}
              <button
                id="top-transcript-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTranscript(!showTranscript);
                }}
                className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  showTranscript
                    ? 'bg-white/20 text-white border-white/40'
                    : 'bg-black/40 text-slate-300 hover:text-white border-transparent'
                }`}
                title="Open Video Transcript"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden md:inline">Transcript</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLocked(true);
                  setShowControls(false);
                }}
                className="p-2 rounded-xl bg-black/40 text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Lock Controls"
              >
                <Unlock className="w-5 h-5" />
              </button>

              {/* Aspect ratio cycle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const modes: ('contain' | 'cover' | 'fill')[] = ['contain', 'cover', 'fill'];
                  const next = modes[(modes.indexOf(aspectRatio) + 1) % modes.length];
                  setAspectRatio(next);
                }}
                className="p-2 rounded-xl bg-black/40 text-white hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title={`Aspect Ratio: ${aspectRatio}`}
              >
                <Scan className="w-4 h-4" />
                <span className="capitalize hidden sm:inline">{aspectRatio}</span>
              </button>

              {/* Playback speed selector */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedMenu(!showSpeedMenu);
                  }}
                  className="p-2 rounded-xl bg-black/40 text-white hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                  title="Playback Speed"
                >
                  <Gauge className="w-4 h-4" />
                  <span>{playbackRate}x</span>
                </button>

                {showSpeedMenu && (
                  <div
                    className="absolute right-0 top-11 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 text-xs font-medium backdrop-blur-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setPlaybackRate(rate);
                          setShowSpeedMenu(false);
                        }}
                        className={`w-full px-4 py-1.5 text-left hover:bg-white/10 ${
                          playbackRate === rate ? 'text-indigo-400 font-bold' : 'text-white'
                        }`}
                      >
                        {rate}x Speed
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PiP Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePiP();
                }}
                className="p-2 rounded-xl bg-black/40 text-white hover:bg-white/20 transition-colors cursor-pointer hidden sm:block"
                title="Picture in Picture"
              >
                <PictureInPicture className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Play/Pause & Skip Controls */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                previousTrack();
              }}
              className="p-3 rounded-full bg-black/40 text-white hover:bg-white/20 hover:scale-110 transition-all cursor-pointer"
              title="Previous Video"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                seek(currentTime - 10);
                showRipple('left');
              }}
              className="p-3 rounded-full bg-black/40 text-white hover:bg-white/20 hover:scale-110 transition-all cursor-pointer"
              title="-10 Seconds"
            >
              <RotateCcw className="w-6 h-6" />
            </button>

            <button
              id="video-center-play-toggle"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: themeColors.primary }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-white" />
              ) : (
                <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                seek(currentTime + 10);
                showRipple('right');
              }}
              className="p-3 rounded-full bg-black/40 text-white hover:bg-white/20 hover:scale-110 transition-all cursor-pointer"
              title="+10 Seconds"
            >
              <RotateCw className="w-6 h-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextTrack();
              }}
              className="p-3 rounded-full bg-black/40 text-white hover:bg-white/20 hover:scale-110 transition-all cursor-pointer"
              title="Next Video"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          </div>

          {/* Bottom Bar: Seek Scrubber + Hardware/Audio Controls */}
          <div className="space-y-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {/* Scrubber */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white tabular-nums w-12 text-right">
                {formatTime(currentTime)}
              </span>

              <div className="relative flex-1 flex items-center group/scrubber cursor-pointer">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => seek(parseFloat(e.target.value))}
                  className="w-full h-1.5 group-hover/scrubber:h-2.5 rounded-lg appearance-none bg-white/25 cursor-pointer accent-white transition-all"
                  style={{ accentColor: themeColors.primary }}
                />
              </div>

              <span className="text-xs font-bold text-slate-300 tabular-nums w-12">
                {formatTime(duration)}
              </span>
            </div>

            {/* Bottom Actions: Volume & Brightness & Fullscreen */}
            <div className="flex items-center justify-between text-white text-xs pt-1">
              <div className="flex items-center gap-4 sm:gap-6">
                {/* Volume Slider */}
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="hover:text-slate-300 cursor-pointer">
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-16 sm:w-24 h-1 rounded bg-white/30 cursor-pointer accent-white"
                  />
                </div>

                {/* Brightness Module Simulation Slider */}
                <div className="hidden sm:flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-300" />
                  <input
                    type="range"
                    min="0.3"
                    max="1.8"
                    step="0.05"
                    value={brightness}
                    onChange={(e) => setBrightness(parseFloat(e.target.value))}
                    className="w-16 sm:w-20 h-1 rounded bg-white/30 cursor-pointer accent-amber-300"
                    title={`Brightness: ${Math.round(brightness * 100)}%`}
                  />
                </div>
              </div>

              {/* Right Controls: Subtitles CC, Transcript, Fullscreen */}
              <div className="flex items-center gap-2">
                <button
                  id="bottom-subtitles-btn"
                  onClick={() => {
                    const next = !settings.subtitleSettings.enabled;
                    updateSettings({
                      subtitleSettings: {
                        ...settings.subtitleSettings,
                        enabled: next,
                      },
                    });
                    showToast(next ? 'Subtitles (CC) enabled' : 'Subtitles (CC) disabled');
                  }}
                  className={`px-2 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    settings.subtitleSettings.enabled
                      ? 'bg-amber-400/25 text-amber-300 border-amber-400/40'
                      : 'bg-black/40 text-slate-400 hover:text-white border-transparent'
                  }`}
                  title="Toggle Subtitles (CC) - Press C"
                >
                  <Subtitles className="w-4 h-4" />
                  <span>CC</span>
                </button>

                <button
                  id="bottom-transcript-btn"
                  onClick={() => setShowTranscript(true)}
                  className="px-2 py-1 rounded-lg bg-black/40 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 border border-white/10"
                  title="Open Transcript - Press T"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Transcript</span>
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg bg-black/40 hover:bg-white/20 transition-colors cursor-pointer"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F)'}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Transcript Drawer */}
      {showTranscript && (
        <VideoTranscriptModal
          isOpen={showTranscript}
          onClose={() => setShowTranscript(false)}
          transcript={transcript}
          currentTime={currentTime}
          duration={duration}
          onSeek={(s) => {
            seek(s);
            resetControlsTimer();
          }}
          subtitleSettings={settings.subtitleSettings}
          onUpdateSubtitleSettings={(partial) => {
            updateSettings({
              subtitleSettings: {
                ...settings.subtitleSettings,
                ...partial,
              },
            });
          }}
          themeColors={themeColors}
          isDark={isDark}
          onShowToast={showToast}
          onTranscriptUpdated={(updated) => setTranscript(updated)}
        />
      )}
    </div>
  );
}
