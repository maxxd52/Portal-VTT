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
  WALL_DOOR_MODES,
  normalizeWallKind,
  getWallDoorMode,
  isWallDoor,
  isWallSecretDoor,
  normalizeWall,
  normalizeWalls,
  isDoorKind,
  isWallOpenDoor,
  isWallBlockingSight,
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
  redactWallsForPlayer,
  projectPointOnWall,
  computeDoorPlacementOnWall,
  splitWallForDoor,
  findConnectedWallEndpoints,
  computeDoorResizePoint,
  computeDoorSlideOffset,
  findMapLightsInRect
} = await import('../js/utils/wallGeometry.js?v=20261125a1');
const { buildWallMenuSpec } = await import('../js/utils/contextMenuModel.js?v=20261125a1');
const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { hasWallOcclusion } = await import('../js/utils/tokenShadowModel.js?v=20261125a1');

function makePillarWalls(cx, cy, half, kind = 'terrain') {
  return [
    { id: 'p1', x1: cx - half, y1: cy - half, x2: cx + half, y2: cy - half, kind },
    { id: 'p2', x1: cx + half, y1: cy - half, x2: cx + half, y2: cy + half, kind },
    { id: 'p3', x1: cx + half, y1: cy + half, x2: cx - half, y2: cy + half, kind },
    { id: 'p4', x1: cx - half, y1: cy + half, x2: cx - half, y2: cy - half, kind }
  ];
}

