import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PICKUP_LIFT_PX,
  PICKUP_SCALE,
  MAX_DRAG_TILT_DEG,
  DROP_BOUNCE_DURATION_MS,
  computeDragTilt,
  computePickupShadow,
  sampleDropBounce,
  computeHeavyLandingShake
} = await import('../js/utils/tabletopPhysics.js?v=20261123a7');

test('computeDragTilt leans opposite to horizontal drag velocity, clamps extreme speed, and recovers smoothly to 0', () => {
  const rightTilt = computeDragTilt(900, 0, 0, 1 / 60);
  assert.ok(rightTilt < 0, `expected negative tilt when moving right, got ${rightTilt}`);
  assert.ok(Math.abs(rightTilt) <= MAX_DRAG_TILT_DEG);

  const leftTilt = computeDragTilt(-900, 0, 0, 1 / 60);
  assert.ok(leftTilt > 0, `expected positive tilt when moving left, got ${leftTilt}`);
  assert.ok(Math.abs(leftTilt) <= MAX_DRAG_TILT_DEG);

  // Sustained extreme velocity stays clamped within MAX_DRAG_TILT_DEG
  let extreme = 0;
  for (let i = 0; i < 60; i++) {
    extreme = computeDragTilt(50000, 10000, extreme, 1 / 60);
  }
  assert.ok(extreme >= -MAX_DRAG_TILT_DEG - 1e-6 && extreme <= MAX_DRAG_TILT_DEG + 1e-6);
  assert.ok(Math.abs(extreme) > MAX_DRAG_TILT_DEG * 0.9);

  // Stopping decays back toward 0 and eventually snaps cleanly to 0
  let settled = extreme;
  for (let i = 0; i < 45; i++) {
    settled = computeDragTilt(0, 0, settled, 1 / 60);
  }
  assert.equal(settled, 0);

  // Invalid inputs never produce NaN
  const safe = computeDragTilt(NaN, undefined, NaN, 0);
  assert.equal(Number.isFinite(safe), true);
  assert.equal(safe, 0);
});

test('computePickupShadow separates downward, widens slightly, and softens opacity as lift rises', () => {
  const rest = computePickupShadow(0);
  const lifted = computePickupShadow(PICKUP_LIFT_PX);
  const clampedNeg = computePickupShadow(-5);

  assert.deepEqual(clampedNeg, rest);
  assert.ok(lifted.offsetY > rest.offsetY, 'lifted shadow should drop further below token');
  assert.ok(lifted.scaleX > rest.scaleX, 'lifted shadow should widen slightly');
  assert.ok(lifted.scaleY > rest.scaleY, 'lifted shadow should grow slightly vertically');
  assert.ok(lifted.opacity < rest.opacity, 'lifted shadow should soften in opacity');
  assert.ok(lifted.opacity > 0.15, 'lifted shadow should remain visible');
});

test('sampleDropBounce transitions from lifted pickup through impact squash and micro-rebound to exact rest', () => {
  const start = sampleDropBounce(0, { size: 1, startLiftPx: PICKUP_LIFT_PX, startScale: PICKUP_SCALE });
  assert.equal(start.done, false);
  assert.ok(start.liftPx > 0);
  assert.ok(start.scale > 1);

  const impact = sampleDropBounce(DROP_BOUNCE_DURATION_MS * 0.28, { size: 1 });
  assert.equal(impact.done, false);
  assert.equal(impact.liftPx, 0);
  assert.ok(impact.scale < 1, `expected squash below 1 at impact, got ${impact.scale}`);

  const heavyImpact = sampleDropBounce(DROP_BOUNCE_DURATION_MS * 0.28, { size: 3 });
  assert.ok(heavyImpact.scale < impact.scale, 'larger token should show slightly heavier landing squash');

  const rebound = sampleDropBounce(DROP_BOUNCE_DURATION_MS * 0.46, { size: 1 });
  assert.equal(rebound.done, false);
  assert.ok(rebound.liftPx > 0, 'expected subtle upward micro-rebound');
  assert.ok(rebound.scale > 1, 'expected slight scale rebound above 1');

  const end = sampleDropBounce(DROP_BOUNCE_DURATION_MS, { size: 1 });
  assert.equal(end.done, true);
  assert.equal(end.liftPx, 0);
  assert.equal(end.scale, 1);
  assert.deepEqual(end.shadow, computePickupShadow(0));
});

test('computeHeavyLandingShake only triggers for large tokens (size >= 2), caps amplitude, and settles to zero', () => {
  const smallMid = computeHeavyLandingShake(1, 25);
  assert.deepEqual(smallMid, { x: 0, y: 0, done: true });

  const medLargeMid = computeHeavyLandingShake(1.5, 25);
  assert.deepEqual(medLargeMid, { x: 0, y: 0, done: true });

  const largeMid = computeHeavyLandingShake(2, 24);
  assert.equal(largeMid.done, false);
  assert.ok(Math.hypot(largeMid.x, largeMid.y) > 0.1, 'size 2 token should produce subtle micro-shake');
  assert.ok(Math.hypot(largeMid.x, largeMid.y) <= 3.0, 'shake amplitude must stay subtle');

  const colossalMid = computeHeavyLandingShake(4, 24);
  assert.equal(colossalMid.done, false);
  assert.ok(Math.hypot(colossalMid.x, colossalMid.y) > Math.hypot(largeMid.x, largeMid.y));
  assert.ok(Math.hypot(colossalMid.x, colossalMid.y) <= 3.2, 'even colossal shake must remain tactically clean');

  const done = computeHeavyLandingShake(4, 220);
  assert.deepEqual(done, { x: 0, y: 0, done: true });
});
