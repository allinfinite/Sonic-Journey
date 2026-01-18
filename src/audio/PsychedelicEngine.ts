/**
 * PsychedelicEngine - Unified orchestration of all audio enhancement processors
 * Combines harmonic enrichment, effects, modulation, spatial processing, timbre evolution, and spectral shaping
 */

import * as Tone from 'tone';
import { HarmonicEnricher, createHarmonicEnricher } from './HarmonicEnricher';
import { EffectsChain, createEffectsChain } from './EffectsChain';
import { ModulationMatrix, createModulationMatrix, MODULATION_PRESETS } from './ModulationMatrix';
import { SpatialProcessor, createSpatialProcessor, SPATIAL_PRESETS } from './SpatialProcessor';
import { TimbreEvolver, createTimbreEvolver, TIMBRE_PRESETS } from './TimbreEvolver';
import { SpectralProcessor, createSpectralProcessor, SPECTRAL_PRESETS } from './SpectralProcessor';

export type EnhancementPreset = 'subtle' | 'therapeutic' | 'psychedelic' | 'meditative' | 'dynamic' | 'custom';

export interface PsychedelicEngineSettings {
  preset: EnhancementPreset;
  
  // Master controls
  enabled: boolean;
  masterMix: number;              // 0-1, overall wet/dry
  
  // Per-processor enables
  harmonicsEnabled: boolean;
  effectsEnabled: boolean;
  modulationEnabled: boolean;
  spatialEnabled: boolean;
  timbreEnabled: boolean;
  spectralEnabled: boolean;
  
  // High-level parameters (mapped to processors)
  harmonicRichness: number;       // 0-1
  effectsIntensity: number;       // 0-1
  spatialWidth: number;           // 0-1
  modulationDepth: number;        // 0-1
  timbreEvolution: number;        // 0-1
  warmth: number;                 // 0-1
}

const DEFAULT_SETTINGS: PsychedelicEngineSettings = {
  preset: 'therapeutic',
  enabled: true,
  masterMix: 0.5,
  
  harmonicsEnabled: true,
  effectsEnabled: true,
  modulationEnabled: true,
  spatialEnabled: true,
  timbreEnabled: true,
  spectralEnabled: true,
  
  harmonicRichness: 0.5,
  effectsIntensity: 0.4,
  spatialWidth: 0.5,
  modulationDepth: 0.4,
  timbreEvolution: 0.3,
  warmth: 0.3,
};

// Preset configurations
const PRESETS: Record<EnhancementPreset, Partial<PsychedelicEngineSettings>> = {
  subtle: {
    masterMix: 0.3,
    harmonicRichness: 0.3,
    effectsIntensity: 0.2,
    spatialWidth: 0.3,
    modulationDepth: 0.2,
    timbreEvolution: 0.15,
    warmth: 0.2,
  },
  therapeutic: {
    masterMix: 0.5,
    harmonicRichness: 0.5,
    effectsIntensity: 0.4,
    spatialWidth: 0.5,
    modulationDepth: 0.4,
    timbreEvolution: 0.3,
    warmth: 0.35,
  },
  psychedelic: {
    masterMix: 0.7,
    harmonicRichness: 0.7,
    effectsIntensity: 0.6,
    spatialWidth: 0.8,
    modulationDepth: 0.7,
    timbreEvolution: 0.6,
    warmth: 0.4,
  },
  meditative: {
    masterMix: 0.5,
    harmonicRichness: 0.4,
    effectsIntensity: 0.3,
    spatialWidth: 0.6,
    modulationDepth: 0.3,
    timbreEvolution: 0.2,
    warmth: 0.4,
  },
  dynamic: {
    masterMix: 0.6,
    harmonicRichness: 0.6,
    effectsIntensity: 0.5,
    spatialWidth: 0.5,
    modulationDepth: 0.6,
    timbreEvolution: 0.5,
    warmth: 0.3,
  },
  custom: {
    // Uses current settings
  },
};

export class PsychedelicEngine {
  private settings: PsychedelicEngineSettings;
  private sampleRate: number;
  
