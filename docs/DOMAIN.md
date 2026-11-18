# Dominio del Proyecto — Portal-VTT

Guía viva de conceptos, reglas de negocio, invariantes e ideas registradas para mantener la mesa virtual simple, completa y flexible.

## Principio rector

**Dos capas claras (estilo Apple)**:
1. **Siempre visible**: barra superior mínima, lienzo central y dock de dados.
2. **Contextual bajo demanda**: ficha lateral, compendio, menú contextual y popovers flotantes (`Historial`, `Estilo de dados`, `Grilla`, `Handouts`, `Sala`).

## Entidades del dominio

| Entidad | Campos clave | Reglas / Invariantes |
|---|---|---|
| **Sala (`room`)** | `code`, `moduleTitle`, `role` (`'gm' \| 'player'`) | Cada pestaña opera como `'gm'` (Director) o `'player'` (Jugador) sobre el canal `portal_<code>`. |
| **Escena (`mapId`, `activeMapKey`)** | `customMapUrl`, `grid`, `walls`, `fogRects`, `strokes`, `notes` | Cada escena conserva su grilla (`mapGrids`) y capas (`sceneLayers`) de forma independiente. |
| **Token (`tokens[]`)** | `id`, `name`, `isAlly`, `ownerId`, `hidden`, `hp`, `maxHp`, `ac`, `level`, `stats`, `skills`, `traits`, `inventory`, `conditions`, `visionRadius`, `lightRadius`, `auraRadius` | `hp` acotado a `[0, maxHp]`. Si `hidden === true` o está fuera de línea de visión dinámica, los jugadores no ven tokens hostiles. |
| **Muro / Puerta (`walls[]`)** | `id`, `x1, y1, x2, y2`, `kind` (`'wall' \| 'door'`), `open` | Las puertas cerradas y muros bloquean el polígono de visibilidad en `Selector.computeVisibilityPolygon`. |
| **Combate (`combat`)** | `active`, `round`, `turnIndex`, `order[]` | Ordenado por iniciativa; resalta el token activo en el lienzo y muestra píldora superior. |
| **Dados (`dice`)** | `modifier`, `resultMode` (`'sum' \| 'each' \| 'max' \| 'min'`), `visibility` (`'public' \| 'private'`), `hand[]`, `lastRoll`, `history[]` | `history` conserva las últimas 25 tiradas con fórmula, desglose, total, crítico/pifia, visibilidad y hora. |
| **Handout (`activeHandout`)** | `url`, `title` | Proyección temporal centrada sincronizada en sala (`HANDOUT_SHOW` / `HANDOUT_CLOSE`). |

## Reglas de visibilidad, privacidad y permisos

### 1. Tiradas de dados (`dice.visibility`)
- **Pública (`public`)**: se registra localmente y se difunde a toda la sala (`DICE_ROLL` + `WORLD_SYNC`).
- **Privada (`private`) — Jugador**: la ve el jugador que tiró y la pestaña del **DJ** (`role === 'gm'`); otros jugadores la descartan.
- **Privada (`private`) — DJ**: permanece estrictamente local en la pestaña del DJ (no se emite por `RealtimeBridge`).

### 2. Propiedad de tokens (`Service.canControlToken`)
- El **DJ** puede mover y editar cualquier ficha.
- Un **Jugador** puede mover una ficha si `tok.ownerId === clientId`, o si no tiene dueño (`!tok.ownerId`) y es aliada (`tok.isAlly !== false`).
- Desde el menú contextual (**🔑 Dueño**): el DJ alterna `Libre` ↔ `Solo DJ`; el jugador alterna `Libre` ↔ `Mía` en aliados sin dueño.

### 3. Luz y Auras
- Todo token no oculto con `isAlly !== false` o `lightRadius > 0` actúa como fuente en `Selector.getAlliedVisibilityPolygons`.
- **Luz** cicla `Off → 20ft (180px) → 40ft (360px)`.
- **Aura** cicla `Off → 10ft (90px) → 15ft (135px)`.

### 4. Deshacer / Rehacer
- Pila de hasta **20 snapshots** (`tokens`, `strokes`, `fogRects`, `walls`, `notes`) accesible vía `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` y `Ctrl+Y`.

---

## Registro de ideas y evolución (Backlog)

| Prioridad | Idea | Estado | Notas |
|---|---|---|---|
| Alta | Historial de tiradas en popover | **Implementado** | Dock inferior (`#diceHistoryPopover`). |
| Alta | Selector de tiradas Pública / Privada | **Implementado** | `Púb / Priv` en dock con filtrado por rol. |
| Alta | Handouts ("Mostrar imagen en mesa") | **Implementado** | Desde modal de sala con compresión WebP. |
| Alta | Deshacer / Rehacer (`Ctrl+Z` / `Ctrl+Y`) | **Implementado** | Snapshots de lienzo y fichas. |
| Alta | Luz y Auras en tokens | **Implementado** | Menú contextual + iluminación dinámica. |
| Alta | Propiedad de tokens y presencia en sala | **Implementado** | `canControlToken` + `#lblSyncBadge` en vivo. |
| Media | Paleta rápida tipo Spotlight (`Ctrl+K`) | Pendiente | Tirar fórmulas, invocar del compendio o cambiar escena con teclado. |
| Media | Modularización de `view.js` y `service.js` | Propuesto | Ver plan en [ARCHITECTURE.md](./ARCHITECTURE.md). |
| Baja | Audio ambiental mínimo (1 pista loop + SFX) | Idea | Popover ligero sin mezclador complejo. |
