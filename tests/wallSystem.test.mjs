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
  isWallBlockingMovement,
  resolveWallDrawPoint,
  findWallNearPoint,
  findWallsInRect,
  collectUniqueRayAngles,
  castVisibilityRay,
  shouldShowWallBlueprint,
  isDoorVisibleToSeat,
  resolveDoorVisualState,
  resolveMovementAgainstWalls,
  redactWallsForPlayer
} = await import('../js/utils/wallGeometry.js?v=20261123a7');
const { buildWallMenuSpec } = await import('../js/utils/contextMenuModel.js?v=20261123a7');
const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { Selector } = await import('../js/core/selector.js?v=20261123a7');
const { Service } = await import('../js/core/service.js?v=20261123a7');
const { hasWallOcclusion } = await import('../js/utils/tokenShadowModel.js?v=20261123a7');

function makePillarWalls(cx, cy, half, kind = 'terrain') {
  return [
    { id: 'p1', x1: cx - half, y1: cy - half, x2: cx + half, y2: cy - half, kind },
    { id: 'p2', x1: cx + half, y1: cy - half, x2: cx + half, y2: cy + half, kind },
    { id: 'p3', x1: cx + half, y1: cy + half, x2: cx - half, y2: cy + half, kind },
    { id: 'p4', x1: cx - half, y1: cy + half, x2: cx - half, y2: cy - half, kind }
  ];
}

