import { COMPENDIUM_ACTORS } from '../data/compendium.js?v=20261117b1';
import { Selector } from '../core/selector.js?v=20261117b1';
import { BrowserVault } from './browserVault.js?v=20261117b1';
import { CartridgePacker } from './cartridgePacker.js?v=20261117b1';
import { RealtimeBridge } from './realtimeBridge.js?v=20261117b1';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';

/**
 * Custom compendium CRUD, folder management & .portal cartridge/shelf methods mixed into Service.
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
      role: String(tpl.role || (isAlly ? 'Protagonista' : 'Secundario')).trim(),
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
    const passives = Array.isArray(tpl.passives)
      ? tpl.passives.filter((p) => p && p.target && (Number(p.value) || 0) !== 0).map((p) => ({
          target: String(p.target),
          value: Number(p.value) || 0
        }))
      : [];
    const steps = Array.isArray(tpl.steps) ? JSON.parse(JSON.stringify(tpl.steps)) : [];
    const firstPassive = passives[0];
    const statTarget = firstPassive ? firstPassive.target : String(tpl.statTarget || (acBonus > 0 ? 'ac' : 'ac'));
    const statBonus = firstPassive ? firstPassive.value : (Number(tpl.statBonus !== undefined ? tpl.statBonus : acBonus) || 0);
    const targetLabels = { ac: 'CA', str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR', maxHp: 'HP' };
    let badge = String(tpl.badge || '').trim();
    if (!badge) {
      if (steps.length > 1) badge = `${steps.length} pasos`;
      else if (steps.length === 1 && steps[0].type === 'roll' && steps[0].formula) badge = steps[0].formula;
      else if (tpl.formula) badge = String(tpl.formula).trim();
      else if (passives.length > 0) {
        const lbl = targetLabels[firstPassive.target] || firstPassive.target.toUpperCase();
        badge = `${firstPassive.value >= 0 ? '+' : ''}${firstPassive.value} ${lbl}`;
      } else if ((kind === 'armor' || kind === 'equipment') && statBonus !== 0) {
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
      statBonus: kind === 'armor' || kind === 'equipment' || passives.length > 0 ? statBonus : 0,
      acBonus: (kind === 'armor' || kind === 'equipment') && statTarget === 'ac' ? statBonus : 0,
      heal: kind === 'consumable' ? heal : 0,
      lightRadius: kind === 'light' ? lightRadius || 320 : 0,
      passives: passives.length > 0 ? passives : undefined,
      steps: steps.length > 0 ? steps : undefined,
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
  },

  ensurePlayerInvites() {
    if (!Array.isArray(this.state.playerInvites) || this.state.playerInvites.length === 0) {
      this.state.playerInvites = [{ id: 'inv-1', label: 'Enlace 1', tokenIds: [] }];
    }
    return this.state.playerInvites;
  },

  syncInvitesChange() {
    RealtimeBridge.send({ kind: 'WORLD_SYNC', world: Selector.extractSerializableWorld(this.state) });
    this.notify();
  },

  addPlayerInvite() {
    const list = this.ensurePlayerInvites();
    const inv = {
      id: `inv-${Date.now().toString(36).slice(-5)}`,
      label: `Enlace ${list.length + 1}`,
      tokenIds: []
    };
    list.push(inv);
    this.syncInvitesChange();
    return inv;
  },

  removePlayerInvite(inviteId) {
    const list = this.ensurePlayerInvites().filter((i) => i.id !== inviteId);
    this.state.playerInvites = list.length > 0 ? list : [{ id: 'inv-1', label: 'Enlace 1', tokenIds: [] }];
    if (this.state.activeInviteId === inviteId) {
      this.state.activeInviteId = this.state.playerInvites[0]?.id || 'inv-1';
    }
    this.syncInvitesChange();
  },

  renamePlayerInvite(inviteId, nextLabel) {
    const inv = this.ensurePlayerInvites().find((i) => i.id === inviteId);
    const clean = String(nextLabel || '').trim();
    if (!inv || !clean) return;
    inv.label = clean;
    this.syncInvitesChange();
  },

  clearInviteCharacters(inviteId) {
    const inv = this.ensurePlayerInvites().find((i) => i.id === inviteId);
    if (!inv) return;
    inv.tokenIds = [];
    this.syncInvitesChange();
  },

  async toggleInviteCharacter(inviteId, targetSpec) {
    const inv = this.ensurePlayerInvites().find((i) => i.id === inviteId);
    if (!inv || !targetSpec) return;
    let tokenId = String(targetSpec);
    if (tokenId.startsWith('actor:')) {
      const actorKey = tokenId.slice(6);
      const allActors = [...(this.state.customActors || []), ...COMPENDIUM_ACTORS];
      const tpl = allActors.find((a) => a.key === actorKey);
      const existing = (this.state.tokens || []).find(
        (t) => t.isAlly !== false && (t.actorKey === actorKey || (tpl && t.name === tpl.name))
      );
      if (existing) {
        tokenId = existing.id;
      } else {
        if (!tpl) return;
        const spawned = await this.spawnActorFromTemplate(
          tpl,
          440 + Math.round(Math.random() * 140),
          440 + Math.round(Math.random() * 140)
        );
        tokenId = spawned.id;
      }
    }
    if (!Array.isArray(inv.tokenIds)) inv.tokenIds = [];
    if (inv.tokenIds.includes(tokenId)) {
      inv.tokenIds = inv.tokenIds.filter((id) => id !== tokenId);
    } else {
      inv.tokenIds.push(tokenId);
    }
    this.syncInvitesChange();
  },

  previewPlayerInvite(inviteId) {
    this.state.activeInviteId = inviteId;
    this.setRole('player');
  },

  syncPlayerRoleState() {
    const list = this.ensurePlayerInvites();
    if (!this.state.activeInviteId || !list.some((i) => i.id === this.state.activeInviteId)) {
      this.state.activeInviteId = list[0]?.id || 'inv-1';
    }
    const assigned = Selector.getPlayerAssignedTokenIds(this.state);
    if (assigned.length === 0) {
      this.state.selectedTokenId = null;
      this.state.sheetOpen = false;
      this.state.drawerOpen = false;
      this.state.tool = 'select';
    } else {
      if (!assigned.includes(this.state.selectedTokenId)) {
        this.state.selectedTokenId = assigned[0];
        this.state.sheetOpen = true;
      }
      this.state.drawerOpen = false;
    }
  }
};
