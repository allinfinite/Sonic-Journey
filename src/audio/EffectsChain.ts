/**
 * EffectsChain - Comprehensive audio effects processor using Tone.js
 * Provides psychedelic/therapeutic effects: phaser, flanger, filters, saturation
 */

import * as Tone from 'tone';

export interface EffectsChainSettings {
  // Phaser
  phaserEnabled: boolean;
  phaserRate: number;        // 0.1-5 Hz
  phaserDepth: number;       // 0-1
  phaserBaseFrequency: number; // 200-2000 Hz
  phaserStages: number;      // 4-12 stages
  
  // Flanger  
  flangerEnabled: boolean;
  flangerRate: number;       // 0.1-2 Hz
  flangerDepth: number;      // 0-1
  flangerFeedback: number;   // 0-0.9
  
  // Filter
  filterEnabled: boolean;
  filterType: 'lowpass' | 'highpass' | 'bandpass';
  filterCutoff: number;      // Hz
  filterResonance: number;   // 0-20
  filterLfoRate: number;     // 0-1 Hz (0 = no modulation)
  filterLfoDepth: number;    // 0-1
  
  // Saturation/Warmth
  saturationEnabled: boolean;
  saturationAmount: number;  // 0-1
  saturationTone: number;    // 0-1 (dark to bright)
  
  // Tremolo
  tremoloEnabled: boolean;
  tremoloRate: number;       // 0.1-10 Hz
  tremoloDepth: number;      // 0-1
  tremoloWave: 'sine' | 'triangle' | 'square';
  
  // AutoPan
  autoPanEnabled: boolean;
  autoPanRate: number;       // 0.1-2 Hz
  autoPanDepth: number;      // 0-1
  
  // Master
  dryWet: number;            // 0-1
  outputGain: number;        // 0-1
}

const DEFAULT_SETTINGS: EffectsChainSettings = {
  phaserEnabled: true,
  phaserRate: 0.3,
  phaserDepth: 0.6,
  phaserBaseFrequency: 400,
  phaserStages: 6,
  
  flangerEnabled: false,
  flangerRate: 0.2,
  flangerDepth: 0.5,
  flangerFeedback: 0.5,
  
  filterEnabled: true,
  filterType: 'lowpass',
  filterCutoff: 2000,
  filterResonance: 2,
  filterLfoRate: 0.1,
  filterLfoDepth: 0.3,
  
  saturationEnabled: true,
  saturationAmount: 0.2,
  saturationTone: 0.5,
  
  tremoloEnabled: false,
  tremoloRate: 4,
  tremoloDepth: 0.3,
  tremoloWave: 'sine',
  
  autoPanEnabled: true,
  autoPanRate: 0.15,
  autoPanDepth: 0.4,
  
  dryWet: 0.4,
  outputGain: 0.8,
};

export class EffectsChain {
  private settings: EffectsChainSettings;
  
  // Effect nodes
  private input: Tone.Gain | null = null;
  private output: Tone.Gain | null = null;
  private dryGain: Tone.Gain | null = null;
  private wetGain: Tone.Gain | null = null;
  
  private phaser: Tone.Phaser | null = null;
  private flanger: Tone.FeedbackDelay | null = null;
  private flangerLFO: Tone.LFO | null = null;
  private filter: Tone.Filter | null = null;
  private filterLFO: Tone.LFO | null = null;
  private saturator: Tone.Distortion | null = null;
  private toneFilter: Tone.Filter | null = null;
  private tremolo: Tone.Tremolo | null = null;
  private autoPanner: Tone.AutoPanner | null = null;
  
  private isInitialized = false;

