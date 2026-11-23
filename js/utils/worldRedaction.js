/* ==========================================================================
   WORLD REDACTION & MEDIA AUTHORIZATION (PURE HELPERS)
   ========================================================================== */

import { DriveUrlHelper } from './driveUrlHelper.js?v=20261123a7';
import { resolveTokenLightMeters } from './lightingModel.js?v=20261123a7';

/**
 * Computes a deterministic short asset identifier for an image URL or Data URL.
 * @param {string} rawSrc
 * @returns {string}
 */
export function hashMediaSource(rawSrc) {
  const src = String(rawSrc || '').trim();
  if (!src) return '';
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c + i) & 0xffff;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `media-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(4, '0').slice(0, 4)}`;
}

/**
 * Normalizes a mediaAssets dictionary into clean records.
 * @param {Record<string, any>} raw
 * @returns {Record<string, {id: string, url: string, label: string, kind: string, createdAt: number}>}
 */
export function normalizeMediaAssets(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== 'object') continue;
    const url = DriveUrlHelper.toDirectImageUrl(val.url || '') || String(val.url || '').trim();
    if (!url) continue;
    const id = String(val.id || key || hashMediaSource(url)).trim();
    if (!id) continue;
    out[id] = {
      id,
      url,
      label: String(val.label || '').trim(),
      kind: String(val.kind || 'token').trim() || 'token',
      createdAt: Number(val.createdAt) || 0
    };
  }
  return out;
}

/**
 * Returns whether a GM journal block is visible to the given player seat.
 * @param {object} block
 * @param {string} seatKey
 * @returns {boolean}
 */
export function canSeatSeeJournalBlock(block, seatKey) {
  if (!block || typeof block !== 'object') return false;
  if (block.visibility === 'all') return true;
  if (block.visibility === 'players') {
    return Boolean(seatKey) && Array.isArray(block.allowedSeatKeys) && block.allowedSeatKeys.includes(seatKey);
  }
  return false;
}

/**
 * Resolves the authoritative token IDs controlled by a specific seatKey.
 * @param {object} state
 * @param {string} seatKey
 * @returns {string[]}
 */
export function getSeatAllowedTokenIds(state, seatKey) {
  if (!seatKey || seatKey === 'gm') return (state?.tokens || []).map((t) => t.id);
  const invites = Array.isArray(state?.playerInvites) ? state.playerInvites : [];
  const inv = invites.find((i) => i && i.id === seatKey);
  if (!inv || !Array.isArray(inv.tokenIds)) return [];
  const allySet = new Set((state?.tokens || []).filter((t) => t && t.isAlly !== false).map((t) => t.id));
  return inv.tokenIds.filter((id) => allySet.has(id));
}

/**
 * Strips private sheet fields from a token when serialized for non-owners.
 * Precomputes lightMeters and hpPct so lighting, HP bar, and combat tracker keep working.
 * @param {object} tok
 * @returns {object}
 */
export function redactTokenForNonOwner(tok) {
  if (!tok || typeof tok !== 'object') return tok;
  const maxHp = Number(tok.maxHp) || 0;
  const hp = Math.max(0, Number(tok.hp) || 0);
  const hpPct = tok._redacted
    ? Math.max(0, Math.min(100, Number(tok.hpPct) || 0))
    : (maxHp > 0 ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100))) : 0);
  const defeated = tok._redacted
    ? Boolean(tok.defeated)
    : Boolean(maxHp > 0 && hp <= 0);
  const lightMeters = tok._redacted
    ? Math.max(0, Number(tok.lightMeters) || 0)
    : resolveTokenLightMeters(tok);

  return {
    id: tok.id,
    name: String(tok.name || ''),
    publicDescription: String(tok.publicDescription || ''),
    color: String(tok.color || '#8b5cf6'),
    isAlly: tok.isAlly !== false,
    imageUrl: String(tok.imageUrl || ''),
    mediaId: String(tok.mediaId || ''),
    size: Number(tok.size) || 1,
    x: Number(tok.x) || 0,
    y: Number(tok.y) || 0,
    hidden: Boolean(tok.hidden),
    conditions: Array.isArray(tok.conditions) ? [...tok.conditions] : [],
    auraRadius: Number(tok.auraRadius) || 0,
    visionMeters:
      tok.visionMeters !== null && tok.visionMeters !== undefined && tok.visionMeters !== ''
        ? Number(tok.visionMeters)
        : null,
    lightMeters,
    hpPct,
    defeated,
    _redacted: true
  };
}

