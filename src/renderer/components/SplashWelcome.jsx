import { useState, useEffect } from 'react'
import logoImg from '../../assets/logo.png'

export default function SplashWelcome() {
  const [visible, setVisible] = useState(true)
  const [animatingOut, setAnimatingOut] = useState(false)

  useEffect(() => {
    // Keep splash screen for 2.5 seconds, then animate out
    const timer1 = setTimeout(() => {
      setAnimatingOut(true)
    }, 2500)

    // Remove from DOM after animation completes
    const timer2 = setTimeout(() => {
      setVisible(false)
    }, 3200)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [])

  if (!visible) return null

  return (
    <div 
      className={`splash-screen ${animatingOut ? 'fade-out' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#1a1425',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <div className="splash-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="splash-logo" style={{
          position: 'relative',
          marginBottom: 24
        }}>
          <img src={logoImg} alt="SK Logo" style={{ width: 100, height: 100, objectFit: 'contain' }} />
          <div className="splash-glow" style={{
            position: 'absolute',
            inset: -4,
            background: 'linear-gradient(135deg, #462C7D, #D552A3, #FF70BF)',
            filter: 'blur(15px)',
            opacity: 0.7,
            zIndex: -1,
            borderRadius: 24
          }}></div>
        </div>
        
        <h1 className="splash-title" style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'white',
          margin: 0,
          letterSpacing: 1
        }}>
          se.kertasfoto
        </h1>
        <p className="splash-subtitle" style={{
          fontSize: 14,
          color: '#D552A3',
          fontWeight: 600,
          letterSpacing: 4,
          textTransform: 'uppercase',
          marginTop: 8
        }}>
          Photobooth
        </p>

        <div className="splash-loader" style={{ marginTop: 40 }}>
          <div className="splash-progress"></div>
        </div>
      </div>
    </div>
  )
}
