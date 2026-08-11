import { useCallback } from "react";
import { PHASES } from "../constants";

export function useCapture({
  captureMode,
  captureFrame,
  activeEvent,
  currentSlot,
  setCurrentSlot,
  totalSlots,
  retakeSlotIndex,
  setRetakeSlotIndex,
  cameraCountdown,
  previewDuration,
  capturedPhotos,
  setCapturedPhotos,
  setLastCapturedPhoto,
  composePartialPreview,
  playSound,
  setPhase,
  setCountdown,
  setPreviewComposite,
}) {
  const doCapture = useCallback(async () => {
    setPhase(PHASES.CAPTURING);

    let frameData = null;
    if (captureMode === "gif") {
      frameData = await captureGifBurst(captureFrame);
    } else {
      frameData = await capturePhoto(captureFrame, activeEvent);
    }

    if (!frameData || (Array.isArray(frameData) && frameData.length === 0)) {
      setPhase(PHASES.CHOOSE_MODE);
      return;
    }

    playSound("shutter");

    const slot = retakeSlotIndex !== null ? retakeSlotIndex : currentSlot;
    const newPhotos = [...capturedPhotos];
    newPhotos[slot] = frameData;

    setCapturedPhotos(newPhotos);
    setLastCapturedPhoto(Array.isArray(frameData) ? frameData[0] : frameData);

    const previewPhotos = newPhotos.map(p => (Array.isArray(p) ? p[0] : p));

    try {
      const preview = await composePartialPreview(previewPhotos);
      if (preview) {
        setPreviewComposite(preview);
        setPhase(PHASES.PHOTO_PREVIEW);
      } else {
        throw new Error("Preview empty");
      }
    } catch (err) {
      console.error("Preview error:", err);
      setPreviewComposite(previewPhotos[0]);
      setPhase(PHASES.PHOTO_PREVIEW);
    }

    const goNext = () => {
      const isRetake = retakeSlotIndex !== null;
      const isLast = isRetake ? true : currentSlot + 1 >= totalSlots;

      if (isLast) {
        setRetakeSlotIndex(null);
        setPhase(PHASES.RETAKE);
      } else {
        setCurrentSlot(prev => prev + 1);
        setCountdown(cameraCountdown);
        setPhase(PHASES.COUNTDOWN);
      }
    };

    const timer = setTimeout(goNext, (previewDuration ?? 3) * 1000);
    window.__boothPreviewTimer = timer;
    window.__boothPreviewNext = () => {
      clearTimeout(timer);
      window.__boothPreviewTimer = null;
      goNext();
    };
  }, [
    captureMode,
    captureFrame,
    activeEvent,
    currentSlot,
    setCurrentSlot,
    totalSlots,
    retakeSlotIndex,
    setRetakeSlotIndex,
    cameraCountdown,
    previewDuration,
    capturedPhotos,
    setCapturedPhotos,
    setLastCapturedPhoto,
    composePartialPreview,
    playSound,
    setPhase,
    setCountdown,
    setPreviewComposite,
  ]);

  return { doCapture };
}

// ---------- Private helpers ----------
async function captureGifBurst(captureFrame) {
  const burstFrames = [];
  for (let i = 0; i < 4; i++) {
    await new Promise(r => setTimeout(r, 150));
    const f = captureFrame();
    if (f) burstFrames.push(f);
    if (i < 3) await new Promise(r => setTimeout(r, 200));
  }
  return burstFrames.length > 0 ? burstFrames : null;
}

async function capturePhoto(captureFrame, activeEvent) {
  try {
    const sdkStatus = await window.electronAPI?.cameraSDK_status?.();
    if (sdkStatus?.connected) {
      const result = await window.electronAPI.cameraSDK_capture(
        activeEvent?.folder_path || null,
        `capture_${Date.now()}`
      );
      if (result?.success && result?.path) {
        return `file://${result.path.replace(/\\\\/g, "/")}`;
      }
    }
  } catch (e) {
    console.warn("SDK capture fallback to webcam:", e);
  }
  await new Promise(r => setTimeout(r, 300));
  return captureFrame();
}