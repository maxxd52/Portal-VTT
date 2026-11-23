# Design & UX Principles — Portal-VTT

This document defines the canonical interaction and visual design rules for Portal-VTT. Every new panel, modal, or workflow MUST follow these principles so the entire application feels cohesive, calm, and predictable.

---

## 1. Core Philosophy: Minimalist Apple-Style Ergonomics
- **Two-layer workspace:** Keep the tactical tabletop canvas uncluttered. Only the minimal top bar, discrete edge rails, and dice dock stay permanently visible; all drawers and forms open contextually on demand and start collapsed (`false`).
- **Calm visual hierarchy:** Generous spacing, clear typography, subtle hairlines, and a single accent color (`--accent-primary` / `portal-btn-accent`, purple) reserved for active toggles and primary confirmation actions.
- **Natural affordances over hidden tricks:** Clicking an item opens it cleanly for reading/inspection. Secondary configuration controls stay hidden until explicitly requested.

---

## 2. The Five Interaction Laws

### Law 1 — The `+` / `Editar` Toggle & Explicit `Guardar` Contract
Creation and editing across **all** panels (Diario, Baúl, Fichas, Carpetas, Pantalla del DJ) MUST obey the exact same lifecycle:
1. **Enter via toggle:** Clicking `+` (or `Editar`) activates creation/edit mode and highlights the trigger button in purple (`portal-btn-accent`).
2. **Draft-first (no side effects on open):** Opening `+` or `Editar` NEVER immediately persists an empty/modified record to `Service.state`. Edits live in a local in-memory draft.
3. **Cancel safely:** Clicking the active `+` button again — or clicking `Cancelar` / `←` — discards the draft with zero state mutations and removes `portal-btn-accent`.
4. **Explicit commit:** State is created or updated **only** when the user clicks the primary confirmation button (`Guardar` / `Crear`, styled with `portal-btn-accent`), which commits the draft, removes the toggle highlight, and returns to the clean Read/Browse view.

### Law 2 — Strict Separation of Modes (Browse · Read · Edit · Act)
Never mix controls from different mental modes in the same header or card:
- **Browse / List mode:** Clean clickable cards (thumbnail, title, compact metadata/status badge). Do not clutter list cards with destructive or multi-step action buttons.
- **Read mode:** Optimized for calm reading and primary contextual actions (e.g., `Mostrar`, `Editar`, `Eliminar` in Diario). Media elements must always remain readable at full intended size (`shrink-0` inside scrollable flex columns).
- **Edit mode:** Focused exclusively on authoring (`Cancelar` + `Guardar`). Hide projection, sharing, and quick-eye controls while editing.

### Law 3 — Zero Redundant Controls (One Entry Point per Intent)
Every user intent should have **one** obvious, natural entry point:
- Avoid scattering duplicate icons for the same action across list cards, detail headers, and individual sub-blocks.
- If a secondary workflow needs options (such as choosing recipients or filtering blocks), group those options inside one dedicated contextual popover/modal instead of repeating mini-controls everywhere.

### Law 4 — Anti-Spoiler Preview Before Exposing GM Data
Any GM action that projects or reveals potentially private information to players (such as sharing a Journal note to the table) MUST pass through a compact, centered confirmation modal before broadcasting:
1. **Recipient selector:** Clear segmented choice (`Toda la mesa` vs. `Jugadores` with selectable seat chips).
2. **Content toggles:** Simple per-block (and media) toggles so the GM decides in one glance what to reveal vs. keep secret.
3. **Live WYSIWYG preview:** A compact preview card showing **exactly** what the selected recipient(s) will see (title, optional image, selected blocks only).
4. **Explicit confirm:** Single primary CTA (`Mostrar ahora`) that commits visibility and projects to the target seats while strictly enforcing zero-leak redaction invariants (`I1`–`I5` in `DOMAIN.md`).

### Law 5 — Layout Stability & Responsive Containment
- Inside vertical scrollable flex containers (`flex flex-col overflow-y-auto`), media wrappers and headers MUST use `shrink-0` so growing content scrolls cleanly instead of squishing images or toolbars.
- Modals and popovers follow the unified `Escape` layer stack (modals → overlays/temp tools → side drawers).

### Law 6 — Unified Monochrome Line Iconography
- **UI actions & controls:** All contextual menus, toolbars, and action buttons MUST use clean monochrome line-art SVGs (`fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, rounded caps/joins) via `js/utils/uiIcons.js`, inheriting white/theme ink (or semantic danger red on destructive actions). Never use colorful OS emojis for UI controls.
- **Reserved color:** Color in icons is reserved strictly for semantic status/condition badges (colored stroke when inactive, white over colored pill when active), HP deltas, and active accent toggles.

---

## 3. Reference Specification: Unified Journal (`Diario`)

| View | Allowed Controls | Forbidden Redundancies |
| :--- | :--- | :--- |
| **Drawer Header** | `Nueva carpeta` (toggle), `+` (toggle, purple when drafting), `×` close | Immediate note creation on `+` click |
| **Notes List** | Folder filter pills, search input, clickable note cards with subtle `Compartida` / `DJ` status pill | Quick-present eye buttons on every list card |
| **Note Read View** | `← Notas`, `Mostrar` (GM only, opens central Share modal), `Editar`, `Eliminar` | Split dropdown `▾`, inline recipient bar, per-block eye buttons |
| **Note Create / Edit View** | `Cancelar` (or `←`), `Guardar` (purple), title, folder, image picker/capture, blocks (`+ Bloque`, reorder, delete) | Silent auto-save on blur, `Mostrar` button, per-block eye buttons |
| **Central Share Modal (`Mostrar`)** | Recipient selector (`Toda la mesa` / `Jugadores`), image & block inclusion toggles, live preview card, `Cancelar` + `Mostrar ahora` | Blind one-click broadcast of private blocks without preview |

---

## 4. Design Review Checklist (For Future Features)
Before shipping any UI change in Portal-VTT, verify:
- [ ] Does `+` / `Editar` toggle `portal-btn-accent`, cancel cleanly on second press, and persist only on `Guardar` / `Crear`?
- [ ] Are Browse, Read, and Edit modes cleanly separated without mixed controls?
- [ ] Is there only one clear entry point per action (no duplicate buttons)?
- [ ] Does any GM-to-player reveal show a live anti-spoiler preview before sending?
- [ ] Do images and headers preserve their height (`shrink-0`) when content overflows and scrolls?
- [ ] Do all UI actions use unified monochrome line-art SVGs (`uiIcons.js`), reserving color strictly for semantic states/conditions and danger actions?