/**
 * Merges incoming tokens into GM state without letting redacted tokens wipe GM private fields.
 * @param {Array<object>} existingTokens
 * @param {Array<object>} incomingTokens
 * @returns {Array<object>}
 */
export function mergeRedactedTokensPreservingGmPrivate(existingTokens, incomingTokens) {
  if (!Array.isArray(incomingTokens)) return Array.isArray(existingTokens) ? existingTokens : [];
  const existingById = new Map((Array.isArray(existingTokens) ? existingTokens : []).map((t) => [t.id, t]));
  return incomingTokens.map((tok) => {
    if (!tok || !tok._redacted) return tok;
    const prev = existingById.get(tok.id);
    if (!prev || prev._redacted) return tok;
    return {
      ...prev,
      x: Number.isFinite(Number(tok.x)) ? Number(tok.x) : prev.x,
      y: Number.isFinite(Number(tok.y)) ? Number(tok.y) : prev.y,
      conditions: Array.isArray(tok.conditions) ? [...tok.conditions] : prev.conditions
    };
  });
}

/**
 * Filters map pin notes by GM visibility.
 * @param {Array<object>} notes
 * @param {boolean} includeGmOnly
 * @returns {Array<object>}
 */
export function filterVisibleMapNotes(notes, includeGmOnly = false) {
  if (!Array.isArray(notes)) return [];
  const filtered = includeGmOnly ? notes : notes.filter((n) => !n?.gmOnly);
  return JSON.parse(JSON.stringify(filtered));
}

/**
 * Collects every mediaId (plus URL-derived hashes) still referenced anywhere in state,
 * including tokens, scenes, compendium, GM Screen pins, and ALL GM/player journals.
 * @param {object} state
 * @returns {Set<string>}
 */
export function collectReferencedMediaIds(state) {
  const refs = new Set();
  const addRef = (mediaId, url) => {
    const cleanId = String(mediaId || '').trim();
    if (cleanId) refs.add(cleanId);
    const cleanUrl = String(url || '').trim();
    if (cleanUrl) {
      const hashed = hashMediaSource(cleanUrl);
      if (hashed) refs.add(hashed);
    }
  };

  if (state?.customMapUrl) addRef('', state.customMapUrl);
  if (state?.activeHandout?.url) addRef(state.activeHandout.mediaId, state.activeHandout.url);

  for (const tok of state?.tokens || []) {
    if (tok) addRef(tok.mediaId, tok.imageUrl);
  }
  for (const actor of state?.customActors || []) {
    if (actor) addRef(actor.mediaId, actor.imageUrl);
  }
  for (const map of state?.customMaps || []) {
    if (map) addRef(map.mediaId, map.imageUrl);
  }
  if (state?.sceneLayers && typeof state.sceneLayers === 'object') {
    for (const layer of Object.values(state.sceneLayers)) {
      for (const tok of layer?.tokens || []) {
        if (tok) addRef(tok.mediaId, tok.imageUrl);
      }
    }
  }
  for (const pin of state?.gmScreen?.pins || []) {
    if (pin?.url) addRef(pin.mediaId, pin.url);
  }
  for (const note of state?.journal?.gmNotes || []) {
    if (note) addRef(note.mediaId, note.imageUrl);
  }
  for (const rev of state?.journal?.receivedReveals || []) {
    if (rev) addRef(rev.mediaId, rev.imageUrl);
  }
  const pJournals = state?.journal?.playerJournals;
  if (pJournals && typeof pJournals === 'object') {
    for (const pj of Object.values(pJournals)) {
      for (const note of pj?.notes || []) {
        if (note) addRef(note.mediaId, note.imageUrl);
      }
    }
  }
  return refs;
}

