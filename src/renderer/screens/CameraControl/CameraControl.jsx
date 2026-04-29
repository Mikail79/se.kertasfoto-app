import { useState, useEffect, useRef } from 'react'
import { HiOutlineCamera, HiOutlineChevronLeft } from 'react-icons/hi'

export default function CameraControl() {
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [stream, setStream] = useState(null)
  const [enableWebcam, setEnableWebcam] = useState(true)
  const [mirrorLive, setMirrorLive] = useState(true)
  const [resolution, setResolution] = useState(80)
  const [rotation, setRotation] = useState('0')
  const [audioInput, setAudioInput] = useState('')
  const [audioDevices, setAudioDevices] = useState([])
  const videoRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices.filter(d => d.kind === 'videoinput')
        const mics = devices.filter(d => d.kind === 'audioinput')
        setCameras(cams)
        setAudioDevices(mics)
        if (cams.length > 0) setSelectedCamera(cams[0].deviceId)
        if (mics.length > 0) setAudioInput(mics[0].deviceId)
      } catch {
        setCameras([])
      }
    }
    load()
  }, [])

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
        const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedCamera } } })
        if (active) { setStream(s); if (videoRef.current) videoRef.current.srcObject = s }
      } catch {}
    }
    start()
    return () => { active = false; if (stream) stream.getTracks().forEach(t => t.stop()) }
  }, [selectedCamera, enableWebcam])

  return (
    <div className="settings-layout" style={{ height: '100%' }}>
      {/* Left settings panel */}
      <div className="settings-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          <HiOutlineChevronLeft /> Capture Settings
        </div>

        <div className="setting-group">
          <div className="setting-row">
            <div>
              <div className="setting-label">Enable Webcams</div>
              <div className="setting-hint">If disabled, only Canon/Nikon are used</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={enableWebcam} onChange={e => setEnableWebcam(e.target.checked)} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          </div>
        </div>

        <div className="setting-group">
          <div className="setting-label">Webcam Resolution</div>
          <input type="range" className="slider" min="0" max="100" value={resolution} onChange={e => setResolution(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            <span>Faster Framerate</span>
            <span>Higher Quality</span>
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

        <div className="setting-group">
          <div className="setting-label">Webcam</div>
          <select className="select" value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)} style={{ marginTop: 4 }}>
            {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 8)}`}</option>)}
            {cameras.length === 0 && <option>No camera found</option>}
          </select>
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
          <video ref={videoRef} autoPlay muted playsInline style={{ transform: mirrorLive ? 'scaleX(-1)' : 'none', rotate: `${rotation}deg` }} />
        ) : (
          <div className="no-cam">
            <HiOutlineCamera style={{ fontSize: 32, marginBottom: 8 }} />
            <div>Webcam disabled</div>
          </div>
        )}
      </div>
    </div>
  )
}
