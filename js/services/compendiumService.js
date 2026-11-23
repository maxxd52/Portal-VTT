import { COMPENDIUM_ACTORS, COMPENDIUM_ITEMS } from '../data/compendium.js?v=20261123a7';
import { Selector } from '../core/selector.js?v=20261123a7';
import { BrowserVault } from './browserVault.js?v=20261123a7';
import { CartridgePacker } from './cartridgePacker.js?v=20261123a7';
import { RealtimeBridge } from './realtimeBridge.js?v=20261123a7';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { normalizeGridConfig } from '../utils/gridGeometry.js?v=20261123a7';
import { normalizeWeatherType } from '../utils/weatherEngine.js?v=20261123a7';
import { normalizeSceneLighting } from '../utils/lightingModel.js?v=20261123a7';
import {
  applyActorTemplateToLiveToken,
  clampTokenSize,
  normalizeTemplateStats,
  reconcileInventoryWithStarterItems
} from '../utils/tokenTemplateSync.js?v=20261123a7';

/**
 * Custom compendium CRUD, folder management & .portal cartridge/shelf methods mixed into Service.
 */
export const CompendiumServiceMethods = {
  saveCustomActor(tpl) {
    const list = Array.isArray(this.state.customActors) ? this.state.customActors : [];
    const existing = tpl.key ? list.find((a) => a && a.key === tpl.key) : null;
    const isAlly = tpl.isAlly !== false;
    const folder = tpl.folder !== undefined ? String(tpl.folder || '').trim() : String(existing?.folder || '').trim();
    const rawImg = tpl.imageUrl !== undefined ? tpl.imageUrl : existing?.imageUrl || '';
    const cleanImg = DriveUrlHelper.toDirectImageUrl(rawImg || '') || String(rawImg || '').trim();
    const cleanName = String(tpl.name || existing?.name || 'Personaje').trim();
    const mediaId = cleanImg ? (this.registerMediaAsset?.(cleanImg, { label: cleanName, kind: 'token' }) || '') : '';
    const nextMaxHp = Math.max(1, Number(tpl.maxHp ?? tpl.hp ?? existing?.maxHp ?? existing?.hp) || 16);
    let nextHp = nextMaxHp;
    if (isAlly) {
      if (tpl.hp !== undefined && tpl.maxHp !== undefined) {
        nextHp = Math.max(0, Math.min(nextMaxHp, Number(tpl.hp) || 0));
      } else if (existing && existing.isAlly !== false) {
        const prevMax = Math.max(1, Number(existing.maxHp ?? existing.hp) || 16);
        const prevCur = Number.isFinite(Number(existing.hp)) ? Number(existing.hp) : prevMax;
        nextHp = prevCur >= prevMax ? nextMaxHp : Math.max(0, Math.min(nextMaxHp, prevCur));
      } else {
        nextHp = Math.max(0, Math.min(nextMaxHp, Number(tpl.hp ?? nextMaxHp) || nextMaxHp));
      }
    }
    const rawVision = tpl.visionMeters !== undefined ? tpl.visionMeters : existing?.visionMeters;
    const visionMeters =
      rawVision !== null && rawVision !== undefined && rawVision !== '' && Number.isFinite(Number(rawVision))
        ? Math.max(0, Math.min(60, Number(rawVision)))
        : null;
    const rawLight = tpl.lightMeters !== undefined ? tpl.lightMeters : existing?.lightMeters;
    const lightMeters = Math.max(0, Math.min(60, Number(rawLight) || 0));
    const hasStarterItems = Array.isArray(tpl.starterItems);
    const starterItems = hasStarterItems
      ? tpl.starterItems.filter(Boolean)
      : Array.isArray(existing?.starterItems)
        ? [...existing.starterItems]
        : [];
    const nextInventory = Array.isArray(tpl.inventory)
      ? JSON.parse(JSON.stringify(tpl.inventory))
      : hasStarterItems
        ? reconcileInventoryWithStarterItems(
            existing?.inventory,
            existing?.starterItems,
            starterItems,
            this.state.customItems,
            COMPENDIUM_ITEMS
          )
        : Array.isArray(existing?.inventory)
          ? JSON.parse(JSON.stringify(existing.inventory))
          : undefined;

    const entry = {
      ...(existing ? JSON.parse(JSON.stringify(existing)) : {}),
      key: tpl.key || existing?.key || `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      isCustom: true,
      folder,
      name: cleanName,
      role: String(tpl.role !== undefined ? tpl.role : existing?.role || (isAlly ? 'Protagonista' : 'Secundario')).trim(),
      color: tpl.color || existing?.color || (isAlly ? '#8b5cf6' : '#ef4444'),
      isAlly,
      visionMeters,
      lightMeters,
      imageUrl: cleanImg,
      mediaId,
      publicDescription: String(tpl.publicDescription !== undefined ? tpl.publicDescription : existing?.publicDescription || '').trim(),
      privateNotes: String(tpl.privateNotes !== undefined ? tpl.privateNotes : existing?.privateNotes || '').trim(),
      size: clampTokenSize(tpl.size !== undefined ? tpl.size : existing?.size, 1),
      hp: nextHp,
      maxHp: nextMaxHp,
      ac: Math.max(1, Number(tpl.ac !== undefined ? tpl.ac : existing?.ac) || 12),
      level: Math.max(1, Math.min(20, Number(tpl.level !== undefined ? tpl.level : existing?.level) || 1)),
      speed: String(tpl.speed !== undefined ? tpl.speed : existing?.speed || '30 ft'),
      stats: normalizeTemplateStats(tpl.stats, existing?.stats),
      starterItems
    };
    if (nextInventory !== undefined) {
      entry.inventory = nextInventory;
    } else {
      delete entry.inventory;
    }

    const idx = list.findIndex((a) => a.key === entry.key);
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
    }
    this.state.customActors = list;

    // Linked Protagonist edits propagate to active/stored scene instances; Secondaries stay immutable molds
    let liveUpdated = false;
    if (entry.isAlly !== false) {
      for (const tok of this.state.tokens || []) {
        if (tok && tok.isAlly !== false && tok.actorKey === entry.key) {
          applyActorTemplateToLiveToken(tok, entry);
          liveUpdated = true;
        }
      }
      if (this.state.sceneLayers && typeof this.state.sceneLayers === 'object') {
        for (const layer of Object.values(this.state.sceneLayers)) {
          for (const tok of Array.isArray(layer?.tokens) ? layer.tokens : []) {
            if (tok && tok.isAlly !== false && tok.actorKey === entry.key) {
              applyActorTemplateToLiveToken(tok, entry);
            }
          }
        }
      }
    }

    if (folder) this.ensureCompendiumFolder('actors', folder, true);
    this.recordEvent('COMPENDIO', `Personaje guardado: ${entry.name}`);
    this.notify({ redrawFog: liveUpdated, flushVault: true });
    return entry;
  },

  deleteCustomActor(key) {
    if (!Array.isArray(this.state.customActors)) return;
    this.state.customActors = this.state.customActors.filter((a) => a.key !== key);
    this.pruneUnusedMediaAssets?.();
    this.notify({ flushVault: true });
  },

  saveCustomItem(tpl) {
    const kind = tpl.kind || 'weapon';
    const folder = String(tpl.folder || '').trim();
    const die = Number(tpl.die) || 0;
    const bonusMod = Number(tpl.bonusMod) || 0;
    const acBonus = Number(tpl.acBonus) || 0;
    const heal = Number(tpl.heal) || 0;
    const lightMeters = kind === 'light' ? (Number(tpl.lightMeters) || (Number(tpl.lightRadius) >= 300 ? 12 : 6)) : 0;
    const lightRadius = 0;
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
      else if (steps.length === 1 && steps[0].type === 'roll' && steps[0].rollKind !== 'request' && steps[0].formula) badge = steps[0].formula;
      else if (tpl.formula) badge = String(tpl.formula).trim();
      else if (passives.length > 0) {
        const lbl = targetLabels[firstPassive.target] || firstPassive.target.toUpperCase();
        badge = `${firstPassive.value >= 0 ? '+' : ''}${firstPassive.value} ${lbl}`;
      } else if ((kind === 'armor' || kind === 'equipment') && statBonus !== 0) {
        badge = `${statBonus >= 0 ? '+' : ''}${statBonus} ${targetLabels[statTarget] || 'CA'}`;
      } else if (kind === 'consumable' && heal > 0) badge = `Cura +${heal} HP`;
      else if (kind === 'light') badge = `Luz ${lightMeters} m`;
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
      lightMeters,
      lightRadius: 0,
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
    this.notify({ flushVault: true });
    return entry;
  },

  deleteCustomItem(key) {
    if (!Array.isArray(this.state.customItems)) return;
    this.state.customItems = this.state.customItems.filter((i) => i.key !== key);
    this.notify({ flushVault: true });
  },

  saveCustomMap(tpl) {
    const folder = String(tpl.folder || '').trim();
    const list = Array.isArray(this.state.customMaps) ? this.state.customMaps : [];
    const existing = tpl.key ? list.find((m) => m.key === tpl.key) : null;
    const rawGrid = tpl.grid || existing?.grid || (tpl.key ? this.state.mapGrids?.[tpl.key] : null);
    const rawLighting = tpl.lighting || existing?.lighting || (tpl.key ? this.state.sceneLighting?.[tpl.key] : null);
    const normLighting = rawLighting
      ? normalizeSceneLighting(rawLighting, {
          dynamicLighting: true,
          rememberExplored: Selector.getSystemVisionConfig(this.state).rememberExplored
        })
      : null;
    const sceneMode =
      tpl.sceneMode === 'narrative'
        ? 'narrative'
        : tpl.sceneMode === 'tactical'
          ? 'tactical'
          : existing?.sceneMode === 'narrative'
            ? 'narrative'
            : 'tactical';
    const entry = {
      key: tpl.key || `cmap-${Date.now().toString(36)}`,
      isCustom: true,
      folder,
      name: String(tpl.name || 'Escenario').trim(),
      desc: String(tpl.desc || 'Escenario personalizado').trim(),
      imageUrl: String(tpl.imageUrl || '').trim(),
      sceneMode,
      weather: normalizeWeatherType(tpl.weather ?? existing?.weather ?? 'none'),
      ...(rawGrid ? { grid: normalizeGridConfig(rawGrid) } : {}),
      ...(normLighting
        ? {
            lighting: {
              dynamicLighting: normLighting.dynamicLighting,
              rememberExplored: normLighting.rememberExplored
            }
          }
        : {})
    };
    const idx = list.findIndex((m) => m.key === entry.key);
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    this.state.customMaps = list;
    const isActive = this.getActiveSceneKey() === entry.key;
    if (isActive) {
      this.state.sceneMode = entry.sceneMode;
      this.state.sceneWeather = entry.weather;
      if (entry.sceneMode === 'narrative') {
        this.state.tool = 'select';
        this.state.ruler = null;
        this.state.wallAnchor = null;
      }
    }
    if (entry.grid) {
      if (!this.state.mapGrids || typeof this.state.mapGrids !== 'object') {
        this.state.mapGrids = {};
      }
      this.state.mapGrids[entry.key] = { ...entry.grid };
      if (isActive) {
        this.state.grid = { ...entry.grid };
      }
    }
    if (normLighting) {
      if (!this.state.sceneLighting || typeof this.state.sceneLighting !== 'object') {
        this.state.sceneLighting = {};
      }
      const prevLight = this.state.sceneLighting[entry.key] || {};
      const mergedLight = normalizeSceneLighting({
        ...prevLight,
        dynamicLighting: normLighting.dynamicLighting,
        rememberExplored: normLighting.rememberExplored
      });
      this.state.sceneLighting[entry.key] = mergedLight;
      if (isActive) {
        this.state.dynamicLighting = mergedLight.dynamicLighting;
        this.state.rememberExplored = mergedLight.rememberExplored;
      }
    }
    if (folder) this.ensureCompendiumFolder('maps', folder, true);
    this.recordEvent('COMPENDIO', `Escenario guardado: ${entry.name}`);
    this.notify({ redrawGrid: isActive, redrawFog: isActive, flushVault: true });
    return entry;
  },

  deleteCustomMap(key) {
    if (!Array.isArray(this.state.customMaps)) return;
    this.state.customMaps = this.state.customMaps.filter((m) => m.key !== key);
    this.pruneUnusedMediaAssets?.();
    this.notify({ flushVault: true });
  },

  async activateMapTemplate(tpl) {
    if (!tpl) return;
    if (tpl.isCustom && tpl.imageUrl) {
      await this.changeMap('custom', tpl.imageUrl, tpl.key);
    } else {
      await this.changeMap(tpl.key, '', tpl.key);
    }
  },

  async registerAndActivateDirectMap(imageUrl, rawFileName = '') {
    const cleanUrl = String(imageUrl || '').trim();
    if (!cleanUrl) return null;
    const baseName = String(rawFileName || '').replace(/\.[^.]+$/, '').trim() || 'Mapa personalizado';
    const entry = this.saveCustomMap({
      name: baseName,
      desc: 'Escenario personalizado',
      imageUrl: cleanUrl,
      sceneMode: 'tactical'
    });
    await this.activateMapTemplate(entry);
    return entry;
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

  moveCompendiumEntryToFolder(tab, key, targetFolder = '') {
    if (!['actors', 'items', 'maps'].includes(tab) || !key) return false;
    const cleanFolder = String(targetFolder || '').trim();
    const mapField = tab === 'actors' ? 'customActors' : tab === 'items' ? 'customItems' : 'customMaps';
    const customList = Array.isArray(this.state[mapField]) ? this.state[mapField] : [];
    const customEntry = customList.find((e) => e && e.key === key);

    if (cleanFolder) {
      this.ensureCompendiumFolder(tab, cleanFolder, true);
    }

    if (customEntry) {
      if (String(customEntry.folder || '') === cleanFolder) return false;
      customEntry.folder = cleanFolder;
    } else {
      if (!this.state.compendiumFolderOverrides || typeof this.state.compendiumFolderOverrides !== 'object') {
        this.state.compendiumFolderOverrides = { actors: {}, items: {}, maps: {} };
      }
      if (!this.state.compendiumFolderOverrides[tab] || typeof this.state.compendiumFolderOverrides[tab] !== 'object') {
        this.state.compendiumFolderOverrides[tab] = {};
      }
      const prev = String(this.state.compendiumFolderOverrides[tab][key] || '');
      if (prev === cleanFolder) return false;
      if (cleanFolder) {
        this.state.compendiumFolderOverrides[tab][key] = cleanFolder;
      } else {
        delete this.state.compendiumFolderOverrides[tab][key];
      }
    }

    this.notify({ flushVault: true });
    return true;
  },

  renameCompendiumFolder(tab, oldName, newName) {
    if (!['actors', 'items', 'maps'].includes(tab)) return false;
    const prev = String(oldName || '').trim();
    const next = String(newName || '').trim();
    if (!prev || !next || prev === next) return false;

    if (!this.state.compendiumFolders) {
      this.state.compendiumFolders = { actors: [], items: [], maps: [] };
    }
    const list = Array.isArray(this.state.compendiumFolders[tab]) ? this.state.compendiumFolders[tab] : [];
    const nextList = [];
    let replaced = false;
    for (const f of list) {
      const candidate = f === prev ? next : f;
      if (f === prev) replaced = true;
      if (candidate && !nextList.includes(candidate)) nextList.push(candidate);
    }
    if (!replaced && !nextList.includes(next)) nextList.push(next);
    this.state.compendiumFolders[tab] = nextList;

    const mapField = tab === 'actors' ? 'customActors' : tab === 'items' ? 'customItems' : 'customMaps';
    if (Array.isArray(this.state[mapField])) {
      this.state[mapField].forEach((entry) => {
        if (entry && entry.folder === prev) entry.folder = next;
      });
    }
    const ov = this.state.compendiumFolderOverrides?.[tab];
    if (ov && typeof ov === 'object') {
      for (const [k, v] of Object.entries(ov)) {
        if (v === prev) ov[k] = next;
      }
    }

    this.notify({ flushVault: true });
    return true;
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
    const ov = this.state.compendiumFolderOverrides?.[tab];
    if (ov && typeof ov === 'object') {
      for (const [k, v] of Object.entries(ov)) {
        if (v === folderName) delete ov[k];
      }
    }
    this.notify({ flushVault: true });
  },

  async loadModulePackage(pkg) {
    if (!pkg || !pkg.world) throw new Error('Archivo de cartucho inválido.');
    if (this.state.role === 'gm') {
      this.state.gmScreen = null;
    }
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
    if (!Array.isArray(this.state.playerInvites)) {
      this.state.playerInvites = [];
    }
    return this.state.playerInvites;
  },

  syncInvitesChange() {
    this.syncWorldToPeers();
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
    this.state.playerInvites = list;
    if (this.state.activeInviteId === inviteId) {
      this.state.activeInviteId = '';
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
    this.state.gmScreenOpen = false;
    const list = this.ensurePlayerInvites();
    if (this.state.activeInviteId && !list.some((i) => i.id === this.state.activeInviteId)) {
      this.state.activeInviteId = '';
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
      }
      this.state.drawerOpen = false;
    }
  }
};
