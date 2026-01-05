import { Video } from '../../types';

interface VideoInfoProps {
  video: Video;
  currentQuality?: string;
  onClose: () => void;
}

const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function VideoInfo({ video, currentQuality, onClose }: VideoInfoProps) {
  // Get current source based on quality
  const currentSource = video.sources.find(s => s.resolution === currentQuality) || video.sources[0];
  
  // Calculate total file size
  const totalSize = video.sources.reduce((acc, s) => acc + (s.file_size || 0), 0);

  return (
    <div className="video-info-modal-overlay" onClick={onClose}>
      <div className="video-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="video-info-header">
          <h3>Video Information</h3>
          <button className="settings-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>
        <div className="video-info-content">
          <div className="video-info-item">
            <span className="video-info-label">Title</span>
            <span className="video-info-value">{video.title}</span>
          </div>
          
          {video.description && (
            <div className="video-info-item">
              <span className="video-info-label">Description</span>
              <span className="video-info-value">{video.description}</span>
            </div>
          )}
          
          <div className="video-info-item">
            <span className="video-info-label">Video ID</span>
            <span className="video-info-value" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {video.id}
            </span>
          </div>
          
          {video.duration && video.duration > 0 && (
            <div className="video-info-item">
              <span className="video-info-label">Duration</span>
              <span className="video-info-value">{formatDuration(video.duration)}</span>
            </div>
          )}
          
          {currentQuality && (
            <div className="video-info-item">
              <span className="video-info-label">Current Quality</span>
              <span className="video-info-value">{currentQuality}</span>
            </div>
          )}
          
          <div className="video-info-item">
            <span className="video-info-label">Available Qualities</span>
            <span className="video-info-value">
              {video.sources
                .filter(s => s.resolution !== 'auto')
                .map(s => s.resolution)
                .join(', ') || 'N/A'}
            </span>
          </div>
          
          {totalSize > 0 && (
            <div className="video-info-item">
              <span className="video-info-label">Total Size</span>
              <span className="video-info-value">{formatFileSize(totalSize)}</span>
            </div>
          )}
          
          {video.subtitles && video.subtitles.length > 0 && (
            <div className="video-info-item">
              <span className="video-info-label">Subtitles</span>
              <span className="video-info-value">
                {video.subtitles.map(s => s.label).join(', ')}
              </span>
            </div>
          )}
          
          {video.created_at && (
            <div className="video-info-item">
              <span className="video-info-label">Uploaded</span>
              <span className="video-info-value">{formatDate(video.created_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
