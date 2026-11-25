import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

globalThis.window = {
  location: { search: '' },
  innerWidth: 1280,
  innerHeight: 720
};
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) {
    return this._store.has(k) ? this._store.get(k) : null;
  },
  setItem(k, v) {
    this._store.set(k, String(v));
  },
  removeItem(k) {
    this._store.delete(k);
  }
};

const {
  TOKEN_FRAME_STYLES,
  TokenComposer,
  adjustHexLuminance,
  computeDrawTransform,
  computeTokenRimSpec,
  detectImageTransparencyFromPixels,
  getDefaultFitMode,
  getHexagonVertices,
  shouldApplyRuntimeCoinRim,
  shouldRenderTokenRim
} = await import('../js/utils/tokenComposer.js?v=20261125a1');
const { createInitialState } = await import('../js/core/model.js?v=20261125a1');
const { Service } = await import('../js/core/service.js?v=20261125a1');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261125a1');

function makeRgba(width, height, alphaFn) {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      buf[idx] = 200;
      buf[idx + 1] = 150;
      buf[idx + 2] = 100;
      buf[idx + 3] = alphaFn(x, y, width, height);
    }
  }
  return buf;
}

function pointInHexagon(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x, yi = verts[i].y;
    const xj = verts[j].x, yj = verts[j].y;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

test('detectImageTransparencyFromPixels distinguishes opaque portraits, circular/hex tokens, tiny rounded corners, and invalid inputs', () => {
  assert.deepEqual(
    TOKEN_FRAME_STYLES.map((f) => f.id),
    ['none', 'circle', 'square', 'hex'],
    'Exactly one option per geometric frame shape'
  );

  // 1. Opaque portrait -> circle
  const opaque = makeRgba(64, 64, () => 255);
  assert.deepEqual(detectImageTransparencyFromPixels(opaque, 64, 64), {
    hasTransparentCorners: false,
    transparentRatio: 0,
    recommendedFrame: 'circle'
  });

  // 2. Inscribed circle with transparent corners -> none
  const circle = makeRgba(64, 64, (x, y, w, h) => {
    const dist = Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2);
    return dist <= w * 0.48 ? 255 : 0;
  });
  const circleRes = detectImageTransparencyFromPixels(circle, 64, 64);
  assert.equal(circleRes.hasTransparentCorners, true);
  assert.equal(circleRes.recommendedFrame, 'none');
  assert.ok(circleRes.transparentRatio >= 0.5);

  // 3. Pointy-top hexagon with transparent corners -> none
  const hexVerts = getHexagonVertices(32, 32, 30);
  const hex = makeRgba(64, 64, (x, y) => (pointInHexagon(x + 0.5, y + 0.5, hexVerts) ? 255 : 0));
  const hexRes = detectImageTransparencyFromPixels(hex, 64, 64);
  assert.equal(hexRes.hasTransparentCorners, true);
  assert.equal(hexRes.recommendedFrame, 'none');

  // 4. Tiny 2px rounded corner on a 64x64 card stays opaque-majority -> circle
  const tinyRounded = makeRgba(64, 64, (x, y, w, h) => {
    const inCornerX = x < 2 || x >= w - 2;
    const inCornerY = y < 2 || y >= h - 2;
    return inCornerX && inCornerY ? 0 : 255;
  });
  const tinyRes = detectImageTransparencyFromPixels(tinyRounded, 64, 64);
  assert.equal(tinyRes.hasTransparentCorners, false);
  assert.equal(tinyRes.recommendedFrame, 'circle');
  assert.ok(tinyRes.transparentRatio < 0.5);

  // 5. Invalid or undersized buffers safely fall back to circle
  assert.deepEqual(detectImageTransparencyFromPixels(null, 64, 64), {
    hasTransparentCorners: false,
    transparentRatio: 0,
    recommendedFrame: 'circle'
  });
  assert.deepEqual(detectImageTransparencyFromPixels(new Uint8ClampedArray(12), 2, 2), {
    hasTransparentCorners: false,
    transparentRatio: 0,
    recommendedFrame: 'circle'
  });
});

