const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')

// Google Drive module (loaded after app ready)
let gdriveModule = null


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
  gdriveModule = await import('./googleDrive.js')
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
  ipcMain.handle('sessions:update', (_e, id, updates) => db.updateSession(id, updates))
  ipcMain.handle('sessions:delete', (_e, id) => db.deleteSession(id))
  ipcMain.handle('sessions:getByEvent', (_e, eventId) => db.getSessionsByEvent(eventId))

  // Shares
  ipcMain.handle('shares:getAll', () => db.getShares())
  ipcMain.handle('shares:create', (_e, share) => db.createShare(share))
  ipcMain.handle('shares:getBySession', (_e, sessionId) => db.getSharesBySession(sessionId))
  ipcMain.handle('shares:delete', (_e, id) => db.deleteShare(id))

  // Hardware - Camera
  ipcMain.handle('camera:getDevices', () => cameraModule.getCameraDevices())
  ipcMain.handle('camera:capture', (_e, deviceId, savePath) =>
    cameraModule.capturePhoto(deviceId, savePath)
  )

// ── IPC: select-folder ───────────────────────────────────────────────────────
ipcMain.handle('select-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    title: 'Pilih folder simpan foto',
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})
 


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

  // ── Google Drive ─────────────────────────────────────────────────────────────

  // Status: apakah credentials ada & sudah login
  ipcMain.handle('gdrive:status', () => {
    return {
      hasCredentials: gdriveModule.hasCredentials(),
      isAuthenticated: gdriveModule.isAuthenticated(),
    }
  })

  // Simpan credentials.json dari user (paste JSON di UI)
  ipcMain.handle('gdrive:saveCredentials', (_e, json) => {
    return gdriveModule.saveCredentials(json)
  })

  // Cek apakah credentials file sudah ada
  ipcMain.handle('gdrive:hasCredentials', () => {
    return gdriveModule.hasCredentials()
  })

  // Mulai OAuth flow (buka browser untuk login Google)
  ipcMain.handle('gdrive:connect', async () => {
    try {
      const result = await gdriveModule.startOAuthFlow()
      return result
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Putuskan koneksi / logout
  ipcMain.handle('gdrive:disconnect', () => {
    return gdriveModule.disconnectDrive()
  })

  // Buat folder Drive untuk event baru
  ipcMain.handle('gdrive:createFolder', async (_e, folderName) => {
    try {
      const result = await gdriveModule.createDriveFolder(folderName)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Upload foto (dataUrl) ke folder Drive
  ipcMain.handle('gdrive:uploadPhoto', async (_e, dataUrl, folderId, filename) => {
    try {
      const tempDir = path.join(app.getPath('temp'), 'sekertasfoto-uploads')
      const result = await gdriveModule.uploadPhotoFromDataUrl(dataUrl, folderId, filename, tempDir)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── IPC: save-photo ──────────────────────────────────────────────────────────
ipcMain.handle('save-photo', async (_event, { folder, filename, dataUrl }) => {
  try {
    // Strip data URL header  ("data:image/jpeg;base64,...")
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
 
    // Make sure the target folder exists
    fs.mkdirSync(folder, { recursive: true })
 
    const filePath = path.join(folder, filename)
    fs.writeFileSync(filePath, buffer)
 
    console.log('[main] Photo saved:', filePath)
    return { path: filePath }
  } catch (err) {
    console.error('[main] Failed to save photo:', err)
    throw err                   // Will surface as saveStatus = 'error' in UI
  }
})

ipcMain.handle('gdrive:updatePhoto', async (_e, dataUrl, fileId, filename) => {
  try {
    const tempDir = path.join(app.getPath('temp'), 'sekertasfoto-uploads')

    const result = await gdriveModule.updatePhotoFromDataUrl(
      dataUrl,
      fileId,
      filename,
      tempDir
    )

    return { success: true, ...result }
  } catch (err) {
    return { success: false, error: err.message }
  }
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