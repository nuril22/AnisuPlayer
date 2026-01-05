import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../database.js';
import { cancelEncoding, deleteVideoFiles } from '../services/encoder.js';

const router = Router();

// Get JWT secret dynamically
const getJwtSecret = () => process.env.JWT_SECRET || 'anisuplayer_default_secret';

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

// Get all encoding jobs
router.get('/jobs', authMiddleware, (req: Request, res: Response) => {
  try {
    const jobs = db.prepare(`
      SELECT ej.*, v.title as video_title
      FROM encoding_jobs ej
      JOIN videos v ON v.id = ej.video_id
      ORDER BY ej.started_at DESC
    `).all();

    const parsedJobs = jobs.map((job: any) => ({
      ...job,
      resolutions_completed: JSON.parse(job.resolutions_completed || '[]'),
      resolutions_pending: JSON.parse(job.resolutions_pending || '[]')
    }));

    res.json(parsedJobs);
  } catch (error) {
    console.error('Error fetching encoding jobs:', error);
    res.status(500).json({ error: 'Failed to fetch encoding jobs' });
  }
});

// Get specific encoding job
router.get('/jobs/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = db.prepare(`
      SELECT ej.*, v.title as video_title
      FROM encoding_jobs ej
      JOIN videos v ON v.id = ej.video_id
      WHERE ej.id = ?
    `).get(jobId);

    if (!job) {
      res.status(404).json({ error: 'Encoding job not found' });
      return;
    }

    const parsedJob = {
      ...job,
      resolutions_completed: JSON.parse((job as any).resolutions_completed || '[]'),
      resolutions_pending: JSON.parse((job as any).resolutions_pending || '[]')
    };

    res.json(parsedJob);
  } catch (error) {
    console.error('Error fetching encoding job:', error);
    res.status(500).json({ error: 'Failed to fetch encoding job' });
  }
});

// Get active encoding jobs
router.get('/active', authMiddleware, (req: Request, res: Response) => {
  try {
    const jobs = db.prepare(`
      SELECT ej.*, v.title as video_title
      FROM encoding_jobs ej
      JOIN videos v ON v.id = ej.video_id
      WHERE ej.status IN ('pending', 'encoding')
      ORDER BY ej.started_at DESC
    `).all();

    const parsedJobs = jobs.map((job: any) => ({
      ...job,
      resolutions_completed: JSON.parse(job.resolutions_completed || '[]'),
      resolutions_pending: JSON.parse(job.resolutions_pending || '[]')
    }));

    res.json(parsedJobs);
  } catch (error) {
    console.error('Error fetching active encoding jobs:', error);
    res.status(500).json({ error: 'Failed to fetch active encoding jobs' });
  }
});

// Cancel encoding job
router.post('/jobs/:jobId/cancel', authMiddleware, (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    // Get the job info first
    const job = db.prepare(`
      SELECT * FROM encoding_jobs WHERE id = ?
    `).get(jobId) as any;

    if (!job) {
      res.status(404).json({ error: 'Encoding job not found' });
      return;
    }

    if (job.status !== 'pending' && job.status !== 'encoding') {
      res.status(400).json({ error: 'Job is not active and cannot be cancelled' });
      return;
    }

    // Cancel the encoding process
    const cancelled = cancelEncoding(jobId);

    if (!cancelled) {
      // Job might be pending (not started yet), just mark it as cancelled
      db.prepare(`
        UPDATE encoding_jobs 
        SET status = 'cancelled',
            error = 'Cancelled by user'
        WHERE id = ?
      `).run(jobId);

      // Delete video and files
      deleteVideoFiles(job.video_id);
      
      db.prepare('DELETE FROM video_sources WHERE video_id = ?').run(job.video_id);
      db.prepare('DELETE FROM subtitles WHERE video_id = ?').run(job.video_id);
      db.prepare('DELETE FROM videos WHERE id = ?').run(job.video_id);
    }

    res.json({ success: true, message: 'Encoding job cancelled and video deleted' });
  } catch (error) {
    console.error('Error cancelling encoding job:', error);
    res.status(500).json({ error: 'Failed to cancel encoding job' });
  }
});

export default router;

