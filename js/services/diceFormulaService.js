import { Dice3DEngine } from './dice3dEngine.js?v=20261117b1';
import { DEFAULT_DICE_STYLE } from '../core/model.js?v=20261117b1';
import { Selector } from '../core/selector.js?v=20261117b1';

/**
 * Deck management, arithmetic & formula evaluation, and roll summary methods mixed into DiceServiceMethods.
 */
export const DiceFormulaServiceMethods = {
  formatHandFormula(hand) {
    const counts = new Map();
    for (const s of hand) counts.set(s, (counts.get(s) || 0) + 1);
    return Array.from(counts.entries())
      .map(([sides, qty]) => {
        if (sides === 'fudge') return `${qty}dF`;
        if (sides === 'card') return `${qty} Carta${qty === 1 ? '' : 's'}`;
        if (Number(sides) === 2) return `${qty} Moneda${qty === 1 ? '' : 's'} (d2)`;
        return `${qty}d${sides}`;
      })
      .join(' + ');
  },

  createShuffledDeck() {
    const suits = [
      { suit: '♠', red: false },
      { suit: '♥', red: true },
      { suit: '♦', red: true },
      { suit: '♣', red: false }
    ];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const cards = [];
    for (const s of suits) {
      values.forEach((val, idx) => {
        cards.push({ val, suit: s.suit, red: s.red, rank: idx + 1, label: `${val}${s.suit}`, isJoker: false });
      });
    }
    cards.push({ val: 'Joker', suit: '★', red: true, rank: 14, label: 'Joker ★', isJoker: true });
    cards.push({ val: 'Joker', suit: '☆', red: false, rank: 14, label: 'Joker ☆', isJoker: true });
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  },

  ensureDeckState() {
    if (!this.state.deck || !Array.isArray(this.state.deck.cards)) {
      this.state.deck = { cards: this.createShuffledDeck(), total: 54 };
    }
    return this.state.deck;
  },

  drawCardFromDeck() {
    const deck = this.ensureDeckState();
    let autoShuffled = false;
    if (deck.cards.length === 0) {
      deck.cards = this.createShuffledDeck();
      autoShuffled = true;
    }
    const card = deck.cards.pop();
    return { card, remaining: deck.cards.length, autoShuffled };
  },

  shuffleDeck() {
    this.state.deck = { cards: this.createShuffledDeck(), total: 54 };
    if (this.state.dice?.lastRoll?.isDeckRoll) {
      this.state.dice.lastRoll = { ...this.state.dice.lastRoll, deckRemaining: 54, deckAutoShuffled: true };
    }
    this.recordEvent('BARAJA_MEZCLADA', '🔀 Baraja mezclada (54/54)', { broadcast: true });
    this.notify();
    return this.state.deck;
  },

  computeRollSummary(diceList, mod = 0, resultMode = 'sum', successThreshold = 6, opts = {}) {
    const list = Array.isArray(diceList) && diceList.length > 0 ? diceList : [];
    const outcome = opts.outcome || Selector.getSystemOutcomeConfig(this.state);
    if (list.length === 0) {
      return { headline: '0', detail: '', total: 0, isCrit: false, isFumble: false, outcomeTag: '', outcomeTone: '' };
    }
    const single = list.length === 1 ? list[0] : null;
    const applyOutcome = (base, refDie = null) => {
      const rule = outcome.outcomeRule;
      const hasTarget = Number.isFinite(Number(opts.target));
      const tgt = hasTarget ? Number(opts.target) : null;
      let isCrit = false;
      let isFumble = false;
      let outcomeTag = '';
      let outcomeTone = '';
      let detail = base.detail;

      if (rule === 'high') {
        if (outcome.showCrits) {
          isCrit = Boolean(base.rawCrit !== undefined ? base.rawCrit : (refDie && refDie.chosen === refDie.sides));
          isFumble = Boolean(base.rawFumble !== undefined ? base.rawFumble : (refDie && refDie.chosen === 1));
        }
      } else if (rule === 'low') {
        if (outcome.showCrits && refDie) {
          isCrit = refDie.chosen === 1;
          isFumble = refDie.chosen === refDie.sides;
        }
        if (hasTarget) {
          const ok = base.total <= tgt;
          outcomeTag = ok ? outcome.labels.success : outcome.labels.fail;
          outcomeTone = ok ? 'success' : 'fail';
          detail = `${detail} · ${ok ? '≤' : '>'} ${tgt}`;
        }
      } else if (rule === 'tiered') {
        const hitHigh = base.total >= outcome.tieredHigh;
        const hitMid = !hitHigh && base.total >= outcome.tieredMid;
        outcomeTag = hitHigh ? outcome.labels.success : hitMid ? outcome.labels.partial : outcome.labels.fail;
        outcomeTone = hitHigh ? 'success' : hitMid ? 'partial' : 'fail';
        if (outcome.showCrits && refDie) {
          isCrit = refDie.chosen === refDie.sides;
          isFumble = refDie.chosen === 1;
        }
      }

      return {
        headline: base.headline,
        detail,
        total: base.total,
        isCrit,
        isFumble,
        outcomeTag,
        outcomeTone,
        critLabel: outcome.labels.crit,
        fumbleLabel: outcome.labels.fumble
      };
    };

    if (resultMode === 'success') {
      const thr = Math.max(1, Number(successThreshold) || 6);
      const isLowPool = outcome.outcomeRule === 'low';
      const hits = list.filter((d) => (isLowPool ? d.chosen <= thr : d.chosen >= thr)).length;
      const total = Math.max(0, hits + mod);
      const modTxt = mod !== 0 ? (mod > 0 ? ` + ${mod}` : ` − ${Math.abs(mod)}`) : '';
      const unitLbl = outcome.labels.success.toLowerCase();
      return {
        headline: String(total),
        detail: `${hits} ${unitLbl} (${isLowPool ? '≤' : '≥'} ${thr})${modTxt}`,
        total,
        isCrit: outcome.showCrits && hits > 0 && hits === list.length,
        isFumble: outcome.showCrits && hits === 0 && list.some((d) => d.chosen === (isLowPool ? d.sides : 1)),
        outcomeTag: '',
        outcomeTone: '',
        critLabel: outcome.labels.crit,
        fumbleLabel: outcome.labels.fumble
      };
    }

    if (resultMode === 'each') {
      const perDie = list.map((d) => d.chosen + mod);
      const headline = perDie.join(' · ');
      const detail = mod !== 0
        ? `Base: ${list.map((d) => d.chosen).join(', ')}`
        : single
          ? `Natural: ${single.chosen}`
          : `${list.length} dados individuales`;
      return applyOutcome({ headline, detail, total: perDie[0] }, single);
    }

    if (resultMode === 'max') {
      const best = list.reduce((a, b) => (b.chosen >= a.chosen ? b : a), list[0]);
      const total = best.chosen + mod;
      const detail = list.length > 1
        ? `Mayor de ${list.map((d) => d.chosen).join(', ')} → ${best.chosen}`
        : `Natural: ${best.chosen}`;
      return applyOutcome({ headline: String(total), detail, total }, best);
    }

    if (resultMode === 'min') {
      const worst = list.reduce((a, b) => (b.chosen <= a.chosen ? b : a), list[0]);
      const total = worst.chosen + mod;
      const detail = list.length > 1
        ? `Menor de ${list.map((d) => d.chosen).join(', ')} → ${worst.chosen}`
        : `Natural: ${worst.chosen}`;
      return applyOutcome({ headline: String(total), detail, total }, worst);
    }

    // 'sum' (default)
    const sum = list.reduce((acc, r) => acc + r.chosen, 0);
    const total = sum + mod;
    const allFudge = list.every((d) => d.kind === 'fudge' || d.sides === 3);
    if (allFudge) {
      const faces = list.map((d) => (d.chosen === 1 ? '+' : d.chosen === -1 ? '−' : '◯')).join(' ');
      return {
        headline: total > 0 ? `+${total}` : String(total),
        detail: `${list.length}dF [${faces}]`,
        total,
        isCrit: false,
        isFumble: false
      };
    }
    const allCoins = list.every((d) => d.kind === 'coin' || d.sides === 2);
    if (allCoins) {
      const coinLbl = (v) => (v === 1 ? '★ Cara (1)' : '✕ Cruz (0)');
      const headsCount = list.filter((d) => d.chosen === 1).length;
      const tailsCount = list.length - headsCount;
      return {
        headline: single ? (single.chosen === 1 ? '★ Cara · 1' : '✕ Cruz · 0') : `${headsCount}★ · ${tailsCount}✕`,
        detail: list.length > 1 ? list.map((d) => coinLbl(d.chosen)).join(' + ') : coinLbl(list[0].chosen),
        total,
        isCrit: false,
        isFumble: false
      };
    }
    const allCards = list.every((d) => d.kind === 'card' && d.card);
    if (allCards) {
      const bestCardScore = list.reduce((best, d) => Math.max(best, Number(d.chosen) || 0), 0);
      return {
        headline: list.map((d) => d.card.label).join(' · '),
        detail: list.length > 1 ? `Cartas: ${list.map((d) => d.card.label).join(', ')}` : `Carta: ${list[0].card.label}`,
        total: bestCardScore,
        isCrit: list.some((d) => d.card.isJoker),
        isFumble: false
      };
    }
    const sumDetail = list.length > 1
      ? `Dados: ${list.map((d) => d.chosen).join(' + ')}`
      : `Natural: ${list[0].chosen}`;
    return applyOutcome({ headline: String(total), detail: sumDetail, total }, single);
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

  consumeHandExtraDice(startPhysicalCount = 0, style = DEFAULT_DICE_STYLE) {
    const trayHand = Array.isArray(this.state.dice?.hand) ? [...this.state.dice.hand] : [];
    const results = [];
    const usedSides = [];
    let sum = 0;
    let physical = startPhysicalCount;
    for (const rawSides of trayHand) {
      const cost = Number(rawSides) === 100 ? 2 : 1;
      if (physical + cost > 20) break;
      const rolled = this.rollSingleHandDie(rawSides, style);
      sum += rolled.chosen;
      physical += cost;
      usedSides.push(rawSides);
      results.push(rolled);
    }
    if (usedSides.length > 0 && Array.isArray(this.state.dice?.hand)) {
      this.state.dice.hand = [];
    }
    return { results, usedSides, sum };
  },

  rollFormula(formulaStr, tok = null, label = '', message = '', opts = {}) {
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
    const numBlocks = Selector.getSystemSheetBlocks(this.state).filter((b) => b.kind === 'number');
    const defs = Selector.getSheetStatsDef(this.state, tok);
    defs.forEach((def) => {
      const blk = numBlocks.find((b) => b.key === def.key);
      const val = blk && blk.valueMode === 'calc'
        ? Selector.resolveTokenBlockValue(this.state, tok, blk)
        : (Number(stats[def.key]) || 0);
      if (def.key) vars[def.key] = val;
      if (def.alias) vars[def.alias] = val;
      const normLabel = Selector.normalizeStatKey(def.label);
      if (normLabel) vars[normLabel] = val;
    });
    if (Array.isArray(tok?.resources)) {
      tok.resources.forEach((res) => {
        const key = Selector.normalizeStatKey(res.name);
        if (key) vars[key] = Number(res.cur) || 0;
      });
    }
    const resolved = String(formulaStr || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/@([a-z0-9_]+)/gi, (_, k) => String(vars[k] ?? 0));

    const style = { ...DEFAULT_DICE_STYLE, ...this.state.dice.style };
    const trayMod = Number(this.state.dice?.modifier) || 0;
    const diceResults = [];
    let physicalDiceCount = 0;
    const suitOrder = { '♠': 0.4, '♥': 0.3, '♦': 0.2, '♣': 0.1, '★': 0.5, '☆': 0.45 };
    const withCards = resolved.replace(/(\d*)(?:carta|baraja|card)\b/gi, (_, cntRaw) => {
      const remainingSlots = Math.max(0, 20 - physicalDiceCount);
      const count = Math.min(remainingSlots, Math.max(1, Number(cntRaw) || 1));
      let bestScore = 0;
      for (let i = 0; i < count; i += 1) {
        const drawn = this.drawCardFromDeck();
        const card = drawn.card;
        const pokerRank = card.isJoker ? 15 : (card.rank === 1 ? 14 : card.rank);
        const initScore = Number((pokerRank + (suitOrder[card.suit] || 0)).toFixed(2));
        bestScore = Math.max(bestScore, initScore);
        physicalDiceCount += 1;
        diceResults.push({
          kind: 'card',
          sides: 54,
          chosen: initScore,
          card,
          deckAutoShuffled: drawn.autoShuffled,
          colorHex: style.bodyColor
        });
      }
      return `(${Math.round(bestScore)})`;
    });
    const withCoins = withCards.replace(/(\d*)moneda\b/gi, (_, cntRaw) => {
      const remainingSlots = Math.max(0, 20 - physicalDiceCount);
      const count = Math.min(remainingSlots, Math.max(1, Number(cntRaw) || 1));
      let subtotal = 0;
      for (let i = 0; i < count; i += 1) {
        const chosen = Math.floor(Math.random() * 2);
        subtotal += chosen;
        physicalDiceCount += 1;
        diceResults.push({ kind: 'coin', sides: 2, chosen, colorHex: style.bodyColor });
      }
      return `(${subtotal})`;
    });
    const withFudgeDice = withCoins.replace(/(\d*)df\b/gi, (_, cntRaw) => {
      const remainingSlots = Math.max(0, 20 - physicalDiceCount);
      const count = Math.min(remainingSlots, Math.max(1, Number(cntRaw) || 4));
      let subtotal = 0;
      for (let i = 0; i < count; i += 1) {
        const chosen = Math.floor(Math.random() * 3) - 1;
        subtotal += chosen;
        physicalDiceCount += 1;
        diceResults.push({ kind: 'fudge', sides: 3, chosen, colorHex: style.bodyColor });
      }
      return `(${subtotal})`;
    });
    const withRolledDice = withFudgeDice.replace(/(\d*)d(\d+)/gi, (_, cntRaw, sidesRaw) => {
      const sides = Math.min(100, Math.max(2, Number(sidesRaw) || 20));
      const cost = sides === 100 ? 2 : 1;
      const remainingSlots = Math.max(0, 20 - physicalDiceCount);
      const count = Math.min(Math.floor(remainingSlots / cost), Math.max(1, Number(cntRaw) || 1));
      let subtotal = 0;
      for (let i = 0; i < count; i += 1) {
        const chosen = Math.floor(Math.random() * sides) + 1;
        subtotal += chosen;
        physicalDiceCount += cost;
        diceResults.push({ sides, chosen, colorHex: style.bodyColor });
      }
      return String(subtotal);
    });

    const effMode = opts.resultMode && opts.resultMode !== 'inherit'
      ? opts.resultMode
      : (this.state.dice?.resultMode || 'sum');
    const effThr = Math.max(1, Number(opts.successThreshold) || Number(this.state.dice?.successThreshold) || 6);
    const activeTrayMod = opts.silent ? 0 : trayMod;

    const extra = opts.silent ? { results: [], usedSides: [], sum: 0 } : this.consumeHandExtraDice(physicalDiceCount, style);
    diceResults.push(...extra.results);

    let total = this.evaluateArithmetic(withRolledDice) + extra.sum + activeTrayMod;
    if (diceResults.length > 0) {
      const allCards = diceResults.every((d) => d.kind === 'card');
      const isDeckRoll = diceResults.some((d) => d.kind === 'card');
      const diceSum = diceResults.reduce((acc, d) => acc + d.chosen, 0);
      const flatMod = allCards
        ? activeTrayMod
        : effMode === 'sum'
          ? total - diceSum
          : this.evaluateArithmetic(resolved.replace(/(\d*)(?:carta|baraja|card|moneda|df|d\d+)\b/gi, '0')) + activeTrayMod;
      const summary = this.computeRollSummary(diceResults, flatMod, effMode, effThr, { target: opts.target });
      total = summary.total;
      if (opts.silent) {
        return { total, headline: summary.headline, isDeckRoll, dice: diceResults };
      }
      const extraLabel = extra.usedSides.length > 0 ? ` + ${this.formatHandFormula(extra.usedSides)}` : '';
      const roll = this.recordRoll({
        sides: diceResults[0].sides,
        chosen: diceResults[0].chosen,
        mod: flatMod,
        total: summary.total,
        resultMode: effMode,
        successThreshold: effThr,
        target: opts.target,
        isCrit: summary.isCrit,
        isFumble: summary.isFumble,
        label: `${label || formulaStr}${extraLabel}`,
        message: String(message || '').trim(),
        dice: diceResults,
        headline: summary.headline,
        isDeckRoll,
        deckRemaining: isDeckRoll ? (this.state.deck?.cards?.length ?? 54) : undefined
      });
      const can3D = typeof Dice3DEngine.canRoll3D === 'function' && Dice3DEngine.canRoll3D();
      if (can3D) Dice3DEngine.prepareFlight();
      this.broadcastRoll(roll);
      const isPrivate = (this.state.dice?.visibility || 'public') === 'private';
      this.recordEvent('TIRADA_FORMULA', `${label || formulaStr}: ${summary.headline || total}`, { broadcast: !isPrivate });
      this.notify();
      if (can3D) {
        Dice3DEngine.rollHand(
          diceResults.map((d) => ({ kind: d.kind, sides: d.sides, colorHex: d.colorHex, value: d.chosen, card: d.card })),
          { style }
        );
      }
      return { total, headline: summary.headline, isDeckRoll, dice: diceResults };
    }
    if (opts.silent) {
      return { total, headline: String(total), isDeckRoll: false, dice: [] };
    }
    const isPrivate = (this.state.dice?.visibility || 'public') === 'private';
    this.recordEvent('TIRADA_FORMULA', `${label || formulaStr}: ${total}`, { broadcast: !isPrivate });
    this.notify();
    return { total, dice: diceResults };
  }
};
