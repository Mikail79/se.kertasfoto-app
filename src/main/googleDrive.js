import { BrowserWindow, shell, app } from 'electron'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import http from 'http'

/**
 * Google Drive Module
 * Handles OAuth2 authentication and file/folder operations
 */

const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const TOKEN_PATH = path.join(app.getPath('userData'), 'gdrive-token.json')
const CREDENTIALS_PATH = path.join(app.getPath('userData'), 'gdrive-credentials.json')
const REDIRECT_PORT = 4242
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`

let oAuth2Client = null

// State untuk local OAuth server (Mencegah EADDRINUSE dan handle Cancel)
let oauthServer = null
let oauthReject = null
let oauthTimeout = null
let oauthSockets = new Set() // Pelacak koneksi

// ── Load credentials ──────────────────────────────────────────────────────────
function loadCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) return null
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8')
    const creds = JSON.parse(raw)
    const { client_secret, client_id } = creds.installed || creds.web || {}
    if (!client_id || !client_secret) return null
    return { client_id, client_secret }
  } catch {
    return null
  }
}

// ── Initialize OAuth2 client ──────────────────────────────────────────────────
function initClient() {
  const creds = loadCredentials()
  if (!creds) return null
  oAuth2Client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    REDIRECT_URI
  )

  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
      oAuth2Client.setCredentials(token)
    }
  } catch { }

  return oAuth2Client
}

// ── Check if authenticated ────────────────────────────────────────────────────
export function isAuthenticated() {
  if (!oAuth2Client) initClient()
  if (!oAuth2Client) return false
  const creds = oAuth2Client.credentials
  return !!(creds && (creds.access_token || creds.refresh_token))
}

export function hasCredentials() {
  return fs.existsSync(CREDENTIALS_PATH)
}

// ── Save credentials file from user input ────────────────────────────────────
export function saveCredentials(credentialsJson) {
  try {
    const dir = path.dirname(CREDENTIALS_PATH)
    const parsed = JSON.parse(credentialsJson)

    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(parsed, null, 2), 'utf-8')

    oAuth2Client = null
    initClient()
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ── Fungsi untuk membersihkan state server OAuth (Hanya 1 kali deklarasi) ────
function cleanupOAuthState() {
  if (oauthServer) {
    // Hancurkan semua koneksi yang sedang berjalan
    for (const socket of oauthSockets) {
      socket.destroy()
    }
    oauthSockets.clear()

    try {
      oauthServer.close()
    } catch (e) {
      // Abaikan error saat menutup server
    }
    oauthServer = null
  }
  if (oauthTimeout) {
    clearTimeout(oauthTimeout)
    oauthTimeout = null
  }
  if (oauthReject) {
    oauthReject(new Error('Dibatalkan karena sesi baru dimulai atau timeout'))
    oauthReject = null
  }
}

// ── Start OAuth2 flow ─────────────────────────────────────────────────────────
export async function startOAuthFlow() {
  if (!oAuth2Client) initClient()
  if (!oAuth2Client) throw new Error('credentials.json belum dikonfigurasi')

  // Bersihkan server lama jika masih menggantung
  cleanupOAuthState()

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })

  return new Promise((resolve, reject) => {
    oauthReject = reject

    oauthServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
        if (url.pathname !== '/oauth2callback') {
          res.end('Not found'); return
        }
        const code = url.searchParams.get('code')
        if (!code) {
          res.writeHead(400); res.end('No code')
          const tempReject = oauthReject
          oauthReject = null
          cleanupOAuthState()
          if (tempReject) tempReject(new Error('No code'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><title>se.kertasfoto</title>
          <style>
            body { font-family: system-ui; background: #1a1425; color: white;
              display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { text-align: center; }
            h2 { color: #D552A3; margin-bottom: 8px; }
            p { color: #a89bbd; }
          </style></head>
          <body><div class="box">
            <h2>✓ Berhasil terhubung ke Google Drive!</h2>
            <p>Kamu bisa menutup tab ini dan kembali ke se.kertasfoto.</p>
          </div></body></html>
        `)

        const { tokens } = await oAuth2Client.getToken(code)
        oAuth2Client.setCredentials(tokens)
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf-8')
        
        oauthReject = null 
        cleanupOAuthState()
        resolve({ success: true })
      } catch (err) {
        const tempReject = oauthReject
        oauthReject = null
        cleanupOAuthState()
        if (tempReject) tempReject(err)
      }
    })

    // Lacak semua koneksi yang masuk agar bisa dibunuh paksa
    oauthServer.on('connection', (socket) => {
      oauthSockets.add(socket)
      socket.on('close', () => {
        oauthSockets.delete(socket)
      })
    })

    // Tangani error EADDRINUSE secara spesifik
    oauthServer.on('error', (err) => {
      const tempReject = oauthReject
      oauthReject = null
      cleanupOAuthState()
      
      if (err.code === 'EADDRINUSE') {
        if (tempReject) tempReject(new Error('Port 4242 sedang digunakan. Gagal membuka server autentikasi.'))
      } else {
        if (tempReject) tempReject(err)
      }
    })

    oauthServer.listen(REDIRECT_PORT, () => {
      shell.openExternal(authUrl)
    })

    oauthTimeout = setTimeout(() => {
      const tempReject = oauthReject
      oauthReject = null
      cleanupOAuthState()
      if (tempReject) tempReject(new Error('OAuth timeout'))
    }, 180_000)
  })
}

