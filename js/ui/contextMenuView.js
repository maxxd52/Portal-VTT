/* ==========================================================================
   CONTEXT MENU VIEW: APPLE-STYLE UNIFIED CONTEXTUAL MENU ENGINE
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261125a1';
import { Service } from '../core/service.js?v=20261125a1';
import {
  AMBIENT_LIGHT_META,
  MAP_LIGHT_ANIMATION_META,
  MAP_LIGHT_ANIMATIONS,
  MAP_LIGHT_TONE_META,
  MAP_LIGHT_TONES,
  formatDistance,
  resolveTokenDarkvisionMeters,
  resolveTokenLightMeters,
  stepDistanceMeters
} from '../utils/lightingModel.js?v=20261125a1';
import {
  computeContextMenuPosition,
  buildDiceDieMenuSpec,
  buildDiceBarMenuSpec,
  buildMapMenuSpec,
  buildMapLightMenuSpec,
  buildTokenMenuSpec,
  buildMultiTokenMenuSpec,
  buildWallMenuSpec,
  parseHpInputExpression,
  stepPresetValue
} from '../utils/contextMenuModel.js?v=20261125a1';
import { WEATHER_META, normalizeWeatherType } from '../utils/weatherEngine.js?v=20261125a1';
import { renderUiLineIcon, hasUiLineIcon } from '../utils/uiIcons.js?v=20261125a1';

export const ContextMenuViewMethods = {
  positionContextMenu(clientX, clientY) {
    const menu = this.els.contextIconMenu;
    if (!menu) return;
    const scale = typeof Service.getUiScale === 'function' ? Service.getUiScale() : 1;
    // Measure actual rendered size before clamping/flipping
    const menuWidth = menu.offsetWidth || 248;
    const menuHeight = menu.offsetHeight || 190;
    const pos = computeContextMenuPosition({
      clientX,
      clientY,
      menuWidth,
      menuHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scale
    });
    menu.style.left = `${pos.left}px`;
    menu.style.top = `${pos.top}px`;
    menu.style.transformOrigin = pos.origin;
    menu.classList.add('is-open');
  },

  renderContextMenuSections(container, sections = [], onAction) {
    const safeSections = (Array.isArray(sections) ? sections : []).filter((s) => Array.isArray(s) && s.length > 0);
    const itemsFlat = [];
    const htmlParts = [];

    safeSections.forEach((sec, sIdx) => {
      if (sIdx > 0) htmlParts.push('<div class="portal-ctx-sep" role="separator"></div>');
      sec.forEach((item) => {
        const idx = itemsFlat.length;
        itemsFlat.push(item);
        const dangerCls = item.danger ? ' is-danger' : '';
        const rightMeta = [];
        if (item.value) rightMeta.push(`<span>${this.escapeHtml(String(item.value))}</span>`);
        if (item.shortcut) rightMeta.push(`<span class="portal-ctx-shortcut">${this.escapeHtml(String(item.shortcut))}</span>`);
        if (item.checked) rightMeta.push('<span class="portal-ctx-check" aria-hidden="true">✓</span>');
        htmlParts.push(`
          <button
            type="button"
            role="menuitem"
            data-ctx-item-idx="${idx}"
            class="portal-ctx-item${dangerCls}"
            ${item.title ? `title="${this.escapeHtml(item.title)}"` : ''}
          >
            <span class="portal-ctx-item-left">
              <span class="portal-ctx-icon" aria-hidden="true">${hasUiLineIcon(item.icon) ? renderUiLineIcon(item.icon, 'w-3.5 h-3.5') : this.escapeHtml(item.icon || '•')}</span>
              <span class="portal-ctx-label">${this.escapeHtml(item.label || '')}</span>
            </span>
            ${rightMeta.length > 0 ? `<span class="portal-ctx-meta">${rightMeta.join('')}</span>` : ''}
          </button>
        `);
      });
    });

    container.className = 'portal-ctx-list pt-1 border-t';
    container.style.borderColor = 'var(--hairline)';
    container.innerHTML = htmlParts.join('');

    container.querySelectorAll('[data-ctx-item-idx]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = itemsFlat[Number(btn.dataset.ctxItemIdx)];
        if (!item) return;
        if (!item.keepOpen) this.hideContextMenu();
        if (typeof item.onClick === 'function') {
          await item.onClick();
        } else if (typeof onAction === 'function') {
          await onAction(item.id, item);
        }
      });
    });
  },

  openContextMenu(clientX, clientY) {
    this._lastCtxClientPos = { x: clientX, y: clientY };
    const state = Service.state;
    const isTokenCtx = Boolean(this.ctxTargetTokenId);
    const tok = isTokenCtx ? state.tokens.find((t) => t.id === this.ctxTargetTokenId) : null;

    if (isTokenCtx && tok) {
      this.renderTokenContextMenu(tok, state);
    } else {
      this.renderMapContextMenu(state);
    }

    this.positionContextMenu(clientX, clientY);
  },

  renderTokenContextMenu(tok, state) {
    if (this.els.contextToolsRow) {
      this.els.contextToolsRow.classList.add('hidden');
      this.els.contextToolsRow.classList.remove('grid');
    }

    const isAlly = tok.isAlly !== false;
    const maxHp = Math.max(1, Number(tok.maxHp) || 1);
    const curHp = Math.max(0, Math.min(maxHp, Number(tok.hp) || 0));
    const hpPct = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));
    const hpFillColor = hpPct <= 20 ? '#ef4444' : hpPct <= 50 ? '#f59e0b' : '#10b981';

    if (this.els.contextTokenHeader) {
      this.els.contextTokenHeader.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-xl text-[11px]';
      this.els.contextTokenHeader.innerHTML = `
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${this.escapeHtml(tok.color || '#8b5cf6')};"></span>
          <span class="font-semibold truncate max-w-[130px]">${this.escapeHtml(tok.name)}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0 font-mono-tech text-[10px]">
          <span class="opacity-75">CA ${tok.ac}</span>
          <button type="button" data-ctx-focus-tok class="portal-btn portal-subpanel w-5 h-5 p-0 rounded-md flex items-center justify-center" title="Centrar cámara en ficha">${renderUiLineIcon('crosshair', 'w-3 h-3')}</button>
        </div>
      `;
      const focusBtn = this.els.contextTokenHeader.querySelector('[data-ctx-focus-tok]');
      if (focusBtn) {
        focusBtn.addEventListener('click', () => {
          this.centerCameraOnToken(tok);
          this.hideContextMenu();
        });
      }
      this.els.contextTokenHeader.dataset.ally = isAlly ? '1' : '0';
    }

    const visionCfg = Selector.getSystemVisionConfig(state);
    const lightMeters = resolveTokenLightMeters(tok);
    const spec = buildTokenMenuSpec({ role: state.role, token: tok });

    const handleTokenAction = (act) => {
      if (act === 'open-sheet') Service.selectToken(tok.id, true);
      else if (act === 'toggle-hide') Service.toggleTokenHidden(tok.id);
      else if (act === 'dup-tok') Service.duplicateToken(tok.id);
      else if (act === 'del-tok') Service.deleteToken(tok.id);
    };

    const activeConds = Array.isArray(tok.conditions) ? tok.conditions : [];
    const statusDefs = Selector.getSystemStatuses(state);
    const isGm = state.role === 'gm';
    const curSize = Math.max(1, Math.min(4, Math.round(Number(tok.size) || 1)));
    const curAura = Number(tok.auraRadius) || 0;
    const unit = visionCfg.distanceUnit || 'm';
    const dvMeters = resolveTokenDarkvisionMeters(tok);
    const tpl = tok.actorKey
      ? (state.customActors || []).find((a) => a && a.key === tok.actorKey)
      : null;
    const baseSize = Math.max(1, Math.min(4, Math.round(Number(tpl?.size) || 1)));
    const baseLight = Math.max(0, Math.min(60, Number(tpl?.lightMeters) || 0));
    const baseDv = resolveTokenDarkvisionMeters(tpl);
    const hasTempOverride =
      (isGm && curSize !== baseSize) ||
      Math.abs(lightMeters - baseLight) > 0.05 ||
      Math.abs(dvMeters - baseDv) > 0.05;

    const sizeSteps = [1, 2, 3, 4];
    const auraSteps = [0, 90, 135];

    const lightValTxt = lightMeters > 0 ? formatDistance(lightMeters, unit) : 'Off';
    const dvValTxt = dvMeters > 0 ? formatDistance(dvMeters, unit) : 'Off';
    const auraValTxt = curAura === 135 ? '15 ft' : curAura === 90 ? '10 ft' : curAura > 0 ? `${curAura}px` : 'Off';

    const triLeft = '<svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><polygon points="10.5,3.5 4.5,8 10.5,12.5"/></svg>';
    const triRight = '<svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><polygon points="5.5,3.5 11.5,8 5.5,12.5"/></svg>';
    const renderStepper = (propKey, iconKey, label, valTxt, stepTitle = '') => `
      <div class="portal-subpanel rounded-xl px-2 py-1.5 flex flex-col gap-1">
        <span class="opacity-75 font-medium flex items-center gap-1.5 text-[10px] leading-none">
          ${renderUiLineIcon(iconKey, 'w-3 h-3 shrink-0')}
          <span class="truncate">${label}</span>
        </span>
        <div class="flex items-center justify-between gap-1">
          <button type="button" data-ctx-step="${propKey}" data-ctx-dir="-1" class="portal-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-70 hover:opacity-100" aria-label="Reducir ${label}" ${stepTitle ? `title="${stepTitle}"` : ''}>${triLeft}</button>
          <span class="font-mono-tech text-[10px] font-semibold tabular-nums select-none truncate">${this.escapeHtml(valTxt)}</span>
          <button type="button" data-ctx-step="${propKey}" data-ctx-dir="1" class="portal-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-70 hover:opacity-100" aria-label="Aumentar ${label}" ${stepTitle ? `title="${stepTitle}"` : ''}>${triRight}</button>
        </div>
      </div>
    `;

    const quickHtml = `
      <div class="flex items-center gap-1.5">
        <div class="portal-subpanel flex-1 h-7 rounded-full p-0.5 flex items-center gap-1 select-none">
          <button type="button" data-ctx-hp-step="-1" class="portal-btn w-6 h-6 p-0 rounded-full flex items-center justify-center text-rose-400 font-bold text-xs shrink-0 hover:bg-white/10" title="−1 HP (Shift: −5)">−</button>
          <div data-ctx-hp-track class="relative flex-1 h-5 rounded-full bg-black/30 overflow-hidden cursor-ew-resize flex items-center justify-center" title="Arrastra para ajustar vida o haz clic para escribir (ej. -7)">
            <div data-ctx-hp-fill class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 pointer-events-none" style="width:${hpPct}%; background:${hpFillColor}; opacity:0.55;"></div>
            <span data-ctx-hp-label class="relative z-10 font-mono-tech text-[10.5px] font-bold tabular-nums drop-shadow">${curHp} / ${maxHp}</span>
            <input type="text" data-ctx-hp-input class="hidden relative z-20 w-full h-full bg-black/70 text-center font-mono-tech text-[10.5px] font-bold outline-none rounded-full px-1" placeholder="-5 o 12" />
          </div>
          <button type="button" data-ctx-hp-step="1" class="portal-btn w-6 h-6 p-0 rounded-full flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0 hover:bg-white/10" title="+1 HP (Shift: +5)">+</button>
        </div>
        <button type="button" data-ctx-quick="open-sheet" class="portal-subpanel portal-btn w-7 h-7 p-0 rounded-full flex items-center justify-center shrink-0" title="Abrir Ficha">${renderUiLineIcon('file-text', 'w-3.5 h-3.5')}</button>
      </div>
      <div class="grid grid-cols-5 gap-1 pt-1 border-t" style="border-color: var(--hairline);">
        ${statusDefs
          .map((def) => {
            const active = activeConds.includes(def.key);
            return `
              <button
                type="button"
                data-ctx-cond="${this.escapeHtml(def.key)}"
                title="${this.escapeHtml(def.label)}"
                class="portal-seg-btn h-6 p-0 rounded-lg flex items-center justify-center transition-transform ${active ? 'is-active scale-105' : 'portal-subpanel opacity-80 hover:opacity-100'}"
                style="${active ? `background:${def.color}; color:#ffffff; border-color:${def.color};` : `color:${def.color};`}"
              >${this.renderStatusSymbolSvg(def.icon, 'w-3.5 h-3.5', state)}</button>
            `;
          })
          .join('')}
      </div>
      <div class="grid grid-cols-2 gap-1.5 pt-1.5 border-t text-[10.5px]" style="border-color: var(--hairline);">
        ${renderStepper('light', 'bulb', 'Luz', lightValTxt, '±1 (Shift: ±5)')}
        ${isGm ? renderStepper('size', 'maximize', 'Tamaño', `${curSize}×${curSize}`) : ''}
        ${isAlly ? renderStepper('darkvision', 'moon', 'Visión oscura', dvValTxt, '±1 (Shift: ±5)') : ''}
        ${renderStepper('aura', 'circle-dot', 'Aura', auraValTxt)}
        ${hasTempOverride ? `
        <button type="button" data-ctx-reset-temp class="col-span-2 portal-btn portal-subpanel w-full py-1 rounded-lg text-[9.5px] opacity-85 hover:opacity-100 flex items-center justify-center gap-1" title="Restaurar tamaño, luz y visión fijos del personaje">${renderUiLineIcon('rotate-ccw', 'w-3 h-3')}<span>Restablecer a valores fijos</span></button>
        ` : ''}
      </div>
    `;

    this.els.contextSubOptionsRow.className = 'flex flex-col gap-1.5';
    this.els.contextSubOptionsRow.style.order = '1';
    this.els.contextDynamicRow.style.order = '2';
    if (this.els.contextTokenHeader) this.els.contextTokenHeader.style.order = '0';
    this.els.contextSubOptionsRow.innerHTML = quickHtml;

    const refreshMenu = () => {
      const refreshed = Service.state.tokens.find((t) => t.id === tok.id);
      if (refreshed) this.renderTokenContextMenu(refreshed, Service.state);
    };

    this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-quick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        handleTokenAction(btn.dataset.ctxQuick);
        this.hideContextMenu();
      });
    });

    this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-hp-step]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const baseDir = Number(btn.dataset.ctxHpStep) || 0;
        const delta = baseDir * (e.shiftKey ? 5 : 1);
        Service.adjustTokenHp(tok.id, delta);
        refreshMenu();
      });
    });

    const hpTrack = this.els.contextSubOptionsRow.querySelector('[data-ctx-hp-track]');
    const hpFill = this.els.contextSubOptionsRow.querySelector('[data-ctx-hp-fill]');
    const hpLabel = this.els.contextSubOptionsRow.querySelector('[data-ctx-hp-label]');
    const hpInput = this.els.contextSubOptionsRow.querySelector('[data-ctx-hp-input]');
    if (hpTrack && hpFill && hpLabel && hpInput) {
      let dragging = false;
      let moved = false;
      let startX = 0;
      let previewHp = curHp;

      const updateScrub = (clientX) => {
        const rect = hpTrack.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
        previewHp = Math.round(ratio * maxHp);
        const pct = Math.round((previewHp / maxHp) * 100);
        hpFill.style.width = `${pct}%`;
        hpFill.style.background = pct <= 20 ? '#ef4444' : pct <= 50 ? '#f59e0b' : '#10b981';
        hpLabel.textContent = `${previewHp} / ${maxHp}`;
      };

      hpTrack.addEventListener('pointerdown', (e) => {
        if (e.target === hpInput) return;
        e.preventDefault();
        dragging = true;
        moved = false;
        startX = e.clientX;
        previewHp = curHp;
        try {
          hpTrack.setPointerCapture(e.pointerId);
        } catch (_) {}
      });
      hpTrack.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        if (Math.abs(e.clientX - startX) > 4) moved = true;
        if (moved) updateScrub(e.clientX);
      });
      hpTrack.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        dragging = false;
        try {
          hpTrack.releasePointerCapture(e.pointerId);
        } catch (_) {}
        if (moved) {
          Service.setTokenHp(tok.id, previewHp);
          refreshMenu();
        } else {
          hpLabel.classList.add('hidden');
          hpInput.classList.remove('hidden');
          hpInput.value = '';
          hpInput.focus();
        }
      });

      const commitInput = () => {
        const parsed = parseHpInputExpression(hpInput.value, curHp, maxHp);
        hpInput.classList.add('hidden');
        hpLabel.classList.remove('hidden');
        if (parsed !== null) {
          Service.setTokenHp(tok.id, parsed);
          refreshMenu();
        }
      };
      hpInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commitInput();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hpInput.classList.add('hidden');
          hpLabel.classList.remove('hidden');
        }
      });
      hpInput.addEventListener('blur', commitInput);
    }

    this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-step]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const prop = btn.dataset.ctxStep;
        const dir = Number(btn.dataset.ctxDir) || 1;
        if (prop === 'light') {
          const next = stepDistanceMeters(lightMeters, dir, { unit, shiftKey: e.shiftKey, min: 0, max: 60 });
          Service.setTokenLight(tok.id, next);
        } else if (prop === 'size') {
          const next = stepPresetValue(curSize, sizeSteps, dir);
          Service.setTokenSize(tok.id, next);
        } else if (prop === 'darkvision') {
          const next = stepDistanceMeters(dvMeters, dir, { unit, shiftKey: e.shiftKey, min: 0, max: 36 });
          Service.setTokenDarkvisionMeters(tok.id, next);
        } else if (prop === 'aura') {
          const next = stepPresetValue(curAura, auraSteps, dir);
          Service.setTokenAura(tok.id, next);
        }
        refreshMenu();
      });
    });

    const resetTempBtn = this.els.contextSubOptionsRow.querySelector('[data-ctx-reset-temp]');
    if (resetTempBtn) {
      resetTempBtn.addEventListener('click', () => {
        Service.resetTokenTempProps(tok.id);
        refreshMenu();
      });
    }

    this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-cond]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.ctxCond;
        Service.toggleTokenCondition(tok.id, key);
        const updatedTok = Service.state.tokens.find((t) => t.id === tok.id);
        const isNowActive = Boolean(updatedTok && Array.isArray(updatedTok.conditions) && updatedTok.conditions.includes(key));
        const def = Selector.getStatusDef(Service.state, key);
        b.classList.toggle('is-active', isNowActive);
        b.classList.toggle('scale-105', isNowActive);
        b.classList.toggle('portal-subpanel', !isNowActive);
        b.classList.toggle('opacity-80', !isNowActive);
        b.style.background = isNowActive ? def.color : '';
        b.style.color = isNowActive ? '#ffffff' : def.color;
        b.style.borderColor = isNowActive ? def.color : '';
      });
    });

    this.renderContextMenuSections(this.els.contextDynamicRow, spec.sections, handleTokenAction);
  },

  openMultiTokenContextMenu(clientX, clientY, tokens = []) {
    const state = Service.state;
    const list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
    if (list.length < 2) return;
    const ids = list.map((t) => t.id);
    const spec = buildMultiTokenMenuSpec({ role: state.role, tokens: list });

    if (this.els.contextToolsRow) {
      this.els.contextToolsRow.classList.add('hidden');
      this.els.contextToolsRow.classList.remove('grid');
    }
    if (this.els.contextTokenHeader) {
      this.els.contextTokenHeader.style.order = '0';
      this.els.contextTokenHeader.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-xl text-[11px]';
      this.els.contextTokenHeader.innerHTML = `
        <span class="font-semibold truncate">${this.escapeHtml(spec.header.title)}</span>
        <span class="opacity-65 text-[10px] font-mono-tech">Lote</span>
      `;
    }

    const handleBatchAction = (act) => {
      if (act === 'hp-minus') Service.adjustTokensHp(ids, -1);
      else if (act === 'hp-plus') Service.adjustTokensHp(ids, 1);
      else if (act === 'hp-m5') Service.adjustTokensHp(ids, -5);
      else if (act === 'hp-p5') Service.adjustTokensHp(ids, 5);
      else if (act === 'light') Service.cycleTokensLight(ids);
      else if (act === 'aura') Service.cycleTokensAura(ids);
      else if (act === 'init') {
        list.forEach((tok) => Service.rollTokenInitiative(tok));
      } else if (act === 'toggle-hide') Service.toggleTokensHidden(ids);
      else if (act === 'dup-toks') Service.duplicateTokens(ids);
      else if (act === 'del-toks') {
        const count = Service.deleteTokens(ids);
        if (count > 0) this.showActionToast?.(`🗑 ${count} fichas eliminadas`);
      }
    };

    const statusDefs = Selector.getSystemStatuses(state);
    const quickHtml = `
      <div class="portal-ctx-quick" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
        ${spec.quickActions
          .map((q) => {
            const toneCls = q.tone === 'danger' ? 'text-red-400' : q.tone === 'success' ? 'text-emerald-400' : '';
            return `<button type="button" data-ctx-quick="${q.id}" class="portal-subpanel portal-btn portal-ctx-quick-btn font-mono-tech ${toneCls}" title="${this.escapeHtml(q.title || q.label)}">${this.escapeHtml(q.label)}</button>`;
          })
          .join('')}
      </div>
      <div class="grid grid-cols-5 gap-1 pt-1 border-t" style="border-color: var(--hairline);">
        ${statusDefs
          .map((def) => {
            const allHave = list.every((t) => Array.isArray(t.conditions) && t.conditions.includes(def.key));
            return `
              <button
                type="button"
                data-ctx-cond="${this.escapeHtml(def.key)}"
                title="${this.escapeHtml(def.label)} (aplicar a todas)"
                class="portal-seg-btn h-6 p-0 rounded-lg flex items-center justify-center transition-transform ${allHave ? 'is-active scale-105' : 'portal-subpanel opacity-80 hover:opacity-100'}"
                style="${allHave ? `background:${def.color}; color:#ffffff; border-color:${def.color};` : `color:${def.color};`}"
              >${this.renderStatusSymbolSvg(def.icon, 'w-3.5 h-3.5', state)}</button>
            `;
          })
          .join('')}
      </div>
    `;

    this.els.contextSubOptionsRow.className = 'flex flex-col gap-1.5';
    this.els.contextSubOptionsRow.style.order = '1';
    this.els.contextDynamicRow.style.order = '2';
    this.els.contextSubOptionsRow.innerHTML = quickHtml;

    this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-quick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        handleBatchAction(btn.dataset.ctxQuick);
        this.hideContextMenu();
      });
    });

    this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-cond]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.ctxCond;
        Service.toggleTokensCondition(ids, key);
        const refreshed = Service.getSelectedControllableTokens(ids);
        const allNow = refreshed.length > 0 && refreshed.every((t) => Array.isArray(t.conditions) && t.conditions.includes(key));
        const def = Selector.getStatusDef(Service.state, key);
        b.classList.toggle('is-active', allNow);
        b.classList.toggle('scale-105', allNow);
        b.classList.toggle('portal-subpanel', !allNow);
        b.classList.toggle('opacity-80', !allNow);
        b.style.background = allNow ? def.color : '';
        b.style.color = allNow ? '#ffffff' : def.color;
        b.style.borderColor = allNow ? def.color : '';
      });
    });

    this.renderContextMenuSections(this.els.contextDynamicRow, spec.sections, handleBatchAction);
    this.positionContextMenu(clientX, clientY);
  },

  renderMapContextMenu(state) {
    if (this.els.contextTokenHeader) {
      this.els.contextTokenHeader.style.order = '';
      this.els.contextTokenHeader.className = 'hidden';
      this.els.contextTokenHeader.innerHTML = '';
    }
    this.els.contextSubOptionsRow.style.order = '';
    this.els.contextDynamicRow.style.order = '';

    const ownedToken = state.role !== 'gm'
      ? (state.tokens || []).find((t) => Service.canControlToken(t))
      : null;

    const isNarrative = Selector.isNarrativeScene(state);
    const spec = buildMapMenuSpec({
      role: state.role,
      dynamicLighting: Boolean(state.dynamicLighting),
      hasOwnedToken: Boolean(ownedToken),
      isNarrative
    });

    if (this.els.contextToolsRow) {
      if (spec.showToolsRow) {
        this.els.contextToolsRow.classList.remove('hidden');
        this.els.contextToolsRow.classList.add('grid');
        this.els.contextIconMenu.querySelectorAll('[data-ctx-tool]').forEach((btn) => {
          btn.classList.toggle('portal-btn-active', btn.dataset.ctxTool === state.tool);
        });
      } else {
        this.els.contextToolsRow.classList.add('hidden');
        this.els.contextToolsRow.classList.remove('grid');
      }
    }

    this.renderContextMenuSections(this.els.contextDynamicRow, spec.sections, async (act) => {
      if (act === 'ping-here') {
        Service.triggerPing(this.ctxWorldPos.x, this.ctxWorldPos.y);
      } else if (act === 'measure-here') {
        Service.setTool('ruler');
      } else if (act === 'focus-my-token' && ownedToken) {
        this.centerCameraOnToken(ownedToken);
      } else if (act === 'reset-zoom') {
        Service.setZoom(1);
      } else if (act === 'add-note') {
        this.openNoteModal(null, this.ctxWorldPos.x, this.ctxWorldPos.y);
      } else if (act === 'toggle-dynlight') {
        Service.toggleDynamicLighting();
        this.showActionToast(
          Service.state.dynamicLighting ? '💡 Luz dinámica activada en este escenario' : '☀️ Luz ambiental activada en este escenario'
        );
      } else if (act === 'open-grid') {
        this.openMapGridEditorForActiveScene?.();
      }
    });

    if (!spec.showToolsRow) {
      this.els.contextDynamicRow.style.borderTopWidth = '0px';
      this.els.contextDynamicRow.classList.remove('pt-1', 'border-t');
    } else {
      this.els.contextDynamicRow.style.borderTopWidth = '';
    }

    if (state.role === 'gm' && this.els.contextSubOptionsRow) {
      const curAmbient = Selector.getActiveAmbientLight(state);
      const ambientIconMap = { day: 'sun', night: 'moon', darkness: 'eclipse' };
      const ambientPills = AMBIENT_LIGHT_META.map(
        (a) =>
          `<button type="button" data-ctx-ambient="${a.id}" class="portal-seg-btn py-1 px-1.5 text-[10px] font-semibold flex items-center justify-center gap-0.5 ${curAmbient === a.id ? 'is-active' : ''}" title="Luz ambiental: ${a.label}">${renderUiLineIcon(ambientIconMap[a.id] || 'sun', 'w-3.5 h-3.5')}</button>`
      ).join('');
      const curWeather = normalizeWeatherType(state.sceneWeather);
      const weatherIconMap = { none: 'ban', rain: 'cloud-rain', snow: 'snowflake', embers: 'flame', mist: 'wind' };
      const pills = WEATHER_META.map(
        (w) =>
          `<button type="button" data-ctx-weather="${w.id}" class="portal-seg-btn py-1 px-1.5 text-[10px] font-semibold flex items-center justify-center gap-0.5 ${curWeather === w.id ? 'is-active' : ''}" title="Clima: ${w.label}">${renderUiLineIcon(weatherIconMap[w.id] || 'ban', 'w-3.5 h-3.5')}</button>`
      ).join('');
      this.els.contextSubOptionsRow.className = 'pt-1.5 border-t flex flex-col gap-1.5';
      this.els.contextSubOptionsRow.style.borderColor = 'var(--hairline)';
      this.els.contextSubOptionsRow.innerHTML = `
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between px-1 text-[10px] opacity-65">
            <span>Luz ambiental</span>
            <span class="font-semibold opacity-90">${AMBIENT_LIGHT_META.find((a) => a.id === curAmbient)?.label || 'Día'}</span>
          </div>
          <div class="portal-seg grid grid-cols-3 gap-0.5">${ambientPills}</div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between px-1 text-[10px] opacity-65">
            <span>Clima · ${isNarrative ? 'Narrativo' : 'Táctico'}</span>
            <span class="font-semibold opacity-90">${WEATHER_META.find((w) => w.id === curWeather)?.label || 'Sin'}</span>
          </div>
          <div class="portal-seg grid grid-cols-5 gap-0.5">${pills}</div>
        </div>
      `;
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-ambient]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const next = Service.setSceneAmbientLight(btn.dataset.ctxAmbient);
          this.hideContextMenu();
          const label = AMBIENT_LIGHT_META.find((a) => a.id === next)?.label || 'Día';
          this.showActionToast(`Luz ambiental: ${label}`);
        });
      });
      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-weather]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const next = Service.setSceneWeather(btn.dataset.ctxWeather);
          this.hideContextMenu();
          const label = WEATHER_META.find((w) => w.id === next)?.label || 'Sin';
          this.showActionToast(next === 'none' ? 'Clima desactivado.' : `Clima: ${label}`);
        });
      });
    } else {
      this.els.contextSubOptionsRow.className = 'hidden';
      this.els.contextSubOptionsRow.innerHTML = '';
    }
  },

  openWallContextMenu(clientX, clientY, walls = []) {
    const list = Array.isArray(walls) ? walls.filter(Boolean) : [];
    if (list.length === 0) return;
    const ids = list.map((w) => w.id);
    const spec = buildWallMenuSpec(list);

    if (this.els.contextToolsRow) {
      this.els.contextToolsRow.classList.add('hidden');
      this.els.contextToolsRow.classList.remove('grid');
    }
    if (this.els.contextTokenHeader) {
      this.els.contextTokenHeader.style.order = '';
      this.els.contextTokenHeader.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-xl text-[11px]';
      this.els.contextTokenHeader.innerHTML = `
        <span class="font-semibold truncate max-w-[175px]">${this.escapeHtml(spec.header.title)}</span>
        ${spec.header.subtitle ? `<span class="opacity-65 text-[10px] font-mono-tech truncate max-w-[75px]">${this.escapeHtml(spec.header.subtitle)}</span>` : ''}
      `;
    }
    this.els.contextSubOptionsRow.style.order = '';
    this.els.contextDynamicRow.style.order = '';
    this.els.contextSubOptionsRow.className = 'hidden';
    this.els.contextSubOptionsRow.innerHTML = '';

    this.renderContextMenuSections(this.els.contextDynamicRow, spec.sections, (act) => {
      if (act === 'kind-wall') Service.setWallsKind(ids, 'wall');
      else if (act === 'kind-terrain') Service.setWallsKind(ids, 'terrain');
      else if (act === 'kind-invisible') Service.setWallsKind(ids, 'invisible');
      else if (act === 'door-none') Service.setWallsDoor(ids, 'none');
      else if (act === 'door-normal') Service.setWallsDoor(ids, 'normal');
      else if (act === 'door-secret') Service.setWallsDoor(ids, 'secret');
      else if (act === 'toggle-open') {
        ids.forEach((id) => Service.toggleDoor(id));
      } else if (act === 'toggle-lock') {
        const res = Service.toggleSelectedDoorsLocked(ids);
        if (res > 0) this.showActionToast?.(res > 1 ? `🔒 ${res} puertas bloqueadas` : '🔒 Puerta bloqueada');
        else if (res < 0) this.showActionToast?.(Math.abs(res) > 1 ? `🔓 ${Math.abs(res)} puertas desbloqueadas` : '🔓 Puerta desbloqueada');
      } else if (act === 'duplicate-walls') {
        const dup = Service.duplicateWalls(ids);
        if (dup.length > 0) {
          this.showActionToast?.(dup.length > 1 ? `⧉ ${dup.length} muros duplicados` : '⧉ Muro duplicado');
        }
      } else if (act === 'delete-walls') {
        const count = Service.removeWallsByIds(ids);
        if (count > 0) {
          this.showActionToast?.(count > 1 ? `🗑 ${count} muros eliminados` : '🗑 Muro eliminado');
        }
      }
    });

    this.positionContextMenu(clientX, clientY);
  },

  openDiceBarContextMenu(clientX, clientY, dieKey = null) {
    const dice = Service.state.dice || {};
    const hand = Array.isArray(dice.hand) ? dice.hand : [];
    const modifier = Number(dice.modifier) || 0;
    const visibility = dice.visibility || 'public';
    const historyCount = Array.isArray(dice.history) ? dice.history.length : 0;
    const deckRemaining = Array.isArray(dice.deck) ? dice.deck.length : 54;

    const spec = dieKey !== null && dieKey !== undefined
      ? buildDiceDieMenuSpec(dieKey, { modifier, deckRemaining })
      : buildDiceBarMenuSpec({ hand, modifier, visibility, historyCount });

    if (this.els.contextToolsRow) {
      this.els.contextToolsRow.classList.add('hidden');
      this.els.contextToolsRow.classList.remove('grid');
    }
    if (this.els.contextTokenHeader) {
      this.els.contextTokenHeader.style.order = '';
      this.els.contextTokenHeader.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-xl text-[11px]';
      this.els.contextTokenHeader.innerHTML = `
        <span class="font-semibold truncate max-w-[165px]">${this.escapeHtml(spec.header?.title || 'Dados')}</span>
        ${spec.header?.subtitle ? `<span class="opacity-65 text-[10px] font-mono-tech truncate max-w-[85px]">${this.escapeHtml(spec.header.subtitle)}</span>` : ''}
      `;
    }
    this.els.contextSubOptionsRow.style.order = '';
    this.els.contextDynamicRow.style.order = '';
    this.els.contextSubOptionsRow.className = 'hidden';
    this.els.contextSubOptionsRow.innerHTML = '';

    const rollTwoWithMode = (sides, mode) => {
      const prevMode = Service.state.dice.resultMode || 'sum';
      Service.state.dice.resultMode = mode;
      Service.state.dice.hand = [sides, sides];
      Service.throwDiceHand();
      Service.state.dice.resultMode = prevMode;
      Service.notify({ skipVaultSave: true });
    };

    this.renderContextMenuSections(this.els.contextDynamicRow, spec.sections, (act) => {
      if (act === 'roll-now') {
        Service.rollDice(Number(dieKey) || 20);
      } else if (act === 'roll-adv') {
        rollTwoWithMode(Number(dieKey) || 20, 'max');
      } else if (act === 'roll-dis') {
        rollTwoWithMode(Number(dieKey) || 20, 'min');
      } else if (act === 'add-two') {
        Service.addDieToHand(dieKey);
        Service.addDieToHand(dieKey);
      } else if (act === 'add-one') {
        Service.addDieToHand(dieKey);
      } else if (act === 'roll-coin') {
        Service.rollCoin();
      } else if (act === 'roll-fudge-4') {
        Service.rollFudge(4);
      } else if (act === 'draw-card') {
        Service.state.dice.hand = ['card'];
        Service.throwDiceHand();
      } else if (act === 'shuffle-deck') {
        Service.shuffleDeck();
        this.showActionToast?.('🔀 Baraja mezclada (54/54)');
      } else if (act === 'clear-hand') {
        Service.clearDiceHand();
      } else if (act === 'reset-mod') {
        Service.state.dice.modifier = 0;
        Service.notify();
      } else if (act === 'vis-public') {
        Service.setDiceVisibility('public');
      } else if (act === 'vis-private') {
        Service.setDiceVisibility('private');
      } else if (act === 'open-customize') {
        this.setDicePopoverOpen?.(true);
      } else if (act === 'open-history') {
        this.setDiceHistoryOpen?.(true);
      } else if (act === 'clear-history') {
        Service.clearDiceHistory();
      }
    });

    this.positionContextMenu(clientX, clientY);
  },

  centerCameraOnToken(tok) {
    if (!tok || !this.els.viewport) return;
    const vp = this.els.viewport.getBoundingClientRect();
    const z = Service.state.camera.zoom || 1;
    Service.state.camera.x = vp.width / 2 - tok.x * z;
    Service.state.camera.y = vp.height / 2 - tok.y * z;
    Service.notify({ skipVaultSave: true });
  },

  hideContextMenu() {
    this.els.contextIconMenu?.classList.remove('is-open');
  },

  openListContextMenu(clientX, clientY, title, subtitle = '', actions = []) {
    if (this.els.contextToolsRow) {
      this.els.contextToolsRow.classList.add('hidden');
      this.els.contextToolsRow.classList.remove('grid');
    }
    if (this.els.contextTokenHeader) {
      this.els.contextTokenHeader.style.order = '';
      this.els.contextTokenHeader.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-xl text-[11px]';
      this.els.contextTokenHeader.innerHTML = `
        <span class="font-semibold truncate max-w-[165px]">${this.escapeHtml(title)}</span>
        ${subtitle ? `<span class="opacity-65 text-[10px] truncate max-w-[85px]">${this.escapeHtml(subtitle)}</span>` : ''}
      `;
    }
    this.els.contextSubOptionsRow.style.order = '';
    this.els.contextDynamicRow.style.order = '';
    this.els.contextSubOptionsRow.className = 'hidden';
    this.els.contextSubOptionsRow.innerHTML = '';

    const normal = actions.filter((a) => !a.danger);
    const dangerous = actions.filter((a) => a.danger);
    const sections = [];
    if (normal.length > 0) sections.push(normal);
    if (dangerous.length > 0) sections.push(dangerous);

    this.renderContextMenuSections(this.els.contextDynamicRow, sections);
    this.positionContextMenu(clientX, clientY);
  },

  openMapLightContextMenu(clientX, clientY, light) {
    if (!light || !light.id) return;
    const renderLightMenu = (curLight) => {
      const spec = buildMapLightMenuSpec(curLight);
      const visionCfg = Selector.getSystemVisionConfig(Service.state);
      const unit = visionCfg.distanceUnit || 'm';
      const radiusSteps = [3, 6, 9, 12, 18, 24, 30];
      const radiusTxt = formatDistance(curLight.radiusMeters, unit);
      const triLeft = '<svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><polygon points="10.5,3.5 4.5,8 10.5,12.5"/></svg>';
      const triRight = '<svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><polygon points="5.5,3.5 11.5,8 5.5,12.5"/></svg>';

      if (this.els.contextToolsRow) {
        this.els.contextToolsRow.classList.add('hidden');
        this.els.contextToolsRow.classList.remove('grid');
      }
      if (this.els.contextTokenHeader) {
        this.els.contextTokenHeader.style.order = '0';
        this.els.contextTokenHeader.className = 'flex items-center justify-between gap-2 px-2 py-1 rounded-xl text-[11px]';
        this.els.contextTokenHeader.innerHTML = `
          <span class="font-semibold truncate max-w-[165px]">${this.escapeHtml(spec.header.title)}</span>
          <span class="opacity-65 text-[10px] font-mono-tech">${this.escapeHtml(spec.header.subtitle)}</span>
        `;
      }

      const tonePills = MAP_LIGHT_TONES.map((tId) => {
        const meta = MAP_LIGHT_TONE_META[tId];
        const active = (curLight.tone || 'warm') === tId;
        return `<button type="button" data-ctx-light-tone="${tId}" title="${this.escapeHtml(meta.label)}" aria-label="${this.escapeHtml(meta.label)}" class="portal-seg-btn py-1.5 px-1 flex items-center justify-center ${active ? 'is-active' : ''}">
          <span class="w-3 h-3 rounded-full shrink-0 border border-black/20" style="background:${meta.color};"></span>
        </button>`;
      }).join('');

      const activeAnim = curLight.animation || 'steady';
      const animPills = MAP_LIGHT_ANIMATIONS.map((animId) => {
        const meta = MAP_LIGHT_ANIMATION_META[animId];
        const active = activeAnim === animId;
        return `<button type="button" data-ctx-light-anim="${animId}" class="portal-seg-btn py-1 px-1 text-[10px] font-semibold flex items-center justify-center ${active ? 'is-active' : ''}">${this.escapeHtml(meta.label)}</button>`;
      }).join('');

      this.els.contextSubOptionsRow.className = 'flex flex-col gap-1.5 pt-1';
      this.els.contextSubOptionsRow.style.order = '1';
      this.els.contextDynamicRow.style.order = '2';
      this.els.contextSubOptionsRow.innerHTML = `
        <div class="portal-subpanel rounded-xl px-2 py-1.5 flex items-center justify-between gap-2">
          <span class="opacity-75 font-medium flex items-center gap-1.5 text-[10.5px]">${renderUiLineIcon('bulb', 'w-3.5 h-3.5')}<span>Radio</span></span>
          <div class="flex items-center gap-1.5">
            <button type="button" data-ctx-light-radius="-1" class="portal-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-70 hover:opacity-100" aria-label="Reducir radio" title="±1 (Shift: ±5)">${triLeft}</button>
            <span class="font-mono-tech text-[10.5px] font-semibold tabular-nums min-w-[38px] text-center">${this.escapeHtml(radiusTxt)}</span>
            <button type="button" data-ctx-light-radius="1" class="portal-btn w-5 h-5 p-0 rounded-full flex items-center justify-center opacity-70 hover:opacity-100" aria-label="Aumentar radio" title="±1 (Shift: ±5)">${triRight}</button>
          </div>
        </div>
        <div class="portal-seg grid grid-cols-5 gap-0.5">${tonePills}</div>
        <div class="portal-seg grid grid-cols-4 gap-0.5">${animPills}</div>
      `;

      const refresh = () => {
        const latest = (Service.state.mapLights || []).find((l) => l && l.id === curLight.id);
        if (latest) renderLightMenu(latest);
      };

      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-light-radius]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const dir = Number(btn.dataset.ctxLightRadius) || 1;
          const nextR = stepDistanceMeters(curLight.radiusMeters, dir, { unit, shiftKey: e.shiftKey, min: 1, max: 40 });
          Service.updateMapLight(curLight.id, { radiusMeters: nextR });
          refresh();
        });
      });

      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-light-tone]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          Service.updateMapLight(curLight.id, { tone: btn.dataset.ctxLightTone });
          refresh();
        });
      });

      this.els.contextSubOptionsRow.querySelectorAll('[data-ctx-light-anim]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const anim = btn.dataset.ctxLightAnim;
          Service.updateMapLight(curLight.id, { animation: anim, flicker: anim === 'flame' });
          refresh();
        });
      });

      this.renderContextMenuSections(this.els.contextDynamicRow, spec.sections, (act) => {
        if (act === 'toggle-enabled') {
          Service.updateMapLight(curLight.id, { enabled: curLight.enabled === false });
        } else if (act === 'delete-light') {
          Service.deleteMapLight(curLight.id);
          this.showActionToast?.('Luz eliminada');
        }
      });
    };

    renderLightMenu(light);
    this.positionContextMenu(clientX, clientY);
  }
};
