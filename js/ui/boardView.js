import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS, COMPENDIUM_MAPS } from '../data/compendium.js?v=20261123a7';
import { CartridgePacker } from '../services/cartridgePacker.js?v=20261123a7';
import { TabletopAudio } from '../services/tabletopAudio.js?v=20261123a7';
import { WebPConverter } from '../utils/webpConverter.js?v=20261123a7';
import { normalizeGridConfig } from '../utils/gridGeometry.js?v=20261123a7';
import { metersToPixels, resolveTokenLightMeters } from '../utils/lightingModel.js?v=20261123a7';
import { computeTokenRimSpec, shouldApplyRuntimeCoinRim } from '../utils/tokenComposer.js?v=20261123a7';
import { collectVisibleLightSources } from '../utils/tokenShadowModel.js?v=20261123a7';
import { resolveTokenDoubleClickAction } from '../utils/worldRedaction.js?v=20261123a7';
import {
  findWallEndpointNearPoint,
  findWallNearPoint,
  findWallsInRect,
  resolveWallDrawPoint
} from '../utils/wallGeometry.js?v=20261123a7';
import { findTokensInRect } from '../utils/contextMenuModel.js?v=20261123a7';
import { Selector } from '../core/selector.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';

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
    let wallSelectShift = false;
    let tokenSelectShift = false;
    let groupDragOrigins = null;
    let wallDragCtx = null;

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

      if (Selector.isNarrativeScene(Service.state)) {
        if (e.button === 2) {
          movedDistance = 0;
          this.ctxTargetTokenId = null;
        }
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
        if (nearDoor && !tokEl && this.isDoorVisibleOnBoard?.(nearDoor, Service.state)) {
          if (nearDoor.locked && Service.state.role !== 'gm') {
            this.showActionToast('🔒 Puerta bloqueada');
            return;
          }
          const updated = Service.toggleDoor(nearDoor.id);
          if (updated) this.showActionToast(updated.open ? '🚪 Puerta abierta' : '🚪 Puerta cerrada');
          return;
        }
      }

      if (tokEl && (tool === 'select' || tool === 'pan')) {
        const tokId = tokEl.dataset.tokenId;
        const tok = Service.state.tokens.find((t) => t.id === tokId);
        if (!tok) return;
        if (!Service.canControlToken(tok)) {
          this.showActionToast('Solo el DJ o su dueño puede mover esta ficha.');
          return;
        }
        const curSelIds = Array.isArray(Service.state.selectedTokenIds) ? Service.state.selectedTokenIds : [];
        if (e.shiftKey) {
          const nextIds = curSelIds.includes(tokId)
            ? curSelIds.filter((id) => id !== tokId)
            : [...(curSelIds.length > 0 ? curSelIds : (Service.state.selectedTokenId ? [Service.state.selectedTokenId] : [])), tokId];
          Service.setSelectedTokens(nextIds);
          return;
        }
        const isInGroup = curSelIds.length > 1 && curSelIds.includes(tokId);
        if (!isInGroup) {
          Service.selectToken(tokId, false);
        }
        Service.cancelTokenGlide?.(tok.id);
        Service.pushUndoSnapshot();
        activePointerMode = 'token';
        draggingTokenId = tokId;
        this.draggingTokenId = draggingTokenId;
        Service.activeDragTokenId = draggingTokenId;
        dragPath = [{ x: Math.round(tok.x), y: Math.round(tok.y) }];
        const initCs = Math.max(20, Number(Service.state.grid?.cellSize) || 80);
        dragLastCellKey = `${Math.floor(tok.x / initCs)},${Math.floor(tok.y / initCs)}`;
        dragPickupPlayed = false;
        if (isInGroup) {
          const grpTokens = Service.getSelectedControllableTokens(curSelIds);
          groupDragOrigins = grpTokens.length > 1
            ? grpTokens.map((t) => ({ id: t.id, dx: t.x - tok.x, dy: t.y - tok.y }))
            : null;
        } else {
          groupDragOrigins = null;
        }
        this.beginTokenDragPhysics?.(draggingTokenId, e.clientX, e.clientY);
        try {
          if (this.els.stage.isConnected) this.els.stage.setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
      }

      if (tool === 'wall') {
        if (Service.state.wallMode === 'select') {
          const curSelIds = Array.isArray(Service.state.selectedWallIds) ? [...Service.state.selectedWallIds] : [];
          const selWalls = (Service.state.walls || []).filter((w) => w && curSelIds.includes(w.id));
          if (!e.shiftKey && selWalls.length > 0) {
            const epHit = findWallEndpointNearPoint(selWalls, worldPt.x, worldPt.y, 14);
            if (epHit) {
              activePointerMode = 'wallVertex';
              movedDistance = 0;
              wallDragCtx = {
                wallId: epHit.wall.id,
                endKey: epHit.endKey,
                pushedUndo: false,
                moved: false
              };
              try {
                if (this.els.stage.isConnected) this.els.stage.setPointerCapture(e.pointerId);
              } catch (_) {}
              return;
            }
          }
          const hitWall = findWallNearPoint(Service.state.walls, worldPt.x, worldPt.y, 18);
          if (hitWall) {
            if (e.shiftKey) {
              const idx = curSelIds.indexOf(hitWall.id);
              if (idx >= 0) curSelIds.splice(idx, 1);
              else curSelIds.push(hitWall.id);
              Service.setSelectedWallIds(curSelIds);
              return;
            }
            const nextSelIds = curSelIds.includes(hitWall.id) ? curSelIds : [hitWall.id];
            if (!curSelIds.includes(hitWall.id)) {
              Service.setSelectedWallIds(nextSelIds);
            }
            const dragSet = new Set(nextSelIds);
            const origWalls = (Service.state.walls || [])
              .filter((w) => w && dragSet.has(w.id))
              .map((w) => ({ id: w.id, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }));
            activePointerMode = 'wallMove';
            movedDistance = 0;
            wallDragCtx = {
              startWorld: { x: worldPt.x, y: worldPt.y },
              origWalls,
              pushedUndo: false,
              moved: false
            };
            try {
              if (this.els.stage.isConnected) this.els.stage.setPointerCapture(e.pointerId);
            } catch (_) {}
            return;
          }
          activePointerMode = 'wallSelect';
          wallSelectShift = Boolean(e.shiftKey);
          movedDistance = 0;
          Service.state.wallSelectBox = { x1: worldPt.x, y1: worldPt.y, x2: worldPt.x, y2: worldPt.y };
          this.renderVectorOverlay(Service.state);
          try {
            if (this.els.stage.isConnected) this.els.stage.setPointerCapture(e.pointerId);
          } catch (_) {}
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
          Service.addWallSegment(anchor.x, anchor.y, pt.x, pt.y);
          // Continue polyline chain unless closing onto an existing vertex
          Service.state.wallAnchor = pt.snappedTo !== 'vertex' ? { x: pt.x, y: pt.y } : null;
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

      // Clic izquierdo en vacío: marquesina de selección de fichas (ratón/pluma); paneo táctil o espectador
      if (tool === 'select' && e.pointerType !== 'touch' && !Selector.isSpectator(Service.state)) {
        activePointerMode = 'tokenSelect';
        tokenSelectShift = Boolean(e.shiftKey);
        movedDistance = 0;
        Service.state.tokenSelectBox = { x1: worldPt.x, y1: worldPt.y, x2: worldPt.x, y2: worldPt.y };
        this.renderVectorOverlay(Service.state);
        try {
          if (this.els.stage.isConnected) this.els.stage.setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
      }

      // Clic en vacío (táctil / espectador / pan) -> mover cámara
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
        if (groupDragOrigins && groupDragOrigins.length > 1) {
          Service.moveTokensGroup(
            groupDragOrigins.map((o) => ({ id: o.id, x: worldPt.x + o.dx, y: worldPt.y + o.dy })),
            false
          );
        } else {
          Service.moveToken(draggingTokenId, worldPt.x, worldPt.y, false);
        }
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
        this.scheduleFogRedraw(Service.state);
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
      } else if (activePointerMode === 'tokenSelect' && Service.state.tokenSelectBox) {
        Service.state.tokenSelectBox.x2 = worldPt.x;
        Service.state.tokenSelectBox.y2 = worldPt.y;
        this.renderVectorOverlay(Service.state);
      } else if (activePointerMode === 'wallVertex' && wallDragCtx) {
        if (movedDistance >= 3) {
          if (!wallDragCtx.pushedUndo) {
            Service.pushUndoSnapshot();
            wallDragCtx.pushedUndo = true;
          }
          wallDragCtx.moved = true;
          const grid = normalizeGridConfig(Service.state.grid);
          const otherWalls = (Service.state.walls || []).filter((w) => w && w.id !== wallDragCtx.wallId);
          const pt = resolveWallDrawPoint(worldPt.x, worldPt.y, {
            grid,
            walls: otherWalls,
            freehand: Boolean(e.altKey)
          });
          Service.moveWallEndpoint(wallDragCtx.wallId, wallDragCtx.endKey, pt.x, pt.y, { commit: false });
          this.scheduleFogRedraw(Service.state);
          this.renderVectorOverlay(Service.state);
        }
      } else if (activePointerMode === 'wallMove' && wallDragCtx) {
        if (movedDistance >= 3) {
          if (!wallDragCtx.pushedUndo) {
            Service.pushUndoSnapshot();
            wallDragCtx.pushedUndo = true;
          }
          wallDragCtx.moved = true;
          const grid = normalizeGridConfig(Service.state.grid);
          let ddx = worldPt.x - wallDragCtx.startWorld.x;
          let ddy = worldPt.y - wallDragCtx.startWorld.y;
          if (!e.altKey && grid.snap && grid.type !== 'none') {
            const step = Math.max(8, grid.cellSize / 2);
            ddx = Math.round(ddx / step) * step;
            ddy = Math.round(ddy / step) * step;
          } else {
            ddx = Math.round(ddx);
            ddy = Math.round(ddy);
          }
          const byId = new Map((Service.state.walls || []).filter(Boolean).map((w) => [w.id, w]));
          for (const orig of wallDragCtx.origWalls) {
            const live = byId.get(orig.id);
            if (!live) continue;
            live.x1 = Math.max(0, Math.min(2400, Math.round(orig.x1 + ddx)));
            live.y1 = Math.max(0, Math.min(1600, Math.round(orig.y1 + ddy)));
            live.x2 = Math.max(0, Math.min(2400, Math.round(orig.x2 + ddx)));
            live.y2 = Math.max(0, Math.min(1600, Math.round(orig.y2 + ddy)));
          }
          this.scheduleFogRedraw(Service.state);
          this.renderVectorOverlay(Service.state);
        }
      } else if (activePointerMode === 'wallSelect' && Service.state.wallSelectBox) {
        Service.state.wallSelectBox.x2 = worldPt.x;
        Service.state.wallSelectBox.y2 = worldPt.y;
        this.renderVectorOverlay(Service.state);
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
        Service.activeDragTokenId = null;
        if (groupDragOrigins && groupDragOrigins.length > 1) {
          Service.moveTokensGroup(
            groupDragOrigins.map((o) => ({
              id: o.id,
              x: worldPt.x + o.dx,
              y: worldPt.y + o.dy,
              rawPath: o.id === droppedId ? dragPath : null
            })),
            true
          );
          groupDragOrigins = null;
        } else {
          Service.moveToken(droppedId, worldPt.x, worldPt.y, true, dragPath);
        }
        this.finishTokenDragPhysics?.(droppedId, wasDragged ? (droppedTok?.size || 1) : 1, {
          wasDragged
        });
        if (wasDragged) {
          TabletopAudio.playTokenDrop(droppedTok?.size || 1);
        }
        this.drawFogCanvas(Service.state);
      } else if (activePointerMode === 'tokenSelect' && Service.state.tokenSelectBox) {
        const box = Service.state.tokenSelectBox;
        Service.state.tokenSelectBox = null;
        this.renderVectorOverlay(Service.state);
        if (movedDistance < 6) {
          if (!tokenSelectShift) Service.setSelectedTokens([]);
        } else {
          const cs = Math.max(20, Number(Service.state.grid?.cellSize) || 80);
          const hits = findTokensInRect(Service.state.tokens, box, {
            cellSize: cs,
            canSelect: (t) => Service.state.role === 'gm' || (!t.hidden && Service.canControlToken(t))
          });
          const hitIds = hits.map((t) => t.id);
          if (tokenSelectShift) {
            const cur = Array.isArray(Service.state.selectedTokenIds) ? Service.state.selectedTokenIds : [];
            Service.setSelectedTokens([...cur, ...hitIds]);
          } else {
            Service.setSelectedTokens(hitIds);
          }
          if (hitIds.length > 1) {
            this.showActionToast(`${hitIds.length} fichas seleccionadas`);
          }
        }
      } else if (activePointerMode === 'pan' || (activePointerMode === 'rightPan' && movedDistance > 6)) {
        this.releaseCameraPanInertia?.();
      } else if (activePointerMode === 'wallVertex' || activePointerMode === 'wallMove') {
        if (wallDragCtx?.moved) {
          const label =
            activePointerMode === 'wallVertex'
              ? 'Vértice ajustado'
              : wallDragCtx.origWalls?.length > 1
                ? `${wallDragCtx.origWalls.length} muros movidos`
                : 'Muro movido';
          Service.recordEvent('MURO', label);
          Service.notify({ redrawFog: true });
        }
        wallDragCtx = null;
      } else if (activePointerMode === 'wallSelect' && Service.state.wallSelectBox) {
        const box = Service.state.wallSelectBox;
        Service.state.wallSelectBox = null;
        this.renderVectorOverlay(Service.state);
        if (movedDistance < 6) {
          if (!wallSelectShift) Service.setSelectedWallIds([]);
        } else {
          const hitIds = findWallsInRect(Service.state.walls, box).map((w) => w.id);
          if (wallSelectShift) {
            const cur = Array.isArray(Service.state.selectedWallIds) ? Service.state.selectedWallIds : [];
            Service.setSelectedWallIds([...cur, ...hitIds]);
          } else {
            Service.setSelectedWallIds(hitIds);
          }
        }
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
      groupDragOrigins = null;
      dragPath = [];
      currentStroke = null;
    });

    const cancelTransientDrag = () => {
      if (Service.state.tokenSelectBox || Service.state.wallSelectBox) {
        Service.state.tokenSelectBox = null;
        Service.state.wallSelectBox = null;
        this.renderVectorOverlay(Service.state);
      }
      activePointerMode = null;
      draggingTokenId = null;
      groupDragOrigins = null;
      wallDragCtx = null;
      dragPath = [];
      currentStroke = null;
      this.draggingTokenId = null;
    };
    window.addEventListener('pointercancel', cancelTransientDrag);
    window.addEventListener('blur', cancelTransientDrag);

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
      if (Selector.isNarrativeScene(Service.state)) {
        if (Service.state.role !== 'gm') return;
        this.ctxTargetTokenId = null;
        this.openContextMenu(e.clientX, e.clientY);
        return;
      }
      if (Service.state.role === 'player' && this.ctxTargetTokenId) {
        const tok = Service.state.tokens.find((t) => t.id === this.ctxTargetTokenId);
        if (!tok || !Service.canControlToken(tok)) return;
      }
      if (Service.clearDiceHand()) return;
      if (Service.state.role === 'gm' && !this.ctxTargetTokenId) {
        const isWallTool = Service.state.tool === 'wall';
        const hitWall = findWallNearPoint(
          Service.state.walls,
          this.ctxWorldPos.x,
          this.ctxWorldPos.y,
          isWallTool ? 18 : 20,
          isWallTool ? {} : { kinds: ['door', 'secret'] }
        );
        if (hitWall) {
          const selIds = Array.isArray(Service.state.selectedWallIds) ? Service.state.selectedWallIds : [];
          let targetWalls = [hitWall];
          if (isWallTool && selIds.length > 0 && selIds.includes(hitWall.id)) {
            const idSet = new Set(selIds);
            targetWalls = (Service.state.walls || []).filter((w) => w && idSet.has(w.id));
          } else if (isWallTool && Service.state.wallMode === 'select') {
            Service.setSelectedWallIds([hitWall.id]);
          }
          this.openWallContextMenu?.(e.clientX, e.clientY, targetWalls);
          return;
        }
      }
      if (this.ctxTargetTokenId) {
        const selIds = Array.isArray(Service.state.selectedTokenIds) ? Service.state.selectedTokenIds : [];
        if (selIds.length > 1 && selIds.includes(this.ctxTargetTokenId)) {
          const grpTokens = Service.getSelectedControllableTokens(selIds);
          if (grpTokens.length > 1) {
            this.openMultiTokenContextMenu?.(e.clientX, e.clientY, grpTokens);
            return;
          }
        }
      }
      this.openContextMenu(e.clientX, e.clientY);
    });

    // Zoom con rueda del ratón (Shift + Rueda rota Cono/Línea en selección de área)
    this.els.stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (Selector.isNarrativeScene(Service.state)) {
          return;
        }
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
    window.addEventListener('dragstart', (e) => {
      this._isInternalDrag = true;
      const card = e.target?.closest?.('[data-drag-spec]');
      if (card && e.dataTransfer) {
        e.dataTransfer.setData('text/plain', card.dataset.dragSpec);
        e.dataTransfer.setData('application/x-portal-drag', card.dataset.dragSpec);
      }
    });

    window.addEventListener('dragend', () => {
      this._isInternalDrag = false;
      this.els.dropModuleOverlay?.classList.add('hidden');
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this._isInternalDrag) {
        this.els.dropModuleOverlay?.classList.add('hidden');
        return;
      }
      if (this.els.tokenEditorModal?.classList.contains('is-open') || this.els.mapGridModal?.classList.contains('is-open')) return;
      const types = Array.from(e.dataTransfer?.types || []);
      if (types.includes('Files') && !types.includes('application/x-portal-drag')) {
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
      const wasInternal = Boolean(this._isInternalDrag);
      this._isInternalDrag = false;
      this.els.dropModuleOverlay.classList.add('hidden');
      if (this.els.tokenEditorModal?.classList.contains('is-open') || this.els.mapGridModal?.classList.contains('is-open')) return;

      // 1. Priorizar elementos arrastrados desde el Compendio o Pantalla del DJ (actor:, map:, item:)
      const dragSpec = e.dataTransfer
        ? (e.dataTransfer.getData('application/x-portal-drag') || e.dataTransfer.getData('text/plain') || '')
        : '';
      if (dragSpec.startsWith('actor:') || dragSpec.startsWith('map:') || dragSpec.startsWith('item:')) {
        const worldPt = Selector.screenToWorld(Service.state, e.clientX, e.clientY);
        if (dragSpec.startsWith('actor:')) {
          const key = dragSpec.replace('actor:', '');
          const allActors = [...(Service.state.customActors || []), ...COMPENDIUM_ACTORS];
          const tpl = allActors.find((a) => a.key === key);
          if (tpl) {
            const existedBefore =
              tpl.isAlly !== false &&
              (Service.state.tokens || []).some((t) => t && t.isAlly !== false && t.actorKey === tpl.key);
            const spawned = await Service.spawnActorFromTemplate(tpl, worldPt.x, worldPt.y);
            this.showActionToast(
              existedBefore
                ? `${spawned?.name || tpl.name} reubicado en el tablero.`
                : `${spawned?.name || tpl.name} desplegado en el tablero.`
            );
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
        return;
      }

      if (wasInternal) return;

      // 2. Archivos externos soltados desde el sistema operativo (.portal / .json / Imágenes de mapa)
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
          const webpUrl = await WebPConverter.fileToWebPDataUrl(file, WebPConverter.MAP_MAX_DIM, WebPConverter.MAP_QUALITY);
          Service.loadExternalMapImage(webpUrl);
          await Service.changeMap('custom', webpUrl);
          this.showActionToast(`Mapa "${file.name}" optimizado a WebP.`);
        } catch (err) {
          this.showActionToast(err.message || 'Error al procesar imagen WebP.');
        }
        return;
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
        const nextTool = toolBtn.dataset.ctxTool;
        Service.setTool(nextTool);
        this.hideContextMenu();
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
      if (
        !isPlayer &&
        (e.key === 'Delete' || e.key === 'Backspace') &&
        Service.state.tool === 'wall' &&
        Array.isArray(Service.state.selectedWallIds) &&
        Service.state.selectedWallIds.length > 0
      ) {
        e.preventDefault();
        const removed = Service.removeWallsByIds(Service.state.selectedWallIds);
        if (removed > 0) {
          this.showActionToast(removed > 1 ? `🗑 ${removed} muros eliminados` : '🗑 Muro eliminado');
        }
        return;
      }
      if (!isPlayer && (e.ctrlKey || e.metaKey) && Service.state.tool === 'wall') {
        if (k === 'c') {
          const n = Service.copySelectedWalls();
          if (n > 0) {
            e.preventDefault();
            this.showActionToast(n > 1 ? `📋 ${n} muros copiados` : '📋 Muro copiado');
            return;
          }
        } else if (k === 'v') {
          const grid = normalizeGridConfig(Service.state.grid);
          const pt = resolveWallDrawPoint(this.hoverWorldPos.x, this.hoverWorldPos.y, {
            grid,
            walls: Service.state.walls,
            freehand: Boolean(e.altKey)
          });
          const pasted = Service.pasteWallsAt(pt.x, pt.y);
          if (pasted.length > 0) {
            e.preventDefault();
            this.showActionToast(pasted.length > 1 ? `📌 ${pasted.length} muros pegados` : '📌 Muro pegado');
            return;
          }
        }
      }
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

    const selSet = new Set(
      Array.isArray(state.selectedTokenIds) && state.selectedTokenIds.length > 0
        ? state.selectedTokenIds
        : state.selectedTokenId
          ? [state.selectedTokenId]
          : []
    );

    for (const tok of visibleTokens) {
      const diameter = Math.round(cs * (tok.size || 1) * 0.84);
      const isSel = selSet.has(tok.id);
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
