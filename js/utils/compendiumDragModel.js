/* ==========================================================================
   COMPENDIUM DRAG & FOLDER MODEL: PURE DROP RESOLUTION & FOLDER LOOKUP
   ========================================================================== */

const KIND_TO_TAB = {
  actor: 'actors',
  item: 'items',
  map: 'maps'
};

export function parseDragSpec(rawSpec) {
  const raw = String(rawSpec || '').trim();
  const idx = raw.indexOf(':');
  if (idx <= 0) return null;
  const kind = raw.slice(0, idx);
  const key = raw.slice(idx + 1).trim();
  const tab = KIND_TO_TAB[kind];
  if (!tab || !key) return null;
  return { kind, tab, key };
}

export function resolveEntryFolder(entry, tab, folderOverrides = null) {
  if (!entry || typeof entry !== 'object') return '';
  if (entry.isCustom) return String(entry.folder || '');
  const override = folderOverrides?.[tab]?.[entry.key];
  if (override !== undefined) return String(override || '');
  return String(entry.folder || '');
}

export function resolveDropAction({
  dragSpec = '',
  inStage = false,
  inTokenDrawer = false,
  folderTarget = '',
  inDrawerRoot = false,
  tokenId = '',
  inCharacterSheet = false,
  inMapNote = false
} = {}) {
  const parsed = parseDragSpec(dragSpec);
  if (!parsed) return { action: 'cancel' };

  if (inTokenDrawer) {
    const cleanFolder = String(folderTarget || '').trim();
    if (cleanFolder) {
      return { action: 'move_to_folder', tab: parsed.tab, key: parsed.key, folder: cleanFolder };
    }
    if (inDrawerRoot) {
      return { action: 'move_to_root', tab: parsed.tab, key: parsed.key };
    }
    return { action: 'cancel' };
  }

  if (parsed.kind === 'map') {
    return inStage ? { action: 'activate_map', key: parsed.key } : { action: 'cancel' };
  }

  if (parsed.kind === 'actor') {
    return inStage ? { action: 'spawn_actor', key: parsed.key } : { action: 'cancel' };
  }

  if (parsed.kind === 'item') {
    if (inMapNote) return { action: 'cancel' };
    if (inCharacterSheet) return { action: 'equip_item_selected', key: parsed.key };
    if (inStage && tokenId) return { action: 'equip_item', key: parsed.key, tokenId };
    return { action: 'cancel' };
  }

  return { action: 'cancel' };
}
