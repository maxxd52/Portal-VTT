/* ==========================================================================
   DICE VIEW: DOCK, HISTORIAL, OVERLAY 3D Y PERSONALIZACIÓN DE DADOS
   ========================================================================== */

import { Service } from '../core/service.js?v=20261115y';
import { Dice3DEngine } from '../services/dice3dEngine.js?v=20261113b';

export const DiceViewMethods = {
  bindDiceEvents() {
    this.els.diceTrayBar.addEventListener('click', (e) => {
      const dieBtn = e.target.closest('[data-die]');
      if (dieBtn) {
        Service.addDieToHand(Number(dieBtn.dataset.die));
      }
    });
    this.els.diceTrayBar.addEventListener('contextmenu', (e) => {
      const dieBtn = e.target.closest('[data-die]');
      if (dieBtn) {
        e.preventDefault();
        Service.removeDieFromHand(Number(dieBtn.dataset.die));
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (this.els.diceHandCursor && Array.isArray(Service.state.dice.hand) && Service.state.dice.hand.length > 0) {
        const tx = Math.min(window.innerWidth - 76, e.clientX + 14);
        const ty = Math.max(10, e.clientY - 36);
        this.els.diceHandCursor.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      }
    });
    this.els.btnDiceModMinus.addEventListener('click', () => {
      Service.state.dice.modifier -= 1;
      Service.notify();
    });
    this.els.btnDiceModPlus.addEventListener('click', () => {
      Service.state.dice.modifier += 1;
      Service.notify();
    });
    if (this.els.diceResultSeg) {
      this.els.diceResultSeg.querySelectorAll('[data-result-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.setDiceResultMode(btn.dataset.resultMode);
        });
      });
    }
    if (this.els.diceVisibilitySeg) {
      this.els.diceVisibilitySeg.querySelectorAll('[data-dice-vis]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.setDiceVisibility(btn.dataset.diceVis);
        });
      });
    }
    this.els.btnCloseDice3d.addEventListener('click', () => {
      this.dismissedRoll = Service.state.dice.lastRoll || null;
      this.els.dice3dOverlay.classList.remove('is-open');
      Dice3DEngine.clear();
    });

    const applyDiceRollToSelected = (multiplier, isHeal) => {
      const tokId = Service.state.selectedTokenId;
      const tok = Service.state.tokens.find((t) => t.id === tokId);
      const base = Math.max(0, Number(this.currentRollTotal) || 0);
      const amount = Math.floor(base * multiplier);
      if (!tok || amount <= 0) return;
      Service.adjustTokenHp(tok.id, isHeal ? amount : -amount);
      this.showActionToast(`${isHeal ? '+' : '−'}${amount} HP a ${tok.name} (${tok.hp}/${tok.maxHp}).`);
    };
    if (this.els.btnDiceApplyDmg) this.els.btnDiceApplyDmg.addEventListener('click', () => applyDiceRollToSelected(1, false));
    if (this.els.btnDiceApplyHalfDmg) this.els.btnDiceApplyHalfDmg.addEventListener('click', () => applyDiceRollToSelected(0.5, false));
    if (this.els.btnDiceApplyHeal) this.els.btnDiceApplyHeal.addEventListener('click', () => applyDiceRollToSelected(1, true));

    this.activeDiceSymbolTab = 'maxSymbol';
    const dismissRollCard = () => {
      this.dismissedRoll = Service.state.dice.lastRoll || null;
      this.els.dice3dOverlay?.classList.remove('is-open');
      Dice3DEngine.clear();
    };
    this.setDicePopoverOpen = (open) => {
      if (!this.els.diceStylePopover) return;
      if (open) {
        dismissRollCard();
        if (this.setDiceHistoryOpen) this.setDiceHistoryOpen(false);
      }
      this.els.diceStylePopover.classList.toggle('is-open', open);
      if (open) {
        this.syncDiceStyleUI(Service.state.dice.style);
      } else {
        Dice3DEngine.stopPreview();
      }
    };

    this.setDiceHistoryOpen = (open) => {
      if (!this.els.diceHistoryPopover) return;
      if (open) {
        dismissRollCard();
        if (this.setDicePopoverOpen) this.setDicePopoverOpen(false);
      }
      this.els.diceHistoryPopover.classList.toggle('is-open', open);
      if (this.els.btnDiceHistory) {
        this.els.btnDiceHistory.classList.toggle('opacity-100', open);
        this.els.btnDiceHistory.classList.toggle('opacity-80', !open);
      }
    };

    if (this.els.btnDiceHistory && this.els.diceHistoryPopover) {
      this.els.btnDiceHistory.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !this.els.diceHistoryPopover.classList.contains('is-open');
        this.setDiceHistoryOpen(willOpen);
      });
      if (this.els.btnCloseDiceHistory) {
        this.els.btnCloseDiceHistory.addEventListener('click', () => this.setDiceHistoryOpen(false));
      }
      if (this.els.btnClearDiceHistory) {
        this.els.btnClearDiceHistory.addEventListener('click', () => Service.clearDiceHistory());
      }
      document.addEventListener('pointerdown', (e) => {
        if (
          this.els.diceHistoryPopover.classList.contains('is-open') &&
          !e.target.closest('#diceHistoryPopover') &&
          !e.target.closest('#btnDiceHistory')
        ) {
          this.setDiceHistoryOpen(false);
        }
      });
    }

    if (this.els.btnDiceCustomize && this.els.diceStylePopover) {
      this.els.btnDiceCustomize.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !this.els.diceStylePopover.classList.contains('is-open');
        this.setDicePopoverOpen(willOpen);
      });
      this.els.btnCloseDiceStyle.addEventListener('click', () => this.setDicePopoverOpen(false));
      this.els.btnResetDiceStyle.addEventListener('click', () => Service.resetDiceStyle());

      document.addEventListener('pointerdown', (e) => {
        if (
          this.els.diceStylePopover.classList.contains('is-open') &&
          !e.target.closest('#diceStylePopover') &&
          !e.target.closest('#btnDiceCustomize')
        ) {
          this.setDicePopoverOpen(false);
        }
      });

      let diceColorPreviewTimer = null;
      const bindLiveColorInput = (inputEl, key) => {
        if (!inputEl) return;
        inputEl.addEventListener('input', (e) => {
          const val = e.target.value;
          if (this.els.btnDiceCustomize) {
            if (key === 'bodyColor') this.els.btnDiceCustomize.style.backgroundColor = val;
            if (key === 'bevelColor') this.els.btnDiceCustomize.style.borderColor = val;
          }
          if (key === 'numberColor' && this.els.diceStyleDot) {
            this.els.diceStyleDot.style.backgroundColor = val;
          }
          if (!diceColorPreviewTimer && this.els.dicePreviewCanvas) {
            diceColorPreviewTimer = setTimeout(() => {
              diceColorPreviewTimer = null;
              requestAnimationFrame(() => {
                if (this.els.diceStylePopover?.classList.contains('is-open')) {
                  Dice3DEngine.clearTextureCache();
                  Dice3DEngine.updatePreview(
                    this.els.dicePreviewCanvas,
                    {
                      ...(Service.state.dice.style || {}),
                      bodyColor: this.els.inpDiceBodyColor.value,
                      bevelColor: this.els.inpDiceBevelColor.value,
                      numberColor: this.els.inpDiceNumberColor.value
                    },
                    this.activeDiceSymbolTab === 'minSymbol'
                  );
                }
              });
            }, 90);
          }
        });
        inputEl.addEventListener('change', (e) => {
          if (diceColorPreviewTimer) {
            clearTimeout(diceColorPreviewTimer);
            diceColorPreviewTimer = null;
          }
          Service.updateDiceStyle({ [key]: e.target.value });
        });
      };

      bindLiveColorInput(this.els.inpDiceBodyColor, 'bodyColor');
      bindLiveColorInput(this.els.inpDiceBevelColor, 'bevelColor');
      bindLiveColorInput(this.els.inpDiceNumberColor, 'numberColor');

      const bindSwatches = (attr, key) => {
        this.els.diceStylePopover.querySelectorAll(`[${attr}]`).forEach((btn) => {
          btn.addEventListener('click', () => Service.updateDiceStyle({ [key]: btn.getAttribute(attr) }));
        });
      };
      bindSwatches('data-body-swatch', 'bodyColor');
      bindSwatches('data-bevel-swatch', 'bevelColor');
      bindSwatches('data-number-swatch', 'numberColor');

      this.els.diceStylePopover.querySelectorAll('[data-dice-size]').forEach((btn) => {
        btn.addEventListener('click', () => Service.updateDiceStyle({ sizeScale: Number(btn.dataset.diceSize) }));
      });
      this.els.diceStylePopover.querySelectorAll('[data-dice-bevel]').forEach((btn) => {
        btn.addEventListener('click', () => Service.updateDiceStyle({ bevelSize: Number(btn.dataset.diceBevel) }));
      });

      this.els.diceStylePopover.querySelectorAll('[data-symbol-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeDiceSymbolTab = btn.dataset.symbolTab;
          this.syncDiceStyleUI(Service.state.dice.style);
        });
      });

      this.els.diceStylePopover.querySelectorAll('[data-dice-glyph]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Service.updateDiceStyle({ [this.activeDiceSymbolTab]: btn.dataset.diceGlyph });
        });
      });

      this.els.inpDiceCustomSymbol.addEventListener('input', (e) => {
        Service.updateDiceStyle({ [this.activeDiceSymbolTab]: e.target.value });
      });
    }
  },

  syncDiceStyleUI(st) {
    if (!st || !this.els.diceStylePopover) return;
    const pop = this.els.diceStylePopover;
    const body = (st.bodyColor || '#8b5cf6').toLowerCase();
    const bevel = (st.bevelColor || '#0f172a').toLowerCase();
    const num = (st.numberColor || '#ffffff').toLowerCase();

    this.els.inpDiceBodyColor.value = body;
    this.els.inpDiceBevelColor.value = bevel;
    this.els.inpDiceNumberColor.value = num;

    const markSwatch = (attr, val) => {
      pop.querySelectorAll(`[${attr}]`).forEach((btn) => {
        btn.classList.toggle('is-active', (btn.getAttribute(attr) || '').toLowerCase() === val);
      });
    };
    markSwatch('data-body-swatch', body);
    markSwatch('data-bevel-swatch', bevel);
    markSwatch('data-number-swatch', num);

    const sz = Number(st.sizeScale) || 1;
    pop.querySelectorAll('[data-dice-size]').forEach((btn) => {
      btn.classList.toggle('is-active', Math.abs(Number(btn.dataset.diceSize) - sz) < 0.06);
    });

    const bv = st.bevelSize !== undefined ? Number(st.bevelSize) : 1;
    pop.querySelectorAll('[data-dice-bevel]').forEach((btn) => {
      btn.classList.toggle('is-active', Math.abs(Number(btn.dataset.diceBevel) - bv) < 0.25);
    });

    const tab = this.activeDiceSymbolTab || 'maxSymbol';
    pop.querySelectorAll('[data-symbol-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.symbolTab === tab);
    });

    const activeSym = st[tab] || '';
    let matchedGlyph = false;
    pop.querySelectorAll('[data-dice-glyph]').forEach((btn) => {
      const hit = btn.dataset.diceGlyph === activeSym;
      if (hit) matchedGlyph = true;
      btn.classList.toggle('is-active', hit);
    });
    if (document.activeElement !== this.els.inpDiceCustomSymbol) {
      this.els.inpDiceCustomSymbol.value = matchedGlyph ? '' : activeSym;
    }

    if (pop.classList.contains('is-open') && this.els.dicePreviewCanvas) {
      Dice3DEngine.updatePreview(this.els.dicePreviewCanvas, st, tab === 'minSymbol');
    }
  },

  renderDiceHistory(history) {
    const listEl = this.els.diceHistoryList;
    if (!listEl) return;

    const entries = Array.isArray(history) ? history : [];
    listEl.replaceChildren();

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-[11px] opacity-55 text-center py-6';
      empty.textContent = 'Sin tiradas recientes.';
      listEl.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'owl-subpanel rounded-xl px-2.5 py-2 flex items-center justify-between gap-2';

      const left = document.createElement('div');
      left.className = 'min-w-0 flex flex-col gap-0.5';

      const titleLine = document.createElement('div');
      titleLine.className = 'flex items-center gap-1.5 min-w-0';

      const title = document.createElement('span');
      title.className = 'font-medium text-[11px] truncate';
      title.textContent = entry.label || `1d${entry.sides || 20}`;
      titleLine.appendChild(title);

      if (entry.visibility === 'private') {
        const privBadge = document.createElement('span');
        privBadge.className = 'text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 shrink-0 font-medium';
        privBadge.textContent = entry.rollerRole === 'gm' ? 'Solo DJ' : 'Privada · DJ';
        titleLine.appendChild(privBadge);
      }

      if (entry.time) {
        const time = document.createElement('span');
        time.className = 'text-[10px] opacity-45 shrink-0 tabular-nums';
        time.textContent = entry.time;
        titleLine.appendChild(time);
      }
      left.appendChild(titleLine);

      const diceValues = Array.isArray(entry.dice) ? entry.dice.map((d) => d.chosen) : [entry.chosen];
      const mod = Number(entry.mod) || 0;
      const modStr = mod !== 0 ? (mod > 0 ? ` +${mod}` : ` ${mod}`) : '';
      const detailParts = [`[${diceValues.join(', ')}]${modStr}`];
      if (entry.message) detailParts.push(entry.message);

      const detail = document.createElement('div');
      detail.className = 'text-[10px] opacity-60 truncate font-mono-tech';
      detail.textContent = detailParts.join(' · ');
      left.appendChild(detail);

      const total = document.createElement('span');
      let totalTone = '';
      if (entry.isCrit) totalTone = 'text-emerald-400';
      else if (entry.isFumble) totalTone = 'text-rose-400';
      total.className = `font-mono-tech font-bold text-sm tabular-nums shrink-0 ${totalTone}`;
      total.textContent = entry.headline || String(entry.total ?? entry.chosen ?? '');

      row.appendChild(left);
      row.appendChild(total);
      listEl.appendChild(row);
    }
  },

  renderDiceReadout(state) {
    const mod = state.dice.modifier;
    this.els.lblDiceMod.textContent = mod >= 0 ? `+${mod}` : `${mod}`;
    this.els.lblDiceMod.style.color = mod !== 0 ? 'var(--accent-primary)' : '';

    const activeMode = state.dice.resultMode || 'sum';
    if (this.els.diceResultSeg) {
      this.els.diceResultSeg.querySelectorAll('[data-result-mode]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.resultMode === activeMode);
      });
    }

    const activeVis = state.dice.visibility || 'public';
    if (this.els.diceVisibilitySeg) {
      this.els.diceVisibilitySeg.querySelectorAll('[data-dice-vis]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.diceVis === activeVis);
      });
    }

    if (this.els.btnDiceCustomize && state.dice.style) {
      this.els.btnDiceCustomize.style.backgroundColor = state.dice.style.bodyColor || '#8b5cf6';
      this.els.btnDiceCustomize.style.borderColor = state.dice.style.bevelColor || '#0f172a';
      if (this.els.diceStyleDot) {
        this.els.diceStyleDot.style.backgroundColor = state.dice.style.numberColor || '#ffffff';
      }
    }

    this.syncDiceStyleUI(state.dice.style);
    this.renderDiceHistory(state.dice.history);

    const hand = Array.isArray(state.dice.hand) ? state.dice.hand : [];
    const handCounts = new Map();
    for (const sides of hand) {
      handCounts.set(sides, (handCounts.get(sides) || 0) + 1);
    }
    if (this.els.diceTrayBar) {
      for (const btn of this.els.diceTrayBar.querySelectorAll('[data-die]')) {
        const count = handCounts.get(Number(btn.dataset.die)) || 0;
        if (count > 0) {
          btn.dataset.count = String(count);
        } else {
          delete btn.dataset.count;
        }
      }
    }
    if (this.els.diceHandCursor) {
      if (hand.length > 0) {
        this.els.diceHandCursor.classList.remove('hidden');
        this.els.diceHandCursor.classList.add('flex');
        this.els.lblDiceHandCount.textContent = String(hand.length);
        this.els.stage.style.cursor = 'grabbing';
      } else {
        this.els.diceHandCursor.classList.add('hidden');
        this.els.diceHandCursor.classList.remove('flex');
        this.els.stage.style.cursor = '';
      }
    }

    const roll = state.dice.lastRoll;
    if (!roll) return;
    if (!Dice3DEngine.isFlying && roll !== this.dismissedRoll) {
      this.els.dice3dOverlay.classList.add('is-open');
    }
    const diceList = Array.isArray(roll.dice) && roll.dice.length > 0
      ? roll.dice
      : [{ sides: roll.sides, chosen: roll.chosen }];
    const summary = Service.computeRollSummary(diceList, roll.mod, activeMode);
    this.currentRollTotal = Math.max(0, Number(summary.total) || 0);
    if (this.els.diceRollActions) {
      const hasTarget = Boolean(state.selectedTokenId && this.currentRollTotal > 0);
      this.els.diceRollActions.classList.toggle('hidden', !hasTarget);
      this.els.diceRollActions.classList.toggle('flex', hasTarget);
    }
    const modTxt = roll.mod === 0 ? '' : roll.mod > 0 ? ` + ${roll.mod}` : ` − ${Math.abs(roll.mod)}`;
    this.els.lblDiceFormula.textContent = `${roll.label || '1d' + roll.sides}${modTxt}`;
    if (this.els.lblDiceMessage) {
      const msgText = String(roll.message || '').trim();
      this.els.lblDiceMessage.textContent = msgText;
      this.els.lblDiceMessage.classList.toggle('hidden', !msgText);
    }

    if (this.els.lblDiceBadge) {
      const modeNames = { each: 'c/u', max: 'Mayor', min: 'Menor' };
      let badgeText = '';
      let badgeClass = 'owl-roll-pill';
      if (summary.isCrit) {
        badgeText = 'Crítico';
        badgeClass = 'owl-roll-pill is-crit';
      } else if (summary.isFumble) {
        badgeText = 'Pifia';
        badgeClass = 'owl-roll-pill is-fumble';
      } else if (modeNames[activeMode]) {
        badgeText = modeNames[activeMode];
      }
      if (roll.visibility === 'private') {
        const privLabel = roll.rollerRole === 'gm' ? 'Solo DJ' : 'Privada · DJ';
        badgeText = badgeText ? `${badgeText} · ${privLabel}` : privLabel;
      }
      this.els.lblDiceBadge.className = badgeText ? badgeClass : 'owl-roll-pill hidden';
      this.els.lblDiceBadge.textContent = badgeText;
    }

    const glowColor = summary.isCrit
      ? 'rgba(16, 185, 129, 0.28)'
      : summary.isFumble
        ? 'rgba(239, 68, 68, 0.28)'
        : 'rgba(139, 92, 246, 0.22)';
    this.els.dice3dOverlay.style.setProperty('--roll-glow', glowColor);

    const isEachMulti = activeMode === 'each' && diceList.length > 1;
    this.els.lblDiceTotal.classList.toggle('hidden', isEachMulti);
    this.els.lblDiceTotal.textContent = summary.headline;
    this.els.lblDiceTotal.style.color = summary.isCrit
      ? 'var(--crit-text)'
      : summary.isFumble
        ? 'var(--fumble-text)'
        : 'var(--text-primary)';

    if (this.els.diceRollChips) {
      if (diceList.length > 1) {
        const pickedIdx = activeMode === 'max'
          ? diceList.reduce((best, d, i, arr) => (d.chosen > arr[best].chosen ? i : best), 0)
          : activeMode === 'min'
            ? diceList.reduce((best, d, i, arr) => (d.chosen < arr[best].chosen ? i : best), 0)
            : -1;
        this.els.diceRollChips.classList.remove('hidden');
        this.els.diceRollChips.classList.add('flex');
        this.els.diceRollChips.innerHTML = diceList.map((d, i) => {
          const val = isEachMulti ? d.chosen + roll.mod : d.chosen;
          const cls = isEachMulti
            ? 'owl-roll-chip is-hero'
            : i === pickedIdx
              ? 'owl-roll-chip is-picked'
              : 'owl-roll-chip';
          return `<span class="${cls}" title="d${d.sides}: ${d.chosen}">${val}</span>`;
        }).join('');
      } else {
        this.els.diceRollChips.classList.add('hidden');
        this.els.diceRollChips.classList.remove('flex');
        this.els.diceRollChips.innerHTML = '';
      }
    }

    if (diceList.length === 1) {
      this.els.lblDiceDetail.textContent = roll.mod !== 0
        ? `Natural ${diceList[0].chosen}${modTxt}`
        : `Natural ${diceList[0].chosen}`;
    } else if (isEachMulti) {
      this.els.lblDiceDetail.textContent = roll.mod !== 0
        ? `Base: ${diceList.map((d) => d.chosen).join(' · ')}`
        : `${diceList.length} dados individuales`;
    } else {
      this.els.lblDiceDetail.textContent = activeMode === 'max'
        ? `Mayor de ${diceList.length} dados`
        : activeMode === 'min'
          ? `Menor de ${diceList.length} dados`
          : `Suma de ${diceList.length} dados`;
    }
  }
};
