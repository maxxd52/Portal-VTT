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
const { BrowserVault } = await import('../js/services/browserVault.js?v=20261123a7');
const { CartridgePacker } = await import('../js/services/cartridgePacker.js?v=20261123a7');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261123a7');
const { WebPConverter } = await import('../js/utils/webpConverter.js?v=20261123a7');
const TabletopMaterial = await import('../js/utils/tabletopMaterial.js?v=20261123a7');

function resetGmService() {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.peers = new Map();
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.loadedMapImage = null;
  return Service.state;
}

test('VAULT-1: BrowserVault.scheduleRoomSave coalesces rapid writes sequentially, reports pending state, and surfaces errors via onSaveError', async () => {
  assert.equal(typeof BrowserVault.scheduleRoomSave, 'function', 'BrowserVault.scheduleRoomSave must exist');
  assert.equal(typeof BrowserVault.hasPendingSaves, 'function', 'BrowserVault.hasPendingSaves must exist');
  assert.equal(typeof BrowserVault.flushPendingSaves, 'function', 'BrowserVault.flushPendingSaves must exist');

  const origSaveRoom = BrowserVault.saveRoom;
  const origOnError = BrowserVault.onSaveError;
  let activeWrites = 0;
  let maxConcurrent = 0;
  const written = [];
  const errors = [];

  BrowserVault.onSaveError = (err) => errors.push(err);
  BrowserVault.saveRoom = async (code, payload) => {
    activeWrites += 1;
    maxConcurrent = Math.max(maxConcurrent, activeWrites);
    await new Promise((r) => setTimeout(r, 15));
    activeWrites -= 1;
    if (payload?.failMe) {
      if (typeof BrowserVault.onSaveError === 'function') {
        BrowserVault.onSaveError(new Error('QuotaExceededError'));
      }
      return false;
    }
    written.push({ code, rev: payload.rev });
    return true;
  };

  try {
    // 3 rapid debounced calls coalesce into 1 write with the latest snapshot
    BrowserVault.scheduleRoomSave('ROOM-A', () => ({ rev: 1 }), { delayMs: 25 });
    BrowserVault.scheduleRoomSave('ROOM-A', () => ({ rev: 2 }), { delayMs: 25 });
    BrowserVault.scheduleRoomSave('ROOM-A', () => ({ rev: 3 }), { delayMs: 25 });
    assert.equal(BrowserVault.hasPendingSaves(), true, 'Pending debounced write must report hasPendingSaves() === true');

    // Immediate write while flushing must not overlap
    const p1 = BrowserVault.scheduleRoomSave('ROOM-A', () => ({ rev: 4 }), { immediate: true });
    const p2 = BrowserVault.scheduleRoomSave('ROOM-A', () => ({ rev: 5 }), { immediate: true });
    await Promise.all([p1, p2]);

    assert.equal(maxConcurrent, 1, 'Vault writes must never overlap concurrently');
    assert.equal(written[written.length - 1].rev, 5, 'Latest queued snapshot must be persisted');
    assert.equal(BrowserVault.hasPendingSaves(), false, 'Queue must report idle after writes finish');

    // Failed write triggers onSaveError callback
    await BrowserVault.scheduleRoomSave('ROOM-A', () => ({ failMe: true }), { immediate: true });
    assert.equal(errors.length, 1, 'Failed write must notify BrowserVault.onSaveError');
  } finally {
    BrowserVault.saveRoom = origSaveRoom;
    BrowserVault.onSaveError = origOnError;
  }
});

test('VAULT-2: applyExternalMapUrl caches external URL as local WebP data URL and persists customMapSourceUrl in serializable world', async () => {
  const origSend = RealtimeBridge.send;
  const origSched = BrowserVault.scheduleRoomSave;
  RealtimeBridge.send = () => {};
  BrowserVault.scheduleRoomSave = () => Promise.resolve(true);

  try {
    const state = resetGmService();
    assert.equal(typeof Service.applyExternalMapUrl, 'function', 'Service.applyExternalMapUrl must exist');

    const fakeWebp = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAAAAFZQOCAYAAAAMAEAnQEqAQABAAFAJiWkAANwAP789AAA';
    const fakeConverter = {
      async sourceToWebPDataUrl(src) {
        assert.equal(src, 'https://example.com/maps/tavern.png');
        return fakeWebp;
      }
    };

    const res = await Service.applyExternalMapUrl('https://example.com/maps/tavern.png', { converter: fakeConverter });
    assert.equal(res.cached, true);
    assert.equal(state.mapId, 'custom');
    assert.equal(state.customMapUrl, fakeWebp, 'Active map URL must store local WebP copy');
    assert.equal(state.customMapSourceUrl, 'https://example.com/maps/tavern.png', 'Original source URL must be preserved');

    const exported = Selector.extractSerializableWorld(state, { includePrivateGm: true });
    assert.equal(exported.customMapUrl, fakeWebp);
    assert.equal(exported.customMapSourceUrl, 'https://example.com/maps/tavern.png');
  } finally {
    RealtimeBridge.send = origSend;
    BrowserVault.scheduleRoomSave = origSched;
  }
});

