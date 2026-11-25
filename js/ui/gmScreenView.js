/* ==========================================================================
   GM SCREEN VIEW: CAJÓN LATERAL DERECHO, PESTAÑAS Y BANDEJA DEL COMPENDIO
   ========================================================================== */

import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS, COMPENDIUM_MAPS } from '../data/compendium.js?v=20261125a1';
import { Selector } from '../core/selector.js?v=20261125a1';
import { Service } from '../core/service.js?v=20261125a1';

export const GmScreenViewMethods = {
  bindGmScreenEvents() {
    this.els.btnToggleGmScreen?.addEventListener('click', () => {
      Service.toggleGmScreen();
    });
    this.els.btnCloseGmScreen?.addEventListener('click', () => {
      Service.toggleGmScreen(false);
    });
    this.bindDrawerResize(this.els.gmScreenDrawer, 'left', 'portal_gm_screen_width');
  },

  renderGmScreen(state) {
    const drawer = this.els.gmScreenDrawer;
    const tabsBar = this.els.gmScreenTabsBar;
    const content = this.els.gmScreenContent;
    if (!drawer || !tabsBar || !content) return;
    if (state.role !== 'gm' || !state.gmScreenOpen) return;

    const activeEl = document.activeElement;
    if (activeEl && content.contains(activeEl) && activeEl.dataset?.gmKeepFocus === '1') {
      return;
    }

    const gm = Selector.getGmScreenState(state);
    const esc = (v) => this.escapeHtml(v ?? '');
    const activeTab = gm.tabs.find((t) => t.id === gm.activeTabId) || gm.tabs[0];
    if (!activeTab) return;

    const cols = Math.max(1, Math.min(4, gm.tabs.length));
    tabsBar.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    tabsBar.innerHTML = gm.tabs
      .map(
        (tab) => `
        <button
          type="button"
          data-gm-tab="${esc(tab.id)}"
          class="portal-seg-btn truncate !px-1.5 text-[10.5px] ${tab.id === activeTab.id ? 'is-active' : ''}"
          title="${esc(tab.label)}"
        >${esc(tab.label)}</button>`
      )
      .join('');

    tabsBar.querySelectorAll('[data-gm-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.setGmScreenTab(btn.dataset.gmTab);
      });
    });

    const tabWidgets = gm.widgets.filter((w) => w.tabId === activeTab.id && w.enabled !== false);
    const hasExplicitStaging = gm.widgets.some((w) => w.tabId === activeTab.id && w.type === 'staging');
    const widgetsToRender = [...tabWidgets];
    if (activeTab.allowCompendium && !hasExplicitStaging) {
      widgetsToRender.unshift({
        id: `auto_staging_${activeTab.id}`,
        tabId: activeTab.id,
        type: 'staging',
        enabled: true,
        title: `Bandeja · ${activeTab.label}`,
        config: {}
      });
    }

    if (widgetsToRender.length === 0) {
      content.innerHTML = `
        <div class="portal-subpanel rounded-xl p-4 text-center flex flex-col items-center gap-2 text-[11px] opacity-75">
          <span>No hay herramientas activas en esta pestaña.</span>
          <button type="button" data-gm-open-cfg="1" class="portal-btn portal-btn-accent px-3 py-1 rounded-full text-[11px] font-semibold">Configurar Pantalla</button>
        </div>`;
      content.querySelector('[data-gm-open-cfg]')?.addEventListener('click', () => {
        this.sysModalSection = 'gmscreen';
        this.openSystemModal();
      });
      return;
    }

    content.innerHTML = widgetsToRender
      .map((w) => this.renderGmWidgetCard(state, gm, w))
      .join('');

    this.bindGmRenderedWidgets(content, state, gm, activeTab);
  },

  renderGmWidgetCard(state, gm, widget) {
    const esc = (v) => this.escapeHtml(v ?? '');
    let bodyHtml = '';
    if (widget.type === 'staging') {
      bodyHtml = this.renderGmStagingBody(state, gm, widget.tabId);
    } else if (widget.type === 'clocks' && typeof this.renderGmClocksBody === 'function') {
      bodyHtml = this.renderGmClocksBody(state, gm, widget);
    } else if (widget.type === 'roll_arbiter' && typeof this.renderGmRollArbiterBody === 'function') {
      bodyHtml = this.renderGmRollArbiterBody(state, gm, widget);
    } else if (widget.type === 'party_pulse' && typeof this.renderGmPartyPulseBody === 'function') {
      bodyHtml = this.renderGmPartyPulseBody(state, gm, widget);
    } else if (widget.type === 'notes' && typeof this.renderGmNotesBody === 'function') {
      bodyHtml = this.renderGmNotesBody(state, gm, widget);
    } else if (widget.type === 'tables' && typeof this.renderGmTablesBody === 'function') {
      bodyHtml = this.renderGmTablesBody(state, gm, widget);
    } else if (widget.type === 'reference' && typeof this.renderGmReferenceBody === 'function') {
      bodyHtml = this.renderGmReferenceBody(state, gm, widget);
    } else {
      bodyHtml = `<div class="text-[10.5px] opacity-55 py-1">Herramienta lista para siguiente fase.</div>`;
    }

    return `
      <section data-gm-widget="${esc(widget.id)}" data-gm-widget-type="${esc(widget.type)}" class="portal-subpanel rounded-xl p-2.5 flex flex-col gap-2 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10.5px] font-semibold uppercase tracking-wider opacity-70 truncate">${esc(widget.title || widget.type)}</span>
          ${this.renderGmWidgetHeaderAction?.(state, gm, widget) || ''}
        </div>
        ${bodyHtml}
      </section>
    `;
  },

  resolvePinnedCompendiumEntry(state, pin) {
    if (!pin) return null;
    if (pin.kind === 'actor') {
      const all = [...(state.customActors || []), ...COMPENDIUM_ACTORS];
      return all.find((a) => a.key === pin.key) || null;
    }
    if (pin.kind === 'item') {
      const all = [...(state.customItems || []), ...COMPENDIUM_ITEMS];
      return all.find((i) => i.key === pin.key) || null;
    }
    if (pin.kind === 'map') {
      const all = [...(state.customMaps || []), ...COMPENDIUM_MAPS];
      return all.find((m) => m.key === pin.key) || null;
    }
    if (pin.kind === 'handout') {
      return { title: pin.title || 'Handout', url: pin.url || '' };
    }
    return null;
  },

  renderGmStagingBody(state, gm, tabId) {
    const esc = (v) => this.escapeHtml(v ?? '');
    const pins = (gm.pins || []).filter((p) => p.tabId === tabId);
    const kindLabels = { actor: 'Personajes', item: 'Complementos', map: 'Escenarios', handout: 'Handouts' };
    const groups = ['actor', 'item', 'map', 'handout']
      .map((kind) => ({
        kind,
        label: kindLabels[kind],
        entries: pins
          .filter((p) => p.kind === kind)
          .map((pin) => ({ pin, data: this.resolvePinnedCompendiumEntry(state, pin) }))
          .filter((x) => Boolean(x.data))
      }))
      .filter((g) => g.entries.length > 0);

    const listHtml = groups.length
      ? groups
          .map(
            (grp) => `
            <div class="flex flex-col gap-1">
              <span class="text-[9.5px] font-semibold uppercase tracking-wider opacity-50 px-1">${grp.label}</span>
              ${grp.entries
                .map(({ pin, data }) => {
                  if (pin.kind === 'actor') {
                    const color = data.color || '#8b5cf6';
                    const initials = String(data.name || '?').slice(0, 2).toUpperCase();
                    const hasImg = Boolean(data.imageUrl);
                    const avatar = hasImg
                      ? `<img src="${esc(data.imageUrl)}" alt="" draggable="false" class="w-full h-full object-contain pointer-events-none select-none" />`
                      : initials;
                    return `
                      <div draggable="true" data-drag-spec="actor:${esc(data.key)}" class="portal-list-row px-2 py-1.5 flex items-center justify-between gap-2 cursor-grab">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="w-6 h-6 ${hasImg ? '' : 'rounded-full overflow-hidden'} flex items-center justify-center font-bold text-[10px] text-white shrink-0" style="background:${hasImg ? 'transparent' : esc(color)};">${avatar}</span>
                          <div class="min-w-0">
                            <div class="text-xs font-semibold truncate">${esc(data.name)}</div>
                            <div class="text-[10px] opacity-60 truncate">HP ${data.hp || 10} · CA ${data.ac || 12}</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button type="button" data-gm-spawn-actor="${esc(data.key)}" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[10px] font-semibold" title="Desplegar en el mapa">+</button>
                          <button type="button" data-gm-unpin="${esc(pin.id)}" class="portal-btn w-5 h-5 p-0 rounded-full opacity-55 hover:opacity-100 text-[10px]" title="Quitar de Pantalla">✕</button>
                        </div>
                      </div>`;
                  }
                  if (pin.kind === 'item') {
                    return `
                      <div draggable="true" data-drag-spec="item:${esc(data.key)}" class="portal-list-row px-2 py-1.5 flex items-center justify-between gap-2 cursor-grab">
                        <div class="flex items-center gap-2 min-w-0">
                          ${this.renderItemIconBadge(data)}
                          <div class="min-w-0">
                            <div class="text-xs font-semibold truncate">${esc(data.name)}</div>
                            <div class="text-[10px] opacity-60 truncate">${esc(data.badge || 'Complemento')}</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button type="button" data-gm-equip-item="${esc(data.key)}" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[10px] font-semibold" title="Equipar en token seleccionado">Equip.</button>
                          <button type="button" data-gm-unpin="${esc(pin.id)}" class="portal-btn w-5 h-5 p-0 rounded-full opacity-55 hover:opacity-100 text-[10px]" title="Quitar de Pantalla">✕</button>
                        </div>
                      </div>`;
                  }
                  if (pin.kind === 'map') {
                    const isCurrent = state.activeMapKey === data.key || state.mapId === data.key;
                    return `
                      <div draggable="true" data-drag-spec="map:${esc(data.key)}" class="portal-list-row px-2 py-1.5 flex items-center justify-between gap-2 cursor-grab">
                        <div class="min-w-0">
                          <div class="text-xs font-semibold truncate">${esc(data.name)}</div>
                          <div class="text-[10px] opacity-60 truncate">${esc(data.desc || 'Escenario')}</div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button type="button" data-gm-activate-map="${esc(data.key)}" class="portal-btn px-2 py-0.5 rounded-full text-[10px] font-semibold ${isCurrent ? 'portal-btn-accent' : 'portal-subpanel'}">${isCurrent ? 'Activo' : 'Abrir'}</button>
                          <button type="button" data-gm-unpin="${esc(pin.id)}" class="portal-btn w-5 h-5 p-0 rounded-full opacity-55 hover:opacity-100 text-[10px]" title="Quitar de Pantalla">✕</button>
                        </div>
                      </div>`;
                  }
                  return `
                    <div class="portal-list-row px-2 py-1.5 flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-xs font-semibold truncate">${esc(data.title)}</div>
                        <div class="text-[10px] opacity-60 truncate">Handout</div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <button type="button" data-gm-show-handout="${esc(pin.id)}" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[10px] font-semibold">Mostrar</button>
                        <button type="button" data-gm-unpin="${esc(pin.id)}" class="portal-btn w-5 h-5 p-0 rounded-full opacity-55 hover:opacity-100 text-[10px]" title="Quitar de Pantalla">✕</button>
                      </div>
                    </div>`;
                })
                .join('')}
            </div>`
          )
          .join('')
      : `<div class="text-[11px] opacity-60 py-2 text-center leading-relaxed">
           Sin elementos fijados aún.<br/>
           Abre el <strong>Baúl</strong> y usa clic derecho → <em>Agregar a la Pantalla</em>.
         </div>`;

    return `
      <div class="flex flex-col gap-2">
        ${listHtml}
        <div class="flex items-center justify-end gap-1.5 pt-1 border-t" style="border-color: var(--hairline);">
          <button type="button" data-gm-open-compendium="1" class="portal-btn portal-subpanel px-2.5 py-1 rounded-lg text-[10.5px] font-medium">+ Desde Baúl</button>
        </div>
      </div>
    `;
  },

  bindGmRenderedWidgets(content, state, gm, activeTab) {
    content.querySelectorAll('[data-drag-spec]').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', card.dataset.dragSpec);
          e.dataTransfer.setData('application/x-portal-drag', card.dataset.dragSpec);
        }
      });
    });

    content.querySelectorAll('[data-gm-unpin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.unpinFromGmScreen(btn.dataset.gmUnpin);
      });
    });

    content.querySelectorAll('[data-gm-spawn-actor]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.gmSpawnActor;
        const tpl = [...(state.customActors || []), ...COMPENDIUM_ACTORS].find((a) => a.key === key);
        if (!tpl) return;
        const center = Selector.screenToWorld(Service.state, window.innerWidth / 2, window.innerHeight / 2);
        await Service.spawnActorFromTemplate(tpl, center.x, center.y);
        this.showActionToast(`${tpl.name} desplegado en el tablero.`);
      });
    });

    content.querySelectorAll('[data-gm-equip-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.gmEquipItem;
        const it = [...(state.customItems || []), ...COMPENDIUM_ITEMS].find((x) => x.key === key);
        const tokId = Service.state.selectedTokenId;
        if (!it || !tokId) {
          this.showActionToast('Seleccioná una ficha en el tablero para equipar.');
          return;
        }
        this.activeSheetTab = this.getItemCategory(it.kind);
        const res = Service.equipItemToToken(tokId, it);
        if (res) this.showActionToast(`${it.name} equipado en ${res.token.name}.`);
      });
    });

    content.querySelectorAll('[data-gm-activate-map]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.gmActivateMap;
        const mapTpl = [...(state.customMaps || []), ...COMPENDIUM_MAPS].find((m) => m.key === key);
        await Service.activateMapTemplate(mapTpl || { key });
        this.showActionToast(`Escenario "${mapTpl?.name || key}" activado.`);
      });
    });

    content.querySelectorAll('[data-gm-show-handout]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pin = (gm.pins || []).find((p) => p.id === btn.dataset.gmShowHandout);
        if (pin?.url) Service.showHandout(pin.url, pin.title || 'Handout');
      });
    });

    content.querySelector('[data-gm-open-compendium]')?.addEventListener('click', () => {
      Service.state.gmScreenOpen = false;
      Service.state.drawerOpen = true;
      Service.notify({ skipVaultSave: true });
    });

    this.bindGmClockEvents(content);
    this.bindGmExtraWidgetEvents?.(content, state, gm, activeTab);
  },

  renderClockSvg(segments = 6, value = 0, color = '#8b5cf6', sizePx = 22) {
    const segs = Math.max(2, Math.min(12, Number(segments) || 6));
    const val = Math.max(0, Math.min(segs, Number(value) || 0));
    const r = 10;
    const slices = [];
    for (let i = 0; i < segs; i += 1) {
      const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / segs;
      const a2 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / segs;
      const x1 = (12 + r * Math.cos(a1)).toFixed(2);
      const y1 = (12 + r * Math.sin(a1)).toFixed(2);
      const x2 = (12 + r * Math.cos(a2)).toFixed(2);
      const y2 = (12 + r * Math.sin(a2)).toFixed(2);
      const filled = i < val;
      slices.push(
        `<path d="M12 12 L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${filled ? this.escapeHtml(color) : 'rgba(255,255,255,0.08)'}" stroke="rgba(15,23,42,0.55)" stroke-width="1.15" stroke-linejoin="round" />`
      );
    }
    return `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" class="shrink-0">${slices.join('')}<circle cx="12" cy="12" r="${r}" fill="none" stroke="currentColor" stroke-opacity="0.28" stroke-width="1" /></svg>`;
  },

  renderGmClocksBody(state, gm) {
    const esc = (v) => this.escapeHtml(v ?? '');
    const clocks = Array.isArray(gm.clocks) ? gm.clocks : [];
    const listHtml = clocks.length
      ? clocks
          .map((clk) => {
            const isCounter = clk.kind === 'counter';
            const segs = Math.max(2, Math.min(12, Number(clk.segments) || 6));
            const val = Math.max(0, Number(clk.value) || 0);
            const visual = isCounter
              ? `<span class="min-w-[26px] h-6 px-1.5 rounded-lg flex items-center justify-center font-mono-tech text-[11px] font-bold text-white shrink-0 tabular-nums" style="background:${esc(clk.color || '#8b5cf6')};">${val}</span>`
              : `<button type="button" data-gm-clk-step="${esc(clk.id)}:1" title="Clic +1 / Clic derecho −1" class="shrink-0 hover:scale-105 transition-transform">${this.renderClockSvg(segs, val, clk.color || '#8b5cf6', 24)}</button>`;
            const detail = isCounter ? 'Contador' : `${val}/${segs}`;
            return `
              <div class="portal-list-row px-2 py-1.5 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  ${visual}
                  <div class="min-w-0">
                    <div class="text-xs font-semibold truncate">${esc(clk.label)}</div>
                    <div class="text-[10px] opacity-60 font-mono-tech tabular-nums">${detail}${clk.isPublic ? ' · Visible' : ''}</div>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button type="button" data-gm-clk-step="${esc(clk.id)}:-1" class="portal-btn portal-subpanel w-5 h-5 p-0 rounded-full text-[11px] font-bold" title="Restar">−</button>
                  <button type="button" data-gm-clk-step="${esc(clk.id)}:1" class="portal-btn portal-subpanel w-5 h-5 p-0 rounded-full text-[11px] font-bold" title="Sumar">+</button>
                  <button type="button" data-gm-clk-pub="${esc(clk.id)}" class="portal-btn w-6 h-5 p-0 rounded-full flex items-center justify-center ${clk.isPublic ? 'portal-btn-accent' : 'portal-subpanel opacity-55 hover:opacity-100'}" title="${clk.isPublic ? 'Visible para jugadores (clic para ocultar)' : 'Privado del GM (clic para mostrar en mesa)'}">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button type="button" data-gm-clk-del="${esc(clk.id)}" class="portal-btn w-5 h-5 p-0 rounded-full opacity-50 hover:opacity-100 text-[10px]" title="Eliminar">✕</button>
                </div>
              </div>`;
          })
          .join('')
      : `<div class="text-[11px] opacity-60 text-center py-1">Sin relojes o contadores aún.</div>`;

    return `
      <div class="flex flex-col gap-1.5">
        ${listHtml}
        <div class="flex items-center justify-end pt-1 border-t" style="border-color: var(--hairline);">
          <button type="button" data-gm-toggle-clock-form="1" class="portal-btn ${this.gmClockFormOpen ? 'portal-btn-accent' : 'portal-subpanel'} px-2.5 py-1 rounded-lg text-[10.5px] font-medium">+ Reloj / Contador</button>
        </div>
        <form data-gm-clock-form="1" class="${this.gmClockFormOpen ? 'flex' : 'hidden'} flex-col gap-1.5 pt-1">
          <input type="text" data-gm-clk-label="1" placeholder="Ej: Alarma, Miedo, Antorchas..." required class="portal-input px-2 py-1 text-[11px]" />
          <div class="grid grid-cols-3 gap-1.5 items-center">
            <select data-gm-clk-kind="1" class="portal-input px-1.5 py-1 text-[10.5px]">
              <option value="clock">Reloj</option>
              <option value="counter">Contador</option>
            </select>
            <select data-gm-clk-segs="1" class="portal-input px-1.5 py-1 text-[10.5px]" title="Segmentos del reloj">
              <option value="4">4 seg</option>
              <option value="6" selected>6 seg</option>
              <option value="8">8 seg</option>
              <option value="12">12 seg</option>
            </select>
            <div class="flex items-center justify-between gap-1 px-1">
              <input type="color" data-gm-clk-color="1" value="#8b5cf6" class="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0" title="Color" />
              <label class="flex items-center gap-1 text-[10px] cursor-pointer" title="Mostrar píldora pública en mesa">
                <input type="checkbox" data-gm-clk-ispub="1" />
                <span>Púb</span>
              </label>
            </div>
          </div>
          <button type="submit" class="portal-btn portal-btn-accent px-2.5 py-1 rounded-lg text-[10.5px] font-semibold">Crear</button>
        </form>
      </div>
    `;
  },

  bindGmClockEvents(content) {
    content.querySelectorAll('[data-gm-clk-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [id, rawDelta] = btn.dataset.gmClkStep.split(':');
        Service.stepGmClock(id, Number(rawDelta) || 1);
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const [id] = btn.dataset.gmClkStep.split(':');
        Service.stepGmClock(id, -1);
      });
    });
    content.querySelectorAll('[data-gm-clk-pub]').forEach((btn) => {
      btn.addEventListener('click', () => Service.toggleGmClockPublic(btn.dataset.gmClkPub));
    });
    content.querySelectorAll('[data-gm-clk-del]').forEach((btn) => {
      btn.addEventListener('click', () => Service.deleteGmClock(btn.dataset.gmClkDel));
    });
    content.querySelector('[data-gm-toggle-clock-form]')?.addEventListener('click', () => {
      this.gmClockFormOpen = !this.gmClockFormOpen;
      this.renderGmScreen(Service.state);
    });
    content.querySelector('[data-gm-clock-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const label = form.querySelector('[data-gm-clk-label]')?.value.trim();
      if (!label) return;
      this.gmClockFormOpen = false;
      Service.addGmClock({
        label,
        kind: form.querySelector('[data-gm-clk-kind]')?.value || 'clock',
        segments: Number(form.querySelector('[data-gm-clk-segs]')?.value) || 6,
        color: form.querySelector('[data-gm-clk-color]')?.value || '#8b5cf6',
        isPublic: Boolean(form.querySelector('[data-gm-clk-ispub]')?.checked)
      });
    });
  },

  renderPublicClocksBar(state) {
    const bar = this.els.publicClocksBar;
    if (!bar) return;
    const clocks = Selector.getPublicClocks(state);
    if (!clocks.length) {
      bar.classList.add('hidden');
      bar.classList.remove('flex');
      bar.innerHTML = '';
      return;
    }

    const esc = (v) => this.escapeHtml(v ?? '');
    const isGm = state.role === 'gm';
    bar.classList.remove('hidden');
    bar.classList.add('flex');
    bar.innerHTML = clocks
      .map((clk) => {
        const isCounter = clk.kind === 'counter';
        const badge = isCounter
          ? `<span class="min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-mono-tech text-[10px] font-bold text-white tabular-nums" style="background:${esc(clk.color)};">${clk.value}</span>`
          : this.renderClockSvg(clk.segments, clk.value, clk.color, 18);
        const tag = isCounter ? '' : `<span class="text-[10px] font-mono-tech opacity-65 tabular-nums">${clk.value}/${clk.segments}</span>`;
        if (isGm) {
          return `
            <button
              type="button"
              data-pub-clk-id="${esc(clk.id)}"
              class="portal-subpanel portal-btn px-2 py-0.5 rounded-full text-[11px] gap-1.5 h-7"
              title="${esc(clk.label)} — Clic +1 / Clic derecho −1"
            >
              ${badge}
              <span class="font-medium max-w-[95px] truncate">${esc(clk.label)}</span>
              ${tag}
            </button>`;
        }
        return `
          <div class="portal-subpanel px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1.5 h-7" title="${esc(clk.label)}">
            ${badge}
            <span class="font-medium max-w-[95px] truncate">${esc(clk.label)}</span>
            ${tag}
          </div>`;
      })
      .join('');

    if (isGm) {
      bar.querySelectorAll('[data-pub-clk-id]').forEach((btn) => {
        btn.addEventListener('click', () => Service.stepGmClock(btn.dataset.pubClkId, 1));
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          Service.stepGmClock(btn.dataset.pubClkId, -1);
        });
      });
    }
  }
};
