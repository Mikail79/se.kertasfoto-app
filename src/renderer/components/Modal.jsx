import { useEffect, useRef } from 'react'
import { HiOutlineX } from 'react-icons/hi'

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth, style }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="modal-content animate-slide-up"
        style={{ ...(maxWidth ? { maxWidth } : {}), ...style }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            title="Tutup (Esc)"
            aria-label="Close"
          >
            <HiOutlineX size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

