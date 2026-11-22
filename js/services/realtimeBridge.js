/* ==========================================================================
   P2P / BROADCAST + WEBRTC SYNC BRIDGE (LOCAL Y ONLINE ENTRE NAVEGADORES)
   ========================================================================== */

export const RealtimeBridge = {
  channel: null,
  roomCode: '',
  onMessageCb: null,
  getRoleFn: () => 'gm',
  peer: null,
  hostConns: new Set(),
  seatConns: new Map(),
  clientConn: null,
  pendingQueue: [],
  reconnectTimer: null,
  _connectSeq: 0,
  _seenMsgIds: new Set(),

  registerPeerMeta(conn, meta = {}) {
    if (!conn) return;
    if (!(this.seatConns instanceof Map)) this.seatConns = new Map();
    const prev = this.seatConns.get(conn) || {};
    const inviteId = meta.inviteId !== undefined ? String(meta.inviteId || '') : (prev.inviteId || '');
    const clientId = meta.clientId !== undefined ? String(meta.clientId || '') : (prev.clientId || '');
    const role = meta.role !== undefined ? String(meta.role || 'player') : (prev.role || 'player');
    const explicitSeat = meta.seatKey !== undefined ? String(meta.seatKey || '') : '';
    const seatKey = explicitSeat || inviteId || (clientId ? `peer:${clientId}` : prev.seatKey || '');
    this.seatConns.set(conn, { seatKey, inviteId, clientId, role });
  },

  _checkAndMarkMsgId(msgId) {
    if (!msgId) return false;
    if (!(this._seenMsgIds instanceof Set)) this._seenMsgIds = new Set();
    if (this._seenMsgIds.has(msgId)) return true;
    this._seenMsgIds.add(msgId);
    if (this._seenMsgIds.size > 240) {
      const oldest = this._seenMsgIds.values().next().value;
      if (oldest) this._seenMsgIds.delete(oldest);
    }
    return false;
  },

  getHostPeerId(roomCode) {
    const clean = String(roomCode || 'MESA01').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `portal-vtt-${clean || 'mesa01'}-gm`;
  },

  disconnect() {
    this._connectSeq += 1;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.channel) {
      try {
        this.channel.close();
      } catch (_) {}
      this.channel = null;
    }
    this.hostConns.forEach((c) => {
      try { c.close(); } catch (_) {}
    });
    this.hostConns.clear();
    if (this.seatConns instanceof Map) this.seatConns.clear();
    if (this.clientConn) {
      try { this.clientConn.close(); } catch (_) {}
      this.clientConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
    this.pendingQueue = [];
  },

  connect(roomCode, onMessage, getRoleFn = () => 'gm') {
    this.disconnect();
    const seq = this._connectSeq;
    this.roomCode = roomCode;
    this.onMessageCb = onMessage;
    this.getRoleFn = typeof getRoleFn === 'function' ? getRoleFn : () => 'gm';

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`portal_${roomCode}`);
      this.channel.onmessage = (ev) => {
        const data = ev.data;
        if (!data || !this.onMessageCb) return;
        if (data._msgId && this._checkAndMarkMsgId(data._msgId)) return;
        this.onMessageCb(data);
      };
    }

    if (typeof window !== 'undefined' && typeof window.Peer === 'function') {
      this.initPeerTransport(roomCode, seq);
    }
  },

  initPeerTransport(roomCode, seq, forceClient = false, retryCount = 0) {
    if (seq !== this._connectSeq) return;
    const role = this.getRoleFn();
    const isHostRole = role === 'gm' && !forceClient;
    const hostPeerId = this.getHostPeerId(roomCode);

    try {
      const peer = isHostRole ? new window.Peer(hostPeerId) : new window.Peer();
      this.peer = peer;

      if (isHostRole) {
        peer.on('connection', (conn) => {
          this.hostConns.add(conn);
          conn.on('data', (data) => {
            if (!data || seq !== this._connectSeq) return;
            if (data._msgId && this._checkAndMarkMsgId(data._msgId)) return;
            if (typeof data === 'object' && (data.seatKey || data.inviteId || data.clientId || data.role)) {
              this.registerPeerMeta(conn, {
                seatKey: data.seatKey,
                inviteId: data.inviteId,
                clientId: data.clientId,
                role: data.role
              });
            }
            if (this.onMessageCb) this.onMessageCb(data);
            if (data.hostOnly || data.targetSeatKey) return;
            if (data.kind === 'CHAT_MESSAGE' && data.message?.channel === 'whisper') {
              const wTarget =
                data.message.targetSeatKey ||
                data.message.targetInviteId ||
                (data.message.targetClientId ? `peer:${data.message.targetClientId}` : '');
              if (wTarget === 'gm') return;
              this.hostConns.forEach((other) => {
                if (other === conn || !other.open) return;
                const meta = this.seatConns instanceof Map ? this.seatConns.get(other) : null;
                if (!wTarget || (meta && (meta.seatKey === wTarget || meta.inviteId === wTarget))) {
                  try { other.send(data); } catch (_) {}
                }
              });
              return;
            }
            this.hostConns.forEach((other) => {
              if (other !== conn && other.open) {
                try { other.send(data); } catch (_) {}
              }
            });
          });
          conn.on('close', () => {
            this.hostConns.delete(conn);
            if (this.seatConns instanceof Map) this.seatConns.delete(conn);
          });
          conn.on('error', () => {
            this.hostConns.delete(conn);
            if (this.seatConns instanceof Map) this.seatConns.delete(conn);
          });
        });

        peer.on('error', (err) => {
          if (seq !== this._connectSeq) return;
          if (err && err.type === 'unavailable-id') {
            try { peer.destroy(); } catch (_) {}
            this.peer = null;
            if (retryCount < 2) {
              this.reconnectTimer = setTimeout(() => this.initPeerTransport(roomCode, seq, false, retryCount + 1), 1500);
            } else {
              this.initPeerTransport(roomCode, seq, true, 0);
            }
          }
        });
      } else {
        const dialHost = () => {
          if (seq !== this._connectSeq || !this.peer || this.peer.destroyed) return;
          const conn = peer.connect(hostPeerId, { reliable: true });
          this.clientConn = conn;
          conn.on('open', () => {
            if (seq !== this._connectSeq) return;
            try {
              conn.send({ kind: 'SYNC_REQUEST', role: 'player' });
            } catch (_) {}
            while (this.pendingQueue.length > 0) {
              const item = this.pendingQueue.shift();
              try { conn.send(item); } catch (_) {}
            }
          });
          conn.on('data', (data) => {
            if (!data || seq !== this._connectSeq || !this.onMessageCb) return;
            if (data._msgId && this._checkAndMarkMsgId(data._msgId)) return;
            this.onMessageCb(data);
          });
          const scheduleRetry = () => {
            if (seq !== this._connectSeq) return;
            if (this.clientConn === conn) this.clientConn = null;
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(dialHost, 2500);
          };
          conn.on('close', scheduleRetry);
          conn.on('error', scheduleRetry);
        };

        peer.on('open', dialHost);
        peer.on('error', () => {
          if (seq !== this._connectSeq) return;
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(dialHost, 2500);
        });
      }
    } catch (_) {}
  },

  send(payload) {
    if (!payload) return;
    let wirePayload = payload;
    if (typeof payload === 'object') {
      const msgId = payload._msgId || `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      this._checkAndMarkMsgId(msgId);
      wirePayload = payload._msgId ? payload : { ...payload, _msgId: msgId };
    }
    if (this.channel) {
      try {
        this.channel.postMessage(wirePayload);
      } catch (_) {}
    }
    const targetSeat = typeof wirePayload === 'object' ? String(wirePayload.targetSeatKey || '') : '';
    const hostOnly = typeof wirePayload === 'object' ? Boolean(wirePayload.hostOnly) : false;
    const spectatorOnly = typeof wirePayload === 'object' ? Boolean(wirePayload.spectatorOnly) : false;
    if (this.hostConns.size > 0 && !hostOnly) {
      this.hostConns.forEach((conn) => {
        if (!conn.open) return;
        const meta = this.seatConns instanceof Map ? this.seatConns.get(conn) : null;
        if (targetSeat) {
          if (!meta || (meta.seatKey !== targetSeat && meta.inviteId !== targetSeat)) return;
        } else if (spectatorOnly && meta && meta.seatKey) {
          return;
        }
        try { conn.send(wirePayload); } catch (_) {}
      });
    }
    if (this.clientConn) {
      if (this.clientConn.open) {
        try {
          this.clientConn.send(wirePayload);
        } catch (_) {}
      } else {
        if (this.pendingQueue.length > 25) this.pendingQueue.shift();
        this.pendingQueue.push(wirePayload);
      }
    }
  },

  sendToSeat(seatKey, payload) {
    if (!seatKey || !payload || typeof payload !== 'object') return;
    this.send({ ...payload, targetSeatKey: seatKey });
  },

  sendToHost(payload) {
    if (!payload || typeof payload !== 'object') return;
    this.send({ ...payload, hostOnly: true });
  }
};
