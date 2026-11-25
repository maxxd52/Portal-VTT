import { Selector } from '../core/selector.js?v=20261125a1';
import { Service } from '../core/service.js?v=20261125a1';
import { fillFogMist, getFogMistCanvas } from '../utils/fogShader.js?v=20261125a1';
import { COMPENDIUM_MAPS } from '../data/compendium.js?v=20261125a1';
import {
  resolveSceneTransitionMeta,
  computeTransitionTimings
} from '../utils/sceneTransitionModel.js?v=20261125a1';
import { drawGridOverlay, measureGridDistance, normalizeGridConfig } from '../utils/gridGeometry.js?v=20261125a1';
import {
  computeLightAnimationSample,
  formatDistance,
  MAP_LIGHT_TONE_META,
  resolveAmbientShadowVector,
  resolveCanvasLightingPlan
} from '../utils/lightingModel.js?v=20261125a1';
import { renderUiLineIcon } from '../utils/uiIcons.js?v=20261125a1';
import {
  createWeatherSimulation,
  drawWeatherSimulation,
  normalizeWeatherType,
  resolveWeatherFrameBudget,
  stepWeatherSimulation
} from '../utils/weatherEngine.js?v=20261125a1';
import {
  buildWallShadowCacheKey,
  collectWallShadowSegments,
  computeActiveMapBounds,
  getLightingTemperaturePalette,
  getSurfaceGrainDataUrl,
  resolveGridBlendConfig
} from '../utils/tabletopMaterial.js?v=20261125a1';
import {
  computeDoorPlacementOnWall,
  findWallEndpointNearPoint,
  findWallNearPoint,
  getWallDoorMode,
  isDoorVisibleToSeat,
  isWallDoor,
  isWallSecretDoor,
  normalizeWallKind,
  resolveDoorVisualState,
  resolveWallDrawPoint,
  shouldShowWallBlueprint
} from '../utils/wallGeometry.js?v=20261125a1';

const EXPLORED_W = 600;
const EXPLORED_H = 400;
const EXPLORED_SCALE = EXPLORED_W / 2400;

function clipToActiveMapBounds(ctx, bounds) {
  if (!ctx || !bounds) return false;
  if (bounds.x <= 0 && bounds.y <= 0 && bounds.width >= 2400 && bounds.height >= 1600) {
    return false;
  }
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 8);
  } else {
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  }
  ctx.clip();
  return true;
}

export function drawPresetMapBackground(ctx, _mapId) {
  ctx.clearRect(0, 0, 2400, 1600);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 2400, 1600);
}

/**
 * Canvas, Fog of War, Map Notes & Vector Overlay rendering methods mixed into View.
 */
