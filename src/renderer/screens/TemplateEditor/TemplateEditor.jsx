import { useState, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/Modal'
import {
  HiOutlinePlus, HiOutlineTrash, HiOutlineSave, HiOutlineUpload,
  HiOutlinePhotograph, HiOutlineChevronLeft, HiOutlineChevronRight,
  HiOutlineQrcode, HiOutlineUser, HiOutlineColorSwatch, HiOutlineCube,
  HiOutlineDocumentText, HiOutlineArrowUp, HiOutlineArrowDown,
  HiOutlineDuplicate, HiOutlineEye, HiOutlineEyeOff, HiOutlineLockClosed,
  HiOutlineLockOpen, HiOutlineViewGridAdd,
  HiOutlineZoomIn, HiOutlineZoomOut, HiOutlineRefresh,
} from 'react-icons/hi'

const PAPER_SIZES = {
  '6x4':       { width: 900,  height: 600,  label: '6×4 Landscape' },
  '7x5':       { width: 1050, height: 750,  label: '7×5 Landscape' },
  '8x6':       { width: 1200, height: 900,  label: '8×6 Landscape' },
  '4x6':       { width: 600,  height: 900,  label: '4×6 Portrait'  },
  '5x7':       { width: 750,  height: 1050, label: '5×7 Portrait'  },
  '6x8':       { width: 900,  height: 1200, label: '6×8 Portrait'  },
  '2x6_strip': { width: 300,  height: 900,  label: '2×6 Strip'     },
  '2x8_strip': { width: 300,  height: 1200, label: '2×8 Strip'     },
  '4x4':       { width: 600,  height: 600,  label: '4×4 Square'    },
  '3x5':       { width: 450,  height: 750,  label: '3×5 Portrait'  },
  '6x9':       { width: 900,  height: 1350, label: '6×9 Postcard'  },
}

const uid = () => `el_${Date.now()}_${Math.random().toString(36).slice(2,7)}`

const makePhoto = (els, paper) => ({
  id: uid(), type: 'photo',
  slot: els.filter(e => e.type === 'photo').length + 1,
  copies: 1,
  label: `Foto ${els.filter(e => e.type === 'photo').length + 1}`,
  x: 30, y: 30 + els.length * 20,
  width: Math.min(200, paper.width - 60),
  height: Math.min(160, paper.height - 60),
  rotation: 0, visible: true, locked: false, zIndex: els.length,
})

const makeText = (els) => ({
  id: uid(), type: 'text', text: 'Teks baru',
  fontSize: 24, fontFamily: 'sans-serif', color: '#ffffff',
  align: 'center', bold: false, italic: false,
  x: 80, y: 80, width: 200, height: 50,
  rotation: 0, visible: true, locked: false, zIndex: els.length,
})

const makeShape = (els) => ({
  id: uid(), type: 'shape', shape: 'rect',
  fill: '#ffffff22', stroke: '#ffffff66', strokeWidth: 2, radius: 0,
  x: 60, y: 60, width: 150, height: 100,
  rotation: 0, visible: true, locked: false, zIndex: els.length,
})

function LayerIcon({ type }) {
  if (type === 'photo') return <HiOutlinePhotograph style={{flexShrink:0}} />
  if (type === 'text')  return <HiOutlineDocumentText style={{flexShrink:0}} />
  return <HiOutlineCube style={{flexShrink:0}} />
}

function Num({ label, value, onChange, min, style }) {
  return (
    <div className="input-group" style={style}>
      <label className="input-label">{label}</label>
      <input className="input" type="number" value={value} min={min}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ padding: '3px 6px', fontSize: 12 }} />
    </div>
  )
}

