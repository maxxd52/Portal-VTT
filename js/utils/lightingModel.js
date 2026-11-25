/* ==========================================================================
   LIGHTING MODEL: UNIDADES MÉTRICAS, VISIÓN BASE Y LUCES DE ESCENARIO (PURO)
   ========================================================================== */

import { normalizeGridConfig } from './gridGeometry.js?v=20261125a1';

export const DISTANCE_UNITS = ['m', 'ft'];
export const VISION_MODES = ['shared', 'individual'];
export const METERS_PER_FOOT = 0.3;
export const DARKNESS_UNLIT_AURA_METERS = 1.5;
export const NIGHT_DETECTION_METERS = 12;
export const DEFAULT_DARKVISION_METERS = 18;
export const FULL_MAP_LOS_PX = 2900;

export const AMBIENT_LIGHT_MODES = ['day', 'night', 'darkness'];

export const AMBIENT_LIGHT_META = Object.freeze([
  Object.freeze({
    id: 'day',
    label: 'Día',
    darknessAlpha: 0,
    gmDarknessAlpha: 0,
    tintColor: 'rgba(0, 0, 0, 0)',
    narrativeOverlay: 'rgba(0, 0, 0, 0)',
    requiresLight: false
  }),
  Object.freeze({
    id: 'night',
    label: 'Noche',
    darknessAlpha: 0.68,
    gmDarknessAlpha: 0.36,
    tintColor: 'rgba(15, 23, 66, 0.34)',
    narrativeOverlay: 'rgba(10, 18, 48, 0.44)',
    requiresLight: false
  }),
  Object.freeze({
    id: 'darkness',
    label: 'Oscuridad',
    darknessAlpha: 0.98,
    gmDarknessAlpha: 0.62,
    tintColor: 'rgba(4, 7, 15, 0.50)',
    narrativeOverlay: 'rgba(3, 6, 14, 0.68)',
    requiresLight: true
  })
]);

export const MAP_LIGHT_TONES = ['warm', 'neutral', 'cool', 'magic', 'danger'];

export const MAP_LIGHT_TONE_META = Object.freeze({
  warm: Object.freeze({
    id: 'warm',
    label: 'Cálida',
    color: '#f59e0b',
    hotspotRgba: 'rgba(255, 249, 224, 0.72)',
    coreRgba: 'rgba(255, 228, 164, 0.30)',
    midRgba: 'rgba(251, 176, 59, 0.16)',
    outerRgba: 'rgba(234, 118, 32, 0)'
  }),
  neutral: Object.freeze({
    id: 'neutral',
    label: 'Neutra',
    color: '#f1f5f9',
    hotspotRgba: 'rgba(255, 255, 255, 0.76)',
    coreRgba: 'rgba(241, 245, 249, 0.28)',
    midRgba: 'rgba(226, 232, 240, 0.14)',
    outerRgba: 'rgba(203, 213, 225, 0)'
  }),
  cool: Object.freeze({
    id: 'cool',
    label: 'Fría',
    color: '#38bdf8',
    hotspotRgba: 'rgba(236, 250, 255, 0.72)',
    coreRgba: 'rgba(224, 242, 254, 0.30)',
    midRgba: 'rgba(56, 189, 248, 0.16)',
    outerRgba: 'rgba(14, 116, 144, 0)'
  }),
  magic: Object.freeze({
    id: 'magic',
    label: 'Mágica',
    color: '#a855f7',
    hotspotRgba: 'rgba(250, 242, 255, 0.74)',
    coreRgba: 'rgba(243, 232, 255, 0.32)',
    midRgba: 'rgba(168, 85, 247, 0.17)',
    outerRgba: 'rgba(107, 33, 168, 0)'
  }),
  danger: Object.freeze({
    id: 'danger',
    label: 'Roja',
    color: '#ef4444',
    hotspotRgba: 'rgba(255, 228, 228, 0.72)',
    coreRgba: 'rgba(254, 202, 202, 0.30)',
    midRgba: 'rgba(239, 68, 68, 0.16)',
    outerRgba: 'rgba(185, 28, 28, 0)'
  })
});

export const MAP_LIGHT_ANIMATIONS = Object.freeze(['steady', 'flame', 'pulse', 'faulty']);

export const MAP_LIGHT_ANIMATION_META = Object.freeze({
  steady: Object.freeze({ id: 'steady', label: 'Fija' }),
  flame: Object.freeze({ id: 'flame', label: 'Llama' }),
  pulse: Object.freeze({ id: 'pulse', label: 'Pulso' }),
  faulty: Object.freeze({ id: 'faulty', label: 'Fallo' })
});

export const DEFAULT_VISION_CONFIG = Object.freeze({
  distanceUnit: 'm',
  defaultVisionMeters: 9,
  nightDetectionMeters: NIGHT_DETECTION_METERS,
  torchMeters: 6,
  lanternMeters: 12,
  visionMode: 'shared',
  rememberExplored: true
});

