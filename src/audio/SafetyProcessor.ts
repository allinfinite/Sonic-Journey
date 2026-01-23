/**
 * Safety processing for vibroacoustic audio
 * Implements limiting, peak control, RMS/LUFS normalization, and adaptive gain
 */

export interface NormalizationOptions {
  targetLoudnessDb: number;  // Target LUFS/RMS level (default -14 for streaming, -12 for masters)
  peakCeilingDb: number;     // True peak ceiling (default -1 dB)
  useLufs: boolean;          // Use LUFS-style loudness (accounts for frequency weighting)
  makeupGainDb: number;      // Additional makeup gain
}

export class SafetyProcessor {
  private sampleRate: number;
  
  // K-weighting filter coefficients for LUFS measurement
  // Simplified 2-stage filter: high-shelf + high-pass
  private kWeightCoeffs = {
    // Stage 1: High-shelf boost at 1681 Hz, +4 dB
    highShelf: { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 },
    // Stage 2: High-pass at 38 Hz
    highPass: { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 }
  };

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Measure LUFS-style integrated loudness
   * Uses K-weighting filter and gated measurement for perceptually accurate levels
   */
  measureLoudness(audio: Float32Array, useKWeighting: boolean = true): number {
    let samples = audio;
    
    // Apply K-weighting if requested
    if (useKWeighting) {
      samples = this.applyKWeighting(audio);
    }
    
    // Calculate mean square with 400ms gating window (simplified)
    const windowSamples = Math.floor(0.4 * this.sampleRate);
    const hopSamples = Math.floor(0.1 * this.sampleRate); // 100ms hop
    const numWindows = Math.floor((samples.length - windowSamples) / hopSamples) + 1;
    
    if (numWindows <= 0) {
      // File too short, use full RMS
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i++) {
        sumSquares += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      return 20 * Math.log10(Math.max(rms, 1e-10));
    }
    
    // Calculate block loudness for each window
    const blockLoudness: number[] = [];
    for (let w = 0; w < numWindows; w++) {
      const start = w * hopSamples;
      let sumSquares = 0;
      for (let i = start; i < start + windowSamples && i < samples.length; i++) {
        sumSquares += samples[i] * samples[i];
      }
      const blockRms = Math.sqrt(sumSquares / windowSamples);
      const blockDb = 20 * Math.log10(Math.max(blockRms, 1e-10));
      blockLoudness.push(blockDb);
    }
    
    // Gate blocks below absolute threshold (-70 LUFS)
    const absoluteThreshold = -70;
    const ungatedBlocks = blockLoudness.filter(db => db > absoluteThreshold);
    
    if (ungatedBlocks.length === 0) {
      return -70; // Silence
    }
    
    // Calculate mean of ungated blocks in linear domain
    let sumLinear = 0;
    for (const db of ungatedBlocks) {
      sumLinear += Math.pow(10, db / 10);
    }
    const meanLinear = sumLinear / ungatedBlocks.length;
    
    // Calculate relative threshold (-10 dB below mean)
    const relativeMean = 10 * Math.log10(meanLinear);
    const relativeThreshold = relativeMean - 10;
    
    // Gate blocks below relative threshold
    const gatedBlocks = ungatedBlocks.filter(db => db > relativeThreshold);
    
    if (gatedBlocks.length === 0) {
      return relativeMean;
    }
    
    // Final LUFS value
    let finalSum = 0;
    for (const db of gatedBlocks) {
      finalSum += Math.pow(10, db / 10);
    }
    const lufs = 10 * Math.log10(finalSum / gatedBlocks.length);
    
    return lufs;
  }

  /**
   * Apply K-weighting filter for LUFS measurement
   */
  private applyKWeighting(audio: Float32Array): Float32Array {
    // Stage 1: High-shelf
    let filtered = this.biquadFilter(
      audio,
      this.kWeightCoeffs.highShelf.b0,
      this.kWeightCoeffs.highShelf.b1,
      this.kWeightCoeffs.highShelf.b2,
      this.kWeightCoeffs.highShelf.a1,
      this.kWeightCoeffs.highShelf.a2
    );
    
    // Stage 2: High-pass
    filtered = this.biquadFilter(
      filtered,
      this.kWeightCoeffs.highPass.b0,
      this.kWeightCoeffs.highPass.b1,
      this.kWeightCoeffs.highPass.b2,
      this.kWeightCoeffs.highPass.a1,
      this.kWeightCoeffs.highPass.a2
    );
    
    return filtered;
  }

