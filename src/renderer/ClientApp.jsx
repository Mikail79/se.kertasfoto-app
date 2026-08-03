// src/renderer/ClientApp.jsx
//
// Visitor-facing screen. Intentionally self-contained: it does NOT use
// AppContext / AppProvider (those talk to `window.electronAPI`, which is not
// exposed in this window). It only talks to `window.boothAPI`, the minimal
// bridge exposed by src/main/preload-client.js.
//
// All session/template/phase logic lives in BoothMode.jsx (rendered in the
// Admin Window) — this component is purely a read-only mirror of that state,
// plus the single "Ambil Foto" (and optional "Retake") button.

import { useEffect, useRef, useState } from 'react'
import { PHASES } from './constants'
import logoImg from '../assets/logo.png'

const boothAPI = typeof window !== 'undefined' ? window.boothAPI : null

const BUSY_PHASES = new Set([
  PHASES.COUNTDOWN,
  PHASES.CAPTURING,
  PHASES.PROCESSING,
  PHASES.UPLOADING,
])

export default function ClientApp() {
  const [state, setState] = useState(null) // last broadcast session state
  const [liveFrame, setLiveFrame] = useState(null) // streamed webcam dataURL fallback
  const [liveViewUrl, setLiveViewUrl] = useState(null) // DSLR MJPEG url, if any
  const [connected, setConnected] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (!boothAPI) return

    const offState = boothAPI.onStateChange((s) => {
      setState(s)
      setConnected(true)
      setRequesting(false)
    })
    const offFrame = boothAPI.onLiveFrame((dataUrl) => setLiveFrame(dataUrl))

    let cancelled = false

    // Pull the current state right away — covers the case where BoothMode
    // already broadcast state before this window's listener above finished
    // registering (a real race: both the client window opening and the
    // admin's first broadcast happen at nearly the same moment).
    async function pullInitialState() {
      try {
        const s = await boothAPI.getState?.()
        if (!cancelled && s) {
          setState(s)
          setConnected(true)
        }
      } catch {
        /* main process not ready yet — the push/did-finish-load path will catch it */
      }
    }
    pullInitialState()

    async function loadLiveViewUrl() {
      try {
        const url = await boothAPI.getLiveViewUrl?.()
        if (!cancelled && url) setLiveViewUrl(url)
      } catch {
        /* no DSLR connected — fall back to streamed webcam frames */
      }
    }
    loadLiveViewUrl()
    const poll = setInterval(loadLiveViewUrl, 5000)

    return () => {
      cancelled = true
      clearInterval(poll)
      offState && offState()
      offFrame && offFrame()
    }
  }, [])

  // ── Loading / error screens ──────────────────────────────────────────────
  if (!boothAPI) {
    // window.boothAPI only exists inside the Electron client window (exposed
    // by preload-client.js). If this renders in a plain browser tab (e.g.
    // opening the Vite dev URL directly instead of through Electron), it
    // will never connect — say so explicitly instead of spinning forever.
    return <ClientLoadingScreen error="Tidak terhubung ke aplikasi Electron. Buka jendela ini lewat aplikasi, bukan browser biasa." />
  }

  if (!connected) {
    return <ClientLoadingScreen />
  }

  const phase = state?.phase
  const isIdle = !phase || phase === PHASES.CHOOSE_MODE || phase === PHASES.CHOOSE_TPL
  const isBusy = BUSY_PHASES.has(phase)
  const showRetake = phase === PHASES.RETAKE && !!state?.allowClientRetake

  const handleCapturePress = async () => {
    if (!boothAPI || requesting || isBusy || !isIdle) return
    setRequesting(true)
    try {
      await boothAPI.requestCapture('start')
    } finally {
      setTimeout(() => setRequesting(false), 4000)
    }
  }

  const handleRetakePress = async () => {
    if (!boothAPI || requesting) return
    setRequesting(true)
    try {
      await boothAPI.requestCapture('retake-last')
    } finally {
      setTimeout(() => setRequesting(false), 4000)
    }
  }

  const previewImage =
    phase === PHASES.RESULT ? (state?.resultImage || state?.compositeImage)
      : (phase === PHASES.PHOTO_PREVIEW || phase === PHASES.RETAKE) ? state?.previewComposite
        : null

  return (
    <div style={styles.root}>
      <div style={styles.liveViewWrap}>
        {liveViewUrl ? (
          <img src={liveViewUrl} alt="Live view" style={styles.liveMedia} />
        ) : liveFrame ? (
          <img src={liveFrame} alt="Live view" style={styles.liveMedia} />
        ) : (
          <div style={styles.liveFallback}>
            <span style={{ opacity: 0.35, fontSize: 14 }}>Menunggu live view kamera…</span>
          </div>
        )}

        {/* ── Idle / welcome overlay (before a session has started) ── */}
        {isIdle && !previewImage && (
          <div style={styles.idleOverlay}>
            <img src={logoImg} alt="" style={styles.idleLogo} />
            <h2 style={styles.idleTitle}>{state?.eventName || 'Selamat Datang!'}</h2>
            {state?.templateName && (
              <p style={styles.idleSubtitle}>Template: {state.templateName}</p>
            )}
            <p style={styles.idleHint}>Tekan tombol di bawah untuk mulai berfoto</p>
          </div>
        )}

        {/* ── Preview overlay (per-shot preview / retake screen / final result) ── */}
        {previewImage && (
          <div style={styles.previewOverlay}>
            <img src={previewImage} alt="Hasil foto" style={styles.previewImg} />
            {phase === PHASES.RESULT && (
              <p style={styles.previewCaption}>
                Terima kasih! {state?.resultTimer ? `Kembali dalam ${state.resultTimer}s` : ''}
              </p>
            )}
            {phase === PHASES.PHOTO_PREVIEW && (
              <p style={styles.previewCaption}>Foto {state?.currentSlot + 1} dari {state?.totalSlots}</p>
            )}
            {phase === PHASES.RETAKE && (
              <p style={styles.previewCaption}>Cek hasil fotomu</p>
            )}
          </div>
        )}

        {phase === PHASES.COUNTDOWN && (
          <div style={styles.countdownOverlay}>
            <div style={styles.countdownNumber}>{state?.countdown}</div>
          </div>
        )}

        {phase === PHASES.CAPTURING && (
          <div style={styles.flash} />
        )}

        {(phase === PHASES.PROCESSING || phase === PHASES.UPLOADING) && (
          <div style={styles.busyOverlay}>
            <div style={styles.spinner} />
            <span style={{ color: 'white', fontSize: 14 }}>
              {phase === PHASES.UPLOADING ? 'Mengupload foto…' : 'Memproses…'}
            </span>
          </div>
        )}
      </div>

      {!isIdle && (
        <div style={styles.eventBadge}>{state?.eventName || 'se.kertasfoto'}</div>
      )}

      <div style={styles.controls}>
        {showRetake && (
          <button
            onClick={handleRetakePress}
            disabled={requesting}
            style={{ ...styles.secondaryButton, opacity: requesting ? 0.5 : 1 }}
          >
            Ulangi
          </button>
        )}

        <button
          onClick={handleCapturePress}
          disabled={!isIdle || requesting}
          style={{
            ...styles.captureButton,
            opacity: !isIdle || requesting ? 0.45 : 1,
            cursor: !isIdle || requesting ? 'not-allowed' : 'pointer',
          }}
        >
          Ambil Foto
        </button>
      </div>
    </div>
  )
}

