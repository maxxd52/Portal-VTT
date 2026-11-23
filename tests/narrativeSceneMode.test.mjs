import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  location: { search: '', origin: 'http://localhost', pathname: '/' }
};

const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { Selector } = await import('../js/core/selector.js?v=20261123a7');
const { Service } = await import('../js/core/service.js?v=20261123a7');
const { resolveMapCardDescriptor } = await import('../js/utils/compendiumCardModel.js?v=20261123a7');

test('Selector.isNarrativeScene returns true only when sceneMode === "narrative"', () => {
  assert.equal(Selector.isNarrativeScene(null), false);
  assert.equal(Selector.isNarrativeScene({}), false);
  assert.equal(Selector.isNarrativeScene({ sceneMode: 'tactical' }), false);
  assert.equal(Selector.isNarrativeScene({ sceneMode: 'narrative' }), true);
});

test('resolveMapCardDescriptor includes sceneMode ("narrative" or "tactical" default)', () => {
  const nar = resolveMapCardDescriptor(
    { key: 'n1', name: 'Taberna', desc: 'Escena', isCustom: true, imageUrl: 'data:image/webp;base64,AAA', sceneMode: 'narrative' },
    'n1'
  );
  assert.equal(nar.sceneMode, 'narrative');
  assert.equal(nar.isActive, true);

  const legacy = resolveMapCardDescriptor(
    { key: 't1', name: 'Viejo mapa', desc: '', isCustom: true, imageUrl: 'data:image/webp;base64,BBB' },
    ''
  );
  assert.equal(legacy.sceneMode, 'tactical');
});

test('extractWorldForSeat includes sceneMode for both GM and player seats', () => {
  const state = createInitialState();
  state.sceneMode = 'narrative';
  const gmWorld = Selector.extractWorldForSeat(state, 'gm');
  const playerWorld = Selector.extractWorldForSeat(state, 'p1');
  assert.equal(gmWorld.sceneMode, 'narrative');
  assert.equal(playerWorld.sceneMode, 'narrative');

  delete state.sceneMode;
  assert.equal(Selector.extractWorldForSeat(state, 'gm').sceneMode, 'tactical');
  assert.equal(Selector.extractWorldForSeat(state, 'p1').sceneMode, 'tactical');
});

test('saveCustomMap & activateMapTemplate switch sceneMode cleanly and stay backward compatible', async () => {
  const prevState = Service.state;
  const prevNotify = Service.notify;
  const prevLoadImg = Service.loadExternalMapImage;

  try {
    Service.notify = () => {};
    Service.loadExternalMapImage = () => {};
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.isHostGm = true;
    Service.state.tool = 'wall';

    const narMap = Service.saveCustomMap({
      name: 'Bosque Brumoso',
      imageUrl: 'data:image/webp;base64,NAR',
      desc: 'Escena narrativa',
      sceneMode: 'narrative'
    });
    assert.equal(narMap.sceneMode, 'narrative');

    await Service.activateMapTemplate(narMap);
    assert.equal(Service.state.sceneMode, 'narrative');
    assert.equal(Service.state.tool, 'select');

    // Switching back to tactical preset restores tactical mode
    await Service.activateMapTemplate({ key: 'bastion', isCustom: false });
    assert.equal(Service.state.sceneMode, 'tactical');

    // Legacy custom map without sceneMode defaults to tactical
    const legacyMap = {
      key: 'legacy_map',
      isCustom: true,
      name: 'Mapa legado',
      imageUrl: 'data:image/webp;base64,LEG'
    };
    Service.state.customMaps.push(legacyMap);
    await Service.activateMapTemplate(legacyMap);
    assert.equal(Service.state.sceneMode, 'tactical');
  } finally {
    Service.state = prevState;
    Service.notify = prevNotify;
    Service.loadExternalMapImage = prevLoadImg;
  }
});
