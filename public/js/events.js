/* global getUiErrorMessage, retryPromise, isRetriableApiError */
function renderEvents() {
  var container = document.getElementById('eventsList');
  if (!container) return;
  renderEventsState(container, 'loading');
  retryPromise(function () {
    return API.getEvents();
  }, { attempts: 2, delayMs: 350, shouldRetry: isRetriableApiError })
    .then(function (resp) {
      var events = resp.events;
      APPSTATE.setEventsCache(events);
      if (!events.length) {
        renderEventsState(container, 'empty', 'Нет мероприятий. Создайте первое!');
        return;
      }
      var meId = (API.getUser() || {}).id;
      container.innerHTML = events.map(function (ev) { return buildEventCardHtml(ev, meId); }).join('');
      bindEventListActions(container);
    })
    .catch(function (err) {
      renderEventsState(container, 'error', getUiErrorMessage(err, 'Не удалось загрузить мероприятия.'));
      var retryBtn = container.querySelector('[data-action="retry-events"]');
      if (retryBtn) retryBtn.addEventListener('click', renderEvents);
    });
}
