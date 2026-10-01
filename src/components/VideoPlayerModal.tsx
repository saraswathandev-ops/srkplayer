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
  Minimize2,
  Maximize2,
  GripVertical,
  CornerDownRight,
  CornerDownLeft,
  CornerUpRight,
  CornerUpLeft,
  Lock,
  Unlock,
  SkipForward,
  SkipBack,
  Gauge,
  Scan,
  PictureInPicture,
  Subtitles,
  FileText,
  Sliders,
  FastForward,
  Smartphone,
  Monitor,
  Check,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';
import { MediaTranscript, OrientationLockMode } from '../types';
import { getTranscriptForMedia } from '../services/transcriptService';
import { VideoCaptionOverlay } from './VideoCaptionOverlay';
import { VideoTranscriptModal } from './VideoTranscriptModal';
import { VideoGesturesOverlay } from './VideoGesturesOverlay';
import { VideoGesturesModal } from './VideoGesturesModal';
import { VideoGesturesHelpOverlay } from './VideoGesturesHelpOverlay';
import { EnhancementModal } from './EnhancementModal';

const PIP_DIMENSIONS: Record<'sm' | 'md' | 'lg', { width: number; height: number }> = {
  sm: { width: 280, height: 158 },
  md: { width: 360, height: 203 },
  lg: { width: 440, height: 248 },
};

const SPEED_PRESETS_PIP = [1, 1.25, 1.5, 2];

