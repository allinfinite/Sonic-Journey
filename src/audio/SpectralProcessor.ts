/**
 * SpectralProcessor - Frequency-dependent audio processing
 * Multi-band processing, dynamic EQ, harmonic enhancement
 */

import * as Tone from 'tone';

export interface BandConfig {
  enabled: boolean;
  gain: number;           // -12 to +12 dB
  compression: number;    // 0-1, amount of compression
  saturation: number;     // 0-1, harmonic enhancement
}

export interface SpectralProcessorSettings {
  // Band configuration (sub, bass, low-mid, high-mid, high, air)
  subBand: BandConfig;       // 20-60 Hz
  bassBand: BandConfig;      // 60-250 Hz
  lowMidBand: BandConfig;    // 250-1000 Hz
  highMidBand: BandConfig;   // 1000-4000 Hz
  highBand: BandConfig;      // 4000-12000 Hz
  airBand: BandConfig;       // 12000-20000 Hz
  
  // Dynamic EQ
  dynamicEQEnabled: boolean;
  dynamicEQThreshold: number;   // dB
  dynamicEQRatio: number;       // 1-10
  dynamicEQAttack: number;      // ms
  dynamicEQRelease: number;     // ms
  
  // Harmonic exciter
  exciterEnabled: boolean;
  exciterFrequency: number;     // Hz, above which to excite
  exciterAmount: number;        // 0-1
  exciterMix: number;           // 0-1
  
  // Spectral compression
  spectralCompressionEnabled: boolean;
  spectralCompressionAmount: number;  // 0-1
  
  // Output
  outputGain: number;           // 0-1
}

const DEFAULT_BAND: BandConfig = {
  enabled: true,
  gain: 0,
  compression: 0,
  saturation: 0,
};

const DEFAULT_SETTINGS: SpectralProcessorSettings = {
  subBand: { ...DEFAULT_BAND, gain: 2 },
  bassBand: { ...DEFAULT_BAND, gain: 1, saturation: 0.1 },
  lowMidBand: { ...DEFAULT_BAND },
  highMidBand: { ...DEFAULT_BAND, saturation: 0.05 },
  highBand: { ...DEFAULT_BAND, gain: 1 },
  airBand: { ...DEFAULT_BAND, gain: 2 },
  
  dynamicEQEnabled: false,
  dynamicEQThreshold: -20,
  dynamicEQRatio: 2,
  dynamicEQAttack: 10,
  dynamicEQRelease: 100,
  
  exciterEnabled: true,
  exciterFrequency: 3000,
  exciterAmount: 0.3,
  exciterMix: 0.2,
  
  spectralCompressionEnabled: false,
  spectralCompressionAmount: 0.3,
  
  outputGain: 0.9,
};

// Band frequency ranges
const BAND_FREQUENCIES = {
  sub: { low: 20, high: 60 },
  bass: { low: 60, high: 250 },
  lowMid: { low: 250, high: 1000 },
  highMid: { low: 1000, high: 4000 },
  high: { low: 4000, high: 12000 },
  air: { low: 12000, high: 20000 },
};

export class SpectralProcessor {
  private settings: SpectralProcessorSettings;
  private sampleRate: number;
  
  // Tone.js nodes
  private input: Tone.Gain | null = null;
  private output: Tone.Gain | null = null;
  
  // Band splitters and processors
  private bandFilters: Map<string, { low: Tone.Filter; high: Tone.Filter }> = new Map();
  private bandGains: Map<string, Tone.Gain> = new Map();
  private bandSaturators: Map<string, Tone.Distortion> = new Map();
  
  // Exciter
  private exciterFilter: Tone.Filter | null = null;
  private exciterDistortion: Tone.Distortion | null = null;
  private exciterGain: Tone.Gain | null = null;
  
  private isInitialized = false;

