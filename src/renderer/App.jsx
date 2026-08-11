import AdminApp from './AdminApp'
import ClientApp from './ClientApp'
import SplashWelcome from './components/SplashWelcome'
import { AppProvider } from './context/AppContext'

// The main process loads the SAME index.html for both windows, distinguished
// by a `?window=admin|client` query string (see src/main/main.js). We read it
// via location.search (NOT the hash — HashRouter already owns the hash for
// admin-side routing).
function getWindowRole() {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('window') === 'client' ? 'client' : 'admin'
  } catch {
    return 'admin'
  }
}

export default function App() {
  const windowRole = getWindowRole()

  if (windowRole === 'client') {
    // Client Window: no admin data, no dialogs/printer/Google Drive — just
    // the restricted `window.boothAPI` bridge from preload-client.js.
    return <ClientApp />
  }

  return (
    <AppProvider>
      <SplashWelcome />
      <AdminApp />
    </AppProvider>
  )
}
