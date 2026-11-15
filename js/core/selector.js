/* ==========================================================================
   SELECTOR: CONSULTAS PURAS DE COORDENADAS, RAYCASTING 2D Y SERIALIZACIÓN
   ========================================================================== */

export const Selector = {
  screenToWorld(state, clientX, clientY) {
    return {
      x: (clientX - state.camera.x) / state.camera.zoom,
      y: (clientY - state.camera.y) / state.camera.zoom
    };
  },

  snapPosition(state, wx, wy, sizeCells = 1) {
    if (!state.grid.snap) return { x: wx, y: wy };
    const cs = state.grid.cellSize;
    const ox = Number(state.grid.offsetX) || 0;
    const oy = Number(state.grid.offsetY) || 0;
    const half = (cs * sizeCells) / 2;
    return {
      x: Math.round((wx - ox - half) / cs) * cs + ox + half,
      y: Math.round((wy - oy - half) / cs) * cs + oy + half
    };
  },

  getSelectedToken(state) {
    return state.tokens.find((t) => t.id === state.selectedTokenId) || null;
  },

  distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  },

  findDoorNearPoint(state, wx, wy, maxDist = 22) {
    for (const w of state.walls || []) {
      if (w.kind === 'door' && this.distToSegment(wx, wy, w.x1, w.y1, w.x2, w.y2) <= maxDist) {
        return w;
      }
    }
    return null;
  },

  // Raycasting 2D: calcula el polígono de visibilidad alrededor de (ox, oy) hasta radius
  computeVisibilityPolygon(origin, radius, walls) {
    const ox = origin.x;
    const oy = origin.y;
    const R = Math.max(120, radius || 520);
    const minX = ox - R;
    const maxX = ox + R;
    const minY = oy - R;
    const maxY = oy + R;

    // Segmentos activos (muros cerrados + puertas cerradas + caja delimitadora de alcance)
    const segments = [
      { x1: minX, y1: minY, x2: maxX, y2: minY },
      { x1: maxX, y1: minY, x2: maxX, y2: maxY },
      { x1: maxX, y1: maxY, x2: minX, y2: maxY },
      { x1: minX, y1: maxY, x2: minX, y2: minY }
    ];

    for (const w of walls || []) {
      if (w.kind === 'door' && w.open) continue;
      if (Math.max(w.x1, w.x2) < minX || Math.min(w.x1, w.x2) > maxX) continue;
      if (Math.max(w.y1, w.y2) < minY || Math.min(w.y1, w.y2) > maxY) continue;
      segments.push(w);
    }

    // Recolectar ángulos únicos hacia todos los vértices con micro-desplazamiento ±eps
    const angles = [];
    const eps = 0.00015;
    for (const seg of segments) {
      const pts = [
        [seg.x1, seg.y1],
        [seg.x2, seg.y2]
      ];
      for (const [px, py] of pts) {
        const baseAngle = Math.atan2(py - oy, px - ox);
        angles.push(baseAngle - eps, baseAngle, baseAngle + eps);
      }
    }

    const hits = [];
    for (const angle of angles) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let minT = R * 1.45;
      let hitX = ox + dx * R;
      let hitY = oy + dy * R;

      for (const seg of segments) {
        const sdx = seg.x2 - seg.x1;
        const sdy = seg.y2 - seg.y1;
        const denom = dx * sdy - dy * sdx;
        if (Math.abs(denom) < 1e-9) continue;

        const qpx = seg.x1 - ox;
        const qpy = seg.y1 - oy;
        const t = (qpx * sdy - qpy * sdx) / denom;
        const u = (qpx * dy - qpy * dx) / denom;

        if (t >= 0 && u >= 0 && u <= 1 && t < minT) {
          minT = t;
          hitX = ox + dx * t;
          hitY = oy + dy * t;
        }
      }
      hits.push({ angle, x: hitX, y: hitY });
    }

    hits.sort((a, b) => a.angle - b.angle);
    return hits;
  },

  isPointInPolygon(pt, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect =
        yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  },

  getAlliedVisibilityPolygons(state) {
    const sources = (state.tokens || []).filter(
      (t) => !t.hidden && (t.isAlly !== false || (Number(t.lightRadius) || 0) > 0)
    );
    return sources.map((tok) => {
      const vision = tok.isAlly !== false ? (tok.visionRadius || 520) : 0;
      const light = Number(tok.lightRadius) || 0;
      const radius = Math.max(vision, light) || 520;
      return {
        token: tok,
        radius,
        poly: this.computeVisibilityPolygon({ x: tok.x, y: tok.y }, radius, state.walls)
      };
    });
  },

  extractSerializableWorld(state) {
    return {
      moduleTitle: state.room.moduleTitle,
      ruleset: state.ruleset || 'dnd55',
      mapId: state.mapId,
      activeMapKey: state.activeMapKey || state.mapId || 'bastion',
      customMapUrl: state.customMapUrl,
      mapGrids: JSON.parse(JSON.stringify(state.mapGrids || {})),
      notes: JSON.parse(JSON.stringify(state.notes || [])),
      combat: JSON.parse(JSON.stringify(state.combat || { active: false, round: 1, turnIndex: 0, order: [] })),
      dynamicLighting: Boolean(state.dynamicLighting),
      walls: JSON.parse(JSON.stringify(state.walls || [])),
      grid: { ...state.grid },
      customActors: JSON.parse(JSON.stringify(state.customActors || [])),
      customItems: JSON.parse(JSON.stringify(state.customItems || [])),
      customMaps: JSON.parse(JSON.stringify(state.customMaps || [])),
      compendiumFolders: JSON.parse(JSON.stringify(state.compendiumFolders || { actors: [], items: [], maps: [] })),
      tokens: JSON.parse(JSON.stringify(state.tokens)),
      strokes: JSON.parse(JSON.stringify(state.strokes)),
      fogRects: JSON.parse(JSON.stringify(state.fogRects))
    };
  }
};
