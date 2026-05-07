import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import GoogleDrivePanel from '../../components/GoogleDrivePanel'
import { HiOutlineClipboardCopy } from 'react-icons/hi'
import logoImg from '../../../assets/logo.png'

export default function SettingsPage() {
  const { api, cameraCountdown, updateCameraCountdown, previewDuration, updatePreviewDuration } = useApp()
  const [dataDir, setDataDir] = useState('D:\\sekertasfoto')
  const [exportPrints, setExportPrints] = useState(true)
  const [exportOriginals, setExportOriginals] = useState(true)
  const [exportGifs, setExportGifs] = useState(true)
  const [exportVideos, setExportVideos] = useState(true)
  const [exportPath, setExportPath] = useState('')
  const [apiPassword, setApiPassword] = useState(() => Math.random().toString(36).slice(2, 14))
  const [apiPort] = useState(1500)
  const [copied, setCopied] = useState('')

  const browseFolder = async (setter) => {
    if (window.electronAPI) {
      const fp = await window.electronAPI.openFolderDialog()
      if (fp) setter(fp)
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="toolbar" style={{ justifyContent: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Settings</span>
      </div>

      <div className="app-body" style={{ padding: 24, maxWidth: 800, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
        
        {/* ── Capture Settings ── */}
        <div className="settings-card settings-card-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <h3 className="settings-card-header" style={{ marginBottom: 'var(--space-1)' }}>Capture Settings</h3>
          </div>
          
          <div className="input-group">
            <label className="input-label">Countdown Timing (seconds)</label>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Set the countdown timer before taking each photo. (0 = no timer)</p>
            <input 
              type="number" 
              className="input" 
              min="0" 
              max="15"
              value={cameraCountdown} 
              onChange={e => updateCameraCountdown(Math.max(0, parseInt(e.target.value) || 0))} 
              style={{ width: '100%' }} 
            />
          </div>

          <div className="input-group">
            <label className="input-label">Preview Duration (seconds)</label>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>How long to show the captured photo before the next shot. (0 = no preview)</p>
            <input 
              type="number" 
              className="input" 
              min="0" 
              max="10"
              value={previewDuration} 
              onChange={e => updatePreviewDuration(Math.max(0, parseInt(e.target.value) || 0))} 
              style={{ width: '100%' }} 
            />
          </div>
        </div>

        {/* ── Google Drive ── */}
        <div className="settings-card">
          <h3 className="settings-card-header">Google Drive</h3>
          <GoogleDrivePanel />
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Cara kerja upload otomatis</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { n: '1', title: 'Buat event baru', desc: 'Saat membuat event baru dan Drive terhubung, folder Drive event otomatis dibuat.' },
                { n: '2', title: 'Sesi foto selesai', desc: 'Setelah semua slot foto terisi, foto akan dikomposit dengan template.' },
                { n: '3', title: 'Upload otomatis', desc: 'Foto langsung diupload ke folder Drive. Loading screen menampilkan progress.' },
                { n: '4', title: 'QR Code muncul', desc: 'QR code akan muncul di akhir sesi. Pengunjung bisa scan untuk mendownload foto.' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--color-accent-deep), var(--color-accent))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'white',
                  }}>{step.n}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── General Directories ── */}
        <div className="settings-card">
          <h3 className="settings-card-header">Directories & Auto-Export</h3>
          <div className="input-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Data Directory</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={dataDir} onChange={e => setDataDir(e.target.value)} style={{ flex: 1 }} />
              <button className="btn" onClick={() => browseFolder(setDataDir)}>Browse</button>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>Real time Export</label>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Export files as they are generated (e.g. to USB drives or Cloud sync folders).</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[{ label: 'Prints', val: exportPrints, set: setExportPrints }, { label: 'Originals', val: exportOriginals, set: setExportOriginals }, { label: 'GIFs', val: exportGifs, set: setExportGifs }, { label: 'Videos', val: exportVideos, set: setExportVideos }].map(item => (
                <label key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--color-text)' }}>
                  <input type="checkbox" checked={item.val} onChange={e => item.set(e.target.checked)} style={{ accentColor: 'var(--color-accent)' }} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
          <div className="input-group">
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={exportPath} onChange={e => setExportPath(e.target.value)} placeholder="Export folder path" style={{ flex: 1 }} />
              <button className="btn" onClick={() => browseFolder(setExportPath)}>Browse</button>
            </div>
          </div>
        </div>

        {/* ── API ── */}
        <div className="settings-card">
          <h3 className="settings-card-header" style={{ marginBottom: 'var(--space-2)' }}>API Control</h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>Send commands to se.kertasfoto via HTTP requests.</p>
          <div className="input-group" style={{ marginBottom: 10 }}>
            <label className="input-label">URL Endpoint</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" readOnly value={`http://localhost:${apiPort}/api/[action]?password=[password]`} style={{ flex: 1, fontSize: 11 }} />
              <button className="btn btn-icon" onClick={() => copyToClipboard(`http://localhost:${apiPort}/api/[action]?password=${apiPassword}`, 'url')}>
                {copied === 'url' ? '✓' : <HiOutlineClipboardCopy />}
              </button>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={apiPassword} onChange={e => setApiPassword(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-icon" onClick={() => copyToClipboard(apiPassword, 'pw')}>
                {copied === 'pw' ? '✓' : <HiOutlineClipboardCopy />}
              </button>
            </div>
          </div>
        </div>

        {/* ── About ── */}
        <div className="settings-card" style={{ textAlign: 'center' }}>
          <img src={logoImg} alt="logo" style={{ width: 48, height: 48, margin: '0 auto var(--space-3)', display: 'block', objectFit: 'contain' }} />
          <h3 className="settings-card-header" style={{ fontSize: 'var(--text-h2)', marginBottom: 'var(--space-1)' }}>se.kertasfoto</h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>Photobooth Application v1.0.0</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Built with Electron + React + Vite</p>
        </div>

      </div>
    </div>
  )
}