/**
 * Validates a player-captured table viewport snapshot before registering on GM host.
 * @param {object} asset
 * @param {number} [maxChars]
 * @returns {boolean}
 */
export function validatePlayerSnapshotAsset(asset, maxChars = 350000) {
  if (!asset || typeof asset !== 'object') return false;
  if (asset.kind !== 'snapshot') return false;
  const url = String(asset.url || '').trim();
  if (!url.startsWith('data:image/webp;base64,') || url.length > maxChars) return false;
  const expectedId = hashMediaSource(url);
  return Boolean(expectedId && asset.id === expectedId);
}

/**
 * Collects deduplicated table images authorized for a specific player seat.
 * Excludes hidden tokens, out-of-sight enemies when visibleTokenIds is provided,
 * unrevealed GM notes, custom compendium assets, and other players' journals.
 * @param {object} state
 * @param {string} seatKey
 * @param {{ visibleTokenIds?: Set<string>|string[]|null }} [opts]
 * @returns {Array<{mediaId: string, url: string, label: string, kind: string}>}
 */
export function collectPlayerAuthorizedMedia(state, seatKey, opts = {}) {
  const assets = state?.mediaAssets && typeof state.mediaAssets === 'object' ? state.mediaAssets : {};
  const byId = new Map();
  const visibleTokenSet = opts?.visibleTokenIds instanceof Set
    ? opts.visibleTokenIds
    : (Array.isArray(opts?.visibleTokenIds) ? new Set(opts.visibleTokenIds) : null);

  const registerItem = (rawMediaId, rawUrl, label, kind) => {
    const idFromAsset = rawMediaId && assets[rawMediaId] ? rawMediaId : '';
    const directUrl = DriveUrlHelper.toDirectImageUrl(rawUrl || '') || String(rawUrl || '').trim();
    const url = (idFromAsset && assets[idFromAsset]?.url) || directUrl;
    if (!url) return;
    const mediaId = String(rawMediaId || hashMediaSource(url)).trim();
    if (!mediaId || byId.has(mediaId)) return;
    byId.set(mediaId, {
      mediaId,
      url,
      label: String(label || assets[mediaId]?.label || 'Imagen de mesa').trim(),
      kind: String(assets[mediaId]?.kind || kind || 'token')
    });
  };

  for (const tok of state?.tokens || []) {
    if (!tok || tok.hidden) continue;
    if (visibleTokenSet && !visibleTokenSet.has(tok.id)) continue;
    registerItem(tok.mediaId, tok.imageUrl, tok.name || 'Token', 'token');
  }

  if (state?.activeHandout?.url) {
    registerItem(state.activeHandout.mediaId, state.activeHandout.url, state.activeHandout.title || 'Handout', 'handout');
  }

  for (const rev of state?.journal?.receivedReveals || []) {
    if (rev) registerItem(rev.mediaId, rev.imageUrl, rev.title || 'Pista', 'journal');
  }

  for (const note of state?.journal?.gmNotes || []) {
    if (!note) continue;
    const isRevealed = Boolean(
      note.revealedTo?.all ||
      (seatKey && Array.isArray(note.revealedTo?.seatKeys) && note.revealedTo.seatKeys.includes(seatKey))
    );
    const hasVisibleBlock = Array.isArray(note.blocks) && note.blocks.some((b) => canSeatSeeJournalBlock(b, seatKey));
    if (isRevealed && hasVisibleBlock) {
      registerItem(note.mediaId, note.imageUrl, note.title || 'Pista', 'journal');
    }
  }

  const ownJournal = seatKey && state?.journal?.playerJournals?.[seatKey];
  if (ownJournal && Array.isArray(ownJournal.notes)) {
    for (const note of ownJournal.notes) {
      if (note) registerItem(note.mediaId, note.imageUrl, note.title || 'Apunte', 'journal');
    }
  }

  return Array.from(byId.values());
}

