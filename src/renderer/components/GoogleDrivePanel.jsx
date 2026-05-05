import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { HiOutlineCloud, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineExternalLink, HiOutlineKey, HiOutlineChevronDown, HiOutlineChevronUp } from 'react-icons/hi'

/**
 * GoogleDrivePanel
 * Komponen untuk setup dan connect ke Google Drive.
 * Ditampilkan di Dashboard (Settings) atau sidebar event.
 */
export default function GoogleDrivePanel({ compact = false, inDashboard = false }) {
  const {
    gdriveStatus,
    gdriveConnecting,
    connectGdrive,
    disconnectGdrive,
    saveGdriveCredentials,
  } = useApp()

  const [showCredForm, setShowCredForm] = useState(false)
  const [credJson, setCredJson] = useState('')
  const [credError, setCredError] = useState('')
  const [credSaved, setCredSaved] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const handleSaveCred = async () => {
    setCredError('')
    const result = await saveGdriveCredentials(credJson)
    if (result.success) {
      setCredSaved(true)
      setShowCredForm(false)
      setCredJson('')
      setTimeout(() => setCredSaved(false), 3000)
    } else {
      setCredError(result.error || 'JSON tidak valid')
    }
  }

  const handleConnect = async () => {
    const result = await connectGdrive()
    if (!result.success) {
      console.error('GDrive connect failed:', result.error)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    await disconnectGdrive()
    setDisconnecting(false)
  }

  const { hasCredentials, isAuthenticated } = gdriveStatus

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <HiOutlineCloud style={{ fontSize: 16, color: isAuthenticated ? '#4ade80' : 'var(--color-text-muted)' }} />
        <span style={{ fontSize: 12, color: isAuthenticated ? '#4ade80' : 'var(--color-text-muted)', flex: 1 }}>
          {isAuthenticated ? 'Google Drive Terhubung' : 'Google Drive Tidak Aktif'}
        </span>
        {!isAuthenticated && hasCredentials && (
          <button className="btn btn-sm btn-primary" style={{ fontSize: 10, padding: '3px 10px' }} onClick={handleConnect} disabled={gdriveConnecting}>
            {gdriveConnecting ? 'Menghubungkan...' : 'Hubungkan'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border-subtle)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: isAuthenticated ? 'rgba(74,222,128,0.15)' : 'var(--color-bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${isAuthenticated ? 'rgba(74,222,128,0.3)' : 'var(--color-border)'}`,
        }}>
          <HiOutlineCloud style={{ fontSize: 20, color: isAuthenticated ? '#4ade80' : 'var(--color-text-muted)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Google Drive</h3>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
            Upload otomatis foto setelah sesi selesai
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {isAuthenticated ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4ade80' }}>
              <HiOutlineCheckCircle style={{ fontSize: 14 }} /> Terhubung
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
              <HiOutlineXCircle style={{ fontSize: 14 }} /> Tidak aktif
            </span>
          )}
        </div>
      </div>

      {/* Connected state */}
      {isAuthenticated && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            Setiap event baru akan otomatis membuat folder di Google Drive. Foto hasil booth langsung terupload dan QR code akan ditampilkan untuk pengunjung.
          </p>
          <button
            className="btn btn-sm btn-danger"
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{ opacity: disconnecting ? 0.6 : 1 }}
          >
            {disconnecting ? 'Memutuskan...' : 'Putuskan Koneksi'}
          </button>
        </div>
      )}

      {/* Not connected — has credentials */}
      {!isAuthenticated && hasCredentials && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            Credentials sudah tersimpan. Klik tombol di bawah untuk login ke Google dan izinkan akses Drive.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={handleConnect} disabled={gdriveConnecting}>
              {gdriveConnecting ? (
                <><span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', display: 'inline-block', animation: 'spin 0.7s linear infinite', marginRight: 6 }} />Menghubungkan...</>
              ) : (
                <><HiOutlineCloud style={{ marginRight: 4 }} /> Hubungkan ke Google Drive</>
              )}
            </button>
            {!inDashboard && (
              <button className="btn btn-sm btn-ghost" onClick={() => { setShowCredForm(true) }}>
                <HiOutlineKey style={{ marginRight: 4 }} /> Ganti Credentials
              </button>
            )}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Not connected — no credentials */}
      {!isAuthenticated && !hasCredentials && (
        <div>
          {inDashboard ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                Google Drive belum di-setup. Silakan masuk ke menu Settings untuk memasukkan credentials.
              </p>
              <button 
                className="btn btn-primary btn-sm" 
                style={{ alignSelf: 'flex-start' }}
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-to', { detail: '/settings' }))}
              >
                Go to Settings
              </button>
            </div>
          ) : (
            <>
              {/* Setup guide toggle */}
              <button
                className="btn btn-sm btn-ghost"
                style={{ marginBottom: 10, width: '100%', justifyContent: 'space-between' }}
                onClick={() => setShowGuide(!showGuide)}
              >
                <span>📖 Cara setup Google Drive</span>
                {showGuide ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
              </button>

              {showGuide && (
                <div style={{
                  background: 'var(--color-bg-card)', borderRadius: 6, padding: 14,
                  border: '1px solid var(--color-border-subtle)', marginBottom: 14, fontSize: 12,
                  color: 'var(--color-text-secondary)', lineHeight: 1.7,
                }}>
                  <ol style={{ paddingLeft: 18, margin: 0 }}>
                    <li>Buka <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>Google Cloud Console <HiOutlineExternalLink style={{ display: 'inline', verticalAlign: 'middle' }} /></a></li>
                    <li>Buat project baru atau pilih project yang ada</li>
                    <li>Aktifkan <strong style={{ color: 'var(--color-text)' }}>Google Drive API</strong> di Library</li>
                    <li>Pergi ke <strong style={{ color: 'var(--color-text)' }}>Credentials → Create Credentials → OAuth 2.0 Client ID</strong></li>
                    <li>Pilih Application type: <strong style={{ color: 'var(--color-text)' }}>Desktop app</strong></li>
                    <li>Download file JSON-nya</li>
                    <li>Paste isi JSON tersebut di kolom di bawah ini</li>
                  </ol>
                </div>
              )}

              <button className="btn btn-primary btn-sm" style={{ marginBottom: 10 }} onClick={() => setShowCredForm(!showCredForm)}>
                <HiOutlineKey style={{ marginRight: 4 }} />
                {showCredForm ? 'Tutup' : 'Masukkan Credentials JSON'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Credentials form */}
      {showCredForm && !inDashboard && (
        <div style={{ marginTop: 12 }}>
          <div className="input-group">
            <label className="input-label">Paste isi credentials.json</label>
            <textarea
              className="input"
              rows={6}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
              placeholder={'{\n  "installed": {\n    "client_id": "...",\n    "client_secret": "..."\n  }\n}'}
              value={credJson}
              onChange={e => setCredJson(e.target.value)}
            />
          </div>
          {credError && (
            <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 6 }}>⚠ {credError}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSaveCred} disabled={!credJson.trim()}>
              Simpan Credentials
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setShowCredForm(false); setCredJson(''); setCredError('') }}>
              Batal
            </button>
          </div>
        </div>
      )}

      {credSaved && (
        <p style={{ fontSize: 12, color: '#4ade80', marginTop: 8 }}>
          ✓ Credentials tersimpan! Sekarang klik "Hubungkan ke Google Drive".
        </p>
      )}
    </div>
  )
}
