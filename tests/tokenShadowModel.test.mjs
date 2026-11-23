import test from 'node:test';
import assert from 'node:assert/strict';

const {
  hasWallOcclusion,
  collectVisibleLightSources,
  computeTokenCastShadow,
  computeContactShadowModulation,
  buildShadowCacheKey,
  resolveDynamicShadowMode
} = await import('../js/utils/tokenShadowModel.js?v=20261123a7');

test('hasWallOcclusion blocks solid walls and closed doors, while letting light pass open doors', () => {
  const solidWall = [{ id: 'w1', kind: 'wall', x1: 200, y1: 0, x2: 200, y2: 400 }];
  assert.equal(hasWallOcclusion(100, 200, 300, 200, solidWall), true);
  assert.equal(hasWallOcclusion(100, 200, 150, 200, solidWall), false);

  const closedDoor = [{ id: 'd1', kind: 'door', open: false, x1: 200, y1: 0, x2: 200, y2: 400 }];
  assert.equal(hasWallOcclusion(100, 200, 300, 200, closedDoor), true);

  const openDoor = [{ id: 'd2', kind: 'door', open: true, x1: 200, y1: 0, x2: 200, y2: 400 }];
  assert.equal(hasWallOcclusion(100, 200, 300, 200, openDoor), false);
});

test('computeTokenCastShadow projects opposite to strongest unoccluded light and ignores lights behind walls', () => {
  const grid = { type: 'square', cellSize: 80, metersPerUnit: 1.5 };
  const torchLeft = { id: 'torch-L', x: 100, y: 200, lightMeters: 9, hidden: false };
  const hero = { id: 'hero', x: 240, y: 200, size: 1, hidden: false };

  const sources = collectVisibleLightSources([torchLeft, hero], grid);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, 'torch-L');

  // Light to the left -> shadow projects to the right (+offsetX)
  const cast = computeTokenCastShadow(hero, sources, [], { diameterPx: 68, dynamicShadowsEnabled: true });
  assert.equal(cast.active, true);
  assert.equal(cast.sourceId, 'torch-L');
  assert.ok(cast.offsetX > 5, `expected rightward cast shadow (+X), got ${cast.offsetX}`);
  assert.ok(Math.abs(cast.offsetY) < 2);
  assert.ok(cast.opacity >= 0.16 && cast.opacity <= 0.48);

  // Wall between torchLeft and hero blocks that light -> falls back to subtle ambient direction (not torch-L)
  const wall = [{ id: 'w1', kind: 'wall', x1: 170, y1: 100, x2: 170, y2: 300 }];
  const blocked = computeTokenCastShadow(hero, sources, wall, { diameterPx: 68, dynamicShadowsEnabled: true });
  assert.notEqual(blocked.sourceId, 'torch-L');
  assert.equal(blocked.active, true);
  assert.equal(blocked.isAmbientFallback, true);
});

test('collectVisibleLightSources never leaks hidden tokens into light list and dynamicShadowsEnabled=false disables cast shadows', () => {
  const grid = { type: 'square', cellSize: 80, metersPerUnit: 1.5 };
  const hiddenEnemyTorch = { id: 'enemy', x: 120, y: 200, lightMeters: 12, hidden: true, isAlly: false };
  const hero = { id: 'hero', x: 200, y: 200, size: 1, hidden: false };

  const sources = collectVisibleLightSources([hiddenEnemyTorch, hero], grid);
  assert.equal(sources.length, 0, 'hidden tokens must never produce light sources');

  const disabled = computeTokenCastShadow(hero, [{ id: 'l1', x: 100, y: 200, radiusPx: 400 }], [], {
    diameterPx: 68,
    dynamicShadowsEnabled: false
  });
  assert.equal(disabled.active, false);
});

test('computeContactShadowModulation attenuates contact halo for flying or lifted tokens and cache key tracks geometry changes', () => {
  const grounded = computeContactShadowModulation({ conditions: [] }, 0);
  const flying = computeContactShadowModulation({ conditions: ['flying'] }, 0);
  const lifted = computeContactShadowModulation({ conditions: [] }, 10);

  assert.ok(flying.opacity < grounded.opacity, 'flying token should have softer contact shadow');
  assert.ok(flying.offsetY > grounded.offsetY);
  assert.ok(lifted.opacity < grounded.opacity);

  const k1 = buildShadowCacheKey({ id: 'h', x: 100, y: 100, size: 1 }, [{ id: 'l', x: 50, y: 50, radiusPx: 300 }], [], true);
  const k2 = buildShadowCacheKey({ id: 'h', x: 100, y: 100, size: 1 }, [{ id: 'l', x: 50, y: 50, radiusPx: 300 }], [], true);
  const kMoved = buildShadowCacheKey({ id: 'h', x: 140, y: 100, size: 1 }, [{ id: 'l', x: 50, y: 50, radiusPx: 300 }], [], true);
  assert.equal(k1, k2);
  assert.notEqual(k1, kMoved);
});

test('resolveDynamicShadowMode respects user override and auto-disables on low-end mobile devices', () => {
  assert.equal(resolveDynamicShadowMode('on', { hardwareConcurrency: 2, deviceMemory: 2 }), true);
  assert.equal(resolveDynamicShadowMode('off', { hardwareConcurrency: 16, deviceMemory: 8 }), false);
  assert.equal(resolveDynamicShadowMode('auto', { deviceMemory: 2, hardwareConcurrency: 8 }), false);
  assert.equal(resolveDynamicShadowMode('auto', { hardwareConcurrency: 4, isCoarsePointer: true }), false);
  assert.equal(resolveDynamicShadowMode('auto', { hardwareConcurrency: 8, isCoarsePointer: false }), true);
});
