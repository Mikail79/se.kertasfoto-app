import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import GoogleDrivePanel from '../../components/GoogleDrivePanel'
import { HiOutlineFolder, HiOutlineClipboardCopy, HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi'

const SECTIONS = ['General', 'Google Drive', 'Capture Settings', 'Print Setup', 'Sharing', 'About']

export default function SettingsPage() {
  const { api } = useApp()
  const [section, setSection] = useState('General')
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

  const sectionIdx = SECTIONS.indexOf(section)
  const prevSection = sectionIdx > 0 ? SECTIONS[sectionIdx - 1] : null
  const nextSection = sectionIdx < SECTIONS.length - 1 ? SECTIONS[sectionIdx + 1] : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        {prevSection ? (
          <button className="btn btn-sm btn-ghost" onClick={() => setSection(prevSection)}>
            <HiOutlineChevronLeft /> {prevSection}
          </button>
        ) : <div />}
        <span style={{ fontSize: 15, fontWeight: 700 }}>{section}</span>
        {nextSection ? (
          <button className="btn btn-sm btn-ghost" onClick={() => setSection(nextSection)}>
            {nextSection} <HiOutlineChevronRight />
          </button>
        ) : <div />}
      </div>

      <div className="app-body" style={{ padding: 24, maxWidth: 700, margin: '0 auto', width: '100%' }}>

        {section === 'General' && (
          <>
            <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 20, border: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>Directories</h3>
              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">Data Directory</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={dataDir} onChange={e => setDataDir(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn" onClick={() => browseFolder(setDataDir)}>Browse</button>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>Real time Export</label>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Export these types of files as they are generated. Useful to send to usb drives and cloud services.</p>
                <div style={{ display: 'flex', gap: 16 }}>
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

            <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>API</h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>You can use the API to communicate and send commands to se.kertasfoto.</p>
              <div className="input-group" style={{ marginBottom: 10 }}>
                <label className="input-label">URL</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" readOnly value={`http://localhost:${apiPort}/api/[action]?password=[password]`} style={{ flex: 1, fontSize: 11 }} />
                  <button className="btn btn-icon" onClick={() => copyToClipboard(`http://localhost:${apiPort}/api/[action]?password=${apiPassword}`, 'url')}>
                    {copied === 'url' ? '✓' : <HiOutlineClipboardCopy />}
                  </button>
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 10 }}>
                <label className="input-label">Password</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={apiPassword} onChange={e => setApiPassword(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn btn-icon" onClick={() => copyToClipboard(apiPassword, 'pw')}>
                    {copied === 'pw' ? '✓' : <HiOutlineClipboardCopy />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Google Drive section ── */}
        {section === 'Google Drive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <GoogleDrivePanel />

            <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border-subtle)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Cara kerja upload otomatis</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { n: '1', title: 'Buat event baru', desc: 'Saat kamu membuat event baru dan Drive terhubung, folder Drive dengan nama event otomatis dibuat.' },
                  { n: '2', title: 'Sesi foto selesai', desc: 'Setelah semua slot foto terisi, foto akan dikomposit dengan template.' },
                  { n: '3', title: 'Upload otomatis', desc: 'Foto hasil komposit langsung diupload ke folder Drive event. Loading screen menampilkan progress real-time.' },
                  { n: '4', title: 'QR Code muncul', desc: 'Setelah upload selesai, QR code langsung muncul. Pengunjung bisa scan untuk download foto mereka.' },
                ].map(step => (
                  <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #462C7D, #D552A3)',
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
        )}

        {section === 'Capture Settings' && (
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Capture Settings</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Configure capture timing, countdown, and photo processing. Accessible from Camera Settings page.</p>
          </div>
        )}

        {section === 'Print Setup' && (
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Print Setup</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Printer selection, copies, and print quality settings coming soon.</p>
          </div>
        )}

        {section === 'Sharing' && (
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border-subtle)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Sharing Settings</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Email, QR code, social media sharing configuration coming soon.</p>
          </div>
        )}

        {section === 'About' && (
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #462C7D, #D552A3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20, fontWeight: 800, color: 'white' }}>SK</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>se.kertasfoto</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>Photobooth Application v1.0.0</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Built with Electron + React + Vite</p>
          </div>
        )}
      </div>
    </div>
  )
}