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

const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261125a1');
const { PresenceViewMethods } = await import('../js/ui/presenceView.js?v=20261125a1');

function resetService(role = 'gm', isHostGm = role === 'gm') {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.peers = new Map();
  Service._recentLocalMoves = new Map();
  Service.activeDragTokenId = null;
  Service.state = createInitialState();
  Service.state.role = role;
  Service.state.isHostGm = isHostGm;
  return Service.state;
}

test('P2P-1: Host GM switching to visual Player preview creates NO phantom Spectator and keeps Host P2P authority', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);
  try {
    const state = resetService('gm', true);
    state.tokens = [
      { id: 'tok-p1', name: 'Hero', isAlly: true, x: 200, y: 200, size: 1, hp: 20, maxHp: 20, ac: 14, stats: {} }
    ];
    state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p1'] }];
    state.activeInviteId = '';

    // Host toggles visual preview to Jugador
    assert.equal(Service.setRole('player'), true);
    assert.equal(state.role, 'player', 'Visual perspective switches to player');
    assert.equal(Service.isHostNetwork(), true, 'Host network identity must remain GM');

    // No PLAYER_TOKENS_SYNC emitted by host preview toggle
    assert.equal(sent.filter((m) => m.kind === 'PLAYER_TOKENS_SYNC').length, 0);

    // Active peers must still list self as GM (never a phantom Spectator/player)
    const selfPeer = Service.getActivePeers().find((p) => p.self);
    assert.equal(selfPeer.role, 'gm', 'Host preview must not create a phantom player/spectator peer');
    assert.equal(selfPeer.inviteId, '');

    // Host in visual preview STILL processes real remote player syncs and broadcasts WORLD_SYNC
    const applied = Service.applyPlayerTokensSync({
      kind: 'PLAYER_TOKENS_SYNC',
      seatKey: 'inv-1',
      inviteId: 'inv-1',
      tokens: [{ id: 'tok-p1', hp: 14, maxHp: 20 }]
    });
    assert.equal(applied, true, 'Host must keep processing remote PLAYER_TOKENS_SYNC during visual preview');
    assert.equal(state.tokens[0].hp, 14);
    assert.ok(sent.some((m) => m.kind === 'WORLD_SYNC'), 'Host must keep syncing WORLD_SYNC during visual preview');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('P2P-2: Local Player UI actions (selectToken, focusToken) emit ZERO network packets and no-op PLAYER_TOKENS_SYNC emits ZERO WORLD_SYNC', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);
  try {
    // 1. Remote player clicking/selecting or focusing token must NOT send PLAYER_TOKENS_SYNC
    const pState = resetService('player', false);
    pState.tokens = [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 240, y: 240, size: 1, hp: 18, maxHp: 18 }];
    pState.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p1'] }];
    pState.activeInviteId = 'inv-1';

    Service.selectToken('tok-p1', false);
    Service.focusToken('tok-p1');
    assert.equal(sent.length, 0, 'Selecting or focusing a token as Player must emit 0 P2P packets');

    // 2. Host receiving an unchanged PLAYER_TOKENS_SYNC must NOT broadcast WORLD_SYNC
    const gState = resetService('gm', true);
    gState.tokens = [
      { id: 'tok-p1', name: 'Hero', role: 'Aventurero', color: '#8b5cf6', isAlly: true, x: 240, y: 240, size: 1, hp: 18, maxHp: 18, ac: 12 }
    ];
    gState.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p1'] }];

    const unchanged = Service.applyPlayerTokensSync({
      kind: 'PLAYER_TOKENS_SYNC',
      seatKey: 'inv-1',
      tokens: [JSON.parse(JSON.stringify(gState.tokens[0]))]
    });
    assert.equal(unchanged, false, 'Identical PLAYER_TOKENS_SYNC must be treated as no-op');
    assert.equal(sent.length, 0, 'No-op PLAYER_TOKENS_SYNC must not trigger WORLD_SYNC');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('P2P-3: TOKEN_MOVE includes clientId, ignores self-echoes, and WORLD_SYNC serializes authoritative glide target instead of mid-glide x/y', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);
  try {
    const state = resetService('player', false);
    state.tokens = [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 200, y: 200, size: 1 }];
    state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p1'] }];
    state.activeInviteId = 'inv-1';

    Service.moveToken('tok-p1', 360, 280, true);
    const moveMsg = sent.find((m) => m.kind === 'TOKEN_MOVE');
    assert.ok(moveMsg, 'moveToken commit must emit TOKEN_MOVE');
    assert.equal(moveMsg.clientId, Service.clientId, 'TOKEN_MOVE must tag sender clientId');

    // Self-echo must be ignored completely
    const echoApplied = Service.applyRemoteTokenMove({
      kind: 'TOKEN_MOVE',
      tokenId: 'tok-p1',
      x: 120,
      y: 120,
      clientId: Service.clientId
    });
    assert.equal(echoApplied, false, 'Self-echoed TOKEN_MOVE must be ignored');
    assert.notEqual(state.tokens[0].x, 120);

    // Host mid-glide WORLD_SYNC must serialize authoritative targetX/targetY, not interpolated mid-glide x/y
    sent.length = 0;
    const gmState = resetService('gm', true);
    gmState.tokens = [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 260, y: 200, size: 1 }];
    gmState.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p1'] }];
    Service.tokenGlides.set('tok-p1', { rafId: 1, targetX: 520, targetY: 360, lift: 2, scale: 1.04 });

    Service.syncWorldToPeers('inv-1');
    const syncMsg = sent.find((m) => m.kind === 'WORLD_SYNC');
    assert.ok(syncMsg);
    const syncedTok = syncMsg.world.tokens.find((t) => t.id === 'tok-p1');
    assert.equal(syncedTok.x, 520, 'WORLD_SYNC must export authoritative glide targetX');
    assert.equal(syncedTok.y, 360, 'WORLD_SYNC must export authoritative glide targetY');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('P2P-4: applyFullWorldState protects actively dragged & freshly moved local token from stale WORLD_SYNC snap-back', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = resetService('player', false);
    state.tokens = [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 200, y: 200, size: 1, hp: 20, maxHp: 20 }];
    state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p1'] }];
    state.activeInviteId = 'inv-1';

    // Case A: Actively dragging token at (380, 260) -> stale WORLD_SYNC with (200, 200) must NOT snap it back
    Service.activeDragTokenId = 'tok-p1';
    state.tokens[0].x = 380;
    state.tokens[0].y = 260;
    Service.applyFullWorldState({
      tokens: [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 200, y: 200, size: 1, hp: 15, maxHp: 20 }]
    }, true);
    assert.equal(state.tokens[0].x, 380, 'Actively dragged token X must not snap back on WORLD_SYNC');
    assert.equal(state.tokens[0].y, 260, 'Actively dragged token Y must not snap back on WORLD_SYNC');
    assert.equal(state.tokens[0].hp, 15, 'Non-coordinate updates from GM still apply cleanly');

    // Case B: Just finished local move from (200, 200) to (440, 280) -> delayed WORLD_SYNC with old (200, 200) must NOT snap back
    Service.activeDragTokenId = null;
    state.tokens[0].x = 200;
    state.tokens[0].y = 200;
    Service.moveToken('tok-p1', 440, 280, true);
    const landedX = state.tokens[0].x;
    const landedY = state.tokens[0].y;
    Service.applyFullWorldState({
      tokens: [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 200, y: 200, size: 1, hp: 15, maxHp: 20 }]
    }, true);
    assert.equal(state.tokens[0].x, landedX, 'Freshly moved token must resist stale pre-move WORLD_SYNC');
    assert.equal(state.tokens[0].y, landedY);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('PERF-1: exploredCanvas uses willReadFrequently and token drag throttles drawFogCanvas via rAF scheduler', () => {
  const canvasJs = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  const boardJs = fs.readFileSync(path.resolve('js/ui/boardView.js'), 'utf8');
  assert.match(canvasJs, /willReadFrequently:\s*true/, 'exploredCanvas must avoid GPU->CPU readback stalls');
  assert.match(canvasJs, /scheduleFogRedraw\s*\(/, 'canvasView must provide rAF-throttled scheduleFogRedraw');
  assert.match(boardJs, /this\.scheduleFogRedraw\(/, 'boardView pointermove must use scheduleFogRedraw instead of sync drawFogCanvas');
});

test('SEATS-1: Fresh table starts with zero playerInvites, allows deleting last invite, and shows only GM seat', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = resetService('gm', true);
    assert.deepEqual(state.playerInvites, [], 'New table must start with empty playerInvites (no phantom Enlace 1)');
    assert.deepEqual(Selector.getPlayerInvites(state), [], 'Selector.getPlayerInvites must not fabricate a placeholder invite');

    const initialSeats = PresenceViewMethods.buildTableSeats(state);
    assert.equal(initialSeats.length, 1, 'New table presence bar must show only the GM seat');
    assert.equal(initialSeats[0].seatKey, 'gm');
    assert.equal(initialSeats[0].isSelf, true);
    assert.equal(initialSeats[0].online, true);

    // Add and then delete the only invite -> must return to [] without resurrecting Enlace 1
    const created = Service.addPlayerInvite();
    assert.equal(state.playerInvites.length, 1);
    Service.removePlayerInvite(created.id);
    assert.deepEqual(state.playerInvites, [], 'Deleting the last invite must leave playerInvites empty');
    assert.equal(PresenceViewMethods.buildTableSeats(state).length, 1);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('SEATS-2: Host GM visual Player preview keeps GM seat self/online, never pollutes invite seats, and resets previewInviteId on return to GM', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = resetService('gm', true);
    state.tokens = [
      { id: 'tok-p1', name: 'Lyra', isAlly: true, x: 200, y: 200, size: 1, hp: 18, maxHp: 18 }
    ];
    state.playerInvites = [{ id: 'inv-lyra', label: 'Lyra', tokenIds: ['tok-p1'] }];
    state.activeInviteId = '';

    // 1. Direct top-left toggle to Jugador preview (no specific invite selected)
    assert.equal(Service.setRole('player'), true);
    assert.equal(state.role, 'player');
    assert.equal(state.activeInviteId, '', 'Generic Host preview must not auto-bind to first invite');

    const seatsGeneric = PresenceViewMethods.buildTableSeats(state);
    assert.equal(seatsGeneric.length, 2, 'Should show GM + created invite only (no phantom Spectator)');
    assert.equal(seatsGeneric[0].seatKey, 'gm');
    assert.equal(seatsGeneric[0].isSelf, true, 'GM seat must remain isSelf during Host preview');
    assert.equal(seatsGeneric[0].online, true, 'GM seat must remain online during Host preview');
    assert.equal(seatsGeneric[1].seatKey, 'inv-lyra');
    assert.equal(seatsGeneric[1].isSelf, false, 'Player invite seat must NOT steal isSelf from Host preview');
    assert.equal(seatsGeneric[1].online, false, 'Offline player invite must NOT light up online during Host preview');

    // 2. Previewing a specific invite via Probar still keeps presence clean, and returning to GM clears activeInviteId
    Service.previewPlayerInvite('inv-lyra');
    assert.equal(state.activeInviteId, 'inv-lyra');
    const seatsSpecific = PresenceViewMethods.buildTableSeats(state);
    assert.equal(seatsSpecific[0].isSelf, true);
    assert.equal(seatsSpecific[1].isSelf, false);
    assert.equal(seatsSpecific[1].online, false);

    Service.setRole('gm');
    assert.equal(state.activeInviteId, '', 'Returning to GM must clear preview activeInviteId');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('P2P-8: extractSerializableWorld marks redacted wire payloads with _redactedWorld: true while full GM snapshots omit it', () => {
  const state = resetService('gm', true);
  state.customMaps = [{ key: 'cmap-1', name: 'Mapa 4K', imageUrl: 'data:image/webp;base64,AAA' }];

  const wireWorld = Selector.extractSerializableWorld(state);
  assert.equal(wireWorld._redactedWorld, true);
  assert.deepEqual(wireWorld.customMaps, []);

  const fullWorld = Selector.extractSerializableWorld(state, { includePrivateGm: true });
  assert.equal(fullWorld._redactedWorld, undefined);
  assert.equal(fullWorld.customMaps.length, 1);
});

test('P2P-9: Host GM (even in visual player preview) rejects redacted WORLD_SYNC and preserves customMaps/actors/items/folders', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = resetService('gm', true);
    state.customMaps = [{ key: 'cmap-1', name: 'Mapa 4K', imageUrl: 'data:image/webp;base64,AAA' }];
    state.customActors = [{ key: 'cact-1', name: 'Heroe' }];
    state.customItems = [{ key: 'citem-1', name: 'Espada' }];
    state.compendiumFolders = { actors: ['F1'], items: [], maps: ['M1'] };

    const redacted = Selector.extractSerializableWorld(state);
    assert.equal(redacted._redactedWorld, true);

    Service.applyFullWorldState(redacted, true);
    assert.equal(state.customMaps.length, 1, 'GM must keep customMaps');
    assert.equal(state.customActors.length, 1, 'GM must keep customActors');
    assert.equal(state.customItems.length, 1, 'GM must keep customItems');
    assert.deepEqual(state.compendiumFolders.maps, ['M1']);

    // Also when Host GM is in visual player preview
    Service.setRole('player');
    assert.equal(Service.isHostNetwork(), true);
    Service.applyFullWorldState(redacted, true);
    assert.equal(state.customMaps.length, 1, 'Host GM in visual preview must still reject redacted world');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('P2P-10: View.handleRealtimeMessage uses Service.isHostNetwork() for hostOnly, spectatorOnly, WORLD_SYNC, and PUBLIC_CLOCKS_SYNC', () => {
  const viewSrc = fs.readFileSync(path.resolve('js/core/view.js'), 'utf8');
  const fnStart = viewSrc.indexOf('handleRealtimeMessage(msg)');
  const fnEnd = viewSrc.indexOf('cacheElements()', fnStart);
  assert.ok(fnStart >= 0 && fnEnd > fnStart, 'handleRealtimeMessage block must be found');
  const block = viewSrc.slice(fnStart, fnEnd);

  assert.match(block, /const netIsGm = Service\.isHostNetwork\(\)/);
  assert.match(block, /msg\.spectatorOnly && \(netIsGm \|\|/);
  assert.match(block, /msg\.hostOnly && !netIsGm/);
  assert.match(block, /msg\.kind === 'WORLD_SYNC'[\s\S]*if \(netIsGm\) return;/);
  assert.match(block, /msg\.kind === 'PUBLIC_CLOCKS_SYNC'[\s\S]*if \(!netIsGm\)/);
});
