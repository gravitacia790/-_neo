import { API } from './api.js';
import { logout, showLoginModal, showRegisterModal } from './auth.js';
import { bindDirectorSearch } from './directors-actions.js';
import { bindDirectorSegments, bindFavoritesSort, resetDirectorsEntryState } from './directors.js';
import { bindCreateEvent } from './events-actions.js';
import { NOTIF } from './notifications.js';
import { loadUserDataIntoForms } from './profile-loader.js';
import { initPushClient } from './push-client.js';
import { SHELLDOM } from './shell-dom.js';
import { initTabs, switchAppTab } from './tabs.js';
import { isAdmin } from './utils.js';
import { initStaticViewBindings, renderStaticViews } from './views.js';
import { WS } from './ws.js';
export var APP_RUNTIME = {
  tabsInitialized: false,
  introMinDuration: 2400,
  introStartedAt: Date.now(),
  introTimerId: null,
  shellScrollBound: false,
  viewportBound: false,
  keyboardWatcherBound: false,
  keyboardWatcherId: null,
  mobileNavMoved: false,
  mobileNavOriginalParent: null,
  mobileNavNextSibling: null,
};

export function getAppShell() {
  return SHELLDOM.getShellRefs();
}

export function setAppState(state) {
  var shell = getAppShell();
  if (shell.app) shell.app.setAttribute('data-app-state', state);
  if (shell.intro) shell.intro.setAttribute('aria-hidden', state === 'intro' ? 'false' : 'true');
  if (shell.splash) shell.splash.setAttribute('aria-hidden', state === 'splash' ? 'false' : 'true');
  if (shell.main) {
    shell.main.classList.toggle('active', state === 'app');
    shell.main.setAttribute('aria-hidden', state === 'app' ? 'false' : 'true');
  }
  syncMobileNavVisibility(state);
  return shell;
}

export function clearIntroTimer() {
  if (!APP_RUNTIME.introTimerId) return;
  window.clearTimeout(APP_RUNTIME.introTimerId);
  APP_RUNTIME.introTimerId = null;
}

export function showIntro() {
  clearIntroTimer();
  APP_RUNTIME.introStartedAt = Date.now();
  setAppState('intro');
}

export function runAfterIntro(callback) {
  clearIntroTimer();
  var app = document.getElementById('app');
  var currentState = app ? app.getAttribute('data-app-state') : 'intro';
  if (currentState !== 'intro') {
    showIntro();
  }
  var elapsed = Date.now() - APP_RUNTIME.introStartedAt;
  var wait = Math.max(0, APP_RUNTIME.introMinDuration - elapsed);
  APP_RUNTIME.introTimerId = window.setTimeout(function () {
    APP_RUNTIME.introTimerId = null;
    callback();
  }, wait);
}

export function syncMobileNavVisibility(state) {
  var nav = document.getElementById('mobileBottomNav');
  if (!nav) return;
  var shouldShow = state === 'app';
  nav.hidden = !shouldShow;
  nav.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

export function showMainApp(options) {
  if (!options || !options.skipIntro) {
    runAfterIntro(function () {
      showMainApp({ skipIntro: true });
    });
    return;
  }
  clearIntroTimer();
  var tabsWereInitialized = APP_RUNTIME.tabsInitialized;
  setAppState('app');
  syncShellScrollState();
  SHELLDOM.syncAdminVisibility(isAdmin());
  resetDirectorsEntryState();
  if (!APP_RUNTIME.tabsInitialized) {
    initTabs();
    APP_RUNTIME.tabsInitialized = true;
  }
  ensureActiveTabFallback();
  if (tabsWereInitialized) {
    switchAppTab('directors', { trackHistory: false, forceRender: true });
  }
  loadUserDataIntoForms().catch(function () {
    // Keep navigation usable even if profile data temporarily fails to load.
  }).then(function () {
    WS.connect();
    NOTIF.init();
    initPushClient();
  });
}

export function ensureActiveTabFallback() {
  var main = document.getElementById('mainContent');
  var directors = document.getElementById('directors');
  if (!main || !directors) return;
  if (main.querySelector('.tab-content.active')) return;
  directors.classList.add('active');
  main.setAttribute('data-active-tab', 'directors');
}

export function syncShellScrollState() {
  var app = document.getElementById('app');
  var main = document.getElementById('mainContent');
  if (!app || !main) return;
  var y = Math.max(main.scrollTop || 0, window.scrollY || 0);
  app.classList.toggle('shell-scrolled', y > 6);
}

export function bindShellScrollEffects() {
  if (APP_RUNTIME.shellScrollBound) return;
  var main = document.getElementById('mainContent');
  if (!main) return;
  APP_RUNTIME.shellScrollBound = true;
  main.addEventListener('scroll', syncShellScrollState, { passive: true });
  window.addEventListener('scroll', syncShellScrollState, { passive: true });
  window.addEventListener('resize', syncShellScrollState);
}

export function setKeyboardMode(isOpen) {
  var app = document.getElementById('app');
  var body = document.body;
  if (!app) return;
  app.classList.toggle('keyboard-open', !!isOpen);
  if (body) body.classList.toggle('keyboard-open', !!isOpen);
}

export function isMobileViewport() {
  return window.innerWidth <= 767;
}

export function isKeyboardInputTarget(target) {
  return !!(
    target &&
    target.matches &&
    target.matches(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]'
    )
  );
}

