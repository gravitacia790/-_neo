function initTabs() {
  var scrollMemory = {};
  var allTabs = ['profile', 'school', 'events', 'directors', 'mentors', 'expert', 'gl', 'internship', 'calendar'];
  var primaryTabs = ['profile', 'school', 'events', 'directors', 'mentors'];
  var moreTabs = ['expert', 'gl', 'internship', 'calendar'];
  if (isAdmin()) { allTabs.push('admin'); moreTabs.push('admin'); var adminBtn = document.querySelector('.admin-only'); if (adminBtn) adminBtn.style.display = ''; }

  var navBtns = document.querySelectorAll('#topNav button');
  var mobileNavBtns = document.querySelectorAll('#mobileBottomNav button');
  var moreBtn = document.getElementById('moreNavBtn');
  var mobileMoreBtn = document.getElementById('mobileMoreBtn');
  var moreRow = document.getElementById('moreRow');
  var moreSheet = document.getElementById('moreSheet');
  var moreSheetBackdrop = document.getElementById('moreSheetBackdrop');
  var moreSheetClose = document.getElementById('moreSheetClose');
  var sheetBtns = moreSheet ? moreSheet.querySelectorAll('[data-tab]') : [];
  var mainContent = document.getElementById('mainContent');
  var sheetTouchStartY = 0;
  var sheetTouchCurrentY = 0;
  var sheetDragging = false;
  var activeTabId = 'profile';
  var navHistory = [];
  var swipeTrack = null;

  function setSheetDragProgress(delta) {
    if (!moreSheet || !moreSheetBackdrop) return;
    var maxDelta = Math.min(Math.max(delta, 0), 180);
    var progress = maxDelta / 180;
    moreSheet.style.transform = 'translateY(' + maxDelta + 'px)';
    moreSheetBackdrop.style.opacity = String(1 - progress);
  }

  function isMobileNav() {
    var mobileNav = document.getElementById('mobileBottomNav');
    if (!mobileNav) return window.matchMedia('(max-width: 767px)').matches;
    return window.getComputedStyle(mobileNav).display !== 'none';
  }

  function closeMoreMenus() {
    if (moreRow) moreRow.classList.remove('visible');
    if (moreSheet) {
      moreSheet.classList.remove('visible');
      moreSheet.setAttribute('aria-hidden', 'true');
      moreSheet.hidden = true;
    }
    if (moreSheetBackdrop) {
      moreSheetBackdrop.classList.remove('visible');
      moreSheetBackdrop.hidden = true;
    }
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
    if (mobileMoreBtn) mobileMoreBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-sheet-open');
  }

  function openMoreMenus() {
    if (isMobileNav()) {
      if (moreSheet) {
        moreSheet.hidden = false;
        moreSheet.setAttribute('aria-hidden', 'false');
        moreSheet.classList.add('visible');
      }
      if (moreSheetBackdrop) {
        moreSheetBackdrop.hidden = false;
        moreSheetBackdrop.classList.add('visible');
      }
      document.body.classList.add('nav-sheet-open');
    } else if (moreRow) {
      moreRow.classList.add('visible');
    }
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'true');
    if (mobileMoreBtn) mobileMoreBtn.setAttribute('aria-expanded', 'true');
  }

  function isMoreTab(tabId) {
    return moreTabs.indexOf(tabId) !== -1;
  }

  function canGoBackInHistory() {
    return navHistory.length > 0;
  }

  function popHistoryTarget() {
    if (!canGoBackInHistory()) return null;
    return navHistory.pop();
  }

  function pushHistory(fromTab) {
    if (!fromTab) return;
    if (navHistory[navHistory.length - 1] === fromTab) return;
    navHistory.push(fromTab);
    if (navHistory.length > 30) navHistory.shift();
  }

  function openMoreSheetOnly() {
    if (!isMobileNav()) return;
    if (moreSheet) {
      moreSheet.hidden = false;
      moreSheet.setAttribute('aria-hidden', 'false');
      moreSheet.classList.add('visible');
    }
    if (moreSheetBackdrop) {
      moreSheetBackdrop.hidden = false;
      moreSheetBackdrop.classList.add('visible');
    }
    if (mobileMoreBtn) mobileMoreBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-sheet-open');
  }

  function bindMobileSwipeBack() {
    if (!mainContent) return;

    mainContent.addEventListener('touchstart', function (e) {
      if (!isMobileNav() || !e.touches || !e.touches.length) return;
      if (document.body.classList.contains('nav-sheet-open')) {
        swipeTrack = null;
        return;
      }
      var t = e.touches[0];
      swipeTrack = {
        x: t.clientX,
        y: t.clientY,
        startedAt: Date.now(),
        edgeStart: t.clientX <= 28,
        dragging: false,
      };
    }, { passive: true });

    mainContent.addEventListener('touchmove', function (e) {
      if (!swipeTrack || !swipeTrack.edgeStart || !e.touches || !e.touches.length) return;
      var t = e.touches[0];
      var deltaX = Math.max(0, t.clientX - swipeTrack.x);
      var deltaY = t.clientY - swipeTrack.y;
      var horizontalEnough = deltaX > 14 && deltaX > Math.abs(deltaY) * 1.15;
      if (!horizontalEnough) return;

      swipeTrack.dragging = true;
      var shift = Math.min(deltaX, 96);
      mainContent.style.transition = 'none';
      mainContent.style.transform = 'translateX(' + shift + 'px)';
      mainContent.style.opacity = String(1 - Math.min(shift / 480, 0.18));
    }, { passive: true });

    mainContent.addEventListener('touchend', function (e) {
      if (!swipeTrack || !e.changedTouches || !e.changedTouches.length) return;
      var t = e.changedTouches[0];
      var deltaX = t.clientX - swipeTrack.x;
      var deltaY = t.clientY - swipeTrack.y;
      var elapsed = Date.now() - swipeTrack.startedAt;
      var isValidSwipe =
        swipeTrack.edgeStart &&
        deltaX > 88 &&
        deltaX > Math.abs(deltaY) * 1.4 &&
        Math.abs(deltaY) < 72 &&
        elapsed < 1000;

      var hasDragged = swipeTrack.dragging;
      swipeTrack = null;
      if (hasDragged) {
        mainContent.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease';
        mainContent.style.transform = '';
        mainContent.style.opacity = '';
        window.setTimeout(function () {
          mainContent.style.transition = '';
        }, 260);
      }
      if (!isValidSwipe) return;

      if (isMoreTab(activeTabId)) {
        openMoreSheetOnly();
        return;
      }

      if (canGoBackInHistory()) {
        var prevTab = popHistoryTarget();
        if (prevTab) switchTab(prevTab, { trackHistory: false });
      }
    }, { passive: true });

    mainContent.addEventListener('touchcancel', function () {
      if (swipeTrack && swipeTrack.dragging) {
        mainContent.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        mainContent.style.transform = '';
        mainContent.style.opacity = '';
        window.setTimeout(function () {
          mainContent.style.transition = '';
        }, 240);
      }
      swipeTrack = null;
    }, { passive: true });
  }

  function syncMobileNavState(tabId) {
    Array.prototype.forEach.call(sheetBtns, function (btn) {
      if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function syncShellState(tabId) {
    if (!mainContent) return;
    mainContent.setAttribute('data-active-tab', tabId);
  }

  function switchTab(tabId, opts) {
    opts = opts || {};
    var trackHistory = opts.trackHistory !== false;
    if (!tabId || allTabs.indexOf(tabId) === -1) return;
    if (activeTabId === tabId) {
      closeMoreMenus();
      return;
    }
    if (trackHistory) pushHistory(activeTabId);

    allTabs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.classList.contains('active')) {
        scrollMemory[id] = document.getElementById('mainContent').scrollTop;
      }
    });
    allTabs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    var activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    activeTabId = tabId;
    navBtns.forEach(function (btn) {
      if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    mobileNavBtns.forEach(function (btn) {
      if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    syncMobileNavState(tabId);
    syncShellState(tabId);
    closeMoreMenus();

    if (tabId === 'directors') renderDirectors();
    if (tabId === 'mentors') renderMentors();
    if (tabId === 'events') renderEvents();
    if (tabId === 'profile') updateProfileRatingDisplay();
    if (tabId === 'gl') renderGL();
    if (tabId === 'internship') renderInternship();
    if (tabId === 'calendar') renderCalendar();
    if (tabId === 'admin' && isAdmin()) renderAdminPanel();

    document.getElementById('mainContent').scrollTop = scrollMemory[tabId] || 0;
  }

  navBtns.forEach(function (btn) {
    var tabId = btn.getAttribute('data-tab');
    if (tabId) {
      btn.addEventListener('click', function () {
        switchTab(tabId);
      });
    }
  });

  if (moreBtn) {
    moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var expanded = moreBtn.getAttribute('aria-expanded') === 'true';
      if (expanded) closeMoreMenus();
      else openMoreMenus();
    });
  }

  mobileNavBtns.forEach(function (btn) {
    var tabId = btn.getAttribute('data-tab');
    if (tabId) {
      btn.addEventListener('click', function () {
        switchTab(tabId);
      });
    }
  });

  if (mobileMoreBtn) {
    mobileMoreBtn.addEventListener('click', function () {
      var expanded = mobileMoreBtn.getAttribute('aria-expanded') === 'true';
      if (expanded) closeMoreMenus();
      else openMoreMenus();
    });
  }

  Array.prototype.forEach.call(sheetBtns, function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  if (moreSheetClose) moreSheetClose.addEventListener('click', closeMoreMenus);
  if (moreSheetBackdrop) moreSheetBackdrop.addEventListener('click', closeMoreMenus);
  if (moreSheet) {
    moreSheet.addEventListener('touchstart', function (e) {
      if (!isMobileNav() || !e.touches.length) return;
      sheetTouchStartY = e.touches[0].clientY;
      sheetTouchCurrentY = sheetTouchStartY;
      sheetDragging = true;
      moreSheet.style.transition = 'none';
    }, { passive: true });

    moreSheet.addEventListener('touchmove', function (e) {
      if (!sheetDragging || !e.touches.length) return;
      sheetTouchCurrentY = e.touches[0].clientY;
      var delta = Math.max(0, sheetTouchCurrentY - sheetTouchStartY);
      setSheetDragProgress(delta);
    }, { passive: true });

    moreSheet.addEventListener('touchend', function () {
      if (!sheetDragging) return;
      var delta = Math.max(0, sheetTouchCurrentY - sheetTouchStartY);
      sheetDragging = false;
      moreSheet.style.transition = '';
      moreSheet.style.transform = '';
      if (moreSheetBackdrop) moreSheetBackdrop.style.opacity = '';
      if (delta > 90) closeMoreMenus();
    });
  }

  document.addEventListener('click', function (e) {
    if (!moreBtn) return;
    if (!moreBtn.contains(e.target) && moreRow && moreRow.classList.contains('visible')) {
      moreRow.classList.remove('visible');
      moreBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMoreMenus();
  });

  window.addEventListener('resize', function () {
    closeMoreMenus();
  });

  bindMobileSwipeBack();
  switchTab('profile', { trackHistory: false });
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    var swCode =
      "self.addEventListener('install', function(e) { self.skipWaiting(); });" +
      "self.addEventListener('activate', function(e) { self.clients.claim(); });" +
      "self.addEventListener('fetch', function(e) {});";
    var blob = new Blob([swCode], { type: 'application/javascript' });
    navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(function (err) {
      console.log('SW setup failed:', err);
    });
  }
}
