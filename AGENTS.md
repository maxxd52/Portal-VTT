# Repository Agent Guide — Portal-VTT

## Key Commands
- **Run unit tests:** `node --test tests/*.test.mjs`
- **Run locally in browser:** Serve repo root with any static HTTP server (e.g., `npx serve .` or `python -m http.server 8080`) and open `http://localhost:8080`. Native ES Modules require HTTP(S), not `file://`.
- **Lint / Build:** None (no `package.json`, no bundler, no build step).
- **Local Browser-Test Fixture:** `tests/fixtures/local/anatema.portal` (gitignored, contains private copyrighted art) is the local cartridge fixture to import in browser verification sessions when testing real tokens, maps, and items.

## Repo-Specific Conventions
- **Facade Mixin Pattern:** `Service` (`js/core/service.js`) and `View` (`js/core/view.js`) compose domain methods from `js/services/*` and `js/ui/*` via `Object.assign` / object spread. Keep public entry points on `Service.*` and `View.*`.
- **Pure Selectors & Utils:** Keep `js/core/selector.js` and `js/utils/*` free of DOM access and state mutations so they run cleanly in Node `node --test` without browser mocks.
- **Cache-Busting Tag (`?v=...`):** Whenever updating module import tags, update all references uniformly across `index.html`, `js/`, and `tests/`. Verify with `node --test tests/*.test.mjs`.
- **UI Edge Rails & Collapsed Defaults:** Side drawers (`sheetOpen`, `drawerOpen`, `gmScreenOpen`, `journalOpen`) start collapsed (`false`) by default. Left rail (`#leftEdgeRail`) holds mutually exclusive Character Sheets and GM Screen (for GM); right rail (`#rightEdgeRail`) holds mutually exclusive Journal and Vault/Baúl (for GM).
- **UX & Design Rules (`docs/DESIGN_PRINCIPLES.md`):** Follow the `+`/`Editar` toggle + explicit `Guardar` draft contract, strict Browse/Read/Edit mode separation, zero redundant controls, and centered anti-spoiler preview modals before GM reveals.
- **UI Language vs Code Language:** Code, identifiers, tests, and harness docs are in English; user-facing UI strings in `index.html` and `js/ui/*` are in Spanish (matching the existing app).

## Careful / High-Risk Areas
- **P2P Redaction & Privacy (`worldRedaction.js`, `selector.js`, `realtimeBridge.js`):** Never leak GM-only data (`gmScreen`, `secretDc`, `privateNotes`, private journal blocks, or non-owned token stats/inventory) in `WORLD_SYNC` or `extractWorldForSeat`.
- **Persistence & Cartridges (`browserVault.js`, `cartridgePacker.js`):** Preserve backward compatibility for stored portals and `.portal` cartridges, and retain any `mediaId` referenced by any Journal in `mediaAssets`.
- **Pre-existing Dirty Worktree:** Check `git status` before staging/committing; never commit unless explicitly asked.
