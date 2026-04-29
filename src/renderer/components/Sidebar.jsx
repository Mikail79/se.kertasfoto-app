import { NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { HiOutlineViewGrid, HiOutlineTemplate, HiOutlineCamera, HiOutlinePlay, HiOutlineCog } from 'react-icons/hi'

export default function Sidebar() {
  const { enterBoothMode, activeEvent } = useApp()

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">SK</div>
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
        <NavLink to="/templates" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="icon"><HiOutlineTemplate /></span> Template Editor
        </NavLink>
        <NavLink to="/camera" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="icon"><HiOutlineCamera /></span> Camera Settings
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="icon"><HiOutlineCog /></span> Settings
        </NavLink>

        <div className="sidebar-section" style={{ marginTop: 12 }}>Session</div>
        <button className="nav-link" onClick={enterBoothMode}>
          <span className="icon"><HiOutlinePlay /></span> Launch Booth
        </button>
      </nav>

      <div className="sidebar-footer">
        {activeEvent ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="active-dot" />
            <span className="truncate" style={{ fontWeight: 600, fontSize: 12 }}>{activeEvent.name}</span>
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>No active event</span>
        )}
      </div>
    </aside>
  )
}
