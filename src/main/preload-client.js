const { contextBridge, ipcRenderer } = require("electron");

/**
 * Client Window Preload — Bridge (minimal, restricted)
 *
 * This is intentionally a SEPARATE, much smaller surface than preload.js.
 * The client window is the visitor-facing screen: it must never get access
 * to dialogs, printer, Google Drive credentials, the JSON database, or any
 * admin/operator controls. It can only:
 *   - ask the main process to relay a capture/retake request to the admin
 *     window (the admin window owns the actual session/capture logic)
 *   - receive session-state broadcasts and live preview frames
 *   - receive operator commands broadcast from the admin window
 *   - read the DSLR live-view MJPEG URL (harmless, read-only HTTP endpoint)
 */
contextBridge.exposeInMainWorld("boothAPI", {
  /**
   * Ask the admin window to start a session or retake the current slot.
   * This does NOT duplicate the capture pipeline — main.js simply forwards
   * the request to the admin window, which reuses its existing capture logic
   * (which in turn calls the same take-photo / camera-sdk handlers).
   * @param {'start'|'retake-last'} action
   */
  requestCapture: (action = "start") => ipcRenderer.invoke("client:request-capture", action),

  /**
   * Subscribe to session-state broadcasts (phase, template, slot progress,
   * preview/result image, whether retake is allowed, etc).
   * Returns an unsubscribe function.
   */
  onStateChange: (cb) => {
    const listener = (_e, state) => cb(state);
    ipcRenderer.on("session:state-changed", listener);
    return () => ipcRenderer.removeListener("session:state-changed", listener);
  },

  /**
   * Subscribe to streamed webcam preview frames (dataURL), used as a
   * fallback live view when no DSLR/MJPEG feed is available.
   * Returns an unsubscribe function.
   */
  onLiveFrame: (cb) => {
    const listener = (_e, dataUrl) => cb(dataUrl);
    ipcRenderer.on("session:live-frame", listener);
    return () => ipcRenderer.removeListener("session:live-frame", listener);
  },

  /**
   * Subscribe to operator commands forwarded from the admin window
   * (retake, next-slot, finish-session, show-qr, reset, ...).
   * Returns an unsubscribe function.
   */
  onAdminCommand: (cb) => {
    const listener = (_e, cmd, payload) => cb(cmd, payload);
    ipcRenderer.on("admin:command", listener);
    return () => ipcRenderer.removeListener("admin:command", listener);
  },

  /**
   * Pull the current session state once (used on mount, so this window
   * doesn't get stuck waiting for the NEXT broadcast if it opened slightly
   * after the last one was sent). Returns null if the admin hasn't started
   * a session/booth mode yet.
   */
  getState: () => ipcRenderer.invoke("session:get"),

  /** Read-only: URL of the digiCamControl MJPEG live-view stream, if any. */
  getLiveViewUrl: () => ipcRenderer.invoke("get-liveview-url"),
});
