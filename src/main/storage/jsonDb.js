import fs from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * JSON Database Manager
 * Reads/writes events.json, templates.json, sessions.json
 * Stored in AppData/Roaming/sekertasfoto-app/data/
 */

class JsonDb {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'data')
    this._ensureDir()
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  _getFilePath(collection) {
    return path.join(this.dataDir, `${collection}.json`)
  }

  _read(collection) {
    const filePath = this._getFilePath(collection)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf-8')
      return []
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return []
    }
  }

  _write(collection, data) {
    const filePath = this._getFilePath(collection)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  savePrinterCalibration(key, calibration) {
    const data = this._read()
    if (!data.printerCalibrations) {
      data.printerCalibrations = {}
    }
    data.printerCalibrations[key] = calibration
    this._write(data)
    return { success: true }
  }
   
  getPrinterCalibration(key) {
    const data = this._read()
    return data.printerCalibrations?.[key] ?? null
  }

  // --- Events ---
  getEvents() {
    return this._read('events')
  }

  createEvent(event) {
    const events = this._read('events')
    events.push(event)
    this._write('events', events)
    return event
  }

  updateEvent(id, updates) {
    const events = this._read('events')
    const idx = events.findIndex((e) => e.id === id)
    if (idx === -1) return null
    events[idx] = { ...events[idx], ...updates }
    this._write('events', events)
    return events[idx]
  }

  deleteEvent(id) {
    let events = this._read('events')
    events = events.filter((e) => e.id !== id)
    this._write('events', events)
    return true
  }

  // --- Templates ---
  getTemplates() {
    return this._read('templates')
  }

  createTemplate(template) {
    const templates = this._read('templates')
    templates.push(template)
    this._write('templates', templates)
    return template
  }

  updateTemplate(id, updates) {
    const templates = this._read('templates')
    const idx = templates.findIndex((t) => t.id === id)
    if (idx === -1) return null
    templates[idx] = { ...templates[idx], ...updates }
    this._write('templates', templates)
    return templates[idx]
  }

  deleteTemplate(id) {
    let templates = this._read('templates')
    templates = templates.filter((t) => t.id !== id)
    this._write('templates', templates)
    return true
  }

  // --- Sessions ---
  getSessions() {
    return this._read('sessions')
  }

  getSessionsByEvent(eventId) {
    const sessions = this._read('sessions')
    return sessions.filter((s) => s.event_id === eventId)
  }

  createSession(session) {
    const sessions = this._read('sessions')
    sessions.push(session)
    this._write('sessions', sessions)
    return session
  }

  updateSession(id, updates) {
    const sessions = this._read('sessions')
    const idx = sessions.findIndex((s) => s.id === id)
    if (idx === -1) return null
    sessions[idx] = { ...sessions[idx], ...updates }
    this._write('sessions', sessions)
    return sessions[idx]
  }

  deleteSession(id) {
    let sessions = this._read('sessions')
    sessions = sessions.filter((s) => s.id !== id)
    this._write('sessions', sessions)
    return true
  }

  // --- Shares ---
  getShares() {
    return this._read('shares')
  }

  createShare(share) {
    const shares = this._read('shares')
    shares.push(share)
    this._write('shares', shares)
    return share
  }

  getSharesBySession(sessionId) {
    return this._read('shares').filter((s) => s.session_id === sessionId)
  }

  deleteShare(id) {
    let shares = this._read('shares')
    shares = shares.filter((s) => s.id !== id)
    this._write('shares', shares)
    return true
  }
}

export default new JsonDb()
