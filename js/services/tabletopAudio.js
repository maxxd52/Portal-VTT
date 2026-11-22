/* ==========================================================================
   TABLETOP AUDIO: PROCEDURAL TACTILE WEB AUDIO SYNTH FOR TOKENS & 3D DICE
   Zero external audio assets — pure filtered noise & damped sub-thump bursts.
   ========================================================================== */

const AUDIO_PREFS_STORAGE_KEY = 'portal_audio_prefs_v1';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function normalizeAudioPrefs(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const rawVol = Number(obj.volume);
  const volume = Number.isFinite(rawVol) ? clamp(rawVol, 0, 1) : 0.75;
  const muted = Boolean(obj.muted);
  return { volume: Number(volume.toFixed(2)), muted };
}

/**
 * Computes weight-scaled acoustic parameters from token size (in grid units).
 * Includes slight pitch/gain jitter to prevent ear fatigue on repeated moves.
 */
export function computeTokenAudioProfile(tokenSize = 1, randVal = Math.random()) {
  const size = clamp(Number(tokenSize) || 1, 0.5, 6);
  const r = clamp(Number.isFinite(Number(randVal)) ? Number(randVal) : 0.5, 0, 1);
  // 0 for tiny/standard (<=1), ramps smoothly up to 1 for colossal (>=4)
  const weight = clamp((size - 1) / 3, 0, 1);
  const pitchJitter = 0.92 + r * 0.16;
  const volJitter = 0.92 + (1 - r) * 0.16;

  const snapFreqHz = Math.round((2150 - weight * 1150) * pitchJitter);
  const bodyFreqHz = Math.round((430 - weight * 265) * pitchJitter);
  const subFreqHz = Math.round((120 - weight * 58) * pitchJitter);
  const gain = Number(((0.24 + weight * 0.30) * volJitter).toFixed(3));
  const subGain = size >= 2 ? Number(((0.14 + (weight * 0.24)) * volJitter).toFixed(3)) : 0;
  const decaySec = Number((0.024 + weight * 0.044).toFixed(4));

  return { weight, snapFreqHz, bodyFreqHz, subFreqHz, gain, subGain, decaySec };
}

/**
 * Returns true if a new drop impact occurs within the coalescing window of a previous impact.
 */
export function shouldCoalesceImpact(lastImpactMs, nowMs, windowMs = 45) {
  const last = Number(lastImpactMs) || 0;
  const now = Number(nowMs) || 0;
  if (last <= 0) return false;
  return now >= last && (now - last) < Math.max(10, Number(windowMs) || 45);
}

