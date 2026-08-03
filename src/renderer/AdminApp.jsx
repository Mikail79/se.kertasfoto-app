import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './screens/Dashboard/Dashboard'
import TemplateEditor from './screens/TemplateEditor/TemplateEditor'
import CameraControl from './screens/CameraControl/CameraControl'
import SettingsPage from './screens/Settings/SettingsPage'
import AnalyticsPage from './screens/Analytics/AnalyticsPage'
import BoothMode from './screens/BoothMode/BoothMode'
import { useApp } from './context/AppContext'

/**
 * AdminApp — Dashboard, Sidebar, CameraControl, TemplateEditor, Settings,
 * Analytics, and (when a session is running) BoothMode.
 *
 * BoothMode remains the source of truth for session/template/phase state.
 * It broadcasts that state to the Client Window via `pushSessionState`
 * (see BoothMode.jsx) — it is NOT duplicated here.
 */
export default function AdminApp() {
  const { isBoothMode } = useApp()
  const navigate = useNavigate()

  // Listen for navigate-to custom events (from BoothMode exit)
  useEffect(() => {
    const handler = (e) => { if (e.detail) navigate(e.detail) }
    window.addEventListener('navigate-to', handler)
    return () => window.removeEventListener('navigate-to', handler)
  }, [navigate])

  if (isBoothMode) {
    return <BoothMode />
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/templates" element={<TemplateEditor />} />
          <Route path="/camera" element={<CameraControl />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  )
}
