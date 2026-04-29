import { useState, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/Modal'
import { HiOutlinePlus, HiOutlineTrash, HiOutlineSave, HiOutlineUpload, HiOutlinePhotograph, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineQrcode, HiOutlineUser, HiOutlineColorSwatch, HiOutlineCube, HiOutlineDocumentText, HiOutlineArrowUp, HiOutlineArrowDown } from 'react-icons/hi'

const PAPER_SIZES = {
  // Landscape
  '6x4': { width: 900, height: 600, label: '6×4 Landscape' },
  '7x5': { width: 1050, height: 750, label: '7×5 Landscape' },
  '8x6': { width: 1200, height: 900, label: '8×6 Landscape' },
  // Portrait
  '4x6': { width: 600, height: 900, label: '4×6 Portrait' },
  '5x7': { width: 750, height: 1050, label: '5×7 Portrait' },
  '6x8': { width: 900, height: 1200, label: '6×8 Portrait' },
  // Strips
  '2x6_strip': { width: 300, height: 900, label: '2×6 Strip' },
  '2x8_strip': { width: 300, height: 1200, label: '2×8 Strip' },
  // Square & Social
  '4x4': { width: 600, height: 600, label: '4×4 Square' },
  '3x5': { width: 450, height: 750, label: '3×5 Portrait' },
  // Postcard
  '6x9': { width: 900, height: 1350, label: '6×9 Postcard' },
}
const CANVAS_SCALE = 0.55

export default function TemplateEditor() {
  const { templates, addTemplate, editTemplate, removeTemplate, activeEvent } = useApp()
  const eventTemplates = activeEvent ? templates.filter(t => t.event_id === activeEvent.id) : []
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', paper_size: '4x6' })
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [bgPreview, setBgPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [keepAspect, setKeepAspect] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [bgColor, setBgColor] = useState('#1e1e22')
  const canvasRef = useRef(null)

  const loadTemplate = useCallback((tpl) => {
    setSelectedTemplate(tpl)
    setSlots(tpl.photo_slots || [])
    setBackgroundImage(tpl.background_image || null)
    
    // Fix Windows path slashes for CSS background url
    let previewUrl = null
    if (tpl.background_image) {
      if (tpl.background_image.startsWith('blob:') || tpl.background_image.startsWith('http')) {
        previewUrl = tpl.background_image
      } else {
        previewUrl = `file://${tpl.background_image.replace(/\\/g, '/')}`
      }
    }
    setBgPreview(previewUrl)
    setBgColor(tpl.bg_color || '#1e1e22')
    setSelectedSlot(null)
  }, [])

  const handleCreate = async () => {
    if (!formData.name.trim() || !activeEvent) return
    const tpl = { id: `tpl_${Date.now()}`, name: formData.name, paper_size: formData.paper_size, background_image: null, bg_color: '#1e1e22', photo_slots: [], event_id: activeEvent.id }
    await addTemplate(tpl)
    loadTemplate(tpl)
    setShowCreateModal(false)
    setFormData({ name: '', paper_size: '4x6' })
  }

  const handleSave = async () => {
    if (!selectedTemplate) return
    await editTemplate(selectedTemplate.id, { photo_slots: slots, background_image: backgroundImage, bg_color: bgColor })
    setSelectedTemplate(prev => ({ ...prev, photo_slots: slots, background_image: backgroundImage, bg_color: bgColor }))
  }

  const goBack = async () => {
    if (selectedTemplate) {
      await editTemplate(selectedTemplate.id, { photo_slots: slots, background_image: backgroundImage, bg_color: bgColor })
    }
    setSelectedTemplate(null); setSlots([]); setBgPreview(null)
  }

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return
    await removeTemplate(id)
    if (selectedTemplate?.id === id) { setSelectedTemplate(null); setSlots([]); setBgPreview(null) }
  }

  const addSlot = () => {
    const paper = PAPER_SIZES[selectedTemplate?.paper_size || '4x6']
    const newSlot = { slot: slots.length + 1, x: 50, y: 50 + slots.length * 60, width: Math.min(200, paper.width - 100), height: Math.min(150, paper.height - 100), rotation: 0 }
    setSlots(prev => [...prev, newSlot])
    setSelectedSlot(slots.length)
  }

  const removeSlot = (i) => {
    setSlots(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, slot: idx + 1 })))
    setSelectedSlot(null)
  }

  const updateSlotProp = (i, prop, value) => {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [prop]: Number(value) || 0 } : s))
  }

  const moveSlotOrder = (i, dir) => {
    const newSlots = [...slots]
    const target = i + dir
    if (target < 0 || target >= newSlots.length) return
    ;[newSlots[i], newSlots[target]] = [newSlots[target], newSlots[i]]
    newSlots.forEach((s, idx) => s.slot = idx + 1)
    setSlots(newSlots)
    setSelectedSlot(target)
  }

  const alignSlot = (i, type) => {
    const paper = PAPER_SIZES[selectedTemplate?.paper_size || '4x6']
    const s = slots[i]
    let updates = {}
    if (type === 'left') updates.x = 0
    else if (type === 'right') updates.x = paper.width - s.width
    else if (type === 'top') updates.y = 0
    else if (type === 'bottom') updates.y = paper.height - s.height
    else if (type === 'centerH') updates.x = (paper.width - s.width) / 2
    else if (type === 'centerV') updates.y = (paper.height - s.height) / 2
    setSlots(prev => prev.map((sl, idx) => idx === i ? { ...sl, ...updates } : sl))
  }

  const handleBgUpload = async () => {
    if (window.electronAPI) {
      const fp = await window.electronAPI.openFileDialog({ filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] })
      if (fp) { setBackgroundImage(fp); setBgPreview(`file://${fp.replace(/\\/g, '/')}`) }
    } else {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'
      input.onchange = e => { const f = e.target.files[0]; if (f) { const url = URL.createObjectURL(f); setBgPreview(url); setBackgroundImage(url) } }
      input.click()
    }
  }

  const handleSlotMouseDown = (e, i) => {
    e.stopPropagation()
    if (e.target.classList.contains('resize-handle')) return
    setSelectedSlot(i); setIsDragging(true)
    const rect = canvasRef.current.getBoundingClientRect()
    setDragOffset({ x: e.clientX - rect.left - slots[i].x * CANVAS_SCALE, y: e.clientY - rect.top - slots[i].y * CANVAS_SCALE })
  }

  const handleResizeMouseDown = (e, i) => {
    e.stopPropagation(); setSelectedSlot(i); setIsResizing(true)
    setDragOffset({ x: e.clientX, y: e.clientY, startW: slots[i].width, startH: slots[i].height, aspect: slots[i].width / slots[i].height })
  }

  useEffect(() => {
    const move = (e) => {
      if (!canvasRef.current) return
      const paper = PAPER_SIZES[selectedTemplate?.paper_size || '4x6']
      if (isDragging && selectedSlot !== null) {
        const rect = canvasRef.current.getBoundingClientRect()
        let x = (e.clientX - rect.left - dragOffset.x) / CANVAS_SCALE
        let y = (e.clientY - rect.top - dragOffset.y) / CANVAS_SCALE
        x = Math.max(0, Math.min(x, paper.width - slots[selectedSlot].width))
        y = Math.max(0, Math.min(y, paper.height - slots[selectedSlot].height))
        setSlots(prev => prev.map((s, i) => i === selectedSlot ? { ...s, x: Math.round(x), y: Math.round(y) } : s))
      }
      if (isResizing && selectedSlot !== null) {
        let w = Math.max(60, dragOffset.startW + (e.clientX - dragOffset.x) / CANVAS_SCALE)
        let h = keepAspect ? w / dragOffset.aspect : Math.max(60, dragOffset.startH + (e.clientY - dragOffset.y) / CANVAS_SCALE)
        w = Math.min(w, paper.width - slots[selectedSlot].x)
        h = Math.min(h, paper.height - slots[selectedSlot].y)
        setSlots(prev => prev.map((s, i) => i === selectedSlot ? { ...s, width: Math.round(w), height: Math.round(h) } : s))
      }
    }
    const up = () => { setIsDragging(false); setIsResizing(false) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [isDragging, isResizing, selectedSlot, dragOffset, selectedTemplate, slots, keepAspect])

  const paperSize = PAPER_SIZES[selectedTemplate?.paper_size || '4x6']
  const sel = selectedSlot !== null ? slots[selectedSlot] : null

  // Template list view
  if (!activeEvent) {
    return (
      <div style={{ padding: 16, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <h3>No event selected</h3>
          <p>Please select an event in the Events dashboard before managing templates.</p>
        </div>
      </div>
    )
  }

  if (!selectedTemplate) {
    return (
      <div style={{ padding: 16 }}>
        <div className="toolbar" style={{ margin: '-16px -16px 16px', padding: '8px 16px' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Print Layout</span>
          <div className="toolbar-spacer" />
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}><HiOutlinePlus /> New template</button>
        </div>
        {eventTemplates.length === 0 ? (
          <div className="empty-state"><h3>No templates</h3><p>Create a template to design your photo layout</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowCreateModal(true)}><HiOutlinePlus /> New template</button></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {eventTemplates.map(tpl => (
              <div key={tpl.id} className="card card-clickable" onClick={() => loadTemplate(tpl)} style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ aspectRatio: '4/3', background: 'var(--color-bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {tpl.background_image ? <img src={tpl.background_image.startsWith('blob:') || tpl.background_image.startsWith('http') ? tpl.background_image : `file://${tpl.background_image.replace(/\\/g, '/')}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    : <HiOutlinePhotograph style={{ fontSize: 28, color: 'var(--color-text-muted)' }} />}
                  <span className="badge badge-neutral" style={{ position: 'absolute', bottom: 6, right: 6 }}>{tpl.photo_slots?.length || 0} slots</span>
                </div>
                <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{tpl.name}</div><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{PAPER_SIZES[tpl.paper_size]?.label || tpl.paper_size}</div></div>
                  <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleDeleteTemplate(tpl.id) }} style={{ color: 'var(--color-danger)', padding: 2 }}><HiOutlineTrash /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New template"
          footer={<><button className="btn" onClick={() => setShowCreateModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Create</button></>}>
          <div className="input-group"><label className="input-label">Name</label><input className="input" placeholder="e.g. Template Ramadhan" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
          <div className="input-group"><label className="input-label">Paper size</label><select className="select" value={formData.paper_size} onChange={e => setFormData(f => ({ ...f, paper_size: e.target.value }))}>{Object.entries(PAPER_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        </Modal>
      </div>
    )
  }

  // Editor view — 3-column like dslrBooth
  return (
    <div className="editor-layout" style={{ height: '100%' }}>
      {/* LEFT SIDEBAR — Add tools */}
      <div className="editor-left-sidebar">
        <div className="editor-sidebar-header">
          <button className="btn btn-ghost btn-sm" onClick={goBack} style={{ gap: 4 }}><HiOutlineChevronLeft /> Screen Editor</button>
        </div>

        {/* Template dropdown */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setShowDropdown(!showDropdown)}>
              <span className="truncate">{selectedTemplate.name}</span> ▾
            </button>
            {showDropdown && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', zIndex: 20, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                {eventTemplates.map(t => (
                  <div key={t.id} style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', background: t.id === selectedTemplate.id ? 'var(--color-accent-muted)' : 'transparent', color: t.id === selectedTemplate.id ? 'var(--color-accent)' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => { loadTemplate(t); setShowDropdown(false) }}>
                    <div style={{ width: 32, height: 24, borderRadius: 2, background: 'var(--color-bg-overlay)', flexShrink: 0, overflow: 'hidden' }}>
                      {t.background_image && <img src={t.background_image.startsWith('blob:') || t.background_image.startsWith('http') ? t.background_image : `file://${t.background_image.replace(/\\/g, '/')}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />}
                    </div>
                    <span className="truncate">{t.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Add</div>
          <button className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={addSlot}><HiOutlinePhotograph /> Photo From Booth</button>
          <button className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleBgUpload}><HiOutlineUpload /> Image</button>
          <button className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', opacity: 0.5 }}><HiOutlineDocumentText /> Text</button>
          <button className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', opacity: 0.5 }}><HiOutlineCube /> Shape</button>
          <button className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { const input = document.getElementById('bg-color-pick'); if (input) input.click() }}>
            <HiOutlineColorSwatch /> Background Color
            <input id="bg-color-pick" type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          </button>
          <button className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', opacity: 0.5 }}><HiOutlineQrcode /> QR Code</button>
          <button className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', opacity: 0.5 }}><HiOutlineUser /> Session Data</button>
        </div>

        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Layout</div>
          <div className="input-group"><label className="input-label">Paper Size</label>
            <select className="select" value={selectedTemplate.paper_size} onChange={e => {
              const newSize = e.target.value
              setSelectedTemplate(prev => ({ ...prev, paper_size: newSize }))
              editTemplate(selectedTemplate.id, { paper_size: newSize })
            }}>
              {Object.entries(PAPER_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.width}×{v.height})</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: '10px 12px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 6 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSave}><HiOutlineSave /> Save</button>
        </div>
      </div>

      {/* CENTER — Canvas with nav arrows */}
      <div className="editor-canvas-wrap" onClick={() => setSelectedSlot(null)}>
        {/* Template navigation arrows */}
        {eventTemplates.length > 1 && (
          <>
            <button className="canvas-nav-btn canvas-nav-left" onClick={e => { e.stopPropagation(); const idx = eventTemplates.findIndex(t => t.id === selectedTemplate.id); const prev = eventTemplates[(idx - 1 + eventTemplates.length) % eventTemplates.length]; loadTemplate(prev) }}><HiOutlineChevronLeft /></button>
            <button className="canvas-nav-btn canvas-nav-right" onClick={e => { e.stopPropagation(); const idx = eventTemplates.findIndex(t => t.id === selectedTemplate.id); const next = eventTemplates[(idx + 1) % eventTemplates.length]; loadTemplate(next) }}><HiOutlineChevronRight /></button>
          </>
        )}

        <div ref={canvasRef} className="editor-canvas"
          style={{ width: paperSize.width * CANVAS_SCALE, height: paperSize.height * CANVAS_SCALE, background: bgPreview ? `url("${bgPreview}") center/cover` : bgColor, border: '1px solid var(--color-border)', position: 'relative' }}>
          {slots.map((slot, i) => (
            <div key={i} className={`photo-slot ${selectedSlot === i ? 'selected' : ''}`}
              style={{ left: slot.x * CANVAS_SCALE, top: slot.y * CANVAS_SCALE, width: slot.width * CANVAS_SCALE, height: slot.height * CANVAS_SCALE }}
              onMouseDown={e => handleSlotMouseDown(e, i)}>
              <span style={{ pointerEvents: 'none' }}>{slot.slot}</span>
              {selectedSlot === i && <div className="resize-handle br" onMouseDown={e => handleResizeMouseDown(e, i)} />}
            </div>
          ))}
        </div>

        {/* Bring Forward / Send Backward */}
        {selectedSlot !== null && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => moveSlotOrder(selectedSlot, -1)}><HiOutlineArrowUp /> Bring Forward</button>
            <button className="btn btn-sm" onClick={() => moveSlotOrder(selectedSlot, 1)}><HiOutlineArrowDown /> Send Backward</button>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR — Properties */}
      <div className="editor-sidebar">
        <div className="editor-sidebar-header">Selected</div>
        <div className="editor-sidebar-body">
          {sel ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div className="input-group"><label className="input-label">X</label><input className="input" type="number" value={sel.x} onChange={e => updateSlotProp(selectedSlot, 'x', e.target.value)} /></div>
                <div className="input-group"><label className="input-label">Y</label><input className="input" type="number" value={sel.y} onChange={e => updateSlotProp(selectedSlot, 'y', e.target.value)} /></div>
                <div className="input-group"><label className="input-label">W</label><input className="input" type="number" value={sel.width} onChange={e => updateSlotProp(selectedSlot, 'width', e.target.value)} /></div>
                <div className="input-group"><label className="input-label">H</label><input className="input" type="number" value={sel.height} onChange={e => updateSlotProp(selectedSlot, 'height', e.target.value)} /></div>
              </div>

              <div className="setting-row" style={{ marginTop: 8 }}>
                <span className="setting-label">Keep aspect ratio</span>
                <label className="toggle"><input type="checkbox" checked={keepAspect} onChange={e => setKeepAspect(e.target.checked)} /><div className="toggle-track" /><div className="toggle-thumb" /></label>
              </div>

              <div className="input-group"><label className="input-label">Rotate</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input className="input" type="number" value={sel.rotation || 0} onChange={e => updateSlotProp(selectedSlot, 'rotation', e.target.value)} style={{ width: 60 }} /><span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>°</span>
                </div>
              </div>

              {/* Alignment */}
              <div style={{ marginTop: 12 }}>
                <div className="input-label" style={{ marginBottom: 6 }}>Alignment</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {[
                    { label: '⬆', act: 'top' }, { label: '⬇', act: 'bottom' }, { label: '⬅', act: 'left' }, { label: '➡', act: 'right' },
                    { label: '↔', act: 'centerH' }, { label: '↕', act: 'centerV' },
                  ].map(a => <button key={a.act} className="btn btn-sm btn-ghost" onClick={() => alignSlot(selectedSlot, a.act)}>{a.label}</button>)}
                </div>
              </div>

              <button className="btn btn-sm btn-danger" style={{ marginTop: 12, width: '100%' }} onClick={() => removeSlot(selectedSlot)}><HiOutlineTrash /> Delete slot</button>
            </>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>Click a slot to edit its properties</div>
          )}

          {/* Layers */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10 }}>
            <div className="input-label" style={{ marginBottom: 6 }}>Layers</div>
            {slots.map((s, i) => (
              <div key={i} className="card" style={{ padding: '4px 8px', marginBottom: 4, cursor: 'pointer', borderColor: selectedSlot === i ? 'var(--color-accent)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                onClick={() => setSelectedSlot(i)}>
                <div style={{ width: 20, height: 14, background: 'var(--color-accent-muted)', borderRadius: 2, flexShrink: 0 }} />
                <span>Slot {s.slot}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>{s.width}×{s.height}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
