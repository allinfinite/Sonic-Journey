/**
 * NovaPatternEngine - Generates complex flicker patterns for the Nova device
 * 
 * Instead of simple steady flickering, this engine creates dynamic, evolving
 * light experiences through timing variations:
 * 
 * - sweep: Smooth frequency transitions (e.g., 10Hz → 6Hz over time)
 * - burst: Groups of rapid flashes with pauses (attention-grabbing)
 * - rhythm: Custom on/off patterns (heartbeat, breathing)
 * - wave: Sinusoidal frequency modulation (organic feel)
 * - pulse: Duty cycle variation (intensity simulation)
 * - random: Timing jitter for natural feel
 */

import type { NovaPattern, NovaPatternType } from '../types/journey';

export interface PatternState {
  // Current pattern config
  pattern: NovaPattern | null;
  
  // Timing state
  startTime: number;           // When pattern started (ms timestamp)
  phaseDuration: number;       // Total phase duration (ms)
  lastFlashTime: number;       // When last flash was sent
  flashCount: number;          // Total flashes sent
  
  // Burst pattern state
  burstIndex: number;          // Current position in burst cycle
  
  // Rhythm pattern state
  rhythmIndex: number;         // Current position in rhythm sequence
  rhythmPhase: 'on' | 'off';   // Whether we're in on or off part of rhythm
  
  // Current effective frequency
  currentFrequency: number;
}

export class NovaPatternEngine {
  private state: PatternState = {
    pattern: null,
    startTime: 0,
    phaseDuration: 0,
    lastFlashTime: 0,
    flashCount: 0,
    burstIndex: 0,
    rhythmIndex: 0,
    rhythmPhase: 'on',
    currentFrequency: 10,
  };

  /**
   * Start a new pattern
   */
  startPattern(pattern: NovaPattern, phaseDurationMs: number): void {
    this.state = {
      pattern,
      startTime: Date.now(),
      phaseDuration: phaseDurationMs,
      lastFlashTime: 0,
      flashCount: 0,
      burstIndex: 0,
      rhythmIndex: 0,
      rhythmPhase: 'on',
      currentFrequency: pattern.baseFrequency,
    };
  }

  /**
   * Stop the current pattern
   */
  stopPattern(): void {
    this.state.pattern = null;
  }

  /**
   * Get the current effective frequency
   */
  getCurrentFrequency(): number {
    return this.state.currentFrequency;
  }

  /**
   * Get the current pattern type
   */
  getPatternType(): NovaPatternType | null {
    return this.state.pattern?.type || null;
  }

  /**
   * Calculate the next flash interval based on the current pattern
   * Returns: { interval: ms until next flash, shouldFlash: whether to send command }
   */
  getNextFlash(): { interval: number; shouldFlash: boolean } {
    const { pattern } = this.state;
    
    if (!pattern) {
      return { interval: 100, shouldFlash: false };
    }

    const now = Date.now();
    const elapsed = now - this.state.startTime;
    const progress = Math.min(1, elapsed / this.state.phaseDuration);

    switch (pattern.type) {
      case 'steady':
        return this.calculateSteady(pattern);
      
      case 'sweep':
        return this.calculateSweep(pattern, progress);
      
      case 'burst':
        return this.calculateBurst(pattern);
      
      case 'rhythm':
        return this.calculateRhythm(pattern);
      
      case 'wave':
        return this.calculateWave(pattern, elapsed);
      
      case 'pulse':
        return this.calculatePulse(pattern);
      
      case 'random':
        return this.calculateRandom(pattern);
      
      default:
        return this.calculateSteady(pattern);
    }
  }

  /**
   * Steady pattern: Fixed frequency
   */
  private calculateSteady(pattern: NovaPattern): { interval: number; shouldFlash: boolean } {
    const freq = pattern.baseFrequency;
    this.state.currentFrequency = freq;
    
    let interval = Math.round(1000 / freq);
    interval = this.applyRandomVariation(interval, pattern.randomVariation);
    
    return { interval, shouldFlash: true };
  }