export default function TemplateEditor() {
  const { templates, addTemplate, editTemplate, removeTemplate, activeEvent } = useApp()
  const eventTemplates = activeEvent ? templates.filter(t => t.event_id === activeEvent.id) : []

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showCreateModal, setShowCreateModal]   = useState(false)
  const [formData, setFormData]                 = useState({ name: '', paper_size: '4x6' })
  const [elements, setElements]                 = useState([])
  const [selectedId, setSelectedId]             = useState(null)
  const [bgImage, setBgImage]                   = useState(null)
  const [bgPreview, setBgPreview]               = useState(null)
  const [bgColor, setBgColor]                   = useState('#1e1e22')
  const [dragState, setDragState]               = useState(null)
  const [zoom, setZoom]                         = useState(0.55)
  const [showDropdown, setShowDropdown]         = useState(false)
  const [keepAspect, setKeepAspect]             = useState(false)
  const [layersOpen, setLayersOpen]             = useState(true)
  const canvasRef = useRef(null)

  const paper  = PAPER_SIZES[selectedTemplate?.paper_size || '4x6']
  const sel    = selectedId ? elements.find(e => e.id === selectedId) : null
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex)

  const loadTemplate = useCallback((tpl) => {
    setSelectedTemplate(tpl)
    const els = tpl.elements || tpl.photo_slots?.map((s, i) => ({
      ...s, id: s.id || `el_${i}`, type: 'photo',
      visible: s.visible !== false, locked: !!s.locked, copies: s.copies || 1, zIndex: i,
    })) || []
    setElements(els)
    setBgImage(tpl.background_image || null)
    let prev = null
    if (tpl.background_image) {
      prev = tpl.background_image.startsWith('blob:') || tpl.background_image.startsWith('http')
        ? tpl.background_image : `file://${tpl.background_image.replace(/\\/g, '/')}`
    }
    setBgPreview(prev)
    setBgColor(tpl.bg_color || '#1e1e22')
    setSelectedId(null)
  }, [])

  const handleCreate = async () => {
    if (!formData.name.trim() || !activeEvent) return
    const tpl = { id: `tpl_${Date.now()}`, name: formData.name, paper_size: formData.paper_size,
      background_image: null, bg_color: '#1e1e22', elements: [], photo_slots: [], event_id: activeEvent.id }
    await addTemplate(tpl)
    loadTemplate(tpl)
    setShowCreateModal(false)
    setFormData({ name: '', paper_size: '4x6' })
  }

  const toPayload = () => {
    const photo_slots = elements.filter(e => e.type === 'photo')
    return { elements, photo_slots, background_image: bgImage, bg_color: bgColor }
  }
  const handleSave = async () => {
    if (!selectedTemplate) return
    const p = toPayload()
    await editTemplate(selectedTemplate.id, p)
    setSelectedTemplate(prev => ({ ...prev, ...p }))
  }
  const goBack = async () => {
    if (selectedTemplate) await editTemplate(selectedTemplate.id, toPayload())
    setSelectedTemplate(null); setElements([]); setBgPreview(null)
  }
  const deleteTpl = async (id) => {
    if (!confirm('Hapus template ini?')) return
    await removeTemplate(id)
    if (selectedTemplate?.id === id) { setSelectedTemplate(null); setElements([]); setBgPreview(null) }
  }
  const dupTpl = async (tpl, e) => {
    e.stopPropagation()
    await addTemplate({ ...tpl, id: `tpl_${Date.now()}`, name: `${tpl.name} (copy)` })
  }

  const upd = (id, u) => setElements(prev => prev.map(e => e.id === id ? { ...e, ...u } : e))
  const del = (id) => { setElements(prev => prev.filter(e => e.id !== id)); if (selectedId === id) setSelectedId(null) }
  const dup = (id) => {
    const el = elements.find(e => e.id === id); if (!el) return
    const copy = { ...el, id: uid(), x: el.x + 20, y: el.y + 20, zIndex: elements.length,
      slot: el.type === 'photo' ? elements.filter(e => e.type === 'photo').length + 1 : el.slot,
      label: el.type === 'photo' ? `Foto ${elements.filter(e => e.type === 'photo').length + 1}` : el.label }
    setElements(prev => [...prev, copy]); setSelectedId(copy.id)
  }

  const layerUp = (id) => {
    const i = elements.findIndex(e => e.id === id); if (i >= elements.length - 1) return
    const n = [...elements];[n[i], n[i+1]] = [n[i+1], n[i]]; n.forEach((e,j) => e.zIndex=j); setElements(n)
  }
  const layerDown = (id) => {
    const i = elements.findIndex(e => e.id === id); if (i <= 0) return
    const n = [...elements];[n[i], n[i-1]] = [n[i-1], n[i]]; n.forEach((e,j) => e.zIndex=j); setElements(n)
  }

  const handleBgUpload = async () => {
    if (window.electronAPI) {
      const fp = await window.electronAPI.openFileDialog({ filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp'] }] })
      if (fp) { setBgImage(fp); setBgPreview(`file://${fp.replace(/\\/g, '/')}`) }
    } else {
      const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'
      inp.onchange = e => { const f=e.target.files[0]; if(f){const u=URL.createObjectURL(f);setBgPreview(u);setBgImage(u)} }
      inp.click()
    }
  }

  const startMove = (e, id) => {
    e.stopPropagation()
    const el = elements.find(x => x.id === id); if (!el || el.locked) return
    setSelectedId(id)
    setDragState({ type:'move', id, startMouse:{x:e.clientX,y:e.clientY}, startEl:{x:el.x,y:el.y} })
  }
  const startResize = (e, id, corner) => {
    e.stopPropagation()
    const el = elements.find(x => x.id === id); if (!el || el.locked) return
    setDragState({ type:'resize', corner, id, startMouse:{x:e.clientX,y:e.clientY},
      startEl:{x:el.x,y:el.y,width:el.width,height:el.height}, aspect:el.width/el.height })
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState) return
      const dx = (e.clientX - dragState.startMouse.x) / zoom
      const dy = (e.clientY - dragState.startMouse.y) / zoom
      const s = dragState.startEl
      const el = elements.find(x => x.id === dragState.id); if (!el) return
      const p = PAPER_SIZES[selectedTemplate?.paper_size || '4x6']
      if (dragState.type === 'move') {
        upd(dragState.id, {
          x: Math.round(Math.max(0, Math.min(s.x+dx, p.width-el.width))),
          y: Math.round(Math.max(0, Math.min(s.y+dy, p.height-el.height))),
        })
      }
      if (dragState.type === 'resize') {
        const c = dragState.corner
        let w=s.width, h=s.height, x=s.x, y=s.y
        if (c==='br'){w=Math.max(40,s.width+dx);  h=keepAspect?w/dragState.aspect:Math.max(40,s.height+dy)}
        if (c==='bl'){w=Math.max(40,s.width-dx);  h=keepAspect?w/dragState.aspect:Math.max(40,s.height+dy); x=s.x+s.width-w}
        if (c==='tr'){w=Math.max(40,s.width+dx);  h=keepAspect?w/dragState.aspect:Math.max(40,s.height-dy); y=s.y+s.height-h}
        if (c==='tl'){w=Math.max(40,s.width-dx);  h=keepAspect?w/dragState.aspect:Math.max(40,s.height-dy); x=s.x+s.width-w; y=s.y+s.height-h}
        w=Math.min(w, p.width-x); h=Math.min(h, p.height-y)
        upd(dragState.id, {x:Math.round(x),y:Math.round(y),width:Math.round(w),height:Math.round(h)})
      }
    }
    const onUp = () => setDragState(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragState, zoom, elements, selectedTemplate, keepAspect])

  useEffect(() => {
    const onKey = (e) => {
      if (!selectedId || e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return
      const el = elements.find(x => x.id === selectedId); if (!el || el.locked) return
      const step = e.shiftKey ? 10 : 1
      if (e.key==='ArrowLeft')  { upd(selectedId,{x:el.x-step}); e.preventDefault() }
      if (e.key==='ArrowRight') { upd(selectedId,{x:el.x+step}); e.preventDefault() }
      if (e.key==='ArrowUp')    { upd(selectedId,{y:el.y-step}); e.preventDefault() }
      if (e.key==='ArrowDown')  { upd(selectedId,{y:el.y+step}); e.preventDefault() }
      if (e.key==='Delete'||e.key==='Backspace') del(selectedId)
      if ((e.ctrlKey||e.metaKey)&&e.key==='d') { e.preventDefault(); dup(selectedId) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, elements])

  const align = (type) => {
    if (!sel) return
    const p = PAPER_SIZES[selectedTemplate?.paper_size || '4x6']
    const u = {}
    if (type==='left')    u.x = 0
    if (type==='right')   u.x = p.width - sel.width
    if (type==='top')     u.y = 0
    if (type==='bottom')  u.y = p.height - sel.height
    if (type==='centerH') u.x = (p.width  - sel.width)  / 2
    if (type==='centerV') u.y = (p.height - sel.height) / 2
    upd(sel.id, u)
  }

  // ── NO EVENT ──
  if (!activeEvent) return (
    <div style={{padding:16,height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="empty-state"><h3>Tidak ada event dipilih</h3><p>Pilih event di Dashboard terlebih dahulu.</p></div>
    </div>
  )

  // ── TEMPLATE LIST ──
  if (!selectedTemplate) return (
    <div style={{padding:16}}>
      <div className="toolbar" style={{margin:'-16px -16px 16px',padding:'8px 16px'}}>
        <span style={{fontSize:14,fontWeight:700}}>Print Layout</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-sm btn-primary" onClick={()=>setShowCreateModal(true)}><HiOutlinePlus /> Template Baru</button>
      </div>
      {eventTemplates.length===0 ? (
        <div className="empty-state">
          <h3>Belum ada template</h3><p>Buat template untuk mendesain layout foto</p>
          <button className="btn btn-primary" style={{marginTop:12}} onClick={()=>setShowCreateModal(true)}><HiOutlinePlus /> Template Baru</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
          {eventTemplates.map(tpl => (
            <div key={tpl.id} className="card card-clickable" onClick={()=>loadTemplate(tpl)} style={{padding:0,overflow:'hidden'}}>
              <div style={{aspectRatio:'4/3',background:'var(--color-bg-overlay)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
                {tpl.background_image
                  ? <img src={tpl.background_image.startsWith('blob:')||tpl.background_image.startsWith('http')?tpl.background_image:`file://${tpl.background_image.replace(/\\/g,'/')}`} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'} />
                  : <HiOutlinePhotograph style={{fontSize:28,color:'var(--color-text-muted)'}} />}
                <span className="badge badge-neutral" style={{position:'absolute',bottom:6,right:6}}>
                  {(tpl.elements||tpl.photo_slots||[]).filter(e=>e.type==='photo'||!e.type).length} foto
                </span>
              </div>
              <div style={{padding:'8px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{tpl.name}</div>
                  <div style={{fontSize:10,color:'var(--color-text-muted)'}}>{PAPER_SIZES[tpl.paper_size]?.label||tpl.paper_size}</div>
                </div>
                <div style={{display:'flex',gap:2}}>
                  <button className="btn btn-ghost btn-sm" title="Duplikat" onClick={e=>dupTpl(tpl,e)} style={{padding:4,color:'var(--color-text-muted)'}}><HiOutlineDuplicate /></button>
                  <button className="btn btn-ghost btn-sm" title="Hapus" onClick={e=>{e.stopPropagation();deleteTpl(tpl.id)}} style={{padding:4,color:'var(--color-danger)'}}><HiOutlineTrash /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal isOpen={showCreateModal} onClose={()=>setShowCreateModal(false)} title="Template Baru"
        footer={<><button className="btn" onClick={()=>setShowCreateModal(false)}>Batal</button><button className="btn btn-primary" onClick={handleCreate}>Buat</button></>}>
        <div className="input-group"><label className="input-label">Nama</label>
          <input className="input" placeholder="cth. Template Ramadhan" value={formData.name} onChange={e=>setFormData(f=>({...f,name:e.target.value}))} autoFocus /></div>
        <div className="input-group"><label className="input-label">Ukuran Kertas</label>
          <select className="select" value={formData.paper_size} onChange={e=>setFormData(f=>({...f,paper_size:e.target.value}))}>
            {Object.entries(PAPER_SIZES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
      </Modal>
    </div>
  )

  // ── EDITOR ──
  return (
    <div className="editor-layout" style={{height:'100%'}}>

      {/* LEFT SIDEBAR */}
      <div className="editor-left-sidebar" style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
        <div className="editor-sidebar-header">
          <button className="btn btn-ghost btn-sm" onClick={goBack} style={{gap:4}}><HiOutlineChevronLeft /> Kembali</button>
        </div>

        {/* Template dropdown */}
        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--color-border-subtle)',position:'relative'}}>
          <button className="btn btn-sm" style={{width:'100%',justifyContent:'space-between'}} onClick={()=>setShowDropdown(!showDropdown)}>
            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selectedTemplate.name}</span><span>▾</span>
          </button>
          {showDropdown && (
            <div style={{position:'absolute',top:'100%',left:8,right:8,background:'var(--color-bg-elevated)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-md)',zIndex:30,marginTop:4,maxHeight:200,overflowY:'auto'}}>
              {eventTemplates.map(t=>(
                <div key={t.id} onClick={()=>{loadTemplate(t);setShowDropdown(false)}}
                  style={{padding:'6px 10px',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:8,background:t.id===selectedTemplate.id?'var(--color-accent-muted)':'transparent',color:t.id===selectedTemplate.id?'var(--color-accent)':'var(--color-text-secondary)'}}>
                  <div style={{width:32,height:22,borderRadius:2,background:'var(--color-bg-overlay)',flexShrink:0,overflow:'hidden'}}>
                    {t.background_image&&<img src={t.background_image.startsWith('blob:')||t.background_image.startsWith('http')?t.background_image:`file://${t.background_image.replace(/\\/g,'/')}`} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'} />}
                  </div>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{t.name}</span>
                </div>
              ))}
              <div style={{padding:'6px 10px',borderTop:'1px solid var(--color-border-subtle)'}}>
                <button className="btn btn-sm btn-ghost" style={{width:'100%',justifyContent:'flex-start',fontSize:11}} onClick={()=>{setShowDropdown(false);setSelectedTemplate(null)}}>
                  <HiOutlinePlus /> Template baru
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add elements */}
        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--color-border-subtle)'}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Tambah Elemen</div>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            <button className="btn btn-sm btn-ghost" style={{justifyContent:'flex-start'}} onClick={()=>{const el=makePhoto(elements,paper);setElements(p=>[...p,el]);setSelectedId(el.id)}}><HiOutlinePhotograph /> Slot Foto Booth</button>
            <button className="btn btn-sm btn-ghost" style={{justifyContent:'flex-start'}} onClick={handleBgUpload}><HiOutlineUpload /> Gambar / Background</button>
            <button className="btn btn-sm btn-ghost" style={{justifyContent:'flex-start'}} onClick={()=>{const el=makeText(elements);setElements(p=>[...p,el]);setSelectedId(el.id)}}><HiOutlineDocumentText /> Teks</button>
            <button className="btn btn-sm btn-ghost" style={{justifyContent:'flex-start'}} onClick={()=>{const el=makeShape(elements);setElements(p=>[...p,el]);setSelectedId(el.id)}}><HiOutlineCube /> Shape</button>
            <button className="btn btn-sm btn-ghost" style={{justifyContent:'flex-start',opacity:0.5}}><HiOutlineQrcode /> QR Code</button>
            <button className="btn btn-sm btn-ghost" style={{justifyContent:'flex-start',opacity:0.5}}><HiOutlineUser /> Data Sesi</button>
          </div>
        </div>

        {/* Canvas props */}
        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--color-border-subtle)'}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Kanvas</div>
          <div className="input-group">
            <label className="input-label">Warna Background</label>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)} style={{width:32,height:26,border:'none',borderRadius:4,cursor:'pointer'}} />
              <input className="input" value={bgColor} onChange={e=>setBgColor(e.target.value)} style={{flex:1,fontSize:11}} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Ukuran Kertas</label>
            <select className="select" style={{fontSize:11}} value={selectedTemplate.paper_size} onChange={e=>{const s=e.target.value;setSelectedTemplate(p=>({...p,paper_size:s}));editTemplate(selectedTemplate.id,{paper_size:s})}}>
              {Object.entries(PAPER_SIZES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* LAYERS PANEL */}
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'6px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',borderBottom:'1px solid var(--color-border-subtle)'}} onClick={()=>setLayersOpen(o=>!o)}>
            <span style={{fontSize:10,fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:0.5}}>Layer ({elements.length})</span>
            <span style={{fontSize:10,color:'var(--color-text-muted)'}}>{layersOpen?'▲':'▼'}</span>
          </div>
          {layersOpen && (
            <div style={{flex:1,overflowY:'auto',padding:'4px 8px'}}>
              {[...elements].reverse().map(el => (
                <div key={el.id} onClick={()=>!el.locked&&setSelectedId(el.id)}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'4px 5px',marginBottom:2,borderRadius:5,cursor:el.locked?'default':'pointer',fontSize:11,background:selectedId===el.id?'var(--color-accent-muted)':'transparent',border:`1px solid ${selectedId===el.id?'var(--color-accent)':'transparent'}`,opacity:el.visible?1:0.4}}>
                  <span style={{color:'var(--color-text-muted)',fontSize:12}}><LayerIcon type={el.type} /></span>
                  <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:selectedId===el.id?'var(--color-accent)':'var(--color-text-secondary)',fontSize:11}}>
                    {el.label||el.text||`${el.type} ${el.zIndex+1}`}
                  </span>
                  {el.type==='photo'&&el.copies>1&&(
                    <span style={{fontSize:9,background:'var(--color-accent-muted)',color:'var(--color-accent)',borderRadius:3,padding:'1px 4px'}}>×{el.copies}</span>
                  )}
                  <div style={{display:'flex',gap:0}}>
                    <button className="btn btn-ghost" style={{padding:2,fontSize:11,color:'var(--color-text-muted)'}} onClick={e=>{e.stopPropagation();upd(el.id,{visible:!el.visible})}} title={el.visible?'Sembunyikan':'Tampilkan'}>
                      {el.visible?<HiOutlineEye />:<HiOutlineEyeOff />}
                    </button>
                    <button className="btn btn-ghost" style={{padding:2,fontSize:11,color:'var(--color-text-muted)'}} onClick={e=>{e.stopPropagation();upd(el.id,{locked:!el.locked})}} title={el.locked?'Unlock':'Lock'}>
                      {el.locked?<HiOutlineLockClosed />:<HiOutlineLockOpen />}
                    </button>
                    <button className="btn btn-ghost" style={{padding:2,fontSize:11,color:'var(--color-text-muted)'}} onClick={e=>{e.stopPropagation();layerUp(el.id)}} title="Naikan"><HiOutlineArrowUp /></button>
                    <button className="btn btn-ghost" style={{padding:2,fontSize:11,color:'var(--color-text-muted)'}} onClick={e=>{e.stopPropagation();layerDown(el.id)}} title="Turunkan"><HiOutlineArrowDown /></button>
                  </div>
                </div>
              ))}
              {elements.length===0&&<div style={{fontSize:11,color:'var(--color-text-muted)',textAlign:'center',paddingTop:12}}>Belum ada elemen</div>}
            </div>
          )}
        </div>

        <div style={{padding:'10px 12px',borderTop:'1px solid var(--color-border-subtle)'}}>
          <button className="btn btn-primary btn-sm" style={{width:'100%'}} onClick={handleSave}><HiOutlineSave /> Simpan Template</button>
        </div>
      </div>

      {/* CENTER CANVAS */}
      <div className="editor-canvas-wrap" style={{position:'relative',overflow:'auto',flex:1}} onClick={()=>setSelectedId(null)}>
        {/* Zoom controls */}
        <div style={{position:'absolute',top:8,right:8,display:'flex',gap:4,zIndex:10,alignItems:'center'}}>
          <button className="btn btn-sm btn-ghost" onClick={()=>setZoom(z=>Math.min(z+0.1,2))}><HiOutlineZoomIn /></button>
          <span style={{fontSize:11,color:'var(--color-text-muted)',minWidth:36,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
          <button className="btn btn-sm btn-ghost" onClick={()=>setZoom(z=>Math.max(z-0.1,0.2))}><HiOutlineZoomOut /></button>
          <button className="btn btn-sm btn-ghost" onClick={()=>setZoom(0.55)}><HiOutlineRefresh /></button>
        </div>

        {eventTemplates.length>1&&(
          <>
            <button className="canvas-nav-btn canvas-nav-left" onClick={e=>{e.stopPropagation();const i=eventTemplates.findIndex(t=>t.id===selectedTemplate.id);loadTemplate(eventTemplates[(i-1+eventTemplates.length)%eventTemplates.length])}}><HiOutlineChevronLeft /></button>
            <button className="canvas-nav-btn canvas-nav-right" onClick={e=>{e.stopPropagation();const i=eventTemplates.findIndex(t=>t.id===selectedTemplate.id);loadTemplate(eventTemplates[(i+1)%eventTemplates.length])}}><HiOutlineChevronRight /></button>
          </>
        )}

        <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100%',padding:48}}>
          <div ref={canvasRef} className="editor-canvas"
            style={{width:paper.width*zoom,height:paper.height*zoom,background:bgPreview?`url("${bgPreview}") center/cover`:bgColor,border:'1px solid var(--color-border)',position:'relative',overflow:'hidden',flexShrink:0,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            {sorted.map(el => {
              if (!el.visible) return null
              const isSel = selectedId===el.id
              return (
                <div key={el.id} style={{position:'absolute',left:el.x*zoom,top:el.y*zoom,width:el.width*zoom,height:el.height*zoom,transform:`rotate(${el.rotation||0}deg)`,cursor:el.locked?'not-allowed':'move',outline:isSel?'2px solid var(--color-accent)':'1px dashed rgba(255,255,255,0.15)',outlineOffset:isSel?1:0,boxSizing:'border-box',userSelect:'none'}} onMouseDown={e=>startMove(e,el.id)}>
                  {el.type==='photo'&&(
                    <div style={{width:'100%',height:'100%',background:'rgba(255,255,255,0.07)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4}}>
                      <HiOutlinePhotograph style={{fontSize:22,color:'rgba(255,255,255,0.5)'}} />
                      <span style={{fontSize:Math.max(9,12*zoom),color:'rgba(255,255,255,0.75)',fontWeight:600}}>{el.label||`Foto ${el.slot}`}</span>
                      {el.copies>1&&<span style={{fontSize:Math.max(8,9*zoom),background:'rgba(100,180,255,0.2)',borderRadius:4,padding:'1px 6px',color:'#aef'}}>×{el.copies} sesi</span>}
                    </div>
                  )}
                  {el.type==='text'&&(
                    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:el.align==='left'?'flex-start':el.align==='right'?'flex-end':'center',overflow:'hidden'}}>
                      <span style={{fontSize:(el.fontSize||24)*zoom,color:el.color||'#fff',fontFamily:el.fontFamily,fontWeight:el.bold?700:400,fontStyle:el.italic?'italic':'normal',whiteSpace:'pre-wrap',textAlign:el.align,pointerEvents:'none'}}>{el.text}</span>
                    </div>
                  )}
                  {el.type==='shape'&&(
                    <div style={{width:'100%',height:'100%',background:el.fill,border:`${el.strokeWidth||1}px solid ${el.stroke||'#fff'}`,borderRadius:el.radius||0}} />
                  )}
                  {isSel&&!el.locked&&['tl','tr','bl','br'].map(c=>(
                    <div key={c} onMouseDown={e=>startResize(e,el.id,c)}
                      style={{position:'absolute',width:10,height:10,background:'var(--color-accent)',border:'2px solid white',borderRadius:2,cursor:c==='br'||c==='tl'?'nwse-resize':'nesw-resize',zIndex:100,...(c==='tl'?{top:-5,left:-5}:c==='tr'?{top:-5,right:-5}:c==='bl'?{bottom:-5,left:-5}:{bottom:-5,right:-5})}} />
                  ))}
                  {el.locked&&<div style={{position:'absolute',top:2,right:2,fontSize:10,color:'orange'}}><HiOutlineLockClosed /></div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick action bar */}
        {sel&&(
          <div style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',display:'flex',gap:4,background:'var(--color-bg-elevated)',border:'1px solid var(--color-border)',borderRadius:8,padding:'4px 8px',zIndex:20}}>
            <button className="btn btn-sm btn-ghost" onClick={()=>layerUp(sel.id)}><HiOutlineArrowUp /> Depan</button>
            <button className="btn btn-sm btn-ghost" onClick={()=>layerDown(sel.id)}><HiOutlineArrowDown /> Belakang</button>
            <button className="btn btn-sm btn-ghost" onClick={()=>dup(sel.id)}><HiOutlineDuplicate /> Duplikat</button>
            {sel.type==='photo'&&(
              <button className="btn btn-sm btn-ghost" onClick={()=>upd(sel.id,{copies:sel.copies===1?2:1})} style={{color:sel.copies>1?'var(--color-accent)':undefined}}>
                <HiOutlineViewGridAdd /> {sel.copies>1?`×${sel.copies} Sesi`:'Sesi Ganda'}
              </button>
            )}
            <div style={{width:1,background:'var(--color-border-subtle)',margin:'0 2px'}} />
            <button className="btn btn-sm btn-ghost" style={{color:'var(--color-danger)'}} onClick={()=>del(sel.id)}><HiOutlineTrash /></button>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="editor-sidebar" style={{overflowY:'auto'}}>
        <div className="editor-sidebar-header">{sel?(sel.label||sel.text||sel.type):'Properti'}</div>
        <div className="editor-sidebar-body">
          {sel ? (
            <>
              <div style={{fontSize:10,fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Transform</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                <Num label="X" value={sel.x}      onChange={v=>upd(sel.id,{x:v})} />
                <Num label="Y" value={sel.y}      onChange={v=>upd(sel.id,{y:v})} />
                <Num label="W" value={sel.width}  onChange={v=>upd(sel.id,{width:v})} min={10} />
                <Num label="H" value={sel.height} onChange={v=>upd(sel.id,{height:v})} min={10} />
              </div>
              <div style={{marginTop:6,display:'flex',gap:6,alignItems:'flex-end'}}>
                <Num label="Rotasi °" value={sel.rotation||0} onChange={v=>upd(sel.id,{rotation:v})} style={{flex:1}} />
                <label style={{fontSize:11,color:'var(--color-text-muted)',display:'flex',gap:4,alignItems:'center',cursor:'pointer',paddingBottom:6}}>
                  <input type="checkbox" checked={keepAspect} onChange={e=>setKeepAspect(e.target.checked)} /> Rasio
                </label>
              </div>

              {/* Photo props */}
              {sel.type==='photo'&&(
                <>
                  <div style={{height:1,background:'var(--color-border-subtle)',margin:'10px 0'}} />
                  <div style={{fontSize:10,fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Slot Foto</div>
                  <div className="input-group"><label className="input-label">Label</label>
                    <input className="input" style={{fontSize:12}} value={sel.label||''} onChange={e=>upd(sel.id,{label:e.target.value})} /></div>
                  <div className="input-group"><label className="input-label">Nomor slot</label>
                    <input className="input" type="number" style={{fontSize:12}} value={sel.slot} min={1} onChange={e=>upd(sel.id,{slot:parseInt(e.target.value)||1})} /></div>
                  <div className="setting-row" style={{marginTop:8}}>
                    <div>
                      <div style={{fontSize:12}}>Sesi Ganda</div>
                      <div style={{fontSize:10,color:'var(--color-text-muted)'}}>Foto dicetak 2× dari sesi yang sama</div>
                    </div>
                    <label className="toggle"><input type="checkbox" checked={sel.copies>1} onChange={()=>upd(sel.id,{copies:sel.copies===1?2:1})} /><div className="toggle-track"/><div className="toggle-thumb"/></label>
                  </div>
                  {sel.copies>1&&<Num label="Jumlah sesi" value={sel.copies} onChange={v=>upd(sel.id,{copies:Math.max(1,Math.round(v))})} min={1} style={{marginTop:6}} />}
                </>
              )}

              {/* Text props */}
              {sel.type==='text'&&(
                <>
                  <div style={{height:1,background:'var(--color-border-subtle)',margin:'10px 0'}} />
                  <div style={{fontSize:10,fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Teks</div>
                  <div className="input-group"><label className="input-label">Konten</label>
                    <textarea className="input" rows={2} style={{fontSize:12,resize:'vertical'}} value={sel.text} onChange={e=>upd(sel.id,{text:e.target.value})} /></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    <Num label="Ukuran" value={sel.fontSize||24} onChange={v=>upd(sel.id,{fontSize:v})} min={6} />
                    <div className="input-group"><label className="input-label">Warna</label>
                      <div style={{display:'flex',gap:4}}>
                        <input type="color" value={sel.color||'#ffffff'} onChange={e=>upd(sel.id,{color:e.target.value})} style={{width:28,height:26,border:'none',borderRadius:4,cursor:'pointer'}} />
                        <input className="input" style={{fontSize:11}} value={sel.color||''} onChange={e=>upd(sel.id,{color:e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="input-group"><label className="input-label">Align</label>
                    <div style={{display:'flex',gap:4}}>
                      {['left','center','right'].map(a=><button key={a} className={`btn btn-sm ${sel.align===a?'btn-primary':'btn-ghost'}`} onClick={()=>upd(sel.id,{align:a})} style={{flex:1,fontSize:11}}>{a}</button>)}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <label style={{fontSize:11,display:'flex',gap:4,alignItems:'center',cursor:'pointer'}}><input type="checkbox" checked={!!sel.bold} onChange={e=>upd(sel.id,{bold:e.target.checked})} /><strong>Bold</strong></label>
                    <label style={{fontSize:11,display:'flex',gap:4,alignItems:'center',cursor:'pointer'}}><input type="checkbox" checked={!!sel.italic} onChange={e=>upd(sel.id,{italic:e.target.checked})} /><em>Italic</em></label>
                  </div>
                </>
              )}

              {/* Shape props */}
              {sel.type==='shape'&&(
                <>
                  <div style={{height:1,background:'var(--color-border-subtle)',margin:'10px 0'}} />
                  <div style={{fontSize:10,fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Shape</div>
                  <div className="input-group"><label className="input-label">Fill</label>
                    <div style={{display:'flex',gap:4}}>
                      <input type="color" value={sel.fill||'#ffffff'} onChange={e=>upd(sel.id,{fill:e.target.value})} style={{width:28,height:26,border:'none',borderRadius:4,cursor:'pointer'}} />
                      <input className="input" style={{fontSize:11}} value={sel.fill||''} onChange={e=>upd(sel.id,{fill:e.target.value})} />
                    </div>
                  </div>
                  <div className="input-group"><label className="input-label">Stroke</label>
                    <div style={{display:'flex',gap:4}}>
                      <input type="color" value={sel.stroke||'#ffffff'} onChange={e=>upd(sel.id,{stroke:e.target.value})} style={{width:28,height:26,border:'none',borderRadius:4,cursor:'pointer'}} />
                      <Num label="" value={sel.strokeWidth||1} onChange={v=>upd(sel.id,{strokeWidth:v})} min={0} style={{flex:1}} />
                    </div>
                  </div>
                  <Num label="Border Radius" value={sel.radius||0} onChange={v=>upd(sel.id,{radius:v})} min={0} />
                </>
              )}

              {/* Alignment */}
              <div style={{height:1,background:'var(--color-border-subtle)',margin:'10px 0'}} />
              <div style={{fontSize:10,fontWeight:700,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6}}>Alignment</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:3}}>
                {[{l:'◀',a:'left'},{l:'↔',a:'centerH'},{l:'▶',a:'right'},{l:'▲',a:'top'},{l:'↕',a:'centerV'},{l:'▼',a:'bottom'}].map(x=>(
                  <button key={x.a} className="btn btn-sm btn-ghost" onClick={()=>align(x.a)} style={{fontSize:13,padding:'3px 0'}}>{x.l}</button>
                ))}
              </div>

              {/* Visibility/lock */}
              <div style={{display:'flex',gap:6,marginTop:10}}>
                <button className="btn btn-sm btn-ghost" style={{flex:1}} onClick={()=>upd(sel.id,{visible:!sel.visible})}>
                  {sel.visible?<><HiOutlineEye /> Sembunyikan</>:<><HiOutlineEyeOff /> Tampilkan</>}
                </button>
                <button className="btn btn-sm btn-ghost" style={{flex:1}} onClick={()=>upd(sel.id,{locked:!sel.locked})}>
                  {sel.locked?<><HiOutlineLockClosed /> Unlock</>:<><HiOutlineLockOpen /> Lock</>}
                </button>
              </div>
              <button className="btn btn-sm btn-danger" style={{marginTop:10,width:'100%'}} onClick={()=>del(sel.id)}><HiOutlineTrash /> Hapus Elemen</button>
            </>
          ) : (
            <div style={{color:'var(--color-text-muted)',fontSize:12,textAlign:'center',paddingTop:24}}>Klik elemen di kanvas untuk edit propertinya</div>
          )}
        </div>
      </div>
    </div>
  )
}