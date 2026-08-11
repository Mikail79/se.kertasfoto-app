const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload Script — IPC Bridge
 * Exposes a safe API to the renderer process via contextBridge
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // ── File system ─────────────────────────────────────────────────────────────
  saveFile: (options) => ipcRenderer.invoke("save-file", options),
  // options: { folder: string, filename: string, dataUrl: string }
  // returns: { success: boolean, path?: string }

  // ── Camera: digiCamControl integration ─────────────────────────────────────

  /**
   * Returns the current camera connection status.
   * @returns {Promise<{ connected: boolean, cameras: string | null }>}
   */
  getCameraStatus: () => ipcRenderer.invoke("camera-status"),

  /**
   * Returns the HTTP URL of the digiCamControl live view MJPEG stream.
   * Use this as the `src` of an <img> tag to show live preview.
   * @returns {Promise<string>}
   */
  getLiveViewUrl: () => ipcRenderer.invoke("get-liveview-url"),

  /**
   * Full capture flow:
   *   stop live view → settle → capture → save file → update DB → return
   *   (live view restarts in background AFTER this promise resolves)
   *
   * @param {{
   *   outputFolder?: string,
   *   filenameBase?: string,
   *   sessionId?: string,
   *   eventId?: string,
   *   slotIndex?: number
   * }} options
   * @returns {Promise<{
   *   success: boolean,
   *   path?: string,
   *   originalPath?: string,
   *   sessionId?: string,
   *   error?: string
   * }>}
   */
  takePhoto: (options) => ipcRenderer.invoke("take-photo", options),

  /**
   * Marks a session as completed and stores the composite image path.
   * @param {{ sessionId: string, compositeImagePath?: string }} options
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  finishSession: (options) => ipcRenderer.invoke("finish-session", options),

  // Events
  getEvents: () => ipcRenderer.invoke("events:getAll"),
  createEvent: (event) => ipcRenderer.invoke("events:create", event),
  updateEvent: (id, updates) =>
    ipcRenderer.invoke("events:update", id, updates),
  deleteEvent: (id) => ipcRenderer.invoke("events:delete", id),

  // Templates
  getTemplates: () => ipcRenderer.invoke("templates:getAll"),
  createTemplate: (template) =>
    ipcRenderer.invoke("templates:create", template),
  updateTemplate: (id, updates) =>
    ipcRenderer.invoke("templates:update", id, updates),
  deleteTemplate: (id) => ipcRenderer.invoke("templates:delete", id),

  // Sessions
  getSessions: () => ipcRenderer.invoke("sessions:getAll"),
  createSession: (session) => ipcRenderer.invoke("sessions:create", session),
  updateSession: (id, updates) =>
    ipcRenderer.invoke("sessions:update", id, updates),
  deleteSession: (id) => ipcRenderer.invoke("sessions:delete", id),
  getSessionsByEvent: (eventId) =>
    ipcRenderer.invoke("sessions:getByEvent", eventId),

  // Shares
  getShares: () => ipcRenderer.invoke("shares:getAll"),
  createShare: (share) => ipcRenderer.invoke("shares:create", share),
  getSharesBySession: (sessionId) =>
    ipcRenderer.invoke("shares:getBySession", sessionId),
  deleteShare: (id) => ipcRenderer.invoke("shares:delete", id),

  // Hardware
  getCameraDevices: () => ipcRenderer.invoke("camera:getDevices"),
  capturePhoto: (deviceId, savePath) =>
    ipcRenderer.invoke("camera:capture", deviceId, savePath),
  getPrinters: () => ipcRenderer.invoke("printer:getList"),

  /**
   * printFile — now accepts an optional calibration object as 4th argument
   *
   * @param {string} filePath
   * @param {string} printerName
   * @param {string} paperSize
   * @param {object} [calibration]
   * @param {number} [calibration.paddingMM]  uniform inset in mm (0–15)
   * @param {number} [calibration.offsetX]    horizontal shift in mm (-10–10)
   * @param {number} [calibration.offsetY]    vertical shift in mm (-10–10)
   * @param {number} [calibration.scalePct]   overall scale % (85–100)
   */
  printFile: (filePath, printerName, paperSize, calibration = {}) =>
    ipcRenderer.invoke(
      "printer:print",
      filePath,
      printerName,
      paperSize,
      calibration
    ),

  // ── Print Calibration persistence ────────────────────────────────────────
  /**
   * Save calibration for a printer+paperSize combo.
   * key convention: `${printerName}::${paperSize}` (build in renderer)
   */
  savePrinterCalibration: (key, calibration) =>
    ipcRenderer.invoke("printer:saveCalibration", key, calibration),

  /** Load previously saved calibration. Returns null if not found. */
  getPrinterCalibration: (key) =>
    ipcRenderer.invoke("printer:getCalibration", key),

  // Dialogs
  openFileDialog: (options) => ipcRenderer.invoke("dialog:openFile", options),
  openFolderDialog: () => ipcRenderer.invoke("dialog:openFolder"),

  // Image Processing
  compositeImage: (templateData, photos, outputPath) =>
    ipcRenderer.invoke("image:composite", templateData, photos, outputPath),

  // App
  getAppPath: (name) => ipcRenderer.invoke("app:getPath", name),
  toggleFullscreen: () => ipcRenderer.invoke("app:toggleFullscreen"),
  setFullscreen: (state) => ipcRenderer.invoke("app:setFullscreen", state),

  saveFile: (opts) => ipcRenderer.invoke("save-photo", opts),
  savePhoto: (opts) => ipcRenderer.invoke("save-photo", opts),
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  // ── Google Drive ─────────────────────────────────────────────────────────
  gdrive_status: () => ipcRenderer.invoke("gdrive:status"),
  gdrive_connect: () => ipcRenderer.invoke("gdrive:connect"),
  gdrive_disconnect: () => ipcRenderer.invoke("gdrive:disconnect"),
  gdrive_hasCredentials: () => ipcRenderer.invoke("gdrive:hasCredentials"),
  gdrive_saveCredentials: (json) =>
    ipcRenderer.invoke("gdrive:saveCredentials", json),
  gdrive_createFolder: (folderName) =>
    ipcRenderer.invoke("gdrive:createFolder", folderName),
  gdrive_uploadPhoto: (dataUrl, folderId, filename) =>
    ipcRenderer.invoke("gdrive:uploadPhoto", dataUrl, folderId, filename),
  gdrive_updatePhoto: (dataUrl, fileId, filename) =>
    ipcRenderer.invoke("gdrive:updatePhoto", dataUrl, fileId, filename),

  // ── Camera SDK (digiCamControl) ─────────────────────────────────────────
  cameraSDK_status: () => ipcRenderer.invoke("camera-sdk:status"),
  cameraSDK_getProperty: (name) =>
    ipcRenderer.invoke("camera-sdk:getProperty", name),
  cameraSDK_setProperty: (name, value) =>
    ipcRenderer.invoke("camera-sdk:setProperty", name, value),
  cameraSDK_getPropertyValues: (name) =>
    ipcRenderer.invoke("camera-sdk:getPropertyValues", name),
  cameraSDK_getAllProperties: () =>
    ipcRenderer.invoke("camera-sdk:getAllProperties"),
  cameraSDK_capture: (outputFolder, filenameBase) =>
    ipcRenderer.invoke("camera-sdk:capture", outputFolder, filenameBase),
  cameraSDK_start: () => ipcRenderer.invoke("camera-sdk:start"),

  // ── Dual-window (Admin ⇄ Client) ─────────────────────────────────────────
  /** List physical displays, e.g. to let the operator pick one for the client window. */
  getDisplays: () => ipcRenderer.invoke("win:getDisplays"),
  /** Open (or focus) the client window, optionally pinned to a specific display id. */
  openClientWindow: (displayId) => ipcRenderer.invoke("win:openClient", displayId),
  /** Move an already-open client window to a different display. */
  moveClientToDisplay: (displayId) => ipcRenderer.invoke("win:moveClientToDisplay", displayId),
  /** Toggle kiosk mode on the client window (locks fullscreen, blocks Alt+F4 etc). */
  setClientKiosk: (enabled) => ipcRenderer.invoke("win:setClientKiosk", enabled),
  /** Close the client window without quitting the app. */
  closeClientWindow: () => ipcRenderer.invoke("win:closeClient"),
  /** Push the current session state (phase, template, photos, ...) to the client window. */
  pushSessionState: (state) => ipcRenderer.invoke("session:push", state),
  /** Stream a single webcam preview frame (dataURL) to the client window. */
  pushLiveFrame: (dataUrl) => ipcRenderer.invoke("session:live-frame", dataUrl),
  /** Send an operator command (retake / next-slot / finish-session / show-qr / reset) to the client window. */
  sendAdminCommand: (cmd, payload) => ipcRenderer.invoke("admin:command", cmd, payload),
  /** Fired when the client window requests a capture ('start' | 'retake-last' | ...). */
  onClientCaptureRequested: (cb) => {
    const listener = (_e, action) => cb(action)
    ipcRenderer.on("admin:client-capture-requested", listener)
    return () => ipcRenderer.removeListener("admin:client-capture-requested", listener)
  },
  /** Fired if the operator (or the OS) closes the client window manually. */
  onClientWindowClosed: (cb) => {
    const listener = () => cb()
    ipcRenderer.on("client-window-closed", listener)
    return () => ipcRenderer.removeListener("client-window-closed", listener)
  },
});
