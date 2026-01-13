import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { API_URL } from '../../config';
import './Dashboard.css';

// Theme context
interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  toggleTheme: () => {}
});

// Search context
interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const SearchContext = createContext<SearchContextType>({
  searchQuery: '',
  setSearchQuery: () => {}
});

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setShowLogoutModal(false);
    navigate('/login');
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
        <div className={`dashboard-wrapper ${isDarkMode ? 'dark' : 'light'}`}>
          {/* Mobile Menu Toggle */}
          <button 
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              {isMobileMenuOpen ? (
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              ) : (
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              )}
            </svg>
          </button>

          {/* Sidebar */}
          <aside className={`dashboard-sidebar ${isMobileMenuOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            {/* Logo */}
            <div className="sidebar-header">
              <div className="sidebar-logo" title="AnisuPlayer">
                <div className="logo-icon-wrapper">
                  <img src="/img/anisu.png" alt="AnisuPlayer" className="logo-icon-img" />
                </div>
                <h1 className={`logo-text ${isSidebarCollapsed ? 'hidden' : ''}`}>AnisuPlayer</h1>
              </div>
              {!isSidebarCollapsed && (
                <button 
                  className="sidebar-collapse-btn"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  title="Collapse sidebar"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Expand button when collapsed */}
            {isSidebarCollapsed && (
              <button 
                className="sidebar-expand-btn"
                onClick={() => setIsSidebarCollapsed(false)}
                title="Expand sidebar"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
                </svg>
              </button>
            )}

            {/* Navigation */}
            <nav className="sidebar-nav">
              <NavLink 
                to="/dashboard/videos" 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
                title="Videos"
              >
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
                  </svg>
                </span>
                {!isSidebarCollapsed && <span className="nav-label">Videos</span>}
              </NavLink>

              <NavLink 
                to="/dashboard/upload" 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
                title="Upload"
              >
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
                  </svg>
                </span>
                {!isSidebarCollapsed && <span className="nav-label">Upload</span>}
              </NavLink>

              <NavLink 
                to="/dashboard/encoding" 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
                title="Encoding"
              >
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.66 7.93L12 2.27 6.34 7.93c-3.12 3.12-3.12 8.19 0 11.31C7.9 20.8 9.95 21.58 12 21.58c2.05 0 4.1-.78 5.66-2.34 3.12-3.12 3.12-8.19 0-11.31zM12 19.59c-1.6 0-3.11-.62-4.24-1.76C6.62 16.69 6 15.19 6 13.59s.62-3.11 1.76-4.24L12 5.1v14.49z" />
                  </svg>
                </span>
                {!isSidebarCollapsed && <span className="nav-label">Encoding</span>}
              </NavLink>

              <NavLink 
                to="/dashboard/settings" 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
                title="Settings"
              >
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                </span>
                {!isSidebarCollapsed && <span className="nav-label">Settings</span>}
              </NavLink>
            </nav>

            {/* User Profile */}
            <div className="sidebar-footer">
              <div className="user-profile" onClick={handleLogoutClick} title="Click to logout">
                <div className="user-avatar">
                  <img src="/img/anisu.png" alt="User" />
                </div>
                {!isSidebarCollapsed && (
                  <>
                    <div className="user-info">
                      <p className="user-name">Admin</p>
                      <p className="user-role">Content Creator</p>
                    </div>
                    <span className="user-menu-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                      </svg>
                    </span>
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* Overlay for mobile */}
          {isMobileMenuOpen && (
            <div 
              className="mobile-overlay"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Main Content */}
          <main className={`dashboard-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Header */}
            <header className="dashboard-header">
              {/* Search */}
              <div className="header-search">
                <span className="search-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                  </svg>
                </span>
                <input 
                  type="text" 
                  placeholder="Search videos..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Right Actions */}
              <div className="header-actions">
                {/* Theme Toggle */}
                <div className="theme-toggle">
                  <button 
                    className={`theme-btn ${!isDarkMode ? 'active' : ''}`}
                    onClick={() => setIsDarkMode(false)}
                    title="Light mode"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
                    </svg>
                  </button>
                  <button 
                    className={`theme-btn ${isDarkMode ? 'active' : ''}`}
                    onClick={() => setIsDarkMode(true)}
                    title="Dark mode"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </header>

            {/* Content Area */}
            <div className="dashboard-content">
              <Outlet />
            </div>
          </main>

          {/* Logout Confirmation Modal */}
          {showLogoutModal && (
            <div className="modal-overlay" onClick={handleLogoutCancel}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Confirm Logout</h3>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to log out?</p>
                </div>
                <div className="modal-actions">
                  <button className="btn-cancel" onClick={handleLogoutCancel}>
                    Cancel
                  </button>
                  <button className="btn-confirm" onClick={handleLogoutConfirm}>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SearchContext.Provider>
    </ThemeContext.Provider>
  );
}

// Custom hooks for consuming contexts
export const useTheme = () => useContext(ThemeContext);
export const useSearch = () => useContext(SearchContext);
