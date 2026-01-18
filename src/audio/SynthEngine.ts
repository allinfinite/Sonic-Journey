/**
 * SynthEngine - Real-time Web Audio synthesis with journey scheduling
 * Enables live playback and modulation of vibroacoustic journeys
 */

import type { JourneyConfig, PhaseConfig, AudioParams, RhythmMode, EntrainmentMode } from '../types/journey';
import { ENTRAINMENT_PRESETS } from '../types/journey';
import { novaController, getNovaFrequencyForPhase } from './NovaController';

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
          this.currentParams.layers = layers;
        }
        break;
    }
  }

  /**
   * Update Nova flicker based on current phase and progress
   * Uses neural entrainment frequency bands for synchronized brain stimulation
   * 
   * Priority for frequency selection:
   * 1. Explicit nova_frequency override
   * 2. entrainment_rate (exact Hz from preset)
   * 3. rhythm_mode/entrainment_mode (band mapping)
   * 4. Interpolated from frequency range based on phase progress
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
    
    // Get current phase progress for smooth ramping
    const { progress } = this.getCurrentPhase();
    
    // Get optimal Nova frequency using the smart mapping function
    // This considers: nova_frequency > entrainment_rate > rhythm_mode > frequency ramping
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
    // Only call startFlicker if frequency changed significantly (>0.5 Hz) or flicker not running
    const freqChanged = novaState.currentFrequency === null || 
                        Math.abs(novaState.currentFrequency - novaFreq) > 0.5;
    
    if (!novaState.isFlickering || freqChanged) {
      // Double-check connection state before attempting to start flicker
      const currentState = novaController.getState();
      if (!currentState.isConnected) {
        return;
      }

      // Call startFlicker asynchronously (don't await - let it run in background)
      novaController.startFlicker(novaFreq).catch((error) => {
        console.error('Error starting Nova flicker:', error);
      });
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
    
    // Enable binaural beats (fade in)
    if (!this.binaural.enabled) {
      const binauralVolume = 0.3; // 30% volume for binaural beats (subtle background)
      if (this.binaural.left.gain) {
        this.binaural.left.gain.gain.setTargetAtTime(binauralVolume, now, rampTime);
      }
      if (this.binaural.right.gain) {
        this.binaural.right.gain.gain.setTargetAtTime(binauralVolume, now, rampTime);
      }
      this.binaural.enabled = true;
    }
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
