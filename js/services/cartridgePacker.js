/* ==========================================================================
   EMPAQUETADOR BINARIO .PORTAL (ZIP + WEBP)
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261121a6';
import { WebPConverter } from '../utils/webpConverter.js?v=20261121a6';

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export const CartridgePacker = {
  async buildPortalBlob(state) {
    const world = Selector.extractSerializableWorld(state, { includePrivateGm: true });
    const zipTree = {};
    const strEnc = (txt) => new TextEncoder().encode(txt);

    if (world.customMapUrl && (world.customMapUrl.startsWith('data:') || world.customMapUrl.startsWith('blob:'))) {
      try {
        const mapBytes = await WebPConverter.sourceToWebPBytes(world.customMapUrl, 1600, 0.8);
        zipTree['assets/maps/map.webp'] = mapBytes;
        world.customMapUrl = 'portal://assets/maps/map.webp';
      } catch (_) {}
    }

    const packedBySrc = new Map();
    const packTokenImage = async (src, relPath, maxDim = 384) => {
      if (!src || (!src.startsWith('data:') && !src.startsWith('blob:'))) return src;
      if (packedBySrc.has(src)) return packedBySrc.get(src);
      try {
        const bytes = await WebPConverter.sourceToWebPBytes(src, maxDim, 0.86);
        zipTree[relPath] = bytes;
        const uri = `portal://${relPath}`;
        packedBySrc.set(src, uri);
        return uri;
      } catch (_) {
        return src;
      }
    };

    if (world.mediaAssets && typeof world.mediaAssets === 'object') {
      for (const [id, asset] of Object.entries(world.mediaAssets)) {
        if (asset?.url) {
          const maxDim = asset.kind === 'map' ? 1600 : asset.kind === 'handout' || asset.kind === 'journal' ? 1200 : 384;
          asset.url = await packTokenImage(asset.url, `assets/media/${id}.webp`, maxDim);
        }
      }
    }

    for (const tok of world.tokens) {
      if (tok.imageUrl) {
        tok.imageUrl = await packTokenImage(tok.imageUrl, `assets/tokens/${tok.id}.webp`);
      }
    }

    if (Array.isArray(world.customActors)) {
      for (let i = 0; i < world.customActors.length; i++) {
        const actor = world.customActors[i];
        if (actor?.imageUrl) {
          actor.imageUrl = await packTokenImage(actor.imageUrl, `assets/actors/${i}.webp`);
        }
      }
    }

    if (Array.isArray(world.customMaps)) {
      for (let i = 0; i < world.customMaps.length; i++) {
        const map = world.customMaps[i];
        if (map?.imageUrl) {
          map.imageUrl = await packTokenImage(map.imageUrl, `assets/maps/custom_${i}.webp`, 1600);
        }
      }
    }

    if (world.sceneLayers && typeof world.sceneLayers === 'object') {
      let sceneIdx = 0;
      for (const layer of Object.values(world.sceneLayers)) {
        if (!Array.isArray(layer?.tokens)) continue;
        for (let ti = 0; ti < layer.tokens.length; ti++) {
          const tok = layer.tokens[ti];
          if (tok?.imageUrl) {
            tok.imageUrl = await packTokenImage(tok.imageUrl, `assets/scenes/${sceneIdx}_${ti}.webp`);
          }
        }
        sceneIdx += 1;
      }
    }

    if (world.journal && typeof world.journal === 'object') {
      if (Array.isArray(world.journal.gmNotes)) {
        for (let i = 0; i < world.journal.gmNotes.length; i++) {
          const n = world.journal.gmNotes[i];
          if (n?.imageUrl) {
            n.imageUrl = await packTokenImage(n.imageUrl, `assets/journal/gm_${i}.webp`, 1200);
          }
        }
      }
      if (world.journal.playerJournals && typeof world.journal.playerJournals === 'object') {
        for (const [seat, pj] of Object.entries(world.journal.playerJournals)) {
          if (!Array.isArray(pj?.notes)) continue;
          for (let i = 0; i < pj.notes.length; i++) {
            const n = pj.notes[i];
            if (n?.imageUrl) {
              n.imageUrl = await packTokenImage(n.imageUrl, `assets/journal/${seat}_${i}.webp`, 1200);
            }
          }
        }
      }
    }

    const manifest = {
      format: 'portal-cartridge-v2',
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

    return new Blob([JSON.stringify({ format: 'portal-module-v1', world }, null, 2)], {
      type: 'application/json'
    });
  },

  async parseCartridgeBuffer(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && typeof window.fflate !== 'undefined') {
      const unzipped = window.fflate.unzipSync(bytes);
      if (!unzipped['world.json']) {
        throw new Error('Cartucho .portal inválido: falta world.json.');
      }
      const worldText = new TextDecoder().decode(unzipped['world.json']);
      const world = JSON.parse(worldText);

      const resolvedByUri = new Map();
      const resolveInternalAsset = (uri) => {
        if (!uri || !uri.startsWith('portal://')) return uri;
        if (resolvedByUri.has(uri)) return resolvedByUri.get(uri);
        const internalPath = uri.replace('portal://', '');
        const assetBytes = unzipped[internalPath];
        if (!assetBytes) return '';
        const dataUrl = `data:image/webp;base64,${bytesToBase64(assetBytes)}`;
        resolvedByUri.set(uri, dataUrl);
        return dataUrl;
      };

      if (world.mediaAssets && typeof world.mediaAssets === 'object') {
        for (const asset of Object.values(world.mediaAssets)) {
          if (asset?.url) asset.url = resolveInternalAsset(asset.url);
        }
      }
      if (world.customMapUrl) {
        world.customMapUrl = resolveInternalAsset(world.customMapUrl);
      }
      if (Array.isArray(world.tokens)) {
        world.tokens.forEach((t) => {
          if (t.imageUrl) t.imageUrl = resolveInternalAsset(t.imageUrl);
        });
      }
      if (Array.isArray(world.customActors)) {
        world.customActors.forEach((a) => {
          if (a.imageUrl) a.imageUrl = resolveInternalAsset(a.imageUrl);
        });
      }
      if (Array.isArray(world.customMaps)) {
        world.customMaps.forEach((m) => {
          if (m?.imageUrl) m.imageUrl = resolveInternalAsset(m.imageUrl);
        });
      }
      if (world.sceneLayers && typeof world.sceneLayers === 'object') {
        for (const layer of Object.values(world.sceneLayers)) {
          if (!Array.isArray(layer?.tokens)) continue;
          layer.tokens.forEach((t) => {
            if (t?.imageUrl) t.imageUrl = resolveInternalAsset(t.imageUrl);
          });
        }
      }
      if (world.journal && typeof world.journal === 'object') {
        if (Array.isArray(world.journal.gmNotes)) {
          world.journal.gmNotes.forEach((n) => {
            if (n?.imageUrl) n.imageUrl = resolveInternalAsset(n.imageUrl);
          });
        }
        if (world.journal.playerJournals && typeof world.journal.playerJournals === 'object') {
          for (const pj of Object.values(world.journal.playerJournals)) {
            if (!Array.isArray(pj?.notes)) continue;
            pj.notes.forEach((n) => {
              if (n?.imageUrl) n.imageUrl = resolveInternalAsset(n.imageUrl);
            });
          }
        }
      }
      return { world };
    }

    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  }
};
