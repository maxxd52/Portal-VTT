import test from 'node:test';
import assert from 'node:assert/strict';

const {
  DEFAULT_DICE_SHADOW_DIR,
  DEFAULT_BOARD_SHADOW_DIR,
  SCENE_ATMOSPHERE_PRESETS,
  resolveSceneAtmosphere,
  blendRgbToAtmosphere,
  stepCameraInertia,
  stepSmoothZoom
} = await import('../js/utils/sceneAtmosphere.js?v=20261121a6');

test('resolveSceneAtmosphere returns distinct atmospheric palettes for presets and aligns board/dice shadow direction', () => {
  const tavern = resolveSceneAtmosphere('tavern');
  const crypt = resolveSceneAtmosphere('crypt');
  const unknown = resolveSceneAtmosphere('nonexistent');

  assert.ok(SCENE_ATMOSPHERE_PRESETS.tavern);
  assert.ok(SCENE_ATMOSPHERE_PRESETS.crypt);
  assert.notEqual(tavern.keyHex, crypt.keyHex);
  assert.notEqual(tavern.fillHex, crypt.fillHex);

  // Tavern is warmer (red > blue), Crypt is cooler (blue >= red)
  const redOf = (hex) => (hex >> 16) & 255;
  const blueOf = (hex) => hex & 255;
  assert.ok(redOf(tavern.keyHex) > blueOf(tavern.keyHex), 'tavern key light should be warm');
  assert.ok(blueOf(crypt.keyHex) >= redOf(crypt.keyHex), 'crypt key light should be cool');

  // Board shadow Y is inverted relative to Three.js Y-up dice shadow Y, X stays aligned
  assert.equal(tavern.diceShadowDir.x, DEFAULT_DICE_SHADOW_DIR.x);
  assert.equal(tavern.boardShadowDir.x, DEFAULT_BOARD_SHADOW_DIR.x);
  assert.equal(Math.sign(tavern.boardShadowDir.y), -Math.sign(tavern.diceShadowDir.y));
  assert.ok(unknown.keyHex > 0);
});

test('blendRgbToAtmosphere tints custom scene lighting subtly and falls back safely on invalid/CORS input', () => {
  const fallback = resolveSceneAtmosphere('custom', null);
  assert.equal(fallback.keyHex, SCENE_ATMOSPHERE_PRESETS.bastion.keyHex);

  const warmMap = resolveSceneAtmosphere('custom', { r: 220, g: 120, b: 40 });
  const coolMap = resolveSceneAtmosphere('custom', { r: 30, g: 90, b: 210 });
  const redOf = (hex) => (hex >> 16) & 255;
  const blueOf = (hex) => hex & 255;

  assert.ok(redOf(warmMap.keyHex) > blueOf(warmMap.keyHex));
  assert.ok(blueOf(coolMap.keyHex) > redOf(coolMap.keyHex));
  // Key light stays bright enough for legible 3D dice numbers
  assert.ok(redOf(coolMap.keyHex) > 150 && blueOf(warmMap.keyHex) > 130);

  // Invalid RGB falls back safely
  const safe = blendRgbToAtmosphere({ r: NaN, g: -10, b: 'x' });
  assert.equal(safe.keyHex, SCENE_ATMOSPHERE_PRESETS.bastion.keyHex);
});

test('stepCameraInertia decays velocity exponentially and stops cleanly below threshold', () => {
  let vx = 900;
  let vy = -600;
  let totalDx = 0;
  let totalDy = 0;
  let done = false;

  for (let i = 0; i < 120; i++) {
    const res = stepCameraInertia(vx, vy, 1 / 60);
    totalDx += res.dx;
    totalDy += res.dy;
    vx = res.vx;
    vy = res.vy;
    done = res.done;
    if (done) break;
  }

  assert.equal(done, true);
  assert.equal(vx, 0);
  assert.equal(vy, 0);
  assert.ok(totalDx > 50, 'should glide positively in X');
  assert.ok(totalDy < -30, 'should glide negatively in Y');

  const instantStop = stepCameraInertia(5, -4, 1 / 60);
  assert.deepEqual(instantStop, { dx: 0, dy: 0, vx: 0, vy: 0, done: true });
});

test('stepSmoothZoom interpolates toward clamped target zoom while keeping world anchor pinned', () => {
  let cam = { x: 100, y: 50, zoom: 1.0 };
  const anchorX = 640;
  const anchorY = 360;
  const worldBefore = {
    x: (anchorX - cam.x) / cam.zoom,
    y: (anchorY - cam.y) / cam.zoom
  };

  let done = false;
  for (let i = 0; i < 90; i++) {
    const next = stepSmoothZoom(cam, 1.5, anchorX, anchorY, 1 / 60);
    cam = { x: next.x, y: next.y, zoom: next.zoom };
    done = next.done;
    if (done) break;
  }

  assert.equal(done, true);
  assert.ok(Math.abs(cam.zoom - 1.5) < 1e-4);
  const worldAfter = {
    x: (anchorX - cam.x) / cam.zoom,
    y: (anchorY - cam.y) / cam.zoom
  };
  assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 0.05, 'world X under cursor must remain pinned');
  assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 0.05, 'world Y under cursor must remain pinned');

  // Target zoom clamps to [0.35, 2.2]
  const clampedHigh = stepSmoothZoom({ x: 0, y: 0, zoom: 2.199 }, 5.0, 0, 0, 0.2);
  assert.equal(clampedHigh.zoom, 2.2);
  const clampedLow = stepSmoothZoom({ x: 0, y: 0, zoom: 0.351 }, 0.05, 0, 0, 0.2);
  assert.equal(clampedLow.zoom, 0.35);
});
