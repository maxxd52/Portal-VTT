/* ==========================================================================
   GRID GEOMETRY: GRILLA CUADRADA Y HEXAGONAL (SNAP, REGLA, AJUSTE Y RENDER)
   ========================================================================== */

export const GRID_TYPES = ['none', 'square', 'hex-v', 'hex-h'];
export const GRID_COLORS = ['auto', 'light', 'dark'];

const SQRT3 = Math.sqrt(3);

export function normalizeGridConfig(raw = {}) {
  const rawOp = typeof raw?.opacity === 'number' ? raw.opacity : Number(raw?.opacity);
  const rawSize = Number(raw?.cellSize);
  const rawOffX = Number(raw?.offsetX);
  const rawOffY = Number(raw?.offsetY);
  const rawMpu = Number(raw?.metersPerUnit);
  return {
    type: GRID_TYPES.includes(raw?.type) ? raw.type : 'square',
    cellSize: Math.round(Math.max(16, Math.min(300, Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 80)) * 100) / 100,
    metersPerUnit: Math.round(Math.max(0.5, Math.min(50, Number.isFinite(rawMpu) && rawMpu > 0 ? rawMpu : 1.5)) * 100) / 100,
    offsetX: Math.round(Math.max(-300, Math.min(300, Number.isFinite(rawOffX) ? rawOffX : 0)) * 100) / 100,
    offsetY: Math.round(Math.max(-300, Math.min(300, Number.isFinite(rawOffY) ? rawOffY : 0)) * 100) / 100,
    opacity: Number.isFinite(rawOp) ? Math.max(0, Math.min(0.85, rawOp)) : 0.28,
    snap: raw?.snap !== undefined ? Boolean(raw.snap) : true,
    color: GRID_COLORS.includes(raw?.color) ? raw.color : 'auto'
  };
}

export function resolveGridStrokeStyle(grid, theme = 'slate') {
  const g = normalizeGridConfig(grid);
  const useDark = g.color === 'dark' || (g.color === 'auto' && (theme === 'parchment' || theme === 'light'));
  return useDark ? `rgba(15, 23, 42, ${g.opacity})` : `rgba(226, 232, 240, ${g.opacity})`;
}

export function axialRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

export function hexAxialDistance(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
}

export function axialToPixel(grid, q, r) {
  const g = normalizeGridConfig(grid);
  const cs = g.cellSize;
  const R = cs / SQRT3;
  if (g.type === 'hex-h') {
    const ox = g.offsetX + R;
    const oy = g.offsetY + cs / 2;
    return {
      x: Math.round((ox + 1.5 * R * q) * 100) / 100,
      y: Math.round((oy + cs * (q / 2 + r)) * 100) / 100
    };
  }
  const ox = g.offsetX + cs / 2;
  const oy = g.offsetY + R;
  return {
    x: Math.round((ox + cs * (q + r / 2)) * 100) / 100,
    y: Math.round((oy + 1.5 * R * r) * 100) / 100
  };
}

export function pixelToAxial(grid, wx, wy) {
  const g = normalizeGridConfig(grid);
  const cs = g.cellSize;
  const R = cs / SQRT3;
  if (g.type === 'hex-h') {
    const px = wx - (g.offsetX + R);
    const py = wy - (g.offsetY + cs / 2);
    return {
      q: ((2 / 3) * px) / R,
      r: (-(1 / 3) * px + (SQRT3 / 3) * py) / R
    };
  }
  const px = wx - (g.offsetX + cs / 2);
  const py = wy - (g.offsetY + R);
  return {
    q: ((SQRT3 / 3) * px - (1 / 3) * py) / R,
    r: ((2 / 3) * py) / R
  };
}

export function snapToGrid(grid, wx, wy, sizeCells = 1) {
  const g = normalizeGridConfig(grid);
  if (g.type === 'none' || !g.snap) return { x: wx, y: wy };
  if (g.type === 'hex-v' || g.type === 'hex-h') {
    const frac = pixelToAxial(g, wx, wy);
    const rounded = axialRound(frac.q, frac.r);
    return axialToPixel(g, rounded.q, rounded.r);
  }
  const cs = g.cellSize;
  const half = (cs * (Number(sizeCells) || 1)) / 2;
  return {
    x: Math.round((wx - g.offsetX - half) / cs) * cs + g.offsetX + half,
    y: Math.round((wy - g.offsetY - half) / cs) * cs + g.offsetY + half
  };
}

export function measureGridDistance(grid, x1, y1, x2, y2) {
  const g = normalizeGridConfig(grid);
  if (g.type === 'hex-v' || g.type === 'hex-h') {
    const aFrac = pixelToAxial(g, x1, y1);
    const bFrac = pixelToAxial(g, x2, y2);
    const a = axialRound(aFrac.q, aFrac.r);
    const b = axialRound(bFrac.q, bFrac.r);
    return hexAxialDistance(a.q, a.r, b.q, b.r);
  }
  const dist = Math.hypot(x2 - x1, y2 - y1);
  return Math.round((dist / g.cellSize) * 10) / 10;
}

