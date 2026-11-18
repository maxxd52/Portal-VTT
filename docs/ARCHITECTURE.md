# Arquitectura — Portal-VTT

Aplicación VTT minimalista 100% client-side construida con **ES Modules nativos**, **Tailwind CSS** y **Canvas 2D / Three.js** (sin bundler ni backend obligatorio).

## Reglas de Modularidad (Estándar del Proyecto)

Para mantener la base de código navegable tanto para humanos como para agentes de IA y evitar tener que re-modularizar en el futuro:

1. **Límite de tamaño por módulo**:
   - **Objetivo**: cada módulo JS debe mantenerse en **<= 400–500 líneas** (límite duro recomendado: ~600 líneas).
   - **Excepción**: motores gráficos o catálogos de datos puros dedicados (como `dice3dEngine.js` o `compendium.js`) si son cohesivos.
2. **División proactiva por dominio**:
   - Si una nueva funcionalidad agrega un flujo independiente o un módulo existente supera ~550 líneas, se extrae de inmediato un submódulo en `js/ui/` (presentación/eventos) o `js/services/` (lógica de negocio/estado).
3. **Patrón de Composición (Mixins sobre Fachadas)**:
   - `Service` (`js/core/service.js`) y `View` (`js/core/view.js`) actúan como fachadas públicas que componen métodos de dominio mediante `Object.assign` o spread (`...TokenServiceMethods`, `Object.assign(View, ...)`).
   - Ningún consumidor externo necesita saber en qué submódulo vive un método; siempre invoca `Service.*` o `View.*`.
4. **Separación estricta de capas**:
   - `js/core/model.js`: estado inicial, constantes y generadores de IDs/códigos.
   - `js/core/selector.js`: funciones **100% puras** de lectura/cálculo (sin efectos secundarios, sin mutaciones, sin acceso al DOM).
   - `js/core/service.js` + `js/services/*`: única fuente de mutación de `state`, persistencia y sincronización.
   - `js/core/view.js` + `js/ui/*`: renderizado DOM/Canvas y delegación de eventos hacia `Service`.
5. **Disciplina de Cache-Busting (`?v=...`)**:
   - Al usar ES Modules nativos sin bundler, **toda** referencia con `?v=YYYYMMDDx` debe mantenerse sincronizada entre `index.html`, `js/main.js`, `js/core/*`, `js/services/*` y `js/ui/*` para evitar que el navegador instancie singletons duplicados o sirva módulos en caché.

---

## Mapa actual de módulos

### Núcleo (`js/core/`)
| Archivo | Responsabilidad |
|---|---|
| `js/core/model.js` | Estado inicial (`createInitialState`), `DEFAULT_DICE_STYLE`, `generateRoomCode` (`PORTAL-XXXX`) |
| `js/core/selector.js` | Cálculos puros (visibilidad, snap a grilla, `extractSerializableWorld`) |
| `js/core/service.js` | Fachada de estado, undo/redo, notas, combate, mapas, sync y creación/apertura de portales |
| `js/core/view.js` | Fachada de UI, `init()`, `render(state, opts)`, combate y enlazado global de paneles |

### Servicios de dominio (`js/services/`)
| Archivo | Responsabilidad |
|---|---|
| `js/services/systemService.js` | Presets de sistema (`dnd55`, `pbta`, `pool`, `d100`, `free`), pestañas/atributos/recursos/estados por portal y `rollSheetCheck` |
| `js/services/tokenService.js` | Selección, movimiento, invocación, inventario, stats, recursos flexibles, habilidades, rasgos, luz/aura y propiedad |
| `js/services/diceService.js` | Mano de dados, estilo 3D, modos de lectura, tiradas directas, historial y broadcast |
| `js/services/diceFormulaService.js` | Baraja de 54 cartas, evaluación aritmética, resolución de fórmulas (`@stat`, `dF`, moneda) y resúmenes |
| `js/services/sequenceService.js` | Secuencias multi-paso (ataques, áreas, salvaciones de objetivos y aplicación masiva) |
| `js/services/combatService.js` | Iniciativa por fórmula, agrupación de Secundarios, turnos y tracker de combate |
| `js/services/compendiumService.js` | Actores/objetos/mapas personalizados, exportación/importación JSON y biblioteca de cartuchos |
| `js/services/browserVault.js` | Persistencia local en IndexedDB/localStorage y listado de portales (`listRooms`) |
| `js/services/realtimeBridge.js` | Sincronización local multi-pestaña (`BroadcastChannel`) y WebRTC (`PeerJS`) |
| `js/services/cartridgePacker.js` | Empaquetado y lectura de cartuchos portables `.portal` |
| `js/services/dice3dEngine.js` | Motor 3D de dados con Three.js + física |

