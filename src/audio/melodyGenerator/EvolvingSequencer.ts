/**
 * EvolvingSequencer - Generates generative melodic patterns that evolve over time
 * Uses probabilistic note selection and gradual mutation for organic melodies
 */

import type { 
  MelodyGeneratorConfig, 
  EvolvingSettings, 
  MelodyNote 
} from '../../types/melodyGenerator';
import { 
  DEFAULT_EVOLVING_SETTINGS,
  getScaleNotesInRange,
  foundationToMelodyRoot,
  DENSITY_MULTIPLIERS
} from '../../types/melodyGenerator';
import type { EntrainmentMode } from '../../types/journey';
import { ENTRAINMENT_PRESETS } from '../../types/journey';

export interface EvolvingSequencerOptions {
  config: MelodyGeneratorConfig;
  settings?: Partial<EvolvingSettings>;
}

interface SequenceState {
  notes: number[];      // Current sequence of frequencies
  velocities: number[]; // Velocities for each note
  currentIndex: number; // Position in sequence
  generation: number;   // How many times sequence has evolved
}

export class EvolvingSequencer {
  private config: MelodyGeneratorConfig;
  private settings: EvolvingSettings;
  private sampleRate: number;
  private state: SequenceState;
  private scaleNotes: number[] = [];

  constructor(options: EvolvingSequencerOptions, sampleRate: number = 48000) {
    this.config = options.config;
    this.settings = { ...DEFAULT_EVOLVING_SETTINGS, ...options.settings };
    this.sampleRate = sampleRate;
    this.state = this.initializeState();
  }

