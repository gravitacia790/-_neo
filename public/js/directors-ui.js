function renderDirectorCard(d, options) {
  options = options || {};
  var compact = !!options.compact;
  var avatarHtml = d.photo
    ? '<img src="' + escapeAttr(d.photo) + '" class="avatar-img" alt="Фото">'
    : '<div class="avatar-placeholder">' + escapeHtml(d.name.charAt(0)) + '</div>';
  var ratingHtml = d.rating ? '<div class="rating-badge">⭐ Рейтинг: ' + d.rating.totalScore + ' баллов</div>' : '';
  var allTags = [].concat(
    (d.strengthsDetailed || []).map(function (s) { return s.name; }),
    (d.skillsDetailed || []).map(function (s) { return s.name; })
  ).slice(0, compact ? 3 : 5);
  var compactClass = compact ? ' director-card--compact' : '';
  var compactBadge = compact ? '<div class="favorite-note">⭐ В избранном</div>' : '';
  var infoBlocks = compact
    ? ''
    : '<div class="info-section"><h4>🤝 Могу быть полезен</h4><p>' + escapeHtml(d.useful || 'Не указано') + '</p></div>' +
      '<div class="info-section"><h4>💡 Хочу узнать</h4><p>' + escapeHtml(d.wantToKnow || 'Не указано') + '</p></div>';

  return (
    '<div class="director-card' + compactClass + '" data-id="' + d.id + '">' +
    '<div class="card-header">' + avatarHtml +
    '<div class="card-title"><h3>' + escapeHtml(d.name) + '</h3><p>🏫 ' + escapeHtml(d.school) + ' • ' + escapeHtml(d.city) +
    (d.isMentor ? ' <span class="badge-mentor">✨ Наставник</span>' : '') + '</p>' + compactBadge + ratingHtml + '</div></div>' +
    infoBlocks +
    (allTags.length ? '<div class="tags">' + allTags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
    '<div class="director-actions">' +
    '<button class="favorite-btn' + (d.isFavorite ? ' active' : '') + '" data-action="favorite" data-id="' + d.id + '" aria-pressed="' + (d.isFavorite ? 'true' : 'false') + '">' +
    (d.isFavorite ? '★ В избранном' : '☆ В избранное') +
    '</button>' +
    '<button class="contact-btn" data-action="contact" data-id="' + d.id + '" data-name="' + escapeHtml(d.name) + '">💬 Связаться</button>' +
    '<button class="detail-btn" data-action="detail" data-id="' + d.id + '">📖 Подробнее</button>' +
    '</div></div>'
  );
}

function renderDirectorsState(container, type, text) {
  if (!container) return;
  if (type === 'loading') {
    container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
    return;
  }
  if (type === 'error') {
    var action = container.id === 'mentorsList' ? 'retry-mentors' : 'retry-directors';
    container.innerHTML =
      '<div class="list-state is-error">' +
      '<div class="list-state__text">' + escapeHtml(text) + '</div>' +
      '<button class="ghost-btn retry-btn" data-action="' + action + '">Повторить</button>' +
      '</div>';
    return;
  }
  container.innerHTML = '<div class="list-state' + (type === 'error' ? ' is-error' : '') + '">' + escapeHtml(text) + '</div>';
}

function renderMentorCard(m) {
  var ratingHtml = m.rating ? '<span class="rating-badge" style="margin-left:8px;">⭐ ' + m.rating.totalScore + '</span>' : '';
  return '<div class="mentor-card"><div><strong>' + escapeHtml(m.name) + '</strong><div>' + escapeHtml(m.school) + '</div><div>' + escapeHtml(m.useful || 'Не указано') + '</div></div><div>' + ratingHtml + '<span class="mentor-pill">Наставник</span></div></div>';
}
