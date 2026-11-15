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
import { Service } from './service.js?v=20261115k';

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

  renderCustomItemIconGrid() {
    const grid = this.els.customItemIconGrid;
    if (!grid) return;
    const activeColor = this.selectedItemColor || '#8b5cf6';
    grid.innerHTML = Object.entries(ITEM_ICON_DEFS)
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

  clearExploredMemory() {
    if (!this.exploredCanvas) {
      this.exploredCanvas = document.createElement('canvas');
      this.exploredCanvas.width = 2400;
      this.exploredCanvas.height = 1600;
    }
    const ectx = this.exploredCanvas.getContext('2d');
    ectx.clearRect(0, 0, 2400, 1600);
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
    this.els.inpSheetName.addEventListener('change', (e) => {
      const tok = Selector.getSelectedToken(Service.state);
      if (tok && e.target.value.trim()) {
        tok.name = e.target.value.trim();
        Service.notify();
      }
    });
    if (this.els.inpSheetRole) {
      this.els.inpSheetRole.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (tok) {
          tok.role = e.target.value.trim() || 'Aventurero';
          Service.notify();
        }
      });
    }
    if (this.els.inpSheetMaxHp) {
      this.els.inpSheetMaxHp.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        const nextMax = Math.max(1, Math.min(999, Number(e.target.value) || 1));
        tok.maxHp = nextMax;
        tok.hp = Math.min(tok.hp, nextMax);
        Service.notify();
      });
    }
    if (this.els.inpSheetAc) {
      this.els.inpSheetAc.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        tok.ac = Math.max(1, Math.min(40, Number(e.target.value) || 10));
        Service.notify();
      });
    }
    if (this.els.inpSheetLevel) {
      this.els.inpSheetLevel.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        tok.level = Math.max(1, Math.min(20, Number(e.target.value) || 1));
        Service.notify();
      });
    }
    if (this.els.inpSheetSpeed) {
      this.els.inpSheetSpeed.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        tok.speed = e.target.value.trim() || '30 ft';
        Service.notify();
      });
    }
    if (this.els.btnLoadDnd55Skills) {
      this.els.btnLoadDnd55Skills.addEventListener('click', () => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        const added = Service.loadDnd55Skills(tok.id);
        this.showActionToast(added > 0 ? `${added} habilidades D&D 5.5e cargadas.` : 'Las habilidades 5.5e ya estaban cargadas.');
      });
    }
    this.els.btnSheetHpMinus.addEventListener('click', () => {
      if (Service.state.selectedTokenId) Service.adjustTokenHp(Service.state.selectedTokenId, -1);
    });
    this.els.btnSheetHpPlus.addEventListener('click', () => {
      if (Service.state.selectedTokenId) Service.adjustTokenHp(Service.state.selectedTokenId, 1);
    });
    this.els.btnSheetRollInit.addEventListener('click', () => {
      const tok = Selector.getSelectedToken(Service.state);
      const dex = tok && tok.stats ? Number(tok.stats.dex) || 0 : 0;
      Service.state.dice.modifier = dex;
      Service.rollDice(20, `${tok ? tok.name : 'Ficha'} · Iniciativa`);
      if (tok && Service.state.combat?.active && Service.state.dice.lastRoll) {
        Service.setTokenInitiative(tok.id, Service.state.dice.lastRoll.total);
      }
    });

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

    if (this.els.sheetTopTabs) {
      this.els.sheetTopTabs.querySelectorAll('[data-sheet-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeSheetTab = btn.dataset.sheetTab;
          this.renderCharacterSheet(Service.state);
        });
      });
    }
    const bindInlineFormToggle = (btn, form, focusEl) => {
      if (!btn || !form) return;
      btn.addEventListener('click', () => {
        const opening = form.classList.contains('hidden');
        form.classList.toggle('hidden', !opening);
        form.classList.toggle('flex', opening);
        btn.classList.toggle('owl-btn-accent', opening);
        if (opening && focusEl) focusEl.focus();
      });
    };
    bindInlineFormToggle(this.els.btnToggleSkillForm, this.els.sheetSkillForm, this.els.inpSheetSkillName);
    bindInlineFormToggle(this.els.btnToggleTraitForm, this.els.sheetTraitForm, this.els.inpSheetTraitTitle);

    if (this.els.sheetSkillForm) {
      this.els.sheetSkillForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        Service.addTokenSkill(tok.id, this.els.inpSheetSkillName.value, this.els.inpSheetSkillMod.value);
        this.els.inpSheetSkillName.value = '';
        this.els.inpSheetSkillMod.value = '0';
        this.els.sheetSkillForm.classList.add('hidden');
        this.els.sheetSkillForm.classList.remove('flex');
        this.els.btnToggleSkillForm?.classList.remove('owl-btn-accent');
      });
    }
    if (this.els.sheetTraitForm) {
      this.els.sheetTraitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        Service.addTokenTrait(tok.id, this.els.inpSheetTraitTitle.value, this.els.inpSheetTraitDesc.value);
        this.els.inpSheetTraitTitle.value = '';
        this.els.inpSheetTraitDesc.value = '';
        this.els.sheetTraitForm.classList.add('hidden');
        this.els.sheetTraitForm.classList.remove('flex');
        this.els.btnToggleTraitForm?.classList.remove('owl-btn-accent');
      });
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

    // 6. Bandeja de Dados 3D (recoger en mano con clic izq, restar 1 con clic der)
    this.els.diceTrayBar.addEventListener('click', (e) => {
      const dieBtn = e.target.closest('[data-die]');
      if (dieBtn) {
        Service.addDieToHand(Number(dieBtn.dataset.die));
      }
    });
    this.els.diceTrayBar.addEventListener('contextmenu', (e) => {
      const dieBtn = e.target.closest('[data-die]');
      if (dieBtn) {
        e.preventDefault();
        Service.removeDieFromHand(Number(dieBtn.dataset.die));
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (this.els.diceHandCursor && Array.isArray(Service.state.dice.hand) && Service.state.dice.hand.length > 0) {
        const tx = Math.min(window.innerWidth - 76, e.clientX + 14);
        const ty = Math.max(10, e.clientY - 36);
        this.els.diceHandCursor.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      }
    });
    this.els.btnDiceModMinus.addEventListener('click', () => {
      Service.state.dice.modifier -= 1;
      Service.notify();
    });
    this.els.btnDiceModPlus.addEventListener('click', () => {
      Service.state.dice.modifier += 1;
      Service.notify();
    });
    if (this.els.diceResultSeg) {
      this.els.diceResultSeg.querySelectorAll('[data-result-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.setDiceResultMode(btn.dataset.resultMode);
        });
      });
    }
    if (this.els.diceVisibilitySeg) {
      this.els.diceVisibilitySeg.querySelectorAll('[data-dice-vis]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.setDiceVisibility(btn.dataset.diceVis);
        });
      });
    }
    this.els.btnCloseDice3d.addEventListener('click', () => {
      this.dismissedRoll = Service.state.dice.lastRoll || null;
      this.els.dice3dOverlay.classList.remove('is-open');
      Dice3DEngine.clear();
    });

    const applyDiceRollToSelected = (multiplier, isHeal) => {
      const tokId = Service.state.selectedTokenId;
      const tok = Service.state.tokens.find((t) => t.id === tokId);
      const base = Math.max(0, Number(this.currentRollTotal) || 0);
      const amount = Math.floor(base * multiplier);
      if (!tok || amount <= 0) return;
      Service.adjustTokenHp(tok.id, isHeal ? amount : -amount);
      this.showActionToast(`${isHeal ? '+' : '−'}${amount} HP a ${tok.name} (${tok.hp}/${tok.maxHp}).`);
    };
    if (this.els.btnDiceApplyDmg) this.els.btnDiceApplyDmg.addEventListener('click', () => applyDiceRollToSelected(1, false));
    if (this.els.btnDiceApplyHalfDmg) this.els.btnDiceApplyHalfDmg.addEventListener('click', () => applyDiceRollToSelected(0.5, false));
    if (this.els.btnDiceApplyHeal) this.els.btnDiceApplyHeal.addEventListener('click', () => applyDiceRollToSelected(1, true));

    // Personalización visual curada de dados (swatches, controles segmentados y vista previa viva)
    this.activeDiceSymbolTab = 'maxSymbol';
    const dismissRollCard = () => {
      this.dismissedRoll = Service.state.dice.lastRoll || null;
      this.els.dice3dOverlay?.classList.remove('is-open');
      Dice3DEngine.clear();
    };
    this.setDicePopoverOpen = (open) => {
      if (!this.els.diceStylePopover) return;
      if (open) {
        dismissRollCard();
        if (this.setDiceHistoryOpen) this.setDiceHistoryOpen(false);
      }
      this.els.diceStylePopover.classList.toggle('is-open', open);
      if (open) {
        this.syncDiceStyleUI(Service.state.dice.style);
      } else {
        Dice3DEngine.stopPreview();
      }
    };

    this.setDiceHistoryOpen = (open) => {
      if (!this.els.diceHistoryPopover) return;
      if (open) {
        dismissRollCard();
        if (this.setDicePopoverOpen) this.setDicePopoverOpen(false);
      }
      this.els.diceHistoryPopover.classList.toggle('is-open', open);
      if (this.els.btnDiceHistory) {
        this.els.btnDiceHistory.classList.toggle('opacity-100', open);
        this.els.btnDiceHistory.classList.toggle('opacity-80', !open);
      }
    };

    if (this.els.btnDiceHistory && this.els.diceHistoryPopover) {
      this.els.btnDiceHistory.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !this.els.diceHistoryPopover.classList.contains('is-open');
        this.setDiceHistoryOpen(willOpen);
      });
      if (this.els.btnCloseDiceHistory) {
        this.els.btnCloseDiceHistory.addEventListener('click', () => this.setDiceHistoryOpen(false));
      }
      if (this.els.btnClearDiceHistory) {
        this.els.btnClearDiceHistory.addEventListener('click', () => Service.clearDiceHistory());
      }
      document.addEventListener('pointerdown', (e) => {
        if (
          this.els.diceHistoryPopover.classList.contains('is-open') &&
          !e.target.closest('#diceHistoryPopover') &&
          !e.target.closest('#btnDiceHistory')
        ) {
          this.setDiceHistoryOpen(false);
        }
      });
    }

    if (this.els.btnDiceCustomize && this.els.diceStylePopover) {
      this.els.btnDiceCustomize.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !this.els.diceStylePopover.classList.contains('is-open');
        this.setDicePopoverOpen(willOpen);
      });
      this.els.btnCloseDiceStyle.addEventListener('click', () => this.setDicePopoverOpen(false));
      this.els.btnResetDiceStyle.addEventListener('click', () => Service.resetDiceStyle());

      document.addEventListener('pointerdown', (e) => {
        if (
          this.els.diceStylePopover.classList.contains('is-open') &&
          !e.target.closest('#diceStylePopover') &&
          !e.target.closest('#btnDiceCustomize')
        ) {
          this.setDicePopoverOpen(false);
        }
      });

      let diceColorPreviewTimer = null;
      const bindLiveColorInput = (inputEl, key) => {
        if (!inputEl) return;
        inputEl.addEventListener('input', (e) => {
          const val = e.target.value;
          const draftStyle = { ...(Service.state.dice.style || {}), [key]: val };
          if (this.els.btnDiceCustomize) {
            if (key === 'bodyColor') this.els.btnDiceCustomize.style.backgroundColor = val;
            if (key === 'bevelColor') this.els.btnDiceCustomize.style.borderColor = val;
          }
          if (key === 'numberColor' && this.els.diceStyleDot) {
            this.els.diceStyleDot.style.backgroundColor = val;
          }
          if (!diceColorPreviewTimer && this.els.dicePreviewCanvas) {
            diceColorPreviewTimer = setTimeout(() => {
              diceColorPreviewTimer = null;
              requestAnimationFrame(() => {
                if (this.els.diceStylePopover?.classList.contains('is-open')) {
                  Dice3DEngine.clearTextureCache();
                  Dice3DEngine.updatePreview(
                    this.els.dicePreviewCanvas,
                    {
                      ...(Service.state.dice.style || {}),
                      bodyColor: this.els.inpDiceBodyColor.value,
                      bevelColor: this.els.inpDiceBevelColor.value,
                      numberColor: this.els.inpDiceNumberColor.value
                    },
                    this.activeDiceSymbolTab === 'minSymbol'
                  );
                }
              });
            }, 90);
          }
        });
        inputEl.addEventListener('change', (e) => {
          if (diceColorPreviewTimer) {
            clearTimeout(diceColorPreviewTimer);
            diceColorPreviewTimer = null;
          }
          Service.updateDiceStyle({ [key]: e.target.value });
        });
      };

      bindLiveColorInput(this.els.inpDiceBodyColor, 'bodyColor');
      bindLiveColorInput(this.els.inpDiceBevelColor, 'bevelColor');
      bindLiveColorInput(this.els.inpDiceNumberColor, 'numberColor');

      const bindSwatches = (attr, key) => {
        this.els.diceStylePopover.querySelectorAll(`[${attr}]`).forEach((btn) => {
          btn.addEventListener('click', () => Service.updateDiceStyle({ [key]: btn.getAttribute(attr) }));
        });
      };
      bindSwatches('data-body-swatch', 'bodyColor');
      bindSwatches('data-bevel-swatch', 'bevelColor');
      bindSwatches('data-number-swatch', 'numberColor');

      this.els.diceStylePopover.querySelectorAll('[data-dice-size]').forEach((btn) => {
        btn.addEventListener('click', () => Service.updateDiceStyle({ sizeScale: Number(btn.dataset.diceSize) }));
      });
      this.els.diceStylePopover.querySelectorAll('[data-dice-bevel]').forEach((btn) => {
        btn.addEventListener('click', () => Service.updateDiceStyle({ bevelSize: Number(btn.dataset.diceBevel) }));
      });

      this.els.diceStylePopover.querySelectorAll('[data-symbol-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeDiceSymbolTab = btn.dataset.symbolTab;
          this.syncDiceStyleUI(Service.state.dice.style);
        });
      });

      this.els.diceStylePopover.querySelectorAll('[data-dice-glyph]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateDiceStyle({ [this.activeDiceSymbolTab]: btn.dataset.diceGlyph });
        });
      });

      this.els.inpDiceCustomSymbol.addEventListener('input', (e) => {
        Service.updateDiceStyle({ [this.activeDiceSymbolTab]: e.target.value });
      });
    }

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

  openNoteModal(note, wx = 0, wy = 0) {
    this.editingNoteCtx = note ? { id: note.id } : { x: wx, y: wy };
    this.els.inpNoteTitle.value = note ? note.title : '';
    this.els.inpNoteBody.value = note ? note.body || '' : '';
    this.els.chkNoteGmOnly.checked = note ? Boolean(note.gmOnly) : false;
    this.els.btnDeleteNote.classList.toggle('hidden', !note);
    this.els.noteEditorModal.classList.remove('hidden');
    this.els.noteEditorModal.classList.add('flex');
    this.els.inpNoteTitle.focus();
  },

  closeNoteModal() {
    this.editingNoteCtx = null;
    this.els.noteEditorModal.classList.add('hidden');
    this.els.noteEditorModal.classList.remove('flex');
  },

  renderMapNotes(state) {
    const layer = this.els.mapNotesLayer;
    if (!layer) return;
    const sceneKey = Service.getActiveSceneKey();
    const notes = (state.notes || []).filter(
      (n) => n.sceneKey === sceneKey && (!n.gmOnly || state.role === 'gm')
    );
    layer.innerHTML = notes
      .map(
        (n) => `
        <button
          type="button"
          data-map-note="${n.id}"
          class="owl-panel pointer-events-auto absolute -translate-x-1/2 -translate-y-full px-2 py-1 rounded-full flex items-center gap-1 text-[11px] font-semibold shadow-md hover:scale-105 transition-transform"
          style="left:${n.x}px; top:${n.y}px;"
          title="${n.body || n.title}"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${n.gmOnly ? '#f59e0b' : 'var(--accent-primary)'};"></span>
          <span class="max-w-[120px] truncate">${n.title}</span>
        </button>
      `
      )
      .join('');
    layer.querySelectorAll('[data-map-note]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const found = (Service.state.notes || []).find((n) => n.id === btn.dataset.mapNote);
        if (found) this.openNoteModal(found);
      });
    });
  },

  drawMapCanvas(state) {
    const ctx = this.els.mapCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);

    const customSrc = state.mapId === 'custom' ? (state.customMapUrl || Service.loadedMapImage?.src || '') : '';
    if (customSrc && this.els.customMapImg) {
      if (this.els.customMapImg.getAttribute('src') !== customSrc) {
        this.els.customMapImg.src = customSrc;
      }
      this.els.customMapImg.classList.remove('hidden');
      return;
    }
    if (this.els.customMapImg) {
      this.els.customMapImg.classList.add('hidden');
      this.els.customMapImg.removeAttribute('src');
    }

    if (state.mapId === 'forest') {
      ctx.fillStyle = '#1e3528';
      ctx.fillRect(0, 0, 2400, 1600);
      ctx.fillStyle = '#5c4938';
      ctx.beginPath();
      ctx.moveTo(0, 520);
      ctx.quadraticCurveTo(1100, 420, 2400, 740);
      ctx.lineTo(2400, 920);
      ctx.quadraticCurveTo(1100, 620, 0, 700);
      ctx.closePath();
      ctx.fill();
      // Copas de árboles
      ctx.fillStyle = '#15281e';
      for (let i = 0; i < 24; i++) {
        const x = ((i * 213) % 2300) + 60;
        const y = ((i * 317) % 1400) + 80;
        if (y > 440 && y < 940) continue;
        ctx.beginPath();
        ctx.arc(x, y, 54, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (state.mapId === 'tavern') {
      ctx.fillStyle = '#3b281c';
      ctx.fillRect(0, 0, 2400, 1600);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      for (let y = 0; y < 1600; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(2400, y);
        ctx.stroke();
      }
      // Barra y mesas
      ctx.fillStyle = '#654321';
      ctx.fillRect(240, 240, 560, 110);
      for (let mx = 400; mx <= 1600; mx += 400) {
        for (let my = 560; my <= 1120; my += 360) {
          ctx.beginPath();
          ctx.arc(mx, my, 75, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }

    // Default: SRD Bastión Subterráneo
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, 0, 2400, 1600);
    ctx.fillStyle = '#262f40';
    ctx.fillRect(160, 160, 2080, 1280);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 14;
    ctx.strokeRect(160, 160, 2080, 1280);
    // Columnas tácticas
    ctx.fillStyle = '#0f172a';
    for (let cx = 480; cx <= 1920; cx += 480) {
      for (let cy = 400; cy <= 1200; cy += 400) {
        ctx.fillRect(cx - 32, cy - 32, 64, 64);
      }
    }
  },

  drawGridCanvas(state) {
    const ctx = this.els.gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);
    if (state.grid.opacity <= 0) return;

    const cs = Math.max(16, Number(state.grid.cellSize) || 80);
    const ox = Number(state.grid.offsetX) || 0;
    const oy = Number(state.grid.offsetY) || 0;
    const startX = ((ox % cs) + cs) % cs;
    const startY = ((oy % cs) + cs) % cs;
    ctx.strokeStyle =
      state.theme === 'parchment' || state.theme === 'light'
        ? `rgba(15, 23, 42, ${state.grid.opacity})`
        : `rgba(226, 232, 240, ${state.grid.opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= 2400; x += cs) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1600);
    }
    for (let y = startY; y <= 1600; y += cs) {
      ctx.moveTo(0, y);
      ctx.lineTo(2400, y);
    }
    ctx.stroke();
  },

  drawStrokesCanvas(state) {
    const ctx = this.els.drawCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;

    for (const stroke of state.strokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color || '#ef4444';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  },

  drawFogCanvas(state) {
    const ctx = this.els.fogCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);

    const hasManualFog = state.fogRects && state.fogRects.length > 0;
    const useDynamic = Boolean(state.dynamicLighting);

    if (!hasManualFog && !useDynamic) return;

    // 1. Actualizar capa de memoria explorada con los polígonos de visión actuales
    const visSources = useDynamic ? Selector.getAlliedVisibilityPolygons(state) : [];
    if (useDynamic && this.exploredCanvas && visSources.length > 0) {
      const ectx = this.exploredCanvas.getContext('2d');
      ectx.fillStyle = '#ffffff';
      for (const src of visSources) {
        if (!src.poly || src.poly.length < 3) continue;
        ectx.save();
        ectx.beginPath();
        ectx.moveTo(src.poly[0].x, src.poly[0].y);
        for (let i = 1; i < src.poly.length; i++) {
          ectx.lineTo(src.poly[i].x, src.poly[i].y);
        }
        ectx.closePath();
        ectx.clip();
        ectx.beginPath();
        ectx.arc(src.token.x, src.token.y, src.radius * 0.92, 0, Math.PI * 2);
        ectx.fill();
        ectx.restore();
      }
    }

    // 2. Cubrir el tablero con oscuridad (semitransparente para GM, opaca para Jugador)
    ctx.fillStyle = state.role === 'gm' ? 'rgba(10, 13, 20, 0.52)' : 'rgba(8, 10, 16, 0.97)';
    ctx.fillRect(0, 0, 2400, 1600);

    // 3. Revelar en penumbra las zonas previamente exploradas (solo vista Jugador)
    if (useDynamic && state.role === 'player' && this.exploredCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 0.28;
      ctx.drawImage(this.exploredCanvas, 0, 0);
      ctx.restore();
    }

    // 4. Recortar luz dinámica activa con degradado radial suave dentro de cada polígono
    if (useDynamic && visSources.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for (const src of visSources) {
        if (!src.poly || src.poly.length < 3) continue;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(src.poly[0].x, src.poly[0].y);
        for (let i = 1; i < src.poly.length; i++) {
          ctx.lineTo(src.poly[i].x, src.poly[i].y);
        }
        ctx.closePath();
        ctx.clip();

        const grad = ctx.createRadialGradient(
          src.token.x,
          src.token.y,
          src.radius * 0.18,
          src.token.x,
          src.token.y,
          src.radius
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.96)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(src.token.x, src.token.y, src.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // 5. Aplicar pincel de niebla manual si existe
    for (const f of state.fogRects || []) {
      if (f.mode === 'reveal') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r || 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = state.role === 'gm' ? 'rgba(10, 13, 20, 0.52)' : 'rgba(8, 10, 16, 0.97)';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r || 90, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Dibujar plano de muros y puertas interactivas (visibles para GM y puertas visibles para todos)
    for (const w of state.walls || []) {
      if (state.role !== 'gm' && w.kind !== 'door') continue;
      ctx.save();
      ctx.lineCap = 'round';
      if (w.kind === 'door') {
        ctx.strokeStyle = w.open ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 6;
        if (w.open) ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();

        // Indicador central clicable de puerta
        const mx = (w.x1 + w.x2) / 2;
        const my = (w.y1 + w.y2) / 2;
        ctx.setLineDash([]);
        ctx.fillStyle = w.open ? '#10b981' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(mx, my, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();
      }
      ctx.restore();
    }
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

  renderVectorOverlay(state) {
    const parts = [];
    if (state.tool === 'wall' && state.wallAnchor) {
      const cs = state.grid.cellSize / 2;
      const tx = Math.round(this.hoverWorldPos.x / cs) * cs;
      const ty = Math.round(this.hoverWorldPos.y / cs) * cs;
      const color = state.wallType === 'door' ? '#f59e0b' : '#38bdf8';
      parts.push(`
        <line x1="${state.wallAnchor.x}" y1="${state.wallAnchor.y}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="5" stroke-dasharray="6 4" />
        <circle cx="${state.wallAnchor.x}" cy="${state.wallAnchor.y}" r="6" fill="${color}" />
        <circle cx="${tx}" cy="${ty}" r="6" fill="${color}" />
      `);
    }
    if (state.ruler) {
      const { x1, y1, x2, y2 } = state.ruler;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const cells = Math.round((dist / state.grid.cellSize) * 10) / 10;
      const meters = (cells * 1.5).toFixed(1);
      const shape = state.rulerShape || 'line';
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;

      if (shape === 'circle') {
        parts.push(`
          <circle cx="${x1}" cy="${y1}" r="${dist}" fill="rgba(245, 158, 11, 0.16)" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6 4" />
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4 4" />
        `);
      } else if (shape === 'cone') {
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const half = 0.46; // ~53 deg D&D cone
        const ax = x1 + Math.cos(ang - half) * dist;
        const ay = y1 + Math.sin(ang - half) * dist;
        const bx = x1 + Math.cos(ang + half) * dist;
        const by = y1 + Math.sin(ang + half) * dist;
        parts.push(`
          <polygon points="${x1},${y1} ${ax},${ay} ${bx},${by}" fill="rgba(245, 158, 11, 0.18)" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round" />
        `);
      } else if (shape === 'cube') {
        const rx = Math.min(x1, x2);
        const ry = Math.min(y1, y2);
        const rw = Math.abs(x2 - x1);
        const rh = Math.abs(y2 - y1);
        const side = Math.max(rw, rh);
        const sideCells = Math.round((side / state.grid.cellSize) * 10) / 10;
        parts.push(`
          <rect x="${x2 >= x1 ? x1 : x1 - side}" y="${y2 >= y1 ? y1 : y1 - side}" width="${side}" height="${side}" fill="rgba(245, 158, 11, 0.16)" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6 4" />
          <rect x="${mx - 62}" y="${my - 26}" width="124" height="22" rx="11" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
          <text x="${mx}" y="${my - 11}" fill="#ffffff" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" text-anchor="middle">${sideCells}×${sideCells} cas</text>
        `);
      } else {
        parts.push(`
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f59e0b" stroke-width="4" stroke-dasharray="8 6" />
        `);
      }

      if (shape !== 'cube') {
        parts.push(`
          <circle cx="${x1}" cy="${y1}" r="6" fill="#f59e0b" />
          <circle cx="${x2}" cy="${y2}" r="6" fill="#f59e0b" />
          <rect x="${mx - 58}" y="${my - 26}" width="116" height="22" rx="11" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
          <text x="${mx}" y="${my - 11}" fill="#ffffff" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" text-anchor="middle">${cells} cas · ${meters}m</text>
        `);
      }
    }
    for (const p of state.pings) {
      parts.push(`
        <circle cx="${p.x}" cy="${p.y}" r="38" fill="none" stroke="${p.color}" stroke-width="4">
          <animate attributeName="r" from="8" to="68" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
        </circle>
      `);
    }
    this.els.overlayVectorSvg.innerHTML = parts.join('');
  },

  renderCharacterSheet(state) {
    const tok = Selector.getSelectedToken(state);
    if (!tok) {
      this.els.characterSheetDrawer.classList.remove('is-open');
      return;
    }

    this.els.sheetPortraitBox.style.backgroundColor = tok.color;
    this.els.sheetPortraitBox.innerHTML = tok.imageUrl
      ? `<img src="${tok.imageUrl}" alt="${tok.name}" class="w-full h-full object-cover" />`
      : tok.name.slice(0, 2).toUpperCase();

    if (document.activeElement !== this.els.inpSheetName) {
      this.els.inpSheetName.value = tok.name;
    }
    if (this.els.inpSheetRole && document.activeElement !== this.els.inpSheetRole) {
      this.els.inpSheetRole.value = tok.role || '';
    }
    if (this.els.lblSheetHpCur) this.els.lblSheetHpCur.textContent = String(tok.hp);
    if (this.els.inpSheetMaxHp && document.activeElement !== this.els.inpSheetMaxHp) {
      this.els.inpSheetMaxHp.value = String(tok.maxHp || 16);
    }
    const pct = tok.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((tok.hp / tok.maxHp) * 100))) : 0;
    this.els.barSheetHpFill.style.width = `${pct}%`;
    if (this.els.inpSheetAc && document.activeElement !== this.els.inpSheetAc) {
      this.els.inpSheetAc.value = String(tok.ac || 12);
    }
    const pb = Service.getProficiencyBonus(tok);
    if (this.els.inpSheetLevel && document.activeElement !== this.els.inpSheetLevel) {
      this.els.inpSheetLevel.value = String(Math.max(1, Number(tok.level) || 1));
    }
    if (this.els.lblSheetPb) this.els.lblSheetPb.textContent = `+${pb}`;
    if (this.els.inpSheetSpeed && document.activeElement !== this.els.inpSheetSpeed) {
      this.els.inpSheetSpeed.value = tok.speed || '30 ft';
    }

    const stats = tok.stats || { str: 1, dex: 1, con: 1, int: 0, wis: 0, cha: 0 };
    const scores = tok.scores || {};
    const saveProfs = tok.saveProfs || {};
    const attrDefs = [
      ['str', 'FUE'],
      ['dex', 'DES'],
      ['con', 'CON'],
      ['int', 'INT'],
      ['wis', 'SAB'],
      ['cha', 'CAR']
    ];
    this.els.sheetStatsGrid.innerHTML = attrDefs
      .map(([key, lbl]) => {
        const mod = Number(stats[key]) || 0;
        const score = Number.isFinite(Number(scores[key])) ? Number(scores[key]) : 10 + mod * 2;
        const saveProf = Boolean(saveProfs[key]);
        const saveTotal = mod + (saveProf ? pb : 0);
        const modTxt = mod >= 0 ? `+${mod}` : String(mod);
        const saveTxt = saveTotal >= 0 ? `+${saveTotal}` : String(saveTotal);
        return `
          <div class="owl-subpanel rounded-xl p-1.5 flex flex-col items-center gap-1">
            <button type="button" data-roll-stat="${lbl}:${mod}" class="w-full flex flex-col items-center hover:opacity-85" title="Tirar prueba de ${lbl}">
              <span class="text-[9.5px] font-semibold opacity-60 tracking-wide">${lbl}</span>
              <strong class="text-sm font-bold tabular-nums leading-tight">${modTxt}</strong>
            </button>
            <input type="number" data-score-key="${key}" value="${score}" min="1" max="30" class="owl-num-input w-10 text-center text-[10px] font-mono-tech opacity-80 bg-black/15 rounded-md py-0.5 outline-none" title="Puntuación de ${lbl}" />
            <div class="flex items-center justify-center gap-0.5 text-[9.5px] w-full pt-0.5 border-t" style="border-color: var(--hairline);">
              <button type="button" data-toggle-save="${key}" class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${saveProf ? 'bg-violet-500/25 text-violet-300' : 'opacity-65 hover:opacity-100 hover:bg-white/10'}" title="Competencia en salvación">
                <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="8" cy="8" r="5" />
                  ${saveProf ? '<circle cx="8" cy="8" r="2.6" fill="currentColor" stroke="none" />' : ''}
                </svg>
              </button>
              <button type="button" data-roll-save="${lbl}:${saveTotal}" class="opacity-85 hover:opacity-100 tabular-nums font-medium" title="Tirar salvación de ${lbl}">Salv ${saveTxt}</button>
            </div>
          </div>
        `;
      })
      .join('');

    this.els.sheetStatsGrid.querySelectorAll('[data-roll-stat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [lbl, val] = btn.dataset.rollStat.split(':');
        Service.state.dice.modifier = Number(val) || 0;
        Service.rollDice(20, `${tok.name} · ${lbl}`);
      });
    });
    this.els.sheetStatsGrid.querySelectorAll('[data-score-key]').forEach((inp) => {
      inp.addEventListener('change', () => {
        Service.updateTokenScore(tok.id, inp.dataset.scoreKey, inp.value);
      });
    });
    this.els.sheetStatsGrid.querySelectorAll('[data-toggle-save]').forEach((btn) => {
      btn.addEventListener('click', () => Service.toggleTokenSaveProf(tok.id, btn.dataset.toggleSave));
    });
    this.els.sheetStatsGrid.querySelectorAll('[data-roll-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [lbl, val] = btn.dataset.rollSave.split(':');
        Service.state.dice.modifier = Number(val) || 0;
        Service.rollDice(20, `${tok.name} · Salv. ${lbl}`);
      });
    });

    const sheetTab = this.activeSheetTab || 'attrs';
    const isInvTab = ['equipment', 'consumable', 'ability'].includes(sheetTab);
    if (this.els.sheetTopTabs) {
      this.els.sheetTopTabs.querySelectorAll('[data-sheet-tab]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.sheetTab === sheetTab);
      });
    }
    const panes = {
      attrs: this.els.sheetPaneAttrs,
      skills: this.els.sheetPaneSkills,
      traits: this.els.sheetPaneTraits,
      inv: this.els.sheetPaneInv
    };
    const activePaneKey = isInvTab ? 'inv' : sheetTab;
    Object.entries(panes).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('hidden', key !== activePaneKey);
      el.classList.toggle('flex', key === activePaneKey);
    });

    const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    if (this.els.sheetSkillsList) {
      const skills = Array.isArray(tok.skills) ? tok.skills : [];
      const attrLabels = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };
      const getSkillTotal = (sk) => {
        const base = sk.attr ? Number(stats[sk.attr]) || 0 : 0;
        const prof = Number(sk.prof) || 0;
        const profBonus = prof === 2 ? pb * 2 : prof === 1 ? pb : 0;
        return base + profBonus + (Number(sk.mod) || 0);
      };
      this.els.sheetSkillsList.innerHTML = skills.length
        ? skills
            .map((sk) => {
              const total = getSkillTotal(sk);
              const modTxt = total >= 0 ? `+${total}` : String(total);
              const prof = Number(sk.prof) || 0;
              const profSvg = prof === 2
                ? '<polygon points="8,2 14,8 8,14 2,8" fill="currentColor" />'
                : prof === 1
                  ? '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.8" /><circle cx="8" cy="8" r="2.6" fill="currentColor" />'
                  : '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.8" />';
              const profCls = prof === 2
                ? 'bg-amber-500/20 text-amber-300'
                : prof === 1
                  ? 'bg-violet-500/25 text-violet-300'
                  : 'owl-subpanel opacity-70 hover:opacity-100';
              const profTitle = prof === 2 ? 'Pericia (2×BC)' : prof === 1 ? 'Competente (+BC)' : 'Sin competencia';
              const attrTag = sk.attr ? `<span class="text-[9px] opacity-45 uppercase">${attrLabels[sk.attr] || ''}</span>` : '';
              return `
                <div class="owl-list-row px-2 py-1 flex items-center justify-between gap-1.5 text-[11px]">
                  <button type="button" data-prof-skill="${sk.id}" class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${profCls}" title="${profTitle}">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 16 16">${profSvg}</svg>
                  </button>
                  <button type="button" data-roll-skill="${sk.id}" class="flex-1 min-w-0 flex items-center justify-between gap-1.5 text-left hover:opacity-90" title="Tirar 1d20 ${modTxt}">
                    <span class="font-medium truncate">${esc(sk.name)} ${attrTag}</span>
                    <span class="font-mono-tech font-semibold px-1.5 py-0.5 rounded-md owl-subpanel text-[10px] shrink-0">${modTxt}</span>
                  </button>
                  <button type="button" data-del-skill="${sk.id}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 shrink-0" title="Quitar">
                    <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  </button>
                </div>
              `;
            })
            .join('')
        : `<div class="text-[10px] opacity-55 text-center py-3">Usá <b>5.5e</b> para cargar las 18 habilidades o agregá una manual.</div>`;

      this.els.sheetSkillsList.querySelectorAll('[data-prof-skill]').forEach((btn) => {
        btn.addEventListener('click', () => Service.cycleTokenSkillProf(tok.id, btn.dataset.profSkill));
      });
      this.els.sheetSkillsList.querySelectorAll('[data-roll-skill]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sk = (tok.skills || []).find((x) => x.id === btn.dataset.rollSkill);
          if (!sk) return;
          Service.state.dice.modifier = getSkillTotal(sk);
          Service.rollDice(20, `${tok.name} · ${sk.name}`);
        });
      });
      this.els.sheetSkillsList.querySelectorAll('[data-del-skill]').forEach((btn) => {
        btn.addEventListener('click', () => Service.removeTokenSkill(tok.id, btn.dataset.delSkill));
      });
    }

    if (this.els.sheetTraitsList) {
      const traits = Array.isArray(tok.traits) ? tok.traits : [];
      this.els.sheetTraitsList.innerHTML = traits.length
        ? traits
            .map(
              (tr) => `
              <div class="owl-subpanel rounded-xl px-2.5 py-1.5 flex items-start justify-between gap-2 text-[11px]">
                <div class="min-w-0">
                  <div class="font-semibold text-[11px] leading-tight">${esc(tr.title)}</div>
                  ${tr.desc ? `<div class="text-[10px] opacity-70 mt-0.5 leading-snug break-words">${esc(tr.desc)}</div>` : ''}
                </div>
                <button type="button" data-del-trait="${tr.id}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 shrink-0" title="Quitar">
                  <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
              </div>
            `
            )
            .join('')
        : `<div class="text-[10px] opacity-55 text-center py-3">Agregá ventajas, talentos o notas del personaje.</div>`;

      this.els.sheetTraitsList.querySelectorAll('[data-del-trait]').forEach((btn) => {
        btn.addEventListener('click', () => Service.removeTokenTrait(tok.id, btn.dataset.delTrait));
      });
    }

    const inv = Array.isArray(tok.inventory) ? tok.inventory : [];
    const activeInv = isInvTab ? sheetTab : 'equipment';
    const visibleInv = inv.filter((item) => this.getItemCategory(item.kind) === activeInv);
    this.els.sheetInventoryList.innerHTML = visibleInv.length
      ? visibleInv
          .map(
            (item) => `
          <div
            draggable="true"
            data-inv-uid="${item.uid}"
            class="owl-list-row px-2 py-1.5 flex items-center justify-between gap-2 text-[11px] cursor-grab transition-colors"
          >
            <div class="flex items-center gap-2 min-w-0">
              ${this.renderItemIconBadge(item)}
              <div class="min-w-0">
                <div class="font-semibold text-xs truncate">${item.name}</div>
                <div class="text-[10px] opacity-65 truncate">${item.badge || ''}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button type="button" data-use-inv="${item.uid}" class="owl-list-action px-2.5 py-0.5 text-[10px]">Usar</button>
              <button type="button" data-del-inv="${item.uid}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-60 hover:opacity-100" title="Quitar">
                <svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </div>
          </div>
        `
          )
          .join('')
      : `<div class="text-[11px] opacity-55 text-center py-6 px-2">Arrastra armas, escudos o pociones desde el Compendio.</div>`;

    this.els.sheetInventoryList.querySelectorAll('[data-inv-uid]').forEach((row) => {
      const uid = row.dataset.invUid;
      row.addEventListener('dragstart', (e) => {
        this.draggingInvUid = uid;
        row.classList.add('opacity-50');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `inv:${uid}`);
        }
      });
      row.addEventListener('dragend', () => {
        this.draggingInvUid = null;
        row.classList.remove('opacity-50');
        this.els.sheetInventoryList.querySelectorAll('[data-inv-uid]').forEach((r) => {
          r.style.borderTop = '';
          r.style.borderBottom = '';
        });
      });
      row.addEventListener('dragover', (e) => {
        if (!this.draggingInvUid || this.draggingInvUid === uid) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = row.getBoundingClientRect();
        const after = e.clientY >= rect.top + rect.height / 2;
        row.style.borderTop = after ? '' : '2px solid var(--accent-primary)';
        row.style.borderBottom = after ? '2px solid var(--accent-primary)' : '';
      });
      row.addEventListener('dragleave', () => {
        row.style.borderTop = '';
        row.style.borderBottom = '';
      });
      row.addEventListener('drop', (e) => {
        if (!this.draggingInvUid || this.draggingInvUid === uid) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = row.getBoundingClientRect();
        const after = e.clientY >= rect.top + rect.height / 2;
        const sourceUid = this.draggingInvUid;
        this.draggingInvUid = null;
        row.style.borderTop = '';
        row.style.borderBottom = '';
        Service.reorderTokenInventoryItem(tok.id, sourceUid, uid, after);
      });
    });

    this.els.sheetInventoryList.querySelectorAll('[data-use-inv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msg = Service.useTokenInventoryItem(tok.id, btn.dataset.useInv);
        if (msg) this.showActionToast(msg);
      });
    });
    this.els.sheetInventoryList.querySelectorAll('[data-del-inv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.removeTokenInventoryItem(tok.id, btn.dataset.delInv);
      });
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
          this.selectedItemIcon = it.icon && ITEM_ICON_DEFS[it.icon] ? it.icon : this.getDefaultItemIcon(it.kind);
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
  },

  syncDiceStyleUI(st) {
    if (!st || !this.els.diceStylePopover) return;
    const pop = this.els.diceStylePopover;
    const body = (st.bodyColor || '#8b5cf6').toLowerCase();
    const bevel = (st.bevelColor || '#0f172a').toLowerCase();
    const num = (st.numberColor || '#ffffff').toLowerCase();

    this.els.inpDiceBodyColor.value = body;
    this.els.inpDiceBevelColor.value = bevel;
    this.els.inpDiceNumberColor.value = num;

    const markSwatch = (attr, val) => {
      pop.querySelectorAll(`[${attr}]`).forEach((btn) => {
        btn.classList.toggle('is-active', (btn.getAttribute(attr) || '').toLowerCase() === val);
      });
    };
    markSwatch('data-body-swatch', body);
    markSwatch('data-bevel-swatch', bevel);
    markSwatch('data-number-swatch', num);

    const sz = Number(st.sizeScale) || 1;
    pop.querySelectorAll('[data-dice-size]').forEach((btn) => {
      btn.classList.toggle('is-active', Math.abs(Number(btn.dataset.diceSize) - sz) < 0.06);
    });

    const bv = st.bevelSize !== undefined ? Number(st.bevelSize) : 1;
    pop.querySelectorAll('[data-dice-bevel]').forEach((btn) => {
      btn.classList.toggle('is-active', Math.abs(Number(btn.dataset.diceBevel) - bv) < 0.25);
    });

    const tab = this.activeDiceSymbolTab || 'maxSymbol';
    pop.querySelectorAll('[data-symbol-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.symbolTab === tab);
    });

    const activeSym = st[tab] || '';
    let matchedGlyph = false;
    pop.querySelectorAll('[data-dice-glyph]').forEach((btn) => {
      const hit = btn.dataset.diceGlyph === activeSym;
      if (hit) matchedGlyph = true;
      btn.classList.toggle('is-active', hit);
    });
    if (document.activeElement !== this.els.inpDiceCustomSymbol) {
      this.els.inpDiceCustomSymbol.value = matchedGlyph ? '' : activeSym;
    }

    if (pop.classList.contains('is-open') && this.els.dicePreviewCanvas) {
      Dice3DEngine.updatePreview(this.els.dicePreviewCanvas, st, tab === 'minSymbol');
    }
  },

  renderDiceHistory(history) {
    const listEl = this.els.diceHistoryList;
    if (!listEl) return;

    const entries = Array.isArray(history) ? history : [];
    listEl.replaceChildren();

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-[11px] opacity-55 text-center py-6';
      empty.textContent = 'Sin tiradas recientes.';
      listEl.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'owl-subpanel rounded-xl px-2.5 py-2 flex items-center justify-between gap-2';

      const left = document.createElement('div');
      left.className = 'min-w-0 flex flex-col gap-0.5';

      const titleLine = document.createElement('div');
      titleLine.className = 'flex items-center gap-1.5 min-w-0';

      const title = document.createElement('span');
      title.className = 'font-medium text-[11px] truncate';
      title.textContent = entry.label || `1d${entry.sides || 20}`;
      titleLine.appendChild(title);

      if (entry.visibility === 'private') {
        const privBadge = document.createElement('span');
        privBadge.className = 'text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 shrink-0 font-medium';
        privBadge.textContent = entry.rollerRole === 'gm' ? 'Solo DJ' : 'Privada · DJ';
        titleLine.appendChild(privBadge);
      }

      if (entry.time) {
        const time = document.createElement('span');
        time.className = 'text-[10px] opacity-45 shrink-0 tabular-nums';
        time.textContent = entry.time;
        titleLine.appendChild(time);
      }
      left.appendChild(titleLine);

      const diceValues = Array.isArray(entry.dice) ? entry.dice.map((d) => d.chosen) : [entry.chosen];
      const mod = Number(entry.mod) || 0;
      const modStr = mod !== 0 ? (mod > 0 ? ` +${mod}` : ` ${mod}`) : '';
      const detailParts = [`[${diceValues.join(', ')}]${modStr}`];
      if (entry.message) detailParts.push(entry.message);

      const detail = document.createElement('div');
      detail.className = 'text-[10px] opacity-60 truncate font-mono-tech';
      detail.textContent = detailParts.join(' · ');
      left.appendChild(detail);

      const total = document.createElement('span');
      let totalTone = '';
      if (entry.isCrit) totalTone = 'text-emerald-400';
      else if (entry.isFumble) totalTone = 'text-rose-400';
      total.className = `font-mono-tech font-bold text-sm tabular-nums shrink-0 ${totalTone}`;
      total.textContent = entry.headline || String(entry.total ?? entry.chosen ?? '');

      row.appendChild(left);
      row.appendChild(total);
      listEl.appendChild(row);
    }
  },

  renderDiceReadout(state) {
    const mod = state.dice.modifier;
    this.els.lblDiceMod.textContent = mod >= 0 ? `+${mod}` : `${mod}`;
    this.els.lblDiceMod.style.color = mod !== 0 ? 'var(--accent-primary)' : '';

    const activeMode = state.dice.resultMode || 'sum';
    if (this.els.diceResultSeg) {
      this.els.diceResultSeg.querySelectorAll('[data-result-mode]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.resultMode === activeMode);
      });
    }

    const activeVis = state.dice.visibility || 'public';
    if (this.els.diceVisibilitySeg) {
      this.els.diceVisibilitySeg.querySelectorAll('[data-dice-vis]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.diceVis === activeVis);
      });
    }

    if (this.els.btnDiceCustomize && state.dice.style) {
      this.els.btnDiceCustomize.style.backgroundColor = state.dice.style.bodyColor || '#8b5cf6';
      this.els.btnDiceCustomize.style.borderColor = state.dice.style.bevelColor || '#0f172a';
      if (this.els.diceStyleDot) {
        this.els.diceStyleDot.style.backgroundColor = state.dice.style.numberColor || '#ffffff';
      }
    }

    this.syncDiceStyleUI(state.dice.style);
    this.renderDiceHistory(state.dice.history);

    const hand = Array.isArray(state.dice.hand) ? state.dice.hand : [];
    const handCounts = new Map();
    for (const sides of hand) {
      handCounts.set(sides, (handCounts.get(sides) || 0) + 1);
    }
    if (this.els.diceTrayBar) {
      for (const btn of this.els.diceTrayBar.querySelectorAll('[data-die]')) {
        const count = handCounts.get(Number(btn.dataset.die)) || 0;
        if (count > 0) {
          btn.dataset.count = String(count);
        } else {
          delete btn.dataset.count;
        }
      }
    }
    if (this.els.diceHandCursor) {
      if (hand.length > 0) {
        this.els.diceHandCursor.classList.remove('hidden');
        this.els.diceHandCursor.classList.add('flex');
        this.els.lblDiceHandCount.textContent = String(hand.length);
        this.els.stage.style.cursor = 'grabbing';
      } else {
        this.els.diceHandCursor.classList.add('hidden');
        this.els.diceHandCursor.classList.remove('flex');
        this.els.stage.style.cursor = '';
      }
    }

    const roll = state.dice.lastRoll;
    if (!roll) return;
    if (!Dice3DEngine.isFlying && roll !== this.dismissedRoll) {
      this.els.dice3dOverlay.classList.add('is-open');
    }
    const diceList = Array.isArray(roll.dice) && roll.dice.length > 0
      ? roll.dice
      : [{ sides: roll.sides, chosen: roll.chosen }];
    const summary = Service.computeRollSummary(diceList, roll.mod, activeMode);
    this.currentRollTotal = Math.max(0, Number(summary.total) || 0);
    if (this.els.diceRollActions) {
      const hasTarget = Boolean(state.selectedTokenId && this.currentRollTotal > 0);
      this.els.diceRollActions.classList.toggle('hidden', !hasTarget);
      this.els.diceRollActions.classList.toggle('flex', hasTarget);
    }
    const modTxt = roll.mod === 0 ? '' : roll.mod > 0 ? ` + ${roll.mod}` : ` − ${Math.abs(roll.mod)}`;
    this.els.lblDiceFormula.textContent = `${roll.label || '1d' + roll.sides}${modTxt}`;
    if (this.els.lblDiceMessage) {
      const msgText = String(roll.message || '').trim();
      this.els.lblDiceMessage.textContent = msgText;
      this.els.lblDiceMessage.classList.toggle('hidden', !msgText);
    }

    if (this.els.lblDiceBadge) {
      const modeNames = { each: 'c/u', max: 'Mayor', min: 'Menor' };
      let badgeText = '';
      let badgeClass = 'owl-roll-pill';
      if (summary.isCrit) {
        badgeText = 'Crítico';
        badgeClass = 'owl-roll-pill is-crit';
      } else if (summary.isFumble) {
        badgeText = 'Pifia';
        badgeClass = 'owl-roll-pill is-fumble';
      } else if (modeNames[activeMode]) {
        badgeText = modeNames[activeMode];
      }
      if (roll.visibility === 'private') {
        const privLabel = roll.rollerRole === 'gm' ? 'Solo DJ' : 'Privada · DJ';
        badgeText = badgeText ? `${badgeText} · ${privLabel}` : privLabel;
      }
      this.els.lblDiceBadge.className = badgeText ? badgeClass : 'owl-roll-pill hidden';
      this.els.lblDiceBadge.textContent = badgeText;
    }

    const glowColor = summary.isCrit
      ? 'rgba(16, 185, 129, 0.28)'
      : summary.isFumble
        ? 'rgba(239, 68, 68, 0.28)'
        : 'rgba(139, 92, 246, 0.22)';
    this.els.dice3dOverlay.style.setProperty('--roll-glow', glowColor);

    const isEachMulti = activeMode === 'each' && diceList.length > 1;
    this.els.lblDiceTotal.classList.toggle('hidden', isEachMulti);
    this.els.lblDiceTotal.textContent = summary.headline;
    this.els.lblDiceTotal.style.color = summary.isCrit
      ? 'var(--crit-text)'
      : summary.isFumble
        ? 'var(--fumble-text)'
        : 'var(--text-primary)';

    if (this.els.diceRollChips) {
      if (diceList.length > 1) {
        const pickedIdx = activeMode === 'max'
          ? diceList.reduce((best, d, i, arr) => (d.chosen > arr[best].chosen ? i : best), 0)
          : activeMode === 'min'
            ? diceList.reduce((best, d, i, arr) => (d.chosen < arr[best].chosen ? i : best), 0)
            : -1;
        this.els.diceRollChips.classList.remove('hidden');
        this.els.diceRollChips.classList.add('flex');
        this.els.diceRollChips.innerHTML = diceList.map((d, i) => {
          const val = isEachMulti ? d.chosen + roll.mod : d.chosen;
          const cls = isEachMulti
            ? 'owl-roll-chip is-hero'
            : i === pickedIdx
              ? 'owl-roll-chip is-picked'
              : 'owl-roll-chip';
          return `<span class="${cls}" title="d${d.sides}: ${d.chosen}">${val}</span>`;
        }).join('');
      } else {
        this.els.diceRollChips.classList.add('hidden');
        this.els.diceRollChips.classList.remove('flex');
        this.els.diceRollChips.innerHTML = '';
      }
    }

    if (diceList.length === 1) {
      this.els.lblDiceDetail.textContent = roll.mod !== 0
        ? `Natural ${diceList[0].chosen}${modTxt}`
        : `Natural ${diceList[0].chosen}`;
    } else if (isEachMulti) {
      this.els.lblDiceDetail.textContent = roll.mod !== 0
        ? `Base: ${diceList.map((d) => d.chosen).join(' · ')}`
        : `${diceList.length} dados individuales`;
    } else {
      this.els.lblDiceDetail.textContent = activeMode === 'max'
        ? `Mayor de ${diceList.length} dados`
        : activeMode === 'min'
          ? `Menor de ${diceList.length} dados`
          : `Suma de ${diceList.length} dados`;
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
