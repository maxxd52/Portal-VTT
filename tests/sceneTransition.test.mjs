import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

if (!globalThis.window) {
  globalThis.window = { location: { search: '' }, innerWidth: 1280, innerHeight: 720 };
}

const { Service } = await import('../js/core/service.js?v=20261125a1');
const {
  buildSceneTransitionSignature,
  resolveSceneTransitionMeta,
  computeTransitionTimings
} = await import('../js/utils/sceneTransitionModel.js?v=20261125a1');

test('buildSceneTransitionSignature changes only on scene identity or mode changes', () => {
  const base = {
    activeMapKey: 'bastion',
    mapId: 'bastion',
    sceneMode: 'tactical',
    customMapUrl: '',
    tokens: [{ id: 't1', x: 100, y: 100 }],
    camera: { x: 0, y: 0, zoom: 1 },
    sceneWeather: 'none',
    grid: { cellSize: 80 }
  };

  const sigBase = buildSceneTransitionSignature(base);
  const sigMoved = buildSceneTransitionSignature({
    ...base,
    tokens: [{ id: 't1', x: 320, y: 240 }],
    camera: { x: -200, y: -100, zoom: 2.5 },
    sceneWeather: 'rain',
    grid: { cellSize: 32 }
  });
  assert.equal(sigMoved, sigBase, 'Token, camera, weather, or grid changes must not re-trigger scene transition');

  assert.notEqual(buildSceneTransitionSignature({ ...base, activeMapKey: 'crypt', mapId: 'crypt' }), sigBase);
  assert.notEqual(buildSceneTransitionSignature({ ...base, sceneMode: 'narrative' }), sigBase);
  assert.notEqual(buildSceneTransitionSignature({ ...base, mapId: 'custom', customMapUrl: 'data:image/webp;base64,AAA' }), sigBase);
});

test('resolveSceneTransitionMeta resolves custom, preset, and fallback scenario titles', () => {
  const presets = [
    { key: 'bastion', name: 'Bastión Subterráneo' },
    { key: 'tavern', name: 'Posada del Cuervo' }
  ];

  const customMeta = resolveSceneTransitionMeta({
    activeMapKey: 'cmap_1',
    mapId: 'custom',
    sceneMode: 'narrative',
    customMaps: [{ key: 'cmap_1', name: 'Puerto de la Bruma', sceneMode: 'narrative' }],
    room: { moduleTitle: 'Campaña' }
  }, presets);
  assert.equal(customMeta.title, 'Puerto de la Bruma');
  assert.equal(customMeta.subtitle, 'Escena narrativa');

  const presetMeta = resolveSceneTransitionMeta({
    activeMapKey: 'tavern',
    mapId: 'tavern',
    sceneMode: 'tactical',
    customMaps: [],
    room: { moduleTitle: 'Campaña' }
  }, presets);
  assert.equal(presetMeta.title, 'Posada del Cuervo');
  assert.equal(presetMeta.subtitle, 'Escenario táctico');

  const fallbackMeta = resolveSceneTransitionMeta({
    activeMapKey: 'unknown',
    mapId: 'unknown',
    sceneMode: 'tactical',
    customMaps: [],
    room: { moduleTitle: 'Aventura_Bastion' }
  }, presets);
  assert.equal(fallbackMeta.title, 'Aventura_Bastion');
  assert.equal(fallbackMeta.subtitle, 'Escenario táctico');
});

test('computeTransitionTimings provides gradual shadow darkening & reading cadence even under reducedMotion', () => {
  const normal = computeTransitionTimings({ reducedMotion: false, isInitialLoad: false });
  assert.ok(normal.fadeInMs >= 400);
  assert.ok(normal.minHoldMs >= 500);
  assert.ok(normal.decodeTimeoutMs >= 900);
  assert.ok(normal.backdropFadeOutMs >= 600);
  assert.ok(normal.titleLingerMs >= 800);
  assert.ok(normal.titleFadeOutMs >= 500);

  const initial = computeTransitionTimings({ reducedMotion: false, isInitialLoad: true });
  assert.ok(initial.minHoldMs >= 500);
  assert.ok(initial.decodeTimeoutMs >= normal.decodeTimeoutMs);

  const reduced = computeTransitionTimings({ reducedMotion: true, isInitialLoad: false });
  assert.ok(reduced.fadeInMs >= 360);
  assert.ok(reduced.minHoldMs >= 400);
  assert.ok(reduced.backdropFadeOutMs >= 500);
  assert.ok(reduced.titleLingerMs >= 600);
  assert.ok(reduced.titleFadeOutMs >= 450);
  assert.ok(reduced.decodeTimeoutMs > 0);
});

test('Service.changeMap skips onBeforeSceneChange when re-activating the same active scene', async () => {
  const prevHook = Service.onBeforeSceneChange;
  let calls = 0;
  Service.onBeforeSceneChange = async () => {
    calls += 1;
  };
  try {
    Service.state.mapId = 'bastion';
    Service.state.activeMapKey = 'bastion';
    Service.state.customMapUrl = '';
    await Service.changeMap('bastion', '', 'bastion');
    assert.equal(calls, 0, 'Same-scene changeMap must not trigger pre-darken hook');

    await Service.changeMap('tavern', '', 'tavern');
    assert.equal(calls, 1, 'Switching to a different scene must trigger pre-darken hook');
  } finally {
    Service.onBeforeSceneChange = prevHook;
  }
});