/**
 * Resolves the double-click action for a token based on ownership and visibility.
 * @param {object} state
 * @param {object|null} tok
 * @param {boolean} canControl
 * @returns {'sheet'|'inspect'|'none'}
 */
export function resolveTokenDoubleClickAction(state, tok, canControl) {
  if (!tok) return 'none';
  if (canControl) return 'sheet';
  if (tok.hidden && state?.role !== 'gm') return 'none';
  return 'inspect';
}

/**
 * Redacts combat tracker state for a player seat so hidden GM tokens and private
 * turn order never leave the host over RealtimeBridge.
 * @param {object|null} combat
 * @param {Array<object>} tokens
 * @param {boolean} [trackerPublic]
 * @returns {{ active: boolean, round: number, turnIndex: number, order: Array<object> }}
 */
export function redactCombatForSeat(combat, tokens = [], trackerPublic = true) {
  if (!combat || typeof combat !== 'object' || !combat.active) {
    return { active: false, round: 1, turnIndex: 0, order: [] };
  }

  const round = Math.max(1, Math.trunc(Number(combat.round) || 1));
  const rawOrder = Array.isArray(combat.order) ? combat.order : [];
  const rawTurnIndex = Number.isFinite(Number(combat.turnIndex)) ? Math.trunc(Number(combat.turnIndex)) : -1;
  const tokensById = new Map((Array.isArray(tokens) ? tokens : []).filter(Boolean).map((t) => [t.id, t]));

  const visibleOrder = [];
  let mappedTurnIndex = -1;

  for (let i = 0; i < rawOrder.length; i++) {
    const entry = rawOrder[i];
    if (!entry || typeof entry !== 'object') continue;
    const rawIds = Array.isArray(entry.tokenIds) && entry.tokenIds.length
      ? entry.tokenIds
      : (entry.tokenId ? [entry.tokenId] : []);
    const visibleIds = rawIds.filter((id) => {
      const tok = tokensById.get(id);
      return Boolean(tok && !tok.hidden);
    });
    if (visibleIds.length === 0) continue;

    const firstTok = tokensById.get(visibleIds[0]);
    const trimmed = visibleIds.length !== rawIds.length;
    const isGroup = visibleIds.length > 1 && Boolean(entry.isGroup);
    let groupName = String(entry.groupName || firstTok?.name || '').trim();
    if (trimmed) {
      if (visibleIds.length === 1) {
        groupName = String(firstTok?.name || '').trim();
      } else {
        const baseName = String(firstTok?.name || 'Secundario').replace(/\s+\d+$/, '').trim() || 'Secundario';
        groupName = `${baseName} ×${visibleIds.length}`;
      }
    }

    const cleanEntry = {
      id: String(entry.id || visibleIds[0]),
      tokenId: visibleIds[0],
      tokenIds: [...visibleIds],
      groupName,
      isGroup,
      init: Number(entry.init) || 0,
      pending: Boolean(entry.pending)
    };
    if (entry.label) cleanEntry.label = String(entry.label);

    if (i === rawTurnIndex) {
      mappedTurnIndex = visibleOrder.length;
    }
    visibleOrder.push(cleanEntry);
  }

  if (trackerPublic === false) {
    if (mappedTurnIndex < 0 || !visibleOrder[mappedTurnIndex]) {
      return { active: true, round, turnIndex: -1, order: [] };
    }
    const activeOnly = {
      ...visibleOrder[mappedTurnIndex],
      init: 0,
      pending: false
    };
    delete activeOnly.label;
    return { active: true, round, turnIndex: 0, order: [activeOnly] };
  }

  return {
    active: true,
    round,
    turnIndex: mappedTurnIndex,
    order: visibleOrder
  };
}
