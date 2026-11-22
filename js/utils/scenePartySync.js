/* ==========================================================================
   SCENE PARTY SYNC: CONSERVACIÓN DE FICHAS ASIGNADAS ENTRE ESCENAS
   ========================================================================== */

export function getAssignedTokenIds(playerInvites) {
  const list = Array.isArray(playerInvites) ? playerInvites : [];
  const seen = new Set();
  const out = [];
  for (const inv of list) {
    const ids = Array.isArray(inv?.tokenIds) ? inv.tokenIds : [];
    for (const rawId of ids) {
      const id = typeof rawId === 'string' ? rawId.trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function findFreeSpawnPosition(existingTokens = [], grid = {}, slotIndex = 0, snapFn = null, sizeCells = 1) {
  const tokens = Array.isArray(existingTokens) ? existingTokens : [];
  const cs = Math.max(16, Number(grid?.cellSize) || 80);
  const ox = Number(grid?.offsetX) || 0;
  const oy = Number(grid?.offsetY) || 0;
  const size = Math.max(1, Number(sizeCells) || 1);

  const originX = Math.round((360 - ox) / cs) * cs + ox + (cs * size) / 2;
  const originY = Math.round((440 - oy) / cs) * cs + oy + (cs * size) / 2;
  const minDist = cs * 0.45;
  const startSlot = Math.max(0, Math.trunc(Number(slotIndex) || 0));

  const candidateAt = (idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const rawX = Math.max(80, Math.min(2320, originX + col * cs));
    const rawY = Math.max(80, Math.min(1520, originY + row * cs));
    const pos = typeof snapFn === 'function' ? snapFn(rawX, rawY, size) : { x: Math.round(rawX), y: Math.round(rawY) };
    return {
      x: Math.max(40, Math.min(2360, Number(pos?.x) || rawX)),
      y: Math.max(40, Math.min(1560, Number(pos?.y) || rawY))
    };
  };

  let fallback = null;
  for (let attempt = 0; attempt < 32; attempt++) {
    const pos = candidateAt((startSlot + attempt) % 32);
    if (attempt === 0) fallback = pos;
    const occupied = tokens.some((t) => Math.hypot((Number(t?.x) || 0) - pos.x, (Number(t?.y) || 0) - pos.y) < minDist);
    if (!occupied) return pos;
  }
  return fallback || candidateAt(0);
}

/**
 * Carries player-assigned ally tokens into targetTokens using their latest live stats,
 * preserving saved per-map coordinates when already present on the destination scene.
 */
export function mergeAssignedTokensForScene({
  targetTokens = [],
  sourceTokens = [],
  sceneLayers = {},
  playerInvites = [],
  grid = {},
  snapFn = null
} = {}) {
  const result = JSON.parse(JSON.stringify(Array.isArray(targetTokens) ? targetTokens : []));
  const assignedIds = getAssignedTokenIds(playerInvites);
  if (assignedIds.length === 0) return result;

  const liveById = new Map();
  for (const tok of Array.isArray(sourceTokens) ? sourceTokens : []) {
    if (tok?.id && tok.isAlly !== false && !liveById.has(tok.id)) {
      liveById.set(tok.id, tok);
    }
  }

  const missingIds = assignedIds.filter((id) => !liveById.has(id));
  if (missingIds.length > 0 && sceneLayers && typeof sceneLayers === 'object') {
    const needed = new Set(missingIds);
    for (const layer of Object.values(sceneLayers)) {
      for (const tok of Array.isArray(layer?.tokens) ? layer.tokens : []) {
        if (tok?.id && needed.has(tok.id) && tok.isAlly !== false && !liveById.has(tok.id)) {
          liveById.set(tok.id, tok);
        }
      }
    }
  }

  let spawnSlot = 0;
  for (const id of assignedIds) {
    const live = liveById.get(id);
    if (!live) continue;
    const clone = JSON.parse(JSON.stringify(live));
    const idx = result.findIndex((t) => t?.id === id);
    if (idx >= 0) {
      clone.x = result[idx].x;
      clone.y = result[idx].y;
      result[idx] = clone;
    } else {
      const pos = findFreeSpawnPosition(result, grid, spawnSlot++, snapFn, clone.size || 1);
      clone.x = pos.x;
      clone.y = pos.y;
      result.push(clone);
    }
  }

  return result;
}
