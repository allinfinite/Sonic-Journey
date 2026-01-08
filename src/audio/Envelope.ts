/**
 * Envelope module for vibroacoustic synthesis
 * Generates slow amplitude envelopes and breathing patterns
 */

export class Envelope {
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Generate linear amplitude ramp
   */
  linearRamp(
    durationSamples: number,
    startLevel: number,
    endLevel: number
  ): Float32Array {
    const output = new Float32Array(durationSamples);

    for (let i = 0; i < durationSamples; i++) {
      const t = i / (durationSamples - 1);
      output[i] = startLevel + (endLevel - startLevel) * t;
    }

    return output;
  }

  /**
   * Generate exponential amplitude ramp
   * More natural sounding for fades
   */
  exponentialRamp(
    durationSamples: number,
    startLevel: number,
    endLevel: number,
    curve: number = 2.0
  ): Float32Array {
    const output = new Float32Array(durationSamples);

    for (let i = 0; i < durationSamples; i++) {
      const t = i / (durationSamples - 1);
      let curvedT: number;

      if (startLevel < endLevel) {
        // Fade in
        curvedT = Math.pow(t, 1 / curve);
      } else {
        // Fade out
        curvedT = Math.pow(t, curve);
      }

      output[i] = startLevel + (endLevel - startLevel) * curvedT;
    }

    return output;
  }

  /**
   * Generate smooth S-curve ramp using cosine interpolation
   * Ideal for very smooth transitions
   */
  sCurveRamp(
    durationSamples: number,
    startLevel: number,
    endLevel: number
  ): Float32Array {
    const output = new Float32Array(durationSamples);

    for (let i = 0; i < durationSamples; i++) {
      const t = (i / (durationSamples - 1)) * Math.PI;
      const interp = (1 - Math.cos(t)) / 2;
      output[i] = startLevel + (endLevel - startLevel) * interp;
    }

    return output;
  }

  /**
   * Generate slow breathing amplitude pattern
   * Core component of vibroacoustic felt experience
   */
  breathingPattern(
    durationSamples: number,
    cycleSeconds: number,
    baseLevel: number = 0.7,
    breathDepth: number = 0.2,
    breathShape: 'sine' | 'triangle' = 'sine'
  ): Float32Array {
    const output = new Float32Array(durationSamples);
    const cycleFreq = 1.0 / cycleSeconds;

    for (let i = 0; i < durationSamples; i++) {
      const t = i / this.sampleRate;
      let breath: number;

      if (breathShape === 'triangle') {
        // Triangle wave breathing (more linear)
        const phase = (t * cycleFreq) % 1.0;
        breath = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        breath = breath * 2 - 1; // Scale to -1 to 1
      } else {
        // Sine wave breathing (smoother)
        breath = Math.sin(2 * Math.PI * cycleFreq * t);
      }

      output[i] = baseLevel + breathDepth * breath;
    }

    return output;
  }

  /**
   * Generate breathing pattern that follows an overall amplitude trajectory
   * Combines breathing modulation with gradual level changes
   */
  breathingWithRamp(
    durationSamples: number,
    cycleSeconds: number,
    ampStart: number,
    ampEnd: number,
    breathDepth: number = 0.15
  ): Float32Array {
    const output = new Float32Array(durationSamples);
    const baseRamp = this.sCurveRamp(durationSamples, ampStart, ampEnd);
    const cycleFreq = 1.0 / cycleSeconds;

    for (let i = 0; i < durationSamples; i++) {
      const t = i / this.sampleRate;
      const breath = Math.sin(2 * Math.PI * cycleFreq * t);
      const breathEnv = baseRamp[i] * (1 + breathDepth * breath);
      output[i] = Math.max(0, Math.min(1, breathEnv));
    }

    return output;
  }

  /**
   * Generate fade-in envelope
   */
  fadeIn(
    durationSamples: number,
    targetLevel: number = 1.0,
    fadeType: 'linear' | 'exponential' | 's_curve' = 's_curve'
  ): Float32Array {
    switch (fadeType) {
      case 'exponential':
        return this.exponentialRamp(durationSamples, 0.0, targetLevel, 2.0);
      case 's_curve':
        return this.sCurveRamp(durationSamples, 0.0, targetLevel);
      default:
        return this.linearRamp(durationSamples, 0.0, targetLevel);
    }
  }

  /**
   * Generate fade-out envelope
   */
  fadeOut(
    durationSamples: number,
    startLevel: number = 1.0,
    fadeType: 'linear' | 'exponential' | 's_curve' = 's_curve'
  ): Float32Array {
    switch (fadeType) {
      case 'exponential':
        return this.exponentialRamp(durationSamples, startLevel, 0.0, 2.0);
      case 's_curve':
        return this.sCurveRamp(durationSamples, startLevel, 0.0);
      default:
        return this.linearRamp(durationSamples, startLevel, 0.0);
    }
  }

  /**
   * Crossfade between two signals
   * Used for smooth phase transitions
   */
  crossfade(
    signalA: Float32Array,
    signalB: Float32Array,
    crossfadeSamples: number
  ): Float32Array {
    if (signalA.length < crossfadeSamples || signalB.length < crossfadeSamples) {
      // If signals are too short, return simple concatenation
      const result = new Float32Array(signalA.length + signalB.length);
      result.set(signalA, 0);
      result.set(signalB, signalA.length);
      return result;
    }

    const fadeOutEnv = this.sCurveRamp(crossfadeSamples, 1.0, 0.0);
    const fadeInEnv = this.sCurveRamp(crossfadeSamples, 0.0, 1.0);

    const resultLength = signalA.length + signalB.length - crossfadeSamples;
    const result = new Float32Array(resultLength);

    // Copy first part of signal A (before crossfade)
    const beforeCrossfade = signalA.length - crossfadeSamples;
    for (let i = 0; i < beforeCrossfade; i++) {
      result[i] = signalA[i];
    }

    // Crossfade region
    for (let i = 0; i < crossfadeSamples; i++) {
      result[beforeCrossfade + i] =
        signalA[beforeCrossfade + i] * fadeOutEnv[i] +
        signalB[i] * fadeInEnv[i];
    }

    // Copy rest of signal B (after crossfade)
    for (let i = crossfadeSamples; i < signalB.length; i++) {
      result[signalA.length - crossfadeSamples + i] = signalB[i];
    }

    return result;
  }

  /**
   * Apply envelope to a signal
   */
  applyEnvelope(signal: Float32Array, envelope: Float32Array): Float32Array {
    const output = new Float32Array(signal.length);

    if (envelope.length !== signal.length) {
      // Resize envelope if needed
      for (let i = 0; i < signal.length; i++) {
        const envIndex = Math.floor((i / signal.length) * envelope.length);
        output[i] = signal[i] * envelope[Math.min(envIndex, envelope.length - 1)];
      }
    } else {
      for (let i = 0; i < signal.length; i++) {
        output[i] = signal[i] * envelope[i];
      }
    }

    return output;
  }
}
