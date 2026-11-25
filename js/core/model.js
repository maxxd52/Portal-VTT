/* ==========================================================================
   MODEL: ESTADO INICIAL Y GENERADOR DE CÓDIGOS DE SALA
   ========================================================================== */

import { DEFAULT_VISION_CONFIG } from '../utils/lightingModel.js?v=20261125a1';

export const DEFAULT_DICE_STYLE = {
  bodyColor: '#8b5cf6',
  bevelColor: '#0f172a',
  bevelSize: 1.0,
  numberColor: '#ffffff',
  sizeScale: 1.0,
  maxSymbol: '',
  minSymbol: ''
};

export const DEFAULT_SHEET_SCHEMA = [
  { key: 'vig', label: 'Vigor', alias: 'vig', tabId: 'attrs' },
  { key: 'agi', label: 'Agilidad', alias: 'agi', tabId: 'attrs' },
  { key: 'men', label: 'Mente', alias: 'men', tabId: 'attrs' }
];

export const DEFAULT_STATUS_DEFS = [
  { key: 'confused', label: 'Confundido', color: '#a855f7', icon: 'confused' },
  { key: 'flame', label: 'Ardiendo', color: '#f97316', icon: 'flame' },
  { key: 'poison', label: 'Envenenado', color: '#10b981', icon: 'poison' },
  { key: 'bolt', label: 'Aturdido', color: '#eab308', icon: 'bolt' },
  { key: 'shield', label: 'Protegido', color: '#3b82f6', icon: 'shield' },
  { key: 'bleed', label: 'Sangrando', color: '#ef4444', icon: 'bleed' },
  { key: 'hidden', label: 'Oculto', color: '#6366f1', icon: 'hidden' },
  { key: 'down', label: 'Derribado', color: '#64748b', icon: 'down' },
  { key: 'frost', label: 'Congelado', color: '#06b6d4', icon: 'frost' },
  { key: 'mark', label: 'Marcado', color: '#ec4899', icon: 'mark' }
];

export const GENERIC_STARTER_BLOCKS = [
  { id: 'blk_hp', kind: 'resource', key: 'hp', label: 'Salud', max: 18, color: '#10b981', resStyle: 'bar', tabId: 'header', size: '1/2' },
  { id: 'blk_def', kind: 'number', key: 'ac', label: 'Defensa', rollMode: 'none', formula: '', tabId: 'header', size: '1/2' },
  { id: 'blk_init', kind: 'text', textMode: 'fixed', fixedText: '', clickAction: 'roll', isInitiative: true, key: 'init', label: 'Iniciativa', formula: '1d20+@agi', tabId: 'header', size: '1/3' },
  { id: 'blk_vig', kind: 'number', key: 'vig', label: 'Vigor', rollMode: 'base', formula: '', tabId: 'attrs', size: '1/3' },
  { id: 'blk_agi', kind: 'number', key: 'agi', label: 'Agilidad', rollMode: 'base', formula: '', tabId: 'attrs', size: '1/3' },
  { id: 'blk_men', kind: 'number', key: 'men', label: 'Mente', rollMode: 'base', formula: '', tabId: 'attrs', size: '1/3' }
];

