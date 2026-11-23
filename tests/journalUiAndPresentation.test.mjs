import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {
  location: { search: '' },
  innerWidth: 1280,
  innerHeight: 720
};
globalThis.document = globalThis.document || { activeElement: null };
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
const { JournalViewMethods } = await import('../js/ui/journalView.js?v=20261123a7');
const { JournalShareViewMethods } = await import('../js/ui/journalShareView.js?v=20261123a7');
const { JournalPresentationViewMethods } = await import('../js/ui/journalPresentationView.js?v=20261123a7');

function makeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c, force) => {
      const next = force === undefined ? !set.has(c) : Boolean(force);
      if (next) set.add(c);
      else set.delete(c);
      return next;
    }
  };
}

function makeJournalViewCtx(extra = {}) {
  return {
    ...JournalViewMethods,
    ...JournalShareViewMethods,
    escapeHtml: (s) => String(s ?? ''),
    journalFilterFolder: '',
    journalSearchQuery: '',
    journalImagePickerOpen: false,
    journalDraftNote: null,
    _draftBlockSeq: 1,
    els: {},
    ...extra
  };
}

test('S5: JournalViewMethods enforces Apple-style separation: clean list, clean Read mode, and distraction-free Edit/Draft mode', () => {
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.journalOpen = true;

  const gmNote = Service.createJournalNote({
    title: 'Crónica del Bastión',
    folder: 'Lore',
    blocks: [
      { heading: 'Historia', body: 'Fundado hace siglos.', visibility: 'all' },
      { heading: 'Trampa', body: 'Piso falso.', visibility: 'private' }
    ]
  });

  // 1. Clean List view: clickable note card WITHOUT redundant quick-present eye buttons
  Service.activeJournalNoteId = '';
  const ctx = makeJournalViewCtx();
  const listHtml = ctx.buildJournalInnerHtml(Service.state);
  assert.ok(listHtml.includes(`data-journal-open-note="${gmNote.id}"`), 'List must render clickable note card');
  assert.equal(listHtml.includes('data-journal-quick-present'), false, 'List must NOT have redundant quick-present eye buttons');

  // 2. Clean Read mode: single Mostrar button (opens share modal), Editar button, NO split dropdown, NO per-block eye buttons
  Service.activeJournalNoteId = gmNote.id;
  Service.activeJournalNoteKind = 'gm';
  const readHtml = ctx.buildJournalInnerHtml(Service.state);
  assert.ok(readHtml.includes('Crónica del Bastión'));
  assert.ok(readHtml.includes('Fundado hace siglos.'));
  assert.ok(readHtml.includes('data-journal-open-share="1"'), 'Read mode must expose single Mostrar entry point for GM');
  assert.ok(readHtml.includes('data-journal-start-edit="1"'), 'Read mode must expose Editar button');
  assert.equal(readHtml.includes('data-journal-toggle-targets'), false, 'Read mode must NOT render redundant inline target dropdown');
  assert.equal(readHtml.includes('data-journal-present-block'), false, 'Read mode must NOT render redundant per-block eye buttons');
  assert.equal(readHtml.includes('<textarea'), false, 'Read mode must not render textareas');

  // 3. Unified Edit mode (in-memory draft): Guardar + Cancelar, NO Mostrar, NO per-block eye or visibility clutter
  ctx.startEditJournalNote(gmNote);
  const editHtml = ctx.buildJournalInnerHtml(Service.state);
  assert.ok(editHtml.includes('<textarea'), 'Edit mode must render block textareas');
  assert.ok(editHtml.includes('data-journal-save-draft="1"'), 'Edit mode must expose explicit Guardar button');
  assert.ok(editHtml.includes('data-journal-cancel-draft="1"'), 'Edit mode must expose Cancelar button');
  assert.equal(editHtml.includes('data-journal-open-share'), false, 'Edit mode must NOT mix Mostrar controls');
  assert.equal(editHtml.includes('data-journal-present-block'), false, 'Edit mode must NOT mix per-block eye controls');
  assert.equal(editHtml.includes('data-journal-vis='), false, 'Edit mode must NOT clutter blocks with duplicate visibility bars');

  // 4. Player Edit mode must NEVER render file upload or external URL input
  Service.state.role = 'player';
  Service.state.isHostGm = false;
  Service.state.activeInviteId = 'inv-1';
  const pNote = Service.createJournalNote({
    title: 'Apuntes de Kaelen',
    folder: 'PNJs',
    blocks: [{ heading: 'Pista 1', body: 'Hablar con el herrero.' }]
  });
  Service.activeJournalNoteId = pNote.id;
  Service.activeJournalNoteKind = 'player';

  const playerCtx = makeJournalViewCtx({ journalImagePickerOpen: true });
  playerCtx.startEditJournalNote(pNote);
  const playerHtml = playerCtx.buildJournalInnerHtml(Service.state);
  assert.ok(playerHtml.includes('Apuntes de Kaelen'));
  assert.equal(playerHtml.includes('type="file"'), false, 'Player journal editor must never allow file upload');
  assert.equal(playerHtml.includes('data-journal-gm-img-url'), false, 'Player journal editor must never allow external URL input');
  assert.ok(playerHtml.includes('data-journal-pick-media'), 'Player journal editor must offer table image gallery');
  assert.ok(playerHtml.includes('data-journal-capture-view'), 'Player journal editor must offer table viewport snapshot button');
});

