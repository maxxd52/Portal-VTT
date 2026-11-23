/* ==========================================================================
   PRESENCE VIEW: ASIENTOS SUPERIORES (GM/JUGADORES), SUB-TOKENS Y TURNOS
   ========================================================================== */

import { Selector } from '../core/selector.js?v=20261123a7';
import { Service } from '../core/service.js?v=20261123a7';
import { WebPConverter } from '../utils/webpConverter.js';

export const PresenceViewMethods = {
  bindPresenceEvents() {
    if (this.els.btnCloseProfilePopover) {
      this.els.btnCloseProfilePopover.addEventListener('click', () => {
        this.els.profilePopover?.classList.remove('is-open');
      });
    }

    if (this.els.fileProfileAvatar) {
      this.els.fileProfileAvatar.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await WebPConverter.fileToWebPDataUrl(file, 160, 0.82);
          if (this.els.inpProfileAvatarUrl) this.els.inpProfileAvatarUrl.value = dataUrl;
          this.renderProfilePreview(
            this.els.inpProfileName?.value || Service.getLocalProfile().name,
            dataUrl,
            this.els.inpProfileColor?.value || Service.getLocalProfile().color
          );
        } catch (err) {
          this.showActionToast(err?.message || 'No se pudo cargar la imagen.');
        } finally {
          e.target.value = '';
        }
      });
    }

    if (this.els.inpProfileAvatarUrl) {
      this.els.inpProfileAvatarUrl.addEventListener('input', () => {
        this.renderProfilePreview(
          this.els.inpProfileName?.value || '',
          this.els.inpProfileAvatarUrl.value,
          this.els.inpProfileColor?.value || '#8b5cf6'
        );
      });
    }

    if (this.els.inpProfileName) {
      this.els.inpProfileName.addEventListener('input', () => {
        this.renderProfilePreview(
          this.els.inpProfileName.value,
          this.els.inpProfileAvatarUrl?.value || '',
          this.els.inpProfileColor?.value || '#8b5cf6'
        );
      });
    }

    if (this.els.inpProfileColor) {
      this.els.inpProfileColor.addEventListener('input', () => {
        this.renderProfilePreview(
          this.els.inpProfileName?.value || '',
          this.els.inpProfileAvatarUrl?.value || '',
          this.els.inpProfileColor.value
        );
      });
    }

    if (this.els.btnClearProfileAvatar) {
      this.els.btnClearProfileAvatar.addEventListener('click', () => {
        if (this.els.inpProfileAvatarUrl) this.els.inpProfileAvatarUrl.value = '';
        this.renderProfilePreview(
          this.els.inpProfileName?.value || '',
          '',
          this.els.inpProfileColor?.value || '#8b5cf6'
        );
      });
    }

    if (this.els.btnSaveProfile) {
      this.els.btnSaveProfile.addEventListener('click', () => {
        Service.updateLocalProfile({
          name: this.els.inpProfileName?.value ?? '',
          avatarUrl: this.els.inpProfileAvatarUrl?.value ?? '',
          color: this.els.inpProfileColor?.value ?? '#8b5cf6'
        });
        this.els.profilePopover?.classList.remove('is-open');
        this.showActionToast('Perfil actualizado.');
      });
    }

    if (this.els.btnClosePlayerTokenPicker) {
      this.els.btnClosePlayerTokenPicker.addEventListener('click', () => {
        this.els.playerTokenPickerPopover?.classList.remove('is-open');
      });
    }

    document.addEventListener('click', (e) => {
      if (
        this.els.profilePopover?.classList.contains('is-open') &&
        !e.target.closest('#profilePopover') &&
        !e.target.closest('[data-seat-avatar]')
      ) {
        this.els.profilePopover.classList.remove('is-open');
      }
      if (
        this.els.playerTokenPickerPopover?.classList.contains('is-open') &&
        !e.target.closest('#playerTokenPickerPopover') &&
        !e.target.closest('[data-seat-avatar]')
      ) {
        this.els.playerTokenPickerPopover.classList.remove('is-open');
      }
      if (
        this.els.combatTrackerPopover?.classList.contains('is-open') &&
        !e.target.closest('#combatTrackerPopover') &&
        !e.target.closest('#btnToggleCombat') &&
        !e.target.closest('#btnNextTurn')
      ) {
        this.setCombatPopoverOpen(false);
      }
      if (
        this.els.chatDrawer?.classList.contains('is-open') &&
        !e.target.closest('#chatDrawer') &&
        !e.target.closest('#btnToggleChatDrawer') &&
        !e.target.closest('[data-seat-avatar]')
      ) {
        this.setChatDrawerOpen(false);
      }
    });

    if (this.els.btnToggleChatDrawer) {
      this.els.btnToggleChatDrawer.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = Boolean(this.els.chatDrawer?.classList.contains('is-open'));
        if (isOpen && Service.chatTarget?.channel === 'whisper') {
          Service.chatTarget = { channel: 'table' };
          Service.markChatRead('table');
          this.renderChatUI();
          this.els.inpChatMessage?.focus();
          return;
        }
        if (!isOpen) Service.chatTarget = { channel: 'table' };
        this.setChatDrawerOpen(!isOpen);
      });
    }

    if (this.els.btnCloseChatDrawer) {
      this.els.btnCloseChatDrawer.addEventListener('click', () => this.setChatDrawerOpen(false));
    }

    if (this.els.btnChatChannelTable) {
      this.els.btnChatChannelTable.addEventListener('click', () => {
        Service.chatTarget = { channel: 'table' };
        Service.markChatRead('table');
        this.renderChatUI();
        this.els.inpChatMessage?.focus();
      });
    }

    if (this.els.chatForm) {
      this.els.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = this.els.inpChatMessage;
        if (!inp) return;
        const sent = Service.sendChatMessage(inp.value, Service.chatTarget);
        if (sent) {
          inp.value = '';
          this.renderChatUI();
        }
      });
    }
  },

  setCombatPopoverOpen(open) {
    const pop = this.els.combatTrackerPopover;
    if (!pop) return;
    const isAllowed = Service.state.role === 'gm' || Service.state.systemConfig?.combatTrackerPublic !== false;
    const next = Boolean(open) && isAllowed && Boolean(Service.state.combat?.active);
    if (next) {
      this.els.profilePopover?.classList.remove('is-open');
      this.els.playerTokenPickerPopover?.classList.remove('is-open');
      if (Service.chatOpen) this.setChatDrawerOpen(false);
    } else {
      this.combatAddOpen = false;
    }
    pop.classList.toggle('is-open', next);
  },

  setChatDrawerOpen(open) {
    const drawer = this.els.chatDrawer;
    if (!drawer) return;
    Service.chatOpen = Boolean(open);
    drawer.classList.toggle('is-open', Service.chatOpen);
    if (Service.chatOpen) {
      this.els.profilePopover?.classList.remove('is-open');
      this.els.playerTokenPickerPopover?.classList.remove('is-open');
      this.els.combatTrackerPopover?.classList.remove('is-open');
      Service.markChatRead();
      this.renderChatUI();
      setTimeout(() => this.els.inpChatMessage?.focus(), 40);
    }
  },

  openChatForSeat(seat) {
    if (!seat) return;
    const alreadyOpenHere =
      Service.chatOpen &&
      Service.chatTarget?.channel === 'whisper' &&
      Service.chatTarget.seatKey === seat.seatKey;
    if (alreadyOpenHere) {
      this.setChatDrawerOpen(false);
      return;
    }
    Service.chatTarget = {
      channel: 'whisper',
      seatKey: seat.seatKey,
      clientId: seat.clientId || '',
      inviteId: seat.inviteId || '',
      name: seat.name || 'Jugador'
    };
    this.setChatDrawerOpen(true);
  },

  renderChatUI() {
    const unread = Number(Service.chatUnreadTable ?? Service.chatUnreadCount) || 0;
    if (this.els.lblChatUnread) {
      this.els.lblChatUnread.textContent = unread > 9 ? '9+' : String(unread);
      this.els.lblChatUnread.classList.toggle('hidden', unread <= 0);
    }

    const tgt = Service.chatTarget || { channel: 'table' };
    const isWhisper = tgt.channel === 'whisper' && (tgt.seatKey || tgt.clientId);
    if (this.els.btnChatChannelTable) {
      this.els.btnChatChannelTable.classList.toggle('is-active', !isWhisper);
      this.els.btnChatChannelTable.textContent = unread > 0 && isWhisper ? `Mesa (${unread > 9 ? '9+' : unread})` : 'Mesa';
    }
    if (this.els.lblChatTargetBadge) {
      this.els.lblChatTargetBadge.classList.toggle('hidden', !isWhisper);
      this.els.lblChatTargetBadge.textContent = isWhisper ? `Privado · ${tgt.name || 'Jugador'}` : '';
    }
    if (this.els.inpChatMessage) {
      this.els.inpChatMessage.placeholder = isWhisper
        ? `Mensaje privado a ${tgt.name || 'Jugador'}...`
        : 'Escribir en la mesa...';
    }

    const listEl = this.els.chatMessagesList;
    if (!listEl) return;
    const esc = (v) => this.escapeHtml(v || '');

    if (this.els.chatTargetTokensRow) {
      const targetTokens = isWhisper ? this.getTokensForSeat(tgt, Service.state) : [];
      if (targetTokens.length > 0) {
        this.els.chatTargetTokensRow.classList.remove('hidden');
        this.els.chatTargetTokensRow.classList.add('flex');
        this.els.chatTargetTokensRow.innerHTML = targetTokens
          .map((tok) => {
            const initials = esc(tok.name.slice(0, 2).toUpperCase());
            const iconHtml = tok.imageUrl
              ? `<img src="${esc(tok.imageUrl)}" alt="${esc(tok.name)}" class="w-4 h-4 object-contain shrink-0" />`
              : `<span class="w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center shrink-0" style="background:${esc(tok.color || '#475569')};">${initials}</span>`;
            return `
              <button
                type="button"
                data-whisper-tok="${esc(tok.id)}"
                class="portal-subpanel portal-btn px-2 py-0.5 rounded-full text-[10.5px] gap-1.5 max-w-[140px]"
                title="Centrar cámara en ${esc(tok.name)}"
              >
                ${iconHtml}
                <span class="truncate">${esc(tok.name)}</span>
              </button>
            `;
          })
          .join('');
        this.els.chatTargetTokensRow.querySelectorAll('[data-whisper-tok]').forEach((btn) => {
          const tokId = btn.dataset.whisperTok;
          btn.addEventListener('mouseenter', () => this.setBoardTokensCombatHover([tokId], true));
          btn.addEventListener('mouseleave', () => this.setBoardTokensCombatHover([tokId], false));
          btn.addEventListener('click', () => {
            const tok = (Service.state.tokens || []).find((t) => t.id === tokId);
            if (!tok) return;
            Service.focusToken(tok.id);
            if (Service.canControlToken(tok)) Service.selectToken(tok.id, true);
          });
        });
      } else {
        this.els.chatTargetTokensRow.classList.add('hidden');
        this.els.chatTargetTokensRow.classList.remove('flex');
        this.els.chatTargetTokensRow.innerHTML = '';
      }
    }

    const msgs = Service.getVisibleChatMessages();
    if (!msgs.length) {
      const emptyMsg = isWhisper
        ? `Chat privado con ${esc(tgt.name || 'Jugador')}. Solo ustedes dos ven estos mensajes.`
        : 'Sin mensajes en el chat general. Escribe a la mesa o toca un avatar para chat privado.';
      listEl.innerHTML = `<div class="text-[11px] opacity-50 text-center py-4">${emptyMsg}</div>`;
      return;
    }

    listEl.innerHTML = msgs
      .map((m) => {
        const mine = m.senderClientId === Service.clientId;
        return `
          <div class="rounded-xl px-2.5 py-1.5 ${mine ? 'bg-white/10 ml-4' : 'portal-subpanel mr-4'} ${m.channel === 'whisper' ? 'border border-amber-400/30' : ''}">
            <div class="flex items-center justify-between gap-2 mb-0.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="w-2 h-2 rounded-full shrink-0" style="background:${esc(m.senderColor || '#8b5cf6')};"></span>
                <span class="font-semibold text-[10.5px] truncate">${esc(m.senderName)}</span>
              </div>
              <span class="text-[9px] opacity-50 tabular-nums shrink-0">${esc(m.time)}</span>
            </div>
            <div class="text-[11px] leading-snug break-words opacity-95">${esc(m.text)}</div>
          </div>
        `;
      })
      .join('');
    listEl.scrollTop = listEl.scrollHeight;
  },

  renderProfilePreview(name, avatarUrl, color) {
    const box = this.els.profilePreviewAvatar;
    if (!box) return;
    const esc = (v) => this.escapeHtml(v || '');
    const cleanName = String(name || 'Tú').trim() || 'Tú';
    const cleanUrl = String(avatarUrl || '').trim();
    box.style.backgroundColor = color || '#8b5cf6';
    box.innerHTML = cleanUrl
      ? `<img src="${esc(cleanUrl)}" alt="${esc(cleanName)}" class="w-full h-full object-cover" />`
      : `<span>${esc(cleanName.slice(0, 2).toUpperCase())}</span>`;
  },

  openProfilePopover() {
    const pop = this.els.profilePopover;
    if (!pop) return;
    this.els.playerTokenPickerPopover?.classList.remove('is-open');
    this.els.combatTrackerPopover?.classList.remove('is-open');
    if (Service.chatOpen) this.setChatDrawerOpen(false);
    const prof = Service.getLocalProfile();
    if (this.els.inpProfileName) this.els.inpProfileName.value = prof.name;
    if (this.els.inpProfileAvatarUrl) this.els.inpProfileAvatarUrl.value = prof.avatarUrl;
    if (this.els.inpProfileColor) this.els.inpProfileColor.value = prof.color;
    this.renderProfilePreview(prof.name, prof.avatarUrl, prof.color);
    pop.classList.toggle('is-open');
  },

  openPlayerTokenPicker(seat) {
    const pop = this.els.playerTokenPickerPopover;
    const listEl = this.els.playerTokenPickerList;
    if (!pop || !listEl) return;
    const tokens = this.getTokensForSeat(seat, Service.state);
    if (tokens.length <= 1) {
      if (tokens[0]) {
        Service.focusToken(tokens[0].id);
        Service.selectToken(tokens[0].id, true);
      } else {
        this.showActionToast('Todavía no tienes fichas asignadas.');
      }
      return;
    }

    this.els.profilePopover?.classList.remove('is-open');
    this.els.combatTrackerPopover?.classList.remove('is-open');
    if (Service.chatOpen) this.setChatDrawerOpen(false);

    const currentPrimary = Service.getPrimaryTokenForInvite({ id: seat.inviteId, tokenIds: tokens.map((t) => t.id) });
    const esc = (v) => this.escapeHtml(v || '');
    listEl.innerHTML = tokens
      .map((tok) => {
        const isCurrent = currentPrimary && currentPrimary.id === tok.id;
        const initials = esc(tok.name.slice(0, 2).toUpperCase());
        const avatar = tok.imageUrl
          ? `<img src="${esc(tok.imageUrl)}" alt="${esc(tok.name)}" class="w-8 h-8 object-contain shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]" />`
          : `<span class="w-8 h-8 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0" style="background:${esc(tok.color || '#3b82f6')};">${initials}</span>`;
        return `
          <button
            type="button"
            data-pick-primary-tok="${esc(tok.id)}"
            class="portal-btn justify-between px-2 py-1.5 rounded-xl text-left ${isCurrent ? 'portal-btn-active' : 'portal-subpanel'}"
          >
            <span class="flex items-center gap-2 min-w-0">
              ${avatar}
              <span class="truncate font-semibold text-[11px]">${esc(tok.name)}</span>
            </span>
            ${isCurrent ? '<span class="text-[9.5px] font-bold opacity-80">Activo</span>' : ''}
          </button>
        `;
      })
      .join('');

    listEl.querySelectorAll('[data-pick-primary-tok]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tokId = btn.dataset.pickPrimaryTok;
        Service.setPrimaryPlayerToken(tokId);
        Service.focusToken(tokId);
        Service.selectToken(tokId, true);
        pop.classList.remove('is-open');
      });
    });

    pop.classList.toggle('is-open');
  },

  getCombatHpRingColor(tokens) {
    const withHp = tokens.filter((t) => t._redacted || Number(t.maxHp) > 0);
    if (!withHp.length) return { color: '#10b981', defeated: false, pct: 100 };
    const hasRedacted = withHp.some((t) => t._redacted);
    let pct = 100;
    let defeated = false;
    if (hasRedacted) {
      const avg = Math.round(
        withHp.reduce((sum, t) => sum + (t._redacted ? (Number(t.hpPct) || 0) : (Number(t.maxHp) > 0 ? Math.round((Math.max(0, Number(t.hp) || 0) / Number(t.maxHp)) * 100) : 0)), 0) / withHp.length
      );
      pct = Math.max(0, Math.min(100, avg));
      defeated = withHp.every((t) => (t._redacted ? Boolean(t.defeated) : (Number(t.hp) || 0) <= 0));
    } else {
      const totalHp = withHp.reduce((sum, t) => sum + Math.max(0, Number(t.hp) || 0), 0);
      const totalMax = withHp.reduce((sum, t) => sum + (Number(t.maxHp) || 0), 0);
      pct = totalMax > 0 ? Math.round((totalHp / totalMax) * 100) : 0;
      defeated = totalHp <= 0;
    }
    if (defeated) return { color: '#64748b', defeated: true, pct: 0 };
    if (pct <= 20) return { color: '#ef4444', defeated: false, pct };
    if (pct <= 50) return { color: '#f59e0b', defeated: false, pct };
    return { color: '#10b981', defeated: false, pct };
  },

  setBoardTokensCombatHover(tokenIds, active) {
    const layer = this.els.tokensLayer;
    if (!layer || !Array.isArray(tokenIds)) return;
    tokenIds.forEach((id) => {
      const el = layer.querySelector(`.vtt-token[data-token-id="${CSS.escape(id)}"]`);
      if (el) el.classList.toggle('is-combat-hover', active);
    });
  },

  getTokensForSeat(seat, state) {
    const tokens = state.tokens || [];
    const tokensById = new Map(tokens.map((t) => [t.id, t]));
    const isPlayer = state.role === 'player';
    const invites = Selector.getPlayerInvites(state);

    if (seat.seatKey === 'gm') {
      const assignedIds = new Set(invites.flatMap((inv) => (Array.isArray(inv.tokenIds) ? inv.tokenIds : [])));
      return tokens.filter((t) => !assignedIds.has(t.id) && (!t.hidden || !isPlayer));
    }

    const inv = invites.find((i) => i.id === (seat.inviteId || seat.seatKey));
    if (!inv || !Array.isArray(inv.tokenIds)) return [];
    return inv.tokenIds
      .map((id) => tokensById.get(id))
      .filter((t) => t && (!t.hidden || !isPlayer || seat.isSelf));
  },

  buildTableSeats(state) {
    const activePeers = Service.getActivePeers();
    const invites = Selector.getPlayerInvites(state);
    const tokensById = new Map((state.tokens || []).map((t) => [t.id, t]));
    const assignedToAnyInvite = new Set(
      invites.flatMap((inv) => (Array.isArray(inv.tokenIds) ? inv.tokenIds : []))
    );
    const combat = state.combat?.active ? state.combat : null;
    const activeEntry = combat ? (combat.order || [])[combat.turnIndex] : null;
    const activeIds = activeEntry
      ? (Array.isArray(activeEntry.tokenIds) && activeEntry.tokenIds.length ? activeEntry.tokenIds : [activeEntry.tokenId])
      : [];

    const isHostNet = Service.isHostNetwork();
    const gmPeers = activePeers.filter((p) => p.role === 'gm');
    const gmPeer = gmPeers.find((p) => p.self) || gmPeers[0];
    const gmHasTurn = activeIds.some((id) => !assignedToAnyInvite.has(id));

    const seats = [
      {
        seatKey: 'gm',
        role: 'gm',
        clientId: gmPeer?.clientId || '',
        isSelf: isHostNet,
        online: Boolean(gmPeer),
        hasTurn: gmHasTurn,
        tokenCount: 0,
        name: gmPeer?.profile?.name || 'Director',
        avatarUrl: gmPeer?.profile?.avatarUrl || '',
        color: gmPeer?.profile?.color || '#8b5cf6'
      }
    ];

    const matchedPeerIds = new Set(gmPeers.map((p) => p.clientId));

    invites.forEach((inv) => {
      const isSelf = !isHostNet && state.role === 'player' && state.activeInviteId === inv.id;
      const peer = isSelf
        ? activePeers.find((p) => p.self)
        : activePeers.find((p) => p.role === 'player' && p.inviteId === inv.id);
      if (peer) matchedPeerIds.add(peer.clientId);

      const invIdList = Array.isArray(inv.tokenIds) ? inv.tokenIds : [];
      const invIds = new Set(invIdList);
      const assignedTokens = invIdList.map((id) => tokensById.get(id)).filter(Boolean);
      const hasTurn = activeIds.some((id) => invIds.has(id));
      const actingTok = hasTurn ? assignedTokens.find((t) => activeIds.includes(t.id)) : null;
      const primaryTok = Service.getPrimaryTokenForInvite(inv, tokensById);
      const displayTok = actingTok || primaryTok;

      seats.push({
        seatKey: inv.id,
        role: 'player',
        inviteId: inv.id,
        clientId: peer?.clientId || '',
        isSelf,
        online: Boolean(peer),
        hasTurn,
        tokenCount: assignedTokens.length,
        name: displayTok?.name || inv.label || 'Jugador',
        avatarUrl: displayTok?.imageUrl || '',
        color: displayTok?.color || '#3b82f6'
      });
    });

    activePeers
      .filter((p) => !matchedPeerIds.has(p.clientId))
      .forEach((p) => {
        seats.push({
          seatKey: `peer:${p.clientId}`,
          role: p.role || 'player',
          clientId: p.clientId,
          isSelf: Boolean(p.self),
          online: true,
          hasTurn: false,
          tokenCount: 0,
          name: 'Espectador',
          avatarUrl: '',
          color: '#0ea5e9'
        });
      });

    return seats;
  },

  renderCombatOrderRowHtml(item, state) {
    const esc = (v) => this.escapeHtml(v || '');
    const entryTokens = item.tokens;
    const aliveTokens = entryTokens.filter((t) => (t._redacted ? !t.defeated : !(Number(t.maxHp) > 0 && (Number(t.hp) || 0) <= 0)));
    const repTok = aliveTokens[0] || entryTokens[0];
    const hpInfo = this.getCombatHpRingColor(entryTokens);

    const condKeys = [...new Set(
      (aliveTokens.length ? aliveTokens : entryTokens).flatMap((t) => (Array.isArray(t.conditions) ? t.conditions : []))
    )];
    const firstCondDef = condKeys.length ? Selector.getStatusDef(state, condKeys[0]) : null;
    const condLabels = condKeys.map((k) => Selector.getStatusDef(state, k)?.label || k);

    const initials = esc(repTok.name.slice(0, 2).toUpperCase());
    const avatarHtml = repTok.imageUrl
      ? `<img src="${esc(repTok.imageUrl)}" alt="${esc(item.label)}" class="w-full h-full object-contain pointer-events-none" />`
      : `<span class="text-[9.5px] font-bold text-white pointer-events-none select-none">${initials}</span>`;

    const hpSummary = item.isGroup
      ? `Vivos ${aliveTokens.length}/${entryTokens.length}`
      : (repTok._redacted ? '' : (Number(repTok.maxHp) > 0 ? `HP ${Math.max(0, Number(repTok.hp) || 0)}/${repTok.maxHp}` : ''));
    const subParts = [
      item.isTurn ? 'Turno actual' : '',
      hpSummary,
      condLabels.length ? condLabels.join(', ') : ''
    ].filter(Boolean);

    const isGm = state.role === 'gm';
    const entryId = item.entry?.id || repTok.id;
    const gmRowActionsHtml = isGm
      ? `
        <span class="combat-row-actions">
          ${!item.isTurn ? `<button type="button" class="combat-row-act-btn" data-combat-act="jump" data-combat-entry="${esc(entryId)}" title="Pasar turno aquí" aria-label="Pasar turno aquí"><svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><polygon points="4,3 13,8 4,13"/></svg></button>` : ''}
          <button type="button" class="combat-row-act-btn" data-combat-act="up" data-combat-entry="${esc(entryId)}" title="Subir en el orden" aria-label="Subir en el orden"><svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10l4-4 4 4"/></svg></button>
          <button type="button" class="combat-row-act-btn" data-combat-act="down" data-combat-entry="${esc(entryId)}" title="Bajar en el orden" aria-label="Bajar en el orden"><svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6l4 4 4-4"/></svg></button>
          <button type="button" class="combat-row-act-btn" data-combat-act="remove" data-combat-entry="${esc(entryId)}" title="Quitar del combate" aria-label="Quitar del combate"><svg class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </span>
      `
      : '';
    const initControlHtml = isGm && !item.entry?.label
      ? `<input type="text" inputmode="numeric" data-combat-init-entry="${esc(entryId)}" value="${item.pending ? '' : esc(String(item.entry?.init ?? 0))}" placeholder="⏳" class="combat-order-init combat-order-init-input" title="Editar iniciativa (Enter para aplicar)" aria-label="Iniciativa de ${esc(item.label)}" />`
      : `<span class="combat-order-init">${esc(item.initBadge)}</span>`;

    return `
      <div
        role="button"
        tabindex="0"
        data-combat-tok="${esc(repTok.id)}"
        data-combat-entry-id="${esc(entryId)}"
        data-combat-ids="${esc(entryTokens.map((t) => t.id).join(','))}"
        class="combat-order-row ${item.isTurn ? 'is-active' : ''} ${hpInfo.defeated ? 'is-defeated' : ''}"
        title="${esc([item.label, ...subParts].join(' · '))}"
      >
        <span
          class="combat-token-avatar ${repTok.imageUrl ? 'has-image' : ''} shrink-0"
          style="background:${repTok.imageUrl ? 'transparent' : esc(repTok.color || '#475569')}; --hp-ring:${hpInfo.color};"
        >
          ${avatarHtml}
          ${firstCondDef ? `<span class="combat-token-cond" style="background:${esc(firstCondDef.color)};"></span>` : ''}
          ${item.isGroup ? `<span class="combat-token-group-badge">×${aliveTokens.length}</span>` : ''}
        </span>
        <span class="flex-1 min-w-0 text-left">
          <span class="block text-[11.5px] font-semibold truncate">${esc(item.label)}</span>
          ${subParts.length ? `<span class="block text-[9.5px] opacity-65 truncate">${esc(subParts.join(' · '))}</span>` : ''}
        </span>
        ${gmRowActionsHtml}
        ${initControlHtml}
      </div>
    `;
  },

  renderSeatRollCardHtml(seatKey, state, seat = null) {
    if (!(Service.seatRolls instanceof Map)) return '';
    const roll = Service.seatRolls.get(seatKey);
    if (!roll) return '';
    if (Service.isRollFlying?.(roll.rollId)) return '';

    const esc = (v) => this.escapeHtml(v || '');
    const diceList = Array.isArray(roll.dice) && roll.dice.length > 0
      ? roll.dice
      : [{ sides: roll.sides, chosen: roll.chosen }];
    const rollMode = roll.resultMode || state.dice?.resultMode || 'sum';
    const rollThr = Number(roll.successThreshold) || Number(state.dice?.successThreshold) || 6;
    const summary = Service.computeRollSummary(diceList, roll.mod, rollMode, rollThr, { target: roll.target });

    const isPositive = summary.isCrit || summary.outcomeTone === 'success';
    const isNegative = summary.isFumble || summary.outcomeTone === 'fail';
    const isPartial = summary.outcomeTone === 'partial';
    const toneClass = isPositive
      ? 'is-crit'
      : isNegative
        ? 'is-fumble'
        : isPartial
          ? 'is-partial'
          : '';

    const isExpanded = Service.expandedSeatRollKey === seatKey;
    const modNum = Number(roll.mod) || 0;
    const modTxt = modNum === 0 ? '' : modNum > 0 ? ` +${modNum}` : ` −${Math.abs(modNum)}`;
    const baseLabel = String(roll.label || `1d${roll.sides || 20}`).trim();
    const formulaTxt = `${baseLabel}${modTxt}`;
    const tagTxt = summary.isCrit
      ? (summary.critLabel || 'Crítico')
      : summary.isFumble
        ? (summary.fumbleLabel || 'Pifia')
        : (summary.outcomeTag || '');
    const natDetail = diceList.length > 0
      ? diceList.map((d) => (d.kind === 'card' && d.card ? d.card.label : `d${d.sides}:${d.chosen}`)).join(' · ')
      : '';
    const allCoins = diceList.length > 0 && diceList.every((d) => d.kind === 'coin' || Number(d.sides) === 2);
    const allCards = diceList.length > 0 && diceList.every((d) => d.kind === 'card' && d.card);
    const isMultiEach = diceList.length > 1 && (rollMode === 'each' || allCards);
    const formatChip = (d) => {
      if (d.kind === 'card' && d.card) {
        return { text: d.card.isJoker ? '★' : d.card.label, tone: d.card.isJoker ? 'is-crit' : '' };
      }
      if (d.kind === 'coin' || Number(d.sides) === 2) {
        return { text: d.chosen === 1 ? '★' : '✕', tone: d.chosen === 1 ? 'is-crit' : '' };
      }
      const val = (Number(d.chosen) || 0) + modNum;
      const sidesNum = Number(d.sides) || 20;
      const chipTone = d.chosen === sidesNum ? 'is-crit' : d.chosen === 1 ? 'is-fumble' : '';
      return { text: String(val), tone: chipTone };
    };

    const rawTotal = rollMode === 'each' && diceList.length > 1 && !allCards && !allCoins
      ? diceList.reduce((acc, d) => acc + (Number(d.chosen) || 0) + modNum, 0)
      : Number(summary.total) || 0;
    const totalNum = Math.max(0, rawTotal);
    const showHpActions = isExpanded && state.role === 'gm' && state.selectedTokenId && totalNum > 0;
    const isOwner = roll.rollerClientId === Service.clientId;
    const seatColor = esc(seat?.color || '#8b5cf6');
    const closeBtn = `
      <button
        type="button"
        data-roll-dismiss="${esc(seatKey)}:${esc(roll.rollId || '')}"
        data-roll-owner="${isOwner ? '1' : '0'}"
        class="seat-roll-close"
        title="${isOwner ? 'Cerrar para todos' : 'Ocultar'}"
      >✕</button>
    `;

    if (!isExpanded) {
      const lockBadge = roll.visibility === 'private'
        ? '<span class="seat-roll-lock" title="Tirada privada">🔒</span>'
        : '';

      let compactInnerHtml = '';
      if (isMultiEach) {
        const visibleDice = diceList.length > 4 ? diceList.slice(0, 3) : diceList;
        const extraCount = diceList.length > 4 ? diceList.length - 3 : 0;
        const chipsHtml = visibleDice
          .map((d) => {
            const chip = formatChip(d);
            return `<span class="seat-roll-mini-chip ${chip.tone}">${esc(chip.text)}</span>`;
          })
          .join('');
        const moreHtml = extraCount > 0
          ? `<span class="seat-roll-mini-chip is-more">+${extraCount}</span>`
          : '';
        compactInnerHtml = `<div class="seat-roll-mini-grid">${chipsHtml}${moreHtml}</div>`;
      } else if (allCoins && diceList.length > 1) {
        const heads = diceList.filter((d) => d.chosen === 1).length;
        const tails = diceList.length - heads;
        compactInnerHtml = `
          <div class="seat-roll-mini-grid">
            <span class="seat-roll-mini-chip ${heads > 0 ? 'is-crit' : ''}">${heads}★</span>
            <span class="seat-roll-mini-chip">${tails}✕</span>
          </div>
        `;
      } else {
        let singleText = summary.headline;
        if (allCoins && diceList.length === 1) {
          singleText = diceList[0].chosen === 1 ? '★1' : '✕0';
        } else if (allCards && diceList.length === 1) {
          singleText = diceList[0].card.isJoker ? '★' : diceList[0].card.label;
        }
        compactInnerHtml = `<span class="seat-roll-total">${esc(singleText)}</span>`;
      }

      return `
        <div
          data-seat-roll-card="${esc(seatKey)}"
          class="seat-roll-card is-compact ${isMultiEach || (allCoins && diceList.length > 1) ? 'is-grid' : ''} ${toneClass}"
          style="--seat-accent:${seatColor};"
          title="${esc(formulaTxt)}: ${esc(summary.headline)}${tagTxt ? ' · ' + esc(tagTxt) : ''} (clic para ver detalle)"
        >
          ${lockBadge}
          ${closeBtn}
          ${compactInnerHtml}
        </div>
      `;
    }

    const expandedRightHeaderHtml = isMultiEach
      ? `<span class="seat-roll-count-badge">×${diceList.length}</span>`
      : `<span class="seat-roll-total">${esc(summary.headline)}</span>`;

    const expandedMultiChipsHtml = isMultiEach
      ? `<div class="seat-roll-expanded-grid">${diceList
          .map((d) => {
            const chip = formatChip(d);
            return `<span class="seat-roll-expanded-chip ${chip.tone}">${esc(chip.text)}</span>`;
          })
          .join('')}</div>`
      : '';

    return `
      <div
        data-seat-roll-card="${esc(seatKey)}"
        class="seat-roll-card is-expanded ${toneClass}"
        style="--seat-accent:${seatColor};"
        title="Clic para contraer"
      >
        <div class="flex items-center justify-between gap-2 min-w-0">
          <div class="flex items-center gap-1.5 min-w-0 flex-1">
            <span class="w-2 h-2 rounded-full shrink-0" style="background:${seatColor};"></span>
            ${roll.visibility === 'private' ? '<span class="text-[10px] text-amber-300 shrink-0" title="Tirada privada">🔒</span>' : ''}
            <span class="seat-roll-formula truncate">${esc(formulaTxt)}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${expandedRightHeaderHtml}
            ${closeBtn}
          </div>
        </div>
        <div class="seat-roll-details">
          ${tagTxt ? `<div class="seat-roll-outcome-tag">${esc(tagTxt)}</div>` : ''}
          ${expandedMultiChipsHtml}
          ${natDetail ? `<div class="seat-roll-nat-chip font-mono-tech">${esc(natDetail)}${modTxt}</div>` : ''}
          ${roll.message ? `<div class="text-[10px] opacity-85 italic break-words leading-snug">${esc(roll.message)}</div>` : ''}
          ${showHpActions ? `
            <div class="flex items-center gap-1 pt-1">
              <button type="button" data-seat-hp="-1" data-seat-hp-amt="${totalNum}" class="portal-btn portal-subpanel px-2 py-0.5 rounded-lg text-[9.5px] font-semibold text-rose-300">−${totalNum} HP</button>
              <button type="button" data-seat-hp="-0.5" data-seat-hp-amt="${totalNum}" class="portal-btn portal-subpanel px-2 py-0.5 rounded-lg text-[9.5px] font-semibold text-amber-300">½</button>
              <button type="button" data-seat-hp="1" data-seat-hp-amt="${totalNum}" class="portal-btn portal-subpanel px-2 py-0.5 rounded-lg text-[9.5px] font-semibold text-emerald-300">+${totalNum}</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  renderTableSeats(state) {
    const listEl = this.els.tableSeatsList;
    if (!listEl) return;

    const esc = (v) => this.escapeHtml(v || '');
    const seats = this.buildTableSeats(state);

    const nextHtml = seats
      .map((seat) => {
        const initials = esc(seat.name.slice(0, 2).toUpperCase());
        const avatarInner = seat.avatarUrl
          ? `<img src="${esc(seat.avatarUrl)}" alt="${esc(seat.name)}" class="w-full h-full object-contain pointer-events-none" />`
          : `<span class="text-[11.5px] font-extrabold tracking-tight text-white pointer-events-none select-none">${initials}</span>`;
        const roleTag = seat.role === 'gm' ? '<span class="table-seat-gm-tag">GM</span>' : '';
        const multiTag = seat.isSelf && seat.role === 'player' && seat.tokenCount > 1
          ? `<span class="table-seat-multi-tag">${seat.tokenCount}</span>`
          : '';
        const turnTag = seat.hasTurn
          ? `<span class="table-seat-turn-tag">${seat.isSelf ? 'TU TURNO' : 'TURNO'}</span>`
          : '';
        const avatarTitle = seat.isSelf
          ? (seat.role === 'gm'
              ? `${seat.name} (Narrador · clic para editar perfil)`
              : seat.tokenCount > 1
                ? `${seat.name} (Vos · clic para cambiar ficha principal)`
                : `${seat.name} (Vos · clic para centrar ficha)`)
          : `${seat.name} (${seat.online ? 'En línea' : 'Sin conexión'} · clic para chatear)`;
        const seatUnread = !seat.isSelf && Service.chatUnreadBySeat instanceof Map
          ? (Service.chatUnreadBySeat.get(seat.seatKey) || 0)
          : 0;
        const unreadTag = seatUnread > 0
          ? `<span class="table-seat-unread" title="${seatUnread} sin leer">${seatUnread > 9 ? '9+' : seatUnread}</span>`
          : '';
        const isChatActive = Boolean(
          !seat.isSelf &&
          Service.chatOpen &&
          Service.chatTarget?.channel === 'whisper' &&
          Service.chatTarget.seatKey === seat.seatKey
        );
        const bubble = Service.chatBubbles instanceof Map ? Service.chatBubbles.get(seat.seatKey) : null;
        const bubbleHtml = bubble && bubble.expiresAt > Date.now()
          ? `<div class="seat-chat-bubble">${esc(bubble.text)}</div>`
          : '';
        const rollHtml = this.renderSeatRollCardHtml(seat.seatKey, state, seat);
        const hasFloating = Boolean(bubbleHtml || rollHtml);

        return `
          <div class="table-seat ${seat.hasTurn ? 'is-turn' : ''} ${isChatActive ? 'is-chat-active' : ''} ${seat.online ? 'is-online' : 'is-offline'}" data-seat-key="${esc(seat.seatKey)}">
            <button
              type="button"
              data-seat-avatar="${esc(seat.seatKey)}"
              data-seat-self="${seat.isSelf ? '1' : '0'}"
              data-seat-role="${esc(seat.role)}"
              data-seat-client="${esc(seat.clientId)}"
              data-seat-invite="${esc(seat.inviteId || '')}"
              data-seat-name="${esc(seat.name)}"
              class="table-seat-head"
              title="${esc(avatarTitle)}"
            >
              <span class="table-seat-avatar${seat.avatarUrl ? ' has-image' : ''}" style="background:${seat.avatarUrl ? 'transparent' : esc(seat.color)};">
                ${avatarInner}
                <span class="table-seat-status ${seat.online ? 'is-online' : 'is-offline'}"></span>
                ${roleTag}
                ${multiTag}
                ${unreadTag}
                ${turnTag}
              </span>
            </button>
            ${hasFloating ? `
              <div class="table-seat-floating">
                ${bubbleHtml}
                ${rollHtml}
              </div>
            ` : ''}
          </div>
        `;
      })
      .join('');

    this.renderChatUI();

    const syncAutoHiddenCards = () => {
      listEl.querySelectorAll('[data-seat-roll-card]').forEach((card) => {
        const key = card.dataset.seatRollCard;
        const roll = Service.seatRolls instanceof Map ? Service.seatRolls.get(key) : null;
        const shouldHide = Boolean(roll?.autoHidden && Service.expandedSeatRollKey !== key);
        card.classList.toggle('is-auto-hidden', shouldHide);
      });
    };

    if (this._lastTableSeatsHtml === nextHtml && (seats.length === 0 || listEl.childElementCount > 0)) {
      syncAutoHiddenCards();
      return;
    }
    this._lastTableSeatsHtml = nextHtml;
    listEl.innerHTML = nextHtml;
    syncAutoHiddenCards();

    listEl.querySelectorAll('.table-seat[data-seat-key]').forEach((seatEl) => {
      seatEl.addEventListener('mouseleave', () => {
        const key = seatEl.dataset.seatKey;
        if (!key || Service.expandedSeatRollKey !== key) return;
        const roll = Service.seatRolls instanceof Map ? Service.seatRolls.get(key) : null;
        if (roll?.autoHidden) {
          Service.expandedSeatRollKey = '';
          Service.notify({ skipVaultSave: true });
        }
      });
    });

    listEl.querySelectorAll('[data-seat-roll-card]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-roll-dismiss]') || e.target.closest('[data-seat-hp]')) return;
        e.stopPropagation();
        const key = card.dataset.seatRollCard;
        Service.expandedSeatRollKey = Service.expandedSeatRollKey === key ? '' : key;
        Service.notify({ skipVaultSave: true });
      });
    });

    listEl.querySelectorAll('[data-roll-dismiss]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [seatKey, rollId] = btn.dataset.rollDismiss.split(':');
        const isOwner = btn.dataset.rollOwner === '1';
        Service.dismissSeatRoll(seatKey, rollId, { broadcast: isOwner });
      });
    });

    listEl.querySelectorAll('[data-seat-hp]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tokId = Service.state.selectedTokenId;
        const tok = Service.state.tokens.find((t) => t.id === tokId);
        const mult = Number(btn.dataset.seatHp);
        const base = Number(btn.dataset.seatHpAmt) || 0;
        const delta = mult < 0 ? -Math.floor(base * Math.abs(mult)) : Math.floor(base * mult);
        if (!tok || delta === 0) return;
        Service.adjustTokenHp(tok.id, delta);
        this.showActionToast(`${delta > 0 ? '+' : ''}${delta} HP a ${tok.name} (${tok.hp}/${tok.maxHp}).`);
      });
    });

    listEl.querySelectorAll('[data-seat-avatar]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const seatObj = {
          seatKey: btn.dataset.seatAvatar,
          role: btn.dataset.seatRole || 'player',
          clientId: btn.dataset.seatClient || '',
          inviteId: btn.dataset.seatInvite || '',
          name: btn.dataset.seatName || 'Jugador'
        };
        if (btn.dataset.seatSelf === '1') {
          if (seatObj.role === 'gm') {
            this.openProfilePopover();
          } else {
            this.openPlayerTokenPicker(seatObj);
          }
        } else {
          this.openChatForSeat(seatObj);
        }
      });
    });
  },

  renderCombatTracker(state) {
    this.renderTableSeats(state);

    const pop = this.els.combatTrackerPopover;
    const orderEl = this.els.combatOrderList;
    if (!pop || !orderEl) return;

    const c = state.combat;
    const isGm = state.role === 'gm';
    const trackerPublic = state.systemConfig?.combatTrackerPublic !== false;
    const canSeeTracker = isGm || trackerPublic;
    const combatActive = Boolean(c && c.active);

    if (this.els.btnToggleCombatVisibility) {
      this.els.btnToggleCombatVisibility.classList.toggle('hidden', !isGm);
      this.els.btnToggleCombatVisibility.classList.toggle('portal-btn-active', !trackerPublic);
      this.els.btnToggleCombatVisibility.title = trackerPublic
        ? 'Tracker visible para jugadores (clic para ocultar)'
        : 'Tracker oculto para jugadores (clic para mostrar)';
      this.els.btnToggleCombatVisibility.innerHTML = trackerPublic
        ? '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
        : '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    }
    const showQuickNext = isGm && combatActive;
    this.els.btnNextTurn?.classList.toggle('hidden', !showQuickNext);
    this.els.btnNextTurn?.classList.toggle('flex', showQuickNext);
    this.els.btnPrevTurn?.classList.toggle('hidden', !isGm);
    this.els.btnToggleAddCombatant?.classList.toggle('hidden', !isGm);
    this.els.btnToggleAddCombatant?.classList.toggle('portal-btn-accent', Boolean(isGm && this.combatAddOpen));
    this.els.btnEndCombat?.classList.toggle('hidden', !isGm);

    if (!canSeeTracker || !combatActive || !Array.isArray(c.order)) {
      this.combatAddOpen = false;
      pop.classList.remove('is-open');
      orderEl.innerHTML = '';
      if (this.els.combatAddList) {
        this.els.combatAddList.classList.add('hidden');
        this.els.combatAddList.classList.remove('flex');
        this.els.combatAddList.innerHTML = '';
      }
      return;
    }

    if (!isGm && c.order.length === 0) {
      pop.classList.remove('is-open');
      orderEl.innerHTML = '';
      return;
    }

    if (this.els.lblCombatRound) {
      this.els.lblCombatRound.textContent = `Ronda ${c.round || 1}`;
    }

    const tokensById = new Map((state.tokens || []).map((t) => [t.id, t]));
    const inCombatIds = new Set(
      c.order.flatMap((entry) => (Array.isArray(entry.tokenIds) && entry.tokenIds.length ? entry.tokenIds : [entry.tokenId]))
    );

    if (this.els.combatAddList) {
      const showAdd = Boolean(isGm && this.combatAddOpen);
      this.els.combatAddList.classList.toggle('hidden', !showAdd);
      this.els.combatAddList.classList.toggle('flex', showAdd);
      if (showAdd) {
        const missing = (state.tokens || []).filter((t) => t && !inCombatIds.has(t.id));
        const esc = (v) => this.escapeHtml(v || '');
        this.els.combatAddList.innerHTML = missing.length
          ? missing
              .map(
                (t) => `
                  <button type="button" data-combat-add-tok="${esc(t.id)}" class="combat-add-chip">
                    <span class="truncate">${esc(t.name)}${t.hidden ? ' · Oculta' : ''}</span>
                    <span class="text-[10px] opacity-70 shrink-0">+ Añadir</span>
                  </button>
                `
              )
              .join('')
          : '<span class="text-[10.5px] opacity-60 px-1 py-0.5">Todas las fichas del mapa ya están en combate.</span>';

        this.els.combatAddList.querySelectorAll('[data-combat-add-tok]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tokId = btn.dataset.combatAddTok;
            if (!tokId) return;
            Service.addTokenToCombat(tokId, { roll: true, silent: true });
          });
        });
      } else {
        this.els.combatAddList.innerHTML = '';
      }
    }

    const len = c.order.length;
    const rawTurnIdx = Number.isFinite(Number(c.turnIndex)) ? Math.trunc(Number(c.turnIndex)) : -1;
    const hasValidTurn = rawTurnIdx >= 0 && rawTurnIdx < len;
    const startIdx = hasValidTurn ? rawTurnIdx : 0;
    const rotatedOrder = [];
    for (let offset = 0; offset < len; offset++) {
      rotatedOrder.push({ entry: c.order[(startIdx + offset) % len], isTurn: hasValidTurn && offset === 0 });
    }

    orderEl.innerHTML = rotatedOrder.length
      ? rotatedOrder
          .map(({ entry, isTurn }) => {
            const entryIds = Array.isArray(entry.tokenIds) && entry.tokenIds.length
              ? entry.tokenIds
              : [entry.tokenId];
            const entryTokens = entryIds.map((id) => tokensById.get(id)).filter(Boolean);
            if (!entryTokens.length) return '';
            if (!isGm && entryTokens.every((t) => t.hidden)) return '';
            return this.renderCombatOrderRowHtml(
              {
                entry,
                tokens: entryTokens,
                label: entry.groupName || entryTokens[0].name,
                isGroup: Boolean(entry.isGroup && entryTokens.length > 1),
                initBadge: entry.pending ? '⏳' : String(entry.label || entry.init),
                pending: Boolean(entry.pending),
                isTurn
              },
              state
            );
          })
          .join('')
      : '<span class="text-[11px] opacity-60 px-1 py-1 text-center">Sin fichas en combate. Usa + para añadir.</span>';

    orderEl.querySelectorAll('[data-combat-init-entry]').forEach((inp) => {
      inp.addEventListener('click', (e) => {
        e.stopPropagation();
        inp.select?.();
      });
      const commitInit = () => {
        const raw = inp.value.trim();
        if (raw === '') return;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        Service.updateEntryInitiative(inp.dataset.combatInitEntry, parsed);
      };
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commitInit();
          inp.blur?.();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          inp.blur?.();
        }
      });
      inp.addEventListener('change', () => commitInit());
    });

    orderEl.querySelectorAll('[data-combat-act]').forEach((actBtn) => {
      actBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = actBtn.dataset.combatAct;
        const entryId = actBtn.dataset.combatEntry;
        if (!entryId) return;
        if (act === 'jump') Service.setCombatTurn(entryId);
        else if (act === 'up') Service.reorderCombatEntry(entryId, -1);
        else if (act === 'down') Service.reorderCombatEntry(entryId, 1);
        else if (act === 'remove') Service.removeCombatEntry(entryId);
      });
    });

    orderEl.querySelectorAll('[data-combat-tok]').forEach((row) => {
      const hoverIds = (row.dataset.combatIds || '').split(',').filter(Boolean);
      row.addEventListener('mouseenter', () => this.setBoardTokensCombatHover(hoverIds, true));
      row.addEventListener('mouseleave', () => this.setBoardTokensCombatHover(hoverIds, false));
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-combat-act]') || e.target.closest('[data-combat-init-entry]')) return;
        const tok = tokensById.get(row.dataset.combatTok);
        if (!tok) return;
        const entry = c.order.find((o) => o.tokenId === tok.id || (Array.isArray(o.tokenIds) && o.tokenIds.includes(tok.id)));
        const canControl = Service.canControlToken(tok);
        const pendingInit = entry?.pending && canControl
          ? (Service.state.pendingRollRequests || []).find((q) => q.isInitiative && (q.tokenId === tok.id || q.tokenId === entry.tokenId))
          : null;
        if (pendingInit) {
          Service.respondToRollRequest(pendingInit.requestId, pendingInit.tokenId);
        } else if (entry?.pending && canControl) {
          Service.rollTokenInitiative(tok);
        } else {
          Service.focusToken(tok.id);
          if (canControl) Service.selectToken(tok.id, true);
        }
      });
    });
  }
};
