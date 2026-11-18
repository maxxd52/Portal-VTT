/* ==========================================================================
   MODEL: COMPENDIO SRD (PERSONAJES, OBJETOS, MAPAS) Y MUROS PREDEFINIDOS
   ========================================================================== */

import { DND55_CLASS_ITEMS } from './dnd55Classes.js?v=20261117b1';

export const COMPENDIUM_ACTORS = [
  {
    key: 'warrior',
    name: 'Kaelen (Guerrero)',
    role: 'Vanguardia SRD',
    color: '#3b82f6',
    isAlly: true,
    visionRadius: 520,
    hp: 24,
    ac: 16,
    stats: { str: 3, dex: 1, con: 2, int: 0 },
    starterItems: ['longsword', 'shield_wood']
  },
  {
    key: 'mage',
    name: 'Lyra (Maga)',
    role: 'Conjuradora SRD',
    color: '#8b5cf6',
    isAlly: true,
    visionRadius: 560,
    hp: 14,
    ac: 12,
    stats: { str: -1, dex: 2, con: 1, int: 3 },
    starterItems: ['firebolt', 'potion_heal']
  },
  {
    key: 'rogue',
    name: 'Vex (Pícaro)',
    role: 'Explorador SRD',
    color: '#10b981',
    isAlly: true,
    visionRadius: 600,
    hp: 18,
    ac: 15,
    stats: { str: 0, dex: 3, con: 1, int: 1 },
    starterItems: ['dagger_twin', 'potion_heal']
  },
  {
    key: 'goblin',
    name: 'Acechador Trasgo',
    role: 'Secundario SRD',
    color: '#ef4444',
    isAlly: false,
    visionRadius: 420,
    hp: 10,
    ac: 13,
    stats: { str: -1, dex: 2, con: 0, int: -1 },
    starterItems: ['scimitar']
  },
  {
    key: 'ogre',
    name: 'Guardián de Piedra',
    role: 'Jefe SRD',
    color: '#f59e0b',
    isAlly: false,
    visionRadius: 420,
    hp: 42,
    ac: 15,
    stats: { str: 4, dex: -1, con: 3, int: -2 },
    starterItems: ['greatclub']
  }
];

export const COMPENDIUM_ITEMS = [
  { key: 'longsword', name: 'Espada Larga +1', kind: 'weapon', badge: 'ATQ +4 (1d8)', bonusMod: 4, die: 8, acBonus: 0, heal: 0, lightRadius: 0, color: '#3b82f6' },
  { key: 'firebolt', name: 'Descarga Ígnea', kind: 'weapon', badge: 'CONJ +5 (1d10)', bonusMod: 5, die: 10, acBonus: 0, heal: 0, lightRadius: 0, color: '#f97316' },
  { key: 'dagger_twin', name: 'Daga Sombría', kind: 'weapon', badge: 'ATQ +5 (1d6)', bonusMod: 5, die: 6, acBonus: 0, heal: 0, lightRadius: 0, color: '#10b981' },
  { key: 'scimitar', name: 'Cimitarra Curva', kind: 'weapon', badge: 'ATQ +4 (1d6)', bonusMod: 4, die: 6, acBonus: 0, heal: 0, lightRadius: 0, color: '#ef4444' },
  { key: 'greatclub', name: 'Garrote Rúnico', kind: 'weapon', badge: 'ATQ +6 (1d12)', bonusMod: 6, die: 12, acBonus: 0, heal: 0, lightRadius: 0, color: '#f59e0b' },
  { key: 'shield_wood', name: 'Escudo Reforzado', kind: 'armor', badge: '+2 CA', bonusMod: 0, die: 0, acBonus: 2, heal: 0, lightRadius: 0, color: '#06b6d4' },
  { key: 'torch', name: 'Antorcha Táctica', kind: 'light', badge: 'Luz +5 cas', bonusMod: 0, die: 0, acBonus: 0, heal: 0, lightRadius: 400, color: '#fbbf24' },
  { key: 'potion_heal', name: 'Poción de Curación', kind: 'consumable', badge: 'Cura +8 HP', bonusMod: 0, die: 0, acBonus: 0, heal: 8, lightRadius: 0, color: '#ec4899' },
  ...DND55_CLASS_ITEMS
];

