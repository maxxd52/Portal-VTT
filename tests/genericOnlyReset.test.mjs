import test from 'node:test';
import assert from 'node:assert/strict';

if (!globalThis.window) {
  globalThis.window = { location: { search: '' }, innerWidth: 1280, innerHeight: 720 };
}

const { SYSTEM_PRESETS, createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { GM_SCREEN_PRESETS } = await import('../js/data/gmScreenPresets.js?v=20261125a1');
const {
  COMPENDIUM_ACTORS,
  COMPENDIUM_ITEMS,
  COMPENDIUM_MAPS,
  buildPresetWallsForMap
} = await import('../js/data/compendium.js?v=20261125a1');

test('Only generic system preset and generic GM screen preset exist', () => {
  assert.deepEqual(Object.keys(SYSTEM_PRESETS), ['free']);
  assert.deepEqual(Object.keys(GM_SCREEN_PRESETS), ['free']);
});

test('Built-in compendium actors, items, maps, and preset walls are empty', () => {
  assert.deepEqual(COMPENDIUM_ACTORS, []);
  assert.deepEqual(COMPENDIUM_ITEMS, []);
  assert.deepEqual(COMPENDIUM_MAPS, []);
  assert.deepEqual(buildPresetWallsForMap('bastion'), []);
  assert.deepEqual(buildPresetWallsForMap('crypt'), []);
});

test('createInitialState starts with generic system on empty tabletop and zero tokens', () => {
  const st = createInitialState();
  assert.equal(st.ruleset, 'free');
  assert.equal(st.systemConfig.preset, 'free');
  assert.equal(st.mapId, 'empty');
  assert.equal(st.activeMapKey, 'empty');
  assert.deepEqual(st.walls, []);
  assert.deepEqual(st.tokens, []);
  assert.equal(st.selectedTokenId, null);
  assert.ok(Array.isArray(st.systemConfig.sheetBlocks) && st.systemConfig.sheetBlocks.length > 0);
});

test('applyFullWorldState migrates legacy dnd55 preset and bastion map to free + empty', () => {
  Service.state = createInitialState();
  Service.applyFullWorldState(
    {
      ruleset: 'dnd55',
      systemConfig: { preset: 'dnd55', rollFormula: '1d20+@stat' },
      mapId: 'bastion',
      activeMapKey: 'bastion',
      tokens: []
    },
    true
  );
  assert.equal(Service.state.ruleset, 'free');
  assert.equal(Service.state.systemConfig.preset, 'free');
  assert.equal(Service.state.mapId, 'empty');
  assert.equal(Service.state.activeMapKey, 'empty');
});
