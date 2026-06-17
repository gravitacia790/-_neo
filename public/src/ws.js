import { API } from './api.js';
export var WS = (function () {
  var ws = null;
  var reconnectTimer = null;
  var connecting = false;
  var MAX_RECONNECT_DELAY = 30000;

  function connect() {
    if (!API.getUser() || ws || connecting) return;
    connecting = true;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = proto + '//' + location.host + '/ws';

    var socket = new WebSocket(url);
    socket.onopen = function () {
      connecting = false;
      console.log('[ws] connected');
    };
    socket.onmessage = function (e) {
      try {
        handleMessage(JSON.parse(e.data));
      } catch (err) { console.error('[ws] parse error', err); }
    };
    socket.onclose = function () {
      if (ws === socket) { ws = null; }
      connecting = false;
      scheduleReconnect();
    };
    socket.onerror = function () { socket.close(); };
    ws = socket;
  }

  function disconnect() {
    connecting = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    var delay = 5000 + Math.random() * 5000;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connect();
    }, Math.min(delay, MAX_RECONNECT_DELAY));
  }

  function handleMessage(data) {
    if (data.type === 'connected') return;
    if (typeof WS.onNotification === 'function') {
      WS.onNotification(data);
    }
  }

  return {
    connect: connect,
    disconnect: disconnect
  };
})();
