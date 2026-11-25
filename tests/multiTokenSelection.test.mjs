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

const { findTokensInRect, buildMultiTokenMenuSpec } = await import('../js/utils/contextMenuModel.js?v=20261125a1');
const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');

const flattenIds = (spec) => [
  ...(spec.quickActions || []).map((q) => q.id),
  ...(spec.sections || []).flat().map((i) => i.id)
];

test('findTokensInRect matches tokens overlapping marquee rect and enforces canSelect permission filter', () => {
  const tokens = [
    { id: 't1', x: 150, y: 150, size: 1, hidden: false, ownerId: 'p1' },
    { id: 't2', x: 250, y: 200, size: 1, hidden: false, ownerId: 'gm' },
    { id: 't3', x: 180, y: 180, size: 1, hidden: true, ownerId: 'gm' },
    { id: 't4', x: 600, y: 600, size: 1, hidden: false, ownerId: 'p1' }
  ];

  // Reversed drag rect from (300, 260) to (100, 100)
  const gmHits = findTokensInRect(tokens, { x1: 300, y1: 260, x2: 100, y2: 100 }, { cellSize: 80 });
  assert.deepEqual(gmHits.map((t) => t.id), ['t1', 't2', 't3']);

  const playerHits = findTokensInRect(
    tokens,
    { x1: 300, y1: 260, x2: 100, y2: 100 },
    { cellSize: 80, canSelect: (t) => !t.hidden && t.ownerId === 'p1' }
  );
  assert.deepEqual(playerHits.map((t) => t.id), ['t1']);
});

test('buildMultiTokenMenuSpec hides GM-only actions for players and includes batch danger delete for GM', () => {
  const tokens = [
    { id: 't1', name: 'A', hidden: false },
    { id: 't2', name: 'B', hidden: false },
    { id: 't3', name: 'C', hidden: true }
  ];

  const gmSpec = buildMultiTokenMenuSpec({ role: 'gm', tokens });
  assert.equal(gmSpec.header.title, '3 fichas seleccionadas');
  const gmIds = flattenIds(gmSpec);
  assert.ok(gmIds.includes('hp-minus'));
  assert.ok(gmIds.includes('hp-m5'));
  assert.ok(gmIds.includes('light'));
  assert.ok(gmIds.includes('aura'));
  assert.ok(gmIds.includes('init'));
  assert.ok(gmIds.includes('toggle-hide'));
  assert.ok(gmIds.includes('dup-toks'));
  const del = gmSpec.sections.at(-1)[0];
  assert.equal(del.id, 'del-toks');
  assert.equal(del.danger, true);

  const playerSpec = buildMultiTokenMenuSpec({ role: 'player', tokens: tokens.slice(0, 2) });
  assert.equal(playerSpec.header.title, '2 fichas seleccionadas');
  const pIds = flattenIds(playerSpec);
  assert.ok(pIds.includes('hp-minus'));
  assert.ok(pIds.includes('hp-plus'));
  assert.ok(pIds.includes('light'));
  assert.ok(pIds.includes('init'));
  assert.ok(!pIds.includes('toggle-hide'));
  assert.ok(!pIds.includes('dup-toks'));
  assert.ok(!pIds.includes('del-toks'));
});

test('Service batch token operations enforce player permissions and support single-step undo', () => {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.tokens = [
    { id: 't1', name: 'Hero 1', x: 200, y: 200, hp: 20, maxHp: 20, ac: 15, size: 1, ownerId: 'seat-p1', conditions: [] },
    { id: 't2', name: 'Hero 2', x: 300, y: 200, hp: 18, maxHp: 20, ac: 14, size: 1, ownerId: 'seat-p1', conditions: ['burning'] },
    { id: 't3', name: 'Goblin', x: 400, y: 200, hp: 12, maxHp: 12, ac: 13, size: 1, ownerId: 'gm', conditions: [] }
  ];

  // GM applies batch -5 HP to all 3 tokens -> single undo restores all 3
  const hpCount = Service.adjustTokensHp(['t1', 't2', 't3'], -5);
  assert.equal(hpCount, 3);
  assert.deepEqual(Service.state.tokens.map((t) => t.hp), [15, 13, 7]);
  Service.undo();
  assert.deepEqual(Service.state.tokens.map((t) => t.hp), [20, 18, 12]);

  // Batch condition toggle: t2 has 'burning', t1 does not -> adds 'burning' to both; second call removes from both
  Service.toggleTokensCondition(['t1', 't2'], 'burning');
  assert.equal(Service.state.tokens[0].conditions.includes('burning'), true);
  assert.equal(Service.state.tokens[1].conditions.includes('burning'), true);
  Service.toggleTokensCondition(['t1', 't2'], 'burning');
  assert.equal(Service.state.tokens[0].conditions.includes('burning'), false);
  assert.equal(Service.state.tokens[1].conditions.includes('burning'), false);

  // Player seat-p1 cannot mutate Goblin (ownerId: 'gm') or delete any tokens
  Service.state.role = 'player';
  Service.state.activeInviteId = 'seat-p1';
  Service.state.playerInvites = [{ id: 'seat-p1', name: 'Jugador 1', tokenIds: ['t1', 't2'] }];
  Service.setSelectedTokens(['t1', 't2', 't3']);
  assert.deepEqual(Service.state.selectedTokenIds, ['t1', 't2'], 'Player marquee selection must filter out non-owned tokens');

  const pHpCount = Service.adjustTokensHp(['t1', 't3'], -4);
  assert.equal(pHpCount, 1);
  assert.equal(Service.state.tokens[0].hp, 16);
  assert.equal(Service.state.tokens[2].hp, 12, 'Player must not alter non-owned Goblin HP');

  assert.equal(Service.deleteTokens(['t1', 't3']), 0, 'Player must not batch-delete tokens');
  assert.equal(Service.state.tokens.length, 3);

  // GM batch-delete + undo
  Service.state.role = 'gm';
  assert.equal(Service.deleteTokens(['t2', 't3']), 2);
  assert.equal(Service.state.tokens.length, 1);
  Service.undo();
  assert.equal(Service.state.tokens.length, 3, 'Undo must restore all batch-deleted tokens');
});
