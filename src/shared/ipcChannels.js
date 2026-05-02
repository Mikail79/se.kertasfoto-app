/**
 * IPC Channel Names
 * Shared constants for Main ↔ Renderer communication
 */

export const IPC_CHANNELS = {
  // Events
  EVENTS_GET_ALL: 'events:getAll',
  EVENTS_CREATE: 'events:create',
  EVENTS_UPDATE: 'events:update',
  EVENTS_DELETE: 'events:delete',

  // Templates
  TEMPLATES_GET_ALL: 'templates:getAll',
  TEMPLATES_CREATE: 'templates:create',
  TEMPLATES_UPDATE: 'templates:update',
  TEMPLATES_DELETE: 'templates:delete',

  // Sessions
  SESSIONS_GET_ALL: 'sessions:getAll',
  SESSIONS_CREATE: 'sessions:create',
  SESSIONS_UPDATE: 'sessions:update',
  SESSIONS_DELETE: 'sessions:delete',
  SESSIONS_GET_BY_EVENT: 'sessions:getByEvent',

  // Shares
  SHARES_GET_ALL: 'shares:getAll',
  SHARES_CREATE: 'shares:create',
  SHARES_GET_BY_SESSION: 'shares:getBySession',
  SHARES_DELETE: 'shares:delete',

  // Hardware
  CAMERA_CAPTURE: 'camera:capture',
  CAMERA_GET_DEVICES: 'camera:getDevices',
  PRINTER_PRINT: 'printer:print',
  PRINTER_GET_LIST: 'printer:getList',

  // File Dialog
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',

  // Image Processing
  IMAGE_COMPOSITE: 'image:composite',

  // App
  APP_GET_PATH: 'app:getPath',
  APP_TOGGLE_FULLSCREEN: 'app:toggleFullscreen',
}
