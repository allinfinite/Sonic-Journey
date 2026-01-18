/**
 * MelodyProcessor - Processes uploaded melody files to fit journey parameters
 * Handles time-stretching, pitch-shifting, and adapting to journey phases
 */

import type { 
  MelodyGeneratorConfig, 
  MelodyNote 
} from '../../types/melodyGenerator';
import { DEFAULT_MELODY_CONFIG } from '../../types/melodyGenerator';

export interface ProcessingOptions {
  // Time stretching factor (0.5 = half speed, 2 = double speed)
  timeStretch?: number;
  // Pitch shift in semitones
  pitchShift?: number;
  // Loop the melody to fit duration
  loop?: boolean;
  // Fade in/out time (seconds)
  fadeTime?: number;
  // Volume adjustment (0-1)
  volume?: number;
}

export interface MelodyProcessorOptions {
  config?: Partial<MelodyGeneratorConfig>;
  sampleRate?: number;
}

export class MelodyProcessor {
  private config: MelodyGeneratorConfig;
  private sampleRate: number;
  private uploadedBuffer: AudioBuffer | null = null;
  private processedBuffer: AudioBuffer | null = null;

  constructor(options: MelodyProcessorOptions = {}) {
    this.config = { ...DEFAULT_MELODY_CONFIG, ...options.config };
    this.sampleRate = options.sampleRate ?? 48000;
  }

