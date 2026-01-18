/**
 * TypeScript interfaces for melody generation
 * Supports generative styles (drone, arpeggio, evolving, harmonic) and uploaded melodies
 */

// Melody generation style options
export type MelodyStyle = 'drone' | 'arpeggio' | 'evolving' | 'harmonic' | 'upload' | 'mixed';

// Musical scales for melody quantization
export type MelodyScale = 
  | 'pentatonic_major'
  | 'pentatonic_minor'
  | 'dorian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'chromatic'
  | 'whole_tone'
  | 'harmonic_minor';

// Scale intervals (semitones from root)
export const SCALE_INTERVALS: Record<MelodyScale, number[]> = {
  pentatonic_major: [0, 2, 4, 7, 9],      // C D E G A
  pentatonic_minor: [0, 3, 5, 7, 10],     // C Eb F G Bb
  dorian: [0, 2, 3, 5, 7, 9, 10],         // Minor with raised 6th
  lydian: [0, 2, 4, 6, 7, 9, 11],         // Major with raised 4th
  mixolydian: [0, 2, 4, 5, 7, 9, 10],     // Major with lowered 7th
  aeolian: [0, 2, 3, 5, 7, 8, 10],        // Natural minor
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  whole_tone: [0, 2, 4, 6, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11], // Minor with raised 7th
};

// Note density options
export type NoteDensity = 'sparse' | 'moderate' | 'dense';

// Note density timing multipliers (relative to entrainment rate)
export const DENSITY_MULTIPLIERS: Record<NoteDensity, number> = {
  sparse: 0.25,    // Notes every 4 beats
  moderate: 0.5,   // Notes every 2 beats
  dense: 1.0,      // Notes every beat
};

// Configuration for melody generation
export interface MelodyGeneratorConfig {
  // Frequency range for melody (typically 200-800 Hz)
  frequencyMin: number;
  frequencyMax: number;
  
  // Root note frequency (Hz) - derived from foundation or set manually
  rootFrequency: number;
  
  // Musical scale for quantization
  scale: MelodyScale;
  
  // Overall intensity/volume (0-1)
  intensity: number;
  
  // Style weights (0-1 each, should sum to ~1)
  droneWeight: number;
  arpeggioWeight: number;
  evolvingWeight: number;
  harmonicWeight: number;
  
  // Note density
  noteDensity: NoteDensity;
  
  // Stereo width (0 = mono, 1 = full stereo)
  stereoWidth: number;
  
  // Reverb/space amount (0-1)
  spaceAmount: number;
  
  // Envelope settings for notes
  attackTime: number;   // seconds
  releaseTime: number;  // seconds
  
  // Filter settings
  filterCutoff: number;  // Hz
  filterResonance: number; // 0-1
}

// Default melody configuration
export const DEFAULT_MELODY_CONFIG: MelodyGeneratorConfig = {
  frequencyMin: 200,
  frequencyMax: 800,
  rootFrequency: 220, // A3
  scale: 'pentatonic_minor',
  intensity: 0.3,
  droneWeight: 0.4,
  arpeggioWeight: 0.2,
  evolvingWeight: 0.3,
  harmonicWeight: 0.1,
  noteDensity: 'moderate',
  stereoWidth: 0.6,
  spaceAmount: 0.4,
  attackTime: 0.1,
  releaseTime: 0.5,
  filterCutoff: 2000,
  filterResonance: 0.2,
};

// Drone-specific settings
export interface DroneSettings {
  // Number of simultaneous drone voices
  voiceCount: number;
  // Pitch drift amount (cents)
  driftAmount: number;
  // Drift speed (Hz of LFO)
  driftSpeed: number;
  // Filter movement amount
  filterModAmount: number;
  // Detune between voices (cents)
  detuneAmount: number;
}

export const DEFAULT_DRONE_SETTINGS: DroneSettings = {
  voiceCount: 3,
  driftAmount: 15,
  driftSpeed: 0.05,
  filterModAmount: 500,
  detuneAmount: 8,
};

// Arpeggio-specific settings
export interface ArpeggioSettings {
  // Pattern type
  pattern: 'up' | 'down' | 'updown' | 'random' | 'chord';
  // Number of octaves to span
  octaveSpan: number;
  // Sync to entrainment rate
  syncToRhythm: boolean;
  // Note overlap (0 = staccato, 1 = legato)
  legato: number;
  // Accent every N notes (0 = no accent)
  accentEvery: number;
}

export const DEFAULT_ARPEGGIO_SETTINGS: ArpeggioSettings = {
  pattern: 'updown',
  octaveSpan: 2,
  syncToRhythm: true,
  legato: 0.5,
  accentEvery: 4,
};

// Evolving sequence settings
export interface EvolvingSettings {
  // Probability of changing note (0-1)
  mutationRate: number;
  // Sequence length (notes)
  sequenceLength: number;
  // How often sequence evolves (seconds)
  evolutionRate: number;
  // Range of pitch jumps (semitones)
  maxInterval: number;
  // Tendency to move up/down (-1 to 1)
  contour: number;
}

