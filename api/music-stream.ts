/**
 * Vercel serverless function for music streaming via SSE
 * Uses Google Lyria RealTime to stream continuous AI-generated music
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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

  const prompt = req.query.prompt as string;
  const vocalization = req.query.vocalization === 'true';

  if (!prompt) {
    return res.status(400).json({ error: 'prompt query parameter is required' });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_AI_API_KEY is not set');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'GOOGLE_AI_API_KEY environment variable is not set.',
    });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  console.log(`Music stream started: "${prompt.substring(0, 80)}"${vocalization ? ' [vocalization]' : ''}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (session) {
      try { session.close(); } catch { /* ignore */ }
      session = null;
    }
  };

  // Clean up when client disconnects
  req.on('close', () => {
    console.log('Music stream: client disconnected');
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
                res.write(`data: ${JSON.stringify({ audio: chunk.data })}\n\n`);
              }
            }
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onerror: (error: any) => {
          console.error('Music stream error:', error);
          if (!closed && !res.writableEnded) {
            const msg = error instanceof Error ? error.message : String(error);
            res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
            res.end();
          }
          cleanup();
        },
        onclose: () => {
          console.log('Music stream: Lyria session closed');
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
  } catch (error) {
    console.error('Music stream: Failed to start:', error);
    if (!res.writableEnded) {
      const msg = error instanceof Error ? error.message : 'Failed to start music stream';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
    cleanup();
  }
}
