/* ==========================================================================
   WALL GEOMETRY: WALL KINDS, TERRAIN 2ND-HIT RAYCASTING & VERTEX MAGNET (PURE)
   ========================================================================== */

import { normalizeGridConfig } from './gridGeometry.js?v=20261125a1';

export const WALL_KINDS = Object.freeze(['wall', 'terrain', 'invisible']);
export const WALL_DOOR_MODES = Object.freeze(['none', 'normal', 'secret']);

export function normalizeWallKind(kind) {
  return WALL_KINDS.includes(kind) ? kind : 'wall';
}

export function normalizeDoorMode(door) {
  return WALL_DOOR_MODES.includes(door) ? door : 'none';
}

export function getWallDoorMode(w) {
  if (!w) return 'none';
  if (WALL_DOOR_MODES.includes(w.door)) return w.door;
  if (w.kind === 'door') return 'normal';
  if (w.kind === 'secret') return 'secret';
  return 'none';
}

export function isWallDoor(w) {
  return getWallDoorMode(w) !== 'none';
}

export function isWallSecretDoor(w) {
  return getWallDoorMode(w) === 'secret';
}

export function normalizeWall(w) {
  if (!w || typeof w !== 'object') return w;
  const kind = normalizeWallKind(w.kind);
  const door = getWallDoorMode(w);
  const hasDoor = door !== 'none';
  return {
    ...w,
    kind,
    door,
    open: hasDoor ? Boolean(w.open) : false,
    locked: hasDoor ? Boolean(w.locked) : false
  };
}

export function normalizeWalls(list) {
  return Array.isArray(list) ? list.map((w) => normalizeWall(w)) : [];
}

export function isDoorKind(kind) {
  return kind === 'door' || kind === 'secret';
}

