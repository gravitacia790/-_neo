function renderEventsState(container, type, text) {
  if (!container) return;
  if (type === 'loading') {
    container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
    return;
  }
  if (type === 'error') {
    container.innerHTML =
      '<div class="list-state is-error">' +
      '<div class="list-state__text">' + escapeHtml(text) + '</div>' +
      '<button class="ghost-btn retry-btn" data-action="retry-events">Повторить</button>' +
      '</div>';
    return;
  }
  container.innerHTML = '<div class="list-state' + (type === 'error' ? ' is-error' : '') + '">' + escapeHtml(text) + '</div>';
}

function buildEventCardHtml(ev, meId) {
  var isCreator = ev.creatorId === meId;
  var html =
    '<div class="event-card" data-id="' + ev.id + '">' +
    '<h3>' + escapeHtml(ev.title) + '</h3>' +
    '<div class="date">📅 ' + escapeHtml(ev.date) + '</div>' +
    '<p>' + escapeHtml(ev.description) + '</p>' +
    '<div>👥 Записалось: ' + ev.registrations.length + ' / ' + ev.max + '</div>' +
    '<div>👤 Организатор: ' + escapeHtml(ev.creator) + ' (' + escapeHtml(ev.creatorSchool) + ')</div>';

  if (ev.registrations.length) {
    html += '<div><strong>Записавшиеся:</strong><ul>' + ev.registrations.map(function (r) {
      return '<li>' + escapeHtml(r.employeeName) + ' (' + escapeHtml(r.position) + ') — ' + escapeHtml(r.schoolName) + '</li>';
    }).join('') + '</ul></div>';
  }

  html += '<div class="event-actions">';
  if (!isCreator) html += '<button data-action="reg" data-id="' + ev.id + '">📝 Записать сотрудника</button>';
  if (isCreator) html += '<button data-action="del" data-id="' + ev.id + '" style="background:#ff4757;">🗑 Удалить</button>';
  html += '</div></div>';
  return html;
}