export const DEFAULT_SCENE_LIGHTING = Object.freeze({
  dynamicLighting: true,
  rememberExplored: true,
  exploredMask: '',
  exploredRev: 0,
  ambient: 'day'
});

export function normalizeAmbientLight(raw, fallback = 'day') {
  const clean = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (AMBIENT_LIGHT_MODES.includes(clean)) return clean;
  return AMBIENT_LIGHT_MODES.includes(fallback) ? fallback : 'day';
}

export function getAmbientLightMeta(raw) {
  const id = normalizeAmbientLight(raw, 'day');
  return AMBIENT_LIGHT_META.find((m) => m.id === id) || AMBIENT_LIGHT_META[0];
}

export function resolveAmbientShadowVector(ambientLight = 'day') {
  const id = normalizeAmbientLight(ambientLight, 'day');
  if (id === 'night') return { x: 0.34, y: -0.44 };
  if (id === 'darkness') return { x: 0, y: 0.08 };
  return { x: -0.22, y: 0.28 };
}

export function normalizeMapLightTone(raw, fallback = 'warm') {
  const clean = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (MAP_LIGHT_TONES.includes(clean)) return clean;
  return MAP_LIGHT_TONES.includes(fallback) ? fallback : 'warm';
}

export function normalizeMapLightAnimation(raw, fallback = 'steady') {
  const clean = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (MAP_LIGHT_ANIMATIONS.includes(clean)) return clean;
  return MAP_LIGHT_ANIMATIONS.includes(fallback) ? fallback : 'steady';
}

export function normalizeMapLight(raw = {}, fallbackSceneKey = '') {
  const animation = raw?.animation ? normalizeMapLightAnimation(raw.animation, 'steady') : 'steady';
  return {
    id: String(raw?.id || ''),
    sceneKey: String(raw?.sceneKey || fallbackSceneKey || ''),
    x: Number.isFinite(Number(raw?.x)) ? Number(raw.x) : 0,
    y: Number.isFinite(Number(raw?.y)) ? Number(raw.y) : 0,
    radiusMeters: clampMeters(raw?.radiusMeters, 1, 40, 9),
    tone: normalizeMapLightTone(raw?.tone, 'warm'),
    enabled: raw?.enabled !== false,
    animation,
    flicker: animation === 'flame' || (raw?.animation === undefined && raw?.flicker !== false)
  };
}

/**
 * Computes deterministic animation multipliers for a map light at timeMs.
 */
export function computeLightAnimationSample(animation = 'steady', timeMs = 0, seed = 0) {
  const mode = normalizeMapLightAnimation(animation, 'steady');
  if (mode === 'steady') {
    return { radiusScale: 1, alphaScale: 1, coreScale: 1, coreOffsetX: 0, coreOffsetY: 0 };
  }
  const t = Math.max(0, Number(timeMs) || 0) / 1000;
  const phase = (Number(seed) || 0) * 1.37;

  if (mode === 'flame') {
    const w1 = Math.sin(t * 2.6 + phase);
    const w2 = Math.sin(t * 4.9 + phase * 1.7);
    const w3 = Math.cos(t * 1.4 + phase * 0.7);
    const mix = w1 * 0.48 + w2 * 0.32 + w3 * 0.2;
    return {
      radiusScale: 1 + mix * 0.015,
      alphaScale: 0.9 + mix * 0.14,
      coreScale: 0.98 + mix * 0.16,
      coreOffsetX: Math.sin(t * 3.3 + phase) * 1.6,
      coreOffsetY: Math.cos(t * 2.7 + phase * 1.3) * 1.6
    };
  }

  if (mode === 'pulse') {
    const s = Math.sin(t * ((Math.PI * 2) / 3.2) + phase);
    return {
      radiusScale: 1 + s * 0.02,
      alphaScale: 0.84 + s * 0.22,
      coreScale: 0.95 + s * 0.24,
      coreOffsetX: 0,
      coreOffsetY: 0
    };
  }

  // 'faulty': mostly steady with crisp electrical stutters
  const cycle = (t * 0.95 + phase * 0.19) % 2.6;
  const burst =
    (cycle > 0.85 && cycle < 0.98) ||
    (cycle > 1.06 && cycle < 1.15) ||
    (cycle > 2.05 && cycle < 2.18);
  if (burst) {
    const dip = 0.18 + 0.16 * Math.abs(Math.sin(t * 34 + phase));
    return {
      radiusScale: 0.92,
      alphaScale: dip,
      coreScale: 0.18,
      coreOffsetX: 0,
      coreOffsetY: 0
    };
  }
  return { radiusScale: 1, alphaScale: 1, coreScale: 1, coreOffsetX: 0, coreOffsetY: 0 };
}

