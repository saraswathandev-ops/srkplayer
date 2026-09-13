import { EQUALIZER_FREQUENCIES, VOLUME_NORMALIZATION_MODES } from '../constants/theme';
import { EqualizerSettings, VolumeNormalizationSettings } from '../types';

class AudioEqualizerManager {
  private audioCtx: AudioContext | null = null;
  private filters: BiquadFilterNode[] = [];
  private preampGain: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private normalizerGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNodes = new Map<HTMLMediaElement, MediaElementAudioSourceNode>();
  private isInitialized = false;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();

      // Preamp gain node
      this.preampGain = this.audioCtx.createGain();

      // Create 7 biquad filters
      this.filters = EQUALIZER_FREQUENCIES.map((freq, index) => {
        const filter = this.audioCtx!.createBiquadFilter();
        if (index === 0) {
          filter.type = 'lowshelf';
        } else if (index === EQUALIZER_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // Volume Normalization Gain node (makeup gain / trim)
      this.normalizerGain = this.audioCtx.createGain();
      this.normalizerGain.gain.value = 1.0;

      // Dynamics Compressor node for volume normalization across different tracks
      this.compressorNode = this.audioCtx.createDynamicsCompressor();
      // Default to neutral/transparent
      this.compressorNode.threshold.value = -20;
      this.compressorNode.knee.value = 18;
      this.compressorNode.ratio.value = 4.0;
      this.compressorNode.attack.value = 0.005;
      this.compressorNode.release.value = 0.25;

      // Analyser node for live spectrum and dynamics meter visualization
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      // Chain: Preamp -> Filter 0 -> ... -> Filter 6 -> NormalizerGain -> CompressorNode -> Analyser -> Destination
      this.preampGain.connect(this.filters[0]);
      for (let i = 0; i < this.filters.length - 1; i++) {
        this.filters[i].connect(this.filters[i + 1]);
      }
      this.filters[this.filters.length - 1].connect(this.normalizerGain);
      this.normalizerGain.connect(this.compressorNode);
      this.compressorNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      this.isInitialized = true;
    } catch (err) {
      console.warn('Web Audio API Equalizer initialization warning:', err);
    }
  }

  public attachMediaElement(element: HTMLMediaElement | null) {
    if (!element) return;
    this.init();

    if (!this.audioCtx || !this.preampGain) return;

    try {
      // Avoid creating multiple MediaElementAudioSourceNode on the same HTMLMediaElement
      if (!this.sourceNodes.has(element)) {
        const sourceNode = this.audioCtx.createMediaElementSource(element);
        sourceNode.connect(this.preampGain);
        this.sourceNodes.set(element, sourceNode);
      }
    } catch (err) {
      // If already connected or CORS warning, handle gracefully
      console.warn('AudioEqualizer attachMediaElement notice:', err);
    }
  }

  public resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public applySettings(settings: EqualizerSettings) {
    if (!this.isInitialized || !this.audioCtx) return;

    this.resume();

    const enabled = settings.enabled;

    // Apply Preamp (-12dB to +12dB -> linear gain)
    if (this.preampGain) {
      const preampDb = enabled ? settings.preamp : 0;
      const gainVal = Math.pow(10, preampDb / 20);
      this.preampGain.gain.setTargetAtTime(gainVal, this.audioCtx.currentTime, 0.05);
    }

    // Apply Filter gains
    this.filters.forEach((filter, index) => {
      const targetGain = enabled ? (settings.bands[index] ?? 0) : 0;
      filter.gain.setTargetAtTime(targetGain, this.audioCtx!.currentTime, 0.05);
    });
  }

  public applyNormalizationSettings(settings: VolumeNormalizationSettings) {
    if (!this.isInitialized || !this.audioCtx || !this.compressorNode || !this.normalizerGain) {
      return;
    }

    this.resume();
    const now = this.audioCtx.currentTime;

    if (!settings.enabled) {
      // Bypass compression and normalization gain
      this.compressorNode.threshold.setTargetAtTime(0, now, 0.05);
      this.compressorNode.knee.setTargetAtTime(0, now, 0.05);
      this.compressorNode.ratio.setTargetAtTime(1.0, now, 0.05);
      this.compressorNode.attack.setTargetAtTime(0.01, now, 0.05);
      this.compressorNode.release.setTargetAtTime(0.25, now, 0.05);
      this.normalizerGain.gain.setTargetAtTime(1.0, now, 0.05);
      return;
    }

    const modeConfig =
      VOLUME_NORMALIZATION_MODES[settings.mode] || VOLUME_NORMALIZATION_MODES.standard;

    // Set dynamic compressor parameters based on selected target mode
    this.compressorNode.threshold.setTargetAtTime(modeConfig.threshold, now, 0.05);
    this.compressorNode.knee.setTargetAtTime(modeConfig.knee, now, 0.05);
    this.compressorNode.ratio.setTargetAtTime(modeConfig.ratio, now, 0.05);
    this.compressorNode.attack.setTargetAtTime(modeConfig.attack, now, 0.05);
    this.compressorNode.release.setTargetAtTime(modeConfig.release, now, 0.05);

    // Apply makeup gain and user preamp trim (-6 to +6 dB)
    const effectiveMakeupDb = modeConfig.makeupGainDb + (settings.preampTrim || 0);
    const linearGain = Math.pow(10, effectiveMakeupDb / 20);
    this.normalizerGain.gain.setTargetAtTime(linearGain, now, 0.05);
  }

  public getLiveAudioMetrics(): {
    rmsDb: number;
    peakDb: number;
    gainReductionDb: number;
    isCompressing: boolean;
  } {
    if (!this.analyser) {
      return { rmsDb: -60, peakDb: -60, gainReductionDb: 0, isCompressing: false };
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(timeData);

    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const norm = (timeData[i] - 128) / 128;
      sumSquares += norm * norm;
      const abs = Math.abs(norm);
      if (abs > peak) peak = abs;
    }

    const rms = Math.sqrt(sumSquares / bufferLength);
    const rmsDb = rms > 0.0001 ? Math.max(-60, Math.round(20 * Math.log10(rms) * 10) / 10) : -60;
    const peakDb = peak > 0.0001 ? Math.max(-60, Math.round(20 * Math.log10(peak) * 10) / 10) : -60;

    let gainReductionDb = 0;
    if (this.compressorNode) {
      const rawRed =
        typeof this.compressorNode.reduction === 'number'
          ? this.compressorNode.reduction
          : (this.compressorNode.reduction as any)?.value ?? 0;
      gainReductionDb = Math.round(rawRed * 10) / 10;
    }

    return {
      rmsDb,
      peakDb,
      gainReductionDb,
      isCompressing: Math.abs(gainReductionDb) > 0.3,
    };
  }

  public getSpectrumData(outputArray: Uint8Array): boolean {
    if (!this.analyser) return false;
    try {
      this.analyser.getByteFrequencyData(outputArray);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mathematically calculates the composite frequency response curve in dB
   * for a given list of frequencies across 20Hz to 20kHz.
   */
  public calculateFrequencyCurve(
    bands: number[],
    preamp: number,
    enabled: boolean,
    pointsCount = 64
  ): { x: number; y: number; freq: number; db: number }[] {
    const minFreq = 20;
    const maxFreq = 20000;
    const points: { x: number; y: number; freq: number; db: number }[] = [];

    const effectivePreamp = enabled ? preamp : 0;

    for (let i = 0; i < pointsCount; i++) {
      // Logarithmic distribution of frequencies
      const t = i / (pointsCount - 1);
      const freq = minFreq * Math.pow(maxFreq / minFreq, t);

      let totalDb = effectivePreamp;

      if (enabled) {
        // Approximate summation of filter bands around center frequencies
        for (let b = 0; b < EQUALIZER_FREQUENCIES.length; b++) {
          const center = EQUALIZER_FREQUENCIES[b];
          const gain = bands[b] || 0;
          if (gain === 0) continue;

          // Distance in octaves
          const octaveDiff = Math.abs(Math.log2(freq / center));
          // Bell curve influence
          const bandwidth = 1.0; // ~1 octave wide
          const weight = Math.exp(-Math.pow(octaveDiff / bandwidth, 2) * 1.8);
          totalDb += gain * weight;
        }
      }

      // Clamp db between -15 and +15 for drawing
      const clampedDb = Math.max(-15, Math.min(15, totalDb));
      // Map db to y normalized (0 to 1, where 0.5 is 0dB, 0 is +15dB, 1 is -15dB)
      const normalizedY = 0.5 - clampedDb / 30;

      points.push({
        x: t,
        y: normalizedY,
        freq,
        db: totalDb,
      });
    }

    return points;
  }
}

export const audioEqualizer = new AudioEqualizerManager();

