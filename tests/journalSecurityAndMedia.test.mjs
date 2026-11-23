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

const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { Selector } = await import('../js/core/selector.js?v=20261123a7');
const { Service } = await import('../js/core/service.js?v=20261123a7');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261123a7');
const { CartridgePacker } = await import('../js/services/cartridgePacker.js?v=20261123a7');
const { WebPConverter } = await import('../js/utils/webpConverter.js?v=20261123a7');
const {
  collectPlayerAuthorizedMedia,
  redactTokenForNonOwner
} = await import('../js/utils/worldRedaction.js?v=20261123a7');

function resetGmForTest() {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.undoStack = [];
  Service.redoStack = [];
  Service.peers = new Map();
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  return Service.state;
}

test('S1: extractWorldForSeat keeps full sheet for seat owner and redacts private fields from non-owned tokens', () => {
  const state = resetGmForTest();
  state.playerInvites = [
    { id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] },
    { id: 'inv-2', label: 'P2', tokenIds: ['tok-2'] }
  ];
  const hero = state.tokens.find((t) => t.id === 'tok-1');
  hero.publicDescription = 'Paladín de coraza plateada';
  hero.privateNotes = 'Juramento secreto';

  const ally2 = state.tokens.find((t) => t.id === 'tok-2');
  ally2.publicDescription = 'Maga de túnica violeta';
  ally2.privateNotes = 'Espía del gremio';

  const enemy = state.tokens.find((t) => t.id === 'tok-4');
  enemy.hp = 5;
  enemy.maxHp = 10;
  enemy.ac = 17;
  enemy.publicDescription = 'Trasgo tuerto con cicatriz';
  enemy.privateNotes = 'Tiene la llave de la celda';
  enemy.skills = [{ id: 'sk-1', name: 'Sigilo', mod: 6, prof: 1 }];
  enemy.traits = [{ id: 'tr-1', title: 'Emboscada', desc: '+2d6 daño' }];
  enemy.inventory.push({ uid: 'torch-1', name: 'Antorcha', lightMeters: 6 });

  state.notes = [
    { id: 'n-pub', sceneKey: 'bastion', x: 100, y: 100, title: 'Altar', body: 'Runas antiguas', gmOnly: false },
    { id: 'n-gm', sceneKey: 'bastion', x: 200, y: 200, title: 'Trampa oculta', body: 'CD 16', gmOnly: true }
  ];
  state.customActors = [{ key: 'secret-boss', name: 'Boss Secreto', imageUrl: 'data:image/webp;base64,SECRET' }];

  const p1World = Selector.extractWorldForSeat(state, 'inv-1');

  const p1Hero = p1World.tokens.find((t) => t.id === 'tok-1');
  assert.equal(p1Hero._redacted, undefined);
  assert.equal(p1Hero.privateNotes, 'Juramento secreto');
  assert.equal(p1Hero.hp, 24);
  assert.ok(p1Hero.inventory.length > 0);

  const p1Enemy = p1World.tokens.find((t) => t.id === 'tok-4');
  assert.equal(p1Enemy._redacted, true);
  assert.equal(p1Enemy.name, 'Acechador Trasgo');
  assert.equal(p1Enemy.publicDescription, 'Trasgo tuerto con cicatriz');
  assert.equal(p1Enemy.hpPct, 50);
  assert.equal(p1Enemy.defeated, false);
  assert.equal(p1Enemy.lightMeters, 6, 'Precomputed lightMeters preserves torch light after stripping inventory');
  for (const forbidden of ['stats', 'scores', 'saveProfs', 'skills', 'traits', 'inventory', 'resources', 'texts', 'ac', 'level', 'speed', 'privateNotes', 'hp', 'maxHp', 'role', 'ownerId']) {
    assert.equal(forbidden in p1Enemy, false, `Enemy token must omit ${forbidden}`);
  }

  const p1Ally2 = p1World.tokens.find((t) => t.id === 'tok-2');
  assert.equal(p1Ally2._redacted, true);
  assert.equal('privateNotes' in p1Ally2, false);
  assert.equal('inventory' in p1Ally2, false);

  assert.equal(p1World.notes.length, 1);
  assert.equal(p1World.notes[0].id, 'n-pub');
  assert.deepEqual(p1World.customActors, []);
});

