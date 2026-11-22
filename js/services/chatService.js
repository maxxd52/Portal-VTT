/* ==========================================================================
   CHAT SERVICE: MENSAJES DE MESA, SUSURROS POR AVATAR Y BURBUJAS EFÍMERAS
   ========================================================================== */

import { RealtimeBridge } from './realtimeBridge.js?v=20261121a6';

export const ChatServiceMethods = {
  getSelfSeatKey() {
    return this.state.role === 'gm' ? 'gm' : (this.state.activeInviteId || `peer:${this.clientId}`);
  },

  resolveMessageSeatKey(msg) {
    if (!msg) return '';
    if (msg.senderRole === 'gm') return 'gm';
    if (msg.senderInviteId) return msg.senderInviteId;
    if (msg.senderSeatKey) return msg.senderSeatKey;
    return msg.senderClientId ? `peer:${msg.senderClientId}` : '';
  },

  getConversationSeatKey(msg) {
    if (!msg || msg.channel !== 'whisper') return 'table';
    const senderSeat = this.resolveMessageSeatKey(msg);
    const selfSeat = this.getSelfSeatKey();
    const isFromMe = msg.senderClientId === this.clientId || (Boolean(senderSeat) && senderSeat === selfSeat);
    if (isFromMe) {
      return msg.targetSeatKey || msg.targetInviteId || (msg.targetClientId ? `peer:${msg.targetClientId}` : '');
    }
    return senderSeat;
  },

  getVisibleChatMessages(target = null) {
    const msgs = Array.isArray(this.chatMessages) ? this.chatMessages : [];
    const tgt = target || this.chatTarget || { channel: 'table' };
    if (tgt.channel === 'whisper' && tgt.seatKey) {
      return msgs.filter((m) => m.channel === 'whisper' && this.getConversationSeatKey(m) === tgt.seatKey);
    }
    return msgs.filter((m) => m.channel !== 'whisper');
  },

  isWhisperForMe(msg) {
    if (!msg || msg.channel !== 'whisper') return true;
    if (msg.senderClientId === this.clientId) return true;
    const selfSeat = this.getSelfSeatKey();
    if (selfSeat && (msg.senderSeatKey === selfSeat || msg.targetSeatKey === selfSeat)) return true;
    if (msg.targetClientId && msg.targetClientId === this.clientId) return true;
    if (msg.targetSeatKey === 'gm' && this.state.role === 'gm') return true;
    if (
      msg.targetInviteId &&
      this.state.role === 'player' &&
      this.state.activeInviteId === msg.targetInviteId
    ) {
      return true;
    }
    return false;
  },

  sendChatMessage(rawText, target = null) {
    const text = String(rawText || '').trim();
    if (!text) return null;
    const prof = this.getActiveSpeakerInfo();
    const tgt = target || this.chatTarget || { channel: 'table' };
    const isWhisper = tgt.channel === 'whisper' && (tgt.seatKey || tgt.clientId);
    const msg = {
      id: `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      senderClientId: this.clientId,
      senderRole: this.state.role || 'gm',
      senderInviteId: this.state.activeInviteId || '',
      senderSeatKey: this.getSelfSeatKey(),
      senderName: prof.name,
      senderColor: prof.color,
      channel: isWhisper ? 'whisper' : 'table',
      targetSeatKey: isWhisper ? (tgt.seatKey || '') : '',
      targetClientId: isWhisper ? (tgt.clientId || '') : '',
      targetInviteId: isWhisper ? (tgt.inviteId || '') : '',
      targetName: isWhisper ? (tgt.name || 'Jugador') : 'Mesa',
      text: text.slice(0, 500),
      ts: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.receiveChatMessage(msg, { isLocal: true });
    RealtimeBridge.send({ kind: 'CHAT_MESSAGE', message: msg });
    return msg;
  },

  receiveChatMessage(msg, opts = {}) {
    if (!msg || !msg.id || !msg.text) return;
    if (!this.isWhisperForMe(msg)) return;
    if (!Array.isArray(this.chatMessages)) this.chatMessages = [];
    if (this.chatMessages.some((m) => m.id === msg.id)) return;

    this.chatMessages = [...this.chatMessages, msg].slice(-150);
    const seatKey = this.resolveMessageSeatKey(msg);
    if (seatKey && msg.channel !== 'whisper') {
      if (!(this.chatBubbles instanceof Map)) this.chatBubbles = new Map();
      const expiresAt = Date.now() + 5500;
      this.chatBubbles.set(seatKey, { ...msg, expiresAt });
      setTimeout(() => {
        const current = this.chatBubbles.get(seatKey);
        if (current && current.id === msg.id && Date.now() >= current.expiresAt - 50) {
          this.chatBubbles.delete(seatKey);
          this.notify({ skipVaultSave: true });
        }
      }, 5600);
    }

    if (!opts.isLocal) {
      const threadKey = this.getConversationSeatKey(msg);
      const activeKey = this.chatTarget?.channel === 'whisper' ? (this.chatTarget.seatKey || '') : 'table';
      if (!(this.chatOpen && activeKey === threadKey)) {
        if (threadKey === 'table') {
          this.chatUnreadTable = (Number(this.chatUnreadTable) || 0) + 1;
          this.chatUnreadCount = this.chatUnreadTable;
        } else if (threadKey) {
          if (!(this.chatUnreadBySeat instanceof Map)) this.chatUnreadBySeat = new Map();
          this.chatUnreadBySeat.set(threadKey, (this.chatUnreadBySeat.get(threadKey) || 0) + 1);
        }
      }
    }
    this.notify({ skipVaultSave: true });
  },

  markChatRead(threadKey = null) {
    const key = threadKey || (this.chatTarget?.channel === 'whisper' ? (this.chatTarget.seatKey || '') : 'table');
    if (key === 'table') {
      this.chatUnreadTable = 0;
      this.chatUnreadCount = 0;
    } else if (key && this.chatUnreadBySeat instanceof Map) {
      this.chatUnreadBySeat.delete(key);
    }
    this.notify({ skipVaultSave: true });
  }
};
