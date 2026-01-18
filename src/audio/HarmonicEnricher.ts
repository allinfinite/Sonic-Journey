/**
 * HarmonicEnricher - Adds harmonic content to foundation/harmony layers
 * Creates rich, warm timbres through additive synthesis and saturation
 */

import * as Tone from 'tone';

export interface HarmonicEnricherSettings {
  // Harmonic content
  harmonicCount: number;           // 2-8 harmonics
  evenHarmonicLevel: number;       // 0-1, emphasis on even harmonics (2nd, 4th, 6th)
  oddHarmonicLevel: number;        // 0-1, emphasis on odd harmonics (3rd, 5th, 7th)
  harmonicDecay: number;           // 0-1, how quickly higher harmonics fall off
  
  // Warmth and saturation
  warmth: number;                  // 0-1, gentle saturation amount
  subHarmonicLevel: number;        // 0-1, octave-below sub-bass
  
  // Dynamic evolution
  evolutionRate: number;           // 0-1, how fast harmonics evolve
  evolutionDepth: number;          // 0-1, how much harmonics change
  
  // Output
  dryWet: number;                  // 0-1, blend with original
}

const DEFAULT_SETTINGS: HarmonicEnricherSettings = {
  harmonicCount: 4,
  evenHarmonicLevel: 0.5,
  oddHarmonicLevel: 0.7,
  harmonicDecay: 0.6,
  warmth: 0.3,
  subHarmonicLevel: 0.2,
  evolutionRate: 0.1,
  evolutionDepth: 0.3,
  dryWet: 0.5,
};

export class HarmonicEnricher {
  private settings: HarmonicEnricherSettings;
  private sampleRate: number;
  
  // Tone.js nodes for real-time
  private harmonicOscillators: Tone.Oscillator[] = [];
  private subOscillator: Tone.Oscillator | null = null;
  private harmonicGains: Tone.Gain[] = [];
  private subGain: Tone.Gain | null = null;
  private saturator: Tone.Distortion | null = null;
  private dryGain: Tone.Gain | null = null;
  private wetGain: Tone.Gain | null = null;
  private output: Tone.Gain | null = null;
  private evolutionLFO: Tone.LFO | null = null;
  
  private isInitialized = false;
  private currentFrequency = 40;

