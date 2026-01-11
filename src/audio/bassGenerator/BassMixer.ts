/**
 * BassMixer - Combine multiple bass generation algorithms and mix with original
 * Provides blending controls and final output processing
 */

import type { 
  BassGeneratorConfig, 
  AnalysisResult,
  BassProgress,
  PitchData 
} from '../../types/bassGenerator';
import { DEFAULT_BASS_CONFIG } from '../../types/bassGenerator';
import { createBeatDetector } from '../analysis/BeatDetector';
import { createBassExtractor } from '../analysis/BassExtractor';
import { createBeatSyncedBass } from './BeatSyncedBass';
import { createHarmonicBass } from './HarmonicBass';
import { createEnhancedBass } from './EnhancedBass';

export class BassMixer {
  private config: BassGeneratorConfig;
  private analysisResult: AnalysisResult | null = null;
  private originalBuffer: AudioBuffer | null = null;
  private bassBuffers: {
    beatSynced: AudioBuffer | null;
    harmonic: AudioBuffer | null;
    enhanced: AudioBuffer | null;
  } = {
    beatSynced: null,
    harmonic: null,
    enhanced: null,
  };

  constructor(config: Partial<BassGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_BASS_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<BassGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): BassGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Analyze audio and generate all bass tracks
   */
  async processAudio(
    audioBuffer: AudioBuffer,
    onProgress?: (progress: BassProgress) => void
  ): Promise<AnalysisResult> {
    console.log('BassMixer.processAudio: Starting...');
    console.log('Audio buffer:', audioBuffer.duration, 'seconds,', audioBuffer.sampleRate, 'Hz');
    
    this.originalBuffer = audioBuffer;
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Stage 1: Beat Detection
    console.log('BassMixer: Starting beat detection...');
    onProgress?.({
      stage: 'analyze-beats',
      progress: 0,
      message: 'Detecting beats and tempo...',
    });

    const beatDetector = createBeatDetector();
    const { beats, bpm } = await beatDetector.analyze(audioBuffer, (p) => {
      onProgress?.({
        stage: 'analyze-beats',
        progress: p,
        message: `Detecting beats... ${Math.round(p)}%`,
      });
    });

    console.log('BassMixer: Beat detection complete. BPM:', bpm, 'Beats:', beats.length);

    // Stage 2: Pitch Tracking
    // Skip pitch tracking for speed - use simplified harmonic generation instead
    console.log('BassMixer: Skipping detailed pitch tracking for speed');
    const pitchData: PitchData[] = [];
    const detectedKey: string | undefined = undefined;
    
    onProgress?.({
      stage: 'analyze-pitch',
      progress: 100,
      message: 'Pitch analysis skipped (using beat-based generation)',
    });
    
    // Small delay to allow UI update
    await new Promise(resolve => setTimeout(resolve, 10));

    // Stage 3: Bass Extraction (simplified for speed)
    console.log('BassMixer: Starting bass extraction...');
    onProgress?.({
      stage: 'analyze-bass',
      progress: 0,
      message: 'Extracting bass frequencies...',
    });

    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 10));

    const bassExtractor = createBassExtractor();
    const { bassProfile, averageBassEnergy, bassBuffer } = await bassExtractor.analyze(
      audioBuffer,
      (p) => {
        onProgress?.({
          stage: 'analyze-bass',
          progress: p,
          message: `Extracting bass... ${Math.round(p)}%`,
        });
      }
    );
    
    console.log('BassMixer: Bass extraction complete');

    // Store analysis result
    this.analysisResult = {
      duration,
      sampleRate,
      bpm,
      beats,
      pitchData,
      detectedKey,
      bassProfile,
      averageBassEnergy,
    };

    // Stage 4: Generate Bass Tracks
    console.log('BassMixer: Starting bass generation...');
    onProgress?.({
      stage: 'generate',
      progress: 0,
      message: 'Generating bass tracks...',
    });
    
    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 10));

    // Generate beat-synced bass (primary method - fast)
    console.log('BassMixer: Generating beat-synced bass...');
    const beatSyncedBass = createBeatSyncedBass();
    beatSyncedBass.updateFromConfig(this.config);
    this.bassBuffers.beatSynced = await beatSyncedBass.generateWithVariation(
      beats,
      duration,
      sampleRate,
      bpm,
      (p) => {
        onProgress?.({
          stage: 'generate',
          progress: p * 0.5,
          message: `Generating beat-synced bass... ${Math.round(p)}%`,
        });
      }
    );
    
    console.log('BassMixer: Beat-synced bass complete');
    await new Promise(resolve => setTimeout(resolve, 10));

    // Skip harmonic bass if no pitch data (we skipped pitch tracking)
    if (pitchData.length > 0 && this.config.harmonicWeight > 0) {
      const harmonicBass = createHarmonicBass();
      harmonicBass.updateFromConfig(this.config);
      this.bassBuffers.harmonic = await harmonicBass.generateWithRoots(
        pitchData,
        duration,
        sampleRate,
        (p) => {
          onProgress?.({
            stage: 'generate',
            progress: 50 + p * 0.25,
            message: `Generating harmonic bass... ${Math.round(p)}%`,
          });
        }
      );
    } else {
      // Use beat-synced as harmonic fallback
      this.bassBuffers.harmonic = this.bassBuffers.beatSynced;
    }

    // Generate enhanced bass (uses extracted bass - fast)
    console.log('BassMixer: Generating enhanced bass...');
    const enhancedBass = createEnhancedBass();
    enhancedBass.updateFromConfig(this.config);
    this.bassBuffers.enhanced = await enhancedBass.generateWithEnvelope(
      bassBuffer,
      bassProfile,
      (p) => {
        onProgress?.({
          stage: 'generate',
          progress: 75 + p * 0.25,
          message: `Generating enhanced bass... ${Math.round(p)}%`,
        });
      }
    );
    
    console.log('BassMixer: All bass tracks generated');

    onProgress?.({
      stage: 'generate',
      progress: 100,
      message: 'Bass generation complete!',
    });

    return this.analysisResult;
  }

  /**
   * Get mixed bass-only output
   */
  async getMixedBass(onProgress?: (progress: BassProgress) => void): Promise<AudioBuffer | null> {
    if (!this.analysisResult || !this.originalBuffer) {
      return null;
    }

    const { sampleRate, duration } = this.analysisResult;
    const numSamples = Math.ceil(duration * sampleRate);

    onProgress?.({
      stage: 'mix',
      progress: 0,
      message: 'Mixing bass tracks...',
    });

    // Create output buffer
    const outputBuffer = new AudioBuffer({
      numberOfChannels: 1,
      length: numSamples,
      sampleRate,
    });
    const outputData = outputBuffer.getChannelData(0);

    // Mix bass tracks with weights
    const { beatSyncedWeight, harmonicWeight, enhancedWeight } = this.config;
    const totalWeight = beatSyncedWeight + harmonicWeight + enhancedWeight;

    if (totalWeight === 0) {
      return outputBuffer;
    }

    // Normalize weights
    const weights = {
      beatSynced: beatSyncedWeight / totalWeight,
      harmonic: harmonicWeight / totalWeight,
      enhanced: enhancedWeight / totalWeight,
    };

    for (let i = 0; i < numSamples; i++) {
      let sample = 0;

      if (this.bassBuffers.beatSynced && weights.beatSynced > 0) {
        sample += this.bassBuffers.beatSynced.getChannelData(0)[i] * weights.beatSynced;
      }

      if (this.bassBuffers.harmonic && weights.harmonic > 0) {
        sample += this.bassBuffers.harmonic.getChannelData(0)[i] * weights.harmonic;
      }

      if (this.bassBuffers.enhanced && weights.enhanced > 0) {
        sample += this.bassBuffers.enhanced.getChannelData(0)[i] * weights.enhanced;
      }

      outputData[i] = sample;

      if (onProgress && i % 10000 === 0) {
        onProgress({
          stage: 'mix',
          progress: (i / numSamples) * 100,
          message: `Mixing bass... ${Math.round((i / numSamples) * 100)}%`,
        });
      }
    }

    // Normalize output
    this.normalizeBuffer(outputData);

    onProgress?.({
      stage: 'mix',
      progress: 100,
      message: 'Mix complete!',
    });

    return outputBuffer;
  }

  /**
   * Get final mix with original audio
   */
  async getFinalMix(onProgress?: (progress: BassProgress) => void): Promise<AudioBuffer | null> {
    if (!this.originalBuffer || !this.analysisResult) {
      return null;
    }

    const bassBuffer = await this.getMixedBass(onProgress);
    if (!bassBuffer) {
      return this.originalBuffer;
    }

    const { sampleRate, duration } = this.analysisResult;
    const numSamples = Math.ceil(duration * sampleRate);
    const numChannels = this.originalBuffer.numberOfChannels;

    // Create stereo output
    const outputBuffer = new AudioBuffer({
      numberOfChannels: numChannels,
      length: numSamples,
      sampleRate,
    });

    const { dryWetMix, intensity } = this.config;
    const bassData = bassBuffer.getChannelData(0);

    // Mix original and bass for each channel
    for (let ch = 0; ch < numChannels; ch++) {
      const originalData = this.originalBuffer.getChannelData(ch);
      const outputData = outputBuffer.getChannelData(ch);

      for (let i = 0; i < numSamples; i++) {
        const original = originalData[i] || 0;
        const bass = bassData[i] || 0;

        // Dry/wet mix: dryWetMix = 0 means bass only, 1 means original only
        outputData[i] = original * dryWetMix + bass * (1 - dryWetMix) * intensity;
      }

      // Soft clip to prevent distortion
      this.softClip(outputData);
    }

    return outputBuffer;
  }

  /**
   * Get individual bass track
   */
  getBassTrack(type: 'beatSynced' | 'harmonic' | 'enhanced'): AudioBuffer | null {
    return this.bassBuffers[type];
  }

  /**
   * Get analysis result
   */
  getAnalysisResult(): AnalysisResult | null {
    return this.analysisResult;
  }

  /**
   * Get original audio buffer
   */
  getOriginalBuffer(): AudioBuffer | null {
    return this.originalBuffer;
  }

  /**
   * Clear all buffers and analysis
   */
  clear(): void {
    this.originalBuffer = null;
    this.analysisResult = null;
    this.bassBuffers = {
      beatSynced: null,
      harmonic: null,
      enhanced: null,
    };
  }

  /**
   * Normalize buffer
   */
  private normalizeBuffer(data: Float32Array, targetPeak: number = 0.9): void {
    let maxAbs = 0;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxAbs) maxAbs = abs;
    }

    if (maxAbs > 0 && maxAbs > targetPeak) {
      const scale = targetPeak / maxAbs;
      for (let i = 0; i < data.length; i++) {
        data[i] *= scale;
      }
    }
  }

  /**
   * Apply soft clipping to prevent harsh distortion
   */
  private softClip(data: Float32Array, threshold: number = 0.9): void {
    for (let i = 0; i < data.length; i++) {
      const x = data[i];
      if (Math.abs(x) > threshold) {
        // Soft clip using tanh-like curve
        const sign = x > 0 ? 1 : -1;
        const excess = Math.abs(x) - threshold;
        data[i] = sign * (threshold + (1 - threshold) * Math.tanh(excess * 3));
      }
    }
  }
}

// Export factory function
export function createBassMixer(config?: Partial<BassGeneratorConfig>): BassMixer {
  return new BassMixer(config);
}

// Export singleton for convenience
let mixerInstance: BassMixer | null = null;

export function getBassMixer(): BassMixer {
  if (!mixerInstance) {
    mixerInstance = new BassMixer();
  }
  return mixerInstance;
}
