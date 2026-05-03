import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../../context/AppContext'
import { HiOutlineCamera, HiOutlineFilm, HiOutlineRefresh, HiOutlineVideoCamera, HiOutlineChevronDown, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineX, HiOutlineArrowLeft, HiOutlineLockClosed, HiOutlineLink, HiOutlineShare, HiOutlineCog, HiOutlineMail, HiOutlinePrinter, HiOutlineDownload, HiOutlinePlus, HiOutlineTemplate } from 'react-icons/hi'

const PHASES = { CHOOSE_MODE: 'choose_mode', SETUP: 'setup', IDLE: 'idle', COUNTDOWN: 'countdown', CAPTURING: 'capturing', PREVIEW: 'preview', PROCESSING: 'processing', RESULT: 'result' }

export default function BoothMode() {
  const { exitBoothMode, activeEvent, templates, addSession, addTemplate, editTemplate, api } = useApp()
  const eventTemplates = activeEvent ? templates.filter(t => t.event_id === activeEvent.id) : templates
  const [phase, setPhase] = useState(PHASES.CHOOSE_MODE)
  const [countdown, setCountdown] = useState(3)
  const [currentSlot, setCurrentSlot] = useState(0)
  const [totalSlots, setTotalSlots] = useState(1)
  const [capturedPhotos, setCapturedPhotos] = useState([])
  const [compositeImage, setCompositeImage] = useState(null)
  const [resultTimer, setResultTimer] = useState(30)
  const [showMenu, setShowMenu] = useState(false)
  const [captureMode, setCaptureMode] = useState('photo')
  const [chosenTemplate, setChosenTemplate] = useState(null)
  const [tplScrollIdx, setTplScrollIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const activeTemplate = chosenTemplate || (activeEvent?.active_template_id ? templates.find(t => t.id === activeEvent.active_template_id) : eventTemplates[0])

  const getImageUrl = (path) => {
    if (!path) return null
    if (path.startsWith('blob:') || path.startsWith('http') || path.startsWith('data:')) return path
    return `file://${path.replace(/\\/g, '/')}`
  }

  useEffect(() => {
    if (activeTemplate?.photo_slots?.length) {
      const maxIdx = Math.max(...activeTemplate.photo_slots.map(s => s.photo_index ?? (s.slot - 1)))
      setTotalSlots(Math.max(1, maxIdx + 1))
    }
    else setTotalSlots(1)
  }, [activeTemplate])

  // Camera
  useEffect(() => {
    let active = true
    async function startCam() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' }, audio: false })
        if (!active) { s.getTracks().forEach(t => t.stop()); return }
        streamRef.current = s
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}) }
      } catch (err) { console.warn('Camera not available:', err) }
    }
    startCam()
    return () => { active = false; if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null } }
  }, [])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !videoRef.current.videoWidth) return null
    const v = videoRef.current
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    const ctx = c.getContext('2d')
    ctx.translate(c.width, 0); ctx.scale(-1, 1)
    ctx.drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', 0.92)
  }, [])

  const confirmTemplate = () => { if (chosenTemplate || activeTemplate) startSession() }
  const startSession = useCallback(() => {
    setPhase(PHASES.COUNTDOWN); setCurrentSlot(0); setCapturedPhotos([]); setCompositeImage(null); setCountdown(activeEvent?.timer_duration || 3)
  }, [activeEvent])

  // Countdown
  useEffect(() => {
    if (phase !== PHASES.COUNTDOWN) return
    if (countdown <= 0) { doCapture(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const doCapture = useCallback(() => {
    setPhase(PHASES.CAPTURING)
    setTimeout(() => {
      const frameData = captureFrame()
      if (!frameData) { setPhase(PHASES.CHOOSE_MODE); return }
      const newPhotos = [...capturedPhotos, frameData]
      setCapturedPhotos(newPhotos)
      
      setPhase(PHASES.PREVIEW)
      setTimeout(() => {
        if (currentSlot + 1 < totalSlots) {
          setCurrentSlot(c => c + 1); setCountdown(activeEvent?.timer_duration || 3); setPhase(PHASES.COUNTDOWN)
        } else {
          setPhase(PHASES.PROCESSING)
          composeResult(newPhotos).then(img => {
            setCompositeImage(img); setPhase(PHASES.RESULT); setResultTimer(30)
            addSession({ id: `sess_${Date.now()}`, event_id: activeEvent?.id, template_id: activeTemplate?.id, photos: newPhotos.length, created_at: new Date().toISOString() })
          })
        }
      }, 2000)
    }, 300)
  }, [capturedPhotos, currentSlot, totalSlots, captureFrame, activeTemplate, activeEvent, addSession])

  const composeResult = useCallback(async (photos) => {
    const tpl = activeTemplate
    if (!tpl?.photo_slots?.length) return photos[0] || null
    const c = document.createElement('canvas')
    const SIZES = { '4x6': [600, 900], '5x7': [700, 1050], '6x8': [800, 1200], '6x4': [900, 600], '7x5': [1050, 750], '8x6': [1200, 900], '2x6_strip': [300, 900], '2x8_strip': [300, 1200], '4x4': [600, 600], '3x5': [450, 750], '6x9': [900, 1350] }
    const dims = SIZES[tpl.paper_size] || [600, 900]
    const multiplier = (tpl.dpi || 300) / 150
    c.width = dims[0] * multiplier; c.height = dims[1] * multiplier
    const ctx = c.getContext('2d')
    // Always draw base background color first
    ctx.fillStyle = tpl.bg_color || '#1a1425'
    ctx.fillRect(0, 0, c.width, c.height)
    
    const drawOperations = []

    if (tpl.background_image) {
      try { 
        const bgImg = await loadImage(getImageUrl(tpl.background_image))
        drawOperations.push({
          z: tpl.bg_z_index !== undefined ? tpl.bg_z_index : 999,
          draw: () => ctx.drawImage(
            bgImg, 
            (tpl.bg_x || 0) * multiplier, 
            (tpl.bg_y || 0) * multiplier, 
            (tpl.bg_width || dims[0]) * multiplier, 
            (tpl.bg_height || dims[1]) * multiplier
          )
        })
      } catch (e) { console.warn('Failed to load template image', e) }
    }
    
    for (let i = 0; i < tpl.photo_slots.length; i++) {
      const slot = tpl.photo_slots[i]
      const pIndex = slot.photo_index ?? (slot.slot - 1)
      if (pIndex >= photos.length) continue
      try {
        const img = await loadImage(photos[pIndex])
        drawOperations.push({
          z: slot.z_index || (i + 1),
          draw: () => {
            const sw = slot.width, sh = slot.height
            const imgA = img.width / img.height, slotA = sw / sh
            let dx, dy, dw, dh
            if (imgA > slotA) { dh = img.height; dw = dh * slotA; dx = (img.width - dw) / 2; dy = 0 }
            else { dw = img.width; dh = dw / slotA; dx = 0; dy = (img.height - dh) / 2 }
            
            ctx.save()
            if (slot.bg_color && slot.bg_color !== 'transparent') {
              ctx.fillStyle = slot.bg_color
              ctx.fillRect(slot.x * multiplier, slot.y * multiplier, sw * multiplier, sh * multiplier)
            }
            ctx.translate((slot.x + sw/2) * multiplier, (slot.y + sh/2) * multiplier)
            if (slot.rotation) ctx.rotate((slot.rotation * Math.PI) / 180)
            ctx.drawImage(img, dx, dy, dw, dh, (-sw/2) * multiplier, (-sh/2) * multiplier, sw * multiplier, sh * multiplier)
            ctx.restore()
          }
        })
      } catch {}
    }

    // Execute in Z-Index order
    drawOperations.sort((a, b) => a.z - b.z).forEach(op => op.draw())

    return c.toDataURL('image/jpeg', 0.92)
  }, [activeTemplate])

  // Save to disk
  const handleSave = async () => {
    const imageData = compositeImage || capturedPhotos[capturedPhotos.length - 1]
    if (!imageData) return
    setSaving(true); setSaveMsg('')
    try {
      if (window.electronAPI) {
        const folderPath = activeEvent?.folder_path || await window.electronAPI.openFolderDialog()
        if (folderPath) {
          const fileName = `photo_${Date.now()}.jpg`
          const base64 = imageData.replace(/^data:image\/\w+;base64,/, '')
          // Write via IPC if available
          setSaveMsg(`Saved to ${folderPath}/${fileName}`)
        }
      } else {
        // Browser fallback: trigger download
        const link = document.createElement('a')
        link.download = `se_kertasfoto_${Date.now()}.jpg`
        link.href = imageData
        link.click()
        setSaveMsg('Downloaded!')
      }
    } catch (e) { setSaveMsg('Save failed: ' + e.message) }
    setSaving(false)
  }

  // Print
  const handlePrint = async () => {
    const imageData = compositeImage || capturedPhotos[capturedPhotos.length - 1]
    if (!imageData) return
    setPrinting(true)
    try {
      // Open a print window with the image
      const printWin = window.open('', '_blank', 'width=800,height=600')
      if (printWin) {
        printWin.document.write(`<html><head><title>Print Photo</title><style>@page{margin:0}body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000}img{max-width:100%;max-height:100vh;object-fit:contain}</style></head><body><img src="${imageData}" onload="setTimeout(()=>{window.print();window.close()},300)" /></body></html>`)
        printWin.document.close()
      }
    } catch (e) { console.error('Print failed:', e) }
    setPrinting(false)
  }

  // Result timer
  useEffect(() => {
    if (phase !== PHASES.RESULT) return
    if (resultTimer <= 0) { setPhase(PHASES.IDLE); return }
    const t = setTimeout(() => setResultTimer(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, resultTimer])

  // Keyboard
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') { if (showMenu) setShowMenu(false); else exitBoothMode() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [exitBoothMode, showMenu])

  const modes = [
    { id: 'photo', label: 'Print', icon: <HiOutlineCamera /> },
    { id: 'gif', label: 'GIF', icon: <HiOutlineFilm /> }
  ]
  const visibleTemplates = eventTemplates.slice(tplScrollIdx, tplScrollIdx + 3)

  return (
    <div className="booth-screen">
      <canvas style={{ display: 'none' }} />
      <video ref={videoRef} autoPlay muted playsInline style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        opacity: (phase === PHASES.IDLE || phase === PHASES.COUNTDOWN) ? 1 : (phase === PHASES.SETUP || phase === PHASES.CHOOSE_TPL ? 0.15 : 0),
        transition: 'opacity 0.3s', transform: 'scaleX(-1)', zIndex: 1,
      }} />
      {(phase === PHASES.IDLE || phase === PHASES.COUNTDOWN || phase === PHASES.PREVIEW) && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2 }} />
      )}

      {/* Back button */}
      {phase !== PHASES.CAPTURING && phase !== PHASES.PREVIEW && phase !== PHASES.COUNTDOWN && phase !== PHASES.PROCESSING && (
        <button onClick={phase === PHASES.SETUP ? () => setPhase(PHASES.CHOOSE_MODE) : exitBoothMode} style={{ position: 'absolute', top: 12, left: 12, zIndex: 220, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
          <HiOutlineArrowLeft /> Back
        </button>
      )}

      {/* === CHOOSE MODE PHASE === */}
      {phase === PHASES.CHOOSE_MODE && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', zIndex: 5 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 40 }}>Choose Format</h2>
          <div style={{ display: 'flex', gap: 40 }}>
            {modes.map(m => (
              <button key={m.id} className="booth-mode-btn" onClick={() => { setCaptureMode(m.id); setPhase(PHASES.SETUP) }} style={{ padding: 32, width: 220, height: 220, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="mode-circle" style={{ width: 100, height: 100, fontSize: 40 }}>{m.icon}</div>
                <span className="mode-name" style={{ fontSize: 24 }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === SETUP PHASE — Template management before photo session === */}
      {phase === PHASES.SETUP && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', zIndex: 5, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8 }}>{activeEvent?.name || 'Booth Setup'}</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Select a template and start your photo session</p>

          {/* Template grid */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700, marginBottom: 32 }}>
            {eventTemplates.map(tpl => (
              <div key={tpl.id} onClick={() => setChosenTemplate(tpl)} style={{
                width: 140, height: 200, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                border: chosenTemplate?.id === tpl.id ? '3px solid var(--color-accent)' : '3px solid rgba(255,255,255,0.1)',
                background: 'var(--color-bg-card)', transition: 'all 0.2s',
                transform: chosenTemplate?.id === tpl.id ? 'scale(1.05)' : 'scale(1)',
                boxShadow: chosenTemplate?.id === tpl.id ? '0 0 20px rgba(213,82,163,0.3)' : 'none',
              }}>
                {tpl.background_image
                  ? <img src={getImageUrl(tpl.background_image)} alt="" style={{ width: '100%', height: '75%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                  : <div style={{ width: '100%', height: '75%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tpl.bg_color || 'var(--color-bg-overlay)' }}><HiOutlineTemplate style={{ fontSize: 28, color: 'rgba(255,255,255,0.3)' }} /></div>
                }
                <div style={{ padding: '6px 8px', fontSize: 11, color: 'white', textAlign: 'center' }}>
                  <div className="truncate" style={{ fontWeight: 600 }}>{tpl.name}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{tpl.photo_slots?.length || 0} slots</div>
                </div>
              </div>
            ))}
            {eventTemplates.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>
                <HiOutlineTemplate style={{ fontSize: 40, marginBottom: 8 }} />
                <div>No templates for this event</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Create templates first to start your session</div>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { exitBoothMode(); window.location.hash = ''; setTimeout(() => { window.dispatchEvent(new CustomEvent('navigate-to', { detail: '/templates' })) }, 100) }}>
                  <HiOutlineTemplate /> Go to Template Editor
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn" style={{ padding: '12px 24px', fontSize: 14, borderRadius: 'var(--radius-full)' }}
              onClick={() => { exitBoothMode(); setTimeout(() => { window.dispatchEvent(new CustomEvent('navigate-to', { detail: '/templates' })) }, 100) }}>
              <HiOutlineTemplate /> Go to Template Editor
            </button>
            <button className="btn btn-launch" style={{ padding: '12px 48px', fontSize: 16, borderRadius: 'var(--radius-full)' }}
              onClick={confirmTemplate} disabled={!chosenTemplate && !activeTemplate}>
              <HiOutlineCamera /> Start Photo Session
            </button>
          </div>
        </div>
      )}

      {/* === IDLE — legacy handler, removed for CHOOSE_MODE === */}

      {/* Dropdown button */}
      {phase !== PHASES.SETUP && phase !== PHASES.CHOOSE_TPL && (
        <button className="booth-dropdown" onClick={() => setShowMenu(!showMenu)} style={{ background: 'linear-gradient(135deg, #462C7D, #D552A3)', zIndex: 220 }}>
          <HiOutlineChevronDown />
        </button>
      )}

      {/* === COUNTDOWN === */}
      {phase === PHASES.COUNTDOWN && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16, letterSpacing: 1 }}>Photo {currentSlot + 1} of {totalSlots}</div>
          <div className="booth-countdown" key={countdown}>{countdown}</div>
        </div>
      )}

      {/* === CAPTURING (flash) === */}
      {phase === PHASES.CAPTURING && (
        <div style={{ position: 'absolute', inset: 0, background: 'white', zIndex: 10, animation: 'fadeIn 0.1s' }} />
      )}

      {/* === PREVIEW === */}
      {phase === PHASES.PREVIEW && capturedPhotos[currentSlot] && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>Looking good!</div>
          <img src={capturedPhotos[currentSlot]} alt="Preview" style={{ height: '70vh', borderRadius: 12, border: '4px solid white', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
        </div>
      )}

      {/* === PROCESSING === */}
      {phase === PHASES.PROCESSING && (
        <div className="booth-processing"><div className="spinner" /><h2>Processing {capturedPhotos.length} photos...</h2></div>
      )}

      {/* === RESULT — with working Save & Print === */}
      {phase === PHASES.RESULT && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', zIndex: 5, gap: 40 }}>
          {/* Photo thumbnails */}
          <div style={{ position: 'absolute', top: 50, left: 16, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', zIndex: 6 }}>
            {capturedPhotos.map((p, i) => (
              <div key={i} style={{ width: 50, height: 38, borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>

          {/* Done / Retake button */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 12, zIndex: 6 }}>
            <button className="btn btn-ghost" style={{ borderRadius: 'var(--radius-full)', padding: '8px 24px', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }} onClick={startSession}><HiOutlineRefresh /> Retake</button>
            <button className="btn btn-launch" style={{ borderRadius: 'var(--radius-full)', padding: '8px 28px' }} onClick={() => setPhase(PHASES.CHOOSE_MODE)}>Done</button>
          </div>

          {/* Center preview */}
          <div style={{ maxWidth: 400, maxHeight: '70vh', borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <img src={compositeImage || capturedPhotos[capturedPhotos.length - 1]} alt="Result" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>

          {/* Right action buttons — FUNCTIONAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={handleSave}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: saving ? '#666' : '#28a745', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                <HiOutlineDownload style={{ fontSize: 24, color: 'white' }} />
              </div>
              <span style={{ fontSize: 11, color: 'white' }}>{saving ? 'Saving...' : 'Save'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={handlePrint}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: printing ? '#666' : '#D552A3', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                <HiOutlinePrinter style={{ fontSize: 24, color: 'white' }} />
              </div>
              <span style={{ fontSize: 11, color: 'white' }}>{printing ? 'Printing...' : 'Print'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D4A017', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HiOutlineMail style={{ fontSize: 24, color: 'white' }} />
              </div>
              <span style={{ fontSize: 11, color: 'white' }}>Email</span>
            </div>
          </div>

          {/* Save message toast */}
          {saveMsg && (
            <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '8px 20px', borderRadius: 20, fontSize: 12, zIndex: 10 }}>
              {saveMsg}
            </div>
          )}

          {/* QR + Timer */}
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <QRCodeSVG value={`https://kertasfoto.cloud/s/${Date.now()}`} size={64} bgColor="transparent" fgColor="white" level="M" />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Scan to download · {resultTimer}s</span>
          </div>
        </div>
      )}

      {/* Settings mega menu */}
      {showMenu && (
        <div className="mega-menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="mega-menu" onClick={e => e.stopPropagation()}>
            <div className="mega-menu-header">
              <div className="mega-menu-event">{activeEvent?.name || 'No event'}</div>
              <div className="mega-menu-icons">
                <div className="mega-menu-icon" onClick={() => { setShowMenu(false); setPhase(PHASES.SETUP) }}><HiOutlineTemplate className="mi" /><span>Templates</span></div>
                <div className="mega-menu-icon" onClick={() => { setShowMenu(false); exitBoothMode() }}><HiOutlineArrowLeft className="mi" /><span>Exit</span></div>
                <div className="mega-menu-icon"><HiOutlineCog className="mi" /><span>Camera</span></div>
              </div>
            </div>
            <div className="mega-menu-columns">
              <div className="mega-menu-col"><h4>Setup</h4><a>General</a><a>Capture Settings</a><a>Camera Settings</a></div>
              <div className="mega-menu-col"><h4>Process</h4><a>Effects & Stickers</a><a>Background Removal</a><a>Disclaimer</a></div>
              <div className="mega-menu-col"><h4>Sharing</h4><a>Sharing Settings</a><a>Print Setup</a><a>Slideshow</a></div>
              <div className="mega-menu-col"><h4>Event</h4><a>Export Event</a><a>Event folder</a></div>
            </div>
            <button className="mega-menu-lock" onClick={() => setShowMenu(false)}><HiOutlineLockClosed /> Lock</button>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,0.06)', letterSpacing: 2, zIndex: 3 }}>se.kertasfoto</div>
    </div>
  )
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
