/* global SHELLDOM, OVERLAY, getUiErrorMessage */
(function () {
  function updateMessageBadge(count) {
    SHELLDOM.syncBadge(SHELLDOM.byId('msgBadge'), count);
  }

  function refreshUnreadMessages() {
    API.getUnreadMessages().then(function (resp) {
      updateMessageBadge(resp.unread || 0);
    }).catch(function () {});
  }

  function renderMessagesList(list, messages) {
    if (!messages.length) {
      list.innerHTML = '<div class="dropdown-empty-state">Нет сообщений</div>';
      return;
    }
    var html = '';
    messages.forEach(function (m) {
      var currentUser = API.getUser();
      var otherName = m.from_user_id === (currentUser && currentUser.id) ? m.to_name : m.from_name;
      var otherId = m.from_user_id === (currentUser && currentUser.id) ? m.to_user_id : m.from_user_id;
      html += '<div class="msg-item' + (m.read ? '' : ' msg-item-unread') + '">' +
        '<div class="msg-from">' + escapeHtml(otherName) + '</div>' +
        '<div class="msg-text">' + escapeHtml(m.text) + '</div>' +
        '<div class="msg-time">' + escapeHtml(m.created_at) + '</div>' +
        '<div style="margin-top:8px;display:flex;justify-content:flex-end;">' +
        '<button class="notif-header-action" data-action="reply" data-user-id="' + escapeAttr(otherId) + '" data-user-name="' + escapeAttr(otherName) + '">Ответить</button>' +
        '</div>' +
        '</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('[data-action="reply"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var uid = parseInt(btn.getAttribute('data-user-id'), 10);
        var uname = btn.getAttribute('data-user-name') || 'Пользователь';
        if (!uid) return;
        closeMsgDropdown();
        showMessageModal(uid, uname);
      });
    });
  }

  function closeMsgDropdown() {
    OVERLAY.toggle(SHELLDOM.byId('msgBtn'), SHELLDOM.byId('msgDropdown'), false);
  }

  function openMsgDropdown() {
    var dd = SHELLDOM.byId('msgDropdown');
    var list = SHELLDOM.byId('msgList');
    var btn = SHELLDOM.byId('msgBtn');
    if (!dd) return;
    if (!dd.hidden) {
      closeMsgDropdown();
      return;
    }
    OVERLAY.toggle(btn, dd, true);
    if (!list) return;
    list.innerHTML = '<div class="dropdown-loading-state">Загрузка...</div>';
    API.getMessages().then(function (resp) {
      API.markAllMessagesRead().then(function () { updateMessageBadge(0); }).catch(function () {});
      renderMessagesList(list, resp.messages || []);
    }).catch(function (err) {
      list.innerHTML = '<div class="dropdown-empty-state">' + escapeHtml(getUiErrorMessage(err, 'Не удалось загрузить сообщения.')) + '</div>';
    });
  }

  function showMessageModal(toUserId, toUserName) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-content message-modal">' +
      '<button class="close-modal">✕</button>' +
      '<h2 class="message-modal__title">Сообщение</h2>' +
      '<p class="message-modal__subtitle">Для: <strong>' + escapeHtml(toUserName) + '</strong></p>' +
      '<textarea id="msgText" rows="4" class="message-modal__textarea" placeholder="Напишите сообщение..."></textarea>' +
      '<p id="msgError" class="message-modal__error" hidden></p>' +
      '<button id="msgSendBtn" class="save-btn message-modal__submit">Отправить</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var textarea = overlay.querySelector('#msgText');
    var sendBtn = overlay.querySelector('#msgSendBtn');
    var errorEl = overlay.querySelector('#msgError');

    function closeModal() {
      overlay.remove();
    }

    overlay.querySelector('.close-modal').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    sendBtn.addEventListener('click', function () {
      var text = textarea.value.trim();
      if (!text) {
        errorEl.textContent = 'Введите текст сообщения';
        errorEl.hidden = false;
        return;
      }

      errorEl.hidden = true;
      sendBtn.disabled = true;
      sendBtn.textContent = 'Отправка...';

      API.sendMessage(toUserId, text)
        .then(function () {
          notify('Сообщение отправлено');
          refreshUnreadMessages();
          closeModal();
        })
        .catch(function (err) {
          errorEl.textContent = err.message || 'Ошибка отправки';
          errorEl.hidden = false;
          sendBtn.disabled = false;
          sendBtn.textContent = 'Отправить';
        });
    });

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendBtn.click();
    });
  }

  OVERLAY.closeOnOutside(SHELLDOM.byId('msgDropdown'), SHELLDOM.byId('msgBtn'), function () {
    var dd = SHELLDOM.byId('msgDropdown');
    return !!(dd && !dd.hidden);
  }, closeMsgDropdown);

  window.openMsgDropdown = openMsgDropdown;
  window.showMessageModal = showMessageModal;
  window.refreshUnreadMessages = refreshUnreadMessages;

  refreshUnreadMessages();
})();
