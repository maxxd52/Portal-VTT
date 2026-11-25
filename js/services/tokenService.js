/* ==========================================================================
   TOKEN SERVICE: FICHAS, INVENTARIO, STATS, HABILIDADES Y VISIBILIDAD
   ========================================================================== */

import { COMPENDIUM_ITEMS } from '../data/compendium.js?v=20261125a1';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { Selector } from '../core/selector.js?v=20261125a1';
import { RealtimeBridge } from './realtimeBridge.js?v=20261125a1';
import {
  DEFAULT_DARKVISION_METERS,
  formatDistance,
  legacyLightPxToMeters,
  resolveTokenDarkvisionMeters
} from '../utils/lightingModel.js?v=20261125a1';
import {
  buildActorTemplateFromToken,
  clampTokenSize,
  cloneInventoryForSpawn,
  makeUniqueTokenId,
  normalizeItemUsage,
  normalizeTemplateStats,
  resolveNextInstanceName,
  resolveStarterItemsInventory
} from '../utils/tokenTemplateSync.js?v=20261125a1';
import { resolveMovementAgainstWalls } from '../utils/wallGeometry.js?v=20261125a1';

export const TokenServiceMethods = {
  selectToken(tokenId, openSheet = true) {
    if (this.state.role === 'player') {
      const tok = tokenId ? this.state.tokens.find((t) => t.id === tokenId) : null;
      if (!tok || !this.canControlToken(tok)) return;
    }
    this.state.selectedTokenId = tokenId;
    this.state.selectedTokenIds = tokenId ? [tokenId] : [];
    if (tokenId && openSheet) {
      this.state.sheetOpen = true;
      this.state.gmScreenOpen = false;
    }
    this.notify({ skipVaultSave: true, skipPeerSync: true });
  },

  setSelectedTokens(tokenIds = []) {
    const idSet = new Set(Array.isArray(tokenIds) ? tokenIds : []);
    const matched = (this.state.tokens || []).filter((t) => {
      if (!t || !idSet.has(t.id)) return false;
      if (this.state.role === 'player') {
        return !t.hidden && this.canControlToken(t);
      }
      return true;
    });
    this.state.selectedTokenIds = matched.map((t) => t.id);
    if (matched.length > 0) {
      this.state.selectedTokenId = matched[0].id;
    }
    this.notify({ skipVaultSave: true, skipPeerSync: true });
    return this.state.selectedTokenIds;
  },

  getSelectedControllableTokens(tokenIds = null) {
    const rawIds = Array.isArray(tokenIds)
      ? tokenIds
      : Array.isArray(this.state.selectedTokenIds) && this.state.selectedTokenIds.length > 0
        ? this.state.selectedTokenIds
        : this.state.selectedTokenId
          ? [this.state.selectedTokenId]
          : [];
    const idSet = new Set(rawIds);
    return (this.state.tokens || []).filter((t) => t && idSet.has(t.id) && this.canControlToken(t));
  },

  _resolveTokenMoveTarget(tok, wx, wy, commit) {
    const rawTarget = commit ? Selector.snapPosition(this.state, wx, wy, tok.size) : { x: wx, y: wy };
    let nextX = Math.max(40, Math.min(2360, rawTarget.x));
    let nextY = Math.max(40, Math.min(1560, rawTarget.y));
    if (this.state.role === 'player' && Array.isArray(this.state.walls) && this.state.walls.length > 0) {
      const hit = resolveMovementAgainstWalls(tok.x, tok.y, nextX, nextY, this.state.walls);
      if (hit.blocked) {
        if (commit) {
          const safeSnap = Selector.snapPosition(this.state, hit.x, hit.y, tok.size);
          const snapCheck = resolveMovementAgainstWalls(tok.x, tok.y, safeSnap.x, safeSnap.y, this.state.walls);
          nextX = snapCheck.blocked ? hit.x : safeSnap.x;
          nextY = snapCheck.blocked ? hit.y : safeSnap.y;
        } else {
          nextX = hit.x;
          nextY = hit.y;
        }
      }
    }
    return {
      x: Math.max(40, Math.min(2360, nextX)),
      y: Math.max(40, Math.min(1560, nextY))
    };
  },

  moveTokensGroup(moves = [], commit = true) {
    if (!Array.isArray(moves) || moves.length === 0) return 0;
    let moved = 0;
    for (const m of moves) {
      const tok = (this.state.tokens || []).find((t) => t && t.id === m.id);
      if (!tok || !this.canControlToken(tok)) continue;
      this.cancelTokenGlide?.(tok.id);
      const fromX = tok.x;
      const fromY = tok.y;
      const pos = this._resolveTokenMoveTarget(tok, m.x, m.y, commit);
      tok.x = pos.x;
      tok.y = pos.y;
      moved += 1;
      if (commit) {
        if (!this.isHostNetwork?.()) {
          if (!(this._recentLocalMoves instanceof Map)) this._recentLocalMoves = new Map();
          this._recentLocalMoves.set(tok.id, { fromX, fromY, toX: tok.x, toY: tok.y, at: Date.now() });
        }
        const path = Array.isArray(m.rawPath) && m.rawPath.length >= 2
          ? Selector.simplifyMovePath(m.rawPath, { x: tok.x, y: tok.y }, 12)
          : null;
        const payload = { kind: 'TOKEN_MOVE', clientId: this.clientId, tokenId: tok.id, x: tok.x, y: tok.y };
        if (path) payload.path = path;
        RealtimeBridge.send(payload);
      }
    }
    if (moved === 0) return 0;
    if (commit) {
      this.recordEvent('MOVER_FICHA', `${moved} fichas movidas`, { broadcast: false });
      this.notify({ skipPeerSync: true });
    } else {
      this.notify({ tokensOnly: true, skipVaultSave: true });
    }
    return moved;
  },

  adjustTokensHp(tokenIds = [], delta = 0) {
    const targets = this.getSelectedControllableTokens(tokenIds);
    if (targets.length === 0 || !delta) return 0;
    this.pushUndoSnapshot();
    const hpBlk = Selector.getSystemSheetBlocks(this.state).find((b) => b.kind === 'resource' && b.key === 'hp');
    for (const tok of targets) {
      const effMax = hpBlk ? Selector.resolveResourceMax(this.state, tok, hpBlk) : (Number(tok.maxHp) || 999);
      const upper = effMax === 0 ? 999 : Math.max(1, effMax);
      tok.hp = Math.max(0, Math.min(upper, (Number(tok.hp) || 0) + delta));
    }
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    this.recordEvent('HP_FICHA', `${targets.length} fichas (${sign} HP)`);
    this.notify();
    return targets.length;
  },

  toggleTokensCondition(tokenIds = [], condKey) {
    const targets = this.getSelectedControllableTokens(tokenIds);
    if (targets.length === 0 || !condKey) return 0;
    this.pushUndoSnapshot();
    const allHave = targets.every((t) => Array.isArray(t.conditions) && t.conditions.includes(condKey));
    for (const tok of targets) {
      if (!Array.isArray(tok.conditions)) tok.conditions = [];
      if (allHave) {
        tok.conditions = tok.conditions.filter((c) => c !== condKey);
      } else if (!tok.conditions.includes(condKey)) {
        tok.conditions.push(condKey);
      }
    }
    this.notify();
    return targets.length;
  },

  cycleTokensLight(tokenIds = []) {
    const targets = this.getSelectedControllableTokens(tokenIds);
    if (targets.length === 0) return 0;
    this.pushUndoSnapshot();
    const cfg = Selector.getSystemVisionConfig(this.state);
    const firstMeters = Number(targets[0].lightMeters) || 0;
    const nextMeters = firstMeters <= 0 ? cfg.torchMeters : firstMeters < cfg.lanternMeters ? cfg.lanternMeters : 0;
    for (const tok of targets) {
      tok.lightMeters = nextMeters;
      tok.lightRadius = 0;
    }
    this.notify({ redrawFog: true });
    return targets.length;
  },

  cycleTokensAura(tokenIds = []) {
    const targets = this.getSelectedControllableTokens(tokenIds);
    if (targets.length === 0) return 0;
    this.pushUndoSnapshot();
    const firstAura = Number(targets[0].auraRadius) || 0;
    const nextAura = firstAura === 0 ? 90 : firstAura === 90 ? 135 : 0;
    for (const tok of targets) {
      tok.auraRadius = nextAura;
    }
    this.notify();
    return targets.length;
  },

  toggleTokensHidden(tokenIds = []) {
    if (this.state.role !== 'gm') return 0;
    const targets = this.getSelectedControllableTokens(tokenIds);
    if (targets.length === 0) return 0;
    this.pushUndoSnapshot();
    const allHidden = targets.every((t) => Boolean(t.hidden));
    for (const tok of targets) {
      tok.hidden = !allHidden;
    }
    this.notify({ redrawFog: true });
    return targets.length;
  },

  duplicateTokens(tokenIds = []) {
    if (this.state.role !== 'gm') return [];
    const targets = this.getSelectedControllableTokens(tokenIds);
    if (targets.length === 0) return [];
    this.pushUndoSnapshot();
    const step = Number(this.state.grid?.cellSize) || 80;
    const existing = new Set(this.state.tokens.map((t) => t.name));
    const clones = [];
    for (const tok of targets) {
      const baseName = tok.name.replace(/\s+\d+$/, '');
      let idx = 2;
      while (existing.has(`${baseName} ${idx}`)) idx += 1;
      const cloneName = `${baseName} ${idx}`;
      existing.add(cloneName);
      const clone = JSON.parse(JSON.stringify(tok));
      clone.id = `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      clone.name = cloneName;
      clone.x = tok.x + step <= 2320 ? tok.x + step : Math.max(40, tok.x - step);
      clone.y = tok.x + step <= 2320 ? tok.y : Math.min(1520, tok.y + step);
      this.state.tokens.push(clone);
      clones.push(clone);
    }
    this.state.selectedTokenIds = clones.map((c) => c.id);
    if (clones[0]) this.state.selectedTokenId = clones[0].id;
    this.recordEvent('DUPLICAR_FICHA', `${clones.length} fichas duplicadas`);
    this.notify({ redrawFog: true });
    return clones;
  },

  deleteTokens(tokenIds = []) {
    if (this.state.role !== 'gm') return 0;
    const targets = this.getSelectedControllableTokens(tokenIds);
    if (targets.length === 0) return 0;
    const idSet = new Set(targets.map((t) => t.id));
    this.pushUndoSnapshot();
    this.state.tokens = this.state.tokens.filter((t) => !t || !idSet.has(t.id));
    if (Array.isArray(this.state.playerInvites)) {
      this.state.playerInvites.forEach((inv) => {
        if (Array.isArray(inv.tokenIds)) inv.tokenIds = inv.tokenIds.filter((id) => !idSet.has(id));
      });
    }
    if (idSet.has(this.state.selectedTokenId)) {
      this.state.selectedTokenId = this.state.tokens[0] ? this.state.tokens[0].id : null;
    }
    this.state.selectedTokenIds = [];
    for (const id of idSet) {
      this.removeTokenFromCombat?.(id, { silent: true });
    }
    this.pruneUnusedMediaAssets?.();
    this.recordEvent('ELIMINAR_FICHA', `${targets.length} fichas eliminadas`);
    this.notify({ redrawFog: true });
    return targets.length;
  },

  focusToken(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return;
    const zoom = Number(this.state.camera?.zoom) || 1;
    this.state.camera.x = Math.round(window.innerWidth / 2 - tok.x * zoom);
    this.state.camera.y = Math.round(window.innerHeight / 2 - tok.y * zoom);
    this.notify({ cameraOnly: true, skipVaultSave: true, skipPeerSync: true });
  },

  moveToken(tokenId, wx, wy, commit = true, rawPath = null) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return;
    this.cancelTokenGlide?.(tokenId);
    const fromX = tok.x;
    const fromY = tok.y;
    const pos = this._resolveTokenMoveTarget(tok, wx, wy, commit);
    tok.x = pos.x;
    tok.y = pos.y;
    if (commit) {
      if (!this.isHostNetwork?.()) {
        if (!(this._recentLocalMoves instanceof Map)) this._recentLocalMoves = new Map();
        this._recentLocalMoves.set(tok.id, { fromX, fromY, toX: tok.x, toY: tok.y, at: Date.now() });
      }
      const path = Array.isArray(rawPath) && rawPath.length >= 2
        ? Selector.simplifyMovePath(rawPath, { x: tok.x, y: tok.y }, 12)
        : null;
      const payload = { kind: 'TOKEN_MOVE', clientId: this.clientId, tokenId: tok.id, x: tok.x, y: tok.y };
      if (path) payload.path = path;
      this.recordEvent('MOVER_FICHA', `${tok.name} -> (${Math.round(tok.x)}, ${Math.round(tok.y)})`, { broadcast: false });
      RealtimeBridge.send(payload);
      this.notify({ skipPeerSync: true });
    } else {
      this.notify({ tokensOnly: true, skipVaultSave: true, skipPeerSync: true });
    }
  },

  async spawnActorFromTemplate(tpl, wx, wy) {
    if (!tpl) return null;
    const sourceTpl =
      (tpl.key && Array.isArray(this.state.customActors)
        ? this.state.customActors.find((a) => a && a.key === tpl.key)
        : null) || tpl;
    const isAlly = sourceTpl.isAlly !== false;
    const size = clampTokenSize(sourceTpl.size, 1);
    const snapped = Selector.snapPosition(this.state, wx, wy, size);

    // Linked Protagonist: never duplicate if already present on this scene; reposition & focus instead
    if (isAlly && sourceTpl.key) {
      const existingLive = (this.state.tokens || []).find(
        (t) => t && t.isAlly !== false && t.actorKey === sourceTpl.key
      );
      if (existingLive) {
        existingLive.x = Math.max(40, Math.min(2360, snapped.x));
        existingLive.y = Math.max(40, Math.min(1560, snapped.y));
        this.state.selectedTokenId = existingLive.id;
        this.state.selectedTokenIds = [existingLive.id];
        this.recordEvent('MOVER_FICHA', `${existingLive.name} reubicado`);
        this.notify({ redrawFog: true });
        return existingLive;
      }
    }

    const directImg = DriveUrlHelper.toDirectImageUrl(sourceTpl.imageUrl || '') || String(sourceTpl.imageUrl || '').trim();
    const mediaId = directImg ? (this.registerMediaAsset?.(directImg, { label: sourceTpl.name, kind: 'token' }) || '') : '';
    const starterInv = Array.isArray(sourceTpl.inventory)
      ? cloneInventoryForSpawn(sourceTpl.inventory, { freshUids: !isAlly })
      : resolveStarterItemsInventory(sourceTpl.starterItems, this.state.customItems, COMPENDIUM_ITEMS);

    const initialStats = normalizeTemplateStats(sourceTpl.stats);
    Selector.getSheetStatsDef(this.state).forEach((def) => {
      if (initialStats[def.key] === undefined) {
        initialStats[def.key] = Number(sourceTpl.stats?.[def.key]) || 0;
      }
    });

    const sysBlocks = Array.isArray(this.state.systemConfig?.sheetBlocks)
      ? Selector.getSystemSheetBlocks(this.state)
      : null;
    const hpBlock = sysBlocks ? sysBlocks.find((b) => b.kind === 'resource' && b.key === 'hp') : null;
    const rawMaxHp = Number(sourceTpl.maxHp ?? sourceTpl.hp) || 0;
    const calcHpMax = hpBlock
      ? Selector.resolveResourceMax(this.state, { stats: initialStats, maxHp: rawMaxHp || 16 }, hpBlock)
      : 16;
    const defMaxHp = Math.max(1, rawMaxHp || calcHpMax || 16);
    const defCurHp =
      isAlly && sourceTpl.hp !== undefined && Number.isFinite(Number(sourceTpl.hp))
        ? Math.max(0, Math.min(defMaxHp, Number(sourceTpl.hp)))
        : defMaxHp;
    const seedResList = Array.isArray(sourceTpl.resources)
      ? sourceTpl.resources.map((r) => {
          const copy = JSON.parse(JSON.stringify(r));
          if (!isAlly && Number(copy.max) > 0) {
            copy.cur = Number(copy.max);
            if (Array.isArray(copy.pips)) copy.pips = copy.pips.map(() => 0);
          }
          return copy;
        })
      : sysBlocks
        ? sysBlocks
            .filter((b) => b.kind === 'resource' && b.key !== 'hp')
            .map((b) => {
              const effMax = Selector.resolveResourceMax(this.state, { stats: initialStats, maxHp: defMaxHp }, b);
              return {
                id: b.id,
                name: b.label,
                cur: effMax > 0 ? effMax : 0,
                max: effMax,
                color: b.color || '#8b5cf6',
                kind: b.resStyle === 'pips' || b.resStyle === 'bar' ? b.resStyle : effMax > 0 && effMax <= 6 ? 'pips' : 'bar'
              };
            })
        : (this.state.systemConfig?.resourceSchema || []).map((r) => ({
            id: r.id || `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
            name: r.name,
            cur: Number(r.max) > 0 ? Number(r.max) : 0,
            max: Number(r.max) || 0,
            color: r.color || '#8b5cf6',
            kind: r.kind || 'bar'
          }));

    const instanceName = isAlly
      ? sourceTpl.name
      : resolveNextInstanceName(
          sourceTpl.name,
          (this.state.tokens || []).map((t) => t?.name)
        );

    const token = {
      id: makeUniqueTokenId(),
      actorKey: sourceTpl.key || '',
      name: instanceName,
      role: sourceTpl.role || (isAlly ? 'Protagonista' : 'Secundario'),
      color: sourceTpl.color || (isAlly ? '#8b5cf6' : '#ef4444'),
      isAlly,
      visionMeters:
        sourceTpl.visionMeters !== null &&
        sourceTpl.visionMeters !== undefined &&
        sourceTpl.visionMeters !== '' &&
        Number.isFinite(Number(sourceTpl.visionMeters))
          ? Math.max(0, Math.min(60, Number(sourceTpl.visionMeters)))
          : null,
      lightMeters: Math.max(0, Math.min(60, Number(sourceTpl.lightMeters) || 0)),
      darkvisionMeters: resolveTokenDarkvisionMeters(sourceTpl),
      darkvision: resolveTokenDarkvisionMeters(sourceTpl) > 0,
      imageUrl: directImg,
      mediaId,
      publicDescription: String(sourceTpl.publicDescription || ''),
      privateNotes: String(sourceTpl.privateNotes || ''),
      size,
      x: snapped.x,
      y: snapped.y,
      hp: defCurHp,
      maxHp: defMaxHp,
      ac: Number(sourceTpl.ac) || 12,
      level: Math.max(1, Math.min(20, Number(sourceTpl.level) || 1)),
      speed: String(sourceTpl.speed || '30 ft'),
      stats: initialStats,
      texts: sourceTpl.texts ? JSON.parse(JSON.stringify(sourceTpl.texts)) : {},
      scores: sourceTpl.scores ? JSON.parse(JSON.stringify(sourceTpl.scores)) : null,
      saveProfs: sourceTpl.saveProfs ? JSON.parse(JSON.stringify(sourceTpl.saveProfs)) : {},
      skills: Array.isArray(sourceTpl.skills) ? JSON.parse(JSON.stringify(sourceTpl.skills)) : [],
      traits: Array.isArray(sourceTpl.traits) ? JSON.parse(JSON.stringify(sourceTpl.traits)) : [],
      resources: seedResList,
      inventory: starterInv,
      conditions: isAlly && Array.isArray(sourceTpl.conditions) ? [...sourceTpl.conditions] : [],
      ...(isAlly && Array.isArray(sourceTpl.hpPips) ? { hpPips: [...sourceTpl.hpPips] } : {}),
      hidden: false
    };

    this.state.tokens.push(token);
    this.state.selectedTokenId = token.id;
    this.state.selectedTokenIds = [token.id];
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

  applyTokenPassiveBonus(tok, item, sign = 1) {
    if (!tok || !item) return;
    const { passives } = Selector.normalizeItemSchema(item);
    passives.forEach(({ target, value }) => {
      const delta = (Number(value) || 0) * sign;
      if (delta === 0 || !target) return;
      if (target === 'ac') {
        tok.ac = Math.max(8, (Number(tok.ac) || 12) + delta);
      } else if (target === 'maxHp') {
        tok.maxHp = Math.max(1, (Number(tok.maxHp) || 10) + delta);
        if (sign > 0 && delta > 0) tok.hp = Math.min(tok.maxHp, (Number(tok.hp) || 0) + delta);
        else tok.hp = Math.min(tok.maxHp, Number(tok.hp) || 0);
      } else {
        if (!tok.stats || typeof tok.stats !== 'object') {
          tok.stats = {};
        }
        tok.stats[target] = (Number(tok.stats[target]) || 0) + delta;
      }
    });
  },

  equipItemToToken(tokenId, itemTpl) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !itemTpl) return null;
    if (!Array.isArray(tok.inventory)) tok.inventory = [];
    const { usageMode, maxUses } = normalizeItemUsage(itemTpl);
    const invEntry = {
      uid: `inv-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 99)}`,
      key: itemTpl.key || 'custom_item',
      name: itemTpl.name,
      kind: itemTpl.kind || 'weapon',
      usageMode,
      maxUses,
      ...(usageMode !== 'permanent' ? { uses: maxUses } : {}),
      badge: itemTpl.badge || itemTpl.formula || 'ATQ +2',
      message: String(itemTpl.message || '').trim(),
      formula: String(itemTpl.formula || '').trim(),
      bonusMod: Number(itemTpl.bonusMod) || 0,
      die: itemTpl.die !== undefined ? Number(itemTpl.die) || 0 : 0,
      statTarget: itemTpl.statTarget || (itemTpl.acBonus ? 'ac' : 'ac'),
      statBonus: itemTpl.statBonus !== undefined ? Number(itemTpl.statBonus) || 0 : Number(itemTpl.acBonus) || 0,
      acBonus: Number(itemTpl.acBonus) || 0,
      heal: Number(itemTpl.heal) || 0,
      lightMeters: Number(itemTpl.lightMeters) || 0,
      lightRadius: Number(itemTpl.lightRadius) || 0,
      passives: Array.isArray(itemTpl.passives) ? JSON.parse(JSON.stringify(itemTpl.passives)) : undefined,
      steps: Array.isArray(itemTpl.steps) ? JSON.parse(JSON.stringify(itemTpl.steps)) : undefined,
      icon: String(itemTpl.icon || '').trim(),
      color: itemTpl.color || '#8b5cf6'
    };
    tok.inventory.push(invEntry);
    this.applyTokenPassiveBonus(tok, invEntry, 1);
    this.state.selectedTokenId = tok.id;
    this.state.sheetOpen = true;
    this.state.gmScreenOpen = false;
    this.recordEvent('EQUIPAR_OBJETO', `${invEntry.name} -> ${tok.name}`);
    this.notify({ redrawFog: true });
    return { token: tok, item: invEntry };
  },

  _consumeInventoryItemUse(tok, inv) {
    if (!tok || !inv) return { consumed: false, removed: false, uses: 0 };
    const { usageMode, maxUses } = normalizeItemUsage(inv);
    if (usageMode === 'permanent') return { consumed: false, removed: false, uses: 0 };
    const curUses = inv.uses !== undefined ? Math.max(0, Math.trunc(Number(inv.uses) || 0)) : maxUses;
    const nextUses = Math.max(0, curUses - 1);
    inv.usageMode = usageMode;
    inv.maxUses = maxUses;
    if (usageMode === 'consumable' && nextUses <= 0) {
      tok.inventory = (tok.inventory || []).filter((i) => i.uid !== inv.uid);
      this.applyTokenPassiveBonus(tok, inv, -1);
      return { consumed: true, removed: true, uses: 0 };
    }
    inv.uses = nextUses;
    return { consumed: true, removed: false, uses: nextUses };
  },

  adjustTokenItemUses(tokenId, invUid, delta) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.inventory)) return null;
    const inv = tok.inventory.find((i) => i.uid === invUid);
    if (!inv) return null;
    const { usageMode, maxUses } = normalizeItemUsage(inv);
    if (usageMode === 'permanent') return null;
    const curUses = inv.uses !== undefined ? Math.max(0, Math.trunc(Number(inv.uses) || 0)) : maxUses;
    const nextUses = Math.max(0, Math.min(maxUses, curUses + Math.trunc(Number(delta) || 0)));
    inv.usageMode = usageMode;
    inv.maxUses = maxUses;
    if (usageMode === 'consumable' && nextUses <= 0) {
      tok.inventory = tok.inventory.filter((i) => i.uid !== invUid);
      this.applyTokenPassiveBonus(tok, inv, -1);
      this.notify({ redrawFog: Boolean(inv.lightMeters) });
      return { removed: true, uses: 0 };
    }
    inv.uses = nextUses;
    this.notify();
    return { removed: false, uses: nextUses };
  },

  rechargeTokenItem(tokenId, invUid) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.inventory)) return null;
    const inv = tok.inventory.find((i) => i.uid === invUid);
    if (!inv) return null;
    const { usageMode, maxUses } = normalizeItemUsage(inv);
    if (usageMode === 'permanent') return null;
    inv.usageMode = usageMode;
    inv.maxUses = maxUses;
    inv.uses = maxUses;
    this.recordEvent('RECARGAR_OBJETO', `${tok.name} · ${inv.name} (${maxUses}/${maxUses})`);
    this.notify();
    return inv;
  },

  useTokenInventoryItem(tokenId, invUid) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.inventory)) return '';
    const inv = tok.inventory.find((i) => i.uid === invUid);
    if (!inv) return '';

    const { usageMode, maxUses } = normalizeItemUsage(inv);
    const curUses = inv.uses !== undefined ? Math.max(0, Math.trunc(Number(inv.uses) || 0)) : maxUses;
    if (usageMode === 'charges' && curUses <= 0) {
      return `${inv.name} sin cargas (0/${maxUses}).`;
    }

    const noteSuffix = inv.message ? ` — ${inv.message}` : '';

    if ((Array.isArray(inv.steps) && inv.steps.length > 0) || (inv.message && usageMode === 'permanent' && !inv.formula && !(inv.die > 0))) {
      this.startItemSequence(tokenId, inv);
      if (usageMode !== 'permanent') {
        this._consumeInventoryItemUse(tok, inv);
        this.notify({ redrawFog: Boolean(inv.lightMeters) });
      }
      return '';
    }

    if (inv.formula) {
      const roll = this.rollFormula(inv.formula, tok, `${tok.name} · ${inv.name}`, inv.message);
      if (usageMode !== 'permanent') {
        if (inv.kind === 'consumable' || inv.heal > 0) {
          const healAmt = inv.heal > 0 ? inv.heal : Math.max(0, roll ? roll.total : 0);
          if (healAmt > 0) {
            const prevHp = tok.hp;
            tok.hp = Math.min(tok.maxHp, tok.hp + healAmt);
            this._consumeInventoryItemUse(tok, inv);
            this.notify({ redrawFog: Boolean(inv.lightMeters) });
            return `${tok.name} usa ${inv.name} (+${tok.hp - prevHp} HP).`;
          }
        }
        this._consumeInventoryItemUse(tok, inv);
        this.notify({ redrawFog: Boolean(inv.lightMeters) });
      }
      return '';
    }

    if (inv.heal > 0) {
      const prevHp = tok.hp;
      tok.hp = Math.min(tok.maxHp, tok.hp + inv.heal);
      this._consumeInventoryItemUse(tok, inv);
      const healed = tok.hp - prevHp;
      if (inv.die > 0) {
        this.rollDice(inv.die, `${tok.name} · ${inv.name}`, inv.message, inv.bonusMod || 0);
      }
      this.recordEvent('USAR_OBJETO', `${tok.name} usa ${inv.name}${noteSuffix} (+${healed} HP)`);
      this.notify({ redrawFog: Boolean(inv.lightMeters) });
      return `${tok.name} usa ${inv.name}${noteSuffix} (+${healed} HP).`;
    }

    if (inv.die > 0) {
      this.rollDice(inv.die, `${tok.name} · ${inv.name}`, inv.message, inv.bonusMod || 0);
      if (usageMode !== 'permanent') {
        this._consumeInventoryItemUse(tok, inv);
        this.notify({ redrawFog: Boolean(inv.lightMeters) });
      }
      return '';
    }

    if (inv.message) {
      this.recordEvent('USAR_OBJETO', `${tok.name} · ${inv.name}: ${inv.message}`);
      if (usageMode !== 'permanent') {
        this._consumeInventoryItemUse(tok, inv);
      }
      this.notify({ redrawFog: Boolean(inv.lightMeters) });
      return `${tok.name} usa ${inv.name}: ${inv.message}`;
    }

    if (usageMode !== 'permanent') {
      const res = this._consumeInventoryItemUse(tok, inv);
      this.recordEvent('USAR_OBJETO', `${tok.name} usa ${inv.name}`);
      this.notify({ redrawFog: Boolean(inv.lightMeters) });
      return res.removed ? `${tok.name} consume ${inv.name}.` : `${tok.name} usa ${inv.name}.`;
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
    const hpBlk = Selector.getSystemSheetBlocks(this.state).find((b) => b.kind === 'resource' && b.key === 'hp');
    const effMax = hpBlk ? Selector.resolveResourceMax(this.state, tok, hpBlk) : (Number(tok.maxHp) || 999);
    const upper = effMax === 0 ? 999 : Math.max(1, effMax);
    tok.hp = Math.max(0, Math.min(upper, (Number(tok.hp) || 0) + delta));
    this.recordEvent('HP_FICHA', `${tok.name}: ${effMax > 0 ? `${tok.hp}/${upper}` : tok.hp}`);
    this.notify();
  },

  setTokenHp(tokenId, nextHp) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return null;
    const hpBlk = Selector.getSystemSheetBlocks(this.state).find((b) => b.kind === 'resource' && b.key === 'hp');
    const effMax = hpBlk ? Selector.resolveResourceMax(this.state, tok, hpBlk) : (Number(tok.maxHp) || 999);
    const upper = effMax === 0 ? 999 : Math.max(1, effMax);
    const clamped = Math.max(0, Math.min(upper, Math.round(Number(nextHp) || 0)));
    if (Number(tok.hp) === clamped) return clamped;
    this.pushUndoSnapshot();
    tok.hp = clamped;
    this.recordEvent('HP_FICHA', `${tok.name}: ${effMax > 0 ? `${tok.hp}/${upper}` : tok.hp}`);
    this.notify();
    return clamped;
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

  updateTokenStat(tokenId, statKey, val) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const key = Selector.normalizeStatKey(statKey);
    if (!tok || !key) return;
    const num = Math.max(-99, Math.min(999, Math.trunc(Number(val) || 0)));
    if (!tok.stats || typeof tok.stats !== 'object') tok.stats = {};
    tok.stats[key] = num;
    if (key === 'ac') tok.ac = Math.max(0, num);
    this.notify();
  },

  updateTokenText(tokenId, textKey, val) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const key = Selector.normalizeStatKey(textKey);
    if (!tok || !key) return;
    if (!tok.texts || typeof tok.texts !== 'object') tok.texts = {};
    tok.texts[key] = String(val || '');
    this.notify();
  },

  toggleTokenBlockCheck(tokenId, key) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const cleanKey = Selector.normalizeStatKey(key);
    if (!tok || !cleanKey) return;
    if (!tok.blockChecks || typeof tok.blockChecks !== 'object') tok.blockChecks = {};
    tok.blockChecks[cleanKey] = !tok.blockChecks[cleanKey];
    this.notify();
  },

  setTokenBlockDie(tokenId, key, sides) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const cleanKey = Selector.normalizeStatKey(key);
    const validDice = [4, 6, 8, 10, 12, 20];
    const chosen = validDice.includes(Number(sides)) ? Number(sides) : 6;
    if (!tok || !cleanKey) return;
    if (!tok.stats || typeof tok.stats !== 'object') tok.stats = {};
    tok.stats[cleanKey] = chosen;
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

  toggleTokenHidden(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return;
    this.pushUndoSnapshot();
    tok.hidden = !tok.hidden;
    this.recordEvent('VISIBILIDAD_FICHA', `${tok.name}: ${tok.hidden ? 'Oculta' : 'Visible'}`);
    this.notify();
  },

  updateTokenImage(tokenId, imageUrl = '') {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return null;
    this.pushUndoSnapshot();
    const raw = String(imageUrl || '').trim();
    const clean = raw ? (DriveUrlHelper.toDirectImageUrl(raw) || raw) : '';
    tok.imageUrl = clean;
    tok.mediaId = clean ? (this.registerMediaAsset?.(clean, { label: tok.name, kind: 'token' }) || '') : '';
    this.pruneUnusedMediaAssets?.();
    this.recordEvent('IMAGEN_FICHA', tok.name);
    this.notify();
    return tok;
  },

  updateTokenPublicDescription(tokenId, description = '') {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return null;
    tok.publicDescription = String(description || '');
    this.notify();
    return tok;
  },

  updateTokenPrivateNotes(tokenId, notes = '') {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return null;
    tok.privateNotes = String(notes || '');
    this.notify();
    return tok;
  },

  openTokenInspection(tokenId) {
    const tok = (this.state.tokens || []).find((t) => t && t.id === tokenId);
    if (!tok) return false;
    if (this.state.role === 'player' && tok.hidden) return false;
    this.state.inspectTokenId = tok.id;
    this.notify({ skipVaultSave: true, skipPeerSync: true });
    return true;
  },

  closeTokenInspection() {
    if (!this.state.inspectTokenId) return false;
    this.state.inspectTokenId = null;
    this.notify({ skipVaultSave: true, skipPeerSync: true });
    return true;
  },

  cycleTokenLight(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return 0;
    const visionCfg = Selector.getSystemVisionConfig(this.state);
    const steps = [0];
    if (!steps.includes(visionCfg.torchMeters)) steps.push(visionCfg.torchMeters);
    if (!steps.includes(visionCfg.lanternMeters)) steps.push(visionCfg.lanternMeters);
    const cur =
      tok.lightMeters !== null && tok.lightMeters !== undefined && Number.isFinite(Number(tok.lightMeters))
        ? Math.max(0, Number(tok.lightMeters))
        : legacyLightPxToMeters(tok.lightRadius);
    const idx = steps.indexOf(cur);
    const next = steps[(idx >= 0 ? idx + 1 : 1) % steps.length];
    tok.lightMeters = next;
    tok.lightRadius = 0;
    this.recordEvent(
      'LUZ_FICHA',
      `${tok.name}: ${next > 0 ? formatDistance(next, visionCfg.distanceUnit) : 'Apagada'}`
    );
    this.notify({ redrawFog: true });
    return next;
  },

  setTokenVision(tokenId, metersOrNull) {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return null;
    if (metersOrNull === null || metersOrNull === '' || metersOrNull === undefined) {
      tok.visionMeters = null;
    } else {
      const n = Number(metersOrNull);
      if (!Number.isFinite(n)) return null;
      tok.visionMeters = Math.round(Math.max(0, Math.min(60, n)) * 100) / 100;
    }
    this.recordEvent(
      'VISION_FICHA',
      `${tok.name}: ${tok.visionMeters === null ? 'Base del sistema' : `${tok.visionMeters} m`}`
    );
    this.notify({ redrawFog: true });
    return tok.visionMeters;
  },

  setTokenLight(tokenId, meters) {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return 0;
    const n = Number(meters);
    const clamped = Number.isFinite(n) ? Math.round(Math.max(0, Math.min(60, n)) * 100) / 100 : 0;
    tok.lightMeters = clamped;
    tok.lightRadius = 0;
    this.propagateTokenPatchToSceneLayers?.(tok.id, { lightMeters: clamped, lightRadius: 0 });
    const visionCfg = Selector.getSystemVisionConfig(this.state);
    this.recordEvent(
      'LUZ_FICHA',
      `${tok.name}: ${clamped > 0 ? formatDistance(clamped, visionCfg.distanceUnit) : 'Apagada'}`
    );
    this.notify({ redrawFog: true, flushVault: true });
    return clamped;
  },

  setTokenDarkvisionMeters(tokenId, meters) {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return 0;
    const n = Number(meters);
    const clamped = Number.isFinite(n) ? Math.round(Math.max(0, Math.min(60, n)) * 100) / 100 : 0;
    tok.darkvisionMeters = clamped;
    tok.darkvision = clamped > 0;
    this.propagateTokenPatchToSceneLayers?.(tok.id, { darkvisionMeters: clamped, darkvision: clamped > 0 });
    const visionCfg = Selector.getSystemVisionConfig(this.state);
    this.recordEvent(
      'VISION_OSCURA_FICHA',
      `${tok.name}: ${clamped > 0 ? formatDistance(clamped, visionCfg.distanceUnit) : 'Apagada'}`
    );
    this.notify({ redrawFog: true, flushVault: true });
    return clamped;
  },

  setTokenDarkvision(tokenId, enabled) {
    const next = Boolean(enabled);
    const res = this.setTokenDarkvisionMeters(tokenId, next ? DEFAULT_DARKVISION_METERS : 0);
    return res > 0;
  },

  cycleTokenAura(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return 0;
    const steps = [0, 90, 135];
    const cur = Number(tok.auraRadius) || 0;
    const next = steps[(steps.indexOf(cur) + 1) % steps.length];
    return this.setTokenAura(tokenId, next);
  },

  setTokenAura(tokenId, radiusPx) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return 0;
    const next = Math.max(0, Math.round(Number(radiusPx) || 0));
    tok.auraRadius = next;
    this.recordEvent('AURA_FICHA', `${tok.name}: ${next ? next + 'px' : 'Apagada'}`);
    this.notify();
    return next;
  },

  setTokenSize(tokenId, size) {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok || (this.state.role !== 'gm' && !this.canControlToken(tok))) return null;
    const next = clampTokenSize(size, tok.size || 1);
    tok.size = next;
    this.recordEvent('TAMANO_FICHA', `${tok.name}: ${next}x${next}`);
    this.notify({ redrawFog: true });
    return next;
  },

  cycleTokenSize(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return 1;
    const steps = [1, 2, 3, 4];
    const cur = clampTokenSize(tok.size, 1);
    const next = steps[(steps.indexOf(cur) + 1) % steps.length];
    return this.setTokenSize(tokenId, next) || next;
  },

  resetTokenTempProps(tokenId) {
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return false;
    const tpl = tok.actorKey
      ? (this.state.customActors || []).find((a) => a && a.key === tok.actorKey)
      : null;
    if (this.state.role === 'gm') {
      tok.size = clampTokenSize(tpl?.size, 1);
    }
    tok.lightMeters = Math.max(0, Math.min(60, Number(tpl?.lightMeters) || 0));
    tok.lightRadius = 0;
    tok.visionMeters =
      tpl && tpl.visionMeters !== null && tpl.visionMeters !== undefined && tpl.visionMeters !== '' && Number.isFinite(Number(tpl.visionMeters))
        ? Math.max(0, Math.min(60, Number(tpl.visionMeters)))
        : null;
    tok.darkvisionMeters = resolveTokenDarkvisionMeters(tpl);
    tok.darkvision = tok.darkvisionMeters > 0;
    this.recordEvent('FICHA_BASE', `${tok.name}: valores temporales restablecidos`);
    this.notify({ redrawFog: true });
    return true;
  },

  saveTokenToVault(tokenId) {
    if (this.state.role !== 'gm') return null;
    const tok = (this.state.tokens || []).find((t) => t && t.id === tokenId);
    if (!tok) return null;
    const list = Array.isArray(this.state.customActors) ? this.state.customActors : [];
    const existing = tok.actorKey ? list.find((a) => a && a.key === tok.actorKey) : null;
    const entry = buildActorTemplateFromToken(tok, existing);
    if (!entry) return null;
    if (entry.imageUrl) {
      entry.mediaId = this.registerMediaAsset?.(entry.imageUrl, { label: entry.name, kind: 'token' }) || entry.mediaId || '';
    }
    const idx = list.findIndex((a) => a && a.key === entry.key);
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
    }
    this.state.customActors = list;
    tok.actorKey = entry.key;
    this.recordEvent('COMPENDIO', `Ficha guardada en Baúl: ${entry.name}`);
    this.notify();
    return entry;
  },

  toggleTokenAlly(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return true;
    tok.isAlly = tok.isAlly === false;
    if (!tok.isAlly && Array.isArray(this.state.playerInvites)) {
      this.state.playerInvites.forEach((inv) => {
        if (Array.isArray(inv.tokenIds)) inv.tokenIds = inv.tokenIds.filter((id) => id !== tok.id);
      });
    }
    this.recordEvent('BANDO_FICHA', `${tok.name}: ${tok.isAlly ? 'Protagonista' : 'Secundario'}`);
    this.notify({ redrawFog: true });
    return tok.isAlly;
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
    this.state.selectedTokenIds = [clone.id];
    this.recordEvent('DUPLICAR_FICHA', clone.name);
    this.notify({ redrawFog: true });
    return clone;
  },

  deleteToken(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return;
    this.pushUndoSnapshot();
    this.state.tokens = this.state.tokens.filter((t) => t.id !== tokenId);
    if (Array.isArray(this.state.playerInvites)) {
      this.state.playerInvites.forEach((inv) => {
        if (Array.isArray(inv.tokenIds)) inv.tokenIds = inv.tokenIds.filter((id) => id !== tokenId);
      });
    }
    if (this.state.selectedTokenId === tokenId) {
      this.state.selectedTokenId = this.state.tokens[0] ? this.state.tokens[0].id : null;
    }
    this.removeTokenFromCombat?.(tokenId, { silent: true });
    this.pruneUnusedMediaAssets?.();
    this.recordEvent('ELIMINAR_FICHA', tok.name);
    this.notify({ flushVault: true });
  },

  addTokenResource(tokenId, { name = '', cur = null, max = 4, color = '#8b5cf6', kind = 'auto' } = {}) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const cleanName = String(name || '').trim();
    if (!tok || !cleanName) return null;
    if (!Array.isArray(tok.resources)) tok.resources = [];
    const maxVal = Math.max(0, Math.min(999, Math.trunc(Number(max) || 0)));
    const initCur = cur !== null && cur !== undefined
      ? Math.max(0, Math.min(maxVal > 0 ? maxVal : 999, Math.trunc(Number(cur) || 0)))
      : maxVal;
    const res = {
      id: `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      cur: initCur,
      max: maxVal,
      color: String(color || '#8b5cf6'),
      kind: kind === 'bar' || kind === 'pips' ? kind : maxVal > 0 && maxVal <= 6 ? 'pips' : 'bar'
    };
    tok.resources.push(res);
    this.notify();
    return res;
  },

  adjustTokenResource(tokenId, resId, delta) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const res = tok?.resources?.find((r) => r.id === resId);
    if (!res) return 0;
    const d = Math.trunc(Number(delta) || 0);
    const resBlk = Selector.getSystemSheetBlocks(this.state).find(
      (b) => b.kind === 'resource' && (b.id === resId || b.key === Selector.normalizeStatKey(res.name))
    );
    const effMax = resBlk ? Selector.resolveResourceMax(this.state, tok, resBlk, res) : (Number(res.max) || 0);
    const maxLim = effMax > 0 ? effMax : 999;
    res.cur = Math.max(0, Math.min(maxLim, (Number(res.cur) || 0) + d));
    this.notify();
    return res.cur;
  },

  adjustTokenResourceByKey(tokenId, keyOrId, delta) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return 0;
    const cleanKey = Selector.normalizeStatKey(keyOrId);
    if (!cleanKey || cleanKey === 'hp') {
      this.adjustTokenHp(tokenId, delta);
      return tok.hp;
    }
    if (!Array.isArray(tok.resources)) tok.resources = [];
    const blk = Selector.getSystemSheetBlocks(this.state).find(
      (b) => b.kind === 'resource' && (b.id === keyOrId || b.key === cleanKey)
    );
    let res = tok.resources.find(
      (r) => r.id === keyOrId || (blk && r.id === blk.id) || Selector.normalizeStatKey(r.name) === cleanKey
    );
    if (!res && blk) {
      const effMax = Selector.resolveResourceMax(this.state, tok, blk);
      res = {
        id: blk.id,
        name: blk.label,
        cur: effMax > 0 ? effMax : 0,
        max: effMax,
        color: blk.color || '#8b5cf6',
        kind: blk.resStyle === 'pips' || blk.resStyle === 'bar' ? blk.resStyle : effMax > 0 && effMax <= 6 ? 'pips' : 'bar'
      };
      tok.resources.push(res);
    }
    if (!res) return 0;
    return this.adjustTokenResource(tokenId, res.id, delta);
  },

  setTokenResourceValue(tokenId, resId, val) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const res = tok?.resources?.find((r) => r.id === resId);
    if (!res) return;
    const resBlk = Selector.getSystemSheetBlocks(this.state).find(
      (b) => b.kind === 'resource' && (b.id === resId || b.key === Selector.normalizeStatKey(res.name))
    );
    const effMax = resBlk ? Selector.resolveResourceMax(this.state, tok, resBlk, res) : (Number(res.max) || 0);
    const maxLim = effMax > 0 ? effMax : 999;
    res.cur = Math.max(0, Math.min(maxLim, Math.trunc(Number(val) || 0)));
    this.notify();
  },

  cycleTokenResourcePip(tokenId, resId, pipIdx, maxStates = 1, maxPips = 0) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return;
    const states = [1, 2, 3].includes(Number(maxStates)) ? Number(maxStates) : 1;
    const idx = Math.max(0, Math.trunc(Number(pipIdx) || 0));
    const blk = Selector.getSystemSheetBlocks(this.state).find(
      (b) => b.kind === 'resource' && (b.id === resId || b.key === resId)
    );
    const nextPipArray = (existing, len, prevCur) => {
      const arr = Array.from({ length: len }, (_, i) => {
        if (Array.isArray(existing) && i < existing.length) {
          return Math.max(0, Math.min(states, Number(existing[i]) || 0));
        }
        return !Array.isArray(existing) && i < prevCur ? states : 0;
      });
      arr[idx] = ((arr[idx] || 0) + 1) % (states + 1);
      return arr;
    };

    if (blk?.key === 'hp' || resId === 'blk_hp') {
      const effMax = blk ? Selector.resolveResourceMax(this.state, tok, blk) : Math.max(1, Number(tok.maxHp) || 18);
      if (states <= 1) {
        const targetVal = idx + 1;
        const curVal = Number(tok.hp) || 0;
        const nextVal = targetVal === curVal ? targetVal - 1 : targetVal;
        tok.hp = Math.max(0, Math.min(effMax || 999, nextVal));
      } else {
        const len = Math.max(idx + 1, effMax || Number(maxPips) || 1);
        tok.hpPips = nextPipArray(tok.hpPips, len, Math.max(0, Number(tok.hp) || 0));
        tok.hp = tok.hpPips.filter((v) => v > 0).length;
      }
      this.notify();
      return;
    }

    const res = tok.resources?.find((r) => r.id === resId);
    if (!res) return;
    const effMax = blk ? Selector.resolveResourceMax(this.state, tok, blk, res) : (Number(res.max) || 0);
    if (states <= 1) {
      const targetVal = idx + 1;
      const curVal = Number(res.cur) || 0;
      return this.setTokenResourceValue(tokenId, resId, targetVal === curVal ? targetVal - 1 : targetVal);
    }
    const len = Math.max(idx + 1, effMax || Number(maxPips) || 1);
    res.pips = nextPipArray(res.pips, len, Math.max(0, Number(res.cur) || 0));
    res.cur = res.pips.filter((v) => v > 0).length;
    this.notify();
  },

  setTokenResourceMax(tokenId, resId, maxVal) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const res = tok?.resources?.find((r) => r.id === resId);
    if (!res) return;
    const nextMax = Math.max(0, Math.min(999, Math.trunc(Number(maxVal) || 0)));
    res.max = nextMax;
    if (Array.isArray(res.pips) && nextMax > 0) {
      res.pips = res.pips.slice(0, nextMax);
      res.cur = res.pips.filter((v) => v > 0).length;
    } else if (nextMax > 0) {
      res.cur = Math.min(res.cur, nextMax);
    }
    this.notify();
  },

  removeTokenResource(tokenId, resId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok || !Array.isArray(tok.resources)) return;
    tok.resources = tok.resources.filter((r) => r.id !== resId);
    this.notify();
  }
};
