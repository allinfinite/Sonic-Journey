/**
 * BassPadEngine - Real-time deep bass synthesis engine for touch pad
 * Manages multiple oscillators with sub-bass frequencies (20-80 Hz)
 * Y-axis controls low-pass filter cutoff for wave variation
 */

import * as Tone from 'tone';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  frequency: number;
  filterCutoff: number;
  oscillator: Tone.Oscillator;
  filter: Tone.Filter;
  gain: Tone.Gain;
}

export interface BassPadConfig {
  frequencyMin?: number; // Default: 20 Hz
  frequencyMax?: number; // Default: 80 Hz
  filterMin?: number; // Default: 100 Hz
  filterMax?: number; // Default: 800 Hz
  masterVolume?: number; // Default: 0.5 (0-1)
}

const DEFAULT_CONFIG: Required<BassPadConfig> = {
  frequencyMin: 20,
  frequencyMax: 80,
  filterMin: 100,
  filterMax: 800,
  masterVolume: 0.5,
};

export class BassPadEngine {
  private config: Required<BassPadConfig>;
  private activeTouches: Map<number, TouchPoint> = new Map();
  private masterGain!: Tone.Gain;
  private isInitialized = false;

  constructor(config: BassPadConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (typeof window !== 'undefined') {
      this.initializeTone();
    }
  }

  /**
   * Initialize Tone.js audio context and master gain
   */
  private async initializeTone(): Promise<void> {
    if (this.isInitialized) return;

    // Ensure Tone.js context is started
    await Tone.start();

    // Create master gain for volume control and preventing clipping
    this.masterGain = new Tone.Gain(this.config.masterVolume).toDestination();

    this.isInitialized = true;
  }

  /**
   * Convert X position (0-1) to frequency in Hz
   */
  private xToFrequency(x: number): number {
    const { frequencyMin, frequencyMax } = this.config;
    return frequencyMin + (frequencyMax - frequencyMin) * x;
  }

  /**
   * Convert Y position (0-1) to filter cutoff in Hz
   * Inverted so bottom (0) = low cutoff, top (1) = high cutoff
   */
  private yToFilterCutoff(y: number): number {
    const { filterMin, filterMax } = this.config;
    // Invert Y so bottom of pad = lower cutoff
    return filterMin + (filterMax - filterMin) * (1 - y);
  }

  /**
   * Start a new tone at the given position
   */
  async startTouch(id: number, x: number, y: number): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeTone();
    }

    // Stop any existing touch with this ID
    this.stopTouch(id);

    const frequency = this.xToFrequency(x);
    const filterCutoff = this.yToFilterCutoff(y);

    // Create oscillator with sine wave for deep bass
    // Use 'sine' for pure sub-bass, or 'triangle' for slightly warmer sound
    const oscillator = new Tone.Oscillator({
      frequency,
      type: 'sine',
    });

    // Create low-pass filter for Y-axis control
    const filter = new Tone.Filter({
      type: 'lowpass',
      frequency: filterCutoff,
      Q: 1,
    });

    // Create gain node for individual touch volume control
    // Reduce volume when multiple touches to prevent clipping
    const touchGain = 0.6 / Math.max(1, this.activeTouches.size * 0.7);
    const gain = new Tone.Gain(touchGain);

    // Connect: Oscillator → Gain → Filter → Master Gain → Destination
    oscillator.connect(gain);
    gain.connect(filter);
    filter.connect(this.masterGain);

    // Start the oscillator
    oscillator.start();

    // Store touch point
    const touchPoint: TouchPoint = {
      id,
      x,
      y,
      frequency,
      filterCutoff,
      oscillator,
      filter,
      gain,
    };

    this.activeTouches.set(id, touchPoint);

    // Update all touch gains to balance volume
    this.updateTouchGains();
  }

  /**
   * Update touch position (frequency and filter)
   */
  updateTouch(id: number, x: number, y: number): void {
    const touchPoint = this.activeTouches.get(id);
    if (!touchPoint) return;

    const frequency = this.xToFrequency(x);
    const filterCutoff = this.yToFilterCutoff(y);

    // Update oscillator frequency smoothly
    touchPoint.oscillator.frequency.rampTo(frequency, 0.05);

    // Update filter cutoff
    touchPoint.filter.frequency.rampTo(filterCutoff, 0.05);

    // Update stored position
    touchPoint.x = x;
    touchPoint.y = y;
    touchPoint.frequency = frequency;
    touchPoint.filterCutoff = filterCutoff;
  }

  /**
   * Stop and remove a touch
   */
  stopTouch(id: number): void {
    const touchPoint = this.activeTouches.get(id);
    if (!touchPoint) return;

    // Stop oscillator with short release
    touchPoint.oscillator.stop();
    
    // Dispose audio nodes
    touchPoint.oscillator.dispose();
    touchPoint.filter.dispose();
    touchPoint.gain.dispose();

    this.activeTouches.delete(id);

    // Rebalance remaining touch volumes
    this.updateTouchGains();
  }

  /**
   * Stop all active touches
   */
  stopAllTouches(): void {
    const ids = Array.from(this.activeTouches.keys());
    ids.forEach(id => this.stopTouch(id));
  }

  /**
   * Update gain levels for all active touches to prevent clipping
   */
  private updateTouchGains(): void {
    const activeCount = this.activeTouches.size;
    if (activeCount === 0) return;

    // Reduce individual touch volume when multiple are active
    const baseGain = 0.6 / Math.max(1, activeCount * 0.7);

    this.activeTouches.forEach(touch => {
      touch.gain.gain.rampTo(baseGain, 0.1);
    });
  }

  /**
   * Get all active touch points (for visualization)
   */
  getActiveTouches(): TouchPoint[] {
    return Array.from(this.activeTouches.values());
  }

  /**
   * Get number of active touches
   */
  getActiveTouchCount(): number {
    return this.activeTouches.size;
  }

  /**
   * Update master volume
   */
  setMasterVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.rampTo(this.config.masterVolume, 0.1);
    }
  }

  /**
   * Cleanup and dispose all resources
   */
  dispose(): void {
    this.stopAllTouches();
    if (this.masterGain) {
      this.masterGain.dispose();
    }
    this.isInitialized = false;
  }
}
