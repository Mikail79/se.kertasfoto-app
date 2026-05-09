// src/renderer/hooks/useComposer.js
import { useCallback } from "react";
import { PAPER_SIZES } from "../constants";
import { getImageUrl, loadImage, drawQRPlaceholder } from "../utils";

export function useComposer({ activeTemplate }) {
  // Preview composition (tanpa QR, resolusi rendah)
  const composePartialPreview = useCallback(
    async (photos) => {
      console.log("[Preview] composePartialPreview called");
      console.log("[Preview] activeTemplate:", activeTemplate?.name);
      const tpl = activeTemplate;
      if (!tpl) {
        console.warn("[Preview] No activeTemplate, fallback to last photo");
        return photos[photos.length - 1] || null;
      }
      if (!tpl.photo_slots?.length) {
        console.warn("[Preview] No photo slots, fallback to last photo");
        return photos[photos.length - 1] || null;
      }

      const dims = PAPER_SIZES[tpl.paper_size] || [600, 900];
      const c = document.createElement("canvas");
      c.width = dims[0];
      c.height = dims[1];
      const ctx = c.getContext("2d");

      ctx.fillStyle = tpl.bg_color || "#1a1425";
      ctx.fillRect(0, 0, c.width, c.height);

      const drawOps = [];

      if (tpl.background_image) {
        try {
          const bg = await loadImage(getImageUrl(tpl.background_image));
          drawOps.push({
            z: tpl.bg_z_index ?? 0,
            draw: () => ctx.drawImage(bg, tpl.bg_x || 0, tpl.bg_y || 0, tpl.bg_width || dims[0], tpl.bg_height || dims[1]),
          });
        } catch (e) { console.error("Bg load error", e); }
      }

      for (let i = 0; i < tpl.photo_slots.length; i++) {
        const slot = tpl.photo_slots[i];
        const { x: sx, y: sy, width: sw, height: sh } = slot;
        const z = slot.z_index || i + 1;

        if (slot.type === "text") {
          drawOps.push({ z, draw: () => drawTextSlot(ctx, slot, sx, sy, sw, sh) });
          continue;
        }

        const pIdx = slot.photo_index !== undefined ? slot.photo_index : slot.slot - 1;
        const photoSrc = photos[pIdx];
        let img = null;
        if (photoSrc) {
          try { img = await loadImage(photoSrc); } catch (e) { console.error("Photo load error", e); }
        }
        drawOps.push({ z, draw: () => drawPhotoSlot(ctx, slot, img, sx, sy, sw, sh) });
      }

      drawOps.sort((a, b) => a.z - b.z);
      drawOps.forEach(op => op.draw());

      const dataURL = c.toDataURL("image/jpeg", 0.85);
      console.log("[Preview] dataURL generated, length:", dataURL.length);
      return dataURL;
    },
    [activeTemplate]
  );

  // Full composition with QR support
  const composeResult = useCallback(
    async (photos, scale = 1.0, qrUrlOverride = null) => {
      const tpl = activeTemplate;
      if (!tpl?.photo_slots?.length) return photos[0] || null;

      const dims = PAPER_SIZES[tpl.paper_size] || [600, 900];
      const multiplier = ((tpl.dpi || 300) / 150) * scale;
      const c = document.createElement("canvas");
      c.width = dims[0] * multiplier;
      c.height = dims[1] * multiplier;
      const ctx = c.getContext("2d");

      ctx.fillStyle = tpl.bg_color || "#1a1425";
      ctx.fillRect(0, 0, c.width, c.height);

      const drawOps = [];

      if (tpl.background_image) {
        try {
          const bg = await loadImage(getImageUrl(tpl.background_image));
          drawOps.push({
            z: tpl.bg_z_index ?? 0,
            draw: () => ctx.drawImage(bg, (tpl.bg_x || 0) * multiplier, (tpl.bg_y || 0) * multiplier, (tpl.bg_width || dims[0]) * multiplier, (tpl.bg_height || dims[1]) * multiplier),
          });
        } catch (e) { console.error("Bg load error", e); }
      }

      for (let i = 0; i < tpl.photo_slots.length; i++) {
        const slot = tpl.photo_slots[i];
        const sx = slot.x * multiplier;
        const sy = slot.y * multiplier;
        const sw = slot.width * multiplier;
        const sh = slot.height * multiplier;
        const z = slot.z_index || i + 1;

        if (slot.type === "text") {
          drawOps.push({
            z,
            draw: () => {
              ctx.save();
              ctx.translate(sx + sw / 2, sy + sh / 2);
              ctx.rotate(((slot.rotation || 0) * Math.PI) / 180);
              ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
              ctx.fillStyle = slot.font_color || "#ffffff";
              ctx.font = `${slot.font_weight || "700"} ${Math.round((slot.font_size || 40) * multiplier)}px "Plus Jakarta Sans","Inter",sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(slot.text || "", sx + sw / 2, sy + sh / 2);
              ctx.restore();
            },
          });
          continue;
        }

        const pIdx = slot.photo_index !== undefined ? slot.photo_index : slot.slot - 1;
        const photoSrc = photos[pIdx];
        if (!photoSrc) continue;
        try {
          const img = await loadImage(photoSrc);
          drawOps.push({
            z,
            draw: () => {
              const ia = img.width / img.height;
              const sa = sw / sh;
              let dx, dy, dw, dh;
              if (ia > sa) { dh = img.height; dw = dh * sa; dx = (img.width - dw) / 2; dy = 0; }
              else { dw = img.width; dh = dw / sa; dx = 0; dy = (img.height - dh) / 2; }
              ctx.save();
              ctx.translate(sx + sw / 2, sy + sh / 2);
              ctx.rotate(((slot.rotation || 0) * Math.PI) / 180);
              ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
              if (slot.bg_color && slot.bg_color !== "transparent") {
                ctx.fillStyle = slot.bg_color;
                ctx.fillRect(sx, sy, sw, sh);
              }
              ctx.drawImage(img, dx, dy, dw, dh, sx, sy, sw, sh);
              ctx.restore();
            },
          });
        } catch (e) { console.error("Photo load error", e); }
      }

      drawOps.sort((a, b) => a.z - b.z).forEach(op => op.draw());

      // QR
      if (tpl.qr_slot && qrUrlOverride) {
        const qr = tpl.qr_slot;
        const qrSize = qr.width ?? qr.size ?? 150;
        const qx = qr.x ?? 50;
        const qy = qr.y ?? 50;
        await drawRealQROnCanvas(ctx, qrUrlOverride, qx, qy, qrSize, multiplier);
      }

      return c.toDataURL(scale < 1 ? "image/png" : "image/jpeg", 0.92);
    },
    [activeTemplate]
  );

  return { composePartialPreview, composeResult };
}

// --- Drawing helpers ---
function drawTextSlot(ctx, slot, sx, sy, sw, sh) {
  ctx.save();
  ctx.translate(sx + sw / 2, sy + sh / 2);
  ctx.rotate(((slot.rotation || 0) * Math.PI) / 180);
  ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
  ctx.fillStyle = slot.font_color || "#ffffff";
  ctx.font = `${slot.font_weight || "700"} ${Math.round(slot.font_size || 40)}px "Plus Jakarta Sans","Inter",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(slot.text || "", sx + sw / 2, sy + sh / 2);
  ctx.restore();
}

function drawPhotoSlot(ctx, slot, img, sx, sy, sw, sh) {
  ctx.save();
  ctx.translate(sx + sw / 2, sy + sh / 2);
  ctx.rotate(((slot.rotation || 0) * Math.PI) / 180);
  ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
  if (!img) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
    ctx.setLineDash([]);
  } else {
    const ia = img.width / img.height;
    const sa = sw / sh;
    let dx, dy, dw, dh;
    if (ia > sa) { dh = img.height; dw = dh * sa; dx = (img.width - dw) / 2; dy = 0; }
    else { dw = img.width; dh = dw / sa; dx = 0; dy = (img.height - dh) / 2; }
    if (slot.bg_color && slot.bg_color !== "transparent") {
      ctx.fillStyle = slot.bg_color;
      ctx.fillRect(sx, sy, sw, sh);
    }
    ctx.drawImage(img, dx, dy, dw, dh, sx, sy, sw, sh);
  }
  ctx.restore();
}

async function drawRealQROnCanvas(ctx, url, x, y, size, multiplier) {
  const px = x * multiplier;
  const py = y * multiplier;
  const ps = size * multiplier;
  try {
    const { QRCodeSVG } = await import('qrcode.react');
    const React = await import('react');
    const ReactDOM = await import('react-dom/client');
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${Math.round(ps)}px`;
    document.body.appendChild(wrapper);
    const root = ReactDOM.createRoot(wrapper);
    root.render(React.createElement(QRCodeSVG, { value: url, size: Math.round(ps), bgColor: 'white', fgColor: '#1a1425', level: 'M' }));
    await new Promise(r => setTimeout(r, 50));
    const svg = wrapper.querySelector('svg');
    if (!svg) throw new Error('No SVG');
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(svgBlob);
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = objectUrl; });
    const padding = Math.round(ps * 0.12);
    ctx.fillStyle = 'white';
    ctx.fillRect(px, py, ps + padding * 2, ps + padding * 2);
    ctx.drawImage(img, px + padding, py + padding, ps, ps);
    URL.revokeObjectURL(objectUrl);
    root.unmount();
    document.body.removeChild(wrapper);
  } catch (err) {
    console.warn('QR draw error:', err);
    drawQRPlaceholder(ctx, px, py, ps);
  }
}