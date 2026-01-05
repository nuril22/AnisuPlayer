import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables FIRST before importing anything else
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Now import the rest after env is loaded
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import { initializeDatabase } from './database.js';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import cdnRoutes from './routes/cdn.js';
import encodingRoutes from './routes/encoding.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Log env for debugging
console.log('🔐 Auth configured:', {
  username: process.env.ADMIN_USERNAME,
  passwordSet: !!process.env.ADMIN_PASSWORD,
  jwtSet: !!process.env.JWT_SECRET
});

// Ensure storage directories exist
const storageDir = path.join(__dirname, '..', 'storage');
const videosDir = path.join(storageDir, 'videos');
const thumbnailsDir = path.join(storageDir, 'thumbnails');
const subtitlesDir = path.join(storageDir, 'subtitles');

[storageDir, videosDir, thumbnailsDir, subtitlesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize database
initializeDatabase();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve static files from storage with proper MIME types
app.use('/storage', express.static(path.join(__dirname, '..', 'storage'), {
  setHeaders: (res, filePath) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Set proper Content-Type for various files
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
    } else if (filePath.endsWith('.mp4') || filePath.endsWith('.m4v')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
    } else if (filePath.endsWith('.mkv')) {
      res.setHeader('Content-Type', 'video/x-matroska');
    } else if (filePath.endsWith('.avi')) {
      res.setHeader('Content-Type', 'video/x-msvideo');
    } else if (filePath.endsWith('.mov')) {
      res.setHeader('Content-Type', 'video/quicktime');
    } else if (filePath.endsWith('.vtt')) {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    } else if (filePath.endsWith('.srt')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    } else if (filePath.endsWith('.ass')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/encoding', encodingRoutes);
app.use('/cdn', cdnRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AnisuPlayer API is running' });
});

app.listen(PORT, () => {
  console.log(`🎬 AnisuPlayer Server running on http://localhost:${PORT}`);
});

export default app;
