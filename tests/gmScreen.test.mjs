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

const { createInitialState } = await import('../js/core/model.js');
const { Selector } = await import('../js/core/selector.js');
const { Service } = await import('../js/core/service.js');
const { createDefaultGmScreen } = await import('../js/data/gmScreenPresets.js');

function resetServiceForTest(preset = 'dnd55', role = 'gm') {
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = role;
  Service.state.isHostGm = role === 'gm';
  Service.applySystemPreset(preset);
  return Service.state;
}

test('S1: createDefaultGmScreen provides structured presets for all 6 systems without shared references', () => {
  for (const key of ['dnd55', 'pbta', 'pool', 'd100', 'vieja_escuela', 'free']) {
    const a = createDefaultGmScreen(key);
    const b = createDefaultGmScreen(key);
    assert.ok(Array.isArray(a.tabs) && a.tabs.length >= 2, `${key} should have at least 2 tabs`);
    assert.ok(Array.isArray(a.widgets) && a.widgets.length >= 4, `${key} should have starter widgets`);
    assert.ok(a.tabs.some((t) => t.allowCompendium), `${key} should have a staging tab`);
    a.tabs[0].label = 'Mutated';
    assert.notEqual(b.tabs[0].label, 'Mutated');
  }
});

test('S1: getGmScreenState falls back gracefully for legacy portals without gmScreen', () => {
  const legacyState = createInitialState();
  legacyState.gmScreen = null;
  legacyState.systemConfig.preset = 'pbta';

  const derived = Selector.getGmScreenState(legacyState);
  assert.equal(legacyState.gmScreen, null, 'Selector must stay pure and not mutate state');
  assert.equal(derived.activeTabId, 'table');
  assert.ok(derived.tabs.some((t) => t.id === 'prep'));
});

test('S1: extractSerializableWorld strips private gmScreen by default and keeps it only when includePrivateGm=true', () => {
  const state = resetServiceForTest('dnd55', 'gm');
  state.gmScreen.notes[0].body = 'El tabernero es el asesino';
  state.gmScreen.clocks.push(
    { id: 'c_priv', label: 'Secreto', kind: 'clock', segments: 6, value: 2, color: '#ef4444', isPublic: false },
    { id: 'c_pub', label: 'Alarma', kind: 'clock', segments: 4, value: 1, color: '#8b5cf6', isPublic: true }
  );

  const p2pWorld = Selector.extractSerializableWorld(state);
  assert.equal('gmScreen' in p2pWorld, false, 'P2P WORLD_SYNC must never contain gmScreen');
  assert.equal(p2pWorld.publicClocks.length, 1);
  assert.equal(p2pWorld.publicClocks[0].id, 'c_pub');
  assert.equal('isPublic' in p2pWorld.publicClocks[0], false);

  const vaultWorld = Selector.extractSerializableWorld(state, { includePrivateGm: true });
  assert.ok(vaultWorld.gmScreen, 'Local vault / cartridge export must include gmScreen');
  assert.equal(vaultWorld.gmScreen.notes[0].body, 'El tabernero es el asesino');
});

test('S1: applyFullWorldState protects GM screen against player syncs and strips GM data when role is player', () => {
  const state = resetServiceForTest('dnd55', 'gm');
  state.gmScreen.notes[0].body = 'Trampa en la puerta norte';

  // Simulated player token-move WORLD_SYNC arriving at GM without gmScreen
  const playerPayload = Selector.extractSerializableWorld({ ...state, role: 'player', gmScreen: null });
  Service.applyFullWorldState(playerPayload, true);
  assert.equal(Service.state.gmScreen.notes[0].body, 'Trampa en la puerta norte');

  // Simulated player tab receiving world payload
  const playerState = resetServiceForTest('dnd55', 'player');
  playerState.gmScreenOpen = true;
  Service.applyFullWorldState({ ...playerPayload, gmScreen: { activeTabId: 'hack', tabs: [] } }, true);
  assert.equal(Service.state.gmScreen, null);
  assert.equal(Service.state.gmScreenOpen, false);
});

