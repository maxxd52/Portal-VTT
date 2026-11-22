/* ==========================================================================
   FOG SHADER: TEXTURA PROCEDURAL DE NIEBLA DE GUERRA (100% OPACA Y SIN COSTURAS)
   ========================================================================== */

let _cachedMistCanvas = null;
let _cachedMistTileSize = 0;

function periodicHash(ix, iy, period, seed = 0) {
  const px = ((ix % period) + period) % period;
  const py = ((iy % period) + period) % period;
  let n = Math.imul(px + 1, 374761393) ^ Math.imul(py + 1, 668265263) ^ Math.imul(seed + 1, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function periodicValueNoise(u, v, period, seed = 0) {
  const gx = u * period;
  const gy = v * period;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const sx = fade(gx - x0);
  const sy = fade(gy - y0);
  const a = periodicHash(x0, y0, period, seed);
  const b = periodicHash(x0 + 1, y0, period, seed);
  const c = periodicHash(x0, y0 + 1, period, seed);
  const d = periodicHash(x0 + 1, y0 + 1, period, seed);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sy;
}

function periodicFbm(u, v, seed = 0) {
  return (
    periodicValueNoise(u, v, 4, seed) * 0.5 +
    periodicValueNoise(u, v, 8, seed + 3) * 0.25 +
    periodicValueNoise(u, v, 16, seed + 7) * 0.15 +
    periodicValueNoise(u, v, 32, seed + 13) * 0.1
  );
}

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/**
 * Generates seamless periodic fog-of-war mist RGBA pixel data.
 * Every pixel has alpha = 255 (strictly opaque).
 */
export function generateFogMistPixels(width = 256, height = 256) {
  const w = Math.max(16, Math.trunc(Number(width) || 256));
  const h = Math.max(16, Math.trunc(Number(height) || 256));
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    const vCoord = y / h;
    for (let x = 0; x < w; x++) {
      const uCoord = x / w;
      const wx = periodicFbm(uCoord, vCoord, 11) - 0.5;
      const wy = periodicFbm(uCoord + 0.37, vCoord + 0.61, 29) - 0.5;
      const raw = periodicFbm(uCoord + wx * 0.16, vCoord + wy * 0.16, 73);
      const norm = Math.max(0, Math.min(1, (raw - 0.18) / 0.64));
      const s = norm * norm * (3 - 2 * norm);

      let r;
      let g;
      let b;
      if (s < 0.5) {
        const k = s * 2;
        r = lerpChannel(5, 11, k);
        g = lerpChannel(7, 15, k);
        b = lerpChannel(12, 25, k);
      } else {
        const k = (s - 0.5) * 2;
        r = lerpChannel(11, 23, k);
        g = lerpChannel(15, 31, k);
        b = lerpChannel(25, 49, k);
      }

      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  return data;
}

export function getFogMistCanvas(tileSize = 512) {
  if (typeof document === 'undefined') return null;
  const size = Math.max(128, Math.trunc(Number(tileSize) || 512));
  if (_cachedMistCanvas && _cachedMistTileSize === size) return _cachedMistCanvas;

  const baseSize = 256;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = baseSize;
  srcCanvas.height = baseSize;
  const sctx = srcCanvas.getContext('2d');
  if (!sctx) return null;

  const pixels = generateFogMistPixels(baseSize, baseSize);
  const imgData = sctx.createImageData(baseSize, baseSize);
  imgData.data.set(pixels);
  sctx.putImageData(imgData, 0, 0);

  if (size === baseSize) {
    _cachedMistCanvas = srcCanvas;
    _cachedMistTileSize = size;
    return _cachedMistCanvas;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = size;
  outCanvas.height = size;
  const octx = outCanvas.getContext('2d');
  if (octx) {
    octx.imageSmoothingEnabled = true;
    octx.drawImage(srcCanvas, 0, 0, size, size);
  }
  _cachedMistCanvas = outCanvas;
  _cachedMistTileSize = size;
  return _cachedMistCanvas;
}

export function fillFogMist(ctx, width, height, { opacity = 1, tileSize = 512 } = {}) {
  if (!ctx) return;
  const alpha = Math.max(0, Math.min(1, Number(opacity)));
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  const mist = getFogMistCanvas(tileSize);
  const pattern = mist && typeof ctx.createPattern === 'function' ? ctx.createPattern(mist, 'repeat') : null;
  ctx.fillStyle = pattern || '#06080e';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
