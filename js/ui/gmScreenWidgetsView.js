/* ==========================================================================
   GM SCREEN WIDGETS VIEW: ÁRBITRO DE TIRADAS, PULSO DEL GRUPO, NOTAS, TABLAS, CHULETA
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261121a6';
import { Service } from '../core/service.js?v=20261121a6';

export const GmScreenWidgetsViewMethods = {
  getGmRollDraft(state) {
    const defaultThr = Number(state.systemConfig?.successThreshold) || 6;
    if (!this.gmRollDraft) {
      const stats = Selector.getSheetStatsDef(state);
      this.gmRollDraft = {
        targetMode: 'all',
        customTargetIds: [],
        statKey: stats[0]?.key || '__custom__',
        customFormula: state.systemConfig?.rollFormula?.replace(/@stat\b/gi, '0') || '1d20',
        customLabel: '',
        dc: 15,
        lowScale: 1,
        difficultyMod: 0,
        tieredMod: 0,
        poolThreshold: defaultThr,
        requiredSuccesses: 2,
        secretDc: false
      };
    }
    return this.gmRollDraft;
  },

  resolveArbiterFormula(state, draft, evalMode) {
    const stats = Selector.getSheetStatsDef(state);
    const statDef = stats.find((s) => s.key === draft.statKey) || null;
    if (!statDef || draft.statKey === '__custom__') {
      return {
        statKey: '',
        statLabel: draft.customLabel.trim() || 'Tirada solicitada',
        formula: String(draft.customFormula || '1d20').trim() || '1d20'
      };
    }
    const base = String(state.systemConfig?.rollFormula || '1d20+@stat').trim();
    let formula = base.includes('@stat')
      ? base.replace(/@stat\b/gi, `@${statDef.alias || statDef.key}`)
      : `${base}+@${statDef.alias || statDef.key}`;
    if (evalMode === 'tiered' && draft.tieredMod !== 0) {
      formula += draft.tieredMod > 0 ? `+${draft.tieredMod}` : String(draft.tieredMod);
    }
    return {
      statKey: statDef.key,
      statLabel: draft.customLabel.trim() || `Prueba de ${statDef.label}`,
      formula
    };
  },

  renderGmRollArbiterBody(state) {
    const esc = (v) => this.escapeHtml(v ?? '');
    const draft = this.getGmRollDraft(state);
    const outcome = Selector.getSystemOutcomeConfig(state);
    const isPool = state.systemConfig?.resultMode === 'success';
    const evalMode = isPool ? 'pool' : outcome.outcomeRule;
    const allies = (state.tokens || []).filter((t) => t.isAlly !== false);
    const stats = Selector.getSheetStatsDef(state);
    if (draft.statKey !== '__custom__' && !stats.some((s) => s.key === draft.statKey)) {
      draft.statKey = stats[0]?.key || '__custom__';
    }

    const chipCls = (active) =>
      `portal-btn px-2 py-0.5 rounded-full text-[10px] font-semibold ${active ? 'portal-btn-accent' : 'portal-subpanel opacity-75 hover:opacity-100'}`;

    const customTargetsRow = draft.targetMode === 'custom'
      ? `<div class="flex flex-wrap gap-1 pt-0.5">${
          allies.length
            ? allies
                .map((t) => {
                  const picked = draft.customTargetIds.includes(t.id);
                  return `<button type="button" data-arb-target-tok="${esc(t.id)}" class="${chipCls(picked)}">${esc(t.name)}</button>`;
                })
                .join('')
            : '<span class="text-[10px] opacity-55">No hay protagonistas en el mapa.</span>'
        }</div>`
      : '';

    let difficultyHtml = '';
    if (evalMode === 'pool') {
      difficultyHtml = `
        <div class="flex items-center justify-between gap-2 text-[10.5px]">
          <div class="flex items-center gap-1">
            <span class="opacity-65">Umbral ≥</span>
            <input type="number" data-arb-input="poolThreshold" min="2" max="10" value="${draft.poolThreshold}" class="portal-input w-11 px-1.5 py-0.5 text-[11px] text-center font-semibold" />
          </div>
          <div class="flex items-center gap-1">
            <span class="opacity-65">Éxitos:</span>
            ${[1, 2, 3, 5].map((n) => `<button type="button" data-arb-req-hits="${n}" class="${chipCls(draft.requiredSuccesses === n)}">${n}</button>`).join('')}
          </div>
        </div>`;
    } else if (evalMode === 'low') {
      difficultyHtml = `
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-1">
            ${[
              [1, 'Normal ×1'],
              [2, 'Difícil ÷2'],
              [5, 'Extrema ÷5']
            ]
              .map(([sc, lbl]) => `<button type="button" data-arb-low-scale="${sc}" class="${chipCls(draft.lowScale === sc)} flex-1">${lbl}</button>`)
              .join('')}
          </div>
          <div class="flex items-center justify-between gap-2 text-[10.5px]">
            <span class="opacity-65">Ajuste %</span>
            <div class="flex items-center gap-1">
              ${[-20, -10, 0, 10, 20]
                .map((m) => `<button type="button" data-arb-diff-mod="${m}" class="${chipCls(draft.difficultyMod === m)}">${m > 0 ? `+${m}` : m}</button>`)
                .join('')}
            </div>
          </div>
        </div>`;
    } else if (evalMode === 'tiered') {
      difficultyHtml = `
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10.5px] opacity-65">Mod.</span>
            <div class="flex items-center gap-1">
              ${[-2, -1, 0, 1, 2]
                .map((m) => `<button type="button" data-arb-tiered-mod="${m}" class="${chipCls(draft.tieredMod === m)}">${m > 0 ? `+${m}` : m}</button>`)
                .join('')}
            </div>
          </div>
          <div class="text-[10px] opacity-60 font-mono-tech text-center">${outcome.tieredMid - 1}− Fallo · ${outcome.tieredMid}–${outcome.tieredHigh - 1} Parcial · ${outcome.tieredHigh}+ Total</div>
        </div>`;
    } else {
      difficultyHtml = `
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1 flex-wrap">
            ${[10, 15, 20, 25, 0]
              .map((dc) => `<button type="button" data-arb-dc="${dc}" class="${chipCls(draft.dc === dc)}">${dc === 0 ? 'Libre' : `CD ${dc}`}</button>`)
              .join('')}
          </div>
          <input type="number" data-arb-input="dc" min="0" max="50" value="${draft.dc}" class="portal-input w-12 px-1.5 py-0.5 text-[11px] text-center font-semibold shrink-0" title="CD personalizada (0 = libre)" />
        </div>`;
    }

    const statOptions = [
      ...stats.map((s) => `<option value="${esc(s.key)}" ${draft.statKey === s.key ? 'selected' : ''}>${esc(s.label)} (@${esc(s.alias || s.key)})</option>`),
      `<option value="__custom__" ${draft.statKey === '__custom__' ? 'selected' : ''}>Fórmula libre...</option>`
    ].join('');

    return `
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-1 flex-wrap">
          <button type="button" data-arb-target-mode="all" class="${chipCls(draft.targetMode === 'all')}">Todos PJs (${allies.length})</button>
          <button type="button" data-arb-target-mode="selected" class="${chipCls(draft.targetMode === 'selected')}">Seleccionado</button>
          <button type="button" data-arb-target-mode="custom" class="${chipCls(draft.targetMode === 'custom')}">Elegir</button>
        </div>
        ${customTargetsRow}
        <div class="grid grid-cols-2 gap-1.5">
          <select data-arb-stat="1" class="portal-input px-2 py-1 text-[11px] font-medium">${statOptions}</select>
          <input type="text" data-arb-input="customLabel" data-gm-keep-focus="1" value="${esc(draft.customLabel)}" placeholder="Etiqueta (opcional)" class="portal-input px-2 py-1 text-[11px]" />
        </div>
        ${
          draft.statKey === '__custom__'
            ? `<input type="text" data-arb-input="customFormula" data-gm-keep-focus="1" value="${esc(draft.customFormula)}" placeholder="Ej: 1d20+2" class="portal-input px-2 py-1 text-[11px] font-mono-tech" />`
            : ''
        }
        ${difficultyHtml}
        <div class="flex items-center justify-between gap-2 pt-1 border-t" style="border-color: var(--hairline);">
          <label class="flex items-center gap-1.5 text-[10.5px] opacity-80 cursor-pointer select-none" title="Los jugadores tiran sin ver la CD ni los éxitos requeridos">
            <input type="checkbox" data-arb-secret="1" ${draft.secretDc ? 'checked' : ''} />
            <span>Dificultad secreta</span>
          </label>
          <button type="button" data-arb-send="1" class="portal-btn portal-btn-accent px-3 py-1 rounded-full text-[11px] font-semibold">Pedir tirada</button>
        </div>
      </div>
    `;
  },

  renderGmPartyPulseBody(state) {
    const esc = (v) => this.escapeHtml(v ?? '');
    const allies = (state.tokens || []).filter((t) => t.isAlly !== false);
    if (!allies.length) {
      return `<div class="text-[11px] opacity-60 text-center py-1.5">Sin protagonistas en escena.</div>`;
    }
    const preset = state.systemConfig?.preset || state.ruleset || 'dnd55';
    const showDefense = state.systemConfig?.showDefense !== false;

    return `
      <div class="flex flex-col gap-1.5">
        ${allies
          .map((tok) => {
            const hp = Math.max(0, Number(tok.hp) || 0);
            const maxHp = Math.max(1, Number(tok.maxHp) || 1);
            const pct = Math.min(100, Math.round((hp / maxHp) * 100));
            const isSel = state.selectedTokenId === tok.id;
            const conds = Array.isArray(tok.conditions) ? tok.conditions : [];
            const condIcons = conds
              .slice(0, 4)
              .map((ck) => {
                const def = Selector.getStatusDef(state, ck);
                return `<span title="${esc(def.label)}" style="color:${esc(def.color)};">${this.renderStatusSymbolSvg(def.icon, 'w-3 h-3', state)}</span>`;
              })
              .join('');
            const ppVal = 10 + (Number(tok.stats?.wis) || 0);
            const metaParts = [];
            if (showDefense) metaParts.push(`CA ${tok.ac ?? 12}`);
            if (preset === 'dnd55') metaParts.push(`PP ${ppVal}`);
            const hasImg = Boolean(tok.imageUrl);
            const avatar = hasImg
              ? `<img src="${esc(tok.imageUrl)}" alt="" class="w-full h-full object-contain" />`
              : esc(String(tok.name || '?').slice(0, 2).toUpperCase());

            return `
              <div class="rounded-xl px-2 py-1.5 flex flex-col gap-1 border transition-colors ${isSel ? 'bg-white/10' : 'bg-white/5'}" style="border-color: ${isSel ? 'var(--accent-primary)' : 'var(--hairline)'};">
                <div class="flex items-center justify-between gap-1.5">
                  <button type="button" data-pulse-select="${esc(tok.id)}" class="flex items-center gap-1.5 min-w-0 text-left flex-1">
                    <span class="w-5 h-5 ${hasImg ? '' : 'rounded-full overflow-hidden'} flex items-center justify-center text-[9px] font-bold text-white shrink-0" style="background:${hasImg ? 'transparent' : esc(tok.color || '#3b82f6')};">${avatar}</span>
                    <span class="text-xs font-semibold truncate">${esc(tok.name)}</span>
                  </button>
                  <div class="flex items-center gap-1.5 shrink-0">
                    ${condIcons ? `<div class="flex items-center gap-0.5">${condIcons}</div>` : ''}
                    ${metaParts.length ? `<span class="text-[10px] font-mono-tech opacity-70">${metaParts.join(' · ')}</span>` : ''}
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <button type="button" data-pulse-hp="${esc(tok.id)}:-1" class="portal-btn portal-subpanel w-5 h-4 p-0 rounded text-[10px] font-bold text-rose-400" title="-1 HP">−</button>
                  <div class="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
                    <div class="h-full rounded-full transition-all" style="width:${pct}%; background:${pct <= 30 ? '#ef4444' : pct <= 60 ? '#f59e0b' : '#10b981'};"></div>
                  </div>
                  <span class="text-[10px] font-mono-tech tabular-nums opacity-85 min-w-[34px] text-center">${hp}/${maxHp}</span>
                  <button type="button" data-pulse-hp="${esc(tok.id)}:1" class="portal-btn portal-subpanel w-5 h-4 p-0 rounded text-[10px] font-bold text-emerald-400" title="+1 HP">+</button>
                </div>
              </div>`;
          })
          .join('')}
      </div>
    `;
  },

  bindGmExtraWidgetEvents(content, state) {
    const draft = this.getGmRollDraft(state);

    content.querySelectorAll('[data-arb-target-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.targetMode = btn.dataset.arbTargetMode;
        this.renderGmScreen(Service.state);
      });
    });

    content.querySelectorAll('[data-arb-target-tok]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.arbTargetTok;
        if (draft.customTargetIds.includes(tid)) {
          draft.customTargetIds = draft.customTargetIds.filter((id) => id !== tid);
        } else {
          draft.customTargetIds = [...draft.customTargetIds, tid];
        }
        this.renderGmScreen(Service.state);
      });
    });

    content.querySelector('[data-arb-stat]')?.addEventListener('change', (e) => {
      draft.statKey = e.target.value;
      this.renderGmScreen(Service.state);
    });

    content.querySelectorAll('[data-arb-input]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const field = inp.dataset.arbInput;
        if (field === 'dc' || field === 'poolThreshold') {
          draft[field] = Math.max(0, Number(inp.value) || 0);
        } else {
          draft[field] = inp.value;
        }
      });
    });

    content.querySelectorAll('[data-arb-dc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.dc = Number(btn.dataset.arbDc) || 0;
        this.renderGmScreen(Service.state);
      });
    });

    content.querySelectorAll('[data-arb-req-hits]').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.requiredSuccesses = Number(btn.dataset.arbReqHits) || 1;
        this.renderGmScreen(Service.state);
      });
    });

    content.querySelectorAll('[data-arb-low-scale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.lowScale = Number(btn.dataset.arbLowScale) || 1;
        this.renderGmScreen(Service.state);
      });
    });

    content.querySelectorAll('[data-arb-diff-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.difficultyMod = Number(btn.dataset.arbDiffMod) || 0;
        this.renderGmScreen(Service.state);
      });
    });

    content.querySelectorAll('[data-arb-tiered-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.tieredMod = Number(btn.dataset.arbTieredMod) || 0;
        this.renderGmScreen(Service.state);
      });
    });

    content.querySelector('[data-arb-secret]')?.addEventListener('change', (e) => {
      draft.secretDc = Boolean(e.target.checked);
    });

    content.querySelector('[data-arb-send]')?.addEventListener('click', () => {
      const outcome = Selector.getSystemOutcomeConfig(Service.state);
      const isPool = Service.state.systemConfig?.resultMode === 'success';
      const evalMode = isPool ? 'pool' : outcome.outcomeRule;
      const allies = (Service.state.tokens || []).filter((t) => t.isAlly !== false);
      let targetTokenIds = [];
      if (draft.targetMode === 'all') {
        targetTokenIds = allies.map((t) => t.id);
      } else if (draft.targetMode === 'selected') {
        if (Service.state.selectedTokenId) targetTokenIds = [Service.state.selectedTokenId];
      } else {
        targetTokenIds = draft.customTargetIds.filter((id) => allies.some((a) => a.id === id));
      }
      if (targetTokenIds.length === 0) {
        this.showActionToast('Elige al menos una ficha objetivo para pedir la tirada.');
        return;
      }
      const resolved = this.resolveArbiterFormula(Service.state, draft, evalMode);
      Service.sendRollRequest({
        label: resolved.statLabel,
        statKey: resolved.statKey,
        formula: resolved.formula,
        dc: evalMode === 'high' ? draft.dc : 0,
        targetTokenIds,
        evalMode,
        secretDc: draft.secretDc,
        lowScale: draft.lowScale,
        difficultyMod: draft.difficultyMod,
        poolThreshold: draft.poolThreshold,
        requiredSuccesses: evalMode === 'pool' ? draft.requiredSuccesses : 0,
        resultMode: isPool ? 'success' : ''
      });
      this.showActionToast(`Tirada solicitada a ${targetTokenIds.length} ficha(s).`);
    });

    content.querySelectorAll('[data-pulse-select]').forEach((btn) => {
      btn.addEventListener('click', () => Service.selectToken(btn.dataset.pulseSelect, false));
      btn.addEventListener('dblclick', () => Service.selectToken(btn.dataset.pulseSelect, true));
    });

    content.querySelectorAll('[data-pulse-hp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tid, rawDelta] = btn.dataset.pulseHp.split(':');
        Service.adjustTokenHp(tid, Number(rawDelta) || 0);
      });
    });

    this.bindGmS4WidgetEvents(content, state);
  },

  gmNoteDraft: null,
  gmTableDraft: null,

  toggleGmNoteDraft(kind = 'note') {
    const cleanKind = kind === 'checklist' ? 'checklist' : 'note';
    if (this.gmNoteDraft && !this.gmNoteDraft.id && this.gmNoteDraft.kind === cleanKind) {
      this.gmNoteDraft = null;
    } else {
      this.gmNoteDraft = { id: '', kind: cleanKind, title: '', body: '', itemsText: '' };
    }
    this.renderGmScreen(Service.state);
  },

  cancelGmNoteDraft() {
    this.gmNoteDraft = null;
    this.renderGmScreen(Service.state);
  },

  saveGmNoteDraft() {
    const draft = this.gmNoteDraft;
    if (!draft) return null;
    const content = this.els?.gmScreenContent;
    if (content) {
      const t = content.querySelector('[data-gm-note-draft-title]');
      if (t) draft.title = t.value;
      const b = content.querySelector('[data-gm-note-draft-body]');
      if (b) draft.body = b.value;
      const it = content.querySelector('[data-gm-note-draft-items]');
      if (it) draft.itemsText = it.value;
    }
    const created = Service.addGmNote(draft.kind, draft.title);
    if (!created) return null;
    if (draft.kind === 'checklist') {
      const lines = String(draft.itemsText || '').split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) Service.addGmChecklistItem(created.id, line);
    } else if (draft.body) {
      Service.updateGmNote(created.id, { body: draft.body });
    }
    this.gmNoteDraft = null;
    this.renderGmScreen(Service.state);
    return created;
  },

  toggleGmTableDraft(tableId = '') {
    const tid = String(tableId || '');
    if (this.gmTableDraft && this.gmTableDraft.id === tid) {
      this.gmTableDraft = null;
      this.renderGmScreen(Service.state);
      return;
    }
    if (tid) {
      const gm = Selector.getGmScreenState(Service.state);
      const tbl = (gm.tables || []).find((t) => t.id === tid);
      if (!tbl) return;
      this.gmTableDraft = {
        id: tbl.id,
        title: String(tbl.title || ''),
        entriesText: (Array.isArray(tbl.entries) ? tbl.entries : []).join('\n')
      };
    } else {
      this.gmTableDraft = { id: '', title: '', entriesText: '' };
    }
    this.renderGmScreen(Service.state);
  },

  cancelGmTableDraft() {
    this.gmTableDraft = null;
    this.renderGmScreen(Service.state);
  },

  saveGmTableDraft() {
    const draft = this.gmTableDraft;
    if (!draft) return null;
    const content = this.els?.gmScreenContent;
    if (content) {
      const t = content.querySelector('[data-gm-tbl-draft-title]');
      if (t) draft.title = t.value;
      const e = content.querySelector('[data-gm-tbl-draft-entries]');
      if (e) draft.entriesText = e.value;
    }
    const entries = String(draft.entriesText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const saved = draft.id
      ? Service.updateGmTable(draft.id, { title: draft.title, entries })
      : Service.addGmTable(draft.title, entries);
    this.gmTableDraft = null;
    this.renderGmScreen(Service.state);
    return saved;
  },

  renderGmNotesBody(state, gm) {
    const esc = (v) => this.escapeHtml(v ?? '');
    const notes = Array.isArray(gm.notes) ? gm.notes : [];
    const draft = this.gmNoteDraft;
    const isDraftNote = Boolean(draft && draft.kind === 'note');
    const isDraftChk = Boolean(draft && draft.kind === 'checklist');

    const cardsHtml = notes.length
      ? notes
          .map((n) => {
            if (n.kind === 'checklist') {
              const items = (n.items || [])
                .map(
                  (it) => `
                  <div class="flex items-center justify-between gap-1.5 text-[11px]">
                    <label class="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
                      <input type="checkbox" data-gm-ci-toggle="${esc(n.id)}:${esc(it.id)}" ${it.done ? 'checked' : ''} />
                      <span class="truncate ${it.done ? 'line-through opacity-50' : ''}">${esc(it.text)}</span>
                    </label>
                    <button type="button" data-gm-ci-del="${esc(n.id)}:${esc(it.id)}" class="opacity-45 hover:opacity-100 text-[10px] shrink-0">✕</button>
                  </div>`
                )
                .join('');
              return `
                <div class="rounded-xl p-2 bg-white/5 border flex flex-col gap-1.5" style="border-color: var(--hairline);">
                  <div class="flex items-center justify-between gap-1.5">
                    <span class="text-xs font-semibold truncate">${esc(n.title)}</span>
                    <button type="button" data-gm-note-del="${esc(n.id)}" class="opacity-50 hover:opacity-100 text-[10px]" title="Eliminar">✕</button>
                  </div>
                  ${items}
                  <form data-gm-ci-form="${esc(n.id)}" class="flex items-center gap-1 pt-0.5">
                    <input type="text" data-gm-ci-input="1" placeholder="Añadir punto..." class="portal-input px-2 py-0.5 text-[10.5px] flex-1 min-w-0" />
                    <button type="submit" class="portal-btn portal-subpanel px-2 py-0.5 rounded-lg text-[10px] font-semibold">+</button>
                  </form>
                </div>`;
            }
            return `
              <div class="rounded-xl p-2 bg-white/5 border flex flex-col gap-1" style="border-color: var(--hairline);">
                <div class="flex items-center justify-between gap-1.5">
                  <span class="text-xs font-semibold truncate">${esc(n.title)}</span>
                  <button type="button" data-gm-note-del="${esc(n.id)}" class="opacity-50 hover:opacity-100 text-[10px]" title="Eliminar">✕</button>
                </div>
                <p class="text-[11px] leading-relaxed opacity-85 whitespace-pre-wrap break-words">${n.body ? esc(n.body) : '<span class="opacity-45 italic">Sin apuntes</span>'}</p>
              </div>`;
          })
          .join('')
      : `<div class="text-[11px] opacity-60 text-center py-1">Sin notas privadas aún.</div>`;

    const draftFormHtml = draft
      ? `<div class="rounded-xl p-2 bg-white/5 border flex flex-col gap-1.5" style="border-color: var(--accent-primary);">
           <input type="text" data-gm-note-draft-title="1" data-gm-keep-focus="1" value="${esc(draft.title)}" placeholder="${isDraftChk ? 'Título del checklist...' : 'Título de la nota...'}" class="portal-input px-2 py-1 text-[11px] font-semibold" />
           ${
             isDraftChk
               ? `<textarea rows="3" data-gm-note-draft-items="1" data-gm-keep-focus="1" placeholder="Un punto por línea..." class="portal-input px-2 py-1 text-[10.5px] resize-y">${esc(draft.itemsText || '')}</textarea>`
               : `<textarea rows="3" data-gm-note-draft-body="1" data-gm-keep-focus="1" placeholder="Apuntes privados del narrador..." class="portal-input px-2 py-1 text-[11px] resize-y min-h-[54px]">${esc(draft.body || '')}</textarea>`
           }
           <div class="flex items-center justify-end gap-1.5">
             <button type="button" data-gm-note-draft-cancel="1" class="portal-btn portal-subpanel px-2.5 py-0.5 rounded-lg text-[10px] font-semibold">Cancelar</button>
             <button type="button" data-gm-note-draft-save="1" class="portal-btn portal-btn-accent px-2.5 py-0.5 rounded-lg text-[10px] font-semibold">Guardar</button>
           </div>
         </div>`
      : '';

    return `
      <div class="flex flex-col gap-1.5">
        ${cardsHtml}
        ${draftFormHtml}
        <div class="flex items-center justify-between gap-1.5 pt-1 border-t" style="border-color: var(--hairline);">
          <button type="button" data-gm-note-add="note" class="portal-btn ${isDraftNote ? 'portal-btn-accent' : 'portal-subpanel'} px-2.5 py-1 rounded-lg text-[10.5px] font-medium">+ Nota</button>
          <button type="button" data-gm-note-add="checklist" class="portal-btn ${isDraftChk ? 'portal-btn-accent' : 'portal-subpanel'} px-2.5 py-1 rounded-lg text-[10.5px] font-medium">+ Checklist</button>
        </div>
      </div>
    `;
  },

  renderGmTablesBody(state, gm) {
    const esc = (v) => this.escapeHtml(v ?? '');
    const tables = Array.isArray(gm.tables) ? gm.tables : [];
    const draft = this.gmTableDraft;
    const isCreatingNew = Boolean(draft && !draft.id);

    const buildTableDraftBox = () => `<div class="flex flex-col gap-1.5 pt-1 border-t" style="border-color: var(--hairline);">
      <input type="text" data-gm-tbl-draft-title="1" data-gm-keep-focus="1" value="${esc(draft.title)}" placeholder="Nombre de la tabla..." class="portal-input px-2 py-1 text-[11px] font-semibold" />
      <textarea rows="4" data-gm-tbl-draft-entries="1" data-gm-keep-focus="1" placeholder="Una opción por línea..." class="portal-input px-2 py-1 text-[10.5px] resize-y">${esc(draft.entriesText)}</textarea>
      <div class="flex items-center justify-end gap-1.5">
        <button type="button" data-gm-tbl-draft-cancel="1" class="portal-btn portal-subpanel px-2.5 py-0.5 rounded-lg text-[10px] font-semibold">Cancelar</button>
        <button type="button" data-gm-tbl-draft-save="1" class="portal-btn portal-btn-accent px-2.5 py-0.5 rounded-lg text-[10px] font-semibold">Guardar</button>
      </div>
    </div>`;

    const listHtml = tables.length
      ? tables
          .map((tbl) => {
            const isEditing = Boolean(draft && draft.id === tbl.id);
            const entries = Array.isArray(tbl.entries) ? tbl.entries : [];
            const last = tbl.lastRoll;
            return `
              <div class="rounded-xl p-2 bg-white/5 border flex flex-col gap-1.5" style="border-color: var(--hairline);">
                <div class="flex items-center justify-between gap-1.5">
                  <span class="text-xs font-semibold truncate" title="${esc(tbl.title)}">${esc(tbl.title)} <span class="opacity-50 font-mono-tech text-[10px]">(${entries.length})</span></span>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" data-gm-tbl-roll="${esc(tbl.id)}" class="portal-btn portal-btn-accent px-2 py-0.5 rounded-full text-[10px] font-semibold">Tirar</button>
                    <button type="button" data-gm-tbl-edit="${esc(tbl.id)}" class="portal-btn ${isEditing ? 'portal-btn-accent' : 'portal-subpanel'} px-1.5 py-0.5 rounded-full text-[10px]" title="Editar entradas">✎</button>
                    <button type="button" data-gm-tbl-del="${esc(tbl.id)}" class="opacity-50 hover:opacity-100 text-[10px]" title="Eliminar">✕</button>
                  </div>
                </div>
                ${
                  last?.text
                    ? `<div class="rounded-lg px-2 py-1 bg-black/25 flex items-center justify-between gap-2 text-[11px]">
                         <span class="leading-snug"><strong class="font-mono-tech opacity-75">#${last.index}</strong> · ${esc(last.text)}</span>
                         <button type="button" data-gm-tbl-share="${esc(tbl.id)}" class="portal-btn portal-subpanel px-1.5 py-0.5 rounded-full text-[9.5px] shrink-0" title="Enviar al chat de mesa">Al chat</button>
                       </div>`
                    : ''
                }
                ${isEditing ? buildTableDraftBox() : ''}
              </div>`;
          })
          .join('')
      : `<div class="text-[11px] opacity-60 text-center py-1">Sin tablas aleatorias aún.</div>`;

    const newTableDraftHtml = isCreatingNew
      ? `<div class="rounded-xl p-2 bg-white/5 border flex flex-col gap-1.5" style="border-color: var(--accent-primary);">${buildTableDraftBox()}</div>`
      : '';

    return `
      <div class="flex flex-col gap-1.5">
        ${listHtml}
        ${newTableDraftHtml}
        <div class="flex items-center justify-end pt-1 border-t" style="border-color: var(--hairline);">
          <button type="button" data-gm-tbl-add="1" class="portal-btn ${isCreatingNew ? 'portal-btn-accent' : 'portal-subpanel'} px-2.5 py-1 rounded-lg text-[10.5px] font-medium">+ Nueva tabla</button>
        </div>
      </div>
    `;
  },

  renderGmReferenceBody(state, gm) {
    const esc = (v) => this.escapeHtml(v ?? '');
    const refs = Array.isArray(gm.references) ? gm.references : [];
    if (!refs.length) {
      return `<div class="text-[11px] opacity-60 text-center py-1">Sin tarjetas de referencia.</div>`;
    }
    if (!this.gmOpenRefIds) this.gmOpenRefIds = new Set([refs[0].id]);
    return `
      <div class="flex flex-col gap-1">
        ${refs
          .map((ref) => {
            const isOpen = this.gmOpenRefIds.has(ref.id);
            const rows = (ref.items || [])
              .map(
                (it) => `
                <div class="flex items-baseline justify-between gap-2 text-[10.5px] py-0.5 border-t" style="border-color: var(--hairline);">
                  <span class="font-semibold opacity-90 shrink-0">${esc(it.label)}</span>
                  <span class="opacity-70 text-right">${esc(it.detail)}</span>
                </div>`
              )
              .join('');
            return `
              <details data-gm-ref-id="${esc(ref.id)}" ${isOpen ? 'open' : ''} class="rounded-xl bg-white/5 border px-2 py-1.5" style="border-color: var(--hairline);">
                <summary class="text-[11px] font-semibold cursor-pointer select-none list-none flex items-center justify-between">
                  <span>${esc(ref.title)}</span>
                  <span class="opacity-50 text-[10px]">${isOpen ? '▾' : '▸'}</span>
                </summary>
                <div class="flex flex-col mt-1">${rows}</div>
              </details>`;
          })
          .join('')}
      </div>
    `;
  },

  bindGmS4WidgetEvents(content) {
    content.querySelectorAll('[data-gm-note-add]').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleGmNoteDraft(btn.dataset.gmNoteAdd));
    });
    content.querySelector('[data-gm-note-draft-cancel]')?.addEventListener('click', () => this.cancelGmNoteDraft());
    content.querySelector('[data-gm-note-draft-save]')?.addEventListener('click', () => this.saveGmNoteDraft());
    content.querySelectorAll('[data-gm-note-del]').forEach((btn) => {
      btn.addEventListener('click', () => Service.deleteGmNote(btn.dataset.gmNoteDel));
    });
    content.querySelectorAll('[data-gm-ci-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = form.querySelector('[data-gm-ci-input]');
        if (!inp?.value.trim()) return;
        Service.addGmChecklistItem(form.dataset.gmCiForm, inp.value);
      });
    });
    content.querySelectorAll('[data-gm-ci-toggle]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const [nid, cid] = chk.dataset.gmCiToggle.split(':');
        Service.toggleGmChecklistItem(nid, cid);
      });
    });
    content.querySelectorAll('[data-gm-ci-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [nid, cid] = btn.dataset.gmCiDel.split(':');
        Service.removeGmChecklistItem(nid, cid);
      });
    });

    content.querySelector('[data-gm-tbl-add]')?.addEventListener('click', () => this.toggleGmTableDraft(''));
    content.querySelector('[data-gm-tbl-draft-cancel]')?.addEventListener('click', () => this.cancelGmTableDraft());
    content.querySelector('[data-gm-tbl-draft-save]')?.addEventListener('click', () => this.saveGmTableDraft());
    content.querySelectorAll('[data-gm-tbl-roll]').forEach((btn) => {
      btn.addEventListener('click', () => Service.rollGmTable(btn.dataset.gmTblRoll));
    });
    content.querySelectorAll('[data-gm-tbl-share]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.shareGmTableResultToChat(btn.dataset.gmTblShare);
        this.showActionToast('Resultado enviado al chat de mesa.');
      });
    });
    content.querySelectorAll('[data-gm-tbl-edit]').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleGmTableDraft(btn.dataset.gmTblEdit));
    });
    content.querySelectorAll('[data-gm-tbl-del]').forEach((btn) => {
      btn.addEventListener('click', () => Service.deleteGmTable(btn.dataset.gmTblDel));
    });
    content.querySelectorAll('[data-gm-ref-id]').forEach((det) => {
      det.addEventListener('toggle', () => {
        if (!this.gmOpenRefIds) this.gmOpenRefIds = new Set();
        if (det.open) this.gmOpenRefIds.add(det.dataset.gmRefId);
        else this.gmOpenRefIds.delete(det.dataset.gmRefId);
      });
    });
  }
};
