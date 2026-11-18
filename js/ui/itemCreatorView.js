/* ==========================================================================
   ITEM CREATOR VIEW: CREADOR MODULAR DE COMPLEMENTOS POR BLOQUES
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261117b1';
import { Service } from '../core/service.js?v=20261117b1';

const CREATOR_ICONS = {
  passive: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V6l7-3z"/></svg>',
  roll: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/></svg>',
  area: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>',
  save: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/></svg>',
  apply: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5.5 6.2 5.5 10.5a5.5 5.5 0 1 1-11 0C6.5 9.2 12 3 12 3z"/></svg>',
  up: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10L8 5.5l4.5 4.5"/></svg>',
  down: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6L8 10.5 12.5 6"/></svg>',
  close: '<svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>'
};

export const ItemCreatorViewMethods = {
  creatorPassives: [],
  creatorSteps: [],

  bindItemCreatorEvents() {
    if (!this.els.itemBlockPalette) return;
    this.els.itemBlockPalette.querySelectorAll('[data-add-block]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.addCreatorBlock(btn.dataset.addBlock);
      });
    });
  },

  resetItemCreatorBlocks() {
    this.creatorPassives = [];
    this.creatorSteps = [];
    if (this.els.inpCustomItemMsg) this.els.inpCustomItemMsg.value = '';
    this.renderCreatorBlocks();
  },

  loadItemIntoCreatorBlocks(item) {
    const norm = Selector.normalizeItemSchema(item);
    this.creatorPassives = norm.passives.map((p) => ({ ...p }));
    this.creatorSteps = norm.steps.map((s) => ({ ...s }));
    if (this.els.inpCustomItemMsg) this.els.inpCustomItemMsg.value = norm.message || '';
    this.renderCreatorBlocks();
  },

  addCreatorBlock(type) {
    const stats = Selector.getSheetStatsDef(Service.state);
    const firstStat = stats[0] ? stats[0].key : 'str';
    if (type === 'passive') {
      this.creatorPassives.push({ target: 'ac', value: 1 });
    } else if (type === 'roll') {
      this.creatorSteps.push({
        type: 'roll',
        label: this.creatorSteps.some((s) => s.type === 'roll') ? 'Daño' : 'Ataque',
        formula: this.creatorSteps.some((s) => s.type === 'roll') ? '1d8' : `1d20+@${stats[0]?.alias || firstStat}`,
        resultMode: 'inherit',
        successThreshold: 6,
        message: '',
        allowHpAction: true,
        isHeal: false
      });
    } else if (type === 'area') {
      this.creatorSteps.push({ type: 'area', label: 'Área', shape: 'circle', radiusCells: 2, message: '' });
    } else if (type === 'save_request') {
      this.creatorSteps.push({
        type: 'save_request',
        label: `Salvación de ${stats[1]?.label || stats[0]?.label || 'DES'}`,
        statKey: stats[1]?.key || firstStat,
        dc: 13,
        message: ''
      });
    } else if (type === 'apply_hp') {
      const firstCond = Object.keys(this.tokenStatusSymbols || {})[0] || 'confused';
      this.creatorSteps.push({
        type: 'apply_hp',
        label: 'Aplicar',
        effectMode: 'damage',
        conditionKey: firstCond,
        message: ''
      });
    }
    this.renderCreatorBlocks();
    if (this.els.customItemBlocksList) {
      this.els.customItemBlocksList.scrollTop = this.els.customItemBlocksList.scrollHeight;
    }
  },

  getCreatorPayload() {
    return {
      passives: this.creatorPassives.map((p) => ({ ...p })),
      steps: this.creatorSteps.map((s) => ({ ...s }))
    };
  },

  renderCreatorBlocks() {
    const box = this.els.customItemBlocksList;
    if (!box) return;
    const stats = Selector.getSheetStatsDef(Service.state);
    const esc = (v) => this.escapeHtml(v || '');

    const passiveOptions = [
      { key: 'ac', label: 'CA' },
      { key: 'maxHp', label: 'HP Máx' },
      ...stats.map((s) => ({ key: s.key, label: s.label }))
    ];

    const passivesHtml = this.creatorPassives
      .map(
        (p, idx) => `
        <div class="portal-subpanel rounded-xl px-2 py-1.5 flex items-center justify-between gap-1.5 text-[11px]" data-passive-idx="${idx}">
          <span class="inline-flex items-center gap-1.5 opacity-80 font-semibold shrink-0">${CREATOR_ICONS.passive}<span>Pasivo</span></span>
          <div class="flex items-center gap-1 min-w-0">
            <input type="number" data-p-val="${idx}" value="${Number(p.value) || 0}" min="-20" max="99" class="portal-num-input w-11 py-0.5 text-center text-[11px] font-semibold" />
            <select data-p-target="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer">
              ${passiveOptions
                .map((o) => `<option value="${esc(o.key)}" ${p.target === o.key ? 'selected' : ''}>${esc(o.label)}</option>`)
                .join('')}
            </select>
            <button type="button" data-p-del="${idx}" class="portal-btn w-5 h-5 p-0 rounded-full hover:bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0" title="Quitar">${CREATOR_ICONS.close}</button>
          </div>
        </div>`
      )
      .join('');

    const stepsHtml = this.creatorSteps
      .map((s, idx) => {
        const controls = `
          <div class="flex items-center gap-0.5 shrink-0">
            ${idx > 0 ? `<button type="button" data-s-up="${idx}" class="portal-btn w-5 h-5 p-0 rounded hover:bg-white/10 flex items-center justify-center" title="Subir">${CREATOR_ICONS.up}</button>` : ''}
            ${idx < this.creatorSteps.length - 1 ? `<button type="button" data-s-down="${idx}" class="portal-btn w-5 h-5 p-0 rounded hover:bg-white/10 flex items-center justify-center" title="Bajar">${CREATOR_ICONS.down}</button>` : ''}
            <button type="button" data-s-del="${idx}" class="portal-btn w-5 h-5 p-0 rounded-full hover:bg-rose-500/20 text-rose-400 flex items-center justify-center" title="Quitar">${CREATOR_ICONS.close}</button>
          </div>`;

        const stepNoteInput = `<input type="text" data-s-msg="${idx}" value="${esc(s.message)}" placeholder="Nota de este paso (opcional)..." class="portal-input px-2 py-0.5 text-[10px] opacity-85" />`;

        if (s.type === 'roll') {
          const op = this.creatorFormulaOp === '-' ? '-' : '+';
          const opSwitch = `
            <div class="portal-seg inline-grid grid-cols-2 gap-0.5 text-[10px] mr-0.5" title="Modo: sumar (+) o restar (−)">
              <button type="button" data-s-formula-op="+" class="portal-seg-btn px-1.5 py-0.5 font-bold ${op === '+' ? 'is-active' : ''}">+</button>
              <button type="button" data-s-formula-op="-" class="portal-seg-btn px-1.5 py-0.5 font-bold ${op === '-' ? 'is-active' : ''}">−</button>
            </div>`;
          const statChips = stats
            .map(
              (st) =>
                `<button type="button" data-s-add-stat="${idx}:${esc(st.alias || st.key)}" class="portal-seg-btn portal-panel px-1.5 py-0.5 text-[9.5px] font-semibold" title="${op === '-' ? 'Restar' : 'Sumar'} @${esc(st.alias || st.key)}">${op === '-' ? '−' : ''}@${esc(st.label)}</button>`
            )
            .join('');
          const diceChips = [4, 6, 8, 10, 12, 20]
            .map(
              (d) =>
                `<button type="button" data-s-add-die="${idx}:${d}" class="portal-seg-btn portal-panel px-1.5 py-0.5 text-[9.5px] font-mono-tech" title="Clic: ${op === '-' ? 'restar' : 'sumar'} d${d} · Clic derecho: quitar 1d${d}">${op}d${d}</button>`
            )
            .join('');
          const rMode = s.resultMode || 'inherit';
          const rThr = Number(s.successThreshold) || 6;
          const modeOpts = [
            ['inherit', 'Según barra'],
            ['sum', 'Total (Suma)'],
            ['max', 'Máx (Ventaja)'],
            ['min', 'Mín (Desventaja)'],
            ['each', 'c/u (Individual)'],
            ['success', 'Éxitos (≥ N)']
          ];
          const thrInput = rMode === 'success'
            ? `<span class="text-[10px] opacity-65">≥</span><input type="number" data-s-thr="${idx}" value="${rThr}" min="1" max="100" class="portal-num-input w-10 py-0.5 text-center text-[10px]" title="Umbral de éxito" />`
            : '';
          return `
            <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1.5 text-[10.5px]">
              <div class="flex items-center justify-between gap-1.5">
                <span class="inline-flex items-center gap-1 font-semibold opacity-80 shrink-0">${CREATOR_ICONS.roll}<span>${idx + 1}.</span></span>
                <input type="text" data-s-label="${idx}" value="${esc(s.label)}" placeholder="Etiqueta (ej. Ataque)" class="portal-input px-1.5 py-0.5 text-[10.5px] flex-1 min-w-0" />
                ${controls}
              </div>
              <input type="text" data-s-formula="${idx}" value="${esc(s.formula)}" placeholder="1d20+@fue" class="portal-input px-2 py-1 text-[11px] font-mono-tech" />
              <div class="flex items-center gap-1">
                <select data-s-rmode="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                  ${modeOpts.map(([k, lbl]) => `<option value="${k}" ${rMode === k ? 'selected' : ''}>${lbl}</option>`).join('')}
                </select>
                ${thrInput}
              </div>
              <div class="portal-formula-bar">
                ${opSwitch}${diceChips}
                ${statChips ? `<div class="w-full pt-1 mt-0.5 border-t flex flex-wrap gap-1" style="border-color: var(--hairline);">${statChips}</div>` : ''}
              </div>
              ${stepNoteInput}
            </div>`;
        }

        if (s.type === 'area') {
          const shape = s.shape || 'circle';
          const isTargets = shape === 'targets';
          const shapeOpts = [
            ['circle', 'Círculo'],
            ['cube', 'Cubo'],
            ['cone', 'Cono'],
            ['line', 'Línea'],
            ['targets', 'Objetivos']
          ];
          const val = isTargets
            ? Math.max(1, Math.round(Number(s.maxTargets ?? s.radiusCells) || 3))
            : Number(s.radiusCells) || 2;
          return `
            <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1 text-[10.5px]">
              <div class="flex items-center justify-between gap-1.5">
                <span class="inline-flex items-center gap-1 font-semibold opacity-80 shrink-0">${CREATOR_ICONS.area}<span>${idx + 1}.</span></span>
                <select data-s-shape="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                  ${shapeOpts.map(([k, lbl]) => `<option value="${k}" ${shape === k ? 'selected' : ''}>${lbl}</option>`).join('')}
                </select>
                <input type="number" data-s-radius="${idx}" value="${val}" min="${isTargets ? 1 : 0.5}" max="20" step="${isTargets ? 1 : 0.5}" class="portal-num-input w-11 py-0.5 text-center text-[10.5px]" title="${isTargets ? 'Máximo de objetivos' : 'Casillas'}" />
                <span class="text-[9.5px] opacity-65 shrink-0">${isTargets ? 'obj' : 'cas'}</span>
                ${controls}
              </div>
              ${stepNoteInput}
            </div>`;
        }

        if (s.type === 'save_request') {
          return `
            <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1 text-[10.5px]">
              <div class="flex items-center justify-between gap-1.5">
                <span class="inline-flex items-center gap-1 font-semibold opacity-80 shrink-0">${CREATOR_ICONS.save}<span>${idx + 1}. Pedir</span></span>
                <select data-s-stat="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                  ${stats
                    .map((st) => `<option value="${esc(st.key)}" ${s.statKey === st.key ? 'selected' : ''}>${esc(st.label)}</option>`)
                    .join('')}
                </select>
                <span class="text-[10px] opacity-65">CD</span>
                <input type="number" data-s-dc="${idx}" value="${Number(s.dc) || 0}" min="0" max="40" class="portal-num-input w-10 py-0.5 text-center text-[10.5px]" />
                ${controls}
              </div>
              ${stepNoteInput}
            </div>`;
        }

        if (s.type === 'apply_hp') {
          const eff = s.effectMode || (s.isHeal ? 'heal' : 'damage');
          const statusDefs = Selector.getSystemStatuses(Service.state);
          const curCond = s.conditionKey || statusDefs[0]?.key || 'confused';
          const condSelect = eff === 'condition'
            ? `<select data-s-cond="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                ${statusDefs.map((st) => `<option value="${esc(st.key)}" ${curCond === st.key ? 'selected' : ''}>${esc(st.label)}</option>`).join('')}
              </select>`
            : '';
          return `
            <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1 text-[10.5px]">
              <div class="flex items-center justify-between gap-1.5">
                <span class="inline-flex items-center gap-1 font-semibold opacity-80 shrink-0">${CREATOR_ICONS.apply}<span>${idx + 1}.</span></span>
                <select data-s-effect="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                  <option value="damage" ${eff === 'damage' ? 'selected' : ''}>Daño</option>
                  <option value="heal" ${eff === 'heal' ? 'selected' : ''}>Curación</option>
                  <option value="condition" ${eff === 'condition' ? 'selected' : ''}>Estado</option>
                  <option value="bonus" ${eff === 'bonus' ? 'selected' : ''}>Bono (+Barra)</option>
                </select>
                ${condSelect}
                ${controls}
              </div>
              ${stepNoteInput}
            </div>`;
        }
        return '';
      })
      .join('');

    const content = passivesHtml + stepsHtml;
    box.innerHTML = content;
    const section = this.els.customItemBlocksSection || box;
    section.classList.toggle('hidden', !content);
    section.classList.toggle('flex', Boolean(content));

    this.bindCreatorBlockInputs(box, stats);
  },

  bindCreatorBlockInputs(box, stats) {
    box.querySelectorAll('[data-p-val]').forEach((el) => {
      el.addEventListener('change', () => {
        const i = Number(el.dataset.pVal);
        if (this.creatorPassives[i]) this.creatorPassives[i].value = Number(el.value) || 0;
      });
    });
    box.querySelectorAll('[data-p-target]').forEach((el) => {
      el.addEventListener('change', () => {
        const i = Number(el.dataset.pTarget);
        if (this.creatorPassives[i]) this.creatorPassives[i].target = el.value;
      });
    });
    box.querySelectorAll('[data-p-del]').forEach((el) => {
      el.addEventListener('click', () => {
        this.creatorPassives.splice(Number(el.dataset.pDel), 1);
        this.renderCreatorBlocks();
      });
    });

    box.querySelectorAll('[data-s-label]').forEach((el) => {
      el.addEventListener('input', () => {
        const i = Number(el.dataset.sLabel);
        if (this.creatorSteps[i]) this.creatorSteps[i].label = el.value;
      });
    });
    box.querySelectorAll('[data-s-formula]').forEach((el) => {
      el.addEventListener('input', () => {
        const i = Number(el.dataset.sFormula);
        if (this.creatorSteps[i]) this.creatorSteps[i].formula = el.value;
      });
    });
    box.querySelectorAll('[data-s-msg]').forEach((el) => {
      el.addEventListener('input', () => {
        const i = Number(el.dataset.sMsg);
        if (this.creatorSteps[i]) this.creatorSteps[i].message = el.value;
      });
    });
    box.querySelectorAll('[data-s-formula-op]').forEach((el) => {
      el.addEventListener('click', () => {
        this.creatorFormulaOp = el.dataset.sFormulaOp === '-' ? '-' : '+';
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-s-add-die]').forEach((el) => {
      el.addEventListener('click', () => {
        const [iRaw, dRaw] = el.dataset.sAddDie.split(':');
        const step = this.creatorSteps[Number(iRaw)];
        if (!step) return;
        const op = this.creatorFormulaOp === '-' ? '-' : '+';
        step.formula = Selector.appendDiceToFormula(step.formula, dRaw, op);
        this.renderCreatorBlocks();
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const [iRaw, dRaw] = el.dataset.sAddDie.split(':');
        const step = this.creatorSteps[Number(iRaw)];
        if (!step) return;
        step.formula = Selector.decrementDiceInFormula(step.formula, dRaw);
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-s-add-stat]').forEach((el) => {
      el.addEventListener('click', () => {
        const [iRaw, alias] = el.dataset.sAddStat.split(':');
        const step = this.creatorSteps[Number(iRaw)];
        if (!step) return;
        const op = this.creatorFormulaOp === '-' ? '-' : '+';
        step.formula = Selector.appendStatToFormula(step.formula, alias, op);
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-s-rmode]').forEach((el) => {
      el.addEventListener('change', () => {
        const step = this.creatorSteps[Number(el.dataset.sRmode)];
        if (!step) return;
        step.resultMode = el.value;
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-s-thr]').forEach((el) => {
      el.addEventListener('change', () => {
        const step = this.creatorSteps[Number(el.dataset.sThr)];
        if (step) step.successThreshold = Math.max(1, Math.min(100, Math.round(Number(el.value) || 6)));
      });
    });
    box.querySelectorAll('[data-s-effect]').forEach((el) => {
      el.addEventListener('change', () => {
        const step = this.creatorSteps[Number(el.dataset.sEffect)];
        if (!step) return;
        step.effectMode = el.value;
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-s-cond]').forEach((el) => {
      el.addEventListener('change', () => {
        const step = this.creatorSteps[Number(el.dataset.sCond)];
        if (step) step.conditionKey = el.value;
      });
    });
    box.querySelectorAll('[data-s-shape]').forEach((el) => {
      el.addEventListener('change', () => {
        const step = this.creatorSteps[Number(el.dataset.sShape)];
        if (!step) return;
        step.shape = el.value;
        if (el.value === 'targets') {
          step.maxTargets = Math.max(1, Math.round(Number(step.maxTargets ?? step.radiusCells) || 3));
        }
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-s-radius]').forEach((el) => {
      el.addEventListener('change', () => {
        const step = this.creatorSteps[Number(el.dataset.sRadius)];
        if (!step) return;
        if (step.shape === 'targets') {
          step.maxTargets = Math.max(1, Math.min(20, Math.round(Number(el.value) || 1)));
        } else {
          step.radiusCells = Math.max(0.5, Number(el.value) || 2);
        }
      });
    });
    box.querySelectorAll('[data-s-stat]').forEach((el) => {
      el.addEventListener('change', () => {
        const step = this.creatorSteps[Number(el.dataset.sStat)];
        if (!step) return;
        step.statKey = el.value;
        const st = stats.find((x) => x.key === el.value);
        if (st) step.label = `Salvación de ${st.label}`;
      });
    });
    box.querySelectorAll('[data-s-dc]').forEach((el) => {
      el.addEventListener('change', () => {
        const step = this.creatorSteps[Number(el.dataset.sDc)];
        if (step) step.dc = Math.max(0, Number(el.value) || 0);
      });
    });

    box.querySelectorAll('[data-s-up]').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.dataset.sUp);
        if (i <= 0) return;
        [this.creatorSteps[i - 1], this.creatorSteps[i]] = [this.creatorSteps[i], this.creatorSteps[i - 1]];
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-s-down]').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.dataset.sDown);
        if (i >= this.creatorSteps.length - 1) return;
        [this.creatorSteps[i], this.creatorSteps[i + 1]] = [this.creatorSteps[i + 1], this.creatorSteps[i]];
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-s-del]').forEach((el) => {
      el.addEventListener('click', () => {
        this.creatorSteps.splice(Number(el.dataset.sDel), 1);
        this.renderCreatorBlocks();
      });
    });
  }
};
