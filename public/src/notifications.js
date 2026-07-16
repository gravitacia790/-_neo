import { OVERLAY } from './overlay.js';
import { SHELLDOM } from './shell-dom.js';
import { getUiErrorMessage } from './utils.js';
import { API } from './api.js';
import { renderEvents } from './events.js';
import { renderDirectors } from './directors.js';
import { notify } from './utils.js';
import { html as h } from './html.js';
import { WS } from './ws.js';
export var NOTIF = (function () {
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

  function renderNotificationItem(n) {
    var actions = '';
    if (n.type === 'phone_visibility_request' && n.entity_id) {
      actions = h`<div class="notif-actions"><button type="button" data-notification-action="approved" data-request-id="${n.entity_id}">Разрешить</button><button type="button" data-notification-action="rejected" data-request-id="${n.entity_id}">Отклонить</button></div>`;
    }
    return h`<div class="notif-item${n.read ? '' : ' notif-unread'}" data-id="${n.id}"><div class="notif-title">${n.title}</div><div class="notif-msg">${n.message}</div>${actions}<div class="notif-time">${n.created_at}</div></div>`;
  }

  function markItemRead(item) {
    if (!item || !item.classList.contains('notif-unread')) return Promise.resolve();
    var id = parseInt(item.getAttribute('data-id'), 10);
    return API.markNotificationRead([id]).then(function () {
      item.classList.remove('notif-unread');
      setUnread(Math.max(0, getUnread() - 1));
    });
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
      var html = resp.items.map(renderNotificationItem).join('');
      list.innerHTML = html;
      list.querySelectorAll('[data-notification-action]').forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.stopPropagation();
          var item = button.closest('.notif-item');
          var requestId = parseInt(button.getAttribute('data-request-id'), 10);
          var decision = button.getAttribute('data-notification-action');
          list.querySelectorAll('[data-notification-action][data-request-id="' + requestId + '"]').forEach(function (action) {
            action.disabled = true;
          });
          API.respondPhoneNumberRequest(requestId, decision)
            .then(function (result) {
              var actions = item ? item.querySelector('.notif-actions') : null;
              if (actions) actions.textContent = result.status === 'approved' ? 'Номер разрешён' : 'Запрос отклонён';
              return markItemRead(item);
            })
            .catch(function (err) {
              list.querySelectorAll('[data-notification-action][data-request-id="' + requestId + '"]').forEach(function (action) {
                action.disabled = false;
              });
              notify(err.message || 'Не удалось обработать запрос');
            });
        });
      });
      list.querySelectorAll('.notif-item.notif-unread').forEach(function (el) {
        el.addEventListener('click', function () {
          markItemRead(el).catch(function () {});
        });
      });
    }).catch(function (err) {
      list.innerHTML = h`<div class="dropdown-empty-state">${getUiErrorMessage(err, 'Не удалось загрузить уведомления.')}</div>`;
    });
  }

  function onNewNotification(data) {
    setUnread(getUnread() + 1);
    var title = data.title || '';
    var msg = data.message || '';
    notify(title + (msg ? ': ' + msg : ''));
    if (data.type === 'event_created' || data.type === 'event_registered' || data.type === 'event_deleted') {
      var eventsPanel = document.getElementById('events');
      if (eventsPanel && eventsPanel.classList.contains('active')) {
        renderEvents();
      }
    }
    if (data.type === 'phone_visibility_response') {
      var directorsPanel = document.getElementById('directors');
      if (directorsPanel && directorsPanel.classList.contains('active')) renderDirectors(false);
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
