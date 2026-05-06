import http from 'http'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

/**
 * Camera SDK Module — digiCamControl Integration
 * 
 * digiCamControl is a free, open-source camera control app for Windows.
 * It supports Canon, Nikon, Sony, and many other DSLR/mirrorless cameras.
 * When running, it exposes an HTTP API on port 5513.
 * 
 * This module communicates with digiCamControl to:
 * - Control camera settings (ISO, shutter speed, aperture, WB, flash)
 * - Trigger actual shutter capture (with flash support)
 * - Download high-resolution photos directly from the camera
 */

const DCC_BASE = 'http://localhost:5513'
const TIMEOUT = 8000

// ── HTTP helper ──────────────────────────────────────────────────────────────
function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = `${DCC_BASE}${urlPath}`
    const req = http.get(url, { timeout: TIMEOUT }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data.trim())
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })
    req.on('error', (err) => reject(err))
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

// ── Status check ─────────────────────────────────────────────────────────────
export async function isConnected() {
  try {
    const res = await httpGet('/api/cameras')
    return { connected: true, cameras: res }
  } catch {
    return { connected: false, cameras: null }
  }
}

// ── Get camera property ──────────────────────────────────────────────────────
export async function getProperty(name) {
  try {
    const val = await httpGet(`/api/camera.property/${name}`)
    return { success: true, name, value: val }
  } catch (err) {
    return { success: false, name, error: err.message }
  }
}

// ── Set camera property ──────────────────────────────────────────────────────
export async function setProperty(name, value) {
  try {
    const res = await httpGet(`/api/camera.property/${name}/${encodeURIComponent(value)}`)
    return { success: true, name, value: String(value), response: res }
  } catch (err) {
    return { success: false, name, error: err.message }
  }
}

// ── Get all available values for a property ──────────────────────────────────
export async function getPropertyValues(name) {
  try {
    const res = await httpGet(`/api/camera.property.values/${name}`)
    // digiCamControl returns comma-separated values
    const values = res.split(',').map(v => v.trim()).filter(Boolean)
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
      results[p] = await httpGet(`/api/camera.property/${p}`)
    } catch {
      results[p] = null
    }
  }
  return results
}

// ── Capture photo (triggers actual shutter + flash) ──────────────────────────
export async function capturePhoto(outputFolder, filenameBase) {
  try {
    // Ensure output folder exists
    if (outputFolder) fs.mkdirSync(outputFolder, { recursive: true })

    // Trigger capture via digiCamControl
    // The photo will be saved to digiCamControl's session folder
    const filename = filenameBase || `capture_${Date.now()}`
    const res = await httpGet(`/api/session.capture/${filename}`)

    // Wait a moment for the file to be written
    await new Promise(r => setTimeout(r, 500))

    // Get the last captured file path
    const lastFile = await httpGet('/api/session.lastcapturedfile')

    if (lastFile && fs.existsSync(lastFile)) {
      // If output folder specified, copy file there
      if (outputFolder) {
        const ext = path.extname(lastFile)
        const destPath = path.join(outputFolder, `${filename}${ext}`)
        fs.copyFileSync(lastFile, destPath)
        return { success: true, path: destPath, originalPath: lastFile }
      }
      return { success: true, path: lastFile }
    }

    return { success: true, path: null, response: res }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ── Get live view image URL ──────────────────────────────────────────────────
export function getLiveViewUrl() {
  return `${DCC_BASE}/api/liveview`
}

// ── Attempt to start digiCamControl if installed ─────────────────────────────
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

  return { success: false, error: 'digiCamControl tidak ditemukan. Install dari https://digicamcontrol.com' }
}
