/**
 * Vercel serverless function for one-shot music generation via Lyria RealTime
 * Connects to Google Lyria RealTime, streams ~15s of audio, returns as base64 WAV
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_AI_API_KEY is not set');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'GOOGLE_AI_API_KEY environment variable is not set.',
    });
  }

  const { prompt: rawPrompt, negativePrompt } = req.body || {};
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const prompt = rawPrompt.trim();
  if (prompt.length < 2) {
    return res.status(400).json({ error: 'Prompt too short — minimum 2 characters' });
  }
  if (prompt.length > 2000) {
    return res.status(400).json({ error: `Prompt too long — maximum 2000 characters (received ${prompt.length})` });
  }

  const DURATION_SECONDS = 15;
  const SAMPLE_RATE = 48000;
  const CHANNELS = 2;
  const BYTES_PER_FRAME = CHANNELS * 2; // 4 bytes per stereo 16-bit frame
  const TARGET_BYTES = DURATION_SECONDS * SAMPLE_RATE * BYTES_PER_FRAME;
  // Vercel serverless functions have a max execution time — finish before it
  const TIMEOUT_MS = 55000;

  const fullPrompt = negativePrompt
    ? `${prompt}. Avoid: ${negativePrompt}`
    : prompt;

  console.log(`Lyria RealTime: Generating ~${DURATION_SECONDS}s of music...`);
  console.log(`Lyria RealTime: Prompt: "${fullPrompt.substring(0, 100)}"`);

  try {
    const genai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = genai as any;

    if (!client.live?.music?.connect) {
      return res.status(500).json({
        error: 'Lyria RealTime API not available',
        message: 'client.live.music.connect is not available — @google/genai version may be too old',
      });
    }

    const result = await new Promise<{ audioContent: string; mimeType: string }>((resolve, reject) => {
      const audioChunks: Buffer[] = [];
      let totalBytes = 0;
      let resolved = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let session: any = null;
      let messageCount = 0;

      const cleanup = () => {
        if (session) {
          try { session.close(); } catch { /* ignore */ }
          session = null;
        }
      };

      const finishWithAudio = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        cleanup();

        if (totalBytes > 0) {
          const combined = Buffer.concat(audioChunks);
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

      const timeout = setTimeout(() => {
        if (resolved) return;
        console.log(`Lyria RealTime: Timeout at ${TIMEOUT_MS}ms`);
        // If we have any audio, return what we have
        if (totalBytes > 0) {
          finishWithAudio();
        } else {
          resolved = true;
          cleanup();
          reject(new Error(`Music generation timed out with no audio data (received ${messageCount} messages)`));
        }
      }, TIMEOUT_MS);

      client.live.music.connect({
        model: 'models/lyria-realtime-exp',
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onmessage: (message: any) => {
            messageCount++;
            if (messageCount <= 3) {
              const keys = Object.keys(message || {});
              console.log(`Lyria RealTime: Message #${messageCount} keys: [${keys.join(', ')}]`);
            }

            if (resolved) return;
            if (message.serverContent?.audioChunks) {
              for (const chunk of message.serverContent.audioChunks) {
                const audioBuffer = Buffer.from(chunk.data, 'base64');
                audioChunks.push(audioBuffer);
                totalBytes += audioBuffer.length;

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
          onclose: () => {
            console.log(`Lyria RealTime: onclose (${(totalBytes / 1024).toFixed(0)}KB, ${messageCount} msgs)`);
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

    return res.json({
      success: true,
      audioContent: result.audioContent,
      mimeType: result.mimeType,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Music generation error:', errorMessage);
    return res.status(500).json({
      error: 'Music generation failed',
      message: errorMessage,
    });
  }
}
