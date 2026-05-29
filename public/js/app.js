/* global SHELLDOM */
var APP_RUNTIME = {
  tabsInitialized: false,
  msgButtonBound: false,
  shellScrollBound: false,
  viewportBound: false,
  keyboardWatcherBound: false,
  keyboardWatcherId: null,
  mobileNavMoved: false,
  mobileNavOriginalParent: null,
  mobileNavNextSibling: null,
};

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
  syncShellScrollState();
  SHELLDOM.syncAdminVisibility(isAdmin());
  loadUserDataIntoForms().then(function () {
    if (!APP_RUNTIME.tabsInitialized) {
      initTabs();
      APP_RUNTIME.tabsInitialized = true;
    }
    WS.connect();
    NOTIF.init();
    var msgBtn = document.getElementById('msgBtn');
    if (msgBtn && !APP_RUNTIME.msgButtonBound) {
      msgBtn.addEventListener('click', openMsgDropdown);
      APP_RUNTIME.msgButtonBound = true;
    }
  });
}

function syncShellScrollState() {
  var app = document.getElementById('app');
  var main = document.getElementById('mainContent');
  if (!app || !main) return;
  var y = Math.max(main.scrollTop || 0, window.scrollY || 0);
  app.classList.toggle('shell-scrolled', y > 6);
}

function bindShellScrollEffects() {
  if (APP_RUNTIME.shellScrollBound) return;
  var main = document.getElementById('mainContent');
  if (!main) return;
  APP_RUNTIME.shellScrollBound = true;
  main.addEventListener('scroll', syncShellScrollState, { passive: true });
  window.addEventListener('scroll', syncShellScrollState, { passive: true });
  window.addEventListener('resize', syncShellScrollState);
}

function setKeyboardMode(isOpen) {
  var app = document.getElementById('app');
  var body = document.body;
  if (!app) return;
  app.classList.toggle('keyboard-open', !!isOpen);
  if (body) body.classList.toggle('keyboard-open', !!isOpen);
}

function isMobileViewport() {
  return window.innerWidth <= 767;
}

function isKeyboardInputTarget(target) {
  return !!(
    target &&
    target.matches &&
    target.matches(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]'
    )
  );
}

function bindViewportKeyboardAdaptation() {
  if (APP_RUNTIME.viewportBound) return;
  APP_RUNTIME.viewportBound = true;

  var vv = window.visualViewport;
  if (vv) {
    var onViewportChange = function () {
      if (!isMobileViewport()) {
        setKeyboardMode(false);
        return;
      }
      var keyboardLikelyOpen = (window.innerHeight - vv.height) > 120;
      setKeyboardMode(keyboardLikelyOpen);
    };
    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    window.addEventListener('orientationchange', function () {
      setTimeout(onViewportChange, 120);
    });
    onViewportChange();
  }

  // Fallback/extra signal for browsers where visualViewport is noisy.
  function onFocusIn(e) {
    if (!isMobileViewport()) return;
    if (isKeyboardInputTarget(e.target)) setKeyboardMode(true);
  }

  function onFocusOut() {
    if (!isMobileViewport()) return;
    setTimeout(function () {
      var active = document.activeElement;
      if (isKeyboardInputTarget(active)) return;
      setKeyboardMode(false);
    }, 120);
  }

  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  window.addEventListener('focusin', onFocusIn, true);
  window.addEventListener('focusout', onFocusOut, true);
}

function bindKeyboardFocusWatcher() {
  if (APP_RUNTIME.keyboardWatcherBound) return;
  APP_RUNTIME.keyboardWatcherBound = true;
  APP_RUNTIME.keyboardWatcherId = window.setInterval(function () {
    if (!isMobileViewport()) {
      setKeyboardMode(false);
      return;
    }
    var activeInput = isKeyboardInputTarget(document.activeElement);
    var vv = window.visualViewport;
    var reducedViewport = vv ? (window.innerHeight - vv.height) > 120 : false;
    setKeyboardMode(activeInput || reducedViewport);
  }, 220);
}

function mountMobileNavForViewport() {
  var nav = document.getElementById('mobileBottomNav');
  if (!nav) return;

  // On phones, mount nav directly to body so it is never affected by parent scrolling/stacking contexts.
  if (isMobileViewport()) {
    if (!APP_RUNTIME.mobileNavMoved) {
      APP_RUNTIME.mobileNavOriginalParent = nav.parentNode;
      APP_RUNTIME.mobileNavNextSibling = nav.nextSibling;
      document.body.appendChild(nav);
      APP_RUNTIME.mobileNavMoved = true;
    }
    return;
  }

  // Restore original DOM position for tablet/desktop widths.
  if (APP_RUNTIME.mobileNavMoved && APP_RUNTIME.mobileNavOriginalParent) {
    if (APP_RUNTIME.mobileNavNextSibling && APP_RUNTIME.mobileNavNextSibling.parentNode === APP_RUNTIME.mobileNavOriginalParent) {
      APP_RUNTIME.mobileNavOriginalParent.insertBefore(nav, APP_RUNTIME.mobileNavNextSibling);
    } else {
      APP_RUNTIME.mobileNavOriginalParent.appendChild(nav);
    }
    APP_RUNTIME.mobileNavMoved = false;
  }
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
  bindShellScrollEffects();
  bindViewportKeyboardAdaptation();
  bindKeyboardFocusWatcher();
  mountMobileNavForViewport();
  window.addEventListener('resize', mountMobileNavForViewport);

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