export function VideoPlayerModal() {
  const {
    activeMedia,
    isVideoModalOpen,
    closeVideoModal,
    isFloatingPipOpen,
    closeFloatingPip,
    collapseActivePlayerToPip,
    expandPipToModal,
    pipPosition,
    setPipPosition,
    pipSize,
    setPipSize,
    isPlaying,
    setIsPlaying,
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
    videoColorSettings,
    audioEnhanceSettings,
  } = usePlayer();

  const isDark = settings.theme === 'dark';

  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [doubleTapRipple, setDoubleTapRipple] = useState<'left' | 'right' | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showGesturesModal, setShowGesturesModal] = useState(false);
  const [showGesturesHelpOverlay, setShowGesturesHelpOverlay] = useState(false);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [enhanceInitialTab, setEnhanceInitialTab] = useState<'video' | 'audio'>('video');
  const [transcript, setTranscript] = useState<MediaTranscript | null>(null);

  // First-time user onboarding: auto-show the gestures help overlay if not dismissed
  useEffect(() => {
    if (isVideoModalOpen && !isFloatingPipOpen) {
      const hasDismissed = localStorage.getItem('skr_gestures_help_dismissed');
      if (!hasDismissed) {
        const timer = setTimeout(() => {
          setShowGesturesHelpOverlay(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [isVideoModalOpen, isFloatingPipOpen]);

  // Orientation lock states & viewport listener
  const [orientationMode, setOrientationMode] = useState<OrientationLockMode>(
    settings.orientationLock || 'auto'
  );
  const [showOrientationMenu, setShowOrientationMenu] = useState(false);

  const [viewportDims, setViewportDims] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  useEffect(() => {
    const handleResize = () => {
      setViewportDims({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isViewportPortrait = viewportDims.height > viewportDims.width;

  // Visual rotation when user pins orientation:
  // - Locked to landscape but viewport is portrait -> rotate 90deg clockwise
  // - Locked to portrait but viewport is landscape -> rotate -90deg
  // - Auto or matching natural orientation -> 0deg (no rotation transform)
  const visualRotation = useMemo(() => {
    if (isFloatingPipOpen) return 0;
    if (orientationMode === 'landscape' && isViewportPortrait) {
      return 90;
    }
    if (orientationMode === 'portrait' && !isViewportPortrait) {
      return -90;
    }
    return 0;
  }, [isFloatingPipOpen, orientationMode, isViewportPortrait]);

  const applyOrientationLock = useCallback(async (mode: OrientationLockMode) => {
    try {
      const orientation = (screen as any)?.orientation;
      if (orientation) {
        if (mode === 'auto') {
          if (typeof orientation.unlock === 'function') {
            orientation.unlock();
          }
        } else if (mode === 'landscape') {
          if (typeof orientation.lock === 'function') {
            await orientation.lock('landscape').catch(() => {
              // Gracefully handled by visual rotation fallback
            });
          }
        } else if (mode === 'portrait') {
          if (typeof orientation.lock === 'function') {
            await orientation.lock('portrait').catch(() => {});
          }
        }
      }
    } catch {
      // Ignore unsupported screen orientation locks
    }
  }, []);

  const setOrientation = useCallback(
    (nextMode: OrientationLockMode) => {
      setOrientationMode(nextMode);
      updateSettings({ orientationLock: nextMode });
      applyOrientationLock(nextMode);

      if (nextMode === 'landscape') {
        showToast('Orientation: Locked to Landscape 🖥️');
      } else if (nextMode === 'portrait') {
        showToast('Orientation: Locked to Portrait 📱');
      } else {
        showToast('Orientation: Auto (Sensor Unlocked) 🔄');
      }
    },
    [applyOrientationLock, updateSettings, showToast]
  );

  const cycleOrientation = useCallback(() => {
    const modes: OrientationLockMode[] = ['auto', 'landscape', 'portrait'];
    const currentIndex = modes.indexOf(orientationMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setOrientation(nextMode);
  }, [orientationMode, setOrientation]);

  // Clean up native screen orientation lock when modal closes
  useEffect(() => {
    return () => {
      try {
        const orientation = (screen as any)?.orientation;
        if (orientation && typeof orientation.unlock === 'function') {
          orientation.unlock();
        }
      } catch {}
    };
  }, []);

  // Re-apply orientation lock when entering fullscreen if orientation is locked
  useEffect(() => {
    if (isFullscreen && orientationMode !== 'auto') {
      applyOrientationLock(orientationMode);
    }
  }, [isFullscreen, orientationMode, applyOrientationLock]);

  // Floating PiP states & handlers
  const [isPipHovered, setIsPipHovered] = useState(false);
  const [showCornerMenu, setShowCornerMenu] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, pipX: 0, pipY: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    isDraggingRef.current = true;
    const { width, height } = PIP_DIMENSIONS[pipSize];
    const currentX = pipPosition ? pipPosition.x : window.innerWidth - width - 24;
    const currentY = pipPosition ? pipPosition.y : window.innerHeight - height - 28;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pipX: currentX,
      pipY: currentY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    const { width, height } = PIP_DIMENSIONS[pipSize];
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.max(12, Math.min(window.innerWidth - width - 12, dragStartRef.current.pipX + dx));
    const newY = Math.max(12, Math.min(window.innerHeight - height - 12, dragStartRef.current.pipY + dy));
    setPipPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  const snapToCorner = (corner: 'br' | 'bl' | 'tr' | 'tl') => {
    const { width, height } = PIP_DIMENSIONS[pipSize];
    const pad = 20;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let newX = vw - width - pad;
    let newY = vh - height - pad;

    if (corner === 'bl') {
      newX = pad;
      newY = vh - height - pad;
    } else if (corner === 'tr') {
      newX = vw - width - pad;
      newY = pad + 64;
    } else if (corner === 'tl') {
      newX = pad;
      newY = pad + 64;
    }

    setPipPosition({ x: Math.max(12, Math.min(newX, vw - width - 12)), y: Math.max(12, Math.min(newY, vh - height - 12)) });
    setShowCornerMenu(false);
  };

  const cyclePipSpeed = () => {
    const currentIndex = SPEED_PRESETS_PIP.findIndex((s) => Math.abs(s - playbackRate) < 0.05);
    const nextIndex = (currentIndex + 1) % SPEED_PRESETS_PIP.length;
    const nextSpeed = SPEED_PRESETS_PIP[nextIndex];
    setPlaybackRate(nextSpeed);
    showToast(`Speed: ${nextSpeed}x`);
  };

  const cyclePipSize = () => {
    const sizes: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
    const next = sizes[(sizes.indexOf(pipSize) + 1) % sizes.length];
    setPipSize(next);
  };

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

  // Keyboard shortcuts (Captions 'C', Transcript 'T', Fullscreen 'F', Mute 'M', PiP 'P')
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
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        collapseActivePlayerToPip();
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        cycleOrientation();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setEnhanceInitialTab('video');
        setShowEnhanceModal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoModalOpen, settings.subtitleSettings, updateSettings, showToast, toggleMute, collapseActivePlayerToPip, cycleOrientation]);

  // Keyboard shortcuts in floating PiP mode
  useEffect(() => {
    if (!isFloatingPipOpen || isVideoModalOpen) return;
    const handlePipKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeFloatingPip(false);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        expandPipToModal();
      }
    };
    window.addEventListener('keydown', handlePipKeyDown);
    return () => window.removeEventListener('keydown', handlePipKeyDown);
  }, [isFloatingPipOpen, isVideoModalOpen, togglePlay, closeFloatingPip, expandPipToModal]);

  const isFullModal = isVideoModalOpen && activeMedia?.mediaType === 'video';
  const isFloating = isFloatingPipOpen && !isVideoModalOpen && activeMedia?.mediaType === 'video';

  if (!activeMedia || activeMedia.mediaType !== 'video' || (!isFullModal && !isFloating)) {
    return null;
  }

  const aspectClass =
    aspectRatio === 'cover'
      ? 'object-cover'
      : aspectRatio === 'fill'
      ? 'object-fill'
      : 'object-contain';

  const videoFilterStyle = useMemo(() => {
    const filters: string[] = [`brightness(${brightness})`];
    if (videoColorSettings?.enabled) {
      if (videoColorSettings.contrast !== 1.0) {
        filters.push(`contrast(${videoColorSettings.contrast})`);
      }
      if (videoColorSettings.saturation !== 1.0) {
        filters.push(`saturate(${videoColorSettings.saturation})`);
      }
      if (videoColorSettings.hue !== 0) {
        filters.push(`hue-rotate(${videoColorSettings.hue}deg)`);
      }
      if (videoColorSettings.warmth > 0) {
        filters.push(`sepia(${videoColorSettings.warmth * 0.7})`);
      }
      if (videoColorSettings.invert) {
        filters.push('invert(1) hue-rotate(180deg)');
      }
      if (videoColorSettings.sharpness) {
        filters.push('contrast(1.08)');
      }
    }
    return filters.join(' ');
  }, [brightness, videoColorSettings]);

  return (
    <div
      ref={containerRef}
      id={isFloating ? "video-floating-pip-window" : "video-player-modal"}
      className={
        isFloating
          ? "fixed z-40 rounded-2xl shadow-2xl overflow-hidden border border-slate-700/70 bg-slate-950/95 backdrop-blur-xl group select-none transition-shadow hover:shadow-black/90 hover:border-slate-500/80 flex items-center justify-center"
          : "fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden transition-all duration-300 ease-out"
      }
      style={
        isFloating
          ? {
              left: pipPosition ? `${pipPosition.x}px` : undefined,
              top: pipPosition ? `${pipPosition.y}px` : undefined,
              right: pipPosition ? undefined : '24px',
              bottom: pipPosition ? undefined : '24px',
              width: `${PIP_DIMENSIONS[pipSize].width}px`,
              height: `${PIP_DIMENSIONS[pipSize].height}px`,
              boxShadow: '0 20px 35px -8px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }
          : visualRotation === 90
          ? {
              position: 'fixed',
              width: '100vh',
              height: '100vw',
              maxWidth: '100vh',
              maxHeight: '100vw',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center center',
            }
          : visualRotation === -90
          ? {
              position: 'fixed',
              width: '100vh',
              height: '100vw',
              maxWidth: '100vh',
              maxHeight: '100vw',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              transformOrigin: 'center center',
            }
          : undefined
      }
      onMouseMove={isFloating ? undefined : resetControlsTimer}
      onMouseEnter={isFloating ? () => setIsPipHovered(true) : undefined}
      onMouseLeave={isFloating ? () => setIsPipHovered(false) : undefined}
    >
      {/* Video Element with native brightness & color enhancement filters */}
      <video
        ref={videoRef}
        src={activeMedia.uri}
        autoPlay
        playsInline
        className={`w-full h-full ${aspectClass} transition-all duration-150 ${isFloating ? 'pointer-events-none' : ''}`}
        style={{
          filter: videoFilterStyle,
        }}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime, e.currentTarget.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
      />

      {/* Floating Picture-in-Picture Controls Overlay */}
      {isFloating && (
        <div
          id="video-pip-overlay"
          className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-auto"
          style={{
            background:
              isPipHovered || !isPlaying
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.9) 100%)'
                : 'transparent',
            transition: 'background 0.2s ease',
          }}
        >
          {/* Top Drag Header */}
          <div
            id="video-pip-drag-header"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`flex items-center justify-between px-2 py-1 rounded-xl transition-opacity duration-200 cursor-grab active:cursor-grabbing ${
              isPipHovered || !isPlaying ? 'opacity-100 bg-slate-900/80 backdrop-blur-md border border-slate-700/50' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2 pointer-events-none">
              <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                Video PiP
              </span>
              <span className="text-xs font-semibold truncate text-white">
                {activeMedia.title}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Snap Corner Button */}
              <div className="relative">
                <button
                  id="video-pip-dock-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCornerMenu(!showCornerMenu);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                  title="Snap to Corner"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                </button>

                {showCornerMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 p-1 rounded-xl shadow-xl border flex gap-1 z-50 bg-slate-900 border-slate-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => snapToCorner('tl')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300"
                      title="Top Left"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => snapToCorner('tr')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300"
                      title="Top Right"
                    >
                      <CornerUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => snapToCorner('bl')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300"
                      title="Bottom Left"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => snapToCorner('br')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300"
                      title="Bottom Right"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Size Toggle */}
              <button
                id="video-pip-size-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  cyclePipSize();
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-300 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Toggle Window Size (SM / MD / LG)"
              >
                {pipSize.toUpperCase()}
              </button>

              {/* Expand to Modal */}
              <button
                id="video-pip-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  expandPipToModal();
                }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Expand to Full Video Player"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Close Button */}
              <button
                id="video-pip-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  closeFloatingPip(true);
                }}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                title="Close Video Player"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center Playback Overlay */}
          <div
            className={`flex items-center justify-center gap-4 transition-opacity duration-200 ${
              isPipHovered || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                seek(Math.max(0, currentTime - 10));
              }}
              className="p-1.5 rounded-full bg-black/60 text-white/90 hover:text-white hover:bg-black/80 hover:scale-110 transition-all cursor-pointer"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              id="video-pip-play-btn"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: themeColors.primary }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                seek(Math.min(duration, currentTime + 10));
              }}
              className="p-1.5 rounded-full bg-black/60 text-white/90 hover:text-white hover:bg-black/80 hover:scale-110 transition-all cursor-pointer"
              title="Forward 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Active Mini Subtitle Cue (if enabled) */}
          {activeCue && settings.subtitleSettings?.enabled && (
            <div className="text-center px-2 py-0.5 pointer-events-none">
              <span className="inline-block px-2 py-0.5 rounded-md bg-black/80 text-[11px] font-medium text-amber-200 shadow-md">
                {activeCue.textEnglish}
              </span>
            </div>
          )}

          {/* Bottom Scrub Bar & Actions */}
          <div
            className={`flex flex-col gap-1 px-1 transition-opacity duration-200 ${
              isPipHovered || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Scrub bar */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const clickPos = (e.clientX - rect.left) / rect.width;
                seek(clickPos * duration);
              }}
              className="relative w-full h-1.5 hover:h-2 bg-white/20 rounded-full cursor-pointer transition-all overflow-hidden"
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  backgroundColor: themeColors.primary,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono">
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cyclePipSpeed();
                  }}
                  className="px-1.5 py-0.5 rounded border border-white/20 hover:border-white/40 text-white cursor-pointer"
                  title="Cycle Playback Speed"
                >
                  {playbackRate}x
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className="p-1 rounded text-slate-300 hover:text-white cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    expandPipToModal();
                  }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white font-sans font-semibold cursor-pointer"
                  title="Expand to Full Player"
                >
                  <span>Expand</span>
                  <Maximize2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Modal Overlays (Gestures, Controls, Dialogs) */}
      {!isFloating && (
        <>

      {/* Modern Touch & Mouse Gestures Overlay (Brightness, Volume, Seek, Double-Tap) */}
      {!isLocked && (settings.gestureSettings?.enabled ?? true) && (
        <VideoGesturesOverlay
          containerRef={containerRef}
          isLocked={isLocked}
          brightness={brightness}
          onBrightnessChange={(val) => {
            setBrightness(val);
            resetControlsTimer();
          }}
          volume={volume}
          onVolumeChange={(val) => {
            setVolume(val);
            resetControlsTimer();
          }}
          isMuted={isMuted}
          onUnmute={() => {
            if (isMuted) toggleMute();
          }}
          currentTime={currentTime}
          duration={duration}
          onSeek={(target) => {
            seek(target);
            resetControlsTimer();
          }}
          onSingleTap={() => {
            setShowControls((prev) => !prev);
            resetControlsTimer();
          }}
          doubleTapSeekSeconds={settings.gestureSettings?.doubleTapSeekSeconds || settings.doubleTapSeek || 10}
          themeColor={themeColors.primary}
          showGestureHints={settings.gestureSettings?.showGestureHints ?? true}
          directIncreaseSystem={settings.gestureSettings?.directIncreaseSystem ?? true}
          rotation={visualRotation}
        />
      )}

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
          id="video-player-controls-overlay"
          className={`absolute inset-0 z-40 flex flex-col justify-between p-4 sm:p-6 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%)' }}
        >
          {/* Top Bar */}
          <div className={`flex items-center justify-between gap-4 ${showControls ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                id="video-player-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  closeVideoModal();
                }}
                className="p-2 rounded-xl bg-black/40 text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Close Player"
              >
                <X className="w-6 h-6" />
              </button>
              <button
                type="button"
                id="video-player-collapse-pip-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  collapseActivePlayerToPip();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-black/40 text-white hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Collapse to Persistent Floating Window (PiP) - Press P"
              >
                <Minimize2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Float (PiP)</span>
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
              {/* Enhancement Suite (Video Color & Audio Boost) */}
              <button
                type="button"
                id="top-enhance-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  resetControlsTimer();
                  setEnhanceInitialTab('video');
                  setShowEnhanceModal(true);
                }}
                className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  (videoColorSettings?.enabled || audioEnhanceSettings?.enabled)
                    ? 'bg-amber-400/25 text-amber-300 border-amber-400/50 shadow-sm'
                    : 'bg-black/40 text-slate-300 hover:text-white border-transparent'
                }`}
                title="Video Color & Audio Enhancement Suite (Contrast, Saturation, Warmth, Volume Boost, Vocal Clarity) - Press E"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Enhance</span>
                {(videoColorSettings?.enabled || audioEnhanceSettings?.enabled) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              {/* Closed Captions CC Toggle */}
              <button
                type="button"
                id="top-subtitles-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  resetControlsTimer();
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
                type="button"
                id="top-transcript-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  resetControlsTimer();
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

              {/* Modern Gestures Guide & Settings */}
              <button
                type="button"
                id="top-gestures-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  resetControlsTimer();
                  setShowGesturesModal(true);
                }}
                className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  settings.gestureSettings?.enabled !== false
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/35'
                    : 'bg-black/40 text-slate-300 hover:text-white border-transparent'
                }`}
                title="Player Gestures: Brightness, Volume & Seek"
              >
                <Sliders className="w-4 h-4" />
                <span className="hidden sm:inline">Gestures</span>
              </button>

              {/* Lock Orientation Toggle Button */}
              <div className="relative">
                <button
                  type="button"
                  id="top-orientation-lock-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    cycleOrientation();
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    resetControlsTimer();
                    setShowOrientationMenu((prev) => !prev);
                  }}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    orientationMode === 'landscape'
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm'
                      : orientationMode === 'portrait'
                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-black/40 text-slate-300 hover:text-white border-transparent'
                  }`}
                  title={`Orientation Lock: ${orientationMode.toUpperCase()} (Click to toggle Landscape / Portrait / Auto, Right-click for menu) - Press O`}
                >
                  {orientationMode === 'landscape' ? (
                    <Monitor className="w-4 h-4 text-emerald-400" />
                  ) : orientationMode === 'portrait' ? (
                    <Smartphone className="w-4 h-4 text-amber-400" />
                  ) : (
                    <RotateCw className="w-4 h-4 text-slate-300" />
                  )}
                  <span className="hidden sm:inline capitalize">
                    {orientationMode === 'auto' ? 'Auto' : orientationMode}
                  </span>
                  {orientationMode !== 'auto' && (
                    <Lock className="w-3 h-3 text-current opacity-80" />
                  )}
                </button>

                {/* Quick orientation selection popover */}
                {showOrientationMenu && (
                  <div
                    id="top-orientation-dropdown"
                    className="absolute right-0 top-11 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 text-xs font-medium backdrop-blur-md min-w-[150px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-white/10">
                      Pin Orientation
                    </div>
                    <button
                      type="button"
                      id="orientation-opt-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrientation('auto');
                        setShowOrientationMenu(false);
                        resetControlsTimer();
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between cursor-pointer ${
                        orientationMode === 'auto' ? 'text-indigo-400 font-bold' : 'text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <RotateCw className="w-3.5 h-3.5" />
                        Auto (Sensor)
                      </span>
                      {orientationMode === 'auto' && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      id="orientation-opt-landscape"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrientation('landscape');
                        setShowOrientationMenu(false);
                        resetControlsTimer();
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between cursor-pointer ${
                        orientationMode === 'landscape' ? 'text-emerald-400 font-bold' : 'text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5" />
                        Pin Landscape
                      </span>
                      {orientationMode === 'landscape' && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      id="orientation-opt-portrait"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrientation('portrait');
                        setShowOrientationMenu(false);
                        resetControlsTimer();
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between cursor-pointer ${
                        orientationMode === 'portrait' ? 'text-amber-400 font-bold' : 'text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5" />
                        Pin Portrait
                      </span>
                      {orientationMode === 'portrait' && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Lock Controls Button */}
              <button
                type="button"
                id="top-lock-btn"
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
                type="button"
                id="top-aspect-ratio-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  resetControlsTimer();
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
                  type="button"
                  id="top-speed-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
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
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaybackRate(rate);
                          setShowSpeedMenu(false);
                          resetControlsTimer();
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
                type="button"
                id="video-player-toggle-pip-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  collapseActivePlayerToPip();
                }}
                className="p-2 rounded-xl bg-black/40 text-white hover:bg-white/20 transition-colors cursor-pointer hidden sm:block"
                title="Collapse to Floating Picture-in-Picture (P)"
              >
                <PictureInPicture className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Play/Pause & Skip Controls */}
          <div className={`flex items-center justify-center gap-6 sm:gap-10 ${showControls ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <button
              type="button"
              id="video-center-prev-btn"
              onClick={(e) => {
                e.stopPropagation();
                resetControlsTimer();
                previousTrack();
              }}
              className="p-3 rounded-full bg-black/40 text-white hover:bg-white/20 hover:scale-110 transition-all cursor-pointer"
              title="Previous Video"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            <button
              type="button"
              id="video-center-rewind-btn"
              onClick={(e) => {
                e.stopPropagation();
                resetControlsTimer();
                seek(currentTime - 10);
                showRipple('left');
              }}
              className="p-3 rounded-full bg-black/40 text-white hover:bg-white/20 hover:scale-110 transition-all cursor-pointer"
              title="-10 Seconds"
            >
              <RotateCcw className="w-6 h-6" />
            </button>

            <button
              type="button"
              id="video-center-play-toggle"
              onClick={(e) => {
                e.stopPropagation();
                resetControlsTimer();
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
              type="button"
              id="video-center-forward-btn"
              onClick={(e) => {
                e.stopPropagation();
                resetControlsTimer();
                seek(currentTime + 10);
                showRipple('right');
              }}
              className="p-3 rounded-full bg-black/40 text-white hover:bg-white/20 hover:scale-110 transition-all cursor-pointer"
              title="+10 Seconds"
            >
              <RotateCw className="w-6 h-6" />
            </button>

            <button
              type="button"
              id="video-center-next-btn"
              onClick={(e) => {
                e.stopPropagation();
                resetControlsTimer();
                nextTrack();
              }}
              className="p-3 rounded-full bg-black/40 text-white hover:bg-white/20 hover:scale-110 transition-all cursor-pointer"
              title="Next Video"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          </div>

          {/* Bottom Bar: Seek Scrubber + Hardware/Audio Controls */}
          <div
            className={`space-y-2 ${showControls ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modern On-Screen Gesture Hint Chip */}
            {settings.gestureSettings?.showGestureHints !== false && (
              <div className="flex justify-center pb-0.5">
                <button
                  type="button"
                  id="bottom-gesture-hints-chip"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    setShowGesturesModal(true);
                  }}
                  className="px-3.5 py-1 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-xl border border-white/15 text-[11px] font-medium text-slate-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-lg group hover:scale-105"
                  title="Touch or Drag: Left half for Brightness, Right half for Volume, Horizontal for Seek. Click for Guide!"
                >
                  <span className="flex items-center gap-1 text-amber-300 font-semibold">
                    <Sun className="w-3 h-3" />
                    <span>Left: Light</span>
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                    <FastForward className="w-3 h-3" />
                    <span>Swipe: Seek</span>
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                    <Volume2 className="w-3 h-3" />
                    <span>Right: Volume</span>
                  </span>
                </button>
              </div>
            )}

            {/* Scrubber */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white tabular-nums w-12 text-right">
                {formatTime(currentTime)}
              </span>

              <div className="relative flex-1 flex items-center group/scrubber cursor-pointer">
                <input
                  id="video-scrubber-slider"
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => {
                    seek(parseFloat(e.target.value));
                    resetControlsTimer();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
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
                  <button
                    type="button"
                    id="video-volume-mute-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      toggleMute();
                    }}
                    className="hover:text-slate-300 cursor-pointer"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    id="video-volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      resetControlsTimer();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-16 sm:w-24 h-1 rounded bg-white/30 cursor-pointer accent-white"
                  />
                </div>

                {/* Brightness Module Simulation Slider */}
                <div className="hidden sm:flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-300" />
                  <input
                    id="video-brightness-slider"
                    type="range"
                    min="0.3"
                    max="1.8"
                    step="0.05"
                    value={brightness}
                    onChange={(e) => {
                      setBrightness(parseFloat(e.target.value));
                      resetControlsTimer();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-16 sm:w-20 h-1 rounded bg-white/30 cursor-pointer accent-amber-300"
                    title={`Brightness: ${Math.round(brightness * 100)}%`}
                  />
                </div>
              </div>

              {/* Right Controls: Subtitles CC, Transcript, Fullscreen */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="bottom-subtitles-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
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
                  type="button"
                  id="bottom-transcript-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    setShowTranscript(true);
                  }}
                  className="px-2 py-1 rounded-lg bg-black/40 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 border border-white/10"
                  title="Open Transcript - Press T"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Transcript</span>
                </button>

                {/* Video Color & Audio Enhancement Suite Button */}
                <button
                  type="button"
                  id="bottom-enhance-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    setEnhanceInitialTab('video');
                    setShowEnhanceModal(true);
                  }}
                  className={`px-2 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    (videoColorSettings?.enabled || audioEnhanceSettings?.enabled)
                      ? 'bg-amber-400/25 text-amber-300 border-amber-400/40 shadow-sm'
                      : 'bg-black/40 text-slate-400 hover:text-white border-transparent'
                  }`}
                  title="Video Color & Audio Enhancement (E)"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Enhance</span>
                </button>

                {/* Orientation Lock Toggle Button */}
                <button
                  type="button"
                  id="video-orientation-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    cycleOrientation();
                  }}
                  className={`px-2 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    orientationMode === 'landscape'
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm'
                      : orientationMode === 'portrait'
                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-black/40 text-slate-300 hover:text-white border-white/10'
                  }`}
                  title={`Orientation Lock: ${orientationMode.toUpperCase()} (Toggle Landscape / Portrait / Auto) - Press O`}
                >
                  {orientationMode === 'landscape' ? (
                    <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                  ) : orientationMode === 'portrait' ? (
                    <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span className="hidden sm:inline capitalize">
                    {orientationMode === 'auto' ? 'Orientation' : orientationMode}
                  </span>
                  {orientationMode !== 'auto' && (
                    <Lock className="w-2.5 h-2.5 text-current opacity-80" />
                  )}
                </button>

                {/* Fullscreen Button */}
                <button
                  type="button"
                  id="video-fullscreen-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    toggleFullscreen();
                  }}
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

      {/* Modern Gestures Guide & Settings Modal */}
      {showGesturesModal && (
        <VideoGesturesModal
          isOpen={showGesturesModal}
          onClose={() => setShowGesturesModal(false)}
          gestureSettings={settings.gestureSettings}
          onUpdateGestureSettings={(partial) => {
            updateSettings({
              gestureSettings: {
                ...settings.gestureSettings,
                ...partial,
              },
            });
          }}
          themeColors={themeColors}
          isDark={isDark}
          onShowToast={showToast}
        />
      )}

      {/* Video Color & Audio Enhancement Suite Modal */}
      {showEnhanceModal && (
        <EnhancementModal
          isOpen={showEnhanceModal}
          onClose={() => setShowEnhanceModal(false)}
          initialTab={enhanceInitialTab}
        />
      )}
        </>
      )}
    </div>
  );
}
