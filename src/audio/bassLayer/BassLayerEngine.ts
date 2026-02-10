/**
 * BassLayerEngine - Real-time bass synthesis that plays alongside user's music
 * Uses Tone.js for audio generation with BPM-synced rhythm patterns
 */

import * as Tone from 'tone';
import type { BassLayerConfig, RhythmPattern } from '../../types/bassLayer';
import { DEFAULT_BASS_LAYER_CONFIG } from '../../types/bassLayer';

export class BassLayerEngine {
  private config: BassLayerConfig;
  private oscillator: Tone.Oscillator | null = null;
  private envelopeGain: Tone.Gain | null = null;
  private filter: Tone.Filter | null = null;
  private masterGain: Tone.Gain | null = null;
  private currentLoop: Tone.Loop | null = null;
  private transport: ReturnType<typeof Tone.getTransport> | null = null;
  private isInitialized = false;
  private _isActive = false;
  private patternUsesTransport = false;
  private reactiveMode = false;

  constructor(config?: Partial<BassLayerConfig>) {
    this.config = { ...DEFAULT_BASS_LAYER_CONFIG, ...config };
  }

  private async initializeTone(): Promise<void> {
    if (this.isInitialized) return;

    await Tone.start();

    this.masterGain = new Tone.Gain(this.config.intensity).toDestination();
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 200, Q: 1 });
    this.envelopeGain = new Tone.Gain(0);
    this.oscillator = new Tone.Oscillator({ frequency: this.config.frequency, type: 'sine' });

    this.oscillator.connect(this.envelopeGain);
    this.envelopeGain.connect(this.filter);
    this.filter.connect(this.masterGain);

    this.transport = Tone.getTransport();

    this.isInitialized = true;
  }

  async start(): Promise<void> {
    if (this._isActive) return;

    await this.initializeTone();

    this.oscillator!.start();
    this.setupPattern(this.config.rhythmPattern);
    this._isActive = true;
  }

  stop(): void {
    if (!this._isActive || !this.isInitialized) return;

    // Fade out to avoid clicks
    this.envelopeGain?.gain.rampTo(0, 0.05);

    setTimeout(() => {
      this.disposeLoop();
      if (this.patternUsesTransport) {
        this.transport?.stop();
        this.patternUsesTransport = false;
      }
      this.oscillator?.stop();
      this._isActive = false;
    }, 60);
  }

  dispose(): void {
    this.stop();
    setTimeout(() => {
      this.disposeLoop();
      this.oscillator?.dispose();
      this.envelopeGain?.dispose();
      this.filter?.dispose();
      this.masterGain?.dispose();
      this.oscillator = null;
      this.envelopeGain = null;
      this.filter = null;
      this.masterGain = null;
      this.transport = null;
      this.isInitialized = false;
    }, 100);
  }

  private disposeLoop(): void {
    if (this.currentLoop) {
      this.currentLoop.stop();
      this.currentLoop.dispose();
      this.currentLoop = null;
    }
  }

  private setupPattern(pattern: RhythmPattern): void {
    this.disposeLoop();
    if (this.patternUsesTransport) {
      this.transport?.stop();
      this.patternUsesTransport = false;
    }

    switch (pattern) {
      case 'continuous':
        this.createContinuousPattern();
        break;
      case 'pulse':
        this.createPulseLoop();
        break;
      case 'breathing':
        this.createBreathingLoop();
        break;
      case 'heartbeat':
        this.createHeartbeatLoop();
        break;
      case 'subpulse':
        this.createSubPulseLoop();
        break;
    }
  }

  private createContinuousPattern(): void {
    // No loop needed, just set gain to 1
    this.envelopeGain?.gain.rampTo(1, 0.5);
  }

  private createPulseLoop(): void {
    if (!this.transport || !this.envelopeGain) return;
    this.transport.bpm.value = this.config.bpm;

    const attack = this.config.attackTime;
    const release = this.config.releaseTime;

    this.currentLoop = new Tone.Loop((time) => {
      this.envelopeGain!.gain.setValueAtTime(0, time);
      this.envelopeGain!.gain.linearRampToValueAtTime(1, time + attack);
      this.envelopeGain!.gain.linearRampToValueAtTime(0, time + attack + release);
    }, '4n');

    this.currentLoop.start(0);
    this.transport.start();
    this.patternUsesTransport = true;
  }

  private createBreathingLoop(): void {
    if (!this.transport || !this.envelopeGain) return;

    const cycleDuration = 60 / Math.max(1, this.config.bpm);
    // Use a fixed transport BPM and schedule the loop in seconds
    this.transport.bpm.value = 60;

    const half = cycleDuration / 2;

    this.currentLoop = new Tone.Loop((time) => {
      // Gentle inhale (swell up) — narrower range for a softer feel
      this.envelopeGain!.gain.setValueAtTime(0.25, time);
      this.envelopeGain!.gain.exponentialRampToValueAtTime(0.85, time + half);
      // Gentle exhale (fade down)
      this.envelopeGain!.gain.exponentialRampToValueAtTime(0.25, time + cycleDuration - 0.01);
    }, cycleDuration);

    this.currentLoop.start(0);
    this.transport.start();
    this.patternUsesTransport = true;
  }

  private createHeartbeatLoop(): void {
    if (!this.transport || !this.envelopeGain) return;
    this.transport.bpm.value = this.config.bpm;

    this.currentLoop = new Tone.Loop((time) => {
      // First beat (lub)
      this.envelopeGain!.gain.setValueAtTime(0, time);
      this.envelopeGain!.gain.linearRampToValueAtTime(1, time + 0.01);
      this.envelopeGain!.gain.linearRampToValueAtTime(0, time + 0.12);
      // Second beat (dub) — 180ms after first
      this.envelopeGain!.gain.setValueAtTime(0, time + 0.18);
      this.envelopeGain!.gain.linearRampToValueAtTime(0.7, time + 0.19);
      this.envelopeGain!.gain.linearRampToValueAtTime(0, time + 0.30);
    }, '2n');

    this.currentLoop.start(0);
    this.transport.start();
    this.patternUsesTransport = true;
  }

  private createSubPulseLoop(): void {
    if (!this.transport || !this.envelopeGain) return;
    this.transport.bpm.value = this.config.bpm;

    const attack = this.config.attackTime;
    const release = this.config.releaseTime;

    this.currentLoop = new Tone.Loop((time) => {
      this.envelopeGain!.gain.setValueAtTime(0.05, time);
      this.envelopeGain!.gain.linearRampToValueAtTime(1, time + attack);
      this.envelopeGain!.gain.linearRampToValueAtTime(0.05, time + attack + release);
    }, '2n');

    this.currentLoop.start(0);
    this.transport.start();
    this.patternUsesTransport = true;
  }

  // --- Configuration setters (live update while playing) ---

  setFrequency(hz: number): void {
    this.config.frequency = hz;
    this.oscillator?.frequency.rampTo(hz, 0.5);
  }

  setIntensity(intensity: number): void {
    this.config.intensity = Math.max(0, Math.min(1, intensity));
    this.masterGain?.gain.rampTo(this.config.intensity, 0.1);
  }

  /** Fade intensity over a longer duration (for smooth listen-mode transitions) */
  fadeIntensity(intensity: number, duration: number): void {
    this.config.intensity = Math.max(0, Math.min(1, intensity));
    this.masterGain?.gain.rampTo(this.config.intensity, duration);
  }

  setRhythmPattern(pattern: RhythmPattern): void {
    this.config.rhythmPattern = pattern;
    if (this._isActive) {
      // Fade out briefly, switch pattern, fade back in
      this.envelopeGain?.gain.rampTo(0, 0.05);
      setTimeout(() => {
        this.setupPattern(pattern);
      }, 60);
    }
  }

  setBPM(bpm: number): void {
    this.config.bpm = Math.max(1, Math.min(200, bpm));
    // For breathing, we need to recreate the loop since cycle duration changes
    if (this.config.rhythmPattern === 'breathing' && this._isActive) {
      this.setupPattern('breathing');
    } else if (this.transport && this.patternUsesTransport) {
      this.transport.bpm.value = this.config.bpm;
    }
  }

  updateConfig(partial: Partial<BassLayerConfig>): void {
    if (partial.frequency !== undefined) this.setFrequency(partial.frequency);
    if (partial.intensity !== undefined) this.setIntensity(partial.intensity);
    if (partial.bpm !== undefined) this.setBPM(partial.bpm);
    if (partial.rhythmPattern !== undefined) this.setRhythmPattern(partial.rhythmPattern);
    // Update stored config for attack/release
    if (partial.attackTime !== undefined) this.config.attackTime = partial.attackTime;
    if (partial.releaseTime !== undefined) this.config.releaseTime = partial.releaseTime;
    if (partial.musicalKey !== undefined) this.config.musicalKey = partial.musicalKey;
  }

  /** Read current envelope gain value for visualization */
  getGainValue(): number {
    if (!this.envelopeGain || !this._isActive) return 0;
    return this.envelopeGain.gain.value;
  }

  isActive(): boolean {
    return this._isActive;
  }

  getConfig(): BassLayerConfig {
    return { ...this.config };
  }

  /**
   * Enable reactive mode - disables pattern loops so the envelope
   * can be driven directly by external audio analysis each frame.
   */
  setReactiveMode(enabled: boolean): void {
    if (enabled === this.reactiveMode) return;
    this.reactiveMode = enabled;

    if (enabled && this._isActive) {
      // Stop any running pattern loop so it doesn't fight with reactive updates
      this.disposeLoop();
      if (this.patternUsesTransport) {
        this.transport?.stop();
        this.patternUsesTransport = false;
      }
    } else if (!enabled && this._isActive) {
      // Restore the configured pattern
      this.setupPattern(this.config.rhythmPattern);
    }
  }

  /**
   * Set the envelope gain directly from an external energy value (0-1).
   * Call this every animation frame in Listen mode.
   * Uses a short ramp to avoid clicks while staying responsive.
   */
  setReactiveEnergy(energy: number): void {
    if (!this.reactiveMode || !this.envelopeGain || !this._isActive) return;
    // Clamp and apply with a very short ramp for smooth but responsive tracking
    const clamped = Math.max(0, Math.min(1, energy));
    this.envelopeGain.gain.rampTo(clamped, 0.03);
  }
}
