import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import db from '../database.js';
import { startEncodingJob, getVideoInfo, generateThumbnail } from '../services/encoder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Get JWT secret dynamically
const getJwtSecret = () => process.env.JWT_SECRET || 'anisuplayer_default_secret';

// Multer configuration for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'storage', 'videos', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = nanoid(10);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mkv|avi|mov|webm|m4v/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

// Auth middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.auth_token;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    jwt.verify(token, getJwtSecret());
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all videos
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const videos = db.prepare(`
      SELECT v.*, 
        (SELECT json_group_array(json_object(
          'id', vs.id,
          'resolution', vs.resolution,
          'url', vs.url,
          'is_local', vs.is_local,
          'file_size', vs.file_size
        )) FROM video_sources vs WHERE vs.video_id = v.id) as sources,
        (SELECT json_group_array(json_object(
          'id', s.id,
          'label', s.label,
          'language', s.language,
          'url', s.url,
          'is_default', s.is_default
        )) FROM subtitles s WHERE s.video_id = v.id) as subtitles
      FROM videos v
      ORDER BY v.created_at DESC
    `).all();

    const parsedVideos = videos.map((video: any) => ({
      ...video,
      sources: JSON.parse(video.sources || '[]'),
      subtitles: JSON.parse(video.subtitles || '[]')
    }));

    res.json(parsedVideos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get single video by ID (public)
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const video = db.prepare(`
      SELECT v.*, 
        (SELECT json_group_array(json_object(
          'id', vs.id,
          'resolution', vs.resolution,
          'url', vs.url,
          'is_local', vs.is_local,
          'file_size', vs.file_size
        )) FROM video_sources vs WHERE vs.video_id = v.id) as sources,
        (SELECT json_group_array(json_object(
          'id', s.id,
          'label', s.label,
          'language', s.language,
          'url', s.url,
          'is_default', s.is_default
        )) FROM subtitles s WHERE s.video_id = v.id) as subtitles
      FROM videos v
      WHERE v.id = ?
    `).get(id);

    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const parsedVideo = {
      ...video,
      sources: JSON.parse((video as any).sources || '[]'),
      subtitles: JSON.parse((video as any).subtitles || '[]')
    };

    res.json(parsedVideo);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Create video with links
router.post('/link', authMiddleware, (req: Request, res: Response) => {
  try {
    const { title, description, sources, subtitles, thumbnail } = req.body;

    if (!title || !sources || sources.length === 0) {
      res.status(400).json({ error: 'Title and at least one source are required' });
      return;
    }

    const videoId = nanoid(12);

    // Insert video
    db.prepare(`
      INSERT INTO videos (id, title, description, thumbnail)
      VALUES (?, ?, ?, ?)
    `).run(videoId, title, description || '', thumbnail || '');

    // Insert sources
    const insertSource = db.prepare(`
      INSERT INTO video_sources (video_id, resolution, url, is_local)
      VALUES (?, ?, ?, 0)
    `);

    for (const source of sources) {
      insertSource.run(videoId, source.resolution, source.url);
    }

    // Insert subtitles if provided
    if (subtitles && subtitles.length > 0) {
      const insertSubtitle = db.prepare(`
        INSERT INTO subtitles (video_id, label, language, url, is_default)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const subtitle of subtitles) {
        insertSubtitle.run(
          videoId,
          subtitle.label,
          subtitle.language,
          subtitle.url,
          subtitle.is_default ? 1 : 0
        );
      }
    }

    res.json({ success: true, videoId });
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

// Upload video file
router.post('/upload', authMiddleware, upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No video file uploaded' });
      return;
    }

    const { title, description, enableEncoding } = req.body;
    const shouldEncode = enableEncoding === 'true' || enableEncoding === true;
    
    console.log(`📤 Video upload received: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`📝 Title: ${title}, Enable Encoding: ${shouldEncode}`);

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const videoId = nanoid(12);
    const uploadedFilePath = req.file.path;

    // Insert video record
    db.prepare(`
      INSERT INTO videos (id, title, description)
      VALUES (?, ?, ?)
    `).run(videoId, title, description || '');

    if (shouldEncode) {
      // Start encoding job (existing behavior)
      try {
        console.log(`🎬 Starting encoding for video ${videoId}...`);
        const jobId = await startEncodingJob(videoId, uploadedFilePath);
        console.log(`✅ Encoding job ${jobId} started successfully for video ${videoId}`);

        res.json({
          success: true,
          videoId,
          jobId,
          message: 'Video uploaded and encoding started'
        });
      } catch (encodingError) {
        console.error('❌ Error starting encoding job:', encodingError);
        // Clean up video record if encoding fails
        db.prepare('DELETE FROM videos WHERE id = ?').run(videoId);
        if (fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }
        res.status(500).json({ 
          error: 'Failed to start encoding job', 
          details: encodingError instanceof Error ? encodingError.message : 'Unknown error'
        });
        return;
      }
    } else {
      // No encoding: save file directly and create single source
      try {
        // Get video info
        const videoInfo = await getVideoInfo(uploadedFilePath);

        // Update video duration
        db.prepare('UPDATE videos SET duration = ? WHERE id = ?').run(videoInfo.duration, videoId);

        // Generate thumbnail
        const thumbnailUrl = await generateThumbnail(uploadedFilePath, videoId);
        if (thumbnailUrl) {
          db.prepare('UPDATE videos SET thumbnail = ? WHERE id = ?').run(thumbnailUrl, videoId);
        }

        // Create video directory
        const videoDir = path.join(__dirname, '..', '..', 'storage', 'videos', videoId);
        if (!fs.existsSync(videoDir)) {
          fs.mkdirSync(videoDir, { recursive: true });
        }

        // Move file to video directory
        const ext = path.extname(req.file.originalname);
        const finalFileName = `original${ext}`;
        const finalFilePath = path.join(videoDir, finalFileName);
        fs.renameSync(uploadedFilePath, finalFilePath);

        // Determine resolution name from video height
        let resolutionName = 'original';
        if (videoInfo.height >= 2160) resolutionName = '2160p';
        else if (videoInfo.height >= 1440) resolutionName = '1440p';
        else if (videoInfo.height >= 1080) resolutionName = '1080p';
        else if (videoInfo.height >= 720) resolutionName = '720p';
        else if (videoInfo.height >= 480) resolutionName = '480p';
        else if (videoInfo.height >= 360) resolutionName = '360p';
        else if (videoInfo.height >= 240) resolutionName = '240p';
        else resolutionName = '144p';

        // Get file size
        const stats = fs.statSync(finalFilePath);
        const fileSize = stats.size;

        // Create video source entry
        const relativeUrl = `/storage/videos/${videoId}/${finalFileName}`;
        db.prepare(`
          INSERT INTO video_sources (video_id, resolution, url, is_local, file_size)
          VALUES (?, ?, ?, 1, ?)
        `).run(videoId, resolutionName, relativeUrl, fileSize);

        res.json({
          success: true,
          videoId,
          message: 'Video uploaded successfully without encoding'
        });
      } catch (error) {
        console.error('Error processing video without encoding:', error);
        // Clean up on error
        db.prepare('DELETE FROM videos WHERE id = ?').run(videoId);
        const videoDir = path.join(__dirname, '..', '..', 'storage', 'videos', videoId);
        if (fs.existsSync(videoDir)) {
          fs.rmSync(videoDir, { recursive: true, force: true });
        }
        if (fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Add subtitle to video (via URL)
router.post('/:id/subtitles', authMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { label, language, url, is_default } = req.body;

    if (!label || !language || !url) {
      res.status(400).json({ error: 'Label, language, and URL are required' });
      return;
    }

    db.prepare(`
      INSERT INTO subtitles (video_id, label, language, url, is_default)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, label, language, url, is_default ? 1 : 0);

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding subtitle:', error);
    res.status(500).json({ error: 'Failed to add subtitle' });
  }
});

// Subtitle file upload configuration
const subtitleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const videoId = req.params.id;
    const subtitleDir = path.join(__dirname, '..', '..', 'storage', 'subtitles', videoId);
    if (!fs.existsSync(subtitleDir)) {
      fs.mkdirSync(subtitleDir, { recursive: true });
    }
    cb(null, subtitleDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = nanoid(8);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  }
});

// Font file storage
const fontStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const videoId = req.params.id;
    const fontDir = path.join(__dirname, '..', '..', 'storage', 'fonts', videoId);
    if (!fs.existsSync(fontDir)) {
      fs.mkdirSync(fontDir, { recursive: true });
    }
    cb(null, fontDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = nanoid(8);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  }
});

const subtitleUpload = multer({
  storage: subtitleStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max for subtitles
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /vtt|srt|ass/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .vtt, .srt, and .ass files are allowed.'));
    }
  }
});

const fontUpload = multer({
  storage: fontStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max for fonts
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /ttf|otf|woff|woff2/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .ttf, .otf, .woff, and .woff2 files are allowed.'));
    }
  }
});

// Convert SRT to VTT
function convertSrtToVtt(srtContent: string): string {
  // Add WEBVTT header with styling to remove background
  let vttContent = 'WEBVTT\n';
  vttContent += 'STYLE\n';
  vttContent += '::cue {\n';
  vttContent += '  background: transparent;\n';
  vttContent += '  background-color: transparent;\n';
  vttContent += '  color: white;\n';
  vttContent += '  text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black, 0 0 6px black, 0 0 10px black;\n';
  vttContent += '  font-size: 1.15em;\n';
  vttContent += '  font-weight: 500;\n';
  vttContent += '  line-height: 1.5;\n';
  vttContent += '}\n\n';
  
  // Replace commas with dots in timestamps
  const converted = srtContent
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    // Remove sequence numbers (lines with just numbers)
    .replace(/^\d+\s*$/gm, '')
    // Clean up extra newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  vttContent += converted;
  return vttContent;
}

// Convert ASS to VTT (improved conversion)
function convertAssToVtt(assContent: string): string {
  // Add VTT header with styling to remove background and use MADE TOMMY font
  let vttContent = 'WEBVTT\n';
  vttContent += 'STYLE\n';
  vttContent += '::cue {\n';
  vttContent += '  background: transparent;\n';
  vttContent += '  background-color: transparent;\n';
  vttContent += '  color: white;\n';
  vttContent += '  text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black, 0 0 6px black, 0 0 10px black;\n';
  vttContent += '  font-size: 1.15em;\n';
  vttContent += '  font-weight: bold;\n';
  vttContent += '  font-family: "MADE TOMMY", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;\n';
  vttContent += '  line-height: 1.5;\n';
  vttContent += '}\n\n';
  
  // Find the [Events] section
  const eventsMatch = assContent.match(/\[Events\][\s\S]*$/i);
  if (!eventsMatch) return vttContent;
  
  const eventsSection = eventsMatch[0];
  const lines = eventsSection.split(/\r?\n/);
  
  // Find format line to get column positions
  let formatLine = lines.find(l => l.trim().startsWith('Format:'));
  if (!formatLine) {
    // Default ASS format if no Format line found
    formatLine = 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text';
  }
  
  const columns = formatLine.replace(/^Format:\s*/i, '').split(',').map(c => c.trim().toLowerCase());
  const startIdx = columns.indexOf('start');
  const endIdx = columns.indexOf('end');
  const textIdx = columns.indexOf('text');
  
  // If format parsing fails, use default positions (ASS standard: Layer=0, Start=1, End=2, Text=9)
  const defaultStartIdx = startIdx >= 0 ? startIdx : 1;
  const defaultEndIdx = endIdx >= 0 ? endIdx : 2;
  const defaultTextIdx = textIdx >= 0 ? textIdx : 9;
  
  // Process dialogue lines
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine.toLowerCase().startsWith('dialogue:')) continue;
    
    // Remove "Dialogue:" prefix (case insensitive)
    const content = trimmedLine.replace(/^dialogue:\s*/i, '').trim();
    if (!content) continue;
    
    // Split by comma, but be careful with text field which may contain commas
    const parts: string[] = [];
    let currentPart = '';
    let inQuotes = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        currentPart += char;
      } else if (char === ',' && !inQuotes) {
        parts.push(currentPart.trim());
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    if (currentPart) {
      parts.push(currentPart.trim());
    }
    
    if (parts.length <= Math.max(defaultStartIdx, defaultEndIdx, defaultTextIdx)) continue;
    
    // Get start and end times
    const start = parts[defaultStartIdx]?.trim() || '';
    const end = parts[defaultEndIdx]?.trim() || '';
    
    if (!start || !end) continue;
    
    // Get text (everything from textIdx onwards, joined back since text might contain commas)
    const textParts = parts.slice(defaultTextIdx);
    let text = textParts.join(',').trim();
    
    if (!text) continue;
    
    // Remove ASS formatting tags but preserve some basic formatting
    text = text
      // Remove ASS tags like {\an8}, {\pos(x,y)}, etc but keep \N for newlines
      .replace(/\{[^}]*\}/g, '')
      // Convert \N to newlines
      .replace(/\\N/gi, '\n')
      // Convert \n to newlines
      .replace(/\\n/gi, '\n')
      // Remove quotes if present
      .replace(/^["']|["']$/g, '')
      .trim();
    
    if (!text) continue;
    
    // Convert time format (h:mm:ss.cc or h:mm:ss:cc to hh:mm:ss.mmm)
    const convertTime = (t: string) => {
      // ASS format can be: h:mm:ss:cc or h:mm:ss.cc
      let match = t.match(/(\d+):(\d{2}):(\d{2}):(\d{2})/); // h:mm:ss:cc
      if (match) {
        const [, h, m, s, cs] = match;
        return `${h.padStart(2, '0')}:${m}:${s}.${cs}0`;
      }
      
      match = t.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/); // h:mm:ss.cc
      if (match) {
        const [, h, m, s, cs] = match;
        return `${h.padStart(2, '0')}:${m}:${s}.${cs}0`;
      }
      
      // If no match, try to return as is (might already be in correct format)
      return t;
    };
    
    const startTime = convertTime(start);
    const endTime = convertTime(end);
    
    vttContent += `${startTime} --> ${endTime}\n${text}\n\n`;
  }
  
  return vttContent;
}

// Upload subtitle file with optional font
router.post('/:id/subtitles/upload', authMiddleware, (req: Request, res: Response, next: any) => {
  const videoId = req.params.id;
  
  // Use multer fields to handle both subtitle and font
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        if (file.fieldname === 'subtitle') {
          const subtitleDir = path.join(__dirname, '..', '..', 'storage', 'subtitles', videoId);
          if (!fs.existsSync(subtitleDir)) {
            fs.mkdirSync(subtitleDir, { recursive: true });
          }
          cb(null, subtitleDir);
        } else if (file.fieldname === 'font') {
          const fontDir = path.join(__dirname, '..', '..', 'storage', 'fonts', videoId);
          if (!fs.existsSync(fontDir)) {
            fs.mkdirSync(fontDir, { recursive: true });
          }
          cb(null, fontDir);
        } else {
          cb(new Error('Invalid field name'));
        }
      },
      filename: (req, file, cb) => {
        const uniqueId = nanoid(8);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uniqueId}${ext}`);
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
      if (file.fieldname === 'subtitle') {
        const allowedTypes = /vtt|srt|ass/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (allowedTypes.test(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid subtitle file type. Only .vtt, .srt, and .ass files are allowed.'));
        }
      } else if (file.fieldname === 'font') {
        const allowedTypes = /ttf|otf|woff|woff2/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (allowedTypes.test(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid font file type. Only .ttf, .otf, .woff, and .woff2 files are allowed.'));
        }
      } else {
        cb(new Error('Invalid field name'));
      }
    }
  }).fields([
    { name: 'subtitle', maxCount: 1 },
    { name: 'font', maxCount: 1 }
  ]);
  
  upload(req, res, next);
}, async (req: Request, res: Response) => {
  try {
    const files = (req as any).files;
    const subtitleFile = files?.subtitle?.[0];
    const fontFile = files?.font?.[0];
    
    if (!subtitleFile) {
      res.status(400).json({ error: 'No subtitle file uploaded' });
      return;
    }

    const { id } = req.params;
    const { label, language, is_default } = req.body;
    
    // Get file extension
    const ext = path.extname(subtitleFile.originalname).toLowerCase();
    
    // Check if ASS file requires font
    if (ext === '.ass' && !fontFile) {
      // Delete uploaded subtitle file
      fs.unlinkSync(subtitleFile.path);
      res.status(400).json({ error: 'ASS subtitle files require a font file. Please upload a font file (.ttf, .otf, .woff, or .woff2)' });
      return;
    }

    if (!label || !language) {
      // Delete uploaded files
      if (subtitleFile) fs.unlinkSync(subtitleFile.path);
      if (fontFile) fs.unlinkSync(fontFile.path);
      res.status(400).json({ error: 'Label and language are required' });
      return;
    }

    // Check if video exists
    const video = db.prepare('SELECT id FROM videos WHERE id = ?').get(id);
    if (!video) {
      if (subtitleFile) fs.unlinkSync(subtitleFile.path);
      if (fontFile) fs.unlinkSync(fontFile.path);
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    let finalPath = subtitleFile.path;
    
    // For SRT files: Convert to VTT for browser support
    // For ASS files: Keep original AND create VTT fallback
    if (ext === '.srt') {
      // Read file with UTF-8 encoding, handling BOM if present
      let content = fs.readFileSync(subtitleFile.path, 'utf-8');
      // Remove BOM if present
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      
      const vttContent = convertSrtToVtt(content);
      
      // Save as VTT
      const vttPath = subtitleFile.path.replace(/\.srt$/i, '.vtt');
      fs.writeFileSync(vttPath, vttContent, { encoding: 'utf-8' });
      
      // Delete original SRT file
      if (fs.existsSync(subtitleFile.path)) {
        fs.unlinkSync(subtitleFile.path);
      }
      finalPath = vttPath;
    } else if (ext === '.ass') {
      // Read ASS file content
      let content = fs.readFileSync(subtitleFile.path, 'utf-8');
      // Remove BOM if present
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
        fs.writeFileSync(subtitleFile.path, content, { encoding: 'utf-8' });
      }
      
      // Store font file path if provided
      if (fontFile) {
        const fontRelativePath = fontFile.path.replace(path.join(__dirname, '..', '..'), '').replace(/\\/g, '/');
        // Store font path in subtitle metadata (we can add a fonts table later if needed)
        console.log(`Font file saved for ASS subtitle: ${fontRelativePath}`);
      }
      
      // Also create a VTT version for fallback (browsers that don't support ASS)
      const vttContent = convertAssToVtt(content);
      const vttPath = subtitleFile.path.replace(/\.ass$/i, '.vtt');
      fs.writeFileSync(vttPath, vttContent, { encoding: 'utf-8' });
      
      // Keep the ASS file path as the main path (for ASS-aware players)
      // The VTT is available as a fallback at the same location with .vtt extension
      // finalPath remains the same (original .ass file)
    }

    // Get relative URL
    const relativePath = finalPath.replace(path.join(__dirname, '..', '..'), '').replace(/\\/g, '/');

    // If is_default is true, unset other defaults
    if (is_default === 'true') {
      db.prepare('UPDATE subtitles SET is_default = 0 WHERE video_id = ?').run(id);
    }

    // Insert subtitle record
    const result = db.prepare(`
      INSERT INTO subtitles (video_id, label, language, url, is_default)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, label, language, relativePath, is_default === 'true' ? 1 : 0);

    res.json({ 
      success: true, 
      subtitleId: result.lastInsertRowid,
      url: relativePath
    });
  } catch (error) {
    console.error('Error uploading subtitle:', error);
    res.status(500).json({ error: 'Failed to upload subtitle' });
  }
});

// Delete subtitle
router.delete('/:id/subtitles/:subtitleId', authMiddleware, (req: Request, res: Response) => {
  try {
    const { id, subtitleId } = req.params;

    // Get subtitle info
    const subtitle = db.prepare('SELECT url FROM subtitles WHERE id = ? AND video_id = ?').get(subtitleId, id) as any;
    
    if (!subtitle) {
      res.status(404).json({ error: 'Subtitle not found' });
      return;
    }

    // Delete file if it's a local file
    if (subtitle.url.startsWith('/storage/')) {
      const filePath = path.join(__dirname, '..', '..', subtitle.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete from database
    db.prepare('DELETE FROM subtitles WHERE id = ?').run(subtitleId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subtitle:', error);
    res.status(500).json({ error: 'Failed to delete subtitle' });
  }
});

// Set default subtitle
router.put('/:id/subtitles/:subtitleId/default', authMiddleware, (req: Request, res: Response) => {
  try {
    const { id, subtitleId } = req.params;

    // Unset all defaults for this video
    db.prepare('UPDATE subtitles SET is_default = 0 WHERE video_id = ?').run(id);

    // Set the new default
    db.prepare('UPDATE subtitles SET is_default = 1 WHERE id = ? AND video_id = ?').run(subtitleId, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting default subtitle:', error);
    res.status(500).json({ error: 'Failed to set default subtitle' });
  }
});

// Delete video and all associated files
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete the entire video folder if it exists
    const videoDir = path.join(__dirname, '..', '..', 'storage', 'videos', id);
    if (fs.existsSync(videoDir)) {
      fs.rmSync(videoDir, { recursive: true, force: true });
      console.log(`Deleted video folder: ${videoDir}`);
    }

    // Delete thumbnail if exists
    const thumbnailPath = path.join(__dirname, '..', '..', 'storage', 'thumbnails', `${id}.jpg`);
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
      console.log(`Deleted thumbnail: ${thumbnailPath}`);
    }

    // Delete from database (cascading will handle related records)
    db.prepare('DELETE FROM video_sources WHERE video_id = ?').run(id);
    db.prepare('DELETE FROM subtitles WHERE video_id = ?').run(id);
    db.prepare('DELETE FROM encoding_jobs WHERE video_id = ?').run(id);
    db.prepare('DELETE FROM videos WHERE id = ?').run(id);

    res.json({ success: true, message: 'Video and all files deleted' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Update video
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, thumbnail } = req.body;

    db.prepare(`
      UPDATE videos 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          thumbnail = COALESCE(?, thumbnail),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, thumbnail, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

export default router;

