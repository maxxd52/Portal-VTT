/* ==========================================================================
   MOTOR 3D DE DADOS POLIÉDRICOS CON CARAS NUMERADAS (THREE.JS)
   Soporta d4, d6, d8, d10 (trapezoedro pentagonal), d12, d20 y d100 (2×d10)
   ========================================================================== */

import { TabletopAudio as DiceAudio } from './tabletopAudio.js?v=20261125a1';

export const Dice3DEngine = {
  renderer: null,
  scene: null,
  camera: null,
  diceGroup: null,
  activeFlights: [],
  pendingQueue: [],
  maxActiveFlights: 4,
  maxActiveDice: 24,
  maxPendingQueue: 8,
  _nextFlightId: 1,
  animId: null,
  canvas: null,
  overlayEl: null,
  trayEl: null,
  isFlying: false,
  textureCache: new Map(),
  previewRenderer: null,
  previewScene: null,
  previewCamera: null,
  previewDie: null,
  previewTargetQuat: null,
  previewAnimId: null,

  getActiveDiceCount() {
    return (this.activeFlights || []).reduce((sum, f) => sum + (Number(f?.totalDice) || 0), 0);
  },

  canStartFlightNow(diceCount = 1, mode = 'remote') {
    if (mode === 'local') return true;
    const active = Array.isArray(this.activeFlights) ? this.activeFlights : [];
    if (active.length === 0) return true;
    const n = Math.max(1, Number(diceCount) || 1);
    return active.length < this.maxActiveFlights && (this.getActiveDiceCount() + n) <= this.maxActiveDice;
  },

  syncCompatState() {
    const active = Array.isArray(this.activeFlights) ? this.activeFlights : [];
    this.diceGroup = active.length ? active[active.length - 1].group : null;
    this.isFlying = active.some((f) => !f.poseSettled);
  },

  disposeFlight(flight) {
    if (!flight) return;
    this.disposeObjectTree(this.scene, flight.group);
    this.activeFlights = (this.activeFlights || []).filter((f) => f !== flight);
    this.syncCompatState();
  },

  setupSceneLights(sceneObj, isMainScene = false) {
    const THREE = window.THREE;
    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.62);
    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.05);
    keyLight.position.set(2.5, 4.2, 5.2);
    const fillLight = new THREE.DirectionalLight(0xc4b5fd, 0.36);
    fillLight.position.set(-3.2, -2.0, 3.0);
    const rimLight = new THREE.DirectionalLight(0xe0e7ff, 0.48);
    rimLight.position.set(-1.6, 3.6, -2.4);
    sceneObj.add(hemi, keyLight, fillLight, rimLight);
    if (isMainScene) {
      this.lights = { hemi, keyLight, fillLight, rimLight };
      this.shadowDir = { x: -0.28, y: -0.36 };
    }
  },

  setSceneAtmosphere(atmo) {
    if (!atmo || typeof atmo !== 'object') return;
    if (atmo.diceShadowDir && Number.isFinite(atmo.diceShadowDir.x) && Number.isFinite(atmo.diceShadowDir.y)) {
      this.shadowDir = { x: atmo.diceShadowDir.x, y: atmo.diceShadowDir.y };
    }
    const L = this.lights;
    if (!L) return;
    if (Number.isFinite(atmo.hemiSkyHex)) L.hemi?.color?.setHex(atmo.hemiSkyHex);
    if (Number.isFinite(atmo.hemiGroundHex)) L.hemi?.groundColor?.setHex(atmo.hemiGroundHex);
    if (Number.isFinite(atmo.keyHex)) L.keyLight?.color?.setHex(atmo.keyHex);
    if (Number.isFinite(atmo.fillHex)) L.fillLight?.color?.setHex(atmo.fillHex);
    if (Number.isFinite(atmo.rimHex)) L.rimLight?.color?.setHex(atmo.rimHex);
    if (L.keyLight && this.shadowDir) {
      L.keyLight.position.set(-this.shadowDir.x * 9.0, -this.shadowDir.y * 11.6, 5.2);
    }
  },

  setGraphicsProfile(profile) {
    if (!profile) return;
    this.maxDpr = Math.max(1, Number(profile.diceMaxDpr) || 2);
    this.shadowsEnabled = profile.diceShadows !== false;
    const targetDpr = typeof window !== 'undefined'
      ? Math.min(window.devicePixelRatio || 1, this.maxDpr)
      : 1;
    if (this.renderer?.setPixelRatio) {
      this.renderer.setPixelRatio(targetDpr);
    }
    if (this.previewRenderer?.setPixelRatio) {
      this.previewRenderer.setPixelRatio(targetDpr);
    }
  },

  init(canvas, { overlayEl = null, trayEl = null } = {}) {
    if (!canvas || typeof window.THREE === 'undefined') return;
    this.canvas = canvas;
    this.overlayEl = overlayEl;
    this.trayEl = trayEl;
    try {
      this.renderer = new window.THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDpr || 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.scene = new window.THREE.Scene();
      this.camera = new window.THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 120);
      this.camera.position.set(0, 0, 24);

      this.setupSceneLights(this.scene, true);
      if (!this._resizeBound && typeof window !== 'undefined') {
        this._resizeBound = true;
        window.addEventListener('resize', () => this.handleResize());
      }
    } catch (_) {}
  },

  handleResize() {
    if (!this.renderer || !this.camera || typeof window === 'undefined') return;
    if (!Array.isArray(this.activeFlights) || this.activeFlights.length === 0) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw <= 0 || vh <= 0) return;
    this._lastVw = vw;
    this._lastVh = vh;
    const flyCamZ = 24;
    const tanHalfFov = Math.tan((20 * Math.PI) / 180);
    const visH = 2 * flyCamZ * tanHalfFov;
    const pxPerUnit = vh / visH;

    this.renderer.setSize(vw, vh, false);
    this.camera.aspect = vw / vh;
    this.camera.updateProjectionMatrix();

    for (let i = 0; i < this.activeFlights.length; i++) {
      const f = this.activeFlights[i];
      if (f.cellPx > 0) {
        f.dieScale = (f.cellPx * 0.78 / pxPerUnit) / 2.2;
        for (let j = 0; j < f.actors.length; j++) {
          const a = f.actors[j];
          a.mesh.scale.setScalar(f.dieScale);
          this.updateActorShadow(a, f.dieScale, f.flyCamZ);
        }
      }
    }
    if (!this.animId && this.scene) {
      this.renderer.render(this.scene, this.camera);
    }
  },

  clear({ localOnly = false } = {}) {
    if (localOnly) {
      const locals = (this.activeFlights || []).filter((f) => f.mode === 'local');
      locals.forEach((f) => {
        this.disposeFlight(f);
        if (typeof f.onComplete === 'function' && !f.completedNotified) {
          f.completedNotified = true;
          f.onComplete();
        }
      });
      if ((this.activeFlights || []).length === 0 && (this.pendingQueue || []).length === 0) {
        if (this.animId) {
          cancelAnimationFrame(this.animId);
          this.animId = null;
        }
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
        if (this.canvas) {
          this.canvas.style.opacity = '';
          this.canvas.classList.add('hidden');
        }
      } else if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.syncCompatState();
      return;
    }

    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    const droppedFlights = [...(this.activeFlights || [])];
    droppedFlights.forEach((f) => this.disposeFlight(f));
    this.activeFlights = [];
    const droppedQueue = [...(this.pendingQueue || [])];
    this.pendingQueue = [];
    droppedQueue.forEach((q) => {
      if (typeof q?.opts?.onComplete === 'function') q.opts.onComplete();
    });
    droppedFlights.forEach((f) => {
      if (typeof f.onComplete === 'function' && !f.completedNotified) {
        f.completedNotified = true;
        f.onComplete();
      }
    });
    this.syncCompatState();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
    if (this.canvas) {
      this.canvas.style.opacity = '';
      this.canvas.classList.add('hidden');
    }
  },

  clearTextureCache() {
    this.textureCache.forEach((tex) => {
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    });
    this.textureCache.clear();
  },

  disposeObjectTree(sceneObj, group) {
    if (!group || !sceneObj) return;
    sceneObj.remove(group);
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
    });
  },

  updatePreview(previewCanvas, style, showMinFace = false) {
    if (!previewCanvas || typeof window.THREE === 'undefined') return;
    const THREE = window.THREE;
    try {
      if (!this.previewRenderer) {
        this.previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, alpha: true, antialias: true });
        this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDpr || 2));
        this.previewRenderer.setSize(previewCanvas.width, previewCanvas.height, false);
        this.previewScene = new THREE.Scene();
        this.previewCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
        this.previewCamera.position.set(0, 0, 4.4);
        this.setupSceneLights(this.previewScene);
      }

      if (this.previewDie) {
        this.disposeObjectTree(this.previewScene, this.previewDie);
        this.previewDie = null;
      }

      const targetIdx = showMinFace ? 0 : 19;
      const built = this.buildNumberedDie(20, style, targetIdx, null, true);
      const sz = Math.max(0.75, Math.min(1.35, Number(style && style.sizeScale) || 1));
      built.mesh.scale.setScalar(0.84 + (sz - 1) * 0.42);
      this.previewDie = built.mesh;
      this.previewTargetQuat = built.targetQuat;
      this.previewScene.add(this.previewDie);

      if (!this.previewAnimId) {
        const start = performance.now();
        const wobbleQ = new THREE.Quaternion();
        const wobbleEuler = new THREE.Euler();
        const loop = (now) => {
          if (!this.previewDie || !this.previewRenderer) {
            this.previewAnimId = null;
            return;
          }
          const elapsed = (now - start) * 0.001;
          wobbleEuler.set(Math.sin(elapsed * 1.4) * 0.22, Math.sin(elapsed * 1.1) * 0.32, 0);
          wobbleQ.setFromEuler(wobbleEuler);
          this.previewDie.quaternion.copy(this.previewTargetQuat).premultiply(wobbleQ);
          this.previewRenderer.render(this.previewScene, this.previewCamera);
          this.previewAnimId = requestAnimationFrame(loop);
        };
        this.previewAnimId = requestAnimationFrame(loop);
      }
    } catch (_) {}
  },

  stopPreview() {
    if (this.previewAnimId) {
      cancelAnimationFrame(this.previewAnimId);
      this.previewAnimId = null;
    }
    if (this.previewDie) {
      this.disposeObjectTree(this.previewScene, this.previewDie);
      this.previewDie = null;
    }
  },

  hexToRgba(hex, alpha = 1) {
    if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return `rgba(15, 23, 42, ${alpha})`;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  computeGlyphPlacement(ctx, text, size, fontSize, sides) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(text);
    const hasBox = m && typeof m.actualBoundingBoxAscent === 'number' && typeof m.actualBoundingBoxDescent === 'number';
    const drawX = hasBox && typeof m.actualBoundingBoxLeft === 'number' && typeof m.actualBoundingBoxRight === 'number'
      ? size / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2
      : size / 2;
    const drawY = hasBox
      ? size / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
      : size / 2 + fontSize * 0.34;
    const showUnderline = (text === '6' || text === '9') && sides !== 6;
    const underY = hasBox
      ? drawY + m.actualBoundingBoxDescent + Math.max(2, Math.round(fontSize * 0.08))
      : size / 2 + Math.round(fontSize * 0.44);
    return { drawX, drawY, showUnderline, underY };
  },

  getFaceTexture(label, styleOrColor, fontScale = 1, outerEdgesUV = null, sides = 6) {
    const style = typeof styleOrColor === 'string' ? { bodyColor: styleOrColor } : styleOrColor || {};
    const bgColorHex = style.bodyColor || '#8b5cf6';
    const bevelColor = style.bevelColor || '#0f172a';
    const bevelSize = style.bevelSize !== undefined ? Math.max(0, Math.min(2, Number(style.bevelSize))) : 1;
    const numberColor = style.numberColor || '#ffffff';

    const cacheKey = `${sides}::${bgColorHex}::${bevelColor}::${bevelSize.toFixed(2)}::${numberColor}::${fontScale.toFixed(2)}::${label}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColorHex;
    ctx.fillRect(0, 0, size, size);

    // Sutil viñeta radial para dar profundidad a cada cara
    const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.65);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Bisel poligonal siguiendo el perímetro exacto de la cara
    if (bevelSize > 0.02 && outerEdgesUV && outerEdgesUV.length > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Borde exterior con color y grosor personalizables
      ctx.strokeStyle = this.hexToRgba(bevelColor, 0.62);
      ctx.lineWidth = Math.max(1.5, 5 * bevelSize);
      ctx.beginPath();
      for (const [[u1, v1], [u2, v2]] of outerEdgesUV) {
        ctx.moveTo(u1 * size, (1 - v1) * size);
        ctx.lineTo(u2 * size, (1 - v2) * size);
      }
      ctx.stroke();

      // Filo interior luminoso (efecto bisel 3D)
      const inset = Math.max(0.76, 0.90 - 0.04 * bevelSize);
      const half = size / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.lineWidth = Math.max(1, 2 * bevelSize);
      ctx.beginPath();
      for (const [[u1, v1], [u2, v2]] of outerEdgesUV) {
        const x1 = half + (u1 * size - half) * inset;
        const y1 = half + ((1 - v1) * size - half) * inset;
        const x2 = half + (u2 * size - half) * inset;
        const y2 = half + ((1 - v2) * size - half) * inset;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Número, ASCII o emoji centrado proporcional al tipo de cara
    const text = String(label);
    const isEmoji = /\p{Extended_Pictographic}/u.test(text);
    const charUnits = Array.from(text).length;
    const baseSize = charUnits >= 3 ? 20 : charUnits === 2 ? 25 : 34;
    const fontSize = Math.round(baseSize * fontScale * (isEmoji ? 1.08 : 1));
    ctx.font = isEmoji
      ? `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif`
      : `700 ${fontSize}px "JetBrains Mono", "Segoe UI Symbol", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isEmoji) {
      ctx.save();
      ctx.fillStyle = numberColor;
      ctx.shadowColor = 'rgba(15, 23, 42, 0.85)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 1;
      ctx.fillText(text, size / 2, size / 2 + 1);
      ctx.restore();
    } else {
      const { drawX, drawY, showUnderline, underY } = this.computeGlyphPlacement(ctx, text, size, fontSize, sides);
      ctx.lineWidth = Math.max(3, Math.round(4 * fontScale));
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.strokeText(text, drawX, drawY);

      ctx.fillStyle = numberColor;
      ctx.fillText(text, drawX, drawY);

      if (showUnderline) {
        const underW = Math.round(fontSize * 0.46);
        ctx.fillRect(drawX - underW / 2, underY, underW, Math.max(2, Math.round(2.5 * fontScale)));
      }
    }

    const texture = new window.THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    this.textureCache.set(cacheKey, texture);
    return texture;
  },

  /**
   * Mapa de relieve cacheado (128x128) para tallar bajorrelieve en números y chaflán del bisel.
   */
  getFaceBumpTexture(label, bevelSize = 1, fontScale = 1, outerEdgesUV = null, sides = 6) {
    const text = String(label);
    const isEmoji = /\p{Extended_Pictographic}/u.test(text);
    const bClamped = Math.max(0, Math.min(2, Number(bevelSize)));
    const edgeSig = outerEdgesUV && outerEdgesUV.length > 0
      ? outerEdgesUV.map(([p1]) => `${Math.round(p1[0] * 32)},${Math.round(p1[1] * 32)}`).join(';')
      : '0';
    const cacheKey = `bump::${sides}::${bClamped.toFixed(2)}::${fontScale.toFixed(2)}::${isEmoji ? 'E' : text}::${edgeSig}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, size, size);

    if (bClamped > 0.02 && outerEdgesUV && outerEdgesUV.length > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#4e4e4e';
      ctx.lineWidth = Math.max(2, 5 * bClamped);
      ctx.beginPath();
      for (const [[u1, v1], [u2, v2]] of outerEdgesUV) {
        ctx.moveTo(u1 * size, (1 - v1) * size);
        ctx.lineTo(u2 * size, (1 - v2) * size);
      }
      ctx.stroke();

      const inset = Math.max(0.76, 0.90 - 0.04 * bClamped);
      const half = size / 2;
      ctx.strokeStyle = '#bcbcbc';
      ctx.lineWidth = Math.max(1.5, 2.5 * bClamped);
      ctx.beginPath();
      for (const [[u1, v1], [u2, v2]] of outerEdgesUV) {
        ctx.moveTo(half + (u1 * size - half) * inset, half + ((1 - v1) * size - half) * inset);
        ctx.lineTo(half + (u2 * size - half) * inset, half + ((1 - v2) * size - half) * inset);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (!isEmoji) {
      const charUnits = Array.from(text).length;
      const baseSize = charUnits >= 3 ? 20 : charUnits === 2 ? 25 : 34;
      const fontSize = Math.round(baseSize * fontScale);
      ctx.font = `700 ${fontSize}px "JetBrains Mono", "Segoe UI Symbol", sans-serif`;
      const { drawX, drawY, showUnderline, underY } = this.computeGlyphPlacement(ctx, text, size, fontSize, sides);
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, Math.round(2.5 * fontScale));
      ctx.strokeStyle = '#686868';
      ctx.strokeText(text, drawX, drawY);
      ctx.fillStyle = '#343434';
      ctx.fillText(text, drawX, drawY);

      if (showUnderline) {
        const underW = Math.round(fontSize * 0.46);
        ctx.fillRect(drawX - underW / 2, underY, underW, Math.max(2, Math.round(2.5 * fontScale)));
      }
    }

    const texture = new window.THREE.CanvasTexture(canvas);
    this.textureCache.set(cacheKey, texture);
    return texture;
  },

  /**
   * Trapezoedro pentagonal exacto (d10) con 10 caras cometa perfectamente planares.
   */
  createD10Geometry(radius = 1.38, height = 1.36) {
    const THREE = window.THREE;
    const cos36 = Math.cos(Math.PI / 5);
    const yr = height * ((1 - cos36) / (1 + cos36));

    const topApex = [0, height, 0];
    const botApex = [0, -height, 0];
    const ring = [];
    for (let k = 0; k < 10; k++) {
      const angle = (k * Math.PI) / 5;
      const y = k % 2 === 0 ? yr : -yr;
      ring.push([radius * Math.cos(angle), y, radius * Math.sin(angle)]);
    }

    const positions = [];
    const pushTri = (a, b, c) => {
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    };

    for (let i = 0; i < 5; i++) {
      // 5 caras superiores (cometas)
      const u0 = ring[(2 * i) % 10];
      const d1 = ring[(2 * i + 1) % 10];
      const u2 = ring[(2 * i + 2) % 10];
      pushTri(topApex, u2, d1);
      pushTri(topApex, d1, u0);

      // 5 caras inferiores (cometas)
      const l0 = ring[(2 * i + 1) % 10];
      const up1 = ring[(2 * i + 2) % 10];
      const l2 = ring[(2 * i + 3) % 10];
      pushTri(botApex, l0, up1);
      pushTri(botApex, up1, l2);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  },

  /**
   * Triacontaedro rómbico exacto (d30) con 30 caras rómbicas planares.
   */
  createD30Geometry(scale = 0.84) {
    const THREE = window.THREE;
    const phi = (1 + Math.sqrt(5)) / 2;
    const inv = 1 / phi;

    const D = [];
    for (const x of [-1, 1]) {
      for (const y of [-1, 1]) {
        for (const z of [-1, 1]) D.push([x, y, z]);
      }
    }
    for (const a of [-inv, inv]) {
      for (const b of [-phi, phi]) D.push([0, a, b], [b, 0, a], [a, b, 0]);
    }

    const I = [];
    for (const a of [-1, 1]) {
      for (const b of [-phi, phi]) I.push([0, b, a], [a, 0, b], [b, a, 0]);
    }

    const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    const edgeD2 = (2 / phi) ** 2;
    const positions = [];

    const pushTri = (a, b, c) => {
      positions.push(
        a[0] * scale, a[1] * scale, a[2] * scale,
        b[0] * scale, b[1] * scale, b[2] * scale,
        c[0] * scale, c[1] * scale, c[2] * scale
      );
    };

    for (let i = 0; i < D.length; i++) {
      for (let j = i + 1; j < D.length; j++) {
        if (Math.abs(dist2(D[i], D[j]) - edgeD2) > 1e-5) continue;
        const sx = D[i][0] + D[j][0];
        const sy = D[i][1] + D[j][1];
        const sz = D[i][2] + D[j][2];

        let i1 = null;
        let i2 = null;
        for (let a = 0; a < I.length && !i1; a++) {
          for (let b = a + 1; b < I.length; b++) {
            if (
              Math.abs(I[a][0] + I[b][0] - sx) < 1e-5 &&
              Math.abs(I[a][1] + I[b][1] - sy) < 1e-5 &&
              Math.abs(I[a][2] + I[b][2] - sz) < 1e-5
            ) {
              i1 = I[a];
              i2 = I[b];
              break;
            }
          }
        }
        if (!i1) continue;

        // Verificar orientación hacia afuera mediante producto cruzado
        const u = [i1[0] - D[i][0], i1[1] - D[i][1], i1[2] - D[i][2]];
        const v = [D[j][0] - D[i][0], D[j][1] - D[i][1], D[j][2] - D[i][2]];
        const nx = u[1] * v[2] - u[2] * v[1];
        const ny = u[2] * v[0] - u[0] * v[2];
        const nz = u[0] * v[1] - u[1] * v[0];

        if (nx * sx + ny * sy + nz * sz > 0) {
          pushTri(D[i], i1, D[j]);
          pushTri(D[i], D[j], i2);
        } else {
          pushTri(D[i], D[j], i1);
          pushTri(D[i], i2, D[j]);
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  },

  createBaseGeometry(sides) {
    const THREE = window.THREE;
    if (sides === 4) return new THREE.TetrahedronGeometry(1.42);
    if (sides === 6) return new THREE.BoxGeometry(1.62, 1.62, 1.62);
    if (sides === 8) return new THREE.OctahedronGeometry(1.42);
    if (sides === 10) return this.createD10Geometry();
    if (sides === 12) return new THREE.DodecahedronGeometry(1.34);
    if (sides === 30) return this.createD30Geometry();
    return new THREE.IcosahedronGeometry(1.38);
  },

  /**
   * Agrupa triángulos coplanares, proyecta UVs por cara y calcula el quaternion
   * que orienta cada cara mirando directo a la cámara (+Z) con el número derecho (+Y).
   */
  buildNumberedDie(sides, styleOrColor, targetFaceIndex, labelsList, applyCustomSymbols = true) {
    const THREE = window.THREE;
    const rawGeom = this.createBaseGeometry(sides);
    const geom = rawGeom.index ? rawGeom.toNonIndexed() : rawGeom;
    if (rawGeom !== geom) rawGeom.dispose();

    const posAttr = geom.getAttribute('position');
    const triCount = posAttr.count / 3;

    // Agrupar triángulos por normal cuantizada (d6 tiene 2 tri/cara, d10 tiene 2 tri/cara, d12 tiene 3 tri/cara)
    const faceMap = new Map();
    const faces = [];

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const cb = new THREE.Vector3();
    const ab = new THREE.Vector3();

    for (let t = 0; t < triCount; t++) {
      const i0 = t * 3;
      vA.fromBufferAttribute(posAttr, i0);
      vB.fromBufferAttribute(posAttr, i0 + 1);
      vC.fromBufferAttribute(posAttr, i0 + 2);

      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      cb.cross(ab).normalize();

      const q = (v) => (Math.abs(v) < 0.01 ? '0.00' : v.toFixed(2));
      const key = `${q(cb.x)},${q(cb.y)},${q(cb.z)}`;
      let face = faceMap.get(key);
      if (!face) {
        face = { normal: cb.clone(), triIndices: [] };
        faceMap.set(key, face);
        faces.push(face);
      }
      face.triIndices.push(t);
    }

    const newPositions = new Float32Array(posAttr.count * 3);
    const newUvs = new Float32Array(posAttr.count * 2);
    geom.clearGroups();

    const faceOrientations = [];
    const facePerimeterUVs = [];
    let writeVertex = 0;

    // Escala tipográfica por forma de cara (cuadrados y pentágonos admiten números más grandes)
    const fontScale = sides === 6 || sides === 12 ? 1.65 : sides === 10 || sides === 100 ? 0.95 : 1.12;

    faces.forEach((face, faceIdx) => {
      const n = face.normal;

      const centroid = new THREE.Vector3();
      const seenVerts = new Set();
      let vertTotal = 0;
      for (const t of face.triIndices) {
        for (let k = 0; k < 3; k++) {
          vA.fromBufferAttribute(posAttr, t * 3 + k);
          const vKey = `${vA.x.toFixed(3)},${vA.y.toFixed(3)},${vA.z.toFixed(3)}`;
          if (seenVerts.has(vKey)) continue;
          seenVerts.add(vKey);
          centroid.add(vA);
          vertTotal += 1;
        }
      }
      centroid.divideScalar(Math.max(1, vertTotal));

      // Alinear vAxis con la simetría propia de la cara (arista en d6, vértice/ápice en el resto)
      const vAxis = new THREE.Vector3();
      if (sides === 6) {
        const t0 = face.triIndices[0] * 3;
        vA.fromBufferAttribute(posAttr, t0);
        vB.fromBufferAttribute(posAttr, t0 + 1);
        vC.fromBufferAttribute(posAttr, t0 + 2);
        const dAB = vA.distanceToSquared(vB);
        const dBC = vB.distanceToSquared(vC);
        const dCA = vC.distanceToSquared(vA);
        if (dAB <= dBC && dAB <= dCA) vAxis.subVectors(vB, vA);
        else if (dBC <= dAB && dBC <= dCA) vAxis.subVectors(vC, vB);
        else vAxis.subVectors(vA, vC);
      } else if (sides === 30) {
        // En el d30, alinear vAxis con la diagonal corta del rombo (vértice más cercano al centroide)
        let bestDist = Infinity;
        for (const t of face.triIndices) {
          for (let k = 0; k < 3; k++) {
            vA.fromBufferAttribute(posAttr, t * 3 + k);
            const d = vA.distanceToSquared(centroid);
            if (d < bestDist) {
              bestDist = d;
              vAxis.subVectors(vA, centroid);
            }
          }
        }
      } else {
        let bestDist = -1;
        for (const t of face.triIndices) {
          for (let k = 0; k < 3; k++) {
            vA.fromBufferAttribute(posAttr, t * 3 + k);
            const d = vA.distanceToSquared(centroid);
            if (d > bestDist) {
              bestDist = d;
              vAxis.subVectors(vA, centroid);
            }
          }
        }
      }
      // Proyectar vAxis ortogonal a la normal y normalizar
      vAxis.addScaledVector(n, -vAxis.dot(n)).normalize();
      const uAxis = new THREE.Vector3().crossVectors(vAxis, n).normalize();

      let maxR = 0.001;
      for (const t of face.triIndices) {
        for (let k = 0; k < 3; k++) {
          vA.fromBufferAttribute(posAttr, t * 3 + k).sub(centroid);
          const px = vA.dot(uAxis);
          const py = vA.dot(vAxis);
          maxR = Math.max(maxR, Math.hypot(px, py));
        }
      }

      const startVertex = writeVertex;
      const edgeCounts = new Map();
      const span = maxR * 1.08;

      for (const t of face.triIndices) {
        const triVerts = [];
        for (let k = 0; k < 3; k++) {
          vA.fromBufferAttribute(posAttr, t * 3 + k);
          newPositions[writeVertex * 3] = vA.x;
          newPositions[writeVertex * 3 + 1] = vA.y;
          newPositions[writeVertex * 3 + 2] = vA.z;

          vB.copy(vA).sub(centroid);
          const u = 0.5 + vB.dot(uAxis) / (2 * span);
          const v = 0.5 + vB.dot(vAxis) / (2 * span);
          newUvs[writeVertex * 2] = u;
          newUvs[writeVertex * 2 + 1] = v;
          triVerts.push({
            key: `${vA.x.toFixed(3)},${vA.y.toFixed(3)},${vA.z.toFixed(3)}`,
            uv: [u, v]
          });
          writeVertex += 1;
        }

        for (let e = 0; e < 3; e++) {
          const p1 = triVerts[e];
          const p2 = triVerts[(e + 1) % 3];
          const edgeKey = p1.key < p2.key ? `${p1.key}|${p2.key}` : `${p2.key}|${p1.key}`;
          const existing = edgeCounts.get(edgeKey);
          if (existing) {
            existing.count += 1;
          } else {
            edgeCounts.set(edgeKey, { count: 1, uvPair: [p1.uv, p2.uv] });
          }
        }
      }

      const outerEdges = [];
      edgeCounts.forEach((val) => {
        if (val.count === 1) outerEdges.push(val.uvPair);
      });
      facePerimeterUVs.push(outerEdges);

      geom.addGroup(startVertex, writeVertex - startVertex, faceIdx);

      const basis = new THREE.Matrix4().makeBasis(uAxis, vAxis, n);
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(basis.transpose());
      faceOrientations.push(targetQuat);
    });

    geom.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(newUvs, 2));
    geom.computeVertexNormals();

    const styleObj = typeof styleOrColor === 'string' ? { bodyColor: styleOrColor } : styleOrColor || {};
    const maxSym = applyCustomSymbols && styleObj.maxSymbol ? String(styleObj.maxSymbol).trim() : '';
    const minSym = applyCustomSymbols && styleObj.minSymbol ? String(styleObj.minSymbol).trim() : '';

    const safeIdx = Math.max(0, Math.min(faces.length - 1, targetFaceIndex));
    const bevelSize = styleObj.bevelSize !== undefined ? Number(styleObj.bevelSize) : 1;
    const materials = faces.map((_, idx) => {
      let label = labelsList ? labelsList[idx % labelsList.length] : idx + 1;
      if (idx === faces.length - 1 && maxSym) label = maxSym;
      else if (idx === 0 && minSym) label = minSym;
      const faceTexture = this.getFaceTexture(label, styleObj, fontScale, facePerimeterUVs[idx], sides);
      const bumpTexture = this.getFaceBumpTexture(label, bevelSize, fontScale, facePerimeterUVs[idx], sides);
      const isTargetFace = idx === safeIdx;

      return new THREE.MeshStandardMaterial({
        map: faceTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.032,
        emissiveMap: isTargetFace ? faceTexture : null,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0,
        roughness: 0.28,
        metalness: 0.14
      });
    });

    const targetMaterial = materials[safeIdx] || null;
    const otherMaterials = materials.filter((_, idx) => idx !== safeIdx);

    return {
      mesh: new THREE.Mesh(geom, materials),
      targetQuat: faceOrientations[safeIdx],
      targetMaterial,
      otherMaterials
    };
  },

  buildCoinDie(styleOrColor, isHeads = true) {
    const THREE = window.THREE;
    const styleObj = typeof styleOrColor === 'string'
      ? { bodyColor: styleOrColor, numberColor: '#ffffff' }
      : { ...(styleOrColor || {}) };
    const geom = new THREE.CylinderGeometry(1.18, 1.18, 0.22, 32);
    const bodyHex = styleObj.bodyColor || '#8b5cf6';
    const bevelSize = styleObj.bevelSize !== undefined ? Number(styleObj.bevelSize) : 1;
    const coinEdgesUV = Array.from({ length: 32 }, (_, i) => {
      const a1 = (i / 32) * Math.PI * 2;
      const a2 = ((i + 1) / 32) * Math.PI * 2;
      return [
        [0.5 + Math.cos(a1) * 0.485, 0.5 + Math.sin(a1) * 0.485],
        [0.5 + Math.cos(a2) * 0.485, 0.5 + Math.sin(a2) * 0.485]
      ];
    });

    const makeFaceMat = (symbol, active) => {
      const tex = this.getFaceTexture(symbol, styleObj, 1.5, coinEdgesUV, 2);
      const bump = this.getFaceBumpTexture(symbol, bevelSize, 1.5, coinEdgesUV, 2);
      return new THREE.MeshStandardMaterial({
        map: tex,
        bumpMap: bump,
        bumpScale: 0.032,
        emissiveMap: active ? tex : null,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0,
        roughness: 0.28,
        metalness: 0.14
      });
    };

    const matEdge = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bodyHex),
      roughness: 0.28,
      metalness: 0.14
    });
    const matHeads = makeFaceMat('★', isHeads);
    const matTails = makeFaceMat('✕', !isHeads);
    const targetQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      isHeads ? Math.PI / 2 : -Math.PI / 2
    );

    return {
      mesh: new THREE.Mesh(geom, [matEdge, matHeads, matTails]),
      targetQuat,
      targetMaterial: isHeads ? matHeads : matTails,
      otherMaterials: [matEdge, isHeads ? matTails : matHeads]
    };
  },

  buildCardDie(styleOrColor, card = {}) {
    const THREE = window.THREE;
    const styleObj = typeof styleOrColor === 'string'
      ? { bodyColor: styleOrColor, numberColor: '#ffffff', bevelColor: '#0f172a' }
      : { ...(styleOrColor || {}) };
    const bodyHex = styleObj.bodyColor || '#8b5cf6';
    const bevelHex = styleObj.bevelColor || '#0f172a';
    const numHex = styleObj.numberColor || '#ffffff';

    const makeCardTex = (isFront) => {
      if (typeof document === 'undefined' || !document.createElement) {
        return this.getFaceTexture(isFront ? (card.label || 'A♠') : '★', styleObj, 1.1, null, 54);
      }
      const w = 256;
      const h = 360;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');

      if (isFront) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 8;
        ctx.strokeRect(8, 8, w - 16, h - 16);

        const ink = card.red ? '#dc2626' : '#0f172a';
        ctx.fillStyle = ink;
        const valText = card.isJoker ? 'JOKER' : (card.val || card.label || 'A');
        const suitText = card.suit || '♠';

        const drawCorner = () => {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.font = card.isJoker ? '800 36px system-ui, sans-serif' : '800 62px "JetBrains Mono", system-ui, sans-serif';
          ctx.fillText(valText, 0, 0);
          if (!card.isJoker) {
            ctx.font = '700 48px system-ui, sans-serif';
            ctx.fillText(suitText, 2, 62);
          }
        };

        ctx.save();
        ctx.translate(18, 16);
        drawCorner();
        ctx.restore();

        ctx.save();
        ctx.translate(w - 18, h - 16);
        ctx.rotate(Math.PI);
        drawCorner();
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = card.isJoker ? '800 116px system-ui, sans-serif' : '700 132px system-ui, sans-serif';
        ctx.fillText(suitText, w / 2, h / 2 + 4);
      } else {
        ctx.fillStyle = bodyHex;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = bevelHex;
        ctx.lineWidth = 14;
        ctx.strokeRect(12, 12, w - 24, h - 24);
        ctx.strokeStyle = numHex;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 4;
        ctx.strokeRect(28, 28, w - 56, h - 56);
        ctx.beginPath();
        ctx.moveTo(w / 2, 72);
        ctx.lineTo(w - 58, h / 2);
        ctx.lineTo(w / 2, h - 72);
        ctx.lineTo(58, h / 2);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = numHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 46px system-ui, sans-serif';
        ctx.fillText('✦', w / 2, h / 2);
      }

      const tex = new THREE.CanvasTexture(cv);
      tex.needsUpdate = true;
      return tex;
    };

    const geom = new THREE.BoxGeometry(1.38, 1.96, 0.05);
    const matEdge = new THREE.MeshStandardMaterial({ color: new THREE.Color(bevelHex), roughness: 0.35, metalness: 0.1 });
    const frontTex = makeCardTex(true);
    const matFront = new THREE.MeshStandardMaterial({
      map: frontTex,
      emissiveMap: frontTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0,
      roughness: 0.35,
      metalness: 0.05
    });
    const matBack = new THREE.MeshStandardMaterial({
      map: makeCardTex(false),
      roughness: 0.32,
      metalness: 0.14
    });

    return {
      mesh: new THREE.Mesh(geom, [matEdge, matEdge, matEdge, matEdge, matFront, matBack]),
      targetQuat: new THREE.Quaternion(),
      targetMaterial: matFront,
      otherMaterials: [matEdge, matBack]
    };
  },

  disposeGroup() {
    [...(this.activeFlights || [])].forEach((f) => this.disposeFlight(f));
    this.activeFlights = [];
    this.syncCompatState();
  },

  playPickup(count = 1) {
    DiceAudio.playPickup(count);
  },

  /**
   * Textura radial cacheada para simular sombra de contacto y altura sobre la mesa.
   */
  getShadowTexture() {
    const cacheKey = 'dice::soft-shadow';
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.49);
    grad.addColorStop(0, 'rgba(2, 6, 14, 0.96)');
    grad.addColorStop(0.42, 'rgba(2, 6, 14, 0.78)');
    grad.addColorStop(0.72, 'rgba(2, 6, 14, 0.34)');
    grad.addColorStop(1, 'rgba(2, 6, 14, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new window.THREE.CanvasTexture(canvas);
    this.textureCache.set(cacheKey, texture);
    return texture;
  },

  updateActorShadow(actor, dieScale, camZ) {
    if (!actor.shadowMesh) return;
    const h = Math.max(0, actor.mesh.position.z);
    const dieRadius = 1.50 * dieScale;
    const shadowZ = -1.68 * dieScale;

    // Desplazamiento alineado con la iluminación ambiental de la mesa
    const sdx = Number.isFinite(this.shadowDir?.x) ? this.shadowDir.x : -0.28;
    const sdy = Number.isFinite(this.shadowDir?.y) ? this.shadowDir.y : -0.36;
    const tx = actor.mesh.position.x + sdx * dieRadius + (sdx * 0.58) * h;
    const ty = actor.mesh.position.y + sdy * dieRadius + (sdy * 0.61) * h;
    const zComp = (camZ - shadowZ) / camZ;

    actor.shadowMesh.position.set(tx * zComp, ty * zComp, shadowZ);
    const size = (3.65 * dieScale) * (1 + h * 0.14);
    actor.shadowMesh.scale.set(size * 1.08, size * 0.96, 1);
    actor.shadowMesh.material.opacity = 0.68 / (1 + h * 0.38);
  },

  computeResultHighlight(progress) {
    const g = Math.max(0, Math.min(1, progress));
    const peakAt = 0.28;
    const peakEmissive = 0.85;
    const steadyEmissive = 0.24;

    const emissiveIntensity = g < peakAt
      ? peakEmissive * Math.sin((g / peakAt) * Math.PI * 0.5)
      : steadyEmissive + (peakEmissive - steadyEmissive) * 0.5 * (1 + Math.cos(((g - peakAt) / (1 - peakAt)) * Math.PI));

    const dimEase = 0.5 * (1 - Math.cos(Math.min(1, g / 0.35) * Math.PI));
    const neighborShade = 1 - 0.24 * dimEase;
    return { emissiveIntensity, neighborShade };
  },

  /**
   * Computes friction-damped return progress and diminishing gravity bounce Z
   * for remote dice rolls after tabletop impact.
   * @param {number} u2 Normalized post-bounce progress in [0, 1]
   * @param {number} zArc Peak incoming arc height
   * @returns {{sPos: number, sRot: number, z: number, bounceStage: number}}
   */
  computeRemoteReturnKinematics(u2, zArc = 2.8) {
    const u = Math.max(0, Math.min(1, Number(u2) || 0));
    const sPos = 1 - Math.pow(1 - u, 2.35);
    const sRot = 1 - Math.pow(1 - u, 2.65);
    let z = 0;
    let bounceStage = 3;
    if (u < 0.38) {
      z = Math.sin((u / 0.38) * Math.PI) * (zArc * 0.34);
      bounceStage = 1;
    } else if (u < 0.62) {
      z = Math.sin(((u - 0.38) / 0.24) * Math.PI) * (zArc * 0.10);
      bounceStage = 2;
    }
    return { sPos, sRot, z, bounceStage };
  },

  canRoll3D() {
    return Boolean(this.renderer && this.scene && this.canvas && typeof window.THREE !== 'undefined');
  },

  prepareFlight() {
    if (this.canRoll3D()) {
      this.isFlying = true;
    }
  },

  roll(sides, colorHex = '#8b5cf6', rolledValue = null) {
    this.rollHand([{ sides, colorHex, value: rolledValue }]);
  },

  rollHand(items, opts = {}) {
    if (!this.renderer || !this.scene || typeof window.THREE === 'undefined') return;
    if (!Array.isArray(items) || items.length === 0) return;

    const mode = opts?.mode === 'remote' ? 'remote' : 'local';
    const diceCount = items.reduce((acc, it) => acc + (Number(it?.sides) === 100 ? 2 : 1), 0);
    if (!this.canvas || diceCount === 0) {
      if (typeof opts?.onComplete === 'function') opts.onComplete();
      return;
    }

    if (mode === 'remote' && !this.canStartFlightNow(diceCount, 'remote')) {
      this.pendingQueue.push({ items, opts, totalDice: diceCount });
      if (this.pendingQueue.length > this.maxPendingQueue) {
        const dropped = this.pendingQueue.shift();
        if (typeof dropped?.opts?.onComplete === 'function') dropped.opts.onComplete();
      }
      this.ensureLoopRunning();
      return;
    }

    if (mode === 'local') {
      const prevLocals = (this.activeFlights || []).filter((f) => f.mode === 'local');
      prevLocals.forEach((f) => {
        this.disposeFlight(f);
        if (typeof f.onComplete === 'function' && !f.completedNotified) {
          f.completedNotified = true;
          f.onComplete();
        }
      });
    }

    const launched = this.launchFlight(items, opts);
    if (!launched && typeof opts?.onComplete === 'function') {
      opts.onComplete();
    }
    this.ensureLoopRunning();
  },

  launchFlight(items, { targetX = null, targetY = null, originX = null, mode = 'local', style = null, onComplete = null } = {}) {
    if (!this.renderer || !this.scene || !this.canvas || typeof window.THREE === 'undefined') return null;
    if (!Array.isArray(items) || items.length === 0) return null;

    const THREE = window.THREE;
    const group = new THREE.Group();
    const actors = [];

    // Expandir cada dado (d100 se desdobla en par inseparable de d10)
    const meshUnits = [];
    let totalDice = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sides = Number(item.sides) || 20;
      const dieStyle = { ...(style || {}), bodyColor: (style && style.bodyColor) || item.colorHex || '#8b5cf6' };
      const value = item.value !== null && item.value !== undefined
        ? item.value
        : Math.floor(Math.random() * sides) + 1;

      if (item.kind === 'card' || sides === 54) {
        meshUnits.push([this.buildCardDie(dieStyle, item.card || { label: 'A♠', val: 'A', suit: '♠', red: false })]);
        totalDice += 1;
      } else if (item.kind === 'coin' || sides === 2) {
        const isHeads = item.value !== null && item.value !== undefined ? Number(item.value) >= 1 : Math.random() < 0.5;
        meshUnits.push([this.buildCoinDie(dieStyle, isHeads)]);
        totalDice += 1;
      } else if (item.kind === 'fudge' || sides === 3) {
        const fudgeLabels = ['−', '−', '◯', '◯', '+', '+'];
        const v = item.value !== null && item.value !== undefined ? Number(item.value) : (Math.floor(Math.random() * 3) - 1);
        const targetIdx = v > 0 ? 4 : v < 0 ? 0 : 2;
        meshUnits.push([this.buildNumberedDie(6, dieStyle, targetIdx, fudgeLabels, false)]);
        totalDice += 1;
      } else if (sides === 100) {
        const tensIdx = value === 100 ? 0 : Math.floor(value / 10);
        const unitsIdx = value === 100 ? 0 : value % 10;
        const tensLabels = ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'];
        const unitsLabels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        meshUnits.push([
          this.buildNumberedDie(10, dieStyle, tensIdx, tensLabels, false),
          this.buildNumberedDie(10, { ...dieStyle, bodyColor: '#334155' }, unitsIdx, unitsLabels, false)
        ]);
        totalDice += 2;
      } else {
        const labels = sides === 10 ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] : null;
        const targetIdx = Math.max(0, Math.min(sides - 1, value - 1));
        meshUnits.push([this.buildNumberedDie(sides, dieStyle, targetIdx, labels, true)]);
        totalDice += 1;
      }
    }

    if (totalDice === 0) return null;

    this.canvas.style.opacity = '';
    this.canvas.classList.remove('hidden');

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const flyCamZ = 24;
    const tanHalfFov = Math.tan((20 * Math.PI) / 180);

    if (this._lastVw !== vw || this._lastVh !== vh) {
      this._lastVw = vw;
      this._lastVh = vh;
      this.renderer.setSize(vw, vh, false);
      this.camera.aspect = vw / vh;
      this.camera.position.set(0, 0, flyCamZ);
      this.camera.updateProjectionMatrix();
    }

    const visH = 2 * flyCamZ * tanHalfFov;
    const visW = visH * (vw / vh);
    const pxPerUnit = vh / visH;

    const screenToWorld = (sx, sy) => ({
      x: (sx / vw - 0.5) * visW,
      y: (0.5 - sy / vh) * visH
    });

    const trayTop = this.trayEl ? this.trayEl.getBoundingClientRect().top : vh - 80;
    const overlayClearance = totalDice > 8 ? 196 : totalDice > 1 ? 180 : 148;
    let cardTop = Infinity;
    if (this.overlayEl) {
      const rect = this.overlayEl.getBoundingClientRect();
      const closedOffset = this.overlayEl.classList.contains('is-open') ? 0 : 6;
      if (rect.height > 0) {
        cardTop = rect.top - closedOffset - 26;
      }
    }
    const zoneBottomSy = Math.min(trayTop - overlayClearance, cardTop);

    // Zona fija sobre la tarjeta: máximo 4 dados por fila (5 filas para 20 dados) sin partir pares d100
    const maxCols = 4;
    const packedRows = [[]];
    for (let u = 0; u < meshUnits.length; u++) {
      const unit = meshUnits[u];
      const curRow = packedRows[packedRows.length - 1];
      if (curRow.length > 0 && curRow.length + unit.length > maxCols) {
        packedRows.push([...unit]);
      } else {
        curRow.push(...unit);
      }
    }
    const sizeScale = Math.max(0.75, Math.min(1.35, Number(style && style.sizeScale) || 1));
    const groupScale = totalDice === 1 ? sizeScale : Math.min(sizeScale, 1.18);
    const cols = packedRows.reduce((m, row) => Math.max(m, row.length), 1);
    const rows = packedRows.length;
    const maxZoneW = Math.min(vw * 0.68, 460 * Math.max(1, groupScale));
    const maxZoneH = Math.min(vh * 0.36, 290 * Math.max(1, groupScale), Math.max(96, zoneBottomSy - 76));
    const cellPx = totalDice === 1 ? 96 * sizeScale : Math.min(84 * groupScale, maxZoneW / (cols * 1.14), maxZoneH / (rows * 1.06));
    const cellStepX = cellPx * 1.14;
    const cellStepY = cellPx * 1.06;
    const dieScale = (cellPx * 0.78 / pxPerUnit) / 2.2;

    const zoneH = rows * cellStepY;
    const zoneCx = vw * 0.5;
    const zoneCy = Math.max(zoneH * 0.5 + 76, zoneBottomSy - zoneH * 0.5);

    const isRemoteMode = mode === 'remote';
    const aimX = targetX !== null ? targetX : vw * 0.5;
    const aimY = targetY !== null ? targetY : vh * 0.35;
    const anchorX = Number.isFinite(Number(originX)) ? Number(originX) : aimX;
    const remoteZoneHalfW = (cols * cellStepX) * 0.5 + 36;
    let remoteCx = Math.max(remoteZoneHalfW, Math.min(vw - remoteZoneHalfW, anchorX));
    if (isRemoteMode) {
      const activeRemotes = (this.activeFlights || []).filter((f) => f.mode === 'remote');
      if (activeRemotes.some((f) => Math.abs(f.remoteCx - remoteCx) < 130)) {
        const offsets = [150, -150, 290, -290, 420, -420];
        for (const off of offsets) {
          const cand = Math.max(remoteZoneHalfW, Math.min(vw - remoteZoneHalfW, remoteCx + off));
          if (activeRemotes.every((f) => Math.abs(f.remoteCx - cand) >= 120)) {
            remoteCx = cand;
            break;
          }
        }
      }
    }
    const remoteZoneCy = Math.max(108 + zoneH * 0.5, Math.min(vh * 0.30, 142 + zoneH * 0.38));
    const shadowTex = this.getShadowTexture();
    const baseShadowOpacity = isRemoteMode ? 0.62 : 0.68;

    let flatIdx = 0;
    for (let r = 0; r < rows; r++) {
      const rowMeshes = packedRows[r];
      const rowCount = rowMeshes.length;
      for (let c = 0; c < rowCount; c++) {
        const idx = flatIdx++;
        const die = rowMeshes[c];
        die.mesh.scale.setScalar(dieScale);
        group.add(die.mesh);

        const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: shadowTex,
            transparent: true,
            opacity: baseShadowOpacity,
            depthWrite: false
          })
        );
        group.add(shadowMesh);

        const fanNorm = totalDice === 1 ? 0 : (idx / (totalDice - 1)) * 2 - 1;
        let sx0;
        let sy0;
        let px0;
        let py0;
        let ctrlSx;
        let ctrlSy;
        let endSx;
        let endSy;
        let bounceT;
        let startDelay;
        let zArc;
        let launchAngle;
        let returnAngle;
        let restTwist;

        if (isRemoteMode) {
          // Remoto: entra desde arriba (avatar del jugador), rebota abajo y frena suave en el tercio superior
          sx0 = Math.max(48, Math.min(vw - 48, anchorX + fanNorm * Math.min(90, vw * 0.08) + (Math.random() - 0.5) * 32));
          sy0 = -28 - Math.random() * 24;

          const scatterSpread = totalDice === 1 ? (Math.random() - 0.5) * 80 : fanNorm * Math.min(vw * 0.24, 240);
          px0 = Math.max(72, Math.min(vw - 72, remoteCx + scatterSpread + (Math.random() - 0.5) * 70));
          py0 = Math.min(vh * 0.74, Math.max(vh * 0.58, vh - (165 + Math.random() * 60)));

          endSx = remoteCx + (c - (rowCount - 1) / 2) * cellStepX + (totalDice === 1 ? (Math.random() - 0.5) * 26 : (Math.random() - 0.5) * cellPx * 0.08);
          endSy = remoteZoneCy + (r - (rows - 1) / 2) * cellStepY + (totalDice === 1 ? (Math.random() - 0.5) * 18 : (Math.random() - 0.5) * cellPx * 0.08);

          const driftDir = px0 >= endSx ? 1 : -1;
          ctrlSx = (px0 + endSx) * 0.5 + driftDir * (28 + Math.random() * 44);
          ctrlSy = (py0 + endSy) * 0.5 - (18 + Math.random() * 34);

          bounceT = totalDice === 1 ? 0.38 : 0.34 + Math.random() * 0.08;
          startDelay = totalDice === 1 ? 0 : Math.random() * 0.08;
          zArc = 2.6 + Math.random() * 1.8;
          launchAngle = Math.PI * (2.1 + Math.random() * 0.6);
          returnAngle = Math.PI * (2.35 + Math.random() * 0.65);
          restTwist = (Math.random() - 0.5) * (totalDice === 1 ? 0.22 : 0.34);
        } else {
          // Local: trayectoria clásica desde abajo, rebota arriba y frena sobre la tarjeta central
          const jitterX = totalDice === 1 ? 0 : (Math.random() - 0.5) * cellPx * 0.04;
          const jitterY = totalDice === 1 ? 0 : (Math.random() - 0.5) * cellPx * 0.06;
          endSx = zoneCx + (c - (rowCount - 1) / 2) * cellStepX + jitterX;
          endSy = zoneCy + (r - (rows - 1) / 2) * cellStepY + jitterY;

          sx0 = Math.max(48, Math.min(vw - 48, vw * 0.5 + fanNorm * Math.min(260, vw * 0.24) + (Math.random() - 0.5) * 90));
          sy0 = vh + 36 + Math.random() * 48;

          const scatterSpread = totalDice === 1 ? 0 : fanNorm * Math.min(vw * 0.36, 400);
          px0 = Math.max(64, Math.min(vw - 64, aimX + scatterSpread + (Math.random() - 0.5) * 140));
          py0 = totalDice === 1
            ? Math.max(58, Math.min(aimY * 0.25, 110))
            : Math.max(58, Math.min(vh * 0.44, 72 + Math.random() * 195));

          const sideDir = px0 >= endSx ? -1 : 1;
          ctrlSx = (px0 + endSx) * 0.5 + sideDir * (35 + Math.random() * 65);
          ctrlSy = (py0 + endSy) * 0.5 - (25 + Math.random() * 45);

          bounceT = totalDice === 1 ? 0.32 : 0.28 + Math.random() * 0.1;
          startDelay = totalDice === 1 ? 0 : Math.random() * 0.07;
          zArc = 2.4 + Math.random() * 2.4;
          launchAngle = Math.PI * (1.85 + Math.random() * 0.55);
          returnAngle = Math.PI * (2.35 + Math.random() * 0.65);
          restTwist = (Math.random() - 0.5) * (totalDice === 1 ? 0.20 : 0.34);
        }

        const startW = screenToWorld(sx0, sy0);
        const peakW = screenToWorld(px0, py0);
        const endW = screenToWorld(endSx, endSy);
        const ctrlW = screenToWorld(ctrlSx, ctrlSy);

        const zTwist = (Math.random() - 0.5) * 95;
        const upAxis = new THREE.Vector3(py0 - sy0, px0 - sx0, zTwist).normalize();
        const downAxis = new THREE.Vector3(endSy - ctrlSy, endSx - ctrlSx, -zTwist * 0.6).normalize();
        const finalQuat = new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(0, 0, 1), restTwist)
          .multiply(die.targetQuat);
        const impactQuat = new THREE.Quaternion()
          .setFromAxisAngle(downAxis, -returnAngle)
          .multiply(finalQuat);

        actors.push({
          mesh: die.mesh,
          shadowMesh,
          targetQuat: finalQuat,
          targetMaterial: die.targetMaterial,
          otherMaterials: die.otherMaterials,
          bouncesSounded: 0,
          startDelay,
          bounceT,
          startW,
          peakW,
          ctrlW,
          endW,
          zArc,
          upAxis,
          downAxis,
          launchAngle,
          returnAngle,
          impactQuat
        });
      }
    }

    this.scene.add(group);

    const flight = {
      id: this._nextFlightId++,
      mode: isRemoteMode ? 'remote' : 'local',
      group,
      actors,
      totalDice,
      cellPx,
      dieScale,
      flyCamZ,
      remoteCx,
      baseShadowOpacity,
      overlayShown: !isRemoteMode && this.overlayEl ? this.overlayEl.classList.contains('is-open') : false,
      poseSettled: false,
      idle: false,
      done: false,
      fadeStarted: false,
      completedNotified: false,
      lastAudioTapMs: 0,
      tapAtten: 1 / Math.sqrt(Math.max(1, totalDice)),
      durationMs: isRemoteMode
        ? (totalDice === 1 ? 1180 : 1320)
        : (totalDice === 1 ? 1240 : 1420),
      glowDurationMs: isRemoteMode ? 0 : 780,
      remoteHoldMs: 200,
      remoteFadeMs: 280,
      startTime: null,
      onComplete
    };

    this.activeFlights.push(flight);
    this.syncCompatState();
    DiceAudio.playThrow();
    return flight;
  },

  drainPendingQueue() {
    let launched = false;
    while (this.pendingQueue.length > 0 && this.canStartFlightNow(this.pendingQueue[0].totalDice, 'remote')) {
      const next = this.pendingQueue.shift();
      const flight = this.launchFlight(next.items, next.opts);
      if (flight) launched = true;
      else if (typeof next?.opts?.onComplete === 'function') next.opts.onComplete();
    }
    return launched;
  },

  ensureLoopRunning() {
    if (this.animId) return;
    if (typeof document !== 'undefined' && document.hidden) {
      this.animId = requestAnimationFrame((t) => this.tickFlights(t));
    } else {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.tickFlights(now);
    }
  },

  stepFlight(flight, now) {
    if (!flight || flight.idle || flight.done) return false;
    const THREE = window.THREE;
    const isRemoteMode = flight.mode === 'remote';
    if (flight.startTime === null) flight.startTime = now;
    const elapsed = Math.max(0, now - flight.startTime);
    const rawT = Math.min(1, elapsed / flight.durationMs);
    const tmpQuat = this._tmpQuat || (this._tmpQuat = new THREE.Quaternion());

    const triggerBounceAudio = (baseLevel) => {
      if (now - flight.lastAudioTapMs < 18) return;
      flight.lastAudioTapMs = now;
      DiceAudio.playWoodTap(Math.max(0.08, Math.min(0.95, baseLevel * flight.tapAtten)), 0);
    };

    const applyActorsHighlight = (progress) => {
      const { emissiveIntensity, neighborShade } = this.computeResultHighlight(progress);
      for (let i = 0; i < flight.actors.length; i++) {
        const a = flight.actors[i];
        if (a.targetMaterial) a.targetMaterial.emissiveIntensity = emissiveIntensity;
        for (let m = 0; m < a.otherMaterials.length; m++) {
          a.otherMaterials[m].color.setRGB(neighborShade, neighborShade, neighborShade);
        }
      }
    };

    if (!flight.poseSettled) {
      for (let i = 0; i < flight.actors.length; i++) {
        const a = flight.actors[i];
        const localT = Math.min(1, Math.max(0, (rawT - a.startDelay) / (1 - a.startDelay)));

        if (localT <= a.bounceT) {
          const u1 = localT / a.bounceT;
          const airEase = Math.pow(u1, isRemoteMode ? 0.92 : 0.86);
          a.mesh.position.x = a.startW.x + (a.peakW.x - a.startW.x) * airEase;
          a.mesh.position.y = a.startW.y + (a.peakW.y - a.startW.y) * airEase;
          a.mesh.position.z = Math.sin(u1 * Math.PI) * a.zArc;

          const launchSpin = Math.pow(u1, isRemoteMode ? 0.9 : 0.85);
          tmpQuat.setFromAxisAngle(a.upAxis, -a.launchAngle * (1 - launchSpin));
          a.mesh.quaternion.copy(a.impactQuat).premultiply(tmpQuat);
        } else {
          if (a.bouncesSounded === 0) {
            a.bouncesSounded = 1;
            triggerBounceAudio(0.78 + Math.random() * 0.18);
            if (!isRemoteMode && !flight.overlayShown && this.overlayEl) {
              this.overlayEl.classList.add('is-open');
              flight.overlayShown = true;
            }
          }
          const u2 = (localT - a.bounceT) / (1 - a.bounceT);
          let sPos;
          let sRot;
          if (isRemoteMode) {
            const kin = this.computeRemoteReturnKinematics(u2, a.zArc);
            sPos = kin.sPos;
            sRot = kin.sRot;
            a.mesh.position.z = kin.z;
            if (kin.bounceStage === 2 && a.bouncesSounded < 2) {
              a.bouncesSounded = 2;
              triggerBounceAudio(0.36 + Math.random() * 0.12);
            } else if (kin.bounceStage === 3 && a.bouncesSounded < 3 && flight.totalDice <= 6) {
              a.bouncesSounded = 3;
              triggerBounceAudio(0.16);
            }
          } else {
            sPos = 1 - Math.pow(1 - u2, 2.45);
            sRot = 1 - Math.pow(1 - u2, 2.75);
            if (u2 < 0.36) {
              a.mesh.position.z = Math.sin((u2 / 0.36) * Math.PI) * (a.zArc * 0.28);
            } else if (u2 < 0.58) {
              if (a.bouncesSounded < 2) {
                a.bouncesSounded = 2;
                triggerBounceAudio(0.42 + Math.random() * 0.12);
              }
              a.mesh.position.z = Math.sin(((u2 - 0.36) / 0.22) * Math.PI) * (a.zArc * 0.08);
            } else {
              if (a.bouncesSounded < 3 && flight.totalDice <= 6) {
                a.bouncesSounded = 3;
                triggerBounceAudio(0.18);
              }
              a.mesh.position.z = 0;
            }
          }
          const invS = 1 - sPos;
          a.mesh.position.x = invS * invS * a.peakW.x + 2 * invS * sPos * a.ctrlW.x + sPos * sPos * a.endW.x;
          a.mesh.position.y = invS * invS * a.peakW.y + 2 * invS * sPos * a.ctrlW.y + sPos * sPos * a.endW.y;

          tmpQuat.setFromAxisAngle(a.downAxis, -a.returnAngle * (1 - sRot));
          a.mesh.quaternion.copy(a.targetQuat).premultiply(tmpQuat);
        }
        this.updateActorShadow(a, flight.dieScale, flight.flyCamZ);
      }
      if (rawT >= 1) {
        flight.poseSettled = true;
      }
      return true;
    }

    if (isRemoteMode) {
      const postMs = Math.max(0, elapsed - flight.durationMs);
      const effHoldMs = this.pendingQueue.length > 0 ? 110 : flight.remoteHoldMs;
      if (postMs < effHoldMs) {
        applyActorsHighlight(postMs / (effHoldMs + flight.remoteFadeMs));
        return true;
      }
      const fadeT = Math.min(1, (postMs - effHoldMs) / flight.remoteFadeMs);
      const alpha = 1 - fadeT * fadeT * (3 - 2 * fadeT);
      if (!flight.fadeStarted) {
        flight.fadeStarted = true;
        for (let i = 0; i < flight.actors.length; i++) {
          const mats = flight.actors[i].mesh.material;
          const list = Array.isArray(mats) ? mats : (mats ? [mats] : []);
          for (let m = 0; m < list.length; m++) {
            list[m].transparent = true;
            list[m].depthWrite = false;
            list[m].needsUpdate = true;
          }
        }
      }
      const fadeScale = flight.dieScale * (0.88 + 0.12 * alpha);
      for (let i = 0; i < flight.actors.length; i++) {
        const a = flight.actors[i];
        a.mesh.scale.setScalar(fadeScale);
        const mats = a.mesh.material;
        const list = Array.isArray(mats) ? mats : (mats ? [mats] : []);
        for (let m = 0; m < list.length; m++) {
          list[m].opacity = alpha;
        }
        if (a.shadowMesh?.material) {
          a.shadowMesh.material.opacity = flight.baseShadowOpacity * alpha;
        }
      }
      if (fadeT >= 1) {
        flight.done = true;
      }
      return true;
    }

    const g = Math.min(1, (elapsed - flight.durationMs) / flight.glowDurationMs);
    applyActorsHighlight(g);
    if (g >= 1) {
      flight.idle = true;
      if (typeof flight.onComplete === 'function' && !flight.completedNotified) {
        flight.completedNotified = true;
        flight.onComplete();
      }
    }
    return true;
  },

  tickFlights(now = performance.now()) {
    let anyDirty = false;
    const flights = [...(this.activeFlights || [])];
    for (let i = 0; i < flights.length; i++) {
      if (this.stepFlight(flights[i], now)) {
        anyDirty = true;
      }
    }

    const completed = (this.activeFlights || []).filter((f) => f.done);
    for (let i = 0; i < completed.length; i++) {
      const f = completed[i];
      this.disposeFlight(f);
      anyDirty = true;
      if (typeof f.onComplete === 'function' && !f.completedNotified) {
        f.completedNotified = true;
        f.onComplete();
      }
    }

    if (this.drainPendingQueue()) {
      anyDirty = true;
    }

    this.syncCompatState();
    if (anyDirty && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    const needsNextFrame = (this.activeFlights || []).some((f) => !f.idle) || (this.pendingQueue || []).length > 0;
    if (needsNextFrame) {
      this.animId = requestAnimationFrame((t) => this.tickFlights(t));
    } else {
      this.animId = null;
      if ((this.activeFlights || []).length === 0 && this.canvas) {
        this.canvas.classList.add('hidden');
        this.canvas.style.opacity = '';
      }
    }
  }
};
