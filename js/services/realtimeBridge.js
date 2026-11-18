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
  clientConn: null,
  pendingQueue: [],
  reconnectTimer: null,
  _connectSeq: 0,

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
        if (ev.data && this.onMessageCb) this.onMessageCb(ev.data);
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
            if (this.onMessageCb) this.onMessageCb(data);
            this.hostConns.forEach((other) => {
              if (other !== conn && other.open) {
                try { other.send(data); } catch (_) {}
              }
            });
          });
          conn.on('close', () => this.hostConns.delete(conn));
          conn.on('error', () => this.hostConns.delete(conn));
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
            if (data && seq === this._connectSeq && this.onMessageCb) {
              this.onMessageCb(data);
            }
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
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (_) {}
    }
    if (this.hostConns.size > 0) {
      this.hostConns.forEach((conn) => {
        if (conn.open) {
          try { conn.send(payload); } catch (_) {}
        }
      });
    }
    if (this.clientConn) {
      if (this.clientConn.open) {
        try {
          this.clientConn.send(payload);
        } catch (_) {}
      } else {
        if (this.pendingQueue.length > 25) this.pendingQueue.shift();
        this.pendingQueue.push(payload);
      }
    }
  }
};
