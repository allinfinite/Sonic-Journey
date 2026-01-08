/**
 * OfflineRenderer - Renders journeys to AudioBuffer using OfflineAudioContext
 * For high-quality export to WAV/MP3
 */

import type { JourneyConfig, PhaseConfig, ProgressCallback, EntrainmentMode } from '../types/journey';
import { ENTRAINMENT_PRESETS } from '../types/journey';
import { Oscillator } from './Oscillator';
import { Envelope } from './Envelope';
import { SafetyProcessor } from './SafetyProcessor';

// Map rhythm mode to entrainment mode
const rhythmToEntrainment: Record<string, EntrainmentMode> = {
  still: 'none',
  breathing: 'breathing',
  heartbeat: 'heartbeat',
  theta: 'theta',
  alpha: 'alpha',
};

export class OfflineRenderer {
  private sampleRate: number;
  private channels: number;

  constructor(sampleRate: number = 48000, channels: 1 | 2 = 2) {
    this.sampleRate = sampleRate;
    this.channels = channels;
  }

  /**
   * Render a complete journey to AudioBuffer
   */
  async render(
    config: JourneyConfig,
    onProgress?: ProgressCallback
  ): Promise<AudioBuffer> {
    const totalDuration = config.duration_minutes * 60;
    const totalSamples = Math.ceil(totalDuration * this.sampleRate);

    // Create offline context
    const offlineCtx = new OfflineAudioContext({
      numberOfChannels: this.channels,
      length: totalSamples,
      sampleRate: this.sampleRate,
    });

    // Report start
    onProgress?.({
      phase: 'Initializing',
      stage: 'setup',
      progress: 0,
      message: 'Setting up audio context...',
    });

    // Render all phases to raw audio data first
    const oscillator = new Oscillator(this.sampleRate);
    const envelope = new Envelope(this.sampleRate);
    const safety = new SafetyProcessor(this.sampleRate);

    // Calculate total phases for progress
    const totalPhases = config.phases.length;
    let processedSamples = 0;

    // Generate all phase audio
    const phaseAudioChunks: Float32Array[] = [];

    for (let i = 0; i < config.phases.length; i++) {
      const phase = config.phases[i];
      const phaseSamples = Math.floor(phase.duration * 60 * this.sampleRate);

      onProgress?.({
        phase: phase.name,
        stage: 'generating',
        progress: Math.round((i / totalPhases) * 50),
        message: `Generating ${phase.name}...`,
      });

      // Generate phase audio
      const phaseAudio = this.renderPhase(
        phase,
        phaseSamples,
        config.layers,
        oscillator,
        envelope
      );

      phaseAudioChunks.push(phaseAudio);
      processedSamples += phaseSamples;
    }

    // Concatenate all phases with crossfades
    onProgress?.({
      phase: 'Processing',
      stage: 'mixing',
      progress: 55,
      message: 'Mixing phases...',
    });

    let fullAudio = this.concatenateWithCrossfades(phaseAudioChunks, envelope);

    // Apply safety processing
    onProgress?.({
      phase: 'Processing',
      stage: 'safety',
      progress: 70,
      message: 'Applying safety processing...',
    });

    const safetyConfig = config.safety || {
      max_rms_db: -12,
      peak_ceiling_db: -1,
      lowpass_hz: 120,
      highpass_hz: 20,
    };

    fullAudio = safety.processChain(
      fullAudio,
      safetyConfig.max_rms_db,
      safetyConfig.peak_ceiling_db,
      safetyConfig.lowpass_hz,
      safetyConfig.highpass_hz
    );

    // Create buffer source and render
    onProgress?.({
      phase: 'Finalizing',
      stage: 'rendering',
      progress: 85,
      message: 'Rendering to audio buffer...',
    });

    // Create an AudioBuffer manually and copy data
    const audioBuffer = offlineCtx.createBuffer(
      this.channels,
      fullAudio.length,
      this.sampleRate
    );

    // Copy to both channels (or just one if mono)
    for (let ch = 0; ch < this.channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      channelData.set(fullAudio);
    }

    onProgress?.({
      phase: 'Complete',
      stage: 'done',
      progress: 100,
      message: 'Rendering complete!',
    });

    return audioBuffer;
  }

