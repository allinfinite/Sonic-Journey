/**
 * TimbreEvolver - Dynamic timbre evolution through wavetable morphing
 * Creates evolving, organic timbres that change over time
 */

export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'pulse' | 'organ' | 'vocal' | 'bell';

export interface TimbreEvolverSettings {
  // Waveform morphing
  waveformA: WaveformType;
  waveformB: WaveformType;
  morphPosition: number;         // 0-1 (A to B blend)
  morphRate: number;             // 0-1 Hz, auto-morph rate (0 = manual)
  morphDepth: number;            // 0-1, how much auto-morph varies
  
  // Harmonic content
  fundamentalLevel: number;      // 0-1
  harmonicSpread: number;        // 0-1, how spread out harmonics are
  evenOddBalance: number;        // -1 to 1 (-1 = odd only, 1 = even only)
  harmonicDecay: number;         // 0-1, falloff rate
  
  // Spectral evolution
  spectralShift: number;         // -1 to 1, shift harmonic emphasis
  spectralWidth: number;         // 0-1, bandwidth of resonance
  formantFreq: number;           // 200-4000 Hz, formant frequency
  formantWidth: number;          // 0-1, formant bandwidth
  formantEnabled: boolean;
  
  // Time evolution
  evolutionRate: number;         // 0-1, overall change speed
  evolutionDepth: number;        // 0-1, amount of change
  randomness: number;            // 0-1, random variation
  
  // Output
  outputLevel: number;           // 0-1
}

const DEFAULT_SETTINGS: TimbreEvolverSettings = {
  waveformA: 'sine',
  waveformB: 'triangle',
  morphPosition: 0,
  morphRate: 0.05,
  morphDepth: 0.5,
  
  fundamentalLevel: 1,
  harmonicSpread: 0.5,
  evenOddBalance: 0,
  harmonicDecay: 0.5,
  
  spectralShift: 0,
  spectralWidth: 0.5,
  formantFreq: 800,
  formantWidth: 0.3,
  formantEnabled: false,
  
  evolutionRate: 0.1,
  evolutionDepth: 0.4,
  randomness: 0.1,
  
  outputLevel: 0.8,
};

// Wavetable definitions (single-cycle waveforms, 2048 samples)
const WAVETABLE_SIZE = 2048;

export class TimbreEvolver {
  private settings: TimbreEvolverSettings;
  private sampleRate: number;
  
  // Wavetables
  private wavetables: Map<WaveformType, Float32Array> = new Map();
  private morphedWavetable: Float32Array;
  
  // Phase tracking
  private phase = 0;
  private morphPhase = 0;
  private evolutionPhase = 0;
  
  // Random state
  private randomSeed = Math.random();
  private noiseValue = 0;

  constructor(sampleRate: number = 48000, settings?: Partial<TimbreEvolverSettings>) {
    this.sampleRate = sampleRate;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.morphedWavetable = new Float32Array(WAVETABLE_SIZE);
    
    this.generateWavetables();
    this.updateMorphedWavetable();
  }

  /**
   * Generate all wavetables
   */
  private generateWavetables(): void {
    const twoPi = 2 * Math.PI;

    // Sine
    const sine = new Float32Array(WAVETABLE_SIZE);
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      sine[i] = Math.sin((i / WAVETABLE_SIZE) * twoPi);
    }
    this.wavetables.set('sine', sine);

