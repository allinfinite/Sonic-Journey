/**
 * ArpeggioGenerator - Creates rhythmic melodic patterns synced to entrainment
 * Generates arpeggiated sequences that follow the journey's rhythm mode
 */

import type { 
  MelodyGeneratorConfig, 
  ArpeggioSettings, 
  MelodyNote,
  NoteDensity 
} from '../../types/melodyGenerator';
import { 
  DEFAULT_ARPEGGIO_SETTINGS,
  DENSITY_MULTIPLIERS,
  getScaleNotesInRange,
  foundationToMelodyRoot 
} from '../../types/melodyGenerator';
import type { EntrainmentMode } from '../../types/journey';
import { ENTRAINMENT_PRESETS } from '../../types/journey';

export interface ArpeggioGeneratorOptions {
  config: MelodyGeneratorConfig;
  settings?: Partial<ArpeggioSettings>;
}

export class ArpeggioGenerator {
  private config: MelodyGeneratorConfig;
  private settings: ArpeggioSettings;
  private sampleRate: number;

  constructor(options: ArpeggioGeneratorOptions, sampleRate: number = 48000) {
    this.config = options.config;
    this.settings = { ...DEFAULT_ARPEGGIO_SETTINGS, ...options.settings };
    this.sampleRate = sampleRate;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MelodyGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update arpeggio-specific settings
   */
  updateSettings(settings: Partial<ArpeggioSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Generate arpeggio audio synchronized to rhythm
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
    const notes: MelodyNote[] = [];

    // Get entrainment rate
    const preset = ENTRAINMENT_PRESETS[entrainmentMode];
    let noteRate = preset.rate > 0 ? preset.rate : 0.5; // Notes per second
    
    // Adjust by density
    const densityMult = DENSITY_MULTIPLIERS[this.config.noteDensity];
    noteRate *= densityMult;
    
    // Calculate note timing
    const noteDuration = 1 / noteRate;
    const noteOverlap = noteDuration * this.settings.legato;
    
    // Get scale notes
    const rootFreq = foundationToMelodyRoot(foundationFreq);
    const scaleNotes = getScaleNotesInRange(
      rootFreq,
      this.config.scale,
      this.config.frequencyMin,
      this.config.frequencyMax
    );

    if (scaleNotes.length === 0) {
      return { buffer, notes };
    }

    // Build arpeggio pattern
    const pattern = this.buildPattern(scaleNotes);
    
    // Generate notes
    let patternIndex = 0;
    let noteTime = 0;
    
    while (noteTime < durationSeconds) {
      const freq = pattern[patternIndex % pattern.length];
      const isAccent = this.settings.accentEvery > 0 && 
                       patternIndex % this.settings.accentEvery === 0;
      
      // Calculate stereo position (alternate left/right)
      const pan = (patternIndex % 2 === 0 ? -1 : 1) * this.config.stereoWidth * 0.5;
      
      const velocity = this.config.intensity * (isAccent ? 1.0 : 0.7);
      
      notes.push({
        time: noteTime,
        duration: Math.min(noteDuration + noteOverlap, durationSeconds - noteTime),
        frequency: freq,
        velocity,
        pan,
      });
      
      noteTime += noteDuration;
      patternIndex++;
    }

    // Render notes to audio
    this.renderNotes(notes, leftChannel, rightChannel, durationSeconds);

    if (onProgress) {
      onProgress(100);
    }

    return { buffer, notes };
  }

  /**
   * Build arpeggio pattern from scale notes
   */
  private buildPattern(scaleNotes: number[]): number[] {
    const pattern: number[] = [];
    const octaveNotes = this.getNotesWithOctaves(scaleNotes);
    
    switch (this.settings.pattern) {
      case 'up':
        return octaveNotes;
        
      case 'down':
        return [...octaveNotes].reverse();
        
      case 'updown':
        return [...octaveNotes, ...octaveNotes.slice(1, -1).reverse()];
        
      case 'random':
        // Shuffle the notes
        const shuffled = [...octaveNotes];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
        
      case 'chord':
        // Play chord tones (root, third, fifth) simultaneously is handled differently
        // For sequential, just use first few notes
        return octaveNotes.slice(0, 4);
        
      default:
        return octaveNotes;
    }
  }

  /**
   * Expand notes across octave span
   */
  private getNotesWithOctaves(scaleNotes: number[]): number[] {
    const expanded: number[] = [];
    const baseOctaveNotes = scaleNotes.filter(
      n => n >= this.config.frequencyMin && n < this.config.frequencyMin * 2
    );
    
    if (baseOctaveNotes.length === 0) {
      return scaleNotes.slice(0, 8);
    }
    
    for (let oct = 0; oct < this.settings.octaveSpan; oct++) {
      for (const note of baseOctaveNotes) {
        const octaveNote = note * Math.pow(2, oct);
        if (octaveNote <= this.config.frequencyMax) {
          expanded.push(octaveNote);
        }
      }
    }
    
    return expanded.length > 0 ? expanded : scaleNotes;
  }

  /**
   * Render notes to stereo audio buffers
   */
  private renderNotes(
    notes: MelodyNote[],
    leftChannel: Float32Array,
    rightChannel: Float32Array,
    durationSeconds: number
  ): void {
    const twoPiOverSr = (2 * Math.PI) / this.sampleRate;
    
    for (const note of notes) {
      const startSample = Math.floor(note.time * this.sampleRate);
      const endSample = Math.min(
        Math.floor((note.time + note.duration) * this.sampleRate),
        leftChannel.length
      );
      
      let phase = 0;
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
        envelope = Math.max(0, Math.min(1, envelope));
        
        // Generate sine wave
        const sample = Math.sin(phase) * note.velocity * envelope;
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
   * Get next note in arpeggio sequence (for real-time use)
   */
  getNextNote(
    scaleNotes: number[],
    currentIndex: number
  ): { frequency: number; index: number } {
    const pattern = this.buildPattern(scaleNotes);
    const index = currentIndex % pattern.length;
    return {
      frequency: pattern[index],
      index: (currentIndex + 1) % pattern.length,
    };
  }
}

// Export factory function
export function createArpeggioGenerator(
  config: MelodyGeneratorConfig,
  settings?: Partial<ArpeggioSettings>,
  sampleRate?: number
): ArpeggioGenerator {
  return new ArpeggioGenerator({ config, settings }, sampleRate);
}
