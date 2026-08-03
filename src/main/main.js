// main.js – Dual-window (Admin + Client) architecture
// Merged with ipcHandlers.js functionality
import { capturePhoto, toggleLiveView, getLiveViewUrl, isConnected } from './cameraSDK.js'
import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron'
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
//  Core capture logic (shared by 'take-photo' IPC and internal reuse)
//  NOTE: kept as a plain function (not only an ipcMain.handle callback) so it
//  can be invoked both from the renderer (admin) and, if ever needed, directly
//  from main without going through IPC twice.
// ─────────────────────────────────────────────────────────────────────────────
async function handleTakePhoto(options = {}) {
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
}

// ─────────────────────────────────────────────────────────────────────────────
//  Merged registerCameraHandlers from ipcHandlers.js
// ─────────────────────────────────────────────────────────────────────────────
function registerCameraHandlers(ipcMain) {
  // Camera status
  ipcMain.handle('camera-status', async () => isConnected())

  // Live view URL
  ipcMain.handle('get-liveview-url', () => getLiveViewUrl())

  // Take photo (main flow with session management) — reuses handleTakePhoto()
  ipcMain.handle('take-photo', async (_event, options = {}) => handleTakePhoto(options))

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
let adminWindow = null
let clientWindow = null
let isQuittingApp = false // guard so closing one window doesn't kill the app by accident
let clientKioskEnabled = false
// Cache of the last state BoothMode pushed, so a Client Window that opens (or
// finishes loading) slightly AFTER the broadcast was sent — a real race,
// since ipcRenderer.on() only receives events fired after it subscribes —
// still gets the current state instead of being stuck on the loading screen.
let lastSessionState = null

async function loadModules() {
  const dbMod = await import('./storage/jsonDb.js')
  db = dbMod.default
  cameraModule = await import('./hardware/camera.js')
  printerModule = await import('./hardware/printer.js')
  imageProcessor = await import('./imageProcessor.js')
  gdriveModule = await import('./googleDrive.js')
  cameraSDK = await import('./cameraSDK.js')
}

function rendererURLFor(windowRole) {
  // windowRole: 'admin' | 'client'
  if (isDev) return `http://localhost:5173/?window=${windowRole}`
  return path.join(__dirname, '../../dist/renderer/index.html')
}

function loadRendererInto(win, windowRole) {
  if (isDev) {
    win.loadURL(rendererURLFor(windowRole))
  } else {
    win.loadFile(rendererURLFor(windowRole), { query: { window: windowRole } })
  }
}

/**
 * Admin Window — Dashboard, Sidebar, CameraControl, TemplateEditor, Settings,
 * Analytics. Has access to the full electronAPI (dialogs, printer, Google
 * Drive, DB, capture pipeline).
 */
function createAdminWindow() {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()

  adminWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    x: primary.bounds.x,
    y: primary.bounds.y,
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

  loadRendererInto(adminWindow, 'admin')
  if (isDev) adminWindow.webContents.openDevTools({ mode: 'detach' })

  // Confirm before quitting: closing the admin window ends the whole app,
  // so make sure the operator meant to do that (and take the client window
  // down with it).
  adminWindow.on('close', (e) => {
    if (isQuittingApp) return
    e.preventDefault()
    dialog.showMessageBox(adminWindow, {
      type: 'question',
      buttons: ['Batal', 'Tutup Aplikasi'],
      cancelId: 0,
      defaultId: 0,
      title: 'Tutup se.kertasfoto?',
      message: 'Menutup jendela admin akan mengakhiri seluruh aplikasi, termasuk jendela client.',
    }).then(({ response }) => {
      if (response === 1) {
        isQuittingApp = true
        app.quit()
      }
    })
  })

  adminWindow.on('closed', () => { adminWindow = null })

  return adminWindow
}

/**
 * Client Window — live view + single capture button, read-only w.r.t.
 * session state (which is owned by the admin side). No dialogs, no printer,
 * no Google Drive — enforced via a dedicated preload-client.js.
 */
function createClientWindow({ displayId, kiosk = false } = {}) {
  if (clientWindow) {
    clientWindow.focus()
    return clientWindow
  }

  const displays = screen.getAllDisplays()
  const targetDisplay =
    (displayId != null && displays.find(d => d.id === displayId)) ||
    (displays.length > 1 ? displays.find(d => d.id !== screen.getPrimaryDisplay().id) : displays[0])

  clientKioskEnabled = kiosk

  clientWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    x: targetDisplay?.bounds?.x,
    y: targetDisplay?.bounds?.y,
    fullscreen: displays.length > 1 ? true : false,
    kiosk: displays.length > 1 ? kiosk : false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload-client.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
    },
  })

  loadRendererInto(clientWindow, 'client')

  // The renderer's onStateChange() subscription only receives events fired
  // AFTER it registers — if BoothMode already broadcast state before this
  // window finished loading (very likely, since both happen almost at once
  // when "Launch event" is pressed), the client would otherwise be stuck on
  // its loading screen forever. Re-send whatever we last cached once the
  // page is actually ready.
  clientWindow.webContents.on('did-finish-load', () => {
    if (lastSessionState && clientWindow && !clientWindow.isDestroyed()) {
      clientWindow.webContents.send('session:state-changed', lastSessionState)
    }
  })

  // Kiosk hardening: block devtools / fullscreen-exit shortcuts in production
  clientWindow.webContents.on('before-input-event', (event, input) => {
    if (isDev) return
    const key = (input.key || '').toUpperCase()
    if (key === 'F12' || (input.control && input.shift && key === 'I')) event.preventDefault()
    if (key === 'F11') event.preventDefault()
    if (input.alt && key === 'F4') event.preventDefault()
  })

  clientWindow.on('closed', () => {
    clientWindow = null
    if (adminWindow && !adminWindow.isDestroyed()) {
      adminWindow.webContents.send('client-window-closed')
    }
  })

  return clientWindow
}

