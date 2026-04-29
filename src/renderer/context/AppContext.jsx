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
  getSessionsByEvent: async (eventId) => {
    const sessions = JSON.parse(localStorage.getItem('skf_sessions') || '[]')
    return sessions.filter((s) => s.event_id === eventId)
  },
  getCameraDevices: async () => [
    { id: 'webcam-default', label: 'Default Webcam' },
  ],
  getPrinters: async () => [
    { name: 'Microsoft Print to PDF', isDefault: true, status: 0 },
  ],
  openFileDialog: async () => null,
  openFolderDialog: async () => null,
  toggleFullscreen: async () => false,
}

const api = isElectron ? window.electronAPI : mockAPI

export function AppProvider({ children }) {
  const [events, setEvents] = useState([])
  const [templates, setTemplates] = useState([])
  const [sessions, setSessions] = useState([])
  const [activeEvent, setActiveEvent] = useState(null)
  const [isBoothMode, setIsBoothMode] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const [evts, tpls, sess] = await Promise.all([
          api.getEvents(),
          api.getTemplates(),
          api.getSessions(),
        ])
        setEvents(evts)
        setTemplates(tpls)
        setSessions(sess)
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
    if (activeEvent?.id === id) setActiveEvent(null)
  }, [activeEvent])

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

  // Sessions
  const addSession = useCallback(async (session) => {
    const created = await api.createSession(session)
    setSessions((prev) => [...prev, created])
    return created
  }, [])

  // Booth mode
  const enterBoothMode = useCallback(() => {
    setIsBoothMode(true)
    if (isElectron) api.toggleFullscreen()
  }, [])

  const exitBoothMode = useCallback(() => {
    setIsBoothMode(false)
    if (isElectron) api.toggleFullscreen()
  }, [])

  const value = {
    // Data
    events, templates, sessions,
    activeEvent, setActiveEvent,
    loading,
    // Events CRUD
    addEvent, editEvent, removeEvent,
    // Templates CRUD
    addTemplate, editTemplate, removeTemplate,
    // Sessions
    addSession,
    // Booth
    isBoothMode, enterBoothMode, exitBoothMode,
    // API passthrough
    api,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
