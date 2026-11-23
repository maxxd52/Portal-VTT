/* ==========================================================================
   SHEET BLOCKS VIEW: RENDERIZADO POLIMÓRFICO DE 3 BLOQUES (NÚMERO, RECURSO, TEXTO)
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';

export const SheetBlocksViewMethods = {
  renderSheetBlocksInto(containerEl, rawBlocks, tok, sysCfg, { sumTotal = false } = {}) {
    if (!containerEl || !tok) return;
    const esc = (s) => this.escapeHtml(s);
    const blocks = (Array.isArray(rawBlocks) ? rawBlocks : [])
      .map((b) => Selector.normalizeSheetBlock(b))
      .filter(Boolean);
    const texts = tok.texts || {};

    if (!blocks.length) {
      containerEl.innerHTML = '<div class="text-[10px] opacity-55 text-center py-2">Sin bloques en esta zona (configuralos en Opciones → Sistema).</div>';
      return;
    }

    const evalState = Service?.state?.systemConfig?.sheetBlocks
      ? Service.state
      : { systemConfig: { ...(sysCfg || {}), sheetBlocks: blocks } };

    const ensureTokRes = (blk) => {
      if (!Array.isArray(tok.resources)) tok.resources = [];
      let found = tok.resources.find((r) => r.id === blk.id || Selector.normalizeStatKey(r.name) === blk.key);
      if (!found) {
        const effMax = Selector.resolveResourceMax(evalState, tok, blk);
        found = {
          id: blk.id,
          name: blk.label,
          cur: effMax > 0 ? effMax : 0,
          max: effMax,
          color: blk.color || '#8b5cf6',
          kind: blk.resStyle === 'pips' || blk.resStyle === 'bar' ? blk.resStyle : effMax > 0 && effMax <= 6 ? 'pips' : 'bar'
        };
        tok.resources.push(found);
      }
      return found;
    };

    const renderTextHeaderBtn = (blk, cls, extraTitle = '') => {
      const ca = blk.clickAction || 'none';
      if (ca === 'roll') {
        return `<button type="button" data-blk-roll-btn="${esc(blk.id)}" class="${cls} hover:opacity-80" title="Tirar ${esc(blk.label)} (${esc(blk.formula || '1d20')})">🎲 ${esc(blk.label)}</button>`;
      }
      if (ca === 'announce') {
        return `<button type="button" data-blk-announce="${esc(blk.id)}" class="${cls} hover:opacity-80" title="${esc(extraTitle || 'Anunciar en mesa')}">${esc(blk.label)}</button>`;
      }
      return `<span class="${cls}">${esc(blk.label)}</span>`;
    };

    const cardsHtml = blocks
      .map((blk) => {
        const subSpan = Selector.resolveBlockGridSpan(blk);
        const spanStyle = `grid-column: span ${subSpan} / span ${subSpan};`;

        if (blk.kind === 'number') {
          const isCalc = blk.valueMode === 'calc';
          const isDie = blk.valueMode === 'die';
          const isHidden = Boolean(blk.hideValue);
          const val = Selector.resolveTokenBlockValue(evalState, tok, blk);
          const canRoll = blk.rollMode !== 'none';
          const rollHint = blk.rollMode === 'custom'
            ? blk.formula
            : isDie
              ? `1d${val}`
              : (sysCfg.rollFormula || '1d20+@stat');
          const isWide = subSpan >= 3;
          const showFormulaHint = canRoll && subSpan >= 4;
          const isChecked = Boolean(blk.hasCheck && tok.blockChecks?.[blk.key]);
          const checkBonus = Number(blk.checkBonus) || 0;
          const checkDotHtml = blk.hasCheck
            ? `<button type="button" data-blk-toggle-check="${esc(blk.key)}" class="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-violet-500/30 text-violet-300' : 'opacity-45 hover:opacity-90'}" title="Marca / Competencia (${checkBonus >= 0 ? `+${checkBonus}` : checkBonus})"><svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="5"/>${isChecked ? '<circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none"/>' : ''}</svg></button>`
            : '';
          const checkBadgeHtml = isChecked && checkBonus !== 0
            ? `<span class="text-[9.5px] font-mono-tech text-violet-300 font-semibold shrink-0">${checkBonus >= 0 ? `+${checkBonus}` : checkBonus}</span>`
            : '';

          if (isHidden) {
            const innerLbl = canRoll
              ? `<button type="button" data-blk-roll-num="${esc(blk.id)}" class="flex-1 min-w-0 flex items-center ${isWide ? 'justify-between' : 'justify-center'} gap-1.5 hover:opacity-80 text-[11px] font-semibold" title="Tirar ${esc(blk.label)} (${esc(rollHint)})"><span class="inline-flex items-center gap-1 min-w-0 truncate"><span class="text-[10px] opacity-70 shrink-0">🎲</span><span class="truncate">${esc(blk.label)}</span></span>${showFormulaHint ? `<span class="text-[9.5px] font-mono-tech opacity-50 shrink-0">${esc(rollHint)}</span>` : ''}</button>`
              : `<span class="flex-1 min-w-0 text-[11px] font-semibold opacity-80 truncate ${isWide ? 'text-left' : 'text-center'}">${esc(blk.label)}</span>`;
            return `
              <div style="${spanStyle}" class="portal-subpanel rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1.5 min-w-0">
                ${checkDotHtml}
                ${innerLbl}
                ${checkBadgeHtml}
              </div>
            `;
          }

          const fxBadge = isCalc ? '<span class="text-[8.5px] font-mono-tech opacity-55 shrink-0" title="Autocalculado">fx</span>' : '';
          const lblInner = isWide
            ? `<span class="flex items-center justify-between gap-2 min-w-0 w-full">
                <span class="inline-flex items-center gap-1 min-w-0">${canRoll ? '<span class="text-[10px] opacity-60 shrink-0">🎲</span>' : ''}<span class="text-[11px] font-semibold opacity-80 truncate">${esc(blk.label)}</span>${fxBadge}</span>
                ${showFormulaHint ? `<span class="text-[9.5px] font-mono-tech opacity-50 shrink-0">${esc(rollHint)}</span>` : ''}
              </span>`
            : `<span class="text-[9.5px] font-semibold opacity-75 tracking-wide truncate block">${esc(blk.label)}${isCalc ? ' <span class="opacity-55 font-mono-tech text-[8px]">fx</span>' : ''}</span>`;
          const lblHtml = canRoll
            ? `<button type="button" data-blk-roll-num="${esc(blk.id)}" class="${isWide ? 'flex-1 min-w-0 text-left' : 'w-full text-center'} hover:opacity-80" title="Tirar ${esc(blk.label)} (${esc(rollHint)})">${lblInner}</button>`
            : `<span class="${isWide ? 'flex-1 min-w-0 text-left' : 'w-full text-center'}">${lblInner}</span>`;

          let numDisplay = '';
          if (isDie) {
            numDisplay = `
              <select data-blk-die="${esc(blk.key)}" class="portal-input ${isWide ? 'w-16 shrink-0' : 'w-full max-w-[64px]'} py-0.5 text-center text-xs font-mono-tech font-bold cursor-pointer">
                ${[4, 6, 8, 10, 12, 20].map((d) => `<option value="${d}" ${val === d ? 'selected' : ''}>d${d}</option>`).join('')}
              </select>`;
          } else if (isCalc) {
            const calcTxt = `${blk.showSign && val >= 0 ? '+' : ''}${val}${blk.suffix || ''}`;
            numDisplay = `<span data-blk-calc="${esc(blk.key)}" class="${isWide ? 'min-w-[3.25rem] shrink-0 px-2' : 'w-full max-w-[64px]'} text-center text-sm font-bold tabular-nums bg-black/15 rounded-md py-0.5 select-none opacity-90" title="Calculado: ${esc(blk.calcFormula || '0')}">${esc(calcTxt)}</span>`;
          } else {
            const signPrefix = blk.showSign && val >= 0 ? '<span class="text-xs font-bold opacity-70">+</span>' : '';
            const suffixTxt = blk.suffix ? `<span class="text-[10px] opacity-65 shrink-0">${esc(blk.suffix)}</span>` : '';
            numDisplay = `
              <div class="inline-flex items-center justify-center gap-0.5 ${isWide ? 'shrink-0' : 'w-full'}">
                ${signPrefix}
                <input type="number" data-blk-num="${esc(blk.key)}" value="${val}" min="-99" max="999" class="portal-num-input ${isWide ? 'w-14' : 'w-full max-w-[56px]'} text-center text-sm font-bold tabular-nums bg-black/15 rounded-md py-0.5 outline-none" />
                ${suffixTxt}
              </div>`;
          }

          if (isWide) {
            return `
              <div style="${spanStyle}" class="portal-subpanel rounded-xl px-2.5 py-1 flex items-center justify-between gap-2 min-w-0">
                ${checkDotHtml}
                ${lblHtml}
                ${checkBadgeHtml}
                ${numDisplay}
              </div>
            `;
          }
          return `
            <div style="${spanStyle}" class="portal-subpanel rounded-xl p-1.5 flex flex-col items-center justify-center gap-1 min-w-0">
              <div class="flex items-center justify-center gap-1 w-full min-w-0">
                ${checkDotHtml}
                ${lblHtml}
              </div>
              <div class="flex items-center justify-center gap-1 w-full">
                ${numDisplay}
                ${checkBadgeHtml}
              </div>
            </div>
          `;
        }

        if (blk.kind === 'resource') {
          const isHp = blk.key === 'hp';
          const resObj = isHp ? null : ensureTokRes(blk);
          const cur = isHp ? Math.max(0, Number(tok.hp) || 0) : Math.max(0, Number(resObj.cur) || 0);
          const max = Selector.resolveResourceMax(evalState, tok, blk, resObj);
          const color = blk.color || (isHp ? '#10b981' : '#8b5cf6');
          const style = blk.resStyle || 'auto';
          const maxPips = subSpan >= 4 ? 16 : 8;
          const pipShape = ['circle', 'square', 'diamond'].includes(blk.pipShape) ? blk.pipShape : 'circle';
          const pipStates = [1, 2, 3].includes(Number(blk.pipStates)) ? Number(blk.pipStates) : 1;
          const usePips = max > 0 && style !== 'counter' && max <= maxPips && (style === 'pips' || (style === 'auto' && !isHp && max <= 6));
          const isCounter = max === 0 || style === 'counter';
          const pipsSource = isHp ? tok.hpPips : resObj?.pips;
          const displayCur = usePips && pipStates > 1 && Array.isArray(pipsSource)
            ? pipsSource.slice(0, max).filter((v) => v > 0).length
            : cur;
          const singleLineRes = !usePips && subSpan >= 6;
          const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((cur / max) * 100))) : 0;

          let bodyHtml = '';
          if (isCounter) {
            bodyHtml = `
              <div class="flex items-center justify-center gap-1.5">
                <button type="button" data-blk-res-delta="${esc(blk.id)}:-1" class="portal-btn portal-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">-</button>
                <input type="number" data-blk-res-cur="${esc(blk.id)}" value="${cur}" min="0" max="${max > 0 ? max : 999}" class="portal-num-input w-10 text-center text-xs font-bold tabular-nums bg-black/15 rounded-md py-0.5 outline-none" />
                <button type="button" data-blk-res-delta="${esc(blk.id)}:1" class="portal-btn portal-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">+</button>
              </div>
            `;
          } else if (usePips) {
            const shapeCls = pipShape === 'square'
              ? 'w-3.5 h-3.5 rounded-[3px]'
              : pipShape === 'diamond'
                ? 'w-3 h-3 rounded-[2px] rotate-45 mx-0.5'
                : 'w-3.5 h-3.5 rounded-full';
            const innerUnrotate = pipShape === 'diamond' ? '-rotate-45' : '';
            const dots = Array.from({ length: max }, (_, idx) => {
              const cellVal = pipStates > 1
                ? (Array.isArray(pipsSource) ? (Number(pipsSource[idx]) || 0) : (idx < cur ? pipStates : 0))
                : (idx < cur ? 1 : 0);
              let fillStyle = 'background: transparent;';
              let innerHtml = '';
              let titleText = `${idx + 1}/${max}`;

              if (pipStates === 1) {
                fillStyle = `background: ${cellVal > 0 ? color : 'transparent'};`;
              } else if (pipStates === 2) {
                const stateNames = ['Vacío', 'Medio (½)', 'Lleno'];
                titleText = `#${idx + 1} · ${stateNames[Math.min(2, cellVal)]}`;
                fillStyle = cellVal >= 2
                  ? `background: ${color};`
                  : cellVal === 1
                    ? `background: linear-gradient(135deg, ${color} 50%, transparent 50%);`
                    : 'background: transparent;';
              } else {
                const stateNames = ['Vacío', 'Marca /', 'Marca ✕', 'Lleno'];
                titleText = `#${idx + 1} · ${stateNames[Math.min(3, cellVal)]}`;
                if (cellVal >= 3) {
                  fillStyle = `background: ${color};`;
                } else if (cellVal === 2) {
                  fillStyle = 'background: transparent;';
                  innerHtml = `<svg viewBox="0 0 12 12" class="w-full h-full ${innerUnrotate}"><path d="M2.5 9.5 L9.5 2.5 M2.5 2.5 L9.5 9.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
                } else if (cellVal === 1) {
                  fillStyle = 'background: transparent;';
                  innerHtml = `<svg viewBox="0 0 12 12" class="w-full h-full ${innerUnrotate}"><path d="M2.5 9.5 L9.5 2.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
                }
              }

              return `<button type="button" data-blk-res-pip="${esc(blk.id)}:${idx}:${pipStates}" class="${shapeCls} border inline-flex items-center justify-center transition-transform hover:scale-110 overflow-hidden" style="border-color:${color}; ${fillStyle}" title="${titleText}">${innerHtml}</button>`;
            }).join('');
            bodyHtml = `<div class="flex flex-wrap items-center ${pipShape === 'diamond' ? 'gap-1.5' : 'gap-1'} pt-0.5">${dots}</div>`;
          } else {
            bodyHtml = `
              <div class="flex items-center justify-between gap-1">
                <button type="button" data-blk-res-delta="${esc(blk.id)}:-1" class="portal-btn portal-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">-</button>
                <div class="flex-1 h-1.5 rounded-full bg-black/25 overflow-hidden">
                  <div class="h-full rounded-full transition-all" style="width:${pct}%; background:${color};"></div>
                </div>
                <button type="button" data-blk-res-delta="${esc(blk.id)}:1" class="portal-btn portal-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">+</button>
              </div>
            `;
          }

          const rightReadout = max === 0
            ? '<span class="text-[9px] opacity-55 shrink-0">libre</span>'
            : blk.editableMax && blk.maxMode === 'fixed'
              ? `<div class="flex items-center gap-0.5 text-[10px] font-semibold tabular-nums shrink-0">
                  <span>${displayCur}</span><span class="opacity-50">/</span>
                  <input type="number" data-blk-res-max="${esc(blk.id)}" value="${max}" min="1" max="999" class="portal-num-input w-7 text-right bg-transparent outline-none" title="Máximo" />
                </div>`
              : `<span class="text-[10px] font-semibold tabular-nums opacity-85 shrink-0">${displayCur}/${max}</span>`;

          const canRollRes = blk.rollMode === 'custom' && blk.formula;
          const resNameHtml = canRollRes
            ? `<button type="button" data-blk-roll-res="${esc(blk.id)}" class="text-[10px] font-medium truncate hover:opacity-80 text-left" title="Tirar ${esc(blk.label)} (${esc(blk.formula)})">🎲 ${esc(blk.label)}</button>`
            : `<span class="text-[10px] font-medium truncate" title="${esc(blk.label)} · @${esc(blk.key)}">${esc(blk.label)}</span>`;

          if (singleLineRes) {
            return `
              <div style="${spanStyle}" class="portal-subpanel rounded-xl px-2.5 py-1.5 flex items-center gap-2 min-w-0">
                <span class="inline-flex items-center gap-1.5 min-w-0 max-w-[34%] shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${color};"></span>
                  ${resNameHtml}
                </span>
                <div class="flex-1 min-w-0">${bodyHtml}</div>
                ${rightReadout}
              </div>
            `;
          }

          return `
            <div style="${spanStyle}" class="portal-subpanel rounded-xl px-2 py-1.5 flex flex-col justify-between gap-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <span class="inline-flex items-center gap-1 min-w-0">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${color};"></span>
                  ${resNameHtml}
                </span>
                ${rightReadout}
              </div>
              ${bodyHtml}
            </div>
          `;
        }

        const tm = blk.textMode || 'input';
        const ca = blk.clickAction || 'none';

        if (tm === 'fixed') {
          const fixedSub = String(blk.fixedText || '').trim();
          if (ca === 'roll') {
            const showFormulaText = subSpan >= 3 && blk.formula;
            return `
              <button type="button" data-blk-roll-btn="${esc(blk.id)}" style="${spanStyle}" class="portal-btn portal-subpanel px-2.5 py-1.5 rounded-xl flex items-center ${showFormulaText ? 'justify-between' : 'justify-center'} gap-1.5 text-[10.5px] min-w-0 text-left" title="Tirar ${esc(blk.label)} (${esc(blk.formula || '1d20')})">
                <span class="min-w-0 flex flex-col">
                  <span class="font-semibold truncate">🎲 ${esc(blk.label)}</span>
                  ${fixedSub ? `<span class="text-[9.5px] opacity-65 truncate font-normal">${esc(fixedSub)}</span>` : ''}
                </span>
                ${showFormulaText ? `<span class="text-[9.5px] font-mono-tech opacity-65 shrink-0">${esc(blk.formula)}</span>` : ''}
              </button>
            `;
          }
          if (ca === 'announce') {
            return `
              <button type="button" data-blk-announce="${esc(blk.id)}" style="${spanStyle}" class="portal-btn portal-subpanel px-2.5 py-1.5 rounded-xl flex flex-col items-start justify-center gap-0.5 text-left min-w-0" title="Anunciar en mesa">
                <span class="text-[11px] font-semibold truncate w-full">${esc(blk.label)}</span>
                ${fixedSub ? `<span class="text-[10px] opacity-70 leading-snug w-full truncate font-normal">${esc(fixedSub)}</span>` : ''}
              </button>
            `;
          }
          if (fixedSub) {
            return `
              <div style="${spanStyle}" class="portal-subpanel rounded-xl px-2.5 py-1.5 flex flex-col justify-center gap-0.5 text-left min-w-0">
                <span class="text-[9.5px] font-semibold opacity-65 tracking-wide truncate">${esc(blk.label)}</span>
                <span class="text-[11px] font-medium leading-snug break-words">${esc(fixedSub)}</span>
              </div>
            `;
          }
          return `
            <div style="${spanStyle}" class="px-1 pt-1.5 pb-0.5 flex items-center gap-2 min-w-0">
              <span class="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate">${esc(blk.label)}</span>
              <span class="flex-1 h-px" style="background: var(--hairline);"></span>
            </div>
          `;
        }

        if (tm === 'select') {
          const curVal = String(texts[blk.key] || '');
          const opts = Array.isArray(blk.options) ? blk.options : [];
          const hasCur = !curVal || opts.includes(curVal);
          const isInline = subSpan >= 4;
          return `
            <div style="${spanStyle}" class="portal-subpanel rounded-xl ${isInline ? 'px-2.5 py-1 flex items-center gap-2' : 'px-2 py-1.5 flex flex-col justify-center gap-0.5'} text-left min-w-0">
              ${renderTextHeaderBtn(blk, `${isInline ? 'text-[10.5px] opacity-75 shrink-0 max-w-[38%]' : 'text-[9.5px] opacity-65'} font-semibold tracking-wide truncate text-left`)}
              <select data-blk-text="${esc(blk.key)}" class="portal-input px-1.5 py-0.5 text-[11px] font-medium flex-1 min-w-0 cursor-pointer">
                <option value="">—</option>
                ${!hasCur ? `<option value="${esc(curVal)}" selected>${esc(curVal)}</option>` : ''}
                ${opts.map((o) => `<option value="${esc(o)}" ${curVal === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
              </select>
            </div>
          `;
        }

        if (tm === 'tags') {
          const tags = String(texts[blk.key] || '').split('\n').map((s) => s.trim()).filter(Boolean);
          const tagsHtml = tags.length
            ? `<div class="flex flex-wrap gap-1">${tags
                .map((tag, tIdx) => {
                  const tagText = ca === 'announce'
                    ? `<button type="button" data-blk-tag-announce="${esc(blk.id)}:${tIdx}" class="hover:opacity-80 text-left truncate max-w-[140px]" title="Anunciar en mesa">${esc(tag)}</button>`
                    : `<span class="truncate max-w-[140px]">${esc(tag)}</span>`;
                  return `<span class="portal-roll-pill inline-flex items-center gap-1 text-[10px]">${tagText}<button type="button" data-blk-tag-rm="${esc(blk.key)}:${tIdx}" class="opacity-60 hover:opacity-100 leading-none" title="Quitar">×</button></span>`;
                })
                .join('')}</div>`
            : '';
          return `
            <div style="${spanStyle}" class="portal-subpanel rounded-xl px-2.5 py-2 flex flex-col gap-1.5 text-left min-w-0">
              ${renderTextHeaderBtn(blk, 'text-[10px] font-semibold opacity-70 tracking-wide truncate text-left')}
              ${tagsHtml}
              <input type="text" data-blk-tag-add="${esc(blk.key)}" placeholder="${esc(blk.placeholder || 'Añadir y Enter...')}" class="portal-input px-2 py-1 text-[10.5px]" />
            </div>
          `;
        }

        const textRows = subSpan >= 6 ? Math.max(1, Math.min(5, Number(blk.textRows) || 1)) : 1;
        if (textRows > 1) {
          return `
            <div style="${spanStyle}" class="portal-subpanel rounded-xl px-2.5 py-2 flex flex-col gap-1 text-left min-w-0">
              ${renderTextHeaderBtn(blk, 'text-[10px] font-semibold opacity-70 tracking-wide truncate text-left')}
              <textarea data-blk-text="${esc(blk.key)}" rows="${textRows}" placeholder="${esc(blk.placeholder || '...')}" class="w-full text-[11px] font-medium leading-relaxed bg-black/15 rounded-lg px-2 py-1.5 border border-white/10 focus:border-violet-400 outline-none resize-y">${esc(texts[blk.key] || '')}</textarea>
            </div>
          `;
        }

        const isInlineText = subSpan >= 4;
        return `
          <div style="${spanStyle}" class="portal-subpanel rounded-xl ${isInlineText ? 'px-2.5 py-1 flex items-center gap-2' : 'px-2 py-1.5 flex flex-col justify-center gap-0.5'} text-left min-w-0">
            ${renderTextHeaderBtn(blk, `${isInlineText ? 'text-[10.5px] opacity-75 shrink-0 max-w-[38%]' : 'text-[9.5px] opacity-65'} font-semibold tracking-wide truncate text-left`)}
            <input type="text" data-blk-text="${esc(blk.key)}" value="${esc(texts[blk.key] || '')}" placeholder="${esc(blk.placeholder || '...')}" class="${isInlineText ? 'flex-1 min-w-0 border-white/10 py-0.5' : 'w-full border-transparent'} text-[11px] font-medium bg-transparent border-b focus:border-violet-400 outline-none" />
          </div>
        `;
      })
      .join('');

    const numBlocks = blocks.filter((b) => b.kind === 'number' && !b.hideValue && b.valueMode !== 'die');
    const sumVal = numBlocks.reduce(
      (acc, b) => acc + Selector.resolveTokenBlockValue(evalState, tok, b),
      0
    );

    containerEl.innerHTML = `
      <div class="grid gap-1.5 items-stretch" style="grid-template-columns: repeat(6, minmax(0, 1fr));">
        ${cardsHtml}
      </div>
      ${
        sumTotal && numBlocks.length > 0
          ? `<div class="portal-subpanel rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] mt-1">
              <span class="opacity-70 font-medium">Σ Suma total</span>
              <strong class="font-bold tabular-nums text-xs">${sumVal}</strong>
            </div>`
          : ''
      }
    `;

    containerEl.querySelectorAll('[data-blk-num]').forEach((inp) => {
      inp.addEventListener('change', () => Service.updateTokenStat(tok.id, inp.dataset.blkNum, inp.value));
    });
    containerEl.querySelectorAll('[data-blk-die]').forEach((sel) => {
      sel.addEventListener('change', () => Service.setTokenBlockDie(tok.id, sel.dataset.blkDie, sel.value));
    });
    containerEl.querySelectorAll('[data-blk-toggle-check]').forEach((btn) => {
      btn.addEventListener('click', () => Service.toggleTokenBlockCheck(tok.id, btn.dataset.blkToggleCheck));
    });
    containerEl.querySelectorAll('[data-blk-roll-num]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const blk = blocks.find((b) => b.id === btn.dataset.blkRollNum);
        if (!blk || blk.rollMode === 'none') return;
        const val = Selector.resolveTokenBlockValue(evalState, tok, blk);
        const checkExtra = blk.hasCheck && tok.blockChecks?.[blk.key] ? (Number(blk.checkBonus) || 0) : 0;
        const isDie = blk.valueMode === 'die';
        const roll = Service.rollSheetCheck(
          tok,
          `${tok.name} · ${blk.label}`,
          (isDie ? 0 : val) + checkExtra,
          blk.rollMode === 'custom' ? blk.formula : '',
          {
            dieSides: isDie && blk.rollMode !== 'custom' ? val : 0,
            resultMode: blk.resultMode,
            successThreshold: blk.successThreshold
          }
        );
        if ((blk.isInitiative || blk.key === 'init') && roll && Service.state.combat?.active && sysCfg.autoInitiative !== false) {
          Service.setTokenInitiative(tok.id, roll.total, roll.isDeckRoll ? roll.headline : '');
        }
      });
    });
    containerEl.querySelectorAll('[data-blk-roll-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const blk = blocks.find((b) => b.id === btn.dataset.blkRollBtn);
        if (!blk) return;
        const isInit = Boolean(blk.isInitiative || blk.key === 'init');
        const usedFormula = isInit && !blk.formula ? Service.getSystemInitiativeFormula() : (blk.formula || '1d20');
        const roll = Service.rollSheetCheck(tok, `${tok.name} · ${blk.label}`, 0, usedFormula, {
          resultMode: blk.resultMode,
          successThreshold: blk.successThreshold
        });
        if (isInit && roll && Service.state.combat?.active && sysCfg.autoInitiative !== false) {
          Service.setTokenInitiative(tok.id, roll.total, roll.isDeckRoll ? roll.headline : '');
        }
      });
    });
    containerEl.querySelectorAll('[data-blk-announce]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const blk = blocks.find((b) => b.id === btn.dataset.blkAnnounce);
        if (!blk) return;
        const bodyText = blk.textMode === 'fixed'
          ? (blk.fixedText || blk.label)
          : (tok.texts?.[blk.key] || blk.fixedText || blk.label);
        Service.announceSheetBlock(tok, blk.label, bodyText);
      });
    });
    containerEl.querySelectorAll('[data-blk-tag-announce]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [id, idxStr] = btn.dataset.blkTagAnnounce.split(':');
        const blk = blocks.find((b) => b.id === id);
        if (!blk) return;
        const curList = String(tok.texts?.[blk.key] || '').split('\n').map((s) => s.trim()).filter(Boolean);
        const tag = curList[Number(idxStr)];
        if (tag) Service.announceSheetBlock(tok, blk.label, tag);
      });
    });
    containerEl.querySelectorAll('[data-blk-tag-add]').forEach((inp) => {
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const val = inp.value.trim();
        if (!val) return;
        const key = inp.dataset.blkTagAdd;
        const curList = String(tok.texts?.[key] || '').split('\n').map((s) => s.trim()).filter(Boolean);
        if (!curList.includes(val)) curList.push(val);
        inp.value = '';
        Service.updateTokenText(tok.id, key, curList.join('\n'));
      });
    });
    containerEl.querySelectorAll('[data-blk-tag-rm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [key, idxStr] = btn.dataset.blkTagRm.split(':');
        const curList = String(tok.texts?.[key] || '').split('\n').map((s) => s.trim()).filter(Boolean);
        curList.splice(Number(idxStr), 1);
        Service.updateTokenText(tok.id, key, curList.join('\n'));
      });
    });
    containerEl.querySelectorAll('[data-blk-text]').forEach((inp) => {
      inp.addEventListener('change', () => Service.updateTokenText(tok.id, inp.dataset.blkText, inp.value));
    });
    containerEl.querySelectorAll('[data-blk-roll-res]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const blk = blocks.find((b) => b.id === btn.dataset.blkRollRes);
        if (!blk || !blk.formula) return;
        const isHp = blk.key === 'hp';
        const resObj = isHp ? null : ensureTokRes(blk);
        const cur = isHp ? Math.max(0, Number(tok.hp) || 0) : Math.max(0, Number(resObj?.cur) || 0);
        Service.rollSheetCheck(tok, `${tok.name} · ${blk.label}`, cur, blk.formula, {
          resultMode: blk.resultMode,
          successThreshold: blk.successThreshold
        });
        if (blk.consumeOnRoll && cur > 0) {
          if (isHp) Service.adjustTokenHp(tok.id, -1);
          else Service.adjustTokenResource(tok.id, blk.id, -1);
        }
      });
    });
    containerEl.querySelectorAll('[data-blk-res-max]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const id = inp.dataset.blkResMax;
        const blk = blocks.find((b) => b.id === id);
        const nextMax = Math.max(1, Math.min(999, Math.trunc(Number(inp.value) || 1)));
        if (blk?.key === 'hp') {
          tok.maxHp = nextMax;
          tok.hp = Math.min(tok.hp, nextMax);
          Service.notify();
        } else {
          Service.setTokenResourceMax(tok.id, id, nextMax);
        }
      });
    });
    containerEl.querySelectorAll('[data-blk-res-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [id, d] = btn.dataset.blkResDelta.split(':');
        const blk = blocks.find((b) => b.id === id);
        if (blk?.key === 'hp') Service.adjustTokenHp(tok.id, Number(d));
        else Service.adjustTokenResource(tok.id, id, Number(d));
      });
    });
    containerEl.querySelectorAll('[data-blk-res-cur]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const id = inp.dataset.blkResCur;
        const blk = blocks.find((b) => b.id === id);
        if (blk?.key === 'hp') {
          const effMax = Selector.resolveResourceMax(evalState, tok, blk);
          const upper = effMax === 0 ? 999 : Math.max(1, effMax);
          tok.hp = Math.max(0, Math.min(upper, Math.trunc(Number(inp.value) || 0)));
          Service.notify();
        } else {
          Service.setTokenResourceValue(tok.id, id, inp.value);
        }
      });
    });
    containerEl.querySelectorAll('[data-blk-res-pip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [id, idxStr, statesStr] = btn.dataset.blkResPip.split(':');
        const blk = blocks.find((b) => b.id === id);
        const effMax = blk ? Selector.resolveResourceMax(evalState, tok, blk) : 0;
        Service.cycleTokenResourcePip(tok.id, id, Number(idxStr) || 0, Number(statesStr) || 1, effMax);
      });
    });
  }
};
