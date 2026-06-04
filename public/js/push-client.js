(function () {
  var PUSH = {
    initialized: false,
  };

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function ensurePermission() {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
  }

  async function initPush() {
    if (PUSH.initialized) return;
    PUSH.initialized = true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    var permission = await ensurePermission();
    if (permission !== 'granted') return;

    if (!API.isAuthed || !API.isAuthed()) return;

    var cfg;
    try {
      cfg = await API.getPushConfig();
    } catch (_) {
      return;
    }
    if (!cfg || !cfg.enabled || !cfg.vapidPublicKey) return;

    var reg = await navigator.serviceWorker.register('/sw.js');
    var existing = await reg.pushManager.getSubscription();
    if (existing) {
      await API.subscribePush(existing.toJSON ? existing.toJSON() : existing);
      return;
    }

    var subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey),
    });
    await API.subscribePush(subscription.toJSON ? subscription.toJSON() : subscription);
  }

  window.initPushClient = function () {
    initPush().catch(function () {});
  };
})();