// ── Batalkan OAuth flow dari UI ───────────────────────────────────────────────
export function cancelOAuthFlow() {
  if (oauthReject) {
    oauthReject(new Error('Dibatalkan oleh pengguna'))
    oauthReject = null 
  }
  cleanupOAuthState()
  return { success: true, message: 'Autentikasi dihentikan' }
}

// ── Disconnect / logout ───────────────────────────────────────────────────────
export function disconnectDrive() {
  try {
    if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH)
    if (oAuth2Client) oAuth2Client.credentials = {}
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ── Get Drive instance ────────────────────────────────────────────────────────
function getDrive() {
  if (!oAuth2Client) initClient()
  return google.drive({ version: 'v3', auth: oAuth2Client })
}

export async function createDriveFolder(folderName, parentFolderId = null) {
  const drive = getDrive()
  const meta = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentFolderId) meta.parents = [parentFolderId]

  const res = await drive.files.create({
    resource: meta,
    fields: 'id, name, webViewLink',
  })

  await drive.permissions.create({
    fileId: res.data.id,
    resource: { role: 'reader', type: 'anyone' },
  })

  return {
    id: res.data.id,
    name: res.data.name,
    webViewLink: res.data.webViewLink,
    shareLink: `https://drive.google.com/drive/folders/${res.data.id}`,
  }
}

export async function uploadPhoto(localFilePath, driveFolderId, filename) {
  const drive = getDrive()
  const fileStream = fs.createReadStream(localFilePath)

  const res = await drive.files.create({
    resource: {
      name: filename,
      parents: [driveFolderId],
    },
    media: {
      mimeType: filename.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/jpeg',
      body: fileStream,
    },
    fields: 'id, name, webViewLink, webContentLink',
  })

  await drive.permissions.create({
    fileId: res.data.id,
    resource: { role: 'reader', type: 'anyone' },
  })

  return {
    id: res.data.id,
    name: res.data.name,
    webViewLink: res.data.webViewLink,
    downloadLink: `https://drive.google.com/uc?export=download&id=${res.data.id}`,
    viewLink: `https://drive.google.com/file/d/${res.data.id}/view`,
  }
}

export async function updatePhoto(localFilePath, fileId, filename) {
  const drive = getDrive()
  const fileStream = fs.createReadStream(localFilePath)

  const res = await drive.files.update({
    fileId,
    resource: {
      name: filename,
    },
    media: {
      mimeType: filename.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/jpeg',
      body: fileStream,
    },
    fields: 'id, name, webViewLink, webContentLink',
  })

  return {
    id: res.data.id,
    name: res.data.name,
    webViewLink: res.data.webViewLink,
    downloadLink: `https://drive.google.com/uc?export=download&id=${res.data.id}`,
    viewLink: `https://drive.google.com/file/d/${res.data.id}/view`,
  }
}

export async function uploadPhotoFromDataUrl(dataUrl, driveFolderId, filename, tempDir) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const tempPath = path.join(tempDir, `temp_${Date.now()}_${filename}`)

  try {
    fs.mkdirSync(tempDir, { recursive: true })
    fs.writeFileSync(tempPath, buffer)
    const result = await uploadPhoto(tempPath, driveFolderId, filename)
    return result
  } finally {
    try { fs.unlinkSync(tempPath) } catch { }
  }
}

export async function updatePhotoFromDataUrl(dataUrl, fileId, filename, tempDir) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const tempPath = path.join(tempDir, `temp_${Date.now()}_${filename}`)

  try {
    fs.mkdirSync(tempDir, { recursive: true })
    fs.writeFileSync(tempPath, buffer)
    return await updatePhoto(tempPath, fileId, filename)
  } finally {
    try { fs.unlinkSync(tempPath) } catch { }
  }
}

// Initialize on module load
initClient()