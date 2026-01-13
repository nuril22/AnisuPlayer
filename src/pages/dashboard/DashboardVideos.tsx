import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Video } from '../../types';
import { API_URL } from '../../config';
import { useSearch } from './DashboardLayout';

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeAgo = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString();
};

type FilterType = 'all' | 'recent' | 'viewed' | 'drafts' | 'archived';

interface MenuPosition {
  x: number;
  y: number;
}

export default function DashboardVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const { searchQuery } = useSearch();
  const navigate = useNavigate();

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
      closeMenu();
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const copyLink = async (id: string) => {
    const link = `${window.location.origin}/cdn/${id}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    closeMenu();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  // Handle three-dot menu click
  const handleMenuClick = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (openMenuId === videoId) {
      closeMenu();
    } else {
      const rect = (e.target as HTMLElement).closest('.video-menu-btn')?.getBoundingClientRect();
      if (rect) {
        // Calculate position to show menu outside of card
        const menuWidth = 180;
        const menuHeight = 200;
        let x = rect.right + 8;
        let y = rect.top;
        
        // Adjust if menu would go off screen
        if (x + menuWidth > window.innerWidth) {
          x = rect.left - menuWidth - 8;
        }
        if (y + menuHeight > window.innerHeight) {
          y = window.innerHeight - menuHeight - 16;
        }
        
        setMenuPosition({ x, y });
      }
      setOpenMenuId(videoId);
    }
  };

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, videoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 180;
    const menuHeight = 200;
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust if menu would go off screen
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 16;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 16;
    }
    
    setMenuPosition({ x, y });
    setOpenMenuId(videoId);
  }, []);

  // Filter videos based on search query
  const filteredVideos = videos.filter(video => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      video.title.toLowerCase().includes(query) ||
      video.id.toLowerCase().includes(query) ||
      (video.description && video.description.toLowerCase().includes(query))
    );
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All Videos' },
    { key: 'recent', label: 'Most Recent' },
    { key: 'viewed', label: 'Most Viewed' },
    { key: 'drafts', label: 'Drafts' },
    { key: 'archived', label: 'Archived' },
  ];

  if (loading) {
    return (
      <div className="loading-spinner" style={{ height: '400px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="videos-page">
      {/* Page Header */}
      <div className="page-header-modern">
        <div className="page-header-info">
          <h1 className="page-title-modern">My Videos</h1>
          <p className="page-description">Manage and track your video performance</p>
        </div>
        <Link to="/dashboard/upload" className="btn-upload">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Upload Video
        </Link>
      </div>

      {/* Filters */}
      <div className="filters-container">
        {filters.map((filter) => (
          <button
            key={filter.key}
            className={`filter-chip ${activeFilter === filter.key ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Search Results Info */}
      {searchQuery && (
        <div className="search-results-info">
          Found {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''} for "{searchQuery}"
        </div>
      )}

      {filteredVideos.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-icon">{searchQuery ? '🔍' : '📹'}</div>
          <h3>{searchQuery ? 'No videos found' : 'No videos yet'}</h3>
          <p>{searchQuery ? 'Try a different search term' : 'Upload your first video to get started'}</p>
          {!searchQuery && (
            <Link to="/dashboard/upload" className="btn-upload" style={{ marginTop: 24 }}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              Upload Video
            </Link>
          )}
        </div>
      ) : (
        <div className="video-grid-modern">
          {filteredVideos.map((video) => (
            <div 
              key={video.id} 
              className="video-card-modern"
              onContextMenu={(e) => handleContextMenu(e, video.id)}
            >
              {/* Thumbnail */}
              <div className="video-card-thumbnail-modern">
                {video.thumbnail ? (
                  <img src={`${API_URL}${video.thumbnail}`} alt={video.title} />
                ) : (
                  <div className="video-thumbnail-placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
                    </svg>
                  </div>
                )}
                {video.duration && (
                  <span className="video-duration-badge">{formatDuration(video.duration)}</span>
                )}
                {/* Hover Overlay */}
                <div className="video-hover-overlay">
                  <a 
                    href={`/cdn/${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="play-btn-overlay"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Content */}
              <div className="video-card-content-modern">
                <div className="video-card-header">
                  <h3 className="video-title-modern">{video.title}</h3>
                  <button 
                    className="video-menu-btn"
                    onClick={(e) => handleMenuClick(e, video.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                </div>

                <div className="video-meta-modern">
                  <span className="video-meta-item">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
                    </svg>
                    {formatTimeAgo(video.created_at)}
                  </span>
                  <span className="meta-separator">•</span>
                  <span className="video-meta-item">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                    {video.sources.length > 0 ? `${video.sources.length} sources` : 'No sources'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fixed Position Dropdown Menu (outside of cards) */}
      {openMenuId && menuPosition && (
        <>
          <div 
            className="dropdown-overlay" 
            onClick={closeMenu}
          />
          <div 
            className="video-dropdown-menu-fixed"
            style={{ 
              position: 'fixed',
              left: menuPosition.x,
              top: menuPosition.y,
              zIndex: 1000
            }}
          >
            <button onClick={() => copyLink(openMenuId)}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
              </svg>
              {copiedId === openMenuId ? 'Copied!' : 'Copy Link'}
            </button>
            <button onClick={() => {
              closeMenu();
              navigate(`/dashboard/videos/${openMenuId}/edit`);
            }}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
              Edit
            </button>
            <a 
              href={`/cdn/${openMenuId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch
            </a>
            <button 
              className="delete-option"
              onClick={() => handleDelete(openMenuId)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
