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
  Subtitles,
  FileText,
  Sliders,
  FastForward,
  Smartphone,
  Monitor,
  Check,
  MoreVertical,
  ListVideo,
  Moon,
  Camera,
  RotateCcw as ResetIcon,
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
import { VideoQuickActionsSheet } from './VideoQuickActionsSheet';
import { VideoQueueDrawer } from './VideoQueueDrawer';
import { VideoPropertiesModal } from './VideoPropertiesModal';
import { SleepTimerModal } from './SleepTimerModal';

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
    loopMode,
    setLoopMode,
    queue,
    queueIndex,
    playMedia,
    removeFromQueue,
    moveQueueItem,
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
    nightModeEnabled,
    toggleNightMode,
    cycleVolumeBoost,
    decoderProfile,
    cycleDecoderProfile,
    autoPlayNext,
    setAutoPlayNext,
    autoNextCountdownSeconds,
    setAutoNextCountdownSeconds,
    sleepTimerRemaining,
    sleepTimerEndTrack,
    resumeCandidatePosition,
    clearResumeCandidate,
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

  // MX Player modernized sheets & playback states
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [abLoop, setAbLoop] = useState<{ a: number | null; b: number | null; active: boolean }>({
    a: null,
    b: null,
    active: false,
  });
  const [liveDimensions, setLiveDimensions] = useState<{ width: number; height: number } | null>(null);
  const [autoNextCancelled, setAutoNextCancelled] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [scrubberHover, setScrubberHover] = useState<{
    time: number;
    percent: number;
  } | null>(null);

  const savedSpeedBeforeRampRef = useRef<number>(1);
  const screenshotTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumeAutoDismissRef = useRef<NodeJS.Timeout | null>(null);

  // Reset per-video transient states on track change
  useEffect(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setAbLoop({ a: null, b: null, active: false });
    setAutoNextCancelled(false);
    setLiveDimensions(null);
  }, [activeMedia?.id]);

  // Auto-dismiss Resume Prompt after 7 seconds if untouched
  useEffect(() => {
    if (resumeAutoDismissRef.current) clearTimeout(resumeAutoDismissRef.current);
    if (resumeCandidatePosition !== null && isVideoModalOpen) {
      resumeAutoDismissRef.current = setTimeout(() => {
        clearResumeCandidate();
      }, 7000);
    }
    return () => {
      if (resumeAutoDismissRef.current) clearTimeout(resumeAutoDismissRef.current);
    };
  }, [resumeCandidatePosition, isVideoModalOpen, clearResumeCandidate]);

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
          if (showQuickActions) {
            setShowQuickActions(false);
          } else if (showQueueDrawer) {
            setShowQueueDrawer(false);
          } else if (showPropertiesModal) {
            setShowPropertiesModal(false);
          } else if (showSleepTimerModal) {
            setShowSleepTimerModal(false);
          } else if (showTranscript) {
            setShowTranscript(false);
          } else if (showGesturesModal) {
            setShowGesturesModal(false);
          } else if (showGesturesHelpOverlay) {
            setShowGesturesHelpOverlay(false);
          } else if (showEnhanceModal) {
            setShowEnhanceModal(false);
          } else if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else {
            closeVideoModal();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isVideoModalOpen,
    isLocked,
    isFullscreen,
    showQuickActions,
    showQueueDrawer,
    showPropertiesModal,
    showSleepTimerModal,
    showTranscript,
    showGesturesModal,
    showGesturesHelpOverlay,
    showEnhanceModal,
    currentTime,
    volume,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    closeVideoModal,
    resetControlsTimer,
  ]);

  const showRipple = (side: 'left' | 'right') => {
    setDoubleTapRipple(side);
    setTimeout(() => setDoubleTapRipple(null), 600);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const cycleLoopMode = useCallback(() => {
    const order = ['none', 'one', 'all'] as const;
    const next = order[(order.indexOf(loopMode) + 1) % order.length];
    setLoopMode(next);
    showToast(next === 'one' ? 'Loop: Current video' : next === 'all' ? 'Loop: All queue' : 'Loop: Off');
  }, [loopMode, setLoopMode, showToast]);

  const handleABRepeatAction = useCallback(() => {
    if (abLoop.a === null) {
      setAbLoop({ a: currentTime, b: null, active: false });
      showToast(`Point A set at ${formatTime(currentTime)}`);
    } else if (abLoop.b === null) {
      if (currentTime <= abLoop.a + 0.5) {
        showToast('Point B must be after Point A');
        return;
      }
      setAbLoop({ a: abLoop.a, b: currentTime, active: true });
      seek(abLoop.a);
      showToast(`A-B Loop: ${formatTime(abLoop.a)} – ${formatTime(currentTime)}`);
    } else {
      setAbLoop({ a: null, b: null, active: false });
      showToast('A-B Loop cleared');
    }
  }, [abLoop, currentTime, seek, showToast]);

  const clearABRepeat = useCallback(() => {
    setAbLoop({ a: null, b: null, active: false });
    showToast('A-B Loop cleared');
  }, [showToast]);

  const handleCaptureScreenshot = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !activeMedia) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth || 1280;
      canvas.height = videoEl.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        showToast('Canvas context unavailable');
        return;
      }
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setScreenshotPreview(dataUrl);
      if (screenshotTimeoutRef.current) clearTimeout(screenshotTimeoutRef.current);
      screenshotTimeoutRef.current = setTimeout(() => setScreenshotPreview(null), 3500);

      const link = document.createElement('a');
      const safeTitle = activeMedia.title.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 32);
      link.download = `${safeTitle}_${Math.floor(currentTime)}s.png`;
      link.href = dataUrl;
      link.click();
      showToast('Screenshot saved');
    } catch {
      showToast('Screenshot blocked by remote stream CORS policy');
    }
  }, [videoRef, activeMedia, currentTime, showToast]);

  const handleResetZoom = useCallback(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    showToast('Zoom reset to 1.0x');
  }, [showToast]);

  // Keyboard shortcuts (Captions 'C', Transcript 'T', Fullscreen 'F', Mute 'M', PiP 'P', Queue 'Q', Night 'N', Props 'I', Shot 'S', A-B 'A'/'B')
  useEffect(() => {
    if (!isVideoModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (isLocked) {
        if (e.key === 'l' || e.key === 'L') {
          setIsLocked(false);
          setShowControls(true);
        }
        return;
      }

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
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setShowQueueDrawer((prev) => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        toggleNightMode();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowPropertiesModal((prev) => !prev);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleCaptureScreenshot();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setIsLocked(true);
        setShowControls(false);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleABRepeatAction();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowGesturesModal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isVideoModalOpen,
    isLocked,
    settings.subtitleSettings,
    updateSettings,
    showToast,
    toggleMute,
    collapseActivePlayerToPip,
    cycleOrientation,
    toggleNightMode,
    handleCaptureScreenshot,
    handleABRepeatAction,
  ]);

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

  const videoFilterStyle = useMemo(() => {
    const filters: string[] = [`brightness(${brightness})`];
    if (decoderProfile === 'sw') {
      filters.push('contrast(1.06)', 'saturate(1.04)');
    }
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
  }, [brightness, decoderProfile, videoColorSettings]);

  const nextQueueItem = useMemo(() => {
    if (queue.length === 0) return null;
    if (queueIndex + 1 < queue.length) return queue[queueIndex + 1];
    if (loopMode === 'all' && queue.length > 1) return queue[0];
    return null;
  }, [queue, queueIndex, loopMode]);

  const countdownLimit = Math.max(1, Math.min(15, autoNextCountdownSeconds || 5));

  const autoNextRemaining =
    duration > countdownLimit + 1 && currentTime > 0
      ? Math.max(0, Math.ceil(duration - currentTime))
      : null;

  const showAutoNextOverlay =
    isFullModal &&
    autoPlayNext &&
    loopMode !== 'one' &&
    !autoNextCancelled &&
    nextQueueItem !== null &&
    autoNextRemaining !== null &&
    autoNextRemaining <= countdownLimit &&
    autoNextRemaining >= 1;

  if (!activeMedia || activeMedia.mediaType !== 'video' || (!isFullModal && !isFloating)) {
    return null;
  }

  const aspectClass =
    aspectRatio === 'cover'
      ? 'object-cover'
      : aspectRatio === 'fill'
      ? 'object-fill'
      : 'object-contain';

  const volumeBoostPercent = audioEnhanceSettings?.enabled
    ? audioEnhanceSettings?.volumeBoost || 100
    : 100;

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
      {/* Video Transform Wrapper (Zoom 1x-3x & Pan + Brightness & Color Filters) */}
      <div
        className={`w-full h-full flex items-center justify-center ${isFloating ? 'pointer-events-none' : ''}`}
        style={
          !isFloating && (zoomScale > 1.01 || panOffset.x !== 0 || panOffset.y !== 0)
            ? {
                transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
                transition: 'transform 60ms linear',
              }
            : undefined
        }
      >
        <video
          ref={videoRef}
          src={activeMedia.uri}
          crossOrigin="anonymous"
          autoPlay
          playsInline
          className={`w-full h-full ${aspectClass} transition-all duration-150 ${isFloating ? 'pointer-events-none' : ''}`}
          style={{
            filter: videoFilterStyle,
          }}
          onLoadedMetadata={(e) => {
            setLiveDimensions({
              width: e.currentTarget.videoWidth,
              height: e.currentTarget.videoHeight,
            });
          }}
          onTimeUpdate={(e) => {
            const cur = e.currentTarget.currentTime;
            const tot = e.currentTarget.duration;
            onTimeUpdate(cur, tot);
            if (abLoop.active && abLoop.a !== null && abLoop.b !== null && cur >= abLoop.b) {
              seek(abLoop.a);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            if (loopMode === 'one') {
              onEnded();
              return;
            }
            if (autoNextCancelled || !autoPlayNext) {
              setIsPlaying(false);
              return;
            }
            onEnded();
          }}
        />
      </div>

      {/* Night Mode Soft Warm-Dim Overlay */}
      {!isFloating && nightModeEnabled && (
        <div
          id="video-night-mode-overlay"
          className="absolute inset-0 z-10 pointer-events-none bg-amber-950/35 mix-blend-multiply transition-opacity duration-200"
        />
      )}

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
          {/* Unified MX Gesture Surface (32/36/32 zones, 650ms 2x ramp, pinch zoom, edge HUDs) */}
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
              volumeBoost={volumeBoostPercent}
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
              gestureSettings={settings.gestureSettings}
              zoomScale={zoomScale}
              panOffset={panOffset}
              onZoomChange={(nextScale, nextPan) => {
                setZoomScale(nextScale);
                setPanOffset(nextPan);
              }}
              onTempSpeedStart={() => {
                savedSpeedBeforeRampRef.current = playbackRate;
                setPlaybackRate(2.0);
              }}
              onTempSpeedEnd={() => {
                setPlaybackRate(savedSpeedBeforeRampRef.current || 1.0);
              }}
            />
          )}

          {/* Double tap ripple indicators (for keyboard / button skips) */}
          {doubleTapRipple === 'left' && (
            <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 bg-slate-950/80 backdrop-blur-xl border border-white/15 px-5 py-3.5 rounded-3xl z-30">
              <RotateCcw className="w-7 h-7 text-amber-300" />
              <span className="text-xs font-bold font-mono tabular-nums text-white">-10s</span>
            </div>
          )}
          {doubleTapRipple === 'right' && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 bg-slate-950/80 backdrop-blur-xl border border-white/15 px-5 py-3.5 rounded-3xl z-30">
              <RotateCw className="w-7 h-7 text-sky-300" />
              <span className="text-xs font-bold font-mono tabular-nums text-white">+10s</span>
            </div>
          )}

          {/* Closed Captions & Subtitles Overlay */}
          <VideoCaptionOverlay
            cue={activeCue}
            settings={settings.subtitleSettings}
            controlsVisible={showControls}
          />

          {/* Screenshot Captured Preview Card */}
          {screenshotPreview && (
            <div
              id="video-screenshot-preview"
              className="absolute top-20 right-6 z-[45] w-44 rounded-2xl overflow-hidden bg-slate-950/90 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 pointer-events-auto"
            >
              <img
                src={screenshotPreview}
                alt="Captured video frame"
                className="w-full h-24 object-cover rounded-xl"
              />
              <div className="px-1.5 py-1 flex items-center justify-between text-[11px] text-slate-200">
                <span className="flex items-center gap-1 font-medium">
                  <Camera className="w-3 h-3 text-emerald-400" />
                  <span>Frame saved</span>
                </span>
                <button
                  type="button"
                  onClick={() => setScreenshotPreview(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Resume Playback Prompt */}
          {!isLocked && resumeCandidatePosition !== null && (
            <div
              id="video-resume-prompt"
              className="absolute bottom-32 sm:bottom-28 left-4 sm:left-6 z-[45] bg-slate-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs">
                <p className="font-semibold text-white">
                  Resume from <span className="font-mono tabular-nums text-amber-300">{formatTime(resumeCandidatePosition)}</span>?
                </p>
                <p className="text-[11px] text-slate-400">Saved playback position</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="resume-confirm-btn"
                  onClick={() => {
                    seek(resumeCandidatePosition);
                    clearResumeCandidate();
                    showToast(`Resumed at ${formatTime(resumeCandidatePosition)}`);
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  Resume
                </button>
                <button
                  type="button"
                  id="resume-restart-btn"
                  onClick={() => {
                    seek(0);
                    clearResumeCandidate();
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {/* 5-Second Auto-Next Countdown Overlay */}
          {!isLocked && showAutoNextOverlay && nextQueueItem && autoNextRemaining !== null && (
            <div
              id="video-autonext-overlay"
              className="absolute bottom-32 sm:bottom-28 right-4 sm:right-6 z-[45] w-72 bg-slate-950/92 backdrop-blur-2xl border border-white/15 rounded-2xl p-3.5 shadow-2xl space-y-2.5 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Up Next</span>
                <span className="font-mono tabular-nums font-semibold text-amber-300">
                  Playing in {autoNextRemaining}s
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {nextQueueItem.thumbnail && (
                  <img
                    src={nextQueueItem.thumbnail}
                    alt={nextQueueItem.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-9 rounded-lg object-cover shrink-0 border border-white/10"
                  />
                )}
                <p className="text-xs font-semibold text-white truncate flex-1">
                  {nextQueueItem.title}
                </p>
              </div>
              <div className="w-full h-1 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${((countdownLimit - autoNextRemaining) / countdownLimit) * 100}%`,
                    backgroundColor: themeColors.primary,
                  }}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  id="autonext-cancel-btn"
                  onClick={() => setAutoNextCancelled(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="autonext-play-now-btn"
                  onClick={() => nextTrack()}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  Play Now
                </button>
              </div>
            </div>
          )}

          {/* Screen Lock Capsule OR Full Controls Overlay */}
          {isLocked ? (
            <button
              type="button"
              id="video-unlock-capsule-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsLocked(false);
                setShowControls(true);
              }}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-50 min-h-[44px] px-4 py-2 rounded-full bg-slate-950/85 backdrop-blur-xl text-amber-300 border border-amber-400/40 hover:bg-slate-900 cursor-pointer shadow-2xl flex items-center gap-2 text-xs font-semibold whitespace-nowrap"
            >
              <Lock className="w-4 h-4" />
              <span>Screen Locked · Tap to Unlock</span>
            </button>
          ) : (
            <div
              id="video-player-controls-overlay"
              className={`absolute inset-0 z-40 flex flex-col justify-between p-4 sm:p-6 transition-opacity duration-200 pointer-events-none ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background:
                  'linear-gradient(to bottom, rgba(6,7,11,0.82) 0%, rgba(6,7,11,0.18) 22%, transparent 50%, rgba(6,7,11,0.28) 76%, rgba(6,7,11,0.88) 100%)',
              }}
            >
              {/* Sleek Top Bar */}
              <div className={`flex items-center justify-between gap-3 ${showControls ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    id="video-player-close-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeVideoModal();
                    }}
                    aria-label="Close Video Player"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-950/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
                    title="Close Player"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    id="video-player-collapse-pip-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      collapseActivePlayerToPip();
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-slate-950/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0"
                    title="Float Picture-in-Picture (P)"
                  >
                    <Minimize2 className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Float</span>
                  </button>

                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-white truncate max-w-md sm:max-w-xl">
                      {activeMedia.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate">
                      <span>{activeMedia.folder || 'Library'}</span>
                      {(liveDimensions || activeMedia.resolution) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {liveDimensions && liveDimensions.width > 0
                              ? `${liveDimensions.height}p`
                              : activeMedia.resolution}
                          </span>
                        </>
                      )}
                      {nightModeEnabled && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-300">Night</span>
                        </>
                      )}
                      {zoomScale > 1.02 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-emerald-300">{zoomScale.toFixed(1)}x Zoom</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Right Essential Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {zoomScale > 1.02 && (
                    <button
                      type="button"
                      id="top-zoom-reset-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetZoom();
                      }}
                      className="min-h-[44px] px-3 rounded-xl bg-slate-950/65 backdrop-blur-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/20 text-xs font-mono font-semibold cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      title="Reset Video Zoom"
                    >
                      <ResetIcon className="w-3.5 h-3.5" />
                      <span>1.0x</span>
                    </button>
                  )}

                  {/* Playback Speed Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      id="top-speed-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetControlsTimer();
                        setShowSpeedMenu(!showSpeedMenu);
                      }}
                      className="min-h-[44px] px-3 rounded-xl bg-slate-950/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono font-semibold whitespace-nowrap shrink-0"
                      title="Playback Speed"
                    >
                      <Gauge className="w-4 h-4" />
                      <span>{playbackRate}x</span>
                    </button>

                    {showSpeedMenu && (
                      <div
                        className="absolute right-0 top-12 bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl py-1.5 z-50 text-xs font-medium backdrop-blur-xl min-w-[120px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaybackRate(rate);
                              setShowSpeedMenu(false);
                              resetControlsTimer();
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-white/10 font-mono flex items-center justify-between cursor-pointer ${
                              playbackRate === rate ? 'text-indigo-400 font-bold' : 'text-white'
                            }`}
                          >
                            <span>{rate}x</span>
                            {playbackRate === rate && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Aspect Ratio / Content Fit */}
                  <button
                    type="button"
                    id="top-aspect-ratio-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      const modes: ('contain' | 'cover' | 'fill')[] = ['contain', 'cover', 'fill'];
                      const next = modes[(modes.indexOf(aspectRatio) + 1) % modes.length];
                      setAspectRatio(next);
                      showToast(`Fit: ${next === 'contain' ? 'Fit Screen' : next === 'cover' ? 'Crop Fill' : 'Stretch'}`);
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-slate-950/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0"
                    title={`Content Fit: ${aspectRatio}`}
                  >
                    <Scan className="w-4 h-4" />
                    <span className="capitalize hidden md:inline">{aspectRatio === 'contain' ? 'Fit' : aspectRatio === 'cover' ? 'Crop' : 'Stretch'}</span>
                  </button>

                  {/* Orientation Lock */}
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
                      className={`min-h-[44px] px-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 backdrop-blur-md ${
                        orientationMode === 'landscape'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : orientationMode === 'portrait'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950/60 text-slate-200 hover:bg-white/15 border-white/10'
                      }`}
                      title={`Orientation: ${orientationMode} (Click to cycle, Right-click menu) - Press O`}
                    >
                      {orientationMode === 'landscape' ? (
                        <Monitor className="w-4 h-4" />
                      ) : orientationMode === 'portrait' ? (
                        <Smartphone className="w-4 h-4" />
                      ) : (
                        <RotateCw className="w-4 h-4" />
                      )}
                      <span className="hidden lg:inline capitalize">{orientationMode}</span>
                    </button>

                    {showOrientationMenu && (
                      <div
                        id="top-orientation-dropdown"
                        className="absolute right-0 top-12 bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl py-1.5 z-50 text-xs font-medium backdrop-blur-xl min-w-[155px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 border-b border-white/10">
                          Orientation
                        </div>
                        {(['auto', 'landscape', 'portrait'] as OrientationLockMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            id={`orientation-opt-${mode}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrientation(mode);
                              setShowOrientationMenu(false);
                              resetControlsTimer();
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between cursor-pointer capitalize ${
                              orientationMode === mode ? 'text-indigo-400 font-semibold' : 'text-slate-200'
                            }`}
                          >
                            <span>{mode === 'auto' ? 'Auto Sensor' : `Pin ${mode}`}</span>
                            {orientationMode === mode && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions Trigger */}
                  <button
                    type="button"
                    id="top-quick-actions-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      setShowQuickActions(true);
                    }}
                    aria-label="Open Quick Actions"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-950/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
                    title="Quick Actions (Boost, Loop, Night Mode, Screenshot, A-B Repeat)"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Center Play/Pause & Skip Controls */}
              <div className={`flex items-center justify-center gap-5 sm:gap-9 ${showControls ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <button
                  type="button"
                  id="video-center-prev-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    previousTrack();
                  }}
                  aria-label="Previous Video"
                  className="min-h-[44px] min-w-[44px] p-3 rounded-full bg-slate-950/55 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:scale-105 transition-all cursor-pointer"
                  title="Previous Video"
                >
                  <SkipBack className="w-5 h-5 sm:w-6 sm:h-6" />
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
                  aria-label="Rewind 10 seconds"
                  className="min-h-[44px] min-w-[44px] p-3 rounded-full bg-slate-950/55 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:scale-105 transition-all cursor-pointer"
                  title="-10 Seconds"
                >
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                  type="button"
                  id="video-center-play-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    togglePlay();
                  }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  style={{ backgroundColor: themeColors.primary }}
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 sm:w-9 sm:h-9 fill-white" />
                  ) : (
                    <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-white ml-1" />
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
                  aria-label="Forward 10 seconds"
                  className="min-h-[44px] min-w-[44px] p-3 rounded-full bg-slate-950/55 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:scale-105 transition-all cursor-pointer"
                  title="+10 Seconds"
                >
                  <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                  type="button"
                  id="video-center-next-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    nextTrack();
                  }}
                  aria-label="Next Video"
                  className="min-h-[44px] min-w-[44px] p-3 rounded-full bg-slate-950/55 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 hover:scale-105 transition-all cursor-pointer"
                  title="Next Video"
                >
                  <SkipForward className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Sleek Glassmorphic Bottom Bar */}
              <div
                className={`rounded-2xl bg-slate-950/75 backdrop-blur-xl border border-white/10 px-3.5 sm:px-4 py-2.5 space-y-2 ${
                  showControls ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Scrubber Row with Hover Timestamp Preview & A-B Repeat Pins */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-semibold text-white tabular-nums w-12 text-right shrink-0">
                    {formatTime(currentTime)}
                  </span>

                  <div
                    className="relative flex-1 h-6 flex items-center group/scrubber cursor-pointer"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      setScrubberHover({
                        time: pct * (duration || 0),
                        percent: pct * 100,
                      });
                    }}
                    onMouseLeave={() => setScrubberHover(null)}
                  >
                    {/* Hover Timestamp Preview Tooltip */}
                    {scrubberHover && duration > 0 && (
                      <div
                        id="scrubber-hover-tooltip"
                        className="absolute -top-9 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-950/95 border border-white/15 shadow-xl text-[11px] font-mono tabular-nums text-white pointer-events-none whitespace-nowrap z-20"
                        style={{ left: `${scrubberHover.percent}%` }}
                      >
                        <span>{formatTime(scrubberHover.time)}</span>
                      </div>
                    )}

                    {/* A-B Segment Highlight Bar */}
                    {duration > 0 && abLoop.a !== null && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-emerald-400/35 pointer-events-none z-0"
                        style={{
                          left: `${(abLoop.a / duration) * 100}%`,
                          width:
                            abLoop.b !== null
                              ? `${Math.max(0, ((abLoop.b - abLoop.a) / duration) * 100)}%`
                              : '2px',
                        }}
                      />
                    )}

                    {/* Point A & B Pins */}
                    {duration > 0 && abLoop.a !== null && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950 pointer-events-none z-10"
                        style={{ left: `${(abLoop.a / duration) * 100}%` }}
                        title={`Point A: ${formatTime(abLoop.a)}`}
                      />
                    )}
                    {duration > 0 && abLoop.b !== null && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-300 border border-slate-950 pointer-events-none z-10"
                        style={{ left: `${(abLoop.b / duration) * 100}%` }}
                        title={`Point B: ${formatTime(abLoop.b)}`}
                      />
                    )}

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
                      className="relative z-10 w-full h-1.5 group-hover/scrubber:h-2 rounded-lg appearance-none bg-white/25 cursor-pointer transition-all"
                      style={{ accentColor: themeColors.primary }}
                    />
                  </div>

                  <span className="text-xs font-mono font-semibold text-slate-300 tabular-nums w-12 shrink-0">
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Bottom Utility Controls Row */}
                <div className="flex items-center justify-between gap-2 text-white text-xs">
                  {/* Left: Lock, Volume, Brightness */}
                  <div className="flex items-center gap-2 sm:gap-4">
                    <button
                      type="button"
                      id="bottom-lock-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLocked(true);
                        setShowControls(false);
                      }}
                      aria-label="Lock Screen Controls"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="Lock Controls (L)"
                    >
                      <Unlock className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="video-volume-mute-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetControlsTimer();
                          toggleMute();
                        }}
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 cursor-pointer"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-sky-300" />
                        )}
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
                        className="w-16 sm:w-20 h-1 rounded bg-white/30 cursor-pointer accent-sky-400 hidden sm:block"
                      />
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-300" />
                      <input
                        id="video-brightness-slider"
                        type="range"
                        min="0.25"
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
                        title={`Brightness: ${Math.round(((brightness - 0.25) / (1.8 - 0.25)) * 100)}%`}
                      />
                    </div>
                  </div>

                  {/* Right: CC, Transcript, Night, Up Next Queue, Quick Actions, Fullscreen */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
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
                      className={`min-h-[44px] px-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        settings.subtitleSettings.enabled
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                      title="Subtitles (C)"
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
                      className="min-h-[44px] px-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      title="Transcript (T)"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden lg:inline">Transcript</span>
                    </button>

                    <button
                      type="button"
                      id="bottom-night-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetControlsTimer();
                        toggleNightMode();
                      }}
                      aria-label="Toggle Night Mode"
                      className={`min-h-[44px] px-2.5 rounded-xl transition-colors cursor-pointer hidden sm:flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        nightModeEnabled
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                      title="Night Mode (N)"
                    >
                      <Moon className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      id="bottom-queue-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetControlsTimer();
                        setShowQueueDrawer(true);
                      }}
                      className="min-h-[44px] px-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      title="Up Next Queue (Q)"
                    >
                      <ListVideo className="w-4 h-4" />
                      <span className="hidden md:inline">Up Next</span>
                    </button>

                    <button
                      type="button"
                      id="bottom-quick-actions-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetControlsTimer();
                        setShowQuickActions(true);
                      }}
                      className="min-h-[44px] px-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      title="Quick Actions (Boost, A-B Repeat, Sleep, Screenshot)"
                    >
                      <Sliders className="w-4 h-4" />
                      <span className="hidden md:inline">Actions</span>
                    </button>

                    <button
                      type="button"
                      id="video-fullscreen-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetControlsTimer();
                        toggleFullscreen();
                      }}
                      aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                    >
                      {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MX Player Quick Actions Sheet */}
          <VideoQuickActionsSheet
            isOpen={showQuickActions}
            onClose={() => setShowQuickActions(false)}
            themeColor={themeColors.primary}
            volumeBoost={volumeBoostPercent}
            onCycleVolumeBoost={cycleVolumeBoost}
            loopMode={loopMode}
            onCycleLoopMode={cycleLoopMode}
            nightModeEnabled={nightModeEnabled}
            onToggleNightMode={toggleNightMode}
            abLoop={abLoop}
            onABRepeatAction={handleABRepeatAction}
            onClearABRepeat={clearABRepeat}
            sleepTimerRemaining={sleepTimerRemaining}
            sleepTimerEndTrack={sleepTimerEndTrack}
            onOpenSleepTimer={() => setShowSleepTimerModal(true)}
            onCaptureScreenshot={handleCaptureScreenshot}
            decoderProfile={decoderProfile}
            onCycleDecoderProfile={cycleDecoderProfile}
            zoomScale={zoomScale}
            onResetZoom={handleResetZoom}
            onOpenEnhance={() => {
              setEnhanceInitialTab('video');
              setShowEnhanceModal(true);
            }}
            onOpenProperties={() => setShowPropertiesModal(true)}
            onOpenGestures={() => setShowGesturesModal(true)}
            subtitlesEnabled={settings.subtitleSettings.enabled}
            onToggleSubtitles={() => {
              const next = !settings.subtitleSettings.enabled;
              updateSettings({
                subtitleSettings: { ...settings.subtitleSettings, enabled: next },
              });
              showToast(next ? 'Subtitles (CC) enabled' : 'Subtitles (CC) disabled');
            }}
          />

          {/* Up Next Queue Drawer */}
          <VideoQueueDrawer
            isOpen={showQueueDrawer}
            onClose={() => setShowQueueDrawer(false)}
            queue={queue}
            queueIndex={queueIndex}
            activeMediaId={activeMedia.id}
            autoPlayNext={autoPlayNext}
            onToggleAutoPlayNext={setAutoPlayNext}
            onSelectTrack={(item) => {
              playMedia(item, queue, true);
              setShowQueueDrawer(false);
            }}
            onRemoveFromQueue={removeFromQueue}
            onMoveQueueItem={moveQueueItem}
            themeColor={themeColors.primary}
          />

          {/* Video Properties Modal */}
          <VideoPropertiesModal
            isOpen={showPropertiesModal}
            onClose={() => setShowPropertiesModal(false)}
            media={activeMedia}
            liveDimensions={liveDimensions}
            currentTime={currentTime}
            duration={duration}
            decoderProfile={decoderProfile}
            autoPlayNext={autoPlayNext}
            onToggleAutoPlayNext={setAutoPlayNext}
            autoNextCountdownSeconds={countdownLimit}
            onChangeAutoNextCountdown={setAutoNextCountdownSeconds}
          />

          {/* Sleep Timer Modal */}
          <SleepTimerModal
            isOpen={showSleepTimerModal}
            onClose={() => setShowSleepTimerModal(false)}
          />

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
              onLaunchLiveOverlay={() => setShowGesturesHelpOverlay(true)}
            />
          )}

          {/* Live Gesture Onboarding Overlay */}
          {showGesturesHelpOverlay && (
            <VideoGesturesHelpOverlay
              isOpen={showGesturesHelpOverlay}
              onClose={() => setShowGesturesHelpOverlay(false)}
              onOpenPlayground={() => setShowGesturesModal(true)}
              themeColor={themeColors.primary}
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