  /**
   * Sweep pattern: Linear frequency transition
   */
  private calculateSweep(pattern: NovaPattern, progress: number): { interval: number; shouldFlash: boolean } {
    const startFreq = pattern.baseFrequency;
    const endFreq = pattern.targetFrequency ?? pattern.baseFrequency;
    
    // Linear interpolation
    const freq = startFreq + (endFreq - startFreq) * progress;
    this.state.currentFrequency = freq;
    
    let interval = Math.round(1000 / freq);
    interval = this.applyRandomVariation(interval, pattern.randomVariation);
    
    return { interval, shouldFlash: true };
  }

  /**
   * Burst pattern: Groups of flashes with gaps
   */
  private calculateBurst(pattern: NovaPattern): { interval: number; shouldFlash: boolean } {
    const burstCount = pattern.burstCount ?? 5;
    const burstGap = pattern.burstGap ?? 500;
    const flashInterval = Math.round(1000 / pattern.baseFrequency);
    
    this.state.currentFrequency = pattern.baseFrequency;
    
    // Check if we're in the gap between bursts
    if (this.state.burstIndex >= burstCount) {
      // Reset for next burst
      this.state.burstIndex = 0;
      return { interval: burstGap, shouldFlash: false };
    }
    
    // We're in a burst - send flash and increment
    this.state.burstIndex++;
    
    let interval = flashInterval;
    interval = this.applyRandomVariation(interval, pattern.randomVariation);
    
    return { interval, shouldFlash: true };
  }

  /**
   * Rhythm pattern: Custom on/off sequence
   */
  private calculateRhythm(pattern: NovaPattern): { interval: number; shouldFlash: boolean } {
    const rhythmPattern = pattern.rhythmPattern ?? [100, 100]; // Default: simple alternating
    
    this.state.currentFrequency = pattern.baseFrequency;
    
    // Get current timing value
    const timing = rhythmPattern[this.state.rhythmIndex] ?? 100;
    
    // Determine if this is an "on" interval (even indices) or "off" interval (odd indices)
    const isOnInterval = this.state.rhythmIndex % 2 === 0;
    
    // Advance to next position in rhythm
    this.state.rhythmIndex = (this.state.rhythmIndex + 1) % rhythmPattern.length;
    
    if (isOnInterval) {
      // During "on" intervals, flash at baseFrequency
      const flashInterval = Math.round(1000 / pattern.baseFrequency);
      
      // If the on-interval is longer than one flash, we need multiple flashes
      // For simplicity, we'll just do one flash and return the flash interval
      // The rhythm pattern defines the structure, flashes happen within "on" periods
      let interval = Math.min(flashInterval, timing);
      interval = this.applyRandomVariation(interval, pattern.randomVariation);
      
      return { interval, shouldFlash: true };
    } else {
      // During "off" intervals, wait without flashing
      let interval = timing;
      interval = this.applyRandomVariation(interval, pattern.randomVariation);
      
      return { interval, shouldFlash: false };
    }
  }

  /**
   * Wave pattern: Sinusoidal frequency modulation
   */
  private calculateWave(pattern: NovaPattern, elapsed: number): { interval: number; shouldFlash: boolean } {
    const baseFreq = pattern.baseFrequency;
    const amplitude = pattern.waveAmplitude ?? 2;
    const period = pattern.wavePeriod ?? 5000;
    
    // Calculate sinusoidal modulation
    const phase = (elapsed % period) / period;
    const modulation = Math.sin(phase * 2 * Math.PI);
    const freq = baseFreq + amplitude * modulation;
    
    // Clamp to reasonable range
    const clampedFreq = Math.max(1, Math.min(50, freq));
    this.state.currentFrequency = clampedFreq;
    
    let interval = Math.round(1000 / clampedFreq);
    interval = this.applyRandomVariation(interval, pattern.randomVariation);
    
    return { interval, shouldFlash: true };
  }