export const DEFAULT_EVOLVING_SETTINGS: EvolvingSettings = {
  mutationRate: 0.2,
  sequenceLength: 8,
  evolutionRate: 8,
  maxInterval: 7,
  contour: 0,
};

// Harmonic settings
export interface HarmonicSettings {
  // Which harmonics to include (1 = fundamental, 2 = octave, etc.)
  harmonics: number[];
  // Relative amplitudes for each harmonic
  amplitudes: number[];
  // Phase relationships (radians)
  phases: number[];
}

export const DEFAULT_HARMONIC_SETTINGS: HarmonicSettings = {
  harmonics: [2, 3, 4, 5, 6],
  amplitudes: [0.5, 0.3, 0.2, 0.15, 0.1],
  phases: [0, 0, 0, 0, 0],
};

// Phase-level melody configuration (for journey phases)
export interface PhaseMelodyConfig {
  // Enable melody for this phase
  enabled: boolean;
  // Style to use (or 'mixed' for weighted blend)
  style: MelodyStyle;
  // Scale/mode
  scale: MelodyScale;
  // Intensity (0-1)
  intensity: number;
  // Note density
  noteDensity: NoteDensity;
  // Optional: override style weights
  styleWeights?: {
    drone: number;
    arpeggio: number;
    evolving: number;
    harmonic: number;
  };
}

// Default phase melody config
export const DEFAULT_PHASE_MELODY: PhaseMelodyConfig = {
  enabled: false,
  style: 'mixed',
  scale: 'pentatonic_minor',
  intensity: 0.3,
  noteDensity: 'moderate',
};

// Generated melody note
export interface MelodyNote {
  time: number;        // Start time in seconds
  duration: number;    // Duration in seconds
  frequency: number;   // Frequency in Hz
  velocity: number;    // Velocity/amplitude (0-1)
  pan: number;         // Stereo position (-1 to 1)
}

// Generated melody track
export interface MelodyTrack {
  // Audio data
  buffer: AudioBuffer;
  
  // Metadata
  style: MelodyStyle;
  config: MelodyGeneratorConfig;
  
  // Notes for visualization
  notes: MelodyNote[];
}

// Upload state for melody files
export type MelodyUploadState = 'idle' | 'loading' | 'processing' | 'ready' | 'error';

// Progress information for melody generation
export interface MelodyProgress {
  stage: 'analyzing' | 'generating' | 'mixing' | 'processing';
  progress: number;  // 0-100
  message: string;
}

// Utility: Convert frequency to MIDI note number
export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

// Utility: Convert MIDI note to frequency
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Utility: Quantize frequency to scale
export function quantizeToScale(
  frequency: number,
  rootFrequency: number,
  scale: MelodyScale
): number {
  const intervals = SCALE_INTERVALS[scale];
  const rootMidi = frequencyToMidi(rootFrequency);
  const targetMidi = frequencyToMidi(frequency);
  
  // Find relative semitone from root
  const relativeSemitone = Math.round(targetMidi - rootMidi);
  const octave = Math.floor(relativeSemitone / 12);
  const semitoneInOctave = ((relativeSemitone % 12) + 12) % 12;
  
  // Find closest scale degree
  let closestInterval = intervals[0];
  let minDistance = Infinity;
  
  for (const interval of intervals) {
    const distance = Math.abs(interval - semitoneInOctave);
    if (distance < minDistance) {
      minDistance = distance;
      closestInterval = interval;
    }
  }
  
  // Return quantized frequency
  const quantizedMidi = rootMidi + octave * 12 + closestInterval;
  return midiToFrequency(quantizedMidi);
}

// Utility: Get scale notes in a frequency range
export function getScaleNotesInRange(
  rootFrequency: number,
  scale: MelodyScale,
  minFreq: number,
  maxFreq: number
): number[] {
  const intervals = SCALE_INTERVALS[scale];
  const notes: number[] = [];
  const rootMidi = frequencyToMidi(rootFrequency);
  
  // Generate notes across multiple octaves
  for (let octave = -4; octave <= 4; octave++) {
    for (const interval of intervals) {
      const midi = rootMidi + octave * 12 + interval;
      const freq = midiToFrequency(midi);
      
      if (freq >= minFreq && freq <= maxFreq) {
        notes.push(freq);
      }
    }
  }
  
  return notes.sort((a, b) => a - b);
}

// Utility: Map foundation frequency to melody root
export function foundationToMelodyRoot(foundationFreq: number): number {
  // Foundation frequencies (28-80 Hz) map to melody range
  // We go up 2-3 octaves to get into a pleasant melody range
  let melodyRoot = foundationFreq;
  
  while (melodyRoot < 200) {
    melodyRoot *= 2;
  }
  
  return melodyRoot;
}

// Utility: Clamp frequency to range
export function clampFrequency(freq: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, freq));
}
