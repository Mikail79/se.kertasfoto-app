import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

let _captureCardMode = false

export function setCaptureCardMode(enabled) {
  _captureCardMode = enabled
}

/**
 * Helper HTTP GET menggunakan curl.exe
 */
async function httpGet(endpoint) {
  const url = `http://localhost:5513${endpoint}`
  const { stdout } = await execAsync(`curl.exe -s -L "${url}"`)
  return stdout.trim()
}

// ── Status check ─────────────────────────────────────────────────────────────
export async function isConnected() {
  try {
    const res = await httpGet('/?slc=get&param1=camera')
    const connected = res && !res.toLowerCase().includes('no camera') && res.length > 2
    return { connected: !!connected, cameras: connected ? res : null }
  } catch {
    return { connected: false, cameras: null }
  }
}

// ── Get camera property ──────────────────────────────────────────────────────
export async function getProperty(name) {
  try {
    const val = await httpGet(`/?slc=get&param1=${name}`)
    return { success: true, name, value: val }
  } catch (err) {
    return { success: false, name, error: err.message }
  }
}

// ── Set camera property ──────────────────────────────────────────────────────
export async function setProperty(name, value) {
  try {
    const res = await httpGet(`/?slc=set&param1=${name}&param2=${encodeURIComponent(value)}`)
    return { success: true, name, value: String(value), response: res }
  } catch (err) {
    return { success: false, name, error: err.message }
  }
}

// ── Get all available values for a property ──────────────────────────────────
export async function getPropertyValues(name) {
  try {
    const res = await httpGet(`/?slc=list&param1=${name}`)
    const values = res.split('\n').map(v => v.trim()).filter(Boolean)
    return { success: true, name, values }
  } catch (err) {
    return { success: false, name, values: [], error: err.message }
  }
}

// ── Get multiple properties at once ──────────────────────────────────────────
export async function getAllProperties() {
  const props = ['iso', 'shutterspeed', 'aperture', 'whitebalance', 'exposurecompensation', 'compressionsetting']
  const results = {}
  for (const p of props) {
    try {
      results[p] = await httpGet(`/?slc=get&param1=${p}`)
    } catch {
      results[p] = null
    }
  }
  return results
}

// ── Toggle Live View ──────────────────────────────────────────────────────────
export async function toggleLiveView(enabled) {
  // Jika pakai Capture Card, JANGAN PERNAH buka jendela Live View USB (start)
  // Tapi IZINKAN stop agar mirror bisa turun saat jepret
  if (_captureCardMode && enabled) {
    return { success: true, status: 'skipped_start_in_capture_card_mode' }
  }
  try {
    const command = enabled ? 'liveview_start' : 'liveview_stop'
    const res = await httpGet(`/?slc=${command}`)
    return { success: true, status: enabled ? 'started' : 'stopped', response: res }
  } catch (err) {
    return { success: false, status: enabled ? 'start_failed' : 'stop_failed', error: err.message }
  }
}

// ── Capture photo ─────────────────────────────────────────────────────────────
export async function capturePhoto(outputFolder, filenameBase) {
  try {
    let sessionFolder = ''
    try {
      sessionFolder = await httpGet('/?slc=get&param1=session.folder')
    } catch {
      sessionFolder = path.join(process.env.USERPROFILE || '', 'Pictures', 'digiCamControl', 'Session1')
    }
    if (!sessionFolder || sessionFolder === '-') {
      sessionFolder = path.join(process.env.USERPROFILE || '', 'Pictures', 'digiCamControl', 'Session1')
    }

    let existingFiles = new Set()
    if (fs.existsSync(sessionFolder)) {
      fs.readdirSync(sessionFolder).forEach(f => existingFiles.add(f))
    }

    const filename = filenameBase || `capture_${Date.now()}`
    
    // Perintah jepret asli arya-improve
    await httpGet(`/?slc=capture&param1=${filename}`).catch(() => { })

    // Polling 10 detik (20 x 500ms)
    let newestFile = null
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500))

      if (fs.existsSync(sessionFolder)) {
        const newFiles = fs.readdirSync(sessionFolder).filter(f =>
          !existingFiles.has(f) &&
          (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'))
        )
        if (newFiles.length > 0) {
          newFiles.sort((a, b) =>
            fs.statSync(path.join(sessionFolder, b)).ctimeMs -
            fs.statSync(path.join(sessionFolder, a)).ctimeMs
          )
          newestFile = path.join(sessionFolder, newFiles[0])
          await new Promise(r => setTimeout(r, 400))
          break
        }
      }
    }

    if (newestFile && fs.existsSync(newestFile)) {
      if (outputFolder) {
        if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true })
        const ext = path.extname(newestFile)
        const dest = path.join(outputFolder, `${filename}${ext}`)
        fs.copyFileSync(newestFile, dest)
        return { success: true, path: dest }
      }
      return { success: true, path: newestFile }
    }
    return { success: false, error: 'File jepretan tidak ditemukan di folder DCC.' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ── Live view URL ────────────────────────────────────────────────────────────
export function getLiveViewUrl() {
  return 'http://localhost:5513/liveview.jpg'
}

// ── Start DCC ────────────────────────────────────────────────────────────────
export function startDigiCamControl() {
  const possiblePaths = [
    'C:\\Program Files (x86)\\digiCamControl\\CameraControl.exe',
    'C:\\Program Files\\digiCamControl\\CameraControl.exe',
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      exec(`"${p}"`, { windowsHide: true })
      return { success: true, path: p }
    }
  }
  return { success: false, error: 'digiCamControl tidak ditemukan.' }
}