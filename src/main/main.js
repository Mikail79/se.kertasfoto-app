// main.js – Merged with ipcHandlers.js functionality
import { capturePhoto, toggleLiveView, getLiveViewUrl, isConnected } from './cameraSDK.js'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Google Drive module (loaded after app ready)
let gdriveModule = null
let db = null
let cameraModule = null
let printerModule = null
let imageProcessor = null
let cameraSDK = null

// ─────────────────────────────────────────────────────────────────────────────
//  Merged registerCameraHandlers from ipcHandlers.js
// ─────────────────────────────────────────────────────────────────────────────
function registerCameraHandlers(ipcMain) {
  // Camera status
  ipcMain.handle('camera-status', async () => isConnected())

  // Live view URL
  ipcMain.handle('get-liveview-url', () => getLiveViewUrl())

  // Take photo (main flow with session management)
  ipcMain.handle('take-photo', async (_event, options = {}) => {
    const { outputFolder, filenameBase, sessionId, eventId, slotIndex = 0 } = options

    // Step 1: Stop live view
    await toggleLiveView(false)
    await sleep(100) // settle delay

    // Step 2: Capture
    const captureResult = await capturePhoto(outputFolder, filenameBase)
    if (!captureResult.success) {
      toggleLiveView(true).catch(() => {})
      return { success: false, error: captureResult.error }
    }

    // Step 3: Persist to database
    let resolvedSessionId = sessionId
    try {
      if (!resolvedSessionId && eventId) {
        const newSession = db.createSession({
          id: `session_${Date.now()}`,
          event_id: eventId,
          created_at: new Date().toISOString(),
          photos: [],
          status: 'in_progress',
        })
        resolvedSessionId = newSession.id
      }
      if (resolvedSessionId) {
        const existing = db.getSessions().find(s => s.id === resolvedSessionId)
        const photos = existing?.photos ?? []
        photos[slotIndex] = captureResult.path
        db.updateSession(resolvedSessionId, { photos })
      }
    } catch (dbErr) {
      console.error('DB update error after capture:', dbErr)
    }

    // Step 4: Return result (renderer shows preview immediately)
    const response = {
      success: true,
      path: captureResult.path,
      originalPath: captureResult.originalPath,
      sessionId: resolvedSessionId,
    }

    // Step 5: Re-enable live view in background
    setImmediate(async () => await toggleLiveView(true))
    return response
  })

  // Finish session (mark as completed)
  ipcMain.handle('finish-session', async (_event, { sessionId, compositeImagePath }) => {
    if (!sessionId) return { success: false, error: 'No sessionId provided' }
    try {
      const updated = db.updateSession(sessionId, {
        status: 'completed',
        composite_path: compositeImagePath ?? null,
        completed_at: new Date().toISOString(),
      })
      return { success: !!updated }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  App & Window Setup
// ─────────────────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development'
let mainWindow = null

async function loadModules() {
  const dbMod = await import('./storage/jsonDb.js')
  db = dbMod.default
  cameraModule = await import('./hardware/camera.js')
  printerModule = await import('./hardware/printer.js')
  imageProcessor = await import('./imageProcessor.js')
  gdriveModule = await import('./googleDrive.js')
  cameraSDK = await import('./cameraSDK.js')
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
      webSecurity: !isDev,
    },
    icon: path.join(__dirname, '../../build/icon.ico'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─────────────────────────────────────────────────────────────────────────────
//  Unified IPC Handlers (original + merged)
// ─────────────────────────────────────────────────────────────────────────────
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

  // Hardware - Camera (legacy)
  ipcMain.handle('camera:getDevices', () => cameraModule.getCameraDevices())
  ipcMain.handle('camera:capture', (_e, deviceId, savePath) =>
    cameraModule.capturePhoto(deviceId, savePath)
  )

  // Folder selection
  ipcMain.handle('select-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, {
      title: 'Pilih folder simpan foto',
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Printer
  ipcMain.handle('printer:getList', () => printerModule.getPrinters(mainWindow))
  ipcMain.handle('printer:print', (_e, filePath, printerName, paperSize, calibration = {}) =>
    printerModule.printFile(mainWindow, filePath, printerName, paperSize, calibration)
  )
  ipcMain.handle('printer:saveCalibration', (_e, key, calibration) =>
    db.savePrinterCalibration(key, calibration)
  )
  ipcMain.handle('printer:getCalibration', (_e, key) => db.getPrinterCalibration(key))

  // Image Processing
  ipcMain.handle('image:composite', (_e, templateData, photos, outputPath) =>
    imageProcessor.compositeImage(templateData, photos, outputPath)
  )

  // Dialogs
  ipcMain.handle('dialog:openFile', async (_e, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      ...options,
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
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
  ipcMain.handle('app:setFullscreen', (_e, state) => {
    if (mainWindow) {
      mainWindow.setFullScreen(state)
      return mainWindow.isFullScreen()
    }
    return false
  })

  // Google Drive
  ipcMain.handle('gdrive:status', () => ({
    hasCredentials: gdriveModule.hasCredentials(),
    isAuthenticated: gdriveModule.isAuthenticated(),
  }))
  ipcMain.handle('gdrive:saveCredentials', (_e, json) => gdriveModule.saveCredentials(json))
  ipcMain.handle('gdrive:hasCredentials', () => gdriveModule.hasCredentials())
  ipcMain.handle('gdrive:connect', async () => {
    try {
      return await gdriveModule.startOAuthFlow()
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('gdrive:disconnect', () => gdriveModule.disconnectDrive())
  ipcMain.handle('gdrive:createFolder', async (_e, folderName) => {
    try {
      const result = await gdriveModule.createDriveFolder(folderName)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('gdrive:uploadPhoto', async (_e, dataUrl, folderId, filename) => {
    try {
      const tempDir = path.join(app.getPath('temp'), 'sekertasfoto-uploads')
      const result = await gdriveModule.uploadPhotoFromDataUrl(dataUrl, folderId, filename, tempDir)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
  ipcMain.handle('gdrive:updatePhoto', async (_e, dataUrl, fileId, filename) => {
    try {
      const tempDir = path.join(app.getPath('temp'), 'sekertasfoto-uploads')
      const result = await gdriveModule.updatePhotoFromDataUrl(dataUrl, fileId, filename, tempDir)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Save photo (with DPI metadata)
  ipcMain.handle('save-photo', async (_event, { folder, filename, dataUrl, dpi = 300 }) => {
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      let buffer = Buffer.from(base64, 'base64')

      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer[3] === 0xe0) {
        const units = 1
        buffer[13] = units
        buffer[14] = (dpi >> 8) & 0xff
        buffer[15] = dpi & 0xff
        buffer[16] = (dpi >> 8) & 0xff
        buffer[17] = dpi & 0xff
      }

      fs.mkdirSync(folder, { recursive: true })
      const filePath = path.join(folder, filename)
      fs.writeFileSync(filePath, buffer)
      console.log('[main] Photo saved with DPI:', dpi, filePath)
      return { path: filePath }
    } catch (err) {
      console.error('[main] Failed to save photo:', err)
      throw err
    }
  })

  // Read a local file from disk and return it as a base64 data URL.
  // Used by the renderer to re-upload an already-saved session photo
  // (e.g. from the Analytics gallery) without needing the original in-memory image.
  ipcMain.handle('read-file-as-dataurl', async (_e, filePath) => {
    try {
      if (!filePath) throw new Error('Path file kosong')
      const clean = filePath.startsWith('file://')
        ? decodeURIComponent(filePath.replace('file://', ''))
        : filePath
      const buffer = fs.readFileSync(clean)
      const ext = path.extname(clean).toLowerCase().replace('.', '') || 'jpeg'
      const mime = ext === 'jpg' ? 'jpeg' : ext
      const base64 = buffer.toString('base64')
      return { success: true, dataUrl: `data:image/${mime};base64,${base64}` }
    } catch (err) {
      console.error('[main] Failed to read file as data URL:', err)
      return { success: false, error: err.message }
    }
  })

  // Camera SDK (digiCamControl) – low-level controls
  ipcMain.handle('camera-sdk:status', async () => {
    try { return await cameraSDK.isConnected() }
    catch { return { connected: false } }
  })
  ipcMain.handle('camera-sdk:getProperty', async (_e, name) => await cameraSDK.getProperty(name))
  ipcMain.handle('camera-sdk:setProperty', async (_e, name, value) => await cameraSDK.setProperty(name, value))
  ipcMain.handle('camera-sdk:getPropertyValues', async (_e, name) => await cameraSDK.getPropertyValues(name))
  ipcMain.handle('camera-sdk:getAllProperties', async () => await cameraSDK.getAllProperties())
  ipcMain.handle('camera-sdk:capture', async (_e, outputFolder, filenameBase) =>
    await cameraSDK.capturePhoto(outputFolder, filenameBase)
  )
  ipcMain.handle('camera-sdk:start', () => cameraSDK.startDigiCamControl())
  ipcMain.handle('camera-sdk:setCaptureCardMode', (_e, enabled) => {
    cameraSDK.setCaptureCardMode(enabled)
    return { success: true, captureCardMode: enabled }
  })

  // Merged camera handlers from ipcHandlers.js
  registerCameraHandlers(ipcMain)
}

// ─────────────────────────────────────────────────────────────────────────────
//  App Lifecycle
// ─────────────────────────────────────────────────────────────────────────────
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

ipcMain.handle('gdrive:cancelConnect', () => {
  return cancelOAuthFlow();
})