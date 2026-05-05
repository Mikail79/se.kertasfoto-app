const { contextBridge, ipcRenderer } = require('electron')


/**
 * Preload Script — IPC Bridge
 * Exposes a safe API to the renderer process via contextBridge
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Events
  getEvents: () => ipcRenderer.invoke('events:getAll'),
  createEvent: (event) => ipcRenderer.invoke('events:create', event),
  updateEvent: (id, updates) => ipcRenderer.invoke('events:update', id, updates),
  deleteEvent: (id) => ipcRenderer.invoke('events:delete', id),

  // Templates
  getTemplates: () => ipcRenderer.invoke('templates:getAll'),
  createTemplate: (template) => ipcRenderer.invoke('templates:create', template),
  updateTemplate: (id, updates) => ipcRenderer.invoke('templates:update', id, updates),
  deleteTemplate: (id) => ipcRenderer.invoke('templates:delete', id),

  // Sessions
  getSessions: () => ipcRenderer.invoke('sessions:getAll'),
  createSession: (session) => ipcRenderer.invoke('sessions:create', session),
  updateSession: (id, updates) => ipcRenderer.invoke('sessions:update', id, updates),
  deleteSession: (id) => ipcRenderer.invoke('sessions:delete', id),
  getSessionsByEvent: (eventId) => ipcRenderer.invoke('sessions:getByEvent', eventId),

  // Shares
  getShares: () => ipcRenderer.invoke('shares:getAll'),
  createShare: (share) => ipcRenderer.invoke('shares:create', share),
  getSharesBySession: (sessionId) => ipcRenderer.invoke('shares:getBySession', sessionId),
  deleteShare: (id) => ipcRenderer.invoke('shares:delete', id),

  // Hardware
  getCameraDevices: () => ipcRenderer.invoke('camera:getDevices'),
  capturePhoto: (deviceId, savePath) => ipcRenderer.invoke('camera:capture', deviceId, savePath),
  getPrinters: () => ipcRenderer.invoke('printer:getList'),
  printFile: (filePath, printerName) => ipcRenderer.invoke('printer:print', filePath, printerName),

  // Dialogs
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  // Image Processing
  compositeImage: (templateData, photos, outputPath) =>
    ipcRenderer.invoke('image:composite', templateData, photos, outputPath),

  // App
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  toggleFullscreen: () => ipcRenderer.invoke('app:toggleFullscreen'),

  saveFile: (opts) => ipcRenderer.invoke('save-photo', opts),
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // ── Google Drive ─────────────────────────────────────────────────────────
  // Cek status koneksi
  gdrive_status: () => ipcRenderer.invoke('gdrive:status'),

  // Mulai proses OAuth (buka browser)
  gdrive_connect: () => ipcRenderer.invoke('gdrive:connect'),

  // Putuskan koneksi
  gdrive_disconnect: () => ipcRenderer.invoke('gdrive:disconnect'),

  // Cek apakah credentials.json sudah ada
  gdrive_hasCredentials: () => ipcRenderer.invoke('gdrive:hasCredentials'),

  // Simpan credentials.json dari user (paste JSON)
  gdrive_saveCredentials: (json) => ipcRenderer.invoke('gdrive:saveCredentials', json),

  // Buat folder di Drive untuk event
  gdrive_createFolder: (folderName) => ipcRenderer.invoke('gdrive:createFolder', folderName),

  // Upload foto hasil booth ke folder Drive
  gdrive_uploadPhoto: (dataUrl, folderId, filename) =>
    ipcRenderer.invoke('gdrive:uploadPhoto', dataUrl, folderId, filename),

  gdrive_updatePhoto: (dataUrl, fileId, filename) =>
    ipcRenderer.invoke('gdrive:updatePhoto', dataUrl, fileId, filename),
})