/* ==========================================================================
   CONTEXT MENU MODEL: PURE APPLE-STYLE SPEC BUILDERS & SMART POSITIONING
   ========================================================================== */

import { getWallDoorMode, isWallDoor, normalizeWallKind } from './wallGeometry.js?v=20261125a1';

const DEFAULT_MARGIN = 8;
const FLIP_GAP = 6;

export function computeContextMenuPosition({
  clientX = 0,
  clientY = 0,
  menuWidth = 248,
  menuHeight = 200,
  viewportWidth = 1280,
  viewportHeight = 800,
  scale = 1,
  margin = DEFAULT_MARGIN
} = {}) {
  const safeScale = Number(scale) > 0 ? Number(scale) : 1;
  const vw = Math.max(1, Number(viewportWidth) / safeScale);
  const vh = Math.max(1, Number(viewportHeight) / safeScale);
  const px = Number(clientX) / safeScale;
  const py = Number(clientY) / safeScale;
  const mw = Math.max(120, Number(menuWidth) || 248);
  const mh = Math.max(60, Number(menuHeight) || 180);

  let left = px;
  let horiz = 'left';
  if (px + mw + margin > vw) {
    left = px - mw - FLIP_GAP;
    horiz = 'right';
  }
  left = Math.min(vw - mw - margin, Math.max(margin, left));

  let top = py;
  let vert = 'top';
  if (py + mh + margin > vh) {
    top = py - mh - FLIP_GAP;
    vert = 'bottom';
  }
  top = Math.min(vh - mh - margin, Math.max(margin, top));

  return {
    left: Math.round(left),
    top: Math.round(top),
    origin: `${vert} ${horiz}`
  };
}

export function resolveDiceBarContextAction(dieKey, hand = []) {
  if (dieKey === null || dieKey === undefined || dieKey === '') {
    return { kind: 'bar-menu' };
  }
  const normalizedHand = Array.isArray(hand) ? hand : [];
  if (normalizedHand.includes(dieKey)) {
    return { kind: 'remove-from-hand', die: dieKey };
  }
  return { kind: 'die-menu', die: dieKey };
}

export function buildDiceDieMenuSpec(dieKey, { modifier = 0, deckRemaining = 54 } = {}) {
  const modNum = Number(modifier) || 0;
  const modSuffix = modNum !== 0 ? ` ${modNum > 0 ? '+' : ''}${modNum}` : '';

  if (dieKey === 'card') {
    return {
      header: { title: 'Baraja', subtitle: `${deckRemaining}/54` },
      sections: [
        [
          { id: 'draw-card', icon: 'cards', label: 'Sacar 1 carta ahora' },
          { id: 'shuffle-deck', icon: 'shuffle', label: 'Mezclar baraja' }
        ]
      ]
    };
  }

  if (dieKey === 'fudge') {
    return {
      header: { title: 'Dado Fudge (dF)', subtitle: modSuffix.trim() || 'Fate' },
      sections: [
        [
          { id: 'roll-fudge-4', icon: 'dice', label: `Tirar 4dF ahora${modSuffix}` },
          { id: 'add-one', icon: 'plus', label: 'Añadir 1 dF a la mano' }
        ]
      ]
    };
  }

  const sides = Number(dieKey) || 20;
  if (sides === 2) {
    return {
      header: { title: 'Moneda', subtitle: 'Cara / Cruz' },
      sections: [
        [
          { id: 'roll-coin', icon: 'coin', label: 'Lanzar moneda ahora' },
          { id: 'add-two', icon: 'plus', label: 'Añadir ×2 a la mano' }
        ]
      ]
    };
  }

  return {
    header: { title: `Dado d${sides}`, subtitle: modSuffix.trim() },
    sections: [
      [
        { id: 'roll-now', icon: 'dice', label: `Tirar 1d${sides} ahora${modSuffix}` },
        { id: 'roll-adv', icon: 'arrow-up', label: `Ventaja (2d${sides} Máx)` },
        { id: 'roll-dis', icon: 'arrow-down', label: `Desventaja (2d${sides} Mín)` }
      ],
      [
        { id: 'add-two', icon: 'plus', label: `Añadir 2d${sides} a la mano` }
      ]
    ]
  };
}

