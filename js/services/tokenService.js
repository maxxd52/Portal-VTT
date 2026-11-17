/* ==========================================================================
   TOKEN SERVICE: FICHAS, INVENTARIO, STATS, HABILIDADES Y VISIBILIDAD
   ========================================================================== */

import { COMPENDIUM_ITEMS } from '../data/compendium.js?v=20261116z40';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { Selector } from '../core/selector.js?v=20261116z40';

export const TokenServiceMethods = {
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

    const preset = this.state.systemConfig?.preset || this.state.ruleset || 'dnd55';
    const initialStats = {};
    if (preset === 'dnd55') {
      Object.assign(initialStats, {
        str: Number(tpl.stats?.str) || 0,
        dex: Number(tpl.stats?.dex) || 0,
        con: Number(tpl.stats?.con) || 0,
        int: Number(tpl.stats?.int) || 0,
        wis: Number(tpl.stats?.wis) || 0,
        cha: Number(tpl.stats?.cha) || 0
      });
    } else {
      Selector.getSheetStatsDef(this.state).forEach((def) => {
        initialStats[def.key] = Number(tpl.stats?.[def.key]) || 0;
      });
    }

    const sysBlocks = Array.isArray(this.state.systemConfig?.sheetBlocks) ? this.state.systemConfig.sheetBlocks : null;
    const hpBlock = sysBlocks ? sysBlocks.find((b) => b.kind === 'resource' && b.key === 'hp') : null;
    const defHp = Number(tpl.hp) || Number(hpBlock?.max) || 16;
    const seedResList = Array.isArray(tpl.resources)
      ? tpl.resources.map((r) => ({ ...r }))
      : sysBlocks
        ? sysBlocks
            .filter((b) => b.kind === 'resource' && b.key !== 'hp')
            .map((b) => ({
              id: b.id,
              name: b.label,
              cur: Number(b.max) > 0 ? Number(b.max) : 0,
              max: Number(b.max) || 0,
              color: b.color || '#8b5cf6',
              kind: b.resStyle === 'pips' || b.resStyle === 'bar' ? b.resStyle : Number(b.max) > 0 && Number(b.max) <= 6 ? 'pips' : 'bar'
            }))
        : (this.state.systemConfig?.resourceSchema || []).map((r) => ({
            id: r.id || `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
            name: r.name,
            cur: Number(r.max) > 0 ? Number(r.max) : 0,
            max: Number(r.max) || 0,
            color: r.color || '#8b5cf6',
            kind: r.kind || 'bar'
          }));

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
      hp: defHp,
      maxHp: defHp,
      ac: Number(tpl.ac) || 12,
      level: Math.max(1, Math.min(20, Number(tpl.level) || 1)),
      speed: String(tpl.speed || '30 ft'),
      stats: initialStats,
      texts: tpl.texts ? { ...tpl.texts } : {},
      scores: tpl.scores ? { ...tpl.scores } : null,
      saveProfs: tpl.saveProfs ? { ...tpl.saveProfs } : {},
      skills: Array.isArray(tpl.skills) ? tpl.skills.map((s) => ({ ...s })) : [],
      traits: Array.isArray(tpl.traits) ? tpl.traits.map((t) => ({ ...t })) : [],
      resources: seedResList,
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
      passives: Array.isArray(itemTpl.passives) ? JSON.parse(JSON.stringify(itemTpl.passives)) : undefined,
      steps: Array.isArray(itemTpl.steps) ? JSON.parse(JSON.stringify(itemTpl.steps)) : undefined,
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

    if ((Array.isArray(inv.steps) && inv.steps.length > 0) || (inv.message && inv.kind !== 'consumable' && !inv.formula && !(inv.die > 0))) {
      this.startItemSequence(tokenId, inv);
      if (inv.kind === 'consumable') {
        tok.inventory = tok.inventory.filter((i) => i.uid !== invUid);
        this.notify();
      }
      return '';
    }

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
      return '';
    }

    if (inv.kind === 'consumable' && inv.heal > 0) {
      const prevHp = tok.hp;
      tok.hp = Math.min(tok.maxHp, tok.hp + inv.heal);
      tok.inventory = tok.inventory.filter((i) => i.uid !== invUid);
      const healed = tok.hp - prevHp;
      if (inv.die > 0) {
        this.rollDice(inv.die, `${tok.name} · ${inv.name}`, inv.message, inv.bonusMod || 0);
      }
      this.recordEvent('USAR_OBJETO', `${tok.name} usa ${inv.name}${noteSuffix} (+${healed} HP)`);
      this.notify();
      return `${tok.name} usa ${inv.name}${noteSuffix} (+${healed} HP).`;
    }

    if (inv.die > 0) {
      this.rollDice(inv.die, `${tok.name} · ${inv.name}`, inv.message, inv.bonusMod || 0);
      return '';
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

  cycleTokenSize(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return 1;
    const steps = [1, 2, 3];
    const cur = Number(tok.size) || 1;
    const next = steps[(steps.indexOf(cur) + 1) % steps.length];
    tok.size = next;
    this.recordEvent('TAMANO_FICHA', `${tok.name}: ${next}x${next}`);
    this.notify({ redrawFog: true });
    return next;
  },

  toggleTokenAlly(tokenId) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    if (!tok) return true;
    tok.isAlly = tok.isAlly === false;
    this.recordEvent('BANDO_FICHA', `${tok.name}: ${tok.isAlly ? 'Aliado' : 'Hostil'}`);
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
    const maxLim = Number(res.max) > 0 ? Number(res.max) : 999;
    res.cur = Math.max(0, Math.min(maxLim, (Number(res.cur) || 0) + d));
    this.notify();
    return res.cur;
  },

  setTokenResourceValue(tokenId, resId, val) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const res = tok?.resources?.find((r) => r.id === resId);
    if (!res) return;
    const maxLim = Number(res.max) > 0 ? Number(res.max) : 999;
    res.cur = Math.max(0, Math.min(maxLim, Math.trunc(Number(val) || 0)));
    this.notify();
  },

  cycleTokenResourcePip(tokenId, resId, pipIdx, maxStates = 1, maxPips = 0) {
    const tok = this.state.tokens.find((t) => t.id === tokenId);
    const res = tok?.resources?.find((r) => r.id === resId);
    if (!res) return;
    const states = [1, 2, 3].includes(Number(maxStates)) ? Number(maxStates) : 1;
    const idx = Math.max(0, Math.trunc(Number(pipIdx) || 0));
    if (states <= 1) {
      const targetVal = idx + 1;
      const curVal = Number(res.cur) || 0;
      return this.setTokenResourceValue(tokenId, resId, targetVal === curVal ? targetVal - 1 : targetVal);
    }
    const len = Math.max(idx + 1, Number(res.max) || Number(maxPips) || 1);
    if (!Array.isArray(res.pips) || res.pips.length !== len) {
      const prevCur = Math.max(0, Number(res.cur) || 0);
      res.pips = Array.from({ length: len }, (_, i) => {
        if (Array.isArray(res.pips) && i < res.pips.length) {
          return Math.max(0, Math.min(states, Number(res.pips[i]) || 0));
        }
        return !Array.isArray(res.pips) && i < prevCur ? states : 0;
      });
    }
    const curCell = Math.max(0, Math.min(states, Number(res.pips[idx]) || 0));
    res.pips[idx] = (curCell + 1) % (states + 1);
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
