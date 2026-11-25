import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
  isWallBlockingMovement,
  isWallBlockingSight,
  redactWallsForPlayer,
  cloneWallsAtPoint,
  findWallEndpointNearPoint
} = await import('../js/utils/wallGeometry.js?v=20261125a1');
const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { hasWallOcclusion } = await import('../js/utils/tokenShadowModel.js?v=20261125a1');
const { collectWallShadowSegments } = await import('../js/utils/tabletopMaterial.js?v=20261125a1');
const { buildWallMenuSpec } = await import('../js/utils/contextMenuModel.js?v=20261125a1');

test('S8: invisible/grate wall lets light & shadows pass, blocks player movement, and appears in menu & pill', () => {
  assert.ok(WALL_KINDS.includes('invisible'), 'WALL_KINDS must include invisible');
  assert.equal(isWallBlockingMovement({ kind: 'invisible', open: false }), true);
  assert.equal(isWallBlockingSight({ kind: 'invisible', open: false }), false);
  assert.equal(isWallBlockingSight({ kind: 'wall', open: false }), true);
  assert.equal(isWallBlockingSight({ kind: 'door', open: true }), false);

  const grate = { id: 'w-grate', x1: 400, y1: 100, x2: 400, y2: 300, kind: 'invisible', open: false };

  // Light and shadows pass through invisible wall
  const poly = Selector.computeVisibilityPolygon({ x: 300, y: 200 }, 250, [grate]);
  assert.equal(Selector.isPointInPolygon({ x: 480, y: 200 }, poly), true, 'Vision must pass through invisible/grate wall');
  assert.equal(hasWallOcclusion(300, 200, 480, 200, [grate]), false, 'Cast shadows must not be occluded by invisible wall');
  assert.equal(collectWallShadowSegments([grate]).length, 0, 'Invisible walls must not cast dark wall shadows');

  // Redaction preserves invisible wall for player collision
  const redacted = redactWallsForPlayer([grate]);
  assert.equal(redacted[0].kind, 'invisible');

  // Player movement is blocked by invisible wall, GM passes freely
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.walls = [grate];
  Service.state.tokens = [{ id: 'tok-p', name: 'Hero', isAlly: true, x: 320, y: 200, size: 1 }];
  Service.state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p'] }];
  Service.state.activeInviteId = 'inv-1';
  Service.state.role = 'player';
  Service.state.isHostGm = false;

  Service.moveToken('tok-p', 480, 200, true);
  assert.ok(Service.state.tokens[0].x < 400, 'Player must be blocked by invisible/grate wall');

  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.moveToken('tok-p', 480, 200, true);
  assert.ok(Service.state.tokens[0].x > 400, 'GM must pass freely across invisible wall');

  // Context menu & HTML pill include invisible wall and duplicate action
  const spec = buildWallMenuSpec([grate]);
  const flat = spec.sections.flat();
  assert.ok(flat.some((i) => i.id === 'kind-invisible' && i.checked), 'Wall context menu must include kind-invisible');
  assert.ok(flat.some((i) => i.id === 'duplicate-walls'), 'Wall context menu must include duplicate-walls');

  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.match(html, /data-wall-kind="invisible"/, '#wallModePill must include Translúcido (invisible) button');
  assert.match(html, /id="wallDrawToolSeg"/, '#wallModePill must include #wallDrawToolSeg');
  assert.match(html, /data-wall-mode="door"/, '#wallDrawToolSeg must include Puerta mode');
  assert.match(html, /id="stageSelectFilterSeg"/, '#wallModePill must include #stageSelectFilterSeg');
  assert.doesNotMatch(html, /data-wall-kind="(door|secret)"/, 'Door must not be a data-wall-kind');

  const stageBlockMatch = html.match(/id="stageWallsControls"[\s\S]*?<\/div>\s*<div id="stageLightsControls"/);
  assert.ok(stageBlockMatch, 'stageWallsControls block must exist in index.html');
  const stageBlock = stageBlockMatch[0];
  assert.match(stageBlock, /<svg\b/, '#stageWallsControls must use inline monochrome SVG icons');
  for (const emoji of ['🧱', '🏛', '🪟', '🚪', '🔮', '✏️']) {
    assert.equal(stageBlock.includes(emoji), false, `#stageWallsControls must not contain raw emoji ${emoji}`);
  }
});

