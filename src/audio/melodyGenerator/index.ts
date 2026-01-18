/**
 * Melody Generator Module
 * Exports all melody generation components
 */

// Generators
export { DroneGenerator, createDroneGenerator } from './DroneGenerator';
export { ArpeggioGenerator, createArpeggioGenerator } from './ArpeggioGenerator';
export { EvolvingSequencer, createEvolvingSequencer } from './EvolvingSequencer';
export { HarmonicGenerator, createHarmonicGenerator } from './HarmonicGenerator';
export { MelodyMixer, createMelodyMixer } from './MelodyMixer';
export { MelodyProcessor, createMelodyProcessor } from './MelodyProcessor';

// Types re-exported for convenience
export type {
  MelodyStyle,
  MelodyScale,
  NoteDensity,
  MelodyGeneratorConfig,
  DroneSettings,
  ArpeggioSettings,
  EvolvingSettings,
  HarmonicSettings,
  PhaseMelodyConfig,
  MelodyNote,
  MelodyTrack,
  MelodyProgress,
} from '../../types/melodyGenerator';

export {
  DEFAULT_MELODY_CONFIG,
  DEFAULT_DRONE_SETTINGS,
  DEFAULT_ARPEGGIO_SETTINGS,
  DEFAULT_EVOLVING_SETTINGS,
  DEFAULT_HARMONIC_SETTINGS,
  DEFAULT_PHASE_MELODY,
  SCALE_INTERVALS,
  DENSITY_MULTIPLIERS,
  quantizeToScale,
  getScaleNotesInRange,
  foundationToMelodyRoot,
  frequencyToMidi,
  midiToFrequency,
} from '../../types/melodyGenerator';
