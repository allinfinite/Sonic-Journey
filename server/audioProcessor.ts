/**
 * Server-side Audio Processor
 * Fast audio analysis and bass generation using Node.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface ProcessingConfig {
  frequencyMin?: number;
  frequencyMax?: number;
  baseFrequency?: number;
  intensity?: number;
  beatSyncedWeight?: number;
  harmonicWeight?: number;
  enhancedWeight?: number;
  dryWetMix?: number;
}

export interface ProgressCallback {
  (progress: { stage: string; progress: number; message: string }): void;
}

export interface ProcessingResult {
  analysis: {
    duration: number;
    sampleRate: number;
    bpm: number;
    beatsCount: number;
    averageBassEnergy: number;
  };
  bassBuffer: Buffer;
  mixedBuffer: Buffer;
}

const DEFAULT_CONFIG: ProcessingConfig = {
  frequencyMin: 20,
  frequencyMax: 80,
  baseFrequency: 40,
  intensity: 0.7,
  beatSyncedWeight: 0.6,
  harmonicWeight: 0.2,
  enhancedWeight: 0.2,
  dryWetMix: 0.5,
};

/**
 * Process an audio file and generate bass track
 */
export async function processAudioFile(
  filePath: string,
  config: Partial<ProcessingConfig> = {},
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  onProgress?.({ stage: 'decode', progress: 0, message: 'Decoding audio file...' });
  
  // Read and decode audio file to raw PCM
  const audioData = await decodeAudioFile(filePath);
  
  onProgress?.({ stage: 'decode', progress: 100, message: 'Audio decoded' });
  onProgress?.({ stage: 'analyze', progress: 0, message: 'Analyzing audio...' });
  
  // Analyze audio for beats
  const analysis = analyzeAudio(audioData, onProgress);
  
  onProgress?.({ stage: 'generate', progress: 0, message: 'Generating bass track...' });
  
  // Generate bass track
  const bassData = generateBassTrack(audioData, analysis, cfg, onProgress);
  
  onProgress?.({ stage: 'mix', progress: 0, message: 'Mixing audio...' });
  
  // Mix bass with original
  const mixedData = mixAudio(audioData, bassData, cfg.dryWetMix!, cfg.intensity!);
  
  onProgress?.({ stage: 'encode', progress: 0, message: 'Encoding output...' });
  
  // Encode to WAV
  const bassBuffer = encodeWav(bassData, audioData.sampleRate, 1);
  const mixedBuffer = encodeWav(mixedData, audioData.sampleRate, audioData.channels);
  
  onProgress?.({ stage: 'complete', progress: 100, message: 'Processing complete' });
  
  return {
    analysis: {
      duration: audioData.duration,
      sampleRate: audioData.sampleRate,
      bpm: analysis.bpm,
      beatsCount: analysis.beats.length,
      averageBassEnergy: analysis.averageBassEnergy,
    },
    bassBuffer,
    mixedBuffer,
  };
}

interface AudioData {
  samples: Float32Array[];
  sampleRate: number;
  channels: number;
  duration: number;
}

interface Beat {
  time: number;
  strength: number;
}

interface AudioAnalysis {
  bpm: number;
  beats: Beat[];
  averageBassEnergy: number;
}

/**
 * Decode audio file to raw PCM using ffmpeg
 */
async function decodeAudioFile(filePath: string): Promise<AudioData> {
  const tempRawFile = filePath + '.raw';
  const sampleRate = 44100;
  
  try {
    // Use ffmpeg to convert to raw PCM
    await execAsync(
      `ffmpeg -i "${filePath}" -f f32le -acodec pcm_f32le -ar ${sampleRate} -ac 2 -y "${tempRawFile}" 2>/dev/null`
    );
    
    // Read raw PCM data
    const rawData = fs.readFileSync(tempRawFile);
    const floatArray = new Float32Array(rawData.buffer, rawData.byteOffset, rawData.length / 4);
    
    // Deinterleave stereo channels
    const numSamples = floatArray.length / 2;
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      left[i] = floatArray[i * 2];
      right[i] = floatArray[i * 2 + 1];
    }
    
    // Clean up temp file
    fs.unlinkSync(tempRawFile);
    
    return {
      samples: [left, right],
      sampleRate,
      channels: 2,
      duration: numSamples / sampleRate,
    };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempRawFile)) {
      fs.unlinkSync(tempRawFile);
    }
    throw new Error(`Failed to decode audio: ${error}`);
  }
}

