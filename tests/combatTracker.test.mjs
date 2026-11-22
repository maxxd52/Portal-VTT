import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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

const { createInitialState } = await import('../js/core/model.js?v=20261121a6');
const { Selector } = await import('../js/core/selector.js?v=20261121a6');
const { Service } = await import('../js/core/service.js?v=20261121a6');
const { redactCombatForSeat } = await import('../js/utils/worldRedaction.js?v=20261121a6');

function resetGmForTest() {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.undoStack = [];
  Service.redoStack = [];
  Service.peers = new Map();
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  return Service.state;
}

test('S1: redactCombatForSeat strips hidden combatants, trims mixed groups, and remaps turnIndex safely', () => {
  const tokens = [
    { id: 't-hero', name: 'Aelar', isAlly: true, hidden: false },
    { id: 't-ambush', name: 'Asesino Oculto', isAlly: false, hidden: true },
    { id: 't-gob1', name: 'Goblin 1', isAlly: false, hidden: false },
    { id: 't-gob2', name: 'Goblin 2', isAlly: false, hidden: true }
  ];
  const combat = {
    active: true,
    round: 2,
    turnIndex: 2,
    order: [
      { id: 't-hero', tokenId: 't-hero', tokenIds: ['t-hero'], groupName: 'Aelar', isGroup: false, init: 18, pending: false },
      { id: 't-ambush', tokenId: 't-ambush', tokenIds: ['t-ambush'], groupName: 'Asesino Oculto', isGroup: false, init: 15, pending: false },
      { id: 'grp-goblin', tokenId: 't-gob1', tokenIds: ['t-gob1', 't-gob2'], groupName: 'Goblin ×2', isGroup: true, init: 12, pending: false }
    ]
  };

  const redacted = redactCombatForSeat(combat, tokens, true);
  assert.equal(redacted.active, true);
  assert.equal(redacted.round, 2);
  assert.equal(redacted.order.length, 2, 'Fully hidden entry must be stripped');
  assert.equal(redacted.order.some((e) => e.tokenId === 't-ambush'), false);
  assert.equal(redacted.turnIndex, 1, 'turnIndex remaps from 2 to 1 after removing hidden entry ahead of it');
  assert.deepEqual(redacted.order[1].tokenIds, ['t-gob1'], 'Hidden group member must be stripped');
  assert.equal(redacted.order[1].isGroup, false, 'Mixed group with 1 visible member is no longer a group');
  assert.equal(redacted.order[1].groupName, 'Goblin 1', 'Group label must not leak hidden count');

  // When active turn is a hidden enemy, turnIndex must be -1 (no leak)
  const hiddenActive = redactCombatForSeat({ ...combat, turnIndex: 1 }, tokens, true);
  assert.equal(hiddenActive.turnIndex, -1);
  assert.equal(hiddenActive.order.some((e) => e.tokenId === 't-ambush'), false);
});

