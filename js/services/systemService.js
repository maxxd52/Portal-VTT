/* ==========================================================================
   SYSTEM SERVICE: PRESETS, REGLAS DEL PORTAL Y CONSTRUCTOR DE PESTAÑAS/ATRIBUTOS
   ========================================================================== */

import { DEFAULT_STATUS_DEFS, SYSTEM_PRESETS } from '../core/model.js?v=20261123a7';
import { Selector } from '../core/selector.js?v=20261123a7';
import { createDefaultGmScreen } from '../data/gmScreenPresets.js?v=20261123a7';
import { DEFAULT_VISION_CONFIG, normalizeVisionConfig } from '../utils/lightingModel.js?v=20261123a7';

export const SystemServiceMethods = {
  applySystemPreset(presetKey, targetState = this.state) {
    const key = presetKey in SYSTEM_PRESETS ? presetKey : 'dnd55';
    const preset = SYSTEM_PRESETS[key];
    targetState.ruleset = key === 'dnd55' ? 'dnd55' : 'free';
    targetState.systemConfig = {
      preset: key,
      rollFormula: preset.rollFormula,
      resultMode: preset.resultMode || 'sum',
      successThreshold: Number(preset.successThreshold) || 6,
      showDefense: preset.showDefense !== false,
      showHp: preset.showHp !== false,
      showInit: preset.showInit !== false,
      hpLabel: String(preset.hpLabel || 'Salud'),
      defenseLabel: String(preset.defenseLabel || 'Defensa · CA'),
      showLevelPb: preset.showLevelPb !== false,
      showScores: preset.showScores !== false,
      autoInitiative: preset.autoInitiative !== false,
      combatTrackerPublic: preset.combatTrackerPublic !== false,
      enabledTabs: {
        skills: preset.enabledTabs?.skills !== false,
        traits: preset.enabledTabs?.traits !== false,
        inventory: preset.enabledTabs?.inventory !== false
      },
      customTabs: Array.isArray(preset.customTabs) ? preset.customTabs.map((t) => ({ ...t })) : [],
      sheetTabs: Array.isArray(preset.sheetTabs) ? preset.sheetTabs.map((t) => ({ ...t })) : null,
      sheetBlocks: Array.isArray(preset.sheetBlocks) ? preset.sheetBlocks.map((b) => ({ ...b })) : null,
      headerColumns: Math.max(1, Math.min(3, Number(preset.headerColumns) || 2)),
      fixedRolls: Array.isArray(preset.fixedRolls) ? preset.fixedRolls.map((r) => ({ ...r })) : [],
      resourceSchema: Array.isArray(preset.resourceSchema) ? preset.resourceSchema.map((r) => ({ ...r })) : [],
      statusesSchema: Array.isArray(preset.statusesSchema) ? preset.statusesSchema.map((s) => ({ ...s })) : null,
      vision: normalizeVisionConfig(targetState.systemConfig?.vision || DEFAULT_VISION_CONFIG)
    };
    if (Array.isArray(preset.schema) && preset.schema.length > 0) {
      targetState.sheetSchema = preset.schema.map((s) => ({ tabId: 'attrs', ...s }));
    }
    if (targetState.dice) {
      targetState.dice.resultMode = targetState.systemConfig.resultMode;
      targetState.dice.successThreshold = targetState.systemConfig.successThreshold;
    }
    targetState.gmScreen = createDefaultGmScreen(key);
    targetState.publicClocks = Selector.getPublicClocks(targetState);
    if (targetState === this.state) {
      this.recordEvent('SISTEMA', `Sistema de juego: ${preset.label}`);
      this.notify();
    }
  },

  updateSystemConfig(patch = {}) {
    const cur = this.state.systemConfig || {};
    const nextEnabledTabs = patch.enabledTabs
      ? { ...(cur.enabledTabs || { skills: true, traits: true, inventory: true }), ...patch.enabledTabs }
      : (cur.enabledTabs || { skills: true, traits: true, inventory: true });
    this.state.systemConfig = {
      ...cur,
      ...patch,
      enabledTabs: nextEnabledTabs,
      customTabs: Array.isArray(patch.customTabs) ? patch.customTabs : (Array.isArray(cur.customTabs) ? cur.customTabs : []),
      sheetTabs: patch.sheetTabs === null
        ? null
        : Array.isArray(patch.sheetTabs)
          ? patch.sheetTabs
          : (Array.isArray(cur.sheetTabs) ? cur.sheetTabs : null),
      sheetBlocks: patch.sheetBlocks === null
        ? null
        : Array.isArray(patch.sheetBlocks)
          ? patch.sheetBlocks
          : (Array.isArray(cur.sheetBlocks) ? cur.sheetBlocks : null),
      fixedRolls: Array.isArray(patch.fixedRolls) ? patch.fixedRolls : (Array.isArray(cur.fixedRolls) ? cur.fixedRolls : []),
      resourceSchema: Array.isArray(patch.resourceSchema) ? patch.resourceSchema : (Array.isArray(cur.resourceSchema) ? cur.resourceSchema : []),
      statusesSchema: patch.statusesSchema === null
        ? null
        : Array.isArray(patch.statusesSchema)
          ? patch.statusesSchema
          : (Array.isArray(cur.statusesSchema) ? cur.statusesSchema : null),
      vision: patch.vision ? normalizeVisionConfig(patch.vision) : normalizeVisionConfig(cur.vision || {})
    };
    if (patch.resultMode && this.state.dice) {
      this.state.dice.resultMode = patch.resultMode;
    }
    if (patch.successThreshold !== undefined && this.state.dice) {
      this.state.dice.successThreshold = Math.max(1, Number(patch.successThreshold) || 6);
    }
    this.syncWorldToPeers();
    this.notify(patch.vision ? { redrawFog: true } : {});
  },

  updateSystemVisionConfig(patch = {}) {
    const cur = Selector.getSystemVisionConfig(this.state);
    const next = normalizeVisionConfig({ ...cur, ...patch });
    const activeKey = this.getActiveSceneKey();
    if (patch.rememberExplored !== undefined && !this.state.sceneLighting?.[activeKey]) {
      this.state.rememberExplored = next.rememberExplored;
    }
    this.updateSystemConfig({ vision: next });
    return next;
  },

  ensureGenericBlocksInitialized(silent = false) {
    const cur = this.state.systemConfig || {};
    const existingTabs = Selector.getSystemSheetTabs(this.state).filter((t) => t.mode === 'fixed' || t.mode === 'items');
    const sheetTabs = existingTabs.length >= 2
      ? existingTabs
      : [
          { id: 'attrs', label: 'Atributos', mode: 'fixed', sumTotal: false },
          { id: 'equipment', label: 'Equipo', mode: 'items' },
          { id: 'ability', label: 'Capacidades', mode: 'items' }
        ];
    let sheetBlocks = Array.isArray(cur.sheetBlocks)
      ? cur.sheetBlocks.map((b) => Selector.normalizeSheetBlock(b)).filter(Boolean)
      : null;
    if (!sheetBlocks) {
      sheetBlocks = [];
      if (cur.showHp !== false) {
        sheetBlocks.push({ id: 'blk_hp', kind: 'resource', key: 'hp', label: cur.hpLabel || 'Salud', max: 18, color: '#10b981', resStyle: 'bar', tabId: 'header', size: '1/2' });
      }
      if (cur.showDefense !== false) {
        sheetBlocks.push({ id: 'blk_def', kind: 'number', key: 'ac', label: cur.defenseLabel || 'Defensa', rollMode: 'none', formula: '', tabId: 'header', size: '1/2' });
      }
      if (cur.showInit !== false) {
        sheetBlocks.push({ id: 'blk_init', kind: 'text', textMode: 'fixed', fixedText: '', clickAction: 'roll', isInitiative: true, key: 'init', label: 'Iniciativa', formula: cur.rollFormula || '1d20+@stat', tabId: 'header', size: '1/3' });
      }
      Selector.getSheetStatsDef(this.state).forEach((s) => {
        sheetBlocks.push({ id: `blk_${s.key}`, kind: 'number', key: s.key, label: s.label, rollMode: 'base', formula: '', tabId: s.tabId || 'attrs', size: '1/3' });
      });
      (cur.resourceSchema || []).forEach((r) => {
        sheetBlocks.push({
          id: r.id,
          kind: 'resource',
          key: Selector.normalizeStatKey(r.name) || r.id,
          label: r.name,
          max: Number(r.max) || 0,
          color: r.color || '#8b5cf6',
          resStyle: r.kind || 'auto',
          tabId: r.tabId || 'header',
          size: '1/2'
        });
      });
      (cur.fixedRolls || []).forEach((rl) => {
        sheetBlocks.push({
          id: rl.id,
          kind: 'text',
          textMode: 'fixed',
          fixedText: '',
          clickAction: 'roll',
          isInitiative: false,
          key: Selector.normalizeStatKey(rl.label) || rl.id,
          label: rl.label,
          formula: rl.formula || '1d20',
          tabId: rl.tabId || 'attrs',
          size: '1/3'
        });
      });
    }
    this.state.systemConfig = {
      ...cur,
      preset: 'free',
      sheetTabs,
      sheetBlocks,
      fixedRolls: Array.isArray(cur.fixedRolls) ? cur.fixedRolls : [],
      customTabs: Array.isArray(cur.customTabs) ? cur.customTabs : []
    };
    if (!silent) this.notify();
    return this.state.systemConfig.sheetBlocks;
  },

  convertPortalToGeneric() {
    this.state.ruleset = 'free';
    this.ensureGenericBlocksInitialized(true);
    this.ensureGmScreenInitialized?.(true);
    this.recordEvent('SISTEMA', 'Portal convertido a Sistema Genérico personalizable');
    this.notify();
  },

  addSystemCustomTab(rawLabel, mode = 'fixed') {
    const label = String(rawLabel || '').trim();
    if (!label) return null;
    const cleanMode = mode === 'items' ? 'items' : 'fixed';
    const cur = this.state.systemConfig || {};
    const useUnified = Array.isArray(cur.sheetTabs);
    const list = useUnified ? [...cur.sheetTabs] : (Array.isArray(cur.customTabs) ? [...cur.customTabs] : []);
    const baseId = `tab_${Selector.normalizeStatKey(label) || 'extra'}`;
    let id = baseId;
    let i = 2;
    const existing = new Set([
      'header', 'attrs', 'skills', 'traits', 'equipment', 'consumable', 'ability',
      ...list.map((t) => t.id)
    ]);
    while (existing.has(id)) {
      id = `${baseId}_${i}`;
      i += 1;
    }
    const created = cleanMode === 'items' ? { id, label, mode: 'items' } : { id, label, mode: 'fixed', sumTotal: false };
    list.push(created);
    this.updateSystemConfig(useUnified ? { sheetTabs: list } : { customTabs: list });
    return created;
  },

  renameSystemCustomTab(tabId, rawLabel) {
    const label = String(rawLabel || '').trim();
    if (!label) return false;
    const cur = this.state.systemConfig || {};
    if (Array.isArray(cur.sheetTabs)) {
      const sheetTabs = cur.sheetTabs.map((t) => (t.id === tabId ? { ...t, label } : t));
      this.updateSystemConfig({ sheetTabs });
    } else {
      const customTabs = (cur.customTabs || []).map((t) => (t.id === tabId ? { ...t, label } : t));
      this.updateSystemConfig({ customTabs });
    }
    return true;
  },

  toggleSystemCustomTabSum(tabId) {
    const cur = this.state.systemConfig || {};
    if (Array.isArray(cur.sheetTabs)) {
      const sheetTabs = cur.sheetTabs.map((t) => (t.id === tabId ? { ...t, sumTotal: !t.sumTotal } : t));
      this.updateSystemConfig({ sheetTabs });
    } else {
      const customTabs = (cur.customTabs || []).map((t) => (t.id === tabId ? { ...t, sumTotal: !t.sumTotal } : t));
      this.updateSystemConfig({ customTabs });
    }
  },

  moveSystemTabOrder(tabId, delta = -1) {
    const cur = this.state.systemConfig || {};
    const list = Array.isArray(cur.sheetTabs)
      ? [...cur.sheetTabs]
      : Selector.getSystemSheetTabs(this.state).filter((t) => t.mode === 'fixed' || t.mode === 'items');
    const idx = list.findIndex((t) => t.id === tabId);
    if (idx === -1) return false;
    const step = delta < 0 ? -1 : 1;
    const targetIdx = idx + step;
    if (targetIdx < 0 || targetIdx >= list.length) return false;
    const [moved] = list.splice(idx, 1);
    list.splice(targetIdx, 0, moved);
    this.updateSystemConfig({ sheetTabs: list });
    return true;
  },

  removeSystemCustomTab(tabId) {
    const cur = this.state.systemConfig || {};
    const baseTabs = Array.isArray(cur.sheetTabs)
      ? [...cur.sheetTabs]
      : Selector.getSystemSheetTabs(this.state).filter((t) => t.mode === 'fixed' || t.mode === 'items');
    if (baseTabs.length <= 1) return false;
    const targetTab = baseTabs.find((t) => t.id === tabId);
    if (!targetTab) return false;

    if (targetTab.mode === 'items' && Array.isArray(this.state.tokens)) {
      this.state.tokens = this.state.tokens.map((tok) => {
        if (!Array.isArray(tok.inventory) || tok.inventory.length === 0) return tok;
        const nextInv = tok.inventory.filter((it) => Selector.resolveItemTabId(this.state, it?.kind) !== tabId);
        return nextInv.length === tok.inventory.length ? tok : { ...tok, inventory: nextInv };
      });
    }

    this.state.sheetSchema = Selector.getSheetStatsDef(this.state).filter((s) => s.tabId !== tabId);
    const fixedRolls = (cur.fixedRolls || []).filter((r) => r.tabId !== tabId);
    const resourceSchema = (cur.resourceSchema || []).filter((r) => r.tabId !== tabId);
    const sheetBlocks = Array.isArray(cur.sheetBlocks)
      ? cur.sheetBlocks.filter((b) => b.tabId !== tabId)
      : null;
    const sheetTabs = baseTabs.filter((t) => t.id !== tabId);
    const customTabs = (cur.customTabs || []).filter((t) => t.id !== tabId);
    this.updateSystemConfig({ sheetTabs, customTabs, sheetBlocks, fixedRolls, resourceSchema });
    return true;
  },

  addSystemBlock(kind = 'number', opts = {}) {
    if (!Array.isArray(this.state.systemConfig?.sheetBlocks)) {
      this.ensureGenericBlocksInitialized(true);
    }
    const cur = this.state.systemConfig || {};
    const blocks = Array.isArray(cur.sheetBlocks) ? [...cur.sheetBlocks] : [];
    const effOpts = kind === 'roll' ? { textMode: 'fixed', clickAction: 'roll', ...opts } : opts;
    const cleanKind = kind === 'roll'
      ? 'text'
      : ['number', 'resource', 'text'].includes(kind)
        ? kind
        : 'number';
    const tabId = String(effOpts.tabId || 'attrs');
    const defaultLabel = cleanKind === 'resource'
      ? 'Recurso'
      : cleanKind === 'text'
        ? (effOpts.clickAction === 'roll' ? 'Tirada' : 'Nota')
        : 'Atributo';
    const label = String(effOpts.label || defaultLabel).trim() || defaultLabel;
    const baseKey = Selector.normalizeStatKey(label) || cleanKind;
    const usedKeys = new Set(blocks.map((b) => b.key));
    let key = baseKey;
    let idx = 2;
    while (usedKeys.has(key)) {
      key = `${baseKey}_${idx}`;
      idx += 1;
    }
    const id = `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const defaultSize = cleanKind === 'text'
      ? (effOpts.textMode === 'fixed' ? '1/3' : '1/1')
      : cleanKind === 'resource'
        ? '1/2'
        : '1/3';
    const validSizes = new Set(['1/3', '1/2', '2/3', '1/1']);
    const size = validSizes.has(effOpts.size) ? effOpts.size : defaultSize;
    const block = {
      id,
      kind: cleanKind,
      key,
      label,
      tabId,
      size
    };
    if (cleanKind === 'number') {
      block.valueMode = ['manual', 'calc', 'die'].includes(effOpts.valueMode) ? effOpts.valueMode : 'manual';
      block.rollMode = ['none', 'base', 'custom'].includes(effOpts.rollMode) ? effOpts.rollMode : 'base';
      block.formula = String(effOpts.formula || '');
      block.hideValue = Boolean(effOpts.hideValue);
      block.showSign = Boolean(effOpts.showSign);
      block.suffix = String(effOpts.suffix || '');
      block.hasCheck = Boolean(effOpts.hasCheck);
      block.checkBonus = Number(effOpts.checkBonus) || 0;
      block.resultMode = effOpts.resultMode || 'inherit';
      block.successThreshold = Number(effOpts.successThreshold) || 6;
      block.isInitiative = Boolean(effOpts.isInitiative);
    } else if (cleanKind === 'resource') {
      block.maxMode = ['fixed', 'free', 'calc'].includes(effOpts.maxMode)
        ? effOpts.maxMode
        : (effOpts.max === 0 ? 'free' : 'fixed');
      block.max = block.maxMode === 'free' ? 0 : Math.max(1, Math.min(999, Math.trunc(Number(effOpts.max ?? 4) || 4)));
      block.maxFormula = String(effOpts.maxFormula || '');
      block.editableMax = Boolean(effOpts.editableMax);
      block.color = String(effOpts.color || '#8b5cf6');
      block.resStyle = effOpts.resStyle || 'auto';
      block.rollMode = effOpts.rollMode === 'custom' ? 'custom' : 'none';
      block.formula = String(effOpts.formula || '');
      block.resultMode = effOpts.resultMode || 'inherit';
      block.successThreshold = Number(effOpts.successThreshold) || 6;
      block.consumeOnRoll = Boolean(effOpts.consumeOnRoll);
      if (block.key !== 'hp') {
        (this.state.tokens || []).forEach((tok) => {
          if (!Array.isArray(tok.resources)) tok.resources = [];
          if (!tok.resources.some((r) => r.id === id)) {
            const effMax = Selector.resolveResourceMax(this.state, tok, block);
            tok.resources.push({
              id,
              name: label,
              cur: effMax > 0 ? effMax : 0,
              max: effMax,
              color: block.color,
              kind: block.resStyle === 'pips' || block.resStyle === 'bar' ? block.resStyle : effMax > 0 && effMax <= 6 ? 'pips' : 'bar'
            });
          }
        });
      }
    } else {
      block.textMode = ['input', 'fixed', 'select', 'tags'].includes(effOpts.textMode) ? effOpts.textMode : 'input';
      block.fixedText = String(effOpts.fixedText || '');
      block.options = Array.isArray(effOpts.options) ? effOpts.options : [];
      block.clickAction = ['none', 'roll', 'announce'].includes(effOpts.clickAction) ? effOpts.clickAction : 'none';
      block.formula = String(effOpts.formula || (block.clickAction === 'roll' ? (cur.rollFormula || '1d20') : ''));
      block.resultMode = effOpts.resultMode || 'inherit';
      block.successThreshold = Number(effOpts.successThreshold) || 6;
      block.isInitiative = Boolean(effOpts.isInitiative);
      block.placeholder = String(effOpts.placeholder || 'Escribir...');
    }
    blocks.push(block);
    this.updateSystemConfig({ sheetBlocks: blocks });
    return block;
  },

  updateSystemBlock(blockId, patch = {}) {
    const cur = this.state.systemConfig || {};
    const blocks = Array.isArray(cur.sheetBlocks) ? [...cur.sheetBlocks] : [];
    const rawTarget = blocks.find((b) => b.id === blockId);
    if (!rawTarget) return null;
    const target = Selector.normalizeSheetBlock(rawTarget) || rawTarget;

    const oldKey = target.key;
    let nextKey = oldKey;
    if (patch.label !== undefined && oldKey !== 'hp' && oldKey !== 'ac') {
      const candidate = Selector.normalizeStatKey(patch.label);
      if (candidate && candidate !== oldKey) {
        const used = new Set(blocks.filter((b) => b.id !== blockId).map((b) => b.key));
        let unique = candidate;
        let idx = 2;
        while (used.has(unique)) {
          unique = `${candidate}_${idx}`;
          idx += 1;
        }
        nextKey = unique;
      }
    }

    const updated = { ...target, ...patch, key: nextKey };
    if (patch.size !== undefined) {
      const validSizes = new Set(['1/3', '1/2', '2/3', '1/1']);
      updated.size = validSizes.has(patch.size) ? patch.size : Selector.resolveBlockSize(target);
      delete updated.span;
    }
    if (updated.kind === 'text') {
      updated.textMode = ['input', 'fixed', 'select', 'tags'].includes(updated.textMode) ? updated.textMode : 'input';
      updated.fixedText = String(updated.fixedText || '');
      if (typeof patch.optionsText === 'string') {
        updated.options = patch.optionsText.split(',').map((s) => s.trim()).filter(Boolean);
        delete updated.optionsText;
      } else {
        updated.options = Array.isArray(updated.options)
          ? updated.options.map((s) => String(s).trim()).filter(Boolean)
          : [];
      }
      updated.clickAction = ['none', 'roll', 'announce'].includes(updated.clickAction) ? updated.clickAction : 'none';
      updated.formula = String(updated.formula || '');
      updated.resultMode = updated.resultMode || 'inherit';
      updated.successThreshold = Math.max(1, Math.min(100, Math.round(Number(updated.successThreshold) || 6)));
      updated.isInitiative = Boolean(updated.isInitiative);
      const parsedRows = Number(updated.textRows);
      updated.textRows = [1, 3, 5].includes(parsedRows) ? parsedRows : 1;
    }
    if (updated.kind === 'number') {
      updated.valueMode = ['manual', 'calc', 'die'].includes(updated.valueMode) ? updated.valueMode : 'manual';
      if (updated.calcFormula !== undefined) updated.calcFormula = String(updated.calcFormula);
      updated.rollMode = ['none', 'base', 'custom'].includes(updated.rollMode) ? updated.rollMode : 'base';
      updated.hideValue = Boolean(updated.hideValue);
      updated.showSign = Boolean(updated.showSign);
      updated.suffix = String(updated.suffix || '').trim().slice(0, 6);
      updated.hasCheck = Boolean(updated.hasCheck);
      updated.checkBonus = Math.max(-99, Math.min(99, Math.trunc(Number(updated.checkBonus) || 0)));
      updated.resultMode = updated.resultMode || 'inherit';
      updated.successThreshold = Math.max(1, Math.min(100, Math.round(Number(updated.successThreshold) || 6)));
      updated.isInitiative = Boolean(updated.isInitiative);
    }
    if (updated.kind === 'resource') {
      if (patch.max !== undefined && patch.maxMode === undefined) {
        updated.maxMode = (Number(patch.max) || 0) <= 0 ? 'free' : 'fixed';
      } else {
        updated.maxMode = ['fixed', 'free', 'calc'].includes(updated.maxMode) ? updated.maxMode : 'fixed';
      }
      if (updated.maxMode === 'free') {
        updated.max = 0;
      } else if (updated.maxMode === 'fixed') {
        const rawMax = Math.trunc(Number(updated.max) || 0);
        updated.max = Math.max(1, Math.min(999, rawMax > 0 ? rawMax : 4));
      } else {
        updated.maxFormula = String(updated.maxFormula || '');
        const rawMax = Math.trunc(Number(updated.max) || 0);
        updated.max = Math.max(1, Math.min(999, rawMax > 0 ? rawMax : 4));
      }
      updated.editableMax = Boolean(updated.editableMax);
      updated.resStyle = ['auto', 'bar', 'pips', 'counter'].includes(updated.resStyle) ? updated.resStyle : 'auto';
      updated.pipShape = ['circle', 'square', 'diamond'].includes(updated.pipShape) ? updated.pipShape : 'circle';
      updated.pipStates = [1, 2, 3].includes(Number(updated.pipStates)) ? Number(updated.pipStates) : 1;
      updated.rollMode = updated.rollMode === 'custom' ? 'custom' : 'none';
      updated.formula = String(updated.formula || '');
      updated.resultMode = updated.resultMode || 'inherit';
      updated.successThreshold = Math.max(1, Math.min(100, Math.round(Number(updated.successThreshold) || 6)));
      updated.consumeOnRoll = Boolean(updated.consumeOnRoll);
      if (updated.key !== 'hp') {
        (this.state.tokens || []).forEach((tok) => {
          const res = tok.resources?.find((r) => r.id === blockId || Selector.normalizeStatKey(r.name) === oldKey);
          if (res) {
            const effMax = Selector.resolveResourceMax(this.state, tok, updated, res);
            const visualKind = updated.resStyle === 'pips' || updated.resStyle === 'bar'
              ? updated.resStyle
              : effMax > 0 && effMax <= 6 ? 'pips' : 'bar';
            res.id = blockId;
            res.name = updated.label;
            res.max = effMax;
            if (Array.isArray(res.pips)) {
              const lim = effMax > 0 ? effMax : res.pips.length;
              res.pips = Array.from({ length: lim }, (_, i) => Math.max(0, Math.min(updated.pipStates, Number(res.pips[i]) || 0)));
              res.cur = res.pips.filter((v) => v > 0).length;
            } else if (effMax > 0) {
              res.cur = Math.min(res.cur, effMax);
            }
            res.color = updated.color || '#8b5cf6';
            res.kind = visualKind;
          }
        });
      }
    } else if (nextKey !== oldKey) {
      (this.state.tokens || []).forEach((tok) => {
        if (tok.stats && Object.prototype.hasOwnProperty.call(tok.stats, oldKey)) {
          tok.stats[nextKey] = tok.stats[oldKey];
          delete tok.stats[oldKey];
        }
        if (tok.texts && Object.prototype.hasOwnProperty.call(tok.texts, oldKey)) {
          tok.texts[nextKey] = tok.texts[oldKey];
          delete tok.texts[oldKey];
        }
        if (tok.blockChecks && Object.prototype.hasOwnProperty.call(tok.blockChecks, oldKey)) {
          tok.blockChecks[nextKey] = tok.blockChecks[oldKey];
          delete tok.blockChecks[oldKey];
        }
      });
    }

    const nextBlocks = blocks.map((b) => (b.id === blockId ? updated : b));
    this.updateSystemConfig({ sheetBlocks: nextBlocks });
    return updated;
  },

  moveSystemBlockOrder(blockId, dir = 1) {
    const cur = this.state.systemConfig || {};
    const blocks = Array.isArray(cur.sheetBlocks) ? [...cur.sheetBlocks] : [];
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    const tabId = blocks[idx].tabId || 'attrs';
    let swapIdx = idx + (dir < 0 ? -1 : 1);
    while (swapIdx >= 0 && swapIdx < blocks.length && (blocks[swapIdx].tabId || 'attrs') !== tabId) {
      swapIdx += dir < 0 ? -1 : 1;
    }
    if (swapIdx < 0 || swapIdx >= blocks.length) return;
    const tmp = blocks[idx];
    blocks[idx] = blocks[swapIdx];
    blocks[swapIdx] = tmp;
    this.updateSystemConfig({ sheetBlocks: blocks });
  },

  removeSystemBlock(blockId) {
    const cur = this.state.systemConfig || {};
    const blocks = Array.isArray(cur.sheetBlocks) ? cur.sheetBlocks.filter((b) => b.id !== blockId) : null;
    if (!blocks) return;
    this.updateSystemConfig({ sheetBlocks: blocks });
  },

  addSheetStatDef(rawLabel, tabId = 'attrs') {
    const label = String(rawLabel || '').trim();
    const key = Selector.normalizeStatKey(label);
    if (!label || !key) return false;
    const current = Selector.getSheetStatsDef(this.state);
    if (current.some((s) => s.key === key)) return false;
    const targetTab = String(tabId || 'attrs');
    this.state.sheetSchema = [...current, { key, label, alias: key, tabId: targetTab }];
    this.recordEvent('SISTEMA', `Atributo agregado: ${label}`);
    this.notify();
    return true;
  },

  moveSheetStatToTab(key, tabId = 'attrs') {
    const norm = Selector.normalizeStatKey(key);
    const current = Selector.getSheetStatsDef(this.state);
    this.state.sheetSchema = current.map((s) => (s.key === norm ? { ...s, tabId: String(tabId || 'attrs') } : s));
    this.notify();
  },

  removeSheetStatDef(key) {
    const norm = Selector.normalizeStatKey(key);
    const current = Selector.getSheetStatsDef(this.state);
    if (current.length <= 1) return false;
    this.state.sheetSchema = current.filter((s) => s.key !== norm);
    this.notify();
    return true;
  },

  addSystemResourceDef({ name = '', max = 4, color = '#8b5cf6', kind = 'auto', tabId = 'header' } = {}, syncExisting = true) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return null;
    const maxVal = Math.max(0, Math.min(999, Math.trunc(Number(max) || 0)));
    const cur = this.state.systemConfig || {};
    const resourceSchema = Array.isArray(cur.resourceSchema) ? [...cur.resourceSchema] : [];
    const normKey = Selector.normalizeStatKey(cleanName);
    if (resourceSchema.some((r) => Selector.normalizeStatKey(r.name) === normKey)) return null;
    const def = {
      id: `sysres-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      max: maxVal,
      color: String(color || '#8b5cf6'),
      kind: kind === 'bar' || kind === 'pips' ? kind : maxVal > 0 && maxVal <= 6 ? 'pips' : 'bar',
      tabId: String(tabId || 'header')
    };
    resourceSchema.push(def);
    if (syncExisting) {
      (this.state.tokens || []).forEach((tok) => {
        if (!Array.isArray(tok.resources)) tok.resources = [];
        if (!tok.resources.some((r) => Selector.normalizeStatKey(r.name) === normKey)) {
          tok.resources.push({
            id: def.id,
            name: def.name,
            cur: def.max > 0 ? def.max : 0,
            max: def.max,
            color: def.color,
            kind: def.kind
          });
        }
      });
    }
    this.updateSystemConfig({ resourceSchema });
    return def;
  },

  moveSystemResourceToTab(resId, tabId = 'header') {
    const cur = this.state.systemConfig || {};
    const resourceSchema = (cur.resourceSchema || []).map((r) => (r.id === resId ? { ...r, tabId: String(tabId || 'header') } : r));
    this.updateSystemConfig({ resourceSchema });
  },

  removeSystemResourceDef(resId) {
    const cur = this.state.systemConfig || {};
    const resourceSchema = (cur.resourceSchema || []).filter((r) => r.id !== resId);
    this.updateSystemConfig({ resourceSchema });
  },

  addSystemFixedRoll({ label = '', formula = '1d20', tabId = 'attrs' } = {}) {
    const cleanLabel = String(label || '').trim();
    const cleanFormula = String(formula || '').trim() || '1d20';
    if (!cleanLabel) return null;
    const cur = this.state.systemConfig || {};
    const fixedRolls = Array.isArray(cur.fixedRolls) ? [...cur.fixedRolls] : [];
    const created = {
      id: `sysroll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      label: cleanLabel,
      formula: cleanFormula,
      tabId: String(tabId || 'attrs')
    };
    fixedRolls.push(created);
    this.updateSystemConfig({ fixedRolls });
    return created;
  },

  moveSystemFixedRollToTab(rollId, tabId = 'attrs') {
    const cur = this.state.systemConfig || {};
    const fixedRolls = (cur.fixedRolls || []).map((r) => (r.id === rollId ? { ...r, tabId: String(tabId || 'attrs') } : r));
    this.updateSystemConfig({ fixedRolls });
  },

  removeSystemFixedRoll(rollId) {
    const cur = this.state.systemConfig || {};
    const fixedRolls = (cur.fixedRolls || []).filter((r) => r.id !== rollId);
    this.updateSystemConfig({ fixedRolls });
  },

  addSystemStatusDef({ label = '', color = '#8b5cf6', icon = 'mark' } = {}) {
    const cleanLabel = String(label || '').trim();
    const key = Selector.normalizeStatKey(cleanLabel);
    if (!cleanLabel || !key) return null;
    const current = Selector.getSystemStatuses(this.state).map((s) => ({ ...s }));
    if (current.some((s) => s.key === key)) return null;
    const created = { key, label: cleanLabel, color: String(color || '#8b5cf6'), icon: String(icon || 'mark') };
    current.push(created);
    this.updateSystemConfig({ statusesSchema: current });
    return created;
  },

  updateSystemStatusDef(key, patch = {}) {
    const current = Selector.getSystemStatuses(this.state).map((s) => (s.key === key ? { ...s, ...patch } : { ...s }));
    this.updateSystemConfig({ statusesSchema: current });
  },

  removeSystemStatusDef(key) {
    const current = Selector.getSystemStatuses(this.state).map((s) => ({ ...s }));
    if (current.length <= 1) return false;
    const next = current.filter((s) => s.key !== key);
    this.updateSystemConfig({ statusesSchema: next });
    return true;
  },

  resetSystemStatuses() {
    this.updateSystemConfig({ statusesSchema: DEFAULT_STATUS_DEFS.map((d) => ({ ...d })) });
  },

  toggleSystemTrayTool(toolKey) {
    const ALL_DICE = ['4', '6', '8', '10', '12', '20', '30', '100'];
    const cur = Selector.getSystemTrayTools(this.state);
    const key = String(toolKey || '');
    const next = {
      dice: [...cur.dice],
      coin: cur.coin,
      fudge: cur.fudge,
      deck: cur.deck
    };
    if (key === 'coin') {
      next.coin = !next.coin;
    } else if (key === 'fudge') {
      next.fudge = !next.fudge;
    } else if (key === 'deck') {
      next.deck = !next.deck;
    } else if (ALL_DICE.includes(key)) {
      const set = new Set(next.dice);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      next.dice = ALL_DICE.filter((d) => set.has(d));
    } else {
      return false;
    }
    if (next.dice.length === 0 && !next.coin && !next.fudge && !next.deck) return false;
    this.updateSystemConfig({ trayTools: next });
    return true;
  },

  toggleSystemResultMode(modeKey) {
    const ALL_MODES = ['sum', 'each', 'max', 'min', 'success'];
    const key = String(modeKey || '');
    if (!ALL_MODES.includes(key)) return false;
    const cur = Selector.getSystemResultModes(this.state);
    const set = new Set(cur);
    if (set.has(key)) {
      if (set.size <= 1) return false;
      set.delete(key);
    } else {
      set.add(key);
    }
    const next = ALL_MODES.filter((m) => set.has(m));
    this.updateSystemConfig({ resultModes: next });
    if (this.state.dice && !next.includes(this.state.dice.resultMode)) {
      this.state.dice.resultMode = next[0];
    }
    return true;
  },

  updateSystemOutcome(patch = {}) {
    const cur = this.state.systemConfig || {};
    const next = { ...patch };
    if (patch.outcomeLabels && typeof patch.outcomeLabels === 'object') {
      next.outcomeLabels = { ...(cur.outcomeLabels || {}), ...patch.outcomeLabels };
    }
    if (patch.outcomeRule !== undefined && patch.showCrits === undefined && cur.showCrits === undefined) {
      next.showCrits = patch.outcomeRule === 'high' || patch.outcomeRule === 'low';
    }
    this.updateSystemConfig(next);
  },

  rollSheetCheck(tok, label, statBonus = 0, customFormula = '', rollOpts = {}) {
    const cfg = this.state.systemConfig || SYSTEM_PRESETS.dnd55;
    const val = Math.trunc(Number(statBonus) || 0);
    const dieSides = Number(rollOpts?.dieSides) || 0;
    const raw = customFormula
      ? String(customFormula)
      : dieSides > 0
        ? (val !== 0 ? `1d${dieSides}${val >= 0 ? `+${val}` : val}` : `1d${dieSides}`)
        : String(cfg.rollFormula || '1d20+@stat');
    const outcome = Selector.getSystemOutcomeConfig(this.state);
    const usesRollUnderTarget = outcome.outcomeRule === 'low' && !/@stat\b/i.test(raw) && dieSides <= 0;
    const resolved = raw
      .replace(/\+\s*@stat(?![a-z0-9_])/gi, val >= 0 ? `+${val}` : String(val))
      .replace(/@stat(?=d\d+)|@stat(?![a-z0-9_])/gi, String(val))
      .replace(/\+\-/g, '-');
    const effMode = rollOpts?.resultMode && rollOpts.resultMode !== 'inherit'
      ? rollOpts.resultMode
      : (cfg.resultMode || 'inherit');
    const effThr = Number(rollOpts?.successThreshold) || cfg.successThreshold || 6;
    return this.rollFormula(resolved, tok, label, '', {
      resultMode: effMode,
      successThreshold: effThr,
      target: usesRollUnderTarget ? val : undefined
    });
  },

  announceSheetBlock(tok, title, body = '') {
    const cleanTitle = String(title || 'Rasgo').trim() || 'Rasgo';
    const cleanBody = String(body || '').trim();
    const casterName = tok ? tok.name : '';
    this.state.activeRollRequest = null;
    this.state.activeSequence = {
      id: `ann-${Date.now().toString(36)}`,
      tokenId: tok ? tok.id : '',
      casterName,
      itemName: cleanTitle,
      itemKind: 'ability',
      itemIcon: 'sparkle',
      itemColor: tok ? (tok.color || '#8b5cf6') : '#8b5cf6',
      itemMessage: cleanBody || cleanTitle,
      steps: [],
      currentIndex: -1,
      mode: 'info',
      stepMessage: cleanBody || cleanTitle,
      areaConfirmed: false,
      targetTokenIds: [],
      stepResults: {},
      saveResults: {},
      selectedDamageStep: null,
      lastDamageTotal: 0
    };
    this.recordEvent('FICHA', `${casterName ? `${casterName} · ` : ''}${cleanTitle}${cleanBody ? `: ${cleanBody}` : ''}`);
    this.notify({ skipVaultSave: true });
  }
};
