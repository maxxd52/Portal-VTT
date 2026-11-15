/* ==========================================================================
   SERVICE: LÓGICA DE NEGOCIO, MUTACIONES Y SINCRONIZACIÓN
   ========================================================================== */

import { buildPresetWallsForMap } from '../data/compendium.js';
import { BrowserVault } from '../services/browserVault.js?v=20261115t';
import { CompendiumServiceMethods } from '../services/compendiumService.js?v=20261115t';
import { DiceServiceMethods } from '../services/diceService.js?v=20261115t';
import { RealtimeBridge } from '../services/realtimeBridge.js';
import { TokenServiceMethods } from '../services/tokenService.js?v=20261115t';
import { createInitialState, generateRoomCode } from './model.js?v=20261115t';
import { Selector } from './selector.js?v=20261115t';

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
  ...TokenServiceMethods,

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