function clampMeters(raw, min, max, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(Math.max(min, Math.min(max, num)) * 100) / 100;
}

export function normalizeVisionConfig(raw = {}) {
  return {
    distanceUnit: raw?.distanceUnit === 'ft' ? 'ft' : 'm',
    defaultVisionMeters: clampMeters(raw?.defaultVisionMeters, 0, 60, DEFAULT_VISION_CONFIG.defaultVisionMeters),
    nightDetectionMeters: clampMeters(raw?.nightDetectionMeters, 0, 60, DEFAULT_VISION_CONFIG.nightDetectionMeters),
    torchMeters: clampMeters(raw?.torchMeters, 0.5, 60, DEFAULT_VISION_CONFIG.torchMeters),
    lanternMeters: clampMeters(raw?.lanternMeters, 0.5, 60, DEFAULT_VISION_CONFIG.lanternMeters),
    visionMode: raw?.visionMode === 'individual' ? 'individual' : 'shared',
    rememberExplored:
      typeof raw?.rememberExplored === 'boolean' ? raw.rememberExplored : DEFAULT_VISION_CONFIG.rememberExplored
  };
}

export function normalizeSceneLighting(raw = {}, fallback = {}) {
  const dyn =
    typeof raw?.dynamicLighting === 'boolean'
      ? raw.dynamicLighting
      : typeof fallback?.dynamicLighting === 'boolean'
        ? fallback.dynamicLighting
        : DEFAULT_SCENE_LIGHTING.dynamicLighting;
  const rem =
    typeof raw?.rememberExplored === 'boolean'
      ? raw.rememberExplored
      : typeof fallback?.rememberExplored === 'boolean'
        ? fallback.rememberExplored
        : DEFAULT_SCENE_LIGHTING.rememberExplored;
  const mask =
    typeof raw?.exploredMask === 'string'
      ? raw.exploredMask
      : typeof fallback?.exploredMask === 'string'
        ? fallback.exploredMask
        : '';
  const revRaw = raw?.exploredRev !== undefined ? raw.exploredRev : fallback?.exploredRev;
  return {
    dynamicLighting: dyn,
    rememberExplored: rem,
    exploredMask: mask,
    exploredRev: Math.max(0, Math.trunc(Number(revRaw) || 0)),
    ambient: normalizeAmbientLight(
      raw?.ambient !== undefined ? raw?.ambient : fallback?.ambient,
      DEFAULT_SCENE_LIGHTING.ambient
    )
  };
}

export function metersToDisplayValue(meters, unit = 'm') {
  const safe = Math.max(0, Number(meters) || 0);
  return unit === 'ft'
    ? Math.round((safe / METERS_PER_FOOT) * 10) / 10
    : Math.round(safe * 10) / 10;
}

export function displayValueToMeters(val, unit = 'm') {
  const safe = Math.max(0, Number(val) || 0);
  return unit === 'ft'
    ? Math.round(safe * METERS_PER_FOOT * 100) / 100
    : Math.round(safe * 100) / 100;
}

export function formatDistance(meters, unit = 'm') {
  const u = unit === 'ft' ? 'ft' : 'm';
  const v = metersToDisplayValue(meters, u);
  const numStr = Number.isInteger(v) ? String(v) : String(Number(v.toFixed(1)));
  return `${numStr} ${u}`;
}

export function metersToPixels(meters, grid) {
  const g = normalizeGridConfig(grid);
  return (Math.max(0, Number(meters) || 0) / g.metersPerUnit) * g.cellSize;
}

export function pixelsToMeters(px, grid) {
  const g = normalizeGridConfig(grid);
  return (Math.max(0, Number(px) || 0) / g.cellSize) * g.metersPerUnit;
}

export function legacyLightPxToMeters(px) {
  const n = Number(px) || 0;
  if (n <= 0) return 0;
  return n >= 300 ? 12 : 6;
}

export function getTokenEquippedLightMeters(tok) {
  const inv = Array.isArray(tok?.inventory) ? tok.inventory : [];
  let maxM = 0;
  for (const item of inv) {
    if (!item) continue;
    const m =
      item.lightMeters !== undefined && item.lightMeters !== null && Number(item.lightMeters) > 0
        ? Math.min(60, Number(item.lightMeters) || 0)
        : legacyLightPxToMeters(item.lightRadius);
    if (m > maxM) maxM = m;
  }
  return maxM;
}

export function hasExplicitTokenVision(tok) {
  return (
    tok?.visionMeters !== null &&
    tok?.visionMeters !== undefined &&
    tok?.visionMeters !== '' &&
    Number.isFinite(Number(tok.visionMeters))
  );
}

