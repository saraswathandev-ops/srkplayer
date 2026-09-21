import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  BarChart2,
  Waves,
  Activity,
  Radio,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import { audioEqualizer } from '../services/audioEqualizer';
import { formatTime } from '../utils/formatters';

export type VisualizerStyle = 'bars' | 'wave' | 'oscilloscope' | 'radial' | 'compact';

interface AudioWaveformVisualizerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  themeColor?: string;
  isDark?: boolean;
  variant?: VisualizerStyle;
  height?: number;
  className?: string;
  showControls?: boolean;
  trackTitle?: string;
  trackArtist?: string;
}

export function AudioWaveformVisualizer({
  isPlaying,
  currentTime,
  duration,
  onSeek,
  themeColor = '#6E60FF',
  isDark = true,
  variant: initialVariant = 'bars',
  height = 240,
  className = '',
  showControls = true,
  trackTitle,
  trackArtist,
}: AudioWaveformVisualizerProps) {
  const [style, setStyle] = useState<VisualizerStyle>(initialVariant);
  const [sensitivity, setSensitivity] = useState<number>(1.0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Live frequency meters (0 to 100)
  const [liveMeter, setLiveMeter] = useState({
    bass: 0,
    mid: 0,
    treble: 0,
    overall: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Buffer state for peak holding & smoothing
  const smoothedFreqsRef = useRef<Float32Array>(new Float32Array(128));
  const peakValuesRef = useRef<Float32Array>(new Float32Array(128));
  const syntheticPhaseRef = useRef<number>(0);
  const lastMeterUpdateRef = useRef<number>(0);

  // Set style if prop variant changes
  useEffect(() => {
    setStyle(initialVariant);
  }, [initialVariant]);

  // Handle seeking via canvas click/drag
  const handleSeekFromPointer = useCallback(
    (clientX: number) => {
      if (!onSeek || !canvasRef.current || !duration) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = clickX / rect.width;
      const target = ratio * duration;
      onSeek(target);
    },
    [onSeek, duration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onSeek || !duration) return;
    setIsScrubbing(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    handleSeekFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !duration) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const time = (x / rect.width) * duration;
    setHoverX(x);
    setHoverTime(time);

    if (isScrubbing) {
      handleSeekFromPointer(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  const handlePointerLeave = () => {
    if (!isScrubbing) {
      setHoverX(null);
      setHoverTime(null);
    }
  };

  // Main visualizer rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const binCount = 128;
    const rawFreq = new Uint8Array(binCount);
    const rawWave = new Uint8Array(binCount);

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;
      if (width === 0 || h === 0) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // 1. Fetch raw data from audioEqualizer
      const hasRealFreq = audioEqualizer.getFrequencyData(rawFreq);
      audioEqualizer.getWaveformData(rawWave);

      // Check if raw data has audible energy
      let realSum = 0;
      for (let i = 0; i < binCount; i++) {
        realSum += rawFreq[i];
      }
      const isRealAudioActive = hasRealFreq && realSum > 50;

      // 2. Synthesize frequency data if live audio is active but CORS restricts direct buffer
      if (!isRealAudioActive && isPlaying) {
        syntheticPhaseRef.current += 0.08;
        const phase = syntheticPhaseRef.current;
        // Rhythm pulses based on audio time (e.g. 120 bpm tempo pulse)
        const beatPulse = Math.sin(currentTime * Math.PI * 4) * 0.5 + 0.5;
        const barPulse = Math.sin(currentTime * Math.PI * 1.5) * 0.5 + 0.5;

        for (let i = 0; i < binCount; i++) {
          const normIdx = i / binCount;
          // Bass frequencies (low index) have strong rhythmic beats
          const bassBoost = Math.max(0, 1 - normIdx * 3.5) * beatPulse * 220;
          // Mid frequencies oscillate harmonically
          const midWave = Math.sin(phase + normIdx * 8) * Math.cos(phase * 0.7 + normIdx * 4);
          const midBoost = Math.max(0, Math.sin(normIdx * Math.PI)) * (midWave * 0.5 + 0.5) * 160 * barPulse;
          // High frequencies shimmer
          const highShimmer = Math.sin(phase * 2.2 + normIdx * 16) * 45;

          const syntheticVal = Math.min(255, Math.max(0, (bassBoost + midBoost + highShimmer) * sensitivity));
          rawFreq[i] = syntheticVal;
          rawWave[i] = Math.min(255, Math.max(0, 128 + (syntheticVal - 128) * 0.6));
        }
      } else if (!isPlaying) {
        // Slowly decay when paused
        for (let i = 0; i < binCount; i++) {
          rawFreq[i] = Math.max(0, Math.floor(rawFreq[i] * 0.85));
          rawWave[i] = 128;
        }
      }

      // 3. Smooth frequencies & calculate peak hold
      const smoothed = smoothedFreqsRef.current;
      const peaks = peakValuesRef.current;
      const attack = 0.55;
      const decay = 0.2;

      let currentBassSum = 0;
      let currentMidSum = 0;
      let currentTrebleSum = 0;

      for (let i = 0; i < binCount; i++) {
        const target = (rawFreq[i] / 255) * sensitivity;
        const current = smoothed[i];
        if (target > current) {
          smoothed[i] = current + (target - current) * attack;
        } else {
          smoothed[i] = current - (current - target) * decay;
        }

        // Peaks hold and fall with gravity
        if (smoothed[i] >= peaks[i]) {
          peaks[i] = smoothed[i];
        } else {
          peaks[i] = Math.max(0, peaks[i] - 0.008);
        }

        // Energy bins
        if (i < 8) currentBassSum += smoothed[i];
        else if (i < 40) currentMidSum += smoothed[i];
        else currentTrebleSum += smoothed[i];
      }

      // Update meters throttled to 15fps
      const now = performance.now();
      if (now - lastMeterUpdateRef.current > 66) {
        lastMeterUpdateRef.current = now;
        const bassVal = Math.min(100, Math.round((currentBassSum / 8) * 100));
        const midVal = Math.min(100, Math.round((currentMidSum / 32) * 100));
        const trebleVal = Math.min(100, Math.round((currentTrebleSum / (binCount - 40)) * 100));
        const overall = Math.round((bassVal * 0.4 + midVal * 0.35 + trebleVal * 0.25));
        setLiveMeter({ bass: bassVal, mid: midVal, treble: trebleVal, overall });
      }

      // 4. Clear Canvas
      ctx.clearRect(0, 0, width, h);

      // 5. Draw background subtle ambient grid
      const isMinimalCompact = style === 'compact';
      if (!isMinimalCompact) {
        ctx.fillStyle = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
        ctx.fillRect(0, 0, width, h);
      }

      // 6. Branch by Visualizer Style
      if (style === 'bars') {
        drawSpectrumBars(ctx, width, h, smoothed, peaks, themeColor, isDark, currentTime, duration);
      } else if (style === 'wave') {
        drawFluidWave(ctx, width, h, smoothed, themeColor, isDark, currentTime, duration);
      } else if (style === 'oscilloscope') {
        drawOscilloscope(ctx, width, h, rawWave, themeColor, isDark, currentTime, duration);
      } else if (style === 'radial') {
        drawRadialSpectrum(ctx, width, h, smoothed, themeColor, isDark, isPlaying);
      } else if (style === 'compact') {
        drawCompactBars(ctx, width, h, smoothed, themeColor, isPlaying);
      }

      // 7. Interactive Seeker Overlay (if scrubbing or hover)
      if (!isMinimalCompact && duration > 0) {
        // Draw played progress needle
        const progressX = (currentTime / duration) * width;
        ctx.save();
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(progressX, 0);
        ctx.lineTo(progressX, h);
        ctx.stroke();

        // Glowing progress head
        ctx.fillStyle = themeColor;
        ctx.beginPath();
        ctx.arc(progressX, h / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw hover scrub line
        if (hoverX !== null) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(hoverX, 0);
          ctx.lineTo(hoverX, h);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [style, isPlaying, sensitivity, themeColor, isDark, currentTime, duration, hoverX, isScrubbing]);

  // Handle ResizeObserver for responsive canvas width
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [height]);

  return (
    <div
      ref={containerRef}
      id="audio-waveform-visualizer-container"
      className={`w-full flex flex-col items-center select-none ${className}`}
    >
      {/* Top Visualizer Controls & Header (Only if showControls is true) */}
      {showControls && style !== 'compact' && (
        <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-3 px-1 text-xs">
          {/* Style Selector Tabs */}
          <div
            className="flex items-center p-1 rounded-2xl border backdrop-blur-md"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            }}
          >
            <button
              onClick={() => setStyle('bars')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                style === 'bars' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: style === 'bars' ? themeColor : 'transparent',
              }}
              title="Studio Spectrum Frequency Bars"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Spectrum</span>
            </button>

            <button
              onClick={() => setStyle('wave')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                style === 'wave' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: style === 'wave' ? themeColor : 'transparent',
              }}
              title="Fluid Mirrored Waveform"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>Fluid Wave</span>
            </button>

            <button
              onClick={() => setStyle('oscilloscope')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                style === 'oscilloscope' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: style === 'oscilloscope' ? themeColor : 'transparent',
              }}
              title="Oscilloscope Time-Domain Ribbon"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Oscilloscope</span>
            </button>

            <button
              onClick={() => setStyle('radial')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                style === 'radial' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: style === 'radial' ? themeColor : 'transparent',
              }}
              title="Radial Frequency Halo"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Radial</span>
            </button>
          </div>

          {/* Right side: Sensitivity & Live Reactive Energy Gauges */}
          <div className="flex items-center gap-3">
            {/* Live Frequency Multi-Meter */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-2xl bg-black/40 border border-white/10 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-rose-400">
                <span className="font-bold">BASS</span>
                <span className="tabular-nums font-bold">{liveMeter.bass}%</span>
              </span>
              <span className="text-white/20">•</span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="font-bold">MID</span>
                <span className="tabular-nums font-bold">{liveMeter.mid}%</span>
              </span>
              <span className="text-white/20">•</span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="font-bold">HIGH</span>
                <span className="tabular-nums font-bold">{liveMeter.treble}%</span>
              </span>
            </div>

            {/* Sensitivity Gain Multiplier */}
            <button
              onClick={() => {
                setSensitivity((prev) => (prev >= 1.8 ? 0.75 : prev === 0.75 ? 1.0 : prev === 1.0 ? 1.4 : 2.0));
              }}
              className="px-2.5 py-1.5 rounded-xl border bg-black/40 hover:bg-black/60 transition-colors font-mono text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
              title="Adjust visualizer frequency reactivity sensitivity"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{sensitivity.toFixed(1)}x GAIN</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div
        className="relative w-full rounded-3xl overflow-hidden border shadow-2xl group transition-all"
        style={{
          height: `${height}px`,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          backgroundColor: isDark ? '#070913' : '#F8FAFC',
        }}
      >
        {/* Glow backdrop reacting to live bass energy */}
        <div
          className="absolute inset-0 opacity-25 blur-3xl pointer-events-none transition-opacity duration-150"
          style={{
            backgroundColor: themeColor,
            opacity: isPlaying ? 0.15 + (liveMeter.bass / 100) * 0.35 : 0.05,
          }}
        />

        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          className="w-full h-full cursor-pointer relative z-10 touch-none"
        />

        {/* Hover Time Tooltip */}
        {hoverTime !== null && hoverX !== null && duration > 0 && style !== 'compact' && (
          <div
            className="absolute top-3 pointer-events-none z-20 px-2.5 py-1 rounded-xl bg-black/85 backdrop-blur-md border border-white/20 text-white text-xs font-mono font-bold shadow-xl -translate-x-1/2 flex items-center gap-1.5"
            style={{ left: `${hoverX}px` }}
          >
            <span>{formatTime(hoverTime)}</span>
            <span className="text-white/40">/</span>
            <span className="text-slate-400 text-[10px]">{formatTime(duration)}</span>
          </div>
        )}

        {/* Track Title Watermark Overlay */}
        {trackTitle && style !== 'compact' && (
          <div className="absolute bottom-3 left-4 pointer-events-none z-10 flex flex-col">
            <span className="text-xs font-black tracking-tight text-white/70 truncate max-w-xs">
              {trackTitle}
            </span>
            {trackArtist && (
              <span className="text-[10px] text-slate-400 truncate max-w-xs">
                {trackArtist}
              </span>
            )}
          </div>
        )}

        {/* Live Frequency Status Badge */}
        {style !== 'compact' && (
          <div className="absolute top-3 right-4 pointer-events-none z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-[10px] font-mono text-slate-300">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isPlaying ? '#10B981' : '#64748B',
                boxShadow: isPlaying ? '0 0 8px #10B981' : 'none',
              }}
            />
            <span>{isPlaying ? 'AUDIO SPECTRUM ACTIVE' : 'AUDIO PAUSED'}</span>
          </div>
        )}
      </div>

      {/* Subtext info */}
      {showControls && style !== 'compact' && (
        <div className="w-full flex items-center justify-between pt-2 px-2 text-[11px] text-slate-500">
          <span>Click anywhere on the waveform to scrub or seek</span>
          <span className="font-mono tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SPECIALIZED CANVAS RENDERING ALGORITHMS
// ---------------------------------------------------------------------------

/**
 * 1. Spectrum Frequency Bars with Gradient Fill & Peak Drops
 */
function drawSpectrumBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  smoothed: Float32Array,
  peaks: Float32Array,
  themeColor: string,
  isDark: boolean,
  currentTime: number,
  duration: number
) {
  const barCount = 48;
  const barGap = 3;
  const totalBarWidth = (width - (barCount + 1) * barGap) / barCount;
  const maxBarH = h * 0.82;
  const baselineY = h * 0.9;

  // Gradient for bars
  const grad = ctx.createLinearGradient(0, baselineY - maxBarH, 0, baselineY);
  grad.addColorStop(0, '#38BDF8'); // Sky Cyan
  grad.addColorStop(0.4, themeColor);
  grad.addColorStop(1, '#A855F7'); // Purple / Indigo

  // Baseline line
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(width, baselineY);
  ctx.stroke();

  for (let i = 0; i < barCount; i++) {
    const dataIdx = Math.floor((i / barCount) * smoothed.length * 0.75);
    const val = smoothed[dataIdx] || 0;
    const peakVal = peaks[dataIdx] || 0;

    const x = barGap + i * (totalBarWidth + barGap);
    const barH = Math.max(3, val * maxBarH);
    const y = baselineY - barH;

    // Bar body with rounded top
    ctx.fillStyle = grad;
    drawRoundedRect(ctx, x, y, totalBarWidth, barH, Math.min(4, totalBarWidth / 2));
    ctx.fill();

    // Floating Peak Cap
    if (peakVal > 0.05) {
      const peakY = baselineY - Math.max(4, peakVal * maxBarH) - 2;
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, x, peakY, totalBarWidth, 2, 1);
      ctx.fill();
    }
  }
}

/**
 * 2. Fluid Mirrored Waveform with Smooth Bezier Curves
 */
function drawFluidWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  smoothed: Float32Array,
  themeColor: string,
  isDark: boolean,
  currentTime: number,
  duration: number
) {
  const midY = h / 2;
  const pointsCount = 40;
  const stepX = width / (pointsCount - 1);
  const maxAmplitude = h * 0.42;

  // Mirror Upper and Lower Points
  const upperPoints: { x: number; y: number }[] = [];
  const lowerPoints: { x: number; y: number }[] = [];

  for (let i = 0; i < pointsCount; i++) {
    const idx = Math.floor((i / pointsCount) * smoothed.length * 0.7);
    const amp = (smoothed[idx] || 0) * maxAmplitude;
    const x = i * stepX;
    upperPoints.push({ x, y: midY - Math.max(2, amp) });
    lowerPoints.push({ x, y: midY + Math.max(2, amp) });
  }

  // Draw gradient filled mirrored wave
  const waveGrad = ctx.createLinearGradient(0, 0, 0, h);
  waveGrad.addColorStop(0, `${themeColor}AA`);
  waveGrad.addColorStop(0.5, '#38BDF8DD');
  waveGrad.addColorStop(1, `${themeColor}AA`);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(upperPoints[0].x, upperPoints[0].y);

  // Bezier curve through upper points
  for (let i = 1; i < upperPoints.length; i++) {
    const prev = upperPoints[i - 1];
    const curr = upperPoints[i];
    const cpX = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + curr.y) / 2);
  }
  ctx.lineTo(width, midY);

  // Bezier curve backwards through lower points
  for (let i = lowerPoints.length - 1; i > 0; i--) {
    const prev = lowerPoints[i];
    const next = lowerPoints[i - 1];
    const cpX = (prev.x + next.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + next.y) / 2);
  }
  ctx.closePath();

  ctx.fillStyle = waveGrad;
  ctx.fill();

  // Glowing crest border
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Center neon line
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  ctx.restore();
}

