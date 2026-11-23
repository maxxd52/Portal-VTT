/* ==========================================================================
   SCENE ATMOSPHERE & CAMERA INERTIA: PURE COHESION HELPERS FOR 2D/3D TABLE
   ========================================================================== */

export const DEFAULT_DICE_SHADOW_DIR = Object.freeze({ x: -0.28, y: -0.36 });
export const DEFAULT_BOARD_SHADOW_DIR = Object.freeze({ x: -0.28, y: 0.36 });

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 5.0;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rgbToHexInt(r, g, b) {
  const cr = clamp(Math.round(r), 0, 255);
  const cg = clamp(Math.round(g), 0, 255);
  const cb = clamp(Math.round(b), 0, 255);
  return (cr << 16) | (cg << 8) | cb;
}

function mixHexWithRgb(baseHex, rgb, amount) {
  const br = (baseHex >> 16) & 255;
  const bg = (baseHex >> 8) & 255;
  const bb = baseHex & 255;
  const t = clamp(Number(amount) || 0, 0, 1);
  return rgbToHexInt(
    br + (rgb.r - br) * t,
    bg + (rgb.g - bg) * t,
    bb + (rgb.b - bb) * t
  );
}

function makePreset(palette) {
  return Object.freeze({
    ...palette,
    diceShadowDir: { ...DEFAULT_DICE_SHADOW_DIR },
    boardShadowDir: { ...DEFAULT_BOARD_SHADOW_DIR }
  });
}

export const SCENE_ATMOSPHERE_PRESETS = Object.freeze({
  tavern: makePreset({
    keyHex: 0xffe8c2,
    hemiSkyHex: 0xfff4df,
    hemiGroundHex: 0x3b2618,
    fillHex: 0xd99b52,
    rimHex: 0xfde68a
  }),
  crypt: makePreset({
    keyHex: 0xdceafe,
    hemiSkyHex: 0xcbd5e1,
    hemiGroundHex: 0x0f172a,
    fillHex: 0x60a5fa,
    rimHex: 0x93c5fd
  }),
  forest: makePreset({
    keyHex: 0xf2fbe2,
    hemiSkyHex: 0xe6f7e8,
    hemiGroundHex: 0x162b1f,
    fillHex: 0x6ee7b7,
    rimHex: 0xbef264
  }),
  arena: makePreset({
    keyHex: 0xfff0d4,
    hemiSkyHex: 0xfffbeb,
    hemiGroundHex: 0x443222,
    fillHex: 0xfbbf24,
    rimHex: 0xfde68a
  }),
  cavern: makePreset({
    keyHex: 0xdef2fe,
    hemiSkyHex: 0xcffafe,
    hemiGroundHex: 0x0d1b24,
    fillHex: 0x22d3ee,
    rimHex: 0x67e8f9
  }),
  bastion: makePreset({
    keyHex: 0xf6f8fc,
    hemiSkyHex: 0xe2e8f0,
    hemiGroundHex: 0x1e293b,
    fillHex: 0x94a3b8,
    rimHex: 0xcbd5e1
  }),
  empty: makePreset({
    keyHex: 0xfffaf0,
    hemiSkyHex: 0xf8fafc,
    hemiGroundHex: 0x1e293b,
    fillHex: 0xc4b5fd,
    rimHex: 0xe0e7ff
  })
});

/**
 * Subtly tints neutral 3D dice lighting from a sampled custom-map average RGB
 * while keeping key highlights bright enough for crisp face legibility.
 */
