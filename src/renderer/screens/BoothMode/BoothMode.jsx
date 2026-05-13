// src/renderer/screens/BoothMode/BoothMode.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../context/AppContext';
import {
  HiOutlineCamera, HiOutlineFilm, HiOutlineRefresh,
  HiOutlineChevronLeft, HiOutlineChevronRight,
  HiOutlineArrowLeft, HiOutlineLockClosed, HiOutlineCog,
  HiOutlinePrinter, HiOutlineCloud, HiOutlineCheckCircle,
  HiOutlineExclamationCircle, HiOutlineDownload, HiOutlineCheck,
} from 'react-icons/hi';

import { useCapture } from '../../hooks/useCapture';
import { useComposer } from '../../hooks/useComposer';
import { useSession } from '../../hooks/useSession';
import {
  getImageUrl,
  buildFilename,
  loadImage,
  drawQRPlaceholder,
  buildPrintDocument,
} from '../../utils';
import { PHASES, PAPER_SIZES } from '../../constants';

// ----------------------------------------------------------------------
// Audio helper (synthetic beep, shutter, success)
// ----------------------------------------------------------------------
let audioCtx = null;
const playSound = (type) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'shutter') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, audioCtx.currentTime);
      osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    }
  } catch (e) {}
};

// ----------------------------------------------------------------------
// Sub‑components: UploadingScreen, DriveQROverlay, RetakeScreen
// ----------------------------------------------------------------------
function UploadingScreen({ step, progress, eventName }) {
  const steps = [
    { key: 'creating_gif', label: 'Membuat animasi GIF...' },
    { key: 'compose', label: 'Memproses & render foto...' },
    { key: 'save', label: 'Menyimpan lokal...' },
    { key: 'upload', label: 'Mengupload ke Google Drive...' },
    { key: 'qr', label: 'Menyiapkan QR Code...' },
  ];
  const currentIdx = steps.findIndex(s => s.key === step);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(14,10,20,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
      <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg, #462C7D, #D552A3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'white', boxShadow: '0 0 40px rgba(213,82,163,0.4)', animation: 'pulse 1.5s ease-in-out infinite' }}>SK</div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>{step === 'upload' ? 'Mengupload foto...' : step === 'qr' ? 'Hampir selesai...' : 'Memproses...'}</h2>
        {eventName && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{eventName}</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: done ? '#4ade80' : active ? '#D552A3' : 'rgba(255,255,255,0.1)', border: `2px solid ${done ? '#4ade80' : active ? '#D552A3' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {done ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg> : active ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />}
              </div>
              <span style={{ fontSize: 13, color: done ? '#4ade80' : active ? 'white' : 'rgba(255,255,255,0.3)', fontWeight: active ? 600 : 400 }}>{s.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ width: 280, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
        <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #462C7D, #D552A3)', width: `${progress}%`, transition: 'width 0.5s ease' }} />
      </div>
      <style>{`@keyframes pulse { 0%,100% { box-shadow: 0 0 40px rgba(213,82,163,0.4); } 50% { box-shadow: 0 0 60px rgba(213,82,163,0.7), 0 0 20px rgba(70,44,125,0.5); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DriveQROverlay({ driveResult, onClose }) {
  const { viewLink, downloadLink, shareLink } = driveResult || {};
  const qrUrl = downloadLink || viewLink || shareLink || 'https://drive.google.com';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(14,10,20,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, animation: 'fadeIn 0.4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '2px solid #4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HiOutlineCheckCircle style={{ color: '#4ade80', fontSize: 18 }} /></div>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#4ade80' }}>Foto tersimpan di Google Drive!</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 32, display: 'inline-block', boxShadow: '0 0 60px rgba(213,82,163,0.3)' }}><QRCodeSVG value={qrUrl} size={200} bgColor="white" fgColor="#1a1425" level="M" /></div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>Scan untuk mengunduh foto kamu</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, maxWidth: 300, wordBreak: 'break-all' }}>{qrUrl}</p>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {downloadLink && <a href={downloadLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 20, background: 'linear-gradient(135deg, #462C7D, #D552A3)', color: 'white', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}><HiOutlineDownload /> Download Foto</a>}
        <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontSize: 13, cursor: 'pointer' }}>Selesai</button>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}

function RetakeScreen({ capturedPhotos, totalSlots, previewComposite, captureMode, onRetakeSlot, onRetakeAll, onSubmit }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(14,10,20,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, animation: 'phaseEnter 0.35s cubic-bezier(0.175,0.885,0.32,1.275) forwards', padding: '24px 20px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>Review Foto</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '-16px 0 0' }}>Periksa setiap foto sebelum diproses</p>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
          {Array.from({ length: totalSlots }).map((_, i) => {
            const photo = capturedPhotos[i];
            const src = Array.isArray(photo) ? photo[0] : photo;
            const filled = !!src;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 120, height: 90, borderRadius: 10, overflow: 'hidden', border: `2px solid ${filled ? 'rgba(213,82,163,0.6)' : 'rgba(255,255,255,0.15)'}`, background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                  {src ? <img src={src} alt={`Foto ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Kosong</div>}
                  {captureMode === 'gif' && Array.isArray(photo) && photo.length > 1 && <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(70,44,125,0.9)', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>GIF</div>}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Foto {i+1}</span>
                <button onClick={() => onRetakeSlot(i)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(213,82,163,0.15)', border: '1px solid rgba(213,82,163,0.4)', color: 'rgba(255,255,255,0.8)', padding: '5px 12px', borderRadius: 14, fontSize: 11, cursor: 'pointer' }}><HiOutlineRefresh style={{ fontSize: 11 }} /> Ulang</button>
              </div>
            );
          })}
        </div>
        {previewComposite && <div style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', flexShrink: 0 }}><img src={previewComposite} alt="Preview" style={{ maxHeight: 280, maxWidth: 200, objectFit: 'contain' }} /></div>}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={onSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 36px', borderRadius: 30, background: 'linear-gradient(135deg, #462C7D, #D552A3)', border: 'none', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 24px rgba(213,82,163,0.4)' }}><HiOutlineCheck style={{ fontSize: 16 }} /> Proses & Simpan</button>
      </div>
      <style>{`@keyframes phaseEnter { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  );
}

// ----------------------------------------------------------------------
// DSLRCapturingOverlay
// Shown while the main process is running the capture flow.
// Replaces the live view feed during the ~1-2 second gap between
// "live view off" and the physical shutter firing.
// ----------------------------------------------------------------------
function DSLRCapturingOverlay({ isProcessing, captureError }) {
  if (!isProcessing && !captureError) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1000,
      background: captureError ? 'rgba(127,29,29,0.98)' : 'rgba(14,10,20,0.98)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 24, animation: 'fadeIn 0.2s ease',
      backdropFilter: 'blur(10px)',
    }}>
      {captureError ? (
        <>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #f87171' }}>
            <HiOutlineExclamationCircle style={{ fontSize: 40, color: '#f87171' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 8 }}>Gagal Mengambil Foto</h3>
            <p style={{ fontSize: 14, color: '#f87171', maxWidth: 320, lineHeight: 1.5 }}>{captureError}</p>
          </div>
        </>
      ) : (
        <>
          {/* Professional shutter animation */}
          <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px dashed rgba(213,82,163,0.3)', animation: 'spin 4s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.05)', borderTopColor: '#D552A3', animation: 'spin 1s cubic-bezier(0.4,0,0.2,1) infinite' }} />
            <HiOutlineCamera style={{ fontSize: 40, color: 'white', opacity: 0.8 }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 8, letterSpacing: 1 }}>SMILE! 📸</h2>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#D552A3', marginBottom: 4 }}>Memproses foto DSLR...</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Harap tetap tenang di posisi kamu</p>
          </div>
        </>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main BoothMode component
// ----------------------------------------------------------------------
export default function BoothMode() {
  const {
    exitBoothMode, activeEvent, templates,
    addSession, sessions, gdriveStatus,
    uploadPhotoToDrive, cameraCountdown, previewDuration,
    cameraDeviceId, updatePhotoToDrive, cameraSettings,
  } = useApp();

  // --------------------------------------------------------------
  // 1. State & Refs
  // --------------------------------------------------------------
  const [phase, setPhase] = useState(PHASES.CHOOSE_MODE);
  const [countdown, setCountdown] = useState(3);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [totalSlots, setTotalSlots] = useState(1);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [compositeImage, setCompositeImage] = useState(null);
  const [resultTimer, setResultTimer] = useState(30);
  const [showMenu, setShowMenu] = useState(false);
  const [captureMode, setCaptureMode] = useState('photo');
  const [chosenTemplate, setChosenTemplate] = useState(null);
  const [tplScrollIdx, setTplScrollIdx] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [lastCapturedPhoto, setLastCapturedPhoto] = useState(null);
  const [previewComposite, setPreviewComposite] = useState(null);
  const [retakeSlotIndex, setRetakeSlotIndex] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [savedFilePath, setSavedFilePath] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const [uploadStep, setUploadStep] = useState('compose');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [driveResult, setDriveResult] = useState(null);
  const [showDriveQR, setShowDriveQR] = useState(false);
  const [driveError, setDriveError] = useState(null);

  // ── DSLR auto-switching state ──────────────────────────────────────────────
  /**
   * isDSLRCapturing: true while the main process is running the full capture
   * pipeline (live view off → shutter → file poll → DB write).
   * During this time we hide the webcam preview and show DSLRCapturingOverlay.
   */
  const [isDSLRCapturing, setIsDSLRCapturing] = useState(false);
  /**
   * dslrCaptureError: non-null when the DSLR capture IPC call fails.
   * Displayed in the overlay so the operator can react (reconnect camera etc.)
   */
  const [dslrCaptureError, setDslrCaptureError] = useState(null);
  /**
   * useDSLR: if true, captures go through the Electron IPC / digiCamControl path.
   * This is true if captureCardMode is on, or if the user selected 'virtual-usb'.
   */
  const useDSLR = !!cameraSettings?.useDSLR || !!cameraSettings?.captureCardMode || cameraDeviceId === 'virtual-usb';

  /**
   * captureCardMode: live preview via HDMI capture card, jepretan via DCC.
   * Bila aktif, booth webcam stream menggunakan liveViewDeviceId (capture card)
   * bukan cameraDeviceId. useDSLR tetap true untuk path capture.
   */
  const captureCardMode = !!cameraSettings?.captureCardMode;
  const liveViewDeviceId = localStorage.getItem('skf_live_view_device_id') || cameraDeviceId;
  // Effective device ID for live preview in booth
  const boothPreviewDeviceId = captureCardMode ? liveViewDeviceId : cameraDeviceId;

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // --------------------------------------------------------------
  // 2. Derived values
  // --------------------------------------------------------------
  const availableTemplates = activeEvent
    ? templates.filter(t => t.event_id === activeEvent.id)
    : templates;
  const activeTemplate = chosenTemplate
    || (activeEvent?.active_template_id
      ? templates.find(t => t.id === activeEvent.active_template_id)
      : availableTemplates[0]);
  const hasDrive = gdriveStatus.isAuthenticated && !!activeEvent?.drive_folder_id;

  useEffect(() => {
    if (activeTemplate?.photo_slots?.length) {
      const photoSlots = activeTemplate.photo_slots.filter(s => s.type !== 'text');
      if (photoSlots.length === 0) { setTotalSlots(1); return; }
      const maxIdx = Math.max(...photoSlots.map(s => s.photo_index ?? (s.slot - 1)));
      setTotalSlots(Math.max(1, maxIdx + 1));
    } else {
      setTotalSlots(1);
    }
  }, [activeTemplate, captureMode]);

  useEffect(() => {
    if (availableTemplates.length === 1 && !chosenTemplate && phase === PHASES.CHOOSE_TPL) {
      setChosenTemplate(availableTemplates[0]);
    }
  }, [availableTemplates, chosenTemplate, phase]);

  // --------------------------------------------------------------
  // 3. Helper functions
  // --------------------------------------------------------------
  const savePhotoToDiskFn = useCallback(async (dataUrl, folderPath) => {
    if (!dataUrl || !folderPath) return null;
    const filename = buildFilename(activeEvent) + '.jpg';
    if (!window.electronAPI?.saveFile) return null;
    try {
      const result = await window.electronAPI.saveFile({ folder: folderPath, filename, dataUrl });
      return result?.path || null;
    } catch { return null; }
  }, [activeEvent]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !videoRef.current.videoWidth) return null;
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    const camMirror = cameraSettings?.mirror ?? true;
    if (camMirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    const qualityMap = { low: 0.6, medium: 0.8, high: 0.92, max: 1.0 };
    const quality = qualityMap[cameraSettings?.imageQuality] || 0.92;
    return c.toDataURL('image/jpeg', quality);
  }, [cameraSettings?.mirror, cameraSettings?.imageQuality]);

  // --------------------------------------------------------------
  // 4. DSLR capture handler
  // Called by the countdown effect (step 8) when useDSLR is true.
  // Returns a file:// or absolute-path URL the rest of the pipeline
  // can treat the same as a webcam dataURL.
  // --------------------------------------------------------------
  const doDSLRCapture = useCallback(async () => {
    if (!window.electronAPI?.takePhoto) {
      setDslrCaptureError('electronAPI.takePhoto tidak tersedia. Cek preload script.');
      return null;
    }

    setIsDSLRCapturing(true);
    setDslrCaptureError(null);
    playSound('shutter');

    try {
      const slotIdx = retakeSlotIndex !== null ? retakeSlotIndex : currentSlot;
      const result = await window.electronAPI.takePhoto({
        outputFolder: activeEvent?.folder_path || null,
        filenameBase: buildFilename(activeEvent) + `_slot${slotIdx}`,
        sessionId: currentSessionId,
        eventId: activeEvent?.id || null,
        slotIndex: slotIdx,
      });

      if (!result.success) {
        setDslrCaptureError(result.error || 'Capture gagal. Coba lagi.');
        return null;
      }

      // Persist the session ID returned by the main process
      if (result.sessionId && !currentSessionId) {
        setCurrentSessionId(result.sessionId);
      }

      // Convert the absolute Windows path to a valid file:// URL
      let fileUrl = null;
      if (result.path) {
        const normalizedPath = result.path.replace(/\\/g, '/');
        const encodedPath = normalizedPath.split('/').map(part => encodeURIComponent(part)).join('/');
        fileUrl = `file:///${encodedPath}`;
        console.log('[BoothMode] DSLR Capture Success:', fileUrl);
      } else {
        console.error('[BoothMode] DSLR Capture returned success but no path');
        setDslrCaptureError('File jepretan tidak terdeteksi.');
        return null;
      }

      await new Promise(r => setTimeout(r, 600));
      return fileUrl;
    } catch (err) {
      setDslrCaptureError('IPC error: ' + err.message);
      return null;
    } finally {
      setIsDSLRCapturing(false);
    }
  }, [activeEvent, currentSlot, currentSessionId, retakeSlotIndex]);

  // --------------------------------------------------------------
  // 5. Composer hook
  // --------------------------------------------------------------
  const { composePartialPreview, composeResult } = useComposer({ activeTemplate });

  // --------------------------------------------------------------
  // 6. Capture hook (webcam path — used when useDSLR is false)
  // --------------------------------------------------------------
  const { doCapture } = useCapture({
    captureMode,
    captureFrame,
    activeEvent,
    currentSlot,
    totalSlots,
    retakeSlotIndex,
    cameraCountdown,
    previewDuration,
    capturedPhotos,
    composePartialPreview,
    setCurrentSlot,
    playSound,
    setPhase,
    setCapturedPhotos,
    setLastCapturedPhoto,
    setRetakeSlotIndex,
    setCountdown,
    setPreviewComposite,
  });

  // --------------------------------------------------------------
  // 7. Session hook
  // --------------------------------------------------------------
  const { finishSession } = useSession({
    captureMode,
    activeEvent,
    activeTemplate,
    hasDrive,
    composeResult,
    savePhotoToDisk: savePhotoToDiskFn,
    updatePhotoToDrive,
    uploadPhotoToDrive,
    addSession,
    playSound,
    setPhase,
    setCompositeImage,
    setDriveResult,
    setDriveError,
    setSavedFilePath,
    setSaveStatus,
    setCurrentSessionId,
    setUploadStep,
    setUploadProgress,
    setShowDriveQR,
    setResultTimer,
  });

  // --------------------------------------------------------------
  // 8. Camera initialization (webcam)
  // --------------------------------------------------------------
  const camRes = cameraSettings?.resolution ?? 80;
  useEffect(() => {
    // In capture card mode, always start the webcam stream (using the capture card device)
    // so booth gets live preview even when useDSLR is true.
    // In pure DSLR mode (useDSLR && !captureCardMode), skip webcam init.
    if (useDSLR && !captureCardMode) return;

    let active = true;
    async function startCam() {
      try {
        const w = camRes >= 80 ? 1280 : camRes >= 50 ? 1280 : 640;
        const h = camRes >= 80 ? 720 : camRes >= 50 ? 720 : 480;
        const constraints = {
          video: boothPreviewDeviceId
            ? { deviceId: { exact: boothPreviewDeviceId }, width: { ideal: w }, height: { ideal: h } }
            : { width: { ideal: w }, height: { ideal: h }, facingMode: 'user' },
          audio: false,
        };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (active) {
          streamRef.current = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        }
      } catch (e) { console.warn('Cam error', e); }
    }
    startCam();
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [boothPreviewDeviceId, camRes, useDSLR, captureCardMode]);

  // --------------------------------------------------------------
  // 9. Countdown effect
  // Delegates to DSLR or webcam path based on useDSLR flag.
  // --------------------------------------------------------------
  useEffect(() => {
    if (phase !== PHASES.COUNTDOWN) return;
    if (countdown <= 0) {
      if (useDSLR) {
        // ── DSLR path ───────────────────────────────────────────────────────
        // Run the IPC capture, then inject the resulting file URL into the
        // same slot-management logic useCapture would normally handle.
        (async () => {
          setPhase(PHASES.CAPTURING); // trigger flash overlay immediately

          const fileUrl = await doDSLRCapture();

          if (!fileUrl) {
            // Error is already stored in dslrCaptureError; go back to countdown
            // so the operator can retry after fixing the issue.
            setCountdown(cameraCountdown);
            setPhase(PHASES.COUNTDOWN);
            return;
          }

          playSound('success');

          // Slot accounting — mirrors what useCapture does for webcam
          const slotIdx = retakeSlotIndex !== null ? retakeSlotIndex : currentSlot;
          setCapturedPhotos(prev => {
            const next = [...prev];
            next[slotIdx] = fileUrl;
            return next;
          });
          setLastCapturedPhoto(fileUrl);

          // Build partial preview for the retake screen
          const partial = await composePartialPreview(
            (() => { const a = [...capturedPhotos]; a[slotIdx] = fileUrl; return a; })()
          ).catch(() => null);
          if (partial) setPreviewComposite(partial);

          const nextSlot = slotIdx + 1;
          if (retakeSlotIndex !== null) {
            // Retake of a single slot — go straight to retake review
            setRetakeSlotIndex(null);
            setPhase(PHASES.RETAKE);
          } else if (nextSlot >= totalSlots) {
            // All slots filled — go to retake/review screen
            setPhase(PHASES.RETAKE);
          } else {
            // More slots to capture
            setCurrentSlot(nextSlot);
            setCountdown(cameraCountdown);
            setPhase(PHASES.COUNTDOWN);
          }
        })();
      } else {
        // ── Webcam path (unchanged) ─────────────────────────────────────────
        doCapture();
      }
      return;
    }
    playSound('beep');
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, useDSLR, doCapture, doDSLRCapture, cameraCountdown,
      currentSlot, retakeSlotIndex, totalSlots, capturedPhotos, composePartialPreview]);

  // --------------------------------------------------------------
  // 10. Session starter & other handlers
  // --------------------------------------------------------------
  const startSession = useCallback(() => {
    setPhase(PHASES.COUNTDOWN);
    setCurrentSlot(0);
    setCapturedPhotos([]);
    setCompositeImage(null);
    setCountdown(cameraCountdown);
    setCurrentSessionId(null);
    setRetakeSlotIndex(null);
    setLastCapturedPhoto(null);
    setSaveStatus(null);
    setSavedFilePath(null);
    setDriveResult(null);
    setDriveError(null);
    setShowDriveQR(false);
    setPreviewComposite(null);
    // Clear any stale DSLR error from a previous session
    setDslrCaptureError(null);
  }, [cameraCountdown]);

  const handleRetakeSinglePhoto = useCallback((slotIdx) => {
    setRetakeSlotIndex(slotIdx);
    setCurrentSlot(slotIdx);
    setCountdown(cameraCountdown);
    setDslrCaptureError(null);
    setPhase(PHASES.COUNTDOWN);
  }, [cameraCountdown]);

  const handleRetakeAll = useCallback(() => {
    setCapturedPhotos([]);
    setCompositeImage(null);
    setCurrentSlot(0);
    setCountdown(cameraCountdown);
    setRetakeSlotIndex(null);
    setLastCapturedPhoto(null);
    setSaveStatus(null);
    setSavedFilePath(null);
    setDriveResult(null);
    setDriveError(null);
    setShowDriveQR(false);
    setPreviewComposite(null);
    setDslrCaptureError(null);
    setPhase(PHASES.COUNTDOWN);
  }, [cameraCountdown]);

  const handlePrint = useCallback(() => {
    const imgSrc = compositeImage || (Array.isArray(capturedPhotos[capturedPhotos.length - 1])
      ? capturedPhotos[capturedPhotos.length - 1][0]
      : capturedPhotos[capturedPhotos.length - 1]);
    if (!imgSrc) return;
    const paperSize = activeTemplate?.paper_size || '4x6';
    const printDoc = buildPrintDocument(imgSrc, paperSize);
    const w = window.open('', '_blank', 'width=800,height=600');
    if (w) { w.document.write(printDoc); w.document.close(); }
  }, [compositeImage, capturedPhotos, activeTemplate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showMenu) { setShowMenu(false); return; }
        if (showDriveQR) { setShowDriveQR(false); setPhase(PHASES.RESULT); setResultTimer(15); return; }
        // Don't allow Escape to exit while DSLR is actively capturing
        if (isDSLRCapturing) return;
        exitBoothMode();
      }
      if ((e.key === ' ' || e.key === 'Enter') && phase === PHASES.PHOTO_PREVIEW) {
        if (window.__boothPreviewNext) window.__boothPreviewNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [exitBoothMode, showMenu, showDriveQR, phase, isDSLRCapturing]);

  useEffect(() => () => {
    if (window.__boothPreviewTimer) clearTimeout(window.__boothPreviewTimer);
  }, []);

  // --------------------------------------------------------------
  // 11. UI helpers
  // --------------------------------------------------------------
  const modes = [
    { id: 'photo', label: 'Print', icon: <HiOutlineCamera /> },
    { id: 'gif', label: 'GIF', icon: <HiOutlineFilm /> },
  ];
  const visibleTemplates = availableTemplates.slice(tplScrollIdx, tplScrollIdx + 3);

  // When DSLR is capturing, hide the live feed (it's off on the camera side too).
  // Also hide it during the normal phases that don't need it.
  // In captureCardMode, webcam (capture card) is always shown for live preview.
  const showLiveFeed = !isDSLRCapturing &&
    (captureCardMode || !useDSLR) &&
    [PHASES.CHOOSE_MODE, PHASES.COUNTDOWN, PHASES.CHOOSE_TPL].includes(phase);

  // For pure DSLR mode (no capture card), show the digiCamControl MJPEG stream instead
  const dslrLiveViewUrl = (useDSLR && !captureCardMode) ? (window.electronAPI?.getLiveViewUrl?.() || null) : null;
  const showDSLRLiveFeed = (useDSLR && !captureCardMode) && !isDSLRCapturing &&
    [PHASES.CHOOSE_MODE, PHASES.COUNTDOWN, PHASES.CHOOSE_TPL].includes(phase);

  // --------------------------------------------------------------
  // 12. Render JSX
  // --------------------------------------------------------------
  return (
    <div className="booth-screen" style={{ animation: 'launchFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
      <style>{`
        @keyframes launchFadeIn { from { opacity: 0; transform: scale(1.02); } to { opacity: 1; transform: scale(1); } }
        @keyframes phaseEnter { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes countdownPop { 0% { transform: scale(0.5); opacity: 0; } 40% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes flashAnimation { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes ppSlideIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes ppProgress { from { width: 0%; } to { width: 100%; } }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Webcam feed (used when useDSLR is false) */}
      <video ref={videoRef} autoPlay muted playsInline style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        opacity: showLiveFeed ? 1 : 0, transition: 'opacity 0.4s',
        transform: `${cameraSettings?.mirror ? 'scaleX(-1)' : ''} rotate(${cameraSettings?.rotation || 0}deg)`,
        zIndex: 1,
      }} />

      {/* DSLR live view feed (MJPEG stream from digiCamControl) */}
      {useDSLR && dslrLiveViewUrl && (
        <img
          src={dslrLiveViewUrl}
          alt="DSLR live view"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            opacity: showDSLRLiveFeed ? 1 : 0, transition: 'opacity 0.3s',
            transform: `rotate(${cameraSettings?.rotation || 0}deg)`,
            zIndex: 1,
          }}
        />
      )}

      {/* Dimming overlay over live feed */}
      {(showLiveFeed || showDSLRLiveFeed) && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)', zIndex: 2 }} />
      )}

      {/* DSLR capturing overlay — replaces the flash div during DSLR capture */}
      <DSLRCapturingOverlay
        isProcessing={isDSLRCapturing}
        captureError={dslrCaptureError}
      />

      {/* Back button */}
      {phase !== PHASES.CAPTURING && phase !== PHASES.UPLOADING && !isDSLRCapturing && (
        <button onClick={exitBoothMode} style={{ position: 'absolute', top: 12, left: 12, zIndex: 220, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(4px)' }}><HiOutlineArrowLeft /> Back</button>
      )}

      {/* DSLR mode indicator badge */}
      {useDSLR && phase === PHASES.CHOOSE_MODE && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 210, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: 'rgba(70,44,125,0.7)', borderRadius: 12, border: '1px solid rgba(213,82,163,0.5)', fontSize: 11, color: '#D552A3', backdropFilter: 'blur(4px)' }}>
          <HiOutlineCamera style={{ fontSize: 12 }} /> DSLR Mode
        </div>
      )}

      {/* Drive active badge */}
      {phase === PHASES.CHOOSE_MODE && hasDrive && (
        <div style={{ position: 'absolute', top: 12, right: 60, zIndex: 210, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(74,222,128,0.15)', borderRadius: 12, border: '1px solid rgba(74,222,128,0.3)', fontSize: 11, color: '#4ade80' }}><HiOutlineCloud style={{ fontSize: 12 }} /> Drive aktif</div>
      )}

      {/* Capture Card Mode indicator */}
      {captureCardMode && (showLiveFeed || showDSLRLiveFeed) && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 210, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(213,82,163,0.15)', borderRadius: 10, border: '1px solid rgba(213,82,163,0.3)', color: '#D552A3', fontSize: 10, fontWeight: 700, backdropFilter: 'blur(8px)', animation: 'pulse 2s infinite' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D552A3', boxShadow: '0 0 10px #D552A3' }} />
          HDMI PREVIEW
        </div>
      )}

      {/* No template warning */}
      {availableTemplates.length === 0 && phase !== PHASES.UPLOADING && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 300, background: 'linear-gradient(90deg, #7c2d12, #b91c1c)', borderBottom: '1px solid rgba(255,100,100,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 20px' }}>
          <HiOutlineExclamationCircle style={{ fontSize: 18, color: '#fca5a5' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Belum ada template untuk event ini.</span>
          <button onClick={() => { exitBoothMode(); window.dispatchEvent(new CustomEvent('navigate-to', { detail: '/templates' })); }} style={{ marginLeft: 8, padding: '4px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Buat Template →</button>
        </div>
      )}

      {/* Upload overlay */}
      {phase === PHASES.UPLOADING && <UploadingScreen step={uploadStep} progress={uploadProgress} eventName={activeEvent?.name} />}

      {/* Drive QR overlay */}
      {showDriveQR && driveResult && <DriveQROverlay driveResult={driveResult} onClose={() => { setShowDriveQR(false); setPhase(PHASES.RESULT); setResultTimer(15); }} />}

      {/* Phase: CHOOSE_MODE */}
      {phase === PHASES.CHOOSE_MODE && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5, animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
          <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
            {modes.map(m => (
              <button key={m.id} className="booth-mode-btn" onClick={() => { setCaptureMode(m.id); setPhase(PHASES.CHOOSE_TPL); }} style={{ zIndex: 5 }}>
                <div className="mode-circle">{m.icon}</div>
                <span className="mode-name">{m.label}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ padding: '10px 24px', fontSize: 14, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => { exitBoothMode(); window.dispatchEvent(new CustomEvent('navigate-to', { detail: '/templates' })); }}>Edit Templates</button>
        </div>
      )}

      {/* Phase: CHOOSE_TPL */}
      {phase === PHASES.CHOOSE_TPL && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', zIndex: 5, animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
          {chosenTemplate && (
            <div style={{ width: 220, height: 320, borderRadius: 12, overflow: 'hidden', marginBottom: 24, border: '3px solid var(--color-accent)', background: 'var(--color-bg-card)', boxShadow: '0 16px 40px rgba(213,82,163,0.4)' }}>
              {chosenTemplate.background_image ? <img src={getImageUrl(chosenTemplate.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>{chosenTemplate.photo_slots?.length || 0} slots</div>}
            </div>
          )}
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>Pilih Template</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-ghost" style={{ fontSize: 28, color: 'white', padding: 8 }} onClick={() => setTplScrollIdx(Math.max(0, tplScrollIdx - 1))} disabled={tplScrollIdx === 0}><HiOutlineChevronLeft /></button>
            <div style={{ display: 'flex', gap: 16 }}>
              {visibleTemplates.map(tpl => (
                <div key={tpl.id} onClick={() => setChosenTemplate(tpl)} style={{ width: 140, height: 200, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: chosenTemplate?.id === tpl.id ? '3px solid var(--color-accent)' : '3px solid transparent', background: 'var(--color-bg-card)', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: chosenTemplate?.id === tpl.id ? 'scale(1.08)' : 'scale(1)', boxShadow: chosenTemplate?.id === tpl.id ? '0 8px 24px rgba(213,82,163,0.3)' : '0 4px 12px rgba(0,0,0,0.5)', opacity: (chosenTemplate && chosenTemplate.id !== tpl.id) ? 0.6 : 1 }}>
                  {tpl.background_image ? <img src={getImageUrl(tpl.background_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>{tpl.name}</div>}
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 28, color: 'white', padding: 8 }} onClick={() => setTplScrollIdx(Math.min(Math.max(availableTemplates.length - 3, 0), tplScrollIdx + 1))} disabled={tplScrollIdx >= availableTemplates.length - 3}><HiOutlineChevronRight /></button>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
            <button className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: 16, borderRadius: 'var(--radius-full)' }} onClick={() => setPhase(PHASES.CHOOSE_MODE)}>Back</button>
            <button className="btn btn-launch" style={{ padding: '12px 40px', fontSize: 16, borderRadius: 'var(--radius-full)', opacity: (!chosenTemplate && !activeTemplate) ? 0.45 : 1, cursor: (!chosenTemplate && !activeTemplate) ? 'not-allowed' : 'pointer' }} onClick={() => { if (chosenTemplate || activeTemplate) startSession(); else { setToastMessage('⚠️ Pilih template terlebih dahulu'); setTimeout(() => setToastMessage(''), 3000); } }} disabled={!chosenTemplate && !activeTemplate}>Mulai</button>
          </div>
        </div>
      )}

      {/* Phase: COUNTDOWN */}
      {phase === PHASES.COUNTDOWN && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, height: '100%', width: '100%', animation: 'phaseEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.9)', marginBottom: 20, background: 'rgba(0,0,0,0.4)', padding: '8px 24px', borderRadius: 30, backdropFilter: 'blur(4px)' }}>Foto {(retakeSlotIndex !== null ? retakeSlotIndex : currentSlot) + 1} dari {totalSlots}</div>
          <div className="booth-countdown" key={countdown} style={{ fontSize: 280, fontWeight: 900, lineHeight: 1, textShadow: '0 20px 60px rgba(0,0,0,0.7)', color: 'white', animation: 'countdownPop 1s ease-out' }}>{countdown}</div>
        </div>
      )}

      {/* Phase: CAPTURING flash (webcam path only — DSLR uses DSLRCapturingOverlay) */}
      {phase === PHASES.CAPTURING && !useDSLR && (
        <div style={{ position: 'absolute', inset: 0, background: 'white', zIndex: 1000, animation: 'flashAnimation 0.5s ease-out forwards' }} />
      )}

      {/* Phase: PHOTO_PREVIEW */}
      {phase === PHASES.PHOTO_PREVIEW && previewComposite && (
        <div onClick={() => { if (window.__boothPreviewNext) window.__boothPreviewNext(); }} style={{ position: 'absolute', inset: 0, zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', cursor: 'pointer' }}>
          <div style={{ position: 'relative', display: 'inline-flex', maxHeight: '82vh', animation: 'ppSlideIn 0.25s ease-out' }}>
            <img src={previewComposite} alt="Preview" style={{ maxHeight: '82vh', maxWidth: '88vw', width: 'auto', height: 'auto', display: 'block', borderRadius: 8, boxShadow: '0 16px 56px rgba(0,0,0,0.7)' }} />
            {totalSlots > 1 && (
              <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 7 }}>
                {Array.from({ length: totalSlots }).map((_, i) => <div key={i} style={{ width: i < capturedPhotos.filter(Boolean).length ? 22 : 8, height: 8, borderRadius: 4, background: i < capturedPhotos.filter(Boolean).length ? '#D552A3' : 'rgba(255,255,255,0.3)', transition: 'width 0.3s' }} />)}
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.1)' }}><div style={{ height: '100%', background: 'linear-gradient(90deg, #462C7D, #D552A3)', animation: 'ppProgress 2.5s linear forwards' }} /></div>
          <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Tap / Spasi untuk lanjut</div>
        </div>
      )}

      {/* Phase: RETAKE */}
      {phase === PHASES.RETAKE && (
        <RetakeScreen
          capturedPhotos={capturedPhotos}
          totalSlots={totalSlots}
          previewComposite={previewComposite}
          captureMode={captureMode}
          onRetakeSlot={handleRetakeSinglePhoto}
          onRetakeAll={handleRetakeAll}
          onSubmit={() => finishSession(capturedPhotos)}
        />
      )}

      {/* Phase: RESULT */}
      {phase === PHASES.RESULT && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', zIndex: 5 }}>
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 10, zIndex: 6 }}>
            <button className="btn btn-launch" style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px', fontSize: 13 }} onClick={() => setPhase(PHASES.CHOOSE_MODE)}>Selesai</button>
          </div>
          <div style={{ display: 'inline-flex', borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.6)', animation: 'ppSlideIn 0.4s ease-out' }}>
            <img src={compositeImage || (Array.isArray(capturedPhotos[capturedPhotos.length - 1]) ? capturedPhotos[capturedPhotos.length - 1][0] : capturedPhotos[capturedPhotos.length - 1])} alt="Result" style={{ maxWidth: '65vw', maxHeight: '72vh', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => savePhotoToDiskFn(compositeImage || (Array.isArray(capturedPhotos[capturedPhotos.length-1]) ? capturedPhotos[capturedPhotos.length-1][0] : capturedPhotos[capturedPhotos.length-1]), activeEvent?.folder_path).then(p => { if (p) setToastMessage('Tersimpan: ' + p); setTimeout(() => setToastMessage(''), 3000); })}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#462C7D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HiOutlineDownload style={{ fontSize: 24, color: 'white' }} /></div>
              <span style={{ fontSize: 11, color: 'white' }}>Save</span>
            </div>
            {captureMode !== 'gif' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={handlePrint}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D552A3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HiOutlinePrinter style={{ fontSize: 24, color: 'white' }} /></div>
                <span style={{ fontSize: 11, color: 'white' }}>Print</span>
              </div>
            )}
            {driveResult && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => setShowDriveQR(true)}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,222,128,0.2)', border: '2px solid #4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HiOutlineCloud style={{ fontSize: 24, color: '#4ade80' }} /></div>
                <span style={{ fontSize: 11, color: '#4ade80' }}>QR Drive</span>
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', left: 40, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {driveResult ? (
              <>
                <div style={{ background: 'white', borderRadius: 14, padding: 16, cursor: 'pointer', boxShadow: '0 4px 20px rgba(213,82,163,0.3)' }} onClick={() => setShowDriveQR(true)}><QRCodeSVG value={driveResult.downloadLink || driveResult.viewLink || ''} size={110} bgColor="white" fgColor="#1a1425" level="M" /></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, color: 'white', fontWeight: 600 }}>Scan untuk download</span>
                  <span style={{ fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(74,222,128,0.1)', padding: '6px 14px', borderRadius: 20 }}><HiOutlineCheckCircle style={{ fontSize: 16 }} /> Tersimpan di Drive</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
                {driveError && <span style={{ fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}><HiOutlineExclamationCircle style={{ fontSize: 16 }} /> {driveError}</span>}
                {!hasDrive && activeEvent && <span style={{ fontSize: 12, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}><HiOutlineExclamationCircle style={{ fontSize: 16 }} /> Drive belum terhubung</span>}
                {savedFilePath && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}><HiOutlineDownload style={{ fontSize: 16 }} /> Tersimpan lokal</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom watermark */}
      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,0.06)', letterSpacing: 2, zIndex: 3 }}>se.kertasfoto</div>

      {/* Toast */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'white', padding: '10px 24px', borderRadius: 30, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9999, animation: 'slideUpFade 0.3s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />{toastMessage}</div>
        </div>
      )}

      {/* Menu overlay */}
      {showMenu && (
        <div className="mega-menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="mega-menu" onClick={e => e.stopPropagation()}>
            <div className="mega-menu-header">
              <div className="mega-menu-event">{activeEvent?.name || 'No event'}</div>
              <div className="mega-menu-icons">
                <div className="mega-menu-icon" onClick={() => { setShowMenu(false); exitBoothMode(); }}><HiOutlineArrowLeft className="mi" /><span>Exit</span></div>
                <div className="mega-menu-icon"><HiOutlineCog className="mi" /><span>Camera</span></div>
              </div>
            </div>
            <div className="mega-menu-columns">
              <div className="mega-menu-col"><h4>Setup</h4><a>General</a><a>Capture Settings</a><a>Camera Settings</a></div>
              <div className="mega-menu-col"><h4>Process</h4><a>Effects &amp; Stickers</a><a>Background Removal</a><a>Disclaimer</a></div>
              <div className="mega-menu-col"><h4>Sharing</h4><a>Sharing Settings</a><a>Print Setup</a><a>Slideshow</a></div>
              <div className="mega-menu-col"><h4>Google Drive</h4><a style={{ color: hasDrive ? '#4ade80' : 'var(--color-text-secondary)' }}>{hasDrive ? '✓ Drive aktif' : '✗ Drive tidak aktif'}</a>{activeEvent?.drive_folder_link && <a onClick={() => window.open(activeEvent.drive_folder_link, '_blank')}>Buka folder Drive</a>}</div>
            </div>
            <button className="mega-menu-lock" onClick={() => setShowMenu(false)}><HiOutlineLockClosed /> Lock</button>
          </div>
        </div>
      )}
    </div>
  );
}