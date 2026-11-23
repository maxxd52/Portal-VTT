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

const {
  DEFAULT_VISION_CONFIG,
  normalizeVisionConfig,
  normalizeSceneLighting,
  metersToDisplayValue,
  displayValueToMeters,
  formatDistance,
  metersToPixels,
  pixelsToMeters,
  resolveTokenVisionMeters,
  resolveTokenLightMeters,
  hasExplicitTokenVision
} = await import('../js/utils/lightingModel.js?v=20261123a7');
const { normalizeGridConfig, snapToGrid, measureGridDistance } = await import('../js/utils/gridGeometry.js?v=20261123a7');
const { generateFogMistPixels } = await import('../js/utils/fogShader.js?v=20261123a7');
const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { Selector } = await import('../js/core/selector.js?v=20261123a7');
const { Service } = await import('../js/core/service.js?v=20261123a7');
const { BrowserVault } = await import('../js/services/browserVault.js?v=20261123a7');
const { COMPENDIUM_ITEMS } = await import('../js/data/compendium.js?v=20261123a7');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261123a7');

function resetGmService() {
  Service.cancelAllTokenGlides();
  Service.setExploredMaskCapture(null);
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  return Service.state;
}

test('lightingModel normalizes vision/scene config and converts units accurately', () => {
  assert.deepEqual(normalizeVisionConfig({}), DEFAULT_VISION_CONFIG);

  // Explicit 0 vision (blinded) must be preserved, not replaced with default 9
  const zeroVis = normalizeVisionConfig({ defaultVisionMeters: 0, distanceUnit: 'ft', visionMode: 'individual', rememberExplored: false });
  assert.equal(zeroVis.defaultVisionMeters, 0);
  assert.equal(zeroVis.distanceUnit, 'ft');
  assert.equal(zeroVis.visionMode, 'individual');
  assert.equal(zeroVis.rememberExplored, false);

  const clamped = normalizeVisionConfig({ defaultVisionMeters: 120, torchMeters: 0.1, lanternMeters: 99, distanceUnit: 'km', visionMode: 'all' });
  assert.equal(clamped.defaultVisionMeters, 60);
  assert.equal(clamped.torchMeters, 0.5);
  assert.equal(clamped.lanternMeters, 60);
  assert.equal(clamped.distanceUnit, 'm');
  assert.equal(clamped.visionMode, 'shared');

  // Unit conversions: exact TTRPG mapping (1.5m = 5ft, 6m = 20ft, 9m = 30ft, 12m = 40ft)
  assert.equal(metersToDisplayValue(9, 'ft'), 30);
  assert.equal(displayValueToMeters(30, 'ft'), 9);
  assert.equal(formatDistance(9, 'ft'), '30 ft');
  assert.equal(formatDistance(1.5, 'm'), '1.5 m');
  assert.equal(formatDistance(6, 'm'), '6 m');

  // Pixel conversions obey both cellSize and metersPerUnit across square, hex, and gridless
  const gridNone = normalizeGridConfig({ type: 'none', cellSize: 100, metersPerUnit: 3 });
  assert.equal(metersToPixels(9, gridNone), 300);
  assert.equal(pixelsToMeters(300, gridNone), 9);

  const defaultGrid = normalizeGridConfig({ type: 'square', cellSize: 80, metersPerUnit: 1.5 });
  assert.equal(metersToPixels(9, defaultGrid), 480);

  // Scene lighting defaults & fallback
  assert.deepEqual(normalizeSceneLighting({}, { dynamicLighting: false, rememberExplored: false, exploredRev: 2 }), {
    dynamicLighting: false,
    rememberExplored: false,
    exploredMask: '',
    exploredRev: 2
  });
});

test('resolveTokenVisionMeters & resolveTokenLightMeters isolate personal sight from emitted/equipped light', () => {
  const sysVis = normalizeVisionConfig({ defaultVisionMeters: 9 });

  const inheritedAlly = { id: 'a1', isAlly: true, visionMeters: null, lightMeters: 0 };
  assert.equal(hasExplicitTokenVision(inheritedAlly), false);
  assert.equal(resolveTokenVisionMeters(inheritedAlly, sysVis), 9);
  assert.equal(resolveTokenLightMeters(inheritedAlly), 0);

  const darkvisionAlly = { id: 'a2', isAlly: true, visionMeters: 18, lightMeters: 6 };
  assert.equal(hasExplicitTokenVision(darkvisionAlly), true);
  assert.equal(resolveTokenVisionMeters(darkvisionAlly, sysVis), 18);
  assert.equal(resolveTokenLightMeters(darkvisionAlly), 6);

  const blindedAlly = { id: 'a3', isAlly: true, visionMeters: 0, lightMeters: 0 };
  assert.equal(hasExplicitTokenVision(blindedAlly), true);
  assert.equal(resolveTokenVisionMeters(blindedAlly, sysVis), 0);

  const legacyLightAlly = { id: 'a4', isAlly: true, lightRadius: 360, inventory: [{ lightRadius: 180 }] };
  assert.equal(resolveTokenLightMeters(legacyLightAlly), 12);

  const enemyWithTorch = { id: 'e1', isAlly: false, visionMeters: 18, lightMeters: 12 };
  assert.equal(resolveTokenVisionMeters(enemyWithTorch, sysVis), 0);
  assert.equal(resolveTokenLightMeters(enemyWithTorch), 12);
});

