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

const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { Selector } = await import('../js/core/selector.js?v=20261123a7');
const { Service } = await import('../js/core/service.js?v=20261123a7');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261123a7');
const { Dice3DEngine } = await import('../js/services/dice3dEngine.js?v=20261123a7');

function resetState(role = 'gm', isHostGm = role === 'gm') {
  Service.cancelAllTokenGlides();
  Service.uiScale = 'normal';
  Service.flyingRollId = null;
  Service.flyingRollIds = new Set();
  Service._seenRollIds = new Set();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = role;
  Service.state.isHostGm = isHostGm;
  Service.chatMessages = [];
  Service.chatBubbles = new Map();
  Service.chatOpen = false;
  Service.chatUnreadCount = 0;
  Service.chatUnreadTable = 0;
  Service.chatUnreadBySeat = new Map();
  Service.chatTarget = { channel: 'table' };
  return Service.state;
}

test('isHostGm=false prevents switching role to gm while GM host keeps preview toggle', () => {
  resetState('player', false);
  assert.equal(Service.setRole('gm'), false);
  assert.equal(Service.state.role, 'player');

  resetState('gm', true);
  assert.equal(Service.setRole('player'), true);
  assert.equal(Service.state.role, 'player');
  assert.equal(Service.state.isHostGm, true);
  assert.equal(Service.setRole('gm'), true);
  assert.equal(Service.state.role, 'gm');
});

test('moveToken sends zero packets during drag and sends a single lightweight TOKEN_MOVE on drop', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);
  try {
    const state = resetState('player', false);
    state.tokens = [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 200, y: 200, size: 1 }];
    state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-p1'] }];
    state.activeInviteId = 'inv-1';

    const notifyOpts = [];
    Service.subscribe((_st, opts) => notifyOpts.push(opts));

    Service.moveToken('tok-p1', 250, 260, false);
    assert.equal(sent.length, 0, 'Dragging must not emit network packets');
    assert.equal(notifyOpts.length, 1);
    assert.equal(notifyOpts[0]?.tokensOnly, true, 'Dragging must use tokensOnly fast-path render');
    assert.equal(notifyOpts[0]?.skipVaultSave, true);

    Service.moveToken('tok-p1', 310, 340, true);
    assert.equal(sent.length, 1, 'Drop must emit exactly one packet');
    assert.equal(sent[0].kind, 'TOKEN_MOVE');
    assert.equal(sent[0].tokenId, 'tok-p1');
    assert.equal('tokens' in sent[0], false, 'TOKEN_MOVE must not carry world state');

    // Receiving peer applies delta without emitting WORLD_SYNC
    sent.length = 0;
    Service.applyRemoteTokenMove({ kind: 'TOKEN_MOVE', tokenId: 'tok-p1', x: 520, y: 600 });
    assert.equal(Service.state.tokens[0].x, 520);
    assert.equal(Service.state.tokens[0].y, 600);
    assert.equal(sent.length, 0, 'Applying remote TOKEN_MOVE must not echo back');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('chatService isolates Mesa and 1-on-1 private threads by seatKey, skips whisper bubbles, and tracks per-seat unread counts', () => {
  const state = resetState('gm', true);
  Service.clientId = 'c-gm';
  state.activeInviteId = '';

  // Incoming public table message
  Service.receiveChatMessage({
    id: 'm-pub-1',
    senderClientId: 'c-p1',
    senderRole: 'player',
    senderInviteId: 'inv-1',
    senderSeatKey: 'inv-1',
    senderName: 'Kaelen',
    senderColor: '#3b82f6',
    channel: 'table',
    text: 'Hola mesa',
    ts: 1,
    time: '12:00'
  });
  assert.equal(Service.chatUnreadTable, 1);
  assert.equal(Service.chatBubbles.has('inv-1'), true);

  // Incoming whisper from player inv-1 to GM
  Service.receiveChatMessage({
    id: 'm-w-1',
    senderClientId: 'c-p1',
    senderRole: 'player',
    senderInviteId: 'inv-1',
    senderSeatKey: 'inv-1',
    senderName: 'Kaelen',
    senderColor: '#3b82f6',
    channel: 'whisper',
    targetSeatKey: 'gm',
    text: 'Abro la puerta en secreto',
    ts: 2,
    time: '12:01'
  });
  assert.equal(Service.chatUnreadTable, 1, 'Whisper must not pollute Mesa unread counter');
  assert.equal(Service.chatUnreadBySeat.get('inv-1'), 1);
  assert.equal(Service.chatBubbles.get('inv-1').id, 'm-pub-1', 'Whisper must not create/overwrite floating bubble');

  // Player reconnects with new clientId on same invite inv-1 and sends another whisper
  Service.receiveChatMessage({
    id: 'm-w-2',
    senderClientId: 'c-p1-reconnected',
    senderRole: 'player',
    senderInviteId: 'inv-1',
    senderSeatKey: 'inv-1',
    senderName: 'Kaelen',
    senderColor: '#3b82f6',
    channel: 'whisper',
    targetSeatKey: 'gm',
    text: 'Sigo aqui',
    ts: 3,
    time: '12:02'
  });
  assert.equal(Service.chatUnreadBySeat.get('inv-1'), 2);

  // Incoming whisper from player inv-2 stays strictly separated
  Service.receiveChatMessage({
    id: 'm-w-other',
    senderClientId: 'c-p2',
    senderRole: 'player',
    senderInviteId: 'inv-2',
    senderSeatKey: 'inv-2',
    senderName: 'Lyra',
    senderColor: '#8b5cf6',
    channel: 'whisper',
    targetSeatKey: 'gm',
    text: 'Yo vigilo',
    ts: 4,
    time: '12:03'
  });
  assert.equal(Service.chatUnreadBySeat.get('inv-2'), 1);

  // Visible messages for 'table' contain ONLY public messages
  Service.chatTarget = { channel: 'table' };
  assert.deepEqual(Service.getVisibleChatMessages().map((m) => m.id), ['m-pub-1']);

  // Visible messages for inv-1 contain both whispers (across reconnect), nothing from inv-2 or table
  Service.chatTarget = { channel: 'whisper', seatKey: 'inv-1', name: 'Kaelen' };
  assert.deepEqual(Service.getVisibleChatMessages().map((m) => m.id), ['m-w-1', 'm-w-2']);

  // Marking inv-1 read leaves inv-2 and table unread intact
  Service.markChatRead();
  assert.equal(Service.chatUnreadBySeat.has('inv-1'), false);
  assert.equal(Service.chatUnreadBySeat.get('inv-2'), 1);
  assert.equal(Service.chatUnreadTable, 1);
});

