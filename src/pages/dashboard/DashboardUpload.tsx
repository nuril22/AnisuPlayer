import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';

interface LinkSource {
  url: string;
  resolution: string;
}

type UploadTab = 'file' | 'link';

const RESOLUTIONS = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

export default function DashboardUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<UploadTab>('file');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [enableEncoding, setEnableEncoding] = useState(true);
  
  // Link upload state
  const [linkSources, setLinkSources] = useState<LinkSource[]>([
    { url: '', resolution: '1080p' }
  ]);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addLinkSource = () => {
    setLinkSources([...linkSources, { url: '', resolution: '720p' }]);
  };

  const removeLinkSource = (index: number) => {
    if (linkSources.length > 1) {
      setLinkSources(linkSources.filter((_, i) => i !== index));
    }
  };

  const updateLinkSource = (index: number, field: keyof LinkSource, value: string) => {
    const updated = [...linkSources];
    updated[index][field] = value;
    setLinkSources(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (activeTab === 'file') {
        if (!selectedFile) {
          throw new Error('Please select a video file');
        }

        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('enableEncoding', enableEncoding ? 'true' : 'false');

        const response = await fetch(`${API_URL}/api/videos/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        // Navigate based on encoding option
        if (enableEncoding) {
          navigate('/dashboard/encoding');
        } else {
          navigate('/dashboard/videos');
        }
      } else {
        // Link upload
        const validSources = linkSources.filter(s => s.url.trim());
        
        if (validSources.length === 0) {
          throw new Error('Please add at least one video source');
        }

        const response = await fetch(`${API_URL}/api/videos/link`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            description,
            thumbnail,
            sources: validSources
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add video');
        }

        navigate('/dashboard/videos');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="page-header">
        <h1 className="page-title">Upload Video</h1>
      </div>

      {/* Tabs */}
      <div className="upload-tabs">
        <button
          className={`upload-tab ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20, marginRight: 8 }}>
            <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
          </svg>
          Upload File
        </button>
        <button
          className={`upload-tab ${activeTab === 'link' ? 'active' : ''}`}
          onClick={() => setActiveTab('link')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20, marginRight: 8 }}>
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
          </svg>
          Add by Link
        </button>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 24 }}>
          {error}
        </div>
      )}

      <form className="upload-form" onSubmit={handleSubmit}>
        {/* File Upload Section */}
        {activeTab === 'file' && (
          <div className="form-section">
            <div className="form-section-title">Video File</div>
            
            {!selectedFile ? (
              <div
                className={`file-dropzone ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="file-dropzone-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
                </svg>
                <h3>Drop your video here</h3>
                <p>or click to browse</p>
                <div className="file-dropzone-info">
                  Supported formats: MP4, MKV, AVI, MOV, WebM • Max 5GB
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div className="file-selected">
                <div className="file-selected-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
                  </svg>
                </div>
                <div className="file-selected-info">
                  <div className="file-selected-name">{selectedFile.name}</div>
                  <div className="file-selected-size">{formatFileSize(selectedFile.size)}</div>
                </div>
                <button
                  type="button"
                  className="file-selected-remove"
                  onClick={handleRemoveFile}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                  </svg>
                </button>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <label className="checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableEncoding}
                  onChange={(e) => setEnableEncoding(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Enable encoding to multiple resolutions (1080p, 720p, 480p, 360p)
                </span>
              </label>
              <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 30 }}>
                {enableEncoding 
                  ? '📝 The video will be automatically encoded to multiple resolutions based on the source quality. This may take some time.'
                  : '⚡ The video will be saved in its original resolution without encoding. Upload will be faster.'}
              </p>
            </div>
          </div>
        )}

        {/* Link Upload Section */}
        {activeTab === 'link' && (
          <div className="form-section">
            <div className="form-section-title">Video Sources</div>
            
            <div className="link-sources">
              {linkSources.map((source, index) => (
                <div key={index} className="link-source-item">
                  <span className="link-source-number">{index + 1}</span>
                  <div className="link-source-fields">
                    <div className="link-source-row">
                      <div className="form-group">
                        <label>Video URL</label>
                        <input
                          type="url"
                          className="form-input"
                          placeholder="https://example.com/video.mp4"
                          value={source.url}
                          onChange={(e) => updateLinkSource(index, 'url', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Resolution</label>
                        <select
                          className="form-select"
                          value={source.resolution}
                          onChange={(e) => updateLinkSource(index, 'resolution', e.target.value)}
                        >
                          {RESOLUTIONS.map((res) => (
                            <option key={res} value={res}>{res}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {linkSources.length > 1 && (
                    <button
                      type="button"
                      className="link-source-remove"
                      onClick={() => removeLinkSource(index)}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="add-source-btn"
                onClick={addLinkSource}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                Add Another Resolution
              </button>
            </div>
          </div>
        )}

        {/* Video Details */}
        <div className="form-section">
          <div className="form-section-title">Video Details</div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter video title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-textarea"
                placeholder="Enter video description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {activeTab === 'link' && (
            <div className="form-row">
              <div className="form-group">
                <label>Thumbnail URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/thumbnail.jpg"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="form-section" style={{ marginTop: 32 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !title || (activeTab === 'file' && !selectedFile)}
            style={{ width: '100%', padding: 16 }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
                {activeTab === 'file' ? 'Uploading...' : 'Adding...'}
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}>
                  {activeTab === 'file' ? (
                    <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
                  ) : (
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  )}
                </svg>
                {activeTab === 'file' 
                  ? (enableEncoding ? 'Upload & Start Encoding' : 'Upload Video (No Encoding)')
                  : 'Add Video'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

