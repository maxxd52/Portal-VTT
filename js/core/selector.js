/* ==========================================================================
   SELECTOR: CONSULTAS PURAS DE COORDENADAS, RAYCASTING 2D Y SERIALIZACIÓN
   ========================================================================== */

import { DEFAULT_SHEET_SCHEMA, DEFAULT_STATUS_DEFS } from './model.js?v=20261123a7';
import { createDefaultGmScreen } from '../data/gmScreenPresets.js?v=20261123a7';
import { normalizeGridConfig, snapToGrid } from '../utils/gridGeometry.js?v=20261123a7';
import { normalizeWeatherType } from '../utils/weatherEngine.js?v=20261123a7';
import {
  castVisibilityRay,
  collectUniqueRayAngles,
  findWallNearPoint,
  isWallBlockingSight,
  isWallOpenDoor,
  redactWallsForPlayer
} from '../utils/wallGeometry.js?v=20261123a7';
import {
  normalizeSceneLighting,
  normalizeVisionConfig,
  resolveTokenVisionMeters,
  resolveTokenLightMeters,
  metersToPixels
} from '../utils/lightingModel.js?v=20261123a7';
import {
  canSeatSeeJournalBlock,
  collectPlayerAuthorizedMedia,
  collectReferencedMediaIds,
  filterVisibleMapNotes,
  getSeatAllowedTokenIds,
  hashMediaSource,
  normalizeMediaAssets,
  redactCombatForSeat,
  redactTokenForNonOwner
} from '../utils/worldRedaction.js?v=20261123a7';

