/* ==========================================================================
   SYSTEM BLOCK BUILDER VIEW: CONSTRUCTOR POR BLOQUES, PESTAÑAS Y VISTA PREVIA
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261117b1';
import { Service } from '../core/service.js?v=20261117b1';

export const SVG_ICONS = {
  number: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
  resource: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="10" rx="5"/><line x1="8" y1="12" x2="14" y2="12"/></svg>',
  roll: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/></svg>',
  text: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>',
  coin: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10"/></svg>',
  deck: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 9l2 3-2 3-2-3z"/></svg>',
  compendium: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  trash: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  arrowLeft: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg>',
  arrowRight: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5L10.5 8 6 12.5"/></svg>',
  arrowUp: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10L8 5.5l4.5 4.5"/></svg>',
  arrowDown: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6L8 10.5 12.5 6"/></svg>',
  close: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  warn: '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

export const BLOCK_BADGES = {
  number: { icon: SVG_ICONS.number, name: 'Número' },
  resource: { icon: SVG_ICONS.resource, name: 'Recurso' },
  roll: { icon: SVG_ICONS.roll, name: 'Tirada' },
  text: { icon: SVG_ICONS.text, name: 'Texto' }
};

const SIZE_BADGE_MAP = { '1/3': '⅓', '1/2': '½', '2/3': '⅔', '1/1': 'Todo' };

export const SystemBlockBuilderViewMethods = {
  renderFormulaChipsBar(state, { opAttr, opVal, dieAttr, statAttr, includeCard = true, extraStatChipHtml = '' }) {
    const esc = (s) => this.escapeHtml(s);
    const statsDefs = Selector.getSheetStatsDef(state);
    const diceList = [
      ...[4, 6, 8, 10, 12, 20].map((d) => [String(d), `${opVal}d${d}`, `d${d}`]),
      ['f', `${opVal}dF`, 'dado Fudge'],
      ['2', `${opVal}d2`, 'Moneda (0/1)'],
      ...(includeCard ? [['card', `${opVal}carta`, 'Baraja']] : [])
    ];
    const diceHtml = diceList
      .map(([k, lbl, hint]) => `<button type="button" ${dieAttr}="${k}" class="portal-seg-btn portal-panel px-1.5 py-0.5 text-[10px] font-mono-tech" title="Clic: ${opVal === '-' ? 'restar' : 'sumar'} ${hint} · Clic derecho: quitar">${lbl}</button>`)
      .join('');
    const statChips = statsDefs.length
      ? statsDefs
          .map((st) => `<button type="button" ${statAttr}="${esc(st.alias || st.key)}" class="portal-seg-btn portal-panel px-1.5 py-0.5 text-[10px] font-semibold" title="${opVal === '-' ? 'Restar' : 'Sumar'} @${esc(st.alias || st.key)}">${opVal === '-' ? '−' : ''}@${esc(st.label)}</button>`)
          .join('')
      : (extraStatChipHtml ? '' : '<span class="text-[10px] opacity-55 italic px-1">Agregá bloques Número en Ficha y Bloques para usarlos como @clave.</span>');

    return `
      <div class="portal-formula-bar">
        <div class="portal-seg inline-grid grid-cols-2 gap-0.5 text-[10px] mr-0.5" title="Modo: sumar (+) o restar (−)">
          <button type="button" ${opAttr}="+" class="portal-seg-btn px-1.5 py-0.5 font-bold ${opVal === '+' ? 'is-active' : ''}">+</button>
          <button type="button" ${opAttr}="-" class="portal-seg-btn px-1.5 py-0.5 font-bold ${opVal === '-' ? 'is-active' : ''}">−</button>
        </div>
        ${diceHtml}
        ${extraStatChipHtml}
        ${statChips ? `<div class="w-full pt-1 mt-0.5 border-t flex flex-wrap gap-1" style="border-color: var(--hairline);">${statChips}</div>` : ''}
      </div>
    `;
  },

  renderFormulaEditor(state, blk, labelText, placeholderText, defaultVal = '') {
    const esc = (s) => this.escapeHtml(s);
    const formulaOp = this.sysFormulaOp === '-' ? '-' : '+';
    const curFormula = blk.formula ?? defaultVal;
    return `
      <div class="flex flex-col gap-1.5">
        <span class="text-[10.5px] font-medium opacity-70">${labelText}</span>
        <div class="flex items-center gap-1.5">
          <input type="text" data-blk-edit="formula" value="${esc(curFormula)}" placeholder="${esc(placeholderText)}" class="portal-input px-2.5 py-1.5 text-[11px] font-mono-tech flex-1 min-w-0" />
          <button type="button" data-blk-formula-clear class="portal-btn portal-subpanel px-2.5 py-1.5 rounded-lg text-[10.5px] opacity-80 hover:opacity-100 shrink-0" title="Vaciar fórmula">Limpiar</button>
        </div>
        ${this.renderFormulaChipsBar(state, {
          opAttr: 'data-blk-formula-op',
          opVal: formulaOp,
          dieAttr: 'data-blk-add-die',
          statAttr: 'data-blk-add-stat',
          includeCard: true
        })}
      </div>
    `;
  },

  renderBlockInspector(state, blk, fixedTargets) {
    if (!blk) return '';
    const esc = (s) => this.escapeHtml(s);
    const statsDefs = Selector.getSheetStatsDef(state);
    const info = BLOCK_BADGES[blk.kind] || BLOCK_BADGES.number;
    const renderSegGroup = (label, colsCls, items, activeVal, attrName) => `
      <div class="flex flex-col gap-1">
        <span class="text-[10.5px] opacity-70">${label}</span>
        <div class="portal-seg grid ${colsCls} gap-0.5 text-[10.5px]">
          ${items
            .map(([val, text, title]) => `<button type="button" ${attrName}="${esc(val)}" class="portal-seg-btn py-1 ${activeVal === val ? 'is-active' : ''}"${title ? ` title="${esc(title)}"` : ''}>${text}</button>`)
            .join('')}
        </div>
      </div>
    `;
    let specificHtml = '';

    if (blk.kind === 'number') {
      const rm = blk.rollMode || 'base';
      const vm = blk.valueMode === 'calc' ? 'calc' : 'manual';
      const otherStats = statsDefs.filter((st) => (st.alias || st.key) !== blk.key);
      const calcOpChips = [
        ['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷'],
        ['(', '('], [')', ')'], ['floor(', 'floor('],
        ['1', '1'], ['2', '2'], ['5', '5'], ['10', '10']
      ]
        .map(([tokVal, lbl]) => `<button type="button" data-blk-calc-tok="${esc(tokVal)}" class="portal-seg-btn portal-panel px-1.5 py-0.5 text-[10px] font-mono-tech">${lbl}</button>`)
        .join('');
      const calcStatChips = otherStats.length
        ? otherStats
            .map((st) => `<button type="button" data-blk-calc-tok="@${esc(st.alias || st.key)}" class="portal-seg-btn portal-panel px-1.5 py-0.5 text-[10px] font-semibold" title="Insertar @${esc(st.alias || st.key)}">@${esc(st.label)}</button>`)
            .join('')
        : '<span class="text-[10px] opacity-55 italic">Creá otros bloques Número para referenciarlos acá.</span>';
      specificHtml = `
        <div class="flex flex-col gap-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
            <div class="flex flex-col gap-1">
              <span class="text-[10.5px] opacity-70">Valor en la ficha</span>
              <div class="portal-seg grid grid-cols-2 gap-0.5 text-[10.5px]">
                <button type="button" data-blk-valuemode="manual" class="portal-seg-btn py-1 ${vm === 'manual' ? 'is-active' : ''}">Editable</button>
                <button type="button" data-blk-valuemode="calc" class="portal-seg-btn py-1 ${vm === 'calc' ? 'is-active' : ''}">Calculado (fx)</button>
              </div>
            </div>
            <label class="flex flex-col gap-1">
              <span class="text-[10.5px] opacity-70">Al hacer clic en el nombre</span>
              <select data-blk-edit-rollmode="${esc(blk.id)}" class="portal-input px-2.5 py-1.5 text-[11px]">
                <option value="base" ${rm === 'base' ? 'selected' : ''}>Tira dado base</option>
                <option value="none" ${rm === 'none' ? 'selected' : ''}>Solo dato (no tira)</option>
                <option value="custom" ${rm === 'custom' ? 'selected' : ''}>Fórmula propia</option>
              </select>
            </label>
          </div>
          ${
            vm === 'calc'
              ? `<div class="flex flex-col gap-1.5 p-2.5 rounded-xl portal-subpanel">
                  <span class="text-[10.5px] opacity-75 font-medium">Fórmula de cálculo (solo lectura en ficha)</span>
                  <div class="flex items-center gap-1">
                    <input type="text" data-blk-edit="calcFormula" value="${esc(blk.calcFormula ?? '')}" placeholder="Ej: 10+@des o floor((@fue-10)/2)" class="portal-input px-2.5 py-1.5 text-[11px] font-mono-tech flex-1 min-w-0" />
                    <button type="button" id="btnBlkCalcBack" class="portal-btn portal-panel px-2 py-1.5 rounded-lg text-[10px]" title="Borrar último carácter">⌫</button>
                    <button type="button" id="btnBlkCalcClear" class="portal-btn portal-panel px-2 py-1.5 rounded-lg text-[10px] opacity-80" title="Vaciar fórmula">Limpiar</button>
                  </div>
                  <div class="portal-formula-bar">
                    ${calcOpChips}
                    <div class="w-full pt-1 mt-0.5 border-t flex flex-wrap gap-1" style="border-color: var(--hairline);">${calcStatChips}</div>
                  </div>
                </div>`
              : ''
          }
          ${rm === 'custom' ? this.renderFormulaEditor(state, blk, 'Fórmula propia de tirada', `Ej: 2d6+@${blk.key}`, '') : ''}
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
        <div class="flex flex-col gap-2">
          <div class="grid grid-cols-3 gap-2 items-end">
            <label class="flex flex-col gap-1">
              <span class="text-[10.5px] opacity-70">Máx (0=libre)</span>
              <input type="number" data-blk-edit="max" min="0" max="999" value="${maxVal}" class="portal-input px-2 py-1.5 text-[11px] text-center tabular-nums" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[10.5px] opacity-70">Estilo</span>
              <select data-blk-edit="resStyle" class="portal-input px-2 py-1.5 text-[11px]">
                <option value="auto" ${rs === 'auto' ? 'selected' : ''}>Auto</option>
                <option value="pips" ${rs === 'pips' ? 'selected' : ''}>Casillas ●</option>
                <option value="bar" ${rs === 'bar' ? 'selected' : ''}>Barra</option>
              </select>
            </label>
            <label class="flex items-center justify-between portal-input px-2.5 py-1.5 rounded-lg cursor-pointer">
              <span class="text-[10.5px] opacity-75">Color</span>
              <input type="color" data-blk-edit="color" value="${esc(blk.color || '#8b5cf6')}" class="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0" />
            </label>
          </div>
          ${
            showsPips
              ? `<div class="grid grid-cols-2 gap-2 items-end">
                  ${renderSegGroup('Forma', 'grid-cols-3', [['circle', '●', 'Círculo'], ['square', '■', 'Cuadrado'], ['diamond', '◆', 'Rombo']], pipShape, 'data-blk-pip-shape')}
                  ${renderSegGroup('Niveles por casilla', 'grid-cols-3 text-[10px]', [[1, '1 · ●', 'Vacío o lleno'], [2, '2 · ◐', 'Vacío, mitad diagonal o lleno'], [3, '3 · ✕', 'Vacío, /, ✕ o lleno']], pipStates, 'data-blk-pip-states')}
                </div>`
              : ''
          }
        </div>
      `;
    } else if (blk.kind === 'roll') {
      specificHtml = this.renderFormulaEditor(state, blk, 'Fórmula (tocá dados o atributos para sumar)', 'Ej: 1d20+@fue', '1d20');
    } else {
      const curSize = Selector.resolveBlockSize(blk);
      const textRows = Number(blk.textRows) || 1;
      specificHtml = `
        <div class="grid grid-cols-1 ${curSize === '1/1' ? 'sm:grid-cols-2' : ''} gap-2 items-end">
          <label class="flex flex-col gap-1">
            <span class="text-[10.5px] opacity-70">Texto guía (placeholder)</span>
            <input type="text" data-blk-edit="placeholder" value="${esc(blk.placeholder || '')}" class="portal-input px-2.5 py-1.5 text-[11px]" />
          </label>
          ${curSize === '1/1' ? renderSegGroup('Altura en fila completa', 'grid-cols-3', [[1, '1 línea'], [3, '3 líneas'], [5, '5 líneas']], textRows, 'data-blk-text-rows') : ''}
        </div>
      `;
    }

    return `
      <div data-blk-inspector="${esc(blk.id)}" class="portal-inspector-card flex flex-col gap-2.5">
        <div class="flex items-center justify-between gap-2 pb-2 border-b" style="border-color: var(--hairline);">
          <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold min-w-0">
            <span class="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style="background: var(--accent-soft); color: var(--accent-primary);">${info.icon}</span>
            <span class="truncate">${info.name}</span>
            <code class="opacity-60 font-mono-tech text-[10px]">@${esc(blk.key)}</code>
          </span>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-blk-move="${esc(blk.id)}:-1" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-lg" title="Mover antes">${SVG_ICONS.arrowLeft}</button>
            <button type="button" data-blk-move="${esc(blk.id)}:1" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-lg" title="Mover después">${SVG_ICONS.arrowRight}</button>
            <button type="button" data-blk-del="${esc(blk.id)}" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-lg text-rose-400" title="Eliminar bloque">${SVG_ICONS.trash}</button>
            <button type="button" id="btnSysCloseInspector" class="portal-btn portal-btn-accent px-2.5 h-6 rounded-lg text-[10.5px] font-semibold">OK</button>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label class="flex flex-col gap-1">
            <span class="text-[10.5px] opacity-70">Nombre visible</span>
            <input type="text" data-blk-edit="label" value="${esc(blk.label)}" class="portal-input px-2.5 py-1.5 text-[11px] font-semibold" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[10.5px] opacity-70">Ubicación</span>
            <select data-blk-edit="tabId" class="portal-input px-2.5 py-1.5 text-[11px]">
              ${fixedTargets.map((t) => `<option value="${esc(t.id)}" ${t.id === (blk.tabId || 'attrs') ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
            </select>
          </label>
          ${renderSegGroup('Tamaño en fila', 'grid-cols-4', [['1/3', '⅓'], ['1/2', '½'], ['2/3', '⅔'], ['1/1', 'Todo']], Selector.resolveBlockSize(blk), 'data-blk-size')}
        </div>
        ${specificHtml}
      </div>
    `;
  },

  renderDeleteTabWarning(tab) {
    const esc = (s) => this.escapeHtml(s);
    return this.confirmDeleteTabId === tab.id
      ? `<div class="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
          <span class="inline-flex items-center gap-1.5 text-rose-200 leading-snug">${SVG_ICONS.warn}<span>Si eliminás "${esc(tab.label)}", se perderán sus elementos.</span></span>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-sys-del-tab-confirm="${esc(tab.id)}" class="portal-btn px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-rose-500/85 text-white hover:bg-rose-500">Eliminar</button>
            <button type="button" data-sys-del-tab-cancel class="portal-btn px-2.5 py-1 rounded-lg text-[10.5px] font-semibold portal-panel opacity-90">Cancelar</button>
          </div>
        </div>`
      : '';
  },

  renderTabOrderBtns(allTabs, tabId) {
    if (allTabs.length <= 1) return '';
    const esc = (s) => this.escapeHtml(s);
    const idx = allTabs.findIndex((t) => t.id === tabId);
    return `
      ${idx > 0 ? `<button type="button" data-sys-move-tab="${esc(tabId)}:-1" class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg" title="Subir pestaña">${SVG_ICONS.arrowUp}</button>` : ''}
      ${idx < allTabs.length - 1 ? `<button type="button" data-sys-move-tab="${esc(tabId)}:1" class="portal-btn portal-panel w-6 h-6 p-0 rounded-lg" title="Bajar pestaña">${SVG_ICONS.arrowDown}</button>` : ''}
    `;
  },

  renderBlockZone(state, zoneObj, isHeader = false) {
    const esc = (s) => this.escapeHtml(s);
    const allTabs = Selector.getSystemSheetTabs(state);
    const blocks = Selector.getSystemSheetBlocks(state);
    const fixedTargets = [{ id: 'header', label: 'Vista Fija' }, ...allTabs.filter((t) => t.mode === 'fixed')];
    const selectedBlk = blocks.find((b) => b.id === this.selectedSysBlockId) || null;
    const zoneBlocks = blocks.filter((b) => (b.tabId || 'attrs') === zoneObj.id);
    const showInspectorHere = selectedBlk && (selectedBlk.tabId || 'attrs') === zoneObj.id;

    const pillsHtml = zoneBlocks.length
      ? zoneBlocks
          .map((b) => {
            const info = BLOCK_BADGES[b.kind] || BLOCK_BADGES.number;
            const active = selectedBlk?.id === b.id;
            const szLbl = SIZE_BADGE_MAP[Selector.resolveBlockSize(b)] || '⅓';
            return `<button type="button" data-sys-pick-blk="${esc(b.id)}" class="portal-block-pill ${active ? 'is-active' : ''}">
              <span class="opacity-80">${info.icon}</span>
              <span>${esc(b.label)}</span>
              <span class="text-[9.5px] opacity-60 font-mono-tech">${szLbl}</span>
            </button>`;
          })
          .join('')
      : '<span class="text-[11px] opacity-55 italic">Sin bloques · agregá uno abajo.</span>';

    const paletteHtml = `
      <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t" style="border-color: var(--hairline);">
        <span class="text-[10.5px] opacity-60 mr-0.5">Añadir:</span>
        ${['number', 'resource', 'roll', 'text']
          .map((kind) => {
            const info = BLOCK_BADGES[kind];
            return `<button type="button" data-sys-add-blk="${esc(zoneObj.id)}:${kind}" class="portal-btn portal-panel px-2.5 py-1 rounded-lg text-[10.5px] font-medium gap-1.5"><span class="opacity-75">${info.icon}</span><span>${info.name}</span></button>`;
          })
          .join('')}
      </div>
    `;

    return `
      <div class="portal-settings-group">
        <div class="portal-settings-col">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="text-[10px] px-2 py-0.5 rounded-full portal-panel font-medium opacity-80 shrink-0">${isHeader ? 'Siempre visible' : 'Fija'}</span>
              ${
                isHeader
                  ? `<strong class="text-xs font-semibold truncate">${esc(zoneObj.label)}</strong>`
                  : `<input type="text" data-sys-rename-tab="${esc(zoneObj.id)}" value="${esc(zoneObj.label)}" class="portal-input px-2.5 py-1 text-xs font-semibold flex-1 min-w-0" />`
              }
            </div>
            ${
              isHeader
                ? ''
                : `<div class="flex items-center gap-1 shrink-0">
                    ${this.renderTabOrderBtns(allTabs, zoneObj.id)}
                    <button type="button" data-sys-sum-tab="${esc(zoneObj.id)}" class="portal-btn px-2 h-6 rounded-lg text-[10.5px] font-semibold ${zoneObj.sumTotal ? 'portal-btn-accent' : 'portal-panel opacity-75'}" title="Mostrar Σ suma total de números">Σ</button>
                    ${allTabs.length > 1 ? `<button type="button" data-sys-del-tab="${esc(zoneObj.id)}" class="portal-btn w-6 h-6 p-0 rounded-full text-rose-400 opacity-75 hover:opacity-100" title="Eliminar pestaña">${SVG_ICONS.close}</button>` : ''}
                  </div>`
            }
          </div>
          ${!isHeader ? this.renderDeleteTabWarning(zoneObj) : ''}
          <div class="flex flex-wrap gap-1.5 py-0.5">${pillsHtml}</div>
          ${showInspectorHere ? this.renderBlockInspector(state, selectedBlk, fixedTargets) : ''}
          ${paletteHtml}
        </div>
      </div>
    `;
  },

  renderTabItemCard(state, tab) {
    if (tab.mode === 'fixed') return this.renderBlockZone(state, tab, false);
    const esc = (s) => this.escapeHtml(s);
    const allTabs = Selector.getSystemSheetTabs(state);
    return `
      <div class="portal-settings-group">
        <div class="portal-settings-col">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0" style="background: var(--accent-soft); color: var(--accent-primary);">Complementos</span>
              <input type="text" data-sys-rename-tab="${esc(tab.id)}" value="${esc(tab.label)}" class="portal-input px-2.5 py-1 text-xs font-semibold flex-1 min-w-0" />
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${this.renderTabOrderBtns(allTabs, tab.id)}
              ${allTabs.length > 1 ? `<button type="button" data-sys-del-tab="${esc(tab.id)}" class="portal-btn w-6 h-6 p-0 rounded-full text-rose-400 opacity-75 hover:opacity-100" title="Eliminar pestaña">${SVG_ICONS.close}</button>` : ''}
            </div>
          </div>
          ${this.renderDeleteTabWarning(tab)}
          <span class="text-[10.5px] opacity-60">Acepta complementos arrastrados y aparece como destino en el Compendio.</span>
        </div>
      </div>
    `;
  },

  renderGenericSheetPane(state) {
    const allTabs = Selector.getSystemSheetTabs(state);
    return `
      <div class="flex flex-col gap-1.5">
        <span class="portal-settings-label">Cabecera fija (arriba de las pestañas)</span>
        ${this.renderBlockZone(state, { id: 'header', label: 'Elementos fijos en cabecera', mode: 'fixed' }, true)}
      </div>

      <div class="flex flex-col gap-2">
        <span class="portal-settings-label">Pestañas de la ficha (${allTabs.length})</span>
        <div class="portal-settings-group">
          <form id="sysAddTabForm" class="portal-settings-col">
            <div class="flex flex-wrap items-center gap-1.5">
              <input type="text" id="inpSysNewTabName" placeholder="Nueva pestaña (ej. Disciplinas, Magia...)" required class="portal-input flex-1 min-w-[160px] px-2.5 py-1.5 text-xs" />
              <select id="selSysNewTabMode" class="portal-input w-auto px-2.5 py-1.5 text-xs font-medium">
                <option value="fixed">Fija (bloques)</option>
                <option value="items">Complementos</option>
              </select>
              <button type="submit" class="portal-btn portal-btn-accent px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0">+ Crear</button>
            </div>
          </form>
        </div>
        <div class="flex flex-col gap-2.5">${allTabs.map((t) => this.renderTabItemCard(state, t)).join('')}</div>
      </div>
    `;
  },

  renderLivePreview(state) {
    const esc = (s) => this.escapeHtml(s);
    const allTabs = Selector.getSystemSheetTabs(state);
    const activePreviewTab = allTabs.find((t) => t.id === this.sysPreviewTabId) || allTabs[0] || null;
    const baseTok = state.tokens?.find((t) => t.id === state.selectedTokenId) || state.tokens?.[0];
    const previewTitle = baseTok?.name || 'Kaelen (Ejemplo)';
    const previewInitials = previewTitle.trim().slice(0, 2).toUpperCase() || 'KA';

    return `
      <div class="flex flex-col gap-1.5">
        <span class="portal-settings-label">Vista previa en vivo</span>
        <div class="portal-settings-group flex flex-col">
          <div class="portal-settings-row">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">${esc(previewInitials)}</div>
              <div class="min-w-0">
                <div class="text-xs font-bold leading-tight truncate">${esc(previewTitle)}</div>
                <div class="text-[10.5px] opacity-60 truncate">${esc(state.room?.moduleTitle || 'Sistema Genérico')}</div>
              </div>
            </div>
            <span class="text-[10px] opacity-55 shrink-0">Tocá un bloque para editarlo</span>
          </div>
          <div class="p-3 border-t flex flex-col gap-2.5" style="border-color: var(--hairline);">
            <div id="sysPreviewHeaderBlocks" class="select-none"></div>
            ${
              allTabs.length
                ? `<div class="portal-seg flex flex-wrap gap-1 p-1 rounded-xl">
                    ${allTabs
                      .map((t) => `<button type="button" data-sys-preview-tab="${esc(t.id)}" class="portal-seg-btn flex-1 min-w-[72px] px-2 py-1 text-[10.5px] font-semibold truncate ${activePreviewTab?.id === t.id ? 'is-active' : ''}">${esc(t.label)}</button>`)
                      .join('')}
                  </div>`
                : ''
            }
            <div id="sysPreviewTabBody" class="select-none">
              ${
                activePreviewTab?.mode === 'items'
                  ? `<div class="flex flex-col gap-1.5 text-[11px]">
                      <div class="portal-subpanel rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 opacity-80">
                        <span class="font-semibold">Ejemplo de complemento</span>
                        <span class="text-[10px] opacity-60">Arrastrado del Compendio</span>
                      </div>
                    </div>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
  },

  annotatePreviewBlocks(containerEl, zoneBlocks) {
    const grid = containerEl?.querySelector('.grid');
    if (!grid) return;
    Array.from(grid.children).forEach((card, idx) => {
      const blk = zoneBlocks[idx];
      if (!blk) return;
      card.setAttribute('data-sys-preview-blk', blk.id);
      card.classList.add('cursor-pointer', 'transition-all');
      if (this.selectedSysBlockId === blk.id) {
        card.style.outline = '1.5px solid var(--accent-primary)';
        card.style.outlineOffset = '1px';
      }
    });
  },

  bindSystemBlockBuilderEvents(body) {
    if (!body) return;

    body.querySelector('#sysAddTabForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = body.querySelector('#inpSysNewTabName')?.value.trim();
      const mode = body.querySelector('#selSysNewTabMode')?.value || 'fixed';
      if (name) {
        this.sysModalSection = 'sheet';
        const created = Service.addSystemCustomTab(name, mode);
        if (created) {
          this.sysPreviewTabId = created.id;
          this.renderSystemModal(Service.state);
        }
      }
    });
    body.querySelectorAll('[data-sys-move-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tabId, dir] = btn.dataset.sysMoveTab.split(':');
        this.sysModalSection = 'sheet';
        Service.moveSystemTabOrder(tabId, Number(dir));
      });
    });
    body.querySelectorAll('[data-sys-rename-tab]').forEach((inp) => {
      inp.addEventListener('change', () => Service.renameSystemCustomTab(inp.dataset.sysRenameTab, inp.value));
    });
    body.querySelectorAll('[data-sys-sum-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysModalSection = 'sheet';
        Service.toggleSystemCustomTabSum(btn.dataset.sysSumTab);
      });
    });
    body.querySelectorAll('[data-sys-del-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sysDelTab;
        this.sysModalSection = 'sheet';
        this.confirmDeleteTabId = this.confirmDeleteTabId === id ? null : id;
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-sys-del-tab-confirm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sysDelTabConfirm;
        this.sysModalSection = 'sheet';
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

    const selectBlock = (id, requireSheetMatch = false) => {
      const shouldClear = this.selectedSysBlockId === id && (!requireSheetMatch || this.sysModalSection === 'sheet');
      this.selectedSysBlockId = shouldClear ? null : id;
      this.sysModalSection = 'sheet';
      const blk = (Service.state.systemConfig?.sheetBlocks || []).find((b) => b.id === id);
      if (this.selectedSysBlockId && blk?.tabId && blk.tabId !== 'header') {
        this.sysPreviewTabId = blk.tabId;
      }
      this.renderSystemModal(Service.state);
    };

    body.querySelectorAll('[data-sys-preview-blk]').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectBlock(card.dataset.sysPreviewBlk, true);
      }, { capture: true });
    });

    body.querySelectorAll('[data-sys-pick-blk]').forEach((btn) => {
      btn.addEventListener('click', () => selectBlock(btn.dataset.sysPickBlk, false));
    });
    body.querySelectorAll('[data-sys-add-blk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tabId, kind] = btn.dataset.sysAddBlk.split(':');
        this.sysModalSection = 'sheet';
        if (tabId && tabId !== 'header') this.sysPreviewTabId = tabId;
        const created = Service.addSystemBlock(kind, { tabId });
        if (created) {
          this.selectedSysBlockId = created.id;
          this.renderSystemModal(Service.state);
        }
      });
    });

    const insp = body.querySelector('[data-blk-inspector]');
    if (!insp) return;
    const blkId = insp.dataset.blkInspector;
    insp.querySelector('#btnSysCloseInspector')?.addEventListener('click', () => {
      this.selectedSysBlockId = null;
      this.renderSystemModal(Service.state);
    });
    insp.querySelector('[data-blk-del]')?.addEventListener('click', () => {
      this.selectedSysBlockId = null;
      Service.removeSystemBlock(blkId);
    });
    [
      ['[data-blk-move]', (el) => { Service.moveSystemBlockOrder(blkId, Number(el.dataset.blkMove.split(':')[1])); }],
      ['[data-blk-size]', (el) => Service.updateSystemBlock(blkId, { size: el.dataset.blkSize })],
      ['[data-blk-text-rows]', (el) => Service.updateSystemBlock(blkId, { textRows: Number(el.dataset.blkTextRows) || 1 })],
      ['[data-blk-pip-shape]', (el) => Service.updateSystemBlock(blkId, { pipShape: el.dataset.blkPipShape })],
      ['[data-blk-pip-states]', (el) => Service.updateSystemBlock(blkId, { pipStates: Number(el.dataset.blkPipStates) || 1 })],
      ['[data-blk-valuemode]', (el) => Service.updateSystemBlock(blkId, { valueMode: el.dataset.blkValuemode })]
    ].forEach(([sel, handler]) => {
      insp.querySelectorAll(sel).forEach((btn) => btn.addEventListener('click', () => handler(btn)));
    });

    const readCalcFormula = () => String(insp.querySelector('[data-blk-edit="calcFormula"]')?.value ?? '');
    insp.querySelectorAll('[data-blk-calc-tok]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemBlock(blkId, { calcFormula: `${readCalcFormula()}${btn.dataset.blkCalcTok}` });
      });
    });
    insp.querySelector('#btnBlkCalcBack')?.addEventListener('click', () => {
      Service.updateSystemBlock(blkId, { calcFormula: readCalcFormula().slice(0, -1) });
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
};