test('Selector.getAlliedVisibilityPolygons scales by map scale, enforces individual vision, blocks enemy sight leaks, and separates equipped torches', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = resetGmService();
    state.grid = normalizeGridConfig({ type: 'none', cellSize: 100, metersPerUnit: 3 });
    state.systemConfig.vision = normalizeVisionConfig({ defaultVisionMeters: 9, visionMode: 'shared' });
    state.tokens = [
      { id: 't1', name: 'Kaelen', isAlly: true, visionMeters: null, lightMeters: 0, x: 400, y: 400, hp: 20, maxHp: 20, inventory: [] },
      { id: 't2', name: 'Lyra', isAlly: true, visionMeters: 0, lightMeters: 0, x: 600, y: 400, hp: 14, maxHp: 14, inventory: [] },
      { id: 't3', name: 'Goblin', isAlly: false, visionMeters: 18, lightMeters: 12, x: 1400, y: 900, hp: 10, maxHp: 10, inventory: [] }
    ];
    state.walls = [];

    // GM / shared: t1 gets 9m => 300px; t2 is blinded (0); t3 is enemy so NEVER reveals fog for players
    const polysShared = Selector.getAlliedVisibilityPolygons(state);
    assert.equal(polysShared.length, 1);
    assert.equal(polysShared[0].token.id, 't1');
    assert.equal(polysShared[0].radius, 300);

    // Giving t2 a manual light restores radius around lightMeters (6m -> 200px) without altering visionMeters
    state.tokens[1].lightMeters = 6;
    const polysWithBlindedLight = Selector.getAlliedVisibilityPolygons(state);
    assert.equal(polysWithBlindedLight.length, 2);
    assert.equal(polysWithBlindedLight[1].radius, 200);

    // Individual player vision filters to assigned tokens only; unassigned spectator falls back to all visible allies
    state.systemConfig.vision.visionMode = 'individual';
    state.role = 'player';
    state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['t2'] }];
    state.activeInviteId = 'inv-1';
    const playerPolys = Selector.getAlliedVisibilityPolygons(state);
    assert.equal(playerPolys.length, 1);
    assert.equal(playerPolys[0].token.id, 't2');

    state.playerInvites = [{ id: 'inv-1', label: 'Spectator', tokenIds: [] }];
    assert.equal(Selector.getAlliedVisibilityPolygons(state).length, 2);

    // Equipping a torch extends effective radius via lightMeters without mutating personal visionMeters/visionRadius
    state.role = 'gm';
    state.tokens[0].visionMeters = 3; // 100px personal sight
    const torch = COMPENDIUM_ITEMS.find((i) => i.key === 'torch');
    const equipped = Service.equipItemToToken('t1', torch);
    assert.equal(state.tokens[0].visionMeters, 3, 'Equipping torch must not mutate personal visionMeters');
    assert.equal(state.tokens[0].visionRadius, undefined, 'Equipping torch must not inject legacy visionRadius');
    const afterEquip = Selector.getAlliedVisibilityPolygons(state).find((p) => p.token.id === 't1');
    assert.equal(afterEquip.radius, 200, 'Torch light (6m = 200px) extends beyond 3m personal vision');

    Service.removeTokenInventoryItem('t1', equipped.item.uid);
    const afterRemove = Selector.getAlliedVisibilityPolygons(state).find((p) => p.token.id === 't1');
    assert.equal(afterRemove.radius, 100, 'Removing torch cleanly reverts to personal vision');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('Service persists per-scene lighting and explored fog across map changes, resets cleanly, and isolates GM data', async () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (p) => sent.push(p);

  let fakeCanvasMask = 'data:image/png;base64,BASTION_EXPLORED';
  const notifications = [];

  try {
    const state = resetGmService();
    Service.subscribe((_st, opts) => notifications.push(opts));
    Service.setExploredMaskCapture(() => fakeCanvasMask);

    // Bastion has dynamicLighting=true; simulate explored fog and switch to forest
    Service.updateSceneLighting('bastion', { dynamicLighting: true, rememberExplored: true });
    Service.updateSceneLighting('forest', { dynamicLighting: false, rememberExplored: true });

    await Service.changeMap('forest');
    assert.equal(Service.state.activeMapKey, 'forest');
    assert.equal(Service.state.dynamicLighting, false);
    assert.equal(Service.state.exploredMask, '');
    assert.equal(Service.state.sceneLighting.bastion.exploredMask, 'data:image/png;base64,BASTION_EXPLORED');
    assert.ok(!notifications.at(-1)?.clearExplored, 'Changing map must sync explored fog instead of wiping it');

    // Return to bastion -> recovers both dynamicLighting=true and previously captured exploredMask
    fakeCanvasMask = '';
    await Service.changeMap('bastion');
    assert.equal(Service.state.dynamicLighting, true);
    assert.equal(Service.state.exploredMask, 'data:image/png;base64,BASTION_EXPLORED');
    assert.ok(Service.state.walls.length > 0, 'Bastion walls preserved');

    // Resetting explored fog clears mask and increments exploredRev without touching walls/tokens
    const wallCountBefore = Service.state.walls.length;
    const tokenCountBefore = Service.state.tokens.length;
    sent.length = 0;
    const resetRes = Service.resetSceneExploredFog('bastion');
    assert.equal(resetRes.exploredMask, '');
    assert.equal(resetRes.exploredRev, 1);
    assert.equal(Service.state.exploredMask, '');
    assert.equal(Service.state.exploredRev, 1);
    assert.equal(Service.state.walls.length, wallCountBefore);
    assert.equal(Service.state.tokens.length, tokenCountBefore);
    assert.ok(notifications.at(-1)?.clearExplored, 'Reset must emit clearExplored flag');
    assert.ok(sent.some((p) => p.kind === 'WORLD_SYNC' && p.world.exploredRev === 1));

    // P2P serialization excludes private sceneLighting dictionary while keeping active mask/rev
    Service.state.exploredMask = 'data:image/png;base64,NEW_EXPLORED';
    Service.state.sceneLighting.crypt = normalizeSceneLighting({ dynamicLighting: true, exploredMask: 'SECRET_CRYPT', exploredRev: 4 });
    const p2pWorld = Selector.extractSerializableWorld(Service.state);
    assert.equal('sceneLighting' in p2pWorld, false, 'P2P sync must never leak all maps sceneLighting');
    assert.equal(p2pWorld.exploredMask, 'data:image/png;base64,NEW_EXPLORED');
    assert.equal(p2pWorld.exploredRev, 1);
    assert.equal('fogRects' in p2pWorld, false);

    const vaultWorld = Selector.extractSerializableWorld(Service.state, { includePrivateGm: true });
    assert.equal(vaultWorld.sceneLighting.crypt.exploredMask, 'SECRET_CRYPT');

    // Updating unrelated system vision config must NOT clobber scene-specific rememberExplored
    Service.updateSceneLighting('bastion', { rememberExplored: false });
    Service.updateSystemVisionConfig({ defaultVisionMeters: 15 });
    assert.equal(Service.state.rememberExplored, false, 'Updating defaultVisionMeters must keep active scene rememberExplored');
    assert.equal(Selector.getSystemVisionConfig(Service.state).defaultVisionMeters, 15);
    assert.ok(notifications.at(-1)?.redrawFog);

    // Player WORLD_SYNC cannot clobber GM sceneLighting, and legacy worlds with fogRects load cleanly
    const gmCryptMask = Service.state.sceneLighting.crypt.exploredMask;
    Service.applyFullWorldState({ ...p2pWorld, fogRects: [{ x: 10, y: 10, r: 50, mode: 'reveal' }] }, true);
    assert.equal(Service.state.sceneLighting.crypt.exploredMask, gmCryptMask);
    assert.equal('fogRects' in Service.state, false);

    // Player role strips sceneLighting
    Service.state.role = 'player';
    Service.applyFullWorldState({ ...vaultWorld }, true);
    assert.deepEqual(Service.state.sceneLighting, {});
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('setTokenVision and cycleTokenLight enforce token control permissions and use system presets', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = resetGmService();
    state.systemConfig.vision = normalizeVisionConfig({ torchMeters: 5, lanternMeters: 10 });
    state.tokens = [{ id: 'tok-p1', name: 'Hero', isAlly: true, x: 200, y: 200, hp: 20, maxHp: 20, visionMeters: null, lightMeters: 0 }];

    // Authorized GM sets custom vision and resets to base
    Service.setTokenVision('tok-p1', 15);
    assert.equal(state.tokens[0].visionMeters, 15);
    Service.setTokenVision('tok-p1', null);
    assert.equal(state.tokens[0].visionMeters, null);

    // Light cycles 0 -> torch (5) -> lantern (10) -> 0
    assert.equal(Service.cycleTokenLight('tok-p1'), 5);
    assert.equal(Service.cycleTokenLight('tok-p1'), 10);
    assert.equal(Service.cycleTokenLight('tok-p1'), 0);

    // Unauthorized player cannot mutate unassigned token
    state.role = 'player';
    state.isHostGm = false;
    state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: [] }];
    state.activeInviteId = 'inv-1';
    assert.equal(Service.setTokenVision('tok-p1', 30), null);
    assert.equal(state.tokens[0].visionMeters, null);
    assert.equal(Service.cycleTokenLight('tok-p1'), 0);
    assert.equal(state.tokens[0].lightMeters, 0);

    // Gridless snapToGrid + measureGridDistance sanity check
    const noneGrid = normalizeGridConfig({ type: 'none', cellSize: 80, snap: true });
    assert.deepEqual(snapToGrid(noneGrid, 137.4, 291.8), { x: 137.4, y: 291.8 });
    assert.equal(measureGridDistance(noneGrid, 0, 0, 240, 0), 3);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('Legacy manual fog brush, fogRects, and fogMode are completely removed from UI and codebase', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const collectFiles = (dir, exts) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectFiles(full, exts));
      else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
    return out;
  };
  const targets = [path.join(root, 'index.html'), ...collectFiles(path.join(root, 'js'), ['.js'])];
  for (const file of targets) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(/\bfogRects\b|\bfogMode\b|data-ctx-tool="fog"/.test(content), false, `Found legacy manual fog in ${file}`);
  }
});

