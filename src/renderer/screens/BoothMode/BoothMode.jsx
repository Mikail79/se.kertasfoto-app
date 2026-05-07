import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../../context/AppContext'
import {
  HiOutlineCamera, HiOutlineFilm, HiOutlineRefresh, HiOutlineVideoCamera,
  HiOutlineChevronDown, HiOutlineChevronLeft, HiOutlineChevronRight,
  HiOutlineArrowLeft, HiOutlineLockClosed, HiOutlineLink, HiOutlineShare,
  HiOutlineCog, HiOutlineMail, HiOutlinePrinter, HiOutlineClock,
  HiOutlineTrash, HiOutlineCloud, HiOutlineCheckCircle, HiOutlineExclamationCircle,
  HiOutlineDownload, HiOutlineCheck, 
} from 'react-icons/hi'

const PHASES = {
  CHOOSE_MODE: 'choose_mode',
  CHOOSE_TPL: 'choose_tpl',
  COUNTDOWN: 'countdown',
  CAPTURING: 'capturing',
  PHOTO_PREVIEW: 'photo_preview',
  RETAKE: 'retake',
  PROCESSING: 'processing',
  UPLOADING: 'uploading',
  RESULT: 'result',
}

// ── Synthetic Audio Helper ───────────────────────────────────────────────
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
      osc.start(); osc.stop(audioCtx.currentTime + 0.1)
    } else if (type === 'shutter') {
      osc.type = 'square'
      osc.frequency.setValueAtTime(100, audioCtx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
      osc.start(); osc.stop(audioCtx.currentTime + 0.1)
    } else if (type === 'success') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523, audioCtx.currentTime)
      osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.1)
      osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4)
      osc.start(); osc.stop(audioCtx.currentTime + 0.4)
    }
  } catch(e) {}
}

// ── Upload loading screen ────────────────────────────────────────────────
function UploadingScreen({ step, progress, eventName }) {
  const steps = [
    { key: 'creating_gif', label: 'Membuat animasi GIF...' },
    { key: 'compose',      label: 'Memproses & render foto...' },
    { key: 'save',         label: 'Menyimpan lokal...' },
    { key: 'upload',       label: 'Mengupload ke Google Drive...' },
    { key: 'qr',           label: 'Menyiapkan QR Code...' },
  ]
  const currentIdx = steps.findIndex(s => s.key === step)

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: 'rgba(14,10,20,0.97)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 32,
    }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
        {steps.map((s, i) => {
          const done    = i < currentIdx
          const active  = i === currentIdx
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
                fontSize: 13,
                color: done ? '#4ade80' : active ? 'white' : 'rgba(255,255,255,0.3)',
                fontWeight: active ? 600 : 400, transition: 'all 0.3s',
              }}>{s.label}</span>
            </div>
          )
        })}
      </div>

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

// ── QR Result overlay ────────────────────────────────────────────────────
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

      <div style={{ textAlign: 'center' }}>
        <div style={{
          background: 'white', borderRadius: 16, padding: 20,
          display: 'inline-block',
          boxShadow: '0 0 60px rgba(213,82,163,0.3)',
        }}>
          <QRCodeSVG value={qrUrl} size={200} bgColor="white" fgColor="#1a1425" level="M" />
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>
          Scan untuk mengunduh foto kamu
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, maxWidth: 300, wordBreak: 'break-all' }}>
          {qrUrl}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {downloadLink && (
          <a href={downloadLink} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
            borderRadius: 20, background: 'linear-gradient(135deg, #462C7D, #D552A3)',
            color: 'white', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}>
            <HiOutlineDownload /> Download Foto
          </a>
        )}
        <button onClick={onClose} style={{
          padding: '8px 24px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
          background: 'transparent', color: 'white', fontSize: 13, cursor: 'pointer',
        }}>
          Selesai
        </button>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  )
}

