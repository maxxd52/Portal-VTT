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
  AMBIENT_LIGHT_MODES,
  DARKNESS_UNLIT_AURA_METERS,
  DEFAULT_VISION_CONFIG,
  MAP_LIGHT_TONES,
  MAP_LIGHT_TONE_META,
  MAP_LIGHT_ANIMATIONS,
  normalizeAmbientLight,
  getAmbientLightMeta,
  normalizeMapLightTone,
  normalizeMapLightAnimation,
  normalizeMapLight,
  computeLightAnimationSample,
  normalizeSceneLighting,
  normalizeVisionConfig,
  resolveEffectiveTokenVisionMeters,
  resolveCanvasLightingPlan,
  stepDistanceMeters,
  FULL_MAP_LOS_PX,
  NIGHT_DETECTION_METERS,
  resolveAmbientShadowVector,
  resolveTokenDarkvisionMeters
} = await import('../js/utils/lightingModel.js?v=20261125a1');
const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261125a1');
const { buildMapMenuSpec, buildMapLightMenuSpec } = await import('../js/utils/contextMenuModel.js?v=20261125a1');
const { hasUiLineIcon } = await import('../js/utils/uiIcons.js?v=20261125a1');
const { clipSegmentToRect, isDoorVisibleToSeat, shouldShowWallBlueprint } = await import('../js/utils/wallGeometry.js?v=20261125a1');

test('S1-RED: ambient light, map light normalization, and sceneLighting ambient default', () => {
  assert.deepEqual(AMBIENT_LIGHT_MODES, ['day', 'night', 'darkness']);
  assert.deepEqual(MAP_LIGHT_TONES, ['warm', 'neutral', 'cool', 'magic', 'danger']);
  assert.equal(DARKNESS_UNLIT_AURA_METERS, 1.5);

  assert.equal(normalizeAmbientLight('night'), 'night');
  assert.equal(normalizeAmbientLight('dusk'), 'day');
  assert.equal(normalizeAmbientLight('unknown', 'night'), 'night');
  assert.equal(normalizeAmbientLight(null), 'day');

  const darkMeta = getAmbientLightMeta('darkness');
  assert.equal(darkMeta.id, 'darkness');
  assert.equal(darkMeta.requiresLight, true);
  assert.ok(darkMeta.darknessAlpha >= 0.95);

  assert.equal(normalizeMapLightTone('magic'), 'magic');
  assert.equal(normalizeMapLightTone('invalid'), 'warm');

  const light = normalizeMapLight({ id: 'l1', x: 120, y: 240, radiusMeters: 120, tone: 'cool', enabled: false }, 'bastion');
  assert.deepEqual(light, {
    id: 'l1',
    sceneKey: 'bastion',
    x: 120,
    y: 240,
    radiusMeters: 40,
    tone: 'cool',
    enabled: false,
    animation: 'steady',
    flicker: true
  });

  const sceneLighting = normalizeSceneLighting({}, { dynamicLighting: true });
  assert.equal(sceneLighting.ambient, 'day');
});

test('S1-RED: resolveEffectiveTokenVisionMeters enforces full-map LoS, darkness, torch, darkvisionMeters, and blinded rules', () => {
  const sysVis = normalizeVisionConfig({ defaultVisionMeters: 9 });

  assert.equal(resolveTokenDarkvisionMeters({ darkvisionMeters: 12 }), 12);
  assert.equal(resolveTokenDarkvisionMeters({ darkvision: true }), 18);
  assert.equal(resolveTokenDarkvisionMeters({ darkvision: false }), 0);

  const normalTok = { id: 'a1', isAlly: true, visionMeters: 9, lightMeters: 0, darkvision: false };
  for (const mode of ['day', 'night']) {
    const res = resolveEffectiveTokenVisionMeters(normalTok, sysVis, mode);
    assert.equal(res.fullMapSight, true);
    assert.equal(res.darkvisionMeters, 0);
  }

  // Darkness without darkvision and no light -> fullMapSight LoS + 1.5m aura
  const unlitDark = resolveEffectiveTokenVisionMeters(normalTok, sysVis, 'darkness');
  assert.equal(unlitDark.fullMapSight, true);
  assert.equal(unlitDark.clearMeters, 1.5);
  assert.equal(unlitDark.darkvisionMeters, 0);

  // Darkness without darkvision with 6m torch
  const torchTok = { id: 'a2', isAlly: true, visionMeters: 9, lightMeters: 6, darkvision: false };
  const torchDark = resolveEffectiveTokenVisionMeters(torchTok, sysVis, 'darkness');
  assert.equal(torchDark.fullMapSight, true);
  assert.equal(torchDark.clearMeters, 6);
  assert.equal(torchDark.darkvisionMeters, 0);

  // Darkness with darkvisionMeters: 15 (or legacy darkvision: true -> 18m)
  const dvTok = { id: 'a3', isAlly: true, visionMeters: 12, lightMeters: 0, darkvisionMeters: 15 };
  const dvDark = resolveEffectiveTokenVisionMeters(dvTok, sysVis, 'darkness');
  assert.equal(dvDark.fullMapSight, true);
  assert.equal(dvDark.darkvisionMeters, 15);
  assert.equal(dvDark.clearMeters, 1.5);

  // Blinded ally (visionMeters: 0) with 6m torch
  const blindTorch = { id: 'a4', isAlly: true, visionMeters: 0, lightMeters: 6, darkvision: false };
  const blindRes = resolveEffectiveTokenVisionMeters(blindTorch, sysVis, 'darkness');
  assert.equal(blindRes.fullMapSight, false);
  assert.equal(blindRes.sightMeters, 6);
  assert.equal(blindRes.clearMeters, 6);
});