  constructor(sampleRate: number = 48000, settings?: Partial<HarmonicEnricherSettings>) {
    this.sampleRate = sampleRate;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  /**
   * Initialize Tone.js nodes for real-time processing
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Output mixer
    this.output = new Tone.Gain(1);
    this.dryGain = new Tone.Gain(1 - this.settings.dryWet).connect(this.output);
    this.wetGain = new Tone.Gain(this.settings.dryWet).connect(this.output);

    // Saturator for warmth
    this.saturator = new Tone.Distortion({
      distortion: this.settings.warmth * 0.3,
      oversample: '2x',
    }).connect(this.wetGain);

    // Sub-harmonic oscillator (octave below)
    this.subOscillator = new Tone.Oscillator({
      type: 'sine',
      frequency: this.currentFrequency / 2,
    });
    this.subGain = new Tone.Gain(this.settings.subHarmonicLevel * 0.3);
    this.subOscillator.connect(this.subGain);
    this.subGain.connect(this.saturator);

    // Harmonic oscillators
    for (let i = 2; i <= this.settings.harmonicCount + 1; i++) {
      const isEven = i % 2 === 0;
      const baseLevel = isEven ? this.settings.evenHarmonicLevel : this.settings.oddHarmonicLevel;
      const decayFactor = Math.pow(1 - this.settings.harmonicDecay, i - 1);
      const amplitude = baseLevel * decayFactor * 0.15;

      const osc = new Tone.Oscillator({
        type: 'sine',
        frequency: this.currentFrequency * i,
      });
      
      const gain = new Tone.Gain(amplitude);
      osc.connect(gain);
      gain.connect(this.saturator);
      
      this.harmonicOscillators.push(osc);
      this.harmonicGains.push(gain);
    }

    // Evolution LFO (modulates harmonic levels)
    this.evolutionLFO = new Tone.LFO({
      frequency: this.settings.evolutionRate * 0.1,
      min: 1 - this.settings.evolutionDepth,
      max: 1 + this.settings.evolutionDepth * 0.5,
      type: 'sine',
    });
    
    // Connect LFO to harmonic gains
    for (const gain of this.harmonicGains) {
      this.evolutionLFO.connect(gain.gain);
    }

    this.isInitialized = true;
  }

  /**
   * Start all oscillators
   */
  start(): void {
    if (!this.isInitialized) return;
    
    this.subOscillator?.start();
    for (const osc of this.harmonicOscillators) {
      osc.start();
    }
    this.evolutionLFO?.start();
  }

  /**
   * Stop all oscillators
   */
  stop(): void {
    this.subOscillator?.stop();
    for (const osc of this.harmonicOscillators) {
      osc.stop();
    }
    this.evolutionLFO?.stop();
  }

  /**
   * Set the fundamental frequency
   */
  setFrequency(freq: number, rampTime: number = 0.1): void {
    this.currentFrequency = freq;
    
    if (this.subOscillator) {
      this.subOscillator.frequency.rampTo(freq / 2, rampTime);
    }
    
    for (let i = 0; i < this.harmonicOscillators.length; i++) {
      const harmonicNumber = i + 2;
      this.harmonicOscillators[i].frequency.rampTo(freq * harmonicNumber, rampTime);
    }
  }

  /**
   * Update settings in real-time
   */
  updateSettings(settings: Partial<HarmonicEnricherSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    if (this.saturator && settings.warmth !== undefined) {
      this.saturator.distortion = settings.warmth * 0.3;
    }
    
    if (this.subGain && settings.subHarmonicLevel !== undefined) {
      this.subGain.gain.rampTo(settings.subHarmonicLevel * 0.3, 0.1);
    }
    
    if (this.dryGain && this.wetGain && settings.dryWet !== undefined) {
      this.dryGain.gain.rampTo(1 - settings.dryWet, 0.1);
      this.wetGain.gain.rampTo(settings.dryWet, 0.1);
    }
    
    if (this.evolutionLFO) {
      if (settings.evolutionRate !== undefined) {
        this.evolutionLFO.frequency.value = settings.evolutionRate * 0.1;
      }
      if (settings.evolutionDepth !== undefined) {
        this.evolutionLFO.min = 1 - settings.evolutionDepth;
        this.evolutionLFO.max = 1 + settings.evolutionDepth * 0.5;
      }
    }
    
    // Update harmonic levels
    if (settings.evenHarmonicLevel !== undefined || 
        settings.oddHarmonicLevel !== undefined || 
        settings.harmonicDecay !== undefined) {
      this.updateHarmonicLevels();
    }
  }

  private updateHarmonicLevels(): void {
    for (let i = 0; i < this.harmonicGains.length; i++) {
      const harmonicNumber = i + 2;
      const isEven = harmonicNumber % 2 === 0;
      const baseLevel = isEven ? this.settings.evenHarmonicLevel : this.settings.oddHarmonicLevel;
      const decayFactor = Math.pow(1 - this.settings.harmonicDecay, harmonicNumber - 1);
      const amplitude = baseLevel * decayFactor * 0.15;
      this.harmonicGains[i].gain.rampTo(amplitude, 0.1);
    }
  }

  /**
   * Connect to an audio destination
   */
  connect(destination: Tone.ToneAudioNode): void {
    this.output?.connect(destination);
  }

  /**
   * Connect input audio to be enriched
   */
  connectInput(source: Tone.ToneAudioNode): void {
    source.connect(this.dryGain!);
    source.connect(this.saturator!);
  }

  /**
   * Disconnect all
   */
  disconnect(): void {
    this.output?.disconnect();
  }

  /**
   * Dispose of all nodes
   */
  dispose(): void {
    this.stop();
    this.subOscillator?.dispose();
    this.subGain?.dispose();
    for (const osc of this.harmonicOscillators) {
      osc.dispose();
    }
    for (const gain of this.harmonicGains) {
      gain.dispose();
    }
    this.saturator?.dispose();
    this.dryGain?.dispose();
    this.wetGain?.dispose();
    this.output?.dispose();
    this.evolutionLFO?.dispose();
    
    this.harmonicOscillators = [];
    this.harmonicGains = [];
    this.isInitialized = false;
  }

  /**
   * Generate harmonically enriched audio offline (for export)
   */
  processOffline(
    input: Float32Array,
    fundamentalFreqStart: number,
    fundamentalFreqEnd: number
  ): Float32Array {
    const output = new Float32Array(input.length);
    const twoPi = 2 * Math.PI;
    const phases: number[] = new Array(this.settings.harmonicCount + 1).fill(0);
    let subPhase = 0;
    
    for (let i = 0; i < input.length; i++) {
      const t = i / (input.length - 1);
      const freq = fundamentalFreqStart + (fundamentalFreqEnd - fundamentalFreqStart) * t;
      const timeSeconds = i / this.sampleRate;
      
      // Evolution modulation
      const evolutionMod = 1 + Math.sin(twoPi * this.settings.evolutionRate * 0.1 * timeSeconds) 
                          * this.settings.evolutionDepth * 0.5;
      
      // Dry signal
      let sample = input[i] * (1 - this.settings.dryWet);
      
      // Sub-harmonic (octave below)
      const subFreq = freq / 2;
      subPhase += (twoPi * subFreq) / this.sampleRate;
      if (subPhase > twoPi) subPhase -= twoPi;
      const subSample = Math.sin(subPhase) * this.settings.subHarmonicLevel * 0.3;
      
      // Harmonics
      let harmonicSum = 0;
      for (let h = 0; h < this.settings.harmonicCount; h++) {
        const harmonicNumber = h + 2;
        const isEven = harmonicNumber % 2 === 0;
        const baseLevel = isEven ? this.settings.evenHarmonicLevel : this.settings.oddHarmonicLevel;
        const decayFactor = Math.pow(1 - this.settings.harmonicDecay, h);
        const amplitude = baseLevel * decayFactor * 0.15 * evolutionMod;
        
        const harmonicFreq = freq * harmonicNumber;
        phases[h] += (twoPi * harmonicFreq) / this.sampleRate;
        if (phases[h] > twoPi) phases[h] -= twoPi;
        
        harmonicSum += Math.sin(phases[h]) * amplitude;
      }
      
      // Mix wet signal
      let wetSample = (input[i] + subSample + harmonicSum);
      
      // Apply warmth (soft saturation)
      if (this.settings.warmth > 0) {
        const drive = 1 + this.settings.warmth * 2;
        wetSample = Math.tanh(wetSample * drive) / drive;
      }
      
      sample += wetSample * this.settings.dryWet;
      output[i] = sample;
    }
    
    return output;
  }

  /**
   * Get the output node for connecting
   */
  getOutput(): Tone.Gain | null {
    return this.output;
  }
}

// Factory function
export function createHarmonicEnricher(
  sampleRate?: number,
  settings?: Partial<HarmonicEnricherSettings>
): HarmonicEnricher {
  return new HarmonicEnricher(sampleRate, settings);
}
