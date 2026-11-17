/* ==========================================================================
   CONTEXT MENU VIEW: MENÚ CONTEXTUAL SEPARADO PARA TOKEN VS MAPA
   ========================================================================== */

import { COMPENDIUM_ACTORS } from '../data/compendium.js';
import { Selector } from '../core/selector.js?v=20261116z40';
import { Service } from '../core/service.js?v=20261116z40';

export const ContextMenuViewMethods = {
  openContextMenu(clientX, clientY) {
    const state = Service.state;
    const menu = this.els.contextIconMenu;
    const isTokenCtx = Boolean(this.ctxTargetTokenId);
    const tok = isTokenCtx ? state.tokens.find((t) => t.id === this.ctxTargetTokenId) : null;

    if (isTokenCtx && tok) {
      this.renderTokenContextMenu(tok, state);
    } else {
      this.renderMapContextMenu(state);
    }

    const menuHeight = isTokenCtx ? 250 : 185;
    const x = Math.min(window.innerWidth - 285, Math.max(8, clientX));
    const y = Math.min(window.innerHeight - menuHeight, Math.max(8, clientY));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('is-open');
  },

  renderTokenContextMenu(tok, state) {
    if (this.els.contextToolsRow) {
      this.els.contextToolsRow.classList.add('hidden');
      this.els.contextToolsRow.classList.remove('grid');
    }

    if (this.els.contextTokenHeader) {
      const isAlly = tok.isAlly !== false;
      this.els.contextTokenHeader.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-xl text-[11px]';
      this.els.contextTokenHeader.innerHTML = `
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${tok.color};"></span>
          <span class="font-semibold truncate max-w-[125px]">${tok.name}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0 font-mono-tech text-[10px]">
          <span class="opacity-80">HP ${tok.hp}/${tok.maxHp} · CA ${tok.ac}</span>
          <button type="button" data-ctx-focus-tok class="owl-btn owl-subpanel w-5 h-5 p-0 rounded-md" title="Centrar cámara en ficha">🎯</button>
        </div>
      `;
      const focusBtn = this.els.contextTokenHeader.querySelector('[data-ctx-focus-tok]');
      if (focusBtn) {
        focusBtn.addEventListener('click', () => {
          const vp = this.els.viewport.getBoundingClientRect();
          const z = Service.state.camera.zoom || 1;
          Service.state.camera.x = vp.width / 2 - tok.x * z;
          Service.state.camera.y = vp.height / 2 - tok.y * z;
          Service.notify({ skipVaultSave: true });
          this.hideContextMenu();
        });
      }
      this.els.contextTokenHeader.dataset.ally = isAlly ? '1' : '0';
    }

    this.els.contextDynamicRow.className = 'grid grid-cols-6 gap-1 pt-1 border-t';
    this.els.contextDynamicRow.innerHTML = `
      <button type="button" data-ctx-act="hp-minus" class="owl-subpanel owl-btn h-8 font-mono-tech font-bold text-red-400" title="-1 HP">−HP</button>
      <button type="button" data-ctx-act="hp-plus" class="owl-subpanel owl-btn h-8 font-mono-tech font-bold text-emerald-400" title="+1 HP">+HP</button>
      <button type="button" data-ctx-act="toggle-hide" class="owl-subpanel owl-btn h-8" title="${tok.hidden ? 'Mostrar ficha' : 'Ocultar ficha'}">👁️</button>
      <button type="button" data-ctx-act="dup-tok" class="owl-subpanel owl-btn h-8" title="Duplicar Ficha">⧉</button>
      <button type="button" data-ctx-act="open-sheet" class="owl-subpanel owl-btn h-8" title="Abrir Ficha">📋</button>
      <button type="button" data-ctx-act="del-tok" class="owl-subpanel owl-btn h-8 text-red-400" title="Eliminar Ficha">🗑️</button>
    `;

    this.els.contextDynamicRow.querySelectorAll('[data-ctx-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.ctxAct;
        if (act === 'hp-minus') Service.adjustTokenHp(tok.id, -1);
        else if (act === 'hp-plus') Service.adjustTokenHp(tok.id, 1);
        else if (act === 'toggle-hide') Service.toggleTokenHidden(tok.id);
        else if (act === 'dup-tok') Service.duplicateToken(tok.id);
        else if (act === 'open-sheet') Service.selectToken(tok.id, true);
        else if (act === 'del-tok') Service.deleteToken(tok.id);
        this.hideContextMenu();
      });
    });

    const activeConds = Array.isArray(tok.conditions) ? tok.conditions : [];
    const statusDefs = Selector.getSystemStatuses(state);
    const sizeVal = Number(tok.size) || 1;
    const isAlly = tok.isAlly !== false;

    this.els.contextSubOptionsRow.className = 'grid grid-cols-5 gap-1 pt-1 border-t';
    this.els.contextSubOptionsRow.innerHTML =
      statusDefs
        .map((def) => {
          const active = activeConds.includes(def.key);
          return `
            <button
              type="button"
              data-ctx-cond="${this.escapeHtml(def.key)}"
              title="${this.escapeHtml(def.label)}"
              class="owl-seg-btn h-7 p-0 rounded-lg flex items-center justify-center transition-transform ${active ? 'is-active scale-105' : 'owl-subpanel opacity-80 hover:opacity-100'}"
              style="${active ? `background:${def.color}; color:#ffffff; border-color:${def.color};` : `color:${def.color};`}"
            >${this.renderStatusSymbolSvg(def.icon, 'w-3.5 h-3.5', state)}</button>
          `;
        })
        .join('') +
      `
      <div class="col-span-5 grid grid-cols-3 gap-1 pt-1 border-t" style="border-color: var(--border-subtle);">
        <button type="button" data-ctx-extra="light" class="owl-subpanel owl-btn h-7 text-[10px] font-medium ${tok.lightRadius ? 'owl-btn-active' : ''}" title="Alternar Luz del Token (Off / 20ft / 40ft)">💡 ${tok.lightRadius ? (tok.lightRadius === 360 ? '40ft' : '20ft') : 'Luz'}</button>
        <button type="button" data-ctx-extra="aura" class="owl-subpanel owl-btn h-7 text-[10px] font-medium ${tok.auraRadius ? 'owl-btn-active' : ''}" title="Alternar Aura del Token (Off / 10ft / 15ft)">⭕ ${tok.auraRadius ? (tok.auraRadius === 135 ? '15ft' : '10ft') : 'Aura'}</button>
        <button type="button" data-ctx-extra="owner" class="owl-subpanel owl-btn h-7 text-[10px] font-medium ${tok.ownerId ? 'owl-btn-active' : ''}" title="Propiedad de ficha (Libre / Solo DJ o Reclamar)">🔑 ${tok.ownerId === 'gm' ? 'Solo DJ' : tok.ownerId ? 'Mía' : 'Libre'}</button>
      </div>
      <div class="col-span-5 grid grid-cols-5 gap-1 pt-1 border-t" style="border-color: var(--border-subtle);">
        <button type="button" data-ctx-extra="hp-m5" class="owl-subpanel owl-btn h-7 text-[10px] font-mono-tech text-red-400" title="-5 HP">-5</button>
        <button type="button" data-ctx-extra="hp-p5" class="owl-subpanel owl-btn h-7 text-[10px] font-mono-tech text-emerald-400" title="+5 HP">+5</button>
        <button type="button" data-ctx-extra="size" class="owl-subpanel owl-btn h-7 text-[10px] font-mono-tech" title="Cambiar tamaño (1x1 / 2x2 / 3x3)">${sizeVal}x${sizeVal}</button>
        <button type="button" data-ctx-extra="ally" class="owl-subpanel owl-btn h-7 text-[10px] ${isAlly ? 'text-emerald-400' : 'text-red-400'}" title="Cambiar bando (Aliado / Hostil)">${isAlly ? '🛡️' : '⚔️'}</button>
        <button type="button" data-ctx-extra="init" class="owl-subpanel owl-btn h-7 text-[10px] font-mono-tech" title="Tirar Iniciativa (${this.escapeHtml(Service.getSystemInitiativeFormula())})">Init</button>
      </div>`;

    this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-extra]').forEach((b) => {
      b.addEventListener('click', () => {
        const ex = b.dataset.ctxExtra;
        if (ex === 'light') Service.cycleTokenLight(tok.id);
        else if (ex === 'aura') Service.cycleTokenAura(tok.id);
        else if (ex === 'owner') Service.toggleTokenOwnership(tok.id);
        else if (ex === 'hp-m5') Service.adjustTokenHp(tok.id, -5);
        else if (ex === 'hp-p5') Service.adjustTokenHp(tok.id, 5);
        else if (ex === 'size') Service.cycleTokenSize(tok.id);
        else if (ex === 'ally') Service.toggleTokenAlly(tok.id);
        else if (ex === 'init') {
          Service.rollTokenInitiative(tok);
        }
        this.hideContextMenu();
      });
    });

    this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-cond]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.ctxCond;
        Service.toggleTokenCondition(tok.id, key);
        const updatedTok = Service.state.tokens.find((t) => t.id === tok.id);
        const isNowActive = Boolean(updatedTok && Array.isArray(updatedTok.conditions) && updatedTok.conditions.includes(key));
        const def = Selector.getStatusDef(Service.state, key);
        b.classList.toggle('is-active', isNowActive);
        b.classList.toggle('scale-105', isNowActive);
        b.classList.toggle('owl-subpanel', !isNowActive);
        b.classList.toggle('opacity-80', !isNowActive);
        b.style.background = isNowActive ? def.color : '';
        b.style.color = isNowActive ? '#ffffff' : def.color;
        b.style.borderColor = isNowActive ? def.color : '';
      });
    });
  },

  renderMapContextMenu(state) {
    if (this.els.contextTokenHeader) {
      this.els.contextTokenHeader.className = 'hidden';
      this.els.contextTokenHeader.innerHTML = '';
    }
    if (this.els.contextToolsRow) {
      this.els.contextToolsRow.classList.remove('hidden');
      this.els.contextToolsRow.classList.add('grid');
    }

    this.els.contextIconMenu.querySelectorAll('[data-ctx-tool]').forEach((btn) => {
      btn.classList.toggle('owl-btn-active', btn.dataset.ctxTool === state.tool);
    });

    this.els.contextDynamicRow.className = 'grid grid-cols-6 gap-1 pt-1 border-t';
    this.els.contextDynamicRow.innerHTML = `
      <button type="button" data-ctx-act="ping-here" class="owl-subpanel owl-btn h-8" title="Ping Aquí">📡</button>
      <button type="button" data-ctx-act="add-note" class="owl-subpanel owl-btn h-8" title="Fijar Nota Aquí">📌</button>
      <button type="button" data-ctx-act="spawn-here" class="owl-subpanel owl-btn h-8" title="Invocar Ficha Aquí">➕</button>
      <button type="button" data-ctx-act="toggle-dynlight" class="owl-subpanel owl-btn h-8 ${state.dynamicLighting ? 'owl-btn-active' : ''}" title="Alternar Luz Dinámica">💡</button>
      <button type="button" data-ctx-act="roll-d20" class="owl-subpanel owl-btn h-8 font-mono-tech font-bold" title="Tirar d20">d20</button>
      <button type="button" data-ctx-act="clear-fog" class="owl-subpanel owl-btn h-8" title="Limpiar Niebla">🧹</button>
    `;

    this.els.contextDynamicRow.querySelectorAll('[data-ctx-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.ctxAct;
        if (act === 'ping-here') Service.triggerPing(this.ctxWorldPos.x, this.ctxWorldPos.y);
        else if (act === 'add-note') this.openNoteModal(null, this.ctxWorldPos.x, this.ctxWorldPos.y);
        else if (act === 'spawn-here') {
          await Service.spawnActorFromTemplate(COMPENDIUM_ACTORS[0], this.ctxWorldPos.x, this.ctxWorldPos.y);
        } else if (act === 'toggle-dynlight') {
          Service.toggleDynamicLighting();
          this.showActionToast(Service.state.dynamicLighting ? '💡 Luz Dinámica activada' : '💡 Luz Dinámica apagada');
        } else if (act === 'roll-d20') Service.rollDice(20);
        else if (act === 'clear-fog') {
          Service.pushUndoSnapshot();
          Service.state.fogRects = [];
          this.clearExploredMemory();
          Service.notify({ redrawFog: true });
        }
        this.hideContextMenu();
      });
    });

    if (state.tool === 'draw') {
      const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
      this.els.contextSubOptionsRow.className = 'flex items-center justify-between gap-1 pt-1 border-t';
      this.els.contextSubOptionsRow.innerHTML = colors
        .map(
          (c) =>
            `<button type="button" data-ctx-color="${c}" class="w-6 h-6 rounded-full border-2 ${state.drawColor === c ? 'border-white scale-110' : 'border-transparent'}" style="background:${c};"></button>`
        )
        .join('');
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-color]').forEach((b) => {
        b.addEventListener('click', () => {
          Service.state.drawColor = b.dataset.ctxColor;
          Service.notify();
          this.hideContextMenu();
        });
      });
    } else if (state.tool === 'fog') {
      this.els.contextSubOptionsRow.className = 'flex items-center justify-between gap-1 pt-1 border-t';
      this.els.contextSubOptionsRow.innerHTML = `
        <button type="button" data-ctx-fog="reveal" class="owl-subpanel owl-btn flex-1 py-1 text-[11px] ${state.fogMode === 'reveal' ? 'owl-btn-active' : ''}">👁️ Revelar</button>
        <button type="button" data-ctx-fog="hide" class="owl-subpanel owl-btn flex-1 py-1 text-[11px] ${state.fogMode === 'hide' ? 'owl-btn-active' : ''}">☁️ Cubrir</button>
      `;
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-fog]').forEach((b) => {
        b.addEventListener('click', () => {
          Service.state.fogMode = b.dataset.ctxFog;
          Service.notify();
          this.hideContextMenu();
        });
      });
    } else if (state.tool === 'wall') {
      this.els.contextSubOptionsRow.className = 'flex items-center justify-between gap-1 pt-1 border-t';
      this.els.contextSubOptionsRow.innerHTML = `
        <button type="button" data-ctx-wall="wall" class="owl-subpanel owl-btn flex-1 py-1 text-[11px] ${state.wallType === 'wall' ? 'owl-btn-active' : ''}">🧱 Muro</button>
        <button type="button" data-ctx-wall="door" class="owl-subpanel owl-btn flex-1 py-1 text-[11px] ${state.wallType === 'door' ? 'owl-btn-active' : ''}">🚪 Puerta</button>
        <button type="button" data-ctx-wall="undo" class="owl-subpanel owl-btn px-2 py-1 text-[11px]" title="Deshacer último muro">↩</button>
      `;
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-wall]').forEach((b) => {
        b.addEventListener('click', () => {
          const mode = b.dataset.ctxWall;
          if (mode === 'undo') Service.removeLastWall();
          else {
            Service.state.wallType = mode;
            Service.notify();
          }
          this.hideContextMenu();
        });
      });
    } else {
      this.els.contextSubOptionsRow.className = 'hidden flex-wrap gap-1 pt-1 border-t';
    }
  },

  hideContextMenu() {
    this.els.contextIconMenu.classList.remove('is-open');
  },

  openListContextMenu(clientX, clientY, title, subtitle = '', actions = []) {
    const menu = this.els.contextIconMenu;
    if (this.els.contextToolsRow) {
      this.els.contextToolsRow.classList.add('hidden');
      this.els.contextToolsRow.classList.remove('grid');
    }
    if (this.els.contextTokenHeader) {
      this.els.contextTokenHeader.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-xl text-[11px]';
      this.els.contextTokenHeader.innerHTML = `
        <span class="font-semibold truncate max-w-[165px]">${title}</span>
        ${subtitle ? `<span class="opacity-60 text-[10px] truncate max-w-[85px]">${subtitle}</span>` : ''}
      `;
    }
    this.els.contextSubOptionsRow.className = 'hidden';
    this.els.contextSubOptionsRow.innerHTML = '';

    this.els.contextDynamicRow.className = 'flex flex-col gap-1 pt-1 border-t';
    this.els.contextDynamicRow.innerHTML = actions
      .map(
        (act, idx) => `
          <button
            type="button"
            data-list-ctx-idx="${idx}"
            class="owl-subpanel owl-btn w-full h-8 px-2.5 justify-start gap-2 text-xs ${act.danger ? 'text-red-400' : ''}"
          >
            <span>${act.icon || '•'}</span>
            <span class="truncate">${act.label}</span>
          </button>
        `
      )
      .join('');

    this.els.contextDynamicRow.querySelectorAll('[data-list-ctx-idx]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = actions[Number(btn.dataset.listCtxIdx)];
        this.hideContextMenu();
        if (item && typeof item.onClick === 'function') {
          await item.onClick();
        }
      });
    });

    const estHeight = Math.max(110, 56 + actions.length * 36);
    const x = Math.min(window.innerWidth - 285, Math.max(8, clientX));
    const y = Math.min(window.innerHeight - estHeight, Math.max(8, clientY));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('is-open');
  }
};
