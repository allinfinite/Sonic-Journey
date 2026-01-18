/**
 * SynthEngine - Real-time Web Audio synthesis with journey scheduling
 * Enables live playback and modulation of vibroacoustic journeys
 */

import type { JourneyConfig, PhaseConfig, AudioParams, RhythmMode, EntrainmentMode, NovaPattern } from '../types/journey';
import { ENTRAINMENT_PRESETS, NOVA_PATTERN_PRESETS } from '../types/journey';
import { novaController, getNovaFrequencyForPhase } from './NovaController';
import type { MelodyStyle, MelodyScale, NoteDensity, MelodyGeneratorConfig } from '../types/melodyGenerator';
import { foundationToMelodyRoot } from '../types/melodyGenerator';
import { createEnhancedMelodyEngine } from './melodyGenerator/EnhancedMelodyEngine';

// Map rhythm mode to entrainment mode (neural frequency bands)
const rhythmToEntrainment: Record<RhythmMode, EntrainmentMode> = {
  still: 'none',
  breathing: 'breathing',
  heartbeat: 'heartbeat',
  delta: 'delta',     // 1-4 Hz - deep sleep, trance
  theta: 'theta',     // 4-7 Hz - meditation, hypnagogic
  alpha: 'alpha',     // 8-12 Hz - visuals, flow states
  beta: 'beta',       // 13-30 Hz - focus, alertness
  gamma: 'gamma',     // 30-50 Hz - cognitive enhancement
};

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private isPaused = false;
  private journeyConfig: JourneyConfig | null = null;

  // Timing
  private startTime = 0;
  private pausedAt = 0;
  private _currentTime = 0;

  // Audio nodes
  private foundation: { osc: OscillatorNode | null; gain: GainNode | null; freq: number } = {
    osc: null,
    gain: null,
    freq: 40,
  };
  private harmony: { osc: OscillatorNode | null; gain: GainNode | null; freq: number } = {
    osc: null,
    gain: null,
    freq: 35,
  };
  private atmosphere: { osc: OscillatorNode | null; gain: GainNode | null; freq: number } = {
    osc: null,
    gain: null,
    freq: 80,
  };
  private lfo: { osc: OscillatorNode | null; gain: GainNode | null } = { osc: null, gain: null };
  private fmLfo: { osc: OscillatorNode | null; gain: GainNode | null } = { osc: null, gain: null };
  private master: GainNode | null = null;
  
  // Binaural beats
  private binaural: {
    left: { osc: OscillatorNode | null; gain: GainNode | null; panner: StereoPannerNode | null };
    right: { osc: OscillatorNode | null; gain: GainNode | null; panner: StereoPannerNode | null };
    enabled: boolean;
    beatFreq: number | null;
    carrierFreq: number;
  } = {
    left: { osc: null, gain: null, panner: null },
    right: { osc: null, gain: null, panner: null },
    enabled: false,
    beatFreq: null,
    carrierFreq: 200, // Default carrier frequency
  };

  // Melody layer - enhanced with Tone.js
  private melody: {
    enhancedEngine: ReturnType<typeof createEnhancedMelodyEngine> | null;
    enabled: boolean;
    style: MelodyStyle;
    scale: MelodyScale;
    intensity: number;
    density: NoteDensity;
    currentPhase: PhaseConfig | null;
  } = {
    enhancedEngine: null,
    enabled: false,
    style: 'mixed',
    scale: 'pentatonic_minor',
    intensity: 0.3,
    density: 'moderate',
    currentPhase: null,
  };

  // Current parameters
  private currentParams: AudioParams = {
    foundationFreq: 40,
    harmonyFreq: 35,
    intensity: 0.5,
    rhythmMode: 'breathing',
    rhythmRate: 0.083,
    flowDepth: 0,
    layers: {
      foundation: true,
      harmony: true,
      atmosphere: false,
      melody: false,
    },
  };

  // Animation
  private animationId: number | null = null;
  private manualOverride = false;
  private manualOverrideTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastNovaUpdateTime = 0; // Debounce Nova updates
  private novaUpdateDebounceMs = 500; // Only update Nova every 500ms

  // Callbacks
  private onTimeUpdate?: (time: number) => void;
  private onPlayStateChange?: (isPlaying: boolean) => void;
  private onPhaseChange?: (phaseIndex: number, phase: PhaseConfig) => void;

  get currentTime(): number {
    return this._currentTime;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get totalDuration(): number {
    return (this.journeyConfig?.duration_minutes || 90) * 60;
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: {
    onTimeUpdate?: (time: number) => void;
    onPlayStateChange?: (isPlaying: boolean) => void;
    onPhaseChange?: (phaseIndex: number, phase: PhaseConfig) => void;
  }) {
    this.onTimeUpdate = callbacks.onTimeUpdate;
    this.onPlayStateChange = callbacks.onPlayStateChange;
    this.onPhaseChange = callbacks.onPhaseChange;
  }

  /**
   * Initialize the audio context (must be called from user interaction)
   */
  init(): void {
    if (this.ctx) return;

    this.ctx = new AudioContext();
    this.createAudioGraph();
  }

  /**
   * Create the audio processing graph
   */
  private createAudioGraph(): void {
    if (!this.ctx) return;

    // Master gain
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    // Foundation oscillator (base carrier)
    this.foundation.osc = this.ctx.createOscillator();
    this.foundation.osc.type = 'sine';
    this.foundation.osc.frequency.value = this.currentParams.foundationFreq;
    this.foundation.gain = this.ctx.createGain();
    this.foundation.gain.gain.value = 0.7;
    this.foundation.osc.connect(this.foundation.gain);
    this.foundation.gain.connect(this.master);

    // Harmony oscillator (support carrier)
    this.harmony.osc = this.ctx.createOscillator();
    this.harmony.osc.type = 'sine';
    this.harmony.osc.frequency.value = this.currentParams.harmonyFreq;
    this.harmony.gain = this.ctx.createGain();
    this.harmony.gain.gain.value = 0.4;
    this.harmony.osc.connect(this.harmony.gain);
    this.harmony.gain.connect(this.master);

    // Atmosphere oscillator (texture layer - first harmonic)
    this.atmosphere.osc = this.ctx.createOscillator();
    this.atmosphere.osc.type = 'sine';
    this.atmosphere.osc.frequency.value = this.currentParams.foundationFreq * 2;
    this.atmosphere.gain = this.ctx.createGain();
    this.atmosphere.gain.gain.value = 0;
    this.atmosphere.osc.connect(this.atmosphere.gain);
    this.atmosphere.gain.connect(this.master);

    // Entrainment LFO (amplitude modulation)
    this.lfo.osc = this.ctx.createOscillator();
    this.lfo.osc.type = 'sine';
    this.lfo.osc.frequency.value = this.currentParams.rhythmRate;
    this.lfo.gain = this.ctx.createGain();
    this.lfo.gain.gain.value = 0.15;
    this.lfo.osc.connect(this.lfo.gain);
    this.lfo.gain.connect(this.master.gain);

    // FM LFO (frequency modulation for "flow")
    this.fmLfo.osc = this.ctx.createOscillator();
    this.fmLfo.osc.type = 'sine';
    this.fmLfo.osc.frequency.value = 0.1;
    this.fmLfo.gain = this.ctx.createGain();
    this.fmLfo.gain.gain.value = 0;
    this.fmLfo.osc.connect(this.fmLfo.gain);
    this.fmLfo.gain.connect(this.foundation.osc.frequency);
    this.fmLfo.gain.connect(this.harmony.osc.frequency);

    // Binaural beats - left and right oscillators
    this.binaural.left.osc = this.ctx.createOscillator();
    this.binaural.left.osc.type = 'sine';
    this.binaural.left.gain = this.ctx.createGain();
    this.binaural.left.gain.gain.value = 0; // Start muted
    this.binaural.left.panner = this.ctx.createStereoPanner();
    this.binaural.left.panner.pan.value = -1; // Full left
    this.binaural.left.osc.connect(this.binaural.left.gain);
    this.binaural.left.gain.connect(this.binaural.left.panner);
    this.binaural.left.panner.connect(this.master);

    this.binaural.right.osc = this.ctx.createOscillator();
    this.binaural.right.osc.type = 'sine';
    this.binaural.right.gain = this.ctx.createGain();
    this.binaural.right.gain.gain.value = 0; // Start muted
    this.binaural.right.panner = this.ctx.createStereoPanner();
    this.binaural.right.panner.pan.value = 1; // Full right
    this.binaural.right.osc.connect(this.binaural.right.gain);
    this.binaural.right.gain.connect(this.binaural.right.panner);
    this.binaural.right.panner.connect(this.master);

    // Melody layer - will be initialized with Tone.js when needed
    // Tone.js handles its own audio graph

    // Start all oscillators
    this.foundation.osc.start();
    this.harmony.osc.start();
    this.atmosphere.osc.start();
    this.lfo.osc.start();
    this.fmLfo.osc.start();
    this.binaural.left.osc.start();
    this.binaural.right.osc.start();
  }

  /**
   * Set the journey configuration
   */
  setJourneyConfig(config: JourneyConfig): void {
    this.journeyConfig = config;

    if (config.layers) {
      this.currentParams.layers.foundation = config.layers.base_carrier !== false;
      this.currentParams.layers.harmony = config.layers.support_carrier !== false;
      this.currentParams.layers.atmosphere = config.layers.texture_layer === true;
      this.currentParams.layers.melody = config.layers.melody_layer === true;
    }

    if (this.isPlaying) {
      this.updateFromTimeline();
    }
  }

  /**
   * Start or resume playback
   */
  play(): void {
    if (!this.ctx) this.init();

    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().then(() => this.startPlayback());
    } else {
      this.startPlayback();
    }
  }

  private startPlayback(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = (this.ctx?.currentTime || 0) - this.pausedAt;

    // Fade in master
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0, now);
      this.master.gain.linearRampToValueAtTime(this.currentParams.intensity, now + 0.3);
    }

    this.tick();
    this.onPlayStateChange?.(true);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.ctx) return;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.isPlaying) {
      this.pausedAt = this._currentTime;
    }

    this.isPlaying = false;
    this.isPaused = true;

    // Immediately set gain to 0 and suspend context
    const now = this.ctx.currentTime;
    this.master?.gain.cancelScheduledValues(now);
    this.master?.gain.setValueAtTime(0, now);

    this.ctx.suspend();
    
    // Pause Nova flicker (but don't turn off light)
    novaController.stopFlicker();

    // Pause binaural beats
    if (this.binaural.enabled && this.ctx) {
      const now = this.ctx.currentTime;
      const rampTime = 0.3;
      if (this.binaural.left.gain) {
        this.binaural.left.gain.gain.setTargetAtTime(0, now, rampTime);
      }
      if (this.binaural.right.gain) {
        this.binaural.right.gain.gain.setTargetAtTime(0, now, rampTime);
      }
    }

    // Pause melody layer
    if (this.melody.enabled && this.melody.enhancedEngine) {
      this.melody.enhancedEngine.stop();
    }

    this.onPlayStateChange?.(false);
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    if (!this.ctx) return;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this._currentTime = 0;

    const now = this.ctx.currentTime;
    this.master?.gain.cancelScheduledValues(now);
    this.master?.gain.setValueAtTime(0, now);
    this.ctx.suspend();

    // Stop Nova flicker
    novaController.stopFlicker();

    // Stop binaural beats
    if (this.binaural.enabled && this.ctx) {
      const now = this.ctx.currentTime;
      const rampTime = 0.3;
      if (this.binaural.left.gain) {
        this.binaural.left.gain.gain.setTargetAtTime(0, now, rampTime);
      }
      if (this.binaural.right.gain) {
        this.binaural.right.gain.gain.setTargetAtTime(0, now, rampTime);
      }
      this.binaural.enabled = false;
      this.binaural.beatFreq = null;
    }

    // Stop melody layer
    if (this.melody.enhancedEngine) {
      this.melody.enhancedEngine.stop();
      this.melody.enhancedEngine.dispose();
      this.melody.enhancedEngine = null;
    }
    this.melody.enabled = false;
    this.melody.currentPhase = null;

    this.onTimeUpdate?.(0);
    this.onPlayStateChange?.(false);
  }

  /**
   * Seek to a specific position
   */
  seek(timeSeconds: number): void {
    const totalDuration = this.totalDuration;
    this.pausedAt = Math.max(0, Math.min(timeSeconds, totalDuration));
    this._currentTime = this.pausedAt;

    if (this.isPlaying && this.ctx) {
      this.startTime = this.ctx.currentTime - this.pausedAt;
      this.updateFromTimeline();
    }

    this.onTimeUpdate?.(this._currentTime);
  }

  /**
   * Update loop
   */
  private tick = (): void => {
    if (!this.isPlaying || !this.ctx) return;

    this._currentTime = this.ctx.currentTime - this.startTime;

    if (this._currentTime >= this.totalDuration) {
      this.stop();
      return;
    }

    if (!this.manualOverride) {
      this.updateFromTimeline();
    }

    this.onTimeUpdate?.(this._currentTime);
    this.animationId = requestAnimationFrame(this.tick);
  };

  /**
   * Update audio parameters from journey timeline
   */
  private updateFromTimeline(): void {
    if (!this.journeyConfig || !this.ctx) return;

    const { phaseIndex, progress, phase } = this.getCurrentPhase();
    if (!phase) return;

    // Interpolate frequency
    const freq =
      phase.frequency.start + (phase.frequency.end - phase.frequency.start) * progress;
    const amp =
      phase.amplitude.start + (phase.amplitude.end - phase.amplitude.start) * progress;

    // Get rhythm settings
    const rhythmMode = phase.rhythm_mode || 'breathing';
    const entrainmentMode = rhythmToEntrainment[rhythmMode];
    const preset = ENTRAINMENT_PRESETS[entrainmentMode];

    // Schedule smooth parameter changes
    const now = this.ctx.currentTime;
    const rampTime = 0.5;

    // Foundation frequency
    if (this.foundation.osc && Math.abs(this.foundation.freq - freq) > 0.1) {
      this.foundation.osc.frequency.setTargetAtTime(freq, now, rampTime);
      this.foundation.freq = freq;
    }

    // Harmony frequency (slightly lower)
    const harmonyFreq = freq - 5;
    if (this.harmony.osc && Math.abs(this.harmony.freq - harmonyFreq) > 0.1) {
      this.harmony.osc.frequency.setTargetAtTime(harmonyFreq, now, rampTime);
      this.harmony.freq = harmonyFreq;
    }

    // Atmosphere frequency (first harmonic)
    if (this.atmosphere.osc) {
      this.atmosphere.osc.frequency.setTargetAtTime(freq * 2, now, rampTime);
    }

    // Intensity (master gain)
    if (this.master && Math.abs(this.currentParams.intensity - amp) > 0.01) {
      this.master.gain.setTargetAtTime(amp, now, rampTime);
      this.currentParams.intensity = amp;
    }

    // LFO rate (rhythm)
    if (this.lfo.osc && preset.rate > 0) {
      this.lfo.osc.frequency.setTargetAtTime(preset.rate, now, rampTime);
      this.lfo.gain?.gain.setTargetAtTime(preset.depth, now, rampTime);
    } else if (this.lfo.gain) {
      this.lfo.gain.gain.setTargetAtTime(0, now, rampTime);
    }

    // FM depth
    const fmDepth = phase.fm_depth || 0;
    if (this.fmLfo.gain) {
      this.fmLfo.gain.gain.setTargetAtTime(fmDepth * 2, now, rampTime);
    }

    // Layer gains
    if (this.foundation.gain) {
      this.foundation.gain.gain.setTargetAtTime(
        this.currentParams.layers.foundation ? 0.7 : 0,
        now,
        rampTime
      );
    }
    if (this.harmony.gain) {
      this.harmony.gain.gain.setTargetAtTime(
        this.currentParams.layers.harmony ? 0.4 : 0,
        now,
        rampTime
      );
    }
    if (this.atmosphere.gain) {
      this.atmosphere.gain.gain.setTargetAtTime(
        this.currentParams.layers.atmosphere ? 0.15 : 0,
        now,
        rampTime
      );
    }

    // Notify phase change
    this.onPhaseChange?.(phaseIndex, phase);
    
    // Update Nova flicker if enabled (debounced to prevent rapid calls)
    const novaUpdateTime = Date.now();
    if (novaUpdateTime - this.lastNovaUpdateTime >= this.novaUpdateDebounceMs) {
      this.updateNovaFlicker(phase);
      this.lastNovaUpdateTime = novaUpdateTime;
    }
    
    // Update binaural beats if enabled
    this.updateBinauralBeats(phase);
    
    // Update melody layer if enabled (async, fire-and-forget)
    this.updateMelody(phase, freq, entrainmentMode).catch(() => {
      // Silently handle errors
    });
  }

  /**
   * Get current phase information
   */
  getCurrentPhase(): { phaseIndex: number; progress: number; phase: PhaseConfig | null } {
    if (!this.journeyConfig) {
      return { phaseIndex: -1, progress: 0, phase: null };
    }

    let elapsed = 0;
    for (let i = 0; i < this.journeyConfig.phases.length; i++) {
      const phase = this.journeyConfig.phases[i];
      const phaseDuration = phase.duration * 60;

      if (this._currentTime < elapsed + phaseDuration) {
        const phaseTime = this._currentTime - elapsed;
        const progress = phaseTime / phaseDuration;
        return { phaseIndex: i, progress, phase };
      }

      elapsed += phaseDuration;
    }

    // Past the end
    const lastIndex = this.journeyConfig.phases.length - 1;
    return {
      phaseIndex: lastIndex,
      progress: 1,
      phase: this.journeyConfig.phases[lastIndex],
    };
  }

  /**
   * Manually update a parameter (live modulation)
   */
  updateParameter(param: keyof AudioParams, value: number | RhythmMode | AudioParams['layers']): void {
    if (!this.ctx) return;

    this.manualOverride = true;

    if (this.manualOverrideTimeout) {
      clearTimeout(this.manualOverrideTimeout);
    }

    this.manualOverrideTimeout = setTimeout(() => {
      this.manualOverride = false;
    }, 3000);

    const now = this.ctx.currentTime;
    const rampTime = 0.1;

    switch (param) {
      case 'foundationFreq':
        if (this.foundation.osc && typeof value === 'number') {
          this.foundation.osc.frequency.setTargetAtTime(value, now, rampTime);
          this.foundation.freq = value;
          this.currentParams.foundationFreq = value;
        }
        break;

      case 'harmonyFreq':
        if (this.harmony.osc && typeof value === 'number') {
          this.harmony.osc.frequency.setTargetAtTime(value, now, rampTime);
          this.harmony.freq = value;
          this.currentParams.harmonyFreq = value;
        }
        break;

      case 'intensity':
        if (this.master && typeof value === 'number') {
          this.master.gain.setTargetAtTime(value, now, rampTime);
          this.currentParams.intensity = value;
        }
        break;

      case 'rhythmMode':
        if (typeof value === 'string') {
          const entrainmentMode = rhythmToEntrainment[value as RhythmMode];
          const preset = ENTRAINMENT_PRESETS[entrainmentMode];
          if (this.lfo.osc && this.lfo.gain) {
            if (preset.rate > 0) {
              this.lfo.osc.frequency.setTargetAtTime(preset.rate, now, rampTime);
              this.lfo.gain.gain.setTargetAtTime(preset.depth, now, rampTime);
            } else {
              this.lfo.gain.gain.setTargetAtTime(0, now, rampTime);
            }
          }
          this.currentParams.rhythmMode = value as RhythmMode;
          this.currentParams.rhythmRate = preset.rate;
        }
        break;

      case 'flowDepth':
        if (this.fmLfo.gain && typeof value === 'number') {
          this.fmLfo.gain.gain.setTargetAtTime(value * 2, now, rampTime);
          this.currentParams.flowDepth = value;
        }
        break;

      case 'layers':
        if (typeof value === 'object') {
          const layers = value as AudioParams['layers'];
          if (this.foundation.gain) {
            this.foundation.gain.gain.setTargetAtTime(layers.foundation ? 0.7 : 0, now, rampTime);
          }
          if (this.harmony.gain) {
            this.harmony.gain.gain.setTargetAtTime(layers.harmony ? 0.4 : 0, now, rampTime);
          }
          if (this.atmosphere.gain) {
            this.atmosphere.gain.gain.setTargetAtTime(layers.atmosphere ? 0.15 : 0, now, rampTime);
          }
          if (this.melody.enhancedEngine) {
            if (layers.melody) {
              this.melody.enhancedEngine.setVolume(this.melody.intensity);
            } else {
              this.melody.enhancedEngine.stop();
            }
            this.melody.enabled = layers.melody;
          }
          this.currentParams.layers = layers;
        }
        break;
    }
  }

  /**
   * Update Nova flicker based on current phase and progress
   * Supports both simple steady flickering and complex patterns
   * 
   * Priority for flicker control:
   * 1. nova_pattern (complex pattern with sweeps, bursts, etc.)
   * 2. nova_frequency (explicit frequency override)
   * 3. entrainment_rate (exact Hz from preset)
   * 4. rhythm_mode/entrainment_mode (band mapping)
   * 5. Interpolated from frequency range based on phase progress
   */
  private updateNovaFlicker(phase: PhaseConfig | null): void {
    if (!phase || !this.journeyConfig) return;
    
    const novaState = novaController.getState();
    if (!novaState.isConnected) return;
    
    // Check if Nova is enabled for journey and phase
    const journeyNovaEnabled = this.journeyConfig.nova_enabled !== false;
    const phaseNovaEnabled = phase.nova_enabled !== false;
    
    if (!journeyNovaEnabled || !phaseNovaEnabled) {
      // Nova disabled for this phase, stop flicker
      if (novaState.isFlickering) {
        novaController.stopFlicker();
      }
      return;
    }
    
    // Get phase duration in milliseconds
    const phaseDurationMs = phase.duration * 60 * 1000;
    
    // Check if phase has a complex pattern
    if (phase.nova_pattern) {
      // Use pattern-based flicker
      const pattern = phase.nova_pattern;
      
      // Only start pattern if not already running this pattern type
      // or if pattern config changed
      const patternChanged = novaState.patternType !== pattern.type ||
                             novaState.currentPattern?.baseFrequency !== pattern.baseFrequency;
      
      if (!novaState.isFlickering || patternChanged) {
        const currentState = novaController.getState();
        if (!currentState.isConnected) return;
        
        novaController.startPattern(pattern, phaseDurationMs).catch(() => {
          // Silently handle Nova pattern errors
        });
      }
      return;
    }
    
    // No explicit pattern - create one based on rhythm_mode for more interesting effects
    // This automatically upgrades simple configs to use patterns
    const autoPattern = this.createAutoPattern(phase, phaseDurationMs);
    
    if (autoPattern) {
      // Only start if pattern changed or not flickering
      const patternChanged = novaState.patternType !== autoPattern.type ||
                             novaState.currentPattern?.baseFrequency !== autoPattern.baseFrequency;
      
      if (!novaState.isFlickering || patternChanged) {
        const currentState = novaController.getState();
        if (!currentState.isConnected) return;
        
        novaController.startPattern(autoPattern, phaseDurationMs).catch(() => {
          // Silently handle Nova auto-pattern errors
        });
      }
      return;
    }
    
    // Fallback to simple frequency-based flicker
    const { progress } = this.getCurrentPhase();
    const novaFreq = getNovaFrequencyForPhase({
      nova_frequency: phase.nova_frequency,
      entrainment_rate: phase.entrainment_rate,
      rhythm_mode: phase.rhythm_mode,
      entrainment_mode: phase.entrainment_mode,
      frequency: phase.frequency,
    }, progress);
    
    // Skip if frequency is 0 (no flicker mode)
    if (novaFreq <= 0) {
      if (novaState.isFlickering) {
        novaController.stopFlicker();
      }
      return;
    }
    
    // Start or update flicker
    const freqChanged = novaState.currentFrequency === null || 
                        Math.abs(novaState.currentFrequency - novaFreq) > 0.5;
    
    if (!novaState.isFlickering || freqChanged) {
      const currentState = novaController.getState();
      if (!currentState.isConnected) return;

      novaController.startFlicker(novaFreq).catch(() => {
        // Silently handle Nova flicker errors
      });
    }
  }

  /**
   * Create an automatic pattern based on rhythm_mode and phase characteristics
   * This makes journeys more dynamic even without explicit pattern config
   */
  private createAutoPattern(phase: PhaseConfig, _phaseDurationMs: number): NovaPattern | null {
    const mode = phase.rhythm_mode || phase.entrainment_mode;
    
    // Check if frequency range changes significantly (creates automatic sweep)
    const freqChange = phase.frequency ? Math.abs(phase.frequency.end - phase.frequency.start) : 0;
    
    if (freqChange > 3) {
      // Significant frequency change - create a sweep pattern
      const startFreq = phase.frequency!.start <= 30 
        ? Math.max(1, Math.round(phase.frequency!.start)) 
        : 10;
      const endFreq = phase.frequency!.end <= 30 
        ? Math.max(1, Math.round(phase.frequency!.end)) 
        : 10;
      
      return {
        type: 'sweep',
        baseFrequency: startFreq,
        targetFrequency: endFreq,
        randomVariation: 10, // Slight organic feel
      };
    }
    
    // Map rhythm mode to interesting patterns
    switch (mode) {
      case 'breathing':
        // Breathing mode: wave pattern that flows with breath
        return NOVA_PATTERN_PRESETS.organic_alpha || {
          type: 'wave',
          baseFrequency: 10,
          waveAmplitude: 2,
          wavePeriod: 12000, // Match typical breath cycle
          randomVariation: 15,
        };
        
      case 'heartbeat':
        // Heartbeat mode: rhythmic heartbeat pattern
        return NOVA_PATTERN_PRESETS.heartbeat || {
          type: 'rhythm',
          baseFrequency: 10,
          rhythmPattern: [100, 200, 100, 600], // lub-dub
        };
        
      case 'theta':
        // Theta: gentle wave for meditation
        return {
          type: 'wave',
          baseFrequency: phase.entrainment_rate || 6,
          waveAmplitude: 1,
          wavePeriod: 10000,
          randomVariation: 10,
        };
        
      case 'alpha':
        // Alpha: wave pattern for visuals
        return {
          type: 'wave',
          baseFrequency: phase.entrainment_rate || 10,
          waveAmplitude: 1.5,
          wavePeriod: 6000,
          randomVariation: 15,
        };
        
      case 'delta':
        // Delta: very slow, gentle wave
        return {
          type: 'wave',
          baseFrequency: phase.entrainment_rate || 3,
          waveAmplitude: 0.5,
          wavePeriod: 15000,
          randomVariation: 20,
        };
        
      case 'beta':
        // Beta: burst pattern for focus/activation
        return {
          type: 'burst',
          baseFrequency: phase.entrainment_rate || 15,
          burstCount: 5,
          burstGap: 400,
        };
        
      case 'gamma':
        // Gamma: steady with slight variation
        return {
          type: 'steady',
          baseFrequency: 40,
          randomVariation: 5,
        };
        
      default:
        // No special pattern needed - return null to use simple frequency
        return null;
    }
  }

  /**
   * Update binaural beats based on current phase
   */
  private updateBinauralBeats(phase: PhaseConfig | null): void {
    if (!phase || !this.ctx) return;
    
    // Check if binaural beats are enabled for this phase
    const binauralEnabled = phase.binaural_enabled === true;
    
    if (!binauralEnabled) {
      // Disable binaural beats
      if (this.binaural.enabled) {
        const now = this.ctx.currentTime;
        const rampTime = 0.3;
        if (this.binaural.left.gain) {
          this.binaural.left.gain.gain.setTargetAtTime(0, now, rampTime);
        }
        if (this.binaural.right.gain) {
          this.binaural.right.gain.gain.setTargetAtTime(0, now, rampTime);
        }
        this.binaural.enabled = false;
        this.binaural.beatFreq = null;
      }
      return;
    }
    
    // Determine binaural beat frequency using entrainment science
    // Priority: binaural_beat_frequency > entrainment_rate > rhythm_mode > frequency range
    let beatFreq: number;
    
    if (phase.binaural_beat_frequency !== undefined && phase.binaural_beat_frequency > 0) {
      // 1. Explicit binaural beat frequency
      beatFreq = phase.binaural_beat_frequency;
    } else if (phase.entrainment_rate !== undefined && phase.entrainment_rate > 0) {
      // 2. Use entrainment_rate (exact Hz from preset) - capped at 30 Hz for binaural
      beatFreq = Math.min(30, phase.entrainment_rate);
    } else if (phase.rhythm_mode || phase.entrainment_mode) {
      // 3. Map from rhythm_mode/entrainment_mode
      const mode = phase.rhythm_mode || phase.entrainment_mode;
      switch (mode) {
        case 'delta': beatFreq = 3; break;    // Delta: deep sleep, trance
        case 'theta': beatFreq = 6; break;    // Theta: meditation, hypnagogic
        case 'alpha': beatFreq = 10; break;   // Alpha: visuals, flow states
        case 'beta': beatFreq = 15; break;    // Beta: focus, alertness
        case 'gamma': beatFreq = 30; break;   // Gamma: cognitive (capped for binaural)
        case 'breathing': beatFreq = 10; break; // Alpha for calm breathing
        case 'heartbeat': beatFreq = 10; break; // Alpha for grounded rhythm
        default: beatFreq = 10; break;        // Default to alpha
      }
    } else {
      // 4. Map from audio frequency range with progress interpolation
      const { progress } = this.getCurrentPhase();
      const interpolatedFreq = phase.frequency.start + (phase.frequency.end - phase.frequency.start) * progress;
      if (interpolatedFreq <= 4) beatFreq = 3;        // Delta
      else if (interpolatedFreq <= 7) beatFreq = 6;   // Theta
      else if (interpolatedFreq <= 12) beatFreq = 10; // Alpha
      else if (interpolatedFreq <= 30) beatFreq = 15; // Beta
      else beatFreq = 10;                              // Default to Alpha
    }
    
    // Carrier frequency (default 200 Hz, optimal range 100-400 Hz)
    const carrierFreq = phase.binaural_carrier_frequency || 200;
    
    // Calculate left and right frequencies
    // Left: carrier - beatFreq/2, Right: carrier + beatFreq/2
    const leftFreq = carrierFreq - beatFreq / 2;
    const rightFreq = carrierFreq + beatFreq / 2;
    
    const now = this.ctx.currentTime;
    const rampTime = 0.5;
    
    // Update frequencies if changed
    if (!this.binaural.enabled || this.binaural.beatFreq !== beatFreq || this.binaural.carrierFreq !== carrierFreq) {
      if (this.binaural.left.osc) {
        this.binaural.left.osc.frequency.setTargetAtTime(leftFreq, now, rampTime);
      }
      if (this.binaural.right.osc) {
        this.binaural.right.osc.frequency.setTargetAtTime(rightFreq, now, rampTime);
      }
      
      this.binaural.beatFreq = beatFreq;
      this.binaural.carrierFreq = carrierFreq;
    }
    
    // Get waveform type (default 'sine')
    const waveform = phase.binaural_waveform || 'sine';
    if (this.binaural.left.osc) {
      this.binaural.left.osc.type = waveform;
    }
    if (this.binaural.right.osc) {
      this.binaural.right.osc.type = waveform;
    }
    
    // Enable binaural beats (fade in)
    if (!this.binaural.enabled) {
      const binauralVolume = phase.binaural_volume ?? 0.3; // Default 30% volume
      if (this.binaural.left.gain) {
        this.binaural.left.gain.gain.setTargetAtTime(binauralVolume, now, rampTime);
      }
      if (this.binaural.right.gain) {
        this.binaural.right.gain.gain.setTargetAtTime(binauralVolume, now, rampTime);
      }
      this.binaural.enabled = true;
    } else {
      // Update volume if changed
      const binauralVolume = phase.binaural_volume ?? 0.3;
      if (this.binaural.left.gain) {
        this.binaural.left.gain.gain.setTargetAtTime(binauralVolume, now, rampTime);
      }
      if (this.binaural.right.gain) {
        this.binaural.right.gain.gain.setTargetAtTime(binauralVolume, now, rampTime);
      }
    }
  }

  /**
   * Update melody layer based on current phase
   */
  private async updateMelody(phase: PhaseConfig | null, foundationFreq: number, entrainmentMode: EntrainmentMode): Promise<void> {
    if (!phase || !this.ctx) return;

    // Check if melody is enabled for this phase
    const melodyEnabled = (this.journeyConfig?.layers?.melody_layer === true) && 
                          (phase.melody_enabled !== false);

    if (!melodyEnabled) {
      // Disable melody
      if (this.melody.enabled && this.melody.enhancedEngine) {
        this.melody.enhancedEngine.stop();
        this.melody.enabled = false;
      }
      return;
    }
    
    // Debug: log when melody should be enabled
    if (!this.melody.enabled) {
      console.log('Enabling melody layer', {
        melody_layer: this.journeyConfig?.layers?.melody_layer,
        melody_enabled: phase.melody_enabled,
        style: phase.melody_style || 'mixed',
        scale: phase.melody_scale || 'pentatonic_minor',
      });
    }

    // Get melody settings from phase or use defaults
    const style = phase.melody_style || 'mixed';
    const scale = phase.melody_scale || 'pentatonic_minor';
    const intensity = phase.melody_intensity ?? 0.3;
    const density = phase.melody_density || 'moderate';

    // Check if we need to recreate the engine (style/scale changed)
    const needsRecreate = !this.melody.enhancedEngine || 
                         this.melody.style !== style ||
                         this.melody.scale !== scale ||
                         this.melody.currentPhase !== phase;

    if (needsRecreate) {
      // Dispose old engine
      if (this.melody.enhancedEngine) {
        this.melody.enhancedEngine.dispose();
      }

      // Create new enhanced engine
      const config: MelodyGeneratorConfig = {
        frequencyMin: 200,
        frequencyMax: 800,
        rootFrequency: foundationToMelodyRoot(foundationFreq),
        scale,
        intensity,
        droneWeight: style === 'drone' ? 1 : 0,
        arpeggioWeight: style === 'arpeggio' ? 1 : 0,
        evolvingWeight: style === 'evolving' ? 1 : 0,
        harmonicWeight: style === 'harmonic' ? 1 : 0,
        noteDensity: density,
        stereoWidth: 0.6,
        spaceAmount: 0.6,
        attackTime: 0.1,
        releaseTime: 0.5,
        filterCutoff: 2000,
        filterResonance: 0.2,
      };

      this.melody.enhancedEngine = createEnhancedMelodyEngine(config, {
        reverbAmount: 0.6,
        delayTime: 0.3,
        delayFeedback: 0.25,
        chorusDepth: 0.5,
      });

      // Initialize and start
      try {
        // Set Tone.js to use the same AudioContext
        if (this.ctx && typeof window !== 'undefined') {
          const Tone = await import('tone');
          if (Tone.context.state !== 'running') {
            await Tone.context.resume();
          }
        }
        
        await this.melody.enhancedEngine.initialize();
        await this.melody.enhancedEngine.start(
          foundationFreq,
          style,
          scale,
          density,
          entrainmentMode
        );
      } catch (error) {
        // Log error for debugging
        console.error('Failed to start enhanced melody engine:', error);
        return;
      }
    }

    // Update volume if changed
    if (this.melody.intensity !== intensity && this.melody.enhancedEngine) {
      this.melody.enhancedEngine.setVolume(intensity);
    }

    // Update state
    this.melody.enabled = true;
    this.melody.style = style;
    this.melody.scale = scale;
    this.melody.intensity = intensity;
    this.melody.density = density;
    this.melody.currentPhase = phase;
  }


  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

// Create singleton instance
export const synthEngine = new SynthEngine();