  /**
   * Pulse pattern: Duty cycle variation
   * Simulates intensity by varying on-time vs off-time ratio
   */
  private calculatePulse(pattern: NovaPattern): { interval: number; shouldFlash: boolean } {
    const dutyCycle = pattern.dutyCycle ?? 0.5;
    const baseInterval = Math.round(1000 / pattern.baseFrequency);
    
    this.state.currentFrequency = pattern.baseFrequency;
    
    // Alternate between on and off with duty cycle ratio
    if (this.state.rhythmPhase === 'on') {
      this.state.rhythmPhase = 'off';
      const onTime = Math.round(baseInterval * dutyCycle);
      return { interval: this.applyRandomVariation(onTime, pattern.randomVariation), shouldFlash: true };
    } else {
      this.state.rhythmPhase = 'on';
      const offTime = Math.round(baseInterval * (1 - dutyCycle));
      return { interval: this.applyRandomVariation(offTime, pattern.randomVariation), shouldFlash: false };
    }
  }

  /**
   * Random pattern: Base frequency with timing jitter
   */
  private calculateRandom(pattern: NovaPattern): { interval: number; shouldFlash: boolean } {
    const freq = pattern.baseFrequency;
    this.state.currentFrequency = freq;
    
    const baseInterval = Math.round(1000 / freq);
    // Apply larger random variation for this pattern type
    const variation = pattern.randomVariation ?? 50;
    const interval = this.applyRandomVariation(baseInterval, variation);
    
    return { interval, shouldFlash: true };
  }

  /**
   * Apply random timing variation
   */
  private applyRandomVariation(interval: number, variation?: number): number {
    if (!variation || variation <= 0) {
      return interval;
    }
    
    const jitter = (Math.random() - 0.5) * 2 * variation;
    return Math.max(20, Math.round(interval + jitter)); // Minimum 20ms
  }

  /**
   * Create a pattern from simple frequency (backwards compatibility)
   */
  static createSteadyPattern(frequencyHz: number): NovaPattern {
    return {
      type: 'steady',
      baseFrequency: frequencyHz,
    };
  }

  /**
   * Create a sweep pattern
   */
  static createSweepPattern(startHz: number, endHz: number): NovaPattern {
    return {
      type: 'sweep',
      baseFrequency: startHz,
      targetFrequency: endHz,
    };
  }

  /**
   * Create a burst pattern
   */
  static createBurstPattern(frequencyHz: number, burstCount: number = 5, gapMs: number = 500): NovaPattern {
    return {
      type: 'burst',
      baseFrequency: frequencyHz,
      burstCount,
      burstGap: gapMs,
    };
  }

  /**
   * Create a wave pattern
   */
  static createWavePattern(centerHz: number, amplitudeHz: number = 2, periodMs: number = 5000): NovaPattern {
    return {
      type: 'wave',
      baseFrequency: centerHz,
      waveAmplitude: amplitudeHz,
      wavePeriod: periodMs,
    };
  }

  /**
   * Create a heartbeat rhythm pattern
   */
  static createHeartbeatPattern(frequencyHz: number = 10): NovaPattern {
    return {
      type: 'rhythm',
      baseFrequency: frequencyHz,
      rhythmPattern: [100, 200, 100, 600], // lub-dub pattern
    };
  }

  /**
   * Create a breathing rhythm pattern
   */
  static createBreathingPattern(frequencyHz: number = 8, breathDurationMs: number = 4000): NovaPattern {
    const halfBreath = breathDurationMs / 2;
    return {
      type: 'rhythm',
      baseFrequency: frequencyHz,
      rhythmPattern: [halfBreath, 200, halfBreath, 200], // inhale-pause-exhale-pause
    };
  }
}

// Singleton instance
export const novaPatternEngine = new NovaPatternEngine();
