import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { title, description, sources, subtitles, thumbnail } = req.body;

    if (!title || !sources || sources.length === 0) {
      return res.status(400).json({ error: 'Title and at least one source are required' });
    }

    const videoId = nanoid(12);
    const now = new Date().toISOString();

    // Store video metadata
    await kv.hset(`video:${videoId}`, {
      id: videoId,
      title,
      description: description || '',
      thumbnail: thumbnail || '',
      created_at: now,
      updated_at: now
    });

    // Store sources
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      await kv.rpush(`video:${videoId}:sources`, JSON.stringify({
        id: i + 1,
        resolution: source.resolution,
        url: source.url,
        is_local: false
      }));
    }

    // Store subtitles
    if (subtitles && subtitles.length > 0) {
      for (let i = 0; i < subtitles.length; i++) {
        const subtitle = subtitles[i];
        await kv.rpush(`video:${videoId}:subtitles`, JSON.stringify({
          id: i + 1,
          label: subtitle.label,
          language: subtitle.language,
          url: subtitle.url,
          is_default: subtitle.is_default || false
        }));
      }
    }

    // Add to videos set
    await kv.sadd('videos', videoId);

    return res.status(200).json({ success: true, videoId });
  } catch (error) {
    console.error('Create video error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

