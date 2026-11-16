/* ==========================================================================
   D&D 5.5e (2024): COMPLEMENTOS DE CLASE HASTA NIVEL 3 EN CARPETAS
   ========================================================================== */

export const DND55_CLASS_ITEMS = [
  // ── BÁRBARO ───────────────────────────────────────────────────────────────
  {
    key: '55_barb_rage',
    folder: 'Bárbaro',
    name: 'Furia (Niv. 1)',
    kind: 'ability',
    badge: 'Niv 1 · +2 Daño',
    icon: 'flame',
    color: '#ef4444',
    message: 'Resistencia a daño contundente, perforante y cortante; +2 daño cuerpo a cuerpo con FUE y ventaja en pruebas de FUE.'
  },
  {
    key: '55_barb_unarmored',
    folder: 'Bárbaro',
    name: 'Defensa sin Armadura (Niv. 1)',
    kind: 'equipment',
    badge: 'Niv 1 · +2 CA',
    statTarget: 'ac',
    statBonus: 2,
    icon: 'shield',
    color: '#dc2626',
    message: 'CA base 10 + DES + CON mientras no lleves armadura.'
  },
  {
    key: '55_barb_reckless',
    folder: 'Bárbaro',
    name: 'Ataque Temerario (Niv. 2)',
    kind: 'ability',
    badge: 'Niv 2 · Ventaja',
    formula: '1d12+@fue+2',
    icon: 'sword',
    color: '#ef4444',
    message: 'Ventaja en ataques de FUE este turno; los ataques contra vos tienen ventaja hasta tu próximo turno.'
  },
  {
    key: '55_barb_frenzy',
    folder: 'Bárbaro',
    name: 'Frenesí / Totem (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · +1d6',
    formula: '1d6',
    icon: 'bolt',
    color: '#b91c1c',
    message: 'Subclase Niv. 3: daño extra en furia (Berserker +1d6 o resistencia extra Corazón Salvaje).'
  },

  // ── BARDO ─────────────────────────────────────────────────────────────────
  {
    key: '55_bard_insp',
    folder: 'Bardo',
    name: 'Inspiración Bárdica (Niv. 1)',
    kind: 'ability',
    badge: 'Niv 1 · 1d6',
    formula: '1d6',
    icon: 'sparkle',
    color: '#ec4899',
    message: 'Acción adicional (18m): un aliado suma 1d6 a una prueba D20.'
  },
  {
    key: '55_bard_mockery',
    folder: 'Bardo',
    name: 'Burla Dañina (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 1d6 Psíq',
    formula: '1d6',
    icon: 'sparkle',
    color: '#db2777',
    message: 'Salvación SAB o recibe 1d6 psíquico y desventaja en su próximo ataque.'
  },
  {
    key: '55_bard_healword',
    folder: 'Bardo',
    name: 'Palabra Curativa (Niv. 2)',
    kind: 'consumable',
    badge: 'Niv 2 · 2d4+CAR',
    formula: '2d4+@car',
    icon: 'heart',
    color: '#f472b6',
    message: 'Acción adicional (18m): recupera 2d4 + modificador de CAR.'
  },
  {
    key: '55_bard_college',
    folder: 'Bardo',
    name: 'Colegio Bárdico (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · Subclase',
    formula: '1d6',
    icon: 'book',
    color: '#be185d',
    message: 'Pericia en 2 habilidades y rasgo de Colegio (Palabras Cortantes -1d6 o Inspiración de Combate).'
  },

  // ── BRUJO ─────────────────────────────────────────────────────────────────
  {
    key: '55_warlock_eb',
    folder: 'Brujo',
    name: 'Descarga Sobrenatural (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 1d10+CAR',
    formula: '1d10+@car',
    icon: 'bolt',
    color: '#9333ea',
    message: 'Rayo de fuerza (36m). Con Explosión Agónica suma CAR al daño.'
  },
  {
    key: '55_warlock_hex',
    folder: 'Brujo',
    name: 'Maldición del Brujo (Niv. 1)',
    kind: 'ability',
    badge: 'Niv 1 · +1d6 Necr',
    formula: '1d6',
    icon: 'skull',
    color: '#7e22ce',
    message: '+1d6 necrótico cada vez que impactás al objetivo marcado y desventaja en pruebas de una característica.'
  },
  {
    key: '55_warlock_inv',
    folder: 'Brujo',
    name: 'Invocaciones (Niv. 2)',
    kind: 'ability',
    badge: 'Niv 2 · Vista/Pacto',
    icon: 'eye',
    color: '#a855f7',
    message: 'Invocaciones Sobrenaturales (Vista del Diablo 36m en oscuridad mágica o Armadura de Sombras).'
  },
  {
    key: '55_warlock_patron',
    folder: 'Brujo',
    name: 'Patrón Sobrenatural (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · Pacto',
    formula: '1d6+@car',
    icon: 'flame',
    color: '#6b21a8',
    message: 'Don del Patrón (ej. Bendición del Oscuro: PG temporales al reducir a 0 HP o Paso Feérico).'
  },

  // ── CLÉRIGO ───────────────────────────────────────────────────────────────
  {
    key: '55_cleric_flame',
    folder: 'Clérigo',
    name: 'Llama Sagrada (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 1d8 Rad',
    formula: '1d8',
    icon: 'flame',
    color: '#f59e0b',
    message: 'Salvación DES (18m), ignora cobertura, 1d8 radiante.'
  },
  {
    key: '55_cleric_heal',
    folder: 'Clérigo',
    name: 'Palabra Curativa (Niv. 1)',
    kind: 'consumable',
    badge: 'Niv 1 · 2d4+SAB',
    formula: '2d4+@sab',
    icon: 'heart',
    color: '#fbbf24',
    message: 'Acción adicional (18m): cura 2d4 + SAB.'
  },
  {
    key: '55_cleric_channel',
    folder: 'Clérigo',
    name: 'Chispa Divina (Niv. 2)',
    kind: 'ability',
    badge: 'Niv 2 · 1d8+SAB',
    formula: '1d8+@sab',
    icon: 'sparkle',
    color: '#d97706',
    message: 'Canalizar Divinidad: cura 1d8 + SAB a un aliado o inflige 1d8 + SAB radiante/necrótico.'
  },
  {
    key: '55_cleric_domain',
    folder: 'Clérigo',
    name: 'Dominio Divino (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · Subclase',
    formula: '2d8',
    icon: 'shield',
    color: '#b45309',
    message: 'Subclase de Dominio (Vida: Preservar Vida; Luz: Destello Protector; Guerra: Ataque Guiado).'
  },

  // ── DRUIDA ────────────────────────────────────────────────────────────────
  {
    key: '55_druid_thorn',
    folder: 'Druida',
    name: 'Latigazo de Espinas (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 1d6 Perf',
    formula: '1d6',
    icon: 'wrench',
    color: '#16a34a',
    message: 'Alcance 9m: 1d6 perforante y atrae 3m hacia vos si es Grande o menor.'
  },
  {
    key: '55_druid_wildshape',
    folder: 'Druida',
    name: 'Forma Salvaje (Niv. 2)',
    kind: 'ability',
    badge: 'Niv 2 · Bestia',
    formula: '1d8+2',
    icon: 'heart',
    color: '#15803d',
    message: 'Transformación en bestia como acción adicional; ganás PG temporales = nivel de Druida.'
  },
  {
    key: '55_druid_circle',
    folder: 'Druida',
    name: 'Círculo Druídico (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · Subclase',
    formula: '2d6',
    icon: 'sparkle',
    color: '#22c55e',
    message: 'Círculo de la Luna (formas de combate + CA) o Círculo de la Tierra (conjuros de terreno).'
  },

  // ── EXPLORADOR ────────────────────────────────────────────────────────────
  {
    key: '55_ranger_mark',
    folder: 'Explorador',
    name: 'Marca del Cazador (Niv. 1)',
    kind: 'ability',
    badge: 'Niv 1 · +1d6',
    formula: '1d6',
    icon: 'target',
    color: '#10b981',
    message: 'Acción adicional: +1d6 daño con arma al objetivo marcado y ventaja al rastrearlo.'
  },
  {
    key: '55_ranger_bow',
    folder: 'Explorador',
    name: 'Arco Largo Maestro (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 1d8+DES',
    formula: '1d8+@des',
    icon: 'target',
    color: '#059669',
    message: 'Maestría Ralentizar (-3m velocidad al impactar), alcance 45/180m.'
  },
  {
    key: '55_ranger_archetype',
    folder: 'Explorador',
    name: 'Arquetipo de Explorador (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · +1d8',
    formula: '1d8',
    icon: 'eye',
    color: '#047857',
    message: 'Cazador (Matagigantes +1d8) o Acechador Sombrío (emboscada primer turno).'
  },

  // ── GUERRERO ──────────────────────────────────────────────────────────────
  {
    key: '55_fighter_wind',
    folder: 'Guerrero',
    name: 'Tomar Aliento (Niv. 1)',
    kind: 'ability',
    badge: 'Niv 1 · 1d10+BC',
    formula: '1d10+@bc',
    icon: 'heart',
    color: '#3b82f6',
    message: 'Acción adicional: recuperás 1d10 + nivel de Guerrero en PG.'
  },
  {
    key: '55_fighter_mastery',
    folder: 'Guerrero',
    name: 'Maestría de Armas (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 1d8+FUE',
    formula: '1d8+@fue',
    icon: 'sword',
    color: '#2563eb',
    message: 'Maestría Savia/Empujar/Derribar con tus armas dominadas.'
  },
  {
    key: '55_fighter_surge',
    folder: 'Guerrero',
    name: 'Oleada de Acción (Niv. 2)',
    kind: 'ability',
    badge: 'Niv 2 · +1 Acción',
    icon: 'bolt',
    color: '#1d4ed8',
    message: 'Una vez por descanso corto/largo, realizás una acción adicional en tu turno.'
  },
  {
    key: '55_fighter_sub',
    folder: 'Guerrero',
    name: 'Maniobra / Crítico 19-20 (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · +1d8',
    formula: '1d8',
    icon: 'shield',
    color: '#1e40af',
    message: 'Maestro de Batalla (dado de superioridad 1d8) o Campeón (crítico con 19–20).'
  },

  // ── HECHICERO ─────────────────────────────────────────────────────────────
  {
    key: '55_sorc_innate',
    folder: 'Hechicero',
    name: 'Hechicería Innata (Niv. 1)',
    kind: 'ability',
    badge: 'Niv 1 · +1 CD',
    icon: 'flame',
    color: '#f97316',
    message: 'Acción adicional (1 min): +1 a la CD de salvación y ventaja en ataques con conjuros de Hechicero.'
  },
  {
    key: '55_sorc_bolt',
    folder: 'Hechicero',
    name: 'Saeta de Fuego (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 1d10',
    formula: '1d10',
    icon: 'flame',
    color: '#ea580c',
    message: 'Truco a distancia (36m): 1d10 de daño de fuego.'
  },
  {
    key: '55_sorc_meta',
    folder: 'Hechicero',
    name: 'Metamagia (Niv. 2)',
    kind: 'ability',
    badge: 'Niv 2 · Puntos',
    icon: 'sparkle',
    color: '#c2410c',
    message: 'Fuente de Magia y 2 opciones de Metamagia (Conjuro Acelerado / Duplicado / Sutil).'
  },
  {
    key: '55_sorc_origin',
    folder: 'Hechicero',
    name: 'Origen Hechicero (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · Subclase',
    formula: '2d8',
    icon: 'bolt',
    color: '#9a3412',
    message: 'Linaje Dracónico (+PG y CA 10+DES+CAR) o Magia Salvaje (Oleada de Magia).'
  },

  // ── MAGO ──────────────────────────────────────────────────────────────────
  {
    key: '55_wizard_missile',
    folder: 'Mago',
    name: 'Proyectil Mágico (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 3d4+3',
    formula: '3d4+3',
    icon: 'sparkle',
    color: '#6366f1',
    message: 'Impacta automáticamente (36m): 3 dardos de 1d4+1 de fuerza cada uno.'
  },
  {
    key: '55_wizard_shield',
    folder: 'Mago',
    name: 'Escudo Arcano (Niv. 1)',
    kind: 'ability',
    badge: 'Niv 1 · +5 CA',
    icon: 'shield',
    color: '#4f46e5',
    message: 'Reacción al recibir un impacto: +5 a la CA hasta el inicio de tu próximo turno.'
  },
  {
    key: '55_wizard_scholar',
    folder: 'Mago',
    name: 'Erudito / Recuperación (Niv. 2)',
    kind: 'ability',
    badge: 'Niv 2 · Pericia',
    icon: 'book',
    color: '#4338ca',
    message: 'Pericia en una habilidad académica y Recuperación Arcana en descanso corto.'
  },
  {
    key: '55_wizard_tradition',
    folder: 'Mago',
    name: 'Tradición Arcana (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · 2d8',
    formula: '2d8',
    icon: 'eye',
    color: '#3730a3',
    message: 'Evocación (Esculpir Conjuros) o Abjuración (Resguardo Arcano).'
  },

  // ── MONJE ─────────────────────────────────────────────────────────────────
  {
    key: '55_monk_martial',
    folder: 'Monje',
    name: 'Artes Marciales (Niv. 1)',
    kind: 'weapon',
    badge: 'Niv 1 · 1d6+DES',
    formula: '1d6+@des',
    icon: 'sword',
    color: '#06b6d4',
    message: 'Golpe desarmado o arma de monje usando DES (1d6 en 5.5e Niv. 1–4).'
  },
  {
    key: '55_monk_flurry',
    folder: 'Monje',
    name: 'Ráfaga de Golpes (Niv. 2)',
    kind: 'weapon',
    badge: 'Niv 2 · 2d6+DES',
    formula: '2d6+@des',
    icon: 'bolt',
    color: '#0891b2',
    message: '1 Punto de Disciplina (acción adicional): dos golpes desarmados.'
  },
  {
    key: '55_monk_deflect',
    folder: 'Monje',
    name: 'Desviar Ataques (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · 1d10+DES+3',
    formula: '1d10+@des+3',
    icon: 'shield',
    color: '#0e7490',
    message: 'Reacción: reduce daño físico recibido en 1d10 + DES + nivel de Monje.'
  },

  // ── PALADÍN ───────────────────────────────────────────────────────────────
  {
    key: '55_paladin_loh',
    folder: 'Paladín',
    name: 'Imposición de Manos (Niv. 1)',
    kind: 'ability',
    badge: 'Niv 1 · Reserva 15',
    formula: '1d4+4',
    icon: 'heart',
    color: '#eab308',
    message: 'Acción adicional (5.5e): curás PG desde tu reserva (5 × nivel = 15 HP en Niv. 3).'
  },
  {
    key: '55_paladin_smite',
    folder: 'Paladín',
    name: 'Castigo Divino (Niv. 2)',
    kind: 'weapon',
    badge: 'Niv 2 · +2d8 Rad',
    formula: '2d8',
    icon: 'bolt',
    color: '#ca8a04',
    message: 'Acción adicional tras impactar cuerpo a cuerpo: +2d8 radiante (+1d8 vs no-muertos/infernal).'
  },
  {
    key: '55_paladin_oath',
    folder: 'Paladín',
    name: 'Juramento Sagrado (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · Subclase',
    icon: 'shield',
    color: '#a16207',
    message: 'Canalizar Divinidad de Juramento (Devoción: Arma Sagrada +CAR al ataque; Venganza: Enemistad Jurada).'
  },

  // ── PÍCARO ────────────────────────────────────────────────────────────────
  {
    key: '55_rogue_sneak',
    folder: 'Pícaro',
    name: 'Ataque Furtivo (Niv. 1–3)',
    kind: 'weapon',
    badge: 'Niv 1–3 · +2d6',
    formula: '2d6',
    icon: 'skull',
    color: '#10b981',
    message: '1/turno con ventaja o aliado a 1,5m: +1d6 (Niv. 1–2) o +2d6 (Niv. 3).'
  },
  {
    key: '55_rogue_cunning',
    folder: 'Pícaro',
    name: 'Acción Astuta (Niv. 2)',
    kind: 'ability',
    badge: 'Niv 2 · Sigilo/Dash',
    icon: 'eye',
    color: '#059669',
    message: 'Acción adicional para Esconderse, Destrabarse o Correr.'
  },
  {
    key: '55_rogue_sub',
    folder: 'Pícaro',
    name: 'Arquetipo de Pícaro (Niv. 3)',
    kind: 'ability',
    badge: 'Niv 3 · Subclase',
    formula: '1d8+@des',
    icon: 'sword',
    color: '#047857',
    message: 'Asesino (ventaja vs quienes no actuaron + daño extra) o Ladrón (Manos Rápidas).'
  }
];
