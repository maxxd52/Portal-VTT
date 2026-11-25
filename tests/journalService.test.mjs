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

const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Selector } = await import('../js/core/selector.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261125a1');

function resetGmState() {
  Service.cancelAllTokenGlides();
  Service.listeners = [];
  Service.undoStack = [];
  Service.redoStack = [];
  Service.peers = new Map();
  Service.journalUnreadCount = 0;
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.tokens = [
    { id: 'tok-1', name: 'Kaelen', isAlly: true, x: 440, y: 440, hp: 24, maxHp: 24, ac: 16, size: 1, inventory: [] },
    { id: 'tok-2', name: 'Lyra', isAlly: true, x: 360, y: 600, hp: 14, maxHp: 14, ac: 12, size: 1, inventory: [] },
    { id: 'tok-4', name: 'Acechador Trasgo', isAlly: false, x: 1080, y: 480, hp: 10, maxHp: 10, ac: 13, size: 1, inventory: [] }
  ];
  Service.state.playerInvites = [
    { id: 'inv-1', label: 'Jugador 1', tokenIds: ['tok-1'] },
    { id: 'inv-2', label: 'Jugador 2', tokenIds: ['tok-2'] }
  ];
  return Service.state;
}

test('S2: GM journal folders, multi-block notes, per-block visibility, and selective progressive reveal', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);

  try {
    resetGmState();
    Service.createJournalFolder('Pistas');
    assert.ok(Service.state.journal.gmFolders.includes('Pistas'));

    const note = Service.createJournalNote({
      title: 'Códice Carmesí',
      folder: 'Pistas',
      imageUrl: 'data:image/webp;base64,CODICE_IMG',
      blocks: [
        { heading: 'Portada', body: 'Escrito en alto élfico.', visibility: 'all' },
        { heading: 'Secreto del Culto', body: 'El alcalde lidera la secta.', visibility: 'private' },
        { heading: 'Susurro Arcano', body: 'Solo Lyra entiende la runa.', visibility: 'players', allowedSeatKeys: ['inv-2'] }
      ]
    });
    assert.ok(note && note.id);
    assert.equal(note.blocks.length, 3);
    assert.ok(note.mediaId && Service.state.mediaAssets[note.mediaId]);

    // Presenting a note where all target blocks are private fails cleanly
    const privNote = Service.createJournalNote({
      title: 'Solo DJ',
      blocks: [{ heading: 'Secreto', body: 'Trampa mortal', visibility: 'private' }]
    });
    const privAttempt = Service.presentJournalNote(privNote.id, { targetMode: 'all' });
    assert.equal(privAttempt.ok, false);
    assert.equal(privAttempt.reason, 'no_visible_blocks');
    assert.equal(sent.length, 0);

    // Presenting Códice Carmesí to all sends filtered views per seat
    const res = Service.presentJournalNote(note.id, { targetMode: 'all' });
    assert.equal(res.ok, true);
    assert.ok(Service.state.activeJournalPresentation);

    const p1Msg = sent.find((m) => m.kind === 'JOURNAL_PRESENT' && m.targetSeatKey === 'inv-1');
    const p2Msg = sent.find((m) => m.kind === 'JOURNAL_PRESENT' && m.targetSeatKey === 'inv-2');
    assert.ok(p1Msg && p2Msg);
    assert.equal(p1Msg.note.blocks.length, 1, 'P1 only sees the public block');
    assert.equal(p1Msg.note.blocks[0].heading, 'Portada');
    assert.equal(p2Msg.note.blocks.length, 2, 'P2 sees public + inv-2 block, never private');
    assert.equal(p2Msg.note.blocks.some((b) => b.heading === 'Secreto del Culto'), false);

    // Progressive reveal of a single private block upgrades its visibility for target seat and pushes update
    sent.length = 0;
    const secretBlockId = note.blocks[1].id;
    const blockRes = Service.presentJournalNote(note.id, {
      targetMode: 'players',
      targetSeatKeys: ['inv-1'],
      blockId: secretBlockId
    });
    assert.equal(blockRes.ok, true);
    assert.equal(sent.filter((m) => m.kind === 'JOURNAL_PRESENT').length, 1);
    const p1Updated = sent.find((m) => m.kind === 'JOURNAL_PRESENT' && m.targetSeatKey === 'inv-1');
    assert.equal(p1Updated.highlightBlockId, secretBlockId);
    assert.equal(p1Updated.note.blocks.length, 2);
    assert.equal(p1Updated.note.blocks[1].heading, 'Secreto del Culto');
    assert.equal(sent.some((m) => m.targetSeatKey === 'inv-2'), false);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S2: revealed GM note auto-saves in player journal and preserves player personal annotation blocks across GM updates', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);

  try {
    // Prepare GM message payload
    resetGmState();
    const gmNote = Service.createJournalNote({
      title: 'Mapa de las Alcantarillas',
      folder: 'Lugares',
      blocks: [
        { heading: 'Entrada Norte', body: 'Reja oxidada junto al muelle.', visibility: 'all' },
        { heading: 'Guarida', body: 'Doble puerta oculta.', visibility: 'private' }
      ]
    });
    Service.presentJournalNote(gmNote.id, { targetMode: 'all' });
    const initialMsg = sent.find((m) => m.kind === 'JOURNAL_PRESENT' && m.targetSeatKey === 'inv-1');

    // Switch into Player inv-1 session
    Service.state = createInitialState();
    Service.state.role = 'player';
    Service.state.isHostGm = false;
    Service.state.activeInviteId = 'inv-1';
    Service.state.journalOpen = false;
    sent.length = 0;

    Service.receiveJournalPresentation(initialMsg);
    assert.equal(Service.state.journal.receivedReveals.length, 1);
    assert.equal(Service.state.activeJournalPresentation.note.id, gmNote.id);
    assert.equal(Service.journalUnreadCount, 1);

    // Player organizes revealed note into a personal folder and adds two annotation blocks underneath
    Service.setRevealedNotePlayerFolder(gmNote.id, 'Investigación');
    const ann1 = Service.addRevealedNoteAnnotationBlock(gmNote.id, {
      heading: 'Mi teoría',
      body: 'Necesitamos palanca para la reja.'
    });
    assert.ok(ann1 && ann1.id);
    Service.updateRevealedNoteAnnotationBlock(gmNote.id, ann1.id, { body: 'Llevar aceite y palanca.' });
    assert.ok(sent.some((m) => m.kind === 'JOURNAL_PLAYER_SYNC' && m.hostOnly === true));

    // GM later reveals the second block and sends updated JOURNAL_REVEALS_SYNC
    const secondSyncMsg = {
      kind: 'JOURNAL_REVEALS_SYNC',
      targetSeatKey: 'inv-1',
      noteId: gmNote.id,
      note: {
        id: gmNote.id,
        title: 'Mapa de las Alcantarillas (Actualizado)',
        gmFolder: 'Lugares',
        mediaId: '',
        imageUrl: '',
        blocks: [
          { id: gmNote.blocks[0].id, heading: 'Entrada Norte', body: 'Reja oxidada junto al muelle.' },
          { id: gmNote.blocks[1].id, heading: 'Guarida', body: 'Doble puerta oculta.' }
        ],
        updatedAt: Date.now()
      }
    };
    Service.receiveJournalRevealsSync(secondSyncMsg);

    const revAfter = Service.state.journal.receivedReveals.find((r) => r.id === gmNote.id);
    assert.equal(revAfter.title, 'Mapa de las Alcantarillas (Actualizado)');
    assert.equal(revAfter.blocks.length, 2, 'Read-only GM content updates with newly revealed blocks');

    const ownAnnot = Service.state.journal.playerJournals['inv-1'].revealedAnnotations[gmNote.id];
    assert.equal(ownAnnot.folder, 'Investigación');
    assert.equal(ownAnnot.blocks.length, 1);
    assert.equal(ownAnnot.blocks[0].body, 'Llevar aceite y palanca.', 'Player annotation blocks remain intact after GM update');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S2: player private journal notes persist in GM campaign, stay hidden from other players, and block unauthorized external uploads', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);

  try {
    resetGmState();
    const tokImg = 'data:image/webp;base64,ALLOWED_TABLE_IMG';
    const mediaId = Service.registerMediaAsset(tokImg, { label: 'Retrato Kaelen', kind: 'token' });
    Service.state.tokens[0].imageUrl = tokImg;
    Service.state.tokens[0].mediaId = mediaId;
    const gmWorldForP1 = Selector.extractWorldForSeat(Service.state, 'inv-1');

    // Player 1 creates private note using table image, and attempts unauthorized external upload
    Service.state = createInitialState();
    Service.state.role = 'player';
    Service.state.isHostGm = false;
    Service.state.activeInviteId = 'inv-1';
    Service.applyFullWorldState(gmWorldForP1, true);

    const blockedExternal = Service.createJournalNote({
      title: 'Upload Ilegal',
      imageUrl: 'https://evil.example.com/payload.png'
    });
    assert.equal(blockedExternal, null, 'Players cannot upload arbitrary external images into Diario');

    const p1Note = Service.createJournalNote({
      title: 'Diario secreto de Kaelen',
      folder: 'Personal',
      mediaId,
      blocks: [{ heading: 'Sospechas', body: 'No confío en el consejero.' }]
    });
    assert.ok(p1Note && p1Note.id);
    const syncMsg = sent.reverse().find((m) => m.kind === 'JOURNAL_PLAYER_SYNC');
    assert.ok(syncMsg && syncMsg.hostOnly === true);

    // GM receives JOURNAL_PLAYER_SYNC (also tries tampered mediaId rejection)
    resetGmState();
    Service.state.tokens[0].imageUrl = tokImg;
    Service.state.tokens[0].mediaId = mediaId;
    Service.registerMediaAsset(tokImg, { label: 'Retrato Kaelen', kind: 'token' });

    const tamperedSync = JSON.parse(JSON.stringify(syncMsg));
    tamperedSync.playerJournal.notes[0].mediaId = 'media-unauthorized';
    Service.applyPlayerJournalSync(tamperedSync);
    assert.equal(
      Service.state.journal.playerJournals['inv-1'].notes[0].mediaId,
      '',
      'GM strips unauthorized mediaId on player journal sync'
    );

    Service.applyPlayerJournalSync(syncMsg);
    assert.equal(Service.state.journal.playerJournals['inv-1'].notes[0].title, 'Diario secreto de Kaelen');
    assert.equal(Service.state.journal.playerJournals['inv-1'].notes[0].mediaId, mediaId);

    // Campaign vault save preserves inv-1 journal; inv-2 wire sync never sees inv-1 notes; inv-1 reconnect recovers them
    const vaultSave = Selector.extractSerializableWorld(Service.state, { includePrivateGm: true });
    assert.equal(vaultSave.journal.playerJournals['inv-1'].notes.length, 1);

    const p2Wire = Selector.extractWorldForSeat(Service.state, 'inv-2');
    assert.equal(p2Wire.journal.playerJournal.notes.length, 0, 'Player 2 must never see Player 1 private notes');
    assert.equal(JSON.stringify(p2Wire).includes('Diario secreto de Kaelen'), false);

    const p1ReconnectWire = Selector.extractWorldForSeat(Service.state, 'inv-1');
    assert.equal(p1ReconnectWire.journal.playerJournal.notes.length, 1);
    assert.equal(p1ReconnectWire.journal.playerJournal.notes[0].title, 'Diario secreto de Kaelen');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S2: saveInspectedTokenToJournal creates note reusing token mediaId & publicDescription and manages right-drawer mutual exclusion', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};

  try {
    resetGmState();
    const enemy = Service.state.tokens.find((t) => t.id === 'tok-4');
    enemy.x = 560;
    enemy.y = 480;
    enemy.imageUrl = 'data:image/webp;base64,GOBLIN_FACE';
    enemy.mediaId = Service.registerMediaAsset(enemy.imageUrl, { label: enemy.name, kind: 'token' });
    enemy.publicDescription = 'Trasgo flaco con capucha verde.';
    enemy.privateNotes = 'Lleva veneno en la bota.';

    const p1World = Selector.extractWorldForSeat(Service.state, 'inv-1');

    Service.state = createInitialState();
    Service.state.role = 'player';
    Service.state.isHostGm = false;
    Service.state.activeInviteId = 'inv-1';
    Service.applyFullWorldState(p1World, true);

    const created = Service.saveInspectedTokenToJournal('tok-4');
    assert.ok(created);
    assert.equal(created.title, 'Acechador Trasgo');
    assert.equal(created.mediaId, enemy.mediaId);
    assert.equal(created.blocks[0].body, 'Trasgo flaco con capucha verde.');
    assert.equal(JSON.stringify(created).includes('veneno'), false);
    assert.equal(Service.state.journalOpen, true);

    // Mutual exclusion per side: right (journalOpen <-> drawerOpen), left (gmScreenOpen <-> sheetOpen)
    Service.state.role = 'gm';
    Service.state.isHostGm = true;
    Service.state.drawerOpen = true;
    Service.toggleJournal(true);
    assert.equal(Service.state.journalOpen, true);
    assert.equal(Service.state.drawerOpen, false);

    Service.state.sheetOpen = true;
    Service.toggleGmScreen(true);
    assert.equal(Service.state.gmScreenOpen, true);
    assert.equal(Service.state.sheetOpen, false);
    assert.equal(Service.state.journalOpen, true);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S5: presentJournalNote supports selective blockIds + includeImage=false without leaking hidden blocks or media, and updateJournalNote commits blocks atomically', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);

  try {
    resetGmState();
    const note = Service.createJournalNote({
      title: 'Diario del Alquimista',
      folder: 'Pistas',
      imageUrl: 'data:image/webp;base64,SECRET_SIGIL',
      blocks: [
        { heading: 'Portada', body: 'Notas públicas del laboratorio.', visibility: 'private' },
        { heading: 'Fórmula', body: 'Veneno oculto del DJ.', visibility: 'private' },
        { heading: 'Anexo', body: 'Mapa del sótano.', visibility: 'private' }
      ]
    });

    // Atomic update of blocks via updateJournalNote
    const updated = Service.updateJournalNote(note.id, {
      title: 'Diario del Alquimista (Editado)',
      blocks: [
        { id: note.blocks[0].id, heading: 'Portada', body: 'Notas públicas actualizadas.', visibility: 'private' },
        { id: note.blocks[1].id, heading: 'Fórmula', body: 'Veneno oculto del DJ.', visibility: 'private' },
        { id: note.blocks[2].id, heading: 'Anexo', body: 'Mapa del sótano.', visibility: 'private' }
      ]
    });
    assert.equal(updated.title, 'Diario del Alquimista (Editado)');
    assert.equal(updated.blocks[0].body, 'Notas públicas actualizadas.');

    // Share ONLY block 0 and block 2 to player inv-1, excluding image
    const res = Service.presentJournalNote(note.id, {
      targetMode: 'players',
      targetSeatKeys: ['inv-1'],
      blockIds: [note.blocks[0].id, note.blocks[2].id],
      includeImage: false
    });
    assert.equal(res.ok, true);
    assert.deepEqual(res.targetSeats, ['inv-1']);

    const msgInv1 = sent.find((m) => m.kind === 'JOURNAL_PRESENT' && m.targetSeatKey === 'inv-1');
    assert.ok(msgInv1, 'inv-1 must receive JOURNAL_PRESENT');
    assert.equal(msgInv1.note.blocks.length, 2, 'Only the 2 selected blocks must be sent');
    assert.equal(JSON.stringify(msgInv1).includes('Veneno oculto'), false, 'Unchecked block must never leak');
    assert.equal(msgInv1.note.mediaId, '', 'includeImage=false must omit mediaId');
    assert.equal(msgInv1.note.imageUrl, '', 'includeImage=false must omit imageUrl');
    assert.equal(msgInv1.mediaAsset, null, 'includeImage=false must not send mediaAsset over P2P');

    // Verify extractJournalForSeat matches the exact zero-leak projection
    const extracted = Selector.extractJournalForSeat(Service.state, 'inv-1');
    assert.equal(extracted.receivedReveals.length, 1);
    assert.equal(extracted.receivedReveals[0].blocks.length, 2);
    assert.equal(extracted.receivedReveals[0].mediaId, '');
    assert.equal(extracted.receivedReveals[0].imageUrl, '');

    // inv-2 must still receive nothing
    const extractedInv2 = Selector.extractJournalForSeat(Service.state, 'inv-2');
    assert.equal(extractedInv2.receivedReveals.length, 0);
  } finally {
    RealtimeBridge.send = origSend;
  }
});