export function buildDiceBarMenuSpec({
  hand = [],
  modifier = 0,
  visibility = 'public',
  historyCount = 0
} = {}) {
  const handCount = Array.isArray(hand) ? hand.length : 0;
  const modNum = Number(modifier) || 0;
  const sections = [];

  const quickResetSection = [];
  if (handCount > 0) {
    quickResetSection.push({
      id: 'clear-hand',
      icon: 'hand',
      label: 'Vaciar mano',
      value: `${handCount}`
    });
  }
  if (modNum !== 0) {
    quickResetSection.push({
      id: 'reset-mod',
      icon: 'rotate-ccw',
      label: 'Restablecer modificador',
      value: '+0'
    });
  }
  if (quickResetSection.length > 0) sections.push(quickResetSection);

  sections.push([
    {
      id: 'vis-public',
      icon: 'globe',
      label: 'Tiradas públicas',
      checked: visibility !== 'private'
    },
    {
      id: 'vis-private',
      icon: 'lock',
      label: 'Tiradas privadas',
      checked: visibility === 'private'
    }
  ]);

  sections.push([
    { id: 'open-customize', icon: 'palette', label: 'Personalizar dados…' },
    {
      id: 'open-history',
      icon: 'clock',
      label: 'Historial de tiradas',
      value: historyCount > 0 ? String(historyCount) : ''
    }
  ]);

  if (historyCount > 0) {
    sections.push([
      { id: 'clear-history', icon: 'trash', label: 'Limpiar historial', danger: true }
    ]);
  }

  return {
    header: { title: 'Barra de Dados', subtitle: modNum !== 0 ? `Mod ${modNum > 0 ? '+' : ''}${modNum}` : '' },
    sections
  };
}

export function buildMapMenuSpec({
  role = 'gm',
  dynamicLighting = false,
  hasOwnedToken = false,
  isNarrative = false
} = {}) {
  if (role === 'gm' && isNarrative) {
    return {
      showToolsRow: false,
      sections: []
    };
  }
  if (role !== 'gm') {
    const primary = [
      { id: 'ping-here', icon: 'radio', label: 'Ping aquí', shortcut: 'G' },
      { id: 'measure-here', icon: 'ruler', label: 'Medir desde aquí', shortcut: 'R' }
    ];
    const camera = [];
    if (hasOwnedToken) {
      camera.push({ id: 'focus-my-token', icon: 'crosshair', label: 'Centrar en mi ficha' });
    }
    camera.push({ id: 'reset-zoom', icon: 'search', label: 'Restablecer zoom' });
    return {
      showToolsRow: false,
      sections: [primary, camera]
    };
  }

  return {
    showToolsRow: true,
    sections: [
      [
        { id: 'ping-here', icon: 'radio', label: 'Ping aquí', shortcut: 'G' },
        { id: 'add-note', icon: 'pin', label: 'Fijar nota aquí…' }
      ],
      [
        {
          id: 'toggle-dynlight',
          icon: 'bulb',
          label: 'Luz dinámica',
          checked: Boolean(dynamicLighting)
        },
        { id: 'open-grid', icon: 'sliders', label: 'Escenario (Grilla y Luz)…' }
      ]
    ]
  };
}

export function buildMapLightMenuSpec(light = {}) {
  const enabled = light?.enabled !== false;
  return {
    header: {
      title: 'Luz de escenario',
      subtitle: enabled ? 'Encendida' : 'Apagada'
    },
    sections: [
      [
        {
          id: 'toggle-enabled',
          icon: enabled ? 'eye-off' : 'bulb',
          label: enabled ? 'Apagar luz' : 'Encender luz',
          checked: enabled
        }
      ],
      [
        {
          id: 'delete-light',
          icon: 'trash',
          label: 'Eliminar luz',
          danger: true
        }
      ]
    ]
  };
}

export function parseHpInputExpression(raw, currentHp = 0, maxHp = 999) {
  const txt = String(raw ?? '').trim();
  if (!txt) return null;
  const upper = Math.max(1, Number(maxHp) || 999);
  const cur = Math.max(0, Number(currentHp) || 0);
  const relMatch = txt.match(/^([+-])\s*(\d+)$/);
  if (relMatch) {
    const sign = relMatch[1] === '-' ? -1 : 1;
    const delta = Number(relMatch[2]);
    return Math.max(0, Math.min(upper, cur + sign * delta));
  }
  const absMatch = txt.match(/^(\d+)$/);
  if (absMatch) {
    return Math.max(0, Math.min(upper, Number(absMatch[1])));
  }
  return null;
}