test('VAULT-3: refreshExternalMapFromSource updates cached copy on success and preserves cached WebP intact when link fails', async () => {
  const origSend = RealtimeBridge.send;
  const origSched = BrowserVault.scheduleRoomSave;
  RealtimeBridge.send = () => {};
  BrowserVault.scheduleRoomSave = () => Promise.resolve(true);

  try {
    const state = resetGmService();
    assert.equal(typeof Service.refreshExternalMapFromSource, 'function', 'Service.refreshExternalMapFromSource must exist');

    const cachedV1 = 'data:image/webp;base64,V1CACHEDDATA';
    const cachedV2 = 'data:image/webp;base64,V2UPDATEDDATA';
    state.mapId = 'custom';
    state.customMapUrl = cachedV1;
    state.customMapSourceUrl = 'https://example.com/maps/dungeon.png';

    // Case 1: Remote link fails (404 / offline / CORS) -> cached V1 MUST remain untouched
    const failRes = await Service.refreshExternalMapFromSource({
      converter: {
        async sourceToWebPDataUrl() {
          throw new Error('404 Not Found');
        }
      }
    });
    assert.equal(failRes.updated, false);
    assert.equal(failRes.preservedCache, true);
    assert.equal(state.customMapUrl, cachedV1, 'Cached map MUST be preserved when external URL fails');

    // Case 2: Remote link succeeds with updated image -> cached copy updates to V2
    const okRes = await Service.refreshExternalMapFromSource({
      converter: {
        async sourceToWebPDataUrl() {
          return cachedV2;
        }
      }
    });
    assert.equal(okRes.updated, true);
    assert.equal(state.customMapUrl, cachedV2, 'Cached map must update when external URL returns newer image');
  } finally {
    RealtimeBridge.send = origSend;
    BrowserVault.scheduleRoomSave = origSched;
  }
});

test('VAULT-4: loadExternalMapImage skips crossOrigin on data: URLs, retries without crossOrigin on CORS error, and skips redundant vault saves', () => {
  const origImage = globalThis.Image;
  const created = [];

  class FakeImage {
    constructor() {
      this.crossOrigin = undefined;
      this.onload = null;
      this.onerror = null;
      this._src = '';
      created.push(this);
    }
    set src(v) {
      this._src = v;
    }
    get src() {
      return this._src;
    }
  }
  globalThis.Image = FakeImage;

  try {
    resetGmService();
    const notifyOpts = [];
    Service.listeners.push((_, opts) => notifyOpts.push(opts));

    // 1. data: URL must NOT set crossOrigin = 'anonymous'
    Service.loadExternalMapImage('data:image/webp;base64,AAAA');
    assert.equal(created.length, 1);
    assert.equal(created[0].crossOrigin, undefined, 'data: URLs should not force crossOrigin');
    created[0].onload();
    assert.equal(notifyOpts[0]?.skipVaultSave, true, 'Image decode onload must not trigger redundant vault save');

    // 2. External HTTP URL retries once without crossOrigin if initial anonymous load fails
    Service.loadExternalMapImage('https://nocors.example.com/map.jpg');
    assert.equal(created.length, 2);
    assert.equal(created[1].crossOrigin, 'anonymous');
    created[1].onerror();
    assert.equal(created.length, 3, 'Should retry once without crossOrigin on error');
    assert.equal(created[2].crossOrigin, undefined, 'Fallback retry must omit crossOrigin');
  } finally {
    globalThis.Image = origImage;
  }
});

