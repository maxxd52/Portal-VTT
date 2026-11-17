/* ==========================================================================
   SHEET RESOURCES VIEW: RECURSOS Y CONTADORES FLEXIBLES EN LA FICHA
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261116z40';
import { Service } from '../core/service.js?v=20261116z40';

export const SheetResourcesViewMethods = {
  bindSheetResourceEvents() {
    if (this.els.btnToggleResourceForm && this.els.sheetResourceForm) {
      this.els.btnToggleResourceForm.addEventListener('click', () => {
        const opening = this.els.sheetResourceForm.classList.contains('hidden');
        this.els.sheetResourceForm.classList.toggle('hidden', !opening);
        this.els.sheetResourceForm.classList.toggle('flex', opening);
        this.els.btnToggleResourceForm.classList.toggle('owl-btn-accent', opening);
        if (opening && this.els.inpSheetResName) this.els.inpSheetResName.focus();
      });
    }

    if (this.els.sheetResourceForm) {
      this.els.sheetResourceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        const name = this.els.inpSheetResName?.value.trim();
        if (!name) return;
        const max = Number(this.els.inpSheetResMax?.value) || 0;
        const kind = this.els.selSheetResKind?.value || 'auto';
        const color = this.els.inpSheetResColor?.value || '#8b5cf6';
        Service.addTokenResource(tok.id, { name, max, kind, color });
        this.els.inpSheetResName.value = '';
        this.els.sheetResourceForm.classList.add('hidden');
        this.els.sheetResourceForm.classList.remove('flex');
        this.els.btnToggleResourceForm?.classList.remove('owl-btn-accent');
      });
    }
  },

  renderSheetResources(tok) {
    const esc = (s) => this.escapeHtml(s);
    if (this.els.sheetActiveStatusesRow && tok) {
      const conds = Array.isArray(tok.conditions) ? tok.conditions : [];
      this.els.sheetActiveStatusesRow.innerHTML = conds
        .map((c) => {
          const def = Selector.getStatusDef(Service.state, c);
          return `<button type="button" data-sheet-clear-cond="${esc(c)}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-sm hover:opacity-85 transition-opacity" style="background:${def.color};" title="Clic para quitar ${esc(def.label)}">${this.renderStatusSymbolSvg(def.icon, 'w-2.5 h-2.5', Service.state)}<span>${esc(def.label)}</span><span class="opacity-75">×</span></button>`;
        })
        .join('');
      this.els.sheetActiveStatusesRow.querySelectorAll('[data-sheet-clear-cond]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.toggleTokenCondition(tok.id, btn.dataset.sheetClearCond);
        });
      });
    }

    const cfg = Service.state.systemConfig || {};
    const hasBlocks = Array.isArray(cfg.sheetBlocks);
    const isGeneric = (cfg.preset || 'dnd55') === 'free';
    if (this.els.btnToggleResourceForm) {
      this.els.btnToggleResourceForm.classList.toggle('hidden', isGeneric || hasBlocks);
    }
    if ((isGeneric || hasBlocks) && this.els.sheetResourceForm) {
      this.els.sheetResourceForm.classList.add('hidden');
      this.els.sheetResourceForm.classList.remove('flex');
    }

    const listEl = this.els.sheetResourcesList;
    if (!listEl || !tok) return;
    if (hasBlocks) {
      listEl.innerHTML = '';
      return;
    }
    const sysRes = Array.isArray(Service.state.systemConfig?.resourceSchema)
      ? Service.state.systemConfig.resourceSchema
      : [];
    const sysResByKey = new Map(sysRes.map((r) => [Selector.normalizeStatKey(r.name), r]));
    const resources = (Array.isArray(tok.resources) ? tok.resources : []).filter((res) => {
      const def = sysResByKey.get(Selector.normalizeStatKey(res.name));
      return !def || (def.tabId || 'header') === 'header';
    });
    this.renderResourceCardsInto(listEl, resources, tok, sysResByKey);
  },

  renderResourceCardsInto(listEl, resources, tok, sysResByKey = new Map()) {
    const esc = (s) => this.escapeHtml(s);
    if (!listEl) return;
    if (!resources.length) {
      listEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = resources
      .map((res) => {
        const cur = Math.max(0, Number(res.cur) || 0);
        const max = Math.max(0, Number(res.max) || 0);
        const color = res.color || '#8b5cf6';
        const usePips = max > 0 && (res.kind === 'pips' || (res.kind !== 'bar' && max <= 6)) && max <= 8;
        const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((cur / max) * 100))) : 0;
        const isLocked = sysResByKey.has(Selector.normalizeStatKey(res.name));

        let bodyHtml = '';
        if (max === 0) {
          bodyHtml = `
            <div class="flex items-center justify-between gap-1.5">
              <button type="button" data-res-delta="${res.id}:-1" class="owl-btn owl-panel w-5 h-5 p-0 rounded-full text-xs leading-none">-</button>
              <input type="number" data-res-cur="${res.id}" value="${cur}" min="0" max="999" class="owl-num-input w-12 text-center text-xs font-bold tabular-nums bg-black/15 rounded-md py-0.5 outline-none" />
              <button type="button" data-res-delta="${res.id}:1" class="owl-btn owl-panel w-5 h-5 p-0 rounded-full text-xs leading-none">+</button>
            </div>
          `;
        } else if (usePips) {
          const dots = Array.from({ length: max }, (_, idx) => {
            const filled = idx < cur;
            return `<button type="button" data-res-pip="${res.id}:${idx + 1}" class="w-3.5 h-3.5 rounded-full border transition-transform hover:scale-110" style="border-color:${color}; background:${filled ? color : 'transparent'};" title="${idx + 1}/${max}"></button>`;
          }).join('');
          bodyHtml = `<div class="flex flex-wrap items-center gap-1 pt-0.5">${dots}</div>`;
        } else {
          bodyHtml = `
            <div class="flex items-center justify-between gap-1">
              <button type="button" data-res-delta="${res.id}:-1" class="owl-btn owl-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">-</button>
              <div class="flex-1 h-1.5 rounded-full bg-black/25 overflow-hidden">
                <div class="h-full rounded-full transition-all" style="width:${pct}%; background:${color};"></div>
              </div>
              <button type="button" data-res-delta="${res.id}:1" class="owl-btn owl-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">+</button>
            </div>
          `;
        }

        const readoutHtml =
          max > 0
            ? `<span class="text-[10px] font-semibold tabular-nums opacity-85 shrink-0">${cur}/${max}</span>`
            : `<span class="text-[9.5px] opacity-55 shrink-0">libre</span>`;
        const delBtnHtml = isLocked
          ? ''
          : `<button type="button" data-res-del="${res.id}" class="absolute top-0.5 right-1 opacity-0 group-hover:opacity-65 hover:!opacity-100 text-[10px] leading-none px-0.5 text-rose-400" title="Quitar recurso">×</button>`;

        return `
          <div class="owl-subpanel rounded-xl px-2 py-1.5 flex flex-col gap-1 relative group">
            <div class="flex items-center justify-between gap-1 ${isLocked ? '' : 'pr-3'}">
              <span class="inline-flex items-center gap-1 min-w-0">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${color};"></span>
                <span class="text-[10.5px] font-medium truncate" title="${esc(res.name)} · variable @${Selector.normalizeStatKey(res.name)}">${esc(res.name)}</span>
              </span>
              ${readoutHtml}
              ${delBtnHtml}
            </div>
            ${bodyHtml}
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('[data-res-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [resId, delta] = btn.dataset.resDelta.split(':');
        Service.adjustTokenResource(tok.id, resId, Number(delta));
      });
    });

    listEl.querySelectorAll('[data-res-cur]').forEach((inp) => {
      inp.addEventListener('change', () => {
        Service.setTokenResourceValue(tok.id, inp.dataset.resCur, inp.value);
      });
    });

    listEl.querySelectorAll('[data-res-pip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [resId, targetStr] = btn.dataset.resPip.split(':');
        const targetVal = Number(targetStr) || 0;
        const res = (tok.resources || []).find((r) => r.id === resId);
        const curVal = Number(res?.cur) || 0;
        const nextVal = targetVal === curVal ? targetVal - 1 : targetVal;
        Service.setTokenResourceValue(tok.id, resId, nextVal);
      });
    });

    listEl.querySelectorAll('[data-res-del]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Service.removeTokenResource(tok.id, btn.dataset.resDel);
      });
    });
  }
};
