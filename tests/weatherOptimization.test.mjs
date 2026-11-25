import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

globalThis.window = globalThis.window || {
  location: { search: '', origin: 'http://localhost', pathname: '/' }
};

const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const weatherMod = await import('../js/utils/weatherEngine.js?v=20261125a1');
const { CanvasViewMethods } = await import('../js/ui/canvasView.js?v=20261125a1');

function createMockCtx() {
  const counts = {
    stroke: 0,
    fill: 0,
    drawImage: 0,
    arc: 0,
    createLinearGradient: 0,
    createRadialGradient: 0
  };
  return {
    counts,
    globalAlpha: 1,
    lineCap: 'butt',
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    clearRect() {},
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {
      counts.arc += 1;
    },
    stroke() {
      counts.stroke += 1;
    },
    fill() {
      counts.fill += 1;
    },
    drawImage() {
      counts.drawImage += 1;
    },
    translate() {},
    scale() {},
    createLinearGradient() {
      counts.createLinearGradient += 1;
      return { addColorStop() {} };
    },
    createRadialGradient() {
      counts.createRadialGradient += 1;
      return { addColorStop() {} };
    }
  };
}

test('resolveWeatherFrameBudget returns expected FPS and DPR caps per weather type', () => {
  assert.equal(typeof weatherMod.resolveWeatherFrameBudget, 'function');
  assert.deepEqual(weatherMod.resolveWeatherFrameBudget('mist'), {
    targetFps: 30,
    minFrameMs: 33,
    maxDpr: 1
  });
  assert.deepEqual(weatherMod.resolveWeatherFrameBudget('snow'), {
    targetFps: 30,
    minFrameMs: 33,
    maxDpr: 1
  });
  assert.deepEqual(weatherMod.resolveWeatherFrameBudget('rain'), {
    targetFps: 45,
    minFrameMs: 22,
    maxDpr: 1
  });
  assert.deepEqual(weatherMod.resolveWeatherFrameBudget('embers'), {
    targetFps: 45,
    minFrameMs: 22,
    maxDpr: 1
  });
  assert.deepEqual(weatherMod.resolveWeatherFrameBudget('none'), {
    targetFps: 0,
    minFrameMs: 1000,
    maxDpr: 1
  });
  assert.deepEqual(weatherMod.resolveWeatherFrameBudget('invalid'), {
    targetFps: 0,
    minFrameMs: 1000,
    maxDpr: 1
  });
});

test('drawWeatherSimulation batches rain and snow draw calls without per-frame gradients', () => {
  const rainSim = weatherMod.createWeatherSimulation({ weather: 'rain', mode: 'tactical', width: 1280, height: 800 });
  const rainCtx = createMockCtx();
  weatherMod.drawWeatherSimulation(rainCtx, rainSim);
  assert.ok(rainCtx.counts.stroke > 0 && rainCtx.counts.stroke <= 8, `expected batched rain strokes <= 8, got ${rainCtx.counts.stroke}`);
  assert.equal(rainCtx.counts.createLinearGradient, 0);
  assert.equal(rainCtx.counts.createRadialGradient, 0);

  const snowSim = weatherMod.createWeatherSimulation({ weather: 'snow', mode: 'narrative', width: 1280, height: 800 });
  const snowCtx = createMockCtx();
  weatherMod.drawWeatherSimulation(snowCtx, snowSim);
  assert.ok(snowCtx.counts.fill > 0 && snowCtx.counts.fill <= 4, `expected batched snow fills <= 4, got ${snowCtx.counts.fill}`);
});

test('drawWeatherSimulation uses pre-rendered sprites for mist and embers and falls back cleanly', () => {
  const mistSim = weatherMod.createWeatherSimulation({ weather: 'mist', mode: 'tactical', width: 1280, height: 800 });
  const mistCtx = createMockCtx();
  weatherMod.drawWeatherSimulation(mistCtx, mistSim, {
    sprites: { mistWisp: {}, mistGust: {} }
  });
  assert.equal(mistCtx.counts.drawImage, mistSim.particles.length);
  assert.equal(mistCtx.counts.createRadialGradient, 0);
  assert.equal(mistCtx.counts.createLinearGradient, 0);

  const emberSim = weatherMod.createWeatherSimulation({ weather: 'embers', mode: 'narrative', width: 1280, height: 800 });
  const emberCtx = createMockCtx();
  weatherMod.drawWeatherSimulation(emberCtx, emberSim, {
    sprites: { emberWarm: {}, emberGold: {} }
  });
  assert.equal(emberCtx.counts.drawImage, emberSim.particles.length);
  assert.equal(emberCtx.counts.arc, 0);

  // Fallback without sprites must still render cleanly
  assert.doesNotThrow(() => weatherMod.drawWeatherSimulation(createMockCtx(), mistSim));
  assert.doesNotThrow(() => weatherMod.drawWeatherSimulation(createMockCtx(), emberSim));
});

test('drawFogCanvas reuses precomputedLightPolys on animation ticks without calling getActiveLightPolygons again', () => {
  const prevGetLights = Selector.getActiveLightPolygons;
  let calls = 0;
  Selector.getActiveLightPolygons = () => {
    calls += 1;
    return [];
  };

  try {
    const state = createInitialState();
    state.dynamicLighting = false;
    state.ambientLight = 'day';
    const ctx = createMockCtx();
    const viewStub = {
      ...CanvasViewMethods,
      els: {
        fogCanvas: {
          getContext() {
            return ctx;
          }
        }
      },
      getActiveMapBounds() {
        return { x: 0, y: 0, width: 2400, height: 1600 };
      }
    };

    viewStub.drawFogCanvas(state, 1000, { fromAnimLoop: true, precomputedLightPolys: [] });
    assert.equal(calls, 0, 'drawFogCanvas must not re-query Selector.getActiveLightPolygons when precomputedLightPolys is provided');
  } finally {
    Selector.getActiveLightPolygons = prevGetLights;
  }

  const canvasSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../js/ui/canvasView.js'), 'utf8');
  assert.match(canvasSrc, /drawFogCanvas\(Service\.state,\s*now,\s*\{\s*fromAnimLoop:\s*true,\s*precomputedLightPolys:\s*curLights\s*\}\)/);
});
