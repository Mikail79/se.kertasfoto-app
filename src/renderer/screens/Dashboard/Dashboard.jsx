import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/Modal'
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineDuplicate, HiOutlineSearch, HiOutlinePlay, HiOutlineCamera, HiOutlineFilm, HiOutlineRefresh, HiOutlineVideoCamera, HiCheck } from 'react-icons/hi'

export default function Dashboard() {
  const { events, templates, sessions, activeEvent, setActiveEvent, addEvent, editEvent, removeEvent, enterBoothMode } = useApp()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [formData, setFormData] = useState({ name: '', date: '', folder_path: '' })
  const [selectedEvents, setSelectedEvents] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [captureMode, setCaptureMode] = useState('photo')

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

  const handleCreate = async () => {
    if (!formData.name.trim()) return
    const event = {
      id: `evt_${Date.now()}`,
      name: formData.name,
      date: formData.date || new Date().toISOString().split('T')[0],
      active_template_id: null,
      folder_path: formData.folder_path || '',
    }
    await addEvent(event)
    setFormData({ name: '', date: '', folder_path: '' })
    setShowCreateModal(false)
  }

  const handleUpdate = async () => {
    if (!editingEvent || !formData.name.trim()) return
    await editEvent(editingEvent.id, { name: formData.name, date: formData.date, folder_path: formData.folder_path })
    setEditingEvent(null)
    setFormData({ name: '', date: '', folder_path: '' })
  }

  const handleDelete = async (id) => { if (confirm('Delete this event?')) await removeEvent(id) }

  const handleDuplicate = async () => {
    for (const id of selectedEvents) {
      const ev = events.find(e => e.id === id)
      if (ev) {
        await addEvent({ ...ev, id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: `${ev.name} (copy)` })
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

  const captureModes = [
    { id: 'photo', label: 'Photo', icon: <HiOutlineCamera /> },
    { id: 'gif', label: 'GIF', icon: <HiOutlineFilm /> },
    { id: 'boomerang', label: 'Boomerang', icon: <HiOutlineRefresh /> },
    { id: 'video', label: 'Video', icon: <HiOutlineVideoCamera /> },
  ]

  return (
    <>
      {/* Toolbar */}
      <div className="toolbar">
        <span style={{ fontSize: 13, fontWeight: 600, marginRight: 8 }}>Your events</span>
        <div className="toolbar-group">
          <button className="btn btn-sm" onClick={selectAll}>Select All</button>
          <button className="btn btn-sm" onClick={() => { if (selectedEvent) { setEditingEvent(selectedEvent); setFormData({ name: selectedEvent.name, date: selectedEvent.date, folder_path: selectedEvent.folder_path || '' }) } }} disabled={!selectedEvent}>
            <HiOutlinePencil /> Rename event
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleDeleteSelected} disabled={selectedEvents.length === 0}>
            <HiOutlineTrash /> Delete
          </button>
          <button className="btn btn-sm" onClick={handleDuplicate} disabled={selectedEvents.length === 0}>
            <HiOutlineDuplicate /> Duplicate
          </button>
        </div>
        <button className="btn btn-sm" onClick={() => { setFormData({ name: '', date: '', folder_path: '' }); setShowCreateModal(true) }}>
          <HiOutlinePlus /> New event
        </button>
        <div className="toolbar-spacer" />
        <button className="btn btn-launch" onClick={() => { if (selectedEvent) { setActiveEvent(selectedEvent); enterBoothMode() } else if (activeEvent) enterBoothMode() }} disabled={!selectedEvent && !activeEvent}>
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
      <div className="events-layout" style={{ height: 'calc(100vh - 132px)' }}>
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
                    {event.active_template_id && (() => {
                      const tpl = templates.find(t => t.id === event.active_template_id)
                      return tpl?.background_image ? <img src={tpl.background_image.startsWith('blob:') || tpl.background_image.startsWith('http') ? tpl.background_image : `file://${tpl.background_image.replace(/\\/g, '/')}`} alt="" onError={e => e.target.style.display = 'none'} /> : null
                    })()}
                  </div>
                  <div className="info">
                    <div className="name truncate">{event.name}</div>
                    <div className="date">{event.date ? new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}</div>
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

          {activeEvent && (
            <div className="panel-section">
              <div className="panel-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Event Templates</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
                {templates.filter(t => t.event_id === activeEvent.id).map(tpl => (
                  <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 8px', borderRadius: 4, background: activeEvent.active_template_id === tpl.id ? 'var(--color-bg-hover)' : 'transparent', border: activeEvent.active_template_id === tpl.id ? '1px solid var(--color-accent)' : '1px solid transparent', cursor: 'pointer' }} onClick={() => { editEvent(activeEvent.id, { active_template_id: tpl.id }); setActiveEvent(prev => ({ ...prev, active_template_id: tpl.id })) }}>
                    <div style={{ width: 24, height: 24, borderRadius: 2, background: 'var(--color-bg-overlay)', overflow: 'hidden' }}>
                      {tpl.background_image && <img src={tpl.background_image.startsWith('blob:') || tpl.background_image.startsWith('http') ? tpl.background_image : `file://${tpl.background_image.replace(/\\/g, '/')}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />}
                    </div>
                    <span className="truncate" style={{ flex: 1, color: activeEvent.active_template_id === tpl.id ? 'var(--color-accent)' : 'var(--color-text)' }}>{tpl.name}</span>
                    {activeEvent.active_template_id === tpl.id && <HiCheck style={{ color: 'var(--color-accent)' }} />}
                  </div>
                ))}
                {templates.filter(t => t.event_id === activeEvent.id).length === 0 && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>No templates for this event. Go to Template Editor to create one.</span>}
              </div>
            </div>
          )}

          <div className="panel-section">
            <div className="panel-section-title">Capture</div>
            <div className="capture-modes">
              {captureModes.map(m => (
                <div key={m.id} className={`capture-mode ${captureMode === m.id ? 'active' : ''}`} onClick={() => setCaptureMode(m.id)}>
                  <div className="mode-icon">{m.icon}</div>
                  <span className="mode-label">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-section">
            {['Effects & Stickers', 'Digital Props', 'Beauty Filter', 'Watermark', 'Post Processing', 'Background Removal', 'Disclaimer'].map(item => (
              <div key={item} className="panel-menu-item">{item}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New event"
        footer={<><button className="btn" onClick={() => setShowCreateModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Create</button></>}>
        <div className="input-group">
          <label className="input-label">Event name</label>
          <input className="input" placeholder="e.g. SKFT X Danamon" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>
        <div className="input-group">
          <label className="input-label">Date</label>
          <input className="input" type="date" value={formData.date} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="input-group">
          <label className="input-label">Folder</label>
          <input className="input" placeholder="D:/Photobooth_Events/..." value={formData.folder_path} onChange={e => setFormData(f => ({ ...f, folder_path: e.target.value }))} />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingEvent} onClose={() => setEditingEvent(null)} title="Rename event"
        footer={<><button className="btn" onClick={() => setEditingEvent(null)}>Cancel</button><button className="btn btn-primary" onClick={handleUpdate}>Save</button></>}>
        <div className="input-group">
          <label className="input-label">Event name</label>
          <input className="input" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>
        <div className="input-group">
          <label className="input-label">Date</label>
          <input className="input" type="date" value={formData.date} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="input-group">
          <label className="input-label">Folder</label>
          <input className="input" value={formData.folder_path} onChange={e => setFormData(f => ({ ...f, folder_path: e.target.value }))} />
        </div>
      </Modal>
    </>
  )
}