export function blendRgbToAtmosphere(rgb, fallbackKey = 'bastion') {
  const base = SCENE_ATMOSPHERE_PRESETS[fallbackKey] || SCENE_ATMOSPHERE_PRESETS.bastion;
  if (!rgb || typeof rgb !== 'object') return base;
  const r = Number(rgb.r);
  const g = Number(rgb.g);
  const b = Number(rgb.b);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || r < 0 || g < 0 || b < 0) {
    return base;
  }
  const clean = { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
  // Lift very dark maps slightly before mixing so fill/rim preserve color hue
  const maxCh = Math.max(clean.r, clean.g, clean.b, 1);
  const boost = maxCh < 120 ? Math.min(2.2, 130 / maxCh) : 1;
  const vivid = {
    r: clamp(clean.r * boost, 0, 255),
    g: clamp(clean.g * boost, 0, 255),
    b: clamp(clean.b * boost, 0, 255)
  };

  return {
    keyHex: mixHexWithRgb(0xfffaf2, vivid, 0.28),
    hemiSkyHex: mixHexWithRgb(0xf8fafc, vivid, 0.24),
    hemiGroundHex: mixHexWithRgb(0x161d2b, clean, 0.55),
    fillHex: mixHexWithRgb(0xb8c4dc, vivid, 0.52),
    rimHex: mixHexWithRgb(0xe2e8f0, vivid, 0.36),
    diceShadowDir: { ...DEFAULT_DICE_SHADOW_DIR },
    boardShadowDir: { ...DEFAULT_BOARD_SHADOW_DIR }
  };
}

export function resolveSceneAtmosphere(mapId, sampledRgb = null, theme = 'slate') {
  const key = String(mapId || 'bastion');
  if (key === 'custom' && sampledRgb) {
    return blendRgbToAtmosphere(sampledRgb, 'bastion');
  }
  const preset = SCENE_ATMOSPHERE_PRESETS[key] || SCENE_ATMOSPHERE_PRESETS.bastion;
  if (theme === 'parchment' || theme === 'light') {
    return {
      ...preset,
      hemiGroundHex: mixHexWithRgb(preset.hemiGroundHex, { r: 214, g: 204, b: 188 }, 0.42),
      diceShadowDir: { ...preset.diceShadowDir },
      boardShadowDir: { ...preset.boardShadowDir }
    };
  }
  return preset;
}

/**
 * Advances pan camera inertia by one frame with exponential damping.
 */
export function stepCameraInertia(vx, vy, dtSec, opts = {}) {
  const curVx = Number.isFinite(Number(vx)) ? Number(vx) : 0;
  const curVy = Number.isFinite(Number(vy)) ? Number(vy) : 0;
  const dt = Math.max(0, Math.min(0.05, Number(dtSec) || 0));
  const minSpeed = Math.max(1, Number(opts.minSpeedPxPerSec) || 18);
  const friction = Math.max(1, Number(opts.friction) || 8.5);

  const speed = Math.hypot(curVx, curVy);
  if (speed < minSpeed || dt <= 0) {
    return { dx: 0, dy: 0, vx: 0, vy: 0, done: true };
  }

  const decay = Math.exp(-friction * dt);
  const nextVx = curVx * decay;
  const nextVy = curVy * decay;
  const avgVx = (curVx + nextVx) * 0.5;
  const avgVy = (curVy + nextVy) * 0.5;
  const dx = avgVx * dt;
  const dy = avgVy * dt;

  if (Math.hypot(nextVx, nextVy) < minSpeed) {
    return { dx, dy, vx: 0, vy: 0, done: true };
  }
  return { dx, dy, vx: nextVx, vy: nextVy, done: false };
}

/**
 * Smoothly eases camera zoom toward clamped targetZoom while pinning the world point under (anchorX, anchorY).
 */
export function stepSmoothZoom(camera, targetZoom, anchorX, anchorY, dtSec, opts = {}) {
  const maxZoom = Math.max(MIN_ZOOM, Number(opts.maxZoom) || MAX_ZOOM);
  const curX = Number(camera?.x) || 0;
  const curY = Number(camera?.y) || 0;
  const curZoom = clamp(Number(camera?.zoom) || 1, MIN_ZOOM, maxZoom);
  const goal = clamp(Number(targetZoom) || curZoom, MIN_ZOOM, maxZoom);
  const dt = Math.max(0, Math.min(0.08, Number(dtSec) || 0));
  const speed = Math.max(2, Number(opts.speed) || 16);

  const alpha = dt > 0 ? 1 - Math.exp(-speed * dt) : 1;
  const diff = goal - curZoom;
  const done = Math.abs(diff) < 0.0012 || alpha >= 0.999;
  const nextZoom = done ? goal : curZoom + diff * alpha;
  const ratio = nextZoom / curZoom;

  const ax = Number(anchorX) || 0;
  const ay = Number(anchorY) || 0;
  return {
    x: ax - (ax - curX) * ratio,
    y: ay - (ay - curY) * ratio,
    zoom: nextZoom,
    done
  };
}
