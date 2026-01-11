/**
 * BassExtractor - Isolates and analyzes existing bass frequencies
 * Uses low-pass filtering and energy analysis
 */

import type { BassProfile } from '../../types/bassGenerator';

export interface BassExtractorOptions {
  // Frame size for energy analysis
  frameSize: number;
  // Hop size between frames
  hopSize: number;
  // Low-pass cutoff for bass extraction (Hz)
  lowPassCutoff: number;
  // Sub-bass upper frequency (Hz)
  subBassCutoff: number;
}

const DEFAULT_OPTIONS: BassExtractorOptions = {
  frameSize: 2048,
  hopSize: 1024,
  lowPassCutoff: 80,
  subBassCutoff: 40,
};

export class BassExtractor {
  private options: BassExtractorOptions;
  private sampleRate: number = 44100;

  constructor(options: Partial<BassExtractorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyze audio and extract bass profile
   */
  async analyze(
    audioBuffer: AudioBuffer,
    onProgress?: (progress: number) => void
  ): Promise<{ bassProfile: BassProfile[]; averageBassEnergy: number; bassBuffer: AudioBuffer }> {
    this.sampleRate = audioBuffer.sampleRate;
    
    console.log('BassExtractor: Starting analysis...');
    
    // Extract bass frequencies using filtering
    const bassData = await this.extractBassFrequencies(audioBuffer);
    
    console.log('BassExtractor: Extracted bass frequencies');
    
    // Get mono audio data for profile analysis
    const audioData = this.getMonoData(audioBuffer);
    
    // Analyze energy profile
    const bassProfile = this.analyzeBassProfile(audioData, onProgress);
    
    console.log('BassExtractor: Created bass profile with', bassProfile.length, 'points');
    
    // Calculate average bass energy
    let totalEnergy = 0;
    for (const profile of bassProfile) {
      totalEnergy += profile.lowEnergy;
    }
    const averageBassEnergy = bassProfile.length > 0 ? totalEnergy / bassProfile.length : 0;
    
    return { bassProfile, averageBassEnergy, bassBuffer: bassData };
  }

  /**
   * Extract bass frequencies using offline audio context filtering
   */
  async extractBassFrequencies(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Create source
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    
    // Create low-pass filter for bass
    const lowPass = offlineCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = this.options.lowPassCutoff;
    lowPass.Q.value = 0.7;
    
    // Create high-pass filter to remove sub-20Hz rumble
    const highPass = offlineCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 20;
    highPass.Q.value = 0.7;
    
    // Connect: source -> highpass -> lowpass -> destination
    source.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(offlineCtx.destination);
    
    // Render
    source.start();
    return await offlineCtx.startRendering();
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
   * Analyze bass energy profile over time using simple energy calculation
   */
  private analyzeBassProfile(
    audioData: Float32Array,
    onProgress?: (progress: number) => void
  ): BassProfile[] {
    const { frameSize, hopSize } = this.options;
    const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
    const bassProfile: BassProfile[] = [];
    
    // Process every 4th frame for speed
    const frameStep = 4;
    
    for (let frame = 0; frame < numFrames; frame += frameStep) {
      const frameStart = frame * hopSize;
      
      // Calculate total energy for this frame
      let totalEnergy = 0;
      for (let i = 0; i < frameSize; i++) {
        const sample = audioData[frameStart + i] || 0;
        totalEnergy += sample * sample;
      }
      totalEnergy = Math.sqrt(totalEnergy / frameSize);
      
      // For simplicity, use the same energy for all bass bands
      // In a real implementation, we'd do frequency-band analysis
      bassProfile.push({
        time: frameStart / this.sampleRate,
        subBassEnergy: totalEnergy * 0.3,
        bassEnergy: totalEnergy * 0.7,
        lowEnergy: totalEnergy,
      });
      
      if (onProgress && frame % 50 === 0) {
        onProgress((frame / numFrames) * 100);
      }
    }
    
    return bassProfile;
  }
}

// Export factory function
export function createBassExtractor(options?: Partial<BassExtractorOptions>): BassExtractor {
  return new BassExtractor(options);
}