test('S8: wall copy/paste, batch move, and endpoint vertex editing preserve geometry and support undo', () => {
  const pillar = [
    { id: 'p1', x1: 100, y1: 100, x2: 180, y2: 100, kind: 'terrain', open: false },
    { id: 'p2', x1: 180, y1: 100, x2: 180, y2: 180, kind: 'terrain', open: false },
    { id: 'p3', x1: 180, y1: 180, x2: 100, y2: 180, kind: 'terrain', open: false },
    { id: 'p4', x1: 100, y1: 180, x2: 100, y2: 100, kind: 'terrain', open: false }
  ];

  // Pure cloneWallsAtPoint centers shape at target (500, 400)
  const cloned = cloneWallsAtPoint(pillar, 500, 400);
  assert.equal(cloned.length, 4);
  assert.notEqual(cloned[0].id, 'p1');
  assert.equal(cloned[0].x1, 460);
  assert.equal(cloned[0].y1, 360);
  assert.equal(cloned[1].x2, 540);
  assert.equal(cloned[1].y2, 440);

  // Pure endpoint hit detection (shared corner picks topmost wall; isolated wall picks exact endKey)
  const hitCorner = findWallEndpointNearPoint(pillar, 104, 102, 14);
  assert.equal(hitCorner?.x, 100);
  assert.equal(hitCorner?.y, 100);
  const hitStart = findWallEndpointNearPoint([pillar[0]], 104, 102, 14);
  assert.equal(hitStart?.wall.id, 'p1');
  assert.equal(hitStart?.endKey, 'start');

  // Service copy/paste + undo
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.walls = JSON.parse(JSON.stringify(pillar));
  Service.setSelectedWallIds(['p1', 'p2', 'p3', 'p4']);

  assert.equal(Service.copySelectedWalls(), 4);
  const pasted = Service.pasteWallsAt(600, 500);
  assert.equal(pasted.length, 4);
  assert.equal(Service.state.walls.length, 8);
  assert.deepEqual(Service.state.selectedWallIds, pasted.map((w) => w.id));

  Service.undo();
  assert.equal(Service.state.walls.length, 4, 'Undo must remove pasted walls in one step');

  // Service moveWallsByDelta + undo
  Service.moveWallsByDelta(['p1', 'p2'], 40, -20);
  assert.equal(Service.state.walls[0].x1, 140);
  assert.equal(Service.state.walls[0].y1, 80);
  assert.equal(Service.state.walls[1].x2, 220);
  Service.undo();
  assert.equal(Service.state.walls[0].x1, 100);

  // Service moveWallEndpoint + undo
  Service.moveWallEndpoint('p1', 'end', 240, 110);
  assert.equal(Service.state.walls[0].x2, 240);
  assert.equal(Service.state.walls[0].y2, 110);
  Service.undo();
  assert.equal(Service.state.walls[0].x2, 180);
});

test('S8-PERF: visibility polygon cache reuses stationary ally polygons and invalidates on token/wall changes; canvasView caches base fog', () => {
  const state = createInitialState();
  state.role = 'gm';
  state.dynamicLighting = true;
  state.walls = [
    { id: 'w1', x1: 400, y1: 100, x2: 400, y2: 400, kind: 'wall', open: false }
  ];
  state.tokens = [
    { id: 't1', name: 'A', isAlly: true, x: 200, y: 200, size: 1, visionMeters: 12, lightMeters: 0 },
    { id: 't2', name: 'B', isAlly: true, x: 600, y: 200, size: 1, visionMeters: 12, lightMeters: 0 }
  ];

  const pass1 = Selector.getAlliedVisibilityPolygons(state);
  const pass2 = Selector.getAlliedVisibilityPolygons(state);
  assert.equal(pass1[0].poly, pass2[0].poly, 'Unchanged token t1 must reuse cached visibility polygon');
  assert.equal(pass1[1].poly, pass2[1].poly, 'Unchanged token t2 must reuse cached visibility polygon');

  // Move only t1 -> t1 recalculates, t2 stays cached
  state.tokens[0].x = 240;
  const pass3 = Selector.getAlliedVisibilityPolygons(state);
  assert.notEqual(pass3[0].poly, pass2[0].poly, 'Moved token t1 must recompute polygon');
  assert.equal(pass3[1].poly, pass2[1].poly, 'Stationary token t2 must keep cached polygon');

  // Mutate a wall -> both invalidate
  state.walls[0].x1 = 420;
  const pass4 = Selector.getAlliedVisibilityPolygons(state);
  assert.notEqual(pass4[1].poly, pass3[1].poly, 'Wall mutation must invalidate cached visibility polygons');

  const canvasJs = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasJs, /getFogBaseCanvas\s*\(/, 'canvasView must pre-cache base fog mist + cool glaze layer');
});
