/* ==========================================================================
   MEDIA REGISTRY SERVICE: POOL DEDUPLICADO Y RETENCIÓN DE IMÁGENES
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261123a7';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js?v=20261123a7';
import {
  collectPlayerAuthorizedMedia,
  collectReferencedMediaIds,
  hashMediaSource,
  normalizeMediaAssets
} from '../utils/worldRedaction.js?v=20261123a7';

export const MediaRegistryServiceMethods = {
  ensureMediaAssets() {
    if (!this.state.mediaAssets || typeof this.state.mediaAssets !== 'object') {
      this.state.mediaAssets = {};
    }
    return this.state.mediaAssets;
  },

  registerMediaAsset(url, { label = '', kind = 'token' } = {}) {
    const cleanUrl = DriveUrlHelper.toDirectImageUrl(url) || String(url || '').trim();
    if (!cleanUrl) return '';
    const assets = this.ensureMediaAssets();
    const id = hashMediaSource(cleanUrl);
    if (!id) return '';
    const prev = assets[id];
    assets[id] = {
      id,
      url: cleanUrl,
      label: String(label || prev?.label || 'Imagen de mesa').trim(),
      kind: String(kind || prev?.kind || 'token').trim() || 'token',
      createdAt: prev?.createdAt || Date.now()
    };
    return id;
  },

  resolveMediaUrl(mediaId, fallbackUrl = '') {
    const id = String(mediaId || '').trim();
    if (id && this.state.mediaAssets?.[id]?.url) {
      return this.state.mediaAssets[id].url;
    }
    return String(fallbackUrl || '').trim();
  },

  pruneUnusedMediaAssets() {
    const assets = this.ensureMediaAssets();
    const refs = collectReferencedMediaIds(this.state);
    let removed = 0;
    for (const id of Object.keys(assets)) {
      const urlHash = assets[id]?.url ? hashMediaSource(assets[id].url) : '';
      if (!refs.has(id) && (!urlHash || !refs.has(urlHash))) {
        delete assets[id];
        removed += 1;
      }
    }
    return removed;
  },

  syncAllMediaAssetsFromState() {
    const normalized = normalizeMediaAssets(this.state.mediaAssets);
    this.state.mediaAssets = normalized;
    for (const tok of this.state.tokens || []) {
      if (tok?.imageUrl && !tok.mediaId) {
        tok.mediaId = this.registerMediaAsset(tok.imageUrl, { label: tok.name, kind: 'token' });
      }
    }
    for (const actor of this.state.customActors || []) {
      if (actor?.imageUrl && !actor.mediaId) {
        actor.mediaId = this.registerMediaAsset(actor.imageUrl, { label: actor.name, kind: 'token' });
      }
    }
    for (const map of this.state.customMaps || []) {
      if (map?.imageUrl && !map.mediaId) {
        map.mediaId = this.registerMediaAsset(map.imageUrl, { label: map.name, kind: 'map' });
      }
    }
    return this.state.mediaAssets;
  },

  getAvailableTableImagesForCurrentRole() {
    if (this.state.role === 'player') {
      const seatKey = typeof this.getSelfSeatKey === 'function' ? this.getSelfSeatKey() : '';
      const visibleTokenIds = new Set(Selector.getVisibleTokensForSeat(this.state, seatKey).map((t) => t.id));
      return collectPlayerAuthorizedMedia(this.state, seatKey, { visibleTokenIds });
    }

    const byId = new Map();
    const add = (mediaId, rawUrl, label, kind) => {
      const url = DriveUrlHelper.toDirectImageUrl(rawUrl || '') || String(rawUrl || '').trim();
      const resolvedUrl = (mediaId && this.state.mediaAssets?.[mediaId]?.url) || url;
      if (!resolvedUrl) return;
      const id = String(mediaId || hashMediaSource(resolvedUrl)).trim();
      if (!id || byId.has(id)) return;
      byId.set(id, {
        mediaId: id,
        url: resolvedUrl,
        label: String(label || this.state.mediaAssets?.[id]?.label || 'Imagen').trim(),
        kind: String(kind || this.state.mediaAssets?.[id]?.kind || 'token')
      });
    };

    for (const asset of Object.values(this.ensureMediaAssets())) {
      if (asset) add(asset.id, asset.url, asset.label, asset.kind);
    }
    for (const tok of this.state.tokens || []) {
      if (tok) add(tok.mediaId, tok.imageUrl, tok.name, 'token');
    }
    for (const actor of this.state.customActors || []) {
      if (actor) add(actor.mediaId, actor.imageUrl, actor.name, 'token');
    }
    for (const map of this.state.customMaps || []) {
      if (map) add(map.mediaId, map.imageUrl, map.name, 'map');
    }
    if (this.state.activeHandout?.url) {
      add(this.state.activeHandout.mediaId, this.state.activeHandout.url, this.state.activeHandout.title, 'handout');
    }
    for (const note of this.state.journal?.gmNotes || []) {
      if (note) add(note.mediaId, note.imageUrl, note.title, 'journal');
    }
    return Array.from(byId.values());
  }
};
