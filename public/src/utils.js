import { API } from './api.js';

export function getMaterialTypeLabel(value) {
  if (value === 'presentation') return 'Презентация';
  if (value === 'recording') return 'Запись';
  if (value === 'document') return 'Документ';
  return 'Ссылка';
}

export function escapeHtml(str) {
  return (str == null ? '' : String(str)).replace(/[&<>"']/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

export function escapeAttr(str) {
  return (str == null ? '' : String(str)).replace(/["<>&]/g, function (m) {
    if (m === '"') return '&quot;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '&') return '&amp;';
    return m;
  });
}

export function notify(msg) {
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg || '';
  document.body.appendChild(toast);
  requestAnimationFrame(function () {
    toast.classList.add('visible');
  });
  setTimeout(function () {
    toast.classList.remove('visible');
    setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 300);
  }, 3000);
}

export function getUiErrorMessage(err, fallback) {
  if (!err) return fallback || 'Произошла ошибка. Попробуйте еще раз.';
  if (err.status === 401) return 'Сессия истекла. Войдите в аккаунт снова.';
  if (err.status === 403) return 'Недостаточно прав для этого действия.';
  if (err.status >= 500) return 'Сервис временно недоступен. Попробуйте немного позже.';
  if (err.message && !/^HTTP \d+$/.test(err.message)) return err.message;
  return fallback || 'Произошла ошибка. Попробуйте еще раз.';
}

export function isRetriableApiError(err) {
  if (!err) return true;
  if (!err.status) return true;
  return err.status >= 500;
}

export function retryPromise(factory, options) {
  options = options || {};
  var attempts = Math.max(1, options.attempts || 1);
  var delayMs = Math.max(0, options.delayMs || 0);
  var shouldRetry = options.shouldRetry || isRetriableApiError;
  var attempt = 0;

  function run() {
    attempt += 1;
    return Promise.resolve()
      .then(function () {
        return factory();
      })
      .catch(function (err) {
        if (attempt >= attempts || !shouldRetry(err)) throw err;
        return new Promise(function (resolve) {
          setTimeout(resolve, delayMs);
        }).then(run);
      });
  }

  return run();
}

export function showModal(title, contentHtml) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal-content"><button class="close-modal">&times;</button><h2 style="margin-bottom: 20px;">' +
    escapeHtml(title) +
    '</h2>' +
    contentHtml +
    '</div>';
  document.body.appendChild(overlay);
  overlay.querySelector('.close-modal').onclick = function () {
    overlay.remove();
  };
  overlay.onclick = function (e) {
    if (e.target === overlay) overlay.remove();
  };
  return overlay;
}

export function confirmDialog(options) {
  options = options || {};
  return new Promise(function (resolve) {
    var overlay = showModal(
      options.title || 'Подтвердите действие',
      '<p class="modal-hint">' + escapeHtml(options.message || 'Продолжить?') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="ghost-btn" type="button" data-dialog-action="cancel">' + escapeHtml(options.cancelText || 'Отмена') + '</button>' +
      '<button class="save-btn" type="button" data-dialog-action="confirm">' + escapeHtml(options.confirmText || 'Подтвердить') + '</button>' +
      '</div>'
    );
    var settled = false;
    function settle(value) {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(value);
    }
    overlay.querySelector('[data-dialog-action="cancel"]').addEventListener('click', function () { settle(false); });
    overlay.querySelector('[data-dialog-action="confirm"]').addEventListener('click', function () { settle(true); });
    overlay.querySelector('.close-modal').onclick = function () { settle(false); };
    overlay.onclick = function (e) {
      if (e.target === overlay) settle(false);
    };
  });
}

export function feedbackDialog(options) {
  options = options || {};
  return new Promise(function (resolve) {
    var overlay = showModal(
      options.title || 'Готово',
      '<p class="modal-hint">' + escapeHtml(options.message || '') + '</p>' +
      '<div class="modal-actions"><button class="save-btn" type="button" data-dialog-action="ok">ОК</button></div>'
    );
    function close() {
      overlay.remove();
      resolve();
    }
    overlay.querySelector('[data-dialog-action="ok"]').addEventListener('click', close);
    overlay.querySelector('.close-modal').onclick = close;
    overlay.onclick = function (e) {
      if (e.target === overlay) close();
    };
  });
}

export function getCurrentUserEmail() {
  var u = API.getUser();
  return u ? u.email : null;
}

export function getCurrentUserName() {
  var u = API.getUser();
  return u ? u.name : null;
}

export function isAdmin() {
  return API.isAdmin();
}

// Глобальный кэш профиля и школы для отображения карточек
export var __myProfile = null;
export var __mySchool = null;
export function setMyProfileCache(profile, school) {
  __myProfile = profile;
  __mySchool = school;
}
export function getMyProfileCache() {
  return __myProfile;
}
export function getMySchoolCache() {
  return __mySchool;
}

export function getCurrentDirectorName() {
  return (__myProfile && __myProfile.name) || getCurrentUserName() || 'Директор';
}

export function getCurrentSchoolName() {
  return (__mySchool && __mySchool.name) || 'Школа';
}
