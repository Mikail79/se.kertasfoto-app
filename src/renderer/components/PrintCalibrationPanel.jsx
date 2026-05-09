/**
 * PrintCalibrationPanel.jsx
 * Fitur:
 *  - Pilih printer langsung dari panel
 *  - Satuan bisa diubah: mm / cm / px
 *  - Padding, offset X/Y, scale
 *  - Simpan per printer+paperSize ke DB
 *  - Uji Cetak langsung dari panel
 *
 * Props:
 *   paperSize    {string}  key ukuran kertas, e.g. '4x6'
 *   testFilePath {string=} path file foto untuk uji cetak
 *   onClose      {fn}      dipanggil saat user tutup modal
 */

import { useState, useEffect, useCallback } from 'react'

// ── Konversi antar satuan ─────────────────────────────────────────────────────
// Semua nilai disimpan dalam mm secara internal
const TO_MM   = { mm: 1,      cm: 10,     px: 0.2646 }
const FROM_MM = { mm: 1,      cm: 0.1,    px: 3.7795 }
const STEP    = { mm: 0.5,    cm: 0.05,   px: 1      }
const DEC     = { mm: 1,      cm: 2,      px: 0      }

function toDisplay(mm, unit) { return +(mm  * FROM_MM[unit]).toFixed(DEC[unit]) }
function toMM(val, unit)     { return +(val * TO_MM[unit]).toFixed(4) }

// ── Batas dalam mm ────────────────────────────────────────────────────────────
const LIMITS = {
  paddingMM: { min: 0,   max: 15  },
  offsetX:   { min: -10, max: 10  },
  offsetY:   { min: -10, max: 10  },
  scalePct:  { min: 85,  max: 100 },
}

const DEFAULTS = { paddingMM: 0, offsetX: 0, offsetY: 0, scalePct: 100 }

const storageKey = (printer, size) =>
  printer && size ? `${printer}::${size}` : null

// ── Slider row ────────────────────────────────────────────────────────────────
function SliderRow({ label, hint, fieldKey, valueMM, unit, onChange }) {
  const isScale  = fieldKey === 'scalePct'
  const lim      = LIMITS[fieldKey]
  const dispVal  = isScale ? valueMM : toDisplay(valueMM, unit)
  const dispMin  = isScale ? lim.min : toDisplay(lim.min, unit)
  const dispMax  = isScale ? lim.max : toDisplay(lim.max, unit)
  const step     = isScale ? 0.5 : STEP[unit]
  const unitLbl  = isScale ? '%' : unit
  const sign     = !isScale && valueMM > 0 ? '+' : ''

  return (
    <div style={S.sliderRow}>
      <div style={S.sliderHeader}>
        <span style={S.sliderLabel}>{label}</span>
        <span style={S.sliderValue}>{sign}{dispVal}{unitLbl}</span>
      </div>
      <input
        type="range"
        min={dispMin} max={dispMax} step={step}
        value={dispVal}
        onChange={e => {
          const raw = parseFloat(e.target.value)
          onChange(fieldKey, isScale ? raw : toMM(raw, unit))
        }}
        style={S.slider}
      />
      <div style={S.sliderMinMax}>
        <span>{dispMin}{unitLbl}</span>
        {hint && <span style={S.sliderHint}>{hint}</span>}
        <span>{dispMax}{unitLbl}</span>
      </div>
    </div>
  )
}

