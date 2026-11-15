/* ==========================================================================
   VIEW: RENDERIZADO DE LIENZOS, COMPENDIO, FICHA IZQUIERDA Y MENÚ CONTEXTUAL
   ========================================================================== */

import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS, COMPENDIUM_MAPS } from '../data/compendium.js';
import { BrowserVault } from '../services/browserVault.js';
import { CartridgePacker } from '../services/cartridgePacker.js';
import { Dice3DEngine } from '../services/dice3dEngine.js?v=20261113b';
import { RealtimeBridge } from '../services/realtimeBridge.js';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { WebPConverter } from '../utils/webpConverter.js?v=20261114m';
import { createInitialState, generateRoomCode } from './model.js';
import { Selector } from './selector.js';
import { Service } from './service.js?v=20261115m';
import { CanvasViewMethods } from '../ui/canvasView.js?v=20261115m';
import { CompendiumViewMethods } from '../ui/compendiumView.js?v=20261115m';
import { DiceViewMethods } from '../ui/diceView.js?v=20261115m';
import { SheetViewMethods } from '../ui/sheetView.js?v=20261115m';

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

  ...CanvasViewMethods,
  ...CompendiumViewMethods,
  ...DiceViewMethods,
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

  renderItemIconBadge(item) {
    const iconKey = item?.icon && ITEM_ICON_DEFS[item.icon] ? item.icon : this.getDefaultItemIcon(item?.kind);
    const color = item?.color || '#8b5cf6';
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
      eventLogPreviewList: document.getElementById('eventLogPreviewList')
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
    // 1. Interacciones de puntero en el escenario (Arrastre fichas, cámara, regla, dibujo, niebla, clic derecho)
    let activePointerMode = null; // 'token' | 'pan' | 'rightPan' | 'ruler' | 'draw' | 'fog'
    let draggingTokenId = null;
    let startClient = { x: 0, y: 0 };
    let startCam = { x: 0, y: 0 };
    let movedDistance = 0;
    let currentStroke = null;

    this.els.stage.addEventListener('pointerdown', (e) => {
      this.hideContextMenu();
      if (e.target.closest('.owl-panel')) return;

      // Si hay dados recogidos en mano, clic izquierdo sobre la mesa los lanza hacia ese punto
      if (e.button === 0 && Array.isArray(Service.state.dice.hand) && Service.state.dice.hand.length > 0) {
        Service.throwDiceHand(e.clientX, e.clientY);
        return;
      }

      startClient = { x: e.clientX, y: e.clientY };
      startCam = { x: Service.state.camera.x, y: Service.state.camera.y };
      movedDistance = 0;

      // Clic derecho -> preparar paneo o menú contextual
      if (e.button === 2) {
        activePointerMode = 'rightPan';
        if (e.target.closest('[data-map-note]')) return;
      const tokEl = e.target.closest('[data-token-id]');
        this.ctxTargetTokenId = tokEl ? tokEl.dataset.tokenId : null;
        this.ctxWorldPos = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
        return;
      }

      // Botón central -> paneo
      if (e.button === 1) {
        activePointerMode = 'pan';
        return;
      }

      if (e.target.closest('[data-map-note]')) return;
      const tokEl = e.target.closest('[data-token-id]');
      const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
      const tool = Service.state.tool;

      // Clic sobre puerta interactiva abre/cierra el paso de luz
      if (tool !== 'wall' && tool !== 'ruler' && tool !== 'draw') {
        const nearDoor = Selector.findDoorNearPoint(Service.state, worldPt.x, worldPt.y, 20);
        if (nearDoor && !tokEl) {
          const updated = Service.toggleDoor(nearDoor.id);
          if (updated) this.showActionToast(updated.open ? '🚪 Puerta abierta' : '🚪 Puerta cerrada');
          return;
        }
      }

      if (tokEl && (tool === 'select' || tool === 'pan')) {
        const tok = Service.state.tokens.find((t) => t.id === tokEl.dataset.tokenId);
        Service.selectToken(tokEl.dataset.tokenId, true);
        if (!Service.canControlToken(tok)) {
          this.showActionToast('Solo el DJ o su dueño puede mover esta ficha.');
          return;
        }
        Service.pushUndoSnapshot();
        activePointerMode = 'token';
        draggingTokenId = tokEl.dataset.tokenId;
        this.draggingTokenId = draggingTokenId;
        try {
          if (this.els.stage.isConnected) this.els.stage.setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
      }

      if (tool === 'wall') {
        const cs = Service.state.grid.cellSize / 2;
        const sx = Math.round(worldPt.x / cs) * cs;
        const sy = Math.round(worldPt.y / cs) * cs;
        if (!Service.state.wallAnchor) {
          Service.state.wallAnchor = { x: sx, y: sy };
          Service.notify();
        } else {
          Service.addWallSegment(
            Service.state.wallAnchor.x,
            Service.state.wallAnchor.y,
            sx,
            sy,
            Service.state.wallType
          );
          Service.state.wallAnchor = null;
          Service.notify();
        }
        return;
      }

      if (tool === 'ruler') {
        activePointerMode = 'ruler';
        Service.state.ruler = { x1: worldPt.x, y1: worldPt.y, x2: worldPt.x, y2: worldPt.y };
        Service.notify();
        return;
      }

      if (tool === 'draw') {
        Service.pushUndoSnapshot();
        activePointerMode = 'draw';
        currentStroke = { color: Service.state.drawColor, points: [worldPt] };
        Service.state.strokes.push(currentStroke);
        Service.notify({ redrawDraw: true, skipVaultSave: true });
        return;
      }

      if (tool === 'fog') {
        Service.pushUndoSnapshot();
        activePointerMode = 'fog';
        Service.state.fogRects.push({ x: worldPt.x, y: worldPt.y, r: 90, mode: Service.state.fogMode });
        Service.notify({ redrawFog: true, skipVaultSave: true });
        return;
      }

      if (tool === 'ping') {
        Service.triggerPing(worldPt.x, worldPt.y);
        return;
      }

      // Clic en vacío -> mover cámara
      activePointerMode = 'pan';
    });

    window.addEventListener('pointermove', (e) => {
      const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
      this.hoverWorldPos = worldPt;

      if (Service.state.tool === 'wall' && Service.state.wallAnchor) {
        this.renderVectorOverlay(Service.state);
      }

      if (!activePointerMode) return;
      const dx = e.clientX - startClient.x;
      const dy = e.clientY - startClient.y;
      movedDistance = Math.hypot(dx, dy);

      if (activePointerMode === 'pan' || (activePointerMode === 'rightPan' && movedDistance > 6)) {
        Service.state.camera.x = startCam.x + dx;
        Service.state.camera.y = startCam.y + dy;
        Service.notify({ skipVaultSave: true });
        return;
      }

      if (activePointerMode === 'token' && draggingTokenId) {
        Service.moveToken(draggingTokenId, worldPt.x, worldPt.y, false);
        this.drawFogCanvas(Service.state);
      } else if (activePointerMode === 'ruler' && Service.state.ruler) {
        Service.state.ruler.x2 = worldPt.x;
        Service.state.ruler.y2 = worldPt.y;
        Service.notify({ skipVaultSave: true });
      } else if (activePointerMode === 'draw' && currentStroke) {
        currentStroke.points.push(worldPt);
        Service.notify({ redrawDraw: true, skipVaultSave: true });
      } else if (activePointerMode === 'fog') {
        Service.state.fogRects.push({ x: worldPt.x, y: worldPt.y, r: 90, mode: Service.state.fogMode });
        Service.notify({ redrawFog: true, skipVaultSave: true });
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!activePointerMode) return;
      try {
        if (this.els.stage.hasPointerCapture && this.els.stage.hasPointerCapture(e.pointerId)) {
          this.els.stage.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}

      if (activePointerMode === 'token' && draggingTokenId) {
        const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
        this.draggingTokenId = null;
        Service.moveToken(draggingTokenId, worldPt.x, worldPt.y, true);
        this.drawFogCanvas(Service.state);
      } else if (activePointerMode === 'ruler') {
        Service.state.ruler = null;
        Service.notify({ skipVaultSave: true });
      } else if (activePointerMode === 'draw') {
        Service.recordEvent('TRAZO', 'Marcador táctico');
        Service.notify({ redrawDraw: true });
      } else if (activePointerMode === 'fog') {
        Service.recordEvent('NIEBLA', Service.state.fogMode);
        Service.notify({ redrawFog: true });
      }

      activePointerMode = null;
      draggingTokenId = null;
      currentStroke = null;
    });

    // Menú Contextual de Iconos al Clic Derecho (si no hubo arrastre de cámara)
    this.els.stage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (movedDistance > 6) return;
      if (Service.clearDiceHand()) return;
      this.openContextMenu(e.clientX, e.clientY);
    });

    // Zoom con rueda del ratón
    this.els.stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        Service.setZoom(Service.state.camera.zoom * factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    // 2. Drag & Drop Global sobre el tablero (Cartuchos .owltable, Imágenes WebP y Elementos del Compendio)
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        this.els.dropModuleOverlay.classList.remove('hidden');
      }
    });

    window.addEventListener('dragleave', (e) => {
      if (e.clientX === 0 && e.clientY === 0) {
        this.els.dropModuleOverlay.classList.add('hidden');
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.els.dropModuleOverlay.classList.add('hidden');

      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && /\.(owltable|zip|json)$/i.test(file.name)) {
        try {
          const buffer = await file.arrayBuffer();
          const parsed = await CartridgePacker.parseCartridgeBuffer(buffer);
          await Service.loadModulePackage(parsed);
          this.showActionToast(`Cartucho "${Service.state.room.moduleTitle}" desplegado.`);
        } catch (err) {
          this.showActionToast(err.message || 'Error al abrir cartucho.');
        }
        return;
      }

      if (file && file.type && file.type.startsWith('image/')) {
        try {
          const webpUrl = await WebPConverter.fileToWebPDataUrl(file, 3840, 0.82);
          Service.loadExternalMapImage(webpUrl);
          await Service.changeMap('custom', webpUrl);
          this.showActionToast(`Mapa "${file.name}" optimizado a WebP.`);
        } catch (err) {
          this.showActionToast(err.message || 'Error al procesar imagen WebP.');
        }
        return;
      }

      // Arrastrar desde el Compendio Derecho
      const dragSpec = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
      if (!dragSpec) return;

      const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
      if (dragSpec.startsWith('actor:')) {
        const key = dragSpec.replace('actor:', '');
        const allActors = [...(Service.state.customActors || []), ...COMPENDIUM_ACTORS];
        const tpl = allActors.find((a) => a.key === key);
        if (tpl) {
          await Service.spawnActorFromTemplate(tpl, worldPt.x, worldPt.y);
          this.showActionToast(`${tpl.name} desplegado en el tablero.`);
        }
      } else if (dragSpec.startsWith('map:')) {
        const key = dragSpec.replace('map:', '');
        const allMaps = [...(Service.state.customMaps || []), ...COMPENDIUM_MAPS];
        const mapTpl = allMaps.find((m) => m.key === key);
        await Service.activateMapTemplate(mapTpl || { key });
        this.showActionToast('Escenario cambiado.');
      } else if (dragSpec.startsWith('item:')) {
        const key = dragSpec.replace('item:', '');
        const allItems = [...(Service.state.customItems || []), ...COMPENDIUM_ITEMS];
        const itemTpl = allItems.find((i) => i.key === key);
        if (e.target.closest('[data-map-note]')) return;
      const tokEl = e.target.closest('[data-token-id]');
        const targetId = tokEl ? tokEl.dataset.tokenId : Service.state.selectedTokenId;
        if (itemTpl && targetId) {
          this.activeSheetTab = this.getItemCategory(itemTpl.kind);
          const res = Service.equipItemToToken(targetId, itemTpl);
          if (res) this.showActionToast(`${itemTpl.name} equipado en ${res.token.name}.`);
        }
      }
    });

    // Dropzone directa en la Ficha Izquierda
    this.els.sheetInventoryDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.els.sheetInventoryDropzone.classList.add('sheet-drop-active');
    });
    this.els.sheetInventoryDropzone.addEventListener('dragleave', () => {
      this.els.sheetInventoryDropzone.classList.remove('sheet-drop-active');
    });
    this.els.sheetInventoryDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.els.sheetInventoryDropzone.classList.remove('sheet-drop-active');
      const dragSpec = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
      if (dragSpec.startsWith('item:') && Service.state.selectedTokenId) {
        const key = dragSpec.replace('item:', '');
        const allItems = [...(Service.state.customItems || []), ...COMPENDIUM_ITEMS];
        const itemTpl = allItems.find((i) => i.key === key);
        if (itemTpl) {
          this.activeSheetTab = this.getItemCategory(itemTpl.kind);
          const res = Service.equipItemToToken(Service.state.selectedTokenId, itemTpl);
          if (res) this.showActionToast(`${itemTpl.name} equipado en ${res.token.name}.`);
        }
      }
    });

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
      this.els.themePopover?.classList.toggle('is-open');
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
    });

    // 4. Ficha Izquierda Acciones
    this.bindSheetEvents();

    this.bindCompendiumEvents();

    // 6. Bandeja de Dados 3D
    this.bindDiceEvents();
    // 7. Menú Contextual de Iconos
    this.els.contextIconMenu.addEventListener('click', (e) => {
      const toolBtn = e.target.closest('[data-ctx-tool]');
      if (toolBtn) {
        Service.setTool(toolBtn.dataset.ctxTool);
        this.openContextMenu(
          parseFloat(this.els.contextIconMenu.style.left),
          parseFloat(this.els.contextIconMenu.style.top)
        );
      }
    });

    // 8. Modal Salas, Cartuchos .owltable y Estantería Solo Lectura
    this.els.btnOpenRoomModal.addEventListener('click', () => {
      this.els.roomModal.classList.add('is-open');
      this.renderRoomModal(Service.state);
    });
    this.els.btnCloseRoomModal.addEventListener('click', () => {
      this.els.roomModal.classList.remove('is-open');
    });

    this.els.btnCreateNewRoom.addEventListener('click', () => {
      const nextCode = generateRoomCode();
      Service.state.room.code = nextCode;
      Service.state.role = 'gm';
      RealtimeBridge.connect(nextCode, (msg) => this.handleRealtimeMessage(msg));
      Service.notify();
      this.renderRoomModal(Service.state);
      this.showRoomToast(`Sala efímera ${nextCode} activada.`);
    });

    this.els.joinRoomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = this.els.inpJoinRoomCode.value.trim().toUpperCase();
      if (!code) return;
      Service.state.room.code = code;
      await Service.restoreFromVault();
      RealtimeBridge.connect(code, (msg) => this.handleRealtimeMessage(msg));
      Service.notify();
      this.renderRoomModal(Service.state);
      this.showRoomToast(`Conectado a sala ${code}.`);
    });

    this.els.btnCopyPlayerUrl.addEventListener('click', () => {
      this.els.inpPlayerInviteUrl.select();
      document.execCommand('copy');
      this.showRoomToast('Enlace de Jugadores copiado.');
    });

    this.els.btnCopyGmUrl.addEventListener('click', () => {
      this.els.inpGmInviteUrl.select();
      document.execCommand('copy');
      this.showRoomToast('Enlace de Director (GM) copiado.');
    });

    this.els.inpLocalMapWebp.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const webpDataUrl = await WebPConverter.fileToWebPDataUrl(file, 3840, 0.82);
        const kbSize = Math.round((webpDataUrl.length * 0.75) / 1024);
        Service.loadExternalMapImage(webpDataUrl);
        await Service.changeMap('custom', webpDataUrl);
        this.showRoomToast(`Mapa "${file.name}" optimizado a WebP (${kbSize} KB).`);
      } catch (err) {
        this.showRoomToast(err.message || 'Error al convertir imagen.');
      }
    });

    this.els.btnExportModule.addEventListener('click', async () => {
      const title = (this.els.inpModuleTitle.value.trim() || 'Modulo_VTT').replace(/[^a-zA-Z0-9_-]/g, '_');
      Service.state.room.moduleTitle = title;
      try {
        const blob = await CartridgePacker.buildOwltableBlob(Service.state);
        const kbSize = Math.max(1, Math.round(blob.size / 1024));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.owltable`;
        a.click();
        URL.revokeObjectURL(url);
        this.showRoomToast(`Cartucho ${title}.owltable exportado (${kbSize} KB).`);
      } catch (err) {
        this.showRoomToast(err.message || 'Error al empaquetar .owltable.');
      }
    });

    this.els.inpModuleFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const parsed = await CartridgePacker.parseCartridgeBuffer(buffer);
        await Service.loadModulePackage(parsed);
        this.showRoomToast(`Cartucho "${Service.state.room.moduleTitle}" cargado.`);
      } catch (err) {
        this.showRoomToast(err.message || 'Error al abrir cartucho.');
      }
    });

    this.els.addShelfModuleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = this.els.inpShelfTitle.value.trim();
      const url = this.els.inpShelfUrl.value.trim();
      if (!title || !url) return;
      await Service.addShelfModule(title, url);
      this.els.inpShelfTitle.value = '';
      this.els.inpShelfUrl.value = '';
      this.renderRoomModal(Service.state);
      this.showRoomToast(`Mesa "${title}" añadida al desplegable superior.`);
    });

    this.els.btnResetVaultStep1.addEventListener('click', () => {
      this.els.btnResetVaultStep1.classList.add('hidden');
      this.els.btnResetVaultConfirm.classList.remove('hidden');
    });
    this.els.btnResetVaultConfirm.addEventListener('click', async () => {
      const code = Service.state.room.code;
      await BrowserVault.clearRoom(code);
      Service.state = createInitialState();
      Service.state.room.code = code;
      Service.notify({ redrawMap: true, redrawGrid: true, redrawDraw: true, redrawFog: true });
      this.els.btnResetVaultConfirm.classList.add('hidden');
      this.els.btnResetVaultStep1.classList.remove('hidden');
      this.showRoomToast('Memoria de sala reiniciada.');
    });

    // 9. Modal Google Drive
    this.els.btnOpenDriveModal.addEventListener('click', () => {
      this.els.driveModal.classList.add('is-open');
    });
    this.els.btnCloseDriveModal.addEventListener('click', () => {
      this.els.driveModal.classList.remove('is-open');
    });
    this.els.btnApplyDriveMap.addEventListener('click', async () => {
      const raw = this.els.inpDriveMapUrl.value.trim();
      if (!raw) return;
      const direct = DriveUrlHelper.toDirectImageUrl(raw);
      Service.loadExternalMapImage(direct);
      await Service.changeMap('custom', direct);
      this.els.driveModal.classList.remove('is-open');
      this.showActionToast('Mapa de Google Drive aplicado.');
    });
    this.els.btnEmbedDriveFolder.addEventListener('click', () => {
      const raw = this.els.inpDriveFolderUrl.value.trim();
      if (!raw) return;
      this.els.driveFolderIframe.src = DriveUrlHelper.toEmbedFolderUrl(raw);
      this.els.driveFolderIframe.classList.remove('hidden');
    });

    // 10. Modal Sync & Event Log
    this.els.btnOpenSyncModal.addEventListener('click', () => {
      this.els.syncModal.classList.add('is-open');
      this.renderSyncModal(Service.state);
    });
    this.els.btnCloseSyncModal.addEventListener('click', () => {
      this.els.syncModal.classList.remove('is-open');
    });
    this.els.btnBroadcastFullNow.addEventListener('click', () => {
      RealtimeBridge.send({ kind: 'WORLD_SYNC', world: Selector.extractSerializableWorld(Service.state) });
      this.showActionToast('Estado completo enviado a la sala.');
    });
    this.els.btnCompactEvents.addEventListener('click', () => {
      Service.state.events = [];
      Service.recordEvent('CHECKPOINT', 'Snapshot compactado en 1 fila');
      this.renderSyncModal(Service.state);
    });

    // Handouts (Compartir imagen en mesa)
    if (this.els.btnShowHandout) {
      this.els.btnShowHandout.addEventListener('click', () => {
        const url = this.els.inpHandoutUrl?.value.trim();
        if (!url) return;
        const title = this.els.inpHandoutTitle?.value.trim() || 'Handout';
        Service.showHandout(url, title);
        this.els.roomModal?.classList.remove('is-open');
      });
    }
    if (this.els.inpHandoutFile) {
      this.els.inpHandoutFile.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const dataUrl = await Service.compressImageFile(file, 1400, 0.84);
        const title = this.els.inpHandoutTitle?.value.trim() || file.name.replace(/\.[^.]+$/, '');
        Service.showHandout(dataUrl, title);
        this.els.roomModal?.classList.remove('is-open');
        e.target.value = '';
      });
    }
    if (this.els.btnCloseHandout) {
      this.els.btnCloseHandout.addEventListener('click', () => Service.closeHandout(false));
    }
    if (this.els.btnClearHandoutForAll) {
      this.els.btnClearHandoutForAll.addEventListener('click', () => Service.closeHandout(true));
    }

    // 11. Atajos de Teclado
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        const ok = e.shiftKey ? Service.redo() : Service.undo();
        if (ok) this.showActionToast(e.shiftKey ? '↪️ Rehacer' : '↩️ Deshacer');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        if (Service.redo()) this.showActionToast('↪️ Rehacer');
        return;
      }
      if (k === 'v' || k === 'h') Service.setTool('select');
      else if (k === 'r') Service.setTool('ruler');
      else if (k === 'p') Service.setTool('draw');
      else if (k === 'f') Service.setTool('fog');
      else if (k === 'w') Service.setTool('wall');
      else if (k === 'g') Service.setTool('ping');
      else if (k === 'c') {
        Service.state.sheetOpen = !Service.state.sheetOpen;
        Service.notify();
      } else if (k === 'escape') {
        Service.state.wallAnchor = null;
        Service.clearDiceHand();
        if (this.setDicePopoverOpen) this.setDicePopoverOpen(false);
        this.hideContextMenu();
        Service.notify();
      }
    });
  },

  /* --------------------------------------------------------------------
     MENÚ CONTEXTUAL VISUAL DE ICONOS (CLIC DERECHO)
     -------------------------------------------------------------------- */
  openContextMenu(clientX, clientY) {
    const state = Service.state;
    const menu = this.els.contextIconMenu;

    menu.querySelectorAll('[data-ctx-tool]').forEach((btn) => {
      btn.classList.toggle('owl-btn-active', btn.dataset.ctxTool === state.tool);
    });

    if (this.ctxTargetTokenId) {
      const tok = state.tokens.find((t) => t.id === this.ctxTargetTokenId);
      this.els.contextDynamicRow.classList.remove('grid-cols-5');
      this.els.contextDynamicRow.classList.add('grid-cols-6');
      this.els.contextDynamicRow.innerHTML = `
        <button type="button" data-ctx-act="hp-minus" class="owl-subpanel owl-btn h-8 font-mono-tech font-bold text-red-400" title="-1 HP">−HP</button>
        <button type="button" data-ctx-act="hp-plus" class="owl-subpanel owl-btn h-8 font-mono-tech font-bold text-emerald-400" title="+1 HP">+HP</button>
        <button type="button" data-ctx-act="toggle-hide" class="owl-subpanel owl-btn h-8" title="${tok && tok.hidden ? 'Mostrar' : 'Ocultar'}">👁️</button>
        <button type="button" data-ctx-act="dup-tok" class="owl-subpanel owl-btn h-8" title="Duplicar Ficha">⧉</button>
        <button type="button" data-ctx-act="open-sheet" class="owl-subpanel owl-btn h-8" title="Abrir Ficha">📋</button>
        <button type="button" data-ctx-act="del-tok" class="owl-subpanel owl-btn h-8 text-red-400" title="Eliminar Ficha">🗑️</button>
      `;
    } else {
      this.els.contextDynamicRow.classList.remove('grid-cols-6');
      this.els.contextDynamicRow.classList.add('grid-cols-5');
      this.els.contextDynamicRow.innerHTML = `
        <button type="button" data-ctx-act="ping-here" class="owl-subpanel owl-btn h-8" title="Ping Aquí">📡</button>
        <button type="button" data-ctx-act="add-note" class="owl-subpanel owl-btn h-8" title="Fijar Nota Aquí">📌</button>
        <button type="button" data-ctx-act="spawn-here" class="owl-subpanel owl-btn h-8" title="Invocar Ficha Aquí">➕</button>
        <button type="button" data-ctx-act="toggle-dynlight" class="owl-subpanel owl-btn h-8 ${state.dynamicLighting ? 'owl-btn-active' : ''}" title="Alternar Luz Dinámica">💡</button>
        <button type="button" data-ctx-act="roll-d20" class="owl-subpanel owl-btn h-8 font-mono-tech font-bold" title="Tirar d20">d20</button>
      `;
    }

    this.els.contextDynamicRow.querySelectorAll('[data-ctx-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.ctxAct;
        if (act === 'hp-minus' && this.ctxTargetTokenId) Service.adjustTokenHp(this.ctxTargetTokenId, -1);
        if (act === 'hp-plus' && this.ctxTargetTokenId) Service.adjustTokenHp(this.ctxTargetTokenId, 1);
        if (act === 'toggle-hide' && this.ctxTargetTokenId) Service.toggleTokenHidden(this.ctxTargetTokenId);
        if (act === 'dup-tok' && this.ctxTargetTokenId) Service.duplicateToken(this.ctxTargetTokenId);
        if (act === 'open-sheet' && this.ctxTargetTokenId) Service.selectToken(this.ctxTargetTokenId, true);
        if (act === 'del-tok' && this.ctxTargetTokenId) Service.deleteToken(this.ctxTargetTokenId);
        if (act === 'ping-here') Service.triggerPing(this.ctxWorldPos.x, this.ctxWorldPos.y);
        if (act === 'add-note') this.openNoteModal(null, this.ctxWorldPos.x, this.ctxWorldPos.y);
        if (act === 'spawn-here') {
          await Service.spawnActorFromTemplate(COMPENDIUM_ACTORS[0], this.ctxWorldPos.x, this.ctxWorldPos.y);
        }
        if (act === 'toggle-dynlight') {
          Service.toggleDynamicLighting();
          this.showActionToast(Service.state.dynamicLighting ? '💡 Luz Dinámica activada' : '💡 Luz Dinámica apagada');
        }
        if (act === 'roll-d20') Service.rollDice(20);
        if (act === 'clear-fog') {
          Service.pushUndoSnapshot();
          Service.state.fogRects = [];
          this.clearExploredMemory();
          Service.notify({ redrawFog: true });
        }
        this.hideContextMenu();
      });
    });

    if (state.tool === 'draw') {
      const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
      this.els.contextSubOptionsRow.classList.remove('hidden');
      this.els.contextSubOptionsRow.classList.add('flex');
      this.els.contextSubOptionsRow.innerHTML = colors
        .map(
          (c) =>
            `<button type="button" data-ctx-color="${c}" class="w-6 h-6 rounded-full border-2 ${state.drawColor === c ? 'border-white scale-110' : 'border-transparent'}" style="background:${c};"></button>`
        )
        .join('');
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-color]').forEach((b) => {
        b.addEventListener('click', () => {
          Service.state.drawColor = b.dataset.ctxColor;
          Service.notify();
          this.hideContextMenu();
        });
      });
    } else if (state.tool === 'fog') {
      this.els.contextSubOptionsRow.classList.remove('hidden');
      this.els.contextSubOptionsRow.classList.add('flex');
      this.els.contextSubOptionsRow.innerHTML = `
        <button type="button" data-ctx-fog="reveal" class="owl-subpanel owl-btn flex-1 py-1 text-[11px] ${state.fogMode === 'reveal' ? 'owl-btn-active' : ''}">👁️ Revelar</button>
        <button type="button" data-ctx-fog="hide" class="owl-subpanel owl-btn flex-1 py-1 text-[11px] ${state.fogMode === 'hide' ? 'owl-btn-active' : ''}">☁️ Cubrir</button>
      `;
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-fog]').forEach((b) => {
        b.addEventListener('click', () => {
          Service.state.fogMode = b.dataset.ctxFog;
          Service.notify();
          this.hideContextMenu();
        });
      });
    } else if (state.tool === 'wall') {
      this.els.contextSubOptionsRow.classList.remove('hidden');
      this.els.contextSubOptionsRow.classList.add('flex');
      this.els.contextSubOptionsRow.innerHTML = `
        <button type="button" data-ctx-wall="wall" class="owl-subpanel owl-btn flex-1 py-1 text-[11px] ${state.wallType === 'wall' ? 'owl-btn-active' : ''}">🧱 Muro</button>
        <button type="button" data-ctx-wall="door" class="owl-subpanel owl-btn flex-1 py-1 text-[11px] ${state.wallType === 'door' ? 'owl-btn-active' : ''}">🚪 Puerta</button>
        <button type="button" data-ctx-wall="undo" class="owl-subpanel owl-btn px-2 py-1 text-[11px]" title="Deshacer último muro">↩</button>
      `;
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-wall]').forEach((b) => {
        b.addEventListener('click', () => {
          const mode = b.dataset.ctxWall;
          if (mode === 'undo') {
            Service.removeLastWall();
          } else {
            Service.state.wallType = mode;
            Service.notify();
          }
          this.hideContextMenu();
        });
      });
    } else if (this.ctxTargetTokenId) {
      const tok = state.tokens.find((t) => t.id === this.ctxTargetTokenId);
      const activeConds = tok && Array.isArray(tok.conditions) ? tok.conditions : [];
      const customLabels = state.systemStatuses || {};
      this.els.contextSubOptionsRow.className = 'grid grid-cols-5 gap-1 pt-1 border-t';
      this.els.contextSubOptionsRow.innerHTML = Object.entries(TOKEN_STATUS_SYMBOLS)
        .map(([key, def]) => {
          const active = activeConds.includes(key);
          const titleAttr = customLabels[key] ? ` title="${customLabels[key]}"` : '';
          return `
            <button
              type="button"
              data-ctx-cond="${key}"${titleAttr}
              class="owl-seg-btn h-7 p-0 rounded-lg flex items-center justify-center transition-transform ${active ? 'is-active scale-105' : 'owl-subpanel opacity-80 hover:opacity-100'}"
              style="${active ? `background:${def.color}; color:#ffffff; border-color:${def.color};` : `color:${def.color};`}"
            >${this.renderStatusSymbolSvg(key)}</button>
          `;
        })
        .join('') + `
        <div class="col-span-5 grid grid-cols-3 gap-1 pt-1 border-t" style="border-color: var(--border-subtle);">
          <button type="button" data-ctx-extra="light" class="owl-subpanel owl-btn h-7 text-[10px] font-medium ${tok?.lightRadius ? 'owl-btn-active' : ''}" title="Alternar Luz del Token (Off / 20ft / 40ft)">💡 ${tok?.lightRadius ? (tok.lightRadius === 360 ? '40ft' : '20ft') : 'Luz'}</button>
          <button type="button" data-ctx-extra="aura" class="owl-subpanel owl-btn h-7 text-[10px] font-medium ${tok?.auraRadius ? 'owl-btn-active' : ''}" title="Alternar Aura del Token (Off / 10ft / 15ft)">⭕ ${tok?.auraRadius ? (tok.auraRadius === 135 ? '15ft' : '10ft') : 'Aura'}</button>
          <button type="button" data-ctx-extra="owner" class="owl-subpanel owl-btn h-7 text-[10px] font-medium ${tok?.ownerId ? 'owl-btn-active' : ''}" title="Propiedad de ficha (Libre / Solo DJ o Reclamar)">🔑 ${tok?.ownerId === 'gm' ? 'Solo DJ' : tok?.ownerId ? 'Mía' : 'Libre'}</button>
        </div>`;
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-extra]').forEach((b) => {
        b.addEventListener('click', () => {
          const ex = b.dataset.ctxExtra;
          if (ex === 'light') Service.cycleTokenLight(this.ctxTargetTokenId);
          else if (ex === 'aura') Service.cycleTokenAura(this.ctxTargetTokenId);
          else if (ex === 'owner') Service.toggleTokenOwnership(this.ctxTargetTokenId);
          this.hideContextMenu();
        });
      });
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-cond]').forEach((b) => {
        b.addEventListener('click', () => {
          const key = b.dataset.ctxCond;
          Service.toggleTokenCondition(this.ctxTargetTokenId, key);
          const updatedTok = Service.state.tokens.find((t) => t.id === this.ctxTargetTokenId);
          const isNowActive = Boolean(updatedTok && Array.isArray(updatedTok.conditions) && updatedTok.conditions.includes(key));
          const def = TOKEN_STATUS_SYMBOLS[key];
          b.classList.toggle('is-active', isNowActive);
          b.classList.toggle('scale-105', isNowActive);
          b.classList.toggle('owl-subpanel', !isNowActive);
          b.classList.toggle('opacity-80', !isNowActive);
          b.style.background = isNowActive ? def.color : '';
          b.style.color = isNowActive ? '#ffffff' : def.color;
          b.style.borderColor = isNowActive ? def.color : '';
        });
      });
    } else {
      this.els.contextSubOptionsRow.className = 'hidden flex-wrap gap-1 pt-1 border-t';
    }

    const x = Math.min(window.innerWidth - 275, Math.max(8, clientX));
    const y = Math.min(window.innerHeight - 170, Math.max(8, clientY));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('is-open');
  },

  hideContextMenu() {
    this.els.contextIconMenu.classList.remove('is-open');
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

  renderHandoutModal(state) {
    if (!this.els.handoutModal) return;
    const h = state.activeHandout;
    this.els.handoutModal.classList.toggle('is-open', Boolean(h && h.url));
    if (!h || !h.url) return;
    if (this.els.handoutModalTitle) this.els.handoutModalTitle.textContent = h.title || 'Handout';
    if (this.els.handoutModalImg && this.els.handoutModalImg.src !== h.url) {
      this.els.handoutModalImg.src = h.url;
    }
    if (this.els.btnClearHandoutForAll) {
      this.els.btnClearHandoutForAll.classList.toggle('hidden', state.role !== 'gm');
    }
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
  },

  renderTokensLayer(state) {
    const cs = state.grid.cellSize;
    const visSources =
      state.role === 'player' && state.dynamicLighting ? Selector.getAlliedVisibilityPolygons(state) : null;

    const visibleTokens = state.tokens.filter((t) => {
      if (state.role === 'gm') return true;
      if (t.hidden) return false;
      if (visSources && t.isAlly === false) {
        // En vista Jugador, los hostiles solo se muestran si están dentro de la línea de visión de algún aliado
        return visSources.some(
          (src) =>
            Math.hypot(t.x - src.token.x, t.y - src.token.y) <= src.radius &&
            Selector.isPointInPolygon({ x: t.x, y: t.y }, src.poly)
        );
      }
      return true;
    });

    const existingNodes = new Map();
    this.els.tokensLayer.querySelectorAll('[data-token-id]').forEach((node) => {
      existingNodes.set(node.dataset.tokenId, node);
    });

    const visibleIds = new Set(visibleTokens.map((t) => t.id));
    existingNodes.forEach((node, id) => {
      if (!visibleIds.has(id)) node.remove();
    });

    for (const tok of visibleTokens) {
      const diameter = Math.round(cs * (tok.size || 1) * 0.84);
      const left = Math.round(tok.x - diameter / 2);
      const top = Math.round(tok.y - diameter / 2);
      const isSel = tok.id === state.selectedTokenId;
      const isDrag = tok.id === this.draggingTokenId;
      const initials = tok.name.slice(0, 2).toUpperCase();
      const hpPct = tok.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((tok.hp / tok.maxHp) * 100))) : 0;

      let el = existingNodes.get(tok.id);
      if (!el) {
        el = document.createElement('div');
        el.dataset.tokenId = tok.id;
        el.innerHTML = `
          <div class="vtt-token-avatar w-full h-full flex items-center justify-center rounded-full overflow-hidden pointer-events-none"></div>
          <div class="vtt-token-name absolute -bottom-3.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-slate-950/90 text-white text-[10px] font-mono-tech whitespace-nowrap pointer-events-none"></div>
          <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-4/5 h-1.5 rounded-full bg-black/70 overflow-hidden pointer-events-none">
            <div class="vtt-token-hp-fill h-full bg-emerald-400 transition-all duration-150"></div>
          </div>
        `;
        el.addEventListener('dragover', (e) => {
          e.preventDefault();
          el.classList.add('is-drop-hover');
        });
        el.addEventListener('dragleave', () => el.classList.remove('is-drop-hover'));
        this.els.tokensLayer.appendChild(el);
      }

      const activeCombatTokId = state.combat?.active ? state.combat.order?.[state.combat.turnIndex]?.tokenId : null;
      const isTurn = activeCombatTokId === tok.id;
      el.classList.add('vtt-token');
      el.classList.toggle('is-selected', isSel);
      el.classList.toggle('is-dragging', isDrag);
      const conds = Array.isArray(tok.conditions) ? tok.conditions : [];
      el.classList.toggle('opacity-55', Boolean(tok.hidden || conds.includes('hidden') || conds.includes('invisible')));
      el.style.setProperty('--tx', `${left}px`);
      el.style.setProperty('--ty', `${top}px`);
      el.style.width = `${diameter}px`;
      el.style.height = `${diameter}px`;
      el.style.backgroundColor = tok.color;
      el.style.border = isTurn ? '3px solid #f59e0b' : '2px solid #ffffff';
      el.style.boxShadow = isTurn ? '0 0 0 4px rgba(245, 158, 11, 0.32)' : '';
      el.style.isolation = 'isolate';
      el.title = `${tok.name} (${tok.hp}/${tok.maxHp} HP)`;

      let condRow = el.querySelector('.vtt-token-conds');
      if (!condRow) {
        condRow = document.createElement('div');
        condRow.className = 'vtt-token-conds absolute -right-1.5 -top-1.5 flex flex-wrap max-w-[54px] justify-end gap-0.5 pointer-events-none';
        el.appendChild(condRow);
      }

      const auraPx = Number(tok.auraRadius) || 0;
      let auraEl = el.querySelector('.vtt-token-aura');
      if (auraPx > 0) {
        if (!auraEl) {
          auraEl = document.createElement('div');
          auraEl.className = 'vtt-token-aura absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none';
          auraEl.style.zIndex = '-1';
          el.prepend(auraEl);
        }
        const auraDiam = auraPx * 2;
        auraEl.style.width = `${auraDiam}px`;
        auraEl.style.height = `${auraDiam}px`;
        auraEl.style.border = `1.5px dashed ${tok.color || '#8b5cf6'}`;
        auraEl.style.background = `${tok.color || '#8b5cf6'}14`;
      } else if (auraEl) {
        auraEl.remove();
      }

      const lightPx = Number(tok.lightRadius) || 0;
      let lightEl = el.querySelector('.vtt-token-light');
      if (lightPx > 0) {
        if (!lightEl) {
          lightEl = document.createElement('div');
          lightEl.className = 'vtt-token-light absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none';
          lightEl.style.zIndex = '-1';
          el.prepend(lightEl);
        }
        const lightDiam = lightPx * 2;
        lightEl.style.width = `${lightDiam}px`;
        lightEl.style.height = `${lightDiam}px`;
        lightEl.style.background = 'radial-gradient(circle, rgba(251,191,36,0.22) 0%, rgba(251,191,36,0.06) 55%, rgba(251,191,36,0) 75%)';
      } else if (lightEl) {
        lightEl.remove();
      }
      condRow.innerHTML = conds
        .filter((c) => TOKEN_STATUS_SYMBOLS[c])
        .map((c) => {
          const def = TOKEN_STATUS_SYMBOLS[c];
          return `<span class="w-4 h-4 rounded-full border border-white/85 text-white flex items-center justify-center shadow-sm" style="background:${def.color};">${this.renderStatusSymbolSvg(c, 'w-2.5 h-2.5')}</span>`;
        })
        .join('');

      const avatarBox = el.querySelector('.vtt-token-avatar');
      const avatarKey = tok.imageUrl ? `img:${tok.imageUrl}` : `txt:${initials}`;
      if (avatarBox.dataset.avatarKey !== avatarKey) {
        avatarBox.dataset.avatarKey = avatarKey;
        avatarBox.innerHTML = tok.imageUrl
          ? `<img src="${tok.imageUrl}" alt="${tok.name}" class="w-full h-full object-cover rounded-full pointer-events-none" />`
          : `<span class="font-bold text-white text-sm pointer-events-none">${initials}</span>`;
      }

      const nameBox = el.querySelector('.vtt-token-name');
      if (nameBox.textContent !== tok.name) {
        nameBox.textContent = tok.name;
      }

      const hpFill = el.querySelector('.vtt-token-hp-fill');
      hpFill.style.width = `${hpPct}%`;
    }
  },

  renderRoomModal(state) {
    this.els.lblModalRoomCode.textContent = state.room.code;
    this.els.lblModalRoomRole.textContent = state.role === 'gm' ? 'DIRECTOR (GM)' : 'JUGADOR';
    this.els.inpModuleTitle.value = state.room.moduleTitle || `Aventura_${state.room.code}`;
    if (this.els.handoutShareBox) {
      this.els.handoutShareBox.classList.toggle('hidden', state.role !== 'gm');
    }
    if (this.els.roomPresenceList) {
      const peers = Service.getActivePeers();
      this.els.roomPresenceList.innerHTML = peers
        .map(
          (p) =>
            `<span class="owl-panel px-2 py-0.5 rounded-full text-[10px] font-mono-tech">${p.role === 'gm' ? 'DJ' : 'Jugador'}${p.self ? ' (tú)' : ''}</span>`
        )
        .join('');
    }

    const shelf = state.shelfModules || [];
    this.els.shelfModulesList.innerHTML = shelf.length
      ? shelf
          .map(
            (m) => `
            <div class="owl-panel rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
              <div class="min-w-0">
                <div class="font-bold truncate">📦 ${m.title}</div>
                <div class="font-mono-tech text-[9px] opacity-65 truncate">${m.url}</div>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button type="button" data-load-shelf="${m.id}" class="owl-btn owl-btn-accent px-2 py-1 text-[10px] font-semibold">Cargar</button>
                <button type="button" data-del-shelf="${m.id}" class="owl-btn owl-subpanel w-6 h-6 text-[10px] text-red-400">✕</button>
              </div>
            </div>
          `
          )
          .join('')
      : `<span class="text-[10px] opacity-65">Aún no has enlazado cartuchos .owltable externos.</span>`;

    this.els.shelfModulesList.querySelectorAll('[data-load-shelf]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const entry = shelf.find((x) => x.id === btn.dataset.loadShelf);
        if (!entry) return;
        this.showRoomToast(`Descargando "${entry.title}"...`);
        try {
          await Service.loadRemoteCartridge(entry);
          this.els.roomModal.classList.remove('is-open');
          this.showActionToast(`Cartucho "${entry.title}" desplegado.`);
        } catch (err) {
          this.showRoomToast(err.message || 'Error al descargar cartucho.');
        }
      });
    });

    this.els.shelfModulesList.querySelectorAll('[data-del-shelf]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await Service.removeShelfModule(btn.dataset.delShelf);
        this.renderRoomModal(Service.state);
      });
    });

    const isRealHttp = window.location.protocol.startsWith('http');
    const baseUrl = isRealHttp
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://tu-vtt.web.app/';
    this.els.inpPlayerInviteUrl.value = `${baseUrl}?room=${state.room.code}&role=player`;
    this.els.inpGmInviteUrl.value = `${baseUrl}?room=${state.room.code}&role=gm`;
  },

  renderSyncModal(state) {
    this.els.lblSyncRoomName.textContent = state.room.code;
    this.els.lblEventQueueCount.textContent = String(state.events.length);
    this.els.eventLogPreviewList.innerHTML = state.events.length
      ? state.events
          .slice(-15)
          .reverse()
          .map((ev) => `<div>[${ev.ts}] <strong>${ev.type}</strong> · ${ev.detail}</div>`)
          .join('')
      : `<div class="opacity-60">Sin eventos recientes en cola.</div>`;
  }
};
