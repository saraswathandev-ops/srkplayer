import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Sliders,
  Tv,
  Film,
  Headphones,
  Volume2,
  Zap,
  Check,
  RotateCcw,
  Sun,
  Layers,
  Flame,
  Eye,
  Radio,
  Moon,
  Volume1,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import {
  VIDEO_COLOR_PRESETS,
  AUDIO_ENHANCE_PRESETS,
  DEFAULT_VIDEO_COLOR_SETTINGS,
  DEFAULT_AUDIO_ENHANCE_SETTINGS,
} from '../constants/theme';
import { VideoColorPreset, AudioEnhancePreset } from '../types';
import { audioEqualizer } from '../services/audioEqualizer';

export function EnhancementsTab() {
  const {
    settings,
    themeColors,
    videoColorSettings,
    updateVideoColorSettings,
    setVideoColorPreset,
    resetVideoColorSettings,
    audioEnhanceSettings,
    updateAudioEnhanceSettings,
    setAudioEnhancePreset,
    resetAudioEnhanceSettings,
    showToast,
    isPlaying,
  } = usePlayer();

  const isDark = settings.theme === 'dark';
  const color = videoColorSettings || DEFAULT_VIDEO_COLOR_SETTINGS;
  const audio = audioEnhanceSettings || DEFAULT_AUDIO_ENHANCE_SETTINGS;

  // Real-time mini spectrum visualizer for audio enhancement feedback
  const [meterBars, setMeterBars] = useState<number[]>(() => new Array(18).fill(4));

  useEffect(() => {
    let animId: number;
    const freqBuffer = new Uint8Array(64);
    const updateMeter = () => {
      if (isPlaying && audioEqualizer.getIsInitialized()) {
        const hasData = audioEqualizer.getFrequencyData(freqBuffer);
        if (hasData) {
          const step = Math.floor(freqBuffer.length / 18);
          const bars: number[] = [];
          for (let i = 0; i < 18; i++) {
            const val = freqBuffer[i * step] || 0;
            // Scale 0-255 to 4-36px height
            bars.push(Math.max(4, Math.round((val / 255) * 36)));
          }
          setMeterBars(bars);
        }
      } else {
        setMeterBars((prev) => prev.map((v) => Math.max(4, Math.round(v * 0.9))));
      }
      animId = requestAnimationFrame(updateMeter);
    };

    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  return (
    <div id="enhancements-tab-container" className="space-y-6">
      {/* Overview Banner */}
      <div
        className="p-5 rounded-3xl border relative overflow-hidden"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="p-3 rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Hardware-Accelerated Enhancement Suite</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                GPU-powered CSS video color matrix & real-time Web Audio API DSP pipeline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              id="reset-all-enhancements-btn"
              onClick={() => {
                resetVideoColorSettings();
                resetAudioEnhanceSettings();
                showToast('All enhancements reset to neutral defaults');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Both</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. VIDEO COLOR GRADING SUITE */}
      {/* ========================================================== */}
      <section
        id="settings-video-color-section"
        className="p-5 sm:p-6 rounded-3xl border space-y-6"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        {/* Section Header with Master Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold flex items-center gap-2">
                Video Color Enhancement & Visual Grading
                {color.enabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </h4>
              <p className="text-xs text-slate-400">
                Calibrate dynamic range, contrast pop, eye-care warmth, and saturation vibrancy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="settings-video-color-toggle"
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
            <span className="text-xs font-bold text-slate-300">
              {color.enabled ? 'Enabled' : 'Bypassed'}
            </span>
          </div>
        </div>

        {/* Live Visual Preview Simulation Card */}
        <div
          className="p-4 rounded-2xl border flex flex-col md:flex-row items-center gap-5 overflow-hidden"
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }}
        >
          {/* Simulated Preview Box */}
          <div className="relative w-full md:w-60 h-32 rounded-xl overflow-hidden shadow-lg border border-white/10 shrink-0">
            <div
              className="w-full h-full bg-gradient-to-tr from-amber-600 via-rose-500 to-indigo-600 flex flex-col justify-end p-2.5 transition-all duration-200"
              style={{
                filter: color.enabled
                  ? `contrast(${color.contrast}) saturate(${color.saturation}) hue-rotate(${color.hue}deg) sepia(${color.warmth * 0.7}) ${
                      color.invert ? 'invert(1) hue-rotate(180deg)' : ''
                    } ${color.sharpness ? 'contrast(1.08)' : ''}`
                  : 'none',
              }}
            >
              <div className="bg-black/60 backdrop-blur-md rounded-lg p-1.5 text-[10px] text-white font-medium flex items-center justify-between">
                <span>Color Simulation</span>
                <span className="font-bold text-amber-300 uppercase">{color.preset}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-1 text-xs">
            <span className="font-bold text-white">Active Profile: {VIDEO_COLOR_PRESETS[color.preset]?.name || 'Custom'}</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {VIDEO_COLOR_PRESETS[color.preset]?.description || 'Fine-tuned user custom parameters.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                Contrast: {Math.round(color.contrast * 100)}%
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                Saturation: {Math.round(color.saturation * 100)}%
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                Warmth: {Math.round(color.warmth * 100)}%
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                Hue: {color.hue}°
              </span>
            </div>
          </div>
        </div>

        {/* Video Presets */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Cinema & Visual Profiles
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(VIDEO_COLOR_PRESETS).map(([key, p]) => {
              const isSelected = color.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  id={`settings-video-preset-${key}`}
                  onClick={() => setVideoColorPreset(key as VideoColorPreset)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-sm'
                      : 'border-white/5 hover:border-white/15 bg-white/5 hover:bg-white/10'
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

        {/* Precision Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Contrast */}
          <div className="p-3.5 rounded-2xl border border-white/5 bg-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Contrast
              </span>
              <span className="font-bold text-sky-400 tabular-nums">
                {Math.round(color.contrast * 100)}%
              </span>
            </div>
            <input
              type="range"
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

          {/* Saturation */}
          <div className="p-3.5 rounded-2xl border border-white/5 bg-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                Saturation / Vibrancy
              </span>
              <span className="font-bold text-rose-400 tabular-nums">
                {Math.round(color.saturation * 100)}%
              </span>
            </div>
            <input
              type="range"
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
          <div className="p-3.5 rounded-2xl border border-white/5 bg-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-amber-300" />
                Eye-Care Warmth (Blue Filter)
              </span>
              <span className="font-bold text-amber-300 tabular-nums">
                {Math.round(color.warmth * 100)}%
              </span>
            </div>
            <input
              type="range"
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
          <div className="p-3.5 rounded-2xl border border-white/5 bg-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                Hue Tint Angle
              </span>
              <span className="font-bold text-purple-400 tabular-nums">
                {color.hue > 0 ? `+${color.hue}°` : `${color.hue}°`}
              </span>
            </div>
            <input
              type="range"
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
        </div>
      </section>

      {/* ========================================================== */}
      {/* 2. AUDIO ENHANCEMENT ENGINE */}
      {/* ========================================================== */}
      <section
        id="settings-audio-enhance-section"
        className="p-5 sm:p-6 rounded-3xl border space-y-6"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        {/* Section Header with Master Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold flex items-center gap-2">
                Audio Enhancement & DSP Dynamics
                {audio.enabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </h4>
              <p className="text-xs text-slate-400">
                Super-volume booster up to 200%, dialogue vocal clarity, and sub-bass punch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="settings-audio-enhance-toggle"
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
            <span className="text-xs font-bold text-slate-300">
              {audio.enabled ? 'Enabled' : 'Bypassed'}
            </span>
          </div>
        </div>

        {/* Real-time Spectrum Indicator */}
        <div
          className="p-4 rounded-2xl border flex items-center justify-between gap-4"
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }}
        >
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              Real-Time Audio DSP Activity
            </span>
            <p className="text-[11px] text-slate-400">
              {isPlaying
                ? 'Processing live audio through boost & clarity filters.'
                : 'Play a track or video to monitor live frequency dynamics.'}
            </p>
          </div>

          {/* Mini Spectrum Bars */}
          <div className="flex items-end gap-1 h-9 px-2">
            {meterBars.map((height, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full transition-all duration-75"
                style={{
                  height: `${height}px`,
                  backgroundColor:
                    i < 4
                      ? '#818cf8' // bass
                      : i < 12
                      ? '#22d3ee' // vocals
                      : '#34d399', // treble
                  opacity: isPlaying && audio.enabled ? 1 : 0.35,
                }}
              />
            ))}
          </div>
        </div>

        {/* Audio Presets */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Acoustic & Clarity Profiles
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(AUDIO_ENHANCE_PRESETS).map(([key, p]) => {
              const isSelected = audio.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  id={`settings-audio-preset-${key}`}
                  onClick={() => setAudioEnhancePreset(key as AudioEnhancePreset)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/15 shadow-sm'
                      : 'border-white/5 hover:border-white/15 bg-white/5 hover:bg-white/10'
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

        {/* Audio Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Super-Volume Booster */}
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Super-Volume Booster (Up to 200%)
              </span>
              <span className="font-extrabold text-amber-300 tabular-nums">
                {audio.volumeBoost}%
              </span>
            </div>
            <input
              type="range"
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
            <p className="text-[11px] text-amber-300/80">
              Hardware-safe extra amplification for quietly recorded movies and dialog without harsh distortion.
            </p>
          </div>

          {/* Vocal Clarity */}
          <div className="p-3.5 rounded-2xl border border-white/5 bg-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                Vocal & Dialogue Clarity
              </span>
              <span className="font-bold text-cyan-400 tabular-nums">
                {audio.vocalClarity > 0 ? `+${audio.vocalClarity} dB` : '0 dB'}
              </span>
            </div>
            <input
              type="range"
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
              Boosts 1-3.5 kHz dialogue range for intelligible actor speech.
            </p>
          </div>

          {/* Sub-Bass Boost */}
          <div className="p-3.5 rounded-2xl border border-white/5 bg-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
                Sub-Bass Punch (80 Hz)
              </span>
              <span className="font-bold text-indigo-400 tabular-nums">
                {audio.bassBoost > 0 ? `+${audio.bassBoost} dB` : '0 dB'}
              </span>
            </div>
            <input
              type="range"
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
              Low-frequency punch for immersive cinematic sound effects.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