test('S1: terrain pillar walls pass 1st hit so pillar interior stays visible and block on 2nd hit behind pillar', () => {
  assert.deepEqual(WALL_KINDS, ['wall', 'terrain', 'invisible']);
  assert.deepEqual(WALL_DOOR_MODES, ['none', 'normal', 'secret']);
  assert.equal(isDoorKind('door'), true);
  assert.equal(isDoorKind('secret'), true);
  assert.equal(isDoorKind('terrain'), false);
  assert.equal(isWallOpenDoor({ kind: 'secret', open: true }), true);
  assert.equal(isWallOpenDoor({ kind: 'secret', open: false }), false);
  assert.equal(isWallOpenDoor({ kind: 'invisible', door: 'normal', open: true }), true);
  assert.equal(isWallOpenDoor({ kind: 'invisible', door: 'normal', open: false }), false);

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
  Service.addWallSegment(300, 200, 300, 400, 'wall', 'secret');
  assert.equal(Service.state.walls.length, 1);
  const secretId = Service.state.walls[0].id;
  assert.equal(Service.state.walls[0].kind, 'wall');
  assert.equal(Service.state.walls[0].door, 'secret');
  assert.equal(Service.state.walls[0].open, false);

  // Zero-leak P2P redaction: closed secret door is sent to players as a plain solid wall
  const redactedClosed = Selector.extractWorldForSeat(Service.state, 'seat-p1');
  assert.equal(redactedClosed.walls[0].kind, 'wall', 'Closed secret door must redact to plain wall for players');
  assert.equal(redactedClosed.walls[0].door, 'none', 'Closed secret door must redact door to none for players');

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

  // Batch convert 2 walls to doors (material stays 'wall', door becomes 'normal')
  const changed = Service.setWallsDoor([w1.id, w2.id], 'normal');
  assert.equal(changed, 2);
  assert.equal(Service.state.walls[0].kind, 'wall');
  assert.equal(Service.state.walls[0].door, 'normal');
  assert.equal(Service.state.walls[1].door, 'normal');
  assert.equal(Service.state.walls[2].door, 'none');

  // Open door, then remove door property -> open resets to false
  Service.toggleDoor(w1.id);
  assert.equal(Service.state.walls[0].open, true);
  Service.setWallsDoor([w1.id], 'none');
  assert.equal(Service.state.walls[0].kind, 'wall');
  assert.equal(Service.state.walls[0].door, 'none');
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

  // Default wallMode is 'draw', wallDrawKind is 'wall', wallDrawDoor is 'none'
  assert.equal(Service.state.wallMode || 'draw', 'draw');
  assert.equal(Service.state.wallDrawKind || 'wall', 'wall');
  assert.equal(Service.state.wallDrawDoor || 'none', 'none');

  // In draw mode, applyWallKind + applyWallDoor change draw defaults and new segments inherit them
  const doorDrawRes = Service.applyWallDoor('normal');
  assert.equal(doorDrawRes.mode, 'draw');
  assert.equal(Service.state.wallDrawDoor, 'normal');
  Service.addWallSegment(100, 100, 200, 100);
  Service.addWallSegment(200, 100, 300, 100, 'wall', 'none');
  assert.equal(Service.state.walls[0].kind, 'wall');
  assert.equal(Service.state.walls[0].door, 'normal', 'addWallSegment without explicit door uses state.wallDrawDoor');
  assert.equal(Service.state.walls[1].kind, 'wall');
  assert.equal(Service.state.walls[1].door, 'none', 'addWallSegment with explicit door respects argument');

  // Switch to select mode with 2 selected walls -> applyWallKind mutates material on both while preserving door
  Service.setWallMode('select');
  const [w1, w2] = Service.state.walls;
  Service.setSelectedWallIds([w1.id, w2.id]);
  const selRes = Service.applyWallKind('terrain');
  assert.equal(selRes.mode, 'transform');
  assert.equal(selRes.count, 2);
  assert.equal(Service.state.walls[0].kind, 'terrain');
  assert.equal(Service.state.walls[0].door, 'normal');
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

test('S9-RED: players can only toggle doors within adjacency reach of a controlled token and without blocking walls in between; GM has no distance limit', () => {
  Service.state = createInitialState();
  Service.state.grid = { type: 'square', cellSize: 80, metersPerUnit: 1.5 };
  Service.state.role = 'player';
  Service.state.isHostGm = false;
  Service.state.activeInviteId = 'inv-reach';
  Service.state.playerInvites = [{ id: 'inv-reach', tokenIds: ['ally-1'] }];

  const door = { id: 'd-reach', kind: 'door', x1: 400, y1: 200, x2: 400, y2: 280, open: false, locked: false };
  const frameWall = { id: 'w-frame', kind: 'wall', x1: 400, y1: 120, x2: 400, y2: 200 }; // shares endpoint (400,200)
  Service.state.walls = [door, frameWall];

  // 1. Adjacent 1x1 frontal (0.5 cell = 40px) & diagonal (like Lyra/Kaelen, ~0.707 cell) -> can reach & toggle
  const ally1 = { id: 'ally-1', isAlly: true, size: 1, x: 360, y: 240, hidden: false };
  Service.state.tokens = [ally1];
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), true);
  const opened = Service.toggleDoor('d-reach');
  assert.equal(opened?.open, true);
  Service.toggleDoor('d-reach'); // close back
  assert.equal(door.open, false);

  ally1.x = 360;
  ally1.y = 160; // diagonal adjacent cell
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), true);

  // 2. 1 full empty cell away (1.5 cells = 120px, like Vex) -> blocked
  ally1.x = 280;
  ally1.y = 240;
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), false);
  assert.equal(Service.toggleDoor('d-reach'), null);
  assert.equal(door.open, false);

  // 3. Unassigned nearby ally does NOT grant reach when player has assigned token elsewhere
  const unassignedAlly = { id: 'ally-other', isAlly: true, size: 1, x: 360, y: 240, hidden: false };
  Service.state.tokens = [ally1, unassignedAlly];
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), false);

  // 4. Large 2x2, Huge 3x3, and Gargantuan 4x4 tokens diagonally adjacent -> can reach; 1 full empty cell away -> blocked
  ally1.size = 2;
  ally1.x = 320;
  ally1.y = 120;
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), true);
  ally1.x = 240;
  ally1.y = 240;
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), false);

  ally1.size = 3;
  ally1.x = 280;
  ally1.y = 80; // bottom-right corner (400, 200) touches door
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), true);
  ally1.x = 200;
  ally1.y = 240; // 1 full empty cell away
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), false);

  ally1.size = 4;
  ally1.x = 240;
  ally1.y = 40; // bottom-right corner (400, 200) touches door
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), true);
  ally1.x = 160;
  ally1.y = 240; // 1 full empty cell away
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), false);

  // 5. Blocking solid wall between adjacent token and door -> blocked
  ally1.size = 1;
  ally1.x = 340;
  ally1.y = 240;
  Service.state.walls.push({ id: 'w-block', kind: 'wall', x1: 360, y1: 160, x2: 360, y2: 320 });
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), false);
  assert.equal(Service.toggleDoor('d-reach'), null);

  // 6. GM has no distance or wall-occlusion limit
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  ally1.x = 80;
  assert.equal(Selector.canPlayerReachDoor(Service.state, door), true);
  assert.equal(Service.toggleDoor('d-reach')?.open, true);
});