test('S1: toggleGmScreen closes character sheet drawer on left side for GM and blocks player role', () => {
  resetServiceForTest('dnd55', 'gm');
  Service.state.sheetOpen = true;
  Service.state.drawerOpen = true;
  assert.equal(Service.toggleGmScreen(true), true);
  assert.equal(Service.state.gmScreenOpen, true);
  assert.equal(Service.state.sheetOpen, false);
  assert.equal(Service.state.drawerOpen, true);

  Service.setRole('player');
  assert.equal(Service.toggleGmScreen(true), false);
  assert.equal(Service.state.gmScreenOpen, false);
});

test('S1: pinToGmScreen deduplicates pins and unpinFromGmScreen removes them', () => {
  resetServiceForTest('dnd55', 'gm');
  const first = Service.pinToGmScreen({ kind: 'actor', key: 'goblin', title: 'Goblin' });
  assert.equal(first.alreadyPinned, false);
  assert.equal(first.tab.id, 'prep');
  assert.equal(Service.state.gmScreen.pins.length, 1);

  const dup = Service.pinToGmScreen({ kind: 'actor', key: 'goblin', title: 'Goblin' });
  assert.equal(dup.alreadyPinned, true);
  assert.equal(Service.state.gmScreen.pins.length, 1);

  assert.equal(Service.unpinFromGmScreen(first.pin.id), true);
  assert.equal(Service.state.gmScreen.pins.length, 0);
});

test('S2: clocks clamp values, toggle public projection cleanly, and never leak private clocks', () => {
  resetServiceForTest('dnd55', 'gm');
  const priv = Service.addGmClock({ label: 'Conspiración', kind: 'clock', segments: 4, isPublic: false });
  const pub = Service.addGmClock({ label: 'Miedo', kind: 'counter', color: '#e11d48', isPublic: true });
  assert.ok(priv && pub);

  // Clock clamps between 0 and segments (4)
  Service.stepGmClock(priv.id, -3);
  assert.equal(priv.value, 0);
  Service.stepGmClock(priv.id, 10);
  assert.equal(priv.value, 4);

  // Counter clamps >= 0 and supports arbitrary positive integers
  Service.stepGmClock(pub.id, 7);
  assert.equal(pub.value, 7);
  Service.stepGmClock(pub.id, -20);
  assert.equal(pub.value, 0);

  // Public projection omits private clock and includes only public ones
  let publicList = Selector.getPublicClocks(Service.state);
  assert.equal(publicList.length, 1);
  assert.equal(publicList[0].id, pub.id);
  assert.equal('isPublic' in publicList[0], false);

  // Toggle priv -> public and delete pub
  Service.toggleGmClockPublic(priv.id);
  Service.deleteGmClock(pub.id);
  publicList = Selector.getPublicClocks(Service.state);
  assert.equal(publicList.length, 1);
  assert.equal(publicList[0].id, priv.id);
  assert.equal(publicList[0].value, 4);
});

test('S3: evaluateRollAgainstRequest covers high, low, tiered, and pool engines accurately', () => {
  // 1. High (D&D 5.5)
  assert.equal(Selector.evaluateRollAgainstRequest({ evalMode: 'high', dc: 15 }, { total: 15 }).status, 'pass');
  assert.equal(Selector.evaluateRollAgainstRequest({ evalMode: 'high', dc: 15 }, { total: 14 }).status, 'fail');
  assert.equal(Selector.evaluateRollAgainstRequest({ evalMode: 'high', dc: 0 }, { total: 14 }).status, 'none');

  // 2. Low (1d100 / BRP) with Normal x1, Hard /2, Extreme /5 and +-mod
  const investigator = { id: 'tok-inv', stats: { int: 60 } };
  assert.equal(
    Selector.evaluateRollAgainstRequest({ evalMode: 'low', statKey: 'int', lowScale: 1, difficultyMod: 0 }, { total: 60 }, investigator).status,
    'pass'
  );
  assert.equal(
    Selector.evaluateRollAgainstRequest({ evalMode: 'low', statKey: 'int', lowScale: 2, difficultyMod: 0 }, { total: 31 }, investigator).status,
    'fail'
  );
  assert.equal(
    Selector.evaluateRollAgainstRequest({ evalMode: 'low', statKey: 'int', lowScale: 5, difficultyMod: 10 }, { total: 22 }, investigator).status,
    'pass'
  );

  // 3. Tiered (PbtA 2d6)
  assert.equal(Selector.evaluateRollAgainstRequest({ evalMode: 'tiered' }, { total: 10 }).status, 'pass');
  assert.equal(Selector.evaluateRollAgainstRequest({ evalMode: 'tiered' }, { total: 8 }).status, 'partial');
  assert.equal(Selector.evaluateRollAgainstRequest({ evalMode: 'tiered' }, { total: 6 }).status, 'fail');

  // 4. Pool (Successes)
  assert.equal(Selector.evaluateRollAgainstRequest({ evalMode: 'pool', requiredSuccesses: 3 }, { total: 3 }).status, 'pass');
  assert.equal(Selector.evaluateRollAgainstRequest({ evalMode: 'pool', requiredSuccesses: 3 }, { total: 2 }).status, 'fail');
});

