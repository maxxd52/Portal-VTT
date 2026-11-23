/* ==========================================================================
   CONVERSOR WEBP EN NAVEGADOR
   ========================================================================== */

export const WebPConverter = {
  MAP_MAX_DIM: 4096,
  MAP_QUALITY: 0.85,

  resolveAdaptiveQuality(width, height, baseQuality = 0.85) {
    const maxSide = Math.max(Number(width) || 0, Number(height) || 0);
    const base = Number.isFinite(Number(baseQuality)) ? Number(baseQuality) : 0.85;
    return maxSide > 2400 ? Math.min(base, 0.85) : base;
  },

  dataUrlToWebPBytes(src) {
    const raw = String(src || '').trim();
    const prefix = 'data:image/webp;base64,';
    if (!raw.toLowerCase().startsWith(prefix)) return null;
    const b64 = raw.slice(prefix.length).replace(/\s+/g, '');
    if (!b64) return null;
    try {
      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(b64, 'base64');
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch (_) {
      return null;
    }
  },

  async fileToWebPDataUrl(file, maxDim = 4096, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagen no soportado.'));
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const q = this.resolveAdaptiveQuality(w, h, quality);
          resolve(canvas.toDataURL('image/webp', q));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  async sourceToWebPDataUrl(src, maxDim = 4096, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!String(src || '').startsWith('data:') && !String(src || '').startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onerror = () => reject(new Error('No se pudo cargar recurso visual (CORS o enlace inválido).'));
      img.onload = () => {
        try {
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const q = this.resolveAdaptiveQuality(w, h, quality);
          resolve(canvas.toDataURL('image/webp', q));
        } catch (err) {
          reject(err);
        }
      };
      img.src = src;
    });
  },

  async sourceToWebPBytes(src, maxDim = 4096, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!String(src || '').startsWith('data:') && !String(src || '').startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onerror = () => reject(new Error('No se pudo procesar recurso visual.'));
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const q = this.resolveAdaptiveQuality(w, h, quality);
        canvas.toBlob(
          async (blob) => {
            if (!blob) return reject(new Error('Fallo al codificar WebP.'));
            const buf = await blob.arrayBuffer();
            resolve(new Uint8Array(buf));
          },
          'image/webp',
          q
        );
      };
      img.src = src;
    });
  }
};
