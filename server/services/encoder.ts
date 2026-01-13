import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import db from '../database.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Resolution {
  name: string;
  width: number;
  height: number;
  bitrate: string;
  audioBitrate: string;
}

// Resolutions ordered from LOWEST to HIGHEST
// This ensures lower quality encodes first (faster), then higher quality
const RESOLUTIONS: Resolution[] = [
  { name: '360p', width: 640, height: 360, bitrate: '600k', audioBitrate: '96k' },
  { name: '480p', width: 854, height: 480, bitrate: '1000k', audioBitrate: '128k' },
  { name: '720p', width: 1280, height: 720, bitrate: '2500k', audioBitrate: '128k' },
  { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', audioBitrate: '192k' }
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

// Get target resolutions (already ordered from lowest to highest)
// Filter to only include resolutions <= source height
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

// Check for GPU availability
async function checkGPUAvailable(): Promise<{ available: boolean; type: 'nvenc' | 'qsv' | 'vaapi' | 'amf' | null }> {
  try {
    // Use ffmpeg command to list encoders
    const { stdout, stderr } = await execAsync('ffmpeg -hide_banner -encoders 2>&1');
    const output = stdout || stderr || '';
    
    // Check for NVIDIA NVENC (highest priority for performance)
    if (output.includes('h264_nvenc')) {
      console.log('✅ GPU detected: NVIDIA NVENC (h264_nvenc)');
      return { available: true, type: 'nvenc' };
    }
    
    // Check for AMD AMF (Advanced Media Framework)
    if (output.includes('h264_amf')) {
      console.log('✅ GPU detected: AMD AMF (h264_amf)');
      return { available: true, type: 'amf' };
    }
    
    // Check for Intel Quick Sync (h264_qsv)
    if (output.includes('h264_qsv')) {
      console.log('✅ GPU detected: Intel Quick Sync (h264_qsv)');
      return { available: true, type: 'qsv' };
    }
    
    // Check for VAAPI (Linux - supports Intel, AMD, and others)
    if (output.includes('h264_vaapi')) {
      console.log('✅ GPU detected: VAAPI (h264_vaapi) - supports Intel/AMD/others');
      return { available: true, type: 'vaapi' };
    }
    
    console.log('⚠️  No GPU encoder found, will use CPU encoding (libx264)');
    return { available: false, type: null };
  } catch (error) {
    console.log('⚠️  Could not check GPU encoders, will use CPU encoding:', error);
    return { available: false, type: null };
  }
}

async function encodeToHLS(
  inputPath: string,
  outputDir: string,
  resolution: Resolution,
  sourceWidth: number,
  sourceHeight: number,
  jobId: string,
  onProgress: (progress: number) => void,
  useGPU: boolean = true
): Promise<void> {
  const { width, height } = calculateDimensions(sourceWidth, sourceHeight, resolution.height);
  const playlistPath = path.join(outputDir, `${resolution.name}.m3u8`);
  const segmentPattern = path.join(outputDir, `${resolution.name}_%03d.ts`);

  // Check GPU availability if useGPU is true
  let gpuConfig: { available: boolean; type: 'nvenc' | 'qsv' | 'vaapi' | 'amf' | null } = { available: false, type: null };
  if (useGPU) {
    try {
      gpuConfig = await checkGPUAvailable();
    } catch (gpuError) {
      console.log('⚠️  Error checking GPU, falling back to CPU:', gpuError);
      gpuConfig = { available: false, type: null };
    }
  }
  
  // Log which encoder will be used
  if (gpuConfig.available) {
    console.log(`🎮 Using GPU encoder: ${gpuConfig.type} for ${resolution.name}`);
  } else {
    console.log(`💻 Using CPU encoder (libx264) for ${resolution.name}`);
  }

  return new Promise((resolve, reject) => {
    const outputOptions: string[] = [];
    
    // Video encoder settings - prioritize GPU, fallback to CPU
    if (gpuConfig.available && gpuConfig.type === 'nvenc') {
      // NVIDIA NVENC
      outputOptions.push(
        '-c:v h264_nvenc',
        '-preset p4', // NVENC preset (p1-p7, p4 is balanced)
        '-rc vbr',
        '-cq 23',
        `-b:v ${resolution.bitrate}`,
        `-maxrate ${resolution.bitrate}`,
        `-bufsize ${parseInt(resolution.bitrate) * 2}k`,
        `-vf scale=${width}:${height}`
      );
      console.log(`🎮 Using GPU (NVIDIA NVENC) for ${resolution.name}`);
    } else if (gpuConfig.available && gpuConfig.type === 'amf') {
      // AMD AMF (Advanced Media Framework)
      outputOptions.push(
        '-c:v h264_amf',
        '-quality speed', // balanced, speed, quality
        '-rc vbr_peak',
        '-qmin 18',
        '-qmax 28',
        `-b:v ${resolution.bitrate}`,
        `-maxrate ${resolution.bitrate}`,
        `-bufsize ${parseInt(resolution.bitrate) * 2}k`,
        `-vf scale=${width}:${height}`
      );
      console.log(`🎮 Using GPU (AMD AMF) for ${resolution.name}`);
    } else if (gpuConfig.available && gpuConfig.type === 'qsv') {
      // Intel Quick Sync
      outputOptions.push(
        '-c:v h264_qsv',
        '-preset medium',
        '-global_quality 23',
        `-b:v ${resolution.bitrate}`,
        `-maxrate ${resolution.bitrate}`,
        `-bufsize ${parseInt(resolution.bitrate) * 2}k`,
        `-vf scale_qsv=w=${width}:h=${height}`
      );
      console.log(`🎮 Using GPU (Intel Quick Sync) for ${resolution.name}`);
    } else if (gpuConfig.available && gpuConfig.type === 'vaapi') {
      // VAAPI (Linux - supports Intel, AMD, and others)
      outputOptions.push(
        '-c:v h264_vaapi',
        '-qp 23',
        `-b:v ${resolution.bitrate}`,
        `-maxrate ${resolution.bitrate}`,
        `-bufsize ${parseInt(resolution.bitrate) * 2}k`,
        `-vf scale_vaapi=w=${width}:h=${height}`
      );
      console.log(`🎮 Using GPU (VAAPI) for ${resolution.name}`);
    } else {
      // CPU fallback (libx264)
      outputOptions.push(
        '-c:v libx264',
        '-preset medium',
        '-crf 23',
        `-vf scale=${width}:${height}`,
        `-b:v ${resolution.bitrate}`,
        `-maxrate ${resolution.bitrate}`,
        `-bufsize ${parseInt(resolution.bitrate) * 2}k`
      );
      console.log(`💻 Using CPU (libx264) for ${resolution.name}`);
    }
    
    // Audio settings (same for all)
    outputOptions.push(
      '-c:a aac',
      `-b:a ${resolution.audioBitrate}`,
      '-ar 44100'
    );
    
    // HLS settings
    outputOptions.push(
      '-f hls',
      '-hls_time 6',
      '-hls_list_size 0',
      '-hls_segment_filename', segmentPattern,
      '-hls_playlist_type vod'
    );

    console.log(`🚀 Starting FFmpeg encoding for ${resolution.name}...`);
    console.log(`📋 Command options: ${outputOptions.join(' ')}`);
    
    const command = ffmpeg(inputPath)
      .outputOptions(outputOptions)
      .output(playlistPath)
      .on('start', (commandLine) => {
        console.log(`▶️  FFmpeg command started for ${resolution.name}`);
        console.log(`📝 Command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        // Check if cancelled
        const encoding = activeEncodings.get(jobId);
        if (encoding?.cancelled) {
          command.kill('SIGKILL');
          return;
        }
        
        // Use percent if available, otherwise use frames processed
        let progressPercent = 0;
        if (progress.percent && !isNaN(progress.percent)) {
          progressPercent = progress.percent;
        } else if (progress.frames) {
          // Estimate progress from frames (rough estimate)
          // This is not perfect but better than nothing
          progressPercent = Math.min(95, progress.frames / 100); // Rough estimate
        }
        
        // Always call onProgress to update UI, even if 0
        onProgress(Math.min(100, Math.max(0, progressPercent)));
        
        // Log progress for debugging
        if (progressPercent > 0 && progressPercent % 10 < 1) {
          console.log(`📊 ${resolution.name} encoding progress: ${progressPercent.toFixed(1)}%`);
        }
      })
      .on('end', () => {
        console.log(`✅ FFmpeg encoding completed for ${resolution.name}`);
        resolve();
      })
      .on('error', async (err) => {
        // Check if error is due to cancellation
        const encoding = activeEncodings.get(jobId);
        if (encoding?.cancelled) {
          reject(new Error('CANCELLED'));
          return;
        }
        
        console.error(`❌ FFmpeg error for ${resolution.name}:`, err.message);
        console.error(`📋 Full error:`, err);
        
        // If GPU encoding failed and we haven't tried CPU yet, retry with CPU
        if (gpuConfig.available && useGPU) {
          console.log(`🔄 GPU encoding failed for ${resolution.name}, falling back to CPU...`);
          try {
            await encodeToHLS(inputPath, outputDir, resolution, sourceWidth, sourceHeight, jobId, onProgress, false);
            resolve();
            return;
          } catch (cpuErr) {
            console.error(`❌ CPU encoding also failed for ${resolution.name}:`, cpuErr);
            reject(cpuErr);
            return;
          }
        }
        
        reject(err);
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
  
  // Sort resolutions from lowest to highest for master playlist
  // (already in order, but ensure consistency)
  const sortedResolutions = [...resolutions].sort((a, b) => a.height - b.height);
  
  for (const res of sortedResolutions) {
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

// Extract embedded subtitles from video file
export async function extractSubtitles(inputPath: string, videoId: string): Promise<{ label: string; language: string; url: string; is_default: boolean }[]> {
  const subtitlesDir = path.join(__dirname, '..', '..', 'storage', 'subtitles', videoId);
  if (!fs.existsSync(subtitlesDir)) {
    fs.mkdirSync(subtitlesDir, { recursive: true });
  }

  return new Promise((resolve) => {
    // Get video metadata to find subtitle streams
    ffmpeg.ffprobe(inputPath, async (err, metadata) => {
      if (err) {
        console.error('Error probing video for subtitles:', err);
        resolve([]);
        return;
      }

      const subtitleStreams = metadata.streams.filter(s => s.codec_type === 'subtitle');
      
      if (subtitleStreams.length === 0) {
        console.log('No embedded subtitles found in video');
        resolve([]);
        return;
      }

      console.log(`Found ${subtitleStreams.length} embedded subtitle stream(s)`);
      
      const extractedSubtitles: { label: string; language: string; url: string; is_default: boolean }[] = [];
      
      for (let i = 0; i < subtitleStreams.length; i++) {
        const stream = subtitleStreams[i];
        const streamIndex = stream.index;
        const language = stream.tags?.language || 'und';
        const title = stream.tags?.title || `Subtitle ${i + 1}`;
        const codecName = stream.codec_name || 'unknown';
        
        // Determine output format based on codec
        let outputExt = '.vtt';
        let outputFormat = 'webvtt';
        
        // For ASS/SSA subtitles, keep as ASS for JASSUB renderer
        if (codecName === 'ass' || codecName === 'ssa') {
          outputExt = '.ass';
          outputFormat = 'ass';
        } else if (codecName === 'subrip' || codecName === 'srt') {
          outputExt = '.vtt';
          outputFormat = 'webvtt';
        }
        
        const outputPath = path.join(subtitlesDir, `subtitle_${i}${outputExt}`);
        
        try {
          await new Promise<void>((resolveExtract, rejectExtract) => {
            const extractCommand = ffmpeg(inputPath);
            
            // Map the subtitle stream
            extractCommand.outputOptions([`-map 0:${streamIndex}`]);
            
            // For ASS/SSA, try to copy first, if that fails convert
            if (outputFormat === 'ass') {
              extractCommand
                .outputOptions(['-c:s', 'copy'])
                .output(outputPath)
                .on('end', () => {
                  console.log(`✅ Extracted ASS subtitle ${i + 1}: ${title} (${language})`);
                  resolveExtract();
                })
                .on('error', (extractErr) => {
                  // If copy fails, try converting to ASS
                  console.log(`⚠️  Copy failed for subtitle ${i + 1}, trying conversion...`);
                  ffmpeg(inputPath)
                    .outputOptions([
                      `-map 0:${streamIndex}`,
                      '-c:s', 'ass'
                    ])
                    .output(outputPath)
                    .on('end', () => {
                      console.log(`✅ Extracted ASS subtitle ${i + 1} (converted): ${title} (${language})`);
                      resolveExtract();
                    })
                    .on('error', (convertErr) => {
                      console.error(`❌ Error extracting subtitle ${i}:`, convertErr.message);
                      rejectExtract(convertErr);
                    })
                    .run();
                })
                .run();
            } else {
              // For other formats, convert to VTT
              extractCommand
                .outputOptions(['-c:s', 'webvtt'])
                .output(outputPath)
                .on('end', () => {
                  console.log(`✅ Extracted subtitle ${i + 1}: ${title} (${language})`);
                  resolveExtract();
                })
                .on('error', (extractErr) => {
                  console.error(`❌ Error extracting subtitle ${i}:`, extractErr.message);
                  rejectExtract(extractErr);
                })
                .run();
            }
          });
          
          const relativePath = `/storage/subtitles/${videoId}/subtitle_${i}${outputExt}`;
          
          extractedSubtitles.push({
            label: title,
            language: language,
            url: relativePath,
            is_default: i === 0 // First subtitle is default
          });
        } catch (extractError) {
          console.error(`Failed to extract subtitle ${i}:`, extractError);
          // Continue with other subtitles
        }
      }
      
      resolve(extractedSubtitles);
    });
  });
}

// Also check for external subtitle files in the same directory as the video
export async function findExternalSubtitles(inputPath: string, videoId: string): Promise<{ label: string; language: string; url: string; is_default: boolean }[]> {
  const videoDir = path.dirname(inputPath);
  const videoName = path.basename(inputPath, path.extname(inputPath));
  const subtitlesDir = path.join(__dirname, '..', '..', 'storage', 'subtitles', videoId);
  
  if (!fs.existsSync(subtitlesDir)) {
    fs.mkdirSync(subtitlesDir, { recursive: true });
  }
  
  const subtitleExtensions = ['.srt', '.vtt', '.ass', '.ssa'];
  const foundSubtitles: { label: string; language: string; url: string; is_default: boolean }[] = [];
  
  try {
    const files = fs.readdirSync(videoDir);
    let subtitleIndex = 0;
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const baseName = path.basename(file, ext);
      
      // Check if it's a subtitle file that matches the video name
      if (subtitleExtensions.includes(ext) && baseName.startsWith(videoName)) {
        const sourcePath = path.join(videoDir, file);
        
        // Parse language from filename (e.g., video.en.srt, video.english.ass)
        const langMatch = baseName.match(/\.([a-z]{2,3}|english|japanese|chinese|korean|spanish|french|german|portuguese|italian|russian|arabic)$/i);
        const language = langMatch ? langMatch[1].toLowerCase() : 'und';
        
        // Determine label
        let label = language.toUpperCase();
        if (language === 'english' || language === 'en') label = 'English';
        else if (language === 'japanese' || language === 'ja' || language === 'jp') label = 'Japanese';
        else if (language === 'chinese' || language === 'zh') label = 'Chinese';
        else if (language === 'korean' || language === 'ko') label = 'Korean';
        else if (language === 'spanish' || language === 'es') label = 'Spanish';
        else if (language === 'french' || language === 'fr') label = 'French';
        else if (language === 'german' || language === 'de') label = 'German';
        else if (language === 'portuguese' || language === 'pt') label = 'Portuguese';
        else if (language === 'italian' || language === 'it') label = 'Italian';
        else if (language === 'russian' || language === 'ru') label = 'Russian';
        else if (language === 'arabic' || language === 'ar') label = 'Arabic';
        else label = `Subtitle ${subtitleIndex + 1}`;
        
        // Copy subtitle file to storage
        let destExt = ext;
        let destPath = path.join(subtitlesDir, `external_${subtitleIndex}${destExt}`);
        
        // For SRT, convert to VTT
        if (ext === '.srt') {
          let content = fs.readFileSync(sourcePath, 'utf-8');
          if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
          }
          const vttContent = convertSrtToVttSimple(content);
          destExt = '.vtt';
          destPath = path.join(subtitlesDir, `external_${subtitleIndex}.vtt`);
          fs.writeFileSync(destPath, vttContent, { encoding: 'utf-8' });
        } else {
          // Copy ASS/VTT as-is
          fs.copyFileSync(sourcePath, destPath);
        }
        
        const relativePath = `/storage/subtitles/${videoId}/external_${subtitleIndex}${destExt}`;
        
        foundSubtitles.push({
          label,
          language: language.substring(0, 3),
          url: relativePath,
          is_default: subtitleIndex === 0
        });
        
        subtitleIndex++;
        console.log(`Found external subtitle: ${file} -> ${label}`);
      }
    }
  } catch (error) {
    console.error('Error finding external subtitles:', error);
  }
  
  return foundSubtitles;
}

// Simple SRT to VTT converter
function convertSrtToVttSimple(srtContent: string): string {
  let vttContent = 'WEBVTT\n\n';
  
  // Split by double newlines to get subtitle blocks
  const blocks = srtContent.trim().split(/\r?\n\r?\n/);
  
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) continue;
    
    // Skip the index line (first line)
    // Get the timing line (second line)
    const timingLine = lines[1];
    if (!timingLine.includes('-->')) continue;
    
    // Convert timing format (00:00:00,000 to 00:00:00.000)
    const timing = timingLine.replace(/,/g, '.');
    
    // Get the text (remaining lines)
    const text = lines.slice(2).join('\n');
    
    vttContent += `${timing}\n${text}\n\n`;
  }
  
  return vttContent;
}

export async function startEncodingJob(videoId: string, inputPath: string): Promise<string> {
  const jobId = nanoid(12);

  try {
    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input video file not found: ${inputPath}`);
    }
    
    console.log(`📹 Starting encoding job ${jobId} for video ${videoId}`);
    console.log(`📂 Input file: ${inputPath}`);
    console.log(`📊 File size: ${(fs.statSync(inputPath).size / 1024 / 1024).toFixed(2)} MB`);
    
    // Get video info
    console.log(`🔍 Analyzing video file...`);
    const videoInfo = await getVideoInfo(inputPath);
    console.log(`✅ Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration.toFixed(2)}s`);

    // Update video duration
    db.prepare('UPDATE videos SET duration = ? WHERE id = ?').run(videoInfo.duration, videoId);

    // Generate thumbnail
    const thumbnailUrl = await generateThumbnail(inputPath, videoId);
    if (thumbnailUrl) {
      db.prepare('UPDATE videos SET thumbnail = ? WHERE id = ?').run(thumbnailUrl, videoId);
    }

    // Extract embedded subtitles from video
    console.log('🔍 Checking for embedded subtitles...');
    const embeddedSubtitles = await extractSubtitles(inputPath, videoId);
    
    // Also check for external subtitle files
    console.log('🔍 Checking for external subtitle files...');
    const externalSubtitles = await findExternalSubtitles(inputPath, videoId);
    
    // Combine all found subtitles
    const allSubtitles = [...embeddedSubtitles, ...externalSubtitles];
    
    // Insert subtitles into database
    if (allSubtitles.length > 0) {
      console.log(`📝 Found ${allSubtitles.length} subtitle(s), adding to database...`);
      const insertSubtitle = db.prepare(`
        INSERT INTO subtitles (video_id, label, language, url, is_default)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      // Only first subtitle should be default
      let hasDefault = false;
      for (const sub of allSubtitles) {
        const isDefault = !hasDefault && sub.is_default;
        if (isDefault) hasDefault = true;
        insertSubtitle.run(videoId, sub.label, sub.language, sub.url, isDefault ? 1 : 0);
      }
    }

    // Determine target resolutions (ordered from lowest to highest)
    const targetResolutions = getTargetResolutions(videoInfo.height);

    if (targetResolutions.length === 0) {
      throw new Error('Source video resolution too low');
    }

    // Create encoding job - resolutions pending shows the order (lowest first)
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

    // Start encoding in background (will encode from lowest to highest resolution)
    // Don't await - let it run in background, but catch errors
    processEncodingJob(jobId, videoId, inputPath, targetResolutions, videoInfo.width, videoInfo.height)
      .catch((error) => {
        console.error(`❌ Error in encoding job ${jobId}:`, error);
        // Update job status to failed
        db.prepare(`
          UPDATE encoding_jobs 
          SET status = 'failed', error = ?, completed_at = datetime('now')
          WHERE id = ?
        `).run(error instanceof Error ? error.message : 'Unknown error', jobId);
      });

    console.log(`📊 Encoding job ${jobId} registered. Target resolutions: ${targetResolutions.map(r => r.name).join(', ')}`);
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

  // Log encoding order
  console.log(`🎬 Starting encoding job ${jobId} for video ${videoId}`);
  console.log(`📊 Encoding order (lowest to highest): ${resolutions.map(r => r.name).join(' → ')}`);

  try {
    // Update job status to encoding
    db.prepare(`
      UPDATE encoding_jobs SET status = 'encoding', progress = 0 WHERE id = ?
    `).run(jobId);
    
    console.log(`🎬 Encoding job ${jobId} status updated to 'encoding'`);

    // Process resolutions in order (lowest to highest)
    for (let i = 0; i < resolutions.length; i++) {
      // Check if cancelled
      const encoding = activeEncodings.get(jobId);
      if (encoding?.cancelled) {
        throw new Error('CANCELLED');
      }

      const resolution = resolutions[i];

      console.log(`🔄 Starting encoding for ${resolution.name} (${i + 1}/${totalResolutions})...`);

      // Update current resolution and reset progress for this resolution
      db.prepare(`
        UPDATE encoding_jobs 
        SET current_resolution = ?,
            resolutions_pending = ?,
            progress = ?
        WHERE id = ?
      `).run(
        resolution.name,
        JSON.stringify(resolutions.slice(i).map(r => r.name)),
        (i / totalResolutions) * 100, // Base progress for completed resolutions
        jobId
      );

      try {
        let resolutionStartTime = Date.now();
        await encodeToHLS(inputPath, outputDir, resolution, sourceWidth, sourceHeight, jobId, (progress) => {
          // Calculate overall progress
          const resolutionProgress = progress / 100;
          const overallProgress = ((i + resolutionProgress) / totalResolutions) * 100;

          // Estimate time remaining
          const elapsed = Date.now() - startTime;
          if (overallProgress > 0) {
            const estimatedTotal = elapsed / (overallProgress / 100);
            const estimatedRemaining = Math.max(0, Math.round((estimatedTotal - elapsed) / 1000));
            
            // Update job progress
            db.prepare(`
              UPDATE encoding_jobs 
              SET progress = ?,
                  estimated_time_remaining = ?,
                  status = 'encoding'
              WHERE id = ?
            `).run(overallProgress, estimatedRemaining, jobId);
          }
        });
        
        const resolutionTime = ((Date.now() - resolutionStartTime) / 1000).toFixed(1);
        console.log(`✅ Completed ${resolution.name} in ${resolutionTime}s`);

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

        console.log(`✅ Completed ${resolution.name}`);

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
    console.log(`📊 Completed resolutions: ${completedResolutions.join(', ')}`);
  } catch (error: any) {
    // Remove from active encodings
    activeEncodings.delete(jobId);

    console.error(`❌ Encoding job ${jobId} failed:`, error);

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