test('S1: applyPlayerTokensSync updates only seat-owned tokens and redacted WORLD_SYNC never clobbers GM private fields', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};
  try {
    const state = resetGmForTest();
    state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] }];
    const enemy = state.tokens.find((t) => t.id === 'tok-4');
    enemy.privateNotes = 'Secreto del DJ';
    enemy.hp = 10;

    // Player attempts to update own token + tamper with enemy token
    const ok = Service.applyPlayerTokensSync({
      kind: 'PLAYER_TOKENS_SYNC',
      hostOnly: true,
      seatKey: 'inv-1',
      tokens: [
        { id: 'tok-1', name: 'Kaelen Renovado', hp: 19, maxHp: 24, isAlly: true, publicDescription: 'Escudo abollado', privateNotes: 'Nota mía' },
        { id: 'tok-4', name: 'Trasgo Hackeado', hp: 0, isAlly: false, privateNotes: 'HACK' },
        { id: 'tok-injected', name: 'Fantasma', isAlly: true }
      ]
    });
    assert.equal(ok, true);
    assert.equal(Service.state.tokens.find((t) => t.id === 'tok-1').name, 'Kaelen Renovado');
    assert.equal(Service.state.tokens.find((t) => t.id === 'tok-1').hp, 19);
    assert.equal(Service.state.tokens.find((t) => t.id === 'tok-4').name, 'Acechador Trasgo');
    assert.equal(Service.state.tokens.find((t) => t.id === 'tok-4').hp, 10);
    assert.equal(Service.state.tokens.find((t) => t.id === 'tok-4').privateNotes, 'Secreto del DJ');
    assert.equal(Service.state.tokens.some((t) => t.id === 'tok-injected'), false);

    // Legacy redacted WORLD_SYNC sent to GM must not wipe GM private fields
    const redactedEnemy = redactTokenForNonOwner(Service.state.tokens.find((t) => t.id === 'tok-4'));
    Service.applyFullWorldState({
      tokens: [Service.state.tokens.find((t) => t.id === 'tok-1'), redactedEnemy]
    }, true);
    const gmEnemyAfter = Service.state.tokens.find((t) => t.id === 'tok-4');
    assert.equal(gmEnemyAfter.hp, 10);
    assert.equal(gmEnemyAfter.privateNotes, 'Secreto del DJ');
    assert.ok(Array.isArray(gmEnemyAfter.inventory) && gmEnemyAfter.inventory.length > 0);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S1: RealtimeBridge routes targetSeatKey exclusively and blocks relay of hostOnly messages', () => {
  RealtimeBridge.disconnect();
  const sentA = [];
  const sentB = [];
  const connA = { open: true, send: (d) => sentA.push(d), on: () => {} };
  const connB = { open: true, send: (d) => sentB.push(d), on: () => {} };
  RealtimeBridge.hostConns = new Set([connA, connB]);
  RealtimeBridge.registerPeerMeta(connA, { seatKey: 'inv-1', clientId: 'c-1', role: 'player' });
  RealtimeBridge.registerPeerMeta(connB, { seatKey: 'inv-2', clientId: 'c-2', role: 'player' });

  RealtimeBridge.sendToSeat('inv-1', { kind: 'JOURNAL_PRESENT', note: { id: 'jn-1' } });
  assert.equal(sentA.length, 1);
  assert.equal(sentA[0].targetSeatKey, 'inv-1');
  assert.equal(sentB.length, 0, 'Unrelated seat must never receive targeted payload');

  // hostOnly sent on GM side must not broadcast to peers
  RealtimeBridge.sendToHost({ kind: 'JOURNAL_PLAYER_SYNC', hostOnly: true, seatKey: 'inv-1' });
  assert.equal(sentA.length, 1);
  assert.equal(sentB.length, 0);

  // Public broadcast goes to both
  RealtimeBridge.send({ kind: 'DICE_ROLL', roll: { total: 20 } });
  assert.equal(sentA.length, 2);
  assert.equal(sentB.length, 1);

  RealtimeBridge.disconnect();
});

