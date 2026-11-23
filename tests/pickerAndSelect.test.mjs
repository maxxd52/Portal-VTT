import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const {
  groupCompendiumItemsForPicker,
  filterSelectOptionGroups,
  shouldShowSelectSearch,
  computeAnchoredDropdownPosition
} = await import('../js/utils/pickerModel.js?v=20261123a7');

test('groupCompendiumItemsForPicker groups custom folders, Equipo base, and class folders with accent-insensitive search and selection counts', () => {
  const customItems = [
    { key: 'c_blade', name: 'Hoja Lunar', badge: '1d8', folder: 'Reliquias' },
    { key: 'c_elixir', name: 'Elixir Ámbar', badge: 'Cura +10', folder: '' }
  ];
  const baseItems = [
    { key: 'longsword', name: 'Espada Larga +1', badge: 'ATQ +5', folder: '' },
    { key: 'potion_heal', name: 'Poción de Curación', badge: 'Cura +8 HP', folder: '' },
    { key: '55_barb_1', name: 'Furia', badge: 'Niv 1', folder: 'Bárbaro' },
    { key: '55_bard_1', name: 'Inspiración Bárdica', badge: '1d6', folder: 'Bardo' }
  ];

  const all = groupCompendiumItemsForPicker({
    customItems,
    baseItems,
    query: '',
    selectedKeys: ['55_bard_1', 'potion_heal', 'potion_heal']
  });

  assert.equal(all.hasQuery, false);
  assert.equal(all.totalMatches, 6);
  assert.deepEqual(
    all.groups.map((g) => g.label),
    ['Reliquias', 'Personalizados', 'Equipo base', 'Bárbaro', 'Bardo']
  );

  const baseGrp = all.groups.find((g) => g.label === 'Equipo base');
  assert.equal(baseGrp.selectedTotal, 2);
  assert.equal(baseGrp.items.find((i) => i.key === 'potion_heal').selectedCount, 2);

  const bardGrp = all.groups.find((g) => g.label === 'Bardo');
  assert.equal(bardGrp.selectedTotal, 1);

  // Accent-insensitive search by folder name ("barbaro" -> matches "Bárbaro")
  const byFolder = groupCompendiumItemsForPicker({
    customItems,
    baseItems,
    query: 'barbaro',
    selectedKeys: []
  });
  assert.equal(byFolder.hasQuery, true);
  assert.equal(byFolder.groups.length, 1);
  assert.equal(byFolder.groups[0].label, 'Bárbaro');
  assert.equal(byFolder.totalMatches, 1);

  // Accent-insensitive search by item name ("pocion" -> matches "Poción de Curación")
  const byItem = groupCompendiumItemsForPicker({
    customItems,
    baseItems,
    query: 'pocion',
    selectedKeys: []
  });
  assert.equal(byItem.totalMatches, 1);
  assert.equal(byItem.groups[0].items[0].key, 'potion_heal');
});

test('filterSelectOptionGroups filters options and optgroups and shouldShowSelectSearch triggers at >= 9 options', () => {
  assert.equal(shouldShowSelectSearch(4), false);
  assert.equal(shouldShowSelectSearch(8), false);
  assert.equal(shouldShowSelectSearch(9), true);

  const groups = [
    {
      label: 'Escenarios SRD',
      options: [
        { value: 'bastion', label: 'Bastión Subterráneo' },
        { value: 'forest', label: 'Claro del Bosque' }
      ]
    },
    {
      label: 'D&D',
      options: [{ value: 'crypt', label: 'Cripta Antigua' }]
    }
  ];

  const filtered = filterSelectOptionGroups(groups, 'bastion');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].label, 'Escenarios SRD');
  assert.equal(filtered[0].options.length, 1);
  assert.equal(filtered[0].options[0].value, 'bastion');

  // Matching group label returns all options in that group
  const byGroup = filterSelectOptionGroups(groups, 'd&d');
  assert.equal(byGroup.length, 1);
  assert.equal(byGroup[0].options[0].value, 'crypt');
});

test('computeAnchoredDropdownPosition opens below trigger when space fits and flips upward near bottom edge', () => {
  const below = computeAnchoredDropdownPosition({
    triggerRect: { left: 120, top: 100, bottom: 130, width: 180 },
    menuWidth: 220,
    menuHeight: 160,
    viewportWidth: 1280,
    viewportHeight: 800
  });
  assert.equal(below.top, 134);
  assert.equal(below.left, 120);
  assert.equal(below.placement, 'bottom');

  const above = computeAnchoredDropdownPosition({
    triggerRect: { left: 1120, top: 720, bottom: 750, width: 140 },
    menuWidth: 220,
    menuHeight: 200,
    viewportWidth: 1280,
    viewportHeight: 800
  });
  assert.equal(above.placement, 'top');
  assert.equal(above.top, 516);
  assert.ok(above.left + 220 <= 1280 - 8, 'Menu must clamp inside right viewport edge');
});

test('UI wiring replaces native Complementos/Category selects with Apple glass picker & segmented control and installs PortalSelectViewMethods', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const viewJs = fs.readFileSync(path.resolve('js/core/view.js'), 'utf8');
  assert.match(html, /id="customTokenAllySeg"/, 'Category must use segmented control instead of native select');
  assert.match(html, /id="btnToggleCustomTokenItemsPicker"/, 'Complementos must use toggle button for folder picker');
  assert.match(html, /id="customTokenItemsPicker"/, 'Complementos must render inline glass picker container');
  assert.match(html, /id="inpCustomTokenItemSearch"/, 'Complementos picker must include search input');
  assert.match(viewJs, /PortalSelectViewMethods/, 'View must mix in unified Apple glass PortalSelectViewMethods');
});
