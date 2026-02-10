/**
 * Vercel serverless function for music streaming via SSE
 * Uses Google Lyria RealTime to stream continuous AI-generated music
 *
 * Key design for Vercel:
 * - Proactively closes at ~55s (before Vercel's 60s limit) with a `done` event
 * - Client-side MusicLayer auto-reconnects after `done`, creating a new invocation
 * - Each invocation is stateless — creates a fresh Lyria session
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// Close 5s before Vercel timeout to ensure clean shutdown
const MAX_STREAM_DURATION_MS = 55000;

// Prompt validation limits — URL query params are subject to browser/proxy URL length limits
const MIN_PROMPT_LENGTH = 2;
const MAX_PROMPT_LENGTH = 1000; // Conservative limit for URL query parameter safety

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const prompt = (req.query.prompt as string || '').trim();
  const vocalization = req.query.vocalization === 'true';

  if (!prompt) {
    return res.status(400).json({ error: 'prompt query parameter is required' });
  }

  if (prompt.length < MIN_PROMPT_LENGTH) {
    return res.status(400).json({
      error: `Prompt too short — minimum ${MIN_PROMPT_LENGTH} characters`,
      minLength: MIN_PROMPT_LENGTH,
    });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      error: `Prompt too long — maximum ${MAX_PROMPT_LENGTH} characters (received ${prompt.length}). URL query parameters have strict length limits.`,
      maxLength: MAX_PROMPT_LENGTH,
      receivedLength: prompt.length,
    });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_AI_API_KEY is not set');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'GOOGLE_AI_API_KEY environment variable is not set.',
    });
  }

  // Set up SSE headers — including anti-buffering for proxies
  // Note: Access-Control-Allow-Origin is already set via setHeader above;
  // do NOT duplicate it here or browsers will reject the response.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send an initial comment to confirm SSE connection is alive
  res.write(': connected\n\n');

  console.log(`Music stream started: "${prompt.substring(0, 80)}"${vocalization ? ' [vocalization]' : ''}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null;
  let closed = false;
  let chunkCount = 0;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (session) {
      try { session.close(); } catch { /* ignore */ }
      session = null;
    }
  };

  // Proactive timeout: close cleanly before Vercel kills the function
  const streamTimeout = setTimeout(() => {
    if (closed || res.writableEnded) return;
    console.log(`Music stream: Proactive timeout at ${MAX_STREAM_DURATION_MS}ms (${chunkCount} chunks sent)`);
    res.write(`data: ${JSON.stringify({ done: true, reason: 'timeout' })}\n\n`);
    res.end();
    cleanup();
  }, MAX_STREAM_DURATION_MS);

  // Clean up when client disconnects
  req.on('close', () => {
    console.log(`Music stream: client disconnected (${chunkCount} chunks sent)`);
    clearTimeout(streamTimeout);
    cleanup();
  });

  try {
    const genai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = genai as any;

    if (!client.live?.music?.connect) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: 'Lyria RealTime API not available' })}\n\n`);
        res.end();
      }
      clearTimeout(streamTimeout);
      return;
    }

    session = await client.live.music.connect({
      model: 'models/lyria-realtime-exp',
      callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onmessage: (message: any) => {
          if (closed || res.writableEnded) return;
          if (message.serverContent?.audioChunks) {
            for (const chunk of message.serverContent.audioChunks) {
              if (!closed && !res.writableEnded) {
                chunkCount++;
                res.write(`data: ${JSON.stringify({ audio: chunk.data })}\n\n`);
              }
            }
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onerror: (error: any) => {
          console.error('Music stream error:', error);
          clearTimeout(streamTimeout);
          if (!closed && !res.writableEnded) {
            const msg = error instanceof Error ? error.message : String(error);
            res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
            res.end();
          }
          cleanup();
        },
        onclose: () => {
          console.log(`Music stream: Lyria session closed (${chunkCount} chunks sent)`);
          clearTimeout(streamTimeout);
          if (!closed && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
          }
          cleanup();
        },
      },
    });

    await session.setWeightedPrompts({
      weightedPrompts: [{ text: prompt, weight: 1.0 }],
    });

    if (vocalization) {
      await session.setMusicGenerationConfig({
        musicGenerationConfig: { musicGenerationMode: 'VOCALIZATION' },
      });
      console.log('Music stream: Vocalization mode enabled');
    }

    await session.play();
    console.log('Music stream: Streaming audio...');

    // CRITICAL: Keep the function alive while the SSE stream is open.
    // Without this, the Vercel serverless function returns after play(),
    // and the execution context gets frozen — killing the onmessage callbacks.
    // We block here until the stream is closed (by timeout, error, or client disconnect).
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (closed || res.writableEnded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);

      // Also resolve on client disconnect
      req.on('close', () => {
        clearInterval(checkInterval);
        resolve();
      });
    });
  } catch (error) {
    console.error('Music stream: Failed to start:', error);
    clearTimeout(streamTimeout);
    if (!res.writableEnded) {
      const msg = error instanceof Error ? error.message : 'Failed to start music stream';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
    cleanup();
  }
}
