var SHELLDOM = (function () {
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
    setText(el, count > 99 ? '99+' : count || '');
    setHidden(el, count <= 0);
  }

  function syncAdminVisibility(isVisible) {
    document.querySelectorAll('.admin-only').forEach(function (el) {
      setHidden(el, !isVisible);
    });
  }

  function getShellRefs() {
    return {
      app: byId('app'),
      splash: byId('splashScreen'),
      main: byId('mainContent'),
      msgBtn: byId('msgBtn'),
      msgBadge: byId('msgBadge'),
      msgDropdown: byId('msgDropdown'),
      msgList: byId('msgList'),
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