test('S5: Editing an existing note uses a local draft: Cancelar discards changes and Guardar commits atomically', () => {
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.journalOpen = true;

  const note = Service.createJournalNote({
    title: 'Título original',
    folder: 'Lore',
    blocks: [{ heading: 'Sección 1', body: 'Texto original', visibility: 'all' }]
  });
  Service.activeJournalNoteId = note.id;
  Service.activeJournalNoteKind = 'gm';

  const ctx = makeJournalViewCtx({
    els: {
      btnNewJournalNote: { classList: makeClassList() },
      journalContent: {
        _html: '',
        set innerHTML(v) { this._html = v; },
        get innerHTML() { return this._html; },
        contains: () => false,
        querySelector: () => null,
        querySelectorAll: () => []
      }
    }
  });

  // Start editing -> mutate draft -> Cancelar -> original note MUST remain untouched
  ctx.startEditJournalNote(note);
  ctx.journalDraftNote.title = 'Título sin guardar';
  ctx.journalDraftNote.blocks[0].body = 'Borrador descartado';
  ctx.cancelDraftJournalNote();

  assert.equal(note.title, 'Título original', 'Cancelar must discard draft title');
  assert.equal(note.blocks[0].body, 'Texto original', 'Cancelar must discard draft block edits');
  assert.equal(ctx.journalDraftNote, null);
  assert.equal(Service.activeJournalNoteId, note.id, 'Cancelar editing an existing note must return to its Read view');

  // Start editing -> mutate draft -> Guardar -> commits changes and returns to Read view
  ctx.startEditJournalNote(note);
  ctx.journalDraftNote.title = 'Título guardado';
  ctx.journalDraftNote.blocks[0].body = 'Texto confirmado';
  ctx.saveDraftJournalNote();

  assert.equal(note.title, 'Título guardado');
  assert.equal(note.blocks[0].body, 'Texto confirmado');
  assert.equal(note.blocks[0].visibility, 'all', 'Saving text edits must preserve existing block visibility');
  assert.equal(ctx.journalDraftNote, null);
  assert.equal(Service.activeJournalNoteId, note.id);
});