test('S1: extractWorldForSeat redacts combat order when combatTrackerPublic is false and preserves visible active focus', () => {
  const state = resetGmForTest();
  state.systemConfig.combatTrackerPublic = false;
  state.tokens = [
    { id: 'tok-1', name: 'Hero', isAlly: true, hidden: false, hp: 20, maxHp: 20 },
    { id: 'tok-2', name: 'Orco', isAlly: false, hidden: false, hp: 12, maxHp: 12 },
    { id: 'tok-3', name: 'Sombra', isAlly: false, hidden: true, hp: 15, maxHp: 15 }
  ];
  state.combat = {
    active: true,
    round: 3,
    turnIndex: 1,
    order: [
      { id: 'tok-1', tokenId: 'tok-1', tokenIds: ['tok-1'], groupName: 'Hero', isGroup: false, init: 20, pending: false },
      { id: 'tok-2', tokenId: 'tok-2', tokenIds: ['tok-2'], groupName: 'Orco', isGroup: false, init: 14, pending: false },
      { id: 'tok-3', tokenId: 'tok-3', tokenIds: ['tok-3'], groupName: 'Sombra', isGroup: false, init: 9, pending: false }
    ]
  };

  // Active entry is visible Orco -> player gets only active focus (no other entries, no initiative numbers)
  const wireVisible = Selector.extractWorldForSeat(state, 'inv-1');
  assert.equal(wireVisible.combat.active, true);
  assert.equal(wireVisible.combat.round, 3);
  assert.equal(wireVisible.combat.turnIndex, 0);
  assert.equal(wireVisible.combat.order.length, 1);
  assert.equal(wireVisible.combat.order[0].tokenId, 'tok-2');
  assert.equal(wireVisible.combat.order[0].init, 0);
  assert.equal(JSON.stringify(wireVisible.combat).includes('Sombra'), false);

  // Active entry is hidden Sombra -> player gets empty order and turnIndex -1
  state.combat.turnIndex = 2;
  const wireHidden = Selector.extractWorldForSeat(state, 'inv-1');
  assert.equal(wireHidden.combat.active, true);
  assert.equal(wireHidden.combat.turnIndex, -1);
  assert.equal(wireHidden.combat.order.length, 0);
  assert.equal(JSON.stringify(wireHidden.combat).includes('Sombra'), false);

  // GM private snapshot keeps full unredacted combat
  const gmWorld = Selector.extractSerializableWorld(state, { includePrivateGm: true });
  assert.equal(gmWorld.combat.order.length, 3);
  assert.equal(gmWorld.combat.turnIndex, 2);

  // applyFullWorldState preserves turnIndex = -1 on player client
  state.role = 'player';
  Service.applyFullWorldState(wireHidden);
  assert.equal(Service.state.combat.turnIndex, -1);
});

test('S1: setTokenInitiative preserves active combatant pointer when order re-sorts mid-combat', () => {
  const state = resetGmForTest();
  state.tokens = [
    { id: 'a', name: 'Hero A', isAlly: true, hp: 20, maxHp: 20 },
    { id: 'b', name: 'Hero B', isAlly: true, hp: 20, maxHp: 20 },
    { id: 'c', name: 'Enemy C', isAlly: false, hp: 10, maxHp: 10 }
  ];
  state.combat = {
    active: true,
    round: 1,
    turnIndex: 0,
    order: [
      { id: 'c', tokenId: 'c', tokenIds: ['c'], groupName: 'Enemy C', isGroup: false, init: 14, pending: false },
      { id: 'a', tokenId: 'a', tokenIds: ['a'], groupName: 'Hero A', isGroup: false, init: 0, pending: true },
      { id: 'b', tokenId: 'b', tokenIds: ['b'], groupName: 'Hero B', isGroup: false, init: 0, pending: true }
    ]
  };

  // Hero A rolls 22 and sorts ahead of active Enemy C -> Enemy C remains active (turnIndex moves from 0 to 1)
  Service.setTokenInitiative('a', 22);
  assert.equal(state.combat.order[0].id, 'a');
  assert.equal(state.combat.order[state.combat.turnIndex].id, 'c', 'Active turn pointer must stay on Enemy C');
  assert.equal(state.combat.turnIndex, 1);
});

