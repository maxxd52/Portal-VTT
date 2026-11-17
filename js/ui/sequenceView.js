/* ==========================================================================
   SEQUENCE VIEW: TARJETA ÚNICA PROGRESIVA Y BANNER DE SOLICITUD ENTRANTE
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261116z39';
import { Service } from '../core/service.js?v=20261116z39';

const STEP_ICONS = {
  roll: '🎲',
  area: '🎯',
  save_request: '⚡',
  apply_hp: '🩸'
};

export const SequenceViewMethods = {
  renderSequenceUI(state) {
    this.renderSequenceHeader(state);
    this.renderSequenceBodySlot(state);
    this.renderSequenceStepActions(state);
    this.renderIncomingRollRequestBanner(state);
  },

  renderSequenceHeader(state) {
    const bar = this.els.sequenceHeaderBar;
    if (!bar) return;
    const seq = state.activeSequence;
    if (!seq || !Array.isArray(seq.steps) || seq.steps.length <= 1) {
      bar.classList.add('hidden');
      bar.classList.remove('flex');
      bar.innerHTML = '';
      return;
    }

    const dots = seq.steps
      .map((s, idx) => {
        const isCurrent = idx === seq.currentIndex;
        const isDone = idx < seq.currentIndex;
        const bg = isCurrent
          ? 'bg-violet-400 scale-125'
          : isDone
            ? 'bg-violet-400/55'
            : 'bg-white/25 hover:bg-white/45';
        return `<button type="button" data-seq-jump="${idx}" class="w-2 h-2 rounded-full transition-all ${bg}" title="${this.escapeHtml(s.label || `Paso ${idx + 1}`)}"></button>`;
      })
      .join('');

    bar.innerHTML = `
      <span class="text-[10px] font-semibold opacity-65 truncate max-w-[140px]">${this.escapeHtml(seq.itemName)}</span>
      <div class="flex items-center gap-1.5">${dots}</div>
      <span class="text-[10px] opacity-55 tabular-nums">${seq.currentIndex + 1}/${seq.steps.length}</span>
    `;
    bar.classList.remove('hidden');
    bar.classList.add('flex');
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

    if (seq && seq.mode === 'area') {
      const cfg = state.areaSelectConfig;
      const targets = (seq.targetTokenIds || [])
        .map((id) => (state.tokens || []).find((t) => t.id === id))
        .filter(Boolean);
      const selTok = state.selectedTokenId
        ? (state.tokens || []).find((t) => t.id === state.selectedTokenId)
        : null;
      const canAddSel = selTok && !seq.targetTokenIds.includes(selTok.id);

      let controlsHtml = '';
      if (!seq.areaConfirmed && cfg) {
        const curShape = cfg.shape || 'circle';
        if (curShape === 'targets') {
          const maxT = cfg.maxTargets || 3;
          controlsHtml = `
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              <div class="owl-subpanel rounded-full px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-mono-tech">
                <button type="button" data-area-size="-1" class="w-4 h-4 rounded-full hover:bg-white/10">−</button>
                <span>${targets.length}/${maxT} obj</span>
                <button type="button" data-area-size="1" class="w-4 h-4 rounded-full hover:bg-white/10">+</button>
              </div>
              ${targets.length > 0 ? '<button type="button" data-targets-done="1" class="owl-btn owl-btn-accent px-2.5 py-0.5 rounded-full text-[10px] font-semibold">✓ Listo</button>' : ''}
            </div>
            <div class="text-[10px] opacity-65">Tocá los tokens en el mapa</div>`;
        } else {
          const isDir = curShape === 'cone' || curShape === 'line';
          const rotateBtn = isDir
            ? `<button type="button" data-area-rot="45" class="owl-btn owl-subpanel px-2 py-0.5 rounded-full text-[10px] font-semibold" title="Rotar 45° (también Q/E o Shift+Rueda)">↻ 45°</button>`
            : '';
          const hintText = isDir
            ? 'Clic marca · Arrastrá para apuntar'
            : 'Clic para marcar';
          controlsHtml = `
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              <div class="owl-subpanel rounded-full px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-mono-tech">
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
                `<span class="owl-roll-pill flex items-center gap-1 text-[10px]">${esc(t.name)}<button type="button" data-seq-rm-tgt="${esc(t.id)}" class="opacity-65 hover:opacity-100 leading-none" title="Quitar">×</button></span>`
            )
            .join('')}</div>`
        : seq.areaConfirmed
          ? '<div class="text-[10.5px] opacity-65">Ningún objetivo seleccionado.</div>'
          : '';

      const footerBtns = [];
      if (canAddSel) {
        footerBtns.push(
          `<button type="button" data-seq-add-tgt="${esc(selTok.id)}" class="owl-btn owl-subpanel px-2 py-0.5 rounded-full text-[10px] font-medium">+ ${esc(selTok.name)}</button>`
        );
      }
      if (seq.areaConfirmed) {
        footerBtns.push(
          `<button type="button" data-area-retry="1" class="owl-btn owl-subpanel px-2 py-0.5 rounded-full text-[10px] opacity-80 hover:opacity-100">↺ Remarcar</button>`
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

    if (seq && seq.mode === 'apply_hp') {
      const curStep = Array.isArray(seq.steps) && seq.currentIndex >= 0 ? seq.steps[seq.currentIndex] : null;
      const effectMode = curStep?.effectMode || (curStep?.isHeal ? 'heal' : 'damage');
      const condKey = curStep?.conditionKey || 'confused';
      const rawTargets = (seq.targetTokenIds && seq.targetTokenIds.length > 0)
        ? seq.targetTokenIds
        : (state.selectedTokenId ? [state.selectedTokenId] : []);
      const targets = rawTargets
        .map((id) => (state.tokens || []).find((t) => t.id === id))
        .filter(Boolean);

      const rollEntries = seq.stepResults ? Object.values(seq.stepResults) : [];
      const amt = Math.max(0, Number(curStep?.amount) || Number(seq.lastDamageTotal) || 0);
      const dmgPickerHtml = (effectMode === 'damage' || effectMode === 'heal' || effectMode === 'bonus') && rollEntries.length > 1
        ? `<div class="flex items-center justify-center gap-1 flex-wrap pb-0.5">${rollEntries
            .map((e) => {
              const active = seq.selectedDamageStep === e.stepIndex;
              return `<button type="button" data-seq-dmg-pick="${e.stepIndex}" class="owl-seg-btn owl-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-medium ${active ? 'is-active' : 'opacity-75'}">${esc(e.label)}: <strong class="tabular-nums">${e.total}</strong></button>`;
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
              ${amt > 0 ? `<button type="button" data-seq-bonus="${amt}" class="owl-btn owl-btn-accent px-3 py-1 rounded-full text-[10.5px] font-semibold">⚡ Sumar +${amt} a la barra</button>` : '<span class="text-[10.5px] opacity-60">Sin valor de tirada</span>'}
              ${curBarMod !== 0 ? `<button type="button" data-seq-bonus-reset="1" class="owl-btn owl-subpanel px-2 py-1 rounded-full text-[10px] opacity-80">Barra ${barTxt} · ↺ 0</button>` : ''}
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
            const passed = sv.dc > 0 ? sv.total >= sv.dc : null;
            const tone = passed === true ? 'text-emerald-400' : passed === false ? 'text-rose-400' : 'opacity-80';
            const mark = passed === true ? ' ✓' : passed === false ? ' ✗' : '';
            saveBadge = `<span class="text-[10px] font-mono-tech tabular-nums ${tone}">${sv.total}${mark}</span>`;
          }

          let actionHtml = '';
          if (effectMode === 'condition') {
            const hasCond = Array.isArray(t.conditions) && t.conditions.includes(condKey);
            actionHtml = `<button type="button" data-seq-cond="${esc(t.id)}:${esc(condKey)}" class="owl-btn px-2 py-0.5 rounded-full text-[9.5px] font-semibold ${hasCond ? 'owl-btn-accent' : 'owl-subpanel'}">${hasCond ? `✓ ${esc(condName)}` : `+ ${esc(condName)}`}</button>`;
          } else if (effectMode === 'heal') {
            actionHtml = amt > 0
              ? `<button type="button" data-req-dmg="${esc(t.id)}:${amt}:heal" class="owl-btn owl-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-semibold text-emerald-400">+${amt}</button>`
              : '<span class="text-[10px] opacity-55">Sin valor</span>';
          } else {
            actionHtml = amt > 0
              ? `<button type="button" data-req-dmg="${esc(t.id)}:${amt}:full" class="owl-btn owl-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-semibold text-rose-400">−${amt}</button>
                 <button type="button" data-req-dmg="${esc(t.id)}:${amt}:half" class="owl-btn owl-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-semibold opacity-80">½</button>`
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
          bulkHtml = `<div class="flex items-center justify-end gap-1 pb-0.5"><button type="button" data-seq-all-cond="${esc(condKey)}" class="owl-btn owl-subpanel px-2.5 py-0.5 rounded-full text-[9.5px] font-semibold">Todos: ${esc(condName)}</button></div>`;
        } else if (effectMode === 'heal' && amt > 0) {
          bulkHtml = `<div class="flex items-center justify-end gap-1 pb-0.5"><button type="button" data-seq-all-dmg="${amt}:heal" class="owl-btn owl-subpanel px-2.5 py-0.5 rounded-full text-[9.5px] font-semibold text-emerald-400">Todos +${amt}</button></div>`;
        } else if (effectMode === 'damage' && amt > 0) {
          bulkHtml = `<div class="flex items-center justify-end gap-1 pb-0.5">
            <button type="button" data-seq-all-dmg="${amt}:full" class="owl-btn owl-subpanel px-2.5 py-0.5 rounded-full text-[9.5px] font-semibold text-rose-400">Todos −${amt}</button>
            <button type="button" data-seq-all-dmg="${amt}:half" class="owl-btn owl-subpanel px-2 py-0.5 rounded-full text-[9.5px] font-semibold opacity-80">Todos ½</button>
          </div>`;
        }
      }

      slot.innerHTML = `
        <div class="flex flex-col gap-1 w-full text-left">
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
          Service.applySequenceHpToAll(targetIdList, Number(val) || 0, mode);
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
          Service.applySequenceHpToToken(tokId, Number(val) || 0, mode);
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
      const rows = (activeReq.targets || [])
        .map((tgt) => {
          const resp = activeReq.responses ? activeReq.responses[tgt.id] : null;
          let statusHtml = '<span class="text-[10px] opacity-55 italic">⏳</span>';
          if (resp) {
            const passed = activeReq.dc > 0 ? resp.total >= activeReq.dc : null;
            const tone = passed === true ? 'text-emerald-400' : passed === false ? 'text-rose-400' : '';
            const mark = passed === true ? ' ✓' : passed === false ? ' ✗' : '';
            statusHtml = `<strong class="text-xs tabular-nums ${tone}">${resp.total}${mark}</strong>`;
          }
          return `
            <div class="flex items-center justify-between gap-2 text-[11px] py-0.5 px-1.5 rounded-lg bg-white/5">
              <span class="truncate font-medium">${esc(tgt.name)}</span>
              <div class="flex items-center gap-1.5 shrink-0">${statusHtml}</div>
            </div>`;
        })
        .join('');

      slot.innerHTML = `
        <div class="flex flex-col gap-1 w-full text-left">
          <div class="flex items-center justify-between text-[10px] opacity-70 px-1">
            <span>⚡ ${esc(activeReq.label)}</span>
            ${activeReq.dc ? `<span>CD ${activeReq.dc}</span>` : ''}
          </div>
          ${rows || '<div class="text-[10.5px] opacity-60 text-center">Sin objetivos seleccionados.</div>'}
        </div>`;
      slot.classList.remove('hidden');
      slot.classList.add('flex');
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
    if (!seq || !Array.isArray(seq.steps) || seq.currentIndex < 0) {
      box.classList.add('hidden');
      box.classList.remove('flex');
      box.innerHTML = '';
      return;
    }

    const nextIdx = seq.currentIndex + 1;
    const nextStep = seq.steps[nextIdx];
    if (!nextStep) {
      box.classList.add('hidden');
      box.classList.remove('flex');
      box.innerHTML = '';
      return;
    }

    const icon = STEP_ICONS[nextStep.type] || '▶';
    const label = this.escapeHtml(nextStep.label || 'Siguiente paso');
    box.innerHTML = `
      <button type="button" data-seq-step="${nextIdx}" class="owl-btn owl-btn-accent px-3 py-1 rounded-full text-[10.5px] font-semibold">
        ${icon} ${label}
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
      panel.classList.add('hidden');
      panel.classList.remove('flex');
      panel.innerHTML = '';
      return;
    }

    panel.innerHTML = pending
      .map(
        (req) => `
        <div class="flex items-center justify-between gap-2 text-[11px]">
          <div class="min-w-0">
            <div class="font-semibold truncate">${esc(req.tokenName)} · ${esc(req.label)}</div>
            <div class="text-[10px] opacity-65 font-mono-tech">${esc(req.formula)}${req.dc ? ` · CD ${req.dc}` : ''}</div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-req-roll="${esc(req.requestId)}:${esc(req.tokenId)}" class="owl-btn owl-btn-accent px-2.5 py-1 rounded-full text-[10px] font-semibold">🎲 Tirar</button>
            <button type="button" data-req-dismiss="${esc(req.requestId)}:${esc(req.tokenId)}" class="w-5 h-5 rounded-full hover:bg-white/10 text-[11px] opacity-65" title="Omitir">✕</button>
          </div>
        </div>`
      )
      .join('');

    panel.classList.remove('hidden');
    panel.classList.add('flex');

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