test('computeDrawTransform handles cover vs contain, zoom bounds, edge-locked horizontal pan, and vertical pan bounds', () => {
  assert.equal(getDefaultFitMode('none'), 'contain');
  assert.equal(getDefaultFitMode('circle'), 'cover');
  assert.equal(getDefaultFitMode('square'), 'cover');
  assert.equal(getDefaultFitMode('hex'), 'cover');

  // Tall 400x800 portrait on 384x384 canvas in cover mode at zoom=1 -> drawW=384, drawH=768
  const tallCover = computeDrawTransform({
    imgWidth: 400,
    imgHeight: 800,
    canvasSize: 384,
    zoom: 1,
    offsetX: 0.4,
    offsetY: 2.0,
    fitMode: 'cover'
  });
  assert.equal(tallCover.drawW, 384);
  assert.equal(tallCover.drawH, 768);
  assert.equal(tallCover.maxOffsetX, 0);
  assert.equal(tallCover.clampedOffsetX, 0, 'Horizontal pan stays edge-locked when width matches canvas');
  assert.equal(tallCover.maxOffsetY, 0.5);
  assert.equal(tallCover.clampedOffsetY, 0.5, 'Vertical pan clamps cleanly at top/bottom edge');
  assert.equal(tallCover.drawY, 0);

  // Contain mode centers tall portrait with vertical fit
  const tallContain = computeDrawTransform({
    imgWidth: 400,
    imgHeight: 800,
    canvasSize: 384,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    fitMode: 'contain'
  });
  assert.equal(tallContain.drawH, 384);
  assert.equal(tallContain.drawW, 192);
  assert.equal(tallContain.drawX, 96);
  assert.equal(tallContain.drawY, 0);

  // Zoom clamps to [0.5, 4]
  assert.equal(computeDrawTransform({ imgWidth: 100, imgHeight: 100, canvasSize: 384, zoom: 0.1 }).zoom, 0.5);
  assert.equal(computeDrawTransform({ imgWidth: 100, imgHeight: 100, canvasSize: 384, zoom: 9 }).zoom, 4);
});

test('getHexagonVertices and adjustHexLuminance compute deterministic geometry and colors', () => {
  const verts = getHexagonVertices(100, 100, 50);
  assert.equal(verts.length, 6);
  assert.ok(Math.abs(verts[0].x - 100) < 1e-6 && Math.abs(verts[0].y - 50) < 1e-6, 'Top vertex is pointy-top');
  for (const v of verts) {
    assert.ok(Math.abs(Math.hypot(v.x - 100, v.y - 100) - 50) < 1e-6);
  }

  assert.equal(adjustHexLuminance('#000000', 0.5), '#808080');
  assert.equal(adjustHexLuminance('#ffffff', -0.5), '#808080');
  assert.equal(adjustHexLuminance('#0f0', 0), '#00ff00');
  assert.equal(adjustHexLuminance('not-a-hex', 0.2), '#8b5cf6');
});

