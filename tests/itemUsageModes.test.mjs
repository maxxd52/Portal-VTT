import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

if (!globalThis.window) {
  globalThis.window = { location: { search: '' }, innerWidth: 1280, innerHeight: 720 };
}

const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { normalizeItemUsage } = await import('../js/utils/tokenTemplateSync.js?v=20261125a1');

function setupToken() {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  const tok = {
    id: 'tok-u1',
    name: 'Tester',
    isAlly: true,
    x: 400,
    y: 400,
    hp: 10,
    maxHp: 20,
    ac: 14,
    stats: { vig: 2, agi: 1, men: 0 },
    inventory: []
  };
  Service.state.tokens = [tok];
  return tok;
}

test('normalizeItemUsage handles permanent, consumable, charges, clamping, and legacy fallback', () => {
  assert.equal(typeof normalizeItemUsage, 'function');
  assert.deepEqual(normalizeItemUsage({}), { usageMode: 'permanent', maxUses: 0 });
  assert.deepEqual(normalizeItemUsage({ usageMode: 'permanent', maxUses: 5 }), { usageMode: 'permanent', maxUses: 0 });
  assert.deepEqual(normalizeItemUsage({ usageMode: 'consumable' }), { usageMode: 'consumable', maxUses: 1 });
  assert.deepEqual(normalizeItemUsage({ usageMode: 'consumable', maxUses: 2000 }), { usageMode: 'consumable', maxUses: 999 });
  assert.deepEqual(normalizeItemUsage({ usageMode: 'charges' }), { usageMode: 'charges', maxUses: 3 });
  assert.deepEqual(normalizeItemUsage({ usageMode: 'charges', maxUses: 4 }), { usageMode: 'charges', maxUses: 4 });
  assert.deepEqual(normalizeItemUsage({ kind: 'consumable' }), { usageMode: 'consumable', maxUses: 1 });
  assert.deepEqual(normalizeItemUsage({ kind: 'consumable', usageMode: 'permanent' }), { usageMode: 'permanent', maxUses: 0 });
});

test('saveCustomItem, duplicateCustomItem, and equipItemToToken persist usageMode and maxUses', () => {
  setupToken();
  const perm = Service.saveCustomItem({ name: 'Espada', kind: 'equipment', usageMode: 'permanent', formula: '1d8' });
  const usesItem = Service.saveCustomItem({ name: 'Poción', kind: 'consumable', usageMode: 'consumable', maxUses: 2, message: 'Cura' });
  const chargesItem = Service.saveCustomItem({ name: 'Varita', kind: 'equipment', usageMode: 'charges', maxUses: 4, message: 'Rayo' });

  assert.equal(perm.usageMode, 'permanent');
  assert.equal(perm.maxUses, 0);
  assert.equal(usesItem.usageMode, 'consumable');
  assert.equal(usesItem.maxUses, 2);
  assert.equal(chargesItem.usageMode, 'charges');
  assert.equal(chargesItem.maxUses, 4);

  const dup = Service.duplicateCustomItem(chargesItem.key);
  assert.equal(dup.usageMode, 'charges');
  assert.equal(dup.maxUses, 4);

  const eqPerm = Service.equipItemToToken('tok-u1', perm);
  const eqUses = Service.equipItemToToken('tok-u1', usesItem);
  const eqCharges = Service.equipItemToToken('tok-u1', chargesItem);
  assert.equal(eqPerm.item.usageMode, 'permanent');
  assert.equal(eqPerm.item.uses, undefined);
  assert.equal(eqUses.item.uses, 2);
  assert.equal(eqCharges.item.uses, 4);
});