    // Triangle
    const triangle = new Float32Array(WAVETABLE_SIZE);
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      const t = i / WAVETABLE_SIZE;
      triangle[i] = 4 * Math.abs(t - 0.5) - 1;
    }
    this.wavetables.set('triangle', triangle);

    // Sawtooth
    const sawtooth = new Float32Array(WAVETABLE_SIZE);
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      sawtooth[i] = 2 * (i / WAVETABLE_SIZE) - 1;
    }
    this.wavetables.set('sawtooth', sawtooth);

    // Square
    const square = new Float32Array(WAVETABLE_SIZE);
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      square[i] = i < WAVETABLE_SIZE / 2 ? 1 : -1;
    }
    this.wavetables.set('square', square);

    // Pulse (25% duty cycle)
    const pulse = new Float32Array(WAVETABLE_SIZE);
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      pulse[i] = i < WAVETABLE_SIZE / 4 ? 1 : -1;
    }
    this.wavetables.set('pulse', pulse);

    // Organ (additive: fundamental + 2nd + 3rd harmonics)
    const organ = new Float32Array(WAVETABLE_SIZE);
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      const phase = (i / WAVETABLE_SIZE) * twoPi;
      organ[i] = Math.sin(phase) * 0.6 + 
                 Math.sin(phase * 2) * 0.25 + 
                 Math.sin(phase * 3) * 0.15;
    }
    this.wavetables.set('organ', organ);

    // Vocal-like (formant approximation)
    const vocal = new Float32Array(WAVETABLE_SIZE);
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      const phase = (i / WAVETABLE_SIZE) * twoPi;
      vocal[i] = Math.sin(phase) * 0.5 + 
                 Math.sin(phase * 2) * 0.3 * Math.sin(phase * 0.5) +
                 Math.sin(phase * 3) * 0.2 * Math.cos(phase * 0.3);
    }
    this.wavetables.set('vocal', vocal);

    // Bell (inharmonic partials)
    const bell = new Float32Array(WAVETABLE_SIZE);
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      const phase = (i / WAVETABLE_SIZE) * twoPi;
      bell[i] = Math.sin(phase) * 0.4 + 
                Math.sin(phase * 2.4) * 0.3 + 
                Math.sin(phase * 5.95) * 0.2 +
                Math.sin(phase * 8.5) * 0.1;
    }
    this.wavetables.set('bell', bell);
  }

  /**
   * Update the morphed wavetable based on current settings
   */
  private updateMorphedWavetable(): void {
    const tableA = this.wavetables.get(this.settings.waveformA);
    const tableB = this.wavetables.get(this.settings.waveformB);
    
    if (!tableA || !tableB) return;
    
    const mix = this.settings.morphPosition;
    
    for (let i = 0; i < WAVETABLE_SIZE; i++) {
      this.morphedWavetable[i] = tableA[i] * (1 - mix) + tableB[i] * mix;
    }
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<TimbreEvolverSettings>): void {
    const needsWavetableUpdate = 
      settings.waveformA !== undefined || 
      settings.waveformB !== undefined || 
      settings.morphPosition !== undefined;
    
    this.settings = { ...this.settings, ...settings };
    
    if (needsWavetableUpdate) {
      this.updateMorphedWavetable();
    }
  }

  /**
   * Generate a single sample at the given frequency
   */
  generateSample(frequency: number, time: number): number {
    const twoPi = 2 * Math.PI;
    
    // Update morph position if auto-morphing
    if (this.settings.morphRate > 0) {
      this.morphPhase += (twoPi * this.settings.morphRate) / this.sampleRate;
      if (this.morphPhase > twoPi) this.morphPhase -= twoPi;
      
      const autoMorph = (Math.sin(this.morphPhase) + 1) * 0.5 * this.settings.morphDepth;
      this.settings.morphPosition = autoMorph;
      this.updateMorphedWavetable();
    }
    
    // Update evolution
    this.evolutionPhase += (twoPi * this.settings.evolutionRate * 0.1) / this.sampleRate;
    if (this.evolutionPhase > twoPi) this.evolutionPhase -= twoPi;
    
    // Randomness
    if (Math.random() < this.settings.randomness * 0.01) {
      this.noiseValue = (Math.random() * 2 - 1) * this.settings.randomness;
    }
    
    // Phase increment
    const phaseIncrement = frequency / this.sampleRate;
    this.phase += phaseIncrement;
    if (this.phase >= 1) this.phase -= 1;
    
    // Read from wavetable with linear interpolation
    const tableIndex = this.phase * WAVETABLE_SIZE;
    const index0 = Math.floor(tableIndex);
    const index1 = (index0 + 1) % WAVETABLE_SIZE;
    const frac = tableIndex - index0;
    
    let sample = this.morphedWavetable[index0] * (1 - frac) + 
                 this.morphedWavetable[index1] * frac;
    
    // Apply harmonic adjustments
    sample *= this.settings.fundamentalLevel;
    
    // Apply spectral evolution
    const evolutionMod = Math.sin(this.evolutionPhase) * this.settings.evolutionDepth;
    sample *= (1 + evolutionMod * 0.3);
    
    // Apply formant if enabled
    if (this.settings.formantEnabled) {
      const formantPhase = time * this.settings.formantFreq * twoPi;
      const formantEnv = Math.exp(-Math.pow((frequency - this.settings.formantFreq) / 
                                            (this.settings.formantWidth * 1000), 2));
      sample += Math.sin(formantPhase) * formantEnv * 0.2;
    }
    
    // Add randomness
    sample += this.noiseValue * 0.05;
    
    return sample * this.settings.outputLevel;
  }

  /**
   * Generate audio buffer offline
   */
  generateOffline(
    durationSamples: number,
    frequencyStart: number,
    frequencyEnd: number
  ): Float32Array {
    const output = new Float32Array(durationSamples);
    const twoPi = 2 * Math.PI;
    
    // Reset phases
    this.phase = 0;
    this.morphPhase = 0;
    this.evolutionPhase = 0;
    
    for (let i = 0; i < durationSamples; i++) {
      const t = i / (durationSamples - 1);
      const time = i / this.sampleRate;
      
      // Interpolate frequency
      const frequency = frequencyStart + (frequencyEnd - frequencyStart) * t;
      
      // Auto-morph
      if (this.settings.morphRate > 0) {
        this.morphPhase += (twoPi * this.settings.morphRate) / this.sampleRate;
        if (this.morphPhase > twoPi) this.morphPhase -= twoPi;
        
        const autoMorph = (Math.sin(this.morphPhase) + 1) * 0.5 * this.settings.morphDepth;
        const currentMorph = autoMorph;
        
        // Efficient wavetable morphing (only update periodically)
        if (i % 1024 === 0) {
          this.settings.morphPosition = currentMorph;
          this.updateMorphedWavetable();
        }
      }
      
      // Evolution
      this.evolutionPhase += (twoPi * this.settings.evolutionRate * 0.1) / this.sampleRate;
      if (this.evolutionPhase > twoPi) this.evolutionPhase -= twoPi;
      
      // Update noise value occasionally
      if (i % Math.floor(this.sampleRate * 0.1) === 0) {
        this.noiseValue = (this.seededRandom() * 2 - 1) * this.settings.randomness;
      }
      
      // Phase increment
      const phaseIncrement = frequency / this.sampleRate;
      this.phase += phaseIncrement;
      if (this.phase >= 1) this.phase -= 1;
      
      // Read from wavetable
      const tableIndex = this.phase * WAVETABLE_SIZE;
      const index0 = Math.floor(tableIndex);
      const index1 = (index0 + 1) % WAVETABLE_SIZE;
      const frac = tableIndex - index0;
      
      let sample = this.morphedWavetable[index0] * (1 - frac) + 
                   this.morphedWavetable[index1] * frac;
      
      // Apply harmonic adjustments
      sample *= this.settings.fundamentalLevel;
      
      // Apply even/odd balance (simple approximation)
      if (this.settings.evenOddBalance !== 0) {
        const evenComponent = Math.sin(this.phase * twoPi * 2);
        const oddComponent = Math.sin(this.phase * twoPi * 3);
        sample += evenComponent * this.settings.evenOddBalance * 0.1;
        sample -= oddComponent * this.settings.evenOddBalance * 0.05;
      }
      
      // Spectral evolution
      const evolutionMod = Math.sin(this.evolutionPhase) * this.settings.evolutionDepth;
      sample *= (1 + evolutionMod * 0.3);
      
      // Spectral shift (simple filter-like effect)
      if (this.settings.spectralShift !== 0) {
        const shift = this.settings.spectralShift;
        // Positive shift = brighter, negative = darker
        if (shift > 0) {
          sample = sample * (1 - shift * 0.3) + sample * Math.sin(this.phase * twoPi * 4) * shift * 0.2;
        } else {
          sample = sample * (1 + shift * 0.3);
        }
      }
      
      // Formant
      if (this.settings.formantEnabled) {
        const formantPhase = time * this.settings.formantFreq * twoPi;
        const formantEnv = Math.exp(-Math.pow((frequency - this.settings.formantFreq) / 
                                              (this.settings.formantWidth * 1000 + 100), 2));
        sample += Math.sin(formantPhase) * formantEnv * 0.2;
      }
      
      // Randomness
      sample += this.noiseValue * 0.05;
      
      output[i] = sample * this.settings.outputLevel;
    }
    
    return output;
  }

  /**
   * Seeded random for reproducibility
   */
  private seededRandom(): number {
    this.randomSeed = (this.randomSeed * 9301 + 49297) % 233280;
    return this.randomSeed / 233280;
  }

  /**
   * Get current morph position
   */
  getMorphPosition(): number {
    return this.settings.morphPosition;
  }

  /**
   * Set morph position manually
   */
  setMorphPosition(position: number): void {
    this.settings.morphPosition = Math.max(0, Math.min(1, position));
    this.updateMorphedWavetable();
  }

  /**
   * Reset all phases
   */
  reset(): void {
    this.phase = 0;
    this.morphPhase = 0;
    this.evolutionPhase = 0;
    this.randomSeed = Math.random();
  }
}

