/* ==========================================================================
   VIEW: RENDERIZADO DE LIENZOS, COMPENDIO, FICHA IZQUIERDA Y MENÚ CONTEXTUAL
   ========================================================================== */

import { Dice3DEngine } from '../services/dice3dEngine.js?v=20261113b';
import { RealtimeBridge } from '../services/realtimeBridge.js';
import { Selector } from './selector.js';
import { Service } from './service.js?v=20261115z';
import { BoardViewMethods } from '../ui/boardView.js?v=20261115z';
import { CanvasViewMethods } from '../ui/canvasView.js?v=20261115z';
import { CompendiumViewMethods } from '../ui/compendiumView.js?v=20261115z';
import { ContextMenuViewMethods } from '../ui/contextMenuView.js?v=20261115z';
import { DiceViewMethods } from '../ui/diceView.js?v=20261115z';
import { ModalsViewMethods } from '../ui/modalsView.js?v=20261115z';
import { PortalLobbyViewMethods } from '../ui/portalLobbyView.js?v=20261115z';
import { SheetViewMethods } from '../ui/sheetView.js?v=20261115z';

const ITEM_ICON_DEFS = {
  sword: ['Espada / Ataque', '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>'],
  target: ['Distancia / Mira', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'],
  shield: ['Escudo / Defensa', '<path d="M12 3l7 3v5c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V6l7-3z"/>'],
  wrench: ['Equipo / Herramienta', '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'],
  potion: ['Poción / Químico', '<path d="M9 3h6M10 3v5l-4.5 7.5A3 3 0 0 0 8.1 20h7.8a3 3 0 0 0 2.6-4.5L14 8V3"/><path d="M7.5 14h9" opacity="0.6"/>'],
  heart: ['Curación / Vida', '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'],
  flame: ['Luz / Fuego', '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'],
  sparkle: ['Magia / Poder', '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" opacity="0.7"/>'],
  bolt: ['Rayo / Energía', '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'],
  eye: ['Ojo / Percepción', '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'],
  book: ['Grimorio / Dato', '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'],
  skull: ['Veneno / Letal', '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2M12.5 17l-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>']
};

const TOKEN_STATUS_SYMBOLS = {
  confused: {
    color: '#a855f7',
    path: '<path d="M12 12a2 2 0 1 0-2-2 4 4 0 1 0 4 4 6 6 0 1 0-6-6"/>'
  },
  flame: {
    color: '#f97316',
    path: '<path d="M12 3c.5 2.5 2 4.3 3.5 5.8A5.5 5.5 0 1 1 6.5 13c0-1.6.7-3 1.8-4.2.2 1.2.9 2 1.7 2.2-.3-2.4.5-5 2-8z"/>'
  },
  poison: {
    color: '#10b981',
    path: '<path d="M12 3s5.5 6.2 5.5 10.5a5.5 5.5 0 1 1-11 0C6.5 9.2 12 3 12 3z"/>'
  },
  bolt: {
    color: '#eab308',
    path: '<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/>'
  },
  shield: {
    color: '#3b82f6',
    path: '<path d="M12 3l7 3v5c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V6l7-3z"/>'
  },
  bleed: {
    color: '#ef4444',
    path: '<path d="M12 4v16M4 12h16"/>'
  },
  hidden: {
    color: '#6366f1',
    path: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M4 4l16 16"/>'
  },
  down: {
    color: '#64748b',
    path: '<path d="M12 4v14M6 12l6 6 6-6"/>'
  },
  frost: {
    color: '#06b6d4',
    path: '<path d="M12 2v20M4.9 7l14.2 10M19.1 7L4.9 17"/>'
  },
  mark: {
    color: '#ec4899',
    path: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/>'
  }
};

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

  ...BoardViewMethods,
  ...ContextMenuViewMethods,
  ...CanvasViewMethods,
  ...CompendiumViewMethods,
  ...DiceViewMethods,
  ...ModalsViewMethods,
  ...PortalLobbyViewMethods,
  ...SheetViewMethods,

  getItemCategory(kind) {
    if (kind === 'consumable') return 'consumable';
    if (kind === 'ability' || kind === 'spell') return 'ability';
    return 'equipment';
  },

  getDefaultItemIcon(kind) {
    const cat = this.getItemCategory(kind);
    return cat === 'consumable' ? 'potion' : cat === 'ability' ? 'sparkle' : 'shield';
  },

  renderStatusSymbolSvg(key, sizeClass = 'w-3.5 h-3.5') {
    const def = TOKEN_STATUS_SYMBOLS[key];
    if (!def) return '';
    return `<svg class="${sizeClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${def.path}</svg>`;
  },

  renderItemIconSvg(iconKey, sizeClass = 'w-3.5 h-3.5') {
    const def = ITEM_ICON_DEFS[iconKey] || ITEM_ICON_DEFS.shield;
    return `<svg class="${sizeClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${def[1]}</svg>`;
  },

  renderItemIconBadge(item, opts = {}) {
    const iconKey = item?.icon && ITEM_ICON_DEFS[item.icon] ? item.icon : this.getDefaultItemIcon(item?.kind);
    const color = item?.color || '#8b5cf6';
    if (opts.interactive && item?.uid) {
      return `<button type="button" draggable="false" data-use-inv="${item.uid}" class="owl-item-use-btn w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="--item-color:${color}; background:${color}22; color:${color}; border-color:${color}55;" title="Usar / Tirar ${item.name || ''}" aria-label="Usar ${item.name || 'objeto'}">${this.renderItemIconSvg(iconKey)}</button>`;
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

    RealtimeBridge.connect(Service.state.room.code, (msg) => this.handleRealtimeMessage(msg));
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
    } else if (msg.kind === 'PRESENCE_PING') {
      Service.updatePeerPresence(msg);
    } else if (msg.kind === 'PRESENCE_BYE') {
      Service.updatePeerPresence({ ...msg, leaving: true });
    }
  },

  cacheElements() {
    this.els = {
      stage: document.getElementById('vttStage'),
      worldLayer: document.getElementById('worldTransformLayer'),
      mapCanvas: document.getElementById('mapCanvas'),
      customMapImg: document.getElementById('customMapImg'),
      gridCanvas: document.getElementById('gridCanvas'),
      drawCanvas: document.getElementById('drawCanvas'),
      tokensLayer: document.getElementById('tokensLayer'),
      fogCanvas: document.getElementById('fogCanvas'),
      overlayVectorSvg: document.getElementById('overlayVectorSvg'),
      dropModuleOverlay: document.getElementById('dropModuleOverlay'),

      // Barra superior
      btnOpenRoomModal: document.getElementById('btnOpenRoomModal'),
      roomPresenceList: document.getElementById('roomPresenceList'),
      handoutShareBox: document.getElementById('handoutShareBox'),
      inpHandoutFile: document.getElementById('inpHandoutFile'),
      inpHandoutTitle: document.getElementById('inpHandoutTitle'),
      inpHandoutUrl: document.getElementById('inpHandoutUrl'),
      btnShowHandout: document.getElementById('btnShowHandout'),
      handoutModal: document.getElementById('handoutModal'),
      handoutModalTitle: document.getElementById('handoutModalTitle'),
      handoutModalImg: document.getElementById('handoutModalImg'),
      btnCloseHandout: document.getElementById('btnCloseHandout'),
      btnClearHandoutForAll: document.getElementById('btnClearHandoutForAll'),
      lblActiveRoomCode: document.getElementById('lblActiveRoomCode'),
      mapSelector: document.getElementById('mapSelector'),
      shelfDropdownGroup: document.getElementById('shelfDropdownGroup'),
      btnToggleGridPopover: document.getElementById('btnToggleGridPopover'),
      gridPopover: document.getElementById('gridPopover'),
      lblGridSizeDetail: document.getElementById('lblGridSizeDetail'),
      btnGridSizeMinus: document.getElementById('btnGridSizeMinus'),
      inpGridSize: document.getElementById('inpGridSize'),
      btnGridSizePlus: document.getElementById('btnGridSizePlus'),
      btnGridResetOffset: document.getElementById('btnGridResetOffset'),
      btnGridOffXMinus: document.getElementById('btnGridOffXMinus'),
      inpGridOffX: document.getElementById('inpGridOffX'),
      btnGridOffXPlus: document.getElementById('btnGridOffXPlus'),
      btnGridOffYMinus: document.getElementById('btnGridOffYMinus'),
      inpGridOffY: document.getElementById('inpGridOffY'),
      btnGridOffYPlus: document.getElementById('btnGridOffYPlus'),
      inpGridCols: document.getElementById('inpGridCols'),
      inpGridRows: document.getElementById('inpGridRows'),
      btnFitGridToMap: document.getElementById('btnFitGridToMap'),
      lblGridOpacity: document.getElementById('lblGridOpacity'),
      rngGridOpacity: document.getElementById('rngGridOpacity'),
      chkGridSnap: document.getElementById('chkGridSnap'),
      btnRoleGM: document.getElementById('btnRoleGM'),
      btnRolePlayer: document.getElementById('btnRolePlayer'),
      btnToggleSheet: document.getElementById('btnToggleSheet'),
      btnToggleCombat: document.getElementById('btnToggleCombat'),
      btnOpenDriveModal: document.getElementById('btnOpenDriveModal'),
      btnToggleTokenDrawer: document.getElementById('btnToggleTokenDrawer'),
      lblActiveTokensCount: document.getElementById('lblActiveTokensCount'),
      btnOpenSyncModal: document.getElementById('btnOpenSyncModal'),
      lblSyncBadge: document.getElementById('lblSyncBadge'),
      btnToggleTheme: document.getElementById('btnToggleTheme'),
      themePopover: document.getElementById('themePopover'),
      btnOpenOptions: document.getElementById('btnOpenOptions'),
      optionsPopover: document.getElementById('optionsPopover'),
      btnOptReturnLobby: document.getElementById('btnOptReturnLobby'),
      btnOptOpenRoom: document.getElementById('btnOptOpenRoom'),
      btnOptOpenSync: document.getElementById('btnOptOpenSync'),

      // Ficha Izquierda
      characterSheetDrawer: document.getElementById('characterSheetDrawer'),
      sheetPortraitBox: document.getElementById('sheetPortraitBox'),
      inpSheetName: document.getElementById('inpSheetName'),
      inpSheetRole: document.getElementById('inpSheetRole'),
      btnCloseSheet: document.getElementById('btnCloseSheet'),
      lblSheetHpCur: document.getElementById('lblSheetHpCur'),
      inpSheetMaxHp: document.getElementById('inpSheetMaxHp'),
      btnSheetHpMinus: document.getElementById('btnSheetHpMinus'),
      barSheetHpFill: document.getElementById('barSheetHpFill'),
      btnSheetHpPlus: document.getElementById('btnSheetHpPlus'),
      inpSheetAc: document.getElementById('inpSheetAc'),
      inpSheetLevel: document.getElementById('inpSheetLevel'),
      lblSheetPb: document.getElementById('lblSheetPb'),
      inpSheetSpeed: document.getElementById('inpSheetSpeed'),
      btnSheetRollInit: document.getElementById('btnSheetRollInit'),
      sheetTopTabs: document.getElementById('sheetTopTabs'),
      sheetPaneAttrs: document.getElementById('sheetPaneAttrs'),
      sheetPaneSkills: document.getElementById('sheetPaneSkills'),
      sheetPaneTraits: document.getElementById('sheetPaneTraits'),
      sheetPaneInv: document.getElementById('sheetPaneInv'),
      sheetStatsGrid: document.getElementById('sheetStatsGrid'),
      btnToggleSkillForm: document.getElementById('btnToggleSkillForm'),
      sheetSkillForm: document.getElementById('sheetSkillForm'),
      inpSheetSkillName: document.getElementById('inpSheetSkillName'),
      inpSheetSkillMod: document.getElementById('inpSheetSkillMod'),
      btnLoadDnd55Skills: document.getElementById('btnLoadDnd55Skills'),
      sheetSkillsList: document.getElementById('sheetSkillsList'),
      btnToggleTraitForm: document.getElementById('btnToggleTraitForm'),
      sheetTraitForm: document.getElementById('sheetTraitForm'),
      inpSheetTraitTitle: document.getElementById('inpSheetTraitTitle'),
      inpSheetTraitDesc: document.getElementById('inpSheetTraitDesc'),
      sheetTraitsList: document.getElementById('sheetTraitsList'),
      sheetInventoryDropzone: document.getElementById('sheetInventoryDropzone'),
      sheetInventoryList: document.getElementById('sheetInventoryList'),

      // Compendio Derecho
      tokenDrawer: document.getElementById('tokenDrawer'),
      btnNewCompendiumFolder: document.getElementById('btnNewCompendiumFolder'),
      btnToggleCustomToken: document.getElementById('btnToggleCustomToken'),
      btnCancelCustomToken: document.getElementById('btnCancelCustomToken'),
      btnCloseTokenDrawer: document.getElementById('btnCloseTokenDrawer'),
      compendiumTabs: document.getElementById('compendiumTabs'),
      inpCompendiumSearch: document.getElementById('inpCompendiumSearch'),
      compendiumFolderList: document.getElementById('compendiumFolderList'),
      compendiumFolderForm: document.getElementById('compendiumFolderForm'),
      inpNewFolderName: document.getElementById('inpNewFolderName'),
      tokenTemplatesGrid: document.getElementById('tokenTemplatesGrid'),
      customTokenForm: document.getElementById('customTokenForm'),
      inpCustomTokenName: document.getElementById('inpCustomTokenName'),
      inpCustomTokenRole: document.getElementById('inpCustomTokenRole'),
      inpCustomTokenHp: document.getElementById('inpCustomTokenHp'),
      inpCustomTokenAc: document.getElementById('inpCustomTokenAc'),
      selCustomTokenAlly: document.getElementById('selCustomTokenAlly'),
      inpCustomStr: document.getElementById('inpCustomStr'),
      inpCustomDex: document.getElementById('inpCustomDex'),
      inpCustomCon: document.getElementById('inpCustomCon'),
      inpCustomInt: document.getElementById('inpCustomInt'),
      inpCustomWis: document.getElementById('inpCustomWis'),
      inpCustomCha: document.getElementById('inpCustomCha'),
      inpCustomTokenImg: document.getElementById('inpCustomTokenImg'),
      fileCustomTokenImg: document.getElementById('fileCustomTokenImg'),
      inpCustomTokenFolder: document.getElementById('inpCustomTokenFolder'),
      customTokenColorGrid: document.getElementById('customTokenColorGrid'),
      customItemForm: document.getElementById('customItemForm'),
      btnCancelCustomItem: document.getElementById('btnCancelCustomItem'),
      inpCustomItemName: document.getElementById('inpCustomItemName'),
      selCustomItemKind: document.getElementById('selCustomItemKind'),
      customItemValWrap: document.getElementById('customItemValWrap'),
      lblCustomItemVal: document.getElementById('lblCustomItemVal'),
      inpCustomItemVal: document.getElementById('inpCustomItemVal'),
      selCustomItemTarget: document.getElementById('selCustomItemTarget'),
      customItemIconGrid: document.getElementById('customItemIconGrid'),
      customItemFormulaBuilder: document.getElementById('customItemFormulaBuilder'),
      formulaChipsPreview: document.getElementById('formulaChipsPreview'),
      btnClearFormulaChips: document.getElementById('btnClearFormulaChips'),
      inpCustomItemMsg: document.getElementById('inpCustomItemMsg'),
      inpCustomItemFolder: document.getElementById('inpCustomItemFolder'),
      customItemColorGrid: document.getElementById('customItemColorGrid'),
      customMapForm: document.getElementById('customMapForm'),
      lblCustomMapFormTitle: document.getElementById('lblCustomMapFormTitle'),
      btnCancelCustomMap: document.getElementById('btnCancelCustomMap'),
      inpCustomMapName: document.getElementById('inpCustomMapName'),
      inpCustomMapImg: document.getElementById('inpCustomMapImg'),
      fileCustomMapImg: document.getElementById('fileCustomMapImg'),
      inpCustomMapDesc: document.getElementById('inpCustomMapDesc'),
      inpCustomMapFolder: document.getElementById('inpCustomMapFolder'),

      // Combate, Regla, Notas
      mapNotesLayer: document.getElementById('mapNotesLayer'),
      combatTrackerPill: document.getElementById('combatTrackerPill'),
      lblCombatRound: document.getElementById('lblCombatRound'),
      combatOrderList: document.getElementById('combatOrderList'),
      btnNextTurn: document.getElementById('btnNextTurn'),
      btnEndCombat: document.getElementById('btnEndCombat'),
      rulerShapePill: document.getElementById('rulerShapePill'),
      rulerShapeSeg: document.getElementById('rulerShapeSeg'),
      noteEditorModal: document.getElementById('noteEditorModal'),
      noteEditorForm: document.getElementById('noteEditorForm'),
      btnCloseNoteModal: document.getElementById('btnCloseNoteModal'),
      inpNoteTitle: document.getElementById('inpNoteTitle'),
      inpNoteBody: document.getElementById('inpNoteBody'),
      chkNoteGmOnly: document.getElementById('chkNoteGmOnly'),
      btnDeleteNote: document.getElementById('btnDeleteNote'),

      // Dados 3D
      dice3dOverlay: document.getElementById('dice3dOverlay'),
      dice3dCanvas: document.getElementById('dice3dCanvas'),
      lblDiceFormula: document.getElementById('lblDiceFormula'),
      lblDiceBadge: document.getElementById('lblDiceBadge'),
      lblDiceTotal: document.getElementById('lblDiceTotal'),
      diceRollChips: document.getElementById('diceRollChips'),
      lblDiceMessage: document.getElementById('lblDiceMessage'),
      lblDiceDetail: document.getElementById('lblDiceDetail'),
      diceRollActions: document.getElementById('diceRollActions'),
      btnDiceApplyDmg: document.getElementById('btnDiceApplyDmg'),
      btnDiceApplyHalfDmg: document.getElementById('btnDiceApplyHalfDmg'),
      btnDiceApplyHeal: document.getElementById('btnDiceApplyHeal'),
      btnCloseDice3d: document.getElementById('btnCloseDice3d'),
      diceTrayBar: document.getElementById('diceTrayBar'),
      btnDiceModMinus: document.getElementById('btnDiceModMinus'),
      lblDiceMod: document.getElementById('lblDiceMod'),
      btnDiceModPlus: document.getElementById('btnDiceModPlus'),
      diceResultSeg: document.getElementById('diceResultSeg'),
      diceVisibilitySeg: document.getElementById('diceVisibilitySeg'),
      diceHandCursor: document.getElementById('diceHandCursor'),
      lblDiceHandCount: document.getElementById('lblDiceHandCount'),
      btnDiceCustomize: document.getElementById('btnDiceCustomize'),
      diceStyleDot: document.getElementById('diceStyleDot'),
      diceStylePopover: document.getElementById('diceStylePopover'),
      btnDiceHistory: document.getElementById('btnDiceHistory'),
      diceHistoryPopover: document.getElementById('diceHistoryPopover'),
      btnClearDiceHistory: document.getElementById('btnClearDiceHistory'),
      btnCloseDiceHistory: document.getElementById('btnCloseDiceHistory'),
      diceHistoryList: document.getElementById('diceHistoryList'),
      dicePreviewCanvas: document.getElementById('dicePreviewCanvas'),
      btnCloseDiceStyle: document.getElementById('btnCloseDiceStyle'),
      btnResetDiceStyle: document.getElementById('btnResetDiceStyle'),
      inpDiceBodyColor: document.getElementById('inpDiceBodyColor'),
      inpDiceBevelColor: document.getElementById('inpDiceBevelColor'),
      inpDiceNumberColor: document.getElementById('inpDiceNumberColor'),
      inpDiceCustomSymbol: document.getElementById('inpDiceCustomSymbol'),

      // Menú Contextual Clic Derecho
      contextIconMenu: document.getElementById('contextIconMenu'),
      contextTokenHeader: document.getElementById('contextTokenHeader'),
      contextToolsRow: document.getElementById('contextToolsRow'),
      contextDynamicRow: document.getElementById('contextDynamicRow'),
      contextSubOptionsRow: document.getElementById('contextSubOptionsRow'),
      vttActionToast: document.getElementById('vttActionToast'),

      // Modales
      roomModal: document.getElementById('roomModal'),
      btnCloseRoomModal: document.getElementById('btnCloseRoomModal'),
      roomToastBox: document.getElementById('roomToastBox'),
      btnCreateNewRoom: document.getElementById('btnCreateNewRoom'),
      lblModalRoomCode: document.getElementById('lblModalRoomCode'),
      lblModalRoomRole: document.getElementById('lblModalRoomRole'),
      inpPlayerInviteUrl: document.getElementById('inpPlayerInviteUrl'),
      btnCopyPlayerUrl: document.getElementById('btnCopyPlayerUrl'),
      inpGmInviteUrl: document.getElementById('inpGmInviteUrl'),
      btnCopyGmUrl: document.getElementById('btnCopyGmUrl'),
      joinRoomForm: document.getElementById('joinRoomForm'),
      inpJoinRoomCode: document.getElementById('inpJoinRoomCode'),
      inpLocalMapWebp: document.getElementById('inpLocalMapWebp'),
      inpModuleTitle: document.getElementById('inpModuleTitle'),
      btnExportModule: document.getElementById('btnExportModule'),
      inpModuleFile: document.getElementById('inpModuleFile'),
      addShelfModuleForm: document.getElementById('addShelfModuleForm'),
      inpShelfTitle: document.getElementById('inpShelfTitle'),
      inpShelfUrl: document.getElementById('inpShelfUrl'),
      shelfModulesList: document.getElementById('shelfModulesList'),
      btnResetVaultStep1: document.getElementById('btnResetVaultStep1'),
      btnResetVaultConfirm: document.getElementById('btnResetVaultConfirm'),

      driveModal: document.getElementById('driveModal'),
      btnCloseDriveModal: document.getElementById('btnCloseDriveModal'),
      inpDriveMapUrl: document.getElementById('inpDriveMapUrl'),
      btnApplyDriveMap: document.getElementById('btnApplyDriveMap'),
      inpDriveFolderUrl: document.getElementById('inpDriveFolderUrl'),
      btnEmbedDriveFolder: document.getElementById('btnEmbedDriveFolder'),
      driveFolderIframe: document.getElementById('driveFolderIframe'),

      syncModal: document.getElementById('syncModal'),
      btnCloseSyncModal: document.getElementById('btnCloseSyncModal'),
      lblSyncRoomName: document.getElementById('lblSyncRoomName'),
      btnBroadcastFullNow: document.getElementById('btnBroadcastFullNow'),
      lblEventQueueCount: document.getElementById('lblEventQueueCount'),
      btnCompactEvents: document.getElementById('btnCompactEvents'),
      eventLogPreviewList: document.getElementById('eventLogPreviewList'),

      portalLobby: document.getElementById('portalLobby'),
      btnBrandLobby: document.getElementById('btnBrandLobby'),
      createPortalForm: document.getElementById('createPortalForm'),
      inpPortalName: document.getElementById('inpPortalName'),
      selPortalRuleset: document.getElementById('selPortalRuleset'),
      selPortalMap: document.getElementById('selPortalMap'),
      chkPortalDynLight: document.getElementById('chkPortalDynLight'),
      chkPortalGrid: document.getElementById('chkPortalGrid'),
      inpLobbyCartridgeFile: document.getElementById('inpLobbyCartridgeFile'),
      joinPortalForm: document.getElementById('joinPortalForm'),
      inpJoinPortalCode: document.getElementById('inpJoinPortalCode'),
      selJoinPortalRole: document.getElementById('selJoinPortalRole'),
      recentPortalsList: document.getElementById('recentPortalsList')
    };
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

    this.bindDrawerResize(this.els.characterSheetDrawer, 'left', 'owl_sheet_width');
    this.bindDrawerResize(this.els.tokenDrawer, 'right', 'owl_compendium_width');

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
      btn.classList.toggle('owl-btn-active', btn.dataset.themePick === state.theme);
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
    this.renderHandoutModal(state);
  },

  renderHudControls(state) {
    this.els.lblActiveRoomCode.textContent = state.room.code;
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

    this.els.btnRoleGM.classList.toggle('is-active', state.role === 'gm');
    this.els.btnRolePlayer.classList.toggle('is-active', state.role === 'player');
    if (this.els.btnToggleCombat) {
      this.els.btnToggleCombat.classList.toggle('owl-btn-active', Boolean(state.combat?.active));
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

    this.els.characterSheetDrawer.classList.toggle('is-open', Boolean(state.sheetOpen && Selector.getSelectedToken(state)));
    this.els.tokenDrawer.classList.toggle('is-open', Boolean(state.drawerOpen));
  },

  renderCombatTracker(state) {
    const pill = this.els.combatTrackerPill;
    if (!pill) return;
    const c = state.combat;
    if (!c || !c.active) {
      pill.classList.add('hidden');
      pill.classList.remove('flex');
      return;
    }
    pill.classList.remove('hidden');
    pill.classList.add('flex');
    this.els.lblCombatRound.textContent = `Ronda ${c.round || 1}`;
    const tokensById = new Map((state.tokens || []).map((t) => [t.id, t]));
    const activeEntry = c.order[c.turnIndex];
    this.els.combatOrderList.innerHTML = c.order
      .map((entry) => {
        const tok = tokensById.get(entry.tokenId);
        if (!tok) return '';
        const isTurn = activeEntry && activeEntry.tokenId === entry.tokenId;
        return `
          <button
            type="button"
            data-combat-tok="${tok.id}"
            class="owl-seg-btn px-2 py-1 rounded-full flex items-center gap-1.5 text-[11px] whitespace-nowrap ${isTurn ? 'is-active' : ''}"
            title="${tok.name} · Iniciativa ${entry.init}"
          >
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${tok.color};"></span>
            <span class="font-semibold max-w-[76px] truncate">${tok.name}</span>
            <span class="opacity-65 tabular-nums">${entry.init}</span>
          </button>
        `;
      })
      .join('');
    this.els.combatOrderList.querySelectorAll('[data-combat-tok]').forEach((btn) => {
      btn.addEventListener('click', () => Service.selectToken(btn.dataset.combatTok, true));
    });
  }
};
