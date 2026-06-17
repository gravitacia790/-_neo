import { SHELLDOM } from './shell-dom.js';
export var OVERLAY = (function () {
  var escapeHandlers = [];
  var outsideHandlers = [];
  var listenersBound = false;

  function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      escapeHandlers.forEach(function (fn) { fn(); });
    });
    document.addEventListener('click', function (e) {
      outsideHandlers.forEach(function (entry) {
        if (!entry.panel || !entry.trigger || !entry.isOpenFn()) return;
        if (!entry.panel.contains(e.target) && !entry.trigger.contains(e.target)) entry.closeFn();
      });
    });
  }

  function toggle(trigger, panel, expanded) {
    SHELLDOM.setHidden(panel, !expanded);
    SHELLDOM.setExpanded(trigger, expanded);
  }

  function closeOnEscape(closeFn) {
    bindGlobalListeners();
    if (escapeHandlers.indexOf(closeFn) === -1) escapeHandlers.push(closeFn);
  }

  function closeOnOutside(panel, trigger, isOpenFn, closeFn) {
    bindGlobalListeners();
    var exists = outsideHandlers.some(function (entry) {
      return entry.panel === panel && entry.trigger === trigger && entry.closeFn === closeFn;
    });
    if (!exists) outsideHandlers.push({ panel: panel, trigger: trigger, isOpenFn: isOpenFn, closeFn: closeFn });
  }

  return {
    toggle: toggle,
    closeOnEscape: closeOnEscape,
    closeOnOutside: closeOnOutside,
  };
})();
