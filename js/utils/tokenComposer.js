/* ==========================================================================
   TOKEN COMPOSER: DETECCIÓN DE TRANSPARENCIA, ENCUADRE Y MARCOS EN CANVAS 2D
   ========================================================================== */

import { DriveUrlHelper } from './driveUrlHelper.js?v=20261125a1';

export const TOKEN_OUTPUT_SIZE = 384;
export const TOKEN_OUTPUT_QUALITY = 0.86;

export const TOKEN_FRAME_STYLES = [
  { id: 'none', label: 'Original' },
  { id: 'circle', label: 'Círculo' },
  { id: 'square', label: 'Cuadrado' },
  { id: 'hex', label: 'Hexágono' }
];

export const TOKEN_FRAME_COLORS = [
  ['#d4a84f', 'Oro'],
  ['#cbd5e1', 'Plata'],
  ['#334155', 'Obsidiana'],
  ['#c27849', 'Bronce'],
  ['#f8fafc', 'Perla'],
  ['#8b5cf6', 'Violeta'],
  ['#3b82f6', 'Azul'],
  ['#06b6d4', 'Cian'],
  ['#10b981', 'Esmeralda'],
  ['#f59e0b', 'Ámbar'],
  ['#ef4444', 'Rojo'],
  ['#ec4899', 'Rosa']
];

export function getDefaultFitMode(frame) {
  return frame === 'none' ? 'contain' : 'cover';
}

export function adjustHexLuminance(hex, delta) {
  const raw = String(hex || '').trim().replace(/^#/, '');
  const expanded = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return '#8b5cf6';

  const d = Number(delta) || 0;
  const shift = (ch) => {
    const next = d >= 0 ? ch + (255 - ch) * d : ch * (1 + d);
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  const r = shift(parseInt(expanded.slice(0, 2), 16));
  const g = shift(parseInt(expanded.slice(2, 4), 16));
  const b = shift(parseInt(expanded.slice(4, 6), 16));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function getHexagonVertices(cx, cy, radius) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + i * (Math.PI / 3);
    pts.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    });
  }
  return pts;
}

/**
 * Samples a 4x4 grid inside each outer 10% corner region (64 pixels total)
 * to decide whether an uploaded image is already cut out / framed.
 */
export function detectImageTransparencyFromPixels(rgbaData, width, height) {
  const w = Math.trunc(Number(width) || 0);
  const h = Math.trunc(Number(height) || 0);
  if (!rgbaData || w < 4 || h < 4 || rgbaData.length < w * h * 4) {
    return { hasTransparentCorners: false, transparentRatio: 0, recommendedFrame: 'circle' };
  }

  let transparentCount = 0;
  const totalSamples = 64;
  const corners = [
    [0, 0.1, 0, 0.1],
    [0.9, 1, 0, 0.1],
    [0, 0.1, 0.9, 1],
    [0.9, 1, 0.9, 1]
  ];

  for (const [x0, x1, y0, y1] of corners) {
    for (let gy = 0; gy < 4; gy++) {
      const py = Math.min(h - 1, Math.max(0, Math.floor((y0 + ((gy + 0.5) / 4) * (y1 - y0)) * h)));
      for (let gx = 0; gx < 4; gx++) {
        const px = Math.min(w - 1, Math.max(0, Math.floor((x0 + ((gx + 0.5) / 4) * (x1 - x0)) * w)));
        const alpha = rgbaData[(py * w + px) * 4 + 3];
        if (alpha < 24) transparentCount += 1;
      }
    }
  }

  const transparentRatio = transparentCount / totalSamples;
  const hasTransparentCorners = transparentRatio >= 0.5;
  return {
    hasTransparentCorners,
    transparentRatio,
    recommendedFrame: hasTransparentCorners ? 'none' : 'circle'
  };
}

/**
 * Computes image draw bounds and clamped normalized pan offsets inside a square canvas.
 */
