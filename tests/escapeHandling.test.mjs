import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

globalThis.window = globalThis.window || {
  location: { search: '', origin: 'http://localhost', pathname: '/' }
};
globalThis.document = globalThis.document || { activeElement: null };

const { Service } = await import('../js/core/service.js?v=20261123a7');
const { View } = await import('../js/core/view.js?v=20261123a7');
const { createInitialState } = await import('../js/core/model.js?v=20261123a7');
const { RealtimeBridge } = await import('../js/services/realtimeBridge.js?v=20261123a7');

function makeClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...cls) => cls.forEach((c) => set.add(c)),
    remove: (...cls) => cls.forEach((c) => set.delete(c)),
    toggle: (c, force) => {
      const next = typeof force === 'boolean' ? force : !set.has(c);
      if (next) set.add(c);
      else set.delete(c);
      return next;
    },
    contains: (c) => set.has(c)
  };
}

function makeMockEl(classes = []) {
  return { classList: makeClassList(classes) };
}

function setupViewHarness() {
  Service.state = createInitialState();
  Service.state.role = 'gm';
  Service.state.isHostGm = true;
  Service.notify = () => {};
  RealtimeBridge.send = () => {};

  const closedFlags = {
    noteModal: false,
    mapGrid: false,
    tokenEditor: false,
    contextMenu: false,
    dicePopover: false,
    diceHistory: false,
    combatPopover: false,
    chatDrawer: false
  };

  View.els = {
    journalPresentationModal: makeMockEl(),
    journalShareModal: makeMockEl(),
    handoutModal: makeMockEl(),
    tokenInspectModal: makeMockEl(),
    noteEditorModal: makeMockEl(['hidden']),
    mapGridModal: makeMockEl(),
    tokenEditorModal: makeMockEl(),
    systemModal: makeMockEl(),
    roomModal: makeMockEl(),
    driveModal: makeMockEl(),
    syncModal: makeMockEl(),
    contextIconMenu: makeMockEl(),
    optionsPopover: makeMockEl(),
    themePopover: makeMockEl(),
    profilePopover: makeMockEl(),
    playerTokenPickerPopover: makeMockEl(),
    combatTrackerPopover: makeMockEl(),
    chatDrawer: makeMockEl(),
    diceHistoryPopover: makeMockEl(),
    diceStylePopover: makeMockEl()
  };
  View.closeNoteModal = () => {
    closedFlags.noteModal = true;
    View.els.noteEditorModal.classList.add('hidden');
  };
  View.closeMapGridEditor = () => {
    closedFlags.mapGrid = true;
    View.els.mapGridModal.classList.remove('is-open');
  };
  View.closeTokenEditor = () => {
    closedFlags.tokenEditor = true;
    View.els.tokenEditorModal.classList.remove('is-open');
  };
  View.hideContextMenu = () => {
    closedFlags.contextMenu = true;
    View.els.contextIconMenu.classList.remove('is-open');
  };
  View.setDicePopoverOpen = (open) => {
    if (!open) closedFlags.dicePopover = true;
    View.els.diceStylePopover.classList.toggle('is-open', open);
  };
  View.setDiceHistoryOpen = (open) => {
    if (!open) closedFlags.diceHistory = true;
    View.els.diceHistoryPopover.classList.toggle('is-open', open);
  };
  View.setCombatPopoverOpen = (open) => {
    if (!open) closedFlags.combatPopover = true;
    View.els.combatTrackerPopover.classList.toggle('is-open', open);
  };
  View.setChatDrawerOpen = (open) => {
    if (!open) closedFlags.chatDrawer = true;
    Service.chatOpen = Boolean(open);
    View.els.chatDrawer.classList.toggle('is-open', Boolean(open));
  };

  return closedFlags;
}

test('Escape closes UI strictly layer-by-layer: modals -> overlays/temp tools -> side drawers', () => {
  const closed = setupViewHarness();

  // Open all three layers simultaneously
  View.els.systemModal.classList.add('is-open');
  View.els.optionsPopover.classList.add('is-open');
  View.els.contextIconMenu.classList.add('is-open');
  Service.chatOpen = true;
  View.els.chatDrawer.classList.add('is-open');
  Service.state.wallAnchor = { x: 10, y: 20 };
  Service.state.dice.hand = [{ sides: 20 }];
  Service.state.gmScreenOpen = true;
  Service.state.journalOpen = true;

  // 1st Escape: closes only the active top modal, leaving overlays and drawers intact
  assert.equal(View.handleEscapeKey(), 'modal');
  assert.equal(View.els.systemModal.classList.contains('is-open'), false);
  assert.equal(View.els.optionsPopover.classList.contains('is-open'), true);
  assert.equal(Service.state.gmScreenOpen, true);
  assert.equal(Service.state.journalOpen, true);

  // 2nd Escape: closes active overlays/popovers/chat/temp tools, leaving side drawers open
  assert.equal(View.handleEscapeKey(), 'overlay');
  assert.equal(View.els.optionsPopover.classList.contains('is-open'), false);
  assert.equal(closed.contextMenu, true);
  assert.equal(closed.chatDrawer, true);
  assert.equal(Service.chatOpen, false);
  assert.equal(Service.state.wallAnchor, null);
  assert.equal(Service.state.dice.hand.length, 0);
  assert.equal(Service.state.gmScreenOpen, true);
  assert.equal(Service.state.journalOpen, true);

  // 3rd Escape: closes all open side drawers (sheet, gmScreen, baúl, journal)
  assert.equal(View.handleEscapeKey(), 'drawers');
  assert.equal(Service.state.gmScreenOpen, false);
  assert.equal(Service.state.journalOpen, false);
  assert.equal(Service.state.sheetOpen, false);
  assert.equal(Service.state.drawerOpen, false);

  // 4th Escape: nothing open -> null
  assert.equal(View.handleEscapeKey(), null);
});

