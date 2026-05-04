import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../../context/AppContext'
import {
  HiOutlineCamera, HiOutlineFilm, HiOutlineRefresh, HiOutlineVideoCamera,
  HiOutlineChevronDown, HiOutlineChevronLeft, HiOutlineChevronRight,
  HiOutlineArrowLeft, HiOutlineLockClosed, HiOutlineLink, HiOutlineShare,
  HiOutlineCog, HiOutlineMail, HiOutlinePrinter, HiOutlineClock,
  HiOutlineTrash, HiOutlineCloud, HiOutlineCheckCircle, HiOutlineExclamationCircle,
  HiOutlineDownload,
} from 'react-icons/hi'

const PHASES = {
  CHOOSE_MODE: 'choose_mode',
  CHOOSE_TPL: 'choose_tpl',
  COUNTDOWN: 'countdown',
  CAPTURING: 'capturing',
  PHOTO_PREVIEW: 'photo_preview',
  PROCESSING: 'processing',
  UPLOADING: 'uploading',
  RESULT: 'result',
}

// ── Synthetic Audio Helper ───────────────────────────────────────────────────
let audioCtx = null
const playSound = (type) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    if (type === 'beep') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, audioCtx.currentTime)
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.1)
    } else if (type === 'shutter') {
      osc.type = 'square'
      osc.frequency.setValueAtTime(100, audioCtx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.1)
    }
  } catch(e) {}
}