test('S1-RED: Selector.getVisibleTokensForSeat enforces darkness, darkvision, mapLights, and anti-spoiler walls', () => {
  const baseState = createInitialState();
  baseState.role = 'player';
  baseState.activeInviteId = 'inv-1';
  baseState.dynamicLighting = true;
  baseState.sceneAmbientLight = 'darkness';
  baseState.grid = { type: 'square', cellSize: 80, metersPerUnit: 1.5 }; // 1m = 53.33px, 5m = 266.67px
  baseState.walls = [];
  baseState.mapLights = [];
  baseState.playerInvites = [{ id: 'inv-1', tokenIds: ['ally-1'] }];

  const ally = { id: 'ally-1', isAlly: true, x: 400, y: 400, visionMeters: 9, lightMeters: 0, darkvision: false, hidden: false };
  const enemy = { id: 'enemy-1', isAlly: false, x: 660, y: 400, hidden: false }; // 260px = ~4.875m away
  baseState.tokens = [ally, enemy];

  // 1. Pitch black, unlit normal ally -> enemy hidden
  assert.deepEqual(Selector.getVisibleTokensForSeat(baseState, 'inv-1').map((t) => t.id), ['ally-1']);

  // 2. Ally with darkvision -> enemy visible
  ally.darkvision = true;
  assert.deepEqual(Selector.getVisibleTokensForSeat(baseState, 'inv-1').map((t) => t.id), ['ally-1', 'enemy-1']);
  ally.darkvision = false;

  // 3. Ally with 6m torch -> enemy visible
  ally.lightMeters = 6;
  assert.deepEqual(Selector.getVisibleTokensForSeat(baseState, 'inv-1').map((t) => t.id), ['ally-1', 'enemy-1']);
  ally.lightMeters = 0;

  // 4. Unlit ally + mapLight near enemy (unobstructed) -> enemy visible
  baseState.mapLights = [{ id: 'ml-1', sceneKey: baseState.activeMapKey, x: 700, y: 400, radiusMeters: 4, tone: 'warm', enabled: true, flicker: true }];
  assert.deepEqual(Selector.getVisibleTokensForSeat(baseState, 'inv-1').map((t) => t.id), ['ally-1', 'enemy-1']);

  // 5. Wall between mapLight and enemy -> enemy hidden (anti-spoiler)
  baseState.walls = [{ id: 'w-1', kind: 'wall', x1: 680, y1: 300, x2: 680, y2: 500 }];
  assert.deepEqual(Selector.getVisibleTokensForSeat(baseState, 'inv-1').map((t) => t.id), ['ally-1']);

  // 6. Wall between ally and enemy (even if mapLight illuminates enemy) -> enemy hidden
  baseState.walls = [{ id: 'w-2', kind: 'wall', x1: 520, y1: 300, x2: 520, y2: 500 }];
  assert.deepEqual(Selector.getVisibleTokensForSeat(baseState, 'inv-1').map((t) => t.id), ['ally-1']);
});

test('S1-RED: Service ambient light, mapLights CRUD, darkvision toggle, and P2P world redaction', async () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.isHostGm = true;
    Service.state.mapId = 'bastion';
    Service.state.activeMapKey = 'bastion';
    Service.state.tokens = [
      { id: 'tok-1', name: 'Elf', isAlly: true, x: 440, y: 440, hp: 20, maxHp: 20, ac: 14, size: 1, visionMeters: null, lightMeters: 0, inventory: [] }
    ];
    Service.state.customActors = [
      { key: 'elf', name: 'Elf', size: 1, lightMeters: 0, visionMeters: 18, darkvision: true }
    ];

    // Ambient light persistence across changeMap
    assert.equal(Service.setSceneAmbientLight('darkness'), 'darkness');
    assert.equal(Service.state.sceneAmbientLight, 'darkness');
    assert.equal(Service.state.sceneLighting.bastion.ambient, 'darkness');

    await Service.changeMap('forest');
    assert.equal(Service.state.sceneAmbientLight, 'day');
    await Service.changeMap('bastion');
    assert.equal(Service.state.sceneAmbientLight, 'darkness');

    // mapLights CRUD + GM-only guard (new lights default to enabled: false for anti-spoiler)
    const added = Service.addMapLight(320, 480, { radiusMeters: 8, tone: 'magic' });
    assert.ok(added && added.id);
    assert.equal(added.sceneKey, 'bastion');
    assert.equal(added.tone, 'magic');
    assert.equal(added.enabled, false);

    const disabledLight = Service.addMapLight(600, 600, { radiusMeters: 6, enabled: false });
    assert.ok(disabledLight && disabledLight.id);

    const otherSceneLight = Service.addMapLight(100, 100, { sceneKey: 'forest', radiusMeters: 6, enabled: true });
    assert.ok(otherSceneLight && otherSceneLight.id);

    const updated = Service.updateMapLight(added.id, { radiusMeters: 10, tone: 'cool', enabled: true });
    assert.equal(updated.radiusMeters, 10);
    assert.equal(updated.tone, 'cool');
    assert.equal(updated.enabled, true);

    // Token darkvisionMeters + resetTokenTempProps
    const tok = Service.state.tokens[0];
    tok.actorKey = 'elf';
    Service.setTokenDarkvisionMeters(tok.id, 15);
    assert.equal(tok.darkvisionMeters, 15);
    assert.equal(tok.darkvision, true);
    Service.setTokenDarkvision(tok.id, false);
    assert.equal(tok.darkvision, false);
    assert.equal(tok.darkvisionMeters, 0);
    Service.resetTokenTempProps(tok.id);
    assert.equal(tok.darkvision, true);
    assert.equal(tok.darkvisionMeters, 18);

    // P2P Redaction
    const wire = Selector.extractSerializableWorld(Service.state, {
      includePrivateGm: false,
      forSeatKey: 'inv-missing'
    });
    assert.equal(wire.sceneAmbientLight, 'darkness');
    assert.equal(wire.mapLights.length, 1);
    assert.equal(wire.mapLights[0].id, added.id);
    assert.equal(wire.tokens[0].darkvision, true);

    // GM-only guard
    Service.state.role = 'player';
    assert.equal(Service.setSceneAmbientLight('day'), null);
    assert.equal(Service.addMapLight(100, 100), null);
    assert.equal(Service.updateMapLight(added.id, { radiusMeters: 3 }), null);
    assert.equal(Service.deleteMapLight(added.id), false);

    // GM delete
    Service.state.role = 'gm';
    assert.equal(Service.deleteMapLight(added.id), true);
    assert.equal(Service.state.mapLights.some((l) => l.id === added.id), false);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S2-RED: resolveCanvasLightingPlan computes darknessAlpha, useDarknessMask, and shouldRender across modes', () => {
  const idleDay = resolveCanvasLightingPlan({
    dynamicLighting: false,
    ambient: 'day',
    role: 'player',
    hasActiveLights: false,
    showBlueprint: false,
    hasAnyDoors: false
  });
  assert.equal(idleDay.shouldRender, false);
  assert.equal(idleDay.useDarknessMask, false);
  assert.equal(idleDay.restrictExploredToLit, false);

  const staticNight = resolveCanvasLightingPlan({
    dynamicLighting: false,
    ambient: 'night',
    role: 'player',
    hasActiveLights: false,
    showBlueprint: false,
    hasAnyDoors: false
  });
  assert.equal(staticNight.shouldRender, true);
  assert.equal(staticNight.useDarknessMask, true);
  assert.equal(staticNight.darknessAlpha, 0.68);

  const staticDayWithLights = resolveCanvasLightingPlan({
    dynamicLighting: false,
    ambient: 'day',
    role: 'gm',
    hasActiveLights: true,
    showBlueprint: false,
    hasAnyDoors: false
  });
  assert.equal(staticDayWithLights.shouldRender, true);
  assert.equal(staticDayWithLights.useDarknessMask, false);

  const gmDark = resolveCanvasLightingPlan({
    dynamicLighting: true,
    ambient: 'darkness',
    role: 'gm',
    hasActiveLights: false,
    showBlueprint: false,
    hasAnyDoors: false
  });
  assert.equal(gmDark.darknessAlpha, 0.62);
  assert.equal(gmDark.restrictExploredToLit, true);

  const playerDark = resolveCanvasLightingPlan({
    dynamicLighting: true,
    ambient: 'darkness',
    role: 'player',
    hasActiveLights: false,
    showBlueprint: false,
    hasAnyDoors: false
  });
  assert.equal(playerDark.darknessAlpha, 0.98);
  assert.equal(playerDark.restrictExploredToLit, true);
});

