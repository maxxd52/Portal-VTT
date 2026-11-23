/* ==========================================================================
   PICKER MODEL: PURE FOLDER GROUPING, ACCENT-INSENSITIVE SEARCH & POPOVER LAYOUT
   ========================================================================== */

export function normalizeSearchText(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function groupCompendiumItemsForPicker({
  customItems = [],
  baseItems = [],
  query = '',
  selectedKeys = []
} = {}) {
  const q = normalizeSearchText(query);
  const hasQuery = q.length > 0;
  const counts = new Map();
  (Array.isArray(selectedKeys) ? selectedKeys : []).forEach((k) => {
    if (!k) return;
    counts.set(k, (counts.get(k) || 0) + 1);
  });

  const customList = Array.isArray(customItems) ? customItems.filter(Boolean) : [];
  const baseList = Array.isArray(baseItems) ? baseItems.filter(Boolean) : [];

  const buckets = [];
  const bucketMap = new Map();
  const ensureBucket = (id, label, isCustom = false) => {
    if (!bucketMap.has(id)) {
      const b = { id, label, isCustom, items: [], selectedTotal: 0 };
      bucketMap.set(id, b);
      buckets.push(b);
    }
    return bucketMap.get(id);
  };

  // 1. Custom items with explicit folders first
  const customWithFolder = customList.filter((it) => String(it.folder || '').trim());
  const customWithoutFolder = customList.filter((it) => !String(it.folder || '').trim());
  for (const it of customWithFolder) {
    const folder = String(it.folder).trim();
    ensureBucket(`custom:${folder}`, folder, true).items.push(it);
  }
  if (customWithoutFolder.length > 0) {
    const b = ensureBucket('custom:__root__', 'Personalizados', true);
    customWithoutFolder.forEach((it) => b.items.push(it));
  }

  // 2. Base items without folder ("Equipo base") then base items grouped by folder (classes, etc.)
  const baseRoot = baseList.filter((it) => !String(it.folder || '').trim());
  const baseFoldered = baseList.filter((it) => String(it.folder || '').trim());
  if (baseRoot.length > 0) {
    const b = ensureBucket('base:__root__', 'Equipo base', false);
    baseRoot.forEach((it) => b.items.push(it));
  }
  for (const it of baseFoldered) {
    const folder = String(it.folder).trim();
    const id = bucketMap.has(`custom:${folder}`) ? `custom:${folder}` : `base:${folder}`;
    ensureBucket(id, folder, false).items.push(it);
  }

  let totalMatches = 0;
  const groups = [];
  for (const b of buckets) {
    const folderMatches = hasQuery && normalizeSearchText(b.label).includes(q);
    const matchedItems = [];
    for (const it of b.items) {
      if (hasQuery && !folderMatches) {
        const hay = `${normalizeSearchText(it.name)} ${normalizeSearchText(it.badge)} ${normalizeSearchText(it.folder)}`;
        if (!hay.includes(q)) continue;
      }
      const selectedCount = counts.get(it.key) || 0;
      matchedItems.push({ ...it, selectedCount });
    }
    if (matchedItems.length === 0) continue;
    const selectedTotal = matchedItems.reduce((acc, it) => acc + it.selectedCount, 0);
    totalMatches += matchedItems.length;
    groups.push({
      id: b.id,
      label: b.label,
      isCustom: b.isCustom,
      items: matchedItems,
      selectedTotal
    });
  }

  return { groups, totalMatches, hasQuery };
}

export function shouldShowSelectSearch(totalOptions = 0) {
  return Number(totalOptions) >= 9;
}

export function filterSelectOptionGroups(groups = [], query = '') {
  const q = normalizeSearchText(query);
  const list = Array.isArray(groups) ? groups : [];
  if (!q) {
    return list
      .map((g) => ({
        label: String(g?.label || ''),
        options: Array.isArray(g?.options) ? [...g.options] : []
      }))
      .filter((g) => g.options.length > 0);
  }

  const out = [];
  for (const g of list) {
    const groupLabel = String(g?.label || '');
    const groupMatches = groupLabel && normalizeSearchText(groupLabel).includes(q);
    const opts = (Array.isArray(g?.options) ? g.options : []).filter((o) => {
      if (groupMatches) return true;
      return normalizeSearchText(o?.label).includes(q);
    });
    if (opts.length > 0) {
      out.push({ label: groupLabel, options: opts });
    }
  }
  return out;
}

export function computeAnchoredDropdownPosition({
  triggerRect = { left: 0, top: 0, bottom: 30, width: 160 },
  menuWidth = 220,
  menuHeight = 200,
  viewportWidth = 1280,
  viewportHeight = 800,
  margin = 8,
  gap = 4
} = {}) {
  const vw = Math.max(120, Number(viewportWidth) || 1280);
  const vh = Math.max(120, Number(viewportHeight) || 800);
  const mw = Math.min(vw - margin * 2, Math.max(Number(triggerRect.width) || 120, Number(menuWidth) || 180));
  const mh = Math.min(vh - margin * 2, Math.max(48, Number(menuHeight) || 160));

  const spaceBelow = vh - (Number(triggerRect.bottom) || 0) - margin - gap;
  const spaceAbove = (Number(triggerRect.top) || 0) - margin - gap;

  let placement = 'bottom';
  let top = (Number(triggerRect.bottom) || 0) + gap;
  if (spaceBelow < mh && spaceAbove > spaceBelow) {
    placement = 'top';
    top = (Number(triggerRect.top) || 0) - mh - gap;
  }
  top = Math.max(margin, Math.min(vh - mh - margin, top));

  let left = Number(triggerRect.left) || margin;
  if (left + mw + margin > vw) {
    left = vw - mw - margin;
  }
  left = Math.max(margin, left);

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(mw),
    placement
  };
}
