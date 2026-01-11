/**
 * EnhancedBass - Amplify and extend existing bass frequencies
 * Uses extracted bass and adds sub-harmonic enhancement
 */

import type { BassProfile, BassGeneratorConfig } from '../../types/bassGenerator';

export interface EnhancedBassOptions {
  // Amplification gain for existing bass
  enhancementGain: number;
  // Intensity (0-1)
  intensity: number;
  // Frequency range
  frequencyMin: number;
  frequencyMax: number;
  // Sub-harmonic mix (0-1)
  subHarmonicMix: number;
  // Octave divider for sub-harmonics
  octaveDivider: 2 | 4;
}

const DEFAULT_OPTIONS: EnhancedBassOptions = {
  enhancementGain: 2.0,
  intensity: 0.7,
  frequencyMin: 20,
  frequencyMax: 80,
  subHarmonicMix: 0.3,
  octaveDivider: 2,
};

export class EnhancedBass {
  private options: EnhancedBassOptions;

  constructor(options: Partial<EnhancedBassOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Update options from bass generator config
   */
  updateFromConfig(config: BassGeneratorConfig): void {
    this.options.enhancementGain = config.enhancementGain;
    this.options.intensity = config.intensity;
    this.options.frequencyMin = config.frequencyMin;
    this.options.frequencyMax = config.frequencyMax;
  }

  /**
   * Generate enhanced bass from extracted bass buffer
   */
  async generate(
    bassBuffer: AudioBuffer,
    bassProfile: BassProfile[],
    onProgress?: (progress: number) => void
  ): Promise<AudioBuffer> {
    const sampleRate = bassBuffer.sampleRate;
    const numSamples = bassBuffer.length;
    
    // Create output buffer
    const outputBuffer = new AudioBuffer({
      numberOfChannels: 1,
      length: numSamples,
      sampleRate,
    });
    const outputData = outputBuffer.getChannelData(0);
    
    // Get mono bass data
    const bassData = this.getMonoData(bassBuffer);
    
    const { enhancementGain, intensity, subHarmonicMix, octaveDivider } = this.options;
    
    // Apply enhancement
    for (let i = 0; i < numSamples; i++) {
      // Amplify existing bass
      let sample = bassData[i] * enhancementGain * intensity;
      
      // Add sub-harmonic (octave divider effect)
      if (subHarmonicMix > 0) {
        const subHarmonic = this.generateSubHarmonic(bassData, i, sampleRate, octaveDivider);
        sample += subHarmonic * subHarmonicMix * intensity;
      }
      
      outputData[i] = sample;
      
      if (onProgress && i % 10000 === 0) {
        onProgress((i / numSamples) * 100);
      }
    }
    
    // Apply dynamic processing based on bass profile
    this.applyDynamicProcessing(outputData, bassProfile);
    
    // Normalize
    this.normalizeBuffer(outputData);
    
    return outputBuffer;
  }

  /**
   * Generate enhanced bass with envelope following
   * Optimized for speed
   */
  async generateWithEnvelope(
    bassBuffer: AudioBuffer,
    bassProfile: BassProfile[],
    onProgress?: (progress: number) => void
  ): Promise<AudioBuffer> {
    const sampleRate = bassBuffer.sampleRate;
    const numSamples = bassBuffer.length;
    
    const outputBuffer = new AudioBuffer({
      numberOfChannels: 1,
      length: numSamples,
      sampleRate,
    });
    const outputData = outputBuffer.getChannelData(0);
    
    const bassData = this.getMonoData(bassBuffer);
    
    const { enhancementGain, intensity, frequencyMin } = this.options;
    
    // Calculate envelope from bass profile
    const envelope = this.calculateEnvelope(bassProfile, numSamples, sampleRate);
    
    // Pre-calculate constants
    const baseFreq = (frequencyMin + 40) / 2;
    const phaseIncrement = (2 * Math.PI * baseFreq) / sampleRate;
    const twoPi = 2 * Math.PI;
    
    // Process in batches for UI responsiveness
    const batchSize = 50000;
    let phase = 0;
    
    for (let batch = 0; batch < numSamples; batch += batchSize) {
      const end = Math.min(batch + batchSize, numSamples);
      
      for (let i = batch; i < end; i++) {
        // Enhanced original bass + synthesized sub-bass
        const envValue = envelope[i] || 0;
        const synthBass = Math.sin(phase) * envValue * intensity * 0.5;
        outputData[i] = bassData[i] * enhancementGain * intensity + synthBass;
        
        phase += phaseIncrement;
        if (phase > twoPi) phase -= twoPi;
      }
      
      // Yield to UI
      onProgress?.((end / numSamples) * 100);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    this.normalizeBuffer(outputData);
    
    return outputBuffer;
  }

  /**
   * Get mono data from buffer
   */
  private getMonoData(buffer: AudioBuffer): Float32Array {
    const length = buffer.length;
    const mono = new Float32Array(length);
    const numChannels = buffer.numberOfChannels;
    
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numChannels;
      }
    }
    
    return mono;
  }

