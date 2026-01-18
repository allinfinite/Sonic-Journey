/**
 * SpatialProcessor - 3D spatial audio processing
 * Provides reverb, stereo widening, auto-panning, and distance modeling
 */

import * as Tone from 'tone';

export type ReverbType = 'hall' | 'chamber' | 'plate' | 'spring' | 'infinite';
export type StereoMode = 'normal' | 'wide' | 'mono' | 'haas';

export interface SpatialProcessorSettings {
  // Reverb
  reverbEnabled: boolean;
  reverbType: ReverbType;
  reverbDecay: number;           // 0.5-30 seconds
  reverbPreDelay: number;        // 0-100 ms
  reverbDamping: number;         // 0-1 (high frequency damping)
  reverbDryWet: number;          // 0-1
  
  // Stereo Width
  stereoWidthEnabled: boolean;
  stereoWidth: number;           // 0-2 (1 = normal, >1 = wider, <1 = narrower)
  stereoMode: StereoMode;
  
  // Auto-Panning
  autoPanEnabled: boolean;
  autoPanRate: number;           // 0.01-2 Hz
  autoPanDepth: number;          // 0-1
  autoPanWaveform: 'sine' | 'triangle';
  
  // Distance/Depth
  distanceEnabled: boolean;
  distance: number;              // 0-1 (0 = close, 1 = far)
  airAbsorption: number;         // 0-1 (high freq rolloff with distance)
  
  // Early Reflections
  earlyReflectionsEnabled: boolean;
  earlyReflectionsDelay: number; // 5-50 ms
  earlyReflectionsLevel: number; // 0-1
  
  // Output
  outputGain: number;            // 0-1
}

const DEFAULT_SETTINGS: SpatialProcessorSettings = {
  reverbEnabled: true,
  reverbType: 'hall',
  reverbDecay: 3,
  reverbPreDelay: 20,
  reverbDamping: 0.5,
  reverbDryWet: 0.35,
  
  stereoWidthEnabled: true,
  stereoWidth: 1.3,
  stereoMode: 'wide',
  
  autoPanEnabled: true,
  autoPanRate: 0.08,
  autoPanDepth: 0.3,
  autoPanWaveform: 'sine',
  
  distanceEnabled: true,
  distance: 0.3,
  airAbsorption: 0.4,
  
  earlyReflectionsEnabled: true,
  earlyReflectionsDelay: 15,
  earlyReflectionsLevel: 0.3,
  
  outputGain: 0.9,
};

export class SpatialProcessor {
  private settings: SpatialProcessorSettings;
  private sampleRate: number;
  
  // Tone.js nodes
  private input: Tone.Gain | null = null;
  private output: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private reverbDry: Tone.Gain | null = null;
  private reverbWet: Tone.Gain | null = null;
  private widener: Tone.StereoWidener | null = null;
  private autoPanner: Tone.AutoPanner | null = null;
  private distanceFilter: Tone.Filter | null = null;
  private distanceGain: Tone.Gain | null = null;
  private earlyReflections: Tone.FeedbackDelay | null = null;
  private earlyReflectionsGain: Tone.Gain | null = null;
  
  private isInitialized = false;

