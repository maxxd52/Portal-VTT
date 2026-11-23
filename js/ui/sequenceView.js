/* ==========================================================================
   SEQUENCE VIEW: TARJETA ÚNICA PROGRESIVA Y BANNER DE SOLICITUD ENTRANTE
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';

const SEQ_STEP_SVGS = {
  info: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  roll: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/></svg>',
  targets: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>',
  area: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>',
  roll_request: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/></svg>',
  opposed: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
  save_request: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/></svg>',
  modify: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5.5 6.2 5.5 10.5a5.5 5.5 0 1 1-11 0C6.5 9.2 12 3 12 3z"/></svg>',
  apply_hp: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5.5 6.2 5.5 10.5a5.5 5.5 0 1 1-11 0C6.5 9.2 12 3 12 3z"/></svg>',
  play: '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
};

const getStepSvg = (step) => {
  if (!step) return SEQ_STEP_SVGS.play;
  if (step.type === 'roll' && step.rollKind === 'request') return SEQ_STEP_SVGS.roll_request;
  if (step.type === 'roll' && step.rollKind === 'opposed') return SEQ_STEP_SVGS.opposed;
  return SEQ_STEP_SVGS[step.type] || SEQ_STEP_SVGS.play;
};

export const SequenceViewMethods = {
  renderSequenceUI(state) {
    this.renderSequenceWatermark(state);
    this.renderSequenceHeader(state);
    this.renderSequenceBodySlot(state);
    this.renderSequenceStepActions(state);
    this.renderIncomingRollRequestBanner(state);
  },

  renderSequenceWatermark(state) {
    const wm = this.els.sequenceWatermark;
    if (!wm) return;
    const seq = state.activeSequence;
    if (!seq) {
      wm.classList.add('hidden');
      wm.classList.remove('flex');
      wm.innerHTML = '';
      wm.style.color = '';
      return;
    }
    const iconKey = seq.itemIcon && this.itemIconDefs?.[seq.itemIcon]
      ? seq.itemIcon
      : this.getDefaultItemIcon(seq.itemKind);
    const itemColor = seq.itemColor || '#8b5cf6';
    wm.innerHTML = this.renderItemIconSvg(iconKey, 'w-28 h-28', 1.4);
    wm.style.color = itemColor;
    wm.style.opacity = '0.09';
    wm.style.transform = 'scale(1.08)';
    wm.classList.remove('hidden');
    wm.classList.add('flex');
  },

  renderSequenceHeader(state) {
    const bar = this.els.sequenceHeaderBar;
    if (!bar) return;
    const seq = state.activeSequence;
    if (!seq || !Array.isArray(seq.steps) || seq.steps.length === 0) {
      bar.classList.add('hidden');
      bar.classList.remove('flex', 'flex-wrap');
      bar.innerHTML = '';
      return;
    }

    const esc = (v) => this.escapeHtml(v || '');
    const itemColor = seq.itemColor || '#8b5cf6';
    const activePillStyle = `background: ${esc(itemColor)}; color: #ffffff; border-color: transparent; box-shadow: 0 2px 8px color-mix(in srgb, ${esc(itemColor)} 45%, transparent);`;

    const pills = [];
    if (seq.itemMessage) {
      const isInfoActive = seq.currentIndex === -1;
      pills.push(`
        <button type="button" data-seq-jump="-1" class="portal-btn h-5 px-1.5 rounded-full text-[9.5px] font-semibold gap-1 ${isInfoActive ? '' : 'portal-subpanel opacity-75 hover:opacity-100'}" ${isInfoActive ? `style="${activePillStyle}"` : ''} title="Descripción">
          ${SEQ_STEP_SVGS.info}
        </button>
      `);
    }
    seq.steps.forEach((s, idx) => {
      const isCurrent = idx === seq.currentIndex;
      const isDone = seq.currentIndex >= 0 && idx < seq.currentIndex;
      const stepIcon = getStepSvg(s);
      const stateCls = isCurrent
        ? ''
        : isDone
          ? 'portal-subpanel opacity-90'
          : 'portal-subpanel opacity-55 hover:opacity-90';
      pills.push(`
        <button type="button" data-seq-jump="${idx}" class="portal-btn h-5 px-1.5 rounded-full text-[9.5px] font-semibold gap-1 ${stateCls}" ${isCurrent ? `style="${activePillStyle}"` : ''} title="${esc(s.label || `Paso ${idx + 1}`)}">
          ${stepIcon}
          ${isCurrent ? `<span class="tabular-nums leading-none">${idx + 1}</span>` : ''}
        </button>
      `);
    });
    const stepperHtml = pills.length
      ? `<div class="flex items-center gap-1 flex-wrap justify-center">${pills.join('')}</div>`
      : '';

    if (!stepperHtml) {
      bar.classList.add('hidden');
      bar.classList.remove('flex', 'flex-wrap');
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = stepperHtml;
    bar.classList.remove('hidden');
    bar.classList.add('flex', 'flex-wrap');
    bar.querySelectorAll('[data-seq-jump]').forEach((btn) => {
      btn.addEventListener('click', () => Service.executeSequenceStep(Number(btn.dataset.seqJump)));
    });
  },

  renderSequenceBodySlot(state) {
    const slot = this.els.sequenceBodySlot;
    if (!slot) return;
    const seq = state.activeSequence;
    const activeReq = state.activeRollRequest;
    const esc = (v) => this.escapeHtml(v || '');

    if (seq && (seq.mode === 'targets' || seq.mode === 'area')) {
      const cfg = state.areaSelectConfig;
      const curStep = Array.isArray(seq.steps) && seq.currentIndex >= 0 ? seq.steps[seq.currentIndex] : null;
      const isSelfShape = curStep?.shape === 'self';
      const targets = (seq.targetTokenIds || [])
        .map((id) => (state.tokens || []).find((t) => t.id === id))
        .filter(Boolean);
      const selTok = state.selectedTokenId
        ? (state.tokens || []).find((t) => t.id === state.selectedTokenId)
        : null;
      const canAddSel = !isSelfShape && selTok && !seq.targetTokenIds.includes(selTok.id);

      let controlsHtml = '';
      if (!seq.areaConfirmed && cfg) {
        const curShape = cfg.shape || 'circle';
        if (curShape === 'targets') {
          const maxT = cfg.maxTargets || 3;
          controlsHtml = `
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              <div class="portal-subpanel rounded-full px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-mono-tech">
                <button type="button" data-area-size="-1" class="w-4 h-4 rounded-full hover:bg-white/10">−</button>
                <span>${targets.length}/${maxT} obj</span>
                <button type="button" data-area-size="1" class="w-4 h-4 rounded-full hover:bg-white/10">+</button>
              </div>
              ${targets.length > 0 ? '<button type="button" data-targets-done="1" class="portal-btn portal-btn-accent px-2.5 py-0.5 rounded-full text-[10px] font-semibold">✓ Listo</button>' : ''}
            </div>
            <div class="text-[10px] opacity-65">Toca los tokens en el mapa</div>`;
        } else {
          const isDir = curShape === 'cone' || curShape === 'line';
          const rotateBtn = isDir
            ? `<button type="button" data-area-rot="45" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[10px] font-semibold" title="Rotar 45° (también Q/E o Shift+Rueda)">↻ 45°</button>`
            : '';
          const hintText = isDir
            ? 'Clic marca · Arrastra para apuntar'
            : 'Clic para marcar';
          controlsHtml = `
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              <div class="portal-subpanel rounded-full px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-mono-tech">
                <button type="button" data-area-size="-0.5" class="w-4 h-4 rounded-full hover:bg-white/10">−</button>
                <span>${cfg.radiusCells} cas</span>
                <button type="button" data-area-size="0.5" class="w-4 h-4 rounded-full hover:bg-white/10">+</button>
              </div>
              ${rotateBtn}
            </div>
            <div class="text-[10px] opacity-65">${hintText}</div>`;
        }
      }

      const chipsHtml = targets.length
        ? `<div class="flex flex-wrap items-center justify-center gap-1">${targets
            .map(
              (t) =>
                `<span class="portal-roll-pill flex items-center gap-1 text-[10px]">${esc(t.name)}${isSelfShape ? '' : `<button type="button" data-seq-rm-tgt="${esc(t.id)}" class="opacity-65 hover:opacity-100 leading-none" title="Quitar">×</button>`}</span>`
            )
            .join('')}</div>`
        : seq.areaConfirmed
          ? '<div class="text-[10.5px] opacity-65">Ningún objetivo seleccionado.</div>'
          : '';

      const footerBtns = [];
      if (canAddSel) {
        footerBtns.push(
          `<button type="button" data-seq-add-tgt="${esc(selTok.id)}" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[10px] font-medium">+ ${esc(selTok.name)}</button>`
        );
      }
      if (seq.areaConfirmed && !isSelfShape) {
        footerBtns.push(
          `<button type="button" data-area-retry="1" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[10px] opacity-80 hover:opacity-100">↺ Remarcar</button>`
        );
      }
      const footerRow = footerBtns.length
        ? `<div class="flex items-center justify-center gap-1.5 flex-wrap">${footerBtns.join('')}</div>`
        : '';

      slot.innerHTML = `${controlsHtml}${chipsHtml}${footerRow}`;
      slot.classList.remove('hidden');
      slot.classList.add('flex');

      slot.querySelectorAll('[data-area-size]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const areaCfg = Service.state.areaSelectConfig;
          if (!areaCfg) return;
          if (areaCfg.shape === 'targets') {
            Service.updateAreaSelectConfig({ maxTargets: (areaCfg.maxTargets || 3) + Number(btn.dataset.areaSize) });
          } else {
            Service.updateAreaSelectConfig({ radiusCells: (areaCfg.radiusCells || 2) + Number(btn.dataset.areaSize) });
          }
        });
      });
      slot.querySelector('[data-targets-done]')?.addEventListener('click', () => {
        Service.finishTargetSelection();
      });
      slot.querySelector('[data-area-rot]')?.addEventListener('click', () => {
        const cur = Service.state.areaSelectConfig?.angle || 0;
        Service.updateAreaSelectConfig({ angle: cur + Math.PI / 4 });
      });
      slot.querySelector('[data-area-retry]')?.addEventListener('click', () => {
        Service.executeSequenceStep(seq.currentIndex);
      });
      slot.querySelectorAll('[data-seq-rm-tgt]').forEach((btn) => {
        btn.addEventListener('click', () => Service.toggleSequenceTarget(btn.dataset.seqRmTgt));
      });
      slot.querySelector('[data-seq-add-tgt]')?.addEventListener('click', (e) => {
        Service.toggleSequenceTarget(e.currentTarget.dataset.seqAddTgt);
      });
      return;
    }

    if (seq && (seq.mode === 'modify' || seq.mode === 'apply_hp')) {
      const curStep = Array.isArray(seq.steps) && seq.currentIndex >= 0 ? seq.steps[seq.currentIndex] : null;
      const effectMode = curStep?.effectMode || (curStep?.isHeal ? 'heal' : 'damage');
      const condKey = curStep?.conditionKey || 'confused';
      const scopeSelf = curStep?.targetScope === 'self';
      const resourceKey = String(curStep?.resourceKey || 'hp');
      const resDef = resourceKey !== 'hp'
        ? Selector.getSystemSheetBlocks(state).find((b) => b.kind === 'resource' && b.key === resourceKey)
        : null;
      const resBadge = resDef
        ? `<div class="text-[9.5px] opacity-70 text-center">Recurso: <strong>${esc(resDef.label)}</strong></div>`
        : '';
      const rawTargets = scopeSelf
        ? (seq.tokenId ? [seq.tokenId] : [])
        : ((seq.targetTokenIds && seq.targetTokenIds.length > 0)
            ? seq.targetTokenIds
            : (state.selectedTokenId ? [state.selectedTokenId] : []));
      const targets = rawTargets
        .map((id) => (state.tokens || []).find((t) => t.id === id))
        .filter(Boolean);

      const rollEntries = seq.stepResults ? Object.values(seq.stepResults) : [];
      const fixedAmt = Number(curStep?.amount) || 0;
      const amt = fixedAmt > 0 ? fixedAmt : Math.max(0, Number(seq.lastDamageTotal) || 0);
      const dmgPickerHtml = fixedAmt <= 0 && (effectMode === 'damage' || effectMode === 'heal' || effectMode === 'bonus') && rollEntries.length > 1
        ? `<div class="flex items-center justify-center gap-1 flex-wrap pb-0.5">${rollEntries
            .map((e) => {
              const active = seq.selectedDamageStep === e.stepIndex;
              return `<button type="button" data-seq-dmg-pick="${e.stepIndex}" class="portal-seg-btn portal-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-medium ${active ? 'is-active' : 'opacity-75'}">${esc(e.label)}: <strong class="tabular-nums">${e.total}</strong></button>`;
            })
            .join('')}</div>`
        : '';

      if (effectMode === 'bonus') {
        const curBarMod = Number(state.dice?.modifier) || 0;
        const barTxt = curBarMod >= 0 ? `+${curBarMod}` : String(curBarMod);
        slot.innerHTML = `
          <div class="flex flex-col items-center gap-1.5 w-full">
            ${dmgPickerHtml}
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              ${amt > 0 ? `<button type="button" data-seq-bonus="${amt}" class="portal-btn portal-btn-accent px-3 py-1 rounded-full text-[10.5px] font-semibold gap-1.5">${SEQ_STEP_SVGS.save_request}<span>Sumar +${amt} a la barra</span></button>` : '<span class="text-[10.5px] opacity-60">Sin valor de tirada</span>'}
              ${curBarMod !== 0 ? `<button type="button" data-seq-bonus-reset="1" class="portal-btn portal-subpanel px-2 py-1 rounded-full text-[10px] opacity-80">Barra ${barTxt} · ↺ 0</button>` : ''}
            </div>
          </div>`;
        slot.classList.remove('hidden');
        slot.classList.add('flex');
        slot.querySelectorAll('[data-seq-dmg-pick]').forEach((btn) => {
          btn.addEventListener('click', () => Service.selectSequenceDamageStep(Number(btn.dataset.seqDmgPick)));
        });
        slot.querySelector('[data-seq-bonus]')?.addEventListener('click', (e) => {
          Service.applySequenceBonusToBar(Number(e.currentTarget.dataset.seqBonus) || 0);
        });
        slot.querySelector('[data-seq-bonus-reset]')?.addEventListener('click', () => {
          Service.state.dice.modifier = 0;
          Service.notify({ skipVaultSave: true });
        });
        return;
      }
      const condName = Selector.getStatusDef(state, condKey).label || condKey;

      const rows = targets
        .map((t) => {
          const sv = seq.saveResults ? seq.saveResults[t.id] : null;
          let saveBadge = '';
          if (sv) {
            if (sv.opposed) {
              const ref = Number(sv.casterTotal ?? sv.dc) || 0;
              const tone = sv.total > ref ? 'text-emerald-400' : sv.total === ref ? 'text-amber-300' : 'text-rose-400';
              const mark = sv.total > ref ? ' ✓' : sv.total === ref ? ' =' : ' ✗';
              saveBadge = `<span class="text-[10px] font-mono-tech tabular-nums ${tone}">${sv.total}${mark}</span>`;
            } else {
              const passed = sv.dc > 0 ? sv.total >= sv.dc : null;
              const tone = passed === true ? 'text-emerald-400' : passed === false ? 'text-rose-400' : 'opacity-80';
              const mark = passed === true ? ' ✓' : passed === false ? ' ✗' : '';
              saveBadge = `<span class="text-[10px] font-mono-tech tabular-nums ${tone}">${sv.total}${mark}</span>`;
            }
          }

          let actionHtml = '';
          if (effectMode === 'condition') {
            const hasCond = Array.isArray(t.conditions) && t.conditions.includes(condKey);
            actionHtml = `<button type="button" data-seq-cond="${esc(t.id)}:${esc(condKey)}" class="portal-btn px-2 py-0.5 rounded-full text-[9.5px] font-semibold ${hasCond ? 'portal-btn-accent' : 'portal-subpanel'}">${hasCond ? `✓ ${esc(condName)}` : `+ ${esc(condName)}`}</button>`;
          } else if (effectMode === 'heal') {
            actionHtml = amt > 0
              ? `<button type="button" data-req-dmg="${esc(t.id)}:${amt}:heal" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-semibold text-emerald-400">+${amt}</button>`
              : '<span class="text-[10px] opacity-55">Sin valor</span>';
          } else {
            actionHtml = amt > 0
              ? `<button type="button" data-req-dmg="${esc(t.id)}:${amt}:full" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-semibold text-rose-400">−${amt}</button>
                 <button type="button" data-req-dmg="${esc(t.id)}:${amt}:half" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-semibold opacity-80">½</button>`
              : '<span class="text-[10px] opacity-55">Sin valor</span>';
          }

          return `
            <div class="flex items-center justify-between gap-2 text-[11px] py-0.5 px-1.5 rounded-lg bg-white/5">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="truncate font-medium">${esc(t.name)}</span>
                ${saveBadge}
              </div>
              <div class="flex items-center gap-1 shrink-0">${actionHtml}</div>
            </div>`;
        })
        .join('');

      let bulkHtml = '';
      if (targets.length > 1) {
        if (effectMode === 'condition') {
          bulkHtml = `<div class="flex items-center justify-end gap-1 pb-0.5"><button type="button" data-seq-all-cond="${esc(condKey)}" class="portal-btn portal-subpanel px-2.5 py-0.5 rounded-full text-[9.5px] font-semibold">Todos: ${esc(condName)}</button></div>`;
        } else if (effectMode === 'heal' && amt > 0) {
          bulkHtml = `<div class="flex items-center justify-end gap-1 pb-0.5"><button type="button" data-seq-all-dmg="${amt}:heal" class="portal-btn portal-subpanel px-2.5 py-0.5 rounded-full text-[9.5px] font-semibold text-emerald-400">Todos +${amt}</button></div>`;
        } else if (effectMode === 'damage' && amt > 0) {
          bulkHtml = `<div class="flex items-center justify-end gap-1 pb-0.5">
            <button type="button" data-seq-all-dmg="${amt}:full" class="portal-btn portal-subpanel px-2.5 py-0.5 rounded-full text-[9.5px] font-semibold text-rose-400">Todos −${amt}</button>
            <button type="button" data-seq-all-dmg="${amt}:half" class="portal-btn portal-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-semibold opacity-80">Todos ½</button>
          </div>`;
        }
      }

      slot.innerHTML = `
        <div class="flex flex-col gap-1 w-full text-left">
          ${resBadge}
          ${dmgPickerHtml}
          ${bulkHtml}
          ${rows || '<div class="text-[10.5px] opacity-65 text-center">Ningún objetivo seleccionado.</div>'}
        </div>`;
      slot.classList.remove('hidden');
      slot.classList.add('flex');

      const targetIdList = targets.map((t) => t.id);
      slot.querySelectorAll('[data-seq-all-dmg]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const [val, mode] = btn.dataset.seqAllDmg.split(':');
          Service.applySequenceResourceToAll(targetIdList, resourceKey, Number(val) || 0, mode);
        });
      });
      slot.querySelector('[data-seq-all-cond]')?.addEventListener('click', (e) => {
        Service.applySequenceConditionToAll(targetIdList, e.currentTarget.dataset.seqAllCond);
      });

      slot.querySelectorAll('[data-seq-dmg-pick]').forEach((btn) => {
        btn.addEventListener('click', () => Service.selectSequenceDamageStep(Number(btn.dataset.seqDmgPick)));
      });
      slot.querySelectorAll('[data-req-dmg]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const [tokId, val, mode] = btn.dataset.reqDmg.split(':');
          Service.applySequenceResourceToToken(tokId, resourceKey, Number(val) || 0, mode);
        });
      });
      slot.querySelectorAll('[data-seq-cond]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const [tokId, key] = btn.dataset.seqCond.split(':');
          Service.applySequenceConditionToToken(tokId, key);
        });
      });
      return;
    }

    if (activeReq) {
      const isGm = state.role === 'gm';
      const rows = (activeReq.targets || [])
        .map((tgt) => {
          const resp = activeReq.responses ? activeReq.responses[tgt.id] : null;
          const tok = (state.tokens || []).find((t) => t.id === tgt.id) || null;
          let statusHtml = isGm
            ? `<button type="button" data-gm-req-roll="${esc(tgt.id)}" class="portal-btn portal-subpanel px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold" title="Tirar por ${esc(tgt.name)}">🎲</button>`
            : '<span class="text-[10px] opacity-55 italic">⏳</span>';
          if (resp) {
            const ev = Selector.evaluateRollAgainstRequest(activeReq, resp, tok, state);
            const tone =
              ev.status === 'pass'
                ? 'text-emerald-400'
                : ev.status === 'fail'
                  ? 'text-rose-400'
                  : ev.status === 'partial'
                    ? 'text-amber-300'
                    : '';
            const mark = ev.badge ? ` ${ev.badge}` : '';
            statusHtml = `<strong class="text-xs tabular-nums ${tone}" title="${esc(ev.detail)}">${resp.total}${mark}</strong>`;
          }
          return `
            <div class="flex items-center justify-between gap-2 text-[11px] py-0.5 px-1.5 rounded-lg bg-white/5">
              <span class="truncate font-medium">${esc(tgt.name)}</span>
              <div class="flex items-center gap-1.5 shrink-0">${statusHtml}</div>
            </div>`;
        })
        .join('');

      const reqDiffLabel = activeReq.opposed
        ? `vs ${activeReq.casterName || 'Atacante'} (${activeReq.casterTotal ?? activeReq.dc})`
        : activeReq.evalMode === 'pool' && activeReq.requiredSuccesses
          ? `${activeReq.requiredSuccesses} éx. (≥${activeReq.successThreshold || 6})`
          : activeReq.evalMode === 'low'
            ? (activeReq.lowScale === 5 ? 'Extremo ÷5' : activeReq.lowScale === 2 ? 'Difícil ÷2' : 'Normal')
            : activeReq.dc
              ? `CD ${activeReq.dc}`
              : '';
      const diffBadge = reqDiffLabel
        ? `<span>${activeReq.secretDc ? '🔒 ' : ''}${esc(reqDiffLabel)}</span>`
        : '';
      const reqSvg = activeReq.opposed ? SEQ_STEP_SVGS.opposed : SEQ_STEP_SVGS.save_request;

      slot.innerHTML = `
        <div class="flex flex-col gap-1 w-full text-left">
          <div class="flex items-center justify-between text-[10px] opacity-70 px-1">
            <span class="inline-flex items-center gap-1">${reqSvg}<span>${esc(activeReq.label)}</span></span>
            ${diffBadge}
          </div>
          ${rows || '<div class="text-[10.5px] opacity-60 text-center">Sin objetivos seleccionados.</div>'}
        </div>`;
      slot.classList.remove('hidden');
      slot.classList.add('flex');
      slot.querySelectorAll('[data-gm-req-roll]').forEach((btn) => {
        btn.addEventListener('click', () => Service.resolveRollRequestTargetForGm(btn.dataset.gmReqRoll));
      });
      return;
    }

    slot.classList.add('hidden');
    slot.classList.remove('flex');
    slot.innerHTML = '';
  },

  renderSequenceStepActions(state) {
    const box = this.els.sequenceStepActions;
    if (!box) return;
    const seq = state.activeSequence;
    if (!seq || !Array.isArray(seq.steps) || seq.steps.length === 0) {
      box.classList.add('hidden');
      box.classList.remove('flex');
      box.innerHTML = '';
      return;
    }

    const nextIdx = seq.currentIndex < 0 ? 0 : seq.currentIndex + 1;
    const nextStep = seq.steps[nextIdx];
    if (!nextStep) {
      box.classList.add('hidden');
      box.classList.remove('flex');
      box.innerHTML = '';
      return;
    }

    const esc = (v) => this.escapeHtml(v || '');
    const icon = getStepSvg(nextStep);
    const label = esc(nextStep.label || 'Ejecutar paso');
    const itemColor = seq.itemColor || '#8b5cf6';
    const btnStyle = `background: ${esc(itemColor)}; color: #ffffff; border-color: transparent; box-shadow: 0 4px 12px color-mix(in srgb, ${esc(itemColor)} 38%, transparent);`;
    box.innerHTML = `
      <button type="button" data-seq-step="${nextIdx}" class="portal-btn px-3.5 py-1.5 rounded-full text-[11px] font-semibold gap-1.5" style="${btnStyle}">
        ${icon}
        <span>${label}</span>
        <span class="text-[9.5px] opacity-80 font-mono-tech tabular-nums">${nextIdx + 1}/${seq.steps.length}</span>
      </button>
    `;
    box.classList.remove('hidden');
    box.classList.add('flex');
    box.querySelector('[data-seq-step]')?.addEventListener('click', () => {
      Service.executeSequenceStep(nextIdx);
    });
  },

  renderIncomingRollRequestBanner(state) {
    const panel = this.els.sequenceFloatingPanel;
    if (!panel) return;
    const esc = (v) => this.escapeHtml(v || '');
    const pending = Array.isArray(state.pendingRollRequests) ? state.pendingRollRequests : [];

    if (pending.length === 0) {
      panel.classList.remove('is-open');
      panel.classList.add('hidden');
      panel.classList.remove('flex');
      panel.innerHTML = '';
      return;
    }

    const hasInit = pending.some((q) => q.isInitiative);
    const headerTitle = hasInit ? '⚔️ Tirada de Iniciativa' : `Tiradas pendientes (${pending.length})`;
    const headerRow = (pending.length > 1 || hasInit)
      ? `<div class="flex items-center justify-between gap-2 pb-1 border-b text-[10px]" style="border-color: var(--hairline);">
          <span class="font-semibold opacity-85 uppercase tracking-wider">${headerTitle}</span>
          ${pending.length > 1 ? `<button type="button" data-req-roll-all="1" class="portal-btn portal-btn-accent px-2.5 py-0.5 rounded-full text-[10px] font-semibold gap-1">${SEQ_STEP_SVGS.roll}<span>Tirar todos</span></button>` : ''}
        </div>`
      : '';

    panel.innerHTML = headerRow + pending
      .map(
        (req) => {
          const refLabel = req.secretDc
            ? ''
            : req.opposed
              ? ` · vs ${esc(req.casterName || 'Atacante')}: ${req.casterTotal ?? req.dc ?? 0}`
              : req.dc
                ? ` · CD ${req.dc}`
                : '';
          return `
        <div class="flex items-center justify-between gap-2 text-[11px]">
          <div class="min-w-0">
            <div class="font-semibold truncate">${esc(req.tokenName)} · ${esc(req.label)}</div>
            <div class="text-[10px] opacity-65 font-mono-tech">${esc(req.formula)}${refLabel}</div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-req-roll="${esc(req.requestId)}:${esc(req.tokenId)}" class="portal-btn portal-btn-accent px-2.5 py-1 rounded-full text-[10px] font-semibold gap-1">${SEQ_STEP_SVGS.roll}<span>Tirar</span></button>
            <button type="button" data-req-dismiss="${esc(req.requestId)}:${esc(req.tokenId)}" class="w-5 h-5 rounded-full hover:bg-white/10 text-[11px] opacity-65" title="Omitir">✕</button>
          </div>
        </div>`;
        }
      )
      .join('');

    panel.classList.remove('hidden');
    panel.classList.add('flex', 'is-open');

    panel.querySelector('[data-req-roll-all]')?.addEventListener('click', () => {
      Service.respondToAllRollRequests();
    });

    panel.querySelectorAll('[data-req-roll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [reqId, tokId] = btn.dataset.reqRoll.split(':');
        Service.respondToRollRequest(reqId, tokId);
      });
    });
    panel.querySelectorAll('[data-req-dismiss]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [reqId, tokId] = btn.dataset.reqDismiss.split(':');
        Service.dismissRollRequest(reqId, tokId);
      });
    });
  }
};