test('S1: nextCombatTurn and prevCombatTurn auto-skip defeated enemies, keep 0-HP allies, and guard all-defeated', () => {
  const state = resetGmForTest();
  state.tokens = [
    { id: 'ally1', name: 'Clérigo', isAlly: true, hp: 0, maxHp: 20 },
    { id: 'enemy1', name: 'Trasgo muerto', isAlly: false, hp: 0, maxHp: 8 },
    { id: 'enemy2', name: 'Trasgo vivo', isAlly: false, hp: 5, maxHp: 8 }
  ];
  state.combat = {
    active: true,
    round: 1,
    turnIndex: 0,
    order: [
      { id: 'ally1', tokenId: 'ally1', tokenIds: ['ally1'], groupName: 'Clérigo', isGroup: false, init: 18, pending: false },
      { id: 'enemy1', tokenId: 'enemy1', tokenIds: ['enemy1'], groupName: 'Trasgo muerto', isGroup: false, init: 15, pending: false },
      { id: 'enemy2', tokenId: 'enemy2', tokenIds: ['enemy2'], groupName: 'Trasgo vivo', isGroup: false, init: 10, pending: false }
    ]
  };

  // From ally1 -> skips defeated enemy1 -> lands on enemy2
  Service.nextCombatTurn();
  assert.equal(state.combat.order[state.combat.turnIndex].id, 'enemy2');
  assert.equal(state.combat.round, 1);

  // From enemy2 -> wraps to round 2 and lands on 0-HP ally1 (allies are NOT skipped)
  Service.nextCombatTurn();
  assert.equal(state.combat.order[state.combat.turnIndex].id, 'ally1');
  assert.equal(state.combat.round, 2);

  // prevCombatTurn from ally1 (round 2) -> skips defeated enemy1 -> lands on enemy2 (round 1)
  Service.prevCombatTurn();
  assert.equal(state.combat.order[state.combat.turnIndex].id, 'enemy2');
  assert.equal(state.combat.round, 1);

  // prevCombatTurn at round 1 clamps round to >= 1
  Service.prevCombatTurn(); // back to ally1 (round 1)
  assert.equal(state.combat.order[state.combat.turnIndex].id, 'ally1');
  assert.equal(state.combat.round, 1);
  Service.prevCombatTurn(); // wraps to enemy2, round stays >= 1
  assert.equal(state.combat.round, 1);

  // All enemies defeated (no allies) -> advances cleanly without infinite loop
  state.tokens = [
    { id: 'e1', name: 'E1', isAlly: false, hp: 0, maxHp: 10 },
    { id: 'e2', name: 'E2', isAlly: false, hp: 0, maxHp: 10 }
  ];
  state.combat = {
    active: true,
    round: 1,
    turnIndex: 0,
    order: [
      { id: 'e1', tokenId: 'e1', tokenIds: ['e1'], groupName: 'E1', isGroup: false, init: 12, pending: false },
      { id: 'e2', tokenId: 'e2', tokenIds: ['e2'], groupName: 'E2', isGroup: false, init: 8, pending: false }
    ]
  };
  Service.nextCombatTurn();
  assert.equal(state.combat.turnIndex, 1);
});

test('S1: GM combat management (setCombatTurn, updateEntryInitiative, reorder, add/remove, deleteToken pruning)', () => {
  const state = resetGmForTest();
  state.tokens = [
    { id: 't1', name: 'Guerrero', isAlly: true, hp: 20, maxHp: 20 },
    { id: 't2', name: 'Maga', isAlly: true, hp: 14, maxHp: 14 },
    { id: 't3', name: 'Ogro', isAlly: false, hp: 30, maxHp: 30 },
    { id: 't4', name: 'Refuerzo', isAlly: false, hp: 12, maxHp: 12 }
  ];
  state.combat = {
    active: true,
    round: 1,
    turnIndex: 0,
    order: [
      { id: 't1', tokenId: 't1', tokenIds: ['t1'], groupName: 'Guerrero', isGroup: false, init: 15, pending: false },
      { id: 't2', tokenId: 't2', tokenIds: ['t2'], groupName: 'Maga', isGroup: false, init: 15, pending: false },
      { id: 't3', tokenId: 't3', tokenIds: ['t3'], groupName: 'Ogro', isGroup: false, init: 10, pending: false }
    ]
  };

  // Jump directly to Ogro
  Service.setCombatTurn('t3');
  assert.equal(state.combat.turnIndex, 2);
  assert.equal(state.selectedTokenId, 't3');

  // Reorder tie: move Maga up above Guerrero while keeping active pointer on Ogro
  Service.reorderCombatEntry('t2', -1);
  assert.deepEqual(state.combat.order.map((e) => e.id), ['t2', 't1', 't3']);
  assert.equal(state.combat.order[state.combat.turnIndex].id, 't3');

  // Update initiative manually on Ogro to 20 -> Ogro moves to index 0 and remains active
  Service.updateEntryInitiative('t3', 20);
  assert.equal(state.combat.order[0].id, 't3');
  assert.equal(state.combat.turnIndex, 0);

  // Add reinforcement mid-combat with explicit initiative
  Service.addTokenToCombat('t4', { init: 17 });
  assert.equal(state.combat.order.some((e) => e.tokenId === 't4'), true);
  assert.equal(state.combat.order[state.combat.turnIndex].id, 't3', 'Adding combatant preserves active turn');

  // Remove combat entry directly
  Service.removeCombatEntry('t1');
  assert.equal(state.combat.order.some((e) => e.id === 't1'), false);
  assert.equal(state.combat.order[state.combat.turnIndex].id, 't3');

  // Deleting a token from the scene prunes it from active combat
  Service.deleteToken('t4');
  assert.equal(state.combat.order.some((e) => e.tokenId === 't4'), false);
  assert.equal(state.combat.order[state.combat.turnIndex].id, 't3');
});