export const COMPENDIUM_MAPS = [
  { key: 'bastion', name: 'SRD: Bastión Subterráneo', desc: 'Salas de piedra, columnas, muros y puerta táctica.' },
  { key: 'forest', name: 'SRD: Claro del Bosque', desc: 'Sendero de tierra, arroyo y arboleda abierta.' },
  { key: 'tavern', name: 'SRD: Taberna Engranaje', desc: 'Salón de madera con tabiques y barra central.' },
  { key: 'crypt', name: 'D&D: Cripta Antigua', desc: 'Cámaras funerarias, sarcófagos, columnas y altar central.' },
  { key: 'arena', name: 'D&D: Arena de Combate', desc: 'Coliseo circular de arena con 4 pilares de cobertura.' },
  { key: 'cavern', name: 'D&D: Caverna Subterránea', desc: 'Galería rocosa con río subterráneo y pasos estrechos.' }
];

export function buildPresetWallsForMap(mapId) {
  if (mapId === 'bastion') {
    const walls = [
      // Perímetro exterior del Bastión
      { id: 'w-ext-top', x1: 160, y1: 160, x2: 2240, y2: 160, kind: 'wall', open: false },
      { id: 'w-ext-bot', x1: 160, y1: 1440, x2: 2240, y2: 1440, kind: 'wall', open: false },
      { id: 'w-ext-left', x1: 160, y1: 160, x2: 160, y2: 1440, kind: 'wall', open: false },
      { id: 'w-ext-right', x1: 2240, y1: 160, x2: 2240, y2: 1440, kind: 'wall', open: false },
      // Tabique central con puerta interactiva que oculta la cámara este
      { id: 'w-div-top', x1: 800, y1: 160, x2: 800, y2: 440, kind: 'wall', open: false },
      { id: 'w-door-main', x1: 800, y1: 440, x2: 800, y2: 560, kind: 'door', open: false },
      { id: 'w-div-bot', x1: 800, y1: 560, x2: 800, y2: 1440, kind: 'wall', open: false }
    ];
    // Columnas tácticas que proyectan sombras reales
    for (let cx = 480; cx <= 1920; cx += 480) {
      for (let cy = 400; cy <= 1200; cy += 400) {
        const idBase = `p-${cx}-${cy}`;
        walls.push(
          { id: `${idBase}-t`, x1: cx - 32, y1: cy - 32, x2: cx + 32, y2: cy - 32, kind: 'wall', open: false },
          { id: `${idBase}-b`, x1: cx - 32, y1: cy + 32, x2: cx + 32, y2: cy + 32, kind: 'wall', open: false },
          { id: `${idBase}-l`, x1: cx - 32, y1: cy - 32, x2: cx - 32, y2: cy + 32, kind: 'wall', open: false },
          { id: `${idBase}-r`, x1: cx + 32, y1: cy - 32, x2: cx + 32, y2: cy + 32, kind: 'wall', open: false }
        );
      }
    }
    return walls;
  }
  if (mapId === 'crypt') {
    return [
      { id: 'c-ext-top', x1: 200, y1: 200, x2: 2200, y2: 200, kind: 'wall', open: false },
      { id: 'c-ext-bot', x1: 200, y1: 1400, x2: 2200, y2: 1400, kind: 'wall', open: false },
      { id: 'c-ext-left', x1: 200, y1: 200, x2: 200, y2: 1400, kind: 'wall', open: false },
      { id: 'c-ext-right', x1: 2200, y1: 200, x2: 2200, y2: 1400, kind: 'wall', open: false },
      { id: 'c-div-l', x1: 720, y1: 200, x2: 720, y2: 640, kind: 'wall', open: false },
      { id: 'c-door-l', x1: 720, y1: 640, x2: 720, y2: 800, kind: 'door', open: false },
      { id: 'c-div-l2', x1: 720, y1: 800, x2: 720, y2: 1400, kind: 'wall', open: false },
      { id: 'c-div-r', x1: 1680, y1: 200, x2: 1680, y2: 640, kind: 'wall', open: false },
      { id: 'c-door-r', x1: 1680, y1: 640, x2: 1680, y2: 800, kind: 'door', open: false },
      { id: 'c-div-r2', x1: 1680, y1: 800, x2: 1680, y2: 1400, kind: 'wall', open: false }
    ];
  }
  return [];
}
