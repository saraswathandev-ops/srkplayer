import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sun,
  SunMedium,
  SunDim,
  Moon,
  Volume2,
  Volume1,
  Volume,
  VolumeX,
  FastForward,
  Rewind,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
} from 'lucide-react';
import { formatTime } from '../utils/formatters';

interface VideoGesturesOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isLocked: boolean;
  brightness: number;
  onBrightnessChange: (val: number) => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  isMuted: boolean;
  onUnmute?: () => void;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onSingleTap: () => void;
  doubleTapSeekSeconds?: number;
  themeColor?: string;
  showGestureHints?: boolean;
}

type GestureMode = 'none' | 'brightness' | 'volume' | 'seek';

export function VideoGesturesOverlay({
  containerRef,
  isLocked,
  brightness,
  onBrightnessChange,
  volume,
  onVolumeChange,
  isMuted,
  onUnmute,
  currentTime,
  duration,
  onSeek,
  onSingleTap,
  doubleTapSeekSeconds = 10,
  themeColor = '#6E60FF',
  showGestureHints = true,
}: VideoGesturesOverlayProps) {
  const [activeGesture, setActiveGesture] = useState<GestureMode>('none');
  const [hudVisible, setHudVisible] = useState(false);
  const [seekData, setSeekData] = useState<{
    targetTime: number;
    deltaSeconds: number;
    initialTime: number;
  } | null>(null);

  // Modern double-tap ripples
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const [doubleTapCount, setDoubleTapCount] = useState(1);

  // Gesture tracking refs
  const pointerActiveRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const initialBrightnessRef = useRef(brightness);
  const initialVolumeRef = useRef(volume);
  const initialCurrentTimeRef = useRef(currentTime);
  const gestureModeRef = useRef<GestureMode>('none');
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapXRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearHudTimer = () => {
    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current);
      hudTimeoutRef.current = null;
    }
  };

  const scheduleHudHide = (delay = 700) => {
    clearHudTimer();
    hudTimeoutRef.current = setTimeout(() => {
      setHudVisible(false);
      setActiveGesture('none');
      setSeekData(null);
      gestureModeRef.current = 'none';
    }, delay);
  };

  // Keep initial refs updated when idle
  useEffect(() => {
    if (!pointerActiveRef.current) {
      initialBrightnessRef.current = brightness;
      initialVolumeRef.current = volume;
      initialCurrentTimeRef.current = currentTime;
    }
  }, [brightness, volume, currentTime]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return;
    // Only handle primary button
    if (e.button !== 0) return;

    // Check if click was on an interactive control button or slider
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('.interactive-control')
    ) {
      return;
    }

    pointerActiveRef.current = true;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lastXRef.current = e.clientX;
    lastYRef.current = e.clientY;
    initialBrightnessRef.current = brightness;
    initialVolumeRef.current = volume;
    initialCurrentTimeRef.current = currentTime;
    gestureModeRef.current = 'none';

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if capture fails in certain contexts
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current || isLocked) return;

    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;
    const dist = Math.hypot(deltaX, deltaY);

    const container = containerRef.current || e.currentTarget;
    const rect = container.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    // Minimum distance threshold to detect intentional gesture vs tap (12px)
    if (gestureModeRef.current === 'none') {
      if (dist < 12) return;

      // Determine gesture direction
      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
        // Horizontal swipe -> Seek
        gestureModeRef.current = 'seek';
        setActiveGesture('seek');
        setHudVisible(true);
        clearHudTimer();
      } else if (Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
        // Vertical swipe -> Left half is Brightness, Right half is Volume
        const startFromLeft = startXRef.current - rect.left < width * 0.5;
        if (startFromLeft) {
          gestureModeRef.current = 'brightness';
          setActiveGesture('brightness');
        } else {
          gestureModeRef.current = 'volume';
          setActiveGesture('volume');
        }
        setHudVisible(true);
        clearHudTimer();
      }
    }

    // Process active gesture
    if (gestureModeRef.current === 'brightness') {
      // Up increases brightness, down decreases
      // Full height swipe adjusts by ~1.3 range (0.3 to 1.8)
      const changeRange = 1.35;
      const normalizedDelta = -(deltaY / (height * 0.75)) * changeRange;
      const newBrightness = Math.max(0.25, Math.min(1.8, initialBrightnessRef.current + normalizedDelta));
      onBrightnessChange(Math.round(newBrightness * 100) / 100);
      setHudVisible(true);
      clearHudTimer();
    } else if (gestureModeRef.current === 'volume') {
      // Up increases volume, down decreases
      const normalizedDelta = -(deltaY / (height * 0.75));
      const newVolume = Math.max(0, Math.min(1, initialVolumeRef.current + normalizedDelta));
      if (isMuted && newVolume > 0 && onUnmute) {
        onUnmute();
      }
      onVolumeChange(Math.round(newVolume * 100) / 100);
      setHudVisible(true);
      clearHudTimer();
    } else if (gestureModeRef.current === 'seek') {
      // Horizontal scrub
      // Scale: based on duration, sweeping across half screen seeks smoothly
      const totalDur = duration || 120;
      let seekScale = 90; // Default 90 seconds
      if (totalDur <= 120) seekScale = 45;
      else if (totalDur <= 600) seekScale = 120;
      else if (totalDur <= 1800) seekScale = 240;
      else seekScale = 450;

      const deltaSeconds = (deltaX / (width * 0.65)) * seekScale;
      const targetTime = Math.max(0, Math.min(totalDur, initialCurrentTimeRef.current + deltaSeconds));

      setSeekData({
        targetTime,
        deltaSeconds,
        initialTime: initialCurrentTimeRef.current,
      });
      setHudVisible(true);
      clearHudTimer();
    }

    lastXRef.current = e.clientX;
    lastYRef.current = e.clientY;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    const currentMode = gestureModeRef.current;

    if (currentMode === 'seek') {
      if (seekData) {
        onSeek(seekData.targetTime);
      }
      scheduleHudHide(600);
      return;
    }

    if (currentMode === 'brightness' || currentMode === 'volume') {
      scheduleHudHide(750);
      return;
    }

    // If no gesture movement was made, this is a TAP or DOUBLE-TAP!
    const now = Date.now();
    const rect = (containerRef.current || e.currentTarget).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeft = clickX < rect.width * 0.5;
    const distSinceLastTap = Math.hypot(e.clientX - lastTapXRef.current, e.clientY - startYRef.current);

    if (now - lastTapTimeRef.current < 320 && distSinceLastTap < 60) {
      // DOUBLE TAP DETECTED!
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      const side = isLeft ? 'left' : 'right';
      const seekDelta = isLeft ? -doubleTapSeekSeconds : doubleTapSeekSeconds;
      onSeek(Math.max(0, Math.min(duration || 9999, currentTime + seekDelta)));

      // Trigger modern ripple animation
      setDoubleTapSide(side);
      setDoubleTapCount((prev) => (doubleTapSide === side ? prev + 1 : 1));
      setTimeout(() => {
        setDoubleTapSide(null);
      }, 750);

      lastTapTimeRef.current = 0;
    } else {
      // Single tap candidate -> debounce to ensure no second tap follows
      lastTapTimeRef.current = now;
      lastTapXRef.current = e.clientX;

      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }

      singleTapTimeoutRef.current = setTimeout(() => {
        onSingleTap();
        singleTapTimeoutRef.current = null;
      }, 260);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerActiveRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    scheduleHudHide(300);
  };

  // Format delta time with sign: +00:15 or -00:15
  const formatDeltaTime = (seconds: number) => {
    const sign = seconds >= 0 ? '+' : '-';
    const absSec = Math.abs(Math.round(seconds));
    const mins = Math.floor(absSec / 60);
    const secs = absSec % 60;
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate brightness percentage relative to 1.0 (or normalized 0.3 to 1.8)
  const brightnessPercent = Math.round(brightness * 100);
  const brightnessBarHeight = Math.max(
    5,
    Math.min(100, Math.round(((brightness - 0.25) / (1.8 - 0.25)) * 100))
  );

  // Calculate volume percentage
  const volumePercent = isMuted ? 0 : Math.round(volume * 100);
  const volumeBarHeight = Math.max(0, Math.min(100, volumePercent));

  return (
    <div
      id="video-gestures-overlay-surface"
      className="absolute inset-0 z-20 touch-none select-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        cursor: activeGesture !== 'none' ? (activeGesture === 'seek' ? 'ew-resize' : 'ns-resize') : 'default',
      }}
    >
      {/* MODERN DOUBLE-TAP SKIP RIPPLES (LEFT & RIGHT) */}
      {doubleTapSide === 'left' && (
        <div className="absolute left-6 sm:left-14 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
          <div className="relative flex items-center justify-center">
            {/* Pulsing circular rings */}
            <div className="absolute w-28 h-28 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '0.9s' }} />
            <div className="relative w-24 h-24 rounded-full bg-black/75 backdrop-blur-xl border border-white/25 flex flex-col items-center justify-center shadow-2xl shadow-black/80 gap-0.5">
              <div className="flex items-center text-amber-300">
                <ChevronsLeft className="w-7 h-7 -mr-1 animate-pulse" />
              </div>
              <span className="text-sm font-black font-mono tracking-tight text-white">
                -{doubleTapSeekSeconds * doubleTapCount}s
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Rewind</span>
            </div>
          </div>
        </div>
      )}

      {doubleTapSide === 'right' && (
        <div className="absolute right-6 sm:right-14 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
          <div className="relative flex items-center justify-center">
            {/* Pulsing circular rings */}
            <div className="absolute w-28 h-28 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '0.9s' }} />
            <div className="relative w-24 h-24 rounded-full bg-black/75 backdrop-blur-xl border border-white/25 flex flex-col items-center justify-center shadow-2xl shadow-black/80 gap-0.5">
              <div className="flex items-center text-cyan-300">
                <ChevronsRight className="w-7 h-7 -ml-1 animate-pulse" />
              </div>
              <span className="text-sm font-black font-mono tracking-tight text-white">
                +{doubleTapSeekSeconds * doubleTapCount}s
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Forward</span>
            </div>
          </div>
        </div>
      )}

      {/* MODERN VERTICAL BRIGHTNESS HUD (LEFT SIDE) */}
      {hudVisible && activeGesture === 'brightness' && (
        <div
          id="gesture-brightness-hud"
          className="absolute left-6 sm:left-10 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95"
        >
          <div className="w-16 rounded-3xl p-3.5 bg-black/80 backdrop-blur-2xl border border-amber-400/35 shadow-2xl shadow-amber-500/20 flex flex-col items-center gap-3">
            {/* Dynamic Sun Icon */}
            <div className="w-9 h-9 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-300 shadow-inner">
              {brightness >= 1.25 ? (
                <Sun className="w-5 h-5 animate-pulse" />
              ) : brightness >= 0.8 ? (
                <SunMedium className="w-5 h-5" />
              ) : brightness >= 0.45 ? (
                <SunDim className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-300" />
              )}
            </div>

            {/* Vertical Pill Progress Track */}
            <div className="relative h-36 w-3.5 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
              {/* Default 100% baseline marker */}
              <div
                className="absolute w-full h-0.5 bg-white/40 left-0 z-10 pointer-events-none"
                style={{ bottom: `${Math.round(((1.0 - 0.25) / (1.8 - 0.25)) * 100)}%` }}
                title="100% Standard"
              />
              <div
                className="w-full rounded-full bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-300 shadow-[0_0_12px_rgba(251,191,36,0.6)] transition-all duration-75"
                style={{ height: `${brightnessBarHeight}%` }}
              />
            </div>

            {/* Percentage text */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-black font-mono text-white tabular-nums tracking-tight">
                {brightnessPercent}%
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-amber-300/80">
                Light
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODERN VERTICAL VOLUME HUD (RIGHT SIDE) */}
      {hudVisible && activeGesture === 'volume' && (
        <div
          id="gesture-volume-hud"
          className="absolute right-6 sm:right-10 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95"
        >
          <div className="w-16 rounded-3xl p-3.5 bg-black/80 backdrop-blur-2xl border border-cyan-400/35 shadow-2xl shadow-cyan-500/20 flex flex-col items-center gap-3">
            {/* Dynamic Volume Icon */}
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-inner ${
                isMuted || volume === 0
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-cyan-400/20 text-cyan-300'
              }`}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : volume < 0.35 ? (
                <Volume className="w-5 h-5" />
              ) : volume < 0.7 ? (
                <Volume1 className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </div>

            {/* Vertical Pill Progress Track */}
            <div className="relative h-36 w-3.5 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full rounded-full bg-gradient-to-t from-cyan-500 via-sky-400 to-blue-400 shadow-[0_0_12px_rgba(34,211,238,0.6)] transition-all duration-75"
                style={{ height: `${volumeBarHeight}%` }}
              />
            </div>

            {/* Percentage text */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-black font-mono text-white tabular-nums tracking-tight">
                {isMuted ? '0%' : `${volumePercent}%`}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-cyan-300/80">
                {isMuted ? 'Muted' : 'Volume'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODERN HORIZONTAL SEEK HUD (CENTER) */}
      {hudVisible && activeGesture === 'seek' && seekData && (
        <div
          id="gesture-seek-hud"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 z-30"
        >
          <div className="px-6 py-5 rounded-3xl bg-black/85 backdrop-blur-3xl border border-white/20 shadow-2xl shadow-black flex flex-col items-center gap-3 min-w-[280px] max-w-sm sm:min-w-[320px]">
            {/* Header: Icon + Delta badge */}
            <div className="flex items-center gap-3">
              {seekData.deltaSeconds >= 0 ? (
                <div className="p-2 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <FastForward className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Rewind className="w-5 h-5" />
                </div>
              )}

              <div
                className={`px-3 py-1 rounded-full text-sm font-black font-mono tracking-tight flex items-center gap-1 ${
                  seekData.deltaSeconds >= 0
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                    : 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                }`}
              >
                <span>{formatDeltaTime(seekData.deltaSeconds)}</span>
              </div>
            </div>

            {/* Target Time / Total Duration */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                {formatTime(seekData.targetTime)}
              </span>
              <span className="text-sm font-semibold text-slate-400 tabular-nums">
                / {formatTime(duration)}
              </span>
            </div>

            {/* Mini Progress Bar with Origin & Target */}
            <div className="w-full relative py-1">
              <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden relative">
                {/* Initial position marker bar */}
                <div
                  className="absolute top-0 bottom-0 bg-white/30 rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, (seekData.initialTime / (duration || 1)) * 100))}%`,
                  }}
                />
                {/* Scrubbing bar */}
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    seekData.deltaSeconds >= 0
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                      : 'bg-gradient-to-r from-amber-500 to-rose-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, (seekData.targetTime / (duration || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Release hint */}
            <span className="text-[11px] font-medium text-slate-300/80 tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Release finger to jump here</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
