import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

if (!globalThis.window) {
  globalThis.window = { location: { search: '' }, innerWidth: 1280, innerHeight: 720 };
}

const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');

function resetGmState() {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.undoStack = [];
  Service.redoStack = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  return Service.state;
}

test('Service.duplicateCustomItem returns null for unknown key and deep-clones custom item with unique keys', () => {
  const state = resetGmState();
  assert.equal(Service.duplicateCustomItem('missing-key'), null);

  const orig = Service.saveCustomItem({
    name: 'Espada Solar',
    kind: 'equipment',
    folder: 'Armas',
    formula: '1d8+@vig',
    passives: [{ target: 'ac', value: 1 }],
    steps: [{ type: 'roll', rollKind: 'attack', label: 'Tajo', formula: '1d20+@vig' }],
    icon: 'sword',
    color: '#f59e0b'
  });
  state.compendiumFolderOverrides.items[orig.key] = 'Reliquias';

  const copy1 = Service.duplicateCustomItem(orig.key);
  const copy2 = Service.duplicateCustomItem(orig.key);

  assert.ok(copy1 && copy2);
  assert.notEqual(copy1.key, orig.key);
  assert.notEqual(copy2.key, orig.key);
  assert.notEqual(copy1.key, copy2.key);
  assert.equal(copy1.isCustom, true);
  assert.equal(copy1.name, 'Espada Solar (Copia)');
  assert.equal(copy1.folder, 'Reliquias');
  assert.equal(copy1.formula, '1d8+@vig');

  // Deep clone verification: mutating copy1 does not affect orig
  copy1.passives[0].value = 99;
  copy1.steps[0].label = 'Mutado';
  assert.equal(orig.passives[0].value, 1);
  assert.equal(orig.steps[0].label, 'Tajo');
});

test('Service.duplicateCustomMap returns null for unknown key and clones config, walls, lights, and resets explored fog', () => {
  const state = resetGmState();
  assert.equal(Service.duplicateCustomMap('missing-map'), null);

  const orig = Service.saveCustomMap({
    name: 'Torre del Alba',
    desc: 'Torre de vigilancia',
    folder: 'Fortalezas',
    imageUrl: 'data:image/webp;base64,TOWER',
    sceneMode: 'tactical',
    weather: 'rain',
    grid: { type: 'hex-v', cellSize: 64, color: 'light', opacity: 0.35 },
    lighting: { dynamicLighting: true, rememberExplored: true }
  });
  state.compendiumFolderOverrides.maps[orig.key] = 'Campaña';
  state.sceneLighting[orig.key].ambient = 'night';
  state.sceneLighting[orig.key].exploredMask = 'data:image/png;base64,OLD_MASK';
  state.sceneLighting[orig.key].exploredRev = 7;
  state.sceneWeathers[orig.key] = 'rain';
  state.sceneLayers[orig.key] = {
    tokens: [{ id: 't-old', name: 'Viejo' }],
    walls: [{ id: 'w-1', x1: 100, y1: 100, x2: 400, y2: 100, kind: 'wall', open: false }],
    strokes: [{ id: 's-1', points: [{ x: 10, y: 10 }] }]
  };
  state.mapLights = [
    { id: 'ml-1', sceneKey: orig.key, x: 200, y: 200, radiusMeters: 9, tone: 'warm', enabled: true },
    { id: 'ml-other', sceneKey: 'other-scene', x: 50, y: 50, radiusMeters: 6, tone: 'warm', enabled: true }
  ];

  const copy = Service.duplicateCustomMap(orig.key);
  assert.ok(copy);
  assert.notEqual(copy.key, orig.key);
  assert.equal(copy.isCustom, true);
  assert.equal(copy.name, 'Torre del Alba (Copia)');
  assert.equal(copy.desc, 'Torre de vigilancia');
  assert.equal(copy.imageUrl, 'data:image/webp;base64,TOWER');
  assert.equal(copy.folder, 'Campaña');
  assert.equal(copy.sceneMode, 'tactical');
  assert.equal(copy.weather, 'rain');
  assert.equal(state.sceneWeathers[copy.key], 'rain');
  assert.equal(copy.grid.type, 'hex-v');
  assert.equal(copy.grid.cellSize, 64);

  // Lighting copied with ambient preserved, but explored fog reset
  assert.equal(state.sceneLighting[copy.key].dynamicLighting, true);
  assert.equal(state.sceneLighting[copy.key].rememberExplored, true);
  assert.equal(state.sceneLighting[copy.key].ambient, 'night');
  assert.equal(state.sceneLighting[copy.key].exploredMask, '');
  assert.equal(state.sceneLighting[copy.key].exploredRev, 0);

  // Walls deep-cloned, tokens/strokes empty
  assert.equal(state.sceneLayers[copy.key].walls.length, 1);
  assert.deepEqual(state.sceneLayers[copy.key].tokens, []);
  assert.deepEqual(state.sceneLayers[copy.key].strokes, []);
  state.sceneLayers[copy.key].walls[0].x2 = 999;
  assert.equal(state.sceneLayers[orig.key].walls[0].x2, 400);

  // Map lights cloned with new IDs
  const copiedLights = state.mapLights.filter((l) => l.sceneKey === copy.key);
  assert.equal(copiedLights.length, 1);
  assert.notEqual(copiedLights[0].id, 'ml-1');
  assert.equal(copiedLights[0].radiusMeters, 9);
});

test('compendiumView.js wires Duplicar para editar for items and maps', () => {
  const src = readFileSync(path.resolve('js/ui/compendiumView.js'), 'utf8');
  assert.match(src, /Service\.duplicateCustomItem/);
  assert.match(src, /Service\.duplicateCustomMap/);
});
