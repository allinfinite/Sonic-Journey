/**
 * Vercel serverless function for updating music stream prompt
 *
 * NOTE: Vercel serverless functions are stateless -- there is no persistent
 * in-memory session shared between the SSE streaming function and this one.
 * The client-side MusicLayer handles prompt changes by closing the current
 * EventSource and reconnecting with the new prompt, so this endpoint simply
 * returns success. When running against the Express dev server (via Vite proxy),
 * the Express route handles real in-memory session updates instead.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
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

  const { prompt: rawPrompt } = req.body || {};
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const prompt = rawPrompt.trim();
  if (prompt.length < 2) {
    return res.status(400).json({ error: 'Prompt too short — minimum 2 characters' });
  }
  if (prompt.length > 1000) {
    return res.status(400).json({ error: `Prompt too long — maximum 1000 characters (received ${prompt.length})` });
  }

  console.log(
    `Music stream prompt update requested (serverless mode -- client will reconnect): "${prompt.substring(0, 80)}"`
  );

  return res.json({
    success: true,
    note: 'Serverless mode: prompt updates are handled by client reconnection.',
  });
}
