import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS, COMPENDIUM_MAPS, buildPresetWallsForMap } from '../data/compendium.js?v=20261123a7';
import { Selector } from '../core/selector.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';
import { normalizeGridConfig } from '../utils/gridGeometry.js?v=20261123a7';
import {
  displayValueToMeters,
  metersToDisplayValue,
  normalizeSceneLighting
} from '../utils/lightingModel.js?v=20261123a7';
import { clampTokenSize } from '../utils/tokenTemplateSync.js?v=20261123a7';
import { groupCompendiumItemsForPicker } from '../utils/pickerModel.js?v=20261123a7';
import { resolveMapCardDescriptor } from '../utils/compendiumCardModel.js?v=20261123a7';
import { parseDragSpec, resolveEntryFolder } from '../utils/compendiumDragModel.js?v=20261123a7';
import { drawPresetMapBackground } from './canvasView.js?v=20261123a7';

export const CompendiumViewMethods = {
  getPresetMapThumbnail(mapId) {
    if (!mapId) return '';
    if (!this._presetMapThumbCache) this._presetMapThumbCache = new Map();
    if (this._presetMapThumbCache.has(mapId)) return this._presetMapThumbCache.get(mapId);
    if (typeof document === 'undefined') return '';
    try {
      const w = 320;
      const h = 213;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.save();
      ctx.scale(w / 2400, h / 1600);
      drawPresetMapBackground(ctx, mapId);
      ctx.restore();
      let url = canvas.toDataURL('image/webp', 0.82);
      if (!url || !url.startsWith('data:image/webp')) {
        url = canvas.toDataURL('image/png');
      }
      this._presetMapThumbCache.set(mapId, url);
      return url;
    } catch {
      return '';
    }
  },
  setCustomTokenDetailsOpen(open) {
    const isOpen = Boolean(open);
    this.els.customTokenDetailsBody?.classList.toggle('hidden', !isOpen);
    this.els.customTokenDetailsBody?.classList.toggle('flex', isOpen);
    this.els.customTokenDetailsToggle?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (this.els.customTokenDetailsChevron) {
      this.els.customTokenDetailsChevron.textContent = isOpen ? '▾' : '▸';
    }
  },

  setCustomTokenItemsPickerOpen(open) {
    const isOpen = Boolean(open);
    this.customTokenItemsPickerOpen = isOpen;
    this.els.customTokenItemsPicker?.classList.toggle('hidden', !isOpen);
    this.els.customTokenItemsPicker?.classList.toggle('flex', isOpen);
    this.els.btnToggleCustomTokenItemsPicker?.classList.toggle('portal-btn-accent', isOpen);
    this.els.btnToggleCustomTokenItemsPicker?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
      this.renderCustomTokenItemsPickerList(Service.state);
      this.els.inpCustomTokenItemSearch?.focus();
    } else {
      this.customTokenItemsPickerQuery = '';
      if (this.els.inpCustomTokenItemSearch) this.els.inpCustomTokenItemSearch.value = '';
    }
  },

  syncCustomTokenSizeSeg() {
    const size = clampTokenSize(this.selectedTokenSize, 1);
    this.selectedTokenSize = size;
    this.els.customTokenSizeSeg?.querySelectorAll('[data-token-size]').forEach((btn) => {
      btn.classList.toggle('is-active', Number(btn.dataset.tokenSize) === size);
    });
  },

  syncCustomTokenAllyHint() {
    const mode = this.selectedTokenAlly === 'enemy' ? 'enemy' : 'ally';
    this.selectedTokenAlly = mode;
    this.els.customTokenAllySeg?.querySelectorAll('[data-token-ally]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tokenAlly === mode);
    });
    const el = this.els.lblCustomTokenAllyHint;
    if (!el) return;
    el.textContent =
      mode === 'ally'
        ? 'Protagonista: identidad única que conserva HP y equipo en partida.'
        : 'Secundario: molde fijo que crea instancias independientes en cada despliegue.';
  },

  renderCustomTokenStatsGrid(state, presetStats = null) {
    const grid = this.els.customTokenStatsGrid;
    if (!grid) return;
    const defs = Selector.getSheetStatsDef(state);
    const statList = defs.length > 0 ? defs.slice(0, 9) : [
      { key: 'str', label: 'FUE' },
      { key: 'dex', label: 'DES' },
      { key: 'con', label: 'CON' },
      { key: 'int', label: 'INT' },
      { key: 'wis', label: 'SAB' },
      { key: 'cha', label: 'CAR' }
    ];
    const currentVals = {};
    if (!presetStats) {
      grid.querySelectorAll('[data-custom-stat-key]').forEach((inp) => {
        currentVals[inp.dataset.customStatKey] = Number(inp.value) || 0;
      });
    }
    const esc = (s) => this.escapeHtml(s);
    grid.innerHTML = statList
      .map((def, idx) => {
        const val = presetStats
          ? Number(presetStats[def.key] ?? 0)
          : currentVals[def.key] !== undefined
            ? currentVals[def.key]
            : idx < 3
              ? 1
              : 0;
        return `
          <label class="portal-input px-1.5 py-1 flex flex-col items-center text-[9px]">
            <span class="opacity-55 truncate max-w-full">${esc(def.label || def.key.toUpperCase())}</span>
            <input type="number" data-custom-stat-key="${esc(def.key)}" value="${val}" min="-99" max="999" class="portal-num-input w-full text-[11px] font-semibold" />
          </label>
        `;
      })
      .join('');
  },

  getAvailableCompendiumItems(state) {
    const preset = state.systemConfig?.preset || state.ruleset || 'dnd55';
    const baseItems =
      preset === 'vieja_escuela'
        ? COMPENDIUM_ITEMS.filter((i) => i.system === 'vieja_escuela')
        : state.ruleset === 'free'
          ? COMPENDIUM_ITEMS.filter((i) => i.system !== 'vieja_escuela' && !String(i.key || '').startsWith('55_'))
          : COMPENDIUM_ITEMS.filter((i) => i.system !== 'vieja_escuela');
    return {
      custom: Array.isArray(state.customItems) ? state.customItems : [],
      base: baseItems
    };
  },

  renderCustomTokenItemsPickerList(state) {
    const listEl = this.els.customTokenItemsPickerList;
    if (!listEl) return;
    if (!this.expandedPickerFolders) this.expandedPickerFolders = new Set();
    const { custom, base } = this.getAvailableCompendiumItems(state);
    const { groups, totalMatches, hasQuery } = groupCompendiumItemsForPicker({
      customItems: custom,
      baseItems: base,
      query: this.customTokenItemsPickerQuery || '',
      selectedKeys: this.pendingCustomTokenItems || []
    });
    const esc = (s) => this.escapeHtml(s);

    if (totalMatches === 0) {
      listEl.innerHTML = `<div class="text-[10.5px] opacity-55 text-center py-4">Sin complementos que coincidan.</div>`;
      return;
    }

    listEl.innerHTML = groups
      .map((grp) => {
        const isOpen = hasQuery || this.expandedPickerFolders.has(grp.id);
        const selBadge =
          grp.selectedTotal > 0
            ? `<span class="text-[9px] font-mono-tech px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 shrink-0">${grp.selectedTotal}✓</span>`
            : '';
        const itemsHtml = isOpen
          ? `<div class="pl-2.5 ml-2 border-l flex flex-col gap-0.5 my-0.5" style="border-color: var(--hairline);">
              ${grp.items
                .map((it) => {
                  const cnt = it.selectedCount || 0;
                  const iconColor = esc(it.color || '#8b5cf6');
                  return `
                    <div class="portal-ctx-item justify-between gap-1.5 rounded-lg !min-h-[28px] !py-1 !px-1.5">
                      <button type="button" data-picker-add-item="${esc(it.key)}" class="flex items-center gap-2 min-w-0 flex-1 text-left" title="Añadir ${esc(it.name)}">
                        <span class="w-2 h-2 rounded-full shrink-0" style="background:${iconColor};"></span>
                        <span class="min-w-0 flex-1">
                          <span class="block text-[11px] font-medium truncate leading-tight">${esc(it.name)}</span>
                          ${it.badge ? `<span class="block text-[9.5px] opacity-55 truncate leading-tight">${esc(it.badge)}</span>` : ''}
                        </span>
                      </button>
                      <div class="flex items-center gap-1 shrink-0">
                        ${
                          cnt > 0
                            ? `<button type="button" data-picker-dec-item="${esc(it.key)}" class="w-5 h-5 rounded-full portal-subpanel flex items-center justify-center text-[10px] opacity-80 hover:opacity-100" title="Quitar 1">−</button>
                               <span class="text-[10px] font-mono-tech font-semibold text-violet-300 min-w-[16px] text-center">×${cnt}</span>`
                            : ''
                        }
                        <button type="button" data-picker-add-item="${esc(it.key)}" class="w-5 h-5 rounded-full ${cnt > 0 ? 'portal-btn-accent' : 'portal-subpanel'} flex items-center justify-center text-[11px] font-semibold" title="Añadir">+</button>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>`
          : '';
        return `
          <div class="flex flex-col">
            <button
              type="button"
              data-picker-toggle-folder="${esc(grp.id)}"
              class="portal-list-row px-1.5 py-1 flex items-center justify-between gap-2 text-left rounded-lg select-none"
            >
              <span class="flex items-center gap-1.5 min-w-0">
                <svg class="w-3 h-3 opacity-60 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4" /></svg>
                <svg class="w-3.5 h-3.5 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.7l1.2 1.5h5.1A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5V4.5z" /></svg>
                <span class="text-[11px] font-semibold truncate">${esc(grp.label)}</span>
                <span class="text-[9.5px] opacity-50 tabular-nums shrink-0">${grp.items.length}</span>
              </span>
              ${selBadge}
            </button>
            ${itemsHtml}
          </div>
        `;
      })
      .join('');
  },

  renderCustomTokenStarterItems(state) {
    const chips = this.els.customTokenStarterItems;
    const countBadge = this.els.lblCustomTokenItemsCount;
    if (!Array.isArray(this.pendingCustomTokenItems)) this.pendingCustomTokenItems = [];
    const { custom, base } = this.getAvailableCompendiumItems(state);
    const allByKey = new Map();
    [...custom, ...base].forEach((it) => {
      if (it?.key && !allByKey.has(it.key)) allByKey.set(it.key, it);
    });
    const esc = (s) => this.escapeHtml(s);

    if (countBadge) {
      const n = this.pendingCustomTokenItems.length;
      countBadge.textContent = String(n);
      countBadge.classList.toggle('hidden', n === 0);
    }

    if (chips) {
      chips.innerHTML = this.pendingCustomTokenItems
        .map((key, idx) => {
          const item = allByKey.get(key);
          const label = item ? item.name : key;
          const dotColor = esc(item?.color || '#8b5cf6');
          return `
            <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/10 border border-white/10 max-w-full">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${dotColor};"></span>
              <span class="truncate max-w-[130px]">${esc(label)}</span>
              <button type="button" data-remove-starter-idx="${idx}" class="opacity-65 hover:opacity-100 leading-none" title="Quitar complemento" aria-label="Quitar ${esc(label)}">×</button>
            </span>
          `;
        })
        .join('');
    }

    if (this.customTokenItemsPickerOpen) {
      this.renderCustomTokenItemsPickerList(state);
    }
  },

  resetCustomTokenFormDraft(state) {
    const visionCfg = Selector.getSystemVisionConfig(state);
    const vUnit = visionCfg.distanceUnit;
    if (this.els.inpCustomTokenName) this.els.inpCustomTokenName.value = '';
    if (this.els.inpCustomTokenRole) this.els.inpCustomTokenRole.value = '';
    if (this.els.inpCustomTokenHp) this.els.inpCustomTokenHp.value = '16';
    if (this.els.inpCustomTokenAc) this.els.inpCustomTokenAc.value = '13';
    this.selectedTokenAlly = 'ally';
    this.selectedTokenSize = 1;
    this.pendingCustomTokenItems = [];
    this.expandedPickerFolders = new Set();
    this.setCustomTokenItemsPickerOpen(false);
    if (this.els.inpCustomTokenImg) this.els.inpCustomTokenImg.value = '';
    if (this.els.inpCustomTokenVision) {
      this.els.inpCustomTokenVision.value = '';
      this.els.inpCustomTokenVision.placeholder = String(metersToDisplayValue(visionCfg.defaultVisionMeters, vUnit));
      this.els.inpCustomTokenVision.step = vUnit === 'ft' ? '5' : '0.5';
    }
    if (this.els.lblCustomTokenVisionUnit) this.els.lblCustomTokenVisionUnit.textContent = vUnit;
    if (this.els.inpCustomTokenLight) {
      this.els.inpCustomTokenLight.value = '';
      this.els.inpCustomTokenLight.step = vUnit === 'ft' ? '5' : '0.5';
    }
    if (this.els.lblCustomTokenLightUnit) this.els.lblCustomTokenLightUnit.textContent = vUnit;
    if (this.els.inpCustomTokenPublicDesc) this.els.inpCustomTokenPublicDesc.value = '';
    if (this.els.inpCustomTokenFolder) this.els.inpCustomTokenFolder.value = '';
    this.syncCustomTokenSizeSeg();
    this.syncCustomTokenAllyHint();
    this.renderCustomTokenStatsGrid(state, {});
    this.renderCustomTokenStarterItems(state);
    this.renderCustomTokenPreview();
    this.setCustomTokenDetailsOpen(false);
  },
  renderCustomMapGridSummary() {
    const el = this.els.lblCustomMapGridSummary;
    if (!el) return;
    const g = normalizeGridConfig(this.pendingCustomMapGrid || {});
    const l = normalizeSceneLighting(this.pendingCustomMapLighting || {});
    const label =
      g.type === 'none'
        ? 'Sin grilla'
        : g.type === 'hex-v'
          ? 'Hex (punta)'
          : g.type === 'hex-h'
            ? 'Hex (lado)'
            : 'Cuadrada';
    const lightLabel = l.dynamicLighting ? 'Luz dinámica' : 'Luz ambiental';
    el.textContent = `${label} · ${Number(g.cellSize.toFixed(1))}px · ${lightLabel}`;
  },

  syncCustomMapModeSeg() {
    const mode = this.selectedCustomMapMode === 'narrative' ? 'narrative' : 'tactical';
    this.selectedCustomMapMode = mode;
    this.els.customMapModeSeg?.querySelectorAll('[data-map-mode]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mapMode === mode);
    });
    this.els.customMapGridSection?.classList.toggle('hidden', mode === 'narrative');
  },

  renderCustomTokenPreview() {
    const preview = this.els.btnCustomTokenPreview;
    if (!preview) return;
    const url = String(this.els.inpCustomTokenImg?.value || '').trim();
    const color = this.selectedTokenColor || '#8b5cf6';
    const name = String(this.els.inpCustomTokenName?.value || '').trim();
    const hasImg = Boolean(url);
    preview.style.backgroundColor = hasImg ? 'transparent' : color;
    preview.classList.toggle('rounded-full', !hasImg);
    preview.classList.toggle('overflow-hidden', !hasImg);
    preview.classList.toggle('rounded-xl', hasImg);
    preview.classList.toggle('border-transparent', hasImg);
    preview.classList.toggle('border-white/15', !hasImg);
    preview.innerHTML = hasImg
      ? `<img src="${this.escapeHtml(url)}" alt="Token" class="w-full h-full object-contain pointer-events-none" />`
      : `<span>${this.escapeHtml((name || 'PJ').slice(0, 2).toUpperCase())}</span>`;
    this.els.btnEditCustomTokenImg?.classList.toggle('hidden', !hasImg);
  },

  bindCompendiumEvents() {
    const setCompendiumBrowseVisible = (visible) => {
      [this.els.compendiumTabs, this.els.inpCompendiumSearch, this.els.tokenTemplatesGrid, this.els.btnNewCompendiumFolder].forEach((el) => {
        if (!el) return;
        el.classList.toggle('hidden', !visible);
      });
    };

    // 5. Compendio Derecho Tabs, Carpetas & Formularios
    this.closeAllCompendiumForms = () => {
      this.editingCompendiumKey = null;
      [this.els.compendiumFolderForm, this.els.customTokenForm, this.els.customItemForm, this.els.customMapForm].forEach((f) => {
        if (!f) return;
        f.classList.add('hidden');
        f.classList.remove('flex');
      });
      if (this.els.customItemIconGrid) {
        this.els.customItemIconGrid.classList.add('hidden');
        this.renderCustomItemIconGrid();
      }
      this.setCustomTokenItemsPickerOpen(false);
      if (this.els.lblCustomItemFormTitle) this.els.lblCustomItemFormTitle.textContent = 'Nuevo complemento';
      if (this.els.lblCustomFormTitle) this.els.lblCustomFormTitle.textContent = 'Nuevo personaje';
      if (this.els.lblCustomMapFormTitle) this.els.lblCustomMapFormTitle.textContent = 'Nuevo escenario';
      this.pendingCustomMapGrid = normalizeGridConfig({});
      this.pendingCustomMapLighting = normalizeSceneLighting({});
      this.selectedCustomMapMode = 'tactical';
      this.syncCustomMapModeSeg();
      if (this.els.selCustomMapWeather) this.els.selCustomMapWeather.value = 'none';
      this.renderCustomMapGridSummary();
      if (this.els.btnToggleCustomToken) this.els.btnToggleCustomToken.classList.remove('portal-btn-accent');
      if (this.els.btnNewCompendiumFolder) this.els.btnNewCompendiumFolder.classList.remove('portal-btn-accent');
      setCompendiumBrowseVisible(true);
    };
    const closeAllCompendiumForms = this.closeAllCompendiumForms;

    this.openCompendiumForm = (formEl, triggerBtn, focusEl, keepEditKey = false) => {
      const wasOpen = !keepEditKey && formEl && !formEl.classList.contains('hidden');
      const prevEditKey = keepEditKey ? this.editingCompendiumKey : null;
      closeAllCompendiumForms();
      this.editingCompendiumKey = prevEditKey;
      if (!wasOpen && formEl) {
        formEl.classList.remove('hidden');
        formEl.classList.add('flex');
        if (formEl !== this.els.compendiumFolderForm) {
          setCompendiumBrowseVisible(false);
        }
        if (triggerBtn) triggerBtn.classList.add('portal-btn-accent');
        if (focusEl) focusEl.focus();
      }
    };
    const openCompendiumForm = this.openCompendiumForm;

    const openFormTokenEditor = (file = null) => {
      const curUrl = this.els.inpCustomTokenImg?.value.trim() || '';
      this.openTokenEditor?.({
        initialUrl: file ? '' : curUrl,
        file,
        defaultColor: this.selectedTokenColor || '#8b5cf6',
        canRemove: Boolean(curUrl),
        onApply: (dataUrl) => {
          if (this.els.inpCustomTokenImg) this.els.inpCustomTokenImg.value = dataUrl;
          this.renderCustomTokenPreview();
          this.showActionToast('Token listo.');
        },
        onRemove: () => {
          if (this.els.inpCustomTokenImg) this.els.inpCustomTokenImg.value = '';
          this.renderCustomTokenPreview();
        }
      });
    };

    if (this.els.fileCustomTokenImg) {
      this.els.fileCustomTokenImg.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        openFormTokenEditor(file);
      });
    }
    this.els.btnOpenTokenStudioForm?.addEventListener('click', () => openFormTokenEditor());
    this.els.btnEditCustomTokenImg?.addEventListener('click', () => openFormTokenEditor());
    this.els.btnCustomTokenPreview?.addEventListener('click', () => openFormTokenEditor());
    this.els.btnCustomTokenPreview?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.els.btnCustomTokenPreview.classList.add('ring-2', 'ring-violet-400');
    });
    this.els.btnCustomTokenPreview?.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      this.els.btnCustomTokenPreview.classList.remove('ring-2', 'ring-violet-400');
    });
    this.els.btnCustomTokenPreview?.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.els.btnCustomTokenPreview.classList.remove('ring-2', 'ring-violet-400');
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type?.startsWith('image/')) {
        openFormTokenEditor(file);
      }
    });
    this.els.inpCustomTokenImg?.addEventListener('input', () => this.renderCustomTokenPreview());
    this.els.inpCustomTokenName?.addEventListener('input', () => this.renderCustomTokenPreview());
    const openCustomMapGridCalibrator = () => {
      const title = this.els.inpCustomMapName?.value.trim() || 'Nuevo escenario';
      const imageUrl = this.els.inpCustomMapImg?.value.trim() || '';
      const editingKey = this.editingCompendiumKey || '';
      const isEditingActive = Boolean(editingKey && Service.getActiveSceneKey() === editingKey);
      this.openMapGridEditor?.({
        title,
        mapId: imageUrl ? 'custom' : 'empty',
        sceneKey: editingKey,
        isActiveScene: isEditingActive,
        imageUrl,
        initialGrid: this.pendingCustomMapGrid || normalizeGridConfig({}),
        initialLighting: this.pendingCustomMapLighting || normalizeSceneLighting({}),
        walls: editingKey ? (isEditingActive ? Service.state.walls : Service.state.sceneLayers?.[editingKey]?.walls || []) : [],
        onApply: ({ grid, lighting }) => {
          this.pendingCustomMapGrid = grid;
          this.pendingCustomMapLighting = lighting;
          this.renderCustomMapGridSummary();
        }
      });
    };

    this.els.customMapModeSeg?.querySelectorAll('[data-map-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedCustomMapMode = btn.dataset.mapMode === 'narrative' ? 'narrative' : 'tactical';
        this.syncCustomMapModeSeg();
      });
    });

    if (this.els.fileCustomMapImg) {
      this.els.fileCustomMapImg.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.els.inpCustomMapImg.value = await Service.compressImageFile(file);
          if (this.selectedCustomMapMode !== 'narrative') {
            openCustomMapGridCalibrator();
          }
        } catch (err) {
          this.showActionToast(err.message);
        }
        e.target.value = '';
      });
    }
    this.els.btnCustomMapGridConfig?.addEventListener('click', openCustomMapGridCalibrator);

    this.els.compendiumTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-comp-tab]');
      if (!btn) return;
      closeAllCompendiumForms();
      Service.state.compendiumTab = btn.dataset.compTab;
      Service.notify();
    });

    this.els.inpCompendiumSearch.addEventListener('input', (e) => {
      Service.state.compendiumSearch = e.target.value;
      Service.notify();
    });

    if (this.els.btnNewCompendiumFolder) {
      this.els.btnNewCompendiumFolder.addEventListener('click', () => {
        openCompendiumForm(this.els.compendiumFolderForm, this.els.btnNewCompendiumFolder, this.els.inpNewFolderName);
      });
    }
    this.els.compendiumFolderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.els.inpNewFolderName.value.trim();
      if (!name) return;
      const tab = Service.state.compendiumTab || 'actors';
      Service.ensureCompendiumFolder(tab, name, false);
      this.els.inpNewFolderName.value = '';
      closeAllCompendiumForms();
      this.showActionToast(`Carpeta "${name}" creada.`);
    });

    if (this.els.tokenTemplatesGrid) {
      let springTimer = null;
      let springFolderKey = '';
      const clearFolderDropVisuals = () => {
        if (springTimer) {
          clearTimeout(springTimer);
          springTimer = null;
        }
        springFolderKey = '';
        this.els.tokenTemplatesGrid.classList.remove('is-root-drop-target');
        this.els.tokenTemplatesGrid.querySelectorAll('.is-folder-drop-target').forEach((el) => {
          el.classList.remove('is-folder-drop-target');
        });
      };

      this.els.tokenTemplatesGrid.addEventListener('dragover', (e) => {
        const spec = parseDragSpec(this._activeDragSpec);
        const tab = Service.state.compendiumTab || 'actors';
        if (!spec || spec.tab !== tab) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

        const folderEl = e.target?.closest?.('[data-folder-drop]');
        this.els.tokenTemplatesGrid.querySelectorAll('.is-folder-drop-target').forEach((el) => {
          if (el !== folderEl) el.classList.remove('is-folder-drop-target');
        });
        if (folderEl) {
          this.els.tokenTemplatesGrid.classList.remove('is-root-drop-target');
          folderEl.classList.add('is-folder-drop-target');
          const folderName = folderEl.dataset.folderDrop || '';
          const fKey = `${tab}:${folderName}`;
          if (this.collapsedFolders?.has(fKey)) {
            if (springFolderKey !== fKey) {
              if (springTimer) clearTimeout(springTimer);
              springFolderKey = fKey;
              springTimer = setTimeout(() => {
                this.collapsedFolders?.delete(fKey);
                this.renderCompendium(Service.state);
              }, 500);
            }
          } else if (springTimer) {
            clearTimeout(springTimer);
            springTimer = null;
            springFolderKey = '';
          }
        } else {
          if (springTimer) {
            clearTimeout(springTimer);
            springTimer = null;
            springFolderKey = '';
          }
          this.els.tokenTemplatesGrid.classList.add('is-root-drop-target');
        }
      });

      this.els.tokenTemplatesGrid.addEventListener('dragleave', (e) => {
        if (!this.els.tokenTemplatesGrid.contains(e.relatedTarget)) {
          clearFolderDropVisuals();
        }
      });

      this.els.tokenTemplatesGrid.addEventListener('drop', (e) => {
        const rawSpec =
          (e.dataTransfer && (e.dataTransfer.getData('application/x-portal-drag') || e.dataTransfer.getData('text/plain'))) ||
          this._activeDragSpec ||
          '';
        const spec = parseDragSpec(rawSpec);
        const tab = Service.state.compendiumTab || 'actors';
        const folderEl = e.target?.closest?.('[data-folder-drop]');
        const targetFolder = folderEl ? folderEl.dataset.folderDrop || '' : '';
        clearFolderDropVisuals();
        if (!spec || spec.tab !== tab) return;
        e.preventDefault();
        e.stopPropagation();
        this._isInternalDrag = false;
        this._activeDragSpec = '';
        const moved = Service.moveCompendiumEntryToFolder(tab, spec.key, targetFolder);
        if (moved) {
          this.showActionToast(targetFolder ? `Movido a "${targetFolder}".` : 'Movido a la raíz del Baúl.');
        }
      });

      window.addEventListener('dragend', clearFolderDropVisuals);
    }

    if (this.els.btnToggleCustomToken) {
      this.els.btnToggleCustomToken.addEventListener('click', () => {
        const tab = Service.state.compendiumTab || 'actors';
        if (tab === 'items') {
          this.resetItemCreatorBlocks();
          openCompendiumForm(this.els.customItemForm, this.els.btnToggleCustomToken, this.els.inpCustomItemName);
        }
        else if (tab === 'maps') {
          this.pendingCustomMapGrid = normalizeGridConfig({});
          this.pendingCustomMapLighting = normalizeSceneLighting({});
          this.renderCustomMapGridSummary();
          openCompendiumForm(this.els.customMapForm, this.els.btnToggleCustomToken, this.els.inpCustomMapName);
        }
        else {
          this.resetCustomTokenFormDraft(Service.state);
          openCompendiumForm(this.els.customTokenForm, this.els.btnToggleCustomToken, this.els.inpCustomTokenName);
        }
      });
    }
    if (this.els.btnCancelCustomToken) this.els.btnCancelCustomToken.addEventListener('click', closeAllCompendiumForms);
    if (this.els.btnCancelCustomItem) this.els.btnCancelCustomItem.addEventListener('click', closeAllCompendiumForms);
    if (this.els.btnCancelCustomMap) this.els.btnCancelCustomMap.addEventListener('click', closeAllCompendiumForms);

    this.els.customTokenSizeSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-token-size]');
      if (!btn) return;
      this.selectedTokenSize = clampTokenSize(btn.dataset.tokenSize, 1);
      this.syncCustomTokenSizeSeg();
    });
    this.els.customTokenAllySeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-token-ally]');
      if (!btn) return;
      this.selectedTokenAlly = btn.dataset.tokenAlly === 'enemy' ? 'enemy' : 'ally';
      this.syncCustomTokenAllyHint();
    });
    this.els.customTokenDetailsToggle?.addEventListener('click', () => {
      const isOpen = this.els.customTokenDetailsBody && !this.els.customTokenDetailsBody.classList.contains('hidden');
      this.setCustomTokenDetailsOpen(!isOpen);
    });
    this.els.btnToggleCustomTokenItemsPicker?.addEventListener('click', () => {
      this.setCustomTokenItemsPickerOpen(!this.customTokenItemsPickerOpen);
    });
    this.els.btnCloseCustomTokenItemsPicker?.addEventListener('click', () => {
      this.setCustomTokenItemsPickerOpen(false);
    });
    this.els.inpCustomTokenItemSearch?.addEventListener('input', (e) => {
      this.customTokenItemsPickerQuery = e.target.value;
      this.renderCustomTokenItemsPickerList(Service.state);
    });
    this.els.customTokenItemsPickerList?.addEventListener('click', (e) => {
      const folderBtn = e.target.closest('[data-picker-toggle-folder]');
      if (folderBtn) {
        if (!this.expandedPickerFolders) this.expandedPickerFolders = new Set();
        const id = folderBtn.dataset.pickerToggleFolder;
        if (this.expandedPickerFolders.has(id)) this.expandedPickerFolders.delete(id);
        else this.expandedPickerFolders.add(id);
        this.renderCustomTokenItemsPickerList(Service.state);
        return;
      }
      const decBtn = e.target.closest('[data-picker-dec-item]');
      if (decBtn && Array.isArray(this.pendingCustomTokenItems)) {
        const key = decBtn.dataset.pickerDecItem;
        const idx = this.pendingCustomTokenItems.lastIndexOf(key);
        if (idx >= 0) {
          this.pendingCustomTokenItems.splice(idx, 1);
          this.renderCustomTokenStarterItems(Service.state);
        }
        return;
      }
      const addBtn = e.target.closest('[data-picker-add-item]');
      if (addBtn) {
        const key = addBtn.dataset.pickerAddItem;
        if (!key) return;
        if (!Array.isArray(this.pendingCustomTokenItems)) this.pendingCustomTokenItems = [];
        this.pendingCustomTokenItems.push(key);
        this.renderCustomTokenStarterItems(Service.state);
      }
    });
    this.els.customTokenStarterItems?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-starter-idx]');
      if (!btn || !Array.isArray(this.pendingCustomTokenItems)) return;
      const idx = Number(btn.dataset.removeStarterIdx);
      if (Number.isInteger(idx) && idx >= 0 && idx < this.pendingCustomTokenItems.length) {
        this.pendingCustomTokenItems.splice(idx, 1);
        this.renderCustomTokenStarterItems(Service.state);
      }
    });

    this.bindItemCreatorEvents();
    this.renderCreatorBlocks();
    this.renderCustomItemIconGrid();
    this.renderCustomColorGrids();

    if (this.els.btnToggleItemIconPicker && this.els.customItemIconGrid) {
      this.els.btnToggleItemIconPicker.addEventListener('click', () => {
        this.els.customItemIconGrid.classList.toggle('hidden');
        this.renderCustomItemIconGrid();
      });
    }

    this.els.customTokenForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.els.inpCustomTokenName.value.trim();
      if (!name) return;
      const isAlly = this.selectedTokenAlly !== 'enemy';
      const stats = {};
      this.els.customTokenStatsGrid?.querySelectorAll('[data-custom-stat-key]').forEach((inp) => {
        const k = inp.dataset.customStatKey;
        if (k) stats[k] = Number(inp.value) || 0;
      });
      const vUnit = Selector.getSystemVisionConfig(Service.state).distanceUnit;
      const rawVision = String(this.els.inpCustomTokenVision?.value ?? '').trim();
      const visionMeters = rawVision === '' ? null : displayValueToMeters(Number(rawVision), vUnit);
      const rawLight = String(this.els.inpCustomTokenLight?.value ?? '').trim();
      const lightMeters = rawLight === '' ? 0 : displayValueToMeters(Number(rawLight), vUnit);

      const saved = Service.saveCustomActor({
        key: this.editingCompendiumKey || undefined,
        name,
        role: this.els.inpCustomTokenRole.value.trim() || (isAlly ? 'Protagonista' : 'Secundario'),
        folder: this.els.inpCustomTokenFolder.value.trim(),
        isAlly,
        size: clampTokenSize(this.selectedTokenSize, 1),
        visionMeters,
        lightMeters,
        imageUrl: this.els.inpCustomTokenImg.value.trim(),
        publicDescription: this.els.inpCustomTokenPublicDesc ? this.els.inpCustomTokenPublicDesc.value.trim() : '',
        color: this.selectedTokenColor || '#8b5cf6',
        hp: Number(this.els.inpCustomTokenHp.value) || 16,
        ac: Number(this.els.inpCustomTokenAc.value) || 13,
        stats,
        starterItems: Array.isArray(this.pendingCustomTokenItems) ? [...this.pendingCustomTokenItems] : []
      });
      this.resetCustomTokenFormDraft(Service.state);
      closeAllCompendiumForms();
      this.showActionToast(`${saved.name} guardado en Personajes.`);
    });

    this.els.customItemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.els.inpCustomItemName.value.trim();
      if (!name) return;
      const kind = this.els.selCustomItemKind.value;
      const { passives, steps } = this.getCreatorPayload();
      const firstRoll = steps.find((s) => s.type === 'roll' && s.rollKind !== 'request');
      const saved = Service.saveCustomItem({
        key: this.editingCompendiumKey || undefined,
        name,
        kind,
        folder: this.els.inpCustomItemFolder.value.trim(),
        formula: firstRoll ? firstRoll.formula : '',
        message: this.els.inpCustomItemMsg ? this.els.inpCustomItemMsg.value.trim() : '',
        passives,
        steps,
        icon: this.selectedItemIcon,
        color: this.selectedItemColor || '#8b5cf6'
      });
      this.els.inpCustomItemName.value = '';
      this.els.inpCustomItemFolder.value = '';
      this.resetItemCreatorBlocks();
      closeAllCompendiumForms();
      this.showActionToast(`${saved.name} guardado en Complementos.`);
    });

    this.els.customMapForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.els.inpCustomMapName.value.trim();
      const imageUrl = this.els.inpCustomMapImg.value.trim();
      if (!name || !imageUrl) return;
      const saved = Service.saveCustomMap({
        key: this.editingCompendiumKey || undefined,
        name,
        imageUrl,
        desc: this.els.inpCustomMapDesc.value.trim() || 'Escenario personalizado',
        folder: this.els.inpCustomMapFolder.value.trim(),
        sceneMode: this.selectedCustomMapMode || 'tactical',
        weather: this.els.selCustomMapWeather?.value || 'none',
        grid: this.pendingCustomMapGrid,
        lighting: this.pendingCustomMapLighting
      });
      this.els.inpCustomMapName.value = '';
      this.els.inpCustomMapImg.value = '';
      this.els.inpCustomMapDesc.value = '';
      this.els.inpCustomMapFolder.value = '';
      closeAllCompendiumForms();
      this.showActionToast(`${saved.name} guardado en Escenarios.`);
    });
  },

  renderCompendium(state) {
    const tab = state.compendiumTab || 'actors';
    const q = (state.compendiumSearch || '').toLowerCase().trim();
    if (!this.collapsedFolders) this.collapsedFolders = new Set();

    if (this.els.selCustomItemKind) {
      const itemTabs = Selector.getSystemItemTabs(state);
      const prevVal = this.els.selCustomItemKind.value;
      this.els.selCustomItemKind.innerHTML = itemTabs
        .map((it) => `<option value="${this.escapeHtml(it.id)}">${this.escapeHtml(it.label)}</option>`)
        .join('');
      if (itemTabs.some((it) => it.id === prevVal)) {
        this.els.selCustomItemKind.value = prevVal;
      } else if (itemTabs[0]) {
        this.els.selCustomItemKind.value = itemTabs[0].id;
      }
    }

    this.els.compendiumTabs.querySelectorAll('[data-comp-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.compTab === tab);
    });

    const renderWithFolders = (entries, renderRowFn) => {
      const savedFolders = (state.compendiumFolders && state.compendiumFolders[tab]) || [];
      const folderSet = new Set(savedFolders);
      const getFolder = (entry) => resolveEntryFolder(entry, tab, state.compendiumFolderOverrides);
      entries.forEach((entry) => {
        const f = getFolder(entry);
        if (f) folderSet.add(f);
      });
      const folders = Array.from(folderSet);

      if (this.els.compendiumFolderList) {
        this.els.compendiumFolderList.innerHTML = folders.map((f) => `<option value="${f}"></option>`).join('');
      }

      const folderHtml = folders
        .map((folderName) => {
          const children = entries.filter((e) => getFolder(e) === folderName);
          if (q && children.length === 0 && !folderName.toLowerCase().includes(q)) return '';
          const folderKey = `${tab}:${folderName}`;
          const isOpen = Boolean(q) || !this.collapsedFolders.has(folderKey);
          return `
            <div class="flex flex-col portal-folder-group rounded-xl transition-colors" data-folder-drop="${this.escapeHtml(folderName)}">
              <div data-toggle-folder="${this.escapeHtml(folderName)}" class="group portal-list-row px-2 py-1.5 flex items-center justify-between gap-2 cursor-pointer select-none">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-90' : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4" /></svg>
                  <svg class="w-3.5 h-3.5 opacity-75 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.7l1.2 1.5h5.1A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5V4.5z" /></svg>
                  <span class="font-semibold text-xs truncate">${folderName}</span>
                  <span class="text-[10px] opacity-50 tabular-nums">${children.length}</span>
                </div>
                <button type="button" data-folder-menu="${folderName}" class="portal-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" title="Opciones de carpeta">
                  <span class="text-xs leading-none">⋯</span>
                </button>
              </div>
              ${
                isOpen
                  ? `<div class="pl-3 ml-2 border-l flex flex-col" style="border-color: var(--hairline);">
                      ${children.length ? children.map(renderRowFn).join('') : `<div class="text-[10px] opacity-45 px-2 py-1.5">Carpeta vacía</div>`}
                    </div>`
                  : ''
              }
            </div>
          `;
        })
        .join('');

      const rootHtml = entries
        .filter((e) => !getFolder(e))
        .map(renderRowFn)
        .join('');

      this.els.tokenTemplatesGrid.innerHTML =
        folderHtml + rootHtml || `<div class="text-[11px] opacity-55 text-center py-6">Sin resultados en el compendio.</div>`;

      const openFolderMenu = (folderName, cx, cy) => {
        this.openListContextMenu(cx, cy, folderName, 'Carpeta', [
          {
            icon: 'edit',
            label: 'Renombrar carpeta',
            onClick: () => {
              const nextName = typeof window !== 'undefined' && typeof window.prompt === 'function'
                ? window.prompt('Nuevo nombre para la carpeta:', folderName)
                : '';
              const cleanNext = String(nextName || '').trim();
              if (!cleanNext || cleanNext === folderName) return;
              const prevKey = `${tab}:${folderName}`;
              const nextKey = `${tab}:${cleanNext}`;
              if (this.collapsedFolders?.has(prevKey)) {
                this.collapsedFolders.delete(prevKey);
                this.collapsedFolders.add(nextKey);
              }
              Service.renameCompendiumFolder(tab, folderName, cleanNext);
              this.showActionToast(`Carpeta renombrada a "${cleanNext}".`);
            }
          },
          {
            icon: 'trash',
            label: 'Eliminar carpeta',
            danger: true,
            onClick: () => Service.deleteCompendiumFolder(tab, folderName)
          }
        ]);
      };

      this.els.tokenTemplatesGrid.querySelectorAll('[data-toggle-folder]').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-folder-menu]')) return;
          const fKey = `${tab}:${row.dataset.toggleFolder}`;
          if (this.collapsedFolders.has(fKey)) this.collapsedFolders.delete(fKey);
          else this.collapsedFolders.add(fKey);
          this.renderCompendium(Service.state);
        });
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openFolderMenu(row.dataset.toggleFolder, e.clientX, e.clientY);
        });
      });

      this.els.tokenTemplatesGrid.querySelectorAll('[data-folder-menu]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = btn.getBoundingClientRect();
          openFolderMenu(btn.dataset.folderMenu, r.right, r.bottom + 4);
        });
      });
    };

    const moreDotsBtn = (attr, val) => `
      <button type="button" ${attr}="${val}" class="portal-btn w-6 h-6 p-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0" title="Opciones">
        <span class="text-xs leading-none">⋯</span>
      </button>
    `;

    const editCustomActor = (key) => {
      const a = (Service.state.customActors || []).find((x) => x.key === key);
      if (!a) return;
      const visionCfg = Selector.getSystemVisionConfig(Service.state);
      const vUnit = visionCfg.distanceUnit;
      this.editingCompendiumKey = a.key;
      if (this.els.lblCustomFormTitle) this.els.lblCustomFormTitle.textContent = 'Editar personaje';
      this.els.inpCustomTokenName.value = a.name || '';
      this.els.inpCustomTokenRole.value = a.role || '';
      this.els.inpCustomTokenHp.value = String(a.maxHp || a.hp || 16);
      this.els.inpCustomTokenAc.value = String(a.ac || 13);
      this.selectedTokenAlly = a.isAlly === false ? 'enemy' : 'ally';
      this.selectedTokenSize = clampTokenSize(a.size, 1);
      this.expandedPickerFolders = new Set();
      this.setCustomTokenItemsPickerOpen(false);
      this.syncCustomTokenSizeSeg();
      this.syncCustomTokenAllyHint();
      this.renderCustomTokenStatsGrid(Service.state, a.stats || {});
      this.pendingCustomTokenItems = Array.isArray(a.starterItems)
        ? [...a.starterItems]
        : Array.isArray(a.inventory)
          ? a.inventory.map((it) => it?.key).filter((k) => k && k !== 'custom_item')
          : [];
      this.renderCustomTokenStarterItems(Service.state);
      this.els.inpCustomTokenImg.value = a.imageUrl || '';
      if (this.els.inpCustomTokenVision) {
        const hasVis = a.visionMeters !== null && a.visionMeters !== undefined && Number.isFinite(Number(a.visionMeters));
        this.els.inpCustomTokenVision.value = hasVis ? String(metersToDisplayValue(a.visionMeters, vUnit)) : '';
        this.els.inpCustomTokenVision.placeholder = String(metersToDisplayValue(visionCfg.defaultVisionMeters, vUnit));
        this.els.inpCustomTokenVision.step = vUnit === 'ft' ? '5' : '0.5';
      }
      if (this.els.lblCustomTokenVisionUnit) this.els.lblCustomTokenVisionUnit.textContent = vUnit;
      if (this.els.inpCustomTokenLight) {
        const hasLight = Number(a.lightMeters) > 0;
        this.els.inpCustomTokenLight.value = hasLight ? String(metersToDisplayValue(a.lightMeters, vUnit)) : '';
        this.els.inpCustomTokenLight.step = vUnit === 'ft' ? '5' : '0.5';
      }
      if (this.els.lblCustomTokenLightUnit) this.els.lblCustomTokenLightUnit.textContent = vUnit;
      if (this.els.inpCustomTokenPublicDesc) this.els.inpCustomTokenPublicDesc.value = a.publicDescription || '';
      this.els.inpCustomTokenFolder.value = a.folder || '';
      const hasDetails = Boolean(
        (a.visionMeters !== null && a.visionMeters !== undefined) ||
          Number(a.lightMeters) > 0 ||
          a.publicDescription ||
          a.folder
      );
      this.setCustomTokenDetailsOpen(hasDetails);
      this.selectedTokenColor = a.color || '#8b5cf6';
      this.renderCustomColorGrids();
      this.renderCustomTokenPreview();
      this.openCompendiumForm(this.els.customTokenForm, this.els.btnToggleCustomToken, this.els.inpCustomTokenName, true);
    };

    const editCustomItem = (key) => {
      const it = (Service.state.customItems || []).find((x) => x.key === key);
      if (!it) return;
      this.editingCompendiumKey = it.key;
      if (this.els.lblCustomItemFormTitle) this.els.lblCustomItemFormTitle.textContent = 'Editar complemento';
      this.els.inpCustomItemName.value = it.name || '';
      this.els.selCustomItemKind.value = this.getItemCategory(it.kind);
      this.loadItemIntoCreatorBlocks(it);
      this.els.inpCustomItemFolder.value = it.folder || '';
      this.selectedItemColor = it.color || '#8b5cf6';
      this.selectedItemIcon = it.icon && this.itemIconDefs[it.icon] ? it.icon : this.getDefaultItemIcon(it.kind);
      this.renderCustomColorGrids();
      this.renderCustomItemIconGrid();
      this.openCompendiumForm(this.els.customItemForm, this.els.btnToggleCustomToken, this.els.inpCustomItemName, true);
    };

    const editCustomMap = (key) => {
      const m = (Service.state.customMaps || []).find((x) => x.key === key);
      if (!m) return;
      this.editingCompendiumKey = m.key;
      if (this.els.lblCustomMapFormTitle) this.els.lblCustomMapFormTitle.textContent = 'Editar escenario';
      this.els.inpCustomMapName.value = m.name || '';
      this.els.inpCustomMapImg.value = m.imageUrl || '';
      this.els.inpCustomMapDesc.value = m.desc || '';
      this.els.inpCustomMapFolder.value = m.folder || '';
      this.pendingCustomMapGrid = normalizeGridConfig(m.grid || Service.state.mapGrids?.[m.key] || {});
      this.pendingCustomMapLighting = normalizeSceneLighting(m.lighting || Service.getSceneLighting(m.key));
      this.selectedCustomMapMode = m.sceneMode === 'narrative' ? 'narrative' : 'tactical';
      this.syncCustomMapModeSeg();
      if (this.els.selCustomMapWeather) this.els.selCustomMapWeather.value = m.weather || 'none';
      this.renderCustomMapGridSummary();
      this.openCompendiumForm(this.els.customMapForm, this.els.btnToggleCustomToken, this.els.inpCustomMapName, true);
    };

    const buildGmPinActions = (kind, key, label) => {
      if (Service.state.role !== 'gm') return [];
      const tabs = Selector.getGmStagingTabs(Service.state);
      if (tabs.length <= 1) {
        const target = tabs[0];
        return [
          {
            icon: 'pin',
            label: 'Agregar a la Pantalla',
            onClick: () => {
              const res = Service.pinToGmScreen({ kind, key, tabId: target?.id, title: label });
              if (res?.alreadyPinned) this.showActionToast(`"${label}" ya está en ${res.tab.label}.`);
              else if (res) this.showActionToast(`"${label}" agregado a ${res.tab.label}.`);
            }
          }
        ];
      }
      return tabs.slice(0, 4).map((t) => ({
        icon: 'pin',
        label: `Pantalla · ${t.label}`,
        onClick: () => {
          const res = Service.pinToGmScreen({ kind, key, tabId: t.id, title: label });
          if (res?.alreadyPinned) this.showActionToast(`"${label}" ya está en ${res.tab.label}.`);
          else if (res) this.showActionToast(`"${label}" agregado a ${res.tab.label}.`);
        }
      }));
    };

    if (tab === 'actors') {
      const preset = state.systemConfig?.preset || state.ruleset || 'dnd55';
      const baseActors =
        preset === 'vieja_escuela'
          ? COMPENDIUM_ACTORS.filter((a) => a.system === 'vieja_escuela')
          : COMPENDIUM_ACTORS.filter((a) => a.system !== 'vieja_escuela');
      const allActors = [...(state.customActors || []), ...baseActors];
      const list = allActors.filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
      renderWithFolders(
        list,
        (a) => {
          const size = clampTokenSize(a.size, 1);
          const maxHp = Math.max(1, Number(a.maxHp ?? a.hp) || 16);
          const curHp = Number.isFinite(Number(a.hp)) ? Number(a.hp) : maxHp;
          const hpLabel = a.isAlly !== false && curHp < maxHp ? `HP ${curHp}/${maxHp}` : `HP ${maxHp}`;
          const itemCount = Array.isArray(a.inventory)
            ? a.inventory.length
            : Array.isArray(a.starterItems)
              ? a.starterItems.length
              : 0;
          const categoryLabel = a.isAlly === false ? 'Secundario' : 'Protagonista';
          const roleLabel =
            a.role && String(a.role).trim().toLowerCase() !== categoryLabel.toLowerCase()
              ? String(a.role).trim()
              : '';
          const metaParts = [
            categoryLabel,
            size > 1 ? `${size}×${size}` : '',
            roleLabel,
            hpLabel,
            `CA ${a.ac || 12}`,
            itemCount > 0 ? `${itemCount} obj` : ''
          ].filter(Boolean);
          return `
          <div
            draggable="true"
            data-drag-spec="actor:${a.key}"
            data-actor-key="${a.key}"
            class="group portal-list-row px-2 py-1.5 flex items-center justify-between gap-2 cursor-grab"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-11 h-11 ${a.imageUrl ? '' : 'rounded-full overflow-hidden'} flex items-center justify-center font-bold text-xs text-white flex-shrink-0" style="background:${a.imageUrl ? 'transparent' : a.color};">
                ${a.imageUrl ? `<img src="${this.escapeHtml(a.imageUrl)}" alt="${this.escapeHtml(a.name)}" draggable="false" class="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]" />` : this.escapeHtml(a.name.slice(0, 2).toUpperCase())}
              </span>
              <div class="min-w-0">
                <div class="font-semibold text-xs truncate">${this.escapeHtml(a.name)}</div>
                <div class="text-[11px] opacity-65 truncate">${this.escapeHtml(metaParts.join(' · '))}</div>
              </div>
            </div>
            ${moreDotsBtn('data-actor-menu', a.key)}
          </div>
        `;
        }
      );

      const openActorMenu = (key, cx, cy) => {
        const a = allActors.find((x) => x.key === key);
        if (!a) return;
        const actions = [
          ...buildGmPinActions('actor', a.key, a.name),
          {
            icon: 'copy',
            label: 'Duplicar para editar',
            onClick: () => {
              const copy = Service.saveCustomActor({
                ...a,
                key: undefined,
                name: `${a.name} (Copia)`,
                isCustom: true
              });
              editCustomActor(copy.key);
              this.showActionToast(`Copia "${copy.name}" lista para editar.`);
            }
          }
        ];
        if (a.isCustom) {
          actions.push(
            { icon: 'edit', label: 'Editar personaje', onClick: () => editCustomActor(a.key) },
            {
              icon: 'trash',
              label: 'Eliminar personaje',
              danger: true,
              onClick: () => {
                Service.deleteCustomActor(a.key);
                this.showActionToast('Personaje eliminado.');
              }
            }
          );
        }
        this.openListContextMenu(cx, cy, a.name, a.role || 'Personaje', actions);
      };

      this.els.tokenTemplatesGrid.querySelectorAll('[data-actor-key]').forEach((row) => {
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openActorMenu(row.dataset.actorKey, e.clientX, e.clientY);
        });
      });
      this.els.tokenTemplatesGrid.querySelectorAll('[data-actor-menu]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = btn.getBoundingClientRect();
          openActorMenu(btn.dataset.actorMenu, r.right, r.bottom + 4);
        });
      });
    } else if (tab === 'items') {
      const preset = state.systemConfig?.preset || state.ruleset || 'dnd55';
      const baseItems =
        preset === 'vieja_escuela'
          ? COMPENDIUM_ITEMS.filter((i) => i.system === 'vieja_escuela')
          : state.ruleset === 'free'
            ? COMPENDIUM_ITEMS.filter((i) => i.system !== 'vieja_escuela' && !String(i.key || '').startsWith('55_'))
            : COMPENDIUM_ITEMS.filter((i) => i.system !== 'vieja_escuela');
      const allItems = [...(state.customItems || []), ...baseItems];
      const list = allItems.filter((i) => i.name.toLowerCase().includes(q) || i.badge.toLowerCase().includes(q));
      renderWithFolders(
        list,
        (it) => `
          <div
            draggable="true"
            data-drag-spec="item:${this.escapeHtml(it.key)}"
            data-item-key="${this.escapeHtml(it.key)}"
            class="group portal-list-row px-2 py-1.5 flex items-center justify-between gap-2 cursor-grab"
          >
            <div class="flex items-center gap-3 min-w-0">
              ${this.renderItemIconBadge(it, { size: 'lg' })}
              <div class="min-w-0">
                <div class="font-semibold text-xs truncate">${this.escapeHtml(it.name)}</div>
                <div class="text-[11px] opacity-65 truncate">${this.escapeHtml(it.badge || '')}</div>
              </div>
            </div>
            ${moreDotsBtn('data-item-menu', it.key)}
          </div>
        `
      );

      const openItemMenu = (key, cx, cy) => {
        const it = allItems.find((x) => x.key === key);
        if (!it) return;
        const actions = [...buildGmPinActions('item', it.key, it.name)];
        if (Service.state.selectedTokenId) {
          actions.push({
            icon: 'package',
            label: 'Equipar en ficha seleccionada',
            onClick: () => {
              this.activeSheetTab = this.getItemCategory(it.kind);
              const res = Service.equipItemToToken(Service.state.selectedTokenId, it);
              if (res) this.showActionToast(`${it.name} equipado en ${res.token.name}.`);
            }
          });
        }
        if (it.isCustom) {
          actions.push(
            { icon: 'edit', label: 'Editar complemento', onClick: () => editCustomItem(it.key) },
            {
              icon: 'trash',
              label: 'Eliminar complemento',
              danger: true,
              onClick: () => {
                Service.deleteCustomItem(it.key);
                this.showActionToast('Complemento eliminado.');
              }
            }
          );
        }
        if (!actions.length) {
          actions.push({
            icon: 'info',
            label: 'Seleccioná un token para equipar',
            onClick: () => {}
          });
        }
        this.openListContextMenu(cx, cy, it.name, it.badge || 'Complemento', actions);
      };

      this.els.tokenTemplatesGrid.querySelectorAll('[data-item-key]').forEach((row) => {
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openItemMenu(row.dataset.itemKey, e.clientX, e.clientY);
        });
      });
      this.els.tokenTemplatesGrid.querySelectorAll('[data-item-menu]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = btn.getBoundingClientRect();
          openItemMenu(btn.dataset.itemMenu, r.right, r.bottom + 4);
        });
      });
    } else {
      const allMaps = [...(state.customMaps || []), ...COMPENDIUM_MAPS];
      const list = allMaps.filter((m) => m.name.toLowerCase().includes(q) || (m.desc || '').toLowerCase().includes(q));
      const activeSceneKey = Service.getActiveSceneKey();
      const esc = (s) => this.escapeHtml(s);
      renderWithFolders(
        list,
        (m) => {
          const card = resolveMapCardDescriptor(m, activeSceneKey);
          const thumbSrc =
            card.kind === 'image'
              ? card.src
              : card.kind === 'preset'
                ? this.getPresetMapThumbnail(card.presetId)
                : '';
          const previewHtml = thumbSrc
            ? `<img src="${esc(thumbSrc)}" alt="${esc(card.name)}" loading="lazy" draggable="false" class="w-full h-full object-cover pointer-events-none select-none" />`
            : `<div class="w-full h-full flex items-center justify-center opacity-35"><svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg></div>`;
          const activePill = card.isActive
            ? `<span class="portal-map-active-pill"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Activo</span>`
            : '';
          const modePill = card.sceneMode === 'narrative'
            ? `<span class="portal-map-mode-pill">Narrativo</span>`
            : '';
          const badgesHtml = (activePill || modePill)
            ? `<div class="portal-map-badges">${activePill}${modePill}</div>`
            : '';
          return `
          <div
            draggable="true"
            data-drag-spec="map:${esc(m.key)}"
            data-map-key="${esc(m.key)}"
            class="group portal-map-card cursor-grab${card.isActive ? ' is-active' : ''}"
          >
            <div class="portal-map-card-preview">
              ${previewHtml}
              <div class="portal-map-card-scrim"></div>
              ${badgesHtml}
              <button type="button" data-map-menu="${esc(m.key)}" class="portal-map-card-menu" title="Opciones">
                <span class="text-xs leading-none">⋯</span>
              </button>
            </div>
            <div class="px-2.5 py-2 min-w-0">
              <div class="font-semibold text-xs truncate">${esc(card.name)}</div>
              <div class="text-[11px] opacity-65 truncate">${esc(card.desc || 'Escenario personalizado')}</div>
            </div>
          </div>
        `;
        }
      );

      const openMapMenu = (key, cx, cy) => {
        const m = allMaps.find((x) => x.key === key);
        if (!m) return;
        const isNarrative = m.sceneMode === 'narrative';
        const actions = [
          ...buildGmPinActions('map', m.key, m.name),
          {
            icon: 'map',
            label: 'Activar escenario',
            onClick: async () => {
              await Service.activateMapTemplate(m);
              this.showActionToast(`Escenario "${m.name}" activado.`);
            }
          }
        ];
        if (!isNarrative) {
          actions.push(
            {
              icon: 'sliders',
              label: 'Opciones del escenario',
              onClick: () => {
                const isActive = Service.getActiveSceneKey() === m.key;
                if (isActive) Service.flushExploredMask();
                const curGrid = Service.state.mapGrids?.[m.key] || m.grid || (isActive ? Service.state.grid : {});
                const curLighting = Service.getSceneLighting(m.key);
                const walls = isActive
                  ? Service.state.walls
                  : (Service.state.sceneLayers?.[m.key]?.walls || (m.isCustom ? [] : buildPresetWallsForMap(m.key)));
                this.openMapGridEditor?.({
                  title: m.name,
                  mapId: m.isCustom ? 'custom' : m.key,
                  sceneKey: m.key,
                  isActiveScene: isActive,
                  imageUrl: m.isCustom ? (m.imageUrl || '') : '',
                  initialGrid: curGrid,
                  initialLighting: curLighting,
                  walls,
                  onApply: ({ grid, lighting }) => {
                    Service.updateMapGridForScene(m.key, grid);
                    Service.updateSceneLighting(m.key, {
                      dynamicLighting: lighting.dynamicLighting,
                      rememberExplored: lighting.rememberExplored
                    });
                    this.showActionToast(`Escenario "${m.name}" actualizado.`);
                  }
                });
              }
            },
            {
              icon: 'rotate-ccw',
              label: 'Resetear área descubierta',
              onClick: () => {
                Service.resetSceneExploredFog(m.key);
                this.showActionToast(`Área descubierta de "${m.name}" reseteada.`);
              }
            }
          );
        }
        if (m.isCustom) {
          actions.push(
            { icon: 'edit', label: 'Editar escenario', onClick: () => editCustomMap(m.key) },
            {
              icon: 'trash',
              label: 'Eliminar escenario',
              danger: true,
              onClick: () => {
                Service.deleteCustomMap(m.key);
                this.showActionToast('Escenario eliminado.');
              }
            }
          );
        }
        this.openListContextMenu(cx, cy, m.name, 'Escenario', actions);
      };

      this.els.tokenTemplatesGrid.querySelectorAll('[data-map-key]').forEach((row) => {
        row.addEventListener('dblclick', async (e) => {
          if (e.target.closest('[data-map-menu]')) return;
          const m = allMaps.find((x) => x.key === row.dataset.mapKey);
          if (!m) return;
          await Service.activateMapTemplate(m);
          this.showActionToast(`Escenario "${m.name}" activado.`);
        });
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openMapMenu(row.dataset.mapKey, e.clientX, e.clientY);
        });
      });
      this.els.tokenTemplatesGrid.querySelectorAll('[data-map-menu]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = btn.getBoundingClientRect();
          openMapMenu(btn.dataset.mapMenu, r.right, r.bottom + 4);
        });
      });
    }

    this.els.tokenTemplatesGrid.querySelectorAll('[data-drag-spec]').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', card.dataset.dragSpec);
          e.dataTransfer.setData('application/x-portal-drag', card.dataset.dragSpec);
        }
      });
    });
  }
};
