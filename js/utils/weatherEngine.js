/**
 * Perspective-aware Canvas 2D weather particle engine.
 * Supports both 'tactical' (top-down) and 'narrative' (eye-level) scenes.
 * Pure JS, zero DOM access.
 */

export const WEATHER_PRESETS = ['none', 'rain', 'snow', 'embers', 'mist'];

export const WEATHER_META = [
  { id: 'none', icon: '○', label: 'Sin' },
  { id: 'rain', icon: '🌧', label: 'Lluvia' },
  { id: 'snow', icon: '❄️', label: 'Nieve' },
  { id: 'embers', icon: '🔥', label: 'Brasas' },
  { id: 'mist', icon: '🌫', label: 'Bruma' }
];

export function normalizeWeatherType(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return WEATHER_PRESETS.includes(key) ? key : 'none';
}

export function resolveWeatherFrameBudget(weather, { fpsScale = 1 } = {}) {
  const wType = normalizeWeatherType(weather);
  const scale = Math.min(1, Math.max(0.4, Number(fpsScale) || 1));
  if (wType === 'mist' || wType === 'snow') {
    if (scale === 1) return { targetFps: 30, minFrameMs: 33, maxDpr: 1 };
    const targetFps = Math.max(15, Math.round(30 * scale));
    return { targetFps, minFrameMs: Math.round(1000 / targetFps), maxDpr: 1 };
  }
  if (wType === 'rain' || wType === 'embers') {
    if (scale === 1) return { targetFps: 45, minFrameMs: 22, maxDpr: 1 };
    const targetFps = Math.max(15, Math.round(45 * scale));
    return { targetFps, minFrameMs: Math.round(1000 / targetFps), maxDpr: 1 };
  }
  return { targetFps: 0, minFrameMs: 1000, maxDpr: 1 };
}

