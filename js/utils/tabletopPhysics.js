/* ==========================================================================
   TABLETOP PHYSICS: PURE 2.5D TOKEN PICK-UP, DRAG TILT & DROP KINEMATICS
   ========================================================================== */

export const PICKUP_LIFT_PX = 10;
export const PICKUP_SCALE = 1.075;
export const MAX_DRAG_TILT_DEG = 8.5;
export const DROP_BOUNCE_DURATION_MS = 210;
export const HEAVY_SHAKE_DURATION_MS = 160;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function finiteOr(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Computes smoothed opposing tilt angle (deg) from pointer drag velocity (px/s).
 * Moving right tilts counter-clockwise (negative deg) so the piece leans slightly back;
 * stopping smoothly springs the tilt back to 0.
 */
export function computeDragTilt(vxPxPerSec, vyPxPerSec = 0, prevTiltDeg = 0, dtSec = 1 / 60, opts = {}) {
  const prev = finiteOr(prevTiltDeg, 0);
  const dt = Math.max(0, finiteOr(dtSec, 0));
  if (dt <= 0) return Math.abs(prev) < 0.04 ? 0 : prev;

  const maxTilt = Math.max(1, finiteOr(opts.maxTiltDeg, MAX_DRAG_TILT_DEG));
  const gain = finiteOr(opts.velocityGain, 0.0085);
  const stiffness = finiteOr(opts.stiffness, 18);

  const vx = finiteOr(vxPxPerSec, 0);
  const vy = finiteOr(vyPxPerSec, 0);
  // Subtle diagonal influence so vertical-dominant drags feel gently alive without over-tilting
  const effectiveVel = vx + vy * 0.12 * (vx >= 0 ? 1 : -1);
  const target = clamp(-effectiveVel * gain, -maxTilt, maxTilt);

  const alpha = 1 - Math.exp(-Math.min(dt, 0.1) * stiffness);
  const next = prev + (target - prev) * alpha;
  if (Math.abs(target) < 0.02 && Math.abs(next) < 0.04) return 0;
  return Number(clamp(next, -maxTilt, maxTilt).toFixed(3));
}

/**
 * Maps token elevation (px) to pre-styled ground shadow transform & opacity.
 * Uses pure scale/offset/opacity so the browser never recomputes expensive blur filters per frame.
 */
export function computePickupShadow(liftPx = 0, opts = {}) {
  const lift = Math.max(0, finiteOr(liftPx, 0));
  const maxLift = Math.max(1, finiteOr(opts.maxLiftPx, PICKUP_LIFT_PX));
  const t = clamp(lift / maxLift, 0, 1.5);

  const baseOffsetY = finiteOr(opts.baseOffsetY, 3);
  const offsetX = Number((t * 1.8).toFixed(2));
  const offsetY = Number((baseOffsetY + lift * 1.15).toFixed(2));
  const scaleX = Number((0.94 + t * 0.14).toFixed(3));
  const scaleY = Number((0.88 + t * 0.14).toFixed(3));
  const opacity = Number(clamp(0.44 - t * 0.18, 0.18, 0.5).toFixed(3));

  return { offsetX, offsetY, scaleX, scaleY, opacity };
}

/**
 * Samples the drop landing animation: fast fall -> subtle weight squash -> micro-rebound -> rest.
 */
export function sampleDropBounce(elapsedMs, opts = {}) {
  const duration = Math.max(60, finiteOr(opts.durationMs, DROP_BOUNCE_DURATION_MS));
  const startLift = Math.max(0, finiteOr(opts.startLiftPx, PICKUP_LIFT_PX));
  const startScale = Math.max(1, finiteOr(opts.startScale, PICKUP_SCALE));
  const size = Math.max(0.5, finiteOr(opts.size, 1));
  const t = clamp(finiteOr(elapsedMs, duration) / duration, 0, 1);

  if (t >= 1) {
    return {
      liftPx: 0,
      scale: 1,
      shadow: computePickupShadow(0),
      done: true
    };
  }

  // Larger creatures compress slightly heavier and rebound slightly lower
  const weightFactor = clamp((size - 1) * 0.35, 0, 1);
  const squashScale = 0.956 - weightFactor * 0.024;
  const reboundLift = Math.max(1.1, 2.35 - weightFactor * 0.65);
  const reboundScale = 1.022 - weightFactor * 0.006;

  let liftPx = 0;
  let scale = 1;

  if (t < 0.28) {
    // Phase 1: rapid downward drop + landing compression
    const u = t / 0.28;
    const easeIn = u * u;
    liftPx = startLift * (1 - easeIn);
    if (u < 0.72) {
      const su = u / 0.72;
      scale = startScale + (1 - startScale) * (su * su);
    } else {
      const su = (u - 0.72) / 0.28;
      scale = 1 + (squashScale - 1) * Math.sin(su * Math.PI * 0.5);
    }
    if (u >= 0.98) liftPx = 0;
  } else if (t < 0.62) {
    // Phase 2: micro-rebound off the tabletop
    const u = (t - 0.28) / 0.34;
    const arc = Math.sin(u * Math.PI);
    liftPx = reboundLift * arc;
    if (u < 0.5) {
      const su = u / 0.5;
      scale = squashScale + (reboundScale - squashScale) * Math.sin(su * Math.PI * 0.5);
    } else {
      const su = (u - 0.5) / 0.5;
      scale = reboundScale + (1 - reboundScale) * (su * su);
    }
  } else {
    // Phase 3: damped final settle
    const u = (t - 0.62) / 0.38;
    const settle = Math.sin(u * Math.PI) * (1 - u);
    liftPx = 0;
    scale = 1 - settle * (0.012 + weightFactor * 0.008);
  }

  const cleanLift = Number(Math.max(0, liftPx).toFixed(2));
  const cleanScale = Number(scale.toFixed(4));
  return {
    liftPx: cleanLift,
    scale: cleanScale,
    shadow: computePickupShadow(cleanLift),
    done: false
  };
}

/**
 * Computes a subtle damped camera micro-shake when dropping large/colossal tokens (size >= 2).
 */
export function computeHeavyLandingShake(tokenSize, elapsedMs, opts = {}) {
  const size = finiteOr(tokenSize, 1);
  if (size < 2) return { x: 0, y: 0, done: true };

  const duration = Math.max(60, finiteOr(opts.durationMs, HEAVY_SHAKE_DURATION_MS));
  const elapsed = finiteOr(elapsedMs, duration);
  if (elapsed < 0 || elapsed >= duration) return { x: 0, y: 0, done: true };

  const t = elapsed / duration;
  const amp = clamp(1.15 + (size - 2) * 0.65, 1.15, 2.75);
  const decay = Math.pow(1 - t, 1.85);
  const y = Math.sin(t * Math.PI * 3.2) * amp * decay;
  const x = Math.cos(t * Math.PI * 2.4) * (amp * 0.38) * decay;

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    done: false
  };
}