/**
 * Analyze audio for beats and energy
 */
function analyzeAudio(audioData: AudioData, onProgress?: ProgressCallback): AudioAnalysis {
  const { samples, sampleRate } = audioData;
  
  // Get mono mix
  const mono = new Float32Array(samples[0].length);
  for (let i = 0; i < mono.length; i++) {
    mono[i] = (samples[0][i] + samples[1][i]) / 2;
  }
  
  // Beat detection using energy envelope
  const windowSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((mono.length - windowSize) / hopSize);
  
  // Calculate energy envelope
  const energy = new Float32Array(numFrames);
  let totalBassEnergy = 0;
  
  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;
    let sum = 0;
    
    for (let i = 0; i < windowSize; i++) {
      sum += mono[start + i] * mono[start + i];
    }
    
    energy[frame] = Math.sqrt(sum / windowSize);
    totalBassEnergy += energy[frame];
    
    if (onProgress && frame % 500 === 0) {
      onProgress({ stage: 'analyze', progress: (frame / numFrames) * 100, message: 'Analyzing audio...' });
    }
  }
  
  // Calculate energy differences for onset detection
  const diff = new Float32Array(numFrames);
  for (let i = 1; i < numFrames; i++) {
    const d = energy[i] - energy[i - 1];
    diff[i] = d > 0 ? d : 0;
  }
  
  // Adaptive threshold
  const threshold = calculateAdaptiveThreshold(diff, Math.floor(sampleRate / hopSize / 2));
  
  // Find peaks (beats)
  const beats: Beat[] = [];
  const minBeatInterval = Math.floor((0.2 * sampleRate) / hopSize);
  let lastBeat = -minBeatInterval;
  
  let maxDiff = 0;
  for (let i = 0; i < diff.length; i++) {
    if (diff[i] > maxDiff) maxDiff = diff[i];
  }
  
  for (let i = 1; i < diff.length - 1; i++) {
    if (
      diff[i] > diff[i - 1] &&
      diff[i] >= diff[i + 1] &&
      diff[i] > threshold[i] &&
      i - lastBeat >= minBeatInterval
    ) {
      beats.push({
        time: (i * hopSize) / sampleRate,
        strength: Math.min(1, diff[i] / (maxDiff * 0.5)),
      });
      lastBeat = i;
    }
  }
  
  // Estimate BPM
  const bpm = estimateBPM(beats);
  
  return {
    bpm,
    beats,
    averageBassEnergy: totalBassEnergy / numFrames,
  };
}

/**
 * Calculate adaptive threshold for beat detection
 */
function calculateAdaptiveThreshold(data: Float32Array, windowSize: number): Float32Array {
  const threshold = new Float32Array(data.length);
  const halfWindow = Math.floor(windowSize / 2);
  const multiplier = 1.4;
  
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - halfWindow); j < Math.min(data.length, i + halfWindow); j++) {
      sum += data[j];
      count++;
    }
    
    threshold[i] = (sum / count) * multiplier;
  }
  
  return threshold;
}

/**
 * Estimate BPM from beat intervals
 */
function estimateBPM(beats: Beat[]): number {
  if (beats.length < 2) return 120;
  
  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    const interval = beats[i].time - beats[i - 1].time;
    if (interval > 0.2 && interval < 2) {
      intervals.push(interval);
    }
  }
  
  if (intervals.length === 0) return 120;
  
  // Use histogram
  const bpmCounts = new Map<number, number>();
  for (const interval of intervals) {
    const bpm = Math.round((60 / interval) / 5) * 5;
    if (bpm >= 60 && bpm <= 180) {
      bpmCounts.set(bpm, (bpmCounts.get(bpm) || 0) + 1);
    }
  }
  
  let maxCount = 0;
  let estimatedBPM = 120;
  for (const [bpm, count] of bpmCounts) {
    if (count > maxCount) {
      maxCount = count;
      estimatedBPM = bpm;
    }
  }
  
  return estimatedBPM;
}

/**
 * Generate bass track from analysis
 */
