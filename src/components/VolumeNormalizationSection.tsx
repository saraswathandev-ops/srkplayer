import React, { useState, useEffect, useRef } from 'react';
import {
  Gauge,
  Volume2,
  Moon,
  Sparkles,
  Zap,
  Coffee,
  Info,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Film,
  Activity,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { VOLUME_NORMALIZATION_MODES } from '../constants/theme';
import { VolumeNormalizationMode } from '../types';
import { audioEqualizer } from '../services/audioEqualizer';

interface Props {
  compact?: boolean;
}

export function VolumeNormalizationSection({ compact = false }: Props) {
  const {
    settings,
    themeColors,
    toggleVolumeNormalization,
    setVolumeNormalizationMode,
    updateVolumeNormalization,
    isPlaying,
    activeMedia,
  } = usePlayer();

  const isDark = settings.theme === 'dark';
  const norm = settings.volumeNormalization || {
    enabled: true,
    mode: 'standard' as VolumeNormalizationMode,
    targetLoudness: -14,
    preampTrim: 0,
    applyToVideo: false,
  };

  const [showExplanation, setShowExplanation] = useState(false);

  // Real-time audio dynamics metrics (RMS, Peak, Gain Reduction)
  const [metrics, setMetrics] = useState({
    rmsDb: -45,
    peakDb: -40,
    gainReductionDb: 0,
    isCompressing: false,
  });

  const animRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const pollMetrics = () => {
      if (!active) return;
      if (isPlaying) {
        const live = audioEqualizer.getLiveAudioMetrics();
        setMetrics(live);
      } else {
        setMetrics({
          rmsDb: -60,
          peakDb: -60,
          gainReductionDb: 0,
          isCompressing: false,
        });
      }
      animRef.current = requestAnimationFrame(pollMetrics);
    };

    animRef.current = requestAnimationFrame(pollMetrics);

    return () => {
      active = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying]);

  const modeIcons: Record<VolumeNormalizationMode, React.ReactNode> = {
    standard: <Sparkles className="w-4 h-4" />,
    quiet: <Coffee className="w-4 h-4" />,
    loud: <Zap className="w-4 h-4" />,
    night: <Moon className="w-4 h-4" />,
  };

  return (
    <section
      id="volume-normalization-container"
      className="p-5 rounded-3xl border space-y-5 transition-all"
      style={{
        backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
        borderColor: norm.enabled
          ? isDark
            ? `${themeColors.primary}40`
            : `${themeColors.primary}30`
          : isDark
          ? themeColors.borderDark
          : themeColors.borderLight,
      }}
    >
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all"
            style={{
              backgroundColor: norm.enabled
                ? `${themeColors.primary}20`
                : isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.05)',
              borderColor: norm.enabled ? `${themeColors.primary}60` : 'transparent',
              color: norm.enabled ? themeColors.primary : isDark ? '#94A3B8' : '#64748B',
            }}
          >
            <Gauge className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm tracking-tight">Volume Normalization</h3>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                style={{
                  backgroundColor: norm.enabled
                    ? `${themeColors.primary}20`
                    : isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.06)',
                  color: norm.enabled ? themeColors.primary : '#94A3B8',
                  borderColor: norm.enabled ? `${themeColors.primary}40` : 'transparent',
                }}
              >
                {norm.enabled ? 'Active • EBU R128 / LUFS' : 'Bypassed'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
              Eliminates jarring volume jumps between tracks with different mastering levels. Keeps
              audio comfortable and uniform without distortion.
            </p>
          </div>
        </div>

        {/* Master Switch Button */}
        <button
          id="btn-toggle-volume-normalization"
          onClick={toggleVolumeNormalization}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 ${
            norm.enabled
              ? 'text-white'
              : isDark
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
          style={{
            backgroundColor: norm.enabled ? themeColors.primary : undefined,
          }}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              norm.enabled ? 'bg-white shadow-sm animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span>{norm.enabled ? 'Normalization Enabled' : 'Enable Normalization'}</span>
        </button>
      </div>

      {/* Real-time Loudness & Dynamics Monitoring Strip */}
      <div
        id="dynamics-meter-strip"
        className="p-3.5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{
          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center gap-3">
          <Activity
            className={`w-4 h-4 ${
              isPlaying && norm.enabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Real-Time Dynamics Engine</span>
              {isPlaying ? (
                <span className="text-[10px] text-emerald-400 font-medium">
                  {norm.enabled ? 'Active Audio Processing' : 'Direct Signal Passthrough'}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Idle (play media to see live meter)</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
              <span>RMS: {metrics.rmsDb > -58 ? `${metrics.rmsDb} dB` : '-∞ dB'}</span>
              <span>Peak: {metrics.peakDb > -58 ? `${metrics.peakDb} dB` : '-∞ dB'}</span>
              {norm.enabled && (
                <span
                  className={metrics.gainReductionDb < -0.5 ? 'text-amber-400 font-semibold' : ''}
                >
                  Gain Reduction: {metrics.gainReductionDb} dB
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Visual Level Meters */}
        <div className="flex items-center gap-4 flex-1 max-w-sm">
          {/* Signal Level Bar */}
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Signal Level</span>
              <span>{Math.max(0, Math.min(100, Math.round(((metrics.rmsDb + 60) / 60) * 100)))}%</span>
            </div>
            <div className="h-2 w-full bg-slate-700/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${Math.max(4, Math.min(100, ((metrics.rmsDb + 60) / 60) * 100))}%`,
                  backgroundColor:
                    metrics.rmsDb > -6 ? '#EF4444' : metrics.rmsDb > -14 ? themeColors.primary : '#10B981',
                }}
              />
            </div>
          </div>

          {/* Gain Reduction (Compressor action) */}
          {norm.enabled && (
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Peak Compression</span>
                <span>{Math.abs(metrics.gainReductionDb)} dB</span>
              </div>
              <div className="h-2 w-full bg-slate-700/40 rounded-full overflow-hidden flex justify-end">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.min(100, Math.abs(metrics.gainReductionDb) * 12)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Target Loudness Modes Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Target Loudness Profile
          </label>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-[11px] flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showExplanation ? 'Hide Guide' : 'What do these mean?'}</span>
          </button>
        </div>

        {showExplanation && (
          <div
            className="p-3 rounded-2xl border text-xs text-slate-300 space-y-1.5"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <p className="font-semibold text-slate-200">How SKR Volume Normalization Works:</p>
            <p className="text-slate-400 text-[11px]">
              Older audio tracks and vintage acoustic recordings were mastered at low average levels
              (-18 to -24 LUFS), while modern dance and pop records are compressed heavily (-8 to
              -11 LUFS).
            </p>
            <p className="text-slate-400 text-[11px]">
              When shuffling tracks, this causes annoying volume fluctuations where one song is a
              whisper and the next blows your ears out. Normalization applies dynamic multi-stage Web
              Audio compression and smart makeup gain to balance tracks into a consistent listening
              zone automatically.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.entries(VOLUME_NORMALIZATION_MODES) as [
            VolumeNormalizationMode,
            (typeof VOLUME_NORMALIZATION_MODES)[VolumeNormalizationMode]
          ][]).map(([key, mode]) => {
            const isSelected = norm.mode === key;
            return (
              <button
                key={key}
                id={`norm-mode-card-${key}`}
                disabled={!norm.enabled}
                onClick={() => setVolumeNormalizationMode(key)}
                className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                  !norm.enabled
                    ? 'opacity-45 cursor-not-allowed'
                    : 'cursor-pointer hover:border-slate-500'
                }`}
                style={{
                  backgroundColor: isSelected && norm.enabled
                    ? isDark
                      ? `${themeColors.primary}18`
                      : `${themeColors.primary}10`
                    : isDark
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.02)',
                  borderColor: isSelected && norm.enabled
                    ? themeColors.primary
                    : isDark
                    ? themeColors.borderDark
                    : themeColors.borderLight,
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="p-1.5 rounded-xl border"
                      style={{
                        backgroundColor: isSelected && norm.enabled
                          ? `${themeColors.primary}25`
                          : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.06)',
                        borderColor: isSelected && norm.enabled ? `${themeColors.primary}50` : 'transparent',
                        color: isSelected && norm.enabled ? themeColors.primary : '#94A3B8',
                      }}
                    >
                      {modeIcons[key]}
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700/30 text-slate-300">
                      {mode.targetLabel}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-200">{mode.name}</p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                    {mode.description}
                  </p>
                </div>

                {isSelected && norm.enabled && (
                  <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold" style={{ color: themeColors.primary }}>
                    <Check className="w-3.5 h-3.5" />
                    <span>Selected Target</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Trim and Video Processing Controls */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t"
        style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
      >
        {/* Output Preamp Trim Slider */}
        <div
          className="p-3.5 rounded-2xl border space-y-2.5"
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold">Fine Output Level Trim</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono">
                {norm.preampTrim > 0 ? `+${norm.preampTrim}` : norm.preampTrim} dB
              </span>
              {norm.preampTrim !== 0 && (
                <button
                  onClick={() => updateVolumeNormalization({ preampTrim: 0 })}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
                  title="Reset to 0 dB"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Nudge the master normalized target up or down to calibrate your headphones or external speakers.
          </p>
          <input
            type="range"
            min="-6"
            max="6"
            step="0.5"
            disabled={!norm.enabled}
            value={norm.preampTrim || 0}
            onChange={(e) => updateVolumeNormalization({ preampTrim: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500 cursor-pointer disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>-6 dB (Quieter)</span>
            <span>0 dB (Nominal)</span>
            <span>+6 dB (Boosted)</span>
          </div>
        </div>

        {/* Video Audio Normalization Toggle */}
        <div
          className="p-3.5 rounded-2xl border flex flex-col justify-between"
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold">Apply Normalization to Video Audio</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Also normalizes movie dialog and soundtrack spikes in video playback, making whispers audible and explosions restrained.
            </p>
          </div>

          <label className="flex items-center justify-between pt-3 mt-2 border-t cursor-pointer" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
            <span className="text-xs text-slate-300 font-medium">Video Audio Leveling</span>
            <input
              type="checkbox"
              checked={norm.applyToVideo}
              disabled={!norm.enabled}
              onChange={(e) => updateVolumeNormalization({ applyToVideo: e.target.checked })}
              className="w-4 h-4 rounded accent-indigo-500 cursor-pointer disabled:opacity-50"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
