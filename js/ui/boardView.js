import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS, COMPENDIUM_MAPS } from '../data/compendium.js?v=20261121a6';
import { CartridgePacker } from '../services/cartridgePacker.js?v=20261121a6';
import { TabletopAudio } from '../services/tabletopAudio.js?v=20261121a6';
import { WebPConverter } from '../utils/webpConverter.js?v=20261121a6';
import { normalizeGridConfig } from '../utils/gridGeometry.js?v=20261121a6';
import { metersToPixels, resolveTokenLightMeters } from '../utils/lightingModel.js?v=20261121a6';
import { computeTokenRimSpec, shouldApplyRuntimeCoinRim } from '../utils/tokenComposer.js?v=20261121a6';
import { collectVisibleLightSources } from '../utils/tokenShadowModel.js?v=20261121a6';
import { resolveTokenDoubleClickAction } from '../utils/worldRedaction.js?v=20261121a6';
import { findWallNearPoint, resolveWallDrawPoint } from '../utils/wallGeometry.js?v=20261121a6';
import { Selector } from '../core/selector.js?v=20261121a6';
import { Service } from '../core/service.js?v=20261121a6';

/**
 * Board pointer interactions, global drag-and-drop, keyboard shortcuts, context menu & tokens layer.
 */
export const BoardViewMethods = {
  bindBoardEvents() {
    // 1. Interacciones de puntero en el escenario (Arrastre fichas, cámara, regla, dibujo, clic derecho)
    let activePointerMode = null; // 'token' | 'pan' | 'rightPan' | 'ruler' | 'areaSelect' | 'draw'
    let draggingTokenId = null;
    let dragPath = [];
    let dragLastCellKey = '';
    let dragPickupPlayed = false;
    let startClient = { x: 0, y: 0 };
    let startCam = { x: 0, y: 0 };
    let areaOrigin = { x: 0, y: 0 };
    let movedDistance = 0;
    let currentStroke = null;

    const refreshAreaPreview = (x1, y1, ang, cfg) => {
      const rPx = cfg.radiusPx || 160;
      Service.state.rulerShape = cfg.shape || 'circle';
      Service.state.ruler = {
        x1,
        y1,
        x2: x1 + Math.cos(ang) * rPx,
        y2: y1 + Math.sin(ang) * rPx
      };
      this.renderVectorOverlay(Service.state);
      const hitIds = new Set(
        Selector.getTokensInArea(Service.state, {
          shape: cfg.shape || 'circle',
          ...Service.state.ruler,
          radiusPx: rPx
        }).map((t) => t.id)
      );
      this.els.tokensLayer?.querySelectorAll('[data-token-id]').forEach((el) => {
        const hit = hitIds.has(el.dataset.tokenId);
        el.classList.toggle('is-area-hit', hit);
      });
    };

    this.els.stage.addEventListener('pointerdown', (e) => {
      this.hideContextMenu();
      this.stopCameraMotion?.();
      if (e.target.closest('.portal-panel')) return;

      if (Selector.isSpectator(Service.state)) {
        startClient = { x: e.clientX, y: e.clientY };
        startCam = { x: Service.state.camera.x, y: Service.state.camera.y };
        movedDistance = 0;
        activePointerMode = e.button === 2 ? 'rightPan' : 'pan';
        return;
      }

      // Si hay dados recogidos en mano, clic izquierdo sobre la mesa los lanza hacia ese punto
      if (e.button === 0 && Array.isArray(Service.state.dice.hand) && Service.state.dice.hand.length > 0) {
        Service.throwDiceHand(e.clientX, e.clientY);
        return;
      }

      startClient = { x: e.clientX, y: e.clientY };
      startCam = { x: Service.state.camera.x, y: Service.state.camera.y };
      movedDistance = 0;

      // Clic derecho -> soltar cadena de muros activa o preparar paneo / menú contextual
      if (e.button === 2) {
        if (Service.state.tool === 'wall' && Service.state.wallAnchor) {
          Service.state.wallAnchor = null;
          this._suppressNextContextMenu = true;
          Service.notify({ skipVaultSave: true, skipPeerSync: true });
          return;
        }
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
        Service.cancelTokenGlide?.(tok.id);
        Service.pushUndoSnapshot();
        activePointerMode = 'token';
        draggingTokenId = tokEl.dataset.tokenId;
        this.draggingTokenId = draggingTokenId;
        dragPath = [{ x: Math.round(tok.x), y: Math.round(tok.y) }];
        const initCs = Math.max(20, Number(Service.state.grid?.cellSize) || 80);
        dragLastCellKey = `${Math.floor(tok.x / initCs)},${Math.floor(tok.y / initCs)}`;
        dragPickupPlayed = false;
        this.beginTokenDragPhysics?.(draggingTokenId, e.clientX, e.clientY);
        try {
          if (this.els.stage.isConnected) this.els.stage.setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
      }

      if (tool === 'wall') {
        if (Service.state.wallType === 'erase') {
          const hitWall = findWallNearPoint(Service.state.walls, worldPt.x, worldPt.y, 16);
          if (hitWall) {
            Service.removeWallById(hitWall.id);
            this.showActionToast('🗑 Muro eliminado');
          }
          return;
        }
        this.wallFreehand = Boolean(e.altKey);
        const pt = resolveWallDrawPoint(worldPt.x, worldPt.y, {
          grid: Service.state.grid,
          walls: Service.state.walls,
          freehand: this.wallFreehand
        });
        if (!Service.state.wallAnchor) {
          Service.state.wallAnchor = { x: pt.x, y: pt.y };
          Service.notify({ skipVaultSave: true, skipPeerSync: true });
        } else {
          const anchor = Service.state.wallAnchor;
          const wt = Service.state.wallType || 'wall';
          const chainable = wt === 'wall' || wt === 'terrain';
          Service.addWallSegment(anchor.x, anchor.y, pt.x, pt.y, wt);
          // Continue polyline chain unless closing onto an existing vertex or placing a single door
          Service.state.wallAnchor = chainable && pt.snappedTo !== 'vertex' ? { x: pt.x, y: pt.y } : null;
          Service.notify({ skipVaultSave: true, skipPeerSync: true });
        }
        return;
      }

      if (tool === 'areaSelect' && Service.state.areaSelectConfig) {
        const cfg = Service.state.areaSelectConfig;
        if (cfg.shape === 'targets') {
          let hitId = e.target.closest('[data-token-id]')?.dataset?.tokenId || null;
          if (!hitId) {
            const cs = Number(Service.state.grid?.cellSize) || 80;
            const hit = [...(Service.state.tokens || [])].reverse().find((tok) => {
              if (tok.hidden && Service.state.role !== 'gm') return false;
              const radius = (cs * (tok.size || 1) * 0.84) / 2;
              return Math.hypot(worldPt.x - tok.x, worldPt.y - tok.y) <= radius;
            });
            if (hit) hitId = hit.id;
          }
          if (hitId) Service.toggleTargetPick(hitId);
          return;
        }
        activePointerMode = 'areaSelect';
        movedDistance = 0;
        areaOrigin = { x: worldPt.x, y: worldPt.y };
        refreshAreaPreview(worldPt.x, worldPt.y, cfg.angle || 0, cfg);
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

      if (Service.state.tool === 'wall') {
        this.wallFreehand = Boolean(e.altKey);
        this.renderVectorOverlay(Service.state);
      }

      if (!activePointerMode && Service.state.tool === 'areaSelect' && Service.state.areaSelectConfig) {
        const cfg = Service.state.areaSelectConfig;
        if (cfg.shape !== 'targets') {
          refreshAreaPreview(worldPt.x, worldPt.y, cfg.angle || 0, cfg);
        }
        return;
      }

      if (!activePointerMode) return;
      const dx = e.clientX - startClient.x;
      const dy = e.clientY - startClient.y;
      movedDistance = Math.hypot(dx, dy);

      if (activePointerMode === 'pan' || (activePointerMode === 'rightPan' && movedDistance > 6)) {
        Service.state.camera.x = startCam.x + dx;
        Service.state.camera.y = startCam.y + dy;
        this.recordCameraPanSample?.(e.clientX, e.clientY);
        Service.notify({ cameraOnly: true, skipVaultSave: true });
        return;
      }

      if (activePointerMode === 'token' && draggingTokenId) {
        this.updateTokenDragPhysics?.(draggingTokenId, e.clientX, e.clientY);
        Service.moveToken(draggingTokenId, worldPt.x, worldPt.y, false);
        const movedTok = Service.state.tokens.find((t) => t.id === draggingTokenId);
        if (movedTok) {
          if (!dragPickupPlayed && movedDistance >= 4) {
            dragPickupPlayed = true;
            TabletopAudio.playTokenPickup(movedTok.size || 1);
          }
          const cellSize = Math.max(20, Number(Service.state.grid?.cellSize) || 80);
          const cellKey = `${Math.floor(movedTok.x / cellSize)},${Math.floor(movedTok.y / cellSize)}`;
          if (dragPickupPlayed && cellKey !== dragLastCellKey) {
            dragLastCellKey = cellKey;
            TabletopAudio.playTokenSlideTick(movedTok.size || 1);
          }
          const minStep = Math.max(28, cellSize * 0.45);
          const lastPt = dragPath[dragPath.length - 1];
          if (!lastPt || Math.hypot(movedTok.x - lastPt.x, movedTok.y - lastPt.y) >= minStep) {
            dragPath.push({ x: Math.round(movedTok.x), y: Math.round(movedTok.y) });
          }
        }
        this.drawFogCanvas(Service.state);
      } else if (activePointerMode === 'areaSelect' && Service.state.areaSelectConfig) {
        const cfg = Service.state.areaSelectConfig;
        const canAim = cfg.shape === 'cone' || cfg.shape === 'line';
        if (canAim && movedDistance > 10) {
          const ang = Math.atan2(worldPt.y - areaOrigin.y, worldPt.x - areaOrigin.x);
          cfg.angle = ang;
          refreshAreaPreview(areaOrigin.x, areaOrigin.y, ang, cfg);
        } else {
          refreshAreaPreview(worldPt.x, worldPt.y, cfg.angle || 0, cfg);
        }
      } else if (activePointerMode === 'ruler' && Service.state.ruler) {
        Service.state.ruler.x2 = worldPt.x;
        Service.state.ruler.y2 = worldPt.y;
        Service.notify({ skipVaultSave: true });
      } else if (activePointerMode === 'draw' && currentStroke) {
        currentStroke.points.push(worldPt);
        Service.notify({ redrawDraw: true, skipVaultSave: true });
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
        const droppedId = draggingTokenId;
        const droppedTok = Service.state.tokens.find((t) => t.id === droppedId);
        const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
        const wasDragged = movedDistance >= 4;
        this.draggingTokenId = null;
        Service.moveToken(droppedId, worldPt.x, worldPt.y, true, dragPath);
        this.finishTokenDragPhysics?.(droppedId, wasDragged ? (droppedTok?.size || 1) : 1, {
          wasDragged
        });
        if (wasDragged) {
          TabletopAudio.playTokenDrop(droppedTok?.size || 1);
        }
        this.drawFogCanvas(Service.state);
      } else if (activePointerMode === 'pan' || (activePointerMode === 'rightPan' && movedDistance > 6)) {
        this.releaseCameraPanInertia?.();
      } else if (activePointerMode === 'areaSelect' && Service.state.ruler && Service.state.areaSelectConfig) {
        const cfg = Service.state.areaSelectConfig;
        Service.confirmAreaSelection({
          shape: cfg.shape || 'circle',
          ...Service.state.ruler,
          radiusPx: cfg.radiusPx || 160
        });
      } else if (activePointerMode === 'ruler') {
        Service.state.ruler = null;
        Service.notify({ skipVaultSave: true });
      } else if (activePointerMode === 'draw') {
        Service.recordEvent('TRAZO', 'Marcador táctico');
        Service.notify({ redrawDraw: true });
      }

      activePointerMode = null;
      draggingTokenId = null;
      dragPath = [];
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
      const hitTok = Service.state.tokens.find((t) => t.id === tokenId);
      const action = resolveTokenDoubleClickAction(Service.state, hitTok, Service.canControlToken(hitTok));
      if (action === 'sheet') {
        Service.selectToken(tokenId, true);
      } else if (action === 'inspect') {
        Service.openTokenInspection(tokenId);
      }
    });

    // Menú Contextual de Iconos al Clic Derecho (si no hubo arrastre de cámara)
    this.els.stage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this._suppressNextContextMenu) {
        this._suppressNextContextMenu = false;
        return;
      }
      if (movedDistance > 6) return;
      if (Selector.isSpectator(Service.state)) return;
      if (Service.state.role === 'player') {
        if (!this.ctxTargetTokenId) return;
        const tok = Service.state.tokens.find((t) => t.id === this.ctxTargetTokenId);
        if (!tok || !Service.canControlToken(tok)) return;
      }
      if (Service.clearDiceHand()) return;
      this.openContextMenu(e.clientX, e.clientY);
    });

    // Zoom con rueda del ratón (Shift + Rueda rota Cono/Línea en selección de área)
    this.els.stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (Service.state.tool === 'areaSelect' && e.shiftKey && Service.state.areaSelectConfig) {
          const cfg = Service.state.areaSelectConfig;
          const step = (e.deltaY < 0 ? -1 : 1) * (Math.PI / 12);
          Service.updateAreaSelectConfig({ angle: (cfg.angle || 0) + step });
          return;
        }
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        if (typeof this.nudgeCameraZoom === 'function') {
          this.nudgeCameraZoom(factor, e.clientX, e.clientY);
        } else {
          Service.setZoom(Service.state.camera.zoom * factor, e.clientX, e.clientY);
        }
      },
      { passive: false }
    );

    // 2. Drag & Drop Global sobre el tablero (Cartuchos .portal, Imágenes WebP y Elementos del Compendio)
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.els.tokenEditorModal?.classList.contains('is-open') || this.els.mapGridModal?.classList.contains('is-open')) return;
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
      if (this.els.tokenEditorModal?.classList.contains('is-open') || this.els.mapGridModal?.classList.contains('is-open')) return;

      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && /\.(portal|zip|json)$/i.test(file.name)) {
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
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Alt' && Service.state.tool === 'wall') {
        this.wallFreehand = false;
        this.renderVectorOverlay(Service.state);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Alt' && Service.state.tool === 'wall') {
        this.wallFreehand = true;
        this.renderVectorOverlay(Service.state);
      }
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (this.handleEscapeKey?.()) e.preventDefault();
        return;
      }
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable)
      ) {
        return;
      }
      if ((e.code === 'Space' || e.key === ' ') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!this._getModalClosers?.().some(([isOpen]) => isOpen()) && !Service.chatOpen && !this.els.chatDrawer?.classList.contains('is-open')) {
          e.preventDefault();
          this.handleSpaceKey?.();
        }
        return;
      }
      if (Selector.isSpectator(Service.state)) return;
      const isPlayer = Service.state.role === 'player';
      if (!isPlayer && (e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        const ok = e.shiftKey ? Service.redo() : Service.undo();
        if (ok) this.showActionToast(e.shiftKey ? '↪️ Rehacer' : '↩️ Deshacer');
        return;
      }
      if (!isPlayer && (e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        if (Service.redo()) this.showActionToast('↪️ Rehacer');
        return;
      }
      if (Service.state.tool === 'areaSelect' && Service.state.areaSelectConfig) {
        const cfg = Service.state.areaSelectConfig;
        if (k === 'q') {
          Service.updateAreaSelectConfig({ angle: (cfg.angle || 0) - Math.PI / 12 });
          return;
        }
        if (k === 'e') {
          Service.updateAreaSelectConfig({ angle: (cfg.angle || 0) + Math.PI / 12 });
          return;
        }
        if (k === 'r') {
          Service.updateAreaSelectConfig({ angle: (cfg.angle || 0) + Math.PI / 4 });
          return;
        }
      }
      if (k === 'v' || k === 'h') Service.setTool('select');
      else if (k === 'r') Service.setTool('ruler');
      else if (!isPlayer && k === 'p') Service.setTool('draw');
      else if (!isPlayer && k === 'w') Service.setTool('wall');
      else if (k === 'g') Service.setTool('ping');
      else if (k === 'c') {
        Service.state.sheetOpen = !Service.state.sheetOpen;
        if (Service.state.sheetOpen) Service.state.gmScreenOpen = false;
        Service.notify();
      } else if (k === 'j') {
        Service.toggleJournal();
      }
    });
  },

  renderTokensLayer(state) {
    const cs = state.grid.cellSize;
    const visibleTokens = Selector.getVisibleTokensForSeat(state);
    const visibleLightSources = collectVisibleLightSources(visibleTokens, state.grid);

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
      const isSel = tok.id === state.selectedTokenId;
      const isDrag = tok.id === this.draggingTokenId;
      const glideVis = Service.getTokenGlideVisual?.(tok.id) || null;
      const isGlide = Boolean(glideVis);
      const left = isGlide ? Number((tok.x - diameter / 2).toFixed(2)) : Math.round(tok.x - diameter / 2);
      const top = isGlide ? Number((tok.y - diameter / 2).toFixed(2)) : Math.round(tok.y - diameter / 2);
      const initials = tok.name.slice(0, 2).toUpperCase();
      const hpPct = tok._redacted
        ? Math.max(0, Math.min(100, Number(tok.hpPct) || 0))
        : (tok.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((tok.hp / tok.maxHp) * 100))) : 0);

      let el = existingNodes.get(tok.id);
      if (!el) {
        el = document.createElement('div');
        el.dataset.tokenId = tok.id;
        el.innerHTML = `
          <div class="vtt-token-cast-shadow pointer-events-none"></div>
          <div class="vtt-token-shadow pointer-events-none"></div>
          <div class="vtt-token-piece w-full h-full flex items-center justify-center rounded-full pointer-events-none">
            <div class="vtt-token-avatar w-full h-full flex items-center justify-center rounded-full overflow-hidden pointer-events-none"></div>
          </div>
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

      const activeEntry = state.combat?.active ? state.combat.order?.[state.combat.turnIndex] : null;
      const isTurn = Boolean(activeEntry && (activeEntry.tokenId === tok.id || (Array.isArray(activeEntry.tokenIds) && activeEntry.tokenIds.includes(tok.id))));
      const isAreaTarget = Boolean(
        state.activeSequence &&
        Array.isArray(state.activeSequence.targetTokenIds) &&
        state.activeSequence.targetTokenIds.includes(tok.id)
      );
      const hasImage = Boolean(tok.imageUrl);
      const useCoinRim = shouldApplyRuntimeCoinRim(tok);
      el.classList.add('vtt-token');
      el.classList.toggle('has-image', hasImage);
      el.classList.toggle('has-coin-rim', useCoinRim);
      el.classList.toggle('is-selected', isSel);
      el.classList.toggle('is-turn', isTurn);
      el.classList.toggle('is-area-target', isAreaTarget);
      if (state.tool !== 'areaSelect') el.classList.remove('is-area-hit');
      el.classList.toggle('is-dragging', isDrag);
      el.classList.toggle('is-gliding', isGlide);
      const conds = Array.isArray(tok.conditions) ? tok.conditions : [];
      el.classList.toggle('opacity-55', Boolean(tok.hidden || conds.includes('hidden') || conds.includes('invisible')));
      el.style.setProperty('--tx', `${left}px`);
      el.style.setProperty('--ty', `${top}px`);
      el.style.width = `${diameter}px`;
      el.style.height = `${diameter}px`;
      if (useCoinRim) {
        const rim = computeTokenRimSpec(tok.color || '#8b5cf6', diameter);
        el.style.setProperty('--rim-depth', `${rim.depthPx}px`);
        el.style.setProperty('--rim-color', rim.rimColor);
        el.style.setProperty('--rim-deep', rim.rimDeepColor);
      } else {
        el.style.removeProperty('--rim-depth');
        el.style.removeProperty('--rim-color');
        el.style.removeProperty('--rim-deep');
      }
      const pieceBox = el.querySelector('.vtt-token-piece');
      if (pieceBox) {
        if (hasImage) {
          pieceBox.style.backgroundColor = 'transparent';
          pieceBox.style.border = 'none';
          pieceBox.style.boxShadow = 'none';
        } else {
          pieceBox.style.backgroundColor = tok.color;
          pieceBox.style.border = isTurn || isAreaTarget ? '3px solid #f59e0b' : '2px solid rgba(255, 255, 255, 0.92)';
          pieceBox.style.boxShadow = '';
        }
      }
      el.style.isolation = 'isolate';
      el.title = tok._redacted ? tok.name : `${tok.name} (${tok.hp}/${tok.maxHp} HP)`;
      this.applyTokenPhysicsToElement?.(el, tok.id, glideVis);
      this.applyTokenDualShadows?.(el, tok, {
        diameterPx: diameter,
        lightSources: visibleLightSources,
        walls: state.walls,
        ambientDir: this._currentAtmosphere?.boardShadowDir
      });

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

      const lightPx = metersToPixels(resolveTokenLightMeters(tok), state.grid);
      let lightEl = el.querySelector('.vtt-token-light');
      if (lightPx > 0 && !state.dynamicLighting) {
        if (!lightEl) {
          lightEl = document.createElement('div');
          lightEl.className = 'vtt-token-light absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none';
          lightEl.style.zIndex = '-1';
          el.prepend(lightEl);
        }
        const lightDiam = lightPx * 2;
        lightEl.style.width = `${lightDiam}px`;
        lightEl.style.height = `${lightDiam}px`;
        lightEl.style.background = 'radial-gradient(circle, rgba(255,228,164,0.22) 0%, rgba(251,176,59,0.08) 52%, rgba(234,118,32,0) 75%)';
      } else if (lightEl) {
        lightEl.remove();
      }
      const condKey = conds.join(',');
      if (condRow.dataset.condKey !== condKey) {
        condRow.dataset.condKey = condKey;
        condRow.innerHTML = conds
          .map((c) => {
            const def = Selector.getStatusDef(state, c);
            return `<span class="w-4 h-4 rounded-full border border-white/85 text-white flex items-center justify-center shadow-sm" style="background:${def.color};" title="${this.escapeHtml(def.label)}">${this.renderStatusSymbolSvg(def.icon, 'w-2.5 h-2.5', state)}</span>`;
          })
          .join('');
      }

      const avatarBox = el.querySelector('.vtt-token-avatar');
      avatarBox.classList.toggle('rounded-full', !hasImage);
      avatarBox.classList.toggle('overflow-hidden', !hasImage);
      const avatarKey = tok.imageUrl ? `img:${tok.imageUrl}` : `txt:${initials}`;
      if (avatarBox.dataset.avatarKey !== avatarKey) {
        avatarBox.dataset.avatarKey = avatarKey;
        avatarBox.innerHTML = tok.imageUrl
          ? `<img src="${this.escapeHtml(tok.imageUrl)}" alt="${this.escapeHtml(tok.name)}" class="w-full h-full object-contain pointer-events-none select-none" draggable="false" />`
          : `<span class="font-bold text-white text-sm pointer-events-none">${this.escapeHtml(initials)}</span>`;
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
