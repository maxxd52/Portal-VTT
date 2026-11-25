/* ==========================================================================
   GRAPHICS PROFILE MODEL: PURE UNIFIED QUALITY PRESETS & HARDWARE DETECTION
   ========================================================================== */

export const GRAPHICS_QUALITIES = ['auto', 'high', 'balanced', 'low'];

export const GRAPHICS_QUALITY_LABELS = {
  high: 'Alto',
  balanced: 'Equilibrado',
  low: 'Ligero'
};

const TIER_PRESETS = {
  high: {
    label: 'Alto',
    dynamicShadows: true,
    backdropBlur: 'full',
    weatherDensityScale: 1,
    weatherFpsScale: 1,
    lightAnimMinFrameMs: 62,
    diceMaxDpr: 2,
    diceShadows: true
  },
  balanced: {
    label: 'Equilibrado',
    dynamicShadows: true,
    backdropBlur: 'reduced',
    weatherDensityScale: 0.65,
    weatherFpsScale: 0.8,
    lightAnimMinFrameMs: 84,
    diceMaxDpr: 1.5,
    diceShadows: true
  },
  low: {
    label: 'Ligero',
    dynamicShadows: false,
    backdropBlur: 'none',
    weatherDensityScale: 0.35,
    weatherFpsScale: 0.6,
    lightAnimMinFrameMs: 125,
    diceMaxDpr: 1,
    diceShadows: false
  }
};

export function normalizeGraphicsQuality(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return GRAPHICS_QUALITIES.includes(key) ? key : 'auto';
}

export function migrateLegacyShadowMode(legacyShadowMode) {
  const key = String(legacyShadowMode || '').trim().toLowerCase();
  if (key === 'off') return 'low';
  if (key === 'on') return 'high';
  return 'auto';
}

export function detectAutoGraphicsTier(env = {}) {
  const cores = Number(env.hardwareConcurrency) || 0;
  const mem = Number(env.deviceMemory) || 0;
  const coarse = Boolean(env.isCoarsePointer);

  if (env.prefersReducedMotion) return 'low';
  if (mem > 0 && mem <= 2) return 'low';
  if (cores > 0 && cores <= 2) return 'low';
  if (cores > 0 && cores <= 4 && coarse) return 'low';

  if (mem > 0 && mem <= 4) return 'balanced';
  if (cores > 0 && cores <= 4) return 'balanced';
  if (coarse) return 'balanced';

  return 'high';
}

export function resolveGraphicsProfile(pref = 'auto', env = {}) {
  const cleanPref = normalizeGraphicsQuality(pref);
  const tier = cleanPref === 'auto' ? detectAutoGraphicsTier(env) : cleanPref;
  const preset = TIER_PRESETS[tier] || TIER_PRESETS.high;
  return {
    pref: cleanPref,
    tier,
    ...preset
  };
}
