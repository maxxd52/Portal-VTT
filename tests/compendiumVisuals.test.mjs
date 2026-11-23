import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  resolveItemBadgeStyle,
  resolveMapCardDescriptor
} from '../js/utils/compendiumCardModel.js?v=20261123a7';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('resolveItemBadgeStyle defaults to compact md for Sheet & GM Screen', () => {
  const md = resolveItemBadgeStyle();
  assert.match(md.boxClass, /\bw-7\b/);
  assert.match(md.boxClass, /\bh-7\b/);
  assert.equal(md.iconClass, 'w-[18px] h-[18px]');
  assert.equal(md.ring, false);
});

test('resolveItemBadgeStyle("lg") returns 44x44px squircle aligned with Personajes tokens', () => {
  const lg = resolveItemBadgeStyle('lg');
  assert.match(lg.boxClass, /\bw-11\b/);
  assert.match(lg.boxClass, /\bh-11\b/);
  assert.match(lg.boxClass, /\brounded-xl\b/);
  assert.equal(lg.iconClass, 'w-[22px] h-[22px]');
  assert.equal(lg.ring, true);
});

test('resolveMapCardDescriptor marks isActive iff map.key matches activeSceneKey', () => {
  const map = { key: 'crypt', name: 'Cripta Antigua', desc: 'Cámaras funerarias' };
  const active = resolveMapCardDescriptor(map, 'crypt');
  const inactive = resolveMapCardDescriptor(map, 'forest');
  assert.equal(active.isActive, true);
  assert.equal(inactive.isActive, false);
});

test('resolveMapCardDescriptor classifies custom image, custom placeholder, and preset maps', () => {
  const withImg = resolveMapCardDescriptor(
    { key: 'custom_1', name: 'Torre', desc: '', isCustom: true, imageUrl: 'data:image/webp;base64,AAA' },
    ''
  );
  assert.equal(withImg.kind, 'image');
  assert.equal(withImg.src, 'data:image/webp;base64,AAA');

  const noImg = resolveMapCardDescriptor(
    { key: 'custom_2', name: 'Vacío', desc: '', isCustom: true, imageUrl: '   ' },
    ''
  );
  assert.equal(noImg.kind, 'placeholder');
  assert.equal(noImg.src, '');

  const preset = resolveMapCardDescriptor(
    { key: 'arena', name: 'Arena de Combate', desc: 'Coliseo' },
    'arena'
  );
  assert.equal(preset.kind, 'preset');
  assert.equal(preset.presetId, 'arena');
  assert.equal(preset.isActive, true);
});

test('CompendiumView uses size:"lg" and portal-map-card while Sheet & GM Screen keep compact md badges', () => {
  const compendiumSrc = read('js/ui/compendiumView.js');
  const sheetInvSrc = read('js/ui/sheetInventoryView.js');
  const gmScreenSrc = read('js/ui/gmScreenView.js');

  assert.match(compendiumSrc, /renderItemIconBadge\(\s*it\s*,\s*\{\s*size:\s*'lg'\s*\}\s*\)/);
  assert.match(compendiumSrc, /portal-map-card/);
  assert.doesNotMatch(sheetInvSrc, /size:\s*'lg'/);
  assert.doesNotMatch(gmScreenSrc, /size:\s*'lg'/);
});
