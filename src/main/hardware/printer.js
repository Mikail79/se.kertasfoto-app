import fs from 'fs'

/**
 * Print Engine for Photobooth
 * Handles physical paper dimensions and pixel-perfect scaling
 */

export function getPrinters(parentWin) {
  return parentWin.webContents.getPrinters()
}

export async function printFile(parentWin, filePath, printerName, paperSize) {
  console.log(`[Printer] Printing ${filePath} to ${printerName} (Size: ${paperSize})`)
  
  return new Promise(async (resolve) => {
    const isPreview = !printerName

    // 1. Define dimensions in Microns (1/1000th of a mm) and CSS for the internal page
    const PAPER_MAP = {
      '6x4':       { w: 152400, h: 101600, css: '6in 4in landscape', landscape: true },
      '7x5':       { w: 177800, h: 127000, css: '7in 5in landscape', landscape: true },
      '8x6':       { w: 203200, h: 152400, css: '8in 6in landscape', landscape: true },
      '4x6':       { w: 101600, h: 152400, css: '4in 6in portrait',  landscape: false },
      '5x7':       { w: 127000, h: 177800, css: '5in 7in portrait',  landscape: false },
      '6x8':       { w: 152400, h: 203200, css: '6in 8in portrait',  landscape: false },
      '2x6_strip': { w: 50800,  h: 152400, css: '2in 6in portrait',  landscape: false },
      '2x8_strip': { w: 50800,  h: 203200, css: '2in 8in portrait',  landscape: false },
      '4x4':       { w: 101600, h: 101600, css: '4in 4in',           landscape: false },
      '3x5':       { w: 76200,  h: 127000, css: '3in 5in portrait',  landscape: false },
      '6x9':       { w: 152400, h: 228600, css: '6in 9in portrait',  landscape: false },
    }
    const config = PAPER_MAP[paperSize] || { w: 101600, h: 152400, css: '4in 6in portrait', landscape: false }

    // 2. Prepare Source Image (Convert local file to base64 to avoid security issues)
    let src = filePath
    if (filePath.startsWith('file://') || (!filePath.startsWith('data:') && !filePath.startsWith('http'))) {
      try {
        const cleanPath = filePath.replace('file://', '')
        const buffer = fs.readFileSync(cleanPath)
        const ext = cleanPath.split('.').pop()
        src = `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${buffer.toString('base64')}`
      } catch (e) {
        console.error('[Printer] Base64 conversion failed:', e)
      }
    }

    // 3. Create a Hidden Window for printing
    const { BrowserWindow, app } = await import('electron')
    let printWin = new BrowserWindow({
      show: false,
      width: config.landscape ? 1200 : 800,
      height: config.landscape ? 800 : 1200,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // 4. Generate HTML with absolute fill CSS
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { 
            size: ${config.css}; 
            margin: 0; 
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background: white;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: fill;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${src}">
      </body>
      </html>
    `

    // 5. Save to temp file and load
    const path = await import('path')
    const tempDir = path.join(app.getPath('temp'), 'se-kertasfoto-print')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const tempPath = path.join(tempDir, `print_${Date.now()}.html`)
    
    fs.writeFileSync(tempPath, html)
    printWin.loadURL(`file://${tempPath.replace(/\\/g, '/')}`)

    printWin.webContents.on('did-finish-load', () => {
      // Short delay for rendering
      setTimeout(() => {
        if (isPreview) {
          printWin.show()
          printWin.focus()
          resolve({ success: true, preview: true })
          return
        }

        printWin.webContents.print({
          silent: true,
          deviceName: printerName,
          printBackground: true,
          color: true,
          landscape: config.landscape,
          pageSize: {
            width: config.w,
            height: config.h
          },
          margins: { marginType: 'none' },
          scaleFactor: 100
        }, (success, failureReason) => {
          console.log('[Printer] Print job status:', success, failureReason || '')
          setTimeout(() => {
            printWin.close()
            printWin = null
          }, 1000)
          resolve({ success, error: failureReason })
        })
      }, 500)
    })
  })
}
