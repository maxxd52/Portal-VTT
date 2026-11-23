import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
  _store: new Map(),
  getItem(k) {
    return this._store.has(k) ? this._store.get(k) : null;
  },
  setItem(k, v) {
    this._store.set(k, String(v));
  },
  removeItem(k) {
    this._store.delete(k);
  }
};

const {
  computeTokenAudioProfile,
  shouldCoalesceImpact,
  normalizeAudioPrefs,
  TabletopAudio
} = await import('../js/services/tabletopAudio.js?v=20261123a7');

test('computeTokenAudioProfile lowers pitch and deepens weight/decay as token size grows, with anti-fatigue jitter', () => {
  const std = computeTokenAudioProfile(1, 0.5);
  const large = computeTokenAudioProfile(2, 0.5);
  const colossal = computeTokenAudioProfile(4, 0.5);

  assert.ok(colossal.bodyFreqHz < large.bodyFreqHz && large.bodyFreqHz < std.bodyFreqHz);
  assert.ok(colossal.snapFreqHz < std.snapFreqHz);
  assert.ok(colossal.gain > large.gain && large.gain > std.gain);
  assert.ok(colossal.decaySec > std.decaySec);
  assert.equal(std.subGain, 0, 'standard token should not add heavy sub-thump');
  assert.ok(large.subGain > 0 && colossal.subGain > large.subGain, 'large/colossal tokens add deep sub-thump');

  // Random jitter produces subtle non-robotic pitch & volume variations
  const lowJitter = computeTokenAudioProfile(1, 0.0);
  const highJitter = computeTokenAudioProfile(1, 1.0);
  assert.notEqual(lowJitter.bodyFreqHz, highJitter.bodyFreqHz);
  assert.notEqual(lowJitter.gain, highJitter.gain);
  const ratio = highJitter.bodyFreqHz / lowJitter.bodyFreqHz;
  assert.ok(ratio > 1.05 && ratio < 1.25, `expected subtle pitch jitter ratio, got ${ratio}`);
});

test('shouldCoalesceImpact merges rapid simultaneous drops within window and allows distinct drops', () => {
  assert.equal(shouldCoalesceImpact(0, 100, 45), false);
  assert.equal(shouldCoalesceImpact(100, 120, 45), true);
  assert.equal(shouldCoalesceImpact(100, 144, 45), true);
  assert.equal(shouldCoalesceImpact(100, 150, 45), false);
});

test('TabletopAudio normalizes, persists volume/mute preferences, and safely no-ops without WebAudio', () => {
  assert.deepEqual(normalizeAudioPrefs(null), { volume: 0.75, muted: false });
  assert.deepEqual(normalizeAudioPrefs({ volume: 3, muted: 1 }), { volume: 1, muted: true });
  assert.deepEqual(normalizeAudioPrefs({ volume: -0.5, muted: false }), { volume: 0, muted: false });

  globalThis.localStorage._store.clear();
  TabletopAudio.loadPrefs();
  assert.equal(TabletopAudio.getEffectiveVolume(), 0.75);

  TabletopAudio.setVolume(0.4);
  assert.equal(TabletopAudio.getEffectiveVolume(), 0.4);

  TabletopAudio.toggleMute();
  assert.equal(TabletopAudio.getPrefs().muted, true);
  assert.equal(TabletopAudio.getEffectiveVolume(), 0);

  // Reloading from localStorage restores persisted preferences
  TabletopAudio._prefs = { volume: 1, muted: false };
  TabletopAudio.loadPrefs();
  assert.deepEqual(TabletopAudio.getPrefs(), { volume: 0.4, muted: true });

  // Calling playback methods in Node (no AudioContext) never throws
  assert.doesNotThrow(() => {
    TabletopAudio.setMuted(false);
    TabletopAudio.playTokenPickup(1);
    TabletopAudio.playTokenSlideTick(1);
    TabletopAudio.playTokenDrop(3);
    TabletopAudio.playWoodTap(0.5);
  });
});
