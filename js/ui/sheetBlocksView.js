/* ==========================================================================
   SHEET BLOCKS VIEW: RENDERIZADO UNIFICADO DE LOS 4 BLOQUES (1 A 3 COLUMNAS)
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261116z39';
import { Service } from '../core/service.js?v=20261116z39';

export const SheetBlocksViewMethods = {
  renderSheetBlocksInto(containerEl, blocks, tok, sysCfg, { sumTotal = false } = {}) {
    if (!containerEl || !tok) return;
    const esc = (s) => this.escapeHtml(s);
    const stats = tok.stats || {};
    const texts = tok.texts || {};

    if (!blocks.length) {
      containerEl.innerHTML = '<div class="text-[10px] opacity-55 text-center py-2">Sin bloques en esta zona (configuralos en Opciones → Sistema).</div>';
      return;
    }

    const ensureTokRes = (blk) => {
      if (!Array.isArray(tok.resources)) tok.resources = [];
      let found = tok.resources.find((r) => r.id === blk.id || Selector.normalizeStatKey(r.name) === blk.key);
      if (!found) {
        const max = Math.max(0, Number(blk.max) || 0);
        found = {
          id: blk.id,
          name: blk.label,
          cur: max > 0 ? max : 0,
          max,
          color: blk.color || '#8b5cf6',
          kind: blk.resStyle === 'pips' || blk.resStyle === 'bar' ? blk.resStyle : max > 0 && max <= 6 ? 'pips' : 'bar'
        };
        tok.resources.push(found);
      }
      return found;
    };

    const cardsHtml = blocks
      .map((blk) => {
        const subSpan = Selector.resolveBlockGridSpan(blk);
        const spanStyle = `grid-column: span ${subSpan} / span ${subSpan};`;

        if (blk.kind === 'number') {
          const val = blk.key === 'ac' ? (Number.isFinite(Number(tok.ac)) ? Number(tok.ac) : 10) : (Number(stats[blk.key]) || 0);
          const canRoll = blk.rollMode !== 'none';
          const rollHint = blk.rollMode === 'custom' ? blk.formula : (sysCfg.rollFormula || '1d20+@stat');
          const isWide = subSpan >= 3;
          const showFormulaHint = canRoll && subSpan >= 4;
          const lblInner = isWide
            ? `<span class="flex items-center justify-between gap-2 min-w-0 w-full">
                <span class="inline-flex items-center gap-1 min-w-0">${canRoll ? '<span class="text-[10px] opacity-60 shrink-0">🎲</span>' : ''}<span class="text-[11px] font-semibold opacity-80 truncate">${esc(blk.label)}</span></span>
                ${showFormulaHint ? `<span class="text-[9.5px] font-mono-tech opacity-50 shrink-0">${esc(rollHint)}</span>` : ''}
              </span>`
            : `<span class="text-[9.5px] font-semibold opacity-75 tracking-wide truncate block">${esc(blk.label)}</span>`;
          const lblHtml = canRoll
            ? `<button type="button" data-blk-roll-num="${esc(blk.id)}" class="${isWide ? 'flex-1 min-w-0 text-left' : 'w-full text-center'} hover:opacity-80" title="Tirar ${esc(blk.label)} (${esc(rollHint)})">${lblInner}</button>`
            : `<span class="${isWide ? 'flex-1 min-w-0 text-left' : 'w-full text-center'}">${lblInner}</span>`;
          const numInput = `<input type="number" data-blk-num="${esc(blk.key)}" value="${val}" min="-99" max="999" class="owl-num-input ${isWide ? 'w-14 shrink-0' : 'w-full max-w-[60px]'} text-center text-sm font-bold tabular-nums bg-black/15 rounded-md py-0.5 outline-none" />`;
          return `
            <div style="${spanStyle}" class="owl-subpanel rounded-xl ${isWide ? 'px-2.5 py-1 flex items-center justify-between gap-2' : 'p-1.5 flex flex-col items-center justify-center gap-1'} min-w-0">
              ${lblHtml}
              ${numInput}
            </div>
          `;
        }

        if (blk.kind === 'resource') {
          const isHp = blk.key === 'hp';
          const resObj = isHp ? null : ensureTokRes(blk);
          const cur = isHp ? Math.max(0, Number(tok.hp) || 0) : Math.max(0, Number(resObj.cur) || 0);
          const max = isHp ? Math.max(1, Number(tok.maxHp) || Number(blk.max) || 18) : Math.max(0, Number(blk.max) || 0);
          const color = blk.color || (isHp ? '#10b981' : '#8b5cf6');
          const style = isHp ? 'bar' : (blk.resStyle || 'auto');
          const maxPips = subSpan >= 4 ? 16 : 8;
          const pipShape = ['circle', 'square', 'diamond'].includes(blk.pipShape) ? blk.pipShape : 'circle';
          const pipStates = [1, 2, 3].includes(Number(blk.pipStates)) ? Number(blk.pipStates) : 1;
          const usePips = !isHp && max > 0 && max <= maxPips && (style === 'pips' || (style !== 'bar' && max <= 6));
          const displayCur = usePips && pipStates > 1 && Array.isArray(resObj?.pips)
            ? resObj.pips.slice(0, max).filter((v) => v > 0).length
            : cur;
          const singleLineRes = !usePips && subSpan >= 6;
          const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((cur / max) * 100))) : 0;

          let bodyHtml = '';
          if (max === 0) {
            bodyHtml = `
              <div class="flex items-center justify-center gap-1.5">
                <button type="button" data-blk-res-delta="${esc(blk.id)}:-1" class="owl-btn owl-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">-</button>
                <input type="number" data-blk-res-cur="${esc(blk.id)}" value="${cur}" min="0" max="999" class="owl-num-input w-10 text-center text-xs font-bold tabular-nums bg-black/15 rounded-md py-0.5 outline-none" />
                <button type="button" data-blk-res-delta="${esc(blk.id)}:1" class="owl-btn owl-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">+</button>
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
                ? (Array.isArray(resObj?.pips) ? (Number(resObj.pips[idx]) || 0) : (idx < cur ? pipStates : 0))
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
                <button type="button" data-blk-res-delta="${esc(blk.id)}:-1" class="owl-btn owl-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">-</button>
                <div class="flex-1 h-1.5 rounded-full bg-black/25 overflow-hidden">
                  <div class="h-full rounded-full transition-all" style="width:${pct}%; background:${color};"></div>
                </div>
                <button type="button" data-blk-res-delta="${esc(blk.id)}:1" class="owl-btn owl-panel w-5 h-5 p-0 rounded-full text-xs leading-none shrink-0">+</button>
              </div>
            `;
          }

          const rightReadout = isHp
            ? `<div class="flex items-center gap-0.5 text-[10px] font-semibold tabular-nums shrink-0">
                <span>${cur}</span><span class="opacity-50">/</span>
                <input type="number" data-blk-hp-max="${esc(blk.id)}" value="${max}" min="1" max="999" class="owl-num-input w-7 text-right bg-transparent outline-none" title="Máximo" />
              </div>`
            : max > 0
              ? `<span class="text-[10px] font-semibold tabular-nums opacity-85 shrink-0">${displayCur}/${max}</span>`
              : `<span class="text-[9px] opacity-55 shrink-0">libre</span>`;

          if (singleLineRes) {
            return `
              <div style="${spanStyle}" class="owl-subpanel rounded-xl px-2.5 py-1.5 flex items-center gap-2 min-w-0">
                <span class="inline-flex items-center gap-1.5 min-w-0 max-w-[34%] shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${color};"></span>
                  <span class="text-[11px] font-medium truncate" title="${esc(blk.label)} · @${esc(blk.key)}">${esc(blk.label)}</span>
                </span>
                <div class="flex-1 min-w-0">${bodyHtml}</div>
                ${rightReadout}
              </div>
            `;
          }

          return `
            <div style="${spanStyle}" class="owl-subpanel rounded-xl px-2 py-1.5 flex flex-col justify-between gap-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <span class="inline-flex items-center gap-1 min-w-0">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${color};"></span>
                  <span class="text-[10px] font-medium truncate" title="${esc(blk.label)} · @${esc(blk.key)}">${esc(blk.label)}</span>
                </span>
                ${rightReadout}
              </div>
              ${bodyHtml}
            </div>
          `;
        }

        if (blk.kind === 'roll') {
          const showFormulaText = subSpan >= 3;
          return `
            <button type="button" data-blk-roll-btn="${esc(blk.id)}" style="${spanStyle}" class="owl-btn owl-subpanel px-2.5 py-1.5 rounded-xl flex items-center ${showFormulaText ? 'justify-between' : 'justify-center'} gap-1.5 text-[10.5px] min-w-0" title="Tirar ${esc(blk.label)} (${esc(blk.formula)})">
              <span class="font-semibold truncate">🎲 ${esc(blk.label)}</span>
              ${showFormulaText ? `<span class="text-[9.5px] font-mono-tech opacity-65 shrink-0">${esc(blk.formula)}</span>` : ''}
            </button>
          `;
        }

        const textRows = subSpan >= 6 ? Math.max(1, Math.min(5, Number(blk.textRows) || 1)) : 1;
        if (textRows > 1) {
          return `
            <label style="${spanStyle}" class="owl-subpanel rounded-xl px-2.5 py-2 flex flex-col gap-1 text-left min-w-0">
              <span class="text-[10px] font-semibold opacity-70 tracking-wide truncate">${esc(blk.label)}</span>
              <textarea data-blk-text="${esc(blk.key)}" rows="${textRows}" placeholder="${esc(blk.placeholder || '...')}" class="w-full text-[11px] font-medium leading-relaxed bg-black/15 rounded-lg px-2 py-1.5 border border-white/10 focus:border-violet-400 outline-none resize-y">${esc(texts[blk.key] || '')}</textarea>
            </label>
          `;
        }

        const isInlineText = subSpan >= 4;
        return `
          <label style="${spanStyle}" class="owl-subpanel rounded-xl ${isInlineText ? 'px-2.5 py-1 flex items-center gap-2' : 'px-2 py-1.5 flex flex-col justify-center gap-0.5'} text-left min-w-0">
            <span class="${isInlineText ? 'text-[10.5px] opacity-75 shrink-0 max-w-[38%]' : 'text-[9.5px] opacity-65'} font-semibold tracking-wide truncate">${esc(blk.label)}</span>
            <input type="text" data-blk-text="${esc(blk.key)}" value="${esc(texts[blk.key] || '')}" placeholder="${esc(blk.placeholder || '...')}" class="${isInlineText ? 'flex-1 min-w-0 border-white/10 py-0.5' : 'w-full border-transparent'} text-[11px] font-medium bg-transparent border-b focus:border-violet-400 outline-none" />
          </label>
        `;
      })
      .join('');

    const numBlocks = blocks.filter((b) => b.kind === 'number');
    const sumVal = numBlocks.reduce(
      (acc, b) => acc + (b.key === 'ac' ? (Number(tok.ac) || 0) : (Number(stats[b.key]) || 0)),
      0
    );

    containerEl.innerHTML = `
      <div class="grid gap-1.5 items-stretch" style="grid-template-columns: repeat(6, minmax(0, 1fr));">
        ${cardsHtml}
      </div>
      ${
        sumTotal && numBlocks.length > 0
          ? `<div class="owl-subpanel rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] mt-1">
              <span class="opacity-70 font-medium">Σ Suma total</span>
              <strong class="font-bold tabular-nums text-xs">${sumVal}</strong>
            </div>`
          : ''
      }
    `;

    containerEl.querySelectorAll('[data-blk-num]').forEach((inp) => {
      inp.addEventListener('change', () => Service.updateTokenStat(tok.id, inp.dataset.blkNum, inp.value));
    });
    containerEl.querySelectorAll('[data-blk-roll-num]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const blk = blocks.find((b) => b.id === btn.dataset.blkRollNum);
        if (!blk || blk.rollMode === 'none') return;
        const val = blk.key === 'ac' ? (Number(tok.ac) || 0) : (Number(tok.stats?.[blk.key]) || 0);
        Service.rollSheetCheck(tok, `${tok.name} · ${blk.label}`, val, blk.rollMode === 'custom' ? blk.formula : '');
      });
    });
    containerEl.querySelectorAll('[data-blk-roll-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const blk = blocks.find((b) => b.id === btn.dataset.blkRollBtn);
        if (!blk) return;
        const usedFormula = blk.key === 'init' && !blk.formula ? Service.getSystemInitiativeFormula() : blk.formula;
        const roll = Service.rollSheetCheck(tok, `${tok.name} · ${blk.label}`, 0, usedFormula);
        if (blk.key === 'init' && roll && Service.state.combat?.active && sysCfg.autoInitiative !== false) {
          Service.setTokenInitiative(tok.id, roll.total, roll.isDeckRoll ? roll.headline : '');
        }
      });
    });
    containerEl.querySelectorAll('[data-blk-text]').forEach((inp) => {
      inp.addEventListener('change', () => Service.updateTokenText(tok.id, inp.dataset.blkText, inp.value));
    });
    containerEl.querySelectorAll('[data-blk-hp-max]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const nextMax = Math.max(1, Math.min(999, Number(inp.value) || 1));
        tok.maxHp = nextMax;
        tok.hp = Math.min(tok.hp, nextMax);
        Service.notify();
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
      inp.addEventListener('change', () => Service.setTokenResourceValue(tok.id, inp.dataset.blkResCur, inp.value));
    });
    containerEl.querySelectorAll('[data-blk-res-pip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [id, idxStr, statesStr] = btn.dataset.blkResPip.split(':');
        const blk = blocks.find((b) => b.id === id);
        Service.cycleTokenResourcePip(tok.id, id, Number(idxStr) || 0, Number(statesStr) || 1, Number(blk?.max) || 0);
      });
    });
  }
};
