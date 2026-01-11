/**
 * PitchTracker - Simple pitch detection for harmonic bass generation
 * Uses zero-crossing rate and autocorrelation for fast processing
 */

import type { PitchData } from '../../types/bassGenerator';
import { frequencyToNote } from '../../types/bassGenerator';

export interface PitchTrackerOptions {
  // Analysis frame size
  frameSize: number;
  // Hop size between frames
  hopSize: number;
  // Minimum detectable frequency (Hz)
  minFrequency: number;
  // Maximum detectable frequency (Hz)
  maxFrequency: number;
  // Minimum confidence threshold for valid pitch
  confidenceThreshold: number;
}

const DEFAULT_OPTIONS: PitchTrackerOptions = {
  frameSize: 2048,
  hopSize: 1024,
  minFrequency: 80,
  maxFrequency: 1000,
  confidenceThreshold: 0.3,
};

export class PitchTracker {
  private options: PitchTrackerOptions;
  private sampleRate: number = 44100;

  constructor(options: Partial<PitchTrackerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyze audio buffer and track pitch over time
   */
  async analyze(
    audioBuffer: AudioBuffer,
    onProgress?: (progress: number) => void
  ): Promise<{ pitchData: PitchData[]; detectedKey: string | undefined }> {
    this.sampleRate = audioBuffer.sampleRate;
    
    console.log('PitchTracker: Starting analysis...');
    
    // Get mono audio data
    const audioData = this.getMonoData(audioBuffer);
    
    // Track pitch for each frame
    const pitchData = this.trackPitch(audioData, onProgress);
    
    console.log('PitchTracker: Detected', pitchData.length, 'pitch points');
    
    // Detect musical key from pitch data
    const detectedKey = this.detectKey(pitchData);
    
    console.log('PitchTracker: Detected key:', detectedKey);
    
    return { pitchData, detectedKey };
  }

  /**
   * Convert stereo to mono
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
   * Track pitch over time using simple autocorrelation
   */
  private trackPitch(
    audioData: Float32Array,
    onProgress?: (progress: number) => void
  ): PitchData[] {
    const { frameSize, hopSize, minFrequency, maxFrequency, confidenceThreshold } = this.options;
    const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
    const pitchData: PitchData[] = [];
    
    // Lag range based on frequency range
    const minLag = Math.floor(this.sampleRate / maxFrequency);
    const maxLag = Math.ceil(this.sampleRate / minFrequency);
    
    // Process every 4th frame for speed
    const frameStep = 4;
    
    for (let frame = 0; frame < numFrames; frame += frameStep) {
      const frameStart = frame * hopSize;
      
      // Check if frame has enough energy
      let energy = 0;
      for (let i = 0; i < frameSize; i++) {
        const sample = audioData[frameStart + i] || 0;
        energy += sample * sample;
      }
      energy = Math.sqrt(energy / frameSize);
      
      if (energy < 0.01) {
        // Skip silent frames
        if (onProgress && frame % 20 === 0) {
          onProgress((frame / numFrames) * 100);
        }
        continue;
      }
      
      // Simple autocorrelation for pitch detection
      const { frequency, confidence } = this.detectPitchInFrame(
        audioData, frameStart, frameSize, minLag, maxLag
      );
      
      if (confidence >= confidenceThreshold && frequency > 0) {
        const time = frameStart / this.sampleRate;
        const note = frequencyToNote(frequency);
        
        pitchData.push({
          time,
          frequency,
          confidence,
          note,
        });
      }
      
      if (onProgress && frame % 20 === 0) {
        onProgress((frame / numFrames) * 100);
      }
    }
    
    return pitchData;
  }

  /**
   * Detect pitch in a single frame using autocorrelation
   */
  private detectPitchInFrame(
    data: Float32Array,
    start: number,
    size: number,
    minLag: number,
    maxLag: number
  ): { frequency: number; confidence: number } {
    // Calculate autocorrelation at lag 0
    let r0 = 0;
    for (let i = 0; i < size; i++) {
      const sample = data[start + i] || 0;
      r0 += sample * sample;
    }
    
    if (r0 === 0) return { frequency: 0, confidence: 0 };
    
    // Find the best lag (highest autocorrelation after initial drop)
    let bestLag = 0;
    let bestCorr = 0;
    let foundDip = false;
    let prevCorr = 1;
    
    for (let lag = minLag; lag <= Math.min(maxLag, size / 2); lag++) {
      let sum = 0;
      for (let i = 0; i < size - lag; i++) {
        sum += (data[start + i] || 0) * (data[start + i + lag] || 0);
      }
      const corr = sum / r0;
      
      // Look for dip then rise
      if (!foundDip && corr < prevCorr * 0.9) {
        foundDip = true;
      }
      
      if (foundDip && corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
      
      prevCorr = corr;
    }
    
    if (bestLag === 0) return { frequency: 0, confidence: 0 };
    
    const frequency = this.sampleRate / bestLag;
    const confidence = Math.max(0, Math.min(1, bestCorr));
    
    return { frequency, confidence };
  }

  /**
   * Detect musical key from pitch histogram
   */
  private detectKey(pitchData: PitchData[]): string | undefined {
    if (pitchData.length === 0) return undefined;
    
    // Count occurrences of each pitch class (0-11)
    const pitchClassCounts = new Array(12).fill(0);
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    for (const pitch of pitchData) {
      if (pitch.note) {
        const noteName = pitch.note.slice(0, -1); // Remove octave
        const noteIndex = noteNames.indexOf(noteName.replace('♯', '#').replace('♭', 'b'));
        if (noteIndex >= 0) {
          pitchClassCounts[noteIndex] += pitch.confidence;
        }
      }
    }
    
    // Find the most common pitch class
    let maxCount = 0;
    let keyIndex = 0;
    
    for (let i = 0; i < 12; i++) {
      if (pitchClassCounts[i] > maxCount) {
        maxCount = pitchClassCounts[i];
        keyIndex = i;
      }
    }
    
    // Determine major/minor by checking relative minor/major
    const majorThird = (keyIndex + 4) % 12;
    const minorThird = (keyIndex + 3) % 12;
    
    const isMajor = pitchClassCounts[majorThird] > pitchClassCounts[minorThird];
    
    return `${noteNames[keyIndex]} ${isMajor ? 'major' : 'minor'}`;
  }
}

// Export factory function
export function createPitchTracker(options?: Partial<PitchTrackerOptions>): PitchTracker {
  return new PitchTracker(options);
}