test('styles.css preserves curtain transitions under prefers-reduced-motion and sets mask-repeat: no-repeat', () => {
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');

  const innerBlockMatch = css.match(/\.portal-scene-curtain-inner\s*\{[\s\S]*?\}/);
  assert.ok(innerBlockMatch, '.portal-scene-curtain-inner block must exist');
  assert.match(innerBlockMatch[0], /-webkit-mask-repeat:\s*no-repeat;/);
  assert.match(innerBlockMatch[0], /mask-repeat:\s*no-repeat;/);

  const globalReducedBlockMatch = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?0\.01ms\s*!important[\s\S]*?\}\s*\}/);
  assert.ok(globalReducedBlockMatch, 'Global prefers-reduced-motion block must exist');
  assert.doesNotMatch(
    globalReducedBlockMatch[0],
    /^\s*\*,\s*\r?\n\s*\*::before/m,
    'Global reduced-motion rule must not use unguarded *, *::before selector'
  );
  assert.match(
    globalReducedBlockMatch[0],
    /\*:not\(\.portal-scene-curtain-backdrop\):not\(\.portal-scene-curtain-inner\)/
  );
});

test('S1-OPT: Service.changeMap passes customMapUrl to onBeforeSceneChange for staggered fadeIn pre-decode', async () => {
  const prevHook = Service.onBeforeSceneChange;
  const previews = [];
  Service.onBeforeSceneChange = async (preview) => {
    previews.push(preview);
  };
  try {
    Service.state.mapId = 'bastion';
    Service.state.activeMapKey = 'bastion';
    Service.state.customMapUrl = '';

    await Service.changeMap('custom', 'data:image/webp;base64,AAA', 'cmap-1');
    assert.equal(previews.length, 1);
    assert.equal(previews[0].customMapUrl, 'data:image/webp;base64,AAA');

    await Service.changeMap('tavern', '', 'tavern');
    assert.equal(previews.length, 2);
    assert.equal(previews[1].customMapUrl, '');
  } finally {
    Service.onBeforeSceneChange = prevHook;
  }
});

test('S1-OPT: canvasView prewarmActiveScene caps token decode at 16, awaits exploredMask, pre-simulates weather, and view.js avoids duplicate redraws on scene transitions', () => {
  const canvasSrc = readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  const viewSrc = readFileSync(path.resolve('js/core/view.js'), 'utf8');

  assert.match(canvasSrc, /uniqueTokenUrls\.length >= 16/);
  assert.match(canvasSrc, /_exploredLoadPromise/);
  assert.match(canvasSrc, /prewarmSteps:\s*45/);
  assert.match(canvasSrc, /_prewarmMapDecodePromise/);
  assert.match(viewSrc, /const isSceneTransition\s*=/);
  assert.match(viewSrc, /if\s*\(isSceneTransition\)/);
});

test('S2-OPT-RED: initial reload snaps curtain opaque before drawMapCanvas without map->darken->lighten flash', () => {
  const cssSrc = readFileSync(path.resolve('css/styles.css'), 'utf8');
  const viewSrc = readFileSync(path.resolve('js/core/view.js'), 'utf8');
  const canvasSrc = readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');

  assert.match(cssSrc, /\.portal-scene-curtain\.is-backdrop-instant\s+\.portal-scene-curtain-backdrop[\s\S]*?transition:\s*none\s*!important/);
  const instantIdx = viewSrc.indexOf('is-backdrop-instant');
  const drawMapIdx = viewSrc.indexOf('this.drawMapCanvas(state)');
  assert.ok(instantIdx > 0 && drawMapIdx > instantIdx, 'view.js must snap curtain instant BEFORE drawMapCanvas');
  assert.match(canvasSrc, /if\s*\(isInitialLoad\)\s*\{[\s\S]*?is-backdrop-instant/);
});

test('S1-FIX-RED: index.html starts curtain opaque and initial load keeps is-backdrop-instant until fade-out', () => {
  const htmlSrc = readFileSync(path.resolve('index.html'), 'utf8');
  const canvasSrc = readFileSync(path.resolve('js/ui/canvasView.js'), 'utf8');
  const viewSrc = readFileSync(path.resolve('js/core/view.js'), 'utf8');
  const lobbySrc = readFileSync(path.resolve('js/ui/portalLobbyView.js'), 'utf8');
  const serviceSrc = readFileSync(path.resolve('js/core/service.js'), 'utf8');

  assert.match(
    htmlSrc,
    /<div\s+id="sceneTransitionCurtain"\s+class="[^"]*is-backdrop-instant[^"]*is-backdrop-visible[^"]*"/,
    'index.html must start #sceneTransitionCurtain opaque to prevent pre-JS map flash'
  );
  assert.doesNotMatch(
    canvasSrc,
    /if\s*\(isInitialLoad\)\s*\{[\s\S]{0,160}curtain\.classList\.remove\(['"]is-backdrop-instant['"]\)/,
    'triggerSceneTransition must NOT strip is-backdrop-instant before the hold completes'
  );
  assert.match(
    canvasSrc,
    /curtain\.classList\.contains\(['"]is-backdrop-instant['"]\)[\s\S]{0,200}curtain\.classList\.remove\(['"]is-backdrop-instant['"]\)[\s\S]{0,200}curtain\.classList\.remove\(['"]is-backdrop-visible['"]\)/,
    'triggerSceneTransition must strip is-backdrop-instant right before fade-out'
  );
  assert.match(viewSrc, /armInitialSceneCurtain\s*\(/);
  assert.match(viewSrc, /opts\.skipSceneTransition/);
  assert.match(lobbySrc, /armInitialSceneCurtain\?\.\(\)/);
  assert.match(serviceSrc, /refreshExternalMapFromSource[\s\S]*?skipSceneTransition:\s*true/);
});