  /**
   * Initialize sequence state
   */
  private initializeState(): SequenceState {
    return {
      notes: [],
      velocities: [],
      currentIndex: 0,
      generation: 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MelodyGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update evolving-specific settings
   */
  updateSettings(settings: Partial<EvolvingSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Generate evolving sequence audio
   */
  async generate(
    durationSeconds: number,
    foundationFreq: number,
    entrainmentMode: EntrainmentMode = 'breathing',
    progress: number = 0,
    onProgress?: (progress: number) => void
  ): Promise<{ buffer: AudioBuffer; notes: MelodyNote[] }> {
    const numSamples = Math.ceil(durationSeconds * this.sampleRate);
    const buffer = new AudioBuffer({
      numberOfChannels: 2,
      length: numSamples,
      sampleRate: this.sampleRate,
    });

    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    const generatedNotes: MelodyNote[] = [];

    // Get scale notes
    const rootFreq = foundationToMelodyRoot(foundationFreq);
    this.scaleNotes = getScaleNotesInRange(
      rootFreq,
      this.config.scale,
      this.config.frequencyMin,
      this.config.frequencyMax
    );

    if (this.scaleNotes.length === 0) {
      return { buffer, notes: generatedNotes };
    }

    // Initialize or reset sequence
    this.initializeSequence();

    // Calculate timing
    const preset = ENTRAINMENT_PRESETS[entrainmentMode];
    let noteRate = preset.rate > 0 ? preset.rate : 0.5;
    const densityMult = DENSITY_MULTIPLIERS[this.config.noteDensity];
    noteRate *= densityMult;
    
    const noteDuration = 1 / noteRate;
    const evolutionInterval = this.settings.evolutionRate;

    // Generate notes over duration
    let noteTime = 0;
    let lastEvolutionTime = 0;

    while (noteTime < durationSeconds) {
      // Check if it's time to evolve the sequence
      if (noteTime - lastEvolutionTime >= evolutionInterval) {
        this.evolveSequence();
        lastEvolutionTime = noteTime;
      }

      // Get current note
      const noteData = this.getNextNote();
      
      // Calculate stereo position based on contour
      const pan = this.config.stereoWidth * (Math.random() * 2 - 1) * 0.5;

      generatedNotes.push({
        time: noteTime,
        duration: noteDuration * 0.8, // Slight gap between notes
        frequency: noteData.frequency,
        velocity: noteData.velocity * this.config.intensity,
        pan,
      });

      noteTime += noteDuration;
    }

    // Render notes to audio
    this.renderNotes(generatedNotes, leftChannel, rightChannel);

    if (onProgress) {
      onProgress(100);
    }

    return { buffer, notes: generatedNotes };
  }

  /**
   * Initialize a new sequence
   */
  private initializeSequence(): void {
    const length = this.settings.sequenceLength;
    const notes: number[] = [];
    const velocities: number[] = [];

    // Start from a random scale note
    let currentIndex = Math.floor(Math.random() * this.scaleNotes.length);

    for (let i = 0; i < length; i++) {
      notes.push(this.scaleNotes[currentIndex]);
      velocities.push(0.5 + Math.random() * 0.5);

      // Move to next note based on contour and max interval
      const direction = this.settings.contour + (Math.random() - 0.5);
      const step = Math.floor(Math.random() * this.settings.maxInterval) + 1;
      
      if (direction > 0) {
        currentIndex = Math.min(currentIndex + step, this.scaleNotes.length - 1);
      } else {
        currentIndex = Math.max(currentIndex - step, 0);
      }
    }

    this.state = {
      notes,
      velocities,
      currentIndex: 0,
      generation: 0,
    };
  }

  /**
   * Evolve the sequence by mutating some notes
   */
  private evolveSequence(): void {
    const newNotes = [...this.state.notes];
    const newVelocities = [...this.state.velocities];

    for (let i = 0; i < newNotes.length; i++) {
      // Decide whether to mutate this note
      if (Math.random() < this.settings.mutationRate) {
        // Find current note index in scale
        const currentNoteIndex = this.scaleNotes.indexOf(newNotes[i]);
        
        if (currentNoteIndex >= 0) {
          // Calculate new index with contour bias
          const direction = this.settings.contour + (Math.random() - 0.5);
          const step = Math.floor(Math.random() * this.settings.maxInterval) + 1;
          
          let newIndex: number;
          if (direction > 0) {
            newIndex = Math.min(currentNoteIndex + step, this.scaleNotes.length - 1);
          } else {
            newIndex = Math.max(currentNoteIndex - step, 0);
          }
          
          newNotes[i] = this.scaleNotes[newIndex];
        } else {
          // If note not in scale, pick a random scale note
          newNotes[i] = this.scaleNotes[Math.floor(Math.random() * this.scaleNotes.length)];
        }

        // Also vary velocity slightly
        newVelocities[i] = Math.max(0.3, Math.min(1, newVelocities[i] + (Math.random() - 0.5) * 0.2));
      }
    }

    this.state.notes = newNotes;
    this.state.velocities = newVelocities;
    this.state.generation++;
  }

  /**
   * Get next note in sequence
   */
  private getNextNote(): { frequency: number; velocity: number } {
    const index = this.state.currentIndex;
    const frequency = this.state.notes[index];
    const velocity = this.state.velocities[index];

    // Advance index
    this.state.currentIndex = (index + 1) % this.state.notes.length;

    return { frequency, velocity };
  }

  /**
   * Render notes to stereo audio buffers
   */
  private renderNotes(
    notes: MelodyNote[],
    leftChannel: Float32Array,
    rightChannel: Float32Array
  ): void {
    const twoPiOverSr = (2 * Math.PI) / this.sampleRate;

    for (const note of notes) {
      const startSample = Math.floor(note.time * this.sampleRate);
      const endSample = Math.min(
        Math.floor((note.time + note.duration) * this.sampleRate),
        leftChannel.length
      );

      let phase = Math.random() * 2 * Math.PI; // Random start phase for variety
      const noteSamples = endSample - startSample;

      // ADSR envelope
      const attackSamples = Math.floor(this.config.attackTime * this.sampleRate);
      const releaseSamples = Math.floor(this.config.releaseTime * this.sampleRate);

      for (let i = startSample; i < endSample; i++) {
        const localIndex = i - startSample;

        // Envelope
        let envelope = 1;
        if (localIndex < attackSamples) {
          envelope = localIndex / attackSamples;
        } else if (localIndex > noteSamples - releaseSamples) {
          envelope = (noteSamples - localIndex) / releaseSamples;
        }
        envelope = Math.max(0, envelope);
        
        // Smooth envelope
        envelope = envelope * envelope * (3 - 2 * envelope);

        // Generate sample with slight FM for richness
        const fmAmount = 0.5;
        const fmRate = note.frequency * 2;
        const fm = Math.sin(phase * 2) * fmAmount;
        const sample = Math.sin(phase + fm) * note.velocity * envelope;
        
        phase += twoPiOverSr * note.frequency;

        // Stereo panning
        const leftGain = Math.cos((note.pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((note.pan + 1) * Math.PI / 4);

        leftChannel[i] += sample * leftGain;
        rightChannel[i] += sample * rightGain;
      }
    }
  }

  /**
   * Get current sequence state (for visualization)
   */
  getState(): SequenceState {
    return { ...this.state };
  }

  /**
   * Reset the sequencer
   */
  reset(): void {
    this.state = this.initializeState();
  }
}

// Export factory function
export function createEvolvingSequencer(
  config: MelodyGeneratorConfig,
  settings?: Partial<EvolvingSettings>,
  sampleRate?: number
): EvolvingSequencer {
  return new EvolvingSequencer({ config, settings }, sampleRate);
}
