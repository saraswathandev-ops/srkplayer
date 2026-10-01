import React, { useState, useRef } from 'react';
import {
  X,
  Sun,
  Volume2,
  FastForward,
  RotateCcw,
  RotateCw,
  Sparkles,
  Sliders,
  Check,
  Smartphone,
  MousePointer,
  HelpCircle,
  Eye,
  Keyboard,
  Compass,
  Zap,
} from 'lucide-react';
import { ThemeColors } from '../constants/theme';
import { GestureSettings } from '../types';

interface VideoGesturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  gestureSettings: GestureSettings;
  onUpdateGestureSettings: (partial: Partial<GestureSettings>) => void;
  themeColors: ThemeColors;
  isDark: boolean;
  onShowToast: (msg: string) => void;
  onLaunchLiveOverlay?: () => void;
}

export function VideoGesturesModal({
  isOpen,
  onClose,
  gestureSettings,
  onUpdateGestureSettings,
  themeColors,
  isDark,
  onShowToast,
  onLaunchLiveOverlay,
}: VideoGesturesModalProps) {
  const [activeTab, setActiveTab] = useState<'practice' | 'guide' | 'settings'>('practice');

  // Simulated Practice Sandbox State
  const [simBrightness, setSimBrightness] = useState<number>(100);
  const [simVolume, setSimVolume] = useState<number>(75);
  const [simSeek, setSimSeek] = useState<number>(0);
  const [simActiveGesture, setSimActiveGesture] = useState<'none' | 'brightness' | 'volume' | 'seek'>('none');
  const [simRipple, setSimRipple] = useState<'left' | 'right' | null>(null);

  // Gamified Practice Checklist
  const [mastered, setMastered] = useState<{
    brightness: boolean;
    volume: boolean;
    seek: boolean;
    doubleTap: boolean;
  }>({
    brightness: false,
    volume: false,
    seek: false,
    doubleTap: false,
  });

  // Practice tracking refs
  const dragStartRef = useRef<{ x: number; y: number; initialVal: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  if (!isOpen) return null;

  const handlePracticePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = Date.now();

    // Check for double-tap
    if (now - lastTapRef.current < 300) {
      if (x < rect.width * 0.5) {
        setSimRipple('left');
        setMastered((prev) => ({ ...prev, doubleTap: true }));
        setTimeout(() => setSimRipple(null), 600);
      } else {
        setSimRipple('right');
        setMastered((prev) => ({ ...prev, doubleTap: true }));
        setTimeout(() => setSimRipple(null), 600);
      }
      lastTapRef.current = 0;
      dragStartRef.current = null;
      return;
    }
    lastTapRef.current = now;

    dragStartRef.current = {
      x,
      y,
      initialVal: x < rect.width * 0.5 ? simBrightness : simVolume,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handlePracticePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const deltaX = currentX - dragStartRef.current.x;
    const deltaY = currentY - dragStartRef.current.y;

    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && Math.abs(deltaX) > 10) {
      // Horizontal -> Seek
      setSimActiveGesture('seek');
      const scrubSec = Math.round((deltaX / rect.width) * 60);
      setSimSeek(scrubSec);
      setMastered((prev) => ({ ...prev, seek: true }));
    } else if (Math.abs(deltaY) > 10) {
      // Vertical -> Brightness (left) or Volume (right)
      const isLeft = dragStartRef.current.x < rect.width * 0.5;
      const normalizedDelta = -(deltaY / (rect.height * 0.6)) * 50;

      if (isLeft) {
        setSimActiveGesture('brightness');
        const nextBright = Math.max(25, Math.min(180, Math.round(dragStartRef.current.initialVal + normalizedDelta)));
        setSimBrightness(nextBright);
        setMastered((prev) => ({ ...prev, brightness: true }));
      } else {
        setSimActiveGesture('volume');
        const nextVol = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initialVal + normalizedDelta)));
        setSimVolume(nextVol);
        setMastered((prev) => ({ ...prev, volume: true }));
      }
    }
  };

  const handlePracticePointerUp = () => {
    dragStartRef.current = null;
    setTimeout(() => {
      setSimActiveGesture('none');
      setSimSeek(0);
    }, 800);
  };

  const allMastered = mastered.brightness && mastered.volume && mastered.seek && mastered.doubleTap;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="video-gestures-modal"
        className="w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: isDark ? 'rgba(15, 17, 26, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl"
              style={{
                backgroundColor: `${themeColors.primary}20`,
                color: themeColors.primary,
              }}
            >
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Player Gesture Guide & Help</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Interactive
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Swipe left for light, right for sound, across for seek
              </p>
            </div>
          </div>

          <button
            id="close-gestures-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className="flex items-center gap-1 px-5 py-2.5 border-b shrink-0 bg-white/[0.02]"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }}
        >
          <button
            type="button"
            id="tab-practice-btn"
            onClick={() => setActiveTab('practice')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'practice'
                ? 'shadow-sm text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              backgroundColor: activeTab === 'practice' ? themeColors.primary : 'transparent',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Practice</span>
            {allMastered && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            id="tab-guide-btn"
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'shadow-sm text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              backgroundColor: activeTab === 'guide' ? themeColors.primary : 'transparent',
            }}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Visual Diagrams & Shortcuts</span>
          </button>

          <button
            type="button"
            id="tab-settings-btn"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'shadow-sm text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              backgroundColor: activeTab === 'settings' ? themeColors.primary : 'transparent',
            }}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'practice' && (
            <div className="space-y-4">
              {/* Simulator Description */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <MousePointer className="w-4 h-4 text-amber-400" />
                    <span>Try Dragging in the Practice Screen Below:</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Swipe/drag vertically on the left or right, horizontally for seek, or double-tap!
                  </p>
                </div>

                {onLaunchLiveOverlay && (
                  <button
                    type="button"
                    id="launch-live-overlay-btn"
                    onClick={() => {
                      onClose();
                      onLaunchLiveOverlay();
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Live Screen Overlay</span>
                  </button>
                )}
              </div>

              {/* Interactive Practice Canvas Box */}
              <div
                id="interactive-gestures-playground"
                onPointerDown={handlePracticePointerDown}
                onPointerMove={handlePracticePointerMove}
                onPointerUp={handlePracticePointerUp}
                className="w-full h-56 sm:h-64 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-dashed border-white/20 relative overflow-hidden select-none cursor-grab active:cursor-grabbing flex flex-col justify-between p-4 shadow-inner"
              >
                {/* Zone Dividing Line */}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 border-l border-dashed border-white/15 pointer-events-none" />

                {/* Left/Right Zone Background Guides */}
                <div className="absolute inset-0 flex pointer-events-none">
                  <div className="w-1/2 h-full flex flex-col justify-between p-3 opacity-40">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                      <Sun className="w-3 h-3" /> Left: Brightness
                    </span>
                    <span className="text-[9px] text-amber-300/80">↕ Drag up/down</span>
                  </div>
                  <div className="w-1/2 h-full flex flex-col justify-between p-3 items-end opacity-40">
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                      Right: Volume <Volume2 className="w-3 h-3" />
                    </span>
                    <span className="text-[9px] text-cyan-300/80">↕ Drag up/down</span>
                  </div>
                </div>

                {/* Center Horizontal Seek Guide */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none opacity-40">
                  <span className="px-3 py-1 rounded-full bg-black/60 border border-emerald-400/30 text-[10px] font-bold text-emerald-300">
                    ↔ Drag left/right to Seek
                  </span>
                </div>

                {/* Live Simulated HUD Indicators */}
                <div className="relative z-10 w-full flex justify-between items-start pointer-events-none">
                  {/* Brightness HUD (Left) */}
                  <div
                    className={`p-2.5 rounded-2xl bg-black/80 backdrop-blur-md border border-amber-400/40 text-amber-300 shadow-xl transition-all duration-150 flex items-center gap-2 ${
                      simActiveGesture === 'brightness' ? 'scale-110 ring-2 ring-amber-400' : 'opacity-70'
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold uppercase">Light</div>
                      <div className="text-xs font-extrabold tabular-nums">{simBrightness}%</div>
                    </div>
                  </div>

                  {/* Volume HUD (Right) */}
                  <div
                    className={`p-2.5 rounded-2xl bg-black/80 backdrop-blur-md border border-cyan-400/40 text-cyan-300 shadow-xl transition-all duration-150 flex items-center gap-2 ${
                      simActiveGesture === 'volume' ? 'scale-110 ring-2 ring-cyan-400' : 'opacity-70'
                    }`}
                  >
                    <div className="space-y-0.5 text-right">
                      <div className="text-[10px] font-bold uppercase">Sound</div>
                      <div className="text-xs font-extrabold tabular-nums">{simVolume}%</div>
                    </div>
                    <Volume2 className="w-5 h-5" />
                  </div>
                </div>

                {/* Center Seek HUD when scrubbing */}
                {simActiveGesture === 'seek' && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-4 py-2.5 rounded-2xl bg-black/90 backdrop-blur-lg border border-emerald-400/60 text-emerald-300 shadow-2xl flex items-center gap-2.5 animate-in zoom-in-95 pointer-events-none">
                    <FastForward className="w-5 h-5" />
                    <div className="text-center">
                      <span className="text-xs font-bold uppercase tracking-wider block">
                        {simSeek >= 0 ? 'Fast Forward' : 'Rewind'}
                      </span>
                      <span className="text-sm font-black tabular-nums">
                        {simSeek >= 0 ? `+${simSeek}s` : `${simSeek}s`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Double Tap Ripple Simulation */}
                {simRipple === 'left' && (
                  <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-amber-400/30 border border-amber-400 animate-ping pointer-events-none flex items-center justify-center text-amber-300 font-bold text-xs">
                    -10s
                  </div>
                )}
                {simRipple === 'right' && (
                  <div className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-cyan-400/30 border border-cyan-400 animate-ping pointer-events-none flex items-center justify-center text-cyan-300 font-bold text-xs">
                    +10s
                  </div>
                )}

                {/* Touch/Mouse drag instruction bottom banner */}
                <div className="relative z-10 text-center pointer-events-none">
                  <span className="text-[11px] text-white/70 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                    Click & drag anywhere inside this screen to test gestures
                  </span>
                </div>
              </div>

              {/* Gamified Checklist */}
              <div
                className="p-4 rounded-2xl border space-y-2.5"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Practice Checklist:</span>
                  </span>
                  {allMastered ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                      <Check className="w-3.5 h-3.5" /> All Gestures Mastered!
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Try all 4 actions to complete</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                      mastered.brightness
                        ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                        : 'border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5" />
                      <span>Left Drag (Brightness)</span>
                    </span>
                    {mastered.brightness ? (
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500">pending</span>
                    )}
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                      mastered.volume
                        ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                        : 'border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Right Drag (Volume)</span>
                    </span>
                    {mastered.volume ? (
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500">pending</span>
                    )}
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                      mastered.seek
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <FastForward className="w-3.5 h-3.5" />
                      <span>Horizontal Drag (Seek)</span>
                    </span>
                    {mastered.seek ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500">pending</span>
                    )}
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                      mastered.doubleTap
                        ? 'border-purple-400/40 bg-purple-400/10 text-purple-300'
                        : 'border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Double-Tap (±10s)</span>
                    </span>
                    {mastered.doubleTap ? (
                      <Check className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500">pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4">
              {/* Visual Split Diagram */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Left: Brightness */}
                <div className="rounded-2xl bg-white/5 border border-amber-400/20 p-4 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-white">Left Swipe ↕</div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    Drag vertically on the left half to adjust screen brightness smoothly.
                  </p>
                </div>

                {/* Center: Seek */}
                <div className="rounded-2xl bg-white/5 border border-emerald-400/20 p-4 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center">
                    <FastForward className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-white">Center Swipe ↔</div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    Drag horizontally across any section of the player to scrub forward or backward.
                  </p>
                </div>

                {/* Right: Volume */}
                <div className="rounded-2xl bg-white/5 border border-cyan-400/20 p-4 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-cyan-400/20 text-cyan-300 flex items-center justify-center">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-white">Right Swipe ↕</div>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    Drag vertically on the right half to adjust audio playback volume.
                  </p>
                </div>
              </div>

              {/* Keyboard Shortcuts Reference Table */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Desktop Keyboard Shortcuts</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'Space / K', desc: 'Play / Pause toggle' },
                    { key: '← / →', desc: 'Seek backward / forward 5s' },
                    { key: '↑ / ↓', desc: 'Increase / decrease volume' },
                    { key: 'F', desc: 'Toggle Fullscreen mode' },
                    { key: 'M', desc: 'Mute / Unmute audio' },
                    { key: 'O', desc: 'Lock Orientation (Pin)' },
                    { key: 'E', desc: 'Enhancement Suite' },
                    { key: 'C', desc: 'Toggle Subtitles (CC)' },
                    { key: '? / H', desc: 'Open this Gesture Guide' },
                  ].map((sc, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between text-xs"
                    >
                      <span className="font-mono font-bold text-amber-300 bg-white/10 px-2 py-0.5 rounded-md text-[10px]">
                        {sc.key}
                      </span>
                      <span className="text-[11px] text-slate-300 text-right truncate ml-2">
                        {sc.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3">
              {/* Enable/Disable Master */}
              <div
                className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-white">Master Gestures</div>
                  <div className="text-xs text-slate-400">
                    Enable touch and mouse drag gestures in video player
                  </div>
                </div>

                <button
                  type="button"
                  id="toggle-master-gestures-btn"
                  onClick={() => {
                    const next = !gestureSettings.enabled;
                    onUpdateGestureSettings({ enabled: next });
                    onShowToast(next ? 'Player gestures enabled' : 'Player gestures disabled');
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                    gestureSettings.enabled ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform ${
                      gestureSettings.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Show Gesture Hints */}
              <div
                className="flex items-center justify-between p-3.5 rounded-2xl border transition-all"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-white">On-Screen Gesture Hint Bar</div>
                  <div className="text-xs text-slate-400">
                    Show subtle helper chip at bottom when controls are revealed
                  </div>
                </div>

                <button
                  type="button"
                  id="toggle-gesture-hints-btn"
                  onClick={() => {
                    const next = !gestureSettings.showGestureHints;
                    onUpdateGestureSettings({ showGestureHints: next });
                    onShowToast(next ? 'Gesture hints enabled' : 'Gesture hints hidden');
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                    gestureSettings.showGestureHints ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform ${
                      gestureSettings.showGestureHints ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Direct Increase System (15-step discrete) */}
              <div
                className="flex items-center justify-between p-3.5 rounded-2xl border"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-white">Direct Increase System</div>
                  <div className="text-xs text-slate-400">
                    Use standard 15 discrete system steps for volume and brightness gestures
                  </div>
                </div>

                <button
                  type="button"
                  id="toggle-direct-increase-system-btn"
                  onClick={() => {
                    const next = !(gestureSettings.directIncreaseSystem ?? true);
                    onUpdateGestureSettings({ directIncreaseSystem: next });
                    onShowToast(next ? 'Direct increase system enabled' : 'Continuous gestures enabled');
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                    (gestureSettings.directIncreaseSystem ?? true) ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform ${
                      (gestureSettings.directIncreaseSystem ?? true) ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Double Tap Skip Duration */}
              <div
                className="p-4 rounded-2xl border space-y-2.5"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="text-sm font-semibold text-white">Double-Tap Skip Interval</div>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      id={`skip-sec-${sec}-btn`}
                      onClick={() => {
                        onUpdateGestureSettings({ doubleTapSeekSeconds: sec });
                        onShowToast(`Double-tap skip set to ±${sec}s`);
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        (gestureSettings.doubleTapSeekSeconds || 10) === sec
                          ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span>{sec}s</span>
                      {(gestureSettings.doubleTapSeekSeconds || 10) === sec && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between shrink-0"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="text-xs text-slate-400 hidden sm:block">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">?</kbd> anytime to open this guide
          </div>

          <button
            type="button"
            id="done-gestures-btn"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 cursor-pointer ml-auto"
            style={{ backgroundColor: themeColors.primary }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
