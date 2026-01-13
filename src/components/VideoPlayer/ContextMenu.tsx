import { useEffect, useRef, useState } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  currentSpeed: number;
  onPlay: () => void;
  onMute: () => void;
  onFullscreen: () => void;
  onSpeedChange: (speed: number) => void;
  onShowShortcuts: () => void;
  onShowVideoInfo: () => void;
  onCopyUrl: () => void;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export default function ContextMenu({
  x,
  y,
  isPlaying,
  isMuted,
  isFullscreen,
  currentSpeed,
  onPlay,
  onMute,
  onFullscreen,
  onSpeedChange,
  onShowShortcuts,
  onShowVideoInfo,
  onCopyUrl,
  onClose
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [position, setPosition] = useState({ x, y });
  const [submenuPosition, setSubmenuPosition] = useState<'right' | 'left'>('right');

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const newX = x + rect.width > window.innerWidth ? x - rect.width : x;
      const newY = y + rect.height > window.innerHeight ? y - rect.height : y;
      setPosition({ x: newX, y: newY });
      
      // Determine submenu position
      const submenuWidth = 140;
      if (newX + rect.width + submenuWidth > window.innerWidth) {
        setSubmenuPosition('left');
      } else {
        setSubmenuPosition('right');
      }
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleItemClick = (callback: () => void) => {
    callback();
    onClose();
  };

  const handleSpeedClick = (e: React.MouseEvent, speed: number) => {
    e.stopPropagation();
    e.preventDefault();
    onSpeedChange(speed);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Play/Pause */}
      <div className="context-menu-item" onClick={() => handleItemClick(onPlay)}>
        {isPlaying ? (
          <>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            <span>Pause</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Play</span>
          </>
        )}
      </div>

      {/* Mute/Unmute */}
      <div className="context-menu-item" onClick={() => handleItemClick(onMute)}>
        {isMuted ? (
          <>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
            <span>Unmute</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
            <span>Mute</span>
          </>
        )}
      </div>

      <div className="context-menu-divider"></div>

      {/* Playback Speed - Click to toggle submenu */}
      <div
        className={`context-menu-item has-submenu ${showSpeedMenu ? 'submenu-open' : ''}`}
        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 8v8l6-4-6-4z" />
        </svg>
        <span>Speed ({currentSpeed === 1 ? 'Normal' : `${currentSpeed}x`})</span>
        <svg viewBox="0 0 24 24" fill="currentColor" className="submenu-arrow">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
        </svg>

        {/* Speed Submenu */}
        {showSpeedMenu && (
          <div 
            className={`context-submenu ${submenuPosition}`}
            onClick={(e) => e.stopPropagation()}
          >
            {SPEED_OPTIONS.map((speed) => (
              <div
                key={speed}
                className={`context-submenu-item ${currentSpeed === speed ? 'active' : ''}`}
                onClick={(e) => handleSpeedClick(e, speed)}
              >
                <span>{speed === 1 ? 'Normal' : `${speed}x`}</span>
                {currentSpeed === speed && (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="check-icon">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen */}
      <div className="context-menu-item" onClick={() => handleItemClick(onFullscreen)}>
        {isFullscreen ? (
          <>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
            </svg>
            <span>Exit Fullscreen</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
            <span>Fullscreen</span>
          </>
        )}
      </div>

      <div className="context-menu-divider"></div>

      {/* About This Video */}
      <div className="context-menu-item" onClick={() => handleItemClick(onShowVideoInfo)}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
        <span>About This Video</span>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="context-menu-item" onClick={() => handleItemClick(onShowShortcuts)}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
        </svg>
        <span>Keyboard Shortcuts</span>
      </div>

      {/* Copy URL */}
      <div className="context-menu-item" onClick={() => handleItemClick(onCopyUrl)}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
        </svg>
        <span>Copy Video URL</span>
      </div>

      <div className="context-menu-divider"></div>

      {/* Footer */}
      <div className="context-menu-footer">
        Powered by <span>AnisuPlayer</span>
      </div>
    </div>
  );
}
