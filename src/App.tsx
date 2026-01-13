import { Routes, Route } from 'react-router-dom'
import VideoPlayerPage from './pages/VideoPlayerPage'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import LoginPage from './pages/LoginPage'
import DashboardVideos from './pages/dashboard/DashboardVideos'
import DashboardUpload from './pages/dashboard/DashboardUpload'
import DashboardEncoding from './pages/dashboard/DashboardEncoding'
import DashboardEditVideo from './pages/dashboard/DashboardEditVideo'
import DashboardSettings from './pages/dashboard/DashboardSettings'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <Routes>
      {/* Public CDN route for video playback */}
      <Route path="/cdn/:id" element={<VideoPlayerPage />} />
      
      {/* Login page */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected Dashboard routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardVideos />} />
        <Route path="videos" element={<DashboardVideos />} />
        <Route path="videos/:id/edit" element={<DashboardEditVideo />} />
        <Route path="upload" element={<DashboardUpload />} />
        <Route path="encoding" element={<DashboardEncoding />} />
        <Route path="settings" element={<DashboardSettings />} />
      </Route>
      
      {/* Default redirect */}
      <Route path="/" element={<LoginPage />} />
      <Route path="*" element={<LoginPage />} />
    </Routes>
  )
}

export default App
