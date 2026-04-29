import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../../context/AppContext'
import { HiOutlineCamera, HiOutlineFilm, HiOutlineRefresh, HiOutlineVideoCamera, HiOutlineChevronDown, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineX, HiOutlineArrowLeft, HiOutlineLockClosed, HiOutlineLink, HiOutlineShare, HiOutlineCog, HiOutlineMail, HiOutlinePrinter } from 'react-icons/hi'

const PHASES = { CHOOSE_TPL: 'choose_tpl', IDLE: 'idle', COUNTDOWN: 'countdown', CAPTURING: 'capturing', PROCESSING: 'processing', RESULT: 'result' }

export default function BoothMode() {
  const { exitBoothMode, activeEvent, templates, addSession } = useApp()
  const availableTemplates = activeEvent ? templates.filter(t => t.event_id === activeEvent.id) : templates
  const [phase, setPhase] = useState(availableTemplates.length > 1 ? PHASES.CHOOSE_TPL : PHASES.IDLE)
  const [countdown, setCountdown] = useState(3)
  const [currentSlot, setCurrentSlot] = useState(0)
  const [totalSlots, setTotalSlots] = useState(1)
  const [capturedPhotos, setCapturedPhotos] = useState([])
  const [compositeImage, setCompositeImage] = useState(null)
  const [resultTimer, setResultTimer] = useState(15)
  const [showMenu, setShowMenu] = useState(false)
  const [captureMode, setCaptureMode] = useState('photo')
  const [chosenTemplate, setChosenTemplate] = useState(null)
  const [tplScrollIdx, setTplScrollIdx] = useState(0)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)

  const activeTemplate = chosenTemplate || (activeEvent?.active_template_id ? templates.find(t => t.id === activeEvent.active_template_id) : availableTemplates[0])

  const getImageUrl = (path) => {
    if (!path) return null
    if (path.startsWith('blob:') || path.startsWith('http')) return path
    return `file://${path.replace(/\\/g, '/')}`
  }

  useEffect(() => {
    if (activeTemplate?.photo_slots?.length) setTotalSlots(activeTemplate.photo_slots.length)
    else setTotalSlots(1)
  }, [activeTemplate])

  // Start camera
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

  // Capture a frame from video
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !videoRef.current.videoWidth) return null
    const v = videoRef.current
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    const ctx = c.getContext('2d')
    ctx.translate(c.width, 0); ctx.scale(-1, 1) // mirror
    ctx.drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', 0.92)
  }, [])

  const selectTemplate = (tpl) => setChosenTemplate(tpl)
  const confirmTemplate = () => { if (chosenTemplate) setPhase(PHASES.IDLE) }

  const startSession = useCallback(() => {
    setPhase(PHASES.COUNTDOWN); setCurrentSlot(0); setCapturedPhotos([]); setCompositeImage(null); setCountdown(3)
  }, [])

  // Countdown
  useEffect(() => {
    if (phase !== PHASES.COUNTDOWN) return
    if (countdown <= 0) { doCapture(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // Actual capture
  const doCapture = useCallback(() => {
    setPhase(PHASES.CAPTURING)
    // Small delay for flash effect, then capture
    setTimeout(() => {
      const frameData = captureFrame()
      if (!frameData) { console.warn('No frame captured'); setPhase(PHASES.IDLE); return }

      const newPhotos = [...capturedPhotos, frameData]
      setCapturedPhotos(newPhotos)

      if (currentSlot + 1 < totalSlots) {
        setCurrentSlot(c => c + 1)
        setCountdown(3)
        setPhase(PHASES.COUNTDOWN)
      } else {
        setPhase(PHASES.PROCESSING)
        // Compose final image
        composeResult(newPhotos).then(img => {
          setCompositeImage(img)
          setPhase(PHASES.RESULT)
          setResultTimer(15)
          // Save session
          addSession({ id: `sess_${Date.now()}`, event_id: activeEvent?.id, template_id: activeTemplate?.id, photos: newPhotos.length, created_at: new Date().toISOString() })
        })
      }
    }, 300)
  }, [capturedPhotos, currentSlot, totalSlots, captureFrame, activeTemplate, activeEvent, addSession])

  // Compose photos onto template
  const composeResult = useCallback(async (photos) => {
    const tpl = activeTemplate
    if (!tpl?.photo_slots?.length) return photos[0] || null

    const c = document.createElement('canvas')
    const paper = { width: tpl.paper_size?.includes('strip') ? 200 : 600, height: tpl.paper_size?.includes('strip') ? 600 : 400 }
    // Use actual paper dimensions from template
    const SIZES = { '4x6': [600, 900], '4x6_landscape': [900, 600], '5x7': [700, 1050], '6x8': [800, 1200], '6x4': [900, 600], '2x6_strip': [300, 900], '4x4': [600, 600], '6x9': [600, 900], '4x6_portrait': [600, 900] }
    const dims = SIZES[tpl.paper_size] || [600, 900]
    c.width = dims[0]; c.height = dims[1]
    const ctx = c.getContext('2d')

    // Draw background
    if (tpl.background_image) {
      try {
        const bgImg = await loadImage(getImageUrl(tpl.background_image))
        ctx.drawImage(bgImg, 0, 0, c.width, c.height)
      } catch { ctx.fillStyle = tpl.bg_color || '#1a1425'; ctx.fillRect(0, 0, c.width, c.height) }
    } else {
      ctx.fillStyle = tpl.bg_color || '#1a1425'; ctx.fillRect(0, 0, c.width, c.height)
    }

    // Draw photos into slots
    for (let i = 0; i < Math.min(photos.length, tpl.photo_slots.length); i++) {
      const slot = tpl.photo_slots[i]
      try {
        const img = await loadImage(photos[i])
        const sx = slot.x, sy = slot.y, sw = slot.width, sh = slot.height
        // Cover-fit the photo into the slot
        const imgAspect = img.width / img.height, slotAspect = sw / sh
        let dx, dy, dw, dh
        if (imgAspect > slotAspect) { dh = img.height; dw = dh * slotAspect; dx = (img.width - dw) / 2; dy = 0 }
        else { dw = img.width; dh = dw / slotAspect; dx = 0; dy = (img.height - dh) / 2 }
        ctx.drawImage(img, dx, dy, dw, dh, sx, sy, sw, sh)
      } catch {}
    }

    return c.toDataURL('image/jpeg', 0.92)
  }, [activeTemplate])

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
    { id: 'gif', label: 'GIF', icon: <HiOutlineFilm /> },
    { id: 'boomerang', label: 'Boomerang', icon: <HiOutlineRefresh /> },
    { id: 'video', label: 'Video', icon: <HiOutlineVideoCamera /> },
  ]
  const visibleTemplates = availableTemplates.slice(tplScrollIdx, tplScrollIdx + 3)

  return (
    <div className="booth-screen">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Live camera feed — full screen behind everything */}
      <video ref={videoRef} autoPlay muted playsInline style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        opacity: (phase === PHASES.IDLE || phase === PHASES.COUNTDOWN) ? 1 : (phase === PHASES.CHOOSE_TPL ? 0.15 : 0),
        transition: 'opacity 0.3s', transform: 'scaleX(-1)', zIndex: 1,
      }} />

      {/* Dark overlay on camera so UI is visible */}
      {(phase === PHASES.IDLE || phase === PHASES.COUNTDOWN) && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2 }} />
      )}

      {/* === BACK BUTTON (always visible except during capture/flash) === */}
      {phase !== PHASES.CAPTURING && (
        <button onClick={exitBoothMode} style={{
          position: 'absolute', top: 12, left: 12, zIndex: 220,
          display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.5)',
          border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20,
          fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)',
        }}>
          <HiOutlineArrowLeft /> Back
        </button>
      )}

      {/* === CHOOSE TEMPLATE PHASE === */}
      {phase === PHASES.CHOOSE_TPL && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', zIndex: 5 }}>
          <button className="btn btn-launch" style={{ position: 'absolute', top: 16, right: 16, padding: '8px 28px', fontSize: 14, borderRadius: 'var(--radius-full)' }} onClick={confirmTemplate} disabled={!chosenTemplate}>Next</button>

          {chosenTemplate && (
            <div style={{ width: 200, height: 280, borderRadius: 8, overflow: 'hidden', marginBottom: 24, border: '2px solid var(--color-accent)', background: 'var(--color-bg-card)' }}>
              {chosenTemplate.background_image ? <img src={getImageUrl(chosenTemplate.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>{chosenTemplate.photo_slots?.length || 0} slots</div>}
            </div>
          )}

          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>Choose a template</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-ghost" style={{ fontSize: 28, color: 'white', padding: 8 }} onClick={() => setTplScrollIdx(Math.max(0, tplScrollIdx - 1))} disabled={tplScrollIdx === 0}><HiOutlineChevronLeft /></button>
            <div style={{ display: 'flex', gap: 16 }}>
              {visibleTemplates.map(tpl => (
                <div key={tpl.id} onClick={() => selectTemplate(tpl)} style={{ width: 140, height: 200, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: chosenTemplate?.id === tpl.id ? '3px solid var(--color-accent)' : '3px solid transparent', background: 'var(--color-bg-card)', transition: 'border-color 0.2s, transform 0.2s', transform: chosenTemplate?.id === tpl.id ? 'scale(1.05)' : 'scale(1)' }}>
                  {tpl.background_image ? <img src={getImageUrl(tpl.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>{tpl.name}</div>}
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 28, color: 'white', padding: 8 }} onClick={() => setTplScrollIdx(Math.min(Math.max(availableTemplates.length - 3, 0), tplScrollIdx + 1))} disabled={tplScrollIdx >= availableTemplates.length - 3}><HiOutlineChevronRight /></button>
          </div>
        </div>
      )}

      {/* Template thumbnail (top-left, after back button) */}
      {activeTemplate && phase === PHASES.IDLE && (
        <div style={{ position: 'absolute', top: 12, left: 100, zIndex: 210, width: 60, height: 80, borderRadius: 4, overflow: 'hidden', background: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {activeTemplate.background_image ? <img src={getImageUrl(activeTemplate.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#888' }}>{activeTemplate.photo_slots?.length || 0}</div>}
        </div>
      )}

      {/* QR code (top-center) */}
      {phase === PHASES.IDLE && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 210, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <QRCodeSVG value="https://kertasfoto.cloud/control" size={64} bgColor="transparent" fgColor="white" level="L" />
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Scan to control</p>
        </div>
      )}

      {/* Dropdown button (top-right) */}
      {phase !== PHASES.CHOOSE_TPL && (
        <button className="booth-dropdown" onClick={() => setShowMenu(!showMenu)} style={{ background: 'linear-gradient(135deg, #462C7D, #D552A3)', zIndex: 220 }}>
          <HiOutlineChevronDown />
        </button>
      )}

      {/* === IDLE — capture modes === */}
      {phase === PHASES.IDLE && (
        <div style={{ display: 'flex', gap: 32, zIndex: 5 }}>
          {modes.map(m => (
            <button key={m.id} className="booth-mode-btn" onClick={() => { setCaptureMode(m.id); startSession() }} style={{ zIndex: 5 }}>
              <div className="mode-circle">{m.icon}</div>
              <span className="mode-name">{m.label}</span>
            </button>
          ))}
        </div>
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

      {/* === PROCESSING === */}
      {phase === PHASES.PROCESSING && (
        <div className="booth-processing"><div className="spinner" /><h2>Processing {capturedPhotos.length} photos...</h2></div>
      )}

      {/* === RESULT — Share + Print with actual captured image === */}
      {phase === PHASES.RESULT && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', zIndex: 5, gap: 40 }}>
          {/* Photo thumbnails (left) */}
          <div style={{ position: 'absolute', top: 50, left: 16, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', zIndex: 6 }}>
            {capturedPhotos.map((p, i) => (
              <div key={i} style={{ width: 50, height: 38, borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>

          {/* Done button */}
          <button className="btn btn-launch" style={{ position: 'absolute', top: 16, right: 16, borderRadius: 'var(--radius-full)', padding: '8px 28px', zIndex: 6 }} onClick={() => setPhase(PHASES.IDLE)}>Done</button>

          {/* Center preview — show composite or last photo */}
          <div style={{ maxWidth: 400, maxHeight: '70vh', borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <img src={compositeImage || capturedPhotos[capturedPhotos.length - 1]} alt="Result" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>

          {/* Right action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D4A017', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HiOutlineMail style={{ fontSize: 24, color: 'white' }} /></div>
              <span style={{ fontSize: 11, color: 'white' }}>Email</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D552A3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HiOutlinePrinter style={{ fontSize: 24, color: 'white' }} /></div>
              <span style={{ fontSize: 11, color: 'white' }}>Print</span>
            </div>
          </div>

          {/* QR + Timer */}
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <QRCodeSVG value={`https://kertasfoto.cloud/s/${Date.now()}`} size={64} bgColor="transparent" fgColor="white" level="M" />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Scan to download · {resultTimer}s</span>
          </div>
        </div>
      )}

      {/* === Settings mega menu === */}
      {showMenu && (
        <div className="mega-menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="mega-menu" onClick={e => e.stopPropagation()}>
            <div className="mega-menu-header">
              <div className="mega-menu-event">{activeEvent?.name || 'No event'}</div>
              <div className="mega-menu-icons">
                <div className="mega-menu-icon" onClick={() => { setShowMenu(false); exitBoothMode() }}><HiOutlineArrowLeft className="mi" /><span>Exit</span></div>
                <div className="mega-menu-icon"><HiOutlineLink className="mi" /><span>Link</span></div>
                <div className="mega-menu-icon"><HiOutlineShare className="mi" /><span>Shares</span></div>
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

// Helper to load image from dataURL or file:// path
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
