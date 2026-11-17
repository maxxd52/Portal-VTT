/* ==========================================================================
   SEQUENCE SERVICE: SECUENCIAS DE ACCIONES, ÁREAS Y SOLICITUDES DE TIRADA
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261116z39';
import { RealtimeBridge } from './realtimeBridge.js';

export const SequenceServiceMethods = {
  startItemSequence(tokenId, invItem) {
    const normalized = Selector.normalizeItemSchema(invItem);
    const steps = normalized.steps || [];
    const itemMessage = String(normalized.message || invItem.message || '').trim();
    if (steps.length === 0 && !itemMessage) return false;

    const caster = (this.state.tokens || []).find((t) => t.id === tokenId) || null;
    this.state.activeRollRequest = null;
    this.state.activeSequence = {
      id: `seq-${Date.now().toString(36)}`,
      tokenId,
      casterName: caster ? caster.name : '',
      itemName: invItem.name || 'Complemento',
      itemMessage,
      steps,
      currentIndex: steps.length > 0 ? 0 : -1,
      mode: steps.length > 0 ? steps[0].type : 'info',
      stepMessage: itemMessage,
      areaConfirmed: false,
      targetTokenIds: this.state.selectedTokenId && this.state.selectedTokenId !== tokenId
        ? [this.state.selectedTokenId]
        : [],
      stepResults: {},
      saveResults: {},
      selectedDamageStep: null,
      lastDamageTotal: 0
    };

    if (steps.length === 0) {
      if (itemMessage) {
        this.recordEvent('USAR_OBJETO', `${caster ? caster.name + ' · ' : ''}${invItem.name}: ${itemMessage}`);
      }
      this.notify({ skipVaultSave: true });
      return true;
    }

    this.executeSequenceStep(0);
    return true;
  },

  executeSequenceStep(stepIndex) {
    const seq = this.state.activeSequence;
    if (!seq || !Array.isArray(seq.steps) || !seq.steps[stepIndex]) return;
    seq.currentIndex = stepIndex;
    const step = seq.steps[stepIndex];
    const caster = (this.state.tokens || []).find((t) => t.id === seq.tokenId) || null;
    const casterPrefix = caster ? `${caster.name} · ` : '';
    const stepMsg = String(step.message || seq.itemMessage || '').trim();
    seq.stepMessage = stepMsg;
    seq.mode = step.type;

    if (step.type === 'roll') {
      const roll = this.rollFormula(
        step.formula || '1d20',
        caster,
        `${casterPrefix}${step.label || seq.itemName}`,
        stepMsg,
        {
          resultMode: step.resultMode || 'inherit',
          successThreshold: Number(step.successThreshold) || 6
        }
      );
      if (roll) {
        const totalVal = Math.max(0, Number(roll.total) || 0);
        if (!seq.stepResults) seq.stepResults = {};
        seq.stepResults[stepIndex] = {
          stepIndex,
          label: step.label || seq.itemName,
          total: totalVal
        };
        if (step.isDamage !== false && step.allowHpAction !== false) {
          seq.selectedDamageStep = stepIndex;
          seq.lastDamageTotal = totalVal;
          if (this.state.activeRollRequest) {
            this.state.activeRollRequest.damageTotal = totalVal;
          }
        }
      }
      this.notify({ skipVaultSave: true });
      return;
    }

    if (step.type === 'area') {
      const cs = this.state.grid?.cellSize || 80;
      const shape = step.shape || 'circle';
      seq.areaConfirmed = false;
      this.state.tool = 'areaSelect';
      this.state.rulerShape = shape;

      if (shape === 'targets') {
        const maxTargets = Math.max(1, Math.round(Number(step.maxTargets ?? step.radiusCells) || 3));
        seq.targetTokenIds = [];
        this.state.ruler = null;
        this.state.areaSelectConfig = {
          shape: 'targets',
          maxTargets,
          radiusCells: maxTargets,
          radiusPx: 0,
          angle: 0,
          label: step.label || 'Objetivos',
          stepIndex
        };
        this.notify({ skipVaultSave: true });
        return;
      }

      const radiusCells = Math.max(0.5, Number(step.radiusCells) || 2);
      const radiusPx = radiusCells * cs;
      const angle = 0;
      this.state.areaSelectConfig = {
        shape,
        radiusCells,
        radiusPx,
        angle,
        label: step.label || 'Área',
        stepIndex
      };
      const originX = caster
        ? caster.x
        : ((typeof window !== 'undefined' ? window.innerWidth / 2 : 500) - (this.state.camera?.x || 0)) / (this.state.camera?.zoom || 1);
      const originY = caster
        ? caster.y
        : ((typeof window !== 'undefined' ? window.innerHeight / 2 : 400) - (this.state.camera?.y || 0)) / (this.state.camera?.zoom || 1);
      this.state.ruler = {
        x1: originX,
        y1: originY,
        x2: originX + Math.cos(angle) * radiusPx,
        y2: originY + Math.sin(angle) * radiusPx
      };
      this.notify({ skipVaultSave: true });
      return;
    }

    if (step.type === 'save_request') {
      const fallbackTargets = this.state.selectedTokenId ? [this.state.selectedTokenId] : [];
      const targetIds = seq.targetTokenIds.length > 0 ? seq.targetTokenIds : fallbackTargets;
      const statKey = Selector.normalizeStatKey(step.statKey || 'dex') || 'dex';
      const statDef = Selector.getSheetStatsDef(this.state, caster).find(
        (s) => s.key === statKey || s.alias === statKey
      );
      const statLabel = statDef ? statDef.label : statKey.toUpperCase();
      const formula = step.formula || `1d20+@${statDef ? statDef.alias : statKey}`;
      this.sendRollRequest({
        label: step.label || `Salvación de ${statLabel}`,
        statKey,
        formula,
        dc: Number(step.dc) || 0,
        targetTokenIds: targetIds,
        damageTotal: seq.lastDamageTotal || 0
      });
      return;
    }

    if (step.type === 'apply_hp') {
      seq.mode = 'apply_hp';
      this.notify({ skipVaultSave: true });
      return;
    }
  },

  updateAreaSelectConfig(patch = {}) {
    const cfg = this.state.areaSelectConfig;
    if (!cfg) return;
    const cs = this.state.grid?.cellSize || 80;
    if (patch.shape) {
      cfg.shape = patch.shape;
      this.state.rulerShape = patch.shape;
    }
    if (patch.maxTargets !== undefined) {
      cfg.maxTargets = Math.max(1, Math.min(20, Math.round(Number(patch.maxTargets) || 1)));
      cfg.radiusCells = cfg.maxTargets;
    }
    if (patch.radiusCells !== undefined && cfg.shape !== 'targets') {
      cfg.radiusCells = Math.max(0.5, Math.min(20, Number(patch.radiusCells) || 2));
      cfg.radiusPx = cfg.radiusCells * cs;
    }
    if (patch.angle !== undefined) {
      cfg.angle = Number(patch.angle) || 0;
    }
    if (this.state.ruler) {
      const ang = cfg.angle || 0;
      this.state.ruler.x2 = this.state.ruler.x1 + Math.cos(ang) * cfg.radiusPx;
      this.state.ruler.y2 = this.state.ruler.y1 + Math.sin(ang) * cfg.radiusPx;
    }
    this.notify({ skipVaultSave: true });
  },

  confirmAreaSelection(areaSpecOrX, wy, radiusPx) {
    const cfg = this.state.areaSelectConfig;
    const spec = typeof areaSpecOrX === 'object' && areaSpecOrX !== null
      ? areaSpecOrX
      : {
          shape: cfg?.shape || 'circle',
          x1: areaSpecOrX,
          y1: wy,
          x2: areaSpecOrX + Math.cos(cfg?.angle || 0) * (radiusPx || cfg?.radiusPx || 160),
          y2: wy + Math.sin(cfg?.angle || 0) * (radiusPx || cfg?.radiusPx || 160),
          radiusPx: radiusPx || cfg?.radiusPx || 160
        };
    const hits = Selector.getTokensInArea(this.state, spec);

    if (this.state.activeSequence) {
      this.state.activeSequence.targetTokenIds = hits.map((t) => t.id);
      this.state.activeSequence.areaConfirmed = true;
      this.state.activeSequence.mode = 'area';
    }
    this.state.tool = 'select';
    this.state.areaSelectConfig = null;
    this.state.ruler = null;
    this.notify({ skipVaultSave: true });
  },

  toggleTargetPick(tokenId) {
    const seq = this.state.activeSequence;
    const cfg = this.state.areaSelectConfig;
    if (!seq || !tokenId) return;
    const idx = seq.targetTokenIds.indexOf(tokenId);
    if (idx >= 0) {
      seq.targetTokenIds.splice(idx, 1);
      this.notify({ skipVaultSave: true });
      return;
    }
    const max = cfg?.maxTargets || 20;
    if (seq.targetTokenIds.length >= max) return;
    seq.targetTokenIds.push(tokenId);
    if (seq.targetTokenIds.length >= max) {
      this.finishTargetSelection();
    } else {
      this.notify({ skipVaultSave: true });
    }
  },

  finishTargetSelection() {
    if (this.state.activeSequence) {
      this.state.activeSequence.areaConfirmed = true;
      this.state.activeSequence.mode = 'area';
    }
    this.state.tool = 'select';
    this.state.areaSelectConfig = null;
    this.state.ruler = null;
    this.notify({ skipVaultSave: true });
  },

  toggleSequenceTarget(tokenId) {
    const seq = this.state.activeSequence;
    if (!seq || !tokenId) return;
    const idx = seq.targetTokenIds.indexOf(tokenId);
    if (idx >= 0) seq.targetTokenIds.splice(idx, 1);
    else seq.targetTokenIds.push(tokenId);
    this.notify({ skipVaultSave: true });
  },

  selectSequenceDamageStep(stepIndex) {
    const seq = this.state.activeSequence;
    const entry = seq?.stepResults?.[stepIndex];
    if (!seq || !entry) return;
    seq.selectedDamageStep = stepIndex;
    seq.lastDamageTotal = entry.total;
    if (this.state.activeRollRequest) {
      this.state.activeRollRequest.damageTotal = entry.total;
    }
    this.notify({ skipVaultSave: true });
  },

  clearActiveSequence() {
    this.state.activeSequence = null;
    this.state.areaSelectConfig = null;
    this.state.activeRollRequest = null;
    if (this.state.tool === 'areaSelect') {
      this.state.tool = 'select';
      this.state.ruler = null;
    }
    this.notify({ skipVaultSave: true });
  },

  sendRollRequest({ label, statKey, formula, dc = 0, targetTokenIds = [], damageTotal = 0 }) {
    const targets = targetTokenIds
      .map((id) => (this.state.tokens || []).find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => ({ id: t.id, name: t.name }));

    const req = {
      requestId: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: this.clientId,
      label: String(label || 'Tirada solicitada'),
      statKey: String(statKey || ''),
      formula: String(formula || '1d20'),
      dc: Number(dc) || 0,
      damageTotal: Number(damageTotal) || 0,
      targets
    };

    this.state.activeRollRequest = {
      ...req,
      responses: {}
    };

    RealtimeBridge.send({ kind: 'ROLL_REQUEST', request: req });
    this.recordEvent('SOLICITUD_TIRADA', `${req.label}${req.dc ? ` (CD ${req.dc})` : ''} → ${targets.map((t) => t.name).join(', ') || 'Mesa'}`);
    this.notify({ skipVaultSave: true });
  },

  receiveRollRequest(req) {
    if (!req || !req.requestId) return;
    if (req.senderId === this.clientId) return;
    const allTokens = this.state.tokens || [];
    const controllableTargets = (req.targets || []).filter((tgt) => {
      const tok = allTokens.find((t) => t.id === tgt.id);
      return tok && this.canControlToken(tok);
    });
    if (controllableTargets.length === 0) return;

    const queue = Array.isArray(this.state.pendingRollRequests) ? [...this.state.pendingRollRequests] : [];
    controllableTargets.forEach((tgt) => {
      if (!queue.some((q) => q.requestId === req.requestId && q.tokenId === tgt.id)) {
        queue.push({
          requestId: req.requestId,
          tokenId: tgt.id,
          tokenName: tgt.name,
          label: req.label,
          formula: req.formula,
          dc: req.dc || 0
        });
      }
    });
    this.state.pendingRollRequests = queue;
    this.notify({ skipVaultSave: true });
  },

  respondToRollRequest(requestId, tokenId) {
    const queue = Array.isArray(this.state.pendingRollRequests) ? this.state.pendingRollRequests : [];
    const idx = queue.findIndex((q) => q.requestId === requestId && q.tokenId === tokenId);
    if (idx < 0) return;
    const item = queue[idx];
    const tok = (this.state.tokens || []).find((t) => t.id === tokenId) || null;
    this.state.activeSequence = null;
    const roll = this.rollFormula(item.formula, tok, `${item.tokenName} · ${item.label}`);
    this.state.pendingRollRequests = queue.filter((_, i) => i !== idx);

    const resp = {
      requestId,
      tokenId,
      tokenName: item.tokenName,
      total: roll ? Number(roll.total) || 0 : 0,
      isCrit: roll ? roll.chosen === roll.sides : false,
      isFumble: roll ? roll.chosen === 1 : false
    };
    RealtimeBridge.send({ kind: 'ROLL_RESPONSE', response: resp });
    this.receiveRollResponse(resp);
  },

  dismissRollRequest(requestId, tokenId) {
    this.state.pendingRollRequests = (this.state.pendingRollRequests || []).filter(
      (q) => !(q.requestId === requestId && q.tokenId === tokenId)
    );
    this.notify({ skipVaultSave: true });
  },

  clearActiveRollRequest() {
    this.state.activeRollRequest = null;
    this.notify({ skipVaultSave: true });
  },

  receiveRollResponse(resp) {
    if (!resp || !resp.requestId) return;
    const active = this.state.activeRollRequest;
    if (!active || active.requestId !== resp.requestId) return;
    active.responses = { ...(active.responses || {}), [resp.tokenId]: resp };
    if (this.state.activeSequence) {
      if (!this.state.activeSequence.saveResults) this.state.activeSequence.saveResults = {};
      this.state.activeSequence.saveResults[resp.tokenId] = {
        ...resp,
        dc: active.dc || 0
      };
    }
    this.notify({ skipVaultSave: true });
  },

  applySequenceConditionToToken(tokenId, condKey) {
    if (!tokenId || !condKey) return;
    this.toggleTokenCondition(tokenId, condKey);
  },

  applySequenceHpToAll(tokenIds, amount, mode = 'full') {
    if (!Array.isArray(tokenIds)) return;
    tokenIds.forEach((tid) => this.applySequenceHpToToken(tid, amount, mode));
  },

  applySequenceConditionToAll(tokenIds, condKey) {
    if (!Array.isArray(tokenIds) || !condKey) return;
    const tokens = tokenIds
      .map((id) => (this.state.tokens || []).find((t) => t.id === id))
      .filter(Boolean);
    const allHave = tokens.length > 0 && tokens.every((t) => Array.isArray(t.conditions) && t.conditions.includes(condKey));
    tokens.forEach((t) => {
      const has = Array.isArray(t.conditions) && t.conditions.includes(condKey);
      if (allHave || !has) this.toggleTokenCondition(t.id, condKey);
    });
  },

  applySequenceBonusToBar(amount) {
    const delta = Number(amount) || 0;
    if (delta === 0) return;
    if (!this.state.dice) return;
    this.state.dice.modifier = (Number(this.state.dice.modifier) || 0) + delta;
    this.recordEvent('BONO_BARRA', `Bono aplicado a la barra: ${delta >= 0 ? '+' : ''}${delta}`);
    this.notify({ skipVaultSave: true });
  },

  applySequenceHpToToken(tokenId, amount, mode = 'full') {
    const raw = Math.abs(Number(amount) || 0);
    if (raw <= 0 || !tokenId) return;
    let delta = -raw;
    if (mode === 'half') delta = -Math.floor(raw / 2);
    else if (mode === 'heal') delta = raw;
    if (delta !== 0) {
      this.adjustTokenHp(tokenId, delta);
    }
  }
};
