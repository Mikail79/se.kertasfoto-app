import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/Modal'
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineDuplicate, HiOutlineSearch, HiOutlinePlay, HiOutlineCamera, HiOutlineFilm, HiOutlineRefresh, HiOutlineVideoCamera, HiCheck, HiOutlineFolder, HiOutlineCloud } from 'react-icons/hi'

export default function Dashboard() {
  const {
    events, templates, sessions, activeEvent,
    setActiveEvent, addEvent, editEvent, removeEvent, enterBoothMode,
    gdriveStatus, createEventDriveFolder,
  } = useApp()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [formData, setFormData] = useState({ name: '', date: '', folder_path: '', timer_duration: 3 })
  const [selectedEvents, setSelectedEvents] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [captureMode, setCaptureMode] = useState('photo')
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [gdriveFolderStatus, setGdriveFolderStatus] = useState(null) // null | 'creating' | 'done' | 'skip'

  const filteredEvents = useMemo(() => {
    let list = [...events]
    if (search) list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    list.sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : (b.date || '').localeCompare(a.date || ''))
    return list
  }, [events, search, sortBy])

  const toggleSelect = (id) => {
    setSelectedEvents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAll = () => {
    if (selectedEvents.length === events.length) setSelectedEvents([])
    else setSelectedEvents(events.map(e => e.id))
  }

  // Folder picker via native file manager
  const pickFolder = async () => {
    if (window.electronAPI) {
      const fp = await window.electronAPI.openFolderDialog()
      if (fp) setFormData(f => ({ ...f, folder_path: fp }))
    } else {
      // In browser dev mode, show a simple prompt
      const fp = prompt('Enter folder path (native dialog not available in browser):', formData.folder_path)
      if (fp !== null) setFormData(f => ({ ...f, folder_path: fp }))
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) return
    setCreatingEvent(true)
    setGdriveFolderStatus(null)

    try {
      // Buat Google Drive folder jika connected
      let driveFolderId = null
      let driveFolderLink = null

      if (gdriveStatus.isAuthenticated) {
        setGdriveFolderStatus('creating')
        const folderResult = await createEventDriveFolder(formData.name)
        if (folderResult) {
          driveFolderId = folderResult.id
          driveFolderLink = folderResult.shareLink
          setGdriveFolderStatus('done')
        } else {
          setGdriveFolderStatus('skip')
        }
      }

      const event = {
        id: `evt_${Date.now()}`,
        name: formData.name,
        date: formData.date || new Date().toISOString().split('T')[0],
        active_template_id: null,
        folder_path: formData.folder_path || '',
        drive_folder_id: driveFolderId,
        drive_folder_link: driveFolderLink,
      }

      await addEvent(event)
      setFormData({ name: '', date: '', folder_path: '' })
      setShowCreateModal(false)
    } finally {
      setCreatingEvent(false)
      setGdriveFolderStatus(null)
    }
  }

  const handleUpdate = async () => {
    if (!editingEvent || !formData.name.trim()) return
    await editEvent(editingEvent.id, {
      name: formData.name,
      date: formData.date,
      folder_path: formData.folder_path,
    })
    setEditingEvent(null)
    setFormData({ name: '', date: '', folder_path: '', timer_duration: 3 })
  }

  const handleDelete = async (id) => { if (confirm('Delete this event?')) await removeEvent(id) }

  const handleDuplicate = async () => {
    for (const id of selectedEvents) {
      const ev = events.find(e => e.id === id)
      if (ev) {
        await addEvent({
          ...ev,
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: `${ev.name} (copy)`,
          drive_folder_id: null,
          drive_folder_link: null,
        })
      }
    }
    setSelectedEvents([])
  }

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedEvents.length} event(s)?`)) return
    for (const id of selectedEvents) await removeEvent(id)
    setSelectedEvents([])
  }

  const selectedEvent = selectedEvents.length === 1 ? events.find(e => e.id === selectedEvents[0]) : null
  const activeTemplate = selectedEvent?.active_template_id ? templates.find(t => t.id === selectedEvent.active_template_id) : null
  const eventTemplates = activeEvent ? templates.filter(t => t.event_id === activeEvent.id) : []

  const getImageUrl = (path) => {
    if (!path) return null
    if (path.startsWith('blob:') || path.startsWith('http') || path.startsWith('data:')) return path
    return `file://${path.replace(/\\/g, '/')}`
  }



  // Folder picker row component
  const FolderPickerField = ({ label }) => (
    <div className="input-group">
      <label className="input-label">{label || 'Save Folder'}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        <input
          className="input"
          placeholder="Click browse to select folder..."
          value={formData.folder_path}
          readOnly
          style={{ flex: 1, cursor: 'pointer', opacity: formData.folder_path ? 1 : 0.5 }}
          onClick={pickFolder}
        />
        <button className="btn btn-sm" type="button" onClick={pickFolder} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
          <HiOutlineFolderOpen /> Browse
        </button>
      </div>
    </div>
  )

  const selectFolder = async () => {
    if (window.electronAPI?.selectFolder) {
      const result = await window.electronAPI.selectFolder()
      if (result) setFormData(f => ({ ...f, folder_path: result }))
    } else {
      alert('Folder picker hanya tersedia di aplikasi desktop.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="toolbar">
        <span style={{ fontSize: 13, fontWeight: 600, marginRight: 8 }}>Your events</span>
        <div className="toolbar-group">
          <button className="btn btn-sm" onClick={selectAll}>Select All</button>
          <button className="btn btn-sm" onClick={() => {
            if (selectedEvent) {
              setEditingEvent(selectedEvent)
              setFormData({ name: selectedEvent.name, date: selectedEvent.date, folder_path: selectedEvent.folder_path || '' })
            }
          }} disabled={!selectedEvent}>
            <HiOutlinePencil /> Rename event
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleDeleteSelected} disabled={selectedEvents.length === 0}>
            <HiOutlineTrash /> Delete
          </button>
          <button className="btn btn-sm" onClick={handleDuplicate} disabled={selectedEvents.length === 0}>
            <HiOutlineDuplicate /> Duplicate
          </button>
        </div>
        <button className="btn btn-sm" onClick={() => { setFormData({ name: '', date: '', folder_path: '', timer_duration: 3 }); setShowCreateModal(true) }}>
          <HiOutlinePlus /> New event
        </button>
        <div className="toolbar-spacer" />

        {/* Google Drive Status Button */}
        <button
          className="btn btn-sm"
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-to', { detail: '/settings' }))}
          style={{
            borderColor: gdriveStatus.isAuthenticated ? 'rgba(74,222,128,0.4)' : 'var(--color-border)',
            color: gdriveStatus.isAuthenticated ? '#4ade80' : 'var(--color-text-muted)',
          }}
        >
          <HiOutlineCloud />
          {gdriveStatus.isAuthenticated ? 'Drive Aktif' : 'Setup Drive'}
        </button>

        <button
          className="btn btn-launch"
          onClick={() => {
            if (selectedEvent) { setActiveEvent(selectedEvent); enterBoothMode() }
            else if (activeEvent) enterBoothMode()
          }}
          disabled={!selectedEvent && !activeEvent}
        >
          <HiOutlinePlay /> Launch event
        </button>
      </div>

      {/* Filter bar */}
      <div className="toolbar" style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div className="toolbar-group">
          <button className="btn btn-sm btn-ghost" onClick={() => setSortBy(s => s === 'name' ? 'date' : 'name')}>
            A↕ Sort by {sortBy}
          </button>
          <select className="select" style={{ width: 100, padding: '4px 24px 4px 8px', fontSize: 11 }} defaultValue="all">
            <option value="all">All time</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
        <div className="toolbar-spacer" />
        <div style={{ position: 'relative' }}>
          <HiOutlineSearch style={{ position: 'absolute', left: 8, top: 6, color: 'var(--color-text-muted)', fontSize: 14 }} />
          <input className="toolbar-search" style={{ paddingLeft: 26 }} placeholder="Find your event" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Content */}
      <div className="events-layout" style={{ flex: 1, minHeight: 0 }}>
        {/* Grid */}
        <div className="events-grid-area">
          {filteredEvents.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 80 }}>
              <h3>No events yet</h3>
              <p>Create your first event to get started with photobooth</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowCreateModal(true)}>
                <HiOutlinePlus /> New event
              </button>
            </div>
          ) : (
            <div className="events-grid">
              {filteredEvents.map(event => (
                <div
                  key={event.id}
                  className={`event-card ${selectedEvents.includes(event.id) ? 'selected' : ''} ${activeEvent?.id === event.id ? 'selected' : ''}`}
                  onClick={() => toggleSelect(event.id)}
                  onDoubleClick={() => { setActiveEvent(event); enterBoothMode() }}
                >
                  <div className="check">
                    {selectedEvents.includes(event.id) && <HiCheck />}
                  </div>
                  <div className="thumb">
                    {(() => {
                      const tpl = templates.find(t => t.id === event.active_template_id) || templates.find(t => t.event_id === event.id)
                      return tpl?.background_image
                        ? <img src={tpl.background_image.startsWith('blob:') || tpl.background_image.startsWith('http') ? tpl.background_image : `file://${tpl.background_image.replace(/\\/g, '/')}`} alt="" onError={e => e.target.style.display = 'none'} />
                        : null
                    })()}
                  </div>
                  <div className="info">
                    <div className="name truncate">{event.name}</div>
                    <div className="date" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {event.date ? new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                      {event.drive_folder_id && (
                        <HiOutlineCloud style={{ fontSize: 10, color: '#4ade80', marginLeft: 2 }} title="Google Drive terhubung" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="events-panel">
          <div className="panel-section">
            <div className="panel-section-title">Start screen</div>
            <div className="panel-preview">
              {activeEvent ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <HiOutlineCamera style={{ fontSize: 18, color: 'white' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Print</span>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Select an event</span>
              )}
            </div>
          </div>

          {/* Drive folder info */}
          {activeEvent?.drive_folder_id && (
            <div className="panel-section">
              <div className="panel-section-title">Google Drive</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <HiOutlineCloud style={{ color: '#4ade80', fontSize: 14 }} />
                <span style={{ fontSize: 11, color: '#4ade80' }}>Folder terhubung</span>
              </div>
              {activeEvent.drive_folder_link && (
                <a
                  href={activeEvent.drive_folder_link}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                >
                  Buka di Drive →
                </a>
              )}
            </div>
          )}

          {activeEvent && (
            <div className="panel-section">
              <div className="panel-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Event Templates</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{eventTemplates.length} total</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
                {templates.filter(t => t.event_id === activeEvent.id).map(tpl => (
                  <div
                    key={tpl.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 8px', borderRadius: 4, background: activeEvent.active_template_id === tpl.id ? 'var(--color-bg-hover)' : 'transparent', border: activeEvent.active_template_id === tpl.id ? '1px solid var(--color-accent)' : '1px solid transparent', cursor: 'pointer' }}
                    onClick={() => { editEvent(activeEvent.id, { active_template_id: tpl.id }); setActiveEvent(prev => ({ ...prev, active_template_id: tpl.id })) }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: 2, background: 'var(--color-bg-overlay)', overflow: 'hidden' }}>
                      {tpl.background_image && <img src={getImageUrl(tpl.background_image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />}
                    </div>
                    <span className="truncate" style={{ flex: 1, color: activeEvent.active_template_id === tpl.id ? 'var(--color-accent)' : 'var(--color-text)' }}>{tpl.name}</span>
                    {activeEvent.active_template_id === tpl.id && <HiCheck style={{ color: 'var(--color-accent)' }} />}
                  </div>
                ))}
                {templates.filter(t => t.event_id === activeEvent.id).length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>No templates for this event.</span>
                )}
              </div>
            </div>
          )}



          <div className="panel-section">
            {['Effects & Stickers', 'Digital Props', 'Beauty Filter', 'Watermark', 'Post Processing', 'Background Removal', 'Disclaimer'].map(item => (
              <div key={item} className="panel-menu-item">{item}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { if (!creatingEvent) setShowCreateModal(false) }}
        title="New event"
        footer={
          <>
            <button className="btn" onClick={() => setShowCreateModal(false)} disabled={creatingEvent}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={creatingEvent || !formData.name.trim()}>
              {creatingEvent ? (
                gdriveFolderStatus === 'creating'
                  ? <><span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', display: 'inline-block', animation: 'spin 0.7s linear infinite', marginRight: 6 }} />Membuat folder Drive...</>
                  : 'Membuat event...'
              ) : 'Create'}
            </button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">Event name</label>
          <input className="input" placeholder="e.g. SKFT X Danamon" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>
        <div className="input-group">
          <label className="input-label">Date</label>
          <input className="input" type="date" value={formData.date} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
        </div>
        <FolderPickerField label="Save Folder" />
        <div className="input-group">
          <label className="input-label">Folder simpan foto</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              placeholder="D:/Photobooth_Events/..."
              value={formData.folder_path}
              onChange={e => setFormData(f => ({ ...f, folder_path: e.target.value }))}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn btn-sm" onClick={selectFolder} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px' }}>
              <HiOutlineFolder style={{ fontSize: 16 }} /> Browse
            </button>
          </div>
        </div>

        {/* Google Drive info in modal */}
        {gdriveStatus.isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(74,222,128,0.08)', borderRadius: 6, border: '1px solid rgba(74,222,128,0.2)', fontSize: 12 }}>
            <HiOutlineCloud style={{ color: '#4ade80', flexShrink: 0 }} />
            <span style={{ color: '#4ade80' }}>Folder Google Drive akan dibuat otomatis untuk event ini.</span>
          </div>
        )}
        {!gdriveStatus.isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,165,0,0.08)', borderRadius: 6, border: '1px solid rgba(255,165,0,0.2)', fontSize: 12 }}>
            <HiOutlineCloud style={{ color: '#f0a030', flexShrink: 0 }} />
            <span style={{ color: '#f0a030' }}>Google Drive belum terhubung. Setup di toolbar untuk upload otomatis.</span>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        title="Rename event"
        footer={
          <>
            <button className="btn" onClick={() => setEditingEvent(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdate}>Save</button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">Event name</label>
          <input className="input" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>
        <div className="input-group">
          <label className="input-label">Date</label>
          <input className="input" type="date" value={formData.date} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
        </div>
        <FolderPickerField label="Save Folder" />
        <div className="input-group">
          <label className="input-label">Folder simpan foto</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              placeholder="D:/Photobooth_Events/..."
              value={formData.folder_path}
              onChange={e => setFormData(f => ({ ...f, folder_path: e.target.value }))}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn btn-sm" onClick={selectFolder} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px' }}>
              <HiOutlineFolder style={{ fontSize: 16 }} /> Browse
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}