import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AppContext = createContext(null)

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI

// Mock API for browser development
const mockAPI = {
  getEvents: async () => JSON.parse(localStorage.getItem('skf_events') || '[]'),
  createEvent: async (event) => {
    const events = JSON.parse(localStorage.getItem('skf_events') || '[]')
    events.push(event)
    localStorage.setItem('skf_events', JSON.stringify(events))
    return event
  },
  updateEvent: async (id, updates) => {
    const events = JSON.parse(localStorage.getItem('skf_events') || '[]')
    const idx = events.findIndex((e) => e.id === id)
    if (idx !== -1) { events[idx] = { ...events[idx], ...updates }; localStorage.setItem('skf_events', JSON.stringify(events)) }
    return events[idx]
  },
  deleteEvent: async (id) => {
    let events = JSON.parse(localStorage.getItem('skf_events') || '[]')
    events = events.filter((e) => e.id !== id)
    localStorage.setItem('skf_events', JSON.stringify(events))
    return true
  },
  getTemplates: async () => JSON.parse(localStorage.getItem('skf_templates') || '[]'),
  createTemplate: async (template) => {
    const templates = JSON.parse(localStorage.getItem('skf_templates') || '[]')
    templates.push(template)
    localStorage.setItem('skf_templates', JSON.stringify(templates))
    return template
  },
  updateTemplate: async (id, updates) => {
    const templates = JSON.parse(localStorage.getItem('skf_templates') || '[]')
    const idx = templates.findIndex((t) => t.id === id)
    if (idx !== -1) { templates[idx] = { ...templates[idx], ...updates }; localStorage.setItem('skf_templates', JSON.stringify(templates)) }
    return templates[idx]
  },
  deleteTemplate: async (id) => {
    let templates = JSON.parse(localStorage.getItem('skf_templates') || '[]')
    templates = templates.filter((t) => t.id !== id)
    localStorage.setItem('skf_templates', JSON.stringify(templates))
    return true
  },
  getSessions: async () => JSON.parse(localStorage.getItem('skf_sessions') || '[]'),
  createSession: async (session) => {
    const sessions = JSON.parse(localStorage.getItem('skf_sessions') || '[]')
    sessions.push(session)
    localStorage.setItem('skf_sessions', JSON.stringify(sessions))
    return session
  },
  updateSession: async (id, updates) => {
    const sessions = JSON.parse(localStorage.getItem('skf_sessions') || '[]')
    const idx = sessions.findIndex((s) => s.id === id)
    if (idx !== -1) { sessions[idx] = { ...sessions[idx], ...updates }; localStorage.setItem('skf_sessions', JSON.stringify(sessions)) }
    return sessions[idx]
  },
  deleteSession: async (id) => {
    let sessions = JSON.parse(localStorage.getItem('skf_sessions') || '[]')
    sessions = sessions.filter((s) => s.id !== id)
    localStorage.setItem('skf_sessions', JSON.stringify(sessions))
    return true
  },
  getSessionsByEvent: async (eventId) => {
    const sessions = JSON.parse(localStorage.getItem('skf_sessions') || '[]')
    return sessions.filter((s) => s.event_id === eventId)
  },
  getShares: async () => JSON.parse(localStorage.getItem('skf_shares') || '[]'),
  createShare: async (share) => {
    const shares = JSON.parse(localStorage.getItem('skf_shares') || '[]')
    shares.push(share)
    localStorage.setItem('skf_shares', JSON.stringify(shares))
    return share
  },
  getSharesBySession: async (sessionId) => {
    const shares = JSON.parse(localStorage.getItem('skf_shares') || '[]')
    return shares.filter((s) => s.session_id === sessionId)
  },
  deleteShare: async (id) => {
    let shares = JSON.parse(localStorage.getItem('skf_shares') || '[]')
    shares = shares.filter((s) => s.id !== id)
    localStorage.setItem('skf_shares', JSON.stringify(shares))
    return true
  },
  getCameraDevices: async () => [{ id: 'webcam-default', label: 'Default Webcam' }],
  getPrinters: async () => [{ name: 'Microsoft Print to PDF', isDefault: true, status: 0 }],
  openFileDialog: async () => null,
  openFolderDialog: async () => null,
  toggleFullscreen: async () => false,

  // Google Drive mocks (browser dev mode)
  gdrive_status: async () => ({ hasCredentials: false, isAuthenticated: false }),
  gdrive_connect: async () => ({ success: false, error: 'Hanya tersedia di Electron' }),
  gdrive_cancelConnect: async () => ({ success: true }), // <--- Ditambahkan Mock untuk Batal
  gdrive_disconnect: async () => ({ success: true }),
  gdrive_hasCredentials: async () => false,
  gdrive_saveCredentials: async () => ({ success: false, error: 'Hanya tersedia di Electron' }),
  gdrive_createFolder: async (name) => ({
    success: false, error: 'Mock: folder tidak dibuat di browser dev'
  }),
  gdrive_uploadPhoto: async () => ({
    success: false, error: 'Mock: upload tidak tersedia di browser dev'
  }),
  gdrive_updatePhoto: async () => ({
    success: false, error: 'Mock: update tidak tersedia di browser dev'
  }),
  readFileAsDataUrl: async () => ({
    success: false, error: 'Mock: baca file tidak tersedia di browser dev'
  }),
  // Camera SDK mocks
  cameraSDK_status: async () => ({ connected: false }),
  cameraSDK_getProperty: async () => ({ success: false }),
  cameraSDK_setProperty: async () => ({ success: false }),
  cameraSDK_getPropertyValues: async () => ({ success: false, values: [] }),
  cameraSDK_getAllProperties: async () => ({}),
  cameraSDK_capture: async () => ({ success: false, error: 'Mock' }),
  cameraSDK_start: async () => ({ success: false }),
}

