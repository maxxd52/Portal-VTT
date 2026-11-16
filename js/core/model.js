/* ==========================================================================
   MODEL: ESTADO INICIAL Y GENERADOR DE CÓDIGOS DE SALA
   ========================================================================== */

import { COMPENDIUM_ITEMS, buildPresetWallsForMap } from '../data/compendium.js?v=20261116a';

export const DEFAULT_DICE_STYLE = {
  bodyColor: '#8b5cf6',
  bevelColor: '#0f172a',
  bevelSize: 1.0,
  numberColor: '#ffffff',
  sizeScale: 1.0,
  maxSymbol: '',
  minSymbol: ''
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
  const roleParam = params.get('role') === 'player' ? 'player' : 'gm';

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
    role: roleParam,
    tool: 'select', // 'select' | 'pan' | 'ruler' | 'draw' | 'fog' | 'wall' | 'ping'
    rulerShape: 'line', // 'line' | 'circle' | 'cone' | 'cube'
    drawColor: '#ef4444',
    fogMode: 'reveal', // 'reveal' | 'hide'
    dynamicLighting: true,
    wallType: 'wall', // 'wall' | 'door'
    wallAnchor: null, // { x, y }
    walls: buildPresetWallsForMap('bastion'),
    mapId: 'bastion',
    activeMapKey: 'bastion',
    customMapUrl: '',
    mapGrids: {},
    notes: [],
    combat: { active: false, round: 1, turnIndex: 0, order: [] },
    compendiumTab: 'actors', // 'actors' | 'items' | 'maps'
    compendiumSearch: '',
    customActors: [],
    customItems: [],
    customMaps: [],
    compendiumFolders: { actors: [], items: [], maps: [] },
    sheetOpen: true,
    drawerOpen: true,
    room: {
      code: roomParam,
      moduleTitle: 'Aventura_Bastion'
    },
    grid: {
      cellSize: 80,
      offsetX: 0,
      offsetY: 0,
      opacity: 0.28,
      snap: true
    },
    camera: {
      x: 80,
      y: 60,
      zoom: 0.85
    },
    selectedTokenId: 'tok-1',
    tokens: [
      {
        id: 'tok-1',
        name: 'Kaelen',
        role: 'Vanguardia SRD',
        color: '#3b82f6',
        isAlly: true,
        visionRadius: 520,
        imageUrl: '',
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
        visionRadius: 560,
        imageUrl: '',
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
        visionRadius: 600,
        imageUrl: '',
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
        role: 'Hostil SRD',
        color: '#ef4444',
        isAlly: false,
        visionRadius: 420,
        imageUrl: '',
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
    fogRects: [], // { x, y, r, mode: 'reveal' | 'hide' }
    ruler: null, // { x1, y1, x2, y2 }
    pings: [],
    dice: {
      modifier: 0,
      resultMode: 'sum', // 'sum' | 'each' | 'max' | 'min'
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