  /**
   * Generate sub-harmonic using simple octave divider
   * This creates frequencies an octave below the input
   */
  private generateSubHarmonic(
    data: Float32Array,
    index: number,
    sampleRate: number,
    divider: number
  ): number {
    // Simple zero-crossing based octave divider
    // Look back to find zero crossings and generate sub-octave
    const lookback = Math.floor(sampleRate / 20); // Max period for 20 Hz
    
    if (index < lookback) return 0;
    
    // Count zero crossings in lookback window
    let crossings = 0;
    for (let i = index - lookback; i < index - 1; i++) {
      if ((data[i] >= 0 && data[i + 1] < 0) || (data[i] < 0 && data[i + 1] >= 0)) {
        crossings++;
      }
    }
    
    // Generate sub-harmonic as square-ish wave at divided frequency
    const phase = (crossings / divider) % 2;
    return phase < 1 ? data[index] * 0.5 : -data[index] * 0.5;
  }

  /**
   * Calculate amplitude envelope from bass profile
   */
  private calculateEnvelope(
    profile: BassProfile[],
    numSamples: number,
    sampleRate: number
  ): Float32Array {
    const envelope = new Float32Array(numSamples);
    
    if (profile.length === 0) return envelope;
    
    // Normalize profile energies
    let maxEnergy = 0;
    for (const p of profile) {
      if (p.lowEnergy > maxEnergy) maxEnergy = p.lowEnergy;
    }
    
    if (maxEnergy === 0) return envelope;
    
    // Interpolate envelope
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      
      // Find surrounding profile points
      let prevIdx = 0;
      for (let j = 0; j < profile.length; j++) {
        if (profile[j].time <= time) {
          prevIdx = j;
        } else {
          break;
        }
      }
      
      const nextIdx = Math.min(prevIdx + 1, profile.length - 1);
      const prevProfile = profile[prevIdx];
      const nextProfile = profile[nextIdx];
      
      // Linear interpolation
      let t = 0;
      if (nextIdx !== prevIdx && nextProfile.time !== prevProfile.time) {
        t = (time - prevProfile.time) / (nextProfile.time - prevProfile.time);
      }
      
      const energy = prevProfile.lowEnergy * (1 - t) + nextProfile.lowEnergy * t;
      envelope[i] = energy / maxEnergy;
    }
    
    // Smooth envelope
    this.smoothEnvelope(envelope, Math.floor(sampleRate * 0.01));
    
    return envelope;
  }

  /**
   * Smooth envelope using moving average
   */
  private smoothEnvelope(envelope: Float32Array, windowSize: number): void {
    const halfWindow = Math.floor(windowSize / 2);
    const smoothed = new Float32Array(envelope.length);
    
    for (let i = 0; i < envelope.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - halfWindow); j < Math.min(envelope.length, i + halfWindow); j++) {
        sum += envelope[j];
        count++;
      }
      
      smoothed[i] = sum / count;
    }
    
    envelope.set(smoothed);
  }

  /**
   * Apply dynamic processing based on bass profile
   */
  private applyDynamicProcessing(
    data: Float32Array,
    profile: BassProfile[]
  ): void {
    if (profile.length === 0) return;
    
    // Calculate average energy for normalization
    let avgEnergy = 0;
    for (const p of profile) {
      avgEnergy += p.lowEnergy;
    }
    avgEnergy /= profile.length;
    
    if (avgEnergy === 0) return;
    
    // Apply soft compression
    const threshold = avgEnergy * 1.5;
    const ratio = 3;
    
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > threshold) {
        const excess = abs - threshold;
        const compressed = threshold + excess / ratio;
        data[i] = data[i] > 0 ? compressed : -compressed;
      }
    }
  }

  /**
   * Normalize buffer to prevent clipping
   */
  private normalizeBuffer(data: Float32Array, targetPeak: number = 0.9): void {
    let maxAbs = 0;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxAbs) maxAbs = abs;
    }
    
    if (maxAbs > 0) {
      const scale = targetPeak / maxAbs;
      for (let i = 0; i < data.length; i++) {
        data[i] *= scale;
      }
    }
  }
}

// Export factory function
export function createEnhancedBass(options?: Partial<EnhancedBassOptions>): EnhancedBass {
  return new EnhancedBass(options);
}
