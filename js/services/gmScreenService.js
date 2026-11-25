/* ==========================================================================
   GM SCREEN SERVICE: ESTADO PRIVADO DEL NARRADOR, PINES Y HERRAMIENTAS
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261125a1';
import { createDefaultGmScreen, GM_WIDGET_TYPES } from '../data/gmScreenPresets.js?v=20261125a1';
import { BrowserVault } from './browserVault.js?v=20261125a1';
import { RealtimeBridge } from './realtimeBridge.js?v=20261125a1';

const makeGmId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const GmScreenServiceMethods = {
  ensureGmScreenInitialized(silent = false) {
    if (
      !this.state.gmScreen ||
      typeof this.state.gmScreen !== 'object' ||
      !Array.isArray(this.state.gmScreen.tabs) ||
      this.state.gmScreen.tabs.length === 0
    ) {
      this.state.gmScreen = Selector.getGmScreenState(this.state);
    }
    this.state.publicClocks = Selector.getPublicClocks(this.state);
    if (!silent) this.notify();
    return this.state.gmScreen;
  },

  savePrivateGmState() {
    if (this.state.role === 'gm' && this.state.room?.code) {
      BrowserVault.saveRoom(
        this.state.room.code,
        Selector.extractSerializableWorld(this.state, { includePrivateGm: true })
      );
    }
  },

  toggleGmScreen(forceOpen) {
    if (this.state.role !== 'gm') {
      this.state.gmScreenOpen = false;
      this.notify({ skipVaultSave: true });
      return false;
    }
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !this.state.gmScreenOpen;
    this.state.gmScreenOpen = nextOpen;
    if (nextOpen) {
      this.state.sheetOpen = false;
      this.ensureGmScreenInitialized(true);
    }
    this.notify({ skipVaultSave: true });
    return nextOpen;
  },

  setGmScreenTab(tabId) {
    const gm = this.ensureGmScreenInitialized(true);
    if (!gm.tabs.some((t) => t.id === tabId)) return false;
    gm.activeTabId = tabId;
    this.notify();
    return true;
  },

  pinToGmScreen({ kind = 'actor', key = '', tabId = '', title = '', url = '' } = {}) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const validKind = ['actor', 'item', 'map', 'handout'].includes(kind) ? kind : 'actor';
    const stagingTabs = Selector.getGmStagingTabs(this.state);
    const targetTab =
      (tabId && gm.tabs.find((t) => t.id === tabId)) ||
      stagingTabs[0] ||
      gm.tabs[0];
    if (!targetTab) return null;

    const cleanKey = String(key || '').trim();
    const cleanUrl = String(url || '').trim();
    const existing = gm.pins.find((p) => {
      if (p.tabId !== targetTab.id || p.kind !== validKind) return false;
      return validKind === 'handout' ? p.url === cleanUrl : p.key === cleanKey;
    });
    if (existing) {
      return { alreadyPinned: true, pin: existing, tab: targetTab };
    }

    const pin = {
      id: makeGmId('pin'),
      tabId: targetTab.id,
      kind: validKind,
      key: cleanKey,
      title: String(title || '').trim(),
      url: cleanUrl
    };
    gm.pins.push(pin);
    this.notify();
    return { alreadyPinned: false, pin, tab: targetTab };
  },

  unpinFromGmScreen(pinId) {
    const gm = this.ensureGmScreenInitialized(true);
    const prevLen = gm.pins.length;
    gm.pins = gm.pins.filter((p) => p.id !== pinId);
    if (gm.pins.length === prevLen) return false;
    this.notify();
    return true;
  },

  resetGmScreenToPreset(preservePinsAndNotes = true) {
    const prev = preservePinsAndNotes && this.state.gmScreen ? this.state.gmScreen : null;
    const next = createDefaultGmScreen('free');
    if (prev) {
      const fallbackStagingTabId =
        next.tabs.find((t) => t.allowCompendium)?.id || next.tabs[0]?.id || 'prep';
      const validIds = new Set(next.tabs.map((t) => t.id));
      next.pins = (prev.pins || []).map((p) => ({
        ...p,
        tabId: validIds.has(p.tabId) ? p.tabId : fallbackStagingTabId
      }));
      if (Array.isArray(prev.notes) && prev.notes.length > 0) {
        next.notes = JSON.parse(JSON.stringify(prev.notes));
      }
      if (Array.isArray(prev.clocks) && prev.clocks.length > 0) {
        next.clocks = JSON.parse(JSON.stringify(prev.clocks));
      }
    }
    this.state.gmScreen = next;
    this.state.publicClocks = Selector.getPublicClocks(this.state);
    this.broadcastPublicClocks();
    this.notify();
    return next;
  },

  broadcastPublicClocks() {
    this.state.publicClocks = Selector.getPublicClocks(this.state);
    if (this.state.role === 'gm') {
      RealtimeBridge.send({ kind: 'PUBLIC_CLOCKS_SYNC', publicClocks: this.state.publicClocks });
    }
    return this.state.publicClocks;
  },

  addGmClock({ label = '', kind = 'clock', segments = 6, color = '#8b5cf6', isPublic = false } = {}) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const cleanLabel = String(label || '').trim();
    if (!cleanLabel) return null;
    const cleanKind = kind === 'counter' ? 'counter' : 'clock';
    const segs = Math.max(2, Math.min(12, Math.trunc(Number(segments) || 6)));
    const created = {
      id: makeGmId('clk'),
      label: cleanLabel,
      kind: cleanKind,
      segments: segs,
      value: 0,
      color: String(color || '#8b5cf6'),
      isPublic: Boolean(isPublic)
    };
    gm.clocks.push(created);
    if (created.isPublic) this.broadcastPublicClocks();
    else this.state.publicClocks = Selector.getPublicClocks(this.state);
    this.notify();
    return created;
  },

  stepGmClock(clockId, delta = 1) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const clk = gm.clocks.find((c) => c.id === clockId);
    if (!clk) return null;
    const step = Math.trunc(Number(delta) || 0);
    const maxVal = clk.kind === 'counter' ? 999 : Math.max(2, Math.min(12, Number(clk.segments) || 6));
    clk.value = Math.max(0, Math.min(maxVal, (Number(clk.value) || 0) + step));
    if (clk.isPublic) this.broadcastPublicClocks();
    else this.state.publicClocks = Selector.getPublicClocks(this.state);
    this.notify();
    return clk;
  },

  toggleGmClockPublic(clockId) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const clk = gm.clocks.find((c) => c.id === clockId);
    if (!clk) return null;
    clk.isPublic = !clk.isPublic;
    this.broadcastPublicClocks();
    this.notify();
    return clk;
  },

  deleteGmClock(clockId) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const target = gm.clocks.find((c) => c.id === clockId);
    if (!target) return false;
    gm.clocks = gm.clocks.filter((c) => c.id !== clockId);
    if (target.isPublic) this.broadcastPublicClocks();
    else this.state.publicClocks = Selector.getPublicClocks(this.state);
    this.notify();
    return true;
  },

  addGmNote(kind = 'note', title = '') {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const cleanKind = kind === 'checklist' ? 'checklist' : 'note';
    const cleanTitle = String(title || '').trim() || (cleanKind === 'checklist' ? 'Checklist' : 'Nota');
    const created = {
      id: makeGmId('note'),
      title: cleanTitle,
      kind: cleanKind,
      body: '',
      items: []
    };
    gm.notes.push(created);
    this.notify();
    return created;
  },

  updateGmNote(noteId, patch = {}) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const note = gm.notes.find((n) => n.id === noteId);
    if (!note) return null;
    if (patch.title !== undefined) note.title = String(patch.title || '').trim() || 'Nota';
    if (patch.body !== undefined) note.body = String(patch.body ?? '');
    this.notify();
    return note;
  },

  deleteGmNote(noteId) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const prev = gm.notes.length;
    gm.notes = gm.notes.filter((n) => n.id !== noteId);
    if (gm.notes.length === prev) return false;
    this.notify();
    return true;
  },

  addGmChecklistItem(noteId, text) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const note = gm.notes.find((n) => n.id === noteId);
    const cleanText = String(text || '').trim();
    if (!note || !cleanText) return null;
    if (!Array.isArray(note.items)) note.items = [];
    const item = { id: makeGmId('ci'), text: cleanText, done: false };
    note.items.push(item);
    this.notify();
    return item;
  },

  toggleGmChecklistItem(noteId, itemId) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const note = gm.notes.find((n) => n.id === noteId);
    const item = note?.items?.find((i) => i.id === itemId);
    if (!item) return null;
    item.done = !item.done;
    this.notify();
    return item;
  },

  removeGmChecklistItem(noteId, itemId) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const note = gm.notes.find((n) => n.id === noteId);
    if (!note || !Array.isArray(note.items)) return false;
    const prev = note.items.length;
    note.items = note.items.filter((i) => i.id !== itemId);
    if (note.items.length === prev) return false;
    this.notify();
    return true;
  },

  addGmTable(title = '', entries = []) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const cleanTitle = String(title || '').trim() || 'Tabla aleatoria';
    const rawList = Array.isArray(entries) ? entries : String(entries || '').split('\n');
    const cleanEntries = rawList.map((e) => String(e || '').trim()).filter(Boolean);
    const created = {
      id: makeGmId('tbl'),
      title: cleanTitle,
      entries: cleanEntries,
      lastRoll: null
    };
    gm.tables.push(created);
    this.notify();
    return created;
  },

  updateGmTable(tableId, patch = {}) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const tbl = gm.tables.find((t) => t.id === tableId);
    if (!tbl) return null;
    if (patch.title !== undefined) tbl.title = String(patch.title || '').trim() || 'Tabla aleatoria';
    if (patch.entries !== undefined) {
      const rawList = Array.isArray(patch.entries) ? patch.entries : String(patch.entries || '').split('\n');
      tbl.entries = rawList.map((e) => String(e || '').trim()).filter(Boolean);
      if (tbl.entries.length === 0) tbl.lastRoll = null;
    }
    this.notify();
    return tbl;
  },

  deleteGmTable(tableId) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const prev = gm.tables.length;
    gm.tables = gm.tables.filter((t) => t.id !== tableId);
    if (gm.tables.length === prev) return false;
    this.notify();
    return true;
  },

  rollGmTable(tableId, rng = Math.random) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const tbl = gm.tables.find((t) => t.id === tableId);
    if (!tbl) return null;
    const entries = (Array.isArray(tbl.entries) ? tbl.entries : []).map((e) => String(e || '').trim()).filter(Boolean);
    if (entries.length === 0) {
      tbl.lastRoll = null;
      this.notify();
      return null;
    }
    const r = Math.min(0.9999999, Math.max(0, Number(rng())));
    const idx = Math.floor(r * entries.length);
    tbl.lastRoll = { index: idx + 1, total: entries.length, text: entries[idx] };
    this.notify();
    return { tableTitle: tbl.title, ...tbl.lastRoll };
  },

  shareGmTableResultToChat(tableId) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const tbl = gm.tables.find((t) => t.id === tableId);
    if (!tbl?.lastRoll?.text) return null;
    return this.sendChatMessage?.(`🎲 ${tbl.title} (#${tbl.lastRoll.index}/${tbl.lastRoll.total}): ${tbl.lastRoll.text}`, {
      channel: 'table'
    });
  },

  addGmReference(title = '', items = []) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const cleanTitle = String(title || '').trim() || 'Referencia';
    const cleanItems = (Array.isArray(items) ? items : [])
      .map((it) => ({
        label: String(it?.label || '').trim(),
        detail: String(it?.detail || '').trim()
      }))
      .filter((it) => it.label || it.detail);
    const created = { id: makeGmId('ref'), title: cleanTitle, items: cleanItems };
    gm.references.push(created);
    this.notify();
    return created;
  },

  updateGmReference(refId, patch = {}) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const ref = gm.references.find((r) => r.id === refId);
    if (!ref) return null;
    if (patch.title !== undefined) ref.title = String(patch.title || '').trim() || 'Referencia';
    if (Array.isArray(patch.items)) {
      ref.items = patch.items
        .map((it) => ({ label: String(it?.label || '').trim(), detail: String(it?.detail || '').trim() }))
        .filter((it) => it.label || it.detail);
    }
    this.notify();
    return ref;
  },

  deleteGmReference(refId) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const prev = gm.references.length;
    gm.references = gm.references.filter((r) => r.id !== refId);
    if (gm.references.length === prev) return false;
    this.notify();
    return true;
  },

  toggleGmWidgetEnabled(widgetId, enabled) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const w = gm.widgets.find((item) => item.id === widgetId);
    if (!w) return null;
    w.enabled = enabled !== undefined ? Boolean(enabled) : w.enabled === false;
    this.notify();
    return w;
  },

  addGmScreenTab(label, allowCompendium = false) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const cleanLabel = String(label || '').trim();
    if (!cleanLabel) return null;
    const tab = {
      id: makeGmId('tab'),
      label: cleanLabel,
      allowCompendium: Boolean(allowCompendium)
    };
    gm.tabs.push(tab);
    if (tab.allowCompendium) {
      gm.widgets.push({
        id: makeGmId('w'),
        tabId: tab.id,
        type: 'staging',
        enabled: true,
        title: `Bandeja · ${cleanLabel}`,
        config: {}
      });
    }
    this.notify();
    return tab;
  },

  renameGmScreenTab(tabId, label) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const tab = gm.tabs.find((t) => t.id === tabId);
    const clean = String(label || '').trim();
    if (!tab || !clean) return false;
    tab.label = clean;
    this.notify();
    return true;
  },

  toggleGmScreenTabCompendium(tabId) {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const tab = gm.tabs.find((t) => t.id === tabId);
    if (!tab) return null;
    tab.allowCompendium = !tab.allowCompendium;
    this.notify();
    return tab;
  },

  moveGmScreenTab(tabId, delta = -1) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const idx = gm.tabs.findIndex((t) => t.id === tabId);
    const target = idx + (delta < 0 ? -1 : 1);
    if (idx < 0 || target < 0 || target >= gm.tabs.length) return false;
    const [moved] = gm.tabs.splice(idx, 1);
    gm.tabs.splice(target, 0, moved);
    this.notify();
    return true;
  },

  removeGmScreenTab(tabId) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    if (gm.tabs.length <= 1) return false;
    if (!gm.tabs.some((t) => t.id === tabId)) return false;
    gm.tabs = gm.tabs.filter((t) => t.id !== tabId);
    gm.widgets = gm.widgets.filter((w) => w.tabId !== tabId);
    gm.pins = gm.pins.filter((p) => p.tabId !== tabId);
    if (!gm.tabs.some((t) => t.id === gm.activeTabId)) {
      gm.activeTabId = gm.tabs[0].id;
    }
    this.notify();
    return true;
  },

  addGmWidget(tabId, type, title = '') {
    if (this.state.role !== 'gm') return null;
    const gm = this.ensureGmScreenInitialized(true);
    const def = GM_WIDGET_TYPES[type];
    if (!def || !gm.tabs.some((t) => t.id === tabId)) return null;
    const w = {
      id: makeGmId('w'),
      tabId,
      type: def.type,
      enabled: true,
      title: String(title || '').trim() || def.label,
      config: {}
    };
    gm.widgets.push(w);
    this.notify();
    return w;
  },

  moveGmWidget(widgetId, delta = -1) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const cur = gm.widgets.find((w) => w.id === widgetId);
    if (!cur) return false;
    const siblings = gm.widgets.filter((w) => w.tabId === cur.tabId);
    const sIdx = siblings.findIndex((w) => w.id === widgetId);
    const sTarget = sIdx + (delta < 0 ? -1 : 1);
    if (sIdx < 0 || sTarget < 0 || sTarget >= siblings.length) return false;
    const aIdx = gm.widgets.indexOf(siblings[sIdx]);
    const bIdx = gm.widgets.indexOf(siblings[sTarget]);
    [gm.widgets[aIdx], gm.widgets[bIdx]] = [gm.widgets[bIdx], gm.widgets[aIdx]];
    this.notify();
    return true;
  },

  removeGmWidget(widgetId) {
    if (this.state.role !== 'gm') return false;
    const gm = this.ensureGmScreenInitialized(true);
    const prev = gm.widgets.length;
    gm.widgets = gm.widgets.filter((w) => w.id !== widgetId);
    if (gm.widgets.length === prev) return false;
    this.notify();
    return true;
  }
};
