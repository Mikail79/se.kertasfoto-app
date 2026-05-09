// src/renderer/hooks/useSession.js
import { useCallback } from "react";
import { PHASES } from "../constants";
import { buildFilename } from "../utils";

export function useSession({
  captureMode,
  activeEvent,
  activeTemplate,
  hasDrive,
  composeResult,
  savePhotoToDisk,
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
}) {
  const finishSession = useCallback(
    async (photos) => {
      setPhase(PHASES.UPLOADING);
      setUploadStep("compose");
      setUploadProgress(10);
      setDriveResult(null);
      setDriveError(null);

      let img = null;
      let isGifWithQR = false;

      // Step 1: initial composition (without QR)
      if (captureMode === "gif") {
        img = await composeGif(photos, composeResult, setUploadStep, setUploadProgress);
      } else {
        img = await composeResult(photos);
      }

      setCompositeImage(img);
      setUploadProgress(30);

      const sessionId = `sess_${Date.now()}`;
      setCurrentSessionId(sessionId);

      // Step 2: upload to Drive (initial)
      let driveUploadResult = null;
      let baseFilename = null;
      let fileId = null;

      if (hasDrive && img) {
        ({ driveUploadResult, baseFilename, fileId } = await uploadToDrive({
          img,
          captureMode,
          activeEvent,
          buildFilename,
          uploadPhotoToDrive,
          setUploadStep,
          setUploadProgress,
          setDriveError,
        }));
      }

      // Step 3: if QR slot exists and we have a Drive link, recompose with QR
      setUploadStep("qr");
      setUploadProgress(85);

      let finalImage = img;
      const fileLink = driveUploadResult?.viewLink;

      if (activeTemplate?.qr_slot && fileLink) {
        if (captureMode === "gif") {
          // Re-create GIF with QR on each frame
          finalImage = await composeGifWithQR(photos, composeResult, fileLink, setUploadStep, setUploadProgress);
          isGifWithQR = true;
        } else {
          finalImage = await composeResult(photos, 1.0, fileLink);
        }
        if (finalImage) setCompositeImage(finalImage);
      }

      // Step 4: overwrite Drive file with QR version (if needed)
      if (hasDrive && finalImage && fileId && (captureMode !== "gif" || isGifWithQR)) {
        driveUploadResult = await overwriteDriveFile({
          finalImage,
          fileId,
          baseFilename,
          updatePhotoToDrive,
          setUploadStep,
          setUploadProgress,
          setDriveResult,
          setDriveError,
          driveUploadResult,
        });
      }

      // Step 5: save locally (final image with QR)
      setUploadStep("save");
      const savedPath = await saveLocal({
        finalImage,
        captureMode,
        activeEvent,
        activeTemplate,
        savePhotoToDisk,
        setSavedFilePath,
        setSaveStatus,
      });

      setUploadProgress(100);
      playSound("success");

      addSession({
        id: sessionId,
        event_id: activeEvent?.id,
        template_id: activeTemplate?.id,
        photos: photos.length,
        created_at: new Date().toISOString(),
        file_path: savedPath || null,
        drive_file_id: driveUploadResult?.id || null,
        drive_view_link: driveUploadResult?.viewLink || null,
        drive_download_link: driveUploadResult?.downloadLink || null,
      });

      if (driveUploadResult) {
        setShowDriveQR(true);
      } else {
        setPhase(PHASES.RESULT);
        setResultTimer(15);
      }
    },
    [
      captureMode,
      composeResult,
      hasDrive,
      activeEvent,
      activeTemplate,
      addSession,
      updatePhotoToDrive,
      uploadPhotoToDrive,
      savePhotoToDisk,
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
    ]
  );

  return { finishSession };
}

// ----------------------------------------------------------------------
// Helper: compose GIF without QR (original)
// ----------------------------------------------------------------------
async function composeGif(photos, composeResult, setUploadStep, setUploadProgress) {
  setUploadStep("creating_gif");
  const composedFrames = [];

  for (let frameIdx = 0; frameIdx < 4; frameIdx++) {
    const framePhotos = photos.map(slotFrames =>
      Array.isArray(slotFrames) ? slotFrames[frameIdx] || slotFrames[0] : slotFrames
    );
    composedFrames.push(await composeResult(framePhotos, 1.0));
  }

  const firstImg = new Image();
  firstImg.src = composedFrames[0];
  await new Promise(r => { firstImg.onload = r; });
  const aspect = firstImg.width / firstImg.height;
  const targetWidth = 600;
  const targetHeight = Math.round(600 / aspect);

  return new Promise(async (resolve) => {
    try {
      const gifshot = window.gifshot;
      if (!gifshot || typeof gifshot.createGIF !== "function") {
        return resolve(composedFrames[0]);
      }
      gifshot.createGIF(
        {
          images: composedFrames,
          gifWidth: Math.floor(targetWidth),
          gifHeight: Math.floor(targetHeight),
          interval: 0.3,
          progressCallback: (pct) => setUploadProgress(10 + Math.floor(pct * 20)),
        },
        (obj) => resolve(obj.error ? composedFrames[0] : obj.image)
      );
    } catch {
      resolve(composedFrames[0]);
    }
  });
}

