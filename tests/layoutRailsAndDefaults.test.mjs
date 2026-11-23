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

const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { Selector } = await import('../js/core/selector.js?v=20261123a7');
const { Service } = await import('../js/core/service.js?v=20261123a7');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261123a7');

test('S3: all side drawers start collapsed by default for both GM and Player roles and syncPlayerRoleState keeps sheet collapsed', () => {
  globalThis.window.location.search = '';
  const gmState = createInitialState();
  assert.equal(gmState.sheetOpen, false);
  assert.equal(gmState.drawerOpen, false);
  assert.equal(gmState.gmScreenOpen, false);
  assert.equal(gmState.journalOpen, false);

  globalThis.window.location.search = '?role=player&invite=inv-1';
  const playerState = createInitialState();
  assert.equal(playerState.sheetOpen, false);
  assert.equal(playerState.drawerOpen, false);
  assert.equal(playerState.gmScreenOpen, false);
  assert.equal(playerState.journalOpen, false);
  globalThis.window.location.search = '';

  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    Service.state = createInitialState();
    Service.state.role = 'player';
    Service.state.isHostGm = false;
    Service.state.activeInviteId = 'inv-1';
    Service.state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] }];
    Service.state.selectedTokenId = null;
    Service.state.sheetOpen = false;
    Service.syncPlayerRoleState();
    assert.equal(Service.state.selectedTokenId, 'tok-1');
    assert.equal(Service.state.sheetOpen, false, 'syncPlayerRoleState must not force character sheet open');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S3: topbar excludes side-panel triggers while left and right edge rails host Fichas, Diario, Baúl, and Pantalla del Narrador', () => {
  const htmlPath = path.resolve(import.meta.dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const headerMatch = html.match(/<header[\s\S]*?<\/header>/);
  assert.ok(headerMatch, 'index.html must have a <header>');
  const headerHtml = headerMatch[0];

  for (const id of ['btnToggleSheet', 'btnToggleTokenDrawer', 'btnToggleGmScreen', 'btnToggleJournal']) {
    assert.equal(headerHtml.includes(`id="${id}"`), false, `Topbar <header> must NOT contain ${id}`);
  }

  const leftRailMatch = html.match(/id="leftEdgeRail"[\s\S]*?<\/nav>/);
  assert.ok(leftRailMatch, 'index.html must define #leftEdgeRail');
  assert.ok(leftRailMatch[0].includes('id="btnToggleSheet"'));
  assert.ok(leftRailMatch[0].includes('id="btnToggleGmScreen"'));

  const rightRailMatch = html.match(/id="rightEdgeRail"[\s\S]*?<\/nav>/);
  assert.ok(rightRailMatch, 'index.html must define #rightEdgeRail');
  assert.ok(rightRailMatch[0].includes('id="btnToggleJournal"'));
  assert.ok(rightRailMatch[0].includes('id="btnToggleTokenDrawer"'));
  assert.equal(rightRailMatch[0].includes('id="btnToggleGmScreen"'), false, '#rightEdgeRail must NOT contain #btnToggleGmScreen');

  const tokenDrawerTag = html.match(/<aside[\s\S]*?id="tokenDrawer"[\s\S]*?>/);
  assert.ok(tokenDrawerTag, '#tokenDrawer must exist');
  assert.equal(/\bis-open\b/.test(tokenDrawerTag[0]), false, '#tokenDrawer must start collapsed without is-open');
  assert.ok(tokenDrawerTag[0].includes('aria-label="Baúl"'));
  assert.ok(html.includes('>Baúl<'));
  assert.ok(html.includes('placeholder="Buscar en el baúl..."'));

  for (const drawerId of ['characterSheetDrawer', 'gmScreenDrawer', 'journalDrawer']) {
    const m = html.match(new RegExp(`<aside[\\s\\S]*?id="${drawerId}"[\\s\\S]*?>`));
    assert.ok(m, `#${drawerId} must exist`);
    assert.equal(/\bis-open\b/.test(m[0]), false, `#${drawerId} must start collapsed without is-open`);
  }
});

