/**
 * Music Generator - Google Lyria RealTime integration via Gemini API
 * Streams instrumental music from text prompts, collects ~30s, returns WAV
 */

import { GoogleGenAI } from '@google/genai';

let genai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genai) {
    // Read env var lazily (not at module level) to avoid ES module hoisting issues
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GOOGLE_AI_API_KEY environment variable is not set. ' +
        'Get a free API key from https://ai.google.dev/'
      );
    }
    genai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });
  }
  return genai;
}

export interface MusicGenerationResult {
  audioContent: string; // base64-encoded WAV
  mimeType: string;
}

/**
 * Create a WAV file buffer from raw 16-bit PCM data
 */
function createWavBuffer(pcmData: Buffer, sampleRate: number, channels: number): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmData.length;
  const fileSize = dataSize + 36;

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);

  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  header.writeUInt16LE(channels * 2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Generate instrumental music using Google Lyria RealTime
 * Connects via WebSocket, streams ~30s of audio, returns as WAV
 */
export async function generateMusic(
  prompt: string,
  negativePrompt?: string
): Promise<MusicGenerationResult> {
  const client = getClient();

  // Verify client.live.music exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  if (!c.live) {
    throw new Error('client.live is not available — @google/genai version may be too old');
  }
  if (!c.live.music) {
    throw new Error('client.live.music is not available — @google/genai version may be too old');
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY || '';
  console.log(`Lyria RealTime: API key prefix: "${apiKey.substring(0, 6)}..." (${apiKey.length} chars)`);

  const DURATION_SECONDS = 15;
  const SAMPLE_RATE = 48000;
  const CHANNELS = 2;
  const BYTES_PER_FRAME = CHANNELS * 2; // 4 bytes per stereo 16-bit frame
  const TARGET_BYTES = DURATION_SECONDS * SAMPLE_RATE * BYTES_PER_FRAME;
  const TIMEOUT_MS = 60000;

  const fullPrompt = negativePrompt
    ? `${prompt}. Avoid: ${negativePrompt}`
    : prompt;

  console.log(`Lyria RealTime: Connecting for ~${DURATION_SECONDS}s of music...`);
  console.log(`Lyria RealTime: Prompt: "${fullPrompt.substring(0, 100)}"`);

  return new Promise<MusicGenerationResult>((resolve, reject) => {
    const audioChunks: Buffer[] = [];
    let totalBytes = 0;
    let resolved = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let session: any = null;
    let messageCount = 0;

    const cleanup = () => {
      if (session) {
        try { session.close(); } catch { /* ignore */ }
      }
    };

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();

      if (totalBytes > 0) {
        const combined = Buffer.concat(audioChunks);
        const wav = createWavBuffer(combined, SAMPLE_RATE, CHANNELS);
        console.log(`Lyria RealTime: Timeout, returning ${(totalBytes / 1024).toFixed(0)}KB`);
        resolve({ audioContent: wav.toString('base64'), mimeType: 'audio/wav' });
      } else {
        reject(new Error(`Music generation timed out with no audio data (received ${messageCount} messages)`));
      }
    }, TIMEOUT_MS);

    const finishWithAudio = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      cleanup();

      if (totalBytes > 0) {
        const combined = Buffer.concat(audioChunks);
        // Ensure frame-aligned (multiple of BYTES_PER_FRAME)
        const maxLen = Math.min(combined.length, TARGET_BYTES);
        const alignedLen = Math.floor(maxLen / BYTES_PER_FRAME) * BYTES_PER_FRAME;
        const trimmed = combined.subarray(0, alignedLen);
        const wav = createWavBuffer(trimmed, SAMPLE_RATE, CHANNELS);
        const durationActual = trimmed.length / (SAMPLE_RATE * BYTES_PER_FRAME);
        console.log(`Lyria RealTime: Done — ${durationActual.toFixed(1)}s, ${(trimmed.length / 1024).toFixed(0)}KB`);
        resolve({ audioContent: wav.toString('base64'), mimeType: 'audio/wav' });
      } else {
        reject(new Error(`Music stream closed without producing audio (received ${messageCount} messages)`));
      }
    };

    console.log('Lyria RealTime: Calling client.live.music.connect()...');

    c.live.music.connect({
      model: 'models/lyria-realtime-exp',
      callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onmessage: (message: any) => {
          messageCount++;
          // Log first few messages for debugging
          if (messageCount <= 5) {
            const keys = Object.keys(message || {});
            console.log(`Lyria RealTime: Message #${messageCount} keys: [${keys.join(', ')}]`);
            // Log any error content
            if (message.error) {
              console.error('Lyria RealTime: Error in message:', JSON.stringify(message.error));
            }
            if (message.setupComplete) {
              console.log('Lyria RealTime: Setup complete received');
            }
            // Log serverContent structure
            if (message.serverContent) {
              const scKeys = Object.keys(message.serverContent);
              console.log(`Lyria RealTime: serverContent keys: [${scKeys.join(', ')}]`);
            }
          }

          if (resolved) return;
          if (message.serverContent?.audioChunks) {
            for (const chunk of message.serverContent.audioChunks) {
              const audioBuffer = Buffer.from(chunk.data, 'base64');
              audioChunks.push(audioBuffer);
              totalBytes += audioBuffer.length;

              // Log progress every ~5 seconds
              if (totalBytes % (SAMPLE_RATE * CHANNELS * 2 * 5) < audioBuffer.length) {
                const sec = totalBytes / (SAMPLE_RATE * CHANNELS * 2);
                console.log(`Lyria RealTime: ${sec.toFixed(1)}s collected...`);
              }

              if (totalBytes >= TARGET_BYTES) {
                finishWithAudio();
                return;
              }
            }
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onerror: (error: any) => {
          console.error('Lyria RealTime: onerror callback:', error);
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onclose: (event: any) => {
          console.log(`Lyria RealTime: onclose callback (${(totalBytes / 1024).toFixed(0)}KB, ${messageCount} msgs)`);
          if (event) {
            console.log('Lyria RealTime: Close event:', JSON.stringify(event).substring(0, 500));
          }
          if (!resolved) {
            finishWithAudio();
          }
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).then(async (s: any) => {
      session = s;
      console.log('Lyria RealTime: Connected! Setting prompts...');

      await session.setWeightedPrompts({
        weightedPrompts: [{ text: fullPrompt, weight: 1.0 }],
      });

      console.log('Lyria RealTime: Calling play()...');
      await session.play();
      console.log('Lyria RealTime: Streaming audio...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).catch((error: any) => {
      console.error('Lyria RealTime: Connection/setup error:', error);
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}
