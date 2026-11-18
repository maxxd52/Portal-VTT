/* ==========================================================================
   COMBAT SERVICE: INICIATIVA INTERACTIVA, AGRUPACIÓN DE SECUNDARIOS Y TURNOS
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261117b1';
import { RealtimeBridge } from './realtimeBridge.js?v=20261117b1';

const createSingleCombatEntry = (t) => ({
  id: t.id,
  tokenId: t.id,
  tokenIds: [t.id],
  groupName: t.name,
  isGroup: false,
  init: 0,
  pending: true
});

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
    c.order = this.sortCombatOrder(c.order);
    const resolvedId = existing ? existing.tokenId : tokenId;
    if (Array.isArray(this.state.pendingRollRequests)) {
      this.state.pendingRollRequests = this.state.pendingRollRequests.filter(
        (q) => !(q.isInitiative && q.tokenId === resolvedId)
      );
    }
    if (!opts.skipBroadcast && this.state.role === 'gm') {
      RealtimeBridge.send({ kind: 'WORLD_SYNC', world: Selector.extractSerializableWorld(this.state) });
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