export function resolveTokenVisionMeters(tok, visionCfg) {
  if (!tok || tok.isAlly === false) return 0;
  if (hasExplicitTokenVision(tok)) {
    return Math.round(Math.max(0, Math.min(60, Number(tok.visionMeters))) * 100) / 100;
  }
  return normalizeVisionConfig(visionCfg).defaultVisionMeters;
}

export function resolveTokenLightMeters(tok) {
  if (!tok) return 0;
  let manual = 0;
  if (
    tok.lightMeters !== null &&
    tok.lightMeters !== undefined &&
    tok.lightMeters !== '' &&
    Number.isFinite(Number(tok.lightMeters))
  ) {
    manual = Math.round(Math.max(0, Math.min(60, Number(tok.lightMeters))) * 100) / 100;
  } else if (Number(tok.lightRadius) > 0) {
    manual = legacyLightPxToMeters(tok.lightRadius);
  }
  return Math.max(manual, getTokenEquippedLightMeters(tok));
}

export function resolveTokenDarkvisionMeters(tok) {
  if (!tok) return 0;
  if (
    tok.darkvisionMeters !== null &&
    tok.darkvisionMeters !== undefined &&
    tok.darkvisionMeters !== '' &&
    Number.isFinite(Number(tok.darkvisionMeters))
  ) {
    return Math.round(Math.max(0, Math.min(60, Number(tok.darkvisionMeters))) * 100) / 100;
  }
  return tok.darkvision === true ? DEFAULT_DARKVISION_METERS : 0;
}

/**
 * Resolves effective sight, clear-light, and darkvision radii (in meters)
 * for a token under the active ambient lighting mode.
 * In Day/Night, non-blinded tokens have full-map line-of-sight blocked only by walls.
 */
export function resolveEffectiveTokenVisionMeters(tok, visionCfg, ambientLight = 'day') {
  if (!tok || tok.isAlly === false) {
    return { fullMapSight: false, sightMeters: 0, clearMeters: 0, darkvisionMeters: 0 };
  }
  const isBlinded = hasExplicitTokenVision(tok) && Number(tok.visionMeters) <= 0;
  const lightMeters = resolveTokenLightMeters(tok);
  const darkvisionMeters = isBlinded ? 0 : resolveTokenDarkvisionMeters(tok);
  const fullMapSight = !isBlinded;
  const ambient = normalizeAmbientLight(ambientLight, 'day');

  if (ambient !== 'darkness') {
    const sightMeters = fullMapSight ? Math.max(60, lightMeters) : lightMeters;
    return {
      fullMapSight,
      sightMeters,
      clearMeters: sightMeters,
      darkvisionMeters: ambient === 'night' ? darkvisionMeters : 0
    };
  }

  const clearMeters = Math.max(fullMapSight ? DARKNESS_UNLIT_AURA_METERS : 0, lightMeters);
  const sightMeters = fullMapSight ? Math.max(60, lightMeters, darkvisionMeters) : lightMeters;

  return {
    fullMapSight,
    sightMeters,
    clearMeters,
    darkvisionMeters
  };
}

/**
 * Computes the Canvas 2D lighting/fog composition plan for the active scene.
 */
export function resolveCanvasLightingPlan({
  dynamicLighting = true,
  ambient = 'day',
  role = 'gm',
  hasActiveLights = false,
  showBlueprint = false,
  hasAnyDoors = false
} = {}) {
  const meta = getAmbientLightMeta(ambient);
  const isGm = role === 'gm';
  const darknessAlpha = isGm ? meta.gmDarknessAlpha : meta.darknessAlpha;
  const useDarknessMask = meta.id !== 'day';
  const shouldRender = Boolean(dynamicLighting || useDarknessMask || hasActiveLights || showBlueprint || hasAnyDoors);

  return {
    ambientId: meta.id,
    meta,
    darknessAlpha,
    useDarknessMask,
    restrictExploredToLit: meta.id === 'darkness',
    shouldRender
  };
}

/**
 * Steps a distance in meters by ±1 (or ±5 with Shift) in the active display unit ('m' or 'ft'),
 * clamping the resulting meters to [min, max].
 */
export function stepDistanceMeters(
  currentMeters,
  dir = 1,
  { unit = 'm', shiftKey = false, min = 0, max = 60 } = {}
) {
  const safeUnit = unit === 'ft' ? 'ft' : 'm';
  const curDisp = metersToDisplayValue(currentMeters, safeUnit);
  const delta = (dir < 0 ? -1 : 1) * (shiftKey ? 5 : 1);
  const nextDisp = Math.max(0, curDisp + delta);
  const nextMeters = displayValueToMeters(nextDisp, safeUnit);
  const lo = Math.max(0, Number(min) || 0);
  const hi = Math.max(lo, Number(max) || 60);
  return Math.round(Math.max(lo, Math.min(hi, nextMeters)) * 100) / 100;
}
