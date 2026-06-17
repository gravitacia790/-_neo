export var SHELLDOM = (function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  function setExpanded(el, expanded) {
    if (!el) return;
    el.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function syncBadge(el, count) {
    if (!el) return;
    var normalized = Number.isFinite(Number(count)) ? Number(count) : 0;
    if (normalized < 0) normalized = 0;
    setText(el, normalized > 99 ? '99+' : (normalized || ''));
    setHidden(el, normalized <= 0);
  }

  function syncAdminVisibility(isVisible) {
    document.querySelectorAll('.admin-only').forEach(function (el) {
      setHidden(el, !isVisible);
    });
  }

  function getShellRefs() {
    return {
      app: byId('app'),
      intro: byId('introScreen'),
      splash: byId('splashScreen'),
      main: byId('mainContent'),
      notifBell: byId('notifBell'),
      notifBadge: byId('notifBadge'),
      notifDropdown: byId('notifDropdown'),
      notifList: byId('notifList'),
      moreSheet: byId('moreSheet'),
      moreSheetBackdrop: byId('moreSheetBackdrop'),
    };
  }

  return {
    byId: byId,
    getShellRefs: getShellRefs,
    setHidden: setHidden,
    setExpanded: setExpanded,
    setText: setText,
    syncBadge: syncBadge,
    syncAdminVisibility: syncAdminVisibility,
  };
})();
