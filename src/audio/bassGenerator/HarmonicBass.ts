/**
 * HarmonicBass - Generate sub-harmonic bass following detected pitches
 * Creates bass notes 1-2 octaves below the detected melody
 */

import type { PitchData, BassGeneratorConfig } from '../../types/bassGenerator';
import { clampToRange } from '../../types/bassGenerator';

export interface HarmonicBassOptions {
  // How many octaves below to generate (-1 or -2)
  octaveShift: -1 | -2;
  // Intensity (0-1)
  intensity: number;
  // Frequency range
  frequencyMin: number;
  frequencyMax: number;
  // Smoothing time for pitch transitions (seconds)
  glideTime: number;
  // Minimum confidence to use pitch
  minConfidence: number;
}

const DEFAULT_OPTIONS: HarmonicBassOptions = {
  octaveShift: -1,
  intensity: 0.6,
  frequencyMin: 20,
  frequencyMax: 80,
  glideTime: 0.05,
  minConfidence: 0.5,
};

export class HarmonicBass {
  private options: HarmonicBassOptions;

  constructor(options: Partial<HarmonicBassOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Update options from bass generator config
   */
  updateFromConfig(config: BassGeneratorConfig): void {
    this.options.octaveShift = config.octaveShift;
    this.options.intensity = config.intensity;
    this.options.frequencyMin = config.frequencyMin;
    this.options.frequencyMax = config.frequencyMax;
  }

  /**
   * Generate harmonic bass track from pitch data
   */
  async generate(
    pitchData: PitchData[],
    duration: number,
    sampleRate: number,
    onProgress?: (progress: number) => void
  ): Promise<AudioBuffer> {
    const numSamples = Math.ceil(duration * sampleRate);
    const buffer = new AudioBuffer({
      numberOfChannels: 1,
      length: numSamples,
      sampleRate,
    });
    const channelData = buffer.getChannelData(0);
    
    if (pitchData.length === 0) {
      return buffer;
    }
    
    const { octaveShift, intensity, frequencyMin, frequencyMax, glideTime, minConfidence } = this.options;
    const octaveMultiplier = Math.pow(2, octaveShift); // 0.5 for -1, 0.25 for -2
    
    // Filter pitch data by confidence
    const validPitches = pitchData.filter(p => p.confidence >= minConfidence);
    
    if (validPitches.length === 0) {
      return buffer;
    }
    
    // Sort by time
    validPitches.sort((a, b) => a.time - b.time);
    
    // Generate bass by interpolating between pitch points
    let pitchIndex = 0;
    let currentFreq = this.getBassFrequency(validPitches[0].frequency, octaveMultiplier, frequencyMin, frequencyMax);
    let phase = 0;
    
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      
      // Find current and next pitch points
      while (pitchIndex < validPitches.length - 1 && validPitches[pitchIndex + 1].time <= time) {
        pitchIndex++;
      }
      
      // Calculate target frequency
      let targetFreq: number;
      if (pitchIndex < validPitches.length) {
        targetFreq = this.getBassFrequency(
          validPitches[pitchIndex].frequency,
          octaveMultiplier,
          frequencyMin,
          frequencyMax
        );
      } else {
        targetFreq = currentFreq;
      }
      
      // Smooth frequency transitions (portamento/glide)
      const glideRate = 1 / (glideTime * sampleRate);
      currentFreq += (targetFreq - currentFreq) * Math.min(1, glideRate);
      
      // Calculate amplitude based on pitch confidence
      let amplitude = intensity;
      if (pitchIndex < validPitches.length) {
        amplitude *= validPitches[pitchIndex].confidence;
      }
      
      // Generate sine wave with continuous phase
      const sample = Math.sin(phase) * amplitude;
      channelData[i] = sample;
      
      // Update phase (prevents discontinuities)
      phase += (2 * Math.PI * currentFreq) / sampleRate;
      if (phase > 2 * Math.PI) {
        phase -= 2 * Math.PI;
      }
      
      if (onProgress && i % 10000 === 0) {
        onProgress((i / numSamples) * 100);
      }
    }
    
    // Apply smoothing envelope at start and end
    this.applyFadeEnvelope(channelData, sampleRate);
    
    return buffer;
  }