const api = isElectron ? window.electronAPI : mockAPI

export function AppProvider({ children }) {
  const [events, setEvents] = useState([])
  const [templates, setTemplates] = useState([])
  const [sessions, setSessions] = useState([])
  const [shares, setShares] = useState([])
  const [activeEvent, setActiveEvent] = useState(null)
  const [isBoothMode, setIsBoothMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cameraCountdown, setCameraCountdown] = useState(() => {
    const saved = localStorage.getItem('skf_countdown')
    return saved !== null ? parseInt(saved, 10) : 3
  })
  const [previewDuration, setPreviewDuration] = useState(() => {
    const saved = localStorage.getItem('skf_preview_duration')
    return saved !== null ? parseInt(saved, 10) : 3
  })
  const [cameraDeviceId, setCameraDeviceId] = useState(localStorage.getItem('skf_camera_device_id') || '')

  const updateCameraCountdown = useCallback((val) => {
    setCameraCountdown(val)
    localStorage.setItem('skf_countdown', val.toString())
  }, [])

  const updatePreviewDuration = useCallback((val) => {
    setPreviewDuration(val)
    localStorage.setItem('skf_preview_duration', val.toString())
  }, [])

  const updateCameraDeviceId = useCallback((val) => {
    setCameraDeviceId(val)
    localStorage.setItem('skf_camera_device_id', val || '')
  }, [])

  // ── Camera settings (persisted) ───────────────────────────────────────────
  const defaultCameraSettings = {
    mirror: true,
    rotation: '0',
    resolution: 80,
    mode: 'auto',           // 'auto' | 'manual'
    brightness: null,       // null = let camera decide
    contrast: null,
    saturation: null,
    sharpness: null,
    whiteBalance: 'auto',   // 'auto' | 'manual'
    colorTemperature: 5200, // Kelvin
    exposureMode: 'continuous',
    exposureCompensation: 0,
    focusMode: 'continuous',
    imageQuality: 'high',   // 'low' | 'medium' | 'high' | 'max'
    captureDelay: '0',      // ms string
    // Display-only (user sets on camera body)
    iso: '400',
    shutterSpeed: '1/125',
    aperture: 'f/2.8',
    flashMode: 'off',
    imageFormat: 'jpeg',
  }

  const [cameraSettings, setCameraSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('skf_camera_settings')
      return saved ? { ...defaultCameraSettings, ...JSON.parse(saved) } : defaultCameraSettings
    } catch { return defaultCameraSettings }
  })

  const updateCameraSettings = useCallback((updates) => {
    setCameraSettings(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem('skf_camera_settings', JSON.stringify(next))
      return next
    })
  }, [])

  // ── Google Drive state ─────────────────────────────────────────────────────
  const [gdriveStatus, setGdriveStatus] = useState({
    hasCredentials: false,
    isAuthenticated: false,
  })
  const [gdriveConnecting, setGdriveConnecting] = useState(false)

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const [evts, tpls, sess, shr] = await Promise.all([
          api.getEvents(),
          api.getTemplates(),
          api.getSessions(),
          api.getShares(),
        ])
        setEvents(evts)
        setTemplates(tpls)
        setSessions(sess)
        setShares(shr)

        // Check Google Drive status
        const status = await api.gdrive_status()
        setGdriveStatus(status)
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
        if (isElectron && api.setFullscreen) {
          api.setFullscreen(false).catch(e => console.warn('setFullscreen failed', e))
        }
      }
    }
    load()
  }, [])

  // ── Google Drive actions ───────────────────────────────────────────────────

  const refreshGdriveStatus = useCallback(async () => {
    const status = await api.gdrive_status()
    setGdriveStatus(status)
    return status
  }, [])

  const connectGdrive = useCallback(async () => {
    setGdriveConnecting(true)
    try {
      const result = await api.gdrive_connect()
      if (result.success) {
        const status = await api.gdrive_status()
        setGdriveStatus(status)
      }
      return result
    } finally {
      setGdriveConnecting(false)
    }
  }, [])

  // === DITAMBAHKAN DAN DIMASUKKAN DI DALAM APP PROVIDER ===
  const cancelConnectGdrive = useCallback(async () => {
    try {
      // Memanggil method API untuk membatalkan
      if (api.gdrive_cancelConnect) {
        await api.gdrive_cancelConnect()
      } else if (isElectron && window.electronAPI && window.electronAPI.cancelConnectGdrive) {
        // Fallback jika API terdaftar dengan nama berbeda di preload
        await window.electronAPI.cancelConnectGdrive()
      }
      setGdriveConnecting(false)
    } catch (error) {
      console.error("Gagal membatalkan koneksi:", error)
      setGdriveConnecting(false)
    }
  }, [])

  const disconnectGdrive = useCallback(async () => {
    const result = await api.gdrive_disconnect()
    if (result.success) {
      setGdriveStatus({ hasCredentials: gdriveStatus.hasCredentials, isAuthenticated: false })
    }
    return result
  }, [gdriveStatus.hasCredentials])

  const saveGdriveCredentials = useCallback(async (json) => {
    const result = await api.gdrive_saveCredentials(json)
    if (result.success) {
      const status = await api.gdrive_status()
      setGdriveStatus(status)
    }
    return result
  }, [])

  /**
   * Buat folder Drive untuk event baru.
   * Dipanggil dari Dashboard saat create event jika GDrive connected.
   */
  const createEventDriveFolder = useCallback(async (eventName) => {
    if (!gdriveStatus.isAuthenticated) return null
    try {
      const result = await api.gdrive_createFolder(eventName)
      return result.success ? result : null
    } catch {
      return null
    }
  }, [gdriveStatus.isAuthenticated])

  /**
   * Upload foto ke folder Drive event.
   * Returns { success, viewLink, downloadLink, shareLink } atau null
   */
  const uploadPhotoToDrive = useCallback(async (dataUrl, folderId, filename) => {
    if (!gdriveStatus.isAuthenticated || !folderId) return null
    try {
      const result = await api.gdrive_uploadPhoto(dataUrl, folderId, filename)
      return result.success ? result : null
    } catch {
      return null
    }
  }, [gdriveStatus.isAuthenticated])

  const updatePhotoToDrive = useCallback(async (dataUrl, fileId, filename) => {
    if (!gdriveStatus.isAuthenticated || !fileId) return null
    try {
      const result = await api.gdrive_updatePhoto(dataUrl, fileId, filename)
      console.log('gdrive update raw result:', result)
      return result.success ? result : null
    } catch (err) {
      console.error('gdrive update error:', err)
      return null
    }
  }, [gdriveStatus.isAuthenticated])

  // Events CRUD
  const addEvent = useCallback(async (event) => {
    const created = await api.createEvent(event)
    setEvents((prev) => [...prev, created])
    return created
  }, [])

  const editEvent = useCallback(async (id, updates) => {
    const updated = await api.updateEvent(id, updates)
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)))
    return updated
  }, [])

  const removeEvent = useCallback(async (id) => {
    await api.deleteEvent(id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setActiveEvent((prev) => (prev?.id === id ? null : prev))
  }, [])

  // Templates CRUD
  const addTemplate = useCallback(async (template) => {
    const created = await api.createTemplate(template)
    setTemplates((prev) => [...prev, created])
    return created
  }, [])

  const editTemplate = useCallback(async (id, updates) => {
    const updated = await api.updateTemplate(id, updates)
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
    return updated
  }, [])

  const removeTemplate = useCallback(async (id) => {
    await api.deleteTemplate(id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addSession = useCallback(async (session) => {
    const created = await api.createSession(session)
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === created.id)
      if (exists) return prev.map((s) => (s.id === created.id ? created : s))
      return [...prev, created]
    })
    return created
  }, [])

  const editSession = useCallback(async (id, updates) => {
    const updated = await api.updateSession(id, updates)
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)))
    return updated
  }, [])

  const removeSession = useCallback(async (id) => {
    await api.deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // Shares
  const addShare = useCallback(async (share) => {
    const created = await api.createShare(share)
    setShares((prev) => [...prev, created])
    return created
  }, [])

  const removeShare = useCallback(async (id) => {
    await api.deleteShare(id)
    setShares((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // Booth mode
  const enterBoothMode = useCallback(() => {
    setIsBoothMode(true)
    if (isElectron) {
      if (api.setFullscreen) api.setFullscreen(true).catch(e => console.warn('setFullscreen failed', e))
      else api.toggleFullscreen()
    }
  }, [])

  const exitBoothMode = useCallback(() => {
    setIsBoothMode(false)
    if (isElectron) {
      if (api.setFullscreen) api.setFullscreen(false).catch(e => console.warn('setFullscreen failed', e))
      else api.toggleFullscreen()
    }
  }, [])

  const value = {
    // Data
    events, templates, sessions, shares,
    activeEvent, setActiveEvent,
    loading,
    // Events CRUD
    addEvent, editEvent, removeEvent,
    // Templates CRUD
    addTemplate, editTemplate, removeTemplate,
    // Sessions CRUD
    addSession, editSession, removeSession,
    // Shares
    addShare, removeShare,
    // Booth
    isBoothMode, enterBoothMode, exitBoothMode,
    cameraCountdown, updateCameraCountdown,
    previewDuration, updatePreviewDuration,
    cameraDeviceId, updateCameraDeviceId,
    // API passthrough
    api,
    // Google Drive
    gdriveStatus,
    gdriveConnecting,
    connectGdrive,
    cancelConnectGdrive, // <--- Sudah terekspos di sini
    disconnectGdrive,
    saveGdriveCredentials,
    refreshGdriveStatus,
    createEventDriveFolder,
    uploadPhotoToDrive,
    updatePhotoToDrive,
    // Camera settings
    cameraSettings,
    updateCameraSettings,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
