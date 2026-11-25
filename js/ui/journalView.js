/* ==========================================================================
   JOURNAL VIEW: DIARIO UNIFICADO ESTILO APPLE (LISTA, LECTURA Y BORRADOR)
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261125a1';
import { Service } from '../core/service.js?v=20261125a1';

const ICON_EYE_SVG = '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/></svg>';
const ICON_EDIT_SVG = '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_TRASH_SVG = '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
const ICON_CAMERA_SVG = '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

function resolveJournalScopeData(state) {
  const isGm = state.role === 'gm';
  const j = Service.ensureJournalState();
  if (isGm) {
    const notes = (j.gmNotes || []).map((n) => ({ ...n, _kind: 'gm' }));
    const folderSet = new Set(j.gmFolders || []);
    notes.forEach((n) => { if (n.folder) folderSet.add(n.folder); });
    return { isGm: true, folders: Array.from(folderSet), notes, reveals: [], pj: null };
  }
  const selfSeat = Service.getSelfSeatKey();
  const pj = Service.ensurePlayerJournal(selfSeat) || { folders: [], notes: [], revealedAnnotations: {} };
  const reveals =
    state.isHostGm && Array.isArray(j.gmNotes) && j.gmNotes.length > 0
      ? Selector.extractJournalForSeat(state, selfSeat).receivedReveals
      : (j.receivedReveals || []);
  const ownNotes = (pj.notes || []).map((n) => ({ ...n, _kind: 'player' }));
  const revNotes = reveals.map((r) => {
    const ann = pj.revealedAnnotations?.[r.id] || { folder: '', blocks: [] };
    return {
      ...r,
      folder: ann.folder || r.gmFolder || '',
      _kind: 'revealed',
      _annotBlocks: Array.isArray(ann.blocks) ? ann.blocks : []
    };
  });
  const folderSet = new Set(pj.folders || []);
  [...ownNotes, ...revNotes].forEach((n) => { if (n.folder) folderSet.add(n.folder); });
  return { isGm: false, folders: Array.from(folderSet), notes: [...revNotes, ...ownNotes], reveals: revNotes, pj };
}

function buildImageGalleryHtml(esc, currentMediaId) {
  const images = Service.getAvailableTableImagesForCurrentRole();
  if (!images.length) {
    return '<div class="text-[10.5px] opacity-60 text-center py-2">No hay imágenes visibles en la mesa todavía.</div>';
  }
  return `<div class="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1">${images
    .map(
      (img) => `<button type="button" data-journal-select-media="${esc(img.mediaId)}" class="portal-subpanel rounded-xl p-1 flex flex-col items-center gap-1 hover:opacity-100 transition-all ${img.mediaId === currentMediaId ? 'ring-2' : 'opacity-85'}" style="${img.mediaId === currentMediaId ? 'border-color: var(--accent-primary);' : ''}" title="${esc(img.label)}"><img src="${esc(img.url)}" alt="${esc(img.label)}" class="w-12 h-12 object-contain rounded-lg" /><span class="text-[9.5px] truncate max-w-full">${esc(img.label)}</span></button>`
    )
    .join('')}</div>`;
}

function buildReadBlockHtml(esc, blk, isGm) {
  const vis = blk.visibility || 'private';
  const allowedCount = Array.isArray(blk.allowedSeatKeys) ? blk.allowedSeatKeys.length : 0;
  const visText =
    vis === 'all' ? 'Todos' : vis === 'players' ? (allowedCount ? `Elegidos (${allowedCount})` : 'Elegidos') : 'Privado';
  const gmPill = isGm
    ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-semibold shrink-0 ${vis === 'private' ? 'portal-panel opacity-65' : 'portal-btn-accent'}">${visText}</span>`
    : '';
  const showHeader = Boolean(blk.heading || isGm);
  return `<div class="portal-subpanel rounded-xl px-2.5 py-2 flex flex-col gap-1">
    ${
      showHeader
        ? `<div class="flex items-center justify-between gap-2">${blk.heading ? `<span class="text-[11.5px] font-semibold leading-snug truncate">${esc(blk.heading)}</span>` : '<span class="text-[10px] opacity-45">Bloque</span>'}${gmPill}</div>`
        : ''
    }
    <p class="text-[11.5px] leading-relaxed opacity-90 whitespace-pre-wrap break-words">${blk.body ? esc(blk.body) : '<span class="opacity-45 italic">Sin contenido</span>'}</p>
  </div>`;
}

function buildEditBlockHtml(esc, blk, idx) {
  return `<div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1.5">
    <div class="flex items-center gap-1">
      <input type="text" data-jblk-heading="${esc(blk.id)}" data-journal-keep-focus="1" value="${esc(blk.heading)}" placeholder="Sección ${idx + 1} (opcional)..." class="portal-input px-2 py-1 text-[11px] font-semibold flex-1 min-w-0" />
      <button type="button" data-jblk-move="${esc(blk.id)}" data-dir="-1" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-lg text-[10px]" title="Subir">↑</button>
      <button type="button" data-jblk-move="${esc(blk.id)}" data-dir="1" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-lg text-[10px]" title="Bajar">↓</button>
      <button type="button" data-jblk-del="${esc(blk.id)}" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-lg text-rose-400 text-[10px]" title="Eliminar bloque">✕</button>
    </div>
    <textarea rows="3" data-jblk-body="${esc(blk.id)}" data-journal-keep-focus="1" placeholder="Texto del bloque..." class="portal-input px-2 py-1.5 text-[11px] resize-y min-h-[56px]">${esc(blk.body)}</textarea>
  </div>`;
}

function buildRevealedNoteHtml(ctx, esc, activeNote, headerHtml) {
  const imgUrl = Service.resolveMediaUrl?.(activeNote.mediaId, activeNote.imageUrl) || activeNote.imageUrl || '';
  const annotBlocks = activeNote._annotBlocks || [];
  const draft = ctx.journalAnnotDraft && ctx.journalAnnotDraft.gmNoteId === activeNote.id ? ctx.journalAnnotDraft : null;
  const isAddingNew = Boolean(draft && !draft.blockId);

  const buildAnnotDraftCard = () => `<div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1.5" style="border-color: var(--accent-primary);">
    <input type="text" data-annot-draft-heading="1" data-journal-keep-focus="1" value="${esc(draft.heading)}" placeholder="Subtítulo..." class="portal-input px-2 py-1 text-[11px] font-semibold" />
    <textarea rows="2" data-annot-draft-body="1" data-journal-keep-focus="1" placeholder="Escribir apunte personal..." class="portal-input px-2 py-1 text-[11px] resize-y min-h-[48px]">${esc(draft.body)}</textarea>
    <div class="flex items-center justify-end gap-1.5">
      <button type="button" data-annot-draft-cancel="1" class="portal-btn portal-subpanel px-2.5 py-0.5 rounded-full text-[10px] font-semibold">Cancelar</button>
      <button type="button" data-annot-draft-save="1" class="portal-btn portal-btn-accent px-2.5 py-0.5 rounded-full text-[10px] font-semibold">Guardar</button>
    </div>
  </div>`;

  const annotListHtml = annotBlocks.length
    ? annotBlocks
        .map((ab) => {
          if (draft && draft.blockId === ab.id) return buildAnnotDraftCard();
          return `<div class="portal-subpanel rounded-xl px-2.5 py-2 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              ${ab.heading ? `<span class="text-[11px] font-semibold leading-snug truncate">${esc(ab.heading)}</span>` : '<span class="text-[10px] opacity-45">Apunte</span>'}
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-annot-edit="${esc(ab.id)}" data-annot-gm="${esc(activeNote.id)}" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-full opacity-80 hover:opacity-100" title="Editar apunte">${ICON_EDIT_SVG}</button>
                <button type="button" data-annot-del="${esc(ab.id)}" data-annot-gm="${esc(activeNote.id)}" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-full text-rose-400 text-[10px]" title="Eliminar apunte">✕</button>
              </div>
            </div>
            <p class="text-[11px] leading-relaxed opacity-90 whitespace-pre-wrap break-words">${ab.body ? esc(ab.body) : '<span class="opacity-45 italic">Sin contenido</span>'}</p>
          </div>`;
        })
        .join('')
    : (!isAddingNew ? '<div class="text-[10.5px] opacity-55 text-center py-2">Agrega tus propios apuntes debajo de la nota del DJ.</div>' : '');

  return `${headerHtml}
    <div class="portal-subpanel rounded-xl p-2.5 flex flex-col gap-2 shrink-0">
      <strong class="text-sm font-bold leading-snug">${esc(activeNote.title)}</strong>
      ${imgUrl ? `<div class="rounded-xl overflow-hidden bg-black/35 flex items-center justify-center max-h-44 p-1.5 shrink-0"><img src="${esc(imgUrl)}" alt="${esc(activeNote.title)}" class="max-h-40 object-contain rounded-lg" /></div>` : ''}
      <input type="text" data-journal-rev-folder="${esc(activeNote.id)}" data-journal-keep-focus="1" value="${esc(activeNote.folder || '')}" placeholder="Clasificar en mi carpeta..." class="portal-input px-2.5 py-1 text-[11px]" />
      <div class="flex flex-col gap-1.5 pt-1">
        ${(activeNote.blocks || [])
          .map(
            (b) => `<div class="portal-panel rounded-xl p-2.5 flex flex-col gap-1">${b.heading ? `<span class="font-semibold text-[11px]">${esc(b.heading)}</span>` : ''}<p class="text-[11px] leading-relaxed opacity-90 whitespace-pre-wrap break-words">${esc(b.body)}</p></div>`
          )
          .join('')}
      </div>
    </div>
    <div class="flex flex-col gap-1.5 pt-1 shrink-0">
      <div class="flex items-center justify-between">
        <span class="text-[10.5px] font-semibold uppercase tracking-wider opacity-70">Mis apuntes</span>
        <button type="button" data-journal-add-annot="${esc(activeNote.id)}" class="portal-btn ${isAddingNew ? 'portal-btn-accent' : 'portal-subpanel'} px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold">+ Apunte</button>
      </div>
      ${annotListHtml}
      ${isAddingNew ? buildAnnotDraftCard() : ''}
    </div>`;
}

function buildDetailHtml(ctx, esc, scopeData, activeNote) {
  const isGm = scopeData.isGm;
  const isRevealed = activeNote._kind === 'revealed';
  const isDraft = activeNote._kind === 'draft';
  const imgUrl = Service.resolveMediaUrl?.(activeNote.mediaId, activeNote.imageUrl) || activeNote.imageUrl || '';

  if (isRevealed) {
    const revHeaderHtml = `<div class="flex items-center justify-between gap-1.5 pb-1.5 border-b shrink-0" style="border-color: var(--hairline);">
      <button type="button" data-journal-back="1" class="portal-btn portal-subpanel px-2.5 py-1 rounded-full text-[11px] font-semibold">← Notas</button>
      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold portal-subpanel opacity-85">Compartida · Solo lectura</span>
    </div>`;
    return buildRevealedNoteHtml(ctx, esc, activeNote, revHeaderHtml);
  }

  if (!isDraft) {
    const blocksReadHtml = (activeNote.blocks || []).length
      ? (activeNote.blocks || []).map((blk) => buildReadBlockHtml(esc, blk, isGm)).join('')
      : '<div class="text-[11px] opacity-55 text-center py-4">Nota vacía. Pulsa <b>Editar</b> para escribir.</div>';

    const readHeaderHtml = `<div class="flex items-center justify-between gap-1.5 pb-1.5 border-b shrink-0" style="border-color: var(--hairline);">
      <button type="button" data-journal-back="1" class="portal-btn portal-subpanel px-2.5 py-1 rounded-full text-[11px] font-semibold">← Notas</button>
      <div class="flex items-center gap-1">
        ${isGm ? `<button type="button" data-journal-open-share="1" class="portal-btn portal-btn-accent px-2.5 py-1 rounded-full text-[10.5px] font-semibold gap-1" title="Elegir a quién mostrar y ver vista previa">${ICON_EYE_SVG}<span>Mostrar</span></button>` : ''}
        <button type="button" data-journal-start-edit="1" class="portal-btn portal-subpanel px-2.5 py-1 rounded-full text-[10.5px] font-semibold gap-1" title="Editar nota">${ICON_EDIT_SVG}<span>Editar</span></button>
        <button type="button" data-journal-delete-note="${esc(activeNote.id)}" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-full text-rose-400/80 hover:text-rose-400" title="Eliminar nota" aria-label="Eliminar nota">${ICON_TRASH_SVG}</button>
      </div>
    </div>`;

    return `${readHeaderHtml}
      <div class="flex flex-col gap-1 pt-0.5 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-bold leading-snug break-words">${esc(activeNote.title || 'Sin título')}</h3>
          ${activeNote.folder ? `<span class="px-2 py-0.5 rounded-full text-[9.5px] font-semibold portal-subpanel opacity-80 shrink-0">${esc(activeNote.folder)}</span>` : ''}
        </div>
      </div>
      ${imgUrl ? `<div class="rounded-xl overflow-hidden bg-black/35 flex items-center justify-center max-h-44 p-1.5 shrink-0"><img src="${esc(imgUrl)}" alt="${esc(activeNote.title)}" class="max-h-40 object-contain rounded-lg" /></div>` : ''}
      <div class="flex flex-col gap-1.5 shrink-0">${blocksReadHtml}</div>`;
  }

  const folderOptionsHtml = scopeData.folders.map((f) => `<option value="${esc(f)}"></option>`).join('');
  const showImageBox = Boolean(imgUrl || ctx.journalImagePickerOpen);
  const imageSectionHtml = showImageBox
    ? `<div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1.5 shrink-0">
        <div class="flex items-center justify-between gap-1.5 flex-wrap">
          <div class="flex items-center gap-1.5 min-w-0">
            ${imgUrl ? `<img src="${esc(imgUrl)}" alt="" class="w-9 h-9 object-contain rounded-lg bg-black/30 shrink-0" />` : ''}
            <button type="button" data-journal-pick-media="1" class="portal-btn portal-subpanel px-2 py-1 rounded-lg text-[10.5px] font-semibold">${ctx.journalImagePickerOpen ? 'Cerrar galería' : 'Tokens / Mesa'}</button>
            <button type="button" data-journal-capture-view="1" class="portal-btn portal-subpanel px-2 py-1 rounded-lg text-[10.5px] font-semibold gap-1" title="Guardar foto superior de lo que ves ahora en la mesa">${ICON_CAMERA_SVG}<span>Capturar vista</span></button>
          </div>
          ${imgUrl ? `<button type="button" data-journal-clear-media="1" class="portal-btn portal-subpanel px-2 py-1 rounded-lg text-[10px] opacity-75 hover:opacity-100">Quitar</button>` : ''}
        </div>
        ${
          isGm && ctx.journalImagePickerOpen
            ? `<div class="flex items-center gap-1.5 pt-0.5"><input type="url" data-journal-gm-img-url="1" data-journal-keep-focus="1" placeholder="Pegar URL de imagen (solo DJ)..." class="portal-input px-2 py-1 text-[10.5px] flex-1 min-w-0" /><label class="portal-btn portal-subpanel px-2 py-1 rounded-lg text-[10.5px] cursor-pointer shrink-0">Subir<input type="file" data-journal-gm-img-file="1" accept="image/*" class="hidden" /></label></div>`
            : ''
        }
        ${ctx.journalImagePickerOpen ? buildImageGalleryHtml(esc, activeNote.mediaId) : ''}
      </div>`
    : `<div class="flex items-center gap-1.5 flex-wrap shrink-0"><button type="button" data-journal-pick-media="1" class="portal-btn portal-subpanel px-2.5 py-1 rounded-full text-[10.5px] opacity-85 hover:opacity-100">+ Imagen de mesa</button><button type="button" data-journal-capture-view="1" class="portal-btn portal-subpanel px-2.5 py-1 rounded-full text-[10.5px] opacity-85 hover:opacity-100 gap-1" title="Guardar foto superior de lo que ves ahora en la mesa">${ICON_CAMERA_SVG}<span>Capturar vista</span></button></div>`;

  const blocksEditHtml = (activeNote.blocks || []).map((blk, idx) => buildEditBlockHtml(esc, blk, idx)).join('');
  const editHeaderHtml = `<div class="flex items-center justify-between gap-1.5 pb-1.5 border-b shrink-0" style="border-color: var(--hairline);">
    <button type="button" data-journal-cancel-draft="1" class="portal-btn portal-subpanel px-2.5 py-1 rounded-full text-[11px] font-semibold">Cancelar</button>
    <button type="button" data-journal-save-draft="1" class="portal-btn portal-btn-accent px-3 py-1 rounded-full text-[10.5px] font-semibold" title="Guardar nota en el Diario">Guardar</button>
  </div>`;

  return `${editHeaderHtml}
    <div class="flex flex-col gap-1.5 shrink-0">
      <input type="text" data-journal-note-title="${esc(activeNote.id)}" data-journal-keep-focus="1" value="${esc(activeNote.title)}" placeholder="Título de la nota..." class="portal-input px-2.5 py-1.5 text-xs font-bold" />
      <input type="text" list="journalFolderDatalist" data-journal-note-folder="${esc(activeNote.id)}" data-journal-keep-focus="1" value="${esc(activeNote.folder || '')}" placeholder="Carpeta (opcional: PNJs, Pistas...)" class="portal-input px-2.5 py-1 text-[11px]" />
      <datalist id="journalFolderDatalist">${folderOptionsHtml}</datalist>
    </div>
    ${imageSectionHtml}
    <div class="flex flex-col gap-1.5 shrink-0">
      <div class="flex items-center justify-between">
        <span class="text-[10.5px] font-semibold uppercase tracking-wider opacity-65">Bloques</span>
        <button type="button" data-journal-add-block="1" class="portal-btn portal-btn-accent px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold">+ Bloque</button>
      </div>
      ${blocksEditHtml}
    </div>`;
}

export const JournalViewMethods = {
  journalFilterFolder: '',
  journalSearchQuery: '',
  journalImagePickerOpen: false,
  journalDraftNote: null,
  journalAnnotDraft: null,
  _draftBlockSeq: 1,
  _suppressJournalRender: false,

  bindJournalEvents() {
    this.els.btnNewJournalFolder?.addEventListener('click', () => {
      const form = this.els.journalFolderForm;
      if (!form) return;
      const open = form.classList.contains('hidden');
      form.classList.toggle('hidden', !open);
      form.classList.toggle('flex', open);
      this.els.btnNewJournalFolder?.classList.toggle('portal-btn-accent', open);
      if (open) this.els.inpNewJournalFolder?.focus();
    });

    this.els.journalFolderForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.els.inpNewJournalFolder?.value.trim() || '';
      if (!name) return;
      Service.createJournalFolder(name);
      if (this.els.inpNewJournalFolder) this.els.inpNewJournalFolder.value = '';
      this.els.journalFolderForm.classList.add('hidden');
      this.els.journalFolderForm.classList.remove('flex');
      this.els.btnNewJournalFolder?.classList.remove('portal-btn-accent');
      this.journalFilterFolder = name;
      this.renderJournal(Service.state);
      this.showActionToast(`Carpeta "${name}" creada en el Diario.`);
    });

    this.els.btnNewJournalNote?.addEventListener('click', () => {
      const isCreatingNew = Boolean(this.journalDraftNote && !this.journalDraftNote._editingNoteId);
      if (isCreatingNew) {
        this.cancelDraftJournalNote();
        return;
      }
      if (this.els.journalFolderForm) {
        this.els.journalFolderForm.classList.add('hidden');
        this.els.journalFolderForm.classList.remove('flex');
      }
      this.els.btnNewJournalFolder?.classList.remove('portal-btn-accent');
      const folder = this.journalFilterFolder && this.journalFilterFolder !== '__revealed__' ? this.journalFilterFolder : '';
      Service.activeJournalNoteId = '';
      Service.activeJournalNoteKind = '';
      this.journalDraftNote = {
        id: '__draft__',
        _kind: 'draft',
        _editingNoteId: '',
        title: '',
        folder,
        mediaId: '',
        imageUrl: '',
        _pendingSnapshotDataUrl: '',
        _pendingSnapshotLabel: '',
        blocks: [
          {
            id: `draft_blk_${this._draftBlockSeq++}`,
            heading: '',
            body: '',
            visibility: Service.state.role === 'gm' ? 'private' : 'all',
            allowedSeatKeys: []
          }
        ]
      };
      this.journalImagePickerOpen = false;
      this.renderJournal(Service.state);
    });
  },

  startEditJournalNote(note) {
    if (!note || note._kind === 'revealed') return;
    this.journalDraftNote = {
      id: note.id,
      _kind: 'draft',
      _editingNoteId: note.id,
      title: String(note.title || ''),
      folder: String(note.folder || ''),
      mediaId: String(note.mediaId || ''),
      imageUrl: String(note.imageUrl || ''),
      _pendingSnapshotDataUrl: '',
      _pendingSnapshotLabel: '',
      blocks: (Array.isArray(note.blocks) && note.blocks.length
        ? note.blocks
        : [{ id: `draft_blk_${this._draftBlockSeq++}`, heading: '', body: '', visibility: 'private', allowedSeatKeys: [] }]
      ).map((b) => ({
        id: String(b.id || `draft_blk_${this._draftBlockSeq++}`),
        heading: String(b.heading || ''),
        body: String(b.body || ''),
        visibility: b.visibility || 'private',
        allowedSeatKeys: Array.isArray(b.allowedSeatKeys) ? [...b.allowedSeatKeys] : []
      }))
    };
    this.journalImagePickerOpen = false;
    this.renderJournal(Service.state);
  },

  cancelDraftJournalNote() {
    const editingId = this.journalDraftNote?._editingNoteId || '';
    this.journalDraftNote = null;
    this.journalImagePickerOpen = false;
    if (editingId) {
      Service.activeJournalNoteId = editingId;
      Service.activeJournalNoteKind = Service.state.role === 'gm' ? 'gm' : 'player';
    } else {
      Service.activeJournalNoteId = '';
      Service.activeJournalNoteKind = '';
    }
    this.renderJournal(Service.state);
  },

  _syncDraftInputsFromDom() {
    const draft = this.journalDraftNote;
    const content = this.els?.journalContent;
    if (!draft || !content) return;
    const titleInp = content.querySelector('[data-journal-note-title]');
    if (titleInp) draft.title = titleInp.value;
    const folderInp = content.querySelector('[data-journal-note-folder]');
    if (folderInp) draft.folder = folderInp.value;
    content.querySelectorAll('[data-jblk-heading]').forEach((inp) => {
      const blk = draft.blocks.find((b) => b.id === inp.dataset.jblkHeading);
      if (blk) blk.heading = inp.value;
    });
    content.querySelectorAll('[data-jblk-body]').forEach((inp) => {
      const blk = draft.blocks.find((b) => b.id === inp.dataset.jblkBody);
      if (blk) blk.body = inp.value;
    });
  },

  saveDraftJournalNote() {
    const draft = this.journalDraftNote;
    if (!draft) return null;
    this._syncDraftInputsFromDom();
    const cleanTitle = String(draft.title || '').trim() || 'Nueva nota';
    const cleanFolder = String(draft.folder || '').trim();
    const editingId = draft._editingNoteId || '';

    let savedNote = null;
    if (editingId) {
      const patch = {
        title: cleanTitle,
        folder: cleanFolder,
        blocks: draft.blocks
      };
      if (!draft._pendingSnapshotDataUrl) {
        patch.mediaId = draft.mediaId || '';
        patch.imageUrl = draft.imageUrl || '';
      }
      savedNote = Service.updateJournalNote(editingId, patch);
    } else {
      savedNote = Service.createJournalNote({
        title: cleanTitle,
        folder: cleanFolder,
        mediaId: draft.mediaId || '',
        imageUrl: draft._pendingSnapshotDataUrl ? '' : draft.imageUrl || '',
        blocks: draft.blocks
      });
    }
    if (!savedNote) return null;

    if (draft._pendingSnapshotDataUrl) {
      Service.attachTableSnapshotToJournalNote(
        savedNote.id,
        draft._pendingSnapshotDataUrl,
        draft._pendingSnapshotLabel || savedNote.title
      );
    }

    this.journalDraftNote = null;
    Service.activeJournalNoteId = savedNote.id;
    Service.activeJournalNoteKind = Service.state.role === 'gm' ? 'gm' : 'player';
    this.journalImagePickerOpen = false;
    this.renderJournal(Service.state);
    return savedNote;
  },

  toggleRevealedAnnotDraft(gmNoteId, blockId = '') {
    const gid = String(gmNoteId || '');
    const bid = String(blockId || '');
    if (this.journalAnnotDraft && this.journalAnnotDraft.gmNoteId === gid && this.journalAnnotDraft.blockId === bid) {
      this.journalAnnotDraft = null;
      this.renderJournal(Service.state);
      return;
    }
    if (bid) {
      const scope = resolveJournalScopeData(Service.state);
      const rev = scope.notes.find((n) => n._kind === 'revealed' && n.id === gid);
      const existing = rev?._annotBlocks?.find((b) => b.id === bid);
      if (!existing) return;
      this.journalAnnotDraft = { gmNoteId: gid, blockId: bid, heading: String(existing.heading || ''), body: String(existing.body || '') };
    } else {
      this.journalAnnotDraft = { gmNoteId: gid, blockId: '', heading: '', body: '' };
    }
    this.renderJournal(Service.state);
  },

  cancelRevealedAnnotDraft() {
    this.journalAnnotDraft = null;
    this.renderJournal(Service.state);
  },

  saveRevealedAnnotDraft() {
    const draft = this.journalAnnotDraft;
    if (!draft) return null;
    const content = this.els?.journalContent;
    if (content) {
      const h = content.querySelector('[data-annot-draft-heading]');
      if (h) draft.heading = h.value;
      const b = content.querySelector('[data-annot-draft-body]');
      if (b) draft.body = b.value;
    }
    const res = draft.blockId
      ? Service.updateRevealedNoteAnnotationBlock(draft.gmNoteId, draft.blockId, { heading: draft.heading, body: draft.body })
      : Service.addRevealedNoteAnnotationBlock(draft.gmNoteId, { heading: draft.heading, body: draft.body });
    this.journalAnnotDraft = null;
    this.renderJournal(Service.state);
    return res;
  },

  buildJournalInnerHtml(state) {
    const esc = (s) => this.escapeHtml(s);
    const scope = resolveJournalScopeData(state);
    if (this.journalDraftNote) {
      return buildDetailHtml(this, esc, scope, this.journalDraftNote);
    }
    const activeId = Service.activeJournalNoteId;
    const activeKind = Service.activeJournalNoteKind;
    const activeNote = activeId
      ? scope.notes.find((n) => n.id === activeId && (!activeKind || n._kind === activeKind))
      : null;

    if (activeNote) {
      return buildDetailHtml(this, esc, scope, activeNote);
    }

    const q = (this.journalSearchQuery || '').toLowerCase().trim();
    const curFolder = this.journalFilterFolder || '';
    const filtered = scope.notes.filter((n) => {
      if (curFolder === '__revealed__' && n._kind !== 'revealed') return false;
      if (curFolder && curFolder !== '__revealed__' && (n.folder || '') !== curFolder) return false;
      if (!q) return true;
      return (
        (n.title || '').toLowerCase().includes(q) ||
        (n.folder || '').toLowerCase().includes(q) ||
        (n.blocks || []).some((b) => (b.heading || '').toLowerCase().includes(q) || (b.body || '').toLowerCase().includes(q))
      );
    });

    const folderPillsHtml = [
      `<button type="button" data-journal-folder="" class="portal-btn px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${!curFolder ? 'portal-btn-accent' : 'portal-subpanel opacity-80'}">Todas</button>`,
      ...(!scope.isGm && scope.reveals.length
        ? [`<button type="button" data-journal-folder="__revealed__" class="portal-btn px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${curFolder === '__revealed__' ? 'portal-btn-accent' : 'portal-subpanel opacity-80'}">Del DJ (${scope.reveals.length})</button>`]
        : []),
      ...scope.folders.map(
        (f) => `<button type="button" data-journal-folder="${esc(f)}" class="portal-btn px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${curFolder === f ? 'portal-btn-accent' : 'portal-subpanel opacity-80'}">${esc(f)}</button>`
      )
    ].join('');

    const cardsHtml = filtered.length
      ? filtered
          .map((n) => {
            const imgUrl = Service.resolveMediaUrl?.(n.mediaId, n.imageUrl) || n.imageUrl || '';
            const blkCount = Array.isArray(n.blocks) ? n.blocks.length : 0;
            const isShared = Boolean(n.revealedTo?.all || n.revealedTo?.seatKeys?.length);
            const badge =
              n._kind === 'revealed'
                ? '<span class="px-1.5 py-0.2 rounded-full text-[9px] font-semibold portal-btn-accent shrink-0">DJ</span>'
                : scope.isGm && isShared
                  ? '<span class="px-1.5 py-0.2 rounded-full text-[9px] font-semibold portal-subpanel shrink-0">Compartida</span>'
                  : '';
            return `<button type="button" data-journal-open-note="${esc(n.id)}" data-journal-open-kind="${esc(n._kind)}" class="portal-subpanel portal-comp-card rounded-xl p-1.5 pl-2 pr-2.5 flex items-center justify-between gap-2 text-left cursor-pointer w-full">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                ${imgUrl ? `<img src="${esc(imgUrl)}" alt="" class="w-9 h-9 rounded-lg object-contain bg-black/30 shrink-0" />` : '<div class="w-9 h-9 rounded-lg bg-black/25 flex items-center justify-center text-xs opacity-60 shrink-0">📖</div>'}
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5"><span class="font-semibold text-xs truncate">${esc(n.title)}</span>${badge}</div>
                  <div class="text-[10px] opacity-60 truncate">${n.folder ? `${esc(n.folder)} · ` : ''}${blkCount} ${blkCount === 1 ? 'bloque' : 'bloques'}</div>
                </div>
              </div>
              <span class="text-xs opacity-45 shrink-0">›</span>
            </button>`;
          })
          .join('')
      : '<div class="text-[11px] opacity-55 text-center py-6">Sin notas en esta vista. Crea una con el botón <b>+</b>.</div>';

    return `<div class="flex flex-wrap items-center gap-1 shrink-0">${folderPillsHtml}</div><div class="flex items-center gap-1.5 shrink-0"><input type="search" data-journal-search="1" data-journal-keep-focus="1" value="${esc(this.journalSearchQuery)}" placeholder="Buscar en el Diario..." class="portal-input rounded-xl px-3 py-1.5 text-xs flex-1 min-w-0" />${curFolder && curFolder !== '__revealed__' ? `<button type="button" data-journal-del-folder="${esc(curFolder)}" class="portal-btn portal-subpanel w-7 h-7 p-0 rounded-xl text-rose-400" title="Eliminar carpeta">${ICON_TRASH_SVG}</button>` : ''}</div><div class="flex flex-col gap-1.5 shrink-0">${cardsHtml}</div>`;
  },

  renderJournal(state) {
    const isCreatingNew = Boolean(this.journalDraftNote && !this.journalDraftNote._editingNoteId);
    this.els.btnNewJournalNote?.classList.toggle('portal-btn-accent', isCreatingNew);
    const content = this.els.journalContent;
    if (!content || !state.journalOpen || this._suppressJournalRender) return;
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    if (activeEl && content.contains(activeEl) && activeEl.dataset?.journalKeepFocus === '1') {
      return;
    }
    content.innerHTML = this.buildJournalInnerHtml(state);
    this._bindRenderedJournalContent(content, state);
  },

  _bindRenderedJournalContent(content, state) {
    content.querySelectorAll('[data-journal-folder]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.journalFilterFolder = btn.dataset.journalFolder || '';
        this.renderJournal(Service.state);
      });
    });
    content.querySelector('[data-journal-del-folder]')?.addEventListener('click', (e) => {
      Service.deleteJournalFolder(e.currentTarget.dataset.journalDelFolder);
      this.journalFilterFolder = '';
      this.renderJournal(Service.state);
    });
    content.querySelector('[data-journal-search]')?.addEventListener('input', (e) => {
      this.journalSearchQuery = e.target.value;
      this.renderJournal(Service.state);
    });

    content.querySelectorAll('[data-journal-open-note]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.journalDraftNote = null;
        Service.activeJournalNoteId = btn.dataset.journalOpenNote;
        Service.activeJournalNoteKind = btn.dataset.journalOpenKind || '';
        this.journalImagePickerOpen = false;
        this.renderJournal(Service.state);
      });
    });

    content.querySelector('[data-journal-back]')?.addEventListener('click', () => {
      this.journalDraftNote = null;
      Service.activeJournalNoteId = '';
      Service.activeJournalNoteKind = '';
      this.journalImagePickerOpen = false;
      this.renderJournal(Service.state);
    });
    content.querySelector('[data-journal-cancel-draft]')?.addEventListener('click', () => {
      this.cancelDraftJournalNote();
    });
    content.querySelector('[data-journal-save-draft]')?.addEventListener('click', () => {
      this.saveDraftJournalNote();
    });
    content.querySelector('[data-journal-start-edit]')?.addEventListener('click', () => {
      const scope = resolveJournalScopeData(Service.state);
      const active = scope.notes.find((n) => n.id === Service.activeJournalNoteId && (!Service.activeJournalNoteKind || n._kind === Service.activeJournalNoteKind));
      if (active) this.startEditJournalNote(active);
    });
    content.querySelector('[data-journal-open-share]')?.addEventListener('click', () => {
      if (Service.activeJournalNoteId) this.openJournalShareModal?.(Service.activeJournalNoteId);
    });
    content.querySelector('[data-journal-delete-note]')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.journalDeleteNote;
      this.journalDraftNote = null;
      Service.activeJournalNoteId = '';
      Service.activeJournalNoteKind = '';
      Service.deleteJournalNote(id);
      this.showActionToast('Nota eliminada del Diario.');
    });

    if (this.journalDraftNote) {
      const draft = this.journalDraftNote;
      content.querySelector('[data-journal-note-title]')?.addEventListener('input', (e) => { draft.title = e.target.value; });
      content.querySelector('[data-journal-note-folder]')?.addEventListener('input', (e) => { draft.folder = e.target.value; });
      content.querySelector('[data-journal-pick-media]')?.addEventListener('click', () => {
        this._syncDraftInputsFromDom();
        this.journalImagePickerOpen = !this.journalImagePickerOpen;
        this.renderJournal(Service.state);
      });
      content.querySelector('[data-journal-capture-view]')?.addEventListener('click', () => {
        this._syncDraftInputsFromDom();
        const dataUrl = this.captureTableSnapshotDataUrl?.();
        if (!dataUrl) {
          this.showActionToast('No se pudo capturar la vista actual de la mesa.');
          return;
        }
        if (!dataUrl.startsWith('data:image/webp;base64,') || dataUrl.length > 350000) {
          this.showActionToast('La captura excedió el tamaño permitido.');
          return;
        }
        const timeTag = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        draft.mediaId = '';
        draft.imageUrl = dataUrl;
        draft._pendingSnapshotDataUrl = dataUrl;
        draft._pendingSnapshotLabel = `Vista (${timeTag})`;
        this.journalImagePickerOpen = false;
        this.renderJournal(Service.state);
        this.showActionToast('Vista de mesa capturada en la nota.');
      });
      content.querySelector('[data-journal-clear-media]')?.addEventListener('click', () => {
        this._syncDraftInputsFromDom();
        draft.mediaId = '';
        draft.imageUrl = '';
        draft._pendingSnapshotDataUrl = '';
        draft._pendingSnapshotLabel = '';
        this.renderJournal(Service.state);
      });
      content.querySelectorAll('[data-journal-select-media]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._syncDraftInputsFromDom();
          this.journalImagePickerOpen = false;
          draft.mediaId = btn.dataset.journalSelectMedia;
          draft.imageUrl = '';
          draft._pendingSnapshotDataUrl = '';
          this.renderJournal(Service.state);
        });
      });
      content.querySelector('[data-journal-gm-img-url]')?.addEventListener('change', (e) => {
        const url = e.target.value.trim();
        if (!url) return;
        this._syncDraftInputsFromDom();
        draft.mediaId = '';
        draft.imageUrl = url;
        draft._pendingSnapshotDataUrl = '';
        this.renderJournal(Service.state);
      });
      content.querySelector('[data-journal-gm-img-file]')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        this._syncDraftInputsFromDom();
        const dataUrl = await Service.compressImageFile(file, 1200, 0.84);
        draft.mediaId = '';
        draft.imageUrl = dataUrl;
        draft._pendingSnapshotDataUrl = '';
        this.renderJournal(Service.state);
      });
      content.querySelector('[data-journal-add-block]')?.addEventListener('click', () => {
        this._syncDraftInputsFromDom();
        draft.blocks.push({
          id: `draft_blk_${this._draftBlockSeq++}`,
          heading: '',
          body: '',
          visibility: state.role === 'gm' ? 'private' : 'all',
          allowedSeatKeys: []
        });
        this.renderJournal(Service.state);
      });
      content.querySelectorAll('[data-jblk-heading]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const blk = draft.blocks.find((b) => b.id === inp.dataset.jblkHeading);
          if (blk) blk.heading = inp.value;
        });
      });
      content.querySelectorAll('[data-jblk-body]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const blk = draft.blocks.find((b) => b.id === inp.dataset.jblkBody);
          if (blk) blk.body = inp.value;
        });
      });
      content.querySelectorAll('[data-jblk-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (draft.blocks.length <= 1) return;
          this._syncDraftInputsFromDom();
          draft.blocks = draft.blocks.filter((b) => b.id !== btn.dataset.jblkDel);
          this.renderJournal(Service.state);
        });
      });
      content.querySelectorAll('[data-jblk-move]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._syncDraftInputsFromDom();
          const idx = draft.blocks.findIndex((b) => b.id === btn.dataset.jblkMove);
          const nextIdx = idx + (Number(btn.dataset.dir) || 1);
          if (idx < 0 || nextIdx < 0 || nextIdx >= draft.blocks.length) return;
          const [moved] = draft.blocks.splice(idx, 1);
          draft.blocks.splice(nextIdx, 0, moved);
          this.renderJournal(Service.state);
        });
      });
      return;
    }

    const noteId = Service.activeJournalNoteId;
    if (!noteId) return;

    const commitInline = (fn) => {
      this._suppressJournalRender = true;
      try {
        fn();
      } finally {
        this._suppressJournalRender = false;
      }
    };

    content.querySelector('[data-journal-rev-folder]')?.addEventListener('change', (e) =>
      commitInline(() => Service.setRevealedNotePlayerFolder(noteId, e.target.value))
    );
    content.querySelector('[data-journal-add-annot]')?.addEventListener('click', () => this.toggleRevealedAnnotDraft(noteId, ''));
    content.querySelector('[data-annot-draft-cancel]')?.addEventListener('click', () => this.cancelRevealedAnnotDraft());
    content.querySelector('[data-annot-draft-save]')?.addEventListener('click', () => this.saveRevealedAnnotDraft());
    content.querySelectorAll('[data-annot-edit]').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleRevealedAnnotDraft(btn.dataset.annotGm, btn.dataset.annotEdit));
    });
    content.querySelectorAll('[data-annot-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.journalAnnotDraft?.blockId === btn.dataset.annotDel) this.journalAnnotDraft = null;
        Service.deleteRevealedNoteAnnotationBlock(btn.dataset.annotGm, btn.dataset.annotDel);
      });
    });
  }
};
