/**
 * BeatSyncedBass - Generate bass pulses synchronized to detected beats
 * Creates sine wave pulses with configurable attack/decay envelope
 */

import type { Beat, BassGeneratorConfig } from '../../types/bassGenerator';

export interface BeatSyncedBassOptions {
  // Base frequency for bass pulses (Hz)
  baseFrequency: number;
  // Attack time (seconds)
  attackTime: number;
  // Decay time (seconds)
  decayTime: number;
  // Intensity (0-1)
  intensity: number;
  // Frequency range
  frequencyMin: number;
  frequencyMax: number;
}

const DEFAULT_OPTIONS: BeatSyncedBassOptions = {
  baseFrequency: 40,
  attackTime: 0.01,
  decayTime: 0.15,
  intensity: 0.7,
  frequencyMin: 20,
  frequencyMax: 80,
};

export class BeatSyncedBass {
  private options: BeatSyncedBassOptions;

  constructor(options: Partial<BeatSyncedBassOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Update options from bass generator config
   */
  updateFromConfig(config: BassGeneratorConfig): void {
    this.options.baseFrequency = config.baseFrequency;
    this.options.attackTime = config.attackTime;
    this.options.decayTime = config.decayTime;
    this.options.intensity = config.intensity;
    this.options.frequencyMin = config.frequencyMin;
    this.options.frequencyMax = config.frequencyMax;
  }

  /**
   * Generate bass track from beats
   */
  async generate(
    beats: Beat[],
    duration: number,
    sampleRate: number,
    onProgress?: (progress: number) => void
  ): Promise<AudioBuffer> {
    const numSamples = Math.ceil(duration * sampleRate);
    const audioCtx = new OfflineAudioContext(1, numSamples, sampleRate);
    
    // Create output buffer
    const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    const { baseFrequency, attackTime, decayTime, intensity } = this.options;
    
    // Generate a pulse for each beat
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const beatStartSample = Math.floor(beat.time * sampleRate);
      
      // Scale frequency slightly by beat strength for variation
      const freq = baseFrequency * (0.9 + 0.2 * beat.strength);
      
      // Calculate envelope duration
      const pulseDuration = attackTime + decayTime;
      const pulseSamples = Math.ceil(pulseDuration * sampleRate);
      const attackSamples = Math.ceil(attackTime * sampleRate);
      
      // Generate pulse
      for (let s = 0; s < pulseSamples; s++) {
        const sampleIdx = beatStartSample + s;
        if (sampleIdx >= numSamples) break;
        
        // Calculate envelope
        let envelope: number;
        if (s < attackSamples) {
          // Attack phase (linear ramp up)
          envelope = s / attackSamples;
        } else {
          // Decay phase (exponential decay)
          const decaySample = s - attackSamples;
          const decaySamples = pulseSamples - attackSamples;
          envelope = Math.exp(-3 * decaySample / decaySamples);
        }
        
        // Generate sine wave
        const t = s / sampleRate;
        const sample = Math.sin(2 * Math.PI * freq * t) * envelope * intensity * beat.strength;
        
        // Add to buffer (additive mixing)
        channelData[sampleIdx] += sample;
      }
      
      if (onProgress && i % 10 === 0) {
        onProgress((i / beats.length) * 100);
      }
    }
    
    // Normalize to prevent clipping
    this.normalizeBuffer(channelData);
    
    return buffer;
  }

  /**
   * Generate bass with frequency following (varying frequency based on beat position)
   * Optimized for speed with batched processing
   */
  async generateWithVariation(
    beats: Beat[],
    duration: number,
    sampleRate: number,
    bpm: number,
    onProgress?: (progress: number) => void
  ): Promise<AudioBuffer> {
    const numSamples = Math.ceil(duration * sampleRate);
    const buffer = new AudioBuffer({
      numberOfChannels: 1,
      length: numSamples,
      sampleRate,
    });
    const channelData = buffer.getChannelData(0);
    
    const { attackTime, decayTime, intensity, frequencyMin, frequencyMax } = this.options;
    const beatInterval = 60 / bpm; // seconds per beat
    
    // Pre-calculate pulse parameters
    const pulseDuration = attackTime + decayTime;
    const pulseSamples = Math.ceil(pulseDuration * sampleRate);
    const attackSamples = Math.ceil(attackTime * sampleRate);
    
    // Pre-calculate envelope
    const envelope = new Float32Array(pulseSamples);
    for (let s = 0; s < pulseSamples; s++) {
      if (s < attackSamples) {
        envelope[s] = s / attackSamples;
      } else {
        const decaySample = s - attackSamples;
        const decaySamples = pulseSamples - attackSamples;
        envelope[s] = Math.exp(-3 * decaySample / decaySamples);
      }
    }
    
    // Process beats in batches for UI responsiveness
    const batchSize = 50;
    
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const beatStartSample = Math.floor(beat.time * sampleRate);
      
      // Determine beat position in bar (assuming 4/4)
      const beatInBar = Math.floor(beat.time / beatInterval) % 4;
      
      // Vary frequency based on beat position
      let freq: number;
      switch (beatInBar) {
        case 0: // Downbeat
          freq = frequencyMin + (frequencyMax - frequencyMin) * 0.2;
          break;
        case 2: // Backbeat
          freq = frequencyMin + (frequencyMax - frequencyMin) * 0.4;
          break;
        default: // Offbeats
          freq = frequencyMin + (frequencyMax - frequencyMin) * 0.6;
      }
      
      const freqFactor = 2 * Math.PI * freq / sampleRate;
      const ampFactor = intensity * beat.strength;
      
      // Generate pulse using pre-calculated envelope
      for (let s = 0; s < pulseSamples; s++) {
        const sampleIdx = beatStartSample + s;
        if (sampleIdx >= numSamples) break;
        channelData[sampleIdx] += Math.sin(s * freqFactor) * envelope[s] * ampFactor;
      }
      
      // Yield to UI periodically
      if (i % batchSize === 0) {
        onProgress?.((i / beats.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    onProgress?.(100);
    this.normalizeBuffer(channelData);
    
    return buffer;
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
export function createBeatSyncedBass(options?: Partial<BeatSyncedBassOptions>): BeatSyncedBass {
  return new BeatSyncedBass(options);
}
