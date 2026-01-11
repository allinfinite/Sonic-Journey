/**
 * API client for server-side bass processing
 */

import type { BassGeneratorConfig, AnalysisResult, BassProgress } from '../types/bassGenerator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ServerProcessingResult {
  success: boolean;
  processingTime: number;
  analysis: {
    duration: number;
    sampleRate: number;
    bpm: number;
    beatsCount: number;
    averageBassEnergy: number;
  };
  // Small files - base64 encoded
  bassAudio?: string;
  mixedAudio?: string;
  // Large files - URLs to download
  bassAudioUrl?: string;
  mixedAudioUrl?: string;
  format: string;
  streamMode: boolean;
}

/**
 * Check if server is available
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Process audio file on server
 */
export async function processAudioOnServer(
  file: File,
  config: Partial<BassGeneratorConfig>,
  onProgress?: (progress: BassProgress) => void
): Promise<{
  analysisResult: AnalysisResult;
  bassBuffer: AudioBuffer;
  mixedBuffer: AudioBuffer;
}> {
  onProgress?.({
    stage: 'decode',
    progress: 0,
    message: 'Uploading to server...',
  });

  const formData = new FormData();
  formData.append('audio', file);
  formData.append('config', JSON.stringify({
    frequencyMin: config.frequencyMin ?? 20,
    frequencyMax: config.frequencyMax ?? 80,
    intensity: config.intensity ?? 0.7,
    beatSyncedWeight: config.beatSyncedWeight ?? 0.6,
    harmonicWeight: config.harmonicWeight ?? 0.2,
    enhancedWeight: config.enhancedWeight ?? 0.2,
  }));

  onProgress?.({
    stage: 'analyze-beats',
    progress: 20,
    message: 'Processing on server...',
  });

  const response = await fetch(`${API_URL}/api/process`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Server processing failed');
  }

  onProgress?.({
    stage: 'generate',
    progress: 80,
    message: 'Receiving results...',
  });

  const result: ServerProcessingResult = await response.json();
  
  console.log('Server response:', { 
    streamMode: result.streamMode, 
    hasUrls: !!(result.bassAudioUrl && result.mixedAudioUrl),
    processingTime: result.processingTime 
  });

  // Decode audio to AudioBuffer - either from base64 or fetch from URL
  const audioContext = new AudioContext({ sampleRate: result.analysis.sampleRate });
  
  let bassBuffer: AudioBuffer;
  let mixedBuffer: AudioBuffer;
  
  if (result.streamMode && result.bassAudioUrl && result.mixedAudioUrl) {
    // Large files - fetch from URLs
    onProgress?.({
      stage: 'mix',
      progress: 85,
      message: 'Downloading bass track...',
    });
    
    const [bassResponse, mixedResponse] = await Promise.all([
      fetch(`${API_URL}${result.bassAudioUrl}`),
      fetch(`${API_URL}${result.mixedAudioUrl}`),
    ]);
    
    onProgress?.({
      stage: 'mix',
      progress: 95,
      message: 'Decoding audio...',
    });
    
    const [bassArrayBuffer, mixedArrayBuffer] = await Promise.all([
      bassResponse.arrayBuffer(),
      mixedResponse.arrayBuffer(),
    ]);
    
    [bassBuffer, mixedBuffer] = await Promise.all([
      audioContext.decodeAudioData(bassArrayBuffer),
      audioContext.decodeAudioData(mixedArrayBuffer),
    ]);
  } else if (result.bassAudio && result.mixedAudio) {
    // Small files - decode from base64
    const bassArrayBuffer = base64ToArrayBuffer(result.bassAudio);
    const mixedArrayBuffer = base64ToArrayBuffer(result.mixedAudio);
    
    [bassBuffer, mixedBuffer] = await Promise.all([
      audioContext.decodeAudioData(bassArrayBuffer),
      audioContext.decodeAudioData(mixedArrayBuffer),
    ]);
  } else {
    throw new Error('Server response missing audio data');
  }

  onProgress?.({
    stage: 'mix',
    progress: 100,
    message: 'Complete!',
  });

  // Convert server analysis to our AnalysisResult format
  const analysisResult: AnalysisResult = {
    duration: result.analysis.duration,
    sampleRate: result.analysis.sampleRate,
    bpm: result.analysis.bpm,
    beats: [], // Server doesn't return individual beats
    pitchData: [],
    detectedKey: undefined,
    bassProfile: [],
    averageBassEnergy: result.analysis.averageBassEnergy,
  };

  return {
    analysisResult,
    bassBuffer,
    mixedBuffer,
  };
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