export const Selector = {
  normalizeStatKey(raw) {
    return String(raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  },

  getSheetStatsDef(state, tok = null) {
    const blocks = state?.systemConfig?.sheetBlocks;
    if (Array.isArray(blocks)) {
      return blocks
        .filter((b) => b && b.kind === 'number')
        .map((b) => {
          const key = this.normalizeStatKey(b.key || b.label) || 'stat';
          return {
            key,
            label: String(b.label || key).trim() || key,
            alias: key,
            tabId: String(b.tabId || 'attrs')
          };
        });
    }
    const base = Array.isArray(state?.sheetSchema) && state.sheetSchema.length > 0
      ? state.sheetSchema
      : DEFAULT_SHEET_SCHEMA;
    const seen = new Set();
    const out = [];
    for (const entry of base) {
      const key = this.normalizeStatKey(entry?.key || entry?.label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const label = String(entry?.label || key).trim() || key.toUpperCase();
      const alias = this.normalizeStatKey(entry?.alias || label) || key;
      const tabId = String(entry?.tabId || 'attrs');
      out.push({ key, label, alias, tabId });
    }
    if (tok && tok.stats && typeof tok.stats === 'object') {
      const isDndPreset = (state?.systemConfig?.preset || state?.ruleset || 'dnd55') === 'dnd55';
      const coreDndKeys = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
      for (const rawKey of Object.keys(tok.stats)) {
        const key = this.normalizeStatKey(rawKey);
        if (!key || seen.has(key)) continue;
        if (!isDndPreset && coreDndKeys.has(key) && Number(tok.stats[rawKey]) === 0) continue;
        seen.add(key);
        const label = rawKey.length <= 4 ? rawKey.toUpperCase() : rawKey;
        out.push({ key, label, alias: key, tabId: 'attrs' });
      }
    }
    return out;
  },

  getSystemSheetTabs(state) {
    const cfg = state?.systemConfig || {};
    if (Array.isArray(cfg.sheetTabs) && cfg.sheetTabs.length > 0) {
      return cfg.sheetTabs
        .map((t) => ({
          id: String(t?.id || '').trim(),
          label: String(t?.label || '').trim() || 'Pestaña',
          mode: t?.mode === 'items' ? 'items' : 'fixed',
          sumTotal: Boolean(t?.sumTotal)
        }))
        .filter((t) => t.id);
    }
    const enabled = cfg.enabledTabs || { skills: true, traits: true, inventory: true };
    const customTabs = Array.isArray(cfg.customTabs) ? cfg.customTabs : [];
    const list = [{ id: 'attrs', label: 'Atributos', mode: 'fixed', sumTotal: false }];
    customTabs.forEach((ct) =>
      list.push({
        id: ct.id,
        label: ct.label,
        mode: ct.mode === 'items' ? 'items' : 'fixed',
        sumTotal: Boolean(ct.sumTotal)
      })
    );
    if (enabled.skills !== false) list.push({ id: 'skills', label: 'Habilidades', mode: 'preset_skills' });
    if (enabled.traits !== false) list.push({ id: 'traits', label: 'Rasgos', mode: 'preset_traits' });
    if (enabled.inventory !== false) {
      list.push(
        { id: 'equipment', label: 'Equipo', mode: 'items' },
        { id: 'consumable', label: 'Consum.', mode: 'items' },
        { id: 'ability', label: 'Capac.', mode: 'items' }
      );
    }
    return list;
  },

  getSystemItemTabs(state) {
    return this.getSystemSheetTabs(state).filter((t) => t.mode === 'items');
  },

  resolveItemTabId(state, rawKind) {
    const itemTabs = this.getSystemItemTabs(state);
    if (!itemTabs.length) return 'equipment';
    const k = String(rawKind || '').trim();
    if (itemTabs.some((t) => t.id === k)) return k;
    const legacy = k === 'consumable' ? 'consumable' : k === 'ability' || k === 'spell' ? 'ability' : 'equipment';
    if (itemTabs.some((t) => t.id === legacy)) return legacy;
    return itemTabs[0].id;
  },

  normalizeSheetBlock(blk) {
    if (!blk || typeof blk !== 'object') return null;
    if (blk.kind === 'roll') {
      return {
        ...blk,
        kind: 'text',
        textMode: 'fixed',
        fixedText: String(blk.fixedText || ''),
        clickAction: 'roll',
        formula: String(blk.formula || '1d20'),
        resultMode: blk.resultMode || 'inherit',
        successThreshold: Number(blk.successThreshold) || 6,
        isInitiative: blk.isInitiative !== undefined ? Boolean(blk.isInitiative) : blk.key === 'init'
      };
    }
    if (blk.kind === 'number') {
      const valueMode = ['manual', 'calc', 'die'].includes(blk.valueMode) ? blk.valueMode : 'manual';
      const rollMode = ['none', 'base', 'custom'].includes(blk.rollMode) ? blk.rollMode : 'base';
      return {
        ...blk,
        valueMode,
        rollMode,
        hideValue: Boolean(blk.hideValue),
        showSign: Boolean(blk.showSign),
        suffix: String(blk.suffix || ''),
        hasCheck: Boolean(blk.hasCheck),
        checkBonus: Number(blk.checkBonus) || 0,
        resultMode: blk.resultMode || 'inherit',
        successThreshold: Number(blk.successThreshold) || 6,
        isInitiative: Boolean(blk.isInitiative)
      };
    }
    if (blk.kind === 'resource') {
      const maxMode = ['fixed', 'free', 'calc'].includes(blk.maxMode)
        ? blk.maxMode
        : (Number(blk.max) || 0) === 0
          ? 'free'
          : 'fixed';
      const resStyle = ['auto', 'bar', 'pips', 'counter'].includes(blk.resStyle) ? blk.resStyle : 'auto';
      return {
        ...blk,
        maxMode,
        maxFormula: String(blk.maxFormula || ''),
        editableMax: blk.editableMax !== undefined ? Boolean(blk.editableMax) : blk.key === 'hp',
        resStyle,
        rollMode: blk.rollMode === 'custom' ? 'custom' : 'none',
        formula: String(blk.formula || ''),
        resultMode: blk.resultMode || 'inherit',
        successThreshold: Number(blk.successThreshold) || 6,
        consumeOnRoll: Boolean(blk.consumeOnRoll)
      };
    }
    const textMode = ['input', 'fixed', 'select', 'tags'].includes(blk.textMode) ? blk.textMode : 'input';
    const clickAction = ['none', 'roll', 'announce'].includes(blk.clickAction) ? blk.clickAction : 'none';
    return {
      ...blk,
      kind: 'text',
      textMode,
      fixedText: String(blk.fixedText || ''),
      options: Array.isArray(blk.options) ? blk.options.map((o) => String(o).trim()).filter(Boolean) : [],
      clickAction,
      formula: String(blk.formula || ''),
      resultMode: blk.resultMode || 'inherit',
      successThreshold: Number(blk.successThreshold) || 6,
      isInitiative: Boolean(blk.isInitiative)
    };
  },

  getSystemSheetBlocks(state) {
    const blocks = state?.systemConfig?.sheetBlocks;
    return Array.isArray(blocks) ? blocks.map((b) => this.normalizeSheetBlock(b)).filter(Boolean) : [];
  },

  resolveBlockSize(block) {
    const valid = new Set(['1/3', '1/2', '2/3', '1/1']);
    if (block?.size && valid.has(block.size)) return block.size;
    if (block?.size === 'full' || block?.span === 3) return '1/1';
    if (block?.span === 2) return '2/3';
    if (block?.span === 1) return '1/3';
    if (block?.kind === 'resource') return '1/2';
    if (block?.kind === 'text') return '1/1';
    return '1/3';
  },

  resolveBlockGridSpan(block) {
    const size = this.resolveBlockSize(block);
    if (size === '1/1') return 6;
    if (size === '2/3') return 4;
    if (size === '1/2') return 3;
    return 2;
  },

  getSystemStatuses(state) {
    const custom = state?.systemConfig?.statusesSchema;
    const legacy = state?.systemStatuses || {};
    if (Array.isArray(custom) && custom.length > 0) {
      return custom
        .map((s) => {
          const key = this.normalizeStatKey(s?.key || s?.label);
          if (!key) return null;
          return {
            key,
            label: String(s?.label || key).trim() || key,
            color: String(s?.color || '#8b5cf6'),
            icon: String(s?.icon || 'mark')
          };
        })
        .filter(Boolean);
    }
    return DEFAULT_STATUS_DEFS.map((d) => ({
      ...d,
      label: legacy[d.key] ? String(legacy[d.key]) : d.label
    }));
  },

  getStatusDef(state, key) {
    const cleanKey = String(key || '').trim();
    const list = this.getSystemStatuses(state);
    const found = list.find((s) => s.key === cleanKey);
    if (found) return found;
    const fallback = DEFAULT_STATUS_DEFS.find((d) => d.key === cleanKey);
    if (fallback) return fallback;
    const legacyLabel = state?.systemStatuses?.[cleanKey];
    return {
      key: cleanKey || 'mark',
      label: legacyLabel || cleanKey || 'Estado',
      color: '#8b5cf6',
      icon: 'mark'
    };
  },

  normalizeItemSchema(item) {
    if (!item || typeof item !== 'object') return { passives: [], message: '', steps: [] };
    const passives = Array.isArray(item.passives)
      ? item.passives.map((p) => ({
          target: String(p.target || 'ac'),
          value: Number(p.value) || 0
        }))
      : [];
    if (!Array.isArray(item.passives)) {
      const legacyTarget = item.statTarget || (item.acBonus ? 'ac' : '');
      const legacyVal = item.statBonus !== undefined ? Number(item.statBonus) || 0 : Number(item.acBonus) || 0;
      if (legacyTarget && legacyVal !== 0) {
        passives.push({ target: legacyTarget, value: legacyVal });
      }
    }

    let message = String(item.message || '').trim();
    if (Array.isArray(item.steps) && item.steps.length > 0) {
      const textParts = [];
      const actionSteps = [];
      item.steps.forEach((s) => {
        if (!s || typeof s !== 'object') return;
        if (s.type === 'text') {
          const t = String(s.text || '').trim();
          if (t) textParts.push(t);
          return;
        }
        if (s.type === 'save_request') {
          actionSteps.push({ ...s, type: 'roll', rollKind: 'request' });
          return;
        }
        if (s.type === 'roll') {
          const rollKind = s.rollKind === 'request' ? 'request' : s.rollKind === 'opposed' ? 'opposed' : 'self';
          actionSteps.push({ ...s, type: 'roll', rollKind });
          return;
        }
        if (s.type === 'area' || s.type === 'targets') {
          actionSteps.push({ ...s, type: 'targets', shape: s.shape || 'circle' });
          return;
        }
        if (s.type === 'apply_hp' || s.type === 'modify') {
          if (s.effectMode === 'passive') {
            const target = String(s.passiveTarget || s.target || 'ac');
            const value = Number(s.passiveValue ?? s.value) || 0;
            if (!passives.some((p) => p.target === target && p.value === value)) {
              passives.push({ target, value });
            }
            return;
          }
          actionSteps.push({
            ...s,
            type: 'modify',
            effectMode: s.effectMode || (s.isHeal ? 'heal' : 'damage'),
            targetScope: s.targetScope === 'self' ? 'self' : 'targets',
            resourceKey: String(s.resourceKey || 'hp')
          });
          return;
        }
        actionSteps.push({ ...s });
      });
      if (!message && textParts.length > 0) message = textParts.join('\n');
      return { passives, message, steps: actionSteps };
    }

    const steps = [];
    const formula = String(item.formula || '').trim();
    const heal = Number(item.heal) || 0;
    const die = Number(item.die) || 0;
    const mod = Number(item.bonusMod) || 0;

    if (formula) {
      steps.push({
        type: 'roll',
        rollKind: 'self',
        label: item.name || 'Tirada',
        formula,
        message,
        allowHpAction: item.kind !== 'consumable',
        isHeal: item.kind === 'consumable'
      });
    } else if (die > 0) {
      const modStr = mod === 0 ? '' : mod > 0 ? `+${mod}` : String(mod);
      steps.push({
        type: 'roll',
        rollKind: 'self',
        label: item.name || 'Tirada',
        formula: `1d${die}${modStr}`,
        message,
        allowHpAction: item.kind !== 'consumable',
        isHeal: item.kind === 'consumable' && heal > 0
      });
    }
    return { passives, message, steps };
  },
  screenToWorld(state, clientX, clientY) {
    return {
      x: (clientX - state.camera.x) / state.camera.zoom,
      y: (clientY - state.camera.y) / state.camera.zoom
    };
  },

  snapPosition(state, wx, wy, sizeCells = 1) {
    return snapToGrid(state?.grid, wx, wy, sizeCells);
  },

  getSelectedToken(state) {
    return state.tokens.find((t) => t.id === state.selectedTokenId) || null;
  },

  distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  },

  getTokensInArea(state, area) {
    if (!area || !state) return [];
    const cs = Number(state.grid?.cellSize) || 80;
    const shape = area.shape || 'circle';
    const numOr = (v, fb) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fb);
    const x1 = numOr(area.x1, 0);
    const y1 = numOr(area.y1, 0);
    const x2 = numOr(area.x2, x1);
    const y2 = numOr(area.y2, y1);
    const radiusPx = Math.max(1, Number(area.radiusPx) || Math.hypot(x2 - x1, y2 - y1) || cs);
    const coneAng = Math.atan2(y2 - y1, x2 - x1);

    return (state.tokens || []).filter((t) => {
      if (t.hidden && state.role !== 'gm') return false;
      const tokHalf = ((Number(t.size) || 1) * cs) / 2;

      if (shape === 'cube') {
        const halfSide = radiusPx / 2;
        return (
          Math.abs(t.x - x1) <= halfSide + tokHalf * 0.5 &&
          Math.abs(t.y - y1) <= halfSide + tokHalf * 0.5
        );
      }
      if (shape === 'line') {
        const halfW = cs * 0.5 + tokHalf * 0.45;
        return this.distToSegment(t.x, t.y, x1, y1, x2, y2) <= halfW;
      }
      if (shape === 'cone') {
        const d = Math.hypot(t.x - x1, t.y - y1);
        if (d > radiusPx + tokHalf * 0.5) return false;
        if (d <= tokHalf * 0.65) return true;
        let diff = Math.atan2(t.y - y1, t.x - x1) - coneAng;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const tol = 0.46 + Math.atan2(tokHalf * 0.5, d);
        return Math.abs(diff) <= tol;
      }
      return Math.hypot(t.x - x1, t.y - y1) <= radiusPx + tokHalf * 0.6;
    });
  },

  findDoorNearPoint(state, wx, wy, maxDist = 22) {
    const allowedKinds = state?.role === 'gm' ? ['door', 'secret'] : ['door'];
    return findWallNearPoint(state?.walls || [], wx, wy, maxDist, { kinds: allowedKinds });
  },

  // Raycasting 2D: calcula el polígono de visibilidad alrededor de (ox, oy) hasta radius
  computeVisibilityPolygon(origin, radius, walls) {
    const ox = origin.x;
    const oy = origin.y;
    const R = Math.max(16, Number(radius) || 520);
    const minX = ox - R;
    const maxX = ox + R;
    const minY = oy - R;
    const maxY = oy + R;

    // Segmentos activos (muros sólidos, terrenos/pilares, puertas cerradas + caja delimitadora)
    const segments = [
      { x1: minX, y1: minY, x2: maxX, y2: minY, kind: 'wall' },
      { x1: maxX, y1: minY, x2: maxX, y2: maxY, kind: 'wall' },
      { x1: maxX, y1: maxY, x2: minX, y2: maxY, kind: 'wall' },
      { x1: minX, y1: maxY, x2: minX, y2: minY, kind: 'wall' }
    ];

    for (const w of walls || []) {
      if (!isWallBlockingSight(w)) continue;
      if (Math.max(w.x1, w.x2) < minX || Math.min(w.x1, w.x2) > maxX) continue;
      if (Math.max(w.y1, w.y2) < minY || Math.min(w.y1, w.y2) > maxY) continue;
      segments.push(w);
    }

    // Recolectar ángulos únicos deduplicados hacia vértices compartidos (±eps)
    const angles = collectUniqueRayAngles(ox, oy, segments, 0.00015);
    const maxT = R * 1.45;
    const hits = [];
    for (let i = 0; i < angles.length; i++) {
      const angle = angles[i];
      const hit = castVisibilityRay(ox, oy, Math.cos(angle), Math.sin(angle), maxT, segments);
      hits.push({ angle, x: hit.x, y: hit.y });
    }

    hits.sort((a, b) => a.angle - b.angle);
    return hits;
  },

  isPointInPolygon(pt, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect =
        yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  },

  getSystemVisionConfig(state) {
    return normalizeVisionConfig(state?.systemConfig?.vision || {});
  },

  getSceneLightingConfig(state, sceneKey) {
    const key = sceneKey || state?.activeMapKey || state?.mapId || 'bastion';
    const visCfg = this.getSystemVisionConfig(state);
    return normalizeSceneLighting(state?.sceneLighting?.[key], {
      dynamicLighting: state?.dynamicLighting ?? true,
      rememberExplored: visCfg.rememberExplored
    });
  },

  getAlliedVisibilityPolygons(state, seatKey = '') {
    const visionCfg = this.getSystemVisionConfig(state);
    const grid = normalizeGridConfig(state?.grid);
    let viewers = (state?.tokens || []).filter((t) => !t.hidden && t.isAlly !== false);

    if (visionCfg.visionMode === 'individual' && (seatKey || state?.role === 'player')) {
      const assignedIds = seatKey ? getSeatAllowedTokenIds(state, seatKey) : this.getPlayerAssignedTokenIds(state);
      if (assignedIds.length > 0) {
        const assignedSet = new Set(assignedIds);
        viewers = viewers.filter((t) => assignedSet.has(t.id));
      }
    }

    const walls = Array.isArray(state?.walls) ? state.walls : [];
    let wallsSig = `${walls.length}`;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (!isWallBlockingSight(w)) continue;
      wallsSig += `|${w.x1},${w.y1},${w.x2},${w.y2},${w.kind === 'terrain' ? 't' : 's'}`;
    }
    if (!this._visPolyCache) this._visPolyCache = new Map();
    if (this._visPolyCacheWallsSig !== wallsSig) {
      this._visPolyCache.clear();
      this._visPolyCacheWallsSig = wallsSig;
    }

    const out = [];
    for (const tok of viewers) {
      const visionMeters = resolveTokenVisionMeters(tok, visionCfg);
      const lightMeters = resolveTokenLightMeters(tok);
      const effectiveMeters = Math.max(visionMeters, lightMeters);
      const radius = metersToPixels(effectiveMeters, grid);
      if (radius <= 0) continue;
      const cacheKey = `${tok.id}|${Math.round(tok.x * 2)}|${Math.round(tok.y * 2)}|${Math.round(radius * 2)}`;
      let poly = this._visPolyCache.get(cacheKey);
      if (!poly) {
        poly = this.computeVisibilityPolygon({ x: tok.x, y: tok.y }, radius, walls);
        if (this._visPolyCache.size > 64) {
          const oldest = this._visPolyCache.keys().next().value;
          if (oldest !== undefined) this._visPolyCache.delete(oldest);
        }
        this._visPolyCache.set(cacheKey, poly);
      }
      out.push({
        token: tok,
        radius,
        visionRadiusPx: metersToPixels(visionMeters, grid),
        lightRadiusPx: metersToPixels(lightMeters, grid),
        poly
      });
    }
    return out;
  },

  /**
   * Resolves tokens visible on the board for the current role or a specific player seat,
   * enforcing both hidden flag and dynamic lighting line-of-sight polygons.
   */
  getVisibleTokensForSeat(state, seatKey = '') {
    const tokens = Array.isArray(state?.tokens) ? state.tokens : [];
    if (!seatKey && state?.role === 'gm') return tokens;
    const visSources = state?.dynamicLighting ? this.getAlliedVisibilityPolygons(state, seatKey) : null;
    return tokens.filter((t) => {
      if (!t || t.hidden) return false;
      if (visSources && t.isAlly === false) {
        return visSources.some(
          (src) =>
            Math.hypot(t.x - src.token.x, t.y - src.token.y) <= src.radius &&
            this.isPointInPolygon({ x: t.x, y: t.y }, src.poly)
        );
      }
      return true;
    });
  },

  /**
   * Computes snapshot dimensions equal to ~1/4 of viewport area (0.5x per axis),
   * clamped within [minDim, maxDim] on the longest side while preserving aspect ratio.
   */
  computeQuarterViewportDimensions(viewportW, viewportH, maxDim = 720, minDim = 320) {
    const vw = Math.max(1, Number(viewportW) || 1280);
    const vh = Math.max(1, Number(viewportH) || 720);
    let w = vw * 0.5;
    let h = vh * 0.5;
    const longest = Math.max(w, h);
    if (longest > maxDim) {
      const k = maxDim / longest;
      w *= k;
      h *= k;
    } else if (longest < minDim) {
      const k = minDim / longest;
      w *= k;
      h *= k;
    }
    return {
      width: Math.max(1, Math.round(w)),
      height: Math.max(1, Math.round(h))
    };
  },

  appendDiceToFormula(formula, sides, op = '+') {
    const cur = String(formula || '').trim();
    const sign = op === '-' ? '-' : '+';
    const raw = String(sides || '').toLowerCase();
    const unit = raw === 'f' || raw === 'fudge' ? 'dF' : raw === 'card' || raw === 'carta' ? 'carta' : `d${Math.max(2, Math.trunc(Number(sides) || 20))}`;
    if (!cur) return sign === '-' ? `-1${unit}` : `1${unit}`;
    const tailRe = new RegExp(`([+-]?)(\\d*)${unit}$`, 'i');
    const match = cur.match(tailRe);
    if (match) {
      const termSign = match[1] || '+';
      if (termSign === sign) {
        const nextCount = Math.max(1, Number(match[2]) || 1) + 1;
        return cur.slice(0, match.index) + `${match[1]}${nextCount}${unit}`;
      }
    }
    return `${cur}${sign}1${unit}`;
  },

  decrementDiceInFormula(formula, sides) {
    const cur = String(formula || '').trim();
    if (!cur) return '';
    const raw = String(sides || '').toLowerCase();
    const unit = raw === 'f' || raw === 'fudge' ? 'dF' : raw === 'card' || raw === 'carta' ? 'carta' : `d${Math.max(2, Math.trunc(Number(sides) || 20))}`;
    const re = new RegExp(`(^|[+-])(\\d*)${unit}(?=$|[+-])`, 'ig');
    let last = null;
    for (const m of cur.matchAll(re)) last = m;
    if (!last) return cur;
    const prefix = last[1];
    const count = Math.max(1, Number(last[2]) || 1);
    const start = last.index;
    const end = start + last[0].length;
    if (count > 1) {
      return cur.slice(0, start) + `${prefix}${count - 1}${unit}` + cur.slice(end);
    }
    return (cur.slice(0, start) + cur.slice(end)).replace(/^\+/, '');
  },

  appendStatToFormula(formula, statKey, op = '+') {
    const cur = String(formula || '').trim();
    const sign = op === '-' ? '-' : '+';
    const key = String(statKey || '').trim();
    if (!key) return cur;
    if (!cur) return sign === '-' ? `-@${key}` : `@${key}`;
    return `${cur}${sign}@${key}`;
  },

  getSystemTrayTools(state) {
    const ALL_DICE = ['4', '6', '8', '10', '12', '20', '30', '100'];
    const cfg = state?.systemConfig;
    const saved = cfg?.trayTools;
    if (saved && typeof saved === 'object') {
      const diceSet = new Set(Array.isArray(saved.dice) ? saved.dice.map(String) : []);
      return {
        dice: ALL_DICE.filter((d) => diceSet.has(d)),
        coin: Boolean(saved.coin),
        fudge: Boolean(saved.fudge),
        deck: Boolean(saved.deck)
      };
    }
    const preset = cfg?.preset || state?.ruleset || 'dnd55';
    if (preset === 'pbta') return { dice: ['6'], coin: false, fudge: false, deck: false };
    if (preset === 'pool') return { dice: ['10'], coin: false, fudge: false, deck: false };
    if (preset === 'd100') return { dice: ['10', '100'], coin: false, fudge: false, deck: false };
    if (preset === 'vieja_escuela') return { dice: ['4', '6', '8', '10', '12', '20'], coin: false, fudge: false, deck: false };
    return { dice: [...ALL_DICE], coin: false, fudge: false, deck: false };
  },

  getSystemResultModes(state) {
    const ALL_MODES = ['sum', 'each', 'max', 'min', 'success'];
    const cfg = state?.systemConfig;
    if (Array.isArray(cfg?.resultModes) && cfg.resultModes.length > 0) {
      const set = new Set(cfg.resultModes.map(String));
      const list = ALL_MODES.filter((m) => set.has(m));
      if (list.length > 0) return list;
    }
    const preset = cfg?.preset || state?.ruleset || 'dnd55';
    if (preset === 'pbta') return ['sum'];
    if (preset === 'pool') return ['success', 'sum'];
    if (preset === 'd100') return ['sum'];
    if (preset === 'vieja_escuela') return ['sum', 'each'];
    return [...ALL_MODES];
  },

  getSystemOutcomeConfig(state) {
    const cfg = state?.systemConfig || {};
    const preset = cfg.preset || state?.ruleset || 'dnd55';
    const validRules = ['none', 'high', 'low', 'tiered'];
    const defaultRule = preset === 'pbta' ? 'tiered' : preset === 'd100' ? 'low' : 'high';
    const outcomeRule = validRules.includes(cfg.outcomeRule) ? cfg.outcomeRule : defaultRule;
    const showCrits = cfg.showCrits !== undefined
      ? Boolean(cfg.showCrits)
      : (outcomeRule === 'high' || outcomeRule === 'low');
    const tieredHigh = Number.isFinite(Number(cfg.tieredHigh)) ? Number(cfg.tieredHigh) : 10;
    const tieredMid = Number.isFinite(Number(cfg.tieredMid)) ? Number(cfg.tieredMid) : 7;
    const rawLabels = cfg.outcomeLabels || {};
    return {
      outcomeRule,
      showCrits,
      tieredHigh,
      tieredMid: Math.min(tieredHigh, tieredMid),
      labels: {
        crit: String(rawLabels.crit ?? '').trim() || 'Crítico',
        fumble: String(rawLabels.fumble ?? '').trim() || 'Pifia',
        success: String(rawLabels.success ?? '').trim() || (outcomeRule === 'tiered' ? 'Éxito total' : 'Éxito'),
        partial: String(rawLabels.partial ?? '').trim() || 'Éxito parcial',
        fail: String(rawLabels.fail ?? '').trim() || 'Fallo'
      }
    };
  },

  evaluateArithmeticExpr(expr) {
    const tokens = String(expr || '').replace(/\s+/g, '').match(/(?:floor|ceil|round)|(?:\d+(?:\.\d+)?)|[+\-*/()]/gi) || [];
    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];
    const parseFactor = () => {
      const tok = peek();
      if (tok === '+' || tok === '-') {
        const sign = consume() === '-' ? -1 : 1;
        return sign * parseFactor();
      }
      if (tok === 'floor' || tok === 'ceil' || tok === 'round') {
        const fn = consume().toLowerCase();
        if (peek() === '(') consume();
        const val = parseExpr();
        if (peek() === ')') consume();
        if (fn === 'floor') return Math.floor(val);
        if (fn === 'ceil') return Math.ceil(val);
        return Math.round(val);
      }
      if (tok === '(') {
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
    const res = parseExpr();
    return Number.isFinite(res) ? Math.round(res) : 0;
  },

  evaluateTokenFormula(state, tok, formulaStr, selfKey = '', visited = new Set()) {
    if (!tok) return 0;
    const key = String(selfKey || '');
    if (key && (visited.has(key) || visited.size > 6)) return 0;
    const nextVisited = new Set(visited);
    if (key) nextVisited.add(key);

    const allBlocks = this.getSystemSheetBlocks(state);
    const numBlocks = allBlocks.filter((b) => b.kind === 'number');
    const byKey = new Map();
    numBlocks.forEach((b) => {
      if (b.key) byKey.set(b.key, b);
      const norm = this.normalizeStatKey(b.label);
      if (norm && !byKey.has(norm)) byKey.set(norm, b);
    });
    const resBlocksByKey = new Map();
    allBlocks
      .filter((b) => b.kind === 'resource' && b.key && b.key !== 'hp')
      .forEach((b) => resBlocksByKey.set(b.key, b));

    const stats = tok.stats || {};
    const expr = String(formulaStr || '0')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/@([a-z0-9_]+)/gi, (_, rawKey) => {
        const k = String(rawKey || '').toLowerCase();
        const refBlk = byKey.get(k);
        if (refBlk) return `(${this.resolveTokenBlockValue(state, tok, refBlk, nextVisited)})`;
        if (k === 'hp') return `(${Number(tok.hp) || 0})`;
        if (k === 'maxhp') return `(${Number(tok.maxHp) || 0})`;
        if (k === 'ac' || k === 'ca') return `(${Number(tok.ac) || 0})`;
        if (Array.isArray(tok.resources)) {
          const rBlk = resBlocksByKey.get(k);
          const res = rBlk
            ? tok.resources.find((r) => r.id === rBlk.id || this.normalizeStatKey(r.name) === k)
            : tok.resources.find((r) => this.normalizeStatKey(r.name) === k);
          if (res) return `(${Number(res.cur) || 0})`;
        }
        return `(${Number(stats[k]) || 0})`;
      });
    return this.evaluateArithmeticExpr(expr);
  },

  resolveTokenBlockValue(state, tok, rawBlk, visited = new Set()) {
    const blk = this.normalizeSheetBlock(rawBlk);
    if (!tok || !blk) return 0;
    if (blk.valueMode === 'die') {
      const validDice = [4, 6, 8, 10, 12, 20];
      const raw = Number(tok.stats?.[blk.key]);
      return validDice.includes(raw) ? raw : 6;
    }
    if (blk.valueMode !== 'calc') {
      return blk.key === 'ac'
        ? (Number.isFinite(Number(tok.ac)) ? Number(tok.ac) : 10)
        : (Number(tok.stats?.[blk.key]) || 0);
    }
    const selfKey = String(blk.key || blk.id || '');
    return this.evaluateTokenFormula(state, tok, blk.calcFormula || '0', selfKey, visited);
  },

  resolveResourceMax(state, tok, rawBlk, resObj = null) {
    const blk = this.normalizeSheetBlock(rawBlk);
    if (!blk) return Math.max(0, Number(resObj?.max) || 0);
    if (blk.maxMode === 'free') return 0;
    if (blk.maxMode === 'calc') {
      const val = this.evaluateTokenFormula(state, tok, blk.maxFormula || '1', `res:${blk.key || blk.id || ''}`);
      return Math.max(1, Math.min(999, val));
    }
    if (blk.key === 'hp') {
      return Math.max(1, Number(tok?.maxHp) || Number(blk.max) || 18);
    }
    if (blk.editableMax && Number(resObj?.max) > 0) {
      return Math.max(1, Number(resObj.max));
    }
    return Math.max(1, Number(blk.max) || 1);
  },

  getPlayerInvites(state) {
    const list = state?.playerInvites;
    return Array.isArray(list) ? list : [];
  },

  getActiveInvite(state) {
    const list = this.getPlayerInvites(state);
    if (!state?.activeInviteId) return null;
    return list.find((i) => i.id === state.activeInviteId) || null;
  },

  getPlayerAssignedTokenIds(state) {
    if (state?.role !== 'player') return (state?.tokens || []).map((t) => t.id);
    const inv = this.getActiveInvite(state);
    const allowed = new Set((state?.tokens || []).filter((t) => t.isAlly !== false).map((t) => t.id));
    return (Array.isArray(inv?.tokenIds) ? inv.tokenIds : []).filter((id) => allowed.has(id));
  },

  isSpectator(state) {
    return state?.role === 'player' && this.getPlayerAssignedTokenIds(state).length === 0;
  },

  isNarrativeScene(state) {
    return state?.sceneMode === 'narrative';
  },

  getGmScreenState(state) {
    const presetKey = state?.systemConfig?.preset || (state?.ruleset === 'free' ? 'free' : 'dnd55');
    const raw = state?.gmScreen;
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tabs) || raw.tabs.length === 0) {
      return createDefaultGmScreen(presetKey);
    }
    const tabs = raw.tabs
      .filter((t) => t && t.id)
      .map((t) => ({
        id: String(t.id),
        label: String(t.label || 'Pestaña').trim() || 'Pestaña',
        allowCompendium: Boolean(t.allowCompendium)
      }));
    const validTabIds = new Set(tabs.map((t) => t.id));
    const activeTabId = validTabIds.has(raw.activeTabId) ? raw.activeTabId : (tabs[0]?.id || 'table');
    return {
      activeTabId,
      tabs,
      widgets: Array.isArray(raw.widgets) ? raw.widgets : [],
      pins: Array.isArray(raw.pins) ? raw.pins : [],
      clocks: Array.isArray(raw.clocks) ? raw.clocks : [],
      notes: Array.isArray(raw.notes) ? raw.notes : [],
      tables: Array.isArray(raw.tables) ? raw.tables : [],
      references: Array.isArray(raw.references) ? raw.references : []
    };
  },

  getGmStagingTabs(state) {
    const gm = this.getGmScreenState(state);
    const stagingTabIds = new Set(
      gm.widgets.filter((w) => w && w.type === 'staging' && w.enabled !== false).map((w) => w.tabId)
    );
    const eligible = gm.tabs.filter((t) => t.allowCompendium || stagingTabIds.has(t.id));
    return eligible.length > 0 ? eligible : (gm.tabs[0] ? [gm.tabs[0]] : []);
  },

  getPublicClocks(state) {
    if (state?.role === 'gm' && state?.gmScreen && Array.isArray(state.gmScreen.clocks)) {
      return state.gmScreen.clocks
        .filter((c) => c && c.isPublic === true)
        .map((c) => ({
          id: String(c.id),
          label: String(c.label || 'Reloj'),
          kind: c.kind === 'counter' ? 'counter' : 'clock',
          segments: Math.max(2, Math.min(12, Number(c.segments) || 6)),
          value: Math.max(0, Number(c.value) || 0),
          color: String(c.color || '#8b5cf6')
        }));
    }
    return Array.isArray(state?.publicClocks)
      ? state.publicClocks.map((c) => ({
          id: String(c.id),
          label: String(c.label || 'Reloj'),
          kind: c.kind === 'counter' ? 'counter' : 'clock',
          segments: Math.max(2, Math.min(12, Number(c.segments) || 6)),
          value: Math.max(0, Number(c.value) || 0),
          color: String(c.color || '#8b5cf6')
        }))
      : [];
  },

  evaluateRollAgainstRequest(req, resp, token = null, state = null) {
    if (!req || !resp) return { status: 'none', badge: '', detail: '' };
    const outcome = state
      ? this.getSystemOutcomeConfig(state)
      : {
          outcomeRule: 'high',
          tieredHigh: 10,
          tieredMid: 7,
          labels: { success: 'Éxito', partial: 'Éxito parcial', fail: 'Fallo' }
        };
    const total = Number(resp.total) || 0;
    const mode = req.evalMode
      || (req.resultMode === 'success' || state?.systemConfig?.resultMode === 'success'
        ? 'pool'
        : outcome.outcomeRule);

    if (mode === 'none') {
      return { status: 'none', badge: '', detail: '' };
    }
    if (mode === 'opposed' || req.opposed) {
      const refVal = Number(req.casterTotal ?? req.dc) || 0;
      if (total > refVal) {
        return { status: 'pass', badge: '✓', detail: `Gana objetivo (vs ${refVal})` };
      }
      if (total === refVal) {
        return { status: 'partial', badge: '=', detail: `Empate (vs ${refVal})` };
      }
      return { status: 'fail', badge: '✗', detail: `Gana atacante (vs ${refVal})` };
    }
    if (mode === 'pool') {
      const reqHits = Number(req.requiredSuccesses) || Number(req.dc) || 0;
      if (reqHits <= 0) return { status: 'none', badge: '', detail: '' };
      const ok = total >= reqHits;
      return {
        status: ok ? 'pass' : 'fail',
        badge: ok ? '✓' : '✗',
        detail: `${total}/${reqHits}`
      };
    }
    if (mode === 'low') {
      let target = Number(req.dc) > 0 ? Number(req.dc) : 0;
      if (target <= 0 && token && req.statKey) {
        const base = Number(token.stats?.[req.statKey]) || 0;
        const scale = [1, 2, 5].includes(Number(req.lowScale)) ? Number(req.lowScale) : 1;
        const mod = Number(req.difficultyMod) || 0;
        if (base > 0) target = Math.max(1, Math.floor(base / scale) + mod);
      }
      if (target <= 0) return { status: 'none', badge: '', detail: '' };
      const ok = total <= target;
      return {
        status: ok ? 'pass' : 'fail',
        badge: ok ? '✓' : '✗',
        detail: `≤ ${target}`
      };
    }
    if (mode === 'tiered') {
      const high = Number.isFinite(Number(req.tieredHigh)) ? Number(req.tieredHigh) : outcome.tieredHigh;
      const mid = Number.isFinite(Number(req.tieredMid)) ? Number(req.tieredMid) : outcome.tieredMid;
      if (total >= high) return { status: 'pass', badge: '✓', detail: outcome.labels.success };
      if (total >= mid) return { status: 'partial', badge: '◐', detail: outcome.labels.partial };
      return { status: 'fail', badge: '✗', detail: outcome.labels.fail };
    }
    const dc = Number(req.dc) || 0;
    if (dc <= 0) return { status: 'none', badge: '', detail: '' };
    const ok = total >= dc;
    return { status: ok ? 'pass' : 'fail', badge: ok ? '✓' : '✗', detail: `CD ${dc}` };
  },

  buildWireRollRequest(fullReq) {
    if (!fullReq || typeof fullReq !== 'object') return null;
    const wire = {
      requestId: fullReq.requestId,
      senderId: fullReq.senderId,
      label: fullReq.label,
      statKey: fullReq.statKey,
      formula: fullReq.formula,
      damageTotal: Number(fullReq.damageTotal) || 0,
      targets: Array.isArray(fullReq.targets) ? fullReq.targets.map((t) => ({ id: t.id, name: t.name })) : [],
      secretDc: Boolean(fullReq.secretDc)
    };
    if (fullReq.isInitiative) wire.isInitiative = true;
    if (fullReq.resultMode) wire.resultMode = fullReq.resultMode;
    if (Number(fullReq.successThreshold) > 0) wire.successThreshold = Number(fullReq.successThreshold);
    if (fullReq.opposed) {
      wire.opposed = true;
      wire.casterName = String(fullReq.casterName || '');
    }
    if (wire.secretDc) {
      wire.dc = 0;
      return wire;
    }
    wire.dc = Number(fullReq.dc) || 0;
    if (fullReq.opposed) {
      wire.casterTotal = Number(fullReq.casterTotal ?? fullReq.dc) || 0;
    }
    if (fullReq.evalMode) wire.evalMode = fullReq.evalMode;
    if (fullReq.lowScale) wire.lowScale = fullReq.lowScale;
    if (Number.isFinite(Number(fullReq.difficultyMod)) && Number(fullReq.difficultyMod) !== 0) {
      wire.difficultyMod = Number(fullReq.difficultyMod);
    }
    if (Number(fullReq.requiredSuccesses) > 0) wire.requiredSuccesses = Number(fullReq.requiredSuccesses);
    if (Number.isFinite(Number(fullReq.tieredHigh))) wire.tieredHigh = Number(fullReq.tieredHigh);
    if (Number.isFinite(Number(fullReq.tieredMid))) wire.tieredMid = Number(fullReq.tieredMid);
    return wire;
  },

  /**
   * Computes total Euclidean length along a polyline of {x, y} points.
   * @param {Array<{x: number, y: number}>} points
   * @returns {number}
   */
  getPolylineLength(points) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return total;
  },

  /**
   * Simplifies a dragged token polyline with Ramer-Douglas-Peucker,
   * dropping near-straight points and capping to maxPoints. Returns null
   * for straight segments (<= 2 points) so compact moves omit path.
   * @param {Array<{x: number, y: number}>} rawPoints
   * @param {{x: number, y: number}} finalPt
   * @param {number} maxPoints
   * @returns {Array<{x: number, y: number}>|null}
   */
  simplifyMovePath(rawPoints, finalPt, maxPoints = 12) {
    const clampPt = (p) => {
      if (!p || typeof p !== 'object') return null;
      const x = Number(p.x);
      const y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        x: Math.round(Math.max(40, Math.min(2360, x))),
        y: Math.round(Math.max(40, Math.min(1560, y)))
      };
    };

    const end = clampPt(finalPt);
    if (!end || !Array.isArray(rawPoints) || rawPoints.length === 0) return null;

    const cleaned = [];
    for (const raw of rawPoints) {
      const pt = clampPt(raw);
      if (!pt) continue;
      if (cleaned.length === 0 || Math.hypot(pt.x - cleaned[cleaned.length - 1].x, pt.y - cleaned[cleaned.length - 1].y) >= 8) {
        cleaned.push(pt);
      }
    }
    if (cleaned.length === 0) return null;

    if (Math.hypot(end.x - cleaned[cleaned.length - 1].x, end.y - cleaned[cleaned.length - 1].y) <= 28) {
      cleaned[cleaned.length - 1] = end;
    } else {
      cleaned.push(end);
    }

    if (cleaned.length < 2) return null;
    if (cleaned[0].x === end.x && cleaned[0].y === end.y && cleaned.length === 2) return null;

    const perpDist = (pt, a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq <= 0.0001) return Math.hypot(pt.x - a.x, pt.y - a.y);
      return Math.abs(dy * pt.x - dx * pt.y + b.x * a.y - b.y * a.x) / Math.sqrt(lenSq);
    };

    const rdp = (pts, eps) => {
      if (pts.length <= 2) return pts.slice();
      let maxD = -1;
      let maxIdx = 0;
      const first = pts[0];
      const last = pts[pts.length - 1];
      for (let i = 1; i < pts.length - 1; i++) {
        const d = perpDist(pts[i], first, last);
        if (d > maxD) {
          maxD = d;
          maxIdx = i;
        }
      }
      if (maxD > eps) {
        const left = rdp(pts.slice(0, maxIdx + 1), eps);
        const right = rdp(pts.slice(maxIdx), eps);
        return left.slice(0, -1).concat(right);
      }
      return [first, last];
    };

    let eps = 18;
    let simplified = rdp(cleaned, eps);
    for (let pass = 0; pass < 8 && simplified.length > maxPoints; pass++) {
      eps *= 1.45;
      const cand = rdp(cleaned, eps);
      if (cand.length < 3) break;
      simplified = cand;
    }

    if (simplified.length > maxPoints && maxPoints >= 2) {
      const thinned = [simplified[0]];
      const innerCount = maxPoints - 2;
      const avail = simplified.length - 2;
      for (let k = 1; k <= innerCount; k++) {
        const idx = Math.min(simplified.length - 2, Math.max(1, Math.round((k / (innerCount + 1)) * (avail + 1))));
        const cand = simplified[idx];
        if (cand !== thinned[thinned.length - 1]) thinned.push(cand);
      }
      thinned.push(simplified[simplified.length - 1]);
      simplified = thinned;
    }

    if (simplified.length <= 2) return null;
    return simplified;
  },

  /**
   * Arc-length-parameterized sample along a polyline for progress in [0, 1].
   * @param {Array<{x: number, y: number}>} points
   * @param {number} progress
   * @returns {{x: number, y: number}|null}
   */
  samplePointAlongPath(points, progress) {
    if (!Array.isArray(points) || points.length === 0) return null;
    if (points.length === 1) return { x: points[0].x, y: points[0].y };
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    if (p <= 0) return { x: points[0].x, y: points[0].y };
    const last = points[points.length - 1];
    if (p >= 1) return { x: last.x, y: last.y };

    const totalLen = this.getPolylineLength(points);
    if (totalLen <= 0) return { x: last.x, y: last.y };

    const target = totalLen * p;
    let accum = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (accum + segLen >= target && segLen > 0) {
        const localT = (target - accum) / segLen;
        return {
          x: a.x + (b.x - a.x) * localT,
          y: a.y + (b.y - a.y) * localT
        };
      }
      accum += segLen;
    }
    return { x: last.x, y: last.y };
  },

  /**
   * C2-smooth asymmetric ease-in-out (half-cosine / half-sine, split = 0.38)
   * capping peak velocity near ~1.57x so 60 Hz playback stays crisp without judder.
   * @param {number} t
   * @returns {number}
   */
  easeTokenGlide(t) {
    const x = Math.max(0, Math.min(1, Number(t) || 0));
    const split = 0.38;
    if (x <= split) {
      return split * (1 - Math.cos((Math.PI * x) / (2 * split)));
    }
    return split + (1 - split) * Math.sin((Math.PI * (x - split)) / (2 * (1 - split)));
  },

  /**
   * Smooths multi-segment paths by replacing sharp interior corners with short
   * quadratic Bezier fillets while keeping start/end points exact.
   * @param {Array<{x: number, y: number}>} points
   * @param {number} cornerRadius
   * @param {number} stepsPerCorner
   * @returns {Array<{x: number, y: number}>}
   */
  smoothMovePath(points, cornerRadius = 36, stepsPerCorner = 4) {
    if (!Array.isArray(points) || points.length <= 2) {
      return Array.isArray(points) ? points.map((p) => ({ x: p.x, y: p.y })) : [];
    }
    const out = [{ x: points[0].x, y: points[0].y }];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const len1 = Math.hypot(dx1, dy1);
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const len2 = Math.hypot(dx2, dy2);
      if (len1 < 4 || len2 < 4) {
        out.push({ x: curr.x, y: curr.y });
        continue;
      }
      const trim = Math.min(cornerRadius, len1 * 0.35, len2 * 0.35);
      const ax = curr.x - (dx1 / len1) * trim;
      const ay = curr.y - (dy1 / len1) * trim;
      const cx = curr.x + (dx2 / len2) * trim;
      const cy = curr.y + (dy2 / len2) * trim;
      for (let s = 0; s <= stepsPerCorner; s++) {
        const u = s / stepsPerCorner;
        const inv = 1 - u;
        const bx = inv * inv * ax + 2 * inv * u * curr.x + u * u * cx;
        const by = inv * inv * ay + 2 * inv * u * curr.y + u * u * cy;
        const last = out[out.length - 1];
        if (Math.hypot(bx - last.x, by - last.y) >= 0.5) {
          out.push({ x: bx, y: by });
        }
      }
    }
    const end = points[points.length - 1];
    const last = out[out.length - 1];
    if (Math.hypot(end.x - last.x, end.y - last.y) >= 0.5) {
      out.push({ x: end.x, y: end.y });
    } else {
      out[out.length - 1] = { x: end.x, y: end.y };
    }
    return out;
  },

  extractJournalForSeat(state, seatKey) {
    const journal = state?.journal || {};
    const assets = state?.mediaAssets || {};
    const gmNotes = Array.isArray(journal.gmNotes) ? journal.gmNotes : [];
    const receivedReveals = [];

    if (seatKey) {
      for (const note of gmNotes) {
        if (!note || typeof note !== 'object') continue;
        const revealed = Boolean(
          note.revealedTo?.all ||
          (Array.isArray(note.revealedTo?.seatKeys) && note.revealedTo.seatKeys.includes(seatKey))
        );
        if (!revealed) continue;
        const visibleBlocks = (Array.isArray(note.blocks) ? note.blocks : [])
          .filter((b) => canSeatSeeJournalBlock(b, seatKey))
          .map((b) => ({
            id: String(b.id || ''),
            heading: String(b.heading || ''),
            body: String(b.body || '')
          }));
        if (!visibleBlocks.length) continue;
        const allowMedia = note.revealMedia !== false;
        const mediaId = allowMedia ? String(note.mediaId || '') : '';
        const imageUrl = allowMedia ? ((mediaId && assets[mediaId]?.url) || String(note.imageUrl || '')) : '';
        receivedReveals.push({
          id: String(note.id || ''),
          title: String(note.title || 'Nota'),
          gmFolder: String(note.folder || ''),
          mediaId,
          imageUrl,
          blocks: visibleBlocks,
          updatedAt: Number(note.updatedAt) || 0
        });
      }
    }

    const rawPj = seatKey && journal.playerJournals && journal.playerJournals[seatKey];
    const playerJournal = rawPj && typeof rawPj === 'object'
      ? JSON.parse(JSON.stringify({
          folders: Array.isArray(rawPj.folders) ? rawPj.folders : [],
          notes: Array.isArray(rawPj.notes) ? rawPj.notes : [],
          revealedAnnotations: rawPj.revealedAnnotations && typeof rawPj.revealedAnnotations === 'object'
            ? rawPj.revealedAnnotations
            : {}
        }))
      : { folders: [], notes: [], revealedAnnotations: {} };

    return { receivedReveals, playerJournal };
  },

  extractWorldForSeat(state, seatKey) {
    return this.extractSerializableWorld(state, { includePrivateGm: false, forSeatKey: seatKey || '' });
  },

  extractSerializableWorld(state, { includePrivateGm = false, forSeatKey = null } = {}) {
    const rawAssets = normalizeMediaAssets(state.mediaAssets);
    if (includePrivateGm) {
      const refs = collectReferencedMediaIds(state);
      const retainedAssets = {};
      for (const [id, asset] of Object.entries(rawAssets)) {
        const urlHash = asset?.url ? hashMediaSource(asset.url) : '';
        if (refs.has(id) || (urlHash && refs.has(urlHash))) {
          retainedAssets[id] = asset;
        }
      }
      const rawJournal = state.journal || {};
      const world = {
        moduleTitle: state.room.moduleTitle,
        playerInvites: JSON.parse(JSON.stringify(this.getPlayerInvites(state))),
        ruleset: state.ruleset || 'dnd55',
        systemConfig: JSON.parse(JSON.stringify(state.systemConfig || {})),
        sheetSchema: JSON.parse(JSON.stringify(state.sheetSchema || [])),
        deck: state.deck ? JSON.parse(JSON.stringify(state.deck)) : null,
        mapId: state.mapId,
        activeMapKey: state.activeMapKey || state.mapId || 'bastion',
        sceneMode: state.sceneMode === 'narrative' ? 'narrative' : 'tactical',
        sceneWeather: normalizeWeatherType(state.sceneWeather),
        customMapUrl: state.customMapUrl,
        customMapSourceUrl: state.customMapSourceUrl || '',
        mapGrids: JSON.parse(JSON.stringify(state.mapGrids || {})),
        notes: JSON.parse(JSON.stringify(state.notes || [])),
        combat: JSON.parse(JSON.stringify(state.combat || { active: false, round: 1, turnIndex: 0, order: [] })),
        dynamicLighting: Boolean(state.dynamicLighting),
        rememberExplored: state.rememberExplored !== false,
        exploredMask: String(state.exploredMask || ''),
        exploredRev: Math.max(0, Math.trunc(Number(state.exploredRev) || 0)),
        walls: JSON.parse(JSON.stringify(state.walls || [])),
        grid: { ...state.grid },
        customActors: JSON.parse(JSON.stringify(state.customActors || [])),
        customItems: JSON.parse(JSON.stringify(state.customItems || [])),
        customMaps: JSON.parse(JSON.stringify(state.customMaps || [])),
        compendiumFolders: JSON.parse(JSON.stringify(state.compendiumFolders || { actors: [], items: [], maps: [] })),
        tokens: JSON.parse(JSON.stringify(state.tokens || [])),
        strokes: JSON.parse(JSON.stringify(state.strokes || [])),
        publicClocks: this.getPublicClocks(state),
        mediaAssets: retainedAssets,
        journal: JSON.parse(JSON.stringify({
          gmFolders: Array.isArray(rawJournal.gmFolders) ? rawJournal.gmFolders : [],
          gmNotes: Array.isArray(rawJournal.gmNotes) ? rawJournal.gmNotes : [],
          playerJournals: rawJournal.playerJournals && typeof rawJournal.playerJournals === 'object'
            ? rawJournal.playerJournals
            : {}
        })),
        sceneLayers: JSON.parse(JSON.stringify(state.sceneLayers || {})),
        sceneLighting: JSON.parse(JSON.stringify(state.sceneLighting || {}))
      };
      if (state.gmScreen) {
        world.gmScreen = JSON.parse(JSON.stringify(state.gmScreen));
      }
      return world;
    }

    const effectiveSeat = forSeatKey || (state?.role === 'player' ? (state.activeInviteId || '') : '');
    const allowedIds = new Set(effectiveSeat ? getSeatAllowedTokenIds(state, effectiveSeat) : []);
    const redactedTokens = (state.tokens || []).map((tok) =>
      allowedIds.has(tok.id) ? JSON.parse(JSON.stringify(tok)) : redactTokenForNonOwner(tok)
    );
    const visibleTokenIds = new Set(this.getVisibleTokensForSeat(state, effectiveSeat).map((t) => t.id));
    const authMedia = collectPlayerAuthorizedMedia(state, effectiveSeat, { visibleTokenIds });
    const seatAssets = {};
    for (const item of authMedia) {
      if (item.mediaId && rawAssets[item.mediaId]) {
        seatAssets[item.mediaId] = rawAssets[item.mediaId];
      } else if (item.mediaId && item.url) {
        seatAssets[item.mediaId] = {
          id: item.mediaId,
          url: item.url,
          label: item.label || 'Imagen',
          kind: item.kind || 'token',
          createdAt: 0
        };
      }
    }

    const wireWorld = {
      moduleTitle: state.room.moduleTitle,
      playerInvites: JSON.parse(JSON.stringify(this.getPlayerInvites(state))),
      ruleset: state.ruleset || 'dnd55',
      systemConfig: JSON.parse(JSON.stringify(state.systemConfig || {})),
      sheetSchema: JSON.parse(JSON.stringify(state.sheetSchema || [])),
      deck: state.deck ? JSON.parse(JSON.stringify(state.deck)) : null,
      mapId: state.mapId,
      activeMapKey: state.activeMapKey || state.mapId || 'bastion',
      sceneMode: state.sceneMode === 'narrative' ? 'narrative' : 'tactical',
      sceneWeather: normalizeWeatherType(state.sceneWeather),
      customMapUrl: state.customMapUrl,
      mapGrids: JSON.parse(JSON.stringify(state.mapGrids || {})),
      notes: filterVisibleMapNotes(state.notes, false),
      combat: redactCombatForSeat(state.combat, state.tokens, state.systemConfig?.combatTrackerPublic !== false),
      dynamicLighting: Boolean(state.dynamicLighting),
      rememberExplored: state.rememberExplored !== false,
      exploredMask: String(state.exploredMask || ''),
      exploredRev: Math.max(0, Math.trunc(Number(state.exploredRev) || 0)),
      walls: redactWallsForPlayer(state.walls || []),
      grid: { ...state.grid },
      customActors: [],
      customItems: [],
      customMaps: [],
      compendiumFolders: { actors: [], items: [], maps: [] },
      tokens: redactedTokens,
      strokes: JSON.parse(JSON.stringify(state.strokes || [])),
      publicClocks: this.getPublicClocks(state),
      mediaAssets: seatAssets
    };
    if (forSeatKey) {
      wireWorld.journal = this.extractJournalForSeat(state, forSeatKey);
    }
    return wireWorld;
  }
};
