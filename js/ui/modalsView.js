import { BrowserVault } from '../services/browserVault.js?v=20261117b1';
import { CartridgePacker } from '../services/cartridgePacker.js?v=20261117b1';
import { RealtimeBridge } from '../services/realtimeBridge.js?v=20261117b1';
import { DriveUrlHelper } from '../utils/driveUrlHelper.js';
import { WebPConverter } from '../utils/webpConverter.js?v=20261117b1';
import { createInitialState, generateRoomCode } from '../core/model.js?v=20261117b1';
import { Selector } from '../core/selector.js?v=20261117b1';
import { Service } from '../core/service.js?v=20261117b1';

/**
 * Room/Cartridge/Shelf modal, Google Drive modal, Sync/Event Log modal & Handouts modal.
 */
export const ModalsViewMethods = {
  bindModalEvents() {
    // 8. Modal Salas, Cartuchos .portal y Estantería Solo Lectura
    this.els.btnOpenRoomModal.addEventListener('click', () => {
      this.els.roomModal.classList.add('is-open');
      this.renderRoomModal(Service.state);
    });
    this.els.btnCloseRoomModal.addEventListener('click', () => {
      this.els.roomModal.classList.remove('is-open');
    });

    const roomNavTabs = this.els.roomModal.querySelectorAll('[data-room-nav-tab]');
    const roomPanes = this.els.roomModal.querySelectorAll('[data-room-pane]');
    roomNavTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.roomNavTab;
        roomNavTabs.forEach((b) => b.classList.toggle('is-active', b.dataset.roomNavTab === target));
        roomPanes.forEach((p) => {
          const active = p.dataset.roomPane === target;
          p.classList.toggle('hidden', !active);
          p.classList.toggle('flex', active);
        });
      });
    });

    [this.els.roomModal, this.els.driveModal, this.els.syncModal].forEach((modalEl) => {
      modalEl?.addEventListener('click', (e) => {
        if (e.target === modalEl) modalEl.classList.remove('is-open');
      });
    });

    this.els.btnCreateNewRoom.addEventListener('click', () => {
      const nextCode = generateRoomCode();
      Service.state.room.code = nextCode;
      Service.state.role = 'gm';
      RealtimeBridge.connect(nextCode, (msg) => this.handleRealtimeMessage(msg), () => Service.state.role);
      this.startPresenceHeartbeat();
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
      RealtimeBridge.connect(code, (msg) => this.handleRealtimeMessage(msg), () => Service.state.role);
      this.startPresenceHeartbeat();
      Service.notify();
      this.renderRoomModal(Service.state);
      this.showRoomToast(`Conectado a sala ${code}.`);
    });

    const copyInviteUrl = async (inputEl, toastMsg) => {
      if (!inputEl) return;
      const val = inputEl.value;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(val);
        } else {
          inputEl.select();
          document.execCommand('copy');
        }
      } catch (_) {
        inputEl.select();
        document.execCommand('copy');
      }
      this.showRoomToast(toastMsg);
    };

    this.els.btnCopyPlayerUrl.addEventListener('click', () => {
      copyInviteUrl(this.els.inpPlayerInviteUrl, 'Enlace de Jugadores copiado.');
    });

    if (this.els.btnAddPlayerInvite) {
      this.els.btnAddPlayerInvite.addEventListener('click', () => {
        const created = Service.addPlayerInvite();
        this.renderRoomModal(Service.state);
        this.showRoomToast(`${created.label} creado en Modo Espectador.`);
      });
    }

    this.els.btnCopyGmUrl.addEventListener('click', () => {
      copyInviteUrl(this.els.inpGmInviteUrl, 'Enlace de Director (GM) copiado.');
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
        const blob = await CartridgePacker.buildPortalBlob(Service.state);
        const kbSize = Math.max(1, Math.round(blob.size / 1024));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.portal`;
        a.click();
        URL.revokeObjectURL(url);
        this.showRoomToast(`Cartucho ${title}.portal exportado (${kbSize} KB).`);
      } catch (err) {
        this.showRoomToast(err.message || 'Error al empaquetar .portal.');
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
            `<span class="portal-panel px-2 py-0.5 rounded-full text-[10px] font-mono-tech">${p.role === 'gm' ? 'DJ' : 'Jugador'}${p.self ? ' (tú)' : ''}</span>`
        )
        .join('');
    }

    const esc = (s) => this.escapeHtml(s);
    const shelf = state.shelfModules || [];
    this.els.shelfModulesList.innerHTML = shelf.length
      ? shelf
          .map(
            (m) => `
            <div class="portal-panel rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 text-[11px]">
              <div class="flex items-center gap-2 min-w-0">
                <svg class="w-3.5 h-3.5 opacity-75 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                <div class="min-w-0">
                  <div class="font-semibold truncate">${esc(m.title)}</div>
                  <div class="font-mono-tech text-[9.5px] opacity-60 truncate">${esc(m.url)}</div>
                </div>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button type="button" data-load-shelf="${esc(m.id)}" class="portal-btn portal-btn-accent px-2.5 py-1 rounded-lg text-[10.5px] font-semibold">Cargar</button>
                <button type="button" data-del-shelf="${esc(m.id)}" class="portal-btn portal-subpanel w-6 h-6 p-0 rounded-full flex items-center justify-center text-rose-400 opacity-75 hover:opacity-100" title="Quitar">
                  <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
              </div>
            </div>
          `
          )
          .join('')
      : `<span class="text-[10.5px] opacity-60">Aún no has enlazado cartuchos .portal externos.</span>`;

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
    const invites = Selector.getPlayerInvites(state);
    this.els.inpPlayerInviteUrl.value = `${baseUrl}?room=${state.room.code}&role=player&invite=${invites[0]?.id || 'inv-1'}`;
    this.els.inpGmInviteUrl.value = `${baseUrl}?room=${state.room.code}&role=gm`;

    const isGm = state.role !== 'player';
    this.els.btnAddPlayerInvite?.classList.toggle('hidden', !isGm);
    this.els.gmInviteRow?.classList.toggle('hidden', !isGm);

    if (this.els.playerInvitesList) {
      const boardProtags = (state.tokens || []).filter((t) => t.isAlly !== false);
      const boardById = new Map(boardProtags.map((t) => [t.id, t]));
      const spawnedKeys = new Set(boardProtags.map((t) => t.actorKey).filter(Boolean));
      const spawnedNames = new Set(boardProtags.map((t) => t.name));
      const compProtags = (state.customActors || []).filter(
        (a) => a.isAlly !== false && !spawnedKeys.has(a.key) && !spawnedNames.has(a.name)
      );

      if (!isGm) {
        const cur = Selector.getActiveInvite(state);
        const curNames = (cur?.tokenIds || []).map((id) => boardById.get(id)?.name).filter(Boolean);
        this.els.playerInvitesList.innerHTML = `
          <div class="portal-subpanel rounded-xl px-3 py-2 text-[11px] flex items-center justify-between gap-2">
            <span class="font-semibold">${esc(cur?.label || 'Invitación')}</span>
            <span class="opacity-75">${curNames.length ? esc(curNames.join(', ')) : 'Modo Espectador'}</span>
          </div>
        `;
      } else {
        this.els.playerInvitesList.innerHTML = invites
          .map((inv) => {
            const validIds = (Array.isArray(inv.tokenIds) ? inv.tokenIds : []).filter((id) => boardById.has(id));
            const isSpec = validIds.length === 0;
            const statusTxt = isSpec ? 'Modo Espectador' : `${validIds.length} Protagonista${validIds.length > 1 ? 's' : ''}`;
            const tokenPills = boardProtags
              .map((t) => {
                const active = validIds.includes(t.id);
                return `<button type="button" data-toggle-invite-char="${esc(inv.id)}|${esc(t.id)}" class="portal-btn h-6 px-2 rounded-full text-[10px] font-semibold gap-1 ${active ? 'portal-btn-accent' : 'portal-panel opacity-75 hover:opacity-100'}"><span class="w-2 h-2 rounded-full shrink-0" style="background:${esc(t.color || '#8b5cf6')};"></span><span class="truncate max-w-[115px]">${esc(t.name)}</span></button>`;
              })
              .join('');
            const compPills = compProtags
              .map((a) => `<button type="button" data-toggle-invite-char="${esc(inv.id)}|actor:${esc(a.key)}" class="portal-btn h-6 px-2 rounded-full text-[10px] font-medium gap-1 portal-panel opacity-70 hover:opacity-100" title="Invoca este Protagonista en mesa y lo asigna"><span class="w-2 h-2 rounded-full shrink-0" style="background:${esc(a.color || '#8b5cf6')};"></span><span class="truncate max-w-[100px]">${esc(a.name)}</span><span class="text-[9px] opacity-65">+</span></button>`)
              .join('');
            return `
              <div class="portal-subpanel rounded-xl p-2.5 flex flex-col gap-2">
                <div class="flex flex-wrap items-center justify-between gap-1.5">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <input type="text" data-invite-name="${esc(inv.id)}" value="${esc(inv.label)}" class="portal-input px-2 py-1 text-[11px] font-semibold w-28 min-w-0" />
                    <span class="text-[10px] px-2 py-0.5 rounded-full portal-panel opacity-80 whitespace-nowrap">${statusTxt}</span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" data-preview-invite="${esc(inv.id)}" class="portal-btn portal-panel px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap" title="Previsualizar la mesa con este enlace">Probar</button>
                    <button type="button" data-copy-invite="${esc(inv.id)}" class="portal-btn portal-btn-accent px-2.5 py-1 rounded-lg text-[10.5px] font-semibold whitespace-nowrap">Copiar enlace</button>
                    <button type="button" data-del-invite="${esc(inv.id)}" class="portal-btn portal-panel w-6 h-6 p-0 rounded-full flex items-center justify-center text-rose-400 opacity-75 hover:opacity-100" title="Eliminar enlace">✕</button>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-1">
                  <button type="button" data-clear-invite-chars="${esc(inv.id)}" class="portal-btn h-6 px-2 rounded-full text-[10px] font-semibold ${isSpec ? 'portal-btn-accent' : 'portal-panel opacity-75 hover:opacity-100'}">👁️ Modo Espectador</button>
                  ${tokenPills}
                  ${compPills}
                </div>
              </div>
            `;
          })
          .join('');

        this.els.playerInvitesList.querySelectorAll('[data-invite-name]').forEach((inp) => {
          inp.addEventListener('change', () => Service.renamePlayerInvite(inp.dataset.inviteName, inp.value));
        });
        this.els.playerInvitesList.querySelectorAll('[data-preview-invite]').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.els.roomModal.classList.remove('is-open');
            Service.previewPlayerInvite(btn.dataset.previewInvite);
          });
        });
        this.els.playerInvitesList.querySelectorAll('[data-copy-invite]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const url = `${baseUrl}?room=${state.room.code}&role=player&invite=${btn.dataset.copyInvite}`;
            try {
              if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
            } catch (_) {}
            const invObj = invites.find((x) => x.id === btn.dataset.copyInvite);
            this.showRoomToast(`Enlace "${invObj?.label || 'Jugador'}" copiado.`);
          });
        });
        this.els.playerInvitesList.querySelectorAll('[data-del-invite]').forEach((btn) => {
          btn.addEventListener('click', () => {
            Service.removePlayerInvite(btn.dataset.delInvite);
            this.renderRoomModal(Service.state);
          });
        });
        this.els.playerInvitesList.querySelectorAll('[data-clear-invite-chars]').forEach((btn) => {
          btn.addEventListener('click', () => {
            Service.clearInviteCharacters(btn.dataset.clearInviteChars);
            this.renderRoomModal(Service.state);
          });
        });
        this.els.playerInvitesList.querySelectorAll('[data-toggle-invite-char]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const raw = btn.dataset.toggleInviteChar || '';
            const sep = raw.indexOf('|');
            if (sep < 0) return;
            await Service.toggleInviteCharacter(raw.slice(0, sep), raw.slice(sep + 1));
            this.renderRoomModal(Service.state);
          });
        });
      }
    }
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