test('S1: Media Registry deduplicates, retains journal-used images after token deletion, filters authorized media, and packs .portal', async () => {
  const origSend = RealtimeBridge.send;
  const origSourceToWebP = WebPConverter.sourceToWebPBytes;
  const origFflate = globalThis.window.fflate;
  RealtimeBridge.send = () => {};

  try {
    const state = resetGmForTest();
    state.playerInvites = [
      { id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] },
      { id: 'inv-2', label: 'P2', tokenIds: ['tok-2'] }
    ];

    const imgShared = 'data:image/webp;base64,SHARED_IMG_DATA';
    const imgUnused = 'data:image/webp;base64,UNUSED_IMG_DATA';
    const imgHidden = 'data:image/webp;base64,HIDDEN_BOSS_DATA';
    const imgOtherPlayer = 'data:image/webp;base64,OTHER_PLAYER_DATA';

    const m1 = Service.registerMediaAsset(imgShared, { label: 'Retrato Compartido', kind: 'token' });
    const m1Dup = Service.registerMediaAsset(imgShared, { label: 'Otro nombre', kind: 'token' });
    assert.equal(m1, m1Dup, 'Identical image URLs deduplicate to the same mediaId');

    const mUnused = Service.registerMediaAsset(imgUnused, { label: 'Basura', kind: 'token' });
    const mHidden = Service.registerMediaAsset(imgHidden, { label: 'Jefe Oculto', kind: 'token' });
    const mOther = Service.registerMediaAsset(imgOtherPlayer, { label: 'Otro', kind: 'journal' });

    const enemy = state.tokens.find((t) => t.id === 'tok-4');
    enemy.imageUrl = imgShared;
    enemy.mediaId = m1;

    // Add a hidden token and a custom token on board with unused media
    state.tokens.push(
      { id: 'tok-hidden', name: 'Sombra', isAlly: false, hidden: true, imageUrl: imgHidden, mediaId: mHidden, x: 500, y: 500 },
      { id: 'tok-temp', name: 'Temporal', isAlly: false, hidden: false, imageUrl: imgUnused, mediaId: mUnused, x: 600, y: 600 }
    );

    // Player inv-1 journal references m1; inv-2 journal references mOther
    state.journal = {
      gmFolders: [],
      gmNotes: [],
      playerJournals: {
        'inv-1': { folders: [], notes: [{ id: 'pn-1', title: 'Trasgo', mediaId: m1, blocks: [] }], revealedAnnotations: {} },
        'inv-2': { folders: [], notes: [{ id: 'pn-2', title: 'Privada P2', mediaId: mOther, blocks: [] }], revealedAnnotations: {} }
      },
      receivedReveals: []
    };

    // Player authorized media for inv-1 includes m1 (visible + own journal) and excludes hidden & inv-2 media
    const authInv1 = collectPlayerAuthorizedMedia(state, 'inv-1');
    assert.ok(authInv1.some((a) => a.mediaId === m1));
    assert.equal(authInv1.some((a) => a.mediaId === mHidden), false);
    assert.equal(authInv1.some((a) => a.mediaId === mOther), false);

    // Deleting tok-4 (referenced by journal) retains m1; deleting tok-temp (unreferenced) prunes mUnused
    Service.deleteToken('tok-4');
    assert.ok(Service.state.mediaAssets[m1], 'Media referenced by journal survives token deletion');
    Service.deleteToken('tok-temp');
    assert.equal(Service.state.mediaAssets[mUnused], undefined, 'Unreferenced media is pruned cleanly');

    // .portal Cartridge round-trip retains m1 and resolves portal:// to data:image/webp;base64,...
    WebPConverter.sourceToWebPBytes = async () => new Uint8Array([1, 2, 3, 4]);
    globalThis.window.fflate = {
      zipSync(tree) {
        const encoded = {};
        for (const [k, v] of Object.entries(tree)) {
          encoded[k] = Array.from(v);
        }
        const json = JSON.stringify(encoded);
        const body = new TextEncoder().encode(json);
        const out = new Uint8Array(4 + body.length);
        out.set([0x50, 0x4b, 0x03, 0x04], 0);
        out.set(body, 4);
        return out;
      },
      unzipSync(bytes) {
        const json = new TextDecoder().decode(bytes.slice(4));
        const decoded = JSON.parse(json);
        const out = {};
        for (const [k, arr] of Object.entries(decoded)) {
          out[k] = new Uint8Array(arr);
        }
        return out;
      }
    };

    const blob = await CartridgePacker.buildPortalBlob(Service.state);
    const parsed = await CartridgePacker.parseCartridgeBuffer(await blob.arrayBuffer());
    assert.ok(parsed.world.mediaAssets[m1], 'Exported and re-imported cartridge preserves journal media asset');
    assert.ok(
      parsed.world.mediaAssets[m1].url.startsWith('data:image/webp;base64,'),
      'Unpacked portal asset resolves to persistent data URL instead of ephemeral blob:'
    );
  } finally {
    RealtimeBridge.send = origSend;
    WebPConverter.sourceToWebPBytes = origSourceToWebP;
    globalThis.window.fflate = origFflate;
  }
});

