import { NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { HiOutlineViewGrid, HiOutlineTemplate, HiOutlineCamera, HiOutlinePlay, HiOutlineCog } from 'react-icons/hi'
import logoImg from '../../assets/logo.png'

export default function Sidebar() {
  const { enterBoothMode, activeEvent } = useApp()

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <img src={logoImg} alt="SK Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        <div className="sidebar-brand">
          se.kertasfoto
          <small>Photobooth</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">Menu</div>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="icon"><HiOutlineViewGrid /></span> Events
        </NavLink>

        {/* Template Editor link moved to BoothMode */}

        <NavLink to="/camera" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="icon"><HiOutlineCamera /></span> Camera
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="icon"><HiOutlineCog /></span> Settings
        </NavLink>

        {/* Launch Booth only when event is active */}
        {activeEvent && (
          <>
            <div className="sidebar-section" style={{ marginTop: 12 }}>Session</div>
            <button className="nav-link" onClick={enterBoothMode}>
              <span className="icon"><HiOutlinePlay /></span> Launch Booth
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {activeEvent ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="active-dot" />
            <span className="truncate" style={{ fontWeight: 600, fontSize: 12 }}>{activeEvent.name}</span>
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>Select an event to start</span>
        )}
      </div>
    </aside>
  )
}
