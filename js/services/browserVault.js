/* ==========================================================================
   PERSISTENCIA LOCAL EN NAVEGADOR (INDEXEDDB VAULT)
   ========================================================================== */

export const BrowserVault = {
  dbName: 'OwlTableVaultDB',
  storeName: 'rooms',

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
        tx.onerror = () => resolve(false);
      });
    } catch (_) {
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
                      ruleset: world?.systemConfig?.preset || world?.ruleset || 'dnd55',
                      tokenCount: Array.isArray(world?.tokens) ? world.tokens.length : 0,
                      mapId: world?.mapId || 'bastion'
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
