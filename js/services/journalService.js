/* ==========================================================================
   JOURNAL SERVICE: DIARIO UNIFICADO (CARPETAS, NOTAS Y BLOQUES)
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261125a1';
import { collectPlayerAuthorizedMedia } from '../utils/worldRedaction.js?v=20261125a1';
import { RealtimeBridge } from './realtimeBridge.js?v=20261125a1';

export const makeJId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const JournalServiceMethods = {
  ensureJournalState() {
    const j = this.state.journal;
    if (!j || typeof j !== 'object') {
      this.state.journal = { gmFolders: [], gmNotes: [], playerJournals: {}, receivedReveals: [] };
      return this.state.journal;
    }
    if (!Array.isArray(j.gmFolders)) j.gmFolders = [];
    if (!Array.isArray(j.gmNotes)) j.gmNotes = [];
    if (!j.playerJournals || typeof j.playerJournals !== 'object') j.playerJournals = {};
    if (!Array.isArray(j.receivedReveals)) j.receivedReveals = [];
    return j;
  },

  ensurePlayerJournal(seatKey) {
    const cleanSeat = String(seatKey || '').trim();
    if (!cleanSeat || cleanSeat === 'gm') return null;
    const j = this.ensureJournalState();
    const cur = j.playerJournals[cleanSeat];
    if (!cur || typeof cur !== 'object') {
      j.playerJournals[cleanSeat] = { folders: [], notes: [], revealedAnnotations: {} };
    } else {
      if (!Array.isArray(cur.folders)) cur.folders = [];
      if (!Array.isArray(cur.notes)) cur.notes = [];
      if (!cur.revealedAnnotations || typeof cur.revealedAnnotations !== 'object') {
        cur.revealedAnnotations = {};
      }
    }
    return j.playerJournals[cleanSeat];
  },

  _getJournalPlayerTargets() {
    const seats = new Set(Selector.getPlayerInvites(this.state).map((i) => i.id).filter(Boolean));
    for (const peer of this.peers instanceof Map ? this.peers.values() : []) {
      if (peer && peer.role !== 'gm') {
        const s = peer.inviteId || (peer.clientId ? `peer:${peer.clientId}` : '');
        if (s) seats.add(s);
      }
    }
    if (RealtimeBridge.seatConns instanceof Map) {
      for (const meta of RealtimeBridge.seatConns.values()) {
        if (meta && meta.role !== 'gm' && meta.seatKey) seats.add(meta.seatKey);
      }
    }
    return Array.from(seats);
  },

  toggleJournal(forceOpen) {
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !this.state.journalOpen;
    this.state.journalOpen = nextOpen;
    if (nextOpen) {
      this.state.drawerOpen = false;
      this.journalUnreadCount = 0;
    }
    this.notify({ skipVaultSave: true, skipPeerSync: true });
    return nextOpen;
  },

  createJournalFolder(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    const j = this.ensureJournalState();
    if (this.state.role === 'gm') {
      if (!j.gmFolders.includes(clean)) j.gmFolders.push(clean);
      this.notify();
      return true;
    }
    const seatKey = this.getSelfSeatKey();
    const pj = this.ensurePlayerJournal(seatKey);
    if (!pj) return false;
    if (!pj.folders.includes(clean)) pj.folders.push(clean);
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return true;
  },

  deleteJournalFolder(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    const j = this.ensureJournalState();
    if (this.state.role === 'gm') {
      j.gmFolders = j.gmFolders.filter((f) => f !== clean);
      j.gmNotes.forEach((n) => {
        if (n && n.folder === clean) n.folder = '';
      });
      this.notify();
      return true;
    }
    const seatKey = this.getSelfSeatKey();
    const pj = this.ensurePlayerJournal(seatKey);
    if (!pj) return false;
    pj.folders = pj.folders.filter((f) => f !== clean);
    pj.notes.forEach((n) => {
      if (n && n.folder === clean) n.folder = '';
    });
    Object.values(pj.revealedAnnotations || {}).forEach((ann) => {
      if (ann && ann.folder === clean) ann.folder = '';
    });
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return true;
  },

  _resolveAuthorizedPlayerMedia(seatKey, { mediaId = '', imageUrl = '' } = {}) {
    const visibleTokenIds = new Set(Selector.getVisibleTokensForSeat(this.state, seatKey).map((t) => t.id));
    const authorized = collectPlayerAuthorizedMedia(this.state, seatKey, { visibleTokenIds });
    const byId = new Map(authorized.map((a) => [a.mediaId, a]));
    const byUrl = new Map(authorized.map((a) => [a.url, a]));
    const cleanId = String(mediaId || '').trim();
    const cleanUrl = String(imageUrl || '').trim();
    if (!cleanId && !cleanUrl) return { ok: true, mediaId: '' };
    if (cleanId) {
      return byId.has(cleanId) ? { ok: true, mediaId: cleanId } : { ok: false, mediaId: '' };
    }
    const hit = byUrl.get(cleanUrl);
    return hit ? { ok: true, mediaId: hit.mediaId } : { ok: false, mediaId: '' };
  },

  createJournalNote({ title = 'Nueva nota', folder = '', mediaId = '', imageUrl = '', blocks = null, sourceTokenId = '' } = {}) {
    const j = this.ensureJournalState();
    const cleanTitle = String(title || 'Nueva nota').trim() || 'Nueva nota';
    const cleanFolder = String(folder || '').trim();
    const now = Date.now();

    if (this.state.role === 'gm') {
      let resolvedMediaId = String(mediaId || '').trim();
      if (!resolvedMediaId && imageUrl) {
        resolvedMediaId = this.registerMediaAsset(imageUrl, { label: cleanTitle, kind: 'journal' });
      }
      const normBlocks = Array.isArray(blocks) && blocks.length > 0
        ? blocks.map((b) => ({
            id: String(b?.id || makeJId('jb')),
            heading: String(b?.heading || '').trim(),
            body: String(b?.body || ''),
            visibility: ['private', 'all', 'players'].includes(b?.visibility) ? b.visibility : 'private',
            allowedSeatKeys: Array.isArray(b?.allowedSeatKeys) ? b.allowedSeatKeys.filter(Boolean) : []
          }))
        : [{ id: makeJId('jb'), heading: '', body: '', visibility: 'private', allowedSeatKeys: [] }];

      const note = {
        id: makeJId('jn'),
        title: cleanTitle,
        folder: cleanFolder,
        mediaId: resolvedMediaId,
        blocks: normBlocks,
        revealedTo: { all: false, seatKeys: [] },
        createdAt: now,
        updatedAt: now
      };
      j.gmNotes.unshift(note);
      if (cleanFolder && !j.gmFolders.includes(cleanFolder)) j.gmFolders.push(cleanFolder);
      this.notify();
      return note;
    }

    const seatKey = this.getSelfSeatKey();
    const pj = this.ensurePlayerJournal(seatKey);
    if (!pj) return null;
    const mediaCheck = this._resolveAuthorizedPlayerMedia(seatKey, { mediaId, imageUrl });
    if (!mediaCheck.ok) return null;

    const normBlocks = Array.isArray(blocks) && blocks.length > 0
      ? blocks.map((b) => ({
          id: String(b?.id || makeJId('jb')),
          heading: String(b?.heading || '').trim(),
          body: String(b?.body || '')
        }))
      : [{ id: makeJId('jb'), heading: '', body: '' }];

    const note = {
      id: makeJId('pn'),
      title: cleanTitle,
      folder: cleanFolder,
      mediaId: mediaCheck.mediaId,
      sourceTokenId: String(sourceTokenId || '').trim(),
      blocks: normBlocks,
      createdAt: now,
      updatedAt: now
    };
    pj.notes.unshift(note);
    if (cleanFolder && !pj.folders.includes(cleanFolder)) pj.folders.push(cleanFolder);
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return note;
  },

  _findEditableJournalNote(noteId) {
    const j = this.ensureJournalState();
    if (this.state.role === 'gm') {
      return j.gmNotes.find((n) => n.id === noteId) || null;
    }
    const pj = this.ensurePlayerJournal(this.getSelfSeatKey());
    return pj ? (pj.notes.find((n) => n.id === noteId) || null) : null;
  },

  updateJournalNote(noteId, patch = {}) {
    const note = this._findEditableJournalNote(noteId);
    if (!note) return null;
    if (patch.title !== undefined) {
      const t = String(patch.title || '').trim();
      if (t) note.title = t;
    }
    if (patch.folder !== undefined) {
      const f = String(patch.folder || '').trim();
      note.folder = f;
      if (f) {
        if (this.state.role === 'gm') {
          if (!this.state.journal.gmFolders.includes(f)) this.state.journal.gmFolders.push(f);
        } else {
          const pj = this.ensurePlayerJournal(this.getSelfSeatKey());
          if (pj && !pj.folders.includes(f)) pj.folders.push(f);
        }
      }
    }
    if (patch.mediaId !== undefined || patch.imageUrl !== undefined) {
      if (this.state.role === 'gm') {
        if (patch.mediaId === '' && !patch.imageUrl) {
          note.mediaId = '';
        } else if (patch.mediaId) {
          note.mediaId = String(patch.mediaId).trim();
        } else if (patch.imageUrl) {
          note.mediaId = this.registerMediaAsset(patch.imageUrl, { label: note.title, kind: 'journal' });
        }
        this.pruneUnusedMediaAssets?.();
      } else {
        const mediaCheck = this._resolveAuthorizedPlayerMedia(this.getSelfSeatKey(), {
          mediaId: patch.mediaId,
          imageUrl: patch.imageUrl
        });
        if (!mediaCheck.ok) return null;
        note.mediaId = mediaCheck.mediaId;
      }
    }
    if (Array.isArray(patch.blocks)) {
      const prevById = new Map((Array.isArray(note.blocks) ? note.blocks : []).map((b) => [b.id, b]));
      const rawBlocks = patch.blocks.length > 0 ? patch.blocks : [{ heading: '', body: '' }];
      if (this.state.role === 'gm') {
        note.blocks = rawBlocks.map((b) => {
          const id = String(b?.id || makeJId('jb'));
          const prev = prevById.get(id);
          const vis = ['private', 'all', 'players'].includes(b?.visibility)
            ? b.visibility
            : (prev?.visibility || 'private');
          const allowed = Array.isArray(b?.allowedSeatKeys)
            ? b.allowedSeatKeys.filter(Boolean)
            : (Array.isArray(prev?.allowedSeatKeys) ? prev.allowedSeatKeys.filter(Boolean) : []);
          return {
            id,
            heading: String(b?.heading || '').trim(),
            body: String(b?.body || ''),
            visibility: vis,
            allowedSeatKeys: allowed
          };
        });
      } else {
        note.blocks = rawBlocks.map((b) => ({
          id: String(b?.id || makeJId('jb')),
          heading: String(b?.heading || '').trim(),
          body: String(b?.body || '')
        }));
      }
    }
    note.updatedAt = Date.now();
    if (this.state.role === 'gm') {
      if (note.revealedTo?.all || (Array.isArray(note.revealedTo?.seatKeys) && note.revealedTo.seatKeys.length > 0)) {
        this.syncRevealsForNote(note);
      }
      this.notify();
    } else {
      this.syncPlayerJournalToHost();
      this.notify({ skipPeerSync: true });
    }
    return note;
  },

  /**
   * Registers a viewport table snapshot (WebP Data URL) and attaches it to a note.
   * Safe for both GM and Player roles; players sync snapshots to host via JOURNAL_PLAYER_SYNC.
   */
  attachTableSnapshotToJournalNote(noteId, dataUrl, label = 'Vista de mesa') {
    const cleanUrl = String(dataUrl || '').trim();
    if (!cleanUrl.startsWith('data:image/webp;base64,') || cleanUrl.length > 350000) {
      return null;
    }
    const note = this._findEditableJournalNote(noteId);
    if (!note) return null;
    const mediaId = this.registerMediaAsset(cleanUrl, {
      label: String(label || note.title || 'Vista de mesa').trim(),
      kind: 'snapshot'
    });
    if (!mediaId) return null;
    if (this.state.role === 'gm') {
      return this.updateJournalNote(noteId, { mediaId });
    }
    note.mediaId = mediaId;
    note.updatedAt = Date.now();
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return note;
  },

  deleteJournalNote(noteId) {
    const j = this.ensureJournalState();
    if (this.state.role === 'gm') {
      const target = j.gmNotes.find((n) => n.id === noteId);
      if (!target) return false;
      j.gmNotes = j.gmNotes.filter((n) => n.id !== noteId);
      if (target.revealedTo?.all || target.revealedTo?.seatKeys?.length) {
        this.syncRevealsForNote({ ...target, blocks: [] });
      }
      this.pruneUnusedMediaAssets?.();
      this.notify();
      return true;
    }
    const pj = this.ensurePlayerJournal(this.getSelfSeatKey());
    if (!pj) return false;
    const prev = pj.notes.length;
    pj.notes = pj.notes.filter((n) => n.id !== noteId);
    if (pj.notes.length === prev) return false;
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return true;
  },

  addJournalBlock(noteId, { heading = '', body = '', visibility = 'private', allowedSeatKeys = [] } = {}) {
    const note = this._findEditableJournalNote(noteId);
    if (!note) return null;
    if (!Array.isArray(note.blocks)) note.blocks = [];
    const block = this.state.role === 'gm'
      ? {
          id: makeJId('jb'),
          heading: String(heading || '').trim(),
          body: String(body || ''),
          visibility: ['private', 'all', 'players'].includes(visibility) ? visibility : 'private',
          allowedSeatKeys: Array.isArray(allowedSeatKeys) ? allowedSeatKeys.filter(Boolean) : []
        }
      : { id: makeJId('jb'), heading: String(heading || '').trim(), body: String(body || '') };
    note.blocks.push(block);
    note.updatedAt = Date.now();
    if (this.state.role === 'gm') {
      if (block.visibility !== 'private' && (note.revealedTo?.all || note.revealedTo?.seatKeys?.length)) {
        this.syncRevealsForNote(note);
      }
      this.notify();
    } else {
      this.syncPlayerJournalToHost();
      this.notify({ skipPeerSync: true });
    }
    return block;
  },

  updateJournalBlock(noteId, blockId, patch = {}) {
    const note = this._findEditableJournalNote(noteId);
    const blk = note?.blocks?.find((b) => b.id === blockId);
    if (!blk) return null;
    if (patch.heading !== undefined) blk.heading = String(patch.heading || '').trim();
    if (patch.body !== undefined) blk.body = String(patch.body || '');
    if (this.state.role === 'gm') {
      if (patch.visibility !== undefined && ['private', 'all', 'players'].includes(patch.visibility)) {
        blk.visibility = patch.visibility;
      }
      if (patch.allowedSeatKeys !== undefined) {
        blk.allowedSeatKeys = Array.isArray(patch.allowedSeatKeys) ? patch.allowedSeatKeys.filter(Boolean) : [];
      }
      note.updatedAt = Date.now();
      if (note.revealedTo?.all || (Array.isArray(note.revealedTo?.seatKeys) && note.revealedTo.seatKeys.length > 0)) {
        this.syncRevealsForNote(note);
      }
      this.notify();
    } else {
      note.updatedAt = Date.now();
      this.syncPlayerJournalToHost();
      this.notify({ skipPeerSync: true });
    }
    return blk;
  },

  deleteJournalBlock(noteId, blockId) {
    const note = this._findEditableJournalNote(noteId);
    if (!note || !Array.isArray(note.blocks)) return false;
    const prev = note.blocks.length;
    note.blocks = note.blocks.filter((b) => b.id !== blockId);
    if (note.blocks.length === prev) return false;
    note.updatedAt = Date.now();
    if (this.state.role === 'gm') {
      if (note.revealedTo?.all || note.revealedTo?.seatKeys?.length) {
        this.syncRevealsForNote(note);
      }
      this.notify();
    } else {
      this.syncPlayerJournalToHost();
      this.notify({ skipPeerSync: true });
    }
    return true;
  },

  moveJournalBlock(noteId, blockId, delta = 1) {
    const note = this._findEditableJournalNote(noteId);
    if (!note || !Array.isArray(note.blocks)) return false;
    const idx = note.blocks.findIndex((b) => b.id === blockId);
    const nextIdx = idx + (delta < 0 ? -1 : 1);
    if (idx < 0 || nextIdx < 0 || nextIdx >= note.blocks.length) return false;
    const [moved] = note.blocks.splice(idx, 1);
    note.blocks.splice(nextIdx, 0, moved);
    note.updatedAt = Date.now();
    if (this.state.role === 'gm') {
      if (note.revealedTo?.all || note.revealedTo?.seatKeys?.length) {
        this.syncRevealsForNote(note);
      }
      this.notify();
    } else {
      this.syncPlayerJournalToHost();
      this.notify({ skipPeerSync: true });
    }
    return true;
  }
};
