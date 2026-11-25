/* ==========================================================================
   VIEW: RENDERIZADO DE LIENZOS, COMPENDIO, FICHA IZQUIERDA Y MENÚ CONTEXTUAL
   ========================================================================== */

import { BrowserVault } from '../services/browserVault.js?v=20261125a1';
import { Dice3DEngine } from '../services/dice3dEngine.js?v=20261125a1';
import { GmHostLock } from '../services/gmHostLock.js?v=20261125a1';
import { TabletopAudio } from '../services/tabletopAudio.js?v=20261125a1';
import { RealtimeBridge } from '../services/realtimeBridge.js?v=20261125a1';
import { Selector } from './selector.js?v=20261125a1';
import { Service } from './service.js?v=20261125a1';
import { BoardViewMethods } from '../ui/boardView.js?v=20261125a1';
import { CanvasViewMethods } from '../ui/canvasView.js?v=20261125a1';
import { CompendiumViewMethods } from '../ui/compendiumView.js?v=20261125a1';
import { CompendiumFormsViewMethods } from '../ui/compendiumFormsView.js?v=20261125a1';
import { ContextMenuViewMethods } from '../ui/contextMenuView.js?v=20261125a1';
import { shouldAllowNativeContextMenu } from '../utils/contextMenuModel.js?v=20261125a1';
import { resolveItemBadgeStyle } from '../utils/compendiumCardModel.js?v=20261125a1';
import { DiceViewMethods } from '../ui/diceView.js?v=20261125a1';
import { collectViewElements, ITEM_ICON_DEFS, TOKEN_STATUS_SYMBOLS } from '../ui/domCache.js?v=20261125a1';
import { GmScreenViewMethods } from '../ui/gmScreenView.js?v=20261125a1';
import { GmScreenWidgetsViewMethods } from '../ui/gmScreenWidgetsView.js?v=20261125a1';
import { GmScreenConfigViewMethods } from '../ui/gmScreenConfigView.js?v=20261125a1';
import { ItemCreatorViewMethods } from '../ui/itemCreatorView.js?v=20261125a1';
import { JournalPresentationViewMethods } from '../ui/journalPresentationView.js?v=20261125a1';
import { JournalShareViewMethods } from '../ui/journalShareView.js?v=20261125a1';
import { JournalViewMethods } from '../ui/journalView.js?v=20261125a1';
import { MapGridEditorViewMethods } from '../ui/mapGridEditorView.js?v=20261125a1';
import { ModalsViewMethods } from '../ui/modalsView.js?v=20261125a1';
import { PortalLobbyViewMethods } from '../ui/portalLobbyView.js?v=20261125a1';
import { PortalSelectViewMethods } from '../ui/portalSelectView.js?v=20261125a1';
import { PresenceViewMethods } from '../ui/presenceView.js?v=20261125a1';
import { SequenceViewMethods } from '../ui/sequenceView.js?v=20261125a1';
import { SheetViewMethods } from '../ui/sheetView.js?v=20261125a1';
import { SheetBlocksViewMethods } from '../ui/sheetBlocksView.js?v=20261125a1';
import { SheetInventoryViewMethods } from '../ui/sheetInventoryView.js?v=20261125a1';
import { SheetResourcesViewMethods } from '../ui/sheetResourcesView.js?v=20261125a1';
import { SystemOptionsViewMethods } from '../ui/systemOptionsView.js?v=20261125a1';
import { TokenEditorViewMethods } from '../ui/tokenEditorView.js?v=20261125a1';
import { TokenInspectViewMethods } from '../ui/tokenInspectView.js?v=20261125a1';
import { TokenPhysicsViewMethods } from '../ui/tokenPhysicsView.js?v=20261125a1';
import { buildSceneTransitionSignature } from '../utils/sceneTransitionModel.js?v=20261125a1';
import { renderUiLineIcon } from '../utils/uiIcons.js?v=20261125a1';
import { getWallDoorMode, isWallDoor, normalizeWallKind } from '../utils/wallGeometry.js?v=20261125a1';

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
  ...GmScreenViewMethods,
  ...GmScreenWidgetsViewMethods,
  ...GmScreenConfigViewMethods,
  ...ItemCreatorViewMethods,
  ...JournalPresentationViewMethods,
  ...JournalShareViewMethods,
  ...JournalViewMethods,
  ...MapGridEditorViewMethods,
  ...ModalsViewMethods,
  ...PortalLobbyViewMethods,
  ...PortalSelectViewMethods,
  ...PresenceViewMethods,
  ...SequenceViewMethods,
  ...SheetViewMethods,
  ...SheetBlocksViewMethods,
  ...SheetInventoryViewMethods,
  ...SheetResourcesViewMethods,
  ...SystemOptionsViewMethods,
  ...TokenEditorViewMethods,
  ...TokenInspectViewMethods,
  ...TokenPhysicsViewMethods,

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
    const style = resolveItemBadgeStyle(opts.size);
    if (opts.interactive && item?.uid) {
      return `<button type="button" draggable="false" data-use-inv="${item.uid}" class="portal-item-use-btn ${style.boxClass} flex items-center justify-center flex-shrink-0" style="--item-color:${color}; background:${color}22; color:${color}; border-color:${color}55;" title="Usar / Tirar ${item.name || ''}" aria-label="Usar ${item.name || 'objeto'}">${this.renderItemIconSvg(iconKey, style.iconClass, style.strokeWidth)}</button>`;
    }
    const ringCss = style.ring ? ` box-shadow: inset 0 0 0 1px ${color}40;` : '';
    return `<span class="${style.boxClass} flex items-center justify-center flex-shrink-0" style="background:${color}22; color:${color};${ringCss}">${this.renderItemIconSvg(iconKey, style.iconClass, style.strokeWidth)}</span>`;
  },

  bindDrawerResize(drawerEl, side, storageKey) {
    if (!drawerEl) return;
    const getEffectiveSide = () => (Service.railsSwapped ? (side === 'left' ? 'right' : 'left') : side);
    const getScale = () => (typeof Service.getUiScale === 'function' ? Service.getUiScale() : 1);
    const minW = 320;
    const maxW = () => Math.max(minW, Math.min(520, Math.floor((window.innerWidth / getScale()) * 0.44)));
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
      const overlaps = getEffectiveSide() === 'left'
        ? dRect.right + 12 > tRect.left
        : dRect.left - 12 < tRect.right;
      const scale = getScale();
      drawerEl.style.bottom = overlaps
        ? `${Math.max(16, Math.round((window.innerHeight - tRect.top + 12) / scale))}px`
        : '';
    };
    if (!Array.isArray(this._drawerClearanceUpdaters)) this._drawerClearanceUpdaters = [];
    this._drawerClearanceUpdaters.push(updateBottomClearance);
    requestAnimationFrame(updateBottomClearance);
    window.addEventListener('resize', updateBottomClearance);

    const isOnInnerEdge = (clientX) => {
      const rect = drawerEl.getBoundingClientRect();
      return getEffectiveSide() === 'left'
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
      startW = drawerEl.getBoundingClientRect().width / getScale();
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      const delta = (getEffectiveSide() === 'left' ? e.clientX - startX : startX - e.clientX) / getScale();
      drawerEl.style.width = `${clampW(startW + delta)}px`;
      updateBottomClearance();
    });
    window.addEventListener('pointerup', () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      drawerEl.style.cursor = '';
      localStorage.setItem(storageKey, String(Math.round(drawerEl.getBoundingClientRect().width / getScale())));
    });
  },

  applyUiScaleToDom() {
    const uiScaleKey = Service.uiScale || 'normal';
    const uiScaleFactor = typeof Service.getUiScale === 'function' ? Service.getUiScale() : 1;
    document.documentElement.setAttribute('data-ui-scale', uiScaleKey);
    document.documentElement.style.setProperty('--ui-scale', String(uiScaleFactor));
  },

  applyRailsSwappedToDom() {
    document.documentElement.setAttribute('data-rails-swapped', Service.railsSwapped ? 'true' : 'false');
  },

  syncAudioControlsUi() {
    const prefs = TabletopAudio.getPrefs();
    const effectivePct = Math.round((prefs.muted ? 0 : prefs.volume) * 100);
    if (this.els.rngAudioVolume) {
      this.els.rngAudioVolume.value = String(Math.round(prefs.volume * 100));
    }
    if (this.els.lblAudioVolumePct) {
      this.els.lblAudioVolumePct.textContent = prefs.muted ? 'Mute' : `${effectivePct}%`;
    }
    if (this.els.btnToggleAudioMute) {
      this.els.btnToggleAudioMute.textContent = prefs.muted ? 'Silenciado' : 'Activo';
      this.els.btnToggleAudioMute.classList.toggle('portal-btn-active', prefs.muted);
    }
  },

  syncGraphicsQualityUi() {
    const mode = this.graphicsQuality || 'auto';
    const profile = this.getGraphicsProfile?.();
    this.els.graphicsQualitySeg?.querySelectorAll('[data-graphics-quality]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.graphicsQuality === mode);
    });
    if (this.els.lblGraphicsQualityResolved && profile?.label) {
      this.els.lblGraphicsQualityResolved.textContent = profile.label;
    }
    this.applyGraphicsProfileToRuntime?.();
  },

  syncShadowModeUi() {
    this.syncGraphicsQualityUi();
  },

  async init() {
    this.clearExploredMemory();
    Service.setExploredMaskCapture(() => this.exportExploredMaskDataUrl());
    this.cacheElements();
    Service.loadUiScale();
    this.applyUiScaleToDom();
    Service.loadRailsSwapped();
    this.applyRailsSwappedToDom();
    TabletopAudio.loadPrefs();
    this.loadGraphicsQuality?.();
    Dice3DEngine.init(this.els.dice3dCanvas, {
      overlayEl: this.els.dice3dOverlay,
      trayEl: this.els.diceTrayBar
    });
    this.bindEvents();
    this.initPortalSelects?.();
    BrowserVault.requestPersistentStorage();
    BrowserVault.onSaveError = () => {
      this.showActionToast('Error al guardar en el navegador (espacio lleno o pestaña bloqueada). Exporta tu .portal.');
    };
    BrowserVault.onSaveStateChange = (saving) => {
      const badge = this.els?.vaultSaveBadge;
      if (!badge) return;
      clearTimeout(this._vaultBadgeTimer);
      if (saving) {
        this._vaultBadgeTimer = setTimeout(() => {
          if (BrowserVault.hasPendingSaves()) badge.classList.remove('hidden');
        }, 350);
      } else {
        badge.classList.add('hidden');
      }
    };
    Service.subscribe((state, opts) => this.render(state, opts));

    const hasRoomParam = new URLSearchParams(window.location.search).has('room');
    if (!hasRoomParam) {
      Service.loadDiceStyle();
      Service.loadUiScale();
      Service.loadRailsSwapped();
      const savedShelf = await BrowserVault.loadShelf();
      if (savedShelf) Service.state.shelfModules = savedShelf;
      this.render(Service.state, { redrawMap: true, redrawGrid: true, redrawDraw: true, redrawFog: true, skipSceneTransition: true });
      await this.showPortalLobby();
      return;
    }

    if (Service.isHostNetwork()) {
      const roomCode = Service.state.room.code;
      const acquired = await GmHostLock.acquire(roomCode);
      if (!acquired) {
        Service.state.isHostGm = false;
        Service.state.role = 'player';
        this.render(Service.state, { redrawMap: true, redrawGrid: true, redrawDraw: true, redrawFog: true, skipSceneTransition: true });
        await this.showPortalLobby();
        if (this.els.inpJoinPortalCode) this.els.inpJoinPortalCode.value = roomCode;
        if (this.els.selJoinPortalRole) this.els.selJoinPortalRole.value = 'player';
        this.showActionToast(
          `El portal ${roomCode} ya está abierto como GM en otra pestaña. Ciérrala o únete como Jugador/Espectador.`
        );
        return;
      }
    }

    await Service.restoreFromVault();

    if (Service.isHostNetwork() && Service.state.mapId === 'custom' && Service.state.customMapSourceUrl) {
      Service.refreshExternalMapFromSource();
    }

    RealtimeBridge.connect(
      Service.state.room.code,
      (msg) => this.handleRealtimeMessage(msg),
      () => (Service.isHostNetwork() ? 'gm' : 'player')
    );
    this.startPresenceHeartbeat();

    this.render(Service.state, { redrawMap: true, redrawGrid: true, redrawDraw: true, redrawFog: true });
  },

  startPresenceHeartbeat() {
    const sendPing = () => {
      const netIsGm = Service.isHostNetwork();
      const inviteId = netIsGm ? '' : (Service.state.activeInviteId || '');
      const primaryTokenId = inviteId && Service.playerPrimaryTokens instanceof Map
        ? (Service.playerPrimaryTokens.get(inviteId) || '')
        : '';
      RealtimeBridge.send({
        kind: 'PRESENCE_PING',
        clientId: Service.clientId,
        role: netIsGm ? 'gm' : 'player',
        inviteId,
        seatKey: netIsGm ? 'gm' : Service.getSelfSeatKey(),
        primaryTokenId,
        profile: netIsGm ? Service.getLocalProfile() : null
      });
    };
    sendPing();
    if (!Service.isHostNetwork()) {
      const reqPayload = {
        kind: 'SYNC_REQUEST',
        clientId: Service.clientId,
        role: 'player',
        inviteId: Service.state.activeInviteId || '',
        seatKey: Service.getSelfSeatKey()
      };
      RealtimeBridge.send(reqPayload);
      clearTimeout(this._syncReqTimer);
      this._syncReqTimer = setTimeout(() => {
        if (Service.state.role === 'player') {
          RealtimeBridge.send({
            ...reqPayload,
            inviteId: Service.state.activeInviteId || '',
            seatKey: Service.getSelfSeatKey()
          });
        }
      }, 1200);
    }
    if (this._presenceTimer) clearInterval(this._presenceTimer);
    this._presenceTimer = setInterval(sendPing, 10000);
    if (!this._presenceUnloadBound) {
      this._presenceUnloadBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') BrowserVault.flushPendingSaves();
      });
      window.addEventListener('pagehide', () => {
        BrowserVault.flushPendingSaves();
        GmHostLock.release();
      });
      window.addEventListener('beforeunload', (e) => {
        RealtimeBridge.send({ kind: 'PRESENCE_BYE', clientId: Service.clientId, leaving: true });
        BrowserVault.flushPendingSaves();
        if (BrowserVault.hasPendingSaves()) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
    }
  },

  handleRealtimeMessage(msg) {
    if (!msg) return;
    const netIsGm = Service.isHostNetwork();
    const selfSeat = Service.getSelfSeatKey();
    if (msg.targetSeatKey && msg.targetSeatKey !== selfSeat) return;
    if (msg.spectatorOnly && (netIsGm || (Service.state.role === 'player' && Service.state.activeInviteId))) return;
    if (msg.hostOnly && !netIsGm) return;

    if (msg.kind === 'WORLD_SYNC' && msg.world) {
      if (netIsGm) return;
      Service.applyFullWorldState(msg.world, true);
    } else if (msg.kind === 'PLAYER_TOKENS_SYNC') {
      Service.applyPlayerTokensSync(msg);
    } else if (msg.kind === 'DICE_ROLL' && msg.roll) {
      Service.receiveRemoteRoll(msg.roll);
    } else if (msg.kind === 'HANDOUT_SHOW' && msg.handout) {
      Service.state.activeHandout = msg.handout;
      Service.notify({ skipVaultSave: true });
    } else if (msg.kind === 'HANDOUT_CLOSE') {
      Service.state.activeHandout = null;
      Service.notify({ skipVaultSave: true });
    } else if (msg.kind === 'SYNC_REQUEST') {
      if (Service.isHostNetwork()) {
        const reqSeat = msg.seatKey || msg.inviteId || (msg.clientId ? `peer:${msg.clientId}` : null);
        Service.syncWorldToPeers(reqSeat);
      }
    } else if (msg.kind === 'PRESENCE_PING') {
      const isNewPeer = msg.clientId && msg.clientId !== Service.clientId && !Service.peers.has(msg.clientId);
      Service.updatePeerPresence(msg);
      const now = Date.now();
      if (isNewPeer && Service.isHostNetwork() && now - (this._lastWorldSyncAt || 0) > 400) {
        this._lastWorldSyncAt = now;
        const pingSeat = msg.seatKey || msg.inviteId || (msg.clientId ? `peer:${msg.clientId}` : null);
        Service.syncWorldToPeers(pingSeat);
      }
    } else if (msg.kind === 'PRESENCE_BYE') {
      Service.updatePeerPresence({ ...msg, leaving: true });
    } else if (msg.kind === 'ROLL_REQUEST' && msg.request) {
      Service.receiveRollRequest(msg.request);
    } else if (msg.kind === 'ROLL_RESPONSE' && msg.response) {
      Service.receiveRollResponse(msg.response);
    } else if (msg.kind === 'ROLL_DISMISS' && msg.seatKey) {
      Service.dismissSeatRoll(msg.seatKey, msg.rollId || '', { broadcast: false });
    } else if (msg.kind === 'CHAT_MESSAGE' && msg.message) {
      Service.receiveChatMessage(msg.message);
    } else if (msg.kind === 'PUBLIC_CLOCKS_SYNC' && Array.isArray(msg.publicClocks)) {
      if (!netIsGm) {
        Service.state.publicClocks = msg.publicClocks;
        Service.notify({ skipVaultSave: true });
      }
    } else if (msg.kind === 'TOKEN_MOVE' && msg.tokenId) {
      Service.applyRemoteTokenMove(msg);
    } else if (msg.kind === 'JOURNAL_PRESENT' && msg.note) {
      Service.receiveJournalPresentation(msg);
    } else if (msg.kind === 'JOURNAL_PRESENT_CLOSE') {
      Service.closeJournalPresentation(false);
    } else if (msg.kind === 'JOURNAL_REVEALS_SYNC' && msg.noteId) {
      Service.receiveJournalRevealsSync(msg);
    } else if (msg.kind === 'JOURNAL_PLAYER_SYNC') {
      Service.applyPlayerJournalSync(msg);
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

    this.els.btnRoleGM.addEventListener('click', () => Service.setRole('gm'));
    this.els.btnRolePlayer.addEventListener('click', () => Service.setRole('player'));

    this.els.btnToggleSheet.addEventListener('click', () => {
      if (Service.state.role === 'player') {
        const assigned = Selector.getPlayerAssignedTokenIds(Service.state);
        if (assigned.length && !assigned.includes(Service.state.selectedTokenId)) {
          Service.state.selectedTokenId = assigned[0];
        }
      } else if (!Service.state.selectedTokenId && Service.state.tokens.length) {
        Service.state.selectedTokenId = Service.state.tokens[0].id;
      }
      Service.state.sheetOpen = !Service.state.sheetOpen;
      if (Service.state.sheetOpen) Service.state.gmScreenOpen = false;
      Service.notify({ skipVaultSave: true, skipPeerSync: true });
    });
    this.els.btnCloseSheet.addEventListener('click', () => {
      Service.state.sheetOpen = false;
      Service.notify({ skipVaultSave: true, skipPeerSync: true });
    });

    this.els.btnToggleJournal?.addEventListener('click', () => {
      Service.toggleJournal();
    });
    this.els.btnCloseJournalDrawer?.addEventListener('click', () => {
      Service.toggleJournal(false);
    });

    this.els.btnToggleTokenDrawer.addEventListener('click', () => {
      const nextOpen = !Service.state.drawerOpen;
      Service.state.drawerOpen = nextOpen;
      if (nextOpen) {
        Service.state.journalOpen = false;
      }
      Service.notify();
    });
    this.els.btnCloseTokenDrawer.addEventListener('click', () => {
      Service.state.drawerOpen = false;
      Service.notify();
    });

    this.bindDrawerResize(this.els.characterSheetDrawer, 'left', 'portal_sheet_width');
    this.bindDrawerResize(this.els.tokenDrawer, 'right', 'portal_compendium_width');
    this.bindDrawerResize(this.els.journalDrawer, 'right', 'portal_journal_width');
    this.bindGmScreenEvents();

    this.els.btnToggleCombat.addEventListener('click', (e) => {
      e.stopPropagation();
      const combatActive = Boolean(Service.state.combat?.active);
      if (Service.state.role === 'gm' && !combatActive) {
        Service.startCombat();
        this.setCombatPopoverOpen?.(true);
        return;
      }
      if (combatActive) {
        const isOpen = this.els.combatTrackerPopover?.classList.contains('is-open');
        this.setCombatPopoverOpen?.(!isOpen);
      }
    });
    this.els.btnToggleCombatVisibility?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (Service.state.role !== 'gm') return;
      const curPublic = Service.state.systemConfig?.combatTrackerPublic !== false;
      Service.updateSystemConfig({ combatTrackerPublic: !curPublic });
    });
    this.els.btnPrevTurn?.addEventListener('click', (e) => {
      e.stopPropagation();
      Service.prevCombatTurn();
    });
    this.els.btnToggleAddCombatant?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (Service.state.role !== 'gm') return;
      this.combatAddOpen = !this.combatAddOpen;
      this.renderCombatTracker(Service.state);
    });
    this.els.btnNextTurn.addEventListener('click', (e) => {
      e.stopPropagation();
      Service.nextCombatTurn();
    });
    this.els.btnEndCombat.addEventListener('click', () => {
      this.combatAddOpen = false;
      this.setCombatPopoverOpen?.(false);
      Service.endCombat();
    });

    this.els.rulerShapeSeg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ruler-shape]');
      if (!btn) return;
      Service.state.rulerShape = btn.dataset.rulerShape;
      Service.notify();
    });

    this.els.drawColorRow?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-draw-color]');
      if (!btn) return;
      Service.setDrawColor(btn.dataset.drawColor);
    });

    this.els.btnClearDrawStrokes?.addEventListener('click', () => {
      const cleared = Service.clearStrokes();
      if (cleared > 0) {
        this.showActionToast('🗑 Trazos del marcador borrados');
      }
    });

    this.els.stageLayerSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-stage-layer]');
      if (!btn) return;
      Service.setStageLayer(btn.dataset.stageLayer);
    });

    this.els.btnStageToggleAllLights?.addEventListener('click', () => {
      const lights = Selector.getActiveMapLights(Service.state, { includeDisabled: true });
      if (lights.length === 0) return;
      const anyEnabled = lights.some((l) => l.enabled !== false);
      const count = Service.setAllSceneMapLightsEnabled(!anyEnabled);
      if (count > 0) {
        this.showActionToast(!anyEnabled ? `💡 ${count} luces encendidas` : `🌙 ${count} luces apagadas`);
      }
    });

    this.els.wallDrawToolSeg?.addEventListener('click', (e) => {
      const doorBtn = e.target.closest('[data-wall-mode="door"]');
      if (doorBtn) {
        Service.setWallMode('door');
        return;
      }
      const kindBtn = e.target.closest('[data-wall-kind]');
      if (!kindBtn) return;
      if (Service.state.wallMode !== 'draw') Service.setWallMode('draw');
      Service.applyWallKind(kindBtn.dataset.wallKind);
    });

    this.els.stageSelectFilterSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-select-filter]');
      if (!btn) return;
      Service.setStageSelectFilter(btn.dataset.selectFilter);
    });

    this.els.btnSelectToggleLights?.addEventListener('click', () => {
      const selLightIds = Array.isArray(Service.state.selectedMapLightIds) ? Service.state.selectedMapLightIds : [];
      if (selLightIds.length === 0) return;
      const selSet = new Set(selLightIds);
      const selectedLights = Selector.getActiveMapLights(Service.state, { includeDisabled: true }).filter((l) => selSet.has(l.id));
      const anyEnabled = selectedLights.some((l) => l.enabled !== false);
      const count = Service.setSelectedMapLightsEnabled(!anyEnabled, selLightIds);
      if (count > 0) {
        this.showActionToast(!anyEnabled ? `💡 ${count} luz${count > 1 ? 'ces' : ''} encendida${count > 1 ? 's' : ''}` : `🌙 ${count} luz${count > 1 ? 'ces' : ''} apagada${count > 1 ? 's' : ''}`);
      }
    });

    this.els.btnWallDeleteSelected?.addEventListener('click', () => {
      const res = Service.deleteSelectedScenery();
      if (res.total > 0) {
        if (res.walls > 0 && res.lights === 0) {
          this.showActionToast(res.walls > 1 ? `🗑 ${res.walls} muros eliminados` : '🗑 Muro eliminado');
        } else if (res.lights > 0 && res.walls === 0) {
          this.showActionToast(res.lights > 1 ? `🗑 ${res.lights} luces eliminadas` : '🗑 Luz eliminada');
        } else {
          this.showActionToast(`🗑 ${res.total} elementos eliminados`);
        }
      }
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
    this.els.uiScaleSeg?.querySelectorAll('[data-ui-scale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.setUiScale(btn.dataset.uiScale);
        requestAnimationFrame(() => {
          (this._drawerClearanceUpdaters || []).forEach((fn) => fn());
        });
      });
    });
    this.els.railsSwapSeg?.querySelectorAll('[data-rails-swapped]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.setRailsSwapped(btn.dataset.railsSwapped === 'true');
        requestAnimationFrame(() => {
          (this._drawerClearanceUpdaters || []).forEach((fn) => fn());
        });
      });
    });
    this.els.rngAudioVolume?.addEventListener('input', (e) => {
      const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
      TabletopAudio.setVolume(pct / 100);
      this.syncAudioControlsUi?.();
    });
    this.els.btnToggleAudioMute?.addEventListener('click', () => {
      TabletopAudio.toggleMute();
      this.syncAudioControlsUi?.();
      if (!TabletopAudio.getPrefs().muted) TabletopAudio.playTokenPickup(1);
    });
    this.els.graphicsQualitySeg?.querySelectorAll('[data-graphics-quality]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setGraphicsQuality?.(btn.dataset.graphicsQuality);
      });
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
      if (
        this.els.contextIconMenu?.classList.contains('is-open') &&
        !e.target.closest('#contextIconMenu')
      ) {
        this.hideContextMenu?.();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (e.defaultPrevented) return;
      if (!shouldAllowNativeContextMenu(e.target)) {
        e.preventDefault();
      }
    });

    // 4. Ficha Izquierda Acciones
    this.bindSheetEvents();

    this.bindCompendiumEvents();

    // 6. Bandeja de Dados 3D y Presencia de Mesa
    this.bindPresenceEvents();
    this.bindDiceEvents();
    this.bindModalEvents();
    this.bindTokenEditorEvents();
    this.bindTokenInspectEvents?.();
    this.bindJournalEvents?.();
    this.bindJournalShareEvents?.();
    this.bindJournalPresentationEvents?.();
    this.bindMapGridEditorEvents();
    Service.onBeforeSceneChange = (nextStatePreview) => this.beginSceneDarken?.(nextStatePreview);
  },

  armInitialSceneCurtain() {
    this._lastSceneTransitionSig = '';
    this._pendingTransitionSeq = 0;
    const c = this.els?.sceneTransitionCurtain;
    if (!c) return;
    c.classList.remove('is-title-in', 'is-title-out');
    c.classList.add('is-backdrop-instant', 'is-backdrop-visible');
  },

  applyWorldCameraTransform(state) {
    if (!this.els?.worldLayer || !state?.camera) return;
    const sx = this._cameraShakeOffset?.x || 0;
    const sy = this._cameraShakeOffset?.y || 0;
    const dpr = Math.max(1, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
    const tx = Math.round((state.camera.x + sx) * dpr) / dpr;
    const ty = Math.round((state.camera.y + sy) * dpr) / dpr;
    this.els.worldLayer.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${state.camera.zoom})`;
  },

  /* --------------------------------------------------------------------
     RENDERIZADO DE CAPAS Y PANELES
     -------------------------------------------------------------------- */
  render(state, opts = {}) {
    if (opts.cameraOnly) {
      this.applyWorldCameraTransform(state);
      return;
    }

    if (opts.tokensOnly) {
      if (opts.redrawFog) this.drawFogCanvas(state);
      this.renderTokensLayer(state);
      return;
    }

    document.documentElement.setAttribute('data-theme', state.theme);
    this.applyUiScaleToDom();
    this.applyRailsSwappedToDom();
    this.els.themePopover?.querySelectorAll('[data-theme-pick]').forEach((btn) => {
      btn.classList.toggle('portal-btn-active', btn.dataset.themePick === state.theme);
    });

    // Cámara
    this.applyWorldCameraTransform(state);

    const roleChanged = this._lastFogRole !== state.role;
    if (roleChanged) this._lastFogRole = state.role;
    const themeChanged = this._lastFogTheme !== state.theme;
    if (themeChanged) this._lastFogTheme = state.theme;
    const shouldRedrawFog = Boolean(opts.redrawFog || roleChanged || themeChanged);
    const sceneSig = buildSceneTransitionSignature(state);
    const skipTransition = Boolean(opts.skipSceneTransition);
    const isInitialLoad = !skipTransition && !this._lastSceneTransitionSig;
    const isSceneTransition = !skipTransition && (sceneSig !== this._lastSceneTransitionSig || this._pendingTransitionSeq > 0);
    if (isInitialLoad && this.els.sceneTransitionCurtain) {
      const c = this.els.sceneTransitionCurtain;
      c.classList.add('is-backdrop-instant', 'is-backdrop-visible');
    }

    if (opts.clearExplored) this.clearExploredMemory();
    else if (opts.syncExplored || shouldRedrawFog) this.syncExploredMemoryFromState(state);
    if (opts.redrawMap) this.drawMapCanvas(state);

    if (isSceneTransition) {
      this._lastSceneTransitionSig = sceneSig;
      this.triggerSceneTransition?.(state, { isInitialLoad });
      if (opts.redrawDraw) this.drawStrokesCanvas(state);
    } else {
      if (skipTransition && this._lastSceneTransitionSig) {
        this._lastSceneTransitionSig = sceneSig;
      }
      this.syncSceneAtmosphere?.(state);
      this.drawWallShadowCanvas?.(state);
      if (opts.redrawGrid) this.drawGridCanvas(state);
      if (opts.redrawDraw) this.drawStrokesCanvas(state);
      if (shouldRedrawFog) this.drawFogCanvas(state);
    }

    this.renderHudControls(state);
    this.renderCombatTracker(state);
    this.renderTokensLayer(state);
    this.renderMapNotes(state);
    this.renderMapLights(state);
    this.renderVectorOverlay(state);
    const prevDrawers = this._prevDrawerOpenState || { sheet: true, drawer: true, gmScreen: true, journal: true };
    if (state.sheetOpen || prevDrawers.sheet) this.renderCharacterSheet(state);
    if (state.drawerOpen || prevDrawers.drawer) this.renderCompendium(state);
    if (state.gmScreenOpen || prevDrawers.gmScreen) this.renderGmScreen(state);
    if (state.journalOpen || prevDrawers.journal) this.renderJournal?.(state);
    this._prevDrawerOpenState = {
      sheet: Boolean(state.sheetOpen),
      drawer: Boolean(state.drawerOpen),
      gmScreen: Boolean(state.gmScreenOpen),
      journal: Boolean(state.journalOpen)
    };
    this.renderPublicClocksBar(state);
    this.renderDiceReadout(state);
    this.renderSequenceUI(state);
    this.renderHandoutModal(state);
    this.renderTokenInspectModal?.(state);
    this.renderJournalPresentationModal?.(state);
    if (this.journalShareNoteId) this.renderJournalShareModal?.(state);
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

    const isPlayer = state.role === 'player';
    const isSpectator = Selector.isSpectator(state);
    this.els.btnToggleTokenDrawer?.classList.toggle('hidden', isPlayer);
    this.els.btnToggleGmScreen?.classList.toggle('hidden', isPlayer);
    this.els.btnToggleTokenDrawer?.classList.toggle('portal-btn-active', Boolean(!isPlayer && state.drawerOpen));
    this.els.btnToggleGmScreen?.classList.toggle('portal-btn-active', Boolean(!isPlayer && state.gmScreenOpen));
    this.els.btnOpenDriveModal?.classList.toggle('hidden', isPlayer);
    this.els.btnOptOpenSystem?.classList.toggle('hidden', isPlayer);
    const trackerVisibleToPlayer = Boolean(state.combat?.active) && state.systemConfig?.combatTrackerPublic !== false;
    this.els.btnToggleCombat?.classList.toggle('hidden', isPlayer && !trackerVisibleToPlayer);
    const showQuickNextTurn = !isPlayer && Boolean(state.combat?.active);
    this.els.btnNextTurn?.classList.toggle('hidden', !showQuickNextTurn);
    this.els.btnNextTurn?.classList.toggle('flex', showQuickNextTurn);
    this.els.btnToggleSheet?.classList.toggle('hidden', isSpectator);
    this.els.diceTrayBar?.classList.toggle('hidden', isSpectator);
    this.els.diceTrayBar?.classList.toggle('flex', !isSpectator);

    this.els.roleSwitchGroup?.classList.toggle('hidden', !state.isHostGm);
    this.els.btnRoleGM.classList.toggle('is-active', !isPlayer);
    this.els.btnRolePlayer.classList.toggle('is-active', isPlayer);
    if (this.els.uiScaleSeg) {
      const curScale = Service.uiScale || 'normal';
      this.els.uiScaleSeg.querySelectorAll('[data-ui-scale]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.uiScale === curScale);
      });
    }
    if (this.els.lblUiScalePct) {
      this.els.lblUiScalePct.textContent = `${Math.round((Service.getUiScale?.() || 1) * 100)}%`;
    }
    this.syncAudioControlsUi?.();
    this.syncGraphicsQualityUi?.();
    if (this.els.railsSwapSeg) {
      const swappedStr = Service.railsSwapped ? 'true' : 'false';
      this.els.railsSwapSeg.querySelectorAll('[data-rails-swapped]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.railsSwapped === swappedStr);
      });
    }
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
    if (this.els.drawToolPill) {
      const showDraw = !isPlayer && !isSpectator && state.tool === 'draw';
      this.els.drawToolPill.classList.toggle('hidden', !showDraw);
      this.els.drawToolPill.classList.toggle('flex', showDraw);
      const curColor = state.drawColor || '#ef4444';
      this.els.drawColorRow?.querySelectorAll('[data-draw-color]').forEach((b) => {
        const active = b.dataset.drawColor === curColor;
        b.classList.toggle('border-white', active);
        b.classList.toggle('scale-110', active);
        b.classList.toggle('border-transparent', !active);
      });
      if (this.els.btnClearDrawStrokes) {
        const strokeCount = Array.isArray(state.strokes) ? state.strokes.length : 0;
        this.els.btnClearDrawStrokes.disabled = strokeCount === 0;
      }
    }
    if (this.els.wallModePill) {
      const showWall = !isPlayer && !isSpectator && state.tool === 'wall';
      this.els.wallModePill.classList.toggle('hidden', !showWall);
      this.els.wallModePill.classList.toggle('flex', showWall);
      const stageLayer = state.stageLayer === 'lights' ? 'lights' : state.stageLayer === 'select' ? 'select' : 'walls';
      this.els.stageLayerSeg?.querySelectorAll('[data-stage-layer]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.stageLayer === stageLayer);
      });
      this.els.stageWallsControls?.classList.toggle('hidden', stageLayer !== 'walls');
      this.els.stageWallsControls?.classList.toggle('flex', stageLayer === 'walls');
      this.els.stageLightsControls?.classList.toggle('hidden', stageLayer !== 'lights');
      this.els.stageLightsControls?.classList.toggle('flex', stageLayer === 'lights');
      this.els.stageSelectControls?.classList.toggle('hidden', stageLayer !== 'select');
      this.els.stageSelectControls?.classList.toggle('flex', stageLayer === 'select');

      const sceneLights = Selector.getActiveMapLights(state, { includeDisabled: true });
      if (this.els.lblStageLightsCount) {
        this.els.lblStageLightsCount.textContent =
          sceneLights.length === 1 ? '1 luz' : `${sceneLights.length} luces`;
      }
      if (this.els.btnStageToggleAllLights) {
        const anyEnabled = sceneLights.some((l) => l.enabled !== false);
        this.els.btnStageToggleAllLights.disabled = sceneLights.length === 0;
        this.els.btnStageToggleAllLights.textContent = anyEnabled ? 'Apagar todas' : 'Encender todas';
      }

      const wMode = stageLayer === 'select' ? 'select' : state.wallMode === 'door' ? 'door' : 'draw';
      const drawKind = normalizeWallKind(state.wallDrawKind || 'wall');
      this.els.wallDrawToolSeg?.querySelectorAll('.portal-seg-btn').forEach((b) => {
        const isActive =
          wMode === 'door'
            ? b.dataset.wallMode === 'door'
            : b.dataset.wallKind === drawKind;
        b.classList.toggle('is-active', isActive);
      });

      const selectFilter = state.stageSelectFilter === 'walls' ? 'walls' : state.stageSelectFilter === 'lights' ? 'lights' : 'all';
      this.els.stageSelectFilterSeg?.querySelectorAll('[data-select-filter]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.selectFilter === selectFilter);
      });

      const selWallIds = Array.isArray(state.selectedWallIds) ? state.selectedWallIds : [];
      const selWallSet = new Set(selWallIds);
      const selectedWalls = (state.walls || []).filter((w) => w && selWallSet.has(w.id));
      const selLightIds = Array.isArray(state.selectedMapLightIds) ? state.selectedMapLightIds : [];
      const selLightSet = new Set(selLightIds);
      const selectedLights = sceneLights.filter((l) => l && selLightSet.has(l.id));
      const wallCount = selectedWalls.length;
      const lightCount = selectedLights.length;
      const totalCount = wallCount + lightCount;

      if (this.els.btnSelectToggleLights) {
        const showLightToggle = stageLayer === 'select' && lightCount > 0 && wallCount === 0;
        this.els.btnSelectToggleLights.classList.toggle('hidden', !showLightToggle);
        if (showLightToggle) {
          const anyEnabled = selectedLights.some((l) => l.enabled !== false);
          this.els.btnSelectToggleLights.innerHTML = `${renderUiLineIcon('bulb', 'w-3.5 h-3.5 shrink-0')}<span>${anyEnabled ? 'Apagar' : 'Encender'}</span>`;
        }
      }

      if (this.els.btnWallDeleteSelected) {
        this.els.btnWallDeleteSelected.disabled = totalCount === 0;
      }
      if (this.els.lblWallSelectCount) {
        this.els.lblWallSelectCount.textContent = totalCount > 0 ? `Eliminar (${totalCount})` : 'Eliminar';
      }
    }

    const selTok = Selector.getSelectedToken(state);
    const sheetOpen = Boolean(!isSpectator && state.sheetOpen && selTok && Service.canControlToken(selTok));
    const leftOpen = Boolean(sheetOpen || (!isPlayer && state.gmScreenOpen));
    const rightOpen = Boolean((!isPlayer && state.drawerOpen) || state.journalOpen);

    this.els.btnToggleSheet?.classList.toggle('portal-btn-active', sheetOpen);
    this.els.btnToggleJournal?.classList.toggle('portal-btn-active', Boolean(state.journalOpen));
    if (this.els.lblJournalUnread) {
      const unread = Number(Service.journalUnreadCount) || 0;
      this.els.lblJournalUnread.textContent = String(unread);
      this.els.lblJournalUnread.classList.toggle('hidden', unread <= 0);
    }
    this.els.leftEdgeRail?.classList.toggle('hidden', isSpectator);
    this.els.leftEdgeRail?.classList.toggle('is-hidden-by-drawer', leftOpen);
    this.els.rightEdgeRail?.classList.toggle('is-hidden-by-drawer', rightOpen);

    this.els.characterSheetDrawer.classList.toggle('is-open', sheetOpen);
    this.els.tokenDrawer.classList.toggle('is-open', Boolean(!isPlayer && state.drawerOpen));
    this.els.gmScreenDrawer?.classList.toggle('is-open', Boolean(!isPlayer && state.gmScreenOpen));
    this.els.journalDrawer?.classList.toggle('is-open', Boolean(state.journalOpen));
  },

  _getModalClosers() {
    const els = this.els || {};
    const state = Service.state;
    const modalClosers = [
      [
        () => els.journalShareModal?.classList.contains('is-open') || Boolean(this.journalShareNoteId),
        () => this.closeJournalShareModal?.()
      ],
      [
        () => els.journalPresentationModal?.classList.contains('is-open') || Boolean(state.activeJournalPresentation),
        () => {
          els.journalPresentationModal?.classList.remove('is-open');
          Service.closeJournalPresentation(false);
        }
      ],
      [
        () => els.handoutModal?.classList.contains('is-open') || Boolean(state.activeHandout?.url),
        () => {
          els.handoutModal?.classList.remove('is-open');
          Service.closeHandout(false);
        }
      ],
      [
        () => els.tokenInspectModal?.classList.contains('is-open') || Boolean(state.inspectTokenId),
        () => {
          els.tokenInspectModal?.classList.remove('is-open');
          Service.closeTokenInspection();
        }
      ],
      [
        () => Boolean(els.noteEditorModal && !els.noteEditorModal.classList.contains('hidden')),
        () => this.closeNoteModal?.()
      ],
      [() => els.mapGridModal?.classList.contains('is-open'), () => this.closeMapGridEditor?.()],
      [() => els.tokenEditorModal?.classList.contains('is-open'), () => this.closeTokenEditor?.()]
    ];
    for (const id of ['systemModal', 'roomModal', 'driveModal', 'syncModal']) {
      modalClosers.push([
        () => els[id]?.classList.contains('is-open'),
        () => els[id]?.classList.remove('is-open')
      ]);
    }
    return modalClosers;
  },

  /**
   * Close active UI layers from top to bottom on Escape:
   * 1) blocking modals/presentations, 2) floating popovers/chat/temp tools, 3) side drawers.
   */
  handleEscapeKey() {
    const els = this.els || {};
    const state = Service.state;
    if (this.closePortalSelect?.(true)) {
      return 'popover';
    }
    if (this.customTokenItemsPickerOpen) {
      this.setCustomTokenItemsPickerOpen?.(false);
      return 'popover';
    }
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) && typeof active.blur === 'function') {
      active.blur();
    }

    for (const [isOpen, close] of this._getModalClosers()) {
      if (isOpen()) {
        close();
        return 'modal';
      }
    }

    let closedOverlay = false;
    let needsNotify = false;

    if (els.contextIconMenu?.classList.contains('is-open')) {
      this.hideContextMenu ? this.hideContextMenu() : els.contextIconMenu.classList.remove('is-open');
      closedOverlay = true;
    }
    for (const id of ['optionsPopover', 'themePopover', 'profilePopover', 'playerTokenPickerPopover']) {
      if (els[id]?.classList.contains('is-open')) {
        els[id].classList.remove('is-open');
        closedOverlay = true;
      }
    }
    const controlledOverlays = [
      [els.combatTrackerPopover, (open) => this.setCombatPopoverOpen?.(open)],
      [els.chatDrawer, (open) => this.setChatDrawerOpen?.(open), () => Boolean(Service.chatOpen)],
      [els.diceHistoryPopover, (open) => this.setDiceHistoryOpen?.(open)],
      [els.diceStylePopover, (open) => this.setDicePopoverOpen?.(open)]
    ];
    for (const [el, setter, extraCheck] of controlledOverlays) {
      if (el?.classList.contains('is-open') || extraCheck?.()) {
        setter(false);
        el?.classList.remove('is-open');
        closedOverlay = true;
      }
    }
    if (state.wallAnchor) {
      state.wallAnchor = null;
      closedOverlay = true;
      needsNotify = true;
    }
    if (Array.isArray(state.selectedWallIds) && state.selectedWallIds.length > 0) {
      state.selectedWallIds = [];
      state.wallSelectBox = null;
      closedOverlay = true;
      needsNotify = true;
    }
    if (Array.isArray(state.selectedTokenIds) && state.selectedTokenIds.length > 1) {
      state.selectedTokenIds = state.selectedTokenId ? [state.selectedTokenId] : [];
      state.tokenSelectBox = null;
      closedOverlay = true;
      needsNotify = true;
    }
    if (Array.isArray(state.dice?.hand) && state.dice.hand.length > 0) {
      Service.clearDiceHand();
      closedOverlay = true;
      needsNotify = false;
    }
    if (state.activeSequence || state.tool === 'areaSelect') {
      Service.clearActiveSequence();
      closedOverlay = true;
      needsNotify = false;
    }
    if (closedOverlay) {
      if (needsNotify) Service.notify({ skipVaultSave: true, skipPeerSync: true });
      return 'overlay';
    }

    if (state.sheetOpen || state.gmScreenOpen || state.drawerOpen || state.journalOpen) {
      state.sheetOpen = false;
      state.gmScreenOpen = false;
      state.drawerOpen = false;
      state.journalOpen = false;
      Service._minimizedDrawersSnapshot = null;
      Service.notify({ skipVaultSave: true, skipPeerSync: true });
      return 'drawers';
    }
    return null;
  },

  /**
   * Toggle temporary minimization of side drawers on Space when no modal, chat, or text input is active.
   */
  handleSpaceKey() {
    const els = this.els || {};
    if (this._getModalClosers().some(([isOpen]) => isOpen())) return null;
    if (Service.chatOpen || els.chatDrawer?.classList.contains('is-open')) return null;

    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active && active.tagName === 'BUTTON' && typeof active.blur === 'function') {
      active.blur();
    }
    return Service.toggleDrawersMinimize();
  }
};