test('QUALITY-1: WebPConverter decodes WebP data URLs losslessly without canvas and adapts quality for 8K maps', () => {
  assert.equal(WebPConverter.MAP_MAX_DIM, 8192, 'Unified map max dimension must be 8192px');
  assert.equal(typeof WebPConverter.dataUrlToWebPBytes, 'function', 'dataUrlToWebPBytes helper must exist');
  assert.equal(typeof WebPConverter.resolveAdaptiveQuality, 'function', 'resolveAdaptiveQuality helper must exist');

  const sampleBytes = new Uint8Array([82, 73, 70, 70, 12, 0, 0, 0, 87, 69, 66, 80]); // "RIFF....WEBP"
  const b64 = Buffer.from(sampleBytes).toString('base64');
  const decoded = WebPConverter.dataUrlToWebPBytes(`data:image/webp;base64,${b64}`);
  assert.deepEqual(decoded, sampleBytes, 'WebP data URL must decode to exact original bytes');
  assert.equal(WebPConverter.dataUrlToWebPBytes('data:image/png;base64,AAAA'), null, 'Non-WebP data URL must return null');
  assert.equal(WebPConverter.dataUrlToWebPBytes('https://example.com/a.webp'), null, 'External HTTP URL must return null');

  assert.equal(WebPConverter.MAP_QUALITY, 0.85, 'Unified map quality must be 0.85');
  assert.equal(WebPConverter.resolveAdaptiveQuality(1920, 1080, 0.85), 0.85, '<=4096px uses crisp 0.85 quality');
  assert.equal(WebPConverter.resolveAdaptiveQuality(4096, 2730, 0.85), 0.85, '4K map keeps 0.85 quality');
  assert.equal(WebPConverter.resolveAdaptiveQuality(8192, 5570, 0.85), 0.82, '>4096px uses 0.82 perceptual sweet spot');
});

test('QUALITY-2: CartridgePacker exports WebP maps with zero re-encoding and deduplicates active map against Baúl customMaps', async () => {
  const origFflate = globalThis.window.fflate;
  const origSourceToBytes = WebPConverter.sourceToWebPBytes;
  let capturedZipTree = null;
  let canvasReencodeCalls = 0;

  globalThis.window.fflate = {
    zipSync(tree) {
      capturedZipTree = tree;
      return new Uint8Array([80, 75, 3, 4]);
    }
  };
  WebPConverter.sourceToWebPBytes = async () => {
    canvasReencodeCalls += 1;
    throw new Error('Should NOT re-encode already-WebP data URLs through canvas');
  };

  try {
    const rawWebpBytes = new Uint8Array([82, 73, 70, 70, 20, 0, 0, 0, 87, 69, 66, 80, 1, 2, 3, 4]);
    const webpDataUrl = `data:image/webp;base64,${Buffer.from(rawWebpBytes).toString('base64')}`;

    const state = resetGmService();
    state.mapId = 'custom';
    state.customMapUrl = webpDataUrl;
    state.customMaps = [
      { key: 'cmap_1', name: 'Dungeon 4K', imageUrl: webpDataUrl, desc: 'Big map' }
    ];

    await CartridgePacker.buildPortalBlob(state);
    assert.equal(canvasReencodeCalls, 0, 'Existing WebP map must bypass canvas re-encoding completely');
    assert.ok(capturedZipTree, 'zipSync must receive zipTree');

    const mapAssetKeys = Object.keys(capturedZipTree).filter((k) => k.startsWith('assets/maps/'));
    assert.equal(mapAssetKeys.length, 1, 'Active map and identical Baúl map must be deduplicated into 1 ZIP entry');
    assert.deepEqual(capturedZipTree[mapAssetKeys[0]], rawWebpBytes, 'Exported ZIP entry must contain exact original WebP bytes');

    const worldJson = JSON.parse(new TextDecoder().decode(capturedZipTree['world.json']));
    assert.equal(worldJson.customMapUrl, `portal://${mapAssetKeys[0]}`);
    assert.equal(worldJson.customMaps[0].imageUrl, `portal://${mapAssetKeys[0]}`, 'Baúl map must reference the same deduplicated asset URI');
  } finally {
    globalThis.window.fflate = origFflate;
    WebPConverter.sourceToWebPBytes = origSourceToBytes;
  }
});