test('Selector.simplifyMovePath collapses straight drags to null, preserves corners, and caps length', () => {
  // Jittery straight horizontal drag (deviation < 18px) -> null
  const straight = [
    { x: 100, y: 100 },
    { x: 180, y: 106 },
    { x: 260, y: 95 },
    { x: 340, y: 102 },
    { x: 420, y: 100 }
  ];
  assert.equal(Selector.simplifyMovePath(straight, { x: 420, y: 100 }), null);

  // L-shaped drag around a corner preserves the corner waypoint and ends at exact finalPt
  const lShape = [
    { x: 100, y: 100 },
    { x: 220, y: 102 },
    { x: 360, y: 100 },
    { x: 362, y: 240 },
    { x: 360, y: 380 }
  ];
  const simplifiedL = Selector.simplifyMovePath(lShape, { x: 360, y: 400 });
  assert.ok(Array.isArray(simplifiedL), 'Corner path must produce simplified waypoints');
  assert.equal(simplifiedL.length, 3);
  assert.deepEqual(simplifiedL[0], { x: 100, y: 100 });
  assert.ok(Math.abs(simplifiedL[1].x - 360) <= 5 && Math.abs(simplifiedL[1].y - 100) <= 5);
  assert.deepEqual(simplifiedL[2], { x: 360, y: 400 });

  // Zigzag with many points is capped at maxPoints and ends cleanly at finalPt
  const zigzag = [];
  for (let i = 0; i <= 30; i++) {
    zigzag.push({ x: 100 + i * 60, y: i % 2 === 0 ? 120 : 280 });
  }
  const capped = Selector.simplifyMovePath(zigzag, { x: 1920, y: 140 }, 12);
  assert.ok(Array.isArray(capped));
  assert.ok(capped.length >= 3 && capped.length <= 12);
  assert.deepEqual(capped[0], { x: 100, y: 120 });
  assert.deepEqual(capped[capped.length - 1], { x: 1920, y: 140 });
});

