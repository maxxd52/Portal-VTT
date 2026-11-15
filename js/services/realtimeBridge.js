/* ==========================================================================
   P2P / BROADCAST SYNC BRIDGE (TIEMPO REAL ENTRE PESTAÑAS)
   ========================================================================== */

export const RealtimeBridge = {
  channel: null,
  roomCode: '',

  connect(roomCode, onMessage) {
    if (this.channel) {
      try {
        this.channel.close();
      } catch (_) {}
    }
    this.roomCode = roomCode;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`owltable_${roomCode}`);
      this.channel.onmessage = (ev) => {
        if (ev.data) onMessage(ev.data);
      };
    }
  },

  send(payload) {
    if (!this.channel) return;
    try {
      this.channel.postMessage(payload);
    } catch (_) {}
  }
};
