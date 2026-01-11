/**
 * BeatDetector - Energy-based onset detection for beat/tempo analysis
 * Uses simple energy envelope analysis for fast processing
 */

import type { Beat } from '../../types/bassGenerator';

export interface BeatDetectorOptions {
  // Window size for energy calculation
  windowSize: number;
  // Hop size between analysis frames
  hopSize: number;
  // Threshold multiplier for peak detection
  thresholdMultiplier: number;
  // Minimum time between beats (seconds)
  minBeatInterval: number;
}

const DEFAULT_OPTIONS: BeatDetectorOptions = {
  windowSize: 1024,
  hopSize: 512,
  thresholdMultiplier: 1.4,
  minBeatInterval: 0.2,
};

export class BeatDetector {
  private options: BeatDetectorOptions;
  private sampleRate: number = 44100;

  constructor(options: Partial<BeatDetectorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyze audio buffer and detect beats using energy envelope
   */
  async analyze(
    audioBuffer: AudioBuffer,
    onProgress?: (progress: number) => void
  ): Promise<{ beats: Beat[]; bpm: number }> {
    this.sampleRate = audioBuffer.sampleRate;
    
    console.log('BeatDetector: Starting analysis...');
    
    // Get mono audio data
    const audioData = this.getMonoData(audioBuffer);
    
    console.log('BeatDetector: Got mono data, length:', audioData.length);
    
    // Calculate energy envelope
    const energy = this.calculateEnergyEnvelope(audioData, onProgress);
    
    console.log('BeatDetector: Calculated energy envelope');
    
    // Detect peaks (onsets/beats)
    const beats = this.detectPeaks(energy);
    
    console.log('BeatDetector: Detected', beats.length, 'beats');
    
    // Estimate BPM from beat intervals
    const bpm = this.estimateBPM(beats);
    
    console.log('BeatDetector: Estimated BPM:', bpm);
    
    return { beats, bpm };
  }

  /**
   * Convert stereo to mono by averaging channels
   */
  private getMonoData(audioBuffer: AudioBuffer): Float32Array {
    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    const numChannels = audioBuffer.numberOfChannels;
    
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numChannels;
      }
    }
    
    return mono;
  }

  /**
   * Calculate energy envelope using RMS in windows
   */
  private calculateEnergyEnvelope(
    audioData: Float32Array,
    onProgress?: (progress: number) => void
  ): Float32Array {
    const { windowSize, hopSize } = this.options;
    const numFrames = Math.floor((audioData.length - windowSize) / hopSize) + 1;
    const energy = new Float32Array(numFrames);
    
    for (let frame = 0; frame < numFrames; frame++) {
      const frameStart = frame * hopSize;
      
      // Calculate RMS energy for this window
      let sum = 0;
      for (let i = 0; i < windowSize; i++) {
        const sample = audioData[frameStart + i] || 0;
        sum += sample * sample;
      }
      
      energy[frame] = Math.sqrt(sum / windowSize);
      
      // Report progress every 100 frames
      if (onProgress && frame % 100 === 0) {
        onProgress((frame / numFrames) * 100);
      }
    }
    
    // Apply simple differentiation to detect onsets (changes in energy)
    const diff = new Float32Array(numFrames);
    for (let i = 1; i < numFrames; i++) {
      const d = energy[i] - energy[i - 1];
      diff[i] = d > 0 ? d : 0; // Only positive changes (onsets)
    }
    
    return diff;
  }

  /**
   * Detect peaks in energy envelope to find beats
   */
  private detectPeaks(energy: Float32Array): Beat[] {
    const { hopSize, thresholdMultiplier, minBeatInterval } = this.options;
    const beats: Beat[] = [];
    
    // Calculate adaptive threshold using moving average
    const windowSize = Math.floor(this.sampleRate / hopSize / 2); // ~500ms window
    const threshold = this.calculateAdaptiveThreshold(energy, windowSize, thresholdMultiplier);
    
    // Find peaks above threshold
    const minSamples = Math.floor((minBeatInterval * this.sampleRate) / hopSize);
    let lastBeatFrame = -minSamples;
    
    // Find the maximum energy for normalization
    let maxEnergy = 0;
    for (let i = 0; i < energy.length; i++) {
      if (energy[i] > maxEnergy) maxEnergy = energy[i];
    }
    
    if (maxEnergy === 0) return beats;
    
    for (let i = 1; i < energy.length - 1; i++) {
      // Check if this is a local maximum above threshold
      if (
        energy[i] > energy[i - 1] &&
        energy[i] >= energy[i + 1] &&
        energy[i] > threshold[i] &&
        i - lastBeatFrame >= minSamples
      ) {
        const time = (i * hopSize) / this.sampleRate;
        const strength = Math.min(1, energy[i] / maxEnergy);
        
        beats.push({ time, strength });
        lastBeatFrame = i;
      }
    }
    
    return beats;
  }

  /**
   * Calculate adaptive threshold using moving average
   */
  private calculateAdaptiveThreshold(
    energy: Float32Array,
    windowSize: number,
    multiplier: number
  ): Float32Array {
    const threshold = new Float32Array(energy.length);
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < energy.length; i++) {
      let sum = 0;
      let count = 0;
      
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(energy.length, i + halfWindow);
      
      for (let j = start; j < end; j++) {
        sum += energy[j];
        count++;
      }
      
      threshold[i] = (sum / count) * multiplier;
    }
    
    return threshold;
  }

  /**
   * Estimate BPM from beat intervals
   */
  private estimateBPM(beats: Beat[]): number {
    if (beats.length < 2) return 120; // Default BPM
    
    // Calculate intervals between consecutive beats
    const intervals: number[] = [];
    for (let i = 1; i < beats.length; i++) {
      const interval = beats[i].time - beats[i - 1].time;
      if (interval > 0.2 && interval < 2) { // Reasonable beat interval range
        intervals.push(interval);
      }
    }
    
    if (intervals.length === 0) return 120;
    
    // Use histogram to find most common interval
    const bpmCounts = new Map<number, number>();
    
    for (const interval of intervals) {
      // Convert to BPM and round to nearest 5
      const bpm = Math.round((60 / interval) / 5) * 5;
      
      // Only consider reasonable BPM range (60-180)
      if (bpm >= 60 && bpm <= 180) {
        bpmCounts.set(bpm, (bpmCounts.get(bpm) || 0) + 1);
      }
    }
    
    // Find BPM with highest count
    let maxCount = 0;
    let estimatedBPM = 120;
    
    for (const [bpm, count] of bpmCounts) {
      if (count > maxCount) {
        maxCount = count;
        estimatedBPM = bpm;
      }
    }
    
    return estimatedBPM;
  }
}

// Export singleton factory
export function createBeatDetector(options?: Partial<BeatDetectorOptions>): BeatDetector {
  return new BeatDetector(options);
}
