import { useEffect, useRef } from 'react'

export default function Modal({ isOpen, onClose, title, children, footer }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose() }}>
      <div className="modal-content animate-slide-up">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ fontSize: '18px' }}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
