import { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Video, VideoSource, PlayerSettings } from '../../types';
import { API_URL } from '../../config';
import ContextMenu from './ContextMenu';
import SettingsPanel from './SettingsPanel';
import ShortcutsModal from './ShortcutsModal';
import VideoInfo from './VideoInfo';
import './VideoPlayer.css';

interface VideoPlayerProps {
  video: Video;
}

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const sortResolutions = (sources: VideoSource[]): VideoSource[] => {
  const order = ['auto', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
  return [...sources].sort((a, b) => {
    const indexA = order.indexOf(a.resolution);
    const indexB = order.indexOf(b.resolution);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
};

export default function VideoPlayer({ video }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<number | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const holdSpeedTimeoutRef = useRef<number | null>(null);
  const originalSpeedRef = useRef<number>(1);
  const justReleasedSpeedBoostRef = useRef<boolean>(false);
  const isSpaceHeldRef = useRef<boolean>(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [currentQualityLabel, setCurrentQualityLabel] = useState('Auto');
  
  // Speed boost state (hold for 2x)
  const [isSpeedBoosted, setIsSpeedBoosted] = useState(false);
  const [isHoldingClick, setIsHoldingClick] = useState(false);
  
  // Seek indicator state
  const [seekIndicator, setSeekIndicator] = useState<{ direction: 'forward' | 'backward'; seconds: number } | null>(null);
  const seekIndicatorTimeoutRef = useRef<number | null>(null);
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  // Panels
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showVideoInfo, setShowVideoInfo] = useState(false);
  
  // Settings
  const [settings, setSettings] = useState<PlayerSettings>({
    playbackSpeed: 1,
    quality: 'auto',
    subtitleId: null,
    volume: 1,
    muted: false
  });
  
  const sortedSources = sortResolutions(video.sources);
  const [currentSource, setCurrentSource] = useState<VideoSource | null>(
    sortedSources.find(s => s.resolution === 'auto') || sortedSources[0] || null
  );

  // Check if source is HLS
  const isHLS = (url: string) => url.endsWith('.m3u8');

  // Build video URL
  const getVideoUrl = useCallback((source: VideoSource): string => {
    if (source.is_local) {
      return `${API_URL}${source.url}`;
    }
    return source.url;
  }, []);

  // Initialize HLS or native playback
  useEffect(() => {
    if (!videoRef.current || !currentSource) return;

    const videoUrl = getVideoUrl(currentSource);
    const video = videoRef.current;

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHLS(videoUrl)) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startLevel: settings.quality === 'auto' ? -1 : getQualityLevel(settings.quality),
        });

        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (settings.quality === 'auto') {
            hls.currentLevel = -1; // Auto quality
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const level = hls.levels[data.level];
          if (level) {
            const height = level.height;
            setCurrentQualityLabel(settings.quality === 'auto' ? `Auto (${height}p)` : `${height}p`);
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error('HLS Fatal Error:', data);
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        video.src = videoUrl;
      }
    } else {
      // Regular video file
      video.src = videoUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSource, getVideoUrl]);

  // Get quality level for HLS
  const getQualityLevel = (quality: string): number => {
    if (!hlsRef.current || quality === 'auto') return -1;
    
    const levels = hlsRef.current.levels;
    const height = parseInt(quality.replace('p', ''));
    
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].height === height) return i;
    }
    return -1;
  };

  // Initialize with auto quality
  useEffect(() => {
    if (sortedSources.length > 0) {
      const autoSource = sortedSources.find(s => s.resolution === 'auto');
      const bestSource = autoSource || sortedSources[0];
      setCurrentSource(bestSource);
      setSettings(prev => ({ ...prev, quality: bestSource.resolution }));
    }
  }, [video.sources]);

  // Play/Pause
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying]);

  // Seek with indicator
  const seekWithIndicator = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
      
      // Show seek indicator
      setSeekIndicator({
        direction: seconds > 0 ? 'forward' : 'backward',
        seconds: Math.abs(seconds)
      });
      
      // Clear previous timeout
      if (seekIndicatorTimeoutRef.current) {
        clearTimeout(seekIndicatorTimeoutRef.current);
      }
      
      // Hide indicator after animation
      seekIndicatorTimeoutRef.current = window.setTimeout(() => {
        setSeekIndicator(null);
      }, 800);
    }
  }, [duration]);

  // Volume
  const setVolume = useCallback((value: number) => {
    if (videoRef.current) {
      const vol = Math.max(0, Math.min(1, value));
      videoRef.current.volume = vol;
      setSettings(prev => ({ ...prev, volume: vol, muted: vol === 0 }));
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setSettings(prev => ({ ...prev, muted: !prev.muted }));
    }
  }, []);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Speed boost functions
  const startSpeedBoost = useCallback(() => {
    if (videoRef.current && !isSpeedBoosted) {
      originalSpeedRef.current = videoRef.current.playbackRate;
      videoRef.current.playbackRate = 2;
      setIsSpeedBoosted(true);
      
      // Auto-play if paused
      if (videoRef.current.paused) {
        videoRef.current.play();
      }
    }
  }, [isSpeedBoosted]);

  const stopSpeedBoost = useCallback(() => {
    if (videoRef.current && isSpeedBoosted) {
      videoRef.current.playbackRate = originalSpeedRef.current;
      setIsSpeedBoosted(false);
      // Set flag to prevent click/toggle play immediately after release
      justReleasedSpeedBoostRef.current = true;
      // Clear flag after a short delay
      setTimeout(() => {
        justReleasedSpeedBoostRef.current = false;
      }, 300);
    }
  }, [isSpeedBoosted]);

  // Handle video area mouse events for hold-to-speed
  const handleVideoAreaMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't trigger if clicking on controls or other UI elements
    const target = e.target as HTMLElement;
    if (target.closest('.controls-bottom') || 
        target.closest('.controls-top') ||
        target.closest('.settings-panel') ||
        target.closest('.context-menu') ||
        target.closest('.big-play-button') ||
        target.closest('.control-btn')) {
      return;
    }
    
    // Only left click
    if (e.button !== 0) return;
    
    setIsHoldingClick(true);
    
    // Start speed boost after a short delay (to distinguish from click)
    holdSpeedTimeoutRef.current = window.setTimeout(() => {
      startSpeedBoost();
    }, 200);
  }, [startSpeedBoost]);

  const handleVideoAreaMouseUp = useCallback((e: React.MouseEvent) => {
    // Clear hold timeout
    if (holdSpeedTimeoutRef.current) {
      clearTimeout(holdSpeedTimeoutRef.current);
      holdSpeedTimeoutRef.current = null;
    }
    
    // Stop speed boost (but don't pause video - only stop speed boost)
    if (isSpeedBoosted) {
      stopSpeedBoost();
      // Don't pause - video continues playing at normal speed
    }
    
    setIsHoldingClick(false);
  }, [isSpeedBoosted, stopSpeedBoost]);

  const handleVideoAreaMouseLeave = useCallback(() => {
    // Clear hold timeout
    if (holdSpeedTimeoutRef.current) {
      clearTimeout(holdSpeedTimeoutRef.current);
      holdSpeedTimeoutRef.current = null;
    }
    
    // Stop speed boost if active (but don't pause video)
    if (isSpeedBoosted) {
      stopSpeedBoost();
      // Don't pause - video continues playing at normal speed
    }
    
    setIsHoldingClick(false);
  }, [isSpeedBoosted, stopSpeedBoost]);

  // Handle video area click (single click = play/pause, double click = fullscreen)
  const handleVideoAreaClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger if speed boost is currently active or just released
    if (isSpeedBoosted || justReleasedSpeedBoostRef.current) {
      // This was a hold that activated speed boost - don't toggle play
      return;
    }
    
    // Don't trigger if clicking on controls or other UI elements
    const target = e.target as HTMLElement;
    if (target.closest('.controls-bottom') || 
        target.closest('.controls-top') ||
        target.closest('.settings-panel') ||
        target.closest('.context-menu') ||
        target.closest('.big-play-button') ||
        target.closest('.control-btn')) {
      return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    
    if (clickTimeoutRef.current) {
      // Double click detected
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      toggleFullscreen();
    } else {
      // Wait to see if it's a double click
      clickTimeoutRef.current = window.setTimeout(() => {
        clickTimeoutRef.current = null;
        // Check again before toggling play
        if (!justReleasedSpeedBoostRef.current) {
          togglePlay();
        }
      }, 200);
    }
  }, [togglePlay, toggleFullscreen, isSpeedBoosted]);

  // Speed
  const setPlaybackSpeed = useCallback((speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      originalSpeedRef.current = speed;
      setSettings(prev => ({ ...prev, playbackSpeed: speed }));
    }
  }, []);

  // Quality change
  const changeQuality = useCallback((resolution: string) => {
    if (!videoRef.current) return;
    
    const currentTime = videoRef.current.currentTime;
    const wasPlaying = !videoRef.current.paused;
    
    setSettings(prev => ({ ...prev, quality: resolution }));

    if (hlsRef.current) {
      // HLS quality change
      if (resolution === 'auto') {
        hlsRef.current.currentLevel = -1;
        setCurrentQualityLabel('Auto');
      } else {
        const level = getQualityLevel(resolution);
        if (level !== -1) {
          hlsRef.current.currentLevel = level;
          setCurrentQualityLabel(resolution);
        }
      }
    } else {
      // Non-HLS: change source
      const source = sortedSources.find(s => s.resolution === resolution);
      if (source) {
        setCurrentSource(source);
        setCurrentQualityLabel(resolution);
        
        // Restore position after source change
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current!.currentTime = currentTime;
          if (wasPlaying) {
            videoRef.current!.play();
          }
        }, { once: true });
      }
    }
  }, [sortedSources]);

  // Subtitle change
  const changeSubtitle = useCallback((subtitleId: number | null) => {
    setSettings(prev => ({ ...prev, subtitleId }));
    
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'disabled';
      }
      
      if (subtitleId !== null) {
        const trackIndex = video.subtitles.findIndex(s => s.id === subtitleId);
        if (trackIndex !== -1 && tracks[trackIndex]) {
          tracks[trackIndex].mode = 'showing';
        }
      }
    }
  }, [video.subtitles]);

  // Update subtitle positioning based on controls visibility
  useEffect(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const container = containerRef.current;
    
    // Apply subtitle positioning based on showControls
    const updateSubtitlePosition = () => {
      // Force CSS to reapply by toggling a class or triggering reflow
      if (container) {
        // Add a data attribute to help with CSS targeting
        if (showControls) {
          container.setAttribute('data-controls-visible', 'true');
        } else {
          container.setAttribute('data-controls-visible', 'false');
        }
        
        // Force a reflow to ensure CSS is applied
        void container.offsetHeight;
      }
    };
    
    // Update when controls visibility changes
    updateSubtitlePosition();
    
    // Also update on a small delay to ensure DOM is ready
    const timeout = setTimeout(updateSubtitlePosition, 50);
    
    return () => clearTimeout(timeout);
  }, [showControls]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Handle space hold for speed boost
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        
        // Reset flag
        isSpaceHeldRef.current = false;
        
        // Start hold timer for speed boost
        holdSpeedTimeoutRef.current = window.setTimeout(() => {
          startSpeedBoost();
          isSpaceHeldRef.current = true;
        }, 200);
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
          e.preventDefault();
          seekWithIndicator(-10);
          break;
        case 'l':
          e.preventDefault();
          seekWithIndicator(10);
          break;
        case 'arrowleft':
          e.preventDefault();
          seekWithIndicator(-5);
          break;
        case 'arrowright':
          e.preventDefault();
          seekWithIndicator(5);
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(settings.volume + 0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(settings.volume - 0.1);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = (parseInt(e.key) / 10) * duration;
          }
          break;
        case 'home':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
          }
          break;
        case 'end':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = duration;
          }
          break;
        case ',':
          e.preventDefault();
          const prevSpeed = Math.max(0.25, settings.playbackSpeed - 0.25);
          setPlaybackSpeed(prevSpeed);
          break;
        case '.':
          e.preventDefault();
          const nextSpeed = Math.min(3, settings.playbackSpeed + 0.25);
          setPlaybackSpeed(nextSpeed);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        
        // Clear hold timer
        if (holdSpeedTimeoutRef.current) {
          clearTimeout(holdSpeedTimeoutRef.current);
          holdSpeedTimeoutRef.current = null;
        }
        
        // If was holding for speed boost, stop it (but don't pause video)
        if (isSpaceHeldRef.current || isSpeedBoosted) {
          stopSpeedBoost();
          isSpaceHeldRef.current = false;
          // Don't toggle play - video continues at normal speed
          return; // Important: return early to prevent toggle play
        }
        
        // Check if we just released speed boost
        if (justReleasedSpeedBoostRef.current) {
          // Don't toggle play if we just released speed boost
          return;
        }
        
        // Normal space press (quick press, not hold) - toggle play
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [togglePlay, seekWithIndicator, setVolume, toggleMute, toggleFullscreen, setPlaybackSpeed, startSpeedBoost, stopSpeedBoost, settings.volume, settings.playbackSpeed, duration]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('loadedmetadata', handleDurationChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('loadedmetadata', handleDurationChange);
    };
  }, []);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    
    if (isPlaying) {
      hideControlsTimer.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [isPlaying, resetHideTimer]);

  // Progress bar interactions
  const handleProgressClick = (e: React.MouseEvent) => {
    if (!progressRef.current || !videoRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * duration;
  };

  const handleProgressHover = (e: React.MouseEvent) => {
    if (!progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;
    
    setPreviewTime(time);
    setPreviewPosition(e.clientX - rect.left);
  };

  const handleProgressLeave = () => {
    setPreviewTime(null);
  };

  // Context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Handle container click to close menus
  const handleContainerClick = (e: React.MouseEvent) => {
    // Only close menus if clicking directly on the container, not on child elements
    if (e.target === e.currentTarget) {
      closeContextMenu();
      setShowSettings(false);
    }
  };

  // Get display quality for UI
  const getDisplayQuality = () => {
    if (settings.quality === 'auto') {
      return currentQualityLabel;
    }
    return settings.quality;
  };

  return (
    <div
      ref={containerRef}
      className={`video-player ${isFullscreen ? 'fullscreen' : ''} ${showControls ? 'show-controls' : ''}`}
      onMouseMove={resetHideTimer}
      onContextMenu={handleContextMenu}
      onClick={handleContainerClick}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="video-element"
        playsInline
      >
        {/* Subtitles */}
        {video.subtitles.map((subtitle) => (
          <track
            key={subtitle.id}
            kind="subtitles"
            label={subtitle.label}
            srcLang={subtitle.language}
            src={subtitle.url}
            default={subtitle.is_default}
          />
        ))}
      </video>

      {/* Click Area for Play/Pause and Hold-to-Speed */}
      <div 
        className="video-click-area"
        onClick={handleVideoAreaClick}
        onMouseDown={handleVideoAreaMouseDown}
        onMouseUp={handleVideoAreaMouseUp}
        onMouseLeave={handleVideoAreaMouseLeave}
      />

      {/* Speed Boost Indicator */}
      {isSpeedBoosted && (
        <div className="speed-boost-indicator">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
          </svg>
          <span>2x Speed</span>
        </div>
      )}

      {/* Seek Indicator - Backward */}
      {seekIndicator && seekIndicator.direction === 'backward' && (
        <div className="seek-indicator seek-indicator-left">
          <div className="seek-indicator-content">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
            </svg>
            <span>{seekIndicator.seconds}s</span>
          </div>
        </div>
      )}

      {/* Seek Indicator - Forward */}
      {seekIndicator && seekIndicator.direction === 'forward' && (
        <div className="seek-indicator seek-indicator-right">
          <div className="seek-indicator-content">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
            </svg>
            <span>{seekIndicator.seconds}s</span>
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {!duration && (
        <div className="player-loading">
          <div className="player-spinner"></div>
        </div>
      )}

      {/* Big Play Button (shown when paused) */}
      {!isPlaying && duration > 0 && !isSpeedBoosted && (
        <button className="big-play-button" onClick={togglePlay}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Controls Overlay */}
      <div className={`controls-overlay ${showControls ? 'visible' : ''}`}>
        {/* Top Gradient */}
        <div className="controls-gradient-top"></div>

        {/* Top Bar */}
        <div className="controls-top">
          <h2 className="video-title">{video.title}</h2>
        </div>

        {/* Bottom Controls */}
        <div className="controls-bottom">
          {/* Progress Bar */}
          <div
            ref={progressRef}
            className="progress-container"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseLeave={handleProgressLeave}
          >
            {/* Buffered */}
            <div
              className="progress-buffered"
              style={{ width: `${(buffered / duration) * 100}%` }}
            ></div>
            
            {/* Played */}
            <div
              className="progress-played"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
            
            {/* Scrubber */}
            <div
              className="progress-scrubber"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            ></div>

            {/* Preview Tooltip */}
            {previewTime !== null && (
              <div
                ref={previewRef}
                className="progress-preview"
                style={{ left: `${previewPosition}px` }}
              >
                <span className="preview-time">{formatTime(previewTime)}</span>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="controls-bar">
            <div className="controls-left">
              {/* Play/Pause */}
              <button className="control-btn" onClick={togglePlay} title={isPlaying ? 'Pause (K)' : 'Play (K)'}>
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Skip Backward */}
              <button className="control-btn" onClick={() => seekWithIndicator(-10)} title="Rewind 10s (J)">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                </svg>
                <span className="btn-label">10</span>
              </button>

              {/* Skip Forward */}
              <button className="control-btn" onClick={() => seekWithIndicator(10)} title="Forward 10s (L)">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                </svg>
                <span className="btn-label">10</span>
              </button>

              {/* Volume */}
              <div className="volume-control">
                <button className="control-btn" onClick={toggleMute} title={settings.muted ? 'Unmute (M)' : 'Mute (M)'}>
                  {settings.muted || settings.volume === 0 ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : settings.volume < 0.5 ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.muted ? 0 : settings.volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="volume-slider"
                />
              </div>

              {/* Time Display */}
              <div className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className="controls-right">
              {/* Quality Badge */}
              <div className="quality-badge" onClick={() => setShowSettings(true)}>
                {getDisplayQuality()}
              </div>

              {/* Settings Button */}
              <button
                className="control-btn"
                onClick={() => setShowSettings(!showSettings)}
                title="Settings"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </button>

              {/* Fullscreen Button */}
              <button className="control-btn" onClick={toggleFullscreen} title="Fullscreen (F)">
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Gradient */}
        <div className="controls-gradient-bottom"></div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          sources={sortedSources}
          subtitles={video.subtitles}
          onSpeedChange={setPlaybackSpeed}
          onQualityChange={changeQuality}
          onSubtitleChange={changeSubtitle}
          onShowShortcuts={() => {
            setShowSettings(false);
            setShowShortcuts(true);
          }}
          onShowVideoInfo={() => {
            setShowSettings(false);
            setShowVideoInfo(true);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* Video Info Modal */}
      {showVideoInfo && (
        <VideoInfo 
          video={video} 
          currentQuality={getDisplayQuality()}
          onClose={() => setShowVideoInfo(false)} 
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isPlaying={isPlaying}
          isMuted={settings.muted}
          isFullscreen={isFullscreen}
          currentSpeed={settings.playbackSpeed}
          onPlay={togglePlay}
          onMute={toggleMute}
          onFullscreen={toggleFullscreen}
          onSpeedChange={setPlaybackSpeed}
          onShowShortcuts={() => {
            setContextMenu(null);
            setShowShortcuts(true);
          }}
          onShowVideoInfo={() => {
            setContextMenu(null);
            setShowVideoInfo(true);
          }}
          onCopyUrl={() => {
            navigator.clipboard.writeText(window.location.href);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
