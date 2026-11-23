/* ==========================================================================
   COMBAT SERVICE: INICIATIVA INTERACTIVA, AGRUPACIÓN DE SECUNDARIOS Y TURNOS
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261123a7';
import { RealtimeBridge } from './realtimeBridge.js?v=20261123a7';

const createSingleCombatEntry = (t) => ({
  id: t.id,
  tokenId: t.id,
  tokenIds: [t.id],
  groupName: t.name,
  isGroup: false,
  init: 0,
  pending: true
});

const getEntryTokenIds = (entry) =>
  Array.isArray(entry?.tokenIds) && entry.tokenIds.length
    ? entry.tokenIds
    : (entry?.tokenId ? [entry.tokenId] : []);

const isEntryDefeatedEnemy = (entry, tokensById) => {
  const tokens = getEntryTokenIds(entry).map((id) => tokensById.get(id)).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => t.isAlly === false && Number(t.maxHp) > 0 && (Number(t.hp) || 0) <= 0);
};

const pickEntryFocusTokenId = (entry, tokensById) => {
  const ids = getEntryTokenIds(entry);
  const alive = ids.find((id) => {
    const t = tokensById.get(id);
    return t && !(Number(t.maxHp) > 0 && (Number(t.hp) || 0) <= 0);
  });
  return alive || entry?.tokenId || ids[0] || null;
};

export const CombatServiceMethods = {
  getSystemInitiativeFormula() {
    const cfg = this.state.systemConfig || {};
    const f = String(cfg.initiativeFormula ?? '').trim();
    if (f) return f;
    return cfg.preset === 'free' ? '1d20+@agi' : '1d20+@des';
  },

  getNpcBaseName(tok) {
    return String(tok?.name || 'Secundario').replace(/\s+\d+$/, '').trim() || 'Secundario';
  },

  getNpcGroupKey(tok) {
    return tok?.actorKey || this.getNpcBaseName(tok).toLowerCase();
  },

  sortCombatOrder(order) {
    return [...order].sort((a, b) => {
      const ap = a.pending ? 1 : 0;
      const bp = b.pending ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return (Number(b.init) || 0) - (Number(a.init) || 0);
    });
  },

  requestCombatInitiatives(pendingEntries, formula) {
    const req = {
      requestId: `init-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      senderId: this.clientId,
      isInitiative: true,
      label: 'Iniciativa',
      statKey: '',
      formula,
      dc: 0,
      targets: pendingEntries.map((e) => ({ id: e.tokenId, tokenIds: e.tokenIds, name: e.groupName }))
    };
    RealtimeBridge.send({ kind: 'ROLL_REQUEST', request: req });

    const assignedIds = new Set(
      Selector.getPlayerInvites(this.state).flatMap((inv) => (Array.isArray(inv.tokenIds) ? inv.tokenIds : []))
    );
    const localQueue = (this.state.pendingRollRequests || []).filter((q) => !q.isInitiative);
    pendingEntries.forEach((e) => {
      const tok = (this.state.tokens || []).find((t) => t.id === e.tokenId);
      const mine = this.state.role === 'gm'
        ? !assignedIds.has(e.tokenId)
        : Boolean(tok && this.canControlToken(tok));
      if (!mine) return;
      localQueue.push({
        requestId: req.requestId,
        isInitiative: true,
        tokenId: e.tokenId,
        tokenName: e.groupName,
        label: req.label,
        formula,
        dc: 0
      });
    });
    this.state.pendingRollRequests = localQueue;
  },

  rollTokenInitiative(tok) {
    if (!tok) return null;
    const formula = this.getSystemInitiativeFormula();
    const roll = this.rollFormula(formula, tok, `${tok.name} · Iniciativa`);
    if (roll && this.state.combat?.active) {
      const displayLabel = roll.isDeckRoll ? roll.headline : '';
      const total = Number(roll.total) || 0;
      this.setTokenInitiative(tok.id, total, displayLabel, { skipBroadcast: this.state.role === 'player' });
      if (this.state.role === 'player') {
        RealtimeBridge.send({
          kind: 'ROLL_RESPONSE',
          response: { requestId: `manual-${Date.now()}`, isInitiative: true, tokenId: tok.id, tokenName: tok.name, total, displayLabel }
        });
      }
    }
    return roll;
  },

  startCombat() {
    const visibleTokens = (this.state.tokens || []).filter((t) => !t.hidden || this.state.role === 'gm');
    const tokensById = new Map(visibleTokens.map((t) => [t.id, t]));
    const cfg = this.state.systemConfig || {};
    const initGrouping = cfg.initGrouping === 'individual' ? 'individual' : 'group';
    const initNpcMode = cfg.initNpcMode === 'manual' ? 'manual' : 'fast';
    const formula = this.getSystemInitiativeFormula();

    const protagonists = visibleTokens.filter((t) => t.isAlly !== false);
    const secondaries = visibleTokens.filter((t) => t.isAlly === false);
    const order = protagonists.map(createSingleCombatEntry);

    if (initGrouping === 'group') {
      const groups = new Map();
      secondaries.forEach((t) => {
        const key = this.getNpcGroupKey(t);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      });
      groups.forEach((members, key) => {
        const first = members[0];
        const baseName = this.getNpcBaseName(first);
        order.push({
          id: `grp-${key}`,
          tokenId: first.id,
          tokenIds: members.map((m) => m.id),
          groupName: members.length > 1 ? `${baseName} ×${members.length}` : first.name,
          isGroup: members.length > 1,
          init: 0,
          pending: true
        });
      });
    } else {
      secondaries.forEach((t) => order.push(createSingleCombatEntry(t)));
    }

    if (initNpcMode === 'fast') {
      order.forEach((entry) => {
        const rep = tokensById.get(entry.tokenId);
        if (!rep || rep.isAlly !== false) return;
        const res = typeof this.rollFormula === 'function'
          ? this.rollFormula(formula, rep, `${entry.groupName} · Iniciativa`, '', { silent: true })
          : { total: Math.floor(Math.random() * 20) + 1 + (Number(rep.stats?.dex) || 0), isDeckRoll: false, headline: '' };
        entry.init = Number(res?.total) || 0;
        entry.pending = false;
        if (res?.isDeckRoll && res.headline) entry.label = res.headline;
      });
    }

    const sortedOrder = this.sortCombatOrder(order);
    this.state.combat = {
      active: true,
      round: 1,
      turnIndex: 0,
      order: sortedOrder
    };
    if (sortedOrder[0] && !sortedOrder[0].pending && this.state.role === 'gm') {
      this.state.selectedTokenId = sortedOrder[0].tokenId;
    }

    this.state.pendingRollRequests = (this.state.pendingRollRequests || []).filter((q) => !q.isInitiative);
    const pendingEntries = sortedOrder.filter((e) => e.pending);
    if (pendingEntries.length > 0) {
      this.requestCombatInitiatives(pendingEntries, formula);
    }

    this.recordEvent('COMBATE', 'Combate iniciado');
    this.notify();
  },

  sortCombatOrderPreservingTurn(c) {
    if (!c || !Array.isArray(c.order)) return;
    const activeEntry = c.turnIndex >= 0 && c.turnIndex < c.order.length ? c.order[c.turnIndex] : null;
    const activeId = activeEntry ? activeEntry.id : null;
    c.order = this.sortCombatOrder(c.order);
    if (activeId !== null) {
      const nextIdx = c.order.findIndex((e) => e.id === activeId);
      c.turnIndex = nextIdx >= 0 ? nextIdx : Math.min(Math.max(0, c.turnIndex), Math.max(0, c.order.length - 1));
    } else if (c.order.length === 0) {
      c.turnIndex = 0;
    } else if (c.turnIndex >= c.order.length) {
      c.turnIndex = c.order.length - 1;
    }
  },

  stepCombatTurn(delta) {
    if (this.state.role !== 'gm') return;
    const c = this.state.combat;
    if (!c || !c.active || !c.order.length) return;
    const len = c.order.length;
    const step = delta < 0 ? -1 : 1;
    const tokensById = new Map((this.state.tokens || []).map((t) => [t.id, t]));
    const startIdx = c.turnIndex >= 0 && c.turnIndex < len ? c.turnIndex : (step > 0 ? -1 : 0);

    let idx = startIdx;
    let round = Math.max(1, Math.trunc(Number(c.round) || 1));
    let found = false;

    for (let tried = 0; tried < len; tried++) {
      idx += step;
      if (idx >= len) {
        idx = 0;
        round += 1;
      } else if (idx < 0) {
        idx = len - 1;
        round = Math.max(1, round - 1);
      }
      if (!isEntryDefeatedEnemy(c.order[idx], tokensById)) {
        found = true;
        break;
      }
    }

    if (!found) {
      idx = startIdx + step;
      round = Math.max(1, Math.trunc(Number(c.round) || 1));
      if (idx >= len) {
        idx = 0;
        round += 1;
      } else if (idx < 0) {
        idx = len - 1;
        round = Math.max(1, round - 1);
      }
    }

    c.turnIndex = idx;
    c.round = round;
    const activeEntry = c.order[idx];
    const focusId = pickEntryFocusTokenId(activeEntry, tokensById);
    if (focusId) this.state.selectedTokenId = focusId;
    this.syncWorldToPeers();
    this.notify();
  },

  nextCombatTurn() {
    this.stepCombatTurn(1);
  },

  prevCombatTurn() {
    this.stepCombatTurn(-1);
  },

  setCombatTurn(entryId) {
    if (this.state.role !== 'gm') return;
    const c = this.state.combat;
    if (!c || !c.active || !Array.isArray(c.order) || !c.order.length) return;
    const idx = c.order.findIndex((o) => o.id === entryId || o.tokenId === entryId);
    if (idx < 0) return;
    c.turnIndex = idx;
    const tokensById = new Map((this.state.tokens || []).map((t) => [t.id, t]));
    const focusId = pickEntryFocusTokenId(c.order[idx], tokensById);
    if (focusId) this.state.selectedTokenId = focusId;
    this.syncWorldToPeers();
    this.notify();
  },

  updateEntryInitiative(entryId, initVal, displayLabel = '') {
    if (this.state.role !== 'gm') return;
    const c = this.state.combat;
    if (!c || !c.active || !Array.isArray(c.order)) return;
    const entry = c.order.find((o) => o.id === entryId || o.tokenId === entryId);
    if (!entry) return;
    entry.init = Number(initVal) || 0;
    entry.pending = false;
    if (displayLabel) entry.label = displayLabel;
    else delete entry.label;
    this.sortCombatOrderPreservingTurn(c);
    if (Array.isArray(this.state.pendingRollRequests)) {
      this.state.pendingRollRequests = this.state.pendingRollRequests.filter(
        (q) => !(q.isInitiative && q.tokenId === entry.tokenId)
      );
    }
    this.syncWorldToPeers();
    this.notify();
  },

  reorderCombatEntry(entryId, dir) {
    if (this.state.role !== 'gm') return;
    const c = this.state.combat;
    if (!c || !c.active || !Array.isArray(c.order) || c.order.length < 2) return;
    const idx = c.order.findIndex((o) => o.id === entryId || o.tokenId === entryId);
    const step = dir < 0 ? -1 : 1;
    const targetIdx = idx + step;
    if (idx < 0 || targetIdx < 0 || targetIdx >= c.order.length) return;
    const activeId = c.order[c.turnIndex]?.id ?? null;
    const [moved] = c.order.splice(idx, 1);
    c.order.splice(targetIdx, 0, moved);
    if (activeId !== null) {
      const nextIdx = c.order.findIndex((o) => o.id === activeId);
      if (nextIdx >= 0) c.turnIndex = nextIdx;
    }
    this.syncWorldToPeers();
    this.notify();
  },

  addTokenToCombat(tokenId, opts = {}) {
    if (this.state.role !== 'gm') return null;
    const c = this.state.combat;
    if (!c || !c.active) return null;
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
    if (!tok) return null;
    const already = c.order.find((o) => o.tokenId === tokenId || getEntryTokenIds(o).includes(tokenId));
    if (already) return already;

    const entry = createSingleCombatEntry(tok);
    if (opts.init !== undefined && opts.init !== null && opts.init !== '') {
      entry.init = Number(opts.init) || 0;
      entry.pending = false;
    } else if (opts.roll) {
      const formula = this.getSystemInitiativeFormula();
      const res = typeof this.rollFormula === 'function'
        ? this.rollFormula(formula, tok, `${tok.name} · Iniciativa`, '', { silent: Boolean(opts.silent) })
        : { total: Math.floor(Math.random() * 20) + 1 + (Number(tok.stats?.dex) || 0), isDeckRoll: false, headline: '' };
      entry.init = Number(res?.total) || 0;
      entry.pending = false;
      if (res?.isDeckRoll && res.headline) entry.label = res.headline;
    }
    c.order.push(entry);
    this.sortCombatOrderPreservingTurn(c);
    this.syncWorldToPeers();
    this.notify();
    return entry;
  },

  removeCombatEntry(entryId, opts = {}) {
    if (this.state.role !== 'gm' && !opts.silent) return;
    const c = this.state.combat;
    if (!c || !c.active || !Array.isArray(c.order)) return;
    const idx = c.order.findIndex((o) => o.id === entryId || o.tokenId === entryId);
    if (idx < 0) return;
    const [removed] = c.order.splice(idx, 1);
    const removedIds = new Set(getEntryTokenIds(removed));
    if (Array.isArray(this.state.pendingRollRequests)) {
      this.state.pendingRollRequests = this.state.pendingRollRequests.filter(
        (q) => !(q.isInitiative && removedIds.has(q.tokenId))
      );
    }
    if (c.order.length === 0) {
      c.turnIndex = 0;
    } else if (idx < c.turnIndex) {
      c.turnIndex -= 1;
    } else if (c.turnIndex >= c.order.length) {
      c.turnIndex = 0;
    }
    if (!opts.silent) {
      this.syncWorldToPeers();
      this.notify();
    }
  },

  removeTokenFromCombat(tokenId, opts = {}) {
    const c = this.state.combat;
    if (!c || !c.active || !Array.isArray(c.order)) return;
    const idx = c.order.findIndex((o) => o.tokenId === tokenId || getEntryTokenIds(o).includes(tokenId));
    if (idx < 0) return;
    const entry = c.order[idx];
    const remainingIds = getEntryTokenIds(entry).filter((id) => id !== tokenId);
    if (remainingIds.length === 0) {
      this.removeCombatEntry(entry.id, opts);
      return;
    }
    const tokensById = new Map((this.state.tokens || []).map((t) => [t.id, t]));
    entry.tokenIds = remainingIds;
    entry.tokenId = remainingIds[0];
    const firstTok = tokensById.get(remainingIds[0]);
    if (remainingIds.length === 1) {
      entry.isGroup = false;
      if (firstTok?.name) entry.groupName = firstTok.name;
    } else {
      entry.isGroup = true;
      const baseName = firstTok ? this.getNpcBaseName(firstTok) : String(entry.groupName || '').replace(/\s+×\d+$/, '').trim();
      entry.groupName = `${baseName || 'Secundario'} ×${remainingIds.length}`;
    }
    if (!opts.silent) {
      this.syncWorldToPeers();
      this.notify();
    }
  },

  setTokenInitiative(tokenId, initVal, displayLabel = '', opts = {}) {
    const c = this.state.combat;
    if (!c || !c.active) return;
    const init = Number(initVal) || 0;
    const existing = c.order.find(
      (o) => o.tokenId === tokenId || (Array.isArray(o.tokenIds) && o.tokenIds.includes(tokenId))
    );
    if (existing) {
      existing.init = init;
      existing.pending = false;
      if (displayLabel) existing.label = displayLabel;
      else delete existing.label;
    } else {
      const tok = (this.state.tokens || []).find((t) => t.id === tokenId);
      const entry = {
        ...createSingleCombatEntry(tok || { id: tokenId, name: '' }),
        init,
        pending: false
      };
      if (displayLabel) entry.label = displayLabel;
      c.order.push(entry);
    }
    this.sortCombatOrderPreservingTurn(c);
    const resolvedId = existing ? existing.tokenId : tokenId;
    if (Array.isArray(this.state.pendingRollRequests)) {
      this.state.pendingRollRequests = this.state.pendingRollRequests.filter(
        (q) => !(q.isInitiative && q.tokenId === resolvedId)
      );
    }
    if (!opts.skipBroadcast && this.state.role === 'gm') {
      this.syncWorldToPeers();
    }
    this.notify(opts.skipBroadcast ? { skipVaultSave: true } : undefined);
  },

  endCombat() {
    this.state.combat = { active: false, round: 1, turnIndex: 0, order: [] };
    if (Array.isArray(this.state.pendingRollRequests)) {
      this.state.pendingRollRequests = this.state.pendingRollRequests.filter((q) => !q.isInitiative);
    }
    this.recordEvent('COMBATE', 'Combate finalizado');
    this.notify();
  }
};
