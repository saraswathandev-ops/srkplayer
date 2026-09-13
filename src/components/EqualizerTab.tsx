import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  Sliders,
  RotateCcw,
  Volume2,
  Play,
  Pause,
  Music,
  Power,
  Check,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import {
  EQUALIZER_FREQUENCIES,
  EQUALIZER_LABELS,
  EQUALIZER_DESCRIPTIONS,
  EQUALIZER_PRESETS,
} from '../constants/theme';
import { audioEqualizer } from '../services/audioEqualizer';

export function EqualizerTab() {
  const {
    settings,
    themeColors,
    setEqualizerBand,
    setEqualizerPreset,
    setEqualizerEnabled,
    setEqualizerPreamp,
    resetEqualizer,
    activeMedia,
    isPlaying,
    togglePlay,
  } = usePlayer();

  const isDark = settings.theme === 'dark';
  const eq = settings.equalizer;

  const [activeDragBand, setActiveDragBand] = useState<number | null>(null);
  const [spectrumBars, setSpectrumBars] = useState<number[]>(() => new Array(28).fill(4));
  const animationFrameRef = useRef<number | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Animate spectrum bars when audio is playing
  useEffect(() => {
    let phase = 0;
    const updateSpectrum = () => {
      if (isPlaying && eq.enabled) {
        phase += 0.15;
        setSpectrumBars(() => {
          return new Array(28).fill(0).map((_, i) => {
            // Map index to closest frequency band
            const bandIdx = Math.min(
              6,
              Math.floor((i / 28) * EQUALIZER_FREQUENCIES.length)
            );
            const bandGain = eq.bands[bandIdx] || 0; // -12 to +12
            const gainBoost = Math.max(0.2, (bandGain + 12) / 24); // 0.2 to 1.0

            // Dynamic sine fluctuation
            const wave =
              Math.sin(phase + i * 0.4) * 0.35 +
              Math.sin(phase * 1.5 + i * 0.7) * 0.25 +
              Math.sin(phase * 0.8 - i * 0.3) * 0.2;
            const normalized = Math.max(0.08, Math.min(0.95, (0.5 + wave * 0.5) * gainBoost));
            return Math.round(normalized * 100);
          });
        });
      } else {
        setSpectrumBars(new Array(28).fill(4));
      }
      animationFrameRef.current = requestAnimationFrame(updateSpectrum);
    };

    animationFrameRef.current = requestAnimationFrame(updateSpectrum);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, eq.enabled, eq.bands]);

  // Compute curve points for the SVG visualization graph
  const curvePoints = useMemo(() => {
    return audioEqualizer.calculateFrequencyCurve(eq.bands, eq.preamp, eq.enabled, 48);
  }, [eq.bands, eq.preamp, eq.enabled]);

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 200;

  // Build SVG Path from curve points
  const { pathD, areaD } = useMemo(() => {
    if (curvePoints.length === 0) return { pathD: '', areaD: '' };

    const coords = curvePoints.map((p) => ({
      x: p.x * svgWidth,
      y: p.y * svgHeight,
    }));

    // Smooth bezier curve path
    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const baselineY = svgHeight / 2;
    const aD = `${d} L ${svgWidth} ${baselineY} L 0 ${baselineY} Z`;

    return { pathD: d, areaD: aD };
  }, [curvePoints]);

  // Map 7 frequency bands to X coordinates on the graph for control points
  const bandNodes = useMemo(() => {
    const minFreq = 20;
    const maxFreq = 20000;
    return EQUALIZER_FREQUENCIES.map((freq, idx) => {
      const t = Math.log(freq / minFreq) / Math.log(maxFreq / minFreq);
      const x = Math.max(20, Math.min(svgWidth - 20, t * svgWidth));
      const gain = eq.enabled ? (eq.bands[idx] || 0) : 0;
      const clampedGain = Math.max(-15, Math.min(15, gain + (eq.enabled ? eq.preamp : 0)));
      const y = (0.5 - clampedGain / 30) * svgHeight;
      return { idx, freq, label: EQUALIZER_LABELS[idx], gain: eq.bands[idx] || 0, x, y };
    });
  }, [eq.bands, eq.preamp, eq.enabled]);

  // Handle dragging nodes directly on the graph
  const handleGraphPointerDown = (idx: number, e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDragBand(idx);
  };

  const handleGraphPointerMove = (e: React.PointerEvent) => {
    if (activeDragBand === null || !graphContainerRef.current) return;
    const rect = graphContainerRef.current.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height; // 0 (top: +15dB) to 1 (bottom: -15dB)
    const dbValue = Math.round((0.5 - relativeY) * 30);
    const clampedDb = Math.max(-12, Math.min(12, dbValue));
    setEqualizerBand(activeDragBand, clampedDb);
  };

  const handleGraphPointerUp = (e: React.PointerEvent) => {
    if (activeDragBand !== null) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe catch
      }
      setActiveDragBand(null);
    }
  };

  return (
    <div id="equalizer-tab-container" className="space-y-6">
      {/* Top Banner with Master Switch & Audio Control */}
      <div
        id="eq-master-header"
        className="p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm transition-transform"
            style={{
              backgroundColor: eq.enabled ? themeColors.primary : (isDark ? '#334155' : '#94A3B8'),
            }}
          >
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">7-Band Audio Equalizer</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  eq.enabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}
              >
                {eq.enabled ? 'Active' : 'Bypassed'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sculpt frequencies from 60 Hz deep bass to 15 kHz crystalline treble.
            </p>
          </div>
        </div>

        {/* Master Controls */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <button
            id="eq-toggle-button"
            onClick={() => setEqualizerEnabled(!eq.enabled)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              eq.enabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm'
                : 'bg-slate-700/20 border-slate-700/40 text-slate-400 hover:text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{eq.enabled ? 'Enabled' : 'Bypassed'}</span>
          </button>

          <button
            id="eq-reset-button"
            onClick={resetEqualizer}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white border border-slate-600/30 hover:bg-slate-700/20 transition-colors cursor-pointer"
            title="Reset to 0 dB flat line"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Interactive Visualization Graph */}
      <section
        id="eq-visualization-section"
        className="p-5 rounded-3xl border space-y-3"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Frequency Response Curve & Live Spectrum
            </h4>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColors.primary }} />
              EQ Filter Curve
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
              Live Spectrum
            </span>
          </div>
        </div>

        {/* Visualizer Canvas & Graph Container */}
        <div
          ref={graphContainerRef}
          id="eq-graph-container"
          onPointerMove={handleGraphPointerMove}
          onPointerUp={handleGraphPointerUp}
          className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden border select-none transition-all"
          style={{
            backgroundColor: isDark ? '#0B0F19' : '#0F172A',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
          }}
        >
          {/* Background Decibel Grid Lines */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
            <div className="w-full flex items-center justify-between border-b border-white/5 text-[9px] text-slate-500 font-mono">
              <span>+12 dB</span>
              <span>+12 dB</span>
            </div>
            <div className="w-full flex items-center justify-between border-b border-white/5 text-[9px] text-slate-500 font-mono">
              <span>+6 dB</span>
              <span>+6 dB</span>
            </div>
            <div className="w-full flex items-center justify-between border-b border-indigo-400/20 text-[9px] text-indigo-300/60 font-mono">
              <span>0 dB (Flat)</span>
              <span>0 dB</span>
            </div>
            <div className="w-full flex items-center justify-between border-b border-white/5 text-[9px] text-slate-500 font-mono">
              <span>-6 dB</span>
              <span>-6 dB</span>
            </div>
            <div className="w-full flex items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>-12 dB</span>
              <span>-12 dB</span>
            </div>
          </div>

          {/* Animated Spectrum Analyzer Bars */}
          <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none flex items-end justify-between px-4 gap-1 opacity-40">
            {spectrumBars.map((heightPercent, barIdx) => (
              <div
                key={barIdx}
                className="flex-1 rounded-t-sm transition-all duration-75"
                style={{
                  height: `${heightPercent}%`,
                  background: `linear-gradient(to top, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.7))`,
                }}
              />
            ))}
          </div>

          {/* SVG Filter Response Curve */}
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <defs>
              <linearGradient id="eq-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={themeColors.primary} stopOpacity={eq.enabled ? 0.35 : 0.08} />
                <stop offset="100%" stopColor={themeColors.primary} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Shaded Area under curve */}
            {areaD && <path d={areaD} fill="url(#eq-area-gradient)" />}

            {/* Main Response Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={eq.enabled ? themeColors.primary : '#64748B'}
                strokeWidth={eq.enabled ? '3' : '2'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-75"
              />
            )}
          </svg>

          {/* Draggable Interactive Node Handles on Graph */}
          {bandNodes.map((node) => {
            const isDragging = activeDragBand === node.idx;
            return (
              <div
                key={node.idx}
                id={`eq-node-${node.idx}`}
                onPointerDown={(e) => handleGraphPointerDown(node.idx, e)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-ns-resize group touch-none ${
                  !eq.enabled ? 'pointer-events-none opacity-40' : ''
                }`}
                style={{
                  left: `${(node.x / svgWidth) * 100}%`,
                  top: `${(node.y / svgHeight) * 100}%`,
                }}
              >
                {/* Node Pill */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-transform shadow-lg ${
                    isDragging ? 'scale-125 ring-4 ring-indigo-500/30' : 'group-hover:scale-110'
                  }`}
                  style={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: themeColors.primary,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: themeColors.primary }}
                  />
                </div>

                {/* Tooltip Badge */}
                <div
                  className={`absolute bottom-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap shadow-md pointer-events-none transition-opacity ${
                    isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isDark ? '#1E293B' : '#0F172A',
                    color: '#F8FAFC',
                  }}
                >
                  {node.label}: {node.gain > 0 ? `+${node.gain}` : node.gain} dB
                </div>
              </div>
            );
          })}
        </div>

        {/* Graph Bottom Frequency Ticks */}
        <div className="flex justify-between px-2 text-[10px] text-slate-400 font-medium">
          {EQUALIZER_LABELS.map((lbl, i) => (
            <span key={i} className="text-center w-12 truncate">
              {lbl}
            </span>
          ))}
        </div>
      </section>

      {/* 7-Band Vertical Sliders Rack */}
      <section
        id="eq-sliders-rack-section"
        className="p-5 rounded-3xl border space-y-4"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Manual Band Tuning (-12 dB to +12 dB)
            </h4>
          </div>

          <span className="text-[11px] text-slate-400">
            Tip: Drag sliders or double-click to center at 0 dB
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-2">
          {EQUALIZER_FREQUENCIES.map((freq, idx) => {
            const gain = eq.bands[idx] || 0;
            const label = EQUALIZER_LABELS[idx];
            const desc = EQUALIZER_DESCRIPTIONS[idx];
            const isPositive = gain > 0;
            const isZero = gain === 0;

            return (
              <div
                key={idx}
                id={`eq-band-column-${idx}`}
                className="flex flex-col items-center gap-2.5 p-2 sm:p-3 rounded-2xl border transition-colors"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              >
                {/* dB Readout Badge */}
                <span
                  className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded-md transition-colors ${
                    isZero
                      ? 'text-slate-400 bg-slate-500/10'
                      : isPositive
                      ? 'text-emerald-400 bg-emerald-500/15'
                      : 'text-amber-400 bg-amber-500/15'
                  }`}
                >
                  {isPositive ? `+${gain}` : gain} dB
                </span>

                {/* Vertical Slider Track Container */}
                <div className="relative h-36 sm:h-44 flex items-center justify-center py-2">
                  {/* Center Zero reference line */}
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-500/30 pointer-events-none" />

                  <input
                    type="range"
                    id={`eq-band-slider-${idx}`}
                    min="-12"
                    max="12"
                    step="1"
                    value={gain}
                    disabled={!eq.enabled}
                    onChange={(e) => setEqualizerBand(idx, parseInt(e.target.value, 10))}
                    onDoubleClick={() => setEqualizerBand(idx, 0)}
                    aria-label={`${label} (${desc}) equalizer gain`}
                    className="h-32 sm:h-40 w-3 accent-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed [writing-mode:vertical-lr] [direction:rtl]"
                  />
                </div>

                {/* Frequency & Sub-label */}
                <div className="text-center w-full">
                  <p className="text-[11px] sm:text-xs font-bold truncate">{label}</p>
                  <p className="text-[9px] text-slate-400 truncate hidden sm:block">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Preamp Gain Control */}
        <div
          id="eq-preamp-container"
          className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
        >
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-sky-400" />
            <div>
              <p className="text-xs font-bold">Pre-amp Gain</p>
              <p className="text-[11px] text-slate-400">
                Balances overall loudness to prevent audio distortion or clipping.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-64">
            <span className="text-[10px] text-slate-400 font-mono">-12 dB</span>
            <input
              type="range"
              id="eq-preamp-slider"
              min="-12"
              max="12"
              step="0.5"
              value={eq.preamp}
              disabled={!eq.enabled}
              onChange={(e) => setEqualizerPreamp(parseFloat(e.target.value))}
              className="flex-1 accent-sky-500 cursor-pointer disabled:opacity-40"
            />
            <span className="text-[10px] text-slate-400 font-mono">+12 dB</span>
            <span
              className={`text-xs font-mono font-bold min-w-[50px] text-right ${
                eq.preamp > 0 ? 'text-sky-400' : eq.preamp < 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {eq.preamp > 0 ? `+${eq.preamp}` : eq.preamp} dB
            </span>
          </div>
        </div>
      </section>

      {/* Preset Profiles */}
      <section
        id="eq-presets-section"
        className="p-5 rounded-3xl border space-y-3"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
            Equalizer Presets ({Object.keys(EQUALIZER_PRESETS).length})
          </h4>
          {eq.preset === 'custom' && (
            <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Custom Profile Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.entries(EQUALIZER_PRESETS).map(([key, preset]) => {
            const isSelected = eq.preset === key;
            return (
              <button
                key={key}
                id={`eq-preset-${key}`}
                disabled={!eq.enabled}
                onClick={() => setEqualizerPreset(key)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-2xl border text-xs font-medium text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-sm font-semibold'
                    : 'border-slate-700/30 hover:border-slate-600 hover:bg-slate-700/10 text-slate-300'
                }`}
                style={{
                  borderColor: isSelected ? themeColors.primary : undefined,
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.04)'
                    : undefined,
                }}
              >
                <span className="truncate">{preset.name}</span>
                {isSelected && (
                  <Check
                    className="w-3.5 h-3.5 shrink-0 ml-1"
                    style={{ color: themeColors.primary }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Now Playing Live Monitor Card */}
      {activeMedia && (
        <div
          id="eq-now-playing-banner"
          className="p-4 rounded-3xl border flex items-center justify-between gap-3 shadow-sm"
          style={{
            backgroundColor: isDark ? '#141824' : '#F8FAFC',
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{
                backgroundColor: isDark ? '#1E2438' : '#EEF2F6',
                color: themeColors.primary,
              }}
            >
              <Music className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{activeMedia.title}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {activeMedia.artist || activeMedia.album || 'Now playing in media player'}
              </p>
            </div>
          </div>

          <button
            id="eq-now-playing-toggle-btn"
            onClick={togglePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-transform hover:scale-105 cursor-pointer shrink-0"
            style={{ backgroundColor: themeColors.primary }}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
