import React from 'react';
import {
  Sun,
  Volume2,
  FastForward,
  ArrowLeftRight,
  ArrowUpDown,
  Sliders,
  RotateCcw,
  Check,
  Sparkles,
  Smartphone,
  Eye,
  Zap,
  Info,
} from 'lucide-react';
import { GestureSettings, SwipeAction } from '../types';
import { DEFAULT_GESTURE_SETTINGS } from '../constants/theme';
import { usePlayer } from '../context/PlayerContext';

interface SwipeGestureSettingsSectionProps {
  onOpenSandbox?: () => void;
}

const ACTION_OPTIONS: { id: SwipeAction; label: string; icon: React.ElementType; description: string; color: string }[] = [
  {
    id: 'brightness',
    label: 'Brightness',
    icon: Sun,
    description: 'Adjust screen brightness (0.25x to 1.8x)',
    color: '#F59E0B',
  },
  {
    id: 'volume',
    label: 'Volume',
    icon: Volume2,
    description: 'Adjust playback audio level (0% to 100%)',
    color: '#06B6D4',
  },
  {
    id: 'seek',
    label: 'Seek Scrub',
    icon: FastForward,
    description: 'Scrub backward / forward through video timeline',
    color: '#10B981',
  },
  {
    id: 'none',
    label: 'Disabled',
    icon: RotateCcw,
    description: 'Deactivate gesture for this side',
    color: '#64748B',
  },
];

const SEEK_PRESETS = [
  { label: 'Fine (0.5x)', value: 0.5, desc: 'Precise ~45s sweep' },
  { label: 'Normal (1.0x)', value: 1.0, desc: 'Balanced ~90s sweep' },
  { label: 'Fast (1.5x)', value: 1.5, desc: 'Quick ~135s sweep' },
  { label: 'Ultra (2.0x)', value: 2.0, desc: 'High-speed ~180s sweep' },
];

