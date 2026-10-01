import React, { useState } from 'react';
import {
  Sun,
  Volume2,
  FastForward,
  RotateCcw,
  RotateCw,
  X,
  Sparkles,
  Play,
  Sliders,
  Check,
  Smartphone,
  MousePointer,
  HelpCircle,
} from 'lucide-react';

interface VideoGesturesHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPlayground?: () => void;
  themeColor?: string;
}

export function VideoGesturesHelpOverlay({
  isOpen,
  onClose,
  onOpenPlayground,
  themeColor = '#6E60FF',
}: VideoGesturesHelpOverlayProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem('skr_gestures_help_dismissed', 'true');
    }
    onClose();
  };

  return (
    <div
      id="video-gestures-live-overlay"
      className="absolute inset-0 z-45 bg-black/80 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8 animate-fade-in select-none text-white pointer-events-auto"
      onClick={handleDismiss}
    >
      {/* Top Banner */}
      <div
        className="flex items-center justify-between max-w-4xl w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{ backgroundColor: themeColor }}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              Player Swipe Gestures Guide
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Interactive
              </span>
            </h2>
            <p className="text-xs text-slate-300">
              Control playback with intuitive touch swipes or mouse dragging anywhere on screen
            </p>
          </div>
        </div>

        <button
          type="button"
          id="close-gestures-help-overlay-btn"
          onClick={handleDismiss}
          className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="Close Guide (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Interactive Zone Diagrams */}
      <div
        className="flex-1 max-w-5xl w-full mx-auto my-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-stretch relative py-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Half: Brightness Zone */}
        <div className="rounded-3xl border-2 border-dashed border-amber-400/60 bg-amber-500/10 backdrop-blur-md p-5 sm:p-6 flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-amber-400 transition-colors shadow-2xl">
          <div className="absolute top-3 left-3 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-400/25 text-amber-300 border border-amber-400/40">
            Left Half of Screen
          </div>

          <div className="my-auto flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-400/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shadow-xl shadow-amber-500/20 animate-pulse">
                <Sun className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-amber-300 font-bold text-xs animate-bounce">
                ▲
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-amber-300 font-bold text-xs animate-bounce">
                ▼
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Swipe Up / Down: Brightness
              </h3>
              <p className="text-xs text-slate-300 max-w-xs">
                Drag vertically on the left side to smoothly raise or dim screen light level
              </p>
            </div>
          </div>

          {/* Double tap hint */}
          <div className="w-full pt-3 border-t border-amber-400/25 flex items-center justify-center gap-2 text-xs text-amber-200">
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>Double-tap left half to <strong>rewind 10s</strong></span>
          </div>
        </div>

        {/* Right Half: Volume Zone */}
        <div className="rounded-3xl border-2 border-dashed border-cyan-400/60 bg-cyan-500/10 backdrop-blur-md p-5 sm:p-6 flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-cyan-400 transition-colors shadow-2xl">
          <div className="absolute top-3 right-3 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-400/25 text-cyan-300 border border-cyan-400/40">
            Right Half of Screen
          </div>

          <div className="my-auto flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-cyan-400/20 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-xl shadow-cyan-500/20 animate-pulse">
                <Volume2 className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-cyan-300 font-bold text-xs animate-bounce">
                ▲
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-cyan-300 font-bold text-xs animate-bounce">
                ▼
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Swipe Up / Down: Volume
              </h3>
              <p className="text-xs text-slate-300 max-w-xs">
                Drag vertically on the right side to adjust audio output level
              </p>
            </div>
          </div>

          {/* Double tap hint */}
          <div className="w-full pt-3 border-t border-cyan-400/25 flex items-center justify-center gap-2 text-xs text-cyan-200">
            <RotateCw className="w-3.5 h-3.5 text-cyan-300" />
            <span>Double-tap right half to <strong>skip forward 10s</strong></span>
          </div>
        </div>

        {/* Center Overlay Ribbon: Seek Scrub */}
        <div className="md:col-span-2 rounded-2xl border-2 border-dashed border-emerald-400/60 bg-emerald-500/15 backdrop-blur-md px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <FastForward className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span>Horizontal Swipe Anywhere: Seek & Scrub</span>
                <span className="text-[10px] text-emerald-300 font-mono">◀ ─── ▶</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Drag left or right horizontally across any part of the screen to fast-forward or rewind
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-200 shrink-0 font-medium">
            <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
            <MousePointer className="w-3.5 h-3.5 text-emerald-300" />
            <span>Touch or Mouse Click-Drag</span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div
        className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl w-full mx-auto pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-500 bg-black/50 border-white/30 focus:ring-0 cursor-pointer"
          />
          <span>Don't show this overlay automatically again</span>
        </label>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {onOpenPlayground && (
            <button
              type="button"
              id="open-playground-from-overlay-btn"
              onClick={() => {
                onClose();
                onOpenPlayground();
              }}
              className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Interactive Practice Mode</span>
            </button>
          )}

          <button
            type="button"
            id="dismiss-gestures-help-overlay-btn"
            onClick={handleDismiss}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            style={{ backgroundColor: themeColor }}
          >
            <Check className="w-4 h-4" />
            <span>Got It! Start Watching</span>
          </button>
        </div>
      </div>
    </div>
  );
}
