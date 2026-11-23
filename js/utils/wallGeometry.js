/* ==========================================================================
   WALL GEOMETRY: WALL KINDS, TERRAIN 2ND-HIT RAYCASTING & VERTEX MAGNET (PURE)
   ========================================================================== */

import { normalizeGridConfig } from './gridGeometry.js?v=20261123a7';

export const WALL_KINDS = Object.freeze(['wall', 'terrain', 'door', 'secret', 'invisible']);

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
 * Determines whether a wall segment blocks light / line-of-sight:
 * - Invisible/grate walls and open doors let light & vision pass.
 * - Solid walls, terrain/pillars (2nd hit), and closed doors block sight.
 */
export function isWallBlockingSight(w) {
  if (!w) return false;
  const kind = normalizeWallKind(w.kind);
  if (kind === 'invisible') return false;
  if (isWallOpenDoor(w)) return false;
  return true;
}

/**
 * Resolves the visual icon state for a door ('open' | 'locked' | 'closed').
 * Anti-spoiler: players NEVER see the 'locked' padlock visually; a locked door
 * appears as a normal closed door until they attempt to open it.
 */
export function resolveDoorVisualState(door, { role = 'gm' } = {}) {
  if (!door) return 'closed';
  if (door.open) return 'open';
  if (door.locked && role === 'gm') return 'locked';
  return 'closed';
}

/**
 * Determines whether a wall segment blocks player token movement:
 * - Solid walls, closed doors (normal or locked), and closed secret doors BLOCK.
 * - Open doors (normal or secret) and terrain/pillars ALLOW passage.
 */
export function isWallBlockingMovement(w) {
  if (!w) return false;
  const kind = normalizeWallKind(w.kind);
  if (kind === 'terrain') return false;
  if (isWallOpenDoor(w)) return false;
  return true;
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
      if (w.open) return { ...w, kind: 'door', open: true, locked: false };
      return { ...w, kind: 'wall', open: false, locked: false };
    }
    return { ...w, locked: Boolean(w.locked) };
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
 * Liang-Barsky segment-vs-AABB intersection test.
 */