  /**
   * Render a single phase to Float32Array
   */
  private renderPhase(
    phase: PhaseConfig,
    samples: number,
    layers: JourneyConfig['layers'],
    oscillator: Oscillator,
    envelope: Envelope
  ): Float32Array {
    const mixed = new Float32Array(samples);

    // Get entrainment settings
    const rhythmMode = phase.rhythm_mode || 'breathing';
    const entrainmentMode = rhythmToEntrainment[rhythmMode] || 'breathing';
    const entrainmentRate = phase.entrainment_rate || ENTRAINMENT_PRESETS[entrainmentMode].rate;

    // Foundation Layer (Base Carrier)
    if (layers.base_carrier !== false) {
      const baseAudio = oscillator.generateWithEntrainment(
        samples,
        phase.frequency.start,
        phase.frequency.end,
        entrainmentMode,
        entrainmentRate,
        phase.fm_rate || 0.1,
        phase.fm_depth || 0,
        1.0
      );

      // Apply amplitude envelope
      const ampEnv = envelope.sCurveRamp(
        samples,
        phase.amplitude.start,
        phase.amplitude.end
      );
      
      for (let i = 0; i < samples; i++) {
        mixed[i] += baseAudio[i] * ampEnv[i] * 0.7;
      }
    }

    // Harmony Layer (Support Carrier)
    if (layers.support_carrier !== false) {
      const supportFreqStart = phase.support_frequency?.start || phase.frequency.start - 5;
      const supportFreqEnd = phase.support_frequency?.end || phase.frequency.end - 5;

      const supportAudio = oscillator.generateWithEntrainment(
        samples,
        supportFreqStart,
        supportFreqEnd,
        entrainmentMode,
        entrainmentRate ? entrainmentRate * 0.97 : undefined, // Slight detune
        (phase.fm_rate || 0.1) * 0.7,
        (phase.fm_depth || 0) * 0.5,
        1.0
      );

      const ampEnv = envelope.sCurveRamp(
        samples,
        phase.amplitude.start * 0.6,
        phase.amplitude.end * 0.6
      );

      for (let i = 0; i < samples; i++) {
        mixed[i] += supportAudio[i] * ampEnv[i] * 0.4;
      }
    }

    // Atmosphere Layer (Texture - first harmonic)
    if (layers.texture_layer === true) {
      const textureAudio = oscillator.generateComplex(
        samples,
        phase.frequency.start * 2,
        phase.frequency.end * 2,
        0.05,
        0,
        1.0
      );

      // Apply saturation for richness
      const saturated = oscillator.softSaturate(textureAudio, 0.3);

      const ampEnv = envelope.sCurveRamp(
        samples,
        phase.amplitude.start * 0.15,
        phase.amplitude.end * 0.15
      );

      for (let i = 0; i < samples; i++) {
        mixed[i] += saturated[i] * ampEnv[i] * 0.15;
      }
    }

    return mixed;
  }

  /**
   * Concatenate phase audio chunks with crossfades
   */
  private concatenateWithCrossfades(
    chunks: Float32Array[],
    envelope: Envelope
  ): Float32Array {
    if (chunks.length === 0) {
      return new Float32Array(0);
    }

    if (chunks.length === 1) {
      return chunks[0];
    }

    // Crossfade duration: 2 seconds
    const crossfadeSamples = Math.floor(2 * this.sampleRate);

    let result = chunks[0];

    for (let i = 1; i < chunks.length; i++) {
      result = envelope.crossfade(result, chunks[i], crossfadeSamples);
    }

    return result;
  }

