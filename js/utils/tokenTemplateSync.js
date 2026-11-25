/* ==========================================================================
   TOKEN TEMPLATE SYNC: PURE LINKED-PROTAGONIST & SECONDARY-MOLD HELPERS
   ========================================================================== */

import { resolveTokenDarkvisionMeters } from './lightingModel.js?v=20261125a1';

export function clampTokenSize(size, fallback = 1) {
  if (size === null || size === undefined || size === '') {
    return Math.max(1, Math.min(4, Math.round(Number(fallback) || 1)));
  }
  const n = Math.round(Number(size));
  if (!Number.isFinite(n)) return Math.max(1, Math.min(4, Math.round(Number(fallback) || 1)));
  return Math.max(1, Math.min(4, n));
}

/**
 * Normalizes item consumption mode (`permanent` | `consumable` | `charges`) and `maxUses`
 * with backward compatibility for legacy `kind === 'consumable'` items.
 * @param {object} [item]
 * @returns {{ usageMode: 'permanent'|'consumable'|'charges', maxUses: number }}
 */
export function normalizeItemUsage(item = {}) {
  const rawMode = String(item?.usageMode || '').trim();
  const clampCount = (val, def) => {
    const n = Math.trunc(Number(val));
    if (!Number.isFinite(n) || n < 1) return def;
    return Math.min(999, n);
  };
  if (rawMode === 'consumable') {
    return { usageMode: 'consumable', maxUses: clampCount(item.maxUses, 1) };
  }
  if (rawMode === 'charges') {
    return { usageMode: 'charges', maxUses: clampCount(item.maxUses, 3) };
  }
  if (!rawMode && item?.kind === 'consumable') {
    return { usageMode: 'consumable', maxUses: clampCount(item.maxUses, 1) };
  }
  return { usageMode: 'permanent', maxUses: 0 };
}

export function normalizeTemplateStats(rawStats = null, existingStats = null) {
  const out = {};
  if (existingStats && typeof existingStats === 'object') {
    for (const [k, v] of Object.entries(existingStats)) {
      if (k && Number.isFinite(Number(v))) out[k] = Number(v);
    }
  }
  if (rawStats && typeof rawStats === 'object') {
    for (const [k, v] of Object.entries(rawStats)) {
      if (k && Number.isFinite(Number(v))) out[k] = Number(v);
    }
  }
  for (const coreKey of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    if (out[coreKey] === undefined) out[coreKey] = 0;
  }
  return out;
}

export function resolveNextInstanceName(baseName, existingNames = []) {
  const clean = String(baseName || 'Personaje').trim() || 'Personaje';
  const taken = new Set((Array.isArray(existingNames) ? existingNames : []).map((n) => String(n || '').trim()));
  if (!taken.has(clean)) return clean;
  const root = clean.replace(/\s+\d+$/, '').trim() || clean;
  let idx = 2;
  while (taken.has(`${root} ${idx}`)) idx += 1;
  return `${root} ${idx}`;
}

export function makeUniqueTokenId() {
  return `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function makeInventoryUid(idx = 0) {
  return `inv-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
}

export function resolveStarterItemsInventory(starterKeys = [], customItems = [], baseItems = []) {
  if (!Array.isArray(starterKeys) || starterKeys.length === 0) return [];
  const catalog = [...(Array.isArray(customItems) ? customItems : []), ...(Array.isArray(baseItems) ? baseItems : [])];
  const byKey = new Map();
  for (const item of catalog) {
    if (item && item.key && !byKey.has(item.key)) {
      byKey.set(item.key, item);
    }
  }
  const out = [];
  starterKeys.forEach((key, idx) => {
    const found = byKey.get(key);
    if (!found) return;
    const cloned = JSON.parse(JSON.stringify(found));
    const { usageMode, maxUses } = normalizeItemUsage(cloned);
    out.push({
      ...cloned,
      usageMode,
      maxUses,
      ...(usageMode !== 'permanent' && cloned.uses === undefined ? { uses: maxUses } : {}),
      uid: makeInventoryUid(idx)
    });
  });
  return out;
}

export function cloneInventoryForSpawn(inventory = [], { freshUids = true } = {}) {
  if (!Array.isArray(inventory)) return [];
  return inventory
    .filter(Boolean)
    .map((item, idx) => {
      const copy = JSON.parse(JSON.stringify(item));
      if (freshUids || !copy.uid) {
        copy.uid = makeInventoryUid(idx);
      }
      return copy;
    });
}

