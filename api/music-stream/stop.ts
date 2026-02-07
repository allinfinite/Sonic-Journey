/**
 * Vercel serverless function for stopping the music stream
 *
 * NOTE: Vercel serverless functions are stateless -- there is no persistent
 * in-memory Lyria session to close here. The client closing its EventSource
 * connection triggers the `req.on('close')` handler in the SSE function,
 * which cleans up the Lyria session. This endpoint returns success so the
 * client does not see errors.
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

  console.log('Music stream stop requested (serverless mode -- client disconnect handles cleanup)');

  return res.json({ success: true });
}
