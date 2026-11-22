# Domain & Invariants — Portal-VTT

## Core Principle
Two-layer minimalist UI:
1. **Always visible:** Minimal top bar (no side-panel buttons), discrete edge-rail triggers on left (`Fichas`) and right (`Diario`, plus `Baúl` and `Pantalla` for GM), central canvas, and dice dock.
2. **Contextual on demand:** Side character sheet, Unified Journal, Baúl (Compendium), GM Screen, Inspection Card, context menus, and floating popovers (`History`, `Dice Style`, `Grid`, `Handouts`, `Room`). All side panels start collapsed (`false`).

## Core Entities
- **Room (`room`):** `code` (`PORTAL-XXXX`), `moduleTitle`, `role` (`'gm' | 'player'`), `isHostGm`. Operates over `portal_<code>`.
- **Scene (`mapId`, `activeMapKey`):** Independent per-scene `mapGrids` (`type`: `'none' | 'square' | 'hex-v' | 'hex-h'`, `cellSize`, `metersPerUnit`, `offsetX/Y`, `opacity`, `snap`, `color`), `sceneLayers`, and `sceneLighting` (`dynamicLighting`, `rememberExplored`, `exploredMask`, `exploredRev`). In `'none'` grid mode, `cellSize` and `metersPerUnit` still define physical scale for tokens, ruler, and light.
- **Player Invites (`playerInvites[]`):** `id`, `label`, `tokenIds[]`. Assigned allied tokens travel automatically across map changes preserving `id`, live sheet, and per-scene coordinates.
- **Token (`tokens[]`):** `id`, `name`, `publicDescription`, `privateNotes`, `mediaId`, `isAlly`, `ownerId`, `hidden`, `hp`, `maxHp`, `ac`, `level`, `stats`, `skills`, `traits`, `inventory`, `conditions`, `visionMeters`, `lightMeters`, `auraRadius`. `hp` is clamped to `[0, maxHp]`. `visionMeters === null` inherits `systemConfig.vision.defaultVisionMeters`.
- **Media Pool (`mediaAssets`):** Content-deduplicated dictionary (`media-<hash>`). Deleting a token/actor/scene never deletes a `mediaId` still referenced by any Journal (`gmNotes` or `playerJournals`).
- **Unified Journal (`journal`):** `gmFolders[]`, `gmNotes[]`, `playerJournals[seatKey]`, `receivedReveals[]`, `revealedAnnotations[gmNoteId]`. Per-block visibility (`'private' | 'all' | 'players'`).
- **Walls & Doors (`walls[]`):** `id`, `x1, y1, x2, y2`, `kind` (`'wall' | 'door'`), `open`. Closed doors and walls block visibility polygons.
- **Combat (`combat`):** `active`, `round`, `turnIndex`, `order[]` sorted by initiative.
- **Dice (`dice`):** `modifier`, `resultMode` (`'sum' | 'each' | 'max' | 'min'`), `visibility` (`'public' | 'private'`), `hand[]`, `lastRoll`, `history[]` (last 25 rolls).
- **GM Screen (`gmScreen`) & Public Clocks (`publicClocks`):** GM-only right drawer (`tabs`, `widgets`, `pins`, `clocks`, `notes`, `tables`, `references`). Persists in `BrowserVault` and `.portal`, never in P2P `WORLD_SYNC`. Only clocks with `isPublic === true` project to `publicClocks`.

## Critical Invariants
1. **Dice Visibility:**
   - `public`: local + broadcast (`DICE_ROLL` + `WORLD_SYNC`).
   - `private` (Player): visible to roller and GM (`role === 'gm'`); other players discard it.
   - `private` (GM): strictly local to GM tab; never emitted over `RealtimeBridge`.
2. **Token Control (`Service.canControlToken`):**
   - GM can move/edit any token.
   - Player can control a token if `tok.ownerId === clientId` OR (`!tok.ownerId && tok.isAlly !== false`).
3. **Dynamic Vision vs Light:**
   - Only non-hidden allied tokens act as observers in `Selector.getAlliedVisibilityPolygons` (hostile light never leaks through walls).
   - Effective radius: `metersToPixels(Math.max(visionMeters, lightMeters), grid)`. Equipped light items contribute to `lightMeters` without mutating `visionMeters`.
   - Explored memory persists per scene (`600x400` compact PNG). Legacy manual fog brush (`fogRects`) is permanently removed.
4. **Undo / Redo:** Up to 20 snapshots (`tokens`, `strokes`, `walls`, `notes`) via `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y`.
5. **Host GM & Delta Movement:**
   - Only the session started as GM (`isHostGm`) keeps `#roleSwitchGroup` to preview Player view.
   - Dragging does not emit network traffic; drop (`commit = true`) sends `{ kind: 'TOKEN_MOVE', tokenId, x, y, path? }` (up to 12 RDP-simplified waypoints) without triggering `WORLD_SYNC`.
6. **Zero-Leak Seat Redaction & Journal (`I1`–`I5`):**
   - `I1`: `Selector.extractWorldForSeat(state, seatKey)` redacts non-controlled tokens (omits `stats`, `scores`, `saveProfs`, `skills`, `traits`, `inventory`, `resources`, `texts`, `ac`, `level`, `speed`, `privateNotes`, exact HP; keeps `publicDescription`, precomputed `lightMeters`, `hpPct`/`defeated`).
   - `I2`: GM blocks with `visibility === 'private'` or unassigned to `seatKey`, and other players' `playerJournals`, never leave the host or relay across `RealtimeBridge`.
   - `I3`: Updating revealed GM blocks updates `receivedReveals` live without overwriting player's `revealedAnnotations[gmNoteId]`.
   - `I4`: Players reuse authorized table media (`collectPlayerAuthorizedMedia`); referenced `mediaId`s are retained on delete/pack.
   - `I5`: Double-clicking a token opens `#characterSheetDrawer` for GM/owner, or `#tokenInspectModal` (Inspection Card with "Guardar en Diario") for non-owners; hidden tokens are blocked for players.