  constructor(settings?: Partial<EffectsChainSettings>) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  /**
   * Initialize effects chain
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Input and output
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(this.settings.outputGain);
    this.dryGain = new Tone.Gain(1 - this.settings.dryWet);
    this.wetGain = new Tone.Gain(this.settings.dryWet);

    // Build wet effects chain
    let currentNode: Tone.ToneAudioNode = this.input;
    
    // Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // === PHASER ===
    if (this.settings.phaserEnabled) {
      this.phaser = new Tone.Phaser({
        frequency: this.settings.phaserRate,
        octaves: Math.ceil(this.settings.phaserDepth * 5),
        baseFrequency: this.settings.phaserBaseFrequency,
        stages: this.settings.phaserStages,
      });
      currentNode.connect(this.phaser);
      currentNode = this.phaser;
    }

    // === FLANGER (using modulated delay) ===
    if (this.settings.flangerEnabled) {
      this.flanger = new Tone.FeedbackDelay({
        delayTime: 0.005,
        feedback: this.settings.flangerFeedback,
      });
      
      this.flangerLFO = new Tone.LFO({
        frequency: this.settings.flangerRate,
        min: 0.001,
        max: 0.01,
        type: 'sine',
      });
      this.flangerLFO.connect(this.flanger.delayTime);
      this.flangerLFO.start();
      
      currentNode.connect(this.flanger);
      currentNode = this.flanger;
    }

    // === FILTER ===
    if (this.settings.filterEnabled) {
      this.filter = new Tone.Filter({
        type: this.settings.filterType,
        frequency: this.settings.filterCutoff,
        Q: this.settings.filterResonance,
      });
      
      if (this.settings.filterLfoRate > 0) {
        this.filterLFO = new Tone.LFO({
          frequency: this.settings.filterLfoRate,
          min: this.settings.filterCutoff * (1 - this.settings.filterLfoDepth),
          max: this.settings.filterCutoff * (1 + this.settings.filterLfoDepth * 2),
          type: 'sine',
        });
        this.filterLFO.connect(this.filter.frequency);
        this.filterLFO.start();
      }
      
      currentNode.connect(this.filter);
      currentNode = this.filter;
    }

    // === SATURATION ===
    if (this.settings.saturationEnabled) {
      this.saturator = new Tone.Distortion({
        distortion: this.settings.saturationAmount * 0.5,
        oversample: '2x',
      });
      
      // Tone control (post-saturation filter)
      const toneFreq = 500 + this.settings.saturationTone * 4000;
      this.toneFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: toneFreq,
        Q: 0.5,
      });
      
      currentNode.connect(this.saturator);
      this.saturator.connect(this.toneFilter);
      currentNode = this.toneFilter;
    }

    // === TREMOLO ===
    if (this.settings.tremoloEnabled) {
      this.tremolo = new Tone.Tremolo({
        frequency: this.settings.tremoloRate,
        depth: this.settings.tremoloDepth,
        type: this.settings.tremoloWave,
      }).start();
      
      currentNode.connect(this.tremolo);
      currentNode = this.tremolo;
    }

    // === AUTO-PANNER ===
    if (this.settings.autoPanEnabled) {
      this.autoPanner = new Tone.AutoPanner({
        frequency: this.settings.autoPanRate,
        depth: this.settings.autoPanDepth,
      }).start();
      
      currentNode.connect(this.autoPanner);
      currentNode = this.autoPanner;
    }

    // Connect wet chain to output
    currentNode.connect(this.wetGain);
    this.wetGain.connect(this.output);

    this.isInitialized = true;
  }

  /**
   * Update effect parameters
   */
  updateSettings(settings: Partial<EffectsChainSettings>): void {
    this.settings = { ...this.settings, ...settings };

    // Update phaser
    if (this.phaser) {
      if (settings.phaserRate !== undefined) {
        this.phaser.frequency.value = settings.phaserRate;
      }
      if (settings.phaserBaseFrequency !== undefined) {
        this.phaser.baseFrequency = settings.phaserBaseFrequency;
      }
    }

    // Update flanger
    if (this.flangerLFO && settings.flangerRate !== undefined) {
      this.flangerLFO.frequency.value = settings.flangerRate;
    }
    if (this.flanger && settings.flangerFeedback !== undefined) {
      this.flanger.feedback.value = settings.flangerFeedback;
    }

    // Update filter
    if (this.filter) {
      if (settings.filterCutoff !== undefined) {
        this.filter.frequency.rampTo(settings.filterCutoff, 0.1);
      }
      if (settings.filterResonance !== undefined) {
        this.filter.Q.value = settings.filterResonance;
      }
    }
    if (this.filterLFO) {
      if (settings.filterLfoRate !== undefined) {
        this.filterLFO.frequency.value = settings.filterLfoRate;
      }
      if (settings.filterLfoDepth !== undefined || settings.filterCutoff !== undefined) {
        const cutoff = settings.filterCutoff ?? this.settings.filterCutoff;
        const depth = settings.filterLfoDepth ?? this.settings.filterLfoDepth;
        this.filterLFO.min = cutoff * (1 - depth);
        this.filterLFO.max = cutoff * (1 + depth * 2);
      }
    }

    // Update saturation
    if (this.saturator && settings.saturationAmount !== undefined) {
      this.saturator.distortion = settings.saturationAmount * 0.5;
    }
    if (this.toneFilter && settings.saturationTone !== undefined) {
      const toneFreq = 500 + settings.saturationTone * 4000;
      this.toneFilter.frequency.rampTo(toneFreq, 0.1);
    }

    // Update tremolo
    if (this.tremolo) {
      if (settings.tremoloRate !== undefined) {
        this.tremolo.frequency.value = settings.tremoloRate;
      }
      if (settings.tremoloDepth !== undefined) {
        this.tremolo.depth.value = settings.tremoloDepth;
      }
    }

    // Update auto-panner
    if (this.autoPanner) {
      if (settings.autoPanRate !== undefined) {
        this.autoPanner.frequency.value = settings.autoPanRate;
      }
      if (settings.autoPanDepth !== undefined) {
        this.autoPanner.depth.value = settings.autoPanDepth;
      }
    }

    // Update mix
    if (this.dryGain && this.wetGain && settings.dryWet !== undefined) {
      this.dryGain.gain.rampTo(1 - settings.dryWet, 0.1);
      this.wetGain.gain.rampTo(settings.dryWet, 0.1);
    }

    // Update output
    if (this.output && settings.outputGain !== undefined) {
      this.output.gain.rampTo(settings.outputGain, 0.1);
    }
  }

