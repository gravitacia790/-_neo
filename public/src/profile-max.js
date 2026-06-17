import { API } from './api.js';
import { getUiErrorMessage, notify } from './utils.js';
import { html, setHtml } from './html.js';
// Привязка аккаунта MAX из профиля: статус, deep-link, поллинг подтверждения.
export var MAX_LINK = (function () {
  var pollTimer = null;
  var pollUntil = 0;

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function render(status) {
    var block = document.getElementById('maxLinkBlock');
    var statusEl = document.getElementById('maxLinkStatus');
    var linkBtn = document.getElementById('maxLinkBtn');
    var unlinkBtn = document.getElementById('maxUnlinkBtn');
    if (!block || !statusEl || !linkBtn || !unlinkBtn) return;

    if (!status || !status.enabled) {
      block.hidden = true;
      return;
    }
    block.hidden = false;

    if (status.linked) {
      setHtml(
        statusEl,
        html`<span class="max-link-ok">✓ Привязан${status.maxUsername ? ' (' + status.maxUsername + ')' : ''}</span>`
      );
      linkBtn.hidden = true;
      unlinkBtn.hidden = false;
    } else {
      statusEl.textContent = 'Не привязан. Коды восстановления будут приходить только на почту.';
      linkBtn.hidden = false;
      unlinkBtn.hidden = true;
    }
  }

  function refresh() {
    return API.maxGetStatus()
      .then(function (status) {
        render(status);
        return status;
      })
      .catch(function () {
        var block = document.getElementById('maxLinkBlock');
        if (block) block.hidden = true;
      });
  }

  function startPolling() {
    stopPolling();
    pollUntil = Date.now() + 90000; // ждём подтверждения до 90 сек
    pollTimer = setInterval(function () {
      if (Date.now() > pollUntil) {
        stopPolling();
        return;
      }
      API.maxGetStatus()
        .then(function (status) {
          render(status);
          if (status && status.linked) {
            stopPolling();
            notify('Аккаунт MAX привязан');
          }
        })
        .catch(function () {});
    }, 3000);
  }

  function bind() {
    var linkBtn = document.getElementById('maxLinkBtn');
    var unlinkBtn = document.getElementById('maxUnlinkBtn');
    if (linkBtn) {
      linkBtn.onclick = function () {
        linkBtn.disabled = true;
        API.maxCreateLink()
          .then(function (resp) {
            if (resp && resp.deepLink) {
              window.open(resp.deepLink, '_blank', 'noopener');
              var statusEl = document.getElementById('maxLinkStatus');
              if (statusEl) statusEl.textContent = 'Откройте бота MAX и нажмите «Старт». Ожидаем подтверждения…';
              startPolling();
            }
          })
          .catch(function (err) {
            notify(getUiErrorMessage(err, 'Не удалось создать ссылку привязки.'));
          })
          .finally(function () {
            linkBtn.disabled = false;
          });
      };
    }
    if (unlinkBtn) {
      unlinkBtn.onclick = function () {
        unlinkBtn.disabled = true;
        API.maxUnlink()
          .then(function () {
            notify('Аккаунт MAX отвязан');
            return refresh();
          })
          .catch(function (err) {
            notify(getUiErrorMessage(err, 'Не удалось отвязать MAX.'));
          })
          .finally(function () {
            unlinkBtn.disabled = false;
          });
      };
    }
  }

  return { bind: bind, refresh: refresh };
})();