test('S9: door-as-property supports any material, converts legacy doors, and never leaks secret doors', () => {
  // 1. Legacy mapping & normalizeWall
  assert.equal(normalizeWallKind('door'), 'wall');
  assert.equal(normalizeWallKind('secret'), 'wall');
  assert.equal(getWallDoorMode({ kind: 'door' }), 'normal');
  assert.equal(getWallDoorMode({ kind: 'secret' }), 'secret');
  assert.equal(getWallDoorMode({ kind: 'invisible', door: 'normal' }), 'normal');
  assert.equal(isWallDoor({ kind: 'invisible', door: 'normal' }), true);
  assert.equal(isWallSecretDoor({ kind: 'terrain', door: 'secret' }), true);

  const normLegacy = normalizeWall({ id: 'old-d', kind: 'door', open: true, locked: false });
  assert.deepEqual(
    { id: normLegacy.id, kind: normLegacy.kind, door: normLegacy.door, open: normLegacy.open, locked: normLegacy.locked },
    { id: 'old-d', kind: 'wall', door: 'normal', open: true, locked: false }
  );
  const normNonDoor = normalizeWall({ id: 'plain', kind: 'wall', open: true, locked: true });
  assert.equal(normNonDoor.door, 'none');
  assert.equal(normNonDoor.open, false);
  assert.equal(normNonDoor.locked, false);
  assert.equal(normalizeWalls([{ id: 'x', kind: 'secret' }])[0].door, 'secret');

  // 2. Grate door ({ kind: 'invisible', door: 'normal' }): never blocks sight; blocks movement only while closed
  const grateClosed = { id: 'g1', kind: 'invisible', door: 'normal', open: false };
  const grateOpen = { id: 'g1', kind: 'invisible', door: 'normal', open: true };
  assert.equal(isWallBlockingSight(grateClosed), false);
  assert.equal(isWallBlockingSight(grateOpen), false);
  assert.equal(isWallBlockingMovement(grateClosed), true);
  assert.equal(isWallBlockingMovement(grateOpen), false);

  // 3. Redaction: legacy secret & invisible secret never leak "secret" when closed; open secret becomes door: 'normal'
  const redacted = redactWallsForPlayer([
    { id: 's-legacy', kind: 'secret', open: false, locked: true },
    { id: 's-invis-closed', kind: 'invisible', door: 'secret', open: false, locked: true },
    { id: 's-invis-open', kind: 'invisible', door: 'secret', open: true, locked: false }
  ]);
  assert.equal(JSON.stringify(redacted).includes('"secret"'), false, 'Closed or open secret doors must never leak "secret"');
  assert.equal(redacted[0].kind, 'wall');
  assert.equal(redacted[0].door, 'none');
  assert.equal(redacted[1].kind, 'invisible');
  assert.equal(redacted[1].door, 'none');
  assert.equal(redacted[2].kind, 'invisible');
  assert.equal(redacted[2].door, 'normal');
  assert.equal(redacted[2].open, true);

  // 4. Service: setWallsKind preserves door + open, toggleDoor works on invisible door, player cannot toggle closed secret
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.walls = [];
  Service.setTool('wall');

  Service.applyWallKind('invisible');
  Service.applyWallDoor('normal');
  Service.addWallSegment(100, 100, 100, 200);
  const grate = Service.state.walls[0];
  assert.equal(grate.kind, 'invisible');
  assert.equal(grate.door, 'normal');

  assert.equal(Service.toggleDoor(grate.id)?.open, true, 'GM can toggle invisible door');
  Service.setWallsKind([grate.id], 'terrain');
  assert.equal(grate.kind, 'terrain');
  assert.equal(grate.door, 'normal', 'setWallsKind must preserve door property');
  assert.equal(grate.open, true, 'setWallsKind must preserve open state');

  Service.setWallsDoor([grate.id], 'secret');
  Service.toggleDoor(grate.id); // closes it
  assert.equal(grate.open, false);
  Service.state.role = 'player';
  assert.equal(Service.toggleDoor(grate.id), null, 'Player cannot toggle closed secret door');
});

