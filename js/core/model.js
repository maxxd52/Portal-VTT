/* ==========================================================================
   MODEL: ESTADO INICIAL Y GENERADOR DE CÓDIGOS DE SALA
   ========================================================================== */

import { COMPENDIUM_ITEMS, buildPresetWallsForMap } from '../data/compendium.js?v=20261123a7';
import { DEFAULT_VISION_CONFIG } from '../utils/lightingModel.js?v=20261123a7';

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
  { key: 'str', label: 'FUE', alias: 'fue', tabId: 'attrs' },
  { key: 'dex', label: 'DES', alias: 'des', tabId: 'attrs' },
  { key: 'con', label: 'CON', alias: 'con', tabId: 'attrs' },
  { key: 'int', label: 'INT', alias: 'int', tabId: 'attrs' },
  { key: 'wis', label: 'SAB', alias: 'sab', tabId: 'attrs' },
  { key: 'cha', label: 'CAR', alias: 'car', tabId: 'attrs' }
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
  dnd55: {
    label: 'D&D 5.5 (2024)',
    ruleset: 'dnd55',
    rollFormula: '1d20+@stat',
    resultMode: 'sum',
    successThreshold: 6,
    showDefense: true,
    showLevelPb: true,
    showScores: true,
    autoInitiative: true,
    enabledTabs: { skills: true, traits: true, inventory: true },
    customTabs: [],
    schema: DEFAULT_SHEET_SCHEMA
  },
  pbta: {
    label: 'PbtA / Narrativo (2d6)',
    ruleset: 'free',
    rollFormula: '2d6+@stat',
    resultMode: 'sum',
    successThreshold: 6,
    showDefense: false,
    showLevelPb: false,
    showScores: false,
    autoInitiative: true,
    enabledTabs: { skills: true, traits: true, inventory: true },
    customTabs: [],
    schema: [
      { key: 'fue', label: 'Fuerza', alias: 'fue', tabId: 'attrs' },
      { key: 'ast', label: 'Astucia', alias: 'ast', tabId: 'attrs' },
      { key: 'vol', label: 'Voluntad', alias: 'vol', tabId: 'attrs' },
      { key: 'enc', label: 'Encanto', alias: 'enc', tabId: 'attrs' }
    ]
  },
  pool: {
    label: 'Reserva (Éxitos d10)',
    ruleset: 'free',
    rollFormula: '@statd10',
    resultMode: 'success',
    successThreshold: 6,
    showDefense: false,
    showLevelPb: false,
    showScores: false,
    autoInitiative: true,
    enabledTabs: { skills: true, traits: true, inventory: true },
    customTabs: [],
    schema: [
      { key: 'fis', label: 'Físico', alias: 'fis', tabId: 'attrs' },
      { key: 'soc', label: 'Social', alias: 'soc', tabId: 'attrs' },
      { key: 'men', label: 'Mental', alias: 'men', tabId: 'attrs' }
    ]
  },
  d100: {
    label: 'Percentil (1d100)',
    ruleset: 'free',
    rollFormula: '1d100',
    resultMode: 'sum',
    successThreshold: 6,
    showDefense: false,
    showLevelPb: false,
    showScores: false,
    autoInitiative: true,
    enabledTabs: { skills: true, traits: true, inventory: true },
    customTabs: [],
    schema: [
      { key: 'fue', label: 'Fuerza', alias: 'fue', tabId: 'attrs' },
      { key: 'des', label: 'Destreza', alias: 'des', tabId: 'attrs' },
      { key: 'pod', label: 'Poder', alias: 'pod', tabId: 'attrs' },
      { key: 'int', label: 'Intelecto', alias: 'int', tabId: 'attrs' }
    ]
  },
  vieja_escuela: {
    label: 'Vieja Escuela (OSR 1d20)',
    ruleset: 'free',
    rollFormula: '1d20+@stat',
    resultMode: 'sum',
    successThreshold: 11,
    showDefense: true,
    showHp: true,
    showInit: true,
    hpLabel: 'PV',
    defenseLabel: 'DEF',
    showLevelPb: false,
    showScores: false,
    autoInitiative: true,
    enabledTabs: { skills: true, traits: true, inventory: true },
    customTabs: [],
    fixedRolls: [
      { id: 've_roll_ins', label: 'Tirada Instintos', formula: '1d20+@ins', tabId: 'header' },
      { id: 've_roll_cac', label: 'Ataque CaC', formula: '1d20+@atq+@fue', tabId: 'attrs' },
      { id: 've_roll_proy', label: 'Ataque Proyectil', formula: '1d20+@atq+@des', tabId: 'attrs' },
      { id: 've_roll_sab', label: 'Salud Mental (SAB)', formula: '1d20+@sab', tabId: 'attrs' }
    ],
    resourceSchema: [
      { id: 'res_pod', name: 'POD (Poder)', max: 1, color: '#8b5cf6', kind: 'bar', tabId: 'header' },
      { id: 'res_px', name: 'PX', max: 10, color: '#f59e0b', kind: 'bar', tabId: 'header' }
    ],
    schema: [
      { key: 'fue', label: 'FUE', alias: 'fue', tabId: 'attrs' },
      { key: 'des', label: 'DES', alias: 'des', tabId: 'attrs' },
      { key: 'con', label: 'CON', alias: 'con', tabId: 'attrs' },
      { key: 'int', label: 'INT', alias: 'int', tabId: 'attrs' },
      { key: 'sab', label: 'SAB', alias: 'sab', tabId: 'attrs' },
      { key: 'car', label: 'CAR', alias: 'car', tabId: 'attrs' },
      { key: 'atq', label: 'ATQ', alias: 'atq', tabId: 'attrs' },
      { key: 'ins', label: 'INS', alias: 'ins', tabId: 'attrs' },
      { key: 'mov', label: 'MOV', alias: 'mov', tabId: 'attrs' }
    ]
  },
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
  const isGuestPlayer = roleParam === 'player';

  const makeStarter = (keys) =>
    keys
      .map((k, idx) => {
        const found = COMPENDIUM_ITEMS.find((i) => i.key === k);
        return found ? { uid: `inv-${idx}-${k}`, ...found } : null;
      })
      .filter(Boolean);

  return {
    theme: 'slate',
    ruleset: 'dnd55', // 'dnd55' | 'free'
    systemConfig: {
      preset: 'dnd55',
      rollFormula: '1d20+@stat',
      resultMode: 'sum',
      successThreshold: 6,
      showDefense: true,
      showHp: true,
      showInit: true,
      hpLabel: 'Salud',
      defenseLabel: 'Defensa · CA',
      showLevelPb: true,
      showScores: true,
      autoInitiative: true,
      enabledTabs: { skills: true, traits: true, inventory: true },
      customTabs: [],
      sheetTabs: null,
      sheetBlocks: null,
      fixedRolls: [],
      resourceSchema: [],
      statusesSchema: null,
      vision: { ...DEFAULT_VISION_CONFIG }
    },
    sheetSchema: DEFAULT_SHEET_SCHEMA.map((s) => ({ ...s })),
    role: roleParam,
    isHostGm: roleParam !== 'player',
    tool: 'select', // 'select' | 'pan' | 'ruler' | 'draw' | 'wall' | 'ping'
    rulerShape: 'line', // 'line' | 'circle' | 'cone' | 'cube'
    drawColor: '#ef4444',
    dynamicLighting: true,
    rememberExplored: true,
    exploredMask: '',
    exploredRev: 0,
    wallType: 'wall', // 'wall' | 'door'
    wallMode: 'draw', // 'draw' | 'select'
    wallDrawKind: 'wall', // 'wall' | 'terrain' | 'door' | 'secret'
    selectedWallIds: [],
    wallSelectBox: null,
    wallAnchor: null, // { x, y }
    walls: isGuestPlayer ? [] : buildPresetWallsForMap('bastion'),
    mapId: isGuestPlayer ? 'empty' : 'bastion',
    activeMapKey: isGuestPlayer ? 'empty' : 'bastion',
    sceneMode: 'tactical',
    sceneWeather: 'none',
    sceneWeathers: {},
    customMapUrl: '',
    customMapSourceUrl: '',
    mapGrids: {},
    sceneLighting: {},
    sceneLayers: {},
    notes: [],
    combat: { active: false, round: 1, turnIndex: 0, order: [] },
    compendiumTab: 'actors', // 'actors' | 'items' | 'maps'
    compendiumSearch: '',
    customActors: [],
    customItems: [],
    customMaps: [],
    compendiumFolders: { actors: [], items: [], maps: [] },
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
      moduleTitle: 'Aventura_Bastion'
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
    selectedTokenId: roleParam === 'player' ? null : 'tok-1',
    tokens: isGuestPlayer ? [] : [
      {
        id: 'tok-1',
        name: 'Kaelen',
        role: 'Vanguardia SRD',
        color: '#3b82f6',
        isAlly: true,
        visionMeters: null,
        lightMeters: 0,
        imageUrl: '',
        mediaId: '',
        publicDescription: '',
        privateNotes: '',
        size: 1,
        x: 440,
        y: 440,
        hp: 24,
        maxHp: 24,
        ac: 16,
        stats: { str: 3, dex: 1, con: 2, int: 0 },
        inventory: makeStarter(['longsword', 'shield_wood']),
        hidden: false
      },
      {
        id: 'tok-2',
        name: 'Lyra',
        role: 'Conjuradora SRD',
        color: '#8b5cf6',
        isAlly: true,
        visionMeters: null,
        lightMeters: 0,
        imageUrl: '',
        mediaId: '',
        publicDescription: '',
        privateNotes: '',
        size: 1,
        x: 360,
        y: 600,
        hp: 14,
        maxHp: 14,
        ac: 12,
        stats: { str: -1, dex: 2, con: 1, int: 3 },
        inventory: makeStarter(['firebolt', 'potion_heal']),
        hidden: false
      },
      {
        id: 'tok-3',
        name: 'Vex',
        role: 'Explorador SRD',
        color: '#10b981',
        isAlly: true,
        visionMeters: null,
        lightMeters: 0,
        imageUrl: '',
        mediaId: '',
        publicDescription: '',
        privateNotes: '',
        size: 1,
        x: 520,
        y: 600,
        hp: 18,
        maxHp: 18,
        ac: 15,
        stats: { str: 0, dex: 3, con: 1, int: 1 },
        inventory: makeStarter(['dagger_twin']),
        hidden: false
      },
      {
        id: 'tok-4',
        name: 'Acechador Trasgo',
        role: 'Secundario SRD',
        color: '#ef4444',
        isAlly: false,
        visionMeters: null,
        lightMeters: 0,
        imageUrl: '',
        mediaId: '',
        publicDescription: '',
        privateNotes: '',
        size: 1,
        x: 1080,
        y: 480,
        hp: 10,
        maxHp: 10,
        ac: 13,
        stats: { str: -1, dex: 2, con: 0, int: -1 },
        inventory: makeStarter(['scimitar']),
        hidden: false
      }
    ],
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
