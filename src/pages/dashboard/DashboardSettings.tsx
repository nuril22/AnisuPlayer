import { useState } from 'react';
import { useTheme } from './DashboardLayout';

export default function DashboardSettings() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [defaultQuality, setDefaultQuality] = useState('auto');
  const [enableEncoding, setEnableEncoding] = useState(true);

  return (
    <div className="settings-page">
      <div className="page-header-modern">
        <div className="page-header-info">
          <h1 className="page-title-modern">Settings</h1>
          <p className="page-description">Configure your dashboard preferences</p>
        </div>
      </div>

      <div className="settings-sections">
        {/* Appearance Section */}
        <div className="settings-section">
          <h2 className="settings-section-title">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
            Appearance
          </h2>
          
          <div className="settings-option-row">
            <div className="settings-option-info">
              <h3>Theme</h3>
              <p>Choose between light and dark mode</p>
            </div>
            <div className="settings-option-control">
              <div className="theme-toggle-large">
                <button 
                  className={`theme-option ${!isDarkMode ? 'active' : ''}`}
                  onClick={() => !isDarkMode || toggleTheme()}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
                  </svg>
                  Light
                </button>
                <button 
                  className={`theme-option ${isDarkMode ? 'active' : ''}`}
                  onClick={() => isDarkMode || toggleTheme()}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z" />
                  </svg>
                  Dark
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Settings Section */}
        <div className="settings-section">
          <h2 className="settings-section-title">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
            </svg>
            Video Settings
          </h2>
          
          <div className="settings-option-row">
            <div className="settings-option-info">
              <h3>Default Quality</h3>
              <p>Choose the default video quality for playback</p>
            </div>
            <div className="settings-option-control">
              <select 
                className="settings-select"
                value={defaultQuality}
                onChange={(e) => setDefaultQuality(e.target.value)}
              >
                <option value="auto">Auto</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
                <option value="360p">360p</option>
              </select>
            </div>
          </div>

          <div className="settings-option-row">
            <div className="settings-option-info">
              <h3>Auto-encode uploads</h3>
              <p>Automatically encode uploaded videos to multiple resolutions</p>
            </div>
            <div className="settings-option-control">
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={enableEncoding}
                  onChange={(e) => setEnableEncoding(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="settings-section">
          <h2 className="settings-section-title">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            About
          </h2>
          
          <div className="about-info">
            <div className="about-logo">
              <img src="/img/anisu.png" alt="AnisuPlayer" />
            </div>
            <div className="about-details">
              <h3>AnisuPlayer</h3>
              <p>Modern Video Dashboard with Multi-Resolution Support</p>
              <p className="version">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

