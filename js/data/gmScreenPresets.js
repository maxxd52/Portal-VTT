/* ==========================================================================
   GM SCREEN PRESETS: WIDGETS Y CONFIGURACIÓN DEL SISTEMA GENÉRICO
   ========================================================================== */

export const GM_WIDGET_TYPES = {
  roll_arbiter: {
    type: 'roll_arbiter',
    label: 'Pedir Tirada y Dificultad',
    description: 'Solicita tiradas a PJs con dificultad pública o secreta según el motor.'
  },
  party_pulse: {
    type: 'party_pulse',
    label: 'Pulso del Grupo',
    description: 'Vista rápida de salud, defensa, percepciones y estados de los PJs.'
  },
  clocks: {
    type: 'clocks',
    label: 'Relojes y Contadores',
    description: 'Progreso, amenazas y recursos globales (privados o visibles en mesa).'
  },
  staging: {
    type: 'staging',
    label: 'Bandeja del Compendio',
    description: 'Actores arrastrables, complementos y escenarios fijados para la partida.'
  },
  notes: {
    type: 'notes',
    label: 'Notas y Checklist',
    description: 'Apuntes secretos y listas de control exclusivas del narrador.'
  },
  tables: {
    type: 'tables',
    label: 'Tablas Aleatorias',
    description: 'Oráculos y tablas editables con sorteo privado y envío opcional al chat.'
  },
  reference: {
    type: 'reference',
    label: 'Chuleta de Referencia',
    description: 'Tarjetas colapsables con reglas y escalas rápidas del sistema.'
  }
};

export const GM_SCREEN_PRESETS = {
  free: {
    activeTabId: 'table',
    tabs: [
      { id: 'table', label: 'Mesa', allowCompendium: false },
      { id: 'prep', label: 'Preparados', allowCompendium: true }
    ],
    widgets: [
      { id: 'w_roll', tabId: 'table', type: 'roll_arbiter', enabled: true, title: 'Pedir Tirada', config: {} },
      { id: 'w_pulse', tabId: 'table', type: 'party_pulse', enabled: true, title: 'Pulso del Grupo', config: {} },
      { id: 'w_clocks', tabId: 'table', type: 'clocks', enabled: true, title: 'Relojes y Contadores', config: {} },
      { id: 'w_staging', tabId: 'prep', type: 'staging', enabled: true, title: 'Bandeja del Compendio', config: {} },
      { id: 'w_notes', tabId: 'prep', type: 'notes', enabled: true, title: 'Notas del Narrador', config: {} }
    ],
    clocks: [],
    notes: [
      { id: 'note_free', title: 'Notas rápidas', kind: 'note', body: '', items: [] }
    ],
    tables: [
      {
        id: 'tbl_free_oracle',
        title: 'Oráculo Rápido',
        entries: ['Sí, y además...', 'Sí', 'Sí, pero...', 'No, pero...', 'No', 'No, y además...']
      }
    ],
    references: [
      {
        id: 'ref_free_1',
        title: 'Referencia del sistema',
        items: [
          { label: 'Personalizable', detail: 'Edita estas tarjetas desde Sistema y Reglas → Pantalla' }
        ]
      }
    ]
  }
};

export function createDefaultGmScreen(_presetKey = 'free') {
  const tpl = GM_SCREEN_PRESETS.free;
  const cloned = JSON.parse(JSON.stringify(tpl));
  return {
    activeTabId: cloned.activeTabId || cloned.tabs?.[0]?.id || 'table',
    tabs: Array.isArray(cloned.tabs) ? cloned.tabs : [],
    widgets: Array.isArray(cloned.widgets) ? cloned.widgets : [],
    pins: [],
    clocks: Array.isArray(cloned.clocks) ? cloned.clocks : [],
    notes: Array.isArray(cloned.notes) ? cloned.notes : [],
    tables: Array.isArray(cloned.tables) ? cloned.tables : [],
    references: Array.isArray(cloned.references) ? cloned.references : []
  };
}
