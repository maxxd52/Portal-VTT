import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  location: { search: '', origin: 'http://localhost', pathname: '/' }
};

const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { CanvasViewMethods } = await import('../js/ui/canvasView.js?v=20261125a1');

function createHtmlTrackingLayer() {
  let _html = '';
  return {
    writes: 0,
    get innerHTML() {
      return _html;
    },
    set innerHTML(val) {
      this.writes += 1;
      _html = String(val);
    },
    querySelectorAll() {
      return [];
    }
  };
}

test('OPT-3: renderMapNotes skips innerHTML rebuild when notes signature is unchanged', () => {
  const prevState = Service.state;
  const layer = createHtmlTrackingLayer();
  try {
    const state = createInitialState();
    state.role = 'gm';
    state.mapId = 'bastion';
    state.activeMapKey = 'bastion';
    state.notes = [{ id: 'n1', sceneKey: 'bastion', x: 100, y: 200, title: 'Altar', body: 'Runas', gmOnly: false }];
    Service.state = state;

    const view = { ...CanvasViewMethods, els: { mapNotesLayer: layer } };
    view.renderMapNotes(state);
    view.renderMapNotes(state);
    assert.equal(layer.writes, 1, 'identical renderMapNotes calls should only write innerHTML once');

    state.notes[0].title = 'Altar antiguo';
    view.renderMapNotes(state);
    assert.equal(layer.writes, 2, 'changing note title must trigger innerHTML update');
  } finally {
    Service.state = prevState;
  }
});

test('OPT-3: renderMapLights skips innerHTML rebuild when hidden/empty or lights signature is unchanged', () => {
  const layer = createHtmlTrackingLayer();
  const state = createInitialState();
  state.role = 'gm';
  state.mapId = 'bastion';
  state.activeMapKey = 'bastion';
  state.tool = 'select';
  state.mapLights = [{ id: 'l1', sceneKey: 'bastion', x: 300, y: 400, radiusMeters: 6, tone: 'warm', enabled: true }];

  const view = {
    ...CanvasViewMethods,
    escapeHtml: (s) => String(s),
    els: { mapLightsLayer: layer }
  };

  view.renderMapLights(state);
  view.renderMapLights(state);
  assert.equal(layer.writes, 1, 'repeated hidden renderMapLights should only clear once');

  state.tool = 'wall';
  view.renderMapLights(state);
  view.renderMapLights(state);
  assert.equal(layer.writes, 2, 'identical visible renderMapLights should only write innerHTML once');

  state.mapLights[0].enabled = false;
  view.renderMapLights(state);
  assert.equal(layer.writes, 3, 'toggling light enabled state must trigger innerHTML update');

  state.selectedMapLightIds = ['l1'];
  view.renderMapLights(state);
  assert.equal(layer.writes, 4, 'changing selectedMapLightIds must trigger innerHTML update');
});

test('OPT-3: renderVectorOverlay skips innerHTML write when SVG markup is identical', () => {
  const layer = createHtmlTrackingLayer();
  const state = createInitialState();
  state.tool = 'select';
  state.ruler = { x1: 10, y1: 10, x2: 110, y2: 10 };
  state.pings = [];

  const view = {
    ...CanvasViewMethods,
    hoverWorldPos: { x: 0, y: 0 },
    els: { overlayVectorSvg: layer }
  };

  view.renderVectorOverlay(state);
  view.renderVectorOverlay(state);
  assert.equal(layer.writes, 1, 'identical renderVectorOverlay calls should only write innerHTML once');

  state.ruler.x2 = 210;
  view.renderVectorOverlay(state);
  assert.equal(layer.writes, 2, 'changing ruler endpoint must trigger innerHTML update');
});

test('OPT-3: isPointExplored caches full alpha buffer so repeated door checks call getImageData once', () => {
  const buf = new Uint8ClampedArray(600 * 400 * 4);
  // World (480, 320) -> explored (120, 80)
  buf[(80 * 600 + 120) * 4 + 3] = 255;

  let getImageDataCalls = 0;
  const mockCtx = {
    clearRect() {},
    getImageData(x, y, w, h) {
      getImageDataCalls += 1;
      assert.equal(x, 0);
      assert.equal(y, 0);
      assert.equal(w, 600);
      assert.equal(h, 400);
      return { data: buf };
    }
  };

  const view = {
    ...CanvasViewMethods,
    exploredCanvas: {
      getContext() {
        return mockCtx;
      }
    },
    _exploredHasPixels: true
  };

  for (let i = 0; i < 10; i++) {
    assert.equal(view.isPointExplored(480, 320), true);
    assert.equal(view.isPointExplored(0, 0), false);
  }
  assert.equal(getImageDataCalls, 1, 'isPointExplored should cache the 600x400 alpha buffer');

  view.clearExploredMemory();
  assert.equal(view._exploredAlphaCache, null, 'clearExploredMemory must invalidate _exploredAlphaCache');
});