  constructor(sampleRate: number = 48000, settings?: Partial<SpatialProcessorSettings>) {
    this.sampleRate = sampleRate;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  /**
   * Initialize spatial processing nodes
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(this.settings.outputGain);
    
    let currentNode: Tone.ToneAudioNode = this.input;

    // === DISTANCE MODELING ===
    if (this.settings.distanceEnabled) {
      // High-frequency rolloff based on distance
      const cutoff = 20000 - (this.settings.distance * this.settings.airAbsorption * 15000);
      this.distanceFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: Math.max(1000, cutoff),
        Q: 0.5,
      });
      
      // Volume reduction with distance
      const distanceAttenuation = 1 - (this.settings.distance * 0.5);
      this.distanceGain = new Tone.Gain(distanceAttenuation);
      
      currentNode.connect(this.distanceFilter);
      this.distanceFilter.connect(this.distanceGain);
      currentNode = this.distanceGain;
    }

    // === EARLY REFLECTIONS ===
    if (this.settings.earlyReflectionsEnabled) {
      // Create simple early reflections with short delays
      this.earlyReflections = new Tone.FeedbackDelay({
        delayTime: this.settings.earlyReflectionsDelay / 1000,
        feedback: 0.2,
      });
      this.earlyReflectionsGain = new Tone.Gain(this.settings.earlyReflectionsLevel);
      
      // Mix early reflections
      const erMixer = new Tone.Gain(1);
      currentNode.connect(erMixer);
      currentNode.connect(this.earlyReflections);
      this.earlyReflections.connect(this.earlyReflectionsGain);
      this.earlyReflectionsGain.connect(erMixer);
      currentNode = erMixer;
    }

    // === REVERB ===
    if (this.settings.reverbEnabled) {
      const decayTime = this.getReverbDecayTime();
      this.reverb = new Tone.Reverb({
        decay: decayTime,
        preDelay: this.settings.reverbPreDelay / 1000,
      });
      await this.reverb.generate();
      
      // Dry/wet mix
      this.reverbDry = new Tone.Gain(1 - this.settings.reverbDryWet);
      this.reverbWet = new Tone.Gain(this.settings.reverbDryWet);
      
      const reverbMixer = new Tone.Gain(1);
      currentNode.connect(this.reverbDry);
      currentNode.connect(this.reverb);
      this.reverb.connect(this.reverbWet);
      this.reverbDry.connect(reverbMixer);
      this.reverbWet.connect(reverbMixer);
      currentNode = reverbMixer;
    }

    // === STEREO WIDTH ===
    if (this.settings.stereoWidthEnabled) {
      this.widener = new Tone.StereoWidener({
        width: this.settings.stereoWidth,
      });
      
      currentNode.connect(this.widener);
      currentNode = this.widener;
    }

    // === AUTO-PANNER ===
    if (this.settings.autoPanEnabled) {
      this.autoPanner = new Tone.AutoPanner({
        frequency: this.settings.autoPanRate,
        depth: this.settings.autoPanDepth,
        type: this.settings.autoPanWaveform,
      }).start();
      
      currentNode.connect(this.autoPanner);
      currentNode = this.autoPanner;
    }

    // Connect to output
    currentNode.connect(this.output);

    this.isInitialized = true;
  }

  /**
   * Get reverb decay time based on type
   */
  private getReverbDecayTime(): number {
    const baseDecay = this.settings.reverbDecay;
    
    switch (this.settings.reverbType) {
      case 'chamber':
        return baseDecay * 0.6;
      case 'plate':
        return baseDecay * 0.8;
      case 'spring':
        return baseDecay * 0.5;
      case 'infinite':
        return Math.min(baseDecay * 3, 30);
      case 'hall':
      default:
        return baseDecay;
    }
  }

  /**
   * Update settings in real-time
   */
  updateSettings(settings: Partial<SpatialProcessorSettings>): void {
    this.settings = { ...this.settings, ...settings };

    // Update reverb
    if (this.reverb) {
      if (settings.reverbDecay !== undefined || settings.reverbType !== undefined) {
        this.reverb.decay = this.getReverbDecayTime();
      }
    }
    if (this.reverbDry && this.reverbWet && settings.reverbDryWet !== undefined) {
      this.reverbDry.gain.rampTo(1 - settings.reverbDryWet, 0.1);
      this.reverbWet.gain.rampTo(settings.reverbDryWet, 0.1);
    }

    // Update stereo width
    if (this.widener && settings.stereoWidth !== undefined) {
      this.widener.width.rampTo(settings.stereoWidth, 0.1);
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

    // Update distance
    if (this.distanceFilter && settings.distance !== undefined) {
      const cutoff = 20000 - (settings.distance * this.settings.airAbsorption * 15000);
      this.distanceFilter.frequency.rampTo(Math.max(1000, cutoff), 0.1);
    }
    if (this.distanceGain && settings.distance !== undefined) {
      const attenuation = 1 - (settings.distance * 0.5);
      this.distanceGain.gain.rampTo(attenuation, 0.1);
    }

    // Update early reflections
    if (this.earlyReflectionsGain && settings.earlyReflectionsLevel !== undefined) {
      this.earlyReflectionsGain.gain.rampTo(settings.earlyReflectionsLevel, 0.1);
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
   * Process audio offline (for export)
   */
  processOffline(inputLeft: Float32Array, inputRight: Float32Array): { left: Float32Array; right: Float32Array } {
    const length = inputLeft.length;
    const outputLeft = new Float32Array(length);
    const outputRight = new Float32Array(length);
    
    // Reverb impulse response (simplified convolution-like effect)
    const reverbTail = Math.floor(this.settings.reverbDecay * this.sampleRate);
    const reverbBuffer = new Float32Array(Math.min(reverbTail, this.sampleRate * 5));
    
    // Early reflections buffer
    const erDelaySamples = Math.floor((this.settings.earlyReflectionsDelay / 1000) * this.sampleRate);
    const erBufferL = new Float32Array(erDelaySamples + 1);
    const erBufferR = new Float32Array(erDelaySamples + 1);
    let erWriteIndex = 0;
    
    // Auto-pan phase
    let panPhase = 0;
    const panPhaseInc = (2 * Math.PI * this.settings.autoPanRate) / this.sampleRate;
    
    for (let i = 0; i < length; i++) {
      let sampleL = inputLeft[i];
      let sampleR = inputRight[i];

      // === DISTANCE MODELING ===
      if (this.settings.distanceEnabled) {
        const attenuation = 1 - (this.settings.distance * 0.5);
        sampleL *= attenuation;
        sampleR *= attenuation;
        
        // Simple low-pass for air absorption (moving average approximation)
        if (i > 0 && this.settings.airAbsorption > 0) {
          const mix = this.settings.distance * this.settings.airAbsorption * 0.3;
          sampleL = sampleL * (1 - mix) + inputLeft[i - 1] * mix;
          sampleR = sampleR * (1 - mix) + inputRight[i - 1] * mix;
        }
      }

      // === EARLY REFLECTIONS ===
      if (this.settings.earlyReflectionsEnabled) {
        const readIndex = (erWriteIndex - erDelaySamples + erBufferL.length) % erBufferL.length;
        const erL = erBufferL[readIndex] * this.settings.earlyReflectionsLevel;
        const erR = erBufferR[readIndex] * this.settings.earlyReflectionsLevel;
        
        erBufferL[erWriteIndex] = sampleL;
        erBufferR[erWriteIndex] = sampleR;
        erWriteIndex = (erWriteIndex + 1) % erBufferL.length;
        
        sampleL += erL;
        sampleR += erR;
      }

      // === REVERB (simplified) ===
      if (this.settings.reverbEnabled) {
        // Add current sample to reverb buffer with decay
        const reverbIndex = i % reverbBuffer.length;
        const decay = Math.exp(-3 / (this.settings.reverbDecay * this.sampleRate));
        
        reverbBuffer[reverbIndex] = (sampleL + sampleR) * 0.5 * this.settings.reverbDryWet;
        
        // Sum reverb contributions with decay
        let reverbSum = 0;
        for (let j = 1; j < Math.min(i, reverbBuffer.length); j++) {
          const idx = (reverbIndex - j + reverbBuffer.length) % reverbBuffer.length;
          reverbSum += reverbBuffer[idx] * Math.pow(decay, j);
        }
        
        // Apply damping (reduce high frequencies over time)
        const dampedReverb = reverbSum * (1 - this.settings.reverbDamping * 0.5);
        
        // Mix
        const dryMix = 1 - this.settings.reverbDryWet;
        sampleL = sampleL * dryMix + dampedReverb;
        sampleR = sampleR * dryMix + dampedReverb;
      }

      // === STEREO WIDTH ===
      if (this.settings.stereoWidthEnabled) {
        const mid = (sampleL + sampleR) * 0.5;
        const side = (sampleL - sampleR) * 0.5;
        
        const widthFactor = this.settings.stereoWidth;
        sampleL = mid + side * widthFactor;
        sampleR = mid - side * widthFactor;
      }

      // === AUTO-PANNING ===
      if (this.settings.autoPanEnabled) {
        let panMod: number;
        if (this.settings.autoPanWaveform === 'sine') {
          panMod = Math.sin(panPhase);
        } else {
          // Triangle
          panMod = (2 / Math.PI) * Math.asin(Math.sin(panPhase));
        }
        
        const panAmount = panMod * this.settings.autoPanDepth;
        const leftGain = Math.cos((panAmount + 1) * Math.PI / 4);
        const rightGain = Math.sin((panAmount + 1) * Math.PI / 4);
        
        const mono = (sampleL + sampleR) * 0.5;
        sampleL = mono * leftGain + sampleL * (1 - this.settings.autoPanDepth);
        sampleR = mono * rightGain + sampleR * (1 - this.settings.autoPanDepth);
        
        panPhase += panPhaseInc;
        if (panPhase > 2 * Math.PI) panPhase -= 2 * Math.PI;
      }

      outputLeft[i] = sampleL * this.settings.outputGain;
      outputRight[i] = sampleR * this.settings.outputGain;
    }
    
    return { left: outputLeft, right: outputRight };
  }

  /**
   * Dispose all nodes
   */
  dispose(): void {
    this.reverb?.dispose();
    this.reverbDry?.dispose();
    this.reverbWet?.dispose();
    this.widener?.dispose();
    this.autoPanner?.dispose();
    this.distanceFilter?.dispose();
    this.distanceGain?.dispose();
    this.earlyReflections?.dispose();
    this.earlyReflectionsGain?.dispose();
    this.input?.dispose();
    this.output?.dispose();
    
    this.isInitialized = false;
  }
}

// Factory function
export function createSpatialProcessor(
  sampleRate?: number,
  settings?: Partial<SpatialProcessorSettings>
): SpatialProcessor {
  return new SpatialProcessor(sampleRate, settings);
}

// Preset configurations
export const SPATIAL_PRESETS = {
  intimate: {
    reverbDecay: 1.5,
    reverbDryWet: 0.2,
    stereoWidth: 1.0,
    distance: 0.1,
    autoPanDepth: 0.2,
  },
  concert: {
    reverbType: 'hall' as ReverbType,
    reverbDecay: 4,
    reverbDryWet: 0.4,
    stereoWidth: 1.4,
    distance: 0.4,
    autoPanDepth: 0.3,
  },
  cathedral: {
    reverbType: 'hall' as ReverbType,
    reverbDecay: 8,
    reverbDryWet: 0.5,
    stereoWidth: 1.6,
    distance: 0.6,
    airAbsorption: 0.6,
  },
  psychedelic: {
    reverbType: 'infinite' as ReverbType,
    reverbDecay: 12,
    reverbDryWet: 0.6,
    stereoWidth: 1.8,
    autoPanRate: 0.12,
    autoPanDepth: 0.5,
  },
  meditation: {
    reverbType: 'hall' as ReverbType,
    reverbDecay: 5,
    reverbDryWet: 0.45,
    stereoWidth: 1.3,
    distance: 0.3,
    autoPanRate: 0.05,
    autoPanDepth: 0.25,
  },
};
