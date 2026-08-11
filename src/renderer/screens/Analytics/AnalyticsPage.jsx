import { useState, useMemo, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { HiOutlineChartBar, HiOutlinePhotograph, HiOutlinePrinter, HiOutlineCalendar, HiOutlineDownload, HiOutlineTrash, HiOutlineX, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineEye } from 'react-icons/hi'

/**
 * Helper: resolve a session's photo to a displayable URL.
 * Handles data URLs, http URLs, local absolute paths, and relative paths.
 */
function resolveImageUrl(session) {
  if (!session) return null
  // 1. Prefer file_path (saved by main process), then final_image_path
  let raw = session.file_path || session.final_image_path

  // 2. Fallback to photos field (old format or array of frames)
  if (!raw && session.photos) {
    if (Array.isArray(session.photos)) {
      const first = session.photos[0]
      raw = Array.isArray(first) ? first[0] : first
    } else if (typeof session.photos === 'string') {
      raw = session.photos
    }
  }

  // 3. Fallback to drive download link
  if (!raw && (session.drive_download_link || session.drive_view_link)) {
    return session.drive_download_link || session.drive_view_link
  }

  if (!raw || typeof raw !== 'string') return null

  // 4. Already a displayable URL
  if (raw.startsWith('data:') || raw.startsWith('http') || raw.startsWith('blob:') || raw.startsWith('file://')) {
    return raw
  }

  // 5. Local filesystem path → file:/// protocol (3 slashes for Windows C:/...)
  const clean = raw.replace(/\\/g, '/')
  return clean.startsWith('/') ? `file://${clean}` : `file:///${clean}`
}

export default function AnalyticsPage() {
  const { sessions, events, templates, removeSession } = useApp()
  const [filterEvent, setFilterEvent] = useState('all')
  const [previewIndex, setPreviewIndex] = useState(null)

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let filtered = sessions || []
    if (filterEvent !== 'all') {
      filtered = filtered.filter(s => s.event_id === filterEvent)
    }

    const today = new Date().toISOString().split('T')[0]
    const todaySessions = filtered.filter(s =>
      s.created_at && typeof s.created_at === 'string' && s.created_at.startsWith(today)
    )

    return {
      totalSessions: filtered.length,
      todaySessions: todaySessions.length,
      totalPrints: filtered.length,
      todayPrints: todaySessions.length,
    }
  }, [sessions, filterEvent])

  // ── Filtered & sorted sessions ───────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    let filtered = sessions || []
    if (filterEvent !== 'all') {
      filtered = filtered.filter(s => s.event_id === filterEvent)
    }
    return [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [sessions, filterEvent])

  // ── Stats card config ────────────────────────────────────────────────────
  const statCards = [
    { label: 'Total Sesi', value: stats.totalSessions, icon: HiOutlinePhotograph, color: '#D552A3', bg: 'rgba(213, 82, 163, 0.1)' },
    { label: 'Sesi Hari Ini', value: stats.todaySessions, icon: HiOutlineCalendar, color: '#4caf50', bg: 'rgba(76, 175, 80, 0.1)' },
    { label: 'Estimasi Kertas', value: `${stats.totalPrints} Lembar`, icon: HiOutlinePrinter, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    { label: 'Kertas Hari Ini', value: `${stats.todayPrints} Lembar`, icon: HiOutlineChartBar, color: '#f0a030', bg: 'rgba(240, 160, 48, 0.1)' },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header Toolbar ───────────────────────────────────────────── */}
      <div className="toolbar" style={{ paddingRight: 120 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Data & Analytics</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Tinjau statistik pencetakan dan galeri foto event
          </span>
        </div>
        <div className="toolbar-spacer" />
        <select
          className="select"
          style={{ width: 200, padding: '6px 24px 6px 12px', fontSize: 13, height: 32 }}
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
        >
          <option value="all">Semua Event</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="app-body" style={{ padding: 24, animation: 'fadeIn 0.3s' }}>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          {statCards.map((item, i) => {
            const Icon = item.icon
            return (
              <div key={i} className="card p-5 flex items-center gap-4 transition-transform hover:scale-[1.02] cursor-default">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.bg, color: item.color }}>
                  <Icon size={26} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.1em] mb-0.5">{item.label}</span>
                  <span className="text-xl font-black truncate">{item.value}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Gallery */}
        <h2 className="text-lg font-bold mb-4">Galeri Sesi Terbaru</h2>
        <div className="flex-1 overflow-y-auto pr-2 pb-4">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[var(--color-text-muted)] border-2 border-dashed border-[var(--color-border)] rounded-lg">
              <HiOutlinePhotograph size={40} className="mb-2 opacity-50" />
              <p>Belum ada foto yang diambil</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredSessions.map(session => {
                const ev = events.find(e => e.id === session.event_id)
                const tpl = templates.find(t => t.id === session.template_id)
                const imageUrl = resolveImageUrl(session)

                return (
                  <div key={session.id} className="card p-3 flex flex-col group relative overflow-hidden transition-all hover:border-[var(--color-accent)]">
                    <div className="aspect-[2/3] w-full bg-[var(--color-bg-base)] rounded-lg flex items-center justify-center mb-3 overflow-hidden border border-[var(--color-border-subtle)] relative">
                      <SessionThumbnail
                        session={session}
                        onPreview={() => {
                          const idx = filteredSessions.findIndex(s => s.id === session.id)
                          if (idx !== -1) setPreviewIndex(idx)
                        }}
                      />

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <button className="btn btn-launch btn-sm w-24" onClick={() => {
                          const idx = filteredSessions.findIndex(s => s.id === session.id)
                          if (idx !== -1) setPreviewIndex(idx)
                        }}>
                          <HiOutlineEye /> Preview
                        </button>
                        {(resolveImageUrl(session) || session.drive_download_link) && (
                          <button className="btn btn-launch btn-sm w-24" onClick={() => {
                            const dlUrl = resolveImageUrl(session) || session.drive_download_link
                            const a = document.createElement('a')
                            a.href = dlUrl
                            a.download = `photo_${session.id}.jpg`
                            a.click()
                          }}>
                            <HiOutlineDownload /> Unduh
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm w-24" onClick={() => {
                          if (confirm('Hapus sesi ini secara permanen?')) {
                            removeSession(session.id)
                          }
                        }}>
                          <HiOutlineTrash /> Hapus
                        </button>
                      </div>
                    </div>

                    <div className="text-sm font-bold truncate mb-1">{ev?.name || 'Unknown Event'}</div>
                    <div className="text-xs text-[var(--color-text-muted)] truncate">{tpl?.name || 'Unknown Template'}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-2 opacity-80">
                      {session.created_at ? new Date(session.created_at).toLocaleString('id-ID') : 'Unknown Time'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Photo Preview Lightbox ─────────────────────────────────────── */}
      {previewIndex !== null && (() => {
        const session = filteredSessions[previewIndex]
        if (!session) return null
        const ev = events.find(e => e.id === session.event_id)
        const hasPrev = previewIndex > 0
        const hasNext = previewIndex < filteredSessions.length - 1

        const goNext = () => { if (hasNext) setPreviewIndex(previewIndex + 1) }
        const goPrev = () => { if (hasPrev) setPreviewIndex(previewIndex - 1) }
        const close = () => setPreviewIndex(null)

        return (
          <PreviewLightbox
            session={session}
            eventName={ev?.name}
            date={session.created_at}
            sessionId={session.id}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={goPrev}
            onNext={goNext}
            onClose={close}
          />
        )
      })()}
    </div>
  )
}

/* ── Smart Session Thumbnail Component ─────────────────────────────── */
function SessionThumbnail({ session, onPreview }) {
  const primaryUrl = useMemo(() => resolveImageUrl(session), [session])
  const driveUrl = session.drive_download_link || session.drive_view_link
  const [imgSrc, setImgSrc] = useState(primaryUrl)
  const [hasError, setHasError] = useState(!primaryUrl)

  useEffect(() => {
    const url = resolveImageUrl(session)
    setImgSrc(url)
    setHasError(!url)
  }, [session])

  const handleError = () => {
    // If local file failed to load, try drive URL if available
    if (driveUrl && imgSrc !== driveUrl) {
      setImgSrc(driveUrl)
    } else {
      setHasError(true)
    }
  }

  if (hasError || !imgSrc) {
    return (
      <div className="flex flex-col items-center justify-center p-2 text-center opacity-40">
        <HiOutlinePhotograph size={32} />
        <div className="text-[10px] mt-1">File tidak ditemukan</div>
      </div>
    )
  }

  return (
    <img
      src={imgSrc}
      className="w-full h-full object-cover cursor-pointer"
      alt="Session"
      loading="lazy"
      onError={handleError}
      onClick={onPreview}
    />
  )
}

/* ── Lightbox Component ─────────────────────────────────────────────── */
function PreviewLightbox({ session, eventName, date, sessionId, hasPrev, hasNext, onPrev, onNext, onClose }) {
  const primaryUrl = useMemo(() => resolveImageUrl(session), [session])
  const driveUrl = session.drive_download_link || session.drive_view_link
  const [imgSrc, setImgSrc] = useState(primaryUrl)
  const [hasError, setHasError] = useState(!primaryUrl)

  useEffect(() => {
    const url = resolveImageUrl(session)
    setImgSrc(url)
    setHasError(!url)
  }, [session])

  const handleError = () => {
    if (driveUrl && imgSrc !== driveUrl) {
      setImgSrc(driveUrl)
    } else {
      setHasError(true)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      else if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      {/* Close button - Positioned safely below Electron titlebar / window controls */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        style={{
          position: 'absolute', top: 50, right: 32, zIndex: 1000,
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 20, padding: '6px 16px',
          display: 'flex', alignItems: 'center', gap: 6,
          color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s', WebkitAppRegion: 'no-drag',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
      >
        <HiOutlineX size={18} /> Tutup
      </button>

      {/* Navigation arrows */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          style={{
            position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', zIndex: 1000,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
            width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 24, cursor: 'pointer', transition: 'background 0.2s',
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          <HiOutlineChevronLeft />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          style={{
            position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', zIndex: 1000,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
            width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 24, cursor: 'pointer', transition: 'background 0.2s',
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          <HiOutlineChevronRight />
        </button>
      )}

      {/* Image or fallback */}
      {!hasError && imgSrc ? (
        <img
          src={imgSrc}
          alt="Preview"
          onError={handleError}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '85vw', maxHeight: '80vh', objectFit: 'contain',
            borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            animation: 'fadeIn 0.25s ease-out',
          }}
        />
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '85vw', maxHeight: '80vh', padding: 40,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 12
          }}
        >
          <HiOutlinePhotograph size={64} className="mb-4 opacity-40" />
          <div style={{ fontSize: 16, fontWeight: 600 }}>File gambar tidak ditemukan di komputer</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Folder lokasi foto ini telah dipindahkan atau dihapus.</div>
        </div>
      )}

      {/* Info bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 16,
          background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 20px',
        }}
      >
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
          {eventName || 'Unknown'}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          {date ? new Date(date).toLocaleString('id-ID') : ''}
        </span>
        {imgSrc && !hasError && (
          <button
            className="btn btn-sm btn-launch"
            style={{ marginLeft: 8 }}
            onClick={() => {
              const a = document.createElement('a')
              a.href = imgSrc
              a.download = `photo_${sessionId}.jpg`
              a.click()
            }}
          >
            <HiOutlineDownload /> Unduh
          </button>
        )}
      </div>
    </div>
  )
}