test('Selector.samplePointAlongPath walks around corners via arc-length parameterization', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 }
  ];
  assert.deepEqual(Selector.samplePointAlongPath(poly, 0), { x: 0, y: 0 });
  assert.deepEqual(Selector.samplePointAlongPath(poly, 0.5), { x: 200, y: 0 });
  assert.deepEqual(Selector.samplePointAlongPath(poly, 1), { x: 200, y: 200 });

  const q1 = Selector.samplePointAlongPath(poly, 0.25);
  assert.deepEqual(q1, { x: 100, y: 0 });
  const q3 = Selector.samplePointAlongPath(poly, 0.75);
  assert.deepEqual(q3, { x: 200, y: 100 });
});

test('moveToken emits simplified path in one TOKEN_MOVE and applyRemoteTokenMove glides via rAF and cancels cleanly on interruption', () => {
  const sent = [];
  const notifyLog = [];
  const origSend = RealtimeBridge.send;
  const origRaf = globalThis.requestAnimationFrame;
  const origCancelRaf = globalThis.cancelAnimationFrame;
  const origPerf = globalThis.performance;

  RealtimeBridge.send = (payload) => sent.push(payload);
  let nowMs = 1000;
  let nextRafId = 1;
  const scheduled = new Map();
  const cancelledIds = [];
  globalThis.performance = { now: () => nowMs };
  globalThis.requestAnimationFrame = (cb) => {
    const id = nextRafId++;
    scheduled.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelledIds.push(id);
    scheduled.delete(id);
  };

  try {
    // Part 1: local curved drag produces one TOKEN_MOVE packet with path
    const state = resetState('gm', true);
    state.grid.snap = false;
    state.tokens = [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 100, y: 100, size: 1 }];
    Service.moveToken('tok-p1', 300, 100, false);
    assert.equal(sent.length, 0);

    const curvedRaw = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 }
    ];
    Service.moveToken('tok-p1', 300, 300, true, curvedRaw);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].kind, 'TOKEN_MOVE');
    assert.deepEqual(sent[0].path, curvedRaw);

    // Part 2: remote L-shaped glide on peer
    sent.length = 0;
    state.tokens = [{ id: 'tok-r1', name: 'Scout', isAlly: true, x: 100, y: 100, size: 1 }];
    Service.subscribe((_s, opts) => notifyLog.push(opts));

    const lPath = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 }
    ];
    const started = Service.applyRemoteTokenMove({
      kind: 'TOKEN_MOVE',
      tokenId: 'tok-r1',
      x: 300,
      y: 300,
      path: lPath
    });
    assert.equal(started, true);
    assert.equal(Service.isTokenGliding('tok-r1'), true);
    assert.equal(scheduled.size, 1);

    const smoothL = Selector.smoothMovePath(lPath);
    const expectedDur = Math.max(300, Math.min(1150, Math.round(230 + Selector.getPolylineLength(smoothL) * 0.72)));

    // Frame 1 at t=1000 anchors v-sync startTime=1000 and redraws fog once at start
    let f1Id = Array.from(scheduled.keys())[0];
    let f1Cb = scheduled.get(f1Id);
    scheduled.delete(f1Id);
    nowMs = 1000;
    f1Cb(nowMs);
    assert.equal(notifyLog[notifyLog.length - 1].redrawFog, true);

    // Frame 2 at t=1016 (+16ms < 32ms) throttles fog redraw between 60 Hz frames
    let f2Id = Array.from(scheduled.keys())[0];
    let f2Cb = scheduled.get(f2Id);
    scheduled.delete(f2Id);
    nowMs = 1016;
    f2Cb(nowMs);
    assert.equal(notifyLog[notifyLog.length - 1].redrawFog, false, 'Fog redraw throttled on 16ms 60Hz tick');

    // Frame 3 at rawT = 0.5 (>= 32ms later) redraws fog and places token cleanly around rounded corner
    let f3Id = Array.from(scheduled.keys())[0];
    let f3Cb = scheduled.get(f3Id);
    scheduled.delete(f3Id);
    nowMs = 1000 + expectedDur * 0.5;
    f3Cb(nowMs);

    assert.equal(Service.isTokenGliding('tok-r1'), true);
    const midTok = state.tokens[0];
    const expectedMid = Selector.samplePointAlongPath(smoothL, Selector.easeTokenGlide(0.5));
    assert.ok(Math.hypot(midTok.x - expectedMid.x, midTok.y - expectedMid.y) < 0.01);
    assert.ok(midTok.x > 250 && midTok.y > 100 && midTok.y < 300);
    const visMid = Service.getTokenGlideVisual('tok-r1');
    assert.ok(visMid && visMid.lift > 0 && visMid.scale > 1, 'Glide visual carries parabolic lift');
    assert.equal('alpha' in visMid, false, 'Shadow alpha no longer driven per-frame');
    assert.equal(notifyLog[notifyLog.length - 1].tokensOnly, true);
    assert.equal(notifyLog[notifyLog.length - 1].redrawFog, true);
    assert.equal(notifyLog[notifyLog.length - 1].skipVaultSave, true);
    assert.equal(notifyLog[notifyLog.length - 1].skipPeerSync, true);

    // Frame 4 past completion
    let f4Id = Array.from(scheduled.keys())[0];
    let f4Cb = scheduled.get(f4Id);
    scheduled.delete(f4Id);
    nowMs = 1000 + expectedDur + 50;
    f4Cb(nowMs);

    assert.equal(Service.isTokenGliding('tok-r1'), false);
    assert.equal(Service.getTokenGlideVisual('tok-r1'), null);
    assert.equal(notifyLog[notifyLog.length - 1].redrawFog, true);
    assert.equal(state.tokens[0].x, 300);
    assert.equal(state.tokens[0].y, 300);
    assert.equal(notifyLog[notifyLog.length - 1].tokensOnly, true);
    assert.equal(notifyLog[notifyLog.length - 1].skipVaultSave, false, 'GM persists final landed position once');
    assert.equal(notifyLog[notifyLog.length - 1].skipPeerSync, true);
    assert.equal(sent.length, 0);

    // Part 3: interrupting mid-glide with a new TOKEN_MOVE cancels the first rAF and glides smoothly from current point
    state.tokens = [{ id: 'tok-r1', name: 'Scout', isAlly: true, x: 100, y: 100, size: 1 }];
    nowMs = 2000;
    Service.applyRemoteTokenMove({ kind: 'TOKEN_MOVE', tokenId: 'tok-r1', x: 500, y: 100 });
    const oldRafId = Array.from(scheduled.keys())[0];
    nowMs = 2050;
    Service.applyRemoteTokenMove({ kind: 'TOKEN_MOVE', tokenId: 'tok-r1', x: 100, y: 500 });
    assert.ok(cancelledIds.includes(oldRafId), 'Second remote move cancels pending rAF frame');
    assert.equal(scheduled.size, 1);

    // Local moveToken also cancels active glide cleanly
    const activeRafId = Array.from(scheduled.keys())[0];
    Service.moveToken('tok-r1', 200, 200, false);
    assert.equal(Service.isTokenGliding('tok-r1'), false);
    assert.ok(cancelledIds.includes(activeRafId));
  } finally {
    Service.cancelAllTokenGlides();
    RealtimeBridge.send = origSend;
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCancelRaf;
    globalThis.performance = origPerf;
  }
});