test('S3: buildWireRollRequest hides dc and thresholds when secretDc is true while local request keeps them', () => {
  resetServiceForTest('dnd55', 'gm');
  const fullReq = Service.sendRollRequest({
    label: 'Sigilo',
    statKey: 'dex',
    formula: '1d20+@dex',
    dc: 18,
    targetTokenIds: ['tok-1'],
    evalMode: 'high',
    secretDc: true,
    requiredSuccesses: 3
  });
  assert.equal(fullReq.dc, 18);
  assert.equal(fullReq.secretDc, true);

  const wire = Selector.buildWireRollRequest(fullReq);
  assert.equal(wire.dc, 0);
  assert.equal(wire.secretDc, true);
  assert.equal('requiredSuccesses' in wire, false);
  assert.equal('lowScale' in wire, false);
  assert.equal(Service.state.events.at(-1).detail.includes('18'), false, 'Shared event log must not leak secret DC');
});

test('S4: notes, checklists, and random tables work locally and handle empty tables safely', () => {
  resetServiceForTest('dnd55', 'gm');
  const note = Service.addGmNote('note', 'Pistas de la posada');
  Service.updateGmNote(note.id, { body: 'Llave debajo de la mesa' });
  assert.equal(Service.state.gmScreen.notes.find((n) => n.id === note.id).body, 'Llave debajo de la mesa');

  const chk = Service.addGmNote('checklist', 'Escena 1');
  const item = Service.addGmChecklistItem(chk.id, 'Mostrar mapa');
  assert.equal(item.done, false);
  Service.toggleGmChecklistItem(chk.id, item.id);
  assert.equal(item.done, true);
  assert.equal(Service.removeGmChecklistItem(chk.id, item.id), true);

  const tbl = Service.addGmTable('Clima', ['Lluvia', 'Niebla', 'Sol']);
  const r0 = Service.rollGmTable(tbl.id, () => 0);
  assert.deepEqual(r0, { tableTitle: 'Clima', index: 1, total: 3, text: 'Lluvia' });
  const rLast = Service.rollGmTable(tbl.id, () => 0.99);
  assert.deepEqual(rLast, { tableTitle: 'Clima', index: 3, total: 3, text: 'Sol' });

  Service.updateGmTable(tbl.id, { entries: '   \n  ' });
  assert.equal(Service.rollGmTable(tbl.id), null);
  assert.equal(tbl.lastRoll, null);
});

