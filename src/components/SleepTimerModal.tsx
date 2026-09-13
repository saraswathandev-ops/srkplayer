import React, { useState } from 'react';
import {
  X,
  Clock,
  Moon,
  Power,
  RotateCcw,
  Check,
  Plus,
  Music,
  Sliders,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMER_PRESETS = [
  { minutes: 5, label: '5 min' },
  { minutes: 10, label: '10 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '60 min' },
  { minutes: 90, label: '90 min' },
];

export function SleepTimerModal({ isOpen, onClose }: SleepTimerModalProps) {
  const {
    settings,
    themeColors,
    sleepTimerRemaining,
    sleepTimerInitialSeconds,
    sleepTimerEndTrack,
    setSleepTimer,
    setSleepTimerAtTrackEnd,
    extendSleepTimer,
    cancelSleepTimer,
    activeMedia,
  } = usePlayer();

  const [customMinutes, setCustomMinutes] = useState(25);
  const [showCustomSlider, setShowCustomSlider] = useState(false);

  if (!isOpen) return null;

  const isDark = settings.theme === 'dark';
  const isTimerActive = sleepTimerRemaining !== null || sleepTimerEndTrack;

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent =
    sleepTimerInitialSeconds && sleepTimerRemaining !== null
      ? Math.max(
          0,
          Math.min(
            100,
            ((sleepTimerInitialSeconds - sleepTimerRemaining) / sleepTimerInitialSeconds) * 100
          )
        )
      : 0;

  const handleSelectPreset = (minutes: number) => {
    setSleepTimer(minutes);
  };

  const handleSelectEndTrack = () => {
    setSleepTimerAtTrackEnd();
  };

  const handleStartCustom = () => {
    setSleepTimer(customMinutes);
    setShowCustomSlider(false);
  };

  return (
    <div
      id="sleep-timer-modal-overlay"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="sleep-timer-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border p-6 space-y-5 shadow-2xl overflow-hidden relative select-none"
        style={{
          backgroundColor: isDark ? '#111420' : '#FFFFFF',
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Sleep Timer</h3>
              <p className="text-xs text-slate-400">
                Automatically pause audio when you fall asleep
              </p>
            </div>
          </div>

          <button
            id="sleep-timer-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Timer Card */}
        {isTimerActive && (
          <div
            id="sleep-timer-active-card"
            className="p-4 rounded-2xl border space-y-3"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              borderColor: themeColors.primary,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Timer Active
              </span>

              {sleepTimerRemaining !== null && (
                <span className="text-xs text-slate-400 font-mono">
                  {Math.ceil(sleepTimerRemaining / 60)} min left
                </span>
              )}
            </div>

            {sleepTimerRemaining !== null ? (
              <>
                <div className="text-center py-2">
                  <div
                    className="text-4xl font-extrabold font-mono tracking-wider tabular-nums"
                    style={{ color: themeColors.primary }}
                  >
                    {formatCountdown(sleepTimerRemaining)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Audio will automatically pause at 00:00
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-700/30 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${100 - progressPercent}%`,
                      backgroundColor: themeColors.primary,
                    }}
                  />
                </div>

                {/* Quick Extend Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Extend:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => extendSleepTimer(5)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-700 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> 5m
                    </button>
                    <button
                      onClick={() => extendSleepTimer(15)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-700 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> 15m
                    </button>
                    <button
                      onClick={() => extendSleepTimer(30)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-700 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> 30m
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-3">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-sky-400">
                  <Music className="w-4 h-4" />
                  <span>Pausing at end of track</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 truncate max-w-xs mx-auto">
                  {activeMedia?.title || 'Current track'}
                </p>
              </div>
            )}

            {/* Turn Off Button */}
            <button
              id="sleep-timer-cancel-btn"
              onClick={cancelSleepTimer}
              className="w-full py-2 rounded-xl text-xs font-semibold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Turn Off Sleep Timer</span>
            </button>
          </div>
        )}

        {/* Preset Countdown Selection */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Set Countdown
            </span>
            <button
              onClick={() => setShowCustomSlider(!showCustomSlider)}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showCustomSlider ? 'Hide Custom' : 'Custom Time'}</span>
            </button>
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-4 gap-2">
            {TIMER_PRESETS.map((preset) => {
              const isSelected =
                sleepTimerRemaining !== null &&
                Math.round(sleepTimerRemaining / 60) === preset.minutes;

              return (
                <button
                  key={preset.minutes}
                  id={`sleep-preset-${preset.minutes}`}
                  onClick={() => handleSelectPreset(preset.minutes)}
                  className={`py-2.5 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'text-white shadow-md'
                      : 'text-slate-300 hover:border-slate-500 hover:bg-white/5 border-slate-700/30'
                  }`}
                  style={{
                    backgroundColor: isSelected ? themeColors.primary : undefined,
                    borderColor: isSelected ? themeColors.primary : undefined,
                  }}
                >
                  <span>{preset.label}</span>
                </button>
              );
            })}

            {/* End of track option */}
            <button
              id="sleep-preset-end-track"
              onClick={handleSelectEndTrack}
              className={`py-2.5 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                sleepTimerEndTrack
                  ? 'text-white shadow-md'
                  : 'text-slate-300 hover:border-slate-500 hover:bg-white/5 border-slate-700/30'
              }`}
              style={{
                backgroundColor: sleepTimerEndTrack ? themeColors.primary : undefined,
                borderColor: sleepTimerEndTrack ? themeColors.primary : undefined,
              }}
              title="Pause playback when current audio finishes"
            >
              <span className="truncate w-full text-center">End of song</span>
            </button>
          </div>
        </div>

        {/* Custom Duration Slider */}
        {showCustomSlider && (
          <div
            id="sleep-timer-custom-section"
            className="p-4 rounded-2xl border space-y-3 animate-fade-in"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Custom Duration</span>
              <span className="font-mono font-bold text-sm" style={{ color: themeColors.primary }}>
                {customMinutes} minutes
              </span>
            </div>

            <input
              type="range"
              id="sleep-custom-minutes-slider"
              min="1"
              max="120"
              step="1"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 cursor-pointer"
              style={{ accentColor: themeColors.primary }}
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 min</span>
              <span>60 min</span>
              <span>120 min</span>
            </div>

            <button
              id="sleep-custom-apply-btn"
              onClick={handleStartCustom}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Start {customMinutes} Minute Timer</span>
            </button>
          </div>
        )}

        {/* Done Button */}
        <button
          id="sleep-timer-done-btn"
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl border text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
