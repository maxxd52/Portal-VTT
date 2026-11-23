/* ==========================================================================
   SCENE PREVIEW DRAW: RENDER VISUAL DE GRILLA, TOKEN DE PRUEBA Y LUZ EN PREVIEW
   ========================================================================== */

import { fillFogMist } from './fogShader.js?v=20261123a7';
import { drawGridOverlay, normalizeGridConfig } from './gridGeometry.js?v=20261123a7';
import { formatDistance, metersToPixels } from './lightingModel.js?v=20261123a7';

function drawWorldWalls(ctx, walls, invZoom) {
  for (const w of walls || []) {
    if (!w) continue;
    ctx.save();
    ctx.lineCap = 'round';
    if (w.kind === 'door' || w.kind === 'secret') {
      const isSecret = w.kind === 'secret';
      ctx.strokeStyle = w.open ? '#10b981' : (isSecret ? '#a855f7' : '#f59e0b');
      ctx.lineWidth = Math.max(4, 6 * invZoom);
      if (w.open) ctx.setLineDash([8 * invZoom, 8 * invZoom]);
      else if (isSecret) ctx.setLineDash([6 * invZoom, 4 * invZoom]);
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
      const mx = (w.x1 + w.x2) / 2;
      const my = (w.y1 + w.y2) / 2;
      ctx.setLineDash([]);
      ctx.fillStyle = w.open ? '#10b981' : (isSecret ? '#a855f7' : '#f59e0b');
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(5, 7 * invZoom), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = w.kind === 'terrain' ? '#34d399' : '#38bdf8';
      ctx.lineWidth = Math.max(3, 4 * invZoom);
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPreviewPill(ctx, x, y, text, color, invZoom) {
  ctx.save();
  const fontSize = Math.max(18, 22 * invZoom);
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const padX = 14 * invZoom;
  const h = fontSize + 12 * invZoom;
  const tw = ctx.measureText(text).width;
  const w = tw + padX * 2;
  const cx = Math.max(w / 2 + 12, Math.min(2400 - w / 2 - 12, x));
  const cy = Math.max(h / 2 + 12, Math.min(1600 - h / 2 - 12, y));
  const rx = cx - w / 2;
  const ry = cy - h / 2;
  const r = h / 2;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, 2 * invZoom);
  ctx.beginPath();
  ctx.roundRect(rx, ry, w, h, r);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}

function drawProbeToken(ctx, pos, diameter, invZoom, label = 'PJ') {
  const rad = Math.max(8, diameter / 2);
  ctx.save();
  ctx.fillStyle = 'rgba(139, 92, 246, 0.34)';
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = Math.max(2.5, 3.5 * invZoom);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(14, rad * 0.62)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pos.x, pos.y + 0.5);
  ctx.restore();
}

export function drawScenePreview({
  ctx,
  bgCanvas,
  img,
  grid,
  lighting,
  walls = [],
  probePos = { x: 1200, y: 800 },
  visionCfg,
  viewZoom = 1,
  viewX = 0,
  viewY = 0,
  width = 900,
  height = 600,
  theme = 'slate',
  activeTab = 'grid',
  fogPreviewCanvas = null,
  computeVisibilityPolygon = null
}) {
  if (!ctx) return;
  const g = normalizeGridConfig(grid);
  const invZoom = 1 / Math.max(1, viewZoom);
  const scale = (width / 2400) * viewZoom;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-viewX, -viewY);

  const iw = img?.naturalWidth || img?.width || 0;
  const ih = img?.naturalHeight || img?.height || 0;
  if (iw > 0 && ih > 0) {
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, 2400, 1600);
    const fit = Math.min(2400 / iw, 1600 / ih);
    const dw = iw * fit;
    const dh = ih * fit;
    ctx.drawImage(img, (2400 - dw) / 2, (1600 - dh) / 2, dw, dh);
  } else if (bgCanvas) {
    ctx.drawImage(bgCanvas, 0, 0, 2400, 1600);
  }

  drawGridOverlay(ctx, g, {
    width: 2400,
    height: 1600,
    theme,
    lineWidth: Math.max(1, 1.5 * invZoom)
  });

  const tokDiam = g.cellSize * 0.84;

  if (activeTab === 'lighting') {
    const unit = visionCfg?.distanceUnit || 'm';
    const baseMeters = Number(visionCfg?.defaultVisionMeters) || 0;
    const torchMeters = Number(visionCfg?.torchMeters) || 0;
    const visRadiusPx = metersToPixels(baseMeters, g);
    const torchRadiusPx = metersToPixels(torchMeters, g);

    if (lighting?.dynamicLighting && fogPreviewCanvas) {
      const fctx = fogPreviewCanvas.getContext('2d');
      fctx.save();
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, width, height);
      fillFogMist(fctx, width, height, { opacity: 0.9 });

      if (visRadiusPx > 0 && typeof computeVisibilityPolygon === 'function') {
        const poly = computeVisibilityPolygon(probePos, Math.max(16, visRadiusPx), walls);
        if (poly && poly.length >= 3) {
          fctx.scale(scale, scale);
          fctx.translate(-viewX, -viewY);
          fctx.globalCompositeOperation = 'destination-out';
          fctx.beginPath();
          fctx.moveTo(poly[0].x, poly[0].y);
          for (let i = 1; i < poly.length; i++) {
            fctx.lineTo(poly[i].x, poly[i].y);
          }
          fctx.closePath();
          fctx.clip();

          const grad = fctx.createRadialGradient(
            probePos.x,
            probePos.y,
            visRadiusPx * 0.18,
            probePos.x,
            probePos.y,
            visRadiusPx
          );
          grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
          grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.96)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          fctx.fillStyle = grad;
          fctx.beginPath();
          fctx.arc(probePos.x, probePos.y, visRadiusPx, 0, Math.PI * 2);
          fctx.fill();
        }
      }
      fctx.restore();

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fogPreviewCanvas, 0, 0, width, height);
      ctx.restore();
    }

    drawWorldWalls(ctx, walls, invZoom);

    if (visRadiusPx > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.85)';
      ctx.lineWidth = Math.max(2, 2.5 * invZoom);
      ctx.setLineDash([12 * invZoom, 8 * invZoom]);
      ctx.beginPath();
      ctx.arc(probePos.x, probePos.y, visRadiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const labelY = probePos.y - visRadiusPx > 80 ? probePos.y - visRadiusPx : probePos.y + visRadiusPx;
      drawPreviewPill(
        ctx,
        probePos.x,
        labelY,
        `Visión base · ${formatDistance(baseMeters, unit)}`,
        'rgba(167, 139, 250, 0.85)',
        invZoom
      );
    }

    if (torchRadiusPx > 0 && Math.abs(torchRadiusPx - visRadiusPx) > 22) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
      ctx.lineWidth = Math.max(1.5, 2 * invZoom);
      ctx.setLineDash([6 * invZoom, 8 * invZoom]);
      ctx.beginPath();
      ctx.arc(probePos.x, probePos.y, torchRadiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawPreviewPill(
        ctx,
        probePos.x,
        probePos.y + torchRadiusPx,
        `Antorcha · ${formatDistance(torchMeters, unit)}`,
        'rgba(251, 191, 36, 0.75)',
        invZoom
      );
    }

    drawProbeToken(ctx, probePos, tokDiam, invZoom, 'PJ');
  } else if (g.type === 'none') {
    const unit = visionCfg?.distanceUnit || 'm';
    drawProbeToken(ctx, probePos, tokDiam, invZoom, 'PJ');
    drawPreviewPill(
      ctx,
      probePos.x,
      probePos.y + tokDiam / 2 + 26 * invZoom,
      `1 ficha = ${formatDistance(g.metersPerUnit, unit)}`,
      'rgba(167, 139, 250, 0.78)',
      invZoom
    );
  }

  ctx.restore();
}
