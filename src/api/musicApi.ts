/**
 * API client for AI-powered music generation via Google Lyria 2
 */

// Reuse the same API URL detection logic
function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    return (window as any).__API_URL__;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3002';
}

const API_URL = getApiUrl();

export interface GenerateMusicResponse {
  success: boolean;
  audioContent: string; // base64-encoded WAV
  mimeType: string;
  error?: string;
  message?: string;
}

/**
 * Generate music using Google Lyria 2 via the server
 */
export async function generateMusic(
  prompt: string,
  negativePrompt?: string
): Promise<GenerateMusicResponse> {
  if (!prompt.trim()) {
    throw new Error('Music prompt cannot be empty');
  }

  try {
    const response = await fetch(`${API_URL}/api/generate-music`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, negativePrompt }),
    });

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result: GenerateMusicResponse = await response.json();

    if (!result.success || !result.audioContent) {
      throw new Error(result.message || 'Failed to generate music');
    }

    return result;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to generate music');
  }
}