  /**
   * Load audio from a File or Blob
   */
  async loadFile(file: File | Blob): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: this.sampleRate });
    
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      this.uploadedBuffer = audioBuffer;
      return audioBuffer;
    } finally {
      audioContext.close();
    }
  }

  /**
   * Load audio from an existing AudioBuffer
   */
  loadBuffer(buffer: AudioBuffer): void {
    this.uploadedBuffer = buffer;
  }

  /**
   * Process the loaded melody to fit journey parameters
   */
  async process(
    targetDuration: number,
    options: ProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<{ buffer: AudioBuffer; notes: MelodyNote[] }> {
    if (!this.uploadedBuffer) {
      throw new Error('No melody loaded. Call loadFile() or loadBuffer() first.');
    }

    const {
      timeStretch = 1,
      pitchShift = 0,
      loop = true,
      fadeTime = 0.5,
      volume = this.config.intensity,
    } = options;

    const sourceDuration = this.uploadedBuffer.duration;
    const targetSamples = Math.ceil(targetDuration * this.sampleRate);

    // Create output buffer
    const outputBuffer = new AudioBuffer({
      numberOfChannels: this.uploadedBuffer.numberOfChannels,
      length: targetSamples,
      sampleRate: this.sampleRate,
    });

    const notes: MelodyNote[] = [];

    // Process each channel
    for (let ch = 0; ch < this.uploadedBuffer.numberOfChannels; ch++) {
      const sourceData = this.uploadedBuffer.getChannelData(ch);
      const outputData = outputBuffer.getChannelData(ch);

      // Apply time stretching and pitch shift using resampling
      const effectiveSampleRate = this.sampleRate * timeStretch * Math.pow(2, pitchShift / 12);
      const resampleRatio = effectiveSampleRate / this.uploadedBuffer.sampleRate;

      // Process samples
      for (let i = 0; i < targetSamples; i++) {
        // Calculate source position (with looping if enabled)
        let sourcePos = i * resampleRatio;
        
        if (loop) {
          sourcePos = sourcePos % sourceData.length;
        } else if (sourcePos >= sourceData.length) {
          outputData[i] = 0;
          continue;
        }

        // Linear interpolation for smoother resampling
        const pos0 = Math.floor(sourcePos);
        const pos1 = (pos0 + 1) % sourceData.length;
        const frac = sourcePos - pos0;

        let sample = sourceData[pos0] * (1 - frac) + sourceData[pos1] * frac;

        // Apply volume
        sample *= volume;

        // Apply fade in/out
        const time = i / this.sampleRate;
        if (time < fadeTime) {
          sample *= time / fadeTime;
        } else if (time > targetDuration - fadeTime) {
          sample *= (targetDuration - time) / fadeTime;
        }

        outputData[i] = sample;

        // Progress callback
        if (onProgress && i % 10000 === 0) {
          onProgress((i / targetSamples) * 100);
        }
      }
    }

    this.processedBuffer = outputBuffer;

    // Generate rough note events for visualization (based on amplitude envelope)
    this.detectNotes(outputBuffer, notes);

    onProgress?.(100);

    return { buffer: outputBuffer, notes };
  }

  /**
   * Simple note detection based on amplitude envelope
   */
  private detectNotes(buffer: AudioBuffer, notes: MelodyNote[]): void {
    const data = buffer.getChannelData(0);
    const hopSize = Math.floor(this.sampleRate * 0.05); // 50ms hops
    const threshold = 0.05;

    let inNote = false;
    let noteStart = 0;
    let peakAmplitude = 0;

    for (let i = 0; i < data.length; i += hopSize) {
      // Calculate RMS in this hop
      let sum = 0;
      const end = Math.min(i + hopSize, data.length);
      for (let j = i; j < end; j++) {
        sum += data[j] * data[j];
      }
      const rms = Math.sqrt(sum / (end - i));

      if (!inNote && rms > threshold) {
        // Note onset
        inNote = true;
        noteStart = i / this.sampleRate;
        peakAmplitude = rms;
      } else if (inNote && rms < threshold * 0.5) {
        // Note offset
        notes.push({
          time: noteStart,
          duration: (i / this.sampleRate) - noteStart,
          frequency: 440, // Unknown - could add pitch detection
          velocity: Math.min(1, peakAmplitude * 2),
          pan: 0,
        });
        inNote = false;
        peakAmplitude = 0;
      } else if (inNote) {
        peakAmplitude = Math.max(peakAmplitude, rms);
      }
    }

    // Close any open note
    if (inNote) {
      notes.push({
        time: noteStart,
        duration: buffer.duration - noteStart,
        frequency: 440,
        velocity: Math.min(1, peakAmplitude * 2),
        pan: 0,
      });
    }
  }

  /**
   * Adapt the melody to match journey frequency characteristics
   * Shifts pitch to be harmonically related to foundation frequency
   */
  async adaptToFoundation(
    foundationFreq: number,
    targetDuration: number,
    onProgress?: (progress: number) => void
  ): Promise<{ buffer: AudioBuffer; notes: MelodyNote[] }> {
    if (!this.uploadedBuffer) {
      throw new Error('No melody loaded.');
    }

    // Calculate pitch shift to align with foundation harmonics
    // Find the closest harmonic of the foundation
    const melodyCenter = 440; // Assume A4 as typical melody center
    let closestHarmonic = 2;
    let minDistance = Infinity;

    for (let h = 2; h <= 16; h++) {
      const harmonicFreq = foundationFreq * h;
      const distance = Math.abs(Math.log2(harmonicFreq / melodyCenter));
      if (distance < minDistance) {
        minDistance = distance;
        closestHarmonic = h;
      }
    }

    // Calculate required pitch shift in semitones
    const targetFreq = foundationFreq * closestHarmonic;
    const pitchShift = 12 * Math.log2(targetFreq / melodyCenter);

    return this.process(targetDuration, {
      pitchShift,
      loop: true,
    }, onProgress);
  }

  /**
   * Get the uploaded buffer
   */
  getUploadedBuffer(): AudioBuffer | null {
    return this.uploadedBuffer;
  }

  /**
   * Get the processed buffer
   */
  getProcessedBuffer(): AudioBuffer | null {
    return this.processedBuffer;
  }

  /**
   * Clear loaded and processed buffers
   */
  clear(): void {
    this.uploadedBuffer = null;
    this.processedBuffer = null;
  }

  /**
   * Check if a melody is loaded
   */
  hasLoadedMelody(): boolean {
    return this.uploadedBuffer !== null;
  }

  /**
   * Get duration of loaded melody
   */
  getLoadedDuration(): number {
    return this.uploadedBuffer?.duration ?? 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MelodyGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export factory function
export function createMelodyProcessor(options?: MelodyProcessorOptions): MelodyProcessor {
  return new MelodyProcessor(options);
}