export function fitGridToBounds({
  cols = 0,
  rows = 0,
  type = 'square',
  boundsWidth = 2400,
  boundsHeight = 1600,
  boundsX = 0,
  boundsY = 0
} = {}) {
  const c = Number(cols) || 0;
  const r = Number(rows) || 0;
  const t = GRID_TYPES.includes(type) ? type : 'square';
  let rawCell = 80;
  if (t === 'hex-v') {
    rawCell = c >= 2 ? boundsWidth / c : (boundsHeight * SQRT3) / (1.5 * r + 0.5);
  } else if (t === 'hex-h') {
    rawCell = c >= 2 ? (boundsWidth * SQRT3) / (1.5 * c + 0.5) : boundsHeight / r;
  } else {
    rawCell = c >= 2 ? boundsWidth / c : boundsHeight / r;
  }
  return {
    cellSize: Math.round(Math.max(16, Math.min(300, rawCell)) * 100) / 100,
    offsetX: Math.round(Math.max(-300, Math.min(300, Number(boundsX) || 0)) * 100) / 100,
    offsetY: Math.round(Math.max(-300, Math.min(300, Number(boundsY) || 0)) * 100) / 100
  };
}

function traceGridPaths(ctx, g, width, height) {
  ctx.beginPath();
  const cs = g.cellSize;
  if (g.type === 'square') {
    const startX = ((g.offsetX % cs) + cs) % cs;
    const startY = ((g.offsetY % cs) + cs) % cs;
    for (let x = startX; x <= width; x += cs) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = startY; y <= height; y += cs) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    return;
  }

  const R = cs / SQRT3;
  if (g.type === 'hex-v') {
    const minRow = Math.floor((-g.offsetY - R) / (1.5 * R)) - 2;
    const maxRow = Math.ceil((height - g.offsetY) / (1.5 * R)) + 2;
    const minCol = Math.floor((-g.offsetX - cs) / cs) - 2;
    const maxCol = Math.ceil((width - g.offsetX) / cs) + 2;
    const halfW = cs / 2;
    const halfR = R / 2;

    for (let row = minRow; row <= maxRow; row++) {
      const qShift = Math.floor(row / 2);
      for (let col = minCol; col <= maxCol; col++) {
        const q = col - qShift;
        const { x: cx, y: cy } = axialToPixel(g, q, row);
        ctx.moveTo(cx - halfW, cy - halfR);
        ctx.lineTo(cx, cy - R);
        ctx.lineTo(cx + halfW, cy - halfR);
        ctx.lineTo(cx + halfW, cy + halfR);
      }
    }
  } else {
    const minCol = Math.floor((-g.offsetX - R) / (1.5 * R)) - 2;
    const maxCol = Math.ceil((width - g.offsetX) / (1.5 * R)) + 2;
    const minRow = Math.floor((-g.offsetY - cs) / cs) - 2;
    const maxRow = Math.ceil((height - g.offsetY) / cs) + 2;
    const halfH = cs / 2;
    const halfR = R / 2;

    for (let col = minCol; col <= maxCol; col++) {
      const rShift = Math.floor(col / 2);
      for (let row = minRow; row <= maxRow; row++) {
        const r = row - rShift;
        const { x: cx, y: cy } = axialToPixel(g, col, r);
        ctx.moveTo(cx - halfR, cy - halfH);
        ctx.lineTo(cx + halfR, cy - halfH);
        ctx.lineTo(cx + R, cy);
        ctx.lineTo(cx + halfR, cy + halfH);
      }
    }
  }
}

export function drawGridOverlay(
  ctx,
  grid,
  { width = 2400, height = 1600, theme = 'slate', lineWidth = 1, dualInk = false, darkStroke = '', lightStroke = '' } = {}
) {
  const g = normalizeGridConfig(grid);
  if (g.type === 'none' || g.opacity <= 0) return;

  ctx.save();
  if (dualInk && darkStroke && lightStroke) {
    // Printed-ink dual pass: dark etched groove darkens bright floors, micro-shifted light catch lifts dark floors
    ctx.lineWidth = Math.max(1, lineWidth * 1.15);
    ctx.strokeStyle = darkStroke;
    traceGridPaths(ctx, g, width, height);
    ctx.stroke();

    ctx.translate(0.85, 0.85);
    ctx.lineWidth = Math.max(0.85, lineWidth * 0.9);
    ctx.strokeStyle = lightStroke;
    traceGridPaths(ctx, g, width, height);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.strokeStyle = darkStroke || lightStroke || resolveGridStrokeStyle(g, theme);
  ctx.lineWidth = lineWidth;
  traceGridPaths(ctx, g, width, height);
  ctx.stroke();
  ctx.restore();
}
