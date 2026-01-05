import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';

const JWT_SECRET = process.env.JWT_SECRET || 'anisuplayer_default_secret';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = value;
    }
  });
  
  return cookies;
}

function verifyAuth(req: VercelRequest): boolean {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.auth_token;
  
  if (!token) return false;
  
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check auth for protected routes
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      // Get all videos from KV store
      const videoIds = await kv.smembers('videos') || [];
      const videos = [];
      
      for (const id of videoIds) {
        const video = await kv.hgetall(`video:${id}`);
        if (video) {
          const sources = await kv.lrange(`video:${id}:sources`, 0, -1) || [];
          const subtitles = await kv.lrange(`video:${id}:subtitles`, 0, -1) || [];
          videos.push({
            ...video,
            sources: sources.map(s => JSON.parse(s as string)),
            subtitles: subtitles.map(s => JSON.parse(s as string))
          });
        }
      }
      
      return res.status(200).json(videos);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Videos error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

