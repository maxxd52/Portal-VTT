/* ==========================================================================
   VIEW: RENDERIZADO DE LIENZOS, COMPENDIO, FICHA IZQUIERDA Y MENÚ CONTEXTUAL
   ========================================================================== */

import { Dice3DEngine } from '../services/dice3dEngine.js?v=20261117b1';
import { RealtimeBridge } from '../services/realtimeBridge.js?v=20261117b1';
import { Selector } from './selector.js?v=20261117b1';
import { Service } from './service.js?v=20261117b1';
import { BoardViewMethods } from '../ui/boardView.js?v=20261117b1';
import { CanvasViewMethods } from '../ui/canvasView.js?v=20261117b1';
import { CompendiumViewMethods } from '../ui/compendiumView.js?v=20261117b1';
import { CompendiumFormsViewMethods } from '../ui/compendiumFormsView.js?v=20261117b1';
import { ContextMenuViewMethods } from '../ui/contextMenuView.js?v=20261117b1';
import { DiceViewMethods } from '../ui/diceView.js?v=20261117b1';
import { collectViewElements, ITEM_ICON_DEFS, TOKEN_STATUS_SYMBOLS } from '../ui/domCache.js?v=20261117b1';
import { ItemCreatorViewMethods } from '../ui/itemCreatorView.js?v=20261117b1';
import { ModalsViewMethods } from '../ui/modalsView.js?v=20261117b1';
import { PortalLobbyViewMethods } from '../ui/portalLobbyView.js?v=20261117b1';
import { SequenceViewMethods } from '../ui/sequenceView.js?v=20261117b1';
import { SheetViewMethods } from '../ui/sheetView.js?v=20261117b1';
import { SheetBlocksViewMethods } from '../ui/sheetBlocksView.js?v=20261117b1';
import { SheetInventoryViewMethods } from '../ui/sheetInventoryView.js?v=20261117b1';
import { SheetResourcesViewMethods } from '../ui/sheetResourcesView.js?v=20261117b1';
import { SystemOptionsViewMethods } from '../ui/systemOptionsView.js?v=20261117b1';

