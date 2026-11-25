/* ==========================================================================
   MAP GRID EDITOR VIEW: ESCENARIO UNIFICADO (GRILLA/ESCALA + ILUMINACIÓN)
   ========================================================================== */

import { COMPENDIUM_MAPS, buildPresetWallsForMap } from '../data/compendium.js?v=20261125a1';
import { Selector } from '../core/selector.js?v=20261125a1';
import { Service } from '../core/service.js?v=20261125a1';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { fitGridToBounds, normalizeGridConfig } from '../utils/gridGeometry.js?v=20261125a1';
import {
  displayValueToMeters,
  formatDistance,
  metersToDisplayValue,
  normalizeSceneLighting
} from '../utils/lightingModel.js?v=20261125a1';
import { drawScenePreview } from '../utils/scenePreviewDraw.js?v=20261125a1';
import { drawPresetMapBackground } from './canvasView.js?v=20261125a1';

export const MapGridEditorViewMethods = {
  _ensureMapGridEditorState() {
    if (!this._mapGridEditor) {
      this._mapGridEditor = {
        title: 'Escenario',
        mapId: 'bastion',
        sceneKey: '',
        isActiveScene: false,
        activeTab: 'grid',
        imageUrl: '',
        img: null,
        bgCanvas: null,
        fogPreviewCanvas: null,
        grid: normalizeGridConfig({}),
        lighting: normalizeSceneLighting({}),
        walls: [],
        probePos: { x: 440, y: 440 },
        viewZoom: 1,
        viewX: 0,
        viewY: 0,
        onApply: null,
        loadSeq: 0
      };
    }
    return this._mapGridEditor;
  },

  bindMapGridEditorEvents() {
    const modal = this.els.mapGridModal;
    if (!modal || this._mapGridEditorBound) return;
    this._mapGridEditorBound = true;
    const ed = this._ensureMapGridEditorState();

    const closeModal = () => this.closeMapGridEditor();
    this.els.btnCloseMapGrid?.addEventListener('click', closeModal);
    this.els.btnCancelMapGrid?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    const patchGrid = (patch) => {
      ed.grid = normalizeGridConfig({ ...ed.grid, ...patch });
      this.syncMapGridControls();
      this.renderMapGridPreview();
    };

    const patchLighting = (patch) => {
      ed.lighting = normalizeSceneLighting({ ...ed.lighting, ...patch });
      this.syncMapGridControls();
      this.renderMapGridPreview();
    };

    const stepMetersPerUnit = (deltaSteps) => {
      const unit = Selector.getSystemVisionConfig(Service.state).distanceUnit;
      const curDisp = metersToDisplayValue(ed.grid.metersPerUnit, unit);
      const step = unit === 'ft' ? 5 : 0.5;
      const minVal = unit === 'ft' ? 2.5 : 0.5;
      const nextDisp = Math.max(minVal, Math.round((curDisp + deltaSteps * step) * 10) / 10);
      patchGrid({ metersPerUnit: displayValueToMeters(nextDisp, unit) });
    };

    this.els.sceneEditorTabSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-scene-tab]');
      if (!btn) return;
      ed.activeTab = btn.dataset.sceneTab === 'lighting' ? 'lighting' : 'grid';
      this.syncMapGridControls();
      this.renderMapGridPreview();
    });

    this.els.mapGridTypeSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-grid-type-mode]');
      if (!btn) return;
      const mode = btn.dataset.gridTypeMode;
      const nextType =
        mode === 'none'
          ? 'none'
          : mode === 'hex'
            ? ed.grid.type === 'hex-h'
              ? 'hex-h'
              : 'hex-v'
            : 'square';
      patchGrid({ type: nextType });
    });

    this.els.mapGridHexOrientRow?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-grid-hex-orient]');
      if (!btn) return;
      patchGrid({ type: btn.dataset.gridHexOrient });
    });

    this.els.btnMapGridSizeMinus?.addEventListener('click', (e) => {
      patchGrid({ cellSize: ed.grid.cellSize - (e.shiftKey ? 5 : 1) });
    });
    this.els.btnMapGridSizePlus?.addEventListener('click', (e) => {
      patchGrid({ cellSize: ed.grid.cellSize + (e.shiftKey ? 5 : 1) });
    });
    this.els.inpMapGridSize?.addEventListener('change', (e) => patchGrid({ cellSize: e.target.value }));

    this.els.btnMapScaleMinus?.addEventListener('click', () => stepMetersPerUnit(-1));
    this.els.btnMapScalePlus?.addEventListener('click', () => stepMetersPerUnit(1));
    this.els.inpMapScaleVal?.addEventListener('change', (e) => {
      const unit = Selector.getSystemVisionConfig(Service.state).distanceUnit;
      patchGrid({ metersPerUnit: displayValueToMeters(Number(e.target.value) || 1.5, unit) });
    });

    this.els.btnLightingScaleMinus?.addEventListener('click', () => stepMetersPerUnit(-1));
    this.els.btnLightingScalePlus?.addEventListener('click', () => stepMetersPerUnit(1));
    this.els.inpLightingScaleVal?.addEventListener('change', (e) => {
      const unit = Selector.getSystemVisionConfig(Service.state).distanceUnit;
      patchGrid({ metersPerUnit: displayValueToMeters(Number(e.target.value) || 1.5, unit) });
    });

    this.els.btnMapGridOffXMinus?.addEventListener('click', (e) => {
      patchGrid({ offsetX: ed.grid.offsetX - (e.shiftKey ? 5 : 1) });
    });
    this.els.btnMapGridOffXPlus?.addEventListener('click', (e) => {
      patchGrid({ offsetX: ed.grid.offsetX + (e.shiftKey ? 5 : 1) });
    });
    this.els.inpMapGridOffX?.addEventListener('change', (e) => patchGrid({ offsetX: e.target.value }));

    this.els.btnMapGridOffYMinus?.addEventListener('click', (e) => {
      patchGrid({ offsetY: ed.grid.offsetY - (e.shiftKey ? 5 : 1) });
    });
    this.els.btnMapGridOffYPlus?.addEventListener('click', (e) => {
      patchGrid({ offsetY: ed.grid.offsetY + (e.shiftKey ? 5 : 1) });
    });
    this.els.inpMapGridOffY?.addEventListener('change', (e) => patchGrid({ offsetY: e.target.value }));

    this.els.btnMapGridResetOffset?.addEventListener('click', () => patchGrid({ offsetX: 0, offsetY: 0 }));

    this.els.btnFitMapGrid?.addEventListener('click', () => {
      const cols = Number(this.els.inpMapGridCols?.value) || 0;
      const rows = Number(this.els.inpMapGridRows?.value) || 0;
      if (cols < 2 && rows < 2) return;
      let boundsX = 0;
      let boundsY = 0;
      let boundsWidth = 2400;
      let boundsHeight = 1600;
      const iw = ed.img?.naturalWidth || ed.img?.width || 0;
      const ih = ed.img?.naturalHeight || ed.img?.height || 0;
      if (iw > 0 && ih > 0) {
        const scale = Math.min(2400 / iw, 1600 / ih);
        boundsWidth = iw * scale;
        boundsHeight = ih * scale;
        boundsX = (2400 - boundsWidth) / 2;
        boundsY = (1600 - boundsHeight) / 2;
      }
      const fitted = fitGridToBounds({
        cols,
        rows,
        type: ed.grid.type,
        boundsWidth,
        boundsHeight,
        boundsX,
        boundsY
      });
      patchGrid(fitted);
    });

    this.els.rngMapGridOpacity?.addEventListener('input', (e) => {
      patchGrid({ opacity: Number(e.target.value) / 100 });
    });

    this.els.mapGridColorSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-grid-color]');
      if (!btn) return;
      patchGrid({ color: btn.dataset.gridColor });
    });

    this.els.chkMapGridSnap?.addEventListener('change', (e) => {
      patchGrid({ snap: e.target.checked });
    });

    this.els.sceneLightingModeSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-scene-light-mode]');
      if (!btn) return;
      patchLighting({ dynamicLighting: btn.dataset.sceneLightMode === 'dynamic' });
    });

    this.els.chkSceneRememberExplored?.addEventListener('change', (e) => {
      patchLighting({ rememberExplored: e.target.checked });
    });

    this.els.btnSceneResetExplored?.addEventListener('click', () => {
      if (!ed.sceneKey) return;
      const next = Service.resetSceneExploredFog(ed.sceneKey, { broadcast: true });
      ed.lighting = { ...next, dynamicLighting: ed.lighting.dynamicLighting, rememberExplored: ed.lighting.rememberExplored };
      this.syncMapGridControls();
      this.renderMapGridPreview();
      this.showActionToast('Área descubierta reseteada.');
    });

    const commitAndClose = () => {
      const result = {
        grid: normalizeGridConfig(ed.grid),
        lighting: normalizeSceneLighting(ed.lighting)
      };
      const cb = ed.onApply;
      this.closeMapGridEditor();
      if (typeof cb === 'function') cb(result);
    };

    this.els.btnSceneOpenSystemVision?.addEventListener('click', () => {
      commitAndClose();
      this.sysModalSection = 'rules';
      this.openSystemModal?.();
    });

    this.els.btnSceneDrawWalls?.addEventListener('click', () => {
      commitAndClose();
      Service.setTool('wall');
      this.showActionToast('Muros y Puertas [W] activos.');
    });

    this.els.btnMapGridResetView?.addEventListener('click', () => {
      ed.viewZoom = 1;
      ed.viewX = 0;
      ed.viewY = 0;
      this.syncMapGridControls();
      this.renderMapGridPreview();
    });

    const canvas = this.els.mapGridCanvas;
    let dragMode = ''; // 'offset' | 'probe'
    let startClient = { x: 0, y: 0 };
    let startOffset = { x: 0, y: 0 };
    let startProbe = { x: 0, y: 0 };

    const clientToPreviewWorld = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const rx = (clientX - rect.left) / Math.max(1, rect.width);
      const ry = (clientY - rect.top) / Math.max(1, rect.height);
      return {
        x: Math.max(24, Math.min(2376, ed.viewX + rx * (2400 / ed.viewZoom))),
        y: Math.max(24, Math.min(1576, ed.viewY + ry * (1600 / ed.viewZoom)))
      };
    };

    canvas?.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startClient = { x: e.clientX, y: e.clientY };
      if (ed.activeTab === 'lighting' || ed.grid.type === 'none') {
        dragMode = 'probe';
        const pt = clientToPreviewWorld(e.clientX, e.clientY);
        const grabRadius = Math.max(56, ed.grid.cellSize * 0.75);
        if (Math.hypot(pt.x - ed.probePos.x, pt.y - ed.probePos.y) > grabRadius) {
          ed.probePos = pt;
          this.renderMapGridPreview();
        }
        startProbe = { x: ed.probePos.x, y: ed.probePos.y };
      } else {
        dragMode = 'offset';
        startOffset = { x: ed.grid.offsetX, y: ed.grid.offsetY };
      }
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    window.addEventListener('pointermove', (e) => {
      if (!dragMode || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dxWorld = ((e.clientX - startClient.x) / Math.max(1, rect.width)) * (2400 / ed.viewZoom);
      const dyWorld = ((e.clientY - startClient.y) / Math.max(1, rect.height)) * (1600 / ed.viewZoom);
      if (dragMode === 'probe') {
        ed.probePos = {
          x: Math.max(24, Math.min(2376, startProbe.x + dxWorld)),
          y: Math.max(24, Math.min(1576, startProbe.y + dyWorld))
        };
        this.renderMapGridPreview();
      } else {
        patchGrid({
          offsetX: startOffset.x + dxWorld,
          offsetY: startOffset.y + dyWorld
        });
      }
    });

    const endDrag = (e) => {
      if (!dragMode) return;
      dragMode = '';
      try {
        if (canvas?.hasPointerCapture?.(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    this.els.mapGridStage?.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const rx = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
        const ry = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
        const oldZoom = ed.viewZoom;
        const nextZoom = Math.max(1, Math.min(6, Math.round(oldZoom * (e.deltaY < 0 ? 1.18 : 0.85) * 100) / 100));
        const worldMx = ed.viewX + rx * (2400 / oldZoom);
        const worldMy = ed.viewY + ry * (1600 / oldZoom);
        ed.viewZoom = nextZoom;
        ed.viewX = Math.max(0, Math.min(2400 - 2400 / nextZoom, worldMx - rx * (2400 / nextZoom)));
        ed.viewY = Math.max(0, Math.min(1600 - 1600 / nextZoom, worldMy - ry * (1600 / nextZoom)));
        this.syncMapGridControls();
        this.renderMapGridPreview();
      },
      { passive: false }
    );

    this.els.btnApplyMapGrid?.addEventListener('click', commitAndClose);
  },

  openMapGridEditor({
    title = 'Escenario',
    mapId = 'bastion',
    sceneKey = '',
    isActiveScene = false,
    activeTab = 'grid',
    imageUrl = '',
    initialGrid = null,
    initialLighting = null,
    walls = [],
    initialProbePos = null,
    onApply = null
  } = {}) {
    this.bindMapGridEditorEvents();
    const ed = this._ensureMapGridEditorState();
    const seq = ++ed.loadSeq;
    ed.title = String(title || 'Escenario').trim() || 'Escenario';
    ed.mapId = mapId || 'bastion';
    ed.sceneKey = String(sceneKey || '').trim();
    ed.isActiveScene = Boolean(isActiveScene);
    ed.activeTab = activeTab === 'lighting' ? 'lighting' : 'grid';
    ed.imageUrl = String(imageUrl || '').trim();
    ed.img = null;
    ed.grid = normalizeGridConfig(initialGrid || {});
    ed.lighting = normalizeSceneLighting(initialLighting || {}, {
      dynamicLighting: true,
      rememberExplored: Selector.getSystemVisionConfig(Service.state).rememberExplored
    });
    ed.walls = Array.isArray(walls) ? walls.map((w) => ({ ...w })) : [];
    ed.probePos =
      initialProbePos && Number.isFinite(initialProbePos.x) && Number.isFinite(initialProbePos.y)
        ? { x: initialProbePos.x, y: initialProbePos.y }
        : { x: 440, y: 440 };
    ed.viewZoom = 1;
    ed.viewX = 0;
    ed.viewY = 0;
    ed.onApply = onApply;

    if (typeof document !== 'undefined') {
      if (!ed.bgCanvas) {
        ed.bgCanvas = document.createElement('canvas');
        ed.bgCanvas.width = 2400;
        ed.bgCanvas.height = 1600;
      }
      if (!ed.fogPreviewCanvas && this.els.mapGridCanvas) {
        ed.fogPreviewCanvas = document.createElement('canvas');
        ed.fogPreviewCanvas.width = this.els.mapGridCanvas.width;
        ed.fogPreviewCanvas.height = this.els.mapGridCanvas.height;
      }
    }
    if (ed.bgCanvas) {
      drawPresetMapBackground(ed.bgCanvas.getContext('2d'), ed.mapId);
    }

    if (this.els.lblMapGridTitle) this.els.lblMapGridTitle.textContent = ed.title;
    this.els.mapGridModal?.classList.add('is-open');
    this.syncMapGridControls();
    this.renderMapGridPreview();

    if (ed.imageUrl) {
      const direct = DriveUrlHelper.toDirectImageUrl(ed.imageUrl) || ed.imageUrl;
      const img = new Image();
      if (!direct.startsWith('data:') && !direct.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        if (seq !== ed.loadSeq) return;
        ed.img = img;
        this.renderMapGridPreview();
      };
      img.src = direct;
    }
  },

  openMapGridEditorForActiveScene(activeTab = 'grid') {
    const state = Service.state;
    const key = Service.getActiveSceneKey();
    const allMaps = [...(state.customMaps || []), ...COMPENDIUM_MAPS];
    const matched = allMaps.find((m) => m.key === key || m.key === state.mapId);
    const title = matched?.name || (state.mapId === 'custom' ? 'Mapa personalizado' : state.mapId || 'Escenario');
    const imageUrl = state.mapId === 'custom' ? (state.customMapUrl || Service.loadedMapImage?.src || '') : '';
    const firstAlly = (state.tokens || []).find((t) => !t.hidden && t.isAlly !== false);
    const probePos = firstAlly ? { x: firstAlly.x, y: firstAlly.y } : { x: 440, y: 440 };

    Service.flushExploredMask();
    this.openMapGridEditor({
      title,
      mapId: state.mapId,
      sceneKey: key,
      isActiveScene: true,
      activeTab,
      imageUrl,
      initialGrid: state.grid,
      initialLighting: Service.getSceneLighting(key),
      walls: state.walls || buildPresetWallsForMap(state.mapId),
      initialProbePos: probePos,
      onApply: ({ grid, lighting }) => {
        Service.updateGrid(grid, { broadcast: true });
        Service.updateSceneLighting(
          key,
          { dynamicLighting: lighting.dynamicLighting, rememberExplored: lighting.rememberExplored },
          { broadcast: true }
        );
        this.showActionToast('Configuración de escenario guardada.');
      }
    });
  },

  closeMapGridEditor() {
    const ed = this._ensureMapGridEditorState();
    ed.loadSeq += 1;
    ed.onApply = null;
    this.els.mapGridModal?.classList.remove('is-open');
  },

  syncMapGridControls() {
    const ed = this._ensureMapGridEditorState();
    const g = ed.grid;
    const l = ed.lighting;
    const visionCfg = Selector.getSystemVisionConfig(Service.state);
    const unit = visionCfg.distanceUnit;
    const isHex = g.type === 'hex-v' || g.type === 'hex-h';
    const isNone = g.type === 'none';

    this.els.sceneEditorTabSeg?.querySelectorAll('[data-scene-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.sceneTab === ed.activeTab);
    });
    this.els.scenePaneGrid?.classList.toggle('hidden', ed.activeTab !== 'grid');
    this.els.scenePaneGrid?.classList.toggle('flex', ed.activeTab === 'grid');
    this.els.scenePaneLighting?.classList.toggle('hidden', ed.activeTab !== 'lighting');
    this.els.scenePaneLighting?.classList.toggle('flex', ed.activeTab === 'lighting');

    if (this.els.lblMapGridStageHint) {
      this.els.lblMapGridStageHint.textContent =
        ed.activeTab === 'lighting'
          ? 'Toca o arrastra "PJ" para probar el alcance de visión y muros'
          : isNone
            ? 'Arrastra "PJ" sobre una puerta o pasillo para comparar su tamaño real'
            : 'Arrastra para alinear la grilla · Rueda para acercar';
    }

    this.els.mapGridTypeSeg?.querySelectorAll('[data-grid-type-mode]').forEach((btn) => {
      const target = isNone ? 'none' : isHex ? 'hex' : 'square';
      btn.classList.toggle('is-active', btn.dataset.gridTypeMode === target);
    });
    this.els.mapGridHexOrientRow?.classList.toggle('hidden', !isHex);
    this.els.mapGridHexOrientRow?.classList.toggle('grid', isHex);
    this.els.mapGridHexOrientRow?.querySelectorAll('[data-grid-hex-orient]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.gridHexOrient === g.type);
    });

    this.els.mapGridOnlyControls?.classList.toggle('hidden', isNone);
    if (this.els.lblMapGridSizeTitle) {
      this.els.lblMapGridSizeTitle.textContent = isNone ? 'Tamaño de ficha' : 'Tamaño de celda';
    }

    const scaleDisp = metersToDisplayValue(g.metersPerUnit, unit);
    if (this.els.lblMapGridSizeDetail) {
      this.els.lblMapGridSizeDetail.textContent = `${Number(g.cellSize.toFixed(1))}px · ${formatDistance(g.metersPerUnit, unit)}`;
    }
    if (this.els.inpMapGridSize && document.activeElement !== this.els.inpMapGridSize) {
      this.els.inpMapGridSize.value = String(g.cellSize);
    }
    if (this.els.inpMapScaleVal && document.activeElement !== this.els.inpMapScaleVal) {
      this.els.inpMapScaleVal.value = String(scaleDisp);
      this.els.inpMapScaleVal.step = unit === 'ft' ? '5' : '0.5';
    }
    if (this.els.lblMapScaleUnit) this.els.lblMapScaleUnit.textContent = unit;

    if (this.els.inpLightingScaleVal && document.activeElement !== this.els.inpLightingScaleVal) {
      this.els.inpLightingScaleVal.value = String(scaleDisp);
      this.els.inpLightingScaleVal.step = unit === 'ft' ? '5' : '0.5';
    }
    if (this.els.lblLightingScaleUnit) this.els.lblLightingScaleUnit.textContent = unit;

    if (this.els.inpMapGridOffX && document.activeElement !== this.els.inpMapGridOffX) {
      this.els.inpMapGridOffX.value = String(Math.round(g.offsetX * 10) / 10);
    }
    if (this.els.inpMapGridOffY && document.activeElement !== this.els.inpMapGridOffY) {
      this.els.inpMapGridOffY.value = String(Math.round(g.offsetY * 10) / 10);
    }

    const opPct = Math.round(g.opacity * 100);
    if (this.els.lblMapGridOpacity) this.els.lblMapGridOpacity.textContent = `${opPct}%`;
    if (this.els.rngMapGridOpacity) this.els.rngMapGridOpacity.value = String(opPct);

    this.els.mapGridColorSeg?.querySelectorAll('[data-grid-color]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.gridColor === g.color);
    });
    if (this.els.chkMapGridSnap) this.els.chkMapGridSnap.checked = Boolean(g.snap);

    this.els.sceneLightingModeSeg?.querySelectorAll('[data-scene-light-mode]').forEach((btn) => {
      const target = l.dynamicLighting ? 'dynamic' : 'ambient';
      btn.classList.toggle('is-active', btn.dataset.sceneLightMode === target);
    });
    if (this.els.chkSceneRememberExplored) {
      this.els.chkSceneRememberExplored.checked = l.rememberExplored !== false;
    }

    if (this.els.sceneExploredCard) {
      this.els.sceneExploredCard.classList.toggle('hidden', !ed.sceneKey);
    }
    if (this.els.lblSceneExploredStatus && ed.sceneKey) {
      const liveLighting = Service.getSceneLighting(ed.sceneKey);
      const hasExplored = Boolean(liveLighting.exploredMask) || (ed.isActiveScene && Boolean(this._exploredHasPixels));
      this.els.lblSceneExploredStatus.textContent = hasExplored ? 'Con progreso guardado' : 'Sin explorar';
    }
    if (this.els.lblSceneVisionSummary) {
      this.els.lblSceneVisionSummary.textContent = `Detección nocturna: ${formatDistance(visionCfg.nightDetectionMeters, unit)}`;
    }
    if (this.els.btnSceneDrawWalls) {
      this.els.btnSceneDrawWalls.classList.toggle('hidden', !ed.isActiveScene || Service.state.role !== 'gm');
    }

    if (this.els.lblMapGridViewZoom) {
      this.els.lblMapGridViewZoom.textContent = `${ed.viewZoom.toFixed(1)}×`;
    }
    this.els.btnMapGridResetView?.classList.toggle('hidden', ed.viewZoom <= 1.01);
  },

  renderMapGridPreview() {
    const canvas = this.els.mapGridCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ed = this._ensureMapGridEditorState();
    drawScenePreview({
      ctx,
      bgCanvas: ed.bgCanvas,
      img: ed.img,
      grid: ed.grid,
      lighting: ed.lighting,
      walls: ed.walls,
      probePos: ed.probePos,
      visionCfg: Selector.getSystemVisionConfig(Service.state),
      viewZoom: ed.viewZoom,
      viewX: ed.viewX,
      viewY: ed.viewY,
      width: canvas.width,
      height: canvas.height,
      theme: Service.state.theme,
      activeTab: ed.activeTab,
      fogPreviewCanvas: ed.fogPreviewCanvas,
      computeVisibilityPolygon: (origin, rad, walls) => Selector.computeVisibilityPolygon(origin, rad, walls)
    });
  }
};
