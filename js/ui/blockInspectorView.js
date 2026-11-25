/* ==========================================================================
   BLOCK INSPECTOR VIEW: EDITOR POLIMÓRFICO Y DE FÓRMULAS DE BLOQUES
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261125a1';
import { Service } from '../core/service.js?v=20261125a1';

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
  text: { icon: SVG_ICONS.text, name: 'Texto' }
};

export const BlockInspectorViewMethods = {
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
      : (extraStatChipHtml ? '' : '<span class="text-[10px] opacity-55 italic px-1">Agrega bloques Número en Ficha y Bloques para usarlos como @clave.</span>');

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

  renderCalcFormulaEditor(state, { fieldName, formulaVal, selfKey, titleText, placeholderText }) {
    const esc = (s) => this.escapeHtml(s);
    const otherStats = Selector.getSheetStatsDef(state).filter((st) => (st.alias || st.key) !== selfKey);
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
      : '<span class="text-[10px] opacity-55 italic">Crea bloques Número para referenciarlos aquí.</span>';
    return `
      <div data-blk-calc-box="${esc(fieldName)}" class="flex flex-col gap-1.5 p-2.5 rounded-xl portal-subpanel">
        <span class="text-[10.5px] opacity-75 font-medium">${titleText}</span>
        <div class="flex items-center gap-1">
          <input type="text" data-blk-edit="${esc(fieldName)}" value="${esc(formulaVal)}" placeholder="${esc(placeholderText)}" class="portal-input px-2.5 py-1.5 text-[11px] font-mono-tech flex-1 min-w-0" />
          <button type="button" id="btnBlkCalcBack" class="portal-btn portal-panel px-2 py-1.5 rounded-lg text-[10px]" title="Borrar último carácter">⌫</button>
          <button type="button" id="btnBlkCalcClear" class="portal-btn portal-panel px-2 py-1.5 rounded-lg text-[10px] opacity-80" title="Vaciar fórmula">Limpiar</button>
        </div>
        <div class="portal-formula-bar">
          ${calcOpChips}
          <div class="w-full pt-1 mt-0.5 border-t flex flex-wrap gap-1" style="border-color: var(--hairline);">${calcStatChips}</div>
        </div>
      </div>
    `;
  },

  renderRollResultOptions(blk, { showInit = true } = {}) {
    const rMode = blk.resultMode || 'inherit';
    const rThr = Number(blk.successThreshold) || 6;
    const modeOpts = [
      ['inherit', 'Lectura: según sistema'],
      ['sum', 'Total (Suma)'],
      ['max', 'Máx (Ventaja)'],
      ['min', 'Mín (Desventaja)'],
      ['each', 'c/u (Individual)'],
      ['success', 'Éxitos (≥ N)']
    ];
    return `
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <select data-blk-edit="resultMode" class="portal-input px-2 py-1 text-[10.5px] flex-1 min-w-0 cursor-pointer">
            ${modeOpts.map(([k, lbl]) => `<option value="${k}" ${rMode === k ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>
          ${rMode === 'success' ? `<span class="text-[10px] opacity-65">≥</span><input type="number" data-blk-edit="successThreshold" value="${rThr}" min="1" max="100" class="portal-num-input w-12 py-1 text-center text-[10.5px]" title="Umbral de éxito" />` : ''}
        </div>
        ${
          showInit
            ? `<label class="inline-flex items-center gap-1.5 text-[10.5px] opacity-80 cursor-pointer select-none shrink-0" title="Al tirar este bloque durante un combate, actualiza la Iniciativa del personaje">
                <input type="checkbox" data-blk-flag="isInitiative" ${blk.isInitiative ? 'checked' : ''} class="accent-violet-500 cursor-pointer" />
                <span>Usar para Iniciativa</span>
              </label>`
            : ''
        }
      </div>
    `;
  },

  renderBlockInspector(state, rawBlk, fixedTargets) {
    const blk = Selector.normalizeSheetBlock(rawBlk);
    if (!blk) return '';
    const esc = (s) => this.escapeHtml(s);
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
      const vm = blk.valueMode || 'manual';
      specificHtml = `
        <div class="flex flex-col gap-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
            ${renderSegGroup('Valor en la ficha', 'grid-cols-3', [['manual', 'Editable'], ['calc', 'Calc (fx)'], ['die', 'Dado']], vm, 'data-blk-valuemode')}
            <label class="flex flex-col gap-1">
              <span class="text-[10.5px] opacity-70">Al hacer clic</span>
              <select data-blk-edit-rollmode="${esc(blk.id)}" class="portal-input px-2.5 py-1.5 text-[11px]">
                <option value="base" ${rm === 'base' ? 'selected' : ''}>${vm === 'die' ? 'Tira su dado' : 'Tira dado base'}</option>
                <option value="none" ${rm === 'none' ? 'selected' : ''}>Solo dato (no tira)</option>
                <option value="custom" ${rm === 'custom' ? 'selected' : ''}>Fórmula propia</option>
              </select>
            </label>
          </div>
          <div class="portal-subpanel rounded-xl px-2.5 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px]">
            <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" data-blk-flag="hideValue" ${blk.hideValue ? 'checked' : ''} class="accent-violet-500 cursor-pointer" />
              <span>Ocultar valor</span>
            </label>
            ${
              !blk.hideValue && vm !== 'die'
                ? `<label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" data-blk-flag="showSign" ${blk.showSign ? 'checked' : ''} class="accent-violet-500 cursor-pointer" />
                    <span>Signo (+)</span>
                  </label>`
                : ''
            }
            <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" data-blk-flag="hasCheck" ${blk.hasCheck ? 'checked' : ''} class="accent-violet-500 cursor-pointer" />
              <span>Marca / Check</span>
            </label>
            ${
              blk.hasCheck
                ? `<label class="inline-flex items-center gap-1">
                    <span class="opacity-65">Bono</span>
                    <input type="number" data-blk-edit="checkBonus" value="${Number(blk.checkBonus) || 0}" min="-99" max="99" class="portal-num-input w-11 py-0.5 text-center text-[10.5px]" />
                  </label>`
                : ''
            }
            ${
              !blk.hideValue && vm !== 'die'
                ? `<label class="inline-flex items-center gap-1 ml-auto">
                    <span class="opacity-65">Sufijo</span>
                    <input type="text" data-blk-edit="suffix" maxlength="6" value="${esc(blk.suffix || '')}" placeholder="%, m, ft" class="portal-input w-14 px-1.5 py-0.5 text-[10.5px] text-center" />
                  </label>`
                : ''
            }
          </div>
          ${
            vm === 'calc'
              ? this.renderCalcFormulaEditor(state, {
                  fieldName: 'calcFormula',
                  formulaVal: blk.calcFormula ?? '',
                  selfKey: blk.key,
                  titleText: 'Fórmula de cálculo (solo lectura en ficha)',
                  placeholderText: 'Ej: 10+@des o floor((@fue-10)/2)'
                })
              : ''
          }
          ${rm === 'custom' ? this.renderFormulaEditor(state, blk, 'Fórmula propia de tirada', `Ej: 2d6+@${blk.key}`, '') : ''}
          ${rm !== 'none' ? this.renderRollResultOptions(blk, { showInit: true }) : ''}
        </div>
      `;
    } else if (blk.kind === 'resource') {
      const rs = blk.resStyle || 'auto';
      const maxMode = blk.maxMode || 'fixed';
      const maxVal = Number(blk.max) || 0;
      const sizeSpan = Selector.resolveBlockGridSpan(blk);
      const maxPipsLim = sizeSpan >= 4 ? 16 : 8;
      const effMaxPreview = maxMode === 'free' ? 0 : maxMode === 'fixed' ? maxVal : 4;
      const showsPips = maxMode !== 'free' && effMaxPreview > 0 && effMaxPreview <= maxPipsLim && (rs === 'pips' || (rs === 'auto' && blk.key !== 'hp' && effMaxPreview <= 6));
      const pipShape = blk.pipShape || 'circle';
      const pipStates = [1, 2, 3].includes(Number(blk.pipStates)) ? Number(blk.pipStates) : 1;
      specificHtml = `
        <div class="flex flex-col gap-2">
          ${renderSegGroup('Tope máximo', 'grid-cols-3', [['fixed', 'Fijo'], ['calc', 'Calculado (fx)'], ['free', 'Libre (sin tope)']], maxMode, 'data-blk-maxmode')}
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
            ${
              maxMode === 'fixed'
                ? `<div class="flex flex-col gap-1">
                    <span class="text-[10.5px] opacity-70">Máximo</span>
                    <div class="flex items-center gap-1.5">
                      <input type="number" data-blk-edit="max" min="1" max="999" value="${Math.max(1, maxVal)}" class="portal-input w-16 px-2 py-1.5 text-[11px] text-center tabular-nums" />
                      <label class="inline-flex items-center gap-1 text-[10px] opacity-75 cursor-pointer select-none" title="Cada personaje puede ajustar su propio máximo en la ficha">
                        <input type="checkbox" data-blk-flag="editableMax" ${blk.editableMax ? 'checked' : ''} class="accent-violet-500 cursor-pointer" />
                        <span>Editable</span>
                      </label>
                    </div>
                  </div>`
                : ''
            }
            <label class="flex flex-col gap-1">
              <span class="text-[10.5px] opacity-70">Visual</span>
              <select data-blk-edit="resStyle" class="portal-input px-2 py-1.5 text-[11px]">
                <option value="auto" ${rs === 'auto' ? 'selected' : ''}>Auto</option>
                <option value="pips" ${rs === 'pips' ? 'selected' : ''}>Casillas ●</option>
                <option value="bar" ${rs === 'bar' ? 'selected' : ''}>Barra</option>
                <option value="counter" ${rs === 'counter' ? 'selected' : ''}>Contador (−/+)</option>
              </select>
            </label>
            <label class="flex items-center justify-between portal-input px-2.5 py-1.5 rounded-lg cursor-pointer">
              <span class="text-[10.5px] opacity-75">Color</span>
              <input type="color" data-blk-edit="color" value="${esc(blk.color || '#8b5cf6')}" class="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0" />
            </label>
          </div>
          ${
            maxMode === 'calc'
              ? this.renderCalcFormulaEditor(state, {
                  fieldName: 'maxFormula',
                  formulaVal: blk.maxFormula ?? '',
                  selfKey: blk.key,
                  titleText: 'Fórmula de máximo (fx)',
                  placeholderText: 'Ej: 10+@con*2'
                })
              : ''
          }
          ${
            showsPips
              ? `<div class="grid grid-cols-2 gap-2 items-end">
                  ${renderSegGroup('Forma', 'grid-cols-3', [['circle', '●', 'Círculo'], ['square', '■', 'Cuadrado'], ['diamond', '◆', 'Rombo']], pipShape, 'data-blk-pip-shape')}
                  ${renderSegGroup('Niveles por casilla', 'grid-cols-3 text-[10px]', [[1, '1 · ●', 'Vacío o lleno'], [2, '2 · ◐', 'Vacío, mitad diagonal o lleno'], [3, '3 · ✕', 'Vacío, /, ✕ o lleno']], pipStates, 'data-blk-pip-states')}
                </div>`
              : ''
          }
          ${renderSegGroup('Al hacer clic en el nombre', 'grid-cols-2', [['none', 'Solo recurso'], ['custom', 'Tirar fórmula']], blk.rollMode === 'custom' ? 'custom' : 'none', 'data-blk-res-rollmode')}
          ${
            blk.rollMode === 'custom'
              ? `${this.renderFormulaEditor(state, blk, 'Fórmula de tirada', `Ej: @${blk.key}d6 o 1d8`, '')}
                 ${this.renderRollResultOptions(blk, { showInit: false })}
                 <label class="inline-flex items-center gap-1.5 text-[10.5px] opacity-80 cursor-pointer select-none">
                   <input type="checkbox" data-blk-flag="consumeOnRoll" ${blk.consumeOnRoll ? 'checked' : ''} class="accent-violet-500 cursor-pointer" />
                   <span>Gastar 1 del recurso al tirar</span>
                 </label>`
              : ''
          }
        </div>
      `;
    } else {
      const curSize = Selector.resolveBlockSize(blk);
      const textRows = Number(blk.textRows) || 1;
      const tm = blk.textMode || 'input';
      const ca = blk.clickAction || 'none';
      let modeFieldHtml = '';
      if (tm === 'input') {
        modeFieldHtml = `
          <div class="grid grid-cols-1 ${curSize === '1/1' ? 'sm:grid-cols-2' : ''} gap-2 items-end">
            <label class="flex flex-col gap-1">
              <span class="text-[10.5px] opacity-70">Texto guía (placeholder)</span>
              <input type="text" data-blk-edit="placeholder" value="${esc(blk.placeholder || '')}" class="portal-input px-2.5 py-1.5 text-[11px]" />
            </label>
            ${curSize === '1/1' ? renderSegGroup('Altura en fila completa', 'grid-cols-3', [[1, '1 línea'], [3, '3 líneas'], [5, '5 líneas']], textRows, 'data-blk-text-rows') : ''}
          </div>`;
      } else if (tm === 'fixed') {
        modeFieldHtml = `
          <label class="flex flex-col gap-1">
            <span class="text-[10.5px] opacity-70">Texto fijo / subtítulo (opcional)</span>
            <input type="text" data-blk-edit="fixedText" value="${esc(blk.fixedText || '')}" placeholder="Vacío = solo título (botón o separador)" class="portal-input px-2.5 py-1.5 text-[11px]" />
          </label>`;
      } else if (tm === 'select') {
        modeFieldHtml = `
          <label class="flex flex-col gap-1">
            <span class="text-[10.5px] opacity-70">Opciones (separadas por coma)</span>
            <input type="text" data-blk-edit="optionsText" value="${esc((blk.options || []).join(', '))}" placeholder="Ej: Defensiva, Normal, Agresiva" class="portal-input px-2.5 py-1.5 text-[11px]" />
          </label>`;
      } else {
        modeFieldHtml = `
          <label class="flex flex-col gap-1">
            <span class="text-[10.5px] opacity-70">Texto guía al añadir etiqueta</span>
            <input type="text" data-blk-edit="placeholder" value="${esc(blk.placeholder || '')}" placeholder="Ej: Añadir aspecto o rasgo..." class="portal-input px-2.5 py-1.5 text-[11px]" />
          </label>`;
      }
      specificHtml = `
        <div class="flex flex-col gap-2">
          ${renderSegGroup('Modo del bloque', 'grid-cols-4', [['input', 'Editable'], ['fixed', 'Fijo / Botón'], ['select', 'Selector'], ['tags', 'Etiquetas']], tm, 'data-blk-textmode')}
          ${modeFieldHtml}
          ${renderSegGroup('Al hacer clic', 'grid-cols-3', [['none', 'Sin acción'], ['roll', 'Tirar fórmula'], ['announce', 'Anunciar']], ca, 'data-blk-clickaction')}
          ${
            ca === 'roll'
              ? `${this.renderFormulaEditor(state, blk, 'Fórmula (toca dados o atributos para sumar)', 'Ej: 1d20+@agi', '1d20')}
                 ${this.renderRollResultOptions(blk, { showInit: true })}`
              : ''
          }
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

  bindBlockInspectorEvents(insp, blkId) {
    if (!insp) return;
    insp.querySelector('#btnSysCloseInspector')?.addEventListener('click', () => {
      this.selectedSysBlockId = null;
      this.renderSystemModal(Service.state);
    });
    insp.querySelector('[data-blk-del]')?.addEventListener('click', () => {
      this.selectedSysBlockId = null;
      Service.removeSystemBlock(blkId);
    });
    [
      ['[data-blk-move]', (el) => Service.moveSystemBlockOrder(blkId, Number(el.dataset.blkMove.split(':')[1]))],
      ['[data-blk-size]', (el) => Service.updateSystemBlock(blkId, { size: el.dataset.blkSize })],
      ['[data-blk-text-rows]', (el) => Service.updateSystemBlock(blkId, { textRows: Number(el.dataset.blkTextRows) || 1 })],
      ['[data-blk-pip-shape]', (el) => Service.updateSystemBlock(blkId, { pipShape: el.dataset.blkPipShape })],
      ['[data-blk-pip-states]', (el) => Service.updateSystemBlock(blkId, { pipStates: Number(el.dataset.blkPipStates) || 1 })],
      ['[data-blk-valuemode]', (el) => Service.updateSystemBlock(blkId, { valueMode: el.dataset.blkValuemode })],
      ['[data-blk-maxmode]', (el) => Service.updateSystemBlock(blkId, { maxMode: el.dataset.blkMaxmode })],
      ['[data-blk-res-rollmode]', (el) => Service.updateSystemBlock(blkId, { rollMode: el.dataset.blkResRollmode })],
      ['[data-blk-textmode]', (el) => Service.updateSystemBlock(blkId, { textMode: el.dataset.blkTextmode })],
      ['[data-blk-clickaction]', (el) => {
        const nextAction = el.dataset.blkClickaction;
        const curBlk = Selector.getSystemSheetBlocks(Service.state).find((b) => b.id === blkId);
        const patch = { clickAction: nextAction };
        if (nextAction === 'roll' && !curBlk?.formula) {
          patch.formula = Service.state.systemConfig?.rollFormula || '1d20';
        }
        Service.updateSystemBlock(blkId, patch);
      }]
    ].forEach(([sel, handler]) => {
      insp.querySelectorAll(sel).forEach((btn) => btn.addEventListener('click', () => handler(btn)));
    });

    const calcField = insp.querySelector('[data-blk-calc-box]')?.dataset?.blkCalcBox || 'calcFormula';
    const readCalcFormula = () => String(insp.querySelector(`[data-blk-edit="${calcField}"]`)?.value ?? '');
    insp.querySelectorAll('[data-blk-calc-tok]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemBlock(blkId, { [calcField]: `${readCalcFormula()}${btn.dataset.blkCalcTok}` });
      });
    });
    insp.querySelector('#btnBlkCalcBack')?.addEventListener('click', () => {
      Service.updateSystemBlock(blkId, { [calcField]: readCalcFormula().slice(0, -1) });
    });
    insp.querySelector('#btnBlkCalcClear')?.addEventListener('click', () => {
      Service.updateSystemBlock(blkId, { [calcField]: '' });
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

    insp.querySelectorAll('[data-blk-flag]').forEach((chk) => {
      chk.addEventListener('change', () => {
        Service.updateSystemBlock(blkId, { [chk.dataset.blkFlag]: Boolean(chk.checked) });
      });
    });
    insp.querySelectorAll('[data-blk-edit]').forEach((el) => {
      el.addEventListener('change', () => {
        const field = el.dataset.blkEdit;
        const val = field === 'max'
          ? Math.max(1, Number(el.value) || 1)
          : field === 'checkBonus'
            ? Math.trunc(Number(el.value) || 0)
            : field === 'successThreshold'
              ? Math.max(1, Math.min(100, Math.round(Number(el.value) || 6)))
              : el.value;
        Service.updateSystemBlock(blkId, { [field]: val });
      });
    });
  }
};