test('useTokenInventoryItem decrements uses, removes depleted consumables, blocks 0-charge items, and supports legacy consumables', () => {
  const tok = setupToken();
  const perm = Service.equipItemToToken('tok-u1', {
    key: 'perm-1',
    name: 'Daga',
    kind: 'equipment',
    usageMode: 'permanent',
    message: 'Corte rápido'
  }).item;

  const potion = Service.equipItemToToken('tok-u1', {
    key: 'pot-1',
    name: 'Elixir',
    kind: 'equipment',
    usageMode: 'consumable',
    maxUses: 2,
    passives: [{ target: 'ac', value: 1 }],
    message: 'Refresca'
  }).item;
  assert.equal(tok.ac, 15);

  const wand = Service.equipItemToToken('tok-u1', {
    key: 'wand-1',
    name: 'Varita',
    kind: 'equipment',
    usageMode: 'charges',
    maxUses: 2,
    message: 'Chispa'
  }).item;

  const legacy = Service.equipItemToToken('tok-u1', {
    key: 'leg-1',
    name: 'Poción vieja',
    kind: 'consumable',
    heal: 5
  }).item;

  // Permanent stays unchanged
  Service.useTokenInventoryItem('tok-u1', perm.uid);
  assert.ok(tok.inventory.some((i) => i.uid === perm.uid));

  // Consumable (2 uses): 1st use -> 1, 2nd use -> removed + passive reversed
  Service.useTokenInventoryItem('tok-u1', potion.uid);
  assert.equal(tok.inventory.find((i) => i.uid === potion.uid)?.uses, 1);
  assert.equal(tok.ac, 15);
  Service.useTokenInventoryItem('tok-u1', potion.uid);
  assert.equal(tok.inventory.some((i) => i.uid === potion.uid), false);
  assert.equal(tok.ac, 14);

  // Charges (2 max): 1st -> 1/2, 2nd -> 0/2 (kept), 3rd -> blocked message
  Service.useTokenInventoryItem('tok-u1', wand.uid);
  assert.equal(tok.inventory.find((i) => i.uid === wand.uid)?.uses, 1);
  Service.useTokenInventoryItem('tok-u1', wand.uid);
  assert.equal(tok.inventory.find((i) => i.uid === wand.uid)?.uses, 0);
  const blockedMsg = Service.useTokenInventoryItem('tok-u1', wand.uid);
  assert.equal(blockedMsg, 'Varita sin cargas (0/2).');

  // Legacy consumable heals and removes
  Service.useTokenInventoryItem('tok-u1', legacy.uid);
  assert.equal(tok.hp, 15);
  assert.equal(tok.inventory.some((i) => i.uid === legacy.uid), false);
});

test('adjustTokenItemUses and rechargeTokenItem update and clamp uses cleanly', () => {
  const tok = setupToken();
  const wand = Service.equipItemToToken('tok-u1', {
    key: 'wand-2',
    name: 'Báculo',
    kind: 'equipment',
    usageMode: 'charges',
    maxUses: 3,
    message: 'Luz'
  }).item;

  Service.adjustTokenItemUses('tok-u1', wand.uid, -2);
  assert.equal(tok.inventory.find((i) => i.uid === wand.uid)?.uses, 1);
  Service.adjustTokenItemUses('tok-u1', wand.uid, -5);
  assert.equal(tok.inventory.find((i) => i.uid === wand.uid)?.uses, 0);
  Service.rechargeTokenItem('tok-u1', wand.uid);
  assert.equal(tok.inventory.find((i) => i.uid === wand.uid)?.uses, 3);

  const bomb = Service.equipItemToToken('tok-u1', {
    key: 'bomb-1',
    name: 'Bomba',
    kind: 'consumable',
    usageMode: 'consumable',
    maxUses: 2,
    message: 'Boom'
  }).item;
  Service.adjustTokenItemUses('tok-u1', bomb.uid, -2);
  assert.equal(tok.inventory.some((i) => i.uid === bomb.uid), false);
});

test('index.html and sheetInventoryView.js wire 3-way usage selector and inventory pills/recharge', () => {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  assert.match(html, /id="customItemUsageSeg"/);
  assert.match(html, /data-item-usage="permanent"/);
  assert.match(html, /data-item-usage="consumable"/);
  assert.match(html, /data-item-usage="charges"/);
  assert.match(html, /id="inpCustomItemMaxUses"/);

  const invSrc = readFileSync(path.resolve('js/ui/sheetInventoryView.js'), 'utf8');
  assert.match(invSrc, /normalizeItemUsage/);
  assert.match(invSrc, /rechargeTokenItem/);
  assert.match(invSrc, /adjustTokenItemUses/);
});
