import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { location: { search: '' }, innerWidth: 1280, innerHeight: 720 };
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.has(k) ? this._store.get(k) : null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); }
};

const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { Selector } = await import('../js/core/selector.js?v=20261123a7');
const { Service } = await import('../js/core/service.js?v=20261123a7');
const {
  parseDragSpec,
  resolveDropAction,
  resolveEntryFolder
} = await import('../js/utils/compendiumDragModel.js?v=20261123a7');

test('S1-DND: resolveDropAction enforces strict drop targets for map, actor, item, and Baúl folders', () => {
  assert.deepEqual(parseDragSpec('map:bastion'), { kind: 'map', tab: 'maps', key: 'bastion' });
  assert.deepEqual(parseDragSpec('actor:goblin'), { kind: 'actor', tab: 'actors', key: 'goblin' });
  assert.deepEqual(parseDragSpec('item:espada'), { kind: 'item', tab: 'items', key: 'espada' });
  assert.equal(parseDragSpec('unknown:1'), null);

  // Maps
  assert.equal(
    resolveDropAction({ dragSpec: 'map:bastion', inTokenDrawer: true, inDrawerRoot: true }).action,
    'move_to_root'
  );
  assert.deepEqual(
    resolveDropAction({ dragSpec: 'map:bastion', inTokenDrawer: true, folderTarget: 'Mazmorras' }),
    { action: 'move_to_folder', tab: 'maps', key: 'bastion', folder: 'Mazmorras' }
  );
  assert.equal(resolveDropAction({ dragSpec: 'map:bastion', inStage: false, inTokenDrawer: false }).action, 'cancel');
  assert.deepEqual(
    resolveDropAction({ dragSpec: 'map:bastion', inStage: true }),
    { action: 'activate_map', key: 'bastion' }
  );

  // Actors
  assert.equal(resolveDropAction({ dragSpec: 'actor:goblin', inTokenDrawer: true, inDrawerRoot: true }).action, 'move_to_root');
  assert.equal(resolveDropAction({ dragSpec: 'actor:goblin', inStage: false, inTokenDrawer: false }).action, 'cancel');
  assert.deepEqual(
    resolveDropAction({ dragSpec: 'actor:goblin', inStage: true }),
    { action: 'spawn_actor', key: 'goblin' }
  );

  // Items
  assert.equal(resolveDropAction({ dragSpec: 'item:espada', inStage: true, tokenId: '', inCharacterSheet: false }).action, 'cancel');
  assert.equal(resolveDropAction({ dragSpec: 'item:espada', inStage: true, tokenId: 't1', inMapNote: true }).action, 'cancel');
  assert.deepEqual(
    resolveDropAction({ dragSpec: 'item:espada', inStage: true, tokenId: 't1' }),
    { action: 'equip_item', key: 'espada', tokenId: 't1' }
  );
  assert.deepEqual(
    resolveDropAction({ dragSpec: 'item:espada', inCharacterSheet: true }),
    { action: 'equip_item_selected', key: 'espada' }
  );
  assert.deepEqual(
    resolveDropAction({ dragSpec: 'item:espada', inTokenDrawer: true, folderTarget: 'Armas' }),
    { action: 'move_to_folder', tab: 'items', key: 'espada', folder: 'Armas' }
  );
});

test('S1-DND: Service moves custom & SRD entries between folders, renames/deletes folders, and serializes overrides for GM only', () => {
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.customMaps = [
    { key: 'cmap-1', isCustom: true, name: 'Cripta', folder: '', imageUrl: 'data:image/webp;base64,AAA' }
  ];

  // Move custom map to folder & back to root
  assert.equal(Service.moveCompendiumEntryToFolder('maps', 'cmap-1', 'Mazmorras'), true);
  assert.equal(Service.state.customMaps[0].folder, 'Mazmorras');
  assert.ok(Service.state.compendiumFolders.maps.includes('Mazmorras'));

  assert.equal(Service.moveCompendiumEntryToFolder('maps', 'cmap-1', ''), true);
  assert.equal(Service.state.customMaps[0].folder, '');

  // Move SRD preset map into folder via compendiumFolderOverrides
  assert.equal(Service.moveCompendiumEntryToFolder('maps', 'bastion', 'Favoritos'), true);
  assert.equal(
    resolveEntryFolder({ key: 'bastion', isCustom: false }, 'maps', Service.state.compendiumFolderOverrides),
    'Favoritos'
  );

  // Rename folder updates custom entries, overrides, and folder list
  Service.moveCompendiumEntryToFolder('maps', 'cmap-1', 'Favoritos');
  assert.equal(Service.renameCompendiumFolder('maps', 'Favoritos', 'Activos'), true);
  assert.equal(Service.state.customMaps[0].folder, 'Activos');
  assert.equal(Service.state.compendiumFolderOverrides.maps.bastion, 'Activos');
  assert.equal(Service.state.compendiumFolders.maps.includes('Favoritos'), false);
  assert.equal(Service.state.compendiumFolders.maps.includes('Activos'), true);

  // Serialization keeps overrides for GM and strips them for players
  const gmWorld = Selector.extractSerializableWorld(Service.state, { includePrivateGm: true });
  assert.equal(gmWorld.compendiumFolderOverrides.maps.bastion, 'Activos');
  const wireWorld = Selector.extractSerializableWorld(Service.state);
  assert.deepEqual(wireWorld.compendiumFolderOverrides, { actors: {}, items: {}, maps: {} });

  // Delete folder clears custom entries and overrides
  Service.deleteCompendiumFolder('maps', 'Activos');
  assert.equal(Service.state.customMaps[0].folder, '');
  assert.equal(Service.state.compendiumFolderOverrides.maps.bastion, undefined);
});