export const View = {
  els: {},
  ctxTargetTokenId: null,
  ctxWorldPos: { x: 400, y: 400 },
  hoverWorldPos: { x: 400, y: 400 },
  exploredCanvas: null,
  draggingTokenId: null,
  draggingInvUid: null,
  formulaTokens: [],
  activeSheetTab: 'attrs',
  selectedItemIcon: 'shield',
  selectedTokenColor: '#8b5cf6',
  selectedItemColor: '#8b5cf6',
  dismissedRoll: null,

  itemIconDefs: ITEM_ICON_DEFS,
  tokenStatusSymbols: TOKEN_STATUS_SYMBOLS,

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  ...BoardViewMethods,
  ...ContextMenuViewMethods,
  ...CanvasViewMethods,
  ...CompendiumViewMethods,
  ...CompendiumFormsViewMethods,
  ...DiceViewMethods,
  ...ItemCreatorViewMethods,
  ...ModalsViewMethods,
  ...PortalLobbyViewMethods,
  ...SequenceViewMethods,
  ...SheetViewMethods,
  ...SheetBlocksViewMethods,
  ...SheetInventoryViewMethods,
  ...SheetResourcesViewMethods,
  ...SystemOptionsViewMethods,

  getItemCategory(kind) {
    return Selector.resolveItemTabId(Service.state, kind);
  },

  getDefaultItemIcon(kind) {
    const cat = this.getItemCategory(kind);
    return cat === 'consumable' ? 'potion' : cat === 'ability' ? 'sparkle' : 'shield';
  },

  renderStatusSymbolSvg(keyOrIcon, sizeClass = 'w-3.5 h-3.5', state = Service.state) {
    const iconKey = TOKEN_STATUS_SYMBOLS[keyOrIcon]
      ? keyOrIcon
      : Selector.getStatusDef(state, keyOrIcon).icon;
    const def = TOKEN_STATUS_SYMBOLS[iconKey] || TOKEN_STATUS_SYMBOLS.mark;
    return `<svg class="${sizeClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${def.path}</svg>`;
  },

  renderItemIconSvg(iconKey, sizeClass = 'w-[18px] h-[18px]', strokeWidth = 2.15) {
    const def = ITEM_ICON_DEFS[iconKey] || ITEM_ICON_DEFS.shield;
    return `<svg class="${sizeClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${def[1]}</svg>`;
  },

  renderItemIconBadge(item, opts = {}) {
    const iconKey = item?.icon && ITEM_ICON_DEFS[item.icon] ? item.icon : this.getDefaultItemIcon(item?.kind);
    const color = item?.color || '#8b5cf6';
    if (opts.interactive && item?.uid) {
      return `<button type="button" draggable="false" data-use-inv="${item.uid}" class="portal-item-use-btn w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="--item-color:${color}; background:${color}22; color:${color}; border-color:${color}55;" title="Usar / Tirar ${item.name || ''}" aria-label="Usar ${item.name || 'objeto'}">${this.renderItemIconSvg(iconKey)}</button>`;
    }
    return `<span class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${color}22; color:${color};">${this.renderItemIconSvg(iconKey)}</span>`;
  },

  bindDrawerResize(drawerEl, side, storageKey) {
    if (!drawerEl) return;
    const minW = 320;
    const maxW = () => Math.max(minW, Math.min(520, Math.floor(window.innerWidth * 0.44)));
    const clampW = (w) => Math.max(minW, Math.min(maxW(), Math.round(w)));

    const saved = Number(localStorage.getItem(storageKey));
    if (Number.isFinite(saved) && saved >= minW) {
      drawerEl.style.width = `${clampW(saved)}px`;
    }

    const updateBottomClearance = () => {
      const tray = this.els.diceTrayBar;
      if (!tray) return;
      const dRect = drawerEl.getBoundingClientRect();
      const tRect = tray.getBoundingClientRect();
      if (dRect.width === 0 || tRect.width === 0) return;
      const overlaps = side === 'left'
        ? dRect.right + 12 > tRect.left
        : dRect.left - 12 < tRect.right;
      drawerEl.style.bottom = overlaps
        ? `${Math.max(16, Math.round(window.innerHeight - tRect.top + 12))}px`
        : '';
    };
    requestAnimationFrame(updateBottomClearance);
    window.addEventListener('resize', updateBottomClearance);

    const isOnInnerEdge = (clientX) => {
      const rect = drawerEl.getBoundingClientRect();
      return side === 'left'
        ? rect.right - clientX <= 8 && rect.right - clientX >= -2
        : clientX - rect.left <= 8 && clientX - rect.left >= -2;
    };

    let resizing = false;
    let startX = 0;
    let startW = minW;

    drawerEl.addEventListener('pointermove', (e) => {
      if (resizing) return;
      drawerEl.style.cursor = isOnInnerEdge(e.clientX) ? 'ew-resize' : '';
    });
    drawerEl.addEventListener('pointerleave', () => {
      if (!resizing) drawerEl.style.cursor = '';
    });
    drawerEl.addEventListener('dblclick', (e) => {
      if (!isOnInnerEdge(e.clientX)) return;
      drawerEl.style.width = '';
      localStorage.removeItem(storageKey);
      updateBottomClearance();
    });
    drawerEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !isOnInnerEdge(e.clientX)) return;
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      startX = e.clientX;
      startW = drawerEl.getBoundingClientRect().width;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
      drawerEl.style.width = `${clampW(startW + delta)}px`;
      updateBottomClearance();
    });
    window.addEventListener('pointerup', () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      drawerEl.style.cursor = '';
      localStorage.setItem(storageKey, String(Math.round(drawerEl.getBoundingClientRect().width)));
    });
  },

  async init() {
    this.clearExploredMemory();
    this.cacheElements();
    Dice3DEngine.init(this.els.dice3dCanvas, {
      overlayEl: this.els.dice3dOverlay,
      trayEl: this.els.diceTrayBar
    });
    this.bindEvents();
    await Service.restoreFromVault();

    RealtimeBridge.connect(
      Service.state.room.code,
      (msg) => this.handleRealtimeMessage(msg),
      () => Service.state.role
    );
    this.startPresenceHeartbeat();

    Service.subscribe((state, opts) => this.render(state, opts));
    this.render(Service.state, { redrawMap: true, redrawGrid: true, redrawDraw: true, redrawFog: true });

    const hasRoomParam = new URLSearchParams(window.location.search).has('room');
    if (!hasRoomParam) {
      await this.showPortalLobby();
    }
  },

  startPresenceHeartbeat() {
    const sendPing = () => {
      RealtimeBridge.send({
        kind: 'PRESENCE_PING',
        clientId: Service.clientId,
        role: Service.state.role || 'gm'
      });
    };
    sendPing();
    if (Service.state.role === 'player') {
      RealtimeBridge.send({ kind: 'SYNC_REQUEST', clientId: Service.clientId, role: 'player' });
      clearTimeout(this._syncReqTimer);
      this._syncReqTimer = setTimeout(() => {
        if (Service.state.role === 'player') {
          RealtimeBridge.send({ kind: 'SYNC_REQUEST', clientId: Service.clientId, role: 'player' });
        }
      }, 1200);
    }
    if (this._presenceTimer) clearInterval(this._presenceTimer);
    this._presenceTimer = setInterval(sendPing, 10000);
    if (!this._presenceUnloadBound) {
      this._presenceUnloadBound = true;
      window.addEventListener('beforeunload', () => {
        RealtimeBridge.send({ kind: 'PRESENCE_BYE', clientId: Service.clientId, leaving: true });
      });
    }
  },

  handleRealtimeMessage(msg) {
    if (!msg) return;
    if (msg.kind === 'WORLD_SYNC' && msg.world) {
      Service.applyFullWorldState(msg.world, true);
    } else if (msg.kind === 'DICE_ROLL' && msg.roll) {
      Service.receiveRemoteRoll(msg.roll);
    } else if (msg.kind === 'HANDOUT_SHOW' && msg.handout) {
      Service.state.activeHandout = msg.handout;
      Service.notify({ skipVaultSave: true });
    } else if (msg.kind === 'HANDOUT_CLOSE') {
      Service.state.activeHandout = null;
      Service.notify({ skipVaultSave: true });
    } else if (msg.kind === 'SYNC_REQUEST') {
      if (Service.state.role === 'gm') {
        RealtimeBridge.send({ kind: 'WORLD_SYNC', world: Selector.extractSerializableWorld(Service.state) });
      }
    } else if (msg.kind === 'PRESENCE_PING') {
      const isNewPeer = msg.clientId && msg.clientId !== Service.clientId && !Service.peers.has(msg.clientId);
      Service.updatePeerPresence(msg);
      const now = Date.now();
      if (isNewPeer && Service.state.role === 'gm' && now - (this._lastWorldSyncAt || 0) > 400) {
        this._lastWorldSyncAt = now;
        RealtimeBridge.send({ kind: 'WORLD_SYNC', world: Selector.extractSerializableWorld(Service.state) });
      }
    } else if (msg.kind === 'PRESENCE_BYE') {
      Service.updatePeerPresence({ ...msg, leaving: true });
    } else if (msg.kind === 'ROLL_REQUEST' && msg.request) {
      Service.receiveRollRequest(msg.request);
    } else if (msg.kind === 'ROLL_RESPONSE' && msg.response) {
      Service.receiveRollResponse(msg.response);
    }
  },

  cacheElements() {
    this.els = collectViewElements();
  },

  showActionToast(msg) {
    this.els.vttActionToast.textContent = msg;
    this.els.vttActionToast.classList.add('is-open');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.els.vttActionToast.classList.remove('is-open');
    }, 2800);
  },

  showRoomToast(msg) {
    this.els.roomToastBox.textContent = msg;
    this.els.roomToastBox.classList.remove('hidden');
  },

  bindEvents() {
    this.bindPortalLobbyEvents();
    this.bindBoardEvents();

    // Selector de Escena / Mesas Enlazadas (dentro de Sala)
    this.els.mapSelector.addEventListener('change', async (e) => {
      const val = e.target.value;
      if (val.startsWith('shelf:')) {
        const modId = val.replace('shelf:', '');
        const entry = (Service.state.shelfModules || []).find((m) => m.id === modId);
        if (entry) {
          this.showActionToast(`Descargando "${entry.title}"...`);
          try {
            await Service.loadRemoteCartridge(entry);
            this.showActionToast(`Mesa "${entry.title}" cargada.`);
          } catch (err) {
            this.showActionToast(err.message || 'Error al descargar cartucho.');
          }
        }
        return;
      }
      Service.changeMap(val);
    });

    this.els.btnToggleGridPopover.addEventListener('click', () => {
      this.els.gridPopover.classList.toggle('is-open');
    });
    const applyGridSize = (val) => {
      const next = Math.round(Math.max(16, Math.min(300, Number(val) || 80)) * 100) / 100;
      Service.updateGrid({ cellSize: next });
    };
    const applyGridOffset = (axis, val) => {
      const next = Math.round(Math.max(-300, Math.min(300, Number(val) || 0)) * 100) / 100;
      Service.updateGrid({ [axis]: next });
    };

    if (this.els.btnFitGridToMap) {
      this.els.btnFitGridToMap.addEventListener('click', () => {
        const cols = Number(this.els.inpGridCols?.value) || 0;
        const rows = Number(this.els.inpGridRows?.value) || 0;
        if (cols < 2 && rows < 2) return;
        const img = Service.state.mapId === 'custom' ? this.els.customMapImg : null;
        let dx = 0;
        let dy = 0;
        let dw = 2400;
        let dh = 1600;
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          const scale = Math.min(2400 / img.naturalWidth, 1600 / img.naturalHeight);
          dw = img.naturalWidth * scale;
          dh = img.naturalHeight * scale;
          dx = (2400 - dw) / 2;
          dy = (1600 - dh) / 2;
        }
        const rawCell = cols >= 2 ? dw / cols : dh / rows;
        const cellSize = Math.round(Math.max(16, Math.min(300, rawCell)) * 100) / 100;
        Service.updateGrid({
          cellSize,
          offsetX: Math.round(dx * 100) / 100,
          offsetY: Math.round(dy * 100) / 100
        });
        this.showActionToast(`Grilla ajustada (${cellSize}px).`);
      });
    }

    this.els.btnGridSizeMinus.addEventListener('click', (e) => {
      applyGridSize(Service.state.grid.cellSize - (e.shiftKey ? 5 : 1));
    });
    this.els.btnGridSizePlus.addEventListener('click', (e) => {
      applyGridSize(Service.state.grid.cellSize + (e.shiftKey ? 5 : 1));
    });
    this.els.inpGridSize.addEventListener('change', (e) => applyGridSize(e.target.value));

    this.els.btnGridOffXMinus.addEventListener('click', (e) => {
      applyGridOffset('offsetX', (Service.state.grid.offsetX || 0) - (e.shiftKey ? 5 : 1));
    });
    this.els.btnGridOffXPlus.addEventListener('click', (e) => {
      applyGridOffset('offsetX', (Service.state.grid.offsetX || 0) + (e.shiftKey ? 5 : 1));
    });
    this.els.inpGridOffX.addEventListener('change', (e) => applyGridOffset('offsetX', e.target.value));

    this.els.btnGridOffYMinus.addEventListener('click', (e) => {
      applyGridOffset('offsetY', (Service.state.grid.offsetY || 0) - (e.shiftKey ? 5 : 1));
    });
    this.els.btnGridOffYPlus.addEventListener('click', (e) => {
      applyGridOffset('offsetY', (Service.state.grid.offsetY || 0) + (e.shiftKey ? 5 : 1));
    });
    this.els.inpGridOffY.addEventListener('change', (e) => applyGridOffset('offsetY', e.target.value));

    this.els.btnGridResetOffset.addEventListener('click', () => {
      Service.updateGrid({ offsetX: 0, offsetY: 0 });
    });

    this.els.rngGridOpacity.addEventListener('input', (e) => {
      Service.updateGrid({ opacity: Number(e.target.value) / 100 });
    });
    this.els.chkGridSnap.addEventListener('change', (e) => {
      Service.updateGrid({ snap: e.target.checked });
    });

    this.els.btnRoleGM.addEventListener('click', () => Service.setRole('gm'));
    this.els.btnRolePlayer.addEventListener('click', () => Service.setRole('player'));

    this.els.btnToggleSheet.addEventListener('click', () => {
      if (!Service.state.selectedTokenId && Service.state.tokens.length) {
        Service.state.selectedTokenId = Service.state.tokens[0].id;
      }
      Service.state.sheetOpen = !Service.state.sheetOpen;
      Service.notify();
    });
    this.els.btnCloseSheet.addEventListener('click', () => {
      Service.state.sheetOpen = false;
      Service.notify();
    });

    this.els.btnToggleTokenDrawer.addEventListener('click', () => {
      Service.state.drawerOpen = !Service.state.drawerOpen;
      Service.notify();
    });
    this.els.btnCloseTokenDrawer.addEventListener('click', () => {
      Service.state.drawerOpen = false;
      Service.notify();
    });

    this.bindDrawerResize(this.els.characterSheetDrawer, 'left', 'portal_sheet_width');
    this.bindDrawerResize(this.els.tokenDrawer, 'right', 'portal_compendium_width');

    this.els.btnToggleCombat.addEventListener('click', () => {
      if (Service.state.combat?.active) Service.endCombat();
      else Service.startCombat();
    });
    this.els.btnNextTurn.addEventListener('click', () => Service.nextCombatTurn());
    this.els.btnEndCombat.addEventListener('click', () => Service.endCombat());

    this.els.rulerShapeSeg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ruler-shape]');
      if (!btn) return;
      Service.state.rulerShape = btn.dataset.rulerShape;
      Service.notify();
    });

    this.els.btnCloseNoteModal.addEventListener('click', () => this.closeNoteModal());
    this.els.noteEditorModal.addEventListener('click', (e) => {
      if (e.target === this.els.noteEditorModal) this.closeNoteModal();
    });
    this.els.btnDeleteNote.addEventListener('click', () => {
      if (this.editingNoteCtx?.id) {
        Service.deleteMapNote(this.editingNoteCtx.id);
        this.showActionToast('Nota eliminada.');
      }
      this.closeNoteModal();
    });
    this.els.noteEditorForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = this.els.inpNoteTitle.value.trim();
      if (!title) return;
      const body = this.els.inpNoteBody.value.trim();
      const gmOnly = this.els.chkNoteGmOnly.checked;
      if (this.editingNoteCtx?.id) {
        Service.updateMapNote(this.editingNoteCtx.id, { title, body, gmOnly });
        this.showActionToast('Nota actualizada.');
      } else if (this.editingNoteCtx) {
        Service.addMapNote(this.editingNoteCtx.x, this.editingNoteCtx.y, title, body, gmOnly);
        this.showActionToast('Nota fijada en el escenario.');
      }
      this.closeNoteModal();
    });

    this.els.btnToggleTheme.addEventListener('click', (e) => {
      e.stopPropagation();
      this.els.optionsPopover?.classList.remove('is-open');
      this.els.themePopover?.classList.toggle('is-open');
    });
    this.els.btnOpenOptions?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.els.themePopover?.classList.remove('is-open');
      this.els.optionsPopover?.classList.toggle('is-open');
    });
    this.els.btnOptReturnLobby?.addEventListener('click', () => {
      this.els.optionsPopover?.classList.remove('is-open');
      this.showPortalLobby();
    });
    this.els.btnOptOpenSystem?.addEventListener('click', () => {
      this.els.optionsPopover?.classList.remove('is-open');
      this.openSystemModal();
    });
    this.els.btnCloseSystemModal?.addEventListener('click', () => {
      this.els.systemModal?.classList.remove('is-open');
    });
    this.els.systemModal?.addEventListener('click', (e) => {
      if (e.target === this.els.systemModal) this.els.systemModal.classList.remove('is-open');
    });
    this.els.btnOptOpenRoom?.addEventListener('click', () => {
      this.els.optionsPopover?.classList.remove('is-open');
      this.renderRoomModal(Service.state);
      this.els.roomModal?.classList.add('is-open');
    });
    this.els.btnOptOpenSync?.addEventListener('click', () => {
      this.els.optionsPopover?.classList.remove('is-open');
      this.renderSyncModal(Service.state);
      this.els.syncModal?.classList.add('is-open');
    });
    this.els.themePopover?.querySelectorAll('[data-theme-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.setTheme(btn.dataset.themePick);
        this.els.themePopover.classList.remove('is-open');
      });
    });
    document.addEventListener('pointerdown', (e) => {
      if (
        this.els.themePopover?.classList.contains('is-open') &&
        !e.target.closest('#themePopover') &&
        !e.target.closest('#btnToggleTheme')
      ) {
        this.els.themePopover.classList.remove('is-open');
      }
      if (
        this.els.optionsPopover?.classList.contains('is-open') &&
        !e.target.closest('#optionsPopover') &&
        !e.target.closest('#btnOpenOptions')
      ) {
        this.els.optionsPopover.classList.remove('is-open');
      }
    });

    // 4. Ficha Izquierda Acciones
    this.bindSheetEvents();

    this.bindCompendiumEvents();

    // 6. Bandeja de Dados 3D
    this.bindDiceEvents();
    this.bindModalEvents();
  },

  /* --------------------------------------------------------------------
     RENDERIZADO DE CAPAS Y PANELES
     -------------------------------------------------------------------- */
  render(state, opts = {}) {
    document.documentElement.setAttribute('data-theme', state.theme);
    this.els.themePopover?.querySelectorAll('[data-theme-pick]').forEach((btn) => {
      btn.classList.toggle('portal-btn-active', btn.dataset.themePick === state.theme);
    });

    // Cámara
    this.els.worldLayer.style.transform = `translate(${state.camera.x}px, ${state.camera.y}px) scale(${state.camera.zoom})`;

    if (opts.clearExplored) this.clearExploredMemory();
    if (opts.redrawMap) this.drawMapCanvas(state);
    if (opts.redrawGrid) this.drawGridCanvas(state);
    if (opts.redrawDraw) this.drawStrokesCanvas(state);
    if (opts.redrawFog) this.drawFogCanvas(state);

    this.renderHudControls(state);
    this.renderCombatTracker(state);
    this.renderTokensLayer(state);
    this.renderMapNotes(state);
    this.renderVectorOverlay(state);
    this.renderCharacterSheet(state);
    this.renderCompendium(state);
    this.renderDiceReadout(state);
    this.renderSequenceUI(state);
    this.renderHandoutModal(state);
    if (this.els.systemModal?.classList.contains('is-open')) {
      this.renderSystemModal(state);
    }
  },

  renderHudControls(state) {
    const roomTitle = state.room.moduleTitle && state.room.moduleTitle !== 'Mesa Local' ? state.room.moduleTitle : state.room.code;
    this.els.lblActiveRoomCode.textContent = roomTitle;
    if (this.els.btnOpenRoomModal) {
      this.els.btnOpenRoomModal.title = `${state.room.moduleTitle || 'Portal'} (${state.room.code})`;
    }
    this.els.lblActiveTokensCount.textContent = String(state.tokens.length);
    if (this.els.lblSyncBadge) {
      this.els.lblSyncBadge.textContent = String(Service.getActivePeers().length);
    }

    if (this.els.shelfDropdownGroup) {
      const shelf = state.shelfModules || [];
      this.els.shelfDropdownGroup.innerHTML = shelf.length
        ? shelf.map((m) => `<option value="shelf:${m.id}">📦 ${m.title}</option>`).join('')
        : `<option value="" disabled>(Sin enlaces externos aún)</option>`;
    }

    const csLabel = Number(Number(state.grid.cellSize || 80).toFixed(1));
    this.els.lblGridSizeDetail.textContent = `${csLabel}px · 1.5m`;
    const opacityPct = Math.round(state.grid.opacity * 100);
    this.els.lblGridOpacity.textContent = `${opacityPct}%`;
    if (document.activeElement !== this.els.inpGridSize) {
      this.els.inpGridSize.value = String(state.grid.cellSize);
    }
    if (document.activeElement !== this.els.inpGridOffX) {
      this.els.inpGridOffX.value = String(state.grid.offsetX || 0);
    }
    if (document.activeElement !== this.els.inpGridOffY) {
      this.els.inpGridOffY.value = String(state.grid.offsetY || 0);
    }
    this.els.rngGridOpacity.value = String(opacityPct);
    this.els.chkGridSnap.checked = Boolean(state.grid.snap);

    const isPlayer = state.role === 'player';
    const isSpectator = Selector.isSpectator(state);
    this.els.btnToggleTokenDrawer?.classList.toggle('hidden', isPlayer);
    this.els.btnToggleGridPopover?.classList.toggle('hidden', isPlayer);
    this.els.btnOpenDriveModal?.classList.toggle('hidden', isPlayer);
    this.els.btnOptOpenSystem?.classList.toggle('hidden', isPlayer);
    this.els.btnToggleCombat?.classList.toggle('hidden', isPlayer);
    this.els.btnToggleSheet?.classList.toggle('hidden', isSpectator);
    this.els.diceTrayBar?.classList.toggle('hidden', isSpectator);
    this.els.diceTrayBar?.classList.toggle('flex', !isSpectator);

    this.els.btnRoleGM.classList.toggle('is-active', !isPlayer);
    this.els.btnRolePlayer.classList.toggle('is-active', isPlayer);
    if (this.els.btnToggleCombat) {
      this.els.btnToggleCombat.classList.toggle('portal-btn-active', Boolean(state.combat?.active));
    }
    if (this.els.rulerShapePill) {
      const showRuler = state.tool === 'ruler' && !state.combat?.active;
      this.els.rulerShapePill.classList.toggle('hidden', !showRuler);
      this.els.rulerShapePill.classList.toggle('flex', showRuler);
      const shape = state.rulerShape || 'line';
      this.els.rulerShapeSeg.querySelectorAll('[data-ruler-shape]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.rulerShape === shape);
      });
    }

    const selTok = Selector.getSelectedToken(state);
    this.els.characterSheetDrawer.classList.toggle('is-open', Boolean(!isSpectator && state.sheetOpen && selTok && Service.canControlToken(selTok)));
    this.els.tokenDrawer.classList.toggle('is-open', Boolean(!isPlayer && state.drawerOpen));
  }
};
