import { BrowserVault } from '../services/browserVault.js?v=20261117b1';
import { CartridgePacker } from '../services/cartridgePacker.js?v=20261117b1';
import { RealtimeBridge } from '../services/realtimeBridge.js?v=20261117b1';
import { Service } from '../core/service.js?v=20261117b1';

/**
 * Portal-VTT entry lobby: create a portal with ruleset/options, join by code/URL, or resume recent portals.
 */
export const PortalLobbyViewMethods = {
  parsePortalInput(raw) {
    const val = String(raw || '').trim();
    if (!val) return '';
    try {
      if (/^https?:\/\//i.test(val) || val.includes('?room=')) {
        const u = new URL(val.startsWith('http') ? val : `https://portal.local/${val.replace(/^\/+/, '')}`);
        const room = u.searchParams.get('room');
        if (room) return room.trim().toUpperCase();
      }
    } catch (_) {}
    return val.toUpperCase();
  },

  syncUrlWithPortal(code, role) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      url.searchParams.set('role', role);
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  },

  async showPortalLobby() {
    if (!this.els.portalLobby) return;
    Service.state.sheetOpen = false;
    Service.state.drawerOpen = false;
    Service.notify({ skipVaultSave: true });
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch (_) {}
    this.els.portalLobby.classList.remove('hidden');
    this.els.portalLobby.classList.add('flex');
    await this.renderRecentPortals();
  },

  hidePortalLobby() {
    if (!this.els.portalLobby) return;
    this.els.portalLobby.classList.add('hidden');
    this.els.portalLobby.classList.remove('flex');
  },

  async renderRecentPortals() {
    const box = this.els.recentPortalsList;
    if (!box) return;
    const rooms = await BrowserVault.listRooms();
    if (!rooms.length) {
      box.innerHTML = `<div class="text-[11px] opacity-55 text-center py-3">Todavía no hay portales guardados en este navegador.</div>`;
      return;
    }

    const rulesetLabel = { dnd55: 'D&D 5.5', pbta: 'PbtA 2d6', pool: 'Pool d10', d100: '1d100', free: 'Genérico' };
    box.innerHTML = rooms
      .slice(0, 6)
      .map(
        (r) => `
        <div class="portal-subpanel rounded-xl px-3 py-2 flex items-center justify-between gap-2 group">
          <button type="button" data-open-portal="${r.code}" class="flex-1 min-w-0 text-left">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-xs truncate">${r.title}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded-full font-mono-tech bg-white/10 opacity-80">${rulesetLabel[r.ruleset] || 'D&D 5.5'}</span>
            </div>
            <div class="text-[10px] opacity-60 font-mono-tech truncate">${r.code} · ${r.tokenCount} fichas</div>
          </button>
          <button type="button" data-del-portal="${r.code}" class="portal-btn w-6 h-6 p-0 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 text-rose-400" title="Eliminar portal guardado">✕</button>
        </div>
      `
      )
      .join('');

    box.querySelectorAll('[data-open-portal]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.openPortal;
        await Service.openPortal(code, 'gm');
        RealtimeBridge.connect(code, (msg) => this.handleRealtimeMessage(msg), () => Service.state.role);
        this.startPresenceHeartbeat();
        this.syncUrlWithPortal(code, 'gm');
        this.hidePortalLobby();
        this.showActionToast(`Portal ${code} abierto.`);
      });
    });

    box.querySelectorAll('[data-del-portal]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await BrowserVault.clearRoom(btn.dataset.delPortal);
        await this.renderRecentPortals();
      });
    });
  },

  bindPortalLobbyEvents() {
    if (this.els.btnBrandLobby) {
      this.els.btnBrandLobby.addEventListener('click', () => {
        this.showPortalLobby();
      });
    }

    if (this.els.createPortalForm) {
      this.els.createPortalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = this.els.inpPortalName?.value.trim() || '';
        const ruleset = this.els.selPortalRuleset?.value || 'dnd55';
        const mapId = this.els.selPortalMap?.value || 'bastion';
        const dynamicLighting = Boolean(this.els.chkPortalDynLight?.checked);
        const showGrid = Boolean(this.els.chkPortalGrid?.checked);

        const code = await Service.createPortal({
          title,
          ruleset,
          mapId,
          dynamicLighting,
          showGrid
        });
        RealtimeBridge.connect(code, (msg) => this.handleRealtimeMessage(msg), () => Service.state.role);
        this.startPresenceHeartbeat();
        this.syncUrlWithPortal(code, 'gm');
        this.hidePortalLobby();
        this.showActionToast(`Portal ${code} creado.`);
      });
    }

    if (this.els.joinPortalForm) {
      this.els.joinPortalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = this.parsePortalInput(this.els.inpJoinPortalCode?.value);
        if (!code) return;
        const role = this.els.selJoinPortalRole?.value === 'gm' ? 'gm' : 'player';
        await Service.openPortal(code, role);
        RealtimeBridge.connect(code, (msg) => this.handleRealtimeMessage(msg), () => Service.state.role);
        this.startPresenceHeartbeat();
        this.syncUrlWithPortal(code, role);
        this.hidePortalLobby();
        this.showActionToast(`Conectado al portal ${code}.`);
      });
    }

    if (this.els.inpLobbyCartridgeFile) {
      this.els.inpLobbyCartridgeFile.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const buffer = await file.arrayBuffer();
          const parsed = await CartridgePacker.parseCartridgeBuffer(buffer);
          const code = await Service.createPortal({
            title: parsed.world?.moduleTitle || file.name.replace(/\.[^.]+$/, ''),
            ruleset: parsed.world?.ruleset || 'dnd55'
          });
          await Service.loadModulePackage(parsed);
          RealtimeBridge.connect(code, (msg) => this.handleRealtimeMessage(msg), () => Service.state.role);
          this.startPresenceHeartbeat();
          this.syncUrlWithPortal(code, 'gm');
          this.hidePortalLobby();
          this.showActionToast(`Cartucho "${Service.state.room.moduleTitle}" desplegado.`);
        } catch (err) {
          this.showActionToast(err.message || 'Error al importar cartucho.');
        }
        e.target.value = '';
      });
    }
  }
};
