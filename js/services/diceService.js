import { Dice3DEngine } from './dice3dEngine.js?v=20261113b';
import { RealtimeBridge } from './realtimeBridge.js';
import { DEFAULT_DICE_STYLE } from '../core/model.js';

/**
 * Dice hand, style, formula evaluation, rolling & private/public visibility methods mixed into Service.
 */
export const DiceServiceMethods = {
  loadDiceStyle() {
    try {
      const raw = localStorage.getItem('owltable_dice_style');
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
      localStorage.setItem('owltable_dice_style', JSON.stringify(this.state.dice.style));
    } catch (_) {}
    Dice3DEngine.clearTextureCache();
    this.notify({ skipVaultSave: true });
  },

  resetDiceStyle() {
    this.state.dice.style = { ...DEFAULT_DICE_STYLE };
    try {
      localStorage.removeItem('owltable_dice_style');
    } catch (_) {}
    Dice3DEngine.clearTextureCache();
    this.notify({ skipVaultSave: true });
  },

  formatHandFormula(hand) {
    const counts = new Map();
    for (const s of hand) counts.set(s, (counts.get(s) || 0) + 1);
    return Array.from(counts.entries())
      .map(([sides, qty]) => `${qty}d${sides}`)
      .join(' + ');
  },

  addDieToHand(sides = 20) {
    if (!Array.isArray(this.state.dice.hand)) this.state.dice.hand = [];
    if (this.state.dice.hand.length >= 20) return false;
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
    const valid = ['sum', 'each', 'max', 'min'];
    if (!valid.includes(mode)) return;
    this.state.dice.resultMode = mode;
    this.notify();
  },

  computeRollSummary(diceList, mod = 0, resultMode = 'sum') {
    const list = Array.isArray(diceList) && diceList.length > 0 ? diceList : [];
    if (list.length === 0) {
      return { headline: '0', detail: '', total: 0, isCrit: false, isFumble: false };
    }
    const single = list.length === 1 ? list[0] : null;

    if (resultMode === 'each') {
      const perDie = list.map((d) => d.chosen + mod);
      const headline = perDie.join(' · ');
      const detail = mod !== 0
        ? `Base: ${list.map((d) => d.chosen).join(', ')}`
        : single
          ? `Natural: ${single.chosen}`
          : `${list.length} dados individuales`;
      return {
        headline,
        detail,
        total: perDie[0],
        isCrit: single ? single.chosen === single.sides : false,
        isFumble: single ? single.chosen === 1 : false
      };
    }

    if (resultMode === 'max') {
      const best = list.reduce((a, b) => (b.chosen >= a.chosen ? b : a), list[0]);
      const total = best.chosen + mod;
      return {
        headline: String(total),
        detail: list.length > 1
          ? `Mayor de ${list.map((d) => d.chosen).join(', ')} → ${best.chosen}`
          : `Natural: ${best.chosen}`,
        total,
        isCrit: best.chosen === best.sides,
        isFumble: best.chosen === 1
      };
    }

    if (resultMode === 'min') {
      const worst = list.reduce((a, b) => (b.chosen <= a.chosen ? b : a), list[0]);
      const total = worst.chosen + mod;
      return {
        headline: String(total),
        detail: list.length > 1
          ? `Menor de ${list.map((d) => d.chosen).join(', ')} → ${worst.chosen}`
          : `Natural: ${worst.chosen}`,
        total,
        isCrit: worst.chosen === worst.sides,
        isFumble: worst.chosen === 1
      };
    }

    // 'sum' (default)
    const sum = list.reduce((acc, r) => acc + r.chosen, 0);
    const total = sum + mod;
    return {
      headline: String(total),
      detail: list.length > 1
        ? `Dados: ${list.map((d) => d.chosen).join(' + ')}`
        : `Natural: ${list[0].chosen}`,
      total,
      isCrit: single ? single.chosen === single.sides : false,
      isFumble: single ? single.chosen === 1 : false
    };
  },

  throwDiceHand(targetX = null, targetY = null) {
    const hand = Array.isArray(this.state.dice.hand) ? this.state.dice.hand : [];
    if (hand.length === 0) return null;

    const resultMode = this.state.dice.resultMode || 'sum';
    const mod = this.state.dice.modifier;
    const style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style };

    const results = hand.map((sides) => {
      const chosen = Math.floor(Math.random() * sides) + 1;
      return { sides, chosen, colorHex: style.bodyColor };
    });

    const summary = this.computeRollSummary(results, mod, resultMode);
    const label = this.formatHandFormula(hand);

    const roll = this.recordRoll({
      sides: hand[0],
      chosen: results.reduce((acc, r) => acc + r.chosen, 0),
      mod,
      total: summary.total,
      resultMode,
      isCrit: summary.isCrit,
      isFumble: summary.isFumble,
      label,
      message: '',
      dice: results,
      headline: summary.headline
    });
    this.state.dice.hand = [];

    Dice3DEngine.rollHand(
      results.map((r) => ({ sides: r.sides, colorHex: r.colorHex, value: r.chosen })),
      { targetX, targetY, style }
    );
    this.broadcastRoll(roll);
    this.recordEvent('TIRADA_DADO', `${label}: ${summary.headline}`, { broadcast: roll.visibility !== 'private' });
    this.notify();
    return roll;
  },

  setDiceVisibility(mode) {
    if (!this.state.dice) return;
    this.state.dice.visibility = mode === 'private' ? 'private' : 'public';
    this.notify();
  },

  recordRoll(roll) {
    if (!this.state.dice) return roll;
    const visibility = roll.visibility || this.state.dice.visibility || 'public';
    const rollerRole = roll.rollerRole || this.state.role || 'gm';
    const time = roll.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const stored = { ...roll, visibility, rollerRole, time };
    this.state.dice.lastRoll = stored;
    const history = Array.isArray(this.state.dice.history) ? this.state.dice.history : [];
    this.state.dice.history = [stored, ...history].slice(0, 25);
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
    if (roll.visibility === 'private' && this.state.role !== 'gm') return;
    const entry = { ...roll, remote: true };
    this.state.dice.lastRoll = entry;
    const history = Array.isArray(this.state.dice.history) ? this.state.dice.history : [];
    this.state.dice.history = [entry, ...history].slice(0, 25);
    this.notify({ skipVaultSave: true });
  },

  clearDiceHistory() {
    if (!this.state.dice) return;
    this.state.dice.history = [];
    this.notify();
  },

  evaluateArithmetic(expr) {
    const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
    if (!tokens) return 0;
    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];
    const parseFactor = () => {
      if (peek() === '+' || peek() === '-') {
        const sign = consume() === '-' ? -1 : 1;
        return sign * parseFactor();
      }
      if (peek() === '(') {
        consume();
        const val = parseExpr();
        if (peek() === ')') consume();
        return val;
      }
      const num = Number(consume());
      return Number.isFinite(num) ? num : 0;
    };
    const parseTerm = () => {
      let left = parseFactor();
      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const right = parseFactor();
        left = op === '*' ? left * right : right !== 0 ? left / right : left;
      }
      return left;
    };
    const parseExpr = () => {
      let left = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };
    return Math.round(parseExpr());
  },

  rollFormula(formulaStr, tok = null, label = '', message = '') {
    const stats = tok?.stats || {};
    const vars = {
      fue: Number(stats.str) || 0,
      str: Number(stats.str) || 0,
      des: Number(stats.dex) || 0,
      dex: Number(stats.dex) || 0,
      con: Number(stats.con) || 0,
      int: Number(stats.int) || 0,
      sab: Number(stats.wis) || 0,
      wis: Number(stats.wis) || 0,
      car: Number(stats.cha) || 0,
      cha: Number(stats.cha) || 0,
      pb: this.getProficiencyBonus(tok),
      bc: this.getProficiencyBonus(tok),
      hp: Number(tok?.hp) || 0,
      ac: Number(tok?.ac) || 0,
      ca: Number(tok?.ac) || 0
    };
    const resolved = String(formulaStr || '')
      .toLowerCase()
      .replace(/@([a-záéíóú]+)/gi, (_, k) => String(vars[k] ?? 0));

    const style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style };
    const diceResults = [];
    const withRolledDice = resolved.replace(/(\d*)d(\d+)/gi, (_, cntRaw, sidesRaw) => {
      const count = Math.min(20, Math.max(1, Number(cntRaw) || 1));
      const sides = Math.min(100, Math.max(2, Number(sidesRaw) || 20));
      let subtotal = 0;
      for (let i = 0; i < count; i += 1) {
        const chosen = Math.floor(Math.random() * sides) + 1;
        subtotal += chosen;
        diceResults.push({ sides, chosen, colorHex: style.bodyColor });
      }
      return String(subtotal);
    });

    const total = this.evaluateArithmetic(withRolledDice);
    if (diceResults.length > 0) {
      const diceSum = diceResults.reduce((acc, d) => acc + d.chosen, 0);
      const flatMod = total - diceSum;
      this.state.dice.modifier = flatMod;
      const roll = this.recordRoll({
        sides: diceResults[0].sides,
        chosen: diceResults[0].chosen,
        mod: flatMod,
        total,
        resultMode: 'sum',
        isCrit: diceResults.length === 1 && diceResults[0].chosen === diceResults[0].sides,
        isFumble: diceResults.length === 1 && diceResults[0].chosen === 1,
        label: label || formulaStr,
        message: String(message || '').trim(),
        dice: diceResults,
        headline: String(total)
      });
      Dice3DEngine.rollHand(diceResults, { style });
      this.broadcastRoll(roll);
    }
    const isPrivate = (this.state.dice?.visibility || 'public') === 'private';
    this.recordEvent('TIRADA_FORMULA', `${label || formulaStr}: ${total}`, { broadcast: !isPrivate });
    this.notify();
    return { total, dice: diceResults };
  },

  rollDice(sides = 20, label = '', message = '') {
    const chosen = Math.floor(Math.random() * sides) + 1;
    const resultMode = this.state.dice.resultMode || 'sum';
    const mod = this.state.dice.modifier;
    const style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style };
    const results = [{ sides, chosen, colorHex: style.bodyColor }];
    const summary = this.computeRollSummary(results, mod, resultMode);

    const roll = this.recordRoll({
      sides,
      chosen,
      mod,
      total: summary.total,
      resultMode,
      isCrit: summary.isCrit,
      isFumble: summary.isFumble,
      label,
      message: String(message || '').trim(),
      dice: results,
      headline: summary.headline
    });

    Dice3DEngine.rollHand([{ sides, colorHex: style.bodyColor, value: chosen }], { style });
    this.broadcastRoll(roll);
    this.recordEvent('TIRADA_DADO', `${label || '1d' + sides}: ${summary.headline} (nat ${chosen})`, {
      broadcast: roll.visibility !== 'private'
    });
    this.notify();
    return roll;
  }
};
