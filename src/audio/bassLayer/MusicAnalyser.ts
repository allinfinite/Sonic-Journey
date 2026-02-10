/**
 * MusicAnalyser - Real-time audio analysis via microphone input
 * Analyses mid-range frequencies (300-4000 Hz) to detect key, tempo, and energy.
 * A high-pass filter at 250 Hz prevents feedback from the app's own bass output.
 * Used to drive the bass layer in "Listen" mode.
 */

import type { MusicalKey } from '../../types/bassLayer';
import { KEY_FREQUENCIES } from '../../types/bassLayer';

export interface AnalysisResult {
  /** Dominant detected frequency in Hz (mid-range, mapped to key) */
  dominantFrequency: number;
  /** Nearest musical key to the dominant frequency */
  musicalKey: MusicalKey;
  /** Mid-range energy level 0-1 */
  energy: number;
  /** Detected BPM (0 if no clear beat) */
  bpm: number;
  /** Whether a beat onset was just detected */
  beatDetected: boolean;
  /** Whether music is currently detected */
  musicPresent: boolean;
}

const KEYS_WITH_FREQS: { key: MusicalKey; freq: number }[] = (
  Object.entries(KEY_FREQUENCIES) as [MusicalKey, number][]
).map(([key, freq]) => ({ key, freq }));

/** All octaves from 0 to 6 for matching any detected frequency to a key */
const ALL_KEY_FREQS: { key: MusicalKey; freq: number }[] = [
  ...KEYS_WITH_FREQS.map(({ key, freq }) => ({ key, freq: freq / 2 })),  // Octave 0
  ...KEYS_WITH_FREQS,                                                      // Octave 1
  ...KEYS_WITH_FREQS.map(({ key, freq }) => ({ key, freq: freq * 2 })),  // Octave 2
  ...KEYS_WITH_FREQS.map(({ key, freq }) => ({ key, freq: freq * 4 })),  // Octave 3
  ...KEYS_WITH_FREQS.map(({ key, freq }) => ({ key, freq: freq * 8 })),  // Octave 4
  ...KEYS_WITH_FREQS.map(({ key, freq }) => ({ key, freq: freq * 16 })), // Octave 5
  ...KEYS_WITH_FREQS.map(({ key, freq }) => ({ key, freq: freq * 32 })), // Octave 6
];

function nearestKey(hz: number): MusicalKey {
  let closest = ALL_KEY_FREQS[0];
  let minDist = Infinity;
  for (const entry of ALL_KEY_FREQS) {
    const dist = Math.abs(Math.log2(hz / entry.freq));
    if (dist < minDist) {
      minDist = dist;
      closest = entry;
    }
  }
  return closest.key;
}

export class MusicAnalyser {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private freqData: Float32Array<ArrayBuffer> | null = null;
  private isActive = false;

  // Beat detection state
  private energyHistory: number[] = [];
  private onsetTimes: number[] = [];
  private lastOnsetTime = 0;
  private readonly ONSET_COOLDOWN_MS = 120;
  private readonly ENERGY_HISTORY_SIZE = 30;
  private readonly ONSET_THRESHOLD = 1.25;

  // Smoothing state
  private smoothedFreq = 440;
  private smoothedEnergy = 0;
  private smoothedBpm = 0;

  // Music presence detection
  private presenceHistory: number[] = [];
  private readonly PRESENCE_HISTORY_SIZE = 60;
  private readonly MUSIC_THRESHOLD = 0.02;

