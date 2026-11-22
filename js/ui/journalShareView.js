/* ==========================================================================
   JOURNAL SHARE VIEW: MODAL CENTRAL ANTI-SPOILER CON VISTA PREVIA EN VIVO
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261121a6';
import { Service } from '../core/service.js?v=20261121a6';

export const JournalShareViewMethods = {
  journalShareNoteId: '',
  journalShareTargetMode: 'all',
  journalShareSeatKeys: new Set(),
  journalShareSelectedBlockIds: new Set(),
  journalShareIncludeImage: true,

  bindJournalShareEvents() {
    this.els.btnCloseJournalShareTop?.addEventListener('click', () => this.closeJournalShareModal());
    this.els.btnCancelJournalShare?.addEventListener('click', () => this.closeJournalShareModal());
    this.els.btnConfirmJournalShare?.addEventListener('click', () => this.confirmJournalShare());
    this.els.journalShareModal?.addEventListener('click', (e) => {
      if (e.target === this.els.journalShareModal) this.closeJournalShareModal();
    });
  },

  openJournalShareModal(noteId) {
    if (Service.state.role !== 'gm') return;
    const note = (Service.state.journal?.gmNotes || []).find((n) => n.id === noteId);
    if (!note) return;

    this.journalShareNoteId = note.id;
    const revealedSeats = Array.isArray(note.revealedTo?.seatKeys) ? note.revealedTo.seatKeys : [];
    if (!note.revealedTo?.all && revealedSeats.length > 0) {
      this.journalShareTargetMode = 'players';
      this.journalShareSeatKeys = new Set(revealedSeats);
    } else {
      this.journalShareTargetMode = 'all';
      this.journalShareSeatKeys = new Set(revealedSeats);
    }

    const blocks = Array.isArray(note.blocks) ? note.blocks : [];
    const alreadyVisible = blocks.filter((b) => (b.visibility || 'private') !== 'private').map((b) => b.id);
    if (alreadyVisible.length > 0) {
      this.journalShareSelectedBlockIds = new Set(alreadyVisible);
    } else if (blocks.length === 1) {
      this.journalShareSelectedBlockIds = new Set([blocks[0].id]);
    } else {
      this.journalShareSelectedBlockIds = new Set();
    }

    this.journalShareIncludeImage = note.revealMedia !== false;
    this.els.journalShareModal?.classList.add('is-open');
    this.renderJournalShareModal(Service.state);
  },

  closeJournalShareModal() {
    this.journalShareNoteId = '';
    this.els.journalShareModal?.classList.remove('is-open');
  },

  renderJournalShareModal(state = Service.state) {
    const modal = this.els.journalShareModal;
    const body = this.els.journalShareBody;
    if (!modal || !body) return;
    if (!this.journalShareNoteId || state.role !== 'gm') {
      modal.classList.remove('is-open');
      return;
    }

    const note = (state.journal?.gmNotes || []).find((n) => n.id === this.journalShareNoteId);
    if (!note) {
      this.closeJournalShareModal();
      return;
    }

    modal.classList.add('is-open');
    const esc = (s) => this.escapeHtml(s);
    const invites = Selector.getPlayerInvites(state);
    const isPlayers = this.journalShareTargetMode === 'players';
    const pickedSeats = this.journalShareSeatKeys instanceof Set ? this.journalShareSeatKeys : new Set();
    const pickedBlocks = this.journalShareSelectedBlockIds instanceof Set ? this.journalShareSelectedBlockIds : new Set();
    const blocks = Array.isArray(note.blocks) ? note.blocks : [];
    const imgUrl = Service.resolveMediaUrl?.(note.mediaId, note.imageUrl) || note.imageUrl || '';
    const showImgInPreview = Boolean(imgUrl && this.journalShareIncludeImage);
    const previewBlocks = blocks.filter((b) => pickedBlocks.has(b.id));

    const recipientLabel = !isPlayers
      ? 'Toda la mesa'
      : invites
          .filter((inv) => pickedSeats.has(inv.id))
          .map((inv) => inv.label)
          .join(', ') || 'Sin jugadores elegidos';

    const playersRowHtml = isPlayers
      ? invites.length
        ? `<div class="flex flex-wrap gap-1.5 pt-1">${invites
            .map((inv) => {
              const on = pickedSeats.has(inv.id);
              return `<button type="button" data-jshare-seat="${esc(inv.id)}" class="portal-btn px-2.5 py-1 rounded-full text-[10.5px] font-semibold ${on ? 'portal-btn-accent' : 'portal-subpanel opacity-75 hover:opacity-100'}">${esc(inv.label)}</button>`;
            })
            .join('')}</div>`
        : '<div class="text-[10.5px] opacity-60 pt-1">Crea invitaciones de jugador en Salas para elegir destinatarios.</div>'
      : '';

    const imageToggleHtml = imgUrl
      ? `<button type="button" data-jshare-toggle-img="1" class="portal-btn ${this.journalShareIncludeImage ? 'portal-btn-accent' : 'portal-subpanel opacity-75'} px-2.5 py-1 rounded-xl text-[10.5px] font-semibold justify-between w-full">
          <span>Imagen adjunta</span>
          <span>${this.journalShareIncludeImage ? 'Incluida' : 'Oculta'}</span>
        </button>`
      : '';

    const blockTogglesHtml = blocks
      .map((blk, idx) => {
        const on = pickedBlocks.has(blk.id);
        const title = blk.heading || `Bloque ${idx + 1}`;
        const snippet = String(blk.body || '').replace(/\s+/g, ' ').trim();
        return `<button type="button" data-jshare-blk="${esc(blk.id)}" class="portal-subpanel rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 text-left transition-all cursor-pointer ${on ? 'ring-1' : 'opacity-65 hover:opacity-95'}" style="${on ? 'border-color: var(--accent-primary); background: var(--accent-soft);' : ''}">
          <div class="min-w-0 flex-1">
            <div class="text-[11px] font-semibold truncate">${esc(title)}</div>
            ${snippet ? `<div class="text-[10px] opacity-70 truncate">${esc(snippet)}</div>` : ''}
          </div>
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${on ? 'portal-btn-accent' : 'portal-panel opacity-60'}">${on ? '✓' : ''}</span>
        </button>`;
      })
      .join('');

    const previewBlocksHtml = previewBlocks.length
      ? previewBlocks
          .map(
            (b) => `<div class="portal-panel rounded-xl px-2.5 py-2 flex flex-col gap-0.5">
              ${b.heading ? `<span class="text-[11px] font-semibold leading-snug">${esc(b.heading)}</span>` : ''}
              <p class="text-[11px] leading-relaxed opacity-90 whitespace-pre-wrap break-words">${b.body ? esc(b.body) : '<span class="opacity-45 italic">Sin contenido</span>'}</p>
            </div>`
          )
          .join('')
      : '<div class="text-[11px] opacity-55 text-center py-3">Selecciona al menos un bloque para ver la vista previa.</div>';

    body.innerHTML = `
      <div class="portal-subpanel rounded-xl p-2.5 flex flex-col gap-1.5 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-wider opacity-70">Mostrar a</span>
          <div class="portal-seg grid-cols-2 text-[10.5px]">
            <button type="button" data-jshare-mode="all" class="portal-seg-btn px-2.5 py-0.5 ${!isPlayers ? 'is-active' : ''}">Toda la mesa</button>
            <button type="button" data-jshare-mode="players" class="portal-seg-btn px-2.5 py-0.5 ${isPlayers ? 'is-active' : ''}">Jugadores</button>
          </div>
        </div>
        ${playersRowHtml}
      </div>

      <div class="flex flex-col gap-1.5 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-wider opacity-70">Qué incluir</span>
          ${
            blocks.length > 1
              ? `<div class="flex items-center gap-1">
                  <button type="button" data-jshare-select="all" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[9.5px] opacity-80 hover:opacity-100">Todos</button>
                  <button type="button" data-jshare-select="none" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[9.5px] opacity-80 hover:opacity-100">Ninguno</button>
                </div>`
              : ''
          }
        </div>
        ${imageToggleHtml}
        <div class="flex flex-col gap-1">${blockTogglesHtml}</div>
      </div>

      <div class="flex flex-col gap-1.5 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-wider opacity-70">Vista previa</span>
          <span class="text-[10px] font-semibold opacity-80 truncate">${esc(recipientLabel)}</span>
        </div>
        <div data-jshare-preview="1" class="portal-subpanel rounded-2xl p-3 flex flex-col gap-2" style="border-color: var(--accent-primary);">
          <div class="flex items-center justify-between gap-2">
            <strong class="text-xs font-bold leading-snug truncate">${esc(note.title || 'Nota')}</strong>
            ${note.folder ? `<span class="px-2 py-0.5 rounded-full text-[9.5px] font-semibold portal-panel opacity-80 shrink-0">${esc(note.folder)}</span>` : ''}
          </div>
          ${showImgInPreview ? `<div class="rounded-xl overflow-hidden bg-black/35 flex items-center justify-center max-h-36 p-1.5 shrink-0"><img src="${esc(imgUrl)}" alt="${esc(note.title)}" class="max-h-32 object-contain rounded-lg" /></div>` : ''}
          <div class="flex flex-col gap-1.5">${previewBlocksHtml}</div>
        </div>
      </div>`;

    const canConfirm = previewBlocks.length > 0 && (!isPlayers || pickedSeats.size > 0);
    if (this.els.btnConfirmJournalShare) {
      this.els.btnConfirmJournalShare.disabled = !canConfirm;
    }

    body.querySelectorAll('[data-jshare-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.journalShareTargetMode = btn.dataset.jshareMode === 'players' ? 'players' : 'all';
        this.renderJournalShareModal(Service.state);
      });
    });
    body.querySelectorAll('[data-jshare-seat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!(this.journalShareSeatKeys instanceof Set)) this.journalShareSeatKeys = new Set();
        const seatId = btn.dataset.jshareSeat;
        if (this.journalShareSeatKeys.has(seatId)) this.journalShareSeatKeys.delete(seatId);
        else this.journalShareSeatKeys.add(seatId);
        this.renderJournalShareModal(Service.state);
      });
    });
    body.querySelector('[data-jshare-toggle-img]')?.addEventListener('click', () => {
      this.journalShareIncludeImage = !this.journalShareIncludeImage;
      this.renderJournalShareModal(Service.state);
    });
    body.querySelectorAll('[data-jshare-blk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!(this.journalShareSelectedBlockIds instanceof Set)) this.journalShareSelectedBlockIds = new Set();
        const blkId = btn.dataset.jshareBlk;
        if (this.journalShareSelectedBlockIds.has(blkId)) this.journalShareSelectedBlockIds.delete(blkId);
        else this.journalShareSelectedBlockIds.add(blkId);
        this.renderJournalShareModal(Service.state);
      });
    });
    body.querySelectorAll('[data-jshare-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.journalShareSelectedBlockIds =
          btn.dataset.jshareSelect === 'all' ? new Set(blocks.map((b) => b.id)) : new Set();
        this.renderJournalShareModal(Service.state);
      });
    });
  },

  confirmJournalShare() {
    if (!this.journalShareNoteId) return { ok: false, reason: 'not_open' };
    const blockIds = Array.from(this.journalShareSelectedBlockIds || []);
    const targetMode = this.journalShareTargetMode === 'players' ? 'players' : 'all';
    const targetSeatKeys = Array.from(this.journalShareSeatKeys || []);
    const res = Service.presentJournalNote(this.journalShareNoteId, {
      targetMode,
      targetSeatKeys,
      blockIds,
      includeImage: Boolean(this.journalShareIncludeImage)
    });
    if (res.ok) {
      this.closeJournalShareModal();
      this.renderJournal?.(Service.state);
    }
    return res;
  }
};