test('S5: GM screen config supports widget switches on presets and full tab/widget builder on generic', () => {
  resetServiceForTest('dnd55', 'gm');
  const firstWidget = Service.state.gmScreen.widgets[0];
  Service.toggleGmWidgetEnabled(firstWidget.id, false);
  assert.equal(firstWidget.enabled, false);

  Service.pinToGmScreen({ kind: 'actor', key: 'goblin', title: 'Goblin' });
  Service.resetGmScreenToPreset(true);
  assert.equal(Service.state.gmScreen.widgets[0].enabled, true);
  assert.equal(Service.state.gmScreen.pins.length, 1, 'Resetting layout preserves pinned items');

  // Switch to Generic (free) and manage custom compendium tabs & widgets
  resetServiceForTest('free', 'gm');
  const packTab = Service.addGmScreenTab('Packs Especiales', true);
  assert.ok(packTab);
  assert.ok(Selector.getGmStagingTabs(Service.state).some((t) => t.id === packTab.id));
  assert.ok(Service.state.gmScreen.widgets.some((w) => w.tabId === packTab.id && w.type === 'staging'));

  const extraWidget = Service.addGmWidget(packTab.id, 'tables', 'Encuentros del Pack');
  assert.ok(extraWidget);
  Service.renameGmScreenTab(packTab.id, 'Jefes');
  assert.equal(Service.state.gmScreen.tabs.find((t) => t.id === packTab.id).label, 'Jefes');
  assert.equal(Service.moveGmWidget(extraWidget.id, -1), true);
  assert.equal(Service.removeGmWidget(extraWidget.id), true);
  assert.equal(Service.removeGmScreenTab(packTab.id), true);
  // Cannot delete the last remaining tab
  while (Service.state.gmScreen.tabs.length > 1) {
    Service.removeGmScreenTab(Service.state.gmScreen.tabs[Service.state.gmScreen.tabs.length - 1].id);
  }
  assert.equal(Service.removeGmScreenTab(Service.state.gmScreen.tabs[0].id), false);
});

test('UX Audit (Items 1, 2, 6, 7): GM Screen removes redundant settings gear & handout creation UI, fixes left resize, and enforces shrink-0', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(import.meta.dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const gmViewSrc = fs.readFileSync(path.join(root, 'js/ui/gmScreenView.js'), 'utf8');

  // Item 1: no redundant settings gear in GM Screen drawer header
  assert.equal(html.includes('id="btnGmScreenSettings"'), false, 'index.html must not render redundant #btnGmScreenSettings in GM Screen header');

  // Item 2: no redundant blind-broadcast handout creation boxes in Salas or GM Screen
  assert.equal(html.includes('id="handoutShareBox"'), false, 'index.html must not render redundant #handoutShareBox in Salas');
  assert.equal(gmViewSrc.includes('data-gm-toggle-handout-form'), false, 'gmScreenView must not render redundant + Handout form');

  // Item 6: #gmScreenDrawer is on the left, so bindDrawerResize must use "left"
  assert.ok(
    gmViewSrc.includes("bindDrawerResize(this.els.gmScreenDrawer, 'left'"),
    'gmScreenView must bind drawer resize on the left edge matching portal-drawer-left'
  );

  // Item 7: shrink-0 on GM widget cards and #handoutModal image wrapper
  assert.ok(
    gmViewSrc.includes('data-gm-widget="${esc(widget.id)}" data-gm-widget-type="${esc(widget.type)}" class="portal-subpanel rounded-xl p-2.5 flex flex-col gap-2 shrink-0"'),
    'GM widget cards must include shrink-0'
  );
  const handoutImgWrapMatch = html.match(/<div class="([^"]*overflow-hidden[^"]*)">\s*<img id="handoutModalImg"/);
  assert.ok(handoutImgWrapMatch, 'handoutModal must contain image wrapper');
  assert.ok(
    handoutImgWrapMatch[1].split(/\s+/).includes('shrink-0'),
    'handoutModal image wrapper must include shrink-0'
  );
});

