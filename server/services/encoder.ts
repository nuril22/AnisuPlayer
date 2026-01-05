import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import db from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Resolution {
  name: string;
  width: number;
  height: number;
  bitrate: string;
  audioBitrate: string;
}

const RESOLUTIONS: Resolution[] = [
  { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', audioBitrate: '192k' },
  { name: '720p', width: 1280, height: 720, bitrate: '2500k', audioBitrate: '128k' },
  { name: '480p', width: 854, height: 480, bitrate: '1000k', audioBitrate: '128k' },
  { name: '360p', width: 640, height: 360, bitrate: '600k', audioBitrate: '96k' }
];

// Track active encoding processes for cancellation
const activeEncodings: Map<string, { 
  command: any; 
  videoId: string;
  cancelled: boolean;
}> = new Map();

// Export function to cancel encoding
export function cancelEncoding(jobId: string): boolean {
  const encoding = activeEncodings.get(jobId);
  if (encoding) {
    encoding.cancelled = true;
    try {
      encoding.command.kill('SIGKILL');
    } catch (e) {
      console.error('Error killing ffmpeg process:', e);
    }
    return true;
  }
  return false;
}

// Export function to get active job ID for a video
export function getActiveJobForVideo(videoId: string): string | null {
  for (const [jobId, encoding] of activeEncodings) {
    if (encoding.videoId === videoId) {
      return jobId;
    }
  }
  return null;
}

// Delete video and all associated files
export function deleteVideoFiles(videoId: string): void {
  const videoDir = path.join(__dirname, '..', '..', 'storage', 'videos', videoId);
  if (fs.existsSync(videoDir)) {
    fs.rmSync(videoDir, { recursive: true, force: true });
    console.log(`Deleted video folder: ${videoDir}`);
  }

  const thumbnailPath = path.join(__dirname, '..', '..', 'storage', 'thumbnails', `${videoId}.jpg`);
  if (fs.existsSync(thumbnailPath)) {
    fs.unlinkSync(thumbnailPath);
    console.log(`Deleted thumbnail: ${thumbnailPath}`);
  }
}

export async function getVideoInfo(filePath: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      resolve({
        width: videoStream.width || 1920,
        height: videoStream.height || 1080,
        duration: metadata.format.duration || 0
      });
    });
  });
}

function getTargetResolutions(sourceHeight: number): Resolution[] {
  return RESOLUTIONS.filter(r => r.height <= sourceHeight);
}

// Calculate proper dimensions maintaining aspect ratio and ensuring even numbers
function calculateDimensions(sourceWidth: number, sourceHeight: number, targetHeight: number): { width: number; height: number } {
  const aspectRatio = sourceWidth / sourceHeight;
  let width = Math.round(targetHeight * aspectRatio);
  
  // Ensure width is even (required by most codecs)
  if (width % 2 !== 0) width += 1;
  
  // Ensure height is even
  let height = targetHeight;
  if (height % 2 !== 0) height += 1;
  
  return { width, height };
}

async function encodeToHLS(
  inputPath: string,
  outputDir: string,
  resolution: Resolution,
  sourceWidth: number,
  sourceHeight: number,
  jobId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const { width, height } = calculateDimensions(sourceWidth, sourceHeight, resolution.height);
  const playlistPath = path.join(outputDir, `${resolution.name}.m3u8`);
  const segmentPattern = path.join(outputDir, `${resolution.name}_%03d.ts`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .outputOptions([
        // Video settings
        '-c:v libx264',
        '-preset medium',
        '-crf 23',
        `-vf scale=${width}:${height}`,
        `-b:v ${resolution.bitrate}`,
        `-maxrate ${resolution.bitrate}`,
        `-bufsize ${parseInt(resolution.bitrate) * 2}k`,
        // Audio settings
        '-c:a aac',
        `-b:a ${resolution.audioBitrate}`,
        '-ar 44100',
        // HLS settings
        '-f hls',
        '-hls_time 6',
        '-hls_list_size 0',
        '-hls_segment_filename', segmentPattern,
        '-hls_playlist_type vod'
      ])
      .output(playlistPath)
      .on('progress', (progress) => {
        // Check if cancelled
        const encoding = activeEncodings.get(jobId);
        if (encoding?.cancelled) {
          command.kill('SIGKILL');
          return;
        }
        onProgress(progress.percent || 0);
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        // Check if error is due to cancellation
        const encoding = activeEncodings.get(jobId);
        if (encoding?.cancelled) {
          reject(new Error('CANCELLED'));
        } else {
          console.error(`Error encoding ${resolution.name}:`, err.message);
          reject(err);
        }
      });

    // Store reference to command for cancellation
    const encoding = activeEncodings.get(jobId);
    if (encoding) {
      encoding.command = command;
    }

    command.run();
  });
}

