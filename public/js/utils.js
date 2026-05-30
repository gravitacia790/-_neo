function escapeHtml(str) {
  return (str == null ? '' : String(str)).replace(/[&<>"']/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

function escapeAttr(str) {
  return (str == null ? '' : String(str)).replace(/["<>&]/g, function (m) {
    if (m === '"') return '&quot;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '&') return '&amp;';
    return m;
  });
}

function notify(msg) {
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

function getUiErrorMessage(err, fallback) {
  if (!err) return fallback || 'Произошла ошибка. Попробуйте еще раз.';
  if (err.status === 401) return 'Сессия истекла. Войдите в аккаунт снова.';
  if (err.status === 403) return 'Недостаточно прав для этого действия.';
  if (err.status >= 500) return 'Сервис временно недоступен. Попробуйте немного позже.';
  if (err.message && !/^HTTP \d+$/.test(err.message)) return err.message;
  return fallback || 'Произошла ошибка. Попробуйте еще раз.';
}

function isRetriableApiError(err) {
  if (!err) return true;
  if (!err.status) return true;
  return err.status >= 500;
}

function retryPromise(factory, options) {
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

function showModal(title, contentHtml) {
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

function getCurrentUserEmail() {
  var u = API.getUser();
  return u ? u.email : null;
}

function getCurrentUserName() {
  var u = API.getUser();
  return u ? u.name : null;
}

function isAdmin() {
  return API.isAdmin();
}

// Глобальный кэш профиля и школы для отображения карточек
var __myProfile = null;
var __mySchool = null;
function setMyProfileCache(profile, school) {
  __myProfile = profile;
  __mySchool = school;
}
function getMyProfileCache() {
  return __myProfile;
}
function getMySchoolCache() {
  return __mySchool;
}

function getCurrentDirectorName() {
  return (__myProfile && __myProfile.name) || getCurrentUserName() || 'Директор';
}

function getCurrentSchoolName() {
  return (__mySchool && __mySchool.name) || 'Школа';
}
