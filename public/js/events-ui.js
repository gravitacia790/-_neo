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
  var count = ev.registrations.length;
  var max = Number(ev.max) || 999;
  var percent = Math.min(100, Math.round((count / max) * 100));
  var isFull = count >= max;
  var html =
    '<div class="event-card' + (isFull ? ' is-full' : '') + '" data-id="' + ev.id + '">' +
    '<h3>' + escapeHtml(ev.title) + '</h3>' +
    '<div class="date">📅 ' + escapeHtml(ev.date) + '</div>' +
    '<p>' + escapeHtml(ev.description) + '</p>' +
    '<div class="event-capacity"><div><span>👥 Записалось: ' + count + ' / ' + max + '</span>' +
    (isFull ? '<strong>Мест нет</strong>' : '<strong>Свободно: ' + Math.max(max - count, 0) + '</strong>') +
    '</div><div class="event-capacity-bar"><i style="width:' + percent + '%;"></i></div></div>' +
    '<div>👤 Организатор: ' + escapeHtml(ev.creator) + ' (' + escapeHtml(ev.creatorSchool) + ')</div>';

  if (ev.registrations.length) {
    html += '<div class="registration-list"><strong>Записавшиеся:</strong><ul>' + ev.registrations.map(function (r) {
      var canCancel = isCreator || r.registeredBy === meId;
      return '<li><span>' + escapeHtml(r.employeeName) + '</span><small>' + escapeHtml(r.schoolName) + (r.city ? ' • ' + escapeHtml(r.city) : '') + (r.phone ? ' • ' + escapeHtml(r.phone) : '') + '</small>' +
        (canCancel ? '<button class="ghost-btn cancel-inline-btn" data-action="cancel-reg" data-event-id="' + escapeAttr(ev.id) + '" data-registration-id="' + escapeAttr(r.id) + '">Отменить</button>' : '') +
        '</li>';
    }).join('') + '</ul></div>';
  }

  if (ev.materials && ev.materials.length) {
    html += '<div class="event-materials"><strong>Материалы после семинара:</strong>';
    ev.materials.forEach(function (m) {
      html +=
        '<a href="' + escapeAttr(m.url) + '" target="_blank" rel="noopener">' +
        '<span class="material-type-badge">' + escapeHtml(getMaterialTypeLabel(m.materialType)) + '</span>' +
        escapeHtml(m.title) +
        (m.description ? '<small>' + escapeHtml(m.description) + '</small>' : '') +
        '</a>';
    });
    html += '</div>';
  }

  html += '<div class="event-actions">';
  if (!isCreator && !isFull) html += '<button data-action="reg" data-id="' + ev.id + '">📝 Зарегистрироваться</button>';
  if (!isCreator && isFull) html += '<button disabled class="is-disabled">Регистрация закрыта</button>';
  if (isCreator) html += '<button data-action="edit" data-id="' + ev.id + '">Редактировать</button><button data-action="del" data-id="' + ev.id + '" style="background:#ff4757;">🗑 Удалить</button>';
  html += '</div></div>';
  return html;
}