test('S2: index.html places minimalist #btnNextTurn in #tablePresenceBar and extra GM controls inside #combatTrackerPopover', () => {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const barStart = html.indexOf('id="tablePresenceBar"');
  const seatsStart = html.indexOf('id="tableSeatsList"');
  const popStart = html.indexOf('id="combatTrackerPopover"');
  const popEnd = html.indexOf('id="chatDrawer"');

  assert.ok(barStart > 0 && seatsStart > barStart && popStart > seatsStart && popEnd > popStart);
  const topPillPrefix = html.slice(barStart, seatsStart);
  const popoverMarkup = html.slice(popStart, popEnd);

  // Single quick Next Turn button lives directly in the central pill (beside combat swords), not duplicated in popover
  assert.ok(topPillPrefix.includes('id="btnToggleCombat"'));
  assert.ok(topPillPrefix.includes('id="btnNextTurn"'), '#btnNextTurn must live in #tablePresenceBar next to #btnToggleCombat');
  assert.equal(popoverMarkup.includes('id="btnNextTurn"'), false, '#btnNextTurn must not be duplicated inside #combatTrackerPopover');

  // Extra management controls stay tucked inside #combatTrackerPopover
  assert.ok(popoverMarkup.includes('id="btnPrevTurn"'), '#btnPrevTurn must be inside #combatTrackerPopover');
  assert.ok(popoverMarkup.includes('id="btnToggleAddCombatant"'), '#btnToggleAddCombatant must be inside #combatTrackerPopover');
  assert.ok(popoverMarkup.includes('id="combatAddList"'), '#combatAddList must be inside #combatTrackerPopover');
});

test('S2: renderCombatTracker handles turnIndex=-1 (hidden active enemy) without wrapping is-active to last row', async () => {
  const { PresenceViewMethods } = await import('../js/ui/presenceView.js?v=20261121a6');
  const state = resetGmForTest();
  state.role = 'player';
  state.systemConfig.combatTrackerPublic = true;
  state.tokens = [
    { id: 't1', name: 'Hero', isAlly: true, hidden: false, hp: 20, maxHp: 20 },
    { id: 't2', name: 'Orco', isAlly: false, hidden: false, hp: 10, maxHp: 10 }
  ];
  state.combat = {
    active: true,
    round: 2,
    turnIndex: -1,
    order: [
      { id: 't1', tokenId: 't1', tokenIds: ['t1'], groupName: 'Hero', isGroup: false, init: 18, pending: false },
      { id: 't2', tokenId: 't2', tokenIds: ['t2'], groupName: 'Orco', isGroup: false, init: 11, pending: false }
    ]
  };

  const makeClassList = () => {
    const set = new Set();
    return {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      toggle: (c, force) => (force === undefined ? (set.has(c) ? set.delete(c) : set.add(c)) : (force ? set.add(c) : set.delete(c))),
      contains: (c) => set.has(c)
    };
  };
  const orderEl = { innerHTML: '', querySelectorAll: () => [] };
  const mockView = {
    ...PresenceViewMethods,
    escapeHtml: (s) => String(s || ''),
    renderTableSeats: () => {},
    els: {
      combatTrackerPopover: { classList: makeClassList() },
      combatOrderList: orderEl,
      lblCombatRound: { textContent: '' },
      btnNextTurn: { classList: makeClassList() },
      btnPrevTurn: { classList: makeClassList() },
      btnToggleAddCombatant: { classList: makeClassList() },
      combatAddList: { innerHTML: '', classList: makeClassList(), querySelectorAll: () => [] },
      btnToggleCombatVisibility: { classList: makeClassList(), innerHTML: '', title: '' },
      btnEndCombat: { classList: makeClassList() }
    }
  };

  mockView.renderCombatTracker(state);
  assert.equal(orderEl.innerHTML.includes('combat-order-row is-active'), false, 'No visible row may be marked active when turnIndex is -1');
  assert.ok(orderEl.innerHTML.indexOf('Hero') < orderEl.innerHTML.indexOf('Orco'), 'Order must remain unrotated starting from index 0');
});