test('UX Audit (Items 3 & 4): GM Screen clocks, notes, and tables follow Law 1 (+/Editar toggle purple + local draft + Guardar)', async () => {
  const { Service: TaggedService } = await import('../js/core/service.js?v=20261125a1');
  const { GmScreenViewMethods } = await import('../js/ui/gmScreenView.js?v=20261125a1');
  const { GmScreenWidgetsViewMethods } = await import('../js/ui/gmScreenWidgetsView.js?v=20261125a1');

  TaggedService.state = createInitialState();
  TaggedService.state.role = 'gm';
  TaggedService.state.isHostGm = true;
  TaggedService.state.gmScreen = createDefaultGmScreen('dnd55');
  TaggedService.state.gmScreen.notes = [];
  TaggedService.state.gmScreen.tables = [];

  const ctx = {
    ...GmScreenViewMethods,
    ...GmScreenWidgetsViewMethods,
    escapeHtml: (v) => String(v ?? ''),
    renderGmScreen: () => {}
  };

  // Item 3: + Reloj / Contador highlights purple when open
  ctx.gmClockFormOpen = true;
  const clocksHtml = ctx.renderGmClocksBody(TaggedService.state, TaggedService.state.gmScreen);
  assert.ok(
    clocksHtml.includes('data-gm-toggle-clock-form="1" class="portal-btn portal-btn-accent'),
    '+ Reloj / Contador must apply portal-btn-accent when form is open'
  );

  // Item 4a: + Nota / + Checklist open local drafts without creating infinite items until Guardar
  ctx.toggleGmNoteDraft('note');
  assert.equal(TaggedService.state.gmScreen.notes.length, 0, 'Opening + Nota draft must NOT persist immediately');
  const noteDraftHtml = ctx.renderGmNotesBody(TaggedService.state, TaggedService.state.gmScreen);
  assert.ok(noteDraftHtml.includes('data-gm-note-add="note" class="portal-btn portal-btn-accent'), '+ Nota must turn purple while draft is open');
  assert.ok(noteDraftHtml.includes('data-gm-note-draft-save="1"'), 'Note draft must render explicit Guardar button');
  ctx.toggleGmNoteDraft('note');
  assert.equal(ctx.gmNoteDraft, null, 'Clicking + Nota again must cancel draft');
  assert.equal(TaggedService.state.gmScreen.notes.length, 0);

  ctx.toggleGmNoteDraft('note');
  ctx.gmNoteDraft.title = 'Escena 1';
  ctx.gmNoteDraft.body = 'Llueve fuerte.';
  ctx.saveGmNoteDraft();
  assert.equal(TaggedService.state.gmScreen.notes.length, 1, 'Saving note draft must create exactly 1 note');
  assert.equal(TaggedService.state.gmScreen.notes[0].title, 'Escena 1');
  assert.equal(TaggedService.state.gmScreen.notes[0].body, 'Llueve fuerte.');

  // Item 4b: + Nueva tabla and Editar tabla use local draft with purple toggle + Guardar/Cancelar
  ctx.toggleGmTableDraft('');
  assert.equal(TaggedService.state.gmScreen.tables.length, 0, 'Opening + Nueva tabla draft must NOT persist immediately');
  const tblDraftHtml = ctx.renderGmTablesBody(TaggedService.state, TaggedService.state.gmScreen);
  assert.ok(tblDraftHtml.includes('data-gm-tbl-add="1" class="portal-btn portal-btn-accent'), '+ Nueva tabla must turn purple while creating');
  assert.ok(tblDraftHtml.includes('data-gm-tbl-draft-save="1"'), 'Table draft must render explicit Guardar button');
  ctx.toggleGmTableDraft('');
  assert.equal(ctx.gmTableDraft, null, 'Clicking + Nueva tabla again must cancel draft');
  assert.equal(TaggedService.state.gmScreen.tables.length, 0);

  ctx.toggleGmTableDraft('');
  ctx.gmTableDraft.title = 'Clima';
  ctx.gmTableDraft.entriesText = 'Sol\nLluvia\nNiebla';
  ctx.saveGmTableDraft();
  assert.equal(TaggedService.state.gmScreen.tables.length, 1);
  assert.equal(TaggedService.state.gmScreen.tables[0].title, 'Clima');
  assert.deepEqual(TaggedService.state.gmScreen.tables[0].entries, ['Sol', 'Lluvia', 'Niebla']);

  // Editing existing table: Cancelar discards changes; Guardar commits
  const tid = TaggedService.state.gmScreen.tables[0].id;
  ctx.toggleGmTableDraft(tid);
  const editTblHtml = ctx.renderGmTablesBody(TaggedService.state, TaggedService.state.gmScreen);
  assert.ok(editTblHtml.includes(`data-gm-tbl-edit="${tid}" class="portal-btn portal-btn-accent`), '✎ must turn purple while editing table');
  ctx.gmTableDraft.title = 'NO GUARDAR';
  ctx.cancelGmTableDraft();
  assert.equal(TaggedService.state.gmScreen.tables[0].title, 'Clima', 'Cancelar table edit must leave table untouched');
});
