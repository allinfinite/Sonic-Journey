/**
 * ToneMelodyGenerator - Enhanced melody generation using Tone.js
 * Provides rich, dynamic melodies with professional synthesis and effects
 */

import * as Tone from 'tone';
import type { 
  MelodyGeneratorConfig, 
  MelodyStyle
} from '../../types/melodyGenerator';
import { 
  getScaleNotesInRange,
  foundationToMelodyRoot,
  DENSITY_MULTIPLIERS
} from '../../types/melodyGenerator';
import type { EntrainmentMode } from '../../types/journey';
import { ENTRAINMENT_PRESETS } from '../../types/journey';

export interface ToneMelodyOptions {
  config: MelodyGeneratorConfig;
  style: MelodyStyle;
  sampleRate?: number;
}

export class ToneMelodyGenerator {
  private config: MelodyGeneratorConfig;
  private style: MelodyStyle;
  private synths: Tone.PolySynth[] = [];
  private reverb!: Tone.Reverb;
  private delay!: Tone.FeedbackDelay;
  private chorus!: Tone.Chorus;
  private masterVolume!: Tone.Volume;
  private isInitialized = false;

  constructor(options: ToneMelodyOptions) {
    this.config = options.config;
    this.style = options.style;
    
    // Initialize Tone.js (will be started when needed)
    if (typeof window !== 'undefined') {
      this.initializeTone();
    }
  }