test('S2-RED: canvasView composites ambient/light offscreen behind fog (destination-over) and styles.css grades narrativeBackdropLayer', () => {
  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /Selector\.getActiveAmbientLight\(state\)/);
  assert.match(canvasSrc, /Selector\.getActiveLightPolygons\(state\)/);
  assert.match(canvasSrc, /destination-over/);
  assert.match(canvasSrc, /MAP_LIGHT_TONE_META/);
  assert.match(canvasSrc, /narrativeBackdropLayer\.dataset\.ambient/);

  const cssSrc = fs.readFileSync(path.resolve('css/styles.css'), 'utf8');
  assert.match(cssSrc, /#narrativeBackdropLayer::after/);
  assert.doesNotMatch(cssSrc, /\[data-ambient="dusk"\]/);
  assert.match(cssSrc, /\[data-ambient="night"\]/);
  assert.match(cssSrc, /\[data-ambient="darkness"\]/);
});

test('S3-RED: contextMenuModel, uiIcons, index.html, domCache, contextMenuView, and canvasView wire ambient, map lights, and darkvision UX', () => {
  const gmMapIds = buildMapMenuSpec({ role: 'gm', dynamicLighting: true, isNarrative: false }).sections.flat().map((i) => i.id);
  assert.ok(!gmMapIds.includes('add-light'));

  const playerMapIds = buildMapMenuSpec({ role: 'player', dynamicLighting: true, isNarrative: false }).sections.flat().map((i) => i.id);
  assert.ok(!playerMapIds.includes('add-light'));

  const narrativeMapIds = buildMapMenuSpec({ role: 'gm', dynamicLighting: true, isNarrative: true }).sections.flat().map((i) => i.id);
  assert.ok(!narrativeMapIds.includes('add-light'));

  const onSpec = buildMapLightMenuSpec({ id: 'ml-1', enabled: true });
  assert.equal(onSpec.header.subtitle, 'Encendida');
  assert.deepEqual(
    onSpec.sections.flat().map((i) => i.id),
    ['toggle-enabled', 'delete-light']
  );
  const offSpec = buildMapLightMenuSpec({ id: 'ml-1', enabled: false });
  assert.equal(offSpec.header.subtitle, 'Apagada');
  assert.equal(offSpec.sections.flat().find((i) => i.id === 'delete-light').danger, true);

  for (const icon of ['sun', 'sunset', 'moon', 'eclipse']) {
    assert.equal(hasUiLineIcon(icon), true, `Missing icon ${icon}`);
  }

  const htmlSrc = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.match(htmlSrc, /id="mapLightsLayer"/);

  const domCacheSrc = fs.readFileSync(path.resolve('js/ui/domCache.js'), 'utf8');
  assert.match(domCacheSrc, /mapLightsLayer:\s*byId\('mapLightsLayer'\)/);

  const ctxViewSrc = fs.readFileSync(path.resolve('js/ui/contextMenuView.js'), 'utf8');
  assert.match(ctxViewSrc, /data-ctx-ambient/);
  assert.match(ctxViewSrc, /renderStepper\('darkvision'/);
  assert.match(ctxViewSrc, /openMapLightContextMenu\s*\(/);

  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /renderMapLights\s*\(state\)/);
  assert.match(canvasSrc, /state\.role !== 'gm'/);

  const cssSrc = fs.readFileSync(path.resolve('css/styles.css'), 'utf8');
  assert.match(cssSrc, /#mapLightsLayer\s*\{\s*z-index:\s*10;\s*pointer-events:\s*none;\s*\}/);
});

test('S4-RED: stepDistanceMeters steps by ±1 (Shift ±5) in m/ft with clamping, and contextMenuView uses granular vision without Base label', () => {
  assert.equal(stepDistanceMeters(9, 1, { unit: 'm', shiftKey: false, min: 0, max: 60 }), 10);
  assert.equal(stepDistanceMeters(9, -1, { unit: 'm', shiftKey: false, min: 0, max: 60 }), 8);
  assert.equal(stepDistanceMeters(9, 1, { unit: 'm', shiftKey: true, min: 0, max: 60 }), 14);
  assert.equal(stepDistanceMeters(3, -1, { unit: 'm', shiftKey: true, min: 1, max: 40 }), 1);
  assert.equal(stepDistanceMeters(39, 1, { unit: 'm', shiftKey: true, min: 1, max: 40 }), 40);

  // Feet mode: 3 m = 10 ft -> +1 ft = 11 ft = 3.3 m; Shift +5 ft = 15 ft = 4.5 m
  assert.equal(stepDistanceMeters(3, 1, { unit: 'ft', shiftKey: false, min: 0, max: 60 }), 3.3);
  assert.equal(stepDistanceMeters(3, 1, { unit: 'ft', shiftKey: true, min: 0, max: 60 }), 4.5);

  const ctxViewSrc = fs.readFileSync(path.resolve('js/ui/contextMenuView.js'), 'utf8');
  assert.match(ctxViewSrc, /stepDistanceMeters\s*\(/);
  assert.match(ctxViewSrc, /resolveTokenDarkvisionMeters\s*\(/);
  assert.doesNotMatch(ctxViewSrc, /curVis === null \? 'Base'/);
});

test('S5-RED: Escenografía mode keeps walls visible across Muros/Luces/Seleccionar, syncs stageLayer, and hides pins in normal play', () => {
  assert.equal(shouldShowWallBlueprint({ role: 'gm', tool: 'wall', stageLayer: 'walls' }), true);
  assert.equal(shouldShowWallBlueprint({ role: 'gm', tool: 'wall', stageLayer: 'lights' }), true);
  assert.equal(shouldShowWallBlueprint({ role: 'gm', tool: 'wall', stageLayer: 'select' }), true);
  assert.equal(shouldShowWallBlueprint({ role: 'gm', tool: 'select', stageLayer: 'walls' }), false);

  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.mapId = 'bastion';
    Service.state.activeMapKey = 'bastion';
    Service.state.selectedWallIds = ['w-1'];
    Service.state.wallAnchor = { x: 100, y: 100 };

    assert.equal(Service.setStageLayer('lights'), 'lights');
    assert.equal(Service.state.stageLayer, 'lights');
    assert.deepEqual(Service.state.selectedWallIds, []);
    assert.equal(Service.state.wallAnchor, null);
    assert.equal(Service.setStageLayer('select'), 'select');
    assert.equal(Service.state.stageLayer, 'select');
    assert.equal(Service.state.wallMode, 'select');
    assert.equal(Service.setStageLayer('walls'), 'walls');
    assert.equal(Service.state.wallMode, 'draw');

    const l1 = Service.addMapLight(100, 100, { sceneKey: 'bastion' });
    const l2 = Service.addMapLight(200, 200, { sceneKey: 'bastion' });
    const lOther = Service.addMapLight(300, 300, { sceneKey: 'forest' });
    assert.equal(Service.setAllSceneMapLightsEnabled(true), 2);
    assert.equal(Service.state.mapLights.find((l) => l.id === l1.id).enabled, true);
    assert.equal(Service.state.mapLights.find((l) => l.id === l2.id).enabled, true);
    assert.equal(Service.state.mapLights.find((l) => l.id === lOther.id).enabled, false);
    assert.equal(Service.setAllSceneMapLightsEnabled(false), 2);
    assert.equal(Service.state.mapLights.find((l) => l.id === l1.id).enabled, false);
  } finally {
    RealtimeBridge.send = origSend;
  }

  const htmlSrc = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.match(htmlSrc, /id="stageLayerSeg"/);
  assert.match(htmlSrc, /id="stageWallsControls"/);
  assert.match(htmlSrc, /id="stageLightsControls"/);
  assert.match(htmlSrc, /id="btnStageToggleAllLights"/);

  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /state\.tool !== 'wall'/);
  assert.match(canvasSrc, /state\.stageSelectFilter === 'walls'/);

  const boardSrc = fs.readFileSync(path.resolve('js/ui/boardView.js'), 'utf8');
  assert.match(boardSrc, /Service\.state\.stageLayer === 'lights'/);
});

test('S6-RED: Full-map LoS + single Visión oscura stepper + update-vision-on-drop (no fog redraw on drag)', () => {
  const state = createInitialState();
  state.role = 'gm';
  state.dynamicLighting = true;
  state.sceneAmbientLight = 'day';
  state.walls = [];
  state.tokens = [
    { id: 't1', isAlly: true, x: 400, y: 400, visionMeters: null, lightMeters: 0, darkvisionMeters: 18 }
  ];
  const polys = Selector.getAlliedVisibilityPolygons(state);
  assert.equal(polys.length, 1);
  assert.equal(polys[0].fullMapSight, true);
  assert.equal(polys[0].radius, FULL_MAP_LOS_PX);

  const ctxViewSrc = fs.readFileSync(path.resolve('js/ui/contextMenuView.js'), 'utf8');
  assert.doesNotMatch(ctxViewSrc, /renderStepper\('vision'/);
  assert.doesNotMatch(ctxViewSrc, /data-ctx-darkvision/);
  assert.match(ctxViewSrc, /setTokenDarkvisionMeters\s*\(/);

  const boardSrc = fs.readFileSync(path.resolve('js/ui/boardView.js'), 'utf8');
  const dragBlockMatch = boardSrc.match(/if \(activePointerMode === 'token' && draggingTokenId\)[\s\S]*?\} else if \(activePointerMode === 'areaSelect'/);
  assert.ok(dragBlockMatch, 'Could not locate token drag pointermove block');
  assert.doesNotMatch(dragBlockMatch[0], /scheduleFogRedraw/);
  assert.match(boardSrc, /this\.drawFogCanvas\(Service\.state\)/);
  assert.match(boardSrc, /this\._dragFrozenVisibleIds\s*=\s*new Set\(/);
  assert.match(boardSrc, /this\._dragFrozenVisibleIds\s*=\s*null/);
  assert.match(boardSrc, /this\.draggingTokenId\s*&&\s*this\._dragFrozenVisibleIds\s+instanceof\s+Set/);
});

test('S7-RED: darkness uses seamless baseFog mist and hides unlit doors from players', () => {
  const door = { id: 'd-1', kind: 'door', x1: 660, y1: 360, x2: 660, y2: 440, open: false };
  const roomPoly = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 800 },
    { x: 0, y: 800 }
  ];
  const visSources = [
    {
      token: { id: 'a1', x: 400, y: 400 },
      radius: 2900,
      clearRadiusPx: 80,
      darkvisionRadiusPx: 0,
      poly: roomPoly
    }
  ];

  // Unlit door 260px away in darkness -> hidden from player
  assert.equal(
    isDoorVisibleToSeat(door, { role: 'player', dynamicLighting: true, visSources, ambient: 'darkness', lightPolys: [] }),
    false
  );
  // Visible in day, with active lightPoly, with darkvision, or for GM
  assert.equal(
    isDoorVisibleToSeat(door, { role: 'player', dynamicLighting: true, visSources, ambient: 'day', lightPolys: [] }),
    true
  );
  assert.equal(
    isDoorVisibleToSeat(door, {
      role: 'player',
      dynamicLighting: true,
      visSources,
      ambient: 'darkness',
      lightPolys: [{ x: 650, y: 400, radiusPx: 120, poly: roomPoly }]
    }),
    true
  );
  assert.equal(
    isDoorVisibleToSeat(door, {
      role: 'player',
      dynamicLighting: true,
      visSources: [{ ...visSources[0], darkvisionRadiusPx: 320 }],
      ambient: 'darkness',
      lightPolys: []
    }),
    true
  );
  assert.equal(
    isDoorVisibleToSeat(door, { role: 'gm', dynamicLighting: true, visSources, ambient: 'darkness', lightPolys: [] }),
    true
  );

  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /plan\.ambientId === 'darkness'[\s\S]*?getFogBaseCanvas/);
  assert.match(canvasSrc, /isDoorVisibleToSeat\([\s\S]*?ambient:\s*ambientId,\s*lightPolys/);
});

test('S8-RED: clipSegmentToRect prevents diagonal light cuts near long walls, and darkness hides explored-but-unlit doors', () => {
  const clipped = clipSegmentToRect(400, 0, 400, 1600, 60, 480, 700, 1120);
  assert.deepEqual(clipped, { x1: 400, y1: 480, x2: 400, y2: 1120 });
  assert.equal(clipSegmentToRect(10, 0, 10, 1600, 60, 480, 700, 1120), null);

  const longWall = { id: 'w-long', kind: 'wall', x1: 400, y1: 0, x2: 400, y2: 1600 };
  const poly = Selector.computeVisibilityPolygon({ x: 380, y: 800 }, 320, [longWall]);
  assert.equal(Selector.isPointInPolygon({ x: 390, y: 600 }, poly), true, 'Open side near long wall must not be cut diagonally');
  assert.equal(Selector.isPointInPolygon({ x: 420, y: 800 }, poly), false, 'Blocked side behind wall must stay hidden');

  const door = { id: 'd-1', kind: 'door', x1: 660, y1: 360, x2: 660, y2: 440, open: false };
  const roomPoly = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 800 },
    { x: 0, y: 800 }
  ];
  const visSources = [{ token: { id: 'a1', x: 400, y: 400 }, radius: 2900, clearRadiusPx: 80, darkvisionRadiusPx: 0, poly: roomPoly }];
  assert.equal(
    isDoorVisibleToSeat(door, { role: 'player', dynamicLighting: true, visSources, ambient: 'darkness', lightPolys: [], isExploredFn: () => true }),
    false
  );
  assert.equal(
    isDoorVisibleToSeat(door, { role: 'player', dynamicLighting: true, visSources, ambient: 'day', lightPolys: [], isExploredFn: () => true }),
    true
  );
});

test('S9-RED: Night restricts enemy detection to 12m, darkvision, or lit pools and resolves directional ambient shadows', () => {
  assert.equal(NIGHT_DETECTION_METERS, 12);
  const dayVec = resolveAmbientShadowVector('day');
  const nightVec = resolveAmbientShadowVector('night');
  const darkVec = resolveAmbientShadowVector('darkness');
  assert.ok(Math.hypot(dayVec.x, dayVec.y) > Math.hypot(darkVec.x, darkVec.y));
  assert.ok(Math.hypot(nightVec.x, nightVec.y) > Math.hypot(darkVec.x, darkVec.y));

  const state = createInitialState();
  state.role = 'player';
  state.activeInviteId = 'inv-1';
  state.dynamicLighting = true;
  state.sceneAmbientLight = 'night';
  state.grid = { type: 'square', cellSize: 80, metersPerUnit: 1.5 }; // 12m = 640px
  state.walls = [];
  state.mapLights = [];
  state.playerInvites = [{ id: 'inv-1', tokenIds: ['ally-1'] }];

  const ally = { id: 'ally-1', isAlly: true, x: 400, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false };
  const nearEnemy = { id: 'enemy-near', isAlly: false, x: 920, y: 400, hidden: false }; // 520px (~9.75m <= 12m)
  const farEnemy = { id: 'enemy-far', isAlly: false, x: 1200, y: 400, hidden: false }; // 800px (15m > 12m)
  state.tokens = [ally, nearEnemy, farEnemy];

  // Night without darkvision/light: nearEnemy (<=12m) visible, farEnemy (>12m) hidden in shadows
  assert.deepEqual(Selector.getVisibleTokensForSeat(state, 'inv-1').map((t) => t.id), ['ally-1', 'enemy-near']);

  // Giving ally 18m darkvision reveals farEnemy (15m <= 18m)
  ally.darkvisionMeters = 18;
  assert.deepEqual(Selector.getVisibleTokensForSeat(state, 'inv-1').map((t) => t.id), ['ally-1', 'enemy-near', 'enemy-far']);
  ally.darkvisionMeters = 0;

  // Placing an active mapLight near farEnemy reveals farEnemy
  state.mapLights = [{ id: 'ml-night', sceneKey: state.activeMapKey, x: 1220, y: 400, radiusMeters: 4, tone: 'warm', enabled: true, flicker: true }];
  assert.deepEqual(Selector.getVisibleTokensForSeat(state, 'inv-1').map((t) => t.id), ['ally-1', 'enemy-near', 'enemy-far']);
});

test('S10-RED: nightDetectionMeters is configurable (default 12m, clamped 0-60m) and replaces obsolete base vision UI', () => {
  assert.equal(DEFAULT_VISION_CONFIG.nightDetectionMeters, 12);
  assert.equal(normalizeVisionConfig({}).nightDetectionMeters, 12);
  assert.equal(normalizeVisionConfig({ nightDetectionMeters: 24 }).nightDetectionMeters, 24);
  assert.equal(normalizeVisionConfig({ nightDetectionMeters: -5 }).nightDetectionMeters, 0);
  assert.equal(normalizeVisionConfig({ nightDetectionMeters: 99 }).nightDetectionMeters, 60);

  const state = createInitialState();
  state.role = 'player';
  state.activeInviteId = 'inv-1';
  state.dynamicLighting = true;
  state.sceneAmbientLight = 'night';
  state.grid = { type: 'square', cellSize: 80, metersPerUnit: 1.5 }; // 1m = 53.33px
  state.walls = [];
  state.mapLights = [];
  state.playerInvites = [{ id: 'inv-1', tokenIds: ['ally-1'] }];

  const ally = { id: 'ally-1', isAlly: true, x: 400, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false };
  const enemy4m = { id: 'enemy-4m', isAlly: false, x: 613, y: 400, hidden: false }; // ~4m
  const enemy9m = { id: 'enemy-9m', isAlly: false, x: 880, y: 400, hidden: false }; // 9m
  const enemy15m = { id: 'enemy-15m', isAlly: false, x: 1200, y: 400, hidden: false }; // 15m
  state.tokens = [ally, enemy4m, enemy9m, enemy15m];

  state.systemConfig.vision.nightDetectionMeters = 6;
  assert.deepEqual(Selector.getVisibleTokensForSeat(state, 'inv-1').map((t) => t.id), ['ally-1', 'enemy-4m']);

  state.systemConfig.vision.nightDetectionMeters = 20;
  assert.deepEqual(
    Selector.getVisibleTokensForSeat(state, 'inv-1').map((t) => t.id),
    ['ally-1', 'enemy-4m', 'enemy-9m', 'enemy-15m']
  );

  state.systemConfig.vision.nightDetectionMeters = 0;
  assert.deepEqual(Selector.getVisibleTokensForSeat(state, 'inv-1').map((t) => t.id), ['ally-1']);

  const sysOptSrc = fs.readFileSync(path.resolve('js/ui/systemOptionsView.js'), 'utf8');
  assert.doesNotMatch(sysOptSrc, /Visión base de protagonistas/);
  assert.doesNotMatch(sysOptSrc, /rngSysDefaultVision/);
  assert.doesNotMatch(sysOptSrc, /Luces portátiles/);
  assert.doesNotMatch(sysOptSrc, /inpSysTorchDist/);
  assert.doesNotMatch(sysOptSrc, /inpSysLanternDist/);
  assert.match(sysOptSrc, /Detección en modo Noche/);
  assert.match(sysOptSrc, /rngSysNightDetection/);
});

test('S11-RED: darkness unlit self-aura scales to occupied grid cells (occupiedHalfPx + 0.5*cellSize) so 3x3/4x4 token borders stay crisp', () => {
  const state = createInitialState();
  state.role = 'player';
  state.dynamicLighting = true;
  state.sceneAmbientLight = 'darkness';
  state.grid = { type: 'square', cellSize: 80, metersPerUnit: 1.5 };
  state.walls = [];
  state.mapLights = [];
  state.tokens = [
    { id: 't1', isAlly: true, size: 1, x: 400, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false },
    { id: 't2', isAlly: true, size: 2, x: 800, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false },
    { id: 't4', isAlly: true, size: 4, x: 1200, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false },
    { id: 't4-blind', isAlly: true, size: 4, x: 1600, y: 400, visionMeters: 0, lightMeters: 0, darkvisionMeters: 0, hidden: false },
    { id: 't4-lantern', isAlly: true, size: 4, x: 2000, y: 400, lightMeters: 12, darkvisionMeters: 0, hidden: false }
  ];

  const polys = Selector.getAlliedVisibilityPolygons(state);
  const byId = new Map(polys.map((p) => [p.token.id, p]));

  assert.equal(byId.get('t1')?.occupiedHalfPx, 40);
  assert.equal(byId.get('t1')?.clearRadiusPx, 80);

  assert.equal(byId.get('t2')?.occupiedHalfPx, 80);
  assert.equal(byId.get('t2')?.clearRadiusPx, 120);

  assert.equal(byId.get('t4')?.occupiedHalfPx, 160);
  assert.equal(byId.get('t4')?.clearRadiusPx, 200);

  assert.equal(byId.get('t4-blind'), undefined);
  assert.equal(byId.get('t4-lantern')?.lightRadiusPx, 800);
  assert.equal(byId.get('t4-lantern')?.clearRadiusPx, 800);

  const t4Dv = { id: 't4-dv', isAlly: true, size: 4, x: 400, y: 400, lightMeters: 0, darkvisionMeters: 6, hidden: false };
  state.tokens = [t4Dv, { id: 't4-lantern', isAlly: true, size: 4, x: 2000, y: 400, lightMeters: 12, darkvisionMeters: 0, hidden: false }];
  const dvPolys = Selector.getAlliedVisibilityPolygons(state);
  assert.equal(dvPolys.find((p) => p.token.id === 't4-dv')?.darkvisionRadiusPx, 480);

  const activeLights = Selector.getActiveLightPolygons(state);
  const lanternLight = activeLights.find((lp) => lp.id === 't4-lantern');
  assert.equal(lanternLight?.occupiedHalfPx, 160);
  assert.equal(lanternLight?.radiusPx, 800);

  // Night detection from occupied edge: 6m (320px) + edge
  state.sceneAmbientLight = 'night';
  state.systemConfig.vision.nightDetectionMeters = 6;
  const enemy = { id: 'e-edge', isAlly: false, x: 840, y: 400, hidden: false }; // 440px from center
  state.tokens = [{ id: 'a1', isAlly: true, size: 1, x: 400, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false }, enemy];
  assert.deepEqual(Selector.getVisibleTokensForSeat(state).map((t) => t.id), ['a1']);

  state.tokens = [{ id: 'a4', isAlly: true, size: 4, x: 400, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false }, enemy];
  assert.deepEqual(Selector.getVisibleTokensForSeat(state).map((t) => t.id), ['a4', 'e-edge']);

  state.systemConfig.vision.nightDetectionMeters = 0;
  assert.deepEqual(Selector.getVisibleTokensForSeat(state).map((t) => t.id), ['a4']);

  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /punchRadial\([\s\S]{0,120}src\.clearRadiusPx[\s\S]{0,80}src\.occupiedHalfPx/);
  assert.match(canvasSrc, /effR\s*=\s*Math\.max\(10,\s*lp\.radiusPx[\s\S]{0,200}punchRadial\([\s\S]{0,120}effR[\s\S]{0,60}lp\.occupiedHalfPx/);
  assert.match(canvasSrc, /punchRadial\([\s\S]{0,160}src\.darkvisionRadiusPx[\s\S]{0,120}src\.occupiedHalfPx/);
});

test('S12-RED: canvasView softens fog-of-war, explored mask, and dynamic light shadow edges with 0.5x soft mask blur', () => {
  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /getSoftMaskCanvas\s*\(\)/);
  assert.match(canvasSrc, /width\s*=\s*1200[\s\S]{0,40}height\s*=\s*800/);
  assert.match(canvasSrc, /fillTarget\.filter\s*=\s*['"]blur\(/);
  assert.match(canvasSrc, /fogTarget\.filter\s*=\s*['"]blur\(/);
});

test('S13-RED: unlit darkness aura uses dim night-like alpha, and protagonist darkvision/light updates persist across sceneLayers, P2P player patches, and templates', async () => {
  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /src\.lightRadiusPx\s*>\s*0\s*\?\s*1\s*:\s*0\.38/);

  const state = createInitialState();
  state.role = 'gm';
  state.isHostGm = true;
  state.tokens = [
    { id: 'tok-1', name: 'Hero', isAlly: true, x: 440, y: 440, hp: 20, maxHp: 20, ac: 14, size: 1, inventory: [] }
  ];
  const tok = state.tokens[0];
  tok.darkvisionMeters = 30;
  tok.darkvision = true;
  tok.lightMeters = 12;
  state.sceneLayers = {
    'other-map': {
      tokens: [{ ...JSON.parse(JSON.stringify(tok)), darkvisionMeters: 30, darkvision: true, lightMeters: 12 }],
      walls: [],
      strokes: []
    }
  };
  Service.state = state;

  // Setting darkvisionMeters to 0 propagates to other maps in sceneLayers so reload/map-change never resurrects 30
  Service.setTokenDarkvisionMeters(tok.id, 0);
  assert.equal(tok.darkvisionMeters, 0);
  assert.equal(tok.darkvision, false);
  assert.equal(state.sceneLayers['other-map'].tokens[0].darkvisionMeters, 0);
  assert.equal(state.sceneLayers['other-map'].tokens[0].darkvision, false);

  Service.setTokenLight(tok.id, 0);
  assert.equal(tok.lightMeters, 0);
  assert.equal(state.sceneLayers['other-map'].tokens[0].lightMeters, 0);

  // P2P player update preserves darkvisionMeters and propagates to sceneLayers
  state.playerInvites = [{ id: 'inv-1', tokenIds: [tok.id] }];
  const applied = Service.applyPlayerTokensSync({
    seatKey: 'inv-1',
    tokens: [{ id: tok.id, darkvisionMeters: 18, lightMeters: 6 }]
  });
  assert.equal(applied, true);
  assert.equal(tok.darkvisionMeters, 18);
  assert.equal(tok.darkvision, true);
  assert.equal(tok.lightMeters, 6);
  assert.equal(state.sceneLayers['other-map'].tokens[0].darkvisionMeters, 18);
  assert.equal(state.sceneLayers['other-map'].tokens[0].lightMeters, 6);

  // Baul template save + spawn preserves darkvisionMeters
  const savedActor = Service.saveCustomActor({
    key: 'custom-dv',
    name: 'Elfa',
    isAlly: true,
    darkvisionMeters: 18
  });
  assert.equal(savedActor.darkvisionMeters, 18);
  assert.equal(savedActor.darkvision, true);
  const spawned = await Service.spawnActorFromTemplate(savedActor, 500, 500);
  assert.equal(spawned.darkvisionMeters, 18);
  assert.equal(spawned.darkvision, true);
});

test('S14-RED: night mode computes nightDetectRadiusPx from occupied edge and canvasView renders soft moonlit halo', () => {
  const state = createInitialState();
  state.role = 'player';
  state.dynamicLighting = true;
  state.sceneAmbientLight = 'night';
  state.grid = { type: 'square', cellSize: 80, metersPerUnit: 1.5 };
  state.systemConfig.vision.nightDetectionMeters = 12; // 640px
  state.walls = [];
  state.tokens = [
    { id: 'n1', isAlly: true, size: 1, x: 400, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false },
    { id: 'n4', isAlly: true, size: 4, x: 1000, y: 400, lightMeters: 0, darkvisionMeters: 0, hidden: false }
  ];

  const polysNight = Selector.getAlliedVisibilityPolygons(state);
  assert.equal(polysNight.find((p) => p.token.id === 'n1')?.nightDetectRadiusPx, 680);
  assert.equal(polysNight.find((p) => p.token.id === 'n4')?.nightDetectRadiusPx, 800);

  state.systemConfig.vision.nightDetectionMeters = 0;
  const polysZero = Selector.getAlliedVisibilityPolygons(state);
  assert.equal(polysZero.find((p) => p.token.id === 'n4')?.nightDetectRadiusPx, 200);

  state.sceneAmbientLight = 'day';
  const polysDay = Selector.getAlliedVisibilityPolygons(state);
  assert.equal(polysDay.find((p) => p.token.id === 'n1')?.nightDetectRadiusPx, 0);

  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /src\.nightDetectRadiusPx/);
  assert.match(canvasSrc, /plan\.ambientId === 'night' \|\| plan\.ambientId === 'darkness'/);
  assert.match(canvasSrc, /rgba\(165,\s*196,\s*245,\s*0\.09\)/);
});

test('S15-RED: map lights support 5 tones with hotspotRgba, 4 animations (steady/flame/pulse/faulty), and selector propagation', () => {
  assert.deepEqual(MAP_LIGHT_TONES, ['warm', 'neutral', 'cool', 'magic', 'danger']);
  assert.deepEqual(MAP_LIGHT_ANIMATIONS, ['steady', 'flame', 'pulse', 'faulty']);
  for (const t of MAP_LIGHT_TONES) {
    assert.ok(MAP_LIGHT_TONE_META[t]?.hotspotRgba, `Tone ${t} must define hotspotRgba`);
  }

  assert.equal(normalizeMapLightAnimation('flame'), 'flame');
  assert.equal(normalizeMapLightAnimation('invalid'), 'steady');

  const lFlame = normalizeMapLight({ id: 'l1', animation: 'flame', tone: 'danger' }, 'bastion');
  assert.equal(lFlame.animation, 'flame');
  assert.equal(lFlame.tone, 'danger');
  assert.equal(lFlame.flicker, true);

  const lSteady = normalizeMapLight({ id: 'l2', flicker: false }, 'bastion');
  assert.equal(lSteady.animation, 'steady');

  // Steady returns exact 1,1,1,0,0
  assert.deepEqual(computeLightAnimationSample('steady', 1234, 7), {
    radiusScale: 1,
    alphaScale: 1,
    coreScale: 1,
    coreOffsetX: 0,
    coreOffsetY: 0
  });

  // Animated modes produce clearly perceptible bounded variations while keeping flame/pulse outer radius calm
  for (const anim of ['flame', 'pulse', 'faulty']) {
    const samples = [];
    for (let t = 0; t <= 3200; t += 100) {
      const s = computeLightAnimationSample(anim, t, 3);
      assert.ok(Number.isFinite(s.radiusScale) && s.radiusScale >= 0.7 && s.radiusScale <= 1.25);
      if (anim === 'flame') {
        assert.ok(s.radiusScale >= 0.97 && s.radiusScale <= 1.03, `flame radiusScale must stay calm, got ${s.radiusScale}`);
      }
      assert.ok(Number.isFinite(s.alphaScale) && s.alphaScale >= 0.15 && s.alphaScale <= 1.25);
      assert.ok(Number.isFinite(s.coreScale) && s.coreScale >= 0.15 && s.coreScale <= 1.35);
      samples.push(s.alphaScale);
    }
    const span = Math.max(...samples) - Math.min(...samples);
    assert.ok(span >= 0.2, `${anim} must produce perceptible alpha span (>= 0.20), got ${span}`);
  }

  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /fromAnimLoop/);
  assert.match(canvasSrc, /isDraggingToken[\s\S]{0,80}activeDragTokenId/);
  assert.doesNotMatch(canvasSrc, /_syncLightAnimationLoop[\s\S]{0,400}prefers-reduced-motion/);

  // Selector propagates animation to active light polygons
  const st = createInitialState();
  st.activeMapKey = 'bastion';
  st.mapLights = [{ id: 'ml-a', sceneKey: 'bastion', x: 200, y: 200, radiusMeters: 9, tone: 'neutral', animation: 'pulse', enabled: true }];
  const polys = Selector.getActiveLightPolygons(st);
  assert.equal(polys.length, 1);
  assert.equal(polys[0].animation, 'pulse');
  assert.equal(polys[0].tone, 'neutral');
});

test('S16-RED: canvasView caches static fog/darkness layers, uses 0.5x ambient light buffer, and throttles animation to ~16 FPS with hidden-tab pause', () => {
  const canvasSrc = fs.readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /getStaticFogCanvas\s*\(/);
  assert.match(canvasSrc, /getStaticDarknessCanvas\s*\(/);
  assert.match(canvasSrc, /getAmbientLightCanvas[\s\S]{0,260}width\s*=\s*1200[\s\S]{0,40}height\s*=\s*800/);
  assert.match(canvasSrc, /document\.hidden/);
  assert.match(canvasSrc, /now\s*-\s*lastDraw\s*>=\s*62/);
});
