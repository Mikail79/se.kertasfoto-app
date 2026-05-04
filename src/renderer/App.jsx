import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './screens/Dashboard/Dashboard'
import TemplateEditor from './screens/TemplateEditor/TemplateEditor'
import CameraControl from './screens/CameraControl/CameraControl'
import SettingsPage from './screens/Settings/SettingsPage'
import AnalyticsPage from './screens/Analytics/AnalyticsPage'
import BoothMode from './screens/BoothMode/BoothMode'
import SplashWelcome from './components/SplashWelcome'
import { AppProvider, useApp } from './context/AppContext'

function AppLayout() {
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

export default function App() {
  return (
    <AppProvider>
      <SplashWelcome />
      <AppLayout />
    </AppProvider>
  )
}
