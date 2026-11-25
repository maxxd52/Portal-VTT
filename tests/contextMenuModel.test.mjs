import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  computeContextMenuPosition,
  resolveDiceBarContextAction,
  buildDiceDieMenuSpec,
  buildDiceBarMenuSpec,
  buildMapMenuSpec,
  buildTokenMenuSpec,
  buildMultiTokenMenuSpec,
  buildWallMenuSpec,
  parseHpInputExpression,
  stepPresetValue,
  shouldAllowNativeContextMenu
} from '../js/utils/contextMenuModel.js?v=20261125a1';
import { renderUiLineIcon, hasUiLineIcon } from '../js/utils/uiIcons.js?v=20261125a1';

const flattenIds = (spec) => {
  const ids = [];
  if (Array.isArray(spec.quickActions)) {
    for (const q of spec.quickActions) ids.push(q.id);
  }
  if (Array.isArray(spec.sections)) {
    for (const sec of spec.sections) {
      for (const item of sec) ids.push(item.id);
    }
  }
  return ids;
};

test('computeContextMenuPosition opens down-right when space permits and flips upward near bottom dock', () => {
  const normal = computeContextMenuPosition({
    clientX: 300,
    clientY: 200,
    menuWidth: 240,
    menuHeight: 180,
    viewportWidth: 1280,
    viewportHeight: 800,
    scale: 1
  });
  assert.equal(normal.left, 300);
  assert.equal(normal.top, 200);
  assert.equal(normal.origin, 'top left');

  const nearBottom = computeContextMenuPosition({
    clientX: 600,
    clientY: 760,
    menuWidth: 240,
    menuHeight: 200,
    viewportWidth: 1280,
    viewportHeight: 800,
    scale: 1
  });
  assert.equal(nearBottom.top, 554); // 760 - 200 - 6 gap
  assert.equal(nearBottom.origin, 'bottom left');

  const nearBottomRightScaled = computeContextMenuPosition({
    clientX: 1240,
    clientY: 780,
    menuWidth: 240,
    menuHeight: 200,
    viewportWidth: 1280,
    viewportHeight: 800,
    scale: 1
  });
  assert.ok(nearBottomRightScaled.left <= 1280 - 240 - 8);
  assert.equal(nearBottomRightScaled.origin, 'bottom right');
});

test('resolveDiceBarContextAction removes die if present in hand, opens die menu if absent, or bar menu otherwise', () => {
  assert.deepEqual(resolveDiceBarContextAction(20, [6, 20]), { kind: 'remove-from-hand', die: 20 });
  assert.deepEqual(resolveDiceBarContextAction(20, [6]), { kind: 'die-menu', die: 20 });
  assert.deepEqual(resolveDiceBarContextAction(20, []), { kind: 'die-menu', die: 20 });
  assert.deepEqual(resolveDiceBarContextAction('fudge', ['fudge']), { kind: 'remove-from-hand', die: 'fudge' });
  assert.deepEqual(resolveDiceBarContextAction('card', []), { kind: 'die-menu', die: 'card' });
  assert.deepEqual(resolveDiceBarContextAction(null, [20]), { kind: 'bar-menu' });
});

test('buildDiceDieMenuSpec builds tailored actions for numeric dice, coin, fudge, and deck', () => {
  const d20 = buildDiceDieMenuSpec(20, { modifier: 3 });
  assert.deepEqual(flattenIds(d20), ['roll-now', 'roll-adv', 'roll-dis', 'add-two']);

  const coin = buildDiceDieMenuSpec(2, { modifier: 0 });
  assert.deepEqual(flattenIds(coin), ['roll-coin', 'add-two']);

  const fudge = buildDiceDieMenuSpec('fudge', { modifier: 0 });
  assert.deepEqual(flattenIds(fudge), ['roll-fudge-4', 'add-one']);

  const deck = buildDiceDieMenuSpec('card', { deckRemaining: 48 });
  assert.deepEqual(flattenIds(deck), ['draw-card', 'shuffle-deck']);
});

test('buildDiceBarMenuSpec adapts to hand, modifier, visibility, and history state', () => {
  const emptySpec = buildDiceBarMenuSpec({
    hand: [],
    modifier: 0,
    visibility: 'public',
    historyCount: 0
  });
  const emptyIds = flattenIds(emptySpec);
  assert.ok(!emptyIds.includes('clear-hand'));
  assert.ok(!emptyIds.includes('reset-mod'));
  assert.ok(!emptyIds.includes('clear-history'));
  const pubItem = emptySpec.sections.flat().find((i) => i.id === 'vis-public');
  const privItem = emptySpec.sections.flat().find((i) => i.id === 'vis-private');
  assert.equal(pubItem.checked, true);
  assert.equal(privItem.checked, false);

  const activeSpec = buildDiceBarMenuSpec({
    hand: [20, 6],
    modifier: 4,
    visibility: 'private',
    historyCount: 5
  });
  const activeIds = flattenIds(activeSpec);
  assert.ok(activeIds.includes('clear-hand'));
  assert.ok(activeIds.includes('reset-mod'));
  assert.ok(activeIds.includes('clear-history'));
  const clearHist = activeSpec.sections.at(-1).find((i) => i.id === 'clear-history');
  assert.equal(clearHist.danger, true);
});