test('Selector.easeTokenGlide is C2-smooth monotonic asymmetric ease-in-out with peak velocity <= 1.6x', () => {
  assert.equal(Selector.easeTokenGlide(0), 0);
  assert.ok(Math.abs(Selector.easeTokenGlide(0.38) - 0.38) < 1e-9);
  assert.equal(Selector.easeTokenGlide(1), 1);
  assert.ok(Selector.easeTokenGlide(0.1) < 0.05, 'Progressive launch starts gently');
  assert.ok(1 - Selector.easeTokenGlide(0.9) <= 0.025, 'Long deceleration settles softly');

  let prev = Selector.easeTokenGlide(0);
  let maxVel = 0;
  const steps = 100;
  for (let i = 1; i <= steps; i++) {
    const val = Selector.easeTokenGlide(i / steps);
    assert.ok(val >= prev, `Expected monotonic ease at t=${i / steps}`);
    maxVel = Math.max(maxVel, (val - prev) * steps);
    prev = val;
  }
  assert.ok(maxVel <= 1.6, `Expected peak velocity <= 1.6x for 60Hz crispness, got ${maxVel}`);
});

test('Selector.smoothMovePath leaves straight lines intact and rounds multi-segment corners safely', () => {
  const straight = [
    { x: 0, y: 0 },
    { x: 200, y: 0 }
  ];
  assert.deepEqual(Selector.smoothMovePath(straight), straight);

  const lPath = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 }
  ];
  const rounded = Selector.smoothMovePath(lPath);
  assert.ok(rounded.length > 3);
  assert.deepEqual(rounded[0], { x: 0, y: 0 });
  assert.deepEqual(rounded[rounded.length - 1], { x: 200, y: 200 });

  const mid = Selector.samplePointAlongPath(rounded, 0.5);
  assert.ok(Math.hypot(mid.x - 191, mid.y - 9) <= 0.5, `Corner midpoint (~191,9), got (${mid.x}, ${mid.y})`);
  assert.ok(Math.hypot(mid.x - 200, mid.y - 0) <= 14, 'Corner hugs original apex instead of cutting across');
});

