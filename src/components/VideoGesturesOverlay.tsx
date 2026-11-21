import React, { useState, useRef, useEffect } from 'react';
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
  ZoomIn,
  AlertTriangle,
} from 'lucide-react';
import { formatTime } from '../utils/formatters';
import { GestureSettings } from '../types';

interface VideoGesturesOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isLocked: boolean;
  brightness: number;
  onBrightnessChange: (val: number) => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  volumeBoost?: number; // 100 to 200
  isMuted: boolean;
  onUnmute?: () => void;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onSingleTap: () => void;
  doubleTapSeekSeconds?: number;
  themeColor?: string;
  showGestureHints?: boolean;
  directIncreaseSystem?: boolean;
  rotation?: number;
  gestureSettings?: GestureSettings;
  zoomScale?: number;
  panOffset?: { x: number; y: number };
  onZoomChange?: (scale: number, pan: { x: number; y: number }) => void;
  onTempSpeedStart?: () => void;
  onTempSpeedEnd?: () => void;
}

type GestureMode = 'none' | 'brightness' | 'volume' | 'seek' | 'speed' | 'pinch';

const DOUBLE_TAP_EDGE_RATIO = 0.32;
const GESTURE_ACTIVATION_DISTANCE = 12;
const GESTURE_CANCEL_TAP_DISTANCE = 10;
const LONG_PRESS_DELAY_MS = 650;
const DOUBLE_TAP_WINDOW_MS = 300;
const PROGRESSIVE_TAP_RESET_MS = 600;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 3.0;
const PINCH_ACTIVATION_DELTA = 0.04;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function applyGestureControlCurve(normDelta: number): number {
  const sign = normDelta < 0 ? -1 : 1;
  return sign * Math.pow(Math.abs(normDelta), 1.4);
}

function applyEdgeResistance(currentNorm: number, deltaNorm: number): number {
  const nearBottom = currentNorm <= 0.08 && deltaNorm < 0;
  const nearTop = currentNorm >= 0.92 && deltaNorm > 0;
  return nearBottom || nearTop ? deltaNorm * 0.25 : deltaNorm;
}

