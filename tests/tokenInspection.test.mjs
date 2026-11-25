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

const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261125a1');
const { resolveTokenDoubleClickAction } = await import('../js/utils/worldRedaction.js?v=20261125a1');

test('S4: saveCustomActor and spawnActorFromTemplate preserve publicDescription and dual-layer token notes enforce permissions', async () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};

  try {
    Service.listeners = [];
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.isHostGm = true;
    Service.state.tokens = [
      { id: 'tok-1', name: 'Kaelen', isAlly: true, x: 440, y: 440, hp: 24, maxHp: 24, ac: 16, size: 1 }
    ];
    Service.state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] }];

    const savedTpl = Service.saveCustomActor({
      name: 'Capitán de la Guardia',
      role: 'Guardia Real',
      isAlly: false,
      imageUrl: 'data:image/webp;base64,GUARD_CAPTAIN',
      publicDescription: 'Armadura bruñida con el emblema del león dorado.',
      hp: 32,
      ac: 18
    });
    assert.equal(savedTpl.publicDescription, 'Armadura bruñida con el emblema del león dorado.');
    assert.ok(savedTpl.mediaId);

    Service.state.sheetOpen = false;
    Service.state.gmScreenOpen = true;
    const spawned = await Service.spawnActorFromTemplate(savedTpl, 500, 500);
    assert.equal(Service.state.selectedTokenId, spawned.id);
    assert.deepEqual(Service.state.selectedTokenIds, [spawned.id]);
    assert.equal(Service.state.sheetOpen, false, 'Spawning a token must not auto-open character sheet');
    assert.equal(Service.state.gmScreenOpen, true, 'Spawning a token must not close an open GM screen');
    assert.equal(spawned.publicDescription, 'Armadura bruñida con el emblema del león dorado.');
    assert.equal(spawned.privateNotes, '');

    // GM can edit both publicDescription and privateNotes on any token
    Service.updateTokenPublicDescription(spawned.id, 'Capa roja manchada de barro.');
    Service.updateTokenPrivateNotes(spawned.id, 'Sobornado por la cofradía.');
    assert.equal(spawned.publicDescription, 'Capa roja manchada de barro.');
    assert.equal(spawned.privateNotes, 'Sobornado por la cofradía.');

    // Switch to player inv-1 (owns tok-1, does not own spawned)
    Service.state.role = 'player';
    Service.state.isHostGm = false;
    Service.state.activeInviteId = 'inv-1';

    assert.equal(Service.updateTokenPublicDescription(spawned.id, 'Hack'), null);
    assert.equal(Service.updateTokenPrivateNotes(spawned.id, 'Hack'), null);
    assert.equal(spawned.publicDescription, 'Capa roja manchada de barro.');

    assert.ok(Service.updateTokenPublicDescription('tok-1', 'Guerrero de ojos grises.'));
    assert.ok(Service.updateTokenPrivateNotes('tok-1', 'Busco a mi hermano.'));
    assert.equal(Service.state.tokens[0].publicDescription, 'Guerrero de ojos grises.');
    assert.equal(Service.state.tokens[0].privateNotes, 'Busco a mi hermano.');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S4: double-click routing opens full sheet for GM/owner, Inspection Card for non-owners, and blocks hidden tokens', () => {
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = () => {};

  try {
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.isHostGm = true;
    Service.state.tokens = [
      { id: 'tok-1', name: 'Kaelen', isAlly: true, x: 440, y: 440, hp: 24, maxHp: 24, ac: 16, size: 1 },
      { id: 'tok-2', name: 'Lyra', isAlly: true, x: 360, y: 600, hp: 14, maxHp: 14, ac: 12, size: 1 },
      { id: 'tok-4', name: 'Acechador Trasgo', isAlly: false, x: 1080, y: 480, hp: 10, maxHp: 10, ac: 13, size: 1 }
    ];
    Service.state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: ['tok-1'] }];

    const hero = Service.state.tokens.find((t) => t.id === 'tok-1');
    const ally2 = Service.state.tokens.find((t) => t.id === 'tok-2');
    const enemy = Service.state.tokens.find((t) => t.id === 'tok-4');

    // GM opens full sheet on all tokens
    assert.equal(resolveTokenDoubleClickAction(Service.state, hero, Service.canControlToken(hero)), 'sheet');
    assert.equal(resolveTokenDoubleClickAction(Service.state, enemy, Service.canControlToken(enemy)), 'sheet');

    // Player inv-1
    Service.state.role = 'player';
    Service.state.isHostGm = false;
    Service.state.activeInviteId = 'inv-1';

    assert.equal(resolveTokenDoubleClickAction(Service.state, hero, Service.canControlToken(hero)), 'sheet');
    assert.equal(resolveTokenDoubleClickAction(Service.state, ally2, Service.canControlToken(ally2)), 'inspect');
    assert.equal(resolveTokenDoubleClickAction(Service.state, enemy, Service.canControlToken(enemy)), 'inspect');

    assert.equal(Service.openTokenInspection(enemy.id), true);
    assert.equal(Service.state.inspectTokenId, enemy.id);

    enemy.hidden = true;
    assert.equal(resolveTokenDoubleClickAction(Service.state, enemy, Service.canControlToken(enemy)), 'none');
    assert.equal(Service.openTokenInspection(enemy.id), false);

    Service.closeTokenInspection();
    assert.equal(Service.state.inspectTokenId, null);
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('S4: index.html includes public/private description fields and clean Inspection Card modal with Guardar en Diario', () => {
  const htmlPath = path.resolve(import.meta.dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('id="inpSheetPublicDesc"'), 'Character sheet must include #inpSheetPublicDesc');
  assert.ok(html.includes('id="inpSheetPrivateNotes"'), 'Character sheet must include #inpSheetPrivateNotes');
  assert.ok(html.includes('id="inpCustomTokenPublicDesc"'), 'Compendium actor creator must include #inpCustomTokenPublicDesc');

  const inspectMatch = html.match(/id="tokenInspectModal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  assert.ok(inspectMatch, 'index.html must include #tokenInspectModal');
  assert.ok(html.includes('id="inspectTokenMedia"'));
  assert.ok(html.includes('id="inspectTokenName"'));
  assert.ok(html.includes('id="inspectTokenDesc"'));
  assert.ok(html.includes('id="btnInspectSaveToJournal"'));
  assert.ok(html.includes('Guardar en Diario'));
});

test('S5: compendium and GM screen actor thumbnails disable native image drag and board drop prioritizes dragSpec over files', () => {
  const compSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'js/ui/compendiumView.js'), 'utf8');
  const gmSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'js/ui/gmScreenView.js'), 'utf8');
  const boardSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'js/ui/boardView.js'), 'utf8');

  assert.ok(
    compSrc.includes('draggable="false"') && compSrc.includes('pointer-events-none'),
    'compendiumView actor thumbnail img must disable native image dragging'
  );
  assert.ok(
    gmSrc.includes('draggable="false"') && gmSrc.includes('pointer-events-none'),
    'gmScreenView actor thumbnail img must disable native image dragging'
  );

  const dropHandlerIdx = boardSrc.indexOf("window.addEventListener('drop'");
  const dragSpecIdx = boardSrc.indexOf("dragSpec.startsWith('actor:')", dropHandlerIdx);
  const imageFileIdx = boardSrc.indexOf("file.type.startsWith('image/')", dropHandlerIdx);
  assert.ok(
    dragSpecIdx > dropHandlerIdx && imageFileIdx > dragSpecIdx,
    'boardView drop handler must evaluate compendium dragSpec before falling back to external image file drop'
  );
  assert.ok(
    boardSrc.includes('this._isInternalDrag = true') && boardSrc.includes('if (this._isInternalDrag)'),
    'boardView must track internal dragstart and suppress dropModuleOverlay during internal compendium drags'
  );
});

