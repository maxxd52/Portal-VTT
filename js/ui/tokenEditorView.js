/* ==========================================================================
   TOKEN EDITOR VIEW: ESTUDIO RÁPIDO DE TOKEN ESTILO APPLE
   ========================================================================== */

import {
  TOKEN_FRAME_COLORS,
  TokenComposer,
  computeDrawTransform,
  getDefaultFitMode
} from '../utils/tokenComposer.js?v=20261121a6';

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3.5;

export const TokenEditorViewMethods = {
  _ensureTokenEditorState() {
    if (!this._tokenEditor) {
      this._tokenEditor = {
        img: null,
        frame: 'none',
        frameColor: '#8b5cf6',
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        detection: null,
        canRemove: false,
        onApply: null,
        onRemove: null,
        loadSeq: 0
      };
    }
    return this._tokenEditor;
  },

  bindTokenEditorEvents() {
    const modal = this.els.tokenEditorModal;
    if (!modal || this._tokenEditorBound) return;
    this._tokenEditorBound = true;
    const ed = this._ensureTokenEditorState();

    const closeModal = () => this.closeTokenEditor();
    this.els.btnCloseTokenEditor?.addEventListener('click', closeModal);
    this.els.btnCancelTokenEditor?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    this.els.fileTokenEditorInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) await this.loadTokenEditorFile(file);
    });

    this.els.btnTokenEditorReset?.addEventListener('click', () => {
      ed.zoom = 1;
      ed.offsetX = 0;
      ed.offsetY = 0;
      this.syncTokenEditorControls();
      this.renderTokenEditorCanvas();
    });

    const applyZoom = (nextZoom) => {
      ed.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(nextZoom) || 1));
      this.syncTokenEditorControls();
      this.renderTokenEditorCanvas();
    };

    this.els.rngTokenEditorZoom?.addEventListener('input', (e) => applyZoom(e.target.value));
    this.els.btnTokenEditorZoomOut?.addEventListener('click', () => applyZoom(ed.zoom - 0.15));
    this.els.btnTokenEditorZoomIn?.addEventListener('click', () => applyZoom(ed.zoom + 0.15));

    this.els.tokenEditorFrameSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-token-frame]');
      if (!btn) return;
      ed.frame = btn.dataset.tokenFrame;
      this.syncTokenEditorControls();
      this.renderTokenEditorCanvas();
    });

    this.els.inpTokenEditorColor?.addEventListener('input', (e) => {
      ed.frameColor = e.target.value;
      this.syncTokenEditorControls();
      this.renderTokenEditorCanvas();
    });

    // Panning sobre el lienzo del visor (invariante al zoom de interfaz via rect)
    const canvas = this.els.tokenEditorCanvas;
    let dragging = false;
    let startClient = { x: 0, y: 0 };
    let startOffset = { x: 0, y: 0 };

    canvas?.addEventListener('pointerdown', (e) => {
      if (!ed.img || e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      startClient = { x: e.clientX, y: e.clientY };
      startOffset = { x: ed.offsetX, y: ed.offsetY };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    window.addEventListener('pointermove', (e) => {
      if (!dragging || !ed.img || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (e.clientX - startClient.x) / Math.max(1, rect.width);
      const dy = (e.clientY - startClient.y) / Math.max(1, rect.height);
      const tx = computeDrawTransform({
        imgWidth: ed.img.naturalWidth || ed.img.width,
        imgHeight: ed.img.naturalHeight || ed.img.height,
        canvasSize: canvas.width || 448,
        zoom: ed.zoom,
        offsetX: startOffset.x + dx,
        offsetY: startOffset.y + dy,
        fitMode: getDefaultFitMode(ed.frame)
      });
      ed.offsetX = tx.clampedOffsetX;
      ed.offsetY = tx.clampedOffsetY;
      this.renderTokenEditorCanvas();
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try {
        if (canvas?.hasPointerCapture?.(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Zoom con rueda + Drag & drop de imagen dentro del visor
    const stage = this.els.tokenEditorStage;
    stage?.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!ed.img) return;
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        applyZoom(ed.zoom + delta);
      },
      { passive: false }
    );

    stage?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stage.classList.add('is-drag-over');
    });
    stage?.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      stage.classList.remove('is-drag-over');
    });
    stage?.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      stage.classList.remove('is-drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type?.startsWith('image/')) {
        await this.loadTokenEditorFile(file);
      }
    });

    document.addEventListener('paste', async (e) => {
      if (!this.els.tokenEditorModal?.classList.contains('is-open')) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find((it) => it.type?.startsWith('image/'));
      const file = imgItem?.getAsFile?.();
      if (file) {
        e.preventDefault();
        await this.loadTokenEditorFile(file);
      }
    });

    this.els.btnTokenEditorRemove?.addEventListener('click', () => {
      const cb = ed.onRemove;
      this.closeTokenEditor();
      if (typeof cb === 'function') cb();
    });

    this.els.btnApplyTokenEditor?.addEventListener('click', () => {
      if (!ed.img) return;
      try {
        const dataUrl = TokenComposer.composeTokenDataUrl(ed.img, {
          frame: ed.frame,
          frameColor: ed.frameColor,
          zoom: ed.zoom,
          offsetX: ed.offsetX,
          offsetY: ed.offsetY
        });
        const cb = ed.onApply;
        this.closeTokenEditor();
        if (typeof cb === 'function') cb(dataUrl);
      } catch (err) {
        this.showActionToast(err?.message || 'No se pudo exportar la imagen del token.');
      }
    });
  },

  async openTokenEditor({
    initialUrl = '',
    file = null,
    defaultColor = '#8b5cf6',
    canRemove = false,
    onApply = null,
    onRemove = null
  } = {}) {
    this.bindTokenEditorEvents();
    const ed = this._ensureTokenEditorState();
    ed.loadSeq += 1;
    ed.img = null;
    ed.frame = 'none';
    ed.frameColor = defaultColor || '#8b5cf6';
    ed.zoom = 1;
    ed.offsetX = 0;
    ed.offsetY = 0;
    ed.detection = null;
    ed.canRemove = Boolean(canRemove);
    ed.onApply = onApply;
    ed.onRemove = onRemove;

    this.els.tokenEditorModal?.classList.add('is-open');
    this.syncTokenEditorControls();
    this.renderTokenEditorCanvas();

    if (file) {
      await this.loadTokenEditorFile(file);
    } else if (initialUrl) {
      await this.loadTokenEditorUrl(initialUrl);
    }
  },

  closeTokenEditor() {
    const ed = this._ensureTokenEditorState();
    ed.loadSeq += 1;
    ed.onApply = null;
    ed.onRemove = null;
    this.els.tokenEditorStage?.classList.remove('is-drag-over');
    this.els.tokenEditorModal?.classList.remove('is-open');
  },

  _applyLoadedTokenImage(img, seq) {
    const ed = this._ensureTokenEditorState();
    if (seq !== ed.loadSeq) return;
    ed.img = img;
    ed.zoom = 1;
    ed.offsetX = 0;
    ed.offsetY = 0;
    ed.detection = TokenComposer.detectImageTransparency(img);
    ed.frame = ed.detection.recommendedFrame || 'none';
    this.syncTokenEditorControls();
    this.renderTokenEditorCanvas();
  },

  async loadTokenEditorFile(file) {
    const ed = this._ensureTokenEditorState();
    const seq = ++ed.loadSeq;
    try {
      const img = await TokenComposer.loadImageFromFile(file);
      this._applyLoadedTokenImage(img, seq);
    } catch (err) {
      if (seq === ed.loadSeq) {
        this.showActionToast(err?.message || 'No se pudo cargar la imagen.');
      }
    }
  },

  async loadTokenEditorUrl(url) {
    const ed = this._ensureTokenEditorState();
    const seq = ++ed.loadSeq;
    try {
      const img = await TokenComposer.loadImageFromUrl(url);
      this._applyLoadedTokenImage(img, seq);
    } catch (err) {
      if (seq === ed.loadSeq) {
        this.showActionToast(err?.message || 'No se pudo cargar la URL de imagen.');
        this.syncTokenEditorControls();
        this.renderTokenEditorCanvas();
      }
    }
  },

  syncTokenEditorControls() {
    const ed = this._ensureTokenEditorState();
    const hasImg = Boolean(ed.img);

    this.els.tokenEditorDropEmpty?.classList.toggle('hidden', hasImg);
    this.els.btnTokenEditorPickFile?.classList.toggle('hidden', !hasImg);
    this.els.btnTokenEditorReset?.classList.toggle('hidden', !hasImg);
    this.els.btnTokenEditorRemove?.classList.toggle('hidden', !ed.canRemove);
    if (this.els.btnApplyTokenEditor) {
      this.els.btnApplyTokenEditor.disabled = !hasImg;
    }

    if (this.els.lblTokenEditorBadge) {
      if (!hasImg || !ed.detection || ed.detection.tainted) {
        this.els.lblTokenEditorBadge.classList.add('hidden');
      } else {
        this.els.lblTokenEditorBadge.textContent = ed.detection.hasTransparentCorners ? 'Sin fondo' : 'Retrato';
        this.els.lblTokenEditorBadge.classList.remove('hidden');
      }
    }

    if (this.els.rngTokenEditorZoom) {
      this.els.rngTokenEditorZoom.disabled = !hasImg;
      this.els.rngTokenEditorZoom.value = String(ed.zoom);
    }
    if (this.els.btnTokenEditorZoomOut) this.els.btnTokenEditorZoomOut.disabled = !hasImg;
    if (this.els.btnTokenEditorZoomIn) this.els.btnTokenEditorZoomIn.disabled = !hasImg;
    if (this.els.lblTokenEditorZoom) {
      this.els.lblTokenEditorZoom.textContent = `${Math.round(ed.zoom * 100)}%`;
    }

    this.els.tokenEditorFrameSeg?.querySelectorAll('[data-token-frame]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tokenFrame === ed.frame);
    });

    const showColor = ed.frame !== 'none';
    this.els.tokenEditorColorRow?.classList.toggle('hidden', !showColor);
    this.els.tokenEditorColorRow?.classList.toggle('flex', showColor);

    if (this.els.inpTokenEditorColor) {
      this.els.inpTokenEditorColor.value = ed.frameColor || '#8b5cf6';
    }
    if (this.els.tokenEditorColorGrid) {
      const grid = this.els.tokenEditorColorGrid;
      if (grid.children.length === 0) {
        grid.innerHTML = TOKEN_FRAME_COLORS
          .map(
            ([hex, label]) =>
              `<button type="button" data-te-color="${hex}" title="${label}" aria-label="${label}" class="portal-swatch" style="background:${hex};"></button>`
          )
          .join('');
        grid.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-te-color]');
          if (!btn) return;
          ed.frameColor = btn.dataset.teColor;
          this.syncTokenEditorControls();
          this.renderTokenEditorCanvas();
        });
      }
      const activeHex = String(ed.frameColor || '#8b5cf6').toLowerCase();
      grid.querySelectorAll('[data-te-color]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.teColor.toLowerCase() === activeHex);
      });
    }
  },

  renderTokenEditorCanvas() {
    const canvas = this.els.tokenEditorCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ed = this._ensureTokenEditorState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!ed.img) return;
    const tx = TokenComposer.drawTokenComposition(ctx, ed.img, {
      size: canvas.width,
      frame: ed.frame,
      frameColor: ed.frameColor,
      zoom: ed.zoom,
      offsetX: ed.offsetX,
      offsetY: ed.offsetY
    });
    ed.offsetX = tx.clampedOffsetX;
    ed.offsetY = tx.clampedOffsetY;
  }
};
