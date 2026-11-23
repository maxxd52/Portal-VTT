/**
 * Pure presentation descriptors for Baúl (Compendium) items and scenario cards.
 * Kept DOM-free so unit tests run directly under Node.
 */

export function resolveItemBadgeStyle(size = 'md') {
  if (size === 'lg') {
    return {
      boxClass: 'w-11 h-11 rounded-xl',
      iconClass: 'w-[22px] h-[22px]',
      strokeWidth: 2.05,
      ring: true
    };
  }
  return {
    boxClass: 'w-7 h-7 rounded-lg',
    iconClass: 'w-[18px] h-[18px]',
    strokeWidth: 2.15,
    ring: false
  };
}

export function resolveMapCardDescriptor(map, activeSceneKey = '') {
  const key = String(map?.key || '');
  const name = String(map?.name || 'Escenario');
  const desc = String(map?.desc || '');
  const isActive = Boolean(key && activeSceneKey && key === activeSceneKey);
  const src = String(map?.imageUrl || '').trim();
  const sceneMode = map?.sceneMode === 'narrative' ? 'narrative' : 'tactical';

  if (map?.isCustom) {
    return {
      key,
      name,
      desc,
      isActive,
      sceneMode,
      kind: src ? 'image' : 'placeholder',
      src,
      presetId: ''
    };
  }

  return {
    key,
    name,
    desc,
    isActive,
    sceneMode,
    kind: 'preset',
    src: '',
    presetId: key
  };
}