/**
 * Branded loading/splash screen for the Client Window, shown from the moment
 * the window opens until the admin side pushes its first session-state
 * broadcast. Mirrors the look of the Admin Window's <SplashWelcome />.
 */
function ClientLoadingScreen({ error } = {}) {
  const [pulse, setPulse] = useState(0)
  const [waitingLong, setWaitingLong] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setPulse((p) => (p + 1) % 3), 500)
    const longWaitTimer = setTimeout(() => setWaitingLong(true), 6000)
    return () => {
      clearInterval(t)
      clearTimeout(longWaitTimer)
    }
  }, [])

  return (
    <div style={styles.loadingRoot}>
      <div style={styles.loadingLogoWrap}>
        <img src={logoImg} alt="se.kertasfoto" style={styles.loadingLogo} />
        <div style={styles.loadingGlow} />
      </div>
      <h1 style={styles.loadingTitle}>se.kertasfoto</h1>
      <p style={{ ...styles.loadingSubtitle, color: error ? '#FF9494' : styles.loadingSubtitle.color }}>
        {error
          ? error
          : waitingLong
            ? 'Menunggu admin memulai event…'
            : `Menghubungkan ke admin${'.'.repeat(pulse + 1)}`}
      </p>
    </div>
  )
}

const styles = {
  root: {
    position: 'fixed',
    inset: 0,
    background: '#0a0a0f',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    userSelect: 'none',
  },
  loadingRoot: {
    position: 'fixed',
    inset: 0,
    background: '#1a1425',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingLogoWrap: {
    position: 'relative',
    marginBottom: 24,
  },
  loadingLogo: {
    width: 110,
    height: 110,
    objectFit: 'contain',
    position: 'relative',
    zIndex: 1,
  },
  loadingGlow: {
    position: 'absolute',
    inset: -6,
    background: 'linear-gradient(135deg, #462C7D, #D552A3, #FF70BF)',
    filter: 'blur(18px)',
    opacity: 0.6,
    zIndex: 0,
    borderRadius: 28,
  },
  loadingTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: 'white',
    letterSpacing: 0.5,
    margin: 0,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  liveViewWrap: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
  },
  liveMedia: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  liveFallback: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  idleOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'linear-gradient(180deg, rgba(10,10,15,0.55), rgba(10,10,15,0.75))',
    textAlign: 'center',
    padding: 24,
  },
  idleLogo: {
    width: 72,
    height: 72,
    objectFit: 'contain',
    marginBottom: 12,
    filter: 'drop-shadow(0 8px 24px rgba(213,82,163,0.4))',
  },
  idleTitle: {
    fontSize: 30,
    fontWeight: 800,
    color: 'white',
    margin: 0,
  },
  idleSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
  },
  idleHint: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 18,
  },
  previewOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  previewImg: {
    maxWidth: '90vw',
    maxHeight: '78vh',
    borderRadius: 12,
    boxShadow: '0 16px 56px rgba(0,0,0,0.7)',
  },
  previewCaption: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    margin: 0,
  },
  countdownOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.35)',
  },
  countdownNumber: {
    fontSize: 220,
    fontWeight: 900,
    color: 'white',
    textShadow: '0 20px 60px rgba(0,0,0,0.7)',
  },
  flash: {
    position: 'absolute',
    inset: 0,
    background: 'white',
  },
  busyOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(10,10,15,0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  spinner: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '4px solid rgba(255,255,255,0.15)',
    borderTopColor: '#D552A3',
  },
  eventBadge: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    background: 'rgba(0,0,0,0.4)',
    padding: '6px 18px',
    borderRadius: 20,
  },
  controls: {
    position: 'absolute',
    bottom: 36,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 20,
    alignItems: 'center',
  },
  captureButton: {
    padding: '20px 56px',
    fontSize: 20,
    fontWeight: 700,
    borderRadius: 999,
    border: 'none',
    color: 'white',
    background: 'linear-gradient(135deg, #462C7D, #D552A3)',
    boxShadow: '0 12px 40px rgba(213,82,163,0.4)',
  },
  secondaryButton: {
    padding: '14px 32px',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'white',
    background: 'rgba(255,255,255,0.08)',
  },
}