test('S10: direct door stamp placement splits walls by click (1 cell) or drag (custom width), preserves material, supports undo, and linked-vertex resize keeps corners sealed', () => {
  const longWall = { id: 'w-long', x1: 0, y1: 200, x2: 400, y2: 200, kind: 'invisible', door: 'none', open: false, locked: false };
  const shortWall = { id: 'w-short', x1: 0, y1: 100, x2: 80, y2: 100, kind: 'wall', door: 'none', open: false, locked: false };

  // 1. projectPointOnWall clamps to [0, 1]
  const proj = projectPointOnWall(longWall, 200, 210);
  assert.equal(Math.round(proj.x), 200);
  assert.equal(Math.round(proj.y), 200);
  assert.equal(Math.round(proj.dist), 10);
  assert.equal(proj.t, 0.5);

  // 2. Single click on long wall -> 1-cell (80px) split centered near click
  const singleClick = computeDoorPlacementOnWall(longWall, { x: 200, y: 200 }, null, { cellSize: 80, snap: true });
  assert.equal(singleClick.mode, 'split');
  assert.equal(singleClick.x1, 160);
  assert.equal(singleClick.x2, 240);
  assert.equal(singleClick.widthPx, 80);

  // 3. Short wall -> convert in place
  const shortClick = computeDoorPlacementOnWall(shortWall, { x: 40, y: 100 }, null, { cellSize: 80, snap: true });
  assert.equal(shortClick.mode, 'convert');
  assert.equal(shortClick.x1, 0);
  assert.equal(shortClick.x2, 80);

  // 4. Drag along wall -> custom 2-cell (160px) door
  const dragTwoCells = computeDoorPlacementOnWall(
    longWall,
    { x: 80, y: 200 },
    { x: 240, y: 200 },
    { cellSize: 80, snap: true }
  );
  assert.equal(dragTwoCells.mode, 'split');
  assert.equal(dragTwoCells.x1, 80);
  assert.equal(dragTwoCells.x2, 240);
  assert.equal(dragTwoCells.widthPx, 160);

  // 5. Micro-stub < 12px snaps cleanly to wall end
  const nearStart = computeDoorPlacementOnWall(
    longWall,
    { x: 8, y: 200 },
    { x: 160, y: 200 },
    { cellSize: 80, snap: false }
  );
  assert.equal(nearStart.x1, 0);

  // 6. Service.insertDoorOnWall splits invisible wall into left + secret door + right, preserving kind, and undo restores
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.grid = { ...Service.state.grid, cellSize: 80, snap: true, type: 'square' };
  Service.state.walls = [{ ...longWall }];
  Service.setTool('wall');
  Service.setWallMode('door');
  Service.setWallDoorStampMode('secret');

  const res = Service.insertDoorOnWall('w-long', { x: 200, y: 200 }, null);
  assert.ok(res && res.door, 'insertDoorOnWall should return created door');
  assert.equal(Service.state.walls.length, 3);
  const [leftSeg, doorSeg, rightSeg] = Service.state.walls;
  assert.equal(leftSeg.kind, 'invisible');
  assert.equal(leftSeg.door, 'none');
  assert.equal(leftSeg.x2, doorSeg.x1);
  assert.equal(doorSeg.kind, 'invisible');
  assert.equal(doorSeg.door, 'secret');
  assert.equal(doorSeg.x1, 160);
  assert.equal(doorSeg.x2, 240);
  assert.equal(rightSeg.kind, 'invisible');
  assert.equal(rightSeg.door, 'none');
  assert.equal(rightSeg.x1, doorSeg.x2);

  Service.undo();
  assert.equal(Service.state.walls.length, 1);
  assert.equal(Service.state.walls[0].id, 'w-long');
  assert.equal(Service.state.walls[0].door, 'none');

  // 7. Linked-vertex endpoint move keeps door jamb and adjacent wall sealed together
  Service.insertDoorOnWall('w-long', { x: 200, y: 200 }, null);
  const [, dSeg, rSeg] = Service.state.walls;
  const linked = findConnectedWallEndpoints(Service.state.walls, dSeg.x2, dSeg.y2, { excludeWallId: dSeg.id, tol: 2 });
  assert.equal(linked.length, 1);
  assert.equal(linked[0].wallId, rSeg.id);
  assert.equal(linked[0].endKey, 'start');

  Service.moveWallEndpoint(dSeg.id, 'end', 280, 200, { commit: true, linkedEndpoints: linked });
  assert.equal(dSeg.x2, 280);
  assert.equal(rSeg.x1, 280, 'Adjacent wall start must move with door end to prevent light leaks');
});

