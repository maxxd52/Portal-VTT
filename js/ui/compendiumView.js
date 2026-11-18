import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS, COMPENDIUM_MAPS } from '../data/compendium.js?v=20261117b1';
import { Selector } from '../core/selector.js?v=20261117b1';
import { Service } from '../core/service.js?v=20261117b1';

export const CompendiumViewMethods = {
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
      if (this.els.lblCustomItemFormTitle) this.els.lblCustomItemFormTitle.textContent = 'Nuevo complemento';
      if (this.els.lblCustomFormTitle) this.els.lblCustomFormTitle.textContent = 'Nuevo personaje';
      if (this.els.lblCustomMapFormTitle) this.els.lblCustomMapFormTitle.textContent = 'Nuevo escenario';
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
        if (tab === 'items') {
          this.resetItemCreatorBlocks();
          openCompendiumForm(this.els.customItemForm, this.els.btnToggleCustomToken, this.els.inpCustomItemName);
        }
        else if (tab === 'maps') openCompendiumForm(this.els.customMapForm, this.els.btnToggleCustomToken, this.els.inpCustomMapName);
        else openCompendiumForm(this.els.customTokenForm, this.els.btnToggleCustomToken, this.els.inpCustomTokenName);
      });
    }
    if (this.els.btnCancelCustomToken) this.els.btnCancelCustomToken.addEventListener('click', closeAllCompendiumForms);
    if (this.els.btnCancelCustomItem) this.els.btnCancelCustomItem.addEventListener('click', closeAllCompendiumForms);
    if (this.els.btnCancelCustomMap) this.els.btnCancelCustomMap.addEventListener('click', closeAllCompendiumForms);

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
      const isAlly = this.els.selCustomTokenAlly.value !== 'enemy';
      const saved = Service.saveCustomActor({
        key: this.editingCompendiumKey || undefined,
        name,
        role: this.els.inpCustomTokenRole.value.trim() || (isAlly ? 'Protagonista' : 'Secundario'),
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
      const { passives, steps } = this.getCreatorPayload();
      const firstRoll = steps.find((s) => s.type === 'roll');
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
              <div data-toggle-folder="${folderName}" class="group portal-list-row px-2 py-1.5 flex items-center justify-between gap-2 cursor-pointer select-none">
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
        .filter((e) => !e.folder)
        .map(renderRowFn)
        .join('');

      this.els.tokenTemplatesGrid.innerHTML =
        folderHtml + rootHtml || `<div class="text-[11px] opacity-55 text-center py-6">Sin resultados en el compendio.</div>`;

      const openFolderMenu = (folderName, cx, cy) => {
        this.openListContextMenu(cx, cy, folderName, 'Carpeta', [
          {
            icon: '🗑️',
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
      this.els.inpCustomMapName.value = m.name || '';
      this.els.inpCustomMapImg.value = m.imageUrl || '';
      this.els.inpCustomMapDesc.value = m.desc || '';
      this.els.inpCustomMapFolder.value = m.folder || '';
      this.openCompendiumForm(this.els.customMapForm, this.els.btnToggleCustomToken, this.els.inpCustomMapName, true);
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
            data-actor-key="${a.key}"
            class="group portal-list-row px-2 py-2 flex items-center justify-between gap-2 cursor-grab"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] text-white flex-shrink-0 overflow-hidden" style="background:${a.color};">
                ${a.imageUrl ? `<img src="${a.imageUrl}" alt="${a.name}" class="w-full h-full object-cover" />` : a.name.slice(0, 2).toUpperCase()}
              </span>
              <div class="min-w-0">
                <div class="font-semibold text-xs truncate">${a.name}</div>
                <div class="text-[11px] opacity-65 truncate">${a.isAlly === false ? 'Secundario' : 'Protagonista'} · ${a.role} · HP ${a.hp} · CA ${a.ac || 12}</div>
              </div>
            </div>
            ${moreDotsBtn('data-actor-menu', a.key)}
          </div>
        `
      );

      const openActorMenu = (key, cx, cy) => {
        const a = allActors.find((x) => x.key === key);
        if (!a) return;
        const actions = [
          {
            icon: '⧉',
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
            { icon: '✏️', label: 'Editar personaje', onClick: () => editCustomActor(a.key) },
            {
              icon: '🗑️',
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
      const baseItems =
        state.ruleset === 'free'
          ? COMPENDIUM_ITEMS.filter((i) => !String(i.key || '').startsWith('55_'))
          : COMPENDIUM_ITEMS;
      const allItems = [...(state.customItems || []), ...baseItems];
      const list = allItems.filter((i) => i.name.toLowerCase().includes(q) || i.badge.toLowerCase().includes(q));
      renderWithFolders(
        list,
        (it) => `
          <div
            draggable="true"
            data-drag-spec="item:${it.key}"
            data-item-key="${it.key}"
            class="group portal-list-row px-2 py-2 flex items-center justify-between gap-2 cursor-grab"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              ${this.renderItemIconBadge(it)}
              <div class="min-w-0">
                <div class="font-semibold text-xs truncate">${it.name}</div>
                <div class="text-[11px] opacity-65 truncate">${it.badge}</div>
              </div>
            </div>
            ${moreDotsBtn('data-item-menu', it.key)}
          </div>
        `
      );

      const openItemMenu = (key, cx, cy) => {
        const it = allItems.find((x) => x.key === key);
        if (!it) return;
        const actions = [];
        if (Service.state.selectedTokenId) {
          actions.push({
            icon: '🎒',
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
            { icon: '✏️', label: 'Editar complemento', onClick: () => editCustomItem(it.key) },
            {
              icon: '🗑️',
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
            icon: 'ℹ️',
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
      renderWithFolders(
        list,
        (m) => `
          <div
            draggable="true"
            data-drag-spec="map:${m.key}"
            data-map-key="${m.key}"
            class="group portal-list-row px-2 py-2 flex items-center justify-between gap-2 cursor-grab"
          >
            <div class="min-w-0">
              <div class="font-semibold text-xs truncate">${m.name}</div>
              <div class="text-[11px] opacity-65 truncate">${m.desc}</div>
            </div>
            ${moreDotsBtn('data-map-menu', m.key)}
          </div>
        `
      );

      const openMapMenu = (key, cx, cy) => {
        const m = allMaps.find((x) => x.key === key);
        if (!m) return;
        const actions = [
          {
            icon: '🗺️',
            label: 'Activar escenario',
            onClick: async () => {
              await Service.activateMapTemplate(m);
              this.showActionToast(`Escenario "${m.name}" activado.`);
            }
          }
        ];
        if (m.isCustom) {
          actions.push(
            { icon: '✏️', label: 'Editar escenario', onClick: () => editCustomMap(m.key) },
            {
              icon: '🗑️',
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
        }
      });
    });
  }
};
