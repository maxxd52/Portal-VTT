/* ==========================================================================
   SERVICE: LÓGICA DE NEGOCIO, MUTACIONES Y SINCRONIZACIÓN
   ========================================================================== */

import { buildPresetWallsForMap } from '../data/compendium.js?v=20261121a6';
import { BrowserVault } from '../services/browserVault.js?v=20261121a6';
import { ChatServiceMethods } from '../services/chatService.js?v=20261121a6';
import { CombatServiceMethods } from '../services/combatService.js?v=20261121a6';
import { CompendiumServiceMethods } from '../services/compendiumService.js?v=20261121a6';
import { DiceServiceMethods } from '../services/diceService.js?v=20261121a6';
import { GmScreenServiceMethods } from '../services/gmScreenService.js?v=20261121a6';
import { JournalRevealServiceMethods } from '../services/journalRevealService.js?v=20261121a6';
import { JournalServiceMethods } from '../services/journalService.js?v=20261121a6';
import { MediaRegistryServiceMethods } from '../services/mediaRegistryService.js?v=20261121a6';
import { RealtimeBridge } from '../services/realtimeBridge.js?v=20261121a6';
import { SequenceServiceMethods } from '../services/sequenceService.js?v=20261121a6';
import { SystemServiceMethods } from '../services/systemService.js?v=20261121a6';
import { TokenServiceMethods } from '../services/tokenService.js?v=20261121a6';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { normalizeGridConfig } from '../utils/gridGeometry.js?v=20261121a6';
import {
  normalizeSceneLighting,
  normalizeVisionConfig,
  resolveTokenLightMeters
} from '../utils/lightingModel.js?v=20261121a6';
import { mergeAssignedTokensForScene } from '../utils/scenePartySync.js?v=20261121a6';
import {
  getSeatAllowedTokenIds,
  mergeRedactedTokensPreservingGmPrivate,
  normalizeMediaAssets
} from '../utils/worldRedaction.js?v=20261121a6';
import { createInitialState, generateRoomCode, SYSTEM_PRESETS } from './model.js?v=20261121a6';
import { Selector } from './selector.js?v=20261121a6';

const PROFILE_STORAGE_KEY = 'portal_vtt_user_profile_v1';
const UI_SCALE_STORAGE_KEY = 'portal_vtt_ui_scale_v1';
const UI_SCALE_FACTORS = { normal: 1, comfortable: 1.12, large: 1.25 };
const RAILS_SWAP_STORAGE_KEY = 'portal_vtt_rails_swapped_v1';

