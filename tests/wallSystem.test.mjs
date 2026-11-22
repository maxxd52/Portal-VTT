import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {
  location: { search: '' },
  innerWidth: 1280,
  innerHeight: 720
};
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) {
    return this._store.has(k) ? this._store.get(k) : null;
  },
  setItem(k, v) {
    this._store.set(k, String(v));
  },
  removeItem(k) {
    this._store.delete(k);
  }
};

const {
  WALL_KINDS,
  isDoorKind,
  isWallOpenDoor,
  resolveWallDrawPoint,
  findWallNearPoint,
  collectUniqueRayAngles,
  castVisibilityRay
} = await import('../js/utils/wallGeometry.js?v=20261121a6');
const { createInitialState } = await import('../js/core/model.js?v=20261121a6');
const { Selector } = await import('../js/core/selector.js?v=20261121a6');
const { Service } = await import('../js/core/service.js?v=20261121a6');
const { hasWallOcclusion } = await import('../js/utils/tokenShadowModel.js?v=20261121a6');

function makePillarWalls(cx, cy, half, kind = 'terrain') {
  return [
    { id: 'p1', x1: cx - half, y1: cy - half, x2: cx + half, y2: cy - half, kind },
    { id: 'p2', x1: cx + half, y1: cy - half, x2: cx + half, y2: cy + half, kind },
    { id: 'p3', x1: cx + half, y1: cy + half, x2: cx - half, y2: cy + half, kind },
    { id: 'p4', x1: cx - half, y1: cy + half, x2: cx - half, y2: cy - half, kind }
  ];
}

test('S1: terrain pillar walls pass 1st hit so pillar interior stays visible and block on 2nd hit behind pillar', () => {
  assert.deepEqual(WALL_KINDS, ['wall', 'terrain', 'door', 'secret']);
  assert.equal(isDoorKind('door'), true);
  assert.equal(isDoorKind('secret'), true);
  assert.equal(isDoorKind('terrain'), false);
  assert.equal(isWallOpenDoor({ kind: 'secret', open: true }), true);
  assert.equal(isWallOpenDoor({ kind: 'secret', open: false }), false);

  // Observer at (200, 400), square pillar centered at (400, 400) with half=40 -> x in [360, 440]
  const terrainPillar = makePillarWalls(400, 400, 40, 'terrain');
  const solidPillar = makePillarWalls(400, 400, 40, 'wall');

  const terrainPoly = Selector.computeVisibilityPolygon({ x: 200, y: 400 }, 500, terrainPillar);
  const solidPoly = Selector.computeVisibilityPolygon({ x: 200, y: 400 }, 500, solidPillar);

  // Center of pillar (400, 400): VISIBLE with terrain, DARK with solid wall
  assert.equal(Selector.isPointInPolygon({ x: 400, y: 400 }, terrainPoly), true, 'Terrain pillar interior must be visible');
  assert.equal(Selector.isPointInPolygon({ x: 400, y: 400 }, solidPoly), false, 'Solid wall box hides its own interior');

  // Point directly behind pillar (520, 400): BLOCKED with both terrain and solid wall
  assert.equal(Selector.isPointInPolygon({ x: 520, y: 400 }, terrainPoly), false, 'Area behind terrain pillar must be blocked');
  assert.equal(Selector.isPointInPolygon({ x: 520, y: 400 }, solidPoly), false);

  // Direct ray through pillar center stops at back face (x = 440 -> t = 240), not front face (x = 360 -> t = 160)
  const rayHit = castVisibilityRay(200, 400, 1, 0, 500, terrainPillar);
  assert.ok(Math.abs(rayHit.x - 440) < 0.5, `Ray should stop at back edge x=440, got ${rayHit.x}`);
});

test('S1: collectUniqueRayAngles deduplicates shared polygon vertices and resolveWallDrawPoint supports magnet + Alt freehand', () => {
  const pillar = makePillarWalls(400, 400, 40, 'terrain');
  // 4 segments have 8 endpoints total, but only 4 unique corners -> 4 * 3 = 12 rays (not 24)
  const angles = collectUniqueRayAngles(200, 400, pillar);
  assert.equal(angles.length, 12, `Expected 12 deduplicated angles for 4 shared corners, got ${angles.length}`);

  const grid = { type: 'square', cellSize: 80, offsetX: 10, offsetY: 20, snap: true };
  // Grid snap respects cellSize/2 (40px) + grid offsets
  const snapped = resolveWallDrawPoint(133, 144, { grid, walls: [], freehand: false });
  assert.deepEqual(snapped, { x: 130, y: 140, snappedTo: 'grid' });

  // Freehand (Alt held) ignores grid snap and places exact rounded coordinates
  const free = resolveWallDrawPoint(133.4, 144.6, { grid, walls: [], freehand: true });
  assert.deepEqual(free, { x: 133, y: 145, snappedTo: 'none' });

  // Vertex magnet snaps to nearby existing wall corner even when freehand is true
  const magnetized = resolveWallDrawPoint(366, 365, { grid, walls: pillar, freehand: true, vertexSnapPx: 14 });
  assert.deepEqual(magnetized, { x: 360, y: 360, snappedTo: 'vertex' });

  // findWallNearPoint locates nearest segment cleanly
  const near = findWallNearPoint(pillar, 400, 364, 12);
  assert.equal(near?.id, 'p1');
});

test('S2: secret doors redact to solid walls for players, toggle for GM only, and removeWallById supports undo', () => {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.walls = [];

  // Add a secret door across x=300
  Service.addWallSegment(300, 200, 300, 400, 'secret');
  assert.equal(Service.state.walls.length, 1);
  const secretId = Service.state.walls[0].id;
  assert.equal(Service.state.walls[0].kind, 'secret');
  assert.equal(Service.state.walls[0].open, false);

  // Zero-leak P2P redaction: closed secret door is sent to players as a plain solid wall
  const redactedClosed = Selector.extractWorldForSeat(Service.state, 'seat-p1');
  assert.equal(redactedClosed.walls[0].kind, 'wall', 'Closed secret door must redact to plain wall for players');

  // GM can find & toggle secret door; player cannot find closed secret door
  assert.equal(Selector.findDoorNearPoint(Service.state, 302, 300, 20)?.id, secretId);
  Service.state.role = 'player';
  assert.equal(Selector.findDoorNearPoint(Service.state, 302, 300, 20), null, 'Player must not detect closed secret door');
  assert.equal(Service.toggleDoor(secretId), null, 'Player must not toggle closed secret door');

  // GM opens secret door -> visibility & shadow occlusion let light pass through
  Service.state.role = 'gm';
  const opened = Service.toggleDoor(secretId);
  assert.equal(opened?.open, true);
  assert.equal(hasWallOcclusion(200, 300, 400, 300, Service.state.walls), false, 'Open secret door must let light pass');

  // Once open, players see it as an open door so light passes on their client too
  const redactedOpen = Selector.extractWorldForSeat(Service.state, 'seat-p1');
  assert.equal(redactedOpen.walls[0].open, true);

  // removeWallById deletes specific wall and undo restores it
  Service.addWallSegment(500, 200, 500, 400, 'terrain');
  assert.equal(Service.state.walls.length, 2);
  const removed = Service.removeWallById(secretId);
  assert.equal(removed?.id, secretId);
  assert.equal(Service.state.walls.length, 1);
  assert.equal(Service.state.walls[0].kind, 'terrain');

  Service.undo();
  assert.equal(Service.state.walls.length, 2, 'Undo must restore wall removed via removeWallById');
});
