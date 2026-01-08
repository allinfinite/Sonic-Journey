/**
 * Oscillator module for vibroacoustic synthesis
 * Generates sine waves with optional modulation, harmonic enrichment, and entrainment patterns
 */

import { EntrainmentMode, ENTRAINMENT_PRESETS } from '../types/journey';

export class Oscillator {
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Generate a pure sine wave at constant frequency
   */
  generateSine(
    durationSamples: number,
    frequency: number,
    amplitude: number = 1.0,
    phaseOffset: number = 0.0
  ): Float32Array {
    const output = new Float32Array(durationSamples);
    const twoPiOverSampleRate = (2 * Math.PI) / this.sampleRate;

    for (let i = 0; i < durationSamples; i++) {
      output[i] = amplitude * Math.sin(twoPiOverSampleRate * frequency * i + phaseOffset);
    }

    return output;
  }

  /**
   * Generate sine wave with frequency glide (portamento)
   */
  generateGlide(
    durationSamples: number,
    freqStart: number,
    freqEnd: number,
    amplitude: number = 1.0,
    glideType: 'linear' | 'exponential' = 'linear',
    phaseOffset: number = 0.0
  ): Float32Array {
    const output = new Float32Array(durationSamples);
    let phase = phaseOffset;
    const twoPiOverSampleRate = (2 * Math.PI) / this.sampleRate;

    for (let i = 0; i < durationSamples; i++) {
      const t = i / (durationSamples - 1);
      let freq: number;

      if (glideType === 'exponential' && freqStart > 0 && freqEnd > 0) {
        freq = freqStart * Math.pow(freqEnd / freqStart, t);
      } else {
        freq = freqStart + (freqEnd - freqStart) * t;
      }

      output[i] = amplitude * Math.sin(phase);
      phase += twoPiOverSampleRate * freq;
    }

    return output;
  }

  /**
   * Generate frequency-modulated sine wave
   */
  generateFM(
    durationSamples: number,
    carrierFreq: number,
    modFreq: number,
    modDepth: number,
    amplitude: number = 1.0,
    phaseOffset: number = 0.0
  ): Float32Array {
    const output = new Float32Array(durationSamples);
    let phase = phaseOffset;
    const twoPiOverSampleRate = (2 * Math.PI) / this.sampleRate;

    for (let i = 0; i < durationSamples; i++) {
      const t = i / this.sampleRate;
      const modulator = modDepth * Math.sin(2 * Math.PI * modFreq * t);
      const instFreq = carrierFreq + modulator;

      output[i] = amplitude * Math.sin(phase);
      phase += twoPiOverSampleRate * instFreq;
    }

    return output;
  }

  /**
   * Generate sine wave with both frequency glide and FM modulation
   * This is the primary oscillator for vibroacoustic journeys
   */
  generateComplex(
    durationSamples: number,
    freqStart: number,
    freqEnd: number,
    modFreq: number = 0.1,
    modDepth: number = 0.0,
    amplitude: number = 1.0,
    glideType: 'linear' | 'exponential' = 'linear',
    phaseOffset: number = 0.0
  ): Float32Array {
    const output = new Float32Array(durationSamples);
    let phase = phaseOffset;
    const twoPiOverSampleRate = (2 * Math.PI) / this.sampleRate;
    const durationSec = durationSamples / this.sampleRate;

    for (let i = 0; i < durationSamples; i++) {
      const t = i / this.sampleRate;
      const progress = durationSec > 0 ? t / durationSec : 0;

      // Frequency glide
      let freq: number;
      if (glideType === 'exponential' && freqStart > 0 && freqEnd > 0) {
        freq = freqStart * Math.pow(freqEnd / freqStart, progress);
      } else {
        freq = freqStart + (freqEnd - freqStart) * progress;
      }

      // Add FM modulation
      if (modDepth > 0) {
        const modulator = modDepth * Math.sin(2 * Math.PI * modFreq * t);
        freq += modulator;
      }

      output[i] = amplitude * Math.sin(phase);
      phase += twoPiOverSampleRate * freq;
    }

    return output;
  }

