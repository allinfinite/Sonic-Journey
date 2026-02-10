/**
 * API client for AI-powered journey generation
 */

import type { JourneyConfig } from '../types/journey';
import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl();

// Log API URL in development for debugging
if (import.meta.env.DEV) {
  console.log('API URL:', API_URL);
}

export interface GenerateJourneyRequest {
  prompt: string;
  duration: number; // in minutes
}

export interface GenerateJourneyResponse {
  success: boolean;
  journey: JourneyConfig;
  error?: string;
  message?: string;
}

/**
 * Check if the server is available
 */
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Generate a journey from a prompt using AI
 */
export async function generateJourney(
  prompt: string,
  duration: number
): Promise<JourneyConfig> {
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty');
  }

  if (duration < 5 || duration > 180) {
    throw new Error('Duration must be between 5 and 180 minutes');
  }

  // Check if server is available first (skip in production to avoid CORS issues)
  if (!import.meta.env.PROD) {
    const serverAvailable = await checkServerHealth();
    if (!serverAvailable) {
      throw new Error(
        'Server is not available. Please ensure the server is running on port 3002. ' +
        'Run "npm run dev:server" in a separate terminal.'
      );
    }
  }

  try {
    const response = await fetch(`${API_URL}/api/generate-journey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, duration }),
    }).catch((fetchError) => {
      // Handle network errors (including ERR_BLOCKED_BY_CLIENT)
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        throw new Error(
          'Failed to connect to server. Please ensure the server is running on port 3002. ' +
          'If you have a browser extension blocking requests, try disabling it or adding localhost to allowlist.'
        );
      }
      throw fetchError;
    });

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      
      // Provide helpful message for 404
      if (response.status === 404) {
        throw new Error(
          `API endpoint not found (404). The server may not be deployed or accessible at ${API_URL}. ` +
          `Please ensure the Node.js server is running and accessible. ` +
          `If the server is at a different URL, set VITE_API_URL environment variable during build.`
        );
      }
      
      throw new Error(errorMessage);
    }

    const result: GenerateJourneyResponse = await response.json();

    if (!result.success || !result.journey) {
      throw new Error(result.message || 'Failed to generate journey');
    }

    return result.journey;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate journey');
  }
}
