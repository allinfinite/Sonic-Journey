/**
 * TypeScript interfaces for vibroacoustic journey configuration
 */

// Entrainment/rhythm modes for therapeutic pulsing
// Based on neural entrainment research:
// - Delta (1-4 Hz): Deep sleep, relaxation, trance
// - Theta (4-7 Hz): Meditation, hypnagogic states, creativity
// - Alpha (8-12 Hz): Vivid visuals, calm alertness, flow states
// - Beta (13-30 Hz): Focus, alertness, mental energy
// - Gamma (30-50 Hz): Cognitive enhancement, memory (40 Hz research)
export type EntrainmentMode = 'none' | 'breathing' | 'heartbeat' | 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

// Rhythm mode (user-friendly alias for entrainment bands)
export type RhythmMode = 'still' | 'breathing' | 'heartbeat' | 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

// Frequency range type
export interface FrequencyRange {
  start: number;
  end: number;
}

// Amplitude range type
export interface AmplitudeRange {
  start: number;
  end: number;
}

// Phase configuration for a single journey stage
export interface PhaseConfig {
  name: string;
  duration: number; // in minutes
  frequency: FrequencyRange;
  amplitude: AmplitudeRange;
  breath_cycle_sec?: number;
  fm_depth?: number;
  fm_rate?: number;
  rhythm_mode?: RhythmMode;
  entrainment_mode?: EntrainmentMode;
  entrainment_rate?: number;
  support_frequency?: FrequencyRange;
  nova_enabled?: boolean; // Enable Nova flicker for this phase
  nova_frequency?: number; // Override Nova frequency (Hz), otherwise auto-mapped from frequency/rhythm
  binaural_enabled?: boolean; // Enable binaural beats for this phase
  binaural_beat_frequency?: number; // Binaural beat frequency (Hz) - e.g., 3, 6, 10, 15 for Delta/Theta/Alpha/Beta
  binaural_carrier_frequency?: number; // Carrier frequency (Hz) - default 200 Hz, range 100-400 Hz recommended
}

// Layer configuration
export interface LayerConfig {
  base_carrier: boolean;
  support_carrier: boolean;
  texture_layer: boolean;
}

// Complete journey configuration
export interface JourneyConfig {
  name: string;
  description?: string;
  duration_minutes: number;
  sample_rate: number;
  phases: PhaseConfig[];
  layers: LayerConfig;
  safety?: SafetyConfig;
  nova_enabled?: boolean; // Global Nova toggle for entire journey
}

// Safety processing configuration
export interface SafetyConfig {
  max_rms_db: number;
  peak_ceiling_db: number;
  lowpass_hz: number;
  highpass_hz: number;
}

// Default safety settings
export const DEFAULT_SAFETY: SafetyConfig = {
  max_rms_db: -12,
  peak_ceiling_db: -1,
  lowpass_hz: 120,
  highpass_hz: 20,
};

// Default layer configuration
export const DEFAULT_LAYERS: LayerConfig = {
  base_carrier: true,
  support_carrier: true,
  texture_layer: false,
};

// Audio parameters for real-time modulation
export interface AudioParams {
  foundationFreq: number;
  harmonyFreq: number;
  intensity: number;
  rhythmMode: RhythmMode;
  rhythmRate: number;
  flowDepth: number;
  layers: {
    foundation: boolean;
    harmony: boolean;
    atmosphere: boolean;
  };
}

// Entrainment presets with rate and depth
export interface EntrainmentPreset {
  rate: number;
  depth: number;
}

// Entrainment presets based on neuroscience research
// Rate = Hz for neural entrainment, depth = modulation intensity
export const ENTRAINMENT_PRESETS: Record<EntrainmentMode, EntrainmentPreset> = {
  none: { rate: 0, depth: 0 },
  breathing: { rate: 0.083, depth: 0.15 }, // ~12 sec cycle (0.083 Hz)
  heartbeat: { rate: 1.0, depth: 0.25 },   // ~60 BPM (1 Hz)
  delta: { rate: 3.0, depth: 0.2 },        // 3 Hz - deep sleep, trance, drowsy states
  theta: { rate: 6.0, depth: 0.25 },       // 6 Hz - meditation, hypnagogic, creative
  alpha: { rate: 10.0, depth: 0.2 },       // 10 Hz - vivid visuals, flow states, calm alertness
  beta: { rate: 15.0, depth: 0.15 },       // 15 Hz - focus, alertness, mental energy
  gamma: { rate: 40.0, depth: 0.1 },       // 40 Hz - cognitive enhancement, memory research
};

// Energy level mapping (user-friendly frequency ranges)
export const ENERGY_LEVELS: Record<string, [number, number]> = {
  deep_grounding: [28, 32],
  grounding: [32, 38],
  centered: [38, 45],
  balanced: [45, 52],
  uplifting: [52, 62],
  energizing: [62, 75],
  activating: [75, 90],
};

// Preset category for organization
export interface PresetCategory {
  name: string;
  description: string;
  icon: string;
  presets: string[];
}

// Preset index structure
export interface PresetIndex {
  categories: PresetCategory[];
}

// Progress callback type
export type ProgressCallback = (progress: RenderProgress) => void;

// Render progress information
export interface RenderProgress {
  phase: string;
  stage: string;
  progress: number; // 0-100
  message?: string;
}

// Export format options
export type ExportFormat = 'wav' | 'mp3';

// Export quality settings
export interface ExportSettings {
  format: ExportFormat;
  sampleRate: 22050 | 44100 | 48000;
  bitDepth?: 16 | 24 | 32; // WAV only
  bitrate?: 128 | 192 | 256 | 320; // MP3 only
  channels: 1 | 2;
}

// Default export settings
export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'wav',
  sampleRate: 48000,
  bitDepth: 16,
  channels: 2,
};
