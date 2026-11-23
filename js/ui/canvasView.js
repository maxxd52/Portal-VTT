import { Selector } from '../core/selector.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';
import { fillFogMist } from '../utils/fogShader.js?v=20261123a7';
import { drawGridOverlay, measureGridDistance, normalizeGridConfig } from '../utils/gridGeometry.js?v=20261123a7';
import { formatDistance } from '../utils/lightingModel.js?v=20261123a7';
import {
  createWeatherSimulation,
  drawWeatherSimulation,
  normalizeWeatherType,
  stepWeatherSimulation
} from '../utils/weatherEngine.js?v=20261123a7';
import {
  buildWallShadowCacheKey,
  collectWallShadowSegments,
  computeActiveMapBounds,
  getLightingTemperaturePalette,
  getSurfaceGrainDataUrl,
  resolveGridBlendConfig
} from '../utils/tabletopMaterial.js?v=20261123a7';
import {
  findWallNearPoint,
  isDoorKind,
  isDoorVisibleToSeat,
  resolveDoorVisualState,
  resolveWallDrawPoint,
  shouldShowWallBlueprint
} from '../utils/wallGeometry.js?v=20261123a7';

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

export function drawPresetMapBackground(ctx, mapId) {
  ctx.clearRect(0, 0, 2400, 1600);
  if (mapId === 'empty') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 2400, 1600);
    return;
  }
  if (mapId === 'forest') {
    ctx.fillStyle = '#1e3528';
    ctx.fillRect(0, 0, 2400, 1600);
    ctx.fillStyle = '#5c4938';
    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.quadraticCurveTo(1100, 420, 2400, 740);
    ctx.lineTo(2400, 920);
    ctx.quadraticCurveTo(1100, 620, 0, 700);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#15281e';
    for (let i = 0; i < 24; i++) {
      const x = ((i * 213) % 2300) + 60;
      const y = ((i * 317) % 1400) + 80;
      if (y > 440 && y < 940) continue;
      ctx.beginPath();
      ctx.arc(x, y, 54, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (mapId === 'tavern') {
    ctx.fillStyle = '#3b281c';
    ctx.fillRect(0, 0, 2400, 1600);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 1600; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2400, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#654321';
    ctx.fillRect(240, 240, 560, 110);
    for (let mx = 400; mx <= 1600; mx += 400) {
      for (let my = 560; my <= 1120; my += 360) {
        ctx.beginPath();
        ctx.arc(mx, my, 75, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  if (mapId === 'crypt') {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 2400, 1600);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(200, 200, 2000, 1200);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 10;
    ctx.strokeRect(200, 200, 2000, 1200);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(1080, 720, 240, 160);
    for (const sx of [440, 1800]) {
      for (const sy of [360, 1080]) {
        ctx.fillRect(sx, sy, 140, 80);
      }
    }
    return;
  }
  if (mapId === 'arena') {
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, 2400, 1600);
    ctx.fillStyle = '#785a3a';
    ctx.beginPath();
    ctx.arc(1200, 800, 680, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.fillStyle = '#57534e';
    for (const [px, py] of [[920, 560], [1480, 560], [920, 1040], [1480, 1040]]) {
      ctx.beginPath();
      ctx.arc(px, py, 44, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (mapId === 'cavern') {
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, 2400, 1600);
    ctx.fillStyle = '#164e63';
    ctx.beginPath();
    ctx.moveTo(0, 960);
    ctx.bezierCurveTo(600, 740, 1400, 1180, 2400, 840);
    ctx.lineTo(2400, 1060);
    ctx.bezierCurveTo(1400, 1380, 600, 940, 0, 1140);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2d333b';
    for (const [rx, ry, rr] of [[420, 380, 95], [1640, 420, 110], [880, 1260, 90], [1920, 1240, 105]]) {
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // Default: SRD Bastión Subterráneo
  ctx.fillStyle = '#1a202c';
  ctx.fillRect(0, 0, 2400, 1600);
  ctx.fillStyle = '#262f40';
  ctx.fillRect(160, 160, 2080, 1280);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 14;
  ctx.strokeRect(160, 160, 2080, 1280);
  ctx.fillStyle = '#0f172a';
  for (let cx = 480; cx <= 1920; cx += 480) {
    for (let cy = 400; cy <= 1200; cy += 400) {
      ctx.fillRect(cx - 32, cy - 32, 64, 64);
    }
  }
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
    if (sameScene && (!mask || this._exploredHasPixels)) return;

    if (!sameScene) {
      if (this._saveExploredTimer) {
        clearTimeout(this._saveExploredTimer);
        this._saveExploredTimer = null;
      }
      this.getExploredContext()?.clearRect(0, 0, EXPLORED_W, EXPLORED_H);
      this._exploredHasPixels = false;
      this._loadedExploredKey = key;
      this._loadedExploredRev = rev;
    }

    const seq = (this._exploredLoadSeq = (this._exploredLoadSeq || 0) + 1);
    if (mask && (mask.startsWith('data:image/') || mask.startsWith('blob:'))) {
      const img = new Image();
      img.onload = () => {
        if (seq !== this._exploredLoadSeq || !this.exploredCanvas) return;
        const ectx = this.getExploredContext();
        ectx.drawImage(img, 0, 0, EXPLORED_W, EXPLORED_H);
        this._exploredHasPixels = true;
        this.drawFogCanvas(Service.state);
      };
      img.src = mask;
    }
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

  syncWeatherOverlay(state) {
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

    const w = Math.max(320, window.innerWidth || 1280);
    const h = Math.max(240, window.innerHeight || 800);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this._weatherDpr = dpr;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    canvas.classList.remove('hidden');

    const simKey = `${weather}|${mode}|${w}x${h}`;
    if (this._weatherSimKey !== simKey || !this._weatherSim) {
      this._weatherSimKey = simKey;
      this._weatherSim = createWeatherSimulation({ weather, mode, width: w, height: h });
    }

    if (!this._weatherRafId) {
      let lastTs = performance.now();
      const tick = (now) => {
        if (!this._weatherSim) {
          this._weatherRafId = 0;
          return;
        }
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
        lastTs = now;
        if (!document.hidden) {
          stepWeatherSimulation(this._weatherSim, dt);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const curDpr = this._weatherDpr || 1;
            ctx.save();
            ctx.setTransform(curDpr, 0, 0, curDpr, 0, 0);
            drawWeatherSimulation(ctx, this._weatherSim);
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
    const ambientDir = this._currentAtmosphere?.boardShadowDir || { x: -0.28, y: 0.36 };
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
      const data = ectx.getImageData(ex, ey, 1, 1).data;
      return data[3] > 24;
    } catch (_) {
      return false;
    }
  },

  isDoorVisibleOnBoard(door, state) {
    if (!door || !isDoorKind(door.kind)) return false;
    const useDynamic = Boolean(state?.dynamicLighting);
    const rememberExplored = state?.rememberExplored !== false;
    const visSources = useDynamic && state?.role !== 'gm' ? Selector.getAlliedVisibilityPolygons(state) : [];
    return isDoorVisibleToSeat(door, {
      role: state?.role || 'gm',
      dynamicLighting: useDynamic,
      visSources,
      isExploredFn: rememberExplored ? (x, y) => this.isPointExplored(x, y) : null
    });
  },

  drawMinimalistDoorIcon(ctx, door, { role = 'gm' } = {}) {
    if (!ctx || !door) return;
    const mx = (Number(door.x1) + Number(door.x2)) / 2;
    const my = (Number(door.y1) + Number(door.y2)) / 2;
    const isSecret = door.kind === 'secret';
    const visualState = resolveDoorVisualState(door, { role });
    const isOpen = visualState === 'open';
    const isLocked = visualState === 'locked';

    ctx.save();
    ctx.translate(mx, my);

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
      // Minimalist white padlock line icon
      ctx.strokeStyle = lineColor;
      ctx.globalAlpha = 1;
      // Shackle arch
      ctx.beginPath();
      ctx.arc(0, -2.1, 3.0, Math.PI, 0, false);
      ctx.lineTo(3.0, -0.3);
      ctx.moveTo(-3.0, -2.1);
      ctx.lineTo(-3.0, -0.3);
      ctx.stroke();
      // Lock body
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-4.8, -0.3, 9.6, 6.6, 1.8);
      } else {
        ctx.rect(-4.8, -0.3, 9.6, 6.6);
      }
      ctx.stroke();
      // Keyhole dot
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(0, 3.0, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Threshold base line
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = isOpen ? 0.7 : 0.95;
    ctx.beginPath();
    ctx.moveTo(-6.5, 5.5);
    ctx.lineTo(6.5, 5.5);
    ctx.stroke();

    if (!isOpen) {
      // Closed door panel
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(-4.5, 5.5);
      ctx.lineTo(-4.5, -5.5);
      ctx.lineTo(4.5, -5.5);
      ctx.lineTo(4.5, 5.5);
      ctx.stroke();

      // Minimalist handle dot
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(2.1, 0.5, 1.15, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Open doorway frame (receded)
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-4.5, 5.5);
      ctx.lineTo(-4.5, -5.5);
      ctx.lineTo(4.5, -5.5);
      ctx.lineTo(4.5, 5.5);
      ctx.stroke();

      // Swung-open door leaf
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSecret ? '#e9d5ff' : '#ecfdf5';
      ctx.beginPath();
      ctx.moveTo(-4.5, 5.5);
      ctx.lineTo(-4.5, -5.5);
      ctx.lineTo(1.8, -3.2);
      ctx.lineTo(1.8, 7.2);
      ctx.closePath();
      ctx.stroke();

      // Handle dot on swung leaf
      ctx.fillStyle = isSecret ? '#e9d5ff' : '#a7f3d0';
      ctx.beginPath();
      ctx.arc(-0.2, 1.6, 1.05, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  drawFogCanvas(state) {
    const ctx = this.els.fogCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);

    const useDynamic = Boolean(state.dynamicLighting);
    const rememberExplored = state.rememberExplored !== false;
    const showBlueprint = shouldShowWallBlueprint(state);
    const hasAnyDoors = (state.walls || []).some((w) => w && isDoorKind(w.kind));

    if (!useDynamic && !showBlueprint && !hasAnyDoors) return;

    const bounds = this.getActiveMapBounds(state);
    ctx.save();
    clipToActiveMapBounds(ctx, bounds);

    let visSources = [];
    if (useDynamic) {
      visSources = Selector.getAlliedVisibilityPolygons(state);

      // 1. Actualizar capa persistente de memoria explorada
      if (rememberExplored && this.exploredCanvas && visSources.length > 0) {
        const ectx = this.getExploredContext();
        ectx.save();
        ectx.scale(EXPLORED_SCALE, EXPLORED_SCALE);
        ectx.fillStyle = '#ffffff';
        for (const src of visSources) {
          if (!src.poly || src.poly.length < 3) continue;
          ectx.save();
          ectx.beginPath();
          ectx.moveTo(src.poly[0].x, src.poly[0].y);
          for (let i = 1; i < src.poly.length; i++) {
            ectx.lineTo(src.poly[i].x, src.poly[i].y);
          }
          ectx.closePath();
          ectx.clip();
          ectx.beginPath();
          ectx.arc(src.token.x, src.token.y, src.radius * 0.92, 0, Math.PI * 2);
          ectx.fill();
          ectx.restore();
        }
        ectx.restore();
        this._exploredHasPixels = true;
        this.scheduleSaveExploredMask();
      }

      // 2. Cubrir el tablero con niebla de guerra procedural pre-cacheada (60% GM, 100% Jugador)
      const fogOpacity = state.role === 'gm' ? 0.60 : 1;
      const tempPalette = getLightingTemperaturePalette(state.theme);
      const baseFog = this.getFogBaseCanvas(state.theme, fogOpacity);
      if (baseFog) {
        ctx.drawImage(baseFog, 0, 0);
      } else {
        fillFogMist(ctx, 2400, 1600, { opacity: fogOpacity });
      }

      // 3. Revelar en penumbra las zonas previamente exploradas
      if (rememberExplored && this.exploredCanvas && this._exploredHasPixels) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = state.role === 'gm' ? 0.36 : 0.26;
        ctx.drawImage(this.exploredCanvas, 0, 0, 2400, 1600);
        ctx.restore();
      }

      // 4. Recortar visión/luz dinámica activa con degradado circular suave
      if (visSources.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        for (const src of visSources) {
          if (!src.poly || src.poly.length < 3) continue;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(src.poly[0].x, src.poly[0].y);
          for (let i = 1; i < src.poly.length; i++) {
            ctx.lineTo(src.poly[i].x, src.poly[i].y);
          }
          ctx.closePath();
          ctx.clip();

          const grad = ctx.createRadialGradient(
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
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(src.token.x, src.token.y, src.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();

        // 5. Temperatura cálida de antorchas/linternas recortada estrictamente por muros
        for (const src of visSources) {
          if (!(src.lightRadiusPx > 0) || !src.poly || src.poly.length < 3) continue;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(src.poly[0].x, src.poly[0].y);
          for (let i = 1; i < src.poly.length; i++) {
            ctx.lineTo(src.poly[i].x, src.poly[i].y);
          }
          ctx.closePath();
          ctx.clip();
          const lr = Math.min(src.radius, src.lightRadiusPx);
          const warm = ctx.createRadialGradient(src.token.x, src.token.y, lr * 0.06, src.token.x, src.token.y, lr);
          for (const stop of tempPalette.warmStops) {
            warm.addColorStop(stop.offset, stop.color);
          }
          ctx.fillStyle = warm;
          ctx.beginPath();
          ctx.arc(src.token.x, src.token.y, lr, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 6. Plano técnico de muros (solo cuando el DJ edita muros [W]) + iconos minimalistas de puerta
    if (showBlueprint) {
      for (const w of state.walls || []) {
        if (!w) continue;
        ctx.save();
        ctx.lineCap = 'round';
        if (w.kind === 'door' || w.kind === 'secret') {
          const isSecret = w.kind === 'secret';
          ctx.strokeStyle = w.open ? '#10b981' : (isSecret ? '#a855f7' : '#f59e0b');
          ctx.lineWidth = 5;
          if (w.open) ctx.setLineDash([8, 8]);
          else if (isSecret) ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(w.x1, w.y1);
          ctx.lineTo(w.x2, w.y2);
          ctx.stroke();
        } else if (w.kind === 'terrain') {
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(w.x1, w.y1);
          ctx.lineTo(w.x2, w.y2);
          ctx.stroke();
        } else if (w.kind === 'invisible') {
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
    }

    const isExploredFn = rememberExplored ? (x, y) => this.isPointExplored(x, y) : null;
    for (const w of state.walls || []) {
      if (!w || !isDoorKind(w.kind)) continue;
      if (
        !isDoorVisibleToSeat(w, {
          role: state.role,
          dynamicLighting: useDynamic,
          visSources,
          isExploredFn
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
      } else {
        const pt = resolveWallDrawPoint(this.hoverWorldPos.x, this.hoverWorldPos.y, {
          grid,
          walls: state.walls,
          freehand: Boolean(this.wallFreehand)
        });
        const drawKind = state.wallDrawKind || 'wall';
        const kindColors = {
          wall: '#38bdf8',
          terrain: '#34d399',
          invisible: '#22d3ee',
          door: '#f59e0b',
          secret: '#a855f7'
        };
        const color = kindColors[drawKind] || '#38bdf8';
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
    this.els.overlayVectorSvg.innerHTML = parts.join('');
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
          const isDoor = w.kind === 'door' || w.kind === 'secret';
          ctx.save();
          ctx.strokeStyle = isDoor ? (w.open ? '#10b981' : (w.kind === 'secret' ? '#a855f7' : '#f59e0b')) : '#38bdf8';
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
