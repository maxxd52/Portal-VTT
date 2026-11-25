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

const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261125a1');
const {
  findFreeSpawnPosition,
  getAssignedTokenIds,
  mergeAssignedTokensForScene
} = await import('../js/utils/scenePartySync.js?v=20261125a1');

function resetGmState() {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.undoStack = [];
  Service.redoStack = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.mapId = 'bastion';
  Service.state.activeMapKey = 'bastion';
  Service.state.tokens = [
    { id: 'tok-1', name: 'Kaelen', isAlly: true, x: 440, y: 440, hp: 24, maxHp: 24, ac: 16, size: 1, inventory: [] },
    { id: 'tok-2', name: 'Lyra', isAlly: true, x: 360, y: 600, hp: 14, maxHp: 14, ac: 12, size: 1, inventory: [] },
    { id: 'tok-4', name: 'Acechador Trasgo', isAlly: false, x: 1080, y: 480, hp: 10, maxHp: 10, ac: 13, size: 1, inventory: [] }
  ];
  return Service.state;
}

test('scenePartySync helper deduplicates assigned IDs and spawns heroes on non-overlapping grid cells', () => {
  const invites = [
    { id: 'inv-1', label: 'P1', tokenIds: ['tok-1', 'tok-2'] },
    { id: 'inv-2', label: 'P2', tokenIds: ['tok-2', 'tok-3', ''] }
  ];
  assert.deepEqual(getAssignedTokenIds(invites), ['tok-1', 'tok-2', 'tok-3']);

  const grid = { cellSize: 80, offsetX: 0, offsetY: 0, snap: true };
  const occupied = [{ id: 'blocker', x: 360, y: 440 }];
  const pos = findFreeSpawnPosition(occupied, grid, 0, (x, y) => ({ x, y }));
  assert.notDeepEqual(pos, { x: 360, y: 440 });

  const merged = mergeAssignedTokensForScene({
    targetTokens: [{ id: 'enemy-1', isAlly: false, x: 920, y: 520 }],
    sourceTokens: [
      { id: 'tok-1', isAlly: true, x: 440, y: 440, hp: 20 },
      { id: 'tok-2', isAlly: true, x: 520, y: 440, hp: 14 },
      { id: 'tok-3', isAlly: true, x: 600, y: 440, hp: 18 }
    ],
    playerInvites: invites,
    grid
  });
  assert.equal(merged.length, 4);
  const coords = merged.filter((t) => t.isAlly !== false).map((t) => `${t.x},${t.y}`);
  assert.equal(new Set(coords).size, 3, 'All carried heroes occupy distinct coordinates');
});

test('changeMap carries assigned tokens to new scenes while leaving unassigned tokens behind', async () => {
  const state = resetGmState();
  state.playerInvites = [{ id: 'inv-1', label: 'Jugador 1', tokenIds: ['tok-1'] }];
  const tok1 = state.tokens.find((t) => t.id === 'tok-1');
  tok1.hp = 19;
  tok1.imageUrl = 'data:image/webp;base64,HERO1';
  state.selectedTokenId = 'tok-1';

  await Service.changeMap('forest');

  assert.equal(Service.state.mapId, 'forest');
  assert.deepEqual(Service.state.tokens.map((t) => t.id), ['tok-1']);
  assert.equal(Service.state.tokens[0].hp, 19);
  assert.equal(Service.state.tokens[0].imageUrl, 'data:image/webp;base64,HERO1');
  assert.equal(Service.state.selectedTokenId, 'tok-1');

  // Unassigned tok-2 and enemy tok-4 stay saved in bastion's sceneLayer
  const bastionIds = Service.state.sceneLayers.bastion.tokens.map((t) => t.id);
  assert.ok(bastionIds.includes('tok-2'));
  assert.ok(bastionIds.includes('tok-4'));
});

test('returning to a visited map preserves per-map coordinates while syncing live HP, inventory, and image changes', async () => {
  const state = resetGmState();
  state.playerInvites = [{ id: 'inv-1', label: 'Jugador 1', tokenIds: ['tok-1'] }];
  const bastionTok = state.tokens.find((t) => t.id === 'tok-1');
  bastionTok.x = 760;
  bastionTok.y = 680;

  await Service.changeMap('forest');
  const forestTok = Service.state.tokens.find((t) => t.id === 'tok-1');
  assert.ok(forestTok);
  forestTok.x = 1160;
  forestTok.y = 840;
  forestTok.hp = 7;
  forestTok.imageUrl = 'data:image/webp;base64,UPDATED';
  forestTok.inventory.push({ uid: 'inv-new', name: 'Amuleto', kind: 'equipment' });

  await Service.changeMap('bastion');

  const backHero = Service.state.tokens.find((t) => t.id === 'tok-1');
  assert.ok(backHero);
  assert.equal(backHero.x, 760, 'Restores saved coordinates on bastion');
  assert.equal(backHero.y, 680);
  assert.equal(backHero.hp, 7, 'Keeps live HP from forest');
  assert.equal(backHero.imageUrl, 'data:image/webp;base64,UPDATED', 'Keeps updated image');
  assert.ok(backHero.inventory.some((i) => i.uid === 'inv-new'), 'Keeps updated inventory');
  assert.ok(Service.state.tokens.some((t) => t.id === 'tok-4'), 'Bastion enemy remains intact');
});

