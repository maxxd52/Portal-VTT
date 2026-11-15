/* ==========================================================================
   EMPAQUETADOR BINARIO .OWLTABLE (ZIP + WEBP)
   ========================================================================== */

import { Selector } from '../core/selector.js';
import { WebPConverter } from '../utils/webpConverter.js';

export const CartridgePacker = {
  async buildOwltableBlob(state) {
    const world = Selector.extractSerializableWorld(state);
    const zipTree = {};
    const strEnc = (txt) => new TextEncoder().encode(txt);

    if (world.customMapUrl && (world.customMapUrl.startsWith('data:') || world.customMapUrl.startsWith('blob:'))) {
      try {
        const mapBytes = await WebPConverter.sourceToWebPBytes(world.customMapUrl, 1600, 0.8);
        zipTree['assets/maps/map.webp'] = mapBytes;
        world.customMapUrl = 'owltable://assets/maps/map.webp';
      } catch (_) {}
    }

    for (const tok of world.tokens) {
      if (tok.imageUrl && (tok.imageUrl.startsWith('data:') || tok.imageUrl.startsWith('blob:'))) {
        try {
          const tokBytes = await WebPConverter.sourceToWebPBytes(tok.imageUrl, 256, 0.82);
          const relPath = `assets/tokens/${tok.id}.webp`;
          zipTree[relPath] = tokBytes;
          tok.imageUrl = `owltable://${relPath}`;
        } catch (_) {}
      }
    }

    const manifest = {
      format: 'owltable-cartridge-v2',
      title: state.room.moduleTitle || 'Modulo_VTT',
      createdAt: new Date().toISOString(),
      tokenCount: world.tokens.length
    };

    zipTree['manifest.json'] = strEnc(JSON.stringify(manifest, null, 2));
    zipTree['world.json'] = strEnc(JSON.stringify(world, null, 2));

    if (typeof window.fflate !== 'undefined' && window.fflate.zipSync) {
      const zipped = window.fflate.zipSync(zipTree, { level: 6 });
      return new Blob([zipped], { type: 'application/octet-stream' });
    }

    return new Blob([JSON.stringify({ format: 'owltable-module-v1', world }, null, 2)], {
      type: 'application/json'
    });
  },

  async parseCartridgeBuffer(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && typeof window.fflate !== 'undefined') {
      const unzipped = window.fflate.unzipSync(bytes);
      if (!unzipped['world.json']) {
        throw new Error('Cartucho .owltable inválido: falta world.json.');
      }
      const worldText = new TextDecoder().decode(unzipped['world.json']);
      const world = JSON.parse(worldText);

      const resolveInternalAsset = (uri) => {
        if (!uri || !uri.startsWith('owltable://')) return uri;
        const internalPath = uri.replace('owltable://', '');
        const assetBytes = unzipped[internalPath];
        if (!assetBytes) return '';
        const blob = new Blob([assetBytes], { type: 'image/webp' });
        return URL.createObjectURL(blob);
      };

      if (world.customMapUrl) {
        world.customMapUrl = resolveInternalAsset(world.customMapUrl);
      }
      if (Array.isArray(world.tokens)) {
        world.tokens.forEach((t) => {
          if (t.imageUrl) t.imageUrl = resolveInternalAsset(t.imageUrl);
        });
      }
      return { world };
    }

    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  }
};
