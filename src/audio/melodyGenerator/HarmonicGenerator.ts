/**
 * HarmonicGenerator - Creates upper harmonic partials of the foundation frequency
 * Adds shimmer and presence by emphasizing overtones in the audible melody range
 */

import type { 
  MelodyGeneratorConfig, 
  HarmonicSettings, 
  MelodyNote 
} from '../../types/melodyGenerator';
import { 
  DEFAULT_HARMONIC_SETTINGS
} from '../../types/melodyGenerator';

export interface HarmonicGeneratorOptions {
  config: MelodyGeneratorConfig;
  settings?: Partial<HarmonicSettings>;
}

export class HarmonicGenerator {
  private config: MelodyGeneratorConfig;
  private settings: HarmonicSettings;
  private sampleRate: number;

  constructor(options: HarmonicGeneratorOptions, sampleRate: number = 48000) {
    this.config = options.config;
    this.settings = { ...DEFAULT_HARMONIC_SETTINGS, ...options.settings };
    this.sampleRate = sampleRate;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MelodyGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update harmonic-specific settings
   */
  updateSettings(settings: Partial<HarmonicSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Generate harmonic overtones
   * @param durationSeconds Total duration in seconds
   * @param foundationFreq Current foundation frequency
   * @param freqEnd End foundation frequency (for gliding)
   * @param progress Phase progress (0-1)
   */
  async generate(
    durationSeconds: number,
    foundationFreq: number,
    freqEnd?: number,
    _progress: number = 0,
    onProgress?: (progress: number) => void
  ): Promise<{ buffer: AudioBuffer; notes: MelodyNote[] }> {
    const numSamples = Math.ceil(durationSeconds * this.sampleRate);
    const buffer = new AudioBuffer({
      numberOfChannels: 2,
      length: numSamples,
      sampleRate: this.sampleRate,
    });

    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    const notes: MelodyNote[] = [];

    // Calculate frequency range for glide
    const startFreq = foundationFreq;
    const endFreq = freqEnd ?? foundationFreq;

    // Filter harmonics to those within melody range
    const validHarmonics = this.getValidHarmonics(startFreq, endFreq);

    if (validHarmonics.length === 0) {
      return { buffer, notes };
    }

    // Track notes for visualization
    for (let h = 0; h < validHarmonics.length; h++) {
      const harmonic = validHarmonics[h].harmonic;
      notes.push({
        time: 0,
        duration: durationSeconds,
        frequency: startFreq * harmonic,
        velocity: validHarmonics[h].amplitude * this.config.intensity,
        pan: (h / validHarmonics.length) * this.config.stereoWidth - this.config.stereoWidth / 2,
      });
    }

    // Generate audio
    const twoPiOverSr = (2 * Math.PI) / this.sampleRate;
    const phases = validHarmonics.map((_, i) => this.settings.phases[i] || 0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      const normalizedT = t / durationSeconds;

      // Interpolate foundation frequency
      const currentFoundation = startFreq + (endFreq - startFreq) * normalizedT;

      // Amplitude envelope
      const fadeTime = 2;
      let envelope = 1;
      if (t < fadeTime) {
        envelope = t / fadeTime;
      } else if (t > durationSeconds - fadeTime) {
        envelope = (durationSeconds - t) / fadeTime;
      }
      envelope = Math.pow(envelope, 0.5);

      let leftSample = 0;
      let rightSample = 0;

      // Sum all harmonics
      for (let h = 0; h < validHarmonics.length; h++) {
        const { harmonic, amplitude } = validHarmonics[h];
        const freq = currentFoundation * harmonic;

        // Skip if outside melody range
        if (freq < this.config.frequencyMin || freq > this.config.frequencyMax) {
          continue;
        }

        // Generate sine wave
        const sample = Math.sin(phases[h]) * amplitude * this.config.intensity * envelope;
        phases[h] += twoPiOverSr * freq;

        // Keep phase in bounds
        if (phases[h] > 2 * Math.PI) {
          phases[h] -= 2 * Math.PI;
        }

        // Stereo spread (higher harmonics more spread out)
        const pan = ((h / validHarmonics.length) * 2 - 1) * this.config.stereoWidth;
        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((pan + 1) * Math.PI / 4);

        leftSample += sample * leftGain;
        rightSample += sample * rightGain;
      }

      leftChannel[i] = leftSample;
      rightChannel[i] = rightSample;

      if (onProgress && i % 10000 === 0) {
        onProgress((i / numSamples) * 100);
      }
    }

    return { buffer, notes };
  }

  /**
   * Get harmonics that fall within the melody frequency range
   */
  private getValidHarmonics(
    startFreq: number,
    endFreq: number
  ): Array<{ harmonic: number; amplitude: number }> {
    const valid: Array<{ harmonic: number; amplitude: number }> = [];
    const minFreq = Math.min(startFreq, endFreq);
    const maxFreq = Math.max(startFreq, endFreq);

    for (let i = 0; i < this.settings.harmonics.length; i++) {
      const harmonic = this.settings.harmonics[i];
      const amplitude = this.settings.amplitudes[i] ?? 0.1;

      // Check if this harmonic falls within melody range for any point in the glide
      const minHarmonicFreq = minFreq * harmonic;
      const maxHarmonicFreq = maxFreq * harmonic;

      // If harmonic range overlaps with melody range
      if (maxHarmonicFreq >= this.config.frequencyMin && 
          minHarmonicFreq <= this.config.frequencyMax) {
        valid.push({ harmonic, amplitude });
      }
    }

    return valid;
  }

  /**
   * Generate harmonics for a single frame (for real-time use)
   */
  generateFrame(
    foundationFreq: number,
    phases: number[]
  ): { left: number; right: number; phases: number[] } {
    const twoPiOverSr = (2 * Math.PI) / this.sampleRate;
    const newPhases = [...phases];
    
    let left = 0;
    let right = 0;

    for (let h = 0; h < this.settings.harmonics.length; h++) {
      const harmonic = this.settings.harmonics[h];
      const amplitude = this.settings.amplitudes[h] ?? 0.1;
      const freq = foundationFreq * harmonic;

      // Skip if outside range
      if (freq < this.config.frequencyMin || freq > this.config.frequencyMax) {
        continue;
      }

      // Ensure we have a phase for this harmonic
      if (newPhases[h] === undefined) {
        newPhases[h] = 0;
      }

      const sample = Math.sin(newPhases[h]) * amplitude * this.config.intensity;
      newPhases[h] += twoPiOverSr * freq;

      if (newPhases[h] > 2 * Math.PI) {
        newPhases[h] -= 2 * Math.PI;
      }

      // Stereo spread
      const pan = ((h / this.settings.harmonics.length) * 2 - 1) * this.config.stereoWidth;
      const leftGain = Math.cos((pan + 1) * Math.PI / 4);
      const rightGain = Math.sin((pan + 1) * Math.PI / 4);

      left += sample * leftGain;
      right += sample * rightGain;
    }

    return { left, right, phases: newPhases };
  }

  /**
   * Calculate harmonic frequencies for visualization
   */
  getHarmonicFrequencies(foundationFreq: number): number[] {
    return this.settings.harmonics
      .map(h => foundationFreq * h)
      .filter(f => f >= this.config.frequencyMin && f <= this.config.frequencyMax);
  }
}

// Export factory function
export function createHarmonicGenerator(
  config: MelodyGeneratorConfig,
  settings?: Partial<HarmonicSettings>,
  sampleRate?: number
): HarmonicGenerator {
  return new HarmonicGenerator({ config, settings }, sampleRate);
}
