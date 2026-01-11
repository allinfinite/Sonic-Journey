/**
 * Zustand store for bass generator state management
 */

import { create } from 'zustand';
import type {
  BassGeneratorConfig,
  AnalysisResult,
  UploadState,
  AnalysisState,
  GenerationState,
  PreviewMode,
  BassProgress,
  BassExportOptions,
} from '../types/bassGenerator';
import { DEFAULT_BASS_CONFIG } from '../types/bassGenerator';
import { createBassMixer, BassMixer } from '../audio/bassGenerator/BassMixer';
import { checkServerHealth, processAudioOnServer } from '../api/bassProcessorApi';

export type ProcessingMode = 'client' | 'server';

interface BassStore {
  // Processing mode
  processingMode: ProcessingMode;
  serverAvailable: boolean;
  
  // Upload state
  uploadState: UploadState;
  uploadedFile: File | null;
  originalBuffer: AudioBuffer | null;
  
  // Analysis state
  analysisState: AnalysisState;
  analysisResult: AnalysisResult | null;
  
  // Generation state
  generationState: GenerationState;
  progress: BassProgress | null;
  
  // Configuration
  config: BassGeneratorConfig;
  
  // Preview
  previewMode: PreviewMode;
  isPlaying: boolean;
  currentTime: number;
  
  // Output buffers
  bassBuffer: AudioBuffer | null;
  mixedBuffer: AudioBuffer | null;
  
  // Export
  exportOptions: BassExportOptions;
  isExporting: boolean;
  
  // Audio context for preview
  audioContext: AudioContext | null;
  sourceNode: AudioBufferSourceNode | null;
  
  // Mixer instance
  mixer: BassMixer;
  
  // Actions
  setUploadedFile: (file: File | null) => void;
  setOriginalBuffer: (buffer: AudioBuffer | null) => void;
  setUploadState: (state: UploadState) => void;
  
  setAnalysisState: (state: AnalysisState) => void;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  
  setGenerationState: (state: GenerationState) => void;
  setProgress: (progress: BassProgress | null) => void;
  
  updateConfig: (config: Partial<BassGeneratorConfig>) => void;
  resetConfig: () => void;
  
  setPreviewMode: (mode: PreviewMode) => void;
  setBassBuffer: (buffer: AudioBuffer | null) => void;
  setMixedBuffer: (buffer: AudioBuffer | null) => void;
  
  setExportOptions: (options: Partial<BassExportOptions>) => void;
  setIsExporting: (isExporting: boolean) => void;
  
  // Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  
  // Process actions
  processAudio: () => Promise<void>;
  regenerateBass: () => Promise<void>;
  
  // Export
  exportAudio: (bassOnly: boolean) => Promise<Blob | null>;
  
  // Processing mode
  setProcessingMode: (mode: ProcessingMode) => void;
  checkServerStatus: () => Promise<void>;
  
  // Reset
  reset: () => void;
}

