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

export function createWeatherSimulation({
  weather = 'none',
  mode = 'tactical',
  width = 1280,
  height = 800,
  rng = Math.random
} = {}) {
  const wType = normalizeWeatherType(weather);
  const wMode = mode === 'narrative' ? 'narrative' : 'tactical';
  const w = Math.max(1, Number(width) || 1280);
  const h = Math.max(1, Number(height) || 800);
  const particles = [];

  if (wType === 'none') {
    return { weather: wType, mode: wMode, width: w, height: h, time: 0, particles };
  }

  if (wType === 'rain') {
    if (wMode === 'tactical') {
      // Steep top-down streaks + ground splash ripples
      for (let i = 0; i < 55; i++) {
        particles.push({
          kind: 'streak',
          x: rng() * w,
          y: rng() * h,
          vx: -110 - rng() * 50,
          vy: 520 + rng() * 240,
          len: 10 + rng() * 10,
          alpha: 0.14 + rng() * 0.16,
          lw: 1.1
        });
      }
      for (let i = 0; i < 24; i++) {
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
      for (let i = 0; i < 95; i++) {
        const depth = 0.45 + rng() * 0.55;
        particles.push({
          kind: 'streak',
          x: rng() * w,
          y: rng() * h,
          vx: -(90 + rng() * 45) * depth,
          vy: (680 + rng() * 340) * depth,
          len: 18 + 26 * depth,
          alpha: 0.12 + 0.2 * depth,
          lw: 0.9 + 0.7 * depth
        });
      }
    }
  } else if (wType === 'snow') {
    const count = wMode === 'tactical' ? 65 : 80;
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
    const count = wMode === 'tactical' ? 45 : 55;
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
    const wispCount = isNar ? 14 : 16;
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
    const gustCount = isNar ? 16 : 14;
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

export function drawWeatherSimulation(ctx, sim) {
  if (!ctx || !sim || !Array.isArray(sim.particles) || sim.particles.length === 0) return;
  const w = sim.width || 1280;
  const h = sim.height || 800;
  ctx.clearRect(0, 0, w, h);

  if (sim.weather === 'rain') {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      if (p.kind === 'ripple') {
        const life = Math.max(0, 1 - p.r / (p.maxR || 16));
        ctx.strokeStyle = `rgba(186, 230, 253, ${(p.alpha * life).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const mag = Math.hypot(p.vx, p.vy) || 1;
        const dx = (p.vx / mag) * p.len;
        const dy = (p.vy / mag) * p.len;
        ctx.strokeStyle = `rgba(203, 213, 225, ${p.alpha.toFixed(3)})`;
        ctx.lineWidth = p.lw || 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx, p.y + dy);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (sim.weather === 'snow') {
    ctx.save();
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      ctx.fillStyle = `rgba(241, 245, 249, ${p.alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (sim.weather === 'embers') {
    ctx.save();
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      const pulse = 0.72 + 0.28 * Math.sin((sim.time || 0) * 5 + p.phase);
      const a = Math.min(1, p.alpha * pulse);
      ctx.fillStyle = `rgba(${p.color}, ${(a * 0.28).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${p.color}, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (sim.weather === 'mist') {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      if (p.kind === 'gust') {
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
        continue;
      }
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
    ctx.restore();
  }
}
