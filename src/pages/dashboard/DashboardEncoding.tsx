import { useState, useEffect } from 'react';
import { EncodingJob } from '../../types';
import { API_URL } from '../../config';

const formatTime = (seconds?: number): string => {
  if (!seconds) return '--:--';
  
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

const formatDate = (dateString?: string): string => {
  if (!dateString) return '--';
  return new Date(dateString).toLocaleString();
};

export default function DashboardEncoding() {
  const [jobs, setJobs] = useState<EncodingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingJobs, setCancellingJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchJobs();
    
    // Poll for updates every 3 seconds
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_URL}/api/encoding/jobs`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Error fetching encoding jobs:', response.status);
        setJobs([]);
        return;
      }
      
      const data = await response.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching encoding jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this encoding job? The video and all files will be deleted.')) {
      return;
    }

    setCancellingJobs(prev => new Set(prev).add(jobId));

    try {
      const response = await fetch(`${API_URL}/api/encoding/jobs/${jobId}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to cancel encoding job');
        return;
      }

      // Refresh jobs list
      await fetchJobs();
    } catch (error) {
      console.error('Error cancelling encoding job:', error);
      alert('Failed to cancel encoding job');
    } finally {
      setCancellingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
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
        <h1 className="page-title">Encoding Jobs</h1>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <h3>No encoding jobs</h3>
          <p>Upload a video to start encoding</p>
        </div>
      ) : (
        <div className="encoding-jobs">
          {jobs.map((job) => (
            <div key={job.id} className="encoding-job-card">
              <div className="encoding-job-header">
                <h3 className="encoding-job-title">{job.video_title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`encoding-job-status ${job.status}`}>
                    {job.status}
                  </span>
                  {(job.status === 'pending' || job.status === 'encoding') && (
                    <button
                      className="cancel-btn"
                      onClick={() => handleCancelJob(job.id)}
                      disabled={cancellingJobs.has(job.id)}
                      title="Cancel encoding and delete video"
                    >
                      {cancellingJobs.has(job.id) ? (
                        <span className="cancel-spinner"></span>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                          </svg>
                          Cancel
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {(job.status === 'pending' || job.status === 'encoding') && (
                <div className="encoding-job-progress">
                  <div className="encoding-progress-bar">
                    <div
                      className="encoding-progress-fill"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <div className="encoding-progress-text">
                    <span>{Math.round(job.progress)}%</span>
                    {job.estimated_time_remaining ? (
                      <span>~{formatTime(job.estimated_time_remaining)} remaining</span>
                    ) : (
                      <span>Calculating...</span>
                    )}
                  </div>
                </div>
              )}

              <div className="encoding-job-details">
                <div className="encoding-detail-item">
                  <span className="encoding-detail-label">Job ID</span>
                  <span className="encoding-detail-value" style={{ fontFamily: 'JetBrains Mono' }}>
                    {job.id}
                  </span>
                </div>

                {job.current_resolution && (
                  <div className="encoding-detail-item">
                    <span className="encoding-detail-label">Current</span>
                    <span className="encoding-detail-value">{job.current_resolution}</span>
                  </div>
                )}

                <div className="encoding-detail-item">
                  <span className="encoding-detail-label">Started</span>
                  <span className="encoding-detail-value">{formatDate(job.started_at)}</span>
                </div>

                {job.completed_at && (
                  <div className="encoding-detail-item">
                    <span className="encoding-detail-label">Completed</span>
                    <span className="encoding-detail-value">{formatDate(job.completed_at)}</span>
                  </div>
                )}

                <div className="encoding-detail-item" style={{ flexBasis: '100%' }}>
                  <span className="encoding-detail-label">Resolutions</span>
                  <div className="resolutions-list" style={{ marginTop: 8 }}>
                    {job.resolutions_completed.map((res) => (
                      <span key={res} className="resolution-tag completed">
                        ✓ {res}
                      </span>
                    ))}
                    {job.current_resolution && (
                      <span className="resolution-tag current">
                        ⟳ {job.current_resolution}
                      </span>
                    )}
                    {job.resolutions_pending
                      .filter(res => res !== job.current_resolution)
                      .map((res) => (
                        <span key={res} className="resolution-tag">
                          {res}
                        </span>
                      ))}
                  </div>
                </div>

                {job.error && (
                  <div className="encoding-detail-item" style={{ flexBasis: '100%' }}>
                    <span className="encoding-detail-label" style={{ color: 'var(--danger)' }}>Error</span>
                    <span className="encoding-detail-value" style={{ color: 'var(--danger)' }}>
                      {job.error}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