  /**
   * Apply biquad filter
   */
  private biquadFilter(
    input: Float32Array,
    b0: number, b1: number, b2: number,
    a1: number, a2: number
  ): Float32Array {
    const output = new Float32Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    
    for (let i = 0; i < input.length; i++) {
      const x0 = input[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      output[i] = y0;
      x2 = x1; x1 = x0;
      y2 = y1; y1 = y0;
    }
    
    return output;
  }

  /**
   * Normalize audio to target loudness level (LUFS or RMS)
   * More sophisticated than simple RMS normalization
   */
  normalizeLoudness(
    audio: Float32Array,
    options: Partial<NormalizationOptions> = {}
  ): Float32Array {
    const {
      targetLoudnessDb = -14, // Standard streaming loudness
      peakCeilingDb = -1,
      useLufs = true,
      makeupGainDb = 0
    } = options;
    
    // Measure current loudness
    const currentLoudness = useLufs 
      ? this.measureLoudness(audio, true)
      : this.measureLoudness(audio, false);
    
    if (currentLoudness <= -70) {
      // Essentially silence, don't amplify noise
      return audio;
    }
    
    // Calculate required gain
    const gainDb = targetLoudnessDb - currentLoudness + makeupGainDb;
    const gainLinear = Math.pow(10, gainDb / 20);
    
    // Apply gain
    let output: Float32Array = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      output[i] = audio[i] * gainLinear;
    }
    
    // Check peak level and apply limiting if needed
    let maxPeak = 0;
    for (let i = 0; i < output.length; i++) {
      const absSample = Math.abs(output[i]);
      if (absSample > maxPeak) maxPeak = absSample;
    }
    
    const peakDb = 20 * Math.log10(Math.max(maxPeak, 1e-10));
    
    if (peakDb > peakCeilingDb) {
      // Apply true peak limiting
      output = this.truePeakLimit(output, peakCeilingDb);
    }
    
    return output;
  }

  /**
   * Normalize audio to target peak level
   * Useful for ensuring consistent headroom
   */
  normalizePeak(audio: Float32Array, targetPeakDb: number = -1): Float32Array {
    // Find current peak
    let maxPeak = 0;
    for (let i = 0; i < audio.length; i++) {
      const absSample = Math.abs(audio[i]);
      if (absSample > maxPeak) maxPeak = absSample;
    }
    
    if (maxPeak === 0) return audio;
    
    const targetPeak = Math.pow(10, targetPeakDb / 20);
    const gain = targetPeak / maxPeak;
    
    const output = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      output[i] = audio[i] * gain;
    }
    
    return output;
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

  /**
   * Full-range audio safety chain (without vibroacoustic filtering)
   * For audio that includes full-spectrum content
   */
  processFullRangeChain(
    audio: Float32Array,
    targetLoudnessDb: number = -14.0,
    peakCeilingDb: number = -1.0,
    useLufs: boolean = true
  ): Float32Array {
    // Remove DC offset
    let processed = this.removeDCOffset(audio);

    // Apply very low highpass to remove sub-bass rumble (but keep bass content)
    processed = this.highpassFilter(processed, 20.0);

    // Normalize to target loudness (LUFS or RMS)
    processed = this.normalizeLoudness(processed, {
      targetLoudnessDb,
      peakCeilingDb,
      useLufs,
    });

    // Apply soft clipping as safety net
    processed = this.softClip(processed, 0.95);

    // Apply true peak limiting
    processed = this.truePeakLimit(processed, peakCeilingDb);

    // Ensure edge fades
    processed = this.applyFadeEdges(processed);

    return processed;
  }

  /**
   * Calculate adaptive gain to bring audio to target level
   * Returns the gain multiplier needed
   */
  calculateAdaptiveGain(
    audio: Float32Array,
    targetRmsDb: number = -12,
    windowMs: number = 400
  ): number {
    const windowSamples = Math.floor((windowMs * this.sampleRate) / 1000);
    const samplesToAnalyze = Math.min(windowSamples, audio.length);
    
    let sumSquares = 0;
    for (let i = 0; i < samplesToAnalyze; i++) {
      sumSquares += audio[i] * audio[i];
    }
    
    const currentRms = Math.sqrt(sumSquares / samplesToAnalyze);
    if (currentRms === 0) return 1.0;
    
    const currentRmsDb = 20 * Math.log10(currentRms);
    const gainDb = targetRmsDb - currentRmsDb;
    
    // Limit gain to prevent extreme amplification or attenuation
    const clampedGainDb = Math.max(-12, Math.min(12, gainDb));
    
    return Math.pow(10, clampedGainDb / 20);
  }

  /**
   * Apply smooth gain transition (for real-time use)
   */
  applyGainWithSmoothing(
    audio: Float32Array,
    startGain: number,
    endGain: number
  ): Float32Array {
    const output = new Float32Array(audio.length);
    
    for (let i = 0; i < audio.length; i++) {
      // Linear interpolation for smooth gain change
      const t = i / (audio.length - 1);
      const gain = startGain + (endGain - startGain) * t;
      output[i] = audio[i] * gain;
    }
    
    return output;
  }

  /**
   * Normalize phase audio for consistent levels between phases
   * Uses peak normalization with headroom
   */
  normalizePhase(
    audio: Float32Array,
    targetPeakDb: number = -3
  ): Float32Array {
    // First remove DC offset
    let processed = this.removeDCOffset(audio);
    
    // Normalize to target peak level (leaves headroom for summing)
    processed = this.normalizePeak(processed, targetPeakDb);
    
    return processed;
  }
}
