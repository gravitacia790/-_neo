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
    var currentUser = API.getUser();
    var currentUserId = currentUser && currentUser.id;
    if (!messages.length || !currentUserId) {
      list.innerHTML = '<div class="dropdown-empty-state">Нет сообщений</div>';
      return;
    }
    var dialogsByUser = {};
    messages.forEach(function (m) {
      var isOutgoing = m.from_user_id === currentUserId;
      var otherId = isOutgoing ? m.to_user_id : m.from_user_id;
      var otherName = isOutgoing ? m.to_name : m.from_name;
      if (!dialogsByUser[otherId]) {
        dialogsByUser[otherId] = {
          userId: otherId,
          userName: otherName,
          preview: m.text,
          createdAt: m.created_at,
          unread: 0,
        };
      }
      if (!isOutgoing && !m.read) dialogsByUser[otherId].unread += 1;
    });

    var dialogs = Object.keys(dialogsByUser)
      .map(function (k) { return dialogsByUser[k]; })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });

    if (!dialogs.length) {
      list.innerHTML = '<div class="dropdown-empty-state">Нет сообщений</div>';
      return;
    }

    list.innerHTML = dialogs
      .map(function (d) {
        var unreadBadge = d.unread > 0 ? '<span class="msg-badge" style="position:static;margin-left:8px;">' + d.unread + '</span>' : '';
        return (
          '<button class="msg-item" data-action="open-dialog" data-user-id="' + escapeAttr(d.userId) + '" data-user-name="' + escapeAttr(d.userName) + '" ' +
          'style="width:100%;text-align:left;background:transparent;border:none;cursor:pointer;">' +
          '<div class="msg-from" style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span>' + escapeHtml(d.userName) + '</span>' +
          unreadBadge +
          '</div>' +
          '<div class="msg-text">' + escapeHtml(d.preview || '') + '</div>' +
          '<div class="msg-time">' + escapeHtml(d.createdAt || '') + '</div>' +
          '</button>'
        );
      })
      .join('');

    list.querySelectorAll('[data-action="open-dialog"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
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
      '<h2 class="message-modal__title">Чат</h2>' +
      '<p class="message-modal__subtitle">Для: <strong>' + escapeHtml(toUserName) + '</strong></p>' +
      '<div id="msgThread" style="max-height:40vh;overflow-y:auto;padding:8px 2px 10px;"></div>' +
      '<textarea id="msgText" rows="4" class="message-modal__textarea" placeholder="Напишите сообщение..."></textarea>' +
      '<p id="msgError" class="message-modal__error" hidden></p>' +
      '<button id="msgSendBtn" class="save-btn message-modal__submit">Отправить</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var threadEl = overlay.querySelector('#msgThread');
    var textarea = overlay.querySelector('#msgText');
    var sendBtn = overlay.querySelector('#msgSendBtn');
    var errorEl = overlay.querySelector('#msgError');
    var refreshTimer = null;

    function closeModal() {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      overlay.remove();
    }

    function renderThread(messages) {
      var me = API.getUser();
      var myId = me && me.id;
      if (!messages.length) {
        threadEl.innerHTML = '<div class="dropdown-empty-state">Начните диалог первым</div>';
        return;
      }
      threadEl.innerHTML = messages
        .map(function (m) {
          var isMine = m.from_user_id === myId;
          return (
            '<div style="display:flex;justify-content:' + (isMine ? 'flex-end' : 'flex-start') + ';margin-bottom:8px;">' +
            '<div style="max-width:82%;padding:8px 10px;border-radius:12px;background:' + (isMine ? 'var(--crimson)' : 'rgba(255,255,255,0.08)') + ';color:' + (isMine ? '#fff' : 'var(--cream)') + ';">' +
            '<div style="font-size:0.8rem;line-height:1.35;">' + escapeHtml(m.text || '') + '</div>' +
            '<div style="font-size:0.62rem;opacity:0.75;margin-top:4px;text-align:right;">' + escapeHtml(m.created_at || '') + '</div>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');
      threadEl.scrollTop = threadEl.scrollHeight;
    }

    function loadThread() {
      API.getMessages()
        .then(function (resp) {
          var all = resp.messages || [];
          var me = API.getUser();
          var myId = me && me.id;
          var thread = all
            .filter(function (m) {
              return (
                (m.from_user_id === myId && m.to_user_id === toUserId) ||
                (m.from_user_id === toUserId && m.to_user_id === myId)
              );
            })
            .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
          renderThread(thread);
          API.markAllMessagesRead().catch(function () {});
          refreshUnreadMessages();
        })
        .catch(function () {
          threadEl.innerHTML = '<div class="dropdown-empty-state">Не удалось загрузить диалог</div>';
        });
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
          textarea.value = '';
          notify('Сообщение отправлено');
          refreshUnreadMessages();
          loadThread();
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

    loadThread();
    refreshTimer = setInterval(loadThread, 7000);
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