export const TabletopAudio = {
  ctx: null,
  noiseBuffer: null,
  _prefs: { volume: 0.75, muted: false },
  _lastDropMs: 0,
  _lastSlideMs: 0,

  loadPrefs() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUDIO_PREFS_STORAGE_KEY) : null;
      if (raw) {
        this._prefs = normalizeAudioPrefs(JSON.parse(raw));
        return this.getPrefs();
      }
    } catch (_) {}
    this._prefs = normalizeAudioPrefs(null);
    return this.getPrefs();
  },

  _savePrefs() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(this._prefs));
      }
    } catch (_) {}
  },

  getPrefs() {
    return { ...this._prefs };
  },

  setVolume(nextVol) {
    this._prefs = normalizeAudioPrefs({ ...this._prefs, volume: nextVol });
    if (this._prefs.volume > 0 && this._prefs.muted && nextVol > 0) {
      this._prefs.muted = false;
    }
    this._savePrefs();
    return this.getPrefs();
  },

  setMuted(muted) {
    this._prefs = normalizeAudioPrefs({ ...this._prefs, muted: Boolean(muted) });
    this._savePrefs();
    return this.getPrefs();
  },

  toggleMute() {
    return this.setMuted(!this._prefs.muted);
  },

  getEffectiveVolume() {
    return this._prefs.muted ? 0 : this._prefs.volume;
  },

  getContext() {
    if (this.getEffectiveVolume() <= 0) return null;
    if (typeof window === 'undefined') return null;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  getNoiseBuffer(ctx) {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) return this.noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 0.10);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  },

  _playFilteredNoise(ctx, { t0, freqHz, q = 1.4, gain, decaySec, filterType = 'bandpass' }) {
    if (gain <= 0.001) return;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freqHz;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0008, t0 + decaySec);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + decaySec + 0.006);
  },

  // Physical wood/resin impact for 3D dice (scaled by master audio prefs)
  playWoodTap(intensity = 1, delaySec = 0) {
    try {
      const vol = this.getEffectiveVolume();
      if (vol <= 0) return;
      const ctx = this.getContext();
      if (!ctx) return;
      const t0 = ctx.currentTime + delaySec;
      const level = clamp(intensity, 0.03, 1) * vol;
      const jitter = 0.86 + Math.random() * 0.28;

      this._playFilteredNoise(ctx, { t0, freqHz: 2250 * jitter, q: 1.6, gain: 0.32 * level, decaySec: 0.011 });
      this._playFilteredNoise(ctx, { t0, freqHz: 430 * jitter, q: 1.3, gain: 0.36 * level, decaySec: 0.024 });
    } catch (_) {}
  },

  playPickup(count = 1) {
    this.playWoodTap(0.28, 0);
    if (count > 1) {
      this.playWoodTap(0.20, 0.022 + Math.random() * 0.012);
    }
  },

  playThrow() {
    this.playWoodTap(0.14, 0);
  },

  // Crisp light lift sound when picking up a token off the table
  playTokenPickup(tokenSize = 1) {
    try {
      const vol = this.getEffectiveVolume();
      if (vol <= 0) return;
      const ctx = this.getContext();
      if (!ctx) return;
      const profile = computeTokenAudioProfile(tokenSize);
      const t0 = ctx.currentTime;
      this._playFilteredNoise(ctx, {
        t0,
        freqHz: profile.snapFreqHz * 1.15,
        q: 1.9,
        gain: 0.14 * vol,
        decaySec: 0.012
      });
      this._playFilteredNoise(ctx, {
        t0,
        freqHz: profile.bodyFreqHz * 1.3,
        q: 1.4,
        gain: 0.10 * vol,
        decaySec: 0.018
      });
    } catch (_) {}
  },

  // Subtle rate-limited felt/grid click when dragging across grid cells
  playTokenSlideTick(tokenSize = 1) {
    try {
      const vol = this.getEffectiveVolume();
      if (vol <= 0) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this._lastSlideMs < 75) return;
      this._lastSlideMs = now;
      const ctx = this.getContext();
      if (!ctx) return;
      const profile = computeTokenAudioProfile(tokenSize);
      const t0 = ctx.currentTime;
      this._playFilteredNoise(ctx, {
        t0,
        freqHz: profile.snapFreqHz * 0.88,
        q: 2.2,
        gain: 0.055 * vol,
        decaySec: 0.009
      });
    } catch (_) {}
  },

  // Weight-scaled tabletop landing thud with multi-drop coalescing
  playTokenDrop(tokenSize = 1, nowOverrideMs = null) {
    try {
      const vol = this.getEffectiveVolume();
      if (vol <= 0) return;
      const now = Number.isFinite(Number(nowOverrideMs))
        ? Number(nowOverrideMs)
        : (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (shouldCoalesceImpact(this._lastDropMs, now, 45)) return;
      this._lastDropMs = now;

      const ctx = this.getContext();
      if (!ctx) return;
      const profile = computeTokenAudioProfile(tokenSize);
      const t0 = ctx.currentTime;

      // 1. Dry wood/stone contact click
      this._playFilteredNoise(ctx, {
        t0,
        freqHz: profile.snapFreqHz,
        q: 1.5,
        gain: profile.gain * 0.72 * vol,
        decaySec: 0.014 + profile.weight * 0.008
      });

      // 2. Tabletop body resonance
      this._playFilteredNoise(ctx, {
        t0,
        freqHz: profile.bodyFreqHz,
        q: 1.25,
        gain: profile.gain * vol,
        decaySec: profile.decaySec
      });

      // 3. Damped low-end weight thump for large/colossal tokens (size >= 2)
      if (profile.subGain > 0) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(profile.subFreqHz * 1.25, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(36, profile.subFreqHz * 0.65), t0 + profile.decaySec + 0.03);
        gainNode.gain.setValueAtTime(profile.subGain * vol, t0);
        gainNode.gain.exponentialRampToValueAtTime(0.0008, t0 + profile.decaySec + 0.045);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + profile.decaySec + 0.05);
      }
    } catch (_) {}
  }
};
