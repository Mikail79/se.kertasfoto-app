import { useState, useEffect, useRef, useCallback } from 'react'
import { HiOutlineCamera, HiOutlineChevronLeft, HiOutlineRefresh, HiOutlinePhotograph } from 'react-icons/hi'
import { useApp } from '../../context/AppContext'

export default function CameraControl() {
  const { cameraDeviceId, updateCameraDeviceId } = useApp()
  const [cameras, setCameras] = useState([])
  const selectedCamera = cameraDeviceId
  const [stream, setStream] = useState(null)
  const [enableWebcam, setEnableWebcam] = useState(true)
  const [mirrorLive, setMirrorLive] = useState(true)
  const [resolution, setResolution] = useState(80)
  const [rotation, setRotation] = useState('0')
  const [audioInput, setAudioInput] = useState('')
  const [audioDevices, setAudioDevices] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef(null)

  // Professional camera settings
  const [cameraMode, setCameraMode] = useState('auto') // auto | manual
  const [iso, setIso] = useState('400')
  const [shutterSpeed, setShutterSpeed] = useState('1/125')
  const [aperture, setAperture] = useState('f/2.8')
  const [whiteBalance, setWhiteBalance] = useState('auto')
  const [exposure, setExposure] = useState('0')
  const [focusMode, setFocusMode] = useState('auto')
  const [imageFormat, setImageFormat] = useState('jpeg')
  const [imageQuality, setImageQuality] = useState('high')
  const [captureDelay, setCaptureDelay] = useState('0')
  const [flashMode, setFlashMode] = useState('off')

  // Scan for connected cameras (including USB professional cameras)
  const scanDevices = useCallback(async () => {
    setIsScanning(true)
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(s => s.getTracks().forEach(t => t.stop()))
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices.filter(d => d.kind === 'videoinput')
      const mics = devices.filter(d => d.kind === 'audioinput')
      setCameras(cams)
      setAudioDevices(mics)
      if (cams.length > 0 && !selectedCamera) updateCameraDeviceId(cams[0].deviceId)
      if (mics.length > 0 && !audioInput) setAudioInput(mics[0].deviceId)
    } catch {
      setCameras([])
    }
    setIsScanning(false)
  }, [selectedCamera, audioInput, updateCameraDeviceId])

  // Initial scan
  useEffect(() => { scanDevices() }, [])

  // Auto-detect USB device changes (plug/unplug)
  useEffect(() => {
    const handler = () => { scanDevices() }
    navigator.mediaDevices.addEventListener('devicechange', handler)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler)
  }, [scanDevices])

  // Start camera preview
  useEffect(() => {
    if (!selectedCamera || !enableWebcam) {
      if (stream) stream.getTracks().forEach(t => t.stop())
      setStream(null)
      return
    }
    let active = true
    async function start() {
      if (stream) stream.getTracks().forEach(t => t.stop())
      try {
        const constraints = {
          video: {
            deviceId: { exact: selectedCamera },
            width: { ideal: resolution >= 80 ? 1920 : resolution >= 50 ? 1280 : 640 },
            height: { ideal: resolution >= 80 ? 1080 : resolution >= 50 ? 720 : 480 },
          }
        }
        const s = await navigator.mediaDevices.getUserMedia(constraints)
        if (active) { setStream(s); if (videoRef.current) videoRef.current.srcObject = s }
      } catch (e) { console.warn('Camera start failed:', e) }
    }
    start()
    return () => { active = false; if (stream) stream.getTracks().forEach(t => t.stop()) }
  }, [selectedCamera, enableWebcam, resolution])

  // Detect camera type from label
  const getCameraType = (label) => {
    const l = (label || '').toLowerCase()
    if (l.includes('canon') || l.includes('nikon') || l.includes('sony') || l.includes('fuji') || l.includes('olympus') || l.includes('panasonic') || l.includes('leica') || l.includes('pentax') || l.includes('sigma'))
      return 'dslr'
    if (l.includes('gopro') || l.includes('insta360') || l.includes('dji'))
      return 'action'
    return 'webcam'
  }

  const selectedCameraLabel = cameras.find(c => c.deviceId === selectedCamera)?.label || 'Unknown'
  const selectedCameraType = getCameraType(selectedCameraLabel)
  const isProfessional = selectedCameraType === 'dslr'

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
          <select className="input" value={selectedCamera} onChange={e => updateCameraDeviceId(e.target.value)}>
            {cameras.map(c => {
              const type = getCameraType(c.label)
              const badge = type === 'dslr' ? ' [DSLR/Mirrorless]' : type === 'action' ? ' [Action Cam]' : ''
              return <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 8)}`}{badge}</option>
            })}
            {cameras.length === 0 && <option>No camera found — connect USB camera</option>}
          </select>
          {cameras.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {cameras.map(c => {
                const type = getCameraType(c.label)
                return (
                  <span key={c.deviceId} className={`badge ${c.deviceId === selectedCamera ? 'badge-accent' : 'badge-neutral'}`} style={{ cursor: 'pointer', fontSize: 10 }} onClick={() => setSelectedCamera(c.deviceId)}>
                    {type === 'dslr' ? '📷' : type === 'action' ? '🎬' : '🖥️'} {(c.label || 'Unknown').split('(')[0].trim().slice(0, 20)}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Basic Controls */}
        <div className="setting-group">
          <div className="setting-row">
            <div>
              <div className="setting-label">Enable Camera</div>
              <div className="setting-hint">Toggle camera preview on/off</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={enableWebcam} onChange={e => setEnableWebcam(e.target.checked)} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          </div>
        </div>

        <div className="setting-group">
          <div className="setting-row">
            <div className="setting-label">Mirror Live View</div>
            <label className="toggle">
              <input type="checkbox" checked={mirrorLive} onChange={e => setMirrorLive(e.target.checked)} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          </div>
        </div>

        {/* Resolution Slider */}
        <div className="setting-group">
          <div className="setting-label">Preview Quality</div>
          <input type="range" className="slider" min="0" max="100" value={resolution} onChange={e => setResolution(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            <span>640p (Fast)</span>
            <span>{resolution >= 80 ? '1080p' : resolution >= 50 ? '720p' : '480p'}</span>
            <span>1080p (Quality)</span>
          </div>
        </div>

        <div className="setting-group">
          <div className="setting-label">Rotation</div>
          <select className="select" value={rotation} onChange={e => setRotation(e.target.value)} style={{ marginTop: 4 }}>
            <option value="0">0 degrees</option>
            <option value="90">90 degrees</option>
            <option value="180">180 degrees</option>
            <option value="270">270 degrees</option>
          </select>
        </div>

        {/* Divider: Professional Controls */}
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="setting-label" style={{ fontWeight: 700, fontSize: 13, color: isProfessional ? 'var(--color-accent)' : 'var(--color-text)' }}>
              {isProfessional ? '📷 Professional Controls' : '⚙️ Capture Settings'}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={`btn btn-sm ${cameraMode === 'auto' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCameraMode('auto')}>Auto</button>
              <button className={`btn btn-sm ${cameraMode === 'manual' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCameraMode('manual')}>Manual</button>
            </div>
          </div>

          {cameraMode === 'manual' && (
            <>
              {/* ISO */}
              <div className="setting-group">
                <div className="setting-label">ISO</div>
                <div className="setting-hint">Sensitivity — higher = brighter but noisier</div>
                <select className="select" value={iso} onChange={e => setIso(e.target.value)} style={{ marginTop: 4 }}>
                  {['100', '200', '400', '800', '1600', '3200', '6400', '12800'].map(v => (
                    <option key={v} value={v}>ISO {v}</option>
                  ))}
                </select>
              </div>

              {/* Shutter Speed */}
              <div className="setting-group">
                <div className="setting-label">Shutter Speed</div>
                <div className="setting-hint">Exposure time — faster freezes motion</div>
                <select className="select" value={shutterSpeed} onChange={e => setShutterSpeed(e.target.value)} style={{ marginTop: 4 }}>
                  {['1/30', '1/60', '1/125', '1/250', '1/500', '1/1000', '1/2000'].map(v => (
                    <option key={v} value={v}>{v}s</option>
                  ))}
                </select>
              </div>

              {/* Aperture */}
              <div className="setting-group">
                <div className="setting-label">Aperture</div>
                <div className="setting-hint">Depth of field — lower = more blur</div>
                <select className="select" value={aperture} onChange={e => setAperture(e.target.value)} style={{ marginTop: 4 }}>
                  {['f/1.4', 'f/1.8', 'f/2.0', 'f/2.8', 'f/4.0', 'f/5.6', 'f/8.0', 'f/11', 'f/16'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Exposure Compensation */}
              <div className="setting-group">
                <div className="setting-label">Exposure Compensation</div>
                <select className="select" value={exposure} onChange={e => setExposure(e.target.value)} style={{ marginTop: 4 }}>
                  {['-3', '-2', '-1', '0', '+1', '+2', '+3'].map(v => (
                    <option key={v} value={v}>{v} EV</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* White Balance */}
          <div className="setting-group">
            <div className="setting-label">White Balance</div>
            <select className="select" value={whiteBalance} onChange={e => setWhiteBalance(e.target.value)} style={{ marginTop: 4 }}>
              <option value="auto">Auto</option>
              <option value="daylight">Daylight (5200K)</option>
              <option value="cloudy">Cloudy (6000K)</option>
              <option value="tungsten">Tungsten (3200K)</option>
              <option value="fluorescent">Fluorescent (4000K)</option>
              <option value="flash">Flash (5400K)</option>
              <option value="shade">Shade (7000K)</option>
            </select>
          </div>

          {/* Focus Mode */}
          <div className="setting-group">
            <div className="setting-label">Focus Mode</div>
            <select className="select" value={focusMode} onChange={e => setFocusMode(e.target.value)} style={{ marginTop: 4 }}>
              <option value="auto">Auto Focus (AF-S)</option>
              <option value="continuous">Continuous AF (AF-C)</option>
              <option value="manual">Manual Focus</option>
            </select>
          </div>

          {/* Flash */}
          <div className="setting-group">
            <div className="setting-label">Flash Mode</div>
            <select className="select" value={flashMode} onChange={e => setFlashMode(e.target.value)} style={{ marginTop: 4 }}>
              <option value="off">Off</option>
              <option value="auto">Auto</option>
              <option value="on">Always On</option>
              <option value="redeye">Red-Eye Reduction</option>
            </select>
          </div>

          {/* Image Format */}
          <div className="setting-group">
            <div className="setting-label">Image Format</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {['jpeg', 'png', 'raw'].map(fmt => (
                <button key={fmt} className={`btn btn-sm ${imageFormat === fmt ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setImageFormat(fmt)}>
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Image Quality */}
          <div className="setting-group">
            <div className="setting-label">Image Quality</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {[{ k: 'low', l: 'Low' }, { k: 'medium', l: 'Medium' }, { k: 'high', l: 'High' }, { k: 'max', l: 'Maximum' }].map(q => (
                <button key={q.k} className={`btn btn-sm ${imageQuality === q.k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setImageQuality(q.k)}>
                  {q.l}
                </button>
              ))}
            </div>
          </div>

          {/* Capture Delay */}
          <div className="setting-group">
            <div className="setting-label">Capture Delay</div>
            <select className="select" value={captureDelay} onChange={e => setCaptureDelay(e.target.value)} style={{ marginTop: 4 }}>
              <option value="0">No delay</option>
              <option value="500">0.5 second</option>
              <option value="1000">1 second</option>
              <option value="2000">2 seconds</option>
            </select>
          </div>
        </div>

        {/* Audio */}
        <div className="setting-group">
          <div className="setting-label">Audio Input</div>
          <select className="select" value={audioInput} onChange={e => setAudioInput(e.target.value)} style={{ marginTop: 4 }}>
            {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</option>)}
            {audioDevices.length === 0 && <option>No microphone</option>}
          </select>
        </div>
      </div>

      {/* Camera preview */}
      <div className="settings-preview">
        {enableWebcam && selectedCamera ? (
          <>
            <video ref={videoRef} autoPlay muted playsInline style={{ transform: mirrorLive ? 'scaleX(-1)' : 'none', rotate: `${rotation}deg` }} />
            {/* Overlay info */}
            <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
              <span>{selectedCameraLabel.split('(')[0].trim()}</span>
              <span>{isProfessional ? '📷 DSLR/Mirrorless' : '🖥️ Webcam'}</span>
              <span>{cameraMode === 'manual' ? `ISO${iso} ${shutterSpeed} ${aperture}` : 'Auto Mode'}</span>
            </div>
          </>
        ) : (
          <div className="no-cam">
            <HiOutlineCamera style={{ fontSize: 32, marginBottom: 8 }} />
            <div>Camera disabled</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Connect a USB camera and click Rescan</div>
          </div>
        )}
      </div>
    </div>
  )
}
