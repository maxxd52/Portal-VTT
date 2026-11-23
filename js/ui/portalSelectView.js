/* ==========================================================================
   PORTAL SELECT VIEW: UNIFIED APPLE GLASS POPOVER FOR ALL NATIVE <SELECT>
   ========================================================================== */

import {
  computeAnchoredDropdownPosition,
  filterSelectOptionGroups,
  shouldShowSelectSearch
} from '../utils/pickerModel.js?v=20261123a7';

function extractSelectOptionGroups(selectEl) {
  if (!selectEl) return { groups: [], totalOptions: 0 };
  const groups = [];
  let rootOptions = [];
  let totalOptions = 0;

  const flushRoot = () => {
    if (rootOptions.length > 0) {
      groups.push({ label: '', options: rootOptions });
      rootOptions = [];
    }
  };

  for (const child of Array.from(selectEl.children || [])) {
    const tag = String(child.tagName || '').toUpperCase();
    if (tag === 'OPTGROUP') {
      flushRoot();
      const opts = Array.from(child.children || [])
        .filter((o) => String(o.tagName || '').toUpperCase() === 'OPTION')
        .map((o) => {
          totalOptions += 1;
          return {
            value: o.value,
            label: String(o.textContent || o.label || o.value).trim(),
            disabled: Boolean(o.disabled || child.disabled)
          };
        });
      if (opts.length > 0) {
        groups.push({ label: String(child.label || '').trim(), options: opts });
      }
    } else if (tag === 'OPTION') {
      totalOptions += 1;
      rootOptions.push({
        value: child.value,
        label: String(child.textContent || child.label || child.value).trim(),
        disabled: Boolean(child.disabled)
      });
    }
  }
  flushRoot();
  return { groups, totalOptions };
}