  /**
   * Render journey using Web Audio scheduling (memory efficient)
   * This uses the OfflineAudioContext's native scheduling
   */
  async renderWithWebAudio(
    config: JourneyConfig,
    onProgress?: ProgressCallback
  ): Promise<AudioBuffer> {
    const totalDuration = config.duration_minutes * 60;
    const totalSamples = Math.ceil(totalDuration * this.sampleRate);

    const offlineCtx = new OfflineAudioContext({
      numberOfChannels: this.channels,
      length: totalSamples,
      sampleRate: this.sampleRate,
    });

    onProgress?.({
      phase: 'Scheduling',
      stage: 'setup',
      progress: 5,
      message: 'Setting up audio graph...',
    });

    // Create master gain with limiter-like soft clip
    const master = offlineCtx.createGain();
    master.gain.value = 0.8; // Leave headroom
    
    // Create dynamics compressor for safety limiting
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 10;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    master.connect(compressor);
    compressor.connect(offlineCtx.destination);

    // Create oscillators with gains
    const foundationOsc = offlineCtx.createOscillator();
    foundationOsc.type = 'sine';
    const foundationGain = offlineCtx.createGain();
    foundationGain.gain.value = config.layers.base_carrier ? 0.7 : 0;
    foundationOsc.connect(foundationGain);
    foundationGain.connect(master);

    const harmonyOsc = offlineCtx.createOscillator();
    harmonyOsc.type = 'sine';
    const harmonyGain = offlineCtx.createGain();
    harmonyGain.gain.value = config.layers.support_carrier ? 0.4 : 0;
    harmonyOsc.connect(harmonyGain);
    harmonyGain.connect(master);

    // Create LFO for breathing/entrainment
    const lfo = offlineCtx.createOscillator();
    lfo.type = 'sine';
    const lfoGain = offlineCtx.createGain();
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);

    // Schedule all parameter changes
    let time = 0;
    const totalPhases = config.phases.length;
    
    // Fade in at start
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(0.8, 2);

    for (let i = 0; i < config.phases.length; i++) {
      const phase = config.phases[i];
      const phaseDuration = phase.duration * 60;

      onProgress?.({
        phase: phase.name,
        stage: 'scheduling',
        progress: 5 + Math.round((i / totalPhases) * 25),
        message: `Scheduling ${phase.name}...`,
      });

      // Foundation frequency ramps
      foundationOsc.frequency.setValueAtTime(phase.frequency.start, time);
      foundationOsc.frequency.linearRampToValueAtTime(phase.frequency.end, time + phaseDuration);

      // Harmony frequency (slightly lower)
      const harmonyStart = phase.support_frequency?.start || phase.frequency.start - 5;
      const harmonyEnd = phase.support_frequency?.end || phase.frequency.end - 5;
      harmonyOsc.frequency.setValueAtTime(harmonyStart, time);
      harmonyOsc.frequency.linearRampToValueAtTime(harmonyEnd, time + phaseDuration);

      // Amplitude envelope on foundation gain
      foundationGain.gain.setValueAtTime(phase.amplitude.start * 0.7, time);
      foundationGain.gain.linearRampToValueAtTime(phase.amplitude.end * 0.7, time + phaseDuration);

      harmonyGain.gain.setValueAtTime(phase.amplitude.start * 0.4, time);
      harmonyGain.gain.linearRampToValueAtTime(phase.amplitude.end * 0.4, time + phaseDuration);

      // LFO rate based on rhythm mode
      const rhythmMode = phase.rhythm_mode || 'breathing';
      const lfoRates: Record<string, number> = {
        still: 0,
        breathing: 0.083,
        heartbeat: 1.0,
        theta: 5.0,
        alpha: 10.0,
      };
      const lfoRate = lfoRates[rhythmMode] || 0.083;
      lfo.frequency.setValueAtTime(lfoRate, time);
      lfoGain.gain.setValueAtTime(lfoRate > 0 ? 0.15 : 0, time);

      time += phaseDuration;
    }

    // Fade out at end
    master.gain.setValueAtTime(0.8, totalDuration - 3);
    master.gain.linearRampToValueAtTime(0, totalDuration);

    // Start all oscillators
    foundationOsc.start(0);
    harmonyOsc.start(0);
    lfo.start(0);
    
    foundationOsc.stop(totalDuration);
    harmonyOsc.stop(totalDuration);
    lfo.stop(totalDuration);

    onProgress?.({
      phase: 'Rendering',
      stage: 'processing',
      progress: 35,
      message: `Rendering ${config.duration_minutes} minutes of audio...`,
    });

    // Render - this is the heavy part but memory efficient
    const renderedBuffer = await offlineCtx.startRendering();

    onProgress?.({
      phase: 'Complete',
      stage: 'done',
      progress: 100,
      message: 'Rendering complete!',
    });

    return renderedBuffer;
  }
}
