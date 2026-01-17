/**
 * API client for AI-powered journey generation
 */

import type { JourneyConfig } from '../types/journey';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  try {
    const response = await fetch(`${API_URL}/api/generate-journey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, duration }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Server error: ${response.status}`);
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