test('buildMapMenuSpec enforces strict player zero-leak and separates GM tools', () => {
  const playerSpec = buildMapMenuSpec({ role: 'player', hasOwnedToken: true });
  const playerIds = flattenIds(playerSpec);
  assert.deepEqual(playerIds, ['ping-here', 'measure-here', 'focus-my-token', 'reset-zoom']);
  assert.equal(playerSpec.showToolsRow, false);

  const gmSpec = buildMapMenuSpec({ role: 'gm', dynamicLighting: true });
  const gmIds = flattenIds(gmSpec);
  assert.equal(gmSpec.showToolsRow, true);
  assert.ok(gmIds.includes('ping-here'));
  assert.ok(gmIds.includes('add-note'));
  assert.ok(!gmIds.includes('spawn-here'));
  assert.ok(gmIds.includes('toggle-dynlight'));
  assert.ok(gmIds.includes('open-grid'));
  const dyn = gmSpec.sections.flat().find((i) => i.id === 'toggle-dynlight');
  assert.equal(dyn.checked, true);
});

test('buildTokenMenuSpec prunes owner/ally/init, hides duplicate for Protagonists, and keeps Secondary/GM actions clean', () => {
  const protag = {
    id: 'tok-1',
    name: 'Aelar',
    hp: 18,
    maxHp: 24,
    ac: 15,
    color: '#8b5cf6',
    size: 1,
    isAlly: true,
    hidden: false,
    ownerId: 'seat-1',
    auraRadius: 0
  };
  const enemy = { ...protag, id: 'tok-2', name: 'Orco', isAlly: false };

  const playerSpec = buildTokenMenuSpec({ role: 'player', token: protag });
  const pIds = flattenIds(playerSpec);
  assert.ok(pIds.includes('open-sheet'));
  assert.ok(!pIds.includes('init'), 'Initiative belongs in Combat Tracker, not token menu');
  assert.ok(!pIds.includes('owner'), 'Owner belongs in Room/Baúl, not token menu');
  assert.ok(!pIds.includes('ally'), 'Category belongs in Baúl, not token menu');
  assert.ok(!pIds.includes('toggle-hide'));
  assert.ok(!pIds.includes('dup-tok'));
  assert.ok(!pIds.includes('del-tok'));

  const gmProtagSpec = buildTokenMenuSpec({ role: 'gm', token: protag });
  const gpIds = flattenIds(gmProtagSpec);
  assert.ok(gpIds.includes('toggle-hide'));
  assert.ok(!gpIds.includes('dup-tok'), 'Protagonists are unique and must NOT show Duplicate');
  assert.ok(!gpIds.includes('init'));
  assert.ok(!gpIds.includes('owner'));
  assert.ok(!gpIds.includes('ally'));
  assert.ok(gpIds.includes('del-tok'));

  const gmEnemySpec = buildTokenMenuSpec({ role: 'gm', token: enemy });
  const geIds = flattenIds(gmEnemySpec);
  assert.ok(geIds.includes('dup-tok'), 'Secondaries MUST still allow Duplicate for GM');
  const lastSection = gmEnemySpec.sections.at(-1);
  assert.equal(lastSection.length, 1);
  assert.equal(lastSection[0].id, 'del-tok');
  assert.equal(lastSection[0].danger, true);
});

test('parseHpInputExpression and stepPresetValue handle relative/absolute HP and stepper bounds cleanly', () => {
  assert.equal(parseHpInputExpression('-7', 16, 20), 9);
  assert.equal(parseHpInputExpression('+10', 16, 20), 20);
  assert.equal(parseHpInputExpression('-99', 16, 20), 0);
  assert.equal(parseHpInputExpression('12', 16, 20), 12);
  assert.equal(parseHpInputExpression('', 16, 20), null);
  assert.equal(parseHpInputExpression('abc', 16, 20), null);

  const lightSteps = [0, 3, 6, 9, 12, 18, 24];
  assert.equal(stepPresetValue(0, lightSteps, 1), 3);
  assert.equal(stepPresetValue(0, lightSteps, -1), 0);
  assert.equal(stepPresetValue(24, lightSteps, 1), 24);
  assert.equal(stepPresetValue(7, lightSteps, 1), 9, 'Non-preset value steps to next higher preset');
  assert.equal(stepPresetValue(7, lightSteps, -1), 6, 'Non-preset value steps to next lower preset');

  const visSteps = [null, 0, 3, 6, 9, 12, 18, 24, 36];
  assert.equal(stepPresetValue(null, visSteps, 1), 0);
  assert.equal(stepPresetValue(0, visSteps, -1), null);
});

