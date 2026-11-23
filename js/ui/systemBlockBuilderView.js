/* ==========================================================================
   SYSTEM BLOCK BUILDER VIEW: CONSTRUCTOR POR BLOQUES, PESTAÑAS Y VISTA PREVIA
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';
import {
  BLOCK_BADGES,
  BlockInspectorViewMethods,
  SVG_ICONS
} from './blockInspectorView.js?v=20261123a7';

export { BLOCK_BADGES, SVG_ICONS };

const SIZE_BADGE_MAP = { '1/3': '⅓', '1/2': '½', '2/3': '⅔', '1/1': 'Todo' };

export const SystemBlockBuilderViewMethods = {
  ...BlockInspectorViewMethods,

  renderDeleteTabWarning(tab) {
    const esc = (s) => this.escapeHtml(s);
    return this.confirmDeleteTabId === tab.id
      ? `<div class="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
          <span class="inline-flex items-center gap-1.5 text-rose-200 leading-snug">${SVG_ICONS.warn}<span>Si eliminás "${esc(tab.label)}", se perderán sus elementos.</span></span>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-sys-del-tab-confirm="${esc(tab.id)}" class="portal-btn px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-rose-500/85 text-white hover:bg-rose-500">Eliminar</button>
            <button type="button" data-sys-del-tab-cancel class="portal-btn px-2.5 py-1 rounded-lg text-[10.5px] font-semibold portal-panel opacity-90">Cancelar</button>
          </div>
        </div>`
      : '';
  },

  renderTabOrderBtns(allTabs, tabId) {
    if (allTabs.length <= 1) return '';
    const esc = (s) => this.escapeHtml(s);
    const idx = allTabs.findIndex((t) => t.id === tabId);
    return `
      ${idx > 0 ? `<button type="button" data-sys-move-tab="${esc(tabId)}:-1" class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg" title="Subir pestaña">${SVG_ICONS.arrowUp}</button>` : ''}
      ${idx < allTabs.length - 1 ? `<button type="button" data-sys-move-tab="${esc(tabId)}:1" class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg" title="Bajar pestaña">${SVG_ICONS.arrowDown}</button>` : ''}
    `;
  },

  renderBlockZone(state, zoneObj, isHeader = false) {
    const esc = (s) => this.escapeHtml(s);
    const allTabs = Selector.getSystemSheetTabs(state);
    const blocks = Selector.getSystemSheetBlocks(state);
    const fixedTargets = [{ id: 'header', label: 'Vista Fija' }, ...allTabs.filter((t) => t.mode === 'fixed')];
    const selectedBlk = blocks.find((b) => b.id === this.selectedSysBlockId) || null;
    const zoneBlocks = blocks.filter((b) => (b.tabId || 'attrs') === zoneObj.id);
    const showInspectorHere = selectedBlk && (selectedBlk.tabId || 'attrs') === zoneObj.id;

    const pillsHtml = zoneBlocks.length
      ? zoneBlocks
          .map((b) => {
            const info = BLOCK_BADGES[b.kind] || BLOCK_BADGES.number;
            const active = selectedBlk?.id === b.id;
            const szLbl = SIZE_BADGE_MAP[Selector.resolveBlockSize(b)] || '⅓';
            return `<button type="button" data-sys-pick-blk="${esc(b.id)}" class="portal-block-pill ${active ? 'is-active' : ''}">
              <span class="opacity-80">${info.icon}</span>
              <span>${esc(b.label)}</span>
              <span class="text-[9.5px] opacity-60 font-mono-tech">${szLbl}</span>
            </button>`;
          })
          .join('')
      : '<span class="text-[11px] opacity-55 italic">Sin bloques · agrega uno abajo.</span>';

    const paletteHtml = `
      <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t" style="border-color: var(--hairline);">
        <span class="text-[10.5px] opacity-60 mr-0.5">Añadir:</span>
        ${['number', 'resource', 'text']
          .map((kind) => {
            const info = BLOCK_BADGES[kind];
            return `<button type="button" data-sys-add-blk="${esc(zoneObj.id)}:${kind}" class="portal-btn portal-panel px-2.5 py-1 rounded-lg text-[10.5px] font-medium gap-1.5"><span class="opacity-75">${info.icon}</span><span>${info.name}</span></button>`;
          })
          .join('')}
      </div>
    `;

    return `
      <div class="portal-settings-group">
        <div class="portal-settings-col">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="text-[10px] px-2 py-0.5 rounded-full portal-panel font-medium opacity-80 shrink-0">${isHeader ? 'Siempre visible' : 'Fija'}</span>
              ${
                isHeader
                  ? `<strong class="text-xs font-semibold truncate">${esc(zoneObj.label)}</strong>`
                  : `<input type="text" data-sys-rename-tab="${esc(zoneObj.id)}" value="${esc(zoneObj.label)}" class="portal-input px-2.5 py-1 text-xs font-semibold flex-1 min-w-0" />`
              }
            </div>
            ${
              isHeader
                ? ''
                : `<div class="flex items-center gap-1 shrink-0">
                    ${this.renderTabOrderBtns(allTabs, zoneObj.id)}
                    <button type="button" data-sys-sum-tab="${esc(zoneObj.id)}" class="portal-btn px-2 h-6 rounded-lg text-[10.5px] font-semibold ${zoneObj.sumTotal ? 'portal-btn-accent' : 'portal-panel opacity-75'}" title="Mostrar Σ suma total de números">Σ</button>
                    ${allTabs.length > 1 ? `<button type="button" data-sys-del-tab="${esc(zoneObj.id)}" class="portal-btn w-6 h-6 p-0 rounded-full text-rose-400 opacity-75 hover:opacity-100" title="Eliminar pestaña">${SVG_ICONS.close}</button>` : ''}
                  </div>`
            }
          </div>
          ${!isHeader ? this.renderDeleteTabWarning(zoneObj) : ''}
          <div class="flex flex-wrap gap-1.5 py-0.5">${pillsHtml}</div>
          ${showInspectorHere ? this.renderBlockInspector(state, selectedBlk, fixedTargets) : ''}
          ${paletteHtml}
        </div>
      </div>
    `;
  },

  renderTabItemCard(state, tab) {
    if (tab.mode === 'fixed') return this.renderBlockZone(state, tab, false);
    const esc = (s) => this.escapeHtml(s);
    const allTabs = Selector.getSystemSheetTabs(state);
    return `
      <div class="portal-settings-group">
        <div class="portal-settings-col">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0" style="background: var(--accent-soft); color: var(--accent-primary);">Complementos</span>
              <input type="text" data-sys-rename-tab="${esc(tab.id)}" value="${esc(tab.label)}" class="portal-input px-2.5 py-1 text-xs font-semibold flex-1 min-w-0" />
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${this.renderTabOrderBtns(allTabs, tab.id)}
              ${allTabs.length > 1 ? `<button type="button" data-sys-del-tab="${esc(tab.id)}" class="portal-btn w-6 h-6 p-0 rounded-full text-rose-400 opacity-75 hover:opacity-100" title="Eliminar pestaña">${SVG_ICONS.close}</button>` : ''}
            </div>
          </div>
          ${this.renderDeleteTabWarning(tab)}
          <span class="text-[10.5px] opacity-60">Acepta complementos arrastrados y aparece como destino en el Compendio.</span>
        </div>
      </div>
    `;
  },

  renderGenericSheetPane(state) {
    const allTabs = Selector.getSystemSheetTabs(state);
    return `
      <div class="flex flex-col gap-1.5">
        <span class="portal-settings-label">Cabecera fija (arriba de las pestañas)</span>
        ${this.renderBlockZone(state, { id: 'header', label: 'Elementos fijos en cabecera', mode: 'fixed' }, true)}
      </div>

      <div class="flex flex-col gap-2">
        <span class="portal-settings-label">Pestañas de la ficha (${allTabs.length})</span>
        <div class="portal-settings-group">
          <form id="sysAddTabForm" class="portal-settings-col">
            <div class="flex flex-wrap items-center gap-1.5">
              <input type="text" id="inpSysNewTabName" placeholder="Nueva pestaña (ej. Disciplinas, Magia...)" required class="portal-input flex-1 min-w-[160px] px-2.5 py-1.5 text-xs" />
              <select id="selSysNewTabMode" class="portal-input w-auto px-2.5 py-1.5 text-xs font-medium">
                <option value="fixed">Fija (bloques)</option>
                <option value="items">Complementos</option>
              </select>
              <button type="submit" class="portal-btn portal-btn-accent px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0">+ Crear</button>
            </div>
          </form>
        </div>
        <div class="flex flex-col gap-2.5">${allTabs.map((t) => this.renderTabItemCard(state, t)).join('')}</div>
      </div>
    `;
  },

  renderLivePreview(state) {
    const esc = (s) => this.escapeHtml(s);
    const allTabs = Selector.getSystemSheetTabs(state);
    const activePreviewTab = allTabs.find((t) => t.id === this.sysPreviewTabId) || allTabs[0] || null;
    const baseTok = state.tokens?.find((t) => t.id === state.selectedTokenId) || state.tokens?.[0];
    const previewTitle = baseTok?.name || 'Kaelen (Ejemplo)';
    const previewInitials = previewTitle.trim().slice(0, 2).toUpperCase() || 'KA';

    return `
      <div class="flex flex-col gap-1.5">
        <span class="portal-settings-label">Vista previa en vivo</span>
        <div class="portal-settings-group flex flex-col">
          <div class="portal-settings-row">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">${esc(previewInitials)}</div>
              <div class="min-w-0">
                <div class="text-xs font-bold leading-tight truncate">${esc(previewTitle)}</div>
                <div class="text-[10.5px] opacity-60 truncate">${esc(state.room?.moduleTitle || 'Sistema Genérico')}</div>
              </div>
            </div>
            <span class="text-[10px] opacity-55 shrink-0">Toca un bloque para editarlo</span>
          </div>
          <div class="p-3 border-t flex flex-col gap-2.5" style="border-color: var(--hairline);">
            <div id="sysPreviewHeaderBlocks" class="select-none"></div>
            ${
              allTabs.length
                ? `<div class="portal-seg flex flex-wrap gap-1 p-1 rounded-xl">
                    ${allTabs
                      .map((t) => `<button type="button" data-sys-preview-tab="${esc(t.id)}" class="portal-seg-btn flex-1 min-w-[72px] px-2 py-1 text-[10.5px] font-semibold truncate ${activePreviewTab?.id === t.id ? 'is-active' : ''}">${esc(t.label)}</button>`)
                      .join('')}
                  </div>`
                : ''
            }
            <div id="sysPreviewTabBody" class="select-none">
              ${
                activePreviewTab?.mode === 'items'
                  ? `<div class="flex flex-col gap-1.5 text-[11px]">
                      <div class="portal-subpanel rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 opacity-80">
                        <span class="font-semibold">Ejemplo de complemento</span>
                        <span class="text-[10px] opacity-60">Arrastrado del Compendio</span>
                      </div>
                    </div>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
  },

  annotatePreviewBlocks(containerEl, zoneBlocks) {
    const grid = containerEl?.querySelector('.grid');
    if (!grid) return;
    Array.from(grid.children).forEach((card, idx) => {
      const blk = zoneBlocks[idx];
      if (!blk) return;
      card.setAttribute('data-sys-preview-blk', blk.id);
      card.classList.add('cursor-pointer', 'transition-all');
      if (this.selectedSysBlockId === blk.id) {
        card.style.outline = '1.5px solid var(--accent-primary)';
        card.style.outlineOffset = '1px';
      }
    });
  },

  bindSystemBlockBuilderEvents(body) {
    if (!body) return;

    body.querySelector('#sysAddTabForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = body.querySelector('#inpSysNewTabName')?.value.trim();
      const mode = body.querySelector('#selSysNewTabMode')?.value || 'fixed';
      if (name) {
        this.sysModalSection = 'sheet';
        const created = Service.addSystemCustomTab(name, mode);
        if (created) {
          this.sysPreviewTabId = created.id;
          this.renderSystemModal(Service.state);
        }
      }
    });
    body.querySelectorAll('[data-sys-move-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tabId, dir] = btn.dataset.sysMoveTab.split(':');
        this.sysModalSection = 'sheet';
        Service.moveSystemTabOrder(tabId, Number(dir));
      });
    });
    body.querySelectorAll('[data-sys-rename-tab]').forEach((inp) => {
      inp.addEventListener('change', () => Service.renameSystemCustomTab(inp.dataset.sysRenameTab, inp.value));
    });
    body.querySelectorAll('[data-sys-sum-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysModalSection = 'sheet';
        Service.toggleSystemCustomTabSum(btn.dataset.sysSumTab);
      });
    });
    body.querySelectorAll('[data-sys-del-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sysDelTab;
        this.sysModalSection = 'sheet';
        this.confirmDeleteTabId = this.confirmDeleteTabId === id ? null : id;
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-sys-del-tab-confirm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sysDelTabConfirm;
        this.sysModalSection = 'sheet';
        this.confirmDeleteTabId = null;
        Service.removeSystemCustomTab(id);
      });
    });
    body.querySelectorAll('[data-sys-del-tab-cancel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.confirmDeleteTabId = null;
        this.renderSystemModal(Service.state);
      });
    });

    body.querySelectorAll('[data-sys-preview-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysPreviewTabId = btn.dataset.sysPreviewTab;
        this.renderSystemModal(Service.state);
      });
    });

    const selectBlock = (id, requireSheetMatch = false) => {
      const shouldClear = this.selectedSysBlockId === id && (!requireSheetMatch || this.sysModalSection === 'sheet');
      this.selectedSysBlockId = shouldClear ? null : id;
      this.sysModalSection = 'sheet';
      const blk = (Service.state.systemConfig?.sheetBlocks || []).find((b) => b.id === id);
      if (this.selectedSysBlockId && blk?.tabId && blk.tabId !== 'header') {
        this.sysPreviewTabId = blk.tabId;
      }
      this.renderSystemModal(Service.state);
    };

    body.querySelectorAll('[data-sys-preview-blk]').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectBlock(card.dataset.sysPreviewBlk, true);
      }, { capture: true });
    });

    body.querySelectorAll('[data-sys-pick-blk]').forEach((btn) => {
      btn.addEventListener('click', () => selectBlock(btn.dataset.sysPickBlk, false));
    });
    body.querySelectorAll('[data-sys-add-blk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tabId, kind] = btn.dataset.sysAddBlk.split(':');
        this.sysModalSection = 'sheet';
        if (tabId && tabId !== 'header') this.sysPreviewTabId = tabId;
        const created = Service.addSystemBlock(kind, { tabId });
        if (created) {
          this.selectedSysBlockId = created.id;
          this.renderSystemModal(Service.state);
        }
      });
    });

    const insp = body.querySelector('[data-blk-inspector]');
    if (insp) {
      this.bindBlockInspectorEvents(insp, insp.dataset.blkInspector);
    }
  }
};