export function createWeatherSimulation({
  weather = 'none',
  mode = 'tactical',
  width = 1280,
  height = 800,
  rng = Math.random,
  densityScale = 1
} = {}) {
  const wType = normalizeWeatherType(weather);
  const wMode = mode === 'narrative' ? 'narrative' : 'tactical';
  const w = Math.max(1, Number(width) || 1280);
  const h = Math.max(1, Number(height) || 800);
  const dScale = Math.min(1, Math.max(0.25, Number(densityScale) || 1));
  const scaleCount = (n) => Math.max(1, Math.round(n * dScale));
  const particles = [];

  if (wType === 'none') {
    return { weather: wType, mode: wMode, width: w, height: h, time: 0, particles };
  }

  if (wType === 'rain') {
    if (wMode === 'tactical') {
      // Steep top-down streaks + ground splash ripples
      const streakCount = scaleCount(55);
      for (let i = 0; i < streakCount; i++) {
        const vx = -110 - rng() * 50;
        const vy = 520 + rng() * 240;
        const len = 10 + rng() * 10;
        const mag = Math.hypot(vx, vy) || 1;
        particles.push({
          kind: 'streak',
          x: rng() * w,
          y: rng() * h,
          vx,
          vy,
          len,
          dx: (vx / mag) * len,
          dy: (vy / mag) * len,
          alpha: 0.14 + rng() * 0.16,
          lw: 1.1
        });
      }
      const rippleCount = scaleCount(24);
      for (let i = 0; i < rippleCount; i++) {
        particles.push({
          kind: 'ripple',
          x: rng() * w,
          y: rng() * h,
          vx: 0,
          vy: 0,
          r: rng() * 14,
          maxR: 12 + rng() * 14,
          speed: 22 + rng() * 18,
          alpha: 0.25
        });
      }
    } else {
      // Eye-level parallax rain
      const streakCount = scaleCount(95);
      for (let i = 0; i < streakCount; i++) {
        const depth = 0.45 + rng() * 0.55;
        const vx = -(90 + rng() * 45) * depth;
        const vy = (680 + rng() * 340) * depth;
        const len = 18 + 26 * depth;
        const mag = Math.hypot(vx, vy) || 1;
        particles.push({
          kind: 'streak',
          x: rng() * w,
          y: rng() * h,
          vx,
          vy,
          len,
          dx: (vx / mag) * len,
          dy: (vy / mag) * len,
          alpha: 0.12 + 0.2 * depth,
          lw: 0.9 + 0.7 * depth
        });
      }
    }
  } else if (wType === 'snow') {
    const count = scaleCount(wMode === 'tactical' ? 65 : 80);
    for (let i = 0; i < count; i++) {
      const depth = wMode === 'tactical' ? 0.65 + rng() * 0.5 : 0.4 + rng() * 0.7;
      particles.push({
        kind: 'flake',
        x: rng() * w,
        y: rng() * h,
        vx: (wMode === 'tactical' ? (rng() - 0.5) * 26 : 18 + rng() * 28) * depth,
        vy: (wMode === 'tactical' ? 28 + rng() * 32 : 46 + rng() * 58) * depth,
        r: (1.6 + rng() * 2.8) * depth,
        alpha: 0.22 + 0.32 * depth,
        phase: rng() * Math.PI * 2
      });
    }
  } else if (wType === 'embers') {
    const count = scaleCount(wMode === 'tactical' ? 45 : 55);
    for (let i = 0; i < count; i++) {
      const warm = rng() > 0.35;
      if (wMode === 'narrative') {
        particles.push({
          kind: 'ember',
          x: rng() * w,
          y: h * (0.35 + rng() * 0.65),
          vx: (rng() - 0.5) * 24,
          vy: -(38 + rng() * 58),
          r: 1.4 + rng() * 2.2,
          alpha: 0.45 + rng() * 0.45,
          phase: rng() * Math.PI * 2,
          color: warm ? '251, 146, 60' : '253, 224, 71'
        });
      } else {
        // Top-down wind drift
        particles.push({
          kind: 'ember',
          x: rng() * w,
          y: rng() * h,
          vx: 22 + rng() * 38,
          vy: (rng() - 0.5) * 24,
          r: 1.5 + rng() * 2.2,
          alpha: 0.4 + rng() * 0.45,
          phase: rng() * Math.PI * 2,
          color: warm ? '251, 146, 60' : '253, 224, 71'
        });
      }
    }
  } else if (wType === 'mist') {
    const isNar = wMode === 'narrative';
    const wispCount = scaleCount(isNar ? 14 : 16);
    for (let i = 0; i < wispCount; i++) {
      particles.push({
        kind: 'mist',
        x: rng() * w,
        y: isNar ? h * (0.45 + rng() * 0.5) : rng() * h,
        vx: isNar ? 48 + rng() * 46 : 36 + rng() * 36,
        vy: isNar ? 0 : (rng() - 0.5) * 18,
        rx: isNar ? 220 + rng() * 200 : 160 + rng() * 160,
        ry: isNar ? 70 + rng() * 65 : 120 + rng() * 110,
        alpha: (isNar ? 0.1 : 0.09) + rng() * 0.07,
        phase: rng() * Math.PI * 2
      });
    }
    const gustCount = scaleCount(isNar ? 16 : 14);
    for (let i = 0; i < gustCount; i++) {
      particles.push({
        kind: 'gust',
        x: rng() * w,
        y: isNar ? h * (0.2 + rng() * 0.72) : rng() * h,
        vx: isNar ? 120 + rng() * 90 : 95 + rng() * 70,
        vy: isNar ? (rng() - 0.5) * 8 : (rng() - 0.5) * 16,
        len: 90 + rng() * 140,
        lw: 1.2 + rng() * 1.6,
        alpha: 0.08 + rng() * 0.08,
        phase: rng() * Math.PI * 2
      });
    }
  }

  return { weather: wType, mode: wMode, width: w, height: h, time: 0, particles };
}

export function stepWeatherSimulation(sim, dtSec = 0.016) {
  if (!sim || !Array.isArray(sim.particles) || sim.particles.length === 0) return;
  const dt = Math.min(0.05, Math.max(0.001, Number(dtSec) || 0.016));
  sim.time = (sim.time || 0) + dt;
  const w = sim.width || 1280;
  const h = sim.height || 800;

  for (let i = 0; i < sim.particles.length; i++) {
    const p = sim.particles[i];
    if (p.kind === 'ripple') {
      p.r += p.speed * dt;
      if (p.r >= p.maxR) {
        p.r = 0.5;
        p.x = ((p.x + 173) % w + w) % w;
        p.y = ((p.y + 97) % h + h) % h;
      }
      continue;
    }

    if (p.kind === 'mist' || p.kind === 'gust') {
      const waveY = Math.sin(sim.time * 1.4 + p.phase) * 10;
      p.x += p.vx * dt;
      p.y += (p.vy + waveY) * dt;
      const pad = p.rx || p.len || 200;
      if (p.x > w + pad) p.x = -pad;
      else if (p.x < -pad) p.x = w + pad;
      if (p.y > h + pad) p.y = -pad;
      else if (p.y < -pad) p.y = h + pad;
    } else {
      const sway = p.phase !== undefined ? Math.sin(sim.time * 1.8 + p.phase) * 14 : 0;
      p.x += (p.vx + sway) * dt;
      p.y += p.vy * dt;
      if (p.x < -20) p.x = w + 15;
      else if (p.x > w + 20) p.x = -15;
      if (p.y > h + 20) p.y = -15;
      else if (p.y < -20) p.y = h + 15;
    }
  }
}

