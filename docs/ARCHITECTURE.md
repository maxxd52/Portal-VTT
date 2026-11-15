# Arquitectura — OWL-TABLE (`portal-vtt`)

Aplicación VTT minimalista 100% client-side construida con **ES Modules nativos**, **Tailwind CSS** y **Canvas 2D / Three.js** (sin bundler ni backend obligatorio).

## Estado actual y diagnóstico de tamaño

| Archivo | Líneas | Rol actual | Estado |
|---|---:|---|---|
| `js/core/view.js` | 3,445 | Canvas, HUD, ficha, compendio, dados, modales y eventos | **Monolito crítico (prioridad 1 de división)** |
| `js/core/service.js` | 1,383 | Estado, mutaciones, undo/redo, combate, dados, sync, compendio | **Grande (prioridad 2 de división)** |
| `index.html` | 1,148 | Shell HTML, barra superior, drawers, dock y modales | Aceptable (divisible por fragmentos si crece) |
| `js/services/dice3dEngine.js` | 983 | Motor 3D de dados | Aislado y cohesivo |
| `css/styles.css` | 863 | Tokens visuales, temas y componentes Apple-style | Cohesivo |
| `js/core/model.js` | 165 | Estado inicial y constantes de estilo | Limpio |
| `js/core/selector.js` | 152 | Cálculos puros (visibilidad, snap, serialización) | Limpio |

## Flujo de datos

```text
DOM / Canvas (view.js)
   │  invoca acciones
   ▼
Service (service.js) ──► Selector (selector.js) [cálculos puros]
   │
   ├──► BrowserVault (localStorage / IndexedDB)
   ├──► RealtimeBridge (BroadcastChannel owltable_<roomCode>)
   └──► notify(opts) ──► View.render(state, opts)
```

- **Regla de oro**: `Service` es la única fuente de mutación de `state`. `Selector` solo lee y calcula. `View` solo renderiza y delega eventos.

## Mapa de responsabilidades de `View` (`js/core/view.js`)

| Bloque | Métodos principales | Módulo destino recomendado |
|---|---|---|
| Lienzo táctico y niebla | `drawMapCanvas`, `drawGridCanvas`, `drawStrokesCanvas`, `drawFogCanvas`, `renderVectorOverlay`, `renderMapNotes` | `js/ui/canvasView.js` |
| Tokens, halos y menú contextual | `renderTokensLayer`, `openContextMenu`, `hideContextMenu` | `js/ui/tokensView.js` |
| Ficha de personaje | `renderCharacterSheet` y helpers de habilidades/rasgos/inventario | `js/ui/sheetView.js` |
| Compendio arrastrable | `renderCompendium` | `js/ui/compendiumView.js` |
| Dock, historial y estilo de dados | `renderDiceReadout`, `renderDiceHistory`, `syncDiceStyleUI`, `renderFormulaChips` | `js/ui/diceView.js` |
| Sala, presencia, handouts y sync | `renderRoomModal`, `renderSyncModal`, `renderHandoutModal`, `handleRealtimeMessage`, `startPresenceHeartbeat` | `js/ui/roomView.js` |

## Mapa de responsabilidades de `Service` (`js/core/service.js`)

| Dominio | Métodos actuales | Módulo destino recomendado |
|---|---|---|
| Núcleo de estado, Undo/Redo y Sync | `subscribe`, `notify`, `pushUndoSnapshot`, `undo`, `redo`, `applyFullWorldState`, `recordEvent` | `js/core/service.js` |
| Tokens, combate y propiedad | `moveToken`, `canControlToken`, `toggleTokenOwnership`, `cycleTokenLight`, `cycleTokenAura`, `startCombat`, `nextCombatTurn`, `adjustTokenHp` | `js/services/tokenService.js` |
| Dados e historial | `throwDiceHand`, `rollFormula`, `rollDice`, `recordRoll`, `setDiceVisibility`, `broadcastRoll`, `receiveRemoteRoll`, `clearDiceHistory` | `js/services/diceService.js` |
| Compendio y cartuchos | `saveCustomActor`, `saveCustomItem`, `saveCustomMap`, `loadModulePackage`, `addShelfModule` | `js/services/compendiumService.js` |

## Plan recomendado de refactorización (sin romper ES Modules)

1. **Paso 1 — Extraer `js/ui/` desde `view.js`** usando composición (`Object.assign(View, ...)` o sub-controladores que reciben `{ Service, Selector, View }`). Empezar por `diceView.js` y `sheetView.js` reduce `view.js` en ~1,100 líneas de inmediato.
2. **Paso 2 — Extraer `js/services/` desde `service.js`** delegando métodos de dominio (`DiceService`, `TokenService`) mientras `Service` mantiene la fachada pública para no tocar llamadas existentes.
3. **Paso 3 — Unificar cache-busting**: centralizar la versión de módulo o usar imports relativos consistentes al migrar a GitHub Pages / Vite en el futuro.

## Checklist de arquitectura

- [ ] Ningún archivo JS supera las ~500–600 líneas (salvo motores 3D dedicados).
- [ ] `Selector` permanece 100% puro (sin efectos secundarios ni acceso al DOM).
- [ ] Ninguna mutación de estado ocurre directo desde `view.js` sin pasar por `Service`.
- [ ] Los eventos privados del DJ nunca se emiten por `RealtimeBridge`.
