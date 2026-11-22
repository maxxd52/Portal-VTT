/* ==========================================================================
   GM SCREEN CONFIG VIEW: OPCIONES DE PANTALLA EN SISTEMA Y REGLAS
   ========================================================================== */

import { GM_WIDGET_TYPES } from '../data/gmScreenPresets.js?v=20261121a6';
import { Selector } from '../core/selector.js?v=20261121a6';
import { Service } from '../core/service.js?v=20261121a6';

export const GmScreenConfigViewMethods = {
  renderGmScreenConfigPane(state) {
    const esc = (v) => this.escapeHtml(v ?? '');
    const gm = Selector.getGmScreenState(state);
    const presetKey = state.systemConfig?.preset || (state.ruleset === 'free' ? 'free' : 'dnd55');
    const isGeneric = presetKey === 'free';

    const renderSwitch = (attrsHtml, checked) => `
      <span class="portal-switch">
        <input type="checkbox" ${attrsHtml} ${checked ? 'checked' : ''} class="portal-switch-input" />
        <span class="portal-switch-track"></span>
      </span>
    `;

    if (!isGeneric) {
      const tabsHtml = gm.tabs
        .map((tab) => {
          const widgets = gm.widgets.filter((w) => w.tabId === tab.id);
          const rows = widgets.length
            ? widgets
                .map((w) => {
                  const meta = GM_WIDGET_TYPES[w.type] || {};
                  return `
                    <label class="portal-settings-row cursor-pointer select-none">
                      <span class="flex flex-col min-w-0">
                        <span class="text-xs font-medium leading-tight">${esc(w.title || meta.label || w.type)}</span>
                        <span class="text-[10.5px] opacity-60 leading-snug mt-0.5">${esc(meta.description || '')}</span>
                      </span>
                      ${renderSwitch(`data-gm-cfg-toggle="${esc(w.id)}"`, w.enabled !== false)}
                    </label>`;
                })
                .join('')
            : `<div class="portal-settings-row text-[11px] opacity-60">Sin herramientas configuradas en esta pestaña.</div>`;
          return `
            <div class="flex flex-col gap-1.5">
              <span class="portal-settings-label">${esc(tab.label)}</span>
              <div class="portal-settings-group">${rows}</div>
            </div>`;
        })
        .join('');

      return `
        <div class="flex flex-col gap-3">
          <div class="portal-settings-group">
            <div class="portal-settings-row">
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold">Pantalla estándar del sistema</span>
                <span class="text-[10.5px] opacity-60 mt-0.5">Activá o desactivá herramientas para mantener tu mesa limpia y sin ruido.</span>
              </div>
              <button type="button" id="btnGmCfgReset" class="portal-btn portal-panel px-2.5 py-1 rounded-lg text-[10.5px] font-semibold shrink-0">Restaurar</button>
            </div>
          </div>
          ${tabsHtml}
        </div>
      `;
    }

    const activeCfgTabId = gm.tabs.some((t) => t.id === this.gmCfgTabId) ? this.gmCfgTabId : gm.tabs[0]?.id;
    const activeTab = gm.tabs.find((t) => t.id === activeCfgTabId) || gm.tabs[0];
    const tabWidgets = activeTab ? gm.widgets.filter((w) => w.tabId === activeTab.id) : [];

    const tabsListHtml = gm.tabs
      .map(
        (t, idx) => `
        <div class="portal-settings-row gap-2">
          <button type="button" data-gm-cfg-pick-tab="${esc(t.id)}" class="portal-btn px-2 py-1 rounded-lg text-[11px] font-semibold ${t.id === activeTab?.id ? 'portal-btn-accent' : 'portal-panel opacity-75'}" title="Editar herramientas de esta pestaña">Editar</button>
          <input type="text" data-gm-cfg-rename-tab="${esc(t.id)}" value="${esc(t.label)}" class="portal-input px-2 py-1 text-xs font-medium flex-1 min-w-0" />
          <label class="flex items-center gap-1 text-[10.5px] opacity-80 cursor-pointer shrink-0" title="Permite guardar personajes, complementos y mapas desde el Compendio">
            <input type="checkbox" data-gm-cfg-tab-comp="${esc(t.id)}" ${t.allowCompendium ? 'checked' : ''} />
            <span>Compendio</span>
          </label>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-gm-cfg-move-tab="${esc(t.id)}:-1" ${idx === 0 ? 'disabled' : ''} class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg text-[10px] disabled:opacity-30" title="Subir">↑</button>
            <button type="button" data-gm-cfg-move-tab="${esc(t.id)}:1" ${idx === gm.tabs.length - 1 ? 'disabled' : ''} class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg text-[10px] disabled:opacity-30" title="Bajar">↓</button>
            <button type="button" data-gm-cfg-del-tab="${esc(t.id)}" ${gm.tabs.length <= 1 ? 'disabled' : ''} class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg text-[10px] text-rose-400 disabled:opacity-30" title="Eliminar pestaña">✕</button>
          </div>
        </div>`
      )
      .join('');

    const widgetsListHtml = tabWidgets.length
      ? tabWidgets
          .map((w, idx) => {
            const meta = GM_WIDGET_TYPES[w.type] || {};
            return `
              <div class="portal-settings-row gap-2">
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-xs font-medium truncate">${esc(w.title || meta.label || w.type)}</span>
                  <span class="text-[10px] opacity-55 truncate">${esc(meta.label || w.type)}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  ${renderSwitch(`data-gm-cfg-toggle="${esc(w.id)}"`, w.enabled !== false)}
                  <button type="button" data-gm-cfg-move-w="${esc(w.id)}:-1" ${idx === 0 ? 'disabled' : ''} class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg text-[10px] disabled:opacity-30" title="Subir">↑</button>
                  <button type="button" data-gm-cfg-move-w="${esc(w.id)}:1" ${idx === tabWidgets.length - 1 ? 'disabled' : ''} class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg text-[10px] disabled:opacity-30" title="Bajar">↓</button>
                  <button type="button" data-gm-cfg-del-w="${esc(w.id)}" class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg text-[10px] text-rose-400" title="Quitar bloque">✕</button>
                </div>
              </div>`;
          })
          .join('')
      : `<div class="portal-settings-row text-[11px] opacity-60">Esta pestaña no tiene bloques todavía.</div>`;

    const widgetTypeOpts = Object.values(GM_WIDGET_TYPES)
      .map((wt) => `<option value="${esc(wt.type)}">${esc(wt.label)}</option>`)
      .join('');

    const refsHtml = (gm.references || [])
      .map(
        (r) => `
        <div class="portal-settings-row gap-2">
          <div class="min-w-0 flex-1">
            <span class="text-xs font-medium block truncate">${esc(r.title)}</span>
            <span class="text-[10px] opacity-55">${(r.items || []).length} regla(s)</span>
          </div>
          <button type="button" data-gm-cfg-del-ref="${esc(r.id)}" class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg text-[10px] text-rose-400 shrink-0" title="Eliminar tarjeta">✕</button>
        </div>`
      )
      .join('');

    return `
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <span class="portal-settings-label">Pestañas de Pantalla (Genérico)</span>
            <button type="button" id="btnGmCfgReset" class="text-[10.5px] opacity-65 hover:opacity-100">Restaurar base</button>
          </div>
          <div class="portal-settings-group">
            ${tabsListHtml}
            <form id="gmCfgAddTabForm" class="portal-settings-col">
              <div class="flex flex-wrap items-center gap-2">
                <input type="text" id="inpGmCfgTabLabel" placeholder="Nueva pestaña (ej: Jefes, Viaje, Packs)..." required class="portal-input flex-1 min-w-[140px] px-2.5 py-1.5 text-xs" />
                <label class="flex items-center gap-1.5 text-[11px] opacity-85 cursor-pointer select-none">
                  <input type="checkbox" id="chkGmCfgTabComp" checked />
                  <span>Acepta Compendio</span>
                </label>
                <button type="submit" class="portal-btn portal-btn-accent px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0">+ Pestaña</button>
              </div>
            </form>
          </div>
        </div>

        ${
          activeTab
            ? `<div class="flex flex-col gap-1.5">
                <span class="portal-settings-label">Herramientas en "${esc(activeTab.label)}"</span>
                <div class="portal-settings-group">
                  ${widgetsListHtml}
                  <form id="gmCfgAddWidgetForm" data-tab-id="${esc(activeTab.id)}" class="portal-settings-col">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <select id="selGmCfgWidgetType" class="portal-input flex-1 min-w-[140px] px-2 py-1.5 text-[11px]">${widgetTypeOpts}</select>
                      <input type="text" id="inpGmCfgWidgetTitle" placeholder="Título (opcional)" class="portal-input w-32 px-2 py-1.5 text-[11px]" />
                      <button type="submit" class="portal-btn portal-btn-accent px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0">+ Bloque</button>
                    </div>
                  </form>
                </div>
              </div>`
            : ''
        }

        <div class="flex flex-col gap-1.5">
          <span class="portal-settings-label">Tarjetas de Chuleta / Referencia</span>
          <div class="portal-settings-group">
            ${refsHtml || '<div class="portal-settings-row text-[11px] opacity-60">Sin tarjetas personalizadas aún.</div>'}
            <form id="gmCfgAddRefForm" class="portal-settings-col">
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <input type="text" id="inpGmCfgRefTitle" placeholder="Título de tarjeta (ej: Combate Naval)..." required class="portal-input flex-1 px-2.5 py-1 text-xs" />
                  <button type="submit" class="portal-btn portal-btn-accent px-3 py-1 rounded-xl text-[11px] font-semibold shrink-0">+ Tarjeta</button>
                </div>
                <textarea id="inpGmCfgRefLines" rows="2" placeholder="Una regla por línea (Etiqueta: Detalle)..." class="portal-input px-2.5 py-1 text-[11px] resize-y"></textarea>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  bindGmScreenConfigEvents(body) {
    if (!body) return;
    body.querySelectorAll('[data-gm-cfg-toggle]').forEach((chk) => {
      chk.addEventListener('change', () => Service.toggleGmWidgetEnabled(chk.dataset.gmCfgToggle, chk.checked));
    });
    body.querySelector('#btnGmCfgReset')?.addEventListener('click', () => {
      Service.resetGmScreenToPreset(true);
      this.showActionToast('Pantalla restaurada al estándar.');
    });
    body.querySelectorAll('[data-gm-cfg-pick-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.gmCfgTabId = btn.dataset.gmCfgPickTab;
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-gm-cfg-rename-tab]').forEach((inp) => {
      inp.addEventListener('change', () => Service.renameGmScreenTab(inp.dataset.gmCfgRenameTab, inp.value));
    });
    body.querySelectorAll('[data-gm-cfg-tab-comp]').forEach((chk) => {
      chk.addEventListener('change', () => Service.toggleGmScreenTabCompendium(chk.dataset.gmCfgTabComp));
    });
    body.querySelectorAll('[data-gm-cfg-move-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tid, d] = btn.dataset.gmCfgMoveTab.split(':');
        Service.moveGmScreenTab(tid, Number(d));
      });
    });
    body.querySelectorAll('[data-gm-cfg-del-tab]').forEach((btn) => {
      btn.addEventListener('click', () => Service.removeGmScreenTab(btn.dataset.gmCfgDelTab));
    });
    body.querySelector('#gmCfgAddTabForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const label = body.querySelector('#inpGmCfgTabLabel')?.value.trim();
      const allowComp = Boolean(body.querySelector('#chkGmCfgTabComp')?.checked);
      const created = Service.addGmScreenTab(label, allowComp);
      if (created) {
        this.gmCfgTabId = created.id;
        this.renderSystemModal(Service.state);
      }
    });
    body.querySelectorAll('[data-gm-cfg-move-w]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [wid, d] = btn.dataset.gmCfgMoveW.split(':');
        Service.moveGmWidget(wid, Number(d));
      });
    });
    body.querySelectorAll('[data-gm-cfg-del-w]').forEach((btn) => {
      btn.addEventListener('click', () => Service.removeGmWidget(btn.dataset.gmCfgDelW));
    });
    body.querySelector('#gmCfgAddWidgetForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const type = body.querySelector('#selGmCfgWidgetType')?.value;
      const title = body.querySelector('#inpGmCfgWidgetTitle')?.value.trim();
      Service.addGmWidget(form.dataset.tabId, type, title);
    });
    body.querySelectorAll('[data-gm-cfg-del-ref]').forEach((btn) => {
      btn.addEventListener('click', () => Service.deleteGmReference(btn.dataset.gmCfgDelRef));
    });
    body.querySelector('#gmCfgAddRefForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = body.querySelector('#inpGmCfgRefTitle')?.value.trim();
      const rawLines = body.querySelector('#inpGmCfgRefLines')?.value || '';
      const items = rawLines
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const idx = line.indexOf(':');
          return idx > 0
            ? { label: line.slice(0, idx).trim(), detail: line.slice(idx + 1).trim() }
            : { label: line, detail: '' };
        });
      if (title) Service.addGmReference(title, items);
    });
  }
};
