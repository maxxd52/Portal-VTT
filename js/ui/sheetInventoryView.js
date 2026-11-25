/* ==========================================================================
   SHEET INVENTORY VIEW: INVENTARIO, MENÚ CONTEXTUAL Y DRAG & DROP
   ========================================================================== */

import { Service } from '../core/service.js?v=20261125a1';
import { normalizeItemUsage } from '../utils/tokenTemplateSync.js?v=20261125a1';

export const SheetInventoryViewMethods = {
  renderSheetInventory(tok, sheetTab, isInvTab) {
    if (!this.els.sheetInventoryList || !tok) return;
    const inv = Array.isArray(tok.inventory) ? tok.inventory : [];
    const activeInv = isInvTab ? sheetTab : 'equipment';
    const visibleInv = inv.filter((item) => this.getItemCategory(item.kind) === activeInv);
    this.els.sheetInventoryList.innerHTML = visibleInv.length
      ? visibleInv
          .map((item) => {
            const { usageMode, maxUses } = normalizeItemUsage(item);
            const curUses = item.uses !== undefined ? Math.max(0, Math.trunc(Number(item.uses) || 0)) : maxUses;
            const usagePill =
              usageMode === 'consumable'
                ? `<span class="text-[9.5px] font-mono-tech font-semibold px-1.5 py-0.5 rounded-full bg-white/10 opacity-85 shrink-0">×${curUses}</span>`
                : usageMode === 'charges'
                  ? `<span class="text-[9.5px] font-mono-tech font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${curUses <= 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 opacity-85'}">${curUses}/${maxUses}</span>`
                  : '';
            return `
          <div
            draggable="true"
            data-inv-uid="${item.uid}"
            class="group portal-list-row px-2 py-1.5 flex items-center justify-between gap-2 text-[11px] cursor-grab transition-colors${usageMode === 'charges' && curUses <= 0 ? ' opacity-70' : ''}"
          >
            <div class="min-w-0 pl-0.5 flex-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-semibold text-xs truncate">${this.escapeHtml(item.name)}</span>
                ${usagePill}
              </div>
              <div class="text-[10px] opacity-65 truncate">${this.escapeHtml(item.badge || '')}</div>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button type="button" data-inv-menu="${item.uid}" class="portal-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" title="Opciones">
                <span class="text-xs leading-none">⋯</span>
              </button>
              ${this.renderItemIconBadge(item, { interactive: true })}
            </div>
          </div>
        `;
          })
          .join('')
      : `<div class="text-[11px] opacity-55 text-center py-6 px-2">Arrastra armas, escudos o pociones desde el Compendio.</div>`;

    const openInvMenu = (uid, cx, cy) => {
      const item = visibleInv.find((x) => x.uid === uid);
      if (!item) return;
      const { usageMode, maxUses } = normalizeItemUsage(item);
      const curUses = item.uses !== undefined ? Math.max(0, Math.trunc(Number(item.uses) || 0)) : maxUses;
      const actions = [
        {
          icon: 'zap',
          label: 'Usar / Tirar',
          onClick: () => {
            const msg = Service.useTokenInventoryItem(tok.id, item.uid);
            if (msg) this.showActionToast(msg);
          }
        }
      ];
      if (usageMode === 'charges' && curUses < maxUses) {
        actions.push({
          icon: 'sparkles',
          label: `Recargar (${maxUses}/${maxUses})`,
          onClick: () => {
            Service.rechargeTokenItem(tok.id, item.uid);
            this.showActionToast(`${item.name} recargado (${maxUses}/${maxUses}).`);
          }
        });
      }
      if (usageMode !== 'permanent') {
        actions.push(
          {
            icon: 'plus',
            label: usageMode === 'charges' ? '+1 carga' : '+1 uso',
            onClick: () => Service.adjustTokenItemUses(tok.id, item.uid, 1)
          },
          {
            icon: 'sliders',
            label: usageMode === 'charges' ? '-1 carga' : '-1 uso',
            onClick: () => Service.adjustTokenItemUses(tok.id, item.uid, -1)
          }
        );
      }
      actions.push({
        icon: 'trash',
        label: 'Quitar del inventario',
        danger: true,
        onClick: () => Service.removeTokenInventoryItem(tok.id, item.uid)
      });
      this.openListContextMenu(cx, cy, item.name, item.badge || 'Objeto', actions);
    };

    this.els.sheetInventoryList.querySelectorAll('[data-inv-uid]').forEach((row) => {
      const uid = row.dataset.invUid;
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openInvMenu(uid, e.clientX, e.clientY);
      });
      row.addEventListener('dragstart', (e) => {
        this.draggingInvUid = uid;
        row.classList.add('opacity-50');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `inv:${uid}`);
        }
      });
      row.addEventListener('dragend', () => {
        this.draggingInvUid = null;
        row.classList.remove('opacity-50');
        this.els.sheetInventoryList.querySelectorAll('[data-inv-uid]').forEach((r) => {
          r.style.borderTop = '';
          r.style.borderBottom = '';
        });
      });
      row.addEventListener('dragover', (e) => {
        if (!this.draggingInvUid || this.draggingInvUid === uid) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = row.getBoundingClientRect();
        const after = e.clientY >= rect.top + rect.height / 2;
        row.style.borderTop = after ? '' : '2px solid var(--accent-primary)';
        row.style.borderBottom = after ? '2px solid var(--accent-primary)' : '';
      });
      row.addEventListener('dragleave', () => {
        row.style.borderTop = '';
        row.style.borderBottom = '';
      });
      row.addEventListener('drop', (e) => {
        if (!this.draggingInvUid || this.draggingInvUid === uid) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = row.getBoundingClientRect();
        const after = e.clientY >= rect.top + rect.height / 2;
        const sourceUid = this.draggingInvUid;
        this.draggingInvUid = null;
        row.style.borderTop = '';
        row.style.borderBottom = '';
        Service.reorderTokenInventoryItem(tok.id, sourceUid, uid, after);
      });
    });

    this.els.sheetInventoryList.querySelectorAll('[data-use-inv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msg = Service.useTokenInventoryItem(tok.id, btn.dataset.useInv);
        if (msg) this.showActionToast(msg);
      });
    });
    this.els.sheetInventoryList.querySelectorAll('[data-inv-menu]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = btn.getBoundingClientRect();
        openInvMenu(btn.dataset.invMenu, r.right, r.bottom + 4);
      });
    });
  }
};
