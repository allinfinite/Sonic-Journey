/**
 * Bass Layer types, constants, and presets
 * Real-time bass synthesis that plays alongside user's music
 */

export type MusicalKey = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** Frequencies for each musical key in octave 1 (sub-bass range) */
export const KEY_FREQUENCIES: Record<MusicalKey, number> = {
  C: 32.70,
  D: 36.71,
  E: 41.20,
  F: 43.65,
  G: 49.00,
  A: 55.00,
  B: 61.74,
};

export const MUSICAL_KEYS: MusicalKey[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export type RhythmPattern = 'continuous' | 'pulse' | 'breathing' | 'heartbeat' | 'subpulse';

export const RHYTHM_PATTERNS: { id: RhythmPattern; name: string; description: string }[] = [
  { id: 'continuous', name: 'Drone', description: 'Steady tone' },
  { id: 'pulse', name: 'Pulse', description: 'On-beat hits' },
  { id: 'breathing', name: 'Breathing', description: 'Slow swell' },
  { id: 'heartbeat', name: 'Heartbeat', description: 'Lub-dub' },
  { id: 'subpulse', name: 'Sub Pulse', description: 'Half-note hits' },
];

export interface BassLayerConfig {
  frequency: number;
  musicalKey: MusicalKey;
  intensity: number;
  rhythmPattern: RhythmPattern;
  bpm: number;
  attackTime: number;
  releaseTime: number;
}

export interface BassLayerPreset {
  id: string;
  name: string;
  description: string;
  config: BassLayerConfig;
}

export const DEFAULT_BASS_LAYER_CONFIG: BassLayerConfig = {
  frequency: 32.70,
  musicalKey: 'C',
  intensity: 0.6,
  rhythmPattern: 'continuous',
  bpm: 120,
  attackTime: 0.05,
  releaseTime: 0.2,
};

export const BASS_LAYER_PRESETS: BassLayerPreset[] = [
  {
    id: 'deep-drone',
    name: 'Deep Drone',
    description: 'Continuous low C for meditation',
    config: { frequency: 32.70, musicalKey: 'C', intensity: 0.5, rhythmPattern: 'continuous', bpm: 120, attackTime: 0.05, releaseTime: 0.2 },
  },
  {
    id: 'rhythmic-pulse',
    name: 'Rhythmic Pulse',
    description: '120 BPM quarter note pulses',
    config: { frequency: 41.20, musicalKey: 'E', intensity: 0.65, rhythmPattern: 'pulse', bpm: 120, attackTime: 0.02, releaseTime: 0.15 },
  },
  {
    id: 'slow-breathing',
    name: 'Slow Breathing',
    description: 'Gentle swell for relaxation',
    config: { frequency: 49.00, musicalKey: 'G', intensity: 0.5, rhythmPattern: 'breathing', bpm: 6, attackTime: 2.0, releaseTime: 3.0 },
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    description: '72 BPM double pulse',
    config: { frequency: 36.71, musicalKey: 'D', intensity: 0.6, rhythmPattern: 'heartbeat', bpm: 72, attackTime: 0.01, releaseTime: 0.1 },
  },
  {
    id: 'sub-rumble',
    name: 'Sub Rumble',
    description: 'Deep rhythmic sub-bass',
    config: { frequency: 49.00, musicalKey: 'G', intensity: 0.7, rhythmPattern: 'subpulse', bpm: 60, attackTime: 0.1, releaseTime: 0.5 },
  },
];