export function bindViewportKeyboardAdaptation() {
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

export function bindKeyboardFocusWatcher() {
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

export function mountMobileNavForViewport() {
  var nav = document.getElementById('mobileBottomNav');
  if (!nav) return;
  var app = document.getElementById('app');
  var state = app ? app.getAttribute('data-app-state') : 'splash';

  // On phones, mount nav directly to body so it is never affected by parent scrolling/stacking contexts.
  if (isMobileViewport()) {
    if (!APP_RUNTIME.mobileNavMoved) {
      APP_RUNTIME.mobileNavOriginalParent = nav.parentNode;
      APP_RUNTIME.mobileNavNextSibling = nav.nextSibling;
      document.body.appendChild(nav);
      APP_RUNTIME.mobileNavMoved = true;
    }
    syncMobileNavVisibility(state || 'splash');
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

  syncMobileNavVisibility(state || 'splash');
}

export function loadCommunityStats() {
  var el = document.getElementById('communityCount');
  var status = document.getElementById('splashStatsStatus');
  fetch('/api/stats', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (el) el.textContent = d.directors || '0';
      if (status) status.setAttribute('data-loading', 'false');
    })
    .catch(function () {
      if (el && !el.textContent) el.textContent = '0';
      if (status) status.setAttribute('data-loading', 'false');
    });
}

export function showSplash() {
  clearIntroTimer();
  WS.disconnect();
  if (typeof NOTIF !== 'undefined' && NOTIF && typeof NOTIF.closeDropdown === 'function') {
    NOTIF.closeDropdown();
  }
  if (APP_RUNTIME.keyboardWatcherId) {
    window.clearInterval(APP_RUNTIME.keyboardWatcherId);
    APP_RUNTIME.keyboardWatcherId = null;
    APP_RUNTIME.keyboardWatcherBound = false;
  }
  setAppState('splash');
}

export function initApp() {
  showIntro();
  renderStaticViews();
  initStaticViewBindings();

  document.getElementById('loginBtn').onclick = showLoginModal;
  document.getElementById('registerBtn').onclick = showRegisterModal;
  document.getElementById('logoutBtn').onclick = logout;

  bindCreateEvent();
  bindDirectorSearch();
  bindDirectorSegments();
  bindFavoritesSort();
  loadCommunityStats();
  bindShellScrollEffects();
  bindViewportKeyboardAdaptation();
  bindKeyboardFocusWatcher();
  mountMobileNavForViewport();
  window.addEventListener('resize', mountMobileNavForViewport);

  if (API.isAuthed()) {
    API.me().then(function (resp) {
      API.setUser(resp.user);
      showMainApp();
    }).catch(function () {
      API.clearUser();
      runAfterIntro(showSplash);
    });
  } else {
    runAfterIntro(showSplash);
  }
}