test('S11: computeDoorResizePoint and computeDoorSlideOffset constrain along wall axis, snap to half-cell, and respect minStubPx', () => {
  const walls = [
    { id: 'w-left', x1: 0, y1: 200, x2: 160, y2: 200, kind: 'wall', door: 'none', open: false, locked: false },
    { id: 'd-mid', x1: 160, y1: 200, x2: 240, y2: 200, kind: 'wall', door: 'normal', open: false, locked: false },
    { id: 'w-right', x1: 240, y1: 200, x2: 400, y2: 200, kind: 'wall', door: 'none', open: false, locked: false }
  ];
  const door = walls[1];
  const linkedStart = [{ wallId: 'w-left', endKey: 'end' }];
  const linkedEnd = [{ wallId: 'w-right', endKey: 'start' }];

  // 1. Off-axis cursor (320, 260) while resizing 'end' stays strictly on y=200 and snaps to 320 (2-cell door)
  const widened = computeDoorResizePoint(door, 'end', linkedEnd, walls, 318, 260, { cellSize: 80, snap: true });
  assert.equal(widened.x, 320);
  assert.equal(widened.y, 200);
  assert.equal(widened.widthPx, 160);

  // 2. Resizing past right wall end clamps so right stub keeps >= minStubPx (12px -> max x = 388)
  const clampedMax = computeDoorResizePoint(door, 'end', linkedEnd, walls, 450, 200, { cellSize: 80, snap: false, minStubPx: 12 });
  assert.equal(clampedMax.x, 388);
  assert.equal(clampedMax.y, 200);

  // 3. Shrinking below minDoorPx clamps to minDoorPx (18px -> min x = 178)
  const clampedMin = computeDoorResizePoint(door, 'end', linkedEnd, walls, 100, 200, { cellSize: 80, snap: false, minDoorPx: 18 });
  assert.equal(clampedMin.x, 178);
  assert.equal(clampedMin.y, 200);

  // 4. Sliding door right by +82px snaps to +80px on x-axis
  const slideSnap = computeDoorSlideOffset(
    door,
    linkedStart,
    linkedEnd,
    walls,
    { x: 200, y: 200 },
    { x: 282, y: 245 },
    { cellSize: 80, snap: true }
  );
  assert.equal(slideSnap.dx, 80);
  assert.equal(slideSnap.dy, 0);
  assert.equal(slideSnap.shift, 80);

  // 5. Sliding far left clamps so left stub (160px) retains >= 12px (shift >= -148)
  const slideClamp = computeDoorSlideOffset(
    door,
    linkedStart,
    linkedEnd,
    walls,
    { x: 200, y: 200 },
    { x: -100, y: 200 },
    { cellSize: 80, snap: false, minStubPx: 12 }
  );
  assert.equal(slideClamp.dx, -148);
  assert.equal(slideClamp.dy, 0);
});

