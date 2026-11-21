import React from 'react';
import {
  X,
  Volume2,
  Repeat,
  Repeat1,
  Moon,
  Clock,
  Camera,
  Cpu,
  ZoomIn,
  Sparkles,
  Info,
  Sliders,
  Subtitles,
  RotateCcw,
  Scissors,
} from 'lucide-react';
import { LoopMode } from '../types';
import { formatTime } from '../utils/formatters';

export interface VideoQuickActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
  volumeBoost: number;
  onCycleVolumeBoost: () => void;
  loopMode: LoopMode;
  onCycleLoopMode: () => void;
  nightModeEnabled: boolean;
  onToggleNightMode: () => void;
  abLoop: { a: number | null; b: number | null; active: boolean };
  onABRepeatAction: () => void;
  onClearABRepeat: () => void;
  sleepTimerRemaining: number | null;
  sleepTimerEndTrack: boolean;
  onOpenSleepTimer: () => void;
  onCaptureScreenshot: () => void;
  decoderProfile: 'hw+' | 'hw' | 'sw';
  onCycleDecoderProfile: () => void;
  zoomScale: number;
  onResetZoom: () => void;
  onOpenEnhance: () => void;
  onOpenProperties: () => void;
  onOpenGestures: () => void;
  subtitlesEnabled: boolean;
  onToggleSubtitles: () => void;
}