test('S5: + button toggles draft note with portal-btn-accent, cancels without creating, and saves only on Guardar', () => {
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.journalOpen = true;
  Service.activeJournalNoteId = '';
  Service.activeJournalNoteKind = '';

  let plusClickHandler = null;
  const btnNewJournalNote = {
    classList: makeClassList(),
    addEventListener: (ev, fn) => {
      if (ev === 'click') plusClickHandler = fn;
    }
  };
  const fakeContent = {
    _html: '',
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    contains: () => false,
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const ctx = makeJournalViewCtx({
    els: {
      btnNewJournalNote,
      journalContent: fakeContent
    }
  });

  ctx.bindJournalEvents();
  assert.ok(plusClickHandler, 'bindJournalEvents must attach click handler to btnNewJournalNote');

  // 1st click on +: opens draft, turns button purple, does NOT persist note yet
  plusClickHandler();
  assert.equal(Service.state.journal.gmNotes.length, 0, 'Clicking + must not immediately persist a note');
  assert.ok(btnNewJournalNote.classList.contains('portal-btn-accent'), 'Active draft must highlight + with portal-btn-accent');
  assert.ok(fakeContent.innerHTML.includes('data-journal-save-draft="1"'), 'Draft mode must render Guardar button');

  // 2nd click on +: cancels draft without creating any note, removes purple highlight
  plusClickHandler();
  assert.equal(Service.state.journal.gmNotes.length, 0, 'Clicking + again must discard draft without creating a note');
  assert.equal(btnNewJournalNote.classList.contains('portal-btn-accent'), false, 'Canceling draft must remove portal-btn-accent');
  assert.equal(ctx.journalDraftNote, null, 'Canceling draft must clear journalDraftNote');

  // 3rd click on +: reopen draft, edit in-memory draft, and save via saveDraftJournalNote
  plusClickHandler();
  assert.ok(ctx.journalDraftNote, 'Draft note must be active');
  ctx.journalDraftNote.title = 'Nota guardada';
  ctx.journalDraftNote.blocks[0].body = 'Contenido final';
  ctx.saveDraftJournalNote();

  assert.equal(Service.state.journal.gmNotes.length, 1, 'Saving draft must create exactly one note');
  assert.equal(Service.state.journal.gmNotes[0].title, 'Nota guardada');
  assert.equal(Service.state.journal.gmNotes[0].blocks[0].body, 'Contenido final');
  assert.equal(ctx.journalDraftNote, null, 'Saving draft must clear journalDraftNote');
  assert.equal(btnNewJournalNote.classList.contains('portal-btn-accent'), false, 'Saving draft must remove portal-btn-accent');
});

test('S5: Journal note image container in Read and Revealed modes prevents flex-shrink compression', () => {
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.journalOpen = true;

  const gmNote = Service.createJournalNote({
    title: 'Nota con imagen y bloques',
    imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    blocks: [
      { heading: 'B1', body: 'Texto 1' },
      { heading: 'B2', body: 'Texto 2' },
      { heading: 'B3', body: 'Texto 3' }
    ]
  });

  Service.activeJournalNoteId = gmNote.id;
  Service.activeJournalNoteKind = 'gm';
  const ctx = makeJournalViewCtx();
  const readHtml = ctx.buildJournalInnerHtml(Service.state);

  const readImgWrapperMatch = readHtml.match(/<div class="([^"]*overflow-hidden[^"]*)"><img src="data:image\/png/);
  assert.ok(readImgWrapperMatch, 'Read mode must render image wrapper');
  assert.ok(
    readImgWrapperMatch[1].split(/\s+/).includes('shrink-0'),
    'Read mode image wrapper must include shrink-0 so multiple blocks do not squish the image'
  );

  // Also verify revealed note mode for player
  Service.state.role = 'player';
  Service.state.isHostGm = false;
  Service.state.activeInviteId = 'inv-1';
  Service.state.journal.receivedReveals = [
    {
      id: 'rev-1',
      title: 'Nota revelada',
      imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      blocks: [
        { id: 'rb1', heading: 'B1', body: 'Texto 1' },
        { id: 'rb2', heading: 'B2', body: 'Texto 2' }
      ]
    }
  ];
  Service.activeJournalNoteId = 'rev-1';
  Service.activeJournalNoteKind = 'revealed';

  const revealedHtml = ctx.buildJournalInnerHtml(Service.state);
  const revealedImgWrapperMatch = revealedHtml.match(/<div class="([^"]*overflow-hidden[^"]*)"><img src="data:image\/png/);
  assert.ok(revealedImgWrapperMatch, 'Revealed mode must render image wrapper');
  assert.ok(
    revealedImgWrapperMatch[1].split(/\s+/).includes('shrink-0'),
    'Revealed mode image wrapper must include shrink-0 so multiple blocks do not squish the image'
  );
});

test('S5: JournalShareViewMethods renders centered anti-spoiler preview modal and confirms selective presentation', () => {
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.state.playerInvites = [
    { id: 'inv-1', label: 'Ana', tokenIds: [] },
    { id: 'inv-2', label: 'Luis', tokenIds: [] }
  ];

  const note = Service.createJournalNote({
    title: 'Carta sellada',
    folder: 'Pistas',
    imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    blocks: [
      { heading: 'Sobre exterior', body: 'Sello de cera roja.', visibility: 'all' },
      { heading: 'Secreto del DJ', body: 'Contiene tinta invisible.', visibility: 'private' }
    ]
  });

  const modalEl = { classList: makeClassList() };
  const bodyEl = {
    _html: '',
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const confirmBtn = { disabled: false };

  const ctx = makeJournalViewCtx({
    els: {
      journalShareModal: modalEl,
      journalShareBody: bodyEl,
      btnConfirmJournalShare: confirmBtn
    },
    renderJournal: () => {}
  });

  ctx.openJournalShareModal(note.id);
  assert.equal(modalEl.classList.contains('is-open'), true, 'Opening share modal must add is-open');
  assert.ok(bodyEl.innerHTML.includes('Toda la mesa'), 'Share modal must show Toda la mesa option');
  assert.ok(bodyEl.innerHTML.includes('Jugadores'), 'Share modal must show Jugadores option');
  const previewStart = bodyEl.innerHTML.indexOf('data-jshare-preview="1"');
  assert.ok(previewStart > -1, 'Share modal must render a dedicated live preview section');
  const previewHtml = bodyEl.innerHTML.slice(previewStart);
  assert.ok(previewHtml.includes('Sello de cera roja.'), 'Live preview must include selected public block');
  assert.equal(
    previewHtml.includes('Contiene tinta invisible.'),
    false,
    'Anti-spoiler preview must NOT show unchecked private block body'
  );
  assert.equal(confirmBtn.disabled, false);

  // Switch to specific player Ana and confirm
  ctx.journalShareTargetMode = 'players';
  ctx.journalShareSeatKeys = new Set(['inv-1']);
  ctx.journalShareIncludeImage = false;
  ctx.renderJournalShareModal(Service.state);
  assert.ok(bodyEl.innerHTML.includes('Ana'), 'Preview label must reflect chosen player');

  const res = ctx.confirmJournalShare();
  assert.equal(res.ok, true);
  assert.equal(modalEl.classList.contains('is-open'), false, 'Confirming share must close modal');
  assert.equal(note.revealMedia, false, 'Unchecking image toggle must persist revealMedia=false');
});

test('S5: JournalPresentationViewMethods renders revealed blocks and highlights newly revealed block', () => {
  const html = JournalPresentationViewMethods.buildPresentationBlocksHtml.call(
    { escapeHtml: (s) => String(s ?? '') },
    [
      { id: 'b1', heading: 'Inscripción', body: 'Solo el digno pasará.' },
      { id: 'b2', heading: 'Traducción', body: 'Arrodillarse ante el león.' }
    ],
    'b2'
  );
  assert.ok(html.includes('Inscripción'));
  assert.ok(html.includes('Traducción'));
  assert.ok(html.includes('Nuevo fragmento'));
});

test('UX Audit (Item 5): Revealed note annotations separate Read mode from + Apunte / Editar draft with Guardar', () => {
  Service.state = createInitialState();
  Service.state.role = 'player';
  Service.state.isHostGm = false;
  Service.state.activeInviteId = 'inv-1';
  Service.state.journalOpen = true;
  Service.state.journal.receivedReveals = [
    {
      id: 'rev-annot-1',
      title: 'Mapa antiguo',
      blocks: [{ id: 'rb1', heading: 'Pista', body: 'Entrada tras la cascada.' }]
    }
  ];
  Service.activeJournalNoteId = 'rev-annot-1';
  Service.activeJournalNoteKind = 'revealed';

  const ctx = makeJournalViewCtx({
    renderJournal: () => {}
  });

  // 1. Default Read mode for annotations: NO textareas when not drafting
  const readHtml = ctx.buildJournalInnerHtml(Service.state);
  assert.equal(readHtml.includes('<textarea'), false, 'Revealed note annotations must NOT clutter Read view with textareas');

  // 2. Clicking + Apunte toggles draft without persisting; re-clicking cancels
  ctx.toggleRevealedAnnotDraft('rev-annot-1');
  const pj = Service.ensurePlayerJournal('inv-1');
  assert.equal((pj.revealedAnnotations['rev-annot-1']?.blocks || []).length, 0, '+ Apunte must NOT immediately create an empty annotation');
  const draftHtml = ctx.buildJournalInnerHtml(Service.state);
  assert.ok(draftHtml.includes('data-journal-add-annot="rev-annot-1" class="portal-btn portal-btn-accent'), '+ Apunte must turn purple while drafting');
  assert.ok(draftHtml.includes('data-annot-draft-save="1"'), 'Annotation draft must show explicit Guardar button');

  ctx.toggleRevealedAnnotDraft('rev-annot-1');
  assert.equal(ctx.journalAnnotDraft, null, 'Clicking + Apunte again must cancel draft');

  // 3. Reopen draft, fill, and save -> persists 1 annotation and returns to clean Read view
  ctx.toggleRevealedAnnotDraft('rev-annot-1');
  ctx.journalAnnotDraft.heading = 'Plan';
  ctx.journalAnnotDraft.body = 'Traer cuerdas.';
  ctx.saveRevealedAnnotDraft();

  const savedBlocks = pj.revealedAnnotations['rev-annot-1']?.blocks || [];
  assert.equal(savedBlocks.length, 1);
  assert.equal(savedBlocks[0].heading, 'Plan');
  assert.equal(savedBlocks[0].body, 'Traer cuerdas.');
  assert.equal(ctx.journalAnnotDraft, null);

  const afterSaveHtml = ctx.buildJournalInnerHtml(Service.state);
  assert.ok(afterSaveHtml.includes('Traer cuerdas.'));
  assert.equal(afterSaveHtml.includes('<textarea'), false, 'After Guardar, annotations must return to clean Read view');
});