export function stepPresetValue(currentVal, presets = [], dir = 1) {
  const list = Array.isArray(presets) ? presets : [];
  if (list.length === 0) return currentVal;
  const step = dir < 0 ? -1 : 1;

  const exactIdx = list.findIndex((v) =>
    v === null ? currentVal === null || currentVal === undefined || currentVal === '' : Number(v) === Number(currentVal)
  );
  if (exactIdx >= 0) {
    const nextIdx = Math.max(0, Math.min(list.length - 1, exactIdx + step));
    return list[nextIdx];
  }

  const num = Number(currentVal);
  if (!Number.isFinite(num)) return list[0];
  if (step > 0) {
    const higher = list.find((v) => v !== null && Number(v) > num);
    return higher !== undefined ? higher : list[list.length - 1];
  }
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i] !== null && Number(list[i]) < num) return list[i];
  }
  return list[0];
}

export function buildTokenMenuSpec({
  role = 'gm',
  token
} = {}) {
  const isGm = role === 'gm';
  const isAlly = token?.isAlly !== false;

  const quickActions = [
    { id: 'open-sheet', label: 'file-text', title: 'Abrir Ficha' }
  ];

  const sections = [];
  if (isGm) {
    const actionsSection = [
      { id: 'toggle-hide', icon: token?.hidden ? 'eye' : 'eye-off', label: token?.hidden ? 'Mostrar ficha' : 'Ocultar ficha' }
    ];
    if (!isAlly) {
      actionsSection.push({ id: 'dup-tok', icon: 'copy', label: 'Duplicar ficha' });
    }
    sections.push(actionsSection);
    sections.push([
      { id: 'del-tok', icon: 'trash', label: 'Eliminar ficha', danger: true }
    ]);
  }

  return {
    quickActions,
    sections
  };
}

export function buildWallMenuSpec(walls = []) {
  const list = Array.isArray(walls) ? walls.filter(Boolean) : [];
  const count = list.length;
  const kindLabels = {
    wall: 'Sólido',
    terrain: 'Relieve',
    invisible: 'Translúcido'
  };
  const firstKind = count > 0 ? normalizeWallKind(list[0].kind) : 'wall';
  const uniformKind = count > 0 && list.every((w) => normalizeWallKind(w.kind) === firstKind) ? firstKind : null;
  const firstDoor = count > 0 ? getWallDoorMode(list[0]) : 'none';
  const uniformDoor = count > 0 && list.every((w) => getWallDoorMode(w) === firstDoor) ? firstDoor : null;
  const allDoors = count > 0 && list.every((w) => isWallDoor(w));

  const singleTitle = firstDoor === 'secret'
    ? (firstKind === 'wall' ? 'Puerta secreta' : `${kindLabels[firstKind]} · Secreta`)
    : firstDoor === 'normal'
      ? (firstKind === 'wall' ? 'Puerta' : `${kindLabels[firstKind]} · Puerta`)
      : (kindLabels[firstKind] || 'Muro');
  const headerTitle = count <= 1 ? singleTitle : `${count} muros seleccionados`;
  const headerSubtitle = count <= 1 && isWallDoor(list[0])
    ? (list[0]?.open ? 'Abierta' : list[0]?.locked ? 'Bloqueada' : 'Cerrada')
    : '';

  const typeSection = [
    { id: 'kind-wall', icon: 'brick', label: 'Sólido', checked: uniformKind === 'wall' },
    { id: 'kind-invisible', icon: 'grid', label: 'Translúcido', checked: uniformKind === 'invisible' },
    { id: 'kind-terrain', icon: 'columns', label: 'Relieve', checked: uniformKind === 'terrain' }
  ];

  const doorSection = [
    { id: 'door-none', icon: 'ban', label: 'Sin puerta', checked: uniformDoor === 'none' },
    { id: 'door-normal', icon: 'door-open', label: 'Puerta', checked: uniformDoor === 'normal' },
    { id: 'door-secret', icon: 'sparkles', label: 'Puerta secreta', checked: uniformDoor === 'secret' }
  ];

  const sections = [typeSection, doorSection];
  if (allDoors) {
    const allOpen = list.every((w) => Boolean(w.open));
    const allClosed = list.every((w) => !w.open);
    const allLocked = list.every((w) => Boolean(w.locked));
    const toggleLabel = allOpen ? 'Cerrar puerta' : allClosed ? 'Abrir puerta' : 'Alternar apertura';
    const lockLabel = allLocked ? 'Desbloquear puerta' : 'Bloquear puerta';
    sections.push([
      { id: 'toggle-open', icon: 'door-open', label: toggleLabel },
      { id: 'toggle-lock', icon: allLocked ? 'unlock' : 'lock', label: lockLabel, checked: allLocked }
    ]);
  }

  sections.push([
    {
      id: 'duplicate-walls',
      icon: 'copy',
      label: count > 1 ? `Duplicar ${count} muros` : 'Duplicar muro',
      shortcut: 'Ctrl+C/V'
    }
  ]);

  sections.push([
    {
      id: 'delete-walls',
      icon: 'trash',
      label: count > 1 ? `Eliminar ${count} muros` : 'Eliminar muro',
      shortcut: 'Supr',
      danger: true
    }
  ]);

  return {
    header: { title: headerTitle, subtitle: headerSubtitle },
    sections
  };
}

