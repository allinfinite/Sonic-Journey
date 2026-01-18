/**
 * ModulationMatrix - Flexible modulation routing system
 * Provides multiple LFOs, envelope followers, and cross-modulation
 */

import * as Tone from 'tone';

export type LFOWaveform = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'random';

export interface LFOConfig {
  id: string;
  enabled: boolean;
  waveform: LFOWaveform;
  frequency: number;        // Hz (0.001 - 20)
  phase: number;            // 0-360 degrees
  amplitude: number;        // 0-1
  offset: number;           // -1 to 1 (DC offset)
  sync: boolean;            // Sync to transport/entrainment
}

export interface ModulationRoute {
  sourceId: string;         // LFO or envelope ID
  targetParam: string;      // Parameter name to modulate
  amount: number;           // -1 to 1 (bipolar modulation depth)
  enabled: boolean;
}

export interface ModulationMatrixSettings {
  lfos: LFOConfig[];
  routes: ModulationRoute[];
  masterDepth: number;      // 0-1, scales all modulation
  smoothing: number;        // 0-1, smooths rapid modulation
}

const DEFAULT_LFO: LFOConfig = {
  id: 'lfo1',
  enabled: true,
  waveform: 'sine',
  frequency: 0.1,
  phase: 0,
  amplitude: 1,
  offset: 0,
  sync: false,
};

const DEFAULT_SETTINGS: ModulationMatrixSettings = {
  lfos: [
    { ...DEFAULT_LFO, id: 'lfo1', frequency: 0.08, waveform: 'sine' },
    { ...DEFAULT_LFO, id: 'lfo2', frequency: 0.03, waveform: 'triangle' },
    { ...DEFAULT_LFO, id: 'lfo3', frequency: 0.2, waveform: 'sine', phase: 90 },
    { ...DEFAULT_LFO, id: 'lfo4', frequency: 0.005, waveform: 'sine' }, // Very slow evolution
  ],
  routes: [],
  masterDepth: 0.7,
  smoothing: 0.3,
};

export class ModulationMatrix {
  private settings: ModulationMatrixSettings;
  private sampleRate: number;
  
  // Tone.js LFOs
  private lfos: Map<string, Tone.LFO> = new Map();
  private lfoGains: Map<string, Tone.Gain> = new Map();
  
  // Target parameters (AudioParams or custom callbacks)
  private targets: Map<string, AudioParam | ((value: number) => void)> = new Map();
  
  // For offline processing
  private lfoPhases: Map<string, number> = new Map();
  private randomValues: Map<string, number> = new Map();
  private randomCounters: Map<string, number> = new Map();
  
  private isInitialized = false;

  constructor(sampleRate: number = 48000, settings?: Partial<ModulationMatrixSettings>) {
    this.sampleRate = sampleRate;
    this.settings = { 
      ...DEFAULT_SETTINGS, 
      ...settings,
      lfos: settings?.lfos || [...DEFAULT_SETTINGS.lfos],
      routes: settings?.routes || [...DEFAULT_SETTINGS.routes],
    };
    
    // Initialize offline phases
    for (const lfo of this.settings.lfos) {
      this.lfoPhases.set(lfo.id, (lfo.phase / 360) * Math.PI * 2);
      this.randomValues.set(lfo.id, Math.random() * 2 - 1);
      this.randomCounters.set(lfo.id, 0);
    }
  }

  /**
   * Initialize Tone.js LFOs for real-time modulation
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    for (const lfoConfig of this.settings.lfos) {
      if (!lfoConfig.enabled) continue;
      
      const lfo = new Tone.LFO({
        frequency: lfoConfig.frequency,
        min: -1,
        max: 1,
        type: lfoConfig.waveform === 'random' ? 'sine' : lfoConfig.waveform,
        phase: lfoConfig.phase,
      });
      
      const gain = new Tone.Gain(lfoConfig.amplitude * this.settings.masterDepth);
      lfo.connect(gain);
      
      this.lfos.set(lfoConfig.id, lfo);
      this.lfoGains.set(lfoConfig.id, gain);
    }

    this.isInitialized = true;
  }

  /**
   * Start all LFOs
   */
  start(): void {
    for (const lfo of this.lfos.values()) {
      lfo.start();
    }
  }

