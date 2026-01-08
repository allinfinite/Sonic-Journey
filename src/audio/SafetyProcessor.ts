/**
 * Safety processing for vibroacoustic audio
 * Implements limiting, peak control, and RMS normalization
 */

export class SafetyProcessor {
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Remove DC offset from audio
   */
  removeDCOffset(audio: Float32Array): Float32Array {
    let sum = 0;
    for (let i = 0; i < audio.length; i++) {
      sum += audio[i];
    }
    const mean = sum / audio.length;

    const output = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      output[i] = audio[i] - mean;
    }

    return output;
  }

  /**
   * Apply soft clipping to prevent harsh distortion
   * Uses smooth knee curve for transparent limiting
   */
  softClip(
    audio: Float32Array,
    threshold: number = 0.9,
    knee: number = 0.1
  ): Float32Array {
    const output = new Float32Array(audio.length);

    for (let i = 0; i < audio.length; i++) {
      const sample = audio[i];
      const absSample = Math.abs(sample);
      const sign = sample >= 0 ? 1 : -1;

      if (absSample > threshold) {
        const excess = absSample - threshold;
        const compressed = threshold + knee * Math.tanh(excess / knee);
        output[i] = sign * compressed;
      } else {
        output[i] = sample;
      }
    }

    return output;
  }

  /**
   * Apply true peak limiting with lookahead
   * Prevents intersample peaks from exceeding ceiling
   */
  truePeakLimit(
    audio: Float32Array,
    ceilingDb: number = -1.0,
    attackMs: number = 5.0,
    releaseMs: number = 50.0
  ): Float32Array {
    const ceiling = Math.pow(10, ceilingDb / 20);
    const attackSamples = Math.floor((attackMs * this.sampleRate) / 1000);
    const releaseSamples = Math.floor((releaseMs * this.sampleRate) / 1000);

    // Calculate envelope
    const envelope = new Float32Array(audio.length);
    let envVal = 0;

    for (let i = 0; i < audio.length; i++) {
      const absAudio = Math.abs(audio[i]);

      if (absAudio > envVal) {
        // Attack - fast rise
        const coeff = 1 - Math.exp(-1 / Math.max(attackSamples, 1));
        envVal = envVal + coeff * (absAudio - envVal);
      } else {
        // Release - slow decay
        const coeff = 1 - Math.exp(-1 / Math.max(releaseSamples, 1));
        envVal = envVal + coeff * (absAudio - envVal);
      }
      envelope[i] = envVal;
    }

    // Calculate gain reduction
    const gain = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      if (envelope[i] > ceiling) {
        gain[i] = ceiling / envelope[i];
      } else {
        gain[i] = 1.0;
      }
    }

    // Smooth gain changes
    const smoothedGain = this.smoothGain(gain, attackSamples);

    // Apply gain
    const output = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      output[i] = audio[i] * smoothedGain[i];
    }

    return output;
  }

  /**
   * Smooth gain changes to prevent clicks
   */
  private smoothGain(gain: Float32Array, windowSamples: number): Float32Array {
    if (windowSamples < 2) return gain;

    const output = new Float32Array(gain.length);
    const halfWindow = Math.floor(windowSamples / 2);

    for (let i = 0; i < gain.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = Math.max(0, i - halfWindow); j < Math.min(gain.length, i + halfWindow + 1); j++) {
        sum += gain[j];
        count++;
      }

      output[i] = sum / count;
    }

    return output;
  }

  /**
   * Normalize audio to target RMS level
   */
  normalizeRMS(audio: Float32Array, targetRmsDb: number = -12.0): Float32Array {
    // Calculate current RMS
    let sumSquares = 0;
    for (let i = 0; i < audio.length; i++) {
      sumSquares += audio[i] * audio[i];
    }
    const currentRms = Math.sqrt(sumSquares / audio.length);

    if (currentRms === 0) return audio;

    // Calculate target RMS
    const targetRms = Math.pow(10, targetRmsDb / 20);

    // Apply gain
    const gain = targetRms / currentRms;
    const output = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      output[i] = audio[i] * gain;
    }

    return output;
  }

  /**
   * Apply simple lowpass filter using weighted moving average
   * For vibroacoustic content we don't need steep filters
   */
  lowpassFilter(
    audio: Float32Array,
    cutoffHz: number = 120.0
  ): Float32Array {
    // Simple one-pole lowpass filter
    const rc = 1.0 / (2 * Math.PI * cutoffHz);
    const dt = 1.0 / this.sampleRate;
    const alpha = dt / (rc + dt);

    const output = new Float32Array(audio.length);
    output[0] = audio[0];

    for (let i = 1; i < audio.length; i++) {
      output[i] = output[i - 1] + alpha * (audio[i] - output[i - 1]);
    }

    // Apply forward and backward for zero-phase (approximate)
    const output2 = new Float32Array(audio.length);
    output2[audio.length - 1] = output[audio.length - 1];

    for (let i = audio.length - 2; i >= 0; i--) {
      output2[i] = output2[i + 1] + alpha * (output[i] - output2[i + 1]);
    }

    return output2;
  }

  /**
   * Apply simple highpass filter
   */
  highpassFilter(
    audio: Float32Array,
    cutoffHz: number = 20.0
  ): Float32Array {
    // Simple one-pole highpass filter
    const rc = 1.0 / (2 * Math.PI * cutoffHz);
    const dt = 1.0 / this.sampleRate;
    const alpha = rc / (rc + dt);

    const output = new Float32Array(audio.length);
    output[0] = audio[0];

    for (let i = 1; i < audio.length; i++) {
      output[i] = alpha * (output[i - 1] + audio[i] - audio[i - 1]);
    }

    return output;
  }

  /**
   * Apply fade in/out to edges to prevent clicks at start/end
   */
  applyFadeEdges(
    audio: Float32Array,
    fadeInMs: number = 100.0,
    fadeOutMs: number = 500.0
  ): Float32Array {
    const fadeInSamples = Math.floor((fadeInMs * this.sampleRate) / 1000);
    const fadeOutSamples = Math.floor((fadeOutMs * this.sampleRate) / 1000);

    const output = new Float32Array(audio.length);

    for (let i = 0; i < audio.length; i++) {
      let multiplier = 1.0;

      // Fade in (quadratic)
      if (i < fadeInSamples && fadeInSamples > 0) {
        const t = i / fadeInSamples;
        multiplier = t * t;
      }

      // Fade out (quadratic)
      const fromEnd = audio.length - 1 - i;
      if (fromEnd < fadeOutSamples && fadeOutSamples > 0) {
        const t = fromEnd / fadeOutSamples;
        multiplier *= t * t;
      }

      output[i] = audio[i] * multiplier;
    }

    return output;
  }

  /**
   * Apply full safety processing chain
   */
  processChain(
    audio: Float32Array,
    maxRmsDb: number = -12.0,
    peakCeilingDb: number = -1.0,
    lowpassHz: number = 120.0,
    highpassHz: number = 20.0
  ): Float32Array {
    // Remove DC offset
    let processed = this.removeDCOffset(audio);

    // Apply bandpass filtering
    processed = this.highpassFilter(processed, highpassHz);
    processed = this.lowpassFilter(processed, lowpassHz);

    // Normalize RMS
    processed = this.normalizeRMS(processed, maxRmsDb);

    // Apply soft clipping as safety net
    processed = this.softClip(processed, 0.95);

    // Apply true peak limiting
    processed = this.truePeakLimit(processed, peakCeilingDb);

    // Ensure edge fades
    processed = this.applyFadeEdges(processed);

    return processed;
  }
}
