/* ==========================================================================
   TABLETOP MATERIAL: PROCEDURAL SURFACE GRAIN & INTEGRATED GRID INK (PURE)
   ========================================================================== */

import { normalizeGridConfig } from './gridGeometry.js?v=20261121a6';

let _cachedGrainUrl = '';
let _cachedGrainSize = 0;

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function periodicHash(ix, iy, period, seed = 41) {
  const px = ((ix % period) + period) % period;
  const py = ((iy % period) + period) % period;
  let n = Math.imul(px + 1, 374761393) ^ Math.imul(py + 1, 668265263) ^ Math.imul(seed + 1, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function periodicNoise(u, v, period, seed) {
  const gx = u * period;
  const gy = v * period;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const sx = smooth(gx - x0);
  const sy = smooth(gy - y0);
  const a = periodicHash(x0, y0, period, seed);
  const b = periodicHash(x0 + 1, y0, period, seed);
  const c = periodicHash(x0, y0 + 1, period, seed);
  const d = periodicHash(x0 + 1, y0 + 1, period, seed);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sy;
}

/**
 * Generates seamless monochromatic micro-grain (playmat / watercolor paper fiber)
 * centered around neutral 128 so overlay/soft-light preserves map brightness.
 */
export function generateSurfaceGrainPixels(size = 128, { amplitude = 28, seed = 41 } = {}) {
  const dim = Math.max(16, Math.min(256, Math.trunc(Number(size) || 128)));
  const amp = Math.max(4, Math.min(80, Number(amplitude) || 28));
  const data = new Uint8ClampedArray(dim * dim * 4);
  const finePeriod = Math.max(8, Math.trunc(dim / 2));
  const midPeriod = Math.max(4, Math.trunc(dim / 4));
  const weavePeriod = Math.max(4, Math.trunc(dim / 8));

  for (let y = 0; y < dim; y++) {
    const v = y / dim;
    for (let x = 0; x < dim; x++) {
      const u = x / dim;
      // Blend fine fiber noise + gentle cloth weave (smooth periodic wrap across seams)
      const fine = periodicNoise(u, v, finePeriod, seed) - 0.5;
      const mid = periodicNoise(u + 0.13, v + 0.29, midPeriod, seed + 17) - 0.5;
      const micro = periodicHash(x, y, dim, seed + 53) - 0.5;
      const weave = periodicNoise(u, v, weavePeriod, seed + 31) - 0.5;
      const combined = fine * 0.48 + mid * 0.24 + micro * 0.18 + weave * 0.10;

      const lum = clampByte(128 + combined * amp * 2.4);
      const idx = (y * dim + x) * 4;
      data[idx] = lum;
      data[idx + 1] = lum;
      data[idx + 2] = lum;
      data[idx + 3] = 255;
    }
  }
  return data;
}

/**
 * Browser helper: caches a seamless PNG data URL for the tactile board surface overlay.
 */
export function getSurfaceGrainDataUrl(size = 128) {
  if (typeof document === 'undefined') return '';
  const dim = Math.max(32, Math.min(256, Math.trunc(Number(size) || 128)));
  if (_cachedGrainUrl && _cachedGrainSize === dim) return _cachedGrainUrl;

  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const pixels = generateSurfaceGrainPixels(dim);
  const imgData = ctx.createImageData(dim, dim);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);

  try {
    _cachedGrainUrl = canvas.toDataURL('image/png');
    _cachedGrainSize = dim;
    return _cachedGrainUrl;
  } catch (_) {
    return '';
  }
}

/**
 * Resolves how grid ink blends with the underlying map surface so grid lines
 * read like printed ink rather than a floating spreadsheet overlay.
 */
export function resolveGridBlendConfig(grid, theme = 'slate') {
  const g = normalizeGridConfig(grid);
  const op = g.opacity;

  if (g.color === 'dark') {
    return {
      mixBlendMode: 'multiply',
      dualInk: false,
      darkStroke: `rgba(15, 23, 42, ${Math.min(0.85, Number((op * 1.05).toFixed(3)))})`,
      lightStroke: ''
    };
  }

  if (g.color === 'light') {
    return {
      mixBlendMode: 'screen',
      dualInk: false,
      darkStroke: '',
      lightStroke: `rgba(226, 232, 240, ${Math.min(0.85, Number((op * 0.92).toFixed(3)))})`
    };
  }

  const isLightTheme = theme === 'parchment' || theme === 'light';
  const darkAlpha = Number(Math.min(0.82, op * (isLightTheme ? 1.15 : 0.95)).toFixed(3));
  const lightAlpha = Number(Math.min(0.75, op * (isLightTheme ? 0.55 : 0.85)).toFixed(3));
  return {
    mixBlendMode: isLightTheme ? 'soft-light' : 'overlay',
    dualInk: true,
    darkStroke: `rgba(8, 13, 24, ${darkAlpha})`,
    lightStroke: `rgba(241, 245, 249, ${lightAlpha})`
  };
}

/**
 * Extracts wall & closed-door segments that cast ground contact shadows onto the map.
 * Open doors and degenerate/invalid segments are excluded.
 */
export function collectWallShadowSegments(walls = []) {
  if (!Array.isArray(walls) || walls.length === 0) return [];
  const out = [];
  for (const w of walls) {
    if (!w) continue;
    if ((w.kind === 'door' || w.kind === 'secret') && w.open) continue;
    // Closed secret doors cast full wall shadows so players cannot spot them by shadow width
    const isDoor = w.kind === 'door';
    const x1 = Number(w.x1);
    const y1 = Number(w.y1);
    const x2 = Number(w.x2);
    const y2 = Number(w.y2);
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;
    if (Math.hypot(x2 - x1, y2 - y1) < 1) continue;
    out.push({ x1, y1, x2, y2, isDoor });
  }
  return out;
}

/**
 * Builds a compact deterministic cache key for wall contact shadows so redraws
 * happen only when walls, door open states, ambient direction, map bounds, or fx mode change.
 */
export function buildWallShadowCacheKey(walls = [], ambientDir = null, enabled = true, bounds = null) {
  if (!enabled) return 'off';
  const dx = Number.isFinite(Number(ambientDir?.x)) ? Number(ambientDir.x).toFixed(2) : '-0.28';
  const dy = Number.isFinite(Number(ambientDir?.y)) ? Number(ambientDir.y).toFixed(2) : '0.36';
  const bx = bounds ? `${Math.round(bounds.x)},${Math.round(bounds.y)},${Math.round(bounds.width)},${Math.round(bounds.height)}` : '0,0,2400,1600';
  const parts = [`on|${dx},${dy}|${bx}`];
  for (const w of Array.isArray(walls) ? walls : []) {
    if (!w) continue;
    if ((w.kind === 'door' || w.kind === 'secret') && w.open) continue;
    parts.push(`${Math.round(Number(w.x1) || 0)},${Math.round(Number(w.y1) || 0)},${Math.round(Number(w.x2) || 0)},${Math.round(Number(w.y2) || 0)},${w.kind === 'door' ? 1 : 0}`);
  }
  return parts.join(';');
}

/**
 * Computes the exact centered rectangle an image occupies inside the 2400x1600
 * world coordinate space using aspect-preserving containment.
 */
export function computeActiveMapBounds(imgWidth, imgHeight, worldWidth = 2400, worldHeight = 1600) {
  const ww = Math.max(1, Number(worldWidth) || 2400);
  const wh = Math.max(1, Number(worldHeight) || 1600);
  const iw = Number(imgWidth);
  const ih = Number(imgHeight);
  if (!Number.isFinite(iw) || !Number.isFinite(ih) || iw <= 0 || ih <= 0) {
    return { x: 0, y: 0, width: ww, height: wh };
  }
  const scale = Math.min(ww / iw, wh / ih);
  const width = Math.round(iw * scale * 100) / 100;
  const height = Math.round(ih * scale * 100) / 100;
  const x = Math.round(((ww - width) / 2) * 100) / 100;
  const y = Math.round(((wh - height) / 2) * 100) / 100;
  return { x, y, width, height };
}

/**
 * Returns cinematic warm/cool lighting temperature stops for dynamic lighting:
 * deep cool indigo penumbra contrasted with warm candlelight/torchlight falloff.
 */
export function getLightingTemperaturePalette(theme = 'slate') {
  const isLightTheme = theme === 'parchment' || theme === 'light';
  const coolRgb = isLightTheme ? { r: 22, g: 38, b: 74 } : { r: 14, g: 32, b: 76 };
  const coolGlazeAlpha = isLightTheme ? 0.14 : 0.24;
  const warmCoreRgb = { r: 255, g: 228, b: 164 };

  return {
    coolRgb,
    coolGlazeAlpha,
    coolGlazeColor: `rgba(${coolRgb.r}, ${coolRgb.g}, ${coolRgb.b}, ${coolGlazeAlpha})`,
    warmCoreRgb,
    warmStops: [
      { offset: 0, color: isLightTheme ? 'rgba(255, 224, 152, 0.14)' : 'rgba(255, 228, 164, 0.17)' },
      { offset: 0.42, color: isLightTheme ? 'rgba(249, 174, 58, 0.08)' : 'rgba(251, 176, 59, 0.105)' },
      { offset: 0.78, color: isLightTheme ? 'rgba(234, 122, 36, 0.035)' : 'rgba(234, 118, 32, 0.045)' },
      { offset: 1, color: 'rgba(234, 118, 32, 0)' }
    ]
  };
}