  async start(): Promise<void> {
    if (this.isActive) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.ctx = new AudioContext();
    this.sourceNode = this.ctx.createMediaStreamSource(this.stream);

    // High-pass filter at 250 Hz to reject the app's own bass output
    this.highPassFilter = this.ctx.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 250;
    this.highPassFilter.Q.value = 0.7;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0.7;

    this.sourceNode.connect(this.highPassFilter);
    this.highPassFilter.connect(this.analyser);

    this.freqData = new Float32Array(this.analyser.frequencyBinCount);
    this.energyHistory = [];
    this.onsetTimes = [];
    this.presenceHistory = [];
    this.lastOnsetTime = 0;
    this.smoothedFreq = 440;
    this.smoothedEnergy = 0;
    this.smoothedBpm = 0;
    this.isActive = true;
  }

  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.highPassFilter?.disconnect();
    this.highPassFilter = null;
    this.analyser = null;
    this.freqData = null;

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  /**
   * Run one frame of analysis. Call this from requestAnimationFrame.
   * Returns null if not active.
   */
  analyse(): AnalysisResult | null {
    if (!this.isActive || !this.analyser || !this.freqData || !this.ctx) {
      return null;
    }

    this.analyser.getFloatFrequencyData(this.freqData);

    const sampleRate = this.ctx.sampleRate;
    const binCount = this.analyser.frequencyBinCount;
    const binHz = sampleRate / (binCount * 2);

    // Analyse mid-range (300-4000 Hz) to avoid hearing the app's own bass output.
    // Music presence, energy, and beat detection all use this range.
    const midMinBin = Math.max(1, Math.floor(300 / binHz));
    const midMaxBin = Math.min(binCount - 1, Math.ceil(4000 / binHz));

    // Key detection range (250-2000 Hz) — find the dominant pitch,
    // then map it to the nearest musical key (octave-independent).
    const keyMinBin = Math.max(1, Math.floor(250 / binHz));
    const keyMaxBin = Math.min(binCount - 1, Math.ceil(2000 / binHz));

    // Find dominant mid-range frequency for key detection
    let keyPeakMag = -Infinity;
    let keyPeakBin = keyMinBin;

    for (let i = keyMinBin; i <= keyMaxBin; i++) {
      const mag = this.freqData[i];
      if (mag > keyPeakMag) {
        keyPeakMag = mag;
        keyPeakBin = i;
      }
    }

    // Mid-range energy for presence and beat detection
    let peakMag = -Infinity;

    for (let i = midMinBin; i <= midMaxBin; i++) {
      const mag = this.freqData[i];
      if (mag > peakMag) peakMag = mag;
    }

    const dominantFrequency = keyPeakBin * binHz;

    // More sensitive energy normalization
    // peakMag ranges from about -100 (silence) to 0 (full scale)
    // Mic input is often around -40 to -20 for music
    const energyNorm = Math.min(1, Math.max(0, (peakMag + 80) / 60));

    // Music presence detection - is there meaningful audio?
    this.presenceHistory.push(energyNorm);
    if (this.presenceHistory.length > this.PRESENCE_HISTORY_SIZE) {
      this.presenceHistory.shift();
    }
    const avgPresence =
      this.presenceHistory.reduce((a, b) => a + b, 0) / this.presenceHistory.length;
    const musicPresent = avgPresence > this.MUSIC_THRESHOLD;

    // Beat detection via spectral flux in bass range
    const now = performance.now();
    this.energyHistory.push(energyNorm);
    if (this.energyHistory.length > this.ENERGY_HISTORY_SIZE) {
      this.energyHistory.shift();
    }

    let beatDetected = false;
    if (this.energyHistory.length >= 4) {
      const avg =
        this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
      const isOnset =
        energyNorm > avg * this.ONSET_THRESHOLD &&
        energyNorm > this.MUSIC_THRESHOLD &&
        now - this.lastOnsetTime > this.ONSET_COOLDOWN_MS;

      if (isOnset) {
        beatDetected = true;
        this.lastOnsetTime = now;
        this.onsetTimes.push(now);
        if (this.onsetTimes.length > 24) {
          this.onsetTimes.shift();
        }
      }
    }

    // Calculate BPM from onset intervals
    let detectedBpm = 0;
    if (this.onsetTimes.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < this.onsetTimes.length; i++) {
        intervals.push(this.onsetTimes[i] - this.onsetTimes[i - 1]);
      }
      const validIntervals = intervals.filter(
        (ms) => ms >= 300 && ms <= 1500
      );
      if (validIntervals.length >= 2) {
        // Use median instead of mean for more stable BPM
        const sorted = [...validIntervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        detectedBpm = Math.round(60000 / median);
      }
    }

    // Smooth values - use faster smoothing for energy, slower for freq/bpm
    const freqAlpha = 0.12;
    const energyAlpha = 0.25;
    const bpmAlpha = 0.08;

    if (musicPresent) {
      this.smoothedFreq =
        this.smoothedFreq * (1 - freqAlpha) + dominantFrequency * freqAlpha;
    }
    this.smoothedEnergy =
      this.smoothedEnergy * (1 - energyAlpha) + energyNorm * energyAlpha;
    if (detectedBpm > 0) {
      this.smoothedBpm =
        this.smoothedBpm === 0
          ? detectedBpm
          : this.smoothedBpm * (1 - bpmAlpha) + detectedBpm * bpmAlpha;
    }

    const musicalKey = nearestKey(this.smoothedFreq);

    return {
      dominantFrequency: this.smoothedFreq,
      musicalKey,
      energy: this.smoothedEnergy,
      bpm: Math.round(this.smoothedBpm),
      beatDetected,
      musicPresent,
    };
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  dispose(): void {
    this.stop();
  }
}