test('S12: Relief (terrain) walls stop innerPoly on 1st hit for subtle shading while poly reaches 2nd hit', () => {
  const segs = [
    { x1: 200, y1: 100, x2: 200, y2: 300, kind: 'terrain' },
    { x1: 300, y1: 100, x2: 300, y2: 300, kind: 'terrain' }
  ];
  const hitDefault = castVisibilityRay(100, 200, 1, 0, 500, segs);
  const hitFirst = castVisibilityRay(100, 200, 1, 0, 500, segs, { terrainBlocksOnFirstHit: true });
  assert.equal(Math.round(hitDefault.x), 300, 'Default 2nd-hit ray passes front face and blocks on back face');
  assert.equal(Math.round(hitFirst.x), 200, '1st-hit ray stops on front face of Relief obstacle');

  const st = createInitialState();
  st.role = 'gm';
  st.dynamicLighting = true;
  st.tokens = [{ id: 'hero', name: 'Hero', isAlly: true, x: 100, y: 200, size: 1, visionMeters: 20 }];
  st.walls = [
    { id: 't-front', x1: 200, y1: 100, x2: 200, y2: 300, kind: 'terrain', door: 'none' },
    { id: 't-back', x1: 300, y1: 100, x2: 300, y2: 300, kind: 'terrain', door: 'none' }
  ];
  const sourcesWithRelief = Selector.getAlliedVisibilityPolygons(st);
  assert.equal(sourcesWithRelief.length, 1);
  assert.ok(Array.isArray(sourcesWithRelief[0].innerPoly) && sourcesWithRelief[0].innerPoly.length >= 3);
  assert.equal(Selector.isPointInPolygon({ x: 250, y: 200 }, sourcesWithRelief[0].poly), true, 'Interior is inside outer poly');
  assert.equal(Selector.isPointInPolygon({ x: 250, y: 200 }, sourcesWithRelief[0].innerPoly), false, 'Interior is outside 1st-hit innerPoly');

  st.walls = [{ id: 'w-solid', x1: 200, y1: 100, x2: 200, y2: 300, kind: 'wall', door: 'none' }];
  const sourcesNoRelief = Selector.getAlliedVisibilityPolygons(st);
  assert.equal(sourcesNoRelief[0].innerPoly, null, 'No Relief walls -> innerPoly is null');
});

test('S13: Seleccionar filter (all/walls/lights), marquee light selection, light toggle, and unified scenery delete with undo', () => {
  const lights = [
    { id: 'l-1', x: 150, y: 150, sceneKey: 'bastion', enabled: false },
    { id: 'l-2', x: 400, y: 400, sceneKey: 'bastion', enabled: true }
  ];
  const inBox = findMapLightsInRect(lights, { x1: 100, y1: 100, x2: 200, y2: 200 });
  assert.deepEqual(inBox.map((l) => l.id), ['l-1']);

  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.mapId = 'bastion';
  Service.state.activeMapKey = 'bastion';
  Service.state.walls = [{ id: 'w-1', x1: 100, y1: 100, x2: 200, y2: 100, kind: 'wall', door: 'none' }];
  Service.state.mapLights = lights.map((l) => ({ ...l }));
  Service.setTool('wall');
  Service.setStageLayer('select');

  Service.setSelectedWallIds(['w-1']);
  Service.setSelectedMapLightIds(['l-1']);
  assert.deepEqual(Service.state.selectedWallIds, ['w-1']);
  assert.deepEqual(Service.state.selectedMapLightIds, ['l-1']);

  // Switching filter to 'walls' clears selected lights; switching to 'lights' clears selected walls
  Service.setStageSelectFilter('walls');
  assert.deepEqual(Service.state.selectedMapLightIds, []);
  Service.setSelectedMapLightIds(['l-1']);
  Service.setStageSelectFilter('lights');
  assert.deepEqual(Service.state.selectedWallIds, []);

  // Toggle selected lights enabled
  const toggled = Service.setSelectedMapLightsEnabled(true);
  assert.equal(toggled, 1);
  assert.equal(Service.state.mapLights.find((l) => l.id === 'l-1').enabled, true);

  // Unified delete of both walls and lights with undo
  Service.setStageSelectFilter('all');
  Service.setSelectedWallIds(['w-1']);
  Service.setSelectedMapLightIds(['l-1']);
  const del = Service.deleteSelectedScenery();
  assert.equal(del.walls, 1);
  assert.equal(del.lights, 1);
  assert.equal(del.total, 2);
  assert.equal(Service.state.walls.length, 0);
  assert.equal(Service.state.mapLights.length, 1);
  assert.deepEqual(Service.state.selectedWallIds, []);
  assert.deepEqual(Service.state.selectedMapLightIds, []);

  Service.undo();
  assert.equal(Service.state.walls.length, 1);
  assert.equal(Service.state.mapLights.length, 2);
});