// ── Upload loading screen ─────────────────────────────────────────────────────
function UploadingScreen({ step, progress, eventName }) {
  const steps = [
    { key: 'compose', label: 'Memproses foto...' },
    { key: 'save',    label: 'Menyimpan lokal...' },
    { key: 'upload',  label: 'Mengupload ke Google Drive...' },
    { key: 'qr',      label: 'Membuat QR Code...' },
  ]
  const currentIdx = steps.findIndex(s => s.key === step)

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: 'rgba(14,10,20,0.96)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 32,
    }}>
      {/* Animated logo */}
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: 'linear-gradient(135deg, #462C7D, #D552A3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, fontWeight: 800, color: 'white',
        boxShadow: '0 0 40px rgba(213,82,163,0.4)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>SK</div>

      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>
          {step === 'upload' ? 'Mengupload foto...' : step === 'qr' ? 'Hampir selesai...' : 'Memproses...'}
        </h2>
        {eventName && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{eventName}</p>
        )}
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
        {steps.map((s, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          const pending = i > currentIdx
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: done ? '#4ade80' : active ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                border: `2px solid ${done ? '#4ade80' : active ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.4s',
              }}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : active ? (
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                )}
              </div>
              <span style={{
                fontSize: 13, color: done ? '#4ade80' : active ? 'white' : 'rgba(255,255,255,0.3)',
                fontWeight: active ? 600 : 400, transition: 'all 0.3s',
              }}>{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div style={{ width: 280, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'linear-gradient(90deg, #462C7D, #D552A3)',
          width: `${progress}%`, transition: 'width 0.5s ease',
        }} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(213,82,163,0.4); }
          50% { box-shadow: 0 0 60px rgba(213,82,163,0.7), 0 0 20px rgba(70,44,125,0.5); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── QR Result overlay ─────────────────────────────────────────────────────────
function DriveQROverlay({ driveResult, onClose }) {
  const { viewLink, downloadLink, shareLink } = driveResult || {}
  const qrUrl = downloadLink || viewLink || shareLink || 'https://drive.google.com'

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(14,10,20,0.97)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 24, animation: 'fadeIn 0.4s ease',
    }}>
      {/* Success badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(74,222,128,0.15)', border: '2px solid #4ade80',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <HiOutlineCheckCircle style={{ color: '#4ade80', fontSize: 18 }} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#4ade80' }}>Foto tersimpan di Google Drive!</span>
      </div>

      {/* QR Code */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          background: 'white', borderRadius: 16, padding: 20,
          display: 'inline-block',
          boxShadow: '0 0 60px rgba(213,82,163,0.3)',
        }}>
          <QRCodeSVG
            value={qrUrl}
            size={200}
            bgColor="white"
            fgColor="#1a1425"
            level="M"
          />
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>
          Scan untuk mengunduh foto kamu
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, maxWidth: 300, wordBreak: 'break-all' }}>
          {qrUrl}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {downloadLink && (
          <a
            href={downloadLink}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
              borderRadius: 20, background: 'linear-gradient(135deg, #462C7D, #D552A3)',
              color: 'white', textDecoration: 'none', fontSize: 13, fontWeight: 600,
            }}
          >
            <HiOutlineDownload /> Download Foto
          </a>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '8px 24px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: 'white', fontSize: 13, cursor: 'pointer',
          }}
        >
          Selesai
        </button>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  )
}

// ── Main BoothMode ────────────────────────────────────────────────────────────
export default function BoothMode() {
  const {
    exitBoothMode, activeEvent, templates,
    addSession, removeSession, sessions,
    gdriveStatus, uploadPhotoToDrive, cameraCountdown,
    cameraDeviceId,
  } = useApp()

  const availableTemplates = activeEvent
    ? templates.filter(t => t.event_id === activeEvent.id)
    : templates

  const [phase, setPhase] = useState(PHASES.CHOOSE_MODE)
  const [countdown, setCountdown] = useState(3)
  const [currentSlot, setCurrentSlot] = useState(0)
  const [totalSlots, setTotalSlots] = useState(1)
  const [capturedPhotos, setCapturedPhotos] = useState([])
  const [compositeImage, setCompositeImage] = useState(null)
  const [resultTimer, setResultTimer] = useState(30)
  const [showMenu, setShowMenu] = useState(false)
  const [captureMode, setCaptureMode] = useState('photo')
  const [chosenTemplate, setChosenTemplate] = useState(availableTemplates.length === 1 ? availableTemplates[0] : null)
  const [tplScrollIdx, setTplScrollIdx] = useState(0)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [showSessionsList, setShowSessionsList] = useState(false)
  const [lastCapturedPhoto, setLastCapturedPhoto] = useState(null)
  const [previewComposite, setPreviewComposite] = useState(null)
  const [retakeSlotIndex, setRetakeSlotIndex] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  const [savedFilePath, setSavedFilePath] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // ── Drive upload state ──────────────────────────────────────────────────────
  const [uploadStep, setUploadStep] = useState('compose')   // compose | save | upload | qr
  const [uploadProgress, setUploadProgress] = useState(0)
  const [driveResult, setDriveResult] = useState(null)      // hasil upload Drive
  const [showDriveQR, setShowDriveQR] = useState(false)
  const [driveError, setDriveError] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const printFrameRef = useRef(null)

  const activeTemplate = chosenTemplate
    || (activeEvent?.active_template_id
      ? templates.find(t => t.id === activeEvent.active_template_id)
      : availableTemplates[0])

  const hasDrive = gdriveStatus.isAuthenticated && !!activeEvent?.drive_folder_id

  const getImageUrl = (path) => {
    if (!path) return null
    if (path.startsWith('blob:') || path.startsWith('http') || path.startsWith('data:')) return path
    return `file://${path.replace(/\\/g, '/')}`
  }

  // Auto-save to disk
  const savePhotoToDisk = useCallback(async (dataUrl, folderPath) => {
    if (!dataUrl || !folderPath) return null
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const eventSlug = (activeEvent?.name || 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)
    const filename = `${eventSlug}_${timestamp}.jpg`
    if (!window.electronAPI?.saveFile) return null
    try {
      const result = await window.electronAPI.saveFile({ folder: folderPath, filename, dataUrl })
      return result?.path || null
    } catch { return null }
  }, [activeEvent])

  // Build upload filename
  const buildFilename = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const eventSlug = (activeEvent?.name || 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)
    return `${eventSlug}_${timestamp}.jpg`
  }, [activeEvent])

  const eventSessions = sessions?.filter(s => s.event_id === activeEvent?.id) || []

  useEffect(() => {
    if (activeTemplate?.photo_slots?.length) {
      const maxIdx = Math.max(...activeTemplate.photo_slots.map(s => s.photo_index ?? (s.slot - 1)))
      setTotalSlots(Math.max(1, maxIdx + 1))
    }
    else setTotalSlots(1)
  }, [activeTemplate, captureMode])

  // Camera
  useEffect(() => {
    let active = true
    async function startCam() {
      try {
        const constraints = {
          video: cameraDeviceId 
            ? { deviceId: { exact: cameraDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
          audio: false,
        }
        const s = await navigator.mediaDevices.getUserMedia(constraints)
        if (active) {
          streamRef.current = s
          if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play() }
        }
      } catch (e) { console.warn('Cam error', e) }
    }
    startCam()
    return () => {
      active = false
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    }
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

  const confirmTemplate = () => { if (chosenTemplate || activeTemplate) setPhase(PHASES.IDLE) }
  const startSession = useCallback(() => {
    setPhase(PHASES.COUNTDOWN)
    setCurrentSlot(0)
    setCapturedPhotos([])
    setCompositeImage(null)
    setCountdown(cameraCountdown)
    setCurrentSessionId(null)
    setRetakeSlotIndex(null)
    setLastCapturedPhoto(null)
    setSaveStatus(null)
    setSavedFilePath(null)
    setDriveResult(null)
    setDriveError(null)
    setShowDriveQR(false)
  }, [])

  // Compose helpers
  const SIZES = {
    '4x6': [600, 900], '4x6_landscape': [900, 600], '5x7': [700, 1050],
    '6x8': [800, 1200], '6x4': [900, 600], '2x6_strip': [300, 900],
    '4x4': [600, 600], '6x9': [600, 900], '4x6_portrait': [600, 900],
  }

  const composeResult = useCallback(async (photos, scale = 1.0) => {
    const tpl = activeTemplate
    if (!tpl?.photo_slots?.length) return photos[0] || null
    const c = document.createElement('canvas')
    const dims = SIZES[tpl.paper_size] || [600, 900]
    const multiplier = ((tpl.dpi || 300) / 150) * scale
    c.width = dims[0] * multiplier; c.height = dims[1] * multiplier
    const ctx = c.getContext('2d')
    
    // Fill base color
    ctx.fillStyle = tpl.bg_color || '#1a1425'
    ctx.fillRect(0, 0, c.width, c.height)

    // Build array of drawing operations to sort by z-index
    const drawOps = []

    // 1. Overlay (background image) operation
    if (tpl.background_image) {
      try {
        const bg = await loadImage(getImageUrl(tpl.background_image))
        const bx = (tpl.bg_x || 0) * multiplier
        const by = (tpl.bg_y || 0) * multiplier
        const bw = (tpl.bg_width || dims[0]) * multiplier
        const bh = (tpl.bg_height || dims[1]) * multiplier
        const z = tpl.bg_z_index !== undefined ? tpl.bg_z_index : 0
        drawOps.push({ z, draw: () => ctx.drawImage(bg, bx, by, bw, bh) })
      } catch (e) { console.error('Failed to load bg', e) }
    }

    // 2. Slots operations
    for (let i = 0; i < tpl.photo_slots.length; i++) {
      const slot = tpl.photo_slots[i]
      const sx = slot.x * multiplier
      const sy = slot.y * multiplier
      const sw = slot.width * multiplier
      const sh = slot.height * multiplier
      const z = slot.z_index || (i + 1)
      
      if (slot.type === 'text') {
        drawOps.push({
          z,
          draw: () => {
            ctx.save()
            ctx.translate(sx + sw/2, sy + sh/2)
            ctx.rotate((slot.rotation || 0) * Math.PI / 180)
            ctx.translate(-(sx + sw/2), -(sy + sh/2))
            
            ctx.fillStyle = slot.font_color || '#ffffff'
            ctx.font = `${slot.font_weight || '700'} ${Math.round((slot.font_size || 40) * multiplier)}px "Plus Jakarta Sans", "Inter", sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(slot.text || '', sx + sw/2, sy + sh/2)
            
            ctx.restore()
          }
        })
        continue
      }

      const pIdx = slot.photo_index !== undefined ? slot.photo_index : (slot.slot - 1)
      const photoSrc = photos[pIdx] || photos[photos.length - 1]
      if (!photoSrc) continue

      try {
        const img = await loadImage(photoSrc)
        
        drawOps.push({
          z,
          draw: () => {
            const ia = img.width / img.height, sa = sw / sh
            let dx, dy, dw, dh
            if (ia > sa) { dh = img.height; dw = dh * sa; dx = (img.width - dw) / 2; dy = 0 }
            else { dw = img.width; dh = dw / sa; dx = 0; dy = (img.height - dh) / 2 }
            
            ctx.save()
            ctx.translate(sx + sw/2, sy + sh/2)
            ctx.rotate((slot.rotation || 0) * Math.PI / 180)
            ctx.translate(-(sx + sw/2), -(sy + sh/2))
            if (slot.bg_color && slot.bg_color !== 'transparent') {
              ctx.fillStyle = slot.bg_color
              ctx.fillRect(sx, sy, sw, sh)
            }
            ctx.drawImage(img, dx, dy, dw, dh, sx, sy, sw, sh)
            ctx.restore()
          }
        })
      } catch (e) { console.error('Failed to load photo', e) }
    }

    // Execute sorted by z
    drawOps.sort((a, b) => a.z - b.z).forEach(op => op.draw())

    return c.toDataURL(scale < 1 ? 'image/png' : 'image/jpeg', 0.9)
  }, [activeTemplate])

  const composePartialPreview = useCallback(async (photos) => {
    const tpl = activeTemplate
    if (!tpl?.photo_slots?.length) return photos[photos.length - 1] || null
    const c = document.createElement('canvas')
    const dims = SIZES[tpl.paper_size] || [600, 900]
    c.width = dims[0]; c.height = dims[1] // Preview always 1x scale
    const ctx = c.getContext('2d')
    
    ctx.fillStyle = tpl.bg_color || '#1a1425'
    ctx.fillRect(0, 0, c.width, c.height)

    const drawOps = []

    if (tpl.background_image) {
      try {
        const bg = await loadImage(getImageUrl(tpl.background_image))
        const bx = (tpl.bg_x || 0)
        const by = (tpl.bg_y || 0)
        const bw = (tpl.bg_width || dims[0])
        const bh = (tpl.bg_height || dims[1])
        const z = tpl.bg_z_index !== undefined ? tpl.bg_z_index : 0
        drawOps.push({ z, draw: () => ctx.drawImage(bg, bx, by, bw, bh) })
      } catch (e) {}
    }

    for (let i = 0; i < tpl.photo_slots.length; i++) {
      const slot = tpl.photo_slots[i]
      const sx = slot.x
      const sy = slot.y
      const sw = slot.width
      const sh = slot.height
      const z = slot.z_index || (i + 1)
      
      if (slot.type === 'text') {
        drawOps.push({
          z,
          draw: () => {
            ctx.save()
            ctx.translate(sx + sw/2, sy + sh/2)
            ctx.rotate((slot.rotation || 0) * Math.PI / 180)
            ctx.translate(-(sx + sw/2), -(sy + sh/2))
            
            ctx.fillStyle = slot.font_color || '#ffffff'
            ctx.font = `${slot.font_weight || '700'} ${Math.round(slot.font_size || 40)}px "Plus Jakarta Sans", "Inter", sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(slot.text || '', sx + sw/2, sy + sh/2)
            
            ctx.restore()
          }
        })
        continue
      }

      const pIdx = slot.photo_index !== undefined ? slot.photo_index : (slot.slot - 1)
      const photoSrc = photos[pIdx]
      
      let img = null
      if (photoSrc) {
        try { img = await loadImage(photoSrc) } catch(e) {}
      }

      drawOps.push({
        z,
        draw: () => {
          ctx.save()
          ctx.translate(sx + sw/2, sy + sh/2)
          ctx.rotate((slot.rotation || 0) * Math.PI / 180)
          ctx.translate(-(sx + sw/2), -(sy + sh/2))
          
          if (!img) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)'
            ctx.fillRect(sx, sy, sw, sh)
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'
            ctx.lineWidth = 2; ctx.setLineDash([8, 6])
            ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2)
          } else {
            const ia = img.width / img.height, sa = sw / sh
            let dx, dy, dw, dh
            if (ia > sa) { dh = img.height; dw = dh * sa; dx = (img.width - dw) / 2; dy = 0 }
            else { dw = img.width; dh = dw / sa; dx = 0; dy = (img.height - dh) / 2 }
            
            if (slot.bg_color && slot.bg_color !== 'transparent') {
              ctx.fillStyle = slot.bg_color
              ctx.fillRect(sx, sy, sw, sh)
            }
            ctx.drawImage(img, dx, dy, dw, dh, sx, sy, sw, sh)
          }
          ctx.restore()
        }
      })
    }

    // Since preview ops have await inside the loop above, wait for all if needed
    // Actually we pre-loaded images in the loop? No, in partial preview we do it async.
    // It's better to preload before pushing to drawOps so we can sort sync
    await Promise.all(drawOps.map(async op => {
      if (op.draw.constructor.name === 'AsyncFunction') await op.draw()
      // Wait, if we execute in Promise.all, we break z-index drawing order!
    }))
    
    // To fix z-index for preview:
    // Actually the above is just for structure. Let's do a proper async sequential draw
    drawOps.sort((a, b) => a.z - b.z)
    for (const op of drawOps) {
       await op.draw() // sequential execution to preserve z-index
    }

    return c.toDataURL('image/jpeg', 0.92)
  }, [activeTemplate])

  // Countdown
  useEffect(() => {
    if (phase !== PHASES.COUNTDOWN) return
    if (countdown <= 0) { 
      doCapture()
      return 
    }
    playSound('beep')
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // ── Main finish session: compose → save → upload → QR ────────────────────
  const finishSession = useCallback(async (photos) => {
    setPhase(PHASES.UPLOADING)
    setUploadStep('compose')
    setUploadProgress(10)
    setDriveResult(null)
    setDriveError(null)

    // Step 1: Compose / Generate GIF
    let img = null
    if (captureMode === 'gif') {
      setUploadStep('creating_gif')
      
      const composedFrames = []
      // photos is an array of bursts, e.g. [ [f1,f2,f3,f4], [f1,f2,f3,f4] ]
      for (let frameIdx = 0; frameIdx < 4; frameIdx++) {
         const currentFramePhotos = photos.map(slotFrames => {
            if (Array.isArray(slotFrames)) return slotFrames[frameIdx] || slotFrames[0]
            return slotFrames
         })
         const frameDataUrl = await composeResult(currentFramePhotos, 1.0)
         composedFrames.push(frameDataUrl)
      }

      const firstImg = new Image()
      firstImg.src = composedFrames[0]
      await new Promise(r => firstImg.onload = r)
      const aspect = firstImg.width / firstImg.height
      const targetWidth = 600
      const targetHeight = Math.round(600 / aspect)

      img = await new Promise(async (resolve) => {
        try {
          // Import from local vendor copy to bypass Vite optimization issues
          const gifshotModule = await import('../../vendor/gifshot.js')
          const gifshot = gifshotModule.default || gifshotModule
          
          if (!gifshot || typeof gifshot.createGIF !== 'function') {
             console.error('gifshot not properly loaded')
             return resolve(composedFrames[0])
          }

          gifshot.createGIF({
            images: composedFrames,
            gifWidth: Math.floor(targetWidth),
            gifHeight: Math.floor(targetHeight),
            interval: 0.2,
            numFrames: composedFrames.length,
            frameDuration: 1,
            sampleInterval: 10,
            progressCallback: (pct) => setUploadProgress(10 + Math.floor(pct * 20))
          }, (obj) => {
            if (!obj.error) {
              resolve(obj.image)
            } else {
              console.error('GIFShot error:', obj.errorCode, obj.errorMsg)
              resolve(composedFrames[0]) 
            }
          })
        } catch (e) {
          console.error('Failed to generate GIF', e)
          resolve(composedFrames[0])
        }
      })
    } else {
      img = await composeResult(photos)
    }

    setCompositeImage(img)
    setUploadProgress(30)
    setUploadStep('save')

    // Step 2: Save local
    const folderPath = activeEvent?.folder_path
    let savedPath = null
    if (folderPath && img) {
      // Determine filename extension based on mode
      const ext = captureMode === 'gif' ? '.gif' : '.jpg'
      const baseFilename = buildFilename()
      
      try {
        if (window.electronAPI && window.electronAPI.savePhoto) {
          savedPath = await window.electronAPI.savePhoto({
            folder: folderPath,
            filename: baseFilename + ext,
            dataUrl: img
          })
          if (savedPath && typeof savedPath === 'object') savedPath = savedPath.path
        } else {
          // fallback to auto-save to disk for electron older code
          savedPath = await savePhotoToDisk(img, folderPath)
        }
      } catch (err) {
        console.error('Failed to save:', err)
      }
      setSavedFilePath(savedPath)
      setSaveStatus(savedPath ? 'saved' : 'error')
    }
    setUploadProgress(55)

    const sessionId = `sess_${Date.now()}`
    setCurrentSessionId(sessionId)

    // Step 3: Upload to Google Drive (jika terhubung)
    let driveUploadResult = null
    if (hasDrive && img) {
      setUploadStep('upload')
      setUploadProgress(60)
      try {
        driveUploadResult = await uploadPhotoToDrive(img, activeEvent.drive_folder_id, buildFilename() + (captureMode === 'gif' ? '.gif' : '.jpg'))
        setDriveResult(driveUploadResult)
        if (!driveUploadResult) setDriveError('Upload gagal — cek koneksi')
      } catch (err) {
        setDriveError(err.message || 'Upload error')
      }
      setUploadProgress(90)
    }

    // Step 4: Generate QR
    setUploadStep('qr')
    setUploadProgress(100)
    await new Promise(r => setTimeout(r, 600)) // animasi sebentar

    // Save session
    addSession({
      id: sessionId,
      event_id: activeEvent?.id,
      template_id: activeTemplate?.id,
      photos: photos, // Restore full photos data (array of frames or strings)
      created_at: new Date().toISOString(),
      file_path: savedPath || null,
      drive_file_id: driveUploadResult?.id || null,
      drive_view_link: driveUploadResult?.viewLink || null,
      drive_download_link: driveUploadResult?.downloadLink || null,
    })

    // Tampilkan QR drive atau langsung result
    if (driveUploadResult) {
      setShowDriveQR(true)
    } else {
      setPhase(PHASES.RESULT)
      setResultTimer(15)
    }
  }, [
    composeResult, savePhotoToDisk, uploadPhotoToDrive,
    hasDrive, activeEvent, activeTemplate, buildFilename, addSession, captureMode
  ])

  // Capture
  const doCapture = useCallback(async () => {
    setPhase(PHASES.CAPTURING)
    
    let frameDataToSave = null
    let burstFrames = []

    if (captureMode === 'gif') {
      for (let i = 0; i < 4; i++) {
        setPhase(PHASES.CAPTURING)
        await new Promise(r => setTimeout(r, 150)) // Flash effect
        const frameData = captureFrame()
        if (frameData) burstFrames.push(frameData)
        setPhase(PHASES.PHOTO_PREVIEW)
        if (i < 3) await new Promise(r => setTimeout(r, 200)) // wait between frames
      }
      frameDataToSave = burstFrames
    } else {
      await new Promise(r => setTimeout(r, 300))
      frameDataToSave = captureFrame()
    }

    if (!frameDataToSave || (Array.isArray(frameDataToSave) && frameDataToSave.length === 0)) { 
      setPhase(PHASES.CHOOSE_MODE); return 
    }

    const newPhotos = [...capturedPhotos]
    if (retakeSlotIndex !== null) newPhotos[retakeSlotIndex] = frameDataToSave
    else newPhotos[currentSlot] = frameDataToSave
    
    setCapturedPhotos(newPhotos)
    setLastCapturedPhoto(Array.isArray(frameDataToSave) ? frameDataToSave[0] : frameDataToSave)
    
    const isLast = retakeSlotIndex !== null ? true : (currentSlot + 1 >= totalSlots)

    // For preview, just show the first frame of each slot
    const previewPhotos = newPhotos.map(p => Array.isArray(p) ? p[0] : p)

    composePartialPreview(previewPhotos).then(preview => {
      setPreviewComposite(preview)
      setPhase(PHASES.PHOTO_PREVIEW)

      const timer = setTimeout(() => {
        if (isLast) finishSession(newPhotos)
        else { setCurrentSlot(currentSlot + 1); setCountdown(cameraCountdown); setPhase(PHASES.COUNTDOWN) }
      }, 2500)

      window.__boothPreviewTimer = timer
      window.__boothPreviewNext = () => {
        clearTimeout(timer)
        window.__boothPreviewTimer = null
        if (isLast) finishSession(newPhotos)
        else { setCurrentSlot(currentSlot + 1); setCountdown(cameraCountdown); setPhase(PHASES.COUNTDOWN) }
      }
    })
  }, [capturedPhotos, currentSlot, totalSlots, captureFrame, retakeSlotIndex, composePartialPreview, finishSession, cameraCountdown, captureMode])

  useEffect(() => () => { if (window.__boothPreviewTimer) clearTimeout(window.__boothPreviewTimer) }, [])

  useEffect(() => {
    if (phase !== PHASES.RESULT) return
    // Removed timeout so user can manually close
  }, [phase])

  const handleRetakeSession = useCallback(() => {
    if (currentSessionId && removeSession) removeSession(currentSessionId)
    setCapturedPhotos([]); setCompositeImage(null); setCurrentSlot(0)
    setCountdown(cameraCountdown); setCurrentSessionId(null); setRetakeSlotIndex(null)
    setLastCapturedPhoto(null); setSaveStatus(null); setSavedFilePath(null)
    setDriveResult(null); setDriveError(null); setShowDriveQR(false)
    setPhase(PHASES.COUNTDOWN)
  }, [currentSessionId, removeSession])

  const handleRetakeSinglePhoto = useCallback((slotIdx) => {
    setRetakeSlotIndex(slotIdx); setCurrentSlot(slotIdx); setCountdown(cameraCountdown); setPhase(PHASES.COUNTDOWN)
  }, [])

  const handleRetakePastSession = useCallback((session) => {
    const template = templates.find(t => t.id === session.template_id)
    if (template) setChosenTemplate(template)
    if (removeSession) removeSession(session.id)
    setShowSessionsList(false)
    setPhase(PHASES.COUNTDOWN); setCurrentSlot(0); setCapturedPhotos([])
    setCompositeImage(null); setCountdown(cameraCountdown); setCurrentSessionId(null)
    setRetakeSlotIndex(null); setLastCapturedPhoto(null)
    setDriveResult(null); setDriveError(null); setShowDriveQR(false)
  }, [templates, removeSession])

  const handlePrint = useCallback(() => {
    const imgSrc = compositeImage || capturedPhotos[capturedPhotos.length - 1]
    if (!imgSrc) return
    const PAPER_CSS = {
      '4x6': 'size: 4in 6in portrait', '4x6_portrait': 'size: 4in 6in portrait',
      '4x6_landscape': 'size: 6in 4in landscape', '6x4': 'size: 6in 4in landscape',
      '5x7': 'size: 5in 7in portrait', '6x8': 'size: 6in 8in portrait',
      '2x6_strip': 'size: 2in 6in portrait', '4x4': 'size: 4in 4in',
      '6x9': 'size: 6in 9in portrait',
    }
    const paperSize = activeTemplate?.paper_size || '4x6'
    const pageCss = PAPER_CSS[paperSize] || 'size: 4in 6in portrait'
    const printContent = `<!DOCTYPE html><html><head><title>Print</title><style>
      @page { ${pageCss}; margin: 0; } * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { width: 100%; height: 100%; background: white; }
      .c { width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; }
      img { max-width: 100%; max-height: 100vh; width: 100%; height: 100%; object-fit: contain; display: block; }
    </style></head><body><div class="c"><img src="${imgSrc}" /></div>
    <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},1000)},300)}</script>
    </body></html>`
    const w = window.open('', '_blank', 'width=800,height=600')
    if (w) { w.document.open(); w.document.write(printContent); w.document.close() }
  }, [compositeImage, capturedPhotos, activeTemplate])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') { if (showMenu) setShowMenu(false); else if (showDriveQR) { setShowDriveQR(false); setPhase(PHASES.RESULT); setResultTimer(15) } else exitBoothMode() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [exitBoothMode, showMenu, showDriveQR])

  const modes = [
    { id: 'photo', label: 'Print', icon: <HiOutlineCamera /> },
    { id: 'gif', label: 'GIF', icon: <HiOutlineFilm /> }
  ]
  const visibleTemplates = availableTemplates.slice(tplScrollIdx, tplScrollIdx + 3)

  return (
    <div className="booth-screen" style={{ animation: 'launchFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
      <style>{`@keyframes launchFadeIn { from { opacity: 0; transform: scale(1.02); } to { opacity: 1; transform: scale(1); } }`}</style>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <iframe ref={printFrameRef} style={{ display: 'none', position: 'absolute', width: 0, height: 0, border: 'none' }} title="print-frame" />

      {/* Live camera feed */}
      <video ref={videoRef} autoPlay muted playsInline style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        opacity: (phase === PHASES.CHOOSE_MODE || phase === PHASES.COUNTDOWN) ? 1 : (phase === PHASES.SETUP || phase === PHASES.CHOOSE_TPL ? 0.15 : 0),
        transition: 'opacity 0.3s', transform: 'scaleX(-1)', zIndex: 1,
      }} />

      {(phase === PHASES.CHOOSE_MODE || phase === PHASES.COUNTDOWN) && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2 }} />
      )}

      {/* Back button */}
      {phase !== PHASES.CAPTURING && phase !== PHASES.UPLOADING && (
        <button onClick={exitBoothMode} style={{
          position: 'absolute', top: 12, left: 12, zIndex: 220,
          display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.5)',
          border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20,
          fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)',
        }}>
          <HiOutlineArrowLeft /> Back
        </button>
      )}

      {/* Drive indicator */}
      {phase === PHASES.CHOOSE_MODE && hasDrive && (
        <div style={{
          position: 'absolute', top: 12, right: 60, zIndex: 210,
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
          background: 'rgba(74,222,128,0.15)', borderRadius: 12,
          border: '1px solid rgba(74,222,128,0.3)', fontSize: 11, color: '#4ade80',
        }}>
          <HiOutlineCloud style={{ fontSize: 12 }} /> Drive aktif
        </div>
      )}

      {/* ── UPLOADING PHASE ── */}
      {phase === PHASES.UPLOADING && (
        <UploadingScreen
          step={uploadStep}
          progress={uploadProgress}
          eventName={activeEvent?.name}
        />
      )}

      {/* ── DRIVE QR OVERLAY ── */}
      {showDriveQR && driveResult && (
        <DriveQROverlay
          driveResult={driveResult}
          onClose={() => {
            setShowDriveQR(false)
            setPhase(PHASES.RESULT)
            setResultTimer(15)
          }}
        />
      )}

      {/* CHOOSE TEMPLATE PHASE */}
      {phase === PHASES.CHOOSE_TPL && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', zIndex: 5, animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
          {chosenTemplate && (
            <div style={{ width: 220, height: 320, borderRadius: 12, overflow: 'hidden', marginBottom: 24, border: '3px solid var(--color-accent)', background: 'var(--color-bg-card)', boxShadow: '0 16px 40px rgba(213,82,163,0.4)', animation: 'slideUpFade 0.3s ease-out' }}>
              {chosenTemplate.background_image
                ? <img src={getImageUrl(chosenTemplate.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>{chosenTemplate.photo_slots?.length || 0} slots</div>}
            </div>
          )}
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>Choose a template</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-ghost" style={{ fontSize: 28, color: 'white', padding: 8 }} onClick={() => setTplScrollIdx(Math.max(0, tplScrollIdx - 1))} disabled={tplScrollIdx === 0}><HiOutlineChevronLeft /></button>
            <div style={{ display: 'flex', gap: 16 }}>
              {visibleTemplates.map(tpl => (
                <div key={tpl.id} onClick={() => setChosenTemplate(tpl)} style={{ width: 140, height: 200, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: chosenTemplate?.id === tpl.id ? '3px solid var(--color-accent)' : '3px solid transparent', background: 'var(--color-bg-card)', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: chosenTemplate?.id === tpl.id ? 'scale(1.08)' : 'scale(1)', boxShadow: chosenTemplate?.id === tpl.id ? '0 8px 24px rgba(213,82,163,0.3)' : '0 4px 12px rgba(0,0,0,0.5)', opacity: (chosenTemplate && chosenTemplate.id !== tpl.id) ? 0.6 : 1 }}>
                  {tpl.background_image
                    ? <img src={getImageUrl(tpl.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>{tpl.name}</div>}
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 28, color: 'white', padding: 8 }} onClick={() => setTplScrollIdx(Math.min(Math.max(availableTemplates.length - 3, 0), tplScrollIdx + 1))} disabled={tplScrollIdx >= availableTemplates.length - 3}><HiOutlineChevronRight /></button>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
            <button className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: 16, borderRadius: 'var(--radius-full)' }} onClick={() => setPhase(PHASES.CHOOSE_MODE)}>Back</button>
            <button className="btn btn-launch" style={{ padding: '12px 40px', fontSize: 16, borderRadius: 'var(--radius-full)' }} onClick={() => { if (chosenTemplate || activeTemplate) startSession() }} disabled={!chosenTemplate}>Next</button>
          </div>
        </div>
      )}

      {/* Template thumbnail */}
      {activeTemplate && phase === PHASES.CHOOSE_MODE && (
        <div style={{ position: 'absolute', top: 12, left: 100, zIndex: 210, width: 60, height: 80, borderRadius: 4, overflow: 'hidden', background: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {activeTemplate.background_image
            ? <img src={getImageUrl(activeTemplate.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#888' }}>{activeTemplate.photo_slots?.length || 0}</div>}
        </div>
      )}


      {/* CHOOSE MODE */}
      {phase === PHASES.CHOOSE_MODE && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5, animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
          <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
            {modes.map(m => (
              <button key={m.id} className="booth-mode-btn" onClick={() => { setCaptureMode(m.id); setPhase(PHASES.CHOOSE_TPL) }} style={{ zIndex: 5 }}>
                <div className="mode-circle">{m.icon}</div>
                <span className="mode-name">{m.label}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ padding: '10px 24px', fontSize: 14, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => { exitBoothMode(); window.dispatchEvent(new CustomEvent('navigate-to', { detail: '/templates' })) }}>Edit Templates</button>
        </div>
      )}

      {/* COUNTDOWN */}
      {phase === PHASES.COUNTDOWN && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, height: '100%', width: '100%', animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.9)', marginBottom: 20, letterSpacing: 2, textShadow: '0 2px 10px rgba(0,0,0,0.5)', background: 'rgba(0,0,0,0.4)', padding: '8px 24px', borderRadius: 30, backdropFilter: 'blur(4px)' }}>
            Photo {currentSlot + 1} of {totalSlots}
          </div>
          <div className="booth-countdown" key={countdown} style={{ fontSize: 280, fontWeight: 900, lineHeight: 1, textShadow: '0 20px 60px rgba(0,0,0,0.7)', color: 'white', animation: 'countdownPop 1s ease-out' }}>{countdown}</div>
        </div>
      )}

      {/* CAPTURING */}
      {phase === PHASES.CAPTURING && (
        <div style={{ position: 'absolute', inset: 0, background: 'white', zIndex: 1000, animation: 'flashAnimation 0.5s ease-out forwards' }} />
      )}

      {/* PHOTO PREVIEW */}
      {phase === PHASES.PHOTO_PREVIEW && previewComposite && (
        <div
          onClick={() => { if (window.__boothPreviewNext) window.__boothPreviewNext() }}
          style={{ position: 'absolute', inset: 0, zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', display: 'inline-flex', maxHeight: '82vh', animation: 'ppSlideIn 0.25s ease-out' }}>
            <img src={previewComposite} alt="Preview" style={{ maxHeight: '82vh', maxWidth: '88vw', width: 'auto', height: 'auto', display: 'block', borderRadius: 8, boxShadow: '0 16px 56px rgba(0,0,0,0.7)' }} />
            {totalSlots > 1 && (
              <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 7 }}>
                {Array.from({ length: totalSlots }).map((_, i) => {
                  const done = i < capturedPhotos.filter(Boolean).length
                  return <div key={i} style={{ width: done ? 22 : 8, height: 8, borderRadius: 4, background: done ? '#D552A3' : 'rgba(255,255,255,0.3)', transition: 'width 0.3s' }} />
                })}
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.1)' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #462C7D, #D552A3)', animation: 'ppProgress 2.5s linear forwards' }} />
          </div>
          <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Tap untuk lanjut</div>
          <style>{`
            @keyframes ppSlideIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
            @keyframes ppProgress { from { width: 0%; } to { width: 100%; } }
            @keyframes flashAnimation { 0% { opacity: 1; } 100% { opacity: 0; } }
            @keyframes countdownPop { 0% { transform: scale(0.5); opacity: 0; } 40% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes phaseEnter { 0% { opacity: 0; transform: translateY(20px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>
        </div>
      )}

      {/* PROCESSING (fallback) */}
      {phase === PHASES.PROCESSING && (
        <div className="booth-processing"><div className="spinner" /><h2>Processing...</h2></div>
      )}

      {/* RESULT */}
      {phase === PHASES.RESULT && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', zIndex: 5 }}>
          {/* Left: foto thumbnails */}
          <div style={{ position: 'absolute', top: '50%', left: 20, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 6, maxHeight: '80vh', overflowY: 'auto' }}>
            {capturedPhotos.map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 64, height: 48, borderRadius: 5, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.25)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                  <img src={Array.isArray(p) ? p[0] : p} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <button onClick={() => handleRetakeSinglePhoto(i)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'linear-gradient(135deg, #462C7D99, #D552A3bb)', border: '1px solid rgba(213,82,163,0.5)', color: 'white', padding: '3px 9px', borderRadius: 12, fontSize: 10, cursor: 'pointer' }}>
                  <HiOutlineRefresh style={{ fontSize: 10 }} /> Foto {i + 1}
                </button>
              </div>
            ))}
          </div>

          {/* Top-right actions */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 10, zIndex: 6 }}>
            <button className="btn btn-launch" style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px', fontSize: 13 }} onClick={handleRetakeSession}>
              <HiOutlineRefresh style={{ marginRight: 6 }} /> Ulang Semua
            </button>
            <button className="btn btn-launch" style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px', fontSize: 13 }} onClick={() => setPhase(PHASES.CHOOSE_MODE)}>
              Selesai
            </button>
            <button className="btn btn-secondary" style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px', fontSize: 13, background: 'rgba(255,255,255,0.15)' }} onClick={() => setShowSessionsList(true)}>
              <HiOutlineClock style={{ marginRight: 6 }} /> Sesi Lalu
            </button>
          </div>

          {/* Center: composite */}
          <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <img src={compositeImage || capturedPhotos[capturedPhotos.length - 1]} alt="Result" style={{ maxWidth: 380, maxHeight: '72vh', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => savePhotoToDisk(compositeImage || (Array.isArray(capturedPhotos[capturedPhotos.length-1]) ? capturedPhotos[capturedPhotos.length-1][0] : capturedPhotos[capturedPhotos.length-1]), activeEvent?.folder_path).then(p => { if (p) { setToastMessage('Berhasil disimpan di: ' + p); setTimeout(() => setToastMessage(''), 3000) } })}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#462C7D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HiOutlineDownload style={{ fontSize: 24, color: 'white' }} />
              </div>
              <span style={{ fontSize: 11, color: 'white' }}>Save</span>
            </div>
            {captureMode !== 'gif' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={handlePrint}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D552A3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HiOutlinePrinter style={{ fontSize: 24, color: 'white' }} />
                </div>
                <span style={{ fontSize: 11, color: 'white' }}>Print</span>
              </div>
            )}
            {/* Show QR Drive button if available */}
            {driveResult && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => setShowDriveQR(true)}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,222,128,0.2)', border: '2px solid #4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HiOutlineCloud style={{ fontSize: 24, color: '#4ade80' }} />
                </div>
                <span style={{ fontSize: 11, color: '#4ade80' }}>QR Drive</span>
              </div>
            )}
          </div>

          {/* Bottom: QR + timer + status */}
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {/* Drive QR kecil */}
            {driveResult ? (
              <>
                <div style={{ background: 'white', borderRadius: 8, padding: 8, cursor: 'pointer' }} onClick={() => setShowDriveQR(true)}>
                  <QRCodeSVG value={driveResult.downloadLink || driveResult.viewLink || ''} size={56} bgColor="white" fgColor="#1a1425" level="M" />
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Scan untuk download</span>
                <span style={{ fontSize: 10, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <HiOutlineCheckCircle style={{ fontSize: 11 }} /> Tersimpan di Drive
                </span>
              </>
            ) : (
              <>
                <div style={{ background: 'white', borderRadius: 8, padding: 8 }}>
                  <QRCodeSVG value={`https://kertasfoto.cloud/s/${Date.now()}`} size={56} bgColor="white" fgColor="black" level="M" />
                </div>
                {driveError && (
                  <span style={{ fontSize: 10, color: '#f87171', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <HiOutlineExclamationCircle style={{ fontSize: 11 }} /> {driveError}
                  </span>
                )}
                {!hasDrive && activeEvent && (
                  <span style={{ fontSize: 10, color: 'rgba(255,165,0,0.55)' }}>⚠ Drive belum terhubung</span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Past Sessions Modal */}
      {showSessionsList && (
        <div className="mega-menu-overlay" onClick={() => setShowSessionsList(false)}>
          <div className="mega-menu" style={{ maxWidth: 500, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="mega-menu-header">
              <div className="mega-menu-event">Past Sessions</div>
              <button style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }} onClick={() => setShowSessionsList(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 0', maxHeight: '60vh', overflowY: 'auto' }}>
              {eventSessions.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No past sessions yet</p>
              ) : (
                eventSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(session => {
                  const tpl = templates.find(t => t.id === session.template_id)
                  return (
                    <div key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{tpl?.name || 'Unknown template'}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {new Date(session.created_at).toLocaleString()} · {session.photos} photos
                          {session.drive_view_link && <HiOutlineCloud style={{ color: '#4ade80', fontSize: 11 }} />}
                        </div>
                      </div>
                      <button className="btn btn-secondary" style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12 }} onClick={() => handleRetakePastSession(session)}>
                        <HiOutlineRefresh style={{ marginRight: 4 }} /> Retake
                      </button>
                    </div>
                  )
                })
              )}
            </div>
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
              <div className="mega-menu-col">
                <h4>Google Drive</h4>
                <a style={{ color: hasDrive ? '#4ade80' : 'var(--color-text-secondary)' }}>
                  {hasDrive ? '✓ Drive aktif' : '✗ Drive tidak aktif'}
                </a>
                {activeEvent?.drive_folder_link && <a onClick={() => window.open(activeEvent.drive_folder_link, '_blank')}>Buka folder Drive</a>}
              </div>
            </div>
            <button className="mega-menu-lock" onClick={() => setShowMenu(false)}><HiOutlineLockClosed /> Lock</button>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,0.06)', letterSpacing: 2, zIndex: 3 }}>se.kertasfoto</div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'white', padding: '10px 24px', borderRadius: 30, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9999, animation: 'slideUpFade 0.3s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
            {toastMessage}
          </div>
        </div>
      )}
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