// ─────────────────────────────────────────────────────────────────────────────
//  Unified IPC Handlers (original + merged + dual-window additions)
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
    const win = BrowserWindow.fromWebContents(event.sender) || adminWindow
    const result = await dialog.showOpenDialog(win, {
      title: 'Pilih folder simpan foto',
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Printer — always relative to the admin window (only admin has this UI)
  ipcMain.handle('printer:getList', () => printerModule.getPrinters(adminWindow))
  ipcMain.handle('printer:print', (_e, filePath, printerName, paperSize, calibration = {}) =>
    printerModule.printFile(adminWindow, filePath, printerName, paperSize, calibration)
  )
  ipcMain.handle('printer:saveCalibration', (_e, key, calibration) =>
    db.savePrinterCalibration(key, calibration)
  )
  ipcMain.handle('printer:getCalibration', (_e, key) => db.getPrinterCalibration(key))

  // Image Processing
  ipcMain.handle('image:composite', (_e, templateData, photos, outputPath) =>
    imageProcessor.compositeImage(templateData, photos, outputPath)
  )

  // Dialogs — admin-only
  ipcMain.handle('dialog:openFile', async (_e, options) => {
    const result = await dialog.showOpenDialog(adminWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      ...options,
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(adminWindow, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  // App
  ipcMain.handle('app:getPath', (_e, name) => app.getPath(name))
  ipcMain.handle('app:toggleFullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setFullScreen(!win.isFullScreen())
      return win.isFullScreen()
    }
    return false
  })
  ipcMain.handle('app:setFullscreen', (event, state) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setFullScreen(state)
      return win.isFullScreen()
    }
    return false
  })

  // ── Dual-window management (admin-only channels) ─────────────────────────
  ipcMain.handle('win:getDisplays', () => {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      bounds: d.bounds,
      isPrimary: d.id === primaryId,
    }))
  })

  ipcMain.handle('win:openClient', (_e, displayId) => {
    createClientWindow({ displayId, kiosk: clientKioskEnabled })
    return true
  })

  ipcMain.handle('win:moveClientToDisplay', (_e, displayId) => {
    if (!clientWindow) return false
    const target = screen.getAllDisplays().find(d => d.id === displayId)
    if (!target) return false
    clientWindow.setBounds(target.bounds)
    return true
  })

  ipcMain.handle('win:setClientKiosk', (_e, enabled) => {
    clientKioskEnabled = !!enabled
    if (clientWindow) clientWindow.setKiosk(!!enabled)
    return clientKioskEnabled
  })

  ipcMain.handle('win:closeClient', () => {
    if (clientWindow) clientWindow.close()
    return true
  })

  // ── Session-state sync (admin is source of truth; main just relays) ─────
  ipcMain.handle('session:push', (_e, state) => {
    lastSessionState = state
    if (clientWindow && !clientWindow.isDestroyed()) {
      clientWindow.webContents.send('session:state-changed', state)
    }
    return true
  })

  // Client pulls the current state on mount (covers the case where its
  // onStateChange subscription registers after the last push already fired).
  ipcMain.handle('session:get', () => lastSessionState)

  // Lightweight webcam-frame streaming for monitors without a DSLR/MJPEG feed
  ipcMain.handle('session:live-frame', (_e, dataUrl) => {
    if (clientWindow && !clientWindow.isDestroyed()) {
      clientWindow.webContents.send('session:live-frame', dataUrl)
    }
    return true
  })

  // client -> main -> admin: client asked to start/retake a session.
  // We do NOT duplicate the capture pipeline here — we forward the request to
  // the admin window, which owns the session/template/slot logic and already
  // calls the take-photo / camera-sdk handlers itself.
  ipcMain.handle('client:request-capture', (_e, action = 'start') => {
    if (adminWindow && !adminWindow.isDestroyed()) {
      adminWindow.webContents.send('admin:client-capture-requested', action)
      return { forwarded: true }
    }
    return { forwarded: false, error: 'Admin window not available' }
  })

  // admin -> main -> client: operator commands (retake, next-slot,
  // finish-session, show-qr, reset, ...)
  ipcMain.handle('admin:command', (_e, cmd, payload) => {
    if (clientWindow && !clientWindow.isDestroyed()) {
      clientWindow.webContents.send('admin:command', cmd, payload)
    }
    return true
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

  ipcMain.handle('gdrive:cancelConnect', () => {
    return gdriveModule.cancelOAuthFlow ? gdriveModule.cancelOAuthFlow() : { success: true }
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
  createAdminWindow()

  // If a second monitor is already attached at launch, open the client
  // window automatically on it. With a single monitor, the operator opens it
  // manually from Settings ("Pindahkan ke layar client").
  if (screen.getAllDisplays().length > 1) {
    createClientWindow({})
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createAdminWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { isQuittingApp = true })
