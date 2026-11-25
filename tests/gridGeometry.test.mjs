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
  axialToPixel,
  fitGridToBounds,
  measureGridDistance,
  normalizeGridConfig,
  resolveGridStrokeStyle,
  snapToGrid
} = await import('../js/utils/gridGeometry.js?v=20261125a1');
const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261125a1');

test('normalizeGridConfig provides safe defaults and clamps invalid or out-of-range fields', () => {
  assert.deepEqual(normalizeGridConfig({}), {
    type: 'square',
    cellSize: 80,
    metersPerUnit: 1.5,
    offsetX: 0,
    offsetY: 0,
    opacity: 0.28,
    snap: true,
    color: 'auto'
  });

  const clamped = normalizeGridConfig({
    type: 'triangle',
    cellSize: 999,
    metersPerUnit: 99,
    offsetX: -650,
    offsetY: 500,
    opacity: 2,
    snap: false,
    color: 'neon'
  });
  assert.deepEqual(clamped, {
    type: 'square',
    cellSize: 300,
    metersPerUnit: 50,
    offsetX: -300,
    offsetY: 300,
    opacity: 0.85,
    snap: false,
    color: 'auto'
  });

  assert.equal(normalizeGridConfig({ cellSize: 5 }).cellSize, 16);
  assert.equal(normalizeGridConfig({ metersPerUnit: 0.1 }).metersPerUnit, 0.5);
  assert.equal(normalizeGridConfig({ opacity: 0 }).opacity, 0);
  assert.equal(normalizeGridConfig({ type: 'none' }).type, 'none');
  assert.equal(normalizeGridConfig({ type: 'hex-v', color: 'dark' }).type, 'hex-v');
  assert.equal(normalizeGridConfig({ type: 'hex-h', color: 'light' }).color, 'light');
});

test('snapToGrid and Selector.snapPosition handle square (1x1, 2x2), hex-v, hex-h, none, and snap=false', () => {
  const sqGrid = normalizeGridConfig({ type: 'square', cellSize: 80, offsetX: 10, offsetY: 20, snap: true });
  assert.deepEqual(snapToGrid(sqGrid, 125, 135, 1), { x: 130, y: 140 });
  assert.deepEqual(snapToGrid(sqGrid, 165, 175, 2), { x: 170, y: 180 });

  for (const hexType of ['hex-v', 'hex-h']) {
    const hexGrid = normalizeGridConfig({ type: hexType, cellSize: 80, offsetX: 15, offsetY: -12, snap: true });
    const center = axialToPixel(hexGrid, 2, -1);
    assert.deepEqual(snapToGrid(hexGrid, center.x, center.y), center, `${hexType} center roundtrips cleanly`);

    const nudged = snapToGrid(hexGrid, center.x + 11, center.y - 8);
    assert.deepEqual(nudged, center, `${hexType} off-center point snaps to nearest hex center`);

    const state = createInitialState();
    state.grid = hexGrid;
    assert.deepEqual(Selector.snapPosition(state, center.x + 11, center.y - 8, 1), center);
  }

  const freeGrid = normalizeGridConfig({ type: 'hex-v', snap: false });
  assert.deepEqual(snapToGrid(freeGrid, 123.4, 567.8), { x: 123.4, y: 567.8 });

  const gridless = normalizeGridConfig({ type: 'none', cellSize: 80, snap: true });
  assert.deepEqual(snapToGrid(gridless, 211.7, 349.2), { x: 211.7, y: 349.2 });
});

test('measureGridDistance computes exact square/gridless euclidean units and hex axial steps', () => {
  const sq = normalizeGridConfig({ type: 'square', cellSize: 80 });
  assert.equal(measureGridDistance(sq, 40, 40, 200, 40), 2);
  assert.equal(measureGridDistance(sq, 40, 40, 120, 120), 1.4);

  const gridless = normalizeGridConfig({ type: 'none', cellSize: 80 });
  assert.equal(measureGridDistance(gridless, 40, 40, 200, 40), 2);
  assert.equal(measureGridDistance(gridless, 0, 0, 120, 160), 2.5);

  for (const hexType of ['hex-v', 'hex-h']) {
    const hex = normalizeGridConfig({ type: hexType, cellSize: 80, offsetX: 0, offsetY: 0 });
    const origin = axialToPixel(hex, 0, 0);
    assert.equal(measureGridDistance(hex, origin.x, origin.y, origin.x + 4, origin.y - 3), 0);

    const step1 = axialToPixel(hex, 1, -1);
    assert.equal(measureGridDistance(hex, origin.x, origin.y, step1.x, step1.y), 1);

    const step2 = axialToPixel(hex, 2, 0);
    assert.equal(measureGridDistance(hex, origin.x, origin.y, step2.x, step2.y), 2);

    const step3 = axialToPixel(hex, -1, 3);
    assert.equal(measureGridDistance(hex, origin.x, origin.y, step3.x, step3.y), 3);
  }
});