test('Escape closes noteEditorModal, handout, inspection, and presentation modals cleanly before drawers', () => {
  const closed = setupViewHarness();
  Service.state.sheetOpen = true;

  // noteEditorModal uses hidden/flex rather than is-open
  View.els.noteEditorModal.classList.remove('hidden');
  View.els.noteEditorModal.classList.add('flex');
  assert.equal(View.handleEscapeKey(), 'modal');
  assert.equal(closed.noteModal, true);
  assert.equal(Service.state.sheetOpen, true);

  // journalShareModal
  View.els.journalShareModal.classList.add('is-open');
  View.journalShareNoteId = 'n-share-1';
  assert.equal(View.handleEscapeKey(), 'modal');
  assert.equal(View.els.journalShareModal.classList.contains('is-open'), false);
  assert.equal(View.journalShareNoteId, '');
  assert.equal(Service.state.sheetOpen, true);

  // journalPresentationModal
  Service.state.activeJournalPresentation = { note: { id: 'n1', title: 'Pista' } };
  View.els.journalPresentationModal.classList.add('is-open');
  assert.equal(View.handleEscapeKey(), 'modal');
  assert.equal(Service.state.activeJournalPresentation, null);
  assert.equal(Service.state.sheetOpen, true);

  // tokenInspectModal
  Service.state.inspectTokenId = 'tok-1';
  View.els.tokenInspectModal.classList.add('is-open');
  assert.equal(View.handleEscapeKey(), 'modal');
  assert.equal(Service.state.inspectTokenId, null);
  assert.equal(Service.state.sheetOpen, true);

  // handoutModal
  Service.state.activeHandout = { url: 'data:image/webp;base64,AA', title: 'Carta' };
  View.els.handoutModal.classList.add('is-open');
  assert.equal(View.handleEscapeKey(), 'modal');
  assert.equal(Service.state.activeHandout, null);
  assert.equal(Service.state.sheetOpen, true);

  // Finally Escape closes sheetOpen
  assert.equal(View.handleEscapeKey(), 'drawers');
  assert.equal(Service.state.sheetOpen, false);
});

test('journalPresentationView does not register a duplicate global Escape keydown listener', () => {
  const src = fs.readFileSync(
    path.resolve(import.meta.dirname, '..', 'js/ui/journalPresentationView.js'),
    'utf8'
  );
  assert.equal(/window\.addEventListener\(\s*['"]keydown['"]/.test(src), false);
});

test('Space (toggleDrawersMinimize) minimizes active side drawers and restores the exact previous set', () => {
  setupViewHarness();
  Service._minimizedDrawersSnapshot = null;
  Service.state.tokens = [{ id: 'tok-hero', name: 'Hero', isAlly: true, ownerId: Service.clientId }];
  Service.state.selectedTokenId = 'tok-hero';
  Service.state.sheetOpen = true;
  Service.state.journalOpen = true;

  // Nothing open initially when both cleared -> null
  Service.state.sheetOpen = false;
  Service.state.journalOpen = false;
  assert.equal(Service.toggleDrawersMinimize(), null);

  // Open sheet + journal, then minimize with Space
  Service.state.sheetOpen = true;
  Service.state.journalOpen = true;
  assert.equal(View.handleSpaceKey(), 'minimized');
  assert.equal(Service.state.sheetOpen, false);
  assert.equal(Service.state.journalOpen, false);
  assert.equal(Service.state.gmScreenOpen, false);
  assert.equal(Service.state.drawerOpen, false);

  // Second Space restores the exact minimized panels
  assert.equal(View.handleSpaceKey(), 'restored');
  assert.equal(Service.state.sheetOpen, true);
  assert.equal(Service.state.journalOpen, true);
  assert.equal(Service.state.gmScreenOpen, false);
  assert.equal(Service.state.drawerOpen, false);
});

test('Space respects role permissions on restore, ignores when modal/chat open, and blurs focused button', () => {
  setupViewHarness();
  Service._minimizedDrawersSnapshot = null;
  Service.state.gmScreenOpen = true;
  Service.state.journalOpen = true;

  // Blurs focused button so Space does not re-trigger dice buttons
  let blurred = false;
  globalThis.document.activeElement = { tagName: 'BUTTON', blur: () => { blurred = true; } };
  assert.equal(View.handleSpaceKey(), 'minimized');
  assert.equal(blurred, true);
  globalThis.document.activeElement = null;

  // Role switches to player before restore: GM-only drawers must stay closed
  Service.state.role = 'player';
  assert.equal(View.handleSpaceKey(), 'restored');
  assert.equal(Service.state.gmScreenOpen, false);
  assert.equal(Service.state.journalOpen, true);

  // Blocked when modal or chat is open
  View.els.systemModal.classList.add('is-open');
  assert.equal(View.handleSpaceKey(), null);
  assert.equal(Service.state.journalOpen, true);
  View.els.systemModal.classList.remove('is-open');

  Service.chatOpen = true;
  View.els.chatDrawer.classList.add('is-open');
  assert.equal(View.handleSpaceKey(), null);
  assert.equal(Service.state.journalOpen, true);
  Service.chatOpen = false;
  View.els.chatDrawer.classList.remove('is-open');

  // Escape closing drawers clears minimized snapshot
  assert.equal(View.handleSpaceKey(), 'minimized');
  Service.state.journalOpen = true;
  assert.equal(View.handleEscapeKey(), 'drawers');
  assert.equal(View.handleSpaceKey(), null);
});
