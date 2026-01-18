/**
 * MelodyMixer - Combines multiple melody generation styles with crossfades
 * Manages the overall melody layer output by blending generators based on weights
 */

import type { 
  MelodyGeneratorConfig, 
  MelodyStyle, 
  MelodyNote,
  DroneSettings,
  ArpeggioSettings,
  EvolvingSettings,
  HarmonicSettings
} from '../../types/melodyGenerator';
import { DEFAULT_MELODY_CONFIG } from '../../types/melodyGenerator';
import type { EntrainmentMode } from '../../types/journey';

import { DroneGenerator, createDroneGenerator } from './DroneGenerator';
import { ArpeggioGenerator, createArpeggioGenerator } from './ArpeggioGenerator';
import { EvolvingSequencer, createEvolvingSequencer } from './EvolvingSequencer';
import { HarmonicGenerator, createHarmonicGenerator } from './HarmonicGenerator';

export interface MelodyMixerOptions {
  config?: Partial<MelodyGeneratorConfig>;
  droneSettings?: Partial<DroneSettings>;
  arpeggioSettings?: Partial<ArpeggioSettings>;
  evolvingSettings?: Partial<EvolvingSettings>;
  harmonicSettings?: Partial<HarmonicSettings>;
  sampleRate?: number;
}

export interface GenerateOptions {
  durationSeconds: number;
  foundationFreq: number;
  freqEnd?: number;
  entrainmentMode?: EntrainmentMode;
  style?: MelodyStyle;
  progress?: number;
  onProgress?: (progress: number) => void;
}

export class MelodyMixer {
  private config: MelodyGeneratorConfig;
  private sampleRate: number;

  // Individual generators
  private droneGenerator: DroneGenerator;
  private arpeggioGenerator: ArpeggioGenerator;
  private evolvingSequencer: EvolvingSequencer;
  private harmonicGenerator: HarmonicGenerator;

  constructor(options: MelodyMixerOptions = {}) {
    this.config = { ...DEFAULT_MELODY_CONFIG, ...options.config };
    this.sampleRate = options.sampleRate ?? 48000;

    // Initialize generators
    this.droneGenerator = createDroneGenerator(
      this.config,
      options.droneSettings,
      this.sampleRate
    );

    this.arpeggioGenerator = createArpeggioGenerator(
      this.config,
      options.arpeggioSettings,
      this.sampleRate
    );

    this.evolvingSequencer = createEvolvingSequencer(
      this.config,
      options.evolvingSettings,
      this.sampleRate
    );

    this.harmonicGenerator = createHarmonicGenerator(
      this.config,
      options.harmonicSettings,
      this.sampleRate
    );
  }

