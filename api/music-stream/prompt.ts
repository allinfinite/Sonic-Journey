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

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  console.log(
    `Music stream prompt update requested (serverless mode -- client will reconnect): "${prompt.substring(0, 80)}"`
  );

  return res.json({
    success: true,
    note: 'Serverless mode: prompt updates are handled by client reconnection.',
  });
}