export function reconcileInventoryWithStarterItems(existingInventory, prevStarterKeys, nextStarterKeys, customItems, baseItems) {
  const prevList = Array.isArray(prevStarterKeys) ? prevStarterKeys : [];
  const nextList = Array.isArray(nextStarterKeys) ? nextStarterKeys : [];
  if (JSON.stringify(prevList) === JSON.stringify(nextList)) {
    return Array.isArray(existingInventory) ? JSON.parse(JSON.stringify(existingInventory)) : undefined;
  }
  if (!Array.isArray(existingInventory)) {
    return undefined;
  }
  const removedCounts = new Map();
  const prevCounts = new Map();
  const nextCounts = new Map();
  prevList.forEach((k) => prevCounts.set(k, (prevCounts.get(k) || 0) + 1));
  nextList.forEach((k) => nextCounts.set(k, (nextCounts.get(k) || 0) + 1));
  for (const [k, cnt] of prevCounts.entries()) {
    const diff = cnt - (nextCounts.get(k) || 0);
    if (diff > 0) removedCounts.set(k, diff);
  }
  const kept = [];
  for (const entry of existingInventory) {
    if (!entry) continue;
    const rem = removedCounts.get(entry.key) || 0;
    if (rem > 0) {
      removedCounts.set(entry.key, rem - 1);
      continue;
    }
    kept.push(JSON.parse(JSON.stringify(entry)));
  }
  const addedKeys = [];
  for (const [k, cnt] of nextCounts.entries()) {
    const diff = cnt - (prevCounts.get(k) || 0);
    for (let i = 0; i < diff; i += 1) addedKeys.push(k);
  }
  const addedEntries = resolveStarterItemsInventory(addedKeys, customItems, baseItems);
  return [...kept, ...addedEntries];
}