export function computeDrawTransform({
  imgWidth,
  imgHeight,
  canvasSize,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
  fitMode = 'cover'
}) {
  const iw = Math.max(1, Number(imgWidth) || 1);
  const ih = Math.max(1, Number(imgHeight) || 1);
  const size = Math.max(1, Number(canvasSize) || TOKEN_OUTPUT_SIZE);
  const clampedZoom = Math.max(0.5, Math.min(4, Number(zoom) || 1));

  const baseScale = fitMode === 'contain'
    ? Math.min(size / iw, size / ih)
    : Math.max(size / iw, size / ih);
  const drawW = iw * baseScale * clampedZoom;
  const drawH = ih * baseScale * clampedZoom;

  const maxOffsetX = Math.abs(drawW - size) / (2 * size);
  const maxOffsetY = Math.abs(drawH - size) / (2 * size);
  const clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, Number(offsetX) || 0));
  const clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, Number(offsetY) || 0));

  return {
    drawX: (size - drawW) / 2 + clampedOffsetX * size,
    drawY: (size - drawH) / 2 + clampedOffsetY * size,
    drawW,
    drawH,
    clampedOffsetX,
    clampedOffsetY,
    maxOffsetX,
    maxOffsetY,
    zoom: clampedZoom
  };
}

function traceRoundedRectPath(ctx, cx, cy, halfSize, cornerRadius) {
  const r = Math.max(0, Math.min(halfSize, cornerRadius));
  const left = cx - halfSize;
  const top = cy - halfSize;
  const right = cx + halfSize;
  const bottom = cy + halfSize;
  ctx.moveTo(left + r, top);
  ctx.lineTo(right - r, top);
  ctx.arcTo(right, top, right, top + r, r);
  ctx.lineTo(right, bottom - r);
  ctx.arcTo(right, bottom, right - r, bottom, r);
  ctx.lineTo(left + r, bottom);
  ctx.arcTo(left, bottom, left, bottom - r, r);
  ctx.lineTo(left, top + r);
  ctx.arcTo(left, top, left + r, top, r);
  ctx.closePath();
}

