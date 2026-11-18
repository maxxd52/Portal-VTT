/* ==========================================================================
   COMPENDIUM FORMS VIEW: ICON PICKER, PALETAS DE COLOR Y FORMULA CHIPS
   ========================================================================== */

const CURATED_COLORS = [
  ['#ef4444', 'Rojo'],
  ['#f97316', 'Naranja'],
  ['#d97706', 'Ámbar'],
  ['#65a30d', 'Lima'],
  ['#10b981', 'Esmeralda'],
  ['#0891b2', 'Cian'],
  ['#3b82f6', 'Azul'],
  ['#6366f1', 'Índigo'],
  ['#8b5cf6', 'Violeta'],
  ['#c026d3', 'Fucsia'],
  ['#db2777', 'Rosa'],
  ['#64748b', 'Acero']
];

const ITEM_COLORS = [
  ['#ef4444', 'Rojo'],
  ['#f97316', 'Naranja'],
  ['#eab308', 'Dorado'],
  ['#d97706', 'Ámbar'],
  ['#65a30d', 'Lima'],
  ['#10b981', 'Esmeralda'],
  ['#14b8a6', 'Turquesa'],
  ['#0891b2', 'Cian'],
  ['#3b82f6', 'Azul'],
  ['#6366f1', 'Índigo'],
  ['#8b5cf6', 'Violeta'],
  ['#c026d3', 'Fucsia'],
  ['#db2777', 'Rosa'],
  ['#be123c', 'Carmesí'],
  ['#64748b', 'Acero'],
  ['#e2e8f0', 'Perla']
];

export const CompendiumFormsViewMethods = {
  renderCustomItemIconGrid() {
    const grid = this.els.customItemIconGrid;
    const activeColor = this.selectedItemColor || '#8b5cf6';
    const curIcon = this.selectedItemIcon && this.itemIconDefs[this.selectedItemIcon] ? this.selectedItemIcon : 'shield';
    const isOpen = grid ? !grid.classList.contains('hidden') : false;
    if (this.els.btnToggleItemIconPicker) {
      this.els.btnToggleItemIconPicker.innerHTML = `
        <span class="w-11 h-11 rounded-xl flex items-center justify-center border transition-colors" style="background:${activeColor}26; color:${activeColor}; border-color:${activeColor}55;">
          ${this.renderItemIconSvg(curIcon, 'w-6 h-6', 2.2)}
        </span>
        <span class="flex flex-col items-center justify-center gap-0.5 pr-1 opacity-75">
          <svg class="w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
        </span>
      `;
    }
    if (!grid) return;
    grid.innerHTML = Object.entries(this.itemIconDefs)
      .map(([key, [title]]) => {
        const active = curIcon === key;
        return `<button type="button" data-item-icon="${key}" title="${title}" class="portal-seg-btn portal-subpanel h-7 p-0 flex items-center justify-center rounded-lg ${active ? 'is-active' : ''}" style="${active ? `color:${activeColor};` : ''}">${this.renderItemIconSvg(key, 'w-4 h-4', 2.1)}</button>`;
      })
      .join('');
    grid.querySelectorAll('[data-item-icon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedItemIcon = btn.dataset.itemIcon;
        grid.classList.add('hidden');
        this.renderCustomItemIconGrid();
      });
    });
  },

  renderColorSwatchGrid(grid, selectedColor, onSelect, palette = CURATED_COLORS) {
    if (!grid) return;
    const activeHex = (selectedColor || '#8b5cf6').toLowerCase();
    grid.innerHTML = palette.map(([hex, label]) => {
      const active = activeHex === hex.toLowerCase();
      return `<button type="button" data-swatch-color="${hex}" title="${label}" aria-label="${label}" class="w-5 h-5 rounded-full transition-transform ${active ? 'scale-110 ring-2 ring-white/90' : 'opacity-80 hover:opacity-100 hover:scale-105'}" style="background:${hex};"></button>`;
    }).join('');
    grid.querySelectorAll('[data-swatch-color]').forEach((btn) => {
      btn.addEventListener('click', () => onSelect(btn.dataset.swatchColor));
    });
  },

  renderCustomColorGrids() {
    this.renderColorSwatchGrid(this.els.customTokenColorGrid, this.selectedTokenColor, (hex) => {
      this.selectedTokenColor = hex;
      this.renderCustomColorGrids();
    });
    this.renderColorSwatchGrid(this.els.customItemColorGrid, this.selectedItemColor, (hex) => {
      this.selectedItemColor = hex;
      this.renderCustomColorGrids();
      this.renderCustomItemIconGrid();
    }, ITEM_COLORS);
  },

  serializeFormulaTokens() {
    if (!Array.isArray(this.formulaTokens) || this.formulaTokens.length === 0) return '';
    return this.formulaTokens
      .map((t, idx) => {
        if (t.type === 'die') return `${idx > 0 ? '+ ' : ''}${t.count}d${t.sides}`;
        if (t.type === 'stat') return `${idx > 0 ? '+ ' : ''}@${t.key}`;
        const v = Number(t.value) || 0;
        if (v < 0) return `- ${Math.abs(v)}`;
        return `${idx > 0 ? '+ ' : ''}${v}`;
      })
      .join(' ')
      .trim();
  },

  loadFormulaToTokens(str) {
    this.formulaTokens = [];
    const raw = String(str || '').trim();
    if (!raw) {
      this.renderFormulaChips();
      return;
    }
    const parts = raw.replace(/\s+/g, '').match(/[+-]?(?:\d*d\d+|@[a-z]+|\d+)/gi) || [];
    for (const part of parts) {
      const dieMatch = part.match(/^\+?(\d*)d(\d+)$/i);
      if (dieMatch) {
        this.formulaTokens.push({ type: 'die', count: Number(dieMatch[1]) || 1, sides: Number(dieMatch[2]) });
        continue;
      }
      const statMatch = part.match(/^\+?@([a-z]+)$/i);
      if (statMatch) {
        const key = statMatch[1].toLowerCase();
        this.formulaTokens.push({ type: 'stat', key, label: key.toUpperCase() });
        continue;
      }
      const num = Number(part);
      if (Number.isFinite(num) && num !== 0) {
        this.formulaTokens.push({ type: 'flat', value: num });
      }
    }
    this.renderFormulaChips();
  },

  renderFormulaChips() {
    const box = this.els.formulaChipsPreview;
    if (!box) return;
    if (!this.formulaTokens.length) {
      box.innerHTML = `<span class="text-[10px] opacity-50">Toca dados o atributos abajo...</span>`;
      return;
    }
    box.innerHTML = this.formulaTokens
      .map((t, idx) => {
        const text =
          t.type === 'die'
            ? `${t.count}d${t.sides}`
            : t.type === 'stat'
              ? t.label
              : t.value >= 0
                ? `+${t.value}`
                : `${t.value}`;
        const plusPrefix = idx > 0 && !(t.type === 'flat') ? '<span class="opacity-45 text-[10px]">+</span>' : '';
        return `${plusPrefix}<button type="button" data-fb-rm="${idx}" class="portal-seg-btn is-active px-1.5 py-0.5 rounded-full text-[10px] font-mono-tech flex items-center gap-1" title="Quitar">${text}<span class="opacity-60">×</span></button>`;
      })
      .join('');
    box.querySelectorAll('[data-fb-rm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.fbRm);
        const target = this.formulaTokens[idx];
        if (!target) return;
        if (target.type === 'die' && target.count > 1) target.count -= 1;
        else this.formulaTokens.splice(idx, 1);
        this.renderFormulaChips();
      });
    });
  }
};
