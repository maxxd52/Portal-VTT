import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  location: { search: '', origin: 'http://localhost', pathname: '/' }
};

const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { Selector } = await import('../js/core/selector.js?v=20261123a7');
const { Service } = await import('../js/core/service.js?v=20261123a7');
const { buildMapMenuSpec } = await import('../js/utils/contextMenuModel.js?v=20261123a7');
const {
  WEATHER_PRESETS,
  normalizeWeatherType,
  createWeatherSimulation,
  stepWeatherSimulation
} = await import('../js/utils/weatherEngine.js?v=20261123a7');

test('normalizeWeatherType accepts valid presets and falls back to none', () => {
  for (const w of WEATHER_PRESETS) {
    assert.equal(normalizeWeatherType(w), w);
  }
  assert.equal(normalizeWeatherType('tornado'), 'none');
  assert.equal(normalizeWeatherType(''), 'none');
  assert.equal(normalizeWeatherType(null), 'none');
});

test('createWeatherSimulation differentiates tactical (top-down) vs narrative (eye-level)', () => {
  const tacRain = createWeatherSimulation({ weather: 'rain', mode: 'tactical', width: 1280, height: 800 });
  const narRain = createWeatherSimulation({ weather: 'rain', mode: 'narrative', width: 1280, height: 800 });
  assert.ok(tacRain.particles.some((p) => p.kind === 'ripple'), 'tactical rain has ground ripples');
  assert.equal(narRain.particles.some((p) => p.kind === 'ripple'), false, 'narrative rain uses parallax streaks');

  const narEmbers = createWeatherSimulation({ weather: 'embers', mode: 'narrative', width: 1280, height: 800 });
  assert.ok(narEmbers.particles.length > 0);
  assert.ok(narEmbers.particles.every((p) => p.vy < 0), 'narrative embers rise upward');

  const tacEmbers = createWeatherSimulation({ weather: 'embers', mode: 'tactical', width: 1280, height: 800 });
  assert.ok(tacEmbers.particles.length > 0);

  for (const weather of ['snow', 'mist']) {
    for (const mode of ['tactical', 'narrative']) {
      const sim = createWeatherSimulation({ weather, mode, width: 1280, height: 800 });
      assert.ok(sim.particles.length > 0, `${weather}/${mode} has particles`);
    }
  }

  const noneSim = createWeatherSimulation({ weather: 'none', mode: 'tactical', width: 1280, height: 800 });
  assert.equal(noneSim.particles.length, 0);
});

test('stepWeatherSimulation advances particles cleanly without NaN', () => {
  for (const weather of ['rain', 'snow', 'embers', 'mist']) {
    for (const mode of ['tactical', 'narrative']) {
      const sim = createWeatherSimulation({ weather, mode, width: 1280, height: 800 });
      for (let i = 0; i < 10; i++) {
        stepWeatherSimulation(sim, 0.016);
      }
      for (const p of sim.particles) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${weather}/${mode} finite coords`);
      }
    }
  }
});

test('Service.setSceneWeather persists per-scene weather and syncs via extractWorldForSeat', async () => {
  const prevState = Service.state;
  const prevNotify = Service.notify;
  const prevLoadImg = Service.loadExternalMapImage;

  try {
    Service.notify = () => {};
    Service.loadExternalMapImage = () => {};
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.isHostGm = true;

    Service.setSceneWeather('rain');
    assert.equal(Service.state.sceneWeather, 'rain');
    assert.equal(Selector.extractWorldForSeat(Service.state, 'gm').sceneWeather, 'rain');
    assert.equal(Selector.extractWorldForSeat(Service.state, 'p1').sceneWeather, 'rain');

    // Switching to another map restores that map's weather ('none' by default)
    await Service.activateMapTemplate({ key: 'forest', isCustom: false });
    assert.equal(Service.state.sceneWeather, 'none');

    // Switching back to bastion restores 'rain'
    await Service.activateMapTemplate({ key: 'bastion', isCustom: false });
    assert.equal(Service.state.sceneWeather, 'rain');
  } finally {
    Service.state = prevState;
    Service.notify = prevNotify;
    Service.loadExternalMapImage = prevLoadImg;
  }
});

test('buildMapMenuSpec hides tactical tools when isNarrative is true', () => {
  const narSpec = buildMapMenuSpec({ role: 'gm', isNarrative: true });
  assert.equal(narSpec.showToolsRow, false);
  const tacSpec = buildMapMenuSpec({ role: 'gm', isNarrative: false });
  assert.equal(tacSpec.showToolsRow, true);
});

test('syncWeatherOverlay does not freeze explicitly enabled weather on prefers-reduced-motion', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../js/ui/canvasView.js'), 'utf8');
  const match = src.match(/syncWeatherOverlay\(state[^)]*\)\s*\{[\s\S]*?\n  \},/);
  assert.ok(match, 'syncWeatherOverlay must exist in canvasView.js');
  assert.doesNotMatch(match[0], /prefers-reduced-motion/);
});
