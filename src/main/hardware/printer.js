import fs from 'fs'

/**
 * Print Engine for Photobooth
 * Handles physical paper dimensions and pixel-perfect scaling
 * 
 * v2: Dynamic Print Calibration
 *   - paddingMM: shrinks image inward on all sides (0–15mm)
 *   - offsetX / offsetY: shifts image center (–10 to +10mm)
 *   - scalePct: fine-tune overall scale (85–100%)
 */

export function getPrinters(parentWin) {
  return parentWin.webContents.getPrinters()
}

/**
 * @param {BrowserWindow} parentWin
 * @param {string} filePath
 * @param {string} printerName
 * @param {string} paperSize
 * @param {object} calibration
 * @param {number} calibration.paddingMM   – uniform inset in mm (default 0)
 * @param {number} calibration.offsetX     – horizontal shift in mm (default 0)
 * @param {number} calibration.offsetY     – vertical shift in mm (default 0)
 * @param {number} calibration.scalePct    – overall scale percentage (default 100)
 */
export async function printFile(parentWin, filePath, printerName, paperSize, calibration = {}) {
  const {
    paddingMM = 0,
    offsetX   = 0,
    offsetY   = 0,
    scalePct  = 100,
  } = calibration

  console.log(`[Printer] Printing "${filePath}" → printer: "${printerName}", size: ${paperSize}`)
  console.log(`[Printer] Calibration →`, { paddingMM, offsetX, offsetY, scalePct })

  return new Promise(async (resolve) => {
    const isPreview = !printerName

    // ── 1. Paper size map (microns for Electron, CSS for @page) ─────────────
    const PAPER_MAP = {
      '6x4':       { w: 152400, h: 101600, css: '6in 4in landscape', landscape: true  },
      '7x5':       { w: 177800, h: 127000, css: '7in 5in landscape', landscape: true  },
      '8x6':       { w: 203200, h: 152400, css: '8in 6in landscape', landscape: true  },
      '4x6':       { w: 101600, h: 152400, css: '4in 6in portrait',  landscape: false },
      '5x7':       { w: 127000, h: 177800, css: '5in 7in portrait',  landscape: false },
      '6x8':       { w: 152400, h: 203200, css: '6in 8in portrait',  landscape: false },
      '2x6_strip': { w:  50800, h: 152400, css: '2in 6in portrait',  landscape: false },
      '2x8_strip': { w:  50800, h: 203200, css: '2in 8in portrait',  landscape: false },
      '4x4':       { w: 101600, h: 101600, css: '4in 4in',           landscape: false },
      '3x5':       { w:  76200, h: 127000, css: '3in 5in portrait',  landscape: false },
      '6x9':       { w: 152400, h: 228600, css: '6in 9in portrait',  landscape: false },
    }
    const config = PAPER_MAP[paperSize] ?? { w: 101600, h: 152400, css: '4in 6in portrait', landscape: false }

    // ── 2. Convert local file → base64 data-URL (avoids Electron security) ──
    let src = filePath
    if (!filePath.startsWith('data:') && !filePath.startsWith('http')) {
      try {
        const cleanPath = filePath.replace(/^file:\/\//, '')
        const buffer    = fs.readFileSync(cleanPath)
        const ext       = cleanPath.split('.').pop().toLowerCase()
        src = `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${buffer.toString('base64')}`
      } catch (e) {
        console.error('[Printer] Base64 conversion failed:', e)
      }
    }

    // ── 3. Build calibration CSS ─────────────────────────────────────────────
    //
    //  Strategy:
    //    • paddingMM  → padding on the <body> → image shrinks uniformly
    //    • offsetX/Y  → translate() on the <img> → shifts without changing size
    //    • scalePct   → scale() on the <img>    → uniform zoom
    //
    //  Using flex centering so the image stays centered after translation.

    const padding   = Math.max(0, Number(paddingMM) || 0)
    const shiftX    = Number(offsetX)  || 0
    const shiftY    = Number(offsetY)  || 0
    const scale     = Math.min(100, Math.max(50, Number(scalePct) || 100)) / 100

    // CSS transform combines scale and translation (applied on top of flex centering)
    const transform = `scale(${scale}) translate(${shiftX}mm, ${shiftY}mm)`

    // ── 4. Generate print HTML ───────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: ${config.css};
      margin: 0;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: white;
      /* Calibration: uniform padding shrinks the printable area */
      padding: ${padding}mm;
      /* Center the image within the padded area */
      display: flex;
      align-items: center;
      justify-content: center;
    }

    img {
      /*
       * Fill the available area (after padding).
       * object-fit: fill stretches to exact dimensions — preserves layout intent.
       */
      width: 100%;
      height: 100%;
      object-fit: fill;
      display: block;
      /* Calibration: scale + offset shift */
      transform: ${transform};
      transform-origin: center center;
    }
  </style>
</head>
<body>
  <img src="${src}" alt="">
</body>
</html>`

    // ── 5. Write temp HTML and load into hidden BrowserWindow ────────────────
    const { BrowserWindow, app } = await import('electron')
    const path = await import('path')

    const tempDir  = path.join(app.getPath('temp'), 'se-kertasfoto-print')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const tempPath = path.join(tempDir, `print_${Date.now()}.html`)
    fs.writeFileSync(tempPath, html)

    let printWin = new BrowserWindow({
      show: false,
      width:  config.landscape ? 1200 : 800,
      height: config.landscape ?  800 : 1200,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    printWin.loadURL(`file://${tempPath.replace(/\\/g, '/')}`)

    printWin.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        // Preview mode: just show the window so user can inspect layout
        if (isPreview) {
          printWin.show()
          printWin.focus()
          resolve({ success: true, preview: true })
          return
        }

        printWin.webContents.print(
          {
            silent: true,
            deviceName: printerName,
            printBackground: true,
            color: true,
            landscape: config.landscape,
            pageSize: { width: config.w, height: config.h },
            margins: { marginType: 'none' },
            scaleFactor: 100,
          },
          (success, failureReason) => {
            console.log('[Printer] Job result:', success, failureReason || '')
            setTimeout(() => { printWin.close(); printWin = null }, 1000)
            resolve({ success, error: failureReason })
          }
        )
      }, 500) // allow renderer to finish painting
    })
  })
}