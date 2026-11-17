/* ==========================================================================
   SHEET VIEW: FICHA DE PERSONAJE, ATRIBUTOS, HABILIDADES, RASGOS E INVENTARIO
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261116z40';
import { Service } from '../core/service.js?v=20261116z40';

export const SheetViewMethods = {
  bindSheetEvents() {
    this.els.inpSheetName.addEventListener('change', (e) => {
      const tok = Selector.getSelectedToken(Service.state);
      if (tok && e.target.value.trim()) {
        tok.name = e.target.value.trim();
        Service.notify();
      }
    });
    if (this.els.inpSheetRole) {
      this.els.inpSheetRole.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (tok) {
          tok.role = e.target.value.trim() || 'Aventurero';
          Service.notify();
        }
      });
    }
    if (this.els.inpSheetMaxHp) {
      this.els.inpSheetMaxHp.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        const nextMax = Math.max(1, Math.min(999, Number(e.target.value) || 1));
        tok.maxHp = nextMax;
        tok.hp = Math.min(tok.hp, nextMax);
        Service.notify();
      });
    }
    if (this.els.inpSheetAc) {
      this.els.inpSheetAc.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        tok.ac = Math.max(1, Math.min(40, Number(e.target.value) || 10));
        Service.notify();
      });
    }
    if (this.els.inpSheetLevel) {
      this.els.inpSheetLevel.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        tok.level = Math.max(1, Math.min(20, Number(e.target.value) || 1));
        Service.notify();
      });
    }
    if (this.els.inpSheetSpeed) {
      this.els.inpSheetSpeed.addEventListener('change', (e) => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        tok.speed = e.target.value.trim() || '30 ft';
        Service.notify();
      });
    }
    if (this.els.btnLoadDnd55Skills) {
      this.els.btnLoadDnd55Skills.addEventListener('click', () => {
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        const added = Service.loadDnd55Skills(tok.id);
        this.showActionToast(added > 0 ? `${added} habilidades D&D 5.5e cargadas.` : 'Las habilidades 5.5e ya estaban cargadas.');
      });
    }
    this.els.btnSheetHpMinus.addEventListener('click', () => {
      if (Service.state.selectedTokenId) Service.adjustTokenHp(Service.state.selectedTokenId, -1);
    });
    this.els.btnSheetHpPlus.addEventListener('click', () => {
      if (Service.state.selectedTokenId) Service.adjustTokenHp(Service.state.selectedTokenId, 1);
    });
    this.els.btnSheetRollInit.addEventListener('click', () => {
      const tok = Selector.getSelectedToken(Service.state);
      const dex = tok && tok.stats ? Number(tok.stats.dex) || 0 : 0;
      Service.rollSheetCheck(tok, `${tok ? tok.name : 'Ficha'} · Iniciativa`, dex);
      if (tok && Service.state.combat?.active && Service.state.systemConfig?.autoInitiative !== false && Service.state.dice.lastRoll) {
        Service.setTokenInitiative(tok.id, Service.state.dice.lastRoll.total);
      }
    });

    if (this.els.sheetTopTabs) {
      this.els.sheetTopTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sheet-tab]');
        if (!btn) return;
        this.activeSheetTab = btn.dataset.sheetTab;
        this.renderCharacterSheet(Service.state);
      });
    }
    const bindInlineFormToggle = (btn, form, focusEl) => {
      if (!btn || !form) return;
      btn.addEventListener('click', () => {
        const opening = form.classList.contains('hidden');
        form.classList.toggle('hidden', !opening);
        form.classList.toggle('flex', opening);
        btn.classList.toggle('owl-btn-accent', opening);
        if (opening && focusEl) focusEl.focus();
      });
    };
    bindInlineFormToggle(this.els.btnToggleSkillForm, this.els.sheetSkillForm, this.els.inpSheetSkillName);
    bindInlineFormToggle(this.els.btnToggleTraitForm, this.els.sheetTraitForm, this.els.inpSheetTraitTitle);
    this.bindSheetResourceEvents();

    if (this.els.sheetSkillForm) {
      this.els.sheetSkillForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        Service.addTokenSkill(tok.id, this.els.inpSheetSkillName.value, this.els.inpSheetSkillMod.value);
        this.els.inpSheetSkillName.value = '';
        this.els.inpSheetSkillMod.value = '0';
        this.els.sheetSkillForm.classList.add('hidden');
        this.els.sheetSkillForm.classList.remove('flex');
        this.els.btnToggleSkillForm?.classList.remove('owl-btn-accent');
      });
    }
    if (this.els.sheetTraitForm) {
      this.els.sheetTraitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tok = Selector.getSelectedToken(Service.state);
        if (!tok) return;
        Service.addTokenTrait(tok.id, this.els.inpSheetTraitTitle.value, this.els.inpSheetTraitDesc.value);
        this.els.inpSheetTraitTitle.value = '';
        this.els.inpSheetTraitDesc.value = '';
        this.els.sheetTraitForm.classList.add('hidden');
        this.els.sheetTraitForm.classList.remove('flex');
        this.els.btnToggleTraitForm?.classList.remove('owl-btn-accent');
      });
    }
  },

  renderStatCardsInto(containerEl, list, tok, sysCfg, showScores, pb) {
    if (!containerEl) return;
    const stats = tok.stats || {};
    const scores = tok.scores || {};
    const saveProfs = tok.saveProfs || {};
    containerEl.innerHTML = list
      .map(({ key, label: lbl }) => {
        const mod = Number(stats[key]) || 0;
        if (!showScores) {
          return `
            <div class="owl-subpanel rounded-xl p-1.5 flex flex-col items-center gap-1">
              <button type="button" data-roll-stat="${lbl}:${mod}" class="w-full flex flex-col items-center hover:opacity-85 pt-0.5" title="Tirar ${lbl} (${sysCfg.rollFormula || '1d20+@stat'})">
                <span class="text-[9.5px] font-semibold opacity-70 tracking-wide truncate max-w-full">${lbl}</span>
              </button>
              <input type="number" data-stat-key="${key}" value="${mod}" min="-99" max="999" class="owl-num-input w-12 text-center text-sm font-bold tabular-nums bg-black/15 rounded-md py-0.5 outline-none" title="Valor de ${lbl}" />
            </div>
          `;
        }
        const isCoreDnd = ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(key);
        const score = Number.isFinite(Number(scores[key])) ? Number(scores[key]) : 10 + mod * 2;
        const saveProf = Boolean(saveProfs[key]);
        const saveTotal = mod + (saveProf ? pb : 0);
        const modTxt = mod >= 0 ? `+${mod}` : String(mod);
        const saveTxt = saveTotal >= 0 ? `+${saveTotal}` : String(saveTotal);
        return `
          <div class="owl-subpanel rounded-xl p-1.5 flex flex-col items-center gap-1">
            <button type="button" data-roll-stat="${lbl}:${mod}" class="w-full flex flex-col items-center hover:opacity-85" title="Tirar prueba de ${lbl}">
              <span class="text-[9.5px] font-semibold opacity-60 tracking-wide">${lbl}</span>
              <strong class="text-sm font-bold tabular-nums leading-tight">${modTxt}</strong>
            </button>
            ${
              isCoreDnd
                ? `<input type="number" data-score-key="${key}" value="${score}" min="1" max="30" class="owl-num-input w-10 text-center text-[10px] font-mono-tech opacity-80 bg-black/15 rounded-md py-0.5 outline-none" title="Puntuación de ${lbl}" />`
                : `<input type="number" data-stat-key="${key}" value="${mod}" min="-99" max="999" class="owl-num-input w-10 text-center text-[10px] font-mono-tech opacity-80 bg-black/15 rounded-md py-0.5 outline-none" title="Valor de ${lbl}" />`
            }
            <div class="flex items-center justify-center gap-0.5 text-[9.5px] w-full pt-0.5 border-t" style="border-color: var(--hairline);">
              <button type="button" data-toggle-save="${key}" class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${saveProf ? 'bg-violet-500/25 text-violet-300' : 'opacity-65 hover:opacity-100 hover:bg-white/10'}" title="Competencia en salvación">
                <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="8" cy="8" r="5" />
                  ${saveProf ? '<circle cx="8" cy="8" r="2.6" fill="currentColor" stroke="none" />' : ''}
                </svg>
              </button>
              <button type="button" data-roll-save="${lbl}:${saveTotal}" class="opacity-85 hover:opacity-100 tabular-nums font-medium" title="Tirar salvación de ${lbl}">Salv ${saveTxt}</button>
            </div>
          </div>
        `;
      })
      .join('');

    containerEl.querySelectorAll('[data-roll-stat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [lbl, val] = btn.dataset.rollStat.split(':');
        Service.rollSheetCheck(tok, `${tok.name} · ${lbl}`, Number(val) || 0);
      });
    });
    containerEl.querySelectorAll('[data-score-key]').forEach((inp) => {
      inp.addEventListener('change', () => {
        Service.updateTokenScore(tok.id, inp.dataset.scoreKey, inp.value);
      });
    });
    containerEl.querySelectorAll('[data-stat-key]').forEach((inp) => {
      inp.addEventListener('change', () => {
        Service.updateTokenStat(tok.id, inp.dataset.statKey, inp.value);
      });
    });
    containerEl.querySelectorAll('[data-toggle-save]').forEach((btn) => {
      btn.addEventListener('click', () => Service.toggleTokenSaveProf(tok.id, btn.dataset.toggleSave));
    });
    containerEl.querySelectorAll('[data-roll-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [lbl, val] = btn.dataset.rollSave.split(':');
        Service.rollSheetCheck(tok, `${tok.name} · Salv. ${lbl}`, Number(val) || 0);
      });
    });
  },

  renderFixedRollButtons(containerEl, rolls, tok) {
    if (!containerEl) return;
    const esc = (s) => this.escapeHtml(s);
    containerEl.innerHTML = rolls
      .map(
        (r) =>
          `<button type="button" data-fixed-roll="${esc(r.id)}" class="owl-btn owl-subpanel px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-[11px]" title="Tirar ${esc(r.formula)}">
            <span class="font-semibold truncate">${esc(r.label)}</span>
            <span class="text-[10px] font-mono-tech opacity-70 shrink-0">${esc(r.formula)}</span>
          </button>`
      )
      .join('');
    containerEl.querySelectorAll('[data-fixed-roll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rollDef = rolls.find((r) => r.id === btn.dataset.fixedRoll);
        if (!rollDef) return;
        Service.rollSheetCheck(tok, `${tok.name} · ${rollDef.label}`, 0, rollDef.formula);
      });
    });
  },

  renderCharacterSheet(state) {
    const tok = Selector.getSelectedToken(state);
    if (!tok) {
      this.els.characterSheetDrawer.classList.remove('is-open');
      return;
    }

    this.els.sheetPortraitBox.style.backgroundColor = tok.color;
    this.els.sheetPortraitBox.innerHTML = tok.imageUrl
      ? `<img src="${tok.imageUrl}" alt="${tok.name}" class="w-full h-full object-cover" />`
      : tok.name.slice(0, 2).toUpperCase();

    if (document.activeElement !== this.els.inpSheetName) {
      this.els.inpSheetName.value = tok.name;
    }
    if (this.els.inpSheetRole && document.activeElement !== this.els.inpSheetRole) {
      this.els.inpSheetRole.value = tok.role || '';
    }
    if (this.els.lblSheetHpCur) this.els.lblSheetHpCur.textContent = String(tok.hp);
    if (this.els.inpSheetMaxHp && document.activeElement !== this.els.inpSheetMaxHp) {
      this.els.inpSheetMaxHp.value = String(tok.maxHp || 16);
    }
    const pct = tok.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((tok.hp / tok.maxHp) * 100))) : 0;
    this.els.barSheetHpFill.style.width = `${pct}%`;
    if (this.els.inpSheetAc && document.activeElement !== this.els.inpSheetAc) {
      this.els.inpSheetAc.value = String(tok.ac || 12);
    }
    const pb = Service.getProficiencyBonus(tok);
    if (this.els.inpSheetLevel && document.activeElement !== this.els.inpSheetLevel) {
      this.els.inpSheetLevel.value = String(Math.max(1, Number(tok.level) || 1));
    }
    if (this.els.lblSheetPb) this.els.lblSheetPb.textContent = `+${pb}`;
    if (this.els.inpSheetSpeed && document.activeElement !== this.els.inpSheetSpeed) {
      this.els.inpSheetSpeed.value = tok.speed || '30 ft';
    }

    const sysCfg = state.systemConfig || {};
    const sysBlocks = Array.isArray(sysCfg.sheetBlocks) ? sysCfg.sheetBlocks : null;
    const hasBlocks = Boolean(sysBlocks);
    const showHp = !hasBlocks && sysCfg.showHp !== false;
    const showDef = !hasBlocks && sysCfg.showDefense !== false;
    const showInit = !hasBlocks && sysCfg.showInit !== false;
    const showRightCard = showDef || showInit;
    if (this.els.lblSheetHpName) this.els.lblSheetHpName.textContent = sysCfg.hpLabel || 'Salud';
    if (this.els.lblSheetDefenseName) {
      this.els.lblSheetDefenseName.textContent = showDef ? (sysCfg.defenseLabel || 'Defensa · CA') : 'Turno';
    }
    this.els.sheetHpDefRow?.classList.toggle('hidden', hasBlocks || (!showHp && !showRightCard));
    this.els.sheetHpCard?.classList.toggle('hidden', !showHp);
    this.els.sheetHpCard?.classList.toggle('col-span-2', showHp && !showRightCard);
    this.els.sheetDefenseCard?.classList.toggle('hidden', !showRightCard);
    this.els.sheetDefenseCard?.classList.toggle('col-span-2', showRightCard && !showHp);
    this.els.sheetAcWrap?.classList.toggle('hidden', !showDef);
    this.els.btnSheetRollInit?.classList.toggle('hidden', !showInit);
    this.els.sheetLevelRow?.classList.toggle('hidden', hasBlocks || sysCfg.showLevelPb === false);
    this.renderSheetResources(tok);

    const showScores = sysCfg.showScores !== false;
    const stats = tok.stats || {};
    const attrDefs = Selector.getSheetStatsDef(Service.state, tok);
    const fixedRolls = Array.isArray(sysCfg.fixedRolls) ? sysCfg.fixedRolls : [];
    const sysResSchema = Array.isArray(sysCfg.resourceSchema) ? sysCfg.resourceSchema : [];
    const sysResByKey = new Map(sysResSchema.map((r) => [Selector.normalizeStatKey(r.name), r]));

    if (this.els.sheetHeaderFixedRow) {
      if (hasBlocks) {
        const hdrBlocks = sysBlocks.filter((b) => (b.tabId || 'attrs') === 'header');
        if (hdrBlocks.length) {
          this.renderSheetBlocksInto(this.els.sheetHeaderFixedRow, hdrBlocks, tok, sysCfg);
        } else {
          this.els.sheetHeaderFixedRow.innerHTML = '';
        }
      } else {
        const hdrStats = attrDefs.filter((s) => s.tabId === 'header');
        const hdrRolls = fixedRolls.filter((r) => r.tabId === 'header');
        if (hdrStats.length || hdrRolls.length) {
          this.els.sheetHeaderFixedRow.innerHTML = `
            ${hdrStats.length ? '<div class="hdr-fixed-stats grid grid-cols-3 gap-1.5 text-center"></div>' : ''}
            ${hdrRolls.length ? '<div class="hdr-fixed-rolls flex flex-wrap gap-1.5"></div>' : ''}
          `;
          if (hdrStats.length) {
            this.renderStatCardsInto(this.els.sheetHeaderFixedRow.querySelector('.hdr-fixed-stats'), hdrStats, tok, sysCfg, showScores, pb);
          }
          if (hdrRolls.length) {
            this.renderFixedRollButtons(this.els.sheetHeaderFixedRow.querySelector('.hdr-fixed-rolls'), hdrRolls, tok);
          }
        } else {
          this.els.sheetHeaderFixedRow.innerHTML = '';
        }
      }
    }

    const tabList = Selector.getSystemSheetTabs(state);
    const validTabIds = new Set(tabList.map((t) => t.id));
    const sheetTab = validTabIds.has(this.activeSheetTab) ? this.activeSheetTab : (tabList[0]?.id || 'attrs');
    this.activeSheetTab = sheetTab;
    const activeTabObj = tabList.find((t) => t.id === sheetTab) || tabList[0];
    const isInvTab = activeTabObj?.mode === 'items';
    const isFixedCustom = activeTabObj?.mode === 'fixed' && activeTabObj.id !== 'attrs';

    if (this.els.sheetTopTabs) {
      this.els.sheetTopTabs.innerHTML = tabList
        .map(
          (t) =>
            `<button type="button" data-sheet-tab="${t.id}" class="owl-seg-btn ${t.id === sheetTab ? 'is-active' : ''} truncate">${this.escapeHtml(t.label)}</button>`
        )
        .join('');
    }
    const panes = {
      attrs: this.els.sheetPaneAttrs,
      custom: this.els.sheetPaneCustom,
      skills: this.els.sheetPaneSkills,
      traits: this.els.sheetPaneTraits,
      inv: this.els.sheetPaneInv
    };
    const activePaneKey = isInvTab ? 'inv' : isFixedCustom ? 'custom' : activeTabObj?.mode === 'preset_skills' ? 'skills' : activeTabObj?.mode === 'preset_traits' ? 'traits' : 'attrs';
    Object.entries(panes).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('hidden', key !== activePaneKey);
      el.classList.toggle('flex', key === activePaneKey);
    });

    const populateFixedPane = (paneEl, targetTabObj) => {
      if (!paneEl || !targetTabObj) return;
      if (hasBlocks) {
        const tabBlocks = sysBlocks.filter((b) => (b.tabId || 'attrs') === targetTabObj.id);
        if (targetTabObj.id === 'attrs') {
          this.els.sheetStatsGrid.classList.add('hidden');
          this.els.sheetStatsGrid.innerHTML = '';
          let blkWrap = paneEl.querySelector('.sheet-attrs-extras');
          if (!blkWrap) {
            blkWrap = document.createElement('div');
            blkWrap.className = 'sheet-attrs-extras flex flex-col gap-1.5';
            paneEl.appendChild(blkWrap);
          }
          this.renderSheetBlocksInto(blkWrap, tabBlocks, tok, sysCfg, { sumTotal: targetTabObj.sumTotal });
        } else {
          this.renderSheetBlocksInto(paneEl, tabBlocks, tok, sysCfg, { sumTotal: targetTabObj.sumTotal });
        }
        return;
      }
      if (targetTabObj.id === 'attrs') this.els.sheetStatsGrid.classList.remove('hidden');
      const tabAttrs = attrDefs.filter((s) => (s.tabId || 'attrs') === targetTabObj.id);
      const tabRolls = fixedRolls.filter((r) => r.tabId === targetTabObj.id);
      const tabResources = (Array.isArray(tok.resources) ? tok.resources : []).filter((res) => {
        const def = sysResByKey.get(Selector.normalizeStatKey(res.name));
        return def && def.tabId === targetTabObj.id;
      });
      const tabSum = tabAttrs.reduce((acc, s) => acc + (Number(stats[s.key]) || 0), 0);

      let statsContainer = targetTabObj.id === 'attrs' ? this.els.sheetStatsGrid : paneEl.querySelector('.sheet-fixed-stats');
      if (targetTabObj.id === 'attrs') {
        this.renderStatCardsInto(statsContainer, tabAttrs, tok, sysCfg, showScores, pb);
        let extraWrap = paneEl.querySelector('.sheet-attrs-extras');
        if (!extraWrap) {
          extraWrap = document.createElement('div');
          extraWrap.className = 'sheet-attrs-extras flex flex-col gap-1.5';
          paneEl.appendChild(extraWrap);
        }
        extraWrap.innerHTML = `
          ${tabResources.length ? '<div class="sheet-fixed-res grid grid-cols-2 gap-1.5"></div>' : ''}
          ${tabRolls.length ? '<div class="sheet-fixed-rolls grid grid-cols-2 gap-1.5"></div>' : ''}
          ${targetTabObj.sumTotal ? `<div class="owl-subpanel rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px]"><span class="opacity-70 font-medium">Σ Suma total</span><strong class="font-bold tabular-nums text-xs">${tabSum}</strong></div>` : ''}
        `;
        if (tabResources.length) this.renderResourceCardsInto(extraWrap.querySelector('.sheet-fixed-res'), tabResources, tok, sysResByKey);
        if (tabRolls.length) this.renderFixedRollButtons(extraWrap.querySelector('.sheet-fixed-rolls'), tabRolls, tok);
      } else {
        paneEl.innerHTML = `
          ${tabAttrs.length ? '<div class="sheet-fixed-stats grid grid-cols-3 gap-1.5 text-center"></div>' : ''}
          ${tabResources.length ? '<div class="sheet-fixed-res grid grid-cols-2 gap-1.5"></div>' : ''}
          ${tabRolls.length ? '<div class="sheet-fixed-rolls grid grid-cols-2 gap-1.5"></div>' : ''}
          ${
            !tabAttrs.length && !tabResources.length && !tabRolls.length
              ? '<div class="text-[10px] opacity-55 text-center py-3">Sin campos asignados desde Opciones → Sistema.</div>'
              : ''
          }
          ${
            targetTabObj.sumTotal
              ? `<div class="owl-subpanel rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] mt-auto">
                  <span class="opacity-70 font-medium">Σ Suma total</span>
                  <strong class="font-bold tabular-nums text-xs">${tabSum}</strong>
                </div>`
              : ''
          }
        `;
        if (tabAttrs.length) this.renderStatCardsInto(paneEl.querySelector('.sheet-fixed-stats'), tabAttrs, tok, sysCfg, showScores, pb);
        if (tabResources.length) this.renderResourceCardsInto(paneEl.querySelector('.sheet-fixed-res'), tabResources, tok, sysResByKey);
        if (tabRolls.length) this.renderFixedRollButtons(paneEl.querySelector('.sheet-fixed-rolls'), tabRolls, tok);
      }
    };

    if (activeTabObj?.id === 'attrs') {
      populateFixedPane(this.els.sheetPaneAttrs, activeTabObj);
    } else if (isFixedCustom) {
      populateFixedPane(this.els.sheetPaneCustom, activeTabObj);
    }

    const esc = (s) => this.escapeHtml(s);

    if (this.els.sheetSkillsList) {
      const skills = Array.isArray(tok.skills) ? tok.skills : [];
      const attrLabels = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };
      const getSkillTotal = (sk) => {
        const base = sk.attr ? Number(stats[sk.attr]) || 0 : 0;
        const prof = Number(sk.prof) || 0;
        const profBonus = prof === 2 ? pb * 2 : prof === 1 ? pb : 0;
        return base + profBonus + (Number(sk.mod) || 0);
      };
      this.els.sheetSkillsList.innerHTML = skills.length
        ? skills
            .map((sk) => {
              const total = getSkillTotal(sk);
              const modTxt = total >= 0 ? `+${total}` : String(total);
              const prof = Number(sk.prof) || 0;
              const profSvg = prof === 2
                ? '<polygon points="8,2 14,8 8,14 2,8" fill="currentColor" />'
                : prof === 1
                  ? '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.8" /><circle cx="8" cy="8" r="2.6" fill="currentColor" />'
                  : '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.8" />';
              const profCls = prof === 2
                ? 'bg-amber-500/20 text-amber-300'
                : prof === 1
                  ? 'bg-violet-500/25 text-violet-300'
                  : 'owl-subpanel opacity-70 hover:opacity-100';
              const profTitle = prof === 2 ? 'Pericia (2×BC)' : prof === 1 ? 'Competente (+BC)' : 'Sin competencia';
              const attrTag = sk.attr ? `<span class="text-[9px] opacity-45 uppercase">${attrLabels[sk.attr] || ''}</span>` : '';
              return `
                <div data-skill-id="${sk.id}" class="group owl-list-row px-2 py-1 flex items-center justify-between gap-1.5 text-[11px]">
                  <button type="button" data-prof-skill="${sk.id}" class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${profCls}" title="${profTitle}">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 16 16">${profSvg}</svg>
                  </button>
                  <button type="button" data-roll-skill="${sk.id}" class="flex-1 min-w-0 flex items-center justify-between gap-1.5 text-left hover:opacity-90" title="Tirar 1d20 ${modTxt}">
                    <span class="font-medium truncate">${esc(sk.name)} ${attrTag}</span>
                    <span class="font-mono-tech font-semibold px-1.5 py-0.5 rounded-md owl-subpanel text-[10px] shrink-0">${modTxt}</span>
                  </button>
                  <button type="button" data-skill-menu="${sk.id}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0" title="Opciones">
                    <span class="text-xs leading-none">⋯</span>
                  </button>
                </div>
              `;
            })
            .join('')
        : `<div class="text-[10px] opacity-55 text-center py-3">Usá <b>5.5e</b> para cargar las 18 habilidades o agregá una manual.</div>`;

      this.els.sheetSkillsList.querySelectorAll('[data-prof-skill]').forEach((btn) => {
        btn.addEventListener('click', () => Service.cycleTokenSkillProf(tok.id, btn.dataset.profSkill));
      });
      this.els.sheetSkillsList.querySelectorAll('[data-roll-skill]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sk = (tok.skills || []).find((x) => x.id === btn.dataset.rollSkill);
          if (!sk) return;
          Service.rollSheetCheck(tok, `${tok.name} · ${sk.name}`, getSkillTotal(sk));
        });
      });

      const openSkillMenu = (skillId, cx, cy) => {
        const sk = (tok.skills || []).find((x) => x.id === skillId);
        if (!sk) return;
        const tot = getSkillTotal(sk);
        this.openListContextMenu(cx, cy, sk.name, 'Habilidad', [
          {
            icon: '🎲',
            label: `Tirar ${sysCfg.rollFormula || '1d20+@stat'} (${tot >= 0 ? `+${tot}` : tot})`,
            onClick: () => {
              Service.rollSheetCheck(tok, `${tok.name} · ${sk.name}`, tot);
            }
          },
          {
            icon: '🔄',
            label: 'Cambiar competencia',
            onClick: () => Service.cycleTokenSkillProf(tok.id, sk.id)
          },
          {
            icon: '🗑️',
            label: 'Quitar habilidad',
            danger: true,
            onClick: () => Service.removeTokenSkill(tok.id, sk.id)
          }
        ]);
      };

      this.els.sheetSkillsList.querySelectorAll('[data-skill-id]').forEach((row) => {
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openSkillMenu(row.dataset.skillId, e.clientX, e.clientY);
        });
      });
      this.els.sheetSkillsList.querySelectorAll('[data-skill-menu]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = btn.getBoundingClientRect();
          openSkillMenu(btn.dataset.skillMenu, r.right, r.bottom + 4);
        });
      });
    }

    if (this.els.sheetTraitsList) {
      const traits = Array.isArray(tok.traits) ? tok.traits : [];
      this.els.sheetTraitsList.innerHTML = traits.length
        ? traits
            .map(
              (tr) => `
              <div data-trait-id="${tr.id}" class="group owl-subpanel rounded-xl px-2.5 py-1.5 flex items-start justify-between gap-2 text-[11px]">
                <div class="min-w-0">
                  <div class="font-semibold text-[11px] leading-tight">${esc(tr.title)}</div>
                  ${tr.desc ? `<div class="text-[10px] opacity-70 mt-0.5 leading-snug break-words">${esc(tr.desc)}</div>` : ''}
                </div>
                <button type="button" data-trait-menu="${tr.id}" class="owl-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0" title="Opciones">
                  <span class="text-xs leading-none">⋯</span>
                </button>
              </div>
            `
            )
            .join('')
        : `<div class="text-[10px] opacity-55 text-center py-3">Agregá ventajas, talentos o notas del personaje.</div>`;

      const openTraitMenu = (traitId, cx, cy) => {
        const tr = traits.find((x) => x.id === traitId);
        if (!tr) return;
        this.openListContextMenu(cx, cy, tr.title, 'Rasgo', [
          {
            icon: '🗑️',
            label: 'Quitar rasgo',
            danger: true,
            onClick: () => Service.removeTokenTrait(tok.id, tr.id)
          }
        ]);
      };

      this.els.sheetTraitsList.querySelectorAll('[data-trait-id]').forEach((row) => {
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openTraitMenu(row.dataset.traitId, e.clientX, e.clientY);
        });
      });
      this.els.sheetTraitsList.querySelectorAll('[data-trait-menu]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = btn.getBoundingClientRect();
          openTraitMenu(btn.dataset.traitMenu, r.right, r.bottom + 4);
        });
      });
    }

    this.renderSheetInventory(tok, sheetTab, isInvTab);
  }
};