export const useBassStore = create<BassStore>((set, get) => ({
  // Initial state
  processingMode: 'client',
  serverAvailable: false,
  
  uploadState: 'idle',
  uploadedFile: null,
  originalBuffer: null,
  
  analysisState: 'idle',
  analysisResult: null,
  
  generationState: 'idle',
  progress: null,
  
  config: { ...DEFAULT_BASS_CONFIG },
  
  previewMode: 'mixed',
  isPlaying: false,
  currentTime: 0,
  
  bassBuffer: null,
  mixedBuffer: null,
  
  exportOptions: {
    includeOriginal: true,
    format: 'wav',
    sampleRate: 48000,
    normalize: true,
  },
  isExporting: false,
  
  audioContext: null,
  sourceNode: null,
  
  mixer: createBassMixer(),
  
  // Upload actions
  setUploadedFile: (file) => {
    set({ uploadedFile: file });
  },
  
  setOriginalBuffer: (buffer) => {
    set({ originalBuffer: buffer });
  },
  
  setUploadState: (state) => {
    set({ uploadState: state });
  },
  
  // Analysis actions
  setAnalysisState: (state) => {
    set({ analysisState: state });
  },
  
  setAnalysisResult: (result) => {
    set({ analysisResult: result });
  },
  
  // Generation actions
  setGenerationState: (state) => {
    set({ generationState: state });
  },
  
  setProgress: (progress) => {
    set({ progress });
  },
  
  // Config actions
  updateConfig: (config) => {
    const newConfig = { ...get().config, ...config };
    set({ config: newConfig });
    get().mixer.setConfig(newConfig);
  },
  
  resetConfig: () => {
    set({ config: { ...DEFAULT_BASS_CONFIG } });
    get().mixer.setConfig(DEFAULT_BASS_CONFIG);
  },
  
  // Preview actions
  setPreviewMode: (mode) => {
    set({ previewMode: mode });
    // Restart playback if playing
    const { isPlaying } = get();
    if (isPlaying) {
      get().stop();
      get().play();
    }
  },
  
  setBassBuffer: (buffer) => {
    set({ bassBuffer: buffer });
  },
  
  setMixedBuffer: (buffer) => {
    set({ mixedBuffer: buffer });
  },
  
  // Export actions
  setExportOptions: (options) => {
    set((state) => ({
      exportOptions: { ...state.exportOptions, ...options },
    }));
  },
  
  setIsExporting: (isExporting) => {
    set({ isExporting });
  },
  
  // Playback actions
  play: () => {
    const { previewMode, originalBuffer, bassBuffer, mixedBuffer, currentTime } = get();
    
    // Select buffer based on preview mode
    let buffer: AudioBuffer | null = null;
    switch (previewMode) {
      case 'original':
        buffer = originalBuffer;
        break;
      case 'bass':
        buffer = bassBuffer;
        break;
      case 'mixed':
        buffer = mixedBuffer;
        break;
    }
    
    if (!buffer) return;
    
    // Create or resume audio context
    let ctx = get().audioContext;
    if (!ctx) {
      ctx = new AudioContext();
      set({ audioContext: ctx });
    }
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    // Stop any existing playback
    const existingSource = get().sourceNode;
    if (existingSource) {
      try {
        existingSource.stop();
      } catch {
        // Already stopped
      }
    }
    
    // Create new source
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    // Handle playback end
    source.onended = () => {
      set({ isPlaying: false, currentTime: 0 });
    };
    
    // Start from current position
    const startOffset = currentTime;
    source.start(0, startOffset);
    
    set({
      sourceNode: source,
      isPlaying: true,
    });
    
    // Update current time
    const startTime = ctx.currentTime - startOffset;
    const updateTime = () => {
      const { isPlaying, audioContext } = get();
      if (!isPlaying || !audioContext) return;
      
      const newTime = audioContext.currentTime - startTime;
      set({ currentTime: Math.min(newTime, buffer!.duration) });
      
      if (newTime < buffer!.duration) {
        requestAnimationFrame(updateTime);
      }
    };
    requestAnimationFrame(updateTime);
  },
  
  pause: () => {
    const { sourceNode, audioContext } = get();
    
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch {
        // Already stopped
      }
    }
    
    if (audioContext) {
      audioContext.suspend();
    }
    
    set({ isPlaying: false });
  },
  
  stop: () => {
    const { sourceNode } = get();
    
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch {
        // Already stopped
      }
    }
    
    set({ isPlaying: false, currentTime: 0 });
  },
  
  seek: (time) => {
    const { isPlaying } = get();
    set({ currentTime: time });
    
    if (isPlaying) {
      get().stop();
      get().play();
    }
  },
  
  setCurrentTime: (time) => {
    set({ currentTime: time });
  },
  
  // Process audio (supports both client and server modes)
  processAudio: async () => {
    const { originalBuffer, uploadedFile, mixer, processingMode, config } = get();
    
    console.log('processAudio called, mode:', processingMode, 'originalBuffer:', !!originalBuffer);
    
    if (!originalBuffer) {
      console.error('No original buffer available');
      set({ analysisState: 'error' });
      return;
    }
    
    try {
      console.log('Starting audio processing...');
      set({ 
        analysisState: 'analyzing',
        generationState: 'generating',
        progress: { stage: 'analyze-beats', progress: 0, message: 'Starting analysis...' },
      });
      
      // Use server-side processing if available and enabled
      if (processingMode === 'server' && uploadedFile) {
        console.log('Using server-side processing...');
        
        const result = await processAudioOnServer(uploadedFile, config, (progress) => {
          set({ progress });
        });
        
        set({
          analysisResult: result.analysisResult,
          analysisState: 'complete',
          bassBuffer: result.bassBuffer,
          mixedBuffer: result.mixedBuffer,
          generationState: 'complete',
          progress: null,
        });
        
        return;
      }
      
      // Client-side processing
      console.log('Using client-side processing...');
      
      // Process audio (analyze + generate)
      const result = await mixer.processAudio(originalBuffer, (progress) => {
        set({ progress });
      });
      
      set({ 
        analysisResult: result,
        analysisState: 'complete',
      });
      
      // Get generated bass
      const bassBuffer = await mixer.getMixedBass((progress) => {
        set({ progress });
      });
      
      // Get final mix
      const mixedBuffer = await mixer.getFinalMix((progress) => {
        set({ progress });
      });
      
      set({
        bassBuffer,
        mixedBuffer,
        generationState: 'complete',
        progress: null,
      });
      
    } catch (error) {
      console.error('Audio processing error:', error);
      set({
        analysisState: 'error',
        generationState: 'error',
        progress: null,
      });
    }
  },
  
  // Regenerate bass with current config
  regenerateBass: async () => {
    const { originalBuffer, mixer, config } = get();
    
    if (!originalBuffer) return;
    
    try {
      set({ generationState: 'generating' });
      
      // Update mixer config
      mixer.setConfig(config);
      
      // Re-process audio
      await mixer.processAudio(originalBuffer, (progress) => {
        set({ progress });
      });
      
      // Get new bass
      const bassBuffer = await mixer.getMixedBass((progress) => {
        set({ progress });
      });
      
      // Get new mix
      const mixedBuffer = await mixer.getFinalMix((progress) => {
        set({ progress });
      });
      
      set({
        bassBuffer,
        mixedBuffer,
        generationState: 'complete',
        progress: null,
      });
      
    } catch (error) {
      console.error('Bass regeneration error:', error);
      set({
        generationState: 'error',
        progress: null,
      });
    }
  },
  
  // Export audio
  exportAudio: async (bassOnly) => {
    const { bassBuffer, mixedBuffer, exportOptions } = get();
    
    const buffer = bassOnly ? bassBuffer : mixedBuffer;
    if (!buffer) return null;
    
    set({ isExporting: true });
    
    try {
      // Create offline context for export
      const offlineCtx = new OfflineAudioContext(
        buffer.numberOfChannels,
        buffer.length,
        exportOptions.sampleRate
      );
      
      // Resample if needed
      let exportBuffer = buffer;
      if (buffer.sampleRate !== exportOptions.sampleRate) {
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start();
        exportBuffer = await offlineCtx.startRendering();
      }
      
      // Normalize if requested
      if (exportOptions.normalize) {
        for (let ch = 0; ch < exportBuffer.numberOfChannels; ch++) {
          const data = exportBuffer.getChannelData(ch);
          let maxAbs = 0;
          for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > maxAbs) maxAbs = abs;
          }
          if (maxAbs > 0) {
            const scale = 0.95 / maxAbs;
            for (let i = 0; i < data.length; i++) {
              data[i] *= scale;
            }
          }
        }
      }
      
      // Encode to format
      let blob: Blob;
      if (exportOptions.format === 'wav') {
        blob = encodeWAV(exportBuffer);
      } else {
        // For MP3, fall back to WAV for now (would need lamejs)
        blob = encodeWAV(exportBuffer);
      }
      
      set({ isExporting: false });
      return blob;
      
    } catch (error) {
      console.error('Export error:', error);
      set({ isExporting: false });
      return null;
    }
  },
  
  // Processing mode
  setProcessingMode: (mode) => {
    set({ processingMode: mode });
  },
  
  checkServerStatus: async () => {
    const available = await checkServerHealth();
    set({ serverAvailable: available });
    if (available) {
      console.log('Server is available for processing');
    } else {
      console.log('Server not available, using client-side processing');
    }
  },
  
  // Reset all state
  reset: () => {
    const { sourceNode, audioContext, mixer } = get();
    
    // Stop playback
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch {
        // Already stopped
      }
    }
    
    // Close audio context
    if (audioContext) {
      audioContext.close();
    }
    
    // Clear mixer
    mixer.clear();
    
    set({
      uploadState: 'idle',
      uploadedFile: null,
      originalBuffer: null,
      analysisState: 'idle',
      analysisResult: null,
      generationState: 'idle',
      progress: null,
      config: { ...DEFAULT_BASS_CONFIG },
      previewMode: 'mixed',
      isPlaying: false,
      currentTime: 0,
      bassBuffer: null,
      mixedBuffer: null,
      audioContext: null,
      sourceNode: null,
    });
  },
}));

/**
 * Encode AudioBuffer to WAV blob
 */
function encodeWAV(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const fileSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(fileSize);
  const view = new DataView(arrayBuffer);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Interleave channels and write samples
  const offset = 44;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }
  
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + (i * numChannels + ch) * bytesPerSample, intSample, true);
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Decode audio file to AudioBuffer
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioContext.close();
  return audioBuffer;
}
