import { useState, useEffect, useRef, useCallback } from 'react'
import { HiOutlineCamera, HiOutlineChevronLeft, HiOutlineRefresh, HiOutlineInformationCircle, HiOutlineCog, HiOutlinePhotograph, HiOutlineVideoCamera, HiOutlineSwitchHorizontal } from 'react-icons/hi'
import { useApp } from '../../context/AppContext'

// ── Heuristic: Detect HDMI Capture Cards ────────────────────────────────────
// Matches common capture card labels (Elgato, AVerMedia, Magewell, generic)
const CAPTURE_CARD_KEYWORDS = [
  'capture', 'hdmi', 'elgato', 'avermedia', 'magewell', 'camlink',
  'video capture', 'game capture', 'live gamer', 'blackmagic',
  'decklink', 'intensity', 'usb video', 'uvc',
]

function isCaptureCard(label = '') {
  const l = label.toLowerCase()
  return CAPTURE_CARD_KEYWORDS.some(kw => l.includes(kw))
}

/**
 * Apply camera constraints that the hardware actually supports.
 * Silently skips unsupported settings to avoid errors.
 */
async function applyCameraConstraints(track, settings, capabilities) {
  if (!track || !capabilities) return
  const advanced = {}

  // Exposure mode
  if (capabilities.exposureMode?.includes(settings.exposureMode)) {
    advanced.exposureMode = settings.exposureMode
  }
  // Exposure compensation
  if (capabilities.exposureCompensation && settings.exposureCompensation != null) {
    const ec = Number(settings.exposureCompensation)
    const { min, max } = capabilities.exposureCompensation
    if (ec >= min && ec <= max) advanced.exposureCompensation = ec
  }
  // White balance
  if (capabilities.whiteBalanceMode?.includes(settings.whiteBalance === 'auto' ? 'continuous' : 'manual')) {
    advanced.whiteBalanceMode = settings.whiteBalance === 'auto' ? 'continuous' : 'manual'
  }
  // Color temperature (only if WB manual)
  if (settings.whiteBalance !== 'auto' && capabilities.colorTemperature) {
    const ct = Number(settings.colorTemperature)
    const { min, max } = capabilities.colorTemperature
    if (ct >= min && ct <= max) advanced.colorTemperature = ct
  }
  // Focus
  if (capabilities.focusMode?.includes(settings.focusMode)) {
    advanced.focusMode = settings.focusMode
  }
  // Brightness, Contrast, Saturation, Sharpness
  for (const key of ['brightness', 'contrast', 'saturation', 'sharpness']) {
    if (capabilities[key] && settings[key] != null) {
      const v = Number(settings[key])
      const { min, max } = capabilities[key]
      if (v >= min && v <= max) advanced[key] = v
    }
  }

  if (Object.keys(advanced).length > 0) {
    try { await track.applyConstraints({ advanced: [advanced] }) }
    catch (e) { console.warn('[CameraControl] applyConstraints failed:', e.message) }
  }
}