/**
 * 3. Oscilloscope Time-Domain Ribbon
 */
function drawOscilloscope(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  rawWave: Uint8Array,
  themeColor: string,
  isDark: boolean,
  currentTime: number,
  duration: number
) {
  const midY = h / 2;
  const sliceWidth = width / rawWave.length;

  ctx.save();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#38BDF8';
  ctx.shadowBlur = 12;

  ctx.beginPath();
  let x = 0;
  for (let i = 0; i < rawWave.length; i++) {
    const v = rawWave[i] / 128.0; // 0 to 2, 1 is center
    const y = v * midY;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  ctx.stroke();

  // Secondary glowing inner core
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 4;
  ctx.stroke();

  ctx.restore();
}

/**
 * 4. Radial 360-Degree Circular Spectrum Halo
 */
function drawRadialSpectrum(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  smoothed: Float32Array,
  themeColor: string,
  isDark: boolean,
  isPlaying: boolean
) {
  const centerX = width / 2;
  const centerY = h / 2;
  const radius = Math.min(centerX, centerY) * 0.45;
  const rayCount = 64;
  const maxRayLen = Math.min(centerX, centerY) * 0.48;

  ctx.save();

  // Center glowing orb
  ctx.fillStyle = themeColor;
  ctx.shadowColor = themeColor;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Inner center ring
  ctx.fillStyle = isDark ? '#0F121C' : '#FFFFFF';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();

  // Radial bars radiating outward
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const dataIdx = Math.floor((Math.abs(i - rayCount / 2) / (rayCount / 2)) * smoothed.length * 0.6);
    const val = smoothed[dataIdx] || 0;
    const rayLen = Math.max(4, val * maxRayLen);

    const startX = centerX + Math.cos(angle) * radius;
    const startY = centerY + Math.sin(angle) * radius;
    const endX = centerX + Math.cos(angle) * (radius + rayLen);
    const endY = centerY + Math.sin(angle) * (radius + rayLen);

    ctx.strokeStyle = i % 2 === 0 ? themeColor : '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 5. Compact Micro-Waveform for Inline Cards / Viewers
 */
function drawCompactBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  smoothed: Float32Array,
  themeColor: string,
  isPlaying: boolean
) {
  const barCount = 28;
  const barGap = 2.5;
  const totalBarWidth = (width - (barCount + 1) * barGap) / barCount;
  const midY = h / 2;

  for (let i = 0; i < barCount; i++) {
    const dataIdx = Math.floor((i / barCount) * smoothed.length * 0.6);
    const val = isPlaying ? smoothed[dataIdx] || 0.1 : 0.08;
    const barH = Math.max(3, val * h * 0.85);
    const x = barGap + i * (totalBarWidth + barGap);
    const y = midY - barH / 2;

    ctx.fillStyle = themeColor;
    drawRoundedRect(ctx, x, y, totalBarWidth, barH, totalBarWidth / 2);
    ctx.fill();
  }
}

/**
 * Helper to draw rounded rectangle on Canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
