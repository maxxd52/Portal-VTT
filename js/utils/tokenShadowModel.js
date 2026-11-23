/* ==========================================================================
   TOKEN SHADOW MODEL: PURE DUAL SHADOWS (CONTACT + WALL-OCCLUDED MAP LIGHTS)
   ========================================================================== */

import { metersToPixels, resolveTokenLightMeters } from './lightingModel.js?v=20261123a7';
import { DEFAULT_BOARD_SHADOW_DIR } from './sceneAtmosphere.js?v=20261123a7';
import { computePickupShadow } from './tabletopPhysics.js?v=20261123a7';

const FLYING_CONDITIONS = new Set(['flying', 'volando', 'levitate', 'levitating', 'airborne']);

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-7) return false;
  const qpX = cx - ax;
  const qpY = cy - ay;
  const t = (qpX * sY - qpY * sX) / denom;
  const u = (qpX * rY - qpY * rX) / denom;
  return t > 0.001 && t < 0.999 && u >= 0 && u <= 1;
}

/**
 * Checks whether any solid wall or closed door blocks line-of-sight between two board coordinates.
 */
export function hasWallOcclusion(x1, y1, x2, y2, walls) {
  if (!Array.isArray(walls) || walls.length === 0) return false;
  let terrainHits = 0;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (!w || w.kind === 'invisible') continue;
    if ((w.kind === 'door' || w.kind === 'secret') && w.open) continue;
    if (segmentsIntersect(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2)) {
      if (w.kind === 'terrain') {
        terrainHits += 1;
        if (terrainHits >= 2) return true;
        continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * Extracts active visible light emitters from an already seat-filtered visible token list.
 * Strictly ignores hidden tokens to preserve zero-leak player fog invariants.
 */
export function collectVisibleLightSources(visibleTokens, grid) {
  if (!Array.isArray(visibleTokens) || visibleTokens.length === 0) return [];
  const out = [];
  for (let i = 0; i < visibleTokens.length; i++) {
    const tok = visibleTokens[i];
    if (!tok || tok.hidden) continue;
    const lightMeters = resolveTokenLightMeters(tok);
    if (!(lightMeters > 0)) continue;
    const radiusPx = metersToPixels(lightMeters, grid);
    if (!(radiusPx > 0)) continue;
    out.push({
      id: tok.id,
      x: Number(tok.x) || 0,
      y: Number(tok.y) || 0,
      radiusPx
    });
  }
  return out;
}

/**
 * Computes the soft directional shadow projected away from the strongest visible, unoccluded map light.
 * Falls back to a subtle tabletop-lamp ambient cast shadow aligned with the 3D dice light direction.
 */
export function computeTokenCastShadow(token, lightSources, walls, opts = {}) {
  if (!token || opts.dynamicShadowsEnabled === false) {
    return { active: false };
  }

  const diameterPx = Math.max(24, Number(opts.diameterPx) || 68);
  const tx = Number(token.x) || 0;
  const ty = Number(token.y) || 0;

  let best = null;
  let bestScore = 0;

  if (Array.isArray(lightSources) && lightSources.length > 0) {
    for (let i = 0; i < lightSources.length; i++) {
      const src = lightSources[i];
      if (!src || src.id === token.id || !(src.radiusPx > 0)) continue;
      const dx = tx - src.x;
      const dy = ty - src.y;
      const dist = Math.hypot(dx, dy);
      const maxReach = src.radiusPx * 1.12;
      if (dist < 4 || dist >= maxReach) continue;
      if (hasWallOcclusion(src.x, src.y, tx, ty, walls)) continue;

      const falloff = 1 - dist / maxReach;
      const power = clamp(src.radiusPx / 240, 0.55, 1.45);
      const score = falloff * power;
      if (score > bestScore) {
        bestScore = score;
        best = { src, dx, dy, dist, falloff };
      }
    }
  }

  if (best) {
    const ux = best.dx / best.dist;
    const uy = best.dy / best.dist;
    const angleDeg = Number(((Math.atan2(uy, ux) * 180) / Math.PI).toFixed(1));
    // Closer to a torch -> slightly crisper, moderate length; keep tactically clean (< 0.42 diameter)
    const reachFactor = clamp(0.18 + (1 - best.falloff) * 0.24, 0.16, 0.42);
    const shift = diameterPx * reachFactor;
    const scaleX = Number(clamp(1.06 + (1 - best.falloff) * 0.36, 1.05, 1.44).toFixed(3));
    const scaleY = Number(clamp(0.84 - (1 - best.falloff) * 0.10, 0.72, 0.88).toFixed(3));
    const opacity = Number(clamp(0.18 + best.falloff * 0.26, 0.16, 0.44).toFixed(3));

    return {
      active: true,
      isAmbientFallback: false,
      sourceId: best.src.id,
      offsetX: Number((ux * shift).toFixed(2)),
      offsetY: Number((uy * shift).toFixed(2)),
      angleDeg,
      scaleX,
      scaleY,
      opacity
    };
  }

  // Subtle ambient directional cast shadow aligned with the shared 2D/3D tabletop lamp
  const dir = opts.ambientDir || DEFAULT_BOARD_SHADOW_DIR;
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const shift = diameterPx * 0.14;
  return {
    active: true,
    isAmbientFallback: true,
    sourceId: '',
    offsetX: Number((ux * shift).toFixed(2)),
    offsetY: Number((uy * shift).toFixed(2)),
    angleDeg: Number(((Math.atan2(uy, ux) * 180) / Math.PI).toFixed(1)),
    scaleX: 1.06,
    scaleY: 0.86,
    opacity: 0.22
  };
}

/**
 * Modulates the tight ground contact shadow for lifted or flying tokens.
 */
export function computeContactShadowModulation(token, liftPx = 0) {
  const conds = Array.isArray(token?.conditions) ? token.conditions : [];
  const isFlying = conds.some((c) => FLYING_CONDITIONS.has(String(c || '').toLowerCase()));
  const effectiveLift = Math.max(Number(liftPx) || 0, isFlying ? 7.5 : 0);
  return computePickupShadow(effectiveLift);
}

/**
 * Builds a deterministic dirty-check key so cast shadows recompute only when token, lights, or walls change.
 */
export function buildShadowCacheKey(token, lightSources, walls, dynamicShadowsEnabled) {
  const tKey = `${Math.round(Number(token?.x) || 0)},${Math.round(Number(token?.y) || 0)},${Number(token?.size) || 1},${(token?.conditions || []).join('.')}`;
  const lKey = Array.isArray(lightSources)
    ? lightSources.map((s) => `${s.id}:${Math.round(s.x)},${Math.round(s.y)},${Math.round(s.radiusPx)}`).join('|')
    : '';
  let wSig = 0;
  if (Array.isArray(walls)) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (!w) continue;
      wSig = ((wSig * 31) + Math.round(w.x1) + Math.round(w.y1) * 3 + Math.round(w.x2) * 7 + Math.round(w.y2) * 11 + (w.open ? 1 : 0)) | 0;
    }
  }
  return `${dynamicShadowsEnabled ? 1 : 0};${tKey};${lKey};${walls?.length || 0}:${wSig}`;
}

/**
 * Resolves whether dynamic light-cast shadows should run, adapting automatically to low-end / mobile devices.
 */
export function resolveDynamicShadowMode(prefMode = 'auto', env = {}) {
  const mode = String(prefMode || 'auto').toLowerCase();
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  const cores = Number(env.hardwareConcurrency) || 0;
  const mem = Number(env.deviceMemory) || 0;
  if (mem > 0 && mem <= 2) return false;
  if (cores > 0 && cores <= 4 && env.isCoarsePointer) return false;
  return true;
}
