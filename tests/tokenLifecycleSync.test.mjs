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
const { Service } = await import('../js/core/service.js?v=20261123a7');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261123a7');

function setupGmState() {
  Service.listeners = [];
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.tokens = [];
  Service.state.customActors = [];
  Service.state.customItems = [];
  return Service.state;
}

test('S1: saveCustomActor & spawnActorFromTemplate support size 1..4, vision/light, dynamic stats, and custom starterItems', async () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    setupGmState();

    const customAxe = Service.saveCustomItem({
      name: 'Hacha Rúnica',
      kind: 'equipment',
      formula: '1d12+@str',
      icon: 'sword',
      color: '#ef4444'
    });

    const tpl = Service.saveCustomActor({
      name: 'Ogro Chamán',
      role: 'Bruto',
      isAlly: false,
      size: 3,
      hp: 48,
      ac: 14,
      visionMeters: 18,
      lightMeters: 6,
      stats: { str: 4, dex: -1, con: 3, vig: 5 },
      starterItems: [customAxe.key, 'longsword']
    });

    assert.equal(tpl.size, 3);
    assert.equal(tpl.visionMeters, 18);
    assert.equal(tpl.lightMeters, 6);
    assert.equal(tpl.stats.vig, 5);
    assert.deepEqual(tpl.starterItems, [customAxe.key, 'longsword']);

    const tok = await Service.spawnActorFromTemplate(tpl, 400, 400);
    assert.equal(tok.size, 3);
    assert.equal(tok.visionMeters, 18);
    assert.equal(tok.lightMeters, 6);
    assert.equal(tok.inventory.length, 2, 'Both custom and built-in starter items must spawn into inventory');
    assert.equal(tok.inventory[0].name, 'Hacha Rúnica');
    assert.equal(tok.inventory[0].formula, '1d12+@str');
    assert.equal(tok.inventory[1].key, 'longsword');

    // Direct setTokenSize clamped to 1..4
    assert.equal(Service.setTokenSize(tok.id, 4), 4);
    assert.equal(tok.size, 4);
    assert.equal(Service.setTokenSize(tok.id, 99), 4);
    assert.equal(Service.setTokenSize(tok.id, 0), 1);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S1: Protagonist (isAlly=true) auto-syncs live changes to Baúl, avoids duplicates on re-drop, and restores state on re-spawn', async () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = setupGmState();

    const heroTpl = Service.saveCustomActor({
      name: 'Aragorn',
      role: 'Montaraz',
      isAlly: true,
      size: 1,
      hp: 30,
      ac: 16,
      stats: { str: 3, dex: 2, con: 2, int: 1, wis: 2, cha: 1 }
    });

    const hero = await Service.spawnActorFromTemplate(heroTpl, 320, 320);
    assert.equal(state.tokens.length, 1);
    assert.equal(hero.hp, 30);
    assert.equal(hero.maxHp, 30);

    // Live mutations in play auto-sync HP/skills/inventory back to Baúl,
    // while circumstantial size/light/vision overrides stay temporary on the live token
    Service.adjustTokenHp(hero.id, -9);
    Service.setTokenSize(hero.id, 2);
    Service.setTokenLight(hero.id, 12);
    Service.setTokenVision(hero.id, 30);
    Service.addTokenSkill(hero.id, 'Supervivencia', 5);
    Service.equipItemToToken(hero.id, {
      key: 'anduril',
      name: 'Andúril',
      kind: 'weapon',
      formula: '1d10+3',
      badge: '1d10+3'
    });

    const syncedActor = state.customActors.find((a) => a.key === heroTpl.key);
    assert.equal(syncedActor.hp, 21, 'Damaged HP must persist to linked Protagonist in Baúl');
    assert.equal(syncedActor.maxHp, 30);
    assert.equal(syncedActor.size, 1, 'Temporary board size must NOT overwrite permanent Baúl template');
    assert.equal(syncedActor.lightMeters, 0, 'Temporary board light must NOT overwrite permanent Baúl template');
    assert.equal(syncedActor.visionMeters, null, 'Temporary board vision must NOT overwrite permanent Baúl template');
    assert.equal(hero.size, 2);
    assert.equal(hero.lightMeters, 12);
    assert.equal(hero.visionMeters, 30);
    assert.equal(syncedActor.skills.length, 1);
    assert.equal(syncedActor.skills[0].name, 'Supervivencia');
    assert.equal(syncedActor.inventory.length, 1);
    assert.equal(syncedActor.inventory[0].name, 'Andúril');

    // Resetting temporary props restores permanent Baúl values on live token
    assert.equal(typeof Service.resetTokenTempProps, 'function', 'Service.resetTokenTempProps must exist');
    Service.resetTokenTempProps(hero.id);
    assert.equal(hero.size, 1);
    assert.equal(hero.lightMeters, 0);
    assert.equal(hero.visionMeters, null);

    // Dropping the same Protagonist on the current scene moves it instead of cloning
    const moved = await Service.spawnActorFromTemplate(syncedActor, 640, 480);
    assert.equal(state.tokens.length, 1, 'Protagonist must not duplicate on the same scene');
    assert.equal(moved.id, hero.id);
    assert.notEqual(moved.x, 320);

    // Editing Protagonist in Baúl updates live token AND preserves skills/inventory
    Service.saveCustomActor({
      key: heroTpl.key,
      name: 'Aragorn II',
      role: 'Rey',
      isAlly: true,
      size: 1,
      hp: 36,
      ac: 18,
      stats: { str: 4, dex: 2, con: 2, int: 1, wis: 2, cha: 2 }
    });
    assert.equal(hero.name, 'Aragorn II');
    assert.equal(hero.ac, 18);
    assert.equal(hero.size, 1);
    assert.equal(hero.maxHp, 36);
    assert.equal(hero.skills.length, 1, 'Editing Baúl template must not wipe live skills');
    assert.equal(hero.inventory.length, 1, 'Editing Baúl template must not wipe live inventory');

    // Removing from scene and re-spawning later restores persisted state (HP, inventory, skills)
    Service.adjustTokenHp(hero.id, -4); // current HP drops by 4
    const hpBeforeDelete = hero.hp;
    Service.deleteToken(hero.id);
    assert.equal(state.tokens.length, 0);

    const respawned = await Service.spawnActorFromTemplate(
      state.customActors.find((a) => a.key === heroTpl.key),
      400,
      400
    );
    assert.equal(state.tokens.length, 1);
    assert.equal(respawned.hp, hpBeforeDelete, 'Re-spawned Protagonist must keep damaged HP');
    assert.equal(respawned.maxHp, 36);
    assert.equal(respawned.inventory.length, 1);
    assert.equal(respawned.skills.length, 1);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S1: Secondary (isAlly=false) stays an immutable mold and spawns independent auto-numbered instances', async () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = setupGmState();

    const goblinTpl = Service.saveCustomActor({
      name: 'Goblin',
      role: 'Hostigador',
      isAlly: false,
      size: 1,
      hp: 12,
      ac: 13,
      starterItems: ['scimitar']
    });

    const g1 = await Service.spawnActorFromTemplate(goblinTpl, 240, 240);
    const g2 = await Service.spawnActorFromTemplate(goblinTpl, 320, 240);

    assert.equal(state.tokens.length, 2);
    assert.notEqual(g1.id, g2.id);
    assert.equal(g1.name, 'Goblin');
    assert.equal(g2.name, 'Goblin 2');

    // Mutate g1 heavily
    Service.adjustTokenHp(g1.id, -7);
    Service.setTokenSize(g1.id, 2);
    Service.toggleTokenCondition(g1.id, 'poison');
    Service.equipItemToToken(g1.id, { key: 'loot_ring', name: 'Anillo', kind: 'equipment', badge: '+1' });

    // g2 and Baúl template must remain untouched
    assert.equal(g2.hp, 12);
    assert.equal(g2.size, 1);
    assert.equal(g2.inventory.length, 1);
    const mold = state.customActors.find((a) => a.key === goblinTpl.key);
    assert.equal(mold.hp, 12);
    assert.equal(mold.size, 1);
    assert.equal(mold.inventory, undefined);

    // Editing Secondary mold does NOT mutate active g1/g2, only new spawns
    Service.saveCustomActor({
      key: goblinTpl.key,
      name: 'Goblin',
      role: 'Élite',
      isAlly: false,
      size: 2,
      hp: 24,
      ac: 15,
      starterItems: ['scimitar']
    });
    assert.equal(g1.hp, 5, 'Active combat instance g1 must keep its current HP');
    assert.equal(g2.hp, 12, 'Active combat instance g2 must keep its current HP');
    assert.equal(g2.size, 1, 'Active combat instance g2 must keep its current size');

    const g3 = await Service.spawnActorFromTemplate(
      state.customActors.find((a) => a.key === goblinTpl.key),
      400,
      240
    );
    assert.equal(g3.name, 'Goblin 3');
    assert.equal(g3.hp, 24);
    assert.equal(g3.maxHp, 24);
    assert.equal(g3.size, 2);
    assert.equal(g3.conditions?.length || 0, 0);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S1: saveTokenToVault snapshots customized Secondary as healthy mold and links unlinked Protagonist', async () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = setupGmState();

    // 1. Secondary customized on board (wounded) -> saved as healthy template
    const secTpl = Service.saveCustomActor({
      name: 'Orco',
      role: 'Guerrero',
      isAlly: false,
      size: 1,
      hp: 15,
      ac: 13
    });
    const orco = await Service.spawnActorFromTemplate(secTpl, 300, 300);
    orco.maxHp = 28;
    orco.hp = 9; // wounded mid-fight
    Service.setTokenSize(orco.id, 2);
    Service.setTokenVision(orco.id, 15);
    Service.equipItemToToken(orco.id, { key: 'great_axe', name: 'Gran Hacha', kind: 'weapon', formula: '1d12+3', badge: '1d12+3' });

    const savedSec = Service.saveTokenToVault(orco.id);
    assert.equal(savedSec.key, secTpl.key, 'Updates linked Secondary mold cleanly');
    assert.equal(savedSec.hp, 28, 'Secondary mold must save full maxHp so future spawns start healthy');
    assert.equal(savedSec.maxHp, 28);
    assert.equal(savedSec.size, 2);
    assert.equal(savedSec.visionMeters, 15);
    assert.equal(savedSec.inventory.length, 1);
    assert.equal(savedSec.inventory[0].name, 'Gran Hacha');

    const freshOrco = await Service.spawnActorFromTemplate(savedSec, 500, 300);
    assert.equal(freshOrco.hp, 28);
    assert.equal(freshOrco.size, 2);
    assert.equal(freshOrco.inventory.length, 1);
    assert.notEqual(freshOrco.inventory[0].uid, orco.inventory[0].uid, 'Cloned inventory entries must get independent UIDs');

    // 2. Unlinked Protagonist (built-in) -> saveTokenToVault links it so future HP edits auto-sync
    const looseHero = {
      id: 'tok-loose-hero',
      actorKey: '',
      name: 'Lyra',
      role: 'Maga',
      color: '#3b82f6',
      isAlly: true,
      size: 1,
      x: 400,
      y: 400,
      hp: 14,
      maxHp: 20,
      ac: 12,
      stats: { int: 4 },
      inventory: []
    };
    state.tokens.push(looseHero);

    const savedHero = Service.saveTokenToVault(looseHero.id);
    assert.ok(savedHero.key);
    assert.equal(looseHero.actorKey, savedHero.key);
    assert.equal(savedHero.hp, 14, 'Protagonist preserves live current HP when saved to Baúl');
    assert.equal(savedHero.maxHp, 20);

    Service.adjustTokenHp(looseHero.id, -3);
    assert.equal(state.customActors.find((a) => a.key === savedHero.key).hp, 11);

    // 3. Player cannot saveTokenToVault
    state.role = 'player';
    state.isHostGm = false;
    assert.equal(Service.saveTokenToVault(looseHero.id), null);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S2: index.html keeps permanent size/vision/light in Baúl form and removes redundant token-property rows from Character Sheet', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.match(html, /id="customTokenSizeSeg"/, 'Baúl actor form must include size segmented selector');
  assert.match(html, /id="customTokenStarterItems"/, 'Baúl actor form must include starter items chips container');
  assert.match(html, /id="btnToggleCustomTokenItemsPicker"/, 'Baúl actor form must include folder-searchable starter item picker');
  assert.match(html, /id="customTokenDetailsToggle"/, 'Baúl actor form must keep secondary details progressively disclosed');
  assert.match(html, /id="inpCustomTokenVision"/, 'Baúl actor form must allow setting token vision');
  assert.match(html, /id="inpCustomTokenLight"/, 'Baúl actor form must allow setting initial light');
  assert.doesNotMatch(html, /id="sheetVisionLightRow"/, 'Character Sheet must stay clean without permanent Vision/Light row');
  assert.doesNotMatch(html, /id="sheetTokenPresenceRow"/, 'Character Sheet must stay clean without permanent Size/Linked row');
  assert.doesNotMatch(html, /id="badgeSheetVaultLinked"/, 'Character Sheet must not show redundant Vinculado badge');
});