export function drawWeatherSimulation(ctx, sim, opts = {}) {
  if (!ctx || !sim || !Array.isArray(sim.particles) || sim.particles.length === 0) return;
  const w = sim.width || 1280;
  const h = sim.height || 800;
  ctx.clearRect(0, 0, w, h);
  const sprites = opts?.sprites || null;

  if (sim.weather === 'rain') {
    ctx.save();
    ctx.lineCap = 'round';
    const streakAlphas = ['0.16', '0.24', '0.32'];
    const streakBuckets = [[], [], []];
    const rippleAlphas = ['0.07', '0.15', '0.23'];
    const rippleBuckets = [[], [], []];

    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      if (p.kind === 'ripple') {
        const life = Math.max(0, 1 - p.r / (p.maxR || 16));
        const idx = life < 0.34 ? 0 : life < 0.68 ? 1 : 2;
        rippleBuckets[idx].push(p);
      } else {
        const idx = p.alpha < 0.20 ? 0 : p.alpha < 0.27 ? 1 : 2;
        streakBuckets[idx].push(p);
      }
    }

    ctx.lineWidth = sim.mode === 'narrative' ? 1.25 : 1.1;
    for (let b = 0; b < 3; b++) {
      const list = streakBuckets[b];
      if (list.length === 0) continue;
      ctx.strokeStyle = `rgba(203, 213, 225, ${streakAlphas[b]})`;
      ctx.beginPath();
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        let dx = p.dx;
        let dy = p.dy;
        if (dx === undefined || dy === undefined) {
          const mag = Math.hypot(p.vx, p.vy) || 1;
          dx = (p.vx / mag) * p.len;
          dy = (p.vy / mag) * p.len;
        }
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx, p.y + dy);
      }
      ctx.stroke();
    }

    ctx.lineWidth = 1;
    for (let b = 0; b < 3; b++) {
      const list = rippleBuckets[b];
      if (list.length === 0) continue;
      ctx.strokeStyle = `rgba(186, 230, 253, ${rippleAlphas[b]})`;
      ctx.beginPath();
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (sim.weather === 'snow') {
    ctx.save();
    const snowAlphas = ['0.26', '0.40', '0.54'];
    const snowBuckets = [[], [], []];
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      const idx = p.alpha < 0.33 ? 0 : p.alpha < 0.47 ? 1 : 2;
      snowBuckets[idx].push(p);
    }
    for (let b = 0; b < 3; b++) {
      const list = snowBuckets[b];
      if (list.length === 0) continue;
      ctx.fillStyle = `rgba(241, 245, 249, ${snowAlphas[b]})`;
      ctx.beginPath();
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (sim.weather === 'embers') {
    ctx.save();
    const useSprites = Boolean(sprites?.emberWarm && sprites?.emberGold);
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      const pulse = 0.72 + 0.28 * Math.sin((sim.time || 0) * 5 + p.phase);
      const a = Math.min(1, p.alpha * pulse);
      if (useSprites) {
        const sprite = p.color === '253, 224, 71' ? sprites.emberGold : sprites.emberWarm;
        const drawR = p.r * 2.6;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, p.x - drawR, p.y - drawR, drawR * 2, drawR * 2);
      } else {
        ctx.fillStyle = `rgba(${p.color}, ${(a * 0.28).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${p.color}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  if (sim.weather === 'mist') {
    ctx.save();
    const useSprites = Boolean(sprites?.mistWisp && sprites?.mistGust);
    ctx.lineCap = 'round';
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      if (p.kind === 'gust') {
        if (useSprites) {
          const halfH = Math.max(2, (p.lw || 1.5) * 1.5);
          ctx.globalAlpha = p.alpha;
          ctx.drawImage(sprites.mistGust, p.x, p.y - halfH, p.len, halfH * 2);
        } else {
          const x1 = p.x;
          const x2 = p.x + p.len;
          const grad = ctx.createLinearGradient(x1, p.y, x2, p.y);
          grad.addColorStop(0, 'rgba(226, 232, 240, 0)');
          grad.addColorStop(0.5, `rgba(226, 232, 240, ${p.alpha.toFixed(3)})`);
          grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = p.lw || 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, p.y);
          ctx.lineTo(x2, p.y);
          ctx.stroke();
        }
        continue;
      }
      if (useSprites) {
        const rx = p.rx || 180;
        const ry = p.ry || 120;
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(sprites.mistWisp, p.x - rx, p.y - ry, rx * 2, ry * 2);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, (p.ry || 120) / (p.rx || 180));
        const r = p.rx || 180;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, `rgba(203, 213, 225, ${p.alpha.toFixed(3)})`);
        grad.addColorStop(1, 'rgba(203, 213, 225, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
