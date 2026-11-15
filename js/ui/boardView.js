import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS, COMPENDIUM_MAPS } from '../data/compendium.js';
import { CartridgePacker } from '../services/cartridgePacker.js';
import { WebPConverter } from '../utils/webpConverter.js?v=20261114m';
import { Selector } from '../core/selector.js';
import { Service } from '../core/service.js?v=20261115v';

/**
 * Board pointer interactions, global drag-and-drop, keyboard shortcuts, context menu & tokens layer.
 */
export const BoardViewMethods = {
  bindBoardEvents() {
    // 1. Interacciones de puntero en el escenario (Arrastre fichas, cámara, regla, dibujo, niebla, clic derecho)
    let activePointerMode = null; // 'token' | 'pan' | 'rightPan' | 'ruler' | 'draw' | 'fog'
    let draggingTokenId = null;
    let startClient = { x: 0, y: 0 };
    let startCam = { x: 0, y: 0 };
    let movedDistance = 0;
    let currentStroke = null;

    this.els.stage.addEventListener('pointerdown', (e) => {
      this.hideContextMenu();
      if (e.target.closest('.owl-panel')) return;

      // Si hay dados recogidos en mano, clic izquierdo sobre la mesa los lanza hacia ese punto
      if (e.button === 0 && Array.isArray(Service.state.dice.hand) && Service.state.dice.hand.length > 0) {
        Service.throwDiceHand(e.clientX, e.clientY);
        return;
      }

      startClient = { x: e.clientX, y: e.clientY };
      startCam = { x: Service.state.camera.x, y: Service.state.camera.y };
      movedDistance = 0;

      // Clic derecho -> preparar paneo o menú contextual
      if (e.button === 2) {
        activePointerMode = 'rightPan';
        if (e.target.closest('[data-map-note]')) return;
        const tokEl = e.target.closest('[data-token-id]');
        this.ctxTargetTokenId = tokEl ? tokEl.dataset.tokenId : null;
        this.ctxWorldPos = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
        return;
      }

      // Botón central -> paneo
      if (e.button === 1) {
        activePointerMode = 'pan';
        return;
      }

      if (e.target.closest('[data-map-note]')) return;
      const tokEl = e.target.closest('[data-token-id]');
      const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
      const tool = Service.state.tool;

      // Clic sobre puerta interactiva abre/cierra el paso de luz
      if (tool !== 'wall' && tool !== 'ruler' && tool !== 'draw') {
        const nearDoor = Selector.findDoorNearPoint(Service.state, worldPt.x, worldPt.y, 20);
        if (nearDoor && !tokEl) {
          const updated = Service.toggleDoor(nearDoor.id);
          if (updated) this.showActionToast(updated.open ? '🚪 Puerta abierta' : '🚪 Puerta cerrada');
          return;
        }
      }

      if (tokEl && (tool === 'select' || tool === 'pan')) {
        const tok = Service.state.tokens.find((t) => t.id === tokEl.dataset.tokenId);
        Service.selectToken(tokEl.dataset.tokenId, false);
        if (!Service.canControlToken(tok)) {
          this.showActionToast('Solo el DJ o su dueño puede mover esta ficha.');
          return;
        }
        Service.pushUndoSnapshot();
        activePointerMode = 'token';
        draggingTokenId = tokEl.dataset.tokenId;
        this.draggingTokenId = draggingTokenId;
        try {
          if (this.els.stage.isConnected) this.els.stage.setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
      }

      if (tool === 'wall') {
        const cs = Service.state.grid.cellSize / 2;
        const sx = Math.round(worldPt.x / cs) * cs;
        const sy = Math.round(worldPt.y / cs) * cs;
        if (!Service.state.wallAnchor) {
          Service.state.wallAnchor = { x: sx, y: sy };
          Service.notify();
        } else {
          Service.addWallSegment(
            Service.state.wallAnchor.x,
            Service.state.wallAnchor.y,
            sx,
            sy,
            Service.state.wallType
          );
          Service.state.wallAnchor = null;
          Service.notify();
        }
        return;
      }

      if (tool === 'ruler') {
        activePointerMode = 'ruler';
        Service.state.ruler = { x1: worldPt.x, y1: worldPt.y, x2: worldPt.x, y2: worldPt.y };
        Service.notify();
        return;
      }

      if (tool === 'draw') {
        Service.pushUndoSnapshot();
        activePointerMode = 'draw';
        currentStroke = { color: Service.state.drawColor, points: [worldPt] };
        Service.state.strokes.push(currentStroke);
        Service.notify({ redrawDraw: true, skipVaultSave: true });
        return;
      }

      if (tool === 'fog') {
        Service.pushUndoSnapshot();
        activePointerMode = 'fog';
        Service.state.fogRects.push({ x: worldPt.x, y: worldPt.y, r: 90, mode: Service.state.fogMode });
        Service.notify({ redrawFog: true, skipVaultSave: true });
        return;
      }

      if (tool === 'ping') {
        Service.triggerPing(worldPt.x, worldPt.y);
        return;
      }

      // Clic en vacío -> mover cámara
      activePointerMode = 'pan';
    });

    window.addEventListener('pointermove', (e) => {
      const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
      this.hoverWorldPos = worldPt;

      if (Service.state.tool === 'wall' && Service.state.wallAnchor) {
        this.renderVectorOverlay(Service.state);
      }

      if (!activePointerMode) return;
      const dx = e.clientX - startClient.x;
      const dy = e.clientY - startClient.y;
      movedDistance = Math.hypot(dx, dy);

      if (activePointerMode === 'pan' || (activePointerMode === 'rightPan' && movedDistance > 6)) {
        Service.state.camera.x = startCam.x + dx;
        Service.state.camera.y = startCam.y + dy;
        Service.notify({ skipVaultSave: true });
        return;
      }

      if (activePointerMode === 'token' && draggingTokenId) {
        Service.moveToken(draggingTokenId, worldPt.x, worldPt.y, false);
        this.drawFogCanvas(Service.state);
      } else if (activePointerMode === 'ruler' && Service.state.ruler) {
        Service.state.ruler.x2 = worldPt.x;
        Service.state.ruler.y2 = worldPt.y;
        Service.notify({ skipVaultSave: true });
      } else if (activePointerMode === 'draw' && currentStroke) {
        currentStroke.points.push(worldPt);
        Service.notify({ redrawDraw: true, skipVaultSave: true });
      } else if (activePointerMode === 'fog') {
        Service.state.fogRects.push({ x: worldPt.x, y: worldPt.y, r: 90, mode: Service.state.fogMode });
        Service.notify({ redrawFog: true, skipVaultSave: true });
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!activePointerMode) return;
      try {
        if (this.els.stage.hasPointerCapture && this.els.stage.hasPointerCapture(e.pointerId)) {
          this.els.stage.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}

      if (activePointerMode === 'token' && draggingTokenId) {
        const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
        this.draggingTokenId = null;
        Service.moveToken(draggingTokenId, worldPt.x, worldPt.y, true);
        this.drawFogCanvas(Service.state);
      } else if (activePointerMode === 'ruler') {
        Service.state.ruler = null;
        Service.notify({ skipVaultSave: true });
      } else if (activePointerMode === 'draw') {
        Service.recordEvent('TRAZO', 'Marcador táctico');
        Service.notify({ redrawDraw: true });
      } else if (activePointerMode === 'fog') {
        Service.recordEvent('NIEBLA', Service.state.fogMode);
        Service.notify({ redrawFog: true });
      }

      activePointerMode = null;
      draggingTokenId = null;
      currentStroke = null;
    });

    // Doble clic en un token abre su ficha de personaje
    this.els.stage.addEventListener('dblclick', (e) => {
      let tokenId = e.target.closest('[data-token-id]')?.dataset?.tokenId || null;
      if (!tokenId) {
        const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
        const cs = Number(Service.state.grid?.cellSize) || 80;
        const hit = [...(Service.state.tokens || [])].reverse().find((tok) => {
          if (tok.hidden && Service.state.role !== 'gm') return false;
          const radius = (cs * (tok.size || 1) * 0.84) / 2;
          return Math.hypot(worldPt.x - tok.x, worldPt.y - tok.y) <= radius;
        });
        if (hit) tokenId = hit.id;
      }
      if (!tokenId) return;
      Service.selectToken(tokenId, true);
    });

    // Menú Contextual de Iconos al Clic Derecho (si no hubo arrastre de cámara)
    this.els.stage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (movedDistance > 6) return;
      if (Service.clearDiceHand()) return;
      this.openContextMenu(e.clientX, e.clientY);
    });

    // Zoom con rueda del ratón
    this.els.stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        Service.setZoom(Service.state.camera.zoom * factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    // 2. Drag & Drop Global sobre el tablero (Cartuchos .owltable, Imágenes WebP y Elementos del Compendio)
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        this.els.dropModuleOverlay.classList.remove('hidden');
      }
    });

    window.addEventListener('dragleave', (e) => {
      if (e.clientX === 0 && e.clientY === 0) {
        this.els.dropModuleOverlay.classList.add('hidden');
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.els.dropModuleOverlay.classList.add('hidden');

      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && /\.(owltable|zip|json)$/i.test(file.name)) {
        try {
          const buffer = await file.arrayBuffer();
          const parsed = await CartridgePacker.parseCartridgeBuffer(buffer);
          await Service.loadModulePackage(parsed);
          this.showActionToast(`Cartucho "${Service.state.room.moduleTitle}" desplegado.`);
        } catch (err) {
          this.showActionToast(err.message || 'Error al abrir cartucho.');
        }
        return;
      }

      if (file && file.type && file.type.startsWith('image/')) {
        try {
          const webpUrl = await WebPConverter.fileToWebPDataUrl(file, 3840, 0.82);
          Service.loadExternalMapImage(webpUrl);
          await Service.changeMap('custom', webpUrl);
          this.showActionToast(`Mapa "${file.name}" optimizado a WebP.`);
        } catch (err) {
          this.showActionToast(err.message || 'Error al procesar imagen WebP.');
        }
        return;
      }

      // Arrastrar desde el Compendio Derecho
      const dragSpec = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
      if (!dragSpec) return;

      const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
      if (dragSpec.startsWith('actor:')) {
        const key = dragSpec.replace('actor:', '');
        const allActors = [...(Service.state.customActors || []), ...COMPENDIUM_ACTORS];
        const tpl = allActors.find((a) => a.key === key);
        if (tpl) {
          await Service.spawnActorFromTemplate(tpl, worldPt.x, worldPt.y);
          this.showActionToast(`${tpl.name} desplegado en el tablero.`);
        }
      } else if (dragSpec.startsWith('map:')) {
        const key = dragSpec.replace('map:', '');
        const allMaps = [...(Service.state.customMaps || []), ...COMPENDIUM_MAPS];
        const mapTpl = allMaps.find((m) => m.key === key);
        await Service.activateMapTemplate(mapTpl || { key });
        this.showActionToast('Escenario cambiado.');
      } else if (dragSpec.startsWith('item:')) {
        const key = dragSpec.replace('item:', '');
        const allItems = [...(Service.state.customItems || []), ...COMPENDIUM_ITEMS];
        const itemTpl = allItems.find((i) => i.key === key);
        if (e.target.closest('[data-map-note]')) return;
        const tokEl = e.target.closest('[data-token-id]');
        const targetId = tokEl ? tokEl.dataset.tokenId : Service.state.selectedTokenId;
        if (itemTpl && targetId) {
          this.activeSheetTab = this.getItemCategory(itemTpl.kind);
          const res = Service.equipItemToToken(targetId, itemTpl);
          if (res) this.showActionToast(`${itemTpl.name} equipado en ${res.token.name}.`);
        }
      }
    });

    // Dropzone directa en la Ficha Izquierda
    this.els.sheetInventoryDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.els.sheetInventoryDropzone.classList.add('sheet-drop-active');
    });
    this.els.sheetInventoryDropzone.addEventListener('dragleave', () => {
      this.els.sheetInventoryDropzone.classList.remove('sheet-drop-active');
    });
    this.els.sheetInventoryDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.els.sheetInventoryDropzone.classList.remove('sheet-drop-active');
      const dragSpec = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
      if (dragSpec.startsWith('item:') && Service.state.selectedTokenId) {
        const key = dragSpec.replace('item:', '');
        const allItems = [...(Service.state.customItems || []), ...COMPENDIUM_ITEMS];
        const itemTpl = allItems.find((i) => i.key === key);
        if (itemTpl) {
          this.activeSheetTab = this.getItemCategory(itemTpl.kind);
          const res = Service.equipItemToToken(Service.state.selectedTokenId, itemTpl);
          if (res) this.showActionToast(`${itemTpl.name} equipado en ${res.token.name}.`);
        }
      }
    });

    // 7. Menú Contextual de Iconos
    this.els.contextIconMenu.addEventListener('click', (e) => {
      const toolBtn = e.target.closest('[data-ctx-tool]');
      if (toolBtn) {
        Service.setTool(toolBtn.dataset.ctxTool);
        this.openContextMenu(
          parseFloat(this.els.contextIconMenu.style.left),
          parseFloat(this.els.contextIconMenu.style.top)
        );
      }
    });

    // 11. Atajos de Teclado
    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          document.activeElement.blur();
        }
        Service.state.wallAnchor = null;
        Service.state.sheetOpen = false;
        Service.state.drawerOpen = false;
        Service.clearDiceHand();
        if (this.setDicePopoverOpen) this.setDicePopoverOpen(false);
        this.hideContextMenu();
        Service.notify();
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        const ok = e.shiftKey ? Service.redo() : Service.undo();
        if (ok) this.showActionToast(e.shiftKey ? '↪️ Rehacer' : '↩️ Deshacer');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        if (Service.redo()) this.showActionToast('↪️ Rehacer');
        return;
      }
      if (k === 'v' || k === 'h') Service.setTool('select');
      else if (k === 'r') Service.setTool('ruler');
      else if (k === 'p') Service.setTool('draw');
      else if (k === 'f') Service.setTool('fog');
      else if (k === 'w') Service.setTool('wall');
      else if (k === 'g') Service.setTool('ping');
      else if (k === 'c') {
        Service.state.sheetOpen = !Service.state.sheetOpen;
        Service.notify();
      }
    });
  },

  renderTokensLayer(state) {
    const cs = state.grid.cellSize;
    const visSources =
      state.role === 'player' && state.dynamicLighting ? Selector.getAlliedVisibilityPolygons(state) : null;

    const visibleTokens = state.tokens.filter((t) => {
      if (state.role === 'gm') return true;
      if (t.hidden) return false;
      if (visSources && t.isAlly === false) {
        // En vista Jugador, los hostiles solo se muestran si están dentro de la línea de visión de algún aliado
        return visSources.some(
          (src) =>
            Math.hypot(t.x - src.token.x, t.y - src.token.y) <= src.radius &&
            Selector.isPointInPolygon({ x: t.x, y: t.y }, src.poly)
        );
      }
      return true;
    });

    const existingNodes = new Map();
    this.els.tokensLayer.querySelectorAll('[data-token-id]').forEach((node) => {
      existingNodes.set(node.dataset.tokenId, node);
    });

    const visibleIds = new Set(visibleTokens.map((t) => t.id));
    existingNodes.forEach((node, id) => {
      if (!visibleIds.has(id)) node.remove();
    });

    for (const tok of visibleTokens) {
      const diameter = Math.round(cs * (tok.size || 1) * 0.84);
      const left = Math.round(tok.x - diameter / 2);
      const top = Math.round(tok.y - diameter / 2);
      const isSel = tok.id === state.selectedTokenId;
      const isDrag = tok.id === this.draggingTokenId;
      const initials = tok.name.slice(0, 2).toUpperCase();
      const hpPct = tok.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((tok.hp / tok.maxHp) * 100))) : 0;

      let el = existingNodes.get(tok.id);
      if (!el) {
        el = document.createElement('div');
        el.dataset.tokenId = tok.id;
        el.innerHTML = `
          <div class="vtt-token-avatar w-full h-full flex items-center justify-center rounded-full overflow-hidden pointer-events-none"></div>
          <div class="vtt-token-name absolute -bottom-3.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-slate-950/90 text-white text-[10px] font-mono-tech whitespace-nowrap pointer-events-none"></div>
          <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-4/5 h-1.5 rounded-full bg-black/70 overflow-hidden pointer-events-none">
            <div class="vtt-token-hp-fill h-full bg-emerald-400 transition-all duration-150"></div>
          </div>
        `;
        el.addEventListener('dragover', (e) => {
          e.preventDefault();
          el.classList.add('is-drop-hover');
        });
        el.addEventListener('dragleave', () => el.classList.remove('is-drop-hover'));
        this.els.tokensLayer.appendChild(el);
      }

      const activeCombatTokId = state.combat?.active ? state.combat.order?.[state.combat.turnIndex]?.tokenId : null;
      const isTurn = activeCombatTokId === tok.id;
      el.classList.add('vtt-token');
      el.classList.toggle('is-selected', isSel);
      el.classList.toggle('is-dragging', isDrag);
      const conds = Array.isArray(tok.conditions) ? tok.conditions : [];
      el.classList.toggle('opacity-55', Boolean(tok.hidden || conds.includes('hidden') || conds.includes('invisible')));
      el.style.setProperty('--tx', `${left}px`);
      el.style.setProperty('--ty', `${top}px`);
      el.style.width = `${diameter}px`;
      el.style.height = `${diameter}px`;
      el.style.backgroundColor = tok.color;
      el.style.border = isTurn ? '3px solid #f59e0b' : '2px solid #ffffff';
      el.style.boxShadow = isTurn ? '0 0 0 4px rgba(245, 158, 11, 0.32)' : '';
      el.style.isolation = 'isolate';
      el.title = `${tok.name} (${tok.hp}/${tok.maxHp} HP)`;

      let condRow = el.querySelector('.vtt-token-conds');
      if (!condRow) {
        condRow = document.createElement('div');
        condRow.className = 'vtt-token-conds absolute -right-1.5 -top-1.5 flex flex-wrap max-w-[54px] justify-end gap-0.5 pointer-events-none';
        el.appendChild(condRow);
      }

      const auraPx = Number(tok.auraRadius) || 0;
      let auraEl = el.querySelector('.vtt-token-aura');
      if (auraPx > 0) {
        if (!auraEl) {
          auraEl = document.createElement('div');
          auraEl.className = 'vtt-token-aura absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none';
          auraEl.style.zIndex = '-1';
          el.prepend(auraEl);
        }
        const auraDiam = auraPx * 2;
        auraEl.style.width = `${auraDiam}px`;
        auraEl.style.height = `${auraDiam}px`;
        auraEl.style.border = `1.5px dashed ${tok.color || '#8b5cf6'}`;
        auraEl.style.background = `${tok.color || '#8b5cf6'}14`;
      } else if (auraEl) {
        auraEl.remove();
      }

      const lightPx = Number(tok.lightRadius) || 0;
      let lightEl = el.querySelector('.vtt-token-light');
      if (lightPx > 0) {
        if (!lightEl) {
          lightEl = document.createElement('div');
          lightEl.className = 'vtt-token-light absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none';
          lightEl.style.zIndex = '-1';
          el.prepend(lightEl);
        }
        const lightDiam = lightPx * 2;
        lightEl.style.width = `${lightDiam}px`;
        lightEl.style.height = `${lightDiam}px`;
        lightEl.style.background = 'radial-gradient(circle, rgba(251,191,36,0.22) 0%, rgba(251,191,36,0.06) 55%, rgba(251,191,36,0) 75%)';
      } else if (lightEl) {
        lightEl.remove();
      }
      condRow.innerHTML = conds
        .filter((c) => this.tokenStatusSymbols[c])
        .map((c) => {
          const def = this.tokenStatusSymbols[c];
          return `<span class="w-4 h-4 rounded-full border border-white/85 text-white flex items-center justify-center shadow-sm" style="background:${def.color};">${this.renderStatusSymbolSvg(c, 'w-2.5 h-2.5')}</span>`;
        })
        .join('');

      const avatarBox = el.querySelector('.vtt-token-avatar');
      const avatarKey = tok.imageUrl ? `img:${tok.imageUrl}` : `txt:${initials}`;
      if (avatarBox.dataset.avatarKey !== avatarKey) {
        avatarBox.dataset.avatarKey = avatarKey;
        avatarBox.innerHTML = tok.imageUrl
          ? `<img src="${tok.imageUrl}" alt="${tok.name}" class="w-full h-full object-cover rounded-full pointer-events-none" />`
          : `<span class="font-bold text-white text-sm pointer-events-none">${initials}</span>`;
      }

      const nameBox = el.querySelector('.vtt-token-name');
      if (nameBox.textContent !== tok.name) {
        nameBox.textContent = tok.name;
      }

      const hpFill = el.querySelector('.vtt-token-hp-fill');
      hpFill.style.width = `${hpPct}%`;
    }
  }
};
