import { useState } from 'react';
import type { VideoSource, Subtitle, PlayerSettings } from '../../types';

interface SettingsPanelProps {
  settings: PlayerSettings;
  sources: VideoSource[];
  subtitles: Subtitle[];
  onSpeedChange: (speed: number) => void;
  onQualityChange: (quality: string) => void;
  onSubtitleChange: (subtitleId: number | null) => void;
  onShowShortcuts: () => void;
  onShowVideoInfo: () => void;
  onClose: () => void;
}

type SettingsView = 'main' | 'speed' | 'quality' | 'subtitles';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export default function SettingsPanel({
  settings,
  sources,
  subtitles,
  onSpeedChange,
  onQualityChange,
  onSubtitleChange,
  onShowShortcuts,
  onShowVideoInfo,
  onClose
}: SettingsPanelProps) {
  const [currentView, setCurrentView] = useState<SettingsView>('main');

  const renderHeader = () => {
    if (currentView === 'main') {
      return (
        <div className="settings-header">
          <span style={{ fontWeight: 500 }}>Settings</span>
          <button className="settings-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>
      );
    }

    const titles: Record<SettingsView, string> = {
      main: 'Settings',
      speed: 'Playback Speed',
      quality: 'Quality',
      subtitles: 'Subtitles'
    };

    return (
      <div className="settings-header">
        <button className="settings-back-btn" onClick={() => setCurrentView('main')}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <span>{titles[currentView]}</span>
        </button>
        <button className="settings-close-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
          </svg>
        </button>
      </div>
    );
  };

  const renderMainMenu = () => (
    <div className="settings-menu">
      {/* Video Info */}
      <div className="settings-item" onClick={onShowVideoInfo}>
        <div className="settings-item-left">
          <svg className="settings-item-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <span className="settings-item-label">Video Info</span>
        </div>
        <span className="settings-item-value">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </span>
      </div>

      {/* Playback Speed */}
      <div className="settings-item" onClick={() => setCurrentView('speed')}>
        <div className="settings-item-left">
          <svg className="settings-item-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 8v8l6-4-6-4zM6.3 5L5 6.3l2.77 2.77c-.17.32-.32.65-.44.99H5v2h2.06c.46 2.28 2.48 4 4.94 4 .84 0 1.63-.21 2.33-.57L17.7 19l1.3-1.3-12.7-12.7z" />
          </svg>
          <span className="settings-item-label">Speed</span>
        </div>
        <span className="settings-item-value">
          {settings.playbackSpeed === 1 ? 'Normal' : `${settings.playbackSpeed}x`}
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </span>
      </div>

      {/* Quality */}
      <div className="settings-item" onClick={() => setCurrentView('quality')}>
        <div className="settings-item-left">
          <svg className="settings-item-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm7-1c0 .55-.45 1-1 1h-.75v1.5h-1.5V15H14c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v4zm-3.5-.5h2v-3h-2v3z" />
          </svg>
          <span className="settings-item-label">Quality</span>
        </div>
        <span className="settings-item-value">
          {settings.quality}
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </span>
      </div>

      {/* Subtitles */}
      {subtitles.length > 0 && (
        <div className="settings-item" onClick={() => setCurrentView('subtitles')}>
          <div className="settings-item-left">
            <svg className="settings-item-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" />
            </svg>
            <span className="settings-item-label">Subtitles</span>
          </div>
          <span className="settings-item-value">
            {settings.subtitleId
              ? subtitles.find(s => s.id === settings.subtitleId)?.label || 'On'
              : 'Off'}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
            </svg>
          </span>
        </div>
      )}

      {/* Keyboard Shortcuts */}
      <div className="settings-item" onClick={onShowShortcuts}>
        <div className="settings-item-left">
          <svg className="settings-item-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
          </svg>
          <span className="settings-item-label">Keyboard Shortcuts</span>
        </div>
        <span className="settings-item-value">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </span>
      </div>
    </div>
  );

  const renderSpeedOptions = () => (
    <div className="settings-options">
      {SPEED_OPTIONS.map((speed) => (
        <div
          key={speed}
          className={`settings-option ${settings.playbackSpeed === speed ? 'active' : ''}`}
          onClick={() => {
            onSpeedChange(speed);
            setCurrentView('main');
          }}
        >
          <span className="settings-option-label">
            {speed === 1 ? 'Normal' : `${speed}x`}
          </span>
          {settings.playbackSpeed === speed && (
            <svg className="settings-option-check" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );

  const renderQualityOptions = () => {
    // Check if auto quality is available (HLS master playlist)
    const hasAuto = sources.some(s => s.resolution === 'auto');
    const qualitySources = sources.filter(s => s.resolution !== 'auto');
    
    return (
      <div className="settings-options">
        {/* Auto option */}
        {hasAuto && (
          <div
            className={`settings-option ${settings.quality === 'auto' ? 'active' : ''}`}
            onClick={() => {
              onQualityChange('auto');
              setCurrentView('main');
            }}
          >
            <span className="settings-option-label">
              Auto
              <span style={{ opacity: 0.6, marginLeft: 8, fontSize: '0.85em' }}>
                (Recommended)
              </span>
            </span>
            {settings.quality === 'auto' && (
              <svg className="settings-option-check" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
          </div>
        )}
        
        {/* Quality options */}
        {qualitySources.map((source) => (
          <div
            key={source.id}
            className={`settings-option ${settings.quality === source.resolution ? 'active' : ''}`}
            onClick={() => {
              onQualityChange(source.resolution);
              setCurrentView('main');
            }}
          >
            <span className="settings-option-label">{source.resolution}</span>
            {settings.quality === source.resolution && (
              <svg className="settings-option-check" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSubtitleOptions = () => (
    <div className="settings-options">
      <div
        className={`settings-option ${settings.subtitleId === null ? 'active' : ''}`}
        onClick={() => {
          onSubtitleChange(null);
          setCurrentView('main');
        }}
      >
        <span className="settings-option-label">Off</span>
        {settings.subtitleId === null && (
          <svg className="settings-option-check" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        )}
      </div>
      {subtitles.map((subtitle) => (
        <div
          key={subtitle.id}
          className={`settings-option ${settings.subtitleId === subtitle.id ? 'active' : ''}`}
          onClick={() => {
            onSubtitleChange(subtitle.id);
            setCurrentView('main');
          }}
        >
          <span className="settings-option-label">{subtitle.label}</span>
          {settings.subtitleId === subtitle.id && (
            <svg className="settings-option-check" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
      {renderHeader()}
      {currentView === 'main' && renderMainMenu()}
      {currentView === 'speed' && renderSpeedOptions()}
      {currentView === 'quality' && renderQualityOptions()}
      {currentView === 'subtitles' && renderSubtitleOptions()}
    </div>
  );
}