test('Service uiScale supports normal (1), comfortable (1.12), and large (1.25) locally without P2P sync or world serialization', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);
  try {
    globalThis.localStorage.removeItem('portal_vtt_ui_scale_v1');
    resetState('gm', true);
    assert.equal(Service.loadUiScale(), 'normal');
    assert.equal(Service.getUiScale(), 1);

    assert.equal(Service.setUiScale('comfortable'), 1.12);
    assert.equal(Service.uiScale, 'comfortable');
    assert.equal(globalThis.localStorage.getItem('portal_vtt_ui_scale_v1'), 'comfortable');
    assert.equal(sent.length, 0, 'Changing local UI scale must not broadcast P2P traffic');

    Service.uiScale = 'normal';
    assert.equal(Service.loadUiScale(), 'comfortable');
    assert.equal(Service.getUiScale(), 1.12);

    assert.equal(Service.setUiScale('large'), 1.25);
    assert.equal(Service.getUiScale(), 1.25);

    assert.equal(Service.setUiScale('invalid_size'), 1);
    assert.equal(Service.uiScale, 'normal');

    const world = Selector.extractSerializableWorld(Service.state, { includePrivateGm: true });
    assert.equal('uiScale' in world, false, 'uiScale is device-local and omitted from serialized world');
  } finally {
    globalThis.localStorage.removeItem('portal_vtt_ui_scale_v1');
    RealtimeBridge.send = origSend;
  }
});

test('Dice3DEngine.computeRemoteReturnKinematics decelerates return travel/spin and dampens gravity bounces', () => {
  const k0 = Dice3DEngine.computeRemoteReturnKinematics(0, 3);
  const k1 = Dice3DEngine.computeRemoteReturnKinematics(1, 3);
  assert.equal(k0.sPos, 0);
  assert.equal(k0.sRot, 0);
  assert.equal(k1.sPos, 1);
  assert.equal(k1.sRot, 1);

  const dPosStart = Dice3DEngine.computeRemoteReturnKinematics(0.15, 3).sPos - Dice3DEngine.computeRemoteReturnKinematics(0.05, 3).sPos;
  const dPosMid = Dice3DEngine.computeRemoteReturnKinematics(0.55, 3).sPos - Dice3DEngine.computeRemoteReturnKinematics(0.45, 3).sPos;
  const dPosEnd = Dice3DEngine.computeRemoteReturnKinematics(0.95, 3).sPos - Dice3DEngine.computeRemoteReturnKinematics(0.85, 3).sPos;
  assert.ok(dPosStart > dPosMid && dPosMid > dPosEnd, 'Remote return velocity strictly decelerates');

  const dRotStart = Dice3DEngine.computeRemoteReturnKinematics(0.15, 3).sRot - Dice3DEngine.computeRemoteReturnKinematics(0.05, 3).sRot;
  const dRotEnd = Dice3DEngine.computeRemoteReturnKinematics(0.95, 3).sRot - Dice3DEngine.computeRemoteReturnKinematics(0.85, 3).sRot;
  assert.ok(dRotStart > dRotEnd, 'Remote die spin decelerates smoothly after bounce');

  const bounce1 = Dice3DEngine.computeRemoteReturnKinematics(0.19, 3);
  const bounce2 = Dice3DEngine.computeRemoteReturnKinematics(0.50, 3);
  const rollFlat = Dice3DEngine.computeRemoteReturnKinematics(0.75, 3);
  assert.ok(bounce1.z > bounce2.z && bounce2.z > 0, 'Secondary bounce is strictly lower than first bounce');
  assert.equal(bounce1.bounceStage, 1);
  assert.equal(bounce2.bounceStage, 2);
  assert.equal(rollFlat.z, 0);
  assert.equal(rollFlat.bounceStage, 3);
});