async function generateMasterPlaylist(outputDir: string, resolutions: Resolution[], videoId: string): Promise<void> {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  
  for (const res of resolutions) {
    const bandwidth = parseInt(res.bitrate) * 1000;
    const { width, height } = { width: res.width, height: res.height };
    
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height},NAME="${res.name}"`);
    lines.push(`${res.name}.m3u8`);
  }
  
  const masterPath = path.join(outputDir, 'master.m3u8');
  fs.writeFileSync(masterPath, lines.join('\n'));
}

export async function generateThumbnail(inputPath: string, videoId: string): Promise<string> {
  const thumbnailDir = path.join(__dirname, '..', '..', 'storage', 'thumbnails');
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
  }

  const thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['10%'],
        filename: `${videoId}.jpg`,
        folder: thumbnailDir,
        size: '640x360'
      })
      .on('end', () => {
        resolve(`/storage/thumbnails/${videoId}.jpg`);
      })
      .on('error', (err) => {
        console.error('Thumbnail generation error:', err);
        resolve(''); // Don't fail the whole process for thumbnail
      });
  });
}

export async function startEncodingJob(videoId: string, inputPath: string): Promise<string> {
  const jobId = nanoid(12);

  try {
    // Get video info
    const videoInfo = await getVideoInfo(inputPath);

    // Update video duration
    db.prepare('UPDATE videos SET duration = ? WHERE id = ?').run(videoInfo.duration, videoId);

    // Generate thumbnail
    const thumbnailUrl = await generateThumbnail(inputPath, videoId);
    if (thumbnailUrl) {
      db.prepare('UPDATE videos SET thumbnail = ? WHERE id = ?').run(thumbnailUrl, videoId);
    }

    // Determine target resolutions
    const targetResolutions = getTargetResolutions(videoInfo.height);

    if (targetResolutions.length === 0) {
      throw new Error('Source video resolution too low');
    }

    // Create encoding job
    db.prepare(`
      INSERT INTO encoding_jobs (id, video_id, status, resolutions_pending, started_at)
      VALUES (?, ?, 'pending', ?, datetime('now'))
    `).run(jobId, videoId, JSON.stringify(targetResolutions.map(r => r.name)));

    // Register in active encodings
    activeEncodings.set(jobId, {
      command: null,
      videoId,
      cancelled: false
    });

    // Start encoding in background
    processEncodingJob(jobId, videoId, inputPath, targetResolutions, videoInfo.width, videoInfo.height);

    return jobId;
  } catch (error) {
    console.error('Error starting encoding job:', error);
    throw error;
  }
}

async function processEncodingJob(
  jobId: string,
  videoId: string,
  inputPath: string,
  resolutions: Resolution[],
  sourceWidth: number,
  sourceHeight: number
) {
  const outputDir = path.join(__dirname, '..', '..', 'storage', 'videos', videoId);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const completedResolutions: string[] = [];
  const totalResolutions = resolutions.length;
  let startTime = Date.now();

  try {
    // Update job status to encoding
    db.prepare(`
      UPDATE encoding_jobs SET status = 'encoding' WHERE id = ?
    `).run(jobId);

    for (let i = 0; i < resolutions.length; i++) {
      // Check if cancelled
      const encoding = activeEncodings.get(jobId);
      if (encoding?.cancelled) {
        throw new Error('CANCELLED');
      }

      const resolution = resolutions[i];

      // Update current resolution
      db.prepare(`
        UPDATE encoding_jobs 
        SET current_resolution = ?,
            resolutions_pending = ?
        WHERE id = ?
      `).run(
        resolution.name,
        JSON.stringify(resolutions.slice(i).map(r => r.name)),
        jobId
      );

      try {
        await encodeToHLS(inputPath, outputDir, resolution, sourceWidth, sourceHeight, jobId, (progress) => {
          // Calculate overall progress
          const resolutionProgress = progress / 100;
          const overallProgress = ((i + resolutionProgress) / totalResolutions) * 100;

          // Estimate time remaining
          const elapsed = Date.now() - startTime;
          const estimatedTotal = elapsed / (overallProgress / 100);
          const estimatedRemaining = Math.round((estimatedTotal - elapsed) / 1000);

          // Update job progress
          db.prepare(`
            UPDATE encoding_jobs 
            SET progress = ?,
                estimated_time_remaining = ?
            WHERE id = ?
          `).run(overallProgress, estimatedRemaining, jobId);
        });

        // Calculate total size of all .ts files for this resolution
        const tsFiles = fs.readdirSync(outputDir).filter(f => f.startsWith(`${resolution.name}_`) && f.endsWith('.ts'));
        const totalSize = tsFiles.reduce((acc, file) => {
          const filePath = path.join(outputDir, file);
          return acc + fs.statSync(filePath).size;
        }, 0);

        // Add video source - point to the HLS playlist
        db.prepare(`
          INSERT INTO video_sources (video_id, resolution, url, is_local, file_size)
          VALUES (?, ?, ?, 1, ?)
        `).run(videoId, resolution.name, `/storage/videos/${videoId}/${resolution.name}.m3u8`, totalSize);

        completedResolutions.push(resolution.name);

        // Update completed resolutions
        db.prepare(`
          UPDATE encoding_jobs 
          SET resolutions_completed = ?
          WHERE id = ?
        `).run(JSON.stringify(completedResolutions), jobId);

      } catch (encodeError: any) {
        if (encodeError.message === 'CANCELLED') {
          throw encodeError;
        }
        console.error(`Error encoding ${resolution.name}:`, encodeError.message);
        // Continue with other resolutions instead of failing completely
        continue;
      }
    }

    // Generate master playlist if we have at least one resolution
    if (completedResolutions.length > 0) {
      const completedRes = resolutions.filter(r => completedResolutions.includes(r.name));
      await generateMasterPlaylist(outputDir, completedRes, videoId);

      // Add master playlist as a source
      db.prepare(`
        INSERT OR REPLACE INTO video_sources (video_id, resolution, url, is_local, file_size)
        VALUES (?, 'auto', ?, 1, 0)
      `).run(videoId, `/storage/videos/${videoId}/master.m3u8`);
    }

    // Mark job as completed
    db.prepare(`
      UPDATE encoding_jobs 
      SET status = 'completed',
          progress = 100,
          current_resolution = NULL,
          resolutions_pending = '[]',
          completed_at = datetime('now'),
          estimated_time_remaining = 0
      WHERE id = ?
    `).run(jobId);

    // Delete original upload file
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    // Remove from active encodings
    activeEncodings.delete(jobId);

    console.log(`✅ Encoding job ${jobId} completed successfully`);
  } catch (error: any) {
    // Remove from active encodings
    activeEncodings.delete(jobId);

    if (error.message === 'CANCELLED') {
      console.log(`⏹️ Encoding job ${jobId} was cancelled`);
      
      // Mark job as cancelled
      db.prepare(`
        UPDATE encoding_jobs 
        SET status = 'cancelled',
            error = 'Cancelled by user'
        WHERE id = ?
      `).run(jobId);

      // Delete video files and database entries
      deleteVideoFiles(videoId);
      
      // Delete original upload file
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }

      // Delete from database
      db.prepare('DELETE FROM video_sources WHERE video_id = ?').run(videoId);
      db.prepare('DELETE FROM subtitles WHERE video_id = ?').run(videoId);
      db.prepare('DELETE FROM videos WHERE id = ?').run(videoId);

      console.log(`🗑️ Video ${videoId} and all files deleted due to cancellation`);
    } else {
      console.error(`❌ Encoding job ${jobId} failed:`, error);

      db.prepare(`
        UPDATE encoding_jobs 
        SET status = 'failed',
            error = ?
        WHERE id = ?
      `).run(error.message, jobId);
    }
  }
}
