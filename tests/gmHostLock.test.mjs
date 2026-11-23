import test from 'node:test';
import assert from 'node:assert/strict';

const { createGmHostLock } = await import('../js/services/gmHostLock.js?v=20261123a7');

function createMockLocksApi() {
  const active = new Map();
  return {
    async request(name, opts, cb) {
      const mode = opts?.mode || 'exclusive';
      const ifAvailable = Boolean(opts?.ifAvailable);
      if (mode === 'exclusive' && active.has(name)) {
        if (ifAvailable) return await cb(null);
      }
      const lockObj = { name, mode };
      active.set(name, lockObj);
      try {
        return await cb(lockObj);
      } finally {
        if (active.get(name) === lockObj) active.delete(name);
      }
    }
  };
}

test('GmHostLock enforces single-writer GM lock per room, allows different rooms, and releases cleanly', async () => {
  const locks = createMockLocksApi();
  const tabA = createGmHostLock({ locks });
  const tabB = createGmHostLock({ locks });

  assert.equal(await tabA.acquire('mesa-01'), true);
  assert.equal(tabA.isHolding('MESA-01'), true);

  // Second tab trying to acquire same room as GM must be rejected
  assert.equal(await tabB.acquire('MESA-01'), false);
  assert.equal(tabB.isHolding('MESA-01'), false);

  // Re-acquiring same room on holding tab is idempotent
  assert.equal(await tabA.acquire('MESA-01'), true);

  // Different room on Tab B succeeds
  assert.equal(await tabB.acquire('MESA-02'), true);
  assert.equal(tabB.isHolding('MESA-02'), true);

  // Releasing Tab A allows Tab B to acquire MESA-01 (and releases MESA-02)
  await tabA.release();
  assert.equal(tabA.isHolding('MESA-01'), false);
  assert.equal(await tabB.acquire('MESA-01'), true);
  assert.equal(tabB.isHolding('MESA-01'), true);
  assert.equal(tabB.isHolding('MESA-02'), false);

  await tabB.release();
});
