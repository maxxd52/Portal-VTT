/* ==========================================================================
   TOKEN INSPECT VIEW: TARJETA DE INSPECCIÓN PÚBLICA Y GUARDADO EN DIARIO
   ========================================================================== */

import { Service } from '../core/service.js?v=20261121a6';

export const TokenInspectViewMethods = {
  bindTokenInspectEvents() {
    this.els.btnCloseTokenInspect?.addEventListener('click', () => {
      Service.closeTokenInspection();
    });
    this.els.tokenInspectModal?.addEventListener('click', (e) => {
      if (e.target === this.els.tokenInspectModal) {
        Service.closeTokenInspection();
      }
    });
    this.els.btnInspectSaveToJournal?.addEventListener('click', () => {
      const tokenId = Service.state.inspectTokenId;
      if (!tokenId) return;
      const created = Service.saveInspectedTokenToJournal(tokenId);
      if (created) {
        this.showActionToast(`"${created.title}" guardado en tu Diario.`);
      }
    });
  },

  renderTokenInspectModal(state) {
    const modal = this.els.tokenInspectModal;
    if (!modal) return;
    const tok = state.inspectTokenId
      ? (state.tokens || []).find((t) => t && t.id === state.inspectTokenId)
      : null;
    const canShow = Boolean(tok && !(state.role === 'player' && tok.hidden));
    modal.classList.toggle('is-open', canShow);
    if (!canShow) return;

    const esc = (s) => this.escapeHtml(s);
    if (this.els.inspectTokenName) {
      this.els.inspectTokenName.textContent = tok.name || 'Personaje';
    }
    if (this.els.inspectTokenDesc) {
      const desc = String(tok.publicDescription || '').trim();
      this.els.inspectTokenDesc.textContent = desc || 'Sin descripción pública.';
    }
    if (this.els.inspectTokenMedia) {
      const imgUrl = Service.resolveMediaUrl?.(tok.mediaId, tok.imageUrl) || tok.imageUrl || '';
      const initials = esc((tok.name || 'PJ').slice(0, 2).toUpperCase());
      const color = esc(tok.color || '#8b5cf6');
      this.els.inspectTokenMedia.innerHTML = imgUrl
        ? `<img src="${esc(imgUrl)}" alt="${esc(tok.name)}" class="max-w-full max-h-[280px] object-contain rounded-xl select-none" draggable="false" />`
        : `<div class="w-28 h-28 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg border border-white/25" style="background:${color};">${initials}</div>`;
    }
  }
};
