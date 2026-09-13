import React from 'react';
import {
  X,
  Sun,
  Volume2,
  FastForward,
  RotateCcw,
  Sparkles,
  Sliders,
  Check,
  Smartphone,
  MousePointer,
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
}

export function VideoGesturesModal({
  isOpen,
  onClose,
  gestureSettings,
  onUpdateGestureSettings,
  themeColors,
  isDark,
  onShowToast,
}: VideoGesturesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="video-gestures-modal"
        className="w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: isDark ? 'rgba(15, 17, 26, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
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
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Player Gestures</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Modern
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Touch & drag swipe controls for video playback
              </p>
            </div>
          </div>

          <button
            id="close-gestures-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Interactive Visual Demonstration Card */}
          <div className="relative rounded-2xl bg-black/60 border border-white/10 p-5 overflow-hidden">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>How Gestures Work</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Left: Brightness */}
              <div className="rounded-xl bg-white/5 border border-amber-400/20 p-3.5 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <Sun className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-white">Left Swipe ↕</div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Swipe up/down on left half to adjust screen brightness
                </p>
              </div>

              {/* Center: Seek */}
              <div className="rounded-xl bg-white/5 border border-emerald-400/20 p-3.5 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center">
                  <FastForward className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-white">Center Swipe ↔</div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Swipe horizontally anywhere to scrub forward or backward
                </p>
              </div>

              {/* Right: Volume */}
              <div className="rounded-xl bg-white/5 border border-cyan-400/20 p-3.5 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-cyan-400/20 text-cyan-300 flex items-center justify-center">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-white">Right Swipe ↕</div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Swipe up/down on right half to adjust audio volume
                </p>
              </div>
            </div>

            {/* Quick tips list */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-300 gap-2">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <strong>Double-Tap:</strong> Skip ±10 seconds
              </span>
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
                Works on Touch & Mouse Drag
              </span>
            </div>
          </div>

          {/* Gesture Settings Toggles */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Gesture Preferences
            </h3>

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
                  Show subtle helper chip when player controls are revealed
                </div>
              </div>

              <button
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
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-end"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <button
            id="done-gestures-btn"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 cursor-pointer"
            style={{ backgroundColor: themeColors.primary }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
