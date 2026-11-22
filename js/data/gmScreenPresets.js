/* ==========================================================================
   GM SCREEN PRESETS: WIDGETS, CONFIGURACIONES ESTÁNDAR Y REFERENCIAS POR SISTEMA
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
  dnd55: {
    activeTabId: 'table',
    tabs: [
      { id: 'table', label: 'Mesa', allowCompendium: false },
      { id: 'prep', label: 'Preparados', allowCompendium: true },
      { id: 'rules', label: 'Reglas', allowCompendium: false }
    ],
    widgets: [
      { id: 'w_roll', tabId: 'table', type: 'roll_arbiter', enabled: true, title: 'Pedir Tirada (CD)', config: { showPassive: true } },
      { id: 'w_pulse', tabId: 'table', type: 'party_pulse', enabled: true, title: 'Pulso del Grupo', config: { showPassivePerception: true } },
      { id: 'w_clocks', tabId: 'table', type: 'clocks', enabled: true, title: 'Relojes y Contadores', config: {} },
      { id: 'w_staging', tabId: 'prep', type: 'staging', enabled: true, title: 'Bandeja de Escena', config: {} },
      { id: 'w_notes', tabId: 'prep', type: 'notes', enabled: true, title: 'Notas del Narrador', config: {} },
      { id: 'w_ref', tabId: 'rules', type: 'reference', enabled: true, title: 'Referencia Rápida 5.5e', config: {} },
      { id: 'w_tables', tabId: 'rules', type: 'tables', enabled: true, title: 'Tablas Rápidas', config: {} }
    ],
    clocks: [
      { id: 'clk_tension', label: 'Tensión', kind: 'clock', segments: 6, value: 0, color: '#f59e0b', isPublic: false }
    ],
    notes: [
      { id: 'note_session', title: 'Notas de sesión', kind: 'note', body: '', items: [] },
      { id: 'note_checks', title: 'Lista de escena', kind: 'checklist', body: '', items: [{ id: 'ci_1', text: 'Presentar gancho inicial', done: false }] }
    ],
    tables: [
      {
        id: 'tbl_reaccion',
        title: 'Reacción de PNJ',
        entries: [
          'Hostil — ataca o bloquea el paso de inmediato',
          'Desconfiado — exige garantías o precio alto',
          'Neutral — indiferente pero escuchará una oferta',
          'Curioso — hace preguntas y observa al grupo',
          'Amistoso — dispuesto a dar información o refugio',
          'Aliado entusiasta — ayuda sin pedir nada a cambio'
        ]
      },
      {
        id: 'tbl_complicacion',
        title: 'Complicación en viaje',
        entries: [
          'Rastro fresco de depredadores o patrulla cercana',
          'Cambio brusco de clima que reduce visibilidad',
          'Obstáculo natural: puente vencido o derrumbe',
          'Viajeros con un rumor urgente o pedido de auxilio',
          'Descubren señales antiguas ocultas fuera del sendero'
        ]
      }
    ],
    references: [
      {
        id: 'ref_dc',
        title: 'Escala de CD (5.5e)',
        items: [
          { label: 'Muy fácil', detail: 'CD 5' },
          { label: 'Fácil', detail: 'CD 10' },
          { label: 'Media', detail: 'CD 15' },
          { label: 'Difícil', detail: 'CD 20' },
          { label: 'Muy difícil', detail: 'CD 25' },
          { label: 'Casi imposible', detail: 'CD 30' }
        ]
      },
      {
        id: 'ref_cover',
        title: 'Cobertura y Acciones',
        items: [
          { label: 'Cobertura 1/2', detail: '+2 CA y salvaciones DES' },
          { label: 'Cobertura 3/4', detail: '+5 CA y salvaciones DES' },
          { label: 'Cobertura total', detail: 'No puede ser objetivo directo' },
          { label: 'Esquivar / Destrabarse', detail: 'Desventaja ataques vs ti / Sin ataque de oportunidad' },
          { label: 'Ayudar', detail: 'Da Ventaja al siguiente aliado contra el objetivo' }
        ]
      },
      {
        id: 'ref_conds',
        title: 'Condiciones clave',
        items: [
          { label: 'Ventaja / Desventaja', detail: '2d20: mayor / menor (no se acumulan)' },
          { label: 'Derribado', detail: 'Ataques c/c tienen Ventaja; distancia Desventaja' },
          { label: 'Aturdido / Paralizado', detail: 'Incapacitado; falla FUE/DES; Paralizado = crítico c/c' },
          { label: 'Invisible / Oculto', detail: 'Ventaja al atacar, Desventaja al ser atacado' }
        ]
      }
    ]
  },

  pbta: {
    activeTabId: 'table',
    tabs: [
      { id: 'table', label: 'Mesa', allowCompendium: false },
      { id: 'prep', label: 'Preparados', allowCompendium: true },
      { id: 'rules', label: 'Movimientos', allowCompendium: false }
    ],
    widgets: [
      { id: 'w_roll', tabId: 'table', type: 'roll_arbiter', enabled: true, title: 'Pedir Tirada (2d6)', config: {} },
      { id: 'w_clocks', tabId: 'table', type: 'clocks', enabled: true, title: 'Relojes de Amenaza', config: {} },
      { id: 'w_pulse', tabId: 'table', type: 'party_pulse', enabled: true, title: 'Pulso del Grupo', config: {} },
      { id: 'w_staging', tabId: 'prep', type: 'staging', enabled: true, title: 'Bandeja de Escena', config: {} },
      { id: 'w_notes', tabId: 'prep', type: 'notes', enabled: true, title: 'Frentes y Notas', config: {} },
      { id: 'w_ref', tabId: 'rules', type: 'reference', enabled: true, title: 'Movimientos y Principios', config: {} },
      { id: 'w_tables', tabId: 'rules', type: 'tables', enabled: true, title: 'Oráculos PbtA', config: {} }
    ],
    clocks: [
      { id: 'clk_threat', label: 'Amenaza del Frente', kind: 'clock', segments: 6, value: 0, color: '#ef4444', isPublic: false }
    ],
    notes: [
      { id: 'note_fronts', title: 'Frentes y peligros', kind: 'note', body: '', items: [] }
    ],
    tables: [
      {
        id: 'tbl_soft_move',
        title: 'Giro narrativo (6− / 7–9)',
        entries: [
          'Revelar una verdad incómoda o peligro oculto',
          'Separarlos o poner a un aliado en aprietos',
          'Ofrecer una oportunidad con un costo duro',
          'Agotar o dañar un recurso/equipo clave',
          'Hacer avanzar un Reloj de Amenaza +1'
        ]
      }
    ],
    references: [
      {
        id: 'ref_pbta_bands',
        title: 'Bandas 2d6',
        items: [
          { label: '10+', detail: 'Éxito total: logra su objetivo sin costo extra' },
          { label: '7–9', detail: 'Éxito parcial: costo, dilema o complicación' },
          { label: '6−', detail: 'Fallo: el Narrador hace un Movimiento duro o avanza reloj' }
        ]
      },
      {
        id: 'ref_pbta_moves',
        title: 'Movimientos del Narrador',
        items: [
          { label: 'Anunciar peligro futuro', detail: 'Muestra la amenaza antes de que golpee' },
          { label: 'Ofrecer trato difícil', detail: 'Puedes hacerlo, pero a cambio de...' },
          { label: 'Devolver el movimiento', detail: 'Poner la presión en la decisión del PJ' },
          { label: 'Usar recurso o entorno', detail: 'La escena cobra vida en contra del grupo' }
        ]
      }
    ]
  },

  pool: {
    activeTabId: 'table',
    tabs: [
      { id: 'table', label: 'Mesa', allowCompendium: false },
      { id: 'prep', label: 'Preparados', allowCompendium: true },
      { id: 'rules', label: 'Reglas', allowCompendium: false }
    ],
    widgets: [
      { id: 'w_roll', tabId: 'table', type: 'roll_arbiter', enabled: true, title: 'Pedir Tirada (Reserva)', config: {} },
      { id: 'w_clocks', tabId: 'table', type: 'clocks', enabled: true, title: 'Contadores y Relojes', config: {} },
      { id: 'w_pulse', tabId: 'table', type: 'party_pulse', enabled: true, title: 'Pulso del Grupo', config: {} },
      { id: 'w_staging', tabId: 'prep', type: 'staging', enabled: true, title: 'Bandeja de Escena', config: {} },
      { id: 'w_notes', tabId: 'prep', type: 'notes', enabled: true, title: 'Notas del Narrador', config: {} },
      { id: 'w_ref', tabId: 'rules', type: 'reference', enabled: true, title: 'Escala de Éxitos', config: {} },
      { id: 'w_tables', tabId: 'rules', type: 'tables', enabled: true, title: 'Tablas Rápidas', config: {} }
    ],
    clocks: [
      { id: 'clk_pool_hunger', label: 'Tensión / Riesgo', kind: 'counter', segments: 6, value: 0, color: '#8b5cf6', isPublic: false }
    ],
    notes: [
      { id: 'note_pool', title: 'Notas de sesión', kind: 'note', body: '', items: [] }
    ],
    tables: [
      {
        id: 'tbl_pool_twist',
        title: 'Costo por fallo parcial',
        entries: [
          'Deja evidencia o testigo comprometedor',
          'Atrae atención no deseada al lugar',
          'Consume más tiempo del esperado',
          'Sufre daño leve o pérdida de equipo'
        ]
      }
    ],
    references: [
      {
        id: 'ref_pool_scale',
        title: 'Éxitos requeridos',
        items: [
          { label: '1 éxito', detail: 'Tarea rutinaria o presión ligera' },
          { label: '2–3 éxitos', detail: 'Desafío estándar en tensión' },
          { label: '4–5 éxitos', detail: 'Proeza difícil o bajo fuego enemigo' },
          { label: 'Umbral típico', detail: '≥ 6 (estándar) · ≥ 7–8 (exigente)' }
        ]
      }
    ]
  },

  d100: {
    activeTabId: 'table',
    tabs: [
      { id: 'table', label: 'Mesa', allowCompendium: false },
      { id: 'prep', label: 'Preparados', allowCompendium: true },
      { id: 'rules', label: 'Reglas', allowCompendium: false }
    ],
    widgets: [
      { id: 'w_roll', tabId: 'table', type: 'roll_arbiter', enabled: true, title: 'Pedir Tirada (1d100)', config: {} },
      { id: 'w_pulse', tabId: 'table', type: 'party_pulse', enabled: true, title: 'Pulso del Grupo', config: {} },
      { id: 'w_clocks', tabId: 'table', type: 'clocks', enabled: true, title: 'Pistas y Relojes', config: {} },
      { id: 'w_staging', tabId: 'prep', type: 'staging', enabled: true, title: 'Bandeja de Escena', config: {} },
      { id: 'w_notes', tabId: 'prep', type: 'notes', enabled: true, title: 'Notas y Pistas', config: {} },
      { id: 'w_ref', tabId: 'rules', type: 'reference', enabled: true, title: 'Grados de Éxito d100', config: {} },
      { id: 'w_tables', tabId: 'rules', type: 'tables', enabled: true, title: 'Tablas de Investigación', config: {} }
    ],
    clocks: [
      { id: 'clk_clues', label: 'Pistas clave', kind: 'clock', segments: 6, value: 0, color: '#06b6d4', isPublic: false }
    ],
    notes: [
      { id: 'note_d100', title: 'Pistas y sospechosos', kind: 'note', body: '', items: [] }
    ],
    tables: [
      {
        id: 'tbl_d100_fumble',
        title: 'Consecuencia de Pifia / Fallo',
        entries: [
          'El arma o herramienta se encasquilla o rompe',
          'Revela la posición del grupo al peligro',
          'Pista falsa que desvía al investigador',
          'Impacto psicológico o pérdida de compostura'
        ]
      }
    ],
    references: [
      {
        id: 'ref_d100_grades',
        title: 'Escala de Dificultad (≤ %)',
        items: [
          { label: 'Normal (×1)', detail: 'Tirada ≤ valor del atributo / habilidad' },
          { label: 'Difícil (÷2)', detail: 'Tirada ≤ mitad del valor' },
          { label: 'Extrema (÷5)', detail: 'Tirada ≤ quinta parte del valor' },
          { label: 'Crítico / Pifia', detail: '01–05 Crítico · 96–100 Pifia' }
        ]
      }
    ]
  },

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
  },

  vieja_escuela: {
    activeTabId: 'table',
    tabs: [
      { id: 'table', label: 'Mesa', allowCompendium: false },
      { id: 'prep', label: 'Preparados', allowCompendium: true },
      { id: 'rules', label: 'Reglas', allowCompendium: false }
    ],
    widgets: [
      { id: 'w_roll', tabId: 'table', type: 'roll_arbiter', enabled: true, title: 'Pedir Tirada (11+ / 14+ / 17+)', config: {} },
      { id: 'w_pulse', tabId: 'table', type: 'party_pulse', enabled: true, title: 'Pulso del Grupo', config: {} },
      { id: 'w_clocks', tabId: 'table', type: 'clocks', enabled: true, title: 'Tiempo y Antorchas', config: {} },
      { id: 'w_staging', tabId: 'prep', type: 'staging', enabled: true, title: 'Bandeja de Escena', config: {} },
      { id: 'w_notes', tabId: 'prep', type: 'notes', enabled: true, title: 'Notas del DJ', config: {} },
      { id: 'w_ref', tabId: 'rules', type: 'reference', enabled: true, title: 'Pantalla de Vieja Escuela', config: {} },
      { id: 'w_tables', tabId: 'rules', type: 'tables', enabled: true, title: 'Tablas Rápidas', config: {} }
    ],
    clocks: [
      { id: 'clk_antorcha', label: 'Antorcha (6 turnos · 1h)', kind: 'clock', segments: 6, value: 0, color: '#f59e0b', isPublic: false },
      { id: 'clk_muerte', label: 'Asaltos incapacitado (10)', kind: 'clock', segments: 10, value: 0, color: '#ef4444', isPublic: false }
    ],
    notes: [
      { id: 'note_ve_session', title: 'Notas de sesión', kind: 'note', body: '', items: [] },
      {
        id: 'note_ve_tiempo',
        title: 'Control del Tiempo',
        kind: 'checklist',
        body: '',
        items: [
          { id: 'ci_ve_1', text: 'Asalto de combate: 10 seg (MOV m; x2 corriendo)', done: false },
          { id: 'ci_ve_2', text: 'Turno de exploración: 10 min (MOV x 60 m)', done: false },
          { id: 'ci_ve_3', text: 'Antorcha: 1h (6 turnos) · Carga aceite: 4h (24 turnos)', done: false }
        ]
      }
    ],
    tables: [
      {
        id: 'tbl_ve_critico',
        title: 'Consecuencia de Crítico (20 nat)',
        entries: [
          'Daño máximo + 1 (opción estándar)',
          'El blanco pierde una pieza de equipo (escudo, arma, etc.)',
          'Se daña la armadura del blanco (-1 DEF durante el combate)',
          'El próximo ataque que reciba el blanco se hace con Ventaja',
          'El blanco pierde su próximo ataque',
          'El blanco se ve desplazado de su posición actual'
        ]
      },
      {
        id: 'tbl_ve_reaccion',
        title: 'Reacción de Encuentro',
        entries: [
          'Hostil — ataca sin mediar palabra',
          'Desconfiado — amenaza o exige tributo',
          'Cauteloso — observa y evalúa al grupo',
          'Neutral — indiferente, abierto a trato',
          'Curioso — busca información o intercambio',
          'Amistoso — dispuesto a ayudar o guiar'
        ]
      }
    ],
    references: [
      {
        id: 'ref_ve_dif',
        title: 'Dificultades y Tiradas',
        items: [
          { label: 'Sencilla / Muy fácil', detail: '¿Hace falta tirar?' },
          { label: 'Compleja / Apresurada', detail: '11+' },
          { label: 'Difícil / Bajo estrés', detail: '14+' },
          { label: 'Muy difícil / Mucho estrés', detail: '17+' },
          { label: 'Extremadamente difícil', detail: '20+ (20 nat = siempre éxito, 1 nat = siempre fallo)' },
          { label: 'Ventaja / Desventaja', detail: '2d20: elegir el más alto / más bajo' },
          { label: 'Trasfondos', detail: '+2 si algo de relación · Ventaja si mucha relación' }
        ]
      },
      {
        id: 'ref_ve_attrs',
        title: 'Atributos y Salud Mental',
        items: [
          { label: 'Modificadores', detail: '3 (-2) · 4-6 (-1) · 7-14 (0) · 15-17 (+1) · 18 (+2)' },
          { label: 'Carga (bultos)', detail: 'Máx = FUE; sobrecargado = Desventaja ataque/movimiento' },
          { label: 'Salud Mental (SAB)', detail: 'Fallo SAB (11+/14+/17+): -1d6 temp (6 = 1 perm). Recup. 1/día' },
          { label: 'Locura', detail: 'SAB 3 = apenas lúcido; SAB < 3 = pasa a ser PNJ' }
        ]
      },
      {
        id: 'ref_ve_combate',
        title: 'Combate, Críticos, Pifias y Muerte',
        items: [
          { label: 'Orden y Ataque', detail: 'Orden por DES. 1d20 + ATQ + FUE(CaC)/DES(Proy) >= DEF' },
          { label: 'Crítico (20 nat)', detail: 'Guerrero Nv 6 (Ataque Certero): 19-20. Daño máx+1 o efecto' },
          { label: 'Pifia (1 nat)', detail: 'Desequilibrado: ataques contra él con Ventaja hasta su asalto' },
          { label: 'Muerte y Curación', detail: '0 o menos PV: muere en 10 asaltos. Vendas: +1d4 (1/combate). Descanso: +Nivel PV' },
          { label: 'Bonos de Equipo', detail: 'Escudo: +1 DEF · Dos armas: +1 ATQ · A dos manos: +1 daño' }
        ]
      },
      {
        id: 'ref_ve_avance',
        title: 'Avance, Instintos y Magia',
        items: [
          { label: 'Subir de Nivel', detail: '0-3 PX/sesión (normal 2). 10 PX = +1 Nivel (+DA, +2 habs máx 10)' },
          { label: 'Hitos de Nivel', detail: 'Nv 6: Nuevo Talento · Nv 11: Nuevo Trasfondo' },
          { label: 'Instintos (INS)', detail: '1d20 + INS + Atributo (FUE paraliz., DES pozo/fuego, CON veneno, CAR control)' },
          { label: 'Magia (POD)', detail: '~1 POD por d6 daño/curación/niveles. Resistir: INS 10 + Nivel lanzador' }
        ]
      }
    ]
  }
};

export function createDefaultGmScreen(presetKey = 'dnd55') {
  const tpl = GM_SCREEN_PRESETS[presetKey] || GM_SCREEN_PRESETS.free;
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
