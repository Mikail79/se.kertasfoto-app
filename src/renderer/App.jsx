import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './screens/Dashboard/Dashboard'
import TemplateEditor from './screens/TemplateEditor/TemplateEditor'
import CameraControl from './screens/CameraControl/CameraControl'
import SettingsPage from './screens/Settings/SettingsPage'
import BoothMode from './screens/BoothMode/BoothMode'
import { AppProvider, useApp } from './context/AppContext'

function AppLayout() {
  const { isBoothMode } = useApp()

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
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  )
}