export function buildActorTemplateFromToken(
  tok,
  existingTpl = null,
  { preserveLiveHp = null, preserveTemplatePresence = false } = {}
) {
  if (!tok) return null;
  const isAlly = tok.isAlly !== false;
  const keepLiveHp = preserveLiveHp !== null ? Boolean(preserveLiveHp) : isAlly;
  const keepPresence = Boolean(preserveTemplatePresence && existingTpl);
  const maxHp = Math.max(1, Number(tok.maxHp) || Number(tok.hp) || 16);
  const hp = keepLiveHp ? Math.max(0, Math.min(maxHp, Number(tok.hp) || 0)) : maxHp;
  const rawName = String(tok.name || existingTpl?.name || 'Personaje').trim() || 'Personaje';
  let templateName = rawName;
  if (!isAlly && existingTpl?.name) {
    const escapedBase = String(existingTpl.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${escapedBase}\\s+\\d+$`).test(rawName)) {
      templateName = existingTpl.name;
    }
  }
  const resources = Array.isArray(tok.resources)
    ? tok.resources.map((r) => {
        const copy = JSON.parse(JSON.stringify(r));
        if (!keepLiveHp && Number(copy.max) > 0) {
          copy.cur = Number(copy.max);
          if (Array.isArray(copy.pips)) copy.pips = copy.pips.map(() => 0);
        }
        return copy;
      })
    : undefined;
  const inventory = Array.isArray(tok.inventory) ? cloneInventoryForSpawn(tok.inventory, { freshUids: false }) : [];
  const starterItems = Array.isArray(existingTpl?.starterItems)
    ? [...existingTpl.starterItems]
    : inventory.map((it) => it.key).filter((k) => k && k !== 'custom_item');

  return {
    key: existingTpl?.key || tok.actorKey || `custom-${Date.now().toString(36)}`,
    isCustom: true,
    folder: String(existingTpl?.folder || '').trim(),
    name: templateName,
    role: String(tok.role || (isAlly ? 'Protagonista' : 'Secundario')).trim(),
    color: tok.color || (isAlly ? '#8b5cf6' : '#ef4444'),
    isAlly,
    visionMeters: keepPresence
      ? existingTpl.visionMeters ?? null
      : tok.visionMeters !== null && tok.visionMeters !== undefined && tok.visionMeters !== '' && Number.isFinite(Number(tok.visionMeters))
        ? Math.max(0, Math.min(60, Number(tok.visionMeters)))
        : null,
    lightMeters: keepPresence
      ? Math.max(0, Math.min(60, Number(existingTpl.lightMeters) || 0))
      : Math.max(0, Math.min(60, Number(tok.lightMeters) || 0)),
    darkvision: keepPresence ? resolveTokenDarkvisionMeters(existingTpl) > 0 : resolveTokenDarkvisionMeters(tok) > 0,
    darkvisionMeters: keepPresence ? resolveTokenDarkvisionMeters(existingTpl) : resolveTokenDarkvisionMeters(tok),
    imageUrl: String(tok.imageUrl || '').trim(),
    mediaId: String(tok.mediaId || '').trim(),
    publicDescription: String(tok.publicDescription || '').trim(),
    privateNotes: String(tok.privateNotes || '').trim(),
    size: keepPresence ? clampTokenSize(existingTpl.size, 1) : clampTokenSize(tok.size, 1),
    hp,
    maxHp,
    ac: Math.max(1, Number(tok.ac) || 12),
    level: Math.max(1, Math.min(20, Number(tok.level) || 1)),
    speed: String(tok.speed || '30 ft'),
    stats: normalizeTemplateStats(tok.stats),
    texts: tok.texts && typeof tok.texts === 'object' ? JSON.parse(JSON.stringify(tok.texts)) : undefined,
    scores: tok.scores && typeof tok.scores === 'object' ? JSON.parse(JSON.stringify(tok.scores)) : undefined,
    saveProfs: tok.saveProfs && typeof tok.saveProfs === 'object' ? JSON.parse(JSON.stringify(tok.saveProfs)) : undefined,
    skills: Array.isArray(tok.skills) ? JSON.parse(JSON.stringify(tok.skills)) : [],
    traits: Array.isArray(tok.traits) ? JSON.parse(JSON.stringify(tok.traits)) : [],
    resources,
    inventory,
    starterItems,
    conditions: keepLiveHp && Array.isArray(tok.conditions) ? [...tok.conditions] : [],
    hpPips: keepLiveHp && Array.isArray(tok.hpPips) ? [...tok.hpPips] : undefined
  };
}

export function applyActorTemplateToLiveToken(tok, entry) {
  if (!tok || !entry) return false;
  const prevMax = Math.max(1, Number(tok.maxHp) || 16);
  const nextMax = Math.max(1, Number(entry.maxHp) || Number(entry.hp) || 16);
  const wasFull = (Number(tok.hp) || 0) >= prevMax;
  tok.name = entry.name || tok.name;
  tok.role = entry.role || tok.role;
  tok.color = entry.color || tok.color;
  tok.isAlly = entry.isAlly !== false;
  tok.size = clampTokenSize(entry.size, tok.size || 1);
  tok.ac = Math.max(1, Number(entry.ac) || tok.ac || 12);
  tok.maxHp = nextMax;
  if (wasFull) {
    tok.hp = nextMax;
  } else {
    tok.hp = Math.max(0, Math.min(nextMax, Number(tok.hp) || 0));
  }
  tok.visionMeters =
    entry.visionMeters !== null && entry.visionMeters !== undefined && entry.visionMeters !== '' && Number.isFinite(Number(entry.visionMeters))
      ? Math.max(0, Math.min(60, Number(entry.visionMeters)))
      : null;
  tok.lightMeters = Math.max(0, Math.min(60, Number(entry.lightMeters) || 0));
  tok.darkvisionMeters = resolveTokenDarkvisionMeters(entry);
  tok.darkvision = tok.darkvisionMeters > 0;
  tok.imageUrl = String(entry.imageUrl || '');
  tok.mediaId = String(entry.mediaId || '');
  tok.publicDescription = String(entry.publicDescription || '');
  if (entry.stats && typeof entry.stats === 'object') {
    tok.stats = normalizeTemplateStats(entry.stats, tok.stats);
  }
  if (Array.isArray(entry.inventory)) {
    tok.inventory = cloneInventoryForSpawn(entry.inventory, { freshUids: false });
  }
  return true;
}

export function syncLinkedProtagonistsToActorsInState(state) {
  if (!state || !Array.isArray(state.customActors) || !Array.isArray(state.tokens)) return 0;
  if (state.customActors.length === 0 || state.tokens.length === 0) return 0;
  const actorIndexByKey = new Map();
  state.customActors.forEach((a, i) => {
    if (a && a.key) actorIndexByKey.set(a.key, i);
  });
  let updated = 0;
  for (const tok of state.tokens) {
    if (!tok || tok.isAlly === false || !tok.actorKey) continue;
    const idx = actorIndexByKey.get(tok.actorKey);
    if (idx === undefined) continue;
    const existing = state.customActors[idx];
    if (!existing || existing.isAlly === false) continue;
    state.customActors[idx] = buildActorTemplateFromToken(tok, existing, {
      preserveLiveHp: true,
      preserveTemplatePresence: true
    });
    updated += 1;
  }
  return updated;
}