### Módulos de UI (`js/ui/`)
| Archivo | Responsabilidad |
|---|---|
| `js/ui/domCache.js` | Catálogo centralizado de referencias DOM (`collectViewElements`) e íconos SVG base |
| `js/ui/portalLobbyView.js` | Lobby de entrada mínimo (nombre + sistema, unirse o abrir portales recientes diferenciados) |
| `js/ui/systemOptionsView.js` | Modal global `Opciones → Sistema y Reglas` (reglas, iniciativa, estados y opciones de ficha) |
| `js/ui/systemBlockBuilderView.js` | Constructor modular por bloques, inspector de atributos/recursos, pestañas y vista previa en vivo |
| `js/ui/boardView.js` | Interacción sobre el tablero (pan, zoom, drag de tokens, doble clic para ficha) |
| `js/ui/contextMenuView.js` | Menú contextual separado para tokens (HP, tamaño, bando, estados del sistema, luz/aura) vs mapa |
| `js/ui/canvasView.js` | Renderizado del mapa, grilla, trazos vectoriales, niebla de guerra, notas y pings |
| `js/ui/sheetView.js` | Ficha lateral adaptativa de personaje (cabecera, pestañas dinámicas, atributos, habilidades y rasgos) |
| `js/ui/sheetBlocksView.js` | Renderizado unificado de los 4 bloques de ficha genérica (`Número`, `Recurso`, `Tirada`, `Texto`) |
| `js/ui/sheetResourcesView.js` | Estados activos y recursos/contadores flexibles en la ficha (pips, barras y contadores libres) |
| `js/ui/sheetInventoryView.js` | Inventario en la ficha (equipo, consumibles, capacidades, drag-and-drop) |
| `js/ui/diceView.js` | Dock de dados, modos de resultado aditivos, historial y selector visual de dados |
| `js/ui/sequenceView.js` | Tarjeta flotante progresiva de secuencias y tiradas asistidas por objetivos |
| `js/ui/compendiumView.js` | Cajón del compendio arrastrable y biblioteca de módulos |
| `js/ui/compendiumFormsView.js` | Picker de íconos, paletas de color y constructores auxiliares de fórmulas |
| `js/ui/itemCreatorView.js` | Creador modular de complementos por bloques (pasivos, tiradas, área, salvación, efectos/estados) |
| `js/ui/modalsView.js` | Modales de sala, compartir/invitar, handouts, notas y sincronización |

### Datos y utilidades (`js/data/`, `js/utils/`)
| Archivo | Responsabilidad |
|---|---|
| `js/data/compendium.js` | Plantillas base de actores, objetos, mapas de ejemplo y muros predefinidos |
| `js/data/dnd55Classes.js` | Complementos de las 12 clases de D&D 5.5e (hasta nivel 3) organizados en carpetas |
| `js/utils/driveUrlHelper.js` | Normalización de URLs de Google Drive para imágenes de mapas y tokens |
| `js/utils/webpConverter.js` | Conversión y compresión WebP client-side para mapas e imágenes |

---

## Flujo de datos

```text
DOM / Canvas (js/core/view.js + js/ui/*)
   │  delega acciones
   ▼
Service (js/core/service.js + js/services/*) ──► Selector (js/core/selector.js) [cálculos puros]
   │
   ├──► BrowserVault (IndexedDB / localStorage)
   ├──► RealtimeBridge (BroadcastChannel portal_<roomCode>)
   └──► notify(opts) ──► View.render(state, opts)
```

## Interacción de Tokens (Regla UX)
- **Clic simple / Arrastrar**: solo selecciona el token (`.is-selected`) y permite moverlo sin interrumpir con la ficha.
- **Doble clic en token**, tecla **`C`** o **botón de Ficha superior** (o menú contextual): abre/alterna el drawer de la ficha de personaje (`#characterSheetDrawer`).
