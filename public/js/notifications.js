/* global SHELLDOM, OVERLAY, getUiErrorMessage */
var NOTIF = (function () {
  var UNREAD_KEY = 'unreadCount';
  var dropdownVisible = false;
  var initialized = false;

  function getUnread() {
    var parsed = parseInt(localStorage.getItem(UNREAD_KEY) || '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  function setUnread(n) {
    var normalized = Number.isFinite(Number(n)) ? Number(n) : 0;
    if (normalized < 0) normalized = 0;
    localStorage.setItem(UNREAD_KEY, String(normalized));
    updateBadge();
  }

  function updateBadge() {
    var count = getUnread();
    SHELLDOM.syncBadge(SHELLDOM.byId('notifBadge'), count);
  }

  function toggleDropdown() {
    dropdownVisible = !dropdownVisible;
    var dd = SHELLDOM.byId('notifDropdown');
    var bell = SHELLDOM.byId('notifBell');
    if (!dd) return;
    OVERLAY.toggle(bell, dd, dropdownVisible);
    if (dropdownVisible) loadList();
  }

  function closeDropdown() {
    dropdownVisible = false;
    OVERLAY.toggle(SHELLDOM.byId('notifBell'), SHELLDOM.byId('notifDropdown'), false);
  }

  function loadList() {
    var list = document.getElementById('notifList');
    if (!list) return;
    list.innerHTML = '<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';
    API.getNotifications().then(function (resp) {
      setUnread(resp.unread);
      if (!resp.items.length) {
        list.innerHTML = '<div class="dropdown-empty-state">Нет уведомлений</div>';
        return;
      }
      var html = resp.items.map(function (n) {
        return '<div class="notif-item' + (n.read ? '' : ' notif-unread') + '" data-id="' + n.id + '">' +
          '<div class="notif-title">' + escapeHtml(n.title) + '</div>' +
          '<div class="notif-msg">' + escapeHtml(n.message) + '</div>' +
          '<div class="notif-time">' + escapeHtml(n.created_at) + '</div>' +
          '</div>';
      }).join('');
      list.innerHTML = html;
      list.querySelectorAll('.notif-item.notif-unread').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = parseInt(el.getAttribute('data-id'), 10);
          API.markNotificationRead([id]).then(function () {
            el.classList.remove('notif-unread');
            setUnread(Math.max(0, getUnread() - 1));
          });
        });
      });
    }).catch(function (err) {
      list.innerHTML = '<div class="dropdown-empty-state">' + escapeHtml(getUiErrorMessage(err, 'Не удалось загрузить уведомления.')) + '</div>';
    });
  }

  function onNewNotification(data) {
    if (data && data.type === 'message_new') {
      // Message events are handled by message badge flow, not notification bell.
      return;
    }
    setUnread(getUnread() + 1);
    var title = data.title || '';
    var msg = data.message || '';
    notify(title + (msg ? ': ' + msg : ''));
    if (data.type === 'event_created') {
      var eventsTab = document.querySelector('[data-tab="events"]');
      if (eventsTab && eventsTab.classList.contains('active')) renderEvents();
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    updateBadge();
    var bell = SHELLDOM.byId('notifBell');
    if (bell) bell.addEventListener('click', toggleDropdown);
    API.getNotifications()
      .then(function (resp) {
        setUnread(resp && typeof resp.unread === 'number' ? resp.unread : 0);
      })
      .catch(function () {
        setUnread(0);
      });
    OVERLAY.closeOnOutside(SHELLDOM.byId('notifDropdown'), bell, function () { return dropdownVisible; }, closeDropdown);
    OVERLAY.closeOnEscape(closeDropdown);
    WS.onNotification = onNewNotification;

    var markAllBtn = document.getElementById('notifMarkAllRead');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        API.markAllNotificationsRead().then(function () {
          setUnread(0);
          document.querySelectorAll('.notif-item.notif-unread').forEach(function (el) { el.classList.remove('notif-unread'); });
        }).catch(function () {});
      });
    }
  }

  return { init: init, updateBadge: updateBadge, loadList: loadList, closeDropdown: closeDropdown };
})();
