/**
 * TypeScript interfaces for bass track generation
 */

// Bass generation mode options
export type BassMode = 'beat-synced' | 'harmonic' | 'enhanced';

// Configuration for bass generation
export interface BassGeneratorConfig {
  // Frequency range (20-80 Hz for vibe tables)
  frequencyMin: number;
  frequencyMax: number;
  
  // Base frequency for beat-synced mode
  baseFrequency: number;
  
  // Intensity/amplitude (0-1)
  intensity: number;
  
  // Algorithm blend weights (0-1 each)
  beatSyncedWeight: number;
  harmonicWeight: number;
  enhancedWeight: number;
  
  // Mix with original audio (0 = bass only, 1 = original only)
  dryWetMix: number;
  
  // Envelope settings for beat-synced pulses
  attackTime: number;  // seconds
  decayTime: number;   // seconds
  
  // Harmonic settings
  octaveShift: -1 | -2;  // How many octaves below to generate
  
  // Enhancement settings
  enhancementGain: number;  // Amplification factor for existing bass
}

// Default configuration
export const DEFAULT_BASS_CONFIG: BassGeneratorConfig = {
  frequencyMin: 20,
  frequencyMax: 80,
  baseFrequency: 40,
  intensity: 0.7,
  beatSyncedWeight: 0.5,
  harmonicWeight: 0.3,
  enhancedWeight: 0.2,
  dryWetMix: 0.5,
  attackTime: 0.01,
  decayTime: 0.15,
  octaveShift: -1,
  enhancementGain: 2.0,
};

// Beat information from analysis
export interface Beat {
  time: number;      // Time in seconds
  strength: number;  // Beat strength/confidence (0-1)
}

// Pitch information from analysis
export interface PitchData {
  time: number;       // Time in seconds
  frequency: number;  // Detected frequency in Hz
  confidence: number; // Detection confidence (0-1)
  note?: string;      // Optional note name (e.g., "A4")
}

// Bass frequency profile from analysis
export interface BassProfile {
  time: number;       // Time in seconds
  lowEnergy: number;  // Energy in low frequencies (20-80 Hz)
  subBassEnergy: number;  // Energy in sub-bass (20-40 Hz)
  bassEnergy: number;     // Energy in bass (40-80 Hz)
}

// Complete analysis result
export interface AnalysisResult {
  // Basic info
  duration: number;    // Audio duration in seconds
  sampleRate: number;  // Sample rate of the audio
  
  // Beat detection results
  bpm: number;
  beats: Beat[];
  
  // Pitch tracking results
  pitchData: PitchData[];
  detectedKey?: string;  // Detected musical key
  
  // Bass profile
  bassProfile: BassProfile[];
  averageBassEnergy: number;
}

// Generated bass track
export interface BassTrack {
  // Audio data
  buffer: AudioBuffer;
  
  // Metadata
  mode: BassMode;
  config: BassGeneratorConfig;
  
  // Analysis used for generation
  analysisResult: AnalysisResult;
}

// Upload state
export type UploadState = 'idle' | 'loading' | 'decoding' | 'ready' | 'error';

// Analysis state
export type AnalysisState = 'idle' | 'analyzing' | 'complete' | 'error';

// Generation state
export type GenerationState = 'idle' | 'generating' | 'complete' | 'error';

// Preview mode
export type PreviewMode = 'original' | 'bass' | 'mixed';

// Progress information
export interface BassProgress {
  stage: 'upload' | 'decode' | 'analyze-beats' | 'analyze-pitch' | 'analyze-bass' | 'generate' | 'mix';
  progress: number;  // 0-100
  message: string;
}

// Export options for bass generator
export interface BassExportOptions {
  includeOriginal: boolean;  // Mix with original audio
  format: 'wav' | 'mp3';
  sampleRate: 44100 | 48000;
  normalize: boolean;
}

// Note frequency mapping for harmonic generation
export const NOTE_FREQUENCIES: Record<string, number> = {
  'C0': 16.35, 'C#0': 17.32, 'D0': 18.35, 'D#0': 19.45, 'E0': 20.60, 'F0': 21.83,
  'F#0': 23.12, 'G0': 24.50, 'G#0': 25.96, 'A0': 27.50, 'A#0': 29.14, 'B0': 30.87,
  'C1': 32.70, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.20, 'F1': 43.65,
  'F#1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'B1': 61.74,
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31,
  'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
};

// Frequency to note name conversion
export function frequencyToNote(frequency: number): string | undefined {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const a4 = 440;
  const semitones = Math.round(12 * Math.log2(frequency / a4));
  const noteIndex = ((semitones % 12) + 12) % 12;
  const octave = Math.floor((semitones + 9) / 12) + 4;
  
  if (octave < 0 || octave > 8) return undefined;
  return `${notes[noteIndex]}${octave}`;
}

// Clamp frequency to valid bass range
export function clampToRange(frequency: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, frequency));
}