test('generateFogMistPixels guarantees 100% alpha=255, atmospheric mist variation, and seamless periodic wrap', () => {
  const w = 128;
  const h = 128;
  const data = generateFogMistPixels(w, h);
  assert.equal(data.length, w * h * 4);

  let minR = 255;
  let maxR = 0;
  let maxB = 0;
  for (let i = 0; i < data.length; i += 4) {
    assert.equal(data[i + 3], 255, 'Every fog mist pixel must be strictly opaque (alpha = 255)');
    if (data[i] < minR) minR = data[i];
    if (data[i] > maxR) maxR = data[i];
    if (data[i + 2] > maxB) maxB = data[i + 2];
  }
  assert.ok(maxR > minR, 'Fog shader must produce subtle mist gradient variation instead of flat black');
  assert.ok(maxB <= 60, `Fog mist channels must remain dark nocturnal obsidian (maxB=${maxB})`);

  // Seamless periodic tile continuity across horizontal & vertical wrap seams
  for (let y = 0; y < h; y++) {
    const leftIdx = (y * w + 0) * 4;
    const rightIdx = (y * w + (w - 1)) * 4;
    assert.ok(Math.abs(data[leftIdx + 2] - data[rightIdx + 2]) <= 6, 'Horizontal seam must wrap smoothly');
  }
  for (let x = 0; x < w; x++) {
    const topIdx = x * 4;
    const botIdx = ((h - 1) * w + x) * 4;
    assert.ok(Math.abs(data[topIdx + 2] - data[botIdx + 2]) <= 6, 'Vertical seam must wrap smoothly');
  }
});

