/**
 * DroneGenerator - Creates long sustained pad tones with slow pitch drift
 * Perfect for ambient, meditative backgrounds
 */

import type { 
  MelodyGeneratorConfig, 
  DroneSettings, 
  MelodyNote 
} from '../../types/melodyGenerator';
import { 
  DEFAULT_DRONE_SETTINGS, 
  quantizeToScale,
  foundationToMelodyRoot,
  getScaleNotesInRange 
} from '../../types/melodyGenerator';

export interface DroneGeneratorOptions {
  config: MelodyGeneratorConfig;
  settings?: Partial<DroneSettings>;
}

export class DroneGenerator {
  private config: MelodyGeneratorConfig;
  private settings: DroneSettings;
  private sampleRate: number;

  constructor(options: DroneGeneratorOptions, sampleRate: number = 48000) {
    this.config = options.config;
    this.settings = { ...DEFAULT_DRONE_SETTINGS, ...options.settings };
    this.sampleRate = sampleRate;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MelodyGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update drone-specific settings
   */
  updateSettings(settings: Partial<DroneSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Generate drone audio for a given duration
   * @param durationSeconds Total duration in seconds
   * @param foundationFreq Current foundation frequency (for root calculation)
   * @param progress Phase progress (0-1) for evolution
   */
  async generate(
    durationSeconds: number,
    foundationFreq: number,
    progress: number = 0,
    onProgress?: (progress: number) => void
  ): Promise<{ buffer: AudioBuffer; notes: MelodyNote[] }> {
    const numSamples = Math.ceil(durationSeconds * this.sampleRate);
    const buffer = new AudioBuffer({
      numberOfChannels: 2, // Stereo for width
      length: numSamples,
      sampleRate: this.sampleRate,
    });

    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    const notes: MelodyNote[] = [];

    // Calculate root frequency from foundation
    const rootFreq = foundationToMelodyRoot(foundationFreq);
    
    // Get available scale notes
    const scaleNotes = getScaleNotesInRange(
      rootFreq,
      this.config.scale,
      this.config.frequencyMin,
      this.config.frequencyMax
    );

    if (scaleNotes.length === 0) {
      return { buffer, notes };
    }

    // Select drone frequencies (root, fifth, octave typically)
    const droneFreqs = this.selectDroneFrequencies(scaleNotes, this.settings.voiceCount);
    
    // Track notes for visualization
    for (const freq of droneFreqs) {
      notes.push({
        time: 0,
        duration: durationSeconds,
        frequency: freq,
        velocity: this.config.intensity / droneFreqs.length,
        pan: 0,
      });
    }

    // Generate each voice
    const voices: { phase: number; freq: number; detune: number; pan: number }[] = [];
    
    for (let v = 0; v < droneFreqs.length; v++) {
      // Spread voices across stereo field
      const pan = this.config.stereoWidth * (v / (droneFreqs.length - 1) * 2 - 1) || 0;
      voices.push({
        phase: Math.random() * 2 * Math.PI,
        freq: droneFreqs[v],
        detune: (v - (droneFreqs.length - 1) / 2) * this.settings.detuneAmount,
        pan,
      });
    }

    // Generate audio sample by sample
    const twoPiOverSr = (2 * Math.PI) / this.sampleRate;
    const driftLfoPhases = voices.map(() => Math.random() * 2 * Math.PI);
    const filterLfoPhase = Math.random() * 2 * Math.PI;

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      const normalizedProgress = t / durationSeconds;
      
      // Amplitude envelope (fade in/out at boundaries)
      const fadeTime = 2; // seconds
      let envelope = 1;
      if (t < fadeTime) {
        envelope = t / fadeTime;
      } else if (t > durationSeconds - fadeTime) {
        envelope = (durationSeconds - t) / fadeTime;
      }
      envelope = Math.pow(envelope, 0.5); // Smooth curve

      let leftSample = 0;
      let rightSample = 0;

      // Sum all voices
      for (let v = 0; v < voices.length; v++) {
        const voice = voices[v];
        
        // Pitch drift LFO
        const driftLfo = Math.sin(driftLfoPhases[v] + twoPiOverSr * this.settings.driftSpeed * i);
        const driftCents = driftLfo * this.settings.driftAmount;
        const driftMultiplier = Math.pow(2, driftCents / 1200);
        
        // Calculate instantaneous frequency with detune and drift
        const detuneMultiplier = Math.pow(2, voice.detune / 1200);
        const instFreq = voice.freq * detuneMultiplier * driftMultiplier;
        
        // Generate sine wave
        const sample = Math.sin(voice.phase);
        voice.phase += twoPiOverSr * instFreq;
        
        // Keep phase in bounds
        if (voice.phase > 2 * Math.PI) {
          voice.phase -= 2 * Math.PI;
        }

        // Apply filter modulation (simple lowpass approximation using amplitude)
        const filterLfo = Math.sin(filterLfoPhase + twoPiOverSr * 0.03 * i);
        const filterMod = 0.8 + 0.2 * filterLfo; // Subtle brightness variation

        // Pan to stereo
        const amplitude = (this.config.intensity / voices.length) * envelope * filterMod;
        const leftGain = Math.cos((voice.pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((voice.pan + 1) * Math.PI / 4);
        
        leftSample += sample * amplitude * leftGain;
        rightSample += sample * amplitude * rightGain;
      }

      leftChannel[i] = leftSample;
      rightChannel[i] = rightSample;

      // Progress callback
      if (onProgress && i % 10000 === 0) {
        onProgress((i / numSamples) * 100);
      }
    }

    return { buffer, notes };
  }

  /**
   * Select frequencies for drone voices based on harmonic relationships
   */
  private selectDroneFrequencies(scaleNotes: number[], voiceCount: number): number[] {
    if (scaleNotes.length === 0) return [];
    if (scaleNotes.length <= voiceCount) return scaleNotes;

    const frequencies: number[] = [];
    const rootIndex = 0;
    
    // Always include root
    frequencies.push(scaleNotes[rootIndex]);

    // Try to find fifth (7 semitones up)
    const rootFreq = scaleNotes[rootIndex];
    const fifthTarget = rootFreq * Math.pow(2, 7 / 12);
    let closestFifth = this.findClosestNote(scaleNotes, fifthTarget);
    if (closestFifth && !frequencies.includes(closestFifth)) {
      frequencies.push(closestFifth);
    }

    // Try to find octave
    const octaveTarget = rootFreq * 2;
    let closestOctave = this.findClosestNote(scaleNotes, octaveTarget);
    if (closestOctave && !frequencies.includes(closestOctave)) {
      frequencies.push(closestOctave);
    }

    // Fill remaining voices with other scale notes
    while (frequencies.length < voiceCount && frequencies.length < scaleNotes.length) {
      for (const note of scaleNotes) {
        if (!frequencies.includes(note)) {
          frequencies.push(note);
          break;
        }
      }
    }

    return frequencies.slice(0, voiceCount);
  }

  /**
   * Find closest note in array to target frequency
   */
  private findClosestNote(notes: number[], target: number): number | null {
    if (notes.length === 0) return null;
    
    let closest = notes[0];
    let minDiff = Math.abs(notes[0] - target);
    
    for (const note of notes) {
      const diff = Math.abs(note - target);
      if (diff < minDiff) {
        minDiff = diff;
        closest = note;
      }
    }
    
    // Only return if reasonably close (within a major second)
    if (minDiff / target < 0.12) {
      return closest;
    }
    return null;
  }

  /**
   * Generate a single drone voice (for real-time use)
   */
  generateVoice(
    frequency: number,
    durationSamples: number,
    detuneCents: number = 0
  ): Float32Array {
    const output = new Float32Array(durationSamples);
    const twoPiOverSr = (2 * Math.PI) / this.sampleRate;
    const detuneMultiplier = Math.pow(2, detuneCents / 1200);
    const freq = frequency * detuneMultiplier;
    
    let phase = 0;
    let driftPhase = Math.random() * 2 * Math.PI;
    
    for (let i = 0; i < durationSamples; i++) {
      // Pitch drift
      const driftLfo = Math.sin(driftPhase);
      const driftMultiplier = Math.pow(2, (driftLfo * this.settings.driftAmount) / 1200);
      const instFreq = freq * driftMultiplier;
      
      output[i] = Math.sin(phase) * this.config.intensity;
      
      phase += twoPiOverSr * instFreq;
      driftPhase += twoPiOverSr * this.settings.driftSpeed;
      
      if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    }
    
    return output;
  }
}

// Export factory function
export function createDroneGenerator(
  config: MelodyGeneratorConfig,
  settings?: Partial<DroneSettings>,
  sampleRate?: number
): DroneGenerator {
  return new DroneGenerator({ config, settings }, sampleRate);
}
