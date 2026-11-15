import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS, COMPENDIUM_MAPS } from '../data/compendium.js';
import { Service } from '../core/service.js?v=20261115n';

const CURATED_COLORS = [
  ['#ef4444', 'Rojo'],
  ['#f97316', 'Naranja'],
  ['#d97706', 'Ámbar'],
  ['#65a30d', 'Lima'],
  ['#10b981', 'Esmeralda'],
  ['#0891b2', 'Cian'],
  ['#3b82f6', 'Azul'],
  ['#6366f1', 'Índigo'],
  ['#8b5cf6', 'Violeta'],
  ['#c026d3', 'Fucsia'],
  ['#db2777', 'Rosa'],
  ['#64748b', 'Acero']
];

/**
 * Compendium drawer tabs, folders, custom forms, formula builder & tree rendering methods mixed into View.
 */
export const CompendiumViewMethods = {
  renderCustomItemIconGrid() {
    const grid = this.els.customItemIconGrid;
    if (!grid) return;
    const activeColor = this.selectedItemColor || '#8b5cf6';
    grid.innerHTML = Object.entries(this.itemIconDefs)
      .map(([key, [title]]) => {
        const active = this.selectedItemIcon === key;
        return `<button type="button" data-item-icon="${key}" title="${title}" class="owl-seg-btn owl-subpanel h-7 p-0 flex items-center justify-center rounded-lg ${active ? 'is-active' : ''}" style="${active ? `color:${activeColor};` : ''}">${this.renderItemIconSvg(key)}</button>`;
      })
      .join('');
    grid.querySelectorAll('[data-item-icon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedItemIcon = btn.dataset.itemIcon;
        this.renderCustomItemIconGrid();
      });
    });
  },

  renderColorSwatchGrid(grid, selectedColor, onSelect) {
    if (!grid) return;
    const activeHex = (selectedColor || '#8b5cf6').toLowerCase();
    grid.innerHTML = CURATED_COLORS.map(([hex, label]) => {
      const active = activeHex === hex.toLowerCase();
      return `<button type="button" data-swatch-color="${hex}" title="${label}" aria-label="${label}" class="w-5 h-5 rounded-full transition-transform ${active ? 'scale-110 ring-2 ring-white/90' : 'opacity-80 hover:opacity-100 hover:scale-105'}" style="background:${hex};"></button>`;
    }).join('');
    grid.querySelectorAll('[data-swatch-color]').forEach((btn) => {
      btn.addEventListener('click', () => onSelect(btn.dataset.swatchColor));
    });
  },

  renderCustomColorGrids() {
    this.renderColorSwatchGrid(this.els.customTokenColorGrid, this.selectedTokenColor, (hex) => {
      this.selectedTokenColor = hex;
      this.renderCustomColorGrids();
    });
    this.renderColorSwatchGrid(this.els.customItemColorGrid, this.selectedItemColor, (hex) => {
      this.selectedItemColor = hex;
      this.renderCustomColorGrids();
      this.renderCustomItemIconGrid();
    });
  },

  serializeFormulaTokens() {
    if (!Array.isArray(this.formulaTokens) || this.formulaTokens.length === 0) return '';
    return this.formulaTokens
      .map((t, idx) => {
        if (t.type === 'die') return `${idx > 0 ? '+ ' : ''}${t.count}d${t.sides}`;
        if (t.type === 'stat') return `${idx > 0 ? '+ ' : ''}@${t.key}`;
        const v = Number(t.value) || 0;
        if (v < 0) return `- ${Math.abs(v)}`;
        return `${idx > 0 ? '+ ' : ''}${v}`;
      })
      .join(' ')
      .trim();
  },

  loadFormulaToTokens(str) {
    this.formulaTokens = [];
    const raw = String(str || '').trim();
    if (!raw) {
      this.renderFormulaChips();
      return;
    }
    const parts = raw.replace(/\s+/g, '').match(/[+-]?(?:\d*d\d+|@[a-z]+|\d+)/gi) || [];
    for (const part of parts) {
      const dieMatch = part.match(/^\+?(\d*)d(\d+)$/i);
      if (dieMatch) {
        this.formulaTokens.push({ type: 'die', count: Number(dieMatch[1]) || 1, sides: Number(dieMatch[2]) });
        continue;
      }
      const statMatch = part.match(/^\+?@([a-z]+)$/i);
      if (statMatch) {
        const key = statMatch[1].toLowerCase();
        this.formulaTokens.push({ type: 'stat', key, label: key.toUpperCase() });
        continue;
      }
      const num = Number(part);
      if (Number.isFinite(num) && num !== 0) {
        this.formulaTokens.push({ type: 'flat', value: num });
      }
    }
    this.renderFormulaChips();
  },

  renderFormulaChips() {
    const box = this.els.formulaChipsPreview;
    if (!box) return;
    if (!this.formulaTokens.length) {
      box.innerHTML = `<span class="text-[10px] opacity-50">Toca dados o atributos abajo...</span>`;
      return;
    }
    box.innerHTML = this.formulaTokens
      .map((t, idx) => {
        const text =
          t.type === 'die'
            ? `${t.count}d${t.sides}`
            : t.type === 'stat'
              ? t.label
              : t.value >= 0
                ? `+${t.value}`
                : `${t.value}`;
        const plusPrefix = idx > 0 && !(t.type === 'flat') ? '<span class="opacity-45 text-[10px]">+</span>' : '';
        return `${plusPrefix}<button type="button" data-fb-rm="${idx}" class="owl-seg-btn is-active px-1.5 py-0.5 rounded-full text-[10px] font-mono-tech flex items-center gap-1" title="Quitar">${text}<span class="opacity-60">×</span></button>`;
      })
      .join('');
    box.querySelectorAll('[data-fb-rm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.fbRm);
        const target = this.formulaTokens[idx];
        if (!target) return;
        if (target.type === 'die' && target.count > 1) target.count -= 1;
        else this.formulaTokens.splice(idx, 1);
        this.renderFormulaChips();
      });
    });
  },

  bindCompendiumEvents() {
    // 5. Compendio Derecho Tabs, Carpetas & Formularios
    this.closeAllCompendiumForms = () => {
      this.editingCompendiumKey = null;
      [this.els.compendiumFolderForm, this.els.customTokenForm, this.els.customItemForm, this.els.customMapForm].forEach((f) => {
        if (!f) return;
        f.classList.add('hidden');
        f.classList.remove('flex');
      });
      if (this.els.btnToggleCustomToken) this.els.btnToggleCustomToken.classList.remove('owl-btn-accent');
      if (this.els.btnNewCompendiumFolder) this.els.btnNewCompendiumFolder.classList.remove('owl-btn-accent');
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
        if (triggerBtn) triggerBtn.classList.add('owl-btn-accent');
        if (focusEl) focusEl.focus();
      }
    };
    const openCompendiumForm = this.openCompendiumForm;

    if (this.els.fileCustomTokenImg) {
      this.els.fileCustomTokenImg.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.els.inpCustomTokenImg.value = await Service.compressImageFile(file, 256, 0.84);
          this.showActionToast('Retrato cargado.');
        } catch (err) {
          this.showActionToast(err.message);
        }
        e.target.value = '';
      });
    }
    if (this.els.fileCustomMapImg) {
      this.els.fileCustomMapImg.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.els.inpCustomMapImg.value = await Service.compressImageFile(file, 1600, 0.82);
          this.showActionToast('Mapa comprimido y listo.');
        } catch (err) {
          this.showActionToast(err.message);
        }
        e.target.value = '';
      });
    }

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

    if (this.els.btnToggleCustomToken) {
      this.els.btnToggleCustomToken.addEventListener('click', () => {
        const tab = Service.state.compendiumTab || 'actors';
        if (tab === 'items') openCompendiumForm(this.els.customItemForm, this.els.btnToggleCustomToken, this.els.inpCustomItemName);
        else if (tab === 'maps') openCompendiumForm(this.els.customMapForm, this.els.btnToggleCustomToken, this.els.inpCustomMapName);
        else openCompendiumForm(this.els.customTokenForm, this.els.btnToggleCustomToken, this.els.inpCustomTokenName);
      });
    }
    if (this.els.btnCancelCustomToken) this.els.btnCancelCustomToken.addEventListener('click', closeAllCompendiumForms);
    if (this.els.btnCancelCustomItem) this.els.btnCancelCustomItem.addEventListener('click', closeAllCompendiumForms);
    if (this.els.btnCancelCustomMap) this.els.btnCancelCustomMap.addEventListener('click', closeAllCompendiumForms);

    if (this.els.customItemFormulaBuilder) {
      this.els.customItemFormulaBuilder.querySelectorAll('[data-fb-die]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sides = Number(btn.dataset.fbDie);
          const existing = this.formulaTokens.find((t) => t.type === 'die' && t.sides === sides);
          if (existing) existing.count = Math.min(20, existing.count + 1);
          else this.formulaTokens.push({ type: 'die', sides, count: 1 });
          this.renderFormulaChips();
        });
      });
      this.els.customItemFormulaBuilder.querySelectorAll('[data-fb-stat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.fbStat;
          const label = btn.dataset.fbLabel || key.toUpperCase();
          if (!this.formulaTokens.some((t) => t.type === 'stat' && t.key === key)) {
            this.formulaTokens.push({ type: 'stat', key, label });
            this.renderFormulaChips();
          }
        });
      });
      this.els.customItemFormulaBuilder.querySelectorAll('[data-fb-flat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const delta = Number(btn.dataset.fbFlat) || 0;
          let flat = this.formulaTokens.find((t) => t.type === 'flat');
          if (!flat) {
            flat = { type: 'flat', value: 0 };
            this.formulaTokens.push(flat);
          }
          flat.value += delta;
          if (flat.value === 0) {
            this.formulaTokens = this.formulaTokens.filter((t) => t.type !== 'flat');
          }
          this.renderFormulaChips();
        });
      });
      if (this.els.btnClearFormulaChips) {
        this.els.btnClearFormulaChips.addEventListener('click', () => {
          this.formulaTokens = [];
          this.renderFormulaChips();
        });
      }
      this.renderFormulaChips();
    }

    this.renderCustomItemIconGrid();
    this.renderCustomColorGrids();

    this.els.selCustomItemKind.addEventListener('change', (e) => {
      const kind = e.target.value;
      if (this.els.customItemValWrap) {
        this.els.customItemValWrap.classList.toggle('hidden', kind === 'ability');
      }
      if (this.els.selCustomItemTarget) {
        this.els.selCustomItemTarget.classList.toggle('hidden', kind !== 'equipment');
      }
      this.els.lblCustomItemVal.textContent =
        kind === 'consumable' ? 'Cura HP (opcional)' : 'Bono pasivo';
      if (kind === 'consumable' && Number(this.els.inpCustomItemVal.value) === 0) {
        this.els.inpCustomItemVal.value = '8';
      }
    });

    this.els.customTokenForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.els.inpCustomTokenName.value.trim();
      if (!name) return;
      const isAlly = this.els.selCustomTokenAlly.value !== 'enemy';
      const saved = Service.saveCustomActor({
        key: this.editingCompendiumKey || undefined,
        name,
        role: this.els.inpCustomTokenRole.value.trim() || (isAlly ? 'Aliado' : 'Enemigo'),
        folder: this.els.inpCustomTokenFolder.value.trim(),
        isAlly,
        imageUrl: this.els.inpCustomTokenImg.value.trim(),
        color: this.selectedTokenColor || '#8b5cf6',
        hp: Number(this.els.inpCustomTokenHp.value) || 16,
        ac: Number(this.els.inpCustomTokenAc.value) || 13,
        stats: {
          str: Number(this.els.inpCustomStr.value) || 0,
          dex: Number(this.els.inpCustomDex.value) || 0,
          con: Number(this.els.inpCustomCon.value) || 0,
          int: Number(this.els.inpCustomInt.value) || 0,
          wis: Number(this.els.inpCustomWis?.value) || 0,
          cha: Number(this.els.inpCustomCha?.value) || 0
        }
      });
      this.els.inpCustomTokenName.value = '';
      this.els.inpCustomTokenRole.value = '';
      this.els.inpCustomTokenImg.value = '';
      this.els.inpCustomTokenFolder.value = '';
      closeAllCompendiumForms();
      this.showActionToast(`${saved.name} guardado en Personajes.`);
    });

    this.els.customItemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.els.inpCustomItemName.value.trim();
      if (!name) return;
      const kind = this.els.selCustomItemKind.value;
      const val = Number(this.els.inpCustomItemVal.value) || 0;
      const saved = Service.saveCustomItem({
        key: this.editingCompendiumKey || undefined,
        name,
        kind,
        folder: this.els.inpCustomItemFolder.value.trim(),
        formula: this.serializeFormulaTokens(),
        message: this.els.inpCustomItemMsg ? this.els.inpCustomItemMsg.value.trim() : '',
        bonusMod: 0,
        die: 0,
        statTarget: this.els.selCustomItemTarget ? this.els.selCustomItemTarget.value : 'ac',
        statBonus: kind === 'equipment' ? val : 0,
        acBonus: (kind === 'equipment' || kind === 'armor') && (!this.els.selCustomItemTarget || this.els.selCustomItemTarget.value === 'ac') ? val : 0,
        heal: kind === 'consumable' ? val : 0,
        lightRadius: 0,
        icon: this.selectedItemIcon,
        color: this.selectedItemColor || '#8b5cf6'
      });
      this.els.inpCustomItemName.value = '';
      this.els.inpCustomItemFolder.value = '';
      this.formulaTokens = [];
      this.renderFormulaChips();
      if (this.els.inpCustomItemMsg) this.els.inpCustomItemMsg.value = '';
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
        folder: this.els.inpCustomMapFolder.value.trim()
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

    this.els.compendiumTabs.querySelectorAll('[data-comp-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.compTab === tab);
    });

    const renderWithFolders = (entries, renderRowFn) => {
      const savedFolders = (state.compendiumFolders && state.compendiumFolders[tab]) || [];
      const folderSet = new Set(savedFolders);
      entries.forEach((entry) => {
        if (entry.folder) folderSet.add(entry.folder);
      });
      const folders = Array.from(folderSet);

      if (this.els.compendiumFolderList) {
        this.els.compendiumFolderList.innerHTML = folders.map((f) => `<option value="${f}"></option>`).join('');
      }

      const folderHtml = folders
        .map((folderName) => {
          const children = entries.filter((e) => (e.folder || '') === folderName);
          if (q && children.length === 0 && !folderName.toLowerCase().includes(q)) return '';
          const folderKey = `${tab}:${folderName}`;
          const isOpen = Boolean(q) || !this.collapsedFolders.has(folderKey);
          return `
            <div class="flex flex-col">
              <div data-toggle-folder="${folderName}" class="owl-list-row px-2 py-1.5 flex items-center justify-between gap-2 cursor-pointer select-none">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-90' : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4" /></svg>
                  <svg class="w-3.5 h-3.5 opacity-75 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.7l1.2 1.5h5.1A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5V4.5z" /></svg>
                  <span class="font-semibold text-xs truncate">${folderName}</span>
                  <span class="text-[10px] opacity-50 tabular-nums">${children.length}</span>
                </div>
                <button type="button" data-del-folder="${folderName}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-45 hover:opacity-100" title="Eliminar carpeta">
                  <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
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
        .filter((e) => !e.folder)
        .map(renderRowFn)
        .join('');

      this.els.tokenTemplatesGrid.innerHTML =
        folderHtml + rootHtml || `<div class="text-[11px] opacity-55 text-center py-6">Sin resultados en el compendio.</div>`;

      this.els.tokenTemplatesGrid.querySelectorAll('[data-toggle-folder]').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-del-folder]')) return;
          const fKey = `${tab}:${row.dataset.toggleFolder}`;
          if (this.collapsedFolders.has(fKey)) this.collapsedFolders.delete(fKey);
          else this.collapsedFolders.add(fKey);
          this.renderCompendium(Service.state);
        });
      });

      this.els.tokenTemplatesGrid.querySelectorAll('[data-del-folder]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          Service.deleteCompendiumFolder(tab, btn.dataset.delFolder);
        });
      });
    };

    if (tab === 'actors') {
      const allActors = [...(state.customActors || []), ...COMPENDIUM_ACTORS];
      const list = allActors.filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
      renderWithFolders(
        list,
        (a) => `
          <div
            draggable="true"
            data-drag-spec="actor:${a.key}"
            class="owl-list-row px-2 py-2 flex items-center justify-between gap-2 cursor-grab"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] text-white flex-shrink-0 overflow-hidden" style="background:${a.color};">
                ${a.imageUrl ? `<img src="${a.imageUrl}" alt="${a.name}" class="w-full h-full object-cover" />` : a.name.slice(0, 2).toUpperCase()}
              </span>
              <div class="min-w-0">
                <div class="font-semibold text-xs truncate">${a.name}</div>
                <div class="text-[11px] opacity-65 truncate">${a.role} · HP ${a.hp} · CA ${a.ac || 12}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              ${
                a.isCustom
                  ? `<button type="button" data-edit-custom-actor="${a.key}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-55 hover:opacity-100" title="Editar">
                      <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" /></svg>
                    </button>
                    <button type="button" data-del-custom-actor="${a.key}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-55 hover:opacity-100" title="Eliminar">
                      <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </button>`
                  : ''
              }
            </div>
          </div>
        `
      );

      this.els.tokenTemplatesGrid.querySelectorAll('[data-edit-custom-actor]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const a = (Service.state.customActors || []).find((x) => x.key === btn.dataset.editCustomActor);
          if (!a) return;
          this.editingCompendiumKey = a.key;
          this.els.inpCustomTokenName.value = a.name || '';
          this.els.inpCustomTokenRole.value = a.role || '';
          this.els.inpCustomTokenHp.value = String(a.hp || 16);
          this.els.inpCustomTokenAc.value = String(a.ac || 13);
          this.els.selCustomTokenAlly.value = a.isAlly === false ? 'enemy' : 'ally';
          this.els.inpCustomStr.value = String(a.stats?.str || 0);
          this.els.inpCustomDex.value = String(a.stats?.dex || 0);
          this.els.inpCustomCon.value = String(a.stats?.con || 0);
          this.els.inpCustomInt.value = String(a.stats?.int || 0);
          if (this.els.inpCustomWis) this.els.inpCustomWis.value = String(a.stats?.wis || 0);
          if (this.els.inpCustomCha) this.els.inpCustomCha.value = String(a.stats?.cha || 0);
          this.els.inpCustomTokenImg.value = a.imageUrl || '';
          this.els.inpCustomTokenFolder.value = a.folder || '';
          this.selectedTokenColor = a.color || '#8b5cf6';
          this.renderCustomColorGrids();
          this.openCompendiumForm(this.els.customTokenForm, this.els.btnToggleCustomToken, this.els.inpCustomTokenName, true);
        });
      });

      this.els.tokenTemplatesGrid.querySelectorAll('[data-del-custom-actor]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          Service.deleteCustomActor(btn.dataset.delCustomActor);
          this.showActionToast('Personaje eliminado.');
        });
      });
    } else if (tab === 'items') {
      const allItems = [...(state.customItems || []), ...COMPENDIUM_ITEMS];
      const list = allItems.filter((i) => i.name.toLowerCase().includes(q) || i.badge.toLowerCase().includes(q));
      renderWithFolders(
        list,
        (it) => `
          <div
            draggable="true"
            data-drag-spec="item:${it.key}"
            class="owl-list-row px-2 py-2 flex items-center justify-between gap-2 cursor-grab"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              ${this.renderItemIconBadge(it)}
              <div class="min-w-0">
                <div class="font-semibold text-xs truncate">${it.name}</div>
                <div class="text-[11px] opacity-65 truncate">${it.badge}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              ${
                it.isCustom
                  ? `<button type="button" data-edit-custom-item="${it.key}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-55 hover:opacity-100" title="Editar">
                      <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" /></svg>
                    </button>
                    <button type="button" data-del-custom-item="${it.key}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-55 hover:opacity-100" title="Eliminar">
                      <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </button>`
                  : ''
              }
            </div>
          </div>
        `
      );

      this.els.tokenTemplatesGrid.querySelectorAll('[data-edit-custom-item]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const it = (Service.state.customItems || []).find((x) => x.key === btn.dataset.editCustomItem);
          if (!it) return;
          this.editingCompendiumKey = it.key;
          this.els.inpCustomItemName.value = it.name || '';
          this.els.selCustomItemKind.value = this.getItemCategory(it.kind);
          this.els.selCustomItemKind.dispatchEvent(new Event('change'));
          if (this.els.selCustomItemTarget) {
            this.els.selCustomItemTarget.value = it.statTarget || 'ac';
          }
          this.els.inpCustomItemVal.value = String(
            it.kind === 'consumable' ? it.heal || 0 : it.statBonus !== undefined ? it.statBonus : it.acBonus || 0
          );
          this.loadFormulaToTokens(it.formula || (it.die > 0 ? `1d${it.die}${it.bonusMod ? (it.bonusMod > 0 ? `+${it.bonusMod}` : it.bonusMod) : ''}` : ''));
          if (this.els.inpCustomItemMsg) this.els.inpCustomItemMsg.value = it.message || '';
          this.els.inpCustomItemFolder.value = it.folder || '';
          this.selectedItemColor = it.color || '#8b5cf6';
          this.selectedItemIcon = it.icon && this.itemIconDefs[it.icon] ? it.icon : this.getDefaultItemIcon(it.kind);
          this.renderCustomColorGrids();
          this.renderCustomItemIconGrid();
          this.openCompendiumForm(this.els.customItemForm, this.els.btnToggleCustomToken, this.els.inpCustomItemName, true);
        });
      });

      this.els.tokenTemplatesGrid.querySelectorAll('[data-del-custom-item]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          Service.deleteCustomItem(btn.dataset.delCustomItem);
          this.showActionToast('Complemento eliminado.');
        });
      });
    } else {
      const allMaps = [...(state.customMaps || []), ...COMPENDIUM_MAPS];
      const list = allMaps.filter((m) => m.name.toLowerCase().includes(q) || (m.desc || '').toLowerCase().includes(q));
      renderWithFolders(
        list,
        (m) => `
          <div
            draggable="true"
            data-drag-spec="map:${m.key}"
            class="owl-list-row px-2 py-2 flex items-center justify-between gap-2 cursor-grab"
          >
            <div class="min-w-0">
              <div class="font-semibold text-xs truncate">${m.name}</div>
              <div class="text-[11px] opacity-65 truncate">${m.desc}</div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              ${
                m.isCustom
                  ? `<button type="button" data-edit-custom-map="${m.key}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-55 hover:opacity-100" title="Editar">
                      <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" /></svg>
                    </button>
                    <button type="button" data-del-custom-map="${m.key}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-55 hover:opacity-100" title="Eliminar">
                      <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </button>`
                  : ''
              }
            </div>
          </div>
        `
      );

      this.els.tokenTemplatesGrid.querySelectorAll('[data-edit-custom-map]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const m = (Service.state.customMaps || []).find((x) => x.key === btn.dataset.editCustomMap);
          if (!m) return;
          this.editingCompendiumKey = m.key;
          this.els.inpCustomMapName.value = m.name || '';
          this.els.inpCustomMapImg.value = m.imageUrl || '';
          this.els.inpCustomMapDesc.value = m.desc || '';
          this.els.inpCustomMapFolder.value = m.folder || '';
          this.openCompendiumForm(this.els.customMapForm, this.els.btnToggleCustomToken, this.els.inpCustomMapName, true);
        });
      });

      this.els.tokenTemplatesGrid.querySelectorAll('[data-del-custom-map]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          Service.deleteCustomMap(btn.dataset.delCustomMap);
          this.showActionToast('Escenario eliminado.');
        });
      });
    }

    this.els.tokenTemplatesGrid.querySelectorAll('[data-drag-spec]').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', card.dataset.dragSpec);
        }
      });
    });
  }
};