test('Service.openPortal preserves restored explored fog with syncExplored=true and canvasView enforces opaque player fog', async () => {
  const origLoadRoom = BrowserVault.loadRoom;
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  const notifications = [];

  try {
    resetGmService();
    const savedWorld = Selector.extractSerializableWorld(Service.state, { includePrivateGm: true });
    savedWorld.exploredMask = 'data:image/png;base64,SAVED_MASK';
    savedWorld.exploredRev = 3;
    BrowserVault.loadRoom = async () => savedWorld;

    Service.subscribe((_st, opts) => notifications.push(opts));
    await Service.openPortal('TEST-FOG', 'gm');

    assert.equal(Service.state.exploredMask, 'data:image/png;base64,SAVED_MASK');
    assert.equal(notifications.at(-1)?.syncExplored, true);
    assert.equal(Boolean(notifications.at(-1)?.clearExplored), false);

    const canvasPath = path.resolve(import.meta.dirname, '..', 'js', 'ui', 'canvasView.js');
    const canvasSrc = fs.readFileSync(canvasPath, 'utf8');
    assert.match(canvasSrc, /fillFogMist\(/);
    assert.match(canvasSrc, /state\.role === 'gm' \? 0\.60 : 1/);
    assert.equal(/rgba\(8,\s*10,\s*16,\s*0\.97\)/.test(canvasSrc), false, 'Must not keep translucent 0.97 player darkness');
  } finally {
    BrowserVault.loadRoom = origLoadRoom;
    RealtimeBridge.send = origSend;
  }
});