  /**
   * Update configuration for all generators
   */
  updateConfig(config: Partial<MelodyGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
    this.droneGenerator.updateConfig(this.config);
    this.arpeggioGenerator.updateConfig(this.config);
    this.evolvingSequencer.updateConfig(this.config);
    this.harmonicGenerator.updateConfig(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): MelodyGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Generate melody using the specified style or mix
   */
  async generate(options: GenerateOptions): Promise<{ buffer: AudioBuffer; notes: MelodyNote[] }> {
    const {
      durationSeconds,
      foundationFreq,
      freqEnd,
      entrainmentMode = 'breathing',
      style = 'mixed',
      progress = 0,
      onProgress,
    } = options;

    // For single style, use that generator directly
    if (style !== 'mixed' && style !== 'upload') {
      return this.generateSingleStyle(style, options);
    }

    // For mixed style, blend all generators based on weights
    return this.generateMixed(options);
  }

  /**
   * Generate using a single style
   */
  private async generateSingleStyle(
    style: MelodyStyle,
    options: GenerateOptions
  ): Promise<{ buffer: AudioBuffer; notes: MelodyNote[] }> {
    const {
      durationSeconds,
      foundationFreq,
      freqEnd,
      entrainmentMode = 'breathing',
      progress = 0,
      onProgress,
    } = options;

    switch (style) {
      case 'drone':
        return this.droneGenerator.generate(
          durationSeconds,
          foundationFreq,
          progress,
          onProgress
        );

      case 'arpeggio':
        return this.arpeggioGenerator.generate(
          durationSeconds,
          foundationFreq,
          entrainmentMode,
          progress,
          onProgress
        );

      case 'evolving':
        return this.evolvingSequencer.generate(
          durationSeconds,
          foundationFreq,
          entrainmentMode,
          progress,
          onProgress
        );

      case 'harmonic':
        return this.harmonicGenerator.generate(
          durationSeconds,
          foundationFreq,
          freqEnd,
          progress,
          onProgress
        );

      default:
        // Return empty buffer for unknown styles
        const buffer = new AudioBuffer({
          numberOfChannels: 2,
          length: Math.ceil(durationSeconds * this.sampleRate),
          sampleRate: this.sampleRate,
        });
        return { buffer, notes: [] };
    }
  }

  /**
   * Generate mixed melody using all generators blended by weights
   */
  private async generateMixed(
    options: GenerateOptions
  ): Promise<{ buffer: AudioBuffer; notes: MelodyNote[] }> {
    const {
      durationSeconds,
      foundationFreq,
      freqEnd,
      entrainmentMode = 'breathing',
      progress = 0,
      onProgress,
    } = options;

    const numSamples = Math.ceil(durationSeconds * this.sampleRate);

    // Create output buffer
    const buffer = new AudioBuffer({
      numberOfChannels: 2,
      length: numSamples,
      sampleRate: this.sampleRate,
    });

    const allNotes: MelodyNote[] = [];

    // Calculate total weight for normalization
    const totalWeight = 
      this.config.droneWeight +
      this.config.arpeggioWeight +
      this.config.evolvingWeight +
      this.config.harmonicWeight;

    if (totalWeight === 0) {
      return { buffer, notes: allNotes };
    }

    // Normalize weights
    const droneWeight = this.config.droneWeight / totalWeight;
    const arpeggioWeight = this.config.arpeggioWeight / totalWeight;
    const evolvingWeight = this.config.evolvingWeight / totalWeight;
    const harmonicWeight = this.config.harmonicWeight / totalWeight;

    // Generate each style
    const progressStep = 25;
    let currentProgress = 0;

    // Drone
    if (droneWeight > 0) {
      const droneResult = await this.droneGenerator.generate(
        durationSeconds,
        foundationFreq,
        progress,
        (p) => onProgress?.(currentProgress + (p / 100) * progressStep)
      );
      this.mixIntoBuffer(buffer, droneResult.buffer, droneWeight);
      allNotes.push(...droneResult.notes.map(n => ({ ...n, velocity: n.velocity * droneWeight })));
    }
    currentProgress += progressStep;

    // Arpeggio
    if (arpeggioWeight > 0) {
      const arpResult = await this.arpeggioGenerator.generate(
        durationSeconds,
        foundationFreq,
        entrainmentMode,
        progress,
        (p) => onProgress?.(currentProgress + (p / 100) * progressStep)
      );
      this.mixIntoBuffer(buffer, arpResult.buffer, arpeggioWeight);
      allNotes.push(...arpResult.notes.map(n => ({ ...n, velocity: n.velocity * arpeggioWeight })));
    }
    currentProgress += progressStep;

    // Evolving
    if (evolvingWeight > 0) {
      const evolvingResult = await this.evolvingSequencer.generate(
        durationSeconds,
        foundationFreq,
        entrainmentMode,
        progress,
        (p) => onProgress?.(currentProgress + (p / 100) * progressStep)
      );
      this.mixIntoBuffer(buffer, evolvingResult.buffer, evolvingWeight);
      allNotes.push(...evolvingResult.notes.map(n => ({ ...n, velocity: n.velocity * evolvingWeight })));
    }
    currentProgress += progressStep;

    // Harmonic
    if (harmonicWeight > 0) {
      const harmonicResult = await this.harmonicGenerator.generate(
        durationSeconds,
        foundationFreq,
        freqEnd,
        progress,
        (p) => onProgress?.(currentProgress + (p / 100) * progressStep)
      );
      this.mixIntoBuffer(buffer, harmonicResult.buffer, harmonicWeight);
      allNotes.push(...harmonicResult.notes.map(n => ({ ...n, velocity: n.velocity * harmonicWeight })));
    }

    onProgress?.(100);

    return { buffer, notes: allNotes };
  }

  /**
   * Mix source buffer into destination with gain
   */
  private mixIntoBuffer(dest: AudioBuffer, source: AudioBuffer, gain: number): void {
    const channels = Math.min(dest.numberOfChannels, source.numberOfChannels);
    const samples = Math.min(dest.length, source.length);

    for (let ch = 0; ch < channels; ch++) {
      const destData = dest.getChannelData(ch);
      const sourceData = source.getChannelData(ch);

      for (let i = 0; i < samples; i++) {
        destData[i] += sourceData[i] * gain;
      }
    }
  }

  /**
   * Apply crossfade between two melody buffers
   */
  crossfade(
    bufferA: AudioBuffer,
    bufferB: AudioBuffer,
    crossfadeSamples: number
  ): AudioBuffer {
    const channels = Math.max(bufferA.numberOfChannels, bufferB.numberOfChannels);
    const totalLength = bufferA.length + bufferB.length - crossfadeSamples;

    const result = new AudioBuffer({
      numberOfChannels: channels,
      length: totalLength,
      sampleRate: this.sampleRate,
    });

    for (let ch = 0; ch < channels; ch++) {
      const resultData = result.getChannelData(ch);
      const dataA = ch < bufferA.numberOfChannels ? bufferA.getChannelData(ch) : new Float32Array(bufferA.length);
      const dataB = ch < bufferB.numberOfChannels ? bufferB.getChannelData(ch) : new Float32Array(bufferB.length);

      // Copy first part of buffer A (before crossfade)
      const crossfadeStart = bufferA.length - crossfadeSamples;
      for (let i = 0; i < crossfadeStart; i++) {
        resultData[i] = dataA[i];
      }

      // Crossfade region
      for (let i = 0; i < crossfadeSamples; i++) {
        const fadeOut = Math.cos((i / crossfadeSamples) * Math.PI / 2);
        const fadeIn = Math.sin((i / crossfadeSamples) * Math.PI / 2);
        resultData[crossfadeStart + i] = dataA[crossfadeStart + i] * fadeOut + dataB[i] * fadeIn;
      }

      // Copy remainder of buffer B (after crossfade)
      for (let i = crossfadeSamples; i < bufferB.length; i++) {
        resultData[crossfadeStart + i] = dataB[i];
      }
    }

    return result;
  }

  /**
   * Reset all generators
   */
  reset(): void {
    this.evolvingSequencer.reset();
  }

  /**
   * Get individual generators for advanced use
   */
  getGenerators(): {
    drone: DroneGenerator;
    arpeggio: ArpeggioGenerator;
    evolving: EvolvingSequencer;
    harmonic: HarmonicGenerator;
  } {
    return {
      drone: this.droneGenerator,
      arpeggio: this.arpeggioGenerator,
      evolving: this.evolvingSequencer,
      harmonic: this.harmonicGenerator,
    };
  }
}

// Export factory function
export function createMelodyMixer(options?: MelodyMixerOptions): MelodyMixer {
  return new MelodyMixer(options);
}