test('Dice3DEngine.canStartFlightNow enforces maxActiveFlights (4) and maxActiveDice (24) while allowing local and empty-pool throws', () => {
  const prevFlights = Dice3DEngine.activeFlights;
  try {
    Dice3DEngine.activeFlights = [];
    assert.equal(Dice3DEngine.canStartFlightNow(30, 'remote'), true, 'Empty pool always accepts first throw');

    Dice3DEngine.activeFlights = [
      { mode: 'remote', totalDice: 6 },
      { mode: 'remote', totalDice: 6 },
      { mode: 'remote', totalDice: 6 }
    ];
    assert.equal(Dice3DEngine.getActiveDiceCount(), 18);
    assert.equal(Dice3DEngine.canStartFlightNow(6, 'remote'), true, '4th flight within 24 dice cap fits');
    assert.equal(Dice3DEngine.canStartFlightNow(8, 'remote'), false, 'Exceeding 24 dice cap queues overflow');

    Dice3DEngine.activeFlights.push({ mode: 'remote', totalDice: 2 });
    assert.equal(Dice3DEngine.canStartFlightNow(1, 'remote'), false, '5th simultaneous flight queues overflow');
    assert.equal(Dice3DEngine.canStartFlightNow(4, 'local'), true, 'Local throw is never blocked by remote pool');
  } finally {
    Dice3DEngine.activeFlights = prevFlights;
  }
});

test('Service tracks multiple concurrent flyingRollIds without prematurely revealing active seat rolls', () => {
  resetState('gm', true);
  Service.markRollFlying('roll-p1');
  Service.markRollFlying('roll-p2');
  Service.markRollFlying('roll-p3');

  assert.equal(Service.isRollFlying('roll-p1'), true);
  assert.equal(Service.isRollFlying('roll-p2'), true);
  assert.equal(Service.isRollFlying('roll-p3'), true);
  assert.equal(Service.flyingRollId, 'roll-p3');

  Service.clearRollFlying('roll-p1');
  assert.equal(Service.isRollFlying('roll-p1'), false);
  assert.equal(Service.isRollFlying('roll-p2'), true);
  assert.equal(Service.isRollFlying('roll-p3'), true);

  Service.clearRollFlying('roll-p3');
  assert.equal(Service.flyingRollId, 'roll-p2');
  Service.clearRollFlying('roll-p2');
  assert.equal(Service.flyingRollId, null);
  assert.equal(Service.isRollFlying('roll-p2'), false);
});

test('receiveRemoteRoll and RealtimeBridge deduplicate identical rollId / _msgId delivered over BroadcastChannel + WebRTC', () => {
  resetState('gm', true);
  Service.clientId = 'c-gm';
  let flightsLaunched = 0;
  const origPlay = Service.playSeatDiceFlight;
  const origCan3D = Dice3DEngine.canRoll3D;
  const origPrep = Dice3DEngine.prepareFlight;
  Dice3DEngine.canRoll3D = () => true;
  Dice3DEngine.prepareFlight = () => {};
  Service.playSeatDiceFlight = () => {
    flightsLaunched += 1;
  };

  try {
    const remoteRoll = {
      rollId: 'roll-dup-1',
      visibility: 'public',
      rollerRole: 'player',
      rollerClientId: 'c-p1',
      rollerInviteId: 'inv-1',
      rollerSeatKey: 'inv-1',
      rollerName: 'Kaelen',
      sides: 20,
      chosen: 17,
      mod: 2,
      total: 19,
      headline: '19',
      dice: [{ sides: 20, chosen: 17, colorHex: '#3b82f6' }]
    };

    // 1st arrival via BroadcastChannel
    Service.receiveRemoteRoll(remoteRoll);
    // 2nd arrival ~25ms later via PeerJS WebRTC (and 3rd via GM host relay)
    Service.receiveRemoteRoll({ ...remoteRoll });
    Service.receiveRemoteRoll({ ...remoteRoll });

    assert.equal(flightsLaunched, 1, 'Duplicate DICE_ROLL must launch 3D dice only once');
    assert.equal(Service.state.dice.history.length, 1, 'Duplicate DICE_ROLL must record in history only once');

    // Own roll echoed back via relay is ignored
    const localRecorded = Service.recordRoll({
      sides: 20,
      chosen: 15,
      mod: 0,
      total: 15,
      headline: '15',
      dice: [{ sides: 20, chosen: 15 }]
    });
    Service.receiveRemoteRoll({ ...localRecorded });
    assert.equal(flightsLaunched, 1, 'Echoed own roll must not trigger a remote flight');

    // Transport-level _checkAndMarkMsgId deduplicates identical _msgId
    assert.equal(RealtimeBridge._checkAndMarkMsgId('m-test-dup-99'), false);
    assert.equal(RealtimeBridge._checkAndMarkMsgId('m-test-dup-99'), true);
  } finally {
    Service.playSeatDiceFlight = origPlay;
    Dice3DEngine.canRoll3D = origCan3D;
    Dice3DEngine.prepareFlight = origPrep;
  }
});

