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
  getSessionsByEvent: (eventId) => ipcRenderer.invoke('sessions:getByEvent', eventId),

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
})
