/* global SHELLDOM */
var OVERLAY = (function () {
  function toggle(trigger, panel, expanded) {
    SHELLDOM.setHidden(panel, !expanded);
    SHELLDOM.setExpanded(trigger, expanded);
  }

  function closeOnEscape(closeFn) {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeFn();
    });
  }

  function closeOnOutside(panel, trigger, isOpenFn, closeFn) {
    document.addEventListener('click', function (e) {
      if (!panel || !trigger || !isOpenFn()) return;
      if (!panel.contains(e.target) && !trigger.contains(e.target)) closeFn();
    });
  }

  return {
    toggle: toggle,
    closeOnEscape: closeOnEscape,
    closeOnOutside: closeOnOutside,
  };
})();
