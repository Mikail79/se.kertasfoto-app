/**
 * Printer Control Module (Stub)
 * In production: uses pdf-to-printer or webContents.print()
 */

export async function getPrinters(win) {
  // Use Electron's built-in printer list
  if (win && win.webContents) {
    try {
      const printers = win.webContents.getPrintersAsync
        ? await win.webContents.getPrintersAsync()
        : []
      return printers.map((p) => ({
        name: p.name,
        isDefault: p.isDefault,
        status: p.status,
      }))
    } catch {
      return []
    }
  }
  return []
}

export async function printFile(win, filePath, printerName) {
  console.log(`[Printer] Printing ${filePath} to ${printerName}`)
  // Stub: In production, use pdf-to-printer or webContents.print()
  return { success: true, message: `Sent to ${printerName}` }
}
