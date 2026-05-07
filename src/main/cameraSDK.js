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
/**
 * Uses curl.exe because digiCamControl's webserver sends malformed 
 * duplicate Content-Length headers that Node.js's strict parser rejects.
 */
function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = `${DCC_BASE}${urlPath}`
    // Use -s (silent) and -L (follow redirects)
    exec(`curl.exe -s -L "${url}"`, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

// ── Status check ─────────────────────────────────────────────────────────────
export async function isConnected() {
  try {
    // Using slc get camera is more reliable than /api/cameras in some versions
    const res = await httpGet('/?slc=get&param1=camera')
    return { connected: !!res, cameras: res }
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
    // digiCamControl returns newline-separated values in slc list
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

export async function capturePhoto(outputFolder, filenameBase) {
  try {
    // Ensure output folder exists
    if (outputFolder) fs.mkdirSync(outputFolder, { recursive: true })

    // Get the session folder from digiCamControl where photos are saved
    let sessionFolder = await httpGet('/?slc=get&param1=session.folder').catch(() => '')
    if (!sessionFolder || sessionFolder === '-') {
       // Fallback to default path if API fails
       sessionFolder = path.join(process.env.USERPROFILE || '', 'Pictures', 'digiCamControl', 'Session1')
    }

    // Get the list of existing files before capture
    let existingFiles = new Set()
    if (fs.existsSync(sessionFolder)) {
      fs.readdirSync(sessionFolder).forEach(f => existingFiles.add(f))
    }

    // Trigger capture via digiCamControl
    const filename = filenameBase || `capture_${Date.now()}`
    await httpGet(`/?slc=capture&param1=${filename}`).catch(err => {
      console.warn('digiCamControl capture HTTP warning (ignoring):', err.message)
    })

    // Poll for the new file to appear in the session folder
    let newestFile = null
    let retries = 0
    const maxRetries = 24 // 24 * 500ms = 12 seconds timeout
    
    while (retries < maxRetries) {
      await new Promise(r => setTimeout(r, 500))
      
      if (fs.existsSync(sessionFolder)) {
        const currentFiles = fs.readdirSync(sessionFolder)
        
        // Find any file that wasn't in the folder before we started
        const newFiles = currentFiles.filter(f => !existingFiles.has(f) && (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg')))
        
        if (newFiles.length > 0) {
          // Sort by creation time just in case multiple appeared
          newFiles.sort((a, b) => {
            const statA = fs.statSync(path.join(sessionFolder, a))
            const statB = fs.statSync(path.join(sessionFolder, b))
            return statB.ctimeMs - statA.ctimeMs
          })
          
          newestFile = path.join(sessionFolder, newFiles[0])
          
          // Wait a moment for file write to complete
          await new Promise(r => setTimeout(r, 400))
          break
        }
      }
      retries++
    }

    if (newestFile && fs.existsSync(newestFile)) {
      // If output folder specified, copy file there
      if (outputFolder) {
        const ext = path.extname(newestFile)
        const destPath = path.join(outputFolder, `${filename}${ext}`)
        fs.copyFileSync(newestFile, destPath)
        return { success: true, path: destPath, originalPath: newestFile }
      }
      return { success: true, path: newestFile }
    }

    return { success: false, error: 'Capture timeout or autofocus failed. Lens cap might be on.' }
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