  /**
   * Connect input source
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
   * Get the input node
   */
  getInput(): Tone.Gain | null {
    return this.input;
  }

  /**
   * Get the output node
   */
  getOutput(): Tone.Gain | null {
    return this.output;
  }

  /**
   * Process audio offline (for export)
   */
  processOffline(input: Float32Array, sampleRate: number): Float32Array {
    const output = new Float32Array(input.length);
    const twoPi = 2 * Math.PI;
    
    // Phase accumulators
    let phaserPhase = 0;
    let flangerPhase = 0;
    let filterLfoPhase = 0;
    let tremoloPhase = 0;
    let autoPanPhase = 0;
    
    // Delay buffer for flanger
    const flangerBufferSize = Math.ceil(sampleRate * 0.02);
    const flangerBuffer = new Float32Array(flangerBufferSize);
    let flangerWriteIndex = 0;
    
    // Filter state
    let filterY1 = 0;
    let filterY2 = 0;
    
    for (let i = 0; i < input.length; i++) {
      const t = i / sampleRate;
      let sample = input[i];
      let drySample = sample * (1 - this.settings.dryWet);
      let wetSample = sample;

      // === PHASER (simplified all-pass based) ===
      if (this.settings.phaserEnabled) {
        phaserPhase += (twoPi * this.settings.phaserRate) / sampleRate;
        if (phaserPhase > twoPi) phaserPhase -= twoPi;
        
        const phaserMod = Math.sin(phaserPhase) * this.settings.phaserDepth;
        const allpassCoeff = 0.5 + phaserMod * 0.4;
        
        // Simple all-pass approximation
        wetSample = wetSample * allpassCoeff + wetSample * (1 - allpassCoeff) * Math.cos(phaserPhase * this.settings.phaserStages);
      }

      // === FLANGER ===
      if (this.settings.flangerEnabled) {
        flangerPhase += (twoPi * this.settings.flangerRate) / sampleRate;
        if (flangerPhase > twoPi) flangerPhase -= twoPi;
        
        const delayMs = 2 + Math.sin(flangerPhase) * this.settings.flangerDepth * 3;
        const delaySamples = (delayMs / 1000) * sampleRate;
        
        const readIndex = (flangerWriteIndex - Math.floor(delaySamples) + flangerBufferSize) % flangerBufferSize;
        const delayedSample = flangerBuffer[readIndex];
        
        flangerBuffer[flangerWriteIndex] = wetSample + delayedSample * this.settings.flangerFeedback;
        flangerWriteIndex = (flangerWriteIndex + 1) % flangerBufferSize;
        
        wetSample = (wetSample + delayedSample) * 0.5;
      }

      // === FILTER ===
      if (this.settings.filterEnabled) {
        filterLfoPhase += (twoPi * this.settings.filterLfoRate) / sampleRate;
        if (filterLfoPhase > twoPi) filterLfoPhase -= twoPi;
        
        const lfoMod = Math.sin(filterLfoPhase) * this.settings.filterLfoDepth;
        let cutoff = this.settings.filterCutoff * (1 + lfoMod);
        cutoff = Math.max(20, Math.min(cutoff, sampleRate * 0.45));
        
        // Biquad lowpass approximation
        const omega = (twoPi * cutoff) / sampleRate;
        const cosOmega = Math.cos(omega);
        const alpha = Math.sin(omega) / (2 * this.settings.filterResonance || 1);
        
        const a0 = 1 + alpha;
        const b0 = (1 - cosOmega) / 2 / a0;
        const b1 = (1 - cosOmega) / a0;
        const b2 = b0;
        const a1 = (-2 * cosOmega) / a0;
        const a2 = (1 - alpha) / a0;
        
        const filteredSample = b0 * wetSample + b1 * filterY1 + b2 * filterY2 - a1 * filterY1 - a2 * filterY2;
        filterY2 = filterY1;
        filterY1 = wetSample;
        wetSample = filteredSample;
      }

      // === SATURATION ===
      if (this.settings.saturationEnabled) {
        const drive = 1 + this.settings.saturationAmount * 3;
        wetSample = Math.tanh(wetSample * drive) / Math.tanh(drive);
        
        // Tone shaping
        const toneMix = this.settings.saturationTone;
        wetSample = wetSample * (0.5 + toneMix * 0.5);
      }

      // === TREMOLO ===
      if (this.settings.tremoloEnabled) {
        tremoloPhase += (twoPi * this.settings.tremoloRate) / sampleRate;
        if (tremoloPhase > twoPi) tremoloPhase -= twoPi;
        
        let tremoloMod: number;
        if (this.settings.tremoloWave === 'sine') {
          tremoloMod = Math.sin(tremoloPhase);
        } else if (this.settings.tremoloWave === 'triangle') {
          tremoloMod = (2 * Math.abs(2 * (tremoloPhase / twoPi - Math.floor(tremoloPhase / twoPi + 0.5)))) - 1;
        } else {
          tremoloMod = Math.sign(Math.sin(tremoloPhase));
        }
        
        const tremoloGain = 1 - this.settings.tremoloDepth * 0.5 * (1 - tremoloMod);
        wetSample *= tremoloGain;
      }

      // Mix dry and wet
      output[i] = drySample + wetSample * this.settings.dryWet;
    }
    
    return output;
  }

  /**
   * Dispose all nodes
   */
  dispose(): void {
    this.phaser?.dispose();
    this.flanger?.dispose();
    this.flangerLFO?.dispose();
    this.filter?.dispose();
    this.filterLFO?.dispose();
    this.saturator?.dispose();
    this.toneFilter?.dispose();
    this.tremolo?.dispose();
    this.autoPanner?.dispose();
    this.dryGain?.dispose();
    this.wetGain?.dispose();
    this.input?.dispose();
    this.output?.dispose();
    
    this.isInitialized = false;
  }
}

// Factory function
export function createEffectsChain(settings?: Partial<EffectsChainSettings>): EffectsChain {
  return new EffectsChain(settings);
}