  /**
   * Stop all LFOs
   */
  stop(): void {
    for (const lfo of this.lfos.values()) {
      lfo.stop();
    }
  }

  /**
   * Register a modulation target
   */
  registerTarget(name: string, target: AudioParam | ((value: number) => void)): void {
    this.targets.set(name, target);
  }

  /**
   * Add a modulation route
   */
  addRoute(route: ModulationRoute): void {
    this.settings.routes.push(route);
    this.applyRoutes();
  }

  /**
   * Remove a modulation route
   */
  removeRoute(sourceId: string, targetParam: string): void {
    this.settings.routes = this.settings.routes.filter(
      r => !(r.sourceId === sourceId && r.targetParam === targetParam)
    );
  }

  /**
   * Apply all modulation routes
   */
  private applyRoutes(): void {
    for (const route of this.settings.routes) {
      if (!route.enabled) continue;
      
      const lfoGain = this.lfoGains.get(route.sourceId);
      const target = this.targets.get(route.targetParam);
      
      if (lfoGain && target instanceof AudioParam) {
        // Scale the gain by route amount
        const scaledGain = new Tone.Gain(route.amount);
        lfoGain.connect(scaledGain);
        scaledGain.connect(target);
      }
    }
  }

  /**
   * Update LFO configuration
   */
  updateLFO(id: string, config: Partial<LFOConfig>): void {
    const index = this.settings.lfos.findIndex(l => l.id === id);
    if (index === -1) return;
    
    this.settings.lfos[index] = { ...this.settings.lfos[index], ...config };
    
    const lfo = this.lfos.get(id);
    if (lfo) {
      if (config.frequency !== undefined) {
        lfo.frequency.value = config.frequency;
      }
      if (config.waveform !== undefined && config.waveform !== 'random') {
        lfo.type = config.waveform;
      }
    }
    
    const gain = this.lfoGains.get(id);
    if (gain && config.amplitude !== undefined) {
      gain.gain.value = config.amplitude * this.settings.masterDepth;
    }
  }

  /**
   * Update master depth
   */
  setMasterDepth(depth: number): void {
    this.settings.masterDepth = depth;
    
    for (const [id, gain] of this.lfoGains) {
      const lfoConfig = this.settings.lfos.find(l => l.id === id);
      if (lfoConfig) {
        gain.gain.value = lfoConfig.amplitude * depth;
      }
    }
  }

  /**
   * Get current LFO value (for offline processing)
   */
  getLFOValue(id: string, sampleIndex: number): number {
    const lfoConfig = this.settings.lfos.find(l => l.id === id);
    if (!lfoConfig || !lfoConfig.enabled) return 0;
    
    const phase = this.lfoPhases.get(id) || 0;
    const time = sampleIndex / this.sampleRate;
    const currentPhase = phase + 2 * Math.PI * lfoConfig.frequency * time;
    
    let value: number;
    
    switch (lfoConfig.waveform) {
      case 'sine':
        value = Math.sin(currentPhase);
        break;
      case 'triangle':
        value = (2 / Math.PI) * Math.asin(Math.sin(currentPhase));
        break;
      case 'sawtooth':
        value = 2 * ((currentPhase / (2 * Math.PI)) % 1) - 1;
        break;
      case 'square':
        value = Math.sin(currentPhase) >= 0 ? 1 : -1;
        break;
      case 'random':
        // Sample-and-hold random
        const counter = this.randomCounters.get(id) || 0;
        const samplesPerCycle = Math.floor(this.sampleRate / lfoConfig.frequency);
        if (sampleIndex % samplesPerCycle === 0) {
          this.randomValues.set(id, Math.random() * 2 - 1);
        }
        this.randomCounters.set(id, counter + 1);
        value = this.randomValues.get(id) || 0;
        break;
      default:
        value = 0;
    }
    
    return (value * lfoConfig.amplitude + lfoConfig.offset) * this.settings.masterDepth;
  }

