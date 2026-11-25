/* ==========================================================================
   SYSTEM OPTIONS VIEW: PREFERENCIAS ESTILO APPLE (REGLAS, INICIATIVA Y ESTADOS)
   ========================================================================== */

import { DEFAULT_STATUS_DEFS, SYSTEM_PRESETS } from '../core/model.js?v=20261125a1';
import { Selector } from '../core/selector.js?v=20261125a1';
import { Service } from '../core/service.js?v=20261125a1';
import { displayValueToMeters, formatDistance, metersToDisplayValue } from '../utils/lightingModel.js?v=20261125a1';
import { SVG_ICONS, SystemBlockBuilderViewMethods } from './systemBlockBuilderView.js?v=20261125a1';

export const SystemOptionsViewMethods = {
  ...SystemBlockBuilderViewMethods,

  openSystemModal() {
    if (!this.els.systemModal) return;
    if (!this.sysModalSection) this.sysModalSection = 'rules';
    this.renderSystemModal(Service.state);
    this.els.systemModal.classList.add('is-open');
  },

  renderSystemModal(state) {
    const body = this.els.systemModalBody;
    if (!body) return;
    const esc = (s) => this.escapeHtml(s);

    let cfg = state.systemConfig || SYSTEM_PRESETS.free;
    const presetKey = 'free';
    const presetInfo = SYSTEM_PRESETS.free;
    const isGeneric = true;
    if (!Array.isArray(cfg.sheetBlocks) || !Array.isArray(cfg.sheetTabs)) {
      Service.ensureGenericBlocksInitialized(true);
      cfg = Service.state.systemConfig;
    }
    const enabledTabs = cfg.enabledTabs || { skills: true, traits: true, inventory: true };
    const activeSection = ['rules', 'sheet', 'statuses', 'gmscreen'].includes(this.sysModalSection) ? this.sysModalSection : 'rules';

    if (this.els.lblSystemModalTitle) {
      this.els.lblSystemModalTitle.textContent = `${state.room?.moduleTitle || state.room?.code || 'Portal'} · ${presetInfo.label}`;
    }
    const modalPanel = this.els.systemModalPanel || body.parentElement;
    if (modalPanel?.classList) {
      modalPanel.classList.remove('max-w-xl', 'max-w-5xl');
      modalPanel.classList.add('max-w-2xl');
    }

    const renderSwitch = (attrsHtml, checked) => `
      <span class="portal-switch">
        <input type="checkbox" ${attrsHtml} ${checked ? 'checked' : ''} class="portal-switch-input" />
        <span class="portal-switch-track"></span>
      </span>
    `;

    const renderCheck = (id, checked, label, hint = '') => `
      <label class="portal-settings-row cursor-pointer select-none">
        <span class="flex flex-col min-w-0">
          <span class="text-xs font-medium leading-tight">${label}</span>
          ${hint ? `<span class="text-[10.5px] opacity-60 leading-snug mt-0.5">${hint}</span>` : ''}
        </span>
        ${renderSwitch(`data-sys-toggle="${id}"`, checked)}
      </label>
    `;

    const renderPresetHeader = () => `
      <div class="portal-settings-group">
        <div class="portal-settings-row">
          <div class="flex flex-col min-w-0">
            <span class="text-xs font-semibold leading-tight">${esc(presetInfo.label)}</span>
            <span class="text-[10.5px] opacity-60 truncate mt-0.5">${
              isGeneric
                ? `Constructor modular · Dado base: <code class="font-mono-tech">${esc(cfg.rollFormula || '1d20+@stat')}</code>`
                : `Dado base: <code class="font-mono-tech">${esc(cfg.rollFormula)}</code>`
            }</span>
          </div>
          <span class="text-[10.5px] px-2.5 py-1 rounded-full portal-panel font-medium opacity-80 shrink-0">Sistema fijo del portal</span>
        </div>
      </div>
    `;

    const trayTools = Selector.getSystemTrayTools(state);
    const trayDiceSet = new Set(trayTools.dice);
    const activeResultModes = new Set(Selector.getSystemResultModes(state));
    const renderTrayToolsSection = () => `
      <div class="flex flex-col gap-1.5">
        <span class="portal-settings-label">Barra de herramientas de mesa</span>
        <div class="portal-settings-group">
          <div class="portal-settings-col">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium">Dados y utilidades visibles</span>
              <span class="text-[10px] opacity-55">Dock inferior</span>
            </div>
            <div class="flex flex-wrap gap-1">
              ${['4', '6', '8', '10', '12', '20', '30', '100']
                .map((d) => `<button type="button" data-sys-tray-tool="${d}" class="portal-btn px-2 py-1 rounded-lg text-[10.5px] font-mono-tech font-semibold ${trayDiceSet.has(d) ? 'portal-btn-accent' : 'portal-panel opacity-60'}">d${d}</button>`)
                .join('')}
              <button type="button" data-sys-tray-tool="fudge" class="portal-btn px-2 py-1 rounded-lg text-[10.5px] font-semibold gap-1 ${trayTools.fudge ? 'portal-btn-accent' : 'portal-panel opacity-60'}">${SVG_ICONS.roll}<span>dF</span></button>
              <button type="button" data-sys-tray-tool="coin" class="portal-btn px-2 py-1 rounded-lg text-[10.5px] font-semibold gap-1 ${trayTools.coin ? 'portal-btn-accent' : 'portal-panel opacity-60'}">${SVG_ICONS.coin}<span>Moneda</span></button>
              <button type="button" data-sys-tray-tool="deck" class="portal-btn px-2 py-1 rounded-lg text-[10.5px] font-semibold gap-1 ${trayTools.deck ? 'portal-btn-accent' : 'portal-panel opacity-60'}">${SVG_ICONS.deck}<span>Baraja</span></button>
            </div>
          </div>
          <div class="portal-settings-row flex-wrap">
            <span class="text-xs font-medium">Modos de lectura</span>
            <div class="flex flex-wrap items-center gap-1">
              ${[
                ['sum', 'Total'],
                ['each', 'c/u'],
                ['max', 'Máx'],
                ['min', 'Mín'],
                ['success', 'Éxitos']
              ]
                .map(([k, lbl]) => `<button type="button" data-sys-result-mode-toggle="${k}" class="portal-btn px-2 py-1 rounded-lg text-[10.5px] font-semibold ${activeResultModes.has(k) ? 'portal-btn-accent' : 'portal-panel opacity-60'}">${lbl}</button>`)
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    const initOp = this.sysInitFormulaOp === '-' ? '-' : '+';
    const initGrouping = cfg.initGrouping === 'individual' ? 'individual' : 'group';
    const initNpcMode = cfg.initNpcMode === 'manual' ? 'manual' : 'fast';
    const trackerPublic = cfg.combatTrackerPublic !== false;
    const initFormulaVal = cfg.initiativeFormula ?? (isGeneric ? '1d20+@agi' : '1d20+@des');

    const renderInitiativeSection = () => `
      <div class="flex flex-col gap-1.5">
        <span class="portal-settings-label">Iniciativa y Combate</span>
        <div class="portal-settings-group">
          <div class="portal-settings-col">
            <div class="flex items-center gap-1.5">
              <input type="text" id="inpSysInitFormula" value="${esc(initFormulaVal)}" placeholder="Ej: 1d20+@agi o 1carta" class="portal-input flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono-tech" title="Fórmula exclusiva de Iniciativa" />
              <button type="button" id="btnSysInitClear" class="portal-btn portal-panel px-2.5 py-1.5 rounded-lg text-[10.5px] opacity-80 hover:opacity-100 shrink-0" title="Vaciar fórmula de iniciativa">Limpiar</button>
            </div>
            ${this.renderFormulaChipsBar(state, {
              opAttr: 'data-sys-init-op',
              opVal: initOp,
              dieAttr: 'data-sys-init-die',
              statAttr: 'data-sys-init-stat',
              includeCard: true
            })}
          </div>
          <div class="portal-settings-row">
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-medium">Agrupación de Secundarios</span>
              <span class="text-[10.5px] opacity-60">Agrupa copias del mismo tipo en una sola entrada o separa cada ficha.</span>
            </div>
            <div class="portal-seg inline-grid grid-cols-2 gap-0.5 text-[10.5px] shrink-0">
              <button type="button" data-sys-init-grouping="group" class="portal-seg-btn px-2.5 py-1 font-medium ${initGrouping === 'group' ? 'is-active' : ''}">Por grupo</button>
              <button type="button" data-sys-init-grouping="individual" class="portal-seg-btn px-2.5 py-1 font-medium ${initGrouping === 'individual' ? 'is-active' : ''}">Individual</button>
            </div>
          </div>
          <div class="portal-settings-row">
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-medium">Tirada de Secundarios</span>
              <span class="text-[10.5px] opacity-60">Rápida calcula el número sin dados 3D; Manual pide tirar en pantalla.</span>
            </div>
            <div class="portal-seg inline-grid grid-cols-2 gap-0.5 text-[10.5px] shrink-0">
              <button type="button" data-sys-init-npc-mode="fast" class="portal-seg-btn px-2.5 py-1 font-medium ${initNpcMode === 'fast' ? 'is-active' : ''}">Rápida</button>
              <button type="button" data-sys-init-npc-mode="manual" class="portal-seg-btn px-2.5 py-1 font-medium ${initNpcMode === 'manual' ? 'is-active' : ''}">Manual</button>
            </div>
          </div>
          <div class="portal-settings-row">
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-medium">Visibilidad del Tracker</span>
              <span class="text-[10.5px] opacity-60">Define si los jugadores pueden desplegar la lista de turnos o solo ven el foco activo.</span>
            </div>
            <div class="portal-seg inline-grid grid-cols-2 gap-0.5 text-[10.5px] shrink-0">
              <button type="button" data-sys-tracker-public="1" class="portal-seg-btn px-2.5 py-1 font-medium ${trackerPublic ? 'is-active' : ''}">Todos</button>
              <button type="button" data-sys-tracker-public="0" class="portal-seg-btn px-2.5 py-1 font-medium ${!trackerPublic ? 'is-active' : ''}">Solo Narrador</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const baseOp = this.sysBaseFormulaOp === '-' ? '-' : '+';
    const statuses = Selector.getSystemStatuses(state);
    const iconKeys = DEFAULT_STATUS_DEFS.map((d) => d.icon);

    const renderRulesPane = () => {
      const oc = Selector.getSystemOutcomeConfig(state);
      const rule = oc.outcomeRule;
      const labelFields = [];
      if (rule === 'low' || rule === 'tiered') labelFields.push(['success', rule === 'tiered' ? 'Éxito total' : 'Éxito', oc.labels.success]);
      if (rule === 'tiered') labelFields.push(['partial', 'Parcial', oc.labels.partial]);
      if (rule === 'low' || rule === 'tiered') labelFields.push(['fail', 'Fallo', oc.labels.fail]);
      if (rule !== 'none' && oc.showCrits) {
        labelFields.push(['crit', 'Crítico', oc.labels.crit]);
        labelFields.push(['fumble', 'Pifia', oc.labels.fumble]);
      }

      const poolSection = '';

      const genericRollAndOutcome = isGeneric
        ? `<div class="flex flex-col gap-1.5">
            <span class="portal-settings-label">Tirada base del sistema</span>
            <div class="portal-settings-group">
              <div class="portal-settings-col">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div class="flex items-center gap-1.5">
                    <input type="text" id="inpSysRollFormula" value="${esc(cfg.rollFormula ?? '1d20+@stat')}" placeholder="1d20+@stat" class="portal-input flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono-tech" title="Fórmula base (@stat = valor del bloque)" />
                    <button type="button" id="btnSysBaseClear" class="portal-btn portal-panel px-2.5 py-1.5 rounded-lg text-[10.5px] opacity-80 hover:opacity-100 shrink-0" title="Vaciar fórmula base">Limpiar</button>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <select id="selSysResultMode" class="portal-input flex-1 px-2.5 py-1.5 text-xs">
                      <option value="sum" ${(cfg.resultMode || 'sum') === 'sum' ? 'selected' : ''}>Total (suma)</option>
                      <option value="success" ${cfg.resultMode === 'success' ? 'selected' : ''}>Contar Éxitos</option>
                      <option value="each" ${cfg.resultMode === 'each' ? 'selected' : ''}>Cada dado (c/u)</option>
                      <option value="max" ${cfg.resultMode === 'max' ? 'selected' : ''}>Dado Mayor</option>
                      <option value="min" ${cfg.resultMode === 'min' ? 'selected' : ''}>Dado Menor</option>
                    </select>
                    ${
                      cfg.resultMode === 'success'
                        ? `<input type="number" id="inpSysThreshold" min="1" max="100" value="${Number(cfg.successThreshold) || 6}" class="portal-input w-16 px-2 py-1.5 text-xs text-center tabular-nums" title="Éxito ≥" />`
                        : ''
                    }
                  </div>
                </div>
                ${this.renderFormulaChipsBar(state, {
                  opAttr: 'data-sys-base-op',
                  opVal: baseOp,
                  dieAttr: 'data-sys-base-die',
                  statAttr: 'data-sys-base-stat',
                  includeCard: false,
                  extraStatChipHtml: '<button type="button" data-sys-base-stat="stat" class="portal-seg-btn portal-panel px-2 py-0.5 text-[10px] font-semibold" title="Valor del atributo del bloque">@stat</button>'
                })}
                <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span class="text-[10px] opacity-60">Plantillas:</span>
                  ${['1d20+@stat', '2d6+@stat', '@statd10', '4dF+@stat', '1d100']
                    .map((f) => `<button type="button" data-sys-formula-chip="${f}" class="portal-btn portal-panel px-2 py-0.5 rounded-lg text-[10px] font-mono-tech ${cfg.rollFormula === f ? 'portal-btn-accent' : ''}">${f}</button>`)
                    .join('')}
                </div>
                <p class="text-[10px] opacity-55 leading-snug"><code class="font-mono-tech">@stat</code> = valor del bloque · <code class="font-mono-tech">4dF</code> = Fudge · <code class="font-mono-tech">1d2</code> = moneda · <code class="font-mono-tech">1carta</code> = baraja.</p>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="portal-settings-label">Interpretación de resultados</span>
            <div class="portal-settings-group">
              <div class="portal-settings-col">
                <div class="grid grid-cols-1 ${rule === 'tiered' ? 'sm:grid-cols-3' : ''} gap-2 items-end">
                  <label class="flex flex-col gap-1">
                    <span class="text-[10.5px] opacity-70">Regla del sistema</span>
                    <select id="selSysOutcomeRule" class="portal-input px-2.5 py-1.5 text-xs">
                      <option value="none" ${rule === 'none' ? 'selected' : ''}>Solo número (sin etiquetas)</option>
                      <option value="high" ${rule === 'high' ? 'selected' : ''}>A la alta (≥ clásico)</option>
                      <option value="low" ${rule === 'low' ? 'selected' : ''}>A la baja (≤ atributo)</option>
                      <option value="tiered" ${rule === 'tiered' ? 'selected' : ''}>Por rangos (PbtA)</option>
                    </select>
                  </label>
                  ${
                    rule === 'tiered'
                      ? `<label class="flex flex-col gap-1">
                          <span class="text-[10.5px] opacity-70">${esc(oc.labels.success)} ≥</span>
                          <input type="number" id="inpSysTierHigh" value="${oc.tieredHigh}" min="-99" max="999" class="portal-input px-2.5 py-1.5 text-xs text-center tabular-nums" />
                        </label>
                        <label class="flex flex-col gap-1">
                          <span class="text-[10.5px] opacity-70">${esc(oc.labels.partial)} ≥</span>
                          <input type="number" id="inpSysTierMid" value="${oc.tieredMid}" min="-99" max="999" class="portal-input px-2.5 py-1.5 text-xs text-center tabular-nums" />
                        </label>`
                      : ''
                  }
                </div>
                ${
                  rule === 'low'
                    ? '<p class="text-[10px] opacity-65 leading-snug">En <b>A la baja</b>, usa dado limpio arriba (ej. <code class="font-mono-tech">1d20</code> o <code class="font-mono-tech">1d100</code> sin <code class="font-mono-tech">+@stat</code>): compara ≤ valor del bloque y 1 es crítico.</p>'
                    : ''
                }
              </div>
              ${
                rule !== 'none'
                  ? `<label class="portal-settings-row cursor-pointer select-none">
                      <span class="text-xs font-medium">Mostrar Crítico / Pifia</span>
                      ${renderSwitch('id="chkSysShowCrits"', oc.showCrits)}
                    </label>`
                  : ''
              }
              ${
                labelFields.length > 0
                  ? `<div class="portal-settings-col">
                      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        ${labelFields
                          .map(([k, title, val]) => `
                            <label class="flex flex-col gap-1">
                              <span class="text-[10px] opacity-65">Etiqueta: ${title}</span>
                              <input type="text" data-sys-outcome-label="${k}" value="${esc(val)}" class="portal-input px-2 py-1 text-[11px]" />
                            </label>`)
                          .join('')}
                      </div>
                    </div>`
                  : ''
              }
            </div>
          </div>`
        : '';

      return `
        ${renderPresetHeader()}
        ${poolSection}
        ${renderTrayToolsSection()}
        ${genericRollAndOutcome}
        ${renderInitiativeSection()}
        ${(() => {
          const v = Selector.getSystemVisionConfig(state);
          const u = v.distanceUnit;
          const isFt = u === 'ft';
          const nightDisp = metersToDisplayValue(v.nightDetectionMeters, u);
          return `
            <div class="flex flex-col gap-1.5">
              <span class="portal-settings-label">Visión e Iluminación</span>
              <div class="portal-settings-group">
                <div class="portal-settings-row">
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-medium">Unidad de distancia</span>
                    <span class="text-[10.5px] opacity-60">Aplica a reglas, detección nocturna y luces</span>
                  </div>
                  <div class="portal-seg inline-grid grid-cols-2 gap-0.5 text-[10.5px] shrink-0">
                    <button type="button" data-sys-dist-unit="m" class="portal-seg-btn px-2.5 py-1 font-medium ${!isFt ? 'is-active' : ''}">Metros (m)</button>
                    <button type="button" data-sys-dist-unit="ft" class="portal-seg-btn px-2.5 py-1 font-medium ${isFt ? 'is-active' : ''}">Pies (ft)</button>
                  </div>
                </div>
                <div class="portal-settings-col">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-medium">Detección en modo Noche</span>
                    <span id="lblSysNightDetection" class="text-[11px] font-semibold font-mono-tech tabular-nums">${esc(formatDistance(v.nightDetectionMeters, u))}</span>
                  </div>
                  <input type="range" id="rngSysNightDetection" min="0" max="${isFt ? 120 : 36}" step="${isFt ? 5 : 0.5}" value="${nightDisp}" class="portal-slider" />
                  <span class="text-[10px] opacity-55">Distancia a la que se detectan enemigos en modo Noche sin luz ni visión oscura (0 = solo con luz).</span>
                </div>
                <div class="portal-settings-row">
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-medium">Visión de jugadores</span>
                    <span class="text-[10.5px] opacity-60">Individual limita la vista a los tokens asignados a cada jugador.</span>
                  </div>
                  <div class="portal-seg inline-grid grid-cols-2 gap-0.5 text-[10.5px] shrink-0">
                    <button type="button" data-sys-vision-mode="shared" class="portal-seg-btn px-2.5 py-1 font-medium ${v.visionMode !== 'individual' ? 'is-active' : ''}">Compartida</button>
                    <button type="button" data-sys-vision-mode="individual" class="portal-seg-btn px-2.5 py-1 font-medium ${v.visionMode === 'individual' ? 'is-active' : ''}">Individual</button>
                  </div>
                </div>
                <label class="portal-settings-row cursor-pointer select-none">
                  <span class="flex flex-col min-w-0">
                    <span class="text-xs font-medium leading-tight">Recordar área explorada por defecto</span>
                    <span class="text-[10.5px] opacity-60 leading-snug mt-0.5">Conserva en penumbra las zonas ya visitadas de cada escenario</span>
                  </span>
                  ${renderSwitch('id="chkSysRememberExplored"', v.rememberExplored !== false)}
                </label>
              </div>
            </div>
          `;
        })()}
      `;
    };

    const renderGenericStatusesPane = () => `
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between px-1">
          <span class="portal-settings-label !px-0">Estados y condiciones (${statuses.length})</span>
          <div class="flex items-center gap-1.5">
            <button type="button" id="btnSysToggleStatuses" class="portal-btn portal-panel px-2 py-0.5 rounded-lg text-[10.5px] opacity-80">Ver / Ocultar</button>
            <button type="button" id="btnSysResetStatuses" class="portal-btn portal-panel px-2 py-0.5 rounded-lg text-[10.5px]">Restaurar base</button>
          </div>
        </div>
        <div class="portal-settings-group">
          <div class="portal-settings-col">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              ${statuses
                .map(
                  (st) => `
                <div class="portal-panel rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-[11px]">
                  <button type="button" data-sys-cycle-status-icon="${esc(st.key)}" class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white hover:opacity-85" style="background:${esc(st.color)};" title="Cambiar ícono">
                    ${this.renderStatusSymbolSvg(st.icon, 'w-3.5 h-3.5', state)}
                  </button>
                  <input type="text" data-sys-status-label="${esc(st.key)}" value="${esc(st.label)}" class="portal-input flex-1 min-w-0 px-2 py-0.5 text-[11px] font-medium" />
                  <input type="color" data-sys-status-color="${esc(st.key)}" value="${esc(st.color)}" class="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0" title="Color" />
                  ${statuses.length > 1 ? `<button type="button" data-sys-del-status="${esc(st.key)}" class="portal-btn w-5 h-5 p-0 rounded-full text-rose-400 opacity-70 hover:opacity-100 shrink-0" title="Quitar">${SVG_ICONS.close}</button>` : ''}
                </div>`
                )
                .join('')}
            </div>
          </div>
          <form id="sysAddStatusForm" class="portal-settings-col">
            <div class="flex flex-wrap items-center gap-1.5">
              <input type="text" id="inpSysStatusLabel" placeholder="Nuevo estado (ej. Frenesí, Miedo...)" required class="portal-input flex-1 min-w-[140px] px-2.5 py-1.5 text-[11px]" />
              <select id="selSysStatusIcon" class="portal-input w-auto px-2 py-1.5 text-[11px]">
                ${iconKeys.map((ik) => `<option value="${ik}">${ik}</option>`).join('')}
              </select>
              <input type="color" id="inpSysStatusColor" value="#ef4444" class="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0" title="Color" />
              <button type="submit" class="portal-btn portal-btn-accent px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0">+ Estado</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const renderPresetSheetOptions = () => `
      <div class="flex flex-col gap-1.5">
        <span class="portal-settings-label">Opciones de ficha</span>
        <div class="portal-settings-group">
          ${renderCheck('showDefense', cfg.showDefense !== false, 'Bloque Defensa / CA', 'Muestra Defensa e Iniciativa en la cabecera')}
          ${renderCheck('tab_skills', enabledTabs.skills !== false, 'Pestaña Habilidades', 'Lista de pericias de personaje')}
          ${renderCheck('tab_traits', enabledTabs.traits !== false, 'Pestaña Rasgos', 'Rasgos, dotes o movimientos')}
          ${renderCheck('tab_inventory', enabledTabs.inventory !== false, 'Inventario y Capacidades', 'Equipo, consumibles y capacidades desde el Compendio')}
        </div>
      </div>
    `;

    const footerHtml = `
      <div class="flex items-center justify-between gap-2 pt-3 border-t" style="border-color: var(--hairline);">
        <button type="button" id="btnSysOpenCompendium" class="portal-btn portal-subpanel px-3 py-2 rounded-xl text-xs font-medium gap-2">
          ${SVG_ICONS.compendium}
          <span>Administrar Compendio</span>
        </button>
        <button type="button" id="btnSysDone" class="portal-btn portal-btn-accent px-4 py-2 rounded-xl text-xs font-semibold">
          Listo
        </button>
      </div>
    `;

    body.innerHTML = `
      <div class="flex flex-col gap-3">
        <div class="portal-seg grid-cols-4 gap-1">
          <button type="button" data-sys-nav-tab="rules" class="portal-seg-btn py-1.5 text-[11px] font-semibold ${activeSection === 'rules' ? 'is-active' : ''}">Reglas y Dados</button>
          <button type="button" data-sys-nav-tab="sheet" class="portal-seg-btn py-1.5 text-[11px] font-semibold ${activeSection === 'sheet' ? 'is-active' : ''}">${isGeneric ? 'Ficha y Bloques' : 'Opciones de Ficha'}</button>
          <button type="button" data-sys-nav-tab="statuses" class="portal-seg-btn py-1.5 text-[11px] font-semibold ${activeSection === 'statuses' ? 'is-active' : ''}">Estados (${statuses.length})</button>
          <button type="button" data-sys-nav-tab="gmscreen" class="portal-seg-btn py-1.5 text-[11px] font-semibold ${activeSection === 'gmscreen' ? 'is-active' : ''}">Pantalla</button>
        </div>
        <div data-sys-pane="rules" class="${activeSection === 'rules' ? 'flex' : 'hidden'} flex-col gap-3">
          ${renderRulesPane()}
        </div>
        <div data-sys-pane="sheet" class="${activeSection === 'sheet' ? 'flex' : 'hidden'} flex-col gap-3">
          ${isGeneric ? `${this.renderLivePreview(state)}${this.renderGenericSheetPane(state)}` : renderPresetSheetOptions()}
        </div>
        <div data-sys-pane="statuses" class="${activeSection === 'statuses' ? 'flex' : 'hidden'} flex-col gap-3">
          ${renderGenericStatusesPane()}
        </div>
        <div data-sys-pane="gmscreen" class="${activeSection === 'gmscreen' ? 'flex' : 'hidden'} flex-col gap-3">
          ${this.renderGmScreenConfigPane?.(state) || ''}
        </div>
        ${footerHtml}
      </div>
    `;

    if (isGeneric && typeof this.renderSheetBlocksInto === 'function') {
      const allTabs = Selector.getSystemSheetTabs(state);
      const blocks = Selector.getSystemSheetBlocks(state);
      const activePreviewTab = allTabs.find((t) => t.id === this.sysPreviewTabId) || allTabs[0] || null;
      const baseTok = state.tokens?.find((t) => t.id === state.selectedTokenId) || state.tokens?.[0];
      const previewTok = baseTok
        ? JSON.parse(JSON.stringify(baseTok))
        : { id: '__preview__', name: 'Kaelen (Ejemplo)', hp: 14, maxHp: 18, ac: 14, stats: {}, texts: {}, resources: [] };

      const headerBox = body.querySelector('#sysPreviewHeaderBlocks');
      const headerBlocks = blocks.filter((b) => (b.tabId || 'attrs') === 'header');
      if (headerBox) {
        this.renderSheetBlocksInto(headerBox, headerBlocks, previewTok, cfg);
        this.annotatePreviewBlocks(headerBox, headerBlocks);
      }
      if (activePreviewTab?.mode === 'fixed') {
        const tabBox = body.querySelector('#sysPreviewTabBody');
        const tabBlocks = blocks.filter((b) => (b.tabId || 'attrs') === activePreviewTab.id);
        if (tabBox) {
          this.renderSheetBlocksInto(tabBox, tabBlocks, previewTok, cfg, { sumTotal: Boolean(activePreviewTab.sumTotal) });
          this.annotatePreviewBlocks(tabBox, tabBlocks);
        }
      }
    }

    this.bindSystemModalBodyEvents();
  },

  bindSystemModalBodyEvents() {
    const body = this.els.systemModalBody;
    if (!body) return;

    body.querySelectorAll('[data-sys-nav-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysModalSection = btn.dataset.sysNavTab;
        this.renderSystemModal(Service.state);
      });
    });

    body.querySelectorAll('[data-sys-toggle]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const key = chk.dataset.sysToggle;
        if (key.startsWith('tab_')) {
          Service.updateSystemConfig({ enabledTabs: { [key.replace('tab_', '')]: chk.checked } });
        } else {
          Service.updateSystemConfig({ [key]: chk.checked });
        }
      });
    });

    const readBaseFormula = () => String(body.querySelector('#inpSysRollFormula')?.value ?? '').trim();
    const baseOp = this.sysBaseFormulaOp === '-' ? '-' : '+';
    body.querySelector('#inpSysRollFormula')?.addEventListener('change', (e) => {
      Service.updateSystemConfig({ rollFormula: e.target.value.trim() || '1d20+@stat' });
    });
    body.querySelector('#btnSysBaseClear')?.addEventListener('click', () => {
      Service.updateSystemConfig({ rollFormula: '' });
    });
    body.querySelectorAll('[data-sys-base-op]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysBaseFormulaOp = btn.dataset.sysBaseOp === '-' ? '-' : '+';
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-sys-base-die]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ rollFormula: Selector.appendDiceToFormula(readBaseFormula(), btn.dataset.sysBaseDie, baseOp) });
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        Service.updateSystemConfig({ rollFormula: Selector.decrementDiceInFormula(readBaseFormula(), btn.dataset.sysBaseDie) });
      });
    });
    body.querySelectorAll('[data-sys-base-stat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ rollFormula: Selector.appendStatToFormula(readBaseFormula(), btn.dataset.sysBaseStat, baseOp) });
      });
    });
    body.querySelector('#selSysResultMode')?.addEventListener('change', (e) => {
      Service.updateSystemConfig({ resultMode: e.target.value });
    });
    body.querySelector('#inpSysThreshold')?.addEventListener('change', (e) => {
      Service.updateSystemConfig({ successThreshold: Math.max(1, Number(e.target.value) || 6) });
    });
    body.querySelectorAll('[data-sys-formula-chip]').forEach((btn) => {
      btn.addEventListener('click', () => Service.updateSystemConfig({ rollFormula: btn.dataset.sysFormulaChip }));
    });

    const readInitFormula = () => String(body.querySelector('#inpSysInitFormula')?.value ?? '').trim();
    const initOp = this.sysInitFormulaOp === '-' ? '-' : '+';
    body.querySelectorAll('[data-sys-init-grouping]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ initGrouping: btn.dataset.sysInitGrouping === 'individual' ? 'individual' : 'group' });
      });
    });
    body.querySelectorAll('[data-sys-init-npc-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ initNpcMode: btn.dataset.sysInitNpcMode === 'manual' ? 'manual' : 'fast' });
      });
    });
    body.querySelectorAll('[data-sys-tracker-public]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ combatTrackerPublic: btn.dataset.sysTrackerPublic === '1' });
      });
    });
    body.querySelector('#inpSysInitFormula')?.addEventListener('change', (e) => {
      Service.updateSystemConfig({ initiativeFormula: e.target.value.trim() });
    });
    body.querySelector('#btnSysInitClear')?.addEventListener('click', () => {
      Service.updateSystemConfig({ initiativeFormula: '' });
    });
    body.querySelectorAll('[data-sys-init-op]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sysInitFormulaOp = btn.dataset.sysInitOp === '-' ? '-' : '+';
        this.renderSystemModal(Service.state);
      });
    });
    body.querySelectorAll('[data-sys-init-die]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ initiativeFormula: Selector.appendDiceToFormula(readInitFormula(), btn.dataset.sysInitDie, initOp) });
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        Service.updateSystemConfig({ initiativeFormula: Selector.decrementDiceInFormula(readInitFormula(), btn.dataset.sysInitDie) });
      });
    });
    body.querySelectorAll('[data-sys-init-stat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemConfig({ initiativeFormula: Selector.appendStatToFormula(readInitFormula(), btn.dataset.sysInitStat, initOp) });
      });
    });

    body.querySelectorAll('[data-sys-result-mode-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => Service.toggleSystemResultMode(btn.dataset.sysResultModeToggle));
    });
    body.querySelector('#selSysOutcomeRule')?.addEventListener('change', (e) => {
      Service.updateSystemOutcome({ outcomeRule: e.target.value });
    });
    body.querySelector('#chkSysShowCrits')?.addEventListener('change', (e) => {
      Service.updateSystemOutcome({ showCrits: e.target.checked });
    });
    body.querySelector('#inpSysTierHigh')?.addEventListener('change', (e) => {
      Service.updateSystemOutcome({ tieredHigh: Math.trunc(Number(e.target.value) || 10) });
    });
    body.querySelector('#inpSysTierMid')?.addEventListener('change', (e) => {
      Service.updateSystemOutcome({ tieredMid: Math.trunc(Number(e.target.value) || 7) });
    });
    body.querySelectorAll('[data-sys-outcome-label]').forEach((inp) => {
      inp.addEventListener('change', () => {
        Service.updateSystemOutcome({ outcomeLabels: { [inp.dataset.sysOutcomeLabel]: inp.value.trim() } });
      });
    });

    body.querySelector('#btnSysToggleStatuses')?.addEventListener('click', () => {
      this.sysStatusesExpanded = !this.sysStatusesExpanded;
      this.sysModalSection = this.sysModalSection === 'statuses' ? 'rules' : 'statuses';
      this.renderSystemModal(Service.state);
    });
    const iconOrder = DEFAULT_STATUS_DEFS.map((d) => d.icon);
    body.querySelectorAll('[data-sys-cycle-status-icon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sysCycleStatusIcon;
        const cur = Selector.getStatusDef(Service.state, key);
        Service.updateSystemStatusDef(key, { icon: iconOrder[(iconOrder.indexOf(cur.icon) + 1) % iconOrder.length] });
      });
    });
    body.querySelectorAll('[data-sys-status-label]').forEach((inp) => {
      inp.addEventListener('change', () => {
        if (inp.value.trim()) Service.updateSystemStatusDef(inp.dataset.sysStatusLabel, { label: inp.value.trim() });
      });
    });
    body.querySelectorAll('[data-sys-status-color]').forEach((inp) => {
      inp.addEventListener('change', () => Service.updateSystemStatusDef(inp.dataset.sysStatusColor, { color: inp.value }));
    });
    body.querySelectorAll('[data-sys-del-status]').forEach((btn) => {
      btn.addEventListener('click', () => Service.removeSystemStatusDef(btn.dataset.sysDelStatus));
    });
    body.querySelector('#btnSysResetStatuses')?.addEventListener('click', () => Service.resetSystemStatuses());
    body.querySelector('#sysAddStatusForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const label = body.querySelector('#inpSysStatusLabel')?.value.trim();
      const icon = body.querySelector('#selSysStatusIcon')?.value || 'mark';
      const color = body.querySelector('#inpSysStatusColor')?.value || '#ef4444';
      if (label && !Service.addSystemStatusDef({ label, icon, color })) {
        this.showActionToast('Ya existe un estado con ese nombre.');
      }
    });

    body.querySelectorAll('[data-sys-tray-tool]').forEach((btn) => {
      btn.addEventListener('click', () => Service.toggleSystemTrayTool(btn.dataset.sysTrayTool));
    });

    body.querySelectorAll('[data-sys-dist-unit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemVisionConfig({ distanceUnit: btn.dataset.sysDistUnit === 'ft' ? 'ft' : 'm' });
      });
    });
    const rngNight = body.querySelector('#rngSysNightDetection');
    const lblNight = body.querySelector('#lblSysNightDetection');
    rngNight?.addEventListener('input', () => {
      const u = Selector.getSystemVisionConfig(Service.state).distanceUnit;
      const meters = displayValueToMeters(Number(rngNight.value) || 0, u);
      if (lblNight) lblNight.textContent = formatDistance(meters, u);
    });
    rngNight?.addEventListener('change', () => {
      const u = Selector.getSystemVisionConfig(Service.state).distanceUnit;
      Service.updateSystemVisionConfig({ nightDetectionMeters: displayValueToMeters(Number(rngNight.value) || 0, u) });
    });
    body.querySelectorAll('[data-sys-vision-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Service.updateSystemVisionConfig({ visionMode: btn.dataset.sysVisionMode === 'individual' ? 'individual' : 'shared' });
      });
    });
    body.querySelector('#chkSysRememberExplored')?.addEventListener('change', (e) => {
      Service.updateSystemVisionConfig({ rememberExplored: e.target.checked });
    });

    body.querySelector('#btnSysOpenCompendium')?.addEventListener('click', () => {
      this.els.systemModal?.classList.remove('is-open');
      Service.state.drawerOpen = true;
      Service.notify({ skipVaultSave: true });
    });
    body.querySelector('#btnSysDone')?.addEventListener('click', () => this.els.systemModal?.classList.remove('is-open'));

    this.bindSystemBlockBuilderEvents(body);
    this.bindGmScreenConfigEvents?.(body);
  }
};
