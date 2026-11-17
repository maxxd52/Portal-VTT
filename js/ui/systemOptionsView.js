/* ==========================================================================
   SYSTEM OPTIONS VIEW: CONSTRUCTOR POR BLOQUES DE 2 CAPAS ESTILO APPLE
   ========================================================================== */

import { DEFAULT_STATUS_DEFS, SYSTEM_PRESETS } from '../core/model.js?v=20261116z40';
import { Selector } from '../core/selector.js?v=20261116z40';
import { Service } from '../core/service.js?v=20261116z40';

const BLOCK_BADGES = {
  number: { icon: '🔢', name: 'Número' },
  resource: { icon: '❤️', name: 'Recurso' },
  roll: { icon: '🎲', name: 'Tirada' },
  text: { icon: '📝', name: 'Texto' }
};

export const SystemOptionsViewMethods = {
  openSystemModal() {
    if (!this.els.systemModal) return;
    this.renderSystemModal(Service.state);
    this.els.systemModal.classList.add('is-open');
  },

  renderSystemModal(state) {
    const body = this.els.systemModalBody;
    if (!body) return;
    const esc = (s) => this.escapeHtml(s);
    let cfg = state.systemConfig || SYSTEM_PRESETS.dnd55;
    const presetKey = cfg.preset || (state.ruleset === 'free' ? 'free' : 'dnd55');
    const presetInfo = SYSTEM_PRESETS[presetKey] || SYSTEM_PRESETS.free;
    const isGeneric = presetKey === 'free';
    if (isGeneric && (!Array.isArray(cfg.sheetBlocks) || !Array.isArray(cfg.sheetTabs))) {
      Service.ensureGenericBlocksInitialized(true);
      cfg = Service.state.systemConfig;
    }
    const enabledTabs = cfg.enabledTabs || { skills: true, traits: true, inventory: true };

    if (this.els.lblSystemModalTitle) {
      this.els.lblSystemModalTitle.textContent = `${state.room?.moduleTitle || state.room?.code || 'Portal'} · ${presetInfo.label}`;
    }
    const modalPanel = this.els.systemModalPanel || body.parentElement;
    if (modalPanel?.classList) {
      modalPanel.classList.toggle('max-w-5xl', isGeneric);
      modalPanel.classList.toggle('max-w-xl', !isGeneric);
    }

    const renderCheck = (id, checked, label, hint = '') => `
      <label class="owl-subpanel rounded-xl px-2.5 py-2 flex items-start gap-2 cursor-pointer select-none">
        <input type="checkbox" data-sys-toggle="${id}" ${checked ? 'checked' : ''} class="accent-violet-500 mt-0.5 shrink-0" />
        <span class="flex flex-col min-w-0">
          <span class="text-[11px] font-semibold leading-tight">${label}</span>
          ${hint ? `<span class="text-[10px] opacity-60 leading-snug mt-0.5">${hint}</span>` : ''}
        </span>
      </label>
    `;

    const allTabs = Selector.getSystemSheetTabs(state);
    const blocks = Selector.getSystemSheetBlocks(state);
    const fixedTargets = [{ id: 'header', label: 'Vista Fija' }, ...allTabs.filter((t) => t.mode === 'fixed')];
    const selectedBlk = blocks.find((b) => b.id === this.selectedSysBlockId) || null;

    const statsDefs = Selector.getSheetStatsDef(state);
    const formulaOp = this.sysFormulaOp === '-' ? '-' : '+';
    const renderFormulaEditor = (blk, labelText, placeholderText, defaultVal = '') => {
      const curFormula = blk.formula ?? defaultVal;
      const opSwitch = `
        <div class="owl-seg inline-grid grid-cols-2 gap-0.5 text-[10px] mr-0.5" title="Modo: sumar (+) o restar (−)">
          <button type="button" data-blk-formula-op="+" class="owl-seg-btn px-1.5 py-0.5 font-bold ${formulaOp === '+' ? 'is-active' : ''}">+</button>
          <button type="button" data-blk-formula-op="-" class="owl-seg-btn px-1.5 py-0.5 font-bold ${formulaOp === '-' ? 'is-active' : ''}">−</button>
        </div>
      `;
      const diceChips = [
        ...[4, 6, 8, 10, 12, 20].map((d) => [String(d), `${formulaOp}d${d}`, `d${d}`]),
        ['f', `${formulaOp}dF`, 'dado Fudge'],
        ['2', `${formulaOp}d2`, 'Moneda (0/1)'],
        ['card', `${formulaOp}carta`, 'Baraja']
      ]
        .map(([key, lbl, hint]) => `<button type="button" data-blk-add-die="${key}" class="owl-seg-btn owl-subpanel px-1.5 py-0.5 text-[9.5px] font-mono-tech" title="Clic: ${formulaOp === '-' ? 'restar' : 'sumar'} ${hint} · Clic derecho: quitar">${lbl}</button>`)
        .join('');
      const statChips = statsDefs.length
        ? statsDefs
            .map((st) => `<button type="button" data-blk-add-stat="${esc(st.alias || st.key)}" class="owl-seg-btn owl-subpanel px-1.5 py-0.5 text-[9.5px] font-semibold" title="${formulaOp === '-' ? 'Restar' : 'Sumar'} @${esc(st.alias || st.key)}">${formulaOp === '-' ? '−' : ''}@${esc(st.label)}</button>`)
            .join('')
        : '<span class="text-[9.5px] opacity-55 italic">Agregá bloques 🔢 Número en la ficha para usarlos como @clave aquí.</span>';
      return `
        <div class="flex flex-col gap-1">
          <span class="text-[10px] opacity-65">${labelText}</span>
          <div class="flex items-center gap-1">
            <input type="text" data-blk-edit="formula" value="${esc(curFormula)}" placeholder="${esc(placeholderText)}" class="owl-input px-2 py-1 text-[11px] font-mono-tech flex-1 min-w-0" />
            <button type="button" data-blk-formula-clear class="owl-btn owl-subpanel px-2 py-1 rounded-lg text-[10px] opacity-75 hover:opacity-100 shrink-0" title="Vaciar fórmula">Limpiar</button>
          </div>
          <div class="flex flex-wrap items-center gap-1">${opSwitch}${diceChips}</div>
          <div class="flex flex-wrap gap-1">${statChips}</div>
        </div>
      `;
    };

    const renderBlockInspector = (blk) => {
      if (!blk) return '';
      const info = BLOCK_BADGES[blk.kind] || BLOCK_BADGES.number;
      let specificHtml = '';
      if (blk.kind === 'number') {
        const rm = blk.rollMode || 'base';
        const vm = blk.valueMode === 'calc' ? 'calc' : 'manual';
        const otherStats = statsDefs.filter((st) => (st.alias || st.key) !== blk.key);
        const calcOpChips = [
          ['+', '+'],
          ['-', '−'],
          ['*', '×'],
          ['/', '÷'],
          ['(', '('],
          [')', ')'],
          ['floor(', 'floor('],
          ['1', '1'],
          ['2', '2'],
          ['5', '5'],
          ['10', '10']
        ]
          .map(([tokVal, lbl]) => `<button type="button" data-blk-calc-tok="${esc(tokVal)}" class="owl-seg-btn owl-subpanel px-1.5 py-0.5 text-[9.5px] font-mono-tech">${lbl}</button>`)
          .join('');
        const calcStatChips = otherStats.length
          ? otherStats
              .map((st) => `<button type="button" data-blk-calc-tok="@${esc(st.alias || st.key)}" class="owl-seg-btn owl-subpanel px-1.5 py-0.5 text-[9.5px] font-semibold" title="Insertar @${esc(st.alias || st.key)}">@${esc(st.label)}</button>`)
              .join('')
          : '<span class="text-[9.5px] opacity-55 italic">Creá otros bloques 🔢 Número para referenciarlos acá.</span>';
        specificHtml = `
          <div class="flex flex-col gap-1.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 items-end">
              <div class="flex flex-col gap-0.5">
                <span class="text-[10px] opacity-65">Valor en la ficha</span>
                <div class="owl-seg grid grid-cols-2 gap-0.5 text-[10.5px]">
                  <button type="button" data-blk-valuemode="manual" class="owl-seg-btn py-1 ${vm === 'manual' ? 'is-active' : ''}">Editable</button>
                  <button type="button" data-blk-valuemode="calc" class="owl-seg-btn py-1 ${vm === 'calc' ? 'is-active' : ''}">Calculado (fx)</button>
                </div>
              </div>
              <label class="flex flex-col gap-0.5">
                <span class="text-[10px] opacity-65">Al hacer clic en el nombre</span>
                <select data-blk-edit-rollmode="${esc(blk.id)}" class="owl-input px-2 py-1 text-[11px]">
                  <option value="base" ${rm === 'base' ? 'selected' : ''}>Tira dado base</option>
                  <option value="none" ${rm === 'none' ? 'selected' : ''}>Solo dato (no tira)</option>
                  <option value="custom" ${rm === 'custom' ? 'selected' : ''}>Fórmula propia</option>
                </select>
              </label>
            </div>
            ${
              vm === 'calc'
                ? `<div class="flex flex-col gap-1 p-2 rounded-xl owl-subpanel">
                    <span class="text-[10px] opacity-70">Fórmula de cálculo (autocalculado, solo lectura en ficha)</span>
                    <div class="flex items-center gap-1">
                      <input type="text" data-blk-edit="calcFormula" value="${esc(blk.calcFormula ?? '')}" placeholder="Ej: 10+@des o floor((@fue-10)/2)" class="owl-input px-2 py-1 text-[11px] font-mono-tech flex-1 min-w-0" />
                      <button type="button" id="btnBlkCalcBack" class="owl-btn owl-panel px-2 py-1 rounded-lg text-[10px]" title="Borrar último carácter">⌫</button>
                      <button type="button" id="btnBlkCalcClear" class="owl-btn owl-panel px-2 py-1 rounded-lg text-[10px] opacity-75" title="Vaciar fórmula">Limpiar</button>
                    </div>
                    <div class="flex flex-wrap gap-1">${calcOpChips}</div>
                    <div class="flex flex-wrap gap-1">${calcStatChips}</div>
                  </div>`
                : ''
            }
            ${rm === 'custom' ? renderFormulaEditor(blk, 'Fórmula propia de tirada', `Ej: 2d6+@${blk.key}`, '') : ''}
          </div>
        `;
      } else if (blk.kind === 'resource') {
        const rs = blk.resStyle || 'auto';
        const maxVal = Number(blk.max) || 0;
        const sizeSpan = Selector.resolveBlockGridSpan(blk);
        const maxPipsLim = sizeSpan >= 4 ? 16 : 8;
        const showsPips = blk.key !== 'hp' && maxVal > 0 && maxVal <= maxPipsLim && (rs === 'pips' || (rs !== 'bar' && maxVal <= 6));
        const pipShape = blk.pipShape || 'circle';
        const pipStates = [1, 2, 3].includes(Number(blk.pipStates)) ? Number(blk.pipStates) : 1;
        specificHtml = `
          <div class="flex flex-col gap-1.5">
            <div class="grid grid-cols-3 gap-1.5 items-end">
              <label class="flex flex-col gap-0.5">
                <span class="text-[10px] opacity-65">Máx (0=libre)</span>
                <input type="number" data-blk-edit="max" min="0" max="999" value="${maxVal}" class="owl-input px-2 py-1 text-[11px] text-center tabular-nums" />
              </label>
              <label class="flex flex-col gap-0.5">
                <span class="text-[10px] opacity-65">Estilo</span>
                <select data-blk-edit="resStyle" class="owl-input px-2 py-1 text-[11px]">
                  <option value="auto" ${rs === 'auto' ? 'selected' : ''}>Auto</option>
                  <option value="pips" ${rs === 'pips' ? 'selected' : ''}>Casillas ●</option>
                  <option value="bar" ${rs === 'bar' ? 'selected' : ''}>Barra</option>
                </select>
              </label>
              <label class="flex items-center justify-between owl-input px-2 py-1 rounded-lg">
                <span class="text-[10px] opacity-70">Color</span>
                <input type="color" data-blk-edit="color" value="${esc(blk.color || '#8b5cf6')}" class="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0" />
              </label>
            </div>
            ${
              showsPips
                ? `<div class="grid grid-cols-2 gap-1.5 items-end">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-[10px] opacity-65">Forma</span>
                      <div class="owl-seg grid grid-cols-3 gap-0.5 text-[11px]">
                        ${[
                          ['circle', '●', 'Círculo'],
                          ['square', '■', 'Cuadrado'],
                          ['diamond', '◆', 'Rombo']
                        ]
                          .map(([sh, ic, title]) => `<button type="button" data-blk-pip-shape="${sh}" class="owl-seg-btn py-1 ${pipShape === sh ? 'is-active' : ''}" title="${title}">${ic}</button>`)
                          .join('')}
                      </div>
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <span class="text-[10px] opacity-65">Niveles por casilla</span>
                      <div class="owl-seg grid grid-cols-3 gap-0.5 text-[10px]">
                        ${[
                          [1, '1 · ●', 'Vacío o lleno'],
                          [2, '2 · ◐', 'Vacío, mitad diagonal o lleno'],
                          [3, '3 · ✕', 'Vacío, /, ✕ o lleno']
                        ]
                          .map(([st, lbl, title]) => `<button type="button" data-blk-pip-states="${st}" class="owl-seg-btn py-1 ${pipStates === st ? 'is-active' : ''}" title="${title}">${lbl}</button>`)
                          .join('')}
                      </div>
                    </div>
                  </div>`
                : ''
            }
          </div>
        `;
      } else if (blk.kind === 'roll') {
        specificHtml = renderFormulaEditor(blk, 'Fórmula (tocá dados o atributos para sumar)', 'Ej: 1d20+@fue', '1d20');
      } else {
        const curSize = Selector.resolveBlockSize(blk);
        const textRows = Number(blk.textRows) || 1;
        specificHtml = `
          <div class="grid grid-cols-1 ${curSize === '1/1' ? 'sm:grid-cols-2' : ''} gap-1.5 items-end">
            <label class="flex flex-col gap-0.5">
              <span class="text-[10px] opacity-65">Texto guía (placeholder)</span>
              <input type="text" data-blk-edit="placeholder" value="${esc(blk.placeholder || '')}" class="owl-input px-2 py-1 text-[11px]" />
            </label>
            ${
              curSize === '1/1'
                ? `<div class="flex flex-col gap-0.5">
                    <span class="text-[10px] opacity-65">Altura en fila completa</span>
                    <div class="owl-seg grid grid-cols-3 gap-0.5 text-[10.5px]">
                      ${[
                        [1, '1 línea'],
                        [3, '3 líneas'],
                        [5, '5 líneas']
                      ]
                        .map(([r, lbl]) => `<button type="button" data-blk-text-rows="${r}" class="owl-seg-btn py-1 ${textRows === r ? 'is-active' : ''}">${lbl}</button>`)
                        .join('')}
                    </div>
                  </div>`
                : ''
            }
          </div>
        `;
      }

      return `
        <div data-blk-inspector="${esc(blk.id)}" class="owl-panel rounded-xl p-2.5 flex flex-col gap-2 border" style="border-color: var(--accent-primary);">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10.5px] font-bold">${info.icon} Editando ${info.name} <code class="opacity-65 font-mono-tech ml-1">@${esc(blk.key)}</code></span>
            <div class="flex items-center gap-1">
              <button type="button" data-blk-move="${esc(blk.id)}:-1" class="owl-btn owl-subpanel w-6 h-6 p-0 rounded-lg text-[10px]" title="Mover antes">←</button>
              <button type="button" data-blk-move="${esc(blk.id)}:1" class="owl-btn owl-subpanel w-6 h-6 p-0 rounded-lg text-[10px]" title="Mover después">→</button>
              <button type="button" data-blk-del="${esc(blk.id)}" class="owl-btn owl-subpanel px-2 h-6 rounded-lg text-[10px] text-rose-400" title="Eliminar bloque">🗑️</button>
              <button type="button" id="btnSysCloseInspector" class="owl-btn owl-btn-accent px-2 h-6 rounded-lg text-[10px] font-semibold">OK</button>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <label class="flex flex-col gap-0.5">
              <span class="text-[10px] opacity-65">Nombre visible</span>
              <input type="text" data-blk-edit="label" value="${esc(blk.label)}" class="owl-input px-2 py-1 text-[11px] font-semibold" />
            </label>
            <label class="flex flex-col gap-0.5">
              <span class="text-[10px] opacity-65">Ubicación</span>
              <select data-blk-edit="tabId" class="owl-input px-2 py-1 text-[11px]">
                ${fixedTargets.map((t) => `<option value="${esc(t.id)}" ${t.id === (blk.tabId || 'attrs') ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
              </select>
            </label>
            <div class="flex flex-col gap-0.5">
              <span class="text-[10px] opacity-65">Tamaño en fila</span>
              <div class="owl-seg grid grid-cols-4 gap-0.5 text-[10.5px]">
                ${[
                  ['1/3', '⅓'],
                  ['1/2', '½'],
                  ['2/3', '⅔'],
                  ['1/1', 'Todo']
                ]
                  .map(([sz, lbl]) => {
                    const curSize = Selector.resolveBlockSize(blk);
                    return `<button type="button" data-blk-size="${sz}" class="owl-seg-btn py-1 ${curSize === sz ? 'is-active' : ''}">${lbl}</button>`;
                  })
                  .join('')}
              </div>
            </div>
          </div>
          ${specificHtml}
        </div>
      `;
    };

    const sizeBadgeMap = { '1/3': '⅓', '1/2': '½', '2/3': '⅔', '1/1': 'Todo' };

    const renderDeleteTabWarning = (tab) => (
      this.confirmDeleteTabId === tab.id
        ? `<div class="rounded-lg border border-rose-500/35 bg-rose-500/10 p-2 flex items-center justify-between gap-2 text-[11px]">
            <span class="text-rose-200 leading-snug">⚠️ Si eliminás "${esc(tab.label)}", se perderán todos los elementos que contiene.</span>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" data-sys-del-tab-confirm="${esc(tab.id)}" class="owl-btn px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-500/80 text-white hover:bg-rose-500">Eliminar</button>
              <button type="button" data-sys-del-tab-cancel class="owl-btn px-2 py-0.5 rounded-lg text-[10px] font-semibold owl-panel opacity-85">Cancelar</button>
            </div>
          </div>`
        : ''
    );

    const renderTabOrderBtns = (tabId) => {
      if (allTabs.length <= 1) return '';
      const idx = allTabs.findIndex((t) => t.id === tabId);
      return `
        ${idx > 0 ? `<button type="button" data-sys-move-tab="${esc(tabId)}:-1" class="owl-btn owl-panel w-6 h-6 p-0 rounded-lg text-[10px]" title="Subir pestaña">↑</button>` : ''}
        ${idx < allTabs.length - 1 ? `<button type="button" data-sys-move-tab="${esc(tabId)}:1" class="owl-btn owl-panel w-6 h-6 p-0 rounded-lg text-[10px]" title="Bajar pestaña">↓</button>` : ''}
      `;
    };

    const renderBlockZone = (zoneObj, isHeader = false) => {
      const zoneBlocks = blocks.filter((b) => (b.tabId || 'attrs') === zoneObj.id);
      const showInspectorHere = selectedBlk && (selectedBlk.tabId || 'attrs') === zoneObj.id;
      const pillsHtml = zoneBlocks.length
        ? zoneBlocks
            .map((b) => {
              const info = BLOCK_BADGES[b.kind] || BLOCK_BADGES.number;
              const active = selectedBlk?.id === b.id;
              const szLbl = sizeBadgeMap[Selector.resolveBlockSize(b)] || '⅓';
              return `<button type="button" data-sys-pick-blk="${esc(b.id)}" class="owl-btn px-2 py-1 rounded-lg text-[11px] font-medium gap-1 ${active ? 'owl-btn-accent' : 'owl-panel'}">
                <span>${info.icon}</span>
                <span>${esc(b.label)}</span>
                <span class="text-[9px] opacity-60 font-mono-tech">${szLbl}</span>
              </button>`;
            })
            .join('')
        : `<span class="text-[10px] opacity-55 italic">Vacío · tocá un bloque abajo para añadir.</span>`;

      const paletteHtml = `
        <div class="flex flex-wrap items-center gap-1 pt-1 border-t" style="border-color: var(--hairline);">
          <span class="text-[10px] opacity-55 mr-0.5">Añadir:</span>
          <button type="button" data-sys-add-blk="${esc(zoneObj.id)}:number" class="owl-btn owl-panel px-2 py-0.5 rounded-lg text-[10px] font-semibold">+ 🔢 Número</button>
          <button type="button" data-sys-add-blk="${esc(zoneObj.id)}:resource" class="owl-btn owl-panel px-2 py-0.5 rounded-lg text-[10px] font-semibold">+ ❤️ Recurso</button>
          <button type="button" data-sys-add-blk="${esc(zoneObj.id)}:roll" class="owl-btn owl-panel px-2 py-0.5 rounded-lg text-[10px] font-semibold">+ 🎲 Tirada</button>
          <button type="button" data-sys-add-blk="${esc(zoneObj.id)}:text" class="owl-btn owl-panel px-2 py-0.5 rounded-lg text-[10px] font-semibold">+ 📝 Texto</button>
        </div>
      `;

      return `
        <div class="owl-subpanel rounded-xl p-2.5 flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0 flex-1">
              <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 font-mono-tech opacity-75 shrink-0">${isHeader ? 'Siempre visible' : 'Fija'}</span>
              ${
                isHeader
                  ? `<strong class="text-xs truncate">${esc(zoneObj.label)}</strong>`
                  : `<input type="text" data-sys-rename-tab="${esc(zoneObj.id)}" value="${esc(zoneObj.label)}" class="owl-input px-2 py-0.5 text-xs font-semibold flex-1 min-w-0" />`
              }
            </div>
            ${
              isHeader
                ? ''
                : `<div class="flex items-center gap-1 shrink-0">
                    ${renderTabOrderBtns(zoneObj.id)}
                    <button type="button" data-sys-sum-tab="${esc(zoneObj.id)}" class="owl-btn px-2 py-0.5 rounded-lg text-[10px] font-semibold ${zoneObj.sumTotal ? 'owl-btn-accent' : 'owl-panel opacity-75'}" title="Mostrar Σ suma total de números">Σ Suma</button>
                    ${allTabs.length > 1 ? `<button type="button" data-sys-del-tab="${esc(zoneObj.id)}" class="owl-btn w-6 h-6 p-0 rounded-full text-rose-400 opacity-75 hover:opacity-100" title="Eliminar pestaña">✕</button>` : ''}
                  </div>`
            }
          </div>
          ${!isHeader ? renderDeleteTabWarning(zoneObj) : ''}
          <div class="flex flex-wrap gap-1.5">${pillsHtml}</div>
          ${showInspectorHere ? renderBlockInspector(selectedBlk) : ''}
          ${paletteHtml}
        </div>
      `;
    };

    const renderTabItemCard = (tab) => {
      if (tab.mode === 'fixed') return renderBlockZone(tab, false);
      return `
        <div class="owl-subpanel rounded-xl p-2.5 flex flex-col gap-1">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0 flex-1">
              <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 font-mono-tech shrink-0">Complementos</span>
              <input type="text" data-sys-rename-tab="${esc(tab.id)}" value="${esc(tab.label)}" class="owl-input px-2 py-0.5 text-xs font-semibold flex-1 min-w-0" />
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${renderTabOrderBtns(tab.id)}
              ${allTabs.length > 1 ? `<button type="button" data-sys-del-tab="${esc(tab.id)}" class="owl-btn w-6 h-6 p-0 rounded-full text-rose-400 opacity-75 hover:opacity-100" title="Eliminar pestaña">✕</button>` : ''}
            </div>
          </div>
          ${renderDeleteTabWarning(tab)}
          <span class="text-[10px] opacity-60">Acepta complementos arrastrados y aparece como destino al crearlos en el Compendio.</span>
        </div>
      `;
    };

    const statuses = Selector.getSystemStatuses(state);
    const iconKeys = DEFAULT_STATUS_DEFS.map((d) => d.icon);
    const statusesOpen = Boolean(this.sysStatusesExpanded);

    const baseOp = this.sysBaseFormulaOp === '-' ? '-' : '+';
    const initOp = this.sysInitFormulaOp === '-' ? '-' : '+';
    const initMode = cfg.initiativeMode === 'manual' ? 'manual' : 'auto';
    const initFormulaVal = cfg.initiativeFormula ?? (isGeneric ? '1d20+@agi' : '1d20+@des');

    const renderInitiativeSection = () => `
      <div class="owl-subpanel rounded-2xl p-3 flex flex-col gap-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">${isGeneric ? '3. ' : ''}Iniciativa del Sistema</span>
          <div class="owl-seg inline-grid grid-cols-2 gap-0.5 text-[10px]" title="Cómo se resuelve al iniciar combate">
            <button type="button" data-sys-init-mode="auto" class="owl-seg-btn px-2 py-0.5 font-semibold ${initMode === 'auto' ? 'is-active' : ''}">Automática</button>
            <button type="button" data-sys-init-mode="manual" class="owl-seg-btn px-2 py-0.5 font-semibold ${initMode === 'manual' ? 'is-active' : ''}">Manual</button>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <input type="text" id="inpSysInitFormula" value="${esc(initFormulaVal)}" placeholder="Ej: 1d20+@agi o 1carta" class="owl-input flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono-tech" title="Fórmula exclusiva de Iniciativa" />
          <button type="button" id="btnSysInitClear" class="owl-btn owl-panel px-2 py-1.5 rounded-lg text-[10px] opacity-75 hover:opacity-100 shrink-0" title="Vaciar fórmula de iniciativa">Limpiar</button>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <div class="owl-seg inline-grid grid-cols-2 gap-0.5 text-[10px] mr-0.5" title="Modo: sumar (+) o restar (−)">
            <button type="button" data-sys-init-op="+" class="owl-seg-btn px-1.5 py-0.5 font-bold ${initOp === '+' ? 'is-active' : ''}">+</button>
            <button type="button" data-sys-init-op="-" class="owl-seg-btn px-1.5 py-0.5 font-bold ${initOp === '-' ? 'is-active' : ''}">−</button>
          </div>
          ${[
            ...[4, 6, 8, 10, 12, 20].map((d) => [String(d), `${initOp}d${d}`]),
            ['f', `${initOp}dF`],
            ['2', `${initOp}d2`],
            ['card', `${initOp}carta`]
          ]
            .map(([k, lbl]) => `<button type="button" data-sys-init-die="${k}" class="owl-seg-btn owl-panel px-1.5 py-0.5 text-[10px] font-mono-tech" title="Clic: ${initOp === '-' ? 'restar' : 'sumar'} · Clic derecho: quitar">${lbl}</button>`)
            .join('')}
        </div>
        ${
          statsDefs.length
            ? `<div class="flex flex-wrap gap-1">
                ${statsDefs
                  .map((st) => `<button type="button" data-sys-init-stat="${esc(st.alias || st.key)}" class="owl-seg-btn owl-panel px-1.5 py-0.5 text-[9.5px] font-semibold">${initOp === '-' ? '−' : ''}@${esc(st.label)}</button>`)
                  .join('')}
              </div>`
            : ''
        }
        <label class="inline-flex items-center gap-1.5 text-[10px] opacity-75 cursor-pointer select-none">
          <input type="checkbox" data-sys-toggle="autoInitiative" ${cfg.autoInitiative !== false ? 'checked' : ''} class="accent-violet-500" />
          <span>Al tirar Iniciativa en combate activo, actualizar y reordenar turno</span>
        </label>
      </div>
    `;

    const renderGenericSections = () => `
      <div class="owl-subpanel rounded-2xl p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">2. Tirada Base del Sistema</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div class="flex items-center gap-1">
            <input type="text" id="inpSysRollFormula" value="${esc(cfg.rollFormula ?? '1d20+@stat')}" placeholder="1d20+@stat" class="owl-input flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono-tech" title="Fórmula base (@stat = valor del bloque)" />
            <button type="button" id="btnSysBaseClear" class="owl-btn owl-panel px-2 py-1.5 rounded-lg text-[10px] opacity-75 hover:opacity-100 shrink-0" title="Vaciar fórmula base">Limpiar</button>
          </div>
          <div class="flex items-center gap-1.5">
            <select id="selSysResultMode" class="owl-input flex-1 px-2.5 py-1.5 text-xs">
              <option value="sum" ${(cfg.resultMode || 'sum') === 'sum' ? 'selected' : ''}>Total (suma)</option>
              <option value="success" ${cfg.resultMode === 'success' ? 'selected' : ''}>Contar Éxitos</option>
              <option value="each" ${cfg.resultMode === 'each' ? 'selected' : ''}>Cada dado (c/u)</option>
              <option value="max" ${cfg.resultMode === 'max' ? 'selected' : ''}>Dado Mayor</option>
              <option value="min" ${cfg.resultMode === 'min' ? 'selected' : ''}>Dado Menor</option>
            </select>
            ${
              cfg.resultMode === 'success'
                ? `<input type="number" id="inpSysThreshold" min="1" max="100" value="${Number(cfg.successThreshold) || 6}" class="owl-input w-16 px-2 py-1.5 text-xs text-center tabular-nums" title="Éxito ≥" />`
                : ''
            }
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <div class="owl-seg inline-grid grid-cols-2 gap-0.5 text-[10px] mr-0.5" title="Modo: sumar (+) o restar (−)">
            <button type="button" data-sys-base-op="+" class="owl-seg-btn px-1.5 py-0.5 font-bold ${baseOp === '+' ? 'is-active' : ''}">+</button>
            <button type="button" data-sys-base-op="-" class="owl-seg-btn px-1.5 py-0.5 font-bold ${baseOp === '-' ? 'is-active' : ''}">−</button>
          </div>
          ${[
            ...[4, 6, 8, 10, 12, 20].map((d) => [String(d), `${baseOp}d${d}`]),
            ['f', `${baseOp}dF`],
            ['2', `${baseOp}d2`]
          ]
            .map(([k, lbl]) => `<button type="button" data-sys-base-die="${k}" class="owl-seg-btn owl-panel px-1.5 py-0.5 text-[10px] font-mono-tech" title="Clic: ${baseOp === '-' ? 'restar' : 'sumar'} · Clic derecho: quitar">${lbl}</button>`)
            .join('')}
          <button type="button" data-sys-base-stat="stat" class="owl-seg-btn owl-panel px-1.5 py-0.5 text-[10px] font-semibold" title="Valor del atributo del bloque">@stat</button>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <span class="text-[9.5px] opacity-60 mr-0.5">Ejemplos:</span>
          ${['1d20+@stat', '2d6+@stat', '@statd10', '4dF+@stat', '1d100']
            .map((f) => `<button type="button" data-sys-formula-chip="${f}" class="owl-btn owl-panel px-2 py-0.5 rounded-lg text-[10px] font-mono-tech ${cfg.rollFormula === f ? 'owl-btn-accent' : ''}">${f}</button>`)
            .join('')}
        </div>
        <p class="text-[9.5px] opacity-60 leading-snug">Nomenclatura: <code class="font-mono-tech">@stat</code> = valor del bloque · <code class="font-mono-tech">4dF</code> = Fudge · <code class="font-mono-tech">1d2</code> = moneda · <code class="font-mono-tech">1carta</code> = baraja.</p>
      </div>

      ${(() => {
        const oc = Selector.getSystemOutcomeConfig(state);
        const rule = oc.outcomeRule;
        const labelFields = [];
        if (rule === 'low' || rule === 'tiered') labelFields.push(['success', rule === 'tiered' ? 'Éxito total' : 'Éxito', oc.labels.success]);
        if (rule === 'tiered') labelFields.push(['partial', 'Parcial', oc.labels.partial]);
        if (rule === 'low' || rule === 'tiered') labelFields.push(['fail', 'Fallo', oc.labels.fail]);
        if (rule !== 'none' && oc.showCrits) {
          labelFields.push(['crit', 'Crítico', oc.labels.crit]);
          labelFields.push(['fumble', 'Pifia', oc.labels.fumble]);
        }
        return `
          <div class="owl-subpanel rounded-2xl p-3 flex flex-col gap-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">Interpretación de resultados</span>
              ${
                rule !== 'none'
                  ? `<label class="inline-flex items-center gap-1.5 text-[10px] opacity-80 cursor-pointer select-none">
                      <input type="checkbox" id="chkSysShowCrits" ${oc.showCrits ? 'checked' : ''} class="accent-violet-500" />
                      <span>Crítico / Pifia</span>
                    </label>`
                  : ''
              }
            </div>
            <div class="grid grid-cols-1 ${rule === 'tiered' ? 'sm:grid-cols-3' : ''} gap-1.5 items-end">
              <label class="flex flex-col gap-0.5">
                <span class="text-[10px] opacity-65">Regla del sistema</span>
                <select id="selSysOutcomeRule" class="owl-input px-2.5 py-1.5 text-xs">
                  <option value="none" ${rule === 'none' ? 'selected' : ''}>Solo número (sin etiquetas)</option>
                  <option value="high" ${rule === 'high' ? 'selected' : ''}>A la alta (≥ clásico)</option>
                  <option value="low" ${rule === 'low' ? 'selected' : ''}>A la baja (≤ atributo)</option>
                  <option value="tiered" ${rule === 'tiered' ? 'selected' : ''}>Por rangos (PbtA)</option>
                </select>
              </label>
              ${
                rule === 'tiered'
                  ? `<label class="flex flex-col gap-0.5">
                      <span class="text-[10px] opacity-65">${esc(oc.labels.success)} ≥</span>
                      <input type="number" id="inpSysTierHigh" value="${oc.tieredHigh}" min="-99" max="999" class="owl-input px-2 py-1.5 text-xs text-center tabular-nums" />
                    </label>
                    <label class="flex flex-col gap-0.5">
                      <span class="text-[10px] opacity-65">${esc(oc.labels.partial)} ≥</span>
                      <input type="number" id="inpSysTierMid" value="${oc.tieredMid}" min="-99" max="999" class="owl-input px-2 py-1.5 text-xs text-center tabular-nums" />
                    </label>`
                  : ''
              }
            </div>
            ${
              rule === 'low'
                ? `<p class="text-[9.5px] opacity-65 leading-snug">En <b>A la baja</b>, usá dado limpio arriba (ej. <code class="font-mono-tech">1d20</code> o <code class="font-mono-tech">1d100</code> sin <code class="font-mono-tech">+@stat</code>): compara ≤ valor del bloque y 1 es crítico.</p>`
                : ''
            }
            ${
              labelFields.length > 0
                ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 border-t" style="border-color: var(--hairline);">
                    ${labelFields
                      .map(([k, title, val]) => `
                        <label class="flex flex-col gap-0.5">
                          <span class="text-[9.5px] opacity-60">Etiqueta: ${title}</span>
                          <input type="text" data-sys-outcome-label="${k}" value="${esc(val)}" class="owl-input px-2 py-1 text-[11px]" />
                        </label>`)
                      .join('')}
                  </div>`
                : ''
            }
          </div>
        `;
      })()}

      ${renderInitiativeSection()}

      <div class="flex flex-col gap-1.5">
        <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">4. Vista Fija (Arriba de las pestañas)</span>
        ${renderBlockZone({ id: 'header', label: 'Elementos fijos en cabecera', mode: 'fixed' }, true)}
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">5. Pestañas de la Ficha (${allTabs.length})</span>
        <form id="sysAddTabForm" class="flex flex-wrap items-center gap-1.5">
          <input type="text" id="inpSysNewTabName" placeholder="Nueva pestaña (ej. Disciplinas, Combate, Magia...)" required class="owl-input flex-1 min-w-[160px] px-3 py-1.5 text-xs" />
          <select id="selSysNewTabMode" class="owl-input px-2.5 py-1.5 text-xs font-medium">
            <option value="fixed">Fija (bloques)</option>
            <option value="items">Complementos</option>
          </select>
          <button type="submit" class="owl-btn owl-btn-accent px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0">+ Crear</button>
        </form>
        <div class="flex flex-col gap-2">${allTabs.map(renderTabItemCard).join('')}</div>
      </div>

      <div class="owl-subpanel rounded-xl p-2.5 flex flex-col gap-2">
        <button type="button" id="btnSysToggleStatuses" class="flex items-center justify-between w-full text-left">
          <span class="text-[11px] font-bold uppercase tracking-wider opacity-75">✨ Estados y Condiciones (${statuses.length})</span>
          <span class="text-xs opacity-65">${statusesOpen ? '▾' : '▸'}</span>
        </button>
        ${
          statusesOpen
            ? `<div class="flex flex-col gap-2 pt-1 border-t" style="border-color: var(--hairline);">
                <div class="flex justify-end">
                  <button type="button" id="btnSysResetStatuses" class="owl-btn owl-panel px-2 py-0.5 rounded-lg text-[10px]">Restaurar base</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  ${statuses
                    .map(
                      (st) => `
                    <div class="owl-panel rounded-lg px-2 py-1 flex items-center gap-1.5 text-[11px]">
                      <button type="button" data-sys-cycle-status-icon="${esc(st.key)}" class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white hover:opacity-85" style="background:${esc(st.color)};" title="Cambiar ícono">
                        ${this.renderStatusSymbolSvg(st.icon, 'w-3.5 h-3.5', state)}
                      </button>
                      <input type="text" data-sys-status-label="${esc(st.key)}" value="${esc(st.label)}" class="owl-input flex-1 min-w-0 px-1.5 py-0.5 text-[11px] font-medium" />
                      <input type="color" data-sys-status-color="${esc(st.key)}" value="${esc(st.color)}" class="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0" title="Color" />
                      ${statuses.length > 1 ? `<button type="button" data-sys-del-status="${esc(st.key)}" class="text-rose-400 opacity-65 hover:opacity-100 px-0.5 leading-none shrink-0" title="Quitar">×</button>` : ''}
                    </div>`
                    )
                    .join('')}
                </div>
                <form id="sysAddStatusForm" class="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <input type="text" id="inpSysStatusLabel" placeholder="Nuevo estado (ej. Frenesí, Miedo...)" required class="owl-input flex-1 min-w-[140px] px-2.5 py-1 text-[11px]" />
                  <select id="selSysStatusIcon" class="owl-input px-2 py-1 text-[10px]">
                    ${iconKeys.map((ik) => `<option value="${ik}">${ik}</option>`).join('')}
                  </select>
                  <input type="color" id="inpSysStatusColor" value="#ef4444" class="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" title="Color" />
                  <button type="submit" class="owl-btn owl-panel px-2.5 py-1 rounded-lg text-[10px] font-semibold">+ Estado</button>
                </form>
              </div>`
            : ''
        }
      </div>
    `;

    const renderPresetSections = () => `
      ${
        presetKey === 'pool'
          ? `<div class="owl-subpanel rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label class="flex flex-col gap-1">
                <span class="text-[10px] opacity-70">Fórmula de reserva</span>
                <input type="text" id="inpSysRollFormula" value="${esc(cfg.rollFormula || '@statd10')}" class="owl-input px-2.5 py-1.5 text-xs font-mono-tech" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-[10px] opacity-70">Umbral de éxito (≥)</span>
                <input type="number" id="inpSysThreshold" min="1" max="100" value="${Number(cfg.successThreshold) || 6}" class="owl-input px-2.5 py-1.5 text-xs tabular-nums" />
              </label>
            </div>`
          : `<div class="owl-subpanel rounded-2xl p-3 flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold">${esc(presetInfo.label)}</div>
                <div class="text-[11px] opacity-70">Dado base de este portal: <code class="font-mono-tech px-1 py-0.5 rounded bg-black/20">${esc(cfg.rollFormula)}</code></div>
              </div>
              <span class="text-[10px] px-2 py-1 rounded-full owl-panel font-mono-tech">Reglas del Portal</span>
            </div>`
      }
      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">Opciones de Reglas de este Portal</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          ${renderCheck('autoInitiative', cfg.autoInitiative !== false, 'Iniciativa auto en combate', 'Al tirar Iniciativa durante combate activo se suma al orden')}
          ${renderCheck('showDefense', cfg.showDefense !== false, 'Bloque Defensa / CA', 'Muestra Defensa e Iniciativa en la cabecera')}
          ${presetKey === 'dnd55' ? renderCheck('showLevelPb', cfg.showLevelPb !== false, 'Nivel, BC y Velocidad', 'Cálculo automático de Bono de Competencia por nivel') : ''}
          ${presetKey === 'dnd55' ? renderCheck('showScores', cfg.showScores !== false, 'Puntuación (3–20) y Salvaciones', 'Desactivalo si preferís usar modificadores directos') : ''}
          ${renderCheck('tab_skills', enabledTabs.skills !== false, 'Pestaña Habilidades', 'Lista de pericias de personaje')}
          ${renderCheck('tab_traits', enabledTabs.traits !== false, 'Pestaña Rasgos', 'Rasgos, dotes o movimientos')}
          ${renderCheck('tab_inventory', enabledTabs.inventory !== false, 'Inventario y Capacidades', 'Equipo, consumibles y capacidades desde el Compendio')}
        </div>
      </div>
      <div class="owl-subpanel rounded-2xl p-3 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-semibold">¿Querés adaptar reglas o armar bloques propios?</div>
          <div class="text-[10px] opacity-65">Convertí este portal a Sistema Genérico por bloques conservando tus fichas.</div>
        </div>
        <button type="button" id="btnSysConvertGeneric" class="owl-btn owl-panel px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0">Personalizar…</button>
      </div>
    `;

    const footerHtml = `
      <div class="flex items-center justify-between gap-2 pt-2 border-t" style="border-color: var(--hairline);">
        <button type="button" id="btnSysOpenCompendium" class="owl-btn owl-subpanel px-3 py-2 rounded-xl text-xs font-semibold">
          📚 Administrar Compendio de este portal
        </button>
        <button type="button" id="btnSysDone" class="owl-btn owl-btn-accent px-4 py-2 rounded-xl text-xs font-semibold">
          Listo
        </button>
      </div>
    `;

    const activePreviewTab = allTabs.find((t) => t.id === this.sysPreviewTabId) || allTabs[0] || null;
    const baseTok = state.tokens?.find((t) => t.id === state.selectedTokenId) || state.tokens?.[0];
    const previewTok = baseTok
      ? JSON.parse(JSON.stringify(baseTok))
      : { id: '__preview__', name: 'Kaelen (Ejemplo)', hp: 14, maxHp: 18, ac: 14, stats: {}, texts: {}, resources: [] };
    const previewTitle = previewTok.name || 'Kaelen (Ejemplo)';
    const previewInitials = previewTitle.trim().slice(0, 2).toUpperCase() || 'KA';

    const renderLivePreview = () => `
      <aside class="owl-subpanel rounded-2xl p-3 flex flex-col gap-2.5 lg:sticky lg:top-0 border" style="border-color: var(--hairline);">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">Vista previa en vivo</span>
          <span class="text-[10px] opacity-55">Actualización instantánea</span>
        </div>
        <div class="owl-panel rounded-2xl p-3 flex flex-col gap-2.5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">${esc(previewInitials)}</div>
            <div class="min-w-0">
              <div class="text-sm font-bold leading-tight truncate">${esc(previewTitle)}</div>
              <div class="text-[11px] opacity-65 truncate">${esc(state.room?.moduleTitle || 'Sistema Genérico')}</div>
            </div>
          </div>
          <div id="sysPreviewHeaderBlocks" class="pointer-events-none select-none"></div>
          ${
            allTabs.length
              ? `<div class="owl-seg flex flex-wrap gap-1 p-1 rounded-xl">
                  ${allTabs
                    .map((t) => `<button type="button" data-sys-preview-tab="${esc(t.id)}" class="owl-seg-btn flex-1 min-w-[72px] px-2 py-1 text-[10.5px] font-semibold truncate ${activePreviewTab?.id === t.id ? 'is-active' : ''}">${esc(t.label)}</button>`)
                    .join('')}
                </div>`
              : ''
          }
          <div id="sysPreviewTabBody" class="pointer-events-none select-none">
            ${
              activePreviewTab?.mode === 'items'
                ? `<div class="flex flex-col gap-1.5 text-[11px]">
                    <div class="owl-subpanel rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 opacity-80">
                      <span class="font-semibold">🗡️ Ejemplo de complemento</span>
                      <span class="text-[10px] opacity-60">Arrastrado del Compendio</span>
                    </div>
                    <div class="owl-subpanel rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 opacity-70">
                      <span class="font-semibold">🛡️ Elemento equipado</span>
                      <span class="text-[10px] opacity-60">${esc(activePreviewTab.label)}</span>
                    </div>
                  </div>`
                : ''
            }
          </div>
        </div>
      </aside>
    `;

    const trayTools = Selector.getSystemTrayTools(state);
    const trayDiceSet = new Set(trayTools.dice);
    const activeResultModes = new Set(Selector.getSystemResultModes(state));
    const renderTrayToolsSection = () => `
      <div class="owl-subpanel rounded-2xl p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">${isGeneric ? '1. ' : ''}Barra de herramientas de mesa</span>
          <span class="text-[10px] opacity-55">Dados y extras visibles abajo</span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${['4', '6', '8', '10', '12', '20', '30', '100']
            .map((d) => `<button type="button" data-sys-tray-tool="${d}" class="owl-btn px-2 py-1 rounded-lg text-[10.5px] font-mono-tech font-semibold ${trayDiceSet.has(d) ? 'owl-btn-accent' : 'owl-panel opacity-55'}">d${d}</button>`)
            .join('')}
          <button type="button" data-sys-tray-tool="fudge" class="owl-btn px-2 py-1 rounded-lg text-[10.5px] font-semibold ${trayTools.fudge ? 'owl-btn-accent' : 'owl-panel opacity-55'}">🎲 dF (Fudge)</button>
          <button type="button" data-sys-tray-tool="coin" class="owl-btn px-2 py-1 rounded-lg text-[10.5px] font-semibold ${trayTools.coin ? 'owl-btn-accent' : 'owl-panel opacity-55'}">🪙 Moneda</button>
          <button type="button" data-sys-tray-tool="deck" class="owl-btn px-2 py-1 rounded-lg text-[10.5px] font-semibold ${trayTools.deck ? 'owl-btn-accent' : 'owl-panel opacity-55'}">🃏 Baraja</button>
        </div>
        <div class="flex flex-wrap items-center gap-1 pt-1.5 border-t" style="border-color: var(--hairline);">
          <span class="text-[10px] opacity-60 mr-0.5">Modos abajo:</span>
          ${[
            ['sum', 'Total'],
            ['each', 'c/u'],
            ['max', 'Máx'],
            ['min', 'Mín'],
            ['success', 'Éxit.']
          ]
            .map(([k, lbl]) => `<button type="button" data-sys-result-mode-toggle="${k}" class="owl-btn px-2 py-0.5 rounded-lg text-[10px] font-semibold ${activeResultModes.has(k) ? 'owl-btn-accent' : 'owl-panel opacity-55'}">${lbl}</button>`)
            .join('')}
        </div>
      </div>
    `;

    body.innerHTML = isGeneric
      ? `<div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 items-start">
          <div class="flex flex-col gap-3 min-w-0">
            ${renderTrayToolsSection()}
            ${renderGenericSections()}
            ${footerHtml}
          </div>
          ${renderLivePreview()}
        </div>`
      : `${renderTrayToolsSection()}${renderPresetSections()}${renderInitiativeSection()}${footerHtml}`;

    if (isGeneric && typeof this.renderSheetBlocksInto === 'function') {
      const headerBox = body.querySelector('#sysPreviewHeaderBlocks');
      if (headerBox) {
        this.renderSheetBlocksInto(
          headerBox,
          blocks.filter((b) => (b.tabId || 'attrs') === 'header'),
          previewTok,
          cfg
        );
      }
      if (activePreviewTab?.mode === 'fixed') {
        const tabBox = body.querySelector('#sysPreviewTabBody');
        if (tabBox) {
          this.renderSheetBlocksInto(
            tabBox,
            blocks.filter((b) => (b.tabId || 'attrs') === activePreviewTab.id),
            previewTok,
            cfg,
            { sumTotal: Boolean(activePreviewTab.sumTotal) }
          );
        }
      }
    }

    this.bindSystemModalBodyEvents();
  },

  bindSystemModalBodyEvents() {
    const body = this.els.systemModalBody;
    if (!body) return;

    body.querySelectorAll('[data-sys-toggle]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const key = chk.dataset.sysToggle;
        if (key.startsWith('tab_')) {
          Service.updateSystemConfig({ enabledTabs: { [key.replace('tab_', '')]: chk.checked } });
        } else {
          Service.updateSystemConfig({ [key]: chk.checked });
        }
      });
    });

    const readBaseFormula = () => String(body.querySelector('#inpSysRollFormula')?.value ?? '').trim();
    const baseOp = this.sysBaseFormulaOp === '-' ? '-' : '+';
    body.querySelector('#inpSysRollFormula')?.addEventListener('change', (e) => {
      Service.updateSystemConfig({ rollFormula: e.target.value.trim() || '1d20+@stat' });
    });
    body.querySelector('#btnSysBaseClear')?.addEventListener('click', () => {
      Service.updateSystemConfig({ rollFormula: '' });
    });
    body.querySelectorAll('[data-sys-base-op]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysBaseFormulaOp = btn.dataset.sysBaseOp === '-' ? '-' : '+';
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-sys-base-die]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ rollFormula: Selector.appendDiceToFormula(readBaseFormula(), btn.dataset.sysBaseDie, baseOp) });
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        Service.updateSystemConfig({ rollFormula: Selector.decrementDiceInFormula(readBaseFormula(), btn.dataset.sysBaseDie) });
      });
    });
    body.querySelectorAll('[data-sys-base-stat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ rollFormula: Selector.appendStatToFormula(readBaseFormula(), btn.dataset.sysBaseStat, baseOp) });
      });
    });
    body.querySelector('#selSysResultMode')?.addEventListener('change', (e) => {
      Service.updateSystemConfig({ resultMode: e.target.value });
    });
    body.querySelector('#inpSysThreshold')?.addEventListener('change', (e) => {
      Service.updateSystemConfig({ successThreshold: Math.max(1, Number(e.target.value) || 6) });
    });
    body.querySelectorAll('[data-sys-formula-chip]').forEach((btn) => {
      btn.addEventListener('click', () => Service.updateSystemConfig({ rollFormula: btn.dataset.sysFormulaChip }));
    });

    const readInitFormula = () => String(body.querySelector('#inpSysInitFormula')?.value ?? '').trim();
    const initOp = this.sysInitFormulaOp === '-' ? '-' : '+';
    body.querySelectorAll('[data-sys-init-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ initiativeMode: btn.dataset.sysInitMode === 'manual' ? 'manual' : 'auto' });
      });
    });
    body.querySelector('#inpSysInitFormula')?.addEventListener('change', (e) => {
      Service.updateSystemConfig({ initiativeFormula: e.target.value.trim() });
    });
    body.querySelector('#btnSysInitClear')?.addEventListener('click', () => {
      Service.updateSystemConfig({ initiativeFormula: '' });
    });
    body.querySelectorAll('[data-sys-init-op]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysInitFormulaOp = btn.dataset.sysInitOp === '-' ? '-' : '+';
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-sys-init-die]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ initiativeFormula: Selector.appendDiceToFormula(readInitFormula(), btn.dataset.sysInitDie, initOp) });
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        Service.updateSystemConfig({ initiativeFormula: Selector.decrementDiceInFormula(readInitFormula(), btn.dataset.sysInitDie) });
      });
    });
    body.querySelectorAll('[data-sys-init-stat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ initiativeFormula: Selector.appendStatToFormula(readInitFormula(), btn.dataset.sysInitStat, initOp) });
      });
    });

    body.querySelectorAll('[data-sys-result-mode-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => Service.toggleSystemResultMode(btn.dataset.sysResultModeToggle));
    });
    body.querySelector('#selSysOutcomeRule')?.addEventListener('change', (e) => {
      Service.updateSystemOutcome({ outcomeRule: e.target.value });
    });
    body.querySelector('#chkSysShowCrits')?.addEventListener('change', (e) => {
      Service.updateSystemOutcome({ showCrits: e.target.checked });
    });
    body.querySelector('#inpSysTierHigh')?.addEventListener('change', (e) => {
      Service.updateSystemOutcome({ tieredHigh: Math.trunc(Number(e.target.value) || 10) });
    });
    body.querySelector('#inpSysTierMid')?.addEventListener('change', (e) => {
      Service.updateSystemOutcome({ tieredMid: Math.trunc(Number(e.target.value) || 7) });
    });
    body.querySelectorAll('[data-sys-outcome-label]').forEach((inp) => {
      inp.addEventListener('change', () => {
        Service.updateSystemOutcome({ outcomeLabels: { [inp.dataset.sysOutcomeLabel]: inp.value.trim() } });
      });
    });

    body.querySelector('#sysAddTabForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = body.querySelector('#inpSysNewTabName')?.value.trim();
      const mode = body.querySelector('#selSysNewTabMode')?.value || 'fixed';
      if (name) Service.addSystemCustomTab(name, mode);
    });
    body.querySelectorAll('[data-sys-move-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tabId, dir] = btn.dataset.sysMoveTab.split(':');
        Service.moveSystemTabOrder(tabId, Number(dir));
      });
    });
    body.querySelectorAll('[data-sys-rename-tab]').forEach((inp) => {
      inp.addEventListener('change', () => Service.renameSystemCustomTab(inp.dataset.sysRenameTab, inp.value));
    });
    body.querySelectorAll('[data-sys-sum-tab]').forEach((btn) => {
      btn.addEventListener('click', () => Service.toggleSystemCustomTabSum(btn.dataset.sysSumTab));
    });
    body.querySelectorAll('[data-sys-del-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sysDelTab;
        this.confirmDeleteTabId = this.confirmDeleteTabId === id ? null : id;
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-sys-del-tab-confirm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sysDelTabConfirm;
        this.confirmDeleteTabId = null;
        Service.removeSystemCustomTab(id);
      });
    });
    body.querySelectorAll('[data-sys-del-tab-cancel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.confirmDeleteTabId = null;
        this.renderSystemModal(Service.state);
      });
    });

    body.querySelectorAll('[data-sys-preview-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysPreviewTabId = btn.dataset.sysPreviewTab;
        this.renderSystemModal(Service.state);
      });
    });

    body.querySelectorAll('[data-sys-pick-blk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sysPickBlk;
        this.selectedSysBlockId = this.selectedSysBlockId === id ? null : id;
        const blk = (Service.state.systemConfig?.sheetBlocks || []).find((b) => b.id === id);
        if (this.selectedSysBlockId && blk?.tabId && blk.tabId !== 'header') {
          this.sysPreviewTabId = blk.tabId;
        }
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-sys-add-blk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tabId, kind] = btn.dataset.sysAddBlk.split(':');
        if (tabId && tabId !== 'header') this.sysPreviewTabId = tabId;
        const created = Service.addSystemBlock(kind, { tabId });
        if (created) this.selectedSysBlockId = created.id;
      });
    });

    const insp = body.querySelector('[data-blk-inspector]');
    if (insp) {
      const blkId = insp.dataset.blkInspector;
      insp.querySelector('#btnSysCloseInspector')?.addEventListener('click', () => {
        this.selectedSysBlockId = null;
        this.renderSystemModal(Service.state);
      });
      insp.querySelector('[data-blk-del]')?.addEventListener('click', () => {
        this.selectedSysBlockId = null;
        Service.removeSystemBlock(blkId);
      });
      insp.querySelectorAll('[data-blk-move]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const [, dir] = btn.dataset.blkMove.split(':');
          Service.moveSystemBlockOrder(blkId, Number(dir));
        });
      });
      insp.querySelectorAll('[data-blk-size]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateSystemBlock(blkId, { size: btn.dataset.blkSize });
        });
      });
      insp.querySelectorAll('[data-blk-text-rows]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateSystemBlock(blkId, { textRows: Number(btn.dataset.blkTextRows) || 1 });
        });
      });
      insp.querySelectorAll('[data-blk-pip-shape]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateSystemBlock(blkId, { pipShape: btn.dataset.blkPipShape });
        });
      });
      insp.querySelectorAll('[data-blk-pip-states]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateSystemBlock(blkId, { pipStates: Number(btn.dataset.blkPipStates) || 1 });
        });
      });
      insp.querySelectorAll('[data-blk-valuemode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateSystemBlock(blkId, { valueMode: btn.dataset.blkValuemode });
        });
      });
      const readCalcFormula = () => String(insp.querySelector('[data-blk-edit="calcFormula"]')?.value ?? '');
      insp.querySelectorAll('[data-blk-calc-tok]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = `${readCalcFormula()}${btn.dataset.blkCalcTok}`;
          Service.updateSystemBlock(blkId, { calcFormula: next });
        });
      });
      insp.querySelector('#btnBlkCalcBack')?.addEventListener('click', () => {
        const cur = readCalcFormula();
        Service.updateSystemBlock(blkId, { calcFormula: cur.slice(0, -1) });
      });
      insp.querySelector('#btnBlkCalcClear')?.addEventListener('click', () => {
        Service.updateSystemBlock(blkId, { calcFormula: '' });
      });
      insp.querySelector('[data-blk-edit-rollmode]')?.addEventListener('change', (e) => {
        Service.updateSystemBlock(blkId, { rollMode: e.target.value });
      });
      const readFormulaVal = () => String(insp.querySelector('[data-blk-edit="formula"]')?.value ?? '').trim();
      const op = this.sysFormulaOp === '-' ? '-' : '+';
      insp.querySelectorAll('[data-blk-formula-op]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.sysFormulaOp = btn.dataset.blkFormulaOp;
          this.renderSystemModal(Service.state);
        });
      });
      insp.querySelectorAll('[data-blk-add-die]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateSystemBlock(blkId, { formula: Selector.appendDiceToFormula(readFormulaVal(), btn.dataset.blkAddDie, op) });
        });
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          Service.updateSystemBlock(blkId, { formula: Selector.decrementDiceInFormula(readFormulaVal(), btn.dataset.blkAddDie) });
        });
      });
      insp.querySelectorAll('[data-blk-add-stat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateSystemBlock(blkId, { formula: Selector.appendStatToFormula(readFormulaVal(), btn.dataset.blkAddStat, op) });
        });
      });
      insp.querySelector('[data-blk-formula-clear]')?.addEventListener('click', () => {
        Service.updateSystemBlock(blkId, { formula: '' });
      });
      insp.querySelectorAll('[data-blk-edit]').forEach((el) => {
        el.addEventListener('change', () => {
          const field = el.dataset.blkEdit;
          const val = field === 'max' ? Number(el.value) || 0 : el.value;
          Service.updateSystemBlock(blkId, { [field]: val });
        });
      });
    }

    body.querySelector('#btnSysToggleStatuses')?.addEventListener('click', () => {
      this.sysStatusesExpanded = !this.sysStatusesExpanded;
      this.renderSystemModal(Service.state);
    });
    const iconOrder = DEFAULT_STATUS_DEFS.map((d) => d.icon);
    body.querySelectorAll('[data-sys-cycle-status-icon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sysCycleStatusIcon;
        const cur = Selector.getStatusDef(Service.state, key);
        Service.updateSystemStatusDef(key, { icon: iconOrder[(iconOrder.indexOf(cur.icon) + 1) % iconOrder.length] });
      });
    });
    body.querySelectorAll('[data-sys-status-label]').forEach((inp) => {
      inp.addEventListener('change', () => {
        if (inp.value.trim()) Service.updateSystemStatusDef(inp.dataset.sysStatusLabel, { label: inp.value.trim() });
      });
    });
    body.querySelectorAll('[data-sys-status-color]').forEach((inp) => {
      inp.addEventListener('change', () => Service.updateSystemStatusDef(inp.dataset.sysStatusColor, { color: inp.value }));
    });
    body.querySelectorAll('[data-sys-del-status]').forEach((btn) => {
      btn.addEventListener('click', () => Service.removeSystemStatusDef(btn.dataset.sysDelStatus));
    });
    body.querySelector('#btnSysResetStatuses')?.addEventListener('click', () => Service.resetSystemStatuses());
    body.querySelector('#sysAddStatusForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const label = body.querySelector('#inpSysStatusLabel')?.value.trim();
      const icon = body.querySelector('#selSysStatusIcon')?.value || 'mark';
      const color = body.querySelector('#inpSysStatusColor')?.value || '#ef4444';
      if (label && !Service.addSystemStatusDef({ label, icon, color })) {
        this.showActionToast('Ya existe un estado con ese nombre.');
      }
    });

    body.querySelectorAll('[data-sys-tray-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.toggleSystemTrayTool(btn.dataset.sysTrayTool);
      });
    });

    body.querySelector('#btnSysConvertGeneric')?.addEventListener('click', () => Service.convertPortalToGeneric());
    body.querySelector('#btnSysOpenCompendium')?.addEventListener('click', () => {
      this.els.systemModal?.classList.remove('is-open');
      Service.state.drawerOpen = true;
      Service.notify({ skipVaultSave: true });
    });
    body.querySelector('#btnSysDone')?.addEventListener('click', () => this.els.systemModal?.classList.remove('is-open'));
  }
};