export const SYSTEM_PRESETS = {
  free: {
    label: 'Sistema Genérico',
    ruleset: 'free',
    rollFormula: '1d20+@stat',
    resultMode: 'sum',
    successThreshold: 6,
    showDefense: true,
    showHp: true,
    showInit: true,
    hpLabel: 'Salud',
    defenseLabel: 'Defensa · CA',
    showLevelPb: false,
    showScores: false,
    autoInitiative: true,
    enabledTabs: { skills: false, traits: false, inventory: true },
    customTabs: [],
    sheetTabs: [
      { id: 'attrs', label: 'Atributos', mode: 'fixed', sumTotal: false },
      { id: 'equipment', label: 'Equipo', mode: 'items' },
      { id: 'ability', label: 'Capacidades', mode: 'items' }
    ],
    fixedRolls: [],
    sheetBlocks: GENERIC_STARTER_BLOCKS,
    schema: [
      { key: 'vig', label: 'Vigor', alias: 'vig', tabId: 'attrs' },
      { key: 'agi', label: 'Agilidad', alias: 'agi', tabId: 'attrs' },
      { key: 'men', label: 'Mente', alias: 'men', tabId: 'attrs' }
    ]
  }
};

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'PORTAL-';
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function createInitialState() {
  const params = new URLSearchParams(window.location.search);
  const roomParam = (params.get('room') || 'MESA-01').toUpperCase();
  const inviteParam = (params.get('invite') || '').trim();
  const roleParam = params.get('role') === 'player' || inviteParam ? 'player' : 'gm';

  return {
    theme: 'slate',
    ruleset: 'free',
    systemConfig: {
      preset: 'free',
      rollFormula: '1d20+@stat',
      resultMode: 'sum',
      successThreshold: 6,
      showDefense: true,
      showHp: true,
      showInit: true,
      hpLabel: 'Salud',
      defenseLabel: 'Defensa · CA',
      showLevelPb: false,
      showScores: false,
      autoInitiative: true,
      enabledTabs: { skills: false, traits: false, inventory: true },
      customTabs: [],
      sheetTabs: SYSTEM_PRESETS.free.sheetTabs.map((t) => ({ ...t })),
      sheetBlocks: GENERIC_STARTER_BLOCKS.map((b) => ({ ...b })),
      fixedRolls: [],
      resourceSchema: [],
      statusesSchema: null,
      vision: { ...DEFAULT_VISION_CONFIG }
    },
    sheetSchema: SYSTEM_PRESETS.free.schema.map((s) => ({ ...s })),
    role: roleParam,
    isHostGm: roleParam !== 'player',
    tool: 'select', // 'select' | 'pan' | 'ruler' | 'draw' | 'wall' | 'ping'
    rulerShape: 'line', // 'line' | 'circle' | 'cone' | 'cube'
    drawColor: '#ef4444',
    dynamicLighting: true,
    sceneAmbientLight: 'day',
    rememberExplored: true,
    exploredMask: '',
    exploredRev: 0,
    wallType: 'wall', // 'wall' | 'door'
    wallMode: 'draw', // 'draw' | 'select' | 'door'
    stageLayer: 'walls', // 'walls' | 'lights'
    wallDrawKind: 'wall', // 'wall' | 'terrain' | 'invisible'
    wallDrawDoor: 'none', // 'none' | 'normal' | 'secret'
    wallDoorStampMode: 'normal', // 'normal' | 'secret'
    stageSelectFilter: 'all', // 'all' | 'walls' | 'lights'
    selectedWallIds: [],
    selectedMapLightIds: [],
    wallSelectBox: null,
    wallAnchor: null, // { x, y }
    walls: [],
    mapId: 'empty',
    activeMapKey: 'empty',
    sceneMode: 'tactical',
    sceneWeather: 'none',
    sceneWeathers: {},
    customMapUrl: '',
    customMapSourceUrl: '',
    mapGrids: {},
    sceneLighting: {},
    sceneLayers: {},
    mapLights: [],
    notes: [],
    combat: { active: false, round: 1, turnIndex: 0, order: [] },
    compendiumTab: 'actors', // 'actors' | 'items' | 'maps'
    compendiumSearch: '',
    customActors: [],
    customItems: [],
    customMaps: [],
    compendiumFolders: { actors: [], items: [], maps: [] },
    compendiumFolderOverrides: { actors: {}, items: {}, maps: {} },
    sheetOpen: false,
    drawerOpen: false,
    gmScreenOpen: false,
    journalOpen: false,
    gmScreen: null,
    publicClocks: [],
    mediaAssets: {},
    journal: {
      gmFolders: [],
      gmNotes: [],
      playerJournals: {},
      receivedReveals: []
    },
    activeJournalPresentation: null,
    inspectTokenId: null,
    activeInviteId: inviteParam || '',
    playerInvites: [],
    room: {
      code: roomParam,
      moduleTitle: 'Portal_Nuevo'
    },
    grid: {
      type: 'square',
      cellSize: 80,
      metersPerUnit: 1.5,
      offsetX: 0,
      offsetY: 0,
      opacity: 0.28,
      snap: true,
      color: 'auto'
    },
    camera: {
      x: 80,
      y: 60,
      zoom: 0.85
    },
    selectedTokenId: null,
    tokens: [],
    strokes: [],
    ruler: null, // { x1, y1, x2, y2 }
    areaSelectConfig: null, // { radiusPx, label, stepIndex }
    activeSequence: null,
    activeRollRequest: null,
    pendingRollRequests: [],
    pings: [],
    dice: {
      modifier: 0,
      resultMode: 'sum', // 'sum' | 'each' | 'max' | 'min' | 'success'
      successThreshold: 6,
      visibility: 'public', // 'public' | 'private'
      hand: [],
      style: { ...DEFAULT_DICE_STYLE },
      lastRoll: null,
      history: []
    },
    shelfModules: [],
    events: []
  };
}
