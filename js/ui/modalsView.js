import { BrowserVault } from '../services/browserVault.js?v=20261116z40';
import { CartridgePacker } from '../services/cartridgePacker.js';
import { RealtimeBridge } from '../services/realtimeBridge.js';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { WebPConverter } from '../utils/webpConverter.js?v=20261116z40';
import { createInitialState, generateRoomCode } from '../core/model.js?v=20261116z40';
import { Selector } from '../core/selector.js?v=20261116z40';
import { Service } from '../core/service.js?v=20261116z40';

/**
 * Room/Cartridge/Shelf modal, Google Drive modal, Sync/Event Log modal & Handouts modal.
 */
export const ModalsViewMethods = {
  bindModalEvents() {
    // 8. Modal Salas, Cartuchos .owltable y Estantería Solo Lectura
    this.els.btnOpenRoomModal.addEventListener('click', () => {
      this.els.roomModal.classList.add('is-open');
      this.renderRoomModal(Service.state);
    });
    this.els.btnCloseRoomModal.addEventListener('click', () => {
      this.els.roomModal.classList.remove('is-open');
    });

    this.els.btnCreateNewRoom.addEventListener('click', () => {
      const nextCode = generateRoomCode();
      Service.state.room.code = nextCode;
      Service.state.role = 'gm';
      RealtimeBridge.connect(nextCode, (msg) => this.handleRealtimeMessage(msg));
      Service.notify();
      this.renderRoomModal(Service.state);
      this.showRoomToast(`Sala efímera ${nextCode} activada.`);
    });

    this.els.joinRoomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = this.els.inpJoinRoomCode.value.trim().toUpperCase();
      if (!code) return;
      Service.state.room.code = code;
      await Service.restoreFromVault();
      RealtimeBridge.connect(code, (msg) => this.handleRealtimeMessage(msg));
      Service.notify();
      this.renderRoomModal(Service.state);
      this.showRoomToast(`Conectado a sala ${code}.`);
    });

    this.els.btnCopyPlayerUrl.addEventListener('click', () => {
      this.els.inpPlayerInviteUrl.select();
      document.execCommand('copy');
      this.showRoomToast('Enlace de Jugadores copiado.');
    });

    this.els.btnCopyGmUrl.addEventListener('click', () => {
      this.els.inpGmInviteUrl.select();
      document.execCommand('copy');
      this.showRoomToast('Enlace de Director (GM) copiado.');
    });

    this.els.inpLocalMapWebp.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const webpDataUrl = await WebPConverter.fileToWebPDataUrl(file, 3840, 0.82);
        const kbSize = Math.round((webpDataUrl.length * 0.75) / 1024);
        Service.loadExternalMapImage(webpDataUrl);
        await Service.changeMap('custom', webpDataUrl);
        this.showRoomToast(`Mapa "${file.name}" optimizado a WebP (${kbSize} KB).`);
      } catch (err) {
        this.showRoomToast(err.message || 'Error al convertir imagen.');
      }
    });

    this.els.btnExportModule.addEventListener('click', async () => {
      const title = (this.els.inpModuleTitle.value.trim() || 'Modulo_VTT').replace(/[^a-zA-Z0-9_-]/g, '_');
      Service.state.room.moduleTitle = title;
      try {
        const blob = await CartridgePacker.buildOwltableBlob(Service.state);
        const kbSize = Math.max(1, Math.round(blob.size / 1024));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.owltable`;
        a.click();
        URL.revokeObjectURL(url);
        this.showRoomToast(`Cartucho ${title}.owltable exportado (${kbSize} KB).`);
      } catch (err) {
        this.showRoomToast(err.message || 'Error al empaquetar .owltable.');
      }
    });

    this.els.inpModuleFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const parsed = await CartridgePacker.parseCartridgeBuffer(buffer);
        await Service.loadModulePackage(parsed);
        this.showRoomToast(`Cartucho "${Service.state.room.moduleTitle}" cargado.`);
      } catch (err) {
        this.showRoomToast(err.message || 'Error al abrir cartucho.');
      }
    });

    this.els.addShelfModuleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = this.els.inpShelfTitle.value.trim();
      const url = this.els.inpShelfUrl.value.trim();
      if (!title || !url) return;
      await Service.addShelfModule(title, url);
      this.els.inpShelfTitle.value = '';
      this.els.inpShelfUrl.value = '';
      this.renderRoomModal(Service.state);
      this.showRoomToast(`Mesa "${title}" añadida al desplegable superior.`);
    });

    this.els.btnResetVaultStep1.addEventListener('click', () => {
      this.els.btnResetVaultStep1.classList.add('hidden');
      this.els.btnResetVaultConfirm.classList.remove('hidden');
    });
    this.els.btnResetVaultConfirm.addEventListener('click', async () => {
      const code = Service.state.room.code;
      await BrowserVault.clearRoom(code);
      Service.state = createInitialState();
      Service.state.room.code = code;
      Service.notify({ redrawMap: true, redrawGrid: true, redrawDraw: true, redrawFog: true });
      this.els.btnResetVaultConfirm.classList.add('hidden');
      this.els.btnResetVaultStep1.classList.remove('hidden');
      this.showRoomToast('Memoria de sala reiniciada.');
    });

    // 9. Modal Google Drive
    this.els.btnOpenDriveModal.addEventListener('click', () => {
      this.els.driveModal.classList.add('is-open');
    });
    this.els.btnCloseDriveModal.addEventListener('click', () => {
      this.els.driveModal.classList.remove('is-open');
    });
    this.els.btnApplyDriveMap.addEventListener('click', async () => {
      const raw = this.els.inpDriveMapUrl.value.trim();
      if (!raw) return;
      const direct = DriveUrlHelper.toDirectImageUrl(raw);
      Service.loadExternalMapImage(direct);
      await Service.changeMap('custom', direct);
      this.els.driveModal.classList.remove('is-open');
      this.showActionToast('Mapa de Google Drive aplicado.');
    });
    this.els.btnEmbedDriveFolder.addEventListener('click', () => {
      const raw = this.els.inpDriveFolderUrl.value.trim();
      if (!raw) return;
      this.els.driveFolderIframe.src = DriveUrlHelper.toEmbedFolderUrl(raw);
      this.els.driveFolderIframe.classList.remove('hidden');
    });

    // 10. Modal Sync & Event Log
    this.els.btnOpenSyncModal.addEventListener('click', () => {
      this.els.syncModal.classList.add('is-open');
      this.renderSyncModal(Service.state);
    });
    this.els.btnCloseSyncModal.addEventListener('click', () => {
      this.els.syncModal.classList.remove('is-open');
    });
    this.els.btnBroadcastFullNow.addEventListener('click', () => {
      RealtimeBridge.send({ kind: 'WORLD_SYNC', world: Selector.extractSerializableWorld(Service.state) });
      this.showActionToast('Estado completo enviado a la sala.');
    });
    this.els.btnCompactEvents.addEventListener('click', () => {
      Service.state.events = [];
      Service.recordEvent('CHECKPOINT', 'Snapshot compactado en 1 fila');
      this.renderSyncModal(Service.state);
    });

    // Handouts (Compartir imagen en mesa)
    if (this.els.btnShowHandout) {
      this.els.btnShowHandout.addEventListener('click', () => {
        const url = this.els.inpHandoutUrl?.value.trim();
        if (!url) return;
        const title = this.els.inpHandoutTitle?.value.trim() || 'Handout';
        Service.showHandout(url, title);
        this.els.roomModal?.classList.remove('is-open');
      });
    }
    if (this.els.inpHandoutFile) {
      this.els.inpHandoutFile.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const dataUrl = await Service.compressImageFile(file, 1400, 0.84);
        const title = this.els.inpHandoutTitle?.value.trim() || file.name.replace(/\.[^.]+$/, '');
        Service.showHandout(dataUrl, title);
        this.els.roomModal?.classList.remove('is-open');
        e.target.value = '';
      });
    }
    if (this.els.btnCloseHandout) {
      this.els.btnCloseHandout.addEventListener('click', () => Service.closeHandout(false));
    }
    if (this.els.btnClearHandoutForAll) {
      this.els.btnClearHandoutForAll.addEventListener('click', () => Service.closeHandout(true));
    }
  },

  renderHandoutModal(state) {
    if (!this.els.handoutModal) return;
    const h = state.activeHandout;
    this.els.handoutModal.classList.toggle('is-open', Boolean(h && h.url));
    if (!h || !h.url) return;
    if (this.els.handoutModalTitle) this.els.handoutModalTitle.textContent = h.title || 'Handout';
    if (this.els.handoutModalImg && this.els.handoutModalImg.src !== h.url) {
      this.els.handoutModalImg.src = h.url;
    }
    if (this.els.btnClearHandoutForAll) {
      this.els.btnClearHandoutForAll.classList.toggle('hidden', state.role !== 'gm');
    }
  },

  renderRoomModal(state) {
    this.els.lblModalRoomCode.textContent = state.room.code;
    this.els.lblModalRoomRole.textContent = state.role === 'gm' ? 'DIRECTOR (GM)' : 'JUGADOR';
    this.els.inpModuleTitle.value = state.room.moduleTitle || `Aventura_${state.room.code}`;
    if (this.els.handoutShareBox) {
      this.els.handoutShareBox.classList.toggle('hidden', state.role !== 'gm');
    }
    if (this.els.roomPresenceList) {
      const peers = Service.getActivePeers();
      this.els.roomPresenceList.innerHTML = peers
        .map(
          (p) =>
            `<span class="owl-panel px-2 py-0.5 rounded-full text-[10px] font-mono-tech">${p.role === 'gm' ? 'DJ' : 'Jugador'}${p.self ? ' (tú)' : ''}</span>`
        )
        .join('');
    }

    const shelf = state.shelfModules || [];
    this.els.shelfModulesList.innerHTML = shelf.length
      ? shelf
          .map(
            (m) => `
            <div class="owl-panel rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
              <div class="min-w-0">
                <div class="font-bold truncate">📦 ${m.title}</div>
                <div class="font-mono-tech text-[9px] opacity-65 truncate">${m.url}</div>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button type="button" data-load-shelf="${m.id}" class="owl-btn owl-btn-accent px-2 py-1 text-[10px] font-semibold">Cargar</button>
                <button type="button" data-del-shelf="${m.id}" class="owl-btn owl-subpanel w-6 h-6 text-[10px] text-red-400">✕</button>
              </div>
            </div>
          `
          )
          .join('')
      : `<span class="text-[10px] opacity-65">Aún no has enlazado cartuchos .owltable externos.</span>`;

    this.els.shelfModulesList.querySelectorAll('[data-load-shelf]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const entry = shelf.find((x) => x.id === btn.dataset.loadShelf);
        if (!entry) return;
        this.showRoomToast(`Descargando "${entry.title}"...`);
        try {
          await Service.loadRemoteCartridge(entry);
          this.els.roomModal.classList.remove('is-open');
          this.showActionToast(`Cartucho "${entry.title}" desplegado.`);
        } catch (err) {
          this.showRoomToast(err.message || 'Error al descargar cartucho.');
        }
      });
    });

    this.els.shelfModulesList.querySelectorAll('[data-del-shelf]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await Service.removeShelfModule(btn.dataset.delShelf);
        this.renderRoomModal(Service.state);
      });
    });

    const isRealHttp = window.location.protocol.startsWith('http');
    const baseUrl = isRealHttp
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://tu-vtt.web.app/';
    this.els.inpPlayerInviteUrl.value = `${baseUrl}?room=${state.room.code}&role=player`;
    this.els.inpGmInviteUrl.value = `${baseUrl}?room=${state.room.code}&role=gm`;
  },

  renderSyncModal(state) {
    this.els.lblSyncRoomName.textContent = state.room.code;
    this.els.lblEventQueueCount.textContent = String(state.events.length);
    this.els.eventLogPreviewList.innerHTML = state.events.length
      ? state.events
          .slice(-15)
          .reverse()
          .map((ev) => `<div>[${ev.ts}] <strong>${ev.type}</strong> · ${ev.detail}</div>`)
          .join('')
      : `<div class="opacity-60">Sin eventos recientes en cola.</div>`;
  }
};