export const CanvasViewMethods = {
  getExploredContext() {
    if (!this.exploredCanvas && typeof document !== 'undefined') {
      this.exploredCanvas = document.createElement('canvas');
      this.exploredCanvas.width = EXPLORED_W;
      this.exploredCanvas.height = EXPLORED_H;
    }
    return this.exploredCanvas ? this.exploredCanvas.getContext('2d', { willReadFrequently: true }) : null;
  },

  /**
   * Pre-caches the 2400x1600 base fog mist + cool night glaze per (theme, opacity)
   * so drawFogCanvas blits it in one drawImage instead of 2 full-canvas passes every frame.
   */
  getFogBaseCanvas(theme, opacity) {
    if (typeof document === 'undefined') return null;
    const key = `${theme || 'slate'}|${Number(opacity).toFixed(2)}`;
    if (this._fogBaseCanvas && this._fogBaseCacheKey === key) {
      return this._fogBaseCanvas;
    }
    if (!this._fogBaseCanvas) {
      this._fogBaseCanvas = document.createElement('canvas');
      this._fogBaseCanvas.width = 2400;
      this._fogBaseCanvas.height = 1600;
    }
    const bctx = this._fogBaseCanvas.getContext('2d');
    bctx.clearRect(0, 0, 2400, 1600);
    fillFogMist(bctx, 2400, 1600, { opacity });
    const tempPalette = getLightingTemperaturePalette(theme);
    bctx.save();
    bctx.globalCompositeOperation = 'source-atop';
    bctx.fillStyle = tempPalette.coolGlazeColor;
    bctx.fillRect(0, 0, 2400, 1600);
    bctx.restore();
    this._fogBaseCacheKey = key;
    return this._fogBaseCanvas;
  },

  scheduleFogRedraw(state) {
    this._pendingFogState = state || Service.state;
    if (this._fogRafId != null) return;
    const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : null;
    if (!raf) {
      const st = this._pendingFogState;
      this._pendingFogState = null;
      this.drawFogCanvas(st);
      return;
    }
    this._fogRafId = raf(() => {
      this._fogRafId = null;
      const st = this._pendingFogState || Service.state;
      this._pendingFogState = null;
      this.drawFogCanvas(st);
    });
  },

  clearExploredMemory() {
    if (this._saveExploredTimer) {
      clearTimeout(this._saveExploredTimer);
      this._saveExploredTimer = null;
    }
    const ectx = this.getExploredContext();
    if (ectx) {
      ectx.clearRect(0, 0, EXPLORED_W, EXPLORED_H);
    }
    this._exploredHasPixels = false;
    this._exploredAlphaCache = null;
    this._exploredLoadSeq = (this._exploredLoadSeq || 0) + 1;
    this._loadedExploredKey = Service.getActiveSceneKey();
    this._loadedExploredRev = Number(Service.state?.exploredRev) || 0;
  },

  exportExploredMaskDataUrl() {
    if (!this.exploredCanvas || !this._exploredHasPixels) return '';
    try {
      return this.exploredCanvas.toDataURL('image/png');
    } catch (_) {
      return '';
    }
  },

  syncExploredMemoryFromState(state) {
    if (!state || typeof document === 'undefined') return;
    if (!this.exploredCanvas) {
      this.exploredCanvas = document.createElement('canvas');
      this.exploredCanvas.width = EXPLORED_W;
      this.exploredCanvas.height = EXPLORED_H;
    }
    const key = Service.getActiveSceneKey();
    const rev = Number(state.exploredRev) || 0;
    const mask = String(state.exploredMask || '');
    const sameScene = key === this._loadedExploredKey && rev === this._loadedExploredRev;
    if (sameScene && (!mask || this._exploredHasPixels)) {
      if (!this._exploredLoadPromise) this._exploredLoadPromise = Promise.resolve();
      return this._exploredLoadPromise;
    }

    if (!sameScene) {
      if (this._saveExploredTimer) {
        clearTimeout(this._saveExploredTimer);
        this._saveExploredTimer = null;
      }
      this.getExploredContext()?.clearRect(0, 0, EXPLORED_W, EXPLORED_H);
      this._exploredHasPixels = false;
      this._exploredAlphaCache = null;
      this._loadedExploredKey = key;
      this._loadedExploredRev = rev;
    }

    const seq = (this._exploredLoadSeq = (this._exploredLoadSeq || 0) + 1);
    if (mask && (mask.startsWith('data:image/') || mask.startsWith('blob:'))) {
      this._exploredLoadPromise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (seq !== this._exploredLoadSeq || !this.exploredCanvas) {
            resolve();
            return;
          }
          const ectx = this.getExploredContext();
          ectx.drawImage(img, 0, 0, EXPLORED_W, EXPLORED_H);
          this._exploredHasPixels = true;
          this._exploredAlphaCache = null;
          this.drawFogCanvas(Service.state);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = mask;
      });
      return this._exploredLoadPromise;
    }
    this._exploredLoadPromise = Promise.resolve();
    return this._exploredLoadPromise;
  },

  scheduleSaveExploredMask() {
    if (Service.state.role !== 'gm' || Service.state.rememberExplored === false) return;
    if (this._saveExploredTimer) clearTimeout(this._saveExploredTimer);
    this._saveExploredTimer = setTimeout(() => {
      this._saveExploredTimer = null;
      const url = this.exportExploredMaskDataUrl();
      if (url) Service.saveActiveExploredMask(url);
    }, 450);
  },

  openNoteModal(note, wx = 0, wy = 0) {
    this.editingNoteCtx = note ? { id: note.id } : { x: wx, y: wy };
    this.els.inpNoteTitle.value = note ? note.title : '';
    this.els.inpNoteBody.value = note ? note.body || '' : '';
    this.els.chkNoteGmOnly.checked = note ? Boolean(note.gmOnly) : false;
    this.els.btnDeleteNote.classList.toggle('hidden', !note);
    this.els.noteEditorModal.classList.remove('hidden');
    this.els.noteEditorModal.classList.add('flex');
    this.els.inpNoteTitle.focus();
  },

  closeNoteModal() {
    this.editingNoteCtx = null;
    this.els.noteEditorModal.classList.add('hidden');
    this.els.noteEditorModal.classList.remove('flex');
  },

  renderMapNotes(state) {
    const layer = this.els.mapNotesLayer;
    if (!layer) return;
    const sceneKey = Service.getActiveSceneKey();
    const notes = (state.notes || []).filter(
      (n) => n.sceneKey === sceneKey && (!n.gmOnly || state.role === 'gm')
    );
    const sig = `${sceneKey}|${state.role}|` + notes
      .map((n) => `${n.id}:${n.x},${n.y},${n.gmOnly ? 1 : 0},${n.title || ''},${n.body || ''}`)
      .join(';');
    if (this._lastMapNotesSig === sig) return;
    this._lastMapNotesSig = sig;
    layer.innerHTML = notes
      .map(
        (n) => `
        <button
          type="button"
          data-map-note="${n.id}"
          class="portal-panel pointer-events-auto absolute -translate-x-1/2 -translate-y-full px-2 py-1 rounded-full flex items-center gap-1 text-[11px] font-semibold shadow-md hover:scale-105 transition-transform"
          style="left:${n.x}px; top:${n.y}px;"
          title="${n.body || n.title}"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${n.gmOnly ? '#f59e0b' : 'var(--accent-primary)'};"></span>
          <span class="max-w-[120px] truncate">${n.title}</span>
        </button>
      `
      )
      .join('');
    layer.querySelectorAll('[data-map-note]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const found = (Service.state.notes || []).find((n) => n.id === btn.dataset.mapNote);
        if (found) this.openNoteModal(found);
      });
    });
  },

  renderMapLights(state) {
    const layer = this.els?.mapLightsLayer;
    if (!layer) return;
    if (
      state.role !== 'gm' ||
      Selector.isNarrativeScene(state) ||
      state.tool !== 'wall'
    ) {
      if (this._lastMapLightsSig === '__empty__') return;
      this._lastMapLightsSig = '__empty__';
      layer.innerHTML = '';
      return;
    }
    const lights = Selector.getActiveMapLights(state, { includeDisabled: true });
    if (lights.length === 0) {
      if (this._lastMapLightsSig === '__empty__') return;
      this._lastMapLightsSig = '__empty__';
      layer.innerHTML = '';
      return;
    }
    const isPassive =
      state.stageLayer === 'walls' ||
      (state.stageLayer === 'select' && state.stageSelectFilter === 'walls');
    const selectedLightSet = new Set(Array.isArray(state.selectedMapLightIds) ? state.selectedMapLightIds : []);
    const sig = `${isPassive ? 1 : 0}|${[...selectedLightSet].sort().join(',')}|` + lights
      .map((l) => `${l.id}:${l.x},${l.y},${l.radiusMeters},${l.tone || ''},${l.enabled !== false ? 1 : 0}`)
      .join(';');
    if (this._lastMapLightsSig === sig) return;
    this._lastMapLightsSig = sig;
    layer.innerHTML = lights
      .map((l) => {
        const tone = MAP_LIGHT_TONE_META[l.tone] || MAP_LIGHT_TONE_META.warm;
        const enabled = l.enabled !== false;
        const isSelected = !isPassive && selectedLightSet.has(l.id);
        const ringStyle = enabled
          ? `color:${tone.color}; border-color:${tone.color};`
          : 'color:rgba(148,163,184,0.75); border-style:dashed; opacity:0.55;';
        const selectedStyle = isSelected
          ? 'box-shadow: 0 0 0 2.5px #8b5cf6, 0 0 12px rgba(139,92,246,0.45);'
          : '';
        const passiveStyle = isPassive ? 'opacity:0.45;' : '';
        const interCls = isPassive
          ? 'pointer-events-none'
          : 'pointer-events-auto hover:scale-110 transition-transform cursor-grab';
        return `
          <button
            type="button"
            data-map-light-id="${this.escapeHtml(l.id)}"
            class="portal-panel ${interCls} absolute w-7 h-7 rounded-full flex items-center justify-center shadow-md"
            style="left:${l.x}px; top:${l.y}px; transform:translate(-50%,-50%); ${ringStyle} ${selectedStyle} ${passiveStyle}"
            title="Luz de escenario (${l.radiusMeters} m · ${tone.label}) — Arrastrar o clic para editar"
          >${renderUiLineIcon('bulb', 'w-3.5 h-3.5')}</button>
        `;
      })
      .join('');
    if (isPassive) return;

    layer.querySelectorAll('[data-map-light-id]').forEach((btn) => {
      const lightId = btn.dataset.mapLightId;
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const found = (Service.state.mapLights || []).find((ml) => ml && ml.id === lightId);
        if (found) this.openMapLightContextMenu(e.clientX, e.clientY, found);
      });
      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const found = (Service.state.mapLights || []).find((ml) => ml && ml.id === lightId);
        if (!found) return;
        const inSelectMode = Service.state.stageLayer === 'select';
        const curLightIds = Array.isArray(Service.state.selectedMapLightIds) ? [...Service.state.selectedMapLightIds] : [];
        const curWallIds = Array.isArray(Service.state.selectedWallIds) ? [...Service.state.selectedWallIds] : [];
        if (inSelectMode && e.shiftKey) {
          const idx = curLightIds.indexOf(lightId);
          if (idx >= 0) curLightIds.splice(idx, 1);
          else curLightIds.push(lightId);
          Service.setSelectedMapLightIds(curLightIds);
          return;
        }
        const isGroupSelected = inSelectMode && curLightIds.includes(lightId) && (curLightIds.length + curWallIds.length > 1);
        if (inSelectMode && !isGroupSelected) {
          if (curWallIds.length > 0) Service.setSelectedWallIds([]);
          Service.setSelectedMapLightIds([lightId]);
        }
        const startX = e.clientX;
        const startY = e.clientY;
        const origX = Number(found.x) || 0;
        const origY = Number(found.y) || 0;
        const groupLights = isGroupSelected
          ? (Service.state.mapLights || [])
              .filter((ml) => ml && curLightIds.includes(ml.id))
              .map((ml) => ({ id: ml.id, x: Number(ml.x) || 0, y: Number(ml.y) || 0 }))
          : [{ id: lightId, x: origX, y: origY }];
        const groupWalls = isGroupSelected
          ? (Service.state.walls || [])
              .filter((w) => w && curWallIds.includes(w.id))
              .map((w) => ({ id: w.id, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }))
          : [];
        let moved = false;
        let curX = origX;
        let curY = origY;
        let lastDx = 0;
        let lastDy = 0;
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_) {}

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (!moved && Math.hypot(dx, dy) > 4) moved = true;
          if (moved) {
            const zoom = Math.max(0.1, Number(Service.state.camera?.zoom) || 1);
            lastDx = Math.round(dx / zoom);
            lastDy = Math.round(dy / zoom);
            curX = Math.max(0, Math.min(2400, origX + lastDx));
            curY = Math.max(0, Math.min(1600, origY + lastDy));
            btn.style.left = `${curX}px`;
            btn.style.top = `${curY}px`;
            if (isGroupSelected) {
              for (const gl of groupLights) {
                if (gl.id === lightId) continue;
                const el = layer.querySelector(`[data-map-light-id="${gl.id}"]`);
                if (el) {
                  el.style.left = `${Math.max(0, Math.min(2400, gl.x + lastDx))}px`;
                  el.style.top = `${Math.max(0, Math.min(1600, gl.y + lastDy))}px`;
                }
              }
              const byId = new Map((Service.state.walls || []).filter(Boolean).map((w) => [w.id, w]));
              for (const gw of groupWalls) {
                const live = byId.get(gw.id);
                if (!live) continue;
                live.x1 = Math.max(0, Math.min(2400, gw.x1 + lastDx));
                live.y1 = Math.max(0, Math.min(1600, gw.y1 + lastDy));
                live.x2 = Math.max(0, Math.min(2400, gw.x2 + lastDx));
                live.y2 = Math.max(0, Math.min(1600, gw.y2 + lastDy));
              }
              this.scheduleFogRedraw(Service.state);
              this.renderVectorOverlay(Service.state);
            }
          }
        };
        const onUp = (ev) => {
          btn.removeEventListener('pointermove', onMove);
          btn.removeEventListener('pointerup', onUp);
          btn.removeEventListener('pointercancel', onUp);
          try {
            btn.releasePointerCapture(ev.pointerId);
          } catch (_) {}
          if (moved) {
            if (isGroupSelected) {
              Service.pushUndoSnapshot();
              for (const gl of groupLights) {
                const liveL = (Service.state.mapLights || []).find((ml) => ml && ml.id === gl.id);
                if (liveL) {
                  liveL.x = Math.max(0, Math.min(2400, gl.x + lastDx));
                  liveL.y = Math.max(0, Math.min(1600, gl.y + lastDy));
                }
              }
              Service.syncWorldToPeers();
              Service.notify({ redrawFog: true });
            } else {
              Service.updateMapLight(lightId, { x: curX, y: curY });
            }
          } else {
            const latest = (Service.state.mapLights || []).find((ml) => ml && ml.id === lightId);
            if (latest) this.openMapLightContextMenu(ev.clientX, ev.clientY, latest);
          }
        };
        btn.addEventListener('pointermove', onMove);
        btn.addEventListener('pointerup', onUp);
        btn.addEventListener('pointercancel', onUp);
      });
    });
  },

  ensureBoardGrainLayer() {
    const el = this.els?.boardGrainLayer;
    if (!el || this._boardGrainReady) return;
    const url = getSurfaceGrainDataUrl(128);
    if (!url) return;
    el.style.backgroundImage = `url("${url}")`;
    this._boardGrainReady = true;
  },

  getActiveMapBounds(state) {
    if (state?.mapId === 'custom') {
      const img = this.els?.customMapImg;
      const loaded = Service.loadedMapImage;
      const iw = (img && img.complete && img.naturalWidth > 0 ? img.naturalWidth : 0) || loaded?.naturalWidth || loaded?.width || 0;
      const ih = (img && img.complete && img.naturalHeight > 0 ? img.naturalHeight : 0) || loaded?.naturalHeight || loaded?.height || 0;
      if (iw > 0 && ih > 0) {
        return computeActiveMapBounds(iw, ih, 2400, 1600);
      }
    }
    return { x: 0, y: 0, width: 2400, height: 1600 };
  },

  syncBoardBoundsToDom(state) {
    const bounds = this.getActiveMapBounds(state);
    const key = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
    const changed = this._activeMapBoundsKey !== key;
    this._activeMapBoundsKey = key;
    this._activeMapBounds = bounds;
    const wl = this.els?.worldLayer;
    if (wl && wl.style) {
      wl.style.setProperty('--map-x', `${bounds.x}px`);
      wl.style.setProperty('--map-y', `${bounds.y}px`);
      wl.style.setProperty('--map-w', `${bounds.width}px`);
      wl.style.setProperty('--map-h', `${bounds.height}px`);
    }
    return { bounds, changed };
  },

  drawMapCanvas(state) {
    this.ensureBoardGrainLayer();
    const isNarrative = Selector.isNarrativeScene(state);
    this.els.stage?.classList.toggle('is-narrative', isNarrative);
    const customSrc = state.mapId === 'custom' ? (state.customMapUrl || Service.loadedMapImage?.src || '') : '';

    if (isNarrative) {
      if (this.els.narrativeBackdropLayer) {
        this.els.narrativeBackdropLayer.classList.remove('hidden');
        this.els.narrativeBackdropLayer.dataset.ambient = Selector.getActiveAmbientLight(state);
      }
      if (this.els.narrativeBackdropImg) {
        if (customSrc) {
          if (this.els.narrativeBackdropImg.getAttribute('src') !== customSrc) {
            this.els.narrativeBackdropImg.src = customSrc;
          }
          this.els.narrativeBackdropImg.classList.remove('hidden');
        } else {
          this.els.narrativeBackdropImg.classList.add('hidden');
          this.els.narrativeBackdropImg.removeAttribute('src');
        }
      }
      if (this.els.customMapImg) {
        this.els.customMapImg.classList.add('hidden');
        this.els.customMapImg.removeAttribute('src');
      }
      this.syncSceneAtmosphere?.(state);
      this.syncWeatherOverlay?.(state);
      return;
    }

    if (this.els.narrativeBackdropLayer) {
      this.els.narrativeBackdropLayer.classList.add('hidden');
      this.els.narrativeBackdropLayer.dataset.ambient = 'day';
    }

    const ctx = this.els.mapCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);

    if (customSrc && this.els.customMapImg) {
      if (!this._customMapAtmoBound) {
        this._customMapAtmoBound = true;
        this.els.customMapImg.addEventListener('load', () => {
          this._lastAtmoKey = '';
          this.syncSceneAtmosphere?.(Service.state);
          const { changed } = this.syncBoardBoundsToDom(Service.state);
          if (changed) {
            this.drawWallShadowCanvas?.(Service.state);
            this.drawGridCanvas?.(Service.state);
            this.drawFogCanvas?.(Service.state);
          }
        });
      }
      if (this.els.customMapImg.getAttribute('src') !== customSrc) {
        this.els.customMapImg.src = customSrc;
      }
      this.els.customMapImg.classList.remove('hidden');
      this.syncBoardBoundsToDom(state);
      this.syncSceneAtmosphere?.(state);
      this.syncWeatherOverlay?.(state);
      return;
    }
    if (this.els.customMapImg) {
      this.els.customMapImg.classList.add('hidden');
      this.els.customMapImg.removeAttribute('src');
    }

    drawPresetMapBackground(ctx, state.mapId);
    this.syncBoardBoundsToDom(state);
    this.syncSceneAtmosphere?.(state);
    this.syncWeatherOverlay?.(state);
  },

  async prewarmActiveScene(state, decodeTimeoutMs = 700) {
    if (!state) return;
    const isNarrative = Selector.isNarrativeScene(state);
    const raceTimeout = (promise, ms) =>
      Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

    const decodeImgElement = (imgEl) => {
      if (!imgEl || !imgEl.getAttribute('src')) return Promise.resolve();
      if (typeof imgEl.decode === 'function') {
        return raceTimeout(imgEl.decode().catch(() => {}), decodeTimeoutMs);
      }
      return Promise.resolve();
    };

    if (this._visPolyCache instanceof Map) {
      this._visPolyCache.clear();
    }

    const mapImg = isNarrative ? this.els?.narrativeBackdropImg : this.els?.customMapImg;
    const mapDecodePromise = state.mapId === 'custom' ? decodeImgElement(mapImg) : Promise.resolve();
    const fadeInPrewarmPromise =
      state.mapId === 'custom' &&
      this._prewarmMapDecodeUrl === state.customMapUrl &&
      this._prewarmMapDecodePromise
        ? raceTimeout(this._prewarmMapDecodePromise, decodeTimeoutMs)
        : Promise.resolve();
    const exploredMaskPromise = this._exploredLoadPromise
      ? raceTimeout(this._exploredLoadPromise, decodeTimeoutMs)
      : Promise.resolve();

    // Pre-decode unique token portraits in parallel (capped at 16 for low-spec CPUs)
    const uniqueTokenUrls = [];
    const seen = new Set();
    for (const tok of Array.isArray(state.tokens) ? state.tokens : []) {
      const url = String(tok?.imageUrl || '').trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      uniqueTokenUrls.push(url);
      if (uniqueTokenUrls.length >= 16) break;
    }

    const tokenDecodes =
      typeof Image !== 'undefined'
        ? uniqueTokenUrls.map((url) =>
            raceTimeout(
              new Promise((resolve) => {
                const im = new Image();
                im.onload = () => (typeof im.decode === 'function' ? im.decode().then(resolve, resolve) : resolve());
                im.onerror = resolve;
                im.src = url;
              }),
              decodeTimeoutMs
            )
          )
        : [];

    await Promise.all([mapDecodePromise, fadeInPrewarmPromise, exploredMaskPromise, ...tokenDecodes]);

    if (
      state.mapId === 'custom' &&
      this._prewarmMapDecodeUrl === state.customMapUrl &&
      this._prewarmMapImg?.naturalWidth > 0 &&
      !Service.loadedMapImage?.naturalWidth
    ) {
      Service.loadedMapImage = this._prewarmMapImg;
    }

    // Single consolidated offscreen & tactical layer draw pass behind the curtain
    this.ensureBoardGrainLayer?.();
    if (!isNarrative) {
      getFogMistCanvas(512);
      const baseOpacity = state.role === 'gm' ? 0.45 : 0.85;
      this.getFogBaseCanvas?.(state.theme || 'slate', baseOpacity);
      this.syncBoardBoundsToDom?.(state);
      this.drawWallShadowCanvas?.(state);
      this.drawGridCanvas?.(state);
      this.drawFogCanvas?.(state);
    }
    this.syncSceneAtmosphere?.(state);
    this.syncWeatherOverlay?.(state, { prewarmSteps: 45 });
  },

  _getTransitionTimings(isInitialLoad = false) {
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return computeTransitionTimings({ reducedMotion, isInitialLoad });
  },

  _prepareTransitionTitle(curtain, stateMetaSource) {
    const meta = resolveSceneTransitionMeta(stateMetaSource, COMPENDIUM_MAPS);
    if (this.els.sceneTransitionTitle) {
      this.els.sceneTransitionTitle.textContent = meta.title;
    }
    if (this.els.sceneTransitionSubtitle) {
      this.els.sceneTransitionSubtitle.textContent = meta.subtitle;
    }
    curtain.classList.remove('is-title-in', 'is-title-out');
    curtain.classList.add('is-title-reset');
    void curtain.offsetWidth;
    curtain.classList.remove('is-title-reset');
  },

  async beginSceneDarken(nextStatePreview) {
    const curtain = this.els?.sceneTransitionCurtain;
    if (!curtain) return;

    if (this._sceneTransitionWatchdog) {
      clearTimeout(this._sceneTransitionWatchdog);
      this._sceneTransitionWatchdog = null;
    }
    if (this._prewarmMapTimer) {
      clearTimeout(this._prewarmMapTimer);
      this._prewarmMapTimer = null;
    }

    const seq = (this._sceneTransitionSeq = (this._sceneTransitionSeq || 0) + 1);
    this._pendingTransitionSeq = seq;
    const timings = this._getTransitionTimings(false);
    this._prepareTransitionTitle(curtain, nextStatePreview);

    if (
      nextStatePreview?.mapId === 'custom' &&
      nextStatePreview?.customMapUrl &&
      typeof Image !== 'undefined'
    ) {
      const targetUrl = nextStatePreview.customMapUrl;
      this._prewarmMapDecodeUrl = targetUrl;
      this._prewarmMapDecodePromise = new Promise((resolve) => {
        this._prewarmMapTimer = setTimeout(() => {
          this._prewarmMapTimer = null;
          if (seq !== this._sceneTransitionSeq) {
            resolve();
            return;
          }
          const im = new Image();
          this._prewarmMapImg = im;
          im.onload = () => (typeof im.decode === 'function' ? im.decode().then(resolve, resolve) : resolve());
          im.onerror = resolve;
          im.src = targetUrl;
        }, 90);
      });
    } else {
      this._prewarmMapDecodeUrl = '';
      this._prewarmMapDecodePromise = null;
      this._prewarmMapImg = null;
    }

    curtain.classList.add('is-backdrop-visible');
    const titleDelay = Math.round(timings.fadeInMs * 0.35);
    setTimeout(() => {
      if (seq === this._sceneTransitionSeq) {
        curtain.classList.add('is-title-in');
      }
    }, titleDelay);

    // Safety watchdog: never allow the curtain to remain stuck if render doesn't follow
    this._sceneTransitionWatchdog = setTimeout(() => {
      if (seq === this._sceneTransitionSeq) {
        this._pendingTransitionSeq = 0;
        curtain.classList.remove('is-backdrop-visible', 'is-title-in', 'is-title-out');
      }
    }, timings.fadeInMs + 1500);

    await new Promise((resolve) => setTimeout(resolve, timings.fadeInMs));
  },

  async triggerSceneTransition(state, { isInitialLoad = false } = {}) {
    const curtain = this.els?.sceneTransitionCurtain;
    if (!curtain) return;

    if (this._sceneTransitionWatchdog) {
      clearTimeout(this._sceneTransitionWatchdog);
      this._sceneTransitionWatchdog = null;
    }

    const timings = this._getTransitionTimings(isInitialLoad);
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let seq = 0;
    if (this._pendingTransitionSeq && this._pendingTransitionSeq === this._sceneTransitionSeq) {
      seq = this._pendingTransitionSeq;
      this._pendingTransitionSeq = 0;
    } else {
      seq = (this._sceneTransitionSeq = (this._sceneTransitionSeq || 0) + 1);
      this._pendingTransitionSeq = 0;
      this._prepareTransitionTitle(curtain, state);
      if (isInitialLoad) {
        curtain.classList.add('is-backdrop-instant', 'is-backdrop-visible');
      } else {
        curtain.classList.add('is-backdrop-visible');
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          if (seq === this._sceneTransitionSeq) {
            curtain.classList.add('is-title-in');
          }
        });
      } else {
        curtain.classList.add('is-title-in');
      }
    }

    await Promise.all([this.prewarmActiveScene(state, timings.decodeTimeoutMs), delay(timings.minHoldMs)]);

    if (typeof requestAnimationFrame === 'function') {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    if (seq !== this._sceneTransitionSeq) return;

    if (curtain.classList.contains('is-backdrop-instant')) {
      curtain.classList.remove('is-backdrop-instant');
      const backdrop = curtain.querySelector?.('.portal-scene-curtain-backdrop');
      void (backdrop || curtain).offsetWidth;
    }
    curtain.classList.remove('is-backdrop-visible');
    await delay(timings.backdropFadeOutMs + timings.titleLingerMs);

    if (seq !== this._sceneTransitionSeq) return;
    curtain.classList.remove('is-title-in');
    curtain.classList.add('is-title-out');

    await delay(timings.titleFadeOutMs + 40);
    if (seq === this._sceneTransitionSeq) {
      curtain.classList.remove('is-title-out');
    }
  },

  getWeatherSprites() {
    if (typeof document === 'undefined') return null;
    if (this._weatherSprites) return this._weatherSprites;

    const mistWisp = document.createElement('canvas');
    mistWisp.width = 128;
    mistWisp.height = 128;
    const mwCtx = mistWisp.getContext('2d');
    if (mwCtx) {
      const grad = mwCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(203, 213, 225, 1)');
      grad.addColorStop(1, 'rgba(203, 213, 225, 0)');
      mwCtx.fillStyle = grad;
      mwCtx.fillRect(0, 0, 128, 128);
    }

    const mistGust = document.createElement('canvas');
    mistGust.width = 128;
    mistGust.height = 8;
    const mgCtx = mistGust.getContext('2d');
    if (mgCtx) {
      const grad = mgCtx.createLinearGradient(0, 0, 128, 0);
      grad.addColorStop(0, 'rgba(226, 232, 240, 0)');
      grad.addColorStop(0.5, 'rgba(226, 232, 240, 1)');
      grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      mgCtx.strokeStyle = grad;
      mgCtx.lineWidth = 4;
      mgCtx.lineCap = 'round';
      mgCtx.beginPath();
      mgCtx.moveTo(4, 4);
      mgCtx.lineTo(124, 4);
      mgCtx.stroke();
    }

    const makeEmberSprite = (rgb) => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      const ectx = c.getContext('2d');
      if (ectx) {
        ectx.fillStyle = `rgba(${rgb}, 0.28)`;
        ectx.beginPath();
        ectx.arc(16, 16, 16, 0, Math.PI * 2);
        ectx.fill();
        ectx.fillStyle = `rgba(${rgb}, 1)`;
        ectx.beginPath();
        ectx.arc(16, 16, 6.15, 0, Math.PI * 2);
        ectx.fill();
      }
      return c;
    };

    this._weatherSprites = {
      mistWisp,
      mistGust,
      emberWarm: makeEmberSprite('251, 146, 60'),
      emberGold: makeEmberSprite('253, 224, 71')
    };
    return this._weatherSprites;
  },

  syncWeatherOverlay(state, { prewarmSteps = 0 } = {}) {
    const canvas = this.els?.weatherCanvas;
    if (!canvas || typeof window === 'undefined') return;
    const weather = normalizeWeatherType(state?.sceneWeather);
    const mode = Selector.isNarrativeScene(state) ? 'narrative' : 'tactical';

    if (weather === 'none') {
      if (this._weatherRafId) {
        cancelAnimationFrame(this._weatherRafId);
        this._weatherRafId = 0;
      }
      this._weatherSim = null;
      this._weatherSimKey = '';
      canvas.classList.add('hidden');
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (!this._weatherResizeBound) {
      this._weatherResizeBound = true;
      window.addEventListener('resize', () => {
        if (Service.state && normalizeWeatherType(Service.state.sceneWeather) !== 'none') {
          this.syncWeatherOverlay(Service.state);
        }
      });
    }

    const gfx = this.getGraphicsProfile?.() || null;
    const budget = resolveWeatherFrameBudget(weather, { fpsScale: gfx?.weatherFpsScale ?? 1 });
    this._weatherMinFrameMs = budget.minFrameMs || 22;

    const w = Math.max(320, window.innerWidth || 1280);
    const h = Math.max(240, window.innerHeight || 800);
    const dpr = Math.min(window.devicePixelRatio || 1, budget.maxDpr || 1);
    this._weatherDpr = dpr;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    canvas.classList.remove('hidden');

    const simKey = `${weather}|${mode}|${w}x${h}|${gfx?.tier || 'high'}`;
    if (this._weatherSimKey !== simKey || !this._weatherSim) {
      this._weatherSimKey = simKey;
      this._weatherSim = createWeatherSimulation({
        weather,
        mode,
        width: w,
        height: h,
        densityScale: gfx?.weatherDensityScale ?? 1
      });
      if (prewarmSteps > 0) {
        const steps = Math.min(60, Math.max(0, Math.trunc(prewarmSteps)));
        for (let i = 0; i < steps; i += 1) {
          stepWeatherSimulation(this._weatherSim, 1 / 30);
        }
      }
    }

    if (!this._weatherRafId) {
      let lastDrawTs = 0;
      const tick = (now) => {
        if (!this._weatherSim) {
          this._weatherRafId = 0;
          return;
        }
        const minFrameMs = this._weatherMinFrameMs || 22;
        if (!document.hidden && (lastDrawTs === 0 || now - lastDrawTs >= minFrameMs)) {
          const dt = lastDrawTs === 0 ? 1 / 60 : Math.min(0.05, Math.max(0.001, (now - lastDrawTs) / 1000));
          lastDrawTs = now;
          stepWeatherSimulation(this._weatherSim, dt);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const curDpr = this._weatherDpr || 1;
            ctx.save();
            ctx.setTransform(curDpr, 0, 0, curDpr, 0, 0);
            drawWeatherSimulation(ctx, this._weatherSim, { sprites: this.getWeatherSprites() });
            ctx.restore();
          }
        }
        this._weatherRafId = requestAnimationFrame(tick);
      };
      this._weatherRafId = requestAnimationFrame(tick);
    }
  },

  drawWallShadowCanvas(state) {
    const canvas = this.els?.wallShadowCanvas;
    if (!canvas) return;
    const enabled = this.isDynamicShadowsEnabled?.() !== false;
    const ambientDir = resolveAmbientShadowVector(Selector.getActiveAmbientLight(state));
    const bounds = this.getActiveMapBounds(state);
    const cacheKey = buildWallShadowCacheKey(state.walls, ambientDir, enabled, bounds);
    if (this._lastWallShadowKey === cacheKey) return;
    this._lastWallShadowKey = cacheKey;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 2400, 1600);
    if (!enabled) return;

    const segments = collectWallShadowSegments(state.walls);
    if (segments.length === 0) return;

    const ox = Math.round((Number(ambientDir.x) || -0.28) * 14 * 10) / 10;
    const oy = Math.round((Number(ambientDir.y) || 0.36) * 14 * 10) / 10;

    const traceKind = (isDoor, dx = 0, dy = 0) => {
      ctx.beginPath();
      for (const seg of segments) {
        if (seg.isDoor !== isDoor) continue;
        ctx.moveTo(seg.x1 + dx, seg.y1 + dy);
        ctx.lineTo(seg.x2 + dx, seg.y2 + dy);
      }
      ctx.stroke();
    };

    const hasWalls = segments.some((s) => !s.isDoor);
    const hasDoors = segments.some((s) => s.isDoor);

    ctx.save();
    clipToActiveMapBounds(ctx, bounds);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const passes = [
      { width: 32, color: 'rgba(4, 9, 20, 0.13)', dx: ox, dy: oy },
      { width: 20, color: 'rgba(4, 8, 18, 0.21)', dx: ox * 0.35, dy: oy * 0.35 },
      { width: 9, color: 'rgba(2, 5, 12, 0.30)', dx: 0, dy: 0 }
    ];

    if (hasWalls) {
      for (const p of passes) {
        ctx.lineWidth = p.width;
        ctx.strokeStyle = p.color;
        traceKind(false, p.dx, p.dy);
      }
    }
    if (hasDoors) {
      for (const p of passes) {
        ctx.lineWidth = Math.round(p.width * 0.72);
        ctx.strokeStyle = p.color;
        traceKind(true, p.dx * 0.65, p.dy * 0.65);
      }
    }
    ctx.restore();
  },

  drawGridCanvas(state) {
    const canvas = this.els.gridCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);
    const bounds = this.getActiveMapBounds(state);
    const blend = resolveGridBlendConfig(state.grid, state.theme);
    if (canvas.style) {
      canvas.style.mixBlendMode = blend.mixBlendMode;
    }
    ctx.save();
    clipToActiveMapBounds(ctx, bounds);
    drawGridOverlay(ctx, state.grid, {
      width: 2400,
      height: 1600,
      theme: state.theme,
      dualInk: blend.dualInk,
      darkStroke: blend.darkStroke,
      lightStroke: blend.lightStroke
    });
    ctx.restore();
  },

  drawStrokesCanvas(state) {
    const ctx = this.els.drawCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;

    for (const stroke of state.strokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color || '#ef4444';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  },

  isPointExplored(wx, wy) {
    if (!this.exploredCanvas || !this._exploredHasPixels) return false;
    const ex = Math.max(0, Math.min(EXPLORED_W - 1, Math.round(Number(wx) * EXPLORED_SCALE)));
    const ey = Math.max(0, Math.min(EXPLORED_H - 1, Math.round(Number(wy) * EXPLORED_SCALE)));
    try {
      const ectx = this.getExploredContext();
      if (!ectx) return false;
      if (!this._exploredAlphaCache) {
        const full = ectx.getImageData(0, 0, EXPLORED_W, EXPLORED_H)?.data;
        if (full && full.length >= EXPLORED_W * EXPLORED_H * 4) {
          this._exploredAlphaCache = full;
        }
      }
      if (this._exploredAlphaCache) {
        return this._exploredAlphaCache[(ey * EXPLORED_W + ex) * 4 + 3] > 24;
      }
      const data = ectx.getImageData(ex, ey, 1, 1).data;
      return data[3] > 24;
    } catch (_) {
      return false;
    }
  },

  isDoorVisibleOnBoard(door, state) {
    if (!door || !isWallDoor(door)) return false;
    const useDynamic = Boolean(state?.dynamicLighting);
    const rememberExplored = state?.rememberExplored !== false;
    const visSources = useDynamic && state?.role !== 'gm' ? Selector.getAlliedVisibilityPolygons(state) : [];
    const ambientId = Selector.getActiveAmbientLight(state);
    const lightPolys = useDynamic && state?.role !== 'gm' ? Selector.getActiveLightPolygons(state) : [];
    return isDoorVisibleToSeat(door, {
      role: state?.role || 'gm',
      dynamicLighting: useDynamic,
      visSources,
      isExploredFn: rememberExplored ? (x, y) => this.isPointExplored(x, y) : null,
      ambient: ambientId,
      lightPolys
    });
  },

  _renderDoorIconGlyph(ctx, visualState, isSecret) {
    const isOpen = visualState === 'open';
    const isLocked = visualState === 'locked';

    // Subtle frosted dark medallion for crisp legibility over any map art
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.52)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = isSecret
      ? 'rgba(38, 18, 62, 0.84)'
      : isLocked
        ? 'rgba(42, 24, 10, 0.82)'
        : isOpen
          ? 'rgba(15, 23, 42, 0.56)'
          : 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Hairline ring (white for normal closed, amber for locked, emerald for open, dashed violet for GM secret door)
    ctx.lineWidth = isSecret || isLocked ? 1.5 : 1.3;
    ctx.strokeStyle = isSecret
      ? 'rgba(192, 132, 252, 0.92)'
      : isLocked
        ? 'rgba(251, 191, 36, 0.88)'
        : isOpen
          ? 'rgba(52, 211, 153, 0.85)'
          : 'rgba(255, 255, 255, 0.65)';
    if (isSecret) ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Minimalist white line-art glyph
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.65;
    const lineColor = isSecret ? '#f3e8ff' : isLocked ? '#fef3c7' : '#ffffff';

    if (isLocked) {
      ctx.strokeStyle = lineColor;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, -2.1, 3.0, Math.PI, 0, false);
      ctx.lineTo(3.0, -0.3);
      ctx.moveTo(-3.0, -2.1);
      ctx.lineTo(-3.0, -0.3);
      ctx.stroke();
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-4.8, -0.3, 9.6, 6.6, 1.8);
      } else {
        ctx.rect(-4.8, -0.3, 9.6, 6.6);
      }
      ctx.stroke();
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(0, 3.0, 1.1, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = isOpen ? 0.7 : 0.95;
    ctx.beginPath();
    ctx.moveTo(-6.5, 5.5);
    ctx.lineTo(6.5, 5.5);
    ctx.stroke();

    if (!isOpen) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(-4.5, 5.5);
      ctx.lineTo(-4.5, -5.5);
      ctx.lineTo(4.5, -5.5);
      ctx.lineTo(4.5, 5.5);
      ctx.stroke();
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(2.1, 0.5, 1.15, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-4.5, 5.5);
      ctx.lineTo(-4.5, -5.5);
      ctx.lineTo(4.5, -5.5);
      ctx.lineTo(4.5, 5.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSecret ? '#e9d5ff' : '#ecfdf5';
      ctx.beginPath();
      ctx.moveTo(-4.5, 5.5);
      ctx.lineTo(-4.5, -5.5);
      ctx.lineTo(1.8, -3.2);
      ctx.lineTo(1.8, 7.2);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = isSecret ? '#e9d5ff' : '#a7f3d0';
      ctx.beginPath();
      ctx.arc(-0.2, 1.6, 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  getDoorIconSprite(visualState, isSecret) {
    if (typeof document === 'undefined') return null;
    if (!this._doorIconSprites) this._doorIconSprites = new Map();
    const key = `${visualState}|${isSecret ? 1 : 0}`;
    const cached = this._doorIconSprites.get(key);
    if (cached) return cached;

    const c = document.createElement('canvas');
    c.width = 44;
    c.height = 44;
    const dctx = c.getContext('2d');
    if (dctx) {
      dctx.save();
      dctx.translate(22, 22);
      this._renderDoorIconGlyph(dctx, visualState, isSecret);
      dctx.restore();
    }
    this._doorIconSprites.set(key, c);
    return c;
  },

  drawMinimalistDoorIcon(ctx, door, { role = 'gm' } = {}) {
    if (!ctx || !door) return;
    const mx = (Number(door.x1) + Number(door.x2)) / 2;
    const my = (Number(door.y1) + Number(door.y2)) / 2;
    const isSecret = isWallSecretDoor(door);
    const visualState = resolveDoorVisualState(door, { role });

    const sprite = this.getDoorIconSprite?.(visualState, isSecret);
    if (sprite) {
      ctx.drawImage(sprite, mx - 22, my - 22);
      return;
    }

    ctx.save();
    ctx.translate(mx, my);
    this._renderDoorIconGlyph(ctx, visualState, isSecret);
    ctx.restore();
  },

  getAmbientLightCanvas() {
    if (typeof document === 'undefined') return null;
    if (!this._ambientLightCanvas) {
      this._ambientLightCanvas = document.createElement('canvas');
      this._ambientLightCanvas.width = 1200;
      this._ambientLightCanvas.height = 800;
    }
    return this._ambientLightCanvas;
  },

  getStaticFogCanvas() {
    if (typeof document === 'undefined') return null;
    if (!this._staticFogCanvas) {
      this._staticFogCanvas = document.createElement('canvas');
      this._staticFogCanvas.width = 2400;
      this._staticFogCanvas.height = 1600;
    }
    return this._staticFogCanvas;
  },

  getStaticDarknessCanvas() {
    if (typeof document === 'undefined') return null;
    if (!this._staticDarknessCanvas) {
      this._staticDarknessCanvas = document.createElement('canvas');
      this._staticDarknessCanvas.width = 1200;
      this._staticDarknessCanvas.height = 800;
    }
    return this._staticDarknessCanvas;
  },

  getSoftMaskCanvas() {
    if (typeof document === 'undefined') return null;
    if (!this._softMaskCanvas) {
      const c = document.createElement('canvas');
      c.width = 1200;
      c.height = 800;
      this._softMaskCanvas = c;
    }
    return this._softMaskCanvas;
  },

  _tracePolyPath(ctx, poly) {
    if (!ctx || !Array.isArray(poly) || poly.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    return true;
  },

  _getLightSeed(id) {
    const s = String(id || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return h;
  },

  _syncLightAnimationLoop(state, lightPolys = [], { fromAnimLoop = false } = {}) {
    const hasAnimated =
      !Selector.isNarrativeScene(state) &&
      lightPolys.some((lp) => lp.kind === 'map' && lp.animation && lp.animation !== 'steady');

    if (!hasAnimated) {
      if (this._lightAnimRafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._lightAnimRafId);
      }
      this._lightAnimRafId = null;
      return;
    }

    if (fromAnimLoop || this._lightAnimRafId || typeof requestAnimationFrame !== 'function') return;
    let lastDraw = 0;
    const tick = (now) => {
      this._lightAnimRafId = null;
      const curLights = Selector.getActiveLightPolygons(Service.state);
      const stillActive =
        !Selector.isNarrativeScene(Service.state) &&
        curLights.some((lp) => lp.kind === 'map' && lp.animation && lp.animation !== 'steady');
      if (!stillActive) return;
      const isHidden = typeof document !== 'undefined' && document.hidden;
      const isDraggingToken = Boolean(this.draggingTokenId || Service.activeDragTokenId);
      const minFrameMs = Math.max(62, this.getGraphicsProfile?.()?.lightAnimMinFrameMs || 62);
      if (!isHidden && !isDraggingToken && now - lastDraw >= 62 && now - lastDraw >= minFrameMs) {
        lastDraw = now;
        this.drawFogCanvas(Service.state, now, { fromAnimLoop: true, precomputedLightPolys: curLights });
      }
      this._lightAnimRafId = requestAnimationFrame(tick);
    };
    this._lightAnimRafId = requestAnimationFrame(tick);
  },

  _renderAmbientLightLayer(state, plan, visSources = [], lightPolys = [], nowMs = 0, { fromAnimLoop = false } = {}) {
    const canvas = this.getAmbientLightCanvas();
    if (!canvas) return null;
    const actx = canvas.getContext('2d');
    if (!actx) return null;

    actx.clearRect(0, 0, 1200, 800);

    if (plan.useDarknessMask) {
      const staticDarkness = this.getStaticDarknessCanvas();
      const dctx = staticDarkness?.getContext?.('2d') || null;
      const hasFaulty = lightPolys.some((lp) => lp.animation === 'faulty');
      if (!dctx || !fromAnimLoop || hasFaulty || !this._darknessStaticReady) {
        const fillTarget = dctx || actx;
        if (dctx) dctx.clearRect(0, 0, 1200, 800);
        fillTarget.save();
        fillTarget.scale(0.5, 0.5);
        if (plan.ambientId === 'darkness') {
          const fogOpacity = state.role === 'gm' ? 0.60 : 1;
          const baseFog = this.getFogBaseCanvas(state.theme, fogOpacity);
          if (baseFog) {
            fillTarget.drawImage(baseFog, 0, 0);
          } else {
            fillFogMist(fillTarget, 2400, 1600, { opacity: fogOpacity });
          }
        } else {
          if (plan.darknessAlpha > 0) {
            fillTarget.fillStyle = `rgba(4, 7, 16, ${plan.darknessAlpha})`;
            fillTarget.fillRect(0, 0, 2400, 1600);
          }
          if (plan.meta?.tintColor) {
            fillTarget.fillStyle = plan.meta.tintColor;
            fillTarget.fillRect(0, 0, 2400, 1600);
          }
        }
        fillTarget.restore();

        const softMask = this.getSoftMaskCanvas();
        const mctx = softMask?.getContext?.('2d') || null;
        const targetCtx = mctx || fillTarget;

        if (mctx) {
          mctx.clearRect(0, 0, 1200, 800);
          mctx.save();
          mctx.scale(0.5, 0.5);
        } else {
          fillTarget.save();
          fillTarget.scale(0.5, 0.5);
          fillTarget.globalCompositeOperation = 'destination-out';
        }

        const punchRadial = (x, y, radius, poly, alpha = 1, innerRadius = null) => {
          if (!(radius > 0) || !this._tracePolyPath(targetCtx, poly)) return;
          targetCtx.save();
          targetCtx.globalAlpha = alpha;
          targetCtx.clip();
          const r0 = innerRadius !== null ? Math.max(0, Math.min(radius * 0.92, innerRadius)) : radius * 0.14;
          const grad = targetCtx.createRadialGradient(x, y, r0, x, y, radius);
          grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
          grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.94)');
          grad.addColorStop(0.84, 'rgba(0, 0, 0, 0.45)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          targetCtx.fillStyle = grad;
          targetCtx.beginPath();
          targetCtx.arc(x, y, radius, 0, Math.PI * 2);
          targetCtx.fill();
          targetCtx.restore();
        };

        for (const lp of lightPolys) {
          const sample = computeLightAnimationSample(lp.animation || 'steady', nowMs, this._getLightSeed(lp.id));
          const effR = Math.max(10, lp.radiusPx * sample.radiusScale);
          const punchAlpha = lp.animation === 'faulty' ? Math.min(1, sample.alphaScale) : 1;
          punchRadial(lp.x, lp.y, effR, lp.poly, punchAlpha, lp.occupiedHalfPx || null);
        }

        if ((plan.ambientId === 'darkness' || plan.ambientId === 'night') && visSources.length > 0) {
          for (const src of visSources) {
            if (plan.ambientId === 'darkness' && src.clearRadiusPx > 0) {
              const selfAlpha = src.lightRadiusPx > 0 ? 1 : 0.38;
              punchRadial(src.token.x, src.token.y, src.clearRadiusPx, src.poly, selfAlpha, src.occupiedHalfPx || null);
            } else if (plan.ambientId === 'night' && src.nightDetectRadiusPx > 0) {
              punchRadial(src.token.x, src.token.y, src.nightDetectRadiusPx, src.poly, 0.38, src.occupiedHalfPx || null);
            }
            if (src.darkvisionRadiusPx > 0) {
              punchRadial(
                src.token.x,
                src.token.y,
                src.darkvisionRadiusPx,
                src.poly,
                plan.ambientId === 'darkness' ? 0.72 : 0.45,
                src.occupiedHalfPx || null
              );
            }
          }
        }

        if (mctx) {
          mctx.restore();
          fillTarget.save();
          fillTarget.globalCompositeOperation = 'destination-out';
          fillTarget.filter = 'blur(2.5px)';
          fillTarget.drawImage(softMask, 0, 0, 1200, 800);
          fillTarget.restore();
        } else {
          fillTarget.restore();
        }
        if (dctx) this._darknessStaticReady = true;
      }
      if (dctx) {
        actx.drawImage(staticDarkness, 0, 0, 1200, 800);
      }
    }

    actx.save();
    actx.scale(0.5, 0.5);

    // Colored light glows + bright central luminous hotspot clipped by each light's wall polygon
    for (const lp of lightPolys) {
      if (!(lp.radiusPx > 0) || !this._tracePolyPath(actx, lp.poly)) continue;
      const tone = MAP_LIGHT_TONE_META[lp.tone] || MAP_LIGHT_TONE_META.warm;
      const sample = computeLightAnimationSample(lp.animation || 'steady', nowMs, this._getLightSeed(lp.id));
      const effR = Math.max(10, lp.radiusPx * sample.radiusScale);
      actx.save();
      actx.clip();
      actx.globalAlpha = Math.max(0.15, Math.min(1, sample.alphaScale));
      const grad = actx.createRadialGradient(lp.x, lp.y, effR * 0.04, lp.x, lp.y, effR);
      grad.addColorStop(0, tone.coreRgba);
      grad.addColorStop(0.48, tone.midRgba);
      grad.addColorStop(1, tone.outerRgba);
      actx.fillStyle = grad;
      actx.beginPath();
      actx.arc(lp.x, lp.y, effR, 0, Math.PI * 2);
      actx.fill();

      if (lp.kind === 'map' && tone.hotspotRgba) {
        const hx = lp.x + (sample.coreOffsetX || 0);
        const hy = lp.y + (sample.coreOffsetY || 0);
        const hotR = Math.max(14, Math.min(48, effR * 0.22)) * sample.coreScale;
        const hotGrad = actx.createRadialGradient(hx, hy, 0, hx, hy, hotR);
        hotGrad.addColorStop(0, tone.hotspotRgba);
        hotGrad.addColorStop(0.45, tone.coreRgba);
        hotGrad.addColorStop(1, tone.outerRgba);
        actx.fillStyle = hotGrad;
        actx.beginPath();
        actx.arc(hx, hy, hotR, 0, Math.PI * 2);
        actx.fill();
      }
      actx.restore();
    }

    // Cool moonlit penumbra tint for darkvision in total darkness
    if (plan.ambientId === 'darkness' && visSources.length > 0) {
      for (const src of visSources) {
        if (!src.darkvision || !(src.darkvisionRadiusPx > 0) || !this._tracePolyPath(actx, src.poly)) continue;
        actx.save();
        actx.clip();
        const dvGrad = actx.createRadialGradient(
          src.token.x,
          src.token.y,
          src.darkvisionRadiusPx * 0.1,
          src.token.x,
          src.token.y,
          src.darkvisionRadiusPx
        );
        dvGrad.addColorStop(0, 'rgba(148, 197, 255, 0.08)');
        dvGrad.addColorStop(0.75, 'rgba(100, 149, 237, 0.05)');
        dvGrad.addColorStop(1, 'rgba(100, 149, 237, 0)');
        actx.fillStyle = dvGrad;
        actx.beginPath();
        actx.arc(src.token.x, src.token.y, src.darkvisionRadiusPx, 0, Math.PI * 2);
        actx.fill();
        actx.restore();
      }
    }

    // Subtle silver-blue moonlit halo for Night detection radius and unlit Darkness personal aura
    if ((plan.ambientId === 'night' || plan.ambientId === 'darkness') && visSources.length > 0) {
      for (const src of visSources) {
        const haloRadius =
          plan.ambientId === 'night'
            ? src.nightDetectRadiusPx
            : !(src.lightRadiusPx > 0)
              ? src.clearRadiusPx
              : 0;
        if (!(haloRadius > 0) || !this._tracePolyPath(actx, src.poly)) continue;
        actx.save();
        actx.clip();
        const r0 = Math.max(0, Math.min(haloRadius * 0.9, src.occupiedHalfPx || 0));
        const grad = actx.createRadialGradient(
          src.token.x,
          src.token.y,
          r0,
          src.token.x,
          src.token.y,
          haloRadius
        );
        grad.addColorStop(0, 'rgba(165, 196, 245, 0.09)');
        grad.addColorStop(0.55, 'rgba(148, 179, 235, 0.04)');
        grad.addColorStop(1, 'rgba(148, 179, 235, 0)');
        actx.fillStyle = grad;
        actx.beginPath();
        actx.arc(src.token.x, src.token.y, haloRadius, 0, Math.PI * 2);
        actx.fill();
        actx.restore();
      }
    }

    actx.restore();
    return canvas;
  },

  drawFogCanvas(
    state,
    nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now(),
    { fromAnimLoop = false, precomputedLightPolys = null } = {}
  ) {
    const ctx = this.els.fogCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);

    const useDynamic = Boolean(state.dynamicLighting);
    const rememberExplored = state.rememberExplored !== false;
    const showBlueprint = shouldShowWallBlueprint(state);
    const hasAnyDoors = (state.walls || []).some((w) => w && isWallDoor(w));
    const ambientId = Selector.getActiveAmbientLight(state);
    const lightPolys = Array.isArray(precomputedLightPolys)
      ? precomputedLightPolys
      : Selector.getActiveLightPolygons(state);
    this._syncLightAnimationLoop(state, lightPolys, { fromAnimLoop });
    const plan = resolveCanvasLightingPlan({
      dynamicLighting: useDynamic,
      ambient: ambientId,
      role: state.role,
      hasActiveLights: lightPolys.length > 0,
      showBlueprint,
      hasAnyDoors
    });

    if (!plan.shouldRender) return;

    const bounds = this.getActiveMapBounds(state);
    ctx.save();
    clipToActiveMapBounds(ctx, bounds);

    let visSources = [];
    if (useDynamic) {
      visSources = Selector.getAlliedVisibilityPolygons(state);
      const staticFog = this.getStaticFogCanvas();
      const fctx = staticFog?.getContext?.('2d') || null;
      const fogTarget = fctx || ctx;

      if (!fctx || !fromAnimLoop || !this._fogStaticReady) {
        if (fctx) fctx.clearRect(0, 0, 2400, 1600);

        // 1. Actualizar capa persistente de memoria explorada (omitida en ticks de animación)
        if (!fromAnimLoop && rememberExplored && this.exploredCanvas && visSources.length > 0) {
          const ectx = this.getExploredContext();
          ectx.save();
          ectx.scale(EXPLORED_SCALE, EXPLORED_SCALE);
          ectx.fillStyle = '#ffffff';
          for (const src of visSources) {
            if (!src.poly || src.poly.length < 3) continue;
            const selfRadius = plan.restrictExploredToLit
              ? Math.max(src.clearRadiusPx || 0, src.darkvisionRadiusPx || 0)
              : src.radius;
            if (selfRadius > 0) {
              ectx.save();
              this._tracePolyPath(ectx, src.poly);
              if (src.fullMapSight && !plan.restrictExploredToLit) {
                ectx.fill();
              } else {
                ectx.clip();
                ectx.beginPath();
                ectx.arc(src.token.x, src.token.y, selfRadius * 0.92, 0, Math.PI * 2);
                ectx.fill();
              }
              ectx.restore();
            }
            if (plan.restrictExploredToLit && lightPolys.length > 0) {
              for (const lp of lightPolys) {
                if (!(lp.radiusPx > 0) || !lp.poly || lp.poly.length < 3) continue;
                ectx.save();
                this._tracePolyPath(ectx, src.poly);
                ectx.clip();
                this._tracePolyPath(ectx, lp.poly);
                ectx.clip();
                ectx.beginPath();
                ectx.arc(lp.x, lp.y, lp.radiusPx * 0.92, 0, Math.PI * 2);
                ectx.fill();
                ectx.restore();
              }
            }
          }
          ectx.restore();
          this._exploredHasPixels = true;
          this._exploredAlphaCache = null;
          this.scheduleSaveExploredMask();
        }

        // 2. Cubrir el tablero con niebla de guerra procedural pre-cacheada (60% GM, 100% Jugador)
        const fogOpacity = state.role === 'gm' ? 0.60 : 1;
        const baseFog = this.getFogBaseCanvas(state.theme, fogOpacity);
        if (baseFog) {
          fogTarget.drawImage(baseFog, 0, 0);
        } else {
          fillFogMist(fogTarget, 2400, 1600, { opacity: fogOpacity });
        }

        // 3. Revelar en penumbra las zonas previamente exploradas
        if (rememberExplored && this.exploredCanvas && this._exploredHasPixels) {
          fogTarget.save();
          fogTarget.globalCompositeOperation = 'destination-out';
          fogTarget.globalAlpha = state.role === 'gm' ? 0.36 : 0.26;
          fogTarget.filter = 'blur(4px)';
          fogTarget.drawImage(this.exploredCanvas, 0, 0, 2400, 1600);
          fogTarget.restore();
        }

        // 4. Recortar visión/luz dinámica activa con penumbra suave (offscreen 0.5x + blur)
        if (visSources.length > 0) {
          const softMask = this.getSoftMaskCanvas();
          const mctx = softMask?.getContext?.('2d') || null;
          const cutCtx = mctx || fogTarget;
          if (mctx) {
            mctx.clearRect(0, 0, 1200, 800);
            mctx.save();
            mctx.scale(0.5, 0.5);
          } else {
            fogTarget.save();
            fogTarget.globalCompositeOperation = 'destination-out';
          }
          for (const src of visSources) {
            if (!src.poly || src.poly.length < 3) continue;
            cutCtx.save();
            this._tracePolyPath(cutCtx, src.poly);
            if (src.fullMapSight) {
              cutCtx.fillStyle = '#000000';
              cutCtx.fill();
            } else {
              cutCtx.clip();
              const grad = cutCtx.createRadialGradient(
                src.token.x,
                src.token.y,
                src.radius * 0.18,
                src.token.x,
                src.token.y,
                src.radius
              );
              grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
              grad.addColorStop(0.58, 'rgba(0, 0, 0, 0.99)');
              grad.addColorStop(0.82, 'rgba(0, 0, 0, 0.72)');
              grad.addColorStop(0.94, 'rgba(0, 0, 0, 0.25)');
              grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              cutCtx.fillStyle = grad;
              cutCtx.beginPath();
              cutCtx.arc(src.token.x, src.token.y, src.radius, 0, Math.PI * 2);
              cutCtx.fill();
            }
            cutCtx.restore();
          }
          if (mctx) {
            mctx.restore();
            fogTarget.save();
            fogTarget.globalCompositeOperation = 'destination-out';
            fogTarget.filter = 'blur(6px)';
            fogTarget.drawImage(softMask, 0, 0, 2400, 1600);
            fogTarget.restore();
          } else {
            fogTarget.restore();
          }
        }

        // 4b. Atenuación sutil en 1.er impacto de muros Relieve (0.5x buffer)
        if (visSources.some((s) => Array.isArray(s.innerPoly) && s.innerPoly.length >= 3)) {
          if (!this._reliefShadeCanvas && typeof document !== 'undefined') {
            this._reliefShadeCanvas = document.createElement('canvas');
            this._reliefShadeCanvas.width = 1200;
            this._reliefShadeCanvas.height = 800;
          }
          const rctx = this._reliefShadeCanvas?.getContext?.('2d') || null;
          if (rctx) {
            rctx.clearRect(0, 0, 1200, 800);
            rctx.save();
            rctx.scale(0.5, 0.5);
            rctx.fillStyle = 'rgba(6, 10, 22, 0.28)';
            for (const src of visSources) {
              if (!src.poly || src.poly.length < 3 || !src.innerPoly || src.innerPoly.length < 3) continue;
              this._tracePolyPath(rctx, src.poly);
              rctx.fill();
            }
            rctx.globalCompositeOperation = 'destination-out';
            rctx.fillStyle = '#000000';
            for (const src of visSources) {
              if (!src.innerPoly || src.innerPoly.length < 3) continue;
              this._tracePolyPath(rctx, src.innerPoly);
              rctx.fill();
            }
            rctx.restore();
            fogTarget.save();
            fogTarget.drawImage(this._reliefShadeCanvas, 0, 0, 2400, 1600);
            fogTarget.restore();
          }
        }
        if (fctx) this._fogStaticReady = true;
      }

      if (fctx) {
        ctx.drawImage(staticFog, 0, 0, 2400, 1600);
      }

      // 5. Luz ambiental + luces fijas/de token compuestas DETRÁS de la niebla (anti-spoiler Luz ∩ LoS)
      if (plan.useDarknessMask || lightPolys.length > 0) {
        const ambientCanvas = this._renderAmbientLightLayer(state, plan, visSources, lightPolys, nowMs, {
          fromAnimLoop
        });
        if (ambientCanvas) {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.drawImage(ambientCanvas, 0, 0, 2400, 1600);
          ctx.restore();
        }
      }
    } else if (plan.useDarknessMask || lightPolys.length > 0) {
      const ambientCanvas = this._renderAmbientLightLayer(state, plan, [], lightPolys, nowMs, { fromAnimLoop });
      if (ambientCanvas) {
        ctx.drawImage(ambientCanvas, 0, 0, 2400, 1600);
      }
    }

    // 6. Plano técnico de muros (visible en Escenografía; atenuado en Luces o filtro solo Luces)
    if (showBlueprint) {
      ctx.save();
      if (state.stageLayer === 'lights' || (state.stageLayer === 'select' && state.stageSelectFilter === 'lights')) {
        ctx.globalAlpha = 0.42;
      }
      for (const w of state.walls || []) {
        if (!w) continue;
        ctx.save();
        ctx.lineCap = 'round';
        const kind = normalizeWallKind(w.kind);
        if (isWallDoor(w)) {
          const isSecret = isWallSecretDoor(w);
          ctx.strokeStyle = w.open ? '#10b981' : (isSecret ? '#a855f7' : '#f59e0b');
          ctx.lineWidth = 5;
          if (w.open) ctx.setLineDash([8, 8]);
          else if (isSecret) ctx.setLineDash([6, 4]);
          else if (kind === 'invisible') ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(w.x1, w.y1);
          ctx.lineTo(w.x2, w.y2);
          ctx.stroke();
        } else if (kind === 'terrain') {
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(w.x1, w.y1);
          ctx.lineTo(w.x2, w.y2);
          ctx.stroke();
        } else if (kind === 'invisible') {
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.moveTo(w.x1, w.y1);
          ctx.lineTo(w.x2, w.y2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(w.x1, w.y1);
          ctx.lineTo(w.x2, w.y2);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    }

    const isExploredFn = rememberExplored ? (x, y) => this.isPointExplored(x, y) : null;
    for (const w of state.walls || []) {
      if (!w || !isWallDoor(w)) continue;
      if (
        !isDoorVisibleToSeat(w, {
          role: state.role,
          dynamicLighting: useDynamic,
          visSources,
          isExploredFn,
          ambient: ambientId,
          lightPolys
        })
      ) {
        continue;
      }
      this.drawMinimalistDoorIcon(ctx, w, { role: state.role });
    }
    ctx.restore();
  },

  renderVectorOverlay(state) {
    const parts = [];
    const grid = normalizeGridConfig(state.grid);
    const visionCfg = Selector.getSystemVisionConfig(state);
    if (state.tokenSelectBox) {
      const rx = Math.min(state.tokenSelectBox.x1, state.tokenSelectBox.x2);
      const ry = Math.min(state.tokenSelectBox.y1, state.tokenSelectBox.y2);
      const rw = Math.abs(state.tokenSelectBox.x2 - state.tokenSelectBox.x1);
      const rh = Math.abs(state.tokenSelectBox.y2 - state.tokenSelectBox.y1);
      parts.push(`
        <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="5" fill="rgba(139, 92, 246, 0.14)" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6 4" />
      `);
    }
    if (state.tool === 'wall') {
      const selIds = new Set(Array.isArray(state.selectedWallIds) ? state.selectedWallIds : []);
      if (selIds.size > 0 && Array.isArray(state.walls)) {
        for (const w of state.walls) {
          if (!w || !selIds.has(w.id)) continue;
          parts.push(`
            <line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="#a78bfa" stroke-width="10" stroke-linecap="round" opacity="0.45" />
            <line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.95" />
            <circle cx="${w.x1}" cy="${w.y1}" r="5" fill="#8b5cf6" stroke="#ffffff" stroke-width="1.8" />
            <circle cx="${w.x2}" cy="${w.y2}" r="5" fill="#8b5cf6" stroke="#ffffff" stroke-width="1.8" />
          `);
        }
      }
      if (state.wallMode === 'select') {
        if (state.wallSelectBox) {
          const rx = Math.min(state.wallSelectBox.x1, state.wallSelectBox.x2);
          const ry = Math.min(state.wallSelectBox.y1, state.wallSelectBox.y2);
          const rw = Math.abs(state.wallSelectBox.x2 - state.wallSelectBox.x1);
          const rh = Math.abs(state.wallSelectBox.y2 - state.wallSelectBox.y1);
          parts.push(`
            <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="4" fill="rgba(139, 92, 246, 0.14)" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6 4" />
          `);
        } else {
          const hoverHit = findWallNearPoint(state.walls, this.hoverWorldPos.x, this.hoverWorldPos.y, 18);
          if (hoverHit && !selIds.has(hoverHit.id)) {
            parts.push(`
              <line x1="${hoverHit.x1}" y1="${hoverHit.y1}" x2="${hoverHit.x2}" y2="${hoverHit.y2}" stroke="#c4b5fd" stroke-width="7" stroke-linecap="round" opacity="0.55" />
            `);
          }
        }
      } else if (state.wallMode === 'door') {
        const allDoors = (state.walls || []).filter((w) => w && isWallDoor(w));
        for (const d of allDoors) {
          const dColor = isWallSecretDoor(d) ? '#a855f7' : '#f59e0b';
          parts.push(`
            <circle cx="${d.x1}" cy="${d.y1}" r="4.5" fill="#ffffff" stroke="${dColor}" stroke-width="2" />
            <circle cx="${d.x2}" cy="${d.y2}" r="4.5" fill="#ffffff" stroke="${dColor}" stroke-width="2" />
          `);
        }

        const renderDoorMetricPill = (x1, y1, x2, y2, color) => {
          const wPx = Math.hypot(x2 - x1, y2 - y1);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const cells = Math.round((wPx / Math.max(20, grid.cellSize)) * 10) / 10;
          const widthLabel =
            grid.type === 'none'
              ? formatDistance(cells * grid.metersPerUnit, visionCfg.distanceUnit)
              : cells === 1
                ? '1 casilla'
                : `${cells} casillas`;
          return `
            <rect x="${mx - 44}" y="${my - 32}" width="88" height="20" rx="10" fill="#0f172a" stroke="${color}" stroke-width="1.5" />
            <text x="${mx}" y="${my - 18}" fill="#ffffff" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700" text-anchor="middle">${widthLabel}</text>
          `;
        };

        const editPrev = this.doorEditPreview;
        const editDoor = editPrev ? allDoors.find((w) => w.id === editPrev.wallId) : null;
        if (editDoor) {
          const dColor = isWallSecretDoor(editDoor) ? '#a855f7' : '#f59e0b';
          parts.push(`
            <line x1="${editDoor.x1}" y1="${editDoor.y1}" x2="${editDoor.x2}" y2="${editDoor.y2}" stroke="${dColor}" stroke-width="11" stroke-linecap="round" opacity="0.35" />
            <circle cx="${editDoor.x1}" cy="${editDoor.y1}" r="6" fill="#ffffff" stroke="${dColor}" stroke-width="2.5" />
            <circle cx="${editDoor.x2}" cy="${editDoor.y2}" r="6" fill="#ffffff" stroke="${dColor}" stroke-width="2.5" />
            ${renderDoorMetricPill(editDoor.x1, editDoor.y1, editDoor.x2, editDoor.y2, dColor)}
          `);
        } else {
          const preview = this.doorStampPreview;
          const epHover = !preview ? findWallEndpointNearPoint(allDoors, this.hoverWorldPos.x, this.hoverWorldPos.y, 14) : null;
          if (epHover) {
            const hd = epHover.wall;
            const dColor = isWallSecretDoor(hd) ? '#a855f7' : '#f59e0b';
            parts.push(`
              <line x1="${hd.x1}" y1="${hd.y1}" x2="${hd.x2}" y2="${hd.y2}" stroke="${dColor}" stroke-width="10" stroke-linecap="round" opacity="0.3" />
              <circle cx="${epHover.x}" cy="${epHover.y}" r="7" fill="#ffffff" stroke="${dColor}" stroke-width="2.5" />
              <circle cx="${epHover.x}" cy="${epHover.y}" r="11" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.85" />
              ${renderDoorMetricPill(hd.x1, hd.y1, hd.x2, hd.y2, dColor)}
            `);
          } else {
            const hoverHit = preview
              ? (state.walls || []).find((w) => w && w.id === preview.wallId)
              : findWallNearPoint(state.walls, this.hoverWorldPos.x, this.hoverWorldPos.y, 20);
            if (hoverHit && !preview && isWallDoor(hoverHit)) {
              const dColor = isWallSecretDoor(hoverHit) ? '#a855f7' : '#f59e0b';
              parts.push(`
                <line x1="${hoverHit.x1}" y1="${hoverHit.y1}" x2="${hoverHit.x2}" y2="${hoverHit.y2}" stroke="${dColor}" stroke-width="10" stroke-linecap="round" opacity="0.32" />
                <circle cx="${hoverHit.x1}" cy="${hoverHit.y1}" r="5.5" fill="#ffffff" stroke="${dColor}" stroke-width="2.2" />
                <circle cx="${hoverHit.x2}" cy="${hoverHit.y2}" r="5.5" fill="#ffffff" stroke="${dColor}" stroke-width="2.2" />
                ${renderDoorMetricPill(hoverHit.x1, hoverHit.y1, hoverHit.x2, hoverHit.y2, dColor)}
              `);
            } else if (hoverHit && !isWallDoor(hoverHit)) {
              const anchor = preview ? preview.anchorWorld : this.hoverWorldPos;
              const current = preview && preview.dragged ? preview.currentWorld : null;
              const placement = computeDoorPlacementOnWall(hoverHit, anchor, current, {
                cellSize: grid.cellSize,
                snap: grid.snap && grid.type !== 'none',
                freehand: Boolean(this.wallFreehand)
              });
              if (placement) {
                const isSecret = state.wallDoorStampMode === 'secret';
                const doorColor = isSecret ? '#a855f7' : '#f59e0b';
                parts.push(`
                  <line x1="${placement.x1}" y1="${placement.y1}" x2="${placement.x2}" y2="${placement.y2}" stroke="${doorColor}" stroke-width="11" stroke-linecap="round" opacity="0.32" />
                  <line x1="${placement.x1}" y1="${placement.y1}" x2="${placement.x2}" y2="${placement.y2}" stroke="${doorColor}" stroke-width="5" stroke-linecap="round" />
                  <circle cx="${placement.x1}" cy="${placement.y1}" r="5" fill="#ffffff" stroke="${doorColor}" stroke-width="2" />
                  <circle cx="${placement.x2}" cy="${placement.y2}" r="5" fill="#ffffff" stroke="${doorColor}" stroke-width="2" />
                  ${renderDoorMetricPill(placement.x1, placement.y1, placement.x2, placement.y2, doorColor)}
                `);
              }
            }
          }
        }
      } else {
        const pt = resolveWallDrawPoint(this.hoverWorldPos.x, this.hoverWorldPos.y, {
          grid,
          walls: state.walls,
          freehand: Boolean(this.wallFreehand)
        });
        const drawKind = normalizeWallKind(state.wallDrawKind || 'wall');
        const drawDoor = getWallDoorMode({ door: state.wallDrawDoor });
        const kindColors = {
          wall: '#38bdf8',
          terrain: '#34d399',
          invisible: '#22d3ee'
        };
        const doorColors = {
          normal: '#f59e0b',
          secret: '#a855f7'
        };
        const color = doorColors[drawDoor] || kindColors[drawKind] || '#38bdf8';
        if (state.wallAnchor) {
          parts.push(`
            <line x1="${state.wallAnchor.x}" y1="${state.wallAnchor.y}" x2="${pt.x}" y2="${pt.y}" stroke="${color}" stroke-width="5" stroke-dasharray="6 4" />
            <circle cx="${state.wallAnchor.x}" cy="${state.wallAnchor.y}" r="6" fill="${color}" />
          `);
        }
        parts.push(`<circle cx="${pt.x}" cy="${pt.y}" r="${pt.snappedTo === 'vertex' ? 7 : 5}" fill="${color}" />`);
        if (pt.snappedTo === 'vertex') {
          parts.push(`<circle cx="${pt.x}" cy="${pt.y}" r="12" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.9" />`);
        }
      }
    }
    if (state.ruler) {
      const { x1, y1, x2, y2 } = state.ruler;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const cells = measureGridDistance(grid, x1, y1, x2, y2);
      const distLabel = formatDistance(cells * grid.metersPerUnit, visionCfg.distanceUnit);
      const shape = state.rulerShape || 'line';
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;

      if (shape === 'circle') {
        parts.push(`
          <circle cx="${x1}" cy="${y1}" r="${dist}" fill="rgba(245, 158, 11, 0.16)" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6 4" />
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4 4" />
        `);
      } else if (shape === 'cone') {
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const half = 0.46; // ~53 deg D&D cone
        const ax = x1 + Math.cos(ang - half) * dist;
        const ay = y1 + Math.sin(ang - half) * dist;
        const bx = x1 + Math.cos(ang + half) * dist;
        const by = y1 + Math.sin(ang + half) * dist;
        parts.push(`
          <polygon points="${x1},${y1} ${ax},${ay} ${bx},${by}" fill="rgba(245, 158, 11, 0.18)" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round" />
        `);
      } else if (shape === 'cube') {
        const isAreaCentered = state.tool === 'areaSelect' && state.areaSelectConfig;
        const side = isAreaCentered
          ? Math.max(grid.cellSize * 0.5, state.areaSelectConfig.radiusPx || dist)
          : Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        const rx = isAreaCentered ? x1 - side / 2 : x2 >= x1 ? x1 : x1 - side;
        const ry = isAreaCentered ? y1 - side / 2 : y2 >= y1 ? y1 : y1 - side;
        const labelX = isAreaCentered ? x1 : mx;
        const labelY = isAreaCentered ? ry - 6 : my;
        const sideCells = Math.round((side / grid.cellSize) * 10) / 10;
        const sideDist = formatDistance(sideCells * grid.metersPerUnit, visionCfg.distanceUnit);
        const cubeText = grid.type === 'none' ? sideDist : `${sideCells}×${sideCells} cas`;
        parts.push(`
          <rect x="${rx}" y="${ry}" width="${side}" height="${side}" fill="rgba(245, 158, 11, 0.16)" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6 4" />
          ${isAreaCentered ? `<circle cx="${x1}" cy="${y1}" r="5" fill="#f59e0b" />` : ''}
          <rect x="${labelX - 62}" y="${labelY - 26}" width="124" height="22" rx="11" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
          <text x="${labelX}" y="${labelY - 11}" fill="#ffffff" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" text-anchor="middle">${cubeText}</text>
        `);
      } else {
        if (state.tool === 'areaSelect' && state.areaSelectConfig && dist > 1) {
          const halfW = (grid.cellSize || 80) * 0.5;
          const nx = -(y2 - y1) / dist;
          const ny = (x2 - x1) / dist;
          const p1x = x1 + nx * halfW, p1y = y1 + ny * halfW;
          const p2x = x2 + nx * halfW, p2y = y2 + ny * halfW;
          const p3x = x2 - nx * halfW, p3y = y2 - ny * halfW;
          const p4x = x1 - nx * halfW, p4y = y1 - ny * halfW;
          parts.push(`
            <polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}" fill="rgba(245, 158, 11, 0.16)" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round" />
          `);
        }
        parts.push(`
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f59e0b" stroke-width="4" stroke-dasharray="8 6" />
        `);
      }

      if (shape !== 'cube') {
        const lineText = grid.type === 'none' ? distLabel : `${cells} cas · ${distLabel}`;
        parts.push(`
          <circle cx="${x1}" cy="${y1}" r="6" fill="#f59e0b" />
          <circle cx="${x2}" cy="${y2}" r="6" fill="#f59e0b" />
          <rect x="${mx - 58}" y="${my - 26}" width="116" height="22" rx="11" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
          <text x="${mx}" y="${my - 11}" fill="#ffffff" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" text-anchor="middle">${lineText}</text>
        `);
      }
    }
    for (const p of state.pings) {
      parts.push(`
        <circle cx="${p.x}" cy="${p.y}" r="38" fill="none" stroke="${p.color}" stroke-width="4">
          <animate attributeName="r" from="8" to="68" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
        </circle>
      `);
    }
    const html = parts.join('');
    if (this._lastVectorOverlayHtml === html) return;
    this._lastVectorOverlayHtml = html;
    this.els.overlayVectorSvg.innerHTML = html;
  },

  /**
   * Captures the current tabletop viewport (without HUD/menus/drawers) scaled to ~1/4
   * of viewport area in WebP format, preserving dynamic fog so players cannot see hidden rooms.
   */
  captureTableSnapshotDataUrl() {
    const state = Service.state;
    const stage = this.els.vttStage;
    const rect = stage?.getBoundingClientRect?.() || { width: window.innerWidth || 1280, height: window.innerHeight || 720 };
    const vw = Math.max(1, rect.width || window.innerWidth || 1280);
    const vh = Math.max(1, rect.height || window.innerHeight || 720);
    const { width: outW, height: outH } = Selector.computeQuarterViewportDimensions(vw, vh);

    const renderComposite = (allowExternalImgs) => {
      const out = document.createElement('canvas');
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext('2d');
      if (!ctx) return '';

      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas')?.trim() || '#0b1220';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, outW, outH);

      const cam = state.camera || { x: 0, y: 0, zoom: 1 };
      const sx = outW / vw;
      const sy = outH / vh;
      ctx.save();
      ctx.scale(sx, sy);
      ctx.translate(Number(cam.x) || 0, Number(cam.y) || 0);
      ctx.scale(Number(cam.zoom) || 1, Number(cam.zoom) || 1);

      const customImg = this.els.customMapImg;
      const hasCustomMap = state.mapId === 'custom' && customImg && !customImg.classList.contains('hidden') && customImg.complete && customImg.naturalWidth > 0;
      const isDataUrl = (u) => String(u || '').startsWith('data:');
      if (hasCustomMap && (allowExternalImgs || isDataUrl(customImg.src))) {
        const mb = this.getActiveMapBounds(state);
        ctx.drawImage(customImg, mb.x, mb.y, mb.width, mb.height);
      } else if (this.els.mapCanvas) {
        ctx.drawImage(this.els.mapCanvas, 0, 0, 2400, 1600);
      }
      if (this.els.wallShadowCanvas) ctx.drawImage(this.els.wallShadowCanvas, 0, 0, 2400, 1600);
      if (this.els.gridCanvas) ctx.drawImage(this.els.gridCanvas, 0, 0, 2400, 1600);
      if (this.els.drawCanvas) ctx.drawImage(this.els.drawCanvas, 0, 0, 2400, 1600);

      if (shouldShowWallBlueprint(state)) {
        for (const w of state.walls || []) {
          const isDoor = isWallDoor(w);
          const isSecret = isWallSecretDoor(w);
          ctx.save();
          ctx.strokeStyle = isDoor ? (w.open ? '#10b981' : (isSecret ? '#a855f7' : '#f59e0b')) : '#38bdf8';
          ctx.lineWidth = isDoor ? 5 : 4;
          ctx.lineCap = 'round';
          if (isDoor && w.open) ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(w.x1, w.y1);
          ctx.lineTo(w.x2, w.y2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const cs = state.grid?.cellSize || 60;
      const visibleTokens = Selector.getVisibleTokensForSeat(state);
      for (const tok of visibleTokens) {
        const radius = (cs * (tok.size || 1) * 0.84) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(tok.x, tok.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = tok.color || '#8b5cf6';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = tok.isAlly !== false ? '#f8fafc' : '#f43f5e';
        ctx.stroke();

        const domImg = this.els.tokensLayer?.querySelector(`[data-token-id="${CSS.escape(tok.id)}"] img`);
        if (domImg && domImg.complete && domImg.naturalWidth > 0 && (allowExternalImgs || isDataUrl(domImg.src))) {
          ctx.clip();
          ctx.drawImage(domImg, tok.x - radius, tok.y - radius, radius * 2, radius * 2);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.max(11, Math.round(radius * 0.72))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(tok.name || '?').slice(0, 2).toUpperCase(), tok.x, tok.y);
        }
        ctx.restore();
      }

      if (state.dynamicLighting && this.els.fogCanvas) {
        ctx.drawImage(this.els.fogCanvas, 0, 0, 2400, 1600);
      }

      ctx.restore();
      return out.toDataURL('image/webp', 0.8);
    };

    try {
      return renderComposite(true);
    } catch (_) {
      try {
        return renderComposite(false);
      } catch (_err) {
        return '';
      }
    }
  }
};
