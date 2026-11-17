/* ==========================================================================
   SELECTOR: CONSULTAS PURAS DE COORDENADAS, RAYCASTING 2D Y SERIALIZACIÓN
   ========================================================================== */

import { DEFAULT_SHEET_SCHEMA, DEFAULT_STATUS_DEFS } from './model.js?v=20261116z39';

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

  getSystemSheetBlocks(state) {
    const blocks = state?.systemConfig?.sheetBlocks;
    return Array.isArray(blocks) ? blocks : [];
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
        if (s && s.type === 'text') {
          const t = String(s.text || '').trim();
          if (t) textParts.push(t);
        } else if (s) {
          actionSteps.push({ ...s });
        }
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
    if (!state.grid.snap) return { x: wx, y: wy };
    const cs = state.grid.cellSize;
    const ox = Number(state.grid.offsetX) || 0;
    const oy = Number(state.grid.offsetY) || 0;
    const half = (cs * sizeCells) / 2;
    return {
      x: Math.round((wx - ox - half) / cs) * cs + ox + half,
      y: Math.round((wy - oy - half) / cs) * cs + oy + half
    };
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
    for (const w of state.walls || []) {
      if (w.kind === 'door' && this.distToSegment(wx, wy, w.x1, w.y1, w.x2, w.y2) <= maxDist) {
        return w;
      }
    }
    return null;
  },

  // Raycasting 2D: calcula el polígono de visibilidad alrededor de (ox, oy) hasta radius
  computeVisibilityPolygon(origin, radius, walls) {
    const ox = origin.x;
    const oy = origin.y;
    const R = Math.max(120, radius || 520);
    const minX = ox - R;
    const maxX = ox + R;
    const minY = oy - R;
    const maxY = oy + R;

    // Segmentos activos (muros cerrados + puertas cerradas + caja delimitadora de alcance)
    const segments = [
      { x1: minX, y1: minY, x2: maxX, y2: minY },
      { x1: maxX, y1: minY, x2: maxX, y2: maxY },
      { x1: maxX, y1: maxY, x2: minX, y2: maxY },
      { x1: minX, y1: maxY, x2: minX, y2: minY }
    ];

    for (const w of walls || []) {
      if (w.kind === 'door' && w.open) continue;
      if (Math.max(w.x1, w.x2) < minX || Math.min(w.x1, w.x2) > maxX) continue;
      if (Math.max(w.y1, w.y2) < minY || Math.min(w.y1, w.y2) > maxY) continue;
      segments.push(w);
    }

    // Recolectar ángulos únicos hacia todos los vértices con micro-desplazamiento ±eps
    const angles = [];
    const eps = 0.00015;
    for (const seg of segments) {
      const pts = [
        [seg.x1, seg.y1],
        [seg.x2, seg.y2]
      ];
      for (const [px, py] of pts) {
        const baseAngle = Math.atan2(py - oy, px - ox);
        angles.push(baseAngle - eps, baseAngle, baseAngle + eps);
      }
    }

    const hits = [];
    for (const angle of angles) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let minT = R * 1.45;
      let hitX = ox + dx * R;
      let hitY = oy + dy * R;

      for (const seg of segments) {
        const sdx = seg.x2 - seg.x1;
        const sdy = seg.y2 - seg.y1;
        const denom = dx * sdy - dy * sdx;
        if (Math.abs(denom) < 1e-9) continue;

        const qpx = seg.x1 - ox;
        const qpy = seg.y1 - oy;
        const t = (qpx * sdy - qpy * sdx) / denom;
        const u = (qpx * dy - qpy * dx) / denom;

        if (t >= 0 && u >= 0 && u <= 1 && t < minT) {
          minT = t;
          hitX = ox + dx * t;
          hitY = oy + dy * t;
        }
      }
      hits.push({ angle, x: hitX, y: hitY });
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

  getAlliedVisibilityPolygons(state) {
    const sources = (state.tokens || []).filter(
      (t) => !t.hidden && (t.isAlly !== false || (Number(t.lightRadius) || 0) > 0)
    );
    return sources.map((tok) => {
      const vision = tok.isAlly !== false ? (tok.visionRadius || 520) : 0;
      const light = Number(tok.lightRadius) || 0;
      const radius = Math.max(vision, light) || 520;
      return {
        token: tok,
        radius,
        poly: this.computeVisibilityPolygon({ x: tok.x, y: tok.y }, radius, state.walls)
      };
    });
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

  extractSerializableWorld(state) {
    return {
      moduleTitle: state.room.moduleTitle,
      ruleset: state.ruleset || 'dnd55',
      systemConfig: JSON.parse(JSON.stringify(state.systemConfig || {})),
      sheetSchema: JSON.parse(JSON.stringify(state.sheetSchema || [])),
      deck: state.deck ? JSON.parse(JSON.stringify(state.deck)) : null,
      mapId: state.mapId,
      activeMapKey: state.activeMapKey || state.mapId || 'bastion',
      customMapUrl: state.customMapUrl,
      mapGrids: JSON.parse(JSON.stringify(state.mapGrids || {})),
      notes: JSON.parse(JSON.stringify(state.notes || [])),
      combat: JSON.parse(JSON.stringify(state.combat || { active: false, round: 1, turnIndex: 0, order: [] })),
      dynamicLighting: Boolean(state.dynamicLighting),
      walls: JSON.parse(JSON.stringify(state.walls || [])),
      grid: { ...state.grid },
      customActors: JSON.parse(JSON.stringify(state.customActors || [])),
      customItems: JSON.parse(JSON.stringify(state.customItems || [])),
      customMaps: JSON.parse(JSON.stringify(state.customMaps || [])),
      compendiumFolders: JSON.parse(JSON.stringify(state.compendiumFolders || { actors: [], items: [], maps: [] })),
      tokens: JSON.parse(JSON.stringify(state.tokens)),
      strokes: JSON.parse(JSON.stringify(state.strokes)),
      fogRects: JSON.parse(JSON.stringify(state.fogRects))
    };
  }
};
