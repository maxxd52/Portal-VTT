/* ==========================================================================
   TOKEN PHYSICS VIEW: CLIENT-SIDE 2.5D PICK-UP, TILT, DROP BOUNCE & SHAKE
   ========================================================================== */

import {
  PICKUP_LIFT_PX,
  PICKUP_SCALE,
  DROP_BOUNCE_DURATION_MS,
  computeDragTilt,
  computePickupShadow,
  sampleDropBounce,
  computeHeavyLandingShake
} from '../utils/tabletopPhysics.js?v=20261123a7';
import {
  resolveSceneAtmosphere,
  stepCameraInertia,
  stepSmoothZoom
} from '../utils/sceneAtmosphere.js?v=20261123a7';
import {
  buildShadowCacheKey,
  computeContactShadowModulation,
  computeTokenCastShadow,
  resolveDynamicShadowMode
} from '../utils/tokenShadowModel.js?v=20261123a7';
import { Dice3DEngine } from '../services/dice3dEngine.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';

const SHADOW_MODE_STORAGE_KEY = 'portal_shadow_mode_v1';

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export const TokenPhysicsViewMethods = {
  _ensureTokenPhysicsStore() {
    if (!this._tokenPhys) {
      this._tokenPhys = {
        drag: null, // { tokenId, lastClientX, lastClientY, lastSampleMs, vx, vy, tiltDeg, liftPx, scale }
        drops: new Map(), // tokenId -> { startedAt, size, startLiftPx, startScale, liftPx, scale, shadow }
        shake: null, // { startedAt, size }
        camPanSample: null, // { x, y, t, vx, vy }
        camInertia: null, // { vx, vy }
        camZoom: null, // { targetZoom, anchorX, anchorY }
        rafId: null,
        lastFrameMs: 0
      };
    }
    return this._tokenPhys;
  },

  stopCameraMotion() {
    const store = this._tokenPhys;
    if (!store) return;
    store.camPanSample = null;
    store.camInertia = null;
    store.camZoom = null;
  },

  recordCameraPanSample(clientX, clientY) {
    const store = this._ensureTokenPhysicsStore();
    store.camInertia = null;
    const t = nowMs();
    const prev = store.camPanSample;
    if (prev) {
      const dtSec = Math.max(0.004, Math.min(0.08, (t - prev.t) / 1000));
      const vx = (clientX - prev.x) / dtSec;
      const vy = (clientY - prev.y) / dtSec;
      store.camPanSample = {
        x: clientX,
        y: clientY,
        t,
        vx: prev.vx * 0.45 + vx * 0.55,
        vy: prev.vy * 0.45 + vy * 0.55
      };
    } else {
      store.camPanSample = { x: clientX, y: clientY, t, vx: 0, vy: 0 };
    }
  },

  releaseCameraPanInertia() {
    const store = this._tokenPhys;
    if (!store?.camPanSample) return;
    const sample = store.camPanSample;
    store.camPanSample = null;
    // Only glide if pointer was still moving just before release
    if (nowMs() - sample.t > 75) return;
    const speed = Math.hypot(sample.vx, sample.vy);
    if (speed < 45) return;
    const cap = 2200;
    const scale = speed > cap ? cap / speed : 1;
    store.camInertia = { vx: sample.vx * scale, vy: sample.vy * scale };
    this._scheduleTokenPhysicsLoop();
  },

  nudgeCameraZoom(factor, anchorX, anchorY) {
    if (typeof requestAnimationFrame !== 'function') {
      Service.setZoom(Service.state.camera.zoom * factor, anchorX, anchorY);
      return;
    }
    const store = this._ensureTokenPhysicsStore();
    store.camInertia = null;
    const baseZoom = store.camZoom ? store.camZoom.targetZoom : Service.state.camera.zoom;
    const maxZoom = typeof Service.getMaxCameraZoom === 'function' ? Service.getMaxCameraZoom() : 1.65;
    const nextTarget = Math.min(maxZoom, Math.max(0.35, baseZoom * factor));
    store.camZoom = { targetZoom: nextTarget, anchorX, anchorY };
    this._scheduleTokenPhysicsLoop();
  },

  sampleImageDominantRgb(imgEl) {
    if (!imgEl || !imgEl.complete || !(imgEl.naturalWidth > 0) || typeof document === 'undefined') return null;
    try {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(imgEl, 0, 0, 16, 16);
      const { data } = ctx.getImageData(0, 0, 16, 16);
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 32) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }
      if (!count) return null;
      return { r: r / count, g: g / count, b: b / count };
    } catch (_) {
      return null;
    }
  },

  syncSceneAtmosphere(state) {
    if (!state) return;
    const mapId = state.mapId || 'bastion';
    const theme = state.theme || 'slate';
    const imgSrc = mapId === 'custom' ? (state.customMapUrl || this.els?.customMapImg?.src || '') : '';
    const cacheKey = `${mapId}|${theme}|${imgSrc.slice(0, 80)}|${this.els?.customMapImg?.complete ? 1 : 0}`;
    if (this._lastAtmoKey === cacheKey) return;
    this._lastAtmoKey = cacheKey;

    const sampled = mapId === 'custom' ? this.sampleImageDominantRgb(this.els?.customMapImg) : null;
    const atmo = resolveSceneAtmosphere(mapId, sampled, theme);
    this._currentAtmosphere = atmo;
    Dice3DEngine.setSceneAtmosphere?.(atmo);
  },

  loadShadowMode() {
    let saved = 'auto';
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SHADOW_MODE_STORAGE_KEY) : '';
      if (raw === 'auto' || raw === 'on' || raw === 'off') saved = raw;
    } catch (_) {}
    this.shadowMode = saved;
    return saved;
  },

  setShadowMode(mode) {
    const clean = mode === 'on' || mode === 'off' ? mode : 'auto';
    this.shadowMode = clean;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(SHADOW_MODE_STORAGE_KEY, clean);
    } catch (_) {}
    this.syncShadowModeUi?.();
    this.drawWallShadowCanvas?.(Service.state);
    this.renderTokensLayer?.(Service.state);
    return clean;
  },

  isDynamicShadowsEnabled() {
    const mode = this.shadowMode || 'auto';
    const env = {
      prefersReducedMotion: prefersReducedMotion(),
      hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 8,
      deviceMemory: typeof navigator !== 'undefined' ? navigator.deviceMemory : 8,
      isCoarsePointer: typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false
    };
    return resolveDynamicShadowMode(mode, env);
  },

  applyTokenDualShadows(el, tok, { diameterPx, lightSources, walls, ambientDir } = {}) {
    if (!el || !tok) return;
    const enabled = this.isDynamicShadowsEnabled();
    const cacheKey = buildShadowCacheKey(tok, lightSources, walls, enabled);
    if (el.dataset.shadowKey === cacheKey) return;
    el.dataset.shadowKey = cacheKey;

    const cast = computeTokenCastShadow(tok, lightSources, walls, {
      diameterPx,
      ambientDir,
      dynamicShadowsEnabled: enabled
    });
    el.classList.toggle('has-cast-shadow', Boolean(cast.active));
    if (cast.active) {
      el.style.setProperty('--cast-x', `${cast.offsetX}px`);
      el.style.setProperty('--cast-y', `${cast.offsetY}px`);
      el.style.setProperty('--cast-rot', `${cast.angleDeg}deg`);
      el.style.setProperty('--cast-sx', String(cast.scaleX));
      el.style.setProperty('--cast-sy', String(cast.scaleY));
      el.style.setProperty('--cast-op', String(cast.opacity));
    } else {
      el.style.removeProperty('--cast-x');
      el.style.removeProperty('--cast-y');
      el.style.removeProperty('--cast-rot');
      el.style.removeProperty('--cast-sx');
      el.style.removeProperty('--cast-sy');
      el.style.removeProperty('--cast-op');
    }

    // Modulate grounded contact halo if token is flying (when not actively dragging/dropping)
    const store = this._tokenPhys;
    const activePhys = (store?.drag && store.drag.tokenId === tok.id) || store?.drops?.has(tok.id);
    if (!activePhys) {
      const contact = computeContactShadowModulation(tok, 0);
      this._applyShadowVars(el, contact);
    }
  },

  isTokenDropBouncing(tokenId) {
    return Boolean(tokenId && this._tokenPhys?.drops?.has(tokenId));
  },

  _findTokenDomNode(tokenId) {
    if (!tokenId || !this.els?.tokensLayer) return null;
    return this.els.tokensLayer.querySelector(`[data-token-id="${CSS.escape(tokenId)}"]`);
  },

  _applyShadowVars(el, shadow) {
    if (!el || !shadow) return;
    el.style.setProperty('--shadow-x', `${shadow.offsetX}px`);
    el.style.setProperty('--shadow-y', `${shadow.offsetY}px`);
    el.style.setProperty('--shadow-sx', String(shadow.scaleX));
    el.style.setProperty('--shadow-sy', String(shadow.scaleY));
    el.style.setProperty('--shadow-op', String(shadow.opacity));
  },

  _clearPhysicsVars(el) {
    if (!el) return;
    el.style.removeProperty('--lift-y');
    el.style.removeProperty('--drag-tilt');
    el.style.removeProperty('--phys-scale');
    el.style.removeProperty('--shadow-x');
    el.style.removeProperty('--shadow-y');
    el.style.removeProperty('--shadow-sx');
    el.style.removeProperty('--shadow-sy');
    el.style.removeProperty('--shadow-op');
    el.classList.remove('is-dropping');
  },

  applyTokenPhysicsToElement(el, tokenId, glideVis = null) {
    if (!el) return;
    const store = this._tokenPhys;

    if (store?.drag && store.drag.tokenId === tokenId) {
      const d = store.drag;
      el.classList.remove('is-dropping');
      el.style.setProperty('--lift-y', `${d.liftPx.toFixed(2)}px`);
      el.style.setProperty('--drag-tilt', `${d.tiltDeg.toFixed(2)}deg`);
      el.style.setProperty('--phys-scale', d.scale.toFixed(4));
      this._applyShadowVars(el, computePickupShadow(d.liftPx));
      return;
    }

    const drop = store?.drops?.get(tokenId);
    if (drop) {
      el.classList.add('is-dropping');
      el.style.setProperty('--lift-y', `${drop.liftPx.toFixed(2)}px`);
      el.style.setProperty('--drag-tilt', '0deg');
      el.style.setProperty('--phys-scale', drop.scale.toFixed(4));
      this._applyShadowVars(el, drop.shadow);
      return;
    }

    if (glideVis) {
      el.classList.remove('is-dropping');
      const lift = Number(glideVis.lift) || 0;
      const scale = Number(glideVis.scale) || 1;
      el.style.setProperty('--lift-y', `${lift.toFixed(2)}px`);
      el.style.setProperty('--drag-tilt', '0deg');
      el.style.setProperty('--phys-scale', scale.toFixed(4));
      this._applyShadowVars(el, computePickupShadow(lift));
      return;
    }

    this._clearPhysicsVars(el);
  },

  beginTokenDragPhysics(tokenId, clientX, clientY) {
    const store = this._ensureTokenPhysicsStore();
    store.drops.delete(tokenId);
    const t = nowMs();
    store.drag = {
      tokenId,
      lastClientX: clientX,
      lastClientY: clientY,
      lastSampleMs: t,
      vx: 0,
      vy: 0,
      tiltDeg: 0,
      liftPx: PICKUP_LIFT_PX,
      scale: PICKUP_SCALE
    };
    const el = this._findTokenDomNode(tokenId);
    if (el) {
      el.classList.add('is-dragging');
      this.applyTokenPhysicsToElement(el, tokenId);
    }
    this._scheduleTokenPhysicsLoop();
  },

  updateTokenDragPhysics(tokenId, clientX, clientY) {
    const store = this._tokenPhys;
    if (!store?.drag || store.drag.tokenId !== tokenId) return;
    const d = store.drag;
    const t = nowMs();
    const dtSec = Math.max(0.004, Math.min(0.08, (t - d.lastSampleMs) / 1000));
    const instVx = (clientX - d.lastClientX) / dtSec;
    const instVy = (clientY - d.lastClientY) / dtSec;
    // Smooth velocity slightly to absorb discrete mouse polling jitter
    d.vx = d.vx * 0.45 + instVx * 0.55;
    d.vy = d.vy * 0.45 + instVy * 0.55;
    d.lastClientX = clientX;
    d.lastClientY = clientY;
    d.lastSampleMs = t;
    this._scheduleTokenPhysicsLoop();
  },

  finishTokenDragPhysics(tokenId, tokenSize = 1, { wasDragged = true } = {}) {
    const store = this._ensureTokenPhysicsStore();
    const prevDrag = store.drag && store.drag.tokenId === tokenId ? store.drag : null;
    if (prevDrag) store.drag = null;

    const el = this._findTokenDomNode(tokenId);
    if (el) el.classList.remove('is-dragging');

    if (!wasDragged) {
      if (el) this._clearPhysicsVars(el);
      return;
    }

    const t = nowMs();
    const startLiftPx = prevDrag ? prevDrag.liftPx : PICKUP_LIFT_PX;
    const startScale = prevDrag ? prevDrag.scale : PICKUP_SCALE;
    const size = Number(tokenSize) || 1;
    const initial = sampleDropBounce(0, { size, startLiftPx, startScale });

    store.drops.set(tokenId, {
      startedAt: t,
      size,
      startLiftPx,
      startScale,
      liftPx: initial.liftPx,
      scale: initial.scale,
      shadow: initial.shadow
    });

    if (size >= 2 && !prefersReducedMotion()) {
      store.shake = { startedAt: t + Math.round(DROP_BOUNCE_DURATION_MS * 0.24), size };
    }

    if (el) this.applyTokenPhysicsToElement(el, tokenId);
    this._scheduleTokenPhysicsLoop();
  },

  _scheduleTokenPhysicsLoop() {
    const store = this._ensureTokenPhysicsStore();
    if (store.rafId != null || typeof requestAnimationFrame !== 'function') return;
    store.lastFrameMs = nowMs();
    const step = (ts) => {
      store.rafId = null;
      const now = Number.isFinite(ts) ? ts : nowMs();
      const dtSec = Math.max(0.001, Math.min(0.05, (now - store.lastFrameMs) / 1000));
      store.lastFrameMs = now;
      let active = false;

      // 1. Active drag tilt update + automatic settle when pointer pauses
      if (store.drag) {
        const d = store.drag;
        const idleMs = now - d.lastSampleMs;
        if (idleMs > 28) {
          const decay = Math.exp(-dtSec * 22);
          d.vx *= decay;
          d.vy *= decay;
          if (Math.hypot(d.vx, d.vy) < 8) {
            d.vx = 0;
            d.vy = 0;
          }
        }
        d.tiltDeg = computeDragTilt(d.vx, d.vy, d.tiltDeg, dtSec);
        const el = this._findTokenDomNode(d.tokenId);
        if (el) this.applyTokenPhysicsToElement(el, d.tokenId);
        active = true;
      }

      // 2. Active drop micro-bounces
      if (store.drops.size > 0) {
        for (const [tokenId, drop] of [...store.drops.entries()]) {
          const sample = sampleDropBounce(now - drop.startedAt, {
            size: drop.size,
            startLiftPx: drop.startLiftPx,
            startScale: drop.startScale
          });
          const el = this._findTokenDomNode(tokenId);
          if (sample.done) {
            store.drops.delete(tokenId);
            if (el) this._clearPhysicsVars(el);
          } else {
            drop.liftPx = sample.liftPx;
            drop.scale = sample.scale;
            drop.shadow = sample.shadow;
            if (el) this.applyTokenPhysicsToElement(el, tokenId);
            active = true;
          }
        }
      }

      // 3. Subtle camera landing shake for large/colossal tokens
      if (store.shake) {
        const elapsed = now - store.shake.startedAt;
        if (elapsed < 0) {
          active = true;
        } else {
          const offset = computeHeavyLandingShake(store.shake.size, elapsed);
          this._cameraShakeOffset = { x: offset.x, y: offset.y };
          this.applyWorldCameraTransform?.(Service.state);
          if (offset.done) {
            store.shake = null;
          } else {
            active = true;
          }
        }
      }

      // 4. Organic camera pan inertia
      if (store.camInertia) {
        const res = stepCameraInertia(store.camInertia.vx, store.camInertia.vy, dtSec);
        Service.state.camera.x += res.dx;
        Service.state.camera.y += res.dy;
        this.applyWorldCameraTransform?.(Service.state);
        if (res.done) {
          store.camInertia = null;
        } else {
          store.camInertia.vx = res.vx;
          store.camInertia.vy = res.vy;
          active = true;
        }
      }

      // 5. Smooth anchored wheel zoom
      if (store.camZoom) {
        const next = stepSmoothZoom(
          Service.state.camera,
          store.camZoom.targetZoom,
          store.camZoom.anchorX,
          store.camZoom.anchorY,
          dtSec
        );
        Service.state.camera.x = next.x;
        Service.state.camera.y = next.y;
        Service.state.camera.zoom = next.zoom;
        this.applyWorldCameraTransform?.(Service.state);
        if (next.done) {
          store.camZoom = null;
        } else {
          active = true;
        }
      }

      if (active) {
        store.rafId = requestAnimationFrame(step);
      }
    };
    store.rafId = requestAnimationFrame(step);
  }
};