test('shouldAllowNativeContextMenu allows text inputs and contenteditable, blocks normal UI chrome', () => {
  assert.equal(shouldAllowNativeContextMenu({ tagName: 'INPUT', isContentEditable: false }), true);
  assert.equal(shouldAllowNativeContextMenu({ tagName: 'TEXTAREA', isContentEditable: false }), true);
  assert.equal(shouldAllowNativeContextMenu({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(shouldAllowNativeContextMenu({ tagName: 'BUTTON', isContentEditable: false }), false);
  assert.equal(shouldAllowNativeContextMenu({ tagName: 'CANVAS', isContentEditable: false }), false);
  assert.equal(shouldAllowNativeContextMenu(null), false);
});

test('buildWallMenuSpec handles single door and batch multi-wall selection cleanly', () => {
  const singleDoor = buildWallMenuSpec([{ id: 'w1', kind: 'wall', door: 'normal', open: false }]);
  assert.equal(singleDoor.header.title, 'Puerta');
  const doorIds = flattenIds(singleDoor);
  assert.ok(doorIds.includes('kind-wall'));
  assert.ok(doorIds.includes('kind-terrain'));
  assert.ok(doorIds.includes('door-none'));
  assert.ok(doorIds.includes('door-normal'));
  assert.ok(doorIds.includes('door-secret'));
  assert.ok(doorIds.includes('toggle-open'));
  assert.ok(doorIds.includes('delete-walls'));
  assert.equal(singleDoor.sections.flat().find((i) => i.id === 'kind-wall').checked, true);
  assert.equal(singleDoor.sections.flat().find((i) => i.id === 'door-normal').checked, true);

  const multiMixed = buildWallMenuSpec([
    { id: 'w1', kind: 'wall', door: 'none', open: false },
    { id: 'w2', kind: 'terrain', door: 'normal', open: false },
    { id: 'w3', kind: 'wall', door: 'none', open: false }
  ]);
  assert.equal(multiMixed.header.title, '3 muros seleccionados');
  const multiIds = flattenIds(multiMixed);
  assert.ok(!multiIds.includes('toggle-open'));
  assert.equal(multiMixed.sections.flat().some((i) => i.checked), false);
  const del = multiMixed.sections.at(-1)[0];
  assert.equal(del.id, 'delete-walls');
  assert.equal(del.danger, true);
  assert.ok(del.label.includes('3'));
});

test('all context menu specs use canonical monochrome line icon keys from uiIcons.js (zero raw OS emojis)', () => {
  const specs = [
    buildTokenMenuSpec({ role: 'gm', token: { id: 't1', isAlly: false, hidden: false } }),
    buildTokenMenuSpec({ role: 'gm', token: { id: 't2', isAlly: true, hidden: true } }),
    buildMultiTokenMenuSpec({ role: 'gm', tokens: [{ id: 't1', hidden: false }, { id: 't2', hidden: false }] }),
    buildMapMenuSpec({ role: 'gm', dynamicLighting: true }),
    buildMapMenuSpec({ role: 'player', hasOwnedToken: true }),
    buildWallMenuSpec([{ id: 'w1', kind: 'door', open: false, locked: true }]),
    buildWallMenuSpec([{ id: 'w2', kind: 'wall', open: false }]),
    buildDiceDieMenuSpec(20, { modifier: 2 }),
    buildDiceDieMenuSpec(2),
    buildDiceDieMenuSpec('fudge'),
    buildDiceDieMenuSpec('card'),
    buildDiceBarMenuSpec({ hand: ['20'], modifier: 1, visibility: 'private', historyCount: 2 })
  ];

  for (const spec of specs) {
    for (const section of spec.sections || []) {
      for (const item of section) {
        assert.equal(hasUiLineIcon(item.icon), true, `Item "${item.id}" must use a canonical uiIcons key, got "${item.icon}"`);
        const svg = renderUiLineIcon(item.icon);
        assert.ok(svg.includes('<svg') && svg.includes('fill="none"') && svg.includes('stroke="currentColor"'), `Icon "${item.icon}" must render a stroke SVG`);
      }
    }
  }
});

test('all list context menus in compendiumView, sheetInventoryView, and sheetView use canonical uiIcons keys', () => {
  const files = [
    'js/ui/compendiumView.js',
    'js/ui/sheetInventoryView.js',
    'js/ui/sheetView.js'
  ];
  for (const rel of files) {
    const src = fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
    const matches = [...src.matchAll(/icon:\s*'([^']+)'/g)];
    assert.ok(matches.length > 0, `${rel} must define at least one context menu icon`);
    for (const m of matches) {
      assert.equal(hasUiLineIcon(m[1]), true, `${rel} uses non-canonical icon "${m[1]}"`);
    }
  }
});
