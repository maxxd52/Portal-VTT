/* ==========================================================================
   LIGHTING MODEL: UNIDADES MÉTRICAS, VISIÓN BASE Y LUCES DE ESCENARIO (PURO)
   ========================================================================== */

import { normalizeGridConfig } from './gridGeometry.js?v=20261123a7';

export const DISTANCE_UNITS = ['m', 'ft'];
export const VISION_MODES = ['shared', 'individual'];
export const METERS_PER_FOOT = 0.3;

export const DEFAULT_VISION_CONFIG = Object.freeze({
  distanceUnit: 'm',
  defaultVisionMeters: 9,
  torchMeters: 6,
  lanternMeters: 12,
  visionMode: 'shared',
  rememberExplored: true
});

export const DEFAULT_SCENE_LIGHTING = Object.freeze({
  dynamicLighting: true,
  rememberExplored: true,
  exploredMask: '',
  exploredRev: 0
});

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
    exploredRev: Math.max(0, Math.trunc(Number(revRaw) || 0))
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