// ── RETAKE Phase UI ──────────────────────────────────────────────────────
function RetakeScreen({
  capturedPhotos,
  totalSlots,
  previewComposite,
  captureMode,
  onRetakeSlot,
  onRetakeAll,
  onSubmit,
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: 'rgba(14,10,20,0.96)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28, animation: 'phaseEnter 0.35s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
      padding: '24px 20px',
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0, letterSpacing: 0.5 }}>
        Review Foto
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0, marginTop: -16 }}>
        Periksa setiap foto sebelum diproses
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
          {Array.from({ length: totalSlots }).map((_, i) => {
            const photo = capturedPhotos[i]
            const src   = Array.isArray(photo) ? photo[0] : photo
            const filled = !!src
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 120, height: 90, borderRadius: 10, overflow: 'hidden',
                  border: `2px solid ${filled ? 'rgba(213,82,163,0.6)' : 'rgba(255,255,255,0.15)'}`,
                  background: 'rgba(255,255,255,0.05)',
                  position: 'relative', flexShrink: 0,
                  boxShadow: filled ? '0 4px 20px rgba(213,82,163,0.25)' : 'none',
                }}>
                  {src ? (
                    <img src={src} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11,
                    }}>Kosong</div>
                  )}
                  {captureMode === 'gif' && Array.isArray(photo) && photo.length > 1 && (
                    <div style={{
                      position: 'absolute', top: 4, right: 4, background: 'rgba(70,44,125,0.9)',
                      color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    }}>GIF</div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Foto {i + 1}</span>
                <button
                  onClick={() => onRetakeSlot(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'rgba(213,82,163,0.15)',
                    border: '1px solid rgba(213,82,163,0.4)',
                    color: 'rgba(255,255,255,0.8)',
                    padding: '5px 12px', borderRadius: 14, fontSize: 11, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(213,82,163,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(213,82,163,0.15)' }}
                >
                  <HiOutlineRefresh style={{ fontSize: 11 }} /> Ulang
                </button>
              </div>
            )
          })}
        </div>

        {previewComposite && (
          <div style={{
            borderRadius: 10, overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            flexShrink: 0,
          }}>
            <img
              src={previewComposite}
              alt="Preview komposit"
              style={{ display: 'block', maxHeight: 280, maxWidth: 200, width: 'auto', height: 'auto', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {/* <button
          onClick={onRetakeAll}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '11px 26px', borderRadius: 30,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: 'rgba(255,255,255,0.7)',
            fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <HiOutlineRefresh /> Ulang Semua
        </button> */}

        <button
          onClick={onSubmit}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 36px', borderRadius: 30,
            background: 'linear-gradient(135deg, #462C7D, #D552A3)',
            border: 'none', color: 'white', fontSize: 15, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(213,82,163,0.4)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(213,82,163,0.55)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(213,82,163,0.4)' }}
        >
          <HiOutlineCheck style={{ fontSize: 16 }} /> Proses & Simpan
        </button>
      </div>

      <style>{`
        @keyframes phaseEnter {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Main BoothMode ───────────────────────────────────────────────────────
export default function BoothMode() {
  const {
    exitBoothMode, activeEvent, templates,
    addSession, removeSession, sessions,
    gdriveStatus, uploadPhotoToDrive, cameraCountdown, previewDuration,
    cameraDeviceId, updatePhotoToDrive, cameraSettings,
    api,
  } = useApp()

  const availableTemplates = activeEvent
    ? templates.filter(t => t.event_id === activeEvent.id)
    : templates

  const [phase,             setPhase]             = useState(PHASES.CHOOSE_MODE)
  const [countdown,         setCountdown]          = useState(3)
  const [currentSlot,       setCurrentSlot]        = useState(0)
  const [totalSlots,        setTotalSlots]         = useState(1)
  const [capturedPhotos,    setCapturedPhotos]     = useState([])
  const [compositeImage,    setCompositeImage]     = useState(null)
  const [resultTimer,       setResultTimer]        = useState(30)
  const [showMenu,          setShowMenu]           = useState(false)
  const [captureMode,       setCaptureMode]        = useState('photo')
  const [chosenTemplate,    setChosenTemplate]     = useState(availableTemplates.length === 1 ? availableTemplates[0] : null)
  const [tplScrollIdx,      setTplScrollIdx]       = useState(0)
  const [currentSessionId,  setCurrentSessionId]   = useState(null)
  const [showSessionsList,  setShowSessionsList]   = useState(false)
  const [lastCapturedPhoto, setLastCapturedPhoto]  = useState(null)
  const [previewComposite,  setPreviewComposite]   = useState(null)
  const [retakeSlotIndex,   setRetakeSlotIndex]    = useState(null)
  const [saveStatus,        setSaveStatus]         = useState(null)
  const [savedFilePath,     setSavedFilePath]      = useState(null)
  const [toastMessage,      setToastMessage]       = useState('')

  // Drive upload state
  const [uploadStep,     setUploadStep]     = useState('compose')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [driveResult,    setDriveResult]    = useState(null)
  const [showDriveQR,    setShowDriveQR]    = useState(false)
  const [driveError,     setDriveError]     = useState(null)

  const videoRef      = useRef(null)
  const streamRef     = useRef(null)
  const canvasRef     = useRef(null)
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

  // Auto-save to disk (fallback)
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

  const buildFilename = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const eventSlug = (activeEvent?.name || 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)
    return `${eventSlug}_${timestamp}`
  }, [activeEvent])

  const eventSessions = sessions?.filter(s => s.event_id === activeEvent?.id) || []

  useEffect(() => {
    if (activeTemplate?.photo_slots?.length) {
      const photoSlots = activeTemplate.photo_slots.filter(s => s.type !== 'text')
      if (photoSlots.length === 0) { setTotalSlots(1); return }
      const maxIdx = Math.max(...photoSlots.map(s => s.photo_index ?? (s.slot - 1)))
      setTotalSlots(Math.max(1, maxIdx + 1))
    } else {
      setTotalSlots(1)
    }
  }, [activeTemplate, captureMode])

  // Camera — uses settings from Camera Settings page
  const camRes = cameraSettings?.resolution ?? 80
  const camMirror = cameraSettings?.mirror ?? true

  useEffect(() => {
    let active = true
    async function startCam() {
      try {
        const w = camRes >= 80 ? 1920 : camRes >= 50 ? 1280 : 640
        const h = camRes >= 80 ? 1080 : camRes >= 50 ? 720 : 480
        const constraints = {
          video: cameraDeviceId
            ? { deviceId: { exact: cameraDeviceId }, width: { ideal: w }, height: { ideal: h } }
            : { width: { ideal: w }, height: { ideal: h }, facingMode: 'user' },
          audio: false,
        }
        const s = await navigator.mediaDevices.getUserMedia(constraints)
        if (active) {
          streamRef.current = s
          if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play() }
          // Apply manual constraints if set
          if (cameraSettings?.mode === 'manual') {
            const track = s.getVideoTracks()[0]
            if (track?.getCapabilities) {
              const caps = track.getCapabilities()
              const adv = {}
              for (const key of ['brightness','contrast','saturation','sharpness']) {
                if (caps[key] && cameraSettings[key] != null) {
                  const v = Number(cameraSettings[key])
                  if (v >= caps[key].min && v <= caps[key].max) adv[key] = v
                }
              }
              if (caps.exposureCompensation && cameraSettings.exposureCompensation != null) {
                const ec = Number(cameraSettings.exposureCompensation)
                if (ec >= caps.exposureCompensation.min && ec <= caps.exposureCompensation.max) adv.exposureCompensation = ec
              }
              if (caps.whiteBalanceMode && cameraSettings.whiteBalance !== 'auto') {
                adv.whiteBalanceMode = 'manual'
                if (caps.colorTemperature && cameraSettings.colorTemperature) {
                  const ct = Number(cameraSettings.colorTemperature)
                  if (ct >= caps.colorTemperature.min && ct <= caps.colorTemperature.max) adv.colorTemperature = ct
                }
              }
              if (Object.keys(adv).length > 0) {
                try { await track.applyConstraints({ advanced: [adv] }) } catch {}
              }
            }
          }
        }
      } catch (e) { console.warn('Cam error', e) }
    }
    startCam()
    return () => {
      active = false
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    }
  }, [cameraDeviceId, camRes])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !videoRef.current.videoWidth) return null
    const v = videoRef.current
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    const ctx = c.getContext('2d')
    if (camMirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(v, 0, 0)
    const quality = { low: 0.6, medium: 0.8, high: 0.92, max: 1.0 }[cameraSettings?.imageQuality] || 0.92
    return c.toDataURL('image/jpeg', quality)
  }, [camMirror, cameraSettings?.imageQuality])

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
    setPreviewComposite(null)
  }, [cameraCountdown])

  // Must match PAPER_SIZES in TemplateEditor.jsx exactly!
  const SIZES = {
    // Landscape
    '6x4':           [900, 600],
    '7x5':           [1050, 750],
    '8x6':           [1200, 900],
    // Portrait
    '4x6':           [600, 900],
    '5x7':           [750, 1050],
    '6x8':           [900, 1200],
    // Strips
    '2x6_strip':     [300, 900],
    '2x8_strip':     [300, 1200],
    // Square & Social
    '4x4':           [600, 600],
    '3x5':           [450, 750],
    // Postcard
    '6x9':           [900, 1350],
    // Legacy keys (backward compat)
    '4x6_landscape': [900, 600],
    '4x6_portrait':  [600, 900],
  }

  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  const drawQROnCanvas = async (ctx, url, x, y, size, multiplier = 1) => {
    if (!url || !ctx) return
    const px = x * multiplier
    const py = y * multiplier
    const ps = size * multiplier
    let wrapper = null
    let objectUrl = null

    try {
      const { QRCodeSVG } = await import('qrcode.react').catch(() => ({}))
      if (!QRCodeSVG) { drawQRPlaceholder(ctx, px, py, ps); return }
      const React = (await import('react').catch(() => ({ default: null }))).default
      const ReactDOM = await import('react-dom/client').catch(() => null)
      if (!React || !ReactDOM) { drawQRPlaceholder(ctx, px, py, ps); return }

      wrapper = document.createElement('div')
      wrapper.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${Math.round(ps)}px`
      document.body.appendChild(wrapper)

      await new Promise((res) => {
        const root = ReactDOM.createRoot(wrapper)
        root.render(React.createElement(QRCodeSVG, {
          value: url,
          size: Math.round(ps),
          bgColor: 'white',
          fgColor: '#1a1425',
          level: 'M',
        }))
        setTimeout(res, 80)
      })

      const svg = wrapper.querySelector('svg')
      if (!svg) { drawQRPlaceholder(ctx, px, py, ps); return }

      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      objectUrl = URL.createObjectURL(svgBlob)

      await new Promise((res, rej) => {
        const img = new Image()
        img.onload = () => {
          ctx.fillStyle = 'white'
          ctx.fillRect(px, py, ps, ps)
          ctx.drawImage(img, px, py, ps, ps)
          res()
        }
        img.onerror = () => rej(new Error('SVG Image failed to load'))
        img.src = objectUrl
      })
    } catch (err) {
      console.warn('QR draw error:', err)
      drawQRPlaceholder(ctx, px, py, ps)
    } finally {
      if (wrapper && document.body.contains(wrapper)) {
        document.body.removeChild(wrapper)
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }

  const drawQRPlaceholder = (ctx, px, py, ps) => {
    ctx.fillStyle = 'white'
    ctx.fillRect(px, py, ps, ps)
    ctx.fillStyle = '#1a1425'
    ctx.font = `bold ${Math.round(ps * 0.15)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('QR', px + ps / 2, py + ps / 2)
  }

  const composeResult = useCallback(async (photos, scale = 1.0, qrUrlOverride = null) => {
    const tpl = activeTemplate
    if (!tpl?.photo_slots?.length) return photos[0] || null
    const c = document.createElement('canvas')
    const dims = SIZES[tpl.paper_size] || [600, 900]
    const multiplier = ((tpl.dpi || 300) / 150) * scale
    c.width  = dims[0] * multiplier
    c.height = dims[1] * multiplier
    const ctx = c.getContext('2d')

    ctx.fillStyle = tpl.bg_color || '#1a1425'
    ctx.fillRect(0, 0, c.width, c.height)

    const drawOps = []

    if (tpl.background_image) {
      try {
        const bg = await loadImage(getImageUrl(tpl.background_image))
        const bx = (tpl.bg_x || 0) * multiplier
        const by = (tpl.bg_y || 0) * multiplier
        const bw = (tpl.bg_width  || dims[0]) * multiplier
        const bh = (tpl.bg_height || dims[1]) * multiplier
        const z  = tpl.bg_z_index !== undefined ? tpl.bg_z_index : 0
        drawOps.push({ z, draw: () => ctx.drawImage(bg, bx, by, bw, bh) })
      } catch (e) { console.error('Failed to load bg', e) }
    }

    for (let i = 0; i < tpl.photo_slots.length; i++) {
      const slot = tpl.photo_slots[i]
      const sx = slot.x      * multiplier
      const sy = slot.y      * multiplier
      const sw = slot.width  * multiplier
      const sh = slot.height * multiplier
      const z  = slot.z_index || (i + 1)

      if (slot.type === 'text') {
        drawOps.push({
          z,
          draw: () => {
            ctx.save()
            ctx.translate(sx + sw / 2, sy + sh / 2)
            ctx.rotate((slot.rotation || 0) * Math.PI / 180)
            ctx.translate(-(sx + sw / 2), -(sy + sh / 2))
            ctx.fillStyle  = slot.font_color  || '#ffffff'
            ctx.font       = `${slot.font_weight || '700'} ${Math.round((slot.font_size || 40) * multiplier)}px "Plus Jakarta Sans", "Inter", sans-serif`
            ctx.textAlign  = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(slot.text || '', sx + sw / 2, sy + sh / 2)
            ctx.restore()
          }
        })
        continue
      }

      const pIdx    = slot.photo_index !== undefined ? slot.photo_index : (slot.slot - 1)
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
            ctx.translate(sx + sw / 2, sy + sh / 2)
            ctx.rotate((slot.rotation || 0) * Math.PI / 180)
            ctx.translate(-(sx + sw / 2), -(sy + sh / 2))
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

    drawOps.sort((a, b) => a.z - b.z).forEach(op => op.draw())

    // QR slot: hanya digambar jika qrUrlOverride diberikan (berisi link file spesifik)
    if (tpl.qr_slot && qrUrlOverride) {
      const qr = tpl.qr_slot
      const qrSize = qr.width ?? qr.size ?? 150
      const qx = qr.x ?? 50
      const qy = qr.y ?? 50
      await drawQROnCanvas(ctx, qrUrlOverride, qx, qy, qrSize, multiplier)
    }

    return c.toDataURL(scale < 1 ? 'image/png' : 'image/jpeg', 0.9)
  }, [activeTemplate])

  const composePartialPreview = useCallback(async (photos) => {
    const tpl = activeTemplate
    if (!tpl?.photo_slots?.length) return photos[photos.length - 1] || null
    const c    = document.createElement('canvas')
    const dims = SIZES[tpl.paper_size] || [600, 900]
    c.width  = dims[0]
    c.height = dims[1]
    const ctx = c.getContext('2d')

    ctx.fillStyle = tpl.bg_color || '#1a1425'
    ctx.fillRect(0, 0, c.width, c.height)

    const drawOps = []

    if (tpl.background_image) {
      try {
        const bg = await loadImage(getImageUrl(tpl.background_image))
        const z  = tpl.bg_z_index !== undefined ? tpl.bg_z_index : 0
        drawOps.push({ z, draw: () => ctx.drawImage(bg, tpl.bg_x || 0, tpl.bg_y || 0, tpl.bg_width || dims[0], tpl.bg_height || dims[1]) })
      } catch (e) {}
    }

    for (let i = 0; i < tpl.photo_slots.length; i++) {
      const slot = tpl.photo_slots[i]
      const sx = slot.x; const sy = slot.y; const sw = slot.width; const sh = slot.height
      const z  = slot.z_index || (i + 1)

      if (slot.type === 'text') {
        drawOps.push({
          z,
          draw: () => {
            ctx.save()
            ctx.translate(sx + sw / 2, sy + sh / 2)
            ctx.rotate((slot.rotation || 0) * Math.PI / 180)
            ctx.translate(-(sx + sw / 2), -(sy + sh / 2))
            ctx.fillStyle  = slot.font_color || '#ffffff'
            ctx.font       = `${slot.font_weight || '700'} ${Math.round(slot.font_size || 40)}px "Plus Jakarta Sans","Inter",sans-serif`
            ctx.textAlign  = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(slot.text || '', sx + sw / 2, sy + sh / 2)
            ctx.restore()
          }
        })
        continue
      }

      const pIdx    = slot.photo_index !== undefined ? slot.photo_index : (slot.slot - 1)
      const photoSrc = photos[pIdx]
      let img = null
      if (photoSrc) { try { img = await loadImage(photoSrc) } catch(e) {} }

      drawOps.push({
        z,
        draw: () => {
          ctx.save()
          ctx.translate(sx + sw / 2, sy + sh / 2)
          ctx.rotate((slot.rotation || 0) * Math.PI / 180)
          ctx.translate(-(sx + sw / 2), -(sy + sh / 2))
          if (!img) {
            ctx.fillStyle   = 'rgba(255,255,255,0.06)'
            ctx.fillRect(sx, sy, sw, sh)
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'
            ctx.lineWidth   = 2; ctx.setLineDash([8, 6])
            ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2)
          } else {
            const ia = img.width / img.height, sa = sw / sh
            let dx, dy, dw, dh
            if (ia > sa) { dh = img.height; dw = dh * sa; dx = (img.width - dw) / 2; dy = 0 }
            else { dw = img.width; dh = dw / sa; dx = 0; dy = (img.height - dh) / 2 }
            if (slot.bg_color && slot.bg_color !== 'transparent') {
              ctx.fillStyle = slot.bg_color; ctx.fillRect(sx, sy, sw, sh)
            }
            ctx.drawImage(img, dx, dy, dw, dh, sx, sy, sw, sh)
          }
          ctx.restore()
        }
      })
    }

    drawOps.sort((a, b) => a.z - b.z)
    for (const op of drawOps) op.draw()

    // Preview tidak perlu QR real
    return c.toDataURL('image/jpeg', 0.92)
  }, [activeTemplate])

  // Countdown tick
  useEffect(() => {
    if (phase !== PHASES.COUNTDOWN) return
    if (countdown <= 0) { doCapture(); return }
    playSound('beep')
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  const finishSession = useCallback(async (photos) => {
    setPhase(PHASES.UPLOADING)
    setUploadStep('compose')
    setUploadProgress(10)
    setDriveResult(null)
    setDriveError(null)

    // Step 1: compose (tanpa QR final / sementara)
    let img = null
    if (captureMode === 'gif') {
      setUploadStep('creating_gif')
      const composedFrames = []
      for (let frameIdx = 0; frameIdx < 4; frameIdx++) {
        const currentFramePhotos = photos.map(slotFrames =>
          Array.isArray(slotFrames) ? (slotFrames[frameIdx] || slotFrames[0]) : slotFrames
        )
        composedFrames.push(await composeResult(currentFramePhotos, 1.0))
      }

      const firstImg = new Image()
      firstImg.src = composedFrames[0]
      await new Promise(r => { firstImg.onload = r })
      const aspect      = firstImg.width / firstImg.height
      const targetWidth = 600
      const targetHeight = Math.round(600 / aspect)

      img = await new Promise(async (resolve) => {
        try {
          const gifshot = window.gifshot
          if (!gifshot || typeof gifshot.createGIF !== 'function') {
            return resolve(composedFrames[0])
          }
          gifshot.createGIF({
            images: composedFrames,
            gifWidth:  Math.floor(targetWidth),
            gifHeight: Math.floor(targetHeight),
            interval:  0.3,
            progressCallback: (pct) => setUploadProgress(10 + Math.floor(pct * 20)),
          }, (obj) => resolve(obj.error ? composedFrames[0] : obj.image))
        } catch { resolve(composedFrames[0]) }
      })
    } else {
      img = await composeResult(photos)   // QR belum digambar (qrUrlOverride null)
    }

    setCompositeImage(img)
    setUploadProgress(30)

    const sessionId = `sess_${Date.now()}`
    setCurrentSessionId(sessionId)

    // Upload ke Google Drive
    let driveUploadResult = null
    let baseFilename = null
    let fileId = null

    console.log('hasDrive:', hasDrive)
    console.log('driveUploadResult:', driveUploadResult)
    console.log('fileId:', fileId)
    console.log('captureMode:', captureMode)
    console.log('qr_slot:', activeTemplate?.qr_slot)

// STEP 1: Upload awal → buat file & ambil link tetap
if (hasDrive && img) {
  setUploadStep('upload')
  setUploadProgress(60)

  try {
    const ext = captureMode === 'gif' ? '.gif' : '.jpg'
    baseFilename = buildFilename() + ext

    driveUploadResult = await uploadPhotoToDrive(
      img,
      activeEvent.drive_folder_id,
      baseFilename
    )

  console.log('upload result:', driveUploadResult)
  console.log('drive folder:', activeEvent.drive_folder_id)
  console.log('base filename:', baseFilename)

  if (driveUploadResult) {
    fileId = driveUploadResult.id
    console.log('fileId after upload:', fileId)
    console.log('viewLink after upload:', driveUploadResult.viewLink)
  } else {
    setDriveError('Upload gagal — cek koneksi')
  }
  } catch (err) {
    setDriveError(err.message || 'Upload error')
  }
}

// STEP 2: Generate QR dari link file tadi
setUploadStep('qr')
setUploadProgress(85)

let finalImage = img

if (activeTemplate?.qr_slot && captureMode !== 'gif') {
  const fileLink = driveUploadResult?.viewLink

  if (fileLink) {
    try {
      finalImage = await composeResult(photos, 1.0, fileLink)
      if (finalImage) setCompositeImage(finalImage)
    } catch (e) {
      console.warn('QR compose failed:', e)
    }
  }
}

console.log('before overwrite:', {
  hasDrive,
  hasFinalImage: !!finalImage,
  fileId,
})

if (hasDrive && finalImage && fileId) {
  try {
    setUploadStep('upload')
    setUploadProgress(95)

    const updated = await updatePhotoToDrive(
      finalImage,
      fileId,
      baseFilename
    )

    console.log('update result:', updated)

    if (updated) {
      driveUploadResult = updated
      setDriveResult(updated)
    }
  } catch (err) {
    setDriveError(err.message || 'Update final QR gagal')
  }
}
    // Simpan lokal (hanya sekali, dengan QR final)
    setUploadStep('save')
    let savedPath = null
    const folderPath = activeEvent?.folder_path
    const ext = captureMode === 'gif' ? '.gif' : '.jpg'
    const filename = buildFilename() + ext

    if (folderPath && finalImage) {
      try {
        if (window.electronAPI?.savePhoto) {
          const result = await window.electronAPI.savePhoto({
            folder: folderPath,
            filename: filename,
            dataUrl: finalImage,
            dpi: activeTemplate?.dpi || 300
          })
          savedPath = typeof result === 'object' ? result.path : result
          if (savedPath && !savedPath.includes(':') && !savedPath.startsWith('/') && !savedPath.startsWith('\\')) {
            savedPath = `${folderPath}/${savedPath}`.replace(/\\/g, '/')
          }
        } else {
          savedPath = await savePhotoToDisk(finalImage, folderPath)
        }
      } catch (err) {
        console.error('Failed to save:', err)
      }
      setSavedFilePath(savedPath)
      setSaveStatus(savedPath ? 'saved' : 'error')
    }
    setUploadProgress(100)
    playSound('success')

    addSession({
      id:                  sessionId,
      event_id:            activeEvent?.id,
      template_id:         activeTemplate?.id,
      photos:              photos.length,
      created_at:          new Date().toISOString(),
      file_path:           savedPath || null,
      drive_file_id:       driveUploadResult?.id        || null,
      drive_view_link:     driveUploadResult?.viewLink  || null,
      drive_download_link: driveUploadResult?.downloadLink || null,
    })

    if (driveUploadResult) {
      setShowDriveQR(true)
    } else {
      setPhase(PHASES.RESULT)
      setResultTimer(15)
    }
  }, [
    composeResult,
    savePhotoToDisk,
    uploadPhotoToDrive,
    updatePhotoToDrive,
    hasDrive,
    activeEvent,
    activeTemplate,
    buildFilename,
    addSession,
    captureMode,
  ])

  const doCapture = useCallback(async () => {
    setPhase(PHASES.CAPTURING)

    let frameDataToSave = null
    if (captureMode === 'gif') {
      // GIF mode: always use webcam burst (SDK can't do fast sequential shots)
      const burstFrames = []
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 150))
        const f = captureFrame()
        if (f) burstFrames.push(f)
        if (i < 3) await new Promise(r => setTimeout(r, 200))
      }
      frameDataToSave = burstFrames.length > 0 ? burstFrames : null
    } else {
      // Photo mode: try SDK capture first (triggers real shutter + flash)
      let sdkCaptured = false
      try {
        const sdkStatus = await window.electronAPI?.cameraSDK_status?.()
        if (sdkStatus?.connected) {
          const result = await window.electronAPI.cameraSDK_capture(
            activeEvent?.folder_path || null,
            `capture_${Date.now()}`
          )
          if (result?.success && result?.path) {
            // Read the captured file as dataUrl
            frameDataToSave = `file://${result.path.replace(/\\\\/g, '/')}`
            sdkCaptured = true
          }
        }
      } catch (e) { console.warn('SDK capture fallback to webcam:', e) }

      // Fallback: webcam frame capture
      if (!sdkCaptured) {
        await new Promise(r => setTimeout(r, 300))
        frameDataToSave = captureFrame()
      }
    }

    if (!frameDataToSave || (Array.isArray(frameDataToSave) && frameDataToSave.length === 0)) {
      setPhase(PHASES.CHOOSE_MODE)
      return
    }

    playSound('shutter')

    setCapturedPhotos(prev => {
      const next = [...prev]
      const slot = retakeSlotIndex !== null ? retakeSlotIndex : currentSlot
      next[slot]  = frameDataToSave
      return next
    })

    setLastCapturedPhoto(Array.isArray(frameDataToSave) ? frameDataToSave[0] : frameDataToSave)

    const updatedPhotos = (() => {
      const next = [...capturedPhotos]
      const slot = retakeSlotIndex !== null ? retakeSlotIndex : currentSlot
      next[slot]  = frameDataToSave
      return next
    })()

    const previewPhotos = updatedPhotos.map(p => Array.isArray(p) ? p[0] : p)

    composePartialPreview(previewPhotos).then(preview => {
      setPreviewComposite(preview)
      setPhase(PHASES.PHOTO_PREVIEW)

      const goNext = () => {
        const isRetake = retakeSlotIndex !== null
        const isLast   = isRetake ? true : (currentSlot + 1 >= totalSlots)

        if (isLast) {
          setRetakeSlotIndex(null)
          setPhase(PHASES.RETAKE)
        } else {
          setCurrentSlot(cs => cs + 1)
          setCountdown(cameraCountdown)
          setPhase(PHASES.COUNTDOWN)
        }
      }

      const timer = setTimeout(goNext, (previewDuration ?? 3) * 1000)
      window.__boothPreviewTimer = timer
      window.__boothPreviewNext  = () => {
        clearTimeout(timer)
        window.__boothPreviewTimer = null
        goNext()
      }
    })
  }, [capturedPhotos, currentSlot, totalSlots, captureFrame, retakeSlotIndex, composePartialPreview, cameraCountdown, captureMode, previewDuration])

  useEffect(() => () => { if (window.__boothPreviewTimer) clearTimeout(window.__boothPreviewTimer) }, [])

  const handleRetakeAll = useCallback(() => {
    setCapturedPhotos([])
    setCompositeImage(null)
    setCurrentSlot(0)
    setCountdown(cameraCountdown)
    setRetakeSlotIndex(null)
    setLastCapturedPhoto(null)
    setSaveStatus(null)
    setSavedFilePath(null)
    setDriveResult(null)
    setDriveError(null)
    setShowDriveQR(false)
    setPreviewComposite(null)
    setPhase(PHASES.COUNTDOWN)
  }, [cameraCountdown])

  const handleRetakeSinglePhoto = useCallback((slotIdx) => {
    setRetakeSlotIndex(slotIdx)
    setCurrentSlot(slotIdx)
    setCountdown(cameraCountdown)
    setPhase(PHASES.COUNTDOWN)
  }, [cameraCountdown])

  const handleRetakeFromResult = useCallback(() => {
    if (currentSessionId && removeSession) removeSession(currentSessionId)
    handleRetakeAll()
  }, [currentSessionId, removeSession, handleRetakeAll])

  const handleRetakePastSession = useCallback((session) => {
    const template = templates.find(t => t.id === session.template_id)
    if (template) setChosenTemplate(template)
    if (removeSession) removeSession(session.id)
    setShowSessionsList(false)
    handleRetakeAll()
  }, [templates, removeSession, handleRetakeAll])

  const handlePrint = useCallback(async () => {
    let imgSrc = savedFilePath || compositeImage || (Array.isArray(capturedPhotos[capturedPhotos.length - 1]) ? capturedPhotos[capturedPhotos.length - 1][0] : capturedPhotos[capturedPhotos.length - 1])
    
    if (!imgSrc) {
      setToastMessage('Tidak ada foto untuk di-print')
      setTimeout(() => setToastMessage(''), 3000)
      return
    }

    setToastMessage('Membuka pratinjau cetak...')

    try {
      const paperSize = activeTemplate?.paper_size || '4x6'
      // Kita panggil API print di Main Process agar lebih stabil
      // Ini akan membuka jendela baru yang menampilkan foto dan dialog print
      const result = await api.printFile(imgSrc, undefined, paperSize)
      
      if (result?.success) {
        setToastMessage('Print selesai')
      } else if (result?.message && result.message !== 'Cancelled') {
        setToastMessage('Gagal: ' + result.message)
      }
    } catch (err) {
      console.error('Print error:', err)
      setToastMessage('Terjadi kesalahan saat print')
    } finally {
      setTimeout(() => setToastMessage(''), 3000)
    }
  }, [compositeImage, capturedPhotos, savedFilePath, api, activeTemplate])

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        if (showMenu)     { setShowMenu(false); return }
        if (showDriveQR)  { setShowDriveQR(false); setPhase(PHASES.RESULT); setResultTimer(15); return }
        exitBoothMode()
      }
      if ((e.key === ' ' || e.key === 'Enter') && phase === PHASES.PHOTO_PREVIEW) {
        if (window.__boothPreviewNext) window.__boothPreviewNext()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [exitBoothMode, showMenu, showDriveQR, phase])

  const modes = [
    { id: 'photo', label: 'Print', icon: <HiOutlineCamera /> },
    { id: 'gif',   label: 'GIF',   icon: <HiOutlineFilm />   },
  ]
  const visibleTemplates = availableTemplates.slice(tplScrollIdx, tplScrollIdx + 3)

  const showLiveFeed = [PHASES.CHOOSE_MODE, PHASES.COUNTDOWN, PHASES.CHOOSE_TPL].includes(phase)

  return (
    <div className="booth-screen" style={{ animation: 'launchFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
      <style>{`
        @keyframes launchFadeIn   { from { opacity: 0; transform: scale(1.02); } to { opacity: 1; transform: scale(1); } }
        @keyframes phaseEnter     { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes countdownPop   { 0% { transform: scale(0.5); opacity: 0; } 40% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes flashAnimation { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes ppSlideIn      { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes ppProgress     { from { width: 0%; } to { width: 100%; } }
        @keyframes slideUpFade    { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn         { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <iframe 
        ref={printFrameRef} 
        style={{ 
          visibility: 'hidden', 
          position: 'absolute', 
          width: '100%', 
          height: '100%', 
          top: 0, left: 0, 
          zIndex: -1, 
          border: 'none',
          pointerEvents: 'none'
        }} 
        title="print-frame" 
      />

      {cameraDeviceId === 'virtual-usb' ? (
        <img 
          src={`http://localhost:5513/liveview.jpg?rand=${Date.now()}`}
          alt="USB Live View"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            opacity: showLiveFeed ? 1 : 0,
            transition: 'opacity 0.4s',
            transform: `${camMirror ? 'scaleX(-1)' : ''} rotate(${cameraSettings?.rotation || 0}deg)`,
            zIndex: 1,
          }}
          onLoad={(e) => {
            if (!showLiveFeed) return
            const img = e.target
            setTimeout(() => {
              img.src = `http://localhost:5513/liveview.jpg?rand=${Date.now()}`
            }, 150)
          }}
          onError={(e) => {
            const img = e.target
            setTimeout(() => {
              img.src = `http://localhost:5513/liveview.jpg?rand=${Date.now()}`
            }, 1000)
          }}
        />
      ) : (
        <video ref={videoRef} autoPlay muted playsInline style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          opacity: showLiveFeed ? 1 : 0,
          transition: 'opacity 0.4s',
          transform: `${camMirror ? 'scaleX(-1)' : ''} rotate(${cameraSettings?.rotation || 0}deg)`,
          zIndex: 1,
        }} />
      )}

      {showLiveFeed && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)', zIndex: 2 }} />
      )}

      {phase !== PHASES.CAPTURING && phase !== PHASES.UPLOADING && (
        <button onClick={exitBoothMode} style={{
          position: 'absolute', top: 12, left: 12, zIndex: 220,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white',
          padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
          backdropFilter: 'blur(4px)',
        }}>
          <HiOutlineArrowLeft /> Back
        </button>
      )}

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

      {phase === PHASES.UPLOADING && (
        <UploadingScreen step={uploadStep} progress={uploadProgress} eventName={activeEvent?.name} />
      )}

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

      {phase === PHASES.CHOOSE_MODE && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          zIndex: 5, animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        }}>
          <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
            {modes.map(m => (
              <button
                key={m.id}
                className="booth-mode-btn"
                onClick={() => { setCaptureMode(m.id); setPhase(PHASES.CHOOSE_TPL) }}
                style={{ zIndex: 5 }}
              >
                <div className="mode-circle">{m.icon}</div>
                <span className="mode-name">{m.label}</span>
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '10px 24px', fontSize: 14, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
            onClick={() => { exitBoothMode(); window.dispatchEvent(new CustomEvent('navigate-to', { detail: '/templates' })) }}
          >
            Edit Templates
          </button>
        </div>
      )}

      {phase === PHASES.CHOOSE_TPL && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', zIndex: 5,
          animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        }}>
          {chosenTemplate && (
            <div style={{
              width: 220, height: 320, borderRadius: 12, overflow: 'hidden', marginBottom: 24,
              border: '3px solid var(--color-accent)', background: 'var(--color-bg-card)',
              boxShadow: '0 16px 40px rgba(213,82,163,0.4)', animation: 'slideUpFade 0.3s ease-out',
            }}>
              {chosenTemplate.background_image
                ? <img src={getImageUrl(chosenTemplate.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>{chosenTemplate.photo_slots?.length || 0} slots</div>}
            </div>
          )}

          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>Pilih Template</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-ghost" style={{ fontSize: 28, color: 'white', padding: 8 }}
              onClick={() => setTplScrollIdx(Math.max(0, tplScrollIdx - 1))} disabled={tplScrollIdx === 0}>
              <HiOutlineChevronLeft />
            </button>

            <div style={{ display: 'flex', gap: 16 }}>
              {visibleTemplates.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => setChosenTemplate(tpl)}
                  style={{
                    width: 140, height: 200, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    border: chosenTemplate?.id === tpl.id ? '3px solid var(--color-accent)' : '3px solid transparent',
                    background: 'var(--color-bg-card)', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    transform: chosenTemplate?.id === tpl.id ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: chosenTemplate?.id === tpl.id ? '0 8px 24px rgba(213,82,163,0.3)' : '0 4px 12px rgba(0,0,0,0.5)',
                    opacity: (chosenTemplate && chosenTemplate.id !== tpl.id) ? 0.6 : 1,
                  }}
                >
                  {tpl.background_image
                    ? <img src={getImageUrl(tpl.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>{tpl.name}</div>}
                </div>
              ))}
            </div>

            <button className="btn btn-ghost" style={{ fontSize: 28, color: 'white', padding: 8 }}
              onClick={() => setTplScrollIdx(Math.min(Math.max(availableTemplates.length - 3, 0), tplScrollIdx + 1))}
              disabled={tplScrollIdx >= availableTemplates.length - 3}>
              <HiOutlineChevronRight />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
            <button className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: 16, borderRadius: 'var(--radius-full)' }} onClick={() => setPhase(PHASES.CHOOSE_MODE)}>
              Back
            </button>
            <button className="btn btn-launch" style={{ padding: '12px 40px', fontSize: 16, borderRadius: 'var(--radius-full)' }}
              onClick={() => { if (chosenTemplate || activeTemplate) startSession() }} disabled={!chosenTemplate && !activeTemplate}>
              Mulai
            </button>
          </div>
        </div>
      )}

      {activeTemplate && phase === PHASES.CHOOSE_MODE && (
        <div style={{
          position: 'absolute', top: 12, left: 100, zIndex: 210,
          width: 60, height: 80, borderRadius: 4, overflow: 'hidden',
          background: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.2)',
        }}>
          {activeTemplate.background_image
            ? <img src={getImageUrl(activeTemplate.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#888' }}>{activeTemplate.photo_slots?.length || 0}</div>}
        </div>
      )}

      {phase === PHASES.COUNTDOWN && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 5, height: '100%', width: '100%',
          animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        }}>
          <div style={{
            fontSize: 24, color: 'rgba(255,255,255,0.9)', marginBottom: 20,
            letterSpacing: 2, textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            background: 'rgba(0,0,0,0.4)', padding: '8px 24px', borderRadius: 30, backdropFilter: 'blur(4px)',
          }}>
            Foto {(retakeSlotIndex !== null ? retakeSlotIndex : currentSlot) + 1} dari {totalSlots}
          </div>
          <div
            className="booth-countdown"
            key={countdown}
            style={{
              fontSize: 280, fontWeight: 900, lineHeight: 1,
              textShadow: '0 20px 60px rgba(0,0,0,0.7)', color: 'white',
              animation: 'countdownPop 1s ease-out',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {phase === PHASES.CAPTURING && (
        <div style={{
          position: 'absolute', inset: 0, background: 'white', zIndex: 1000,
          animation: 'flashAnimation 0.5s ease-out forwards',
        }} />
      )}

      {phase === PHASES.PHOTO_PREVIEW && previewComposite && (
        <div
          onClick={() => { if (window.__boothPreviewNext) window.__boothPreviewNext() }}
          style={{
            position: 'absolute', inset: 0, zIndex: 15, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.92)', cursor: 'pointer',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-flex', maxHeight: '82vh', animation: 'ppSlideIn 0.25s ease-out' }}>
            <img
              src={previewComposite}
              alt="Preview"
              style={{ maxHeight: '82vh', maxWidth: '88vw', width: 'auto', height: 'auto', display: 'block', borderRadius: 8, boxShadow: '0 16px 56px rgba(0,0,0,0.7)' }}
            />
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
          <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            Tap / Spasi untuk lanjut
          </div>
        </div>
      )}

      {phase === PHASES.RETAKE && (
        <RetakeScreen
          capturedPhotos={capturedPhotos}
          totalSlots={totalSlots}
          previewComposite={previewComposite}
          captureMode={captureMode}
          onRetakeSlot={handleRetakeSinglePhoto}
          onRetakeAll={handleRetakeAll}
          onSubmit={() => finishSession(capturedPhotos)}
        />
      )}

      {phase === PHASES.PROCESSING && (
        <div className="booth-processing"><div className="spinner" /><h2>Processing...</h2></div>
      )}

      {phase === PHASES.RESULT && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', zIndex: 5 }}>
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 10, zIndex: 6 }}>
            <button className="btn btn-launch" style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px', fontSize: 13 }} onClick={handleRetakeFromResult}>
              <HiOutlineRefresh style={{ marginRight: 6 }} /> Ulang
            </button>
            <button className="btn btn-launch" style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px', fontSize: 13 }} onClick={() => setPhase(PHASES.CHOOSE_MODE)}>
              Selesai
            </button>
            <button className="btn btn-secondary" style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px', fontSize: 13, background: 'rgba(255,255,255,0.15)' }} onClick={() => setShowSessionsList(true)}>
              <HiOutlineClock style={{ marginRight: 6 }} /> Sesi Lalu
            </button>
          </div>

          {/* Composite image — auto-sized for landscape/portrait */}
          <div style={{
            display: 'inline-flex', borderRadius: 12, overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.12)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            animation: 'ppSlideIn 0.4s ease-out',
          }}>
            <img
              src={compositeImage || (Array.isArray(capturedPhotos[capturedPhotos.length - 1]) ? capturedPhotos[capturedPhotos.length - 1][0] : capturedPhotos[capturedPhotos.length - 1])}
              alt="Result"
              style={{ maxWidth: '65vw', maxHeight: '72vh', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* Action buttons — right side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)' }}>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              onClick={() => savePhotoToDisk(
                compositeImage || (Array.isArray(capturedPhotos[capturedPhotos.length-1]) ? capturedPhotos[capturedPhotos.length-1][0] : capturedPhotos[capturedPhotos.length-1]),
                activeEvent?.folder_path
              ).then(p => {
                if (p) { setToastMessage('Tersimpan: ' + p); setTimeout(() => setToastMessage(''), 3000) }
              })}
            >
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

            {driveResult && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => setShowDriveQR(true)}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,222,128,0.2)', border: '2px solid #4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HiOutlineCloud style={{ fontSize: 24, color: '#4ade80' }} />
                </div>
                <span style={{ fontSize: 11, color: '#4ade80' }}>QR Drive</span>
              </div>
            )}
          </div>

          {/* Left status panel (QR Code & Status) */}
          <div style={{
            position: 'absolute', left: 40, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            {driveResult ? (
              <>
                <div
                  style={{ background: 'white', borderRadius: 16, padding: 12, cursor: 'pointer', boxShadow: '0 8px 32px rgba(74,222,128,0.25)' }}
                  onClick={() => setShowDriveQR(true)}
                >
                  <QRCodeSVG value={driveResult.downloadLink || driveResult.viewLink || ''} size={110} bgColor="white" fgColor="#1a1425" level="M" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, color: 'white', fontWeight: 600, letterSpacing: 0.5 }}>
                    Scan untuk download
                  </span>
                  <span style={{ fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, background: 'rgba(74,222,128,0.1)', padding: '6px 14px', borderRadius: 20 }}>
                    <HiOutlineCheckCircle style={{ fontSize: 16 }} /> Tersimpan di Drive
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
                {driveError && (
                  <span style={{ fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <HiOutlineExclamationCircle style={{ fontSize: 16 }} /> {driveError}
                  </span>
                )}
                {!hasDrive && activeEvent && (
                  <span style={{ fontSize: 12, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <HiOutlineExclamationCircle style={{ fontSize: 16 }} /> Drive belum terhubung
                  </span>
                )}
                {savedFilePath && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <HiOutlineDownload style={{ fontSize: 16 }} /> Tersimpan lokal
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showSessionsList && (
        <div className="mega-menu-overlay" onClick={() => setShowSessionsList(false)}>
          <div className="mega-menu" style={{ maxWidth: 500, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="mega-menu-header">
              <div className="mega-menu-event">Sesi Lalu</div>
              <button style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }} onClick={() => setShowSessionsList(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 0', maxHeight: '60vh', overflowY: 'auto' }}>
              {eventSessions.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Belum ada sesi</p>
              ) : (
                eventSessions
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map(session => {
                    const tpl = templates.find(t => t.id === session.template_id)
                    return (
                      <div key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{tpl?.name || 'Unknown template'}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {new Date(session.created_at).toLocaleString()} · {session.photos} foto
                            {session.drive_view_link && <HiOutlineCloud style={{ color: '#4ade80', fontSize: 11 }} />}
                          </div>
                        </div>
                        <button className="btn btn-secondary" style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12 }} onClick={() => handleRetakePastSession(session)}>
                          <HiOutlineRefresh style={{ marginRight: 4 }} /> Ulang
                        </button>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {showMenu && (
        <div className="mega-menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="mega-menu" onClick={e => e.stopPropagation()}>
            <div className="mega-menu-header">
              <div className="mega-menu-event">{activeEvent?.name || 'No event'}</div>
              <div className="mega-menu-icons">
                <div className="mega-menu-icon" onClick={() => { setShowMenu(false); exitBoothMode() }}><HiOutlineArrowLeft className="mi" /><span>Exit</span></div>
                <div className="mega-menu-icon"><HiOutlineCog className="mi" /><span>Camera</span></div>
              </div>
            </div>
            <div className="mega-menu-columns">
              <div className="mega-menu-col"><h4>Setup</h4><a>General</a><a>Capture Settings</a><a>Camera Settings</a></div>
              <div className="mega-menu-col"><h4>Process</h4><a>Effects &amp; Stickers</a><a>Background Removal</a><a>Disclaimer</a></div>
              <div className="mega-menu-col"><h4>Sharing</h4><a>Sharing Settings</a><a>Print Setup</a><a>Slideshow</a></div>
              <div className="mega-menu-col">
                <h4>Google Drive</h4>
                <a style={{ color: hasDrive ? '#4ade80' : 'var(--color-text-secondary)' }}>
                  {hasDrive ? '✓ Drive aktif' : '✗ Drive tidak aktif'}
                </a>
                {activeEvent?.drive_folder_link && (
                  <a onClick={() => window.open(activeEvent.drive_folder_link, '_blank')}>Buka folder Drive</a>
                )}
              </div>
            </div>
            <button className="mega-menu-lock" onClick={() => setShowMenu(false)}><HiOutlineLockClosed /> Lock</button>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,0.06)', letterSpacing: 2, zIndex: 3 }}>
        se.kertasfoto
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
          color: 'white', padding: '10px 24px', borderRadius: 30, fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9999, animation: 'slideUpFade 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  )
}