const getOrCreateClientId = () => {
  try {
    let cid = sessionStorage.getItem('portal_client_id');
    if (!cid) {
      cid = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem('portal_client_id', cid);
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
  playerPrimaryTokens: new Map(),
  chatMessages: [],
  chatBubbles: new Map(),
  chatOpen: false,
  chatUnreadCount: 0,
  chatUnreadTable: 0,
  chatUnreadBySeat: new Map(),
  chatTarget: { channel: 'table' },
  seatRolls: new Map(),
  seatRollAutoHideMs: 6000,
  _seatRollHideTimers: new Map(),
  expandedSeatRollKey: '',
  flyingRollId: null,
  flyingRollIds: new Set(),
  undoStack: [],
  redoStack: [],
  tokenGlides: new Map(),
  exploredMaskCaptureFn: null,
  uiScale: 'normal',
  railsSwapped: false,
  journalUnreadCount: 0,
  activeJournalNoteId: '',
  activeJournalNoteKind: '',
  _minimizedDrawersSnapshot: null,

  ...ChatServiceMethods,
  ...CombatServiceMethods,
  ...CompendiumServiceMethods,
  ...DiceServiceMethods,
  ...GmScreenServiceMethods,
  ...JournalServiceMethods,
  ...JournalRevealServiceMethods,
  ...MediaRegistryServiceMethods,
  ...SequenceServiceMethods,
  ...SystemServiceMethods,
  ...TokenServiceMethods,

  clearSeatRollAutoHide(seatKey) {
    if (!seatKey || !(this._seatRollHideTimers instanceof Map)) return;
    const prev = this._seatRollHideTimers.get(seatKey);
    if (prev) {
      clearTimeout(prev);
      this._seatRollHideTimers.delete(seatKey);
    }
  },

  scheduleSeatRollAutoHide(seatKey, rollId = '', durationMs = this.seatRollAutoHideMs) {
    if (!seatKey || !(this.seatRolls instanceof Map)) return;
    if (!(this._seatRollHideTimers instanceof Map)) this._seatRollHideTimers = new Map();
    this.clearSeatRollAutoHide(seatKey);
    const cur = this.seatRolls.get(seatKey);
    if (!cur || (rollId && cur.rollId && cur.rollId !== rollId)) return;
    cur.autoHidden = false;
    const ms = Math.max(150, Number(durationMs) || 6000);
    const timer = setTimeout(() => {
      this._seatRollHideTimers.delete(seatKey);
      const active = this.seatRolls instanceof Map ? this.seatRolls.get(seatKey) : null;
      if (!active || (rollId && active.rollId && active.rollId !== rollId)) return;
      if (this.isRollFlying(active.rollId)) return;
      active.autoHidden = true;
      if (this.expandedSeatRollKey === seatKey) {
        const isHovered =
          typeof document !== 'undefined' &&
          typeof CSS !== 'undefined' &&
          Boolean(document.querySelector(`[data-seat-key="${CSS.escape(seatKey)}"]:hover`));
        if (!isHovered) {
          this.expandedSeatRollKey = '';
        }
      }
      this.notify({ skipVaultSave: true });
    }, ms);
    if (typeof timer?.unref === 'function') timer.unref();
    this._seatRollHideTimers.set(seatKey, timer);
  },

  markRollFlying(rollId) {
    if (!rollId) return;
    if (!(this.flyingRollIds instanceof Set)) this.flyingRollIds = new Set();
    this.flyingRollIds.add(rollId);
    this.flyingRollId = rollId;
  },

  clearRollFlying(rollId) {
    if (!(this.flyingRollIds instanceof Set)) this.flyingRollIds = new Set();
    if (rollId) this.flyingRollIds.delete(rollId);
    const remaining = Array.from(this.flyingRollIds);
    this.flyingRollId = remaining.length ? remaining[remaining.length - 1] : null;
    if (rollId && this.seatRolls instanceof Map) {
      for (const [seatKey, r] of this.seatRolls.entries()) {
        if (r && r.rollId === rollId) {
          this.scheduleSeatRollAutoHide(seatKey, rollId);
        }
      }
    }
  },

  isRollFlying(rollId) {
    if (!rollId) return false;
    if (this.flyingRollIds instanceof Set && this.flyingRollIds.has(rollId)) return true;
    return this.flyingRollId === rollId;
  },

  captureSnapshot() {
    return JSON.stringify({
      tokens: this.state.tokens || [],
      strokes: this.state.strokes || [],
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
    this.cancelAllTokenGlides();
    const snap = JSON.parse(raw);
    this.state.tokens = snap.tokens || [];
    this.state.strokes = snap.strokes || [];
    this.state.walls = snap.walls || [];
    this.state.notes = snap.notes || [];
    if (this.state.selectedTokenId && !this.state.tokens.some((t) => t.id === this.state.selectedTokenId)) {
      this.state.selectedTokenId = this.state.tokens[0] ? this.state.tokens[0].id : null;
    }
    this.notify({ redrawMap: true, redrawDraw: true, redrawFog: true });
    if (this.state.role === 'gm') this.syncWorldToPeers();
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
    return Selector.getPlayerAssignedTokenIds(this.state).includes(tok.id);
  },

  getLocalProfile() {
    const fallbackName = this.state.role === 'gm' ? 'Director' : 'Jugador';
    let saved = {};
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) || {};
    } catch (_) {}
    return {
      name: String(saved.name || '').trim() || fallbackName,
      avatarUrl: String(saved.avatarUrl || '').trim(),
      color: String(saved.color || '#8b5cf6').trim() || '#8b5cf6',
      provider: saved.provider || 'local'
    };
  },

  updateLocalProfile(patch = {}) {
    const current = this.getLocalProfile();
    let saved = {};
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) || {};
    } catch (_) {}
    const next = {
      name: patch.name !== undefined ? String(patch.name || '').trim() : (saved.name || ''),
      avatarUrl: patch.avatarUrl !== undefined ? (DriveUrlHelper.toDirectImageUrl(patch.avatarUrl) || String(patch.avatarUrl || '').trim()) : current.avatarUrl,
      color: patch.color !== undefined ? (String(patch.color || '').trim() || current.color) : current.color,
      provider: patch.provider || current.provider || 'local'
    };
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
    RealtimeBridge.send({
      kind: 'PRESENCE_PING',
      clientId: this.clientId,
      role: this.state.role || 'gm',
      inviteId: this.state.activeInviteId || '',
      profile: this.getLocalProfile()
    });
    this.notify({ skipVaultSave: true });
    return this.getLocalProfile();
  },

  setPrimaryPlayerToken(tokenId) {
    const inviteId = this.state.activeInviteId || '';
    if (inviteId && tokenId) {
      if (!(this.playerPrimaryTokens instanceof Map)) this.playerPrimaryTokens = new Map();
      this.playerPrimaryTokens.set(inviteId, tokenId);
    }
    RealtimeBridge.send({
      kind: 'PRESENCE_PING',
      clientId: this.clientId,
      role: this.state.role || 'gm',
      inviteId,
      primaryTokenId: tokenId || '',
      profile: this.state.role === 'gm' ? this.getLocalProfile() : null
    });
    this.notify({ skipVaultSave: true });
  },

  getPrimaryTokenForInvite(invite, tokensById = null) {
    if (!invite) return null;
    const ids = Array.isArray(invite.tokenIds) ? invite.tokenIds : [];
    const lookup = tokensById || new Map((this.state.tokens || []).map((t) => [t.id, t]));
    const assigned = ids.map((id) => lookup.get(id)).filter(Boolean);
    if (!assigned.length) return null;
    const chosenId = this.playerPrimaryTokens instanceof Map ? this.playerPrimaryTokens.get(invite.id) : '';
    const chosen = chosenId ? assigned.find((t) => t.id === chosenId) : null;
    if (chosen) return chosen;
    if (this.state.role === 'player' && this.state.activeInviteId === invite.id && this.state.selectedTokenId) {
      const sel = assigned.find((t) => t.id === this.state.selectedTokenId);
      if (sel) return sel;
    }
    return assigned[0];
  },

  getActiveSpeakerInfo() {
    if (this.state.role === 'gm') return this.getLocalProfile();
    const inv = Selector.getPlayerInvites(this.state).find((i) => i.id === this.state.activeInviteId);
    const primaryTok = this.getPrimaryTokenForInvite(inv);
    if (primaryTok) {
      return {
        name: primaryTok.name,
        avatarUrl: primaryTok.imageUrl || '',
        color: primaryTok.color || '#3b82f6'
      };
    }
    return {
      name: inv?.label || 'Jugador',
      avatarUrl: '',
      color: '#3b82f6'
    };
  },

  updatePeerPresence(peer) {
    if (!peer || !peer.clientId || peer.clientId === this.clientId) return;
    if (peer.leaving) {
      this.peers.delete(peer.clientId);
    } else {
      const prev = this.peers.get(peer.clientId) || {};
      const inviteId = peer.inviteId !== undefined ? String(peer.inviteId || '') : (prev.inviteId || '');
      const primaryTokenId = peer.primaryTokenId !== undefined ? String(peer.primaryTokenId || '') : (prev.primaryTokenId || '');
      if (inviteId && primaryTokenId) {
        if (!(this.playerPrimaryTokens instanceof Map)) this.playerPrimaryTokens = new Map();
        this.playerPrimaryTokens.set(inviteId, primaryTokenId);
      }
      this.peers.set(peer.clientId, {
        clientId: peer.clientId,
        role: peer.role || 'player',
        inviteId,
        primaryTokenId,
        profile: peer.profile && typeof peer.profile === 'object' ? peer.profile : (prev.profile || null),
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
    const selfInviteId = this.state.activeInviteId || '';
    const selfPrimary = selfInviteId && this.playerPrimaryTokens instanceof Map
      ? (this.playerPrimaryTokens.get(selfInviteId) || '')
      : '';
    return [
      {
        clientId: this.clientId,
        role: this.state.role || 'gm',
        inviteId: selfInviteId,
        primaryTokenId: selfPrimary,
        profile: this.state.role === 'gm' ? this.getLocalProfile() : null,
        self: true
      },
      ...Array.from(this.peers.values())
    ];
  },

  showHandout(url, title = 'Handout') {
    const cleanUrl = DriveUrlHelper.toDirectImageUrl(url) || String(url || '').trim();
    if (!cleanUrl) return;
    const cleanTitle = String(title || 'Handout').trim();
    const mediaId = this.registerMediaAsset?.(cleanUrl, { label: cleanTitle, kind: 'handout' }) || '';
    const handout = { url: cleanUrl, title: cleanTitle, mediaId };
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

  syncWorldToPeers(targetSeatKey = null) {
    if (this.state.role !== 'gm') return;
    if (targetSeatKey && targetSeatKey !== 'gm') {
      RealtimeBridge.send({
        kind: 'WORLD_SYNC',
        targetSeatKey,
        world: Selector.extractWorldForSeat(this.state, targetSeatKey)
      });
      return;
    }
    const seats = new Set(Selector.getPlayerInvites(this.state).map((i) => i.id).filter(Boolean));
    for (const peer of this.peers instanceof Map ? this.peers.values() : []) {
      if (peer && peer.role !== 'gm') {
        const s = peer.inviteId || `peer:${peer.clientId}`;
        if (s) seats.add(s);
      }
    }
    if (RealtimeBridge.seatConns instanceof Map) {
      for (const meta of RealtimeBridge.seatConns.values()) {
        if (meta && meta.role !== 'gm' && meta.seatKey) seats.add(meta.seatKey);
      }
    }
    for (const seat of seats) {
      RealtimeBridge.send({
        kind: 'WORLD_SYNC',
        targetSeatKey: seat,
        world: Selector.extractWorldForSeat(this.state, seat)
      });
    }
    RealtimeBridge.send({
      kind: 'WORLD_SYNC',
      spectatorOnly: true,
      world: Selector.extractSerializableWorld(this.state)
    });
  },

  syncPlayerOwnedTokensToHost() {
    if (this.state.role !== 'player') return;
    const seatKey = this.getSelfSeatKey();
    const owned = (this.state.tokens || []).filter((t) => this.canControlToken(t));
    RealtimeBridge.send({
      kind: 'PLAYER_TOKENS_SYNC',
      hostOnly: true,
      seatKey,
      inviteId: this.state.activeInviteId || '',
      clientId: this.clientId,
      tokens: JSON.parse(JSON.stringify(owned))
    });
  },

  applyPlayerTokensSync(msg) {
    if (this.state.role !== 'gm' || !msg || !Array.isArray(msg.tokens)) return false;
    const seatKey = String(msg.seatKey || msg.inviteId || '');
    const allowedIds = new Set(getSeatAllowedTokenIds(this.state, seatKey));
    if (allowedIds.size === 0) return false;
    const byId = new Map((this.state.tokens || []).map((t) => [t.id, t]));
    let changed = false;

    for (const incoming of msg.tokens) {
      if (!incoming || !incoming.id || !allowedIds.has(incoming.id)) continue;
      const target = byId.get(incoming.id);
      if (!target || incoming._redacted) continue;
      const safeImage = incoming.imageUrl !== undefined ? (DriveUrlHelper.toDirectImageUrl(incoming.imageUrl) || String(incoming.imageUrl || '').trim()) : target.imageUrl;
      const mediaId = safeImage ? this.registerMediaAsset(safeImage, { label: incoming.name || target.name, kind: 'token' }) : '';
      Object.assign(target, {
        name: incoming.name !== undefined ? String(incoming.name || target.name).trim() || target.name : target.name,
        role: incoming.role !== undefined ? String(incoming.role || '') : target.role,
        color: incoming.color !== undefined ? String(incoming.color || target.color) : target.color,
        imageUrl: safeImage,
        mediaId,
        publicDescription: incoming.publicDescription !== undefined ? String(incoming.publicDescription || '') : (target.publicDescription || ''),
        privateNotes: incoming.privateNotes !== undefined ? String(incoming.privateNotes || '') : (target.privateNotes || ''),
        hp: incoming.hp !== undefined ? Math.max(0, Number(incoming.hp) || 0) : target.hp,
        maxHp: incoming.maxHp !== undefined ? Math.max(1, Number(incoming.maxHp) || 1) : target.maxHp,
        ac: incoming.ac !== undefined ? Math.max(1, Number(incoming.ac) || 10) : target.ac,
        level: incoming.level !== undefined ? Math.max(1, Math.min(20, Number(incoming.level) || 1)) : target.level,
        speed: incoming.speed !== undefined ? String(incoming.speed || '30 ft') : target.speed,
        stats: incoming.stats && typeof incoming.stats === 'object' ? incoming.stats : target.stats,
        scores: incoming.scores !== undefined ? incoming.scores : target.scores,
        saveProfs: incoming.saveProfs && typeof incoming.saveProfs === 'object' ? incoming.saveProfs : target.saveProfs,
        skills: Array.isArray(incoming.skills) ? incoming.skills : target.skills,
        traits: Array.isArray(incoming.traits) ? incoming.traits : target.traits,
        resources: Array.isArray(incoming.resources) ? incoming.resources : target.resources,
        inventory: Array.isArray(incoming.inventory) ? incoming.inventory : target.inventory,
        texts: incoming.texts && typeof incoming.texts === 'object' ? incoming.texts : target.texts,
        conditions: Array.isArray(incoming.conditions) ? incoming.conditions : target.conditions,
        auraRadius: incoming.auraRadius !== undefined ? Number(incoming.auraRadius) || 0 : target.auraRadius,
        visionMeters: incoming.visionMeters !== undefined ? incoming.visionMeters : target.visionMeters,
        lightMeters: incoming.lightMeters !== undefined ? Math.max(0, Number(incoming.lightMeters) || 0) : target.lightMeters,
        hpPips: Array.isArray(incoming.hpPips) ? incoming.hpPips : target.hpPips
      });
      changed = true;
    }

    if (!changed) return false;
    this.syncWorldToPeers();
    this.notify({ redrawFog: true, skipPeerSync: true });
    return true;
  },

  notify(opts = {}) {
    if (!opts.skipVaultSave && this.state.role === 'gm') {
      BrowserVault.saveRoom(
        this.state.room.code,
        Selector.extractSerializableWorld(this.state, { includePrivateGm: true })
      );
    } else if (!opts.skipVaultSave && !opts.skipPeerSync && this.state.role === 'player') {
      this.syncPlayerOwnedTokensToHost();
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
    if (broadcast && this.state.role === 'gm') {
      this.syncWorldToPeers();
    }
  },

  getUiScale() {
    return UI_SCALE_FACTORS[this.uiScale] || 1;
  },

  loadUiScale() {
    let saved = '';
    try {
      saved = String(localStorage.getItem(UI_SCALE_STORAGE_KEY) || '').trim();
    } catch (_) {}
    this.uiScale = UI_SCALE_FACTORS[saved] ? saved : 'normal';
    return this.uiScale;
  },

  setUiScale(presetKey) {
    const next = UI_SCALE_FACTORS[presetKey] ? presetKey : 'normal';
    this.uiScale = next;
    try {
      localStorage.setItem(UI_SCALE_STORAGE_KEY, next);
    } catch (_) {}
    this.notify({ skipVaultSave: true, skipPeerSync: true });
    return UI_SCALE_FACTORS[next];
  },

  loadRailsSwapped() {
    let saved = false;
    try {
      saved = localStorage.getItem(RAILS_SWAP_STORAGE_KEY) === 'true';
    } catch (_) {}
    this.railsSwapped = saved;
    return this.railsSwapped;
  },

  setRailsSwapped(swapped) {
    const next = Boolean(swapped);
    this.railsSwapped = next;
    try {
      localStorage.setItem(RAILS_SWAP_STORAGE_KEY, next ? 'true' : 'false');
    } catch (_) {}
    this.notify({ skipVaultSave: true, skipPeerSync: true });
    return this.railsSwapped;
  },

  async restoreFromVault() {
    this.loadDiceStyle();
    this.loadUiScale();
    this.loadRailsSwapped();
    const savedShelf = await BrowserVault.loadShelf();
    if (savedShelf) this.state.shelfModules = savedShelf;

    if (this.state.role !== 'gm') return;
    const saved = await BrowserVault.loadRoom(this.state.room.code);
    if (saved && Array.isArray(saved.tokens)) {
      this.applyFullWorldState(saved, true);
    }
  },

  async createPortal({ title = '', ruleset = 'dnd55', mapId = 'bastion', dynamicLighting = true, showGrid = true } = {}) {
    this.cancelAllTokenGlides();
    const code = generateRoomCode();
    const next = createInitialState();
    next.role = 'gm';
    next.isHostGm = true;
    const presetKey = SYSTEM_PRESETS[ruleset] ? ruleset : 'dnd55';
    next.ruleset = presetKey === 'dnd55' ? 'dnd55' : 'free';
    this.applySystemPreset(presetKey, next);
    next.room.code = code;
    next.room.moduleTitle = String(title || '').trim() || `Portal ${code}`;
    next.dynamicLighting = Boolean(dynamicLighting);
    next.rememberExplored = true;
    next.exploredMask = '';
    next.exploredRev = 0;
    next.grid = normalizeGridConfig({
      type: showGrid ? 'square' : 'none',
      opacity: showGrid ? 0.28 : 0,
      snap: Boolean(showGrid)
    });
    next.tokens = [];
    next.selectedTokenId = null;
    next.sheetOpen = false;

    if (mapId === 'empty') {
      next.mapId = 'empty';
      next.activeMapKey = 'empty';
      next.walls = [];
    } else {
      next.mapId = mapId;
      next.activeMapKey = mapId;
      next.walls = buildPresetWallsForMap(mapId);
    }
    next.sceneLighting = {
      [next.activeMapKey]: normalizeSceneLighting({
        dynamicLighting: Boolean(dynamicLighting),
        rememberExplored: true,
        exploredMask: '',
        exploredRev: 0
      })
    };

    this.state = next;
    this.loadedMapImage = null;
    this.undoStack = [];
    this.redoStack = [];
    this._minimizedDrawersSnapshot = null;
    await BrowserVault.saveRoom(code, Selector.extractSerializableWorld(this.state, { includePrivateGm: true }));
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
    this.cancelAllTokenGlides();
    const next = createInitialState();
    next.role = role === 'player' ? 'player' : 'gm';
    next.isHostGm = next.role === 'gm';
    next.room.code = code;
    if (next.role === 'player') {
      Object.assign(next, { mapId: 'empty', activeMapKey: 'empty', walls: [], tokens: [], selectedTokenId: null, sheetOpen: false, drawerOpen: false });
    }
    this.state = next;
    this.loadedMapImage = null;
    this.undoStack = [];
    this.redoStack = [];
    this._minimizedDrawersSnapshot = null;
    await this.restoreFromVault();
    this.notify({
      syncExplored: true,
      redrawMap: true,
      redrawGrid: true,
      redrawDraw: true,
      redrawFog: true,
      skipVaultSave: true
    });
  },

  applyFullWorldState(world, silent = false) {
    if (!world) return;
    this.cancelAllTokenGlides();
    if (world.moduleTitle) this.state.room.moduleTitle = world.moduleTitle;
    if (world.ruleset) this.state.ruleset = world.ruleset;
    if (world.systemConfig && typeof world.systemConfig === 'object') {
      const curCfg = this.state.systemConfig || {};
      this.state.systemConfig = {
        ...curCfg,
        ...world.systemConfig,
        enabledTabs: {
          ...(curCfg.enabledTabs || { skills: true, traits: true, inventory: true }),
          ...(world.systemConfig.enabledTabs || {})
        },
        customTabs: Array.isArray(world.systemConfig.customTabs) ? world.systemConfig.customTabs : [],
        sheetTabs: Array.isArray(world.systemConfig.sheetTabs) ? world.systemConfig.sheetTabs : null,
        sheetBlocks: Array.isArray(world.systemConfig.sheetBlocks) ? world.systemConfig.sheetBlocks : null,
        fixedRolls: Array.isArray(world.systemConfig.fixedRolls) ? world.systemConfig.fixedRolls : [],
        resourceSchema: Array.isArray(world.systemConfig.resourceSchema) ? world.systemConfig.resourceSchema : [],
        statusesSchema: Array.isArray(world.systemConfig.statusesSchema) ? world.systemConfig.statusesSchema : null,
        vision: normalizeVisionConfig(world.systemConfig.vision || curCfg.vision || {})
      };
      if (this.state.dice) {
        if (this.state.systemConfig.resultMode) this.state.dice.resultMode = this.state.systemConfig.resultMode;
        if (this.state.systemConfig.successThreshold) this.state.dice.successThreshold = this.state.systemConfig.successThreshold;
      }
    } else {
      if (!this.state.systemConfig || typeof this.state.systemConfig !== 'object') this.state.systemConfig = {};
      this.state.systemConfig.vision = normalizeVisionConfig(this.state.systemConfig.vision || {});
    }
    if (Array.isArray(world.sheetSchema) && world.sheetSchema.length > 0) {
      this.state.sheetSchema = world.sheetSchema;
    }
    if (this.state.systemConfig?.preset === 'free' && !Array.isArray(this.state.systemConfig.sheetBlocks)) {
      this.ensureGenericBlocksInitialized(true);
    }
    if (world.mapId) this.state.mapId = world.mapId;
    if (world.activeMapKey) this.state.activeMapKey = world.activeMapKey;
    if (world.mapGrids && typeof world.mapGrids === 'object') this.state.mapGrids = world.mapGrids;
    if (typeof world.dynamicLighting === 'boolean') this.state.dynamicLighting = world.dynamicLighting;
    if (typeof world.rememberExplored === 'boolean') {
      this.state.rememberExplored = world.rememberExplored;
    } else {
      this.state.rememberExplored = Selector.getSystemVisionConfig(this.state).rememberExplored;
    }
    this.state.exploredMask = typeof world.exploredMask === 'string' ? world.exploredMask : '';
    this.state.exploredRev = Math.max(0, Math.trunc(Number(world.exploredRev) || 0));
    if (Array.isArray(world.walls)) this.state.walls = world.walls;
    this.state.customMapUrl = world.customMapUrl || '';
    if (this.state.customMapUrl) {
      this.loadExternalMapImage(this.state.customMapUrl);
    } else {
      this.loadedMapImage = null;
    }
    if (world.grid) this.state.grid = normalizeGridConfig({ ...this.state.grid, ...world.grid });
    else this.state.grid = normalizeGridConfig(this.state.grid);
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
    if (Array.isArray(world.tokens)) {
      this.state.tokens = this.state.role === 'gm'
        ? mergeRedactedTokensPreservingGmPrivate(this.state.tokens, world.tokens)
        : world.tokens;
    }
    if (Array.isArray(world.playerInvites)) this.state.playerInvites = world.playerInvites;
    if (Array.isArray(world.strokes)) this.state.strokes = world.strokes;
    if (Array.isArray(world.notes)) {
      if (this.state.role === 'gm' && Array.isArray(this.state.notes)) {
        const gmOnlyExisting = this.state.notes.filter((n) => n?.gmOnly && !world.notes.some((wn) => wn?.id === n.id));
        this.state.notes = [...world.notes, ...gmOnlyExisting];
      } else {
        this.state.notes = world.notes;
      }
    }
    if (this.state.role === 'gm') {
      if (world.mediaAssets && typeof world.mediaAssets === 'object') {
        const incomingAssets = normalizeMediaAssets(world.mediaAssets);
        this.state.mediaAssets = world.journal && Array.isArray(world.journal.gmNotes)
          ? incomingAssets
          : { ...(this.state.mediaAssets || {}), ...incomingAssets };
      }
      if (world.journal && Array.isArray(world.journal.gmNotes)) {
        this.state.journal = {
          gmFolders: Array.isArray(world.journal.gmFolders) ? world.journal.gmFolders : [],
          gmNotes: world.journal.gmNotes,
          playerJournals: world.journal.playerJournals && typeof world.journal.playerJournals === 'object'
            ? world.journal.playerJournals
            : {},
          receivedReveals: []
        };
      }
      this.syncAllMediaAssetsFromState?.();
    } else {
      if (world.mediaAssets && typeof world.mediaAssets === 'object') {
        this.state.mediaAssets = normalizeMediaAssets(world.mediaAssets);
      } else {
        this.state.mediaAssets = {};
      }
      const selfSeat = this.getSelfSeatKey();
      const prevJournal = this.state.journal || { gmFolders: [], gmNotes: [], playerJournals: {}, receivedReveals: [] };
      const incomingJ = world.journal && typeof world.journal === 'object' ? world.journal : null;
      const nextPjMap = {};
      if (incomingJ?.playerJournal && selfSeat) {
        nextPjMap[selfSeat] = incomingJ.playerJournal;
      } else if (selfSeat && prevJournal.playerJournals?.[selfSeat]) {
        nextPjMap[selfSeat] = prevJournal.playerJournals[selfSeat];
      }
      this.state.journal = {
        gmFolders: [],
        gmNotes: [],
        playerJournals: nextPjMap,
        receivedReveals: Array.isArray(incomingJ?.receivedReveals)
          ? incomingJ.receivedReveals
          : (Array.isArray(prevJournal.receivedReveals) ? prevJournal.receivedReveals : [])
      };
    }
    if (world.combat && typeof world.combat === 'object') {
      const rawIdx = Number(world.combat.turnIndex);
      this.state.combat = {
        active: Boolean(world.combat.active),
        round: Math.max(1, Math.trunc(Number(world.combat.round) || 1)),
        turnIndex: Number.isFinite(rawIdx) ? Math.trunc(rawIdx) : 0,
        order: Array.isArray(world.combat.order) ? world.combat.order : []
      };
    }
    if (this.state.role === 'gm') {
      if (world.sceneLayers && typeof world.sceneLayers === 'object') {
        this.state.sceneLayers = JSON.parse(JSON.stringify(world.sceneLayers));
      } else if (!silent) {
        this.state.sceneLayers = {};
      }
      if (world.sceneLighting && typeof world.sceneLighting === 'object') {
        this.state.sceneLighting = JSON.parse(JSON.stringify(world.sceneLighting));
      } else if (!silent) {
        this.state.sceneLighting = {};
      }
      if (!this.state.sceneLighting || typeof this.state.sceneLighting !== 'object') {
        this.state.sceneLighting = {};
      }
      const activeKey = this.getActiveSceneKey();
      this.state.sceneLighting[activeKey] = normalizeSceneLighting({
        dynamicLighting: this.state.dynamicLighting,
        rememberExplored: this.state.rememberExplored,
        exploredMask: this.state.exploredMask,
        exploredRev: this.state.exploredRev
      });
      if (world.gmScreen && typeof world.gmScreen === 'object') {
        this.state.gmScreen = JSON.parse(JSON.stringify(world.gmScreen));
      }
      const invites = Selector.getPlayerInvites(this.state);
      const assignedIds = invites.flatMap((inv) => (Array.isArray(inv?.tokenIds) ? inv.tokenIds : []));
      const curIds = new Set((this.state.tokens || []).map((t) => t.id));
      if (assignedIds.some((id) => id && !curIds.has(id))) {
        this.state.tokens = mergeAssignedTokensForScene({
          targetTokens: this.state.tokens,
          sourceTokens: this.state.tokens,
          sceneLayers: this.state.sceneLayers,
          playerInvites: invites,
          grid: this.state.grid,
          snapFn: (wx, wy, sz) => Selector.snapPosition(this.state, wx, wy, sz)
        });
      }
      this.state.publicClocks = Selector.getPublicClocks(this.state);
    } else {
      this.state.sceneLayers = {};
      this.state.sceneLighting = {};
      this.state.gmScreen = null;
      this.state.gmScreenOpen = false;
      if (Array.isArray(world.publicClocks)) {
        this.state.publicClocks = JSON.parse(JSON.stringify(world.publicClocks));
      }
    }
    if (this.state.role === 'player') {
      this.syncPlayerRoleState();
    } else {
      const keepSel = this.state.selectedTokenId && this.state.tokens.some((t) => t.id === this.state.selectedTokenId);
      if (!keepSel) {
        this.state.selectedTokenId = this.state.tokens[0] ? this.state.tokens[0].id : null;
      }
    }
    this.notify({
      syncExplored: true,
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
    const snapshot = normalizeGridConfig(this.state.grid);
    this.state.grid = { ...snapshot };
    this.state.mapGrids[key] = snapshot;
    const customMap = (this.state.customMaps || []).find((m) => m.key === key);
    if (customMap) customMap.grid = { ...snapshot };
  },

  setExploredMaskCapture(fn) {
    this.exploredMaskCaptureFn = typeof fn === 'function' ? fn : null;
  },

  flushExploredMask() {
    if (typeof this.exploredMaskCaptureFn !== 'function') return '';
    const mask = String(this.exploredMaskCaptureFn() || '');
    if (this.state.rememberExplored === false) return this.state.exploredMask || '';
    if (!mask && this.state.exploredMask) return this.state.exploredMask;
    this.state.exploredMask = mask;
    if (this.state.role === 'gm') {
      const key = this.getActiveSceneKey();
      if (!this.state.sceneLighting || typeof this.state.sceneLighting !== 'object') {
        this.state.sceneLighting = {};
      }
      const prev = this.state.sceneLighting[key] || {};
      this.state.sceneLighting[key] = normalizeSceneLighting({
        ...prev,
        dynamicLighting: this.state.dynamicLighting,
        rememberExplored: this.state.rememberExplored,
        exploredMask: mask,
        exploredRev: this.state.exploredRev
      });
    }
    return mask;
  },

  saveActiveExploredMask(dataUrl) {
    if (!this.state) return;
    const clean = String(dataUrl || '');
    if (this.state.exploredMask === clean) return;
    this.state.exploredMask = clean;
    if (this.state.role === 'gm') {
      const key = this.getActiveSceneKey();
      if (!this.state.sceneLighting || typeof this.state.sceneLighting !== 'object') {
        this.state.sceneLighting = {};
      }
      const prev = this.state.sceneLighting[key] || {};
      this.state.sceneLighting[key] = normalizeSceneLighting({
        ...prev,
        dynamicLighting: this.state.dynamicLighting,
        rememberExplored: this.state.rememberExplored,
        exploredMask: clean,
        exploredRev: this.state.exploredRev
      });
      BrowserVault.saveRoom(
        this.state.room.code,
        Selector.extractSerializableWorld(this.state, { includePrivateGm: true })
      );
    }
  },

  getSceneLighting(sceneKey = this.getActiveSceneKey()) {
    const key = String(sceneKey || '').trim() || this.getActiveSceneKey();
    const isActive = key === this.getActiveSceneKey();
    const visCfg = Selector.getSystemVisionConfig(this.state);
    const customMap = (this.state.customMaps || []).find((m) => m.key === key);
    const raw =
      this.state.sceneLighting?.[key] ||
      (isActive
        ? {
            dynamicLighting: this.state.dynamicLighting,
            rememberExplored: this.state.rememberExplored,
            exploredMask: this.state.exploredMask,
            exploredRev: this.state.exploredRev
          }
        : customMap?.lighting) ||
      {};
    return normalizeSceneLighting(raw, {
      dynamicLighting: Boolean(this.state.dynamicLighting),
      rememberExplored: visCfg.rememberExplored,
      exploredMask: '',
      exploredRev: 0
    });
  },

  updateSceneLighting(sceneKey, patch = {}, { broadcast = true } = {}) {
    const key = String(sceneKey || '').trim() || this.getActiveSceneKey();
    if (!this.state.sceneLighting || typeof this.state.sceneLighting !== 'object') {
      this.state.sceneLighting = {};
    }
    const prev = this.getSceneLighting(key);
    const next = normalizeSceneLighting({ ...prev, ...patch });
    this.state.sceneLighting[key] = next;

    const customMap = (this.state.customMaps || []).find((m) => m.key === key);
    if (customMap) {
      customMap.lighting = {
        dynamicLighting: next.dynamicLighting,
        rememberExplored: next.rememberExplored
      };
    }

    if (key === this.getActiveSceneKey()) {
      this.state.dynamicLighting = next.dynamicLighting;
      this.state.rememberExplored = next.rememberExplored;
      this.state.exploredMask = next.exploredMask;
      this.state.exploredRev = next.exploredRev;
      if (broadcast && this.state.role === 'gm') {
        this.syncWorldToPeers();
      }
      this.notify({ syncExplored: true, redrawFog: true });
    } else {
      this.notify();
    }
    return next;
  },

  resetSceneExploredFog(sceneKey = this.getActiveSceneKey(), { broadcast = true } = {}) {
    const key = String(sceneKey || '').trim() || this.getActiveSceneKey();
    if (!this.state.sceneLighting || typeof this.state.sceneLighting !== 'object') {
      this.state.sceneLighting = {};
    }
    const cur = this.getSceneLighting(key);
    const next = normalizeSceneLighting({
      ...cur,
      exploredMask: '',
      exploredRev: (cur.exploredRev || 0) + 1
    });
    this.state.sceneLighting[key] = next;
    this.recordEvent('EXPLORACION', 'Área descubierta reseteada', { broadcast: false });

    if (key === this.getActiveSceneKey()) {
      this.state.exploredMask = '';
      this.state.exploredRev = next.exploredRev;
      if (broadcast && this.state.role === 'gm') {
        this.syncWorldToPeers();
      }
      this.notify({ clearExplored: true, redrawFog: true });
    } else {
      this.notify();
    }
    return next;
  },

  updateGrid(patch, { broadcast = false } = {}) {
    this.state.grid = normalizeGridConfig({ ...this.state.grid, ...patch });
    this.saveActiveMapGrid();
    if (broadcast && this.state.role === 'gm') {
      this.syncWorldToPeers();
    }
    this.notify({ redrawGrid: true, redrawFog: true });
  },

  updateMapGridForScene(sceneKey, patch, { broadcast = true } = {}) {
    const key = String(sceneKey || '').trim();
    if (!key) return null;
    if (!this.state.mapGrids || typeof this.state.mapGrids !== 'object') {
      this.state.mapGrids = {};
    }
    const customMap = (this.state.customMaps || []).find((m) => m.key === key);
    const prev = this.state.mapGrids[key] || customMap?.grid || {};
    const normalized = normalizeGridConfig({ ...prev, ...patch });
    this.state.mapGrids[key] = normalized;
    if (customMap) customMap.grid = { ...normalized };
    if (key === this.getActiveSceneKey()) {
      this.state.grid = { ...normalized };
      if (broadcast && this.state.role === 'gm') {
        this.syncWorldToPeers();
      }
      this.notify({ redrawGrid: true, redrawFog: true });
    } else {
      this.notify();
    }
    return normalized;
  },

  saveActiveSceneLayers() {
    this.flushExploredMask();
    const key = this.getActiveSceneKey();
    if (!this.state.sceneLayers || typeof this.state.sceneLayers !== 'object') {
      this.state.sceneLayers = {};
    }
    this.state.sceneLayers[key] = {
      tokens: Array.isArray(this.state.tokens) ? JSON.parse(JSON.stringify(this.state.tokens)) : [],
      walls: Array.isArray(this.state.walls) ? this.state.walls.map((w) => ({ ...w })) : [],
      strokes: Array.isArray(this.state.strokes)
        ? this.state.strokes.map((s) => ({
            ...s,
            points: Array.isArray(s.points) ? s.points.map((p) => ({ ...p })) : []
          }))
        : []
    };
    if (!this.state.sceneLighting || typeof this.state.sceneLighting !== 'object') {
      this.state.sceneLighting = {};
    }
    this.state.sceneLighting[key] = normalizeSceneLighting({
      dynamicLighting: this.state.dynamicLighting,
      rememberExplored: this.state.rememberExplored,
      exploredMask: this.state.exploredMask,
      exploredRev: this.state.exploredRev
    });
  },

  async changeMap(mapId, customUrl = '', sceneKey = '') {
    this.cancelAllTokenGlides();
    const prevTokens = Array.isArray(this.state.tokens) ? JSON.parse(JSON.stringify(this.state.tokens)) : [];
    const prevSelectedId = this.state.selectedTokenId;
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
    this.state.strokes = savedLayers && Array.isArray(savedLayers.strokes)
      ? savedLayers.strokes.map((s) => ({
          ...s,
          points: Array.isArray(s.points) ? s.points.map((p) => ({ ...p })) : []
        }))
      : [];
    const customMap = (this.state.customMaps || []).find((m) => m.key === nextKey);
    const savedGrid = (this.state.mapGrids && this.state.mapGrids[nextKey]) || customMap?.grid || null;
    this.state.grid = normalizeGridConfig(savedGrid || {});

    const visCfg = Selector.getSystemVisionConfig(this.state);
    const savedLighting =
      this.state.sceneLighting?.[nextKey] ||
      customMap?.lighting ||
      {
        dynamicLighting: Boolean(this.state.dynamicLighting),
        rememberExplored: visCfg.rememberExplored,
        exploredMask: '',
        exploredRev: 0
      };
    const nextLighting = normalizeSceneLighting(savedLighting, {
      dynamicLighting: Boolean(this.state.dynamicLighting),
      rememberExplored: visCfg.rememberExplored
    });
    this.state.dynamicLighting = nextLighting.dynamicLighting;
    this.state.rememberExplored = nextLighting.rememberExplored;
    this.state.exploredMask = nextLighting.exploredMask;
    this.state.exploredRev = nextLighting.exploredRev;
    if (!this.state.sceneLighting || typeof this.state.sceneLighting !== 'object') {
      this.state.sceneLighting = {};
    }
    this.state.sceneLighting[nextKey] = nextLighting;

    const targetLayerTokens = savedLayers && Array.isArray(savedLayers.tokens) ? savedLayers.tokens : [];
    this.state.tokens = mergeAssignedTokensForScene({
      targetTokens: targetLayerTokens,
      sourceTokens: prevTokens,
      sceneLayers: this.state.sceneLayers,
      playerInvites: Selector.getPlayerInvites(this.state),
      grid: this.state.grid,
      snapFn: (wx, wy, sz) => Selector.snapPosition(this.state, wx, wy, sz)
    });
    this.state.selectedTokenId = prevSelectedId && this.state.tokens.some((t) => t.id === prevSelectedId)
      ? prevSelectedId
      : (this.state.tokens[0] ? this.state.tokens[0].id : null);
    this.recordEvent('MAPA', mapId);
    this.notify({ syncExplored: true, redrawMap: true, redrawGrid: true, redrawDraw: true, redrawFog: true });
  },

  setRole(role) {
    const nextRole = role === 'player' ? 'player' : 'gm';
    if (nextRole === 'gm' && !this.state.isHostGm) return false;
    if (nextRole === 'player' && this.state.role === 'gm') {
      this.state.publicClocks = Selector.getPublicClocks(this.state);
    }
    this.state.role = nextRole;
    if (this.state.role === 'player') {
      this.state.gmScreenOpen = false;
      this.state.drawerOpen = false;
      this.state.journalOpen = false;
      this.syncPlayerRoleState();
    } else {
      this.state.journalOpen = false;
      this.state.publicClocks = Selector.getPublicClocks(this.state);
    }
    this.notify({ redrawFog: true });
    return true;
  },

  cancelTokenGlide(tokenId) {
    if (!tokenId || !(this.tokenGlides instanceof Map)) return;
    const active = this.tokenGlides.get(tokenId);
    if (!active) return;
    if (active.rafId != null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(active.rafId);
    }
    this.tokenGlides.delete(tokenId);
  },

  cancelAllTokenGlides() {
    if (!(this.tokenGlides instanceof Map)) {
      this.tokenGlides = new Map();
      return;
    }
    for (const entry of this.tokenGlides.values()) {
      if (entry?.rafId != null && typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(entry.rafId);
      }
    }
    this.tokenGlides.clear();
  },

  isTokenGliding(tokenId) {
    return Boolean(tokenId && this.tokenGlides instanceof Map && this.tokenGlides.has(tokenId));
  },

  getTokenGlideVisual(tokenId) {
    if (!tokenId || !(this.tokenGlides instanceof Map)) return null;
    const entry = this.tokenGlides.get(tokenId);
    if (!entry) return null;
    return {
      lift: entry.lift || 0,
      scale: entry.scale || 1
    };
  },

  applyRemoteTokenMove(msg) {
    if (!msg || !msg.tokenId) return false;
    const tok = (this.state.tokens || []).find((t) => t.id === msg.tokenId);
    if (!tok) return false;
    const rawX = Number(msg.x);
    const rawY = Number(msg.y);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return false;

    const targetX = Math.max(40, Math.min(2360, rawX));
    const targetY = Math.max(40, Math.min(1560, rawY));
    if (!(this.tokenGlides instanceof Map)) this.tokenGlides = new Map();
    this.cancelTokenGlide(tok.id);

    const polyline = [{ x: tok.x, y: tok.y }];
    if (Array.isArray(msg.path) && msg.path.length >= 2) {
      const sanitized = [];
      for (const p of msg.path) {
        if (!p || typeof p !== 'object') continue;
        const px = Number(p.x);
        const py = Number(p.y);
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
        sanitized.push({
          x: Math.max(40, Math.min(2360, px)),
          y: Math.max(40, Math.min(1560, py))
        });
      }
      for (let i = 0; i < sanitized.length; i++) {
        const pt = sanitized[i];
        if (i === 0 && Math.hypot(pt.x - tok.x, pt.y - tok.y) < 40) continue;
        const prev = polyline[polyline.length - 1];
        if (Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 2) {
          polyline.push(pt);
        }
      }
    }

    const last = polyline[polyline.length - 1];
    if (Math.hypot(targetX - last.x, targetY - last.y) <= 2) {
      polyline[polyline.length - 1] = { x: targetX, y: targetY };
    } else {
      polyline.push({ x: targetX, y: targetY });
    }

    const glidePath = polyline.length >= 3 ? Selector.smoothMovePath(polyline) : polyline;
    const totalDist = Selector.getPolylineLength(glidePath);
    const raf = typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame.bind(globalThis) : null;
    if (!raf || totalDist < 4) {
      tok.x = targetX;
      tok.y = targetY;
      this.notify({ tokensOnly: true, redrawFog: true, skipVaultSave: this.state.role !== 'gm', skipPeerSync: true });
      return true;
    }

    const duration = Math.max(300, Math.min(1150, Math.round(230 + totalDist * 0.72)));
    const affectsFog = Boolean(this.state.dynamicLighting) && (tok.isAlly !== false || resolveTokenLightMeters(tok) > 0);
    const distFactor = Math.min(1, Math.max(0.45, totalDist / 320));
    const nowFn = () => (typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now());
    let startTime = null;
    let lastFogAt = -Infinity;
    const entry = { rafId: null, targetX, targetY, lift: 0, scale: 1 };
    this.tokenGlides.set(tok.id, entry);

    const step = (ts) => {
      if (this.tokenGlides.get(tok.id) !== entry) return;
      const liveTok = (this.state.tokens || []).find((t) => t.id === tok.id);
      if (!liveTok) {
        this.tokenGlides.delete(tok.id);
        return;
      }
      const now = typeof ts === 'number' && Number.isFinite(ts) ? ts : nowFn();
      if (startTime === null) startTime = now;
      const rawT = Math.max(0, Math.min(1, (now - startTime) / duration));
      if (rawT >= 1) {
        this.tokenGlides.delete(tok.id);
        liveTok.x = targetX;
        liveTok.y = targetY;
        this.notify({ tokensOnly: true, redrawFog: affectsFog, skipVaultSave: this.state.role !== 'gm', skipPeerSync: true });
        return;
      }
      const eased = Selector.easeTokenGlide(rawT);
      const pt = Selector.samplePointAlongPath(glidePath, eased);
      if (pt) {
        liveTok.x = pt.x;
        liveTok.y = pt.y;
      }
      const liftWave = Math.sin(Math.PI * rawT);
      entry.lift = Number((liftWave * 5.5 * distFactor).toFixed(2));
      entry.scale = Number((1 + liftWave * 0.08 * distFactor).toFixed(4));
      const shouldRedrawFog = affectsFog && (now - lastFogAt >= 32);
      if (shouldRedrawFog) lastFogAt = now;
      this.notify({ tokensOnly: true, redrawFog: shouldRedrawFog, skipVaultSave: true, skipPeerSync: true });
      entry.rafId = raf(step);
    };

    entry.rafId = raf(step);
    return true;
  },

  setTool(tool) {
    this.state.tool = tool;
    this.state.wallAnchor = null;
    this.notify();
  },

  toggleDynamicLighting() {
    const nextDyn = !this.state.dynamicLighting;
    this.recordEvent('LUZ_DINAMICA', nextDyn ? 'ON' : 'OFF', { broadcast: false });
    this.updateSceneLighting(this.getActiveSceneKey(), { dynamicLighting: nextDyn }, { broadcast: true });
  },

  addWallSegment(x1, y1, x2, y2, kind = 'wall') {
    if (Math.hypot(x2 - x1, y2 - y1) < 10) return;
    const cleanKind = ['wall', 'terrain', 'door', 'secret'].includes(kind) ? kind : 'wall';
    this.pushUndoSnapshot();
    this.state.walls.push({
      id: `wall-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`,
      x1,
      y1,
      x2,
      y2,
      kind: cleanKind,
      open: false
    });
    const labels = {
      wall: 'Muro añadido',
      terrain: 'Pilar / terreno añadido',
      door: 'Puerta añadida',
      secret: 'Puerta secreta añadida'
    };
    this.recordEvent('MURO', labels[cleanKind] || 'Muro añadido');
    this.notify({ redrawFog: true });
  },

  toggleDoor(wallId) {
    const isGm = this.state.role === 'gm';
    const door = (this.state.walls || []).find(
      (w) => w.id === wallId && (w.kind === 'door' || (isGm && w.kind === 'secret'))
    );
    if (!door) return null;
    this.pushUndoSnapshot();
    door.open = !door.open;
    const prefix = door.kind === 'secret' ? 'PUERTA SECRETA' : 'PUERTA';
    this.recordEvent(prefix, door.open ? 'Abierta' : 'Cerrada');
    this.notify({ redrawFog: true });
    return door;
  },

  removeWallById(wallId) {
    if (!wallId || !Array.isArray(this.state.walls)) return null;
    const idx = this.state.walls.findIndex((w) => w && w.id === wallId);
    if (idx < 0) return null;
    this.pushUndoSnapshot();
    const [removed] = this.state.walls.splice(idx, 1);
    this.recordEvent('MURO', 'Muro eliminado');
    this.notify({ redrawFog: true });
    return removed;
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
  },

  /**
   * Temporarily minimize any open side drawers into a session snapshot,
   * or restore the exact previous set if none are currently open.
   */
  toggleDrawersMinimize() {
    const s = this.state;
    if (!s) return null;
    const isGm = s.role === 'gm';
    const isSpectator = Selector.isSpectator(s);
    const selTok = Selector.getSelectedToken(s);
    const effectiveSheet = Boolean(!isSpectator && s.sheetOpen && selTok && this.canControlToken(selTok));
    const effectiveGm = Boolean(isGm && s.gmScreenOpen);
    const effectiveDrawer = Boolean(isGm && s.drawerOpen);
    const effectiveJournal = Boolean(s.journalOpen);

    if (effectiveSheet || effectiveGm || effectiveDrawer || effectiveJournal) {
      this._minimizedDrawersSnapshot = {
        sheetOpen: effectiveSheet,
        gmScreenOpen: effectiveGm,
        drawerOpen: effectiveDrawer,
        journalOpen: effectiveJournal,
        selectedTokenId: s.selectedTokenId || null
      };
      s.sheetOpen = false;
      s.gmScreenOpen = false;
      s.drawerOpen = false;
      s.journalOpen = false;
      this.notify({ skipVaultSave: true, skipPeerSync: true });
      return 'minimized';
    }

    const snap = this._minimizedDrawersSnapshot;
    if (!snap) return null;
    this._minimizedDrawersSnapshot = null;

    if (!isSpectator && snap.sheetOpen) {
      let targetTok = Selector.getSelectedToken(s);
      if (!targetTok || !this.canControlToken(targetTok)) {
        const snapTok = snap.selectedTokenId ? s.tokens.find((t) => t.id === snap.selectedTokenId) : null;
        if (snapTok && this.canControlToken(snapTok)) {
          s.selectedTokenId = snapTok.id;
          targetTok = snapTok;
        }
      }
      s.sheetOpen = Boolean(targetTok && this.canControlToken(targetTok));
    }
    if (isGm && snap.gmScreenOpen && !s.sheetOpen) s.gmScreenOpen = true;
    if (isGm && snap.drawerOpen) s.drawerOpen = true;
    if (snap.journalOpen && !(isGm && s.drawerOpen)) s.journalOpen = true;

    this.notify({ skipVaultSave: true, skipPeerSync: true });
    return 'restored';
  }
};