test('connected player preserves token assignment, control, and selection across GM map switch', async () => {
  const gmState = resetGmState();
  gmState.playerInvites = [{ id: 'inv-1', label: 'Jugador 1', tokenIds: ['tok-1'] }];
  await Service.activateMapTemplate({ key: 'custom-tavern', name: 'Taberna', isCustom: true, imageUrl: 'data:image/webp;base64,TAVERN' });

  const wireWorld = Selector.extractSerializableWorld(Service.state);

  // Switch local Service instance into a remote player session receiving WORLD_SYNC
  Service.state = createInitialState();
  Service.state.role = 'player';
  Service.state.isHostGm = false;
  Service.state.activeInviteId = 'inv-1';
  Service.state.selectedTokenId = 'tok-1';

  Service.applyFullWorldState(wireWorld, true);

  assert.equal(Service.state.activeMapKey, 'custom-tavern');
  assert.deepEqual(Selector.getPlayerAssignedTokenIds(Service.state), ['tok-1']);
  assert.equal(Selector.isSpectator(Service.state), false);
  assert.equal(Service.state.selectedTokenId, 'tok-1');
  assert.equal(Service.canControlToken(Service.state.tokens[0]), true);
});

test('extractSerializableWorld keeps sceneLayers private from P2P, persists it in portal save, and survives reload + player syncs', async () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};

  try {
    const gmState = resetGmState();
    gmState.playerInvites = [{ id: 'inv-1', label: 'Jugador 1', tokenIds: ['tok-1'] }];
    gmState.tokens.find((t) => t.id === 'tok-1').x = 600;
    gmState.tokens.find((t) => t.id === 'tok-1').y = 520;

    await Service.activateMapTemplate({ key: 'custom-crypt', name: 'Cripta', isCustom: true, imageUrl: 'data:image/webp;base64,CRYPT' });
    assert.ok(Service.state.sceneLayers.bastion, 'Bastion saved in sceneLayers');

    // P2P WORLD_SYNC must omit sceneLayers
    const p2pWorld = Selector.extractSerializableWorld(Service.state);
    assert.equal('sceneLayers' in p2pWorld, false);
    assert.deepEqual(p2pWorld.playerInvites, [{ id: 'inv-1', label: 'Jugador 1', tokenIds: ['tok-1'] }]);

    // Vault / .portal save must include sceneLayers
    const savedPortal = Selector.extractSerializableWorld(Service.state, { includePrivateGm: true });
    assert.ok(savedPortal.sceneLayers?.bastion);
    assert.deepEqual(savedPortal.playerInvites, [{ id: 'inv-1', label: 'Jugador 1', tokenIds: ['tok-1'] }]);

    // Restore into fresh GM state (simulating reloading the portal)
    resetGmState();
    Service.applyFullWorldState(savedPortal, true);
    assert.equal(Service.state.activeMapKey, 'custom-crypt');
    assert.ok(Service.state.sceneLayers.bastion, 'Restored portal keeps inactive scenes');
    assert.deepEqual(Service.state.playerInvites, [{ id: 'inv-1', label: 'Jugador 1', tokenIds: ['tok-1'] }]);

    // Incoming P2P sync from a player (no sceneLayers) must NOT wipe GM's sceneLayers
    const playerSync = Selector.extractSerializableWorld({ ...Service.state, role: 'player', sceneLayers: {} });
    Service.applyFullWorldState(playerSync, true);
    assert.ok(Service.state.sceneLayers.bastion, 'Player sync does not clobber GM sceneLayers');

    // Switching back to bastion recovers original bastion scene & coordinates
    await Service.changeMap('bastion');
    const restoredHero = Service.state.tokens.find((t) => t.id === 'tok-1');
    assert.equal(restoredHero?.x, 600);
    assert.equal(restoredHero?.y, 520);
    assert.ok(Service.state.tokens.some((t) => t.id === 'tok-4'));
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('applyFullWorldState self-heals an assigned token residing only in sceneLayers', () => {
  resetGmState();
  const legacyWorld = {
    mapId: 'custom',
    activeMapKey: 'custom-arena',
    playerInvites: [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] }],
    tokens: [{ id: 'arena-ogre', name: 'Ogro', isAlly: false, x: 920, y: 520 }],
    sceneLayers: {
      bastion: {
        tokens: [{ id: 'tok-1', name: 'Kaelen', isAlly: true, hp: 24, maxHp: 24, x: 440, y: 440 }],
        walls: [],
        strokes: []
      }
    }
  };

  Service.applyFullWorldState(legacyWorld, true);

  assert.equal(Service.state.activeMapKey, 'custom-arena');
  assert.ok(Service.state.tokens.some((t) => t.id === 'tok-1'), 'Self-healed assigned token onto active scene');
  assert.ok(Service.state.tokens.some((t) => t.id === 'arena-ogre'), 'Existing scene enemies kept');
});