function generateBassTrack(
  audioData: AudioData,
  analysis: AudioAnalysis,
  config: ProcessingConfig,
  onProgress?: ProgressCallback
): Float32Array {
  const { sampleRate } = audioData;
  const numSamples = audioData.samples[0].length;
  const output = new Float32Array(numSamples);
  
  const { baseFrequency, intensity, frequencyMin, frequencyMax } = config;
  const attackTime = 0.01;
  const decayTime = 0.15;
  const beatInterval = 60 / analysis.bpm;
  
  // Pre-calculate pulse envelope
  const pulseDuration = attackTime + decayTime;
  const pulseSamples = Math.ceil(pulseDuration * sampleRate);
  const attackSamples = Math.ceil(attackTime * sampleRate);
  
  const envelope = new Float32Array(pulseSamples);
  for (let s = 0; s < pulseSamples; s++) {
    if (s < attackSamples) {
      envelope[s] = s / attackSamples;
    } else {
      envelope[s] = Math.exp(-3 * (s - attackSamples) / (pulseSamples - attackSamples));
    }
  }
  
  // Generate bass pulses at each beat
  for (let i = 0; i < analysis.beats.length; i++) {
    const beat = analysis.beats[i];
    const beatStartSample = Math.floor(beat.time * sampleRate);
    
    // Vary frequency by beat position
    const beatInBar = Math.floor(beat.time / beatInterval) % 4;
    let freq: number;
    switch (beatInBar) {
      case 0: freq = frequencyMin! + (frequencyMax! - frequencyMin!) * 0.2; break;
      case 2: freq = frequencyMin! + (frequencyMax! - frequencyMin!) * 0.4; break;
      default: freq = frequencyMin! + (frequencyMax! - frequencyMin!) * 0.6;
    }
    
    const freqFactor = (2 * Math.PI * freq) / sampleRate;
    const ampFactor = intensity! * beat.strength;
    
    // Generate pulse
    for (let s = 0; s < pulseSamples; s++) {
      const idx = beatStartSample + s;
      if (idx >= numSamples) break;
      output[idx] += Math.sin(s * freqFactor) * envelope[s] * ampFactor;
    }
    
    if (onProgress && i % 50 === 0) {
      onProgress({ stage: 'generate', progress: (i / analysis.beats.length) * 100, message: 'Generating bass...' });
    }
  }
  
  // Normalize
  let maxAbs = 0;
  for (let i = 0; i < output.length; i++) {
    const abs = Math.abs(output[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs > 0) {
    const scale = 0.9 / maxAbs;
    for (let i = 0; i < output.length; i++) {
      output[i] *= scale;
    }
  }
  
  return output;
}

/**
 * Mix bass with original audio
 */
function mixAudio(
  original: AudioData,
  bass: Float32Array,
  dryWetMix: number,
  intensity: number
): Float32Array[] {
  const numSamples = original.samples[0].length;
  const mixed: Float32Array[] = [];
  
  for (let ch = 0; ch < original.channels; ch++) {
    const output = new Float32Array(numSamples);
    const orig = original.samples[ch];
    
    for (let i = 0; i < numSamples; i++) {
      // dryWetMix: 0 = bass only, 1 = original only
      output[i] = orig[i] * dryWetMix + bass[i] * (1 - dryWetMix) * intensity;
    }
    
    // Soft clip
    for (let i = 0; i < numSamples; i++) {
      if (Math.abs(output[i]) > 0.9) {
        const sign = output[i] > 0 ? 1 : -1;
        const excess = Math.abs(output[i]) - 0.9;
        output[i] = sign * (0.9 + 0.1 * Math.tanh(excess * 10));
      }
    }
    
    mixed.push(output);
  }
  
  return mixed;
}

/**
 * Encode audio data to WAV format
 */
function encodeWav(samples: Float32Array | Float32Array[], sampleRate: number, channels: number): Buffer {
  const data = Array.isArray(samples) ? samples : [samples];
  const numSamples = data[0].length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = channels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;
  
  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  
  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
  buffer.writeUInt16LE(channels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * blockAlign, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(16, offset); offset += 2; // bits per sample
  
  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Interleave and write samples
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, data[ch % data.length][i]));
      const intSample = Math.round(sample * 32767);
      buffer.writeInt16LE(intSample, offset);
      offset += 2;
    }
  }
  
  return buffer;
}
