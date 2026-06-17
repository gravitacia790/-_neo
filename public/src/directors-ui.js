import { html, raw, setHtml } from './html.js';

export function renderDirectorCard(d, options) {
  options = options || {};
  var compact = !!options.compact;
  var avatarHtml = d.photo
    ? html`<img src="${d.photo}" class="avatar-img" alt="Фото">`
    : html`<div class="avatar-placeholder">${d.name.charAt(0)}</div>`;
  var ratingHtml = d.rating ? html`<div class="rating-badge">⭐ Рейтинг: ${d.rating.totalScore} баллов</div>` : '';
  var allTags = []
    .concat(
      (d.strengthsDetailed || []).map(function (s) { return s.name; }),
      (d.skillsDetailed || []).map(function (s) { return s.name; })
    )
    .slice(0, compact ? 3 : 5);
  var compactClass = compact ? ' director-card--compact' : '';
  var compactBadge = compact ? html`<div class="favorite-note">⭐ В избранном</div>` : '';
  var infoBlocks = compact
    ? ''
    : html`<div class="info-section"><h4>🤝 Могу быть полезен</h4><p>${d.useful || 'Не указано'}</p></div><div class="info-section"><h4>💡 Хочу узнать</h4><p>${d.wantToKnow || 'Не указано'}</p></div>`;

  return html`<div class="director-card${compactClass}" data-id="${d.id}">
    <div class="card-header">${avatarHtml}<div class="card-title"><h3>${d.name}</h3><p>🏫 ${d.school} • ${d.city}${
      d.isMentor ? raw(' <span class="badge-mentor">✨ Наставник</span>') : ''
    }</p>${compactBadge}${ratingHtml}</div></div>
    ${infoBlocks}
    ${
      allTags.length
        ? html`<div class="tags">${allTags.map(function (t) { return html`<span class="tag">${t}</span>`; })}</div>`
        : ''
    }
    <div class="director-actions">
      <button class="favorite-btn${d.isFavorite ? ' active' : ''}" data-action="favorite" data-id="${d.id}" aria-pressed="${d.isFavorite ? 'true' : 'false'}">${
        d.isFavorite ? '★ В избранном' : '☆ В избранное'
      }</button>
      <button class="contact-btn" data-action="contact" data-id="${d.id}">📞 Связаться</button>
      <button class="detail-btn" data-action="detail" data-id="${d.id}">📖 Подробнее</button>
    </div>
  </div>`;
}

export function renderDirectorsState(container, type, text) {
  if (!container) return;
  if (type === 'loading') {
    setHtml(
      container,
      html`<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`
    );
    return;
  }
  if (type === 'error') {
    var action = container.id === 'mentorsList' ? 'retry-mentors' : 'retry-directors';
    setHtml(
      container,
      html`<div class="list-state is-error"><div class="list-state__text">${text}</div><button class="ghost-btn retry-btn" data-action="${action}">Повторить</button></div>`
    );
    return;
  }
  setHtml(container, html`<div class="list-state">${text}</div>`);
}
