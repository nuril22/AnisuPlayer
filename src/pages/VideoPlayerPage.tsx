import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import type { Video } from '../types';
import { API_URL } from '../config';

export default function VideoPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchVideo(id);
    }
  }, [id]);

  const fetchVideo = async (videoId: string) => {
    try {
      setLoading(true);
      // Use /api/cdn endpoint to avoid conflict with React Router /cdn/:id route
      const response = await fetch(`${API_URL}/api/cdn/${videoId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format. Server may be returning HTML instead of JSON.');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Video not found' }));
        throw new Error(errorData.error || 'Video not found');
      }
      
      const data = await response.json();
      setVideo(data);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Server returned invalid data. Please check if the backend is running.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load video');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="video-player-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="video-player-page" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '16px'
      }}>
        <svg 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          style={{ width: 64, height: 64, opacity: 0.3 }}
        >
          <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9.41 16.59L8 15.17 12 11.17l4 4-1.41 1.42L12 14.01l-2.59 2.58zM8 9.17l1.41 1.42L12 8.01l2.59 2.58L16 9.17l-4-4-4 4z" />
        </svg>
        <h2 style={{ color: 'rgba(255,255,255,0.6)' }}>Video Not Found</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>
          {error || 'The video you are looking for does not exist.'}
        </p>
      </div>
    );
  }

  return (
    <div className="video-player-page">
      <VideoPlayer video={video} />
    </div>
  );
}

