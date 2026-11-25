/* ==========================================================================
   JOURNAL REVEAL SERVICE: REVELACIÓN PROGRESIVA, APUNTES Y SYNC DIRIGIDO
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261125a1';
import {
  canSeatSeeJournalBlock,
  collectPlayerAuthorizedMedia,
  hashMediaSource,
  validatePlayerSnapshotAsset
} from '../utils/worldRedaction.js?v=20261125a1';
import { makeJId } from './journalService.js?v=20261125a1';
import { RealtimeBridge } from './realtimeBridge.js?v=20261125a1';

export const JournalRevealServiceMethods = {
  buildRevealedNoteForSeat(gmNote, seatKey) {
    if (!gmNote) return null;
    const isRevealed = Boolean(
      gmNote.revealedTo?.all ||
      (seatKey && Array.isArray(gmNote.revealedTo?.seatKeys) && gmNote.revealedTo.seatKeys.includes(seatKey))
    );
    if (!isRevealed) return null;
    const visibleBlocks = (Array.isArray(gmNote.blocks) ? gmNote.blocks : [])
      .filter((b) => canSeatSeeJournalBlock(b, seatKey))
      .map((b) => ({
        id: String(b.id || ''),
        heading: String(b.heading || ''),
        body: String(b.body || '')
      }));
    if (!visibleBlocks.length) return null;
    const allowMedia = gmNote.revealMedia !== false;
    const mediaId = allowMedia ? String(gmNote.mediaId || '') : '';
    return {
      id: String(gmNote.id || ''),
      title: String(gmNote.title || 'Nota'),
      gmFolder: String(gmNote.folder || ''),
      mediaId,
      imageUrl: allowMedia ? this.resolveMediaUrl(mediaId, gmNote.imageUrl || '') : '',
      blocks: visibleBlocks,
      updatedAt: Number(gmNote.updatedAt) || Date.now()
    };
  },

  syncRevealsForNote(note) {
    if (this.state.role !== 'gm' || !note) return;
    const seats = note.revealedTo?.all
      ? this._getJournalPlayerTargets()
      : (Array.isArray(note.revealedTo?.seatKeys) ? note.revealedTo.seatKeys : []);
    const mediaAsset = note.revealMedia !== false && note.mediaId ? this.state.mediaAssets?.[note.mediaId] || null : null;
    for (const seat of seats) {
      if (!seat || seat === 'gm') continue;
      const projected = this.buildRevealedNoteForSeat(note, seat);
      RealtimeBridge.sendToSeat(seat, {
        kind: 'JOURNAL_REVEALS_SYNC',
        noteId: note.id,
        note: projected,
        mediaAsset: projected && mediaAsset ? mediaAsset : null
      });
    }
  },

  presentJournalNote(noteId, { targetMode = 'all', targetSeatKeys = [], blockId = '', blockIds = null, includeImage = undefined } = {}) {
    if (this.state.role !== 'gm') return { ok: false, reason: 'forbidden' };
    const j = this.ensureJournalState();
    const note = j.gmNotes.find((n) => n.id === noteId);
    if (!note) return { ok: false, reason: 'not_found' };

    const allSeats = this._getJournalPlayerTargets();
    const cleanTargets = (Array.isArray(targetSeatKeys) ? targetSeatKeys : []).filter((s) => s && s !== 'gm');
    const targetSeats = targetMode === 'all' ? allSeats : cleanTargets;
    if (targetMode !== 'all' && targetSeats.length === 0) {
      return { ok: false, reason: 'no_targets' };
    }

    if (includeImage !== undefined) {
      note.revealMedia = Boolean(includeImage);
    }

    if (Array.isArray(blockIds)) {
      const selectedIds = new Set(blockIds.map((id) => String(id || '')).filter(Boolean));
      const matchingBlocks = (note.blocks || []).filter((b) => selectedIds.has(b.id));
      if (matchingBlocks.length === 0) {
        return { ok: false, reason: 'no_visible_blocks' };
      }
      const targetSeatSet = new Set(targetSeats);
      for (const blk of note.blocks || []) {
        const picked = selectedIds.has(blk.id);
        if (targetMode === 'all') {
          if (picked) {
            blk.visibility = 'all';
          } else {
            blk.visibility = 'private';
            blk.allowedSeatKeys = [];
          }
        } else if (picked) {
          if (blk.visibility !== 'all') {
            blk.visibility = 'players';
            const merged = new Set([...(Array.isArray(blk.allowedSeatKeys) ? blk.allowedSeatKeys : []), ...targetSeats]);
            blk.allowedSeatKeys = Array.from(merged);
          }
        } else if (blk.visibility === 'all') {
          const remaining = allSeats.filter((s) => !targetSeatSet.has(s));
          blk.visibility = remaining.length ? 'players' : 'private';
          blk.allowedSeatKeys = remaining;
        } else if (blk.visibility === 'players') {
          const remaining = (Array.isArray(blk.allowedSeatKeys) ? blk.allowedSeatKeys : []).filter((s) => !targetSeatSet.has(s));
          blk.visibility = remaining.length ? 'players' : 'private';
          blk.allowedSeatKeys = remaining;
        }
      }
    } else if (blockId) {
      const blk = (note.blocks || []).find((b) => b.id === blockId);
      if (!blk) return { ok: false, reason: 'block_not_found' };
      if (targetMode === 'all') {
        blk.visibility = 'all';
      } else if (blk.visibility !== 'all') {
        blk.visibility = 'players';
        const merged = new Set([...(Array.isArray(blk.allowedSeatKeys) ? blk.allowedSeatKeys : []), ...targetSeats]);
        blk.allowedSeatKeys = Array.from(merged);
      }
    } else {
      const hasVisible = targetSeats.length > 0
        ? targetSeats.some((s) => (note.blocks || []).some((b) => canSeatSeeJournalBlock(b, s)))
        : (note.blocks || []).some((b) => b.visibility === 'all');
      if (!hasVisible) {
        return { ok: false, reason: 'no_visible_blocks' };
      }
    }

    if (!note.revealedTo || typeof note.revealedTo !== 'object') {
      note.revealedTo = { all: false, seatKeys: [] };
    }
    if (targetMode === 'all') {
      note.revealedTo.all = true;
    } else {
      const prev = new Set(Array.isArray(note.revealedTo.seatKeys) ? note.revealedTo.seatKeys : []);
      targetSeats.forEach((s) => prev.add(s));
      note.revealedTo.seatKeys = Array.from(prev);
    }
    note.updatedAt = Date.now();

    const allowMedia = note.revealMedia !== false;
    const mediaAsset = allowMedia && note.mediaId ? this.state.mediaAssets?.[note.mediaId] || null : null;
    const deliveredSeats = [];
    for (const seat of targetSeats) {
      const projected = this.buildRevealedNoteForSeat(note, seat);
      if (!projected) continue;
      deliveredSeats.push(seat);
      RealtimeBridge.sendToSeat(seat, {
        kind: 'JOURNAL_PRESENT',
        note: projected,
        highlightBlockId: blockId || '',
        mediaAsset
      });
    }

    const previewNote =
      this.buildRevealedNoteForSeat(note, targetSeats[0] || '') ||
      {
        id: note.id,
        title: note.title,
        gmFolder: note.folder || '',
        mediaId: allowMedia ? (note.mediaId || '') : '',
        imageUrl: allowMedia ? this.resolveMediaUrl(note.mediaId, '') : '',
        blocks: (note.blocks || []).filter((b) => b.visibility !== 'private').map((b) => ({
          id: b.id,
          heading: b.heading,
          body: b.body
        })),
        updatedAt: note.updatedAt
      };
    this.state.activeJournalPresentation = {
      note: previewNote,
      highlightBlockId: blockId || ''
    };
    this.notify();
    return { ok: true, targetSeats: deliveredSeats };
  },

  closeJournalPresentation(forAll = false) {
    this.state.activeJournalPresentation = null;
    if (forAll && this.state.role === 'gm') {
      RealtimeBridge.send({ kind: 'JOURNAL_PRESENT_CLOSE' });
    }
    this.notify({ skipVaultSave: true, skipPeerSync: true });
  },

  receiveJournalPresentation(msg) {
    if (!msg || !msg.note || !msg.note.id) return;
    if (msg.mediaAsset?.id && msg.mediaAsset?.url) {
      const assets = this.ensureMediaAssets();
      assets[msg.mediaAsset.id] = msg.mediaAsset;
    }
    const j = this.ensureJournalState();
    const idx = j.receivedReveals.findIndex((r) => r.id === msg.note.id);
    if (idx >= 0) j.receivedReveals[idx] = msg.note;
    else j.receivedReveals.unshift(msg.note);

    this.state.activeJournalPresentation = {
      note: msg.note,
      highlightBlockId: String(msg.highlightBlockId || '')
    };
    if (!this.state.journalOpen) {
      this.journalUnreadCount = (Number(this.journalUnreadCount) || 0) + 1;
    }
    this.notify({ skipVaultSave: true, skipPeerSync: true });
  },

  receiveJournalRevealsSync(msg) {
    if (!msg || !msg.noteId) return;
    if (msg.mediaAsset?.id && msg.mediaAsset?.url) {
      const assets = this.ensureMediaAssets();
      assets[msg.mediaAsset.id] = msg.mediaAsset;
    }
    const j = this.ensureJournalState();
    const idx = j.receivedReveals.findIndex((r) => r.id === msg.noteId);
    if (!msg.note) {
      if (idx >= 0) j.receivedReveals.splice(idx, 1);
    } else if (idx >= 0) {
      j.receivedReveals[idx] = msg.note;
    } else {
      j.receivedReveals.unshift(msg.note);
    }
    if (this.state.activeJournalPresentation?.note?.id === msg.noteId) {
      if (msg.note) {
        this.state.activeJournalPresentation = {
          ...this.state.activeJournalPresentation,
          note: msg.note
        };
      } else {
        this.state.activeJournalPresentation = null;
      }
    }
    this.notify({ skipVaultSave: true, skipPeerSync: true });
  },

  _ensureRevealedAnnotation(gmNoteId) {
    const cleanId = String(gmNoteId || '').trim();
    if (!cleanId) return null;
    const seatKey = this.getSelfSeatKey();
    const pj = this.ensurePlayerJournal(seatKey);
    if (!pj) return null;
    if (!pj.revealedAnnotations[cleanId] || typeof pj.revealedAnnotations[cleanId] !== 'object') {
      pj.revealedAnnotations[cleanId] = { folder: '', blocks: [] };
    } else if (!Array.isArray(pj.revealedAnnotations[cleanId].blocks)) {
      pj.revealedAnnotations[cleanId].blocks = [];
    }
    return pj.revealedAnnotations[cleanId];
  },

  setRevealedNotePlayerFolder(gmNoteId, folder = '') {
    const ann = this._ensureRevealedAnnotation(gmNoteId);
    if (!ann) return false;
    const cleanFolder = String(folder || '').trim();
    ann.folder = cleanFolder;
    const pj = this.ensurePlayerJournal(this.getSelfSeatKey());
    if (cleanFolder && pj && !pj.folders.includes(cleanFolder)) {
      pj.folders.push(cleanFolder);
    }
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return true;
  },

  addRevealedNoteAnnotationBlock(gmNoteId, { heading = '', body = '' } = {}) {
    const ann = this._ensureRevealedAnnotation(gmNoteId);
    if (!ann) return null;
    const blk = {
      id: makeJId('pa'),
      heading: String(heading || '').trim(),
      body: String(body || '')
    };
    ann.blocks.push(blk);
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return blk;
  },

  updateRevealedNoteAnnotationBlock(gmNoteId, blockId, patch = {}) {
    const ann = this._ensureRevealedAnnotation(gmNoteId);
    const blk = ann?.blocks?.find((b) => b.id === blockId);
    if (!blk) return null;
    if (patch.heading !== undefined) blk.heading = String(patch.heading || '').trim();
    if (patch.body !== undefined) blk.body = String(patch.body || '');
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return blk;
  },

  deleteRevealedNoteAnnotationBlock(gmNoteId, blockId) {
    const ann = this._ensureRevealedAnnotation(gmNoteId);
    if (!ann) return false;
    const prev = ann.blocks.length;
    ann.blocks = ann.blocks.filter((b) => b.id !== blockId);
    if (ann.blocks.length === prev) return false;
    this.syncPlayerJournalToHost();
    this.notify({ skipPeerSync: true });
    return true;
  },

  syncPlayerJournalToHost() {
    if (this.state.role !== 'player') return;
    const seatKey = this.getSelfSeatKey();
    if (!seatKey || seatKey === 'gm') return;
    const pj = this.ensurePlayerJournal(seatKey);
    const snapshotAssets = {};
    const assets = this.state.mediaAssets || {};
    for (const note of pj.notes || []) {
      const mId = String(note?.mediaId || '').trim();
      const asset = mId ? assets[mId] : null;
      if (asset && asset.kind === 'snapshot' && typeof asset.url === 'string') {
        snapshotAssets[mId] = { ...asset };
      }
    }
    RealtimeBridge.sendToHost({
      kind: 'JOURNAL_PLAYER_SYNC',
      seatKey,
      inviteId: this.state.activeInviteId || '',
      clientId: this.clientId,
      playerJournal: JSON.parse(JSON.stringify(pj)),
      snapshotAssets
    });
  },

  applyPlayerJournalSync(msg) {
    if (this.state.role !== 'gm' || !msg) return false;
    const seatKey = String(msg.seatKey || msg.inviteId || '').trim();
    if (!seatKey || seatKey === 'gm' || !msg.playerJournal || typeof msg.playerJournal !== 'object') {
      return false;
    }
    const visibleTokenIds = new Set(Selector.getVisibleTokensForSeat(this.state, seatKey).map((t) => t.id));
    const authorizedIds = new Set(collectPlayerAuthorizedMedia(this.state, seatKey, { visibleTokenIds }).map((m) => m.mediaId));
    if (msg.snapshotAssets && typeof msg.snapshotAssets === 'object') {
      const assets = this.ensureMediaAssets();
      for (const [key, rawAsset] of Object.entries(msg.snapshotAssets)) {
        if (!validatePlayerSnapshotAsset(rawAsset)) continue;
        const id = rawAsset.id || key;
        assets[id] = {
          id,
          url: rawAsset.url,
          label: String(rawAsset.label || 'Vista de mesa').trim(),
          kind: 'snapshot',
          createdAt: Number(rawAsset.createdAt) || Date.now()
        };
        authorizedIds.add(id);
      }
    }
    const raw = msg.playerJournal;
    const folders = Array.isArray(raw.folders) ? raw.folders.map((f) => String(f || '').trim()).filter(Boolean) : [];
    const notes = Array.isArray(raw.notes)
      ? raw.notes.map((n) => {
          const mId = String(n?.mediaId || '').trim();
          const safeMediaId = mId && authorizedIds.has(mId) ? mId : '';
          return {
            id: String(n?.id || makeJId('pn')),
            title: String(n?.title || 'Nota').trim() || 'Nota',
            folder: String(n?.folder || '').trim(),
            mediaId: safeMediaId,
            sourceTokenId: String(n?.sourceTokenId || '').trim(),
            blocks: Array.isArray(n?.blocks)
              ? n.blocks.map((b) => ({
                  id: String(b?.id || makeJId('jb')),
                  heading: String(b?.heading || '').trim(),
                  body: String(b?.body || '')
                }))
              : [],
            createdAt: Number(n?.createdAt) || Date.now(),
            updatedAt: Number(n?.updatedAt) || Date.now()
          };
        })
      : [];
    const revealedAnnotations = {};
    if (raw.revealedAnnotations && typeof raw.revealedAnnotations === 'object') {
      for (const [gmNoteId, ann] of Object.entries(raw.revealedAnnotations)) {
        if (!gmNoteId || !ann || typeof ann !== 'object') continue;
        revealedAnnotations[gmNoteId] = {
          folder: String(ann.folder || '').trim(),
          blocks: Array.isArray(ann.blocks)
            ? ann.blocks.map((b) => ({
                id: String(b?.id || makeJId('pa')),
                heading: String(b?.heading || '').trim(),
                body: String(b?.body || '')
              }))
            : []
        };
      }
    }
    const j = this.ensureJournalState();
    j.playerJournals[seatKey] = { folders, notes, revealedAnnotations };
    this.notify({ skipPeerSync: true });
    return true;
  },

  saveInspectedTokenToJournal(tokenId) {
    const tok = (this.state.tokens || []).find((t) => t && t.id === tokenId);
    if (!tok) return null;
    if (this.state.role === 'player') {
      const seatKey = this.getSelfSeatKey();
      const isVisible = Selector.getVisibleTokensForSeat(this.state, seatKey).some((t) => t.id === tok.id);
      if (!isVisible) return null;
    }
    let mediaId = String(tok.mediaId || '').trim();
    if (!mediaId && tok.imageUrl) {
      mediaId = hashMediaSource(tok.imageUrl);
      if (mediaId) {
        const assets = this.ensureMediaAssets();
        if (!assets[mediaId]) {
          assets[mediaId] = {
            id: mediaId,
            url: String(tok.imageUrl),
            label: String(tok.name || 'Token'),
            kind: 'token',
            createdAt: Date.now()
          };
        }
      }
    }
    const desc = String(tok.publicDescription || '').trim();
    const created = this.createJournalNote({
      title: String(tok.name || 'PNJ'),
      folder: 'PNJs',
      mediaId,
      sourceTokenId: tok.id,
      blocks: [
        {
          heading: 'Descripción pública',
          body: desc || '(Sin descripción pública)'
        }
      ]
    });
    if (!created) return null;
    this.state.inspectTokenId = null;
    this.activeJournalNoteId = created.id;
    this.activeJournalNoteKind = this.state.role === 'gm' ? 'gm' : 'player';
    this.toggleJournal(true);
    return created;
  }
};