export function VideoQuickActionsSheet({
  isOpen,
  onClose,
  themeColor,
  volumeBoost,
  onCycleVolumeBoost,
  loopMode,
  onCycleLoopMode,
  nightModeEnabled,
  onToggleNightMode,
  abLoop,
  onABRepeatAction,
  onClearABRepeat,
  sleepTimerRemaining,
  sleepTimerEndTrack,
  onOpenSleepTimer,
  onCaptureScreenshot,
  decoderProfile,
  onCycleDecoderProfile,
  zoomScale,
  onResetZoom,
  onOpenEnhance,
  onOpenProperties,
  onOpenGestures,
  subtitlesEnabled,
  onToggleSubtitles,
}: VideoQuickActionsSheetProps) {
  if (!isOpen) return null;

  const boostLabel = `${(volumeBoost / 100).toFixed(volumeBoost % 100 === 0 ? 0 : 2).replace(/\.00$/, '')}x`;
  const loopLabel = loopMode === 'one' ? 'Loop One' : loopMode === 'all' ? 'Loop All' : 'Loop Off';
  const abLabel =
    abLoop.a === null
      ? 'Set Point A'
      : abLoop.b === null
      ? 'Set Point B'
      : 'A-B Active';
  const abSubLabel =
    abLoop.a !== null && abLoop.b !== null
      ? `${formatTime(abLoop.a)}–${formatTime(abLoop.b)}`
      : abLoop.a !== null
      ? `A: ${formatTime(abLoop.a)}`
      : 'Segment loop';

  const sleepLabel =
    sleepTimerRemaining !== null
      ? `${Math.ceil(sleepTimerRemaining / 60)}m left`
      : sleepTimerEndTrack
      ? 'End of clip'
      : 'Off';

  return (
    <div
      id="video-quick-actions-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        id="video-quick-actions-sheet"
        className="w-full sm:max-w-xl bg-slate-950/92 backdrop-blur-2xl border-t sm:border border-white/12 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl text-slate-100 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle (Mobile) */}
        <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Quick Actions</h3>
            <p className="text-xs text-slate-400">Playback tools, audio boost, and display controls</p>
          </div>
          <button
            type="button"
            id="close-quick-actions-btn"
            onClick={onClose}
            aria-label="Close Quick Actions"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {/* 1. Volume Boost */}
          <button
            type="button"
            id="qa-volume-boost-btn"
            onClick={onCycleVolumeBoost}
            className={`min-h-[76px] p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              volumeBoost > 100
                ? 'bg-sky-500/15 border-sky-400/40 text-sky-200'
                : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Volume2 className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-semibold tabular-nums">{boostLabel}</span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Volume Boost</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">{volumeBoost}% output</div>
            </div>
          </button>

          {/* 2. Loop Mode */}
          <button
            type="button"
            id="qa-loop-mode-btn"
            onClick={onCycleLoopMode}
            className={`min-h-[76px] p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              loopMode !== 'none'
                ? 'bg-white/12 border-white/30 text-white'
                : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
            }`}
            style={loopMode !== 'none' ? { borderColor: themeColor } : undefined}
          >
            <div className="flex items-center justify-between w-full">
              {loopMode === 'one' ? (
                <Repeat1 className="w-4 h-4" style={{ color: themeColor }} />
              ) : (
                <Repeat className="w-4 h-4" style={{ color: loopMode === 'all' ? themeColor : '#94A3B8' }} />
              )}
              <span className="text-[11px] font-mono font-semibold uppercase">
                {loopMode}
              </span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Repeat</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">{loopLabel}</div>
            </div>
          </button>

          {/* 3. Night Mode */}
          <button
            type="button"
            id="qa-night-mode-btn"
            onClick={onToggleNightMode}
            className={`min-h-[76px] p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              nightModeEnabled
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Moon className={`w-4 h-4 ${nightModeEnabled ? 'text-amber-300' : 'text-slate-400'}`} />
              <span className="text-[11px] font-medium">{nightModeEnabled ? 'On' : 'Off'}</span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Night Mode</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">Warm dim tint</div>
            </div>
          </button>

          {/* 4. A-B Repeat */}
          <button
            type="button"
            id="qa-ab-repeat-btn"
            onClick={onABRepeatAction}
            onContextMenu={(e) => {
              e.preventDefault();
              onClearABRepeat();
            }}
            className={`min-h-[76px] p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              abLoop.active || abLoop.a !== null
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
            }`}
            title="Click to mark A, mark B, or clear. Right-click to clear."
          >
            <div className="flex items-center justify-between w-full">
              <Scissors className={`w-4 h-4 ${abLoop.active ? 'text-emerald-300' : 'text-slate-400'}`} />
              <span className="text-[11px] font-mono font-semibold">
                {abLoop.active ? 'A↔B' : abLoop.a !== null ? 'A→?' : 'A-B'}
              </span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">{abLabel}</div>
              <div className="text-[11px] text-slate-400 font-mono tabular-nums whitespace-nowrap truncate">
                {abSubLabel}
              </div>
            </div>
          </button>

          {/* 5. Sleep Timer */}
          <button
            type="button"
            id="qa-sleep-timer-btn"
            onClick={() => {
              onClose();
              onOpenSleepTimer();
            }}
            className={`min-h-[76px] p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              sleepTimerRemaining !== null || sleepTimerEndTrack
                ? 'bg-indigo-500/15 border-indigo-400/40 text-indigo-200'
                : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Clock className="w-4 h-4 text-indigo-300" />
              <span className="text-[11px] font-mono tabular-nums">{sleepLabel}</span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Sleep Timer</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">Auto pause</div>
            </div>
          </button>

          {/* 6. Screenshot */}
          <button
            type="button"
            id="qa-screenshot-btn"
            onClick={() => {
              onCaptureScreenshot();
              onClose();
            }}
            className="min-h-[76px] p-3 rounded-2xl border bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08] text-left flex flex-col justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <Camera className="w-4 h-4 text-slate-300" />
              <span className="text-[11px] text-slate-400">PNG</span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Screenshot</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">Save frame</div>
            </div>
          </button>

          {/* 7. Decoder Profile */}
          <button
            type="button"
            id="qa-decoder-btn"
            onClick={onCycleDecoderProfile}
            className="min-h-[76px] p-3 rounded-2xl border bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08] text-left flex flex-col justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <Cpu className="w-4 h-4 text-slate-300" />
              <span className="text-xs font-mono font-semibold uppercase">{decoderProfile}</span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Decoder</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">
                {decoderProfile === 'sw' ? 'Crisp filter' : 'Hardware'}
              </div>
            </div>
          </button>

          {/* 8. Zoom Reset */}
          <button
            type="button"
            id="qa-zoom-reset-btn"
            onClick={onResetZoom}
            className={`min-h-[76px] p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              zoomScale > 1.02
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              {zoomScale > 1.02 ? (
                <RotateCcw className="w-4 h-4 text-emerald-300" />
              ) : (
                <ZoomIn className="w-4 h-4 text-slate-300" />
              )}
              <span className="text-xs font-mono font-semibold tabular-nums">{zoomScale.toFixed(1)}x</span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">
                {zoomScale > 1.02 ? 'Reset Zoom' : 'Pinch Zoom'}
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">1.0x – 3.0x</div>
            </div>
          </button>

          {/* 9. Subtitles (CC) */}
          <button
            type="button"
            id="qa-subtitles-btn"
            onClick={onToggleSubtitles}
            className={`min-h-[76px] p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              subtitlesEnabled
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Subtitles className="w-4 h-4 text-amber-300" />
              <span className="text-[11px] font-medium">{subtitlesEnabled ? 'On' : 'Off'}</span>
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Subtitles</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">Dual captions</div>
            </div>
          </button>

          {/* 10. Color & Audio Enhance */}
          <button
            type="button"
            id="qa-enhance-btn"
            onClick={() => {
              onClose();
              onOpenEnhance();
            }}
            className="min-h-[76px] p-3 rounded-2xl border bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08] text-left flex flex-col justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Enhance</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">Color & EQ</div>
            </div>
          </button>

          {/* 11. Gesture Settings */}
          <button
            type="button"
            id="qa-gestures-btn"
            onClick={() => {
              onClose();
              onOpenGestures();
            }}
            className="min-h-[76px] p-3 rounded-2xl border bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08] text-left flex flex-col justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <Sliders className="w-4 h-4 text-slate-300" />
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Gestures</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">Zones & guide</div>
            </div>
          </button>

          {/* 12. Video Properties */}
          <button
            type="button"
            id="qa-properties-btn"
            onClick={() => {
              onClose();
              onOpenProperties();
            }}
            className="min-h-[76px] p-3 rounded-2xl border bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08] text-left flex flex-col justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <Info className="w-4 h-4 text-slate-300" />
            </div>
            <div>
              <div className="text-xs font-medium whitespace-nowrap truncate">Properties</div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">Media info</div>
            </div>
          </button>
        </div>

        {/* Clear A-B helper bar if A is set */}
        {(abLoop.a !== null || abLoop.b !== null) && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-300 font-mono tabular-nums">
              A-B Loop: {abLoop.a !== null ? formatTime(abLoop.a) : '--:--'} to{' '}
              {abLoop.b !== null ? formatTime(abLoop.b) : '--:--'}
            </span>
            <button
              type="button"
              id="qa-clear-ab-btn"
              onClick={onClearABRepeat}
              className="px-3 py-1.5 rounded-lg text-rose-300 hover:bg-rose-500/15 font-medium transition-colors cursor-pointer"
            >
              Clear A-B
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
