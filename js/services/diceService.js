import { Dice3DEngine } from './dice3dEngine.js?v=20261123a7';
import { DiceFormulaServiceMethods } from './diceFormulaService.js?v=20261123a7';
import { RealtimeBridge } from './realtimeBridge.js?v=20261123a7';
import { DEFAULT_DICE_STYLE } from '../core/model.js?v=20261123a7';

/**
 * Dice hand, style, rolling & private/public visibility methods mixed into Service.
 */
export const DiceServiceMethods = {
  ...DiceFormulaServiceMethods,

  loadDiceStyle() {
    try {
      const raw = localStorage.getItem('portal_dice_style');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.state.dice.style = { ...DEFAULT_DICE_STYLE, ...parsed };
      }
    } catch (_) {}
  },

  updateDiceStyle(patch) {
    if (!patch || typeof patch !== 'object') return;
    this.state.dice.style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style, ...patch };
    try {
      localStorage.setItem('portal_dice_style', JSON.stringify(this.state.dice.style));
    } catch (_) {}
    Dice3DEngine.clearTextureCache();
    this.notify({ skipVaultSave: true });
  },

  resetDiceStyle() {
    this.state.dice.style = { ...DEFAULT_DICE_STYLE };
    try {
      localStorage.removeItem('portal_dice_style');
    } catch (_) {}
    Dice3DEngine.clearTextureCache();
    this.notify({ skipVaultSave: true });
  },

  rollSingleHandDie(rawSides, style = DEFAULT_DICE_STYLE) {
    if (rawSides === 'fudge') {
      return { kind: 'fudge', sides: 3, chosen: Math.floor(Math.random() * 3) - 1, colorHex: style.bodyColor };
    }
    if (rawSides === 'card') {
      const drawn = this.drawCardFromDeck();
      return {
        kind: 'card',
        sides: 54,
        chosen: drawn.card.rank,
        card: drawn.card,
        deckAutoShuffled: drawn.autoShuffled,
        colorHex: style.bodyColor
      };
    }
    if (Number(rawSides) === 2) {
      return { kind: 'coin', sides: 2, chosen: Math.floor(Math.random() * 2), colorHex: style.bodyColor };
    }
    const sides = Math.min(100, Math.max(2, Number(rawSides) || 20));
    return { sides, chosen: Math.floor(Math.random() * sides) + 1, colorHex: style.bodyColor };
  },

  getHandPhysicalCount(hand) {
    if (!Array.isArray(hand)) return 0;
    return hand.reduce((sum, s) => sum + (Number(s) === 100 ? 2 : 1), 0);
  },

  addDieToHand(sides = 20) {
    if (!Array.isArray(this.state.dice.hand)) this.state.dice.hand = [];
    const cost = Number(sides) === 100 ? 2 : 1;
    if (this.getHandPhysicalCount(this.state.dice.hand) + cost > 20) return false;
    this.state.dice.hand.push(sides);
    Dice3DEngine.playPickup(this.state.dice.hand.length);
    this.notify();
    return true;
  },

  removeDieFromHand(sides) {
    if (!Array.isArray(this.state.dice.hand) || this.state.dice.hand.length === 0) return false;
    const idx = this.state.dice.hand.lastIndexOf(sides);
    if (idx === -1) return false;
    this.state.dice.hand.splice(idx, 1);
    this.notify();
    return true;
  },

  clearDiceHand() {
    if (!Array.isArray(this.state.dice.hand) || this.state.dice.hand.length === 0) return false;
    this.state.dice.hand = [];
    this.notify();
    return true;
  },

  setDiceResultMode(mode) {
    const valid = ['sum', 'each', 'max', 'min', 'success'];
    if (!valid.includes(mode)) return;
    this.state.dice.resultMode = mode;
    const last = this.state.dice.lastRoll;
    if (last) {
      last.resultMode = mode;
      const thr = last.successThreshold || this.state.dice.successThreshold || 6;
      const diceList = Array.isArray(last.dice) && last.dice.length > 0
        ? last.dice
        : [{ sides: last.sides, chosen: last.chosen }];
      const summary = this.computeRollSummary(diceList, last.mod, mode, thr);
      last.total = summary.total;
      last.headline = summary.headline;
      last.isCrit = summary.isCrit;
      last.isFumble = summary.isFumble;
      const seq = this.state.activeSequence;
      if (seq && seq.mode === 'roll' && seq.currentIndex >= 0 && seq.stepResults?.[seq.currentIndex]) {
        seq.stepResults[seq.currentIndex].total = Math.max(0, Number(summary.total) || 0);
        if (seq.selectedDamageStep === seq.currentIndex) {
          seq.lastDamageTotal = Math.max(0, Number(summary.total) || 0);
        }
      }
    }
    this.notify();
  },

  setDiceSuccessThreshold(val) {
    const thr = Math.max(1, Math.min(100, Math.round(Number(val) || 6)));
    this.state.dice.successThreshold = thr;
    const last = this.state.dice.lastRoll;
    if (last) {
      last.successThreshold = thr;
      if ((last.resultMode || this.state.dice.resultMode) === 'success') {
        const diceList = Array.isArray(last.dice) && last.dice.length > 0
          ? last.dice
          : [{ sides: last.sides, chosen: last.chosen }];
        const summary = this.computeRollSummary(diceList, last.mod, 'success', thr);
        last.total = summary.total;
        last.headline = summary.headline;
      }
    }
    this.notify();
  },

  throwDiceHand(targetX = null, targetY = null) {
    const hand = Array.isArray(this.state.dice.hand) ? this.state.dice.hand : [];
    if (hand.length === 0) return null;
    this.state.activeSequence = null;
    this.state.activeRollRequest = null;

    const resultMode = this.state.dice.resultMode || 'sum';
    const mod = this.state.dice.modifier;
    const style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style };

    const results = hand.map((sides) => this.rollSingleHandDie(sides, style));
    const isDeckRoll = results.some((r) => r.kind === 'card');

    const summary = this.computeRollSummary(results, mod, resultMode);
    const label = this.formatHandFormula(hand);

    const roll = this.recordRoll({
      sides: results[0].sides,
      chosen: results.reduce((acc, r) => acc + r.chosen, 0),
      mod,
      total: summary.total,
      resultMode,
      isCrit: summary.isCrit,
      isFumble: summary.isFumble,
      label,
      message: isDeckRoll && results.some((r) => r.deckAutoShuffled) ? 'Baraja vacía: mezclada automáticamente' : '',
      dice: results,
      headline: summary.headline,
      isDeckRoll,
      deckRemaining: isDeckRoll ? (this.state.deck?.cards?.length ?? 54) : undefined
    });
    this.state.dice.hand = [];

    const can3D = typeof Dice3DEngine.canRoll3D === 'function' && Dice3DEngine.canRoll3D();
    if (can3D) {
      this.markRollFlying(roll.rollId);
      Dice3DEngine.prepareFlight();
    }
    this.broadcastRoll(roll);
    this.recordEvent('TIRADA_DADO', `${label}: ${summary.headline}`, { broadcast: roll.visibility !== 'private' });
    this.notify();
    if (can3D) {
      this.playSeatDiceFlight(
        roll,
        results.map((r) => ({ kind: r.kind, sides: r.sides, colorHex: r.colorHex, value: r.chosen, card: r.card })),
        { targetX, targetY, style }
      );
    }
    return roll;
  },

  setDiceVisibility(mode) {
    if (!this.state.dice) return;
    this.state.dice.visibility = mode === 'private' ? 'private' : 'public';
    this.notify();
  },

  resolveSeatKeyForRoll(roll) {
    if (!roll) return '';
    if (roll.rollerSeatKey) return roll.rollerSeatKey;
    if (roll.rollerRole === 'gm') return 'gm';
    if (roll.rollerInviteId) return roll.rollerInviteId;
    return roll.rollerClientId ? `peer:${roll.rollerClientId}` : 'gm';
  },

  getSeatOriginX(seatKey) {
    if (typeof document === 'undefined' || !seatKey) return null;
    const seatEl = document.querySelector(`[data-seat-key="${CSS.escape(seatKey)}"]`);
    if (!seatEl) return null;
    const rect = seatEl.getBoundingClientRect();
    return rect.width > 0 ? rect.left + rect.width / 2 : null;
  },

  playSeatDiceFlight(roll, diceItems, opts = {}) {
    if (typeof Dice3DEngine.canRoll3D !== 'function' || !Dice3DEngine.canRoll3D()) return;
    if (!Array.isArray(diceItems) || diceItems.length === 0) return;
    const isRemote = Boolean(roll?.remote);
    const seatKey = this.resolveSeatKeyForRoll(roll);
    const originX = isRemote ? this.getSeatOriginX(seatKey) : null;
    if (roll?.rollId) this.markRollFlying(roll.rollId);
    Dice3DEngine.rollHand(diceItems, {
      ...opts,
      mode: isRemote ? 'remote' : 'local',
      originX,
      onComplete: () => {
        this.clearRollFlying(roll?.rollId);
        this.notify({ skipVaultSave: true });
      }
    });
  },

  dismissSeatRoll(seatKey, rollId = '', { broadcast = true } = {}) {
    if (!(this.seatRolls instanceof Map) || !seatKey) return;
    const cur = this.seatRolls.get(seatKey);
    if (!cur) return;
    if (rollId && cur.rollId && cur.rollId !== rollId) return;
    this.clearSeatRollAutoHide?.(seatKey);
    this.seatRolls.delete(seatKey);
    if (this.expandedSeatRollKey === seatKey) {
      this.expandedSeatRollKey = '';
    }
    if (broadcast) {
      RealtimeBridge.send({
        kind: 'ROLL_DISMISS',
        seatKey,
        rollId: cur.rollId || rollId,
        senderClientId: this.clientId
      });
    }
    this.notify({ skipVaultSave: true });
  },

  hasSeenRollId(rollId) {
    if (!rollId) return false;
    if (this._seenRollIds instanceof Set && this._seenRollIds.has(rollId)) return true;
    const history = this.state?.dice?.history;
    return Array.isArray(history) && history.some((h) => h && h.rollId === rollId);
  },

  markSeenRollId(rollId) {
    if (!rollId) return;
    if (!(this._seenRollIds instanceof Set)) this._seenRollIds = new Set();
    this._seenRollIds.add(rollId);
    if (this._seenRollIds.size > 150) {
      const oldest = this._seenRollIds.values().next().value;
      if (oldest) this._seenRollIds.delete(oldest);
    }
  },

  recordRoll(roll) {
    if (!this.state.dice) return roll;
    const visibility = roll.visibility || this.state.dice.visibility || 'public';
    const rollerRole = roll.rollerRole || this.state.role || 'gm';
    const rollerClientId = roll.rollerClientId || this.clientId;
    const rollerInviteId = roll.rollerInviteId !== undefined ? roll.rollerInviteId : (this.state.activeInviteId || '');
    const rollerSeatKey = roll.rollerSeatKey || this.getSelfSeatKey();
    const rollerName = roll.rollerName || this.getActiveSpeakerInfo().name;
    const rollId = roll.rollId || `roll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.markSeenRollId(rollId);
    const time = roll.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diceStyle = roll.diceStyle && typeof roll.diceStyle === 'object'
      ? { ...DEFAULT_DICE_STYLE, ...roll.diceStyle }
      : { ...DEFAULT_DICE_STYLE, ...(this.state.dice?.style || {}) };
    const stored = {
      ...roll,
      rollId,
      visibility,
      rollerRole,
      rollerClientId,
      rollerInviteId,
      rollerSeatKey,
      rollerName,
      diceStyle,
      time
    };
    this.state.dice.lastRoll = stored;
    const history = Array.isArray(this.state.dice.history) ? this.state.dice.history : [];
    this.state.dice.history = [stored, ...history].slice(0, 25);
    if (!(this.seatRolls instanceof Map)) this.seatRolls = new Map();
    stored.autoHidden = false;
    this.seatRolls.set(rollerSeatKey, stored);
    this.scheduleSeatRollAutoHide?.(rollerSeatKey, rollId);
    if (this.expandedSeatRollKey === rollerSeatKey) this.expandedSeatRollKey = '';
    return stored;
  },

  broadcastRoll(roll) {
    if (!roll) return;
    // GM private rolls stay strictly local; player private rolls go to GM only (filtered on receive).
    if (roll.visibility === 'private' && roll.rollerRole === 'gm') return;
    RealtimeBridge.send({ kind: 'DICE_ROLL', roll });
  },

  receiveRemoteRoll(roll) {
    if (!roll || !this.state.dice) return;
    if (roll.rollerClientId && roll.rollerClientId === this.clientId) return;
    if (roll.rollId && this.hasSeenRollId(roll.rollId)) return;
    if (roll.rollId) this.markSeenRollId(roll.rollId);
    if (roll.visibility === 'private' && this.state.role !== 'gm') return;
    const seatKey = this.resolveSeatKeyForRoll(roll);
    const entry = { ...roll, rollerSeatKey: seatKey, remote: true, autoHidden: false };
    const history = Array.isArray(this.state.dice.history) ? this.state.dice.history : [];
    this.state.dice.history = [entry, ...history].slice(0, 25);
    if (!(this.seatRolls instanceof Map)) this.seatRolls = new Map();
    this.seatRolls.set(seatKey, entry);
    this.scheduleSeatRollAutoHide?.(seatKey, entry.rollId);
    if (this.expandedSeatRollKey === seatKey) this.expandedSeatRollKey = '';

    const diceList = Array.isArray(entry.dice) ? entry.dice : [];
    const can3D = diceList.length > 0 && typeof Dice3DEngine.canRoll3D === 'function' && Dice3DEngine.canRoll3D();
    if (can3D) {
      this.markRollFlying(entry.rollId);
      Dice3DEngine.prepareFlight();
    }
    this.notify({ skipVaultSave: true });
    if (can3D) {
      const remoteStyle = entry.diceStyle && typeof entry.diceStyle === 'object'
        ? { ...DEFAULT_DICE_STYLE, ...entry.diceStyle }
        : {
            ...DEFAULT_DICE_STYLE,
            bodyColor: diceList[0]?.colorHex || DEFAULT_DICE_STYLE.bodyColor
          };
      this.playSeatDiceFlight(
        entry,
        diceList.map((d) => ({ kind: d.kind, sides: d.sides, colorHex: d.colorHex, value: d.chosen, card: d.card })),
        { style: remoteStyle }
      );
    }
  },

  clearDiceHistory() {
    if (!this.state.dice) return;
    this.state.dice.history = [];
    this.notify();
  },

  rollDice(sides = 20, label = '', message = '', extraMod = 0) {
    this.state.activeSequence = null;
    this.state.activeRollRequest = null;
    const chosen = Math.floor(Math.random() * sides) + 1;
    const resultMode = this.state.dice.resultMode || 'sum';
    const effThr = Number(this.state.dice.successThreshold) || 6;
    const mod = (Number(this.state.dice.modifier) || 0) + (Number(extraMod) || 0);
    const style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style };
    const results = [{ sides, chosen, colorHex: style.bodyColor }];
    const extra = this.consumeHandExtraDice(Number(sides) === 100 ? 2 : 1, style);
    results.push(...extra.results);
    const summary = this.computeRollSummary(results, mod, resultMode, effThr);
    const extraLabel = extra.usedSides.length > 0 ? ` + ${this.formatHandFormula(extra.usedSides)}` : '';
    const fullLabel = label ? `${label}${extraLabel}` : (extra.usedSides.length > 0 ? `1d${sides}${extraLabel}` : '');

    const roll = this.recordRoll({
      sides,
      chosen,
      mod,
      total: summary.total,
      resultMode,
      successThreshold: effThr,
      isCrit: summary.isCrit,
      isFumble: summary.isFumble,
      label: fullLabel,
      message: String(message || '').trim(),
      dice: results,
      headline: summary.headline
    });

    const can3D = typeof Dice3DEngine.canRoll3D === 'function' && Dice3DEngine.canRoll3D();
    if (can3D) {
      this.markRollFlying(roll.rollId);
      Dice3DEngine.prepareFlight();
    }
    this.broadcastRoll(roll);
    this.recordEvent('TIRADA_DADO', `${fullLabel || '1d' + sides}: ${summary.headline} (nat ${chosen})`, {
      broadcast: roll.visibility !== 'private'
    });
    this.notify();
    if (can3D) {
      this.playSeatDiceFlight(
        roll,
        results.map((r) => ({ sides: r.sides, colorHex: r.colorHex, value: r.chosen })),
        { style }
      );
    }
    return roll;
  },

  rollCoin() {
    this.state.activeSequence = null;
    this.state.activeRollRequest = null;
    const val = Math.floor(Math.random() * 2);
    const isHeads = val === 1;
    const face = isHeads ? '★ Cara' : '✕ Cruz';
    const style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style };
    const roll = this.recordRoll({
      sides: 2,
      chosen: val,
      mod: 0,
      total: val,
      resultMode: 'sum',
      label: '1 Moneda (d2)',
      headline: `${face} · ${val}`,
      dice: [{ kind: 'coin', sides: 2, chosen: val, colorHex: style.bodyColor }]
    });
    const can3D = typeof Dice3DEngine.canRoll3D === 'function' && Dice3DEngine.canRoll3D();
    if (can3D) {
      this.markRollFlying(roll.rollId);
      Dice3DEngine.prepareFlight();
    }
    this.broadcastRoll(roll);
    this.recordEvent('TIRADA_DADO', `🪙 Moneda: ${val} · ${face}`, { broadcast: roll.visibility !== 'private' });
    this.notify();
    if (can3D) {
      this.playSeatDiceFlight(
        roll,
        [{ kind: 'coin', sides: 2, colorHex: style.bodyColor || '#f59e0b', value: val }],
        { style }
      );
    }
    return roll;
  },

  rollFudge(count = 4) {
    this.state.activeSequence = null;
    this.state.activeRollRequest = null;
    const n = Math.min(12, Math.max(1, Math.trunc(Number(count) || 4)));
    const mod = Number(this.state.dice?.modifier) || 0;
    const style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style };
    const faces = [];
    const rawVals = [];
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      const v = Math.floor(Math.random() * 3) - 1;
      sum += v;
      rawVals.push(v);
      faces.push(v === 1 ? '+' : v === -1 ? '−' : '◯');
    }
    const total = sum + mod;
    const headline = total > 0 ? `+${total}` : String(total);
    const modTxt = mod !== 0 ? ` ${mod > 0 ? '+' : ''}${mod}` : '';
    const label = `${n}dF [${faces.join(' ')}]${modTxt}`;
    const roll = this.recordRoll({
      sides: 3,
      chosen: sum,
      mod,
      total,
      resultMode: 'sum',
      label,
      headline,
      dice: []
    });
    const can3D = typeof Dice3DEngine.canRoll3D === 'function' && Dice3DEngine.canRoll3D();
    if (can3D) Dice3DEngine.prepareFlight();
    this.broadcastRoll(roll);
    this.recordEvent('TIRADA_DADO', `🎲 ${label} → ${headline}`, { broadcast: roll.visibility !== 'private' });
    this.notify();
    if (can3D) {
      Dice3DEngine.rollHand(
        rawVals.map((v) => ({ kind: 'fudge', sides: 3, colorHex: style.bodyColor, value: v })),
        { style }
      );
    }
    return roll;
  }
};