test('S2: physical coin rim helpers enable thickness on framed/initials tokens and omit it on unframed silhouettes', () => {
  assert.equal(shouldRenderTokenRim('circle'), true);
  assert.equal(shouldRenderTokenRim('square'), true);
  assert.equal(shouldRenderTokenRim('hex'), true);
  assert.equal(shouldRenderTokenRim('none'), false);
  assert.equal(shouldRenderTokenRim(''), false);
  assert.equal(shouldRenderTokenRim(null), false);

  assert.equal(shouldApplyRuntimeCoinRim({ id: 'a', color: '#8b5cf6', imageUrl: '' }), true);
  assert.equal(shouldApplyRuntimeCoinRim({ id: 'b', color: '#8b5cf6', imageUrl: 'data:image/webp;base64,ABC' }), false);
  assert.equal(shouldApplyRuntimeCoinRim(null), false);

  const rimSmall = computeTokenRimSpec('#d4a84f', 56);
  const rimLarge = computeTokenRimSpec('#d4a84f', 160);
  assert.ok(rimSmall.depthPx >= 2 && rimSmall.depthPx <= 6);
  assert.ok(rimLarge.depthPx > rimSmall.depthPx && rimLarge.depthPx <= 6);
  assert.notEqual(rimSmall.rimColor, '#d4a84f');
  assert.match(rimSmall.rimColor, /^#[0-9a-f]{6}$/);
  assert.match(rimSmall.rimDeepColor, /^#[0-9a-f]{6}$/);

  // Verify drawTokenComposition renders extruded rim for framed tokens and skips it for frame='none'
  const makeMockCtx = () => {
    const ops = [];
    return {
      ops,
      clearRect: (...a) => ops.push(['clearRect', ...a]),
      save: () => ops.push(['save']),
      restore: () => ops.push(['restore']),
      beginPath: () => ops.push(['beginPath']),
      closePath: () => ops.push(['closePath']),
      arc: (...a) => ops.push(['arc', ...a]),
      moveTo: (...a) => ops.push(['moveTo', ...a]),
      lineTo: (...a) => ops.push(['lineTo', ...a]),
      arcTo: (...a) => ops.push(['arcTo', ...a]),
      clip: () => ops.push(['clip']),
      fill: () => ops.push(['fill']),
      stroke: () => ops.push(['stroke']),
      fillRect: (...a) => ops.push(['fillRect', ...a]),
      drawImage: (...a) => ops.push(['drawImage', ...a]),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} })
    };
  };

  const mockImg = { naturalWidth: 256, naturalHeight: 256 };
  const ctxNone = makeMockCtx();
  TokenComposer.drawTokenComposition(ctxNone, mockImg, { size: 384, frame: 'none' });
  assert.equal(ctxNone.ops.filter((o) => o[0] === 'fill').length, 0, 'frame=none must not draw any coin rim');

  const ctxCircle = makeMockCtx();
  TokenComposer.drawTokenComposition(ctxCircle, mockImg, { size: 384, frame: 'circle', frameColor: '#d4a84f' });
  const arcOps = ctxCircle.ops.filter((o) => o[0] === 'arc');
  assert.ok(arcOps.length >= 3, 'framed circle should draw extruded base rim and face arcs');
  const firstArcY = arcOps[0][2];
  const faceArcY = arcOps[arcOps.length - 1][2];
  assert.ok(firstArcY > faceArcY + 4, `expected base coin rim cy (${firstArcY}) well below face cy (${faceArcY})`);
});

test('Service.updateTokenImage normalizes Drive URLs, supports undo, emits WORLD_SYNC, clears image, and enforces permissions', () => {
  const sent = [];
  const origSend = RealtimeBridge.send;
  RealtimeBridge.send = (payload) => sent.push(payload);

  try {
    Service.undoStack = [];
    Service.redoStack = [];
    Service.listeners = [];
    Service.state = createInitialState();
    Service.state.role = 'gm';
    Service.state.isHostGm = true;
    Service.state.tokens = [
      { id: 'tok-1', name: 'Hero', isAlly: true, x: 100, y: 100, imageUrl: 'data:image/webp;base64,OLD' }
    ];

    const updated = Service.updateTokenImage('tok-1', 'https://drive.google.com/file/d/abc123XYZ/view?usp=sharing');
    assert.ok(updated);
    assert.equal(updated.imageUrl, 'https://lh3.googleusercontent.com/d/abc123XYZ');
    assert.ok(sent.some((p) => p.kind === 'WORLD_SYNC'), 'updateTokenImage broadcasts WORLD_SYNC');

    // Undo restores previous image
    assert.equal(Service.undo(), true);
    assert.equal(Service.state.tokens[0].imageUrl, 'data:image/webp;base64,OLD');

    // Clearing image sets empty string
    Service.updateTokenImage('tok-1', '');
    assert.equal(Service.state.tokens[0].imageUrl, '');

    // Unauthorized player cannot update unassigned token
    Service.state.role = 'player';
    Service.state.isHostGm = false;
    Service.state.playerInvites = [{ id: 'inv-1', label: 'P1', tokenIds: [] }];
    Service.state.activeInviteId = 'inv-1';
    const blocked = Service.updateTokenImage('tok-1', 'data:image/webp;base64,HACK');
    assert.equal(blocked, null);
    assert.equal(Service.state.tokens[0].imageUrl, '');
  } finally {
    RealtimeBridge.send = origSend;
  }
});

test('Cache-busting ?v= tags are synchronized uniformly across HTML, JS, and tests', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const collectFiles = (dir, exts) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectFiles(full, exts));
      else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
    return out;
  };

  const files = [
    path.join(root, 'index.html'),
    ...collectFiles(path.join(root, 'js'), ['.js']),
    ...collectFiles(path.join(root, 'tests'), ['.mjs'])
  ];

  const versions = new Set();
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.matchAll(/\?v=([a-zA-Z0-9_-]+)/g);
    for (const m of matches) {
      versions.add(m[1]);
    }
  }
  assert.deepEqual([...versions], ['20261125a1']);
});