export function VideoGesturesOverlay({
  containerRef,
  isLocked,
  brightness,
  onBrightnessChange,
  volume,
  onVolumeChange,
  volumeBoost = 100,
  isMuted,
  onUnmute,
  currentTime,
  duration,
  onSeek,
  onSingleTap,
  doubleTapSeekSeconds = 10,
  directIncreaseSystem = true,
  rotation = 0,
  gestureSettings,
  zoomScale = 1.0,
  panOffset = { x: 0, y: 0 },
  onZoomChange,
  onTempSpeedStart,
  onTempSpeedEnd,
}: VideoGesturesOverlayProps) {
  const [activeGesture, setActiveGesture] = useState<GestureMode>('none');
  const [hudVisible, setHudVisible] = useState(false);
  const [seekData, setSeekData] = useState<{
    targetTime: number;
    deltaSeconds: number;
    initialTime: number;
  } | null>(null);
  const [zoomHudVisible, setZoomHudVisible] = useState(false);
  const [isTempSpeedActive, setIsTempSpeedActive] = useState(false);

  // Progressive multi-tap ripple state
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const [doubleTapCount, setDoubleTapCount] = useState(0);

  // Pointer & pinch tracking refs
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pointerActiveRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastSampleXRef = useRef(0);
  const lastSampleTimeRef = useRef(0);
  const velocityXRef = useRef(0);
  const startRelXRef = useRef(0.5);

  const initialBrightnessRef = useRef(brightness);
  const initialVolumeRef = useRef(volume);
  const initialCurrentTimeRef = useRef(currentTime);
  const gestureModeRef = useRef<GestureMode>('none');

  // Pinch tracking refs
  const pinchInitialDistRef = useRef<number | null>(null);
  const pinchInitialScaleRef = useRef(zoomScale);
  const pinchInitialMidRef = useRef<{ x: number; y: number } | null>(null);
  const pinchInitialPanRef = useRef<{ x: number; y: number }>(panOffset);
  const pinchActivatedRef = useRef(false);

  // Timers
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zoomHudTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressiveTapResetRef = useRef<NodeJS.Timeout | null>(null);

  const lastTapTimeRef = useRef<number>(0);
  const lastTapSideRef = useRef<'left' | 'right' | null>(null);
  const lastTapXRef = useRef<number>(0);
  const lastTapYRef = useRef<number>(0);

  const clearHudTimer = () => {
    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current);
      hudTimeoutRef.current = null;
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const scheduleHudHide = (delay = 900) => {
    clearHudTimer();
    hudTimeoutRef.current = setTimeout(() => {
      setHudVisible(false);
      setActiveGesture('none');
      setSeekData(null);
      gestureModeRef.current = 'none';
    }, delay);
  };

  const showZoomHudBriefly = () => {
    setZoomHudVisible(true);
    if (zoomHudTimeoutRef.current) clearTimeout(zoomHudTimeoutRef.current);
    zoomHudTimeoutRef.current = setTimeout(() => {
      setZoomHudVisible(false);
    }, 900);
  };

  useEffect(() => {
    if (!pointerActiveRef.current) {
      initialBrightnessRef.current = brightness;
      initialVolumeRef.current = volume;
      initialCurrentTimeRef.current = currentTime;
    }
  }, [brightness, volume, currentTime]);

  useEffect(() => {
    return () => {
      clearHudTimer();
      clearLongPressTimer();
      if (zoomHudTimeoutRef.current) clearTimeout(zoomHudTimeoutRef.current);
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
      if (progressiveTapResetRef.current) clearTimeout(progressiveTapResetRef.current);
    };
  }, []);

  const getRelativePoint = (clientX: number, clientY: number, el: HTMLElement) => {
    const container = containerRef.current || el;
    const rect = container.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    let relX = (clientX - rect.left) / w;
    let visualWidth = w;
    let visualHeight = h;

    if (rotation === 90) {
      relX = (clientY - rect.top) / h;
      visualWidth = h;
      visualHeight = w;
    } else if (rotation === -90 || rotation === 270) {
      relX = (rect.bottom - clientY) / h;
      visualWidth = h;
      visualHeight = w;
    }

    return {
      relX: clamp(relX, 0, 1),
      visualWidth,
      visualHeight,
    };
  };

  const transformDelta = (rawDeltaX: number, rawDeltaY: number) => {
    if (rotation === 90) {
      return { deltaX: rawDeltaY, deltaY: -rawDeltaX };
    }
    if (rotation === -90 || rotation === 270) {
      return { deltaX: -rawDeltaY, deltaY: rawDeltaX };
    }
    return { deltaX: rawDeltaX, deltaY: rawDeltaY };
  };

  const getZoneFromRelX = (relX: number): 'left' | 'center' | 'right' => {
    if (relX <= DOUBLE_TAP_EDGE_RATIO) return 'left';
    if (relX >= 1 - DOUBLE_TAP_EDGE_RATIO) return 'right';
    return 'center';
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('.interactive-control')
    ) {
      return;
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch Pinch Zoom detection (2 pointers)
    if (activePointersRef.current.size === 2) {
      clearLongPressTimer();
      pointerActiveRef.current = false;
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchInitialDistRef.current = Math.max(dist, 10);
      pinchInitialScaleRef.current = zoomScale;
      pinchInitialMidRef.current = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      pinchInitialPanRef.current = panOffset;
      pinchActivatedRef.current = false;
      gestureModeRef.current = 'pinch';
      setActiveGesture('pinch');
      return;
    }

    if (activePointersRef.current.size > 2) return;

    pointerActiveRef.current = true;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lastSampleXRef.current = e.clientX;
    lastSampleTimeRef.current = performance.now();
    velocityXRef.current = 0;

    const { relX } = getRelativePoint(e.clientX, e.clientY, e.currentTarget);
    startRelXRef.current = relX;

    initialBrightnessRef.current = brightness;
    initialVolumeRef.current = volume;
    initialCurrentTimeRef.current = currentTime;
    gestureModeRef.current = 'none';

    // Long-Press 650ms Temporary 2x Speed Ramp
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      if (pointerActiveRef.current && gestureModeRef.current === 'none' && activePointersRef.current.size === 1) {
        gestureModeRef.current = 'speed';
        setActiveGesture('speed');
        setIsTempSpeedActive(true);
        onTempSpeedStart?.();
      }
    }, LONG_PRESS_DELAY_MS);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Handle 2-finger Pinch Zoom + Pan
    if (gestureModeRef.current === 'pinch' && activePointersRef.current.size >= 2 && pinchInitialDistRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = dist / pinchInitialDistRef.current;

      if (!pinchActivatedRef.current && Math.abs(ratio - 1) < PINCH_ACTIVATION_DELTA) {
        return;
      }
      pinchActivatedRef.current = true;

      const nextScale = clamp(Math.round(pinchInitialScaleRef.current * ratio * 100) / 100, MIN_ZOOM, MAX_ZOOM);
      let nextPan = { x: 0, y: 0 };

      if (nextScale > 1.02 && pinchInitialMidRef.current) {
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const dx = midX - pinchInitialMidRef.current.x;
        const dy = midY - pinchInitialMidRef.current.y;
        const maxPan = (nextScale - 1) * 180;
        nextPan = {
          x: clamp(pinchInitialPanRef.current.x + dx, -maxPan, maxPan),
          y: clamp(pinchInitialPanRef.current.y + dy, -maxPan, maxPan),
        };
      }

      onZoomChange?.(nextScale, nextPan);
      showZoomHudBriefly();
      return;
    }

    if (!pointerActiveRef.current) return;

    const rawDeltaX = e.clientX - startXRef.current;
    const rawDeltaY = e.clientY - startYRef.current;
    const { deltaX, deltaY } = transformDelta(rawDeltaX, rawDeltaY);
    const absDx = Math.abs(deltaX);
    const absDy = Math.abs(deltaY);
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > GESTURE_CANCEL_TAP_DISTANCE) {
      clearLongPressTimer();
    }

    // If temporary 2x speed is active, remain locked in speed mode until release
    if (gestureModeRef.current === 'speed') return;

    const { visualWidth, visualHeight } = getRelativePoint(e.clientX, e.clientY, e.currentTarget);

    // Track horizontal velocity (px/ms)
    const now = performance.now();
    const dt = Math.max(1, now - lastSampleTimeRef.current);
    const instantVx = Math.abs(e.clientX - lastSampleXRef.current) / dt;
    velocityXRef.current = velocityXRef.current * 0.6 + instantVx * 0.4;
    lastSampleXRef.current = e.clientX;
    lastSampleTimeRef.current = now;

    // Classify gesture once with MX strict axis lock
    if (gestureModeRef.current === 'none') {
      if (dist < GESTURE_ACTIVATION_DISTANCE) return;

      const zone = getZoneFromRelX(startRelXRef.current);

      if (absDx >= absDy * 1.8) {
        // Horizontal seek (allowed across surface unless disabled)
        const action = gestureSettings?.horizontalSwipeAction || 'seek';
        if (action === 'seek' && (gestureSettings?.seekGesture ?? true)) {
          gestureModeRef.current = 'seek';
          setActiveGesture('seek');
          setHudVisible(true);
          clearHudTimer();
        } else if (action === 'volume' && (gestureSettings?.volumeGesture ?? true)) {
          gestureModeRef.current = 'volume';
          setActiveGesture('volume');
          setHudVisible(true);
          clearHudTimer();
        } else if (action === 'brightness' && (gestureSettings?.brightnessGesture ?? true)) {
          gestureModeRef.current = 'brightness';
          setActiveGesture('brightness');
          setHudVisible(true);
          clearHudTimer();
        }
      } else if (absDy >= absDx * 1.4) {
        // Vertical swipe only activates inside Left 32% or Right 32% zones
        if (zone === 'center') return;

        const action =
          zone === 'left'
            ? gestureSettings?.leftVerticalAction || 'brightness'
            : gestureSettings?.rightVerticalAction || 'volume';

        if (action === 'brightness' && (gestureSettings?.brightnessGesture ?? true)) {
          gestureModeRef.current = 'brightness';
          setActiveGesture('brightness');
          setHudVisible(true);
          clearHudTimer();
        } else if (action === 'volume' && (gestureSettings?.volumeGesture ?? true)) {
          gestureModeRef.current = 'volume';
          setActiveGesture('volume');
          setHudVisible(true);
          clearHudTimer();
        } else if (action === 'seek' && (gestureSettings?.seekGesture ?? true)) {
          gestureModeRef.current = 'seek';
          setActiveGesture('seek');
          setHudVisible(true);
          clearHudTimer();
        }
      }
      // Diagonal angles between 1.4 and 1.8 intentionally activate nothing
      if (gestureModeRef.current === 'none') return;
    }

    // Adaptive sensitivity base matching MX spec
    const adaptiveSens = clamp((720 / Math.max(360, visualHeight)) * 1.45, 0.9, 2.5);

    if (gestureModeRef.current === 'brightness') {
      const invertVert = gestureSettings?.invertVerticalSwipe ?? false;
      const brightSens = gestureSettings?.brightnessSensitivity ?? 1.0;
      const effectiveY = invertVert ? deltaY : -deltaY;
      const rawNormDelta = (effectiveY / (visualHeight * 0.72)) * adaptiveSens * brightSens;
      const curvedDelta = applyGestureControlCurve(rawNormDelta);

      const initialNorm = (initialBrightnessRef.current - 0.25) / (1.8 - 0.25);
      const dampedDelta = applyEdgeResistance(initialNorm, curvedDelta);
      let nextNorm = clamp(initialNorm + dampedDelta, 0, 1);

      if (directIncreaseSystem) {
        nextNorm = Math.round(nextNorm * 15) / 15;
      }

      const newBrightness = 0.25 + nextNorm * (1.8 - 0.25);
      onBrightnessChange(Math.round(newBrightness * 100) / 100);
      setHudVisible(true);
      clearHudTimer();
    } else if (gestureModeRef.current === 'volume') {
      const invertVert = gestureSettings?.invertVerticalSwipe ?? false;
      const volSens = gestureSettings?.volumeSensitivity ?? 1.0;
      const effectiveY = invertVert ? deltaY : -deltaY;
      const rawNormDelta = (effectiveY / (visualHeight * 0.72)) * adaptiveSens * volSens;
      const curvedDelta = applyGestureControlCurve(rawNormDelta);

      const dampedDelta = applyEdgeResistance(initialVolumeRef.current, curvedDelta);
      let nextVol = clamp(initialVolumeRef.current + dampedDelta, 0, 1);

      if (directIncreaseSystem) {
        nextVol = Math.round(nextVol * 15) / 15;
      }

      if (isMuted && nextVol > 0 && onUnmute) {
        onUnmute();
      }
      onVolumeChange(Math.round(nextVol * 100) / 100);
      setHudVisible(true);
      clearHudTimer();
    } else if (gestureModeRef.current === 'seek') {
      const totalDur = duration || 120;
      const seekWindow = clamp(totalDur * 0.25, 60, 600);
      const velocityBoost = clamp(velocityXRef.current / 0.8, 1, 2.5);
      const invertHoriz = gestureSettings?.invertHorizontalSwipe ?? false;
      const seekSens = gestureSettings?.seekSensitivity ?? 1.0;
      const effectiveX = invertHoriz ? -deltaX : deltaX;

      const normX = effectiveX / (visualWidth * 0.65);
      const curvedX = Math.sign(normX) * Math.pow(Math.abs(normX), 1.12);
      const deltaSeconds = curvedX * seekWindow * seekSens * (velocityBoost * 0.65 + 0.35);
      const targetTime = clamp(initialCurrentTimeRef.current + deltaSeconds, 0, totalDur);

      setSeekData({
        targetTime: Math.round(targetTime * 10) / 10,
        deltaSeconds: Math.round(deltaSeconds * 10) / 10,
        initialTime: initialCurrentTimeRef.current,
      });
      setHudVisible(true);
      clearHudTimer();
    }
  };

  const finishInteraction = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    clearLongPressTimer();
    activePointersRef.current.delete(e.pointerId);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (gestureModeRef.current === 'pinch') {
      if (activePointersRef.current.size < 2) {
        pinchInitialDistRef.current = null;
        pinchInitialMidRef.current = null;
        gestureModeRef.current = 'none';
        setActiveGesture('none');
      }
      return;
    }

    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;

    const currentMode = gestureModeRef.current;

    if (currentMode === 'speed') {
      setIsTempSpeedActive(false);
      onTempSpeedEnd?.();
      gestureModeRef.current = 'none';
      setActiveGesture('none');
      return;
    }

    if (currentMode === 'seek') {
      if (!cancelled && seekData) {
        onSeek(seekData.targetTime);
      }
      scheduleHudHide(750);
      return;
    }

    if (currentMode === 'brightness' || currentMode === 'volume') {
      scheduleHudHide(900);
      return;
    }

    if (cancelled) return;

    // Tap / Progressive Double-Tap state machine
    const now = Date.now();
    const { relX } = getRelativePoint(e.clientX, e.clientY, e.currentTarget);
    const zone = getZoneFromRelX(relX);
    const distSinceLastTap = Math.hypot(e.clientX - lastTapXRef.current, e.clientY - lastTapYRef.current);

    if (
      zone !== 'center' &&
      now - lastTapTimeRef.current < DOUBLE_TAP_WINDOW_MS &&
      lastTapSideRef.current === zone &&
      distSinceLastTap < 75
    ) {
      // Progressive multi-tap seek
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      const nextCount = doubleTapSide === zone ? doubleTapCount + 1 : 1;
      setDoubleTapSide(zone);
      setDoubleTapCount(nextCount);

      const seekDelta = zone === 'left' ? -doubleTapSeekSeconds : doubleTapSeekSeconds;
      onSeek(clamp(currentTime + seekDelta, 0, duration || 999999));

      if (progressiveTapResetRef.current) {
        clearTimeout(progressiveTapResetRef.current);
      }
      progressiveTapResetRef.current = setTimeout(() => {
        setDoubleTapSide(null);
        setDoubleTapCount(0);
        lastTapSideRef.current = null;
      }, PROGRESSIVE_TAP_RESET_MS);

      lastTapTimeRef.current = now;
      lastTapXRef.current = e.clientX;
      lastTapYRef.current = e.clientY;
    } else {
      lastTapTimeRef.current = now;
      lastTapSideRef.current = zone === 'center' ? null : zone;
      lastTapXRef.current = e.clientX;
      lastTapYRef.current = e.clientY;

      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }

      if (zone === 'center') {
        onSingleTap();
      } else {
        singleTapTimeoutRef.current = setTimeout(() => {
          onSingleTap();
          singleTapTimeoutRef.current = null;
        }, 240);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isLocked || !onZoomChange) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.004;
      const nextScale = clamp(Math.round((zoomScale + delta) * 100) / 100, MIN_ZOOM, MAX_ZOOM);
      const nextPan = nextScale <= 1.02 ? { x: 0, y: 0 } : panOffset;
      onZoomChange(nextScale, nextPan);
      showZoomHudBriefly();
    }
  };

  const formatDeltaTime = (seconds: number) => {
    const sign = seconds >= 0 ? '+' : '-';
    const absSec = Math.abs(Math.round(seconds));
    const mins = Math.floor(absSec / 60);
    const secs = absSec % 60;
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Normalized 0..100 brightness for HUD bar fill
  const brightnessNormPercent = Math.round(((brightness - 0.25) / (1.8 - 0.25)) * 100);
  const brightnessBarHeight = clamp(brightnessNormPercent, 0, 100);

  // Volume & distortion warning calculation
  const volumePercent = isMuted ? 0 : Math.round(volume * 100);
  const volumeBarHeight = clamp(volumePercent, 0, 100);
  const effectiveBoostFactor = (volumeBoost || 100) / 100;
  const isDistortionZone = !isMuted && volume * effectiveBoostFactor > 1.02;

  const showBrightnessHud = hudVisible && activeGesture === 'brightness';
  const showVolumeHud = hudVisible && activeGesture === 'volume';
  const showSeekHud = hudVisible && activeGesture === 'seek' && seekData !== null;

  return (
    <div
      id="video-gestures-overlay-surface"
      className="absolute inset-0 z-20 touch-none select-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishInteraction(e, false)}
      onPointerCancel={(e) => finishInteraction(e, true)}
      onWheel={handleWheel}
      style={{
        cursor:
          activeGesture === 'seek'
            ? 'ew-resize'
            : activeGesture === 'brightness' || activeGesture === 'volume'
            ? 'ns-resize'
            : 'default',
      }}
    >
      {/* TEMPORARY 2X SPEED LONG-PRESS BADGE (TOP-CENTER) */}
      <div
        id="gesture-temp-speed-hud"
        className={`absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-150 z-30 ${
          isTempSpeedActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="px-4 py-2 rounded-full bg-slate-950/85 backdrop-blur-xl border border-white/15 shadow-2xl flex items-center gap-2 text-xs font-semibold text-white">
          <FastForward className="w-4 h-4 text-amber-300" />
          <span className="font-mono tabular-nums">2x Speed</span>
        </div>
      </div>

      {/* PROGRESSIVE MULTI-TAP SKIP RIPPLES */}
      {doubleTapSide === 'left' && (
        <div className="absolute left-6 sm:left-14 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center shadow-2xl gap-0.5">
            <ChevronsLeft className="w-6 h-6 text-amber-300" />
            <span className="text-sm font-bold font-mono tabular-nums text-white">
              -{doubleTapSeekSeconds * Math.max(1, doubleTapCount)}s
            </span>
            <span className="text-[11px] text-slate-300">Back</span>
          </div>
        </div>
      )}

      {doubleTapSide === 'right' && (
        <div className="absolute right-6 sm:right-14 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center shadow-2xl gap-0.5">
            <ChevronsRight className="w-6 h-6 text-sky-300" />
            <span className="text-sm font-bold font-mono tabular-nums text-white">
              +{doubleTapSeekSeconds * Math.max(1, doubleTapCount)}s
            </span>
            <span className="text-[11px] text-slate-300">Forward</span>
          </div>
        </div>
      )}

      {/* ALWAYS-MOUNTED MX BRIGHTNESS HUD (LEFT EDGE) */}
      <div
        id="gesture-brightness-hud"
        className={`absolute left-5 sm:left-8 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 z-30 ${
          showBrightnessHud ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="w-14 rounded-2xl py-3 px-2.5 bg-slate-950/80 backdrop-blur-xl border border-amber-400/30 shadow-2xl flex flex-col items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-amber-400/15 flex items-center justify-center text-amber-300">
            {brightnessNormPercent <= 15 ? (
              <Moon className="w-4 h-4 text-amber-200" />
            ) : brightness >= 1.25 ? (
              <Sun className="w-4 h-4" />
            ) : brightness >= 0.8 ? (
              <SunMedium className="w-4 h-4" />
            ) : (
              <SunDim className="w-4 h-4" />
            )}
          </div>

          <div className="relative h-36 w-2.5 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end">
            {/* 25% / 50% / 75% tick marks */}
            <div className="absolute inset-x-0 bottom-[25%] h-px bg-white/25 z-10" />
            <div className="absolute inset-x-0 bottom-[50%] h-px bg-white/35 z-10" />
            <div className="absolute inset-x-0 bottom-[75%] h-px bg-white/25 z-10" />
            <div
              className="w-full rounded-full bg-gradient-to-t from-amber-500 to-amber-300 transition-[height] duration-75"
              style={{ height: `${brightnessBarHeight}%` }}
            />
          </div>

          <span className="text-xs font-semibold font-mono text-white tabular-nums">
            {brightnessNormPercent}%
          </span>
        </div>
      </div>

      {/* ALWAYS-MOUNTED MX VOLUME HUD (RIGHT EDGE) */}
      <div
        id="gesture-volume-hud"
        className={`absolute right-5 sm:right-8 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 z-30 ${
          showVolumeHud ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="w-14 rounded-2xl py-3 px-2.5 bg-slate-950/80 backdrop-blur-xl border border-sky-400/30 shadow-2xl flex flex-col items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isMuted || volume === 0
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-sky-400/15 text-sky-300'
            }`}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : volume < 0.35 ? (
              <Volume className="w-4 h-4" />
            ) : volume < 0.7 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </div>

          <div className="relative h-36 w-2.5 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end">
            {/* 25% / 50% / 75% tick marks */}
            <div className="absolute inset-x-0 bottom-[25%] h-px bg-white/25 z-10" />
            <div className="absolute inset-x-0 bottom-[50%] h-px bg-white/35 z-10" />
            <div className="absolute inset-x-0 bottom-[75%] h-px bg-white/25 z-10" />
            <div
              className="w-full rounded-full bg-gradient-to-t from-blue-600 to-sky-400 transition-[height] duration-75"
              style={{ height: `${volumeBarHeight}%` }}
            />
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-semibold font-mono text-white tabular-nums">
              {volumePercent}%
            </span>
            {isDistortionZone && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-300" title="Boost exceeds 100% output">
                <AlertTriangle className="w-3 h-3" />
                <span>{Math.round(volumePercent * effectiveBoostFactor)}%</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CENTER ZOOM HUD */}
      <div
        id="gesture-zoom-hud"
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-150 z-30 ${
          zoomHudVisible && !showSeekHud ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="px-4 py-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/15 shadow-2xl flex items-center gap-2 text-sm font-semibold text-white font-mono tabular-nums">
          <ZoomIn className="w-4 h-4 text-emerald-300" />
          <span>{zoomScale <= 1.02 ? 'Zoom Reset' : `Zoom ${zoomScale.toFixed(1)}x`}</span>
        </div>
      </div>

      {/* CENTER HORIZONTAL SEEK HUD */}
      {showSeekHud && seekData && (
        <div
          id="gesture-seek-hud"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-150 z-30"
        >
          <div className="px-6 py-4 rounded-2xl bg-slate-950/85 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col items-center gap-2.5 min-w-[260px]">
            <div className="flex items-center gap-2.5 text-sm font-mono font-bold tabular-nums">
              {seekData.deltaSeconds >= 0 ? (
                <FastForward className="w-4 h-4 text-emerald-300" />
              ) : (
                <Rewind className="w-4 h-4 text-amber-300" />
              )}
              <span className={seekData.deltaSeconds >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                {formatDeltaTime(seekData.deltaSeconds)}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
              <span className="text-2xl font-bold text-white">
                {formatTime(seekData.targetTime)}
              </span>
              <span className="text-xs text-slate-400">/ {formatTime(duration)}</span>
            </div>

            <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 bg-white/30 rounded-full"
                style={{
                  width: `${clamp((seekData.initialTime / (duration || 1)) * 100, 0, 100)}%`,
                }}
              />
              <div
                className={`h-full rounded-full ${
                  seekData.deltaSeconds >= 0 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{
                  width: `${clamp((seekData.targetTime / (duration || 1)) * 100, 0, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
