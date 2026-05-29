function renderEvents() {
  var container = document.getElementById('eventsList');
  if (!container) return;
  renderEventsState(container, 'loading');
  API.getEvents()
    .then(function (resp) {
      var events = resp.events;
      if (!events.length) {
        renderEventsState(container, 'empty', 'Нет мероприятий. Создайте первое!');
        return;
      }
      var meId = (API.getUser() || {}).id;
      container.innerHTML = events.map(function (ev) { return buildEventCardHtml(ev, meId); }).join('');
      bindEventListActions(container);
    })
    .catch(function (err) {
      renderEventsState(container, 'error', err.message || 'Ошибка загрузки мероприятий');
    });
}
