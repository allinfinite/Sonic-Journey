/**
 * EnhancedMelodyEngine - Advanced melody generation using Tone.js
 * Provides rich, dynamic melodies with professional synthesis, effects, and sequencing
 */

import * as Tone from 'tone';
import type { 
  MelodyGeneratorConfig, 
  MelodyStyle, 
  MelodyScale,
  NoteDensity
} from '../../types/melodyGenerator';
import { 
  getScaleNotesInRange,
  foundationToMelodyRoot,
  DENSITY_MULTIPLIERS
} from '../../types/melodyGenerator';
import type { EntrainmentMode } from '../../types/journey';
import { ENTRAINMENT_PRESETS } from '../../types/journey';

export interface EnhancedMelodySettings {
  // Effects
  reverbAmount: number;      // 0-1
  delayTime: number;          // seconds
  delayFeedback: number;      // 0-1
  chorusDepth: number;        // 0-1
  chorusRate: number;         // Hz
  
  // Synth parameters
  attackTime: number;         // seconds
  decayTime: number;          // seconds
  sustainLevel: number;       // 0-1
  releaseTime: number;        // seconds
  
  // Drone-specific
  droneDetune: number;        // cents
  
  // Arpeggio-specific
  arpeggioPattern: 'up' | 'down' | 'updown' | 'random';
  
  // Evolving-specific
  mutationRate: number;       // 0-1
}

const DEFAULT_ENHANCED_SETTINGS: EnhancedMelodySettings = {
  reverbAmount: 0.6,
  delayTime: 0.3,
  delayFeedback: 0.25,
  chorusDepth: 0.5,
  chorusRate: 1.5,
  attackTime: 0.1,
  decayTime: 0.2,
  sustainLevel: 0.7,
  releaseTime: 0.5,
  droneDetune: 8,
  arpeggioPattern: 'updown',
  mutationRate: 0.2,
};

export class EnhancedMelodyEngine {
  private config: MelodyGeneratorConfig;
  private settings: EnhancedMelodySettings;
  private synths: Tone.PolySynth[] = [];
  private reverb!: Tone.Reverb;
  private delay!: Tone.FeedbackDelay;
  private chorus!: Tone.Chorus;
  private masterVolume!: Tone.Volume;
  private sequencer: Tone.Sequence | null = null;
  private isInitialized = false;
  private scaleNotes: number[] = [];

  constructor(config: MelodyGeneratorConfig, settings?: Partial<EnhancedMelodySettings>) {
    this.config = config;
    this.settings = { ...DEFAULT_ENHANCED_SETTINGS, ...settings };
  }