// ── Panel utama ───────────────────────────────────────────────────────────────
export default function PrintCalibrationPanel({ paperSize = '4x6', testFilePath, onClose }) {
  const [printers, setPrinters] = useState([])
  const [printer,  setPrinter]  = useState('')
  const [unit,     setUnit]     = useState('mm')
  const [cal,      setCal]      = useState(DEFAULTS)
  const [saving,   setSaving]   = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [status,   setStatus]   = useState('')

  // Load daftar printer saat mount
  useEffect(() => {
    if (!window.electronAPI) { setLoading(false); return }
    window.electronAPI.getPrinters()
      .then(list => {
        const names = (list || []).map(p => p.name || p)
        setPrinters(names)
        if (names.length > 0) setPrinter(names[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Load kalibrasi tersimpan saat printer / paperSize berubah
  useEffect(() => {
    const key = storageKey(printer, paperSize)
    if (!key || !window.electronAPI) { setCal(DEFAULTS); return }
    window.electronAPI.getPrinterCalibration(key)
      .then(saved => setCal(saved ? { ...DEFAULTS, ...saved } : DEFAULTS))
      .catch(() => setCal(DEFAULTS))
  }, [printer, paperSize])

  const updateField = useCallback((field, value) => {
    setCal(prev => ({ ...prev, [field]: value }))
  }, [])

  const toast = (msg, ms = 3000) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), ms)
  }

  const handleReset = () => { setCal(DEFAULTS); toast('Reset ke default.') }

  const handleSave = async () => {
    if (!printer) { toast('Pilih printer terlebih dahulu.'); return }
    setSaving(true)
    try {
      await window.electronAPI.savePrinterCalibration(storageKey(printer, paperSize), cal)
      toast('Kalibrasi disimpan!')
    } catch (err) {
      toast('Gagal: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!printer)      { toast('Pilih printer terlebih dahulu.'); return }
    if (!testFilePath) { toast('Tidak ada foto untuk uji cetak.'); return }
    setTesting(true)
    try {
      const r = await window.electronAPI.printFile(testFilePath, printer, paperSize, cal)
      toast(r?.success ? 'Uji cetak dikirim!' : ('Gagal: ' + (r?.error || '')))
    } catch (err) {
      toast('Error: ' + err.message)
    } finally {
      setTesting(false)
    }
  }

  // Mini preview
  const isLandscape = ['6x4','7x5','8x6'].includes(paperSize)
  const outerW  = isLandscape ? 110 : 74
  const outerH  = isLandscape ? 74  : 110
  const inset   = Math.round((cal.paddingMM / 15) * 18)
  const sf      = cal.scalePct / 100
  const innerW  = Math.max(4, Math.round((outerW - inset * 2) * sf))
  const innerH  = Math.max(4, Math.round((outerH - inset * 2) * sf))
  const shiftX  = Math.round((cal.offsetX / 10) * 7)
  const shiftY  = Math.round((cal.offsetY / 10) * 7)

  return (
    <div style={S.root}>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={{ fontSize: 20 }}>🖨️</span>
          <div>
            <div style={S.title}>Kalibrasi Cetak</div>
            <div style={S.subtitle}>Ukuran kertas: {paperSize}</div>
          </div>
        </div>
        <button style={S.closeBtn} onClick={onClose} title="Tutup">✕</button>
      </div>

      {/* Pilih Printer */}
      <div style={S.field}>
        <label style={S.label}>Printer</label>
        {loading ? (
          <span style={S.muted}>Memuat printer…</span>
        ) : printers.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--color-warning, #f59e0b)' }}>⚠ Tidak ada printer terdeteksi</span>
        ) : (
          <select style={S.select} value={printer} onChange={e => setPrinter(e.target.value)}>
            {printers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* Pilih Satuan */}
      <div style={S.field}>
        <label style={S.label}>Satuan</label>
        <div style={S.unitRow}>
          {['mm','cm','px'].map(u => (
            <button
              key={u}
              style={{ ...S.unitBtn, ...(unit === u ? S.unitBtnOn : {}) }}
              onClick={() => setUnit(u)}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div style={S.sliders}>
        <SliderRow label="Padding (kecilkan foto)" hint="naikkan jika tepi terpotong"
          fieldKey="paddingMM" valueMM={cal.paddingMM} unit={unit} onChange={updateField} />
        <SliderRow label="Geser horizontal" hint="← kiri  /  kanan →"
          fieldKey="offsetX" valueMM={cal.offsetX} unit={unit} onChange={updateField} />
        <SliderRow label="Geser vertikal" hint="↑ atas  /  bawah ↓"
          fieldKey="offsetY" valueMM={cal.offsetY} unit={unit} onChange={updateField} />
        <SliderRow label="Skala keseluruhan" hint="turunkan jika masih terpotong"
          fieldKey="scalePct" valueMM={cal.scalePct} unit={unit} onChange={updateField} />
      </div>

      {/* Preview */}
      <div style={S.previewWrap}>
        <span style={S.muted}>Pratinjau kalibrasi</span>
        <div style={{ ...S.previewOuter, width: outerW, height: outerH }}>
          <div style={{
            ...S.previewInner,
            width: innerW, height: innerH,
            transform: `translate(${shiftX}px,${shiftY}px)`,
          }} />
        </div>
      </div>

      {/* Status */}
      {status && <div style={S.toast}>{status}</div>}

      {/* Aksi */}
      <div style={S.actions}>
        <button style={S.btnGhost} onClick={handleReset}>↺ Reset</button>
        <button
          style={{ ...S.btnGhost, opacity: (testing || !testFilePath) ? 0.5 : 1 }}
          onClick={handleTest}
          disabled={testing || !testFilePath}
          title={!testFilePath ? 'Tidak ada foto untuk uji cetak' : ''}
        >
          {testing ? 'Mencetak…' : '🖨 Uji Cetak'}
        </button>
        <button
          style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Menyimpan…' : '💾 Simpan'}
        </button>
      </div>

      {/* Panduan */}
      <details style={S.guide}>
        <summary style={S.muted}>📖 Panduan cepat</summary>
        <ol style={S.guideList}>
          <li>Mulai semua nilai nol / 100%.</li>
          <li>Klik <strong>Uji Cetak</strong> — lihat hasilnya di kertas.</li>
          <li>Tepi terpotong → naikkan <strong>Padding</strong>.</li>
          <li>Foto miring → pakai <strong>Geser</strong>.</li>
          <li>Masih terpotong → turunkan <strong>Skala</strong>.</li>
          <li>Klik <strong>Simpan</strong> agar diingat untuk printer ini.</li>
        </ol>
      </details>
    </div>
  )
}

// ── Styles (mengikuti CSS var project) ───────────────────────────────────────
const S = {
  root: {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg, 12px)',
    padding: '18px 20px',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    width: 400,
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--color-text)' },
  subtitle: { fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
    fontSize: 16, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, lineHeight: 1,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: {
    fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  select: {
    background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md, 8px)', color: 'var(--color-text)',
    padding: '6px 10px', fontSize: 12, width: '100%', cursor: 'pointer',
  },
  muted: { fontSize: 11, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' },
  unitRow: { display: 'flex', gap: 4 },
  unitBtn: {
    flex: 1, background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md, 8px)', color: 'var(--color-text-muted)',
    fontSize: 12, fontWeight: 600, padding: '5px 0', cursor: 'pointer',
  },
  unitBtnOn: {
    background: 'var(--color-accent-muted)', border: '1px solid var(--color-accent)',
    color: 'var(--color-accent)',
  },
  sliders: { display: 'flex', flexDirection: 'column', gap: 14 },
  sliderRow: { display: 'flex', flexDirection: 'column', gap: 3 },
  sliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  sliderLabel: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  sliderValue: {
    fontSize: 13, fontWeight: 700, color: 'var(--color-accent)',
    minWidth: 52, textAlign: 'right',
  },
  slider: { width: '100%', accentColor: 'var(--color-accent)', cursor: 'pointer' },
  sliderMinMax: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)' },
  sliderHint: { color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 10 },
  previewWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  previewOuter: {
    background: 'white', border: '2px solid var(--color-border)', borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  previewInner: {
    background: 'var(--color-accent)', borderRadius: 2, opacity: 0.85,
    transition: 'all .2s ease',
  },
  toast: {
    padding: '7px 12px', background: 'var(--color-bg-overlay)',
    border: '1px solid var(--color-accent)', borderRadius: 8,
    fontSize: 12, color: 'var(--color-text)', textAlign: 'center',
  },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnPrimary: {
    background: 'var(--color-accent)', color: 'white', border: 'none',
    borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent', color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)', borderRadius: 8,
    padding: '7px 14px', fontSize: 12, cursor: 'pointer',
  },
  guide: { borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10 },
  guideList: {
    marginTop: 8, paddingLeft: 18, fontSize: 11,
    color: 'var(--color-text-muted)', lineHeight: 1.8,
  },
}