export const PortalSelectViewMethods = {
  _ensurePortalSelectPopover() {
    if (typeof document === 'undefined') return null;
    if (this._portalSelectPop && document.body.contains(this._portalSelectPop)) {
      return this._portalSelectPop;
    }
    const pop = document.createElement('div');
    pop.id = 'portalSelectPopover';
    pop.className = 'portal-select-popover portal-panel fixed hidden flex-col gap-1 rounded-2xl p-1.5 shadow-2xl';
    pop.setAttribute('role', 'listbox');
    pop.innerHTML = `
      <div class="portal-select-search-wrap hidden relative items-center px-0.5 pt-0.5">
        <svg class="w-3 h-3 opacity-50 absolute left-2.5 pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
        <input type="text" class="portal-select-search portal-input pl-6 pr-2 py-1 text-[11px]" placeholder="Buscar…" autocomplete="off" />
      </div>
      <div class="portal-select-list flex flex-col gap-0.5 max-h-[248px] overflow-y-auto portal-roll-scroll"></div>
    `;
    document.body.appendChild(pop);

    const searchInp = pop.querySelector('.portal-select-search');
    searchInp?.addEventListener('input', () => {
      this._portalSelectQuery = searchInp.value;
      this._renderPortalSelectOptions();
    });
    searchInp?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.closePortalSelect(true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._movePortalSelectHighlight(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._movePortalSelectHighlight(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this._commitHighlightedPortalSelectOption();
      }
    });

    pop.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-portal-opt-val]');
      if (!btn || btn.disabled) return;
      this._commitPortalSelectValue(btn.dataset.portalOptVal);
    });

    this._portalSelectPop = pop;
    return pop;
  },

  initPortalSelects() {
    if (typeof document === 'undefined' || this._portalSelectBound) return;
    this._portalSelectBound = true;

    const isEnhanceableSelect = (el) => {
      if (!el || el.tagName !== 'SELECT') return false;
      if (el.disabled || el.multiple || Number(el.size) > 1) return false;
      if (el.dataset.nativeSelect === 'true') return false;
      return true;
    };

    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const sel = e.target?.closest?.('select');
      if (!isEnhanceableSelect(sel)) return;
      e.preventDefault();
      if (this._portalSelectTarget === sel && this.isPortalSelectOpen()) {
        this.closePortalSelect(false);
      } else {
        this.openPortalSelect(sel);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (this.isPortalSelectOpen()) {
        const inSearch = e.target?.classList?.contains?.('portal-select-search');
        if (inSearch) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.closePortalSelect(true);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this._movePortalSelectHighlight(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this._movePortalSelectHighlight(-1);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._commitHighlightedPortalSelectOption();
        }
        return;
      }

      const sel = e.target;
      if (isEnhanceableSelect(sel) && [' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        this.openPortalSelect(sel);
      }
    });

    document.addEventListener('pointerdown', (e) => {
      if (!this.isPortalSelectOpen()) return;
      if (this._portalSelectPop?.contains(e.target)) return;
      if (this._portalSelectTarget && this._portalSelectTarget.contains(e.target)) return;
      this.closePortalSelect(false);
    });

    window.addEventListener('resize', () => {
      if (this.isPortalSelectOpen()) this.closePortalSelect(false);
    });

    document.addEventListener(
      'scroll',
      (e) => {
        if (!this.isPortalSelectOpen()) return;
        if (this._portalSelectPop?.contains(e.target)) return;
        this.closePortalSelect(false);
      },
      true
    );
  },

  isPortalSelectOpen() {
    return Boolean(this._portalSelectPop && !this._portalSelectPop.classList.contains('hidden'));
  },

  openPortalSelect(selectEl) {
    if (!selectEl) return false;
    const pop = this._ensurePortalSelectPopover();
    if (!pop) return false;

    this._portalSelectTarget = selectEl;
    this._portalSelectQuery = '';
    const { groups, totalOptions } = extractSelectOptionGroups(selectEl);
    this._portalSelectRawGroups = groups;

    const showSearch = shouldShowSelectSearch(totalOptions);
    const searchWrap = pop.querySelector('.portal-select-search-wrap');
    const searchInp = pop.querySelector('.portal-select-search');
    if (searchWrap) {
      searchWrap.classList.toggle('hidden', !showSearch);
      searchWrap.classList.toggle('flex', showSearch);
    }
    if (searchInp) searchInp.value = '';

    this._portalSelectHighlightIdx = -1;
    this._renderPortalSelectOptions();

    pop.classList.remove('hidden');
    pop.classList.add('flex');
    pop.style.left = '-9999px';
    pop.style.top = '-9999px';

    const rect = selectEl.getBoundingClientRect();
    const measuredW = Math.max(rect.width, Math.min(300, pop.offsetWidth || 180));
    const measuredH = Math.min(310, pop.offsetHeight || 180);
    const pos = computeAnchoredDropdownPosition({
      triggerRect: rect,
      menuWidth: measuredW,
      menuHeight: measuredH,
      viewportWidth: window.innerWidth || 1280,
      viewportHeight: window.innerHeight || 800
    });

    pop.style.width = `${pos.width}px`;
    pop.style.left = `${pos.left}px`;
    pop.style.top = `${pos.top}px`;
    pop.style.transformOrigin = pos.placement === 'top' ? 'bottom left' : 'top left';
    selectEl.classList.add('is-portal-select-open');

    const activeBtn = pop.querySelector('[data-portal-opt-selected="1"]');
    activeBtn?.scrollIntoView?.({ block: 'nearest' });

    if (showSearch && searchInp) {
      requestAnimationFrame(() => searchInp.focus());
    }
    return true;
  },

  closePortalSelect(restoreFocus = false) {
    if (!this.isPortalSelectOpen()) return false;
    const target = this._portalSelectTarget;
    this._portalSelectPop.classList.add('hidden');
    this._portalSelectPop.classList.remove('flex');
    target?.classList?.remove('is-portal-select-open');
    this._portalSelectTarget = null;
    this._portalSelectQuery = '';
    this._portalSelectHighlightIdx = -1;
    if (restoreFocus && target && typeof target.focus === 'function') {
      target.focus();
    }
    return true;
  },

  _renderPortalSelectOptions() {
    const pop = this._portalSelectPop;
    const target = this._portalSelectTarget;
    if (!pop || !target) return;
    const listEl = pop.querySelector('.portal-select-list');
    if (!listEl) return;

    const currentVal = target.value;
    const filtered = filterSelectOptionGroups(this._portalSelectRawGroups || [], this._portalSelectQuery || '');
    const esc = (s) => this.escapeHtml(s);

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="text-[11px] opacity-55 text-center py-3">Sin coincidencias</div>`;
      return;
    }

    let flatIdx = 0;
    const html = filtered
      .map((grp, gIdx) => {
        const sep = gIdx > 0 ? `<div class="portal-ctx-sep"></div>` : '';
        const header = grp.label
          ? `<div class="px-2 pt-1 pb-0.5 text-[9.5px] font-semibold uppercase tracking-wider opacity-55 truncate">${esc(grp.label)}</div>`
          : '';
        const items = grp.options
          .map((opt) => {
            const isSelected = opt.value === currentVal;
            const myIdx = flatIdx++;
            const isHighlighted = myIdx === this._portalSelectHighlightIdx;
            return `
              <button
                type="button"
                role="option"
                aria-selected="${isSelected ? 'true' : 'false'}"
                data-portal-opt-idx="${myIdx}"
                data-portal-opt-val="${esc(opt.value)}"
                ${isSelected ? 'data-portal-opt-selected="1"' : ''}
                ${opt.disabled ? 'disabled' : ''}
                class="portal-ctx-item justify-between gap-2 rounded-lg text-[11.5px] ${isHighlighted ? 'is-highlighted' : ''} ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}"
              >
                <span class="portal-ctx-label">${esc(opt.label)}</span>
                <span class="portal-ctx-check shrink-0">${isSelected ? '✓' : ''}</span>
              </button>
            `;
          })
          .join('');
        return sep + header + items;
      })
      .join('');

    listEl.innerHTML = html;
  },

  _movePortalSelectHighlight(delta) {
    const listEl = this._portalSelectPop?.querySelector('.portal-select-list');
    if (!listEl) return;
    const btns = Array.from(listEl.querySelectorAll('[data-portal-opt-idx]:not([disabled])'));
    if (btns.length === 0) return;
    const curPos = btns.findIndex((b) => Number(b.dataset.portalOptIdx) === this._portalSelectHighlightIdx);
    const nextPos = curPos < 0 ? (delta > 0 ? 0 : btns.length - 1) : (curPos + delta + btns.length) % btns.length;
    this._portalSelectHighlightIdx = Number(btns[nextPos].dataset.portalOptIdx);
    btns.forEach((b) => b.classList.toggle('is-highlighted', Number(b.dataset.portalOptIdx) === this._portalSelectHighlightIdx));
    btns[nextPos].scrollIntoView?.({ block: 'nearest' });
  },

  _commitHighlightedPortalSelectOption() {
    const listEl = this._portalSelectPop?.querySelector('.portal-select-list');
    if (!listEl) return;
    const targetBtn =
      listEl.querySelector(`[data-portal-opt-idx="${this._portalSelectHighlightIdx}"]:not([disabled])`) ||
      listEl.querySelector('[data-portal-opt-idx]:not([disabled])');
    if (targetBtn) {
      this._commitPortalSelectValue(targetBtn.dataset.portalOptVal);
    }
  },

  _commitPortalSelectValue(nextVal) {
    const sel = this._portalSelectTarget;
    if (!sel) return;
    const changed = sel.value !== nextVal;
    sel.value = nextVal;
    this.closePortalSelect(true);
    if (changed) {
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
};
