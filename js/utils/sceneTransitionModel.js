/* ==========================================================================
   SCENE TRANSITION MODEL: PURE SIGNATURE, META & TIMING HELPERS
   ========================================================================== */

export function buildSceneTransitionSignature(state) {
  if (!state || typeof state !== 'object') return '';
  const mapId = String(state.mapId || 'bastion');
  const activeKey = String(state.activeMapKey || mapId);
  const mode = state.sceneMode === 'narrative' ? 'narrative' : 'tactical';
  const customSrc = mapId === 'custom' ? String(state.customMapUrl || '').slice(0, 96) : '';
  return `${activeKey}|${mapId}|${mode}|${customSrc}`;
}

export function resolveSceneTransitionMeta(state, presetMaps = []) {
  const mapId = String(state?.mapId || 'bastion');
  const activeKey = String(state?.activeMapKey || mapId);
  const customList = Array.isArray(state?.customMaps) ? state.customMaps : [];
  const presets = Array.isArray(presetMaps) ? presetMaps : [];

  const customMatch = customList.find((m) => m && m.key === activeKey);
  const presetMatch = presets.find((m) => m && (m.key === activeKey || m.key === mapId));
  const title =
    String(customMatch?.name || presetMatch?.name || state?.room?.moduleTitle || 'Escenario').trim() ||
    'Escenario';

  const isNarrative = state?.sceneMode === 'narrative' || customMatch?.sceneMode === 'narrative';
  const subtitle = isNarrative ? 'Escena narrativa' : 'Escenario táctico';

  return { title, subtitle };
}

export function computeTransitionTimings({ reducedMotion = false, isInitialLoad = false } = {}) {
  if (reducedMotion) {
    return {
      fadeInMs: 360,
      minHoldMs: 420,
      decodeTimeoutMs: 900,
      backdropFadeOutMs: 520,
      titleLingerMs: 650,
      titleFadeOutMs: 480
    };
  }
  return {
    fadeInMs: 460,
    minHoldMs: isInitialLoad ? 500 : 520,
    decodeTimeoutMs: 1000,
    backdropFadeOutMs: 680,
    titleLingerMs: 850,
    titleFadeOutMs: 620
  };
}
