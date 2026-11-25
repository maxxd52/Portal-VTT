import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const {
  createWeatherSimulation,
  resolveWeatherFrameBudget
} = await import('../js/utils/weatherEngine.js?v=20261125a1');

test('OPT-2: graphicsProfileModel normalizes, migrates, detects auto tier, and resolves presets', async () => {
  const mod = await import('../js/utils/graphicsProfileModel.js?v=20261125a1');

  assert.equal(mod.normalizeGraphicsQuality('auto'), 'auto');
  assert.equal(mod.normalizeGraphicsQuality('high'), 'high');
  assert.equal(mod.normalizeGraphicsQuality('balanced'), 'balanced');
  assert.equal(mod.normalizeGraphicsQuality('low'), 'low');
  assert.equal(mod.normalizeGraphicsQuality('ultra'), 'auto');
  assert.equal(mod.normalizeGraphicsQuality(null), 'auto');

  assert.equal(mod.migrateLegacyShadowMode('off'), 'low');
  assert.equal(mod.migrateLegacyShadowMode('on'), 'high');
  assert.equal(mod.migrateLegacyShadowMode('auto'), 'auto');
  assert.equal(mod.migrateLegacyShadowMode('invalid'), 'auto');

  assert.equal(mod.detectAutoGraphicsTier({ deviceMemory: 2, hardwareConcurrency: 8, isCoarsePointer: false }), 'low');
  assert.equal(mod.detectAutoGraphicsTier({ deviceMemory: 8, hardwareConcurrency: 2, isCoarsePointer: false }), 'low');
  assert.equal(mod.detectAutoGraphicsTier({ deviceMemory: 8, hardwareConcurrency: 4, isCoarsePointer: true }), 'low');
  assert.equal(mod.detectAutoGraphicsTier({ deviceMemory: 4, hardwareConcurrency: 8, isCoarsePointer: false }), 'balanced');
  assert.equal(mod.detectAutoGraphicsTier({ deviceMemory: 8, hardwareConcurrency: 4, isCoarsePointer: false }), 'balanced');
  assert.equal(mod.detectAutoGraphicsTier({ deviceMemory: 8, hardwareConcurrency: 8, isCoarsePointer: true }), 'balanced');
  assert.equal(mod.detectAutoGraphicsTier({ deviceMemory: 8, hardwareConcurrency: 8, isCoarsePointer: false }), 'high');

  const high = mod.resolveGraphicsProfile('high', { deviceMemory: 2 });
  assert.deepEqual(high, {
    pref: 'high',
    tier: 'high',
    label: 'Alto',
    dynamicShadows: true,
    backdropBlur: 'full',
    weatherDensityScale: 1,
    weatherFpsScale: 1,
    lightAnimMinFrameMs: 62,
    diceMaxDpr: 2,
    diceShadows: true
  });

  const balanced = mod.resolveGraphicsProfile('balanced', { deviceMemory: 16 });
  assert.deepEqual(balanced, {
    pref: 'balanced',
    tier: 'balanced',
    label: 'Equilibrado',
    dynamicShadows: true,
    backdropBlur: 'reduced',
    weatherDensityScale: 0.65,
    weatherFpsScale: 0.8,
    lightAnimMinFrameMs: 84,
    diceMaxDpr: 1.5,
    diceShadows: true
  });

  const low = mod.resolveGraphicsProfile('low', { deviceMemory: 16 });
  assert.deepEqual(low, {
    pref: 'low',
    tier: 'low',
    label: 'Ligero',
    dynamicShadows: false,
    backdropBlur: 'none',
    weatherDensityScale: 0.35,
    weatherFpsScale: 0.6,
    lightAnimMinFrameMs: 125,
    diceMaxDpr: 1,
    diceShadows: false
  });
});

test('OPT-2: weatherEngine scales particle density and frame budget cleanly', () => {
  const fullRain = createWeatherSimulation({ weather: 'rain', mode: 'narrative', width: 1280, height: 800, densityScale: 1 });
  const lowRain = createWeatherSimulation({ weather: 'rain', mode: 'narrative', width: 1280, height: 800, densityScale: 0.35 });
  assert.ok(lowRain.particles.length > 0 && lowRain.particles.length < fullRain.particles.length);

  const fullBudget = resolveWeatherFrameBudget('mist', { fpsScale: 1 });
  const lowBudget = resolveWeatherFrameBudget('mist', { fpsScale: 0.6 });
  assert.ok(lowBudget.minFrameMs > fullBudget.minFrameMs);
  assert.ok(lowBudget.targetFps < fullBudget.targetFps);
});

test('OPT-2: index.html and styles.css wire graphicsQualitySeg and quality blur rules', () => {
  const html = fs.readFileSync(path.resolve(import.meta.dirname, '../index.html'), 'utf8');
  assert.match(html, /id="graphicsQualitySeg"/);
  assert.match(html, /data-graphics-quality="auto"/);
  assert.match(html, /data-graphics-quality="high"/);
  assert.match(html, /data-graphics-quality="balanced"/);
  assert.match(html, /data-graphics-quality="low"/);
  assert.match(html, /id="lblGraphicsQualityResolved"/);
  assert.doesNotMatch(html, /id="shadowModeSeg"/);

  const css = fs.readFileSync(path.resolve(import.meta.dirname, '../css/styles.css'), 'utf8');
  assert.match(css, /html\[data-graphics-quality="balanced"\]/);
  assert.match(css, /html\[data-graphics-quality="low"\]/);
});

test('OPT-4: styles.css scopes token will-change to active motion and extends quality blur rules to seat/map overlays', () => {
  const css = fs.readFileSync(path.resolve(import.meta.dirname, '../css/styles.css'), 'utf8');

  for (const selector of ['.vtt-token', '.vtt-token-cast-shadow', '.vtt-token-shadow', '.vtt-token-piece']) {
    const escaped = selector.replace('.', '\\.');
    const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
    assert.ok(match, `${selector} rule must exist`);
    assert.doesNotMatch(match[0], /will-change:/, `${selector} idle rule must not keep permanent will-change`);
  }

  assert.match(css, /\.vtt-token\.is-dragging[\s\S]*?will-change:\s*transform;/);
  assert.match(css, /\.vtt-token\.is-dragging\s*>\s*\.vtt-token-shadow[\s\S]*?will-change:\s*transform,\s*opacity;/);

  for (const overlay of ['.seat-chat-bubble', '.seat-roll-card', '.portal-map-active-pill', '.portal-map-mode-pill']) {
    assert.match(css, new RegExp(`html\\[data-graphics-quality="balanced"\\]\\s+${overlay.replace('.', '\\.')}`));
    assert.match(css, new RegExp(`html\\[data-graphics-quality="low"\\]\\s+${overlay.replace('.', '\\.')}`));
  }
});
