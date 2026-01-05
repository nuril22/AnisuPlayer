import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Video, Subtitle } from '../../types';
import { API_URL } from '../../config';

export default function DashboardEditVideo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  
  // Subtitle state
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [newSubtitleLabel, setNewSubtitleLabel] = useState('');
  const [newSubtitleLanguage, setNewSubtitleLanguage] = useState('en');
  const [newSubtitleFile, setNewSubtitleFile] = useState<File | null>(null);
  const [uploadingSubtitle, setUploadingSubtitle] = useState(false);
  
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      fetchVideo(id);
    }
  }, [id]);

  const fetchVideo = async (videoId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/videos/${videoId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }
      
      const data = await response.json();
      setVideo(data);
      setTitle(data.title);
      setDescription(data.description || '');
      setThumbnail(data.thumbnail || '');
      setSubtitles(data.subtitles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/videos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          description,
          thumbnail
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save video');
      }
      
      // Show success message
      alert('Video saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save video');
    } finally {
      setSaving(false);
    }
  };

  const handleSubtitleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validExtensions = ['.vtt', '.srt', '.ass'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validExtensions.includes(ext)) {
        alert('Please select a valid subtitle file (.vtt, .srt, or .ass)');
        return;
      }
      
      setNewSubtitleFile(file);
      
      // Auto-fill label from filename
      if (!newSubtitleLabel) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setNewSubtitleLabel(nameWithoutExt);
      }
    }
  };

  const handleAddSubtitle = async () => {
    if (!id || !newSubtitleFile || !newSubtitleLabel || !newSubtitleLanguage) {
      alert('Please fill in all subtitle fields');
      return;
    }
    
    setUploadingSubtitle(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('subtitle', newSubtitleFile);
      formData.append('label', newSubtitleLabel);
      formData.append('language', newSubtitleLanguage);
      formData.append('is_default', subtitles.length === 0 ? 'true' : 'false');
      
      const response = await fetch(`${API_URL}/api/videos/${id}/subtitles/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload subtitle');
      }
      
      // Refresh video data
      await fetchVideo(id);
      
      // Clear form
      setNewSubtitleFile(null);
      setNewSubtitleLabel('');
      setNewSubtitleLanguage('en');
      if (subtitleInputRef.current) {
        subtitleInputRef.current.value = '';
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload subtitle');
    } finally {
      setUploadingSubtitle(false);
    }
  };

  const handleDeleteSubtitle = async (subtitleId: number) => {
    if (!confirm('Are you sure you want to delete this subtitle?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/videos/${id}/subtitles/${subtitleId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete subtitle');
      }
      
      // Refresh video data
      if (id) {
        await fetchVideo(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subtitle');
    }
  };

  const handleSetDefaultSubtitle = async (subtitleId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/videos/${id}/subtitles/${subtitleId}/default`, {
        method: 'PUT',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to set default subtitle');
      }
      
      // Refresh video data
      if (id) {
        await fetchVideo(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default subtitle');
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner" style={{ height: '400px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <h3>Video not found</h3>
        <p>The video you're looking for doesn't exist</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="back-btn" onClick={() => navigate('/dashboard/videos')}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
            Back to Videos
          </button>
          <h1 className="page-title" style={{ marginTop: 16 }}>Edit Video</h1>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: 24 }}>
          {error}
        </div>
      )}

      <div className="edit-video-layout">
        {/* Video Preview */}
        <div className="edit-video-preview">
          {video.thumbnail ? (
            <img src={`${API_URL}${video.thumbnail}`} alt={video.title} />
          ) : (
            <div className="no-thumbnail">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
              </svg>
            </div>
          )}
          <div className="edit-video-preview-info">
            <span className="video-id">ID: {video.id}</span>
            <span className="video-duration">{video.duration ? `${Math.floor(video.duration / 60)}:${Math.floor(video.duration % 60).toString().padStart(2, '0')}` : '--:--'}</span>
          </div>
        </div>

        {/* Edit Form */}
        <div className="edit-video-form">
          <div className="upload-form">
            {/* Basic Info Section */}
            <div className="form-section">
              <div className="form-section-title">Basic Information</div>
              
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter video title"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter video description"
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>Thumbnail URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="Enter thumbnail URL (or leave empty for auto-generated)"
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !title.trim()}
                style={{ marginTop: 16 }}
              >
                {saving ? (
                  <>
                    <span className="btn-spinner"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>

            {/* Subtitles Section */}
            <div className="form-section" style={{ marginTop: 32 }}>
              <div className="form-section-title">Subtitles</div>
              
              {/* Existing Subtitles */}
              {subtitles.length > 0 && (
                <div className="subtitles-list">
                  {subtitles.map((subtitle) => (
                    <div key={subtitle.id} className="subtitle-item">
                      <div className="subtitle-info">
                        <span className="subtitle-label">{subtitle.label}</span>
                        <span className="subtitle-language">{subtitle.language}</span>
                        {subtitle.is_default && (
                          <span className="subtitle-default-badge">Default</span>
                        )}
                      </div>
                      <div className="subtitle-actions">
                        {!subtitle.is_default && (
                          <button
                            className="subtitle-action-btn"
                            onClick={() => handleSetDefaultSubtitle(subtitle.id)}
                            title="Set as default"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="subtitle-action-btn delete"
                          onClick={() => handleDeleteSubtitle(subtitle.id)}
                          title="Delete subtitle"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Subtitle */}
              <div className="add-subtitle-form">
                <h4>Add New Subtitle</h4>
                <p className="form-hint">Supported formats: VTT, SRT, ASS</p>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Label *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newSubtitleLabel}
                      onChange={(e) => setNewSubtitleLabel(e.target.value)}
                      placeholder="e.g. English, Indonesian"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Language Code *</label>
                    <select
                      className="form-select"
                      value={newSubtitleLanguage}
                      onChange={(e) => setNewSubtitleLanguage(e.target.value)}
                    >
                      <option value="en">English (en)</option>
                      <option value="id">Indonesian (id)</option>
                      <option value="ja">Japanese (ja)</option>
                      <option value="ko">Korean (ko)</option>
                      <option value="zh">Chinese (zh)</option>
                      <option value="es">Spanish (es)</option>
                      <option value="fr">French (fr)</option>
                      <option value="de">German (de)</option>
                      <option value="pt">Portuguese (pt)</option>
                      <option value="ru">Russian (ru)</option>
                      <option value="ar">Arabic (ar)</option>
                      <option value="hi">Hindi (hi)</option>
                      <option value="th">Thai (th)</option>
                      <option value="vi">Vietnamese (vi)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Subtitle File *</label>
                  <div 
                    className={`file-dropzone subtitle-dropzone ${newSubtitleFile ? 'has-file' : ''}`}
                    onClick={() => subtitleInputRef.current?.click()}
                  >
                    <input
                      ref={subtitleInputRef}
                      type="file"
                      accept=".vtt,.srt,.ass"
                      onChange={handleSubtitleFileSelect}
                      style={{ display: 'none' }}
                    />
                    {newSubtitleFile ? (
                      <div className="file-selected">
                        <div className="file-selected-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                          </svg>
                        </div>
                        <div className="file-selected-info">
                          <span className="file-selected-name">{newSubtitleFile.name}</span>
                          <span className="file-selected-size">
                            {(newSubtitleFile.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          className="file-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewSubtitleFile(null);
                            if (subtitleInputRef.current) {
                              subtitleInputRef.current.value = '';
                            }
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <svg className="file-dropzone-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                        </svg>
                        <h3>Click to select subtitle file</h3>
                        <p>.vtt, .srt, or .ass file</p>
                      </>
                    )}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleAddSubtitle}
                  disabled={uploadingSubtitle || !newSubtitleFile || !newSubtitleLabel || !newSubtitleLanguage}
                >
                  {uploadingSubtitle ? (
                    <>
                      <span className="btn-spinner"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                      </svg>
                      Add Subtitle
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Video Sources Section */}
            <div className="form-section" style={{ marginTop: 32 }}>
              <div className="form-section-title">Video Sources</div>
              
              <div className="sources-list">
                {video.sources.map((source) => (
                  <div key={source.id} className="source-item">
                    <span className="source-resolution">{source.resolution}</span>
                    <span className="source-type">{source.is_local ? 'Local' : 'External'}</span>
                    {source.file_size && (
                      <span className="source-size">
                        {(source.file_size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