  /**
   * Initialize Tone.js audio nodes
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      // Start Tone.js context
      await Tone.start();
      
      // Ensure context is running
      if (Tone.context.state !== 'running') {
        await Tone.context.resume();
      }

      // Create effects chain
      // Reverb takes decay time in seconds (convert from 0-1 amount to 1-4 seconds)
      const reverbDecay = 1 + this.settings.reverbAmount * 3;
      this.reverb = new Tone.Reverb(reverbDecay).toDestination();
      // Generate reverb impulse response (this is async)
      await this.reverb.generate();

      this.delay = new Tone.FeedbackDelay({
        delayTime: this.settings.delayTime,
        feedback: this.settings.delayFeedback,
      }).connect(this.reverb);

      this.chorus = new Tone.Chorus({
        frequency: this.settings.chorusRate,
        delayTime: 3.5,
        depth: this.settings.chorusDepth,
      }).connect(this.delay);

      // Volume: convert 0-1 intensity to dB, with minimum of -12dB (not too quiet)
    const volumeDb = Math.max(-12, this.config.intensity * 20 - 20);
    this.masterVolume = new Tone.Volume(volumeDb).connect(this.chorus);

      // Start Tone.js Transport
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('EnhancedMelodyEngine: Failed to initialize', error);
      throw error;
    }
  }

  /**
   * Create synths based on style
   */
  private createSynths(style: MelodyStyle): void {
    // Dispose existing synths
    this.disposeSynths();

    switch (style) {
      case 'drone':
        // Rich pad with multiple detuned voices
        for (let i = 0; i < 4; i++) {
          const synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
              type: 'sine',
            },
            envelope: {
              attack: 2,
              decay: 0.5,
              sustain: 1,
              release: 3,
            },
            volume: -8 - i * 2,
            detune: (i - 1.5) * this.settings.droneDetune,
          });
          synth.connect(this.masterVolume);
          this.synths.push(synth);
        }
        break;

      case 'arpeggio':
        // Bright, plucky sound
        const arpSynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: 'triangle',
          },
          envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.3,
            release: 0.5,
          },
        });
        arpSynth.connect(this.masterVolume);
        this.synths.push(arpSynth);
        break;

      case 'evolving':
        // FM synthesis for evolving textures
        const fmSynth = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3,
          modulationIndex: 10,
          oscillator: {
            type: 'sine',
          },
          envelope: {
            attack: this.settings.attackTime,
            decay: this.settings.decayTime,
            sustain: this.settings.sustainLevel,
            release: this.settings.releaseTime,
          },
          modulation: {
            type: 'square',
          },
          modulationEnvelope: {
            attack: 0.5,
            decay: 0.01,
            sustain: 1,
            release: 0.5,
          },
        });
        fmSynth.connect(this.masterVolume);
        this.synths.push(fmSynth);
        break;

      case 'harmonic':
        // AM synthesis for harmonic richness
        const amSynth = new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2,
          oscillator: {
            type: 'sine',
          },
          envelope: {
            attack: 0.01,
            decay: 0.01,
            sustain: 1,
            release: 0.5,
          },
          modulation: {
            type: 'triangle',
          },
        });
        amSynth.connect(this.masterVolume);
        this.synths.push(amSynth);
        break;

      case 'mixed':
      default:
        // Combination: main melody + pad
        const mainSynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: {
            attack: this.settings.attackTime,
            decay: this.settings.decayTime,
            sustain: this.settings.sustainLevel,
            release: this.settings.releaseTime,
          },
        });
        mainSynth.connect(this.masterVolume);
        this.synths.push(mainSynth);

        const padSynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 1, decay: 0.5, sustain: 1, release: 2 },
          volume: -10,
        });
        padSynth.connect(this.masterVolume);
        this.synths.push(padSynth);
        break;
    }
  }

  /**
   * Start playing melody sequence
   */
  async start(
    foundationFreq: number,
    style: MelodyStyle,
    scale: MelodyScale,
    density: NoteDensity,
    entrainmentMode: EntrainmentMode
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Get scale notes
    const rootFreq = foundationToMelodyRoot(foundationFreq);
    this.scaleNotes = getScaleNotesInRange(
      rootFreq,
      scale,
      this.config.frequencyMin,
      this.config.frequencyMax
    );

    if (this.scaleNotes.length === 0) {
      console.warn('EnhancedMelodyEngine: No scale notes generated', { rootFreq, scale, frequencyMin: this.config.frequencyMin, frequencyMax: this.config.frequencyMax });
      return;
    }

    // Create synths for this style
    this.createSynths(style);

    // Get timing
    const preset = ENTRAINMENT_PRESETS[entrainmentMode];
    const densityMult = DENSITY_MULTIPLIERS[density];
    const noteRate = (preset.rate > 0 ? preset.rate : 0.5) * densityMult;
    const noteInterval = 1 / noteRate;

    // Create sequence
    const sequence = this.createSequence(style);
    
    if (sequence.length === 0) {
      console.warn('EnhancedMelodyEngine: Empty sequence created', { style, scaleNotes: this.scaleNotes });
      return;
    }

    // Stop existing sequencer
    if (this.sequencer) {
      this.sequencer.stop();
      this.sequencer.dispose();
      this.sequencer = null;
    }

    // Create new sequencer
    const synth = this.synths[0];
    if (!synth) {
      console.warn('EnhancedMelodyEngine: No synth available');
      return;
    }

    // Ensure Transport is running
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }

    // Create sequencer with proper timing
    // Tone.Sequence uses Transport time, and the interval should be in seconds or time notation
    this.sequencer = new Tone.Sequence(
      (time, note) => {
        if (synth && note) {
          try {
            synth.triggerAttackRelease(note, noteInterval * 0.8, time);
          } catch (error) {
            console.error('EnhancedMelodyEngine: Error triggering note', error, { note, time });
          }
        }
      },
      sequence,
      noteInterval
    );

    // Start the sequencer immediately
    this.sequencer.start(0);
    
    // Also trigger an immediate test note to verify synth is working
    if (sequence.length > 0) {
      try {
        synth.triggerAttackRelease(sequence[0], noteInterval * 0.8, Tone.now());
      } catch (error) {
        console.error('EnhancedMelodyEngine: Error triggering test note', error);
      }
    }
  }

  /**
   * Create note sequence based on style
   */
  private createSequence(style: MelodyStyle): string[] {
    const sequence: string[] = [];

    switch (style) {
      case 'drone':
        // Long sustained chords
        const droneNotes = this.scaleNotes.slice(0, 4).map(freq => 
          Tone.Frequency(freq).toNote()
        );
        return droneNotes;

      case 'arpeggio':
        // Arpeggio pattern
        const arpNotes = this.scaleNotes.slice(0, 8);
        const arpSequence = arpNotes.map(freq => Tone.Frequency(freq).toNote());
        
        if (this.settings.arpeggioPattern === 'updown') {
          // Add reverse
          for (let i = arpNotes.length - 2; i > 0; i--) {
            arpSequence.push(Tone.Frequency(arpNotes[i]).toNote());
          }
        } else if (this.settings.arpeggioPattern === 'down') {
          arpSequence.reverse();
        } else if (this.settings.arpeggioPattern === 'random') {
          // Shuffle
          for (let i = arpSequence.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arpSequence[i], arpSequence[j]] = [arpSequence[j], arpSequence[i]];
          }
        }
        return arpSequence;

      case 'evolving':
        // Probabilistic evolving sequence
        let currentIndex = 0;
        for (let i = 0; i < 16; i++) {
          if (Math.random() < this.settings.mutationRate) {
            currentIndex = Math.floor(Math.random() * this.scaleNotes.length);
          } else {
            const direction = Math.random() < 0.5 ? 1 : -1;
            currentIndex = Math.max(0, Math.min(this.scaleNotes.length - 1, currentIndex + direction));
          }
          sequence.push(Tone.Frequency(this.scaleNotes[currentIndex]).toNote());
        }
        return sequence;

      case 'harmonic':
        // Harmonic intervals
        const root = this.scaleNotes[0];
        const intervals = [0, 4, 7, 12]; // Root, third, fifth, octave
        for (const interval of intervals) {
          const noteIndex = Math.min(interval, this.scaleNotes.length - 1);
          const freq = this.scaleNotes[noteIndex] || root * Math.pow(2, interval / 12);
          sequence.push(Tone.Frequency(freq).toNote());
        }
        return sequence;

      case 'mixed':
      default:
        // Mix of patterns
        for (let i = 0; i < Math.min(8, this.scaleNotes.length); i++) {
          sequence.push(Tone.Frequency(this.scaleNotes[i]).toNote());
        }
        return sequence;
    }
  }

  /**
   * Update volume
   */
  setVolume(volume: number): void {
    if (this.masterVolume) {
      // Ensure volume is audible (minimum -12dB)
      const volumeDb = Math.max(-12, volume * 20 - 20);
      this.masterVolume.volume.value = volumeDb;
    }
  }

  /**
   * Update effects
   */
  updateEffects(settings: Partial<EnhancedMelodySettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    if (this.reverb && settings.reverbAmount !== undefined) {
      // Reverb decay time (1-4 seconds based on amount)
      const reverbDecay = 1 + settings.reverbAmount * 3;
      this.reverb.decay = reverbDecay;
    }
    if (this.delay) {
      if (settings.delayTime !== undefined) {
        this.delay.delayTime.value = settings.delayTime;
      }
      if (settings.delayFeedback !== undefined) {
        this.delay.feedback.value = settings.delayFeedback;
      }
    }
    if (this.chorus) {
      if (settings.chorusDepth !== undefined) {
        this.chorus.depth = settings.chorusDepth;
      }
      if (settings.chorusRate !== undefined) {
        this.chorus.frequency.value = settings.chorusRate;
      }
    }
  }

  /**
   * Stop playing
   */
  stop(): void {
    if (this.sequencer) {
      this.sequencer.stop();
    }
    for (const synth of this.synths) {
      synth.releaseAll();
    }
  }

  /**
   * Dispose of all audio nodes
   */
  dispose(): void {
    this.stop();
    if (this.sequencer) {
      this.sequencer.dispose();
      this.sequencer = null;
    }
    this.disposeSynths();
    if (this.reverb) this.reverb.dispose();
    if (this.delay) this.delay.dispose();
    if (this.chorus) this.chorus.dispose();
    if (this.masterVolume) this.masterVolume.dispose();
    this.isInitialized = false;
  }

  private disposeSynths(): void {
    for (const synth of this.synths) {
      synth.dispose();
    }
    this.synths = [];
  }
}

// Export factory function
export function createEnhancedMelodyEngine(
  config: MelodyGeneratorConfig,
  settings?: Partial<EnhancedMelodySettings>
): EnhancedMelodyEngine {
  return new EnhancedMelodyEngine(config, settings);
}