test('fitGridToBounds calculates accurate cellSize and offsets for square, hex-v, and hex-h', () => {
  assert.deepEqual(
    fitGridToBounds({ cols: 24, type: 'square', boundsWidth: 2400, boundsHeight: 1600, boundsX: 12, boundsY: 20 }),
    { cellSize: 100, offsetX: 12, offsetY: 20 }
  );
  assert.deepEqual(
    fitGridToBounds({ rows: 20, type: 'square', boundsWidth: 2400, boundsHeight: 1600 }),
    { cellSize: 80, offsetX: 0, offsetY: 0 }
  );

  const hexVByCols = fitGridToBounds({ cols: 20, type: 'hex-v', boundsWidth: 2000, boundsHeight: 1200 });
  assert.equal(hexVByCols.cellSize, 100);

  const hexVByRows = fitGridToBounds({ rows: 10, type: 'hex-v', boundsWidth: 2000, boundsHeight: 1550 });
  const expectedVRows = Math.round(((1550 * Math.sqrt(3)) / (1.5 * 10 + 0.5)) * 100) / 100;
  assert.equal(hexVByRows.cellSize, expectedVRows);

  const hexHByCols = fitGridToBounds({ cols: 12, type: 'hex-h', boundsWidth: 1850, boundsHeight: 1200 });
  const expectedHCols = Math.round(((1850 * Math.sqrt(3)) / (1.5 * 12 + 0.5)) * 100) / 100;
  assert.equal(hexHByCols.cellSize, expectedHCols);

  const hexHByRows = fitGridToBounds({ rows: 15, type: 'hex-h', boundsWidth: 2000, boundsHeight: 1500 });
  assert.equal(hexHByRows.cellSize, 100);
});

test('resolveGridStrokeStyle respects auto theme polarity and explicit light/dark overrides', () => {
  assert.equal(resolveGridStrokeStyle({ color: 'auto', opacity: 0.3 }, 'slate'), 'rgba(226, 232, 240, 0.3)');
  assert.equal(resolveGridStrokeStyle({ color: 'auto', opacity: 0.3 }, 'parchment'), 'rgba(15, 23, 42, 0.3)');
  assert.equal(resolveGridStrokeStyle({ color: 'auto', opacity: 0.3 }, 'light'), 'rgba(15, 23, 42, 0.3)');
  assert.equal(resolveGridStrokeStyle({ color: 'dark', opacity: 0.4 }, 'slate'), 'rgba(15, 23, 42, 0.4)');
  assert.equal(resolveGridStrokeStyle({ color: 'light', opacity: 0.4 }, 'parchment'), 'rgba(226, 232, 240, 0.4)');
});

test('Service.updateMapGridForScene and changeMap preserve independent square/hex grids per scene and sync active updates', async () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);

  try {
    Service.cancelAllTokenGlides();
    Service.listeners = [];
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.isHostGm = true;
    Service.state.mapId = 'bastion';
    Service.state.activeMapKey = 'bastion';

    // Configure active bastion map as hex-v with dark lines
    Service.updateMapGridForScene('bastion', { type: 'hex-v', cellSize: 72, color: 'dark', opacity: 0.45 });
    assert.equal(Service.state.grid.type, 'hex-v');
    assert.equal(Service.state.grid.cellSize, 72);
    assert.equal(Service.state.grid.color, 'dark');
    assert.ok(sent.some((p) => p.kind === 'WORLD_SYNC'), 'Active scene grid update broadcasts WORLD_SYNC');

    // Configure inactive forest map as hex-h without overwriting active bastion grid
    sent.length = 0;
    Service.updateMapGridForScene('forest', { type: 'hex-h', cellSize: 96, color: 'light', offsetX: 14 });
    assert.equal(Service.state.grid.type, 'hex-v', 'Updating inactive scene keeps active grid untouched');
    assert.equal(sent.length, 0);

    // Switch to forest -> loads hex-h config
    await Service.changeMap('forest');
    assert.equal(Service.state.grid.type, 'hex-h');
    assert.equal(Service.state.grid.cellSize, 96);
    assert.equal(Service.state.grid.color, 'light');
    assert.equal(Service.state.grid.offsetX, 14);

    // Switch back to bastion -> recovers hex-v config
    await Service.changeMap('bastion');
    assert.equal(Service.state.grid.type, 'hex-v');
    assert.equal(Service.state.grid.cellSize, 72);
    assert.equal(Service.state.grid.color, 'dark');
  } finally {
    RealtimeBridge.send = origSend;
  }
});
