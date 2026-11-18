import { Selector } from '../core/selector.js?v=20261117b1';
import { Service } from '../core/service.js?v=20261117b1';

/**
 * Canvas, Fog of War, Map Notes & Vector Overlay rendering methods mixed into View.
 */
export const CanvasViewMethods = {
  clearExploredMemory() {
    if (!this.exploredCanvas) {
      this.exploredCanvas = document.createElement('canvas');
      this.exploredCanvas.width = 2400;
      this.exploredCanvas.height = 1600;
    }
    const ectx = this.exploredCanvas.getContext('2d');
    ectx.clearRect(0, 0, 2400, 1600);
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

  drawMapCanvas(state) {
    const ctx = this.els.mapCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);

    const customSrc = state.mapId === 'custom' ? (state.customMapUrl || Service.loadedMapImage?.src || '') : '';
    if (customSrc && this.els.customMapImg) {
      if (this.els.customMapImg.getAttribute('src') !== customSrc) {
        this.els.customMapImg.src = customSrc;
      }
      this.els.customMapImg.classList.remove('hidden');
      return;
    }
    if (this.els.customMapImg) {
      this.els.customMapImg.classList.add('hidden');
      this.els.customMapImg.removeAttribute('src');
    }

    if (state.mapId === 'empty') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 2400, 1600);
      return;
    }

    if (state.mapId === 'forest') {
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
      // Copas de árboles
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

    if (state.mapId === 'tavern') {
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
      // Barra y mesas
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

    if (state.mapId === 'crypt') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 2400, 1600);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(200, 200, 2000, 1200);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 10;
      ctx.strokeRect(200, 200, 2000, 1200);
      // Sarcófagos y altar central
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(1080, 720, 240, 160);
      for (const sx of [440, 1800]) {
        for (const sy of [360, 1080]) {
          ctx.fillRect(sx, sy, 140, 80);
        }
      }
      return;
    }

    if (state.mapId === 'arena') {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, 2400, 1600);
      ctx.fillStyle = '#785a3a';
      ctx.beginPath();
      ctx.arc(1200, 800, 680, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a8a29e';
      ctx.lineWidth = 16;
      ctx.stroke();
      // 4 pilares de piedra
      ctx.fillStyle = '#57534e';
      for (const [px, py] of [[920, 560], [1480, 560], [920, 1040], [1480, 1040]]) {
        ctx.beginPath();
        ctx.arc(px, py, 44, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (state.mapId === 'cavern') {
      ctx.fillStyle = '#161b22';
      ctx.fillRect(0, 0, 2400, 1600);
      // Río subterráneo
      ctx.fillStyle = '#164e63';
      ctx.beginPath();
      ctx.moveTo(0, 960);
      ctx.bezierCurveTo(600, 740, 1400, 1180, 2400, 840);
      ctx.lineTo(2400, 1060);
      ctx.bezierCurveTo(1400, 1380, 600, 940, 0, 1140);
      ctx.closePath();
      ctx.fill();
      // Formaciones rocosas
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
    // Columnas tácticas
    ctx.fillStyle = '#0f172a';
    for (let cx = 480; cx <= 1920; cx += 480) {
      for (let cy = 400; cy <= 1200; cy += 400) {
        ctx.fillRect(cx - 32, cy - 32, 64, 64);
      }
    }
  },

  drawGridCanvas(state) {
    const ctx = this.els.gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);
    if (state.grid.opacity <= 0) return;

    const cs = Math.max(16, Number(state.grid.cellSize) || 80);
    const ox = Number(state.grid.offsetX) || 0;
    const oy = Number(state.grid.offsetY) || 0;
    const startX = ((ox % cs) + cs) % cs;
    const startY = ((oy % cs) + cs) % cs;
    ctx.strokeStyle =
      state.theme === 'parchment' || state.theme === 'light'
        ? `rgba(15, 23, 42, ${state.grid.opacity})`
        : `rgba(226, 232, 240, ${state.grid.opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= 2400; x += cs) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1600);
    }
    for (let y = startY; y <= 1600; y += cs) {
      ctx.moveTo(0, y);
      ctx.lineTo(2400, y);
    }
    ctx.stroke();
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

  drawFogCanvas(state) {
    const ctx = this.els.fogCanvas.getContext('2d');
    ctx.clearRect(0, 0, 2400, 1600);

    const hasManualFog = state.fogRects && state.fogRects.length > 0;
    const useDynamic = Boolean(state.dynamicLighting);

    if (!hasManualFog && !useDynamic) return;

    // 1. Actualizar capa de memoria explorada con los polígonos de visión actuales
    const visSources = useDynamic ? Selector.getAlliedVisibilityPolygons(state) : [];
    if (useDynamic && this.exploredCanvas && visSources.length > 0) {
      const ectx = this.exploredCanvas.getContext('2d');
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
    }

    // 2. Cubrir el tablero con oscuridad (semitransparente para GM, opaca para Jugador)
    ctx.fillStyle = state.role === 'gm' ? 'rgba(10, 13, 20, 0.52)' : 'rgba(8, 10, 16, 0.97)';
    ctx.fillRect(0, 0, 2400, 1600);

    // 3. Revelar en penumbra las zonas previamente exploradas (solo vista Jugador)
    if (useDynamic && state.role === 'player' && this.exploredCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 0.28;
      ctx.drawImage(this.exploredCanvas, 0, 0);
      ctx.restore();
    }

    // 4. Recortar luz dinámica activa con degradado radial suave dentro de cada polígono
    if (useDynamic && visSources.length > 0) {
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
        grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.96)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(src.token.x, src.token.y, src.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // 5. Aplicar pincel de niebla manual si existe
    for (const f of state.fogRects || []) {
      if (f.mode === 'reveal') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r || 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = state.role === 'gm' ? 'rgba(10, 13, 20, 0.52)' : 'rgba(8, 10, 16, 0.97)';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r || 90, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Dibujar plano de muros y puertas interactivas (visibles para GM y puertas visibles para todos)
    for (const w of state.walls || []) {
      if (state.role !== 'gm' && w.kind !== 'door') continue;
      ctx.save();
      ctx.lineCap = 'round';
      if (w.kind === 'door') {
        ctx.strokeStyle = w.open ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 6;
        if (w.open) ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();

        // Indicador central clicable de puerta
        const mx = (w.x1 + w.x2) / 2;
        const my = (w.y1 + w.y2) / 2;
        ctx.setLineDash([]);
        ctx.fillStyle = w.open ? '#10b981' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(mx, my, 7, 0, Math.PI * 2);
        ctx.fill();
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
  },

  renderVectorOverlay(state) {
    const parts = [];
    if (state.tool === 'wall' && state.wallAnchor) {
      const cs = state.grid.cellSize / 2;
      const tx = Math.round(this.hoverWorldPos.x / cs) * cs;
      const ty = Math.round(this.hoverWorldPos.y / cs) * cs;
      const color = state.wallType === 'door' ? '#f59e0b' : '#38bdf8';
      parts.push(`
        <line x1="${state.wallAnchor.x}" y1="${state.wallAnchor.y}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="5" stroke-dasharray="6 4" />
        <circle cx="${state.wallAnchor.x}" cy="${state.wallAnchor.y}" r="6" fill="${color}" />
        <circle cx="${tx}" cy="${ty}" r="6" fill="${color}" />
      `);
    }
    if (state.ruler) {
      const { x1, y1, x2, y2 } = state.ruler;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const cells = Math.round((dist / state.grid.cellSize) * 10) / 10;
      const meters = (cells * 1.5).toFixed(1);
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
          ? Math.max(state.grid.cellSize * 0.5, state.areaSelectConfig.radiusPx || dist)
          : Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        const rx = isAreaCentered ? x1 - side / 2 : x2 >= x1 ? x1 : x1 - side;
        const ry = isAreaCentered ? y1 - side / 2 : y2 >= y1 ? y1 : y1 - side;
        const labelX = isAreaCentered ? x1 : mx;
        const labelY = isAreaCentered ? ry - 6 : my;
        const sideCells = Math.round((side / state.grid.cellSize) * 10) / 10;
        parts.push(`
          <rect x="${rx}" y="${ry}" width="${side}" height="${side}" fill="rgba(245, 158, 11, 0.16)" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6 4" />
          ${isAreaCentered ? `<circle cx="${x1}" cy="${y1}" r="5" fill="#f59e0b" />` : ''}
          <rect x="${labelX - 62}" y="${labelY - 26}" width="124" height="22" rx="11" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
          <text x="${labelX}" y="${labelY - 11}" fill="#ffffff" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" text-anchor="middle">${sideCells}×${sideCells} cas</text>
        `);
      } else {
        if (state.tool === 'areaSelect' && state.areaSelectConfig && dist > 1) {
          const halfW = (state.grid.cellSize || 80) * 0.5;
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
        parts.push(`
          <circle cx="${x1}" cy="${y1}" r="6" fill="#f59e0b" />
          <circle cx="${x2}" cy="${y2}" r="6" fill="#f59e0b" />
          <rect x="${mx - 58}" y="${my - 26}" width="116" height="22" rx="11" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
          <text x="${mx}" y="${my - 11}" fill="#ffffff" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" text-anchor="middle">${cells} cas · ${meters}m</text>
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
  }
};
