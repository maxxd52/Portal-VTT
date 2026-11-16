import { BrowserVault } from './browserVault.js?v=20261115x';
import { CartridgePacker } from './cartridgePacker.js';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';

/**
 * Custom compendium CRUD, folder management & .owltable cartridge/shelf methods mixed into Service.
 */
export const CompendiumServiceMethods = {
  saveCustomActor(tpl) {
    const isAlly = tpl.isAlly !== false;
    const folder = String(tpl.folder || '').trim();
    const entry = {
      key: tpl.key || `custom-${Date.now().toString(36)}`,
      isCustom: true,
      folder,
      name: String(tpl.name || 'Personaje').trim(),
      role: String(tpl.role || (isAlly ? 'Aliado' : 'Enemigo')).trim(),
      color: tpl.color || (isAlly ? '#8b5cf6' : '#ef4444'),
      isAlly,
      visionRadius: isAlly ? 520 : 280,
      imageUrl: String(tpl.imageUrl || '').trim(),
      size: Number(tpl.size) || 1,
      hp: Math.max(1, Number(tpl.hp) || 16),
      ac: Math.max(1, Number(tpl.ac) || 12),
      stats: {
        str: Number(tpl.stats?.str) || 0,
        dex: Number(tpl.stats?.dex) || 0,
        con: Number(tpl.stats?.con) || 0,
        int: Number(tpl.stats?.int) || 0,
        wis: Number(tpl.stats?.wis) || 0,
        cha: Number(tpl.stats?.cha) || 0
      },
      starterItems: Array.isArray(tpl.starterItems) ? tpl.starterItems : []
    };
    const list = Array.isArray(this.state.customActors) ? this.state.customActors : [];
    const idx = list.findIndex((a) => a.key === entry.key);
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
    }
    this.state.customActors = list;
    if (folder) this.ensureCompendiumFolder('actors', folder, true);
    this.recordEvent('COMPENDIO', `Personaje guardado: ${entry.name}`);
    this.notify();
    return entry;
  },

  deleteCustomActor(key) {
    if (!Array.isArray(this.state.customActors)) return;
    this.state.customActors = this.state.customActors.filter((a) => a.key !== key);
    this.notify();
  },

  saveCustomItem(tpl) {
    const kind = tpl.kind || 'weapon';
    const folder = String(tpl.folder || '').trim();
    const die = Number(tpl.die) || 0;
    const bonusMod = Number(tpl.bonusMod) || 0;
    const acBonus = Number(tpl.acBonus) || 0;
    const heal = Number(tpl.heal) || 0;
    const lightRadius = Number(tpl.lightRadius) || 0;
    const statTarget = String(tpl.statTarget || (acBonus > 0 ? 'ac' : 'ac'));
    const statBonus = Number(tpl.statBonus !== undefined ? tpl.statBonus : acBonus) || 0;
    const targetLabels = { ac: 'CA', str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR', maxHp: 'HP' };
    let badge = String(tpl.badge || '').trim();
    if (!badge) {
      if (tpl.formula) badge = String(tpl.formula).trim();
      else if ((kind === 'armor' || kind === 'equipment') && statBonus !== 0) {
        badge = `${statBonus >= 0 ? '+' : ''}${statBonus} ${targetLabels[statTarget] || 'CA'}`;
      } else if (kind === 'consumable' && heal > 0) badge = `Cura +${heal} HP`;
      else if (kind === 'light') badge = `Luz +${Math.max(1, Math.round((lightRadius || 320) / 80))} cas`;
      else if (kind === 'ability') badge = 'Capacidad';
      else if (kind === 'consumable') badge = 'Consumible';
      else badge = 'Equipo';
    }
    const entry = {
      key: tpl.key || `citem-${Date.now().toString(36)}`,
      isCustom: true,
      folder,
      name: String(tpl.name || 'Complemento').trim(),
      kind,
      badge,
      message: String(tpl.message || '').trim(),
      formula: String(tpl.formula || '').trim(),
      bonusMod,
      die: Math.max(0, die),
      statTarget,
      statBonus: kind === 'armor' || kind === 'equipment' ? statBonus : 0,
      acBonus: (kind === 'armor' || kind === 'equipment') && statTarget === 'ac' ? statBonus : 0,
      heal: kind === 'consumable' ? heal : 0,
      lightRadius: kind === 'light' ? lightRadius || 320 : 0,
      icon: String(tpl.icon || '').trim(),
      color: tpl.color || '#8b5cf6'
    };
    const list = Array.isArray(this.state.customItems) ? this.state.customItems : [];
    const idx = list.findIndex((i) => i.key === entry.key);
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    this.state.customItems = list;
    if (folder) this.ensureCompendiumFolder('items', folder, true);
    this.recordEvent('COMPENDIO', `Complemento guardado: ${entry.name}`);
    this.notify();
    return entry;
  },

  deleteCustomItem(key) {
    if (!Array.isArray(this.state.customItems)) return;
    this.state.customItems = this.state.customItems.filter((i) => i.key !== key);
    this.notify();
  },

  saveCustomMap(tpl) {
    const folder = String(tpl.folder || '').trim();
    const entry = {
      key: tpl.key || `cmap-${Date.now().toString(36)}`,
      isCustom: true,
      folder,
      name: String(tpl.name || 'Escenario').trim(),
      desc: String(tpl.desc || 'Escenario personalizado').trim(),
      imageUrl: String(tpl.imageUrl || '').trim()
    };
    const list = Array.isArray(this.state.customMaps) ? this.state.customMaps : [];
    const idx = list.findIndex((m) => m.key === entry.key);
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    this.state.customMaps = list;
    if (folder) this.ensureCompendiumFolder('maps', folder, true);
    this.recordEvent('COMPENDIO', `Escenario guardado: ${entry.name}`);
    this.notify();
    return entry;
  },

  deleteCustomMap(key) {
    if (!Array.isArray(this.state.customMaps)) return;
    this.state.customMaps = this.state.customMaps.filter((m) => m.key !== key);
    this.notify();
  },

  async activateMapTemplate(tpl) {
    if (!tpl) return;
    if (tpl.isCustom && tpl.imageUrl) {
      await this.changeMap('custom', tpl.imageUrl, tpl.key);
    } else {
      await this.changeMap(tpl.key, '', tpl.key);
    }
  },

  ensureCompendiumFolder(tab, folderName, silent = false) {
    const name = String(folderName || '').trim();
    if (!name) return false;
    if (!this.state.compendiumFolders) {
      this.state.compendiumFolders = { actors: [], items: [], maps: [] };
    }
    const list = this.state.compendiumFolders[tab] || [];
    if (!list.includes(name)) {
      list.push(name);
      this.state.compendiumFolders[tab] = list;
      if (!silent) this.notify();
      return true;
    }
    return false;
  },

  deleteCompendiumFolder(tab, folderName) {
    if (this.state.compendiumFolders?.[tab]) {
      this.state.compendiumFolders[tab] = this.state.compendiumFolders[tab].filter((f) => f !== folderName);
    }
    const mapField = tab === 'actors' ? 'customActors' : tab === 'items' ? 'customItems' : 'customMaps';
    if (Array.isArray(this.state[mapField])) {
      this.state[mapField].forEach((entry) => {
        if (entry.folder === folderName) entry.folder = '';
      });
    }
    this.notify();
  },

  async loadModulePackage(pkg) {
    if (!pkg || !pkg.world) throw new Error('Archivo de cartucho inválido.');
    this.applyFullWorldState(pkg.world, false);
    this.recordEvent('CARGAR_CARTUCHO', pkg.world.moduleTitle || 'Cartucho');
  },

  async addShelfModule(title, rawUrl) {
    const directUrl = DriveUrlHelper.toDirectCartridgeUrl(rawUrl);
    if (!title || !directUrl) return;
    const entry = {
      id: `mod-${Date.now().toString().slice(-6)}`,
      title: title.trim(),
      url: rawUrl.trim(),
      directUrl
    };
    this.state.shelfModules.push(entry);
    await BrowserVault.saveShelf(this.state.shelfModules);
    this.notify({ skipVaultSave: true });
    return entry;
  },

  async removeShelfModule(id) {
    this.state.shelfModules = this.state.shelfModules.filter((m) => m.id !== id);
    await BrowserVault.saveShelf(this.state.shelfModules);
    this.notify({ skipVaultSave: true });
  },

  async loadRemoteCartridge(shelfEntry) {
    const res = await fetch(shelfEntry.directUrl);
    if (!res.ok) {
      throw new Error(`No se pudo descargar (HTTP ${res.status}). Verifica que el enlace sea público.`);
    }
    const buffer = await res.arrayBuffer();
    const pkg = await CartridgePacker.parseCartridgeBuffer(buffer);
    if (pkg && pkg.world) pkg.world.moduleTitle = shelfEntry.title;
    await this.loadModulePackage(pkg);
  }
};
