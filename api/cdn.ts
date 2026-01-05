import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract video ID from path
    const path = req.url?.split('?')[0] || '';
    const id = path.split('/').filter(Boolean).pop();

    if (!id) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    const video = await kv.hgetall(`video:${id}`);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const sources = await kv.lrange(`video:${id}:sources`, 0, -1) || [];
    const subtitles = await kv.lrange(`video:${id}:subtitles`, 0, -1) || [];

    return res.status(200).json({
      ...video,
      sources: sources.map(s => JSON.parse(s as string)),
      subtitles: subtitles.map(s => JSON.parse(s as string))
    });
  } catch (error) {
    console.error('CDN error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

