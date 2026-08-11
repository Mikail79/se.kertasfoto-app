/**
 * Camera Control Module (Stub)
 * In production, this would use node-webcam or gphoto2
 * For now, we stub the API so the UI can be built and tested
 */

export async function getCameraDevices() {
  // Stub: return mock devices
  // In production: use node-webcam or enumerate USB devices
  return [
    { id: 'webcam-default', label: 'Default Webcam' },
    { id: 'dslr-canon', label: 'Canon EOS R5 (USB)' },
  ]
}

export async function capturePhoto(deviceId, savePath) {
  // Stub: In production, trigger camera shutter
  // For now, return a placeholder path
  console.log(`[Camera] Capturing from ${deviceId} -> ${savePath}`)
  return { success: true, path: savePath }
}
