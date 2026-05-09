// src/renderer/constants.js

export const PHASES = {
  CHOOSE_MODE: 'choose_mode',
  CHOOSE_TPL: 'choose_tpl',
  COUNTDOWN: 'countdown',
  CAPTURING: 'capturing',
  PHOTO_PREVIEW: 'photo_preview',
  RETAKE: 'retake',
  PROCESSING: 'processing',
  UPLOADING: 'uploading',
  RESULT: 'result',
};

export const PAPER_SIZES = {
  // Landscape
  '6x4': [900, 600],
  '7x5': [1050, 750],
  '8x6': [1200, 900],
  // Portrait
  '4x6': [600, 900],
  '5x7': [750, 1050],
  '6x8': [900, 1200],
  // Strips
  '2x6_strip': [300, 900],
  '2x8_strip': [300, 1200],
  // Square & Social
  '4x4': [600, 600],
  '3x5': [450, 750],
  // Postcard
  '6x9': [900, 1350],
  // Legacy keys
  '4x6_landscape': [900, 600],
  '4x6_portrait': [600, 900],
};