test('Edge rail triggers are icon-only and uniformly sized in CSS', () => {
  const rootDir = path.resolve(import.meta.dirname, '..');
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'css/styles.css'), 'utf8');

  const leftRailHtml = html.match(/id="leftEdgeRail"[\s\S]*?<\/nav>/)?.[0] || '';
  const rightRailHtml = html.match(/id="rightEdgeRail"[\s\S]*?<\/nav>/)?.[0] || '';
  for (const label of ['Fichas', 'Diario', 'Baúl', 'Pantalla']) {
    assert.equal(leftRailHtml.includes(`>${label}<`), false, `Left rail must be icon-only without >${label}<`);
    assert.equal(rightRailHtml.includes(`>${label}<`), false, `Right rail must be icon-only without >${label}<`);
  }

  const edgeTabRule = css.match(/\.portal-edge-tab\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(edgeTabRule, /\bwidth:\s*44px\s*;/, '.portal-edge-tab must enforce fixed width');
  assert.match(edgeTabRule, /\bheight:\s*44px\s*;/, '.portal-edge-tab must enforce fixed height');
  assert.equal(/\.portal-edge-tab-(left|right):hover\s*\{[^}]*translateX/.test(css), false, 'Edge tabs must not translateX on hover');

  const gmDrawerTag = html.match(/<aside[\s\S]*?id="gmScreenDrawer"[\s\S]*?>/)?.[0] || '';
  assert.ok(gmDrawerTag.includes('portal-drawer-left'), '#gmScreenDrawer must open on the left side');
  assert.ok(gmDrawerTag.includes('left-3'), '#gmScreenDrawer must be anchored with left-3');

  const railSvgs = [...leftRailHtml.matchAll(/<svg[^>]*>/g), ...rightRailHtml.matchAll(/<svg[^>]*>/g)].map((m) => m[0]);
  assert.equal(railSvgs.length, 4, 'Expected 4 edge-rail SVG icons');
  for (const svgTag of railSvgs) {
    assert.ok(svgTag.includes('w-[22px] h-[22px]'), `Edge-rail SVG must use larger 22px icon sizing: ${svgTag}`);
  }

  const viewJs = fs.readFileSync(path.join(rootDir, 'js/core/view.js'), 'utf8');
  const leftOpenLine = viewJs.match(/const leftOpen = [^\n]+/)?.[0] || '';
  const rightOpenLine = viewJs.match(/const rightOpen = [^\n]+/)?.[0] || '';
  assert.ok(leftOpenLine.includes('state.gmScreenOpen'), 'Opening GM screen must hide only leftEdgeRail');
  assert.equal(rightOpenLine.includes('state.gmScreenOpen'), false, 'Opening GM screen must NOT hide rightEdgeRail');
});

test('Options menu provides local railsSwapped toggle persisted locally without P2P sync or world serialization', () => {
  const rootDir = path.resolve(import.meta.dirname, '..');
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'css/styles.css'), 'utf8');

  assert.ok(html.includes('id="railsSwapSeg"'), 'Options popover must include #railsSwapSeg');
  assert.ok(html.includes('data-rails-swapped="false"'), '#railsSwapSeg must offer standard mode');
  assert.ok(html.includes('data-rails-swapped="true"'), '#railsSwapSeg must offer swapped mode');

  assert.ok(css.includes('html[data-rails-swapped="true"] .portal-edge-rail-left'), 'CSS must swap left edge rail');
  assert.ok(css.includes('html[data-rails-swapped="true"] .portal-edge-rail-right'), 'CSS must swap right edge rail');
  assert.ok(css.includes('html[data-rails-swapped="true"] .portal-drawer-left'), 'CSS must swap left drawers');
  assert.ok(css.includes('html[data-rails-swapped="true"] .portal-drawer-right'), 'CSS must swap right drawers');

  const storageMap = new Map();
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v))
  };
  const origSend = RealtimeBridge.send;
  let sendCount = 0;
  RealtimeBridge.send = () => { sendCount += 1; };

  try {
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.isHostGm = true;
    Service.railsSwapped = false;

    assert.equal(Service.setRailsSwapped(true), true);
    assert.equal(Service.railsSwapped, true);
    assert.equal(sendCount, 0, 'Toggling railsSwapped must not emit P2P sync');
    assert.equal(storageMap.get('portal_vtt_rails_swapped_v1'), 'true');

    const serialized = Selector.extractSerializableWorld(Service.state);
    assert.equal('railsSwapped' in serialized, false, 'railsSwapped must stay local and never serialize into world');

    Service.railsSwapped = false;
    assert.equal(Service.loadRailsSwapped(), true);

    assert.equal(Service.setRailsSwapped(false), false);
    assert.equal(Service.loadRailsSwapped(), false);
  } finally {
    RealtimeBridge.send = origSend;
    globalThis.localStorage = prevStorage;
  }
});