export function isWallOpenDoor(w) {
  return Boolean(w && isWallDoor(w) && w.open);
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
 * indistinguishable from plain walls of their material; open secret doors act as open normal doors.
 */
export function redactWallsForPlayer(walls = []) {
  if (!Array.isArray(walls)) return [];
  return walls.map((w) => {
    if (!w) return w;
    const norm = normalizeWall(w);
    if (norm.door === 'secret') {
      if (norm.open) return { ...norm, door: 'normal', open: true, locked: false };
      return { ...norm, door: 'none', open: false, locked: false };
    }
    return norm;
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
export function findWallNearPoint(walls, wx, wy, maxDist = 14, { kinds = null, doorModes = null, includeOpenDoors = true } = {}) {
  if (!Array.isArray(walls) || walls.length === 0) return null;
  let best = null;
  let bestDist = maxDist;
  for (const w of walls) {
    if (!w) continue;
    const kind = normalizeWallKind(w.kind);
    if (kinds && !kinds.includes(kind)) continue;
    const doorMode = getWallDoorMode(w);
    if (doorModes && !doorModes.includes(doorMode)) continue;
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
export function castVisibilityRay(ox, oy, dx, dy, maxT, segments, { terrainBlocksOnFirstHit = false } = {}) {
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

    if (seg.kind === 'terrain' && !terrainBlocksOnFirstHit) {
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
  { role = 'gm', dynamicLighting = true, visSources = [], isExploredFn = null, ambient = 'day', lightPolys = [] } = {}
) {
  if (!door || !isWallDoor(door)) return false;
  if (role === 'gm') return true;
  if (isWallSecretDoor(door) && !door.open) return false;
  if (!dynamicLighting) return true;

  const mx = (Number(door.x1) + Number(door.x2)) / 2;
  const my = (Number(door.y1) + Number(door.y2)) / 2;
  const isPitchDark = ambient === 'darkness';
  const activeLights = Array.isArray(lightPolys) ? lightPolys : [];

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
    if (!isPointInPolygon(nx, ny, src.poly)) continue;
    if (!isPitchDark) return true;
    const selfSight = Math.max(Number(src.clearRadiusPx) || 0, Number(src.darkvisionRadiusPx) || 0);
    if (d <= selfSight + 14) return true;
    if (
      activeLights.some(
        (lp) =>
          lp &&
          Math.hypot(Number(lp.x) - nx, Number(lp.y) - ny) <= (Number(lp.radiusPx) || 0) + 14 &&
          isPointInPolygon(nx, ny, lp.poly)
      )
    ) {
      return true;
    }
  }

  if (!isPitchDark && typeof isExploredFn === 'function') {
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

/**
 * Liang-Barsky segment-to-AABB clipping so long walls crossing a visibility bounding box
 * produce exact intersection endpoints on the box perimeter.
 */
export function clipSegmentToRect(x1, y1, x2, y2, minX, minY, maxX, maxY) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const checks = [
    [-dx, x1 - minX],
    [dx, maxX - x1],
    [-dy, y1 - minY],
    [dy, maxY - y1]
  ];
  for (let i = 0; i < 4; i++) {
    const p = checks[i][0];
    const q = checks[i][1];
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return {
    x1: x1 + t0 * dx,
    y1: y1 + t0 * dy,
    x2: x1 + t1 * dx,
    y2: y1 + t1 * dy
  };
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

/**
 * Projects a world point (wx, wy) onto a wall segment, clamped to [0, 1].
 */
export function projectPointOnWall(wall, wx, wy) {
  const x1 = Number(wall?.x1) || 0;
  const y1 = Number(wall?.y1) || 0;
  const x2 = Number(wall?.x2) || 0;
  const y2 = Number(wall?.y2) || 0;
  const px = Number(wx) || 0;
  const py = Number(wy) || 0;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const len = Math.sqrt(lenSq);
  if (len < 1e-6) {
    return { t: 0, s: 0, len: 0, x: x1, y: y1, dist: Math.hypot(px - x1, py - y1) };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return {
    t,
    s: t * len,
    len,
    x,
    y,
    dist: Math.hypot(px - x, py - y)
  };
}

/**
 * Computes the placement span of a door along a wall segment:
 * - Single click / hover: 1-cell door centered near anchorPt (or converts short walls).
 * - Drag >= minDoorPx: custom-width door from anchorPt to currentPt (snapped to half-cell unless freehand).
 */
export function computeDoorPlacementOnWall(
  wall,
  anchorPt,
  currentPt = null,
  { cellSize = 80, snap = true, freehand = false, minDoorPx = 18 } = {}
) {
  if (!wall || !anchorPt) return null;
  const x1 = Number(wall.x1) || 0;
  const y1 = Number(wall.y1) || 0;
  const x2 = Number(wall.x2) || 0;
  const y2 = Number(wall.y2) || 0;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return null;

  const ux = dx / len;
  const uy = dy / len;
  const cs = Math.max(20, Number(cellSize) || 80);
  const step = Math.max(8, cs / 2);
  const minW = Math.max(10, Number(minDoorPx) || 18);
  const useSnap = Boolean(snap && !freehand);

  const projA = projectPointOnWall(wall, anchorPt.x, anchorPt.y);
  const projB = currentPt ? projectPointOnWall(wall, currentPt.x, currentPt.y) : null;

  let s0 = 0;
  let s1 = len;

  if (projB && Math.abs(projB.s - projA.s) >= minW) {
    let sA = projA.s;
    let sB = projB.s;
    if (useSnap) {
      sA = Math.max(0, Math.min(len, Math.round(sA / step) * step));
      sB = Math.max(0, Math.min(len, Math.round(sB / step) * step));
      if (Math.abs(sB - sA) < minW) {
        const dir = projB.s >= projA.s ? 1 : -1;
        sB = Math.max(0, Math.min(len, sA + dir * Math.max(step, minW)));
      }
    }
    s0 = Math.min(sA, sB);
    s1 = Math.max(sA, sB);
  } else if (len <= cs * 1.25) {
    s0 = 0;
    s1 = len;
  } else {
    const w = Math.min(len, Math.max(minW, cs));
    if (useSnap) {
      s0 = Math.round((projA.s - w / 2) / step) * step;
    } else {
      s0 = projA.s - w / 2;
    }
    s0 = Math.max(0, Math.min(len - w, s0));
    s1 = s0 + w;
  }

  if (s0 < 12) s0 = 0;
  if (len - s1 < 12) s1 = len;

  const rx1 = Math.round(x1 + ux * s0);
  const ry1 = Math.round(y1 + uy * s0);
  const rx2 = Math.round(x1 + ux * s1);
  const ry2 = Math.round(y1 + uy * s1);
  const mode = s0 === 0 && s1 === len ? 'convert' : 'split';

  return {
    mode,
    t0: s0 / len,
    t1: s1 / len,
    x1: rx1,
    y1: ry1,
    x2: rx2,
    y2: ry2,
    widthPx: Math.hypot(rx2 - rx1, ry2 - ry1)
  };
}

/**
 * Splits (or converts) a wall segment into up to 3 segments sharing exact integer vertices.
 */
export function splitWallForDoor(wall, placement, { doorMode = 'normal', idFactory = null } = {}) {
  if (!wall || !placement) return { segments: [], doorId: null };
  const kind = normalizeWallKind(wall.kind);
  const door = normalizeDoorMode(doorMode === 'none' ? 'normal' : doorMode);
  const stamp = Date.now().toString(36);
  const makeId = typeof idFactory === 'function'
    ? idFactory
    : (tag) => `wall-${stamp}-${tag}-${Math.random().toString(36).slice(2, 6)}`;

  if (placement.mode === 'convert') {
    const converted = {
      ...wall,
      kind,
      door,
      open: false,
      locked: false
    };
    return { segments: [converted], doorId: converted.id };
  }

  const segments = [];
  const leftLen = Math.hypot(placement.x1 - (Number(wall.x1) || 0), placement.y1 - (Number(wall.y1) || 0));
  if (placement.t0 > 0 && leftLen >= 6) {
    segments.push({
      id: makeId('l'),
      x1: Number(wall.x1) || 0,
      y1: Number(wall.y1) || 0,
      x2: placement.x1,
      y2: placement.y1,
      kind,
      door: 'none',
      open: false,
      locked: false
    });
  }

  const doorId = makeId('d');
  segments.push({
    id: doorId,
    x1: placement.x1,
    y1: placement.y1,
    x2: placement.x2,
    y2: placement.y2,
    kind,
    door,
    open: false,
    locked: false
  });

  const rightLen = Math.hypot((Number(wall.x2) || 0) - placement.x2, (Number(wall.y2) || 0) - placement.y2);
  if (placement.t1 < 1 && rightLen >= 6) {
    segments.push({
      id: makeId('r'),
      x1: placement.x2,
      y1: placement.y2,
      x2: Number(wall.x2) || 0,
      y2: Number(wall.y2) || 0,
      kind,
      door: 'none',
      open: false,
      locked: false
    });
  }

  return { segments, doorId };
}

/**
 * Finds all wall endpoints within tol px of (x, y), excluding excludeWallId.
 */
export function findConnectedWallEndpoints(walls = [], x = 0, y = 0, { excludeWallId = null, tol = 2 } = {}) {
  const list = Array.isArray(walls) ? walls : [];
  const px = Number(x) || 0;
  const py = Number(y) || 0;
  const maxD = Math.max(0, Number(tol) || 2);
  const out = [];
  for (const w of list) {
    if (!w || w.id === excludeWallId) continue;
    if (Math.hypot((Number(w.x1) || 0) - px, (Number(w.y1) || 0) - py) <= maxD) {
      out.push({ wallId: w.id, endKey: 'start' });
    }
    if (Math.hypot((Number(w.x2) || 0) - px, (Number(w.y2) || 0) - py) <= maxD) {
      out.push({ wallId: w.id, endKey: 'end' });
    }
  }
  return out;
}

/**
 * Computes a constrained endpoint position when resizing an existing door along its wall axis,
 * respecting minDoorPx and preserving >= minStubPx on any collinear linked wall.
 */
export function computeDoorResizePoint(
  door,
  endKey,
  linkedEndpoints,
  walls,
  wx,
  wy,
  { cellSize = 80, snap = true, freehand = false, minDoorPx = 18, minStubPx = 12 } = {}
) {
  if (!door) return null;
  const isStart = endKey === 'start';
  const fx = Number(isStart ? door.x2 : door.x1) || 0;
  const fy = Number(isStart ? door.y2 : door.y1) || 0;
  const mx = Number(isStart ? door.x1 : door.x2) || 0;
  const my = Number(isStart ? door.y1 : door.y2) || 0;
  const dx = mx - fx;
  const dy = my - fy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return null;

  const ux = dx / len;
  const uy = dy / len;
  let proj = (Number(wx) - fx) * ux + (Number(wy) - fy) * uy;

  let maxProj = Infinity;
  const wallList = Array.isArray(walls) ? walls : [];
  for (const link of Array.isArray(linkedEndpoints) ? linkedEndpoints : []) {
    if (!link?.wallId) continue;
    const lw = wallList.find((w) => w && w.id === link.wallId);
    if (!lw) continue;
    const ox = Number(link.endKey === 'start' ? lw.x2 : lw.x1) || 0;
    const oy = Number(link.endKey === 'start' ? lw.y2 : lw.y1) || 0;
    const vx = ox - mx;
    const vy = oy - my;
    const stubLen = Math.hypot(vx, vy);
    if (stubLen > 1e-3 && (vx * ux + vy * uy) / stubLen >= 0.98) {
      maxProj = Math.min(maxProj, len + Math.max(0, stubLen - minStubPx));
    }
  }

  const cs = Math.max(20, Number(cellSize) || 80);
  const step = Math.max(8, cs / 2);
  if (snap && !freehand) {
    proj = len + Math.round((proj - len) / step) * step;
  }

  const minP = Math.max(10, Number(minDoorPx) || 18);
  proj = Math.max(minP, Math.min(maxProj, proj));

  const nx = Math.max(0, Math.min(2400, Math.round(fx + ux * proj)));
  const ny = Math.max(0, Math.min(1600, Math.round(fy + uy * proj)));
  return {
    x: nx,
    y: ny,
    widthPx: Math.hypot(nx - fx, ny - fy)
  };
}

/**
 * Computes a constrained slide offset (dx, dy) along a door's wall axis,
 * keeping collinear adjacent stubs >= minStubPx and all coords within board bounds.
 */
export function computeDoorSlideOffset(
  door,
  linkedStart,
  linkedEnd,
  walls,
  anchorPt,
  currentPt,
  { cellSize = 80, snap = true, freehand = false, minStubPx = 12 } = {}
) {
  if (!door || !anchorPt || !currentPt) return { dx: 0, dy: 0, shift: 0 };
  const x1 = Number(door.x1) || 0;
  const y1 = Number(door.y1) || 0;
  const x2 = Number(door.x2) || 0;
  const y2 = Number(door.y2) || 0;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return { dx: 0, dy: 0, shift: 0 };

  const ux = dx / len;
  const uy = dy / len;
  const rawShift = (Number(currentPt.x) - Number(anchorPt.x)) * ux + (Number(currentPt.y) - Number(anchorPt.y)) * uy;

  let minShift = -Infinity;
  let maxShift = Infinity;
  const wallList = Array.isArray(walls) ? walls : [];

  for (const link of Array.isArray(linkedStart) ? linkedStart : []) {
    if (!link?.wallId) continue;
    const lw = wallList.find((w) => w && w.id === link.wallId);
    if (!lw) continue;
    const ox = Number(link.endKey === 'start' ? lw.x2 : lw.x1) || 0;
    const oy = Number(link.endKey === 'start' ? lw.y2 : lw.y1) || 0;
    const vx = ox - x1;
    const vy = oy - y1;
    const stubLen = Math.hypot(vx, vy);
    if (stubLen > 1e-3 && (vx * -ux + vy * -uy) / stubLen >= 0.98) {
      minShift = Math.max(minShift, -Math.max(0, stubLen - minStubPx));
    }
  }

  for (const link of Array.isArray(linkedEnd) ? linkedEnd : []) {
    if (!link?.wallId) continue;
    const lw = wallList.find((w) => w && w.id === link.wallId);
    if (!lw) continue;
    const ox = Number(link.endKey === 'start' ? lw.x2 : lw.x1) || 0;
    const oy = Number(link.endKey === 'start' ? lw.y2 : lw.y1) || 0;
    const vx = ox - x2;
    const vy = oy - y2;
    const stubLen = Math.hypot(vx, vy);
    if (stubLen > 1e-3 && (vx * ux + vy * uy) / stubLen >= 0.98) {
      maxShift = Math.min(maxShift, Math.max(0, stubLen - minStubPx));
    }
  }

  const clampAxisBounds = (p, u, maxVal) => {
    if (Math.abs(u) < 1e-6) return;
    const tA = (0 - p) / u;
    const tB = (maxVal - p) / u;
    minShift = Math.max(minShift, Math.min(tA, tB));
    maxShift = Math.min(maxShift, Math.max(tA, tB));
  };
  clampAxisBounds(x1, ux, 2400);
  clampAxisBounds(x2, ux, 2400);
  clampAxisBounds(y1, uy, 1600);
  clampAxisBounds(y2, uy, 1600);

  if (minShift > maxShift) {
    minShift = 0;
    maxShift = 0;
  }

  const cs = Math.max(20, Number(cellSize) || 80);
  const step = Math.max(8, cs / 2);
  let shift = rawShift;
  if (snap && !freehand) {
    shift = Math.round(rawShift / step) * step;
  }
  shift = Math.max(minShift, Math.min(maxShift, shift));

  return {
    dx: Math.round(ux * shift) || 0,
    dy: Math.round(uy * shift) || 0,
    shift: shift || 0
  };
}

/**
 * Finds all map light pins whose (x, y) lies inside or within pad px of a selection rectangle.
 */
export function findMapLightsInRect(lights = [], rect, { pad = 14 } = {}) {
  if (!Array.isArray(lights) || lights.length === 0 || !rect) return [];
  const p = Math.max(0, Number(pad) || 0);
  const minX = Math.min(Number(rect.x1) || 0, Number(rect.x2) || 0) - p;
  const maxX = Math.max(Number(rect.x1) || 0, Number(rect.x2) || 0) + p;
  const minY = Math.min(Number(rect.y1) || 0, Number(rect.y2) || 0) - p;
  const maxY = Math.max(Number(rect.y1) || 0, Number(rect.y2) || 0) + p;
  return lights.filter((l) => {
    if (!l) return false;
    const lx = Number(l.x) || 0;
    const ly = Number(l.y) || 0;
    return lx >= minX && lx <= maxX && ly >= minY && ly <= maxY;
  });
}
