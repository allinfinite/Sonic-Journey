/**
 * MP3 Encoder - Converts AudioBuffer to MP3 using lamejs
 * 
 * Note: lamejs requires certain globals to be set up before use.
 * We set these up before importing the module.
 */

export type MP3Bitrate = 128 | 192 | 256 | 320;

// Set up globals that lamejs needs (it was written for browser globals)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = globalThis as any;
if (typeof globalAny.MPEGMode === 'undefined') {
  globalAny.MPEGMode = {
    STEREO: 0,
    JOINT_STEREO: 1,
    DUAL_CHANNEL: 2,
    MONO: 3,
  };
}
if (typeof globalAny.Lame === 'undefined') {
  globalAny.Lame = {};
}
if (typeof globalAny.BitStream === 'undefined') {
  globalAny.BitStream = {};
}

// Lazy-load lamejs to avoid initialization issues
let lamejsModule: typeof import('lamejs') | null = null;

async function getLamejs() {
  if (!lamejsModule) {
    // Dynamic import to defer loading after globals are set
    lamejsModule = await import('lamejs');
  }
  return lamejsModule.default || lamejsModule;
}

/**
 * Convert Float32Array to Int16Array for MP3 encoding
 */
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Encode AudioBuffer to MP3 format
 * @param buffer - AudioBuffer to encode
 * @param bitrate - MP3 bitrate in kbps
 * @param onProgress - Progress callback (0-100)
 * @returns Blob containing MP3 file data
 */
export async function encodeMp3(
  buffer: AudioBuffer,
  bitrate: MP3Bitrate = 192,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;

  // Get lamejs module
  const lamejs = await getLamejs();
  
  // lamejs works best with 44100 sample rate
  // For now, we'll encode at the buffer's sample rate
  const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);

  // Get channel data
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;

  // Convert to 16-bit PCM
  const leftPCM = floatTo16BitPCM(leftChannel);
  const rightPCM = floatTo16BitPCM(rightChannel);

  // Process in chunks
  const chunkSize = 1152; // MP3 frame size
  const mp3Data: Int8Array[] = [];
  let samplesProcessed = 0;
  const totalSamples = buffer.length;

  // Encode chunks
  while (samplesProcessed < totalSamples) {
    const chunkEnd = Math.min(samplesProcessed + chunkSize, totalSamples);
    const leftChunk = leftPCM.subarray(samplesProcessed, chunkEnd);
    const rightChunk = rightPCM.subarray(samplesProcessed, chunkEnd);

    let mp3buf: Int8Array;
    if (numChannels === 1) {
      mp3buf = encoder.encodeBuffer(leftChunk);
    } else {
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    }

    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    samplesProcessed = chunkEnd;

    // Report progress
    const progress = Math.round((samplesProcessed / totalSamples) * 100);
    onProgress?.(progress);

    // Yield to event loop periodically
    if (samplesProcessed % (chunkSize * 100) === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Flush remaining data
  const flush = encoder.flush();
  if (flush.length > 0) {
    mp3Data.push(flush);
  }

  onProgress?.(100);

  // Combine all chunks into single blob
  const blobParts: BlobPart[] = mp3Data.map(arr => {
    const uint8 = new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      uint8[i] = arr[i];
    }
    return uint8;
  });
  return new Blob(blobParts, { type: 'audio/mpeg' });
}

/**
 * Encode AudioBuffer to MP3 using a Web Worker for better performance
 * Falls back to main thread encoding if Workers aren't available
 */
export async function encodeMp3InWorker(
  buffer: AudioBuffer,
  bitrate: MP3Bitrate = 192,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  // For now, use the main thread encoder
  // A true worker implementation would require a separate worker file
  return encodeMp3(buffer, bitrate, onProgress);
}

/**
 * Estimate MP3 file size in bytes
 */
export function estimateMp3Size(durationSeconds: number, bitrate: MP3Bitrate): number {
  // bitrate is in kbps, convert to bytes
  return Math.ceil((bitrate * 1000 * durationSeconds) / 8);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}