function segmentIntersectsBox(x1, y1, x2, y2, minX, minY, maxX, maxY) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const checks = [
    [-dx, x1 - minX],
    [dx, maxX - x1],
    [-dy, y1 - minY],
    [dy, maxY - y1]
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

/**
 * Finds all wall segments inside or intersecting a world-space selection rectangle.
 */
export function findWallsInRect(walls, rect) {
  if (!Array.isArray(walls) || walls.length === 0 || !rect) return [];
  const minX = Math.min(Number(rect.x1) || 0, Number(rect.x2) || 0);
  const maxX = Math.max(Number(rect.x1) || 0, Number(rect.x2) || 0);
  const minY = Math.min(Number(rect.y1) || 0, Number(rect.y2) || 0);
  const maxY = Math.max(Number(rect.y1) || 0, Number(rect.y2) || 0);
  return walls.filter((w) => w && segmentIntersectsBox(w.x1, w.y1, w.x2, w.y2, minX, minY, maxX, maxY));
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
    // Deduplicate exact shared-vertex hits (|dt| <= 1e-3) without swallowing ±eps silhouette corner rays
    const firstT = terrainTs[0];
    for (let i = 1; i < terrainTs.length; i++) {
      const ti = terrainTs[i];
      if (ti >= solidMinT) break;
      if (ti - firstT > 1e-3) {
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

/**
 * Technical wall blueprint lines (blue/green/amber/purple) are only rendered
 * when the GM is actively editing walls (`tool === 'wall'`).
 */
export function shouldShowWallBlueprint(state) {
  return Boolean(state && state.role === 'gm' && state.tool === 'wall');
}

export function isPointInPolygon(px, py, poly) {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = Number(poly[i]?.x);
    const yi = Number(poly[i]?.y);
    const xj = Number(poly[j]?.x);
    const yj = Number(poly[j]?.y);
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Determines whether a door icon should be shown (and clickable) for the given seat:
 * - GM sees all normal and secret doors.
 * - Players never see closed secret doors, and under dynamic lighting only see normal
 *   doors within live vision (nudged slightly toward viewer to handle closed-door edge hits)
 *   or within previously explored memory.
 */
export function isDoorVisibleToSeat(
  door,
  { role = 'gm', dynamicLighting = true, visSources = [], isExploredFn = null } = {}
) {
  if (!door || !isDoorKind(door.kind)) return false;
  if (role === 'gm') return true;
  if (door.kind === 'secret' && !door.open) return false;
  if (!dynamicLighting) return true;

  const mx = (Number(door.x1) + Number(door.x2)) / 2;
  const my = (Number(door.y1) + Number(door.y2)) / 2;

  for (const src of Array.isArray(visSources) ? visSources : []) {
    if (!src?.token) continue;
    const tx = Number(src.token.x);
    const ty = Number(src.token.y);
    const radius = Number(src.radius) || 0;
    const d = Math.hypot(tx - mx, ty - my);
    if (d <= 8) return true;
    if (d > radius + 14) continue;
    if (!Array.isArray(src.poly) || src.poly.length < 3) continue;
    const nudge = Math.min(6, d * 0.45);
    const nx = mx + ((tx - mx) / d) * nudge;
    const ny = my + ((ty - my) / d) * nudge;
    if (isPointInPolygon(nx, ny, src.poly)) return true;
  }

  if (typeof isExploredFn === 'function') {
    const dx = Number(door.x2) - Number(door.x1);
    const dy = Number(door.y2) - Number(door.y1);
    const len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * 8;
    const py = (dx / len) * 8;
    if (isExploredFn(mx, my) || isExploredFn(mx + px, my + py) || isExploredFn(mx - px, my - py)) {
      return true;
    }
  }

  return false;
}

function segmentSegmentHitT(ax, ay, bx, by, cx, cy, dx, dy) {
  const rdx = bx - ax;
  const rdy = by - ay;
  const sdx = dx - cx;
  const sdy = dy - cy;
  const denom = rdx * sdy - rdy * sdx;
  if (Math.abs(denom) < 1e-9) return null;
  const qpx = cx - ax;
  const qpy = cy - ay;
  const t = (qpx * sdy - qpy * sdx) / denom;
  const u = (qpx * rdy - qpy * rdx) / denom;
  if (t >= 0 && t <= 1 && u >= -1e-6 && u <= 1 + 1e-6) {
    return t;
  }
  return null;
}

/**
 * Resolves a player token's movement segment (from -> to) against movement-blocking walls.
 * Returns the clamped position before the earliest intersected wall when blocked.
 */
export function resolveMovementAgainstWalls(fromX, fromY, toX, toY, walls = [], { pad = 10 } = {}) {
  const fx = Number(fromX) || 0;
  const fy = Number(fromY) || 0;
  const tx = Number(toX) || 0;
  const ty = Number(toY) || 0;
  const dist = Math.hypot(tx - fx, ty - fy);
  if (dist < 1e-3 || !Array.isArray(walls) || walls.length === 0) {
    return { blocked: false, x: tx, y: ty, hitWall: null };
  }

  let minT = Infinity;
  let hitWall = null;
  for (const w of walls) {
    if (!isWallBlockingMovement(w)) continue;
    const t = segmentSegmentHitT(fx, fy, tx, ty, Number(w.x1), Number(w.y1), Number(w.x2), Number(w.y2));
    if (t !== null && t < minT) {
      minT = t;
      hitWall = w;
    }
  }

  if (!hitWall) {
    return { blocked: false, x: tx, y: ty, hitWall: null };
  }

  const safeDist = Math.max(0, minT * dist - Math.max(2, Number(pad) || 10));
  const ratio = safeDist / dist;
  return {
    blocked: true,
    x: fx + (tx - fx) * ratio,
    y: fy + (ty - fy) * ratio,
    hitWall
  };
}

/**
 * Clones a group of walls centered at (targetX, targetY) with fresh unique IDs,
 * preserving relative geometry, kinds, and door states.
 */
export function cloneWallsAtPoint(walls = [], targetX = 0, targetY = 0) {
  const list = Array.isArray(walls) ? walls.filter(Boolean) : [];
  if (list.length === 0) return [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const w of list) {
    const x1 = Number(w.x1) || 0;
    const y1 = Number(w.y1) || 0;
    const x2 = Number(w.x2) || 0;
    const y2 = Number(w.y2) || 0;
    if (x1 < minX) minX = x1;
    if (x2 < minX) minX = x2;
    if (x1 > maxX) maxX = x1;
    if (x2 > maxX) maxX = x2;
    if (y1 < minY) minY = y1;
    if (y2 < minY) minY = y2;
    if (y1 > maxY) maxY = y1;
    if (y2 > maxY) maxY = y2;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const dx = Math.round((Number(targetX) || 0) - cx);
  const dy = Math.round((Number(targetY) || 0) - cy);
  const stamp = Date.now().toString(36);
  return list.map((w, idx) => ({
    ...w,
    id: `w-${stamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    x1: Math.round((Number(w.x1) || 0) + dx),
    y1: Math.round((Number(w.y1) || 0) + dy),
    x2: Math.round((Number(w.x2) || 0) + dx),
    y2: Math.round((Number(w.y2) || 0) + dy)
  }));
}

/**
 * Finds the closest wall endpoint ('start' = x1,y1 or 'end' = x2,y2) within maxDist.
 */
export function findWallEndpointNearPoint(walls = [], wx = 0, wy = 0, maxDist = 14) {
  const list = Array.isArray(walls) ? walls : [];
  const px = Number(wx) || 0;
  const py = Number(wy) || 0;
  let best = null;
  let bestDist = Math.max(1, Number(maxDist) || 14);
  for (const w of list) {
    if (!w) continue;
    const d1 = Math.hypot(px - (Number(w.x1) || 0), py - (Number(w.y1) || 0));
    if (d1 <= bestDist) {
      bestDist = d1;
      best = { wall: w, endKey: 'start', x: Number(w.x1) || 0, y: Number(w.y1) || 0, dist: d1 };
    }
    const d2 = Math.hypot(px - (Number(w.x2) || 0), py - (Number(w.y2) || 0));
    if (d2 <= bestDist) {
      bestDist = d2;
      best = { wall: w, endKey: 'end', x: Number(w.x2) || 0, y: Number(w.y2) || 0, dist: d2 };
    }
  }
  return best;
}