  // Processors
  private harmonicEnricher: HarmonicEnricher | null = null;
  private effectsChain: EffectsChain | null = null;
  private modulationMatrix: ModulationMatrix | null = null;
  private spatialProcessor: SpatialProcessor | null = null;
  private timbreEvolver: TimbreEvolver | null = null;
  private spectralProcessor: SpectralProcessor | null = null;
  
  // Tone.js routing
  private input: Tone.Gain | null = null;
  private output: Tone.Gain | null = null;
  private dryGain: Tone.Gain | null = null;
  private wetGain: Tone.Gain | null = null;
  
  private isInitialized = false;

  constructor(sampleRate: number = 48000, settings?: Partial<PsychedelicEngineSettings>) {
    this.sampleRate = sampleRate;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    
    // Apply preset if specified
    if (settings?.preset && settings.preset !== 'custom') {
      this.applyPreset(settings.preset);
    }
  }

  /**
   * Apply a preset configuration
   */
  applyPreset(preset: EnhancementPreset): void {
    const presetSettings = PRESETS[preset];
    this.settings = { ...this.settings, ...presetSettings, preset };
    
    if (this.isInitialized) {
      this.updateAllProcessors();
    }
  }

  /**
   * Initialize all processors
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create routing nodes
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(1);
    this.dryGain = new Tone.Gain(1 - this.settings.masterMix);
    this.wetGain = new Tone.Gain(this.settings.masterMix);

    // Dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // Create processors
    if (this.settings.harmonicsEnabled) {
      this.harmonicEnricher = createHarmonicEnricher(this.sampleRate, {
        harmonicCount: Math.floor(3 + this.settings.harmonicRichness * 5),
        evenHarmonicLevel: 0.3 + this.settings.harmonicRichness * 0.4,
        oddHarmonicLevel: 0.4 + this.settings.harmonicRichness * 0.4,
        warmth: this.settings.warmth,
        dryWet: this.settings.harmonicRichness * 0.6,
      });
      await this.harmonicEnricher.initialize();
    }

    if (this.settings.effectsEnabled) {
      this.effectsChain = createEffectsChain({
        phaserEnabled: true,
        phaserRate: 0.2 + this.settings.effectsIntensity * 0.3,
        phaserDepth: this.settings.effectsIntensity * 0.8,
        filterEnabled: true,
        filterLfoRate: 0.05 + this.settings.modulationDepth * 0.15,
        filterLfoDepth: this.settings.effectsIntensity * 0.4,
        saturationEnabled: this.settings.warmth > 0.2,
        saturationAmount: this.settings.warmth * 0.5,
        autoPanEnabled: true,
        autoPanRate: 0.08 + this.settings.modulationDepth * 0.1,
        autoPanDepth: this.settings.spatialWidth * 0.5,
        dryWet: this.settings.effectsIntensity * 0.5,
      });
      await this.effectsChain.initialize();
    }

    if (this.settings.modulationEnabled) {
      const modPreset = this.settings.preset === 'psychedelic' ? MODULATION_PRESETS.psychedelic :
                       this.settings.preset === 'meditative' ? MODULATION_PRESETS.meditative :
                       this.settings.preset === 'subtle' ? MODULATION_PRESETS.subtle :
                       MODULATION_PRESETS.dynamic;
      
      this.modulationMatrix = createModulationMatrix(this.sampleRate, {
        ...modPreset,
        masterDepth: this.settings.modulationDepth,
      });
      await this.modulationMatrix.initialize();
      this.modulationMatrix.start();
    }

    if (this.settings.spatialEnabled) {
      const spatialPreset = this.settings.preset === 'psychedelic' ? SPATIAL_PRESETS.psychedelic :
                           this.settings.preset === 'meditative' ? SPATIAL_PRESETS.meditation :
                           SPATIAL_PRESETS.concert;
      
      this.spatialProcessor = createSpatialProcessor(this.sampleRate, {
        ...spatialPreset,
        reverbDryWet: this.settings.spatialWidth * 0.5,
        stereoWidth: 1 + this.settings.spatialWidth * 0.8,
        autoPanDepth: this.settings.spatialWidth * 0.4,
      });
      await this.spatialProcessor.initialize();
    }

    if (this.settings.timbreEnabled) {
      const timbrePreset = this.settings.preset === 'psychedelic' ? TIMBRE_PRESETS.psychedelic :
                          this.settings.preset === 'meditative' ? TIMBRE_PRESETS.organic :
                          TIMBRE_PRESETS.ethereal;
      
      this.timbreEvolver = createTimbreEvolver(this.sampleRate, {
        ...timbrePreset,
        evolutionRate: this.settings.timbreEvolution * 0.2,
        evolutionDepth: this.settings.timbreEvolution * 0.5,
        morphRate: this.settings.timbreEvolution * 0.1,
      });
    }

    if (this.settings.spectralEnabled) {
      const spectralPreset = this.settings.preset === 'psychedelic' ? SPECTRAL_PRESETS.psychedelic :
                            this.settings.preset === 'therapeutic' ? SPECTRAL_PRESETS.therapeutic :
                            SPECTRAL_PRESETS.warm;
      
      this.spectralProcessor = createSpectralProcessor(this.sampleRate, {
        ...spectralPreset,
        exciterAmount: this.settings.harmonicRichness * 0.4,
      });
      await this.spectralProcessor.initialize();
    }

    // Connect processors in series
    let currentNode: Tone.ToneAudioNode = this.input;

    if (this.harmonicEnricher) {
      this.harmonicEnricher.connectInput(currentNode as Tone.Gain);
      this.harmonicEnricher.start();
      currentNode = this.harmonicEnricher.getOutput()!;
    }

    if (this.effectsChain) {
      this.effectsChain.connectInput(currentNode);
      currentNode = this.effectsChain.getOutput()!;
    }

    if (this.spectralProcessor) {
      this.spectralProcessor.connectInput(currentNode);
      currentNode = this.spectralProcessor.getOutput()!;
    }

    if (this.spatialProcessor) {
      this.spatialProcessor.connectInput(currentNode);
      currentNode = this.spatialProcessor.getOutput()!;
    }

    // Connect to wet gain
    currentNode.connect(this.wetGain);
    this.wetGain.connect(this.output);

    this.isInitialized = true;
  }

  /**
   * Update all processors with current settings
   */
  private updateAllProcessors(): void {
    if (this.harmonicEnricher) {
      this.harmonicEnricher.updateSettings({
        harmonicCount: Math.floor(3 + this.settings.harmonicRichness * 5),
        evenHarmonicLevel: 0.3 + this.settings.harmonicRichness * 0.4,
        oddHarmonicLevel: 0.4 + this.settings.harmonicRichness * 0.4,
        warmth: this.settings.warmth,
        dryWet: this.settings.harmonicRichness * 0.6,
      });
    }

    if (this.effectsChain) {
      this.effectsChain.updateSettings({
        phaserRate: 0.2 + this.settings.effectsIntensity * 0.3,
        phaserDepth: this.settings.effectsIntensity * 0.8,
        filterLfoRate: 0.05 + this.settings.modulationDepth * 0.15,
        filterLfoDepth: this.settings.effectsIntensity * 0.4,
        saturationAmount: this.settings.warmth * 0.5,
        autoPanRate: 0.08 + this.settings.modulationDepth * 0.1,
        autoPanDepth: this.settings.spatialWidth * 0.5,
        dryWet: this.settings.effectsIntensity * 0.5,
      });
    }

    if (this.modulationMatrix) {
      this.modulationMatrix.setMasterDepth(this.settings.modulationDepth);
    }

    if (this.spatialProcessor) {
      this.spatialProcessor.updateSettings({
        reverbDryWet: this.settings.spatialWidth * 0.5,
        stereoWidth: 1 + this.settings.spatialWidth * 0.8,
        autoPanDepth: this.settings.spatialWidth * 0.4,
      });
    }

    if (this.timbreEvolver) {
      this.timbreEvolver.updateSettings({
        evolutionRate: this.settings.timbreEvolution * 0.2,
        evolutionDepth: this.settings.timbreEvolution * 0.5,
        morphRate: this.settings.timbreEvolution * 0.1,
      });
    }

    if (this.spectralProcessor) {
      this.spectralProcessor.updateSettings({
        exciterAmount: this.settings.harmonicRichness * 0.4,
      });
    }

    // Update mix levels
    if (this.dryGain && this.wetGain) {
      this.dryGain.gain.rampTo(1 - this.settings.masterMix, 0.1);
      this.wetGain.gain.rampTo(this.settings.masterMix, 0.1);
    }
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<PsychedelicEngineSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    if (settings.preset && settings.preset !== 'custom') {
      this.applyPreset(settings.preset);
    } else if (this.isInitialized) {
      this.updateAllProcessors();
    }
  }

