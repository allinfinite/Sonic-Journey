/**
 * WAV Encoder - Converts AudioBuffer to WAV file format
 */

/**
 * Write a string to a DataView at a specific offset
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Encode AudioBuffer to WAV format
 * @param buffer - AudioBuffer to encode
 * @param bitDepth - Bit depth (16, 24, or 32)
 * @returns Blob containing WAV file data
 */
export function encodeWav(
  buffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 = 16
): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = bitDepth === 32 ? 3 : 1; // 3 = IEEE float, 1 = PCM
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;

  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // File size - 8
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // Get channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  // Interleave and write samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));

      if (bitDepth === 16) {
        // 16-bit PCM
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, Math.round(int16), true);
        offset += 2;
      } else if (bitDepth === 24) {
        // 24-bit PCM
        const int24 = sample < 0 ? sample * 0x800000 : sample * 0x7fffff;
        const rounded = Math.round(int24);
        view.setUint8(offset, rounded & 0xff);
        view.setUint8(offset + 1, (rounded >> 8) & 0xff);
        view.setUint8(offset + 2, (rounded >> 16) & 0xff);
        offset += 3;
      } else {
        // 32-bit float
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Encode AudioBuffer to WAV with progress callback
 * Useful for very long audio files
 */
export async function encodeWavWithProgress(
  buffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 = 16,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = bitDepth === 32 ? 3 : 1;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;

  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // Write header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Get channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  // Process in chunks for progress updates
  const chunkSize = 48000; // 1 second at 48kHz
  let offset = 44;
  let samplesProcessed = 0;

  const processChunk = (): Promise<void> => {
    return new Promise((resolve) => {
      const endSample = Math.min(samplesProcessed + chunkSize, buffer.length);

      for (let i = samplesProcessed; i < endSample; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = Math.max(-1, Math.min(1, channels[ch][i]));

          if (bitDepth === 16) {
            const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            view.setInt16(offset, Math.round(int16), true);
            offset += 2;
          } else if (bitDepth === 24) {
            const int24 = sample < 0 ? sample * 0x800000 : sample * 0x7fffff;
            const rounded = Math.round(int24);
            view.setUint8(offset, rounded & 0xff);
            view.setUint8(offset + 1, (rounded >> 8) & 0xff);
            view.setUint8(offset + 2, (rounded >> 16) & 0xff);
            offset += 3;
          } else {
            view.setFloat32(offset, sample, true);
            offset += 4;
          }
        }
      }

      samplesProcessed = endSample;
      onProgress?.(Math.round((samplesProcessed / buffer.length) * 100));

      // Yield to event loop
      setTimeout(resolve, 0);
    });
  };

  while (samplesProcessed < buffer.length) {
    await processChunk();
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Trigger download of a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
