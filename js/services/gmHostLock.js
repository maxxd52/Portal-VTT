/* ==========================================================================
   EXCLUSIVE PER-ROOM GM TAB LOCK (SINGLE-WRITER GUARD)
   ========================================================================== */

export function createGmHostLock({ locks } = {}) {
  let heldRoom = '';
  let releaseResolve = null;
  let activeRequestPromise = null;

  const normalizeCode = (roomCode) => String(roomCode || '').trim().toUpperCase();

  const release = async () => {
    const resolve = releaseResolve;
    const pending = activeRequestPromise;
    releaseResolve = null;
    activeRequestPromise = null;
    heldRoom = '';
    if (typeof resolve === 'function') {
      try {
        resolve();
      } catch (_) {}
    }
    if (pending) {
      try {
        await pending;
      } catch (_) {}
    }
  };

  const acquire = async (roomCode) => {
    const code = normalizeCode(roomCode);
    if (!code) return false;
    if (heldRoom === code) return true;
    if (heldRoom || activeRequestPromise) await release();

    const locksApi =
      locks ||
      (typeof navigator !== 'undefined' && navigator?.locks && typeof navigator.locks.request === 'function'
        ? navigator.locks
        : null);

    if (!locksApi || typeof locksApi.request !== 'function') {
      heldRoom = code;
      return true;
    }

    const lockName = `portal-vtt-gm:${code}`;
    return await new Promise((resolveAcquire) => {
      let settled = false;
      const settle = (ok) => {
        if (settled) return;
        settled = true;
        resolveAcquire(ok);
      };

      try {
        activeRequestPromise = locksApi
          .request(lockName, { mode: 'exclusive', ifAvailable: true }, (lock) => {
            if (!lock) {
              settle(false);
              return;
            }
            heldRoom = code;
            return new Promise((resolveHold) => {
              releaseResolve = resolveHold;
              settle(true);
            });
          })
          .catch(() => {
            settle(true);
          });
      } catch (_) {
        heldRoom = code;
        settle(true);
      }
    });
  };

  const isHolding = (roomCode) => {
    const code = normalizeCode(roomCode);
    return Boolean(code && heldRoom === code);
  };

  const getHeldRoom = () => heldRoom;

  return { acquire, release, isHolding, getHeldRoom };
}

export const GmHostLock = createGmHostLock();
