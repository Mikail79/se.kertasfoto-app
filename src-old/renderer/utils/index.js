// src/renderer/utils/index.js

/**
 * Resolve a file path or URL into a usable src string.
 */
export const getImageUrl = (path) => {
  if (!path) return null;
  if (
    path.startsWith("blob:") ||
    path.startsWith("http") ||
    path.startsWith("data:")
  )
    return path;
  return `file://${path.replace(/\\/g, "/")}`;
};

/**
 * Build a filename slug based on the active event name and current timestamp.
 */
export const buildFilename = (activeEvent) => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const eventSlug = (activeEvent?.name || "photo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 30);
  return `${eventSlug}_${timestamp}`;
};

/**
 * Load an image from a src URL and return a resolved HTMLImageElement.
 */
export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * Draw a placeholder QR square on a canvas context.
 */
export const drawQRPlaceholder = (ctx, px, py, ps) => {
  ctx.fillStyle = "white";
  ctx.fillRect(px, py, ps, ps);
  ctx.fillStyle = "#1a1425";
  ctx.font = `bold ${Math.round(ps * 0.15)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("QR", px + ps / 2, py + ps / 2);
};

/**
 * Simple async task queue to prevent concurrent booth operations.
 */
export const createBoothQueue = () => {
  const queue = [];
  let processing = false;

  return async (task) => {
    queue.push(task);
    if (processing) return;
    processing = true;
    while (queue.length) {
      const job = queue.shift();
      await job();
    }
    processing = false;
  };
};

/**
 * Build a print HTML document string for a given paper size and image.
 * paper can be a string key or an object with {size, w, h}
 */
export const buildPrintDocument = (imgSrc, paper) => {
  let paperSize, paperW, paperH;
  if (typeof paper === 'string') {
    const PAPER_CSS = {
      '4x6':           { size: '4in 6in',           w: '4in', h: '6in' },
      '4x6_portrait':  { size: '4in 6in',           w: '4in', h: '6in' },
      '4x6_landscape': { size: '6in 4in landscape', w: '6in', h: '4in' },
      '6x4':           { size: '6in 4in landscape', w: '6in', h: '4in' },
      '5x7':           { size: '5in 7in',           w: '5in', h: '7in' },
      '6x8':           { size: '6in 8in',           w: '6in', h: '8in' },
      '2x6_strip':     { size: '2in 6in',           w: '2in', h: '6in' },
      '4x4':           { size: '4in 4in',           w: '4in', h: '4in' },
      '6x9':           { size: '6in 9in',           w: '6in', h: '9in' },
    };
    const p = PAPER_CSS[paper] || PAPER_CSS['4x6'];
    paperSize = p.size;
    paperW = p.w;
    paperH = p.h;
  } else {
    paperSize = paper.size;
    paperW = paper.w;
    paperH = paper.h;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <title>Print</title>
  <style>
    @page { size: ${paperSize}; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${paperW}; height: ${paperH}; overflow: hidden; background: white; }
    .wrap { width: ${paperW}; height: ${paperH}; display: flex; align-items: center; justify-content: center; }
    img { display: block; width: ${paperW}; height: ${paperH}; object-fit: fill; }
  </style>
</head>
<body>
  <div class="wrap"><img src="${imgSrc}" /></div>
  <script>
    var img = document.querySelector('img');
    function doPrint() { window.print(); setTimeout(function(){ window.close(); }, 1500); }
    if (img.complete) { setTimeout(doPrint, 300); }
    else { img.onload = function(){ setTimeout(doPrint, 300); }; img.onerror = function(){ setTimeout(doPrint, 300); }; }
  </script>
</body>
</html>`;
};