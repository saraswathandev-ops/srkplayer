import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  Sun,
  Eye,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  Zap,
  Check,
  Film,
  Moon,
  Tv,
  Layers,
  Flame,
  Radio,
  Headphones,
  Maximize2,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import {
  VIDEO_COLOR_PRESETS,
  AUDIO_ENHANCE_PRESETS,
  DEFAULT_VIDEO_COLOR_SETTINGS,
  DEFAULT_AUDIO_ENHANCE_SETTINGS,
} from '../constants/theme';
import { VideoColorPreset, AudioEnhancePreset } from '../types';

interface EnhancementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'video' | 'audio';
}

export function EnhancementModal({
  isOpen,
  onClose,
  initialTab = 'video',
}: EnhancementModalProps) {
  const {
    settings,
    themeColors,
    brightness,
    setBrightness,
    videoColorSettings,
    updateVideoColorSettings,
    setVideoColorPreset,
    resetVideoColorSettings,
    audioEnhanceSettings,
    updateAudioEnhanceSettings,
    setAudioEnhancePreset,
    resetAudioEnhanceSettings,
    showToast,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'video' | 'audio'>(initialTab);
  const [isHoldingBypass, setIsHoldingBypass] = useState(false);

  if (!isOpen) return null;

  const isDark = settings.theme === 'dark';
  const color = videoColorSettings || DEFAULT_VIDEO_COLOR_SETTINGS;
  const audio = audioEnhanceSettings || DEFAULT_AUDIO_ENHANCE_SETTINGS;

  return (
    <div
      id="enhancement-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        id="enhancement-modal-card"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden transition-all duration-200"
        style={{
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          color: isDark ? '#f8fafc' : '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
                Enhancement Suite
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30">
                  Pro Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Precision color grading, brightness tuning & acoustic audio enhancement
              </p>
            </div>
          </div>

          <button
            type="button"
            id="enhancement-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Enhancement Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Live Comparison Bar */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b gap-3 flex-wrap"
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }}
        >
          {/* Tab Selector */}
          <div
            className="flex items-center p-1 rounded-2xl border gap-1"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <button
              type="button"
              id="enhancement-tab-video-btn"
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'video'
                  ? 'text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: activeTab === 'video' ? themeColors.primary : 'transparent',
              }}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Video Color</span>
              {color.enabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              type="button"
              id="enhancement-tab-audio-btn"
              onClick={() => setActiveTab('audio')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'audio'
                  ? 'text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: activeTab === 'audio' ? themeColors.primary : 'transparent',
              }}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Audio Boost</span>
              {audio.enabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>

          {/* Quick Comparison / Reset Controls */}
          <div className="flex items-center gap-2">
            {activeTab === 'video' ? (
              <button
                type="button"
                id="reset-video-colors-btn"
                onClick={resetVideoColorSettings}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Reset video colors to standard defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Colors</span>
              </button>
            ) : (
              <button
                type="button"
                id="reset-audio-enhancements-btn"
                onClick={resetAudioEnhanceSettings}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Reset audio enhancements to flat/balanced"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Audio</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* ======================================================== */}
          {/* VIDEO COLOR ENHANCEMENT TAB */}
          {/* ======================================================== */}
          {activeTab === 'video' && (
            <div className="space-y-6">
              {/* Master Video Color Toggle */}
              <div
                className="flex items-center justify-between p-4 rounded-2xl border"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl transition-colors ${
                      color.enabled
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Video Color Grading</h4>
                    <p className="text-xs text-slate-400">
                      Real-time GPU contrast, vibrancy, warmth & tone calibration
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="video-color-master-toggle"
                    checked={color.enabled}
                    onChange={(e) => {
                      updateVideoColorSettings({ enabled: e.target.checked });
                      showToast(
                        e.target.checked
                          ? 'Video Color Enhancement Enabled'
                          : 'Video Color Enhancement Bypassed'
                      );
                    }}
                    className="sr-only peer"
                  />
                  <div
                    className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"
                  />
                </label>
              </div>

              {/* Color Presets Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Cinema & Visual Presets
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Select a curated visual profile
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(VIDEO_COLOR_PRESETS).map(([key, p]) => {
                    const isSelected = color.preset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        id={`video-preset-${key}`}
                        onClick={() => setVideoColorPreset(key as VideoColorPreset)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/15 shadow-md shadow-indigo-500/10'
                            : 'border-white/5 hover:border-white/20 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-white truncate">
                            {p.name.split(' (')[0]}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                          {p.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fine Precision Adjustment Sliders */}
              <div
                className="p-4 sm:p-5 rounded-2xl border space-y-4"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}
              >
                <div className="flex items-center justify-between pb-1 border-b border-white/5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Precision Color Controls
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Double-click label to reset slider
                  </span>
                </div>

                {/* Brightness Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-white"
                      onDoubleClick={() => setBrightness(1.0)}
                      title="Double-click to reset to 100%"
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      Brightness
                    </span>
                    <span className="font-bold text-amber-400 tabular-nums">
                      {Math.round(brightness * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-color-brightness"
                    min="0.3"
                    max="1.8"
                    step="0.05"
                    value={brightness}
                    onChange={(e) => setBrightness(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none bg-white/20 cursor-pointer accent-amber-400"
                  />
                </div>

                {/* Contrast Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-white"
                      onDoubleClick={() =>
                        updateVideoColorSettings({ contrast: 1.0, preset: 'custom' })
                      }
                      title="Double-click to reset to 100%"
                    >
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      Contrast (Dynamic Range)
                    </span>
                    <span className="font-bold text-sky-400 tabular-nums">
                      {Math.round(color.contrast * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-color-contrast"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={color.contrast}
                    onChange={(e) =>
                      updateVideoColorSettings({
                        contrast: parseFloat(e.target.value),
                        preset: 'custom',
                      })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none bg-white/20 cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Saturation / Vibrancy */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-white"
                      onDoubleClick={() =>
                        updateVideoColorSettings({ saturation: 1.0, preset: 'custom' })
                      }
                      title="Double-click to reset to 100%"
                    >
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      Saturation / Vibrancy
                    </span>
                    <span className="font-bold text-rose-400 tabular-nums">
                      {Math.round(color.saturation * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-color-saturation"
                    min="0.0"
                    max="2.5"
                    step="0.05"
                    value={color.saturation}
                    onChange={(e) =>
                      updateVideoColorSettings({
                        saturation: parseFloat(e.target.value),
                        preset: 'custom',
                      })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none bg-white/20 cursor-pointer accent-rose-400"
                  />
                </div>

                {/* Warmth (Blue Light Filter) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-white"
                      onDoubleClick={() =>
                        updateVideoColorSettings({ warmth: 0.0, preset: 'custom' })
                      }
                      title="Double-click to reset to 0%"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-300" />
                      Warmth (Eye-Care Blue Filter)
                    </span>
                    <span className="font-bold text-amber-300 tabular-nums">
                      {Math.round(color.warmth * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-color-warmth"
                    min="0.0"
                    max="1.0"
                    step="0.02"
                    value={color.warmth}
                    onChange={(e) =>
                      updateVideoColorSettings({
                        warmth: parseFloat(e.target.value),
                        preset: 'custom',
                      })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none bg-white/20 cursor-pointer accent-amber-300"
                  />
                </div>

                {/* Hue Tint Rotate */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-white"
                      onDoubleClick={() =>
                        updateVideoColorSettings({ hue: 0, preset: 'custom' })
                      }
                      title="Double-click to reset to 0°"
                    >
                      <Radio className="w-3.5 h-3.5 text-purple-400" />
                      Hue Tint
                    </span>
                    <span className="font-bold text-purple-400 tabular-nums">
                      {color.hue > 0 ? `+${color.hue}°` : `${color.hue}°`}
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-color-hue"
                    min="-180"
                    max="180"
                    step="5"
                    value={color.hue}
                    onChange={(e) =>
                      updateVideoColorSettings({
                        hue: parseInt(e.target.value, 10),
                        preset: 'custom',
                      })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none bg-white/20 cursor-pointer accent-purple-400"
                  />
                </div>

                {/* Quick Feature Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Sharpness Edge Pop */}
                  <label
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="text-xs font-bold text-white">Sharpness Edge Pop</div>
                        <div className="text-[10px] text-slate-400">Micro-contrast enhancement</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={color.sharpness}
                      onChange={(e) =>
                        updateVideoColorSettings({
                          sharpness: e.target.checked,
                          preset: 'custom',
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-800 border-slate-600"
                    />
                  </label>

                  {/* Night Invert / Negative */}
                  <label
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <div>
                        <div className="text-xs font-bold text-white">Inverted Night Mode</div>
                        <div className="text-[10px] text-slate-400">Negative light for extreme dark</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={color.invert}
                      onChange={(e) =>
                        updateVideoColorSettings({
                          invert: e.target.checked,
                          preset: 'custom',
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-500 focus:ring-0 bg-slate-800 border-slate-600"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* AUDIO ENHANCEMENT TAB */}
          {/* ======================================================== */}
          {activeTab === 'audio' && (
            <div className="space-y-6">
              {/* Master Audio Enhance Toggle */}
              <div
                className="flex items-center justify-between p-4 rounded-2xl border"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl transition-colors ${
                      audio.enabled
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Audio Enhancement Engine</h4>
                    <p className="text-xs text-slate-400">
                      Super-volume boost, dialogue clarity & low-end sub-bass punch
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="audio-enhance-master-toggle"
                    checked={audio.enabled}
                    onChange={(e) => {
                      updateAudioEnhanceSettings({ enabled: e.target.checked });
                      showToast(
                        e.target.checked
                          ? 'Audio Enhancement Engine Enabled'
                          : 'Audio Enhancement Engine Bypassed'
                      );
                    }}
                    className="sr-only peer"
                  />
                  <div
                    className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"
                  />
                </label>
              </div>

              {/* Audio Presets Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Acoustic & Clarity Presets
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Optimized curves for speeches, movies, and music
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(AUDIO_ENHANCE_PRESETS).map(([key, p]) => {
                    const isSelected = audio.preset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        id={`audio-preset-${key}`}
                        onClick={() => setAudioEnhancePreset(key as AudioEnhancePreset)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/15 shadow-md shadow-emerald-500/10'
                            : 'border-white/5 hover:border-white/20 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-white truncate">
                            {p.name.split(' /')[0]}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                          {p.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audio Enhancement Precision Sliders */}
              <div
                className="p-4 sm:p-5 rounded-2xl border space-y-4"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}
              >
                <div className="flex items-center justify-between pb-1 border-b border-white/5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Acoustic Tuning Parameters
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Hardware-safe Web Audio DSP
                  </span>
                </div>

                {/* Volume Super-Boost (100% to 200%) */}
                <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer"
                      onDoubleClick={() =>
                        updateAudioEnhanceSettings({ volumeBoost: 100, preset: 'custom' })
                      }
                      title="Double-click to reset to 100%"
                    >
                      <Zap className="w-4 h-4 text-amber-400" />
                      Super-Volume Booster (Up to 200%)
                    </span>
                    <span className="font-extrabold text-amber-300 tabular-nums">
                      {audio.volumeBoost}%
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-audio-volumeboost"
                    min="100"
                    max="200"
                    step="5"
                    value={audio.volumeBoost}
                    onChange={(e) =>
                      updateAudioEnhanceSettings({
                        volumeBoost: parseInt(e.target.value, 10),
                        preset: 'custom',
                      })
                    }
                    className="w-full h-2 rounded-lg appearance-none bg-black/40 cursor-pointer accent-amber-400"
                  />
                  <p className="text-[10px] text-amber-300/80">
                    Amplifies low-recorded videos and movies beyond 100% volume with automatic anti-clipping limiter.
                  </p>
                </div>

                {/* Vocal & Dialogue Clarity */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-white"
                      onDoubleClick={() =>
                        updateAudioEnhanceSettings({ vocalClarity: 0, preset: 'custom' })
                      }
                      title="Double-click to reset to 0 dB"
                    >
                      <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                      Dialogue & Vocal Clarity (1-3.5 kHz)
                    </span>
                    <span className="font-bold text-cyan-400 tabular-nums">
                      {audio.vocalClarity > 0 ? `+${audio.vocalClarity} dB` : '0 dB'}
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-audio-vocalclarity"
                    min="0"
                    max="10"
                    step="1"
                    value={audio.vocalClarity}
                    onChange={(e) =>
                      updateAudioEnhanceSettings({
                        vocalClarity: parseInt(e.target.value, 10),
                        preset: 'custom',
                      })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none bg-white/20 cursor-pointer accent-cyan-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Lifts human speech presence so character voices remain crystal clear during loud background music and sound effects.
                  </p>
                </div>

                {/* Sub-Bass Boost */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-white"
                      onDoubleClick={() =>
                        updateAudioEnhanceSettings({ bassBoost: 0, preset: 'custom' })
                      }
                      title="Double-click to reset to 0 dB"
                    >
                      <Radio className="w-3.5 h-3.5 text-indigo-400" />
                      Sub-Bass Punch (80 Hz Low-Shelf)
                    </span>
                    <span className="font-bold text-indigo-400 tabular-nums">
                      {audio.bassBoost > 0 ? `+${audio.bassBoost} dB` : '0 dB'}
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-audio-bassboost"
                    min="0"
                    max="12"
                    step="1"
                    value={audio.bassBoost}
                    onChange={(e) =>
                      updateAudioEnhanceSettings({
                        bassBoost: parseInt(e.target.value, 10),
                        preset: 'custom',
                      })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none bg-white/20 cursor-pointer accent-indigo-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Provides warm, tactile low-frequency rumble for movie action sequences, explosions, and modern beats.
                  </p>
                </div>

                {/* Treble Sparkle */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer hover:text-white"
                      onDoubleClick={() =>
                        updateAudioEnhanceSettings({ trebleBoost: 0, preset: 'custom' })
                      }
                      title="Double-click to reset to 0 dB"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Treble Detail & Air (9 kHz High-Shelf)
                    </span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {audio.trebleBoost > 0 ? `+${audio.trebleBoost} dB` : '0 dB'}
                    </span>
                  </div>
                  <input
                    type="range"
                    id="slider-audio-trebleboost"
                    min="0"
                    max="8"
                    step="1"
                    value={audio.trebleBoost}
                    onChange={(e) =>
                      updateAudioEnhanceSettings({
                        trebleBoost: parseInt(e.target.value, 10),
                        preset: 'custom',
                      })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none bg-white/20 cursor-pointer accent-emerald-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-t text-xs"
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="text-[11px] text-slate-400">
            Changes apply instantly in real-time to active playback.
          </div>

          <button
            type="button"
            id="enhancement-modal-done-btn"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            style={{ backgroundColor: themeColors.primary }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