export function SwipeGestureSettingsSection({ onOpenSandbox }: SwipeGestureSettingsSectionProps) {
  const { settings, updateSettings, themeColors } = usePlayer();
  const isDark = settings.theme === 'dark';

  const gesture: GestureSettings = {
    ...DEFAULT_GESTURE_SETTINGS,
    ...(settings.gestureSettings || {}),
  };

  const handleUpdate = (patch: Partial<GestureSettings>) => {
    updateSettings({
      gestureSettings: {
        ...gesture,
        ...patch,
      },
    });
  };

  const handleSwapSides = () => {
    handleUpdate({
      leftVerticalAction: gesture.rightVerticalAction,
      rightVerticalAction: gesture.leftVerticalAction,
    });
  };

  const handleResetToDefault = () => {
    handleUpdate(DEFAULT_GESTURE_SETTINGS);
  };

  // Find info for current bindings
  const leftActionInfo = ACTION_OPTIONS.find((a) => a.id === gesture.leftVerticalAction) || ACTION_OPTIONS[0];
  const rightActionInfo = ACTION_OPTIONS.find((a) => a.id === gesture.rightVerticalAction) || ACTION_OPTIONS[1];
  const horizActionInfo = ACTION_OPTIONS.find((a) => a.id === gesture.horizontalSwipeAction) || ACTION_OPTIONS[2];

  const LeftIcon = leftActionInfo.icon;
  const RightIcon = rightActionInfo.icon;
  const HorizIcon = horizActionInfo.icon;

  return (
    <div id="swipe-gesture-settings-section" className="space-y-6">
      {/* SECTION HEADER CARD */}
      <section
        className="p-5 rounded-3xl border space-y-4"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${themeColors.primary}25`,
                borderColor: `${themeColors.primary}45`,
                color: themeColors.primary,
              }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">Swipe Gestures & Rebinding</h3>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                  style={{
                    backgroundColor: gesture.enabled ? `${themeColors.primary}20` : 'rgba(255,255,255,0.05)',
                    color: gesture.enabled ? themeColors.primary : '#94A3B8',
                    borderColor: gesture.enabled ? `${themeColors.primary}40` : 'transparent',
                  }}
                >
                  {gesture.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rebind left and right vertical edges to Volume or Brightness, configure horizontal scrubbing, and adjust swipe sensitivity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => handleUpdate({ enabled: !gesture.enabled })}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
              style={{
                backgroundColor: gesture.enabled ? themeColors.primary : 'transparent',
                color: gesture.enabled ? '#ffffff' : '#94A3B8',
                borderColor: gesture.enabled ? 'transparent' : isDark ? '#334155' : '#CBD5E1',
              }}
            >
              {gesture.enabled ? 'Enabled' : 'Disabled'}
            </button>
            {onOpenSandbox && (
              <button
                onClick={onOpenSandbox}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Practice Sandbox</span>
              </button>
            )}
          </div>
        </div>

        {/* INTERACTIVE SCREEN SCHEMATIC PREVIEW */}
        <div
          className="p-4 rounded-2xl border relative overflow-hidden flex flex-col gap-3"
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.03)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Current Video Player Screen Mapping</span>
            </div>
            <button
              id="btn-swap-gesture-sides"
              onClick={handleSwapSides}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 transition-all cursor-pointer"
              title="Instantly swap left and right gesture controls"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Swap Left & Right</span>
            </button>
          </div>

          {/* Player screen mockup */}
          <div className="relative h-28 sm:h-32 rounded-xl bg-slate-950/80 border border-white/10 flex items-stretch overflow-hidden select-none">
            {/* Left Edge Zone */}
            <div
              className="flex-1 border-r border-dashed border-white/15 p-2 flex flex-col items-center justify-center gap-1 transition-colors relative"
              style={{
                backgroundColor: `${leftActionInfo.color}15`,
              }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Left Half (Vertical)</span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: `${leftActionInfo.color}30`, color: leftActionInfo.color }}
              >
                <LeftIcon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white tracking-tight">{leftActionInfo.label}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {gesture.invertVerticalSwipe ? '↕ Inverted' : '↕ Normal'}
              </span>
            </div>

            {/* Center Horizontal Zone */}
            <div className="w-24 sm:w-32 flex flex-col items-center justify-center gap-1 p-2 bg-white/[0.02]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Horizontal</span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: `${horizActionInfo.color}30`, color: horizActionInfo.color }}
              >
                <HorizIcon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white tracking-tight">{horizActionInfo.label}</span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {gesture.seekSensitivity}x Speed
              </span>
            </div>

            {/* Right Edge Zone */}
            <div
              className="flex-1 border-l border-dashed border-white/15 p-2 flex flex-col items-center justify-center gap-1 transition-colors relative"
              style={{
                backgroundColor: `${rightActionInfo.color}15`,
              }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Right Half (Vertical)</span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: `${rightActionInfo.color}30`, color: rightActionInfo.color }}
              >
                <RightIcon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white tracking-tight">{rightActionInfo.label}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {gesture.invertVerticalSwipe ? '↕ Inverted' : '↕ Normal'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* REBINDING CONTROLS CARD */}
      <section
        className="p-5 rounded-3xl border space-y-5"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-sm">Gesture Action Rebinding</h3>
          </div>
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Vertical Swipe Assignment */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">
              Left Vertical Swipe Action
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              Action executed when swiping vertically on the left 50% of the screen.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_OPTIONS.map((opt) => {
                const isSelected = gesture.leftVerticalAction === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={`left-${opt.id}`}
                    id={`btn-rebind-left-${opt.id}`}
                    onClick={() => handleUpdate({ leftVerticalAction: opt.id })}
                    className="flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                        : 'transparent',
                      borderColor: isSelected ? opt.color : isDark ? themeColors.borderDark : themeColors.borderLight,
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{
                        backgroundColor: `${opt.color}25`,
                        color: opt.color,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-white">{opt.label}</p>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Vertical Swipe Assignment */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">
              Right Vertical Swipe Action
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              Action executed when swiping vertically on the right 50% of the screen.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_OPTIONS.map((opt) => {
                const isSelected = gesture.rightVerticalAction === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={`right-${opt.id}`}
                    id={`btn-rebind-right-${opt.id}`}
                    onClick={() => handleUpdate({ rightVerticalAction: opt.id })}
                    className="flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                        : 'transparent',
                      borderColor: isSelected ? opt.color : isDark ? themeColors.borderDark : themeColors.borderLight,
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{
                        backgroundColor: `${opt.color}25`,
                        color: opt.color,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-white">{opt.label}</p>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Horizontal Swipe Action */}
        <div className="pt-2 border-t" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Horizontal Swipe Action
          </label>
          <p className="text-[11px] text-slate-400 mb-3">
            Action executed when scrubbing horizontally left-to-right across the display.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ACTION_OPTIONS.map((opt) => {
              const isSelected = gesture.horizontalSwipeAction === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={`horiz-${opt.id}`}
                  id={`btn-rebind-horiz-${opt.id}`}
                  onClick={() => handleUpdate({ horizontalSwipeAction: opt.id })}
                  className="flex items-center gap-2 p-2.5 rounded-2xl border text-left transition-all cursor-pointer"
                  style={{
                    backgroundColor: isSelected
                      ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                      : 'transparent',
                    borderColor: isSelected ? opt.color : isDark ? themeColors.borderDark : themeColors.borderLight,
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                    style={{
                      backgroundColor: `${opt.color}25`,
                      color: opt.color,
                    }}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-semibold truncate text-white">{opt.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-white ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* SENSITIVITY CALIBRATION CARD */}
      <section
        className="p-5 rounded-3xl border space-y-6"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm">Swipe Seek Sensitivity Calibration</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {gesture.seekSensitivity.toFixed(2)}x Multiplier
          </span>
        </div>

        {/* Quick Sensitivity Presets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SEEK_PRESETS.map((preset) => {
            const isSelected = Math.abs(gesture.seekSensitivity - preset.value) < 0.05;
            return (
              <button
                key={preset.label}
                id={`btn-seek-preset-${preset.value}`}
                onClick={() => handleUpdate({ seekSensitivity: preset.value })}
                className="p-3 rounded-2xl border text-left transition-all cursor-pointer hover:border-emerald-400/50"
                style={{
                  backgroundColor: isSelected
                    ? isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)'
                    : 'transparent',
                  borderColor: isSelected ? '#10B981' : isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{preset.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{preset.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Seek Continuous Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300 flex items-center gap-1.5">
              <FastForward className="w-3.5 h-3.5 text-emerald-400" />
              <span>Continuous Seek Scrub Multiplier</span>
            </span>
            <span className="text-emerald-400 font-mono font-bold">
              {Math.round(gesture.seekSensitivity * 100)}% ({gesture.seekSensitivity}x)
            </span>
          </div>
          <input
            id="input-seek-sensitivity"
            type="range"
            min="0.25"
            max="2.5"
            step="0.05"
            value={gesture.seekSensitivity}
            onChange={(e) => handleUpdate({ seekSensitivity: parseFloat(e.target.value) })}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0.25x (Fine Control)</span>
            <span>1.0x (Standard)</span>
            <span>2.5x (Hyper Scrub)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-start gap-2 text-[11px] text-slate-300">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              At <strong>{gesture.seekSensitivity}x</strong>, swiping across the screen scrubs approximately{' '}
              <strong>{Math.round(90 * gesture.seekSensitivity)} seconds</strong> of video timeline.
            </span>
          </div>
        </div>

        {/* Volume & Brightness Sensitivity Multipliers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
          {/* Volume Sensitivity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Volume Swipe Sensitivity</span>
              </span>
              <span className="text-cyan-400 font-mono font-bold">
                {gesture.volumeSensitivity.toFixed(2)}x
              </span>
            </div>
            <input
              id="input-volume-sensitivity"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={gesture.volumeSensitivity}
              onChange={(e) => handleUpdate({ volumeSensitivity: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.5x (Gentle)</span>
              <span>1.0x</span>
              <span>2.0x (Rapid)</span>
            </div>
          </div>

          {/* Brightness Sensitivity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Brightness Swipe Sensitivity</span>
              </span>
              <span className="text-amber-400 font-mono font-bold">
                {gesture.brightnessSensitivity.toFixed(2)}x
              </span>
            </div>
            <input
              id="input-brightness-sensitivity"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={gesture.brightnessSensitivity}
              onChange={(e) => handleUpdate({ brightnessSensitivity: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.5x (Gentle)</span>
              <span>1.0x</span>
              <span>2.0x (Rapid)</span>
            </div>
          </div>
        </div>
      </section>

      {/* SWIPE DIRECTION & TACTILE BEHAVIOR */}
      <section
        className="p-5 rounded-3xl border space-y-4"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-sm">Swipe Directions & Tactile Feedback</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Invert Vertical Swipe */}
          <label
            className="flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-colors hover:border-purple-400/40"
            style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
          >
            <div>
              <p className="text-xs font-bold text-white">Invert Vertical Swipe</p>
              <p className="text-[11px] text-slate-400">
                {gesture.invertVerticalSwipe
                  ? 'Inverted: Swipe down to increase, swipe up to decrease'
                  : 'Standard: Swipe up to increase, swipe down to decrease'}
              </p>
            </div>
            <input
              id="checkbox-invert-vertical"
              type="checkbox"
              checked={gesture.invertVerticalSwipe}
              onChange={(e) => handleUpdate({ invertVerticalSwipe: e.target.checked })}
              className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
            />
          </label>

          {/* Invert Horizontal Seek */}
          <label
            className="flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-colors hover:border-purple-400/40"
            style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
          >
            <div>
              <p className="text-xs font-bold text-white">Invert Horizontal Scrub</p>
              <p className="text-[11px] text-slate-400">
                {gesture.invertHorizontalSwipe
                  ? 'Inverted: Swipe right to rewind, left to forward'
                  : 'Standard: Swipe right to forward, left to rewind'}
              </p>
            </div>
            <input
              id="checkbox-invert-horizontal"
              type="checkbox"
              checked={gesture.invertHorizontalSwipe}
              onChange={(e) => handleUpdate({ invertHorizontalSwipe: e.target.checked })}
              className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
            />
          </label>

          {/* Direct 15-step Android system */}
          <label
            className="flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-colors hover:border-purple-400/40"
            style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
          >
            <div>
              <p className="text-xs font-bold text-white">Direct 15-Step Android Levels</p>
              <p className="text-[11px] text-slate-400">
                Snap volume and brightness to native Android hardware audio and screen steps
              </p>
            </div>
            <input
              id="checkbox-direct-system"
              type="checkbox"
              checked={gesture.directIncreaseSystem}
              onChange={(e) => handleUpdate({ directIncreaseSystem: e.target.checked })}
              className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
            />
          </label>

          {/* Gesture Hints on Screen */}
          <label
            className="flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-colors hover:border-purple-400/40"
            style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
          >
            <div>
              <p className="text-xs font-bold text-white">Show On-Screen Gesture Hints</p>
              <p className="text-[11px] text-slate-400">
                Show edge guide pill indicators and live feedback HUD badges
              </p>
            </div>
            <input
              id="checkbox-gesture-hints"
              type="checkbox"
              checked={gesture.showGestureHints}
              onChange={(e) => handleUpdate({ showGestureHints: e.target.checked })}
              className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
            />
          </label>
        </div>

        {/* Double tap seek interval */}
        <div className="pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
          <div>
            <p className="text-xs font-bold text-white">Double-Tap Seek Interval</p>
            <p className="text-[11px] text-slate-400">
              Seconds skipped when double-tapping left (rewind) or right (forward) edges
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {[5, 10, 15, 30].map((sec) => {
              const isSelected = gesture.doubleTapSeekSeconds === sec;
              return (
                <button
                  key={sec}
                  id={`btn-double-tap-${sec}`}
                  onClick={() => handleUpdate({ doubleTapSeekSeconds: sec })}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? themeColors.primary : 'transparent',
                    color: isSelected ? '#ffffff' : '#94A3B8',
                    borderColor: isSelected ? themeColors.primary : isDark ? '#334155' : '#CBD5E1',
                  }}
                >
                  {sec}s
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