// Factory function
export function createTimbreEvolver(
  sampleRate?: number,
  settings?: Partial<TimbreEvolverSettings>
): TimbreEvolver {
  return new TimbreEvolver(sampleRate, settings);
}

// Preset configurations
export const TIMBRE_PRESETS = {
  organic: {
    waveformA: 'sine' as WaveformType,
    waveformB: 'triangle' as WaveformType,
    morphRate: 0.03,
    morphDepth: 0.6,
    evolutionRate: 0.08,
    evolutionDepth: 0.4,
    randomness: 0.15,
  },
  crystalline: {
    waveformA: 'sine' as WaveformType,
    waveformB: 'bell' as WaveformType,
    morphRate: 0.05,
    morphDepth: 0.4,
    harmonicSpread: 0.7,
    evolutionRate: 0.12,
    evolutionDepth: 0.3,
  },
  warm: {
    waveformA: 'triangle' as WaveformType,
    waveformB: 'organ' as WaveformType,
    morphRate: 0.02,
    morphDepth: 0.5,
    evenOddBalance: -0.3,
    harmonicDecay: 0.6,
  },
  ethereal: {
    waveformA: 'sine' as WaveformType,
    waveformB: 'vocal' as WaveformType,
    morphRate: 0.04,
    morphDepth: 0.7,
    formantEnabled: true,
    formantFreq: 600,
    formantWidth: 0.4,
    evolutionRate: 0.1,
  },
  psychedelic: {
    waveformA: 'sawtooth' as WaveformType,
    waveformB: 'pulse' as WaveformType,
    morphRate: 0.08,
    morphDepth: 0.8,
    spectralShift: 0.3,
    evolutionRate: 0.15,
    evolutionDepth: 0.6,
    randomness: 0.2,
  },
};
