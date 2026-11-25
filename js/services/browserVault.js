/* ==========================================================================
   PERSISTENCIA LOCAL EN NAVEGADOR (INDEXEDDB VAULT)
   ========================================================================== */

export const BrowserVault = {
  dbName: 'PortalVaultDB',
  storeName: 'rooms',
  onSaveError: null,
  onSaveStateChange: null,
  _lastSavingState: false,
  _saveQueue: new Map(),

  async requestPersistentStorage() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
        return await navigator.storage.persist();
      }
    } catch (_) {}
    return false;
  },

  _notifySaveError(err, roomCode = '') {
    if (typeof this.onSaveError === 'function') {
      try {
        this.onSaveError(err, roomCode);
      } catch (_) {}
    }
  },

  _notifySaveState() {
    const saving = this.hasPendingSaves();
    if (saving === this._lastSavingState) return;
    this._lastSavingState = saving;
    if (typeof this.onSaveStateChange === 'function') {
      try {
        this.onSaveStateChange(saving);
      } catch (_) {}
    }
  },

  hasPendingSaves() {
    for (const entry of this._saveQueue.values()) {
      if (entry.timer || entry.inFlight || entry.pending) return true;
    }
    return false;
  },

  scheduleRoomSave(roomCode, getWorldFn, { immediate = false, delayMs = 240 } = {}) {
    const code = String(roomCode || '').trim();
    if (!code || typeof getWorldFn !== 'function') return Promise.resolve(false);

    let entry = this._saveQueue.get(code);
    if (!entry) {
      entry = { timer: null, inFlight: false, pending: null, waiters: [] };
      this._saveQueue.set(code, entry);
    }

    return new Promise((resolve) => {
      entry.pending = getWorldFn;
      entry.waiters.push(resolve);

      const kick = () => {
        if (entry.timer) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }
        if (entry.inFlight) return;
        this._drainRoomSave(code, entry);
      };

      if (immediate) {
        kick();
      } else {
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = setTimeout(kick, Math.max(0, Number(delayMs) || 0));
      }
      this._notifySaveState();
    });
  },

  async _drainRoomSave(code, entry) {
    entry.inFlight = true;
    try {
      while (entry.pending) {
        const snapshotFn = entry.pending;
        const batchWaiters = entry.waiters.splice(0, entry.waiters.length);
        entry.pending = null;
        let ok = false;
        try {
          const payload = snapshotFn();
          ok = await this.saveRoom(code, payload);
        } catch (err) {
          this._notifySaveError(err, code);
          ok = false;
        }
        for (const res of batchWaiters) res(ok);
      }
    } finally {
      entry.inFlight = false;
      if (!entry.timer && !entry.pending && entry.waiters.length === 0) {
        this._saveQueue.delete(code);
      }
      this._notifySaveState();
    }
  },

  flushPendingSaves() {
    for (const [code, entry] of this._saveQueue.entries()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      if (entry.pending && !entry.inFlight) {
        this._drainRoomSave(code, entry);
      }
    }
  },

  open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB no disponible'));
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveRoom(roomCode, serializableWorld) {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(serializableWorld, roomCode);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          this._notifySaveError(tx.error || new Error('Error de transacción IndexedDB'), roomCode);
          resolve(false);
        };
        tx.onabort = () => {
          this._notifySaveError(tx.error || new Error('Transacción IndexedDB abortada'), roomCode);
          resolve(false);
        };
      });
    } catch (err) {
      this._notifySaveError(err, roomCode);
      return false;
    }
  },

  async loadRoom(roomCode) {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get(roomCode);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  },

  async clearRoom(roomCode) {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).delete(roomCode);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) {
      return false;
    }
  },

  async saveShelf(shelfList) {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(shelfList, '__GLOBAL_SHELF__');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) {
      return false;
    }
  },

  async loadShelf() {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get('__GLOBAL_SHELF__');
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : null);
        req.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  },

  async listRooms() {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = async () => {
          const keys = (keysReq.result || []).filter((k) => k && k !== '__GLOBAL_SHELF__');
          const entries = await Promise.all(
            keys.map(
              (code) =>
                new Promise((res) => {
                  const getReq = store.get(code);
                  getReq.onsuccess = () => {
                    const world = getReq.result;
                    res({
                      code,
                      title: world?.moduleTitle || code,
                      ruleset: world?.systemConfig?.preset || world?.ruleset || 'free',
                      tokenCount: Array.isArray(world?.tokens) ? world.tokens.length : 0,
                      mapId: world?.mapId || 'empty'
                    });
                  };
                  getReq.onerror = () => res(null);
                })
            )
          );
          resolve(entries.filter(Boolean));
        };
        keysReq.onerror = () => resolve([]);
      });
    } catch (_) {
      return [];
    }
  }
};
