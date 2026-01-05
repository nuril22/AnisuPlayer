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

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      // Public access for viewing videos
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
    }

    // Protected routes
    if (!verifyAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'PUT') {
      const { title, description, thumbnail } = req.body;
      const now = new Date().toISOString();

      const updates: Record<string, string> = { updated_at: now };
      if (title) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (thumbnail !== undefined) updates.thumbnail = thumbnail;

      await kv.hset(`video:${id}`, updates);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      await kv.del(`video:${id}`);
      await kv.del(`video:${id}:sources`);
      await kv.del(`video:${id}:subtitles`);
      await kv.srem('videos', id as string);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Video error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

