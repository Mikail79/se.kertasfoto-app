export default function TopBar({ title, subtitle }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <h2 className="topbar-title">{title}</h2>
        {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
      </div>
      <div className="topbar-actions">
        {/* Future: search bar, notifications, user avatar */}
      </div>
    </div>
  )
}