test('Dynamic lighting hides behind-wall enemy portraits from player gallery & wire world, and excludes raw mapUrl', () => {
  const state = resetGmForTest();
  state.dynamicLighting = true;
  state.mapId = 'custom';
  state.customMapUrl = 'data:image/webp;base64,FULL_SPOILER_MAP';
  state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] }];

  const hero = state.tokens.find((t) => t.id === 'tok-1');
  hero.x = 400;
  hero.y = 400;
  hero.visionMeters = 18;

  const imgVisible = 'data:image/webp;base64,VISIBLE_GOBLIN';
  const imgBehindWall = 'data:image/webp;base64,BEHIND_WALL_BOSS';
  const mVisible = Service.registerMediaAsset(imgVisible, { label: 'Trasgo cercano', kind: 'token' });
  const mBehind = Service.registerMediaAsset(imgBehindWall, { label: 'Jefe tras muro', kind: 'token' });
  const mMap = Service.registerMediaAsset(state.customMapUrl, { label: 'Mapa completo', kind: 'map' });

  state.tokens.push(
    { id: 'tok-vis', name: 'Trasgo cercano', isAlly: false, hidden: false, x: 520, y: 400, imageUrl: imgVisible, mediaId: mVisible },
    { id: 'tok-wall', name: 'Jefe tras muro', isAlly: false, hidden: false, x: 1200, y: 400, imageUrl: imgBehindWall, mediaId: mBehind }
  );

  const visibleForSeat = Selector.getVisibleTokensForSeat(state, 'inv-1');
  assert.equal(visibleForSeat.some((t) => t.id === 'tok-vis'), true);
  assert.equal(visibleForSeat.some((t) => t.id === 'tok-wall'), false, 'Enemy behind closed wall must not be visible');

  const wire = Selector.extractWorldForSeat(state, 'inv-1');
  assert.ok(wire.mediaAssets[mVisible], 'Visible enemy portrait is included in seat mediaAssets');
  assert.equal(wire.mediaAssets[mBehind], undefined, 'Behind-wall enemy portrait must NOT leak into seat mediaAssets');
  assert.equal(wire.mediaAssets[mMap], undefined, 'Raw full map image must NOT enter player authorized media');

  state.role = 'player';
  state.isHostGm = false;
  state.activeInviteId = 'inv-1';
  const playerGallery = Service.getAvailableTableImagesForCurrentRole();
  assert.equal(playerGallery.some((i) => i.mediaId === mVisible), true);
  assert.equal(playerGallery.some((i) => i.mediaId === mBehind), false);
  assert.equal(playerGallery.some((i) => i.mediaId === mMap), false);
});

test('Quarter-viewport snapshot dimensions & player snapshot sync validate WebP format and integrity', () => {
  assert.deepEqual(Selector.computeQuarterViewportDimensions(1280, 800), { width: 640, height: 400 });
  assert.deepEqual(Selector.computeQuarterViewportDimensions(3840, 2160), { width: 720, height: 405 });
  assert.deepEqual(Selector.computeQuarterViewportDimensions(320, 200), { width: 320, height: 200 });

  const origSendToHost = RealtimeBridge.sendToHost;
  const sentToHost = [];
  RealtimeBridge.sendToHost = (msg) => sentToHost.push(msg);

  try {
    const state = resetGmForTest();
    state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] }];
    state.role = 'player';
    state.isHostGm = false;
    state.activeInviteId = 'inv-1';

    const note = Service.createJournalNote({ title: 'Sala del Altar', folder: 'Exploración' });
    const snapUrl = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
    const attached = Service.attachTableSnapshotToJournalNote(note.id, snapUrl, 'Vista de mesa');
    assert.ok(attached && attached.mediaId, 'Player snapshot must attach and register mediaId');
    assert.equal(Service.state.mediaAssets[attached.mediaId]?.kind, 'snapshot');

    const syncMsg = sentToHost.reverse().find((m) => m.kind === 'JOURNAL_PLAYER_SYNC');
    assert.ok(syncMsg && syncMsg.snapshotAssets?.[attached.mediaId], 'Player sync must carry own snapshot asset');

    resetGmForTest();
    Service.state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] }];
    assert.equal(Service.applyPlayerJournalSync(syncMsg), true);
    assert.equal(Service.state.journal.playerJournals['inv-1'].notes[0].mediaId, attached.mediaId);
    assert.equal(Service.state.mediaAssets[attached.mediaId]?.url, snapUrl);

    const forgedSync = JSON.parse(JSON.stringify(syncMsg));
    forgedSync.snapshotAssets[attached.mediaId].url = 'https://evil.example/leak.png';
    Service.state.mediaAssets = {};
    assert.equal(Service.applyPlayerJournalSync(forgedSync), true);
    assert.equal(Service.state.journal.playerJournals['inv-1'].notes[0].mediaId, '');
    assert.equal(Service.state.mediaAssets[attached.mediaId], undefined);
  } finally {
    RealtimeBridge.sendToHost = origSendToHost;
  }
});
