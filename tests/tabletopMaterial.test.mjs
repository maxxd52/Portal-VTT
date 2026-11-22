import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const {
  generateSurfaceGrainPixels,
  resolveGridBlendConfig,
  collectWallShadowSegments,
  buildWallShadowCacheKey,
  getLightingTemperaturePalette,
  computeActiveMapBounds
} = await import('../js/utils/tabletopMaterial.js?v=20261121a6');

test('S1: generateSurfaceGrainPixels produces deterministic, neutral-mean, seamless periodic grain', () => {
  const size = 64;
  const a = generateSurfaceGrainPixels(size);
  const b = generateSurfaceGrainPixels(size);

  assert.equal(a.length, size * size * 4);
  assert.deepEqual(a, b, 'Grain generation must be deterministic');

  let sum = 0;
  let minVal = 255;
  let maxVal = 0;
  const count = size * size;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i];
    const g = a[i + 1];
    const bCh = a[i + 2];
    const alpha = a[i + 3];
    assert.equal(r, g, 'Grain must be monochromatic (R === G)');
    assert.equal(g, bCh, 'Grain must be monochromatic (G === B)');
    assert.equal(alpha, 255, 'Every grain pixel must have full alpha for overlay blending');
    sum += r;
    if (r < minVal) minVal = r;
    if (r > maxVal) maxVal = r;
  }

  const mean = sum / count;
  assert.ok(mean >= 120 && mean <= 136, `Grain mean luminance must stay near neutral 128 (got ${mean.toFixed(2)})`);
  assert.ok(maxVal - minVal >= 20, 'Grain must have perceptible micro-texture variance');

  // Verify seamless wrap across horizontal and vertical tile borders
  let seamDiffH = 0;
  let seamDiffV = 0;
  for (let y = 0; y < size; y++) {
    seamDiffH += Math.abs(a[(y * size + 0) * 4] - a[(y * size + (size - 1)) * 4]);
  }
  for (let x = 0; x < size; x++) {
    seamDiffV += Math.abs(a[x * 4] - a[((size - 1) * size + x) * 4]);
  }
  assert.ok(seamDiffH / size <= 18, `Horizontal seam average delta should be smooth (got ${(seamDiffH / size).toFixed(2)})`);
  assert.ok(seamDiffV / size <= 18, `Vertical seam average delta should be smooth (got ${(seamDiffV / size).toFixed(2)})`);
});

test('S1: resolveGridBlendConfig adapts blend mode and dual-ink etching across auto/dark/light and themes', () => {
  const autoSlate = resolveGridBlendConfig({ color: 'auto', opacity: 0.28 }, 'slate');
  assert.equal(autoSlate.mixBlendMode, 'overlay');
  assert.equal(autoSlate.dualInk, true);
  assert.ok(autoSlate.darkStroke.startsWith('rgba('));
  assert.ok(autoSlate.lightStroke.startsWith('rgba('));

  const autoParchment = resolveGridBlendConfig({ color: 'auto', opacity: 0.28 }, 'parchment');
  assert.equal(autoParchment.mixBlendMode, 'soft-light');
  assert.equal(autoParchment.dualInk, true);

  const explicitDark = resolveGridBlendConfig({ color: 'dark', opacity: 0.4 }, 'slate');
  assert.equal(explicitDark.mixBlendMode, 'multiply');
  assert.equal(explicitDark.dualInk, false);

  const explicitLight = resolveGridBlendConfig({ color: 'light', opacity: 0.4 }, 'slate');
  assert.equal(explicitLight.mixBlendMode, 'screen');
  assert.equal(explicitLight.dualInk, false);
});

test('S1: index.html and styles.css define physical board surface, desk backdrop, and unified grain layer', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

  assert.match(html, /id="boardGrainLayer"/, 'index.html must include #boardGrainLayer inside #worldTransformLayer');
  assert.match(css, /--desk-bg-base:/, 'styles.css must define physical desk backdrop tokens');
  assert.match(css, /--board-slab-side:/, 'styles.css must define physical board edge/thickness tokens');
  assert.match(css, /#worldTransformLayer::after/, 'styles.css must render board bevel highlight/shadow via ::after without clipping tokens');
  assert.match(css, /#boardGrainLayer/, 'styles.css must style #boardGrainLayer');
});

test('S2: collectWallShadowSegments includes solid walls and closed doors while omitting open doors and degenerate segments', () => {
  const segments = collectWallShadowSegments([
    { id: 'w1', x1: 100, y1: 100, x2: 300, y2: 100, kind: 'wall' },
    { id: 'd1', x1: 300, y1: 100, x2: 380, y2: 100, kind: 'door', open: false },
    { id: 'd2', x1: 380, y1: 100, x2: 460, y2: 100, kind: 'door', open: true },
    { id: 'deg', x1: 50, y1: 50, x2: 50.2, y2: 50.1, kind: 'wall' },
    { id: 'bad', x1: NaN, y1: 0, x2: 100, y2: 100, kind: 'wall' }
  ]);

  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], { x1: 100, y1: 100, x2: 300, y2: 100, isDoor: false });
  assert.deepEqual(segments[1], { x1: 300, y1: 100, x2: 380, y2: 100, isDoor: true });

  const keyA = buildWallShadowCacheKey([{ x1: 0, y1: 0, x2: 100, y2: 0, kind: 'door', open: false }], { x: -0.28, y: 0.36 }, true);
  const keyB = buildWallShadowCacheKey([{ x1: 0, y1: 0, x2: 100, y2: 0, kind: 'door', open: true }], { x: -0.28, y: 0.36 }, true);
  const keyOff = buildWallShadowCacheKey([{ x1: 0, y1: 0, x2: 100, y2: 0, kind: 'door', open: false }], { x: -0.28, y: 0.36 }, false);
  assert.notEqual(keyA, keyB, 'Opening a door must invalidate wall shadow cache');
  assert.notEqual(keyA, keyOff, 'Disabling dynamic shadows must invalidate wall shadow cache');
});

