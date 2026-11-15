/* ==========================================================================
   SERVICE: LÓGICA DE NEGOCIO, MUTACIONES Y SINCRONIZACIÓN
   ========================================================================== */

import { COMPENDIUM_ITEMS, buildPresetWallsForMap } from '../data/compendium.js';
import { BrowserVault } from '../services/browserVault.js?v=20261115q';
import { CompendiumServiceMethods } from '../services/compendiumService.js?v=20261115q';
import { DiceServiceMethods } from '../services/diceService.js?v=20261115q';
import { RealtimeBridge } from '../services/realtimeBridge.js';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { createInitialState, generateRoomCode } from './model.js?v=20261115q';
import { Selector } from './selector.js?v=20261115q';

const getOrCreateClientId = () => {
  try {
    let cid = sessionStorage.getItem('owl_client_id');
    if (!cid) {
      cid = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem('owl_client_id', cid);
    }
    return cid;
  } catch (_) {
    return `c-${Math.random().toString(36).slice(2, 8)}`;
  }
};

export const Service = {
  state: createInitialState(),
  listeners: [],
  loadedMapImage: null,
  clientId: getOrCreateClientId(),
  peers: new Map(),
  undoStack: [],
  redoStack: [],

  ...CompendiumServiceMethods,
  ...DiceServiceMethods,

  captureSnapshot() {
    return JSON.stringify({
      tokens: this.state.tokens || [],
      strokes: this.state.strokes || [],
      fogRects: this.state.fogRects || [],
      walls: this.state.walls || [],
      notes: this.state.notes || []
    });
  },

  pushUndoSnapshot() {
    this.undoStack.push(this.captureSnapshot());
    if (this.undoStack.length > 20) this.undoStack.shift();
    this.redoStack = [];
  },

  applySnapshot(raw) {
    if (!raw) return false;
    const snap = JSON.parse(raw);
    this.state.tokens = snap.tokens || [];
    this.state.strokes = snap.strokes || [];
    this.state.fogRects = snap.fogRects || [];
    this.state.walls = snap.walls || [];
    this.state.notes = snap.notes || [];
    if (this.state.selectedTokenId && !this.state.tokens.some((t) => t.id === this.state.selectedTokenId)) {
      this.state.selectedTokenId = this.state.tokens[0] ? this.state.tokens[0].id : null;
    }
    this.notify({ clearExplored: true, redrawMap: true, redrawDraw: true, redrawFog: true });
    RealtimeBridge.send({ kind: 'WORLD_SYNC', world: Selector.extractSerializableWorld(this.state) });
    return true;
  },

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(this.captureSnapshot());
    return this.applySnapshot(this.undoStack.pop());
  },

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(this.captureSnapshot());
    return this.applySnapshot(this.redoStack.pop());
  },

  canControlToken(tok) {
    if (!tok) return false;
    if (this.state.role === 'gm') return true;
    if (tok.ownerId) return tok.ownerId === this.clientId;
    return tok.isAlly !== false;
  },

  updatePeerPresence(peer) {
    if (!peer || !peer.clientId || peer.clientId === this.clientId) return;
    if (peer.leaving) {
      this.peers.delete(peer.clientId);
    } else {
      this.peers.set(peer.clientId, {
        clientId: peer.clientId,
        role: peer.role || 'player',
        lastSeen: Date.now()
      });
    }
    this.pruneStalePeers();
    this.notify({ skipVaultSave: true });
  },

  pruneStalePeers() {
    const now = Date.now();
    for (const [id, p] of this.peers.entries()) {
      if (now - p.lastSeen > 26000) this.peers.delete(id);
    }
  },

  getActivePeers() {
    this.pruneStalePeers();
    return [
      { clientId: this.clientId, role: this.state.role || 'gm', self: true },
      ...Array.from(this.peers.values())
    ];
  },

  showHandout(url, title = 'Handout') {
    const cleanUrl = DriveUrlHelper.toDirectImageUrl(url) || String(url || '').trim();
    if (!cleanUrl) return;
    const handout = { url: cleanUrl, title: String(title || 'Handout').trim() };
    this.state.activeHandout = handout;
    RealtimeBridge.send({ kind: 'HANDOUT_SHOW', handout });
    this.notify({ skipVaultSave: true });
  },

  closeHandout(forAll = false) {
    this.state.activeHandout = null;
    if (forAll && this.state.role === 'gm') {
      RealtimeBridge.send({ kind: 'HANDOUT_CLOSE' });
    }
    this.notify({ skipVaultSave: true });
  },

  subscribe(fn) {
    this.listeners.push(fn);
  },

  notify(opts = {}) {
    if (!opts.skipVaultSave) {
      BrowserVault.saveRoom(this.state.room.code, Selector.extractSerializableWorld(this.state));
    }
    this.listeners.forEach((fn) => fn(this.state, opts));
  },

  recordEvent(type, detail, { broadcast = true } = {}) {
    this.state.events.push({
      id: this.state.events.length + 1,
      ts: new Date().toLocaleTimeString(),
      type,
      detail
    });
    if (this.state.events.length > 200) {
      this.state.events.shift();
    }
    if (broadcast) {
      RealtimeBridge.send({ kind: 'WORLD_SYNC', world: Selector.extractSerializableWorld(this.state) });
    }
  },

  async restoreFromVault() {
    this.loadDiceStyle();
    const savedShelf = await BrowserVault.loadShelf();
    if (savedShelf) this.state.shelfModules = savedShelf;

    const saved = await BrowserVault.loadRoom(this.state.room.code);
    if (saved && Array.isArray(saved.tokens)) {
      this.applyFullWorldState(saved, true);
    }
  },

  async createPortal({ title = '', ruleset = 'dnd55', mapId = 'bastion', dynamicLighting = true, showGrid = true } = {}) {
    const code = generateRoomCode();
    const next = createInitialState();
    next.role = 'gm';
    next.ruleset = ruleset === 'free' ? 'free' : 'dnd55';
    next.room.code = code;
    next.room.moduleTitle = String(title || '').trim() || `Portal ${code}`;
    next.dynamicLighting = Boolean(dynamicLighting);
    next.grid.opacity = showGrid ? 0.28 : 0;

    if (mapId === 'empty') {
      next.mapId = 'empty';
      next.activeMapKey = 'empty';
      next.walls = [];
      next.tokens = [];
      next.selectedTokenId = null;
    } else if (mapId === 'forest' || mapId === 'tavern' || mapId === 'bastion') {
      next.mapId = mapId;
      next.activeMapKey = mapId;
      next.walls = buildPresetWallsForMap(mapId);
    }

    this.state = next;
    this.loadedMapImage = null;
    this.undoStack = [];
    this.redoStack = [];
    await BrowserVault.saveRoom(code, Selector.extractSerializableWorld(this.state));
    this.notify({
      clearExplored: true,
      redrawMap: true,
      redrawGrid: true,
      redrawDraw: true,
      redrawFog: true
    });
    return code;
  },

  async openPortal(roomCode, role = 'gm') {
    const code = String(roomCode || '').trim().toUpperCase();
    if (!code) return;
    const next = createInitialState();
    next.role = role === 'player' ? 'player' : 'gm';
    next.room.code = code;
    this.state = next;
    this.loadedMapImage = null;
    this.undoStack = [];
    this.redoStack = [];
    await this.restoreFromVault();
    this.notify({
      clearExplored: true,
      redrawMap: true,
      redrawGrid: true,
      redrawDraw: true,
      redrawFog: true,
      skipVaultSave: true
    });
  },

  applyFullWorldState(world, silent = false) {
    if (!world) return;
    if (world.moduleTitle) this.state.room.moduleTitle = world.moduleTitle;
    if (world.ruleset) this.state.ruleset = world.ruleset;
    if (world.mapId) this.state.mapId = world.mapId;
    if (world.activeMapKey) this.state.activeMapKey = world.activeMapKey;
    if (world.mapGrids && typeof world.mapGrids === 'object') this.state.mapGrids = world.mapGrids;
    if (world.sceneLayers && typeof world.sceneLayers === 'object') this.state.sceneLayers = world.sceneLayers;
    if (typeof world.dynamicLighting === 'boolean') this.state.dynamicLighting = world.dynamicLighting;
    if (Array.isArray(world.walls)) this.state.walls = world.walls;
    this.state.customMapUrl = world.customMapUrl || '';
    if (this.state.customMapUrl) {
      this.loadExternalMapImage(this.state.customMapUrl);
    } else {
      this.loadedMapImage = null;
    }
    if (world.grid) Object.assign(this.state.grid, world.grid);
    if (Array.isArray(world.customActors)) this.state.customActors = world.customActors;
    if (Array.isArray(world.customItems)) this.state.customItems = world.customItems;
    if (Array.isArray(world.customMaps)) this.state.customMaps = world.customMaps;
    if (world.compendiumFolders) {
      this.state.compendiumFolders = {
        actors: Array.isArray(world.compendiumFolders.actors) ? world.compendiumFolders.actors : [],
        items: Array.isArray(world.compendiumFolders.items) ? world.compendiumFolders.items : [],
        maps: Array.isArray(world.compendiumFolders.maps) ? world.compendiumFolders.maps : []
      };
    }
    if (Array.isArray(world.tokens)) this.state.tokens = world.tokens;
    if (Array.isArray(world.strokes)) this.state.strokes = world.strokes;
    if (Array.isArray(world.fogRects)) this.state.fogRects = world.fogRects;
    if (Array.isArray(world.notes)) this.state.notes = world.notes;
    if (world.combat && typeof world.combat === 'object') {
      this.state.combat = {
        active: Boolean(world.combat.active),
        round: Number(world.combat.round) || 1,
        turnIndex: Number(world.combat.turnIndex) || 0,
        order: Array.isArray(world.combat.order) ? world.combat.order : []
      };
    }
    this.state.selectedTokenId = this.state.tokens[0] ? this.state.tokens[0].id : null;
    this.notify({
      clearExplored: true,
      redrawMap: true,
      redrawGrid: true,
      redrawDraw: true,
      redrawFog: true,
      skipVaultSave: silent
    });
  },

  loadExternalMapImage(url) {
    const direct = DriveUrlHelper.toDirectImageUrl(url);
    if (!direct) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.loadedMapImage = img;
      this.notify({ redrawMap: true });
    };
    img.src = direct;
  },

  getActiveSceneKey() {
    if (this.state.activeMapKey) return this.state.activeMapKey;
    if (this.state.mapId === 'custom' && this.state.customMapUrl) {
      return `url:${this.state.customMapUrl}`;
    }
    return this.state.mapId || 'bastion';
  },

  saveActiveMapGrid() {
    const key = this.getActiveSceneKey();
    if (!this.state.mapGrids || typeof this.state.mapGrids !== 'object') {
      this.state.mapGrids = {};
    }
    const snapshot = {
      cellSize: Number(this.state.grid.cellSize) || 80,
      offsetX: Number(this.state.grid.offsetX) || 0,
      offsetY: Number(this.state.grid.offsetY) || 0,
      opacity: typeof this.state.grid.opacity === 'number' ? this.state.grid.opacity : 0.28,
      snap: Boolean(this.state.grid.snap)
    };
    this.state.mapGrids[key] = snapshot;
    const customMap = (this.state.customMaps || []).find((m) => m.key === key);
    if (customMap) customMap.grid = { ...snapshot };
  },

  updateGrid(patch) {
    Object.assign(this.state.grid, patch);
    this.saveActiveMapGrid();
    this.notify({ redrawGrid: true });
  },

  saveActiveSceneLayers() {
    const key = this.getActiveSceneKey();
    if (!this.state.sceneLayers || typeof this.state.sceneLayers !== 'object') {
      this.state.sceneLayers = {};
    }
    this.state.sceneLayers[key] = {
      tokens: Array.isArray(this.state.tokens) ? JSON.parse(JSON.stringify(this.state.tokens)) : [],
      walls: Array.isArray(this.state.walls) ? this.state.walls.map((w) => ({ ...w })) : [],
      fogRects: Array.isArray(this.state.fogRects) ? this.state.fogRects.map((f) => ({ ...f })) : [],
      strokes: Array.isArray(this.state.strokes)
        ? this.state.strokes.map((s) => ({
            ...s,
            points: Array.isArray(s.points) ? s.points.map((p) => ({ ...p })) : []
          }))
        : []
    };
  },

  async changeMap(mapId, customUrl = '', sceneKey = '') {
    this.saveActiveMapGrid();
    this.saveActiveSceneLayers();
    const nextKey = sceneKey || (mapId === 'custom' && customUrl ? `url:${customUrl}` : mapId);
    this.state.mapId = mapId;
    this.state.activeMapKey = nextKey;
    const savedLayers = this.state.sceneLayers && this.state.sceneLayers[nextKey];
    if (mapId === 'custom' && customUrl) {
      this.state.customMapUrl = customUrl;
      this.state.walls = savedLayers && Array.isArray(savedLayers.walls)
        ? savedLayers.walls.map((w) => ({ ...w }))
        : [];
      this.loadExternalMapImage(customUrl);
    } else {
      this.state.customMapUrl = '';
      this.loadedMapImage = null;
      this.state.walls = savedLayers && Array.isArray(savedLayers.walls)
        ? savedLayers.walls.map((w) => ({ ...w }))
        : buildPresetWallsForMap(mapId);
    }
    this.state.tokens = savedLayers && Array.isArray(savedLayers.tokens)
      ? JSON.parse(JSON.stringify(savedLayers.tokens))
      : [];
    this.state.selectedTokenId = this.state.tokens[0] ? this.state.tokens[0].id : null;
    this.state.fogRects = savedLayers && Array.isArray(savedLayers.fogRects)
      ? savedLayers.fogRects.map((f) => ({ ...f }))
      : [];
    this.state.strokes = savedLayers && Array.isArray(savedLayers.strokes)
      ? savedLayers.strokes.map((s) => ({
          ...s,
          points: Array.isArray(s.points) ? s.points.map((p) => ({ ...p })) : []
        }))
      : [];
    const customMap = (this.state.customMaps || []).find((m) => m.key === nextKey);
    const savedGrid = (this.state.mapGrids && this.state.mapGrids[nextKey]) || customMap?.grid || null;
    this.state.grid = {
      cellSize: 80,
      offsetX: 0,
      offsetY: 0,
      opacity: 0.28,
      snap: true,
      ...(savedGrid || {})
    };
    this.recordEvent('MAPA', mapId);
    this.notify({ clearExplored: true, redrawMap: true, redrawGrid: true, redrawDraw: true, redrawFog: true });
  },

  setRole(role) {
    this.state.role = role === 'player' ? 'player' : 'gm';
    this.notify({ redrawFog: true });
  },

  setTool(tool) {
    this.state.tool = tool;
    this.state.wallAnchor = null;
    this.notify();
  },

  toggleDynamicLighting() {
    this.state.dynamicLighting = !this.state.dynamicLighting;
    this.recordEvent('LUZ_DINAMICA', this.state.dynamicLighting ? 'ON' : 'OFF');
    this.notify({ redrawFog: true });
  },

  addWallSegment(x1, y1, x2, y2, kind = 'wall') {
    if (Math.hypot(x2 - x1, y2 - y1) < 12) return;
    this.pushUndoSnapshot();
    this.state.walls.push({
      id: `wall-${Date.now().toString().slice(-6)}`,
      x1,
      y1,
      x2,
      y2,
      kind,
      open: false
    });
    this.recordEvent('MURO', kind === 'door' ? 'Puerta añadida' : 'Muro añadido');
    this.notify({ redrawFog: true });
  },

  toggleDoor(wallId) {
    const door = (this.state.walls || []).find((w) => w.id === wallId && w.kind === 'door');
    if (!door) return null;
    this.pushUndoSnapshot();
    door.open = !door.open;
    this.recordEvent('PUERTA', door.open ? 'Abierta' : 'Cerrada');
    this.notify({ redrawFog: true });
    return door;
  },

  removeLastWall() {
    if (!this.state.walls || this.state.walls.length === 0) return;
    this.pushUndoSnapshot();
    this.state.walls.pop();
    this.notify({ redrawFog: true });
  },

  setTheme(themeId) {
    const valid = ['slate', 'parchment', 'light', 'fantasy', 'scifi', 'horror'];
    this.state.theme = valid.includes(themeId) ? themeId : 'slate';
    this.notify({ redrawMap: true, redrawGrid: true });
  },

  toggleTheme() {
    this.setTheme(this.state.theme === 'slate' ? 'parchment' : 'slate');
  },

  setZoom(nextZoom, anchorX = window.innerWidth / 2, anchorY = window.innerHeight / 2) {
    const clamped = Math.min(2.2, Math.max(0.35, nextZoom));
    const ratio = clamped / this.state.camera.zoom;
    this.state.camera.x = anchorX - (anchorX - this.state.camera.x) * ratio;
    this.state.camera.y = anchorY - (anchorY - this.state.camera.y) * ratio;
    this.state.camera.zoom = clamped;
    this.notify();
  },

  selectToken(tokenId, openSheet = true) {
    this.state.selectedTokenId = tokenId;
    if (tokenId && openSheet) {
      this.state.sheetOpen = true;
    }
    this.notify();
  },

  moveToken(tokenId, wx, wy, commit = true) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return;
    const pos = commit ? Selector.snapPosition(this.state, wx, wy, tok.size) : { x: wx, y: wy };
    tok.x = Math.max(40, Math.min(2360, pos.x));
    tok.y = Math.max(40, Math.min(1560, pos.y));
    if (commit) {
      this.recordEvent('MOVER_FICHA', `${tok.name} -> (${Math.round(tok.x)}, ${Math.round(tok.y)})`);
    }
    this.notify({ skipVaultSave: !commit });
  },

  async spawnActorFromTemplate(tpl, wx, wy) {
    const snapped = Selector.snapPosition(this.state, wx, wy, tpl.size || 1);
    const directImg = DriveUrlHelper.toDirectImageUrl(tpl.imageUrl || '');
    const starterInv = Array.isArray(tpl.starterItems)
      ? tpl.starterItems
          .map((k, idx) => {
            const found = COMPENDIUM_ITEMS.find((it) => it.key === k);
            return found ? { uid: `inv-${Date.now()}-${idx}`, ...found } : null;
          })
          .filter(Boolean)
      : [];

    const token = {
      id: `tok-${Date.now().toString().slice(-6)}`,
      name: tpl.name,
      role: tpl.role || 'Aventurero',
      color: tpl.color || '#8b5cf6',
      isAlly: tpl.isAlly !== false,
      visionRadius: Number(tpl.visionRadius) || 520,
      imageUrl: directImg,
      size: tpl.size || 1,
      x: snapped.x,
      y: snapped.y,
      hp: Number(tpl.hp) || 16,
      maxHp: Number(tpl.hp) || 16,
      ac: Number(tpl.ac) || 12,
      level: Math.max(1, Math.min(20, Number(tpl.level) || 1)),
      speed: String(tpl.speed || '30 ft'),
      stats: {
        str: Number(tpl.stats?.str) || 0,
        dex: Number(tpl.stats?.dex) || 0,
        con: Number(tpl.stats?.con) || 0,
        int: Number(tpl.stats?.int) || 0,
        wis: Number(tpl.stats?.wis) || 0,
        cha: Number(tpl.stats?.cha) || 0
      },
      scores: tpl.scores ? { ...tpl.scores } : null,
      saveProfs: tpl.saveProfs ? { ...tpl.saveProfs } : {},
      skills: Array.isArray(tpl.skills) ? tpl.skills.map((s) => ({ ...s })) : [],
      traits: Array.isArray(tpl.traits) ? tpl.traits.map((t) => ({ ...t })) : [],
      inventory: starterInv,
      hidden: false
    };

    this.state.tokens.push(token);
    this.state.selectedTokenId = token.id;
    this.state.sheetOpen = true;
    this.recordEvent('INVOCAR_FICHA', token.name);
    this.notify({ redrawFog: true });
    return token;
  },

  toggleTokenCondition(tokenId, condKey) {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok) return;
    if (!Array.isArray(tok.conditions)) tok.conditions = [];
    if (tok.conditions.includes(condKey)) {
      tok.conditions = tok.conditions.filter((c) => c !== condKey);
    } else {
      tok.conditions.push(condKey);
    }
    this.notify();
  },

  addMapNote(x, y, title, body = '', gmOnly = false) {
    if (!Array.isArray(this.state.notes)) this.state.notes = [];
    const note = {
      id: `note-${Date.now().toString(36)}`,
      sceneKey: this.getActiveSceneKey(),
      x: Math.round(x),
      y: Math.round(y),
      title: String(title || 'Nota').trim(),
      body: String(body || '').trim(),
      gmOnly: Boolean(gmOnly)
    };
    this.state.notes.push(note);
    this.recordEvent('NOTA', note.title);
    this.notify();
    return note;
  },

  updateMapNote(id, patch) {
    const note = (this.state.notes || []).find((n) => n.id === id);
    if (!note) return null;
    Object.assign(note, patch);
    this.notify();
    return note;
  },

  deleteMapNote(id) {
    this.state.notes = (this.state.notes || []).filter((n) => n.id !== id);
    this.notify();
  },

  startCombat() {
    const visibleTokens = (this.state.tokens || []).filter((t) => !t.hidden || this.state.role === 'gm');
    const order = visibleTokens
      .map((t) => {
        const dex = Number(t.stats?.dex) || 0;
        const init = Math.floor(Math.random() * 20) + 1 + dex;
        return { tokenId: t.id, init };
      })
      .sort((a, b) => b.init - a.init);
    this.state.combat = {
      active: true,
      round: 1,
      turnIndex: 0,
      order
    };
    if (order[0]) this.state.selectedTokenId = order[0].tokenId;
    this.recordEvent('COMBATE', 'Combate iniciado');
    this.notify();
  },

  nextCombatTurn() {
    const c = this.state.combat;
    if (!c || !c.active || !c.order.length) return;
    let nextIdx = c.turnIndex + 1;
    let round = c.round || 1;
    if (nextIdx >= c.order.length) {
      nextIdx = 0;
      round += 1;
    }
    c.turnIndex = nextIdx;
    c.round = round;
    const activeEntry = c.order[nextIdx];
    if (activeEntry) this.state.selectedTokenId = activeEntry.tokenId;
    this.notify();
  },

  setTokenInitiative(tokenId, initVal) {
    const c = this.state.combat;
    if (!c || !c.active) return;
    const init = Number(initVal) || 0;
    const existing = c.order.find((o) => o.tokenId === tokenId);
    if (existing) existing.init = init;
    else c.order.push({ tokenId, init });
    c.order.sort((a, b) => b.init - a.init);
    this.notify();
  },

  endCombat() {
    this.state.combat = { active: false, round: 1, turnIndex: 0, order: [] };
    this.recordEvent('COMBATE', 'Combate finalizado');
    this.notify();
  },

  compressImageFile(file, maxDim = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Archivo no es una imagen'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/webp', quality));
        };
        img.onerror = () => reject(new Error('No se pudo leer la imagen'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(file);
    });
  },

  applyTokenPassiveBonus(tok, item, sign = 1) {
    if (!tok || !item) return;
    const target = item.statTarget || (item.acBonus ? 'ac' : '');
    const rawBonus = item.statBonus !== undefined ? Number(item.statBonus) || 0 : Number(item.acBonus) || 0;
    const delta = rawBonus * sign;
    if (delta !== 0 && target) {
      if (target === 'ac') {
        tok.ac = Math.max(8, (Number(tok.ac) || 12) + delta);
      } else if (target === 'maxHp') {
        tok.maxHp = Math.max(1, (Number(tok.maxHp) || 10) + delta);
        if (sign > 0 && delta > 0) tok.hp = Math.min(tok.maxHp, (Number(tok.hp) || 0) + delta);
        else tok.hp = Math.min(tok.maxHp, Number(tok.hp) || 0);
      } else if (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(target)) {
        if (!tok.stats || typeof tok.stats !== 'object') {
          tok.stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        }
        tok.stats[target] = (Number(tok.stats[target]) || 0) + delta;
      }
    }
    if (item.lightRadius > 0) {
      const base = Number(tok.visionRadius) || 520;
      tok.visionRadius = sign > 0 ? base + item.lightRadius : Math.max(240, base - item.lightRadius);
    }
  },

  equipItemToToken(tokenId, itemTpl) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !itemTpl) return null;
    if (!Array.isArray(tok.inventory)) tok.inventory = [];
    const invEntry = {
      uid: `inv-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 99)}`,
      key: itemTpl.key || 'custom_item',
      name: itemTpl.name,
      kind: itemTpl.kind || 'weapon',
      badge: itemTpl.badge || itemTpl.formula || 'ATQ +2',
      message: String(itemTpl.message || '').trim(),
      formula: String(itemTpl.formula || '').trim(),
      bonusMod: Number(itemTpl.bonusMod) || 0,
      die: itemTpl.die !== undefined ? Number(itemTpl.die) || 0 : 0,
      statTarget: itemTpl.statTarget || (itemTpl.acBonus ? 'ac' : 'ac'),
      statBonus: itemTpl.statBonus !== undefined ? Number(itemTpl.statBonus) || 0 : Number(itemTpl.acBonus) || 0,
      acBonus: Number(itemTpl.acBonus) || 0,
      heal: Number(itemTpl.heal) || 0,
      lightRadius: Number(itemTpl.lightRadius) || 0,
      icon: String(itemTpl.icon || '').trim(),
      color: itemTpl.color || '#8b5cf6'
    };
    tok.inventory.push(invEntry);
    this.applyTokenPassiveBonus(tok, invEntry, 1);
    this.state.selectedTokenId = tok.id;
    this.state.sheetOpen = true;
    this.recordEvent('EQUIPAR_OBJETO', `${invEntry.name} -> ${tok.name}`);
    this.notify({ redrawFog: true });
    return { token: tok, item: invEntry };
  },

  useTokenInventoryItem(tokenId, invUid) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.inventory)) return '';
    const inv = tok.inventory.find((i) => i.uid === invUid);
    if (!inv) return '';

    const noteSuffix = inv.message ? ` — ${inv.message}` : '';

    if (inv.formula) {
      const roll = this.rollFormula(inv.formula, tok, `${tok.name} · ${inv.name}`, inv.message);
      if (inv.kind === 'consumable') {
        const healAmt = inv.heal > 0 ? inv.heal : Math.max(0, roll ? roll.total : 0);
        if (healAmt > 0) {
          const prevHp = tok.hp;
          tok.hp = Math.min(tok.maxHp, tok.hp + healAmt);
          tok.inventory = tok.inventory.filter((i) => i.uid !== invUid);
          this.notify();
          return `${tok.name} usa ${inv.name} (+${tok.hp - prevHp} HP).`;
        }
      }
      return `${tok.name} usa ${inv.name}${roll ? ` → ${roll.total}` : ''}`;
    }

    if (inv.kind === 'consumable' && inv.heal > 0) {
      const prevHp = tok.hp;
      tok.hp = Math.min(tok.maxHp, tok.hp + inv.heal);
      tok.inventory = tok.inventory.filter((i) => i.uid !== invUid);
      const healed = tok.hp - prevHp;
      if (inv.die > 0) {
        this.state.dice.modifier = inv.bonusMod || 0;
        this.rollDice(inv.die, `${tok.name} · ${inv.name}`, inv.message);
      }
      this.recordEvent('USAR_OBJETO', `${tok.name} usa ${inv.name}${noteSuffix} (+${healed} HP)`);
      this.notify();
      return `${tok.name} usa ${inv.name}${noteSuffix} (+${healed} HP).`;
    }

    if (inv.die > 0) {
      this.state.dice.modifier = inv.bonusMod || 0;
      this.rollDice(inv.die, `${tok.name} · ${inv.name}`, inv.message);
      const mod = inv.bonusMod || 0;
      return `${tok.name} activa ${inv.name} (1d${inv.die}${mod >= 0 ? '+' + mod : mod})`;
    }

    if (inv.message) {
      this.recordEvent('USAR_OBJETO', `${tok.name} · ${inv.name}: ${inv.message}`);
      this.notify();
      return `${tok.name} usa ${inv.name}: ${inv.message}`;
    }

    return `${inv.name} equipado en ${tok.name}.`;
  },

  removeTokenInventoryItem(tokenId, invUid) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.inventory)) return;
    const target = tok.inventory.find((i) => i.uid === invUid);
    if (!target) return;
    this.applyTokenPassiveBonus(tok, target, -1);
    tok.inventory = tok.inventory.filter((i) => i.uid !== invUid);
    this.recordEvent('RETIRAR_OBJETO', `${target.name} de ${tok.name}`);
    this.notify({ redrawFog: true });
  },

  reorderTokenInventoryItem(tokenId, sourceUid, targetUid, placeAfter = false) {
    if (!sourceUid || !targetUid || sourceUid === targetUid) return;
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.inventory)) return;
    const fromIdx = tok.inventory.findIndex((i) => i.uid === sourceUid);
    if (fromIdx === -1) return;
    const [moved] = tok.inventory.splice(fromIdx, 1);
    let toIdx = tok.inventory.findIndex((i) => i.uid === targetUid);
    if (toIdx === -1) {
      tok.inventory.splice(fromIdx, 0, moved);
      return;
    }
    if (placeAfter) toIdx += 1;
    tok.inventory.splice(toIdx, 0, moved);
    this.notify();
  },

  adjustTokenHp(tokenId, delta) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return;
    this.pushUndoSnapshot();
    tok.hp = Math.max(0, Math.min(tok.maxHp, tok.hp + delta));
    this.recordEvent('HP_FICHA', `${tok.name}: ${tok.hp}/${tok.maxHp}`);
    this.notify();
  },

  addTokenSkill(tokenId, name, mod = 0) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const clean = String(name || '').trim();
    if (!tok || !clean) return;
    if (!Array.isArray(tok.skills)) tok.skills = [];
    tok.skills.push({
      id: `sk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: clean,
      mod: Number(mod) || 0
    });
    this.notify();
  },

  removeTokenSkill(tokenId, skillId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.skills)) return;
    tok.skills = tok.skills.filter((s) => s.id !== skillId);
    this.notify();
  },

  addTokenTrait(tokenId, title, desc = '') {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const clean = String(title || '').trim();
    if (!tok || !clean) return;
    if (!Array.isArray(tok.traits)) tok.traits = [];
    tok.traits.push({
      id: `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      title: clean,
      desc: String(desc || '').trim()
    });
    this.notify();
  },

  removeTokenTrait(tokenId, traitId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.traits)) return;
    tok.traits = tok.traits.filter((t) => t.id !== traitId);
    this.notify();
  },

  getProficiencyBonus(tok) {
    const lvl = Math.max(1, Math.min(20, Number(tok?.level) || 1));
    return Math.ceil(lvl / 4) + 1;
  },

  updateTokenScore(tokenId, statKey, scoreVal) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(statKey)) return;
    const score = Math.max(1, Math.min(30, Number(scoreVal) || 10));
    if (!tok.scores || typeof tok.scores !== 'object') tok.scores = {};
    if (!tok.stats || typeof tok.stats !== 'object') tok.stats = {};
    tok.scores[statKey] = score;
    tok.stats[statKey] = Math.floor((score - 10) / 2);
    this.notify();
  },

  toggleTokenSaveProf(tokenId, statKey) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return;
    if (!tok.saveProfs || typeof tok.saveProfs !== 'object') tok.saveProfs = {};
    tok.saveProfs[statKey] = !tok.saveProfs[statKey];
    this.notify();
  },

  cycleTokenSkillProf(tokenId, skillId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const sk = tok && Array.isArray(tok.skills) ? tok.skills.find((s) => s.id === skillId) : null;
    if (!sk) return;
    sk.prof = ((Number(sk.prof) || 0) + 1) % 3;
    this.notify();
  },

  loadDnd55Skills(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return 0;
    if (!Array.isArray(tok.skills)) tok.skills = [];
    const existing = new Set(tok.skills.map((s) => String(s.name || '').toLowerCase()));
    const dnd55 = [
      ['Acrobacias', 'dex'],
      ['Atletismo', 'str'],
      ['C. Arcano', 'int'],
      ['Engaño', 'cha'],
      ['Historia', 'int'],
      ['Interpretación', 'cha'],
      ['Intimidación', 'cha'],
      ['Investigación', 'int'],
      ['Juego de Manos', 'dex'],
      ['Medicina', 'wis'],
      ['Naturaleza', 'int'],
      ['Percepción', 'wis'],
      ['Perspicacia', 'wis'],
      ['Persuasión', 'cha'],
      ['Religión', 'int'],
      ['Sigilo', 'dex'],
      ['Supervivencia', 'wis'],
      ['Trato con Animales', 'wis']
    ];
    let added = 0;
    for (const [name, attr] of dnd55) {
      if (existing.has(name.toLowerCase())) continue;
      tok.skills.push({
        id: `sk-${attr}-${Date.now().toString(36).slice(-3)}-${added}`,
        name,
        attr,
        prof: 0,
        mod: 0
      });
      added += 1;
    }
    this.notify();
    return added;
  },

  toggleTokenHidden(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return;
    this.pushUndoSnapshot();
    tok.hidden = !tok.hidden;
    this.recordEvent('VISIBILIDAD_FICHA', `${tok.name}: ${tok.hidden ? 'Oculta' : 'Visible'}`);
    this.notify();
  },

  cycleTokenLight(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return 0;
    const steps = [0, 180, 360];
    const cur = Number(tok.lightRadius) || 0;
    const next = steps[(steps.indexOf(cur) + 1) % steps.length];
    tok.lightRadius = next;
    this.recordEvent('LUZ_FICHA', `${tok.name}: ${next ? next + 'px' : 'Apagada'}`);
    this.notify({ redrawFog: true });
    return next;
  },

  cycleTokenAura(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return 0;
    const steps = [0, 90, 135];
    const cur = Number(tok.auraRadius) || 0;
    const next = steps[(steps.indexOf(cur) + 1) % steps.length];
    tok.auraRadius = next;
    this.recordEvent('AURA_FICHA', `${tok.name}: ${next ? next + 'px' : 'Apagada'}`);
    this.notify();
    return next;
  },

  toggleTokenOwnership(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return '';
    if (this.state.role === 'gm') {
      tok.ownerId = tok.ownerId === 'gm' ? '' : 'gm';
    } else if (!tok.ownerId && tok.isAlly !== false) {
      tok.ownerId = this.clientId;
    } else if (tok.ownerId === this.clientId) {
      tok.ownerId = '';
    }
    this.recordEvent('PROPIEDAD_FICHA', `${tok.name}: ${tok.ownerId || 'Libre'}`);
    this.notify();
    return tok.ownerId;
  },

  duplicateToken(tokenId) {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok) return null;
    this.pushUndoSnapshot();
    const baseName = String(tok.name || 'Ficha').replace(/\s+\d+$/, '').trim();
    const existing = new Set((this.state.tokens || []).map((t) => t.name));
    let idx = 2;
    while (existing.has(`${baseName} ${idx}`)) idx += 1;
    const step = Number(this.state.grid?.cellSize) || 80;
    const nextX = tok.x + step <= 2320 ? tok.x + step : Math.max(40, tok.x - step);
    const nextY = tok.x + step <= 2320 ? tok.y : Math.min(1520, tok.y + step);
    const clone = JSON.parse(JSON.stringify(tok));
    clone.id = `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    clone.name = `${baseName} ${idx}`;
    clone.x = nextX;
    clone.y = nextY;
    this.state.tokens.push(clone);
    this.state.selectedTokenId = clone.id;
    this.recordEvent('DUPLICAR_FICHA', clone.name);
    this.notify({ redrawFog: true });
    return clone;
  },

  deleteToken(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return;
    this.pushUndoSnapshot();
    this.state.tokens = this.state.tokens.filter((t) => t.id !== tokenId);
    if (this.state.selectedTokenId === tokenId) {
      this.state.selectedTokenId = this.state.tokens[0] ? this.state.tokens[0].id : null;
    }
    this.recordEvent('ELIMINAR_FICHA', tok.name);
    this.notify();
  },

  triggerPing(wx, wy) {
    const ping = { id: `ping-${Date.now()}`, x: wx, y: wy, color: '#8b5cf6' };
    this.state.pings.push(ping);
    this.notify();
    setTimeout(() => {
      this.state.pings = this.state.pings.filter((p) => p.id !== ping.id);
      this.notify();
    }, 1400);
  }
};