  /**
   * Generate harmonic bass with chord root following
   */
  async generateWithRoots(
    pitchData: PitchData[],
    duration: number,
    sampleRate: number,
    onProgress?: (progress: number) => void
  ): Promise<AudioBuffer> {
    const numSamples = Math.ceil(duration * sampleRate);
    const buffer = new AudioBuffer({
      numberOfChannels: 1,
      length: numSamples,
      sampleRate,
    });
    const channelData = buffer.getChannelData(0);
    
    if (pitchData.length === 0) {
      return buffer;
    }
    
    const { octaveShift, intensity, frequencyMin, frequencyMax } = this.options;
    const octaveMultiplier = Math.pow(2, octaveShift);
    
    // Group pitches into segments and find root notes
    const segmentDuration = 0.5; // 500ms segments
    const segments = this.groupPitchesIntoSegments(pitchData, duration, segmentDuration);
    
    let phase = 0;
    
    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      const segmentIndex = Math.min(
        Math.floor(time / segmentDuration),
        segments.length - 1
      );
      
      const segment = segments[segmentIndex];
      if (!segment || segment.rootFrequency === 0) {
        continue;
      }
      
      // Get bass frequency from segment root
      const bassFreq = this.getBassFrequency(
        segment.rootFrequency,
        octaveMultiplier,
        frequencyMin,
        frequencyMax
      );
      
      // Amplitude from average confidence
      const amplitude = intensity * segment.avgConfidence;
      
      // Generate sine wave
      channelData[i] = Math.sin(phase) * amplitude;
      
      phase += (2 * Math.PI * bassFreq) / sampleRate;
      if (phase > 2 * Math.PI) {
        phase -= 2 * Math.PI;
      }
      
      if (onProgress && i % 10000 === 0) {
        onProgress((i / numSamples) * 100);
      }
    }
    
    this.applyFadeEnvelope(channelData, sampleRate);
    
    return buffer;
  }

  /**
   * Convert detected frequency to bass range
   */
  private getBassFrequency(
    sourceFreq: number,
    octaveMultiplier: number,
    minFreq: number,
    maxFreq: number
  ): number {
    // Shift down by octaves
    let bassFreq = sourceFreq * octaveMultiplier;
    
    // If still above max, shift down more octaves
    while (bassFreq > maxFreq) {
      bassFreq /= 2;
    }
    
    // If below min, shift up
    while (bassFreq < minFreq && bassFreq * 2 <= maxFreq) {
      bassFreq *= 2;
    }
    
    return clampToRange(bassFreq, minFreq, maxFreq);
  }

  /**
   * Group pitches into time segments and find root note
   */
  private groupPitchesIntoSegments(
    pitchData: PitchData[],
    duration: number,
    segmentDuration: number
  ): Array<{ rootFrequency: number; avgConfidence: number }> {
    const numSegments = Math.ceil(duration / segmentDuration);
    const segments: Array<{ rootFrequency: number; avgConfidence: number }> = [];
    
    for (let seg = 0; seg < numSegments; seg++) {
      const segStart = seg * segmentDuration;
      const segEnd = segStart + segmentDuration;
      
      // Get pitches in this segment
      const segmentPitches = pitchData.filter(
        p => p.time >= segStart && p.time < segEnd && p.confidence >= this.options.minConfidence
      );
      
      if (segmentPitches.length === 0) {
        segments.push({ rootFrequency: 0, avgConfidence: 0 });
        continue;
      }
      
      // Find most common pitch class (root note detection)
      const pitchClassCounts = new Map<number, { count: number; totalFreq: number; totalConf: number }>();
      
      for (const pitch of segmentPitches) {
        // Get pitch class (0-11)
        const pitchClass = Math.round(12 * Math.log2(pitch.frequency / 440)) % 12;
        const normalizedClass = ((pitchClass % 12) + 12) % 12;
        
        const existing = pitchClassCounts.get(normalizedClass) || { count: 0, totalFreq: 0, totalConf: 0 };
        existing.count++;
        existing.totalFreq += pitch.frequency;
        existing.totalConf += pitch.confidence;
        pitchClassCounts.set(normalizedClass, existing);
      }
      
      // Find most common pitch class
      let maxCount = 0;
      let rootData = { count: 0, totalFreq: 0, totalConf: 0 };
      
      for (const [, data] of pitchClassCounts) {
        if (data.count > maxCount) {
          maxCount = data.count;
          rootData = data;
        }
      }
      
      const avgFreq = rootData.totalFreq / rootData.count;
      const avgConf = rootData.totalConf / rootData.count;
      
      segments.push({ rootFrequency: avgFreq, avgConfidence: avgConf });
    }
    
    return segments;
  }

  /**
   * Apply fade in/out envelope
   */
  private applyFadeEnvelope(data: Float32Array, sampleRate: number, fadeTime: number = 0.01): void {
    const fadeSamples = Math.floor(fadeTime * sampleRate);
    
    // Fade in
    for (let i = 0; i < fadeSamples && i < data.length; i++) {
      data[i] *= i / fadeSamples;
    }
    
    // Fade out
    for (let i = 0; i < fadeSamples && i < data.length; i++) {
      const idx = data.length - 1 - i;
      data[idx] *= i / fadeSamples;
    }
  }
}

// Export factory function
export function createHarmonicBass(options?: Partial<HarmonicBassOptions>): HarmonicBass {
  return new HarmonicBass(options);
}
