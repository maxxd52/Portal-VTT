# Architecture — Portal-VTT

Minimalist, 100% client-side Virtual Tabletop (VTT) built with **native ES Modules**, **Tailwind CSS** (CDN/inline in `index.html`), **Canvas 2D**, and **Three.js** (no bundler, no mandatory backend).

## Stack & Runtime
- **Frontend:** Native ES Modules (`index.html` + `js/main.js`), Tailwind CSS + custom CSS (`css/styles.css`), Canvas 2D, Three.js (`dice3dEngine.js`).
- **Persistence:** `BrowserVault` (IndexedDB / `localStorage`) and portable `.portal` cartridges (`cartridgePacker.js`).
- **Realtime Sync:** `RealtimeBridge` using `BroadcastChannel` (`portal_<roomCode>`) for local multi-tab and WebRTC (`PeerJS`) with seat-targeted (`sendToSeat`) and `hostOnly` messaging.
- **Test Runtime:** Node.js (`v22+`) built-in test runner (`node --test tests/*.test.mjs`).

## Architectural Pattern & Layering
Strict unidirectional separation of concerns with **Facade Mixins** (`Object.assign` / spread) for `Service` and `View`:

1. **`js/core/model.js`** — Initial state factory (`createInitialState`), `SYSTEM_PRESETS.free` (`Sistema Genérico`), `GENERIC_STARTER_BLOCKS`, `DEFAULT_DICE_STYLE`, and ID/room code generators (`PORTAL-XXXX`).
2. **`js/core/selector.js`** — **100% pure** read/compute functions (visibility polygons, grid snapping, seat-redacted serialization `extractWorldForSeat`, `extractSerializableWorld`). No side effects, no state mutations, no DOM access.
3. **`js/core/service.js` + `js/services/*`** — Single source of state mutation, persistence (`BrowserVault`), and sync (`RealtimeBridge`). External callers invoke `Service.*`.
4. **`js/core/view.js` + `js/ui/*`** — DOM/Canvas rendering and event delegation back to `Service`. External callers invoke `View.*`.
5. **`js/data/*` & `js/utils/*`** — Static system/compendium catalogs and pure helper utilities (`gridGeometry`, `lightingModel`, `fogShader`, `tokenComposer`, `worldRedaction`, `scenePartySync`, `webpConverter`, `driveUrlHelper`).

### Strict Dependency Direction
```text
DOM / Canvas (js/core/view.js + js/ui/*)
   │  delegates actions
   ▼
Service (js/core/service.js + js/services/*) ──► Selector (js/core/selector.js) [pure]
   │                                            └──► js/utils/* [pure]
   ├──► BrowserVault (IndexedDB / localStorage)
   ├──► RealtimeBridge (BroadcastChannel / WebRTC)
   └──► notify(opts) ──► View.render(state, opts)
```
- `Selector` and `js/utils/*` MUST NOT import `Service`, `View`, or access DOM globals.
- `View` and `js/ui/*` MUST NOT mutate `Service.state` directly; all mutations go through `Service.*`.

## Generic Core & System Packages
- **Single Data-Driven Engine (`Sistema Genérico` / `free`):** All game mechanics, character sheets (`sheetBlocks`, `sheetTabs`), dice formulas, statuses, and GM Screen layouts run on a single generic engine. Hardcoded per-system branches in core/UI code are forbidden.
- **System Packages (JSON) vs. Campaign Cartridges (`.portal`):**
  - **System Package (JSON):** Portable ruleset definition (`schemaVersion`, `systemConfig`, `sheetBlocks`, `sheetTabs`, `statusesSchema`, `gmScreen`, and optional compendium templates). Supports an optional `locked` (read-only core) flag so GMs can play a system as-is or extract/clone it into an editable copy.
  - **Campaign Cartridge (`.portal`):** Full playable world state (maps, walls, tokens, journal, media assets, plus an embedded snapshot of the active system).
- **Testing Contract:** Test the generic engine and JSON schema validation/migration; do not add per-system test suites unless a new capability is added to the generic engine itself.

## Modularity & Cache-Busting Rules
- **Module Size Target:** Keep JS modules `<= 400-500` lines (recommended hard limit `~600` lines), except cohesive graphics engines (`dice3dEngine.js`) or pure data catalogs (`compendium.js`).
- **Cache-Busting (`?v=YYYYMMDDx`):** Without a bundler, every `?v=...` query string on ES Module imports across `index.html`, `js/main.js`, `js/core/*`, `js/services/*`, `js/ui/*`, and `tests/*.test.mjs` MUST stay synchronized to prevent duplicate singletons or stale browser cache. (Enforced by `tests/sessionPolish.test.mjs`.)

## Verification
- Test Command: none
- Verification Tool: Browser check with clean console (local static HTTP server + browser/Playwright verification)
- Note: Run unit tests manually via `node --test tests/*.test.mjs` (no `package.json` / `npm test` wrapper in this zero-tooling repo).