test('S2: getLightingTemperaturePalette provides cool nocturnal penumbra and warm torchlight stops', () => {
  const darkPal = getLightingTemperaturePalette('slate');
  const lightPal = getLightingTemperaturePalette('parchment');

  assert.ok(darkPal.coolRgb.b > darkPal.coolRgb.r, 'Penumbra tint must be cool blue-dominant');
  assert.ok(darkPal.warmCoreRgb.r > darkPal.warmCoreRgb.b, 'Light core must be warm red/amber-dominant');
  assert.ok(darkPal.coolGlazeAlpha > 0 && darkPal.coolGlazeAlpha <= 0.35);
  assert.ok(Array.isArray(darkPal.warmStops) && darkPal.warmStops.length >= 4);
  assert.equal(darkPal.warmStops[0].offset, 0);
  assert.equal(darkPal.warmStops.at(-1).offset, 1);
  assert.ok(lightPal.coolGlazeAlpha <= darkPal.coolGlazeAlpha, 'Light theme penumbra should stay gentler than dark theme');
});

test('S2: wall contact shadow canvas stays strictly underneath fogCanvas and dynamicLighting prevents unclipped DOM light bleed', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
  const canvasSrc = fs.readFileSync(path.join(root, 'js', 'ui', 'canvasView.js'), 'utf8');
  const boardSrc = fs.readFileSync(path.join(root, 'js', 'ui', 'boardView.js'), 'utf8');

  const wallIdx = html.indexOf('id="wallShadowCanvas"');
  const fogIdx = html.indexOf('id="fogCanvas"');
  assert.ok(wallIdx > 0 && fogIdx > wallIdx, '#wallShadowCanvas must appear before #fogCanvas in DOM order');

  const wallZ = Number(css.match(/#wallShadowCanvas\s*\{[^}]*z-index:\s*(\d+)/)?.[1]);
  const fogZ = Number(css.match(/#fogCanvas\s*\{[^}]*z-index:\s*(\d+)/)?.[1]);
  assert.ok(Number.isFinite(wallZ) && Number.isFinite(fogZ) && wallZ < fogZ, `#wallShadowCanvas z-index (${wallZ}) must stay below #fogCanvas (${fogZ}) for zero-leak fog`);

  assert.match(canvasSrc, /drawWallShadowCanvas\(/, 'canvasView.js must implement drawWallShadowCanvas');
  assert.match(canvasSrc, /source-atop/, 'canvasView.js must apply cool penumbra glaze via source-atop to preserve 100% opaque player fog');
  assert.match(boardSrc, /!state\.dynamicLighting\s*&&\s*lightPx\s*>\s*0|lightPx\s*>\s*0\s*&&\s*!state\.dynamicLighting/, 'boardView.js must avoid unclipped DOM light halo when dynamicLighting is active');
});

test('S3: computeActiveMapBounds fits square, portrait, ultrawide, and fallback maps cleanly inside 2400x1600 without letterbox overflow', () => {
  // Preset / unloaded fallback uses full 2400x1600
  assert.deepEqual(computeActiveMapBounds(0, 0), { x: 0, y: 0, width: 2400, height: 1600 });
  assert.deepEqual(computeActiveMapBounds(null, undefined), { x: 0, y: 0, width: 2400, height: 1600 });

  // Exact 3:2 map fills full board
  assert.deepEqual(computeActiveMapBounds(3000, 2000), { x: 0, y: 0, width: 2400, height: 1600 });

  // Square 1:1 map centers horizontally at 1600x1600 (x=400)
  assert.deepEqual(computeActiveMapBounds(1024, 1024), { x: 400, y: 0, width: 1600, height: 1600 });

  // Tall portrait 1:2 map centers horizontally at 800x1600 (x=800)
  assert.deepEqual(computeActiveMapBounds(1000, 2000), { x: 800, y: 0, width: 800, height: 1600 });

  // Ultrawide 3:1 map centers vertically at 2400x800 (y=400)
  assert.deepEqual(computeActiveMapBounds(3000, 1000), { x: 0, y: 400, width: 2400, height: 800 });

  // CSS and canvasView bind --map-x/--map-y/--map-w/--map-h and clip layers to active bounds
  const root = path.resolve(import.meta.dirname, '..');
  const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
  const canvasSrc = fs.readFileSync(path.join(root, 'js', 'ui', 'canvasView.js'), 'utf8');
  assert.match(css, /#worldTransformLayer::before/, 'styles.css must draw physical board slab shadow on ::before sized to --map-w/--map-h');
  assert.match(css, /--map-x:\s*0px/, 'styles.css must define default --map-x variable on #worldTransformLayer');
  assert.match(canvasSrc, /syncBoardBoundsToDom\(/, 'canvasView.js must sync active map bounds to DOM');
  assert.match(canvasSrc, /clipToActiveMapBounds\(/, 'canvasView.js must clip grid, wall shadows, and fog to active map bounds');
});
