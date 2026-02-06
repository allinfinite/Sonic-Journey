/**
 * Music Streamer - Manages Lyria RealTime sessions for continuous music streaming
 * Maintains a single active session that streams audio via SSE
 */

import { GoogleGenAI } from '@google/genai';

let genai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genai) {
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

export interface MusicSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  onChunk: ((base64Pcm: string) => void) | null;
  onError: ((error: Error) => void) | null;
  onClose: (() => void) | null;
  active: boolean;
}

let activeSession: MusicSession | null = null;

/**
 * Start a new music streaming session
 */
export async function startMusicSession(
  prompt: string,
  onChunk: (base64Pcm: string) => void,
  onError: (error: Error) => void,
  onClose: () => void,
  vocalization: boolean = false,
): Promise<void> {
  // Close any existing session
  await stopMusicSession();

  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;

  if (!c.live?.music?.connect) {
    throw new Error('Lyria RealTime API not available');
  }

  console.log('MusicStreamer: Starting session...');
  console.log(`MusicStreamer: Prompt: "${prompt.substring(0, 100)}" (vocalization: ${vocalization})`);

  const sessionObj: MusicSession = {
    session: null,
    onChunk,
    onError,
    onClose,
    active: true,
  };

  activeSession = sessionObj;

  try {
    const session = await c.live.music.connect({
      model: 'models/lyria-realtime-exp',
      callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onmessage: (message: any) => {
          if (!sessionObj.active) return;
          if (message.serverContent?.audioChunks) {
            for (const chunk of message.serverContent.audioChunks) {
              sessionObj.onChunk?.(chunk.data);
            }
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onerror: (error: any) => {
          console.error('MusicStreamer: Stream error:', error);
          if (sessionObj.active) {
            sessionObj.active = false;
            sessionObj.onError?.(error instanceof Error ? error : new Error(String(error)));
          }
        },
        onclose: () => {
          console.log('MusicStreamer: Stream closed');
          if (sessionObj.active) {
            sessionObj.active = false;
            sessionObj.onClose?.();
          }
        },
      },
    });

    sessionObj.session = session;

    await session.setWeightedPrompts({
      weightedPrompts: [{ text: prompt, weight: 1.0 }],
    });

    if (vocalization) {
      await session.setMusicGenerationConfig({
        musicGenerationConfig: { musicGenerationMode: 'VOCALIZATION' },
      });
      console.log('MusicStreamer: Vocalization mode enabled');
    }

    await session.play();
    console.log('MusicStreamer: Streaming audio...');
  } catch (error) {
    console.error('MusicStreamer: Failed to start:', error);
    sessionObj.active = false;
    activeSession = null;
    throw error;
  }
}

/**
 * Update the prompt and/or vocalization mode on the active session
 */
export async function updateMusicPrompt(prompt: string, vocalization?: boolean): Promise<void> {
  if (!activeSession?.active || !activeSession.session) {
    throw new Error('No active music session');
  }

  console.log(`MusicStreamer: Updating prompt: "${prompt.substring(0, 100)}"${vocalization !== undefined ? ` (vocalization: ${vocalization})` : ''}`);

  await activeSession.session.setWeightedPrompts({
    weightedPrompts: [{ text: prompt, weight: 1.0 }],
  });

  if (vocalization !== undefined) {
    await activeSession.session.setMusicGenerationConfig({
      musicGenerationConfig: {
        musicGenerationMode: vocalization ? 'VOCALIZATION' : 'QUALITY',
      },
    });
  }
}

/**
 * Stop the active music session
 */
export async function stopMusicSession(): Promise<void> {
  if (activeSession) {
    activeSession.active = false;
    if (activeSession.session) {
      try {
        activeSession.session.close();
      } catch { /* ignore */ }
    }
    activeSession = null;
    console.log('MusicStreamer: Session stopped');
  }
}

/**
 * Check if there's an active session
 */
export function hasActiveSession(): boolean {
  return activeSession?.active === true;
}