  /**
   * Generate isochronic tones - rhythmic amplitude pulses for entrainment
   */
  generateIsochronic(
    durationSamples: number,
    carrierFreq: number,
    pulseRate: number,
    amplitude: number = 1.0,
    dutyCycle: number = 0.5,
    smoothing: number = 0.1
  ): Float32Array {
    const output = new Float32Array(durationSamples);

    // Generate carrier tone
    const twoPiOverSampleRate = (2 * Math.PI) / this.sampleRate;
    let phase = 0;

    for (let i = 0; i < durationSamples; i++) {
      const t = i / this.sampleRate;
      const carrier = Math.sin(phase);
      phase += twoPiOverSampleRate * carrierFreq;

      // Generate pulse envelope
      if (pulseRate <= 0) {
        output[i] = amplitude * carrier;
        continue;
      }

      const pulsePhase = (t * pulseRate) % 1.0;
      let envelope = 0;

      // Rise phase
      const riseEnd = dutyCycle * smoothing;
      if (pulsePhase < riseEnd && riseEnd > 0) {
        envelope = 0.5 * (1 - Math.cos(Math.PI * pulsePhase / riseEnd));
      }
      // Sustain phase
      else if (pulsePhase >= riseEnd && pulsePhase < dutyCycle * (1 - smoothing)) {
        envelope = 1.0;
      }
      // Fall phase
      else if (pulsePhase >= dutyCycle * (1 - smoothing) && pulsePhase < dutyCycle) {
        const fallStart = dutyCycle * (1 - smoothing);
        const fallEnd = dutyCycle;
        const fallProgress = (pulsePhase - fallStart) / (fallEnd - fallStart);
        envelope = 0.5 * (1 + Math.cos(Math.PI * fallProgress));
      }
      // Off phase
      else {
        envelope = 0;
      }

      output[i] = amplitude * carrier * envelope;
    }

    return output;
  }

  /**
   * Generate an amplitude envelope for entrainment/rhythm patterns
   */
  generateEntrainmentEnvelope(
    durationSamples: number,
    mode: EntrainmentMode = 'breathing',
    customRate?: number,
    customDepth?: number
  ): Float32Array {
    const preset = ENTRAINMENT_PRESETS[mode];
    const rate = customRate ?? preset.rate;
    const depth = customDepth ?? preset.depth;

    const output = new Float32Array(durationSamples);

    if (rate <= 0 || depth <= 0) {
      output.fill(1.0);
      return output;
    }

    for (let i = 0; i < durationSamples; i++) {
      const t = i / this.sampleRate;

      if (mode === 'heartbeat') {
        // Double-pulse pattern for heartbeat (lub-dub)
        const beatPhase = (t * rate) % 1.0;
        const lub = Math.exp(-Math.pow(beatPhase - 0.1, 2) / 0.005);
        const dub = 0.7 * Math.exp(-Math.pow(beatPhase - 0.25, 2) / 0.003);
        output[i] = 1.0 + depth * (lub + dub);
      } else {
        // Sinusoidal modulation for smooth breathing/wave patterns
        output[i] = 1.0 + depth * Math.sin(2 * Math.PI * rate * t);
      }
    }

    return output;
  }

  /**
   * Generate oscillator with both FM modulation and entrainment envelope
   */
  generateWithEntrainment(
    durationSamples: number,
    freqStart: number,
    freqEnd: number,
    entrainmentMode: EntrainmentMode = 'breathing',
    entrainmentRate?: number,
    modFreq: number = 0.1,
    modDepth: number = 0.0,
    amplitude: number = 1.0
  ): Float32Array {
    // Generate base complex oscillator
    const baseSignal = this.generateComplex(
      durationSamples,
      freqStart,
      freqEnd,
      modFreq,
      modDepth * 2.0, // Scale to reasonable Hz deviation
      amplitude
    );

    // Apply entrainment envelope
    if (entrainmentMode && entrainmentMode !== 'none') {
      const envelope = this.generateEntrainmentEnvelope(
        durationSamples,
        entrainmentMode,
        entrainmentRate
      );

      for (let i = 0; i < durationSamples; i++) {
        baseSignal[i] *= envelope[i];
      }
    }

    return baseSignal;
  }

  /**
   * Apply soft saturation for harmonic enrichment
   * Uses tanh waveshaping for smooth clipping
   */
  softSaturate(signal: Float32Array, drive: number = 0.3): Float32Array {
    if (drive <= 0) return signal;

    const output = new Float32Array(signal.length);
    let maxVal = 0;
    let maxInput = 0;

    // Find max input
    for (let i = 0; i < signal.length; i++) {
      maxInput = Math.max(maxInput, Math.abs(signal[i]));
    }

    // Apply saturation
    for (let i = 0; i < signal.length; i++) {
      const driven = signal[i] * (1 + drive * 3);
      output[i] = Math.tanh(driven);
      maxVal = Math.max(maxVal, Math.abs(output[i]));
    }

    // Normalize to maintain consistent amplitude
    if (maxVal > 0 && maxInput > 0) {
      const normalize = maxInput / maxVal;
      for (let i = 0; i < output.length; i++) {
        output[i] *= normalize;
      }
    }

    return output;
  }
}