export default function CameraControl() {
  const { cameraDeviceId, updateCameraDeviceId, cameraSettings, updateCameraSettings, api } = useApp()
  const [cameras, setCameras] = useState([])
  const [stream, setStream] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [capabilities, setCapabilities] = useState(null)
  const videoRef = useRef(null)

  // ── Capture Card (HDMI Live Preview) state ────────────────────────────────
  // liveViewDeviceId: device digunakan untuk live preview di booth (bisa capture card atau webcam)
  // captureCardDeviceId: capture card yang terdeteksi otomatis
  // captureCardMode: true = live preview via capture card, jepretan via DCC; false = normal
  const [captureCardMode, setCaptureCardMode] = useState(() =>
    localStorage.getItem('skf_capture_card_mode') === 'true'
  )
  const [liveViewDeviceId, setLiveViewDeviceId] = useState(
    () => localStorage.getItem('skf_live_view_device_id') || ''
  )
  const [captureCardStream, setCaptureCardStream] = useState(null)
  const captureCardVideoRef = useRef(null)
  const [detectedCaptureCards, setDetectedCaptureCards] = useState([])

  // SDK state
  const [sdkConnected, setSdkConnected] = useState(false)
  const [sdkProps, setSdkProps] = useState({})
  const [sdkOptions, setSdkOptions] = useState({})
  const [sdkLoading, setSdkLoading] = useState(false)

  // Check SDK status on mount and periodically
  const checkSDK = useCallback(async () => {
    try {
      const status = await api.cameraSDK_status()
      const connected = !!status.connected
      setSdkConnected(connected)
      
      if (connected) {
        const props = await api.cameraSDK_getAllProperties()
        setSdkProps(props)
        // Load available values for key properties if not already loaded
        const opts = {}
        let anyNewOpts = false
        for (const key of ['iso', 'shutterspeed', 'aperture', 'whitebalance']) {
          if (!sdkOptions[key]) {
            const res = await api.cameraSDK_getPropertyValues(key)
            if (res.success && res.values?.length) {
              opts[key] = res.values
              anyNewOpts = true
            }
          }
        }
        if (anyNewOpts) setSdkOptions(prev => ({ ...prev, ...opts }))
      }
    } catch (e) { 
      console.warn('checkSDK error:', e)
      setSdkConnected(false) 
    }
  }, [api, sdkOptions])

  useEffect(() => { checkSDK() }, [])
  useEffect(() => {
    const interval = setInterval(checkSDK, 2000) // Faster sync (2s)
    return () => clearInterval(interval)
  }, [checkSDK])

  const setSdkProperty = async (name, value) => {
    setSdkLoading(true)
    const res = await api.cameraSDK_setProperty(name, value)
    if (res.success) {
      setSdkProps(prev => ({ ...prev, [name]: String(value) }))
      // Also update display settings
      const map = { iso: 'iso', shutterspeed: 'shutterSpeed', aperture: 'aperture' }
      if (map[name]) updateCameraSettings({ [map[name]]: String(value) })
    }
    setSdkLoading(false)
    return res
  }

  // Destructure settings for convenience
  const s = cameraSettings

  // Scan devices
  const scanDevices = useCallback(async () => {
    setIsScanning(true)
    try {
      // First, get real hardware devices
      await navigator.mediaDevices.getUserMedia({ video: true }).then(st => st.getTracks().forEach(t => t.stop()))
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label }))
      
      // Detect capture cards automatically
      const cards = cams.filter(c => isCaptureCard(c.label))
      setDetectedCaptureCards(cards)

      // Auto-select first capture card as liveViewDeviceId if not already set
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      // Cari device yang BUKAN EOS Webcam untuk Capture Card
      const realHardware = videoDevices.filter(d => !d.label.toLowerCase().includes('eos webcam'))
      
      if (realHardware.length > 0 && !liveViewDeviceId) {
        const defaultId = realHardware[0].deviceId
        setLiveViewDeviceId(defaultId)
        localStorage.setItem('skf_live_view_device_id', defaultId)
      }
      
      // Always add virtual USB camera if SDK is reported as connected
      if (sdkConnected) {
        if (!cams.find(c => c.deviceId === 'virtual-usb')) {
          cams.push({ deviceId: 'virtual-usb', label: 'DSLR Live View (USB via digiCamControl)' })
        }
      }
      
      setCameras(cams)
      if (cams.length > 0 && !cameraDeviceId) updateCameraDeviceId(cams[0].deviceId)
    } catch (e) { 
      console.error('scanDevices error:', e)
      setCameras([]) 
    } finally {
      setIsScanning(false)
    }
  }, [cameraDeviceId, updateCameraDeviceId, sdkConnected, liveViewDeviceId])

  // Sync virtual camera when SDK connection status changes
  useEffect(() => {
    scanDevices()
  }, [sdkConnected]) // Re-scan hardware + virtual when SDK status flips

  useEffect(() => { scanDevices() }, [])
  useEffect(() => {
    const h = () => scanDevices()
    navigator.mediaDevices.addEventListener('devicechange', h)
    return () => navigator.mediaDevices.removeEventListener('devicechange', h)
  }, [scanDevices])

  // Start camera preview (SKIP jika captureCardMode aktif — stream dikelola oleh capture card effect)
  useEffect(() => {
    if (captureCardMode || !cameraDeviceId || !s) {
      if (stream) stream.getTracks().forEach(t => t.stop())
      setStream(null)
      return
    }
    if (cameraDeviceId === 'virtual-usb') {
      if (stream) stream.getTracks().forEach(t => t.stop())
      setStream(null)
      // Attempt to start liveview on camera
      fetch('http://localhost:5513/?CMD=LiveViewWnd_Show').catch(() => {})
      return
    }

    let active = true
    async function start() {
      if (stream) stream.getTracks().forEach(t => t.stop())
      try {
        const w = s.resolution >= 80 ? 1920 : s.resolution >= 50 ? 1280 : 640
        const h = s.resolution >= 80 ? 1080 : s.resolution >= 50 ? 720 : 480
        const st = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraDeviceId }, width: { ideal: w }, height: { ideal: h } }
        })
        if (!active) { st.getTracks().forEach(t => t.stop()); return }
        setStream(st)
        if (videoRef.current) videoRef.current.srcObject = st

        // Detect capabilities
        const track = st.getVideoTracks()[0]
        if (track?.getCapabilities) {
          const caps = track.getCapabilities()
          setCapabilities(caps)
          // Apply current settings
          if (s.mode === 'manual') await applyCameraConstraints(track, s, caps)
        }
      } catch (e) { console.warn('Camera start failed:', e) }
    }
    start()
    return () => { active = false; if (stream) stream.getTracks().forEach(t => t.stop()) }
  }, [cameraDeviceId, s.resolution, captureCardMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply constraints when settings change (without restarting stream)
  useEffect(() => {
    if (!stream || !capabilities || s.mode !== 'manual') return
    const track = stream.getVideoTracks()[0]
    if (track) applyCameraConstraints(track, s, capabilities)
  }, [s.brightness, s.contrast, s.saturation, s.sharpness, s.whiteBalance,
      s.colorTemperature, s.exposureMode, s.exposureCompensation, s.focusMode, s.mode])

  // ENSURE PREVIEW ALWAYS ATTACHED (Normal)
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // ENSURE PREVIEW ALWAYS ATTACHED (Capture Card) + explicit play()
  useEffect(() => {
    const el = captureCardVideoRef.current
    if (el && captureCardStream) {
      el.srcObject = captureCardStream
      el.play().catch(() => {}) // force play, ignore autoplay policy errors
    }
  }, [captureCardStream])

  // ── Capture Card: Start / stop live preview stream ───────────────────────
  const updateLiveViewDeviceId = useCallback((id) => {
    setLiveViewDeviceId(id)
    localStorage.setItem('skf_live_view_device_id', id || '')
  }, [])

  const toggleCaptureCardMode = useCallback((enabled) => {
    setCaptureCardMode(enabled)
    localStorage.setItem('skf_capture_card_mode', enabled ? 'true' : 'false')
    // Expose to AppContext / BoothMode via cameraSettings so BoothMode knows
    // which device to use for its live preview
    updateCameraSettings({ captureCardMode: enabled })
    // Sync ke main process agar cameraSDK.js tahu → proteksi Live View USB
    api.cameraSDK_setCaptureCardMode?.(enabled)?.catch?.(() => {})
  }, [updateCameraSettings, api])

  // Start capture card preview stream in the settings panel
  useEffect(() => {
    if (!captureCardMode || !liveViewDeviceId || liveViewDeviceId === 'virtual-usb') {
      if (captureCardStream) {
        captureCardStream.getTracks().forEach(t => t.stop())
        setCaptureCardStream(null)
      }
      return
    }
    let active = true
    async function startCapCardStream() {
      if (!active || !liveViewDeviceId || liveViewDeviceId === 'virtual-usb') return

      try {
        const st = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: liveViewDeviceId }, 
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          }
        })
        if (active) {
          setCaptureCardStream(st)
          if (captureCardVideoRef.current) {
            captureCardVideoRef.current.srcObject = st
          }
        }
      } catch (e) { 
        console.warn('[CaptureCard] Error starting stream with resolution:', e)
        // Fallback: coba TANPA constraint resolusi, tapi TETAP gunakan capture card yang sama
        if (active) {
          try {
            const fallback = await navigator.mediaDevices.getUserMedia({ 
              video: { deviceId: { exact: liveViewDeviceId } } 
            })
            if (active) {
              setCaptureCardStream(fallback)
              if (captureCardVideoRef.current) {
                captureCardVideoRef.current.srcObject = fallback
              }
            }
          } catch(err) {
            console.error('[CaptureCard] Fatal error starting stream:', err)
          }
        }
      }
    }
    startCapCardStream()
    return () => {
      active = false
      if (captureCardStream) captureCardStream.getTracks().forEach(t => t.stop())
    }
  }, [captureCardMode, liveViewDeviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync captureCardMode into cameraSettings and main process on mount
  useEffect(() => {
    updateCameraSettings({ captureCardMode })
    api.cameraSDK_setCaptureCardMode?.(captureCardMode)?.catch?.(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getCameraType = (label) => {
    const l = (label || '').toLowerCase()
    if (['canon', 'nikon', 'sony', 'fuji', 'olympus', 'panasonic', 'leica'].some(b => l.includes(b))) return 'dslr'
    if (['gopro', 'insta360', 'dji'].some(b => l.includes(b))) return 'action'
    return 'webcam'
  }

  const selectedLabel = cameras.find(c => c.deviceId === cameraDeviceId)?.label || 'Unknown'
  const isProfessional = getCameraType(selectedLabel) === 'dslr'

  // Helper: check if a capability is available
  const hasCap = (key) => capabilities && capabilities[key] != null
  const hasCapRange = (key) => capabilities && capabilities[key]?.min != null

  // Helper for range settings
  const RangeControl = ({ label, hint, capKey, settingKey }) => {
    if (!hasCapRange(capKey)) return null
    const { min, max, step } = capabilities[capKey]
    const val = s[settingKey] ?? Math.round((min + max) / 2)
    return (
      <div className="setting-group">
        <div className="setting-label">{label}</div>
        {hint && <div className="setting-hint">{hint}</div>}
        <input type="range" className="slider" min={min} max={max} step={step || 1}
          value={val} onChange={e => updateCameraSettings({ [settingKey]: Number(e.target.value) })}
          style={{ width: '100%', marginTop: 6 }} />
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'right', marginTop: 2 }}>{val}</div>
      </div>
    )
  }

  const set = (key, val) => updateCameraSettings({ [key]: val })

  // Rotation helper
  const camRotation = Number(s.rotation) || 0
  const isVerticalRotation = camRotation === 90 || camRotation === 270

  return (
    <div className="settings-layout" style={{ height: '100%' }}>
      {/* Left settings panel */}
      <div className="settings-panel" style={{ overflowY: 'auto', maxHeight: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <HiOutlineChevronLeft /> Camera Settings
        </div>

        {/* Camera Selection */}
        <div className="setting-group">
          <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            Camera Device
            <button className="btn btn-ghost" style={{ padding: '0 8px', height: 24, fontSize: 11, background: 'rgba(255,255,255,0.05)' }} onClick={scanDevices} disabled={isScanning}>
              <HiOutlineRefresh className={isScanning ? 'spin' : ''} /> Rescan
            </button>
          </label>
          <select className="input" value={cameraDeviceId} onChange={e => updateCameraDeviceId(e.target.value)}>
            {cameras.map(c => {
              const type = getCameraType(c.label)
              const badge = type === 'dslr' ? ' [DSLR]' : type === 'action' ? ' [Action]' : ''
              return <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 8)}`}{badge}</option>
            })}
            {cameras.length === 0 && <option>No camera found</option>}
          </select>
          {cameras.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {cameras.map(c => {
                const type = getCameraType(c.label)
                return (
                  <span key={c.deviceId} className={`badge ${c.deviceId === cameraDeviceId ? 'badge-accent' : 'badge-neutral'}`}
                    style={{ cursor: 'pointer', fontSize: 10 }} onClick={() => updateCameraDeviceId(c.deviceId)}>
                    {type === 'dslr' ? '📷' : type === 'action' ? '🎬' : '🖥️'} {(c.label || 'Unknown').split('(')[0].trim().slice(0, 20)}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Capture Card Mode ──────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="setting-label" style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HiOutlineVideoCamera style={{ fontSize: 16 }} /> Capture Card Mode
            </div>
            <label className="toggle" title="Aktifkan untuk live preview via HDMI capture card">
              <input type="checkbox" checked={captureCardMode} onChange={e => toggleCaptureCardMode(e.target.checked)} />
              <div className="toggle-track" /><div className="toggle-thumb" />
            </label>
          </div>

          {/* Info box */}
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: '8px 10px', marginBottom: 10, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: captureCardMode ? '#D552A3' : 'var(--color-text-muted)', fontWeight: 600 }}>
              <HiOutlineSwitchHorizontal style={{ flexShrink: 0 }} />
              {captureCardMode ? 'Mode Aktif: Capture Card + DSLR USB' : 'Mode Normal: Webcam / DSLR biasa'}
            </div>
            {captureCardMode ? (
              <>
                <div>🖥️ <b>Live Preview</b>: HDMI Capture Card (browser webcam)</div>
                <div>📷 <b>Jepretan</b>: DSLR via USB → digiCamControl</div>
                <div style={{ marginTop: 4, color: 'rgba(74,222,128,0.8)' }}>✓ Live view bebas dari batasan USB-PTP</div>
              </>
            ) : (
              <div>Gunakan webcam biasa atau DSLR live view untuk preview dan capture.</div>
            )}
          </div>

          {captureCardMode && (
            <>
              {/* Capture Card device selector */}
              <div className="setting-group">
                <label className="input-label">
                  Live Preview Device (Capture Card)
                </label>
                <select className="input" value={liveViewDeviceId} onChange={e => updateLiveViewDeviceId(e.target.value)}>
                  {cameras.filter(c => c.deviceId !== 'virtual-usb').map(c => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {isCaptureCard(c.label) ? '🎞️ ' : '🖥️ '}
                      {c.label || `Camera ${c.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                  {cameras.filter(c => c.deviceId !== 'virtual-usb').length === 0 && <option>No camera found</option>}
                </select>

                {/* Badge: detected capture cards */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {detectedCaptureCards.length > 0 ? (
                    detectedCaptureCards.map(c => (
                      <span key={c.deviceId}
                        className={`badge ${c.deviceId === liveViewDeviceId ? 'badge-accent' : 'badge-neutral'}`}
                        style={{ cursor: 'pointer', fontSize: 10 }}
                        onClick={() => updateLiveViewDeviceId(c.deviceId)}
                      >
                        🎞️ {(c.label || 'Capture Card').split('(')[0].trim().slice(0, 22)}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 10, color: '#f59e0b' }}>⚠ Tidak ada capture card terdeteksi. Pastikan sudah colok dan coba Rescan.</span>
                  )}
                </div>
              </div>

              {/* DSLR (jepretan) device info */}
              <div className="setting-group" style={{ marginTop: 4 }}>
                <div className="input-label">Capture Device (Jepretan via digiCamControl)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '7px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: 18 }}>📷</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: sdkConnected ? '#4ade80' : 'var(--color-text-secondary)' }}>
                      {sdkConnected ? 'DSLR Terhubung via digiCamControl' : 'digiCamControl Offline'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>USB → port 5513 (digiCamControl harus jalan di tray)</div>
                  </div>
                  <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: sdkConnected ? '#4ade80' : '#ef4444' }} />
                </div>
                {!sdkConnected && (
                  <button className="btn btn-ghost" style={{ marginTop: 6, width: '100%', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={async () => { await api.cameraSDK_start(); setTimeout(checkSDK, 3000) }}>
                    <HiOutlineRefresh /> Start digiCamControl (Minimized)
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Basic Controls */}
        <div className="setting-group">
          <div className="setting-row">
            <div><div className="setting-label">Mirror Live View</div></div>
            <label className="toggle">
              <input type="checkbox" checked={s.mirror} onChange={e => set('mirror', e.target.checked)} />
              <div className="toggle-track" /><div className="toggle-thumb" />
            </label>
          </div>
        </div>

        {/* Resolution Slider */}
        <div className="setting-group">
          <div className="setting-label">Preview Quality</div>
          <input type="range" className="slider" min="0" max="100" value={s.resolution}
            onChange={e => set('resolution', Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            <span>640p</span>
            <span>{s.resolution >= 80 ? '1080p' : s.resolution >= 50 ? '720p' : '480p'}</span>
            <span>1080p</span>
          </div>
        </div>

        <div className="setting-group">
          <div className="setting-label">Rotation</div>
          <select className="select" value={s.rotation} onChange={e => set('rotation', e.target.value)} style={{ marginTop: 4 }}>
            <option value="0">0 degrees</option>
            <option value="90">90 degrees</option>
            <option value="180">180 degrees</option>
            <option value="270">270 degrees</option>
          </select>
        </div>


        {/* ── DSLR Controls via SDK ─────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="setting-label" style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HiOutlineCamera style={{ fontSize: 16 }} /> DSLR Controls
            </div>
            <div style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: sdkConnected ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
              color: sdkConnected ? '#4ade80' : '#ef4444',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sdkConnected ? '#4ade80' : '#ef4444' }} />
              {sdkConnected ? 'CLI Connected' : 'Offline'}
            </div>
          </div>

          {sdkConnected ? (
            <>
              {/* ISO — real control */}
              <div className="setting-group">
                <div className="setting-label">ISO</div>
                <select className="select" style={{ fontSize: 12 }} disabled={sdkLoading}
                  value={sdkProps.iso || s.iso}
                  onChange={e => setSdkProperty('iso', e.target.value)}>
                  {(sdkOptions.iso?.length ? sdkOptions.iso : ['100','200','400','800','1600','3200','6400','12800']).map(v => (
                    <option key={v} value={v}>ISO {v}</option>
                  ))}
                </select>
              </div>

              {/* Shutter Speed — real control */}
              <div className="setting-group">
                <div className="setting-label">Shutter Speed</div>
                <select className="select" style={{ fontSize: 12 }} disabled={sdkLoading}
                  value={sdkProps.shutterspeed || s.shutterSpeed}
                  onChange={e => setSdkProperty('shutterspeed', e.target.value)}>
                  {(sdkOptions.shutterspeed?.length ? sdkOptions.shutterspeed : ['1/30','1/60','1/125','1/250','1/500','1/1000']).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Aperture — real control */}
              <div className="setting-group">
                <div className="setting-label">Aperture</div>
                <select className="select" style={{ fontSize: 12 }} disabled={sdkLoading}
                  value={sdkProps.aperture || s.aperture}
                  onChange={e => setSdkProperty('aperture', e.target.value)}>
                  {(sdkOptions.aperture?.length ? sdkOptions.aperture : ['1.4','1.8','2.0','2.8','4.0','5.6','8.0','11','16']).map(v => (
                    <option key={v} value={v}>f/{v}</option>
                  ))}
                </select>
              </div>

              {/* White Balance — real control */}
              {(!sdkOptions.whitebalance || sdkOptions.whitebalance.length > 0) && (
                <div className="setting-group">
                  <div className="setting-label">White Balance</div>
                  <select className="select" style={{ fontSize: 12 }} disabled={sdkLoading}
                    value={sdkProps.whitebalance || 'Auto'}
                    onChange={e => setSdkProperty('whitebalance', e.target.value)}>
                    {(sdkOptions.whitebalance?.length ? sdkOptions.whitebalance : ['Auto']).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}

              {/* Test Capture */}
              <div className="setting-group" style={{ marginTop: 8 }}>
                <button className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={sdkLoading}
                  onClick={async () => {
                    setSdkLoading(true)
                    await api.cameraSDK_capture(null, 'test_capture')
                    setSdkLoading(false)
                  }}>
                  <HiOutlinePhotograph /> Test Capture (Shutter + Flash)
                </button>
              </div>
            </>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
                Untuk kontrol penuh kamera DSLR (ISO, Shutter, Aperture, Flash):
              </p>
              <ol style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
                <li>Install <a href="https://digicamcontrol.com/download" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>digiCamControl</a> (gratis)</li>
                <li>Buka digiCamControl, hubungkan kamera via USB</li>
                <li>Aktifkan <b>Webserver</b> di Settings → Webserver</li>
                <li>Kembali ke halaman ini — status akan berubah hijau</li>
              </ol>
              <button className="btn btn-ghost" style={{ marginTop: 8, width: '100%', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={async () => { await api.cameraSDK_start(); setTimeout(checkSDK, 3000) }}>
                <HiOutlineRefresh /> Coba Start digiCamControl
              </button>
            </div>
          )}
        </div>

        {/* Capture Settings */}
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="setting-label" style={{ fontWeight: 700, fontSize: 13, color: isProfessional ? 'var(--color-accent)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <HiOutlineCog style={{ fontSize: 16 }} /> Capture Settings
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={`btn btn-sm ${s.mode === 'auto' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => set('mode', 'auto')}>Auto</button>
              <button className={`btn btn-sm ${s.mode === 'manual' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => set('mode', 'manual')}>Manual</button>
            </div>
          </div>

          {/* Capabilities info */}
          {s.mode === 'manual' && capabilities && (
            <div style={{ fontSize: 10, color: 'rgba(74,222,128,0.8)', background: 'rgba(74,222,128,0.08)', padding: '6px 10px', borderRadius: 6, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HiOutlineInformationCircle />
              Menampilkan kontrol yang didukung oleh kamera ini
            </div>
          )}

          {s.mode === 'manual' && (
            <>
              {/* Real controllable settings — only show if camera supports them */}
              <RangeControl label="Brightness" hint="Kecerahan gambar" capKey="brightness" settingKey="brightness" />
              <RangeControl label="Contrast" hint="Kontras gambar" capKey="contrast" settingKey="contrast" />
              <RangeControl label="Saturation" hint="Saturasi warna" capKey="saturation" settingKey="saturation" />
              <RangeControl label="Sharpness" hint="Ketajaman gambar" capKey="sharpness" settingKey="sharpness" />

              {/* Exposure Compensation */}
              {hasCapRange('exposureCompensation') && (
                <div className="setting-group">
                  <div className="setting-label">Exposure Compensation</div>
                  <input type="range" className="slider"
                    min={capabilities.exposureCompensation.min} max={capabilities.exposureCompensation.max}
                    step={capabilities.exposureCompensation.step || 0.5}
                    value={s.exposureCompensation}
                    onChange={e => set('exposureCompensation', Number(e.target.value))}
                    style={{ width: '100%', marginTop: 6 }} />
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'right', marginTop: 2 }}>
                    {s.exposureCompensation > 0 ? '+' : ''}{s.exposureCompensation} EV
                  </div>
                </div>
              )}

              {/* White Balance */}
              {hasCap('whiteBalanceMode') && (
                <div className="setting-group">
                  <div className="setting-label">White Balance</div>
                  <select className="select" value={s.whiteBalance} onChange={e => set('whiteBalance', e.target.value)} style={{ marginTop: 4 }}>
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                  </select>
                  {s.whiteBalance === 'manual' && hasCapRange('colorTemperature') && (
                    <>
                      <input type="range" className="slider"
                        min={capabilities.colorTemperature.min} max={capabilities.colorTemperature.max}
                        step={capabilities.colorTemperature.step || 50}
                        value={s.colorTemperature}
                        onChange={e => set('colorTemperature', Number(e.target.value))}
                        style={{ width: '100%', marginTop: 6 }} />
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'right', marginTop: 2 }}>{s.colorTemperature}K</div>
                    </>
                  )}
                </div>
              )}

              {/* Focus Mode */}
              {hasCap('focusMode') && (
                <div className="setting-group">
                  <div className="setting-label">Focus Mode</div>
                  <select className="select" value={s.focusMode} onChange={e => set('focusMode', e.target.value)} style={{ marginTop: 4 }}>
                    {capabilities.focusMode.map(m => (
                      <option key={m} value={m}>{m === 'continuous' ? 'Continuous AF' : m === 'single-shot' ? 'Single AF' : m === 'manual' ? 'Manual' : m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* No controllable settings available */}
              {!hasCapRange('brightness') && !hasCapRange('contrast') && !hasCapRange('saturation') &&
               !hasCapRange('exposureCompensation') && !hasCap('whiteBalanceMode') && !hasCap('focusMode') && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  Kamera ini tidak mendukung kontrol manual via browser.
                  <br/>Atur setting langsung di body kamera.
                </div>
              )}


            </>
          )}

          {/* Image Quality */}
          <div className="setting-group">
            <div className="setting-label">Image Quality</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {[{ k: 'low', l: 'Low' }, { k: 'medium', l: 'Med' }, { k: 'high', l: 'High' }, { k: 'max', l: 'Max' }].map(q => (
                <button key={q.k} className={`btn btn-sm ${s.imageQuality === q.k ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => set('imageQuality', q.k)}>{q.l}</button>
              ))}
            </div>
          </div>

          {/* Capture Delay */}
          <div className="setting-group">
            <div className="setting-label">Capture Delay</div>
            <select className="select" value={s.captureDelay} onChange={e => set('captureDelay', e.target.value)} style={{ marginTop: 4 }}>
              <option value="0">No delay</option>
              <option value="500">0.5 second</option>
              <option value="1000">1 second</option>
              <option value="2000">2 seconds</option>
            </select>
          </div>
        </div>
      </div>

      {/* Camera preview */}
      <div className="settings-preview">
        {captureCardMode ? (
          /* ── Capture Card Mode: dual preview ──────────────────────────── */
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Capture Card live preview (top half) */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderBottom: '2px solid rgba(213,82,163,0.4)' }}>
              {liveViewDeviceId && liveViewDeviceId !== 'virtual-usb' ? (
                <video 
                  ref={captureCardVideoRef}
                  autoPlay muted playsInline style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: isVerticalRotation ? '100cqh' : '100%',
                  height: isVerticalRotation ? '100cqw' : '100%',
                  objectFit: 'contain',
                  transform: `translate(-50%, -50%) ${s.mirror ? 'scaleX(-1)' : ''} rotate(${camRotation}deg)`,
                }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                  <HiOutlineVideoCamera style={{ fontSize: 28, color: '#D552A3', opacity: 0.5 }} />
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Pilih capture card di atas</span>
                </div>
              )}
              <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 700, color: '#D552A3', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 10 }}>
                🎞️ LIVE PREVIEW (Capture Card)
              </div>
              <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, color: captureCardStream ? '#4ade80' : '#ef4444', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 6 }}>
                Stream: {captureCardStream ? `Active (${captureCardStream.getVideoTracks()[0]?.getSettings().width}x${captureCardStream.getVideoTracks()[0]?.getSettings().height})` : 'NULL'} | DeviceID: {liveViewDeviceId ? liveViewDeviceId.substring(0, 12) + '...' : 'none'}
              </div>
            </div>
            {/* DSLR status (bottom half) — Live View USB dimatikan agar HDMI aman */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: sdkConnected ? '#4ade80' : '#ef4444', marginBottom: 4 }}>
                  {sdkConnected ? 'DSLR Terhubung' : 'DSLR Offline'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  {sdkConnected ? (
                    <>
                      <div>✓ Siap jepret via digiCamControl</div>
                      <div>✓ Live View USB dimatikan (HDMI aman)</div>
                      <div style={{ marginTop: 6, color: '#D552A3', fontWeight: 600 }}>Preview → Capture Card (atas)</div>
                      <div style={{ color: '#D552A3', fontWeight: 600 }}>Jepretan → USB shutter (bawah)</div>
                    </>
                  ) : (
                    <>
                      <div>Buka digiCamControl (minimize ke tray)</div>
                      <div>Pastikan kamera terhubung via USB</div>
                    </>
                  )}
                </div>
              </div>
              <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, fontWeight: 700, color: sdkConnected ? '#4ade80' : '#ef4444', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 10 }}>
                📷 DSLR JEPRETAN {sdkConnected ? '(Online)' : '(Offline)'}
              </div>
            </div>
          </div>
        ) : cameraDeviceId ? (
          /* ── Normal Mode ────────────────────────────────────────────── */
          <>
            {cameraDeviceId === 'virtual-usb' ? (
              <img
                src={`http://localhost:5513/liveview.jpg?rand=${Date.now()}`}
                alt="USB Live View"
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: isVerticalRotation ? '100cqh' : '100%',
                  height: isVerticalRotation ? '100cqw' : '100%',
                  objectFit: 'contain',
                  transform: `translate(-50%, -50%) ${s.mirror ? 'scaleX(-1)' : ''} rotate(${camRotation}deg)`,
                }}
                onLoad={(e) => {
                  const img = e.target
                  setTimeout(() => { img.src = `http://localhost:5513/liveview.jpg?rand=${Date.now()}` }, 150)
                }}
                onError={(e) => {
                  const img = e.target
                  setTimeout(() => { img.src = `http://localhost:5513/liveview.jpg?rand=${Date.now()}` }, 1000)
                }}
              />
            ) : (
              <video ref={videoRef} autoPlay muted playsInline style={{
                position: 'absolute', top: '50%', left: '50%',
                width: isVerticalRotation ? '100cqh' : '100%',
                height: isVerticalRotation ? '100cqw' : '100%',
                objectFit: isVerticalRotation ? 'contain' : 'cover',
                transform: `translate(-50%, -50%) ${s.mirror ? 'scaleX(-1)' : ''} rotate(${camRotation}deg)`,
              }} />
            )}
            <div style={{
              position: 'absolute', bottom: 12, left: 12, right: 12,
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'rgba(255,255,255,0.7)',
              background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 6,
              backdropFilter: 'blur(4px)',
            }}>
              <span>{selectedLabel.split('(')[0].trim()}</span>
              <span>{isProfessional ? '📷 DSLR' : '🖥️ Webcam'}</span>
              <span>{s.mode === 'manual' ? `ISO${s.iso} ${s.shutterSpeed} ${s.aperture}` : 'Auto'}</span>
            </div>
          </>
        ) : (
          <div className="no-cam">
            <HiOutlineCamera style={{ fontSize: 32, marginBottom: 8 }} />
            <div>No camera connected</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Connect a USB camera and click Rescan</div>
          </div>
        )}
      </div>

    </div>
  )
}