  /**
   * Set frequency for harmonic generation
   */
  setFrequency(frequency: number): void {
    if (this.harmonicEnricher) {
      this.harmonicEnricher.setFrequency(frequency);
    }
  }

  /**
   * Connect input source
   */
  connectInput(source: Tone.ToneAudioNode): void {
    if (this.input) {
      source.connect(this.input);
    }
  }

  /**
   * Connect to destination
   */
  connect(destination: Tone.ToneAudioNode): void {
    if (this.output) {
      this.output.connect(destination);
    }
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
  processOffline(inputLeft: Float32Array, inputRight: Float32Array, freqStart: number, freqEnd: number): { left: Float32Array; right: Float32Array } {
    const left = new Float32Array(inputLeft.length);
    const right = new Float32Array(inputRight.length);
    
    if (!this.settings.enabled) {
      left.set(inputLeft);
      right.set(inputRight);
      return { left, right };
    }

    // Apply dry/wet mix
    const dryLevel = 1 - this.settings.masterMix;
    const wetLevel = this.settings.masterMix;
    
    // Create copies for wet processing
    let wetLeft = new Float32Array(inputLeft.length);
    let wetRight = new Float32Array(inputRight.length);
    wetLeft.set(inputLeft);
    wetRight.set(inputRight);
    
    const mono = new Float32Array(inputLeft.length);
    for (let i = 0; i < inputLeft.length; i++) {
      mono[i] = (inputLeft[i] + inputRight[i]) * 0.5;
    }

    // Apply harmonic enrichment
    if (this.settings.harmonicsEnabled && this.harmonicEnricher) {
      const enriched = this.harmonicEnricher.processOffline(mono, freqStart, freqEnd);
      wetLeft.set(enriched);
      wetRight.set(enriched);
    }

    // Apply effects chain
    if (this.settings.effectsEnabled && this.effectsChain) {
      const processedLeft = this.effectsChain.processOffline(wetLeft, this.sampleRate);
      const processedRight = this.effectsChain.processOffline(wetRight, this.sampleRate);
      wetLeft.set(processedLeft);
      wetRight.set(processedRight);
    }

    // Apply spectral processing
    if (this.settings.spectralEnabled && this.spectralProcessor) {
      const spectralLeft = this.spectralProcessor.processOffline(wetLeft);
      const spectralRight = this.spectralProcessor.processOffline(wetRight);
      wetLeft.set(spectralLeft);
      wetRight.set(spectralRight);
    }

    // Apply spatial processing (stereo)
    if (this.settings.spatialEnabled && this.spatialProcessor) {
      const spatial = this.spatialProcessor.processOffline(wetLeft, wetRight);
      wetLeft.set(spatial.left);
      wetRight.set(spatial.right);
    }

    // Mix dry and wet
    for (let i = 0; i < inputLeft.length; i++) {
      left[i] = inputLeft[i] * dryLevel + wetLeft[i] * wetLevel;
      right[i] = inputRight[i] * dryLevel + wetRight[i] * wetLevel;
    }

    return { left, right };
  }

  /**
   * Dispose all processors
   */
  dispose(): void {
    this.harmonicEnricher?.dispose();
    this.effectsChain?.dispose();
    this.modulationMatrix?.dispose();
    this.spatialProcessor?.dispose();
    this.spectralProcessor?.dispose();
    
    this.dryGain?.dispose();
    this.wetGain?.dispose();
    this.input?.dispose();
    this.output?.dispose();
    
    this.isInitialized = false;
  }
}

// Factory function
export function createPsychedelicEngine(
  sampleRate?: number,
  settings?: Partial<PsychedelicEngineSettings>
): PsychedelicEngine {
  return new PsychedelicEngine(sampleRate, settings);
}
