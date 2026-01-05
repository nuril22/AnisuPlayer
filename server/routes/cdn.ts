import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Serve video player page data
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

// Stream video file (MP4)
router.get('/:id/stream/:sourceId', (req: Request, res: Response) => {
  try {
    const { id, sourceId } = req.params;

    const source = db.prepare(`
      SELECT * FROM video_sources WHERE video_id = ? AND id = ?
    `).get(id, sourceId) as any;

    if (!source || !source.is_local) {
      res.status(404).json({ error: 'Video source not found' });
      return;
    }

    const videoPath = path.join(__dirname, '..', '..', source.url);

    if (!fs.existsSync(videoPath)) {
      res.status(404).json({ error: 'Video file not found' });
      return;
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4'
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error streaming video:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

export default router;