test('ZOOM-1: Adaptive max zoom matches map native pixel density and grid cellSize (up to 5.0x) and setZoom skips redundant vault saves', () => {
  assert.equal(typeof TabletopMaterial.computeAdaptiveMaxZoom, 'function', 'computeAdaptiveMaxZoom must be exported');
  assert.equal(TabletopMaterial.computeAdaptiveMaxZoom(0, 0), 1.65, 'Preset maps default to 1.65x max zoom');
  assert.equal(TabletopMaterial.computeAdaptiveMaxZoom(2048, 2048), 1.35, '2K square map floors at 1.35x');
  assert.equal(TabletopMaterial.computeAdaptiveMaxZoom(4096, 2730), 1.79, '4K 3:2 map allows ~1.79x (1:1 sharpness + 5%)');
  assert.equal(TabletopMaterial.computeAdaptiveMaxZoom(8000, 4000), 3.5, '8K map native density scales up to 3.5x');
  assert.equal(TabletopMaterial.computeAdaptiveMaxZoom(16000, 8000), 5, 'Huge map caps cleanly at 5.0x');
  assert.equal(TabletopMaterial.computeAdaptiveMaxZoom(4096, 2785, 2400, 1600, 31.64), 4.17, 'Dense 75x51 grid allows ~4.17x (~132px/cell)');
  assert.equal(TabletopMaterial.computeAdaptiveMaxZoom(4096, 2785, 2400, 1600, 20), 5, 'Ultra-dense grid caps cleanly at 5.0x');

  const state = resetGmService();
  state.mapId = 'custom';
  Service.loadedMapImage = { naturalWidth: 4096, naturalHeight: 2730 };
  state.grid.cellSize = 80;
  assert.equal(Service.getMaxCameraZoom(), 1.79);

  state.grid.cellSize = 31.64;
  assert.equal(Service.getMaxCameraZoom(), 4.17);

  const notifyOpts = [];
  Service.listeners.push((_, opts) => notifyOpts.push(opts));
  Service.setZoom(5.0, 640, 360);
  assert.equal(state.camera.zoom, 4.17, 'setZoom must clamp to adaptive max zoom for dense grid');
  assert.equal(notifyOpts[0]?.skipVaultSave, true, 'Zooming must not trigger redundant vault saves');
});

test('VAULT-5: registerAndActivateDirectMap registers direct drop/modal maps in customMaps and activates their scene key', async () => {
  const state = resetGmService();
  const webpUrl = 'data:image/webp;base64,AAAA';

  const entry = await Service.registerAndActivateDirectMap(webpUrl, 'Mapa_4K_Castillo.png');
  assert.ok(entry && entry.key, 'Must return created customMap entry');
  assert.equal(entry.name, 'Mapa_4K_Castillo');
  assert.equal(entry.imageUrl, webpUrl);
  assert.equal(entry.sceneMode, 'tactical');

  assert.equal(state.customMaps.length, 1, 'Direct map must appear in Baúl customMaps');
  assert.equal(state.customMaps[0].key, entry.key);
  assert.equal(state.mapId, 'custom');
  assert.equal(state.customMapUrl, webpUrl);
  assert.equal(state.activeMapKey, entry.key);
});

test('VAULT-6: BrowserVault.onSaveStateChange fires once on idle->saving->idle transitions and lifecycle flushes cleanly', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const states = [];
  const prevStateCb = BrowserVault.onSaveStateChange;
  const prevSaveRoom = BrowserVault.saveRoom;
  let resolveSave = null;
  BrowserVault.onSaveStateChange = (isSaving) => states.push(isSaving);
  BrowserVault.saveRoom = () =>
    new Promise((resolve) => {
      resolveSave = () => resolve(true);
    });

  try {
    const p = BrowserVault.scheduleRoomSave('MESA-SAVE', () => ({ ok: 1 }), { immediate: true });
    assert.deepEqual(states, [true], 'Must emit true while save is in flight');
    assert.equal(BrowserVault.hasPendingSaves(), true);

    resolveSave();
    await p;
    assert.deepEqual(states, [true, false], 'Must emit false once queue drains');
    assert.equal(BrowserVault.hasPendingSaves(), false);
  } finally {
    BrowserVault.onSaveStateChange = prevStateCb;
    BrowserVault.saveRoom = prevSaveRoom;
  }

  const viewSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'js', 'core', 'view.js'), 'utf8');
  assert.match(viewSrc, /visibilitychange/);
  assert.match(viewSrc, /pagehide[\s\S]*GmHostLock\.release\(\)/);
  assert.match(viewSrc, /vaultSaveBadge[\s\S]*350/);

  const serviceSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'js', 'core', 'service.js'), 'utf8');
  const maskFnStart = serviceSrc.indexOf('saveActiveExploredMask(');
  const maskFnEnd = serviceSrc.indexOf('getSceneLighting(', maskFnStart);
  assert.ok(maskFnStart >= 0 && maskFnEnd > maskFnStart);
  const maskBlock = serviceSrc.slice(maskFnStart, maskFnEnd);
  assert.match(maskBlock, /BrowserVault\.scheduleRoomSave\(/);
  assert.doesNotMatch(maskBlock, /BrowserVault\.saveRoom\(/);
});