export function findTokensInRect(tokens = [], rect, { cellSize = 80, canSelect = null } = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0 || !rect) return [];
  const minX = Math.min(Number(rect.x1) || 0, Number(rect.x2) || 0);
  const maxX = Math.max(Number(rect.x1) || 0, Number(rect.x2) || 0);
  const minY = Math.min(Number(rect.y1) || 0, Number(rect.y2) || 0);
  const maxY = Math.max(Number(rect.y1) || 0, Number(rect.y2) || 0);
  const cs = Math.max(20, Number(cellSize) || 80);

  return tokens.filter((tok) => {
    if (!tok) return false;
    if (typeof canSelect === 'function' && !canSelect(tok)) return false;
    const radius = (cs * (Number(tok.size) || 1) * 0.84) / 2;
    const cx = Math.max(minX, Math.min(Number(tok.x) || 0, maxX));
    const cy = Math.max(minY, Math.min(Number(tok.y) || 0, maxY));
    return Math.hypot((Number(tok.x) || 0) - cx, (Number(tok.y) || 0) - cy) <= radius;
  });
}

export function buildMultiTokenMenuSpec({ role = 'gm', tokens = [] } = {}) {
  const list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
  const count = list.length;
  const isGm = role === 'gm';
  const allHidden = count > 0 && list.every((t) => Boolean(t.hidden));

  const quickActions = [
    { id: 'hp-minus', label: '−1', title: '−1 HP a todas', tone: 'danger' },
    { id: 'hp-plus', label: '+1', title: '+1 HP a todas', tone: 'success' },
    { id: 'hp-m5', label: '−5', title: '−5 HP a todas', tone: 'danger' },
    { id: 'hp-p5', label: '+5', title: '+5 HP a todas', tone: 'success' }
  ];

  const stateSection = [
    { id: 'light', icon: 'bulb', label: 'Alternar luz' },
    { id: 'aura', icon: 'circle-dot', label: 'Alternar aura' }
  ];

  const actionsSection = [
    { id: 'init', icon: 'zap', label: 'Tirar Iniciativa', value: `${count}` }
  ];
  if (isGm) {
    actionsSection.push(
      { id: 'toggle-hide', icon: allHidden ? 'eye' : 'eye-off', label: allHidden ? 'Mostrar fichas' : 'Ocultar fichas' },
      { id: 'dup-toks', icon: 'copy', label: 'Duplicar fichas' }
    );
  }

  const sections = [stateSection, actionsSection];
  if (isGm) {
    sections.push([
      { id: 'del-toks', icon: 'trash', label: `Eliminar ${count} fichas`, danger: true }
    ]);
  }

  return {
    header: { title: `${count} fichas seleccionadas`, subtitle: '' },
    quickActions,
    sections
  };
}

export function shouldAllowNativeContextMenu(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA';
}
