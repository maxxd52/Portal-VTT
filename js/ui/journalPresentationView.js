/* ==========================================================================
   JOURNAL PRESENTATION VIEW: TARJETA DESTACADA DE NOTA REVELADA EN MESA
   ========================================================================== */

import { Service } from '../core/service.js?v=20261123a7';

export const JournalPresentationViewMethods = {
  bindJournalPresentationEvents() {
    this.els.btnCloseJournalPresTop?.addEventListener('click', () => {
      Service.closeJournalPresentation(false);
    });
    this.els.btnCloseJournalPres?.addEventListener('click', () => {
      Service.closeJournalPresentation(false);
    });
    this.els.btnClearJournalPresForAll?.addEventListener('click', () => {
      Service.closeJournalPresentation(true);
    });
    this.els.btnOpenJournalFromPres?.addEventListener('click', () => {
      const pres = Service.state.activeJournalPresentation;
      if (pres?.note?.id) {
        Service.activeJournalNoteId = pres.note.id;
        Service.activeJournalNoteKind = Service.state.role === 'gm' ? 'gm' : 'revealed';
      }
      Service.closeJournalPresentation(false);
      Service.toggleJournal(true);
    });
    this.els.journalPresentationModal?.addEventListener('click', (e) => {
      if (e.target === this.els.journalPresentationModal) {
        Service.closeJournalPresentation(false);
      }
    });
  },

  buildPresentationBlocksHtml(blocks, highlightBlockId = '') {
    const esc = (s) => this.escapeHtml(s);
    const list = Array.isArray(blocks) ? blocks : [];
    if (!list.length) {
      return '<div class="text-xs opacity-65 text-center py-4">Sin contenido visible.</div>';
    }
    return list
      .map((b) => {
        const isHi = Boolean(highlightBlockId && b.id === highlightBlockId);
        return `
          <article class="portal-subpanel rounded-xl p-3 flex flex-col gap-1.5 ${isHi ? 'ring-1' : ''}" style="${isHi ? 'border-color: var(--accent-primary); background: var(--accent-soft);' : ''}">
            <div class="flex items-center justify-between gap-2">
              ${b.heading ? `<h4 class="font-semibold text-xs tracking-tight">${esc(b.heading)}</h4>` : '<span class="text-[10px] opacity-55">Sección</span>'}
              ${isHi ? '<span class="px-2 py-0.5 rounded-full text-[9.5px] font-semibold portal-btn-accent">Nuevo fragmento</span>' : ''}
            </div>
            <p class="text-xs leading-relaxed opacity-90 whitespace-pre-wrap break-words">${esc(b.body || '')}</p>
          </article>`;
      })
      .join('');
  },

  renderJournalPresentationModal(state) {
    const modal = this.els.journalPresentationModal;
    if (!modal) return;
    const pres = state.activeJournalPresentation;
    const note = pres?.note || null;
    const isOpen = Boolean(note && note.id);
    modal.classList.toggle('is-open', isOpen);
    if (!isOpen) return;

    if (this.els.journalPresTitle) {
      this.els.journalPresTitle.textContent = note.title || 'Nota del Diario';
    }
    if (this.els.journalPresFolderPill) {
      this.els.journalPresFolderPill.textContent = note.gmFolder || 'Diario';
    }
    if (this.els.btnClearJournalPresForAll) {
      this.els.btnClearJournalPresForAll.classList.toggle('hidden', state.role !== 'gm');
    }

    const imgUrl = Service.resolveMediaUrl?.(note.mediaId, note.imageUrl) || note.imageUrl || '';
    if (this.els.journalPresMediaWrap && this.els.journalPresImg) {
      this.els.journalPresMediaWrap.classList.toggle('hidden', !imgUrl);
      this.els.journalPresMediaWrap.classList.toggle('flex', Boolean(imgUrl));
      if (imgUrl && this.els.journalPresImg.src !== imgUrl) {
        this.els.journalPresImg.src = imgUrl;
        this.els.journalPresImg.alt = note.title || 'Imagen';
      }
    }

    if (this.els.journalPresBlocks) {
      this.els.journalPresBlocks.innerHTML = this.buildPresentationBlocksHtml(
        note.blocks,
        pres.highlightBlockId || ''
      );
    }
  }
};
