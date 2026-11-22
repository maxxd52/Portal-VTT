/* ==========================================================================
   WALL GEOMETRY: WALL KINDS, TERRAIN 2ND-HIT RAYCASTING & VERTEX MAGNET (PURE)
   ========================================================================== */

import { normalizeGridConfig } from './gridGeometry.js?v=20261121a6';

export const WALL_KINDS = Object.freeze(['wall', 'terrain', 'door', 'secret']);

export function normalizeWallKind(kind) {
  return WALL_KINDS.includes(kind) ? kind : 'wall';
}

export function isDoorKind(kind) {
  return kind === 'door' || kind === 'secret';
}

export function isWallOpenDoor(w) {
  return Boolean(w && isDoorKind(w.kind) && w.open);
}

/**
 * Redacts GM-only wall metadata for player seats: closed secret doors become
 * indistinguishable from plain solid walls; open secret doors act as open doors.
 */
export function redactWallsForPlayer(walls = []) {
  if (!Array.isArray(walls)) return [];
  return walls.map((w) => {
    if (!w) return w;
    if (w.kind === 'secret') {
      if (w.open) return { ...w, kind: 'door', open: true };
      return { ...w, kind: 'wall', open: false };
    }
    return { ...w };
  });
}

export function distToWallSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Finds the closest wall segment to (wx, wy) within maxDist.
 */
export function findWallNearPoint(walls, wx, wy, maxDist = 14, { kinds = null, includeOpenDoors = true } = {}) {
  if (!Array.isArray(walls) || walls.length === 0) return null;
  let best = null;
  let bestDist = maxDist;
  for (const w of walls) {
    if (!w) continue;
    const kind = normalizeWallKind(w.kind);
    if (kinds && !kinds.includes(kind)) continue;
    if (!includeOpenDoors && isWallOpenDoor(w)) continue;
    const d = distToWallSegment(wx, wy, w.x1, w.y1, w.x2, w.y2);
    if (d <= bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

/**
 * Resolves a wall placement point with:
 * 1) Vertex magnet to existing wall endpoints (closes corners & pillars with zero light leaks),
 * 2) Freehand exact placement when Alt is held or grid snap is disabled,
 * 3) Offset-aware half-cell grid snap otherwise.
 */
export function resolveWallDrawPoint(wx, wy, { grid = null, walls = [], freehand = false, vertexSnapPx = 14 } = {}) {
  const px = Number(wx) || 0;
  const py = Number(wy) || 0;
  const magnetR = Math.max(0, Number(vertexSnapPx) || 0);

  if (magnetR > 0 && Array.isArray(walls) && walls.length > 0) {
    let bestX = px;
    let bestY = py;
    let bestDist = magnetR;
    let hit = false;
    for (const w of walls) {
      if (!w) continue;
      const d1 = Math.hypot(px - w.x1, py - w.y1);
      if (d1 <= bestDist) {
        bestDist = d1;
        bestX = w.x1;
        bestY = w.y1;
        hit = true;
      }
      const d2 = Math.hypot(px - w.x2, py - w.y2);
      if (d2 <= bestDist) {
        bestDist = d2;
        bestX = w.x2;
        bestY = w.y2;
        hit = true;
      }
    }
    if (hit) {
      return { x: Math.round(bestX), y: Math.round(bestY), snappedTo: 'vertex' };
    }
  }

  const g = normalizeGridConfig(grid || {});
  if (freehand || g.type === 'none' || !g.snap) {
    return { x: Math.round(px), y: Math.round(py), snappedTo: 'none' };
  }

  const snapStep = g.cellSize / 2;
  const sx = Math.round((px - g.offsetX) / snapStep) * snapStep + g.offsetX;
  const sy = Math.round((py - g.offsetY) / snapStep) * snapStep + g.offsetY;
  return { x: Math.round(sx), y: Math.round(sy), snappedTo: 'grid' };
}

/**
 * Collects deduplicated ray angles toward all unique segment endpoints (±eps)
 * to avoid duplicate ray casts on shared polygon/chain corners.
 */
export function collectUniqueRayAngles(ox, oy, segments, eps = 0.00015) {
  const seen = new Set();
  const angles = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const x1 = seg.x1;
    const y1 = seg.y1;
    const k1 = `${Math.round(x1 * 10)},${Math.round(y1 * 10)}`;
    if (!seen.has(k1)) {
      seen.add(k1);
      const a1 = Math.atan2(y1 - oy, x1 - ox);
      angles.push(a1 - eps, a1, a1 + eps);
    }
    const x2 = seg.x2;
    const y2 = seg.y2;
    const k2 = `${Math.round(x2 * 10)},${Math.round(y2 * 10)}`;
    if (!seen.has(k2)) {
      seen.add(k2);
      const a2 = Math.atan2(y2 - oy, x2 - ox);
      angles.push(a2 - eps, a2, a2 + eps);
    }
  }
  return angles;
}

/**
 * Casts a single visibility ray from (ox, oy) along unit direction (dx, dy).
 * - Solid walls, closed doors, closed secret doors, and bounds block on 1st hit.
 * - Terrain/pillar walls (`kind === 'terrain'`) allow light to enter on the 1st
 *   crossing (revealing the pillar/tree itself) and block on the 2nd distinct crossing.
 */
export function castVisibilityRay(ox, oy, dx, dy, maxT, segments) {
  let solidMinT = maxT;
  let terrainTs = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const sdx = seg.x2 - seg.x1;
    const sdy = seg.y2 - seg.y1;
    const denom = dx * sdy - dy * sdx;
    if (Math.abs(denom) < 1e-9) continue;

    const qpx = seg.x1 - ox;
    const qpy = seg.y1 - oy;
    const t = (qpx * sdy - qpy * sdx) / denom;
    if (t < 0 || t >= solidMinT) continue;
    const u = (qpx * dy - qpy * dx) / denom;
    if (u < 0 || u > 1) continue;

    if (seg.kind === 'terrain') {
      if (!terrainTs) terrainTs = [t];
      else terrainTs.push(t);
    } else {
      solidMinT = t;
    }
  }

  let finalT = solidMinT;
  if (terrainTs && terrainTs.length >= 2) {
    terrainTs.sort((a, b) => a - b);
    // Deduplicate shared-corner grazes (two terrain edges meeting at nearly identical t)
    let firstT = terrainTs[0];
    for (let i = 1; i < terrainTs.length; i++) {
      const ti = terrainTs[i];
      if (ti >= solidMinT) break;
      if (ti - firstT > 2.0) {
        finalT = ti;
        break;
      }
    }
  }

  return {
    t: finalT,
    x: ox + dx * finalT,
    y: oy + dy * finalT
  };
}