test('Dice3DEngine.handleResize updates camera aspect and rescales active dice without running when idle', () => {
  const prevRenderer = Dice3DEngine.renderer;
  const prevCamera = Dice3DEngine.camera;
  const prevScene = Dice3DEngine.scene;
  const prevFlights = Dice3DEngine.activeFlights;
  const prevW = globalThis.window.innerWidth;
  const prevH = globalThis.window.innerHeight;

  let setSizeCalls = [];
  let projUpdated = 0;
  let renderCalls = 0;
  let lastScaled = 0;

  Dice3DEngine.renderer = {
    setSize(w, h) {
      setSizeCalls.push({ w, h });
    },
    render() {
      renderCalls += 1;
    }
  };
  Dice3DEngine.camera = {
    aspect: 1,
    updateProjectionMatrix() {
      projUpdated += 1;
    }
  };
  Dice3DEngine.scene = {};

  try {
    // No-op when no active flights exist
    Dice3DEngine.activeFlights = [];
    Dice3DEngine.handleResize();
    assert.equal(setSizeCalls.length, 0, 'handleResize is a no-op when no dice are on screen');

    // Resizes renderer, updates aspect ratio, and rescales die mesh when active flight exists
    Dice3DEngine.activeFlights = [
      {
        cellPx: 96,
        dieScale: 0.4,
        flyCamZ: 24,
        actors: [
          {
            mesh: {
              position: { x: 0, y: 0, z: 0 },
              scale: {
                setScalar(s) {
                  lastScaled = s;
                }
              }
            },
            shadowMesh: null
          }
        ]
      }
    ];
    globalThis.window.innerWidth = 960;
    globalThis.window.innerHeight = 600;
    Dice3DEngine.handleResize();

    assert.equal(setSizeCalls.length, 1);
    assert.deepEqual(setSizeCalls[0], { w: 960, h: 600 });
    assert.equal(Dice3DEngine.camera.aspect, 960 / 600);
    assert.equal(projUpdated, 1);
    assert.ok(lastScaled > 0);
    assert.equal(renderCalls, 1);
  } finally {
    Dice3DEngine.renderer = prevRenderer;
    Dice3DEngine.camera = prevCamera;
    Dice3DEngine.scene = prevScene;
    Dice3DEngine.activeFlights = prevFlights;
    globalThis.window.innerWidth = prevW;
    globalThis.window.innerHeight = prevH;
  }
});

test('scheduleSeatRollAutoHide marks seat roll autoHidden after dwell timer while keeping roll in seatRolls for avatar hover', async () => {
  resetState('gm', true);
  Service.seatRolls = new Map();
  const prevMs = Service.seatRollAutoHideMs;
  Service.seatRollAutoHideMs = 160;
  try {
    const roll = Service.recordRoll({
      rollId: 'r-autohide-1',
      sides: 20,
      chosen: 17,
      mod: 2,
      total: 19,
      headline: '19',
      label: '1d20'
    });
    assert.equal(roll.autoHidden, false);
    assert.equal(Service.seatRolls.get('gm')?.autoHidden, false);

    await new Promise((r) => setTimeout(r, 210));
    assert.equal(Service.seatRolls.get('gm')?.autoHidden, true, 'Roll transitions to autoHidden after dwell time');
    assert.equal(Service.seatRolls.has('gm'), true, 'Roll remains stored in seatRolls for avatar hover');
  } finally {
    Service.clearSeatRollAutoHide('gm');
    Service.seatRollAutoHideMs = prevMs;
  }
});
