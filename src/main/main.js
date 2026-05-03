const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

/**
 * Main Process — Electron Entry Point
 * Handles window creation, IPC handlers, and hardware control
 */

// Detect dev mode
const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null

// --- Lazy-load modules (use dynamic import for ESM or require for CJS) ---
let db = null
let cameraModule = null
let printerModule = null
let imageProcessor = null

async function loadModules() {
  // jsonDb, camera, printer, imageProcessor are ESM modules
  // We use dynamic import
  const dbMod = await import('./storage/jsonDb.js')
  db = dbMod.default
  cameraModule = await import('./hardware/camera.js')
  printerModule = await import('./hardware/printer.js')
  imageProcessor = await import('./imageProcessor.js')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#16101f',
      symbolColor: '#D552A3',
      height: 36,
    },
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev, // allow loading file:// resources from http://localhost in dev mode
    },
    icon: path.join(__dirname, '../../build/icon.ico'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// --- Register IPC Handlers ---
function registerIpcHandlers() {
  // Events
  ipcMain.handle('events:getAll', () => db.getEvents())
  ipcMain.handle('events:create', (_e, event) => db.createEvent(event))
  ipcMain.handle('events:update', (_e, id, updates) => db.updateEvent(id, updates))
  ipcMain.handle('events:delete', (_e, id) => db.deleteEvent(id))

  // Templates
  ipcMain.handle('templates:getAll', () => db.getTemplates())
  ipcMain.handle('templates:create', (_e, template) => db.createTemplate(template))
  ipcMain.handle('templates:update', (_e, id, updates) => db.updateTemplate(id, updates))
  ipcMain.handle('templates:delete', (_e, id) => db.deleteTemplate(id))

  // Sessions
  ipcMain.handle('sessions:getAll', () => db.getSessions())
  ipcMain.handle('sessions:create', (_e, session) => db.createSession(session))
  ipcMain.handle('sessions:getByEvent', (_e, eventId) => db.getSessionsByEvent(eventId))

  // Hardware - Camera
  ipcMain.handle('camera:getDevices', () => cameraModule.getCameraDevices())
  ipcMain.handle('camera:capture', (_e, deviceId, savePath) =>
    cameraModule.capturePhoto(deviceId, savePath)
  )

  // Hardware - Printer
  ipcMain.handle('printer:getList', () => printerModule.getPrinters(mainWindow))
  ipcMain.handle('printer:print', (_e, filePath, printerName) =>
    printerModule.printFile(mainWindow, filePath, printerName)
  )

  // Image Processing
  ipcMain.handle('image:composite', (_e, templateData, photos, outputPath) =>
    imageProcessor.compositeImage(templateData, photos, outputPath)
  )

  // Dialogs
  ipcMain.handle('dialog:openFile', async (_e, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      ],
      ...options,
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // App
  ipcMain.handle('app:getPath', (_e, name) => app.getPath(name))
  ipcMain.handle('app:toggleFullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen())
      return mainWindow.isFullScreen()
    }
    return false
  })
}

// --- App Lifecycle ---
app.whenReady().then(async () => {
  await loadModules()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