  constructor(sampleRate: number = 48000, settings?: Partial<SpectralProcessorSettings>) {
    this.sampleRate = sampleRate;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  /**
   * Initialize processing nodes
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(this.settings.outputGain);

    // Create band processors
    const bands: Array<{ name: string; config: BandConfig; freqs: { low: number; high: number } }> = [
      { name: 'sub', config: this.settings.subBand, freqs: BAND_FREQUENCIES.sub },
      { name: 'bass', config: this.settings.bassBand, freqs: BAND_FREQUENCIES.bass },
      { name: 'lowMid', config: this.settings.lowMidBand, freqs: BAND_FREQUENCIES.lowMid },
      { name: 'highMid', config: this.settings.highMidBand, freqs: BAND_FREQUENCIES.highMid },
      { name: 'high', config: this.settings.highBand, freqs: BAND_FREQUENCIES.high },
      { name: 'air', config: this.settings.airBand, freqs: BAND_FREQUENCIES.air },
    ];

    for (const band of bands) {
      // Bandpass filter using low and high pass
      const lowFilter = new Tone.Filter({
        type: 'highpass',
        frequency: band.freqs.low,
        Q: 0.7,
      });
      
      const highFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: band.freqs.high,
        Q: 0.7,
      });
      
      // Gain for this band
      const gainDb = band.config.gain;
      const gain = new Tone.Gain(Math.pow(10, gainDb / 20));
      
      // Saturation for this band
      const saturator = new Tone.Distortion({
        distortion: band.config.saturation * 0.3,
        oversample: '2x',
      });
      
      // Connect: input -> lowFilter -> highFilter -> saturator -> gain -> output
      this.input.connect(lowFilter);
      lowFilter.connect(highFilter);
      highFilter.connect(saturator);
      saturator.connect(gain);
      gain.connect(this.output);
      
      this.bandFilters.set(band.name, { low: lowFilter, high: highFilter });
      this.bandGains.set(band.name, gain);
      this.bandSaturators.set(band.name, saturator);
    }

    // Harmonic exciter
    if (this.settings.exciterEnabled) {
      this.exciterFilter = new Tone.Filter({
        type: 'highpass',
        frequency: this.settings.exciterFrequency,
        Q: 1,
      });
      
      this.exciterDistortion = new Tone.Distortion({
        distortion: this.settings.exciterAmount * 0.5,
        oversample: '4x',
      });
      
      this.exciterGain = new Tone.Gain(this.settings.exciterMix);
      
      this.input.connect(this.exciterFilter);
      this.exciterFilter.connect(this.exciterDistortion);
      this.exciterDistortion.connect(this.exciterGain);
      this.exciterGain.connect(this.output);
    }

    this.isInitialized = true;
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<SpectralProcessorSettings>): void {
    this.settings = { ...this.settings, ...settings };

    // Update band gains
    const bandConfigs: Array<{ name: string; config: BandConfig }> = [
      { name: 'sub', config: this.settings.subBand },
      { name: 'bass', config: this.settings.bassBand },
      { name: 'lowMid', config: this.settings.lowMidBand },
      { name: 'highMid', config: this.settings.highMidBand },
      { name: 'high', config: this.settings.highBand },
      { name: 'air', config: this.settings.airBand },
    ];

    for (const band of bandConfigs) {
      const gain = this.bandGains.get(band.name);
      if (gain) {
        const gainLinear = Math.pow(10, band.config.gain / 20);
        gain.gain.rampTo(gainLinear, 0.1);
      }
      
      const saturator = this.bandSaturators.get(band.name);
      if (saturator) {
        saturator.distortion = band.config.saturation * 0.3;
      }
    }

    // Update exciter
    if (this.exciterFilter && settings.exciterFrequency !== undefined) {
      this.exciterFilter.frequency.rampTo(settings.exciterFrequency, 0.1);
    }
    if (this.exciterDistortion && settings.exciterAmount !== undefined) {
      this.exciterDistortion.distortion = settings.exciterAmount * 0.5;
    }
    if (this.exciterGain && settings.exciterMix !== undefined) {
      this.exciterGain.gain.rampTo(settings.exciterMix, 0.1);
    }

    // Update output
    if (this.output && settings.outputGain !== undefined) {
      this.output.gain.rampTo(settings.outputGain, 0.1);
    }
  }

  /**
   * Connect input
   */
  connectInput(source: Tone.ToneAudioNode): void {
    source.connect(this.input!);
  }

  /**
   * Connect to destination
   */
  connect(destination: Tone.ToneAudioNode): void {
    this.output?.connect(destination);
  }

  /**
   * Get input node
   */
  getInput(): Tone.Gain | null {
    return this.input;
  }

  /**
   * Get output node
   */
  getOutput(): Tone.Gain | null {
    return this.output;
  }

  /**
   * Process audio offline
   */
  processOffline(input: Float32Array): Float32Array {
    const output = new Float32Array(input.length);
    
    // Band filter states
    const bandStates = new Map<string, { y1: number; y2: number; x1: number; x2: number }>();
    for (const name of ['sub', 'bass', 'lowMid', 'highMid', 'high', 'air']) {
      bandStates.set(name, { y1: 0, y2: 0, x1: 0, x2: 0 });
    }
    
    // Exciter state
    let exciterY1 = 0;
    let exciterY2 = 0;
    
    for (let i = 0; i < input.length; i++) {
      const sample = input[i];
      let outputSample = 0;
      
      // Process each band
      const bands: Array<{ name: string; config: BandConfig; freqs: { low: number; high: number } }> = [
        { name: 'sub', config: this.settings.subBand, freqs: BAND_FREQUENCIES.sub },
        { name: 'bass', config: this.settings.bassBand, freqs: BAND_FREQUENCIES.bass },
        { name: 'lowMid', config: this.settings.lowMidBand, freqs: BAND_FREQUENCIES.lowMid },
        { name: 'highMid', config: this.settings.highMidBand, freqs: BAND_FREQUENCIES.highMid },
        { name: 'high', config: this.settings.highBand, freqs: BAND_FREQUENCIES.high },
        { name: 'air', config: this.settings.airBand, freqs: BAND_FREQUENCIES.air },
      ];
      
      for (const band of bands) {
        if (!band.config.enabled) continue;
        
        const state = bandStates.get(band.name)!;
        
        // Simple bandpass using biquad approximation
        const centerFreq = Math.sqrt(band.freqs.low * band.freqs.high);
        const Q = centerFreq / (band.freqs.high - band.freqs.low);
        
        const omega = (2 * Math.PI * centerFreq) / this.sampleRate;
        const alpha = Math.sin(omega) / (2 * Q);
        
        const b0 = alpha;
        const b1 = 0;
        const b2 = -alpha;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(omega);
        const a2 = 1 - alpha;
        
        // Apply biquad filter
        let filteredSample = (b0 / a0) * sample + 
                            (b1 / a0) * state.x1 + 
                            (b2 / a0) * state.x2 -
                            (a1 / a0) * state.y1 - 
                            (a2 / a0) * state.y2;
        
        state.x2 = state.x1;
        state.x1 = sample;
        state.y2 = state.y1;
        state.y1 = filteredSample;
        
        // Apply saturation
        if (band.config.saturation > 0) {
          const drive = 1 + band.config.saturation * 3;
          filteredSample = Math.tanh(filteredSample * drive) / Math.tanh(drive);
        }
        
        // Apply gain
        const gainLinear = Math.pow(10, band.config.gain / 20);
        filteredSample *= gainLinear;
        
        outputSample += filteredSample;
      }
      
      // Harmonic exciter
      if (this.settings.exciterEnabled) {
        // Simple highpass for exciter
        const cutoff = this.settings.exciterFrequency;
        const omega = (2 * Math.PI * cutoff) / this.sampleRate;
        const alpha = Math.sin(omega) / 2;
        
        const b0 = (1 + Math.cos(omega)) / 2;
        // b1 = -(1 + Math.cos(omega)), b2 = b0 - used in full IIR implementation
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(omega);
        const a2 = 1 - alpha;
        
        // Simplified highpass: just use b0 coefficient for basic filtering
        let exciterSample = (b0 / a0) * sample - (a1 / a0) * exciterY1 - (a2 / a0) * exciterY2;
        exciterY2 = exciterY1;
        exciterY1 = exciterSample;
        
        // Apply distortion for harmonics
        const drive = 1 + this.settings.exciterAmount * 5;
        exciterSample = Math.tanh(exciterSample * drive);
        
        outputSample += exciterSample * this.settings.exciterMix;
      }
      
      // Spectral compression (simple limiter per-sample)
      if (this.settings.spectralCompressionEnabled) {
        const threshold = 0.5;
        if (Math.abs(outputSample) > threshold) {
          const excess = Math.abs(outputSample) - threshold;
          const compressed = threshold + excess * (1 - this.settings.spectralCompressionAmount);
          outputSample = Math.sign(outputSample) * compressed;
        }
      }
      
      output[i] = outputSample * this.settings.outputGain;
    }
    
    return output;
  }

  /**
   * Dispose all nodes
   */
  dispose(): void {
    for (const [, filters] of this.bandFilters) {
      filters.low.dispose();
      filters.high.dispose();
    }
    for (const gain of this.bandGains.values()) {
      gain.dispose();
    }
    for (const saturator of this.bandSaturators.values()) {
      saturator.dispose();
    }
    
    this.exciterFilter?.dispose();
    this.exciterDistortion?.dispose();
    this.exciterGain?.dispose();
    this.input?.dispose();
    this.output?.dispose();
    
    this.bandFilters.clear();
    this.bandGains.clear();
    this.bandSaturators.clear();
    this.isInitialized = false;
  }
}

// Factory function
export function createSpectralProcessor(
  sampleRate?: number,
  settings?: Partial<SpectralProcessorSettings>
): SpectralProcessor {
  return new SpectralProcessor(sampleRate, settings);
}

// Preset configurations
export const SPECTRAL_PRESETS = {
  warm: {
    subBand: { enabled: true, gain: 3, compression: 0, saturation: 0.1 },
    bassBand: { enabled: true, gain: 2, compression: 0.1, saturation: 0.15 },
    lowMidBand: { enabled: true, gain: 0, compression: 0, saturation: 0.05 },
    highMidBand: { enabled: true, gain: -1, compression: 0, saturation: 0 },
    highBand: { enabled: true, gain: -2, compression: 0, saturation: 0 },
    airBand: { enabled: true, gain: 0, compression: 0, saturation: 0 },
    exciterEnabled: false,
  },
  bright: {
    subBand: { enabled: true, gain: 0, compression: 0, saturation: 0 },
    bassBand: { enabled: true, gain: 0, compression: 0, saturation: 0 },
    lowMidBand: { enabled: true, gain: 0, compression: 0, saturation: 0 },
    highMidBand: { enabled: true, gain: 2, compression: 0, saturation: 0.1 },
    highBand: { enabled: true, gain: 3, compression: 0, saturation: 0.05 },
    airBand: { enabled: true, gain: 4, compression: 0, saturation: 0 },
    exciterEnabled: true,
    exciterAmount: 0.4,
  },
  therapeutic: {
    subBand: { enabled: true, gain: 2, compression: 0.1, saturation: 0.1 },
    bassBand: { enabled: true, gain: 1, compression: 0.1, saturation: 0.1 },
    lowMidBand: { enabled: true, gain: 0, compression: 0.05, saturation: 0.05 },
    highMidBand: { enabled: true, gain: 0, compression: 0, saturation: 0 },
    highBand: { enabled: true, gain: 1, compression: 0, saturation: 0 },
    airBand: { enabled: true, gain: 2, compression: 0, saturation: 0 },
    exciterEnabled: true,
    exciterAmount: 0.25,
    exciterFrequency: 4000,
  },
  psychedelic: {
    subBand: { enabled: true, gain: 3, compression: 0.2, saturation: 0.2 },
    bassBand: { enabled: true, gain: 2, compression: 0.15, saturation: 0.15 },
    lowMidBand: { enabled: true, gain: 1, compression: 0.1, saturation: 0.1 },
    highMidBand: { enabled: true, gain: 2, compression: 0.1, saturation: 0.15 },
    highBand: { enabled: true, gain: 3, compression: 0.1, saturation: 0.1 },
    airBand: { enabled: true, gain: 4, compression: 0, saturation: 0.05 },
    exciterEnabled: true,
    exciterAmount: 0.5,
    exciterFrequency: 3000,
  },
};