// ----------------------------------------------------------------------
// Helper: compose GIF with QR on each frame
// ----------------------------------------------------------------------
async function composeGifWithQR(photos, composeResult, qrUrl, setUploadStep, setUploadProgress) {
  setUploadStep("creating_gif_with_qr");
  const composedFrames = [];

  for (let frameIdx = 0; frameIdx < 4; frameIdx++) {
    const framePhotos = photos.map(slotFrames =>
      Array.isArray(slotFrames) ? slotFrames[frameIdx] || slotFrames[0] : slotFrames
    );
    // Pass qrUrl to composeResult (third parameter)
    composedFrames.push(await composeResult(framePhotos, 1.0, qrUrl));
  }

  const firstImg = new Image();
  firstImg.src = composedFrames[0];
  await new Promise(r => { firstImg.onload = r; });
  const aspect = firstImg.width / firstImg.height;
  const targetWidth = 600;
  const targetHeight = Math.round(600 / aspect);

  return new Promise(async (resolve) => {
    try {
      const gifshot = window.gifshot;
      if (!gifshot || typeof gifshot.createGIF !== "function") {
        return resolve(composedFrames[0]);
      }
      gifshot.createGIF(
        {
          images: composedFrames,
          gifWidth: Math.floor(targetWidth),
          gifHeight: Math.floor(targetHeight),
          interval: 0.3,
          progressCallback: (pct) => setUploadProgress(85 + Math.floor(pct * 10)),
        },
        (obj) => resolve(obj.error ? composedFrames[0] : obj.image)
      );
    } catch {
      resolve(composedFrames[0]);
    }
  });
}

// ----------------------------------------------------------------------
// Upload, overwrite, save helpers (unchanged)
// ----------------------------------------------------------------------
async function uploadToDrive({
  img,
  captureMode,
  activeEvent,
  buildFilename,
  uploadPhotoToDrive,
  setUploadStep,
  setUploadProgress,
  setDriveError,
}) {
  setUploadStep("upload");
  setUploadProgress(60);
  const ext = captureMode === "gif" ? ".gif" : ".jpg";
  const baseFilename = buildFilename(activeEvent) + ext;
  let driveUploadResult = null;
  let fileId = null;
  try {
    driveUploadResult = await uploadPhotoToDrive(img, activeEvent.drive_folder_id, baseFilename);
    if (driveUploadResult) {
      fileId = driveUploadResult.id;
    } else {
      setDriveError("Upload gagal — cek koneksi");
    }
  } catch (err) {
    setDriveError(err.message || "Upload error");
  }
  return { driveUploadResult, baseFilename, fileId };
}

async function overwriteDriveFile({
  finalImage,
  fileId,
  baseFilename,
  updatePhotoToDrive,
  setUploadStep,
  setUploadProgress,
  setDriveResult,
  setDriveError,
  driveUploadResult,
}) {
  setUploadStep("upload");
  setUploadProgress(95);
  try {
    const updated = await updatePhotoToDrive(finalImage, fileId, baseFilename);
    if (updated) {
      setDriveResult(updated);
      return updated;
    }
  } catch (err) {
    setDriveError(err.message || "Update final QR gagal");
  }
  return driveUploadResult;
}

async function saveLocal({
  finalImage,
  captureMode,
  activeEvent,
  activeTemplate,
  savePhotoToDisk,
  setSavedFilePath,
  setSaveStatus,
}) {
  const folderPath = activeEvent?.folder_path;
  if (!folderPath || !finalImage) return null;
  const ext = captureMode === "gif" ? ".gif" : ".jpg";
  const filename = buildFilename(activeEvent) + ext;
  let savedPath = null;
  try {
    if (window.electronAPI?.savePhoto) {
      const result = await window.electronAPI.savePhoto({
        folder: folderPath,
        filename,
        dataUrl: finalImage,
        dpi: activeTemplate?.dpi || 300,
      });
      savedPath = typeof result === "object" ? result.path : result;
      if (savedPath && !savedPath.includes(":") && !savedPath.startsWith("/") && !savedPath.startsWith("\\")) {
        savedPath = `${folderPath}/${savedPath}`.replace(/\\/g, "/");
      }
    } else {
      savedPath = await savePhotoToDisk(finalImage, folderPath);
    }
  } catch (err) {
    console.error("Failed to save:", err);
  }
  setSavedFilePath(savedPath);
  setSaveStatus(savedPath ? "saved" : "error");
  return savedPath;
}