  /**
   * Get modulation value for a target parameter (offline)
   */
  getModulationValue(targetParam: string, sampleIndex: number): number {
    let totalModulation = 0;
    
    for (const route of this.settings.routes) {
      if (!route.enabled || route.targetParam !== targetParam) continue;
      
      const lfoValue = this.getLFOValue(route.sourceId, sampleIndex);
      totalModulation += lfoValue * route.amount;
    }
    
    return totalModulation;
  }

  /**
   * Process a buffer with modulation applied to a parameter
   */
  processOffline(
    input: Float32Array,
    paramName: string,
    baseValue: number,
    applyFn: (sample: number, modulatedValue: number) => number
  ): Float32Array {
    const output = new Float32Array(input.length);
    
    for (let i = 0; i < input.length; i++) {
      const modulation = this.getModulationValue(paramName, i);
      const modulatedValue = baseValue * (1 + modulation);
      output[i] = applyFn(input[i], modulatedValue);
    }
    
    return output;
  }

  /**
   * Generate modulation envelope for a parameter
   */
  generateModulationEnvelope(paramName: string, samples: number): Float32Array {
    const envelope = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      envelope[i] = 1 + this.getModulationValue(paramName, i);
    }
    
    return envelope;
  }

  /**
   * Get LFO output node for real-time connection
   */
  getLFOOutput(id: string): Tone.Gain | null {
    return this.lfoGains.get(id) || null;
  }

  /**
   * Dispose all nodes
   */
  dispose(): void {
    for (const lfo of this.lfos.values()) {
      lfo.dispose();
    }
    for (const gain of this.lfoGains.values()) {
      gain.dispose();
    }
    this.lfos.clear();
    this.lfoGains.clear();
    this.targets.clear();
    this.isInitialized = false;
  }
}

// Factory function
export function createModulationMatrix(
  sampleRate?: number,
  settings?: Partial<ModulationMatrixSettings>
): ModulationMatrix {
  return new ModulationMatrix(sampleRate, settings);
}

// Preset configurations
export const MODULATION_PRESETS = {
  subtle: {
    masterDepth: 0.3,
    lfos: [
      { ...DEFAULT_LFO, id: 'lfo1', frequency: 0.05, amplitude: 0.5 },
      { ...DEFAULT_LFO, id: 'lfo2', frequency: 0.02, amplitude: 0.3, waveform: 'triangle' as LFOWaveform },
    ],
  },
  psychedelic: {
    masterDepth: 0.7,
    lfos: [
      { ...DEFAULT_LFO, id: 'lfo1', frequency: 0.1, amplitude: 0.8 },
      { ...DEFAULT_LFO, id: 'lfo2', frequency: 0.03, amplitude: 0.6, waveform: 'triangle' as LFOWaveform },
      { ...DEFAULT_LFO, id: 'lfo3', frequency: 0.25, amplitude: 0.4, phase: 90 },
      { ...DEFAULT_LFO, id: 'lfo4', frequency: 0.008, amplitude: 1, waveform: 'sine' as LFOWaveform },
    ],
  },
  meditative: {
    masterDepth: 0.5,
    lfos: [
      { ...DEFAULT_LFO, id: 'lfo1', frequency: 0.03, amplitude: 0.6 },
      { ...DEFAULT_LFO, id: 'lfo2', frequency: 0.005, amplitude: 0.8, waveform: 'sine' as LFOWaveform },
    ],
  },
  dynamic: {
    masterDepth: 0.8,
    lfos: [
      { ...DEFAULT_LFO, id: 'lfo1', frequency: 0.15, amplitude: 0.7 },
      { ...DEFAULT_LFO, id: 'lfo2', frequency: 0.08, amplitude: 0.5, waveform: 'triangle' as LFOWaveform },
      { ...DEFAULT_LFO, id: 'lfo3', frequency: 0.4, amplitude: 0.3, phase: 45 },
      { ...DEFAULT_LFO, id: 'lfo4', frequency: 0.02, amplitude: 0.9 },
    ],
  },
};