  /**
   * Initialize Tone.js audio nodes
   */
  private async initializeTone(): Promise<void> {
    if (this.isInitialized) return;

    // Create effects
    // Reverb takes decay time in seconds
    this.reverb = new Tone.Reverb(2.5).toDestination();

    this.delay = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.3,
    }).connect(this.reverb);

    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
    }).connect(this.delay);

    this.masterVolume = new Tone.Volume(this.config.intensity * 20 - 20).connect(this.chorus);

    // Create polyphonic synths based on style
    this.createSynths();

    this.isInitialized = true;
  }

  /**
   * Create synths based on melody style
   */
  private createSynths(): void {
    this.synths = [];

    switch (this.style) {
      case 'drone':
        // Rich pad sound with multiple voices
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
            volume: -6 - i * 2, // Slight volume variation
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
          detune: 0,
          oscillator: {
            type: 'sine',
          },
          envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.5,
            release: 1,
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
          detune: 0,
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
        // Combination of synths
        const mainSynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.5 },
        });
        mainSynth.connect(this.masterVolume);
        this.synths.push(mainSynth);

        const padSynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 1, decay: 0.5, sustain: 1, release: 2 },
          volume: -8,
        });
        padSynth.connect(this.masterVolume);
        this.synths.push(padSynth);
        break;
    }
  }

  /**
   * Generate melody using Tone.js for real-time playback
   */
  async generateRealTime(
    foundationFreq: number,
    entrainmentMode: EntrainmentMode,
    durationSeconds: number
  ): Promise<void> {
    if (typeof window === 'undefined') return;

    await this.initializeTone();
    await Tone.start(); // Start audio context

    const rootFreq = foundationToMelodyRoot(foundationFreq);
    const scaleNotes = getScaleNotesInRange(
      rootFreq,
      this.config.scale,
      this.config.frequencyMin,
      this.config.frequencyMax
    );

    if (scaleNotes.length === 0) return;

    // Get entrainment rate
    const preset = ENTRAINMENT_PRESETS[entrainmentMode];
    const densityMult = DENSITY_MULTIPLIERS[this.config.noteDensity];
    const noteRate = (preset.rate > 0 ? preset.rate : 0.5) * densityMult;
    const noteInterval = 1 / noteRate;

    // Create sequence based on style
    const sequence = this.createSequence(scaleNotes);

    // Schedule notes
    const now = Tone.now();
    let time = now;
    let noteIndex = 0;

    while (time < now + durationSeconds && noteIndex < sequence.length * 10) {
      const note = sequence[noteIndex % sequence.length];
      const synth = this.synths[noteIndex % this.synths.length];
      
      synth.triggerAttackRelease(
        Tone.Frequency(note.frequency).toNote(),
        note.duration,
        time,
        note.velocity
      );

      time += noteInterval;
      noteIndex++;
    }
  }

  /**
   * Create note sequence based on style
   */
  private createSequence(scaleNotes: number[]): Array<{ frequency: number; duration: string; velocity: number }> {
    const sequence: Array<{ frequency: number; duration: string; velocity: number }> = [];

    switch (this.style) {
      case 'drone':
        // Long sustained notes
        for (let i = 0; i < Math.min(4, scaleNotes.length); i++) {
          sequence.push({
            frequency: scaleNotes[i],
            duration: '4n',
            velocity: 0.7,
          });
        }
        break;

      case 'arpeggio':
        // Up and down arpeggio
        for (const note of scaleNotes.slice(0, 8)) {
          sequence.push({
            frequency: note,
            duration: '8n',
            velocity: 0.8,
          });
        }
        // Reverse
        for (let i = scaleNotes.length - 2; i > 0; i--) {
          sequence.push({
            frequency: scaleNotes[i],
            duration: '8n',
            velocity: 0.7,
          });
        }
        break;

      case 'evolving':
        // Probabilistic sequence
        let currentIndex = 0;
        for (let i = 0; i < 16; i++) {
          if (Math.random() < 0.3) {
            currentIndex = Math.floor(Math.random() * scaleNotes.length);
          } else {
            const direction = Math.random() < 0.5 ? 1 : -1;
            currentIndex = Math.max(0, Math.min(scaleNotes.length - 1, currentIndex + direction));
          }
          sequence.push({
            frequency: scaleNotes[currentIndex],
            duration: '4n',
            velocity: 0.5 + Math.random() * 0.3,
          });
        }
        break;

      case 'harmonic':
        // Harmonic intervals
        const root = scaleNotes[0];
        const intervals = [0, 4, 7, 12]; // Root, third, fifth, octave
        for (const interval of intervals) {
          const noteIndex = Math.min(interval, scaleNotes.length - 1);
          sequence.push({
            frequency: scaleNotes[noteIndex] || root * Math.pow(2, interval / 12),
            duration: '2n',
            velocity: 0.6,
          });
        }
        break;

      case 'mixed':
      default:
        // Mix of patterns
        for (let i = 0; i < Math.min(8, scaleNotes.length); i++) {
          sequence.push({
            frequency: scaleNotes[i],
            duration: i % 2 === 0 ? '8n' : '4n',
            velocity: 0.6 + Math.random() * 0.2,
          });
        }
        break;
    }

    return sequence;
  }

  /**
   * Update effects settings
   */
  updateEffects(settings: {
    reverbAmount?: number;
    delayTime?: number;
    delayFeedback?: number;
    chorusDepth?: number;
    volume?: number;
  }): void {
    if (!this.isInitialized) return;

    if (settings.reverbAmount !== undefined) {
      const reverbDecay = 1 + settings.reverbAmount * 3;
      this.reverb.decay = reverbDecay;
    }
    if (settings.delayTime !== undefined) {
      this.delay.delayTime.value = settings.delayTime;
    }
    if (settings.delayFeedback !== undefined) {
      this.delay.feedback.value = settings.delayFeedback;
    }
    if (settings.chorusDepth !== undefined) {
      this.chorus.depth = settings.chorusDepth;
    }
    if (settings.volume !== undefined) {
      this.masterVolume.volume.value = settings.volume * 20 - 20; // Convert 0-1 to dB
    }
  }

  /**
   * Stop all playing notes
   */
  stop(): void {
    if (!this.isInitialized) return;
    for (const synth of this.synths) {
      synth.releaseAll();
    }
  }

  /**
   * Dispose of all audio nodes
   */
  dispose(): void {
    this.stop();
    if (this.reverb) this.reverb.dispose();
    if (this.delay) this.delay.dispose();
    if (this.chorus) this.chorus.dispose();
    if (this.masterVolume) this.masterVolume.dispose();
    for (const synth of this.synths) {
      synth.dispose();
    }
    this.synths = [];
    this.isInitialized = false;
  }

  /**
   * Generate offline audio buffer (for export)
   */
  async generateOffline(
    _foundationFreq: number,
    _entrainmentMode: EntrainmentMode,
    _durationSeconds: number
  ): Promise<AudioBuffer> {
    // For offline rendering, we'll use the existing generators
    // Tone.js offline rendering is more complex, so we keep the simple generators for export
    throw new Error('Use generateRealTime for Tone.js melodies. Offline rendering uses basic generators.');
  }
}

// Export factory function
export function createToneMelodyGenerator(options: ToneMelodyOptions): ToneMelodyGenerator {
  return new ToneMelodyGenerator(options);
}
