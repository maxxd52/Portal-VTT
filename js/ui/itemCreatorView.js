/* ==========================================================================
   ITEM CREATOR VIEW: CREADOR MODULAR DE COMPLEMENTOS EN 3 BLOQUES
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';

const CREATOR_ICONS = {
  passive: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.2 8.7-7 10-3.8-1.3-7-5-7-10V6l7-3z"/></svg>',
  roll: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/></svg>',
  opposed: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
  targets: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>',
  request: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/></svg>',
  modify: '<svg class="w-3 h-3 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5.5 6.2 5.5 10.5a5.5 5.5 0 1 1-11 0C6.5 9.2 12 3 12 3z"/></svg>',
  up: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10L8 5.5l4.5 4.5"/></svg>',
  down: '<svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6L8 10.5 12.5 6"/></svg>',
  close: '<svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>'
};

export const ItemCreatorViewMethods = {
  creatorBlocks: [],

  bindItemCreatorEvents() {
    if (!this.els.itemBlockPalette) return;
    this.els.itemBlockPalette.querySelectorAll('[data-add-block]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.addCreatorBlock(btn.dataset.addBlock);
      });
    });
  },

  resetItemCreatorBlocks() {
    this.creatorBlocks = [];
    if (this.els.inpCustomItemMsg) this.els.inpCustomItemMsg.value = '';
    this.renderCreatorBlocks();
  },

  loadItemIntoCreatorBlocks(item) {
    const norm = Selector.normalizeItemSchema(item);
    const passiveBlocks = norm.passives.map((p) => ({
      type: 'modify',
      label: 'Pasivo',
      effectMode: 'passive',
      passiveTarget: p.target || 'ac',
      passiveValue: Number(p.value) || 0,
      message: ''
    }));
    this.creatorBlocks = [
      ...passiveBlocks,
      ...norm.steps.map((s) => ({ ...s }))
    ];
    if (this.els.inpCustomItemMsg) this.els.inpCustomItemMsg.value = norm.message || '';
    this.renderCreatorBlocks();
  },

  addCreatorBlock(type) {
    const stats = Selector.getSheetStatsDef(Service.state);
    const firstStat = stats[0] ? stats[0].key : 'str';
    if (type === 'roll') {
      const hasSelfRoll = this.creatorBlocks.some((b) => b.type === 'roll' && b.rollKind !== 'request');
      this.creatorBlocks.push({
        type: 'roll',
        rollKind: 'self',
        label: hasSelfRoll ? 'Daño' : 'Ataque',
        formula: hasSelfRoll ? '1d8' : `1d20+@${stats[0]?.alias || firstStat}`,
        statKey: stats[1]?.key || firstStat,
        dc: 13,
        resultMode: 'inherit',
        successThreshold: 6,
        message: '',
        allowHpAction: true,
        isHeal: false
      });
    } else if (type === 'targets' || type === 'area') {
      this.creatorBlocks.push({
        type: 'targets',
        label: 'Objetivos',
        shape: 'targets',
        maxTargets: 1,
        radiusCells: 2,
        message: ''
      });
    } else if (type === 'modify' || type === 'apply_hp' || type === 'passive') {
      const firstCond = Selector.getSystemStatuses(Service.state)[0]?.key || 'confused';
      this.creatorBlocks.push({
        type: 'modify',
        label: type === 'passive' ? 'Pasivo' : 'Modificar',
        effectMode: type === 'passive' ? 'passive' : 'damage',
        targetScope: 'targets',
        resourceKey: 'hp',
        amount: 0,
        conditionKey: firstCond,
        passiveTarget: 'ac',
        passiveValue: 1,
        message: ''
      });
    }
    this.renderCreatorBlocks();
    if (this.els.customItemBlocksList) {
      this.els.customItemBlocksList.scrollTop = this.els.customItemBlocksList.scrollHeight;
    }
  },

  getCreatorPayload() {
    const passives = [];
    const steps = [];
    this.creatorBlocks.forEach((b) => {
      if (b.type === 'modify' && b.effectMode === 'passive') {
        passives.push({
          target: String(b.passiveTarget || 'ac'),
          value: Number(b.passiveValue) || 0
        });
      } else {
        steps.push({ ...b });
      }
    });
    return { passives, steps };
  },

  renderCreatorBlocks() {
    const box = this.els.customItemBlocksList;
    if (!box) return;
    const stats = Selector.getSheetStatsDef(Service.state);
    const sysBlocks = Selector.getSystemSheetBlocks(Service.state);
    const esc = (v) => this.escapeHtml(v || '');

    const statOptions = sysBlocks.length > 0
      ? sysBlocks
          .filter((blk) => blk.kind === 'number' && blk.valueMode !== 'calc' && blk.valueMode !== 'die' && blk.key !== 'ac')
          .map((blk) => ({ key: blk.key, label: blk.label }))
      : stats.map((st) => ({ key: st.key, label: st.label }));

    const passiveOptions = [
      { key: 'ac', label: 'CA / Defensa' },
      { key: 'maxHp', label: 'HP Máx' },
      ...statOptions
    ];

    const extraResources = sysBlocks.filter((blk) => blk.kind === 'resource' && blk.key !== 'hp');
    const resourceOptions = [
      { key: 'hp', label: 'Salud (HP)' },
      ...extraResources.map((r) => ({ key: r.key, label: r.label }))
    ];

    let activeStepNum = 0;
    const blocksHtml = this.creatorBlocks
      .map((s, idx) => {
        const isPassive = s.type === 'modify' && s.effectMode === 'passive';
        if (!isPassive) activeStepNum += 1;
        const rollSvg = s.type === 'roll'
          ? (s.rollKind === 'request' ? CREATOR_ICONS.request : s.rollKind === 'opposed' ? CREATOR_ICONS.opposed : CREATOR_ICONS.roll)
          : (CREATOR_ICONS[s.type] || CREATOR_ICONS.modify);
        const stepBadge = isPassive
          ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider shrink-0" style="background: var(--accent-soft); color: var(--accent-primary);">${CREATOR_ICONS.passive}<span>Pasivo</span></span>`
          : `<span class="inline-flex items-center gap-1 font-semibold opacity-80 shrink-0">${rollSvg}<span>${activeStepNum}.</span></span>`;

        const controls = `
          <div class="flex items-center gap-0.5 shrink-0">
            ${idx > 0 ? `<button type="button" data-b-up="${idx}" class="portal-btn w-5 h-5 p-0 rounded hover:bg-white/10 flex items-center justify-center" title="Subir">${CREATOR_ICONS.up}</button>` : ''}
            ${idx < this.creatorBlocks.length - 1 ? `<button type="button" data-b-down="${idx}" class="portal-btn w-5 h-5 p-0 rounded hover:bg-white/10 flex items-center justify-center" title="Bajar">${CREATOR_ICONS.down}</button>` : ''}
            <button type="button" data-b-del="${idx}" class="portal-btn w-5 h-5 p-0 rounded-full hover:bg-rose-500/20 text-rose-400 flex items-center justify-center" title="Quitar">${CREATOR_ICONS.close}</button>
          </div>`;

        const stepNoteInput = `<input type="text" data-b-msg="${idx}" value="${esc(s.message)}" placeholder="Nota de este paso (opcional)..." class="portal-input px-2 py-0.5 text-[10px] opacity-85" />`;

        if (s.type === 'roll') {
          const isRequest = s.rollKind === 'request';
          const isOpposed = s.rollKind === 'opposed';
          const kindSwitch = `
            <div class="portal-seg grid grid-cols-3 gap-0.5 text-[9.5px] flex-1 min-w-0">
              <button type="button" data-b-rollkind="${idx}:self" class="portal-seg-btn py-0.5 font-semibold ${!isRequest && !isOpposed ? 'is-active' : ''}">Propia</button>
              <button type="button" data-b-rollkind="${idx}:request" class="portal-seg-btn py-0.5 font-semibold ${isRequest ? 'is-active' : ''}">Solicitar</button>
              <button type="button" data-b-rollkind="${idx}:opposed" class="portal-seg-btn py-0.5 font-semibold ${isOpposed ? 'is-active' : ''}">Enfrentada</button>
            </div>`;

          if (isRequest) {
            const statKey = s.statKey ?? '';
            return `
              <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1.5 text-[10.5px]">
                <div class="flex items-center justify-between gap-1.5">
                  ${stepBadge}
                  ${kindSwitch}
                  ${controls}
                </div>
                <input type="text" data-b-label="${idx}" value="${esc(s.label)}" placeholder="Etiqueta (ej. Salvación de DES)" class="portal-input px-2 py-0.5 text-[10.5px]" />
                <div class="flex items-center gap-1">
                  <select data-b-stat="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                    <option value="" ${!statKey ? 'selected' : ''}>Fórmula libre</option>
                    ${stats
                      .map((st) => `<option value="${esc(st.key)}" ${statKey === st.key ? 'selected' : ''}>${esc(st.label)}</option>`)
                      .join('')}
                  </select>
                  <span class="text-[10px] opacity-65">CD</span>
                  <input type="number" data-b-dc="${idx}" value="${Number(s.dc) || 0}" min="0" max="40" class="portal-num-input w-10 py-0.5 text-center text-[10.5px]" />
                </div>
                <input type="text" data-b-formula="${idx}" value="${esc(s.formula || '')}" placeholder="Auto según sistema (ej. 2d6+@des)" class="portal-input px-2 py-0.5 text-[10.5px] font-mono-tech" />
                ${stepNoteInput}
              </div>`;
          }

          const op = this.creatorFormulaOp === '-' ? '-' : '+';
          const opSwitch = `
            <div class="portal-seg inline-grid grid-cols-2 gap-0.5 text-[10px] mr-0.5" title="Modo: sumar (+) o restar (−)">
              <button type="button" data-b-formula-op="+" class="portal-seg-btn px-1.5 py-0.5 font-bold ${op === '+' ? 'is-active' : ''}">+</button>
              <button type="button" data-b-formula-op="-" class="portal-seg-btn px-1.5 py-0.5 font-bold ${op === '-' ? 'is-active' : ''}">−</button>
            </div>`;
          const statChips = stats
            .map(
              (st) =>
                `<button type="button" data-b-add-stat="${idx}:${esc(st.alias || st.key)}" class="portal-seg-btn portal-panel px-1.5 py-0.5 text-[9.5px] font-semibold" title="${op === '-' ? 'Restar' : 'Sumar'} @${esc(st.alias || st.key)}">${op === '-' ? '−' : ''}@${esc(st.label)}</button>`
            )
            .join('');
          const diceChips = [4, 6, 8, 10, 12, 20]
            .map(
              (d) =>
                `<button type="button" data-b-add-die="${idx}:${d}" class="portal-seg-btn portal-panel px-1.5 py-0.5 text-[9.5px] font-mono-tech" title="Clic: ${op === '-' ? 'restar' : 'sumar'} d${d} · Clic derecho: quitar 1d${d}">${op}d${d}</button>`
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
            ? `<span class="text-[10px] opacity-65">≥</span><input type="number" data-b-thr="${idx}" value="${rThr}" min="1" max="100" class="portal-num-input w-10 py-0.5 text-center text-[10px]" title="Umbral de éxito" />`
            : '';
          const oppStatKey = s.opposedStatKey ?? '';
          const opposedDefenseHtml = isOpposed
            ? `<div class="pt-1 mt-0.5 border-t flex flex-col gap-1" style="border-color: var(--hairline);">
                <div class="flex items-center gap-1.5">
                  <span class="text-[9.5px] opacity-65 shrink-0">Defensa objetivo</span>
                  <select data-b-opp-stat="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                    <option value="" ${!oppStatKey ? 'selected' : ''}>Igual que atacante</option>
                    ${stats
                      .map((st) => `<option value="${esc(st.key)}" ${oppStatKey === st.key ? 'selected' : ''}>${esc(st.label)}</option>`)
                      .join('')}
                  </select>
                </div>
                <input type="text" data-b-opp-formula="${idx}" value="${esc(s.opposedFormula || '')}" placeholder="Fórmula rival (vacío = igual que atacante)" class="portal-input px-2 py-0.5 text-[10px] font-mono-tech" />
              </div>`
            : '';
          return `
            <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1.5 text-[10.5px]">
              <div class="flex items-center justify-between gap-1.5">
                ${stepBadge}
                ${kindSwitch}
                ${controls}
              </div>
              <input type="text" data-b-label="${idx}" value="${esc(s.label)}" placeholder="${isOpposed ? 'Etiqueta (ej. Agarre / Engaño)' : 'Etiqueta (ej. Ataque)'}" class="portal-input px-2 py-0.5 text-[10.5px]" />
              <input type="text" data-b-formula="${idx}" value="${esc(s.formula)}" placeholder="1d20+@fue" class="portal-input px-2 py-1 text-[11px] font-mono-tech" />
              <div class="flex items-center gap-1">
                <select data-b-rmode="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                  ${modeOpts.map(([k, lbl]) => `<option value="${k}" ${rMode === k ? 'selected' : ''}>${lbl}</option>`).join('')}
                </select>
                ${thrInput}
              </div>
              <div class="portal-formula-bar">
                ${opSwitch}${diceChips}
                ${statChips ? `<div class="w-full pt-1 mt-0.5 border-t flex flex-wrap gap-1" style="border-color: var(--hairline);">${statChips}</div>` : ''}
              </div>
              ${opposedDefenseHtml}
              ${stepNoteInput}
            </div>`;
        }

        if (s.type === 'targets' || s.type === 'area') {
          const shape = s.shape || 'targets';
          const isTargets = shape === 'targets';
          const isSelf = shape === 'self';
          const shapeOpts = [
            ['targets', 'Objetivos'],
            ['self', 'A sí mismo'],
            ['circle', 'Círculo'],
            ['cube', 'Cubo'],
            ['cone', 'Cono'],
            ['line', 'Línea']
          ];
          const val = isTargets
            ? Math.max(1, Math.round(Number(s.maxTargets ?? s.radiusCells) || 1))
            : Number(s.radiusCells) || 2;
          return `
            <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1 text-[10.5px]">
              <div class="flex items-center justify-between gap-1.5">
                ${stepBadge}
                <select data-b-shape="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                  ${shapeOpts.map(([k, lbl]) => `<option value="${k}" ${shape === k ? 'selected' : ''}>${lbl}</option>`).join('')}
                </select>
                ${
                  isSelf
                    ? ''
                    : `<input type="number" data-b-radius="${idx}" value="${val}" min="${isTargets ? 1 : 0.5}" max="20" step="${isTargets ? 1 : 0.5}" class="portal-num-input w-11 py-0.5 text-center text-[10.5px]" title="${isTargets ? 'Máximo de objetivos' : 'Casillas'}" />
                       <span class="text-[9.5px] opacity-65 shrink-0">${isTargets ? 'obj' : 'cas'}</span>`
                }
                ${controls}
              </div>
              ${stepNoteInput}
            </div>`;
        }

        if (s.type === 'modify' || s.type === 'apply_hp') {
          const eff = s.effectMode || (s.isHeal ? 'heal' : 'damage');
          const scope = s.targetScope === 'self' ? 'self' : 'targets';
          const statusDefs = Selector.getSystemStatuses(Service.state);
          const curCond = s.conditionKey || statusDefs[0]?.key || 'confused';

          const effectSelect = `
            <select data-b-effect="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
              <option value="damage" ${eff === 'damage' ? 'selected' : ''}>Daño</option>
              <option value="heal" ${eff === 'heal' ? 'selected' : ''}>Curación</option>
              <option value="condition" ${eff === 'condition' ? 'selected' : ''}>Estado</option>
              <option value="bonus" ${eff === 'bonus' ? 'selected' : ''}>Bono (+Barra)</option>
              <option value="passive" ${eff === 'passive' ? 'selected' : ''}>Pasivo (al equipar)</option>
            </select>`;

          if (eff === 'passive') {
            const pTarget = s.passiveTarget || 'ac';
            const pVal = Number(s.passiveValue) || 0;
            return `
              <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1.5 text-[10.5px]">
                <div class="flex items-center justify-between gap-1.5">
                  ${stepBadge}
                  ${effectSelect}
                  ${controls}
                </div>
                <div class="flex items-center gap-1.5">
                  <input type="number" data-b-pval="${idx}" value="${pVal}" min="-20" max="99" class="portal-num-input w-12 py-0.5 text-center text-[11px] font-semibold shrink-0" title="Bono o penalizador al equipar" />
                  <select data-b-ptarget="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                    ${passiveOptions.map((o) => `<option value="${esc(o.key)}" ${pTarget === o.key ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
                  </select>
                </div>
              </div>`;
          }

          const scopeToggle = `
            <div class="portal-seg grid grid-cols-2 gap-0.5 text-[9.5px] shrink-0" title="A quién modifica al usar">
              <button type="button" data-b-scope="${idx}:targets" class="portal-seg-btn px-2 py-0.5 font-semibold ${scope === 'targets' ? 'is-active' : ''}">Objetivos</button>
              <button type="button" data-b-scope="${idx}:self" class="portal-seg-btn px-2 py-0.5 font-semibold ${scope === 'self' ? 'is-active' : ''}">A sí mismo</button>
            </div>`;

          let detailRow = '';
          if (eff === 'condition') {
            detailRow = `
              <div class="flex items-center gap-1.5">
                <select data-b-cond="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                  ${statusDefs.map((st) => `<option value="${esc(st.key)}" ${curCond === st.key ? 'selected' : ''}>${esc(st.label)}</option>`).join('')}
                </select>
                ${scopeToggle}
              </div>`;
          } else if (eff === 'bonus') {
            const fixedAmt = Number(s.amount) > 0 ? Number(s.amount) : '';
            detailRow = `
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] opacity-65 shrink-0">Valor fijo</span>
                <input type="number" data-b-amt="${idx}" value="${fixedAmt}" min="0" max="999" placeholder="Según tirada" class="portal-input px-2 py-0.5 text-[10px] flex-1 min-w-0" />
              </div>`;
          } else {
            const resKey = s.resourceKey || 'hp';
            const fixedAmt = Number(s.amount) > 0 ? Number(s.amount) : '';
            const resSelect = resourceOptions.length > 1
              ? `<select data-b-res="${idx}" class="portal-input px-1.5 py-0.5 text-[10px] font-semibold flex-1 min-w-0 cursor-pointer">
                  ${resourceOptions.map((r) => `<option value="${esc(r.key)}" ${resKey === r.key ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
                </select>`
              : '';
            detailRow = `
              <div class="flex items-center gap-1.5 flex-wrap">
                ${resSelect}
                <input type="number" data-b-amt="${idx}" value="${fixedAmt}" min="0" max="999" placeholder="Según tirada" class="portal-input px-2 py-0.5 text-[10px] flex-1 min-w-[78px]" title="0 o vacío = toma el total de la tirada" />
                ${scopeToggle}
              </div>`;
          }

          return `
            <div class="portal-subpanel rounded-xl p-2 flex flex-col gap-1.5 text-[10.5px]">
              <div class="flex items-center justify-between gap-1.5">
                ${stepBadge}
                ${effectSelect}
                ${controls}
              </div>
              ${detailRow}
              ${stepNoteInput}
            </div>`;
        }
        return '';
      })
      .join('');

    box.innerHTML = blocksHtml;
    const section = this.els.customItemBlocksSection || box;
    section.classList.toggle('hidden', !blocksHtml);
    section.classList.toggle('flex', Boolean(blocksHtml));

    this.bindCreatorBlockInputs(box, stats);
  },

  bindCreatorBlockInputs(box, stats) {
    box.querySelectorAll('[data-b-label]').forEach((el) => {
      el.addEventListener('input', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bLabel)];
        if (blk) blk.label = el.value;
      });
    });
    box.querySelectorAll('[data-b-formula]').forEach((el) => {
      el.addEventListener('input', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bFormula)];
        if (blk) blk.formula = el.value;
      });
    });
    box.querySelectorAll('[data-b-msg]').forEach((el) => {
      el.addEventListener('input', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bMsg)];
        if (blk) blk.message = el.value;
      });
    });
    box.querySelectorAll('[data-b-rollkind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [iRaw, kind] = btn.dataset.bRollkind.split(':');
        const blk = this.creatorBlocks[Number(iRaw)];
        if (!blk) return;
        blk.rollKind = kind === 'request' ? 'request' : kind === 'opposed' ? 'opposed' : 'self';
        if (blk.rollKind === 'request') {
          const st = stats.find((x) => x.key === blk.statKey) || stats[1] || stats[0];
          if (!blk.label || blk.label === 'Ataque' || blk.label === 'Daño' || blk.label === 'Tirada enfrentada') {
            blk.label = st ? `Salvación de ${st.label}` : 'Tirada requerida';
          }
          if (blk.formula === '1d8' || /^1d20\+@/.test(blk.formula || '')) {
            blk.formula = '';
          }
        } else {
          if (!blk.formula) {
            blk.formula = `1d20+@${stats[0]?.alias || stats[0]?.key || 'fue'}`;
          }
          if (blk.rollKind === 'opposed') {
            if (!blk.label || blk.label === 'Ataque' || blk.label.startsWith('Salvación')) {
              blk.label = 'Tirada enfrentada';
            }
          } else if (!blk.label || blk.label.startsWith('Salvación') || blk.label === 'Tirada enfrentada') {
            blk.label = 'Ataque';
          }
        }
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-opp-stat]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bOppStat)];
        if (blk) blk.opposedStatKey = el.value;
      });
    });
    box.querySelectorAll('[data-b-opp-formula]').forEach((el) => {
      el.addEventListener('input', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bOppFormula)];
        if (blk) blk.opposedFormula = el.value;
      });
    });
    box.querySelectorAll('[data-b-formula-op]').forEach((el) => {
      el.addEventListener('click', () => {
        this.creatorFormulaOp = el.dataset.bFormulaOp === '-' ? '-' : '+';
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-add-die]').forEach((el) => {
      el.addEventListener('click', () => {
        const [iRaw, dRaw] = el.dataset.bAddDie.split(':');
        const blk = this.creatorBlocks[Number(iRaw)];
        if (!blk) return;
        const op = this.creatorFormulaOp === '-' ? '-' : '+';
        blk.formula = Selector.appendDiceToFormula(blk.formula, dRaw, op);
        this.renderCreatorBlocks();
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const [iRaw, dRaw] = el.dataset.bAddDie.split(':');
        const blk = this.creatorBlocks[Number(iRaw)];
        if (!blk) return;
        blk.formula = Selector.decrementDiceInFormula(blk.formula, dRaw);
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-add-stat]').forEach((el) => {
      el.addEventListener('click', () => {
        const [iRaw, alias] = el.dataset.bAddStat.split(':');
        const blk = this.creatorBlocks[Number(iRaw)];
        if (!blk) return;
        const op = this.creatorFormulaOp === '-' ? '-' : '+';
        blk.formula = Selector.appendStatToFormula(blk.formula, alias, op);
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-rmode]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bRmode)];
        if (!blk) return;
        blk.resultMode = el.value;
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-thr]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bThr)];
        if (blk) blk.successThreshold = Math.max(1, Math.min(100, Math.round(Number(el.value) || 6)));
      });
    });
    box.querySelectorAll('[data-b-stat]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bStat)];
        if (!blk) return;
        blk.statKey = el.value;
        const st = stats.find((x) => x.key === el.value);
        if (st) blk.label = `Salvación de ${st.label}`;
      });
    });
    box.querySelectorAll('[data-b-dc]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bDc)];
        if (blk) blk.dc = Math.max(0, Number(el.value) || 0);
      });
    });
    box.querySelectorAll('[data-b-shape]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bShape)];
        if (!blk) return;
        blk.shape = el.value;
        blk.label = el.value === 'self' ? 'A sí mismo' : el.value === 'targets' ? 'Objetivos' : 'Área';
        if (el.value === 'targets') {
          blk.maxTargets = Math.max(1, Math.round(Number(blk.maxTargets ?? blk.radiusCells) || 1));
        }
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-radius]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bRadius)];
        if (!blk) return;
        if (blk.shape === 'targets') {
          blk.maxTargets = Math.max(1, Math.min(20, Math.round(Number(el.value) || 1)));
        } else {
          blk.radiusCells = Math.max(0.5, Number(el.value) || 2);
        }
      });
    });
    box.querySelectorAll('[data-b-effect]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bEffect)];
        if (!blk) return;
        blk.effectMode = el.value;
        if (el.value === 'passive') {
          blk.passiveTarget = blk.passiveTarget || 'ac';
          if (blk.passiveValue === undefined) blk.passiveValue = 1;
          blk.label = 'Pasivo';
        } else if (blk.label === 'Pasivo') {
          blk.label = 'Modificar';
        }
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-scope]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [iRaw, scope] = btn.dataset.bScope.split(':');
        const blk = this.creatorBlocks[Number(iRaw)];
        if (!blk) return;
        blk.targetScope = scope === 'self' ? 'self' : 'targets';
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-res]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bRes)];
        if (blk) blk.resourceKey = el.value || 'hp';
      });
    });
    box.querySelectorAll('[data-b-amt]').forEach((el) => {
      el.addEventListener('input', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bAmt)];
        if (blk) blk.amount = Math.max(0, Math.min(999, Math.round(Number(el.value) || 0)));
      });
    });
    box.querySelectorAll('[data-b-cond]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bCond)];
        if (blk) blk.conditionKey = el.value;
      });
    });
    box.querySelectorAll('[data-b-pval]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bPval)];
        if (blk) blk.passiveValue = Number(el.value) || 0;
      });
    });
    box.querySelectorAll('[data-b-ptarget]').forEach((el) => {
      el.addEventListener('change', () => {
        const blk = this.creatorBlocks[Number(el.dataset.bPtarget)];
        if (blk) blk.passiveTarget = el.value;
      });
    });

    box.querySelectorAll('[data-b-up]').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.dataset.bUp);
        if (i <= 0) return;
        [this.creatorBlocks[i - 1], this.creatorBlocks[i]] = [this.creatorBlocks[i], this.creatorBlocks[i - 1]];
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-down]').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.dataset.bDown);
        if (i >= this.creatorBlocks.length - 1) return;
        [this.creatorBlocks[i], this.creatorBlocks[i + 1]] = [this.creatorBlocks[i + 1], this.creatorBlocks[i]];
        this.renderCreatorBlocks();
      });
    });
    box.querySelectorAll('[data-b-del]').forEach((el) => {
      el.addEventListener('click', () => {
        this.creatorBlocks.splice(Number(el.dataset.bDel), 1);
        this.renderCreatorBlocks();
      });
    });
  }
};