test('S3: pill and tracker avatars drop circular double-frame for image tokens while keeping pill height compact', async () => {
  const { PresenceViewMethods } = await import('../js/ui/presenceView.js?v=20261121a6');
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');

  assert.ok(html.includes('id="tablePresenceBar"') && html.includes('px-2.5 py-1 flex items-center'), '#tablePresenceBar must use compact py-1 padding');
  assert.ok(css.includes('.table-seat-avatar.has-image'), 'styles.css must style frameless .table-seat-avatar.has-image');
  assert.ok(css.includes('.combat-token-avatar.has-image'), 'styles.css must style frameless .combat-token-avatar.has-image');
  assert.ok(css.includes('@keyframes seatTurnGlowPulse'), 'styles.css must define shape-following turn glow animation');

  const state = resetGmForTest();
  const mockView = {
    ...PresenceViewMethods,
    escapeHtml: (s) => String(s || '')
  };

  const imgRow = mockView.renderCombatOrderRowHtml(
    {
      entry: { id: 't-img', tokenId: 't-img', init: 14, pending: false },
      tokens: [{ id: 't-img', name: 'Mago', imageUrl: 'https://example.com/hex.webp', hp: 10, maxHp: 10, color: '#3b82f6' }],
      label: 'Mago',
      isGroup: false,
      initBadge: '14',
      pending: false,
      isTurn: false
    },
    state
  );
  const initRow = mockView.renderCombatOrderRowHtml(
    {
      entry: { id: 't-txt', tokenId: 't-txt', init: 10, pending: false },
      tokens: [{ id: 't-txt', name: 'Kaelen', imageUrl: '', hp: 10, maxHp: 10, color: '#3b82f6' }],
      label: 'Kaelen',
      isGroup: false,
      initBadge: '10',
      pending: false,
      isTurn: false
    },
    state
  );

  assert.ok(imgRow.includes('combat-token-avatar has-image'), 'Image combat row must carry has-image');
  assert.equal(initRow.includes('combat-token-avatar has-image'), false, 'Initials combat row must keep circular frame');

  // Verify tableSeatsList emits has-image on image seats and omits it on initials seats
  const seatsEl = { innerHTML: '', childElementCount: 0, querySelectorAll: () => [] };
  const seatMock = {
    ...PresenceViewMethods,
    escapeHtml: (s) => String(s || ''),
    renderChatUI: () => {},
    buildTableSeats: () => [
      { seatKey: 'gm', role: 'gm', clientId: 'c1', isSelf: true, online: true, hasTurn: false, tokenCount: 0, name: 'Director', avatarUrl: '', color: '#8b5cf6' },
      { seatKey: 'inv-1', role: 'player', clientId: 'c2', isSelf: false, online: true, hasTurn: true, tokenCount: 1, name: 'Lyra', avatarUrl: 'https://example.com/sq.webp', color: '#3b82f6' }
    ],
    els: { tableSeatsList: seatsEl }
  };
  seatMock.renderTableSeats(state);
  assert.ok(seatsEl.innerHTML.includes('class="table-seat-avatar has-image"'), 'Image seat must carry has-image');
  assert.ok(seatsEl.innerHTML.includes('class="table-seat-avatar"'), 'Initials seat must keep circular border');
});
