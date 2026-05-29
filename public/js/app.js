/* global SHELLDOM */
function getAppShell() {
  return SHELLDOM.getShellRefs();
}

function setAppState(state) {
  var shell = getAppShell();
  if (shell.app) shell.app.setAttribute('data-app-state', state);
  if (shell.splash) shell.splash.setAttribute('aria-hidden', state === 'app' ? 'true' : 'false');
  if (shell.main) {
    shell.main.classList.toggle('active', state === 'app');
    shell.main.setAttribute('aria-hidden', state === 'app' ? 'false' : 'true');
  }
  return shell;
}

function showMainApp() {
  setAppState('app');
  SHELLDOM.syncAdminVisibility(isAdmin());
  loadUserDataIntoForms().then(function () {
    initTabs();
    WS.connect();
    NOTIF.init();
    document.getElementById('msgBtn').addEventListener('click', openMsgDropdown);
  });
}

function loadCommunityStats() {
  var el = document.getElementById('communityCount');
  var status = document.getElementById('splashStatsStatus');
  fetch('/api/stats', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (el) el.textContent = d.directors || '0';
      if (status) status.setAttribute('data-loading', 'false');
    })
    .catch(function () {
      if (el) el.textContent = 'сообщество активно';
      if (status) status.setAttribute('data-loading', 'false');
    });
}

function showSplash() {
  setAppState('splash');
}

function initApp() {
  renderStaticViews();
  initStaticViewBindings();

  document.getElementById('loginBtn').onclick = showLoginModal;
  document.getElementById('registerBtn').onclick = showRegisterModal;
  document.getElementById('logoutBtn').onclick = logout;

  bindCreateEvent();
  bindDirectorSearch();
  loadCommunityStats();

  window.showMainApp = showMainApp;
  window.showSplash = showSplash;

  if (API.isAuthed()) {
    API.me().then(function (resp) {
      API.setUser(resp.user);
      showMainApp();
    }).catch(function () {
      API.clearUser();
      showSplash();
    });
  } else {
    showSplash();
  }
}

initApp();
