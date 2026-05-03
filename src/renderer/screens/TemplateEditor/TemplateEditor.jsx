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
  const [bgZIndex, setBgZIndex] = useState(999)
  const [bgProps, setBgProps] = useState({ x: 0, y: 0, width: 600, height: 900 })
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
    setBgZIndex(tpl.bg_z_index !== undefined ? tpl.bg_z_index : 999)
    const paper = PAPER_SIZES[tpl.paper_size || '4x6']
    setBgProps({ x: tpl.bg_x || 0, y: tpl.bg_y || 0, width: tpl.bg_width || paper.width, height: tpl.bg_height || paper.height })
    setSelectedSlot(null)
  }, [])

  const handleCreate = async () => {
    if (!formData.name.trim() || !activeEvent) return
    const tpl = { id: `tpl_${Date.now()}`, name: formData.name, paper_size: formData.paper_size, background_image: null, bg_color: '#1e1e22', photo_slots: [], event_id: activeEvent.id, dpi: 300 }
    await addTemplate(tpl)
    loadTemplate(tpl)
    setShowCreateModal(false)
    setFormData({ name: '', paper_size: '4x6' })
  }

  const handleSave = async () => {
    if (!selectedTemplate) return
    await editTemplate(selectedTemplate.id, { photo_slots: slots, background_image: backgroundImage, bg_color: bgColor, bg_z_index: bgZIndex, bg_x: bgProps.x, bg_y: bgProps.y, bg_width: bgProps.width, bg_height: bgProps.height, dpi: selectedTemplate.dpi })
    setSelectedTemplate(prev => ({ ...prev, photo_slots: slots, background_image: backgroundImage, bg_color: bgColor, bg_z_index: bgZIndex, bg_x: bgProps.x, bg_y: bgProps.y, bg_width: bgProps.width, bg_height: bgProps.height }))
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
    const nextIdx = slots.length > 0 ? Math.max(...slots.map(s => s.photo_index ?? (s.slot - 1))) + 1 : 0
    const newSlot = { slot: slots.length + 1, x: 50, y: 50 + slots.length * 60, width: Math.min(200, paper.width - 100), height: Math.min(150, paper.height - 100), rotation: 0, bg_color: 'transparent', z_index: slots.length + 1, photo_index: nextIdx }
    setSlots(prev => [...prev, newSlot])
    setSelectedSlot(slots.length)
  }

  const removeSlot = (i) => {
    setSlots(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, slot: idx + 1 })))
    setSelectedSlot(null)
  }

  const updateSlotProp = (i, prop, value) => {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [prop]: prop === 'bg_color' ? value : (Number(value) || 0) } : s))
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
      if (isDragging && selectedSlot !== null && selectedSlot !== 'bg') {
        const rect = canvasRef.current.getBoundingClientRect()
        let x = (e.clientX - rect.left - dragOffset.x) / CANVAS_SCALE
        let y = (e.clientY - rect.top - dragOffset.y) / CANVAS_SCALE
        x = Math.max(0, Math.min(x, paper.width - slots[selectedSlot].width))
        y = Math.max(0, Math.min(y, paper.height - slots[selectedSlot].height))
        setSlots(prev => prev.map((s, i) => i === selectedSlot ? { ...s, x: Math.round(x), y: Math.round(y) } : s))
      }
      if (isResizing && selectedSlot !== null && selectedSlot !== 'bg') {
        let w = Math.max(60, dragOffset.startW + (e.clientX - dragOffset.x) / CANVAS_SCALE)
        let h = keepAspect ? w / dragOffset.aspect : Math.max(60, dragOffset.startH + (e.clientY - dragOffset.y) / CANVAS_SCALE)
        w = Math.min(w, paper.width - slots[selectedSlot].x)
        h = Math.min(h, paper.height - slots[selectedSlot].y)
        setSlots(prev => prev.map((s, i) => i === selectedSlot ? { ...s, width: Math.round(w), height: Math.round(h) } : s))
      }
      if (isDragging && selectedSlot === 'bg') {
        const rect = canvasRef.current.getBoundingClientRect()
        let x = (e.clientX - rect.left - dragOffset.x) / CANVAS_SCALE
        let y = (e.clientY - rect.top - dragOffset.y) / CANVAS_SCALE
        setBgProps(prev => ({ ...prev, x: Math.round(x), y: Math.round(y) }))
      }
      if (isResizing && selectedSlot === 'bg') {
        let w = Math.max(20, dragOffset.startW + (e.clientX - dragOffset.x) / CANVAS_SCALE)
        let h = keepAspect ? w / dragOffset.aspect : Math.max(20, dragOffset.startH + (e.clientY - dragOffset.y) / CANVAS_SCALE)
        setBgProps(prev => ({ ...prev, width: Math.round(w), height: Math.round(h) }))
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
        <div className="toolbar" style={{ margin: '-16px -16px 16px' }}>
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
          <div className="input-group" style={{ marginTop: 8 }}><label className="input-label">Resolution (DPI)</label>
            <select className="select" value={selectedTemplate.dpi || 300} onChange={e => {
              const val = Number(e.target.value)
              setSelectedTemplate(prev => ({ ...prev, dpi: val }))
              editTemplate(selectedTemplate.id, { dpi: val })
            }}>
              <option value="150">150 DPI (Fast)</option>
              <option value="300">300 DPI (Standard)</option>
              <option value="600">600 DPI (High Quality)</option>
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
          style={{ width: paperSize.width * CANVAS_SCALE, height: paperSize.height * CANVAS_SCALE, backgroundColor: bgColor, border: '1px solid var(--color-border)', position: 'relative', overflow: 'hidden' }}>
          
          {bgPreview && (
            <div 
              style={{
                position: 'absolute',
                left: bgProps.x * CANVAS_SCALE,
                top: bgProps.y * CANVAS_SCALE,
                width: bgProps.width * CANVAS_SCALE,
                height: bgProps.height * CANVAS_SCALE,
                zIndex: bgZIndex,
                opacity: selectedSlot === 'bg' ? 0.7 : 0.85,
                cursor: selectedSlot === 'bg' ? 'move' : 'default',
                pointerEvents: selectedSlot === 'bg' ? 'auto' : 'none',
                border: selectedSlot === 'bg' ? '2px solid var(--color-accent)' : 'none'
              }}
              onMouseDown={e => { e.stopPropagation(); setSelectedSlot('bg'); setIsDragging(true); const rect = canvasRef.current.getBoundingClientRect(); setDragOffset({ x: e.clientX - rect.left - bgProps.x * CANVAS_SCALE, y: e.clientY - rect.top - bgProps.y * CANVAS_SCALE }) }}
            >
              <img src={bgPreview} alt="Overlay" style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />
              {selectedSlot === 'bg' && <div className="resize-handle br" style={{ pointerEvents: 'auto' }} onMouseDown={e => { e.stopPropagation(); setSelectedSlot('bg'); setIsResizing(true); setDragOffset({ x: e.clientX, y: e.clientY, startW: bgProps.width, startH: bgProps.height, aspect: bgProps.width / bgProps.height }) }} />}
            </div>
          )}

          {slots.map((slot, i) => (
            <div key={i} className={`photo-slot ${selectedSlot === i ? 'selected' : ''}`}
              style={{ 
                left: slot.x * CANVAS_SCALE, 
                top: slot.y * CANVAS_SCALE, 
                width: slot.width * CANVAS_SCALE, 
                height: slot.height * CANVAS_SCALE,
                transform: `rotate(${slot.rotation || 0}deg)`,
                backgroundColor: slot.bg_color || 'transparent',
                zIndex: slot.z_index || (i + 1)
              }}
              onMouseDown={e => handleSlotMouseDown(e, i)}>
              <span style={{ pointerEvents: 'none', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 4, color: 'white' }}>Take {(slot.photo_index ?? slot.slot - 1) + 1}</span>
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

              <div className="input-group" style={{ marginTop: 8 }}><label className="input-label">Slot Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="color" value={sel.bg_color && sel.bg_color !== 'transparent' ? sel.bg_color : '#000000'} onChange={e => updateSlotProp(selectedSlot, 'bg_color', e.target.value)} style={{ width: 30, height: 30, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
                  <button className="btn btn-sm btn-ghost" onClick={() => updateSlotProp(selectedSlot, 'bg_color', 'transparent')}>Clear</button>
                </div>
              </div>

              <div className="input-group" style={{ marginTop: 8 }}><label className="input-label">Photo Source (Take #)</label>
                <input className="input" type="number" min="1" value={(sel.photo_index !== undefined ? sel.photo_index : sel.slot - 1) + 1} onChange={e => updateSlotProp(selectedSlot, 'photo_index', Math.max(0, parseInt(e.target.value) - 1))} />
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>Set same number to duplicate a photo</div>
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
          ) : selectedSlot === 'bg' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                <div className="input-group"><label className="input-label">X</label><input className="input" type="number" value={bgProps.x} onChange={e => setBgProps(p => ({ ...p, x: Number(e.target.value) || 0 }))} /></div>
                <div className="input-group"><label className="input-label">Y</label><input className="input" type="number" value={bgProps.y} onChange={e => setBgProps(p => ({ ...p, y: Number(e.target.value) || 0 }))} /></div>
                <div className="input-group"><label className="input-label">W</label><input className="input" type="number" value={bgProps.width} onChange={e => setBgProps(p => ({ ...p, width: Number(e.target.value) || 10 }))} /></div>
                <div className="input-group"><label className="input-label">H</label><input className="input" type="number" value={bgProps.height} onChange={e => setBgProps(p => ({ ...p, height: Number(e.target.value) || 10 }))} /></div>
              </div>
              <div className="setting-row" style={{ marginTop: 8, marginBottom: 12 }}>
                <span className="setting-label">Keep aspect ratio</span>
                <label className="toggle"><input type="checkbox" checked={keepAspect} onChange={e => setKeepAspect(e.target.checked)} /><div className="toggle-track" /><div className="toggle-thumb" /></label>
              </div>
              <div className="input-group">
                <label className="input-label">Overlay Z-Index</label>
                <input className="input" type="number" value={bgZIndex} onChange={e => setBgZIndex(parseInt(e.target.value) || 0)} />
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>Higher number puts the template ON TOP of the photos. Lower numbers (e.g. -1) put it BEHIND.</div>
              </div>
              <button className="btn btn-sm btn-ghost" style={{ marginTop: 12, width: '100%', color: 'var(--color-danger)' }} onClick={() => { setBackgroundImage(null); setBgPreview(null); setSelectedSlot(null) }}><HiOutlineTrash /> Remove Image</button>
            </>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>Click a slot or layer to edit properties</div>
          )}

          {/* Layers */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10 }}>
            <div className="input-label" style={{ marginBottom: 6 }}>Layers</div>
            {bgPreview && (
              <div className="card" style={{ padding: '4px 8px', marginBottom: 4, cursor: 'pointer', borderColor: selectedSlot === 'bg' ? 'var(--color-accent)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                onClick={() => setSelectedSlot('bg')}>
                <div style={{ width: 20, height: 14, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
                <span>Template Overlay</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>Z: {bgZIndex}</span>
              </div>
            )}
            {slots.map((s, i) => (
              <div key={i} className="card" style={{ padding: '4px 8px', marginBottom: 4, cursor: 'pointer', borderColor: selectedSlot === i ? 'var(--color-accent)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                onClick={() => setSelectedSlot(i)}>
                <div style={{ width: 20, height: 14, background: 'var(--color-accent-muted)', borderRadius: 2, flexShrink: 0 }} />
                <span>Slot {s.slot} (Take {(s.photo_index ?? s.slot - 1) + 1})</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>Z: {s.z_index || (i + 1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