test('S1: terrain pillar walls pass 1st hit so pillar interior stays visible and block on 2nd hit behind pillar', () => {
  assert.deepEqual(WALL_KINDS, ['wall', 'terrain', 'door', 'secret', 'invisible']);
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

test('S3: findWallsInRect detects inside and crossing segments and Service batch-edits and batch-deletes walls with undo', () => {
  const walls = [
    { id: 'inside', x1: 120, y1: 120, x2: 180, y2: 180, kind: 'wall', open: false },
    { id: 'crossing', x1: 50, y1: 150, x2: 300, y2: 150, kind: 'wall', open: false },
    { id: 'outside', x1: 400, y1: 400, x2: 500, y2: 500, kind: 'wall', open: false }
  ];
  // Reversed marquee coordinates (dragged bottom-right to top-left)
  const hits = findWallsInRect(walls, { x1: 200, y1: 200, x2: 100, y2: 100 });
  assert.deepEqual(hits.map((w) => w.id), ['inside', 'crossing']);

  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.walls = [];
  Service.addWallSegment(100, 100, 200, 100, 'wall');
  Service.addWallSegment(200, 100, 200, 200, 'wall');
  Service.addWallSegment(400, 400, 500, 400, 'wall');
  const [w1, w2, w3] = Service.state.walls;

  // Batch convert 2 walls to doors
  const changed = Service.setWallsKind([w1.id, w2.id], 'door');
  assert.equal(changed, 2);
  assert.equal(Service.state.walls[0].kind, 'door');
  assert.equal(Service.state.walls[1].kind, 'door');
  assert.equal(Service.state.walls[2].kind, 'wall');

  // Open door, then convert back to solid wall -> open resets to false
  Service.toggleDoor(w1.id);
  assert.equal(Service.state.walls[0].open, true);
  Service.setWallsKind([w1.id], 'wall');
  assert.equal(Service.state.walls[0].kind, 'wall');
  assert.equal(Service.state.walls[0].open, false);

  // Batch delete with single undo
  const deleted = Service.removeWallsByIds([w1.id, w2.id]);
  assert.equal(deleted, 2);
  assert.equal(Service.state.walls.length, 1);
  assert.equal(Service.state.walls[0].id, w3.id);

  Service.undo();
  assert.equal(Service.state.walls.length, 3, 'Undo must restore all batch-deleted walls');
});

test('S4: diagonal terrain pillar casts full silhouette shadow from outer corners without corner light leaks', () => {
  // Reproduces observer at bottom-left (200, 600) looking diagonally at square pillar centered at (400, 400), half=40
  // Pillar corners: TL(360,360), TR(440,360), BL(360,440), BR(440,440)
  const pillar = makePillarWalls(400, 400, 40, 'terrain');
  const poly = Selector.computeVisibilityPolygon({ x: 200, y: 600 }, 600, pillar);

  // Pillar interior must remain visible
  assert.equal(Selector.isPointInPolygon({ x: 400, y: 400 }, poly), true, 'Pillar center must stay visible');

  // Points just inside the diagonal shadow cone behind TL and BR outer corners MUST be occluded
  // Ray from (200,600) through (370,360) -> direction (170,-240); past pillar at t=1.5 -> (455, 240)
  assert.equal(
    Selector.isPointInPolygon({ x: 455, y: 240 }, poly),
    false,
    'Area behind top-left pillar silhouette edge must be in shadow'
  );
  //Ray from (200,600) through (440,430) -> direction (240,-170); past pillar at t=1.5 -> (560, 345)
  assert.equal(
    Selector.isPointInPolygon({ x: 560, y: 345 }, poly),
    false,
    'Area behind bottom-right pillar silhouette edge must be in shadow'
  );
});

test('S5: wall pill applyWallKind sets draw kind in draw mode and transforms selected walls in select mode', () => {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.walls = [];
  Service.setTool('wall');

  // Default wallMode is 'draw' and wallDrawKind is 'wall'
  assert.equal(Service.state.wallMode || 'draw', 'draw');
  assert.equal(Service.state.wallDrawKind || 'wall', 'wall');

  // In draw mode, applyWallKind changes wallDrawKind and new segments inherit it
  const drawRes = Service.applyWallKind('door');
  assert.equal(drawRes.mode, 'draw');
  assert.equal(Service.state.wallDrawKind, 'door');
  Service.addWallSegment(100, 100, 200, 100);
  Service.addWallSegment(200, 100, 300, 100, 'wall');
  assert.equal(Service.state.walls[0].kind, 'door', 'addWallSegment without explicit kind uses state.wallDrawKind');
  assert.equal(Service.state.walls[1].kind, 'wall', 'addWallSegment with explicit kind respects argument');

  // Switch to select mode with 2 selected walls -> applyWallKind mutates both walls and updates wallDrawKind
  Service.setWallMode('select');
  const [w1, w2] = Service.state.walls;
  Service.setSelectedWallIds([w1.id, w2.id]);
  const selRes = Service.applyWallKind('terrain');
  assert.equal(selRes.mode, 'transform');
  assert.equal(selRes.count, 2);
  assert.equal(Service.state.walls[0].kind, 'terrain');
  assert.equal(Service.state.walls[1].kind, 'terrain');

  // Delete selected walls via pill action with undo support
  const delCount = Service.deleteSelectedWalls();
  assert.equal(delCount, 2);
  assert.equal(Service.state.walls.length, 0);
  assert.deepEqual(Service.state.selectedWallIds, []);
  Service.undo();
  assert.equal(Service.state.walls.length, 2);

  // Marker tool pill helpers: setDrawColor and clearStrokes with undo
  Service.setTool('draw');
  Service.setDrawColor('#3b82f6');
  assert.equal(Service.state.drawColor, '#3b82f6');
  Service.pushUndoSnapshot();
  Service.state.strokes.push({ color: '#3b82f6', points: [{ x: 10, y: 10 }, { x: 40, y: 40 }] });
  const cleared = Service.clearStrokes();
  assert.equal(cleared, 1);
  assert.equal(Service.state.strokes.length, 0);
  Service.undo();
  assert.equal(Service.state.strokes.length, 1);
});

test('S6: wall blueprints only show in GM wall tool, doors obey player fog visibility, and setTool redraws fog on wall toggle', () => {
  // 1. Blueprint visibility: ONLY when GM is in wall edit tool
  assert.equal(shouldShowWallBlueprint({ role: 'gm', tool: 'wall' }), true);
  assert.equal(shouldShowWallBlueprint({ role: 'gm', tool: 'select' }), false);
  assert.equal(shouldShowWallBlueprint({ role: 'gm', tool: 'ruler' }), false);
  assert.equal(shouldShowWallBlueprint({ role: 'player', tool: 'wall' }), false);
  assert.equal(shouldShowWallBlueprint({ role: 'player', tool: 'select' }), false);

  // 2. Door visibility in dynamic fog: player sees door in LOS (even closed on polygon boundary), NOT behind walls
  const roomState = createInitialState();
  roomState.role = 'player';
  roomState.dynamicLighting = true;
  roomState.walls = [
    // Room divider at x=400 with a closed door from y=160..240
    { id: 'w-top', x1: 400, y1: 0, x2: 400, y2: 160, kind: 'wall', open: false },
    { id: 'd-near', x1: 400, y1: 160, x2: 400, y2: 240, kind: 'door', open: false },
    { id: 'w-bot', x1: 400, y1: 240, x2: 400, y2: 600, kind: 'wall', open: false },
    // Far door behind the divider wall in an unexplored room at x=600
    { id: 'd-far', x1: 600, y1: 160, x2: 600, y2: 240, kind: 'door', open: false },
    // Closed secret door right next to player (on the left wall, not blocking d-near)
    { id: 'd-secret', x1: 180, y1: 160, x2: 180, y2: 240, kind: 'secret', open: false }
  ];
  roomState.tokens = [
    { id: 'tok-p', name: 'Hero', isAlly: true, x: 250, y: 200, size: 1, visionMeters: 20, lightMeters: 0 }
  ];
  roomState.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p'] }];
  roomState.activeInviteId = 'inv-1';

  const visSources = Selector.getAlliedVisibilityPolygons(roomState);
  const nearDoor = roomState.walls.find((w) => w.id === 'd-near');
  const farDoor = roomState.walls.find((w) => w.id === 'd-far');
  const secretDoor = roomState.walls.find((w) => w.id === 'd-secret');

  assert.equal(isDoorVisibleToSeat(nearDoor, { role: 'player', dynamicLighting: true, visSources }), true);
  assert.equal(isDoorVisibleToSeat(farDoor, { role: 'player', dynamicLighting: true, visSources }), false);
  assert.equal(isDoorVisibleToSeat(secretDoor, { role: 'player', dynamicLighting: true, visSources }), false);

  // Far door becomes visible if previously explored or if dynamic lighting is off
  assert.equal(
    isDoorVisibleToSeat(farDoor, { role: 'player', dynamicLighting: true, visSources, isExploredFn: () => true }),
    true
  );
  assert.equal(
    isDoorVisibleToSeat(farDoor, { role: 'player', dynamicLighting: false, visSources: [] }),
    true
  );

  // GM always sees both normal and secret doors
  assert.equal(isDoorVisibleToSeat(farDoor, { role: 'gm', dynamicLighting: true, visSources: [] }), true);
  assert.equal(isDoorVisibleToSeat(secretDoor, { role: 'gm', dynamicLighting: true, visSources: [] }), true);

  // 3. Service.setTool triggers redrawFog when entering or leaving wall tool
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.tool = 'select';
  const calls = [];
  Service.subscribe((_st, opts) => calls.push(opts));

  Service.setTool('wall');
  assert.equal(calls.at(-1)?.redrawFog, true, 'Entering wall tool must redraw fog/wall layer');
  Service.setTool('select');
  assert.equal(calls.at(-1)?.redrawFog, true, 'Leaving wall tool must redraw fog/wall layer');
});

test('S7: locked doors block players, GM can lock/unlock via context menu, and walls block player movement while terrain & open doors allow passage', () => {
  // 1. Pure movement blocking classification
  assert.equal(isWallBlockingMovement({ kind: 'wall', open: false }), true);
  assert.equal(isWallBlockingMovement({ kind: 'door', open: false, locked: false }), true);
  assert.equal(isWallBlockingMovement({ kind: 'door', open: false, locked: true }), true);
  assert.equal(isWallBlockingMovement({ kind: 'secret', open: false, locked: false }), true);
  assert.equal(isWallBlockingMovement({ kind: 'door', open: true, locked: false }), false);
  assert.equal(isWallBlockingMovement({ kind: 'secret', open: true, locked: false }), false);
  assert.equal(isWallBlockingMovement({ kind: 'terrain', open: false }), false, 'Terrain/pillars must NOT block movement');

  // 2. Pure segment movement collision resolver
  const testWalls = [
    { id: 'w-solid', x1: 400, y1: 100, x2: 400, y2: 300, kind: 'wall', open: false },
    { id: 'w-terrain', x1: 400, y1: 350, x2: 400, y2: 450, kind: 'terrain', open: false },
    { id: 'd-open', x1: 400, y1: 500, x2: 400, y2: 600, kind: 'door', open: true }
  ];
  const hitSolid = resolveMovementAgainstWalls(300, 200, 500, 200, testWalls);
  assert.equal(hitSolid.blocked, true);
  assert.ok(hitSolid.x < 400, 'Player movement must stop before the solid wall');

  const passTerrain = resolveMovementAgainstWalls(300, 400, 500, 400, testWalls);
  assert.equal(passTerrain.blocked, false);
  assert.equal(passTerrain.x, 500);

  const passOpenDoor = resolveMovementAgainstWalls(300, 550, 500, 550, testWalls);
  assert.equal(passOpenDoor.blocked, false);
  assert.equal(passOpenDoor.x, 500);

  // 3. Door locking permissions & redaction
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.walls = [
    { id: 'w-wall', x1: 400, y1: 0, x2: 400, y2: 160, kind: 'wall', open: false },
    { id: 'd-main', x1: 400, y1: 160, x2: 400, y2: 240, kind: 'door', open: true, locked: false },
    { id: 'd-sec', x1: 400, y1: 260, x2: 400, y2: 340, kind: 'secret', open: false, locked: true },
    { id: 'w-pillar', x1: 400, y1: 360, x2: 400, y2: 440, kind: 'terrain', open: false }
  ];
  Service.state.tokens = [
    { id: 'tok-p1', name: 'Hero', isAlly: true, x: 320, y: 200, size: 1 }
  ];
  Service.state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p1'] }];
  Service.state.activeInviteId = 'inv-1';

  // Locking an open door automatically closes it
  const locked = Service.toggleDoorLocked('d-main');
  assert.equal(locked.locked, true);
  assert.equal(locked.open, false);

  // Anti-spoiler door visuals: GM sees 'locked' padlock, Player sees normal 'closed' door
  assert.equal(resolveDoorVisualState(locked, { role: 'gm' }), 'locked');
  assert.equal(resolveDoorVisualState(locked, { role: 'player' }), 'closed');
  assert.equal(resolveDoorVisualState({ kind: 'door', open: true, locked: false }, { role: 'player' }), 'open');

  // Redaction preserves locked on normal door, strips locked on closed secret door
  const redacted = redactWallsForPlayer(Service.state.walls);
  assert.equal(redacted.find((w) => w.id === 'd-main').locked, true);
  assert.equal(redacted.find((w) => w.id === 'd-sec').kind, 'wall');
  assert.equal(redacted.find((w) => w.id === 'd-sec').locked, false);

  // Context menu includes toggle-lock and shows 'Bloqueada' subtitle
  const lockedMenu = buildWallMenuSpec([locked]);
  assert.equal(lockedMenu.header.subtitle, 'Bloqueada');
  const flatItems = lockedMenu.sections.flat();
  assert.ok(flatItems.some((it) => it.id === 'toggle-lock'), 'Door context menu must expose lock/unlock option');

  // Switch to Player: cannot unlock, cannot open locked door, cannot cross closed door/wall, CAN cross terrain & open door
  Service.state.role = 'player';
  Service.state.isHostGm = false;
  assert.equal(Service.toggleDoorLocked('d-main'), null);
  assert.equal(Service.toggleDoor('d-main'), null);
  assert.equal(Service.state.walls.find((w) => w.id === 'd-main').open, false);

  // Player blocked by locked door
  const tok = Service.state.tokens[0];
  Service.moveToken(tok.id, 480, 200, true);
  assert.ok(tok.x < 400, 'Player must not move across a closed/locked door');

  // Player CAN cross terrain pillar freely
  tok.x = 320;
  tok.y = 400;
  Service.moveToken(tok.id, 480, 400, true);
  assert.ok(tok.x > 400, 'Player must be able to move across terrain/pillar walls');

  // Switch back to GM: GM can open locked door directly (unlocks + opens) and can move freely across solid wall
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  tok.x = 320;
  tok.y = 80;
  Service.moveToken(tok.id, 480, 80, true);
  assert.ok(tok.x > 400, 'GM must move tokens freely across solid walls');

  const openedByGm = Service.toggleDoor('d-main');
  assert.equal(openedByGm.open, true);
  assert.equal(openedByGm.locked, false);

  // Player now CAN pass through the open door
  Service.state.role = 'player';
  Service.state.isHostGm = false;
  tok.x = 320;
  tok.y = 200;
  Service.moveToken(tok.id, 480, 200, true);
  assert.ok(tok.x > 400, 'Player must pass freely through an open door');
});



