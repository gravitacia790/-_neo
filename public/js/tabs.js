function initTabs() {
  var topButtons = document.querySelectorAll('#topNav button');
  var topContents = ['profile', 'school', 'events', 'directors', 'mentors'];
  var bottomButtons = document.querySelectorAll('#bottomNav .nav-item');
  var bottomContents = ['expert', 'gl', 'internship', 'calendar'];
  if (isAdmin()) bottomContents.push('admin');

  function switchTopTab(tabId) {
    topContents.forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.remove('active'); });
    var activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    topButtons.forEach(function (btn) {
      if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    bottomContents.forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.remove('active'); });
    bottomButtons.forEach(function (btn) { btn.classList.remove('active'); });

    if (tabId === 'directors') renderDirectors();
    if (tabId === 'mentors') renderMentors();
    if (tabId === 'events') renderEvents();
    if (tabId === 'profile') updateProfileRatingDisplay();
  }

  function switchBottomTab(tabId) {
    bottomContents.forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.remove('active'); });
    var activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    bottomButtons.forEach(function (btn) {
      if (btn.getAttribute('data-newtab') === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    topContents.forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.remove('active'); });
    topButtons.forEach(function (btn) { btn.classList.remove('active'); });

    if (tabId === 'gl') renderGL();
    if (tabId === 'internship') renderInternship();
    if (tabId === 'calendar') renderCalendar();
    if (tabId === 'admin' && isAdmin()) renderAdminPanel();
  }

  topButtons.forEach(function (btn) {
    var tabId = btn.getAttribute('data-tab');
    btn.addEventListener('click', function () { switchTopTab(tabId); });
  });

  bottomButtons.forEach(function (btn) {
    var tabId = btn.getAttribute('data-newtab');
    if (tabId) btn.addEventListener('click', function () { switchBottomTab(tabId); });
  });

  switchTopTab('profile');
}

function initPWA() {
  var deferredPrompt;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var installPrompt = document.getElementById('installPrompt');
    if (installPrompt) installPrompt.style.display = 'flex';
  });

  var installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choiceResult) {
          if (choiceResult.outcome === 'accepted') {
            document.getElementById('installPrompt').style.display = 'none';
          }
          deferredPrompt = null;
        });
      }
    });
  }

  if ('serviceWorker' in navigator) {
    var swCode = "self.addEventListener('install', function(e) { self.skipWaiting(); });" +
                 "self.addEventListener('activate', function(e) { self.clients.claim(); });" +
                 "self.addEventListener('fetch', function(e) {});";
    var blob = new Blob([swCode], { type: 'application/javascript' });
    navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(function (err) { console.log('SW setup failed:', err); });
  }
}
