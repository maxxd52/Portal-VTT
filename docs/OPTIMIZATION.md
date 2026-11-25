# Portal-VTT Optimization Roadmap & Traceability Log

## 1. Optimization Strategy
- **Phase 1 — Zero-Visual-Loss Core Optimizations:** Eliminate redundant per-frame allocations, duplicate selector work, unthrottled offscreen redraws, and synchronous GPU/CPU readbacks so every machine benefits automatically without degrading visuals.
- **Phase 2 — Unified Graphics Quality Profile (`Auto | High | Balanced | Low`):** Expose a single clean selector (evolving the existing shadow toggle) to scale visual cost and FPS caps on modest hardware without cluttering the UI.

---

## 2. Already Implemented & Audited (Do Not Re-Audit)
- **Lighting & Fog Offscreen Caches (`js/ui/canvasView.js`):** `getStaticFogCanvas`, `getStaticDarknessCanvas`, and `getFogBaseCanvas` cache static layers; ambient light & relief buffers run at `0.5x` (`1200x800`); light animation loop is throttled to ~16 FPS (`62ms`), pauses when `document.hidden`, and pauses fog redraws while dragging tokens.
- **Visibility Polygon LRU Cache (`js/core/selector.js`):** `_visPolyCache` (96 entries, invalidated by wall signature) caches `computeVisibilityPolygon` across tokens and lights.
- **Hardware-Adaptive Dynamic Shadows (`index.html`, `js/utils/tokenShadowModel.js`, `js/ui/tokenPhysicsView.js`):** `portal_shadow_mode_v1` (`Auto | Activas | Básico` in `#shadowModeSeg`) uses `resolveDynamicShadowMode` checking `prefersReducedMotion`, `deviceMemory <= 2`, and `hardwareConcurrency <= 4 && isCoarsePointer`.

---

## 3. Prioritized Optimization Roadmap

### Area 1 (Priority 1 — Selected First, Zero Visual Loss): Weather & Animated Light Hot-Loop Pipeline
- **Targets:** `js/utils/weatherEngine.js`, `js/ui/canvasView.js`
- **Bottlenecks:**
  1. `syncWeatherOverlay` runs unthrottled at 60 FPS up to `1.5x` DPR on a full-viewport canvas; `mist` creates 16 `createRadialGradient` + 16 `createLinearGradient` objects per frame; `rain`, `snow`, and `embers` issue individual `beginPath`/`stroke`/`fill` calls per particle.
  2. `_syncLightAnimationLoop` calls `Selector.getActiveLightPolygons()` twice per tick (once in `tick`, once inside `drawFogCanvas`), re-blits full `2400x1600` fog + ambient layers, and redraws door icons with `ctx.shadowBlur = 6` on every animation tick.
- **Planned Fixes:**
  - Pre-render offscreen mist/ember sprites and batch particle path draws by alpha/style bucket.
  - Cap weather DPR (`1.0` for soft particles) and apply per-weather FPS caps (`30 FPS` snow/mist, `45–60 FPS` rain/embers).
  - Pass precomputed `lightPolys` into `drawFogCanvas` on animation ticks and cache door icon layer / avoid per-tick `shadowBlur`.

### Area 2 (Priority 2): Unified Graphics Profile (`Auto | High | Balanced | Low`)
- **Targets:** `js/utils/graphicsProfileModel.js` (new, pure), `index.html`, `js/core/view.js`, `js/ui/canvasView.js`, `js/ui/tokenPhysicsView.js`, `js/services/dice3dEngine.js`, `css/styles.css`
- **Scope:** Evolve `#shadowModeSeg` into a single Graphics Profile controlling dynamic token/wall shadows, `backdrop-filter` blur intensity, weather particle density/FPS, animated light FPS, and Three.js dice DPR/shadow map.

### Area 3 (Priority 3): Render-Path DOM Diffing & Sync Readback Elimination
- **Targets:** `js/ui/canvasView.js`, `js/core/view.js`
- **Bottlenecks:** `renderMapNotes` and `renderMapLights` rebuild `innerHTML` and rebind click listeners on every `View.render()`; `isPointExplored` performs synchronous `getImageData(1, 1)` per door during `drawFogCanvas`.

### Area 4 (Priority 4): Compositor & Glassmorphism Hygiene
- **Targets:** `css/styles.css`, `index.html`
- **Bottlenecks:** Stacked `backdrop-filter: blur(18px–20px) saturate(165%)` panels over live animated canvases and broad `will-change` hints.

---

## 4. Traceability Log

| ID | Area | Status | Files | Verification | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `OPT-0` | Baseline fog/light caches, visPoly LRU, shadow mode | Done | `canvasView.js`, `selector.js`, `tokenShadowModel.js`, `tokenPhysicsView.js`, `index.html` | `node --test tests/*.test.mjs` (240/240) + browser check | Baseline before optimization roadmap |
| `OPT-1` | Weather & Animated Light Hot-Loop | Done | `weatherEngine.js`, `canvasView.js`, `tests/weatherOptimization.test.mjs` | `node --test tests/*.test.mjs` (244/244) + browser check | Batched rain/snow paths, offscreen mist/ember/door sprites, 30/45 FPS + 1× DPR weather budget, zero duplicate `getActiveLightPolygons` per anim tick |
| `OPT-2` | Unified Graphics Profile (`Auto \| High \| Balanced \| Low`) | Done | `graphicsProfileModel.js`, `weatherEngine.js`, `tokenPhysicsView.js`, `canvasView.js`, `dice3dEngine.js`, `view.js`, `domCache.js`, `index.html`, `styles.css`, `tests/graphicsProfile.test.mjs` | `node --test tests/*.test.mjs` (247/247) + browser check | Replaced `#shadowModeSeg` with `#graphicsQualitySeg` (`Auto \| Alto \| Medio \| Ligero`); scales dynamic shadows, CSS `backdrop-filter`, weather density/FPS, animated light FPS, and 3D dice DPR |
| `OPT-3` | Render-Path DOM Diffing & `getImageData` Elimination | Done | `canvasView.js`, `tests/renderPathOptimization.test.mjs` | `node --test tests/*.test.mjs` (251/251) + browser check | Added signature/HTML diff guards on `renderMapNotes`, `renderMapLights`, `renderVectorOverlay`; cached `600x400` explored alpha buffer in `isPointExplored` |
| `OPT-4` | Compositor & Glassmorphism Hygiene | Done | `styles.css`, `tests/graphicsProfile.test.mjs` | `node --test tests/*.test.mjs` (252/252) + browser check | Scoped token `will-change` to `.is-dragging`/`.is-gliding`/`.is-dropping` only; extended `balanced`/`low` blur rules to `.seat-chat-bubble`, `.seat-roll-card`, and map pills |
