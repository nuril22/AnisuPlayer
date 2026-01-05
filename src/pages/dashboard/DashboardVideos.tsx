import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../../types';
import { API_URL } from '../../config';

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function DashboardVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/videos`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Error fetching videos:', response.status);
        setVideos([]);
        return;
      }
      
      const data = await response.json();
      setVideos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      await fetch(`${API_URL}/api/videos/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setVideos(videos.filter(v => v.id !== id));
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const copyLink = async (id: string) => {
    const link = `${window.location.origin}/cdn/${id}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="loading-spinner" style={{ height: '400px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Videos</h1>
        <div className="page-actions">
          <Link to="/dashboard/upload" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}>
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            Upload Video
          </Link>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📹</div>
          <h3>No videos yet</h3>
          <p>Upload your first video to get started</p>
          <Link to="/dashboard/upload" className="btn btn-primary" style={{ marginTop: 16 }}>
            Upload Video
          </Link>
        </div>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <div key={video.id} className="video-card">
              <div className="video-card-thumbnail">
                {video.thumbnail ? (
                  <img src={`${API_URL}${video.thumbnail}`} alt={video.title} />
                ) : (
                  <div className="video-card-thumbnail-placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
                    </svg>
                  </div>
                )}
                {video.duration && (
                  <span className="video-card-duration">{formatDuration(video.duration)}</span>
                )}
              </div>

              <div className="video-card-content">
                <h3 className="video-card-title">{video.title}</h3>
                
                <div className="video-card-meta">
                  <span className="video-card-id">{video.id}</span>
                  <div className="video-card-resolutions">
                    {video.sources.slice(0, 3).map((source) => (
                      <span key={source.id} className="resolution-badge">
                        {source.resolution}
                      </span>
                    ))}
                    {video.sources.length > 3 && (
                      <span className="resolution-badge">+{video.sources.length - 3}</span>
                    )}
                  </div>
                </div>

                <div className="video-card-actions">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyLink(video.id)}
                  >
                    {copiedId === video.id ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
                          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                  <Link 
                    to={`/dashboard/videos/${video.id}/edit`}
                    className="btn btn-secondary btn-sm"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                    Edit
                  </Link>
                  <a 
                    href={`/cdn/${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch
                  </a>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(video.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

