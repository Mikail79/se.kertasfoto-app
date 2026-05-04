import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { HiOutlineChartBar, HiOutlinePhotograph, HiOutlinePrinter, HiOutlineCalendar, HiOutlineDownload, HiOutlineTrash } from 'react-icons/hi'

export default function AnalyticsPage() {
  const { sessions, events, templates, activeEvent, removeSession } = useApp()
  const [filterEvent, setFilterEvent] = useState('all')

  const stats = useMemo(() => {
    let filtered = sessions || []
    if (filterEvent !== 'all') {
      filtered = filtered.filter(s => s.event_id === filterEvent)
    }

    const today = new Date().toISOString().split('T')[0]
    const todaySessions = filtered.filter(s => s.created_at && typeof s.created_at === 'string' && s.created_at.startsWith(today))

    return {
      totalSessions: filtered.length,
      todaySessions: todaySessions.length,
      // Assuming each session is 1 print unless noted otherwise. In a real app we might track print count.
      totalPrints: filtered.length, 
      todayPrints: todaySessions.length
    }
  }, [sessions, filterEvent])

  const filteredSessions = useMemo(() => {
    let filtered = sessions || []
    if (filterEvent !== 'all') {
      filtered = filtered.filter(s => s.event_id === filterEvent)
    }
    return [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [sessions, filterEvent])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header Toolbar */}
      <div className="toolbar" style={{ paddingRight: 120 }}> {/* Padding right to clear window controls */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Data & Analytics</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Tinjau statistik pencetakan dan galeri foto event</span>
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

      <div className="app-body" style={{ padding: 24, animation: 'fadeIn 0.3s' }}>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Total Sesi', value: stats.totalSessions, icon: HiOutlinePhotograph, color: '#D552A3', bg: 'rgba(213, 82, 163, 0.1)' },
          { label: 'Sesi Hari Ini', value: stats.todaySessions, icon: HiOutlineCalendar, color: '#4caf50', bg: 'rgba(76, 175, 80, 0.1)' },
          { label: 'Estimasi Kertas', value: `${stats.totalPrints} Lembar`, icon: HiOutlinePrinter, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
          { label: 'Kertas Hari Ini', value: `${stats.todayPrints} Lembar`, icon: HiOutlineChartBar, color: '#f0a030', bg: 'rgba(240, 160, 48, 0.1)' }
        ].map((item, i) => {
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
              // Fallback logic for image path: file_path (new) -> final_image_path -> photos (old/array)
              let photoUrl = session.file_path || session.final_image_path
              if (!photoUrl && session.photos) {
                if (Array.isArray(session.photos)) {
                  // If it's a GIF burst, it's [ [f1,f2...], [f1,f2...] ]
                  const firstItem = session.photos[0]
                  photoUrl = Array.isArray(firstItem) ? firstItem[0] : firstItem
                } else {
                  photoUrl = session.photos
                }
              }
              
              // Robust path resolution for Electron/Web
              let imageUrl = null
              if (photoUrl && typeof photoUrl === 'string') {
                if (photoUrl.startsWith('data:') || photoUrl.startsWith('http') || photoUrl.startsWith('blob:')) {
                  imageUrl = photoUrl
                } else {
                  // Local path from Electron
                  imageUrl = `file://${photoUrl.replace(/\\/g, '/')}`
                }
              }

              return (
                <div key={session.id} className="card p-3 flex flex-col group relative overflow-hidden transition-all hover:border-[var(--color-accent)]">
                  <div className="aspect-[2/3] w-full bg-[var(--color-bg-base)] rounded-lg flex items-center justify-center mb-3 overflow-hidden border border-[var(--color-border-subtle)] relative">
                    {imageUrl ? (
                      <img src={imageUrl} className="w-full h-full object-cover" alt="Session" loading="lazy" />
                    ) : (
                      <div className="flex flex-col items-center opacity-30">
                        <HiOutlinePhotograph size={32} />
                        <div className="text-[10px] mt-1">No Image</div>
                      </div>
                    )}
                    
                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      {imageUrl && (
                        <button className="btn btn-launch btn-sm w-24" onClick={() => {
                          const a = document.createElement('a')
                          a.href = imageUrl
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
    </div>
  )
}
