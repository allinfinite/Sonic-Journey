/**
 * Vercel serverless function for journey generation
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateJourney } from '../server/journeyGenerator';

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

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'OPENAI_API_KEY environment variable is not set. Please configure it in Vercel project settings.',
    });
  }

  const { prompt, duration } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!duration || typeof duration !== 'number' || duration < 5 || duration > 180) {
    return res.status(400).json({ error: 'Duration must be between 5 and 180 minutes' });
  }

  console.log(`Generating journey: "${prompt}" (${duration} minutes)`);

  try {
    const journey = await generateJourney({ prompt, duration });
    
    console.log(`Journey generated: ${journey.name} with ${journey.phases.length} phases`);
    
    return res.json({
      success: true,
      journey,
    });
  } catch (error) {
    console.error('Journey generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error for debugging
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name,
    });
    
    return res.status(500).json({
      error: 'Journey generation failed',
      message: errorMessage,
      // Include stack in development/debugging
      ...(process.env.VERCEL_ENV !== 'production' && errorStack ? { stack: errorStack } : {}),
    });
  }
}
