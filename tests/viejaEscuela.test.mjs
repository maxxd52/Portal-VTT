import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  location: { search: '', origin: 'http://localhost', pathname: '/' }
};

const { SYSTEM_PRESETS, createInitialState } = await import('../js/core/model.js?v=20261121a6');
const { Selector } = await import('../js/core/selector.js?v=20261121a6');
const { Service } = await import('../js/core/service.js?v=20261121a6');
const { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS } = await import('../js/data/compendium.js?v=20261121a6');
const { VIEJA_ESCUELA_ACTORS, VIEJA_ESCUELA_ITEMS } = await import('../js/data/viejaEscuela.js?v=20261121a6');

test('Vieja Escuela preset registers rules, sheet schema, tray dice, and GM screen', () => {
  assert.ok(SYSTEM_PRESETS.vieja_escuela, 'SYSTEM_PRESETS.vieja_escuela must exist');

  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.applySystemPreset('vieja_escuela');

  const cfg = Service.state.systemConfig;
  assert.equal(cfg.preset, 'vieja_escuela');
  assert.equal(cfg.rollFormula, '1d20+@stat');
  assert.equal(cfg.successThreshold, 11);
  assert.equal(cfg.hpLabel, 'PV');
  assert.equal(cfg.defenseLabel, 'DEF');
  assert.equal(cfg.showScores, false);
  assert.equal(cfg.showLevelPb, false);

  const statKeys = Selector.getSheetStatsDef(Service.state).map((s) => s.key);
  assert.deepEqual(statKeys, ['fue', 'des', 'con', 'int', 'sab', 'car', 'atq', 'ins', 'mov']);

  const tray = Selector.getSystemTrayTools(Service.state);
  assert.deepEqual(tray.dice, ['4', '6', '8', '10', '12', '20']);

  const modes = Selector.getSystemResultModes(Service.state);
  assert.deepEqual(modes, ['sum', 'each']);

  const outcome = Selector.getSystemOutcomeConfig(Service.state);
  assert.equal(outcome.outcomeRule, 'high');
  assert.equal(outcome.showCrits, true);

  assert.ok(Service.state.gmScreen.references.length >= 4, 'GM screen should include Vieja Escuela reference cards');
  assert.ok(Service.state.gmScreen.tables.length >= 2, 'GM screen should include Vieja Escuela random tables');
});

test('Vieja Escuela Baúl actors and complementos are scoped to vieja_escuela and spawn cleanly', async () => {
  assert.ok(VIEJA_ESCUELA_ACTORS.length >= 20, 'Should include 4 pregen PCs + 16 monsters');
  assert.ok(VIEJA_ESCUELA_ITEMS.length >= 40, 'Should include skills, talents, weapons, armor, gear, and magic');

  for (const a of VIEJA_ESCUELA_ACTORS) {
    assert.equal(a.system, 'vieja_escuela', `Actor ${a.key} must be scoped to vieja_escuela`);
    assert.ok(COMPENDIUM_ACTORS.some((x) => x.key === a.key), `Actor ${a.key} must be in COMPENDIUM_ACTORS`);
  }
  for (const it of VIEJA_ESCUELA_ITEMS) {
    assert.equal(it.system, 'vieja_escuela', `Item ${it.key} must be scoped to vieja_escuela`);
    assert.ok(COMPENDIUM_ITEMS.some((x) => x.key === it.key), `Item ${it.key} must be in COMPENDIUM_ITEMS`);
  }

  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.applySystemPreset('vieja_escuela');

  const tpl = COMPENDIUM_ACTORS.find((a) => a.key === 've_pc_hechicero_elfo');
  assert.ok(tpl);
  const tok = await Service.spawnActorFromTemplate(tpl, 400, 400);
  assert.equal(tok.hp, 4);
  assert.equal(tok.ac, 11);
  assert.equal(tok.visionMeters, 20);
  assert.equal(tok.skills.length, 6);
  assert.equal(tok.traits.length, 3);
  assert.ok(tok.inventory.length >= 3);
  assert.equal(tok.resources.find((r) => r.id === 'res_pod')?.max, 3);
});