function traceFramePath(ctx, cx, cy, radius, shape, cornerRadius = 0) {
  ctx.beginPath();
  if (shape === 'hex') {
    const pts = getHexagonVertices(cx, cy, radius);
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  } else if (shape === 'square') {
    traceRoundedRectPath(ctx, cx, cy, radius, cornerRadius);
  } else {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
}

function strokeFrameLine(ctx, cx, cy, radius, shape, cornerRadius, strokeStyle, lineWidth) {
  traceFramePath(ctx, cx, cy, radius, shape, cornerRadius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function makeBevelGradient(ctx, cx, cy, rOuter, frameColor, stops) {
  const grad = ctx.createLinearGradient(cx - rOuter, cy - rOuter, cx + rOuter, cy + rOuter);
  for (const [offset, delta] of stops) {
    grad.addColorStop(offset, delta === 0 ? frameColor : adjustHexLuminance(frameColor, delta));
  }
  return grad;
}

const FRAME_CONFIGS = {
  circle: { shape: 'circle', rOuterRatio: 0.482, bandRatio: 0.064 },
  square: { shape: 'square', rOuterRatio: 0.468, bandRatio: 0.064, cornerRatio: 0.22 },
  hex: { shape: 'hex', rOuterRatio: 0.485, bandRatio: 0.064 }
};

export function shouldRenderTokenRim(frame) {
  return Boolean(frame && FRAME_CONFIGS[frame]);
}

export function shouldApplyRuntimeCoinRim(token) {
  return Boolean(token && !token.imageUrl);
}

export function computeTokenRimSpec(baseColor, diameterPx = 68) {
  const diam = Math.max(24, Number(diameterPx) || 68);
  const depthPx = Math.max(2, Math.min(6, Math.round(diam * 0.055)));
  return {
    depthPx,
    rimColor: adjustHexLuminance(baseColor, -0.46),
    rimDeepColor: adjustHexLuminance(baseColor, -0.68)
  };
}

export const TokenComposer = {
  detectImageTransparency(img) {
    try {
      const sampleSize = 64;
      const canvas = document.createElement('canvas');
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, sampleSize, sampleSize);
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
      return detectImageTransparencyFromPixels(data, sampleSize, sampleSize);
    } catch (_) {
      return { hasTransparentCorners: false, transparentRatio: 0, recommendedFrame: 'none', tainted: true };
    }
  },

  drawTokenComposition(ctx, img, {
    size = TOKEN_OUTPUT_SIZE,
    frame = 'none',
    frameColor = '#8b5cf6',
    zoom = 1,
    offsetX = 0,
    offsetY = 0
  } = {}) {
    ctx.clearRect(0, 0, size, size);
    const fitMode = getDefaultFitMode(frame);
    const tx = computeDrawTransform({
      imgWidth: img.naturalWidth || img.width,
      imgHeight: img.naturalHeight || img.height,
      canvasSize: size,
      zoom,
      offsetX,
      offsetY,
      fitMode
    });

    const cfg = FRAME_CONFIGS[frame];
    if (!cfg) {
      ctx.drawImage(img, tx.drawX, tx.drawY, tx.drawW, tx.drawH);
      return tx;
    }

    const rimDepth = Math.max(4, Math.round(size * 0.032));
    const cx = size / 2;
    const cy = size / 2 - rimDepth * 0.42;
    const rOuter = size * (cfg.rOuterRatio - 0.012);
    const bandW = size * cfg.bandRatio;
    const rInner = rOuter - bandW;
    const rStroke = rInner + bandW / 2;
    const outerCorner = cfg.cornerRatio ? rOuter * cfg.cornerRatio : 0;
    const cornerAt = (r) => (cfg.shape === 'square' ? Math.max(4, outerCorner - (rOuter - r)) : 0);

    // Extruded lower coin edge (2.5D thickness) for framed tokens only
    ctx.save();
    if (cfg.shape === 'hex') {
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 6;
    }
    const rimGrad = makeBevelGradient(ctx, cx, cy + rimDepth, rOuter, frameColor, [
      [0, -0.44],
      [0.5, -0.58],
      [1, -0.76]
    ]);
    traceFramePath(ctx, cx, cy + rimDepth, rOuter, cfg.shape, cornerAt(rOuter));
    ctx.fillStyle = rimGrad;
    ctx.fill();
    strokeFrameLine(ctx, cx, cy + rimDepth, rOuter, cfg.shape, cornerAt(rOuter), 'rgba(2, 6, 14, 0.78)', Math.max(1.2, size * 0.006));
    ctx.restore();

    ctx.save();
    traceFramePath(ctx, cx, cy, rInner, cfg.shape, cornerAt(rInner));
    ctx.clip();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, tx.drawX, tx.drawY - rimDepth * 0.42, tx.drawW, tx.drawH);
    const vig = ctx.createRadialGradient(cx, cy, rInner * 0.68, cx, cy, rInner * 1.15);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    ctx.save();
    if (cfg.shape === 'hex') {
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 6;
    }
    const grad = makeBevelGradient(ctx, cx, cy, rOuter, frameColor, [[0, 0.26], [0.5, 0], [1, -0.22]]);
    const strokes = [
      [rStroke, grad, bandW],
      [rOuter, 'rgba(15, 23, 42, 0.82)', Math.max(1.4, size * 0.007)],
      [rInner + size * 0.005, 'rgba(255, 255, 255, 0.36)', Math.max(1, size * 0.004)],
      [rInner, 'rgba(15, 23, 42, 0.72)', Math.max(1.2, size * 0.006)]
    ];
    for (const [r, style, width] of strokes) {
      strokeFrameLine(ctx, cx, cy, r, cfg.shape, cornerAt(r), style, width);
    }
    ctx.restore();
    return tx;
  },

  composeTokenDataUrl(img, opts = {}) {
    const size = opts.size || TOKEN_OUTPUT_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    this.drawTokenComposition(ctx, img, { ...opts, size });
    const webp = canvas.toDataURL('image/webp', opts.quality ?? TOKEN_OUTPUT_QUALITY);
    if (webp.startsWith('data:image/webp')) return webp;
    return canvas.toDataURL('image/png');
  },

  loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        reject(new Error('El archivo seleccionado no es una imagen válida.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagen no soportado.'));
        img.onload = () => resolve(img);
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const clean = DriveUrlHelper.toDirectImageUrl(url) || String(url || '').trim();
      if (!clean) {
        reject(new Error('URL de imagen vacía.'));
        return;
      }
      const img = new Image();
      if (!clean.startsWith('data:') && !clean.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onerror = () => {
        const err = new Error('No se pudo cargar la imagen desde esa URL (CORS o enlace inválido).');
        err.code = 'CORS_BLOCKED';
        reject(err);
      };
      img.onload = () => resolve(img);
      img.src = clean;
    });
  }
};
